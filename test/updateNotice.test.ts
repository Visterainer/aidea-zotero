import { assert } from "chai";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { config } from "../package.json";

import {
  CURRENT_UPDATE_NOTICE_COPIES,
  NOTICE_ID,
} from "../src/modules/updateNotice";
import {
  UI_LANGUAGE_OPTIONS,
  getUiLanguageOption,
} from "../src/modules/contextPanel/languages";

// A fresh module context models an add-on reload or Zotero restart while the
// same preference map models persisted profile settings. No real UI is opened.
const noticeCode = ts.transpileModule(
  readFileSync(
    new URL("../src/modules/updateNotice.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const noticePref = `${config.prefsPrefix}.updateNoticeSeen`;

function loadNoticeRuntime(prefs = new Map<string, unknown>(), lang = "en-US") {
  const dialogs: FakeDialog[] = [];
  class FakeDialog {
    body: any;
    title = "";
    options: any;
    buttons: Array<{ label: string; id: string; callback: () => void }> = [];
    unloadCallback = () => {};
    closed = false;
    window = {
      document: { getElementById: () => null, querySelector: () => null },
      close: () => {
        this.closed = true;
        this.unloadCallback();
      },
    };
    constructor() {
      dialogs.push(this);
    }
    addCell(_row: number, _column: number, body: any) {
      this.body = body;
      return this;
    }
    addButton(label: string, id: string, options: { callback: () => void }) {
      this.buttons.push({ label, id, callback: options.callback });
      return this;
    }
    setDialogData(data: { unloadCallback: () => void }) {
      this.unloadCallback = data.unloadCallback;
      return this;
    }
    open(title: string, options: any) {
      this.title = title;
      this.options = options;
      return this;
    }
  }
  const exports: any = {};
  runInNewContext(noticeCode, {
    exports,
    require: (name: string) => {
      if (name === "zotero-plugin-toolkit") return { DialogHelper: FakeDialog };
      if (name === "../../package.json") return { config };
      if (name === "./contextPanel/i18n") return { getPanelLang: () => lang };
      if (name === "./contextPanel/languages") return { getUiLanguageOption };
      if (name === "./contextPanel/theme")
        return { applyCurrentThemeToRoot: () => {} };
      throw new Error(`Unexpected notice dependency: ${name}`);
    },
    Zotero: {
      Prefs: {
        get: (key: string, global: boolean) => {
          assert.isTrue(global);
          return prefs.get(key);
        },
        set: (key: string, value: unknown, global: boolean) => {
          assert.isTrue(global);
          prefs.set(key, value);
        },
      },
    },
    ztoolkit: {
      log: (...args: unknown[]) => {
        throw new Error(args.map(String).join(" "));
      },
    },
    addon: { data: {} },
  });
  return { dialogs, show: () => exports.maybeShowOpenAIUpdateNotice({}) };
}

describe("one-time update notice", function () {
  it("uses the v3.5.2 notice id", function () {
    assert.equal(NOTICE_ID, "v3.5.2-natural-responses-math-v1");
  });

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
      assert.include(copy.title, "v3.5.2", `${uiCode}.version`);
      assert.isAbove(
        copy.alsoLabel?.trim().length || 0,
        0,
        `${uiCode}.alsoLabel`,
      );
      assert.lengthOf(copy.alsoItems || [], 6, `${uiCode}.alsoItems`);
      for (const item of copy.alsoItems || []) {
        assert.isAbove(item.label.trim().length, 0, `${uiCode}.item.label`);
        assert.isAbove(item.text.trim().length, 0, `${uiCode}.item.text`);
      }
      assert.include(
        copy.alsoItems?.[5].text,
        "Zotero",
        `${uiCode}.persistence`,
      );
      assert.isEmpty(copy.exampleLabel, `${uiCode}.exampleLabel`);
      assert.isEmpty(copy.examplePrompt, `${uiCode}.examplePrompt`);
      assert.isUndefined(copy.modeItems, `${uiCode}.modeItems`);
      if (uiCode !== "en-US") {
        assert.notEqual(copy.title, english.title, `${uiCode}.title`);
      }
    }
  });

  it("contains the approved scope and order without release-only attribution", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);
      assert.include(allCopy, "Zotero", `${uiCode}.zotero`);
      assert.notMatch(
        allCopy,
        /@[A-Za-z0-9_-]+|#\d+|Aaaanano|siyuanj|dependabot/i,
        `${uiCode}.attribution`,
      );
    }

    const english = CURRENT_UPDATE_NOTICE_COPIES["en-US"];
    assert.deepEqual(
      english.alsoItems?.map((item) => item.label),
      [
        "Task-focused answers",
        "Custom response style",
        "Independent task prompts",
        "Numeric math fix",
        "Long-document fallback",
        "Annotations and remembered choices",
      ],
    );
    assert.include(
      english.alsoItems?.[1].text,
      "Existing custom prompts are preserved",
    );
    assert.include(
      english.alsoItems?.[2].text,
      "unaffected by custom chat instructions",
    );
    assert.include(english.alsoItems?.[3].text, "currency and code snippets");
    assert.include(english.alsoItems?.[4].text, "selection-only translation");
    assert.include(
      english.alsoItems?.[5].text,
      "without overwriting existing comments",
    );
    assert.include(english.note, "off by default");
    assert.include(
      english.note,
      "wait for the translation before choosing a highlight color",
    );

    const chinese = CURRENT_UPDATE_NOTICE_COPIES["zh-CN"];
    assert.deepEqual(
      chinese.alsoItems?.map((item) => item.label),
      [
        "回答更贴合问题",
        "自定义回答风格",
        "内部任务独立",
        "数字公式显示修复",
        "长文档自动兜底",
        "标注与选项记忆",
      ],
    );
    assert.include(chinese.alsoItems?.[1].text, "已有自定义内容不会被覆盖");
    assert.include(chinese.alsoItems?.[2].text, "不受自定义对话风格影响");
    assert.include(chinese.alsoItems?.[3].text, "金额与代码片段");
    assert.include(chinese.alsoItems?.[4].text, "最终仅翻译选中文本");
    assert.include(chinese.alsoItems?.[5].text, "已有批注不会被覆盖");
    assert.equal(
      chinese.note,
      "更新后请重启 Zotero。“将译文写入标注”默认关闭；开启后，请等待译文生成，再选择高亮颜色。",
    );
  });

  describe("one-time update notice runtime", function () {
    it("does not open duplicate notices while the first is showing", function () {
      const runtime = loadNoticeRuntime();
      runtime.show();
      runtime.show();
      runtime.show();
      assert.lengthOf(runtime.dialogs, 1);
    });

    it("shows the new version after an old notice and persists confirmation across restart", function () {
      const prefs = new Map<string, unknown>([
        [noticePref, "v3.5.1-selection-translation-persistence-v1"],
      ]);
      const runtime = loadNoticeRuntime(prefs);
      runtime.show();
      assert.lengthOf(runtime.dialogs, 1);
      runtime.dialogs[0].buttons[0].callback();
      assert.isTrue(runtime.dialogs[0].closed);
      assert.equal(prefs.get(noticePref), NOTICE_ID);
      runtime.show();
      assert.lengthOf(runtime.dialogs, 1);
      const restarted = loadNoticeRuntime(prefs);
      restarted.show();
      assert.isEmpty(restarted.dialogs);
    });

    it("persists dismissal through the window close button across restart", function () {
      const prefs = new Map<string, unknown>();
      const runtime = loadNoticeRuntime(prefs);
      runtime.show();
      runtime.dialogs[0].window.close();
      assert.equal(prefs.get(noticePref), NOTICE_ID);
      const restarted = loadNoticeRuntime(prefs);
      restarted.show();
      assert.isEmpty(restarted.dialogs);
    });

    it("does not show an already-seen version even after a language change", function () {
      const prefs = new Map<string, unknown>([[noticePref, NOTICE_ID]]);
      for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
        const runtime = loadNoticeRuntime(prefs, uiCode);
        runtime.show();
        assert.isEmpty(runtime.dialogs, uiCode);
      }
    });

    it("renders six localized items, the language direction, and only one confirmation button", function () {
      for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
        const runtime = loadNoticeRuntime(undefined, uiCode);
        runtime.show();
        assert.lengthOf(runtime.dialogs, 1, uiCode);
        const dialog = runtime.dialogs[0];
        const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
        assert.equal(dialog.title, copy.title, uiCode);
        assert.equal(
          dialog.body.attributes.dir,
          getUiLanguageOption(uiCode).dir,
          uiCode,
        );
        const card = dialog.body.children[3];
        assert.lengthOf(card.children, 7, uiCode);
        for (const [index, item] of (copy.alsoItems || []).entries()) {
          assert.include(
            card.children[index + 1].children[0].properties.innerText,
            item.label,
            uiCode,
          );
          assert.equal(
            card.children[index + 1].children[1].properties.innerText,
            item.text,
            uiCode,
          );
        }
        assert.lengthOf(dialog.body.children, 5, uiCode);
        assert.equal(
          dialog.body.children[4].properties.innerText,
          copy.note,
          uiCode,
        );
        assert.lengthOf(dialog.buttons, 1, uiCode);
        assert.equal(dialog.buttons[0].label, copy.confirm, uiCode);
        assert.isTrue(dialog.options.fitContent, uiCode);
      }
    });

    it("falls back to the current English copy for an unknown language", function () {
      const runtime = loadNoticeRuntime(undefined, "unknown");
      runtime.show();
      assert.equal(
        runtime.dialogs[0].title,
        CURRENT_UPDATE_NOTICE_COPIES["en-US"].title,
      );
    });
  });
});
