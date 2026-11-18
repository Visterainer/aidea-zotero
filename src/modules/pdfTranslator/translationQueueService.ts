import { confirmPdfLayout } from "./persianLayout";
import { getPanelLang } from "../contextPanel/i18n";
/* ---------------------------------------------------------------------------
 * pdfTranslator/translationQueueService.ts  –  The one queue, wired to Zotero
 *
 * `translationQueue.ts` holds the logic; this file gives it the real job
 * runner, Zotero items, files and preferences, and turns library items into
 * queue entries.
 * -------------------------------------------------------------------------*/

import {
  getBoolPref,
  getPersistedTranslateModel,
  getPersistedTranslateProvider,
  getStringPref,
  isSaveToOutputDirEnabled,
  readSavedTranslateOptions,
  setStringPref,
  TRANSLATE_PREFS,
} from "./translatePrefs";
import {
  deliverTranslatedPdfs,
  findExistingTranslations,
  findPdfAttachment,
  type TranslationOutputKind,
} from "./translationAttachment";
import { isTranslationRunning, startTranslationJob } from "./translationJob";
import {
  TranslationQueue,
  type QueueAddEntry,
  type QueueAddResult,
  type QueueOutputTarget,
} from "./translationQueue";

declare const Zotero: any;

let queue: TranslationQueue | null = null;

export function getTranslationQueue(): TranslationQueue {
  if (queue) return queue;
  queue = new TranslationQueue({
    startJob: (request, onEvent) => startTranslationJob(request, onEvent),
    // Asked only while the queue itself is idle, so anything running is
    // a translation started from the Translate tab.
    isOtherTranslationRunning: () => isTranslationRunning(),
    async resolvePdfPath(attachmentID) {
      const attachment = Zotero.Items.get(attachmentID);
      if (!attachment || attachment.deleted) return null;
      try {
        return String((await attachment.getFilePathAsync?.()) || "") || null;
      } catch {
        return null;
      }
    },
    async deliver(attachmentID, files, output) {
      const attachment = Zotero.Items.get(attachmentID);
      if (!attachment) throw new Error("The source item no longer exists");
      const delivered = await deliverTranslatedPdfs(attachment, files, output);
      return {
        itemIDs: delivered.items
          .map((item: { id?: number }) => Number(item?.id))
          .filter((id: number) => Number.isInteger(id) && id > 0),
      };
    },
    async createOutputDir() {
      const tempDir = String(PathUtils.tempDir || "").trim();
      if (!tempDir) throw new Error("PathUtils.tempDir is empty");
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const dir = PathUtils.join(
        tempDir,
        "aidea-translate",
        "queue-output",
        id,
      );
      await IOUtils.makeDirectory(dir, { createAncestors: true });
      return dir;
    },
    async removeDir(dir) {
      try {
        await IOUtils.remove(dir, { recursive: true, ignoreAbsent: true });
      } catch {
        /* best effort */
      }
    },
    load: () => getStringPref(TRANSLATE_PREFS.queueState, ""),
    save: (json) => setStringPref(TRANSLATE_PREFS.queueState, json),
    now: () => Date.now(),
    schedule: (callback, delayMs) => {
      setTimeout(callback, delayMs);
    },
  });
  return queue;
}

/** Where finished translations go, as chosen in the Translate tab. */
export function readOutputTarget(): QueueOutputTarget {
  const saveDir = isSaveToOutputDirEnabled()
    ? getStringPref(TRANSLATE_PREFS.outputDir, "").trim()
    : "";
  const attach = getBoolPref(TRANSLATE_PREFS.outputAttach, true);
  // With nothing chosen (or a folder option without a folder) the result
  // would have nowhere to go; attaching is the safe destination.
  return { attach: attach || !saveDir, saveDir };
}

export function shouldSkipExistingTranslations(): boolean {
  return getBoolPref(TRANSLATE_PREFS.queueSkipExisting, true);
}

export interface EnqueueResult extends QueueAddResult {
  cancelled?: boolean;
  /** Selected items that have no PDF. */
  withoutPdf: number;
  /** No translation model has been chosen yet; nothing was added. */
  noModel: boolean;
}

async function resolveQueueModel(): Promise<{
  modelName: string;
  providerId: string;
}> {
  const modelName = getPersistedTranslateModel();
  if (modelName) {
    return { modelName, providerId: getPersistedTranslateProvider() };
  }
  // The tab falls back to the first available model when none was saved.
  const { getModelChoices } =
    await import("../contextPanel/setupHandlers/controllers/modelSelectionController");
  const first = getModelChoices().choices[0];
  return {
    modelName: first?.model || "",
    providerId: first?.providerId || "",
  };
}

function itemTitle(attachment: any): string {
  const parent = attachment.parentItemID
    ? Zotero.Items.get(attachment.parentItemID)
    : null;
  return (
    String(parent?.getDisplayTitle?.() || "").trim() ||
    String(attachment.getDisplayTitle?.() || "").trim() ||
    String(attachment.attachmentFilename || "").trim() ||
    `#${attachment.id}`
  );
}

/**
 * Add library items to the queue with the settings saved by the Translate
 * tab. Nothing is asked per document: items without a PDF are counted, and
 * documents that already have the translation follow `skipExisting`.
 */
export async function enqueueLibraryItems(
  items: any[],
  choices: { skipExisting?: boolean } = {},
): Promise<EnqueueResult> {
  const skipExisting = choices.skipExisting ?? shouldSkipExistingTranslations();
  const options = readSavedTranslateOptions();
  // With both formats switched off the engine would produce nothing.
  if (!options.generateMono && !options.generateDual) {
    options.generateMono = true;
  }
  const wanted: TranslationOutputKind[] = [];
  if (options.generateMono) wanted.push("mono");
  if (options.generateDual) wanted.push("dual");

  const entries: QueueAddEntry[] = [];
  const seen = new Set<number>();
  let withoutPdf = 0;
  for (const item of items || []) {
    const attachment = findPdfAttachment(item);
    if (!attachment?.id) {
      withoutPdf += 1;
      continue;
    }
    if (seen.has(attachment.id)) continue;
    seen.add(attachment.id);
    const existing = findExistingTranslations(attachment, options.targetLang);
    entries.push({
      attachmentID: attachment.id,
      title: itemTitle(attachment),
      alreadyTranslated:
        skipExisting && wanted.every((kind) => Boolean(existing[kind])),
    });
  }

  const model = await resolveQueueModel();
  if (!model.modelName) {
    return { added: 0, skipped: 0, duplicates: 0, withoutPdf, noModel: true };
  }
  // Ask once per submission, never once per document or on startup.
  if (
    entries.some((entry) => !entry.alreadyTranslated) &&
    !confirmPdfLayout(options.targetLang, getPanelLang())
  ) {
    return {
      added: 0,
      skipped: 0,
      duplicates: 0,
      withoutPdf,
      noModel: false,
      cancelled: true,
    };
  }
  const added = getTranslationQueue().add(entries, {
    ...model,
    options,
    output: readOutputTarget(),
  });
  return { ...added, withoutPdf, noModel: false };
}
