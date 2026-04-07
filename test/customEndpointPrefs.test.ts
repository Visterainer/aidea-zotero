import { assert } from "chai";

type PrefHelpersModule =
  typeof import("../src/modules/contextPanel/prefHelpers");
type StateModule = typeof import("../src/modules/contextPanel/state");
type LlmClientModule = typeof import("../src/utils/llmClient");

type PrefStore = Map<string, unknown>;

const PREF_PREFIX = "extensions.zotero.aidea";

let prefHelpers: PrefHelpersModule;
let stateModule: StateModule;
let llmClient: LlmClientModule;
let prefStore: PrefStore;

function pluginPrefKey(key: string): string {
  return `${PREF_PREFIX}.${key}`;
}

function setPluginPref(key: string, value: unknown): void {
  prefStore.set(pluginPrefKey(key), value);
}

function getPluginPref(key: string): unknown {
  return prefStore.get(pluginPrefKey(key));
}

describe("custom endpoint primary connection mode", function () {
  before(async function () {
    prefStore = new Map<string, unknown>();
    (globalThis as any).Zotero = {
      Prefs: {
        get(key: string) {
          return prefStore.get(key);
        },
        set(key: string, value: unknown) {
          prefStore.set(key, value);
        },
      },
    };
    (globalThis as any).ztoolkit = {
      getGlobal: () => undefined,
      log: () => undefined,
    };

    prefHelpers = await import("../src/modules/contextPanel/prefHelpers");
    stateModule = await import("../src/modules/contextPanel/state");
    llmClient = await import("../src/utils/llmClient");
  });

  beforeEach(function () {
    prefStore.clear();
    stateModule.selectedModelCache.clear();
  });

  it("migrates missing mode to custom for non-OAuth base URLs", function () {
    setPluginPref("apiBase", "https://example.com/v1");

    const mode = prefHelpers.migratePrimaryConnectionMode();

    assert.equal(mode, "custom");
    assert.equal(getPluginPref("primaryConnectionMode"), "custom");
  });

  it("migrates missing mode to oauth for OAuth markers and empty base values", function () {
    setPluginPref("apiBase", "oauth://openai-codex");
    assert.equal(prefHelpers.migratePrimaryConnectionMode(), "oauth");
    assert.equal(getPluginPref("primaryConnectionMode"), "oauth");

    prefStore.clear();

    assert.equal(prefHelpers.migratePrimaryConnectionMode(), "oauth");
    assert.equal(getPluginPref("primaryConnectionMode"), "oauth");
  });

  it("does not overwrite an existing primaryConnectionMode during migration", function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref("apiBase", "https://custom.example/v1");

    const mode = prefHelpers.migratePrimaryConnectionMode();

    assert.equal(mode, "oauth");
    assert.equal(getPluginPref("primaryConnectionMode"), "oauth");
  });

  it("uses base prefs as the effective primary profile in custom mode", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://custom.example/v1/");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");
    setPluginPref("apiBasePrimary", "oauth://openai-codex");
    setPluginPref("apiKeyPrimary", "oauth-key");
    setPluginPref("modelPrimary", "oauth-model");
    setPluginPref("apiBaseSecondary", "oauth://google-gemini-cli");
    setPluginPref("apiKeySecondary", "secondary-key");
    setPluginPref("modelSecondary", "secondary-model");

    const profiles = prefHelpers.getApiProfiles();

    assert.deepEqual(profiles.primary, {
      apiBase: "https://custom.example/v1/",
      apiKey: "custom-key",
      model: "custom-model",
    });
    assert.deepEqual(profiles.secondary, {
      apiBase: "oauth://google-gemini-cli",
      apiKey: "secondary-key",
      model: "secondary-model",
    });
  });

  it("keeps cached model selection on the custom primary credentials", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://custom.example/v1");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");
    stateModule.selectedModelCache.set(42, "picked-model");

    const profile = prefHelpers.getSelectedProfileForItem(42);

    assert.deepEqual(profile, {
      key: "primary",
      apiBase: "https://custom.example/v1",
      apiKey: "custom-key",
      model: "picked-model",
    });
  });

  it("preserves OAuth primary-slot resolution in oauth mode", function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref("apiBase", "https://custom.example/v1");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");
    setPluginPref("apiBasePrimary", "oauth://openai-codex");
    setPluginPref("apiKeyPrimary", "oauth-key");
    setPluginPref("modelPrimary", "oauth-model");

    const profiles = prefHelpers.getApiProfiles();

    assert.deepEqual(profiles.primary, {
      apiBase: "oauth://openai-codex",
      apiKey: "oauth-key",
      model: "oauth-model",
    });
  });

  it("resolves llmClient config from base prefs in custom mode", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://custom.example/v1/");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");
    setPluginPref("apiBasePrimary", "oauth://openai-codex");
    setPluginPref("apiKeyPrimary", "oauth-key");
    setPluginPref("modelPrimary", "oauth-model");

    const config = llmClient.getApiConfig();

    assert.equal(config.apiBase, "https://custom.example/v1");
    assert.equal(config.apiKey, "custom-key");
    assert.equal(config.model, "custom-model");
  });

  it("throws when llmClient config is missing model in custom mode", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://custom.example/v1/");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", " ");

    assert.throws(
      () => llmClient.getApiConfig(),
      "Model is required in custom mode",
    );
  });

  it("resolves llmClient config from the OAuth primary slot in oauth mode", function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref("apiBase", "https://custom.example/v1");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");
    setPluginPref("apiBasePrimary", "oauth://openai-codex");
    setPluginPref("apiKeyPrimary", "oauth-key");
    setPluginPref("modelPrimary", "oauth-model");

    const config = llmClient.getApiConfig();

    assert.equal(config.apiBase, "oauth://openai-codex");
    assert.equal(config.apiKey, "oauth-key");
    assert.equal(config.model, "oauth-model");
  });
});
