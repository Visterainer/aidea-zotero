import { assert } from "chai";
import {
  deriveNpmGlobalBinDirFromPrefix,
  deriveNpmGlobalRootFromPrefix,
  derivePreferredUserNpmPrefix,
  getProviderCliSpec,
  normalizeVersionText,
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
});
