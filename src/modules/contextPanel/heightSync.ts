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

type HeightSyncRuntime = {
  id: symbol;
  applyExternalHeights: (nextH1: number, nextH2: number) => void;
};

const activeHeightSyncControllers = new Set<HeightSyncRuntime>();

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
  const runtimeId = Symbol("height-sync");

  let h1 = readHeight(contentWrapper);
  let h2 = readHeight(bottomWrapper);
  let frozenH2 = h2;
  let settingMode = false;
  let ownHeightWrite = false;

  let h1Timer: ReturnType<typeof setTimeout> | null = null;
  let h2Timer: ReturnType<typeof setTimeout> | null = null;
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  const DEBOUNCE_MS = 500;
  const BROADCAST_MS = 120;

  const clearT = (t: ReturnType<typeof setTimeout> | null) => {
    if (t !== null) {
      if (win) win.clearTimeout(t as unknown as number);
      else clearTimeout(t);
    }
  };

  const releaseOwnWriteFlag = () => {
    if (win) {
      win.requestAnimationFrame(() => {
        ownHeightWrite = false;
      });
    } else {
      setTimeout(() => {
        ownHeightWrite = false;
      }, 0);
    }
  };

  const scheduleH1 = () => {
    if (!opts.onH1Change) return;
    clearT(h1Timer);
    const cb = () => {
      h1Timer = null;
      opts.onH1Change?.(`${Math.round(h1)}px`);
    };
    h1Timer = win
      ? (win.setTimeout(cb, DEBOUNCE_MS) as unknown as ReturnType<
          typeof setTimeout
        >)
      : setTimeout(cb, DEBOUNCE_MS);
  };

  const scheduleH2 = () => {
    if (!opts.onH2Change) return;
    clearT(h2Timer);
    const cb = () => {
      h2Timer = null;
      opts.onH2Change?.(`${Math.round(h2)}px`);
    };
    h2Timer = win
      ? (win.setTimeout(cb, DEBOUNCE_MS) as unknown as ReturnType<
          typeof setTimeout
        >)
      : setTimeout(cb, DEBOUNCE_MS);
  };

  const writeDiscussionHeights = (nextH1: number, nextH2: number) => {
    ownHeightWrite = true;
    contentWrapper.style.height = `${Math.round(nextH1)}px`;
    contentWrapper.style.flex = "none";
    bottomWrapper.style.height = `${Math.round(nextH2)}px`;
    bottomWrapper.style.flex = "none";
    releaseOwnWriteFlag();
  };

  const writeSettingHeight = (px: number) => {
    ownHeightWrite = true;
    contentWrapper.style.height = `${Math.round(px)}px`;
    contentWrapper.style.flex = "none";
    releaseOwnWriteFlag();
  };

  const applyCurrentModeHeights = () => {
    if (settingMode) {
      frozenH2 = h2;
      bottomWrapper.style.display = "none";
      writeSettingHeight(h1 + gap + h2);
      return;
    }
    bottomWrapper.style.display = "";
    writeDiscussionHeights(h1, h2);
  };

  const broadcastHeightsNow = () => {
    for (const controller of activeHeightSyncControllers) {
      if (controller.id === runtimeId) continue;
      controller.applyExternalHeights(h1, h2);
    }
  };

  const scheduleBroadcast = () => {
    clearT(broadcastTimer);
    const cb = () => {
      broadcastTimer = null;
      broadcastHeightsNow();
    };
    broadcastTimer = win
      ? (win.setTimeout(cb, BROADCAST_MS) as unknown as ReturnType<
          typeof setTimeout
        >)
      : setTimeout(cb, BROADCAST_MS);
  };

  let observer: { disconnect(): void } | null = null;
  const RO = (win as any)?.ResizeObserver;
  if (RO) {
    observer = new RO(() => {
      if (ownHeightWrite) return;

      if (!settingMode) {
        const newH1 = readHeight(contentWrapper);
        const newH2 = readHeight(bottomWrapper);
        if (newH1 && newH1 !== h1) {
          h1 = newH1;
          if (hasExplicitHeight(contentWrapper)) {
            scheduleH1();
            scheduleBroadcast();
          }
        }
        if (newH2 && newH2 !== h2) {
          h2 = newH2;
          if (hasExplicitHeight(bottomWrapper)) {
            scheduleH2();
            scheduleBroadcast();
          }
        }
      } else {
        const mergedHeight = readHeight(contentWrapper);
        if (!mergedHeight) return;
        const newH1 = Math.max(200, mergedHeight - gap - frozenH2);
        if (newH1 !== h1) {
          h1 = newH1;
          scheduleH1();
          scheduleBroadcast();
        }
      }
    });
    (observer as any).observe(contentWrapper);
    (observer as any).observe(bottomWrapper);
  }

  const runtime: HeightSyncRuntime = {
    id: runtimeId,
    applyExternalHeights(nextH1: number, nextH2: number) {
      h1 = Math.max(200, Math.round(nextH1));
      h2 = Math.max(0, Math.round(nextH2));
      frozenH2 = h2;
      applyCurrentModeHeights();
    },
  };
  activeHeightSyncControllers.add(runtime);

  return {
    switchToSetting() {
      if (settingMode) return;

      const liveH1 = readHeight(contentWrapper);
      const liveH2 = readHeight(bottomWrapper);
      if (liveH1) h1 = liveH1;
      if (liveH2) h2 = liveH2;

      frozenH2 = h2;
      settingMode = true;
      applyCurrentModeHeights();
    },

    switchToDiscussion() {
      settingMode = false;
      h1 = Math.max(200, Math.round(h1));
      applyCurrentModeHeights();
    },

    dispose() {
      observer?.disconnect();
      clearT(h1Timer);
      clearT(h2Timer);
      clearT(broadcastTimer);
      activeHeightSyncControllers.delete(runtime);
    },
  };
}
