import { assert } from "chai";

import { initChatStore } from "../src/utils/chatStore";

describe("chatStore initialization", function () {
  it("retries core setup, commits it before migrations, and initializes once", async function () {
    let tables = new Map<string, Set<string>>();
    let transactionCount = 0;
    let coreAttemptCount = 0;
    let failCoreOnce = true;
    const logs: string[] = [];

    const cloneTables = () =>
      new Map([...tables].map(([name, columns]) => [name, new Set(columns)]));

    const initialColumns = (table: string): string[] => {
      if (table === "zotero_ai_chat_messages") {
        return [
          "id",
          "conversation_key",
          "role",
          "text",
          "timestamp",
          "selected_text",
          "selected_texts_json",
          "selected_text_sources_json",
          "selected_text_paper_contexts_json",
          "paper_contexts_json",
          "screenshot_images",
          "attachments_json",
          "model_name",
          "reasoning_summary",
          "reasoning_details",
        ];
      }
      if (table === "zotero_ai_chat_tree_state") {
        return ["conversation_key", "active_root_id", "active_leaf_id"];
      }
      if (table === "zotero_ai_global_conversations") {
        return ["conversation_key", "library_id", "created_at", "title"];
      }
      if (table === "zotero_ai_paper_conversations") {
        return ["conversation_key", "parent_item_id", "created_at", "title"];
      }
      return [];
    };

    (globalThis as any).ztoolkit = {
      log(message: string) {
        logs.push(message);
      },
    };
    (globalThis as any).Zotero = {
      DB: {
        async executeTransaction<T>(fn: () => Promise<T>): Promise<T> {
          transactionCount += 1;
          const snapshot = cloneTables();
          try {
            return await fn();
          } catch (err) {
            tables = snapshot;
            throw err;
          }
        },
        async columnQueryAsync(sql: string): Promise<number[] | false> {
          if (sql.includes("SELECT DISTINCT conversation_key")) {
            throw new Error("injected legacy migration failure");
          }
          return false;
        },
        async queryAsync(sql: string): Promise<Array<{ name: string }>> {
          if (
            sql.includes("CREATE TABLE IF NOT EXISTS zotero_ai_chat_messages")
          ) {
            coreAttemptCount += 1;
            if (failCoreOnce) {
              failCoreOnce = false;
              throw new Error("injected core schema failure");
            }
          }

          const createMatch = sql.match(
            /CREATE TABLE IF NOT EXISTS\s+([a-z0-9_]+)/i,
          );
          if (createMatch) {
            const table = createMatch[1];
            if (!tables.has(table)) {
              tables.set(table, new Set(initialColumns(table)));
            }
            return [];
          }

          const pragmaMatch = sql.match(/PRAGMA table_info\(([^)]+)\)/i);
          if (pragmaMatch) {
            return [...(tables.get(pragmaMatch[1]) || [])].map((name) => ({
              name,
            }));
          }

          const alterMatch = sql.match(
            /ALTER TABLE\s+([a-z0-9_]+)\s+ADD COLUMN\s+([a-z0-9_]+)/i,
          );
          if (alterMatch) {
            tables.get(alterMatch[1])?.add(alterMatch[2]);
          }
          return [];
        },
      },
    };

    let coreFailure: unknown;
    try {
      await initChatStore();
    } catch (err) {
      coreFailure = err;
    }
    assert.match(String(coreFailure), /injected core schema failure/);
    assert.isEmpty([...tables.keys()]);

    await Promise.all([initChatStore(), initChatStore()]);
    await initChatStore();

    assert.equal(coreAttemptCount, 2);
    assert.isAtLeast(transactionCount, 3);
    assert.sameMembers(
      [...tables.keys()],
      [
        "zotero_ai_chat_messages",
        "zotero_ai_chat_tree_state",
        "zotero_ai_global_conversations",
        "zotero_ai_paper_conversations",
      ],
    );
    assert.includeMembers(
      [...(tables.get("zotero_ai_chat_messages") || [])],
      ["context_refs_json", "parent_id", "active_child_id", "branch_index"],
    );
    assert.include(
      [...(tables.get("zotero_ai_global_conversations") || [])],
      "is_pinned",
    );
    assert.include(
      [...(tables.get("zotero_ai_paper_conversations") || [])],
      "is_pinned",
    );
    assert.deepEqual(logs, [
      "LLM: Optional chat store migration failed (linear-conversations-to-tree)",
    ]);
  });
});
