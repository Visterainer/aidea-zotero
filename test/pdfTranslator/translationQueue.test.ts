import { assert } from "chai";
import {
  MissingStagedFormatError,
  type OutputPlan,
} from "../../src/modules/pdfTranslator/translationOutputs";
import type { SavedTranslateOptions } from "../../src/modules/pdfTranslator/translatePrefs";
import type {
  TranslationJobHandle,
  TranslationJobOutcome,
  TranslationJobRequest,
} from "../../src/modules/pdfTranslator/translationJob";
import {
  classifyFailure,
  previewSource,
  TranslationQueue,
  type QueueDeps,
  type QueueOutputTarget,
} from "../../src/modules/pdfTranslator/translationQueue";

type FakeJob = {
  request: TranslationJobRequest;
  cancelled: boolean;
  emit: (percent: number, current?: number, total?: number) => void;
  finish: (outcome: TranslationJobOutcome) => void;
};

const OPTIONS = {
  sourceLang: "en",
  targetLang: "zh-CN",
  generateMono: true,
  generateDual: false,
} as SavedTranslateOptions;
const SETTINGS = {
  modelName: "model-a",
  providerId: "provider-a",
  options: OPTIONS,
  output: { attach: true, saveDir: "" },
};

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}

describe("translation queue", function () {
  let jobs: FakeJob[];
  let stored: string;
  let otherRunning: boolean;
  let scheduled: Array<() => void>;
  let delivered: Array<{
    id: number;
    files: string[];
    output: QueueOutputTarget;
  }>;
  let removedDirs: string[];
  let deliverError: string;
  let missingPdf: Set<number>;

  const deps = (): QueueDeps => ({
    startJob(request, onEvent): TranslationJobHandle {
      let resolve!: (outcome: TranslationJobOutcome) => void;
      const done = new Promise<TranslationJobOutcome>((r) => (resolve = r));
      const job: FakeJob = {
        request,
        cancelled: false,
        emit: (progress, current, total) =>
          onEvent({
            type: "progress",
            data: { progress, current, total } as any,
          }),
        finish: resolve,
      };
      jobs.push(job);
      return {
        cancel() {
          job.cancelled = true;
          resolve({ status: "cancelled" });
        },
        done,
      };
    },
    isOtherTranslationRunning: () => otherRunning,
    resolvePdfPath: async (id) =>
      missingPdf.has(id) ? null : `/pdf/${id}.pdf`,
    async deliver(id, files, output) {
      if (deliverError) throw new Error(deliverError);
      delivered.push({ id, files, output });
      return { itemIDs: [id + 1000] };
    },
    createOutputDir: async () => `/tmp/out-${jobs.length}`,
    removeDir: async (dir) => {
      removedDirs.push(dir);
    },
    load: () => stored,
    save: (json) => {
      stored = json;
    },
    now: () => 1_700_000_000_000,
    schedule: (callback) => {
      scheduled.push(callback);
    },
  });

  const statuses = (queue: TranslationQueue) =>
    queue.getState().items.map((item) => item.status);
  const done = (dir: string): TranslationJobOutcome => ({
    status: "done",
    outputFiles: [`${dir}/a.zh-CN.mono.pdf`],
    progress: null,
  });

  beforeEach(function () {
    jobs = [];
    stored = "";
    otherRunning = false;
    scheduled = [];
    delivered = [];
    removedDirs = [];
    deliverError = "";
    missingPdf = new Set();
  });

  it("translates one document at a time, in order", async function () {
    const queue = new TranslationQueue(deps());
    const result = queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    assert.deepEqual(result, { added: 2, skipped: 0, duplicates: 0 });
    await settle();
    assert.lengthOf(jobs, 1);
    assert.deepEqual(statuses(queue), ["running", "queued"]);
    assert.equal(jobs[0].request.pdfPath, "/pdf/1.pdf");
    assert.equal(jobs[0].request.modelName, "model-a");

    jobs[0].finish(done("/tmp/out-0"));
    await settle();
    assert.lengthOf(jobs, 2);
    assert.deepEqual(statuses(queue), ["done", "running"]);
    assert.deepEqual(delivered[0], {
      id: 1,
      files: ["/tmp/out-0/a.zh-CN.mono.pdf"],
      output: { attach: true, saveDir: "" },
    });
    assert.deepEqual(queue.getState().items[0].resultItemIDs, [1001]);
    assert.include(removedDirs, "/tmp/out-0");
  });

  it("rejects admission atomically even with history trimming and a pump already scheduled", async function () {
    let reject = false;
    const queue = new TranslationQueue({
      ...deps(),
      save(json) {
        if (reject) throw new Error("cannot persist admission");
        stored = json;
      },
    });
    queue.add(
      Array.from({ length: 100 }, (_, i) => ({
        title: "history",
        attachmentID: 100 + i,
        alreadyTranslated: true,
      })),
      SETTINGS,
    );
    otherRunning = true;
    queue.add([{ attachmentID: 1, title: "already accepted" }], SETTINGS);
    const before = queue.getState();
    const disk = stored;
    let notices = 0;
    let summary: unknown;
    queue.subscribe(() => notices++);
    queue.onDrained((r) => {
      summary = r;
    });
    reject = true;
    assert.throws(
      () =>
        queue.add(
          [
            { attachmentID: 2, title: "runnable" },
            {
              attachmentID: 3,
              title: "failed preview",
              preflightError: "offline",
            },
            { attachmentID: 4, title: "skipped", alreadyTranslated: true },
          ],
          SETTINGS,
        ),
      "cannot persist admission",
    );
    assert.deepEqual(queue.getState(), before);
    assert.equal(stored, disk);
    assert.equal(notices, 0);
    assert.lengthOf(scheduled, 1);
    assert.isEmpty(jobs);
    reject = otherRunning = false;
    scheduled[0]();
    await settle();
    jobs[0].finish(done("/tmp/out-0"));
    await settle();
    assert.lengthOf(jobs, 1);
    assert.include(summary as object, { done: 1, failed: 0, skipped: 0 });
  });

  it("keeps the live draft when Gecko rejects admission, including a multibyte queue exceeding the pref limit", async function () {
    const g = globalThis as any;
    const original = g.Zotero;
    const values = new Map<string, unknown>();
    let reject: "throw" | "ignore" | "size" = "throw";
    let queueWrites = 0;
    const draftKey = "extensions.zotero.aidea.translate.batchDraft";
    const item = {
      id: 75021,
      isAttachment: () => true,
      isPDFAttachment: () => true,
      getFilePathAsync: async () => "/test.pdf",
      getDisplayTitle: () => "pending",
    };
    g.Zotero = {
      Items: { getAsync: async () => false }, // offline between staging and preview
      Prefs: {
        get: (key: string) =>
          key.endsWith("lastUsedModelName.translate")
            ? "unused"
            : values.get(key),
        set: (key: string, value: string) => {
          if (key.endsWith(".translate.queueState")) {
            queueWrites++;
            if (reject === "throw") throw new Error("native write failure");
            if (reject === "ignore") return;
          }
          values.set(key, value);
        },
      },
    };
    try {
      const batch =
        await import("../../src/modules/pdfTranslator/translationBatch");
      const { getTranslationQueue } =
        await import("../../src/modules/pdfTranslator/translationQueueService");
      const queue = getTranslationQueue();
      const before = queue.getState();
      const submit = async () => {
        let confirmed = false;
        let error: unknown;
        try {
          await batch.startBatch(false, () => {
            confirmed = true;
            return true;
          });
        } catch (e) {
          error = e;
        }
        assert.isTrue(confirmed);
        assert.deepEqual(queue.getState(), before);
        assert.equal(batch.getBatchDraft()[0]?.attachmentID, item.id);
        assert.equal(
          JSON.parse(values.get(draftKey) as string)[0].attachmentID,
          item.id,
        );
        return String(error);
      };
      await batch.stageLibraryItems([item as unknown as Zotero.Item]);
      assert.include(await submit(), "native write failure");
      reject = "ignore";
      assert.include(await submit(), "Cannot save translation batch state");
      batch.removeDraftItem(item.id);
      reject = "size";
      item.getDisplayTitle = () => "文".repeat(349475);
      await batch.stageLibraryItems([item as unknown as Zotero.Item]);
      assert.include(await submit(), "too large to save");
      assert.equal(queueWrites, 2, "oversize is rejected before native setter");
      batch.removeDraftItem(item.id);
    } finally {
      g.Zotero = original;
    }
  });

  it("does not add a document that is already waiting, and records skipped ones", function () {
    const queue = new TranslationQueue(deps());
    queue.pause();
    queue.add([{ attachmentID: 1, title: "A" }], SETTINGS);
    const result = queue.add(
      [
        { attachmentID: 1, title: "A again" },
        { attachmentID: 2, title: "B", alreadyTranslated: true },
      ],
      SETTINGS,
    );
    assert.deepEqual(result, { added: 0, skipped: 1, duplicates: 1 });
    assert.deepEqual(statuses(queue), ["queued", "skipped"]);
    assert.isFalse(queue.isRunning());
  });

  it("keeps going after a document fails for its own reasons", async function () {
    const queue = new TranslationQueue(deps());
    let drained: unknown = null;
    queue.onDrained((summary) => (drained = summary));
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    jobs[0].finish({ status: "error", message: "PDF is corrupted" });
    await settle();
    assert.deepEqual(statuses(queue), ["failed", "running"]);
    assert.equal(queue.getState().items[0].error, "PDF is corrupted");
    assert.isFalse(queue.getState().paused);
    assert.isNull(drained);

    jobs[1].finish(done("/tmp/out-1"));
    await settle();
    assert.include(drained as object, { done: 1, failed: 1 });
    assert.equal((drained as any).lastDone.attachmentID, 2);
  });

  it("pauses instead of failing every document when the setup is broken", async function () {
    const queue = new TranslationQueue(deps());
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    jobs[0].finish({
      status: "blocked",
      reason: "credentials",
      detail: "token expired",
    });
    await settle();
    const state = queue.getState();
    assert.isTrue(state.paused);
    assert.equal(state.pauseKind, "credentials");
    assert.equal(state.pauseDetail, "token expired");
    assert.deepEqual(statuses(queue), ["queued", "queued"]);
    assert.lengthOf(jobs, 1);

    queue.resume();
    await settle();
    assert.lengthOf(jobs, 2);
    assert.equal(jobs[1].request.pdfPath, "/pdf/1.pdf");
  });

  it("tells setup failures from document failures", function () {
    assert.equal(classifyFailure("HTTP 429 Too Many Requests"), "rate_limit");
    assert.equal(classifyFailure("usage limit reached"), "rate_limit");
    assert.equal(classifyFailure("401 Unauthorized"), "credentials");
    assert.equal(
      classifyFailure("NetworkError when attempting to fetch resource."),
      "network",
    );
    assert.equal(classifyFailure("Failed to connect to proxy"), "network");
    assert.equal(classifyFailure("no text layer found on page 3"), "document");
    assert.equal(classifyFailure(""), "document");
    // Words that merely contain "ssl" or mention the local proxy.
    assert.equal(classifyFailure("lossless image stream"), "document");
    assert.equal(classifyFailure("translation proxy returned 500"), "document");
    assert.equal(
      classifyFailure("bad glyph on page 403 (il_translator.py:429)"),
      "document",
    );
    assert.equal(classifyFailure("bad rate_limit_params value"), "document");
    assert.equal(
      classifyFailure("Error code: 500 - {'message': 'HTTP 403 from API'}"),
      "credentials",
    );
    assert.equal(classifyFailure("openai.APITimeoutError"), "network");
    assert.equal(
      classifyFailure(
        "SSL: CERTIFICATE_VERIFY_FAILED certificate verify failed",
      ),
      "network",
    );
  });

  for (const code of [502, 503, 504]) {
    it(`pauses the remaining batch on upstream HTTP ${code}, not a page number`, async function () {
      assert.equal(classifyFailure(`PDF failed on page ${code}`), "document");
      const q = new TranslationQueue(deps());
      q.add(
        [
          { attachmentID: 1, title: "A" },
          { attachmentID: 2, title: "B" },
        ],
        SETTINGS,
      );
      await settle();
      jobs[0].finish({ status: "error", message: `provider: HTTP ${code}` });
      await settle();
      assert.equal(q.getState().pauseKind, "network");
      assert.lengthOf(jobs, 1);
      assert.isEmpty(delivered);
    });
  }

  it("pauses on a rate limit reported by the engine", async function () {
    const queue = new TranslationQueue(deps());
    queue.add([{ attachmentID: 1, title: "A" }], SETTINGS);
    await settle();
    jobs[0].finish({ status: "error", message: "HTTP 429 rate limit" });
    await settle();
    assert.equal(queue.getState().pauseKind, "rate_limit");
    assert.deepEqual(statuses(queue), ["queued"]);
  });

  it("cancels one document and carries on with the next", async function () {
    const queue = new TranslationQueue(deps());
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
        { attachmentID: 3, title: "C" },
      ],
      SETTINGS,
    );
    await settle();
    const [first, second] = queue.getState().items;
    queue.cancel(second.id);
    queue.cancel(first.id);
    await settle();
    assert.isTrue(jobs[0].cancelled);
    assert.deepEqual(statuses(queue), ["cancelled", "cancelled", "running"]);
    assert.equal(jobs[1].request.pdfPath, "/pdf/3.pdf");
  });

  it("stop keeps the current document for later instead of discarding it", async function () {
    const queue = new TranslationQueue(deps());
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    queue.stop();
    await settle();
    assert.isTrue(jobs[0].cancelled);
    assert.isTrue(queue.getState().paused);
    assert.deepEqual(statuses(queue), ["interrupted", "queued"]);
    assert.lengthOf(jobs, 1);

    queue.resume();
    await settle();
    assert.equal(jobs[1].request.pdfPath, "/pdf/1.pdf");
  });

  it("pause lets the current document finish and starts nothing new", async function () {
    const queue = new TranslationQueue(deps());
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    queue.pause();
    jobs[0].finish(done("/tmp/out-0"));
    await settle();
    assert.deepEqual(statuses(queue), ["done", "queued"]);
    assert.lengthOf(jobs, 1);
  });

  it("restores a saved queue paused, and never starts by itself", async function () {
    const first = new TranslationQueue(deps());
    first.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    assert.include(stored, '"status":"running"');

    jobs = [];
    const restored = new TranslationQueue(deps());
    await settle();
    assert.deepEqual(statuses(restored), ["interrupted", "queued"]);
    assert.isTrue(restored.getState().paused);
    assert.equal(restored.getState().pauseKind, "restored");
    assert.lengthOf(jobs, 0);

    restored.resume();
    await settle();
    assert.lengthOf(jobs, 1);
    assert.equal(jobs[0].request.pdfPath, "/pdf/1.pdf");
  });

  it("ignores a corrupt saved queue", function () {
    stored = "{not json";
    assert.deepEqual(new TranslationQueue(deps()).getState().items, []);
    stored = JSON.stringify({ items: [{ id: 1 }, "x", null] });
    assert.deepEqual(new TranslationQueue(deps()).getState().items, []);
  });

  it("waits while a translation started elsewhere is running", async function () {
    otherRunning = true;
    const queue = new TranslationQueue(deps());
    queue.add([{ attachmentID: 1, title: "A" }], SETTINGS);
    await settle();
    assert.lengthOf(jobs, 0);
    assert.lengthOf(scheduled, 1);
    otherRunning = false;
    scheduled[0]();
    await settle();
    assert.lengthOf(jobs, 1);
  });

  it("keeps the files when the result cannot be filed", async function () {
    deliverError = "disk full";
    const queue = new TranslationQueue(deps());
    queue.add([{ attachmentID: 1, title: "A" }], SETTINGS);
    await settle();
    jobs[0].finish(done("/tmp/out-0"));
    await settle();
    const [item] = queue.getState().items;
    assert.equal(item.status, "failed");
    assert.include(item.error || "", "disk full");
    assert.include(item.error || "", "/tmp/out-0/a.zh-CN.mono.pdf");
    assert.notInclude(removedDirs, "/tmp/out-0");
  });

  it("fails a document whose PDF is gone and moves on", async function () {
    missingPdf.add(1);
    const queue = new TranslationQueue(deps());
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    assert.deepEqual(statuses(queue), ["failed", "running"]);
  });

  it("reports progress, retries, reorders and clears", async function () {
    const queue = new TranslationQueue(deps());
    let notifications = 0;
    queue.subscribe(() => (notifications += 1));
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
        { attachmentID: 3, title: "C" },
      ],
      SETTINGS,
    );
    await settle();
    const before = notifications;
    jobs[0].emit(40, 4, 10);
    jobs[0].emit(40, 4, 10);
    jobs[0].emit(20, 4, 10);
    assert.equal(notifications, before + 1);
    assert.include(queue.getRunningItem(), {
      percent: 40,
      pageCurrent: 4,
      pageTotal: 10,
    });

    const third = queue.getState().items[2];
    queue.moveToFront(third.id);
    assert.deepEqual(
      queue.getState().items.map((item) => item.title),
      ["A", "C", "B"],
    );

    jobs[0].finish({ status: "error", message: "bad pdf" });
    await settle();
    const failed = queue.getState().items[0];
    queue.retry(failed.id);
    assert.equal(queue.getState().items[0].status, "queued");
    queue.clearFinished();
    assert.lengthOf(queue.getState().items, 3);
    assert.deepEqual(queue.getSummary().failed, 0);
  });

  it("drains a paused last job, without carrying its results into a new batch", async function () {
    const q = new TranslationQueue(deps());
    const drained: number[] = [];
    q.onDrained((r) => drained.push(r.done));
    q.add([{ attachmentID: 1, title: "one" }], SETTINGS);
    await settle();
    q.pause();
    jobs[0].finish(done("/out"));
    await settle();
    assert.deepEqual(drained, [1]);
    q.add([{ attachmentID: 2, title: "two" }], SETTINGS);
    await settle();
    assert.deepEqual(q.getBatchPosition(), { index: 1, total: 1 });
    jobs[1].finish(done("/out"));
    await settle();
    assert.deepEqual(drained, [1, 1]);
  });

  it("withdraws a row's old failure when it is retried in the same batch", async function () {
    const q = new TranslationQueue(deps());
    let result: unknown;
    q.onDrained((r) => {
      result = r;
    });
    q.add(
      [
        { attachmentID: 1, title: "one" },
        { attachmentID: 2, title: "two" },
      ],
      SETTINGS,
    );
    await settle();
    jobs[0].finish({ status: "error", message: "bad PDF" });
    await settle();
    q.retry(q.getState().items[0].id);
    assert.equal(q.getBatchPosition().total, 2);
    jobs[1].finish(done("/out"));
    await settle();
    jobs[2].finish(done("/out"));
    await settle();
    assert.include(result as object, { done: 2, failed: 0 });
  });

  it("restores completed counts alongside unfinished work without starting it", async function () {
    const q = new TranslationQueue(deps());
    q.add(
      [
        { attachmentID: 1, title: "one" },
        { attachmentID: 2, title: "two" },
      ],
      SETTINGS,
    );
    await settle();
    jobs[0].finish(done("/out"));
    await settle();
    const restored = new TranslationQueue(deps());
    let result: unknown;
    assert.isTrue(restored.getState().paused);
    assert.lengthOf(jobs, 2);
    restored.onDrained((r) => {
      result = r;
    });
    restored.resume();
    await settle();
    assert.deepEqual(restored.getBatchPosition(), { index: 2, total: 2 });
    jobs[2].finish(done("/out"));
    await settle();
    assert.include(result as object, { done: 2 });
  });

  it("does not charge an all-skipped selection to a later translation", async function () {
    const q = new TranslationQueue(deps());
    let result: unknown;
    q.onDrained((r) => {
      result = r;
    });
    q.add(
      [{ attachmentID: 1, title: "one", alreadyTranslated: true }],
      SETTINGS,
    );
    q.add([{ attachmentID: 2, title: "two" }], SETTINGS);
    await settle();
    jobs[0].finish(done("/out"));
    await settle();
    assert.include(result as object, { done: 1, skipped: 0 });
  });

  it("does not cancel or double-count a PDF after filing has begun", async function () {
    let finish!: () => void;
    const q = new TranslationQueue({
      ...deps(),
      deliver: () =>
        new Promise((resolve) => {
          finish = () => resolve({ itemIDs: [11] });
        }),
    });
    let result: unknown;
    q.onDrained((r) => {
      result = r;
    });
    q.add([{ attachmentID: 1, title: "one" }], SETTINGS);
    await settle();
    jobs[0].finish(done("/out"));
    await settle();
    const running = q.getRunningItem()!;
    assert.isTrue(running.filing);
    q.cancel(running.id);
    q.stop();
    assert.equal(q.getState().items[0].status, "running");
    finish();
    await settle();
    assert.include(result as object, { done: 1, cancelled: 0 });
  });

  it("keeps the workspace when a successful process never reported its files", async function () {
    const queue = new TranslationQueue(deps());
    queue.add([{ attachmentID: 1, title: "one" }], SETTINGS);
    await settle();
    jobs[0].finish({ status: "done", outputFiles: [], progress: null });
    await settle();
    const row = queue.getState().items[0];
    assert.equal(row.status, "failed");
    assert.equal(row.retainedDir, "/tmp/out-0");
    assert.deepEqual(removedDirs, []);
  });

  it("only cleans up filed PDFs and records where extra outputs remain", async function () {
    let manifest: string[] | undefined;
    const queue = new TranslationQueue({
      ...deps(),
      removeDir: async (_dir, files) => {
        manifest = files;
        return true;
      },
    });
    queue.add([{ attachmentID: 1, title: "one" }], SETTINGS);
    await settle();
    jobs[0].finish(done("/tmp/out-0"));
    await settle();
    assert.deepEqual(manifest, ["/tmp/out-0/a.zh-CN.mono.pdf"]);
    assert.equal(queue.getState().items[0].retainedDir, "/tmp/out-0");
  });

  it("counts each batch on its own, not the whole history", async function () {
    const queue = new TranslationQueue(deps());
    const results: any[] = [];
    queue.onDrained((result) => results.push(result));
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    assert.deepEqual(queue.getBatchPosition(), { index: 1, total: 2 });
    jobs[0].finish(done("/tmp/out-0"));
    await settle();
    assert.deepEqual(queue.getBatchPosition(), { index: 2, total: 2 });
    jobs[1].finish(done("/tmp/out-1"));
    await settle();
    assert.include(results[0], { done: 2, failed: 0 });

    queue.add(
      [
        { attachmentID: 3, title: "C" },
        { attachmentID: 4, title: "D", alreadyTranslated: true },
      ],
      SETTINGS,
    );
    await settle();
    assert.deepEqual(queue.getBatchPosition(), { index: 1, total: 1 });
    jobs[2].finish(done("/tmp/out-2"));
    await settle();
    assert.include(results[1], { done: 1, failed: 0, skipped: 1 });
    assert.equal(results[1].lastDone.title, "C");
    assert.lengthOf(results, 2);
  });

  it("retains the outputs and queues a retry after rejected authentication", async function () {
    const queue = new TranslationQueue(deps());
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    jobs[0].finish({
      status: "done",
      outputFiles: ["/tmp/out-0/a.zh-CN.mono.pdf"],
      progress: {
        hasErrors: true,
        errorCount: 40,
        errorLines: ["ERROR openai.AuthenticationError: 401 Unauthorized"],
        translationStats: { total: 40, successful: 0, fallback: 40 },
      } as any,
    });
    await settle();
    // A rejected sign-in would fail every remaining document too.
    assert.equal(queue.getState().pauseKind, "credentials");
    assert.deepEqual(statuses(queue), ["queued", "queued"]);
    assert.lengthOf(delivered, 0);
    assert.notInclude(removedDirs, "/tmp/out-0");
    assert.include(queue.getState().pauseDetail, "/tmp/out-0/a.zh-CN.mono.pdf");
    assert.include(stored, "/tmp/out-0/a.zh-CN.mono.pdf");
  });

  it("pauses for an explicit service error without batch stats and keeps the PDF", async function () {
    const queue = new TranslationQueue(deps());
    queue.add(
      [
        { attachmentID: 1, title: "A" },
        { attachmentID: 2, title: "B" },
      ],
      SETTINGS,
    );
    await settle();
    jobs[0].finish({
      status: "done",
      outputFiles: ["/tmp/out-0/a.mono.pdf"],
      progress: {
        status: "done",
        progress: 100,
        message: "Translation complete",
        hasErrors: true,
        errorCount: 100,
        errorLines: [
          "Error code: 500 - HTTP 429 from api: " + "x".repeat(2000),
        ],
      },
    });
    await settle();
    const state = queue.getState();
    assert.equal(state.pauseKind, "rate_limit");
    assert.lengthOf(jobs, 1);
    assert.isEmpty(delivered);
    assert.isEmpty(removedDirs);
    assert.include(state.pauseDetail, "/tmp/out-0/a.mono.pdf");
    assert.isBelow(state.pauseDetail!.length, 1024);
  });

  it("delivers fallback output even with zero batch successes and incidental ERRORs", async function () {
    const queue = new TranslationQueue(deps());
    queue.add([{ attachmentID: 1, title: "A" }], SETTINGS);
    await settle();
    jobs[0].finish({
      status: "done",
      outputFiles: ["/tmp/out-0/a.mono.pdf"],
      progress: {
        status: "done",
        progress: 100,
        message: "Translation complete",
        hasErrors: true,
        errorCount: 3,
        errorLines: ["ERROR Error getting token usage: missing total_tokens"],
        translationStats: { total: 40, successful: 0, fallback: 40 },
      },
    });
    await settle();
    assert.include(queue.getState().items[0], {
      status: "done",
      warningCount: 3,
    });
    assert.deepEqual(delivered[0].files, ["/tmp/out-0/a.mono.pdf"]);
    assert.include(removedDirs, "/tmp/out-0");
  });

  describe("planned delivery", function () {
    // The publisher owns destination-specific fields. The queue only needs the
    // stable ID, kind and initial existence of each destination/format cell.
    const plan = (id = 1): OutputPlan => ({
      sourceID: id,
      libraryID: 1,
      sourceKey: `KEY${id}`,
      pdfPath: `/pdf/${id}.pdf`,
      sourceStamp: "3820:16600000:16500000",
      reservationToken: "1b486500decaf000f100ce5000010001",
      targetLang: "zh-CN",
      kinds: ["mono", "dual"],
      output: { attach: true, saveDir: "/folder" },
      overwrite: false,
      cells: [
        {
          id: "mono:library",
          destination: "attachment",
          kind: "mono",
          exists: true,
        },
        {
          id: "dual:library",
          destination: "attachment",
          kind: "dual",
          exists: false,
        },
        {
          id: "dual:folder",
          destination: "folder",
          kind: "dual",
          exists: false,
        },
      ],
      generateKinds: ["dual"],
    });
    const dir = "/tmp/out-0";
    const files = [`${dir}/1.no_watermark.zh-CN.dual.pdf`];
    const output = {
      status: "done",
      outputFiles: files,
      progress: null,
    } as const;
    let entries: {
      attachmentID: number;
      title: string;
      source: ReturnType<typeof previewSource>;
    }[];

    beforeEach(function () {
      entries = [
        { attachmentID: 1, title: "A", source: previewSource(plan()) },
      ];
    });
    const parsedRow = () => JSON.parse(stored).items[0];

    it("re-inspects stale preflight, freezes authorization, narrows one job and skips a complete row", async function () {
      const inspected: number[] = [];
      let dirsCreated = 0;
      const settings = {
        ...SETTINGS,
        options: { ...OPTIONS, generateDual: true },
        output: { attach: true, saveDir: "/folder", overwrite: false },
      };
      const replaceIds = ["an approved destination"];
      const q = new TranslationQueue({
        ...deps(),
        async inspect(item, pdfPath) {
          inspected.push(item.attachmentID);
          assert.equal(pdfPath, `/pdf/${item.attachmentID}.pdf`);
          assert.isFalse(item.output.overwrite);
          const p = plan(item.attachmentID);
          if (item.attachmentID === 1) {
            assert.deepEqual(item.replaceIds, ["an approved destination"]);
          } else {
            for (const c of p.cells) c.exists = true;
            p.generateKinds = [];
          }
          return p;
        },
        async createOutputDir() {
          dirsCreated++;
          return dir;
        },
        async publish(_plan, _files, completed, receipt) {
          assert.deepEqual(completed, ["mono:library"]);
          receipt("dual:library", 5);
          receipt("dual:folder");
          return { itemIDs: [5], savedFiles: ["/folder/a.dual.pdf"] };
        },
      });
      q.pause();
      q.add(
        [
          { ...entries[0], alreadyTranslated: true, replaceIds },
          { attachmentID: 2, title: "B", source: previewSource(plan(2)) },
        ],
        settings,
      );
      settings.output.overwrite = true;
      replaceIds.length = 0;
      q.resume();
      await settle();
      assert.include(jobs[0].request.options, {
        generateMono: false,
        generateDual: true,
      });
      assert.isTrue(q.getState().items[0].options.generateMono);
      jobs[0].finish(output);
      await settle();
      assert.deepEqual(inspected, [1, 2]);
      assert.deepEqual(statuses(q), ["done", "skipped"]);
      assert.lengthOf(jobs, 1);
      assert.equal(dirsCreated, 1);
      assert.deepEqual(q.getState().items[0].savedFiles, [
        "/folder/a.dual.pdf",
      ]);
    });

    for (const change of ["path", "key", "stamp", "legacy"]) {
      it(`does not send a different or unverified PDF on resume (${change})`, async function () {
        let fresh = plan();
        const d = { ...deps(), inspect: async () => fresh };
        const first = new TranslationQueue(d);
        first.pause();
        first.add(entries, SETTINGS);
        const saved = JSON.parse(stored);
        assert.deepEqual(saved.items[0].source, entries[0].source);
        if (change === "legacy") delete saved.items[0].source;
        stored = JSON.stringify(saved);
        fresh = {
          ...plan(),
          ...(change === "path"
            ? { pdfPath: "/pdf/relinked.pdf" }
            : change === "key"
              ? { sourceKey: "OTHER" }
              : { sourceStamp: "replaced" }),
        };
        d.resolvePdfPath = async () => fresh.pdfPath;
        const restored = new TranslationQueue(d);
        restored.resume();
        await settle();
        assert.deepEqual(statuses(restored), ["failed"]);
        assert.match(parsedRow().error, /Add the document again/);
        assert.isEmpty(jobs);
        assert.isEmpty(
          removedDirs,
          "rejected before allocating an output directory",
        );
      });
    }

    it("pins the inspected bytes across job startup and rejects a replacement during the copy", async function () {
      const fs = await import("node:fs");
      const os = await import("node:os");
      const path = await import("node:path");
      const g = globalThis as any;
      const original = {
        Zotero: g.Zotero,
        IOUtils: g.IOUtils,
        PathUtils: g.PathUtils,
      };
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidea-queue-test"));
      try {
        const paper = path.join(root, "论文.pdf");
        const approved = "%PDF-1.4\nThe approved document";
        const replacement = "%PDF-1.4\nAnother document with other content";
        fs.writeFileSync(paper, approved);
        const attachment = {
          id: 1,
          key: "KEY1",
          libraryID: 1,
          isAttachment: () => true,
          isPDFAttachment: () => true,
          isStoredFileAttachment: () => false,
          getFilePath: () => paper,
        };
        g.Zotero = {
          Items: { get: () => attachment },
          File: {
            pathToFile: (p: string) => ({
              isFile: () => fs.statSync(p).isFile(),
              isSymlink: () => fs.lstatSync(p).isSymbolicLink(),
            }),
          },
        };
        g.PathUtils = {
          tempDir: root,
          filename: path.basename,
          join: path.join,
          isAbsolute: path.isAbsolute,
        };
        let race = false;
        g.IOUtils = {
          createUniqueDirectory: async (dir: string, prefix: string) =>
            fs.mkdtempSync(path.join(dir, prefix)),
          copy: async (src: string, dest: string) => {
            if (race) fs.writeFileSync(src, replacement);
            fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
          },
          read: async (p: string) => fs.readFileSync(p),
          stat: async (p: string) => {
            const stat = fs.statSync(p);
            return {
              type: "regular",
              size: stat.size,
              lastModified: stat.mtimeMs,
              creationTime: stat.birthtimeMs,
            };
          },
          remove: async (p: string) => fs.rmSync(p, { recursive: true }),
        };
        const fresh = () => {
          const s = fs.statSync(paper);
          return {
            ...plan(),
            pdfPath: paper,
            sourceStamp: `${s.size}:${s.mtimeMs}:${s.birthtimeMs}`,
          };
        };
        const { prepareQueueInput } =
          await import("../../src/modules/pdfTranslator/translationQueueService");
        const q = new TranslationQueue({
          ...deps(),
          resolvePdfPath: async () => paper,
          inspect: async () => fresh(),
          prepareInput: prepareQueueInput,
          publish: async () => ({ itemIDs: [], savedFiles: [] }),
        });
        q.add([{ ...entries[0], source: previewSource(fresh()) }], SETTINGS);
        await settle();
        assert.lengthOf(jobs, 1);
        const input = jobs[0].request.pdfPath;
        assert.notEqual(input, paper);
        assert.equal(path.basename(input), path.basename(paper));
        fs.writeFileSync(paper, replacement); // credentials/env are still being prepared
        assert.equal(fs.readFileSync(input, "utf8"), approved);
        jobs[0].finish({ status: "cancelled" });
        await settle();
        assert.isFalse(fs.existsSync(input));
        fs.writeFileSync(paper, approved);
        race = true;
        q.add([{ ...entries[0], source: previewSource(fresh()) }], SETTINGS);
        await settle();
        assert.deepEqual(statuses(q), ["cancelled", "failed"]);
        assert.lengthOf(
          jobs,
          1,
          "a changed source never went to the job runner",
        );
        assert.deepEqual(fs.readdirSync(root), [path.basename(paper)]);
      } finally {
        Object.assign(g, original);
        fs.rmSync(root, { recursive: true, force: true });
      }
    });

    for (const monoArrived of [false, true]) {
      it(`retains an incomplete result and regenerates just the live missing formats (mono arrived: ${monoArrived})`, async function () {
        const p = plan();
        p.cells[0].exists = false;
        p.generateKinds = ["mono", "dual"];
        let publications = 0;
        const checkpoints: string[][] = [];
        const d: QueueDeps = {
          ...deps(),
          inspect: async () => p,
          save(json) {
            stored = json;
            const pending = parsedRow()?.pendingDelivery;
            if (pending) checkpoints.push(pending.files);
          },
          async publish(plan, _files, _completed, receipt) {
            publications++;
            for (const { id } of plan.cells) receipt(id);
            return { itemIDs: [], savedFiles: [] };
          },
        };
        const first = new TranslationQueue(d);
        first.add(entries, SETTINGS);
        await settle();
        assert.include(jobs[0].request.options, {
          generateMono: true,
          generateDual: true,
        });
        const monoOnly = `${dir}/1.zh-CN.mono.pdf`;
        jobs[0].finish({
          status: "done",
          outputFiles: [monoOnly],
          progress: null,
        });
        await settle();
        assert.equal(publications, 0);
        assert.isEmpty(checkpoints);
        assert.include(parsedRow(), { status: "failed", retainedDir: dir });
        assert.match(parsedRow().error, /missing staged dual/i);
        assert.isEmpty(removedDirs);
        const restored = new TranslationQueue(d);
        if (monoArrived) {
          p.cells[0].exists = true;
          p.generateKinds = ["dual"];
        }
        restored.retryFailed();
        await settle();
        assert.lengthOf(jobs, 2);
        assert.include(jobs[1].request.options, {
          generateMono: !monoArrived,
          generateDual: true,
        });
        const nextDir = jobs[1].request.outputDir;
        jobs[1].finish({
          status: "done",
          progress: null,
          outputFiles: p.generateKinds.map(
            (k) => `${nextDir}/1.zh-CN.${k}.pdf`,
          ),
        });
        await settle();
        assert.equal(publications, 1);
        assert.deepEqual(statuses(restored), ["done"]);
        assert.equal(parsedRow().retainedDir, dir);
        assert.deepEqual(removedDirs, [nextDir]);
      });
    }

    it("retires an incomplete pre-upgrade manifest without borrowing generation consent from its filing plan", async function () {
      const old = plan();
      delete old.reservationToken;
      old.generateKinds = ["mono", "dual"];
      stored = JSON.stringify({
        items: [
          {
            ...SETTINGS,
            id: "legacy",
            attachmentID: 1,
            title: "A",
            status: "failed",
            percent: 100,
            pendingDelivery: {
              dir,
              files,
              plan: old,
              completed: ["dual:folder"],
            },
          },
        ],
      });
      let attempts = 0;
      const q = new TranslationQueue({
        ...deps(),
        inspect: async () => plan(),
        validateStaging: async () => true,
        async publish(p) {
          attempts++;
          assert.match(p.reservationToken!, /^[a-f0-9]{32}$/);
          assert.equal(
            parsedRow().pendingDelivery.plan.reservationToken,
            p.reservationToken,
          );
          throw new MissingStagedFormatError("mono");
        },
      });
      q.retryFailed();
      await settle();
      assert.notProperty(parsedRow(), "pendingDelivery");
      assert.include(parsedRow().error, "Add the document again");
      assert.equal(parsedRow().retainedDir, dir);
      q.retryFailed();
      await settle();
      assert.equal(attempts, 1);
      assert.deepEqual(statuses(q), ["failed"]);
      assert.isEmpty(jobs);
      assert.isEmpty(removedDirs);
    });

    for (const interrupt of ["publication error", "restart during filing"]) {
      it(`resumes only outstanding cells after ${interrupt}`, async function () {
        let calls = 0;
        let inspections = 0;
        const d: QueueDeps = {
          ...deps(),
          async inspect() {
            inspections++;
            return plan();
          },
          async validateStaging(d, paths) {
            return d === dir && paths.length === 1 && paths[0] === files[0];
          },
          async publish(_p, paths, completed, receipt) {
            calls++;
            assert.deepEqual(paths, files);
            assert.deepEqual(parsedRow().pendingDelivery, {
              plan: plan(),
              files,
              dir,
              completed,
            });
            if (calls === 1) {
              assert.deepEqual(completed, ["mono:library"]);
              receipt("dual:library", 27);
              assert.deepEqual(parsedRow().pendingDelivery.completed, [
                "mono:library",
                "dual:library",
              ]);
              if (interrupt === "publication error")
                throw new Error("disk full");
              await new Promise<never>(() => {}); // snapshot between two destination writes
            }
            assert.deepEqual(completed, ["mono:library", "dual:library"]);
            receipt("dual:folder");
            return { itemIDs: [], savedFiles: ["/folder/a.dual.pdf"] };
          },
        };
        const q = new TranslationQueue(d);
        q.add(entries, SETTINGS);
        await settle();
        jobs[0].finish(output);
        await settle();
        const row = q.getState().items[0];
        assert.equal(row.percent, 100);
        assert.equal(
          row.status,
          interrupt === "publication error" ? "failed" : "running",
        );
        assert.equal(row.filing, interrupt !== "publication error");
        assert.deepEqual(row.deliveryProgress, { done: 2, total: 3 });
        assert.isEmpty(removedDirs);

        missingPdf.add(1); // retry needs no source PDF, environment, or model
        otherRunning = true;
        const restored = new TranslationQueue(d);
        await settle();
        assert.equal(calls, 1);
        if (interrupt === "publication error") restored.retryFailed();
        else {
          assert.isTrue(restored.getState().paused);
          restored.resume();
        }
        await settle();
        assert.deepEqual(statuses(restored), ["done"]);
        assert.deepEqual(restored.getState().items[0].resultItemIDs, [27]);
        assert.deepEqual(restored.getState().items[0].deliveryProgress, {
          done: 3,
          total: 3,
        });
        assert.notProperty(parsedRow(), "pendingDelivery");
        assert.deepEqual(removedDirs, [dir]);
        assert.lengthOf(jobs, 1);
        assert.equal(inspections, 1);
      });
    }

    it("never treats 100% or a premature publisher return as proof all outputs were filed", async function () {
      const q = new TranslationQueue({
        ...deps(),
        inspect: async () => plan(),
        async publish(_p, _files, _completed, receipt) {
          receipt("dual:library", 27);
          return { itemIDs: [27], savedFiles: [] };
        },
      });
      q.add(entries, SETTINGS);
      await settle();
      jobs[0].emit(100);
      jobs[0].finish(output);
      await settle();
      assert.deepEqual(statuses(q), ["failed"]);
      assert.deepEqual(parsedRow().deliveryProgress, { done: 2, total: 3 });
      assert.include(parsedRow().error, "Incomplete publication");
      assert.isEmpty(removedDirs);
    });

    it("will not publish or clean up restored files outside verified staging, or regenerate them", async function () {
      const unsafe = [
        { dir, files, guard: undefined }, // no trusted root check on restore
        {
          dir: "/users/source",
          files: ["/users/source/paper.pdf"],
          guard: false,
        },
        { dir, files: [`${dir}/../paper.pdf`], guard: true },
        { dir, files: [`${dir}-other/paper.pdf`], guard: true },
        { dir, files: [`${dir}\\paper.pdf`], guard: true }, // POSIX sibling
        {
          dir: "/tmp/../users/source",
          files: ["/tmp/../users/source/paper.pdf"],
          guard: true,
        },
        { dir, files: [`${dir}/task.json`], guard: true },
        {
          dir: "C:\\queue\\abc",
          files: ["C:\\queue\\abc\\..\\other.pdf"],
          guard: true,
        },
      ];
      let publications = 0;
      for (const input of unsafe) {
        stored = JSON.stringify({
          items: [
            {
              ...SETTINGS,
              ...entries[0],
              id: "restore",
              status: "running",
              pendingDelivery: {
                plan: plan(),
                dir: input.dir,
                files: input.files,
                completed: [],
              },
            },
          ],
        });
        const q = new TranslationQueue({
          ...deps(),
          validateStaging:
            input.guard === undefined ? undefined : async () => input.guard!,
          async publish() {
            publications++;
            return { itemIDs: [], savedFiles: [] };
          },
        });
        q.resume();
        await settle();
        assert.deepEqual(statuses(q), ["failed"]);
      }
      assert.equal(publications, 0);
      assert.isEmpty(removedDirs);
      assert.isEmpty(jobs);
    });

    it("does not delete staged inputs until the terminal receipt is durable", async function () {
      let allowDone = false;
      const writes: string[] = [];
      const q = new TranslationQueue({
        ...deps(),
        inspect: async () => plan(),
        save(json) {
          if (!allowDone && JSON.parse(json).items[0]?.status === "done")
            throw new Error("cannot save completion");
          stored = json;
        },
        async publish(p, _files, completed, receipt) {
          for (const { id } of p.cells)
            if (!completed.includes(id)) {
              writes.push(id);
              receipt(id);
            }
          return { itemIDs: [], savedFiles: [] };
        },
      });
      q.add(entries, SETTINGS);
      await settle();
      jobs[0].finish(output);
      await settle();
      assert.deepEqual(statuses(q), ["failed"]);
      assert.deepEqual(parsedRow().deliveryProgress, { done: 3, total: 3 });
      assert.property(parsedRow(), "pendingDelivery");
      assert.isEmpty(removedDirs);
      allowDone = true;
      q.retryFailed();
      await settle();
      assert.deepEqual(statuses(q), ["done"]);
      assert.deepEqual(writes, ["dual:library", "dual:folder"]);
      assert.deepEqual(removedDirs, [dir]);
      assert.lengthOf(jobs, 1);
    });

    it("retains staged work and stops before the first write if the checkpoint cannot be saved", async function () {
      let writes = 0;
      let canSave = false;
      const p = plan();
      p.overwrite = true;
      const q = new TranslationQueue({
        ...deps(),
        inspect: async () => p,
        save(json) {
          if (!canSave && JSON.parse(json).items[0]?.pendingDelivery)
            throw new Error("preference unavailable");
          stored = json;
        },
        async publish(plan, _files, completed, receipt) {
          writes++;
          assert.isEmpty(completed, "overwrite must not reuse existing cells");
          for (const cell of plan.cells) receipt(cell.id);
          return { itemIDs: [], savedFiles: [] };
        },
      });
      q.add(entries, SETTINGS);
      await settle();
      jobs[0].finish(output);
      await settle();
      assert.deepEqual(statuses(q), ["failed"]);
      assert.equal(writes, 0);
      assert.isEmpty(removedDirs);
      canSave = true;
      q.retry(q.getState().items[0].id);
      await settle();
      assert.equal(writes, 1);
      assert.lengthOf(jobs, 1);
      assert.deepEqual(statuses(q), ["done"]);
    });
  });

  it("requeues all and only failed rows, preserving paused state and order", async function () {
    const q = new TranslationQueue(deps());
    q.add(
      [1, 2, 3, 4, 5].map((id) => ({
        attachmentID: id,
        title: `${id}`,
        alreadyTranslated: id === 5,
      })),
      SETTINGS,
    );
    await settle();
    jobs[0].finish({ status: "error", message: "damaged PDF" });
    await settle();
    jobs[1].finish(done("/tmp/out-1"));
    await settle();
    jobs[2].finish({ status: "cancelled" });
    await settle();
    jobs[3].finish({ status: "error", message: "missing font" });
    await settle();
    q.pause();
    for (const i of [1, 2, 4]) q.retry(q.getState().items[i].id);
    assert.deepEqual(statuses(q), [
      "failed",
      "done",
      "cancelled",
      "failed",
      "skipped",
    ]);
    q.retryFailed();
    assert.deepEqual(statuses(q), [
      "queued",
      "done",
      "cancelled",
      "queued",
      "skipped",
    ]);
    assert.isTrue(q.getState().paused);
    assert.lengthOf(jobs, 4);
    q.resume();
    await settle();
    assert.equal(jobs[4].request.pdfPath, "/pdf/1.pdf");
  });

  it("files a result with a few engine errors and flags it", async function () {
    const queue = new TranslationQueue(deps());
    queue.add([{ attachmentID: 1, title: "A" }], SETTINGS);
    await settle();
    jobs[0].finish({
      status: "done",
      outputFiles: ["/tmp/out-0/a.zh-CN.mono.pdf"],
      progress: {
        hasErrors: true,
        errorCount: 2,
        errorLines: ["ERROR timeout on paragraph 7"],
        translationStats: { total: 40, successful: 38, fallback: 2 },
      } as any,
    });
    await settle();
    const [item] = queue.getState().items;
    assert.equal(item.status, "done");
    assert.equal(item.warningCount, 2);
    assert.lengthOf(delivered, 1);
  });
});
