import {
  type ModelProfileKey,
} from "../../constants";
import {
  getApiProfiles,
  getPrimaryConnectionMode,
  getStringPref,
} from "../../prefHelpers";
import { selectedModelCache, selectedModelProviderCache } from "../../state";
import {
  type OAuthProviderId,
  type ProviderModelOption,
} from "../../../../utils/oauthCli";
import {
  getSelectedProviderModels,
  normalizeModelId,
  parseModelSelectionCache,
} from "../../../../utils/oauthModelSelection";

function parseOAuthModelCache():
  Partial<Record<OAuthProviderId, ProviderModelOption[]>> {
  const cacheRaw = getStringPref("oauthModelListCache").trim();
  if (!cacheRaw) return {};
  try {
    const parsed = JSON.parse(
      cacheRaw,
    ) as Partial<Record<OAuthProviderId, ProviderModelOption[]>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export type ModelChoice = {
  key: ModelProfileKey;
  model: string;
  provider?: string;
  /** For custom-endpoint models, the API base URL to use. */
  apiBase?: string;
  /** For custom-endpoint models, the API key to use. */
  apiKey?: string;
};

/** Human-readable labels for known OAuth providers. */
const OAUTH_PROVIDER_LABELS: Record<OAuthProviderId, string> = {
  "openai-codex": "Codex",
  "google-gemini-cli": "Gemini",
  "github-copilot": "Copilot",
};

/**
 * Build the model choices list from a **single source of truth**: the
 * `oauthModelListCache` (plus the `oauthModelSelectionCache` filter).
 *
 * In "custom" connection mode, the base-pref model is also included as a
 * fallback if it is not already present in the cache.
 */
export function getModelChoices() {
  const profiles = getApiProfiles();
  const choices: ModelChoice[] = [];
  // Dedup key: normalized-model + provider-label
  const seenModels = new Set<string>();
  const modelCache = parseOAuthModelCache();
  const selectionCache = parseModelSelectionCache(
    getStringPref("oauthModelSelectionCache"),
  );

  const profileKeys: ModelProfileKey[] = [
    "primary",
    "secondary",
    "tertiary",
    "quaternary",
  ];
  let slotIdx = 0;

  // ── Single source of truth: modelCache ──
  for (const provider of Object.keys(modelCache) as OAuthProviderId[]) {
    const providerModels = getSelectedProviderModels(
      provider,
      modelCache[provider] || [],
      selectionCache,
    );
    const label = OAUTH_PROVIDER_LABELS[provider] || provider;
    for (const row of providerModels) {
      const id = String(row.id || "").trim();
      if (!id) continue;
      const normalized = normalizeModelId(id);
      // Dedup per provider — same model under different providers is allowed
      const dedupKey = `${normalized}\x00${label}`;
      if (seenModels.has(dedupKey)) continue;
      seenModels.add(dedupKey);
      const key = profileKeys[slotIdx % profileKeys.length] || "primary";
      choices.push({
        key,
        model: id,
        provider: label,
        apiBase: row.apiBase,
        apiKey: row.apiKey,
      });
      slotIdx += 1;
    }
  }

  // ── Custom mode fallback ──
  // When the user is in "custom" connection mode, the base prefs may contain
  // a model that is NOT in any provider's cache.  Include it so the dropdown
  // is never empty in custom mode.
  if (getPrimaryConnectionMode() === "custom") {
    const customModel = profiles.primary.model.trim();
    if (customModel) {
      const normalized = normalizeModelId(customModel);
      const alreadyPresent = choices.some(
        (c) => normalizeModelId(c.model) === normalized,
      );
      if (!alreadyPresent) {
        choices.unshift({
          key: "primary",
          model: customModel,
          provider: "Custom API",
          apiBase: profiles.primary.apiBase,
          apiKey: profiles.primary.apiKey,
        });
      }
    }
  }

  choices.sort((a, b) => (a.provider || "").localeCompare(b.provider || ""));
  return { profiles, choices };
}

export function pickBestDefaultModel(choices: ModelChoice[]): string {
  const parseGptVersion = (model: string): number | null => {
    const m = model.match(/^gpt-(\d+(?:\.\d+)?)/i);
    if (!m) return null;
    return parseFloat(m[1]);
  };
  const isCodexSuffix = (model: string): boolean =>
    /-(codex|codex-mini|codex-max)$/i.test(model);

  let bestModel = "";
  let bestVersion = -1;
  for (const entry of choices) {
    const version = parseGptVersion(entry.model);
    if (version === null) continue;
    if (isCodexSuffix(entry.model)) continue;
    if (version > bestVersion) {
      bestVersion = version;
      bestModel = entry.model;
    }
  }
  return bestModel || choices[0]?.model || "";
}

const LAST_MODEL_NAME_PREF = "lastUsedModelName";
const LAST_MODEL_PROVIDER_PREF = "lastUsedModelProvider";

export function getPersistedModelName(): string {
  return getStringPref(LAST_MODEL_NAME_PREF).trim();
}

export function getPersistedModelProvider(): string {
  return getStringPref(LAST_MODEL_PROVIDER_PREF).trim();
}

export function persistModelName(modelName: string): void {
  try {
    Zotero.Prefs.set(
      `${addon.data.config.prefsPrefix}.${LAST_MODEL_NAME_PREF}`,
      modelName,
      true,
    );
  } catch { /* ignore */ }
}

export function persistModelProvider(providerLabel: string): void {
  try {
    Zotero.Prefs.set(
      `${addon.data.config.prefsPrefix}.${LAST_MODEL_PROVIDER_PREF}`,
      providerLabel,
      true,
    );
  } catch { /* ignore */ }
}

export function getSelectedModelInfo(itemId: number | null) {
  const { choices } = getModelChoices();

  /** Helper: build a consistent return shape that always includes currentProvider. */
  const buildResult = (entry: ModelChoice) => ({
    selected: entry.key,
    choices,
    currentModel: entry.model,
    currentProvider: entry.provider || "",
  });

  if (itemId === null) {
    return choices[0]
      ? buildResult(choices[0])
      : { selected: "primary" as const, choices, currentModel: "", currentProvider: "" };
  }

  const cachedSelection = selectedModelCache.get(itemId);
  const cachedProvider = selectedModelProviderCache.get(itemId);
  if (cachedSelection) {
    const isProfileKey = (
      ["primary", "secondary", "tertiary", "quaternary"] as const
    ).includes(cachedSelection as ModelProfileKey);
    if (!isProfileKey) {
      // Match by both model name and provider if available
      const byModel = cachedProvider
        ? choices.find((entry) => entry.model === cachedSelection && entry.provider === cachedProvider)
          || choices.find((entry) => entry.model === cachedSelection)
        : choices.find((entry) => entry.model === cachedSelection);
      if (byModel) return buildResult(byModel);
    }
    const byKey = choices.find((entry) => entry.key === cachedSelection);
    if (byKey) return buildResult(byKey);
  }

  const persistedModel = getPersistedModelName();
  if (persistedModel) {
    const persistedProvider = getPersistedModelProvider();
    const byPersisted = persistedProvider
      ? choices.find(
          (entry) => entry.model.toLowerCase() === persistedModel.toLowerCase()
            && entry.provider === persistedProvider,
        ) || choices.find(
          (entry) => entry.model.toLowerCase() === persistedModel.toLowerCase(),
        )
      : choices.find(
          (entry) => entry.model.toLowerCase() === persistedModel.toLowerCase(),
        );
    if (byPersisted) {
      selectedModelCache.set(itemId, byPersisted.model);
      if (byPersisted.provider) {
        selectedModelProviderCache.set(itemId, byPersisted.provider);
      }
      return buildResult(byPersisted);
    }
  }

  const bestDefault = pickBestDefaultModel(choices);
  if (bestDefault) {
    selectedModelCache.set(itemId, bestDefault);
    const bestEntry = choices.find((entry) => entry.model === bestDefault);
    if (bestEntry) return buildResult(bestEntry);
    return {
      selected: "primary" as ModelProfileKey,
      choices,
      currentModel: bestDefault,
      currentProvider: "",
    };
  }

  const first = choices[0];
  return first
    ? buildResult(first)
    : { selected: "primary" as ModelProfileKey, choices, currentModel: "", currentProvider: "" };
}
