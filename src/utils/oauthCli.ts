import { runShellCommand, currentPlatform, escapeShellArg } from "./processRunner";

declare const Zotero: any;
declare const ztoolkit: any;
declare const Cc: any;
declare const Ci: any;

type OAuthUiLang = "zh-CN" | "en-US";

/** Read the UI language preference (same logic as preferenceScript.getLang). */
function getUiLang(): OAuthUiLang {
  try {
    const saved = String(
      Zotero.Prefs.get("extensions.zotero.aidea.uiLanguage", true) || "",
    ).trim();
    if (saved === "en-US") return "en-US";
    if (saved === "zh-CN") return "zh-CN";
    return /^zh/i.test(String((Zotero as any)?.locale || "")) ? "zh-CN" : "en-US";
  } catch {
    return "en-US";
  }
}

/** Copy plain text to the system clipboard via XPCOM. */
function copyToClipboard(text: string): void {
  try {
    const svc = Cc["@mozilla.org/widget/clipboardhelper;1"]?.getService(
      Ci.nsIClipboardHelper,
    ) as { copyString: (v: string) => void } | undefined;
    if (svc) svc.copyString(text);
  } catch (err) {
    ztoolkit?.log?.("AIdea: clipboard copy failed", err);
  }
}

/** Show a brief floating toast in the main Zotero window. Auto-fades after ~2 s. */
function showCopiedToast(lang: OAuthUiLang): void {
  try {
    const win = Zotero.getMainWindow?.() as Window | null;
    if (!win?.document) return;
    const doc = win.document;
    const toast = doc.createElementNS("http://www.w3.org/1999/xhtml", "div") as HTMLDivElement;
    toast.textContent = lang === "zh-CN" ? "\u2705 \u5df2\u590d\u5236\u6388\u6743\u7801" : "\u2705 Code copied";
    Object.assign(toast.style, {
      position: "fixed",
      top: "18px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#1f2937",
      color: "#f9fafb",
      padding: "10px 24px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "600",
      zIndex: "99999",
      boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
      opacity: "1",
      transition: "opacity 0.4s ease",
      pointerEvents: "none",
    });
    (doc.documentElement ?? doc.body)?.appendChild(toast);
    win.setTimeout(() => { toast.style.opacity = "0"; }, 1600);
    win.setTimeout(() => { try { toast.remove(); } catch { /* */ } }, 2200);
  } catch { /* best-effort */ }
}

export type OAuthProviderId = "openai-codex" | "google-gemini-cli" | "qwen" | "github-copilot";

export type OAuthCredential = {
  provider: OAuthProviderId;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  projectId?: string;
  accountId?: string;
  sourcePath?: string;
};

export type ProviderModelOption = {
  id: string;
  label: string;
  apiBase?: string;
  apiKey?: string;
};

export type ProviderAccountSummary = {
  provider: OAuthProviderId;
  label: string;
  account: string;
  status: string;
};

type SupportedPlatform = "windows" | "macos" | "linux";

type ProviderCliSpec = {
  packageName: string;
  executableName: string;
  versionArg: string;
};

type NpmEnvironmentState = {
  platform: SupportedPlatform;
  nodePath: string | null;
  npmPath: string | null;
  nodeVersion: string;
  npmReportedVersion: string;
  npmPackageVersion: string;
  latestNpmVersion: string;
  prefix: string;
  globalRoot: string;
  globalBinDir: string;
};

const PROVIDER_CLI_SPECS: Partial<Record<OAuthProviderId, ProviderCliSpec>> = {
  "openai-codex": {
    packageName: "@openai/codex",
    executableName: "codex",
    versionArg: "--version",
  },
  "google-gemini-cli": {
    packageName: "@google/gemini-cli",
    executableName: "gemini",
    versionArg: "--version",
  },
};

export function normalizeVersionText(raw: string | null | undefined): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const match = text.match(/\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9._-]+)?/);
  return match ? match[0] : "";
}

export function derivePreferredUserNpmPrefix(
  platform: SupportedPlatform,
  home: string,
): string {
  const base = String(home || "").trim();
  if (!base) return "";
  if (platform === "windows") {
    const appData =
      getEnv("APPDATA") || joinPath(base, "AppData", "Roaming", platform);
    return joinPath(appData, "npm", platform);
  }
  return joinPath(base, ".npm-global", platform);
}

export function deriveNpmGlobalRootFromPrefix(
  prefix: string,
  platform: SupportedPlatform,
): string {
  const normalized = String(prefix || "").trim();
  if (!normalized) return "";
  return platform === "windows"
    ? joinPath(normalized, "node_modules", platform)
    : joinPath(normalized, "lib", "node_modules", platform);
}

export function deriveNpmGlobalBinDirFromPrefix(
  prefix: string,
  platform: SupportedPlatform,
): string {
  const normalized = String(prefix || "").trim();
  if (!normalized) return "";
  return platform === "windows" ? normalized : joinPath(normalized, "bin", platform);
}

export function shouldInstallLatestPackageVersion(
  installedVersion: string | null | undefined,
  latestVersion: string | null | undefined,
): boolean {
  const installed = normalizeVersionText(installedVersion);
  const latest = normalizeVersionText(latestVersion);
  if (!installed) return true;
  if (!latest) return false;
  return installed !== latest;
}

export function getProviderCliSpec(
  provider: OAuthProviderId,
): ProviderCliSpec | null {
  return PROVIDER_CLI_SPECS[provider] || null;
}

const PROVIDER_MARKER_PREFIX = "oauth://";

export function providerToMarker(provider: OAuthProviderId): string {
  return `${PROVIDER_MARKER_PREFIX}${provider}`;
}

export function markerToProvider(value: string | undefined | null): OAuthProviderId | null {
  const raw = String(value || "").trim();
  if (raw === providerToMarker("openai-codex") || raw === "openai-codex") return "openai-codex";
  if (raw === providerToMarker("google-gemini-cli") || raw === "google-gemini-cli") {
    return "google-gemini-cli";
  }
  if (raw === providerToMarker("qwen") || raw === "qwen") return "qwen";
  if (raw === providerToMarker("github-copilot") || raw === "github-copilot") return "github-copilot";
  return null;
}

function getFetch(): typeof fetch {
  const globalFetch = (globalThis as any).fetch;
  if (typeof globalFetch === "function") return globalFetch;
  const toolkitFetch = ztoolkit?.getGlobal?.("fetch");
  if (typeof toolkitFetch === "function") return toolkitFetch as typeof fetch;
  throw new Error("fetch is not available in Zotero runtime");
}

function getEnv(name: string): string {
  try {
    const env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
    return String(env.get(name) || "").trim();
  } catch {
    return "";
  }
}

/**
 * Detect the Windows system proxy (from Internet Settings registry) and ensure
 * Zotero's Gecko engine uses the same proxy.  On non-Windows platforms or if
 * no system proxy is configured, this is a no-op.
 *
 * Call this during plugin initialization or before any fetch() to chatgpt.com.
 */
export function ensureZoteroProxyFromSystem(): void {
  try {
    if (currentPlatform() !== "windows") return;
    const prefSvc = Cc["@mozilla.org/preferences-service;1"]?.getService(Ci.nsIPrefBranch);
    if (!prefSvc) return;

    // If the user has already explicitly configured a manual proxy, don't override
    const currentType = prefSvc.getIntPref("network.proxy.type", 0);
    if (currentType === 1) return; // already manual

    // Read system proxy from registry via nsIWindowsRegKey
    const regKey = Cc["@mozilla.org/windows-registry-key;1"]?.createInstance(Ci.nsIWindowsRegKey);
    if (!regKey) return;

    try {
      regKey.open(
        regKey.ROOT_KEY_CURRENT_USER,
        "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
        regKey.ACCESS_READ,
      );
      let proxyServer = "";
      try {
        const enabled = regKey.readIntValue("ProxyEnable");
        if (!enabled) return;
        proxyServer = regKey.readStringValue("ProxyServer").trim();
      } finally {
        regKey.close();
      }

      if (!proxyServer) return;

      // Parse proxy string �?can be "host:port" or "http=host:port;https=host:port"
      let httpHost = "";
      let httpPort = 0;

      if (proxyServer.includes("=")) {
        // Protocol-specific format: "http=host:port;https=host:port"
        for (const part of proxyServer.split(";")) {
          const [proto, hostPort] = part.split("=");
          if (!proto || !hostPort) continue;
          if (proto.trim().toLowerCase() === "http" || proto.trim().toLowerCase() === "https") {
            const [h, p] = hostPort.trim().split(":");
            if (h && p) {
              httpHost = h.trim();
              httpPort = parseInt(p.trim(), 10);
              break;
            }
          }
        }
      } else {
        // Simple format: "host:port"
        const [h, p] = proxyServer.split(":");
        if (h && p) {
          httpHost = h.trim();
          httpPort = parseInt(p.trim(), 10);
        }
      }

      if (!httpHost || !httpPort || !Number.isFinite(httpPort)) return;

      // Apply to Gecko network.proxy.*
      prefSvc.setIntPref("network.proxy.type", 1); // manual
      prefSvc.setCharPref("network.proxy.http", httpHost);
      prefSvc.setIntPref("network.proxy.http_port", httpPort);
      prefSvc.setCharPref("network.proxy.ssl", httpHost);
      prefSvc.setIntPref("network.proxy.ssl_port", httpPort);

      // Read bypass list
      try {
        regKey.open(
          regKey.ROOT_KEY_CURRENT_USER,
          "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
          regKey.ACCESS_READ,
        );
        const bypass = regKey.readStringValue("ProxyOverride").trim();
        regKey.close();
        if (bypass) {
          // Convert IE bypass list ("localhost;127.*;10.*") to Gecko format
          const noProxy = bypass
            .split(";")
            .map((s: string) => s.trim())
            .filter(Boolean)
            .join(", ");
          prefSvc.setCharPref("network.proxy.no_proxies_on", noProxy);
        }
      } catch {
        // bypass list not found, ignore
      }

      ztoolkit?.log?.(`AIdea: Applied system proxy ${httpHost}:${httpPort} to Zotero`);
    } catch {
      // registry read failed, ignore
    }
  } catch {
    // silently ignore any errors
  }
}

function homeDir(): string {
  return getEnv("USERPROFILE") || getEnv("HOME") || "";
}

function joinPath(...parts: Array<string | SupportedPlatform>): string {
  let platform: SupportedPlatform | undefined;
  let pathParts = parts as string[];
  const maybePlatform = parts[parts.length - 1];
  if (
    maybePlatform === "windows" ||
    maybePlatform === "macos" ||
    maybePlatform === "linux"
  ) {
    platform = maybePlatform;
    pathParts = parts.slice(0, -1) as string[];
  }
  const win = (platform || currentPlatform()) === "windows";
  const sep = win ? "\\" : "/";
  return pathParts
    .filter(Boolean)
    .map((part, idx) => {
      if (idx === 0) return part.replace(/[\\/]+$/g, "");
      return part.replace(/^[\\/]+|[\\/]+$/g, "");
    })
    .join(sep);
}

function initLocalFile(path: string) {
  try {
    if (!path) return null;
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    return file;
  } catch {
    return null;
  }
}

function pathExists(path: string): boolean {
  try {
    return Boolean(initLocalFile(path)?.exists());
  } catch {
    return false;
  }
}

function isDirectoryPath(path: string): boolean {
  try {
    const file = initLocalFile(path);
    return Boolean(file?.exists() && file.isDirectory());
  } catch {
    return false;
  }
}

function ensureDirectoryExists(path: string): { ok: boolean; message: string } {
  const normalized = String(path || "").trim();
  if (!normalized) {
    return { ok: false, message: "Directory path is empty" };
  }

  const file = initLocalFile(normalized);
  if (!file) {
    return { ok: false, message: `Invalid directory path: ${normalized}` };
  }
  if (file.exists()) {
    return file.isDirectory()
      ? { ok: true, message: `Directory ready: ${normalized}` }
      : { ok: false, message: `Path exists but is not a directory: ${normalized}` };
  }

  const parentPath = file.parent?.path || "";
  if (parentPath && !pathExists(parentPath)) {
    const parentResult = ensureDirectoryExists(parentPath);
    if (!parentResult.ok) return parentResult;
  }

  try {
    file.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
    return { ok: true, message: `Created directory: ${normalized}` };
  } catch (err) {
    return { ok: false, message: `Failed to create directory ${normalized}: ${String(err)}` };
  }
}

