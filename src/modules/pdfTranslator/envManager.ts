/* ---------------------------------------------------------------------------
 * pdfTranslator/envManager.ts  –  Python environment detection & installation
 *
 * Manages:  uv → venv → pdf2zh_next
 * Platform: Windows / macOS / Linux
 * -------------------------------------------------------------------------*/

import type { EnvStatus } from "./types";

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
 * Clean up corrupted distribution directories in site-packages.
 *
 * When pip install is interrupted mid-way, it can leave behind partial
 * `.dist-info` directories with a tilde (`~`) prefix (e.g. `~ympy` for sympy,
 * `~penai` for openai).  These trigger "Ignoring invalid distribution" warnings
 * and can sometimes interfere with dependency resolution.
 *
 * This function scans the given site-packages directory and removes any
 * tilde-prefixed entries.
 */
async function cleanCorruptedDistributions(
  sitePackagesDir: string,
  onProgress: (step: string, detail: string) => void,
): Promise<void> {
  try {
    if (!(await IOUtils.exists(sitePackagesDir))) return;
    const children = await IOUtils.getChildren(sitePackagesDir);
    const corrupted = children.filter((child: string) => {
      const name = child.split(/[\\/]/).pop() || "";
      return name.startsWith("~");
    });
    if (corrupted.length === 0) return;
    onProgress(
      "install_pkg",
      `🧹 Cleaning ${corrupted.length} corrupted distribution(s) from site-packages...`,
    );
    for (const dir of corrupted) {
      const name = dir.split(/[\\/]/).pop() || dir;
      try {
        await IOUtils.remove(dir, { recursive: true });
        onProgress("install_pkg", `   Removed: ${name}`);
      } catch {
        onProgress("install_pkg", `   ⚠️ Could not remove: ${name}`);
      }
    }
  } catch {
    // Best effort — don’t block the install if listing fails
  }
}

/**
 * Verify pdf2zh_next package is properly installed by running `pip show`.
 *
 * This is much lighter than `pdf2zh_next --version` because it only checks
 * package metadata without importing the entire dependency chain (babeldoc,
 * gradio, pymupdf, pydantic, etc. — 20+ packages).
 *
 * Only called from installEnvironment (button-triggered), never on tab switch.
 * Returns an object with `ok` flag and optional diagnostic `detail` on failure.
 */
