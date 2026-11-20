import { createElement } from "../../utils/domHelpers";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  getSelectedZoteroItems,
  getZoteroDragItemIds,
  isZoteroItemDragEvent,
} from "../contextPanel/setupHandlers/controllers/fileIntakeController";
import { getPanelLang } from "../contextPanel/i18n";
import { getQueueCopy } from "./queueI18n";
import {
  getBatchDraft,
  removeDraftItem,
  stageLibraryItems,
  startBatch,
  subscribeBatchDraft,
} from "./translationBatch";
import { batchCopy } from "./translationBatchStrings";
import { setBoolPref, setStringPref, TRANSLATE_PREFS } from "./translatePrefs";

const OVERWRITE = "#llm-tr-overwrite";

/** Never consult prefs for destructive consent. Both explicit Start actions
 * consume the checkbox, even if the subsequent preview is cancelled. */
export function takeTabOverwrite(body: Element): boolean {
  const input = body.querySelector<HTMLInputElement>(OVERWRITE);
  if (!input) return false;
  const value = input.checked;
  input.checked = false;
  return value;
}

const groups = [
  {
    ids: ["llm-tr-output-attach", "llm-tr-output-save-dir"],
    error: "needDestination",
  },
  { ids: ["llm-tr-mono", "llm-tr-dual"], error: "needFormat" },
] as const;

/** Old profiles may restore with nothing checked. Report it; do not guess
 * which destination (or format) the user intended. */
export function tabOutputIssue(body: Element): string {
  const c = batchCopy();
  const input = (id: string) => body.querySelector<HTMLInputElement>(`#${id}`);
  for (const group of groups) {
    if (!group.ids.some((id) => input(id)?.checked)) return c[group.error];
  }
  return input("llm-tr-output-save-dir")?.checked &&
    !input("llm-tr-output-dir")?.value.trim()
    ? c.needFolder
    : "";
}

