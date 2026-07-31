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
  it("uses the v3.3.2 notice id", function () {
    assert.equal(NOTICE_ID, "v3.3.2-model-output-normalization-v1");
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

  it("contains the approved model-output scope without release-only attribution", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);
      assert.include(allCopy, "<think>", `${uiCode}.think`);
      assert.include(allCopy, "<thought>", `${uiCode}.thought`);
      assert.include(allCopy, "MiniMax", `${uiCode}.minimax`);
      assert.include(allCopy, "PDF", `${uiCode}.pdf`);
      assert.include(allCopy, "Zotero", `${uiCode}.restart`);
      assert.notMatch(allCopy, /@[A-Za-z0-9_-]+/, `${uiCode}.attribution`);
    }

    const english = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["en-US"]);
    assert.include(english, "streaming and non-streaming");
    assert.include(english, "selection translation");
    assert.include(english, "full-document translation");
    assert.include(english, "cold-start caches");
    assert.include(english, "Existing notes or PDFs");

    const chinese = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["zh-CN"]);
    assert.include(chinese, "流式和非流式");
    assert.include(chinese, "划词翻译");
    assert.include(chinese, "全文翻译");
    assert.include(chinese, "冷启动缓存");
    assert.include(chinese, "已经写入笔记或生成 PDF");
  });
});