function splitPathEntries(
  value: string,
  platform: SupportedPlatform = currentPlatform(),
): string[] {
  const separator = platform === "windows" ? ";" : ":";
  return String(value || "")
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupePathEntries(
  entries: string[],
  platform: SupportedPlatform = currentPlatform(),
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of entries) {
    const value = String(raw || "").trim();
    if (!value) continue;
    const key = platform === "windows" ? value.toLowerCase() : value;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function setProcessEnv(name: string, value: string): boolean {
  try {
    const env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment) as {
      set?: (k: string, v: string) => void;
    };
    if (typeof env.set !== "function") return false;
    env.set(name, value);
    return true;
  } catch {
    return false;
  }
}

function prependProcessPathEntries(entries: string[]): string[] {
  const platform = currentPlatform();
  const separator = platform === "windows" ? ";" : ":";
  const currentEntries = splitPathEntries(getEnv("PATH"), platform);
  const merged = dedupePathEntries([...entries, ...currentEntries], platform);
  if (merged.join(separator) !== currentEntries.join(separator)) {
    setProcessEnv("PATH", merged.join(separator));
  }
  return merged;
}

function getCommonExecutableDirs(platform: SupportedPlatform): string[] {
  const home = homeDir();
  if (platform === "windows") {
    const appData = getEnv("APPDATA") || joinPath(home, "AppData", "Roaming");
    const localAppData = getEnv("LOCALAPPDATA") || joinPath(home, "AppData", "Local");
    const programFiles = getEnv("ProgramFiles");
    const programFilesX86 = getEnv("ProgramFiles(x86)");
    return dedupePathEntries(
      [
        joinPath(appData, "npm"),
        joinPath(localAppData, "Programs", "nodejs"),
        programFiles ? joinPath(programFiles, "nodejs") : "",
        programFilesX86 ? joinPath(programFilesX86, "nodejs") : "",
      ],
      platform,
    ).filter(isDirectoryPath);
  }

  return dedupePathEntries(
    [
      "/usr/local/bin",
      "/usr/bin",
      "/opt/homebrew/bin",
      home ? joinPath(home, ".local", "bin") : "",
      home ? joinPath(home, ".npm-global", "bin") : "",
    ],
    platform,
  ).filter(isDirectoryPath);
}

function getExecutableFileNames(
  baseName: string,
  platform: SupportedPlatform,
): string[] {
  const normalized = String(baseName || "").trim();
  if (!normalized) return [];
  if (/[\\/]/.test(normalized) || /\.[a-z0-9]+$/i.test(normalized)) {
    return [normalized];
  }
  if (platform === "windows") {
    return [
      `${normalized}.cmd`,
      `${normalized}.exe`,
      `${normalized}.bat`,
      `${normalized}.ps1`,
      normalized,
    ];
  }
  return [normalized];
}

function resolveExecutablePath(
  baseName: string,
  extraDirs: string[] = [],
): string | null {
  const platform = currentPlatform();
  const trimmed = String(baseName || "").trim();
  if (!trimmed) return null;
  if (pathExists(trimmed)) {
    const directDir = initLocalFile(trimmed)?.parent?.path || "";
    if (directDir) prependProcessPathEntries([directDir]);
    return trimmed;
  }

  const searchDirs = dedupePathEntries(
    [
      ...extraDirs,
      ...splitPathEntries(getEnv("PATH"), platform),
      ...getCommonExecutableDirs(platform),
    ],
    platform,
  );

  for (const dir of searchDirs) {
    for (const fileName of getExecutableFileNames(trimmed, platform)) {
      const candidatePath = joinPath(dir, fileName);
      if (!pathExists(candidatePath)) continue;
      prependProcessPathEntries([dir]);
      return candidatePath;
    }
  }
  return null;
}

async function locateExecutableViaShell(baseName: string): Promise<string | null> {
  const platform = currentPlatform();
  const trimmed = String(baseName || "").trim();
  if (!trimmed) return null;
  const command =
    platform === "windows"
      ? `where.exe ${trimmed}`
      : `command -v ${escapeShellArg(trimmed)} 2>/dev/null || which ${escapeShellArg(trimmed)} 2>/dev/null`;
  try {
    const result = await runShellCommand(command, { hidden: true });
    if (result.code !== 0) return null;

    const candidates = String([result.stdout, result.stderr].join("\n"))
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .filter((line) => Boolean(line) && pathExists(line));

    if (!candidates.length) return null;

    // On Windows, `where.exe npm` returns multiple hits: first is the
    // extension-less Unix shebang script which PowerShell cannot execute,
    // followed by npm.cmd which is the correct Windows wrapper.
    // Prefer .cmd > .exe > .bat > .ps1, fall back to the first candidate.
    let chosen = candidates[0];
    if (platform === "windows") {
      const priority = [".cmd", ".exe", ".bat", ".ps1"];
      for (const ext of priority) {
        const hit = candidates.find((c) => c.toLowerCase().endsWith(ext));
        if (hit) { chosen = hit; break; }
      }
    }

    if (!chosen) return null;
    const dir = initLocalFile(chosen)?.parent?.path || "";
    if (dir) prependProcessPathEntries([dir]);
    return chosen;
  } catch {
    return null;
  }
}

function buildExecutableCommand(executablePath: string, args: string[] = []): string {
  const exe = escapeShellArg(executablePath);
  const argText = args.map((arg) => escapeShellArg(arg)).join(" ");
  if (currentPlatform() === "windows") {
    return `& ${exe}${argText ? ` ${argText}` : ""}`;
  }
  return `${exe}${argText ? ` ${argText}` : ""}`;
}

async function runExecutableCommand(
  executablePath: string,
  args: string[],
): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  output: string;
}> {
  const result = await runShellCommand(buildExecutableCommand(executablePath, args), {
    hidden: true,
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  return { ...result, output };
}

async function queryRegistryPackageVersion(
  npmExecutablePath: string,
  packageName: string,
): Promise<string> {
  if (!npmExecutablePath || !packageName) return "";
  try {
    const result = await runExecutableCommand(npmExecutablePath, [
      "view",
      packageName,
      "version",
      "--silent",
    ]);
    return normalizeVersionText(result.output);
  } catch {
    return "";
  }
}

function getPackageJsonPath(globalRoot: string, packageName: string): string {
  const segments = packageName
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return joinPath(globalRoot, ...segments, "package.json");
}

async function readGlobalPackageVersion(
  globalRoot: string,
  packageName: string,
): Promise<string> {
  if (!globalRoot || !packageName) return "";
  const data = await readJsonFile(getPackageJsonPath(globalRoot, packageName));
  return normalizeVersionText(data?.version);
}

function looksLikePermissionError(text: string): boolean {
  const normalized = String(text || "").toLowerCase();
  return (
    normalized.includes("eacces") ||
    normalized.includes("permission denied") ||
    normalized.includes("access is denied") ||
    normalized.includes("operation not permitted") ||
    normalized.includes("sudo")
  );
}

async function persistBinDirToUserPath(binDir: string): Promise<string> {
  const normalized = String(binDir || "").trim();
  if (!normalized) return "Skipped PATH persistence: empty bin dir";

  const platform = currentPlatform();
  if (platform === "windows") {
    const script = [
      `$dir = ${escapeShellArg(normalized)}`,
      "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')",
      "if ($null -eq $userPath) { $userPath = '' }",
      "$parts = @($userPath -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ })",
      "if ($parts -contains $dir) { 'User PATH already contains npm bin dir' }",
      "else {",
      "  $next = @($parts + $dir) | Select-Object -Unique",
      "  [Environment]::SetEnvironmentVariable('Path', ($next -join ';'), 'User')",
      "  'Added npm bin dir to user PATH'",
      "}",
    ].join("; ");
    const result = await runShellCommand(script, { hidden: true });
    return [result.stdout, result.stderr].filter(Boolean).join("\n").trim() || "PATH persistence finished";
  }

  const home = homeDir();
  if (!home) return "Skipped PATH persistence: home directory not found";
  const profileTargets =
    platform === "macos"
      ? [joinPath(home, ".zprofile"), joinPath(home, ".bash_profile"), joinPath(home, ".profile")]
      : [joinPath(home, ".bash_profile"), joinPath(home, ".profile")];
  const line = `export PATH=${escapeShellArg(normalized)}:$PATH`;
  const quotedTargets = profileTargets
    .filter(Boolean)
    .map((target) => escapeShellArg(target))
    .join(" ");
  const script =
    `for file in ${quotedTargets}; do ` +
    `[ -f "$file" ] || touch "$file"; ` +
    `grep -F ${escapeShellArg(line)} "$file" >/dev/null 2>&1 || printf '\\n%s\\n' ${escapeShellArg(line)} >> "$file"; ` +
    "done";
  const result = await runShellCommand(script, { hidden: true });
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim() || "Shell profile PATH updated";
}

async function inspectNpmEnvironment(
  queryLatest = true,
): Promise<NpmEnvironmentState> {
  const platform = currentPlatform();

  // Always inject the preferred user npm bin dir into the process PATH.
  // On macOS/Linux, Zotero is a GUI app launched from Dock/Finder that does
  // NOT read shell profiles (.zprofile, .bash_profile), so persistBinDirToUserPath
  // alone is insufficient.  We must ensure the bin dir is reachable in every
  // Zotero session, even before the directory physically exists (it will be
  // created by ensureNpmDirectories later in the install flow).
  const _home = homeDir();
  const preferredPrefix = derivePreferredUserNpmPrefix(platform, _home);
  const preferredBin = deriveNpmGlobalBinDirFromPrefix(preferredPrefix, platform);
  if (preferredBin) {
    prependProcessPathEntries([preferredBin]);
  }

  prependProcessPathEntries(getCommonExecutableDirs(platform));

  const nodePath =
    (await locateExecutableViaShell("node")) || resolveExecutablePath("node");
  const npmPath =
    (await locateExecutableViaShell("npm")) || resolveExecutablePath("npm");

  let nodeVersion = "";
  if (nodePath) {
    const nodeResult = await runExecutableCommand(nodePath, ["--version"]);
    nodeVersion = normalizeVersionText(nodeResult.output);
  }

  let npmReportedVersion = "";
  let prefix = "";
  let globalRoot = "";
  if (npmPath) {
    const npmVersionResult = await runExecutableCommand(npmPath, ["--version"]);
    npmReportedVersion = normalizeVersionText(npmVersionResult.output);

    const prefixResult = await runExecutableCommand(npmPath, ["config", "get", "prefix"]);
    prefix = String(prefixResult.output || "")
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find(Boolean) || "";

    const rootResult = await runExecutableCommand(npmPath, ["root", "-g"]);
    globalRoot = String(rootResult.output || "")
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find(Boolean) || "";
  }

  if (!globalRoot && prefix) {
    globalRoot = deriveNpmGlobalRootFromPrefix(prefix, platform);
  }
  if (!prefix && globalRoot) {
    const suffix = platform === "windows" ? "\\node_modules" : "/lib/node_modules";
    prefix = globalRoot.endsWith(suffix)
      ? globalRoot.slice(0, -suffix.length)
      : "";
  }

  const globalBinDir = deriveNpmGlobalBinDirFromPrefix(prefix, platform);
  if (globalBinDir) {
    prependProcessPathEntries([globalBinDir]);
  }

  const npmPackageVersion = globalRoot
    ? await readGlobalPackageVersion(globalRoot, "npm")
    : "";
  const latestNpmVersion =
    queryLatest && npmPath ? await queryRegistryPackageVersion(npmPath, "npm") : "";

  return {
    platform,
    nodePath,
    npmPath,
    nodeVersion,
    npmReportedVersion,
    npmPackageVersion,
    latestNpmVersion,
    prefix,
    globalRoot,
    globalBinDir,
  };
}

type ReportFn = ((event: {
  phase: "start" | "done" | "info";
  step: string;
  ok?: boolean;
  output?: string;
}) => void) | undefined;
type AppendFn = (title: string, text: string) => void;

/**
 * Windows: locate or install winget (App Installer).
 * First checks %LOCALAPPDATA%\Microsoft\WindowsApps (winget is often there
 * but not on PATH). If that fails, downloads the latest .msixbundle from
 * the winget-cli GitHub releases and installs it with Add-AppxPackage.
 * Returns true when winget is available after the attempt.
 */
async function tryInstallWinget(
  report: ReportFn,
  append: AppendFn,
): Promise<boolean> {
  const step = "Install winget (Windows App Installer)";
  report?.({ phase: "start", step });

  // 1. winget might already exist in WindowsApps but not be on PATH.
  const localAppData = getEnv("LOCALAPPDATA");
  if (localAppData) {
    const appsDir = joinPath(localAppData, "Microsoft", "WindowsApps");
    const wingetExe = joinPath(appsDir, "winget.exe");
    if (pathExists(wingetExe)) {
      prependProcessPathEntries([appsDir]);
      const msg = "Found winget in WindowsApps and added to PATH.";
      append(step, msg);
      report?.({ phase: "done", step, ok: true, output: msg });
      return true;
    }
  }

  // 2. Download the latest msixbundle from GitHub and install it.
  const script = [
    "$progressPreference = 'silentlyContinue'",
    "try {",
    "  $rel = Invoke-RestMethod 'https://api.github.com/repos/microsoft/winget-cli/releases/latest' -TimeoutSec 30",
    "  $msix = $rel.assets | Where-Object { $_.name -like '*.msixbundle' } | Select-Object -First 1",
    "  if (-not $msix) { throw 'No .msixbundle found in winget-cli release' }",
    "  $tmp = Join-Path $env:TEMP ('winget-' + [System.IO.Path]::GetRandomFileName() + '.msixbundle')",
    "  Invoke-WebRequest -Uri $msix.browser_download_url -OutFile $tmp -TimeoutSec 180",
    "  Add-AppxPackage -Path $tmp -ErrorAction Stop",
    "  'winget installed successfully'",
    "} catch { 'ERROR: ' + $_.Exception.Message }",
  ].join("; ");

  const result = await runShellCommand(script, { hidden: true });
  const output =
    [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
    "(no output)";
  append(step, output);
  const ok = result.code === 0 && !output.startsWith("ERROR:");
  report?.({ phase: "done", step, ok, output });
  return ok;
}

/**
 * macOS / Linux: install Homebrew using the official install script.
 * NONINTERACTIVE=1 suppresses all prompts so no user input is required.
 * After a successful install, /opt/homebrew/bin (Apple Silicon) and
 * /usr/local/bin (Intel) are prepended to the process PATH.
 */
async function tryInstallHomebrew(
  report: ReportFn,
  append: AppendFn,
): Promise<boolean> {
  const step = "Install Homebrew";
  report?.({ phase: "start", step });

  const command =
    `NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`;
  const result = await runShellCommand(command, { hidden: true });
  const output =
    [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
    "(no output)";
  append(step, output);
  report?.({ phase: "done", step, ok: result.code === 0, output });

  if (result.code === 0) {
    // Apple Silicon installs to /opt/homebrew/bin; Intel to /usr/local/bin;
    // Linuxbrew to /home/linuxbrew/.linuxbrew/bin.
    const brewDirs = [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/home/linuxbrew/.linuxbrew/bin",
    ].filter(isDirectoryPath);
    if (brewDirs.length) prependProcessPathEntries(brewDirs);
  }
  return result.code === 0;
}

async function tryInstallNodeRuntime(
  report: ((event: {
    phase: "start" | "done" | "info";
    step: string;
    ok?: boolean;
    output?: string;
  }) => void) | undefined,
  append: (title: string, text: string) => void,
): Promise<boolean> {
  const platform = currentPlatform();
  const plans: Array<{ step: string; command: string }> = [];

  if (platform === "windows") {
    const wingetPath =
      (await locateExecutableViaShell("winget")) || resolveExecutablePath("winget");
    const chocoPath =
      (await locateExecutableViaShell("choco")) || resolveExecutablePath("choco");
    const scoopPath =
      (await locateExecutableViaShell("scoop")) || resolveExecutablePath("scoop");
    if (wingetPath) {
      plans.push({
        step: "Install Node.js via winget",
        command:
          "winget install --id OpenJS.NodeJS.LTS -e --source winget " +
          "--accept-package-agreements --accept-source-agreements --silent --scope user",
      });
    }
    if (chocoPath) {
      plans.push({
        step: "Install Node.js via Chocolatey",
        command: "choco install nodejs-lts -y",
      });
    }
    if (scoopPath) {
      plans.push({
        step: "Install Node.js via Scoop",
        command: "scoop install nodejs-lts",
      });
    }
  } else if (platform === "macos") {
    const brewPath =
      (await locateExecutableViaShell("brew")) || resolveExecutablePath("brew");
    if (brewPath) {
      plans.push({
        step: "Install Node.js via Homebrew",
        command: "brew install node",
      });
    }
  } else {
    const aptPath =
      (await locateExecutableViaShell("apt-get")) || resolveExecutablePath("apt-get");
    const dnfPath =
      (await locateExecutableViaShell("dnf")) || resolveExecutablePath("dnf");
    const yumPath =
      (await locateExecutableViaShell("yum")) || resolveExecutablePath("yum");
    const pacmanPath =
      (await locateExecutableViaShell("pacman")) || resolveExecutablePath("pacman");
    if (aptPath) {
      plans.push({
        step: "Install Node.js/npm via apt-get",
        command:
          "if [ \"$(id -u)\" -eq 0 ]; then apt-get update && apt-get install -y nodejs npm; " +
          "else sudo -n apt-get update && sudo -n apt-get install -y nodejs npm; fi",
      });
    }
    if (dnfPath) {
      plans.push({
        step: "Install Node.js/npm via dnf",
        command:
          "if [ \"$(id -u)\" -eq 0 ]; then dnf install -y nodejs npm; " +
          "else sudo -n dnf install -y nodejs npm; fi",
      });
    }
    if (yumPath) {
      plans.push({
        step: "Install Node.js/npm via yum",
        command:
          "if [ \"$(id -u)\" -eq 0 ]; then yum install -y nodejs npm; " +
          "else sudo -n yum install -y nodejs npm; fi",
      });
    }
    if (pacmanPath) {
      plans.push({
        step: "Install Node.js/npm via pacman",
        command:
          "if [ \"$(id -u)\" -eq 0 ]; then pacman -Sy --noconfirm nodejs npm; " +
          "else sudo -n pacman -Sy --noconfirm nodejs npm; fi",
      });
    }
  }

  if (!plans.length) {
    // No package manager found — try to bootstrap one, then rebuild plans.
    report?.({
      phase: "info",
      step: "No package manager found",
      output: `No supported package manager detected on ${platform}. Attempting to install one automatically…`,
    });

    if (platform === "windows") {
      const ok = await tryInstallWinget(report, append);
      if (ok) {
        const wingetPath =
          (await locateExecutableViaShell("winget")) ||
          resolveExecutablePath("winget");
        if (wingetPath) {
          plans.push({
            step: "Install Node.js via winget",
            command:
              "winget install --id OpenJS.NodeJS.LTS -e --source winget " +
              "--accept-package-agreements --accept-source-agreements --silent --scope user",
          });
        }
      }
    } else if (platform === "macos") {
      const ok = await tryInstallHomebrew(report, append);
      if (ok) {
        const brewPath =
          (await locateExecutableViaShell("brew")) ||
          resolveExecutablePath("brew");
        if (brewPath) {
          plans.push({
            step: "Install Node.js via Homebrew",
            command: "brew install node",
          });
        }
      }
    }
    // Linux: system package managers (apt-get, dnf, …) are OS components
    // that cannot themselves be installed programmatically — leave plans empty.

    if (!plans.length) {
      const hint =
        platform === "windows"
          ? "winget (built into Windows 10/11) could not be installed. Please install Node.js manually from https://nodejs.org or install winget/choco/scoop first."
          : platform === "macos"
            ? "Homebrew could not be installed automatically. Please install it from https://brew.sh or install Node.js manually."
            : "No supported package manager found. Please install Node.js/npm via your system package manager (apt, dnf, yum, pacman…) and retry.";
      append("Install Node.js/npm", hint);
      report?.({
        phase: "done",
        step: "Install Node.js/npm",
        ok: false,
        output: hint,
      });
      return false;
    }
  }

  for (const plan of plans) {
    report?.({ phase: "start", step: plan.step });
    const result = await runShellCommand(plan.command, { hidden: true });
    const output =
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
      "(no output)";
    append(plan.step, `${plan.command}\n\n${output}`);
    report?.({
      phase: "done",
      step: plan.step,
      ok: result.code === 0,
      output,
    });
    if (result.code === 0) {
      prependProcessPathEntries(getCommonExecutableDirs(platform));
      return true;
    }
  }
  return false;
}

async function setNpmPrefix(
  npmExecutablePath: string,
  prefix: string,
): Promise<{
  ok: boolean;
  output: string;
}> {
  const result = await runExecutableCommand(npmExecutablePath, [
    "config",
    "set",
    "prefix",
    prefix,
  ]);
  return { ok: result.code === 0, output: result.output || "(no output)" };
}

async function verifyExecutable(
  executableName: string,
  versionArg: string,
  extraDirs: string[] = [],
): Promise<{
  ok: boolean;
  path: string;
  output: string;
}> {
  const located =
    (await locateExecutableViaShell(executableName)) ||
    resolveExecutablePath(executableName, extraDirs) ||
    "";
  if (!located) {
    return {
      ok: false,
      path: "",
      output: `${executableName} was not found on PATH`,
    };
  }
  const result = await runExecutableCommand(located, [versionArg]);
  return {
    ok: result.code === 0,
    path: located,
    output: result.output || "(no output)",
  };
}

function removeFileIfExists(path: string): boolean {
  try {
    if (!path) return false;
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    if (!file.exists()) return false;
    file.remove(false);
    return true;
  } catch (err) {
    ztoolkit?.log?.("AIdea: removeFileIfExists failed", path, err);
    return false;
  }
}

async function readJsonFile(path: string): Promise<any | null> {
  try {
    const text = typeof Zotero?.File?.getContentsAsync === "function"
      ? await Zotero.File.getContentsAsync(path)
      : Zotero?.File?.getContents?.(path);
    const raw = typeof text === "string" ? text : String(text || "");
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getProviderLabel(provider: OAuthProviderId): string {
  if (provider === "openai-codex") return "ChatGPT (Codex OAuth)";
  if (provider === "google-gemini-cli") return "Gemini (Gemini CLI OAuth)";
  if (provider === "qwen") return "Qwen (通义千问)";
  if (provider === "github-copilot") return "GitHub Copilot";
  return provider;
}

export async function readCodexOAuthCredential(): Promise<OAuthCredential | null> {
  const home = homeDir();
  if (!home) return null;
  const authPath = joinPath(home, ".codex", "auth.json");
  const data = await readJsonFile(authPath);
  const tokens = data?.tokens && typeof data.tokens === "object" ? data.tokens : null;
  const accessToken = typeof tokens?.access_token === "string" ? tokens.access_token.trim() : "";
  const refreshToken = typeof tokens?.refresh_token === "string" ? tokens.refresh_token.trim() : "";
  if (!accessToken) return null;
  const cred: OAuthCredential = {
    provider: "openai-codex",
    accessToken,
    refreshToken: refreshToken || undefined,
    accountId: typeof tokens?.account_id === "string" ? tokens.account_id : undefined,
    sourcePath: authPath,
  };
  return cred;
}

export async function readGeminiOAuthCredential(): Promise<OAuthCredential | null> {
  // 1. Check Zotero Prefs first (from in-plugin OAuth flow)
  const prefsToken = getOAuthPref("geminiOAuthAccessToken");
  if (prefsToken) {
    const refreshToken = getOAuthPref("geminiOAuthRefreshToken") || undefined;
    const expiresAt = Number(getOAuthPref("geminiOAuthExpiresAt") || "0") || undefined;
    const projectId = getOAuthPref("geminiOAuthProjectId") || undefined;
    return {
      provider: "google-gemini-cli",
      accessToken: prefsToken,
      refreshToken,
      expiresAt,
      projectId,
    };
  }

  // 2. Fall back to file-based credentials (~/.gemini/oauth_creds.json)
  const home = homeDir();
  if (!home) return null;
  const credPath = joinPath(home, ".gemini", "oauth_creds.json");
  const data = await readJsonFile(credPath);
  if (!data || typeof data !== "object") return null;
  const accessToken =
    (typeof data.access_token === "string" && data.access_token.trim()) ||
    (typeof data.token === "string" && data.token.trim()) ||
    "";
  if (!accessToken) return null;
  const refreshToken =
    (typeof data.refresh_token === "string" && data.refresh_token.trim()) || undefined;
  const expiryRaw = data.expiry_date ?? data.expires_at ?? data.expires;
  const expiresAt =
    typeof expiryRaw === "number" && Number.isFinite(expiryRaw) ? Number(expiryRaw) : undefined;
  const projectId =
    (typeof data.project_id === "string" && data.project_id.trim()) ||
    (typeof data.projectId === "string" && data.projectId.trim()) ||
    undefined;
  return {
    provider: "google-gemini-cli",
    accessToken,
    refreshToken,
    expiresAt,
    projectId,
    sourcePath: credPath,
  };
}

// ---------- Zotero Prefs helpers for plugin-native OAuth ----------
const OAUTH_PREF_PREFIX = "extensions.zotero.aidea.";
function getOAuthPref(key: string): string {
  try {
    const val = Zotero.Prefs.get(`${OAUTH_PREF_PREFIX}${key}`, true);
    return typeof val === "string" ? val : "";
  } catch {
    return "";
  }
}
function setOAuthPref(key: string, value: string): void {
  try {
    Zotero.Prefs.set(`${OAUTH_PREF_PREFIX}${key}`, value, true);
  } catch {
    // silently ignore
  }
}

// ---------- PKCE helpers ----------
function generateCodeVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(64);
  (globalThis as any).crypto?.getRandomValues?.(arr) ??
    (() => { for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256); })();
  return Array.from(arr, (v) => chars[v % chars.length]).join("");
}

async function sha256Base64Url(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const crypto = (globalThis as any).crypto;
  if (crypto?.subtle?.digest) {
    const hash = await crypto.subtle.digest("SHA-256", data);
    const bytes = new Uint8Array(hash);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  // Fallback: plain verifier (some OAuth servers accept S256 only, but try)
  throw new Error("SubtleCrypto not available for PKCE");
}

// ---------- Qwen credential read/write ----------
const DEFAULT_QWEN_BASE_URL = "https://portal.qwen.ai/v1";

function getQwenBaseUrl(): string {
  const raw = getOAuthPref("oauthQwenToken");
  if (!raw) return DEFAULT_QWEN_BASE_URL;
  try {
    const data = JSON.parse(raw);
    const ru = typeof data.resource_url === "string" ? data.resource_url.trim() : "";
    if (ru) {
      const url = ru.startsWith("http") ? ru : `https://${ru}`;
      return url.endsWith("/v1") ? url : `${url.replace(/\/+$/, "")}/v1`;
    }
    return DEFAULT_QWEN_BASE_URL;
  } catch {
    return DEFAULT_QWEN_BASE_URL;
  }
}

export async function readQwenOAuthCredential(): Promise<OAuthCredential | null> {
  const raw = getOAuthPref("oauthQwenToken");
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const accessToken = typeof data.access_token === "string" ? data.access_token.trim() : "";
    if (!accessToken) return null;
    return {
      provider: "qwen",
      accessToken,
      refreshToken: typeof data.refresh_token === "string" ? data.refresh_token.trim() : undefined,
      expiresAt: typeof data.expires_at === "number" ? data.expires_at : undefined,
    };
  } catch {
    return null;
  }
}

function saveQwenOAuthCredential(data: {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  resource_url?: string;
}): void {
  setOAuthPref("oauthQwenToken", JSON.stringify(data));
}

// ---------- GitHub Copilot credential read/write ----------
function saveCopilotGithubToken(token: string): void {
  setOAuthPref("oauthCopilotGithubToken", token);
}
function getCopilotGithubToken(): string {
  return getOAuthPref("oauthCopilotGithubToken");
}
function saveCopilotApiToken(data: { token: string; expiresAt: number }): void {
  setOAuthPref("oauthCopilotApiToken", JSON.stringify(data));
}
function getCopilotApiTokenCache(): { token: string; expiresAt: number } | null {
  const raw = getOAuthPref("oauthCopilotApiToken");
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data.token === "string" && typeof data.expiresAt === "number") return data;
    return null;
  } catch {
    return null;
  }
}

const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const DEFAULT_COPILOT_API_BASE = "https://api.individual.githubcopilot.com";

function deriveCopilotApiBaseUrl(token: string): string {
  const match = token.match(/(?:^|;)\s*proxy-ep=([^;\s]+)/i);
  const proxyEp = match?.[1]?.trim();
  if (!proxyEp) return DEFAULT_COPILOT_API_BASE;
  const host = proxyEp.replace(/^https?:\/\//, "").replace(/^proxy\./i, "api.");
  return host ? `https://${host}` : DEFAULT_COPILOT_API_BASE;
}

async function exchangeCopilotToken(githubToken: string): Promise<{
  token: string;
  expiresAt: number;
  baseUrl: string;
}> {
  const res = await getFetch()(COPILOT_TOKEN_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${githubToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Copilot token exchange failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown as Record<string, unknown>;
  const token = typeof json.token === "string" ? json.token : "";
  if (!token) throw new Error("Copilot token response missing token");
  const expiresAtRaw = json.expires_at;
  let expiresAt: number;
  if (typeof expiresAtRaw === "number" && Number.isFinite(expiresAtRaw)) {
    expiresAt = expiresAtRaw > 10_000_000_000 ? expiresAtRaw : expiresAtRaw * 1000;
  } else if (typeof expiresAtRaw === "string") {
    const parsed = parseInt(expiresAtRaw, 10);
    expiresAt = parsed > 10_000_000_000 ? parsed : parsed * 1000;
  } else {
    // Default: 30 minutes from now
    expiresAt = Date.now() + 30 * 60 * 1000;
  }
  saveCopilotApiToken({ token, expiresAt });
  return { token, expiresAt, baseUrl: deriveCopilotApiBaseUrl(token) };
}

async function ensureCopilotApiToken(): Promise<{
  token: string;
  baseUrl: string;
} | null> {
  const githubToken = getCopilotGithubToken();
  if (!githubToken) return null;
  const cached = getCopilotApiTokenCache();
  if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) {
    return { token: cached.token, baseUrl: deriveCopilotApiBaseUrl(cached.token) };
  }
  return exchangeCopilotToken(githubToken);
}

export async function readCopilotOAuthCredential(): Promise<OAuthCredential | null> {
  const githubToken = getCopilotGithubToken();
  if (!githubToken) return null;
  try {
    const result = await ensureCopilotApiToken();
    if (!result) return null;
    return {
      provider: "github-copilot",
      accessToken: result.token,
      expiresAt: getCopilotApiTokenCache()?.expiresAt,
    };
  } catch (err) {
    ztoolkit?.log?.("AIdea: Copilot token exchange failed", err);
    return null;
  }
}

export function parseCopilotModelsResponse(data: unknown): ProviderModelOption[] {
  const rows = Array.isArray((data as any)?.data)
    ? (data as any).data
    : Array.isArray((data as any)?.models)
      ? (data as any).models
      : Array.isArray(data)
        ? data
        : [];

  return dedupeModels(
    rows
      .map((row: any) => {
        const id = String(row?.id || row?.model || "").trim();
        const label = String(row?.name || row?.label || id).trim() || id;
        return { id, label };
      })
      .filter((row: ProviderModelOption) => row.id),
  );
}

async function fetchCopilotAvailableModels(): Promise<ProviderModelOption[]> {
  const copilotResult = await ensureCopilotApiToken();
  if (!copilotResult) {
    return [];
  }

  const modelsRes = await getFetch()(`${copilotResult.baseUrl}/models`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${copilotResult.token}`,
      Accept: "application/json",
      "Copilot-Integration-Id": "vscode-chat",
      "Editor-Version": "Zotero-AIdea/1.0",
    },
  });
  if (!modelsRes.ok) {
    throw new Error(`Copilot models HTTP ${modelsRes.status}`);
  }

  const modelsData = (await modelsRes.json()) as unknown;
  return parseCopilotModelsResponse(modelsData);
}

export async function readProviderOAuthCredential(
  provider: OAuthProviderId,
): Promise<OAuthCredential | null> {
  if (provider === "openai-codex") return readCodexOAuthCredential();
  if (provider === "google-gemini-cli") return readGeminiOAuthCredential();
  if (provider === "qwen") return readQwenOAuthCredential();
  if (provider === "github-copilot") return readCopilotOAuthCredential();
  return null;
}

function ensureProviderAuthHeaderInit(cred: OAuthCredential): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cred.accessToken}`,
  };
  if (cred.provider === "google-gemini-cli" && cred.projectId) {
    headers["x-goog-user-project"] = cred.projectId;
  }
  if (cred.provider === "github-copilot") {
    headers["Copilot-Integration-Id"] = "vscode-chat";
    headers["Editor-Version"] = "Zotero-AIdea/1.0";
  }
  return headers;
}


/**
 * Known Codex-compatible models.  The Codex OAuth token is a ChatGPT session
 * token that works with chatgpt.com/backend-api endpoints �?it cannot query
 * api.openai.com/v1/models.  We validate the token, then return this curated
 * list that mirrors what the Codex CLI actually supports.
 */
const CODEX_KNOWN_MODELS: ProviderModelOption[] = [
  { id: "gpt-5.3-codex",       label: "GPT-5.3 Codex (Latest)" },
  { id: "gpt-5.2-codex",       label: "GPT-5.2 Codex" },
  { id: "gpt-5.1-codex-max",   label: "GPT-5.1 Codex Max" },
  { id: "gpt-5.1-codex-mini",  label: "GPT-5.1 Codex Mini" },
];

/**
 * Known Gemini CLI models (static fallback when the dynamic discovery
 * API call fails or returns nothing).
 */
const GEMINI_CLI_KNOWN_MODELS: ProviderModelOption[] = [
  { id: "gemini-3.1-pro-preview",  label: "Gemini 3.1 Pro Preview" },
  { id: "gemini-3-flash-preview",  label: "Gemini 3 Flash Preview" },
  { id: "gemini-2.5-pro",          label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash",        label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite",   label: "Gemini 2.5 Flash Lite" },
];

/**
 * Known Qwen (通义千问) models.
 */
const QWEN_KNOWN_MODELS: ProviderModelOption[] = [
  { id: "coder-model",   label: "Qwen Coder" },
  { id: "vision-model",  label: "Qwen Vision" },
];

/**
 * Known GitHub Copilot models.
 */
const COPILOT_KNOWN_MODELS: ProviderModelOption[] = [
  { id: "claude-sonnet-4",     label: "Claude Sonnet 4" },
  { id: "gpt-4o",              label: "GPT-4o" },
  { id: "gpt-4.1",             label: "GPT-4.1" },
  { id: "gpt-4.1-mini",        label: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano",        label: "GPT-4.1 Nano" },
  { id: "o3-mini",             label: "o3 Mini" },
];

export async function fetchAvailableModels(
  provider: OAuthProviderId,
): Promise<ProviderModelOption[]> {
  const cred = await readProviderOAuthCredential(provider);
  if (!cred) {
    return [];
  }
  try {
    if (provider === "openai-codex") {
      // Try dynamic discovery from chatgpt.com/backend-api/codex/models first.
      // Falls back to the static CODEX_KNOWN_MODELS list on failure.
      const headers: Record<string, string> = {
        ...ensureProviderAuthHeaderInit(cred),
        Accept: "application/json",
      };
      if (cred.accountId) {
        headers["ChatGPT-Account-Id"] = cred.accountId;
      }
      try {
        const res = await getFetch()("https://chatgpt.com/backend-api/codex/models?client_version=1.0.0", {
          method: "GET",
          headers,
        });
        if (res.ok) {
          const data = (await res.json()) as { models?: Array<{ id?: string; name?: string }> } | Array<{ id?: string; name?: string }>;
          const models = Array.isArray(data) ? data : (data as any).models || [];
          if (Array.isArray(models) && models.length > 0) {
            const rows: ProviderModelOption[] = models
              .map((m: any) => {
                const id = String(m.id || m.slug || m.model_id || "").trim();
                const label = String(m.name || m.title || id).trim() || id;
                return { id, label };
              })
              .filter((m: ProviderModelOption) => m.id);
            if (rows.length > 0) {
              ztoolkit?.log?.(`AIdea: Codex dynamic models: ${rows.map(r => r.id).join(", ")}`);
              return dedupeModels(rows);
            }
          }
        }
      } catch (err) {
        ztoolkit?.log?.("AIdea: Codex dynamic model fetch failed, using static list", err);
      }
      // Fallback: validate token via usage endpoint, then return static list
      try {
        const usageRes = await getFetch()("https://chatgpt.com/backend-api/wham/usage", {
          method: "GET",
          headers,
        });
        if (!usageRes.ok) {
          ztoolkit?.log?.("AIdea: Codex token validation failed, HTTP", usageRes.status);
          return [];
        }
      } catch {
        // If even usage fails, still return static list (token might simply be valid)
      }
      return [...CODEX_KNOWN_MODELS];
    }

    if (provider === "qwen") {
      // Try dynamic model discovery from the Qwen portal
      try {
        const baseUrl = getQwenBaseUrl();
        const modelsRes = await getFetch()(`${baseUrl}/models`, {
          method: "GET",
          headers: {
            ...ensureProviderAuthHeaderInit(cred),
            Accept: "application/json",
          },
        });
        if (modelsRes.ok) {
          const modelsData = (await modelsRes.json()) as any;
          const models = Array.isArray(modelsData?.data) ? modelsData.data : (Array.isArray(modelsData) ? modelsData : []);
          if (models.length > 0) {
            const rows: ProviderModelOption[] = models
              .map((m: any) => {
                const id = String(m.id || m.model || "").trim();
                const label = String(m.name || m.id || "").trim() || id;
                return { id, label };
              })
              .filter((m: ProviderModelOption) => m.id);
            if (rows.length > 0) {
              ztoolkit?.log?.(`AIdea: Qwen dynamic models: ${rows.map(r => r.id).join(", ")}`);
              return dedupeModels(rows);
            }
          }
        }
      } catch (err) {
        ztoolkit?.log?.("AIdea: Qwen dynamic model fetch failed, using static list", err);
      }
      return [...QWEN_KNOWN_MODELS];
    }

    if (provider === "github-copilot") {
      try {
        const models = await fetchCopilotAvailableModels();
        if (models.length > 0) {
          ztoolkit?.log?.(`AIdea: Copilot dynamic models: ${models.map((r) => r.id).join(", ")}`);
          return models;
        }
      } catch (err) {
        ztoolkit?.log?.("AIdea: Copilot dynamic model fetch failed, using static list", err);
      }
      return [...COPILOT_KNOWN_MODELS];
    }

    // ---------- Google Gemini CLI ----------
    // Gemini CLI OAuth tokens can't access generativelanguage.googleapis.com directly.
    // Use static model list (dynamic fetch via Cloud Code proxy is not reliable).
    return [...GEMINI_CLI_KNOWN_MODELS];
  } catch (err) {
    ztoolkit?.log?.("AIdea: fetchAvailableModels failed", provider, err);
    if (provider === "google-gemini-cli") return [...GEMINI_CLI_KNOWN_MODELS];
    if (provider === "qwen") return [...QWEN_KNOWN_MODELS];
    if (provider === "github-copilot") return [...COPILOT_KNOWN_MODELS];
    return [];
  }
}

function dedupeModels(models: ProviderModelOption[]): ProviderModelOption[] {
  const out: ProviderModelOption[] = [];
  const seen = new Set<string>();
  for (const row of models) {
    const id = String(row.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: String(row.label || id).trim() || id });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

/**
 * Fetch the model list from a custom OpenAI-compatible endpoint.
 * Calls `GET {apiBase}/models` with an optional Bearer token and parses the
 * standard `{ data: [{ id, ... }] }` response shape.
 */
export async function fetchCustomEndpointModels(
  apiBase: string,
  apiKey?: string,
): Promise<ProviderModelOption[]> {
  const base = String(apiBase || "").trim().replace(/\/+$/, "");
  if (!base) return [];
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  try {
    const res = await getFetch()(`${base}/models`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      throw new Error(`Custom endpoint models HTTP ${res.status}`);
    }
    const json = (await res.json()) as unknown;
    // Standard OpenAI shape: { data: [{ id, ... }] }
    // Some endpoints return a plain array.
    const entries = (() => {
      if (json && typeof json === "object" && "data" in json && Array.isArray((json as any).data)) {
        return (json as any).data as any[];
      }
      if (Array.isArray(json)) return json;
      // Ollama /v1/models wraps in { models: [...] }
      if (json && typeof json === "object" && "models" in json && Array.isArray((json as any).models)) {
        return (json as any).models as any[];
      }
      return [];
    })();
    const rows: ProviderModelOption[] = entries
      .map((m: any) => {
        const id = String(m?.id || m?.model || m?.name || "").trim();
        const label = String(m?.name || m?.id || "").trim() || id;
        return { id, label };
      })
      .filter((m: ProviderModelOption) => m.id);
    if (rows.length > 0) {
      ztoolkit?.log?.(
        `AIdea: Custom endpoint models (${rows.length}): ${rows.slice(0, 10).map((r) => r.id).join(", ")}${rows.length > 10 ? "..." : ""}`,
      );
    }
    return dedupeModels(rows);
  } catch (err) {
    ztoolkit?.log?.("AIdea: fetchCustomEndpointModels failed", err);
    throw err;
  }
}

// ─── Gemini in-plugin OAuth (Authorization Code + PKCE) ───

const GEMINI_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GEMINI_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GEMINI_REDIRECT_URI = "http://localhost:8085/oauth2callback";
const GEMINI_SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];
const GEMINI_CODE_ASSIST_API_BASE = "https://cloudcode-pa.googleapis.com/v1internal";
export const GEMINI_CODE_ASSIST_STREAM_URL =
  `${GEMINI_CODE_ASSIST_API_BASE}:streamGenerateContent?alt=sse`;

/** Extract client_id and client_secret from the installed Gemini CLI. */
async function getNpmGlobalRootCandidates(): Promise<string[]> {
  const platform = currentPlatform();
  const home = homeDir();
  const roots = new Set<string>();
  const npmPath =
    (await locateExecutableViaShell("npm")) || resolveExecutablePath("npm");

  if (npmPath) {
    const rootResult = await runExecutableCommand(npmPath, ["root", "-g"]);
    const rootOut = String(rootResult.output || "")
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find(Boolean);
    if (rootOut) roots.add(rootOut);

    const prefixResult = await runExecutableCommand(npmPath, ["config", "get", "prefix"]);
    const prefixOut = String(prefixResult.output || "")
      .split(/\r?\n/g)
      .map((line) => line.trim())
      .find(Boolean);
    if (prefixOut) {
      roots.add(deriveNpmGlobalRootFromPrefix(prefixOut, platform));
    }
  }

  if (platform === "windows") {
    const appData = getEnv("APPDATA") || joinPath(home, "AppData", "Roaming");
    roots.add(joinPath(appData, "npm", "node_modules"));
  } else {
    roots.add("/usr/local/lib/node_modules");
    roots.add("/opt/homebrew/lib/node_modules");
    if (home) {
      roots.add(joinPath(home, ".npm-global", "lib", "node_modules"));
    }
  }

  return Array.from(roots).filter(Boolean);
}

async function extractGeminiCliCredentials(): Promise<{ clientId: string; clientSecret: string } | null> {
  try {
    const roots = await getNpmGlobalRootCandidates();

    // Build candidate paths for the oauth2 credentials file.
    // npm v7+ may "hoist" @google/gemini-cli-core to the top-level
    // node_modules instead of nesting it under gemini-cli/node_modules.
    // We also check an alternative path (oauth2-provider.js) for newer
    // Gemini CLI versions that reorganised the dist layout.
    const candidates: string[] = [];
    for (const root of roots) {
      // 1. Nested layout (npm v6 / non-hoisted):
      //    <root>/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js
      candidates.push(
        joinPath(root, "@google", "gemini-cli", "node_modules", "@google", "gemini-cli-core",
          "dist", "src", "code_assist", "oauth2.js"),
      );
      // 2. Hoisted layout (npm v7+ default):
      //    <root>/@google/gemini-cli-core/dist/src/code_assist/oauth2.js
      candidates.push(
        joinPath(root, "@google", "gemini-cli-core",
          "dist", "src", "code_assist", "oauth2.js"),
      );
      // 3. Alternative path (newer Gemini CLI versions):
      //    <root>/@google/gemini-cli-core/dist/src/agents/auth-provider/oauth2-provider.js
      candidates.push(
        joinPath(root, "@google", "gemini-cli", "node_modules", "@google", "gemini-cli-core",
          "dist", "src", "agents", "auth-provider", "oauth2-provider.js"),
      );
      candidates.push(
        joinPath(root, "@google", "gemini-cli-core",
          "dist", "src", "agents", "auth-provider", "oauth2-provider.js"),
      );
    }

    let content: string | null = null;
    for (const p of candidates) {
      try {
        const c = String(Zotero.File.getContents(p) || "");
        if (c) { content = c; break; }
      } catch { /* try next */ }
    }

    if (content) {
      const idMatch = content.match(/(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/);
      const secretMatch = content.match(/(GOCSPX-[A-Za-z0-9_-]+)/);
      if (idMatch && secretMatch) {
        return { clientId: idMatch[1], clientSecret: secretMatch[1] };
      }
    }

    // ── Bundled CLI fallback (v0.36.0+) ──
    // Starting from v0.36.0 the Gemini CLI ships as a single self-contained
    // bundle (bundle/gemini.js, ~93 MB).  The separate @google/gemini-cli-core
    // directory no longer exists, so the file-based extraction above finds
    // nothing.  Reading a 93 MB bundle just to regex-match two strings is
    // impractical, so instead we verify the CLI executable is present and use
    // the well-known OAuth credentials from the Gemini CLI source.
    //
    // These are public constants that Google explicitly documents as safe to
    // embed in installed applications:
    //   https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/oauth2.ts
    //   "Note: It's ok to save this in git because this is an installed
    //    application … the client secret is obviously not treated as a secret."
    const geminiPath =
      (await locateExecutableViaShell("gemini")) || resolveExecutablePath("gemini");
    if (geminiPath) {
      ztoolkit?.log?.(
        "AIdea: Gemini CLI found at",
        geminiPath,
        "— using bundled-CLI fallback credentials",
      );
      return {
        clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
        clientSecret: "GOCSPX-" + "4uHgMPm-1o7Sk-geV6Cu5clXFsxl",
      };
    }
  } catch (err) {
    ztoolkit?.log?.("AIdea: extractGeminiCliCredentials failed", err);
  }
  return null;
}

function generateGeminiPkce(): { verifier: string; challenge: string } {
  const array = new Uint8Array(32);
  (crypto as any).getRandomValues(array);
  const verifier = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    const hasher = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    hasher.init(hasher.SHA256);
    hasher.update(data, data.length);
    const hash = hasher.finish(false);
    const challenge = btoa(hash).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return { verifier, challenge };
  } catch {
    return { verifier, challenge: verifier };
  }
}

async function loginGeminiInPlugin(): Promise<{ ok: boolean; message: string }> {
  try {
    const creds = await extractGeminiCliCredentials();
    if (!creds) {
      return { ok: false, message: "Gemini CLI not found. Install it first: npm install -g @google/gemini-cli" };
    }
    const { verifier, challenge } = generateGeminiPkce();
    const authParams = new URLSearchParams({
      client_id: creds.clientId,
      response_type: "code",
      redirect_uri: GEMINI_REDIRECT_URI,
      scope: GEMINI_SCOPES.join(" "),
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: verifier,
      access_type: "offline",
      prompt: "consent",
    });
    const authUrl = `${GEMINI_AUTH_URL}?${authParams.toString()}`;

    // Start local callback server using a Node.js child process
    // (XPCOM nsIServerSocket is unreliable in Zotero; reference uses Node.js http.createServer)
    const tempDir = Zotero.getTempDirectory?.()?.path || Zotero.DataDirectory?.dir || ".";
    const sep = currentPlatform() === "windows" ? "\\" : "/";
    const serverScriptPath = `${tempDir}${sep}aidea-gemini-oauth-server-${Date.now()}.js`;
    const resultFilePath = `${tempDir}${sep}aidea-gemini-oauth-result-${Date.now()}.json`;

    // Write a tiny Node.js HTTP server script
    const serverScript = `
const http = require('http');
const fs = require('fs');
const url = require('url');
const resultPath = ${JSON.stringify(resultFilePath)};
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname === '/oauth2callback') {
    const code = parsed.query.code || '';
    const error = parsed.query.error || '';
    const state = parsed.query.state || '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (code) {
      res.end('<!doctype html><html><body><h2>Gemini OAuth Complete</h2><p>You can close this window and return to Zotero.</p></body></html>');
    } else {
      res.end('<h2>Auth failed: ' + (error || 'no code') + '</h2>');
    }
    fs.writeFileSync(resultPath, JSON.stringify({ code, error, state }));
    server.close();
    setTimeout(() => process.exit(0), 500);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(8085, 'localhost', () => {});
setTimeout(() => { server.close(); process.exit(1); }, 120000);
`;
    // Write the server script to a temp file
    try {
      const scriptFile = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      scriptFile.initWithPath(serverScriptPath);
      await Zotero.File.putContentsAsync(serverScriptPath, serverScript);
    } catch (err) {
      return { ok: false, message: `Failed to write callback server script: ${err}` };
    }

    // Start the Node.js server in the background (hidden)
    const nodePath =
      (await locateExecutableViaShell("node")) || resolveExecutablePath("node");
    if (!nodePath) {
      return { ok: false, message: "Node.js not found. Install/Update Env first." };
    }
    const nodeCmd = buildExecutableCommand(nodePath, [serverScriptPath]);
    const serverProcess = runShellCommand(nodeCmd, { hidden: true });

    // Give the server a moment to start
    await new Promise((r) => setTimeout(r, 1000));

    // Open browser
    try { (Zotero as any).launchURL(authUrl); } catch { /* */ }

    // Poll for the result file
    const deadline = Date.now() + 120_000;
    let code = "";
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const content = String(Zotero.File.getContents(resultFilePath) || "");
        if (content) {
          const result = JSON.parse(content) as { code?: string; error?: string };
          if (result.error) {
            return { ok: false, message: `Google OAuth error: ${result.error}` };
          }
          if (result.code) {
            code = result.code;
            break;
          }
        }
      } catch { /* file not yet written */ }
    }

    // Clean up temp files
    try {
      const f1 = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      f1.initWithPath(serverScriptPath);
      if (f1.exists()) f1.remove(false);
    } catch { /* */ }
    try {
      const f2 = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      f2.initWithPath(resultFilePath);
      if (f2.exists()) f2.remove(false);
    } catch { /* */ }

    // Wait for the server process to finish
    try { await serverProcess; } catch { /* */ }

    if (!code) {
      return { ok: false, message: "OAuth callback timeout — no authorization code received" };
    }

    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: GEMINI_REDIRECT_URI,
      code_verifier: verifier,
    });
    const tokenRes = await getFetch()(GEMINI_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: tokenBody.toString(),
    });
    if (!tokenRes.ok) {
      return { ok: false, message: `Token exchange failed: ${await tokenRes.text()}` };
    }
    const tokenData = (await tokenRes.json() as unknown) as {
      access_token: string; refresh_token?: string; expires_in: number; scope?: string;
    };
    if (!tokenData.access_token) {
      return { ok: false, message: "No access token received" };
    }

    // Discover GCP project (same as reference — required for API access)
    let projectId = "";
    try {
      projectId = await discoverGeminiProject(tokenData.access_token);
    } catch (err) {
      ztoolkit?.log?.("AIdea: Gemini project discovery failed", err);
    }

    const expiresAt = Date.now() + (tokenData.expires_in || 3600) * 1000;
    setOAuthPref("geminiOAuthAccessToken", tokenData.access_token);
    setOAuthPref("geminiOAuthRefreshToken", tokenData.refresh_token || "");
    setOAuthPref("geminiOAuthExpiresAt", String(expiresAt));
    setOAuthPref("geminiOAuthScope", tokenData.scope || GEMINI_SCOPES.join(" "));
    setOAuthPref("geminiOAuthProjectId", projectId);
    return { ok: true, message: `Gemini OAuth ready${projectId ? ` (project: ${projectId})` : ""}` };
  } catch (err) {
    return { ok: false, message: `Gemini OAuth failed: ${String(err)}` };
  }
}

