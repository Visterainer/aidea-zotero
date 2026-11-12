/* ---------------------------------------------------------------------------
 * pdfTranslator/envManager.ts  –  Python environment detection & installation
 *
 * Manages:  uv → venv → pdf2zh_next
 * Platform: Windows / macOS / Linux
 * -------------------------------------------------------------------------*/

import {
  parseUnixPlatformProbe,
  type TranslationPlatformInfo,
} from "./environmentPolicy";
import type { EnvStatus } from "./types";
import { config } from "../../../package.json";

const ACTIVE_ENV_PREF = `${config.prefsPrefix}.translate.envActive`;

export interface ActiveTranslationEnvironment {
  dir: string;
  revision: number;
  sha256: string;
  previous?: { dir: string; revision: number; sha256: string };
}

export function getActiveTranslationEnvironment(): ActiveTranslationEnvironment | null {
  try {
    const raw = Zotero.Prefs.get(ACTIVE_ENV_PREF, true);
    const value = JSON.parse(
      typeof raw === "string" ? raw : "",
    ) as ActiveTranslationEnvironment;
    const root = getRequiredEnvBaseDir();
    if (
      !value ||
      !value.dir.startsWith(PathUtils.join(root, "aidea-translate-env-r")) ||
      !Number.isSafeInteger(value.revision) ||
      !/^[a-f0-9]{64}$/.test(value.sha256)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function activateTranslationEnvironment(
  dir: string,
  revision: number,
  sha256: string,
): void {
  const current = getActiveTranslationEnvironment();
  const previous =
    current && current.dir !== dir
      ? { dir: current.dir, revision: current.revision, sha256: current.sha256 }
      : current?.previous;
  Zotero.Prefs.set(
    ACTIVE_ENV_PREF,
    JSON.stringify({ dir, revision, sha256, previous }),
    true,
  );
}

/* ── Platform detection ── */

const IS_WIN =
  (typeof Zotero !== "undefined" && Zotero.isWin) ||
  (typeof navigator !== "undefined" && /win/i.test(navigator.platform));
const IS_MAC =
  (typeof Zotero !== "undefined" && Zotero.isMac) ||
  (typeof navigator !== "undefined" && /mac/i.test(navigator.platform));

/* ── Paths ── */

/**
 * Root directory for the plugin's translation environment.
 * Prefer Zotero's profile directory because the data directory is often placed
 * inside OneDrive / Dropbox and is a poor fit for conda / venv trees.
 */
function getEnvRoot(): string {
  return PathUtils.join(getRequiredEnvBaseDir(), "aidea-translate-env");
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

/**
 * Check if a pdf2zh_next binary is actually usable (fast check for tab switch).
 *
 * A file can exist but be broken if the user quit Zotero mid-install,
 * leaving behind a 0-byte or partially written executable.
 *
 * Validation strategy — read the first 2 bytes and check the magic header:
 *   • Windows (.exe): `MZ` (PE executable)
 *   • Linux/macOS:    `#!` (shebang — Python entry point script)
 *
 * This is fast (only reads 2 bytes), cross-platform, and catches both
 * empty files and partially written / corrupted binaries.
 */
async function isPdf2zhBinUsable(binPath: string): Promise<boolean> {
  try {
    if (!(await IOUtils.exists(binPath))) return false;
    const bytes = await IOUtils.read(binPath, { maxBytes: 2 });
    if (bytes.length < 2) return false; // empty or too short
    const magic = String.fromCharCode(bytes[0], bytes[1]);
    return IS_WIN ? magic === "MZ" : magic === "#!";
  } catch {
    return false;
  }
}

/**
 * Directories the uv installer may have used, most specific first. The
 * installer honours UV_INSTALL_DIR, XDG_BIN_HOME and XDG_DATA_HOME/../bin
 * before falling back to ~/.local/bin, so looking only at the fallback
 * misses uv on systems that set those (Flatpak does).
 */
export function deriveUvCandidatePaths(params: {
  isWin: boolean;
  home: string;
  env: Record<string, string | undefined>;
}): string[] {
  const exe = params.isWin ? "uv.exe" : "uv";
  const sep = params.isWin ? "\\" : "/";
  const join = (...parts: string[]) =>
    parts
      .map((part, index) =>
        index === 0 ? part.replace(/[\\/]+$/, "") : part.replace(/^[\\/]+/, ""),
      )
      .join(sep);
  const value = (name: string) => String(params.env[name] || "").trim();
  const dirs: string[] = [];
  if (value("UV_INSTALL_DIR")) dirs.push(value("UV_INSTALL_DIR"));
  if (value("XDG_BIN_HOME")) dirs.push(value("XDG_BIN_HOME"));
  if (value("XDG_DATA_HOME"))
    dirs.push(join(value("XDG_DATA_HOME"), "..", "bin"));
  if (params.home) {
    dirs.push(join(params.home, ".local", "bin"));
    dirs.push(join(params.home, ".cargo", "bin"));
  }
  if (!params.isWin) {
    dirs.push("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin");
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const dir of dirs) {
    const candidate = join(dir, exe);
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
  }
  return out;
}

/** Find the uv binary in the locations its installer and package managers use. */
async function findUvBinary(): Promise<string | null> {
  const env: Record<string, string> = {};
  for (const name of ["UV_INSTALL_DIR", "XDG_BIN_HOME", "XDG_DATA_HOME"]) {
    env[name] = getEnvVar(name);
  }
  const candidates = deriveUvCandidatePaths({
    isWin: IS_WIN,
    home: getEnvVar(IS_WIN ? "USERPROFILE" : "HOME"),
    env,
  });
  for (const p of candidates) {
    try {
      if (await IOUtils.exists(p)) return p;
    } catch {
      /* an unusable candidate path is simply skipped */
    }
  }
  return null;
}

/* ── Public API ── */

/**
 * Detect the current state of the translation environment.
 *
 * Checks conda environment first (preferred), then falls back to uv-managed venv.
 * Collects step-by-step diagnostics so callers can display useful debug info.
 */
export async function checkEnvironment(): Promise<EnvStatus> {
  const diagnostics: string[] = [];
  let hasPythonButNoPdf2zh = false;

  // New, validated environments are selected by a single preference write.
  // Keep the previous revision available for rollback and running jobs.
  const active = getActiveTranslationEnvironment();
  for (const candidate of [active, active?.previous]) {
    if (!candidate) continue;
    const pythonBin = getPythonBin(candidate.dir);
    const pdf2zhBin = getPdf2zhBin(candidate.dir);
    if (
      (await IOUtils.exists(pythonBin)) &&
      (await isPdf2zhBinUsable(pdf2zhBin))
    ) {
      return { status: "ready", venvDir: candidate.dir, pythonBin, pdf2zhBin };
    }
    diagnostics.push(
      `✗ selected environment missing or invalid: ${candidate.dir}`,
    );
  }

  /* Try conda environment first (preferred) */
  const condaPath = await findCondaBinary();
  diagnostics.push(
    condaPath ? `✓ conda found: ${condaPath}` : `✗ conda not found`,
  );
  if (condaPath) {
    for (const envDir of getCondaEnvDirCandidates()) {
      diagnostics.push(`  Checking conda env: ${envDir}`);
      const pythonBin = getCondaPythonBin(envDir);
      if (!(await IOUtils.exists(pythonBin))) {
        diagnostics.push(`  ✗ python not found: ${pythonBin}`);
        continue;
      }
      diagnostics.push(`  ✓ python found: ${pythonBin}`);
      const pdf2zhBin = getCondaPdf2zhBin(envDir);
      if (!(await IOUtils.exists(pdf2zhBin))) {
        diagnostics.push(`  ✗ pdf2zh_next binary not found: ${pdf2zhBin}`);
        hasPythonButNoPdf2zh = true;
        continue;
      }
      const binUsable = await isPdf2zhBinUsable(pdf2zhBin);
      if (!binUsable) {
        diagnostics.push(
          `  ✗ pdf2zh_next binary exists but invalid (bad magic header): ${pdf2zhBin}`,
        );
        hasPythonButNoPdf2zh = true;
        continue;
      }
      diagnostics.push(`  ✓ pdf2zh_next binary valid: ${pdf2zhBin}`);
      diagnostics.push(`  → environment ready`);
      return { status: "ready", venvDir: envDir, pdf2zhBin, pythonBin };
    }
  }

  /* Fallback: uv-managed venv */
  const uvPath = await findUvBinary();
  diagnostics.push(uvPath ? `✓ uv found: ${uvPath}` : `✗ uv not found`);
  if (uvPath) {
    for (const venvDir of getUvEnvDirCandidates()) {
      diagnostics.push(`  Checking uv env: ${venvDir}`);
      const pythonBin = getPythonBin(venvDir);
      if (!(await IOUtils.exists(pythonBin))) {
        diagnostics.push(`  ✗ python not found: ${pythonBin}`);
        continue;
      }
      diagnostics.push(`  ✓ python found: ${pythonBin}`);
      const pdf2zhBin = getPdf2zhBin(venvDir);
      if (!(await IOUtils.exists(pdf2zhBin))) {
        diagnostics.push(`  ✗ pdf2zh_next binary not found: ${pdf2zhBin}`);
        hasPythonButNoPdf2zh = true;
        continue;
      }
      const uvBinUsable = await isPdf2zhBinUsable(pdf2zhBin);
      if (!uvBinUsable) {
        diagnostics.push(
          `  ✗ pdf2zh_next binary exists but invalid (bad magic header): ${pdf2zhBin}`,
        );
        hasPythonButNoPdf2zh = true;
        continue;
      }
      diagnostics.push(`  ✓ pdf2zh_next binary valid: ${pdf2zhBin}`);
      diagnostics.push(`  → environment ready`);
      return { status: "ready", venvDir, pdf2zhBin, pythonBin };
    }
  }

  if (hasPythonButNoPdf2zh) {
    return { status: "no_pdf2zh", diagnostics };
  }
  return { status: "no_uv", diagnostics };
}

/* ── Conda helpers ── */

/** Conda environment directory (prefix-based, not named) */
function getCondaEnvDir(): string {
  return PathUtils.join(getRequiredEnvBaseDir(), "aidea-translate-conda-env");
}

/** Python binary inside conda env */
function getCondaPythonBin(envDir: string): string {
  return IS_WIN
    ? PathUtils.join(envDir, "python.exe")
    : PathUtils.join(envDir, "bin", "python");
}

/** pdf2zh_next binary inside conda env */
function getCondaPdf2zhBin(envDir: string): string {
  return IS_WIN
    ? PathUtils.join(envDir, "Scripts", "pdf2zh_next.exe")
    : PathUtils.join(envDir, "bin", "pdf2zh_next");
}

/**
 * Find conda / miniconda base directory's Python executable.
 *
 * On Windows: returns base `python.exe` (all conda commands run via `python -m conda`)
 * On Unix:    returns the `conda` binary itself
 */
async function findCondaBinary(): Promise<string | null> {
  const candidates: string[] = [];

  if (IS_WIN) {
    const userProfile = getEnvVar("USERPROFILE");
    // On Windows we locate the base python.exe — conda is invoked as `python -m conda`
    // This avoids nsIProcess issues with conda.bat/conda.exe wrappers
    const baseDirs: string[] = [];
    if (userProfile) {
      baseDirs.push(PathUtils.join(userProfile, "miniconda3"));
      baseDirs.push(PathUtils.join(userProfile, "Miniconda3"));
      baseDirs.push(PathUtils.join(userProfile, "anaconda3"));
      baseDirs.push(PathUtils.join(userProfile, "Anaconda3"));
    }
    baseDirs.push("C:\\ProgramData\\miniconda3");
    baseDirs.push("C:\\ProgramData\\Miniconda3");
    for (const base of baseDirs) {
      candidates.push(PathUtils.join(base, "python.exe"));
    }
  } else {
    const home = getEnvVar("HOME");
    if (home) {
      candidates.push(PathUtils.join(home, "miniconda3", "bin", "conda"));
      candidates.push(PathUtils.join(home, "anaconda3", "bin", "conda"));
    }
    candidates.push("/opt/miniconda3/bin/conda");
    candidates.push("/opt/anaconda3/bin/conda");
    if (IS_MAC) {
      candidates.push("/opt/homebrew/Caskroom/miniconda/base/bin/conda");
    }
    candidates.push("/usr/local/bin/conda");
  }

  for (const p of candidates) {
    if (await IOUtils.exists(p)) return p;
  }
  return null;
}

/** Get an environment variable via Gecko XPCOM */
function getEnvVar(name: string): string {
  try {
    return String(
      (Components.classes as any)["@mozilla.org/process/environment;1"]
        .getService((Components.interfaces as any).nsIEnvironment)
        .get(name) || "",
    ).trim();
  } catch {
    return "";
  }
}

function getPreferredEnvBaseDir(): string {
  const zotero =
    typeof Zotero !== "undefined"
      ? (Zotero as {
          Profile?: { dir?: string };
          DataDirectory?: { dir?: string };
          getTempDirectory?: () => { path?: string } | null;
        })
      : null;

  const profileDir = zotero?.Profile?.dir;
  if (typeof profileDir === "string" && profileDir.trim()) {
    return profileDir.trim();
  }

  const dataDir = zotero?.DataDirectory?.dir;
  if (typeof dataDir === "string" && dataDir.trim()) {
    return dataDir.trim();
  }

  const tempDir = zotero?.getTempDirectory?.()?.path;
  if (typeof tempDir === "string" && tempDir.trim()) {
    return tempDir.trim();
  }

  const envHome = getEnvVar(IS_WIN ? "USERPROFILE" : "HOME");
  if (envHome) {
    return envHome;
  }

  const platformTempDir = String(
    (globalThis as any).PathUtils?.tempDir || "",
  ).trim();
  if (platformTempDir) {
    return platformTempDir;
  }

  return "";
}

function getRequiredEnvBaseDir(): string {
  const baseDir = getPreferredEnvBaseDir().trim();
  if (baseDir) return baseDir;
  throw new Error(
    "Cannot resolve environment base directory (profile/data/temp directory is empty).",
  );
}

function getLegacyDataDir(): string {
  const dataDir =
    typeof Zotero !== "undefined"
      ? String(Zotero.DataDirectory?.dir || "").trim()
      : "";
  if (!dataDir) return "";
  return dataDir === getPreferredEnvBaseDir() ? "" : dataDir;
}

function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    const key = path.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }
  return result;
}

function getCondaEnvDirCandidates(): string[] {
  const legacyDataDir = getLegacyDataDir();
  return dedupePaths([
    getCondaEnvDir(),
    legacyDataDir
      ? PathUtils.join(legacyDataDir, "aidea-translate-conda-env")
      : "",
  ]);
}

function getUvEnvDirCandidates(): string[] {
  const legacyDataDir = getLegacyDataDir();
  return dedupePaths([
    getEnvRoot(),
    legacyDataDir ? PathUtils.join(legacyDataDir, "aidea-translate-env") : "",
  ]);
}

/* ── Shared helpers ── */

/** Run uv install script (platform-specific) */
/**
 * POSIX sh has no pipefail, so `curl | sh` reports success when the download
 * fails. Download to a file first, and fall back to wget where curl is
 * missing (stock Debian/Ubuntu).
 */
export const UV_UNIX_INSTALL_SCRIPT =
  'set -e; tmp="$(mktemp)"; trap \'rm -f "$tmp"\' EXIT; ' +
  "if command -v curl >/dev/null 2>&1; then " +
  'curl -LsSf --connect-timeout 20 --max-time 600 https://astral.sh/uv/install.sh -o "$tmp"; ' +
  'else wget -q -T 30 -O "$tmp" https://astral.sh/uv/install.sh; fi; ' +
  'sh "$tmp"';

async function installUv(): Promise<void> {
  if (IS_WIN) {
    await runCmd(
      `${getWindowsSystemRoot()}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "ByPass",
        "-c",
        "irm https://astral.sh/uv/install.ps1 | iex",
      ],
    );
  } else {
    await runCmd("/bin/sh", ["-c", UV_UNIX_INSTALL_SCRIPT]);
  }
}

function getWindowsSystemRoot(): string {
  return (
    getEnvVar("SystemRoot") ||
    getEnvVar("windir") ||
    "C:\\Windows"
  ).replace(/[\\/]+$/, "");
}

/**
 * The Python to request from uv. Most of the pinned packages publish no
 * win_arm64 wheels, while uv on Windows ARM64 prefers a native ARM64
 * interpreter; an x86-64 interpreter runs under emulation and can use the
 * regular Windows wheels.
 */
export function resolveUvPythonRequest(
  version: string,
  platform: { isWin: boolean; processorArchitecture: string[] },
): string {
  const isArm64 = platform.processorArchitecture.some(
    (value) => String(value || "").toUpperCase() === "ARM64",
  );
  return platform.isWin && isArm64
    ? `cpython-${version}-windows-x86_64-none`
    : version;
}

export function getUvPythonRequest(version: string): string {
  return resolveUvPythonRequest(version, {
    isWin: IS_WIN,
    processorArchitecture: [
      getEnvVar("PROCESSOR_ARCHITECTURE"),
      // Set when an x64 Zotero itself runs emulated on ARM64 Windows.
      getEnvVar("PROCESSOR_ARCHITEW6432"),
    ],
  });
}

/**
 * What the installer needs to know about this machine. Anything that cannot
 * be determined is left out, which the policy treats as "allowed to try".
 */
export async function detectTranslationPlatform(): Promise<TranslationPlatformInfo> {
  if (IS_WIN) {
    return {
      os: "windows",
      arch: [
        getEnvVar("PROCESSOR_ARCHITECTURE"),
        // The real machine type when a 32-bit or emulated Zotero is running.
        getEnvVar("PROCESSOR_ARCHITEW6432"),
      ],
    };
  }
  const os = (Zotero as unknown as { isMac?: boolean }).isMac
    ? "macos"
    : "linux";
  try {
    // runCmd captures stderr, so the probe writes there.
    const output = await runCmd("/bin/sh", [
      "-c",
      "{ uname -m; uname -r; getconf GNU_LIBC_VERSION 2>/dev/null || ldd --version 2>&1 | head -n 1; } 1>&2",
    ]);
    return parseUnixPlatformProbe(os, output);
  } catch {
    return { os, arch: [] };
  }
}

export async function ensureUvBinary(): Promise<string> {
  let uvPath = await findUvBinary();
  if (!uvPath) {
    await installUv();
    uvPath = await findUvBinary();
  }
  if (!uvPath) throw new Error("uv installer completed, but uv was not found");
  return uvPath;
}

/**
 * Spawn a process and wait for it to complete.
 * Throws on non-zero exit code.
 *
 * Writes a temp script and executes via the system shell:
 *   - Windows: .bat → cmd.exe /c
 *   - Unix:    .sh  → /bin/sh
 * This avoids all nsIProcess issues with python.exe, conda.bat, etc.
 * stderr is captured to a temp log file for diagnostics.
 *
 * @returns The stderr output (may be empty). Returned even on success so
 *          callers can surface pip warnings etc. to the user.
 */
export async function runCmd(
  exe: string,
  args: string[],
  env?: Record<string, string>,
): Promise<string> {
  const tempDir = getTempDirOrThrow();
  const commandId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const logFile = PathUtils.join(tempDir, `aidea-cmd-${commandId}.log`);
  try {
    await IOUtils.remove(logFile);
  } catch {
    /* ignore stale log */
  }
  const quotedArgs = args.map((a) =>
    IS_WIN ? `"${a.replace(/"/g, '""')}"` : `'${a.replace(/'/g, "'\\''")}'`,
  );
  const cmdLine = `"${exe}" ${quotedArgs.join(" ")}`;
  const scriptPath = PathUtils.join(
    tempDir,
    `aidea-cmd-${commandId}.${IS_WIN ? "bat" : "sh"}`,
  );

  try {
    if (IS_WIN) {
      // cmd.exe parses the script in the OEM code page unless told otherwise,
      // which corrupts non-ASCII paths (e.g. C:\Users\张三).
      const script = `@echo off\r\nchcp 65001 >nul\r\n${buildEnvLines(env, true)}${cmdLine} 2>"${logFile}"\r\nexit /b %ERRORLEVEL%\r\n`;
      await IOUtils.writeUTF8(scriptPath, script);
      await _runNsIProcess(`${getWindowsSystemRoot()}\\System32\\cmd.exe`, [
        "/c",
        scriptPath,
      ]);
    } else {
      const script = `#!/bin/sh\n${buildEnvLines(env, false)}${cmdLine} 2>"${logFile}"\n`;
      await IOUtils.writeUTF8(scriptPath, script);
      await _runNsIProcess("/bin/chmod", ["+x", scriptPath]);
      await _runNsIProcess("/bin/sh", [scriptPath]);
    }
    // Success — return stderr content for informational purposes
    return await readCommandLog(logFile);
  } catch (err) {
    const details = await readCommandLog(logFile);
    if (!details) throw err;
    const prefix = err instanceof Error ? err.message : String(err);
    throw new Error(`${prefix}\n${details}`, { cause: err });
  } finally {
    try {
      await IOUtils.remove(scriptPath);
    } catch {
      /* best effort */
    }
    try {
      await IOUtils.remove(logFile);
    } catch {
      /* best effort */
    }
  }
}

