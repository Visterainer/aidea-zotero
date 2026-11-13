import { assert } from "chai";
import type {
  QueueItem,
  QueueState,
} from "../../src/modules/pdfTranslator/translationQueue";

describe("translation queue view and strings", function () {
  let view: typeof import("../../src/modules/pdfTranslator/translateQueueView");
  let i18n: typeof import("../../src/modules/pdfTranslator/queueI18n");
  let languages: typeof import("../../src/modules/contextPanel/languages");
  const original: Record<string, unknown> = {};

  const item = (extra: Partial<QueueItem>): QueueItem =>
    ({
      id: "q1",
      attachmentID: 1,
      title: "Paper",
      status: "queued",
      percent: 0,
      modelName: "m",
      providerId: "p",
      options: {},
      output: { attach: true, saveDir: "" },
      addedAt: 0,
      ...extra,
    }) as QueueItem;

  before(async function () {
    for (const name of ["Zotero", "ztoolkit"]) {
      original[name] = (globalThis as any)[name];
    }
    (globalThis as any).Zotero = (globalThis as any).Zotero || {
      Prefs: { get: () => undefined, set: () => undefined },
    };
    (globalThis as any).ztoolkit = (globalThis as any).ztoolkit || {
      log: () => undefined,
      getGlobal: () => undefined,
    };
    view = await import("../../src/modules/pdfTranslator/translateQueueView");
    i18n = await import("../../src/modules/pdfTranslator/queueI18n");
    languages = await import("../../src/modules/contextPanel/languages");
  });

  after(function () {
    for (const [name, value] of Object.entries(original)) {
      (globalThis as any)[name] = value;
    }
  });

  it("describes a row by its status", function () {
    const strings = i18n.getQueueCopy("en-US");
    assert.equal(
      view.describeQueueItem(
        item({ status: "running", percent: 42, pageCurrent: 5, pageTotal: 12 }),
        strings,
      ),
      "Translating 42% · 5/12",
    );
    assert.equal(
      view.describeQueueItem(
        item({ status: "failed", error: "bad pdf\nstack trace" }),
        strings,
      ),
      "Failed: bad pdf",
    );
    assert.equal(
      view.describeQueueItem(item({ status: "queued" }), strings),
      "Queued",
    );
  });

  it("offers only the actions that make sense for a row", function () {
    const actions = view.queueRowActions;
    assert.deepEqual(actions(item({ status: "running" })), ["cancel"]);
    assert.deepEqual(actions(item({ status: "queued" })), ["first", "cancel"]);
    assert.deepEqual(actions(item({ status: "interrupted" })), [
      "first",
      "cancel",
    ]);
    assert.deepEqual(actions(item({ status: "done", resultItemIDs: [9] })), [
      "open",
      "remove",
    ]);
    assert.deepEqual(actions(item({ status: "done" })), ["remove"]);
    assert.deepEqual(actions(item({ status: "failed" })), ["retry", "remove"]);
    assert.deepEqual(actions(item({ status: "skipped" })), ["retry", "remove"]);
  });

  it("counts finished documents without the skipped ones", function () {
    const state: QueueState = {
      paused: false,
      items: [
        item({ status: "done" }),
        item({ status: "failed" }),
        item({ status: "skipped" }),
        item({ status: "running" }),
        item({ status: "queued" }),
      ],
    };
    assert.deepEqual(view.queueProgressCounts(state), {
      finished: 2,
      total: 4,
    });
  });

  it("has complete strings for every panel language", function () {
    const reference = i18n.getQueueCopy("en-US");
    const codes = languages.UI_LANGUAGE_OPTIONS.map((entry) => entry.uiCode);
    assert.isAtLeast(codes.length, 12);
    for (const code of codes) {
      const strings = i18n.getQueueCopy(code as any);
      if (code !== "en-US") {
        assert.notEqual(strings.title, reference.title, code);
      }
      assert.include(strings.menuAdd(3), "3", code);
      assert.include(strings.menuStop(40), "40", code);
      assert.include(strings.progress(2, 5, 42), "42", code);
      assert.include(strings.batchDone(7, 8, 9), "7", code);
      assert.sameMembers(
        Object.keys(strings.status),
        Object.keys(reference.status),
        code,
      );
      assert.sameMembers(
        Object.keys(strings.pause),
        Object.keys(reference.pause),
        code,
      );
    }
    assert.equal(
      i18n.describeAddResult(reference, {
        added: 3,
        skipped: 1,
        duplicates: 0,
        withoutPdf: 2,
      }),
      "3 added to the queue; 1 skipped (already translated); 2 without a PDF",
    );
  });
});
