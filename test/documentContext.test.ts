import { assert } from "chai";
import {
  EPUB_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
  ensureDocumentContext,
  extractEpubTextFromAttachment,
  getReaderDocumentKind,
  resolveReaderDocument,
} from "../src/modules/contextPanel/documentContext";
import {
  pdfTextCache,
  pdfTextLoadingTasks,
} from "../src/modules/contextPanel/state";

const originalZotero = (globalThis as Record<string, unknown>).Zotero;
const originalZtoolkit = (globalThis as Record<string, unknown>).ztoolkit;

function makeAttachment(params: {
  id: number;
  contentType: string;
  title?: string;
  attachmentText?: Promise<string>;
  getAttachments?: () => number[];
}): Zotero.Item {
  return {
    id: params.id,
    libraryID: 1,
    parentID: null,
    attachmentContentType: params.contentType,
    attachmentText: params.attachmentText,
    isAttachment: () => true,
    isRegularItem: () => false,
    getAttachments:
      params.getAttachments ||
      (() => {
        throw new Error("attachment getAttachments() must not be called");
      }),
    getField: (field: string) => (field === "title" ? params.title || "" : ""),
  } as unknown as Zotero.Item;
}

describe("documentContext", function () {
  beforeEach(function () {
    pdfTextCache.clear();
    pdfTextLoadingTasks.clear();
    (globalThis as Record<string, unknown>).ztoolkit = {
      log: () => undefined,
    };
  });

  afterEach(function () {
    pdfTextCache.clear();
    pdfTextLoadingTasks.clear();
    (globalThis as Record<string, unknown>).Zotero = originalZotero;
    (globalThis as Record<string, unknown>).ztoolkit = originalZtoolkit;
  });

  it("classifies PDF and EPUB attachment items", function () {
    assert.strictEqual(
      getReaderDocumentKind(
        makeAttachment({ id: 1, contentType: PDF_CONTENT_TYPE }),
      ),
      "pdf",
    );
    assert.strictEqual(
      getReaderDocumentKind(
        makeAttachment({ id: 2, contentType: EPUB_CONTENT_TYPE }),
      ),
      "epub",
    );
    assert.isNull(
      getReaderDocumentKind(
        makeAttachment({ id: 3, contentType: "text/html" }),
      ),
    );
  });

  it("returns an EPUB attachment directly without calling getAttachments", function () {
    let getAttachmentsCalled = false;
    const attachment = makeAttachment({
      id: 11,
      contentType: EPUB_CONTENT_TYPE,
      getAttachments: () => {
        getAttachmentsCalled = true;
        throw new Error("should not be called");
      },
    });

    const document = resolveReaderDocument(attachment);

    assert.strictEqual(document?.item, attachment);
    assert.strictEqual(document?.kind, "epub");
    assert.isFalse(getAttachmentsCalled);
  });

  it("resolves a supported child only from regular parent items", function () {
    const epub = makeAttachment({
      id: 21,
      contentType: EPUB_CONTENT_TYPE,
    });
    const parent = {
      id: 20,
      isAttachment: () => false,
      isRegularItem: () => true,
      getAttachments: () => [21],
    } as unknown as Zotero.Item;
    (globalThis as Record<string, unknown>).Zotero = {
      Items: {
        get: (id: number) => (id === 21 ? epub : null),
      },
    };

    const document = resolveReaderDocument(parent);

    assert.strictEqual(document?.item, epub);
    assert.strictEqual(document?.kind, "epub");
  });

  it("reads an existing Zotero EPUB full-text cache without reindexing", async function () {
    const epub = makeAttachment({
      id: 31,
      contentType: EPUB_CONTENT_TYPE,
    });
    let indexCalls = 0;
    (globalThis as Record<string, unknown>).Zotero = {
      Fulltext: {
        getItemCacheFile: () => ({ path: "/tmp/book-cache" }),
        indexItems: async () => {
          indexCalls += 1;
        },
      },
      File: {
        getContentsAsync: async () => "Chapter one\n\nChapter two",
      },
    };

    const text = await extractEpubTextFromAttachment(epub);

    assert.strictEqual(text, "Chapter one\n\nChapter two");
    assert.strictEqual(indexCalls, 0);
  });

  it("indexes an EPUB when its Zotero full-text cache is missing", async function () {
    const epub = makeAttachment({
      id: 41,
      contentType: EPUB_CONTENT_TYPE,
    });
    let indexed = false;
    let indexArguments: unknown[] = [];
    (globalThis as Record<string, unknown>).Zotero = {
      Fulltext: {
        getItemCacheFile: () => ({ path: "/tmp/book-cache" }),
        indexItems: async (...args: unknown[]) => {
          indexArguments = args;
          indexed = true;
        },
      },
      File: {
        getContentsAsync: async () => {
          if (!indexed) throw new Error("cache missing");
          return "Indexed EPUB text";
        },
      },
    };

    const text = await extractEpubTextFromAttachment(epub);

    assert.strictEqual(text, "Indexed EPUB text");
    assert.deepEqual(indexArguments, [[41], { ignoreErrors: false }]);
  });

  it("caches an empty context when EPUB text is unavailable", async function () {
    const epub = makeAttachment({
      id: 51,
      contentType: EPUB_CONTENT_TYPE,
      title: "Unavailable book",
      attachmentText: Promise.resolve(""),
    });
    (globalThis as Record<string, unknown>).Zotero = {
      Fulltext: {
        getItemCacheFile: () => ({ path: "/tmp/missing-cache" }),
        indexItems: async () => undefined,
      },
      File: {
        getContentsAsync: async () => {
          throw new Error("cache missing");
        },
      },
      Items: {
        get: () => null,
      },
    };

    const context = await ensureDocumentContext({
      item: epub,
      kind: "epub",
      contentType: EPUB_CONTENT_TYPE,
    });

    assert.strictEqual(context?.title, "Unavailable book");
    assert.deepEqual(context?.chunks, []);
  });
});
