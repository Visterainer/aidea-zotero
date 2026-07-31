import {
  runShellCommand,
  currentPlatform,
  escapeShellArg,
} from "./processRunner";
import { fetchWithTransientRetry } from "./transientRetry";
import { recordOAuthEnvUpdateSuccess } from "./oauthEnvUpdateState";
import {
  DEFAULT_PANEL_LANG,
  detectPanelLangFromLocale,
  getUiLanguageOption,
  normalizeUiLanguageCode,
  type PanelLang,
} from "../modules/contextPanel/languages";

declare const Zotero: any;
declare const ztoolkit: any;
declare const Cc: any;
declare const Ci: any;

type OAuthUiLang = PanelLang;

const OAUTH_COPIED_TOAST: Record<OAuthUiLang, string> = {
  "en-US": "\u2705 Code copied",
  "zh-CN": "\u2705 已复制授权码",
  "zh-TW": "\u2705 已複製授權碼",
  "ja-JP": "\u2705 コードをコピーしました",
  "ko-KR": "\u2705 코드가 복사되었습니다",
  "fr-FR": "\u2705 Code copie",
  "de-DE": "\u2705 Code kopiert",
  "es-ES": "\u2705 Codigo copiado",
  "ru-RU": "\u2705 Код скопирован",
  "pt-BR": "\u2705 Codigo copiado",
  "ar-SA": "\u2705 تم نسخ الرمز",
  "hi-IN": "\u2705 कोड कॉपी हुआ",
};

type CopilotDeviceLoginCopy = {
  title: string;
  codeLabel: string;
  instructions: string;
  cancelled: string;
};

const COPILOT_DEVICE_LOGIN_COPY: Record<OAuthUiLang, CopilotDeviceLoginCopy> = {
  "en-US": {
    title: "GitHub Copilot OAuth Login",
    codeLabel: "Your authorization code",
    instructions:
      "Click OK to copy the code and open the authorization page in your browser.\nPaste this code on the browser page to complete authorization.",
    cancelled: "Authorization cancelled by user",
  },
  "zh-CN": {
    title: "GitHub Copilot OAuth 登录",
    codeLabel: "你的授权码",
    instructions:
      "点击“确定”会自动复制授权码并在浏览器中打开授权页面。\n请在浏览器页面中粘贴此授权码完成授权。",
    cancelled: "用户取消了授权",
  },
  "zh-TW": {
    title: "GitHub Copilot OAuth 登入",
    codeLabel: "你的授權碼",
    instructions:
      "點擊「確定」會自動複製授權碼並在瀏覽器中開啟授權頁面。\n請在瀏覽器頁面中貼上此授權碼完成授權。",
    cancelled: "使用者已取消授權",
  },
  "ja-JP": {
    title: "GitHub Copilot OAuth ログイン",
    codeLabel: "認証コード",
    instructions:
      "OK をクリックするとコードをコピーし、ブラウザで認証ページを開きます。\nブラウザのページにこのコードを貼り付けて認証を完了してください。",
    cancelled: "ユーザーが認証をキャンセルしました",
  },
  "ko-KR": {
    title: "GitHub Copilot OAuth 로그인",
    codeLabel: "인증 코드",
    instructions:
      "확인을 클릭하면 코드를 복사하고 브라우저에서 인증 페이지를 엽니다.\n브라우저 페이지에 이 코드를 붙여 넣어 인증을 완료하세요.",
    cancelled: "사용자가 인증을 취소했습니다",
  },
  "fr-FR": {
    title: "Connexion OAuth GitHub Copilot",
    codeLabel: "Votre code d'autorisation",
    instructions:
      "Cliquez sur OK pour copier le code et ouvrir la page d'autorisation dans votre navigateur.\nCollez ce code sur la page du navigateur pour terminer l'autorisation.",
    cancelled: "Autorisation annulee par l'utilisateur",
  },
  "de-DE": {
    title: "GitHub Copilot OAuth-Anmeldung",
    codeLabel: "Ihr Autorisierungscode",
    instructions:
      "Klicken Sie auf OK, um den Code zu kopieren und die Autorisierungsseite im Browser zu oeffnen.\nFuegen Sie diesen Code dort ein, um die Autorisierung abzuschliessen.",
    cancelled: "Autorisierung vom Benutzer abgebrochen",
  },
  "es-ES": {
    title: "Inicio de sesion OAuth de GitHub Copilot",
    codeLabel: "Tu codigo de autorizacion",
    instructions:
      "Haz clic en Aceptar para copiar el codigo y abrir la pagina de autorizacion en el navegador.\nPega este codigo en la pagina del navegador para completar la autorizacion.",
    cancelled: "Autorizacion cancelada por el usuario",
  },
  "ru-RU": {
    title: "Вход GitHub Copilot OAuth",
    codeLabel: "Ваш код авторизации",
    instructions:
      "Нажмите OK, чтобы скопировать код и открыть страницу авторизации в браузере.\nВставьте этот код на странице браузера, чтобы завершить авторизацию.",
    cancelled: "Авторизация отменена пользователем",
  },
  "pt-BR": {
    title: "Login OAuth do GitHub Copilot",
    codeLabel: "Seu codigo de autorizacao",
    instructions:
      "Clique em OK para copiar o codigo e abrir a pagina de autorizacao no navegador.\nCole este codigo na pagina do navegador para concluir a autorizacao.",
    cancelled: "Autorizacao cancelada pelo usuario",
  },
  "ar-SA": {
    title: "تسجيل دخول GitHub Copilot OAuth",
    codeLabel: "رمز التفويض",
    instructions:
      "اضغط OK لنسخ الرمز وفتح صفحة التفويض في المتصفح.\nالصق هذا الرمز في صفحة المتصفح لإكمال التفويض.",
    cancelled: "ألغى المستخدم التفويض",
  },
  "hi-IN": {
    title: "GitHub Copilot OAuth लॉगिन",
    codeLabel: "आपका authorization code",
    instructions:
      "OK पर क्लिक करने से कोड कॉपी होगा और ब्राउज़र में authorization पेज खुलेगा।\nauthorization पूरा करने के लिए ब्राउज़र पेज पर यह कोड पेस्ट करें।",
    cancelled: "उपयोगकर्ता ने authorization रद्द किया",
  },
};

/** Read the UI language preference (same logic as preferenceScript.getLang). */
function getUiLang(): OAuthUiLang {
  try {
    const saved = String(
      Zotero.Prefs.get("extensions.zotero.aidea.uiLanguage", true) || "",
    ).trim();
    const savedLang = normalizeUiLanguageCode(saved);
    if (savedLang) return savedLang;
    return detectPanelLangFromLocale(String((Zotero as any)?.locale || ""));
  } catch {
    return DEFAULT_PANEL_LANG;
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
    const toast = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLDivElement;
    const language = getUiLanguageOption(lang);
    toast.textContent = OAUTH_COPIED_TOAST[lang] || OAUTH_COPIED_TOAST["en-US"];
    toast.lang = language.htmlLang;
    toast.dir = language.dir;
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
    win.setTimeout(() => {
      toast.style.opacity = "0";
    }, 1600);
    win.setTimeout(() => {
      try {
        toast.remove();
      } catch {
        /* */
      }
    }, 2200);
  } catch {
    /* best-effort */
  }
}

export type OAuthProviderId =
  "openai-codex" | "google-gemini-cli" | "github-copilot";

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
  supportedEndpoints?: string[];
  policyState?: "enabled" | "disabled";
  /** In-memory only — not persisted; set by ping test. */
  status?: "ok" | "fail" | "testing";
};

export type ProviderAccountSummary = {
  provider: OAuthProviderId;
  label: string;
  account: string;
  status: string;
};

export type OAuthCliEnvironmentUpdateCheck = {
  provider: OAuthProviderId;
  needsUpdate: boolean;
  reason: string;
  installedVersion?: string;
  latestVersion?: string;
};

type SupportedPlatform = "windows" | "macos" | "linux";

type ProviderCliSpec = {
  packageName: string;
  executableName: string;
  versionArg: string;
  minNodeVersion?: [number, number, number];
  minNodeVersionLabel?: string;
};

type NpmEnvironmentState = {
  platform: SupportedPlatform;
  nodePath: string | null;
  npmPath: string | null;
  nodeVersion: string;
  nodeArch: string;
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
    minNodeVersion: [20, 0, 0],
    minNodeVersionLabel: "Node.js >= 20",
  },
};

export function normalizeVersionText(raw: string | null | undefined): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const match = text.match(/\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9._-]+)?/);
  return match ? match[0] : "";
}

function parseVersionParts(
  raw: string | null | undefined,
): [number, number, number] | null {
  const normalized = normalizeVersionText(raw);
  if (!normalized) return null;
  const parts = normalized
    .split(/[+-]/, 1)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(parts[0])) return null;
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}

function isVersionAtLeast(
  raw: string | null | undefined,
  major: number,
  minor = 0,
  patch = 0,
): boolean {
  const parts = parseVersionParts(raw);
  if (!parts) return false;
  const target = [major, minor, patch];
  for (let i = 0; i < target.length; i += 1) {
    if (parts[i] > target[i]) return true;
    if (parts[i] < target[i]) return false;
  }
  return true;
}

function isNodeVersionSupportedByLatestNpm(
  nodeVersion: string | null | undefined,
): boolean {
  const parts = parseVersionParts(nodeVersion);
  if (!parts) return false;
  const [major] = parts;
  if (major === 20) return isVersionAtLeast(nodeVersion, 20, 17, 0);
  if (major === 22) return isVersionAtLeast(nodeVersion, 22, 9, 0);
  return major > 22;
}

function isNodeVersionSupportedByCliSpec(
  nodeVersion: string | null | undefined,
  spec: ProviderCliSpec | null | undefined,
): boolean {
  if (!spec?.minNodeVersion) return true;
  const [major, minor, patch] = spec.minNodeVersion;
  return isVersionAtLeast(nodeVersion, major, minor, patch);
}

export function isNodeVersionSupportedByProviderCli(
  provider: OAuthProviderId,
  nodeVersion: string | null | undefined,
): boolean {
  return isNodeVersionSupportedByCliSpec(
    nodeVersion,
    getProviderCliSpec(provider),
  );
}

function looksLikeMissingOptionalDependency(output: string): boolean {
  return /Missing optional dependency\s+@openai\/codex-/i.test(
    String(output || ""),
  );
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
  return platform === "windows"
    ? normalized
    : joinPath(normalized, "bin", platform);
}

export function getCodexStandaloneInstallCommand(
  platform: SupportedPlatform,
): string {
  if (platform === "windows") {
    return "$env:CODEX_NON_INTERACTIVE=1; $sys=$env:SystemRoot; $env:Path=(Join-Path $sys 'System32')+';'+$sys+';'+(Join-Path $sys 'System32\\WindowsPowerShell\\v1.0')+';'+$env:Path; irm https://chatgpt.com/codex/install.ps1 | iex";
  }
  return "curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh";
}

export function deriveCodexStandaloneBinDirs(
  platform: SupportedPlatform,
  home: string,
  localAppData = "",
  installDir = "",
): string[] {
  const dirs: string[] = [];
  if (installDir) dirs.push(installDir);
  if (platform === "windows") {
    const localData =
      localAppData ||
      (home ? joinPath(home, "AppData", "Local", platform) : "");
    if (localData) {
      dirs.push(
        joinPath(localData, "Programs", "OpenAI", "Codex", "bin", platform),
      );
    }
  } else if (home) {
    dirs.push(joinPath(home, ".local", "bin", platform));
  }
  return dedupePathEntries(dirs, platform);
}

function getCodexStandaloneBinDirs(
  platform: SupportedPlatform = currentPlatform(),
): string[] {
  return deriveCodexStandaloneBinDirs(
    platform,
    homeDir(),
    getEnv("LOCALAPPDATA"),
    getEnv("CODEX_INSTALL_DIR"),
  ).filter(isDirectoryPath);
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

export function getOAuthCliProviders(): OAuthProviderId[] {
  return Object.keys(PROVIDER_CLI_SPECS) as OAuthProviderId[];
}

const PROVIDER_MARKER_PREFIX = "oauth://";

export function providerToMarker(provider: OAuthProviderId): string {
  return `${PROVIDER_MARKER_PREFIX}${provider}`;
}

export function markerToProvider(
  value: string | undefined | null,
): OAuthProviderId | null {
  const raw = String(value || "").trim();
  if (raw === providerToMarker("openai-codex") || raw === "openai-codex")
    return "openai-codex";
  if (
    raw === providerToMarker("google-gemini-cli") ||
    raw === "google-gemini-cli"
  ) {
    return "google-gemini-cli";
  }

  if (raw === providerToMarker("github-copilot") || raw === "github-copilot")
    return "github-copilot";
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
    const env = Cc["@mozilla.org/process/environment;1"].getService(
      Ci.nsIEnvironment,
    );
    return String(env.get(name) || "").trim();
  } catch {
    return "";
  }
}

function setProxyEnv(proxyUrl: string, noProxy?: string): void {
  for (const key of [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
  ]) {
    setProcessEnv(key, proxyUrl);
  }
  const bypass = String(noProxy || "").trim();
  if (bypass) {
    setProcessEnv("NO_PROXY", bypass);
    setProcessEnv("no_proxy", bypass);
  }
}

export type SystemProxyConfig = {
  httpHost?: string;
  httpPort?: number;
  httpsHost?: string;
  httpsPort?: number;
  socksHost?: string;
  socksPort?: number;
  socksVersion?: 4 | 5;
  noProxy?: string;
  envUrl?: string;
};

type ZoteroProxySnapshot = SystemProxyConfig & {
  type: number;
};

export type ProxySyncDecision =
  | "apply"
  | "update-managed"
  | "adopt-legacy-matching"
  | "adopt-legacy-loopback"
  | "skip-user-managed"
  | "skip-non-manual";

const PROXY_AUTO_APPLIED_PREF = "extensions.zotero.aidea.proxy.autoApplied";
const PROXY_LAST_SIGNATURE_PREF = "extensions.zotero.aidea.proxy.lastSignature";
const PROXY_LAST_MODE_PREF = "extensions.zotero.aidea.proxy.lastMode";

function hasUsableSystemProxy(proxy: SystemProxyConfig): boolean {
  return Boolean(
    (proxy.httpHost && proxy.httpPort) ||
    (proxy.httpsHost && proxy.httpsPort) ||
    (proxy.socksHost && proxy.socksPort),
  );
}

function parseHostPort(value: string): { host: string; port: number } | null {
  const [host, portText] = String(value || "")
    .trim()
    .split(":");
  const port = Number(portText);
  if (!host || !Number.isInteger(port) || port <= 0) return null;
  return { host: host.trim(), port };
}

