import { fetchWithTokenPolicy } from "./tokenParameterPolicy";
import {
  runShellCommand,
  currentPlatform,
  escapeShellArg,
} from "./processRunner";
import { fetchWithTransientRetry } from "./transientRetry";
import { formatDocumentContext } from "./llmPrompts";
import { providerContextWindow } from "./modelContextWindow";
import {
  parseCatalogReasoningLevels,
  cacheApiReasoningCatalog,
  normalizeReasoningApiBase,
  setApiReasoningCatalogRefresher,
} from "./reasoningEffort";
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

// Subprocess bounds: a hung child must not leave the UI waiting forever.
const PROBE_TIMEOUT_MS = 30_000;
const INSTALL_TIMEOUT_MS = 15 * 60_000;
const LOGIN_TIMEOUT_MS = 10 * 60_000;

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

export type OAuthProviderId = "openai-codex" | "github-copilot";

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
  contextWindowTokens?: number;
  apiBase?: string;
  apiKey?: string;
  supportedEndpoints?: string[];
  /** Reasoning efforts the provider catalog lists for this model. */
  reasoningLevels?: string[];
  defaultReasoningLevel?: string;
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
};

const PROVIDER_CLI_SPECS: Partial<Record<OAuthProviderId, ProviderCliSpec>> = {
  "openai-codex": {
    packageName: "@openai/codex",
    executableName: "codex",
    versionArg: "--version",
  },
};

export function normalizeVersionText(raw: string | null | undefined): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const match = text.match(/\d+(?:\.\d+){0,3}(?:[-+][A-Za-z0-9._-]+)?/);
  return match ? match[0] : "";
}

/** `codex --version` prints "codex-cli 0.162.1"; warnings may precede it. */
export function parseCodexCliVersion(output: string): string {
  const text = String(output || "");
  const named = text.match(/codex(?:-cli)?\s+v?(\d+\.\d+\.\d+)/i);
  if (named) return named[1];
  const bare = text.match(/(?:^|\s)v?(\d+\.\d+\.\d+)(?:\s|$)/);
  return bare ? bare[1] : "";
}

