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
  it("uses the v3.2.5 notice id", function () {
    assert.equal(NOTICE_ID, "v3.2.5-pdf-translation-and-streaming-fixes-v1");
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

  it("contains the approved fixes without release-only attribution", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);
      assert.include(allCopy, "Codex OAuth", `${uiCode}.provider`);
      assert.include(allCopy, "Zotero", `${uiCode}.restart`);
      assert.notMatch(allCopy, /@[A-Za-z0-9_-]+/, `${uiCode}.attribution`);
    }

    const english = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["en-US"]);
    assert.include(english, "HTTP 502");
    assert.include(english, "SSL EOF");
    assert.include(english, "created or updated");
    assert.include(english, "timestamps");
    assert.include(english, "blank lines");

    const chinese = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["zh-CN"]);
    assert.include(chinese, "HTTP 502");
    assert.include(chinese, "SSL EOF");
    assert.include(chinese, "生成或更新");
    assert.include(chinese, "日志时间");
    assert.include(chinese, "空行");
  });
});