async function verifyPdf2zhInstall(
  exe: string,
  args: string[],
): Promise<{ ok: boolean; detail?: string }> {
  try {
    const stderr = await runCmd(exe, args);
    return { ok: true, detail: stderr };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Diagnostic: list files in the bin/Scripts directory that match a prefix.
 *
 * Called when the expected pdf2zh_next binary is missing after install to
 * reveal whether the entry point was created under a different name.
 */
async function listBinDirDiagnostic(
  binDir: string,
  prefix: string,
  onProgress: (step: string, detail: string) => void,
): Promise<void> {
  try {
    if (!(await IOUtils.exists(binDir))) {
      onProgress("install_pkg", `   🔍 bin dir does not exist: ${binDir}`);
      return;
    }
    const children = await IOUtils.getChildren(binDir);
    const matching = children.filter((child: string) => {
      const name = (child.split(/[\\/]/).pop() || "").toLowerCase();
      return name.includes(prefix.toLowerCase());
    });
    if (matching.length === 0) {
      onProgress(
        "install_pkg",
        `   🔍 No '${prefix}*' files found in: ${binDir}`,
      );
      onProgress(
        "install_pkg",
        `   🔍 Total files in bin/: ${children.length}`,
      );
    } else {
      onProgress(
        "install_pkg",
        `   🔍 Found ${matching.length} '${prefix}*' file(s) in ${binDir}:`,
      );
      for (const f of matching) {
        const name = f.split(/[\\/]/).pop() || f;
        try {
          const info = await IOUtils.stat(f);
          onProgress("install_pkg", `      ${name} (${info.size ?? 0} bytes)`);
        } catch {
          onProgress("install_pkg", `      ${name} (stat failed)`);
        }
      }
    }
  } catch {
    onProgress("install_pkg", `   🔍 Failed to list bin directory: ${binDir}`);
  }
}

/** Find uv binary — look for common install locations then PATH */
async function findUvBinary(): Promise<string | null> {
  const candidates: string[] = [];

  if (IS_WIN) {
    const userProfile = (Components.classes as any)[
      "@mozilla.org/process/environment;1"
    ]
      .getService((Components.interfaces as any).nsIEnvironment)
      .get("USERPROFILE");
    if (typeof userProfile === "string" && userProfile.trim()) {
      candidates.push(PathUtils.join(userProfile, ".local", "bin", "uv.exe"));
      candidates.push(PathUtils.join(userProfile, ".cargo", "bin", "uv.exe"));
    }
  } else {
    const home = (Components.classes as any)[
      "@mozilla.org/process/environment;1"
    ]
      .getService((Components.interfaces as any).nsIEnvironment)
      .get("HOME");
    if (typeof home === "string" && home.trim()) {
      candidates.push(PathUtils.join(home, ".local", "bin", "uv"));
      candidates.push(PathUtils.join(home, ".cargo", "bin", "uv"));
    }
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
 *
 * Checks conda environment first (preferred), then falls back to uv-managed venv.
 * Collects step-by-step diagnostics so callers can display useful debug info.
 */
export async function checkEnvironment(): Promise<EnvStatus> {
  const diagnostics: string[] = [];
  let hasPythonButNoPdf2zh = false;

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

/**
 * One-click environment setup.
 *
 * Strategy (layered fallback):
 *   1. Try conda: find/install Miniconda → accept ToS → create env → install pdf2zh_next
 *   2. Try uv:   install uv → create venv → install pdf2zh_next
 *
 * @param onProgress  callback for UI updates
 */
export async function installEnvironment(
  onProgress: (step: string, detail: string) => void,
): Promise<void> {
  /* ── Strategy 1: Miniconda (preferred) ── */
  let condaPath = await findCondaBinary();
  if (!condaPath) {
    onProgress(
      "install_conda",
      "Installing Miniconda (this may take a few minutes)...",
    );
    try {
      await installMiniconda();
      condaPath = await findCondaBinary();
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      onProgress("install_conda", `⚠️ Miniconda install failed: ${reason}`);
      condaPath = null;
    }
  }

  if (condaPath) {
    onProgress("install_conda", "✅ conda ready");

    /* Accept Conda ToS (prevents interactive hang) */
    onProgress("conda_tos", "Accepting conda Terms of Service...");
    await acceptCondaToS(condaPath);
    onProgress("conda_tos", "✅ ToS accepted");

    /* Create or repair conda environment */
    const envDir = await resolveCondaInstallDir();
    const pythonBin = getCondaPythonBin(envDir);
    if (!(await IOUtils.exists(pythonBin))) {
      // Clean corrupted package cache (from previous interrupted downloads)
      onProgress("create_venv", "Cleaning conda cache...");
      try {
        await runCondaCmd(condaPath, ["clean", "--all", "-y"]);
      } catch {
        /* best effort — old conda versions may not support all flags */
      }

      if (await isCondaPrefixDir(envDir)) {
        onProgress("create_venv", "Repairing existing conda environment...");
        await runCondaCmd(condaPath, [
          "install",
          "-p",
          envDir,
          "python=3.12",
          "-y",
          "--override-channels",
          "--channel",
          "defaults",
        ]);
      } else {
        await ensureDirAbsent(envDir, onProgress);
        onProgress("create_venv", "Creating Python 3.12 conda environment...");
        await runCondaCmd(condaPath, [
          "create",
          "-p",
          envDir,
          "python=3.12",
          "-y",
          "--override-channels",
          "--channel",
          "defaults",
        ]);
      }
    }
    onProgress("create_venv", "✅ Python environment ready");

    /* Install / verify pdf2zh_next via pip inside conda env */
    const pdf2zhBin = getCondaPdf2zhBin(envDir);
    const pipBin = IS_WIN
      ? PathUtils.join(envDir, "Scripts", "pip.exe")
      : PathUtils.join(envDir, "bin", "pip");
    onProgress("install_pkg", "Verifying pdf2zh_next...");
    const condaCheck = await verifyPdf2zhInstall(pipBin, [
      "show",
      "pdf2zh-next",
    ]);
    const condaBinOk = await isPdf2zhBinUsable(pdf2zhBin);
    onProgress(
      "install_pkg",
      `   pip show: ${condaCheck.ok ? "OK" : "FAIL"} | binary: ${condaBinOk ? "OK" : "MISSING/INVALID"}`,
    );
    // Reinstall if either pip metadata or binary is missing/broken
    const needsInstall = !condaCheck.ok || !condaBinOk;
    if (needsInstall) {
      if (condaCheck.ok && !condaBinOk) {
        // pip show OK but binary missing — interrupted install left metadata but no entry_point script
        onProgress(
          "install_pkg",
          `⚠️ Package metadata exists but binary missing: ${pdf2zhBin}`,
        );
        onProgress(
          "install_pkg",
          "Force-reinstalling pdf2zh_next to regenerate binary...",
        );
      } else if (condaBinOk) {
        onProgress(
          "install_pkg",
          "Broken pdf2zh_next detected, reinstalling...",
        );
        try {
          await IOUtils.remove(pdf2zhBin);
        } catch {
          /* ignore */
        }
      } else {
        onProgress(
          "install_pkg",
          "Installing pdf2zh_next (this may take a few minutes)...",
        );
      }
      // Clean corrupted distributions from interrupted previous installs
      const condaSitePackages = IS_WIN
        ? PathUtils.join(envDir, "Lib", "site-packages")
        : PathUtils.join(envDir, "lib", `python3.12`, "site-packages");
      await cleanCorruptedDistributions(condaSitePackages, onProgress);
      // --force-reinstall handles partially installed packages from interrupted installs
      const pipInstallStderr = await runCmd(pipBin, [
        "install",
        "--force-reinstall",
        "pdf2zh_next",
      ]);
      if (pipInstallStderr) {
        // Show pip's stderr output (warnings, errors) in the console
        for (const line of pipInstallStderr.split("\n").slice(-20)) {
          if (line.trim()) onProgress("install_pkg", `   pip: ${line.trim()}`);
        }
      }
      // Verify pip metadata after reinstall
      const recheck = await verifyPdf2zhInstall(pipBin, [
        "show",
        "pdf2zh-next",
      ]);
      if (!recheck.ok) {
        onProgress(
          "install_pkg",
          `❌ pip show failed after reinstall: ${recheck.detail || "unknown"}`,
        );
        throw new Error(
          "pdf2zh_next installed but package verification failed (pip show).\n" +
            (recheck.detail || "No additional details."),
        );
      }
    }
    // Verify binary was actually generated
    const condaBinFinal = await isPdf2zhBinUsable(pdf2zhBin);
    if (!condaBinFinal) {
      onProgress(
        "install_pkg",
        `❌ pdf2zh_next binary missing or invalid after install: ${pdf2zhBin}`,
      );
      // Diagnostic: list bin directory contents to find actual entry point name
      const binDir = IS_WIN
        ? PathUtils.join(envDir, "Scripts")
        : PathUtils.join(envDir, "bin");
      await listBinDirDiagnostic(binDir, "pdf2zh", onProgress);
      throw new Error(
        `pdf2zh_next package installed but binary not found or invalid at: ${pdf2zhBin}\n` +
          `Try running: pip install --force-reinstall pdf2zh_next`,
      );
    }
    onProgress("install_pkg", `✅ pdf2zh_next ready (${pdf2zhBin})`);

    // Final cross-check: run checkEnvironment to confirm everything is coherent
    const condaFinalCheck = await checkEnvironment();
    if (condaFinalCheck.status !== "ready") {
      const diag = condaFinalCheck.diagnostics || [];
      for (const line of diag) {
        onProgress("install_pkg", `   ${line}`);
      }
      throw new Error(
        `Environment installed but final verification failed (status: ${condaFinalCheck.status}).`,
      );
    }
    return;
  }

  /* ── Strategy 2: uv fallback ── */
  onProgress("install_conda", "⚠️ Miniconda unavailable, trying uv...");

  let uvPath = await findUvBinary();
  if (!uvPath) {
    onProgress("install_uv", "Installing uv package manager...");
    await installUv();
    uvPath = await findUvBinary();
    if (!uvPath) {
      throw new Error(
        "Neither Miniconda nor uv could be installed. " +
          "Please install one manually:\n" +
          "  • Miniconda: https://docs.conda.io/en/latest/miniconda.html\n" +
          "  • uv: https://docs.astral.sh/uv/getting-started/",
      );
    }
  }
  onProgress("install_uv", "✅ uv ready");

  const venvDir = getEnvRoot();
  const pythonBin = getPythonBin(venvDir);
  if (!(await IOUtils.exists(pythonBin))) {
    // Clean up incomplete venv from a previously interrupted install
    try {
      await IOUtils.remove(venvDir, { recursive: true });
    } catch {
      /* may not exist */
    }
    onProgress("create_venv", "Creating Python 3.12 environment...");
    await runCmd(uvPath, ["venv", venvDir, "--python", "3.12"]);
  }
  onProgress("create_venv", "✅ Python environment ready");

  const pdf2zhBin = getPdf2zhBin(venvDir);
  onProgress("install_pkg", "Verifying pdf2zh_next...");
  const uvCheck = await verifyPdf2zhInstall(uvPath, [
    "pip",
    "show",
    "pdf2zh-next",
    "--python",
    pythonBin,
  ]);
  const uvBinOk = await isPdf2zhBinUsable(pdf2zhBin);
  onProgress(
    "install_pkg",
    `   pip show: ${uvCheck.ok ? "OK" : "FAIL"} | binary: ${uvBinOk ? "OK" : "MISSING/INVALID"}`,
  );
  // Reinstall if either pip metadata or binary is missing/broken
  const uvNeedsInstall = !uvCheck.ok || !uvBinOk;
  if (uvNeedsInstall) {
    if (uvCheck.ok && !uvBinOk) {
      // pip show OK but binary missing — interrupted install left metadata but no entry_point script
      onProgress(
        "install_pkg",
        `⚠️ Package metadata exists but binary missing: ${pdf2zhBin}`,
      );
      onProgress(
        "install_pkg",
        "Force-reinstalling pdf2zh_next to regenerate binary...",
      );
    } else if (uvBinOk) {
      onProgress("install_pkg", "Broken pdf2zh_next detected, reinstalling...");
      try {
        await IOUtils.remove(pdf2zhBin);
      } catch {
        /* ignore */
      }
    } else {
      onProgress(
        "install_pkg",
        "Installing pdf2zh_next (this may take a few minutes)...",
      );
    }
    // Clean corrupted distributions from interrupted previous installs
    const uvSitePackages = IS_WIN
      ? PathUtils.join(venvDir, "Lib", "site-packages")
      : PathUtils.join(venvDir, "lib", `python3.12`, "site-packages");
    await cleanCorruptedDistributions(uvSitePackages, onProgress);
    const uvPipStderr = await runCmd(uvPath, [
      "pip",
      "install",
      "--force-reinstall",
      "pdf2zh_next",
      "--python",
      pythonBin,
    ]);
    if (uvPipStderr) {
      for (const line of uvPipStderr.split("\n").slice(-20)) {
        if (line.trim()) onProgress("install_pkg", `   pip: ${line.trim()}`);
      }
    }
    // Verify pip metadata after reinstall
    const uvRecheck = await verifyPdf2zhInstall(uvPath, [
      "pip",
      "show",
      "pdf2zh-next",
      "--python",
      pythonBin,
    ]);
    if (!uvRecheck.ok) {
      onProgress(
        "install_pkg",
        `❌ pip show failed after reinstall: ${uvRecheck.detail || "unknown"}`,
      );
      throw new Error(
        "pdf2zh_next installed but package verification failed (pip show).\n" +
          (uvRecheck.detail || "No additional details."),
      );
    }
  }
  // Verify binary was actually generated
  const uvBinFinal = await isPdf2zhBinUsable(pdf2zhBin);
  if (!uvBinFinal) {
    onProgress(
      "install_pkg",
      `❌ pdf2zh_next binary missing or invalid after install: ${pdf2zhBin}`,
    );
    // Diagnostic: list bin directory contents to find actual entry point name
    const uvBinDir = IS_WIN
      ? PathUtils.join(venvDir, "Scripts")
      : PathUtils.join(venvDir, "bin");
    await listBinDirDiagnostic(uvBinDir, "pdf2zh", onProgress);
    throw new Error(
      `pdf2zh_next package installed but binary not found or invalid at: ${pdf2zhBin}\n` +
        `Try running: uv pip install --force-reinstall pdf2zh_next`,
    );
  }
  onProgress("install_pkg", `✅ pdf2zh_next ready (${pdf2zhBin})`);

  // Final cross-check: run checkEnvironment to confirm everything is coherent
  const uvFinalCheck = await checkEnvironment();
  if (uvFinalCheck.status !== "ready") {
    const diag = uvFinalCheck.diagnostics || [];
    for (const line of diag) {
      onProgress("install_pkg", `   ${line}`);
    }
    throw new Error(
      `Environment installed but final verification failed (status: ${uvFinalCheck.status}).`,
    );
  }
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

/**
 * Run a conda command.
 *
 * On Windows: `python.exe -m conda <args>`  (condaPath = base python.exe)
 * On Unix:    `conda <args>`                 (condaPath = conda binary)
 */
function runCondaCmd(condaPath: string, args: string[]): Promise<string> {
  if (IS_WIN) {
    // condaPath is the base python.exe
    return runCmd(condaPath, ["-m", "conda", ...args]);
  }
  return runCmd(condaPath, args);
}

/** Get an environment variable via Gecko XPCOM */
function getEnvVar(name: string): string {
  try {
    return (Components.classes as any)["@mozilla.org/process/environment;1"]
      .getService((Components.interfaces as any).nsIEnvironment)
      .get(name);
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

async function resolveCondaInstallDir(): Promise<string> {
  for (const envDir of getCondaEnvDirCandidates()) {
    const pythonBin = getCondaPythonBin(envDir);
    if (await IOUtils.exists(pythonBin)) return envDir;
    if (await isCondaPrefixDir(envDir)) return envDir;
  }
  return getCondaEnvDir();
}

async function isCondaPrefixDir(envDir: string): Promise<boolean> {
  if (!(await IOUtils.exists(envDir))) return false;
  return await IOUtils.exists(PathUtils.join(envDir, "conda-meta"));
}

async function ensureDirAbsent(
  dir: string,
  onProgress: (step: string, detail: string) => void,
): Promise<void> {
  if (!(await IOUtils.exists(dir))) return;
  onProgress("create_venv", "Removing existing incomplete environment...");
  try {
    await IOUtils.remove(dir, { recursive: true });
  } catch {
    /* ignored; checked below */
  }

  if (await IOUtils.exists(dir)) {
    throw new Error(
      `Environment directory already exists and could not be cleaned: ${dir}\n` +
        "This commonly happens when Zotero data is stored in a synced folder such as OneDrive. " +
        "Please remove that directory manually and retry.",
    );
  }
}

/**
 * Install Miniconda silently (platform-specific).
 *
 * Downloads the latest Miniconda installer and runs it in batch/silent mode
 * to avoid any interactive prompts.
 */
async function installMiniconda(): Promise<void> {
  if (IS_WIN) {
    const userProfile = getEnvVar("USERPROFILE") || getPreferredEnvBaseDir();
    if (!userProfile) {
      throw new Error("Cannot resolve USERPROFILE for Miniconda installation");
    }
    const installDir = PathUtils.join(userProfile, "miniconda3");
    const installerUrl =
      "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe";
    const installerPath = PathUtils.join(
      getTempDirOrThrow(),
      "miniconda-installer.exe",
    );
    // Download installer
    await runCmd("powershell.exe", [
      "-ExecutionPolicy",
      "ByPass",
      "-c",
      `Invoke-WebRequest -Uri '${installerUrl}' -OutFile '${installerPath}'`,
    ]);
    // Run silent install
    await runCmd(installerPath, [
      "/InstallationType=JustMe",
      "/AddToPath=0",
      "/RegisterPython=0",
      "/S",
      `/D=${installDir}`,
    ]);
  } else {
    const home = getEnvVar("HOME") || getPreferredEnvBaseDir();
    if (!home) {
      throw new Error("Cannot resolve HOME for Miniconda installation");
    }
    const installDir = PathUtils.join(home, "miniconda3");
    const arch = IS_MAC ? "MacOSX" : "Linux";
    // Detect CPU architecture at runtime (arm64 for Apple Silicon, x86_64 otherwise)
    // We use a script that calls `uname -m` to determine the correct installer
    const installerScript =
      `ARCH=$(uname -m) && ` +
      `URL="https://repo.anaconda.com/miniconda/Miniconda3-latest-${arch}-\${ARCH}.sh" && ` +
      `curl -fsSL "\${URL}" -o /tmp/miniconda.sh && ` +
      `bash /tmp/miniconda.sh -b -p '${installDir}' && ` +
      `rm -f /tmp/miniconda.sh`;
    await runCmd("/bin/sh", ["-c", installerScript]);
  }
}

/**
 * Accept Conda Terms of Service non-interactively.
 *
 * Uses a belt-and-suspenders approach to prevent `CondaToSNonInteractiveError`
 * which blocks `conda create` in non-interactive contexts:
 *
 *   1. `conda config --set plugins.auto_accept_tos yes`  — persistent config
 *   2. `conda tos accept`                                 — explicit acceptance
 *   3. Channel-specific accept for default repos           — covers edge cases
 */
async function acceptCondaToS(condaBin: string): Promise<void> {
  // Step 1: Set auto-accept config flag
  try {
    await runCondaCmd(condaBin, [
      "config",
      "--set",
      "plugins.auto_accept_tos",
      "yes",
    ]);
  } catch {
    // Older conda versions may not have this config key — ignore
  }

  // Step 2: Explicit tos accept
  try {
    await runCondaCmd(condaBin, ["tos", "accept"]);
  } catch {
    // `conda tos` subcommand may not exist on older versions — ignore
  }

  // Step 3: Channel-specific accept for default repositories
  const channels = [
    "https://repo.anaconda.com/pkgs/main",
    "https://repo.anaconda.com/pkgs/r",
  ];
  if (IS_WIN) {
    channels.push("https://repo.anaconda.com/pkgs/msys2");
  }
  for (const ch of channels) {
    try {
      await runCondaCmd(condaBin, [
        "tos",
        "accept",
        "--override-channels",
        "--channel",
        ch,
      ]);
    } catch {
      // ignore — best effort
    }
  }
}

/* ── Shared helpers ── */

/** Run uv install script (platform-specific) */
async function installUv(): Promise<void> {
  if (IS_WIN) {
    await runCmd("powershell.exe", [
      "-ExecutionPolicy",
      "ByPass",
      "-c",
      "irm https://astral.sh/uv/install.ps1 | iex",
    ]);
  } else {
    await runCmd("/bin/sh", [
      "-c",
      "curl -LsSf https://astral.sh/uv/install.sh | sh",
    ]);
  }
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
async function runCmd(exe: string, args: string[]): Promise<string> {
  const tempDir = getTempDirOrThrow();
  const logFile = PathUtils.join(tempDir, "aidea-cmd.log");
  try {
    await IOUtils.remove(logFile);
  } catch {
    /* ignore stale log */
  }
  const quotedArgs = args.map((a) => {
    return a.includes(" ") ? `"${a}"` : a;
  });
  const cmdLine = `"${exe}" ${quotedArgs.join(" ")}`;

  try {
    if (IS_WIN) {
      const scriptPath = PathUtils.join(tempDir, "aidea-cmd.bat");
      const script = `@echo off\r\n${cmdLine} 2>"${logFile}"\r\nexit /b %ERRORLEVEL%\r\n`;
      await IOUtils.writeUTF8(scriptPath, script);
      await _runNsIProcess("C:\\Windows\\System32\\cmd.exe", [
        "/c",
        scriptPath,
      ]);
    } else {
      const scriptPath = PathUtils.join(tempDir, "aidea-cmd.sh");
      const script = `#!/bin/sh\n${cmdLine} 2>"${logFile}"\n`;
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
  }
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

      proc.runAsync(args, args.length, observer);
    } catch (err) {
      reject(err);
    }
  });
}

/* ── Re-exports for tests / other modules ── */
export {
  getEnvRoot,
  getPythonBin,
  getPdf2zhBin,
  findUvBinary,
  findCondaBinary,
  getCondaEnvDir,
  getCondaPythonBin,
  getCondaPdf2zhBin,
  acceptCondaToS,
};
