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
  it("uses the v3.4.1 notice id", function () {
    assert.equal(NOTICE_ID, "v3.4.1-zotero-10-compatibility-v1");
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

  it("contains the approved Zotero 10 scope without release-only attribution", function () {
    for (const { uiCode } of UI_LANGUAGE_OPTIONS) {
      const copy = CURRENT_UPDATE_NOTICE_COPIES[uiCode];
      const allCopy = JSON.stringify(copy);
      assert.include(allCopy, "Zotero", `${uiCode}.zotero`);
      assert.include(allCopy, "10.0.x", `${uiCode}.zotero10`);
      assert.include(allCopy, "PDF/EPUB", `${uiCode}.panels`);
      assert.include(allCopy, "manifest.json", `${uiCode}.manifest`);
      assert.notMatch(
        allCopy,
        /@[A-Za-z0-9_-]+|#77|Saywhatyousay|JorgeESantos/,
        `${uiCode}.attribution`,
      );
    }

    const english = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["en-US"]);
    assert.include(english, "Zotero 10 compatibility");
    assert.include(english, "Official installation and updates");
    assert.include(english, "Correct library scope");
    assert.include(english, "Zotero 7–9 retained");
    assert.include(english, "No new modes");

    const chinese = JSON.stringify(CURRENT_UPDATE_NOTICE_COPIES["zh-CN"]);
    assert.include(chinese, "兼容 Zotero 10");
    assert.include(chinese, "官方安装与自动更新兼容");
    assert.include(chinese, "资料库范围修复");
    assert.include(chinese, "保留 Zotero 7–9 支持");
    assert.include(chinese, "不增加新模式");
  });
});
