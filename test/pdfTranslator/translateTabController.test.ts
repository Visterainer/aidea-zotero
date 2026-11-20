import { assert } from "chai";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import type { TranslateUICallback } from "../../src/modules/pdfTranslator/index";
import type {
  TranslateParams,
  TranslateState,
} from "../../src/modules/pdfTranslator/types";

type TabModule =
  typeof import("../../src/modules/pdfTranslator/translateTabController");
type Engine = NonNullable<Parameters<TabModule["initTranslateTab"]>[1]>;
type Inspector = Engine["inspectTranslationOutputs"];
type Plan = Awaited<ReturnType<Inspector>>;

// Isolate the tab from Zotero's filesystem/storage APIs; publishing semantics
// themselves are exercised in the shared output planner/publisher suite.
const planFor: Inspector = async (
  source,
  pdfPath,
  targetLang,
  kinds,
  output,
  overwrite,
) => {
  const destinations = [
    ...(output.attach ? ["attachment" as const] : []),
    ...(output.saveDir ? ["folder" as const] : []),
  ];
  return {
    sourceID: source?.id ?? null,
    libraryID: source?.libraryID ?? null,
    sourceKey: source?.key || "",
    pdfPath,
    targetLang,
    kinds,
    output,
    overwrite,
    cells: kinds.flatMap((kind) =>
      destinations.map((destination) => ({
        id: `${kind}:${destination}`,
        kind,
        destination,
        exists: false,
      })),
    ),
    generateKinds: [...kinds],
  };
};

function gate() {
  let open!: () => void;
  const wait = new Promise<void>((resolve) => (open = resolve));
  return { open, wait };
}

// Only the controls used in these flows are mounted. click awaits the actual
// listener, so tests can hold a preflight open without guessing timer delays.
class Control {
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  children: Control[] = [];
  textContent = "";
  onTitle?: (path: string) => void;
  set title(path: string) {
    this.onTitle?.(path);
  }
  disabled = false;
  checked = false;
  remove() {
    this.disabled = true;
  }
  value = "";
  click = async () => {};
  constructor(public id = "") {}
  closest() {
    return null;
  }
  querySelector() {
    return null;
  }
  setAttribute(key: string, value: string) {
    this.attrs[key] = value;
  }
  addEventListener(type: string, fn: () => Promise<void>) {
    if (type === "click") this.click = fn;
  }
  append(...nodes: Control[]) {
    this.children.push(...nodes);
  }
  appendChild(node: Control) {
    this.append(node);
  }
}

class Controller {
  state: TranslateState = "idle";
  stopped = gate();
  constructor(
    readonly emit: TranslateUICallback,
    private script: (
      controller: Controller,
      params: TranslateParams,
    ) => Promise<void>,
  ) {}
  getState() {
    return this.state;
  }
  setState(state: TranslateState) {
    this.state = state;
    this.emit({ type: "state", state });
  }
  start(params: TranslateParams) {
    return this.script(this, params);
  }
  pause() {
    if (this.state === "running") {
      this.setState("paused");
      this.stopped.open();
    }
  }
  abort() {
    this.setState("idle");
    this.stopped.open();
  }
}

