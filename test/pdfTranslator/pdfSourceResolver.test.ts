/* ---------------------------------------------------------------------------
 * test/pdfTranslator/pdfSourceResolver.test.ts
 *
 * Unit tests for pdfSourceResolver module.
 * Run: npx tsx test/pdfTranslator/pdfSourceResolver.test.ts
 * -------------------------------------------------------------------------*/

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

/* ── Mock Gecko globals ── */

(globalThis as any).Zotero = {};

const existingFiles = new Set<string>();
(globalThis as any).IOUtils = {
  async exists(path: string): Promise<boolean> {
    return existingFiles.has(path);
  },
};

// Import after mocks
const { resolveItemPdfPath, getDefaultOutputDir } = await import(
  "../../src/modules/pdfTranslator/pdfSourceResolver"
);

/* ── Tests ── */

console.log("\n=== pdfSourceResolver: null item ===");
{
  const result = await resolveItemPdfPath(null);
  assert(result === null, "returns null for null item");
}

console.log("\n=== pdfSourceResolver: PDF attachment item ===");
{
  existingFiles.add("/home/user/papers/test.pdf");
  const mockItem = {
    isAttachment: () => true,
    isRegularItem: () => false,
    getFilePath: () => "/home/user/papers/test.pdf",
  };
  const result = await resolveItemPdfPath(mockItem);
  assert(result === "/home/user/papers/test.pdf", `returns PDF path: ${result}`);
}

console.log("\n=== pdfSourceResolver: regular item with best attachment ===");
{
  existingFiles.add("/home/user/papers/paper2.pdf");
  const mockAttach = {
    getFilePath: () => "/home/user/papers/paper2.pdf",
  };
  const mockItem = {
    isAttachment: () => false,
    isRegularItem: () => true,
    getBestAttachment: async () => mockAttach,
  };
  const result = await resolveItemPdfPath(mockItem);
  assert(result === "/home/user/papers/paper2.pdf", `returns attachment PDF path: ${result}`);
}

console.log("\n=== pdfSourceResolver: regular item without attachments ===");
{
  const mockItem = {
    isAttachment: () => false,
    isRegularItem: () => true,
    getBestAttachment: async () => null,
  };
  const result = await resolveItemPdfPath(mockItem);
  assert(result === null, "returns null when no attachment");
}

console.log("\n=== pdfSourceResolver: non-PDF attachment ===");
{
  const mockItem = {
    isAttachment: () => true,
    isRegularItem: () => false,
    getFilePath: () => "/home/user/papers/image.png",
  };
  const result = await resolveItemPdfPath(mockItem);
  assert(result === null, "returns null for non-PDF attachment");
}

console.log("\n=== pdfSourceResolver: file does not exist ===");
{
  const mockItem = {
    isAttachment: () => true,
    isRegularItem: () => false,
    getFilePath: () => "/nonexistent/file.pdf",
  };
  const result = await resolveItemPdfPath(mockItem);
  assert(result === null, "returns null when file doesn't exist on disk");
}

console.log("\n=== pdfSourceResolver: getDefaultOutputDir ===");
{
  (globalThis as any).PathUtils = {
    parent: (p: string) => p.substring(0, p.lastIndexOf("/")),
  };
  const dir = getDefaultOutputDir("/home/user/papers/test.pdf");
  assert(dir === "/home/user/papers", `output dir: ${dir}`);
}

/* ── Summary ── */
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
