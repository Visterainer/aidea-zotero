/* ---------------------------------------------------------------------------
 * pdfTranslator/translateMenu.ts  –  Library context menu: translate PDFs
 *
 * Adds the selected items' PDFs to the translation queue with the settings
 * saved by the Translate tab. One summary progress window follows the queue,
 * and a second menu entry stops it. The queue itself, and everything shown
 * per document, lives in the Translate tab.
 * -------------------------------------------------------------------------*/

import { config } from "../../../package.json";
import { getPanelLang } from "../contextPanel/i18n";
import { getTranslateMenuCopy, type TranslateMenuCopy } from "./menuI18n";
import { getQueueCopy, type QueueCopy } from "./queueI18n";
import { stageLibraryItems, startSingleLibraryItem } from "./translationBatch";
import { batchCopy } from "./translationBatchStrings";
import {
  findPdfAttachment,
  pickAttachmentToOpen,
} from "./translationAttachment";
import type { QueueBatchResult } from "./translationQueue";
import { getTranslationQueue } from "./translationQueueService";

declare const Services: any;

const MENU_ID = `${config.addonRef}-translate-pdf-context-menu`;
const MENU_ICON = `chrome://${config.addonRef}/content/icons/icon-20.png`;
const RESULT_CLOSE_MS = 6000;
const ERROR_CLOSE_MS = 15000;

type ProgressWindow = InstanceType<typeof ztoolkit.ProgressWindow>;

let registered = false;
/** True while a click is still being turned into queue entries. */
let starting = false;

