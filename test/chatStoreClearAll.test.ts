import { assert } from "chai";

type ChatStoreModule = typeof import("../src/utils/chatStore");
type ChatTransferModule = typeof import("../src/utils/chatTransfer");

describe("chat history clearing", function () {
  let chatStore: ChatStoreModule;
  let chatTransfer: ChatTransferModule;
  let statements: string[];
  let transactions: number;
  let existingTables: Set<string>;
  let pendingTransferRows: number;
  let originalZotero: unknown;
  let originalToolkit: unknown;

  before(async function () {
    originalZotero = (globalThis as any).Zotero;
    originalToolkit = (globalThis as any).ztoolkit;
    (globalThis as any).ztoolkit = { log: () => undefined };
    (globalThis as any).Zotero = {
      Prefs: { get: () => "", set: () => undefined },
      DB: {
        async executeTransaction(fn: () => Promise<unknown>) {
          transactions += 1;
          return fn();
        },
        async queryAsync(sql: string) {
          statements.push(sql.replace(/\s+/g, " ").trim());
          return [];
        },
        async valueQueryAsync(sql: string) {
          const table = sql.match(/name='([a-z_]+)'/)?.[1];
          if (table) return existingTables.has(table) ? table : false;
          if (/SELECT 1 FROM/.test(sql)) return pendingTransferRows ? 1 : false;
          return false;
        },
      },
    };
    chatStore = await import("../src/utils/chatStore");
    chatTransfer = await import("../src/utils/chatTransfer");
  });

  beforeEach(function () {
    statements = [];
    transactions = 0;
    pendingTransferRows = 0;
    existingTables = new Set([
      "zotero_ai_memories",
      "zotero_ai_transfer_sources",
    ]);
  });

  after(function () {
    (globalThis as any).Zotero = originalZotero;
    (globalThis as any).ztoolkit = originalToolkit;
  });

  it("also clears memories and pending transfer sources", async function () {
    await chatStore.clearAllChatHistory();
    assert.include(statements, "DELETE FROM zotero_ai_memories");
    assert.include(statements, "DELETE FROM zotero_ai_transfer_sources");
  });

  it("skips optional tables that were never created", async function () {
    existingTables.clear();
    await chatStore.clearAllChatHistory();
    assert.notInclude(statements, "DELETE FROM zotero_ai_memories");
    assert.notInclude(statements, "DELETE FROM zotero_ai_transfer_sources");
  });

  it("notifies subscribers until they unsubscribe", async function () {
    let calls = 0;
    const unsubscribe = chatStore.onChatHistoryCleared(() => {
      calls += 1;
    });
    const failing = chatStore.onChatHistoryCleared(() => {
      throw new Error("listener failure must not break clearing");
    });
    await chatStore.clearAllChatHistory();
    assert.equal(calls, 1);
    unsubscribe();
    failing();
    await chatStore.clearAllChatHistory();
    assert.equal(calls, 1);
  });

  it("does not open a transaction when no transferred conversation is pending", async function () {
    await chatTransfer.reconcileTransferredConversations();
    assert.equal(transactions, 0);
  });

  it("still reconciles inside a transaction when rows are pending", async function () {
    pendingTransferRows = 1;
    await chatTransfer.reconcileTransferredConversations();
    assert.equal(transactions, 1);
  });
});
