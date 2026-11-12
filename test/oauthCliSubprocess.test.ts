import { assert } from "chai";
import {
  autoConfigureEnvironment,
  chatWithProviderOAuth,
  runProviderOAuthLogin,
} from "../src/utils/oauthCli";
import {
  PROCESS_TIMEOUT_EXIT_CODE,
  runShellCommand,
} from "../src/utils/processRunner";

const CODEX_BIN_DIR = "/home/test/.local/bin";
const CODEX_PATH = `${CODEX_BIN_DIR}/codex`;

type FakeProcess = {
  script: string;
  killed: boolean;
  finish: (exitValue?: number) => void;
};

function sseResponse(text: string): Response {
  return new Response(
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\n` +
      "data: [DONE]\n\n",
    { status: 200, headers: { "Content-Type": "text/event-stream" } },
  );
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condition(); i += 1)
    await new Promise((resolve) => setTimeout(resolve, 1));
  assert.isTrue(condition(), "condition was not reached");
}

describe("oauthCli subprocess and credential handling", function () {
  const globals = globalThis as any;
  let originals: Record<string, unknown>;
  let processes: FakeProcess[];
  /** Called for each spawned process; the default finishes it at once. */
  let onSpawn: (proc: FakeProcess) => void;
  let codexInstalled: boolean;
  let accessToken: string;

  beforeEach(function () {
    originals = Object.fromEntries(
      ["Zotero", "ztoolkit", "Cc", "Ci", "fetch"].map((k) => [k, globals[k]]),
    );
    processes = [];
    onSpawn = (proc) => proc.finish(0);
    codexInstalled = true;
    accessToken = "token-1";
    const prefs = new Map<string, unknown>();
    const exists = (path: string) =>
      path === "/bin/bash" ||
      (codexInstalled && (path === CODEX_BIN_DIR || path === CODEX_PATH));
    globals.Zotero = {
      isWin: false,
      isMac: false,
      Prefs: {
        get: (key: string) => prefs.get(key),
        set: (key: string, value: unknown) => prefs.set(key, value),
      },
      File: {
        getContentsAsync: async () =>
          JSON.stringify({ tokens: { access_token: accessToken } }),
        getContents: () => "",
      },
      getTempDirectory: () => ({ path: "/tmp" }),
    };
    globals.ztoolkit = { getGlobal: () => undefined, log: () => undefined };
    globals.Ci = { nsIEnvironment: {}, nsIFile: {}, nsIProcess: {} };
    globals.Cc = {
      "@mozilla.org/process/environment;1": {
        getService: () => ({
          get: (name: string) => (name === "HOME" ? "/home/test" : ""),
          set: () => undefined,
        }),
      },
      "@mozilla.org/file/local;1": {
        createInstance: () => ({
          path: "",
          initWithPath(path: string) {
            this.path = path;
          },
          exists() {
            return exists(this.path);
          },
          isDirectory() {
            return this.path === CODEX_BIN_DIR;
          },
          remove: () => undefined,
          get parent() {
            return { path: this.path.replace(/\/[^/]*$/, "") };
          },
        }),
      },
      "@mozilla.org/process/util;1": {
        createInstance: () => ({
          exitValue: 0,
          init: () => undefined,
          kill() {
            this.fake.killed = true;
          },
          fake: null as FakeProcess | null,
          runwAsync(args: string[], _len: number, observer: any) {
            const fake: FakeProcess = {
              script: args[args.length - 1],
              killed: false,
              finish: (exitValue = 0) => {
                this.exitValue = exitValue;
                setTimeout(() => observer.observe(null, "process-finished"), 0);
              },
            };
            this.fake = fake;
            processes.push(fake);
            onSpawn(fake);
          },
        }),
      },
    };
  });

  afterEach(function () {
    Object.assign(globals, originals);
  });

  const chat = () =>
    chatWithProviderOAuth({
      provider: "openai-codex",
      model: "gpt-test",
      prompt: "Hello",
    });

  it("refreshes an expired Codex token through the CLI and retries the chat once", async function () {
    const tokens: string[] = [];
    onSpawn = (proc) => {
      accessToken = "token-2";
      proc.finish(0);
    };
    globals.fetch = async (_url: unknown, init?: RequestInit) => {
      const auth = String((init?.headers as any)?.Authorization || "");
      tokens.push(auth);
      return auth.includes("token-2")
        ? sseResponse("fresh")
        : new Response("expired", { status: 401 });
    };

    assert.equal(await chat(), "fresh");
    assert.deepEqual(tokens, ["Bearer token-1", "Bearer token-2"]);
    assert.lengthOf(processes, 1);
    assert.include(processes[0].script, "'login' 'status'");
  });

  it("does not resend when the CLI leaves the Codex token unchanged", async function () {
    let calls = 0;
    globals.fetch = async () => {
      calls += 1;
      return new Response("expired", { status: 401 });
    };

    let error: unknown;
    try {
      await chat();
    } catch (err) {
      error = err;
    }
    assert.match(String(error), /Codex OAuth HTTP 401: expired/);
    // The CLI was asked once, but the same token is not sent twice.
    assert.lengthOf(processes, 1);
    assert.equal(calls, 1);
  });

  it("does not treat a 403 as an expired Codex token", async function () {
    let calls = 0;
    globals.fetch = async () => {
      calls += 1;
      return new Response("denied", { status: 403 });
    };

    let error: unknown;
    try {
      await chat();
    } catch (err) {
      error = err;
    }
    assert.match(String(error), /Codex OAuth HTTP 403: denied/);
    assert.equal(calls, 1);
    assert.lengthOf(processes, 0);
  });

  it("does not retry a rejected Codex chat when the CLI cannot refresh", async function () {
    codexInstalled = false;
    let calls = 0;
    globals.fetch = async () => {
      calls += 1;
      return new Response("expired", { status: 401 });
    };

    let error: unknown;
    try {
      await chat();
    } catch (err) {
      error = err;
    }
    assert.match(String(error), /Codex OAuth HTTP 401: expired/);
    assert.equal(calls, 1);
  });

  it("kills a subprocess that exceeds its timeout", async function () {
    onSpawn = () => undefined;
    const result = await runShellCommand("sleep 999", {
      hidden: true,
      timeoutMs: 20,
    });
    assert.equal(result.code, PROCESS_TIMEOUT_EXIT_CODE);
    assert.include(result.stderr, "Timed out");
    assert.isTrue(processes[0].killed);
  });

  it("leaves a subprocess alone when it finishes before the timeout", async function () {
    onSpawn = (proc) => proc.finish(3);
    const result = await runShellCommand("false", {
      hidden: true,
      timeoutMs: 20,
    });
    assert.equal(result.code, 3);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.isFalse(processes[0].killed);
  });

  it("shares one Codex login between concurrent callers", async function () {
    onSpawn = () => undefined;
    const first = runProviderOAuthLogin("openai-codex");
    const second = runProviderOAuthLogin("openai-codex");
    assert.strictEqual(first, second);
    await waitFor(() => processes.length > 0);
    processes[0].finish(0);
    assert.isTrue((await first).ok);
    assert.lengthOf(processes, 1);

    onSpawn = (proc) => proc.finish(0);
    await runProviderOAuthLogin("openai-codex");
    assert.lengthOf(processes, 2, "a finished login does not block the next");
  });

  it("shares one environment install between concurrent callers", async function () {
    onSpawn = () => undefined;
    const isInstall = (proc: FakeProcess) =>
      proc.script.includes("codex/install.sh");
    const first = autoConfigureEnvironment({ provider: "openai-codex" });
    const second = autoConfigureEnvironment();
    assert.strictEqual(first, second);
    await waitFor(() => processes.some(isInstall));
    onSpawn = (proc) => proc.finish(0);
    processes.find(isInstall)!.finish(0);
    assert.isTrue((await first).ok);
    assert.lengthOf(processes.filter(isInstall), 1);

    await autoConfigureEnvironment({ provider: "openai-codex" });
    assert.lengthOf(processes.filter(isInstall), 2);
  });
});
