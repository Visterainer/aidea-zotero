/* ---------------------------------------------------------------------------
 * test/pdfTranslator/progressPoller.test.ts
 *
 * Unit tests for progressPoller module.
 * Run: npx tsx test/pdfTranslator/progressPoller.test.ts
 * -------------------------------------------------------------------------*/

import type { ProgressData } from "../../src/modules/pdfTranslator/types";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

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

/* ── Mock IOUtils (Gecko global) for Node ── */

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "poller-test-"));
const progressFile = path.join(tmpDir, "progress.json");

(globalThis as any).IOUtils = {
  async readUTF8(p: string): Promise<string> {
    return fs.readFileSync(p, "utf-8");
  },
  async exists(p: string): Promise<boolean> {
    return fs.existsSync(p);
  },
};

// Import after mocks are set up
const { ProgressPoller } = await import("../../src/modules/pdfTranslator/progressPoller");

/* ── Helpers ── */

function writeProgress(data: ProgressData) {
  const tmp = progressFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data), "utf-8");
  fs.renameSync(tmp, progressFile);
}

function cleanup() {
  try { fs.unlinkSync(progressFile); } catch {}
}

/* ── Tests ── */

console.log("\n=== ProgressPoller: file not found ===");
{
  cleanup();
  const events: ProgressData[] = [];
  const poller = new ProgressPoller(progressFile, (d) => events.push(d), 100);

  await poller.tick();
  assert(events.length === 0, "no callback when file missing");
}

console.log("\n=== ProgressPoller: running state ===");
{
  cleanup();
  const events: ProgressData[] = [];
  const poller = new ProgressPoller(progressFile, (d) => events.push(d), 100);

  writeProgress({
    status: "running",
    progress: 42,
    current: 8,
    total: 19,
    message: "Translating 8/19 pages...",
  });

  await poller.tick();
  assert(events.length === 1, "callback fired once");
  assert(events[0].status === "running", "status is running");
  assert(events[0].progress === 42, "progress is 42");
  assert(events[0].current === 8, "current page is 8");
  assert(events[0].total === 19, "total pages is 19");
  assert(poller.running === false, "poller stays stopped (manual tick)");
}

console.log("\n=== ProgressPoller: done auto-stops ===");
{
  cleanup();
  const events: ProgressData[] = [];
  const poller = new ProgressPoller(progressFile, (d) => events.push(d), 50);
  poller.start();
  assert(poller.running === true, "poller started");

  writeProgress({
    status: "done",
    progress: 100,
    message: "Translation complete",
    outputFiles: ["paper.mono.pdf", "paper.dual.pdf"],
  });

  // Wait for at least one tick
  await new Promise((r) => setTimeout(r, 150));

  assert(events.length >= 1, "at least one callback");
  const last = events[events.length - 1];
  assert(last.status === "done", "final status is done");
  assert(last.progress === 100, "progress is 100");
  assert(Array.isArray(last.outputFiles), "has outputFiles");
  assert(poller.running === false, "poller auto-stopped on done");
}

console.log("\n=== ProgressPoller: start triggers immediate tick ===");
{
  cleanup();
  const events: ProgressData[] = [];
  writeProgress({
    status: "running",
    progress: 12,
    current: 1,
    total: 8,
    message: "Translating 1/8 pages...",
  });

  const poller = new ProgressPoller(progressFile, (d) => events.push(d), 1000);
  poller.start();
  await new Promise((r) => setTimeout(r, 50));

  assert(events.length >= 1, "callback fired before first interval boundary");
  assert(events[0].progress === 12, "immediate tick reads current progress");
  poller.stop();
}

console.log("\n=== ProgressPoller: error auto-stops ===");
{
  cleanup();
  const events: ProgressData[] = [];
  const poller = new ProgressPoller(progressFile, (d) => events.push(d), 50);
  poller.start();

  writeProgress({
    status: "error",
    progress: 30,
    message: "Translation failed (exit code: 1)",
    error: "exit_code_1",
  });

  await new Promise((r) => setTimeout(r, 150));

  assert(events.length >= 1, "at least one callback");
  assert(events[events.length - 1].status === "error", "final status is error");
  assert(poller.running === false, "poller auto-stopped on error");
}

console.log("\n=== ProgressPoller: manual stop ===");
{
  cleanup();
  const events: ProgressData[] = [];
  const poller = new ProgressPoller(progressFile, (d) => events.push(d), 50);
  poller.start();
  assert(poller.running === true, "poller running");

  poller.stop();
  assert(poller.running === false, "poller stopped");

  writeProgress({
    status: "running",
    progress: 50,
    message: "Should not be received",
  });

  await new Promise((r) => setTimeout(r, 150));
  assert(events.length === 0, "no callback after stop");
}

console.log("\n=== ProgressPoller: empty file handled ===");
{
  cleanup();
  fs.writeFileSync(progressFile, "", "utf-8");
  const events: ProgressData[] = [];
  const poller = new ProgressPoller(progressFile, (d) => events.push(d), 100);

  await poller.tick();
  assert(events.length === 0, "no callback for empty file");
}

/* ── Cleanup ── */
cleanup();
try { fs.rmdirSync(tmpDir); } catch {}

/* ── Summary ── */
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
