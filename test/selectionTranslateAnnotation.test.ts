import { assert } from "chai";
import {
  applyPendingSelectionTranslationToAnnotation,
  bindSelectionTranslationAnnotationOption,
  buildSelectionTranslationAnnotationComment,
  cancelSelectionTranslationForAnnotation,
  clearPendingSelectionTranslationsForAnnotations,
  queueSelectionTranslationForAnnotation,
} from "../src/modules/contextPanel/selectionTranslateAnnotation";

const originalZtoolkit = (globalThis as Record<string, unknown>).ztoolkit;

function makeAnnotation(params: {
  key?: string;
  libraryID?: number;
  parentID?: number;
  comment?: string;
  editable?: boolean;
  text?: string;
}) {
  let saveCount = 0;
  const item = {
    key: params.key || "ANN1",
    libraryID: params.libraryID || 1,
    parentID: params.parentID || 42,
    annotationText: params.text || "Source text",
    annotationComment: params.comment || "",
    isAnnotation: () => true,
    isEditable: () => params.editable !== false,
    saveTx: async () => {
      saveCount += 1;
    },
  } as unknown as Zotero.Item;
  return { item, getSaveCount: () => saveCount };
}

describe("selectionTranslateAnnotation", function () {
  before(function () {
    (globalThis as Record<string, unknown>).ztoolkit = { log: () => undefined };
  });

  afterEach(function () {
    clearPendingSelectionTranslationsForAnnotations();
  });

  after(function () {
    (globalThis as Record<string, unknown>).ztoolkit = originalZtoolkit;
  });

  it("builds a non-destructive annotation comment", function () {
    assert.equal(
      buildSelectionTranslationAnnotationComment("", "译文"),
      "译文",
    );
    assert.equal(
      buildSelectionTranslationAnnotationComment("Existing", "译文"),
      "Existing\n\n译文",
    );
    assert.equal(
      buildSelectionTranslationAnnotationComment("Existing\n\n译文", "译文"),
      "Existing\n\n译文",
    );
  });

  it("writes a queued translation to the exact created annotation", async function () {
    assert.isTrue(
      queueSelectionTranslationForAnnotation({
        libraryID: 1,
        attachmentItemID: 42,
        annotationKey: "ANN1",
        selectedText: "Source text",
        translation: "译文",
      }),
    );
    const wrong = makeAnnotation({ key: "OTHER" });
    assert.isFalse(
      await applyPendingSelectionTranslationToAnnotation(wrong.item),
    );
    assert.equal(wrong.getSaveCount(), 0);

    const target = makeAnnotation({ comment: "Existing" });
    assert.isTrue(
      await applyPendingSelectionTranslationToAnnotation(target.item),
    );
    assert.equal(target.item.annotationComment, "Existing\n\n译文");
    assert.equal(target.getSaveCount(), 1);
    assert.isFalse(
      await applyPendingSelectionTranslationToAnnotation(target.item),
    );
  });

  it("can cancel a pending annotation write", async function () {
    queueSelectionTranslationForAnnotation({
      libraryID: 1,
      attachmentItemID: 42,
      annotationKey: "ANN1",
      selectedText: "Source text",
      translation: "译文",
    });
    cancelSelectionTranslationForAnnotation({
      libraryID: 1,
      annotationKey: "ANN1",
    });
    const target = makeAnnotation({});
    assert.isFalse(
      await applyPendingSelectionTranslationToAnnotation(target.item),
    );
    assert.equal(target.getSaveCount(), 0);
  });

  it("matches Zotero 8 annotations by attachment and normalized text when no provisional key exists", async function () {
    assert.isTrue(
      queueSelectionTranslationForAnnotation({
        libraryID: 1,
        attachmentItemID: 42,
        selectedText: "Source\n text",
        translation: "译文",
      }),
    );
    const wrongText = makeAnnotation({ key: "OTHER", text: "Other text" });
    assert.isFalse(
      await applyPendingSelectionTranslationToAnnotation(wrongText.item),
    );

    const target = makeAnnotation({ key: "NEWANN", text: "Source text" });
    assert.isTrue(
      await applyPendingSelectionTranslationToAnnotation(target.item),
    );
    assert.equal(target.item.annotationComment, "译文");
    assert.equal(target.getSaveCount(), 1);
  });

  it("expires pending writes and rejects read-only annotations", async function () {
    queueSelectionTranslationForAnnotation(
      {
        libraryID: 1,
        attachmentItemID: 42,
        annotationKey: "ANN1",
        selectedText: "Source text",
        translation: "译文",
      },
      100,
    );
    const expired = makeAnnotation({});
    assert.isFalse(
      await applyPendingSelectionTranslationToAnnotation(expired.item, 120_101),
    );

    queueSelectionTranslationForAnnotation({
      libraryID: 1,
      attachmentItemID: 42,
      annotationKey: "ANN1",
      selectedText: "Source text",
      translation: "译文",
    });
    const readOnly = makeAnnotation({ editable: false });
    try {
      await applyPendingSelectionTranslationToAnnotation(readOnly.item);
      assert.fail("Expected a read-only annotation error");
    } catch (error) {
      assert.match(String((error as Error).message), /not editable/);
    }
    assert.equal(readOnly.getSaveCount(), 0);
  });

  describe("saved checkbox preference", function () {
    let previousZotero: unknown;
    let previousZtoolkit: unknown;
    let prefs: Map<string, unknown>;

    function makeOption(attachmentItemID = 42) {
      const input = Object.assign(new EventTarget(), {
        checked: false,
        disabled: false,
      }) as unknown as HTMLInputElement;
      const option = bindSelectionTranslationAnnotationOption(input, {
        libraryID: 1,
        attachmentItemID,
      });
      return {
        input,
        ...option,
        change(checked: boolean) {
          input.checked = checked;
          input.dispatchEvent(new Event("change"));
        },
      };
    }

    beforeEach(function () {
      previousZotero = (globalThis as any).Zotero;
      previousZtoolkit = (globalThis as any).ztoolkit;
      prefs = new Map();
      (globalThis as any).Zotero = {
        Prefs: {
          get: (key: string) => prefs.get(key),
          set: (key: string, value: unknown) => prefs.set(key, value),
        },
      };
      (globalThis as any).ztoolkit = { log: () => undefined };
    });

    afterEach(function () {
      clearPendingSelectionTranslationsForAnnotations();
      (globalThis as any).Zotero = previousZotero;
      (globalThis as any).ztoolkit = previousZtoolkit;
    });

    it("defaults to off and does not queue a completed translation until checked", async function () {
      const option = makeOption();
      assert.isFalse(option.input.checked);
      assert.isTrue(option.input.disabled);
      option.setTranslation({
        selectedText: "Source text",
        translation: "译文",
      });
      assert.isFalse(option.input.disabled);
      const annotation = makeAnnotation({});
      assert.isFalse(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );

      option.change(true);
      assert.isTrue(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      assert.equal(annotation.item.annotationComment, "译文");
    });

    it("automatically queues the next selection in another document without another change event", async function () {
      const first = makeOption();
      first.setTranslation({
        selectedText: "First selection",
        translation: "第一段",
      });
      first.change(true);

      const next = makeOption(99);
      assert.isTrue(next.input.checked);
      next.setTranslation({
        selectedText: "Next selection",
        translation: "第二段",
      });
      const annotation = makeAnnotation({
        parentID: 99,
        text: "Next selection",
      });
      assert.isTrue(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      assert.equal(annotation.item.annotationComment, "第二段");
    });

    it("restores the preference after clearing runtime state and recreating the popup", async function () {
      const first = makeOption();
      first.setTranslation({
        selectedText: "Source text",
        translation: "旧译文",
      });
      first.change(true);
      // A new plugin session retains Zotero prefs but not pending translations.
      clearPendingSelectionTranslationsForAnnotations();
      const annotation = makeAnnotation({});
      const reopened = makeOption();
      assert.isTrue(reopened.input.checked);
      assert.isTrue(reopened.input.disabled);
      assert.isFalse(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      reopened.setTranslation({
        selectedText: "Source text",
        translation: "新译文",
      });
      assert.isTrue(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      assert.equal(annotation.item.annotationComment, "新译文");
    });

    it("persists unchecking and cancels the current pending write", async function () {
      const option = makeOption();
      option.setTranslation({
        selectedText: "Source text",
        translation: "译文",
      });
      option.change(true);
      option.change(false);
      const annotation = makeAnnotation({});
      assert.isFalse(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      clearPendingSelectionTranslationsForAnnotations();
      const reopened = makeOption();
      reopened.setTranslation({
        selectedText: "Source text",
        translation: "新译文",
      });
      assert.isFalse(reopened.input.checked);
      assert.isFalse(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      assert.equal(annotation.getSaveCount(), 0);
    });

    it("clears stale translations on retry without changing the saved preference", async function () {
      const option = makeOption();
      option.setTranslation({
        selectedText: "Source text",
        translation: "旧译文",
      });
      option.change(true);
      option.reset();
      assert.isTrue(option.input.checked);
      assert.isTrue(option.input.disabled);
      const annotation = makeAnnotation({});
      assert.isFalse(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      option.setTranslation({ selectedText: "Source text", translation: "" });
      assert.isTrue(option.input.checked);
      assert.isTrue(option.input.disabled);
      assert.isFalse(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      option.setTranslation({
        selectedText: "Source text",
        translation: "新译文",
      });
      assert.isTrue(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
      assert.equal(annotation.item.annotationComment, "新译文");
    });

    it("uses the latest preference when another popup disables writing during translation", async function () {
      const first = makeOption();
      first.setTranslation({ selectedText: "First", translation: "第一段" });
      first.change(true);
      const inFlight = makeOption(99);
      assert.isTrue(inFlight.input.checked);
      first.change(false);
      inFlight.setTranslation({ selectedText: "Next", translation: "第二段" });
      assert.isFalse(inFlight.input.checked);
      const annotation = makeAnnotation({ parentID: 99, text: "Next" });
      assert.isFalse(
        await applyPendingSelectionTranslationToAnnotation(annotation.item),
      );
    });
  });
});