/** Script lines that set environment variables for the command that follows. */
export function buildEnvLines(
  env: Record<string, string> | undefined,
  isWin: boolean,
): string {
  let out = "";
  for (const [name, value] of Object.entries(env || {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue;
    // Values are plain tokens (numbers, URLs); reject anything a shell or
    // cmd.exe would interpret rather than trying to quote it.
    if (!/^[A-Za-z0-9_.:/@+=,-]*$/.test(value)) continue;
    out += isWin ? `set "${name}=${value}"\r\n` : `export ${name}='${value}'\n`;
  }
  return out;
}

function getTempDirOrThrow(): string {
  const tempDir = String(PathUtils.tempDir || "").trim();
  if (tempDir) return tempDir;
  const envTemp = getEnvVar(IS_WIN ? "TEMP" : "TMPDIR") || getEnvVar("TMP");
  if (envTemp) return envTemp;
  throw new Error(
    "Cannot resolve temporary directory (PathUtils.tempDir is empty)",
  );
}

async function readCommandLog(path: string): Promise<string> {
  try {
    if (!(await IOUtils.exists(path))) return "";
    return String(await IOUtils.readUTF8(path)).trim();
  } catch {
    return "";
  }
}

/**
 * Low-level nsIProcess wrapper — only used for shell executables (cmd.exe, /bin/sh).
 * On Windows, uses startHidden to suppress terminal window pop-ups.
 */
function _runNsIProcess(exe: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const file = (Components.classes as any)[
        "@mozilla.org/file/local;1"
      ].createInstance((Components.interfaces as any).nsIFile);
      file.initWithPath(exe);
      const proc = (Components.classes as any)[
        "@mozilla.org/process/util;1"
      ].createInstance((Components.interfaces as any).nsIProcess);
      proc.init(file);

      // Suppress terminal window on Windows
      if (IS_WIN) {
        try {
          proc.startHidden = true;
        } catch {
          /* older Gecko may not support */
        }
        try {
          proc.noShell = true;
        } catch {
          /* best effort */
        }
      }

      const observer = {
        observe(_subject: unknown, topic: string) {
          if (topic === "process-finished") {
            if (proc.exitValue === 0) resolve();
            else
              reject(new Error(`Command failed (exit code ${proc.exitValue})`));
          } else if (topic === "process-failed") {
            reject(new Error(`Failed to launch ${exe}`));
          }
        },
      };

      // runwAsync passes UTF-16 arguments; runAsync narrows each character
      // to one byte and corrupts non-ASCII paths (e.g. C:\\Users\\张三).
      if (typeof proc.runwAsync === "function") {
        proc.runwAsync(args, args.length, observer);
      } else {
        proc.runAsync(args, args.length, observer);
      }
    } catch (err) {
      reject(err);
    }
  });
}

/* ── Re-exports for tests / other modules ── */
export {
  getRequiredEnvBaseDir,
  getEnvRoot,
  getPythonBin,
  getPdf2zhBin,
  findUvBinary,
  findCondaBinary,
  getCondaEnvDir,
  getCondaPythonBin,
  getCondaPdf2zhBin,
};
