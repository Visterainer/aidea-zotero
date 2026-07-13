import { assert } from "chai";

import { getPanelI18n } from "../src/modules/contextPanel/i18n";
import { UI_LANGUAGE_OPTIONS } from "../src/modules/contextPanel/languages";

const READINESS_KEYS = [
  "chatReadinessTitle",
  "chatReadinessNoModels",
  "chatReadinessSelectModel",
  "chatReadinessCustomConfig",
  "chatReadinessOpenSettings",
] as const;

const PLACEHOLDER_TIP_KEYS = [
  "placeholderGlobalTips",
  "placeholderPaperTips",
] as const;

const SELECTION_TRANSLATE_ACTION_KEYS = [
  "copy",
  "copied",
  "addToNote",
  "addingToNote",
  "addedToNote",
  "addToNoteFailed",
] as const;

describe("context panel i18n", function () {
  let uiLanguage = "en-US";
  let previousZotero: unknown;

  before(function () {
    previousZotero = (globalThis as any).Zotero;
    (globalThis as any).Zotero = {
      locale: "en-US",
      Prefs: {
        get(key: string) {
          return key.endsWith(".uiLanguage") ? uiLanguage : "";
        },
      },
    };
  });

  after(function () {
    (globalThis as any).Zotero = previousZotero;
  });

  it("localizes chat readiness labels for every supported panel language", function () {
    assert.deepEqual(
      UI_LANGUAGE_OPTIONS.map((language) => language.uiCode),
      [
        "en-US",
        "zh-CN",
        "zh-TW",
        "ja-JP",
        "ko-KR",
        "fr-FR",
        "de-DE",
        "es-ES",
        "ru-RU",
        "pt-BR",
        "ar-SA",
        "hi-IN",
      ],
    );

    uiLanguage = "en-US";
    const english = getPanelI18n();

    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      uiLanguage = uiCode;
      const labels = getPanelI18n();

      for (const key of READINESS_KEYS) {
        const value = labels[key];
        assert.isString(value, `${uiCode}.${key}`);
        assert.isAbove(value.trim().length, 0, `${uiCode}.${key}`);
        if (uiCode !== "en-US") {
          assert.notEqual(value, english[key], `${uiCode}.${key}`);
        }
      }
    }
  });

  it("localizes chat placeholder tips for every supported panel language", function () {
    uiLanguage = "en-US";
    const english = getPanelI18n();

    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      uiLanguage = uiCode;
      const labels = getPanelI18n();

      for (const key of PLACEHOLDER_TIP_KEYS) {
        const value = labels[key];
        assert.isArray(value, `${uiCode}.${key}`);
        assert.lengthOf(value, 4, `${uiCode}.${key}`);
        for (const tip of value) {
          assert.isString(tip, `${uiCode}.${key}`);
          assert.isAbove(tip.trim().length, 0, `${uiCode}.${key}`);
        }
        if (uiCode !== "en-US") {
          assert.notDeepEqual(value, english[key], `${uiCode}.${key}`);
        }
      }
    }
  });

  it("provides selection translate action labels for every supported language", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      uiLanguage = uiCode;
      const labels = getPanelI18n();
      for (const key of SELECTION_TRANSLATE_ACTION_KEYS) {
        assert.isString(labels[key], `${uiCode}.${key}`);
        assert.isAbove(labels[key].trim().length, 0, `${uiCode}.${key}`);
      }
    }
  });
});
