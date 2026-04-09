/* ---------------------------------------------------------------------------
 * test/pdfTranslator/configWriter.test.ts
 *
 * Unit tests for configWriter module.
 * Run: npx tsx test/pdfTranslator/configWriter.test.ts
 * -------------------------------------------------------------------------*/

import { generateConfigToml, generateTaskJson } from "../../src/modules/pdfTranslator/configWriter";
import type { BridgeTask } from "../../src/modules/pdfTranslator/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ ${msg}`);
    failed++;
  }
}

/* ── Test generateConfigToml ── */

console.log("\n=== generateConfigToml ===");

{
  const toml = generateConfigToml({
    model: "gemini-3.1-pro-preview",
    apiKey: "test-oauth-token-123",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    sourceLang: "en",
    targetLang: "zh-CN",
    qps: 10,
    noDual: false,
    noMono: false,
  });

  assert(toml.includes('openaicompatible = true'), "enables openaicompatible");
  assert(toml.includes('lang_in = "en"'), "sets source language");
  assert(toml.includes('lang_out = "zh-CN"'), "sets target language");
  assert(toml.includes("qps = 10"), "sets QPS");
  assert(toml.includes("no_dual = false"), "dual mode enabled");
  assert(toml.includes("no_mono = false"), "mono mode enabled");
  assert(toml.includes('openai_compatible_model = "gemini-3.1-pro-preview"'), "sets model");
  assert(toml.includes('openai_compatible_api_key = "test-oauth-token-123"'), "sets API key");
  assert(toml.includes("generativelanguage.googleapis.com"), "sets API URL");
  assert(toml.includes('watermark_output_mode = "no_watermark"'), "no watermark");
}

{
  const toml = generateConfigToml({
    model: "gpt-4o",
    apiKey: 'key-with-"quotes"-and-\\backslash',
    apiUrl: "https://api.openai.com/v1",
    sourceLang: "ja",
    targetLang: "en",
    qps: 20,
    noDual: true,
    noMono: false,
  });

  assert(toml.includes("no_dual = true"), "can disable dual");
  assert(toml.includes("no_mono = false"), "mono still enabled");
  assert(toml.includes('lang_in = "ja"'), "Japanese source");
  assert(toml.includes("qps = 20"), "custom QPS");
  assert(toml.includes('\\"quotes\\"'), "escapes quotes in API key");
  assert(toml.includes("\\\\backslash"), "escapes backslashes in API key");
}

/* ── Test generateTaskJson ── */

console.log("\n=== generateTaskJson ===");

{
  const task: BridgeTask = {
    pdf2zhBin: "/home/user/.venv/bin/pdf2zh_next",
    pdfPath: "/tmp/paper.pdf",
    outputDir: "/tmp/output",
    configFile: "/tmp/config.toml",
    progressFile: "/tmp/progress.json",
    sourceLang: "en",
    targetLang: "zh-CN",
    noDual: false,
    noMono: true,
    qps: 10,
  };

  const json = generateTaskJson(task);
  const parsed = JSON.parse(json);

  assert(parsed.pdf2zhBin === task.pdf2zhBin, "preserves pdf2zhBin path");
  assert(parsed.pdfPath === task.pdfPath, "preserves pdfPath");
  assert(parsed.outputDir === task.outputDir, "preserves outputDir");
  assert(parsed.configFile === task.configFile, "preserves configFile");
  assert(parsed.progressFile === task.progressFile, "preserves progressFile");
  assert(parsed.sourceLang === "en", "preserves sourceLang");
  assert(parsed.targetLang === "zh-CN", "preserves targetLang");
  assert(parsed.noDual === false, "preserves noDual");
  assert(parsed.noMono === true, "preserves noMono");
  assert(parsed.qps === 10, "preserves qps");
}

/* ── Summary ── */

console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
