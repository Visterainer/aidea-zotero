import { assert } from "chai";
import {
  getDefaultSelectedModelIds,
  getSelectedProviderModels,
  reconcileModelSelectionCache,
} from "../src/utils/oauthModelSelection";
import type {
  OAuthProviderId,
  ProviderModelOption,
} from "../src/utils/oauthCli";

function models(ids: string[]): ProviderModelOption[] {
  return ids.map((id) => ({ id, label: id }));
}

describe("oauthModelSelection defaults", function () {
  it("should keep the existing OpenAI/Codex default shortlist", function () {
    const selected = getDefaultSelectedModelIds(
      "openai-codex",
      models([
        "gpt-5",
        "gpt-5.1",
        "gpt-5.2",
        "gpt-5-codex",
        "gpt-5.3-codex",
        "gpt-5.1-codex-max",
        "gpt-5.2-codex-max",
        "gpt-5-codex-mini",
      ]),
    );

    assert.deepEqual(selected, [
      "gpt-5.2",
      "gpt-5.1",
      "gpt-5.3-codex",
      "gpt-5.2-codex-max",
    ]);
  });

  it("should pick the highest Gemini pro and flash variants", function () {
    const selected = getDefaultSelectedModelIds(
      "google-gemini-cli",
      models([
        "gemini-2.5-pro",
        "gemini-3.1-pro-preview",
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
        "gemini-2.5-flash-lite",
      ]),
    );

    assert.deepEqual(selected, [
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
    ]);
  });

  it("should include all Qwen models by default", function () {
    const selected = getDefaultSelectedModelIds(
      "qwen",
      models(["coder-model", "vision-model"]),
    );

    assert.deepEqual(selected, ["coder-model", "vision-model"]);
  });

  it("should apply GitHub Copilot family defaults", function () {
    const selected = getDefaultSelectedModelIds(
      "github-copilot",
      models([
        "claude-haiku-4.5",
        "claude-opus-4.6",
        "gemini-2.5-pro",
        "gemini-3.1-pro-preview",
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
        "gpt-4.1",
        "gpt-5.2",
        "gpt-5.3",
        "gpt-5.1-codex",
        "grok-2",
        "grok-3-mini",
        "o3-mini",
      ]),
    );

    assert.deepEqual(selected, [
      "claude-haiku-4.5",
      "claude-opus-4.6",
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gpt-5.3",
      "gpt-5.2",
      "gpt-5.1-codex",
      "grok-2",
      "grok-3-mini",
    ]);
  });

  it("should ignore unsupported gpt alias ids when picking Copilot defaults", function () {
    const selected = getDefaultSelectedModelIds(
      "github-copilot",
      models([
        "gpt-41-copilot",
        "gpt-5.4-mini",
        "gpt-5.3-codex",
        "gpt-4.1",
      ]),
    );

    assert.deepEqual(selected, [
      "gpt-5.4-mini",
      "gpt-4.1",
      "gpt-5.3-codex",
    ]);
  });
});

describe("oauthModelSelection persistence", function () {
  it("should preserve an explicit empty selection for a provider", function () {
    const modelCache: Partial<Record<OAuthProviderId, ProviderModelOption[]>> = {
      qwen: models(["coder-model", "vision-model"]),
    };
    const reconciled = reconcileModelSelectionCache(modelCache, { qwen: [] });

    assert.isFalse(reconciled.changed);
    assert.deepEqual(reconciled.cache, { qwen: [] });
    assert.deepEqual(
      getSelectedProviderModels("qwen", modelCache.qwen || [], reconciled.cache),
      [],
    );
  });

  it("should initialize missing provider selections from defaults", function () {
    const modelCache: Partial<Record<OAuthProviderId, ProviderModelOption[]>> = {
      "google-gemini-cli": models([
        "gemini-2.5-pro",
        "gemini-2.5-flash",
      ]),
    };
    const reconciled = reconcileModelSelectionCache(modelCache, {});

    assert.isTrue(reconciled.changed);
    assert.deepEqual(reconciled.cache, {
      "google-gemini-cli": ["gemini-2.5-pro", "gemini-2.5-flash"],
    });
  });
});
