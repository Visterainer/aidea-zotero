import { config } from "../../package.json";

/**
 * User-selectable reasoning effort for providers whose wire format takes a
 * plain effort string (currently the Codex OAuth backend). Legacy empty
 * selections are initialized to an explicit catalog-supported level.
 */

/** Effort ladder, weakest to strongest. */
export const REASONING_EFFORT_ORDER = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
] as const;

export type ApiReasoningWire = "reasoning_effort" | "reasoning" | "verbosity";

export type ModelReasoningSupport = {
  wire?: ApiReasoningWire;
  efforts: string[];
  defaultEffort?: string;
  /** No catalog capability data yet; do not invent a set of effort levels. */
  catalogMissing?: boolean;
};

type CatalogRow = {
  id?: unknown;
  reasoningLevels?: unknown;
  defaultReasoningLevel?: unknown;
  apiBase?: string;
  apiKey?: string;
};

const CHAT_PREF = `${config.prefsPrefix}.chatReasoningEffort`;
const LEGACY_CHAT_PREF = `${config.prefsPrefix}.chatReasoningEffortByModel`;
const TRANSLATE_PREF = `${config.prefsPrefix}.translateReasoningEffort`;
const SELECTION_TRANSLATE_PREF = `${config.prefsPrefix}.selectionTranslate.reasoningEffort`;
const MODEL_CACHE_PREF = `${config.prefsPrefix}.oauthModelListCache`;
const OAUTH_MARKER_PREFIX = "oauth://";