function copy(): TranslateMenuCopy {
  return getTranslateMenuCopy(getPanelLang());
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function firstLine(text: string): string {
  return (
    String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
}

function closeProgressWindow(win: ProgressWindow | null): void {
  try {
    win?.close();
  } catch {
    /* already closed */
  }
}

/** Show a short self-closing message. */
function notify(text: string, type: "default" | "success" | "fail"): void {
  try {
    new ztoolkit.ProgressWindow(copy().progressTitle, {
      closeOnClick: true,
      closeTime: type === "fail" ? ERROR_CLOSE_MS : RESULT_CLOSE_MS,
    })
      .createLine({ text, type, progress: 100 })
      .show();
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to show translate menu message", text, err);
  }
}

async function openInReader(item: Zotero.Item | null): Promise<void> {
  if (!item?.id) return;
  try {
    await Zotero.Reader.open(item.id);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to open translated PDF", err);
  }
}

/* ── Queue-backed flow ── */

function queueCopy(): QueueCopy {
  return getQueueCopy(getPanelLang());
}

let progressWindow: ProgressWindow | null = null;
let unsubscribeQueue: (() => void) | null = null;
let unsubscribeDrained: (() => void) | null = null;
let lastPauseShown = "";

function renderQueueProgress(): void {
  const queue = getTranslationQueue();
  const running = queue.getRunningItem();
  const state = queue.getState();

  // A setup failure stops the whole queue; say why once.
  const pauseKey =
    state.paused &&
    state.pauseKind &&
    state.pauseKind !== "user" &&
    state.pauseKind !== "restored"
      ? `${state.pauseKind}:${state.pauseDetail || ""}`
      : "";
  if (pauseKey && pauseKey !== lastPauseShown && !running) {
    const detail = firstLine(state.pauseDetail || "");
    notify(
      `${queueCopy().pause[state.pauseKind!]}${detail ? `\n${detail}` : ""}`,
      "fail",
    );
  }
  lastPauseShown = pauseKey;

  if (!running) {
    closeProgressWindow(progressWindow);
    progressWindow = null;
    return;
  }
  const strings = queueCopy();
  const { index, total } = queue.getBatchPosition();
  const page =
    typeof running.pageCurrent === "number" && running.pageTotal
      ? ` · ${copy().page(running.pageCurrent, running.pageTotal)}`
      : "";
  const text = `${strings.progress(index, total, running.percent)}${page}`;
  try {
    if (!progressWindow) {
      progressWindow = new ztoolkit.ProgressWindow(copy().progressTitle, {
        closeOnClick: true,
        closeTime: -1,
      })
        .createLine({ text, type: "default", progress: running.percent })
        .createLine({ text: running.title, type: "default" })
        .show(-1);
      return;
    }
    progressWindow.changeLine({ idx: 0, text, progress: running.percent });
    progressWindow.changeLine({ idx: 1, text: running.title });
  } catch {
    // Dismissed by the user; the Translate tab and the menu still show it.
    progressWindow = null;
  }
}

function onQueueDrained(result: QueueBatchResult): void {
  closeProgressWindow(progressWindow);
  progressWindow = null;
  if (!result.done && !result.failed && !result.cancelled && !result.skipped)
    return;
  const strings = queueCopy();
  const cancelled = result.cancelled
    ? `${strings.separator}${strings.status.cancelled}: ${result.cancelled}`
    : "";
  notify(
    strings.batchDone(result.done, result.failed, result.skipped) + cancelled,
    result.failed ? "fail" : "success",
  );
  // Opening a reader tab per document would bury the user in tabs; do it
  // only when a single document was translated.
  if (
    result.done === 1 &&
    !result.failed &&
    !result.cancelled &&
    !result.skipped &&
    result.lastDone
  ) {
    const ids = result.lastDone.resultItemIDs || [];
    void openInReader(
      pickAttachmentToOpen(ids.map((id) => Zotero.Items.get(id))),
    );
  }
}

let restoredQueueTimer: ReturnType<typeof setTimeout> | null = null;

/** Say once, after startup, that a queue from the last session is waiting. */
function announceRestoredQueue(): void {
  if (restoredQueueTimer !== null) clearTimeout(restoredQueueTimer);
  restoredQueueTimer = setTimeout(() => {
    restoredQueueTimer = null;
    try {
      const queue = getTranslationQueue();
      const state = queue.getState();
      if (!state.paused || state.pauseKind !== "restored") return;
      const waiting = queue.getSummary().queued;
      if (!waiting) return;
      const strings = queueCopy();
      notify(`${strings.title}: ${waiting}\n${strings.pausedHint}`, "default");
    } catch {
      /* a missed reminder is harmless; the tab shows the queue */
    }
  }, 8000);
}

function watchQueue(): void {
  if (unsubscribeQueue) return;
  const queue = getTranslationQueue();
  unsubscribeQueue = queue.subscribe(renderQueueProgress);
  unsubscribeDrained = queue.onDrained(onQueueDrained);
}

async function addToQueue(items: Zotero.Item[]): Promise<void> {
  watchQueue();
  if (items.length === 1) {
    await startSingleLibraryItem(items[0]);
    if (getTranslationQueue().getState().paused)
      notify(queueCopy().pausedHint, "default");
    return;
  }
  const result = await stageLibraryItems(items);
  notify(`${batchCopy().staged(result)}\n${batchCopy().prepared}`, "default");
}

function onAddCommand(items: Zotero.Item[] | undefined): void {
  const selected = items || [];
  if (!selected.length || starting) return;
  starting = true;
  void addToQueue(selected)
    .catch((err) => {
      ztoolkit?.log?.("AIdea: adding to the translation queue failed", err);
      notify(copy().failed(firstLine(errorText(err))), "fail");
    })
    .finally(() => {
      starting = false;
    });
}

function onStopCommand(): void {
  let confirmed = true;
  try {
    confirmed = Boolean(
      Services.prompt.confirm(
        Zotero.getMainWindow(),
        copy().progressTitle,
        queueCopy().confirmStop,
      ),
    );
  } catch {
    /* no prompt service: stop without asking */
  }
  if (confirmed) getTranslationQueue().stop();
}

export function registerTranslateMenu(): void {
  if (registered || !(Zotero as any).MenuManager?.registerMenu) return;
  const result = Zotero.MenuManager.registerMenu({
    menuID: MENU_ID,
    pluginID: config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        icon: MENU_ICON,
        onShowing: (_event, context) => {
          context.setIcon(MENU_ICON);
          const count = (context.items || []).filter((item) =>
            findPdfAttachment(item),
          ).length;
          context.setVisible(count > 0);
          context.setEnabled(count > 0 && !starting);
          context.menuElem.setAttribute(
            "label",
            (context.items || []).length > 1
              ? batchCopy().menuAdd(count)
              : queueCopy().menuAdd(count),
          );
        },
        onCommand: (_event, context) => onAddCommand(context.items),
      },
      {
        menuType: "menuitem",
        icon: MENU_ICON,
        onShowing: (_event, context) => {
          context.setIcon(MENU_ICON);
          // Reachable from any selection so the queue can always be stopped.
          const running = getTranslationQueue().getRunningItem();
          context.setVisible(Boolean(running));
          context.setEnabled(Boolean(running));
          context.menuElem.setAttribute(
            "label",
            queueCopy().menuStop(running?.percent || 0),
          );
        },
        onCommand: () => onStopCommand(),
      },
    ],
  });
  registered = Boolean(result);
  if (registered) {
    watchQueue();
    announceRestoredQueue();
  }
}

export function unregisterTranslateMenu(): void {
  if (restoredQueueTimer !== null) {
    clearTimeout(restoredQueueTimer);
    restoredQueueTimer = null;
  }
  unsubscribeQueue?.();
  unsubscribeDrained?.();
  unsubscribeQueue = null;
  unsubscribeDrained = null;
  closeProgressWindow(progressWindow);
  progressWindow = null;
  if (!registered || !(Zotero as any).MenuManager?.unregisterMenu) return;
  try {
    Zotero.MenuManager.unregisterMenu(MENU_ID);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to unregister translate menu", err);
  } finally {
    registered = false;
  }
}