/** Simplified project discovery (adapted from reference oauth.ts discoverProject). */
async function discoverGeminiProject(accessToken: string): Promise<string> {
  const fetchFn = getFetch();
  const endpoint = "https://cloudcode-pa.googleapis.com";
  // PLATFORM_UNSPECIFIED works for all platforms; the API rejects raw OS names like "WINDOWS"
  const metadata = { ideType: "ANTIGRAVITY", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "google-api-nodejs-client/9.15.1",
    "X-Goog-Api-Client": "gl-node/20.0.0",
    "Client-Metadata": JSON.stringify(metadata),
  };

  // 1. loadCodeAssist
  ztoolkit?.log?.("AIdea: Gemini project discovery - calling loadCodeAssist...");
  const loadRes = await fetchFn(`${endpoint}/v1internal:loadCodeAssist`, {
    method: "POST",
    headers,
    body: JSON.stringify({ metadata }),
  });
  ztoolkit?.log?.("AIdea: loadCodeAssist status:", loadRes.status);

  if (!loadRes.ok) {
    const errText = await loadRes.text().catch(() => "");
    ztoolkit?.log?.("AIdea: loadCodeAssist failed:", errText.slice(0, 300));
    return "";
  }

  const data = (await loadRes.json() as unknown) as {
    currentTier?: { id?: string };
    cloudaicompanionProject?: string | { id?: string };
    allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
  };
  ztoolkit?.log?.("AIdea: loadCodeAssist response:", JSON.stringify(data).slice(0, 500));

  // Extract project directly if available
  const proj = data.cloudaicompanionProject;
  if (typeof proj === "string" && proj) {
    ztoolkit?.log?.("AIdea: Found project (string):", proj);
    return proj;
  }
  if (typeof proj === "object" && proj?.id) {
    ztoolkit?.log?.("AIdea: Found project (object):", proj.id);
    return proj.id;
  }

  // If already onboarded (has currentTier but no project), need project from env
  if (data.currentTier) {
    ztoolkit?.log?.("AIdea: Has tier but no project in response. Tier:", data.currentTier.id);
  }

  // 2. onboardUser
  const tierId = data.allowedTiers?.find((t) => t.isDefault)?.id || "free-tier";
  ztoolkit?.log?.("AIdea: onboarding with tier:", tierId);
  const onboardRes = await fetchFn(`${endpoint}/v1internal:onboardUser`, {
    method: "POST",
    headers,
    body: JSON.stringify({ tierId, metadata }),
  });
  ztoolkit?.log?.("AIdea: onboardUser status:", onboardRes.status);

  if (!onboardRes.ok) {
    const errText = await onboardRes.text().catch(() => "");
    ztoolkit?.log?.("AIdea: onboardUser failed:", errText.slice(0, 300));
    return "";
  }

  let lro = (await onboardRes.json() as unknown) as {
    done?: boolean; name?: string;
    response?: { cloudaicompanionProject?: { id?: string } };
  };
  ztoolkit?.log?.("AIdea: onboardUser response:", JSON.stringify(lro).slice(0, 500));

  // Poll operation if not done
  if (!lro.done && lro.name) {
    ztoolkit?.log?.("AIdea: Polling operation:", lro.name);
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const pollRes = await fetchFn(`${endpoint}/v1internal/${lro.name}`, { headers });
      if (pollRes.ok) {
        lro = (await pollRes.json() as unknown) as typeof lro;
        ztoolkit?.log?.("AIdea: Poll result:", JSON.stringify(lro).slice(0, 300));
        if (lro.done) break;
      }
    }
  }
  const projId = lro.response?.cloudaicompanionProject?.id;
  ztoolkit?.log?.("AIdea: Final project ID:", projId || "(empty)");
  if (projId) return projId;

  // Fallback 1: try gcloud CLI
  try {
    const gcloud = await runShellCommand("gcloud config get-value project", { hidden: true });
    const gcloudProj = gcloud.stdout?.trim();
    if (gcloudProj && !gcloudProj.includes("(unset)")) {
      ztoolkit?.log?.("AIdea: Got project from gcloud:", gcloudProj);
      return gcloudProj;
    }
  } catch { /* gcloud not installed */ }

  // Fallback 2: environment variable
  try {
    const envProj = getEnv("GOOGLE_CLOUD_PROJECT") || getEnv("GOOGLE_CLOUD_PROJECT_ID") || "";
    if (envProj) {
      ztoolkit?.log?.("AIdea: Got project from env:", envProj);
      return envProj;
    }
  } catch { /* */ }

  return "";
}

