/**
 * Height synchronisation controller for Discussion / Setting tabs.
 *
 * Discussion tab uses two resizable panes:
 *   contentWrapper (H1) + bottomWrapper (H2)
 *
 * Setting tab uses one resizable pane:
 *   contentWrapper (Hs = H1 + gap + H2), bottomWrapper hidden
 *
 * All Setting-mode resize deltas are absorbed into H1 so
 * the Discussion chat area grows/shrinks proportionally.
 */

export interface HeightSyncOptions {
  contentWrapper: HTMLElement;
  bottomWrapper: HTMLElement;
  /** Gap in px between the two wrappers (container gap). */
  gap: number;
  /** Called (debounced) with the persisted H1 value string, e.g. "450px". */
  onH1Change?: (height: string) => void;
  /** Called (debounced) with the persisted H2 value string, e.g. "200px". */
  onH2Change?: (height: string) => void;
}

export interface HeightSyncController {
  /** Apply combined height and hide bottomWrapper. */
  switchToSetting(): void;
  /** Restore split layout with updated H1. */
  switchToDiscussion(): void;
  /** Clean up observers and timers. */
  dispose(): void;
}

/** Read the current rendered height, returning 0 if the element is not laid out. */
function readHeight(el: HTMLElement): number {
  return el.offsetHeight || 0;
}

/**
 * Check whether CSS `resize: vertical` has been used (sets style.height).
 * Window resize does NOT set style.height, so this distinguishes user drag
 * from external layout changes.
 */
function hasExplicitHeight(el: HTMLElement): boolean {
  return Boolean(el.style.height);
}

export function createHeightSync(opts: HeightSyncOptions): HeightSyncController {
  const { contentWrapper, bottomWrapper, gap } = opts;
  const win = contentWrapper.ownerDocument?.defaultView;

  // Live tracked heights — initialised lazily on first reliable read
  let h1 = readHeight(contentWrapper);
  let h2 = readHeight(bottomWrapper);
  let frozenH2 = h2;
  let settingMode = false;

  // Whether we set contentWrapper.style.height ourselves (tab switch).
  // Prevents the ResizeObserver from misinterpreting our own writes as user drags.
  let ownHeightWrite = false;

  // ── Debounced persistence ──
  let h1Timer: ReturnType<typeof setTimeout> | null = null;
  let h2Timer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 500;

  const clearT = (t: ReturnType<typeof setTimeout> | null) => {
    if (t !== null) {
      if (win) win.clearTimeout(t as unknown as number);
      else clearTimeout(t);
    }
  };

  const scheduleH1 = () => {
    if (!opts.onH1Change) return;
    clearT(h1Timer);
    const cb = () => { h1Timer = null; opts.onH1Change!(`${Math.round(h1)}px`); };
    h1Timer = win ? (win.setTimeout(cb, DEBOUNCE_MS) as unknown as ReturnType<typeof setTimeout>) : setTimeout(cb, DEBOUNCE_MS);
  };

  const scheduleH2 = () => {
    if (!opts.onH2Change) return;
    clearT(h2Timer);
    const cb = () => { h2Timer = null; opts.onH2Change!(`${Math.round(h2)}px`); };
    h2Timer = win ? (win.setTimeout(cb, DEBOUNCE_MS) as unknown as ReturnType<typeof setTimeout>) : setTimeout(cb, DEBOUNCE_MS);
  };

  // ── ResizeObserver — real-time height tracking ──
  let observer: { disconnect(): void } | null = null;

  const RO = (win as any)?.ResizeObserver;
  if (RO) {
    observer = new RO(() => {
      // Skip if we just wrote the height ourselves (tab switch).
      if (ownHeightWrite) return;

      if (!settingMode) {
        // Discussion mode: track both panes independently.
        // Only persist if style.height exists (user drag, not window resize).
        const newH1 = readHeight(contentWrapper);
        const newH2 = readHeight(bottomWrapper);
        if (newH1 && newH1 !== h1) {
          h1 = newH1;
          if (hasExplicitHeight(contentWrapper)) scheduleH1();
        }
        if (newH2 && newH2 !== h2) {
          h2 = newH2;
          if (hasExplicitHeight(bottomWrapper)) scheduleH2();
        }
      } else {
        // Setting mode: all resize delta goes to H1.
        const hs = readHeight(contentWrapper);
        if (!hs) return;
        const newH1 = Math.max(200, hs - gap - frozenH2);
        if (newH1 !== h1) {
          h1 = newH1;
          scheduleH1();
        }
      }
    });
    (observer as any).observe(contentWrapper);
    (observer as any).observe(bottomWrapper);
  }

  /** Write contentWrapper height without triggering persistence. */
  const writeHeight = (px: number) => {
    ownHeightWrite = true;
    contentWrapper.style.height = `${Math.round(px)}px`;
    contentWrapper.style.flex = "none";
    // Clear the flag asynchronously after the ResizeObserver fires.
    if (win) {
      win.requestAnimationFrame(() => { ownHeightWrite = false; });
    } else {
      setTimeout(() => { ownHeightWrite = false; }, 0);
    }
  };

  return {
    switchToSetting() {
      // Re-read live heights in case panel was resized without style.height
      const liveH1 = readHeight(contentWrapper);
      const liveH2 = readHeight(bottomWrapper);
      if (liveH1) h1 = liveH1;
      if (liveH2) h2 = liveH2;

      frozenH2 = h2;
      const hs = h1 + gap + h2;
      settingMode = true;
      bottomWrapper.style.display = "none";
      writeHeight(hs);
    },

    switchToDiscussion() {
      settingMode = false;
      const safeH1 = Math.max(200, Math.round(h1));
      writeHeight(safeH1);
      bottomWrapper.style.display = "";
    },

    dispose() {
      observer?.disconnect();
      clearT(h1Timer);
      clearT(h2Timer);
    },
  };
}
