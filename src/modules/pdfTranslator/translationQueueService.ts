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
  TRANSLATE_PREFS,
} from "./translatePrefs";
import { config } from "../../../package.json";
import { batchCopy } from "./translationBatchStrings";
import {
  inspectTranslationOutputs,
  publishTranslationOutputs,
  verifyPlanSource,
  type OutputPlan,
  type TranslationOutputKind,
} from "./translationOutputs";
import {
  cleanQueueWorkspace,
  createQueueWorkspace,
  validateQueueWorkspace,
} from "./queueWorkspace";
import { isTranslationRunning, startTranslationJob } from "./translationJob";
import { TranslationQueue, type QueueOutputTarget } from "./translationQueue";

declare const Zotero: any;

let queue: TranslationQueue | null = null;

/** Large string prefs can be rejected by Gecko. Check UTF-8 bytes (not JS
 * characters), and never acknowledge a write that did not actually stick. */
export function writeBatchPreference(key: string, json: string): void {
  if (new TextEncoder().encode(json).byteLength >= 1024 * 1024)
    throw new Error(
      "Translation batch is too large to save. Try a smaller batch or clear finished rows.",
    );
  Zotero.Prefs.set(key, json, true);
  if (Zotero.Prefs.get(key, true) !== json)
    throw new Error("Cannot save translation batch state.");
}

/** The bridge opens its input after asynchronous credential and environment
 * setup. Give it a private same-basename copy, not the mutable linked path.
 * The fresh inspection already verified the source; recheck after the copy. */
export async function prepareQueueInput(plan: OutputPlan) {
  const dir = await IOUtils.createUniqueDirectory(
    PathUtils.tempDir,
    "aidea-queue-input",
    0o700,
  );
  const pdfPath = PathUtils.join(dir, PathUtils.filename(plan.pdfPath));
  const dispose = async () => {
    try {
      await IOUtils.remove(dir, { recursive: true, ignoreAbsent: true });
    } catch (err) {
      Zotero.logError(err);
    }
  };
  try {
    await IOUtils.copy(plan.pdfPath, pdfPath, { noOverwrite: true });
    const copy = Zotero.File.pathToFile(pdfPath);
    if (copy.isSymlink() || !copy.isFile())
      throw new Error("Cannot pin the source PDF");
    await verifyPlanSource(plan);
    return { pdfPath, dispose };
  } catch (err) {
    await dispose();
    throw err;
  }
}

/** Do not instantiate an unused queue or touch UI during application exit. */
export function stopQueueIfLoaded(): void {
  if (queue?.hasPending()) queue.stop();
}

export function getTranslationQueue(): TranslationQueue {
  if (queue) return queue;
  queue = new TranslationQueue({
    startJob: (request, onEvent) => startTranslationJob(request, onEvent),
    // Asked only while the queue itself is idle, so anything running is
    // a translation started from the Translate tab.
    isOtherTranslationRunning: () => isTranslationRunning(),
    async resolvePdfPath(attachmentID) {
      const attachment = await Zotero.Items.getAsync(attachmentID);
      if (!attachment || attachment.deleted) return null;
      try {
        return String((await attachment.getFilePathAsync?.()) || "") || null;
      } catch {
        return null;
      }
    },
    async inspect(item, pdfPath) {
      const source = await Zotero.Items.getAsync(item.attachmentID);
      if (!source || source.deleted)
        throw new Error("Source PDF is unavailable");
      const plan = await inspectTranslationOutputs(
        source,
        pdfPath,
        item.options.targetLang,
        wantedFormats(item.options),
        item.output,
        item.output.overwrite === true,
      );
      if (
        plan.overwrite &&
        plan.cells.some((c) => c.exists && !item.replaceIds?.includes(c.id))
      ) {
        throw new Error(batchCopy().changedOutputs);
      }
      return plan;
    },
    prepareInput: prepareQueueInput,
    publish: publishTranslationOutputs,
    validateStaging: validateQueueWorkspace,
    createOutputDir: createQueueWorkspace,
    removeDir: cleanQueueWorkspace,
    load: () => getStringPref(TRANSLATE_PREFS.queueState, ""),
    save: (json) =>
      writeBatchPreference(
        `${config.prefsPrefix}.${TRANSLATE_PREFS.queueState}`,
        json,
      ),
    now: () => Date.now(),
    schedule: (callback, delayMs) => {
      setTimeout(callback, delayMs);
    },
  });
  return queue;
}

/** Where finished translations go, as chosen in the Translate tab. */
export function readOutputTarget(): QueueOutputTarget {
  const folder = isSaveToOutputDirEnabled();
  const saveDir = folder
    ? getStringPref(TRANSLATE_PREFS.outputDir, "").trim()
    : "";
  const attach = getBoolPref(TRANSLATE_PREFS.outputAttach, true);
  if (folder && !saveDir) throw new Error(batchCopy().needFolder);
  if (!attach && !folder) throw new Error(batchCopy().needDestination);
  return { attach, saveDir };
}

export function wantedFormats(
  options: Pick<
    ReturnType<typeof readSavedTranslateOptions>,
    "generateMono" | "generateDual"
  >,
): TranslationOutputKind[] {
  const kinds: TranslationOutputKind[] = [];
  if (options.generateMono) kinds.push("mono");
  if (options.generateDual) kinds.push("dual");
  if (!kinds.length) throw new Error(batchCopy().needFormat);
  return kinds;
}

export async function resolveQueueModel(): Promise<{
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
