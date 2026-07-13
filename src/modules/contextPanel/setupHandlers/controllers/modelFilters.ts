import { getOpenAICodexDefaultModelIds } from "../../../../utils/oauthModelSelection";
import type { ModelChoice } from "./modelSelectionController";

/**
 * Provider-specific model filter registry.
 *
 * Each key is a provider label (e.g., "Codex", "Gemini") matching the
 * `provider` field on ModelChoice entries. The value is a filter function
 * that receives all choices belonging to that provider and returns the
 * subset that should be shown in the dropdown.
 */
const PROVIDER_FILTERS: Record<
  string,
  (models: ModelChoice[]) => ModelChoice[]
> = {
  Codex: filterOpenAICodexModels,
};

/**
 * Apply provider-specific filters to the full model list.
 * Models whose provider has no registered filter pass through unchanged.
 */
export function applyModelFilters(choices: ModelChoice[]): ModelChoice[] {
  const grouped = new Map<string, ModelChoice[]>();
  const passthrough: ModelChoice[] = [];

  for (const choice of choices) {
    const provider = choice.provider || "";
    if (provider && PROVIDER_FILTERS[provider]) {
      const group = grouped.get(provider) || [];
      group.push(choice);
      grouped.set(provider, group);
    } else {
      passthrough.push(choice);
    }
  }

  const filtered: ModelChoice[] = [...passthrough];
  for (const [provider, group] of grouped) {
    const filter = PROVIDER_FILTERS[provider];
    filtered.push(...(filter ? filter(group) : group));
  }

  filtered.sort((a, b) => (a.provider || "").localeCompare(b.provider || ""));

  return filtered;
}

function filterOpenAICodexModels(models: ModelChoice[]): ModelChoice[] {
  const selected = new Set(
    getOpenAICodexDefaultModelIds(models.map((choice) => choice.model)),
  );
  return models.filter((choice) => selected.has(choice.model));
}
