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
import { describeAddResult, getQueueCopy, type QueueCopy } from "./queueI18n";
import { readSavedTranslateOptions } from "./translatePrefs";
import {
  findExistingTranslations,
  findPdfAttachment,
  pickAttachmentToOpen,
  type TranslationOutputKind,
} from "./translationAttachment";
import type { QueueState, QueueSummary } from "./translationQueue";
import {
  enqueueLibraryItems,
  getTranslationQueue,
} from "./translationQueueService";

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

/**
 * Ask what to do when the item already has this translation.
 * @returns "open" | "translate" | "cancel"
 */
function promptExistingTranslation(
  targetLang: string,
): "open" | "translate" | "cancel" {
  const strings = copy();
  const prompt = Services.prompt;
  const choice = prompt.confirmEx(
    Zotero.getMainWindow(),
    strings.progressTitle,
    strings.existsPrompt(targetLang),
    prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_IS_STRING +
      prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_CANCEL +
      prompt.BUTTON_POS_2 * prompt.BUTTON_TITLE_IS_STRING,
    strings.openExisting,
    null,
    strings.translateAgain,
    null,
    {},
  );
  if (choice === 0) return "open";
  if (choice === 2) return "translate";
  return "cancel";
}

/* ── Queue-backed flow ── */

function queueCopy(): QueueCopy {
  return getQueueCopy(getPanelLang());
}

/** "2/5": position of the running document among those not skipped. */
function runningPosition(state: QueueState): { index: number; total: number } {
  const counted = state.items.filter((item) => item.status !== "skipped");
  const finished = counted.filter((item) =>
    ["done", "failed", "cancelled"].includes(item.status),
  ).length;
  return {
    index: Math.min(counted.length, finished + 1),
    total: counted.length,
  };
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
  const { index, total } = runningPosition(state);
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

function onQueueDrained(summary: QueueSummary): void {
  closeProgressWindow(progressWindow);
  progressWindow = null;
  notify(
    queueCopy().batchDone(summary.done, summary.failed, summary.skipped),
    summary.failed ? "fail" : "success",
  );
  // Opening a reader tab per document would bury the user in tabs; do it
  // only when a single document was translated.
  const finished = getTranslationQueue()
    .getState()
    .items.filter((item) => item.status === "done");
  if (summary.done === 1 && summary.failed === 0 && finished.length) {
    const ids = finished[finished.length - 1].resultItemIDs || [];
    void openInReader(
      pickAttachmentToOpen(ids.map((id) => Zotero.Items.get(id))),
    );
  }
}

function watchQueue(): void {
  if (unsubscribeQueue) return;
  const queue = getTranslationQueue();
  unsubscribeQueue = queue.subscribe(renderQueueProgress);
  unsubscribeDrained = queue.onDrained(onQueueDrained);
}

/**
 * One selected item that is already translated: offer to open it instead of
 * silently skipping it. Batches follow the tab's "skip" option instead.
 * @returns false when nothing should be queued.
 */
async function confirmSingleExisting(item: Zotero.Item): Promise<boolean> {
  const attachment = findPdfAttachment(item);
  if (!attachment) return true;
  const options = readSavedTranslateOptions();
  const wanted: TranslationOutputKind[] = [];
  if (options.generateMono || !options.generateDual) wanted.push("mono");
  if (options.generateDual) wanted.push("dual");
  const existing = findExistingTranslations(attachment, options.targetLang);
  if (!wanted.every((kind) => existing[kind])) return true;
  const choice = promptExistingTranslation(options.targetLang);
  if (choice === "open") {
    await openInReader(
      pickAttachmentToOpen(wanted.map((kind) => existing[kind])),
    );
  }
  return choice === "translate";
}

async function addToQueue(items: Zotero.Item[]): Promise<void> {
  const single = items.length === 1;
  if (single && !(await confirmSingleExisting(items[0]))) return;
  watchQueue();
  const result = await enqueueLibraryItems(
    items,
    // The user just chose "translate again" for this one document.
    single ? { skipExisting: false } : {},
  );
  if (result.noModel) {
    notify(copy().noModel, "fail");
    return;
  }
  if (!result.added && !result.skipped && !result.duplicates) {
    notify(copy().noPdf, "fail");
    return;
  }
  const strings = queueCopy();
  const lines = [describeAddResult(strings, result)];
  if (getTranslationQueue().getState().paused) lines.push(strings.pausedHint);
  notify(lines.join("\n"), "default");
}

function onAddCommand(items: Zotero.Item[] | undefined): void {
  const selected = (items || []).filter((item) => findPdfAttachment(item));
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
          context.menuElem.setAttribute("label", queueCopy().menuAdd(count));
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
  if (registered) watchQueue();
}

export function unregisterTranslateMenu(): void {
  try {
    // The document goes back in line and is offered again after a restart.
    getTranslationQueue().stop();
  } catch {
    /* ignore */
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
