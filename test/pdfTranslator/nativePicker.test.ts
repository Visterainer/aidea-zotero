/* ---------------------------------------------------------------------------
 * test/pdfTranslator/nativePicker.test.ts
 *
 * Unit tests for nativePicker module.
 * Run: npx tsx test/pdfTranslator/nativePicker.test.ts
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

/* ── Mock Gecko nsIFilePicker ── */

let mockResult = 0; // 0 = OK, 1 = cancel
let mockFilePath = "C:\\Users\\test\\paper.pdf";

class MockFilePicker {
  mode = 0;
  title = "";
  file: { path: string } | null = { path: mockFilePath };

  init(_win: any, title: string, mode: number) {
    this.title = title;
    this.mode = mode;
  }

  appendFilter(_label: string, _filter: string) {}

  open(callback: (result: number) => void) {
    callback(mockResult);
  }
}

(globalThis as any).Cc = {
  "@mozilla.org/filepicker;1": {
    createInstance() {
      return new MockFilePicker();
    },
  },
};

(globalThis as any).Ci = {
  nsIFilePicker: {},
};

// Import after mocks
const { pickPdfFile, pickDirectory } = await import(
  "../../src/modules/pdfTranslator/nativePicker"
);

/* ── Tests ── */

console.log("\n=== nativePicker: pickPdfFile — OK ===");
{
  mockResult = 0;
  mockFilePath = "C:\\Users\\test\\paper.pdf";
  (globalThis as any).Cc["@mozilla.org/filepicker;1"].createInstance = () => {
    const fp = new MockFilePicker();
    fp.file = { path: mockFilePath };
    return fp;
  };

  const result = await pickPdfFile({} as Window);
  assert(result === mockFilePath, `returns file path: ${result}`);
}

console.log("\n=== nativePicker: pickPdfFile — cancel ===");
{
  mockResult = 1;
  (globalThis as any).Cc["@mozilla.org/filepicker;1"].createInstance = () => {
    const fp = new MockFilePicker();
    return fp;
  };

  const result = await pickPdfFile({} as Window);
  assert(result === null, "returns null on cancel");
}

console.log("\n=== nativePicker: pickDirectory — OK ===");
{
  mockResult = 0;
  (globalThis as any).Cc["@mozilla.org/filepicker;1"].createInstance = () => {
    const fp = new MockFilePicker();
    fp.file = { path: "C:\\Users\\test\\output" };
    return fp;
  };

  const result = await pickDirectory({} as Window);
  assert(result === "C:\\Users\\test\\output", `returns directory: ${result}`);
}

console.log("\n=== nativePicker: pickPdfFile — error handling ===");
{
  (globalThis as any).Cc["@mozilla.org/filepicker;1"].createInstance = () => {
    throw new Error("XPCOM not available");
  };

  const result = await pickPdfFile({} as Window);
  assert(result === null, "returns null on error");
}

/* ── Summary ── */
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
