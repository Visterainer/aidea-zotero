import { classifyFailure, publicationBlocker } from "./translationFailure";
export { classifyFailure } from "./translationFailure";
/* ---------------------------------------------------------------------------
 * pdfTranslator/translationQueue.ts  –  Persistent, serial translation queue
 *
 * Every entry point (library context menu today; drag-and-drop and search
 * later) only adds documents here. The queue translates one document at a
 * time, survives a restart, and tells a failure of one document (move on)
 * from a failure of the setup (stop and say why).
 *
 * UI-free: the Translate tab and the context menu subscribe and render.
 * -------------------------------------------------------------------------*/

import type { TranslateEvent } from "./index";
import {
  MissingStagedFormatError,
  newReservationToken,
  validateGeneratedManifest,
  type OutputPlan,
} from "./translationOutputs";
import type { SavedTranslateOptions } from "./translatePrefs";
import type {
  TranslationJobHandle,
  TranslationJobOutcome,
  TranslationJobRequest,
} from "./translationJob";

export type QueueItemStatus =
  | "queued"
  | "running"
  | "done"
  | "failed"
  | "cancelled"
  /** The item already had this translation when it was added. */
  | "skipped"
  /** Was running when Zotero closed or the queue was stopped; runs again on resume. */
  | "interrupted";

export interface QueueOutputTarget {
  /** Add the translated PDFs to the source's Zotero item. */
  attach: boolean;
  /** Also copy them into this folder; "" for none. */
  saveDir: string;
  /** Frozen with the batch, not read from live preferences at run time. */
  overwrite?: boolean;
}

interface PendingDelivery {
  plan: OutputPlan;
  files: string[];
  dir: string;
  /** Satisfied cell IDs, including existing outputs we must not replace. */
  completed: string[];
}

/** The specific library PDF inspected before the user approved generation. */
export interface QueueSource {
  libraryID: number;
  sourceKey: string;
  pdfPath: string;
  sourceStamp: string;
}

export function previewSource(plan: OutputPlan): QueueSource {
  const { libraryID, sourceKey, pdfPath, sourceStamp } = plan;
  if (!libraryID || !sourceKey || !pdfPath || !sourceStamp)
    throw new Error("Cannot identify the source PDF");
  return { libraryID, sourceKey, pdfPath, sourceStamp };
}

export interface QueueItem {
  id: string;
  attachmentID: number;
  title: string;
  status: QueueItemStatus;
  percent: number;
  /** View-only: the finished PDF is already being imported/copied. */
  filing?: boolean;
  pageCurrent?: number;
  pageTotal?: number;
  /** Why the item failed. */
  error?: string;
  /** Errors the engine logged although it produced a result. */
  warningCount?: number;
  // Settings are captured when the document is added, so one batch is
  // translated consistently even if the tab is changed while it runs.
  modelName: string;
  providerId: string;
  options: SavedTranslateOptions;
  output: QueueOutputTarget;
  /** Missing on legacy rows and failed previews; neither authorizes a new job. */
  source?: QueueSource;
  /** Replacement scope approved for this document at submission. */
  replaceIds?: string[];
  pendingDelivery?: PendingDelivery;
  deliveryProgress?: { done: number; total: number };
  savedFiles?: string[];
  addedAt: number;
  finishedAt?: number;
  /** Directory retained when the engine produced unfiled outputs. */
  retainedDir?: string;
  /** Attachments that hold the result, for "open". */
  resultItemIDs?: number[];
}

export type QueuePauseKind =
  | "user"
  /** Restored after a restart; never starts by itself. */
  | "restored"
  | "credentials"
  | "environment"
  | "network"
  | "rate_limit";

export interface QueueState {
  items: QueueItem[];
  paused: boolean;
  pauseKind?: QueuePauseKind;
  pauseDetail?: string;
}

export interface QueueSummary {
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
  cancelled: number;
  skipped: number;
}

/** What happened between the queue starting work and running out of it. */
export interface QueueBatchResult {
  done: number;
  failed: number;
  cancelled: number;
  skipped: number;
  /** The last document that finished, for "open the result". */
  lastDone: QueueItem | null;
}

/** Marks an error the views translate instead of showing verbatim. */
export const QUEUE_ERROR_PDF_MISSING = "@pdf_missing";

