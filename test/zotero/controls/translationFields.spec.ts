import { assert } from "chai";
import { config } from "../../../package.json";
import {
  bindTranslationChoices,
  createLanguagePair,
} from "../../../src/modules/pdfTranslator/translationFields";

// A real Gecko document: Node cannot measure form-control layout or focus.
// Mocha's Zotero runner has its own disposable profile.
describe("translation language pair", function () {
  it("keeps both fields aligned through swaps and restores the saved pair", async function () {
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = "chrome://aidea/content/zoteroPane.css";
    const loaded = new Promise<void>((ok, fail) => {
      sheet.onload = () => ok();
      sheet.onerror = () => fail(new Error("Plugin stylesheet unavailable"));
    });
    document.head.append(sheet);
    const root = document.createElement("div");
    root.className = "llm-panel";
    document.body.append(root);
    const keys = ["sourceLang", "targetLang"].map(
      (k) => `${config.prefsPrefix}.translate.${k}`,
    );
    const prev = keys.map((k) => Zotero.Prefs.get(k, true));
    const mount = () => {
      root.replaceChildren(
        createLanguagePair(document, {
          trSourceLang: "源语言",
          trTargetLang: "目标语言",
          swapLanguages: "交换语言",
        }),
      );
      bindTranslationChoices(root);
    };
    try {
      await loaded;
      Zotero.Prefs.set(keys[0], "en", true);
      Zotero.Prefs.set(keys[1], "zh-CN", true);
      mount();
      const source = root.querySelector<HTMLSelectElement>(
        "#llm-tr-source-lang",
      )!;
      const target = root.querySelector<HTMLSelectElement>(
        "#llm-tr-target-lang",
      )!;
      const swap = root.querySelector<HTMLButtonElement>("#llm-tr-lang-swap")!;
      assert.equal(
        source.labels?.[0]?.querySelector(".llm-tr-field-label")?.textContent,
        "源语言",
      );
      assert.equal(swap.getAttribute("aria-label"), "交换语言");
      const bounds = () => {
        const { x: left, y: top } = root.getBoundingClientRect();
        return [source, swap, target].map((el) => {
          const { x, y, width, height } = el.getBoundingClientRect();
          return [x - left, y - top, width, height];
        });
      };
      const assertSameBounds = (before: number[][]) => {
        const after = bounds().flat();
        before.flat().forEach((value, index) => {
          assert.closeTo(after[index], value, 0.1);
        });
      };
      for (const width of [220, 360, 720]) {
        root.style.width = `${width}px`;
        for (const direction of ["ltr", "rtl"]) {
          root.dir = direction;
          const before = bounds();
          assert.isAbove(before[0][3], 0);
          assert.closeTo(before[0][3], before[2][3], 0.1);
          assert.closeTo(before[0][1], before[1][1], 0.1);
          assert.closeTo(before[0][1], before[2][1], 0.1);
          swap.focus();
          swap.click();
          assert.equal(document.activeElement, swap);
          assertSameBounds(before);
          assert.equal(source.value, "zh-CN");
          assert.equal(target.value, "en");
          swap.click();
          assertSameBounds(before);
        }
      }
      target.value = "ja";
      target.dispatchEvent(new Event("change", { bubbles: true }));
      swap.click();
      mount();
      assert.equal(
        root.querySelector<HTMLSelectElement>("#llm-tr-source-lang")!.value,
        "ja",
      );
      assert.equal(
        root.querySelector<HTMLSelectElement>("#llm-tr-target-lang")!.value,
        "en",
      );
    } finally {
      keys.forEach((k, i) => {
        if (prev[i] == null) Zotero.Prefs.clear(k, true);
        else Zotero.Prefs.set(k, prev[i], true);
      });
      root.remove();
      sheet.remove();
    }
  });
});
