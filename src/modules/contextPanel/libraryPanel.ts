/**
 * Library Panel — handles the "no item selected" case in library mode.
 *
 * When an item IS selected in library mode, the normal registerSection
 * callbacks handle everything (onRender/onAsyncRender build the global chat).
 *
 * When NO item is selected, Zotero's render() returns early and our section
 * never gets created. This module injects a standalone panel INSIDE the
 * item-pane element to show the global chat, replacing the native
 * "此部分中有N个条目" placeholder.
 */

import { buildUI } from "./buildUI";
import { setupHandlers } from "./setupHandlers";
import { ensureConversationLoaded, refreshChat } from "./chat";
import { renderShortcuts } from "./shortcuts";
import { createGlobalPortalItem, resolveActiveLibraryID } from "./portalScope";
import { config } from "../../../package.json";
import {
  createGlobalConversation,
  getLatestEmptyGlobalConversation,
  initChatStore,
} from "../../utils/chatStore";
import {
  activeConversationModeByLibrary,
  activeGlobalConversationByLibrary,
} from "./state";
import {
  getLibrarySelectedItemIdsFromWindow,
  getLibrarySelectionState,
  getLibrarySelectionStateFromWindow,
  resolveLibraryPanelDisplayState,
  type LibraryPanelNativeMode,
  type LibrarySelectionState,
} from "./librarySelection";

// ---------------------------------------------------------------------------
// Shared State for DOM Reparenting
// ---------------------------------------------------------------------------

interface LibraryPanelState {
  host: HTMLElement;
  notifierID: string | null;
  hasBootstrapped: boolean;
  mutationObserver: MutationObserver | null;
  selectionListener: (() => void) | null;
  selectionPollTimer: number | null;
  lastSelectionSignature: string;
  lastSelectionState: LibrarySelectionState;
  lastNativeMessageSignature: string;
  manualStandaloneActive: boolean;
  updateTimer: number | null;
  applyingVisibility: boolean;
}

const panelStateByWindow = new WeakMap<Window, LibraryPanelState>();
const LIBRARY_VISIBILITY_UPDATE_DELAY_MS = 50;

export function getSharedLibraryPanelHost(win: Window): HTMLElement {
  let state = panelStateByWindow.get(win);
  if (!state) {
    const doc = win.document;
    const host = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLDivElement;
    host.id = "llm-library-panel-host";
    host.dataset.tabType = "library";
    state = {
      host,
      notifierID: null,
      hasBootstrapped: false,
      mutationObserver: null,
      selectionListener: null,
      selectionPollTimer: null,
      lastSelectionSignature: "",
      lastSelectionState: "empty",
      lastNativeMessageSignature: "",
      manualStandaloneActive: false,
      updateTimer: null,
      applyingVisibility: false,
    };
    panelStateByWindow.set(win, state);
  }
  return state.host;
}

