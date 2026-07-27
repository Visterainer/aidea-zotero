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
  it("uses the v3.3.0 notice id", function () {
    assert.equal(NOTICE_ID, "v3.3.0-epub-selection-translation-v1");
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

  it("contains the approved EPUB selection scope without release-only attribution", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);
      assert.include(allCopy, "EPUB", `${uiCode}.epub`);
      assert.include(allCopy, "PDF", `${uiCode}.pdf`);
      assert.include(allCopy, "Zotero", `${uiCode}.restart`);
      assert.notMatch(allCopy, /@[A-Za-z0-9_-]+/, `${uiCode}.attribution`);
    }

    const english = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["en-US"]);
    assert.include(english, "automatically");
    assert.include(english, "active reader");
    assert.include(english, "empty EPUB caches");
    assert.include(english, "PDF side-panel chat remain unchanged");
    assert.include(english, "Full-document translation is unchanged");

    const chinese = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["zh-CN"]);
    assert.include(chinese, "自动识别");
    assert.include(chinese, "当前正在阅读的附件");
    assert.include(chinese, "自动重试 EPUB 缓存");
    assert.include(chinese, "PDF 侧栏对话保持原有行为");
    assert.include(chinese, "全文翻译功能没有变化");
  });
});
