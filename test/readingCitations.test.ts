import {
  epubReaderHref,
  epubDocumentAdapter,
} from "../src/modules/contextPanel/document/adapters/epubAdapter";
import { fileEvidence } from "../src/modules/contextPanel/fileEvidence";
import { buildModelPromptWithFileContext } from "../src/modules/contextPanel/textUtils";
import { assert } from "chai";
import {
  estimateTokens,
  sliceToTokens,
  resolveInputBudget,
  fitHistory,
  historyTokens,
} from "../src/utils/contextBudget";
import { extractPdfPageSegments } from "../src/modules/contextPanel/document/pdfPages";
import {
  createDocumentTextContext,
  buildDocumentContext,
} from "../src/modules/contextPanel/document/retrieval";
import {
  buildReadingContext,
  retrievalQuestion,
} from "../src/modules/contextPanel/document/readingContext";
import {
  citationMarkdown,
  exportCitationMarkdown,
  citedEvidence,
  navigateCitation,
} from "../src/modules/contextPanel/citations";
import { checkpointMatches } from "../src/modules/contextPanel/summaryCheckpoint";
import {
  prepareChatRequest,
  compactConversationHistory,
} from "../src/modules/contextPanel/chat";
import {
  documentTextCache,
  conversationContextPool,
} from "../src/modules/contextPanel/state";
import { getAttachmentSourceRevision } from "../src/modules/contextPanel/document/adapters/shared";
import { buildChatHistoryNotePayload } from "../src/modules/contextPanel/notes";
import {
  getModelContextWindow,
  setModelContextWindow,
} from "../src/utils/modelContextWindow";
import type { EvidenceRef } from "../src/modules/contextPanel/document/evidence";
import type { Message } from "../src/modules/contextPanel/types";

const globals = globalThis as any;