function normalizeNoProxy(value: string | undefined): string {
  return String(value || "")
    .split(/[;,]/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(",");
}

function normalizeProxyHost(value: string | undefined): string {
  return String(value || "")
    .trim()
    .replace(/^\[(::1)\]$/i, "$1")
    .toLowerCase();
}

function isLoopbackProxyHost(value: string | undefined): boolean {
  const host = normalizeProxyHost(value);
  return (
    host === "localhost" ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1" ||
    host === "127.0.0.1" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

function hasLoopbackProxyEndpoint(proxy: SystemProxyConfig): boolean {
  return Boolean(
    (proxy.httpPort && isLoopbackProxyHost(proxy.httpHost)) ||
    (proxy.httpsPort && isLoopbackProxyHost(proxy.httpsHost)) ||
    (proxy.socksPort && isLoopbackProxyHost(proxy.socksHost)),
  );
}

function endpointSignature(host?: string, port?: number): string {
  const normalizedHost = normalizeProxyHost(host);
  const normalizedPort =
    typeof port === "number" && Number.isFinite(port) && port > 0
      ? String(port)
      : "";
  return normalizedHost && normalizedPort
    ? `${normalizedHost}:${normalizedPort}`
    : "";
}

export function getSystemProxySignature(proxy: SystemProxyConfig): string {
  return [
    `http=${endpointSignature(proxy.httpHost, proxy.httpPort)}`,
    `https=${endpointSignature(proxy.httpsHost, proxy.httpsPort)}`,
    `socks=${endpointSignature(proxy.socksHost, proxy.socksPort)}`,
    `socksVersion=${proxy.socksHost && proxy.socksPort ? proxy.socksVersion || 5 : ""}`,
    `noProxy=${normalizeNoProxy(proxy.noProxy)}`,
  ].join(";");
}

export function parseProxyUrl(value: string): SystemProxyConfig | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.includes("://") ? raw : `http://${raw}`);
    const protocol = url.protocol.replace(/:$/, "").toLowerCase();
    const host = url.hostname.trim();
    const defaultPort = protocol.startsWith("socks")
      ? 1080
      : protocol === "https"
        ? 443
        : 80;
    const port = Number(url.port || defaultPort);
    if (!host || !Number.isInteger(port) || port <= 0) return null;
    const envUrl = raw;
    if (protocol.startsWith("socks")) {
      return {
        socksHost: host,
        socksPort: port,
        socksVersion: protocol === "socks4" ? 4 : 5,
        envUrl,
      };
    }
    return {
      httpHost: host,
      httpPort: port,
      httpsHost: host,
      httpsPort: port,
      envUrl,
    };
  } catch {
    const parsed = parseHostPort(raw);
    if (!parsed) return null;
    return {
      httpHost: parsed.host,
      httpPort: parsed.port,
      httpsHost: parsed.host,
      httpsPort: parsed.port,
      envUrl: `http://${parsed.host}:${parsed.port}`,
    };
  }
}

export function decideSystemProxySync(params: {
  currentType: number;
  currentSignature: string;
  systemSignature: string;
  autoApplied: boolean;
  lastSignature: string;
  currentLoopback: boolean;
  systemLoopback: boolean;
  forceRefresh?: boolean;
}): ProxySyncDecision {
  if (params.currentType === 0 || params.currentType === 5) return "apply";
  if (params.currentType !== 1) return "skip-non-manual";

  if (params.autoApplied) {
    return !params.lastSignature ||
      params.currentSignature === params.lastSignature
      ? "update-managed"
      : "skip-user-managed";
  }

  if (params.currentSignature === params.systemSignature) {
    return "adopt-legacy-matching";
  }

  if (params.forceRefresh && params.currentLoopback && params.systemLoopback) {
    return "adopt-legacy-loopback";
  }

  return "skip-user-managed";
}

function getZoteroProxySnapshot(prefSvc: any): ZoteroProxySnapshot {
  const getInt = (key: string, fallback = 0): number => {
    try {
      return prefSvc.getIntPref(key, fallback);
    } catch {
      return fallback;
    }
  };
  const getChar = (key: string): string => {
    try {
      return String(prefSvc.getCharPref(key) || "").trim();
    } catch {
      return "";
    }
  };
  return {
    type: getInt("network.proxy.type", 0),
    httpHost: getChar("network.proxy.http") || undefined,
    httpPort: getInt("network.proxy.http_port", 0) || undefined,
    httpsHost: getChar("network.proxy.ssl") || undefined,
    httpsPort: getInt("network.proxy.ssl_port", 0) || undefined,
    socksHost: getChar("network.proxy.socks") || undefined,
    socksPort: getInt("network.proxy.socks_port", 0) || undefined,
    socksVersion: (getInt("network.proxy.socks_version", 5) === 4 ? 4 : 5) as
      4 | 5,
    noProxy: getChar("network.proxy.no_proxies_on") || undefined,
  };
}

function getPluginBooleanPref(key: string): boolean {
  try {
    return String(Zotero.Prefs.get(key, true) || "") === "true";
  } catch {
    return false;
  }
}

function getPluginStringPref(key: string): string {
  try {
    return String(Zotero.Prefs.get(key, true) || "").trim();
  } catch {
    return "";
  }
}

function setPluginStringPref(key: string, value: string): void {
  try {
    Zotero.Prefs.set(key, value, true);
  } catch {
    /* ignore */
  }
}

function getProxyEnvUrl(proxy: SystemProxyConfig): string {
  if (proxy.envUrl) return proxy.envUrl;
  if (proxy.httpsHost && proxy.httpsPort) {
    return `http://${proxy.httpsHost}:${proxy.httpsPort}`;
  }
  if (proxy.httpHost && proxy.httpPort) {
    return `http://${proxy.httpHost}:${proxy.httpPort}`;
  }
  if (proxy.socksHost && proxy.socksPort) {
    return `socks${proxy.socksVersion || 5}://${proxy.socksHost}:${proxy.socksPort}`;
  }
  return "";
}

function rememberAppliedProxy(signature: string, mode: string): void {
  setPluginStringPref(PROXY_AUTO_APPLIED_PREF, "true");
  setPluginStringPref(PROXY_LAST_SIGNATURE_PREF, signature);
  setPluginStringPref(PROXY_LAST_MODE_PREF, mode);
}

function applySystemProxyToZotero(
  proxy: SystemProxyConfig,
  options?: { forceRefresh?: boolean },
): boolean {
  if (!hasUsableSystemProxy(proxy)) return false;
  try {
    const prefSvc = Cc["@mozilla.org/preferences-service;1"]?.getService(
      Ci.nsIPrefBranch,
    );
    if (!prefSvc) return false;

    const systemSignature = getSystemProxySignature(proxy);
    const current = getZoteroProxySnapshot(prefSvc);
    const currentSignature = getSystemProxySignature(current);
    const decision = decideSystemProxySync({
      currentType: current.type,
      currentSignature,
      systemSignature,
      autoApplied: getPluginBooleanPref(PROXY_AUTO_APPLIED_PREF),
      lastSignature: getPluginStringPref(PROXY_LAST_SIGNATURE_PREF),
      currentLoopback: hasLoopbackProxyEndpoint(current),
      systemLoopback: hasLoopbackProxyEndpoint(proxy),
      forceRefresh: options?.forceRefresh,
    });

    const proxyEnvUrl = getProxyEnvUrl(proxy);
    if (proxyEnvUrl) setProxyEnv(proxyEnvUrl, proxy.noProxy);

    if (decision === "skip-user-managed" || decision === "skip-non-manual") {
      ztoolkit?.log?.(
        `AIdea: Skipped Zotero proxy sync (${decision}); leaving user-managed proxy unchanged`,
      );
      return false;
    }

    prefSvc.setIntPref("network.proxy.type", 1);
    prefSvc.setCharPref(
      "network.proxy.no_proxies_on",
      proxy.noProxy || "localhost, 127.0.0.1, ::1",
    );

    const httpHost = proxy.httpHost || proxy.httpsHost || "";
    const httpPort = proxy.httpPort || proxy.httpsPort || 0;
    const httpsHost = proxy.httpsHost || proxy.httpHost || "";
    const httpsPort = proxy.httpsPort || proxy.httpPort || 0;
    prefSvc.setCharPref("network.proxy.http", httpHost);
    prefSvc.setIntPref("network.proxy.http_port", httpPort);
    prefSvc.setCharPref("network.proxy.ssl", httpsHost);
    prefSvc.setIntPref("network.proxy.ssl_port", httpsPort);

    if (proxy.socksHost && proxy.socksPort) {
      prefSvc.setCharPref("network.proxy.socks", proxy.socksHost);
      prefSvc.setIntPref("network.proxy.socks_port", proxy.socksPort);
      prefSvc.setIntPref(
        "network.proxy.socks_version",
        proxy.socksVersion || 5,
      );
      prefSvc.setBoolPref("network.proxy.socks_remote_dns", true);
    } else {
      prefSvc.setCharPref("network.proxy.socks", "");
      prefSvc.setIntPref("network.proxy.socks_port", 0);
    }

    rememberAppliedProxy(systemSignature, "manual");
    ztoolkit?.log?.(
      `AIdea: Applied system proxy to Zotero (${decision}): ${systemSignature}`,
    );
    return true;
  } catch {
    return false;
  }
}

export function parseMacSystemProxy(raw: string): SystemProxyConfig | null {
  const getValue = (key: string): string => {
    const match = String(raw || "").match(
      new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, "m"),
    );
    return match ? match[1].trim() : "";
  };
  const isEnabled = (key: string) => getValue(key) === "1";
  const getPort = (key: string): number | undefined => {
    const value = Number(getValue(key));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  };

  const cfg: SystemProxyConfig = {};
  if (isEnabled("HTTPEnable")) {
    cfg.httpHost = getValue("HTTPProxy") || undefined;
    cfg.httpPort = getPort("HTTPPort");
  }
  if (isEnabled("HTTPSEnable")) {
    cfg.httpsHost = getValue("HTTPSProxy") || undefined;
    cfg.httpsPort = getPort("HTTPSPort");
  }
  if (isEnabled("SOCKSEnable")) {
    cfg.socksHost = getValue("SOCKSProxy") || undefined;
    cfg.socksPort = getPort("SOCKSPort");
    cfg.socksVersion = 5;
  }
  const exceptionsMatch = String(raw || "").match(
    /^\s*ExceptionsList\s*:\s*<array>\s*{([\s\S]*?)^\s*}/m,
  );
  if (exceptionsMatch) {
    const exceptions = exceptionsMatch[1]
      .split(/\r?\n/g)
      .map((line) => line.match(/^\s*\d+\s*:\s*(.+?)\s*$/)?.[1]?.trim() || "")
      .filter(Boolean);
    if (exceptions.length) {
      cfg.noProxy = exceptions.join(", ");
    }
  }

  return hasUsableSystemProxy(cfg) ? cfg : null;
}

async function readMacSystemProxyConfig(): Promise<SystemProxyConfig | null> {
  try {
    const result = await runShellCommand("scutil --proxy", { hidden: true });
    if (result.code !== 0) return null;
    return parseMacSystemProxy([result.stdout, result.stderr].join("\n"));
  } catch {
    return null;
  }
}

function readWindowsSystemProxyConfig(): SystemProxyConfig | null {
  const regKey = Cc["@mozilla.org/windows-registry-key;1"]?.createInstance(
    Ci.nsIWindowsRegKey,
  );
  if (!regKey) return null;

  try {
    regKey.open(
      regKey.ROOT_KEY_CURRENT_USER,
      "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
      regKey.ACCESS_READ,
    );
    let proxyServer = "";
    let bypass = "";
    try {
      const enabled = regKey.readIntValue("ProxyEnable");
      if (!enabled) return null;
      proxyServer = regKey.readStringValue("ProxyServer").trim();
      try {
        bypass = regKey.readStringValue("ProxyOverride").trim();
      } catch {
        bypass = "";
      }
    } finally {
      regKey.close();
    }

    if (!proxyServer) return null;

    const cfg: SystemProxyConfig = {};
    if (proxyServer.includes("=")) {
      for (const part of proxyServer.split(";")) {
        const [proto, hostPort] = part.split("=");
        const parsed = parseHostPort(hostPort || "");
        if (!proto || !parsed) continue;
        const normalized = proto.trim().toLowerCase();
        if (normalized === "http") {
          cfg.httpHost = parsed.host;
          cfg.httpPort = parsed.port;
        } else if (normalized === "https") {
          cfg.httpsHost = parsed.host;
          cfg.httpsPort = parsed.port;
        } else if (normalized === "socks") {
          cfg.socksHost = parsed.host;
          cfg.socksPort = parsed.port;
          cfg.socksVersion = 5;
        }
      }
    } else {
      const parsed = parseHostPort(proxyServer);
      if (!parsed) return null;
      cfg.httpHost = parsed.host;
      cfg.httpPort = parsed.port;
      cfg.httpsHost = parsed.host;
      cfg.httpsPort = parsed.port;
    }

    if (bypass) {
      cfg.noProxy = bypass
        .split(";")
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join(", ");
    }

    return hasUsableSystemProxy(cfg) ? cfg : null;
  } catch {
    return null;
  }
}

async function readLinuxSystemProxyConfig(): Promise<SystemProxyConfig | null> {
  const proxyUrl =
    getEnv("HTTPS_PROXY") ||
    getEnv("https_proxy") ||
    getEnv("HTTP_PROXY") ||
    getEnv("http_proxy") ||
    getEnv("ALL_PROXY") ||
    getEnv("all_proxy");
  const proxy = parseProxyUrl(proxyUrl);
  if (!proxy) return null;
  const noProxy = getEnv("NO_PROXY") || getEnv("no_proxy");
  if (noProxy) proxy.noProxy = normalizeNoProxy(noProxy);
  return hasUsableSystemProxy(proxy) ? proxy : null;
}

async function readSystemProxyConfig(): Promise<SystemProxyConfig | null> {
  const platform = currentPlatform();
  if (platform === "macos") return readMacSystemProxyConfig();
  if (platform === "windows") return readWindowsSystemProxyConfig();
  if (platform === "linux") return readLinuxSystemProxyConfig();
  return null;
}

/**
 * Detect the OS system proxy and ensure Zotero's Gecko engine uses it.
 * On Windows this reads Internet Settings from the registry; on macOS this
 * reads `scutil --proxy`. Linux and missing proxy settings are no-ops.
 *
 * Call this during plugin initialization or before any fetch() to chatgpt.com.
 */
