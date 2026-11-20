import { assert } from "chai";

describe("translate output folder option", function () {
  let prefs: typeof import("../../src/modules/pdfTranslator/translatePrefs");
  let store: Map<string, unknown>;
  let original: unknown;
  const key = (name: string) => `extensions.zotero.aidea.${name}`;

  before(async function () {
    original = (globalThis as any).Zotero;
    (globalThis as any).Zotero = {
      Prefs: {
        get: (name: string) => store.get(name),
        set: (name: string, value: unknown) => store.set(name, value),
      },
    };
    prefs = await import("../../src/modules/pdfTranslator/translatePrefs");
  });

  after(function () {
    (globalThis as any).Zotero = original;
  });

  beforeEach(function () {
    store = new Map();
    (globalThis as any).Zotero.Prefs.get = (name: string) => store.get(name);
    (globalThis as any).Zotero.Prefs.set = (name: string, value: unknown) =>
      store.set(name, value);
  });

  it("starts on for someone who already saved to a folder", function () {
    store.set(key("translate.outputDir"), "/Users/me/Translations");
    assert.isTrue(prefs.isSaveToOutputDirEnabled());
    assert.isTrue(store.get(key("translate.outputSaveToDir")));
  });

  it("starts off for a new user and does not flip when a folder is typed in", function () {
    assert.isFalse(prefs.isSaveToOutputDirEnabled());
    store.set(key("translate.outputDir"), "/Users/me/Translations");
    assert.isFalse(prefs.isSaveToOutputDirEnabled());
  });

  it("honours older numeric and string choices instead of guessing from the folder", function () {
    for (const value of [0, "false", "0", " FALSE "]) {
      store.set(key("translate.outputDir"), "/chosen");
      store.set(key("translate.outputSaveToDir"), value);
      assert.isFalse(prefs.isSaveToOutputDirEnabled());
    }
  });

  it("keeps an explicit choice", function () {
    store.set(key("translate.outputDir"), "/Users/me/Translations");
    store.set(key("translate.outputSaveToDir"), false);
    assert.isFalse(prefs.isSaveToOutputDirEnabled());
  });
});
