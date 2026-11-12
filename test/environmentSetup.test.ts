import { assert } from "chai";
import { spawnSync } from "node:child_process";
import {
  compareReleaseVersions,
  getCodexStandaloneInstallCommand,
  parseCodexCliVersion,
  resolveCodexHomeDir,
} from "../src/utils/oauthCli";

type EnvManagerModule =
  typeof import("../src/modules/pdfTranslator/envManager");

describe("environment setup across platforms", function () {
  let envManager: EnvManagerModule;

  before(async function () {
    const globals = globalThis as any;
    globals.Zotero = globals.Zotero || {};
    globals.PathUtils = globals.PathUtils || {
      join: (...parts: string[]) => parts.join("/"),
      tempDir: "/tmp",
    };
    envManager = await import("../src/modules/pdfTranslator/envManager");
  });

  describe("Codex CLI", function () {
    it("parses the CLI version even when warnings surround it", function () {
      assert.equal(parseCodexCliVersion("codex-cli 0.162.1\n"), "0.162.1");
      assert.equal(
        parseCodexCliVersion(
          "warning: locale UTF-8 not found\ncodex-cli 0.167.2",
        ),
        "0.167.2",
      );
      assert.equal(parseCodexCliVersion("0.9.12"), "0.9.12");
      assert.equal(parseCodexCliVersion("no version here"), "");
    });

    it("orders releases numerically, not as text", function () {
      assert.isBelow(compareReleaseVersions("0.99.0", "0.162.1"), 0);
      assert.isBelow(compareReleaseVersions("0.162.1", "0.167.2"), 0);
      assert.isAbove(compareReleaseVersions("1.0.0", "0.167.2"), 0);
      assert.equal(compareReleaseVersions("0.167.2", "0.167.2"), 0);
    });

    it("never reports an update when a version is unknown", function () {
      assert.equal(compareReleaseVersions("", "0.167.2"), 0);
      assert.equal(compareReleaseVersions("0.167.2", "latest"), 0);
    });

    it("follows CODEX_HOME for the credential file", function () {
      assert.equal(
        resolveCodexHomeDir("/data/codex-home", "/home/alice"),
        "/data/codex-home",
      );
      assert.match(
        resolveCodexHomeDir("", "/home/alice"),
        /^\/home\/alice[\\/]\.codex$/,
      );
      assert.equal(resolveCodexHomeDir("", ""), "");
    });

    it("builds a Unix install command that is valid shell and has a wget fallback", function () {
      const command = getCodexStandaloneInstallCommand("linux");
      assert.include(command, "set -o pipefail");
      assert.include(command, "curl -fsSL");
      assert.include(command, "wget -q");
      if (process.platform === "win32") return;
      const check = spawnSync("/bin/bash", ["-n", "-c", command]);
      assert.equal(check.status, 0, String(check.stderr));
    });
  });

  describe("translation environment", function () {
    it("looks for uv where the installer and package managers put it", function () {
      const unix = envManager.deriveUvCandidatePaths({
        isWin: false,
        home: "/home/alice",
        env: {
          XDG_BIN_HOME: "/home/alice/bin",
          XDG_DATA_HOME: "/home/alice/.var/app/data",
        },
      });
      assert.deepEqual(unix.slice(0, 4), [
        "/home/alice/bin/uv",
        "/home/alice/.var/app/data/../bin/uv",
        "/home/alice/.local/bin/uv",
        "/home/alice/.cargo/bin/uv",
      ]);
      assert.includeMembers(unix, [
        "/opt/homebrew/bin/uv",
        "/usr/local/bin/uv",
      ]);

      const windows = envManager.deriveUvCandidatePaths({
        isWin: true,
        home: "C:\\Users\\张三",
        env: { UV_INSTALL_DIR: "D:\\tools\\uv\\" },
      });
      assert.deepEqual(windows, [
        "D:\\tools\\uv\\uv.exe",
        "C:\\Users\\张三\\.local\\bin\\uv.exe",
        "C:\\Users\\张三\\.cargo\\bin\\uv.exe",
      ]);
    });

    it("requests an x86-64 Python only on Windows ARM64", function () {
      const request = envManager.resolveUvPythonRequest;
      assert.equal(
        request("3.12", { isWin: true, processorArchitecture: ["ARM64"] }),
        "cpython-3.12-windows-x86_64-none",
      );
      // An x64 Zotero running emulated reports the host through W6432.
      assert.equal(
        request("3.12", {
          isWin: true,
          processorArchitecture: ["AMD64", "ARM64"],
        }),
        "cpython-3.12-windows-x86_64-none",
      );
      assert.equal(
        request("3.12", { isWin: true, processorArchitecture: ["AMD64", ""] }),
        "3.12",
      );
      // Apple Silicon and Linux arm64 have native wheels.
      assert.equal(
        request("3.12", { isWin: false, processorArchitecture: ["ARM64"] }),
        "3.12",
      );
    });

    it("writes environment lines for each shell and drops unsafe values", function () {
      const env = {
        UV_HTTP_TIMEOUT: "120",
        UV_DEFAULT_INDEX: "https://mirror.example/simple",
        "BAD NAME": "x",
        INJECT: "1 & calc.exe",
        QUOTE: "a'b",
      };
      assert.equal(
        envManager.buildEnvLines(env, false),
        "export UV_HTTP_TIMEOUT='120'\n" +
          "export UV_DEFAULT_INDEX='https://mirror.example/simple'\n",
      );
      assert.equal(
        envManager.buildEnvLines(env, true),
        'set "UV_HTTP_TIMEOUT=120"\r\n' +
          'set "UV_DEFAULT_INDEX=https://mirror.example/simple"\r\n',
      );
      assert.equal(envManager.buildEnvLines(undefined, false), "");
    });

    it("bootstraps uv with a script that fails when the download fails", function () {
      const script = envManager.UV_UNIX_INSTALL_SCRIPT;
      assert.include(script, "set -e");
      assert.include(script, "wget -q");
      // The installer is run from a file, never piped straight into sh.
      assert.notMatch(script, /\|\s*sh/);
      if (process.platform === "win32") return;
      const check = spawnSync("/bin/sh", ["-n", "-c", script]);
      assert.equal(check.status, 0, String(check.stderr));
    });
  });
});
