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

  it("words error codes and flags results that finished with errors", function () {
    const strings = i18n.getQueueCopy("en-US");
    const text = {
      pdfMissing: "No PDF file was found for this item.",
      withErrors: (count: number) => `${count} engine errors`,
    };
    assert.equal(
      view.describeQueueItem(
        item({ status: "failed", error: "@pdf_missing" }),
        strings,
        text,
      ),
      "Failed: No PDF file was found for this item.",
    );
    assert.equal(
      view.describeQueueItem(
        item({ status: "done", warningCount: 3 }),
        strings,
        text,
      ),
      "Done · 3 engine errors",
    );
  });

  it("rebuilds the list only when rows or buttons change", function () {
    const state = (
      percent: number,
      status: QueueItem["status"],
    ): QueueState => ({
      paused: false,
      items: [item({ status, percent })],
    });
    const key = view.queueStructureKey;
    assert.equal(
      key(state(10, "running"), "en-US"),
      key(state(55, "running"), "en-US"),
    );
    assert.notEqual(
      key(state(55, "running"), "en-US"),
      key(state(100, "done"), "en-US"),
    );
    assert.notEqual(
      key(state(10, "running"), "en-US"),
      key(state(10, "running"), "zh-CN"),
    );
    assert.notEqual(
      key(state(0, "queued"), "en-US"),
      key({ ...state(0, "queued"), paused: true, pauseKind: "user" }, "en-US"),
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
    assert.deepEqual(actions(item({ status: "skipped" })), ["remove"]);
    assert.deepEqual(actions(item({ status: "cancelled" })), ["remove"]);
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

  it("reports partial delivery with the failure, even after the engine stopped", function () {
    const strings = i18n.getQueueCopy("en-US");
    const partial = { done: 2, total: 4 };
    for (const status of ["running", "failed", "done"] as const) {
      const line = view.describeQueueItem(
        item({ status, error: "copy failed", deliveryProgress: partial }),
        strings,
      );
      assert.include(line, "2/4");
      if (status === "failed") assert.include(line, "copy failed");
    }
  });

  it("consumes explicit overwrite consent once, without reading or writing a pref", function () {
    const field = { checked: true };
    const body = {
      querySelector: (s: string) => (s === "#llm-tr-overwrite" ? field : null),
    } as Element;
    assert.isTrue(view.takeTabOverwrite(body));
    assert.isFalse(field.checked);
    assert.isFalse(view.takeTabOverwrite(body));
  });

  it("accepts only explicit Zotero IDs, never borrowing the selection or reading files", async function () {
    const { getZoteroDragItemIds } =
      await import("../../src/modules/contextPanel/setupHandlers/controllers/fileIntakeController");
    const drag = (types: string[], raw: string) =>
      ({
        dataTransfer: {
          types,
          getData: (key: string) => (key === "zotero/item" ? raw : ""),
          get files() {
            throw new Error("Unexpected file intake");
          },
        },
      }) as unknown as DragEvent;
    const stub = (globalThis as any).Zotero;
    const previous = stub.getActiveZoteroPane;
    stub.getActiveZoteroPane = () => ({
      getSelectedItems: () => [{ id: 34 }, { id: 56 }, { id: 78 }],
    });
    try {
      assert.deepEqual(
        getZoteroDragItemIds(drag(["Files", "zotero/item"], "12,34,12")),
        [12, 34],
      );
      for (const [types, value] of [
        [["Files"], "12"],
        [["text/plain"], "56"],
        [["zotero/item"], ""],
        [["zotero/item"], "file:///paper-123.pdf"],
        [["zotero/item"], "-12"],
      ] as [string[], string][]) {
        assert.deepEqual(getZoteroDragItemIds(drag(types, value)), []);
      }
    } finally {
      stub.getActiveZoteroPane = previous;
    }
  });

  it("strictly validates both groups and rejects a checked folder without a path", async function () {
    const { tabOutputIssue } =
      await import("../../src/modules/pdfTranslator/translateBatchView");
    const { batchCopy } =
      await import("../../src/modules/pdfTranslator/translationBatchStrings");
    const fields: Record<string, { checked?: boolean; value?: string }> = {};
    const body = {
      querySelector: (s: string) => fields[s],
    } as unknown as Element;
    const c = batchCopy();
    assert.equal(tabOutputIssue(body), c.needDestination);
    fields["#llm-tr-output-attach"] = { checked: true };
    assert.equal(tabOutputIssue(body), c.needFormat);
    fields["#llm-tr-dual"] = { checked: true };
    assert.equal(tabOutputIssue(body), "");
    fields["#llm-tr-output-save-dir"] = { checked: true };
    fields["#llm-tr-output-dir"] = { value: " " };
    assert.equal(tabOutputIssue(body), c.needFolder);
    fields["#llm-tr-output-dir"].value = "/folder";
    fields["#llm-tr-output-attach"].checked = false;
    assert.equal(tabOutputIssue(body), "");
  });

  it("localizes the preflight and warns about annotations only for actual replacements", async function () {
    const { batchCopy } =
      await import("../../src/modules/pdfTranslator/translationBatchStrings");
    for (const { uiCode } of languages.UI_LANGUAGE_OPTIONS) {
      const c = batchCopy(uiCode);
      const s = {
        documents: 15,
        skip: 12,
        generate: 3,
        missing: 6,
        replace: 4,
      };
      for (const count of Object.values(s))
        assert.include(c.confirm(s), String(count));
      assert.include(c.confirm(s), c.overwriteWarning);
      assert.notInclude(c.confirm({ ...s, replace: 0 }), c.overwriteWarning);
      if (uiCode !== "en-US") assert.notEqual(c.drop, batchCopy("en-US").drop);
    }
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
