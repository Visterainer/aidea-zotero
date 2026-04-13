import type {
  OAuthProviderId,
  ProviderModelOption,
} from "./oauthCli";

export type ProviderModelSelectionCache =
  Partial<Record<OAuthProviderId, string[]>>;

function hasOwn<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function normalizeModelId(value: string): string {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function parseModelSelectionCache(
  raw: string,
): ProviderModelSelectionCache {
  const text = String(raw || "").trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ProviderModelSelectionCache = {};
    for (const [provider, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) continue;
      const ids = value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
      out[provider as OAuthProviderId] = dedupeModelIds(ids);
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeModelSelectionCache(
  cache: ProviderModelSelectionCache,
): string {
  return JSON.stringify(cache);
}

export function canonicalizeSelectedModelIds(
  modelIds: string[],
  models: ProviderModelOption[],
): string[] {
  const available = new Map<string, string>();
  for (const row of models) {
    const id = String(row.id || "").trim();
    const normalized = normalizeModelId(id);
    if (!id || available.has(normalized)) continue;
    available.set(normalized, id);
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const rawId of modelIds) {
    const normalized = normalizeModelId(rawId);
    const canonical = available.get(normalized);
    if (!canonical || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(canonical);
  }
  return out;
}

export function getOpenAICodexDefaultModelIds(modelIds: string[]): string[] {
  const nonCodexTop: Array<{ id: string; version: number; index: number }> = [];
  let bestCodex: { id: string; version: number } | null = null;
  let bestCodexMax: { id: string; version: number } | null = null;
  const nonGpt: string[] = [];

  for (const [index, modelId] of modelIds.entries()) {
    const version = parseGptVersion(modelId);
    if (version === null) {
      nonGpt.push(modelId);
      continue;
    }
    switch (classifyCodexSuffix(modelId)) {
      case "non-codex":
        nonCodexTop.push({ id: modelId, version, index });
        break;
      case "codex":
        if (!bestCodex || version > bestCodex.version) {
          bestCodex = { id: modelId, version };
        }
        break;
      case "codex-max":
        if (!bestCodexMax || version > bestCodexMax.version) {
          bestCodexMax = { id: modelId, version };
        }
        break;
      case "other-codex":
        break;
    }
  }

  nonCodexTop.sort((a, b) => {
    if (b.version !== a.version) return b.version - a.version;
    return a.index - b.index;
  });

  const selected: string[] = nonCodexTop.slice(0, 2).map((entry) => entry.id);
  if (bestCodex) selected.push(bestCodex.id);
  if (bestCodexMax) selected.push(bestCodexMax.id);
  selected.push(...nonGpt);
  return dedupeModelIds(selected);
}

export function getDefaultSelectedModelIds(
  provider: OAuthProviderId,
  models: ProviderModelOption[],
): string[] {
  const modelIds = models
    .map((row) => String(row.id || "").trim())
    .filter(Boolean);

  if (provider === "openai-codex") {
    return canonicalizeSelectedModelIds(
      getOpenAICodexDefaultModelIds(modelIds),
      models,
    );
  }

  if (provider === "google-gemini-cli") {
    return canonicalizeSelectedModelIds(
      [
        pickBestGeminiModel(modelIds, "pro"),
        pickBestGeminiModel(modelIds, "flash"),
      ].filter((value): value is string => Boolean(value)),
      models,
    );
  }



  const selected = [
    ...modelIds.filter((id) => /^claude-/i.test(id)),
    pickBestGeminiModel(modelIds.filter((id) => /^gemini-/i.test(id)), "pro"),
    pickBestGeminiModel(
      modelIds.filter((id) => /^gemini-/i.test(id)),
      "flash",
    ),
    ...getOpenAICodexDefaultModelIds(
      modelIds.filter((id) => /^gpt-/i.test(id)),
    ),
    ...modelIds.filter((id) => /^grok-/i.test(id)),
  ];
  return canonicalizeSelectedModelIds(
    selected.filter((value): value is string => Boolean(value)),
    models,
  );
}

export function reconcileProviderModelSelection(
  provider: OAuthProviderId,
  models: ProviderModelOption[],
  selectionCache: ProviderModelSelectionCache,
): string[] {
  if (hasOwn(selectionCache, provider)) {
    return canonicalizeSelectedModelIds(selectionCache[provider] || [], models);
  }
  return getDefaultSelectedModelIds(provider, models);
}

export function getSelectedProviderModels(
  provider: OAuthProviderId,
  models: ProviderModelOption[],
  selectionCache: ProviderModelSelectionCache,
): ProviderModelOption[] {
  const selected = new Set(
    reconcileProviderModelSelection(provider, models, selectionCache).map(
      normalizeModelId,
    ),
  );
  return models.filter((row) => selected.has(normalizeModelId(row.id)));
}

export function reconcileModelSelectionCache(
  modelCache: Partial<Record<string, ProviderModelOption[]>>,
  selectionCache: ProviderModelSelectionCache,
): { cache: ProviderModelSelectionCache; changed: boolean } {
  const next: ProviderModelSelectionCache = {};
  const providers = Array.from(new Set([
    "openai-codex",
    "google-gemini-cli",
    "github-copilot",
    ...Object.keys(modelCache)
  ])) as OAuthProviderId[];

  for (const provider of providers) {
    const models = modelCache[provider] || [];
    if (!models.length) continue;
    const selectedIds = reconcileProviderModelSelection(
      provider,
      models,
      selectionCache,
    );
    if (selectedIds.length > 0 || hasOwn(selectionCache, provider)) {
      next[provider] = selectedIds;
    }
  }

  return {
    cache: next,
    changed: !sameSelectionCache(selectionCache, next),
  };
}

function sameSelectionCache(
  left: ProviderModelSelectionCache,
  right: ProviderModelSelectionCache,
): boolean {
  const providers = new Set([
    "openai-codex",
    "google-gemini-cli",
    "github-copilot",
    ...Object.keys(left),
    ...Object.keys(right)
  ]) as Set<OAuthProviderId>;

  for (const provider of providers) {
    const leftHas = hasOwn(left, provider);
    const rightHas = hasOwn(right, provider);
    if (leftHas !== rightHas) return false;
    if (!leftHas && !rightHas) continue;
    const leftIds = (left[provider] || []).map(normalizeModelId);
    const rightIds = (right[provider] || []).map(normalizeModelId);
    if (leftIds.length !== rightIds.length) return false;
    for (let i = 0; i < leftIds.length; i += 1) {
      if (leftIds[i] !== rightIds[i]) return false;
    }
  }
  return true;
}

function dedupeModelIds(modelIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of modelIds) {
    const id = String(value || "").trim();
    const normalized = normalizeModelId(id);
    if (!id || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(id);
  }
  return out;
}

function parseGptVersion(model: string): number | null {
  const match = model.match(/^gpt-(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const version = parseFloat(match[1]);
  return Number.isFinite(version) ? version : null;
}

function classifyCodexSuffix(
  model: string,
): "codex-max" | "codex" | "other-codex" | "non-codex" {
  if (/-codex-max$/i.test(model)) return "codex-max";
  if (/-codex$/i.test(model)) return "codex";
  if (/-codex-/i.test(model)) return "other-codex";
  return "non-codex";
}

function pickBestGeminiModel(
  modelIds: string[],
  family: "pro" | "flash",
): string {
  let best: { id: string; version: number; rank: number } | null = null;
  for (const modelId of modelIds) {
    const lower = modelId.toLowerCase();
    const matches =
      family === "pro"
        ? /-pro(?:$|-)/i.test(lower)
        : /-flash(?:$|-)/i.test(lower);
    if (!matches) continue;

    const version = parseGeminiVersion(modelId);
    const rank = getGeminiFamilyRank(lower, family);
    if (
      !best ||
      version > best.version ||
      (version === best.version && rank > best.rank) ||
      (version === best.version && rank === best.rank && modelId.length < best.id.length) ||
      (
        version === best.version &&
        rank === best.rank &&
        modelId.length === best.id.length &&
        modelId.localeCompare(best.id) < 0
      )
    ) {
      best = { id: modelId, version, rank };
    }
  }
  return best?.id || "";
}

function parseGeminiVersion(modelId: string): number {
  const match = modelId.match(/^gemini-(\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  const version = parseFloat(match[1]);
  return Number.isFinite(version) ? version : 0;
}

function getGeminiFamilyRank(
  lowerModelId: string,
  family: "pro" | "flash",
): number {
  if (family === "pro") {
    if (!/-pro(?:$|-)/i.test(lowerModelId)) return -1;
    return /preview|experimental|exp/i.test(lowerModelId) ? 1 : 2;
  }

  if (!/-flash(?:$|-)/i.test(lowerModelId)) return -1;
  if (/-flash-lite(?:$|-)/i.test(lowerModelId)) return 0;
  return /preview|experimental|exp/i.test(lowerModelId) ? 1 : 2;
}
