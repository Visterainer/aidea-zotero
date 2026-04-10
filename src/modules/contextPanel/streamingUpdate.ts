/**
 * Streaming Update Module
 *
 * Provides incremental DOM updates during LLM streaming responses.
 * Instead of re-rendering the entire chat history on each token,
 * only the last assistant bubble is patched in place.
 */

import { renderMarkdown } from "../../utils/markdown";
import { sanitizeText } from "./textUtils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default throttle interval (ms) for streaming patch updates. */
const DEFAULT_PATCH_INTERVAL_MS = 30;

/** Default auto-scroll threshold (px from bottom). */
const DEFAULT_AUTO_SCROLL_THRESHOLD = 64;

// ---------------------------------------------------------------------------
// DOM Lookup
// ---------------------------------------------------------------------------

/**
 * Find the last assistant bubble inside the chatBox.
 * This is the bubble that `refreshChat` created for the streaming message
 * (which starts as a skeleton).
 *
 * Returns `null` if no assistant bubble exists.
 */
export function findLastAssistantBubble(
  chatBox: HTMLDivElement | null,
): HTMLDivElement | null {
  if (!chatBox) return null;
  const wrappers = chatBox.querySelectorAll(".llm-message-wrapper.assistant");
  if (!wrappers.length) return null;
  const lastWrapper = wrappers[wrappers.length - 1];
  return lastWrapper.querySelector(
    ".llm-bubble.assistant",
  ) as HTMLDivElement | null;
}

// ---------------------------------------------------------------------------
// Patch
// ---------------------------------------------------------------------------

/**
 * Incrementally update a streaming assistant bubble's content.
 *
 * On the first call (when the skeleton is still visible), the skeleton is
 * removed and a content container (`[data-streaming-content]`) is created.
 *
 * On subsequent calls, only the content container's `innerHTML` is updated
 * via `renderMarkdown`.
 *
 * If the bubble has been removed from the DOM (e.g. the user switched panels),
 * this function is a no-op.
 */
export function patchStreamingBubble(
  bubble: HTMLDivElement | null,
  text: string,
): void {
  if (!bubble || !bubble.parentNode) return;

  const safeText = sanitizeText(text);
  if (!safeText) return;

  // Remove skeleton on first real content
  const skeleton = bubble.querySelector(".llm-streaming-skeleton");
  if (skeleton) {
    skeleton.remove();
  }

  // Find or create a stable content container so we don't clobber the model
  // name element or any other structural children.
  let contentEl = bubble.querySelector(
    "[data-streaming-content]",
  ) as HTMLDivElement | null;
  if (!contentEl) {
    const doc = bubble.ownerDocument;
    if (!doc) return;
    contentEl = doc.createElement("div") as HTMLDivElement;
    contentEl.setAttribute("data-streaming-content", "true");
    bubble.appendChild(contentEl);
  }

  try {
    contentEl.innerHTML = renderMarkdown(safeText);
  } catch {
    contentEl.textContent = safeText;
  }
}

/**
 * Clean up a streaming bubble after the stream completes.
 *
 * - Removes the `streaming` CSS class (hides cursor animation)
 * - Removes any leftover skeleton
 */
export function finalizeStreamingBubble(
  bubble: HTMLDivElement | null,
): void {
  if (!bubble) return;
  bubble.classList.remove("streaming");
  const skeleton = bubble.querySelector(".llm-streaming-skeleton");
  if (skeleton) skeleton.remove();
}

// ---------------------------------------------------------------------------
// Throttle
// ---------------------------------------------------------------------------

/**
 * Create a throttled wrapper around a patch function.
 *
 * During streaming, `onDelta` fires very frequently. This helper ensures
 * we only perform a DOM update at most once every `intervalMs` milliseconds,
 * keeping the UI responsive without overwhelming the renderer.
 *
 * @param patchFn  The function that performs the actual DOM patch.
 * @param intervalMs  Minimum interval between consecutive patches (default 30ms).
 */
export function createQueuedStreamingPatch(
  patchFn: () => void,
  intervalMs: number = DEFAULT_PATCH_INTERVAL_MS,
): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      patchFn();
    }, intervalMs);
  };
}

// ---------------------------------------------------------------------------
// Auto-scroll
// ---------------------------------------------------------------------------

