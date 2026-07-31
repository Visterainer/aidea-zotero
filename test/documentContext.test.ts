import { assert } from "chai";
import {
  EPUB_CONTEXT_RETRY_DELAY_MS,
  EPUB_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
  ensureDocumentContext,
  extractEpubTextFromAttachment,
  getReaderDocumentKind,
  resolveReaderDocument,
} from "../src/modules/contextPanel/documentContext";
import {
  epubTextRetryAfterByItem,
  pdfTextCache,
  pdfTextLoadingTasks,
} from "../src/modules/contextPanel/state";
import {
  getActiveContextAttachmentFromTabs,
  getActiveReaderDocumentAttachmentFromTabs,
  resolveContextSourceItem,
} from "../src/modules/contextPanel/contextResolution";

const originalZotero = (globalThis as Record<string, unknown>).Zotero;
const originalZtoolkit = (globalThis as Record<string, unknown>).ztoolkit;
const originalDateNow = Date.now;

function makeAttachment(params: {
  id: number;
  contentType: string;
  title?: string;
  attachmentText?: Promise<string>;
  modificationTime?: () => number | undefined;
  getAttachments?: () => number[];
}): Zotero.Item {
  return {
    id: params.id,
    libraryID: 1,
    parentID: null,
    attachmentContentType: params.contentType,
    attachmentText: params.attachmentText,
    get attachmentModificationTime() {
      return Promise.resolve(params.modificationTime?.());
    },
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
    epubTextRetryAfterByItem.clear();
    (globalThis as Record<string, unknown>).ztoolkit = {
      log: () => undefined,
    };
  });

  afterEach(function () {
    pdfTextCache.clear();
    pdfTextLoadingTasks.clear();
    epubTextRetryAfterByItem.clear();
    Date.now = originalDateNow;
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

  it("preserves PDF fallback for mixed-format parent items", function () {
    const epub = makeAttachment({
      id: 22,
      contentType: EPUB_CONTENT_TYPE,
    });
    const pdf = makeAttachment({
      id: 23,
      contentType: PDF_CONTENT_TYPE,
    });
    const parent = {
      id: 20,
      isAttachment: () => false,
      isRegularItem: () => true,
      getAttachments: () => [22, 23],
    } as unknown as Zotero.Item;
    (globalThis as Record<string, unknown>).Zotero = {
      Items: {
        get: (id: number) => (id === 22 ? epub : id === 23 ? pdf : null),
      },
    };

    const document = resolveReaderDocument(parent);

    assert.strictEqual(document?.item, pdf);
    assert.strictEqual(document?.kind, "pdf");
  });

  it("honors the preferred attachment for mixed-format parent items", function () {
    const epub = makeAttachment({
      id: 24,
      contentType: EPUB_CONTENT_TYPE,
    });
    const pdf = makeAttachment({
      id: 25,
      contentType: PDF_CONTENT_TYPE,
    });
    const parent = {
      id: 20,
      isAttachment: () => false,
      isRegularItem: () => true,
      getAttachments: () => [25, 24],
    } as unknown as Zotero.Item;
    (globalThis as Record<string, unknown>).Zotero = {
      Items: {
        get: (id: number) => (id === 24 ? epub : id === 25 ? pdf : null),
      },
    };

    const document = resolveReaderDocument(parent, {
      preferredItemID: epub.id,
      preferredKind: "epub",
    });

    assert.strictEqual(document?.item, epub);
    assert.strictEqual(document?.kind, "epub");
  });

  it("resolves the active EPUB attachment without changing PDF chat context", function () {
    const epub = makeAttachment({
      id: 26,
      contentType: EPUB_CONTENT_TYPE,
    });
    (globalThis as Record<string, unknown>).Zotero = {
      Tabs: {
        selectedID: "reader-tab",
        selectedType: "reader",
        _tabs: [
          {
            id: "reader-tab",
            type: "reader",
            data: { itemID: 20 },
          },
        ],
      },
      Items: {
        get: (id: number) => (id === epub.id ? epub : null),
      },
      Reader: {
        getByTabID: () => ({ _item: { id: epub.id } }),
      },
    };

    assert.strictEqual(getActiveReaderDocumentAttachmentFromTabs(), epub);
    assert.isNull(getActiveContextAttachmentFromTabs());
  });

  it("accepts an EPUB attachment as side-panel document context", function () {
    const epub = makeAttachment({
      id: 27,
      contentType: EPUB_CONTENT_TYPE,
      title: "Panel Book",
    });

    const resolved = resolveContextSourceItem(epub);

    assert.strictEqual(resolved.contextItem, epub);
    assert.strictEqual(resolved.statusText, "Using context: Panel Book");
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

  it("temporarily reuses an empty EPUB context during retry cooldown", async function () {
    const epub = makeAttachment({
      id: 51,
      contentType: EPUB_CONTENT_TYPE,
      title: "Unavailable book",
      attachmentText: Promise.resolve(""),
    });
    let indexCalls = 0;
    (globalThis as Record<string, unknown>).Zotero = {
      Fulltext: {
        getItemCacheFile: () => ({ path: "/tmp/missing-cache" }),
        indexItems: async () => {
          indexCalls += 1;
        },
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
    });
    const cachedContext = await ensureDocumentContext({
      item: epub,
      kind: "epub",
    });

    assert.strictEqual(context?.title, "Unavailable book");
    assert.deepEqual(context?.chunks, []);
    assert.strictEqual(cachedContext, context);
    assert.strictEqual(indexCalls, 1);
  });

  it("rechecks EPUB text after the empty-context cooldown", async function () {
    const epub = makeAttachment({
      id: 61,
      contentType: EPUB_CONTENT_TYPE,
      title: "Recoverable book",
      attachmentText: Promise.resolve(""),
    });
    let now = 1_000;
    let indexCalls = 0;
    let cacheReadCalls = 0;
    let indexedText = "";
    Date.now = () => now;
    (globalThis as Record<string, unknown>).Zotero = {
      Fulltext: {
        getItemCacheFile: () => ({ path: "/tmp/recoverable-cache" }),
        indexItems: async () => {
          indexCalls += 1;
        },
      },
      File: {
        getContentsAsync: async () => {
          cacheReadCalls += 1;
          if (!indexedText) throw new Error("cache missing");
          return indexedText;
        },
      },
      Items: {
        get: () => null,
      },
    };

    const first = await ensureDocumentContext({
      item: epub,
      kind: "epub",
    });
    indexedText = "Recovered EPUB text";
    now += EPUB_CONTEXT_RETRY_DELAY_MS + 1;
    const recovered = await ensureDocumentContext({
      item: epub,
      kind: "epub",
    });

    assert.deepEqual(first?.chunks, []);
    assert.strictEqual(indexCalls, 1);
    assert.strictEqual(cacheReadCalls, 3);
    assert.include(recovered?.chunks.join("\n") || "", indexedText);
  });

  it("invalidates extracted context when the attachment file changes", async function () {
    let modificationTime = 1_000;
    let extractionCalls = 0;
    const pdf = makeAttachment({
      id: 71,
      contentType: PDF_CONTENT_TYPE,
      title: "Mutable paper",
      modificationTime: () => modificationTime,
    });
    (globalThis as Record<string, unknown>).Zotero = {
      PDFWorker: {
        getFullText: async () => {
          extractionCalls += 1;
          return { text: `Revision ${extractionCalls}` };
        },
      },
      Items: { get: () => null },
    };

    const first = await ensureDocumentContext({ item: pdf, kind: "pdf" });
    const reused = await ensureDocumentContext({ item: pdf, kind: "pdf" });
    modificationTime += 1;
    const refreshed = await ensureDocumentContext({ item: pdf, kind: "pdf" });

    assert.strictEqual(extractionCalls, 2);
    assert.strictEqual(reused, first);
    assert.notStrictEqual(refreshed, first);
    assert.include(refreshed?.chunks.join("\n") || "", "Revision 2");
  });
});