export function mountTranslateBatchView(
  body: Element,
  signal: AbortSignal,
  beforeBatchStart?: () => void,
): void {
  const tab = body.querySelector<HTMLButtonElement>("#llm-tab-btn-translate");
  const panel = body.querySelector<HTMLElement>("#llm-tab-panel-translate");
  const settings = panel?.querySelector(".llm-tr-root");
  if (!tab || !panel || !settings || panel.querySelector("#llm-tr-batch"))
    return;
  const doc = panel.ownerDocument!;
  const c = batchCopy();
  const batch = createElement(doc, "section", "llm-tr-batch", {
    id: "llm-tr-batch",
  });
  const intake = createElement(doc, "div", "llm-tr-batch-intake");
  const action = (id: string, textContent: string, primary = false) =>
    createElement(
      doc,
      "button",
      `llm-tr-btn llm-tr-btn-small${primary ? " llm-tr-btn-primary" : ""}`,
      { id, textContent, type: "button" },
    );
  const add = action("llm-tr-add-selected", c.addSelected);
  intake.append(
    createElement(doc, "span", "llm-tr-queue-title", { textContent: c.drop }),
    add,
  );
  const rows = createElement(doc, "ul", "llm-tr-batch-list");
  const feedback = createElement(doc, "div", "llm-tr-batch-feedback");
  feedback.setAttribute("role", "status");
  const begin = action("llm-tr-begin-batch", c.begin, true);
  const warning = createElement(doc, "div", "llm-tr-batch-warning");
  warning.setAttribute("role", "alert");
  batch.append(intake, feedback, rows, warning, begin);
  settings.prepend(batch);

  let starting = false;
  let count = 0;
  const updateValidity = (hint?: string) => {
    const issue = tabOutputIssue(body);
    warning.textContent = hint || issue;
    begin.disabled = starting || !count || !!issue;
  };
  const renderDraft = () => {
    const items = getBatchDraft();
    const removeLabel = getQueueCopy(getPanelLang()).btnRemove;
    rows.replaceChildren(
      ...items.map((item) => {
        const row = createElement(doc, "li", "llm-tr-queue-row");
        const title = createElement(
          doc,
          "span",
          "llm-tr-queue-text llm-tr-queue-item-title",
          { textContent: item.title, title: item.title },
        );
        title.dir = "auto";
        const remove = createElement(
          doc,
          "button",
          "llm-tr-btn llm-tr-btn-small",
          { type: "button", textContent: removeLabel },
        );
        remove.setAttribute("aria-label", `${removeLabel}: ${item.title}`);
        remove.addEventListener("click", () =>
          removeDraftItem(item.attachmentID),
        );
        row.append(title, remove);
        return row;
      }),
    );
    count = items.length;
    begin.textContent = count ? `${c.begin} (${count})` : c.begin;
    updateValidity();
  };
  const unsubscribe = subscribeBatchDraft(renderDraft);
  signal.addEventListener("abort", unsubscribe, { once: true });
  renderDraft();

  // Capture before the tab's target listeners save the new checkbox value.
  panel.addEventListener(
    "change",
    (event) => {
      const input = event.target as HTMLInputElement;
      const group = groups.find((g) => g.ids.some((id) => id === input.id));
      if (
        group &&
        !input.checked &&
        !group.ids.some(
          (id) => body.querySelector<HTMLInputElement>(`#${id}`)?.checked,
        )
      ) {
        input.checked = true;
        updateValidity(c[group.error]);
      } else {
        updateValidity();
      }
    },
    { capture: true, signal },
  );
  body
    .querySelector("#llm-tr-output-dir")
    ?.addEventListener("input", () => updateValidity(), { signal });

  const stage = async (items: Zotero.Item[]) => {
    if (!items.length) {
      feedback.textContent = c.selectItems;
      return;
    }
    try {
      const result = await stageLibraryItems(items);
      if (!signal.aborted) feedback.textContent = c.staged(result);
    } catch (error) {
      if (!signal.aborted) feedback.textContent = String(error);
    }
  };
  add.addEventListener("click", () => void stage(getSelectedZoteroItems()), {
    signal,
  });
  begin.addEventListener(
    "click",
    async () => {
      if (starting || !count) return;
      const issue = tabOutputIssue(body);
      if (issue) {
        updateValidity();
        return;
      }
      starting = true;
      updateValidity();
      feedback.textContent = "";
      const overwrite = takeTabOverwrite(body);
      try {
        // Other cached panels share prefs. Snapshot what is visible in THIS
        // panel, not what a different tab happened to edit more recently.
        beforeBatchStart?.();
        const input = (id: string) =>
          body.querySelector<HTMLInputElement>(`#llm-tr-${id}`)!;
        setBoolPref(
          TRANSLATE_PREFS.outputAttach,
          input("output-attach").checked,
        );
        setBoolPref(
          TRANSLATE_PREFS.outputSaveToDir,
          input("output-save-dir").checked,
        );
        setStringPref(TRANSLATE_PREFS.outputDir, input("output-dir").value);
        await startBatch(
          overwrite,
          (summary) =>
            !signal.aborted && !!doc.defaultView?.confirm(c.confirm(summary)),
        );
      } catch (error) {
        if (!signal.aborted) feedback.textContent = String(error);
      } finally {
        starting = false;
        if (!signal.aborted) updateValidity();
      }
    },
    { signal },
  );

  // Confine drag handling to these two surfaces. The chat composer has its
  // own file intake; in particular, do not turn an OS file or URL into a
  // translation request using whatever happens to be selected in Zotero.
  for (const target of [tab as HTMLElement, panel]) {
    const over = (event: DragEvent) => {
      if (!isZoteroItemDragEvent(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer!.dropEffect = "copy";
      target.classList.add("llm-tr-drop-active");
    };
    target.addEventListener("dragenter", over, { signal });
    target.addEventListener("dragover", over, { signal });
    target.addEventListener(
      "dragleave",
      (event) => {
        const next = (event as DragEvent).relatedTarget as Node | null;
        if (!next || !target.contains(next))
          target.classList.remove("llm-tr-drop-active");
      },
      { signal },
    );
    target.addEventListener(
      "drop",
      (e) => {
        const event = e as DragEvent;
        target.classList.remove("llm-tr-drop-active");
        if (!isZoteroItemDragEvent(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const items = getZoteroDragItemIds(event)
          .map(getZoteroItem)
          .filter((item): item is Zotero.Item => !!item);
        if (target === tab) tab.click();
        void stage(items);
      },
      { signal },
    );
  }
}
