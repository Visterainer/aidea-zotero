/* ---------------------------------------------------------------------------
 * pdfTranslator/modelResolver.ts  –  Resolve model → API credentials
 *
 * Maps a selected model name to the OAuth token / API key and endpoint URL
 * required by pdf2zh_next's OpenAI-compatible backend.
 * -------------------------------------------------------------------------*/

import {
  getModelChoices,
  type ModelChoice,
} from "../contextPanel/setupHandlers/controllers/modelSelectionController";
import { getApiProfiles } from "../contextPanel/prefHelpers";
import { normalizeModelId } from "../../utils/oauthModelSelection";
import {
  getOAuthProviderPingInfo,
  markerToProvider,
  readProviderOAuthCredential,
  type OAuthProviderId,
} from "../../utils/oauthCli";

/** Credentials needed by the pdf2zh_next translation engine. */
export interface OAuthProxyConfig {
  provider:
    | "openai-codex"
    | "google-gemini-cli"
    | "github-copilot"
    | "openai-compatible";
  accessToken: string;
  accountId?: string;
  projectId?: string;
  apiBase?: string;
  apiKey?: string;
  supportedEndpoints?: string[];
}

export interface TranslateCredentials {
  /** Model identifier, e.g. "gemini-2.5-pro" */
  modelId: string;
  /** API key / OAuth access_token */
  apiKey: string;
  /**
   * API base URL in OpenAI-compatible format.
   * pdf2zh_next expects the base URL that, when appended with
   * `/chat/completions`, reaches the completions endpoint.
   * e.g. "https://generativelanguage.googleapis.com/v1beta/openai"
   */
  apiUrl: string;
  /**
   * Optional one-shot local proxy metadata.
   * When present, bridge.py starts a temporary local adapter and rewrites
   * config.toml to point pdf2zh_next to that adapter.
   */
  oauthProxy?: OAuthProxyConfig;
}

/**
 * Strip terminal `/chat/completions`, `/v1/chat/completions`, `/responses`,
 * etc. from a URL so we have a clean base URL for pdf2zh_next.
 *
 * pdf2zh_next appends its own path internally, so we only need the base.
 */
function normalizeApiBaseUrl(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, "");
  // Remove trailing endpoint paths
  cleaned = cleaned.replace(/\/chat\/completions$/, "");
  cleaned = cleaned.replace(/\/responses$/, "");
  cleaned = cleaned.replace(/\/embeddings$/, "");
  // Ensure trailing /v1 or /v1beta is preserved (pdf2zh_next needs it)
  return cleaned;
}

const OAUTH_LABEL_TO_PROVIDER: Record<string, OAuthProviderId> = {
  codex: "openai-codex",
  gemini: "google-gemini-cli",
  copilot: "github-copilot",
};

const KNOWN_OAUTH_PROVIDERS = new Set<OAuthProviderId>([
  "openai-codex",
  "google-gemini-cli",
  "github-copilot",
]);

