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
  it("uses the v3.5.0 notice id", function () {
    assert.equal(NOTICE_ID, "v3.5.0-selection-translation-reliability-v1");
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

  it("contains the approved selection translation scope without release-only attribution", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);
      assert.include(allCopy, "Zotero", `${uiCode}.zotero`);
      assert.notMatch(
        allCopy,
        /@[A-Za-z0-9_-]+|#79|Aaaanano/,
        `${uiCode}.attribution`,
      );
    }

    const english = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["en-US"]);
    assert.include(english, "Reliable selection translation");
    assert.include(english, "Automatic retries for long documents");
    assert.include(english, "Selection-only fallback");
    assert.include(english, "Write translation to annotation");
    assert.include(english, "Existing comments are preserved");

    const chinese = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["zh-CN"]);
    assert.include(chinese, "划词翻译自动兜底与双语标注");
    assert.include(chinese, "长文档自动重试");
    assert.include(chinese, "超长失败自动兜底");
    assert.include(chinese, "将译文写入标注");
    assert.include(chinese, "安全保留已有批注");
  });
});
