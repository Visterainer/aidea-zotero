import { initLocale } from "./utils/locale";
import { config } from "../package.json";
import {
  removeLLMStyles,
  registerReaderContextPanel,
  registerLLMStyles,
  registerReaderSelectionTracking,
  unregisterReaderContextPanel,
  unregisterReaderSelectionTracking,
} from "./modules/contextPanel";
import {
  injectLibraryPanel,
  removeLibraryPanel,
} from "./modules/contextPanel/libraryPanel";
import { removeReaderPanels } from "./modules/contextPanel/readerPanel";
import { initChatStore } from "./utils/chatStore";
import { initMemoryStore } from "./utils/memoryStore";
import {
  initAttachmentRefStore,
  reconcileNoteAttachmentRefsFromNoteContent,
  collectAndDeleteUnreferencedBlobs,
  ATTACHMENT_GC_MIN_AGE_MS,
} from "./utils/attachmentRefStore";
import { initSelectionTranslateCacheStore } from "./utils/selectionTranslateCacheStore";
import { createZToolkit } from "./utils/ztoolkit";
import { ensureZoteroProxyFromSystem } from "./utils/oauthCli";
import { maybeShowOpenAIUpdateNotice } from "./modules/updateNotice";
import {
  registerOAuthEnvUpdateSchedulerWindow,
  shutdownOAuthEnvUpdateScheduler,
  unregisterOAuthEnvUpdateSchedulerWindow,
} from "./modules/oauthEnvUpdateScheduler";
import {
  registerAuthorProfiles,
  shutdownAuthorProfiles,
} from "./modules/authorProfiles";

const PREF_PANE_ID = `${config.addonRef}-preferences-pane`;

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Auto-detect system proxy and apply to Gecko so fetch() works with chatgpt.com etc.
  try {
    await ensureZoteroProxyFromSystem();
  } catch (err) {
    ztoolkit.log("LLM: Failed to apply system proxy", err);
  }

  try {
    await initChatStore();
  } catch (err) {
    ztoolkit.log("LLM: Failed to initialize chat store", err);
  }
  try {
    await initMemoryStore();
  } catch (err) {
    ztoolkit.log("LLM: Failed to initialize memory store", err);
  }
  try {
    await initAttachmentRefStore();
  } catch (err) {
    ztoolkit.log("LLM: Failed to initialize attachment reference store", err);
  }
  try {
    await initSelectionTranslateCacheStore();
  } catch (err) {
    ztoolkit.log(
      "LLM: Failed to initialize selection translate cache store",
      err,
    );
  }

  void (async () => {
    try {
      await reconcileNoteAttachmentRefsFromNoteContent();
      await collectAndDeleteUnreferencedBlobs(ATTACHMENT_GC_MIN_AGE_MS);
    } catch (err) {
      ztoolkit.log("LLM: Attachment ref reconciliation/GC failed", err);
    }
  })();

  registerPrefsPane();
  registerAuthorProfiles();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  registerLLMStyles(win);
  registerReaderContextPanel();
  registerReaderSelectionTracking();
  await injectLibraryPanel(win);

  win.setTimeout(() => {
    try {
      maybeShowOpenAIUpdateNotice(win);
    } catch (err) {
      ztoolkit.log("AIdea: failed to show update notice", err);
    }
  }, 600);

  registerOAuthEnvUpdateSchedulerWindow(win);
}

function registerPrefsPane() {
  try {
    Zotero.PreferencePanes.unregister(PREF_PANE_ID);
  } catch (_err) {
    void _err;
  }
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    id: PREF_PANE_ID,
    src: `chrome://${addon.data.config.addonRef}/content/preferences.xhtml`,
    label: "AIdea",
    image: `chrome://${addon.data.config.addonRef}/content/icons/icon-20.png`,
  });
}

async function onMainWindowUnload(win: Window): Promise<void> {
  unregisterOAuthEnvUpdateSchedulerWindow(win);
  removeLibraryPanel(win);
  removeReaderPanels(win);
  removeLLMStyles(win);
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  try {
    for (const win of Zotero.getMainWindows()) {
      try {
        unregisterOAuthEnvUpdateSchedulerWindow(win);
        removeLibraryPanel(win);
        removeReaderPanels(win);
        removeLLMStyles(win);
      } catch (err) {
        ztoolkit.log("LLM: failed to clean up main window on shutdown", err);
      }
    }
  } catch (err) {
    ztoolkit.log("LLM: failed to enumerate main windows on shutdown", err);
  }
  unregisterReaderSelectionTracking();
  unregisterReaderContextPanel();
  try {
    Zotero.PreferencePanes.unregister(PREF_PANE_ID);
  } catch (_err) {
    void _err;
  }
  shutdownAuthorProfiles();
  shutdownOAuthEnvUpdateScheduler();
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // You can add your code to the corresponding notify type
  ztoolkit.log("notify", event, type, ids, extraData);
  return;
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      // No longer used, preferences have moved to sidebar Setting panel
      break;
    default:
      return;
  }
}

function onDialogEvents(_type: string) {
  return;
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onDialogEvents,
};
