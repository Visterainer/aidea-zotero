import { assert } from "chai";
import {
  getPanelI18n,
  getPanelLang,
} from "../../../src/modules/contextPanel/i18n";
import {
  getUiLanguageOption,
  setTranslationContentLanguage,
} from "../../../src/modules/contextPanel/languages";

describe("Persian text in Zotero", function () {
  it("keeps the translation choice and mixed RTL text independent of the UI language", function () {
    const ui = "extensions.zotero.aidea.uiLanguage",
      target = "extensions.zotero.aidea.translate.targetLang";
    const before = [ui, target].map((k) => Zotero.Prefs.get(k, true));
    const parent = document.createElement("div");
    document.body.append(parent);
    const logical =
      "پژوهشگران چگونه گزارش می‌نویسند؟ نسخهٔ GPT-4.1 (2026) و آزمون ۱۲۳.";
    try {
      Zotero.Prefs.set(target, "fa", true);
      for (const lang of ["zh-CN", "fa-IR", "en-US"] as const) {
        Zotero.Prefs.set(ui, lang, true);
        const loc = getUiLanguageOption(getPanelLang());
        parent.dir = loc.dir;
        parent.lang = loc.htmlLang;
        const labels = getPanelI18n();
        if (lang === "fa-IR") assert.match(labels.tabTranslate, /ترجمه/);
        parent.replaceChildren();
        assert.equal(Zotero.Prefs.get(target, true), "fa");
        const result = document.createElement("div");
        parent.append(result);
        setTranslationContentLanguage(result, "fa");
        result.textContent = logical;
        assert.equal(getComputedStyle(result).direction, "rtl");
        const text = result.firstChild!;
        const position = (start: number) => {
          const r = document.createRange();
          r.setStart(text, start);
          r.setEnd(text, start + 1);
          return r.getBoundingClientRect().x;
        };
        assert.isAbove(position(0), position(8));
        assert.isBelow(
          position(logical.indexOf("GPT")),
          position(logical.indexOf("GPT") + 2),
        );
        const r = document.createRange();
        r.selectNodeContents(result);
        assert.equal(r.toString(), logical);
      }
    } finally {
      parent.remove();
      [ui, target].forEach((k, i) => {
        if (before[i] == null) Zotero.Prefs.clear(k, true);
        else Zotero.Prefs.set(k, before[i], true);
      });
    }
  });
});