/** Negative when `a` is older than `b`; 0 when equal or either is unparsable. */
export function compareReleaseVersions(a: string, b: string): number {
  const parse = (value: string) => {
    const match = String(value || "").match(/(\d+)\.(\d+)\.(\d+)/);
    return match ? match.slice(1).map((part) => Number(part)) : null;
  };
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

const CODEX_LATEST_RELEASE_URL =
  "https://releases.openai.com/codex/channels/latest";

/** Latest stable Codex CLI version, or "" when it cannot be determined. */
async function fetchLatestCodexCliVersion(): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await getFetch()(CODEX_LATEST_RELEASE_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return "";
    const json = (await res.json()) as unknown as { tag_name?: unknown };
    const tag = typeof json?.tag_name === "string" ? json.tag_name : "";
    // Pre-release tags carry a suffix (-alpha.1); only offer stable builds.
    const match = tag.match(/^(?:rust-)?v?(\d+\.\d+\.\d+)$/);
    return match ? match[1] : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export function getCodexStandaloneInstallCommand(
  platform: SupportedPlatform,
): string {
  if (platform === "windows") {
    return "$env:CODEX_NON_INTERACTIVE=1; $sys=$env:SystemRoot; $env:Path=(Join-Path $sys 'System32')+';'+$sys+';'+(Join-Path $sys 'System32\\WindowsPowerShell\\v1.0')+';'+$env:Path; irm https://chatgpt.com/codex/install.ps1 | iex";
  }
  // pipefail: without it a failed download still exits 0, because `sh`
  // happily runs an empty script. Stock Debian/Ubuntu ship wget but not
  // curl, so fall back to it.
  return "set -o pipefail; if command -v curl >/dev/null 2>&1; then curl -fsSL --connect-timeout 20 --max-time 600 https://chatgpt.com/codex/install.sh; else wget -q -T 30 -O- https://chatgpt.com/codex/install.sh; fi | CODEX_NON_INTERACTIVE=1 sh";
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

const PROXY_ENV_KEYS = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
];
// What this plugin last exported, so it can be withdrawn again.
let managedProxyEnvUrl = "";

function setProxyEnv(proxyUrl: string, noProxy?: string): void {
  // On Linux the "system proxy" is read from these very variables; copying
  // one of them over the others would destroy a deliberate per-scheme setup.
  if (currentPlatform() === "linux") return;
  for (const key of PROXY_ENV_KEYS) {
    setProcessEnv(key, proxyUrl);
  }
  managedProxyEnvUrl = proxyUrl;
  const bypass = String(noProxy || "").trim();
  if (bypass) {
    setProcessEnv("NO_PROXY", bypass);
    setProcessEnv("no_proxy", bypass);
  }
}

/**
 * The system proxy is gone: withdraw the variables we exported, otherwise
 * the installer, `codex` and the translation engine keep dialling a dead
 * port until Zotero restarts. Variables someone else changed are left alone.
 */
function clearManagedProxyEnv(): void {
  if (!managedProxyEnvUrl) return;
  for (const key of PROXY_ENV_KEYS) {
    if (getEnv(key) === managedProxyEnvUrl) setProcessEnv(key, "");
  }
  managedProxyEnvUrl = "";
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

/**
 * True when Zotero is still on the manual proxy this plugin applied but the
 * system no longer has one, so the manual setting should be released.
 */
export function shouldReleaseManagedProxy(params: {
  currentType: number;
  currentSignature: string;
  autoApplied: boolean;
  lastSignature: string;
}): boolean {
  return (
    params.autoApplied &&
    params.currentType === 1 &&
    Boolean(params.lastSignature) &&
    params.currentSignature === params.lastSignature
  );
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

/**
 * The system proxy is gone (e.g. the proxy app was quit). If Zotero is still
 * pinned to the manual proxy we applied, hand control back to "use system
 * proxy settings"; otherwise all Zotero networking keeps hitting a dead port.
 * A proxy the user configured or edited themselves is never touched.
 */
function releaseManagedProxyFromZotero(prefSvc: any): boolean {
  try {
    const current = getZoteroProxySnapshot(prefSvc);
    if (
      !shouldReleaseManagedProxy({
        currentType: current.type,
        currentSignature: getSystemProxySignature(current),
        autoApplied: getPluginBooleanPref(PROXY_AUTO_APPLIED_PREF),
        lastSignature: getPluginStringPref(PROXY_LAST_SIGNATURE_PREF),
      })
    ) {
      return false;
    }
    prefSvc.setIntPref("network.proxy.type", 5);
    setPluginStringPref(PROXY_AUTO_APPLIED_PREF, "false");
    setPluginStringPref(PROXY_LAST_SIGNATURE_PREF, "");
    setPluginStringPref(PROXY_LAST_MODE_PREF, "");
    return true;
  } catch {
    return false;
  }
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
    const result = await runShellCommand("scutil --proxy", {
      hidden: true,
      timeoutMs: PROBE_TIMEOUT_MS,
    });
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
    if (!proxy) clearManagedProxyEnv();
    if (!proxy && releaseManagedProxyFromZotero(prefSvc)) {
      ztoolkit?.log?.(
        "AIdea: System proxy is gone; released the managed Zotero proxy",
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
    const result = await runShellCommand(command, {
      hidden: true,
      timeoutMs: PROBE_TIMEOUT_MS,
    });
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
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<{
  code: number;
  stdout: string;
  stderr: string;
  output: string;
}> {
  const result = await runShellCommand(
    buildExecutableCommand(executablePath, args),
    { hidden: true, timeoutMs },
  );
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join("\n")
    .trim();
  return { ...result, output };
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

async function tryInstallCodexStandalone(
  report: ReportFn,
  append: AppendFn,
): Promise<boolean> {
  const platform = currentPlatform();
  const installStep = "Install Codex CLI (standalone)";
  const command = getCodexStandaloneInstallCommand(platform);
  report?.({ phase: "start", step: installStep });
  const result = await runShellCommand(command, {
    hidden: true,
    timeoutMs: INSTALL_TIMEOUT_MS,
  });
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

/**
 * The CLI we spawn inherits CODEX_HOME and writes auth.json there, so the
 * plugin has to look in the same place instead of assuming ~/.codex.
 */
export function resolveCodexHomeDir(codexHome: string, home: string): string {
  const explicit = String(codexHome || "").trim();
  if (explicit) return explicit;
  return home ? joinPath(home, ".codex") : "";
}

function codexAuthFilePath(): string {
  const dir = resolveCodexHomeDir(getEnv("CODEX_HOME"), homeDir());
  return dir ? joinPath(dir, "auth.json") : "";
}

export async function readCodexOAuthCredential(): Promise<OAuthCredential | null> {
  const authPath = codexAuthFilePath();
  if (!authPath) return null;
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
      { hidden: true, timeoutMs: PROBE_TIMEOUT_MS },
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

async function postCopilotRequest(params: {
  url: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<Response> {
  const res = await fetchWithTokenPolicy(
    {
      provider: "github-copilot",
      url: params.url,
      model: String(params.payload.model || ""),
    },
    params.payload,
    (payload) =>
      fetchWithTransientRetry(
        getFetch(),
        params.url,
        {
          method: "POST",
          headers: params.headers,
          body: JSON.stringify(payload),
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
      ),
    params.signal,
  );
  if (res.ok) return res;
  const errText = await res.text();
  throw new Error(`Copilot OAuth HTTP ${res.status}: ${errText}`);
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

async function ensureCopilotApiToken(
  // A caller that cannot refresh the token later (a long translation job
  // freezes it into the task) can ask for more remaining lifetime.
  minRemainingMs = 5 * 60 * 1000,
): Promise<{
  token: string;
  baseUrl: string;
} | null> {
  const githubToken = getCopilotGithubToken();
  if (!githubToken) return null;
  const cached = getCopilotApiTokenCache();
  if (cached && cached.expiresAt - Date.now() > minRemainingMs) {
    return {
      token: cached.token,
      baseUrl: deriveCopilotApiBaseUrl(cached.token),
    };
  }
  try {
    return await exchangeCopilotToken(githubToken);
  } catch (err) {
    // A longer lifetime was requested but the exchange failed (offline blip).
    // A cached token that is still comfortably valid beats failing outright.
    if (cached && cached.expiresAt - Date.now() > 5 * 60 * 1000) {
      return {
        token: cached.token,
        baseUrl: deriveCopilotApiBaseUrl(cached.token),
      };
    }
    throw err;
  }
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

  for (const provider of targetProviders) {
    const spec = getProviderCliSpec(provider);
    if (!spec) continue;

    const baseResult: OAuthCliEnvironmentUpdateCheck = {
      provider,
      needsUpdate: false,
      reason: "current",
    };

    // Codex is the only CLI-backed provider; it is verified in the standalone
    // install directories so an old npm copy on PATH is not mistaken for it.
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
    const installedVersion =
      parseCodexCliVersion(verification.output) ||
      normalizeVersionText(verification.output);
    baseResult.installedVersion = installedVersion || undefined;
    // A CLI that still runs can be many releases behind. Compare with the
    // published channel; when that is unreachable, report "current" rather
    // than nagging the user while offline.
    const latestVersion = await fetchLatestCodexCliVersion();
    if (latestVersion) baseResult.latestVersion = latestVersion;
    if (
      latestVersion &&
      installedVersion &&
      compareReleaseVersions(installedVersion, latestVersion) < 0
    ) {
      results.push({
        ...baseResult,
        needsUpdate: true,
        reason: `${spec.executableName} ${installedVersion} is older than ${latestVersion}`,
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

export function parseCodexModelsResponse(data: unknown): ProviderModelOption[] {
  const models = Array.isArray(data) ? data : (data as any)?.models;
  if (!Array.isArray(models)) return [];
  return models
    .filter((m) => m && typeof m === "object")
    .map((m: any) => {
      const id = String(m.id || m.slug || m.model_id || "").trim();
      const label =
        String(m.name || m.title || m.display_name || id).trim() || id;
      const reasoningLevels = parseCatalogReasoningLevels(
        m.supported_reasoning_levels,
      );
      const defaultReasoningLevel = String(m.default_reasoning_level || "")
        .trim()
        .toLowerCase();
      return {
        id,
        label,
        contextWindowTokens: providerContextWindow(
          m.context_window,
          m.effective_context_window_percent,
        ),
        ...(Array.isArray(m.supported_reasoning_levels)
          ? { reasoningLevels: reasoningLevels || [] }
          : {}),
        ...(reasoningLevels && defaultReasoningLevel
          ? { defaultReasoningLevel }
          : {}),
      };
    })
    .filter((m) => m.id);
}

export type ModelListFailure = "not-logged-in" | "network" | "rejected";

export interface ModelListResult {
  models: ProviderModelOption[];
  /** Why the list is empty; absent when models were returned. */
  failure?: ModelListFailure;
  /** The underlying error text, for the log. */
  detail?: string;
}

export async function fetchAvailableModels(
  provider: OAuthProviderId,
): Promise<ProviderModelOption[]> {
  return (await fetchAvailableModelsDetailed(provider)).models;
}

/**
 * Like fetchAvailableModels, but says why nothing came back. An empty list
 * alone cannot tell "not signed in" from "Zotero cannot reach the provider"
 * from "the session was rejected", and the UI used to report all three as
 * a successful refresh with 0 models.
 */
export async function fetchAvailableModelsDetailed(
  provider: OAuthProviderId,
): Promise<ModelListResult> {
  let failure: ModelListFailure | undefined;
  let detail = "";
  const models = await fetchAvailableModelsWithReason(provider, (f, d) => {
    failure = f;
    detail = d || "";
  });
  if (models.length) return { models };
  return { models, failure: failure || "rejected", detail };
}

async function fetchAvailableModelsWithReason(
  provider: OAuthProviderId,
  report: (failure: ModelListFailure, detail?: string) => void,
): Promise<ProviderModelOption[]> {
  await ensureZoteroProxyFromSystem({ forceRefresh: true });
  const cred = await readProviderOAuthCredential(provider);
  if (!cred) {
    report("not-logged-in");
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
          const rows = parseCodexModelsResponse(await res.json());
          if (rows.length > 0) {
            ztoolkit?.log?.(
              `AIdea: Codex dynamic models: ${rows.map((r) => r.id).join(", ")}`,
            );
            return dedupeModels(rows);
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
        lastRejectionStatus = usageRes.status;
        return usageRes.status !== 401 && usageRes.status !== 403;
      };
      // 401 means the session expired; 403 is usually the service refusing
      // the network location (region or proxy exit), which a new login
      // cannot fix. The UI needs to tell these apart.
      let lastRejectionStatus = 0;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const headers = buildHeaders(activeCred);
        let requestsFailed = 0;
        let lastError = "";
        try {
          const rows = await fetchDynamicModels(headers);
          if (rows.length > 0) {
            return rows;
          }
        } catch (err) {
          requestsFailed += 1;
          lastError = err instanceof Error ? err.message : String(err);
          ztoolkit?.log?.("AIdea: Codex dynamic model fetch failed", err);
        }

        try {
          if (await validateToken(headers)) {
            return [...CODEX_KNOWN_MODELS];
          }
        } catch (err) {
          requestsFailed += 1;
          lastError = err instanceof Error ? err.message : String(err);
          ztoolkit?.log?.("AIdea: Codex token validation failed", err);
        }

        if (requestsFailed === 2) {
          // Neither request got an answer: Zotero cannot reach the service.
          // Refreshing the token through the CLI would not change that.
          report("network", lastError);
          return [];
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
        report(
          "rejected",
          lastRejectionStatus ? `HTTP ${lastRejectionStatus}` : "",
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

    return [];
  } catch (err) {
    ztoolkit?.log?.("AIdea: fetchAvailableModels failed", provider, err);

    if (provider === "github-copilot") return [...COPILOT_KNOWN_MODELS];
    return [];
  }
}

export function dedupeModels(
  models: ProviderModelOption[],
): ProviderModelOption[] {
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
    if (row.contextWindowTokens !== undefined)
      option.contextWindowTokens = row.contextWindowTokens;
    if (Array.isArray(row.reasoningLevels))
      option.reasoningLevels = [...row.reasoningLevels];
    if (row.defaultReasoningLevel !== undefined)
      option.defaultReasoningLevel = row.defaultReasoningLevel;
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
  const base = normalizeReasoningApiBase(apiBase);
  if (!base) return [];
  const modelsUrl = new URL(base);
  modelsUrl.pathname = modelsUrl.pathname.replace(/\/+$/, "") + "/models";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  try {
    const res = await getFetch()(modelsUrl.toString(), {
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
    cacheApiReasoningCatalog(apiBase, apiKey || "", entries);
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

setApiReasoningCatalogRefresher((apiBase, apiKey) =>
  fetchCustomEndpointModels(apiBase, apiKey).catch(() => undefined),
);

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
    let pollIntervalSec = interval;
    let consecutivePollFailures = 0;
    const loginGeneration = ++copilotLoginGeneration;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalSec * 1000));
      if (loginGeneration !== copilotLoginGeneration) {
        throw new Error("Superseded by a newer login attempt");
      }
      const tokenBody = new URLSearchParams({
        client_id: COPILOT_GITHUB_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      });
      // The user may spend minutes in the browser; one dropped request or a
      // proxy switch during that time must not cancel the whole login.
      let tokenJson: Record<string, unknown>;
      try {
        const tokenRes = await getFetch()(GITHUB_ACCESS_TOKEN_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: tokenBody,
        });
        if (!tokenRes.ok) {
          throw new Error(
            `GitHub token request failed: HTTP ${tokenRes.status}`,
          );
        }
        tokenJson = (await tokenRes.json()) as unknown as Record<
          string,
          unknown
        >;
        consecutivePollFailures = 0;
      } catch (pollErr) {
        consecutivePollFailures += 1;
        if (consecutivePollFailures >= 5) throw pollErr;
        continue;
      }
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
        // RFC 8628: the longer interval applies to every later poll.
        const serverInterval = Number(tokenJson.interval);
        pollIntervalSec =
          Number.isFinite(serverInterval) && serverInterval > pollIntervalSec
            ? serverInterval
            : pollIntervalSec + 5;
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

let copilotLoginGeneration = 0;

const loginInFlight = new Map<
  OAuthProviderId,
  Promise<{ ok: boolean; message: string }>
>();

/** Concurrent calls for one provider share a single login flow. */
export function runProviderOAuthLogin(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  // Copilot's device flow can be restarted (the user lost the code or
  // closed the tab); the superseded poll loop stops by itself. Codex login
  // holds a local callback port, so its flow is shared instead.
  if (provider === "github-copilot") {
    return runProviderOAuthLoginOnce(provider);
  }
  const running = loginInFlight.get(provider);
  if (running) return running;
  const flow = runProviderOAuthLoginOnce(provider).finally(() => {
    loginInFlight.delete(provider);
  });
  loginInFlight.set(provider, flow);
  return flow;
}

async function runProviderOAuthLoginOnce(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  await ensureZoteroProxyFromSystem({ forceRefresh: true });
  // Qwen and Copilot use in-plugin Device Code flows

  if (provider === "github-copilot") return loginCopilotDeviceCode();

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
    // Bounded: a browser authorization the user abandoned never calls back.
    const result = await runShellCommand(command, {
      hidden: true,
      timeoutMs: LOGIN_TIMEOUT_MS,
    });
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
  const authPath = codexAuthFilePath();
  if (!authPath) return { ok: false, message: "Home directory not found" };
  const removed = removeFileIfExists(authPath);
  return {
    ok: true,
    message: removed
      ? `${getProviderLabel(provider)} authorization removed`
      : `${getProviderLabel(provider)} authorization file not found`,
  };
}

type AutoConfigureEnvironmentParams = {
  /** Limit the install/update to this provider's CLI; omitted means all. */
  provider?: OAuthProviderId;
  onProgress?: (event: {
    phase: "start" | "done" | "info";
    step: string;
    ok?: boolean;
    output?: string;
  }) => void;
};

const autoConfigureInFlight = new Map<
  string,
  Promise<{ ok: boolean; logs: string }>
>();

/**
 * Concurrent calls for the same install target (a double click, or the
 * scheduler firing during a manual run) share the one running install, so two
 * installers never write the same binary. Only the first caller's onProgress
 * receives events.
 */
export function autoConfigureEnvironment(
  params?: AutoConfigureEnvironmentParams,
): Promise<{ ok: boolean; logs: string }> {
  const target = (
    params?.provider ? [params.provider] : getOAuthCliProviders()
  ).join(",");
  const running = autoConfigureInFlight.get(target);
  if (running) return running;
  const flow = autoConfigureEnvironmentOnce(params).finally(() => {
    autoConfigureInFlight.delete(target);
  });
  autoConfigureInFlight.set(target, flow);
  return flow;
}

async function autoConfigureEnvironmentOnce(
  params?: AutoConfigureEnvironmentParams,
): Promise<{ ok: boolean; logs: string }> {
  const logs: string[] = [];
  const append = (title: string, text: string) => {
    const body = String(text || "").trim();
    logs.push(`## ${title}\n${body || "(no output)"}`);
  };
  const report = params?.onProgress;
  const platform = currentPlatform();
  const targetProviders = params?.provider
    ? [params.provider]
    : getOAuthCliProviders();
  let allOk = true;
  report?.({
    phase: "info",
    step: "Detected platform",
    output: platform,
  });
  append("Detected platform", platform);
  await ensureZoteroProxyFromSystem({ forceRefresh: true });

  // Codex ships a standalone installer; no provider needs Node.js or npm.
  if (targetProviders.includes("openai-codex")) {
    const codexOk = await tryInstallCodexStandalone(report, append);
    if (codexOk) {
      recordOAuthEnvUpdateSuccess("openai-codex");
    } else {
      allOk = false;
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

  // Copilot: generic status with optional expiry
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
    const home = codexAuthFilePath();
    if (home) {
      const data = await readJsonFile(home);
      const email = data?.user?.email || data?.tokens?.email || data?.email;
      account =
        typeof email === "string" && email.trim()
          ? email.trim()
          : cred.accountId || "ChatGPT OAuth";
    } else {
      account = cred.accountId || "ChatGPT OAuth";
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
      role: "user",
      content: formatDocumentContext(params.context),
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

  // Reference data, without fabricating an assistant acknowledgement.
  if (params.context?.trim()) {
    input.push({
      role: "user",
      content: [
        {
          type: "input_text",
          text: formatDocumentContext(params.context),
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

export function isCodexReasoningRejection(
  status: number,
  errorText: string,
): boolean {
  return (
    (status === 400 || status === 422) && /reasoning|effort/i.test(errorText)
  );
}

/**
 * Build the top-level `instructions` string for the Codex backend.
 * The chatgpt.com/backend-api/codex/responses endpoint requires `instructions`
 * as a separate string field (not inside the input array).
 */
function buildCodexInstructions(params: { systemPrompt?: string }): string {
  const parts: string[] = [];
  if (params.systemPrompt?.trim()) {
    parts.push(params.systemPrompt.trim());
  } else {
    parts.push("You are a helpful AI assistant.");
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
  context?: string;
  history?: Array<{ role: "user" | "assistant" | "system"; content: any }>;
  images?: string[];
}): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = [];

  if (params.context?.trim()) {
    input.push({
      type: "message",
      role: "user",
      content: [
        { type: "input_text", text: formatDocumentContext(params.context) },
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
      content: formatDocumentContext(params.context),
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
  /** Wire-level reasoning effort; omitted means the model default. */
  reasoningEffort?: string;
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
    if (params.reasoningEffort) {
      payload.reasoning = { effort: params.reasoningEffort };
    }
    logOAuthRequestParameterPolicy({
      provider: params.provider,
      model: params.model,
      endpointType: "codex-responses",
      payload,
      parameterSource: "omitted-provider-default",
    });
    const buildCodexChatHeaders = (
      credential: OAuthCredential,
    ): Record<string, string> => ({
      ...ensureProviderAuthHeaderInit(credential),
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    });
    let codexHeaders = buildCodexChatHeaders(cred);
    const postCodex = () =>
      fetchWithTransientRetry(
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
    let res = await postCodex();
    if (res.status === 401) {
      // Expired token: let the CLI refresh it, then retry exactly once. The
      // rejected response carries no answer, so nothing has been streamed.
      // Resending the very same token cannot succeed, so only retry when the
      // stored credential actually changed.
      const refreshed = await refreshCodexOAuthCredentialViaCli();
      if (
        refreshed?.accessToken &&
        refreshed.accessToken !== cred.accessToken &&
        !params.signal?.aborted
      ) {
        try {
          await res.body?.cancel();
        } catch {
          /* the rejected body is discarded either way */
        }
        codexHeaders = buildCodexChatHeaders(refreshed);
        res = await postCodex();
      }
    }
    if (!res.ok && payload.reasoning) {
      const errorText = await res.text();
      if (!isCodexReasoningRejection(res.status, errorText)) {
        throw new Error(`Codex OAuth HTTP ${res.status}: ${errorText}`);
      }
      // A rejected effort must not block the answer: retry on the model default.
      ztoolkit?.log?.(
        `AIdea: Codex rejected reasoning effort ${params.reasoningEffort}; retrying with the model default`,
      );
      delete payload.reasoning;
      res = await postCodex();
    }
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
      const res = await postCopilotRequest({
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
      const res = await postCopilotRequest({
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
    const res = await postCopilotRequest({
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

  throw new Error(
    `${getProviderLabel(params.provider)} is not a supported OAuth chat provider`,
  );
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
  options?: { minRemainingMs?: number },
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

  if (provider === "github-copilot") {
    const result = await ensureCopilotApiToken(options?.minRemainingMs);
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
 * Returns "ok" if the server recognises the model,
 * "fail" on 404 / rejected credentials (401, 403) / network error / timeout.
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
  const body = {
    model: modelId,
    messages: [{ role: "user", content: "hi" }],
    max_tokens: 1,
    stream: false,
  };

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const fetchPromise = fetchWithTokenPolicy(
      { provider: "model-probe", url, model: modelId },
      body,
      (payload) =>
        getFetch()(url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        }),
      controller.signal,
    );
    const timeoutPromise = new Promise<Response>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("ping timeout"));
      }, 15_000);
    });
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    // 404 = model does not exist; 401/403 = the credentials were rejected,
    // so nothing was learned about the model and it must not show as usable.
    if (res.status === 404 || res.status === 401 || res.status === 403) {
      return "fail";
    }
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
  } finally {
    if (timer !== undefined) clearTimeout(timer);
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
