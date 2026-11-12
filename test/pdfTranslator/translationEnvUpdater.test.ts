import { assert } from "chai";
import {
  BUNDLED_ENV_MANIFEST,
  BUNDLED_ENV_REQUIREMENTS,
} from "../../src/modules/pdfTranslator/bundledEnvironment";

describe("translation environment updater", function () {
  let inspect: typeof import("../../src/modules/pdfTranslator/translationEnvUpdater").inspectTranslationEnvironment;
  let installOrUpdate: typeof import("../../src/modules/pdfTranslator/translationEnvUpdater").installOrUpdateTranslationEnvironment;
  const original: Record<string, unknown> = {};
  const prefs = new Map<string, string>();
  const files = new Map<string, string>();
  const removed: string[] = [];
  let children: string[] = [];
  let installSucceeds = false;
  let failingSource = "";
  let probeOutput = "";
  const scripts: string[] = [];
  const oldDir = "/tmp/aidea-test-profile/aidea-translate-env-r0-old";

  before(async function () {
    for (const name of [
      "Zotero",
      "IOUtils",
      "PathUtils",
      "Components",
      "fetch",
      "ztoolkit",
    ]) {
      original[name] = (globalThis as any)[name];
    }
    (globalThis as any).Zotero = {
      isWin: false,
      isMac: true,
      Profile: { dir: "/tmp/aidea-test-profile" },
      DataDirectory: { dir: "/tmp/aidea-test-data" },
      Prefs: {
        get(key: string) {
          return prefs.get(key) || "";
        },
        set(key: string, value: string) {
          prefs.set(key, value);
        },
      },
    };
    (globalThis as any).PathUtils = {
      join: (...parts: string[]) => parts.join("/"),
      tempDir: "/tmp",
    };
    (globalThis as any).IOUtils = {
      exists: async (path: string) =>
        files.has(path) ||
        path === "/tmp/aidea-test-home/.local/bin/uv" ||
        (installSucceeds && /\/bin\/(python|pdf2zh_next)$/.test(path)),
      getChildren: async () => children,
      read: async () => new Uint8Array([35, 33]),
      readUTF8: async (path: string) => files.get(path) || "",
      writeUTF8: async (path: string, contents: string) => {
        files.set(path, contents);
      },
      remove: async (path: string) => {
        removed.push(path);
        files.delete(path);
      },
    };
    (globalThis as any).Components = {
      interfaces: { nsIFile: {}, nsIProcess: {}, nsIEnvironment: {} },
      classes: {
        "@mozilla.org/process/environment;1": {
          getService: () => ({
            get: (name: string) =>
              name === "HOME" ? "/tmp/aidea-test-home" : "",
          }),
        },
        "@mozilla.org/file/local;1": {
          createInstance: () => ({
            path: "",
            initWithPath(path: string) {
              this.path = path;
            },
          }),
        },
        "@mozilla.org/process/util;1": {
          createInstance: () => ({
            path: "",
            exitValue: 0,
            init(file: { path: string }) {
              this.path = file.path;
            },
            runAsync(
              args: string[],
              _count: number,
              observer: { observe: (subject: null, topic: string) => void },
            ) {
              const script = files.get(args[0]) || "";
              scripts.push(script);
              const log = script.match(/2>"([^"]+)"/)?.[1];
              if (log && script.includes("uname -m")) {
                files.set(log, probeOutput);
              }
              const usesMirror = script.includes("UV_DEFAULT_INDEX");
              const sourceFails =
                script.includes("'sync'") &&
                failingSource === (usesMirror ? "mirror" : "official");
              this.exitValue =
                (!installSucceeds && script.includes("'sync'")) || sourceFails
                  ? 1
                  : 0;
              observer.observe(null, "process-finished");
            },
          }),
        },
      },
    };
    (globalThis as any).fetch = async () => {
      throw new Error("offline");
    };
    const AbortControllerCtor = globalThis.AbortController;
    (globalThis as any).ztoolkit = {
      getGlobal: (name: string) =>
        name === "AbortController"
          ? AbortControllerCtor
          : name === "fetch"
            ? (globalThis as any).fetch
            : undefined,
    };
    const module =
      await import("../../src/modules/pdfTranslator/translationEnvUpdater");
    inspect = module.inspectTranslationEnvironment;
    installOrUpdate = module.installOrUpdateTranslationEnvironment;
  });

  after(function () {
    for (const [name, value] of Object.entries(original)) {
      (globalThis as any)[name] = value;
    }
  });

  beforeEach(function () {
    prefs.clear();
    files.clear();
    removed.length = 0;
    children = [];
    installSucceeds = false;
    failingSource = "";
    probeOutput = "";
    scripts.length = 0;
    (globalThis as any).Zotero.locale = "en-US";
  });

  it("uses the bundled catalog while offline and shows installation for a missing environment", async function () {
    const state = await inspect(true);
    assert.equal(state.action, "install");
    assert.equal(state.targetRevision, BUNDLED_ENV_MANIFEST.revision);
    assert.include(state.warning || "", "offline");
  });

  it("uses Zotero's window globals when AbortController is absent from the plugin scope", async function () {
    const saved = globalThis.AbortController;
    try {
      (globalThis as any).AbortController = undefined;
      const state = await inspect(true);
      assert.equal(state.action, "install");
      assert.include(state.warning || "", "offline");
    } finally {
      (globalThis as any).AbortController = saved;
    }
  });

  it("keeps the active environment when staged installation fails", async function () {
    const key = "extensions.zotero.aidea.translate.envActive";
    const current = JSON.stringify({
      dir: oldDir,
      revision: 0,
      sha256: BUNDLED_ENV_MANIFEST.requirementsSha256,
    });
    prefs.set(key, current);
    files.set(`${oldDir}/bin/python`, "");
    files.set(`${oldDir}/bin/pdf2zh_next`, "");
    files.set(`${oldDir}/requirements.lock`, BUNDLED_ENV_REQUIREMENTS);
    let failed = false;
    try {
      await installOrUpdate(() => undefined);
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
    assert.equal(prefs.get(key), current);
    assert.isTrue(
      removed.some((path) =>
        path.includes(`aidea-translate-env-r${BUNDLED_ENV_MANIFEST.revision}-`),
      ),
    );
  });

  it("removes leftover environments after activation but keeps the rollback one", async function () {
    const key = "extensions.zotero.aidea.translate.envActive";
    const profile = "/tmp/aidea-test-profile";
    const previousDir = `${profile}/aidea-translate-env-r0-0123abcd-prev0000`;
    prefs.set(
      key,
      JSON.stringify({
        dir: previousDir,
        revision: 0,
        sha256: BUNDLED_ENV_MANIFEST.requirementsSha256,
      }),
    );
    files.set(`${previousDir}/requirements.lock`, BUNDLED_ENV_REQUIREMENTS);
    installSucceeds = true;
    const stale = `${profile}/aidea-translate-env-r0-0123abcd-stale000`;
    (globalThis as any).IOUtils.getChildren = async () => {
      const activeDir = JSON.parse(prefs.get(key) || "{}").dir;
      return [
        activeDir,
        previousDir,
        stale,
        `${profile}/aidea-translate-env`,
        `${profile}/aidea-translate-env-catalog.json`,
        `${profile}/zotero.sqlite`,
      ];
    };
    const result = await installOrUpdate(() => undefined);
    const active = JSON.parse(prefs.get(key) || "{}");
    assert.equal(result.environment.venvDir, active.dir);
    assert.equal(active.previous.dir, previousDir);
    assert.sameMembers(
      removed.filter((path) => !path.startsWith("/tmp/aidea-cmd-")),
      [stale, `${profile}/aidea-translate-env`],
    );
  });

  it("installs with hash checking and falls back to the other download source", async function () {
    installSucceeds = true;
    failingSource = "official";
    const steps: string[] = [];
    const result = await installOrUpdate((step) => steps.push(step));
    assert.equal(result.environment.status, "ready");
    assert.include(steps, "retry");
    const syncs = scripts.filter((script) => script.includes("'sync'"));
    assert.lengthOf(syncs, 2);
    assert.notInclude(syncs[0], "UV_DEFAULT_INDEX");
    assert.include(syncs[1], "UV_DEFAULT_INDEX='https://");
    assert.isTrue(
      syncs.every((script) => script.includes("'--require-hashes'")),
    );
  });

  it("starts with the mirror for a Simplified Chinese Zotero", async function () {
    (globalThis as any).Zotero.locale = "zh-CN";
    installSucceeds = true;
    await installOrUpdate(() => undefined);
    const syncs = scripts.filter((script) => script.includes("'sync'"));
    assert.lengthOf(syncs, 1);
    assert.include(syncs[0], "UV_PYTHON_INSTALL_MIRROR=");
  });

  it("does not fall back when the download source is set explicitly", async function () {
    prefs.set(
      "extensions.zotero.aidea.translate.envDownloadSource",
      "official",
    );
    installSucceeds = true;
    failingSource = "official";
    let failed = false;
    try {
      await installOrUpdate(() => undefined);
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
    assert.lengthOf(
      scripts.filter((script) => script.includes("'sync'")),
      1,
    );
  });

  it("refuses an unsupported system before downloading anything", async function () {
    probeOutput = "x86_64\n21.6.0\n";
    installSucceeds = true;
    let message = "";
    try {
      await installOrUpdate(() => undefined);
    } catch (err) {
      message = String(err);
    }
    assert.include(message, "macOS 13");
    assert.isFalse(scripts.some((script) => script.includes("'venv'")));
  });

  it("does not reinstall an already healthy current environment", async function () {
    const key = "extensions.zotero.aidea.translate.envActive";
    const current = JSON.stringify({
      dir: oldDir,
      revision: BUNDLED_ENV_MANIFEST.revision,
      sha256: BUNDLED_ENV_MANIFEST.requirementsSha256,
    });
    prefs.set(key, current);
    files.set(`${oldDir}/bin/python`, "");
    files.set(`${oldDir}/bin/pdf2zh_next`, "");
    files.set(`${oldDir}/requirements.lock`, BUNDLED_ENV_REQUIREMENTS);
    const result = await installOrUpdate(() => undefined);
    assert.equal(result.action, "current");
    assert.equal(prefs.get(key), current);
    assert.isFalse(
      removed.some((path) =>
        path.includes(`aidea-translate-env-r${BUNDLED_ENV_MANIFEST.revision}-`),
      ),
    );
  });

  it("uses the last validated online catalog when offline", async function () {
    const remote = {
      ...BUNDLED_ENV_MANIFEST,
      revision: 2,
      requirementsUrl:
        "https://visterainer.github.io/aidea-zotero/translate-env/requirements-2.lock",
    };
    (globalThis as any).fetch = async (url: string) => ({
      ok: true,
      text: async () =>
        url.endsWith("manifest.json")
          ? JSON.stringify(remote)
          : BUNDLED_ENV_REQUIREMENTS,
    });
    const online = await inspect(true);
    assert.equal(online.targetRevision, 2);
    (globalThis as any).fetch = async () => {
      throw new Error("offline");
    };
    const offline = await inspect(false);
    assert.equal(offline.targetRevision, 2);
  });

  it("does not downgrade a healthy environment when only an older offline catalog is available", async function () {
    const key = "extensions.zotero.aidea.translate.envActive";
    prefs.set(
      key,
      JSON.stringify({
        dir: oldDir,
        revision: 2,
        sha256: BUNDLED_ENV_MANIFEST.requirementsSha256,
      }),
    );
    files.set(`${oldDir}/bin/python`, "");
    files.set(`${oldDir}/bin/pdf2zh_next`, "");
    files.set(`${oldDir}/requirements.lock`, BUNDLED_ENV_REQUIREMENTS);
    const result = await installOrUpdate(() => undefined);
    assert.equal(result.action, "current");
    assert.equal(JSON.parse(prefs.get(key) || "{}").revision, 2);
  });
});
