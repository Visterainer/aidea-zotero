/* ---------------------------------------------------------------------------
 * test/pdfTranslator/envManager.conda.test.ts
 *
 * Unit tests for envManager conda fallback logic.
 * Run: npx tsx test/pdfTranslator/envManager.conda.test.ts
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

/* ── Mock globals ── */

(globalThis as any).Zotero = {
  isWin: process.platform === "win32",
  isMac: process.platform === "darwin",
  DataDirectory: { dir: "/tmp/zotero-test" },
  Profile: { dir: "/tmp/zotero-profile" },
};

const existingPaths = new Set<string>();

(globalThis as any).IOUtils = {
  async exists(p: string): Promise<boolean> {
    return existingPaths.has(p);
  },
};

(globalThis as any).PathUtils = {
  join(...parts: string[]): string {
    return parts.join("/");
  },
  tempDir: "/tmp",
};

(globalThis as any).Components = {
  classes: {
    "@mozilla.org/process/environment;1": {
      getService() {
        return {
          get(name: string) {
            if (name === "HOME") return "/home/testuser";
            if (name === "USERPROFILE") return "C:\\Users\\testuser";
            return "";
          },
        };
      },
    },
    "@mozilla.org/file/local;1": {
      createInstance() {
        return {
          initWithPath() {},
        };
      },
    },
    "@mozilla.org/process/util;1": {
      createInstance() {
        return {
          init() {},
          runAsync() {},
          exitValue: 0,
        };
      },
    },
  },
  interfaces: {
    nsIFile: {},
    nsIProcess: {},
    nsIEnvironment: {},
  },
};

/* ── Import after mocks ── */

// We import the re-exported helpers to test path resolution
const {
  getEnvRoot,
  getPythonBin,
  getPdf2zhBin,
  getCondaEnvDir,
  getCondaPythonBin,
  getCondaPdf2zhBin,
} = await import("../../src/modules/pdfTranslator/envManager");

/* ── Tests ── */

console.log("\n=== envManager.conda: getCondaEnvDir ===");
{
  const dir = getCondaEnvDir();
  assert(dir.includes("aidea-translate-conda-env"), `conda env dir: ${dir}`);
  assert(dir.includes("zotero-profile"), `prefers Zotero profile dir: ${dir}`);
}

console.log("\n=== envManager.conda: getCondaPythonBin ===");
{
  const envDir = "/tmp/test-conda-env";
  const py = getCondaPythonBin(envDir);
  if (process.platform === "win32") {
    assert(py.endsWith("python.exe"), `Windows python: ${py}`);
  } else {
    assert(py.includes("bin/python"), `Unix python: ${py}`);
  }
}

console.log("\n=== envManager.conda: getCondaPdf2zhBin ===");
{
  const envDir = "/tmp/test-conda-env";
  const bin = getCondaPdf2zhBin(envDir);
  assert(bin.includes("pdf2zh_next"), `pdf2zh_next binary: ${bin}`);
}

console.log("\n=== envManager: uv path resolution ===");
{
  const root = getEnvRoot();
  assert(root.includes("aidea-translate"), `env root: ${root}`);
  assert(root.includes("zotero-profile"), `uv env also prefers profile dir: ${root}`);

  const py = getPythonBin(root);
  assert(py.includes("python"), `python bin inside venv: ${py}`);

  const pdf2zh = getPdf2zhBin(root);
  assert(pdf2zh.includes("pdf2zh_next"), `pdf2zh bin: ${pdf2zh}`);
}

/* ── Summary ── */
console.log(`\n${"=".repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