describe("Translate tab job ownership", function () {
  let tab: TabModule;
  let job: typeof import("../../src/modules/pdfTranslator/translationJob");
  let work: string;
  let selected: ReturnType<typeof attachment>;
  let imported: { file: string; parentItemID: number }[];
  const prefs = new Map<string, unknown>();
  const globals = globalThis as any;
  const originals = new Map<string, unknown>();
  function attachment(name: string, parentItemID: number) {
    return {
      parentItemID,
      attachmentFilename: name,
      isAttachment: () => true,
      getFilePath: () => join(work, name),
      getFilePathAsync: async () => join(work, name),
    };
  }

  before(async function () {
    for (const key of ["Zotero", "ztoolkit", "PathUtils", "IOUtils"])
      originals.set(key, globals[key]);
    globals.Zotero = {
      locale: "en-US",
      Prefs: {
        get: (k: string) => prefs.get(k),
        set: (k: string, v: unknown) => prefs.set(k, v),
      },
      getActiveZoteroPane: () => ({ getSelectedItems: () => [selected] }),
      Items: { get: () => null },
      Attachments: {
        LINK_MODE_LINKED_FILE: 2,
        importFromFile: async (options: (typeof imported)[number]) => {
          await fs.copyFile(options.file, join(work, "filed.pdf"));
          imported.push(options);
          return { hasTag: () => true };
        },
      },
    };
    globals.ztoolkit = { log: () => {}, getGlobal: () => undefined };
    globals.PathUtils = {
      get tempDir() {
        return work;
      },
      join,
      parent: dirname,
    };
    globals.IOUtils = {
      exists: async (p: string) =>
        fs.access(p).then(
          () => true,
          () => false,
        ),
      makeDirectory: (p: string) => fs.mkdir(p, { recursive: true }),
      getChildren: (p: string) => fs.readdir(p),
      remove: async (p: string, opts?: { recursive?: boolean }) => {
        if ((await fs.stat(p)).isDirectory() && !opts?.recursive)
          return fs.rmdir(p);
        return fs.rm(p, { recursive: !!opts?.recursive });
      },
    };
    tab =
      await import("../../src/modules/pdfTranslator/translateTabController");
    job = await import("../../src/modules/pdfTranslator/translationJob");
  });

  after(function () {
    for (const [key, value] of originals) globals[key] = value;
  });

  beforeEach(async function () {
    prefs.clear();
    imported = [];
    work = await fs.mkdtemp(join(tmpdir(), "aidea-tab-"));
    selected = attachment("A.pdf", 11);
    for (const name of ["A.pdf", "B.pdf"])
      await fs.writeFile(join(work, name), name);
  });

  afterEach(async function () {
    await fs.rm(work, { recursive: true, force: true });
  });

  function panel(
    script: ConstructorParameters<typeof Controller>[1],
    overrides: Partial<Engine> = {},
    confirm = (_message: string) => false,
  ) {
    const ids = [
      "model",
      "start",
      "clear",
      "pause",
      "pdf-name",
      "console",
      "console-toggle",
      "console-body",
      "output-dir",
      "output-save-dir",
      "output-attach",
      "mono",
      "dual",
      "overwrite",
    ];
    const fields = Object.fromEntries(
      ids.map((k) => [k, new Control(`llm-tr-${k}`)]),
    );
    const show = new Control("llm-tab-btn-translate");
    const controls = new Map(
      [...Object.values(fields), show].map((c) => [`#${c.id}`, c]),
    );
    const body = {
      querySelector: (selector: string) => controls.get(selector) ?? null,
      ownerDocument: {
        createElement: () => new Control(),
        defaultView: { confirm },
      },
    };
    fields.model.dataset.value = "model";
    fields["output-attach"].checked =
      prefs.get("extensions.zotero.aidea.translate.outputAttach") !== false;
    const sources = new WeakMap<Plan, Zotero.Item | null>();
    tab.initTranslateTab(body as unknown as Element, {
      inspectTranslationOutputs: async (...args) => {
        const plan = await planFor(...args);
        sources.set(plan, args[0]);
        return plan;
      },
      publishTranslationOutputs: async (plan, files) => {
        assert.isTrue(plan.output.attach);
        for (const file of files)
          await globals.Zotero.Attachments.importFromFile({
            file,
            parentItemID: sources.get(plan)?.parentItemID,
          });
        return { itemIDs: [1], savedFiles: [] };
      },
      resolveTranslationCredentials: async () => ({
        creds: {
          apiKey: "k",
          apiUrl: "https://example.invalid",
          modelId: "model",
        },
        authMode: "API Key",
        reasoningEffort: "",
      }),
      checkTranslationEnvironment: async () => ({
        ok: true,
        env: {
          status: "ready",
          venvDir: "/env",
          pdf2zhBin: "pdf2zh",
          pythonBin: "python",
        },
      }),
      createController: async (emit) => new Controller(emit, script),
      ...overrides,
    });
    return {
      fields,
      async select(item: typeof selected) {
        selected = item;
        const refreshed = gate();
        fields["pdf-name"].onTitle = (path) => {
          if (path === item.getFilePath()) refreshed.open();
        };
        await show.click();
        await refreshed.wait;
      },
      logs: () =>
        fields["console-body"].children
          .map((line) => line.children[1].textContent)
          .join("\n"),
    };
  }

  it("pins file and parent at Start; another tab and a queue job cannot enter during attachment lookup", async function () {
    const hold = gate(),
      entered = gate();
    const a = selected;
    a.getFilePathAsync = async () => {
      entered.open();
      await hold.wait;
      return a.getFilePath();
    };
    const inputs: string[] = [];
    const p = panel(async (c, params) => {
      inputs.push(params.pdfPath);
      await fs.writeFile(
        join(params.outputDir, "A.zh-CN.mono.pdf"),
        basename(params.pdfPath),
      );
      c.emit({
        type: "progress",
        data: {
          status: "done",
          progress: 100,
          message: "",
          outputFiles: ["A.zh-CN.mono.pdf"],
        },
      });
      c.setState("done");
    });
    const second = panel(async () => {
      inputs.push("unexpected");
    });
    await second.select(a);
    await p.select(a);
    p.fields.dual.checked = false;
    const run = p.fields.start.click();
    await entered.wait;
    try {
      await p.select(attachment("B.pdf", 22));
      assert.isTrue(job.isTranslationRunning());
      await second.fields.start.click();
      assert.include(second.logs(), "already running");
      const attempt = job.startTranslationJob({
        pdfPath: "",
        outputDir: "",
        options: {} as never,
        modelName: "",
      });
      assert.deepInclude(await attempt.done, {
        status: "blocked",
        reason: "busy",
      });
    } finally {
      hold.open();
      await run;
    }
    assert.deepEqual(inputs, [a.getFilePath()]);
    assert.include(p.logs(), a.getFilePath());
    assert.deepEqual(
      imported.map((i) => i.parentItemID),
      [11],
    );
    assert.equal(await fs.readFile(join(work, "filed.pdf"), "utf8"), "A.pdf");
    assert.isFalse(await globals.IOUtils.exists(dirname(imported[0].file)));
    assert.isFalse(job.isTranslationRunning());
  });

  it("releases on a destination refusal and auto-expands the console accessibly", async function () {
    prefs.set("extensions.zotero.aidea.translate.consoleCollapsed", true);
    prefs.set("extensions.zotero.aidea.translate.outputAttach", false);
    const p = panel(async () => assert.fail("must not launch"));
    await p.select(selected);
    const toggle = p.fields["console-toggle"];
    assert.equal(toggle.attrs["aria-expanded"], "false");
    await p.fields.start.click();
    assert.equal(toggle.attrs["aria-expanded"], "true");
    assert.equal(toggle.dataset.collapsed, "false");
    assert.equal(p.fields.console.style.display, "");
    assert.isFalse(job.isTranslationRunning());
    assert.isFalse(p.fields.start.disabled);
  });

  it("does not drop an idle controller's reservation; an early engine return restores controls", async function () {
    const hold = gate(),
      entered = gate();
    const p = panel(async (c) => {
      entered.open();
      await hold.wait;
      c.emit({ type: "error", message: "env changed" });
    });
    await p.select(selected);
    const run = p.fields.start.click();
    await entered.wait;
    try {
      assert.isTrue(job.isTranslationRunning());
      assert.isTrue(p.fields.pause.disabled);
      await p.fields.clear.click();
      assert.isTrue(job.isTranslationRunning());
    } finally {
      hold.open();
      await run;
    }
    assert.equal(p.fields.start.style.display, "");
    assert.equal(p.fields.pause.style.display, "none");
    assert.include(p.logs(), "env changed");
    assert.isFalse(job.isTranslationRunning());
  });

  it("busy and failed resumes leave a paused document resumable after selection changes", async function () {
    const running = gate();
    const processExited = gate();
    const paths: string[] = [];
    let deny = false;
    const p = panel(
      async (c, params) => {
        paths.push(params.pdfPath);
        if (paths.length === 1) {
          c.setState("running");
          running.open();
          await c.stopped.wait;
          await processExited.wait;
        } else {
          c.setState("error");
        }
      },
      {
        checkTranslationEnvironment: async () =>
          deny
            ? { ok: false, reason: "needs_repair", detail: "repair" }
            : {
                ok: true,
                env: {
                  status: "ready",
                  venvDir: "/env",
                  pdf2zhBin: "pdf2zh",
                  pythonBin: "python",
                },
              },
      },
    );
    const a = selected;
    await p.select(a);
    const run = p.fields.start.click();
    await running.wait;
    await p.fields.pause.click();
    try {
      assert.isTrue(
        job.isTranslationRunning(),
        "paused subprocess has not exited yet",
      );
      await p.fields.pause.click();
      assert.lengthOf(paths, 1);
    } finally {
      processExited.open();
      await run;
    }
    assert.isFalse(job.isTranslationRunning());
    await p.select(attachment("B.pdf", 22));
    const release = job.tryReserveTranslation()!;
    try {
      await p.fields.pause.click();
    } finally {
      release();
    }
    deny = true;
    await p.fields.pause.click();
    assert.include(p.fields.pause.textContent, "Resume");
    assert.isFalse(job.isTranslationRunning());
    deny = false;
    await p.fields.pause.click();
    assert.deepEqual(paths, [a.getFilePath(), a.getFilePath()]);
    assert.equal(p.fields.start.style.display, "");
  });

  it("validates the requested formats, destinations and explicit folder before inspection", async function () {
    let inspections = 0,
      launches = 0;
    const p = panel(async () => void launches++, {
      inspectTranslationOutputs: async (...args) => {
        inspections++;
        return planFor(...args);
      },
    });
    await p.select(selected);
    const f = p.fields;
    f.mono.checked = f.dual.checked = false;
    await f.start.click();
    f.mono.checked = true;
    f["output-attach"].checked = false;
    f["output-dir"].value = join(work, "unchecked");
    await f.start.click();
    f["output-attach"].checked = f["output-save-dir"].checked = true;
    f["output-dir"].value = "  ";
    await f.start.click();
    assert.equal(inspections, 0);
    assert.equal(launches, 0);
    assert.isFalse(job.isTranslationRunning());
  });

  it("never publishes a disk-only PDF to Zotero or to an unchecked remembered folder", async function () {
    const plans: Plan[] = [];
    const params: TranslateParams[] = [];
    const p = panel(
      async (_c, req) => {
        params.push(req);
      },
      {
        inspectTranslationOutputs: async (...args) => {
          const plan = await planFor(...args);
          plans.push(plan);
          return plan;
        },
      },
    );
    await p.select(selected);
    // The chosen path has no matching Zotero attachment.
    selected = attachment("B.pdf", 22);
    const folder = join(work, "picked");
    p.fields["output-dir"].value = folder;
    await p.fields.start.click();
    assert.isEmpty(plans);
    p.fields["output-save-dir"].checked = true;
    await p.fields.start.click();
    assert.lengthOf(params, 1);
    assert.isNull(plans[0].sourceID);
    assert.deepEqual(plans[0].output, { attach: false, saveDir: folder });
    assert.notEqual(params[0].outputDir, folder);
    assert.isFalse(await globals.IOUtils.exists(folder));
  });

  it("needs neither model credentials nor an engine for full coverage; partial coverage generates only the missing kind", async function () {
    let full = true,
      credentials = 0;
    const requests: TranslateParams[] = [];
    const p = panel(
      async (_c, req) => {
        requests.push(req);
      },
      {
        inspectTranslationOutputs: async (...args) => {
          const plan = await planFor(...args);
          for (const cell of plan.cells)
            cell.exists = full || cell.kind === "mono";
          plan.generateKinds = full ? [] : ["dual"];
          return plan;
        },
        resolveTranslationCredentials: async () => {
          credentials++;
          return {
            creds: {
              apiKey: "k",
              apiUrl: "https://example.invalid",
              modelId: "model",
            },
            authMode: "API Key",
            reasoningEffort: "",
          };
        },
      },
    );
    await p.select(selected);
    await p.fields.start.click();
    assert.equal(credentials, 0);
    assert.isEmpty(requests);
    assert.include(p.logs(), "Skipped");
    full = false;
    await p.fields.start.click();
    assert.lengthOf(requests, 1);
    assert.deepInclude(requests[0], {
      generateMono: false,
      generateDual: true,
    });
    assert.isTrue(
      p.fields.mono.checked,
      "narrowing the job must not change the format preference",
    );
  });

  it("asks once only for actual replacements and consumes overwrite even on decline", async function () {
    let approve = false,
      exists = true;
    const prompts: string[] = [];
    const overwriteFlags: boolean[] = [];
    const runs: TranslateParams[] = [];
    const p = panel(
      async (_c, params) => {
        runs.push(params);
      },
      {
        inspectTranslationOutputs: async (...args) => {
          const plan = await planFor(...args);
          overwriteFlags.push(plan.overwrite);
          for (const cell of plan.cells) cell.exists = exists;
          plan.generateKinds = !plan.overwrite && exists ? [] : plan.kinds;
          return plan;
        },
      },
      (message) => {
        prompts.push(message);
        return approve;
      },
    );
    await p.select(selected);
    p.fields.overwrite.checked = true;
    await p.fields.start.click();
    assert.isEmpty(runs);
    await p.fields.start.click(); // protected again
    approve = p.fields.overwrite.checked = true;
    await p.fields.start.click();
    exists = false;
    p.fields.overwrite.checked = true;
    await p.fields.start.click();
    assert.deepEqual(overwriteFlags, [true, false, true, true]);
    assert.lengthOf(prompts, 2);
    assert.lengthOf(runs, 2);
  });

  it("retries only failed filing cells for the original task even after a source change", async function () {
    const filename = "A.zh-CN.mono.pdf";
    const stage: string[] = [];
    const attempts: { plan: Plan; files: string[]; completed: string[] }[] = [];
    const p = panel(
      async (c, req) => {
        stage.push(req.outputDir);
        await fs.writeFile(join(req.outputDir, filename), "only copy");
        c.emit({
          type: "progress",
          data: {
            status: "done",
            progress: 100,
            message: "",
            outputFiles: [filename],
          },
        });
        c.setState("done");
      },
      {
        publishTranslationOutputs: async (plan, files, completed, onCell) => {
          attempts.push({ plan, files, completed: [...completed] });
          if (attempts.length === 1) {
            onCell(plan.cells[0].id, 101);
            throw Error("folder is read-only");
          }
          onCell(plan.cells[1].id);
          return {
            itemIDs: [101],
            savedFiles: [join(plan.output.saveDir, filename)],
          };
        },
      },
    );
    await p.select(selected);
    const a = selected.getFilePath();
    p.fields.dual.checked = false;
    p.fields["output-save-dir"].checked = true;
    p.fields["output-dir"].value = join(work, "folder");
    await p.fields.start.click();
    assert.lengthOf(attempts, 1);
    assert.notEqual(stage[0], p.fields["output-dir"].value);
    assert.equal(
      await fs.readFile(join(stage[0], filename), "utf8"),
      "only copy",
    );
    assert.include(p.logs(), "folder is read-only");
    await p.select(attachment("B.pdf", 22));
    const retry = p.fields["console-body"].children
      .flatMap((line) => line.children)
      .find((c) => c.textContent === "Retry")!;
    const release = job.tryReserveTranslation()!;
    try {
      await retry.click();
    } finally {
      release();
    }
    assert.lengthOf(attempts, 1);
    await retry.click();
    assert.lengthOf(attempts, 2);
    assert.lengthOf(stage, 1);
    assert.strictEqual(attempts[1].plan, attempts[0].plan);
    assert.equal(attempts[1].plan.pdfPath, a);
    assert.deepEqual(attempts[1].completed, [attempts[0].plan.cells[0].id]);
    assert.deepEqual(attempts[1].files, [join(stage[0], filename)]);
    assert.isFalse(await globals.IOUtils.exists(stage[0]));
  });

  for (const diagnostic of [
    "HTTP 401 Unauthorized",
    "Error code: 429",
    "HTTP/1.1 503 Service Unavailable",
  ]) {
    it(`retains the staged PDF and refuses an approved overwrite after ${diagnostic}`, async function () {
      let calls = 0;
      let staged = "";
      const p = panel(
        async (c, req) => {
          const name = "A.zh-CN.mono.pdf";
          staged = join(req.outputDir, name);
          await fs.writeFile(staged, "incomplete");
          c.emit({
            type: "progress",
            data: {
              status: "done",
              progress: 100,
              message: "Translation complete",
              outputFiles: [name],
              hasErrors: true,
              errorLines: [diagnostic],
            },
          });
          c.setState("done");
        },
        {
          inspectTranslationOutputs: async (...args) => {
            const plan = await planFor(...args);
            plan.cells.forEach((c) => (c.exists = true));
            return plan;
          },
          publishTranslationOutputs: async () => {
            calls++;
            return { savedFiles: [], itemIDs: [] };
          },
        },
        () => true,
      );
      await p.select(selected);
      p.fields.dual.checked = false;
      p.fields.overwrite.checked = true;
      await p.fields.start.click();
      assert.equal(calls, 0);
      assert.equal(await fs.readFile(staged, "utf8"), "incomplete");
      assert.include(p.logs(), diagnostic);
    });
  }

  it("rejects a manifest outside the private stage without filing or deleting any PDFs", async function () {
    const outside = selected.getFilePath();
    let dir = "";
    const p = panel(async (c, req) => {
      dir = req.outputDir;
      await fs.writeFile(join(dir, "only.pdf"), "generated");
      c.emit({
        type: "progress",
        data: {
          status: "done",
          progress: 100,
          message: "",
          outputFiles: [outside],
        },
      });
      c.setState("done");
    });
    await p.select(selected);
    await p.fields.start.click();
    assert.isEmpty(imported);
    assert.equal(await fs.readFile(outside, "utf8"), "A.pdf");
    assert.equal(await fs.readFile(join(dir, "only.pdf"), "utf8"), "generated");
  });

  for (const manifest of [false, true]) {
    it(
      manifest
        ? "keeps an unreported glossary beside delivered PDFs"
        : "keeps the sole PDF on forced done without a final progress record",
      async function () {
        let dir = "";
        const p = panel(async (c, params) => {
          dir = params.outputDir;
          await fs.writeFile(join(dir, "A.zh-CN.mono.pdf"), "only copy");
          if (manifest) {
            await fs.writeFile(join(dir, "terms.glossary.csv"), "terms");
            c.emit({
              type: "progress",
              data: {
                status: "done",
                progress: 100,
                message: "",
                outputFiles: ["A.zh-CN.mono.pdf"],
              },
            });
          }
          c.setState("done");
        });
        await p.select(selected);
        p.fields.dual.checked = false;
        await p.fields.start.click();
        assert.include(p.logs(), dir);
        if (manifest) {
          assert.equal(
            await fs.readFile(join(dir, "terms.glossary.csv"), "utf8"),
            "terms",
          );
          assert.equal(
            await fs.readFile(join(work, "filed.pdf"), "utf8"),
            "only copy",
          );
          assert.isFalse(
            await globals.IOUtils.exists(join(dir, "A.zh-CN.mono.pdf")),
          );
        } else {
          assert.isEmpty(imported);
          assert.equal(
            await fs.readFile(join(dir, "A.zh-CN.mono.pdf"), "utf8"),
            "only copy",
          );
        }
      },
    );
  }
});
