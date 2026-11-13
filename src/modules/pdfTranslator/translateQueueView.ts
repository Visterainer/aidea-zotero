/* ---------------------------------------------------------------------------
 * pdfTranslator/translateQueueView.ts  –  Queue and output options in the tab
 *
 * Renders the translation queue (one row per document, with its own actions)
 * and the three options that decide where results go and what a batch skips.
 * The elements are created here rather than in buildUI so the existing tab
 * markup and its IDs stay untouched.
 * -------------------------------------------------------------------------*/

import { getPanelLang } from "../contextPanel/i18n";
import { getQueueCopy, type QueueCopy } from "./queueI18n";
import {
  getBoolPref,
  isSaveToOutputDirEnabled,
  setBoolPref,
  TRANSLATE_PREFS,
} from "./translatePrefs";
import { pickAttachmentToOpen } from "./translationAttachment";
import type {
  QueueItem,
  QueueState,
  TranslationQueue,
} from "./translationQueue";
import { getTranslationQueue } from "./translationQueueService";

declare const Zotero: any;

const QUEUE_ID = "llm-tr-queue";
const OPTIONS_ID = "llm-tr-output-options";

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function copy(): QueueCopy {
  return getQueueCopy(getPanelLang());
}

/** What one row says under the title. */
export function describeQueueItem(item: QueueItem, strings: QueueCopy): string {
  const label = strings.status[item.status] || item.status;
  if (item.status === "running") {
    const page =
      typeof item.pageCurrent === "number" && item.pageTotal
        ? ` · ${item.pageCurrent}/${item.pageTotal}`
        : "";
    return `${label} ${item.percent}%${page}`;
  }
  if (item.status === "failed" && item.error) {
    return `${label}: ${item.error.split("\n")[0]}`;
  }
  return label;
}

export type QueueRowAction = "cancel" | "retry" | "remove" | "open" | "first";

/** The actions a row offers, by status. */
export function queueRowActions(item: QueueItem): QueueRowAction[] {
  switch (item.status) {
    case "running":
      return ["cancel"];
    case "queued":
    case "interrupted":
      return ["first", "cancel"];
    case "done":
      return item.resultItemIDs?.length ? ["open", "remove"] : ["remove"];
    default:
      return ["retry", "remove"];
  }
}

/** "3/12 finished": documents that reached an end, out of those not skipped. */
export function queueProgressCounts(state: QueueState): {
  finished: number;
  total: number;
} {
  const counted = state.items.filter((item) => item.status !== "skipped");
  return {
    finished: counted.filter((item) =>
      ["done", "failed", "cancelled"].includes(item.status),
    ).length,
    total: counted.length,
  };
}

async function openResult(item: QueueItem): Promise<void> {
  const attachments = (item.resultItemIDs || [])
    .map((id) => Zotero.Items.get(id))
    .filter(Boolean);
  const target = pickAttachmentToOpen(attachments);
  if (!target?.id) return;
  try {
    await Zotero.Reader.open(target.id);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to open translated PDF", err);
  }
}

function runAction(
  queue: TranslationQueue,
  action: QueueRowAction,
  item: QueueItem,
): void {
  if (action === "cancel") queue.cancel(item.id);
  else if (action === "retry") queue.retry(item.id);
  else if (action === "remove") queue.remove(item.id);
  else if (action === "first") queue.moveToFront(item.id);
  else void openResult(item);
}

