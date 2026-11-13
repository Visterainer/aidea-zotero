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
}

export interface QueueItem {
  id: string;
  attachmentID: number;
  title: string;
  status: QueueItemStatus;
  percent: number;
  pageCurrent?: number;
  pageTotal?: number;
  /** Why the item failed. */
  error?: string;
  // Settings are captured when the document is added, so one batch is
  // translated consistently even if the tab is changed while it runs.
  modelName: string;
  providerId: string;
  options: SavedTranslateOptions;
  output: QueueOutputTarget;
  addedAt: number;
  finishedAt?: number;
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

export interface QueueAddEntry {
  attachmentID: number;
  title: string;
  /** The item already has this translation and the user chose to skip. */
  alreadyTranslated?: boolean;
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
  deliver(
    attachmentID: number,
    files: string[],
    output: QueueOutputTarget,
  ): Promise<QueueDeliverResult>;
  createOutputDir(): Promise<string>;
  removeDir(dir: string): Promise<void>;
  load(): string;
  save(json: string): void;
  now(): number;
  schedule(callback: () => void, delayMs: number): void;
}

const MAX_ITEMS = 100;
const BUSY_RECHECK_MS = 3000;
const ACTIVE: QueueItemStatus[] = ["queued", "running", "interrupted"];

/**
 * Decide whether a failed translation says something about the document or
 * about the setup. Setup failures would repeat for every remaining document,
 * so they pause the queue instead of burning through it.
 */
export function classifyFailure(message: string): QueuePauseKind | "document" {
  const text = String(message || "").toLowerCase();
  if (/\b429\b|rate.?limit|too many requests|quota|usage limit/.test(text)) {
    return "rate_limit";
  }
  if (
    /\b40[13]\b|unauthori[sz]ed|invalid.{0,12}(api.?key|token)|not logged in|sign in again|credential/.test(
      text,
    )
  ) {
    return "credentials";
  }
  if (
    /networkerror|econnrefused|econnreset|enotfound|etimedout|connection (refused|reset|error)|could not connect|failed to connect|proxy|name resolution|ssl|certificate/.test(
      text,
    )
  ) {
    return "network";
  }
  return "document";
}

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

export class TranslationQueue {
  private items: QueueItem[] = [];
  private paused = false;
  private pauseKind: QueuePauseKind | undefined;
  private pauseDetail = "";
  private current: { id: string; handle: TranslationJobHandle | null } | null =
    null;
  private listeners = new Set<() => void>();
  private drainListeners = new Set<(summary: QueueSummary) => void>();
  private recheckScheduled = false;
  /** True from the first start until the queue has nothing left to do. */
  private batchActive = false;
  private idCounter = 0;

  constructor(private readonly deps: QueueDeps) {
    this.restore();
  }

  /* ── Reading ── */

