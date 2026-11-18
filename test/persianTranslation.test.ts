import { assert } from "chai";
import {
  detectPanelLangFromLocale,
  getUiLanguageOption,
  normalizeUiLanguageCode,
  translationTextDirection,
  TRANSLATION_LANGUAGE_OPTIONS,
} from "../src/modules/contextPanel/languages";
import { confirmPdfLayout } from "../src/modules/pdfTranslator/persianLayout";
import { generateConfigToml } from "../src/modules/pdfTranslator/configWriter";

describe("Persian translation", function () {
  it("normalizes Persian locales and exposes one Persian translation target distinct from Arabic", function () {
    for (const tag of ["fa", "fa-IR", "fa_IR", "FA-ir"]) {
      assert.equal(normalizeUiLanguageCode(tag), "fa-IR");
      assert.equal(detectPanelLangFromLocale(tag), "fa-IR");
    }
    assert.equal(detectPanelLangFromLocale("false"), "en-US");
    assert.include(getUiLanguageOption("fa-IR"), {
      dir: "rtl",
      htmlLang: "fa",
      label: "فارسی",
    });
    assert.deepEqual(
      TRANSLATION_LANGUAGE_OPTIONS.filter((o) => o.code === "fa"),
      [{ code: "fa", label: "فارسی" }],
    );
    assert.equal(translationTextDirection("fa"), "rtl");
    assert.equal(translationTextDirection("en"), "ltr");
  });

  it("preserves fa in the actual engine configuration", function () {
    const config = generateConfigToml({
      model: "test",
      apiKey: "fixture",
      apiUrl: "http://127.0.0.1:1/v1",
      sourceLang: "en",
      targetLang: "fa",
      qps: 1,
      noMono: false,
      noDual: false,
    });
    assert.include(config, 'lang_out = "fa"');
    assert.include(config, "no_dual = false");
    assert.include(config, "no_mono = false");
  });

  it("does not start an experimental Persian PDF export without confirmation", function () {
    let prompts = 0;
    const reject = (message: string) => {
      prompts++;
      assert.include(message, "فارسی");
      return false;
    };
    assert.isTrue(confirmPdfLayout("en", "fa-IR", reject));
    assert.equal(prompts, 0);
    assert.isFalse(confirmPdfLayout("fa", "fa-IR", reject));
    assert.equal(prompts, 1);
    assert.isTrue(
      confirmPdfLayout("fa-IR", "zh-CN", (message) =>
        message.includes("波斯语"),
      ),
    );
  });
});
