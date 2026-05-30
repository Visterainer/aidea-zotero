import { assert } from "chai";
import {
  buildWindowsUserPathPersistenceScript,
  deriveNpmGlobalBinDirFromPrefix,
  deriveNpmGlobalRootFromPrefix,
  derivePreferredUserNpmPrefix,
  decideSystemProxySync,
  getProviderCliSpec,
  getSystemProxySignature,
  normalizeVersionText,
  parseMacSystemProxy,
  parseProxyUrl,
  shouldInstallLatestPackageVersion,
} from "../src/utils/oauthCli";

describe("oauthCli environment helpers", function () {
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