// ---------- Qwen Device Code Flow ----------
const QWEN_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56";
const QWEN_DEVICE_CODE_URL = "https://chat.qwen.ai/api/v1/oauth2/device/code";
const QWEN_TOKEN_URL = "https://chat.qwen.ai/api/v1/oauth2/token";

async function loginQwenDeviceCode(): Promise<{ ok: boolean; message: string }> {
  try {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await sha256Base64Url(codeVerifier);

    const body = new URLSearchParams({
      client_id: QWEN_CLIENT_ID,
      scope: "openid profile email model.completion",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    const dcRes = await getFetch()(QWEN_DEVICE_CODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    if (!dcRes.ok) throw new Error(`Qwen device code failed: HTTP ${dcRes.status}`);
    const dcJson = (await dcRes.json()) as unknown as Record<string, unknown>;
    const deviceCode = String(dcJson.device_code || "");
    const userCode = String(dcJson.user_code || "");
    const verificationUri = String(dcJson.verification_uri_complete || dcJson.verification_uri || "");
    const interval = Math.max(2, Number(dcJson.interval) || 5);
    const expiresIn = Number(dcJson.expires_in) || 300;
    if (!deviceCode || !userCode) throw new Error("Qwen device code response missing fields");

    // Show dialog to user with i18n and copy-to-clipboard
    const win = Zotero.getMainWindow?.();
    const lang = getUiLang();
    const msg = lang === "zh-CN"
      ? `Qwen OAuth 登录\n\n您的授权码：\n${userCode}\n\n点击「确定」将自动复制授权码并在浏览器中打开授权页面。\n请在浏览器页面中粘贴此授权码完成授权。`
      : `Qwen OAuth Login\n\nYour authorization code:\n${userCode}\n\nClick OK to copy the code and open the authorization page in your browser.\nPaste this code on the browser page to complete authorization.`;
    const accepted = win?.confirm?.(msg);
    if (!accepted) return { ok: false, message: lang === "zh-CN" ? "用户取消了授权" : "Authorization cancelled by user" };
    // Copy user code to clipboard, show toast, and open browser
    copyToClipboard(userCode);
    showCopiedToast(lang);
    try { (Zotero as any).launchURL?.(verificationUri); } catch { /* ignore */ }

    // Poll for token
    const deadline = Date.now() + expiresIn * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval * 1000));
      const tokenBody = new URLSearchParams({
        client_id: QWEN_CLIENT_ID,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
        code_verifier: codeVerifier,
      });
      const tokenRes = await getFetch()(QWEN_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: tokenBody,
      });
      if (!tokenRes.ok) {
        // may be authorization_pending
        try {
          const errJson = (await tokenRes.json()) as unknown as Record<string, unknown>;
          const err = String(errJson.error || "");
          if (err === "authorization_pending") continue;
          if (err === "slow_down") { await new Promise((r) => setTimeout(r, 2000)); continue; }
          if (err === "expired_token") throw new Error("Qwen authorization expired");
          if (err === "access_denied") throw new Error("Qwen authorization denied by user");
          throw new Error(`Qwen token error: ${err}`);
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.startsWith("Qwen")) throw parseErr;
          continue;
        }
      }
      const tokenJson = (await tokenRes.json()) as unknown as Record<string, unknown>;
      const accessToken = String(tokenJson.access_token || "");
      if (!accessToken) throw new Error("Qwen token response missing access_token");
      saveQwenOAuthCredential({
        access_token: accessToken,
        refresh_token: typeof tokenJson.refresh_token === "string" ? tokenJson.refresh_token : undefined,
        expires_at: typeof tokenJson.expires_in === "number"
          ? Date.now() + tokenJson.expires_in * 1000
          : undefined,
        resource_url: typeof tokenJson.resource_url === "string" ? tokenJson.resource_url : undefined,
      });
      return { ok: true, message: `${getProviderLabel("qwen")} OAuth ready` };
    }
    throw new Error("Qwen device code expired");
  } catch (err) {
    return { ok: false, message: String(err instanceof Error ? err.message : err) };
  }
}

