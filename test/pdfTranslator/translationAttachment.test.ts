import { assert } from "chai";
import {
  findPdfAttachment,
  matchTranslationOutput,
  pickAttachmentToOpen,
  resolveSourcePdf,
} from "../../src/modules/pdfTranslator/translationAttachment";

describe("pdfTranslator translation source selection", function () {
  it("matches only exact engine source + language + format", function () {
    for (const name of [
      "Paper A.no_watermark.zh-CN.mono.pdf",
      "Paper A.zh-cn.MONO.pdf",
    ])
      assert.equal(
        matchTranslationOutput(name, "Paper A.pdf", "zh-CN"),
        "mono",
      );
    for (const name of [
      "Paper A.pdf",
      "Paper A.ja.mono.pdf",
      "Paper AB.zh-CN.mono.pdf",
      "Paper A.supplement.zh-CN.mono.pdf",
    ])
      assert.isNull(matchTranslationOutput(name, "Paper A.pdf", "zh-CN"));
  });

  it("prefers the best locally available PDF, skipping missing/deleted files", async function () {
    const original = (globalThis as any).Zotero;
    const pdf = (id: number, path: string | false) => ({
      id,
      isAttachment: () => true,
      isPDFAttachment: () => true,
      getFilePathAsync: async () => path,
    });
    const first = pdf(1, "/first.pdf"),
      best = pdf(2, "/best.pdf"),
      deleted = { ...pdf(3, "/deleted.pdf"), deleted: true };
    const items = [first, best, deleted];
    const parent = {
      isRegularItem: () => true,
      isAttachment: () => false,
      getBestAttachment: async () => best,
      getAttachments: () => [3, 1, 2],
    };
    (globalThis as any).Zotero = {
      Items: { get: (id: number) => items.find((i) => i.id === id) },
    };
    try {
      assert.equal(findPdfAttachment(parent as any), first);
      assert.equal((await resolveSourcePdf(parent as any))?.attachment, best);
      best.getFilePathAsync = async () => false;
      assert.equal((await resolveSourcePdf(parent as any))?.attachment, first);
      assert.isNull(await resolveSourcePdf(deleted as any));
      assert.isNull(
        findPdfAttachment({
          isAttachment: () => true,
          isPDFAttachment: () => false,
        } as any),
      );
    } finally {
      (globalThis as any).Zotero = original;
    }
  });

  it("opens a live translated-only attachment first", function () {
    const dual = { attachmentFilename: "Paper.zh.dual.pdf" },
      mono = { attachmentFilename: "Paper.zh.mono.pdf" };
    assert.equal(
      pickAttachmentToOpen([
        false,
        dual,
        { ...mono, deleted: true },
        mono,
      ] as any),
      mono,
    );
  });
});