function renderQueue(root: HTMLElement, queue: TranslationQueue): void {
  const doc = root.ownerDocument!;
  const strings = copy();
  const state = queue.getState();
  const { finished, total } = queueProgressCounts(state);
  root.textContent = "";

  const header = el(doc, "div", "llm-tr-queue-header");
  header.append(
    el(doc, "span", "llm-tr-queue-title", strings.title),
    el(
      doc,
      "span",
      "llm-tr-queue-summary",
      total ? strings.summary(finished, total) : "",
    ),
  );
  const headerActions = el(doc, "span", "llm-tr-queue-actions");
  const hasPending = queue.hasPending();
  if (state.paused && hasPending) {
    const resume = el(
      doc,
      "button",
      "llm-tr-btn llm-tr-btn-primary llm-tr-btn-small",
      strings.btnResume,
    );
    resume.type = "button";
    resume.addEventListener("click", () => queue.resume());
    headerActions.appendChild(resume);
  } else if (hasPending) {
    const pause = el(
      doc,
      "button",
      "llm-tr-btn llm-tr-btn-warning llm-tr-btn-small",
      strings.btnPause,
    );
    pause.type = "button";
    pause.addEventListener("click", () => queue.pause());
    headerActions.appendChild(pause);
  }
  if (state.items.some((item) => !queueRowActions(item).includes("cancel"))) {
    const clear = el(
      doc,
      "button",
      "llm-tr-btn llm-tr-btn-small",
      strings.btnClear,
    );
    clear.type = "button";
    clear.addEventListener("click", () => queue.clearFinished());
    headerActions.appendChild(clear);
  }
  header.appendChild(headerActions);
  root.appendChild(header);

  if (state.paused && hasPending && state.pauseKind) {
    const detail = (state.pauseDetail || "").split("\n")[0];
    const notice = el(
      doc,
      "div",
      "llm-tr-queue-notice",
      strings.pause[state.pauseKind],
    );
    if (detail) notice.title = detail;
    if (state.pauseKind !== "user" && state.pauseKind !== "restored") {
      notice.classList.add("llm-tr-queue-notice-error");
    }
    root.appendChild(notice);
  }

  if (!state.items.length) {
    root.appendChild(el(doc, "div", "llm-tr-queue-empty", strings.empty));
    return;
  }

  const labels: Record<QueueRowAction, string> = {
    cancel: strings.btnCancel,
    retry: strings.btnRetry,
    remove: strings.btnRemove,
    open: strings.btnOpen,
    first: strings.btnFirst,
  };
  const list = el(doc, "div", "llm-tr-queue-list");
  for (const item of state.items) {
    const row = el(doc, "div", "llm-tr-queue-row");
    row.dataset.status = item.status;
    const text = el(doc, "div", "llm-tr-queue-text");
    const title = el(doc, "div", "llm-tr-queue-item-title", item.title);
    title.title = `${item.title}\n${item.modelName}`;
    const status = el(
      doc,
      "div",
      "llm-tr-queue-item-status",
      describeQueueItem(item, strings),
    );
    if (item.error) status.title = item.error;
    text.append(title, status);
    if (item.status === "running") {
      const bar = el(doc, "div", "llm-tr-queue-bar");
      const fill = el(doc, "div", "llm-tr-queue-bar-fill");
      fill.style.width = `${Math.max(0, Math.min(100, item.percent))}%`;
      bar.appendChild(fill);
      text.appendChild(bar);
    }
    const actions = el(doc, "div", "llm-tr-queue-row-actions");
    for (const action of queueRowActions(item)) {
      const button = el(
        doc,
        "button",
        "llm-tr-btn llm-tr-btn-small",
        labels[action],
      );
      button.type = "button";
      button.addEventListener("click", () => runAction(queue, action, item));
      actions.appendChild(button);
    }
    row.append(text, actions);
    list.appendChild(row);
  }
  root.appendChild(list);
}

function checkbox(
  doc: Document,
  id: string,
  label: string,
  prefKey: string,
  defaultValue: boolean,
): HTMLLabelElement {
  const wrapper = el(doc, "label", "llm-tr-checkbox-label");
  const input = el(doc, "input", "");
  input.type = "checkbox";
  input.id = id;
  input.checked = getBoolPref(prefKey, defaultValue);
  input.addEventListener("change", () => setBoolPref(prefKey, input.checked));
  wrapper.append(input, doc.createTextNode(` ${label}`));
  return wrapper;
}

function mountOutputOptions(body: Element): void {
  if (body.querySelector(`#${OPTIONS_ID}`)) return;
  const anchor = body
    .querySelector("#llm-tr-output-dir")
    ?.closest(".llm-tr-path-block");
  if (!anchor?.parentNode) return;
  const doc = body.ownerDocument!;
  const strings = copy();
  const block = el(doc, "div", "llm-tr-output-options");
  block.id = OPTIONS_ID;
  const row = el(doc, "div", "llm-tr-row llm-tr-format-row");
  const attach = checkbox(
    doc,
    "llm-tr-output-attach",
    strings.optAttach,
    TRANSLATE_PREFS.outputAttach,
    true,
  );
  attach.title = strings.storageNote;
  row.append(
    attach,
    checkbox(
      doc,
      "llm-tr-output-save-dir",
      strings.optSaveToDir,
      TRANSLATE_PREFS.outputSaveToDir,
      isSaveToOutputDirEnabled(),
    ),
    checkbox(
      doc,
      "llm-tr-queue-skip-existing",
      strings.optSkipExisting,
      TRANSLATE_PREFS.queueSkipExisting,
      true,
    ),
  );
  block.append(row, el(doc, "div", "llm-tr-output-note", strings.storageNote));
  anchor.parentNode.insertBefore(block, anchor.nextSibling);
}

/**
 * Add the queue list and the output options to a Translate tab. Safe to call
 * again for the same tab; the list keeps itself current from then on.
 */
export function mountTranslateQueueView(body: Element): void {
  mountOutputOptions(body);
  if (body.querySelector(`#${QUEUE_ID}`)) return;
  const anchor = body
    .querySelector("#llm-tr-start")
    ?.closest(".llm-tr-actions");
  if (!anchor?.parentNode) return;
  const root = el(body.ownerDocument!, "div", "llm-tr-queue");
  root.id = QUEUE_ID;
  anchor.parentNode.insertBefore(root, anchor);

  const queue = getTranslationQueue();
  const unsubscribe = queue.subscribe(() => {
    // The panel this list lives in was thrown away.
    if (root.closest("[data-llm-disposed]")) {
      unsubscribe();
      return;
    }
    renderQueue(root, queue);
  });
  renderQueue(root, queue);
}
