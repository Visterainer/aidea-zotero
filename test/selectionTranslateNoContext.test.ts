import { assert } from "chai";
import {
  EPUB_CONTENT_TYPE,
  PDF_CONTENT_TYPE,
  type ReaderDocumentKind,
} from "../src/modules/contextPanel/documentContext";
import { pdfTextCache } from "../src/modules/contextPanel/state";
import type { PdfContext } from "../src/modules/contextPanel/types";

type SelectionTranslateModule =
  typeof import("../src/modules/contextPanel/selectionTranslate");

const originalZotero = (globalThis as Record<string, unknown>).Zotero;
const originalZtoolkit = (globalThis as Record<string, unknown>).ztoolkit;
const originalFetch = globalThis.fetch;
let selectionTranslate: SelectionTranslateModule;

function makeAttachment(id: number, contentType: string): Zotero.Item {
  return {
    id,
    libraryID: 1,
    parentID: null,
    attachmentContentType: contentType,
    isAttachment: () => true,
    isRegularItem: () => false,
    getField: () => "",
  } as unknown as Zotero.Item;
}

function makeEmptyContext(title: string): PdfContext {
  return {
    title,
    chunks: [],
    chunkStats: [],
    docFreq: {},
    avgChunkLength: 0,
    fullLength: 0,
    embeddingFailed: false,
  };
}

