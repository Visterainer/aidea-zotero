import { AuthorProfileProgressToast } from "./progressToast";
import { generateAuthorProfileForItem } from "./service";
import { getAuthorProfileCopy } from "./i18n";
import type { AuthorProfileProgressCallback } from "./types";
import {
  getAuthorProfileLanguage,
  normalizeWhitespace,
  truncateText,
} from "./utils";

let running = false;

function getHostWindow(): Window | null {
  try {
    return ((Zotero as any).getMainWindow?.() || null) as Window | null;
  } catch {
    return null;
  }
}

function getItemTitle(item: Zotero.Item): string {
  try {
    return (
      normalizeWhitespace(item.getField("title")) ||
      normalizeWhitespace((item as any).firstCreator) ||
      `Item ${item.id}`
    );
  } catch {
    return `Item ${item.id}`;
  }
}

function confirmBatchRun(count: number): boolean {
  const win = getHostWindow();
  if (!win || count <= 1) return true;
  const copy = getAuthorProfileCopy(getAuthorProfileLanguage());
  return win.confirm(copy.confirmBatch(count));
}

function etaMs(
  startTime: number,
  completed: number,
  total: number,
): number | undefined {
  if (completed <= 0) return undefined;
  const elapsed = Date.now() - startTime;
  const avg = elapsed / completed;
  return Math.max(0, Math.round(avg * Math.max(0, total - completed)));
}

export function isAuthorProfileRunInProgress(): boolean {
  return running;
}

export async function runAuthorProfileGeneration(
  items: Zotero.Item[],
): Promise<void> {
  if (running) return;
  const targets = items.filter(Boolean);
  if (!targets.length) return;
  if (!confirmBatchRun(targets.length)) return;

  running = true;
  const mode = targets.length > 1 ? "batch" : "single";
  const copy = getAuthorProfileCopy(getAuthorProfileLanguage());
  // Closing the toast cancels the run; otherwise it would keep calling the
  // LLM and rewriting notes with no visible progress.
  const controller = new AbortController();
  const signal = controller.signal;
  const toast = new AuthorProfileProgressToast(mode, () => controller.abort());
  const startTime = Date.now();
  let completed = 0;
  let failed = 0;
  let singleError = "";

  try {
    for (let index = 0; index < targets.length; index += 1) {
      if (signal.aborted) break;
      const item = targets[index];
      const title = truncateText(getItemTitle(item), 72);
      const itemBaseProgress = index / targets.length;
      const itemWeight = 1 / targets.length;

      try {
        const onProgress: AuthorProfileProgressCallback = (progress) => {
          toast.update({
            body: progress.message,
            status: "running",
            progress: itemBaseProgress + progress.fraction * itemWeight,
            itemTitle: title,
            itemIndex: index + 1,
            totalItems: targets.length,
            completed,
            failed,
            elapsedMs: Date.now() - startTime,
            etaMs: etaMs(startTime, completed, targets.length),
          });
        };
        await generateAuthorProfileForItem(item, onProgress, signal);
        completed += 1;
      } catch (err) {
        if (signal.aborted) break;
        failed += 1;
        completed += 1;
        ztoolkit?.log?.("AIdea: author profile generation failed", err);
        const message =
          err instanceof Error ? err.message : copy.generationFailed;
        if (mode === "single") singleError = message;
        toast.update({
          body: message,
          status: "error",
          progress: completed / targets.length,
          itemTitle: title,
          itemIndex: index + 1,
          totalItems: targets.length,
          completed,
          failed,
          elapsedMs: Date.now() - startTime,
          etaMs: etaMs(startTime, completed, targets.length),
        });
        if (mode === "single") break;
      }
    }

    const hasFailures = failed > 0;
    toast.update({
      body: hasFailures
        ? singleError || copy.batchFinishedWithFailures
        : copy.generationCompleted,
      status: hasFailures ? "error" : "success",
      progress: 1,
      completed,
      failed,
      elapsedMs: Date.now() - startTime,
      etaMs: 0,
    });
  } finally {
    running = false;
  }
}
