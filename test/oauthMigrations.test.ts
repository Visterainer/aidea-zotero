import { assert } from "chai";
import { migrateRemovedGeminiOAuth } from "../src/utils/oauthMigrations";

describe("removed Gemini CLI OAuth migration", function () {
  const globals = globalThis as any;
  const P = "extensions.zotero.aidea.";
  let originalZotero: unknown;
  let prefs: Map<string, unknown>;

  beforeEach(function () {
    originalZotero = globals.Zotero;
    prefs = new Map();
    globals.Zotero = {
      Prefs: {
        get: (k: string) => prefs.get(k),
        set: (k: string, v: unknown) => prefs.set(k, v),
      },
    };
  });

  afterEach(function () {
    globals.Zotero = originalZotero;
  });

  it("resets profiles, caches, provider picks and tokens that used Gemini OAuth", function () {
    prefs.set(`${P}apiBaseSecondary`, "oauth://google-gemini-cli");
    prefs.set(`${P}modelSecondary`, "gemini-2.5-pro");
    prefs.set(`${P}apiBasePrimary`, "oauth://openai-codex");
    prefs.set(`${P}modelPrimary`, "gpt-5.3-codex");
    prefs.set(
      `${P}oauthModelListCache`,
      JSON.stringify({
        "openai-codex": [{ id: "gpt-5.3-codex", label: "Codex" }],
        "google-gemini-cli": [{ id: "gemini-2.5-pro", label: "Gemini" }],
      }),
    );
    prefs.set(
      `${P}oauthModelSelectionCache`,
      JSON.stringify({ "google-gemini-cli": ["gemini-2.5-pro"] }),
    );
    prefs.set(`${P}selectionTranslate.provider`, "google-gemini-cli");
    prefs.set(`${P}lastUsedModelProvider`, "Gemini");
    prefs.set(`${P}authorProfiles.provider`, "openai-codex");
    prefs.set(`${P}geminiOAuthAccessToken`, "token");
    prefs.set(`${P}geminiOAuthProjectId`, "project");

    assert.isTrue(migrateRemovedGeminiOAuth());

    assert.equal(prefs.get(`${P}apiBaseSecondary`), "oauth://github-copilot");
    assert.equal(prefs.get(`${P}modelSecondary`), "");
    assert.equal(prefs.get(`${P}apiBasePrimary`), "oauth://openai-codex");
    assert.equal(prefs.get(`${P}modelPrimary`), "gpt-5.3-codex");
    assert.deepEqual(JSON.parse(String(prefs.get(`${P}oauthModelListCache`))), {
      "openai-codex": [{ id: "gpt-5.3-codex", label: "Codex" }],
    });
    assert.deepEqual(
      JSON.parse(String(prefs.get(`${P}oauthModelSelectionCache`))),
      {},
    );
    assert.equal(prefs.get(`${P}selectionTranslate.provider`), "");
    assert.equal(prefs.get(`${P}lastUsedModelProvider`), "");
    assert.equal(prefs.get(`${P}authorProfiles.provider`), "openai-codex");
    assert.equal(prefs.get(`${P}geminiOAuthAccessToken`), "");
    assert.equal(prefs.get(`${P}geminiOAuthProjectId`), "");
  });

  it("is a no-op for installs that never used Gemini OAuth", function () {
    prefs.set(`${P}apiBasePrimary`, "oauth://openai-codex");
    prefs.set(
      `${P}oauthModelListCache`,
      JSON.stringify({ "openai-codex": [] }),
    );
    prefs.set(`${P}oauthModelSelectionCache`, "not json");

    assert.isFalse(migrateRemovedGeminiOAuth());

    assert.equal(prefs.get(`${P}apiBasePrimary`), "oauth://openai-codex");
    assert.equal(prefs.get(`${P}oauthModelSelectionCache`), "not json");
  });
});
