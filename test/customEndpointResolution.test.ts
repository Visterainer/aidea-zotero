import { assert } from "chai";

type ChatModule = typeof import("../src/modules/contextPanel/chat");
type StateModule = typeof import("../src/modules/contextPanel/state");

type PrefStore = Map<string, unknown>;

const PREF_PREFIX = "extensions.zotero.aidea";

let chatModule: ChatModule;
let stateModule: StateModule;
let prefStore: PrefStore;

function pluginPrefKey(key: string): string {
  return `${PREF_PREFIX}.${key}`;
}

function setPluginPref(key: string, value: unknown): void {
  prefStore.set(pluginPrefKey(key), value);
}

function makeItem(id = 1): Zotero.Item {
  return { id } as Zotero.Item;
}

describe("custom endpoint request resolution", function () {
  before(async function () {
    prefStore = new Map<string, unknown>();
    (globalThis as typeof globalThis & { Zotero: any }).Zotero = {
      Prefs: {
        get(key: string) {
          return prefStore.get(key);
        },
        set(key: string, value: unknown) {
          prefStore.set(key, value);
        },
      },
      locale: "en-US",
    };
    (globalThis as typeof globalThis & { ztoolkit: any }).ztoolkit = {
      getGlobal: () => undefined,
      log: () => undefined,
    };

    chatModule = await import("../src/modules/contextPanel/chat");
    stateModule = await import("../src/modules/contextPanel/state");
  });

  beforeEach(function () {
    prefStore.clear();
    stateModule.selectedModelCache.clear();
  });

  it("keeps an explicit non-OAuth apiBase when the model appears in the OAuth cache", function () {
    setPluginPref(
      "oauthModelListCache",
      JSON.stringify({ qwen: [{ id: "gpt-5.2" }] }),
    );
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://fallback.example/v1");
    setPluginPref("apiKey", "fallback-key");
    setPluginPref("model", "fallback-model");

    const config = chatModule.resolveEffectiveRequestConfig({
      item: makeItem(),
      model: "gpt-5.2",
      apiBase: "https://openrouter.example/api/v1",
      apiKey: "explicit-key",
    });

    assert.equal(config.apiBase, "https://openrouter.example/api/v1");
    assert.equal(config.apiKey, "explicit-key");
    assert.equal(config.model, "gpt-5.2");
  });

  it("rewrites an empty apiBase to the detected OAuth marker", function () {
    setPluginPref(
      "oauthModelListCache",
      JSON.stringify({ qwen: [{ id: "qwen-max" }] }),
    );

    const config = chatModule.resolveEffectiveRequestConfig({
      item: makeItem(),
      model: "qwen-max",
      apiBase: "",
    });

    assert.equal(config.apiBase, "oauth://qwen");
  });

  it("rewrites mismatched OAuth markers to the detected provider marker", function () {
    setPluginPref(
      "oauthModelListCache",
      JSON.stringify({ qwen: [{ id: "qwen-max" }] }),
    );

    const config = chatModule.resolveEffectiveRequestConfig({
      item: makeItem(),
      model: "qwen-max",
      apiBase: "oauth://openai-codex",
    });

    assert.equal(config.apiBase, "oauth://qwen");
  });

  it("uses the mode-aware custom primary profile when chat requests omit overrides", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://custom.example/v1");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");
    setPluginPref("apiBasePrimary", "oauth://openai-codex");
    setPluginPref("apiKeyPrimary", "oauth-key");
    setPluginPref("modelPrimary", "oauth-model");

    const config = chatModule.resolveEffectiveRequestConfig({
      item: makeItem(),
    });

    assert.equal(config.apiBase, "https://custom.example/v1");
    assert.equal(config.apiKey, "custom-key");
    assert.equal(config.model, "custom-model");
  });

  it("throws when custom mode is missing model", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "https://custom.example/v1");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "   ");

    assert.throws(
      () =>
        chatModule.resolveEffectiveRequestConfig({
          item: makeItem(),
        }),
      "Custom mode requires Model before sending",
    );
  });

  it("throws when custom mode is missing API Base URL", function () {
    setPluginPref("primaryConnectionMode", "custom");
    setPluginPref("apiBase", "");
    setPluginPref("apiKey", "custom-key");
    setPluginPref("model", "custom-model");

    assert.throws(
      () =>
        chatModule.resolveEffectiveRequestConfig({
          item: makeItem(),
        }),
      "Custom mode requires API Base URL before sending",
    );
  });
});
