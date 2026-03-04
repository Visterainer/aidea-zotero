import { runShellCommand, currentPlatform } from "./processRunner";

declare const Zotero: any;
declare const ztoolkit: any;
declare const Cc: any;
declare const Ci: any;

export type OAuthProviderId = "openai-codex" | "google-gemini-cli";

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
};

export type ProviderAccountSummary = {
  provider: OAuthProviderId;
  label: string;
  account: string;
  status: string;
};

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

      // Parse proxy string — can be "host:port" or "http=host:port;https=host:port"
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

function joinPath(...parts: string[]): string {
  const win = currentPlatform() === "windows";
  const sep = win ? "\\" : "/";
  return parts
    .filter(Boolean)
    .map((part, idx) => {
      if (idx === 0) return part.replace(/[\\/]+$/g, "");
      return part.replace(/^[\\/]+|[\\/]+$/g, "");
    })
    .join(sep);
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
  return provider === "openai-codex" ? "ChatGPT (Codex OAuth)" : "Gemini (Gemini CLI OAuth)";
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

export async function readProviderOAuthCredential(
  provider: OAuthProviderId,
): Promise<OAuthCredential | null> {
  return provider === "openai-codex"
    ? readCodexOAuthCredential()
    : readGeminiOAuthCredential();
}

function ensureProviderAuthHeaderInit(cred: OAuthCredential): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cred.accessToken}`,
  };
  if (cred.provider === "google-gemini-cli" && cred.projectId) {
    headers["x-goog-user-project"] = cred.projectId;
  }
  return headers;
}

/**
 * Known Codex-compatible models.  The Codex OAuth token is a ChatGPT session
 * token that works with chatgpt.com/backend-api endpoints — it cannot query
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

    // ---------- Google Gemini CLI ----------
    // Try dynamic discovery first; fall back to static list on failure.
    const res = await getFetch()("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", {
      method: "GET",
      headers: ensureProviderAuthHeaderInit(cred),
    });
    if (!res.ok) {
      ztoolkit?.log?.("AIdea: Gemini model list HTTP", res.status, "- using static fallback");
      return [...GEMINI_CLI_KNOWN_MODELS];
    }
    const data = (await res.json()) as {
      models?: Array<{
        name?: string;
        displayName?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    const rows = (data.models || [])
      .filter((m) => Array.isArray(m.supportedGenerationMethods)
        ? m.supportedGenerationMethods.some((x) => /generatecontent/i.test(String(x)))
        : true)
      .map((m) => {
        const rawName = String(m.name || "").trim();
        const id = rawName.replace(/^models\//, "");
        return {
          id,
          label: String(m.displayName || id || rawName).trim() || id,
        };
      })
      .filter((m) => m.id);
    return rows.length ? dedupeModels(rows) : [...GEMINI_CLI_KNOWN_MODELS];
  } catch (err) {
    ztoolkit?.log?.("AIdea: fetchAvailableModels failed", provider, err);
    // Return static fallback for Gemini on error
    if (provider === "google-gemini-cli") {
      return [...GEMINI_CLI_KNOWN_MODELS];
    }
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

export async function runProviderOAuthLogin(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  const candidates =
    provider === "openai-codex"
      ? ["codex login"]
      : ["gemini auth login", "gemini login"];
  let last = "";
  for (const command of candidates) {
    try {
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
            `${command} executed. Complete browser authorization, then refresh model list/status.`,
        };
      }
    } catch (err) {
      last = String(err);
    }
  }
  return {
    ok: false,
    message:
      last ||
      `Failed to execute ${provider === "openai-codex" ? "codex login" : "gemini auth login"}`,
  };
}

export async function removeProviderOAuthCredential(
  provider: OAuthProviderId,
): Promise<{ ok: boolean; message: string }> {
  const home = homeDir();
  if (!home) return { ok: false, message: "Home directory not found" };
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
      removed > 0
        ? `${getProviderLabel(provider)} authorization removed`
        : `${getProviderLabel(provider)} authorization file not found`,
  };
}
export async function autoConfigureEnvironment(params?: {
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

  let npmReady = false;
  try {
    report?.({ phase: "start", step: "Check npm" });
    const npmCheck = await runShellCommand("npm --version", { hidden: true });
    const npmOut = [npmCheck.stdout, npmCheck.stderr].filter(Boolean).join("\n");
    append("npm --version", npmOut);
    npmReady = npmCheck.code === 0;
    report?.({ phase: "done", step: "Check npm", ok: npmReady, output: npmOut });
  } catch (err) {
    const msg = String(err);
    append("npm --version", msg);
    report?.({ phase: "done", step: "Check npm", ok: false, output: msg });
  }

  if (!npmReady) {
    report?.({
      phase: "info",
      step: "npm not found",
      output: "Please install Node.js/npm manually, then retry Auto Configure.",
    });
    return {
      ok: false,
      logs:
        logs.join("\n\n") +
        "\n\nnpm not found. To avoid hanging inside Zotero, automatic Node.js installation is skipped.",
    };
  }

  const installCmds = [
    "npm install -g @google/gemini-cli",
    "npm i -g @openai/codex",
  ];
  let allOk = true;
  for (const cmd of installCmds) {
    report?.({ phase: "start", step: cmd });
    const result = await runShellCommand(cmd, { hidden: true });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    append(cmd, output);
    report?.({ phase: "done", step: cmd, ok: result.code === 0, output });
    if (result.code !== 0) allOk = false;
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

  // Gemini
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
  } else {
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
 * Only user/assistant messages go here — system prompt goes in `instructions`.
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
          const parts = (parsed?.candidates || [])
            .flatMap((c: any) =>
              Array.isArray(c?.content?.parts) ? c.content.parts : [],
            )
            .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
            .filter(Boolean);
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
    // Stream SSE — read body incrementally, call onDelta per chunk
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

  // ---------- Google Gemini CLI (Streaming) ----------
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

  const geminiPayload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userParts.join("\n\n") }] }],
  };
  if (typeof params.temperature === "number" && Number.isFinite(params.temperature)) {
    geminiPayload.generationConfig = { temperature: params.temperature };
  }
  const modelId = params.model.replace(/^models\//, "");
  // Use streamGenerateContent for true streaming
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`;
  const res = await getFetch()(geminiUrl, {
    method: "POST",
    headers: {
      ...ensureProviderAuthHeaderInit(cred),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(geminiPayload),
    signal: params.signal,
  });
  if (!res.ok) {
    throw new Error(`Gemini OAuth HTTP ${res.status}: ${await res.text()}`);
  }
  // Stream SSE — read body incrementally
  if (res.body) {
    return parseGeminiSSEStream(res.body, params.onDelta);
  }
  // Fallback: non-streaming (if ReadableStream not available)
  const data = (await res.json()) as any;
  const text = (data?.candidates || [])
    .flatMap((c: any) => (Array.isArray(c?.content?.parts) ? c.content.parts : []))
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
  const result = text || JSON.stringify(data);
  params.onDelta?.(result);
  return result;
}

export async function callProviderEmbeddingsUnsupported(): Promise<never> {
  throw new Error(
    "OAuth-only mode does not provide embeddings. zoteroAI falls back to BM25 retrieval.",
  );
}