function buildOpenAICompatSseResponse(text: string): Response {
  const body =
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function assertTranslatesWithEmptyContext(params: {
  kind: ReaderDocumentKind;
  contentType: string;
  itemID: number;
}): Promise<void> {
  const item = makeAttachment(params.itemID, params.contentType);
  pdfTextCache.set(item.id, makeEmptyContext(params.kind));
  const stages: string[] = [];
  let requestCount = 0;
  let seenPrompt = "";
  globalThis.fetch = (async (
    _url: string | URL | Request,
    init?: RequestInit,
  ) => {
    requestCount += 1;
    const payload = JSON.parse(String(init?.body || "{}")) as Record<
      string,
      unknown
    >;
    const messages = payload.messages as
      Array<{ content?: unknown }> | undefined;
    seenPrompt = String(messages?.at(-1)?.content || "");
    return buildOpenAICompatSseResponse("已翻译");
  }) as typeof globalThis.fetch;

  const result = await selectionTranslate.translateSelectedTextForReader({
    item,
    selectedText: "Selected source text",
    callbacks: {
      onStage: (stage) => stages.push(stage),
    },
  });

  assert.strictEqual(result.translation, "已翻译");
  assert.strictEqual(requestCount, 1);
  assert.deepEqual(stages, ["translate"]);
  if (params.kind === "epub") {
    assert.include(
      seenPrompt,
      "<retrieved-document-context>\n\n</retrieved-document-context>",
    );
    assert.notInclude(seenPrompt, "<cold-start-cache>");
  } else {
    assert.include(seenPrompt, "<cold-start-cache>\n\n</cold-start-cache>");
  }
  assert.include(seenPrompt, "Selected source text");
}

describe("selection translation without document context", function () {
  before(async function () {
    const prefs = new Map<string, unknown>([
      ["extensions.zotero.aidea.selectionTranslate.enabled", true],
      ["extensions.zotero.aidea.primaryConnectionMode", "custom"],
      [
        "extensions.zotero.aidea.apiBase",
        "https://api.example.test/v1/chat/completions",
      ],
      ["extensions.zotero.aidea.apiKey", "test-key"],
      ["extensions.zotero.aidea.model", "gpt-4o-mini"],
      ["extensions.zotero.aidea.selectionTranslate.sourceLang", "en"],
      ["extensions.zotero.aidea.selectionTranslate.targetLang", "zh-CN"],
    ]);
    (globalThis as Record<string, unknown>).Zotero = {
      Prefs: {
        get: (key: string) => prefs.get(key) ?? "",
        set: (key: string, value: unknown) => {
          prefs.set(key, value);
        },
      },
    };
    (globalThis as Record<string, unknown>).ztoolkit = {
      getGlobal: (name: string) =>
        name === "fetch" ? globalThis.fetch : undefined,
      log: () => undefined,
    };
    selectionTranslate =
      await import("../src/modules/contextPanel/selectionTranslate");
  });

  afterEach(function () {
    pdfTextCache.clear();
    const zotero = (globalThis as Record<string, unknown>).Zotero as Record<
      string,
      unknown
    >;
    delete zotero.Fulltext;
    delete zotero.File;
    delete zotero.Items;
    globalThis.fetch = originalFetch;
  });

  after(function () {
    (globalThis as Record<string, unknown>).Zotero = originalZotero;
    (globalThis as Record<string, unknown>).ztoolkit = originalZtoolkit;
    globalThis.fetch = originalFetch;
  });

  it("translates PDF selections with an empty context", async function () {
    await assertTranslatesWithEmptyContext({
      kind: "pdf",
      contentType: PDF_CONTENT_TYPE,
      itemID: 71,
    });
  });

  it("translates EPUB selections with an empty context", async function () {
    await assertTranslatesWithEmptyContext({
      kind: "epub",
      contentType: EPUB_CONTENT_TYPE,
      itemID: 72,
    });
  });

  it("uses bounded selection-anchored EPUB context without a cold-start request", async function () {
    const item = makeAttachment(73, EPUB_CONTENT_TYPE);
    const paragraphs = Array.from({ length: 12 }, (_, index) => {
      const prefix =
        index === 0
          ? "distant appendix sentinel "
          : index === 6
            ? "to be or not to be "
            : `chapter ${index} `;
      return `${prefix}${`section${index} `.repeat(150)}`;
    });
    const zotero = (globalThis as Record<string, unknown>).Zotero as Record<
      string,
      unknown
    >;
    zotero.Fulltext = {
      getItemCacheFile: () => ({ path: "/tmp/selection-book-cache" }),
    };
    zotero.File = {
      getContentsAsync: async () => paragraphs.join("\n\n"),
    };
    zotero.Items = {
      get: () => null,
    };
    const stages: string[] = [];
    let requestCount = 0;
    let seenPrompt = "";
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      requestCount += 1;
      const payload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      const messages = payload.messages as
        Array<{ content?: unknown }> | undefined;
      seenPrompt = String(messages?.at(-1)?.content || "");
      return buildOpenAICompatSseResponse("生存还是毁灭");
    }) as typeof globalThis.fetch;

    const result = await selectionTranslate.translateSelectedTextForReader({
      item,
      selectedText: "to be or not to be",
      callbacks: {
        onStage: (stage) => stages.push(stage),
      },
    });

    assert.strictEqual(result.translation, "生存还是毁灭");
    assert.strictEqual(requestCount, 1);
    assert.deepEqual(stages, ["translate"]);
    assert.include(seenPrompt, "<retrieved-document-context>");
    assert.include(seenPrompt, "to be or not to be");
    assert.include(seenPrompt, "Book Text:");
    assert.include(seenPrompt, "Section 7:");
    assert.notInclude(seenPrompt, "distant appendix sentinel");
    assert.notInclude(seenPrompt, "<cold-start-cache>");
  });

  it("does not warm an EPUB when its reader opens", async function () {
    const item = makeAttachment(74, EPUB_CONTENT_TYPE);
    let extractionCount = 0;
    const zotero = (globalThis as Record<string, unknown>).Zotero as Record<
      string,
      unknown
    >;
    zotero.Fulltext = {
      getItemCacheFile: () => {
        extractionCount += 1;
        return { path: "/tmp/selection-book-cache" };
      },
    };
    zotero.Items = {
      get: () => null,
    };
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return buildOpenAICompatSseResponse("unexpected");
    }) as typeof globalThis.fetch;

    const warmed =
      await selectionTranslate.warmSelectionTranslateColdStartForReader({
        item,
      });

    assert.isFalse(warmed);
    assert.strictEqual(extractionCount, 0);
    assert.strictEqual(requestCount, 0);
  });
});
