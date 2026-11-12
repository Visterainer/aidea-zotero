import { assert } from "chai";

import type { TranslateEvent } from "../../src/modules/pdfTranslator/index";
import type { SavedTranslateOptions } from "../../src/modules/pdfTranslator/translatePrefs";
import type {
  TranslationControllerLike,
  TranslationJobDeps,
} from "../../src/modules/pdfTranslator/translationJob";
import type {
  TranslateParams,
  TranslateState,
} from "../../src/modules/pdfTranslator/types";

const PREFIX = "extensions.zotero.aidea.";

class FakeController implements TranslationControllerLike {
  state: TranslateState = "idle";
  params: TranslateParams | null = null;
  aborted = false;
  private finish: (() => void) | null = null;

  constructor(
    private emit: (event: TranslateEvent) => void,
    private script: (controller: FakeController) => void | Promise<void>,
  ) {}

  getState(): TranslateState {
    return this.state;
  }

  setState(state: TranslateState): void {
    this.state = state;
    this.emit({ type: "state", state });
  }

  send(event: TranslateEvent): void {
    this.emit(event);
  }

  /** Keep `start` pending until `abort` is called. */
  waitForAbort(): Promise<void> {
    return new Promise((resolve) => {
      this.finish = resolve;
    });
  }

  async start(params: TranslateParams): Promise<void> {
    this.params = params;
    this.setState("running");
    await this.script(this);
  }

  abort(): void {
    this.aborted = true;
    this.setState("idle");
    this.finish?.();
  }
}

