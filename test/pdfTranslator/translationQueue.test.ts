import { assert } from "chai";
import type { SavedTranslateOptions } from "../../src/modules/pdfTranslator/translatePrefs";
import type {
  TranslationJobHandle,
  TranslationJobOutcome,
  TranslationJobRequest,
} from "../../src/modules/pdfTranslator/translationJob";
import {
  classifyFailure,
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
  });

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
});