// ---------- GitHub Copilot Device Code Flow ----------
const COPILOT_GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

async function loginCopilotDeviceCode(): Promise<{ ok: boolean; message: string }> {
  try {
    const dcBody = new URLSearchParams({
      client_id: COPILOT_GITHUB_CLIENT_ID,
      scope: "read:user",
    });
    const dcRes = await getFetch()(GITHUB_DEVICE_CODE_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: dcBody,
    });
    if (!dcRes.ok) throw new Error(`GitHub device code failed: HTTP ${dcRes.status}`);
    const dcJson = (await dcRes.json()) as unknown as Record<string, unknown>;
    const deviceCode = String(dcJson.device_code || "");
    const userCode = String(dcJson.user_code || "");
    const verificationUri = String(dcJson.verification_uri || "https://github.com/login/device");
    const interval = Math.max(1, Number(dcJson.interval) || 5);
    const expiresIn = Number(dcJson.expires_in) || 900;
    if (!deviceCode || !userCode) throw new Error("GitHub device code response missing fields");

    // Show dialog to user with i18n and copy-to-clipboard
    const win = Zotero.getMainWindow?.();
    const lang = getUiLang();
    const msg = lang === "zh-CN"
      ? `GitHub Copilot OAuth 登录\n\n您的授权码：\n${userCode}\n\n点击「确定」将自动复制授权码并在浏览器中打开授权页面。\n请在浏览器页面中粘贴此授权码完成授权。`
      : `GitHub Copilot OAuth Login\n\nYour authorization code:\n${userCode}\n\nClick OK to copy the code and open the authorization page in your browser.\nPaste this code on the browser page to complete authorization.`;
    const accepted = win?.confirm?.(msg);
    if (!accepted) return { ok: false, message: lang === "zh-CN" ? "用户取消了授权" : "Authorization cancelled by user" };
    copyToClipboard(userCode);
    showCopiedToast(lang);
    try { (Zotero as any).launchURL?.(verificationUri); } catch { /* ignore */ }

    // Poll for access token
    const deadline = Date.now() + expiresIn * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval * 1000));
      const tokenBody = new URLSearchParams({
        client_id: COPILOT_GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
      const tokenRes = await getFetch()(GITHUB_ACCESS_TOKEN_URL, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      });
      if (!tokenRes.ok) throw new Error(`GitHub token request failed: HTTP ${tokenRes.status}`);
      const tokenJson = (await tokenRes.json()) as unknown as Record<string, unknown>;
      if (typeof tokenJson.access_token === "string" && tokenJson.access_token) {
        saveCopilotGithubToken(tokenJson.access_token);
        // Pre-exchange for Copilot API token
        try { await exchangeCopilotToken(tokenJson.access_token); } catch { /* will retry later */ }
        return { ok: true, message: `${getProviderLabel("github-copilot")} OAuth ready` };
      }
      const err = String(tokenJson.error || "");
      if (err === "authorization_pending") continue;
      if (err === "slow_down") { await new Promise((r) => setTimeout(r, 2000)); continue; }
      if (err === "expired_token") throw new Error("GitHub device code expired");
      if (err === "access_denied") throw new Error("GitHub login cancelled");
      throw new Error(`GitHub device flow error: ${err}`);
    }
    throw new Error("GitHub device code expired");
  } catch (err) {
    return { ok: false, message: String(err instanceof Error ? err.message : err) };
  }
}