export async function bootstrapSharedLibraryPanel(
  win: Window,
  host: HTMLElement,
): Promise<void> {
  const state = panelStateByWindow.get(win);
  if (!state) return;
  if (state.hasBootstrapped) return;

  // Mark as bootstrapped immediately to prevent parallel initialization
  state.hasBootstrapped = true;

  try {
    await initChatStore();

    const libraryID = resolveActiveLibraryID() || 1;
    let globalKey = Number(
      activeGlobalConversationByLibrary.get(libraryID) || 0,
    );
    if (!Number.isFinite(globalKey) || globalKey <= 0) {
      try {
        const latest = await getLatestEmptyGlobalConversation(libraryID);
        globalKey = Number(latest?.conversationKey || 0);
      } catch {
        /* ignore */
      }
      if (!Number.isFinite(globalKey) || globalKey <= 0) {
        try {
          globalKey = await createGlobalConversation(libraryID);
        } catch {
          /* ignore */
        }
      }
    }

    let effectiveItem: Zotero.Item | null = null;
    if (Number.isFinite(globalKey) && globalKey > 0) {
      effectiveItem = createGlobalPortalItem(libraryID, Math.floor(globalKey));
      activeConversationModeByLibrary.set(libraryID, "global");
      activeGlobalConversationByLibrary.set(libraryID, Math.floor(globalKey));
    }

    buildUI(host, effectiveItem);
    if (effectiveItem) {
      await ensureConversationLoaded(effectiveItem);
    }
    await renderShortcuts(host, effectiveItem);
    setupHandlers(host, effectiveItem);
    refreshChat(host, effectiveItem);
  } catch (err) {
    ztoolkit.log(`LLM: bootstrapSharedLibraryPanel failed: ${err}`);
    state.hasBootstrapped = false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLibraryTab(win: any): boolean {
  try {
    const tabs = win?.Zotero_Tabs;
    const type = tabs?.selectedType;
    if (type) {
      return type === "library";
    }
  } catch (_err) {
    void _err;
  }
  return false;
}

function findItemMessagePane(doc: Document): Element | null {
  return doc.getElementById("zotero-item-message");
}

const STANDALONE_SIDENAV_BUTTON_ID = "llm-library-standalone-sidenav-btn";
const STANDALONE_SIDENAV_WRAPPER_CLASS = "llm-library-standalone-pin-wrapper";
const STANDALONE_SIDENAV_BUTTON_CLASS = "llm-library-standalone-sidenav-btn";

function getItemPaneElement(doc: Document) {
  return doc.getElementById("zotero-item-pane") as
    | (HTMLElement & {
        mode?: string;
        collapsed?: boolean;
        editable?: boolean;
        collectionTreeRow?: unknown;
        render?: () => boolean | Promise<boolean>;
      })
    | null;
}

function getItemMessagePaneElement(doc: Document) {
  return doc.getElementById("zotero-item-message") as
    | (HTMLElement & {
        render?: (
          content:
            | Node
            | string
            | { l10nId: string; l10nArgs?: Record<string, unknown> },
        ) => void;
        renderCustomHead?: (callback?: unknown) => void;
      })
    | null;
}

function getItemMessageBoxElement(doc: Document): HTMLElement | null {
  return doc.getElementById(
    "zotero-item-pane-message-box",
  ) as HTMLElement | null;
}

function prepareStandaloneMessagePaneLayout(messagePane: HTMLElement): void {
  const groupbox = messagePane.querySelector(
    "#zotero-item-pane-groupbox",
  ) as HTMLElement | null;
  const messageBox = messagePane.querySelector(
    "#zotero-item-pane-message-box",
  ) as HTMLElement | null;

  for (const element of [messagePane, groupbox, messageBox]) {
    if (!element) continue;
    element.setAttribute("flex", "1");
    element.style.display = "flex";
    element.style.flex = "1 1 auto";
    element.style.minWidth = "0";
    element.style.minHeight = "0";
    element.style.width = "100%";
    element.style.height = "100%";
  }

  groupbox?.removeAttribute("pack");
  groupbox?.removeAttribute("align");
  if (groupbox) {
    groupbox.style.alignItems = "stretch";
    groupbox.style.justifyContent = "stretch";
  }
  if (messageBox) {
    messageBox.style.flexDirection = "column";
    messageBox.style.alignItems = "stretch";
    messageBox.style.justifyContent = "stretch";
  }
}

function getItemPaneSidenavButtonContainer(doc: Document): HTMLElement | null {
  return doc.querySelector(
    "#zotero-view-item-sidenav .inherit-flex",
  ) as HTMLElement | null;
}

function getStandaloneLibrarySidenavButton(doc: Document): HTMLElement | null {
  return doc.getElementById(STANDALONE_SIDENAV_BUTTON_ID) as HTMLElement | null;
}

function syncStandaloneLibrarySidenavButtonState(win: Window): void {
  const doc = win.document;
  const button = getStandaloneLibrarySidenavButton(doc);
  if (!button) return;

  const itemPane = getItemPaneElement(doc);
  const messagePane = getItemMessagePaneElement(doc);
  const state = panelStateByWindow.get(win);
  const active =
    itemPane?.mode === "message" &&
    Boolean(messagePane && state?.host && messagePane.contains(state.host));
  button.setAttribute("aria-selected", active ? "true" : "false");
  button.classList.toggle("active", active);
}

function removeStandaloneLibrarySidenavButton(doc: Document): void {
  const button = getStandaloneLibrarySidenavButton(doc);
  button?.parentElement?.remove();
}

function ensureStandaloneLibrarySidenavButton(win: Window): void {
  const doc = win.document;
  if (getStandaloneLibrarySidenavButton(doc)) return;

  const container = getItemPaneSidenavButtonContainer(doc);
  if (!container) return;

  const wrapper = doc.createElement("div");
  wrapper.className = `pin-wrapper ${STANDALONE_SIDENAV_WRAPPER_CLASS}`;

  const button = doc.createElement("div");
  button.id = STANDALONE_SIDENAV_BUTTON_ID;
  button.className = `btn ${STANDALONE_SIDENAV_BUTTON_CLASS}`;
  button.setAttribute("custom", "true");
  button.setAttribute("tabindex", "0");
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", "false");
  button.title = "AIdea";
  button.style.cssText = [
    `--custom-sidenav-icon-light: url('chrome://${config.addonRef}/content/icons/icon-20.png')`,
    `--custom-sidenav-icon-dark: url('chrome://${config.addonRef}/content/icons/icon-20.png')`,
  ].join("; ");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void (async () => {
      const itemPane = getItemPaneElement(doc);
      if (itemPane?.collapsed) {
        itemPane.collapsed = false;
      }
      if (itemPane && isLibraryTab(win)) {
        const state = panelStateByWindow.get(win);
        if (state) {
          state.manualStandaloneActive = true;
        }
        await ensureStandaloneLibraryPanelVisible(win);
      }
      const input = doc.querySelector(
        "#llm-input",
      ) as HTMLTextAreaElement | null;
      input?.focus({ preventScroll: true });
    })().catch((err) => {
      ztoolkit.log("LLM: standalone library sidenav click failed", err);
    });
  });
  button.addEventListener("keydown", (event: KeyboardEvent) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    button.click();
  });

  wrapper.appendChild(button);
  container.appendChild(wrapper);
  syncStandaloneLibrarySidenavButtonState(win);
}

