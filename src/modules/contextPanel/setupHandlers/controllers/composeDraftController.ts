import { config } from "../../constants";
import {
  getSelectedTextContextEntries,
  setSelectedTextContextEntries,
} from "../../contextResolution";
import {
  draftInputCache,
  recentReaderSelectionCache,
  selectedFileAttachmentCache,
  selectedFilePreviewExpandedCache,
  selectedImageCache,
  selectedImagePreviewActiveIndexCache,
  selectedImagePreviewExpandedCache,
  selectedPaperContextCache,
  selectedPaperPreviewExpandedCache,
  selectedTextCache,
  selectedTextPreviewExpandedCache,
} from "../../state";
import type {
  ChatAttachment,
  PaperContextRef,
  SelectedTextContext,
} from "../../types";
import { normalizePaperContextEntries } from "./composeContextController";

// The original (non-global) Zotero.Prefs calls prepended extensions.zotero.
// Keep reading/writing the same keys, but use absolute names for enumeration.
const DRAFT = "extensions.zotero.extensions.AIdea.draftInput.";
const COMPOSE = "extensions.zotero.extensions.AIdea.composeState.";
const COMPOSE_SNAPSHOT_MAX_CHARS = 512 * 1024;
const panelResets = new Set<() => void>();
let historyGeneration = 0;

export function getComposeHistoryGeneration(): number {
  return historyGeneration;
}

/** Run only after the DB clear commits; conversation keys can now be reused. */
export function clearAllComposeDrafts(): void {
  historyGeneration++;
  for (const cache of [
    draftInputCache,
    selectedFileAttachmentCache,
    selectedImageCache,
    selectedPaperContextCache,
    selectedTextCache,
    recentReaderSelectionCache,
    selectedFilePreviewExpandedCache,
    selectedImagePreviewActiveIndexCache,
    selectedImagePreviewExpandedCache,
    selectedPaperPreviewExpandedCache,
    selectedTextPreviewExpandedCache,
  ])
    cache.clear();

  // Include keys from closed panels and previous Zotero sessions, not just
  // those present in memory or in the (now empty) conversation tables.
  for (const prefix of [
    DRAFT,
    COMPOSE,
    `${config.prefsPrefix}.fileAttachments_`,
  ]) {
    try {
      Zotero.Prefs.resetBranch([], prefix);
    } catch (err) {
      ztoolkit.log("LLM: could not clear compose preferences", prefix, err);
    }
  }
  // Includes cached/detached reader tabs, which a DOM query cannot reach.
  for (const reset of panelResets) {
    try {
      reset();
    } catch (err) {
      ztoolkit.log("LLM: could not reset compose UI", err);
    }
  }
}

function deferredSave(delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: (() => void) | undefined;
  const cancel = () => {
    clearTimeout(timer);
    pending = undefined;
  };
  const flush = () => {
    const save = pending;
    cancel();
    save?.();
  };
  return {
    cancel,
    flush,
    schedule(save: () => void) {
      cancel();
      pending = save;
      timer = setTimeout(flush, delay);
    },
  };
}

