import { config } from "../../../package.json";
import { getPanelLang } from "../contextPanel/i18n";
import { getTranslateMenuCopy } from "./menuI18n";
import { confirmPdfLayout } from "./persianLayout";
import { resolveSourcePdf } from "./translationAttachment";
import { inspectTranslationOutputs } from "./translationOutputs";
import { readSavedTranslateOptions } from "./translatePrefs";
import {
  getTranslationQueue,
  readOutputTarget,
  resolveQueueModel,
  wantedFormats,
} from "./translationQueueService";
import type { QueueAddEntry } from "./translationQueue";

interface DraftRow {
  attachmentID: number;
  title: string;
}
export interface BatchPreview {
  failed?: number;
  documents: number;
  skip: number;
  generate: number;
  replace: number;
  missing: number;
}

// The draft is only an intake list. Opening it (even after a restart) never
// resolves provider credentials, launches Python or consumes quota.
const DRAFT_PREF = `${config.prefsPrefix}.translate.batchDraft`;
let draft: DraftRow[] | undefined;
let submitting = false;
const listeners = new Set<() => void>();

function rows(): DraftRow[] {
  if (!draft) {
    try {
      const raw = JSON.parse(
        String(Zotero.Prefs.get(DRAFT_PREF, true) || "[]"),
      );
      draft = Array.isArray(raw)
        ? raw.filter(
            (row: DraftRow) =>
              row &&
              Number.isSafeInteger(row.attachmentID) &&
              row.attachmentID > 0 &&
              typeof row.title === "string",
          )
        : [];
    } catch {
      draft = [];
    }
  }
  return draft!;
}

function replaceDraft(next: DraftRow[]): void {
  Zotero.Prefs.set(DRAFT_PREF, JSON.stringify(next), true);
  draft = next;
  for (const notify of listeners) {
    try {
      notify();
    } catch {
      /* a detached view must not lose the draft */
    }
  }
}
export function getBatchDraft(): DraftRow[] {
  return rows().map((row) => ({ ...row }));
}
export function subscribeBatchDraft(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function removeDraftItem(id: number): void {
  replaceDraft(rows().filter((row) => row.attachmentID !== id));
}

function activeIDs(): Set<number> {
  return new Set(
    getTranslationQueue()
      .getState()
      .items.filter((row) =>
        ["queued", "running", "interrupted"].includes(row.status),
      )
      .map((row) => row.attachmentID),
  );
}

async function resolveRows(items: readonly Zotero.Item[]) {
  const result: DraftRow[] = [];
  let withoutPdf = 0;
  for (const item of items) {
    const attachment = (await resolveSourcePdf(item))?.attachment;
    if (!attachment?.id) {
      withoutPdf++;
      continue;
    }
    const parent = attachment.parentItemID
      ? Zotero.Items.get(attachment.parentItemID) || null
      : null;
    result.push({
      attachmentID: attachment.id,
      title: String(
        parent?.getDisplayTitle?.() ||
          attachment.getDisplayTitle?.() ||
          attachment.attachmentFilename ||
          `#${attachment.id}`,
      ),
    });
  }
  return { result, withoutPdf };
}

export async function stageLibraryItems(items: readonly Zotero.Item[]) {
  const { result, withoutPdf } = await resolveRows(items);
  // Re-read after asynchronous resolution: drops from different panels
  // can overlap. Deduplicate the parent and an explicitly selected child.
  const previous = rows();
  const seen = activeIDs();
  for (const row of previous) seen.add(row.attachmentID);
  const fresh = result.filter((row) => {
    if (seen.has(row.attachmentID)) return false;
    seen.add(row.attachmentID);
    return true;
  });
  if (fresh.length) replaceDraft([...previous, ...fresh]);
  return {
    added: fresh.length,
    duplicates: result.length - fresh.length,
    withoutPdf,
  };
}

async function submit(
  snapshot: DraftRow[],
  overwrite: boolean,
  confirm: (summary: BatchPreview) => boolean,
  fromDraft: boolean,
): Promise<boolean> {
  if (submitting || !snapshot.length) return false;
  submitting = true;
  try {
    const options = readSavedTranslateOptions();
    const kinds = wantedFormats(options);
    const output = { ...readOutputTarget(), overwrite };
    const model = await resolveQueueModel();
    const active = activeIDs();
    const summary: BatchPreview = {
      documents: 0,
      skip: 0,
      generate: 0,
      missing: 0,
      replace: 0,
    };
    const entries: QueueAddEntry[] = [];
    for (const row of snapshot) {
      if (active.has(row.attachmentID)) continue;
      active.add(row.attachmentID);
      summary.documents++;
      try {
        const attachment = await Zotero.Items.getAsync(row.attachmentID);
        const pdfPath =
          attachment && !attachment.deleted
            ? await attachment.getFilePathAsync()
            : null;
        if (!attachment || !pdfPath)
          throw new Error(getTranslateMenuCopy(getPanelLang()).noPdf);
        const plan = await inspectTranslationOutputs(
          attachment,
          pdfPath,
          options.targetLang,
          kinds,
          output,
          overwrite,
        );
        const existing = plan.cells.filter((cell) => cell.exists);
        summary.missing += plan.cells.length - existing.length;
        summary.replace += overwrite ? existing.length : 0;
        if (plan.generateKinds.length) summary.generate++;
        else summary.skip++;
        entries.push({
          ...row,
          replaceIds: overwrite ? existing.map((cell) => cell.id) : [],
        });
      } catch (err) {
        // One offline linked folder must not discard a whole selection. The
        // failed row has no authority to replace files on a later retry.
        summary.failed = (summary.failed || 0) + 1;
        entries.push({
          ...row,
          replaceIds: [],
          preflightError: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (summary.generate && !model.modelName)
      throw new Error(getTranslateMenuCopy(getPanelLang()).noModel);
    if (
      entries.length &&
      (!confirm(summary) ||
        (summary.generate &&
          !confirmPdfLayout(options.targetLang, getPanelLang())))
    )
      return false;
    // Removed while preparing: never schedule an item the user withdrew.
    const live = fromDraft
      ? new Set(rows().map((row) => row.attachmentID))
      : null;
    const submitted = entries.filter(
      (row) => !live || live.has(row.attachmentID),
    );
    if (submitted.length)
      getTranslationQueue().add(submitted, { ...model, options, output });
    if (fromDraft) {
      const ids = new Set(snapshot.map((row) => row.attachmentID));
      replaceDraft(rows().filter((row) => !ids.has(row.attachmentID)));
    }
    return true;
  } finally {
    submitting = false;
  }
}
export function startBatch(
  overwrite: boolean,
  confirm: (summary: BatchPreview) => boolean,
): Promise<boolean> {
  return submit(getBatchDraft(), overwrite, confirm, true);
}
/** The existing one-click action is never allowed to overwrite. */
export async function startSingleLibraryItem(
  item: Zotero.Item,
): Promise<boolean> {
  const { result } = await resolveRows([item]);
  if (!result.length)
    throw new Error(getTranslateMenuCopy(getPanelLang()).noPdf);
  return submit(result, false, () => true, false);
}