export async function runProviderOAuthLogin(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  // Qwen and Copilot use in-plugin Device Code flows
  if (provider === "qwen") return loginQwenDeviceCode();
  if (provider === "github-copilot") return loginCopilotDeviceCode();

  // Gemini: in-plugin OAuth Authorization Code + PKCE flow.
  if (provider === "google-gemini-cli") {
    return loginGeminiInPlugin();
  }


  // Codex uses external CLI tool (hidden mode)
  const spec = getProviderCliSpec(provider);
  if (!spec) {
    return { ok: false, message: `No CLI login command is defined for ${provider}` };
  }

  const cliPath =
    (await locateExecutableViaShell(spec.executableName)) ||
    resolveExecutablePath(spec.executableName);
  if (!cliPath) {
    return {
      ok: false,
      message: `${spec.executableName} was not found. Please run Install/Update Env first.`,
    };
  }

  let last = "";
  try {
    const command = buildExecutableCommand(cliPath, ["login"]);
    const result = await runShellCommand(command, { hidden: true });
    last = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    const cred = await readProviderOAuthCredential(provider);
    if (cred) {
      return { ok: true, message: `${getProviderLabel(provider)} OAuth ready` };
    }
    if (result.code === 0) {
      return {
        ok: true,
        message:
          last ||
          `${spec.executableName} login executed. Complete browser authorization, then refresh model list/status.`,
      };
    }
  } catch (err) {
    last = String(err);
  }
  return {
    ok: false,
    message:
      last ||
      `Failed to execute ${spec.executableName} login`,
  };
}

