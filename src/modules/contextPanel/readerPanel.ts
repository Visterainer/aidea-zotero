/**
 * Reader Panel — persistent DOM caching for reader-mode tabs.
 *
 * Mirrors the library-mode pattern from libraryPanel.ts: each conversation key
 * gets a cached host element that is reparented into the section body on tab
 * switch, avoiding a full DOM rebuild (buildUI + setupHandlers + refreshChat)
 * every time the user switches between PDF tabs.
 */

import { buildUI } from "./buildUI";
import { setupHandlers } from "./setupHandlers";
import { ensureConversationLoaded, refreshChat } from "./chat";
import { renderShortcuts } from "./shortcuts";
import {
  ensureDocumentContext,
  resolveReaderDocument,
} from "./documentContext";
import { getDocumentAdapter } from "./document/registry";
import {
  isSelectionTranslateEnabled,
  warmSelectionTranslateColdStartForReader,
} from "./selectionTranslate";
import { setStatus } from "./textUtils";
import {
  selectedFileAttachmentCache,
  selectedFilePreviewExpandedCache,
  activePaperConversationByItem,
} from "./state";
import {
  createPaperConversation,
  getLatestPaperConversation,
  initChatStore,
} from "../../utils/chatStore";
import { getPanelI18n } from "./i18n";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ReaderPanelState {
  host: HTMLElement;
  hasBootstrapped: boolean;
  bootstrapPromise: Promise<void> | null;
}

const panelStateByWindow = new WeakMap<Window, Map<number, ReaderPanelState>>();

function getWindowMap(win: Window): Map<number, ReaderPanelState> {
  let map = panelStateByWindow.get(win);
  if (!map) {
    map = new Map();
    panelStateByWindow.set(win, map);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSharedReaderPanelHostForItem(
  win: Window,
  item: Zotero.Item,
): HTMLElement {
  const key = item.id;
  const map = getWindowMap(win);
  let state = map.get(key);
  if (!state) {
    const doc = win.document;
    const host = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLDivElement;
    host.id = "llm-reader-panel-host";
    host.dataset.tabType = "reader";
    state = { host, hasBootstrapped: false, bootstrapPromise: null };
    map.set(key, state);
  }
  return state.host;
}

export async function bootstrapSharedReaderPanel(
  win: Window,
  host: HTMLElement,
  item: Zotero.Item,
): Promise<void> {
  const key = item.id;
  const map = getWindowMap(win);
  const state = map.get(key);
  if (!state) return;
  if (state.bootstrapPromise) {
    return state.bootstrapPromise;
  }
  if (state.hasBootstrapped) return;

  let resolveBootstrap: () => void = () => undefined;
  state.bootstrapPromise = new Promise<void>((resolve) => {
    resolveBootstrap = resolve;
  });

  // Mark immediately to prevent parallel initialization
  state.hasBootstrapped = true;

  try {
    await initChatStore();

    // ── Resolve active paper conversation key ──
    // Each PDF item can have multiple conversations. Resolve the active one
    // (or create it if none exists) and store in activePaperConversationByItem.
    if (!activePaperConversationByItem.has(item.id)) {
      const latest = await getLatestPaperConversation(item.id);
      if (!latest) {
        // First time opening this PDF — create the initial conversation.
        const newKey = await createPaperConversation(item.id);
        if (newKey > 0) {
          activePaperConversationByItem.set(item.id, newKey);
        }
      } else {
        activePaperConversationByItem.set(item.id, latest.conversationKey);
      }
    }

    buildUI(host, item);
    await ensureConversationLoaded(item);
    await renderShortcuts(host, item);
    setupHandlers(host, item);
    refreshChat(host, item);

    // Defer document extraction so the panel becomes interactive sooner.
    // Use the panel's own item directly — getActiveContextAttachmentFromTabs()
    // queries global tab state which may return a different reader document.
    const readerDocument = resolveReaderDocument(item);
    if (readerDocument) {
      const adapter = getDocumentAdapter(readerDocument.kind);
      if (adapter?.contextPolicy.eagerWarmup) {
        void ensureDocumentContext(readerDocument);
      }
      if (
        adapter?.selectionContextPolicy.strategy === "cold-start-cache" &&
        isSelectionTranslateEnabled()
      ) {
        const status = host.querySelector("#llm-status") as HTMLElement | null;
        const i18n = getPanelI18n();
        void warmSelectionTranslateColdStartForReader({
          item,
          callbacks: {
            onStage(stage) {
              if (stage === "cold-start") {
                if (status) {
                  setStatus(
                    status,
                    i18n.selectionTranslateColdStartStatus,
                    "ready",
                  );
                }
              }
            },
          },
        })
          .then((ready) => {
            if (!ready) return;
            if (status) {
              setStatus(status, i18n.selectionTranslateCacheReady, "ready");
            }
          })
          .catch((err) => {
            ztoolkit.log("LLM: selection translation cold start failed", err);
          });
      }
    }
  } catch (err) {
    ztoolkit.log(`LLM: bootstrapSharedReaderPanel failed: ${err}`);
    state.hasBootstrapped = false;
  } finally {
    resolveBootstrap();
    state.bootstrapPromise = null;
  }
}

export function invalidateSharedReaderPanelForItem(
  win: Window,
  item: Zotero.Item,
): void {
  const key = item.id;
  const map = getWindowMap(win);
  const state = map.get(key);
  if (state) {
    const heightSync = (
      state.host as typeof state.host & {
        __llmHeightSync?: { dispose?: () => void } | null;
      }
    ).__llmHeightSync;
    heightSync?.dispose?.();
    state.hasBootstrapped = false;
    state.bootstrapPromise = null;
    // Clear stale file preview expansion for this item
    selectedFilePreviewExpandedCache.delete(key);
  }
}

export function removeReaderPanels(win: Window): void {
  const map = panelStateByWindow.get(win);
  if (!map) return;
  for (const [, state] of map) {
    const heightSync = (
      state.host as typeof state.host & {
        __llmHeightSync?: { dispose?: () => void } | null;
      }
    ).__llmHeightSync;
    heightSync?.dispose?.();
    state.host.remove();
  }
  map.clear();
}