export interface QueueAddEntry {
  source?: QueueSource;
  /** The preview could not safely inspect this specific document. */
  preflightError?: string;
  attachmentID: number;
  title: string;
  /** The item already has this translation and the user chose to skip. */
  alreadyTranslated?: boolean;
  replaceIds?: string[];
}

export interface QueueAddSettings {
  modelName: string;
  providerId: string;
  options: SavedTranslateOptions;
  output: QueueOutputTarget;
}

export interface QueueAddResult {
  added: number;
  skipped: number;
  duplicates: number;
}

export interface QueueDeliverResult {
  itemIDs: number[];
}

export interface QueueDeps {
  startJob(
    request: TranslationJobRequest,
    onEvent: (event: TranslateEvent) => void,
  ): TranslationJobHandle;
  /** True while a translation the queue did not start is running. */
  isOtherTranslationRunning(): boolean;
  resolvePdfPath(attachmentID: number): Promise<string | null>;
  inspect?(item: QueueItem, pdfPath: string): Promise<OutputPlan>;
  /** Pin the verified input bytes across slow credential/environment setup. */
  prepareInput?(plan: OutputPlan): Promise<{
    pdfPath: string;
    dispose(): Promise<void>;
  }>;
  publish?(
    plan: OutputPlan,
    files: string[],
    completed: string[],
    onCell: (cellId: string, itemID?: number) => void,
  ): Promise<{ itemIDs: number[]; savedFiles: string[] }>;
  /** Confine paths to the real queue staging root and reject links. Required
   * to resume a delivery restored from preferences. */
  validateStaging?(dir: string, files: string[]): Promise<boolean>;
  /** Compatibility path for callers without an output planner. */
  deliver?(
    attachmentID: number,
    files: string[],
    output: QueueOutputTarget,
  ): Promise<QueueDeliverResult>;
  createOutputDir(): Promise<string>;
  removeDir(dir: string, deliveredFiles?: string[]): Promise<boolean | void>;
  load(): string;
  save(json: string): void;
  now(): number;
  schedule(callback: () => void, delayMs: number): void;
}

const MAX_ITEMS = 100;
const BUSY_RECHECK_MS = 3000;
const ACTIVE: QueueItemStatus[] = ["queued", "running", "interrupted"];

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isQueueItem(value: unknown): value is QueueItem {
  const item = value as QueueItem;
  return (
    !!item &&
    typeof item === "object" &&
    typeof item.id === "string" &&
    Number.isInteger(item.attachmentID) &&
    typeof item.status === "string" &&
    !!item.options &&
    typeof item.options === "object" &&
    !!item.output &&
    typeof item.output === "object"
  );
}

function validPlan(plan: OutputPlan | undefined): plan is OutputPlan {
  if (
    !plan ||
    typeof plan.overwrite !== "boolean" ||
    !Array.isArray(plan.cells)
  )
    return false;
  const ids = new Set<string>();
  for (const cell of plan.cells) {
    if (
      !cell ||
      typeof cell.id !== "string" ||
      !cell.id ||
      ids.has(cell.id) ||
      (cell.kind !== "mono" && cell.kind !== "dual") ||
      typeof cell.exists !== "boolean"
    )
      return false;
    ids.add(cell.id);
  }
  return (
    Array.isArray(plan.generateKinds) &&
    plan.generateKinds.every((kind) => kind === "mono" || kind === "dual")
  );
}

/** A checkpoint must never turn the publisher/cleanup manifest into a way to
 * read or remove an unrelated file. Only direct PDF children are expected.
 * The service additionally checks the *actual* staging root and symlinks. */
function validManifest(dir: string, files: string[]): boolean {
  if (typeof dir !== "string" || !Array.isArray(files) || !files.length)
    return false;
  // On POSIX a backslash is a filename character, not a separator. Treating
  // it as one could make a sibling of the job directory look like its child.
  const windows = /^(?:[a-z]:[\\/]|\\\\|\/\/)/i.test(dir);
  const normalize = (path: string) =>
    windows ? path.replace(/\\/g, "/") : path;
  const folder = normalize(dir);
  if (
    !/^(?:\/|[a-z]:\/)/i.test(folder) ||
    folder.includes("\0") ||
    /\/$|(?:^|\/)\.{1,2}(?:\/|$)/.test(folder)
  )
    return false;
  return files.every((file) => {
    if (typeof file !== "string") return false;
    const path = normalize(file);
    const slash = path.lastIndexOf("/");
    const name = path.slice(slash + 1);
    return (
      path.slice(0, slash) === folder &&
      !path.includes("\0") &&
      (!windows || !name.includes(":")) &&
      /.+\.pdf$/i.test(name)
    );
  });
}

