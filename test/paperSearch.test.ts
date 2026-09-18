import { assert } from "chai";
import {
  __paperSearchTest,
  searchPaperCandidates,
} from "../src/modules/contextPanel/paperSearch";
import { resolvePaperContextRefFromAttachment } from "../src/modules/contextPanel/paperAttribution";

describe("paperSearch normalization", function () {
  it("includes EPUB-only books and standalone EPUBs while excluding unsupported attachments", async function () {
    const previous = (globalThis as any).Zotero;
    const attachment = (id: number, mime: string, parentID?: number) => ({
      id,
      parentID,
      attachmentContentType: mime,
      isAttachment: () => true,
      isRegularItem: () => false,
      getField: (field: string) => (field === "title" ? "Reading EPUB" : ""),
    });
    const epub = attachment(2, "application/epub+zip", 1);
    const standalone = attachment(3, "application/epub+zip");
    const unsupported = attachment(4, "text/plain");
    const book = {
      id: 1,
      isAttachment: () => false,
      isRegularItem: () => true,
      getAttachments: () => [2],
      getField: (field: string) => (field === "title" ? "EPUB Book" : ""),
    };
    const items = [book, epub, standalone, unsupported];
    (globalThis as any).Zotero = {
      Items: {
        getAll: async () => items,
        get: (id: number) => items.find((item) => item.id === id),
      },
    };
    try {
      const results = await searchPaperCandidates(1, "EPUB");
      assert.sameMembers(
        results.map((result) => result.itemId),
        [1, 3],
      );
      assert.equal(
        results.find((result) => result.itemId === 1)?.attachments[0]
          .contextItemId,
        2,
      );
      assert.equal(
        resolvePaperContextRefFromAttachment(epub as any)?.itemId,
        1,
      );
      assert.isNull(resolvePaperContextRefFromAttachment(unsupported as any));
      assert.sameMembers(
        (await searchPaperCandidates(1, "EPUB", 2)).map(
          (result) => result.itemId,
        ),
        [3],
      );
    } finally {
      (globalThis as any).Zotero = previous;
    }
  });

  it("normalizes case, full-width forms, punctuation, and accents", function () {
    assert.equal(
      __paperSearchTest.normalizeSearchToken("Ｆáctor-Miner"),
      "factor miner",
    );
  });

  it("splits English query into tokens by whitespace", function () {
    assert.deepEqual(__paperSearchTest.splitSearchTokens("machine learning"), [
      "machine",
      "learning",
    ]);
  });

  it("splits CJK, Kana, and Hangul characters individually", function () {
    assert.deepEqual(__paperSearchTest.splitSearchTokens("机器学習모델"), [
      "机",
      "器",
      "学",
      "習",
      "모",
      "델",
    ]);
  });
});
