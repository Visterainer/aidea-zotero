import { assert } from "chai";

import {
  appendMessageNode,
  cloneActivePathPrefixToConversation,
  createSiblingBranch,
  loadConversationPath,
  loadConversationTree,
  setActiveChild,
  type StoredChatMessage,
} from "../src/utils/chatStore";

type DbMessageRow = {
  id: number;
  conversation_key: number;
  parent_id: number | null;
  active_child_id: number | null;
  branch_index: number;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  selected_text: string | null;
  selected_texts_json: string | null;
  selected_text_sources_json: string | null;
  selected_text_paper_contexts_json: string | null;
  paper_contexts_json: string | null;
  screenshot_images: string | null;
  attachments_json: string | null;
  model_name: string | null;
  reasoning_summary: string | null;
  reasoning_details: string | null;
  context_refs_json: string | null;
};

type TreeStateRow = {
  conversation_key: number;
  active_root_id: number | null;
  active_leaf_id: number | null;
};

function createMockDb() {
  const messages: DbMessageRow[] = [];
  const treeStates: TreeStateRow[] = [];
  let nextId = 1;
  let lastInsertId = 0;

  const toTreeRow = (row: DbMessageRow) => ({
    messageId: row.id,
    parentMessageId: row.parent_id,
    activeChildMessageId: row.active_child_id,
    branchIndex: row.branch_index,
  });

  const toStoredRow = (row: DbMessageRow) => ({
    ...toTreeRow(row),
    role: row.role,
    text: row.text,
    timestamp: row.timestamp,
    selectedText: row.selected_text,
    selectedTextsJson: row.selected_texts_json,
    selectedTextSourcesJson: row.selected_text_sources_json,
    selectedTextPaperContextsJson: row.selected_text_paper_contexts_json,
    paperContextsJson: row.paper_contexts_json,
    screenshotImages: row.screenshot_images,
    attachmentsJson: row.attachments_json,
    modelName: row.model_name,
    reasoningSummary: row.reasoning_summary,
    reasoningDetails: row.reasoning_details,
    contextRefsJson: row.context_refs_json,
  });

  const sortedRows = (conversationKey: number) =>
    messages
      .filter((row) => row.conversation_key === conversationKey)
      .sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);

  const db = {
    async executeTransaction<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    },
    async columnQueryAsync(sql: string): Promise<number[] | false> {
      if (sql.includes("SELECT DISTINCT conversation_key")) {
        return [...new Set(messages.map((row) => row.conversation_key))].sort(
          (a, b) => a - b,
        );
      }
      return false;
    },
    async valueQueryAsync(sql: string, params: unknown[] = []) {
      if (sql.includes("last_insert_rowid")) return lastInsertId;
      if (sql.includes("SELECT conversation_key")) {
        const id = Number(params[0]);
        return messages.find((row) => row.id === id)?.conversation_key || false;
      }
      if (sql.includes("SELECT id") && sql.includes("parent_id IS NULL")) {
        const conversationKey = Number(params[0]);
        return (
          sortedRows(conversationKey)
            .filter((row) => row.parent_id === null)
            .sort((a, b) => a.branch_index - b.branch_index || a.id - b.id)[0]
            ?.id || false
        );
      }
      return false;
    },
    async queryAsync(sql: string, params: unknown[] = []) {
      if (sql.includes("SELECT active_root_id")) {
        const conversationKey = Number(params[0]);
        const state = treeStates.find(
          (row) => row.conversation_key === conversationKey,
        );
        return state
          ? [
              {
                activeRootId: state.active_root_id,
                activeLeafId: state.active_leaf_id,
              },
            ]
          : [];
      }
      if (sql.includes("INSERT OR REPLACE INTO zotero_ai_chat_tree_state")) {
        const conversationKey = Number(params[0]);
        const existing = treeStates.find(
          (row) => row.conversation_key === conversationKey,
        );
        const nextState = {
          conversation_key: conversationKey,
          active_root_id:
            params[1] === null || params[1] === undefined
              ? null
              : Number(params[1]),
          active_leaf_id:
            params[2] === null || params[2] === undefined
              ? null
              : Number(params[2]),
        };
        if (existing) Object.assign(existing, nextState);
        else treeStates.push(nextState);
        return [];
      }
      if (
        sql.includes("SELECT id AS messageId") &&
        sql.includes("FROM zotero_ai_chat_messages") &&
        !sql.includes("role,")
      ) {
        return sortedRows(Number(params[0])).map(toTreeRow);
      }
      if (sql.includes("SELECT MAX(branch_index)")) {
        const conversationKey = Number(params[0]);
        const parentId = sql.includes("parent_id IS NULL")
          ? null
          : Number(params[1]);
        const branches = messages
          .filter(
            (row) =>
              row.conversation_key === conversationKey &&
              row.parent_id === parentId,
          )
          .map((row) => row.branch_index);
        return [
          {
            maxBranchIndex: branches.length ? Math.max(...branches) : null,
          },
        ];
      }
      if (sql.includes("INSERT INTO zotero_ai_chat_messages")) {
        messages.push({
          id: nextId++,
          conversation_key: Number(params[0]),
          parent_id: params[1] === null ? null : Number(params[1]),
          active_child_id: null,
          branch_index: Number(params[2]),
          role: params[3] as "user" | "assistant",
          text: String(params[4] || ""),
          timestamp: Number(params[5]),
          selected_text: (params[6] as string | null) ?? null,
          selected_texts_json: (params[7] as string | null) ?? null,
          selected_text_sources_json: (params[8] as string | null) ?? null,
          selected_text_paper_contexts_json:
            (params[9] as string | null) ?? null,
          paper_contexts_json: (params[10] as string | null) ?? null,
          screenshot_images: (params[11] as string | null) ?? null,
          attachments_json: (params[12] as string | null) ?? null,
          model_name: (params[13] as string | null) ?? null,
          reasoning_summary: (params[14] as string | null) ?? null,
          reasoning_details: (params[15] as string | null) ?? null,
          context_refs_json: (params[16] as string | null) ?? null,
        });
        lastInsertId = nextId - 1;
        return [];
      }
      if (sql.includes("UPDATE zotero_ai_chat_messages")) {
        const conversationKey = Number(params[params.length - 1]);
        if (sql.includes("active_child_id") && sql.includes("WHERE id = ?")) {
          const childId = params[0] === null ? null : Number(params[0]);
          const id = Number(params[1]);
          const row = messages.find(
            (entry) =>
              entry.id === id && entry.conversation_key === conversationKey,
          );
          if (row) row.active_child_id = childId;
          return [];
        }
        if (sql.includes("SET parent_id")) {
          const parentId = params[0] === null ? null : Number(params[0]);
          const id = Number(params[1]);
          const row = messages.find(
            (entry) =>
              entry.id === id && entry.conversation_key === conversationKey,
          );
          if (row) {
            row.parent_id = parentId;
            row.active_child_id = null;
            row.branch_index = 0;
          }
          return [];
        }
      }
      if (sql.includes("SELECT parent_id AS parentMessageId")) {
        const conversationKey = Number(params[0]);
        const id = Number(params[1]);
        const row = messages.find(
          (entry) =>
            entry.conversation_key === conversationKey && entry.id === id,
        );
        return row ? [{ parentMessageId: row.parent_id }] : [];
      }
      if (
        sql.includes("SELECT id AS messageId") &&
        sql.includes("role,") &&
        sql.includes("id IN")
      ) {
        const conversationKey = Number(params[0]);
        const ids = new Set(params.slice(1).map(Number));
        return messages
          .filter(
            (row) =>
              row.conversation_key === conversationKey && ids.has(row.id),
          )
          .map(toStoredRow);
      }
      if (
        sql.includes("SELECT id AS messageId") &&
        sql.includes("role,") &&
        sql.includes("ORDER BY timestamp ASC")
      ) {
        return sortedRows(Number(params[0])).map(toStoredRow);
      }
      return [];
    },
  };

  return db;
}