async function ensureStandaloneLibraryPanelVisible(win: Window): Promise<void> {
  const doc = win.document;
  const state = panelStateByWindow.get(win);
  const itemPane = getItemPaneElement(doc);
  const messagePane = getItemMessagePaneElement(doc);
  if (!messagePane) return;

  if (state) {
    state.manualStandaloneActive = true;
  }
  if (itemPane?.collapsed) {
    itemPane.collapsed = false;
  }
  if (itemPane && itemPane.mode !== "message") {
    itemPane.mode = "message";
  }
  prepareStandaloneMessagePaneLayout(messagePane);

  const host = getSharedLibraryPanelHost(win);
  const messageBox = getItemMessageBoxElement(doc);
  const needsReplaceRender =
    !messagePane.contains(host) ||
    host.dataset.libraryPlacement !== "replace" ||
    !messageBox ||
    messageBox.firstElementChild !== host ||
    messageBox.children.length !== 1;
  host.dataset.libraryPlacement = "replace";
  if (needsReplaceRender) {
    if (state) {
      state.applyingVisibility = true;
    }
    try {
      messagePane.renderCustomHead?.();
      messagePane.render?.(host);
    } finally {
      if (state) {
        win.setTimeout(() => {
          state.applyingVisibility = false;
        }, 0);
      }
    }
  }
  host.style.display = "flex";

  ensureStandaloneLibrarySidenavButton(win);
  syncStandaloneLibrarySidenavButtonState(win);
  await bootstrapSharedLibraryPanel(win, host);
}

async function ensureStandaloneLibraryPanelAppended(
  win: Window,
  selectionSignature: string,
): Promise<void> {
  const doc = win.document;
  const state = panelStateByWindow.get(win);
  const itemPane = getItemPaneElement(doc);
  const messagePane = getItemMessagePaneElement(doc);
  if (!itemPane || !messagePane) return;

  if (itemPane.collapsed) {
    itemPane.collapsed = false;
  }

  const host = getSharedLibraryPanelHost(win);
  const messageBox = getItemMessageBoxElement(doc);
  const needsNativeRender =
    itemPane.mode !== "message" ||
    host.dataset.libraryPlacement !== "append" ||
    state?.lastNativeMessageSignature !== selectionSignature ||
    !messageBox?.querySelector("description");

  if (state) {
    state.applyingVisibility = true;
  }
  try {
    if (needsNativeRender) {
      if (itemPane.mode !== "message") {
        itemPane.mode = "message";
      }
      await itemPane.render?.();
    }

    prepareStandaloneMessagePaneLayout(messagePane);
    const latestMessageBox = getItemMessageBoxElement(doc);
    if (latestMessageBox && !latestMessageBox.contains(host)) {
      latestMessageBox.appendChild(host);
    }
    host.dataset.libraryPlacement = "append";
    host.style.display = "flex";
    if (state) {
      state.lastNativeMessageSignature = selectionSignature;
    }
  } finally {
    if (state) {
      win.setTimeout(() => {
        state.applyingVisibility = false;
      }, 0);
    }
  }

  ensureStandaloneLibrarySidenavButton(win);
  syncStandaloneLibrarySidenavButtonState(win);
  await bootstrapSharedLibraryPanel(win, host);
}

