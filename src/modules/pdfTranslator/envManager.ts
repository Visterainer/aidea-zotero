/* ---------------------------------------------------------------------------
 * pdfTranslator/envManager.ts  –  Python environment detection & installation
 *
 * Manages:  uv → venv → pdf2zh_next
 * Platform: Windows / macOS / Linux
 * -------------------------------------------------------------------------*/

import type { EnvStatus } from "./types";

/* ── Platform detection ── */

const IS_WIN = (typeof Zotero !== "undefined" && Zotero.isWin) ||
               (typeof navigator !== "undefined" && /win/i.test(navigator.platform));
const IS_MAC = (typeof Zotero !== "undefined" && Zotero.isMac) ||
               (typeof navigator !== "undefined" && /mac/i.test(navigator.platform));

/* ── Paths ── */

/**
 * Root directory for the plugin's translation environment.
 * Lives inside Zotero's data directory so it persists across sessions.
 */
function getEnvRoot(): string {
  const dataDir = (typeof Zotero !== "undefined")
    ? Zotero.DataDirectory.dir
    : "";                                      // fallback for tests
  return PathUtils.join(dataDir, "aidea-translate-env");
}

/** Platform-specific Python binary inside the venv */
function getPythonBin(venvDir: string): string {
  return IS_WIN
    ? PathUtils.join(venvDir, "Scripts", "python.exe")
    : PathUtils.join(venvDir, "bin", "python");
}

/** Platform-specific pdf2zh_next binary inside the venv */
function getPdf2zhBin(venvDir: string): string {
  return IS_WIN
    ? PathUtils.join(venvDir, "Scripts", "pdf2zh_next.exe")
    : PathUtils.join(venvDir, "bin", "pdf2zh_next");
}

/** Find uv binary — look for common install locations then PATH */
async function findUvBinary(): Promise<string | null> {
  const candidates: string[] = [];

  if (IS_WIN) {
    const userProfile = (Components.classes as any)["@mozilla.org/process/environment;1"]
      .getService((Components.interfaces as any).nsIEnvironment)
      .get("USERPROFILE");
    candidates.push(PathUtils.join(userProfile, ".local", "bin", "uv.exe"));
    candidates.push(PathUtils.join(userProfile, ".cargo", "bin", "uv.exe"));
  } else {
    const home = (Components.classes as any)["@mozilla.org/process/environment;1"]
      .getService((Components.interfaces as any).nsIEnvironment)
      .get("HOME");
    candidates.push(PathUtils.join(home, ".local", "bin", "uv"));
    candidates.push(PathUtils.join(home, ".cargo", "bin", "uv"));
    candidates.push("/usr/local/bin/uv");
  }

  for (const p of candidates) {
    if (await IOUtils.exists(p)) return p;
  }

  // Fallback: try bare "uv" on PATH (nsIProcess will resolve it)
  return null;
}

/* ── Public API ── */

/**
 * Detect the current state of the translation environment.
 */
export async function checkEnvironment(): Promise<EnvStatus> {
  const uvPath = await findUvBinary();
  if (!uvPath) return { status: "no_uv" };

  const venvDir = getEnvRoot();
  const pythonBin = getPythonBin(venvDir);
  if (!(await IOUtils.exists(pythonBin))) return { status: "no_venv" };

  const pdf2zhBin = getPdf2zhBin(venvDir);
  if (!(await IOUtils.exists(pdf2zhBin))) return { status: "no_pdf2zh" };

  return { status: "ready", venvDir, pdf2zhBin, pythonBin };
}

/**
 * One-click environment setup.
 *
 * Steps:
 *   1. Install uv (if missing)
 *   2. Create venv with Python 3.12
 *   3. Install pdf2zh_next into venv
 *
 * @param onProgress  callback for UI updates
 */
export async function installEnvironment(
  onProgress: (step: string, detail: string) => void,
): Promise<void> {
  /* Step 1: ensure uv is available */
  let uvPath = await findUvBinary();
  if (!uvPath) {
    onProgress("install_uv", "Installing uv package manager...");
    await installUv();
    uvPath = await findUvBinary();
    if (!uvPath) throw new Error("uv installation failed — please install manually");
  }
  onProgress("install_uv", "✅ uv ready");

  /* Step 2: create venv */
  const venvDir = getEnvRoot();
  const pythonBin = getPythonBin(venvDir);
  if (!(await IOUtils.exists(pythonBin))) {
    onProgress("create_venv", "Creating Python 3.12 environment...");
    await runCmd(uvPath, ["venv", venvDir, "--python", "3.12"]);
  }
  onProgress("create_venv", "✅ Python environment ready");

  /* Step 3: install pdf2zh_next */
  const pdf2zhBin = getPdf2zhBin(venvDir);
  if (!(await IOUtils.exists(pdf2zhBin))) {
    onProgress("install_pkg", "Installing pdf2zh_next (this may take a few minutes)...");
    await runCmd(uvPath, ["pip", "install", "pdf2zh_next", "--python", pythonBin]);
  }
  onProgress("install_pkg", "✅ pdf2zh_next ready");
}

/* ── Helpers ── */

/** Run uv install script (platform-specific) */
async function installUv(): Promise<void> {
  if (IS_WIN) {
    await runCmd("powershell.exe", [
      "-ExecutionPolicy", "ByPass",
      "-c", "irm https://astral.sh/uv/install.ps1 | iex",
    ]);
  } else {
    await runCmd("/bin/sh", [
      "-c", "curl -LsSf https://astral.sh/uv/install.sh | sh",
    ]);
  }
}

/**
 * Spawn a process and wait for it to complete.
 * Throws on non-zero exit code.
 */
function runCmd(exe: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const file = (Components.classes as any)["@mozilla.org/file/local;1"]
        .createInstance((Components.interfaces as any).nsIFile);
      file.initWithPath(exe);
      const proc = (Components.classes as any)["@mozilla.org/process/util;1"]
        .createInstance((Components.interfaces as any).nsIProcess);
      proc.init(file);

      const observer = {
        observe(_subject: unknown, topic: string) {
          if (topic === "process-finished") {
            if (proc.exitValue === 0) resolve();
            else reject(new Error(`${exe} exited with code ${proc.exitValue}`));
          } else if (topic === "process-failed") {
            reject(new Error(`${exe} failed to start`));
          }
        },
      };

      proc.runAsync(args, args.length, observer);
    } catch (err) {
      reject(err);
    }
  });
}

/* ── Re-exports for tests / other modules ── */
export { getEnvRoot, getPythonBin, getPdf2zhBin, findUvBinary };