export async function removeProviderOAuthCredential(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  if (provider === "qwen") {
    setOAuthPref("oauthQwenToken", "");
    return { ok: true, message: `${getProviderLabel(provider)} authorization removed` };
  }
  if (provider === "github-copilot") {
    setOAuthPref("oauthCopilotGithubToken", "");
    setOAuthPref("oauthCopilotApiToken", "");
    return { ok: true, message: `${getProviderLabel(provider)} authorization removed` };
  }
  // Gemini: also clear in-plugin OAuth prefs
  if (provider === "google-gemini-cli") {
    setOAuthPref("geminiOAuthAccessToken", "");
    setOAuthPref("geminiOAuthRefreshToken", "");
    setOAuthPref("geminiOAuthExpiresAt", "");
    setOAuthPref("geminiOAuthScope", "");
    setOAuthPref("geminiOAuthProjectId", "");
  }
  const home = homeDir();
  if (!home) {
    if (provider === "google-gemini-cli") {
      return { ok: true, message: `${getProviderLabel(provider)} authorization removed` };
    }
    return { ok: false, message: "Home directory not found" };
  }
  const paths =
    provider === "openai-codex"
      ? [joinPath(home, ".codex", "auth.json")]
      : [
          joinPath(home, ".gemini", "oauth_creds.json"),
          joinPath(home, ".gemini", "credentials.json"),
        ];
  let removed = 0;
  for (const path of paths) {
    if (removeFileIfExists(path)) removed += 1;
  }
  return {
    ok: true,
    message:
      removed > 0 || provider === "google-gemini-cli"
        ? `${getProviderLabel(provider)} authorization removed`
        : `${getProviderLabel(provider)} authorization file not found`,
  };
}
export async function autoConfigureEnvironment(params?: {
  provider?: OAuthProviderId;
  onProgress?: (event: {
    phase: "start" | "done" | "info";
    step: string;
    ok?: boolean;
    output?: string;
  }) => void;
}): Promise<{ ok: boolean; logs: string }> {
  const logs: string[] = [];
  const append = (title: string, text: string) => {
    const body = String(text || "").trim();
    logs.push(`## ${title}\n${body || "(no output)"}`);
  };
  const report = params?.onProgress;
  const platform = currentPlatform();
  const home = homeDir();
  const preferredUserPrefix = derivePreferredUserNpmPrefix(platform, home);
  report?.({
    phase: "info",
    step: "Detected platform",
    output: platform,
  });
  append("Detected platform", platform);

  const formatNpmState = (state: NpmEnvironmentState): string =>
    [
      `platform: ${state.platform}`,
      `nodePath: ${state.nodePath || "-"}`,
      `nodeVersion: ${state.nodeVersion || "-"}`,
      `npmPath: ${state.npmPath || "-"}`,
      `npmReportedVersion: ${state.npmReportedVersion || "-"}`,
      `npmPackageVersion: ${state.npmPackageVersion || "-"}`,
      `latestNpmVersion: ${state.latestNpmVersion || "-"}`,
      `prefix: ${state.prefix || "-"}`,
      `globalRoot: ${state.globalRoot || "-"}`,
      `globalBinDir: ${state.globalBinDir || "-"}`,
    ].join("\n");

  const ensureNpmDirectories = async (
    state: NpmEnvironmentState,
  ): Promise<boolean> => {
    const dirs = dedupePathEntries(
      [state.prefix, state.globalRoot, state.globalBinDir].filter(Boolean),
      state.platform,
    );
    let ok = true;
    for (const dir of dirs) {
      report?.({ phase: "start", step: `Ensure directory ${dir}` });
      const result = ensureDirectoryExists(dir);
      append(`Ensure directory ${dir}`, result.message);
      report?.({
        phase: "done",
        step: `Ensure directory ${dir}`,
        ok: result.ok,
        output: result.message,
      });
      if (!result.ok) ok = false;
    }
    if (state.globalBinDir) {
      prependProcessPathEntries([state.globalBinDir]);
      report?.({
        phase: "info",
        step: "Refresh runtime PATH",
        output: `Prepended ${state.globalBinDir}`,
      });
      append("Refresh runtime PATH", `Prepended ${state.globalBinDir}`);
      const persisted = await persistBinDirToUserPath(state.globalBinDir);
      append("Persist npm bin PATH", persisted);
      report?.({
        phase: "done",
        step: "Persist npm bin PATH",
        ok: true,
        output: persisted,
      });
    }
    return ok;
  };

  const switchNpmPrefixToPreferred = async (
    state: NpmEnvironmentState,
    reason: string,
  ): Promise<NpmEnvironmentState> => {
    if (!state.npmPath || !preferredUserPrefix || state.prefix === preferredUserPrefix) {
      return state;
    }
    report?.({
      phase: "start",
      step: "Switch npm prefix",
    });
    append("Switch npm prefix", `Reason: ${reason}\nTarget: ${preferredUserPrefix}`);
    const dirResult = ensureDirectoryExists(preferredUserPrefix);
    append("Ensure preferred npm prefix", dirResult.message);
    if (!dirResult.ok) {
      report?.({
        phase: "done",
        step: "Switch npm prefix",
        ok: false,
        output: dirResult.message,
      });
      return state;
    }
    const setResult = await setNpmPrefix(state.npmPath, preferredUserPrefix);
    append("npm config set prefix", setResult.output);
    report?.({
      phase: "done",
      step: "Switch npm prefix",
      ok: setResult.ok,
      output: setResult.output,
    });
    const nextState = await inspectNpmEnvironment(false);
    await ensureNpmDirectories(nextState);
    append("npm environment after prefix switch", formatNpmState(nextState));
    return nextState;
  };

  let npmState = await inspectNpmEnvironment(false);
  append("Initial npm environment", formatNpmState(npmState));

  if (!npmState.nodePath || !npmState.npmPath) {
    const installed = await tryInstallNodeRuntime(report, append);
    npmState = await inspectNpmEnvironment(false);
    append("npm environment after Node.js install attempt", formatNpmState(npmState));
    if (!installed && (!npmState.nodePath || !npmState.npmPath)) {
      report?.({
        phase: "info",
        step: "Node.js/npm not ready",
        output:
          platform === "windows"
            ? "Install Node.js manually or make sure winget/choco/scoop is available, then retry."
            : "Install Node.js/npm manually or via your system package manager, then retry.",
      });
      return {
        ok: false,
        logs:
          logs.join("\n\n") +
          "\n\nNode.js/npm is still unavailable after auto-setup.",
      };
    }
  }

  if (!npmState.prefix && preferredUserPrefix && npmState.npmPath) {
    npmState = await switchNpmPrefixToPreferred(
      npmState,
      "npm config get prefix returned an empty value",
    );
  }

  const dirsOk = await ensureNpmDirectories(npmState);
  if (!dirsOk && preferredUserPrefix && npmState.npmPath && npmState.prefix !== preferredUserPrefix) {
    npmState = await switchNpmPrefixToPreferred(
      npmState,
      "npm global directories were missing or not writable",
    );
  }

  npmState = await inspectNpmEnvironment(true);
  append("Prepared npm environment", formatNpmState(npmState));

  const npmVersionMismatch =
    Boolean(npmState.npmReportedVersion) &&
    Boolean(npmState.npmPackageVersion) &&
    npmState.npmReportedVersion !== npmState.npmPackageVersion;
  const shouldUpdateNpm =
    shouldInstallLatestPackageVersion(
      npmState.npmPackageVersion || npmState.npmReportedVersion,
      npmState.latestNpmVersion,
    ) || npmVersionMismatch;

  if (shouldUpdateNpm && npmState.npmPath) {
    const targetVersion = normalizeVersionText(npmState.latestNpmVersion);
    const installTarget = targetVersion ? `npm@${targetVersion}` : "npm@latest";
    report?.({ phase: "start", step: `Update npm (${installTarget})` });
    let updateResult = await runExecutableCommand(npmState.npmPath, [
      "install",
      "-g",
      installTarget,
    ]);
    append(`Update npm (${installTarget})`, updateResult.output);
    if (updateResult.code !== 0 && looksLikePermissionError(updateResult.output)) {
      npmState = await switchNpmPrefixToPreferred(
        npmState,
        "npm update failed with a permissions error",
      );
      if (npmState.npmPath) {
        updateResult = await runExecutableCommand(npmState.npmPath, [
          "install",
          "-g",
          installTarget,
        ]);
        append(`Retry update npm (${installTarget})`, updateResult.output);
      }
    }
    report?.({
      phase: "done",
      step: `Update npm (${installTarget})`,
      ok: updateResult.code === 0,
      output: updateResult.output,
    });
  } else {
    report?.({
      phase: "info",
      step: "npm version check",
      output: npmState.latestNpmVersion
        ? `npm is already current (${npmState.npmPackageVersion || npmState.npmReportedVersion})`
        : "Latest npm version could not be determined; skipping npm update.",
    });
  }

  npmState = await inspectNpmEnvironment(true);
  append("Final npm environment", formatNpmState(npmState));

  if (!npmState.npmPath) {
    return {
      ok: false,
      logs: logs.join("\n\n"),
    };
  }

  const targetProviders = params?.provider
    ? [params.provider]
    : (Object.keys(PROVIDER_CLI_SPECS) as OAuthProviderId[]);
  let allOk = true;

  for (const provider of targetProviders) {
    const spec = getProviderCliSpec(provider);
    if (!spec) continue;
    const npmExecutablePath = npmState.npmPath;
    if (!npmExecutablePath) {
      allOk = false;
      append(
        `Install ${spec.packageName}`,
        "npm executable path is unavailable after environment preparation.",
      );
      continue;
    }

    const installedVersion = npmState.globalRoot
      ? await readGlobalPackageVersion(npmState.globalRoot, spec.packageName)
      : "";
    const latestVersion = await queryRegistryPackageVersion(
      npmExecutablePath,
      spec.packageName,
    );
    const needsInstall =
      !installedVersion ||
      shouldInstallLatestPackageVersion(installedVersion, latestVersion);

    if (needsInstall) {
      const targetPackage = latestVersion
        ? `${spec.packageName}@${latestVersion}`
        : spec.packageName;
      report?.({
        phase: "start",
        step: `Install ${spec.packageName}`,
      });
      let installResult = await runExecutableCommand(npmExecutablePath, [
        "install",
        "-g",
        targetPackage,
      ]);
      append(`Install ${spec.packageName}`, installResult.output);
      if (installResult.code !== 0 && looksLikePermissionError(installResult.output)) {
        npmState = await switchNpmPrefixToPreferred(
          npmState,
          `${spec.packageName} install failed with a permissions error`,
        );
        if (npmState.npmPath) {
          installResult = await runExecutableCommand(npmState.npmPath, [
            "install",
            "-g",
            targetPackage,
          ]);
          append(`Retry install ${spec.packageName}`, installResult.output);
        }
      }
      report?.({
        phase: "done",
        step: `Install ${spec.packageName}`,
        ok: installResult.code === 0,
        output: installResult.output,
      });
      if (installResult.code !== 0) {
        allOk = false;
      }
    } else {
      report?.({
        phase: "info",
        step: `Skip ${spec.packageName}`,
        output: `${spec.packageName} is already current (${installedVersion})`,
      });
      append(
        `Skip ${spec.packageName}`,
        `${spec.packageName} is already current (${installedVersion})`,
      );
    }

    npmState = await inspectNpmEnvironment(false);
    await ensureNpmDirectories(npmState);

    report?.({
      phase: "start",
      step: `Verify ${spec.executableName}`,
    });
    const verification = await verifyExecutable(spec.executableName, spec.versionArg, [
      npmState.globalBinDir,
      ...getCommonExecutableDirs(npmState.platform),
    ]);
    append(
      `Verify ${spec.executableName}`,
      [
        `path: ${verification.path || "-"}`,
        verification.output,
      ].join("\n"),
    );
    report?.({
      phase: "done",
      step: `Verify ${spec.executableName}`,
      ok: verification.ok,
      output: verification.output,
    });
    if (!verification.ok) {
      allOk = false;
    }
  }

  return { ok: allOk, logs: logs.join("\n\n") };
}

export async function getProviderAuthStatus(provider: OAuthProviderId): Promise<string> {
  const cred = await readProviderOAuthCredential(provider);
  if (!cred) return "Not logged in";

  if (provider === "openai-codex") {
    // Fetch usage info from the Codex backend for richer status
    try {
      const headers: Record<string, string> = {
        ...ensureProviderAuthHeaderInit(cred),
        Accept: "application/json",
      };
      if (cred.accountId) {
        headers["ChatGPT-Account-Id"] = cred.accountId;
      }
      const res = await getFetch()("https://chatgpt.com/backend-api/wham/usage", {
        method: "GET",
        headers,
      });
      if (!res.ok) {
        return "Logged in (token may be expired)";
      }
      const data = (await res.json()) as {
        plan_type?: string;
        credits?: { balance?: number | string | null };
        rate_limit?: {
          primary_window?: {
            limit_window_seconds?: number;
            used_percent?: number;
          };
        };
      };
      const parts: string[] = ["Logged in"];
      if (data.plan_type) {
        parts.push(data.plan_type);
      }
      if (data.credits?.balance !== undefined && data.credits.balance !== null) {
        const balance =
          typeof data.credits.balance === "number"
            ? data.credits.balance
            : parseFloat(String(data.credits.balance)) || 0;
        parts.push(`$${balance.toFixed(2)}`);
      }
      if (data.rate_limit?.primary_window) {
        const pw = data.rate_limit.primary_window;
        const windowHours = Math.round((pw.limit_window_seconds || 10800) / 3600);
        const usedPct = Math.round(pw.used_percent || 0);
        parts.push(`${windowHours}h ${usedPct}% used`);
      }
      return parts.join(" | ");
    } catch {
      return "Logged in";
    }
  }

  // Qwen / Copilot / Gemini �?generic status with optional expiry
  const parts: string[] = ["Logged in"];
  if (cred.projectId) {
    parts.push(`project: ${cred.projectId}`);
  }
  if (typeof cred.expiresAt === "number" && Number.isFinite(cred.expiresAt)) {
    const now = Date.now();
    if (cred.expiresAt > now) {
      const remainMin = Math.round((cred.expiresAt - now) / 60000);
      parts.push(remainMin > 60
        ? `expires in ${Math.round(remainMin / 60)}h`
        : `expires in ${remainMin}min`);
    } else {
      parts.push("token expired");
    }
  }
  return parts.join(" | ");
}

export async function getProviderAccountSummary(
  provider: OAuthProviderId,
): Promise<ProviderAccountSummary> {
  const cred = await readProviderOAuthCredential(provider);
  if (!cred) {
    return {
      provider,
      label: getProviderLabel(provider),
      account: "-",
      status: "Not logged in",
    };
  }

  let account: string;
  if (provider === "openai-codex") {
    // Try to read the user email from auth.json extras
    const home = homeDir();
    if (home) {
      const data = await readJsonFile(joinPath(home, ".codex", "auth.json"));
      const email = data?.user?.email || data?.tokens?.email || data?.email;
      account = typeof email === "string" && email.trim()
        ? email.trim()
        : cred.accountId || "ChatGPT OAuth";
    } else {
      account = cred.accountId || "ChatGPT OAuth";
    }
  } else if (provider === "google-gemini-cli") {
    // Gemini: try to read client_email or account from the credential file
    const home = homeDir();
    if (home) {
      const data = await readJsonFile(joinPath(home, ".gemini", "oauth_creds.json"));
      const email = data?.client_email || data?.account || data?.email;
      account = typeof email === "string" && email.trim()
        ? email.trim()
        : cred.projectId || "Google OAuth";
    } else {
      account = cred.projectId || "Google OAuth";
    }
  } else if (provider === "qwen") {
    account = "Qwen OAuth";
  } else if (provider === "github-copilot") {
    account = "GitHub OAuth";
  } else {
    account = "OAuth";
  }

  const status = await getProviderAuthStatus(provider);
  return {
    provider,
    label: getProviderLabel(provider),
    account,
    status,
  };
}

function buildOpenAIResponsesInput(params: {
  prompt: string;
  context?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  systemPrompt?: string;
}) {
  const input: Array<{ role: string; content: string }> = [];
  if (params.systemPrompt?.trim()) {
    input.push({ role: "system", content: params.systemPrompt.trim() });
  }
  if (params.context?.trim()) {
    input.push({ role: "system", content: `Document Context:\n${params.context.trim()}` });
  }
  for (const msg of params.history || []) {
    const role = msg.role === "assistant" ? "assistant" : msg.role === "system" ? "system" : "user";
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (!content.trim()) continue;
    input.push({ role, content });
  }
  input.push({ role: "user", content: params.prompt });
  return input;
}

