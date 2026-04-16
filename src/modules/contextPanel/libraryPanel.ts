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
import {
  createGlobalPortalItem,
  resolveActiveLibraryID,
} from "./portalScope";
import {
  createGlobalConversation,
  getLatestEmptyGlobalConversation,
} from "../../utils/chatStore";
import {
  activeConversationModeByLibrary,
  activeGlobalConversationByLibrary,
} from "./state";

// ---------------------------------------------------------------------------
// Shared State for DOM Reparenting
// ---------------------------------------------------------------------------

interface LibraryPanelState {
  host: HTMLElement;
  notifierID: string | null;
  hasBootstrapped: boolean;
}

const panelStateByWindow = new WeakMap<Window, LibraryPanelState>();

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
    state = { host, notifierID: null, hasBootstrapped: false };
    panelStateByWindow.set(win, state);
  }
  return state.host;
}

export async function bootstrapSharedLibraryPanel(win: Window, host: HTMLElement): Promise<void> {
  const state = panelStateByWindow.get(win);
  if (!state) return;
  if (state.hasBootstrapped) return;
  
  // Mark as bootstrapped immediately to prevent parallel initialization
  state.hasBootstrapped = true;

  try {
    const libraryID = resolveActiveLibraryID() || 1;
    let globalKey = Number(
      activeGlobalConversationByLibrary.get(libraryID) || 0,
    );
    if (!Number.isFinite(globalKey) || globalKey <= 0) {
      try {
        const latest = await getLatestEmptyGlobalConversation(libraryID);
        globalKey = Number(latest?.conversationKey || 0);
      } catch { /* ignore */ }
      if (!Number.isFinite(globalKey) || globalKey <= 0) {
        try {
          globalKey = await createGlobalConversation(libraryID);
        } catch { /* ignore */ }
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

function hasSelectedItem(win: any): boolean {
  try {
    const zp = win?.ZoteroPane;
    if (zp?.getSelectedItems) {
      const items = zp.getSelectedItems();
      const count = items?.length || 0;
      return count > 0;
    }
  } catch (_err) {
    void _err;
  }
  return false;
}

function findItemMessagePane(doc: Document): Element | null {
  return doc.getElementById("zotero-item-message");
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
  // We no longer need to actively inject or observe tabs for the standalone panel.
  // The shared host is created lazily by getSharedLibraryPanelHost when index.ts
  // requests it.
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
  // No-op
}
