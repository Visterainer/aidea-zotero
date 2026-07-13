import { assert } from "chai";

import { CURRENT_UPDATE_NOTICE_COPIES } from "../src/modules/updateNotice";
import {
  UI_LANGUAGE_OPTIONS,
  type PanelLang,
} from "../src/modules/contextPanel/languages";

const MODEL_IDS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"] as const;

const SETTINGS_PATH_SEGMENTS: Record<PanelLang, readonly string[]> = {
  "en-US": ["Setting", "Model Config", "OAuth Providers", "Install/Update Env"],
  "zh-CN": ["设置", "模型配置", "OAuth 提供商", "安装/更新环境"],
  "zh-TW": ["設定", "模型設定", "OAuth 提供商", "安裝/更新環境"],
  "ja-JP": [
    "設定",
    "モデル設定",
    "OAuth プロバイダー",
    "環境をインストール/更新",
  ],
  "ko-KR": ["설정", "모델 설정", "OAuth 제공자", "환경 설치/업데이트"],
  "fr-FR": [
    "Paramètres",
    "Configuration du modèle",
    "Fournisseurs OAuth",
    "Installer/mettre à jour l’environnement",
  ],
  "de-DE": [
    "Einstellungen",
    "Modellkonfiguration",
    "OAuth-Anbieter",
    "Umgebung installieren/aktualisieren",
  ],
  "es-ES": [
    "Configuración",
    "Configuración del modelo",
    "Proveedores OAuth",
    "Instalar/actualizar entorno",
  ],
  "ru-RU": [
    "Настройки",
    "Настройка модели",
    "Поставщики OAuth",
    "Установить/обновить среду",
  ],
  "pt-BR": [
    "Configurações",
    "Configuração do modelo",
    "Provedores OAuth",
    "Instalar/atualizar ambiente",
  ],
  "ar-SA": [
    "الإعدادات",
    "إعدادات النموذج",
    "موفرو OAuth",
    "تثبيت/تحديث البيئة",
  ],
  "hi-IN": [
    "सेटिंग्स",
    "मॉडल कॉन्फ़िगरेशन",
    "OAuth प्रदाता",
    "Environment इंस्टॉल/अपडेट करें",
  ],
};

describe("one-time update notice", function () {
  it("provides complete localized copy for every panel language", function () {
    assert.deepEqual(
      Object.keys(CURRENT_UPDATE_NOTICE_COPIES).sort(),
      UI_LANGUAGE_OPTIONS.map(({ uiCode }) => uiCode).sort(),
    );

    const english = CURRENT_UPDATE_NOTICE_COPIES["en-US"];
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      assert.isAbove(copy.eyebrow.trim().length, 0, `${uiCode}.eyebrow`);
      assert.isAbove(copy.title.trim().length, 0, `${uiCode}.title`);
      assert.isAbove(copy.lead.trim().length, 0, `${uiCode}.lead`);
      assert.isAbove(copy.note.trim().length, 0, `${uiCode}.note`);
      assert.isAbove(copy.confirm.trim().length, 0, `${uiCode}.confirm`);
      assert.isAbove(copy.close.trim().length, 0, `${uiCode}.close`);
      assert.lengthOf(copy.alsoItems || [], 5, `${uiCode}.alsoItems`);
      assert.isAbove(
        copy.exampleLabel.trim().length,
        0,
        `${uiCode}.exampleLabel`,
      );
      assert.isAbove(
        copy.examplePrompt.trim().length,
        0,
        `${uiCode}.examplePrompt`,
      );
      if (uiCode !== "en-US") {
        assert.notEqual(copy.title, english.title, `${uiCode}.title`);
      }
    }
  });

  it("lists every new model and the localized environment-update path", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);

      for (const modelId of MODEL_IDS) {
        assert.include(allCopy, modelId, `${uiCode}.${modelId}`);
      }
      assert.include(
        copy.examplePrompt,
        "ChatGPT (Codex OAuth)",
        `${uiCode}.provider`,
      );
      for (const segment of SETTINGS_PATH_SEGMENTS[uiCode]) {
        assert.include(
          copy.examplePrompt,
          segment,
          `${uiCode}.path.${segment}`,
        );
      }
    }
  });
});
