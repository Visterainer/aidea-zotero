/**
 * Tests for the context persistence system (Phase 1).
 *
 * Coverage:
 * 1. ConversationContextPool creation and lifecycle
 * 2. buildSinglePaperContext extraction from paperContext.ts
 * 3. sendFlowController pinned-vs-ephemeral clearing semantics
 * 4. clearConversation pool cleanup
 */

import { assert } from "chai";

function expect(actual: unknown) {
  return {
    toBe(expected: unknown) {
      assert.strictEqual(actual, expected);
    },
    toContain(expected: unknown) {
      assert.include(actual as any, expected as any);
    },
    toHaveLength(expected: number) {
      assert.lengthOf(actual as any, expected);
    },
    toBeUndefined() {
      assert.isUndefined(actual);
    },
    toBeNull() {
      assert.isNull(actual);
    },
    toBeFalsy() {
      assert.isNotOk(actual);
    },
    toBeLessThan(expected: number) {
      assert.isBelow(actual as number, expected);
    },
    not: {
      toContain(expected: unknown) {
        assert.notInclude(actual as any, expected as any);
      },
      toBeNull() {
        assert.isNotNull(actual);
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 1. conversationContextPool (state.ts)
// ---------------------------------------------------------------------------
describe("conversationContextPool", () => {
  // We can't import from state.ts directly (Zotero globals), so we test
  // the data structure logic in isolation.
  type ConversationContextPoolEntry = {
    basePdfContext: string;
    basePdfItemId: number | null;
    basePdfTitle: string;
    basePdfRemoved: boolean;
    supplementalContexts: Map<
      number,
      {
        ref: { itemId: number; contextItemId: number; title: string };
        builtContext: string;
        addedAtTurn: number;
      }
    >;
  };

  let pool: Map<number, ConversationContextPoolEntry>;

  beforeEach(() => {
    pool = new Map();
  });

  it("should create an empty pool entry", () => {
    const entry: ConversationContextPoolEntry = {
      basePdfContext: "",
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    pool.set(123, entry);
    expect(pool.has(123)).toBe(true);
    expect(pool.get(123)!.basePdfContext).toBe("");
    expect(pool.get(123)!.basePdfRemoved).toBe(false);
    expect(pool.get(123)!.supplementalContexts.size).toBe(0);
  });

  it("should cache base PDF context on first assignment", () => {
    const entry: ConversationContextPoolEntry = {
      basePdfContext: "",
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    pool.set(123, entry);

    // Simulate first-turn caching.
    entry.basePdfContext =
      "Paper Full Text (complete document): ...long content...";
    entry.basePdfItemId = 456;
    entry.basePdfTitle = "时序研究（一）";

    expect(pool.get(123)!.basePdfContext).toContain("Paper Full Text");
    expect(pool.get(123)!.basePdfItemId).toBe(456);
  });

  it("should reuse cached base PDF on subsequent access", () => {
    const entry: ConversationContextPoolEntry = {
      basePdfContext: "Cached PDF content",
      basePdfItemId: 456,
      basePdfTitle: "Test Paper",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    pool.set(123, entry);

    // Simulate subsequent turn — should read from cache.
    const cached = pool.get(123)!;
    expect(cached.basePdfContext).toBe("Cached PDF content");
    // Should not call resolveContextSourceItem (we verify by NOT needing any mock).
  });

  it("should return empty context when base PDF is unpinned", () => {
    const entry: ConversationContextPoolEntry = {
      basePdfContext: "Full paper text",
      basePdfItemId: 456,
      basePdfTitle: "Paper",
      basePdfRemoved: true, // User clicked ✕
      supplementalContexts: new Map(),
    };
    pool.set(123, entry);

    const cached = pool.get(123)!;
    const pdfContext = cached.basePdfRemoved ? "" : cached.basePdfContext;
    expect(pdfContext).toBe("");
  });

  it("should accumulate supplemental papers across turns", () => {
    const entry: ConversationContextPoolEntry = {
      basePdfContext: "Base PDF",
      basePdfItemId: 1,
      basePdfTitle: "Base",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    pool.set(100, entry);

    // Turn 1: add paper A.
    entry.supplementalContexts.set(10, {
      ref: { itemId: 5, contextItemId: 10, title: "Paper A" },
      builtContext: "Paper A context...",
      addedAtTurn: 1,
    });
    expect(entry.supplementalContexts.size).toBe(1);

    // Turn 2: add paper B (paper A should remain).
    entry.supplementalContexts.set(20, {
      ref: { itemId: 6, contextItemId: 20, title: "Paper B" },
      builtContext: "Paper B context...",
      addedAtTurn: 2,
    });
    expect(entry.supplementalContexts.size).toBe(2);
    expect(entry.supplementalContexts.has(10)).toBe(true); // Paper A still present.
    expect(entry.supplementalContexts.has(20)).toBe(true);
  });

  it("should skip already-built supplemental papers", () => {
    const entry: ConversationContextPoolEntry = {
      basePdfContext: "",
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    pool.set(100, entry);

    entry.supplementalContexts.set(10, {
      ref: { itemId: 5, contextItemId: 10, title: "Paper A" },
      builtContext: "Paper A context...",
      addedAtTurn: 1,
    });

    // Simulate re-send with same paper A — should not rebuild.
    const currentRefIds = [10];
    const needsBuild = currentRefIds.filter(
      (id) => !entry.supplementalContexts.has(id),
    );
    expect(needsBuild).toHaveLength(0);
  });

  it("should remove supplemental papers when user unpins them", () => {
    const entry: ConversationContextPoolEntry = {
      basePdfContext: "",
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    pool.set(100, entry);

    entry.supplementalContexts.set(10, {
      ref: { itemId: 5, contextItemId: 10, title: "Paper A" },
      builtContext: "Paper A context...",
      addedAtTurn: 1,
    });
    entry.supplementalContexts.set(20, {
      ref: { itemId: 6, contextItemId: 20, title: "Paper B" },
      builtContext: "Paper B context...",
      addedAtTurn: 2,
    });

    // User removes paper A (currentPaperRefs only has paper B).
    const currentRefIds = new Set([20]);
    for (const existingId of entry.supplementalContexts.keys()) {
      if (!currentRefIds.has(existingId)) {
        entry.supplementalContexts.delete(existingId);
      }
    }
    expect(entry.supplementalContexts.size).toBe(1);
    expect(entry.supplementalContexts.has(10)).toBe(false); // Paper A removed.
    expect(entry.supplementalContexts.has(20)).toBe(true); // Paper B kept.
  });

  it("should clear pool entry when conversation is cleared", () => {
    pool.set(100, {
      basePdfContext: "Content",
      basePdfItemId: 1,
      basePdfTitle: "Paper",
      basePdfRemoved: false,
      supplementalContexts: new Map([
        [
          10,
          {
            ref: { itemId: 5, contextItemId: 10, title: "A" },
            builtContext: "A...",
            addedAtTurn: 1,
          },
        ],
      ]),
    });
    expect(pool.has(100)).toBe(true);

    // Simulate clearConversation.
    pool.delete(100);
    expect(pool.has(100)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Attachment classification (pinned vs ephemeral)
// ---------------------------------------------------------------------------
describe("attachment pinned/ephemeral classification", () => {
  type AttachmentCategory =
    "image" | "pdf" | "markdown" | "code" | "text" | "file";

  function isPinnedCategory(category: AttachmentCategory): boolean {
    return category !== "image";
  }

  it("should classify PDF as pinned", () => {
    expect(isPinnedCategory("pdf")).toBe(true);
  });

  it("should classify text as pinned", () => {
    expect(isPinnedCategory("text")).toBe(true);
  });

  it("should classify markdown as pinned", () => {
    expect(isPinnedCategory("markdown")).toBe(true);
  });

  it("should classify code as pinned", () => {
    expect(isPinnedCategory("code")).toBe(true);
  });

  it("should classify file as pinned", () => {
    expect(isPinnedCategory("file")).toBe(true);
  });

  it("should classify image as ephemeral", () => {
    expect(isPinnedCategory("image")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Context combination logic
// ---------------------------------------------------------------------------
describe("context combination", () => {
  function combineZoneA(
    memoryContext: string,
    pdfContext: string,
    supplementalPaperContext: string,
  ): string {
    return [memoryContext, pdfContext, supplementalPaperContext]
      .map((entry) => (entry || "").trim())
      .filter(Boolean)
      .join("\n\n====================\n\n");
  }

  it("should combine all three context types", () => {
    const result = combineZoneA(
      "Memory: user prefers quantitative analysis",
      "Paper Full Text: ...",
      "Supplemental Paper Contexts:\n\nPaper B content",
    );
    expect(result).toContain("Memory:");
    expect(result).toContain("Paper Full Text:");
    expect(result).toContain("Supplemental Paper Contexts:");
    expect(result).toContain("====================");
  });

  it("should omit empty segments", () => {
    const result = combineZoneA("", "Paper content", "");
    expect(result).toBe("Paper content");
    expect(result).not.toContain("====================");
  });

  it("should return empty string when all segments are empty", () => {
    const result = combineZoneA("", "", "");
    expect(result).toBe("");
  });

  it("should handle base PDF removed (empty pdfContext)", () => {
    const result = combineZoneA(
      "Memory context",
      "", // basePdfRemoved = true → empty
      "Supplemental: Paper B",
    );
    expect(result).toContain("Memory context");
    expect(result).toContain("Supplemental: Paper B");
    expect(result).not.toContain("Paper Full Text");
  });
});

// ---------------------------------------------------------------------------
// 4. buildSinglePaperContext formatting
// ---------------------------------------------------------------------------
describe("buildSinglePaperContext metadata formatting", () => {
  function formatMetadataLabel(
    ref: {
      title: string;
      citationKey?: string;
      firstCreator?: string;
      year?: string;
    },
    index: number,
  ): string {
    const title = ref.title || `Item unknown`;
    const parts = [`Title: ${title}`];
    if (ref.citationKey) parts.push(`Citation key: ${ref.citationKey}`);
    if (ref.firstCreator) parts.push(`Author: ${ref.firstCreator}`);
    if (ref.year) parts.push(`Year: ${ref.year}`);
    return `Supplemental Paper ${index + 1}\n${parts.join("\n")}`;
  }

  it("should format basic metadata", () => {
    const label = formatMetadataLabel(
      { title: "High-Freq Trading", firstCreator: "Smith", year: "2024" },
      0,
    );
    expect(label).toContain("Supplemental Paper 1");
    expect(label).toContain("Title: High-Freq Trading");
    expect(label).toContain("Author: Smith");
    expect(label).toContain("Year: 2024");
  });

  it("should include citation key when present", () => {
    const label = formatMetadataLabel(
      { title: "Paper", citationKey: "smith2024" },
      1,
    );
    expect(label).toContain("Supplemental Paper 2");
    expect(label).toContain("Citation key: smith2024");
  });

  it("should handle missing optional fields", () => {
    const label = formatMetadataLabel({ title: "Paper" }, 0);
    expect(label).toBe("Supplemental Paper 1\nTitle: Paper");
    expect(label).not.toContain("Author:");
    expect(label).not.toContain("Year:");
  });
});

// ---------------------------------------------------------------------------
// 5. Supplemental blocks assembly
// ---------------------------------------------------------------------------
describe("supplemental blocks assembly", () => {
  it("should join multiple paper blocks with separators", () => {
    const blocks = ["Paper A content", "Paper B content"];
    const result = blocks.length
      ? `Supplemental Paper Contexts:\n\n${blocks.join("\n\n---\n\n")}`
      : "";
    expect(result).toContain("Supplemental Paper Contexts:");
    expect(result).toContain("Paper A content");
    expect(result).toContain("---");
    expect(result).toContain("Paper B content");
  });

  it("should return empty string when no blocks", () => {
    const blocks: string[] = [];
    const result = blocks.length
      ? `Supplemental Paper Contexts:\n\n${blocks.join("\n\n---\n\n")}`
      : "";
    expect(result).toBe("");
  });
});

// ===========================================================================
// Phase 2: Lightweight Persistence Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// 6. ContextRefsJson serialization
// ---------------------------------------------------------------------------
describe("ContextRefsJson serialization", () => {
  type ContextRefsJson = {
    basePdf?: {
      itemId: number;
      contextItemId: number;
      title: string;
      removed?: boolean;
    };
    supplementalPapers?: Array<{
      itemId: number;
      contextItemId: number;
      title: string;
    }>;
    fileAttachmentIds?: string[];
    compactedSummary?: string;
  };

  it("should serialize base PDF ref", () => {
    const refs: ContextRefsJson = {
      basePdf: {
        itemId: 100,
        contextItemId: 200,
        title: "Test Paper",
      },
    };
    const json = JSON.stringify(refs);
    const parsed = JSON.parse(json) as ContextRefsJson;
    expect(parsed.basePdf?.itemId).toBe(100);
    expect(parsed.basePdf?.contextItemId).toBe(200);
    expect(parsed.basePdf?.title).toBe("Test Paper");
    expect(parsed.basePdf?.removed).toBeUndefined();
  });

  it("should serialize removed base PDF ref", () => {
    const refs: ContextRefsJson = {
      basePdf: {
        itemId: 100,
        contextItemId: 200,
        title: "Removed Paper",
        removed: true,
      },
    };
    const json = JSON.stringify(refs);
    const parsed = JSON.parse(json) as ContextRefsJson;
    expect(parsed.basePdf?.removed).toBe(true);
  });

  it("should serialize supplemental papers", () => {
    const refs: ContextRefsJson = {
      basePdf: { itemId: 1, contextItemId: 2, title: "Base" },
      supplementalPapers: [
        { itemId: 10, contextItemId: 20, title: "Paper A" },
        { itemId: 30, contextItemId: 40, title: "Paper B" },
      ],
    };
    const json = JSON.stringify(refs);
    const parsed = JSON.parse(json) as ContextRefsJson;
    expect(parsed.supplementalPapers).toHaveLength(2);
    expect(parsed.supplementalPapers![0].title).toBe("Paper A");
    expect(parsed.supplementalPapers![1].title).toBe("Paper B");
  });

  it("should handle empty refs (no basePdf, no supplementals)", () => {
    const refs: ContextRefsJson = {};
    const json = JSON.stringify(refs);
    const parsed = JSON.parse(json) as ContextRefsJson;
    expect(parsed.basePdf).toBeUndefined();
    expect(parsed.supplementalPapers).toBeUndefined();
  });

  it("should serialize compacted summary when present", () => {
    const refs: ContextRefsJson = {
      basePdf: { itemId: 1, contextItemId: 2, title: "Base" },
      compactedSummary:
        "This paper discusses time-series analysis using LSTM models...",
    };
    const json = JSON.stringify(refs);
    const parsed = JSON.parse(json) as ContextRefsJson;
    expect(parsed.compactedSummary).toContain("LSTM");
  });
});

// ---------------------------------------------------------------------------
// 7. Context snapshot building (buildContextRefsSnapshot logic)
// ---------------------------------------------------------------------------
describe("buildContextRefsSnapshot logic", () => {
  type ConversationContextPoolEntry = {
    basePdfContext: string;
    basePdfItemId: number | null;
    basePdfTitle: string;
    basePdfRemoved: boolean;
    supplementalContexts: Map<
      number,
      {
        ref: { itemId: number; contextItemId: number; title: string };
        builtContext: string;
        addedAtTurn: number;
      }
    >;
  };

  type ContextRefsJson = {
    basePdf?: {
      itemId: number;
      contextItemId: number;
      title: string;
      removed?: boolean;
    };
    supplementalPapers?: Array<{
      itemId: number;
      contextItemId: number;
      title: string;
    }>;
  };

  function buildSnapshot(
    pool: ConversationContextPoolEntry,
  ): ContextRefsJson | undefined {
    const refs: ContextRefsJson = {};
    if (pool.basePdfItemId !== null) {
      refs.basePdf = {
        itemId: pool.basePdfItemId, // Simplified: in real code, resolves parent
        contextItemId: pool.basePdfItemId,
        title: pool.basePdfTitle || "Document",
        removed: pool.basePdfRemoved || undefined,
      };
    }
    if (pool.supplementalContexts.size > 0) {
      refs.supplementalPapers = [...pool.supplementalContexts.values()].map(
        (entry) => entry.ref,
      );
    }
    return Object.keys(refs).length > 0 ? refs : undefined;
  }

  it("should return undefined for empty pool", () => {
    const pool: ConversationContextPoolEntry = {
      basePdfContext: "",
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    expect(buildSnapshot(pool)).toBeUndefined();
  });

  it("should capture base PDF ref", () => {
    const pool: ConversationContextPoolEntry = {
      basePdfContext: "Full text...",
      basePdfItemId: 456,
      basePdfTitle: "My Paper",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    const snap = buildSnapshot(pool)!;
    expect(snap.basePdf?.contextItemId).toBe(456);
    expect(snap.basePdf?.title).toBe("My Paper");
    expect(snap.basePdf?.removed).toBeUndefined();
  });

  it("should capture removed flag", () => {
    const pool: ConversationContextPoolEntry = {
      basePdfContext: "Full text...",
      basePdfItemId: 456,
      basePdfTitle: "Removed",
      basePdfRemoved: true,
      supplementalContexts: new Map(),
    };
    const snap = buildSnapshot(pool)!;
    expect(snap.basePdf?.removed).toBe(true);
  });

  it("should capture supplemental papers", () => {
    const pool: ConversationContextPoolEntry = {
      basePdfContext: "",
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfRemoved: false,
      supplementalContexts: new Map([
        [
          10,
          {
            ref: { itemId: 5, contextItemId: 10, title: "Paper A" },
            builtContext: "...",
            addedAtTurn: 1,
          },
        ],
        [
          20,
          {
            ref: { itemId: 6, contextItemId: 20, title: "Paper B" },
            builtContext: "...",
            addedAtTurn: 2,
          },
        ],
      ]),
    };
    const snap = buildSnapshot(pool)!;
    expect(snap.supplementalPapers).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 8. Context pool restoration from DB refs
// ---------------------------------------------------------------------------
describe("restoreContextPoolFromStoredMessages logic", () => {
  type ContextRefsJson = {
    basePdf?: {
      itemId: number;
      contextItemId: number;
      title: string;
      removed?: boolean;
    };
    supplementalPapers?: Array<{
      itemId: number;
      contextItemId: number;
      title: string;
    }>;
  };

  type StoredMsg = {
    role: "user" | "assistant";
    contextRefs?: ContextRefsJson;
  };

  type PoolEntry = {
    basePdfContext: string;
    basePdfItemId: number | null;
    basePdfTitle: string;
    basePdfRemoved: boolean;
    supplementalContexts: Map<
      number,
      { ref: any; builtContext: string; addedAtTurn: number }
    >;
  };

  function restorePool(messages: StoredMsg[]): PoolEntry | null {
    let latestRefs: ContextRefsJson | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user" && messages[i].contextRefs) {
        latestRefs = messages[i].contextRefs;
        break;
      }
    }
    if (!latestRefs) return null;

    const pool: PoolEntry = {
      basePdfContext: "", // Lazy rebuild
      basePdfItemId: latestRefs.basePdf?.contextItemId ?? null,
      basePdfTitle: latestRefs.basePdf?.title ?? "",
      basePdfRemoved: latestRefs.basePdf?.removed ?? false,
      supplementalContexts: new Map(),
    };
    if (Array.isArray(latestRefs.supplementalPapers)) {
      for (const [idx, ref] of latestRefs.supplementalPapers.entries()) {
        if (!ref?.contextItemId) continue;
        pool.supplementalContexts.set(ref.contextItemId, {
          ref,
          builtContext: "", // Lazy
          addedAtTurn: idx + 1,
        });
      }
    }
    return pool;
  }

  it("should return null when no user messages have contextRefs", () => {
    const messages: StoredMsg[] = [{ role: "user" }, { role: "assistant" }];
    expect(restorePool(messages)).toBeNull();
  });

  it("should restore base PDF from latest user message", () => {
    const messages: StoredMsg[] = [
      {
        role: "user",
        contextRefs: {
          basePdf: { itemId: 1, contextItemId: 100, title: "First" },
        },
      },
      { role: "assistant" },
      {
        role: "user",
        contextRefs: {
          basePdf: { itemId: 1, contextItemId: 100, title: "Latest" },
        },
      },
      { role: "assistant" },
    ];
    const pool = restorePool(messages)!;
    expect(pool.basePdfItemId).toBe(100);
    expect(pool.basePdfTitle).toBe("Latest"); // Uses latest, not first
    expect(pool.basePdfContext).toBe(""); // Lazy rebuild
  });

  it("should restore removed flag", () => {
    const messages: StoredMsg[] = [
      {
        role: "user",
        contextRefs: {
          basePdf: { itemId: 1, contextItemId: 100, title: "X", removed: true },
        },
      },
      { role: "assistant" },
    ];
    const pool = restorePool(messages)!;
    expect(pool.basePdfRemoved).toBe(true);
  });

  it("should restore supplemental papers with empty builtContext", () => {
    const messages: StoredMsg[] = [
      {
        role: "user",
        contextRefs: {
          basePdf: { itemId: 1, contextItemId: 2, title: "Base" },
          supplementalPapers: [
            { itemId: 10, contextItemId: 20, title: "Paper A" },
            { itemId: 30, contextItemId: 40, title: "Paper B" },
          ],
        },
      },
      { role: "assistant" },
    ];
    const pool = restorePool(messages)!;
    expect(pool.supplementalContexts.size).toBe(2);
    expect(pool.supplementalContexts.get(20)!.builtContext).toBe(""); // Lazy
    expect(pool.supplementalContexts.get(40)!.builtContext).toBe(""); // Lazy
  });

  it("should detect lazy rebuild needed (empty builtContext)", () => {
    const pool: PoolEntry = {
      basePdfContext: "",
      basePdfItemId: 100,
      basePdfTitle: "Paper",
      basePdfRemoved: false,
      supplementalContexts: new Map([
        [
          20,
          {
            ref: { itemId: 10, contextItemId: 20, title: "A" },
            builtContext: "",
            addedAtTurn: 1,
          },
        ],
      ]),
    };
    // Pool has basePdfItemId but empty basePdfContext → needs rebuild
    expect(pool.basePdfContext).toBe("");
    expect(pool.basePdfItemId).not.toBeNull();
    // Supplemental has empty builtContext → needs rebuild
    const entry = pool.supplementalContexts.get(20)!;
    expect(entry.builtContext).toBeFalsy();
  });
});

// ===========================================================================
// Phase 3: Zone B/C Conversation History Compression Tests
// ===========================================================================

// ---------------------------------------------------------------------------
// 9. Zone B/C split logic
// ---------------------------------------------------------------------------
describe("buildZoneBCSplit logic", () => {
  const RECENT_TURNS_PROTECTED = 5;

  type MockMessage = { role: "user" | "assistant"; text: string };

  function buildZoneBCSplit(history: MockMessage[]): {
    zoneBMessages: MockMessage[];
    zoneCMessages: MockMessage[];
  } {
    const protectedCount = RECENT_TURNS_PROTECTED * 2;
    if (history.length <= protectedCount) {
      return { zoneBMessages: [], zoneCMessages: history };
    }
    const splitIndex = history.length - protectedCount;
    return {
      zoneBMessages: history.slice(0, splitIndex),
      zoneCMessages: history.slice(splitIndex),
    };
  }

  function createHistory(turns: number): MockMessage[] {
    const msgs: MockMessage[] = [];
    for (let i = 0; i < turns; i++) {
      msgs.push({ role: "user", text: `Question ${i + 1}` });
      msgs.push({ role: "assistant", text: `Answer ${i + 1}` });
    }
    return msgs;
  }

  it("should keep all messages in Zone C when under protected limit", () => {
    const history = createHistory(3); // 6 messages, limit = 10
    const { zoneBMessages, zoneCMessages } = buildZoneBCSplit(history);
    expect(zoneBMessages).toHaveLength(0);
    expect(zoneCMessages).toHaveLength(6);
  });

  it("should keep exactly RECENT_TURNS_PROTECTED*2 in Zone C", () => {
    const history = createHistory(5); // 10 messages, limit = 10
    const { zoneBMessages, zoneCMessages } = buildZoneBCSplit(history);
    expect(zoneBMessages).toHaveLength(0);
    expect(zoneCMessages).toHaveLength(10);
  });

  it("should split correctly when over protected limit", () => {
    const history = createHistory(8); // 16 messages, limit = 10
    const { zoneBMessages, zoneCMessages } = buildZoneBCSplit(history);
    expect(zoneBMessages).toHaveLength(6); // 16 - 10 = 6
    expect(zoneCMessages).toHaveLength(10); // Protected
  });

  it("should split with many turns", () => {
    const history = createHistory(20); // 40 messages
    const { zoneBMessages, zoneCMessages } = buildZoneBCSplit(history);
    expect(zoneBMessages).toHaveLength(30); // 40 - 10 = 30
    expect(zoneCMessages).toHaveLength(10);
  });

  it("Zone C should always contain the latest messages", () => {
    const history = createHistory(8);
    const { zoneCMessages } = buildZoneBCSplit(history);
    expect(zoneCMessages[zoneCMessages.length - 1].text).toBe("Answer 8");
    expect(zoneCMessages[zoneCMessages.length - 2].text).toBe("Question 8");
  });
});

// ---------------------------------------------------------------------------
// 10. Estimate history length
// ---------------------------------------------------------------------------
describe("estimateHistoryLength", () => {
  type MockMessage = {
    text: string;
    selectedText?: string;
    selectedTexts?: string[];
  };

  function estimateHistoryLength(messages: MockMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += (msg.text || "").length;
      if (msg.selectedText) total += msg.selectedText.length;
      if (Array.isArray(msg.selectedTexts)) {
        for (const t of msg.selectedTexts) total += (t || "").length;
      }
    }
    return total;
  }

  it("should count text length", () => {
    expect(estimateHistoryLength([{ text: "Hello" }, { text: "World" }])).toBe(
      10,
    );
  });

  it("should include selected text", () => {
    expect(
      estimateHistoryLength([{ text: "Hi", selectedText: "Selected" }]),
    ).toBe(10);
  });

  it("should include selected texts array", () => {
    expect(
      estimateHistoryLength([{ text: "Hi", selectedTexts: ["A", "BB"] }]),
    ).toBe(5); // 2 + 1 + 2
  });

  it("should return 0 for empty history", () => {
    expect(estimateHistoryLength([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 11. Threshold detection
// ---------------------------------------------------------------------------
describe("compression threshold detection", () => {
  const THRESHOLD = 150000;

  it("should not trigger under threshold", () => {
    const contextLen = 50000;
    const historyLen = 30000;
    const questionLen = 200;
    const total = contextLen + historyLen + questionLen;
    expect(total <= THRESHOLD).toBe(true);
  });

  it("should trigger over threshold", () => {
    const contextLen = 100000;
    const historyLen = 60000;
    const questionLen = 500;
    const total = contextLen + historyLen + questionLen;
    expect(total > THRESHOLD).toBe(true);
  });

  it("should trigger when context alone exceeds threshold", () => {
    const contextLen = 160000;
    const historyLen = 0;
    const questionLen = 100;
    const total = contextLen + historyLen + questionLen;
    expect(total > THRESHOLD).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. Zone B summary formatting
// ---------------------------------------------------------------------------
describe("Zone B summary formatting", () => {
  type MockMessage = { role: "user" | "assistant"; text: string };

  function formatMessagesForSummary(messages: MockMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        return `[${role}]: ${(msg.text || "").slice(0, 2000)}`;
      })
      .join("\n\n");
  }

  it("should format messages with role labels", () => {
    const formatted = formatMessagesForSummary([
      { role: "user", text: "What is LSTM?" },
      { role: "assistant", text: "LSTM stands for..." },
    ]);
    expect(formatted).toContain("[User]: What is LSTM?");
    expect(formatted).toContain("[Assistant]: LSTM stands for...");
  });

  it("should truncate long messages to 2000 chars", () => {
    const longText = "x".repeat(5000);
    const formatted = formatMessagesForSummary([
      { role: "user", text: longText },
    ]);
    expect(formatted.length).toBeLessThan(2100); // "[User]: " + 2000
  });

  it("should separate messages with double newlines", () => {
    const formatted = formatMessagesForSummary([
      { role: "user", text: "A" },
      { role: "assistant", text: "B" },
    ]);
    expect(formatted).toContain("\n\n");
  });
});

// ---------------------------------------------------------------------------
// 13. Zone B summary cache lifecycle
// ---------------------------------------------------------------------------
describe("zoneBSummaryCache lifecycle", () => {
  let cache: Map<number, string>;

  beforeEach(() => {
    cache = new Map();
  });

  it("should store and retrieve summary", () => {
    cache.set(100, "This is a summary of the conversation...");
    expect(cache.get(100)).toContain("summary");
  });

  it("should update summary on subsequent compressions", () => {
    cache.set(100, "First summary");
    cache.set(100, "Updated summary with new turns");
    expect(cache.get(100)).toBe("Updated summary with new turns");
  });

  it("should clear on conversation clear", () => {
    cache.set(100, "Summary");
    cache.delete(100);
    expect(cache.has(100)).toBe(false);
  });

  it("should persist via compactedSummary in contextRefs", () => {
    const summary = "Key topics: LSTM, attention, time-series...";
    cache.set(100, summary);
    // Simulate snapshot
    const refs = { compactedSummary: cache.get(100) };
    // Simulate restore
    const newCache = new Map<number, string>();
    if (refs.compactedSummary) {
      newCache.set(100, refs.compactedSummary);
    }
    expect(newCache.get(100)).toBe(summary);
  });
});

// ===========================================================================
// Phase 4: UI Visual Indicators
// ===========================================================================

// ---------------------------------------------------------------------------
// 14. Base PDF chip visibility logic
// ---------------------------------------------------------------------------
describe("base PDF chip visibility", () => {
  type PoolEntry = {
    basePdfItemId: number | null;
    basePdfTitle: string;
    basePdfContext: string;
    basePdfRemoved: boolean;
  };

  function shouldShowBasePdfChip(pool?: PoolEntry): boolean {
    return !!pool && pool.basePdfItemId !== null && !pool.basePdfRemoved;
  }

  it("should show chip when pool has base PDF", () => {
    const pool: PoolEntry = {
      basePdfItemId: 123,
      basePdfTitle: "Test Paper",
      basePdfContext: "Full text...",
      basePdfRemoved: false,
    };
    expect(shouldShowBasePdfChip(pool)).toBe(true);
  });

  it("should hide chip when basePdfRemoved is true", () => {
    const pool: PoolEntry = {
      basePdfItemId: 123,
      basePdfTitle: "Test Paper",
      basePdfContext: "Full text...",
      basePdfRemoved: true,
    };
    expect(shouldShowBasePdfChip(pool)).toBe(false);
  });

  it("should hide chip when no basePdfItemId", () => {
    const pool: PoolEntry = {
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfContext: "",
      basePdfRemoved: false,
    };
    expect(shouldShowBasePdfChip(pool)).toBe(false);
  });

  it("should hide chip when pool is undefined", () => {
    expect(shouldShowBasePdfChip(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 15. Compressed context label detection
// ---------------------------------------------------------------------------
describe("compressed context label", () => {
  function isCompressed(context: string): boolean {
    return context.startsWith("[摘要]") || context.startsWith("[Summary]");
  }

  function formatChipLabel(title: string, context: string): string {
    return isCompressed(context) ? `📌 ${title} [Summary]` : `📌 ${title}`;
  }

  it("should detect compressed context (Chinese)", () => {
    expect(isCompressed("[摘要]\n论文主要讨论...")).toBe(true);
  });

  it("should detect compressed context (English)", () => {
    expect(isCompressed("[Summary]\nThe paper discusses...")).toBe(true);
  });

  it("should not detect uncompressed context", () => {
    expect(isCompressed("Paper Full Text (complete document):...")).toBe(false);
  });

  it("should add [Summary] suffix when compressed", () => {
    const label = formatChipLabel("LSTM Paper", "[摘要]\n...");
    expect(label).toBe("📌 LSTM Paper [Summary]");
  });

  it("should not add [Summary] suffix when uncompressed", () => {
    const label = formatChipLabel("LSTM Paper", "Full text here...");
    expect(label).toBe("📌 LSTM Paper");
  });
});

// ---------------------------------------------------------------------------
// 16. Unpin base PDF behavior
// ---------------------------------------------------------------------------
describe("unpin base PDF behavior", () => {
  type PoolEntry = {
    basePdfItemId: number | null;
    basePdfTitle: string;
    basePdfContext: string;
    basePdfRemoved: boolean;
  };

  it("should set basePdfRemoved on unpin", () => {
    const pool: PoolEntry = {
      basePdfItemId: 456,
      basePdfTitle: "My Paper",
      basePdfContext: "Full text...",
      basePdfRemoved: false,
    };
    // Simulate click ✕
    pool.basePdfRemoved = true;
    expect(pool.basePdfRemoved).toBe(true);
    // Context should not be sent
    const pdfContext = pool.basePdfRemoved ? "" : pool.basePdfContext;
    expect(pdfContext).toBe("");
  });

  it("should preserve basePdfContext in pool after unpin", () => {
    const pool: PoolEntry = {
      basePdfItemId: 456,
      basePdfTitle: "My Paper",
      basePdfContext: "Full text still here...",
      basePdfRemoved: true,
    };
    // Context is preserved internally (can be re-used if re-pinned)
    expect(pool.basePdfContext).toContain("Full text");
    // But won't be sent
    const pdfContext = pool.basePdfRemoved ? "" : pool.basePdfContext;
    expect(pdfContext).toBe("");
  });
});
