import { assert } from "chai";
import {
  applyPendingSelectionTranslationToAnnotation,
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
});