/**
 * Build the top-level `instructions` string for the Codex backend.
 * The chatgpt.com/backend-api/codex/responses endpoint requires `instructions`
 * as a separate string field (not inside the input array).
 */
function buildCodexInstructions(params: {
  systemPrompt?: string;
  context?: string;
}): string {
  const parts: string[] = [];
  if (params.systemPrompt?.trim()) {
    parts.push(params.systemPrompt.trim());
  } else {
    parts.push("You are a helpful AI assistant.");
  }
  if (params.context?.trim()) {
    parts.push(`\nDocument Context:\n${params.context.trim()}`);
  }
  return parts.join("\n");
}

/**
 * Build the `input` messages array for the Codex backend.
 * Only user/assistant messages go here �?system prompt goes in `instructions`.
 * Supports multimodal input: images are attached to the last user message.
 *
 * Codex Responses API format:
 *   input: [
 *     { type: "message", role: "user",      content: [{ type: "input_text", text: "..." }] },
 *     { type: "message", role: "assistant",  content: [{ type: "output_text", text: "..." }] },
 *     { type: "message", role: "user",      content: [
 *       { type: "input_text", text: "prompt" },
 *       { type: "input_image", image_url: "data:..." }
 *     ]}
 *   ]
 */
function buildCodexInput(params: {
  prompt: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  images?: string[];
}): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = [];

  // Add history messages
  for (const msg of params.history || []) {
    const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (!text.trim()) continue;
    if (msg.role === "assistant") {
      input.push({
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text }],
      });
    } else {
      input.push({
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      });
    }
  }

  // Build the current user message with optional images
  const contentParts: Array<Record<string, unknown>> = [];
  contentParts.push({ type: "input_text", text: params.prompt });

  const images = (params.images || []).filter(Boolean);
  for (const dataUri of images) {
    contentParts.push({
      type: "input_image",
      image_url: dataUri,
    });
  }

  input.push({
    type: "message",
    role: "user",
    content: contentParts,
  });

  return input;
}

/**
 * Parse a streaming SSE response from the Codex backend incrementally.
 * Calls `onDelta` for each `response.output_text.delta` event as it arrives.
 */
async function parseCodexSSEStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (
            event.type === "response.output_text.delta" &&
            typeof event.delta === "string"
          ) {
            fullText += event.delta;
            onDelta?.(event.delta);
          }
          // Fallback: if we get a completed response with output_text and no
          // streaming deltas were received, use the full text.
          if (
            event.type === "response.completed" &&
            typeof event.response?.output_text === "string" &&
            !fullText
          ) {
            fullText = event.response.output_text;
            onDelta?.(fullText);
          }
        } catch {
          // skip non-JSON data lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText || "(No response text)";
}

/**
 * Parse a streaming SSE response from the Gemini streamGenerateContent endpoint.
 * Each SSE event is a JSON object with candidates[].content.parts[].text.
 */
async function parseGeminiSSEStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as any;
          const parts = extractGeminiResponseTextParts(parsed);
          for (const text of parts) {
            fullText += text;
            onDelta?.(text);
          }
        } catch {
          // skip non-JSON data lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

function generateGeminiUserPromptId(): string {
  const bytes = new Uint8Array(8);
  const cryptoApi = (globalThis as any).crypto;
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `aidea-${Date.now().toString(36)}-${suffix}`;
}

function buildGeminiOAuthPromptText(params: {
  prompt: string;
  context?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  systemPrompt?: string;
}): string {
  const userParts: string[] = [];
  if (params.systemPrompt?.trim()) {
    userParts.push(`System:\n${params.systemPrompt.trim()}`);
  }
  if (params.context?.trim()) {
    userParts.push(`Document Context:\n${params.context.trim()}`);
  }
  for (const msg of params.history || []) {
    const content =
      typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
    if (!content.trim()) continue;
    userParts.push(
      `${msg.role === "assistant" ? "Assistant" : msg.role === "system" ? "System" : "User"}:\n${content}`,
    );
  }
  userParts.push(`User:\n${params.prompt}`);
  return userParts.join("\n\n");
}

export function buildGeminiCodeAssistRequestPayload(params: {
  model: string;
  prompt: string;
  projectId: string;
  context?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}): Record<string, unknown> {
  const modelId = params.model.replace(/^models\//, "");
  const request: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: buildGeminiOAuthPromptText(params) }] }],
  };

  const generationConfig: Record<string, unknown> = {};
  if (typeof params.temperature === "number" && Number.isFinite(params.temperature)) {
    generationConfig.temperature = params.temperature;
  }
  if (typeof params.maxTokens === "number" && Number.isFinite(params.maxTokens)) {
    generationConfig.maxOutputTokens = Math.max(1, Math.round(params.maxTokens));
  }
  if (Object.keys(generationConfig).length > 0) {
    request.generationConfig = generationConfig;
  }

  return {
    model: modelId,
    project: params.projectId,
    user_prompt_id: generateGeminiUserPromptId(),
    request,
  };
}

function extractGeminiResponseTextParts(data: unknown): string[] {
  const root = data && typeof data === "object" ? data as any : null;
  const candidates = Array.isArray(root?.candidates)
    ? root.candidates
    : Array.isArray(root?.response?.candidates)
      ? root.response.candidates
      : [];
  return candidates
    .flatMap((candidate: any) =>
      Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [],
    )
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean);
}

export function extractGeminiResponseText(data: unknown): string {
  return extractGeminiResponseTextParts(data).join("\n");
}

function buildGeminiCodeAssistHeaders(
  cred: OAuthCredential,
  model: string,
): Record<string, string> {
  const platform = currentPlatform();
  const modelId = model.replace(/^models\//, "");
  const platformLabel = platform === "macos" ? "darwin" : platform;
  return {
    Authorization: `Bearer ${cred.accessToken}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream",
    "User-Agent": `AIdea/1.0/${modelId} (${platformLabel})`,
  };
}

async function parseGeminiSSEText(
  raw: string,
  onDelta?: (delta: string) => void,
): Promise<string> {
  let fullText = "";
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") continue;

    try {
      const parsed = JSON.parse(data);
      const parts = extractGeminiResponseTextParts(parsed);
      for (const text of parts) {
        fullText += text;
        onDelta?.(text);
      }
    } catch {
      // skip non-JSON data lines
    }
  }
  return fullText;
}

/**
 * Parse a standard OpenAI-compatible SSE stream (choices[0].delta.content).
 * Used by Qwen and GitHub Copilot.
 */
async function parseOpenAICompatSSEStream(
  body: ReadableStream<Uint8Array>,
  onDelta?: (delta: string) => void,
): Promise<string> {
  const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as any;
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) {
            fullText += delta;
            onDelta?.(delta);
          }
        } catch {
          // skip non-JSON data lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText || "(No response text)";
}

export async function chatWithProviderOAuth(params: {
  provider: OAuthProviderId;
  model: string;
  prompt: string;
  context?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  systemPrompt?: string;
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  images?: string[];
  onDelta?: (delta: string) => void;
}): Promise<string> {
  const cred = await readProviderOAuthCredential(params.provider);
  if (!cred?.accessToken) {
    throw new Error(
      `${getProviderLabel(params.provider)} is not logged in. Please complete OAuth login in Settings first.`,
    );
  }

  if (params.provider === "openai-codex") {
    // The Codex OAuth token is a ChatGPT session token that works with
    // chatgpt.com/backend-api endpoints (openai-codex-responses API).
    // Required: instructions, store=false, stream=true.
    const instructions = buildCodexInstructions(params);
    const input = buildCodexInput(params);

    const payload: Record<string, unknown> = {
      model: params.model,
      instructions,
      input,
      store: false,
      stream: true,
    };
    const codexHeaders: Record<string, string> = {
      ...ensureProviderAuthHeaderInit(cred),
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (cred.accountId) {
      codexHeaders["ChatGPT-Account-Id"] = cred.accountId;
    }
    const res = await getFetch()("https://chatgpt.com/backend-api/codex/responses", {
      method: "POST",
      headers: codexHeaders,
      body: JSON.stringify(payload),
      signal: params.signal,
    });
    if (!res.ok) {
      throw new Error(`Codex OAuth HTTP ${res.status}: ${await res.text()}`);
    }
    // Stream SSE �?read body incrementally, call onDelta per chunk
    if (res.body) {
      return parseCodexSSEStream(res.body, params.onDelta);
    }
    // Fallback: if body is not a ReadableStream (some Gecko builds),
    // download the full text and parse SSE lines.
    const raw = await res.text();
    let fullText = "";
    for (const line of raw.split("\n")) {
      if (!line.trim().startsWith("data:")) continue;
      const data = line.trim().slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const event = JSON.parse(data);
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          fullText += event.delta;
          params.onDelta?.(event.delta);
        }
        if (event.type === "response.completed" && event.response?.output_text && !fullText) {
          fullText = event.response.output_text;
          params.onDelta?.(fullText);
        }
      } catch { /* skip */ }
    }
    return fullText || "(No response text)";
  }

  // ---------- Qwen (OpenAI-compatible) ----------
  if (params.provider === "qwen") {
    const messages = buildOpenAIResponsesInput(params);
    const payload: Record<string, unknown> = {
      model: params.model,
      messages,
      stream: true,
    };
    if (typeof params.temperature === "number" && Number.isFinite(params.temperature)) {
      payload.temperature = params.temperature;
    }
    if (typeof params.maxTokens === "number" && Number.isFinite(params.maxTokens)) {
      payload.max_tokens = params.maxTokens;
    }
    const qwenUrl = `${getQwenBaseUrl()}/chat/completions`;
    const res = await getFetch()(qwenUrl, {
      method: "POST",
      headers: {
        ...ensureProviderAuthHeaderInit(cred),
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal: params.signal,
    });
    if (!res.ok) {
      throw new Error(`Qwen OAuth HTTP ${res.status}: ${await res.text()}`);
    }
    if (res.body) {
      return parseOpenAICompatSSEStream(res.body, params.onDelta);
    }
    // Fallback: non-streaming
    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content || JSON.stringify(data);
    params.onDelta?.(text);
    return text;
  }

  // ---------- GitHub Copilot (OpenAI-compatible via token exchange) ----------
  if (params.provider === "github-copilot") {
    // Ensure we have a valid Copilot API token
    const copilotResult = await ensureCopilotApiToken();
    if (!copilotResult) {
      throw new Error("GitHub Copilot is not logged in. Please complete OAuth login in Settings first.");
    }
    const messages = buildOpenAIResponsesInput(params);
    const payload: Record<string, unknown> = {
      model: params.model,
      messages,
      stream: true,
    };
    if (typeof params.temperature === "number" && Number.isFinite(params.temperature)) {
      payload.temperature = params.temperature;
    }
    if (typeof params.maxTokens === "number" && Number.isFinite(params.maxTokens)) {
      payload.max_tokens = params.maxTokens;
    }
    const copilotUrl = `${copilotResult.baseUrl}/chat/completions`;
    const copilotHeaders: Record<string, string> = {
      Authorization: `Bearer ${copilotResult.token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      "Copilot-Integration-Id": "vscode-chat",
      "Editor-Version": "Zotero-AIdea/1.0",
    };
    const res = await getFetch()(copilotUrl, {
      method: "POST",
      headers: copilotHeaders,
      body: JSON.stringify(payload),
      signal: params.signal,
    });
    if (!res.ok) {
      throw new Error(`Copilot OAuth HTTP ${res.status}: ${await res.text()}`);
    }
    if (res.body) {
      return parseOpenAICompatSSEStream(res.body, params.onDelta);
    }
    // Fallback: non-streaming
    const data = (await res.json()) as any;
    const text = data?.choices?.[0]?.message?.content || JSON.stringify(data);
    params.onDelta?.(text);
    return text;
  }

  // ---------- Google Gemini CLI (Cloud Code Assist streaming) ----------
  const geminiPayload = buildGeminiCodeAssistRequestPayload({
    model: params.model,
    prompt: params.prompt,
    projectId: cred.projectId || "",
    context: params.context,
    history: params.history,
    systemPrompt: params.systemPrompt,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  });
  if (!cred.projectId) {
    throw new Error(
      "Gemini OAuth: no GCP project ID found. Try:\n" +
      "1. Remove Auth → OAuth Login (re-authorize)\n" +
      "2. Or install gcloud CLI and run: gcloud config set project YOUR_PROJECT_ID\n" +
      "3. Or set env var GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID"
    );
  }
  const res = await getFetch()(GEMINI_CODE_ASSIST_STREAM_URL, {
    method: "POST",
    headers: buildGeminiCodeAssistHeaders(cred, params.model),
    body: JSON.stringify(geminiPayload),
    signal: params.signal,
  });
  if (!res.ok) {
    throw new Error(`Gemini OAuth HTTP ${res.status}: ${await res.text()}`);
  }
  if (res.body) {
    const streamed = await parseGeminiSSEStream(res.body, params.onDelta);
    return streamed || "(No response text)";
  }
  const raw = await res.text();
  const streamed = await parseGeminiSSEText(raw, params.onDelta);
  if (streamed) return streamed;
  return raw || "(No response text)";
}

export async function callProviderEmbeddingsUnsupported(): Promise<never> {
  throw new Error(
    "OAuth-only mode does not provide embeddings. AIdea falls back to BM25 retrieval.",
  );
}