export function bindComposeDraft(options: {
  inputBox: HTMLTextAreaElement;
  getKey: () => number | null;
  getItemId: () => number | undefined;
  refreshAfterClear: () => void;
}) {
  const { inputBox, getKey, getItemId, refreshAfterClear } = options;
  const draftSave = deferredSave(600);
  const composeSave = deferredSave(800);
  const clearPref = (key: string) => {
    try {
      Zotero.Prefs.clear(key, true);
    } catch (_) {
      /* a missing pref is fine */
    }
  };
  const scheduleDraftSave = () => {
    const key = getKey();
    if (!key) return;
    const text = inputBox.value;
    draftSave.schedule(() => {
      draftInputCache.set(key, text);
      try {
        Zotero.Prefs.set(DRAFT + key, text, true);
      } catch (_) {
        /* the in-memory draft is still available */
      }
    });
  };
  const scheduleComposeStateSave = () => {
    const key = getKey();
    const itemId = getItemId();
    if (!key || !itemId) return;
    composeSave.schedule(() => {
      if (key !== getKey() || itemId !== getItemId()) return;
      try {
        const files = (selectedFileAttachmentCache.get(itemId) || []).map(
          ({
            id,
            name,
            mimeType,
            storedPath,
            sizeBytes,
            category,
            contentHash,
          }) => ({
            id,
            name,
            mimeType,
            storedPath,
            sizeBytes,
            category,
            contentHash,
          }),
        );
        const screenshots = selectedImageCache.get(itemId) || [];
        const papers = normalizePaperContextEntries(
          selectedPaperContextCache.get(itemId),
        );
        const textContexts = getSelectedTextContextEntries(key);
        if (
          !files.length &&
          !screenshots.length &&
          !papers.length &&
          !textContexts.length
        ) {
          clearPref(COMPOSE + key);
          return;
        }
        const snapshot = { files, screenshots, papers, textContexts };
        let json = JSON.stringify(snapshot);
        // Gecko rejects large prefs; preserve everything except oversized images.
        if (json.length > COMPOSE_SNAPSHOT_MAX_CHARS) {
          json = JSON.stringify({ ...snapshot, screenshots: [] });
        }
        Zotero.Prefs.set(COMPOSE + key, json, true);
      } catch (_) {
        clearPref(COMPOSE + key); // Do not restore a superseded snapshot.
      }
    });
  };

  const key = getKey();
  const itemId = getItemId();
  if (key) {
    try {
      const draft =
        draftInputCache.get(key) || Zotero.Prefs.get(DRAFT + key, true);
      if (typeof draft === "string" && draft) inputBox.value = draft;
    } catch (_) {
      /* ignore unavailable pref */
    }
    try {
      const raw = Zotero.Prefs.get(COMPOSE + key, true);
      if (itemId && typeof raw === "string" && raw) {
        const snapshot = JSON.parse(raw) as {
          files?: ChatAttachment[];
          screenshots?: string[];
          papers?: PaperContextRef[];
          textContexts?: SelectedTextContext[];
        };
        if (Array.isArray(snapshot.files) && snapshot.files.length) {
          selectedFileAttachmentCache.set(itemId, snapshot.files);
        }
        if (
          Array.isArray(snapshot.screenshots) &&
          snapshot.screenshots.length
        ) {
          selectedImageCache.set(itemId, snapshot.screenshots);
        }
        if (Array.isArray(snapshot.papers) && snapshot.papers.length) {
          selectedPaperContextCache.set(itemId, snapshot.papers);
        }
        if (
          Array.isArray(snapshot.textContexts) &&
          snapshot.textContexts.length
        ) {
          setSelectedTextContextEntries(key, snapshot.textContexts);
        }
      }
    } catch (_) {
      /* ignore malformed snapshot */
    }
  }
  inputBox.addEventListener("input", scheduleDraftSave);
  const cancelSaves = () => {
    draftSave.cancel();
    composeSave.cancel();
  };
  const reset = () => {
    cancelSaves();
    inputBox.value = "";
    // Refreshing previews normally schedules a compose save; don't re-create
    // the just-deleted pref, even if a detached panel throws while refreshing.
    try {
      refreshAfterClear();
    } finally {
      cancelSaves();
    }
  };
  panelResets.add(reset);
  return {
    scheduleComposeStateSave,
    clearDraftInput() {
      draftSave.cancel();
      const key = getKey();
      if (!key) return;
      draftInputCache.delete(key);
      clearPref(DRAFT + key);
    },
    clearComposeState() {
      composeSave.cancel();
      const key = getKey();
      if (key) clearPref(COMPOSE + key);
    },
    dispose() {
      // Normal tab/window close still saves its latest input; a history clear
      // cancels that work instead. No timer outlives its panel registration.
      draftSave.flush();
      composeSave.flush();
      inputBox.removeEventListener("input", scheduleDraftSave);
      panelResets.delete(reset);
    },
  };
}