async function restoreNativeLibraryPane(
  win: Window,
  mode: LibraryPanelNativeMode,
  options: { removeStandaloneButton?: boolean } = {},
): Promise<void> {
  const doc = win.document;
  const state = panelStateByWindow.get(win);
  const itemPane = getItemPaneElement(doc);
  const messagePane = getItemMessagePaneElement(doc);

  if (options.removeStandaloneButton !== false) {
    removeStandaloneLibrarySidenavButton(doc);
  }

  if (state) {
    state.applyingVisibility = true;
  }
  try {
    const hadStandaloneHost = Boolean(
      state?.host && messagePane?.contains(state.host),
    );
    if (state?.host && messagePane?.contains(state.host)) {
      state.host.remove();
      state.host.dataset.libraryPlacement = "";
    }
    if (state) {
      state.lastNativeMessageSignature = "";
    }
    const needsModeChange = Boolean(itemPane && itemPane.mode !== mode);
    if (itemPane && needsModeChange) {
      itemPane.mode = mode;
    }
    if (hadStandaloneHost || needsModeChange) {
      await itemPane?.render?.();
    }
  } finally {
    if (state) {
      win.setTimeout(() => {
        state.applyingVisibility = false;
      }, 0);
    }
  }
}

async function runLibraryPanelVisibilityUpdate(win: Window): Promise<void> {
  const doc = win.document;
  const state = panelStateByWindow.get(win);
  const itemPane = getItemPaneElement(doc);
  if (!itemPane) return;

  if (!isLibraryTab(win)) {
    removeStandaloneLibrarySidenavButton(doc);
    return;
  }

  const selectedItemIds = getLibrarySelectedItemIdsFromWindow(win);
  const selectionSignature = selectedItemIds.join(",");
  const nativeMessageSignature = `${selectedItemIds.length}`;
  const selectionState = getLibrarySelectionState(
    selectedItemIds.map((id) => ({ id })),
  );
  const resolvedDisplayState = resolveLibraryPanelDisplayState({
    selectionState,
    selectionSignature,
    previousSelectionState: state?.lastSelectionState,
    previousSelectionSignature: state?.lastSelectionSignature,
    manualStandaloneActive: state?.manualStandaloneActive,
  });
  if (state && resolvedDisplayState.selectionChanged) {
    state.lastSelectionSignature = selectionSignature;
    state.lastSelectionState = selectionState;
  }
  if (state) {
    state.manualStandaloneActive = resolvedDisplayState.manualStandaloneActive;
  }

  if (resolvedDisplayState.displayState.standalonePanelVisible) {
    if (
      resolvedDisplayState.displayState.standalonePanelPlacement === "append"
    ) {
      await ensureStandaloneLibraryPanelAppended(win, nativeMessageSignature);
    } else {
      await ensureStandaloneLibraryPanelVisible(win);
    }
    return;
  }

  await restoreNativeLibraryPane(
    win,
    resolvedDisplayState.displayState.nativeMode,
    {
      removeStandaloneButton:
        !resolvedDisplayState.displayState.standaloneButtonVisible,
    },
  );
  if (resolvedDisplayState.displayState.standaloneButtonVisible) {
    ensureStandaloneLibrarySidenavButton(win);
  }
  syncStandaloneLibrarySidenavButtonState(win);
}

function scheduleLibraryPanelVisibilityUpdate(win: Window): void {
  const state =
    panelStateByWindow.get(win) ||
    (() => {
      getSharedLibraryPanelHost(win);
      return panelStateByWindow.get(win)!;
    })();

  if (state.updateTimer !== null) {
    win.clearTimeout(state.updateTimer);
  }

  state.updateTimer = win.setTimeout(() => {
    state.updateTimer = null;
    void runLibraryPanelVisibilityUpdate(win).catch((err) => {
      ztoolkit.log("LLM: updateLibraryPanelVisibility failed", err);
    });
  }, LIBRARY_VISIBILITY_UPDATE_DELAY_MS);
}

// ---------------------------------------------------------------------------
// Standalone panel injection (for no-item-selected case)
// ---------------------------------------------------------------------------