  getState(): QueueState {
    return {
      items: this.items.map((item) => ({ ...item })),
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
    return item ? { ...item } : null;
  }

  /** True while a document is being translated by the queue. */
  isRunning(): boolean {
    return this.current !== null;
  }

  hasPending(): boolean {
    return this.items.some((item) => ACTIVE.includes(item.status));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called once each time the queue runs out of work. */
  onDrained(listener: (summary: QueueSummary) => void): () => void {
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
    for (const entry of entries) {
      if (pendingIDs.has(entry.attachmentID)) {
        result.duplicates += 1;
        continue;
      }
      pendingIDs.add(entry.attachmentID);
      const skipped = entry.alreadyTranslated === true;
      this.items.push({
        id: this.nextId(),
        attachmentID: entry.attachmentID,
        title: entry.title,
        status: skipped ? "skipped" : "queued",
        percent: 0,
        modelName: settings.modelName,
        providerId: settings.providerId,
        options: { ...settings.options },
        output: { ...settings.output },
        addedAt: this.deps.now(),
        ...(skipped ? { finishedAt: this.deps.now() } : {}),
      });
      if (skipped) result.skipped += 1;
      else result.added += 1;
    }
    this.trim();
    this.changed();
    if (result.added) this.pump();
    return result;
  }

  /** Stop one document. A running one is cancelled; a waiting one is dropped. */
  cancel(id: string): void {
    const item = this.find(id);
    if (!item) return;
    if (this.current?.id === id) {
      // Marked first: the job may settle synchronously.
      item.status = "cancelled";
      item.finishedAt = this.deps.now();
      try {
        this.current.handle?.cancel();
      } catch {
        /* the job reports its own end */
      }
    } else if (item.status === "queued" || item.status === "interrupted") {
      item.status = "cancelled";
      item.finishedAt = this.deps.now();
    }
    this.changed();
  }

  /** Put a finished document back in line. */
  retry(id: string): void {
    const item = this.find(id);
    if (!item || ACTIVE.includes(item.status)) return;
    item.status = "queued";
    item.percent = 0;
    item.pageCurrent = undefined;
    item.pageTotal = undefined;
    item.error = undefined;
    item.finishedAt = undefined;
    item.resultItemIDs = undefined;
    this.changed();
    this.pump();
  }

  /** Remove a document that is not running from the list. */
  remove(id: string): void {
    if (this.current?.id === id) return;
    this.items = this.items.filter((item) => item.id !== id);
    this.changed();
  }

  moveToFront(id: string): void {
    const item = this.find(id);
    if (!item || item.status !== "queued") return;
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
    if (running && this.current) {
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

  private nextId(): string {
    this.idCounter += 1;
    return `q${this.deps.now().toString(36)}-${this.idCounter}`;
  }

  private find(id: string): QueueItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  private setPaused(kind: QueuePauseKind, detail: string): void {
    this.paused = true;
    this.pauseKind = kind;
    this.pauseDetail = detail;
  }

  private trim(): void {
    let excess = this.items.length - MAX_ITEMS;
    if (excess <= 0) return;
    this.items = this.items.filter((item) => {
      if (excess > 0 && !ACTIVE.includes(item.status)) {
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
    if (this.hasPending()) this.setPaused("restored", "");
  }

  private persist(): void {
    try {
      this.deps.save(JSON.stringify({ version: 1, items: this.items }));
    } catch {
      /* the queue still works for this session */
    }
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
    this.persist();
    this.notify();
  }

  private pump(): void {
    if (this.paused || this.current) return;
    // An interrupted document is simply first in line again.
    const next = this.items.find(
      (item) => item.status === "queued" || item.status === "interrupted",
    );
    if (!next) {
      this.finishBatch();
      return;
    }
    if (this.deps.isOtherTranslationRunning()) {
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
    this.batchActive = true;
    this.current = { id: next.id, handle: null };
    next.status = "running";
    next.percent = 0;
    next.error = undefined;
    this.changed();
    void this.runItem(next).finally(() => {
      this.current = null;
      this.changed();
      this.pump();
    });
  }

  private finishBatch(): void {
    if (!this.batchActive || this.hasPending()) return;
    this.batchActive = false;
    const summary = this.getSummary();
    for (const listener of this.drainListeners) {
      try {
        listener(summary);
      } catch {
        /* ignore */
      }
    }
  }

  private fail(item: QueueItem, message: string): void {
    item.status = "failed";
    item.error = message;
    item.finishedAt = this.deps.now();
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
    try {
      const pdfPath = await this.deps.resolvePdfPath(item.attachmentID);
      if (item.status !== "running") return;
      if (!pdfPath) {
        this.fail(item, "PDF file not found");
        return;
      }
      outputDir = await this.deps.createOutputDir();
      const handle = this.deps.startJob(
        {
          pdfPath,
          outputDir,
          modelName: item.modelName,
          providerId: item.providerId,
          options: item.options,
        },
        (event) => this.onJobEvent(item, event),
      );
      if (this.current) this.current.handle = handle;
      // Cancelled or stopped while the output folder was being created.
      if (item.status !== "running") handle.cancel();
      const outcome = await handle.done;
      // cancel() and stop() set the final status themselves.
      if (item.status !== "running") return;
      keepOutput = await this.applyOutcome(item, outcome);
    } catch (err) {
      if (item.status === "running") this.fail(item, errorText(err));
    } finally {
      if (outputDir && !keepOutput) await this.deps.removeDir(outputDir);
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

  /** @returns true when the output folder must be kept. */
  private async applyOutcome(
    item: QueueItem,
    outcome: TranslationJobOutcome,
  ): Promise<boolean> {
    if (outcome.status === "cancelled") {
      item.status = "cancelled";
      item.finishedAt = this.deps.now();
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
      if (kind === "document") this.fail(item, outcome.message);
      else this.holdForSetup(item, kind, outcome.message);
      return false;
    }
    if (!outcome.outputFiles.length) {
      this.fail(item, "The engine produced no output file");
      return false;
    }
    try {
      const delivered = await this.deps.deliver(
        item.attachmentID,
        outcome.outputFiles,
        item.output,
      );
      item.status = "done";
      item.percent = 100;
      item.resultItemIDs = delivered.itemIDs;
      item.finishedAt = this.deps.now();
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