function installMockZoteroDb() {
  (globalThis as any).Zotero = {
    DB: createMockDb(),
    Items: {
      get: () => null,
    },
  };
}

describe("chatStore message tree", function () {
  beforeEach(function () {
    installMockZoteroDb();
  });

  it("creates user siblings and switches active paths without deleting old branches", async function () {
    const firstUser = await appendMessageNode(
      1,
      { role: "user", text: "old prompt", timestamp: 1 },
      null,
    );
    const firstAssistant = await appendMessageNode(
      1,
      { role: "assistant", text: "old answer", timestamp: 2 },
      firstUser,
    );

    const editedUser = await createSiblingBranch(1, firstUser, {
      role: "user",
      text: "new prompt",
      timestamp: 3,
      contextRefs: {
        baseDocument: {
          kind: "epub",
          itemId: 10,
          contextItemId: 12,
          title: "Book",
          retrievalSegmentIds: ["epub:chapter-two.xhtml"],
        },
        basePdf: {
          itemId: 10,
          contextItemId: 11,
          title: "Paper",
        },
      },
    });
    await appendMessageNode(
      1,
      { role: "assistant", text: "new answer", timestamp: 4 },
      editedUser,
    );

    let activePath = await loadConversationPath(1, 20);
    assert.deepEqual(
      activePath.map((message) => message.text),
      ["new prompt", "new answer"],
    );
    assert.strictEqual(activePath[0].siblingIndex, 2);
    assert.strictEqual(activePath[0].siblingCount, 2);
    assert.strictEqual(activePath[0].contextRefs?.basePdf?.contextItemId, 11);
    assert.deepEqual(
      activePath[0].contextRefs?.baseDocument?.retrievalSegmentIds,
      ["epub:chapter-two.xhtml"],
    );

    activePath = await setActiveChild(1, null, firstUser);
    assert.deepEqual(
      activePath.map((message) => message.text),
      ["old prompt", "old answer"],
    );
    assert.strictEqual(activePath[0].siblingIndex, 1);
    assert.strictEqual((await loadConversationTree(1)).length, 4);
    assert.strictEqual(firstAssistant > 0, true);
  });

  it("clones only the current active prefix to a new conversation", async function () {
    const userA = await appendMessageNode(
      1,
      { role: "user", text: "A", timestamp: 1 },
      null,
    );
    const assistantA = await appendMessageNode(
      1,
      { role: "assistant", text: "A1", timestamp: 2 },
      userA,
    );
    const userB = await createSiblingBranch(1, userA, {
      role: "user",
      text: "B",
      timestamp: 3,
    });
    await appendMessageNode(
      1,
      { role: "assistant", text: "B1", timestamp: 4 },
      userB,
    );
    await setActiveChild(1, null, userA);

    const clonedIds = await cloneActivePathPrefixToConversation(
      1,
      2,
      assistantA,
    );
    const clonedPath = await loadConversationPath(2, 20);

    assert.strictEqual(clonedIds.length, 2);
    assert.deepEqual(
      clonedPath.map((message) => message.text),
      ["A", "A1"],
    );
    assert.deepEqual(
      (await loadConversationTree(2)).map((message) => message.text),
      ["A", "A1"],
    );
  });

  it("normalizes assistant text and summaries at the persistence boundary", async function () {
    const userId = await appendMessageNode(
      1,
      {
        role: "user",
        text: "<think>literal user text</think>Keep",
        timestamp: 1,
      },
      null,
    );
    await appendMessageNode(
      1,
      {
        role: "assistant",
        text: "<think>private</think>Visible",
        timestamp: 2,
        reasoningSummary: "private summary",
        reasoningDetails: "private details",
        contextRefs: {
          compactedSummary: "<thought>summary private</thought>Clean summary",
        },
      },
      userId,
    );
    const path = await loadConversationPath(1, 20);
    assert.equal(path[0].text, "<think>literal user text</think>Keep");
    assert.equal(path[1].text, "Visible");
    assert.equal(path[1].contextRefs?.compactedSummary, "Clean summary");
    assert.isUndefined(path[1].reasoningSummary);
    assert.isUndefined(path[1].reasoningDetails);
  });
});
