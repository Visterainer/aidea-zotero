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
        files.has(path) || path === "/tmp/aidea-test-home/.local/bin/uv",
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
              this.exitValue = script.includes("'sync'") ? 1 : 0;
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
      removed.some((path) => path.includes("aidea-translate-env-r1-")),
    );
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
      removed.some((path) => path.includes("aidea-translate-env-r1-")),
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