describe("pdfTranslator translation job", function () {
  let job: typeof import("../../src/modules/pdfTranslator/translationJob");
  let prefsModule: typeof import("../../src/modules/pdfTranslator/translatePrefs");
  let previousZotero: unknown;
  const prefs = new Map<string, unknown>();
  let controllers: FakeController[] = [];

  const options = (): SavedTranslateOptions =>
    prefsModule.readSavedTranslateOptions();

  const deps = (
    script: (controller: FakeController) => void | Promise<void>,
    overrides: Partial<TranslationJobDeps> = {},
  ): TranslationJobDeps => ({
    resolveCredentials: async (modelName) => ({
      creds: {
        modelId: `${modelName}-resolved`,
        apiKey: "key",
        apiUrl: "https://example.invalid/v1",
      },
      authMode: "API Key",
      reasoningEffort: "",
    }),
    checkEnvironment: async () => ({
      ok: true,
      env: {
        status: "ready",
        venvDir: "/env",
        pdf2zhBin: "/env/bin/pdf2zh",
        pythonBin: "/env/bin/python",
      },
    }),
    createController: (callback) => {
      const controller = new FakeController(callback, script);
      controllers.push(controller);
      return controller;
    },
    joinPath: (dir, name) => `${dir}/${name}`,
    ...overrides,
  });

  const request = () => ({
    pdfPath: "/papers/Paper A.pdf",
    outputDir: "/tmp/out",
    modelName: "gpt-test",
    providerId: "p1",
    options: options(),
  });

  before(async function () {
    previousZotero = (globalThis as any).Zotero;
    (globalThis as any).Zotero = {
      Prefs: {
        get: (key: string) => prefs.get(key),
        set: (key: string, value: unknown) => prefs.set(key, value),
      },
    };
    prefsModule =
      await import("../../src/modules/pdfTranslator/translatePrefs");
    job = await import("../../src/modules/pdfTranslator/translationJob");
  });

  after(function () {
    (globalThis as any).Zotero = previousZotero;
  });

  beforeEach(function () {
    prefs.clear();
    controllers = [];
  });

  it("reads the tab's defaults when nothing was saved", function () {
    const saved = options();
    assert.equal(saved.sourceLang, "en");
    assert.equal(saved.targetLang, "zh-CN");
    assert.isTrue(saved.generateMono);
    assert.isTrue(saved.generateDual);
    assert.equal(saved.qps, 10);
    assert.equal(saved.poolMaxWorker, 1);
    assert.equal(saved.fontFamily, "auto");
    assert.isFalse(saved.ocr);
  });

  it("reads saved options with the tab's pref keys and clamps numbers", function () {
    prefs.set(`${PREFIX}translate.sourceLang`, "ja");
    prefs.set(`${PREFIX}translate.targetLang`, "en");
    prefs.set(`${PREFIX}translate.outputMono`, false);
    prefs.set(`${PREFIX}translate.qps`, "500");
    prefs.set(`${PREFIX}translate.poolMaxWorker`, "4");
    prefs.set(`${PREFIX}translate.fontFamily`, "serif");
    prefs.set(`${PREFIX}lastUsedModelName.translate`, " model-x ");
    prefs.set(`${PREFIX}lastUsedModelProvider.translate`, "prov");

    const saved = options();
    assert.equal(saved.sourceLang, "ja");
    assert.equal(saved.targetLang, "en");
    assert.isFalse(saved.generateMono);
    assert.isTrue(saved.generateDual);
    assert.equal(saved.qps, 100);
    assert.equal(saved.poolMaxWorker, 4);
    assert.equal(saved.fontFamily, "serif");
    assert.equal(prefsModule.getPersistedTranslateModel(), "model-x");
    assert.equal(prefsModule.getPersistedTranslateProvider(), "prov");
  });

  it("builds engine parameters with the fixed layout choices", function () {
    const params = job.buildTranslateParams({
      pdfPath: "/a.pdf",
      outputDir: "/out",
      modelId: "m",
      options: { ...options(), generateDual: false, ocr: true },
    });
    assert.include(params, {
      pdfPath: "/a.pdf",
      outputDir: "/out",
      modelId: "m",
      sourceLang: "en",
      targetLang: "zh-CN",
      generateMono: true,
      generateDual: false,
      ocr: true,
      noWatermark: true,
      dualMode: "LR",
      transFirst: false,
      skipClean: false,
    });
  });

  it("runs a job and returns absolute output paths", async function () {
    const events: string[] = [];
    const handle = job.startTranslationJob(
      request(),
      (event) => events.push(event.type),
      deps((controller) => {
        controller.send({
          type: "progress",
          data: {
            status: "done",
            progress: 100,
            message: "Translation complete",
            outputFiles: ["Paper A.no_watermark.zh-CN.mono.pdf", "/abs/x.pdf"],
          },
        });
        controller.setState("done");
      }),
    );
    assert.isTrue(job.isTranslationRunning());
    const outcome = await handle.done;

    assert.equal(outcome.status, "done");
    if (outcome.status !== "done") return;
    assert.deepEqual(outcome.outputFiles, [
      "/tmp/out/Paper A.no_watermark.zh-CN.mono.pdf",
      "/abs/x.pdf",
    ]);
    assert.equal(controllers[0].params?.modelId, "gpt-test-resolved");
    assert.equal(controllers[0].params?.outputDir, "/tmp/out");
    assert.include(events, "progress");
    assert.isFalse(job.isTranslationRunning());
  });

  it("refuses to start while another translation is running", async function () {
    const first = job.startTranslationJob(
      request(),
      undefined,
      deps((controller) => controller.waitForAbort()),
    );
    const second = job.startTranslationJob(
      request(),
      undefined,
      deps(() => assert.fail("second job must not start")),
    );

    assert.deepEqual(await second.done, {
      status: "blocked",
      reason: "busy",
      detail: "",
    });
    first.cancel();
    assert.deepEqual(await first.done, { status: "cancelled" });
    assert.isFalse(job.isTranslationRunning());
  });

  it("treats a tab-owned running controller as busy", async function () {
    let state: TranslateState = "running";
    job.trackTranslationController({ getState: () => state });

    const blocked = job.startTranslationJob(
      request(),
      undefined,
      deps(() => assert.fail("must not start")),
    );
    assert.deepInclude(await blocked.done, { reason: "busy" });

    state = "paused";
    assert.isFalse(job.isTranslationRunning());
  });

  it("reports a missing model, bad credentials and an unready environment", async function () {
    const noModel = await job.startTranslationJob(
      { ...request(), modelName: "" },
      undefined,
      deps(() => undefined),
    ).done;
    assert.deepInclude(noModel, { status: "blocked", reason: "no_model" });

    const credentials = await job.startTranslationJob(
      request(),
      undefined,
      deps(() => undefined, {
        resolveCredentials: async () => {
          throw new Error("no token");
        },
      }),
    ).done;
    assert.deepEqual(credentials, {
      status: "blocked",
      reason: "credentials",
      detail: "no token",
    });

    const notReady = await job.startTranslationJob(
      request(),
      undefined,
      deps(() => undefined, {
        checkEnvironment: async () => ({
          ok: false,
          reason: "not_ready",
          status: "no_venv",
          diagnostics: ["uv missing"],
        }),
      }),
    ).done;
    assert.deepEqual(notReady, {
      status: "blocked",
      reason: "env_not_ready",
      detail: "no_venv\nuv missing",
    });

    const repair = await job.startTranslationJob(
      request(),
      undefined,
      deps(() => undefined, {
        checkEnvironment: async () => ({
          ok: false,
          reason: "needs_repair",
          detail: "import failed",
        }),
      }),
    ).done;
    assert.deepInclude(repair, { reason: "env_needs_repair" });
    assert.lengthOf(controllers, 0);
    assert.isFalse(job.isTranslationRunning());
  });

  it("returns the engine's error message when the job fails", async function () {
    const failed = await job.startTranslationJob(
      request(),
      undefined,
      deps((controller) => {
        controller.setState("error");
        controller.send({ type: "error", message: "Bridge exploded" });
      }),
    ).done;
    assert.deepEqual(failed, { status: "error", message: "Bridge exploded" });

    const thrown = await job.startTranslationJob(
      request(),
      undefined,
      deps(() => {
        throw new Error("cannot launch");
      }),
    ).done;
    assert.deepEqual(thrown, { status: "error", message: "cannot launch" });
    assert.isFalse(job.isTranslationRunning());
  });

  it("survives a throwing progress listener", async function () {
    const outcome = await job.startTranslationJob(
      request(),
      () => {
        throw new Error("listener bug");
      },
      deps((controller) => controller.setState("done")),
    ).done;
    assert.deepEqual(outcome, {
      status: "done",
      outputFiles: [],
      progress: null,
    });
  });
});
