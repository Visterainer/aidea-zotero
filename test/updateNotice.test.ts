import { assert } from "chai";

import {
  CURRENT_UPDATE_NOTICE_COPIES,
  NOTICE_ID,
} from "../src/modules/updateNotice";
import {
  UI_LANGUAGE_OPTIONS,
  type PanelLang,
} from "../src/modules/contextPanel/languages";

describe("one-time update notice", function () {
  it("uses the v3.4.0 notice id", function () {
    assert.equal(NOTICE_ID, "v3.4.0-epub-context-chat-v1");
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
      assert.lengthOf(copy.alsoItems || [], 4, `${uiCode}.alsoItems`);
      if (uiCode !== "en-US") {
        assert.notEqual(copy.title, english.title, `${uiCode}.title`);
      }
    }
  });

  it("contains the approved EPUB scope without release-only attribution", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);
      assert.include(allCopy, "EPUB", `${uiCode}.epub`);
      assert.include(allCopy, "Zotero", `${uiCode}.zotero`);
      assert.notMatch(allCopy, /@[A-Za-z0-9_-]+/, `${uiCode}.attribution`);
    }

    const english = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["en-US"]);
    assert.include(english, "EPUB side-panel chat");
    assert.include(english, "Local bounded retrieval");
    assert.include(english, "without an additional planning-model request");
    assert.include(english, "without a separate cold-start request");
    assert.include(english, "Panel initialization");

    const chinese = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["zh-CN"]);
    assert.include(chinese, "EPUB 侧边栏对话");
    assert.include(chinese, "本地有界检索");
    assert.include(chinese, "不会额外调用模型规划章节");
    assert.include(chinese, "不再执行单独的冷启动请求");
    assert.include(chinese, "可选迁移失败后面板仍可恢复");
  });
});