type SettledStatus = "done" | "failed" | "cancelled" | "skipped";

export class TranslationQueue {
  private items: QueueItem[] = [];
  private paused = false;
  private pauseKind: QueuePauseKind | undefined;
  private pauseDetail = "";
  private current: { id: string; handle: TranslationJobHandle | null } | null =
    null;
  private listeners = new Set<() => void>();
  private drainListeners = new Set<(result: QueueBatchResult) => void>();
  // One terminal result per row in the current batch, including rows removed
  // from the visible history. Retry withdraws its old result.
  private settled = new Map<string, SettledStatus>();
  private deliveringId: string | null = null;
  // Compatibility for pure in-memory publishers. A parsed preference can
  // never be a member; restored paths must pass the service's FS guard.
  private freshDeliveries = new WeakSet<PendingDelivery>();
  private recheckScheduled = false;
  private idCounter = 0;

  constructor(private readonly deps: QueueDeps) {
    this.restore();
  }

  /* ── Reading ── */

  getState(): QueueState {
    return {
      items: this.items.map((item) => ({
        ...item,
        filing: item.id === this.deliveringId,
      })),
      paused: this.paused,
      pauseKind: this.paused ? this.pauseKind : undefined,
      pauseDetail: this.paused ? this.pauseDetail : undefined,
    };
  }

  getSummary(): QueueSummary {
    const summary: QueueSummary = {
      total: this.items.length,
      queued: 0,
      running: 0,
      done: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0,
    };
    for (const item of this.items) {
      if (item.status === "interrupted") summary.queued += 1;
      else summary[item.status] += 1;
    }
    return summary;
  }

  getRunningItem(): QueueItem | null {
    const item = this.current && this.find(this.current.id);
    return item?.status === "running"
      ? { ...item, filing: item.id === this.deliveringId }
      : null;
  }

  /** True while a document is being translated by the queue. */
  isRunning(): boolean {
    return this.current !== null;
  }

  /** "2 of 5" for the document being translated, within the current batch. */
  getBatchPosition(): { index: number; total: number } {
    const finished = [...this.settled.values()].filter(
      (status) => status !== "skipped",
    ).length;
    const pending = this.items.filter((item) =>
      ACTIVE.includes(item.status),
    ).length;
    const total = finished + pending;
    return { index: Math.min(total, finished + 1), total };
  }

