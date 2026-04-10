/**
 * Chat scroll position management.
 *
 * Manages scroll snapshots, follow-bottom stabilization, and scroll guards
 * that protect the chat box position across DOM mutations.
 */
import { AUTO_SCROLL_BOTTOM_THRESHOLD } from "./constants";
import { activePaperConversationByItem } from "./state";

// ---------------------------------------------------------------------------
// Conversation key
// ---------------------------------------------------------------------------

export function getConversationKey(item: Zotero.Item): number {
  // For Reader items, use the active paper conversation key if available.
  const paperKey = activePaperConversationByItem.get(item.id);
  if (paperKey && paperKey > 0) return paperKey;
  return item.id;
}

// ---------------------------------------------------------------------------
// Scroll types
// ---------------------------------------------------------------------------

export type ChatScrollMode = "followBottom" | "manual";

export interface ChatScrollSnapshot {
  mode: ChatScrollMode;
  scrollTop: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const chatScrollSnapshots = new Map<number, ChatScrollSnapshot>();
const followBottomStabilizers = new Map<
  number,
  { rafId: number | null; timeoutId: number | null }
>();

/**
 * Guard flag: when `true` the scroll-event handler in setupHandlers must
 * skip snapshot persistence.  This prevents both our own programmatic
 * scrollTop writes AND layout-induced scroll changes (caused by DOM
 * mutations that resize the chat flex container) from corrupting the
 * saved scroll position.
 */
let _scrollUpdatesSuspended = false;

export function isScrollUpdateSuspended(): boolean {
  return _scrollUpdatesSuspended;
}

export function suspendScrollUpdates(): void {
  _scrollUpdatesSuspended = true;
}

export function resumeScrollUpdates(): void {
  _scrollUpdatesSuspended = false;
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

export function getMaxScrollTop(chatBox: HTMLDivElement): number {
  return Math.max(0, chatBox.scrollHeight - chatBox.clientHeight);
}

export function isChatViewportVisible(chatBox: HTMLDivElement): boolean {
  return chatBox.clientHeight > 0 && chatBox.getClientRects().length > 0;
}

export function clampScrollTop(chatBox: HTMLDivElement, scrollTop: number): number {
  return Math.max(0, Math.min(getMaxScrollTop(chatBox), scrollTop));
}

export function isNearBottom(chatBox: HTMLDivElement): boolean {
  const distanceFromBottom =
    chatBox.scrollHeight - chatBox.clientHeight - chatBox.scrollTop;
  return distanceFromBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Snapshot CRUD
// ---------------------------------------------------------------------------

export function buildChatScrollSnapshot(chatBox: HTMLDivElement): ChatScrollSnapshot {
  const mode: ChatScrollMode = isNearBottom(chatBox)
    ? "followBottom"
    : "manual";
  return {
    mode,
    scrollTop: clampScrollTop(chatBox, chatBox.scrollTop),
    updatedAt: Date.now(),
  };
}

export function persistChatScrollSnapshotByKey(
  conversationKey: number,
  chatBox: HTMLDivElement,
): void {
  if (!isChatViewportVisible(chatBox)) return;
  chatScrollSnapshots.set(conversationKey, buildChatScrollSnapshot(chatBox));
}

export function persistChatScrollSnapshot(
  item: Zotero.Item,
  chatBox: HTMLDivElement,
): void {
  persistChatScrollSnapshotByKey(getConversationKey(item), chatBox);
}

export function applyChatScrollSnapshot(
  chatBox: HTMLDivElement,
  snapshot: ChatScrollSnapshot,
): void {
  _scrollUpdatesSuspended = true;
  if (snapshot.mode === "followBottom") {
    chatBox.scrollTop = chatBox.scrollHeight;
  } else {
    chatBox.scrollTop = clampScrollTop(chatBox, snapshot.scrollTop);
  }
  Promise.resolve().then(() => {
    _scrollUpdatesSuspended = false;
  });
}

export function getChatScrollSnapshot(conversationKey: number): ChatScrollSnapshot | undefined {
  return chatScrollSnapshots.get(conversationKey);
}

// ---------------------------------------------------------------------------
// Scroll guard
// ---------------------------------------------------------------------------

export type ScrollGuardRestoreMode = "absolute" | "relative";

/**
 * Run `fn` (which may mutate the DOM / change layout) while protecting
 * the chatBox scroll position.  The current scroll state is saved before
 * `fn` runs, the scroll-event handler is suppressed during `fn`, and
 * the saved state is restored afterwards.
 */
export function withScrollGuard(
  chatBox: HTMLDivElement | null,
  conversationKey: number | null,
  fn: () => void,
  restoreMode: ScrollGuardRestoreMode = "absolute",
): void {
  if (!chatBox || conversationKey === null) {
    fn();
    return;
  }
  const wasNearBottom = isNearBottom(chatBox);
  const savedScrollTop = chatBox.scrollTop;
  const savedMaxScrollTop = getMaxScrollTop(chatBox);

  _scrollUpdatesSuspended = true;
  try {
    fn();
  } finally {
    if (wasNearBottom) {
      chatBox.scrollTop = chatBox.scrollHeight;
    } else if (restoreMode === "relative" && savedMaxScrollTop > 0) {
      const nextMaxScrollTop = getMaxScrollTop(chatBox);
      const progress = Math.min(
        1,
        Math.max(0, savedScrollTop / savedMaxScrollTop),
      );
      chatBox.scrollTop = Math.round(nextMaxScrollTop * progress);
    } else {
      chatBox.scrollTop = savedScrollTop;
    }
    if (isChatViewportVisible(chatBox)) {
      persistChatScrollSnapshotByKey(conversationKey, chatBox);
    }
    Promise.resolve().then(() => {
      _scrollUpdatesSuspended = false;
    });
  }
}

// ---------------------------------------------------------------------------
// Scroll policy & follow-bottom stabilization
// ---------------------------------------------------------------------------

export function applyChatScrollPolicy(
  item: Zotero.Item,
  chatBox: HTMLDivElement,
): void {
  const key = getConversationKey(item);
  const snapshot = chatScrollSnapshots.get(key);
  if (snapshot) {
    applyChatScrollSnapshot(chatBox, snapshot);
  } else {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

export function scheduleFollowBottomStabilization(
  body: Element,
  conversationKey: number,
  chatBox: HTMLDivElement,
): void {
  const entry = followBottomStabilizers.get(conversationKey) || {
    rafId: null,
    timeoutId: null,
  };
  followBottomStabilizers.set(conversationKey, entry);

  const clearFollowBottomStabilization = () => {
    if (entry.rafId !== null) {
      try {
        const ownerWindow = body.ownerDocument?.defaultView;
        ownerWindow?.cancelAnimationFrame?.(entry.rafId);
      } catch { /* ignore */ }
      entry.rafId = null;
    }
    if (entry.timeoutId !== null) {
      try {
        const ownerWindow = body.ownerDocument?.defaultView;
        ownerWindow?.clearTimeout?.(entry.timeoutId);
      } catch { /* ignore */ }
      entry.timeoutId = null;
    }
  };

  const stickToBottomIfNeeded = () => {
    const snapshot = chatScrollSnapshots.get(conversationKey);
    if (!snapshot || snapshot.mode !== "followBottom") return;
    if (!isChatViewportVisible(chatBox)) return;
    _scrollUpdatesSuspended = true;
    chatBox.scrollTop = chatBox.scrollHeight;
    persistChatScrollSnapshotByKey(conversationKey, chatBox);
    Promise.resolve().then(() => {
      _scrollUpdatesSuspended = false;
    });
  };

  clearFollowBottomStabilization();
  const ownerWindow = body.ownerDocument?.defaultView;
  if (ownerWindow) {
    entry.rafId = ownerWindow.requestAnimationFrame(() => {
      stickToBottomIfNeeded();
      entry.rafId = null;
    }) as unknown as number;
    entry.timeoutId = ownerWindow.setTimeout(() => {
      stickToBottomIfNeeded();
      entry.timeoutId = null;
    }, 50) as unknown as number;
  }
}

/**
 * Cancel any pending follow-bottom stabilization for a conversation.
 * Used when switching away from follow-bottom mode.
 */
export function cancelFollowBottomStabilization(
  ownerWindow: Window | null | undefined,
  conversationKey: number,
): void {
  const active = followBottomStabilizers.get(conversationKey);
  if (!active || !ownerWindow) return;
  if (typeof active.rafId === "number") {
    ownerWindow.cancelAnimationFrame(active.rafId);
  }
  if (typeof active.timeoutId === "number") {
    ownerWindow.clearTimeout(active.timeoutId);
  }
  followBottomStabilizers.delete(conversationKey);
}
