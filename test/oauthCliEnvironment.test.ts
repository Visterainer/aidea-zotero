import { assert } from "chai";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildWindowsUserPathPersistenceScript,
  buildNodeSourceAptInstallCommand,
  buildNodeSourceAptManualInstructions,
  checkOAuthCliEnvironmentUpdates,
  deriveCodexStandaloneBinDirs,
  deriveNpmGlobalBinDirFromPrefix,
  deriveNpmGlobalRootFromPrefix,
  derivePreferredUserNpmPrefix,
  decideSystemProxySync,
  getCodexStandaloneInstallCommand,
  getProviderCliSpec,
  getSystemProxySignature,
  isNodeVersionSupportedByProviderCli,
  normalizeVersionText,
  parseMacSystemProxy,
  parseProxyUrl,
  shouldInstallLatestPackageVersion,
} from "../src/utils/oauthCli";

describe("oauthCli environment helpers", function () {
  function writeCmd(filePath: string, body: string): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `@echo off\r\n${body}\r\n`, "utf8");
  }

  function installWindowsZoteroRuntimeMock(env: Record<string, string>) {
    const previous = {
      Cc: (globalThis as any).Cc,
      Ci: (globalThis as any).Ci,
      Zotero: (globalThis as any).Zotero,
      ztoolkit: (globalThis as any).ztoolkit,
    };

    class LocalFileMock {
      path = "";
      initWithPath(filePath: string) {
        this.path = filePath;
      }
      exists() {
        return fs.existsSync(this.path);
      }
      isDirectory() {
        try {
          return fs.statSync(this.path).isDirectory();
        } catch {
          return false;
        }
      }
      remove() {
        fs.rmSync(this.path, { force: true, recursive: false });
      }
      create() {
        fs.mkdirSync(this.path, { recursive: true });
      }
      get parent() {
        const parentPath = path.dirname(this.path);
        return { path: parentPath };
      }
    }

    class ProcessMock {
      exitValue = 0;
      private filePath = "";
      init(file: { path?: string }) {
        this.filePath = String(file.path || "");
      }
      runAsync(args: string[], len: number, observer: any) {
        const child = spawn(this.filePath, args.slice(0, len), {
          windowsHide: true,
        });
        child.on("close", (code) => {
          this.exitValue = typeof code === "number" ? code : 1;
          observer.observe(null, "process-finished");
        });
        child.on("error", () => {
          this.exitValue = 1;
          observer.observe(null, "process-failed");
        });
      }
    }

    (globalThis as any).Ci = {
      nsIEnvironment: "nsIEnvironment",
      nsIFile: { DIRECTORY_TYPE: 1 },
      nsIProcess: "nsIProcess",
    };
    (globalThis as any).Cc = {
      "@mozilla.org/file/local;1": {
        createInstance: () => new LocalFileMock(),
      },
      "@mozilla.org/process/environment;1": {
        getService: () => ({
          get: (name: string) => env[name] ?? process.env[name] ?? "",
          set: (name: string, value: string) => {
            env[name] = value;
          },
        }),
      },
      "@mozilla.org/process/util;1": {
        createInstance: () => new ProcessMock(),
      },
    };
    (globalThis as any).Zotero = {
      isWin: true,
      isMac: false,
      DataDirectory: { dir: os.tmpdir() },
      File: {
        getContents: (filePath: string) => {
          const bytes = fs.readFileSync(filePath);
          const utf8 = bytes.toString("utf8");
          return utf8.includes("\u0000") ? bytes.toString("utf16le") : utf8;
        },
      },
      getTempDirectory: () => ({ path: os.tmpdir() }),
    };
    (globalThis as any).ztoolkit = { log: () => undefined };

    return () => {
      (globalThis as any).Cc = previous.Cc;
      (globalThis as any).Ci = previous.Ci;
      (globalThis as any).Zotero = previous.Zotero;
      (globalThis as any).ztoolkit = previous.ztoolkit;
    };
  }

  it("should normalize version text from noisy command output", function () {
    assert.equal(normalizeVersionText("npm 11.6.2"), "11.6.2");
    assert.equal(normalizeVersionText("v22.15.1"), "22.15.1");
    assert.equal(normalizeVersionText("warning\n11.5.0\n"), "11.5.0");
    assert.equal(normalizeVersionText(""), "");
  });

  it("should derive npm global paths from prefix on Windows", function () {
    const prefix = "C:\\Users\\alice\\AppData\\Roaming\\npm";
    assert.equal(
      deriveNpmGlobalRootFromPrefix(prefix, "windows"),
      "C:\\Users\\alice\\AppData\\Roaming\\npm\\node_modules",
    );
    assert.equal(
      deriveNpmGlobalBinDirFromPrefix(prefix, "windows"),
      "C:\\Users\\alice\\AppData\\Roaming\\npm",
    );
  });

  it("should derive npm global paths from prefix on Unix-like platforms", function () {
    const prefix = "/Users/alice/.npm-global";
    assert.equal(
      deriveNpmGlobalRootFromPrefix(prefix, "macos"),
      "/Users/alice/.npm-global/lib/node_modules",
    );
    assert.equal(
      deriveNpmGlobalBinDirFromPrefix(prefix, "macos"),
      "/Users/alice/.npm-global/bin",
    );
    assert.equal(
      deriveNpmGlobalRootFromPrefix("/home/alice/.npm-global", "linux"),
      "/home/alice/.npm-global/lib/node_modules",
    );
  });

  it("should derive preferred user npm prefixes per platform", function () {
    assert.equal(
      derivePreferredUserNpmPrefix("windows", "C:\\Users\\alice"),
      "C:\\Users\\alice\\AppData\\Roaming\\npm",
    );
    assert.equal(
      derivePreferredUserNpmPrefix("macos", "/Users/alice"),
      "/Users/alice/.npm-global",
    );
    assert.equal(
      derivePreferredUserNpmPrefix("linux", "/home/alice"),
      "/home/alice/.npm-global",
    );
  });

  it("should use official Codex standalone installer commands", function () {
    assert.equal(
      getCodexStandaloneInstallCommand("macos"),
      "curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh",
    );
    assert.equal(
      getCodexStandaloneInstallCommand("linux"),
      "curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh",
    );
    assert.include(
      getCodexStandaloneInstallCommand("windows"),
      "https://chatgpt.com/codex/install.ps1",
    );
    assert.include(
      getCodexStandaloneInstallCommand("windows"),
      "CODEX_NON_INTERACTIVE=1",
    );
    assert.include(getCodexStandaloneInstallCommand("windows"), "System32");
  });

  it("should build NodeSource apt command for Node.js 22 upgrades", function () {
    const command = buildNodeSourceAptInstallCommand();

    assert.include(command, "https://deb.nodesource.com/setup_22.x");
    assert.include(command, "/tmp/aidea-nodesource-setup_22.x.sh");
    assert.include(command, "sudo -n -E bash");
    assert.include(command, "apt-get install -y nodejs");
  });

  it("should build interactive terminal instructions for manual NodeSource install", function () {
    const instructions = buildNodeSourceAptManualInstructions();

    assert.include(instructions, "https://deb.nodesource.com/setup_22.x");
    assert.include(instructions, "sudo -E bash");
    assert.include(instructions, "sudo apt-get install -y nodejs");
    assert.include(instructions, "node --version");
    assert.notInclude(instructions, "sudo -n");
  });

  it("should derive Codex standalone binary directories per platform", function () {
    assert.deepEqual(
      deriveCodexStandaloneBinDirs(
        "windows",
        "C:\\Users\\alice",
        "C:\\Users\\alice\\AppData\\Local",
      ),
      ["C:\\Users\\alice\\AppData\\Local\\Programs\\OpenAI\\Codex\\bin"],
    );
    assert.deepEqual(deriveCodexStandaloneBinDirs("macos", "/Users/alice"), [
      "/Users/alice/.local/bin",
    ]);
    assert.deepEqual(
      deriveCodexStandaloneBinDirs(
        "linux",
        "/home/alice",
        "",
        "/opt/codex/bin",
      ),
      ["/opt/codex/bin", "/home/alice/.local/bin"],
    );
  });

  it("should check Codex updates against standalone install before old npm PATH entries", async function () {
    if (process.platform !== "win32") this.skip();

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aidea-codex-check-"));
    const home = path.join(root, "home");
    const localAppData = path.join(home, "AppData", "Local");
    const standaloneBin = path.join(
      localAppData,
      "Programs",
      "OpenAI",
      "Codex",
      "bin",
    );
    const oldNpmBin = path.join(home, "AppData", "Roaming", "npm");
    writeCmd(path.join(standaloneBin, "codex.cmd"), "echo codex-cli 99");
    writeCmd(path.join(oldNpmBin, "codex.cmd"), "echo codex-cli 1");

    const restore = installWindowsZoteroRuntimeMock({
      USERPROFILE: home,
      LOCALAPPDATA: localAppData,
      PATH: `${oldNpmBin};${process.env.PATH || ""}`,
    });
    try {
      const results = await checkOAuthCliEnvironmentUpdates(["openai-codex"]);
      assert.lengthOf(results, 1);
      assert.deepInclude(results[0], {
        provider: "openai-codex",
        needsUpdate: false,
        reason: "current",
        installedVersion: "99",
      });
    } finally {
      restore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("should build Windows PATH persistence PowerShell without breaking else", function () {
    const script = buildWindowsUserPathPersistenceScript(
      "C:\\Users\\alice\\AppData\\Roaming\\npm",
    );

    assert.notMatch(script, /\}\s*;\s*else\b/i);
    assert.include(script, "} else {");
    assert.include(script, "User PATH already contains npm bin dir");
    assert.include(script, "Added npm bin dir to user PATH");
  });

  it("should only request package updates when installed is missing or outdated", function () {
    assert.isTrue(shouldInstallLatestPackageVersion("", "11.6.2"));
    assert.isFalse(shouldInstallLatestPackageVersion("11.6.2", "11.6.2"));
    assert.isTrue(shouldInstallLatestPackageVersion("11.5.0", "11.6.2"));
    assert.isFalse(shouldInstallLatestPackageVersion("11.6.2", ""));
  });

  it("should expose provider CLI metadata for CLI-backed providers only", function () {
    assert.deepInclude(getProviderCliSpec("openai-codex") || {}, {
      packageName: "@openai/codex",
      executableName: "codex",
      versionArg: "--version",
    });
    assert.deepInclude(getProviderCliSpec("google-gemini-cli") || {}, {
      packageName: "@google/gemini-cli",
      executableName: "gemini",
      versionArg: "--version",
    });
    assert.isNull(getProviderCliSpec("qwen"));
    assert.isNull(getProviderCliSpec("github-copilot"));
  });

  it("should require Node.js 20 or newer for current Gemini CLI", function () {
    assert.isFalse(
      isNodeVersionSupportedByProviderCli("google-gemini-cli", "18.19.1"),
    );
    assert.isTrue(
      isNodeVersionSupportedByProviderCli("google-gemini-cli", "20.0.0"),
    );
    assert.isTrue(
      isNodeVersionSupportedByProviderCli("google-gemini-cli", "22.9.0"),
    );
  });

  it("should parse macOS system proxy settings from scutil output", function () {
    const proxy = parseMacSystemProxy(`
<dictionary> {
  ExceptionsList : <array> {
    0 : 127.0.0.1
    1 : 192.168.0.0/16
    2 : localhost
    3 : *.local
  }
  HTTPEnable : 1
  HTTPPort : 7897
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7897
  HTTPSProxy : 127.0.0.1
  SOCKSEnable : 1
  SOCKSPort : 7897
  SOCKSProxy : 127.0.0.1
}
`);
    assert.deepEqual(proxy, {
      httpHost: "127.0.0.1",
      httpPort: 7897,
      httpsHost: "127.0.0.1",
      httpsPort: 7897,
      socksHost: "127.0.0.1",
      socksPort: 7897,
      socksVersion: 5,
      noProxy: "127.0.0.1, 192.168.0.0/16, localhost, *.local",
    });
  });

  it("should ignore macOS scutil output without enabled proxies", function () {
    assert.isNull(parseMacSystemProxy("<dictionary> {\n}\n"));
  });

  it("should parse Linux-style proxy environment URLs", function () {
    assert.deepEqual(parseProxyUrl("http://127.0.0.1:7897"), {
      httpHost: "127.0.0.1",
      httpPort: 7897,
      httpsHost: "127.0.0.1",
      httpsPort: 7897,
      envUrl: "http://127.0.0.1:7897",
    });
    assert.deepEqual(parseProxyUrl("socks5://localhost:1080"), {
      socksHost: "localhost",
      socksPort: 1080,
      socksVersion: 5,
      envUrl: "socks5://localhost:1080",
    });
  });

  it("should build stable proxy signatures without hard-coded ports", function () {
    assert.equal(
      getSystemProxySignature({
        httpHost: "LOCALHOST",
        httpPort: 7897,
        httpsHost: "127.0.0.1",
        httpsPort: 7897,
        noProxy: "localhost; 127.0.0.1",
      }),
      "http=localhost:7897;https=127.0.0.1:7897;socks=;socksVersion=;noProxy=localhost,127.0.0.1",
    );
  });

  it("should update AIdea-managed proxy but preserve user-managed proxy", function () {
    assert.equal(
      decideSystemProxySync({
        currentType: 1,
        currentSignature: "http=127.0.0.1:7890",
        systemSignature: "http=127.0.0.1:7897",
        autoApplied: true,
        lastSignature: "http=127.0.0.1:7890",
        currentLoopback: true,
        systemLoopback: true,
      }),
      "update-managed",
    );

    assert.equal(
      decideSystemProxySync({
        currentType: 1,
        currentSignature: "http=192.168.1.10:8080",
        systemSignature: "http=127.0.0.1:7897",
        autoApplied: false,
        lastSignature: "",
        currentLoopback: false,
        systemLoopback: true,
        forceRefresh: true,
      }),
      "skip-user-managed",
    );
  });

  it("should adopt legacy loopback proxy during forced refresh", function () {
    assert.equal(
      decideSystemProxySync({
        currentType: 1,
        currentSignature: "http=127.0.0.1:7890",
        systemSignature: "http=127.0.0.1:7897",
        autoApplied: false,
        lastSignature: "",
        currentLoopback: true,
        systemLoopback: true,
        forceRefresh: true,
      }),
      "adopt-legacy-loopback",
    );
  });
});