function getStringPref(key: string): string {
  try {
    const value = Zotero.Prefs.get(`${addon.data.config.prefsPrefix}.${key}`, true);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

type CachedOAuthModelRow = {
  id: string;
  apiBase?: string;
  apiKey?: string;
  supportedEndpoints?: string[];
};

function parseOAuthModelCache():
  Partial<Record<OAuthProviderId, CachedOAuthModelRow[]>> {
  const raw = getStringPref("oauthModelListCache").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<Record<OAuthProviderId, CachedOAuthModelRow[]>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function providerFromLabel(providerLabel?: string): OAuthProviderId | null {
  const normalized = String(providerLabel || "").trim().toLowerCase();
  if (!normalized) return null;
  return OAUTH_LABEL_TO_PROVIDER[normalized] || null;
}

function providerFromApiBase(apiBase?: string): OAuthProviderId | null {
  return markerToProvider(String(apiBase || "").trim());
}

function inferProviderFromModelName(modelName: string): OAuthProviderId | null {
  const normalized = normalizeModelId(modelName);
  if (!normalized) return null;
  if (normalized.startsWith("gpt-") || normalized.startsWith("o1") || normalized.startsWith("o3")) {
    return "openai-codex";
  }
  if (normalized.startsWith("gemini-")) {
    return "google-gemini-cli";
  }
  if (
    normalized.startsWith("claude-") ||
    normalized.startsWith("deepseek-") ||
    normalized.startsWith("grok-")
  ) {
    return "github-copilot";
  }
  return null;
}

function modelExistsInProviderCache(
  provider: OAuthProviderId,
  modelName: string,
  cache: Partial<Record<OAuthProviderId, CachedOAuthModelRow[]>>,
): boolean {
  const models = cache[provider];
  if (!Array.isArray(models)) return false;
  const normalizedModel = normalizeModelId(modelName);
  return models.some((row) => normalizeModelId(String(row.id || "")) === normalizedModel);
}

function getCachedProviderModel(
  provider: OAuthProviderId,
  modelName: string,
  cache: Partial<Record<OAuthProviderId, CachedOAuthModelRow[]>>,
): CachedOAuthModelRow | null {
  const models = cache[provider];
  if (!Array.isArray(models)) return null;
  const normalizedModel = normalizeModelId(modelName);
  return (
    models.find((row) => normalizeModelId(String(row.id || "")) === normalizedModel) || null
  );
}

function detectOAuthProviderForModel(
  modelName: string,
  providerLabel?: string,
  apiBase?: string,
): OAuthProviderId | null {
  // Highest priority: explicit oauth:// marker on the chosen model entry.
  const byApiBase = providerFromApiBase(apiBase);
  if (byApiBase) return byApiBase;

  const cache = parseOAuthModelCache();
  const byLabel = providerFromLabel(providerLabel);
  if (byLabel && modelExistsInProviderCache(byLabel, modelName, cache)) {
    return byLabel;
  }
  for (const provider of Object.keys(cache) as OAuthProviderId[]) {
    if (!KNOWN_OAUTH_PROVIDERS.has(provider)) continue;
    if (modelExistsInProviderCache(provider, modelName, cache)) {
      return provider;
    }
  }

  // Next: chat tab's persisted provider (same user-level model state).
  const persistedProviderLabel = getStringPref("lastUsedModelProvider");
  const byPersistedLabel = providerFromLabel(persistedProviderLabel);
  if (byPersistedLabel) return byPersistedLabel;

  // Last-resort heuristic by model prefix.
  return byLabel || inferProviderFromModelName(modelName);
}

function extractBearerToken(headers: Record<string, string>): string {
  const auth = String(headers.Authorization || "").trim();
  if (!auth) return "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function resolveOAuthProviderCredentials(
  provider: OAuthProviderId,
  modelId: string,
): Promise<TranslateCredentials | null> {
  const credential = await readProviderOAuthCredential(provider);
  if (!credential?.accessToken) return null;

  // OAuth-backed providers need a short-lived local adapter started by bridge.py.
  // This keeps pdf2zh_next on its fixed /chat/completions client while we
  // translate upstream auth and endpoint requirements per provider/model.
  if (provider === "openai-codex") {
    return {
      modelId,
      apiKey: "aidea-oauth-proxy",
      apiUrl: "http://127.0.0.1:1/v1",
      oauthProxy: {
        provider,
        accessToken: credential.accessToken,
        accountId: credential.accountId,
      },
    };
  }

  if (provider === "google-gemini-cli") {
    return {
      modelId,
      apiKey: "aidea-oauth-proxy",
      apiUrl: "http://127.0.0.1:1/v1",
      oauthProxy: {
        provider,
        accessToken: credential.accessToken,
        projectId: credential.projectId,
      },
    };
  }

  if (provider === "github-copilot") {
    const pingInfo = await getOAuthProviderPingInfo(provider);
    if (!pingInfo?.apiBase) return null;
    const tokenFromPing = extractBearerToken(pingInfo.headers || {});
    const token = tokenFromPing || credential.accessToken;
    if (!token) return null;
    const cache = parseOAuthModelCache();
    const cachedModel = getCachedProviderModel(provider, modelId, cache);
    return {
      modelId,
      apiKey: "aidea-oauth-proxy",
      apiUrl: "http://127.0.0.1:1/v1",
      oauthProxy: {
        provider,
        accessToken: token,
        apiBase: normalizeApiBaseUrl(pingInfo.apiBase),
        supportedEndpoints: Array.isArray(cachedModel?.supportedEndpoints)
          ? cachedModel?.supportedEndpoints
          : undefined,
      },
    };
  }

  return null;
}

async function resolveFromApiBaseAndKey(
  modelId: string,
  apiBaseRaw?: string,
  apiKeyRaw?: string,
): Promise<TranslateCredentials | null> {
  const apiBase = String(apiBaseRaw || "").trim();
  const apiKey = String(apiKeyRaw || "").trim();
  if (!apiBase) return null;

  const providerFromMarker = markerToProvider(apiBase);
  if (providerFromMarker) {
    return resolveOAuthProviderCredentials(providerFromMarker, modelId);
  }

  return {
    modelId,
    apiKey: "aidea-oauth-proxy",
    apiUrl: "http://127.0.0.1:1/v1",
    oauthProxy: {
      provider: "openai-compatible",
      accessToken: "",
      apiKey,
      apiBase: normalizeApiBaseUrl(apiBase),
    },
  };
}

async function resolveFromProfiles(modelName: string): Promise<TranslateCredentials | null> {
  const profiles = getApiProfiles();
  const normalized = normalizeModelId(modelName);

  // 1) Exact model match on any profile.
  for (const profile of Object.values(profiles)) {
    const profileModel = String(profile.model || "").trim();
    if (!profileModel) continue;
    if (normalizeModelId(profileModel) !== normalized) continue;
    const creds = await resolveFromApiBaseAndKey(profileModel, profile.apiBase, profile.apiKey);
    if (creds) return creds;
  }

  // 2) Fallback to primary profile when it has explicit API base.
  const primary = profiles.primary;
  if (primary?.apiBase?.trim()) {
    const creds = await resolveFromApiBaseAndKey(modelName, primary.apiBase, primary.apiKey);
    if (creds) return creds;
  }

  return null;
}

/**
 * Resolve API credentials from a model name.
 *
 * Looks up the model in the shared model list (same source as the chat and
 * translate model selectors) and extracts the apiKey + apiBase.
 *
 * @param modelName  the model name as shown in the selector
 * @returns          credentials, or `null` if the model can't be resolved
 */
export async function resolveModelCredentials(
  modelName: string,
  providerId?: string,
): Promise<TranslateCredentials | null> {
  if (!modelName) return null;

  const { choices } = getModelChoices();
  const normalized = normalizeModelId(modelName);

  // Find match: prefer providerId-exact match if given, then name-only
  let entry: ModelChoice | undefined;
  if (providerId) {
    entry =
      choices.find((c) => c.model === modelName && c.providerId === providerId) ||
      choices.find((c) => normalizeModelId(c.model) === normalized && c.providerId === providerId);
  }
  if (!entry) {
    entry =
      choices.find((c) => c.model === modelName) ||
      choices.find((c) => normalizeModelId(c.model) === normalized);
  }

  if (!entry) return null;

  // 1) Resolve directly from the selected model entry.
  const entryResolved = await resolveFromApiBaseAndKey(
    entry.model,
    entry.apiBase,
    entry.apiKey,
  );
  if (entryResolved) {
    return entryResolved;
  }

  // 2) Resolve via saved profile slots (same source used by chat).
  const profileResolved = await resolveFromProfiles(entry.model);
  if (profileResolved) {
    return profileResolved;
  }

  // 3) OAuth provider model inferred from cache/label/heuristics.
  const provider = detectOAuthProviderForModel(entry.model, entry.provider, entry.apiBase);
  if (!provider) return null;
  const oauthResolved = await resolveOAuthProviderCredentials(provider, entry.model);
  if (oauthResolved) return oauthResolved;

  // 4) Final fallback: try model name directly against profiles.
  return resolveFromProfiles(modelName);
}

/**
 * Convenience: resolve and throw a user-friendly error if credentials are
 * missing.
 */
export async function resolveModelCredentialsOrThrow(
  modelName: string,
  providerId?: string,
): Promise<TranslateCredentials> {
  const creds = await resolveModelCredentials(modelName, providerId);
  if (!creds) {
    const guessedProvider = detectOAuthProviderForModel(modelName);
    const providerHint = guessedProvider
      ? ` Provider guess: ${guessedProvider}.`
      : "";
    throw new Error(
      `Cannot resolve API credentials for model "${modelName}". ` +
      `Please ensure the model is authenticated and has a valid API key/token.` +
      providerHint,
    );
  }
  return creds;
}