  hasPending(): boolean {
    return this.items.some((item) => ACTIVE.includes(item.status));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called once each time the queue runs out of work. */
  onDrained(listener: (result: QueueBatchResult) => void): () => void {
    this.drainListeners.add(listener);
    return () => this.drainListeners.delete(listener);
  }

  /* ── Changing ── */

  add(entries: QueueAddEntry[], settings: QueueAddSettings): QueueAddResult {
    const result: QueueAddResult = { added: 0, skipped: 0, duplicates: 0 };
    const pendingIDs = new Set(
      this.items
        .filter((item) => ACTIVE.includes(item.status))
        .map((item) => item.attachmentID),
    );
    // Admission is a transaction: a rejected preference write must not trim
    // history, affect drain counts, or expose runnable rows to a scheduled pump.
    const items = this.items.slice();
    const settled = new Map(this.settled);
    let counter = this.idCounter;
    const skippedIds: string[] = [];
    for (const entry of entries) {
      if (pendingIDs.has(entry.attachmentID)) {
        result.duplicates += 1;
        continue;
      }
      pendingIDs.add(entry.attachmentID);
      // Preflight is a snapshot. If inspection is available, check the actual
      // destinations when this row reaches the front of the queue instead.
      const skipped = !this.deps.inspect && entry.alreadyTranslated === true;
      const prefix = `q${this.deps.now().toString(36)}-`;
      let id: string;
      do {
        id = prefix + ++counter;
      } while (this.find(id) || settled.has(id));
      if (entry.preflightError) settled.set(id, "failed");
      else if (skipped) skippedIds.push(id);
      items.push({
        id,
        attachmentID: entry.attachmentID,
        title: entry.title,
        status: entry.preflightError
          ? "failed"
          : skipped
            ? "skipped"
            : "queued",
        ...(entry.preflightError
          ? { error: entry.preflightError.slice(0, 1600) }
          : {}),
        percent: 0,
        modelName: settings.modelName,
        providerId: settings.providerId,
        options: { ...settings.options },
        output: { ...settings.output },
        ...(entry.source ? { source: { ...entry.source } } : {}),
        ...(entry.replaceIds ? { replaceIds: [...entry.replaceIds] } : {}),
        addedAt: this.deps.now(),
        ...(skipped || entry.preflightError
          ? { finishedAt: this.deps.now() }
          : {}),
      });
      if (skipped) result.skipped += 1;
      else result.added += 1;
    }
    if (items.length === this.items.length) return result; // only duplicates
    if (items.some((item) => ACTIVE.includes(item.status))) {
      for (const id of skippedIds) settled.set(id, "skipped");
    }
    const next = this.trimHistory(items);
    this.persist(next, settled); // throws to submit() before it removes the draft
    this.items = next;
    this.settled = settled;
    this.idCounter = counter;
    this.notify();
    if (result.added) this.pump();
    return result;
  }

  /** Stop one document. A running one is cancelled; a waiting one is dropped. */
  cancel(id: string): void {
    const item = this.find(id);
    if (!item || !ACTIVE.includes(item.status) || id === this.deliveringId)
      return;
    if (this.current?.id === id) {
      // Marked first: the job may settle synchronously.
      item.status = "cancelled";
      item.finishedAt = this.deps.now();
      this.settled.set(item.id, "cancelled");
      try {
        this.current.handle?.cancel();
      } catch {
        /* the job reports its own end */
      }
    } else if (item.status === "queued" || item.status === "interrupted") {
      item.status = "cancelled";
      item.finishedAt = this.deps.now();
      this.settled.set(item.id, "cancelled");
    }
    this.changed();
    this.pump();
  }

  /** Retry only failures: a completed, skipped or cancelled row is history. */
  retry(id: string): void {
    const item = this.find(id);
    if (item && this.requeueFailure(item)) {
      this.changed();
      this.pump();
    }
  }

  retryFailed(): void {
    let changed = false;
    for (const item of this.items) {
      if (this.requeueFailure(item)) changed = true;
    }
    if (changed) {
      this.changed();
      this.pump();
    }
  }

  private requeueFailure(item: QueueItem): boolean {
    if (item.status !== "failed" || this.current?.id === item.id) return false;
    this.settled.delete(item.id);
    item.status = "queued";
    item.error = undefined;
    item.finishedAt = undefined;
    // A filing retry must not discard the model's work or its receipts.
    if (!("pendingDelivery" in item)) {
      item.percent = 0;
      item.pageCurrent = undefined;
      item.pageTotal = undefined;
      item.warningCount = undefined;
      // Keep the location of surplus/unreported outputs from the previous
      // attempt. A retry owns only its own new workspace.
      item.deliveryProgress = undefined;
      item.resultItemIDs = undefined;
      item.savedFiles = undefined;
    }
    return true;
  }

  /** Remove a document that is not running from the list. */
  remove(id: string): void {
    if (this.current?.id === id) return;
    this.items = this.items.filter((item) => item.id !== id);
    this.changed();
    this.pump();
  }

  moveToFront(id: string): void {
    const item = this.find(id);
    if (!item || (item.status !== "queued" && item.status !== "interrupted"))
      return;
    const firstWaiting = this.items.findIndex(
      (other) => other.status === "queued" || other.status === "interrupted",
    );
    this.items = this.items.filter((other) => other.id !== id);
    this.items.splice(Math.max(0, firstWaiting), 0, item);
    this.changed();
  }

  /** Drop everything that is neither waiting nor running. */
  clearFinished(): void {
    this.items = this.items.filter((item) => ACTIVE.includes(item.status));
    this.changed();
  }

  /** Stop after the current document. */
  pause(): void {
    if (this.paused) return;
    this.setPaused("user", "");
    this.changed();
  }

  /** Stop now: cancel the current document and keep the rest waiting. */
  stop(): void {
    this.setPaused("user", "");
    const running = this.current && this.find(this.current.id);
    if (
      running?.status === "running" &&
      running.id !== this.deliveringId &&
      this.current
    ) {
      // Back in line rather than cancelled: "stop" is not "discard".
      running.status = "interrupted";
      try {
        this.current.handle?.cancel();
      } catch {
        /* the job reports its own end */
      }
    }
    this.changed();
  }

  resume(): void {
    this.paused = false;
    this.pauseKind = undefined;
    this.pauseDetail = "";
    this.changed();
    this.pump();
  }

  /* ── Internals ── */

  private find(id: string): QueueItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  private setPaused(kind: QueuePauseKind, detail: string): void {
    this.paused = true;
    this.pauseKind = kind;
    this.pauseDetail = detail;
  }

  private trimHistory(items: QueueItem[]): QueueItem[] {
    let excess = items.length - MAX_ITEMS;
    if (excess <= 0) return items;
    return items.filter((item) => {
      if (
        excess > 0 &&
        !ACTIVE.includes(item.status) &&
        !item.pendingDelivery
      ) {
        excess -= 1;
        return false;
      }
      return true;
    });
  }

  private restore(): void {
    let parsed: unknown;
    try {
      const raw = this.deps.load();
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }
    const stored = (parsed as { items?: unknown[] } | null)?.items;
    if (!Array.isArray(stored)) return;
    this.items = stored.filter(isQueueItem).map((item) => ({
      ...item,
      status: item.status === "running" ? "interrupted" : item.status,
    }));
    // Never start spending the user's quota just because Zotero was opened.
    if (this.hasPending()) {
      this.setPaused("restored", "");
      const ledger = (parsed as { settled?: unknown }).settled;
      if (Array.isArray(ledger))
        for (const entry of ledger) {
          if (
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === "string" &&
            ["done", "failed", "cancelled", "skipped"].includes(entry[1])
          )
            this.settled.set(entry[0], entry[1]);
        }
    }
  }

  private persist(items = this.items, settled = this.settled): void {
    this.deps.save(
      JSON.stringify({
        version: 1,
        items,
        settled: [...settled],
      }),
    );
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* one broken view must not stop the queue */
      }
    }
  }

  private changed(): void {
    try {
      this.persist();
    } catch {
      /* Best effort for ordinary state; publication uses strict checkpoints. */
    }
    this.notify();
  }

  private pump(): void {
    if (this.current) return;
    // An interrupted document is simply first in line again.
    const next = this.items.find(
      (item) => item.status === "queued" || item.status === "interrupted",
    );
    if (!next) {
      this.finishBatch();
      return;
    }
    if (this.paused) return;
    const filingOnly = "pendingDelivery" in next;
    if (!filingOnly && this.deps.isOtherTranslationRunning()) {
      // A translation started from the tab is running; wait for it.
      if (!this.recheckScheduled) {
        this.recheckScheduled = true;
        this.deps.schedule(() => {
          this.recheckScheduled = false;
          this.pump();
        }, BUSY_RECHECK_MS);
      }
      return;
    }
    this.current = { id: next.id, handle: null };
    next.status = "running";
    next.percent = filingOnly ? 100 : 0;
    this.deliveringId = filingOnly ? next.id : null;
    next.error = undefined;
    this.changed();
    void this.runItem(next).finally(() => {
      this.deliveringId = null;
      this.current = null;
      this.changed();
      this.pump();
    });
  }

  private finishBatch(): void {
    if (!this.settled.size || this.hasPending()) return;
    const result: QueueBatchResult = {
      done: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0,
      lastDone: null,
    };
    for (const [id, status] of this.settled) {
      result[status]++;
      if (status === "done") result.lastDone = this.find(id) || null;
    }
    this.settled.clear();
    // No work left to resume. A later batch must not be silently held by a
    // pause-after-current request on the last document.
    this.paused = false;
    this.pauseKind = undefined;
    this.pauseDetail = "";
    this.changed();
    for (const listener of this.drainListeners) {
      try {
        listener(result);
      } catch {
        /* ignore */
      }
    }
  }

  private fail(item: QueueItem, message: string): void {
    item.status = "failed";
    item.error = message.slice(0, 1600);
    item.finishedAt = this.deps.now();
    this.settled.set(item.id, "failed");
  }

  /** The setup is broken: keep the document waiting and stop the queue. */
  private holdForSetup(
    item: QueueItem,
    kind: QueuePauseKind,
    detail: string,
  ): void {
    item.status = "queued";
    item.percent = 0;
    this.setPaused(kind, detail);
  }

  private async runItem(item: QueueItem): Promise<void> {
    let outputDir = "";
    let keepOutput = false;
    let deliveredFiles: string[] | undefined;
    let input:
      Awaited<ReturnType<NonNullable<QueueDeps["prepareInput"]>>> | undefined;
    try {
      if ("pendingDelivery" in item) {
        // Do not restart generation. The publisher rechecks its destinations.
        await this.publishPending(item);
        return;
      }
      const source = item.source;
      if ((this.deps.inspect && !source) || (source && !this.deps.inspect))
        throw new Error(
          "Source PDF was not verified. Add the document again to review it.",
        );
      const pdfPath = await this.deps.resolvePdfPath(item.attachmentID);
      if (item.status !== "running") return;
      if (!pdfPath) {
        this.fail(item, QUEUE_ERROR_PDF_MISSING);
        return;
      }
      let plan: OutputPlan | undefined;
      if (this.deps.inspect) {
        plan = await this.deps.inspect(item, pdfPath);
        if (item.status !== "running") return;
        if (!validPlan(plan))
          throw new Error("Invalid translation output plan");
        if (
          !source?.sourceStamp ||
          item.attachmentID !== plan.sourceID ||
          source.libraryID !== plan.libraryID ||
          source.sourceKey !== plan.sourceKey ||
          pdfPath !== source.pdfPath ||
          pdfPath !== plan.pdfPath ||
          source.sourceStamp !== plan.sourceStamp
        )
          throw new Error(
            "The source PDF changed after preview. Add the document again to review it.",
          );
        if (!plan.generateKinds.length) {
          item.status = "skipped";
          item.percent = 100;
          item.finishedAt = this.deps.now();
          this.settled.set(item.id, "skipped");
          return;
        }
        if (!this.deps.publish) throw new Error("Missing output publisher");
      }
      outputDir = await this.deps.createOutputDir();
      if (item.status !== "running") return;
      if (plan && this.deps.prepareInput) {
        input = await this.deps.prepareInput(plan);
        if (item.status !== "running") return;
      }
      const handle = this.deps.startJob(
        {
          pdfPath: input?.pdfPath ?? pdfPath,
          outputDir,
          modelName: item.modelName,
          providerId: item.providerId,
          options: plan
            ? {
                ...item.options,
                generateMono: plan.generateKinds.includes("mono"),
                generateDual: plan.generateKinds.includes("dual"),
              }
            : item.options,
        },
        (event) => this.onJobEvent(item, event),
      );
      if (this.current) this.current.handle = handle;
      // Cancelled or stopped while the output folder was being created.
      if (item.status !== "running") handle.cancel();
      const outcome = await handle.done;
      // cancel() and stop() set the final status themselves.
      if (item.status !== "running") return;
      if (outcome.status === "done") {
        this.deliveringId = item.id;
        item.percent = 100;
        this.notify();
      }
      keepOutput = await this.applyOutcome(item, outcome, outputDir, plan);
      if (outcome.status === "done") deliveredFiles = outcome.outputFiles;
    } catch (err) {
      if (item.status === "running") this.fail(item, errorText(err));
    } finally {
      // Input is a private temporary copy, never a staged translation.
      if (input) await input.dispose();
      if (outputDir && !keepOutput && !item.pendingDelivery) {
        await this.cleanup(item, outputDir, deliveredFiles);
      }
    }
  }

  private async cleanup(
    item: QueueItem,
    dir: string,
    files?: string[],
  ): Promise<void> {
    try {
      if (await this.deps.removeDir(dir, files)) item.retainedDir = dir;
    } catch {
      // Cleanup is best effort, and can never undo successful publication.
      item.retainedDir = dir;
    }
  }

  private onJobEvent(item: QueueItem, event: TranslateEvent): void {
    if (event.type !== "progress" || item.status !== "running") return;
    const percent = Math.min(
      100,
      Math.max(item.percent, Math.round(Number(event.data.progress) || 0)),
    );
    const { current, total } = event.data;
    const pageChanged =
      typeof current === "number" &&
      typeof total === "number" &&
      (current !== item.pageCurrent || total !== item.pageTotal);
    if (percent === item.percent && !pageChanged) return;
    item.percent = percent;
    if (pageChanged) {
      item.pageCurrent = current;
      item.pageTotal = total;
    }
    // Progress is frequent; it is shown but not written to disk.
    this.notify();
  }

  private async publishPending(item: QueueItem): Promise<void> {
    const p = item.pendingDelivery;
    if (
      !p ||
      !validPlan(p.plan) ||
      !p.plan.cells.length ||
      !p.plan.generateKinds.length ||
      !validManifest(p.dir, p.files)
    )
      throw new Error(
        "Invalid staged translation checkpoint; files left untouched",
      );
    const expected = new Set(p.plan.cells.map((c) => c.id));
    if (
      !Array.isArray(p.completed) ||
      !p.completed.every((id) => expected.has(id)) ||
      new Set(p.completed).size !== p.completed.length
    )
      throw new Error(
        "Invalid staged translation receipts; files left untouched",
      );

    const checkpoint = () => {
      item.deliveryProgress = {
        done: p.completed.length,
        total: expected.size,
      };
      this.persist(); // Fail closed: no destination write without a checkpoint.
      this.notify();
    };
    const safe = this.deps.validateStaging
      ? await this.deps.validateStaging(p.dir, p.files)
      : this.freshDeliveries.has(p);
    if (!safe)
      throw new Error(
        "Cannot verify staged translation files; files left untouched",
      );
    // Older checkpoints predate crash-recoverable destination reservations.
    // Bind the nonce durably before the publisher creates its first marker.
    const legacy = p.plan.reservationToken === undefined;
    if (legacy) p.plan.reservationToken = newReservationToken();
    if (
      typeof p.plan.reservationToken !== "string" ||
      !/^[a-f0-9]{32}$/.test(p.plan.reservationToken)
    )
      throw new Error("Invalid staged translation reservation token");
    checkpoint();
    if (!this.deps.publish) throw new Error("Missing output publisher");

    const delivered = await this.deps
      .publish(p.plan, [...p.files], [...p.completed], (id, itemID) => {
        if (!expected.has(id))
          throw new Error("Unexpected publication receipt");
        if (!p.completed.includes(id)) p.completed.push(id);
        if (itemID !== undefined && !item.resultItemIDs?.includes(itemID))
          (item.resultItemIDs ??= []).push(itemID);
        checkpoint();
      })
      .catch((err: unknown) => {
        // Pre-upgrade checkpoints could record an incomplete engine report. If
        // the publisher still needs that missing kind, it rejected the manifest
        // before ANY write. No owned reservation is lost by retiring it here.
        if (
          !legacy ||
          !(err instanceof MissingStagedFormatError) ||
          !p.plan.generateKinds.includes(err.kind)
        )
          throw err;
        delete item.pendingDelivery;
        item.retainedDir = p.dir;
        this.fail(
          item,
          `${err.message}. Output kept for inspection: ${p.dir}.${item.source ? "" : " Add the document again to review its source."}`,
        );
        return null;
      });
    if (!delivered) return;
    if (p.completed.length !== expected.size)
      throw new Error(
        `Incomplete publication (${p.completed.length}/${expected.size} outputs filed)`,
      );

    item.resultItemIDs = [
      ...new Set([...(item.resultItemIDs ?? []), ...delivered.itemIDs]),
    ];
    item.savedFiles = delivered.savedFiles;
    item.status = "done";
    item.finishedAt = this.deps.now();
    this.settled.set(item.id, "done");
    delete item.pendingDelivery;
    if (item.retainedDir === p.dir) delete item.retainedDir;
    try {
      // A restart must see a terminal row *before* its staged inputs disappear.
      this.persist();
    } catch (err) {
      item.status = "running";
      item.pendingDelivery = p;
      item.retainedDir = p.dir;
      throw err;
    }
    await this.cleanup(item, p.dir, p.files);
  }

  /** @returns true when the output folder must be kept or was already handled. */
  private async applyOutcome(
    item: QueueItem,
    outcome: TranslationJobOutcome,
    outputDir: string,
    plan: OutputPlan | undefined,
  ): Promise<boolean> {
    if (outcome.status === "cancelled") {
      item.status = "cancelled";
      item.finishedAt = this.deps.now();
      this.settled.set(item.id, "cancelled");
      return false;
    }
    if (outcome.status === "blocked") {
      if (outcome.reason === "busy") {
        // Lost a race with a tab job: wait in line again.
        item.status = "queued";
        return false;
      }
      this.holdForSetup(
        item,
        outcome.reason === "env_not_ready" ||
          outcome.reason === "env_needs_repair"
          ? "environment"
          : "credentials",
        outcome.detail || outcome.reason,
      );
      return false;
    }
    if (outcome.status === "error") {
      const kind = classifyFailure(outcome.message);
      // errorDetail may include the whole tail of a traceback. Classify it,
      // but don't persist the engine log in the queue preference.
      const detail = outcome.message.slice(0, 1000);
      if (kind === "document") this.fail(item, detail);
      else this.holdForSetup(item, kind, detail);
      return false;
    }
    if (!outcome.outputFiles.length) {
      this.fail(
        item,
        `No output filenames reported. Output kept for inspection: ${outputDir}`,
      );
      item.retainedDir = outputDir;
      return true;
    }
    // BabelDOC counts paragraphs accepted by the batch translator and those
    // sent to the simple translator. Neither counter measures fallback success.
    // ERROR records can be incidental too (e.g. token usage accounting).
    const progress = outcome.progress;
    const errorLines = progress?.errorLines || [];
    const errorCount = Math.max(
      progress?.errorCount || 0,
      errorLines.length,
      progress?.hasErrors ? 1 : 0,
    );
    const blocker = publicationBlocker(progress);
    if (blocker) {
      const kept = `Output kept for inspection: ${outcome.outputFiles[0]}`;
      item.error = kept;
      this.holdForSetup(item, blocker.kind, `${kept}\n${blocker.detail}`);
      return true;
    }
    if (plan) {
      item.warningCount = errorCount || undefined;
      try {
        validateGeneratedManifest(plan, outcome.outputFiles);
        if (
          !validManifest(outputDir, outcome.outputFiles) ||
          (this.deps.validateStaging &&
            !(await this.deps.validateStaging(outputDir, outcome.outputFiles)))
        )
          throw new Error("Cannot verify staged translation files");
      } catch (err) {
        // This is an incomplete *generation*, not a retryable filing job.
        // Do not give any listed filename to either publisher or cleanup.
        item.retainedDir = outputDir;
        this.fail(
          item,
          `${errorText(err)}. Output kept for inspection: ${outputDir}`,
        );
        return true;
      }
      item.retainedDir ??= outputDir;
      item.pendingDelivery = {
        plan,
        files: [...outcome.outputFiles],
        dir: outputDir,
        completed: plan.cells
          .filter((c) => c.exists && !plan.overwrite)
          .map((c) => c.id),
      };
      this.freshDeliveries.add(item.pendingDelivery);
      await this.publishPending(item);
      // The checkpoint owns cleanup from now on (also when restored).
      return true;
    }
    try {
      if (!this.deps.deliver) throw new Error("Missing output publisher");
      const delivered = await this.deps.deliver(
        item.attachmentID,
        outcome.outputFiles,
        item.output,
      );
      item.status = "done";
      item.percent = 100;
      item.resultItemIDs = delivered.itemIDs;
      item.warningCount = errorCount || undefined;
      item.finishedAt = this.deps.now();
      this.settled.set(item.id, "done");
      return false;
    } catch (err) {
      // The translation itself succeeded; keep the files so it is not lost.
      this.fail(
        item,
        `${errorText(err)} (${outcome.outputFiles[0] || "output kept"})`,
      );
      return true;
    }
  }
}