/**
 * If the chatBox is scrolled near the bottom (within `threshold` px),
 * snap to the very bottom. This keeps the latest streamed content in view
 * without fighting the user if they have scrolled up.
 */
export function autoScrollStreamingIfNeeded(
  chatBox: HTMLDivElement | null,
  threshold: number = DEFAULT_AUTO_SCROLL_THRESHOLD,
): void {
  if (!chatBox) return;
  const distanceFromBottom =
    chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
  if (distanceFromBottom <= threshold) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// ---------------------------------------------------------------------------
// Stateful streaming auto-scroller
// ---------------------------------------------------------------------------

export interface StreamingAutoScroller {
  /**
   * Whether auto-scroll is currently active.
   * Starts as `true` if the chatBox was near bottom when created.
   * Becomes `false` when the user scrolls away (see `onUserScroll`).
   */
  readonly active: boolean;

  /**
   * Call from the queued streaming-patch callback.
   * Wraps the DOM patch and scroll-to-bottom in a scroll-suspension
   * guard so the `persistScroll` handler won't write a spurious
   * `"manual"` snapshot caused by content-height jumps (e.g. KaTeX).
   */
  patchAndScroll: (patchFn: () => void) => void;

  /**
   * Call from a *user-initiated* scroll event to break auto-scroll.
   * Should only be called when the scroll was NOT caused by a
   * programmatic `scrollTop` write (i.e. `isScrollUpdateSuspended()`
   * returns false).
   */
  onUserScroll: () => void;

  /**
   * Re-activate auto-scroll (e.g. when the user clicks "scroll to bottom").
   */
  reactivate: () => void;
}

/**
 * Create a stateful auto-scroller for a streaming session.
 *
 * Unlike the stateless `autoScrollStreamingIfNeeded`, this tracks whether
 * the user was at the bottom when streaming started and keeps scrolling
 * until the user explicitly scrolls away.  This prevents formula rendering
 * (which can increase `scrollHeight` dramatically in a single frame) from
 * inadvertently breaking auto-scroll.
 *
 * @param chatBox              The scrollable chat container.
 * @param suspendScrollUpdates Callback to set `_scrollUpdatesSuspended = true`.
 * @param resumeScrollUpdates  Callback to set `_scrollUpdatesSuspended = false` (deferred).
 * @param threshold            Distance from bottom considered "near bottom".
 */
export function createStreamingAutoScroller(
  chatBox: HTMLDivElement | null,
  suspendScrollUpdates: () => void,
  resumeScrollUpdates: () => void,
  threshold: number = DEFAULT_AUTO_SCROLL_THRESHOLD,
): StreamingAutoScroller {
  let _active = false;

  // Determine initial state: auto-scroll only if already near bottom.
  if (chatBox) {
    const distanceFromBottom =
      chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
    _active = distanceFromBottom <= threshold;
  }

  return {
    get active() {
      return _active;
    },

    patchAndScroll(patchFn: () => void) {
      if (!chatBox) {
        patchFn();
        return;
      }

      // ── Pre-patch user-scroll detection ──
      // BEFORE executing patchFn (which may dramatically increase
      // scrollHeight via KaTeX rendering), check whether the user has
      // scrolled away from the bottom since the last patch.  At this
      // point scrollHeight hasn't changed yet, so any distance from
      // the bottom must be caused by the user scrolling.
      const distanceFromBottom =
        chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
      if (distanceFromBottom > threshold) {
        _active = false;   // User scrolled up → stop auto-scroll
      } else {
        _active = true;    // User scrolled back to bottom → resume
      }

      // Suspend scroll-event persistence so the height jump from
      // innerHTML replacement doesn't create a "manual" snapshot.
      suspendScrollUpdates();
      try {
        patchFn();
      } finally {
        if (_active) {
          chatBox.scrollTop = chatBox.scrollHeight;
        }
        // Resume asynchronously so the scroll event triggered by our
        // programmatic scrollTop write is also suppressed.
        Promise.resolve().then(resumeScrollUpdates);
      }
    },

    onUserScroll() {
      if (!chatBox) return;
      const distanceFromBottom =
        chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight;
      if (distanceFromBottom > threshold) {
        _active = false;
      } else {
        // User scrolled back to bottom — re-activate.
        _active = true;
      }
    },

    reactivate() {
      _active = true;
    },
  };
}
