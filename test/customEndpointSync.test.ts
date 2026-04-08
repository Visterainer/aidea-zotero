import { assert } from "chai";

type PreferenceScriptModule = typeof import("../src/modules/preferenceScript");
type ProviderModelOption = import("../src/utils/oauthCli").ProviderModelOption;
type ProviderModelSelectionCache =
  import("../src/utils/oauthModelSelection").ProviderModelSelectionCache;

type PrefStore = Map<string, unknown>;

const PREF_PREFIX = "extensions.zotero.aidea";

let preferenceScript: PreferenceScriptModule;
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

function models(ids: string[]): ProviderModelOption[] {
  return ids.map((id) => ({ id, label: id }));
}

describe("custom endpoint OAuth sync guard", function () {
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

    preferenceScript = await import("../src/modules/preferenceScript");
  });

  beforeEach(function () {
    prefStore.clear();
  });

  it("leaves custom base prefs untouched while updating OAuth profile slots", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://custom.example/v1");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");

    const cache = {
      "openai-codex": models(["gpt-5.2", "gpt-5.1"]),
      "google-gemini-cli": models(["gemini-3.1-pro-preview"]),
    };
    const selectionCache: ProviderModelSelectionCache = {
      "openai-codex": ["gpt-5.2"],
      "google-gemini-cli": ["gemini-3.1-pro-preview"],
    };

    preferenceScript.syncSidebarModelPrefsFromSelection(cache, selectionCache);

    assert.equal(getPluginPref("apiBase"), "https://custom.example/v1");
    assert.equal(getPluginPref("apiKey"), "custom-key");
    assert.equal(getPluginPref("model"), "custom-model");

    assert.equal(getPluginPref("apiBasePrimary"), "oauth://openai-codex");
    assert.equal(getPluginPref("apiKeyPrimary"), "");
    assert.equal(getPluginPref("modelPrimary"), "gpt-5.2");
    assert.equal(
      getPluginPref("apiBaseSecondary"),
      "oauth://google-gemini-cli",
    );
    assert.equal(getPluginPref("apiKeySecondary"), "");
    assert.equal(getPluginPref("modelSecondary"), "gemini-3.1-pro-preview");
  });

  it("still syncs the active base prefs in oauth mode", function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref("apiBase", "https://custom.example/v1");
    setPluginPref("apiKey", "stale-key");
    setPluginPref("model", "stale-model");

    const cache = {
      qwen: models(["qwen-max"]),
    };
    const selectionCache: ProviderModelSelectionCache = {
      qwen: ["qwen-max"],
    };

    preferenceScript.syncSidebarModelPrefsFromSelection(cache, selectionCache);

    assert.equal(getPluginPref("apiBase"), "oauth://qwen");
    assert.equal(getPluginPref("apiKey"), "");
    assert.equal(getPluginPref("model"), "qwen-max");
    assert.equal(getPluginPref("apiBasePrimary"), "oauth://qwen");
    assert.equal(getPluginPref("apiKeyPrimary"), "");
    assert.equal(getPluginPref("modelPrimary"), "qwen-max");
  });
});