export async function ensureZoteroProxyFromSystem(options?: {
  forceRefresh?: boolean;
}): Promise<void> {
  try {
    const prefSvc = Cc["@mozilla.org/preferences-service;1"]?.getService(
      Ci.nsIPrefBranch,
    );
    if (!prefSvc) return;

    const proxy = await readSystemProxyConfig();
    const proxyEnvUrl = proxy ? getProxyEnvUrl(proxy) : "";
    if (proxy && proxyEnvUrl) {
      setProxyEnv(proxyEnvUrl, proxy.noProxy);
      ztoolkit?.log?.(
        `AIdea: Detected ${currentPlatform()} system proxy: ${getSystemProxySignature(proxy)}`,
      );
    }
    if (proxy && applySystemProxyToZotero(proxy, options)) {
      ztoolkit?.log?.(
        `AIdea: Applied ${currentPlatform()} system proxy to Zotero`,
      );
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
      : {
          ok: false,
          message: `Path exists but is not a directory: ${normalized}`,
        };
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
    return {
      ok: false,
      message: `Failed to create directory ${normalized}: ${String(err)}`,
    };
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
    const env = Cc["@mozilla.org/process/environment;1"].getService(
      Ci.nsIEnvironment,
    ) as {
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
    const localAppData =
      getEnv("LOCALAPPDATA") || joinPath(home, "AppData", "Local");
    const programFiles = getEnv("ProgramFiles");
    const programFilesX86 = getEnv("ProgramFiles(x86)");
    return dedupePathEntries(
      [
        ...deriveCodexStandaloneBinDirs(platform, home, localAppData),
        joinPath(appData, "npm"),
        joinPath(localAppData, "Microsoft", "WindowsApps"),
        joinPath(localAppData, "Programs", "nodejs"),
        programFiles ? joinPath(programFiles, "nodejs") : "",
        programFilesX86 ? joinPath(programFilesX86, "nodejs") : "",
      ],
      platform,
    ).filter(isDirectoryPath);
  }

  if (platform === "macos") {
    return dedupePathEntries(
      [
        // Apple Silicon Homebrew defaults to /opt/homebrew. Keep it ahead of
        // legacy Intel /usr/local so a stale x64 node cannot win fallback lookup.
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        home ? joinPath(home, ".local", "bin") : "",
        home ? joinPath(home, ".npm-global", "bin") : "",
      ],
      platform,
    ).filter(isDirectoryPath);
  }

  return dedupePathEntries(
    [
      "/usr/local/bin",
      "/usr/bin",
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

function resolveExecutablePathInDirs(
  baseName: string,
  dirs: string[],
): string | null {
  const platform = currentPlatform();
  const trimmed = String(baseName || "").trim();
  if (!trimmed) return null;
  if (pathExists(trimmed)) {
    const directDir = initLocalFile(trimmed)?.parent?.path || "";
    if (directDir) prependProcessPathEntries([directDir]);
    return trimmed;
  }

  for (const dir of dedupePathEntries(dirs, platform)) {
    for (const fileName of getExecutableFileNames(trimmed, platform)) {
      const candidatePath = joinPath(dir, fileName);
      if (!pathExists(candidatePath)) continue;
      prependProcessPathEntries([dir]);
      return candidatePath;
    }
  }
  return null;
}

async function locateExecutableViaShell(
  baseName: string,
): Promise<string | null> {
  const platform = currentPlatform();
  const trimmed = String(baseName || "").trim();
  if (!trimmed) return null;

  const chooseCandidate = (rawOutput: string): string | null => {
    const candidates = rawOutput
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
        if (hit) {
          chosen = hit;
          break;
        }
      }
    }

    return chosen || null;
  };

  const runLocator = async (command: string): Promise<string | null> => {
    const result = await runShellCommand(command, { hidden: true });
    if (result.code !== 0) return null;

    const chosen = chooseCandidate(
      String([result.stdout, result.stderr].join("\n")),
    );
    if (!chosen) return null;
    const dir = initLocalFile(chosen)?.parent?.path || "";
    if (dir) prependProcessPathEntries([dir]);
    return chosen;
  };

  try {
    if (platform === "windows") {
      return await runLocator(`where.exe ${trimmed}`);
    }

    const unixLocator = `command -v ${escapeShellArg(trimmed)} 2>/dev/null || which ${escapeShellArg(trimmed)} 2>/dev/null`;
    const shellCandidates = dedupePathEntries(
      [getEnv("SHELL"), platform === "macos" ? "/bin/zsh" : "", "/bin/bash"],
      platform,
    ).filter((shellPath) => Boolean(shellPath) && pathExists(shellPath));

    for (const shellPath of shellCandidates) {
      const found = await runLocator(
        `${escapeShellArg(shellPath)} -lc ${escapeShellArg(unixLocator)}`,
      );
      if (found) return found;
    }

    return await runLocator(unixLocator);
  } catch {
    return null;
  }
}

function buildExecutableCommand(
  executablePath: string,
  args: string[] = [],
): string {
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
  const result = await runShellCommand(
    buildExecutableCommand(executablePath, args),
    {
      hidden: true,
    },
  );
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
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

export function buildWindowsUserPathPersistenceScript(binDir: string): string {
  const quotedDir = `'${String(binDir).replace(/'/g, "''")}'`;
  return [
    `$dir = ${quotedDir}`,
    "$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')",
    "if ($null -eq $userPath) { $userPath = '' }",
    "$parts = @($userPath -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ })",
    "if ($parts -contains $dir) {",
    "  'User PATH already contains npm bin dir'",
    "} else {",
    "  $next = @($parts + $dir) | Select-Object -Unique",
    "  [Environment]::SetEnvironmentVariable('Path', ($next -join ';'), 'User')",
    "  'Added npm bin dir to user PATH'",
    "}",
  ].join("\n");
}

async function persistBinDirToUserPath(binDir: string): Promise<string> {
  const normalized = String(binDir || "").trim();
  if (!normalized) return "Skipped PATH persistence: empty bin dir";

  const platform = currentPlatform();
  if (platform === "windows") {
    const script = buildWindowsUserPathPersistenceScript(normalized);
    const result = await runShellCommand(script, { hidden: true });
    return (
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
      "PATH persistence finished"
    );
  }

  const home = homeDir();
  if (!home) return "Skipped PATH persistence: home directory not found";
  const profileTargets =
    platform === "macos"
      ? [
          joinPath(home, ".zprofile"),
          joinPath(home, ".bash_profile"),
          joinPath(home, ".profile"),
        ]
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
  return (
    [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
    "Shell profile PATH updated"
  );
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
  const preferredBin = deriveNpmGlobalBinDirFromPrefix(
    preferredPrefix,
    platform,
  );
  if (preferredBin) {
    prependProcessPathEntries([preferredBin]);
  }

  const nodePath =
    (await locateExecutableViaShell("node")) || resolveExecutablePath("node");
  const npmPath =
    (await locateExecutableViaShell("npm")) || resolveExecutablePath("npm");

  let nodeVersion = "";
  let nodeArch = "";
  if (nodePath) {
    const nodeResult = await runExecutableCommand(nodePath, ["--version"]);
    nodeVersion = normalizeVersionText(nodeResult.output);
    const archResult = await runExecutableCommand(nodePath, [
      "-p",
      "process.arch",
    ]);
    nodeArch =
      String(archResult.output || "")
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .find(Boolean) || "";
  }

  let npmReportedVersion = "";
  let prefix = "";
  let globalRoot = "";
  if (npmPath) {
    const npmVersionResult = await runExecutableCommand(npmPath, ["--version"]);
    npmReportedVersion = normalizeVersionText(npmVersionResult.output);

    const prefixResult = await runExecutableCommand(npmPath, [
      "config",
      "get",
      "prefix",
    ]);
    prefix =
      String(prefixResult.output || "")
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .find(Boolean) || "";

    const rootResult = await runExecutableCommand(npmPath, ["root", "-g"]);
    globalRoot =
      String(rootResult.output || "")
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .find(Boolean) || "";
  }

  if (!globalRoot && prefix) {
    globalRoot = deriveNpmGlobalRootFromPrefix(prefix, platform);
  }
  if (!prefix && globalRoot) {
    const suffix =
      platform === "windows" ? "\\node_modules" : "/lib/node_modules";
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
    queryLatest && npmPath
      ? await queryRegistryPackageVersion(npmPath, "npm")
      : "";

  return {
    platform,
    nodePath,
    npmPath,
    nodeVersion,
    nodeArch,
    npmReportedVersion,
    npmPackageVersion,
    latestNpmVersion,
    prefix,
    globalRoot,
    globalBinDir,
  };
}

type ReportFn =
  | ((event: {
      phase: "start" | "done" | "info";
      step: string;
      ok?: boolean;
      output?: string;
    }) => void)
  | undefined;
type AppendFn = (title: string, text: string) => void;

const DEFAULT_NODE_RUNTIME_MAJOR = 22;

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
  if (ok) {
    prependProcessPathEntries(getCommonExecutableDirs("windows"));
  }
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

  const command = `NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`;
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

async function tryInstallCodexStandalone(
  report: ReportFn,
  append: AppendFn,
): Promise<boolean> {
  const platform = currentPlatform();
  const installStep = "Install Codex CLI (standalone)";
  const command = getCodexStandaloneInstallCommand(platform);
  report?.({ phase: "start", step: installStep });
  const result = await runShellCommand(command, { hidden: true });
  const output =
    [result.stdout, result.stderr].filter(Boolean).join("\n").trim() ||
    "(no output)";
  append(installStep, `${command}\n\n${output}`);
  report?.({
    phase: "done",
    step: installStep,
    ok: result.code === 0,
    output,
  });

  const standaloneDirs = getCodexStandaloneBinDirs(platform);
  prependProcessPathEntries(standaloneDirs);

  const spec = getProviderCliSpec("openai-codex");
  if (!spec) return false;
  const verifyStep = `Verify ${spec.executableName}`;
  report?.({ phase: "start", step: verifyStep });
  const verification = await verifyExecutableInDirs(
    spec.executableName,
    spec.versionArg,
    standaloneDirs,
  );
  append(
    verifyStep,
    [`path: ${verification.path || "-"}`, verification.output].join("\n"),
  );
  report?.({
    phase: "done",
    step: verifyStep,
    ok: verification.ok,
    output: verification.output,
  });
  return result.code === 0 && verification.ok;
}

export function buildNodeSourceAptInstallCommand(
  major = DEFAULT_NODE_RUNTIME_MAJOR,
): string {
  const setupPath = `/tmp/aidea-nodesource-setup_${major}.x.sh`;
  const setupUrl = `https://deb.nodesource.com/setup_${major}.x`;
  const rootCommand =
    "apt-get update && " +
    "apt-get install -y ca-certificates curl gnupg && " +
    `curl -fsSL ${setupUrl} -o ${setupPath} && ` +
    `bash ${setupPath} && ` +
    "apt-get install -y nodejs";
  const sudoCommand =
    "sudo -n apt-get update && " +
    "sudo -n apt-get install -y ca-certificates curl gnupg && " +
    `curl -fsSL ${setupUrl} -o ${setupPath} && ` +
    `sudo -n -E bash ${setupPath} && ` +
    "sudo -n apt-get install -y nodejs";
  return `if [ "$(id -u)" -eq 0 ]; then ${rootCommand}; else ${sudoCommand}; fi`;
}

export function buildNodeSourceAptManualInstructions(
  major = DEFAULT_NODE_RUNTIME_MAJOR,
): string {
  const setupPath = `/tmp/aidea-nodesource-setup_${major}.x.sh`;
  const setupUrl = `https://deb.nodesource.com/setup_${major}.x`;
  return [
    `curl -fsSL ${setupUrl} -o ${setupPath}`,
    `sudo -E bash ${setupPath}`,
    "sudo apt-get install -y nodejs",
    "node --version",
    "npm --version",
  ].join("\n");
}

async function tryInstallNodeRuntime(
  report: ReportFn,
  append: AppendFn,
  options: { preferredMajor?: number } = {},
): Promise<boolean> {
  const platform = currentPlatform();
  const plans: Array<{ step: string; command: string }> = [];
  const preferredMajor = options.preferredMajor || 0;

  if (platform === "windows") {
    const wingetPath =
      (await locateExecutableViaShell("winget")) ||
      resolveExecutablePath("winget");
    const chocoPath =
      (await locateExecutableViaShell("choco")) ||
      resolveExecutablePath("choco");
    const scoopPath =
      (await locateExecutableViaShell("scoop")) ||
      resolveExecutablePath("scoop");
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
      (await locateExecutableViaShell("apt-get")) ||
      resolveExecutablePath("apt-get");
    const dnfPath =
      (await locateExecutableViaShell("dnf")) || resolveExecutablePath("dnf");
    const yumPath =
      (await locateExecutableViaShell("yum")) || resolveExecutablePath("yum");
    const pacmanPath =
      (await locateExecutableViaShell("pacman")) ||
      resolveExecutablePath("pacman");
    if (aptPath && preferredMajor > 0) {
      plans.push({
        step: `Install Node.js ${preferredMajor} via NodeSource`,
        command: buildNodeSourceAptInstallCommand(preferredMajor),
      });
    }
    if (aptPath) {
      plans.push({
        step: "Install Node.js/npm via apt-get",
        command:
          'if [ "$(id -u)" -eq 0 ]; then apt-get update && apt-get install -y nodejs npm; ' +
          "else sudo -n apt-get update && sudo -n apt-get install -y nodejs npm; fi",
      });
    }
    if (dnfPath) {
      plans.push({
        step: "Install Node.js/npm via dnf",
        command:
          'if [ "$(id -u)" -eq 0 ]; then dnf install -y nodejs npm; ' +
          "else sudo -n dnf install -y nodejs npm; fi",
      });
    }
    if (yumPath) {
      plans.push({
        step: "Install Node.js/npm via yum",
        command:
          'if [ "$(id -u)" -eq 0 ]; then yum install -y nodejs npm; ' +
          "else sudo -n yum install -y nodejs npm; fi",
      });
    }
    if (pacmanPath) {
      plans.push({
        step: "Install Node.js/npm via pacman",
        command:
          'if [ "$(id -u)" -eq 0 ]; then pacman -Sy --noconfirm nodejs npm; ' +
          "else sudo -n pacman -Sy --noconfirm nodejs npm; fi",
      });
    }
  }

  if (!plans.length) {
    let bootstrappedManager = false;
    // No package manager found — try to bootstrap one, then rebuild plans.
    report?.({
      phase: "info",
      step: "No package manager found",
      output: `No supported package manager detected on ${platform}. Attempting to install one automatically…`,
    });

    if (platform === "windows") {
      const ok = await tryInstallWinget(report, append);
      if (ok) {
        bootstrappedManager = true;
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
        bootstrappedManager = true;
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
          ? bootstrappedManager
            ? "winget was installed but is not visible in this Zotero session yet. Restart Zotero or install Node.js manually from https://nodejs.org, then retry."
            : "winget (built into Windows 10/11) could not be installed. Please install Node.js manually from https://nodejs.org or install winget/choco/scoop first."
          : platform === "macos"
            ? bootstrappedManager
              ? "Homebrew was installed but is not visible in this Zotero session yet. Restart Zotero or install Node.js manually, then retry."
              : "Homebrew could not be installed automatically. Please install it from https://brew.sh or install Node.js manually."
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

async function verifyExecutableInDirs(
  executableName: string,
  versionArg: string,
  dirs: string[],
): Promise<{
  ok: boolean;
  path: string;
  output: string;
}> {
  const located = resolveExecutablePathInDirs(executableName, dirs) || "";
  if (!located) {
    return {
      ok: false,
      path: "",
      output: `${executableName} was not found in the standalone install directory`,
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
    const text =
      typeof Zotero?.File?.getContentsAsync === "function"
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

  if (provider === "github-copilot") return "GitHub Copilot";
  return provider;
}

async function resolveProviderCliExecutablePath(
  provider: OAuthProviderId,
  spec = getProviderCliSpec(provider),
): Promise<string | null> {
  if (!spec) return null;
  if (provider === "openai-codex") {
    return resolveExecutablePathInDirs(
      spec.executableName,
      getCodexStandaloneBinDirs(),
    );
  }
  return (
    (await locateExecutableViaShell(spec.executableName)) ||
    resolveExecutablePath(spec.executableName)
  );
}

export async function readCodexOAuthCredential(): Promise<OAuthCredential | null> {
  const home = homeDir();
  if (!home) return null;
  const authPath = joinPath(home, ".codex", "auth.json");
  const data = await readJsonFile(authPath);
  const tokens =
    data?.tokens && typeof data.tokens === "object" ? data.tokens : null;
  const accessToken =
    typeof tokens?.access_token === "string" ? tokens.access_token.trim() : "";
  const refreshToken =
    typeof tokens?.refresh_token === "string"
      ? tokens.refresh_token.trim()
      : "";
  if (!accessToken) return null;
  const cred: OAuthCredential = {
    provider: "openai-codex",
    accessToken,
    refreshToken: refreshToken || undefined,
    accountId:
      typeof tokens?.account_id === "string" ? tokens.account_id : undefined,
    sourcePath: authPath,
  };
  return cred;
}

async function refreshCodexOAuthCredentialViaCli(): Promise<OAuthCredential | null> {
  const spec = getProviderCliSpec("openai-codex");
  if (!spec) return null;
  const cliPath = await resolveProviderCliExecutablePath("openai-codex", spec);
  if (!cliPath) return null;
  try {
    const result = await runShellCommand(
      buildExecutableCommand(cliPath, ["login", "status"]),
      { hidden: true },
    );
    if (result.code !== 0) {
      ztoolkit?.log?.(
        "AIdea: Codex login status failed while refreshing OAuth credential",
        [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
      );
      return null;
    }
    return readCodexOAuthCredential();
  } catch (err) {
    ztoolkit?.log?.("AIdea: Codex credential refresh via CLI failed", err);
    return null;
  }
}

/**
 * Refresh the Gemini OAuth access token using the stored refresh token.
 * Returns a fresh credential or null if refresh is impossible.
 *
 * The access token from Google OAuth has a ~1 hour lifetime.  Without
 * this refresh, every chat request after the first hour fails with 401.
 */
async function refreshGeminiAccessToken(
  cred: OAuthCredential,
): Promise<OAuthCredential | null> {
  if (!cred.refreshToken) return null;
  try {
    const clientCreds = await extractGeminiCliCredentials();
    if (!clientCreds) {
      ztoolkit?.log?.(
        "AIdea: Cannot refresh Gemini token — no client credentials",
      );
      return null;
    }
    ztoolkit?.log?.("AIdea: Refreshing Gemini OAuth access token...");
    const body = new URLSearchParams({
      client_id: clientCreds.clientId,
      client_secret: clientCreds.clientSecret,
      refresh_token: cred.refreshToken,
      grant_type: "refresh_token",
    });
    const res = await getFetch()("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "*/*",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      ztoolkit?.log?.(
        "AIdea: Gemini token refresh failed:",
        res.status,
        errText.slice(0, 200),
      );
      return null;
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };
    const newAccessToken = data.access_token?.trim();
    if (!newAccessToken) {
      ztoolkit?.log?.("AIdea: Gemini token refresh returned no access_token");
      return null;
    }
    const newExpiresAt =
      Date.now() + (data.expires_in || 3600) * 1000 - 5 * 60 * 1000;
    // A refresh response may include a rotated refresh_token
    const newRefreshToken = data.refresh_token?.trim() || cred.refreshToken;

    // Persist to Zotero prefs
    setOAuthPref("geminiOAuthAccessToken", newAccessToken);
    setOAuthPref("geminiOAuthExpiresAt", String(newExpiresAt));
    if (newRefreshToken !== cred.refreshToken) {
      setOAuthPref("geminiOAuthRefreshToken", newRefreshToken);
    }

    // Also update the file-based credential if it exists
    if (cred.sourcePath) {
      try {
        const existing = await readJsonFile(cred.sourcePath);
        if (existing && typeof existing === "object") {
          existing.access_token = newAccessToken;
          if (data.expires_in) {
            existing.expiry_date = newExpiresAt;
          }
          if (data.refresh_token) {
            existing.refresh_token = newRefreshToken;
          }
          const raw = JSON.stringify(existing, null, 2);
          const io = (globalThis as any).IOUtils;
          if (io?.writeUTF8) {
            await io.writeUTF8(cred.sourcePath, raw);
          }
        }
      } catch {
        // Best-effort file update; prefs are the authoritative store
      }
    }

    ztoolkit?.log?.("AIdea: Gemini access token refreshed successfully");
    return {
      ...cred,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: newExpiresAt,
    };
  } catch (err) {
    ztoolkit?.log?.("AIdea: Gemini token refresh exception:", err);
    return null;
  }
}

/** Check if a Gemini credential's access token is expired or about to expire. */
function isGeminiTokenExpired(cred: OAuthCredential): boolean {
  if (!cred.expiresAt) return false; // Unknown expiry — assume valid
  // Consider expired if within 2 minutes of expiry
  return Date.now() >= cred.expiresAt - 2 * 60 * 1000;
}

export async function readGeminiOAuthCredential(): Promise<OAuthCredential | null> {
  // 1. Check Zotero Prefs first (from in-plugin OAuth flow)
  const prefsToken = getOAuthPref("geminiOAuthAccessToken");
  if (prefsToken) {
    const refreshToken = getOAuthPref("geminiOAuthRefreshToken") || undefined;
    const expiresAt =
      Number(getOAuthPref("geminiOAuthExpiresAt") || "0") || undefined;
    const projectId = getOAuthPref("geminiOAuthProjectId") || undefined;
    let cred: OAuthCredential = {
      provider: "google-gemini-cli",
      accessToken: prefsToken,
      refreshToken,
      expiresAt,
      projectId,
    };
    // Auto-refresh if token is expired
    if (isGeminiTokenExpired(cred) && refreshToken) {
      const refreshed = await refreshGeminiAccessToken(cred);
      if (refreshed) cred = refreshed;
    }
    return cred;
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
    (typeof data.refresh_token === "string" && data.refresh_token.trim()) ||
    undefined;
  const expiryRaw = data.expiry_date ?? data.expires_at ?? data.expires;
  const expiresAt =
    typeof expiryRaw === "number" && Number.isFinite(expiryRaw)
      ? Number(expiryRaw)
      : undefined;
  let projectId =
    (typeof data.project_id === "string" && data.project_id.trim()) ||
    (typeof data.projectId === "string" && data.projectId.trim()) ||
    undefined;
  // Also check Zotero prefs — an earlier lazy discovery may have cached the
  // project ID even though the credential file doesn't contain it.
  if (!projectId) {
    const cachedProject = getOAuthPref("geminiOAuthProjectId");
    if (cachedProject) projectId = cachedProject;
  }
  let cred: OAuthCredential = {
    provider: "google-gemini-cli",
    accessToken,
    refreshToken,
    expiresAt,
    projectId,
    sourcePath: credPath,
  };
  // Auto-refresh if token is expired
  if (isGeminiTokenExpired(cred) && refreshToken) {
    const refreshed = await refreshGeminiAccessToken(cred);
    if (refreshed) cred = refreshed;
  }
  return cred;
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
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const arr = new Uint8Array(64);
  if ((globalThis as any).crypto?.getRandomValues) {
    (globalThis as any).crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++)
      arr[i] = Math.floor(Math.random() * 256);
  }
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
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  // Fallback: plain verifier (some OAuth servers accept S256 only, but try)
  throw new Error("SubtleCrypto not available for PKCE");
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
function getCopilotApiTokenCache(): {
  token: string;
  expiresAt: number;
} | null {
  const raw = getOAuthPref("oauthCopilotApiToken");
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data.token === "string" && typeof data.expiresAt === "number")
      return data;
    return null;
  } catch {
    return null;
  }
}

const COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
const DEFAULT_COPILOT_API_BASE = "https://api.individual.githubcopilot.com";

// IDE headers matching OpenClaw's copilot-dynamic-headers.ts to ensure Copilot
// accepts all model families (Claude, GPT, Gemini, etc.).
const COPILOT_EDITOR_VERSION = "vscode/1.96.2";
const COPILOT_USER_AGENT = "GitHubCopilotChat/0.26.7";
const COPILOT_GITHUB_API_VERSION = "2025-04-01";

/** Build the set of headers that identify this client as a VSCode Copilot Chat session. */
function buildCopilotIdeHeaders(opts?: {
  includeApiVersion?: boolean;
}): Record<string, string> {
  return {
    "Editor-Version": COPILOT_EDITOR_VERSION,
    "User-Agent": COPILOT_USER_AGENT,
    ...(opts?.includeApiVersion
      ? { "X-Github-Api-Version": COPILOT_GITHUB_API_VERSION }
      : {}),
  };
}

/** Build dynamic per-request headers for Copilot chat/completions calls. */
function buildCopilotDynamicHeaders(): Record<string, string> {
  return {
    ...buildCopilotIdeHeaders(),
    "Copilot-Integration-Id": "vscode-chat",
    "Openai-Intent": "conversation-edits",
  };
}

/** Check if a model ID belongs to the Claude / Anthropic family. */
function isCopilotClaudeModel(modelId: string): boolean {
  return /^claude-/i.test(modelId.trim());
}

// Observed in live Copilot probes on 2026-04-16: these model ids appear in the
// catalog but currently return `model_not_supported` for actual inference calls.
const COPILOT_SUPPRESSED_MODEL_IDS = new Set([
  "claude-opus-4.5",
  "claude-sonnet-4",
  "claude-sonnet-4.5",
  "gpt-41-copilot",
]);

type OAuthParameterSource =
  "explicit-task" | "omitted-provider-default" | "provider-required-fallback";

function getPayloadTokenParam(payload: Record<string, unknown>):
  | {
      field: string;
      value: unknown;
    }
  | undefined {
  for (const field of [
    "max_tokens",
    "max_completion_tokens",
    "max_output_tokens",
  ]) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      return { field, value: payload[field] };
    }
  }
  return undefined;
}

function logOAuthRequestParameterPolicy(params: {
  provider: OAuthProviderId;
  model: string;
  endpointType: string;
  payload: Record<string, unknown>;
  parameterSource: OAuthParameterSource;
  temperatureSent?: boolean;
  tokenParam?: { field: string; value: unknown };
}) {
  const tokenParam = params.tokenParam || getPayloadTokenParam(params.payload);
  ztoolkit?.log?.("AIdea: LLM request parameters", {
    provider: params.provider,
    model: params.model,
    endpointType: params.endpointType,
    temperatureSent:
      params.temperatureSent ??
      Object.prototype.hasOwnProperty.call(params.payload, "temperature"),
    tokenField: tokenParam?.field || null,
    tokenValue: tokenParam?.value ?? null,
    parameterSource: params.parameterSource,
  });
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getOAuthOptionalParameterSource(params: {
  temperature?: number;
  maxTokens?: number;
}): OAuthParameterSource {
  return hasFiniteNumber(params.temperature) ||
    hasFiniteNumber(params.maxTokens)
    ? "explicit-task"
    : "omitted-provider-default";
}

async function postCopilotRequest(params: {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<Response> {
  const res = await fetchWithTransientRetry(
    getFetch(),
    params.url,
    {
      method: "POST",
      headers: params.headers,
      body: JSON.stringify(params.payload),
      signal: params.signal,
    },
    {
      signal: params.signal,
      onRetry: ({ attempt, maxAttempts, error }) => {
        ztoolkit?.log?.(
          `AIdea: Copilot transient upstream error, retry ${attempt}/${maxAttempts - 1}`,
          error,
        );
      },
    },
  );
  if (res.ok) return res;
  const errText = await res.text();
  throw new Error(`Copilot OAuth HTTP ${res.status}: ${errText}`);
}

function shouldSendCopilotTemperature(_model: string): boolean {
  return false;
}

async function postCopilotWithTemperatureFallback(params: {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<Response> {
  return postCopilotRequest(params);
}

function applyCopilotTemperatureIfSupported(
  payload: Record<string, unknown>,
  model: string,
  temperature: number | undefined,
) {
  if (
    shouldSendCopilotTemperature(model) &&
    typeof temperature === "number" &&
    Number.isFinite(temperature)
  ) {
    payload.temperature = temperature;
  }
}

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
  const res = await fetchWithTransientRetry(
    getFetch(),
    COPILOT_TOKEN_URL,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${githubToken}`,
        ...buildCopilotIdeHeaders({ includeApiVersion: true }),
      },
    },
    {
      onRetry: ({ attempt, maxAttempts, error }) => {
        ztoolkit?.log?.(
          `AIdea: Copilot token exchange transient error, retry ${attempt}/${maxAttempts - 1}`,
          error,
        );
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Copilot token exchange failed: HTTP ${res.status}`);
  }
  const json = (await res.json()) as unknown as Record<string, unknown>;
  const token = typeof json.token === "string" ? json.token : "";
  if (!token) throw new Error("Copilot token response missing token");
  const expiresAtRaw = json.expires_at;
  let expiresAt: number;
  if (typeof expiresAtRaw === "number" && Number.isFinite(expiresAtRaw)) {
    expiresAt =
      expiresAtRaw > 10_000_000_000 ? expiresAtRaw : expiresAtRaw * 1000;
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
    return {
      token: cached.token,
      baseUrl: deriveCopilotApiBaseUrl(cached.token),
    };
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

export function parseCopilotModelsResponse(
  data: unknown,
): ProviderModelOption[] {
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
        const supportedEndpoints = Array.isArray(row?.supported_endpoints)
          ? row.supported_endpoints
              .filter(
                (value: unknown): value is string => typeof value === "string",
              )
              .map((value: string) => value.trim())
              .filter(Boolean)
          : undefined;
        const policyState =
          row?.policy?.state === "enabled" || row?.policy?.state === "disabled"
            ? row.policy.state
            : undefined;
        const modelPickerEnabled =
          typeof row?.model_picker_enabled === "boolean"
            ? row.model_picker_enabled
            : true;
        const isAliasOnly =
          /-copilot$/i.test(id) &&
          (!supportedEndpoints || supportedEndpoints.length === 0);
        return {
          id,
          label,
          supportedEndpoints,
          policyState,
          modelPickerEnabled,
          isAliasOnly,
        };
      })
      .filter(
        (row: ProviderModelOption & { modelPickerEnabled?: boolean }) =>
          row.id &&
          row.modelPickerEnabled !== false &&
          row.policyState !== "disabled" &&
          !COPILOT_SUPPRESSED_MODEL_IDS.has(row.id) &&
          !(row as ProviderModelOption & { isAliasOnly?: boolean }).isAliasOnly,
      ),
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
      ...buildCopilotDynamicHeaders(),
    },
  });
  if (!modelsRes.ok) {
    throw new Error(`Copilot models HTTP ${modelsRes.status}`);
  }

  const modelsData = (await modelsRes.json()) as unknown;
  return parseCopilotModelsResponse(modelsData);
}

function getCachedProviderModelOptions(
  provider: OAuthProviderId,
): ProviderModelOption[] {
  const raw = getOAuthPref("oauthModelListCache").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<OAuthProviderId, ProviderModelOption[]>
    >;
    return Array.isArray(parsed?.[provider]) ? parsed[provider] || [] : [];
  } catch {
    return [];
  }
}

function getCachedCopilotModelOption(
  modelId: string,
): ProviderModelOption | null {
  const normalized = String(modelId || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return (
    getCachedProviderModelOptions("github-copilot").find(
      (row) =>
        String(row.id || "")
          .trim()
          .toLowerCase() === normalized,
    ) || null
  );
}

type CopilotTransportKind =
  "anthropic-messages" | "responses" | "chat-completions";

function resolveCopilotTransportKind(modelId: string): CopilotTransportKind {
  if (isCopilotClaudeModel(modelId)) {
    return "anthropic-messages";
  }

  const cached = getCachedCopilotModelOption(modelId);
  const supported = new Set(
    (cached?.supportedEndpoints || []).map((value) =>
      value.trim().toLowerCase(),
    ),
  );
  if (supported.has("/responses")) {
    return "responses";
  }
  if (supported.has("/chat/completions")) {
    return "chat-completions";
  }

  const normalized = String(modelId || "")
    .trim()
    .toLowerCase();
  if (
    normalized.startsWith("gemini-") ||
    normalized.startsWith("grok-") ||
    normalized.startsWith("gpt-4") ||
    normalized.startsWith("gpt-3.5")
  ) {
    return "chat-completions";
  }

  return "responses";
}

export async function readProviderOAuthCredential(
  provider: OAuthProviderId,
): Promise<OAuthCredential | null> {
  if (provider === "openai-codex") return readCodexOAuthCredential();
  if (provider === "google-gemini-cli") return readGeminiOAuthCredential();

  if (provider === "github-copilot") return readCopilotOAuthCredential();
  return null;
}

export async function getAuthorizedOAuthCliProviders(): Promise<
  OAuthProviderId[]
> {
  const out: OAuthProviderId[] = [];
  for (const provider of getOAuthCliProviders()) {
    const cred = await readProviderOAuthCredential(provider);
    if (cred?.accessToken) out.push(provider);
  }
  return out;
}

export async function checkOAuthCliEnvironmentUpdates(
  providers: OAuthProviderId[],
): Promise<OAuthCliEnvironmentUpdateCheck[]> {
  const results: OAuthCliEnvironmentUpdateCheck[] = [];
  const targetProviders = providers.filter((provider) =>
    Boolean(getProviderCliSpec(provider)),
  );
  if (!targetProviders.length) return results;

  const needsNpm = targetProviders.some(
    (provider) => provider !== "openai-codex",
  );
  const npmState = needsNpm ? await inspectNpmEnvironment(true) : null;
  for (const provider of targetProviders) {
    const spec = getProviderCliSpec(provider);
    if (!spec) continue;

    const baseResult: OAuthCliEnvironmentUpdateCheck = {
      provider,
      needsUpdate: false,
      reason: "current",
    };

    if (provider === "openai-codex") {
      const verification = await verifyExecutableInDirs(
        spec.executableName,
        spec.versionArg,
        getCodexStandaloneBinDirs(),
      );
      if (!verification.ok) {
        results.push({
          ...baseResult,
          needsUpdate: true,
          reason: `${spec.executableName} verification failed`,
        });
        continue;
      }
      baseResult.installedVersion =
        normalizeVersionText(verification.output) || undefined;
      results.push(baseResult);
      continue;
    }

    if (!npmState?.nodePath || !npmState.npmPath) {
      results.push({
        ...baseResult,
        needsUpdate: true,
        reason: "node/npm not installed",
      });
      continue;
    }

    if (!isNodeVersionSupportedByCliSpec(npmState.nodeVersion, spec)) {
      results.push({
        ...baseResult,
        needsUpdate: true,
        reason: `${spec.packageName} requires ${spec.minNodeVersionLabel || "a newer Node.js"}`,
      });
      continue;
    }

    const installedVersion = npmState.globalRoot
      ? await readGlobalPackageVersion(npmState.globalRoot, spec.packageName)
      : "";
    const latestVersion = await queryRegistryPackageVersion(
      npmState.npmPath,
      spec.packageName,
    );
    baseResult.installedVersion = installedVersion || undefined;
    baseResult.latestVersion = latestVersion || undefined;

    if (!installedVersion) {
      results.push({
        ...baseResult,
        needsUpdate: true,
        reason: `${spec.packageName} is not installed`,
      });
      continue;
    }

    if (
      latestVersion &&
      shouldInstallLatestPackageVersion(installedVersion, latestVersion)
    ) {
      results.push({
        ...baseResult,
        needsUpdate: true,
        reason: `${spec.packageName} ${latestVersion} is available`,
      });
      continue;
    }

    const verification = await verifyExecutable(
      spec.executableName,
      spec.versionArg,
      [npmState.globalBinDir, ...getCommonExecutableDirs(npmState.platform)],
    );
    if (!verification.ok) {
      results.push({
        ...baseResult,
        needsUpdate: true,
        reason: looksLikeMissingOptionalDependency(verification.output)
          ? "platform package is missing"
          : `${spec.executableName} verification failed`,
      });
      continue;
    }

    results.push(baseResult);
  }

  return results;
}

const CODEX_OAUTH_USER_AGENT = "codex_cli_rs/0.0.0 (AIdea)";

function getCodexAccountIdFromAccessToken(accessToken: string): string {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return "";
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const claims = JSON.parse(globalThis.atob(padded)) as {
      "https://api.openai.com/auth"?: {
        chatgpt_account_id?: unknown;
      };
    };
    const accountId = claims["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof accountId === "string" ? accountId.trim() : "";
  } catch {
    return "";
  }
}

export function buildCodexOAuthHeaders(
  cred: Pick<OAuthCredential, "accessToken" | "accountId">,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cred.accessToken}`,
    // Match the first-party Codex CLI identity. The Codex backend uses this
    // client identity when routing newly released subscription models.
    "User-Agent": CODEX_OAUTH_USER_AGENT,
    originator: "codex_cli_rs",
  };
  const accountId =
    cred.accountId?.trim() ||
    getCodexAccountIdFromAccessToken(cred.accessToken);
  if (accountId) {
    headers["ChatGPT-Account-ID"] = accountId;
  }
  return headers;
}

function ensureProviderAuthHeaderInit(
  cred: OAuthCredential,
): Record<string, string> {
  if (cred.provider === "openai-codex") {
    return buildCodexOAuthHeaders(cred);
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cred.accessToken}`,
  };
  if (cred.provider === "google-gemini-cli" && cred.projectId) {
    headers["x-goog-user-project"] = cred.projectId;
  }
  if (cred.provider === "github-copilot") {
    Object.assign(headers, buildCopilotDynamicHeaders());
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
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex (Latest)" },
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
  { id: "gpt-5.1-codex-max", label: "GPT-5.1 Codex Max" },
  { id: "gpt-5.1-codex-mini", label: "GPT-5.1 Codex Mini" },
];

/**
 * Known Gemini CLI models (static fallback when the dynamic discovery
 * API call fails or returns nothing).
 */
const GEMINI_CLI_KNOWN_MODELS: ProviderModelOption[] = [
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
];

/**
 * Known GitHub Copilot models.
 */
const COPILOT_KNOWN_MODELS: ProviderModelOption[] = [
  { id: "claude-opus-4", label: "Claude Opus 4" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { id: "o3-mini", label: "o3 Mini" },
  { id: "o4-mini", label: "o4 Mini" },
];

export async function fetchAvailableModels(
  provider: OAuthProviderId,
): Promise<ProviderModelOption[]> {
  await ensureZoteroProxyFromSystem({ forceRefresh: true });
  const cred = await readProviderOAuthCredential(provider);
  if (!cred) {
    return [];
  }
  try {
    if (provider === "openai-codex") {
      let activeCred = cred;
      let triedCliRefresh = false;

      const buildHeaders = (
        credential: OAuthCredential,
      ): Record<string, string> => {
        return {
          ...ensureProviderAuthHeaderInit(credential),
          Accept: "application/json",
        };
      };

      const fetchDynamicModels = async (
        headers: Record<string, string>,
      ): Promise<ProviderModelOption[]> => {
        const res = await getFetch()(
          "https://chatgpt.com/backend-api/codex/models?client_version=1.0.0",
          {
            method: "GET",
            headers,
          },
        );
        if (res.ok) {
          const data = (await res.json()) as
            | { models?: Array<{ id?: string; name?: string }> }
            | Array<{ id?: string; name?: string }>;
          const models = Array.isArray(data)
            ? data
            : (data as any).models || [];
          if (Array.isArray(models) && models.length > 0) {
            const rows: ProviderModelOption[] = models
              .map((m: any) => {
                const id = String(m.id || m.slug || m.model_id || "").trim();
                const label = String(m.name || m.title || id).trim() || id;
                return { id, label };
              })
              .filter((m: ProviderModelOption) => m.id);
            if (rows.length > 0) {
              ztoolkit?.log?.(
                `AIdea: Codex dynamic models: ${rows.map((r) => r.id).join(", ")}`,
              );
              return rows;
            }
          }
        }
        return [];
      };

      const validateToken = async (
        headers: Record<string, string>,
      ): Promise<boolean> => {
        const usageRes = await getFetch()(
          "https://chatgpt.com/backend-api/wham/usage",
          {
            method: "GET",
            headers,
          },
        );
        return usageRes.status !== 401 && usageRes.status !== 403;
      };

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const headers = buildHeaders(activeCred);
        try {
          const rows = await fetchDynamicModels(headers);
          if (rows.length > 0) {
            return dedupeModels(rows);
          }
        } catch (err) {
          ztoolkit?.log?.("AIdea: Codex dynamic model fetch failed", err);
        }

        try {
          if (await validateToken(headers)) {
            return [...CODEX_KNOWN_MODELS];
          }
        } catch (err) {
          ztoolkit?.log?.("AIdea: Codex token validation failed", err);
        }

        if (!triedCliRefresh) {
          triedCliRefresh = true;
          const refreshed = await refreshCodexOAuthCredentialViaCli();
          if (refreshed?.accessToken) {
            activeCred = refreshed;
            continue;
          }
        }

        ztoolkit?.log?.(
          "AIdea: Codex OAuth credential could not be validated; model list unavailable",
        );
        return [];
      }
      return [];
    }

    if (provider === "github-copilot") {
      try {
        const models = await fetchCopilotAvailableModels();
        if (models.length > 0) {
          ztoolkit?.log?.(
            `AIdea: Copilot dynamic models: ${models.map((r) => r.id).join(", ")}`,
          );
          return models;
        }
      } catch (err) {
        ztoolkit?.log?.(
          "AIdea: Copilot dynamic model fetch failed, using static list",
          err,
        );
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
    const option: ProviderModelOption = {
      id,
      label: String(row.label || id).trim() || id,
    };
    if (row.apiBase !== undefined) option.apiBase = row.apiBase;
    if (row.apiKey !== undefined) option.apiKey = row.apiKey;
    if (Array.isArray(row.supportedEndpoints)) {
      option.supportedEndpoints = [...row.supportedEndpoints];
    }
    if (row.policyState !== undefined) option.policyState = row.policyState;
    if (row.status !== undefined) option.status = row.status;
    out.push(option);
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
  const base = String(apiBase || "")
    .trim()
    .replace(/\/+$/, "");
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
      if (
        json &&
        typeof json === "object" &&
        "data" in json &&
        Array.isArray((json as any).data)
      ) {
        return (json as any).data as any[];
      }
      if (Array.isArray(json)) return json;
      // Ollama /v1/models wraps in { models: [...] }
      if (
        json &&
        typeof json === "object" &&
        "models" in json &&
        Array.isArray((json as any).models)
      ) {
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
        `AIdea: Custom endpoint models (${rows.length}): ${rows
          .slice(0, 10)
          .map((r) => r.id)
          .join(", ")}${rows.length > 10 ? "..." : ""}`,
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
const GEMINI_CODE_ASSIST_API_BASE =
  "https://cloudcode-pa.googleapis.com/v1internal";
export const GEMINI_CODE_ASSIST_STREAM_URL = `${GEMINI_CODE_ASSIST_API_BASE}:streamGenerateContent?alt=sse`;

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

    const prefixResult = await runExecutableCommand(npmPath, [
      "config",
      "get",
      "prefix",
    ]);
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
    roots.add("/opt/homebrew/lib/node_modules");
    roots.add("/usr/local/lib/node_modules");
    if (home) {
      roots.add(joinPath(home, ".npm-global", "lib", "node_modules"));
    }
  }

  return Array.from(roots).filter(Boolean);
}

async function extractGeminiCliCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
} | null> {
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
        joinPath(
          root,
          "@google",
          "gemini-cli",
          "node_modules",
          "@google",
          "gemini-cli-core",
          "dist",
          "src",
          "code_assist",
          "oauth2.js",
        ),
      );
      // 2. Hoisted layout (npm v7+ default):
      //    <root>/@google/gemini-cli-core/dist/src/code_assist/oauth2.js
      candidates.push(
        joinPath(
          root,
          "@google",
          "gemini-cli-core",
          "dist",
          "src",
          "code_assist",
          "oauth2.js",
        ),
      );
      // 3. Alternative path (newer Gemini CLI versions):
      //    <root>/@google/gemini-cli-core/dist/src/agents/auth-provider/oauth2-provider.js
      candidates.push(
        joinPath(
          root,
          "@google",
          "gemini-cli",
          "node_modules",
          "@google",
          "gemini-cli-core",
          "dist",
          "src",
          "agents",
          "auth-provider",
          "oauth2-provider.js",
        ),
      );
      candidates.push(
        joinPath(
          root,
          "@google",
          "gemini-cli-core",
          "dist",
          "src",
          "agents",
          "auth-provider",
          "oauth2-provider.js",
        ),
      );
    }

    let content: string | null = null;
    for (const p of candidates) {
      try {
        const c = String(Zotero.File.getContents(p) || "");
        if (c) {
          content = c;
          break;
        }
      } catch {
        /* try next */
      }
    }

    if (content) {
      const idMatch = content.match(
        /(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/,
      );
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
      (await locateExecutableViaShell("gemini")) ||
      resolveExecutablePath("gemini");
    if (geminiPath) {
      ztoolkit?.log?.(
        "AIdea: Gemini CLI found at",
        geminiPath,
        "— using bundled-CLI fallback credentials",
      );
      return {
        clientId:
          "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
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
  const verifier = Array.from(array, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  try {
    const hasher = Cc["@mozilla.org/security/hash;1"].createInstance(
      Ci.nsICryptoHash,
    );
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    hasher.init(hasher.SHA256);
    hasher.update(data, data.length);
    const hash = hasher.finish(false);
    const challenge = btoa(hash)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return { verifier, challenge };
  } catch {
    return { verifier, challenge: verifier };
  }
}

async function loginGeminiInPlugin(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const creds = await extractGeminiCliCredentials();
    if (!creds) {
      return {
        ok: false,
        message:
          "Gemini CLI not found. Install it first: npm install -g @google/gemini-cli",
      };
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
    const tempDir =
      Zotero.getTempDirectory?.()?.path || Zotero.DataDirectory?.dir || ".";
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
      const scriptFile = Cc["@mozilla.org/file/local;1"].createInstance(
        Ci.nsIFile,
      );
      scriptFile.initWithPath(serverScriptPath);
      await Zotero.File.putContentsAsync(serverScriptPath, serverScript);
    } catch (err) {
      return {
        ok: false,
        message: `Failed to write callback server script: ${err}`,
      };
    }

    // Start the Node.js server in the background (hidden)
    const nodePath =
      (await locateExecutableViaShell("node")) || resolveExecutablePath("node");
    if (!nodePath) {
      return {
        ok: false,
        message: "Node.js not found. Install/Update Env first.",
      };
    }
    const nodeCmd = buildExecutableCommand(nodePath, [serverScriptPath]);
    const serverProcess = runShellCommand(nodeCmd, { hidden: true });

    // Give the server a moment to start
    await new Promise((r) => setTimeout(r, 1000));

    // Open browser
    try {
      (Zotero as any).launchURL(authUrl);
    } catch {
      /* */
    }

    // Poll for the result file
    const deadline = Date.now() + 120_000;
    let code = "";
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const content = String(Zotero.File.getContents(resultFilePath) || "");
        if (content) {
          const result = JSON.parse(content) as {
            code?: string;
            error?: string;
          };
          if (result.error) {
            return {
              ok: false,
              message: `Google OAuth error: ${result.error}`,
            };
          }
          if (result.code) {
            code = result.code;
            break;
          }
        }
      } catch {
        /* file not yet written */
      }
    }

    // Clean up temp files
    try {
      const f1 = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      f1.initWithPath(serverScriptPath);
      if (f1.exists()) f1.remove(false);
    } catch {
      /* */
    }
    try {
      const f2 = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      f2.initWithPath(resultFilePath);
      if (f2.exists()) f2.remove(false);
    } catch {
      /* */
    }

    // Wait for the server process to finish
    try {
      await serverProcess;
    } catch {
      /* */
    }

    if (!code) {
      return {
        ok: false,
        message: "OAuth callback timeout — no authorization code received",
      };
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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: tokenBody.toString(),
    });
    if (!tokenRes.ok) {
      return {
        ok: false,
        message: `Token exchange failed: ${await tokenRes.text()}`,
      };
    }
    const tokenData = (await tokenRes.json()) as unknown as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
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
    setOAuthPref(
      "geminiOAuthScope",
      tokenData.scope || GEMINI_SCOPES.join(" "),
    );
    setOAuthPref("geminiOAuthProjectId", projectId);
    return {
      ok: true,
      message: `Gemini OAuth ready${projectId ? ` (project: ${projectId})` : ""}`,
    };
  } catch (err) {
    return { ok: false, message: `Gemini OAuth failed: ${String(err)}` };
  }
}

/**
 * Project discovery aligned with the reference implementation
 * (openclaw/extensions/google/oauth.project.ts → discoverProject).
 *
 * Uses IDE_UNSPECIFIED as ideType so the API returns projects that were
 * provisioned by any IDE or the Gemini CLI.  Tries multiple Code Assist
 * endpoints (prod → daily → autopush) and sends cloudaicompanionProject
 * in the loadCodeAssist body when an env-var project is available.
 */
async function discoverGeminiProject(accessToken: string): Promise<string> {
  const fetchFn = getFetch();
  const ENDPOINTS = [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.sandbox.googleapis.com",
    "https://autopush-cloudcode-pa.sandbox.googleapis.com",
  ];
  // Match the reference exactly: IDE_UNSPECIFIED + PLATFORM_UNSPECIFIED
  const metadata = {
    ideType: "IDE_UNSPECIFIED",
    platform: "PLATFORM_UNSPECIFIED",
    pluginType: "GEMINI",
  };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "google-api-nodejs-client/9.15.1",
    "X-Goog-Api-Client": "gl-node/20.0.0",
    "Client-Metadata": JSON.stringify(metadata),
  };

  // Check env-var project upfront (used in loadCodeAssist body per reference)
  let envProject = "";
  try {
    envProject =
      getEnv("GOOGLE_CLOUD_PROJECT") || getEnv("GOOGLE_CLOUD_PROJECT_ID") || "";
  } catch {
    /* */
  }

  // ---- Step 1: loadCodeAssist (try multiple endpoints) ----
  const loadBody: Record<string, unknown> = {
    metadata: {
      ...metadata,
      ...(envProject ? { duetProject: envProject } : {}),
    },
    ...(envProject ? { cloudaicompanionProject: envProject } : {}),
  };

  type LoadData = {
    currentTier?: { id?: string };
    cloudaicompanionProject?: string | { id?: string };
    allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
  };
  let data: LoadData = {};
  let activeEndpoint = ENDPOINTS[0];
  let loadSucceeded = false;

  for (const ep of ENDPOINTS) {
    try {
      ztoolkit?.log?.(
        "AIdea: Gemini project discovery - calling loadCodeAssist at",
        ep,
      );
      const loadRes = await fetchFn(`${ep}/v1internal:loadCodeAssist`, {
        method: "POST",
        headers,
        body: JSON.stringify(loadBody),
      });
      ztoolkit?.log?.("AIdea: loadCodeAssist status:", loadRes.status);
      if (!loadRes.ok) {
        const errText = await loadRes.text().catch(() => "");
        ztoolkit?.log?.("AIdea: loadCodeAssist failed:", errText.slice(0, 300));
        continue;
      }
      data = (await loadRes.json()) as unknown as LoadData;
      ztoolkit?.log?.(
        "AIdea: loadCodeAssist response:",
        JSON.stringify(data).slice(0, 500),
      );
      activeEndpoint = ep;
      loadSucceeded = true;
      break;
    } catch (err) {
      ztoolkit?.log?.("AIdea: loadCodeAssist exception at", ep, err);
    }
  }

  const hasData =
    Boolean(data.currentTier) ||
    Boolean(data.cloudaicompanionProject) ||
    Boolean(data.allowedTiers?.length);
  if (!loadSucceeded && !hasData) {
    ztoolkit?.log?.("AIdea: All loadCodeAssist endpoints failed");
    if (envProject) return envProject;
    // Fall through to gcloud / env fallbacks below
  }

  // ---- Extract project if user is already onboarded ----
  if (data.currentTier) {
    const proj = data.cloudaicompanionProject;
    if (typeof proj === "string" && proj) {
      ztoolkit?.log?.("AIdea: Found project (string):", proj);
      return proj;
    }
    if (typeof proj === "object" && proj?.id) {
      ztoolkit?.log?.("AIdea: Found project (object):", proj.id);
      return proj.id;
    }
    ztoolkit?.log?.(
      "AIdea: Has tier but no project in response. Tier:",
      data.currentTier.id,
    );
    // Already onboarded but project not in response — need env/gcloud fallback
    if (envProject) return envProject;
  }

  // ---- Step 2: onboardUser (provision new project for free-tier users) ----
  if (hasData) {
    const defaultTier = data.allowedTiers?.find((t) => t.isDefault);
    const tierId = defaultTier?.id || "free-tier";
    ztoolkit?.log?.("AIdea: onboarding with tier:", tierId);

    const onboardBody: Record<string, unknown> = {
      tierId,
      metadata: {
        ...metadata,
        ...(tierId !== "free-tier" && envProject
          ? { duetProject: envProject }
          : {}),
      },
      ...(tierId !== "free-tier" && envProject
        ? { cloudaicompanionProject: envProject }
        : {}),
    };
    try {
      const onboardRes = await fetchFn(
        `${activeEndpoint}/v1internal:onboardUser`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(onboardBody),
        },
      );
      ztoolkit?.log?.("AIdea: onboardUser status:", onboardRes.status);

      if (onboardRes.ok) {
        let lro = (await onboardRes.json()) as unknown as {
          done?: boolean;
          name?: string;
          response?: { cloudaicompanionProject?: { id?: string } };
        };
        ztoolkit?.log?.(
          "AIdea: onboardUser response:",
          JSON.stringify(lro).slice(0, 500),
        );

        // Poll operation if not done
        if (!lro.done && lro.name) {
          ztoolkit?.log?.("AIdea: Polling operation:", lro.name);
          for (let i = 0; i < 24; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const pollRes = await fetchFn(
              `${activeEndpoint}/v1internal/${lro.name}`,
              { headers },
            );
            if (pollRes.ok) {
              lro = (await pollRes.json()) as unknown as typeof lro;
              ztoolkit?.log?.(
                "AIdea: Poll result:",
                JSON.stringify(lro).slice(0, 300),
              );
              if (lro.done) break;
            }
          }
        }
        const projId = lro.response?.cloudaicompanionProject?.id;
        ztoolkit?.log?.(
          "AIdea: Final project ID from onboard:",
          projId || "(empty)",
        );
        if (projId) return projId;
      } else {
        const errText = await onboardRes.text().catch(() => "");
        ztoolkit?.log?.("AIdea: onboardUser failed:", errText.slice(0, 300));
      }
    } catch (err) {
      ztoolkit?.log?.("AIdea: onboardUser exception:", err);
    }
  }

  // ---- Fallback 1: try gcloud CLI ----
  try {
    const gcloud = await runShellCommand("gcloud config get-value project", {
      hidden: true,
    });
    const gcloudProj = gcloud.stdout?.trim();
    if (gcloudProj && !gcloudProj.includes("(unset)")) {
      ztoolkit?.log?.("AIdea: Got project from gcloud:", gcloudProj);
      return gcloudProj;
    }
  } catch {
    /* gcloud not installed */
  }

  // ---- Fallback 2: environment variable ----
  if (envProject) {
    ztoolkit?.log?.("AIdea: Got project from env:", envProject);
    return envProject;
  }

  return "";
}

// ---------- GitHub Copilot Device Code Flow ----------
const COPILOT_GITHUB_CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

async function loginCopilotDeviceCode(): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const dcBody = new URLSearchParams({
      client_id: COPILOT_GITHUB_CLIENT_ID,
      scope: "read:user",
    });
    const dcRes = await getFetch()(GITHUB_DEVICE_CODE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: dcBody,
    });
    if (!dcRes.ok)
      throw new Error(`GitHub device code failed: HTTP ${dcRes.status}`);
    const dcJson = (await dcRes.json()) as unknown as Record<string, unknown>;
    const deviceCode = String(dcJson.device_code || "");
    const userCode = String(dcJson.user_code || "");
    const verificationUri = String(
      dcJson.verification_uri || "https://github.com/login/device",
    );
    const interval = Math.max(1, Number(dcJson.interval) || 5);
    const expiresIn = Number(dcJson.expires_in) || 900;
    if (!deviceCode || !userCode)
      throw new Error("GitHub device code response missing fields");

    // Show dialog to user with i18n and copy-to-clipboard
    const win = Zotero.getMainWindow?.();
    const lang = getUiLang();
    const copy =
      COPILOT_DEVICE_LOGIN_COPY[lang] ||
      COPILOT_DEVICE_LOGIN_COPY[DEFAULT_PANEL_LANG];
    const msg = `${copy.title}\n\n${copy.codeLabel}:\n${userCode}\n\n${copy.instructions}`;
    const accepted = win?.confirm?.(msg);
    if (!accepted)
      return {
        ok: false,
        message: copy.cancelled,
      };
    copyToClipboard(userCode);
    showCopiedToast(lang);
    try {
      (Zotero as any).launchURL?.(verificationUri);
    } catch {
      /* ignore */
    }

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
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenBody,
      });
      if (!tokenRes.ok)
        throw new Error(`GitHub token request failed: HTTP ${tokenRes.status}`);
      const tokenJson = (await tokenRes.json()) as unknown as Record<
        string,
        unknown
      >;
      if (
        typeof tokenJson.access_token === "string" &&
        tokenJson.access_token
      ) {
        saveCopilotGithubToken(tokenJson.access_token);
        // Pre-exchange for Copilot API token
        try {
          await exchangeCopilotToken(tokenJson.access_token);
        } catch {
          /* will retry later */
        }
        return {
          ok: true,
          message: `${getProviderLabel("github-copilot")} OAuth ready`,
        };
      }
      const err = String(tokenJson.error || "");
      if (err === "authorization_pending") continue;
      if (err === "slow_down") {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (err === "expired_token")
        throw new Error("GitHub device code expired");
      if (err === "access_denied") throw new Error("GitHub login cancelled");
      throw new Error(`GitHub device flow error: ${err}`);
    }
    throw new Error("GitHub device code expired");
  } catch (err) {
    return {
      ok: false,
      message: String(err instanceof Error ? err.message : err),
    };
  }
}

export async function runProviderOAuthLogin(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  await ensureZoteroProxyFromSystem({ forceRefresh: true });
  // Qwen and Copilot use in-plugin Device Code flows

  if (provider === "github-copilot") return loginCopilotDeviceCode();

  // Gemini: in-plugin OAuth Authorization Code + PKCE flow.
  if (provider === "google-gemini-cli") {
    return loginGeminiInPlugin();
  }

  // Codex uses external CLI tool (hidden mode)
  const spec = getProviderCliSpec(provider);
  if (!spec) {
    return {
      ok: false,
      message: `No CLI login command is defined for ${provider}`,
    };
  }

  const cliPath = await resolveProviderCliExecutablePath(provider, spec);
  if (!cliPath) {
    return {
      ok: false,
      message: `${spec.executableName} was not found. Please run Install/Update Env first.`,
    };
  }

  try {
    const command = buildExecutableCommand(cliPath, ["login"]);
    const result = await runShellCommand(command, { hidden: true });
    const last = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
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
    return {
      ok: false,
      message: last || `Failed to execute ${spec.executableName} login`,
    };
  } catch (err) {
    return {
      ok: false,
      message: String(err) || `Failed to execute ${spec.executableName} login`,
    };
  }
}

export async function removeProviderOAuthCredential(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  if (provider === "github-copilot") {
    setOAuthPref("oauthCopilotGithubToken", "");
    setOAuthPref("oauthCopilotApiToken", "");
    return {
      ok: true,
      message: `${getProviderLabel(provider)} authorization removed`,
    };
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
      return {
        ok: true,
        message: `${getProviderLabel(provider)} authorization removed`,
      };
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
  const targetProviders = params?.provider
    ? [params.provider]
    : (Object.keys(PROVIDER_CLI_SPECS) as OAuthProviderId[]);
  const npmTargetProviders = targetProviders.filter(
    (provider) =>
      provider !== "openai-codex" && Boolean(getProviderCliSpec(provider)),
  );
  let allOk = true;
  report?.({
    phase: "info",
    step: "Detected platform",
    output: platform,
  });
  append("Detected platform", platform);
  await ensureZoteroProxyFromSystem({ forceRefresh: true });

  const formatNpmState = (state: NpmEnvironmentState): string =>
    [
      `platform: ${state.platform}`,
      `nodePath: ${state.nodePath || "-"}`,
      `nodeVersion: ${state.nodeVersion || "-"}`,
      `nodeArch: ${state.nodeArch || "-"}`,
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
    if (
      !state.npmPath ||
      !preferredUserPrefix ||
      state.prefix === preferredUserPrefix
    ) {
      return state;
    }
    report?.({
      phase: "start",
      step: "Switch npm prefix",
    });
    append(
      "Switch npm prefix",
      `Reason: ${reason}\nTarget: ${preferredUserPrefix}`,
    );
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

  if (targetProviders.includes("openai-codex")) {
    const codexOk = await tryInstallCodexStandalone(report, append);
    if (codexOk) {
      recordOAuthEnvUpdateSuccess("openai-codex");
    } else {
      allOk = false;
    }
  }

  if (!npmTargetProviders.length) {
    return { ok: allOk, logs: logs.join("\n\n") };
  }

  let npmState = await inspectNpmEnvironment(false);
  append("Initial npm environment", formatNpmState(npmState));

  if (!npmState.nodePath || !npmState.npmPath) {
    const installed = await tryInstallNodeRuntime(report, append);
    npmState = await inspectNpmEnvironment(false);
    append(
      "npm environment after Node.js install attempt",
      formatNpmState(npmState),
    );
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
  if (
    !dirsOk &&
    preferredUserPrefix &&
    npmState.npmPath &&
    npmState.prefix !== preferredUserPrefix
  ) {
    await switchNpmPrefixToPreferred(
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
  const wantsNpmUpdate =
    shouldInstallLatestPackageVersion(
      npmState.npmPackageVersion || npmState.npmReportedVersion,
      npmState.latestNpmVersion,
    ) || npmVersionMismatch;
  const canUpdateToLatestNpm = isNodeVersionSupportedByLatestNpm(
    npmState.nodeVersion,
  );

  if (wantsNpmUpdate && npmState.npmPath && canUpdateToLatestNpm) {
    const targetVersion = normalizeVersionText(npmState.latestNpmVersion);
    const installTarget = targetVersion ? `npm@${targetVersion}` : "npm@latest";
    report?.({ phase: "start", step: `Update npm (${installTarget})` });
    let updateResult = await runExecutableCommand(npmState.npmPath, [
      "install",
      "-g",
      installTarget,
    ]);
    append(`Update npm (${installTarget})`, updateResult.output);
    if (
      updateResult.code !== 0 &&
      looksLikePermissionError(updateResult.output)
    ) {
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
  } else if (wantsNpmUpdate && npmState.npmPath && !canUpdateToLatestNpm) {
    const output =
      `Skipping npm update because the latest npm requires Node.js ^20.17.0 or >=22.9.0. ` +
      `Current Node.js is ${npmState.nodeVersion || "unknown"}; the existing npm will be used for CLI installs.`;
    append("npm version check", output);
    report?.({
      phase: "info",
      step: "npm version check",
      output,
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

  for (const provider of npmTargetProviders) {
    const spec = getProviderCliSpec(provider);
    if (!spec) continue;
    let providerOk = true;
    let npmExecutablePath = npmState.npmPath;
    if (!npmExecutablePath) {
      allOk = false;
      append(
        `Install ${spec.packageName}`,
        "npm executable path is unavailable after environment preparation.",
      );
      continue;
    }

    if (!isNodeVersionSupportedByCliSpec(npmState.nodeVersion, spec)) {
      const requiredNode = spec.minNodeVersionLabel || "a newer Node.js";
      const currentNode = npmState.nodeVersion || "unknown";
      const checkMessage =
        `${spec.packageName} requires ${requiredNode}. ` +
        `Current Node.js is ${currentNode}. Trying to install/update Node.js.`;
      append("Node.js version check", checkMessage);
      report?.({
        phase: "info",
        step: "Node.js version check",
        output: checkMessage,
      });
      await tryInstallNodeRuntime(report, append, {
        preferredMajor: DEFAULT_NODE_RUNTIME_MAJOR,
      });
      npmState = await inspectNpmEnvironment(false);
      append(
        "npm environment after Node.js update attempt",
        formatNpmState(npmState),
      );
      await ensureNpmDirectories(npmState);
      npmExecutablePath = npmState.npmPath;

      if (!isNodeVersionSupportedByCliSpec(npmState.nodeVersion, spec)) {
        const manualInstructions =
          npmState.platform === "linux"
            ? `\n\nAutomatic install may require an interactive sudo password. ` +
              `Open a terminal and run:\n\n${buildNodeSourceAptManualInstructions()}\n\n` +
              "After it finishes, restart Zotero and run Install/Update Env again."
            : "";
        const output =
          `${spec.packageName} requires ${requiredNode}. ` +
          `Current Node.js is ${npmState.nodeVersion || "unknown"}. ` +
          "Install Node.js 20 or newer, restart Zotero, then run Install/Update Env again." +
          manualInstructions;
        append("Node.js version check", output);
        report?.({
          phase: "done",
          step: "Node.js version check",
          ok: false,
          output,
        });
        allOk = false;
        continue;
      }
    }

    if (!npmExecutablePath) {
      allOk = false;
      append(
        `Install ${spec.packageName}`,
        "npm executable path is unavailable after Node.js version preparation.",
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
      const installArgs = ["install", "-g", targetPackage];
      report?.({
        phase: "start",
        step: `Install ${spec.packageName}`,
      });
      let installResult = await runExecutableCommand(
        npmExecutablePath,
        installArgs,
      );
      append(`Install ${spec.packageName}`, installResult.output);
      if (
        installResult.code !== 0 &&
        looksLikePermissionError(installResult.output)
      ) {
        npmState = await switchNpmPrefixToPreferred(
          npmState,
          `${spec.packageName} install failed with a permissions error`,
        );
        if (npmState.npmPath) {
          installResult = await runExecutableCommand(
            npmState.npmPath,
            installArgs,
          );
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
        providerOk = false;
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
    const verification = await verifyExecutable(
      spec.executableName,
      spec.versionArg,
      [npmState.globalBinDir, ...getCommonExecutableDirs(npmState.platform)],
    );
    append(
      `Verify ${spec.executableName}`,
      [`path: ${verification.path || "-"}`, verification.output].join("\n"),
    );
    report?.({
      phase: "done",
      step: `Verify ${spec.executableName}`,
      ok: verification.ok,
      output: verification.output,
    });

    if (!verification.ok) {
      allOk = false;
      providerOk = false;
    }
    if (providerOk && verification.ok) {
      recordOAuthEnvUpdateSuccess(provider);
    }
  }

  return { ok: allOk, logs: logs.join("\n\n") };
}

export async function getProviderAuthStatus(
  provider: OAuthProviderId,
): Promise<string> {
  const cred = await readProviderOAuthCredential(provider);
  if (!cred) return "Not logged in";

  if (provider === "openai-codex") {
    // Fetch usage info from the Codex backend for richer status
    try {
      const headers: Record<string, string> = {
        ...ensureProviderAuthHeaderInit(cred),
        Accept: "application/json",
      };
      const res = await getFetch()(
        "https://chatgpt.com/backend-api/wham/usage",
        {
          method: "GET",
          headers,
        },
      );
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
      if (
        data.credits?.balance !== undefined &&
        data.credits.balance !== null
      ) {
        const balance =
          typeof data.credits.balance === "number"
            ? data.credits.balance
            : parseFloat(String(data.credits.balance)) || 0;
        parts.push(`$${balance.toFixed(2)}`);
      }
      if (data.rate_limit?.primary_window) {
        const pw = data.rate_limit.primary_window;
        const windowHours = Math.round(
          (pw.limit_window_seconds || 10800) / 3600,
        );
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
      parts.push(
        remainMin > 60
          ? `expires in ${Math.round(remainMin / 60)}h`
          : `expires in ${remainMin}min`,
      );
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
      account =
        typeof email === "string" && email.trim()
          ? email.trim()
          : cred.accountId || "ChatGPT OAuth";
    } else {
      account = cred.accountId || "ChatGPT OAuth";
    }
  } else if (provider === "google-gemini-cli") {
    // Gemini: try to read client_email or account from the credential file
    const home = homeDir();
    if (home) {
      const data = await readJsonFile(
        joinPath(home, ".gemini", "oauth_creds.json"),
      );
      const email = data?.client_email || data?.account || data?.email;
      account =
        typeof email === "string" && email.trim()
          ? email.trim()
          : cred.projectId || "Google OAuth";
    } else {
      account = cred.projectId || "Google OAuth";
    }
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
    input.push({
      role: "system",
      content: `Document Context:\n${params.context.trim()}`,
    });
  }
  for (const msg of params.history || []) {
    const role =
      msg.role === "assistant"
        ? "assistant"
        : msg.role === "system"
          ? "system"
          : "user";
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    if (!content.trim()) continue;
    input.push({ role, content });
  }
  input.push({ role: "user", content: params.prompt });
  return input;
}

/**
 * Build messages in OpenAI Responses API format for Copilot non-Claude models.
 * The Responses API uses a different input shape than Chat Completions:
 *   input: [
 *     { role: "user",      content: [{ type: "input_text", text: "..." }] },
 *     { role: "assistant", content: [{ type: "output_text", text: "..." }] },
 *   ]
 * System prompt goes into the top-level `instructions` field instead.
 */
function buildCopilotResponsesInput(params: {
  prompt: string;
  context?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  images?: string[];
}): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = [];

  // Context as a user+assistant exchange if present
  if (params.context?.trim()) {
    input.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Document Context:\n${params.context.trim()}`,
        },
      ],
    });
    input.push({
      role: "assistant",
      content: [
        {
          type: "output_text",
          text: "I've reviewed the document context. How can I help you?",
        },
      ],
    });
  }

  // Add history messages
  for (const msg of params.history || []) {
    const text =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    if (!text.trim()) continue;
    if (msg.role === "assistant") {
      input.push({
        role: "assistant",
        content: [{ type: "output_text", text }],
      });
    } else if (msg.role === "user") {
      input.push({
        role: "user",
        content: [{ type: "input_text", text }],
      });
    }
    // system messages are handled via the instructions field
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
    role: "user",
    content: contentParts,
  });

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
  parts.push(
    [
      "Image generation tool guidance:",
      "- You have access to an image_generation tool.",
      "- Use it only when the user clearly asks to create, draw, generate, design, edit, or transform an image/visual.",
      "- For ordinary questions, analysis, summaries, translation, coding, and PDF discussion, answer normally without calling the image tool.",
      "- When image generation is requested, decide what to send to the image tool based on the user's request and the available conversation, PDF, file, and image context. You may pass the user's original request, reference images, extracted PDF details, or a refined image prompt.",
    ].join("\n"),
  );
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
    const text =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
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

function normalizeOAuthImageMimeType(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "image/png";
  if (raw.startsWith("image/")) return raw;
  if (raw === "jpg") return "image/jpeg";
  if (["png", "jpeg", "webp", "gif"].includes(raw)) return `image/${raw}`;
  return "image/png";
}

function extractOAuthOutputImageMarkdown(
  value: unknown,
  index: number,
): string {
  if (!value || typeof value !== "object") return "";
  const part = value as {
    type?: unknown;
    result?: unknown;
    b64_json?: unknown;
    data?: unknown;
    image_url?: unknown;
    url?: unknown;
    mime_type?: unknown;
    media_type?: unknown;
    output_format?: unknown;
    format?: unknown;
  };
  const type = typeof part.type === "string" ? part.type : "";
  const looksImageLike =
    type.includes("image") ||
    type === "image_generation_call" ||
    typeof part.image_url !== "undefined";
  if (!looksImageLike) return "";
  const alt =
    type === "image_generation_call"
      ? `Generated image ${index}`
      : `Image ${index}`;
  const imageUrl =
    typeof part.image_url === "string"
      ? part.image_url
      : part.image_url &&
          typeof part.image_url === "object" &&
          typeof (part.image_url as { url?: unknown }).url === "string"
        ? (part.image_url as { url: string }).url
        : typeof part.url === "string"
          ? part.url
          : "";
  if (imageUrl.trim()) return `![${alt}](${imageUrl.trim()})`;

  const base64 =
    typeof part.result === "string"
      ? part.result
      : typeof part.b64_json === "string"
        ? part.b64_json
        : typeof part.data === "string"
          ? part.data
          : "";
  if (!base64.trim()) return "";
  if (base64.trim().startsWith("data:image/")) {
    return `![${alt}](${base64.trim()})`;
  }
  const mimeType = normalizeOAuthImageMimeType(
    part.mime_type || part.media_type || part.output_format || part.format,
  );
  return `![${alt}](data:${mimeType};base64,${base64.trim()})`;
}

function extractOAuthOutputText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as {
    type?: unknown;
    text?: unknown;
    output_text?: unknown;
    content?: unknown;
    output?: unknown;
    response?: unknown;
  };
  const type = typeof obj.type === "string" ? obj.type : "";
  if (type === "output_text" && typeof obj.text === "string") {
    return obj.text;
  }
  if (typeof obj.output_text === "string") {
    return obj.output_text;
  }
  const parts: string[] = [];
  if (Array.isArray(obj.content)) {
    for (const part of obj.content) {
      const text = extractOAuthOutputText(part);
      if (text) parts.push(text);
    }
  }
  if (Array.isArray(obj.output)) {
    for (const part of obj.output) {
      const text = extractOAuthOutputText(part);
      if (text) parts.push(text);
    }
  }
  if (obj.response) {
    const text = extractOAuthOutputText(obj.response);
    if (text) parts.push(text);
  }
  return parts.join("");
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
  const emittedImageMarkdown = new Set<string>();

  const emitImageMarkdown = (value: unknown) => {
    const markdown = extractOAuthOutputImageMarkdown(
      value,
      emittedImageMarkdown.size + 1,
    );
    if (!markdown || emittedImageMarkdown.has(markdown)) return;
    emittedImageMarkdown.add(markdown);
    const delta = fullText ? `\n\n${markdown}` : markdown;
    fullText += delta;
    onDelta?.(delta);
  };

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
          if (event.type === "response.completed" && !fullText) {
            const completedText = extractOAuthOutputText(event.response);
            if (completedText) {
              fullText = completedText;
              onDelta?.(fullText);
            }
          }
          if (event.type === "response.output_item.done" && !fullText) {
            const itemText = extractOAuthOutputText(event.item);
            if (itemText) {
              fullText = itemText;
              onDelta?.(fullText);
            }
          }
          if (
            event.type === "response.output_item.done" ||
            event.type === "response.completed"
          ) {
            if (event.item) {
              emitImageMarkdown(event.item);
              const itemContent = Array.isArray(event.item.content)
                ? event.item.content
                : [];
              for (const content of itemContent) {
                emitImageMarkdown(content);
              }
            }
            const responseOutput = Array.isArray(event.response?.output)
              ? event.response.output
              : [];
            for (const output of responseOutput) {
              emitImageMarkdown(output);
              const outputContent = Array.isArray(output.content)
                ? output.content
                : [];
              for (const content of outputContent) {
                emitImageMarkdown(content);
              }
            }
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

function parseCodexSSERaw(
  raw: string,
  onDelta?: (delta: string) => void,
): string {
  let fullText = "";
  const emittedImageMarkdown = new Set<string>();
  const emitImageMarkdown = (value: unknown) => {
    const markdown = extractOAuthOutputImageMarkdown(
      value,
      emittedImageMarkdown.size + 1,
    );
    if (!markdown || emittedImageMarkdown.has(markdown)) return;
    emittedImageMarkdown.add(markdown);
    const delta = fullText ? `\n\n${markdown}` : markdown;
    fullText += delta;
    onDelta?.(delta);
  };

  for (const line of raw.split("\n")) {
    if (!line.trim().startsWith("data:")) continue;
    const data = line.trim().slice(5).trim();
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
      if (event.type === "response.completed" && !fullText) {
        const completedText = extractOAuthOutputText(event.response);
        if (completedText) {
          fullText = completedText;
          onDelta?.(fullText);
        }
      }
      if (event.type === "response.output_item.done" && !fullText) {
        const itemText = extractOAuthOutputText(event.item);
        if (itemText) {
          fullText = itemText;
          onDelta?.(fullText);
        }
      }
      if (
        event.type === "response.output_item.done" ||
        event.type === "response.completed"
      ) {
        if (event.item) {
          emitImageMarkdown(event.item);
          const itemContent = Array.isArray(event.item.content)
            ? event.item.content
            : [];
          for (const content of itemContent) {
            emitImageMarkdown(content);
          }
        }
        const responseOutput = Array.isArray(event.response?.output)
          ? event.response.output
          : [];
        for (const output of responseOutput) {
          emitImageMarkdown(output);
          const outputContent = Array.isArray(output.content)
            ? output.content
            : [];
          for (const content of outputContent) {
            emitImageMarkdown(content);
          }
        }
      }
    } catch {
      /* skip */
    }
  }
  return fullText;
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
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
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
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
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
    contents: [
      { role: "user", parts: [{ text: buildGeminiOAuthPromptText(params) }] },
    ],
  };

  const generationConfig: Record<string, unknown> = {};
  if (
    typeof params.temperature === "number" &&
    Number.isFinite(params.temperature)
  ) {
    generationConfig.temperature = params.temperature;
  }
  if (
    typeof params.maxTokens === "number" &&
    Number.isFinite(params.maxTokens)
  ) {
    generationConfig.maxOutputTokens = Math.max(
      1,
      Math.round(params.maxTokens),
    );
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
  const root = data && typeof data === "object" ? (data as any) : null;
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

  return fullText;
}

/**
 * Build messages in Anthropic Messages API format (user/assistant alternation).
 * System prompt is handled separately via the `system` field in the payload.
 */
function buildAnthropicMessagesInput(params: {
  prompt: string;
  context?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  systemPrompt?: string;
}): Array<{ role: "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Context goes as a user message prefix (system is handled via the system field)
  if (params.context?.trim()) {
    messages.push({
      role: "user",
      content: `Document Context:\n${params.context.trim()}`,
    });
    messages.push({
      role: "assistant",
      content: "I've reviewed the document context. How can I help you?",
    });
  }

  // Convert history, merging adjacent same-role messages
  for (const msg of params.history || []) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    if (!content.trim()) continue;

    if (msg.role === "system") {
      // Anthropic doesn't have system messages in the messages array;
      // merge into a user message instead.
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "user") {
        lastMsg.content += `\n${content}`;
      } else {
        messages.push({ role: "user", content });
        messages.push({ role: "assistant", content: "Understood." });
      }
      continue;
    }

    const role: "user" | "assistant" =
      msg.role === "assistant" ? "assistant" : "user";

    // Anthropic requires strict user/assistant alternation - merge adjacent same-role
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === role) {
      lastMsg.content += `\n${content}`;
    } else {
      messages.push({ role, content });
    }
  }

  // Final user prompt - merge if last message is already from user
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === "user") {
    lastMsg.content += `\n${params.prompt}`;
  } else {
    messages.push({ role: "user", content: params.prompt });
  }

  return messages;
}

/**
 * Parse a streaming SSE response from the Anthropic Messages API.
 * Handles content_block_delta events with text_delta type.
 */
async function parseAnthropicSSEStream(
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
          const event = JSON.parse(data) as any;

          // Anthropic uses content_block_delta with text_delta
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "text_delta"
          ) {
            const text = event.delta.text;
            if (typeof text === "string" && text) {
              fullText += text;
              onDelta?.(text);
            }
          }

          // message_stop contains no text, but message_delta may have stop_reason
          if (event.type === "message_delta") {
            // We could check event.delta?.stop_reason here if needed
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
  imageGeneration?: boolean;
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
    payload.tools = [{ type: "image_generation" }];
    logOAuthRequestParameterPolicy({
      provider: params.provider,
      model: params.model,
      endpointType: "codex-responses",
      payload,
      parameterSource: "omitted-provider-default",
    });
    const codexHeaders: Record<string, string> = {
      ...ensureProviderAuthHeaderInit(cred),
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    const res = await fetchWithTransientRetry(
      getFetch(),
      "https://chatgpt.com/backend-api/codex/responses",
      {
        method: "POST",
        headers: codexHeaders,
        body: JSON.stringify(payload),
        signal: params.signal,
      },
      {
        signal: params.signal,
        onRetry: ({ attempt, maxAttempts, error }) => {
          ztoolkit?.log?.(
            `AIdea: Codex OAuth transient upstream error, retry ${attempt}/${maxAttempts - 1}`,
            error,
          );
        },
      },
    );
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
    return parseCodexSSERaw(raw, params.onDelta);
  }

  // ---------- GitHub Copilot (via token exchange) ----------
  // Claude models use the Anthropic Messages API format; all other models
  // (GPT, o-series, Gemini) use the OpenAI chat/completions format.
  // This matches the OpenClaw transport-routing architecture.
  if (params.provider === "github-copilot") {
    // Ensure we have a valid Copilot API token
    const copilotResult = await ensureCopilotApiToken();
    if (!copilotResult) {
      throw new Error(
        "GitHub Copilot is not logged in. Please complete OAuth login in Settings first.",
      );
    }

    const copilotBaseHeaders: Record<string, string> = {
      Authorization: `Bearer ${copilotResult.token}`,
      "Content-Type": "application/json",
      ...buildCopilotDynamicHeaders(),
    };

    // ---- Claude models → Anthropic Messages API ----
    const transportKind = resolveCopilotTransportKind(params.model);

    if (transportKind === "anthropic-messages") {
      if (params.imageGeneration) {
        throw new Error(
          "GitHub Copilot image generation requires a Responses-compatible model.",
        );
      }
      const anthropicMessages = buildAnthropicMessagesInput(params);
      const anthropicPayload: Record<string, unknown> = {
        model: params.model,
        messages: anthropicMessages,
        max_tokens:
          typeof params.maxTokens === "number" &&
          Number.isFinite(params.maxTokens)
            ? params.maxTokens
            : 8192,
        stream: true,
      };
      applyCopilotTemperatureIfSupported(
        anthropicPayload,
        params.model,
        params.temperature,
      );
      if (params.systemPrompt?.trim()) {
        anthropicPayload.system = params.systemPrompt.trim();
      }
      logOAuthRequestParameterPolicy({
        provider: params.provider,
        model: params.model,
        endpointType: "copilot-anthropic-messages",
        payload: anthropicPayload,
        parameterSource: hasFiniteNumber(params.maxTokens)
          ? "explicit-task"
          : "provider-required-fallback",
      });
      const anthropicUrl = `${copilotResult.baseUrl}/v1/messages`;
      const anthropicHeaders: Record<string, string> = {
        ...copilotBaseHeaders,
        Accept: "text/event-stream",
      };
      const res = await postCopilotWithTemperatureFallback({
        url: anthropicUrl,
        headers: anthropicHeaders,
        payload: anthropicPayload,
        signal: params.signal,
      });
      if (res.body) {
        return parseAnthropicSSEStream(res.body, params.onDelta);
      }
      // Fallback: non-streaming
      const data = (await res.json()) as any;
      const text =
        typeof data?.content?.[0]?.text === "string"
          ? data.content[0].text
          : "";
      params.onDelta?.(text);
      return text;
    }

    // ---- GPT / o-series / Gemini / Grok / other models → OpenAI Responses API ----
    // Newer Copilot models (gpt-5.x, o4-*, gemini-*, grok-*) are only accessible
    // via the /responses endpoint, not /chat/completions. Following OpenClaw's
    // approach, we use the Responses API for ALL non-Claude Copilot models.
    if (transportKind === "chat-completions") {
      if (params.imageGeneration) {
        throw new Error(
          "GitHub Copilot image generation requires a Responses-compatible model.",
        );
      }
      const messages = buildOpenAIResponsesInput(params);
      const chatPayload: Record<string, unknown> = {
        model: params.model,
        messages,
        stream: true,
      };
      if (
        typeof params.maxTokens === "number" &&
        Number.isFinite(params.maxTokens)
      ) {
        chatPayload.max_tokens = params.maxTokens;
      }
      applyCopilotTemperatureIfSupported(
        chatPayload,
        params.model,
        params.temperature,
      );
      logOAuthRequestParameterPolicy({
        provider: params.provider,
        model: params.model,
        endpointType: "copilot-chat-completions",
        payload: chatPayload,
        parameterSource: hasFiniteNumber(params.maxTokens)
          ? "explicit-task"
          : "omitted-provider-default",
      });
      const chatUrl = `${copilotResult.baseUrl}/chat/completions`;
      const chatHeaders: Record<string, string> = {
        ...copilotBaseHeaders,
        Accept: "text/event-stream",
      };
      const res = await postCopilotWithTemperatureFallback({
        url: chatUrl,
        headers: chatHeaders,
        payload: chatPayload,
        signal: params.signal,
      });
      if (res.body) {
        return parseOpenAICompatSSEStream(res.body, params.onDelta);
      }
      const data = (await res.json()) as any;
      const text =
        typeof data?.choices?.[0]?.message?.content === "string"
          ? data.choices[0].message.content
          : "";
      params.onDelta?.(text);
      return text;
    }

    const responsesInput = buildCopilotResponsesInput(params);
    const responsesPayload: Record<string, unknown> = {
      model: params.model,
      input: responsesInput,
      stream: true,
    };
    if (params.imageGeneration) {
      responsesPayload.tools = [{ type: "image_generation" }];
    }
    if (
      typeof params.maxTokens === "number" &&
      Number.isFinite(params.maxTokens)
    ) {
      responsesPayload.max_output_tokens = params.maxTokens;
    }
    applyCopilotTemperatureIfSupported(
      responsesPayload,
      params.model,
      params.temperature,
    );
    if (params.systemPrompt?.trim()) {
      responsesPayload.instructions = params.systemPrompt.trim();
    }
    logOAuthRequestParameterPolicy({
      provider: params.provider,
      model: params.model,
      endpointType: "copilot-responses",
      payload: responsesPayload,
      parameterSource: hasFiniteNumber(params.maxTokens)
        ? "explicit-task"
        : "omitted-provider-default",
    });
    const copilotUrl = `${copilotResult.baseUrl}/responses`;
    const copilotHeaders: Record<string, string> = {
      ...copilotBaseHeaders,
      Accept: "text/event-stream",
    };
    const res = await postCopilotWithTemperatureFallback({
      url: copilotUrl,
      headers: copilotHeaders,
      payload: responsesPayload,
      signal: params.signal,
    });
    // Reuse the Codex SSE parser — same response.output_text.delta event format
    if (res.body) {
      return parseCodexSSEStream(res.body, params.onDelta);
    }
    // Fallback: if body is not a ReadableStream (some Gecko builds),
    // download the full text and parse SSE lines.
    const raw = await res.text();
    return parseCodexSSERaw(raw, params.onDelta);
  }

  // ---------- Google Gemini CLI (Cloud Code Assist streaming) ----------
  // Lazy project discovery: if we have a token but no project ID,
  // attempt automatic discovery and cache the result before giving up.
  let geminiProjectId = cred.projectId || "";
  if (!geminiProjectId && cred.accessToken) {
    try {
      ztoolkit?.log?.("AIdea: Gemini lazy project discovery starting...");
      const discovered = await discoverGeminiProject(cred.accessToken);
      if (discovered) {
        geminiProjectId = discovered;
        setOAuthPref("geminiOAuthProjectId", discovered);
        ztoolkit?.log?.("AIdea: Lazy project discovery succeeded:", discovered);
      }
    } catch (err) {
      ztoolkit?.log?.("AIdea: Lazy project discovery failed:", err);
    }
  }
  if (!geminiProjectId) {
    throw new Error(
      "Gemini OAuth: no GCP project ID found. Try:\n" +
        "1. Remove Auth → OAuth Login (re-authorize)\n" +
        "2. Or install gcloud CLI and run: gcloud config set project YOUR_PROJECT_ID\n" +
        "3. Or set env var GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID",
    );
  }
  const geminiPayload = buildGeminiCodeAssistRequestPayload({
    model: params.model,
    prompt: params.prompt,
    projectId: geminiProjectId,
    context: params.context,
    history: params.history,
    systemPrompt: params.systemPrompt,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  });
  const geminiRequest =
    typeof geminiPayload.request === "object" && geminiPayload.request
      ? (geminiPayload.request as Record<string, unknown>)
      : {};
  const geminiGenerationConfig =
    typeof geminiRequest.generationConfig === "object" &&
    geminiRequest.generationConfig
      ? (geminiRequest.generationConfig as Record<string, unknown>)
      : {};
  logOAuthRequestParameterPolicy({
    provider: params.provider,
    model: params.model,
    endpointType: "gemini-code-assist",
    payload: geminiPayload,
    parameterSource: getOAuthOptionalParameterSource({
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    }),
    temperatureSent: Object.prototype.hasOwnProperty.call(
      geminiGenerationConfig,
      "temperature",
    ),
    tokenParam: Object.prototype.hasOwnProperty.call(
      geminiGenerationConfig,
      "maxOutputTokens",
    )
      ? {
          field: "generationConfig.maxOutputTokens",
          value: geminiGenerationConfig.maxOutputTokens,
        }
      : undefined,
  });

  // Helper to execute the Gemini streaming request with a given credential
  const executeGeminiRequest = async (activeCred: OAuthCredential) => {
    return fetchWithTransientRetry(
      getFetch(),
      GEMINI_CODE_ASSIST_STREAM_URL,
      {
        method: "POST",
        headers: buildGeminiCodeAssistHeaders(activeCred, params.model),
        body: JSON.stringify(geminiPayload),
        signal: params.signal,
      },
      {
        signal: params.signal,
        onRetry: ({ attempt, maxAttempts, error }) => {
          ztoolkit?.log?.(
            `AIdea: Gemini OAuth transient upstream error, retry ${attempt}/${maxAttempts - 1}`,
            error,
          );
        },
      },
    );
  };

  let res = await executeGeminiRequest(cred);

  // Retry on 401: refresh token and try once more
  if (res.status === 401 && cred.refreshToken) {
    ztoolkit?.log?.(
      "AIdea: Gemini 401 — attempting token refresh and retry...",
    );
    const refreshed = await refreshGeminiAccessToken(cred);
    if (refreshed) {
      res = await executeGeminiRequest(refreshed);
    }
  }

  if (!res.ok) {
    throw new Error(`Gemini OAuth HTTP ${res.status}: ${await res.text()}`);
  }
  if (res.body) {
    const streamed = await parseGeminiSSEStream(res.body, params.onDelta);
    return streamed;
  }
  const raw = await res.text();
  const streamed = await parseGeminiSSEText(raw, params.onDelta);
  if (streamed) return streamed;
  return "";
}

export async function callProviderEmbeddingsUnsupported(): Promise<never> {
  throw new Error(
    "OAuth-only mode does not provide embeddings. AIdea falls back to BM25 retrieval.",
  );
}

/**
 * Resolve the API base URL and auth headers for an OAuth provider,
 * suitable for a /chat/completions ping request.
 * Returns null if the provider doesn't support standard chat/completions
 * (e.g. openai-codex uses a non-standard backend-api).
 */
export async function getOAuthProviderPingInfo(
  provider: OAuthProviderId,
): Promise<{
  apiBase: string;
  headers: Record<string, string>;
  projectId?: string;
} | null> {
  const cred = await readProviderOAuthCredential(provider);
  if (!cred?.accessToken) return null;

  if (provider === "openai-codex") {
    // Codex uses chatgpt.com/backend-api/codex/responses — not /chat/completions.
    // We'll test via the usage endpoint instead.
    return {
      apiBase: "https://chatgpt.com/backend-api",
      headers: {
        ...ensureProviderAuthHeaderInit(cred),
        "Content-Type": "application/json",
      },
    };
  }

  if (provider === "google-gemini-cli") {
    // Gemini CLI uses Code Assist streaming API.
    // Return credential info so the caller can use pingGeminiModel.
    const projectId = cred.projectId || "";
    return {
      apiBase: GEMINI_CODE_ASSIST_API_BASE,
      headers: buildGeminiCodeAssistHeaders(cred, "gemini-2.5-flash"),
      projectId,
    };
  }

  if (provider === "github-copilot") {
    const result = await ensureCopilotApiToken();
    if (!result) return null;
    return {
      apiBase: `${result.baseUrl}`,
      headers: {
        Authorization: `Bearer ${result.token}`,
        "Content-Type": "application/json",
        ...buildCopilotDynamicHeaders(),
      },
    };
  }

  return null;
}

/**
 * Ping a model to test its availability.
 * Sends a minimal 1-token chat completion request.
 * Returns "ok" if the server recognises the model (any response except 404),
 * "fail" on 404 / network error / timeout.
 */
export async function pingModel(
  apiBase: string,
  apiKey: string,
  modelId: string,
  extraHeaders?: Record<string, string>,
): Promise<"ok" | "fail"> {
  const base = apiBase.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    ...(extraHeaders || {}),
  };
  const body = JSON.stringify({
    model: modelId,
    messages: [{ role: "user", content: "hi" }],
    max_tokens: 1,
    stream: false,
  });

  try {
    const fetchPromise = getFetch()(url, {
      method: "POST",
      headers,
      body,
    });
    const timeoutPromise = new Promise<Response>((_resolve, reject) =>
      setTimeout(() => reject(new Error("ping timeout")), 15_000),
    );
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    // 404 = model does not exist; anything else = server recognises the model
    if (res.status === 404) return "fail";
    // Also check response body for "model_not_found" style errors
    if (res.status >= 400) {
      try {
        const text = await res.text();
        if (/model.*not.*found|does not exist|invalid.*model/i.test(text)) {
          return "fail";
        }
      } catch {
        /* ignore body parse errors */
      }
    }
    return "ok";
  } catch {
    return "fail";
  }
}

/**
 * Ping a Codex model by hitting the usage endpoint (since Codex
 * doesn't support standard /chat/completions).
 * Returns "ok" if the token is valid, "fail" otherwise.
 */
export async function pingCodexModel(
  headers: Record<string, string>,
): Promise<"ok" | "fail"> {
  const runPing = async (requestHeaders: Record<string, string>) => {
    const fetchPromise = getFetch()(
      "https://chatgpt.com/backend-api/wham/usage",
      {
        method: "GET",
        headers: requestHeaders,
      },
    );
    const timeoutPromise = new Promise<Response>((_resolve, reject) =>
      setTimeout(() => reject(new Error("ping timeout")), 15_000),
    );
    return Promise.race([fetchPromise, timeoutPromise]);
  };

  try {
    let res = await runPing(headers);
    if (res.status === 401 || res.status === 403) {
      const refreshed = await refreshCodexOAuthCredentialViaCli();
      if (refreshed?.accessToken) {
        const retryHeaders: Record<string, string> = {
          ...headers,
          ...ensureProviderAuthHeaderInit(refreshed),
        };
        res = await runPing(retryHeaders);
      }
    }
    // Any non-network response means token is at least partially valid
    return res.status !== 401 && res.status !== 403 ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

/**
 * Ping the Gemini Code Assist API to validate the OAuth token.
 * Sends a minimal streamGenerateContent request with a tiny prompt.
 * All Gemini models share the same token, so one ping validates all.
 * Returns "ok" if the token is valid, "fail" otherwise.
 */
export async function pingGeminiModel(
  headers: Record<string, string>,
  projectId: string,
): Promise<"ok" | "fail"> {
  try {
    const payload = buildGeminiCodeAssistRequestPayload({
      model: "gemini-2.5-flash",
      prompt: "hi",
      projectId,
    });
    const fetchPromise = getFetch()(GEMINI_CODE_ASSIST_STREAM_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const timeoutPromise = new Promise<Response>((_resolve, reject) =>
      setTimeout(() => reject(new Error("ping timeout")), 15_000),
    );
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    return res.status !== 401 && res.status !== 403 ? "ok" : "fail";
  } catch {
    return "fail";
  }
}
