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
import { ensurePDFTextCached } from "./pdfContext";
import {
  selectedFileAttachmentCache,
  selectedFilePreviewExpandedCache,
  activePaperConversationByItem,
} from "./state";
import {
  createPaperConversation,
  getLatestPaperConversation,
} from "../../utils/chatStore";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ReaderPanelState {
  host: HTMLElement;
  hasBootstrapped: boolean;
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
    state = { host, hasBootstrapped: false };
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
  if (state.hasBootstrapped) return;

  // Mark immediately to prevent parallel initialization
  state.hasBootstrapped = true;

  try {
    // ── Resolve active paper conversation key ──
    // Each PDF item can have multiple conversations. Resolve the active one
    // (or create it if none exists) and store in activePaperConversationByItem.
    if (!activePaperConversationByItem.has(item.id)) {
      let latest = await getLatestPaperConversation(item.id);
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

    // Defer PDF extraction so the panel becomes interactive sooner.
    // Use the panel's own item directly — getActiveContextAttachmentFromTabs()
    // queries global tab state which may return a different reader's PDF.
    if (
      item.isAttachment?.() &&
      item.attachmentContentType === "application/pdf"
    ) {
      void ensurePDFTextCached(item);
    }
  } catch (err) {
    ztoolkit.log(`LLM: bootstrapSharedReaderPanel failed: ${err}`);
    state.hasBootstrapped = false;
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