function normalizeEffort(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function effortRank(effort: string): number {
  const rank = (REASONING_EFFORT_ORDER as readonly string[]).indexOf(effort);
  return rank < 0 ? REASONING_EFFORT_ORDER.length : rank;
}

function sortEfforts(efforts: string[]): string[] {
  return efforts
    .map((effort, index) => ({ effort, index }))
    .sort(
      (a, b) =>
        effortRank(a.effort) - effortRank(b.effort) || a.index - b.index,
    )
    .map((entry) => entry.effort);
}

/**
 * Parse the Codex catalog's `supported_reasoning_levels`, which lists either
 * plain strings or `{ effort, description }` rows.
 */
export function parseCatalogReasoningLevels(
  value: unknown,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const efforts: string[] = [];
  for (const entry of value) {
    const effort = normalizeEffort(
      typeof entry === "string" ? entry : (entry as any)?.effort,
    );
    if (effort && !efforts.includes(effort)) efforts.push(effort);
  }
  return efforts.length ? sortEfforts(efforts) : undefined;
}

/** Providers whose requests carry a user-selected effort. */
export function supportsReasoningEffortSelection(providerId: string): boolean {
  return providerId === "openai-codex";
}

export function providerIdFromApiBase(apiBase: string | undefined): string {
  const raw = String(apiBase || "").trim();
  return raw.startsWith(OAUTH_MARKER_PREFIX)
    ? raw.slice(OAUTH_MARKER_PREFIX.length)
    : "";
}

export function getModelReasoningSupport(
  providerId: string,
  model: string,
  catalogRow?: CatalogRow,
): ModelReasoningSupport {
  if (!supportsReasoningEffortSelection(providerId) || !model.trim()) {
    return { efforts: [] };
  }
  if (Array.isArray(catalogRow?.reasoningLevels)) {
    const catalogEfforts =
      parseCatalogReasoningLevels(catalogRow.reasoningLevels) || [];
    const defaultEffort = normalizeEffort(catalogRow?.defaultReasoningLevel);
    return {
      efforts: catalogEfforts,
      ...(catalogEfforts.includes(defaultEffort) ? { defaultEffort } : {}),
    };
  }
  // Older caches and fallback model lists have no capability data. Ordinary
  // requests still work, but effort selection waits for a catalog refresh.
  return { efforts: [], catalogMissing: true };
}

function readCatalogRow(
  providerId: string,
  model: string,
): CatalogRow | undefined {
  try {
    const cache = JSON.parse(
      String(Zotero.Prefs.get(MODEL_CACHE_PREF, true) || "{}"),
    );
    const rows = cache?.[providerId];
    if (!Array.isArray(rows)) return undefined;
    const wanted = model.trim().toLowerCase();
    return rows.find(
      (row: CatalogRow) =>
        String(row?.id || "")
          .trim()
          .toLowerCase() === wanted,
    );
  } catch {
    return undefined;
  }
}

export function getCachedModelReasoningSupport(
  providerId: string,
  model: string,
  apiBase?: string,
  apiKey?: string,
): ModelReasoningSupport {
  if (!supportsReasoningEffortSelection(providerId)) {
    const row = readCatalogRow(providerId, model);
    const base = apiBase || row?.apiBase;
    return base && /^https?:\/\//i.test(base)
      ? getApiReasoningSupport(base, model, apiKey ?? row?.apiKey ?? "")
      : { efforts: [] };
  }
  return getModelReasoningSupport(
    providerId,
    model,
    readCatalogRow(providerId, model),
  );
}

/**
 * Effort to send, or undefined to omit it. A selection the model no longer
 * supports falls to the nearest weaker supported effort, never to "none", so
 * a stale choice cannot raise cost when a weaker level is available. Otherwise
 * use the explicit catalog default (or the weakest non-none supported level).
 */
export function resolveReasoningEffort(
  selected: string | undefined,
  efforts: string[],
  defaultEffort?: string,
): string | undefined {
  const fallback = efforts.includes(defaultEffort || "")
    ? defaultEffort
    : sortEfforts(efforts).find((effort) => effort !== "none") || efforts[0];
  const wanted = normalizeEffort(selected);
  if (!efforts.length) return undefined;
  if (!wanted) return fallback;
  if (efforts.includes(wanted)) return wanted;
  const rank = (REASONING_EFFORT_ORDER as readonly string[]).indexOf(wanted);
  for (let index = rank - 1; index > 0; index -= 1) {
    const candidate = REASONING_EFFORT_ORDER[index];
    if (efforts.includes(candidate)) return candidate;
  }
  return fallback;
}

/** Migrate an empty selection once; model switches never overwrite a choice. */
export function initializeReasoningEffort(
  selected: string,
  support: ModelReasoningSupport,
  save: (effort: string) => void,
): string {
  if (selected || !support.efforts.length) return selected;
  const initial = resolveReasoningEffort(
    "",
    support.efforts,
    support.defaultEffort,
  )!;
  save(initial);
  return initial;
}

/** Display label for an effort value, e.g. "xhigh" -> "XHigh". */
export function formatReasoningEffort(effort: string): string {
  if (effort === "xhigh") return "XHigh";
  return effort ? effort.charAt(0).toUpperCase() + effort.slice(1) : effort;
}

function readStringPref(key: string): string {
  try {
    return String(Zotero.Prefs.get(key, true) || "");
  } catch {
    return "";
  }
}

function writeStringPref(key: string, value: string): void {
  try {
    Zotero.Prefs.set(key, value, true);
  } catch {
    /* ignore */
  }
}

function readLegacyChatEfforts(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(readStringPref(LEGACY_CHAT_PREF) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function chatKey(providerId: string, model: string): string {
  return `${providerId}:${model.trim().toLowerCase()}`;
}

/** Chat keeps one choice across models and providers. */
export function getChatReasoningEffort(): string {
  const current = normalizeEffort(readStringPref(CHAT_PREF));
  if (current) return current;
  const legacy = readLegacyChatEfforts();
  const keys = Object.keys(legacy);
  if (!keys.length) return "";
  const selectedKey = chatKey(
    readStringPref(`${config.prefsPrefix}.lastUsedModelProvider`),
    readStringPref(`${config.prefsPrefix}.lastUsedModelName`),
  );
  const migrated = normalizeEffort(legacy[selectedKey] || legacy[keys[0]]);
  writeStringPref(CHAT_PREF, migrated);
  writeStringPref(LEGACY_CHAT_PREF, "{}");
  return migrated;
}

export function setChatReasoningEffort(effort: string): void {
  writeStringPref(CHAT_PREF, normalizeEffort(effort));
  writeStringPref(LEGACY_CHAT_PREF, "{}");
}

export function getTranslateReasoningEffort(): string {
  return normalizeEffort(readStringPref(TRANSLATE_PREF));
}

export function setTranslateReasoningEffort(effort: string): void {
  writeStringPref(TRANSLATE_PREF, normalizeEffort(effort));
}

export function getSelectionTranslateReasoningEffort(): string {
  return normalizeEffort(readStringPref(SELECTION_TRANSLATE_PREF));
}

export function setSelectionTranslateReasoningEffort(effort: string): void {
  writeStringPref(SELECTION_TRANSLATE_PREF, normalizeEffort(effort));
}

/** Resolve the wire effort for a request routed through `apiBase`. */
export function resolveRequestReasoningEffort(
  apiBase: string | undefined,
  model: string,
  selected: string,
  apiKey = "",
): string | undefined {
  const providerId = providerIdFromApiBase(apiBase);
  const support = getCachedModelReasoningSupport(
    providerId,
    model,
    apiBase,
    apiKey,
  );
  return resolveReasoningEffort(
    selected,
    support.efforts,
    support.defaultEffort,
  );
}

const API_CAPS_PREF = `${config.prefsPrefix}.apiReasoningCapabilities`;
const API_CAPS_TTL = 24 * 60 * 60 * 1000;
type ApiCatalog = {
  updated: number;
  models: Record<string, ModelReasoningSupport>;
};

/** Preserve endpoint paths and query parameters; only remove transport suffixes. */
export function normalizeReasoningApiBase(apiBase: string): string {
  try {
    const url = new URL(apiBase.trim());
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    url.pathname = url.pathname
      .replace(/\/+$/, "")
      .replace(/\/(?:chat\/completions|responses|models)$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

/** Opaque configuration identity, never store API credentials in the capability cache. */
function apiScope(apiBase: string, apiKey: string): string {
  const input = JSON.stringify([
    normalizeReasoningApiBase(apiBase),
    apiKey.trim(),
  ]);
  let a = 0x811c9dc5,
    b = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    a = Math.imul(a ^ input.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ input.charCodeAt(i), 0x85ebca6b);
  }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

function readApiCatalogs(): Record<string, ApiCatalog> {
  try {
    const parsed = JSON.parse(readStringPref(API_CAPS_PREF) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function notifyApiCapabilities(): void {
  try {
    for (const win of Zotero.getMainWindows()) {
      win.document.dispatchEvent(new win.Event("llm-models-changed"));
    }
  } catch {
    /* No UI in a background request or test. */
  }
}

/** Require an explicit per-model ladder, never infer it from the model name. */
export function parseApiReasoningSupport(
  row: any,
  apiBase: string,
): ModelReasoningSupport {
  if (!row || typeof row !== "object")
    return { efforts: [], catalogMissing: true };
  const params: unknown[] | undefined = Array.isArray(row.supported_parameters)
    ? row.supported_parameters
    : undefined;
  if (
    row.supports_reasoning === false ||
    row.reasoning === false ||
    (params &&
      !params.some((p) =>
        ["reasoning", "reasoning_effort"].includes(String(p)),
      ))
  ) {
    return { efforts: [] };
  }
  const raw =
    row.supported_reasoning_levels ?? row.reasoning?.supported_efforts;
  if (
    !Array.isArray(raw) ||
    (!Array.isArray(row.supported_reasoning_levels) && !params)
  )
    return { efforts: [], catalogMissing: true };
  if (
    raw.some(
      (value) => typeof value !== "string" && typeof value?.effort !== "string",
    )
  )
    return { efforts: [], catalogMissing: true };
  let efforts = parseCatalogReasoningLevels(raw) || [];
  if (row.reasoning?.mandatory === true)
    efforts = efforts.filter((e) => e !== "none");
  if (!efforts.length) return { efforts: [] };
  let wire: ApiReasoningWire =
    params?.includes("reasoning") && !params.includes("reasoning_effort")
      ? "reasoning"
      : "reasoning_effort";
  let host: string;
  try {
    host = new URL(normalizeReasoningApiBase(apiBase)).hostname;
  } catch {
    return { efforts: [], catalogMissing: true };
  }
  // Hermes' OpenRouter adapter routes adaptive Anthropic effort through verbosity.
  // Only use that route when both the catalog ladder and mandatory thinking are explicit.
  if (
    host === "openrouter.ai" &&
    /^anthropic\//.test(String(row.id || "")) &&
    row.reasoning?.mandatory === true
  ) {
    if (!params?.includes("verbosity"))
      return { efforts: [], catalogMissing: true };
    wire = "verbosity";
  }
  const defaultEffort = normalizeEffort(
    row.default_reasoning_level ?? row.reasoning?.default_effort,
  );
  return {
    efforts,
    wire,
    ...(efforts.includes(defaultEffort) ? { defaultEffort } : {}),
  };
}

/** Replace on every refresh (including failures), so removed capabilities cannot linger. */
export function cacheApiReasoningCatalog(
  apiBase: string,
  apiKey: string,
  rows: unknown[],
): void {
  const catalogs = readApiCatalogs();
  const models: Record<string, ModelReasoningSupport> = Object.create(null);
  for (const row of rows as any[]) {
    const id = String(row?.id || row?.model || row?.name || "").trim();
    if (id && !Object.prototype.hasOwnProperty.call(models, id))
      models[id] = parseApiReasoningSupport(row, apiBase);
  }
  catalogs[apiScope(apiBase, apiKey)] = { updated: Date.now(), models };
  writeStringPref(API_CAPS_PREF, JSON.stringify(catalogs));
  notifyApiCapabilities();
}

export function getApiReasoningSupport(
  apiBase: string,
  model: string,
  apiKey = "",
): ModelReasoningSupport {
  const entry = readApiCatalogs()[apiScope(apiBase, apiKey)];
  if (
    !entry ||
    !Number.isFinite(entry.updated) ||
    Date.now() - entry.updated > API_CAPS_TTL
  )
    return { efforts: [], catalogMissing: true };
  const support = entry.models?.[model.trim()];
  if (!support || !Array.isArray(support.efforts))
    return { efforts: [], catalogMissing: true };
  // OpenRouter verbosity is a chat-completions control, not Responses reasoning.
  if (support.wire === "verbosity" && /\/responses\/?(?:\?|$)/.test(apiBase))
    return { efforts: [] };
  return support;
}

export function rejectApiReasoningSupport(
  apiBase: string,
  model: string,
  apiKey = "",
): void {
  const catalogs = readApiCatalogs();
  const key = apiScope(apiBase, apiKey);
  if (!catalogs[key]) return;
  catalogs[key].models[model.trim()] = { efforts: [] };
  writeStringPref(API_CAPS_PREF, JSON.stringify(catalogs));
  notifyApiCapabilities();
}
