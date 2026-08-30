import { assert } from "chai";

describe("pdfTranslator process runner", function () {
  let launchProcess: typeof import("../../src/modules/pdfTranslator/processRunner").launchProcess;
  let processQueue: any[];
  let originalComponents: unknown;
  let originalServices: unknown;
  let originalZotero: unknown;

  before(async function () {
    originalComponents = (globalThis as any).Components;
    originalServices = (globalThis as any).Services;
    originalZotero = (globalThis as any).Zotero;
    processQueue = [];

    (globalThis as any).Zotero = { isWin: true };
    (globalThis as any).Services = {
      dirsvc: {
        get() {
          return {
            clone() {
              return {
                path: "C:\\Windows\\System32",
                append(name: string) {
                  this.path += `\\${name}`;
                },
                exists() {
                  return true;
                },
              };
            },
          };
        },
      },
    };
    (globalThis as any).Components = {
      interfaces: { nsIFile: {}, nsIProcess: {} },
      classes: {
        "@mozilla.org/file/local;1": {
          createInstance() {
            return {
              path: "",
              initWithPath(path: string) {
                this.path = path;
              },
            };
          },
        },
        "@mozilla.org/process/util;1": {
          createInstance() {
            const next = processQueue.shift();
            if (!next) throw new Error("Missing mocked process");
            return next;
          },
        },
      },
    };

    ({ launchProcess } =
      await import("../../src/modules/pdfTranslator/processRunner"));
  });

  after(function () {
    (globalThis as any).Components = originalComponents;
    (globalThis as any).Services = originalServices;
    (globalThis as any).Zotero = originalZotero;
  });

  function createMainProcess(pid: number) {
    return {
      pid,
      exitValue: 0,
      directKillCount: 0,
      init() {},
      runAsync() {},
      kill() {
        this.directKillCount += 1;
      },
    };
  }

  it("uses taskkill /T /F for the bridge process tree on Windows", function () {
    const main = createMainProcess(4321);
    const treeKillCalls: string[][] = [];
    const killer = {
      exitValue: 0,
      init() {},
      run(_blocking: boolean, args: string[]) {
        treeKillCalls.push(args);
      },
    };
    processQueue.push(main, killer);

    const running = launchProcess("C:\\Python\\python.exe", ["bridge.py"]);
    running.kill();

    assert.deepEqual(treeKillCalls, [["/PID", "4321", "/T", "/F"]]);
    assert.equal(main.directKillCount, 0);
  });

  it("falls back to direct process kill when taskkill fails", function () {
    const main = createMainProcess(9876);
    const killer = {
      exitValue: 1,
      init() {},
      run() {
        throw new Error("taskkill unavailable");
      },
    };
    processQueue.push(main, killer);

    const running = launchProcess("C:\\Python\\python.exe", ["bridge.py"]);
    running.kill();

    assert.equal(main.directKillCount, 1);
  });
});