describe("reading context and citations", function () {
  let previous: any;
  let toolkit: any;
  let items: Map<number, Zotero.Item>;
  let opens: any[];

  beforeEach(function () {
    previous = globals.Zotero;
    toolkit = globals.ztoolkit;
    items = new Map();
    opens = [];
    const prefs = new Map();
    globals.Zotero = {
      locale: "en-US",
      Prefs: {
        get: (key: string) => prefs.get(key),
        set: (key: string, value: unknown) => prefs.set(key, value),
      },
      Items: {
        get: (id: number) => items.get(id),
        getByLibraryAndKeyAsync: async (_lib: number, key: string) =>
          [...items.values()].find((i) => i.key === key),
      },
      Libraries: { get: () => ({ libraryType: "user" }) },
      Reader: {
        open: async (...args: any[]) => {
          opens.push(args);
        },
      },
      DB: { queryAsync: async () => [] },
      getMainWindow: () => ({
        ZoteroPane: { selectItem: async (id: number) => opens.push([id]) },
      }),
    };
    globals.ztoolkit = { log: () => undefined };
    documentTextCache.clear();
    conversationContextPool.clear();
  });

  afterEach(function () {
    globals.Zotero = previous;
    globals.ztoolkit = toolkit;
    documentTextCache.clear();
    conversationContextPool.clear();
  });
  async function paper(id: number, pages: string[]) {
    const item = {
      id,
      key: `KEY${id}`,
      libraryID: 1,
      version: 1,
      attachmentModificationTime: Promise.resolve(100),
      attachmentContentType: "application/pdf",
      isAttachment: () => true,
      isRegularItem: () => false,
      getField: () => `Paper ${id}`,
    } as unknown as Zotero.Item;
    items.set(id, item);
    const context = createDocumentTextContext({
      title: `Paper ${id}`,
      text: pages.join(""),
      kind: "pdf",
      completeness: "complete",
      sourceRevision: await getAttachmentSourceRevision(item),
      sourceSegments: extractPdfPageSegments(
        pages.join(""),
        pages.map((p) => p.length),
      ),
    });
    context.embeddingFailed = true;
    documentTextCache.set(id, context);
    return item;
  }
  function pool(id: number) {
    conversationContextPool.set(700, {
      basePdfItemId: id,
      basePdfTitle: "Paper",
      basePdfRemoved: false,
      baseDocumentKind: "pdf",
      baseDocumentSegmentIds: [],
      basePdfContext: "stale first question context",
      supplementalContexts: new Map(),
    });
  }

  it("labels a new base document with the parent item title", async function () {
    const attachment = await paper(9, ["Methods trials ".repeat(400)]);
    // Zotero names attachments after the file, so the chip must fall back to
    // the bibliographic parent's title whenever one exists.
    (attachment as any).parentID = 90;
    (attachment as any).getField = () => "Full Text PDF";
    items.set(90, {
      id: 90,
      key: "KEY90",
      libraryID: 1,
      isAttachment: () => false,
      isRegularItem: () => true,
      getField: (field: string) =>
        field === "title" ? "Attention Is All You Need" : "",
    } as unknown as Zotero.Item);
    await prepareChatRequest({
      item: attachment,
      question: "Summarize the methods",
      imageCount: 0,
      fileCount: 0,
      apiBase: "test",
      apiKey: "",
      model: "test",
      historyForLLM: [],
      paperContexts: [],
      conversationKey: 900,
      setStatusSafely: () => undefined,
    });
    assert.equal(
      conversationContextPool.get(900)!.basePdfTitle,
      "Attention Is All You Need",
    );
  });

  it("estimates CJK conservatively and slices without exceeding the budget", function () {
    assert.isAbove(
      estimateTokens("中".repeat(100)),
      estimateTokens("a".repeat(100)),
    );
    for (const text of ["中英 mixed ".repeat(100), "abc😀".repeat(100)])
      assert.isAtMost(estimateTokens(sliceToTokens(text, 77)), 77);
    assert.equal(resolveInputBudget().inputTokens, 25395);
    const history = [
      { role: "user", content: "old".repeat(100) },
      { role: "assistant", content: "old".repeat(100) },
      { role: "user", content: "new" },
      { role: "assistant", content: "answer" },
    ];
    assert.deepEqual(fitHistory(history, 30), history.slice(-2));
  });

  it("validates PDF page boundaries and preserves empty pages", function () {
    const segments = extractPdfPageSegments("abcde", [2, 0, 3])!;
    assert.equal(segments[2].text, "cde");
    assert.deepEqual(segments[2].locator, { kind: "pdf-page", pageIndex: 2 });
    assert.deepEqual(
      extractPdfPageSegments("a\f\fb", undefined, 3)?.map((s) => s.locator),
      [
        { kind: "pdf-page", pageIndex: 0 },
        { kind: "pdf-page", pageIndex: 1 },
        { kind: "pdf-page", pageIndex: 2 },
      ],
    );
    assert.isUndefined(extractPdfPageSegments("a\fb", undefined, 3));
    for (const counts of [[1, 1], [-1, 6], [2.5, 2.5], [NaN], undefined])
      assert.isUndefined(extractPdfPageSegments("abcde", counts));
  });

  it("provides short full text with page-backed IDs", async function () {
    const item = await paper(1, [
      "Method uses randomized trials.",
      "Results improve accuracy.",
    ]);
    const result = await buildReadingContext(
      { item, kind: "pdf" },
      "summarize",
      1000,
    );
    assert.equal(result.coverage.supplied, "full");
    assert.lengthOf(result.evidenceRefs, 2);
    assert.include(result.text, `[[cite:${result.evidenceRefs[1].id}]]`);
    assert.deepEqual(result.evidenceRefs[1].locator, {
      kind: "pdf-page",
      pageIndex: 1,
    });
    assert.isAtMost(result.budgetUsage, 1000);
  });

  it("retrieves different evidence for methods and results instead of reusing the first text", async function () {
    const item = await paper(2, [
      "Methods randomized trials. ".repeat(100),
      "Results accuracy improved. ".repeat(100),
      "Background prior literature. ".repeat(100),
    ]);
    const first = await buildReadingContext(
      { item, kind: "pdf" },
      "Methods randomized trials",
      300,
    );
    const second = await buildReadingContext(
      { item, kind: "pdf" },
      "Results accuracy improved",
      300,
    );
    assert.include(first.evidenceRefs[0].text, "Methods");
    assert.include(second.evidenceRefs[0].text, "Results");
    assert.isAtMost(second.budgetUsage, 300);
    assert.equal(second.coverage.supplied, "excerpts");
  });

  it("full-text compatibility path obeys length and force-retrieval", async function () {
    const item = await paper(3, [
      "Methods trial ".repeat(100),
      "Results success ".repeat(100),
    ]);
    const context = documentTextCache.get(item.id)!;
    const text = await buildDocumentContext(
      context,
      "Results",
      false,
      undefined,
      { forceRetrieval: true, useEmbeddings: false, maxLength: 200 },
    );
    assert.notInclude(text, "Full document content provided");
    assert.isBelow(text.length, context.fullLength);
  });

  it("keeps concrete questions separate from ambiguous follow-up context", function () {
    const history = [{ role: "assistant", text: "OLD-METHOD" }];
    assert.equal(
      retrievalQuestion("What were the experimental results?", history),
      "What were the experimental results?",
    );
    assert.include(
      retrievalQuestion("What about that?", history),
      "OLD-METHOD",
    );
  });

  it("shares input across papers, preserves the question, and responds to removal and model limits", async function () {
    const item = await paper(4, [
      "Methods trials ".repeat(800),
      "Results accuracy ".repeat(800),
    ]);
    await paper(5, [
      "Other methods ".repeat(800),
      "Other results ".repeat(800),
    ]);
    pool(4);
    const args = {
      item,
      question: "Compare results",
      imageCount: 0,
      fileCount: 0,
      apiBase: "test",
      apiKey: "",
      model: "test",
      historyForLLM: [],
      conversationKey: 700,
      setStatusSafely: () => undefined,
    };
    const result = await prepareChatRequest({
      ...args,
      advanced: { temperature: 0.3, maxTokens: 512, contextWindowTokens: 4096 },
      paperContexts: [{ itemId: 5, contextItemId: 5, title: "Other" }],
    });
    assert.deepEqual(
      [...new Set(result.citations.map((r) => r.itemId))].sort(),
      [4, 5],
    );
    assert.notInclude(result.combinedContext, "stale first question");
    const next = await prepareChatRequest({ ...args, paperContexts: [] });
    assert.isFalse(next.citations.some((r) => r.itemId === 5));
    try {
      await prepareChatRequest({
        ...args,
        question: "中文".repeat(20000),
        paperContexts: [],
      });
      assert.fail("must reject oversized question");
    } catch (error) {
      assert.include(String(error), "input budget");
    }
  });

  it("keeps an unpaired backtick from disabling later citations", function () {
    const ref: EvidenceRef = {
      id: "e1",
      itemId: 1,
      title: "Source",
      text: "evidence",
      itemKey: "KEY1",
    };
    // An unmatched backtick opens no code span, so it must not swallow the
    // rest of its line nor leak into the following lines.
    const sameLine = "It costs 5` and cites [[cite:e1]].";
    assert.include(citationMarkdown(sameLine, [ref]), "aidea-cite:e1");
    assert.lengthOf(citedEvidence(sameLine, [ref]), 1);
    const laterLine = "Prices use ` here.\nThen [[cite:e1]] applies.";
    assert.include(citationMarkdown(laterLine, [ref]), "aidea-cite:e1");
    assert.lengthOf(citedEvidence(laterLine, [ref]), 1);
    // A genuine inline span on an earlier line still protects only itself.
    const mixed = "See `[[cite:e1]]` verbatim.\nThen [[cite:e1]] applies.";
    const rendered = citationMarkdown(mixed, [ref]);
    assert.include(rendered, "`[[cite:e1]]`");
    assert.include(rendered, "aidea-cite:e1");
  });

  it("renders only known IDs outside code and preserves partial streaming markers", function () {
    const ref: EvidenceRef = {
      id: "e1",
      itemId: 1,
      title: "Source",
      text: "evidence",
      itemKey: "KEY1",
      locator: { kind: "pdf-page", pageIndex: 2 },
    };
    assert.include(
      citationMarkdown("Claim [[cite:e1]]", [ref]),
      "aidea-cite:e1",
    );
    assert.notInclude(
      citationMarkdown("Claim [[cite:invented]]", [ref]),
      "aidea-cite:",
    );
    assert.equal(citationMarkdown("[[cite:e", [ref]), "[[cite:e");
    const code = "```text\n[[cite:e1]]\n```\n`[[cite:e1]]`";
    assert.equal(citationMarkdown(code, [ref]), code);
    assert.lengthOf(citedEvidence(code, [ref]), 0);
    for (const block of [
      "    [[cite:e1]]",
      "`` literal ` [[cite:e1]] ``",
      "~~~\n[[cite:e1]]\n~~~",
    ])
      assert.equal(citationMarkdown(block, [ref]), block);
    assert.include(
      citationMarkdown("[[cite:e1]]", [ref], true),
      "zotero://open-pdf/library/items/KEY1?page=3",
    );
    const note = buildChatHistoryNotePayload([
      {
        role: "assistant",
        text: "Claim [[cite:e1]]",
        timestamp: 1,
        contextRefs: { citations: [ref] },
      },
    ]);
    assert.include(note.noteHtml, "zotero://open-pdf/");
    assert.notInclude(note.noteText, "[[cite:");
  });

  it("opens the stored page but drops stale positions after source changes", async function () {
    const item = await paper(6, ["Some evidence."]);
    const ref = (
      await buildReadingContext({ item, kind: "pdf" }, "evidence", 1000)
    ).evidenceRefs[0];
    await navigateCitation(ref);
    assert.deepEqual(opens[0][1], { pageIndex: 0 });
    (item as any).attachmentModificationTime = Promise.resolve(200);
    await navigateCitation(ref);
    assert.isUndefined(opens[1][1]);
    assert.notInclude(
      await exportCitationMarkdown(`[[cite:${ref.id}]]`, [ref]),
      "?page=",
    );
    items.clear();
    try {
      await navigateCitation(ref);
      assert.fail("missing source");
    } catch (error) {
      assert.include(String(error), "no longer available");
    }
  });

  it("normalizes EPUB archive hrefs and keeps generic file citations source-only", function () {
    assert.equal(
      epubReaderHref("OEBPS/text/ch2.xhtml#results", "OEBPS/package.opf"),
      "text/ch2.xhtml#results",
    );
    assert.equal(
      epubReaderHref("shared/ch2.xhtml#results", "OEBPS/package.opf"),
      "../shared/ch2.xhtml#results",
    );
    const attachment = {
      id: "file1",
      name: "Evidence.md",
      sizeBytes: 120,
      textContent: "local data",
    };
    const ref = fileEvidence(attachment)!;
    assert.include(
      buildModelPromptWithFileContext("Explain", [attachment]),
      `[[cite:${ref.id}]]`,
    );
    assert.equal(
      citationMarkdown(`[[cite:${ref.id}]]`, [ref]),
      "(Evidence.md)",
    );
    const epub: EvidenceRef = {
      id: "ep",
      itemId: 7,
      itemKey: "BOOK",
      title: "Book",
      text: "Passage",
      locator: {
        kind: "epub-location",
        cfi: "epubcfi(/6/2!/4)",
        locationLabel: "Chapter Two",
      },
    };
    assert.include(
      citationMarkdown("[[cite:ep]]", [epub], true),
      "zotero://open/library/items/BOOK?cfi=",
    );
  });

  it("waits for EPUB reader initialization before navigation and handles suspended tabs", async function () {
    let ready!: () => void;
    const calls: unknown[] = [];
    const initialized = new Promise<void>((resolve) => {
      ready = resolve;
    });
    globals.Zotero.Reader.open = async (...args: unknown[]) => {
      calls.push(args);
      return {
        _initPromise: initialized,
        navigate: async (location: unknown) => {
          calls.push(location);
        },
      };
    };
    const item = { id: 15 } as Zotero.Item;
    const locator = { kind: "epub-location" as const, cfi: "epubcfi(/6/2!/4)" };
    const pending = epubDocumentAdapter.navigate!(item, locator);
    await Promise.resolve();
    assert.deepEqual(calls, [[15]]);
    ready();
    await pending;
    assert.deepEqual(calls[1], { pageNumber: locator.cfi });
    calls.length = 0;
    let viewReady!: () => void;
    globals.Zotero.Reader.open = async () => ({
      _initPromise: Promise.resolve(),
      _internalReader: {
        _primaryView: {
          initializedPromise: new Promise<void>((resolve) => {
            viewReady = resolve;
          }),
        },
      },
      navigate: async (location: unknown) => {
        calls.push(location);
      },
    });
    const initializingView = epubDocumentAdapter.navigate!(item, locator);
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(calls, []);
    viewReady();
    await initializingView;
    assert.deepEqual(calls, [
      { pageNumber: locator.cfi },
      { pageNumber: locator.cfi },
    ]);
    calls.length = 0;
    globals.Zotero.Reader.open = async (...args: unknown[]) => {
      calls.push(args);
      return undefined;
    };
    await epubDocumentAdapter.navigate!(item, locator);
    assert.deepEqual(calls, [[15], [15, { pageNumber: locator.cfi }]]);
  });

  it("persists model overrides independently and accepts clearing", function () {
    setModelContextWindow("https://host/v1/", "one", 64000);
    assert.equal(getModelContextWindow("https://host/v1", "one"), 64000);
    assert.isUndefined(getModelContextWindow("https://host/v1", "two"));
    setModelContextWindow("https://host/v1", "one");
    assert.isUndefined(getModelContextWindow("https://host/v1", "one"));
    assert.throws(() => setModelContextWindow("host", "one", 12));
  });

  it("validates checkpoint ancestry", function () {
    const checkpoint = { text: "Summary", coveredMessageIds: [1, 2] };
    assert.isTrue(checkpointMatches(checkpoint, [1, 2, 3]));
    assert.isFalse(checkpointMatches(checkpoint, [1, 9, 3]));
  });

  it("summarizes only new history, invalidates sibling branches and handles failure", async function () {
    const history: Message[] = Array.from({ length: 14 }, (_, i) => ({
      messageId: i + 1,
      role: i % 2 ? "assistant" : "user",
      text: `TURN${i + 1} ` + "word ".repeat(100),
      timestamp: i,
    }));
    const inputs: string[] = [];
    const args = {
      conversationKey: 9981,
      combinedContext: "",
      currentQuestion: "next",
      apiBase: "test",
      apiKey: "",
      historyBudget: 2000,
      summarize: async (p: any) => {
        inputs.push(p.prompt);
        return "summary";
      },
    };
    await compactConversationHistory({ ...args, historyForLLM: history });
    assert.lengthOf(inputs, 1);
    await compactConversationHistory({ ...args, historyForLLM: history });
    assert.lengthOf(inputs, 1);
    const next = [
      ...history,
      { messageId: 15, role: "user" as const, text: "new", timestamp: 15 },
      { messageId: 16, role: "assistant" as const, text: "new", timestamp: 16 },
    ];
    await compactConversationHistory({ ...args, historyForLLM: next });
    assert.include(inputs[1], "TURN5");
    assert.notInclude(inputs[1], "TURN1 ");
    const sibling = history.map((m, i) =>
      i === 1 ? { ...m, messageId: 50, text: "sibling" } : m,
    );
    await compactConversationHistory({ ...args, historyForLLM: sibling });
    assert.include(inputs[2], "sibling");
    const fallback = await compactConversationHistory({
      ...args,
      conversationKey: 9982,
      historyForLLM: history,
      summarize: async () => {
        throw new Error("offline");
      },
    });
    assert.isAtMost(historyTokens(fallback), 2000);
    assert.include(JSON.stringify(fallback), "TURN14");
  });
});
