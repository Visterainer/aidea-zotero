import { assert } from "chai";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  editUserMessageAndRetry,
  editLatestUserMessageAndRetry,
  ensureConversationLoaded,
  reloadActiveConversationPath,
  retryLatestAssistantResponse,
  sendQuestion,
  switchConversationVariant,
} from "../src/modules/contextPanel/chat";
import {
  cancelPanelRequest,
  chatHistory,
  conversationContextPool,
  isPanelGenerating,
  loadedConversationKeys,
  loadingConversationTasks,
  selectedImageCache,
} from "../src/modules/contextPanel/state";
import {
  clearAllChatHistory,
  loadConversationPath,
} from "../src/utils/chatStore";
import { initMemoryStore } from "../src/utils/memoryStore";

const M = "zotero_ai_chat_messages";
const key = 2_000_001_433;
const item = { id: key, isAttachment: () => false } as Zotero.Item;
const config = ["test-model", "https://example.test/v1", "key"] as const;
const panel = () => ({ querySelector: () => null }) as unknown as Element;
const visible = () => chatHistory.get(key)!;
const texts = () => visible().map((m) => m.text);
const chatChunk = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
const sse = (text: string) =>
  new Response(chatChunk(text) + "data: [DONE]\n\n");

describe("chat request lifetime and stream persistence", function () {
  const globals = globalThis as any;
  let originals: Record<string, unknown>;
  let db: DatabaseSync;
  let body: Element;
  const send = (question: string) =>
    sendQuestion(body, item, question, undefined, ...config);

  beforeEach(function () {
    originals = {
      Zotero: globals.Zotero,
      ztoolkit: globals.ztoolkit,
      fetch: globals.fetch,
    };
    body = panel();
    db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE ${M} (
      id INTEGER PRIMARY KEY, conversation_key INTEGER, parent_id INTEGER, active_child_id INTEGER,
      branch_index INTEGER, role TEXT, text TEXT, timestamp INTEGER, selected_text TEXT,
      selected_texts_json TEXT, selected_text_sources_json TEXT, selected_text_paper_contexts_json TEXT,
      paper_contexts_json TEXT, screenshot_images TEXT, attachments_json TEXT, model_name TEXT,
      reasoning_summary TEXT, reasoning_details TEXT, context_refs_json TEXT);
      CREATE TABLE zotero_ai_chat_tree_state (conversation_key INTEGER PRIMARY KEY, active_root_id INTEGER, active_leaf_id INTEGER);
      CREATE TABLE zotero_ai_global_conversations (conversation_key INTEGER PRIMARY KEY);
      CREATE TABLE zotero_ai_paper_conversations (conversation_key INTEGER PRIMARY KEY);
      CREATE TABLE zotero_ai_attachment_refs (owner_type TEXT, owner_id INTEGER, blob_hash TEXT, updated_at INTEGER, PRIMARY KEY(owner_type,owner_id,blob_hash));`);
    const prefs = new Map<string, unknown>();
    globals.Zotero = {
      locale: "en-US",
      Prefs: {
        get: (k: string) => prefs.get(k),
        set: (k: string, v: unknown) => prefs.set(k, v),
      },
      DB: {
        queryAsync: async (sql: string, args: SQLInputValue[] = []) =>
          db.prepare(sql).all(...args),
        valueQueryAsync: async (sql: string, args: SQLInputValue[] = []) => {
          const row = db.prepare(sql).get(...args);
          return row ? Object.values(row)[0] : false;
        },
        executeTransaction: async (fn: () => Promise<unknown>) => {
          db.exec("BEGIN");
          try {
            const result = await fn();
            db.exec("COMMIT");
            return result;
          } catch (err) {
            db.exec("ROLLBACK");
            throw err;
          }
        },
      },
    };
    globals.ztoolkit = { log() {}, getGlobal: (k: string) => globals[k] };
    globals.fetch = async () => sse("Answer");
  });

  afterEach(function () {
    Object.assign(globals, originals);
    loadedConversationKeys.delete(key);
    chatHistory.delete(key);
    conversationContextPool.delete(key);
    db.close();
  });

  // Pause a real sqlite operation after it has produced its rows but before
  // the awaiting panel can observe them. No sleeps or fake request counters.
  function pauseQuery(
    matches: (sql: string) => boolean,
    reject = false,
    method = "queryAsync",
  ) {
    let announce!: () => void, resume!: () => void;
    const reached = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const query = globals.Zotero.DB[method];
    let armed = true;
    globals.Zotero.DB[method] = async (sql: string, args?: SQLInputValue[]) => {
      const rows = await query(sql, args);
      if (armed && matches(sql)) {
        armed = false;
        announce();
        await wait;
        if (reject) throw new Error("old read failed");
      }
      return rows;
    };
    return { reached, resume };
  }

  const clearReason = () => clearAllChatHistory().then(() => "", String);
  const forget = () => {
    loadedConversationKeys.delete(key);
    chatHistory.delete(key);
  };

  for (const mode of ["send", "edit", "editLatest", "retry"]) {
    it(`blocks clear during the initial ${mode} history read before any new row has an ID`, async function () {
      await send("Seed");
      const id = visible()[0].messageId!;
      forget();
      const gate = pauseQuery(() => true);
      const task =
        mode === "send"
          ? send("Next")
          : mode === "edit"
            ? editUserMessageAndRetry(body, item, id, "Edited", ...config)
            : mode === "editLatest"
              ? editLatestUserMessageAndRetry(
                  body,
                  item,
                  "Edited",
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  ...config,
                )
              : retryLatestAssistantResponse(body, item, ...config);
      await gate.reached;
      const reason = await clearReason();
      gate.resume();
      await task;
      assert.include(reason, "still being generated");
      assert.equal(texts().at(-1), "Answer");
      await clearAllChatHistory();
    });
  }

  it("blocks clear for an ID-less stream after cancellation and after the other window finishes", async function () {
    const gate = pauseQuery(
      (sql) => sql.includes(`INSERT INTO ${M}`),
      false,
      "valueQueryAsync",
    );
    db.exec(`CREATE TRIGGER deny BEFORE INSERT ON ${M} WHEN NEW.role='assistant'
      BEGIN SELECT RAISE(ABORT,'no placeholder'); END;`);
    let reached!: () => void, resume!: () => void;
    const fetching = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const wait = new Promise<void>((resolve) => {
      resume = resolve;
    });
    globals.fetch = async () => {
      reached();
      await wait;
      return sse("First");
    };
    const first = send("Question");
    await gate.reached;
    const beforeID = await clearReason();
    gate.resume();
    await fetching;
    const id = visible().at(-1)?.messageId;
    const duringStream = await clearReason();
    globals.fetch = async () => sse("Other");
    await sendQuestion(
      panel(),
      { ...item, id: key + 1 } as Zotero.Item,
      "Other",
      undefined,
      ...config,
    );
    cancelPanelRequest(body);
    const whileUnwinding = await clearReason();
    resume();
    await first;
    assert.isUndefined(id);
    for (const reason of [beforeID, duringStream, whileUnwinding])
      assert.include(reason, "still being generated");
    await clearAllChatHistory();
  });

  it("blocks clear after the answer has settled until auto-captured memories finish writing", async function () {
    await initMemoryStore();
    const gate = pauseQuery((sql) =>
      /INSERT INTO zotero_ai_memories/.test(sql),
    );
    const task = sendQuestion(
      body,
      { ...item, libraryID: 1 } as Zotero.Item,
      "I prefer responses in English.",
      undefined,
      ...config,
    );
    await gate.reached;
    const answered = visible().at(-1);
    const reason = await clearReason();
    gate.resume();
    await task;
    assert.equal(answered?.text, "Answer");
    assert.isNotTrue(answered?.streaming);
    assert.include(reason, "still being generated");
    await clearAllChatHistory();
    assert.lengthOf(db.prepare("SELECT * FROM zotero_ai_memories").all(), 0);
  });

  it("releases both the panel and the blocker when controller setup throws", async function () {
    const toolkit = globals.ztoolkit;
    globals.ztoolkit = {
      ...toolkit,
      getGlobal() {
        throw new Error("controller setup failed");
      },
    };
    const reason = await send("Throw").then(() => "", String);
    assert.include(reason, "controller setup failed");
    assert.isFalse(isPanelGenerating(body));
    await clearAllChatHistory();
    globals.ztoolkit = toolkit;
    await send("Next");
    assert.deepEqual(texts(), ["Next", "Answer"]);
  });

  it("cleans up an assigned placeholder when rendering the first bubble throws", async function () {
    let boxQueries = 0;
    body = {
      querySelector(id: string) {
        if (id === "#llm-chat-box" && ++boxQueries === 2)
          throw new Error("detached panel");
        return null;
      },
    } as Element;
    const error = await send("Throw").then(() => "", String);
    assert.include(error, "detached panel");
    assert.isFalse(isPanelGenerating(body));
    assert.isFalse(visible().at(-1)?.streaming);
    await clearAllChatHistory();
  });

  for (const rollback of [true, false]) {
    it(`does not start a request inside an in-progress clear (${rollback ? "rollback" : "commit"})`, async function () {
      const gate = pauseQuery(
        (sql) => sql.includes(`DELETE FROM ${M}`),
        rollback,
      );
      const clearing = clearReason();
      await gate.reached;
      await send("Blocked");
      const during = db.prepare(`SELECT * FROM ${M}`).all();
      gate.resume();
      assert.equal(Boolean(await clearing), rollback);
      assert.lengthOf(during, 0);
      await send("After");
      assert.deepEqual(texts(), ["After", "Answer"]);
    });
  }

  for (const mode of ["load", "failed load", "reload"]) {
    it(`discards a pre-clear ${mode} result even when the conversation key has been reused`, async function () {
      await sendQuestion(
        body,
        item,
        "Secret",
        ["data:image/png;base64,old"],
        ...config,
      );
      forget();
      const gate = pauseQuery(
        (sql) => sql.includes("AND id IN ("),
        mode === "failed load",
      );
      const task =
        mode === "reload"
          ? reloadActiveConversationPath(item)
          : ensureConversationLoaded(item);
      await gate.reached;
      await clearAllChatHistory();
      const nextGate = pauseQuery(() => true);
      const next = ensureConversationLoaded(item);
      const freshLoad = loadingConversationTasks.get(key);
      gate.resume();
      await task;
      const pending = loadingConversationTasks.get(key);
      const alreadyLoaded = loadedConversationKeys.has(key);
      const stale = chatHistory.get(key);
      nextGate.resume();
      await next;
      assert.isDefined(freshLoad);
      assert.strictEqual(pending, freshLoad);
      assert.isFalse(alreadyLoaded);
      assert.isUndefined(stale);
      assert.isFalse(selectedImageCache.has(key));
      assert.deepEqual(texts(), []);
    });
  }

  for (const role of ["user", "assistant"]) {
    it(`keeps both messages when the ${role} INSERT fails, including after the next successful send`, async function () {
      db.exec(`CREATE TRIGGER deny BEFORE INSERT ON ${M} WHEN NEW.role='${role}'
        BEGIN SELECT RAISE(ABORT,'insert failed'); END;`);
      await send("First");
      assert.deepEqual(texts(), ["First", "Answer"]);
      assert.isFalse(visible()[1].streaming);
      assert.isUndefined(visible()[1].messageId);
      assert.deepEqual(
        (await loadConversationPath(key, 20)).map((m) => m.text),
        role === "user" ? [] : ["First"],
      );
      db.exec("DROP TRIGGER deny");
      await send("Next");
      assert.deepEqual(texts(), ["First", "Answer", "Next", "Answer"]);
      assert.isNumber(visible()[3].messageId);
    });
  }

  const rejectFinalWrite = () =>
    db.exec(`CREATE TRIGGER deny BEFORE UPDATE OF text ON ${M}
    WHEN OLD.role='assistant' BEGIN SELECT RAISE(ABORT,'final update failed'); END;`);

  for (const mode of ["send", "retry", "edit"]) {
    it(`settles the visible ${mode} answer when its final UPDATE rejects after a second panel reloads the active branch`, async function () {
      if (mode !== "send") await send("Original");
      rejectFinalWrite();
      const otherPanel = panel();
      let reloads = 0;
      globals.fetch = async () => {
        const answer = visible().at(-1)!;
        await switchConversationVariant(
          otherPanel,
          item,
          answer.parentMessageId!,
          answer.messageId!,
        );
        reloads++;
        return sse("Final answer");
      };
      if (mode === "send") await send("First");
      if (mode === "retry")
        await retryLatestAssistantResponse(body, item, ...config);
      if (mode === "edit")
        await editUserMessageAndRetry(
          body,
          item,
          visible()[0].messageId!,
          "Edited",
          ...config,
        );
      assert.equal(reloads, 1);
      assert.deepEqual(texts(), [
        mode === "edit" ? "Edited" : mode === "retry" ? "Original" : "First",
        "Final answer",
      ]);
      assert.isFalse(visible()[1].streaming);
      assert.isFalse(isPanelGenerating(body));
      assert.equal((await loadConversationPath(key, 20)).at(-1)?.text, "");
      db.exec("DROP TRIGGER deny");
      globals.fetch = async () => sse("Saved");
      await send("Next");
      assert.deepEqual(texts().slice(1), ["Final answer", "Next", "Saved"]);
    });
  }

  it("does not discard a durable row ID if reference syncing fails after INSERT", async function () {
    db.exec("DROP TABLE zotero_ai_attachment_refs");
    globals.Zotero.DB.queryAsync = async (
      sql: string,
      args: SQLInputValue[] = [],
    ) => {
      if (sql.includes("zotero_ai_attachment_refs"))
        throw new Error("reference sync failed");
      return db.prepare(sql).all(...args);
    };
    await send("First");
    assert.deepEqual(
      (await loadConversationPath(key, 20)).map((m) => m.text),
      ["First", "Answer"],
    );
    assert.equal(visible()[1].parentMessageId, visible()[0].messageId);
  });

  it("keeps a provider failure visible when writing the failure itself rejects", async function () {
    rejectFinalWrite();
    globals.fetch = async () =>
      new Response(
        'data: {"error":{"message":"provider rejected request"}}\n\n',
      );
    await send("First");
    assert.include(visible()[1].text, "provider rejected request");
    assert.notInclude(visible()[1].text, "final update failed");
    assert.isFalse(visible()[1].streaming);
    assert.isFalse(isPanelGenerating(body));
  });

  it("does not replace the sibling selected in another window with the unsaved retry", async function () {
    await send("First");
    const old = visible()[1];
    globals.fetch = async () => {
      await switchConversationVariant(
        panel(),
        item,
        old.parentMessageId!,
        old.messageId!,
      );
      return sse("Hidden retry");
    };
    rejectFinalWrite();
    await retryLatestAssistantResponse(body, item, ...config);
    assert.deepEqual(texts(), ["First", "Answer"]);
    assert.equal(visible()[1].messageId, old.messageId);
    assert.isNotTrue(visible()[1].streaming);
  });

  it("keeps a cancelled partial answer when the final write rejects", async function () {
    rejectFinalWrite();
    globals.fetch = async () => {
      let step = 0;
      return new Response(
        new ReadableStream(
          {
            pull(controller) {
              if (step++ === 0)
                controller.enqueue(
                  new TextEncoder().encode(chatChunk("Partial answer")),
                );
              else {
                cancelPanelRequest(body);
                controller.close();
              }
            },
          },
          { highWaterMark: 0 },
        ),
      );
    };
    await send("First");
    assert.deepEqual(texts(), ["First", "Partial answer"]);
    assert.isFalse(visible()[1].streaming);
    assert.isFalse(isPanelGenerating(body));
  });
});
