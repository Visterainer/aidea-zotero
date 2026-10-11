import { assert } from "chai";
import { prepareChatRequest } from "../src/modules/contextPanel/chat";
import { createDocumentTextContext } from "../src/modules/contextPanel/document/retrieval";
import {
  buildReadingContext,
  buildMetadataReadingContext,
  retrievalQuestion,
} from "../src/modules/contextPanel/document/readingContext";
import { extractPdfPageSegments } from "../src/modules/contextPanel/document/pdfPages";
import { getAttachmentSourceRevision } from "../src/modules/contextPanel/document/adapters/shared";
import {
  documentTextCache,
  conversationContextPool,
} from "../src/modules/contextPanel/state";
import {
  estimateTokens,
  historyTokens,
  resolveInputBudget,
} from "../src/utils/contextBudget";
import {
  formatDocumentContext,
  resolveSystemPrompt,
} from "../src/utils/llmPrompts";
import {
  getModelContextWindow,
  setModelContextWindow,
} from "../src/utils/modelContextWindow";
import { parseCodexModelsResponse } from "../src/utils/oauthCli";
import { isDocumentOverviewQuestion } from "../src/modules/contextPanel/document/sectionRouting";

describe("paper reading quality regressions", function () {
  const globals = globalThis as any;
  let originals: any;
  let prefs: Map<string, unknown>;
  let items: Map<number, Zotero.Item>;

  beforeEach(function () {
    originals = {
      Zotero: globals.Zotero,
      ztoolkit: globals.ztoolkit,
      fetch: globals.fetch,
    };
    prefs = new Map();
    items = new Map();
    globals.Zotero = {
      locale: "zh-CN",
      Prefs: {
        get: (k: string) => prefs.get(k),
        set: (k: string, v: unknown) => prefs.set(k, v),
      },
      Items: { get: (id: number) => items.get(id) },
      Libraries: { get: () => ({ libraryType: "user" }) },
      DB: { queryAsync: async () => [] },
    };
    globals.ztoolkit = { log: () => undefined };
    globals.fetch = async () => {
      throw new Error("No network in reading regressions");
    };
    documentTextCache.clear();
    conversationContextPool.clear();
  });

  afterEach(function () {
    Object.assign(globals, originals);
    documentTextCache.clear();
    conversationContextPool.clear();
  });
  async function paper(
    structured = true,
    chinese = false,
    id = 501,
    pageCount = 24,
    escaped = false,
  ) {
    const item = {
      id,
      key: `READ${id}`,
      libraryID: 1,
      version: 1,
      attachmentModificationTime: Promise.resolve(1),
      attachmentContentType: "application/pdf",
      isAttachment: () => true,
      isRegularItem: () => false,
      getField: () => "Test research paper",
    } as unknown as Zotero.Item;
    items.set(id, item);
    const topics = ["Introduction", "Methods", "Results", "Discussion"];
    const pages = Array.from(
      { length: pageCount },
      (_, i) =>
        `${topics[Math.floor(i / 6)]} PAGE${i + 1} ` +
        (
          `${topics[Math.floor(i / 6)]} PAGE${i + 1} ` +
          (escaped
            ? '\\"'.repeat(65)
            : chinese
              ? "核酸序列设计需要独立验证，预测的结合能力不是实验测量。"
              : "The sequence design framework optimizes binding predictions. Independent validation measures affinity and specificity. ")
        ).repeat(chinese ? 120 : 28) +
        (i === 23
          ? " SELECTIVITYTARGET late evidence with an independent control."
          : ""),
    );
    const text = pages.join("");
    const context = createDocumentTextContext({
      title: "Test research paper",
      text,
      kind: "pdf",
      completeness: "complete",
      sourceRevision: await getAttachmentSourceRevision(item),
      sourceSegments: structured
        ? extractPdfPageSegments(
            text,
            pages.map((p) => p.length),
          )
        : undefined,
    });
    documentTextCache.set(id, context);
    return { item, context };
  }
  for (const query of [
    "讲解一下这篇文章",
    "总结这篇论文",
    "請詳細講解這篇論文",
    "Explain this paper",
    "Summarize this article",
    "What is this paper about?",
  ]) {
    it(`covers early and late pages for overview: ${query}`, async function () {
      const { item } = await paper();
      const result = await buildReadingContext(
        { item, kind: "pdf" },
        query,
        6000,
        { apiBase: "oauth://openai-codex" },
      );
      const pages = result.evidenceRefs.map((r) =>
        r.locator?.kind === "pdf-page" ? r.locator.pageIndex : -1,
      );
      assert.include(pages, 0);
      assert.include(pages, 23);
      assert.isAtLeast(new Set(pages).size, 6);
      assert.isAtMost(estimateTokens(result.text), 6000);
      assert.equal(result.coverage.supplied, "excerpts");
    });
  }
  for (const structured of [true, false])
    for (const chinese of [true, false]) {
      it(`keeps document-wide evidence within a small budget (pages=${structured}, CJK=${chinese})`, async function () {
        const { item } = await paper(structured, chinese);
        const result = await buildReadingContext(
          { item, kind: "pdf" },
          "讲解一下这篇文章",
          1800,
          { apiBase: "oauth://openai-codex" },
        );
        assert.include(result.text, "Introduction");
        assert.include(result.text, "Discussion");
        assert.isAtMost(estimateTokens(result.text), 1800);
        assert.isAtLeast(result.evidenceRefs.length, 2);
      });
    }

  it("uses broad fallback for an unmatched cross-language question", async function () {
    const { item } = await paper();
    const result = await buildReadingContext(
      { item, kind: "pdf" },
      "有哪些不足？",
      6000,
      { apiBase: "oauth://openai-codex" },
    );
    assert.isAtLeast(
      new Set(result.evidenceRefs.map((r) => r.segmentId)).size,
      6,
    );
    assert.isTrue(
      result.evidenceRefs.some(
        (r) => r.locator?.kind === "pdf-page" && r.locator.pageIndex === 23,
      ),
    );
  });

  for (const overview of ["讲解一下这篇文章", "Explain this paper"])
    for (const continuation of ["继续", "continue"]) {
      it(`retains overview intent through repeated follow-ups: ${overview} / ${continuation}`, async function () {
        const history = [
          { role: "user", text: overview },
          {
            role: "assistant",
            text: "Introduction describes sequence design.",
          },
          { role: "user", text: continuation },
          { role: "assistant", text: "Methods describes binding predictions." },
        ];
        assert.isTrue(
          isDocumentOverviewQuestion(retrievalQuestion(continuation, history)),
        );
        assert.isTrue(
          isDocumentOverviewQuestion(
            retrievalQuestion(continuation, history.slice(0, 2)),
          ),
        );
        const { item } = await paper();
        const result = await buildReadingContext(
          { item, kind: "pdf" },
          retrievalQuestion(continuation, history),
          6000,
          { apiBase: "oauth://openai-codex" },
        );
        const pages = result.evidenceRefs.map((ref) =>
          ref.locator?.kind === "pdf-page" ? ref.locator.pageIndex : -1,
        );
        assert.include(pages, 0);
        assert.include(pages, 23);
      });
    }

  it("does not revive an earlier overview after a focused question", function () {
    const query = retrievalQuestion("continue", [
      { role: "user", text: "Explain this paper" },
      { role: "assistant", text: "Overview" },
      { role: "user", text: "Explain SELECTIVITYTARGET" },
      { role: "assistant", text: "Specific explanation" },
      { role: "user", text: "continue" },
      { role: "assistant", text: "More specific explanation" },
    ]);
    assert.isFalse(isDocumentOverviewQuestion(query));
  });

  for (const structured of [true, false]) {
    it(`retains a specific topic through repeated continuation (pages=${structured})`, async function () {
      const { item } = await paper(structured);
      const question = retrievalQuestion("continue", [
        { role: "user", text: "Explain this paper" },
        { role: "assistant", text: "Overview" },
        { role: "user", text: "Explain SELECTIVITYTARGET" },
        { role: "assistant", text: "It needs independent validation." },
        { role: "user", text: "continue" },
        { role: "assistant", text: "Introduction discusses sequence design." },
      ]);
      const result = await buildReadingContext(
        { item, kind: "pdf" },
        question,
        1800,
      );
      assert.include(result.text, "SELECTIVITYTARGET");
      assert.isFalse(isDocumentOverviewQuestion(question));
    });
  }

  it("keeps early and late evidence after JSON escaping is included in the request budget", async function () {
    const { item } = await paper(true, false, 503, 24, true);
    const question = "讲解一下这篇文章";
    const request = await prepareChatRequest({
      item,
      question,
      imageCount: 0,
      fileCount: 0,
      paperContexts: [],
      apiBase: "oauth://openai-codex",
      apiKey: "",
      model: "test-model",
      advanced: { contextWindowTokens: 12000, maxTokens: 1024 },
      historyForLLM: [],
      conversationKey: 9995,
      setStatusSafely: () => undefined,
    });
    const pages = request.citations.map((ref) =>
      ref.locator?.kind === "pdf-page" ? ref.locator.pageIndex : -1,
    );
    assert.include(pages, 0);
    assert.include(pages, 23);
    const usage =
      estimateTokens(resolveSystemPrompt({ locale: "zh-CN" })) +
      estimateTokens(question) +
      256 +
      estimateTokens(formatDocumentContext(request.combinedContext));
    assert.isAtMost(usage, resolveInputBudget(12000, 1024).inputTokens);
    assert.equal(request.documentCoverage[0].supplied, "excerpts");
    for (const ref of request.citations)
      assert.include(
        request.combinedContext,
        `[[cite:${ref.id}]]\n${ref.text}`,
      );
  });

  it("keeps focused evidence for a specific matching question", async function () {
    const { item } = await paper();
    const result = await buildReadingContext(
      { item, kind: "pdf" },
      "Explain SELECTIVITYTARGET",
      1800,
      { apiBase: "oauth://openai-codex" },
    );
    assert.include(result.text, "SELECTIVITYTARGET");
  });

  it("loads a fitting paper fully and does not change its evidence text", async function () {
    const { item, context } = await paper();
    const result = await buildReadingContext(
      { item, kind: "pdf" },
      "讲解一下这篇文章",
      100000,
      { apiBase: "oauth://openai-codex" },
    );
    assert.equal(result.coverage.supplied, "full");
    assert.deepEqual(
      result.evidenceRefs.map((r) => r.text),
      context.chunks,
    );
  });

  for (const hasBody of [true, false])
    for (const tokens of [0, 64, 96, 300]) {
      it(`bounds long titles without empty evidence (body=${hasBody}, budget=${tokens})`, async function () {
        const { item, context } = await paper(
          true,
          false,
          504,
          hasBody ? 1 : 0,
        );
        const title = '长标题\\"'.repeat(300);
        context.title = title;
        (item as any).getField = (field: string) =>
          field === "abstractNote"
            ? "ABSTRACT_EVIDENCE about independent validation."
            : title;
        const result = await buildReadingContext(
          { item, kind: "pdf" },
          "Explain this paper",
          tokens,
        );
        const actual = result.text
          ? estimateTokens(JSON.stringify(result.text))
          : 0;
        assert.isAtMost(actual, tokens);
        assert.equal(result.budgetUsage, actual);
        for (const ref of result.evidenceRefs)
          assert.isNotEmpty(ref.text.trim());
        if (tokens >= 96) {
          assert.isNotEmpty(
            result.evidenceRefs,
            "retain evidence instead of spending everything on the title",
          );
          assert.equal(
            result.evidenceRefs[0].title,
            title,
            "preserve the original title for citation display",
          );
        } else {
          assert.isEmpty(result.evidenceRefs);
          assert.equal(result.coverage.supplied, "unavailable");
        }
      });
    }

  for (const hasAbstract of [true, false]) {
    it(`keeps supplemental metadata coverage honest (abstract=${hasAbstract})`, async function () {
      const abstract = hasAbstract
        ? "ABSTRACT_EVIDENCE " + '\\"'.repeat(2000)
        : "";
      const { item } = await paper(true, false, 505, 1);
      const metadata = {
        id: 506,
        key: "META506",
        libraryID: 1,
        isAttachment: () => false,
        isRegularItem: () => true,
        getAttachments: () => [],
        getField: (field: string) =>
          field === "abstractNote" ? abstract : "很长的标题".repeat(400),
      } as unknown as Zotero.Item;
      items.set(metadata.id, metadata);
      const question = "Compare these papers";
      const request = await prepareChatRequest({
        item,
        question,
        imageCount: 0,
        fileCount: 0,
        paperContexts: [
          { itemId: 506, contextItemId: 506, title: "Supplement" },
        ],
        apiBase: "oauth://openai-codex",
        apiKey: "",
        model: "m",
        advanced: { contextWindowTokens: 5000, maxTokens: 1024 },
        historyForLLM: [],
        conversationKey: 9996,
        setStatusSafely: () => undefined,
      });
      const refs = request.citations.filter((ref) => ref.itemId === 506);
      assert.equal(
        request.documentCoverage[1].supplied,
        abstract ? "abstract" : "unavailable",
      );
      if (abstract) {
        assert.lengthOf(refs, 1);
        assert.include(refs[0].text, "ABSTRACT_EVIDENCE");
        assert.include(
          request.combinedContext,
          `[[cite:${refs[0].id}]]\n${refs[0].text}`,
        );
      } else
        assert.isEmpty(refs, "a title alone must not become paper evidence");
      const usage =
        estimateTokens(resolveSystemPrompt({ locale: "zh-CN" })) +
        estimateTokens(question) +
        256 +
        estimateTokens(formatDocumentContext(request.combinedContext));
      assert.isAtMost(usage, resolveInputBudget(5000, 1024).inputTokens);
    });
  }

  it("ties abstract citations to the actual excerpt and omits blank abstracts", async function () {
    const { item } = await paper();
    let abstract = "ABSTRACT_EVIDENCE " + "independent validation ".repeat(100);
    (item as any).getField = (field: string) =>
      field === "abstractNote" ? abstract : "Paper";
    const small = buildMetadataReadingContext(item, 100);
    const large = buildMetadataReadingContext(item, 500);
    assert.lengthOf(small.evidenceRefs, 1);
    assert.lengthOf(large.evidenceRefs, 1);
    assert.notEqual(small.evidenceRefs[0].text, large.evidenceRefs[0].text);
    assert.notEqual(small.evidenceRefs[0].id, large.evidenceRefs[0].id);
    abstract = " \n\t ";
    const blank = buildMetadataReadingContext(item, 500);
    assert.isEmpty(blank.evidenceRefs);
    assert.equal(blank.coverage.supplied, "unavailable");
  });

  it("resolves provider metadata without overwriting the user's override", function () {
    prefs.set(
      "extensions.zotero.aidea.oauthModelListCache",
      JSON.stringify({
        "openai-codex": [
          {
            id: "test-large-model",
            label: "Test",
            contextWindowTokens: 258400,
          },
        ],
      }),
    );
    assert.equal(
      getModelContextWindow("oauth://openai-codex", "test-large-model"),
      258400,
    );
    setModelContextWindow("oauth://openai-codex", "test-large-model", 200000);
    assert.equal(
      getModelContextWindow("oauth://openai-codex", "test-large-model"),
      200000,
    );
    setModelContextWindow("oauth://openai-codex", "test-large-model");
    assert.equal(
      getModelContextWindow("oauth://openai-codex", "test-large-model"),
      258400,
    );
    assert.isUndefined(
      getModelContextWindow("https://proxy.test", "test-large-model"),
    );
  });

  it("retains a provider's effective window through JSON model-cache persistence", function () {
    const rows = parseCodexModelsResponse({
      models: [
        null,
        {
          slug: "test-large-model",
          display_name: "Test",
          context_window: 272000,
          effective_context_window_percent: 95,
        },
        { id: "no-window" },
        { id: "invalid", context_window: -1 },
      ],
    });
    prefs.set(
      "extensions.zotero.aidea.oauthModelListCache",
      JSON.stringify({ "openai-codex": rows }),
    );
    assert.equal(rows[0].label, "Test");
    assert.equal(
      getModelContextWindow("oauth://openai-codex", "test-large-model"),
      258400,
    );
    assert.isUndefined(
      getModelContextWindow("oauth://openai-codex", "no-window"),
    );
    assert.isUndefined(
      getModelContextWindow("oauth://openai-codex", "invalid"),
    );
    assert.deepEqual(parseCodexModelsResponse(null), []);
  });

  it("keeps a valid window when the effective percent is missing or malformed", function () {
    for (const percent of [undefined, null, "95", 0, 101, NaN]) {
      const [row] = parseCodexModelsResponse([
        {
          id: "m",
          context_window: 272000,
          effective_context_window_percent: percent,
        },
      ]);
      assert.equal(row.contextWindowTokens, 272000, String(percent));
    }
  });

  it("matches discovered model ids case-insensitively like other cache lookups", function () {
    prefs.set(
      "extensions.zotero.aidea.oauthModelListCache",
      JSON.stringify({
        "openai-codex": [
          { id: "gpt-5-codex", label: "Codex", contextWindowTokens: 258400 },
        ],
      }),
    );
    assert.equal(
      getModelContextWindow("oauth://openai-codex", " GPT-5-Codex "),
      258400,
    );
  });
  for (const value of ["272000", 0, -1, 1023, NaN, Infinity, 1024.5]) {
    it(`rejects malformed discovered window: ${value}`, function () {
      assert.isUndefined(
        parseCodexModelsResponse([{ id: "m", context_window: value }])[0]
          .contextWindowTokens,
      );
    });
  }
  for (const question of [
    "Explain this paper's method",
    "讲解这篇论文的方法",
    "总结第三章",
    "Why is this equation true?",
  ]) {
    it(`does not mistake a focused question for overview: ${question}`, function () {
      assert.isFalse(isDocumentOverviewQuestion(question));
    });
  }

  it("uses discovered capacity to send the full paper through request preparation", async function () {
    prefs.set(
      "extensions.zotero.aidea.oauthModelListCache",
      JSON.stringify({
        "openai-codex": parseCodexModelsResponse([
          {
            id: "m",
            context_window: 272000,
            effective_context_window_percent: 95,
          },
        ]),
      }),
    );
    const { item, context } = await paper();
    const result = await prepareChatRequest({
      item,
      question: "讲解一下这篇文章",
      imageCount: 0,
      fileCount: 0,
      paperContexts: [],
      apiBase: "oauth://openai-codex",
      apiKey: "",
      model: "m",
      historyForLLM: [],
      conversationKey: 9992,
      setStatusSafely: () => undefined,
    });
    assert.equal(result.citations.length, context.chunks.length);
    assert.equal(result.documentCoverage[0].supplied, "full");
    setModelContextWindow("oauth://openai-codex", "m", 16000);
    const small = await prepareChatRequest({
      item,
      question: "讲解一下这篇文章",
      imageCount: 0,
      fileCount: 0,
      paperContexts: [],
      apiBase: "oauth://openai-codex",
      apiKey: "",
      model: "m",
      historyForLLM: [],
      conversationKey: 9992,
      setStatusSafely: () => undefined,
    });
    assert.equal(small.documentCoverage[0].supplied, "excerpts");
    assert.isTrue(
      small.citations.some(
        (r) => r.locator?.kind === "pdf-page" && r.locator.pageIndex === 23,
      ),
    );
  });

  it("preserves the middle of a long prior answer when the short paper and history both fit", async function () {
    const { item, context } = await paper(true, false, 502, 1);
    const answer =
      "论文讲解".repeat(1700) +
      " CRITICAL_MIDDLE_DERIVATION " +
      "论文讲解".repeat(1700);
    const history: any[] = [
      { role: "user", text: "讲解一下这篇文章", timestamp: 1 },
      { role: "assistant", text: answer, timestamp: 2 },
    ];
    const result = await prepareChatRequest({
      item,
      question: "解释上一条回答中间的推导",
      imageCount: 0,
      fileCount: 0,
      paperContexts: [],
      apiBase: "oauth://openai-codex",
      apiKey: "",
      model: "test-model",
      historyForLLM: history,
      conversationKey: 9993,
      setStatusSafely: () => undefined,
    });
    assert.isTrue(
      result.llmHistory[1].content === answer,
      "keep the complete answer, including its middle",
    );
    assert.equal(result.documentCoverage[0].supplied, "full");
    assert.equal(result.citations.length, context.chunks.length);
  });

  it("preserves full history and full paper together when discovered capacity allows it", async function () {
    const { item, context } = await paper();
    prefs.set(
      "extensions.zotero.aidea.oauthModelListCache",
      JSON.stringify({
        "openai-codex": parseCodexModelsResponse([
          {
            id: "m",
            context_window: 272000,
            effective_context_window_percent: 95,
          },
        ]),
      }),
    );
    const answer =
      "论文讲解".repeat(1700) +
      " CRITICAL_MIDDLE_DERIVATION " +
      "论文讲解".repeat(1700);
    const result = await prepareChatRequest({
      item,
      question: "解释上一条回答中间的推导",
      imageCount: 0,
      fileCount: 0,
      paperContexts: [],
      apiBase: "oauth://openai-codex",
      apiKey: "",
      model: "m",
      historyForLLM: [
        { role: "user", text: "讲解一下这篇文章", timestamp: 1 },
        { role: "assistant", text: answer, timestamp: 2 },
      ],
      conversationKey: 9994,
      setStatusSafely: () => undefined,
    });
    assert.isTrue(result.llmHistory[1].content === answer);
    assert.equal(result.documentCoverage[0].supplied, "full");
    assert.equal(result.citations.length, context.chunks.length);
  });

  it("preserves a long recent turn while spreading remaining evidence across the paper", async function () {
    const { item } = await paper();
    const history: any[] = [
      { role: "user", text: "讲解一下这篇文章", timestamp: 1 },
      { role: "assistant", text: "论文讲解".repeat(3500), timestamp: 2 },
    ];
    const request = await prepareChatRequest({
      item,
      question: "继续",
      imageCount: 0,
      fileCount: 0,
      paperContexts: [],
      apiBase: "oauth://openai-codex",
      apiKey: "",
      model: "test-model",
      historyForLLM: history,
      conversationKey: 9991,
      setStatusSafely: () => undefined,
    });
    assert.isTrue(request.llmHistory[1].content === history[1].text);
    assert.isNotEmpty(
      request.llmHistory,
      "retain the complete recent turn for the follow-up",
    );
    assert.isAtLeast(
      new Set(request.citations.map((r) => r.segmentId)).size,
      3,
    );
    assert.equal(history[1].text.length, 14000, "never mutate stored history");
    assert.isTrue(
      request.citations.some(
        (r) => r.locator?.kind === "pdf-page" && r.locator.pageIndex === 23,
      ),
    );
    const inputUsage =
      estimateTokens(resolveSystemPrompt({ locale: "zh-CN" })) +
      estimateTokens("继续") +
      256 +
      historyTokens(request.llmHistory) +
      estimateTokens(formatDocumentContext(request.combinedContext));
    assert.isAtMost(inputUsage, resolveInputBudget().inputTokens);
  });
});