// Removed: standalone panel injection logic.
// We now only show the panel when an item is selected (handled by index.ts).

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function injectLibraryPanel(
  win: _ZoteroTypes.MainWindow,
): Promise<void> {
  const state =
    panelStateByWindow.get(win) ||
    (() => {
      getSharedLibraryPanelHost(win);
      return panelStateByWindow.get(win)!;
    })();

  if (!state.notifierID) {
    state.notifierID = Zotero.Notifier.registerObserver(
      {
        notify: (_action: string, type: string) => {
          if (type === "tab" || type === "itempane") {
            scheduleLibraryPanelVisibilityUpdate(win);
          }
        },
      },
      ["tab", "itempane"],
      "llm-library-panel",
    );
  }

  if (!state.mutationObserver) {
    const observer = new win.MutationObserver((mutations: MutationRecord[]) => {
      if (state.applyingVisibility) return;
      const selectionState = getLibrarySelectionStateFromWindow(win);
      if (selectionState === "single") {
        const messagePane = findItemMessagePane(win.document);
        const hasStandaloneHost = Boolean(
          state.host && messagePane?.contains(state.host),
        );
        if (!hasStandaloneHost) return;
      }
      const onlyPluginInternalChanges = mutations.every((mutation) => {
        const target = mutation.target;
        if (target === state.host || state.host.contains(target)) {
          return true;
        }
        const changedNodes = [
          ...Array.from(mutation.addedNodes),
          ...Array.from(mutation.removedNodes),
        ].filter((node): node is Node => Boolean(node));
        return (
          changedNodes.length > 0 &&
          changedNodes.every(
            (node) => node === state.host || state.host.contains(node),
          )
        );
      });
      if (onlyPluginInternalChanges) return;
      scheduleLibraryPanelVisibilityUpdate(win);
    });

    const itemPane = getItemPaneElement(win.document);
    if (itemPane) {
      observer.observe(itemPane, {
        attributes: true,
        attributeFilter: ["view-type"],
      });
    }

    const messagePane = findItemMessagePane(win.document);
    if (messagePane) {
      observer.observe(messagePane, {
        childList: true,
        subtree: true,
      });
    }

    state.mutationObserver = observer;
  }

  if (!state.selectionListener) {
    state.selectionListener = () => scheduleLibraryPanelVisibilityUpdate(win);
    try {
      const onSelect = (win as any)?.ZoteroPane?.itemsView?.onSelect;
      if (onSelect?.addListener) {
        onSelect.addListener(state.selectionListener);
      }
    } catch (err) {
      ztoolkit.log("LLM: failed to attach library selection listener", err);
    }
  }

  if (state.selectionPollTimer === null) {
    const selectedItemIds = getLibrarySelectedItemIdsFromWindow(win);
    state.lastSelectionSignature = selectedItemIds.join(",");
    state.lastSelectionState = getLibrarySelectionState(
      selectedItemIds.map((id) => ({ id })),
    );
    state.selectionPollTimer = win.setInterval(() => {
      if (!isLibraryTab(win)) return;
      const nextSignature = getLibrarySelectedItemIdsFromWindow(win).join(",");
      if (nextSignature === state.lastSelectionSignature) return;
      scheduleLibraryPanelVisibilityUpdate(win);
    }, 350);
  }

  scheduleLibraryPanelVisibilityUpdate(win);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export function removeLibraryPanel(win: Window): void {
  const state = panelStateByWindow.get(win);
  if (!state) return;

  if (state.notifierID) {
    try {
      Zotero.Notifier.unregisterObserver(state.notifierID);
    } catch (_err) {
      void _err;
    }
  }

  if (state.mutationObserver) {
    state.mutationObserver.disconnect();
  }

  if (state.selectionListener) {
    try {
      const onSelect = (win as any)?.ZoteroPane?.itemsView?.onSelect;
      if (onSelect?.removeListener) {
        onSelect.removeListener(state.selectionListener);
      }
    } catch (_err) {
      void _err;
    }
  }

  if (state.selectionPollTimer !== null) {
    win.clearInterval(state.selectionPollTimer);
  }

  if (state.updateTimer !== null) {
    win.clearTimeout(state.updateTimer);
  }

  if (state.host) {
    const heightSync = (
      state.host as typeof state.host & {
        __llmHeightSync?: { dispose?: () => void } | null;
      }
    ).__llmHeightSync;
    heightSync?.dispose?.();
    state.host.remove();
  }

  panelStateByWindow.delete(win);
}

export function updateLibraryPanelVisibility(_win: Window): void {
  scheduleLibraryPanelVisibilityUpdate(_win);
}
