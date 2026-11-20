import { assert } from "chai";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  ATTACHMENT_BLOBS_TABLE as blobs,
  ensureAttachmentBlobFromPath,
  persistAttachmentBlob,
} from "../src/modules/contextPanel/attachmentStorage";
import {
  ATTACHMENT_GC_MIN_AGE_MS as grace,
  collectAndDeleteUnreferencedBlobs as gc,
  replaceOwnerAttachmentRefs,
} from "../src/utils/attachmentRefStore";

const refs = "zotero_ai_attachment_refs";
const messages = "zotero_ai_chat_messages";
const bytes = new Uint8Array([1, 2, 3]);
const globals = globalThis as any;

function gate() {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { open, promise };
}

describe("attachment blob GC interleavings (SQLite)", function () {
  let db: DatabaseSync;
  let previousZotero: unknown, previousIO: unknown;
  const files = new Map<string, Uint8Array>();
  let afterSelection: (() => Promise<void>) | undefined;
  let beforeUnlink: (() => Promise<void>) | undefined;
  let inTransaction: boolean;
  let failCommit: boolean;

  beforeEach(function () {
    db = new DatabaseSync(":memory:");
    // Init promises are process-wide, while each test uses a fresh database.
    db.exec(`CREATE TABLE ${blobs} (hash TEXT PRIMARY KEY, path TEXT UNIQUE, size_bytes INTEGER, created_at INTEGER);
      CREATE TABLE ${refs} (owner_type TEXT, owner_id INTEGER, blob_hash TEXT, updated_at INTEGER, PRIMARY KEY(owner_type, owner_id, blob_hash));
      CREATE TABLE ${messages} (conversation_key INTEGER, attachments_json TEXT);`);
    previousZotero = globals.Zotero;
    previousIO = globals.IOUtils;
    inTransaction = failCommit = false;
    afterSelection = beforeUnlink = undefined;
    files.clear();
    globals.Zotero = {
      DataDirectory: { dir: "/data" },
      DB: {
        async queryAsync(sql: string, args: SQLInputValue[] = []) {
          const stmt = db.prepare(sql);
          if (!/^\s*SELECT/i.test(sql)) {
            stmt.run(...args);
            return undefined; // Zotero.queryAsync drops non-SELECT results
          }
          const rows = stmt.all(...args);
          if (afterSelection && sql.includes("b.created_at <=")) {
            assert.lengthOf(rows, 1, "GC must have selected the expired blob");
            await afterSelection();
          }
          return rows;
        },
        async valueQueryAsync(sql: string, args: SQLInputValue[] = []) {
          const row = db.prepare(sql).get(...args);
          return row ? Object.values(row)[0] : false;
        },
        async executeTransaction<T>(fn: () => Promise<T>) {
          assert.isFalse(inTransaction, "unexpected nested transaction");
          inTransaction = true;
          db.exec("BEGIN");
          try {
            const result = await fn();
            if (failCommit) throw new Error("commit failed");
            db.exec("COMMIT");
            return result;
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          } finally {
            inTransaction = false;
          }
        },
      },
    };
    globals.IOUtils = {
      makeDirectory: async () => {},
      exists: async (path: string) => files.has(path),
      write: async (path: string, data: Uint8Array) => files.set(path, data),
      remove: async (path: string) => {
        if (beforeUnlink) await beforeUnlink();
        files.delete(path);
      },
    };
  });

  afterEach(function () {
    globals.Zotero = previousZotero;
    globals.IOUtils = previousIO;
    db.close();
  });

  async function expiredBlob() {
    const blob = await persistAttachmentBlob("draft.txt", bytes);
    db.prepare(`UPDATE ${blobs} SET created_at = 0 WHERE hash = ?`).run(
      blob.contentHash,
    );
    return blob;
  }

  for (const action of [
    "upload",
    "managed path",
    "note ref",
    "message",
  ] as const) {
    it(`preserves a stale candidate claimed by a new ${action}`, async function () {
      const { contentHash, storedPath } = await expiredBlob();
      afterSelection = async () => {
        switch (action) {
          case "upload":
            assert.equal(
              (await persistAttachmentBlob("renamed.txt", bytes)).storedPath,
              storedPath,
            );
            break;
          case "managed path":
            await ensureAttachmentBlobFromPath(storedPath, "draft.txt");
            break;
          case "note ref":
            await replaceOwnerAttachmentRefs("note", 1, [contentHash]);
            break;
          case "message":
            // Normal message persistence precedes the separate ref-table sync.
            db.prepare(`INSERT INTO ${messages} VALUES (?,?)`).run(
              2,
              JSON.stringify([{ storedPath }]),
            );
            break;
        }
      };
      await gc(grace);
      assert.deepEqual(files.get(storedPath), bytes);
      assert.exists(
        db.prepare(`SELECT 1 FROM ${blobs} WHERE hash = ?`).get(contentHash),
      );
    });
  }

  it("skips a writer between its file check and its age refresh", async function () {
    const { storedPath } = await expiredBlob();
    const checked = gate(),
      resume = gate();
    globals.IOUtils.exists = async (path: string) => {
      const exists = files.has(path);
      checked.open();
      await resume.promise;
      return exists;
    };
    const writing = persistAttachmentBlob("draft.txt", bytes);
    await checked.promise;
    try {
      await gc(grace);
      assert.deepEqual(files.get(storedPath), bytes);
    } finally {
      resume.open();
      await writing;
    }
    assert.isAbove(
      Number(db.prepare(`SELECT created_at FROM ${blobs}`).get()?.created_at),
      0,
    );
  });

  it("lets a same-hash transaction recreate the file after committed GC unlink, without blocking other hashes", async function () {
    const { storedPath } = await expiredBlob();
    const unlink = gate(),
      resume = gate();
    beforeUnlink = async () => {
      unlink.open();
      await resume.promise;
    };
    const collecting = gc(grace);
    await unlink.promise;
    try {
      assert.isFalse(
        inTransaction,
        "GC must commit before touching the filesystem",
      );
      assert.isUndefined(db.prepare(`SELECT 1 FROM ${blobs}`).get());
      // A path-only adopter cannot recreate the file. Start it while the old
      // bytes still exist; it must wait for unlink, then report the loss.
      const pathResult = ensureAttachmentBlobFromPath(
        storedPath,
        "draft.txt",
      ).then(
        () => "adopted",
        (error: Error) => error.message,
      );
      await persistAttachmentBlob("other.txt", new Uint8Array([4]));
      // Import persists bytes and registers refs in an already-open transaction.
      const adopting = globals.Zotero.DB.executeTransaction(async () => {
        assert.match(await pathResult, /missing/);
        const blob = await persistAttachmentBlob("draft.txt", bytes);
        await replaceOwnerAttachmentRefs(
          "conversation",
          2,
          [blob.contentHash],
          { inTransaction: true },
        );
      });
      resume.open();
      await Promise.all([collecting, adopting]);
      assert.deepEqual(files.get(storedPath), bytes);
      assert.exists(
        db
          .prepare(
            `SELECT 1 FROM ${blobs} JOIN ${refs} ON hash = blob_hash WHERE path = ?`,
          )
          .get(storedPath),
      );
    } finally {
      resume.open();
      await collecting;
    }
  });

  it("does not unlink on a failed claim commit and releases the hash for a retry", async function () {
    const { storedPath } = await expiredBlob();
    failCommit = true;
    let failure: unknown;
    try {
      await gc(grace);
    } catch (error) {
      failure = error;
    }
    assert.match(String(failure), /commit failed/);
    assert.deepEqual(files.get(storedPath), bytes);
    failCommit = false;
    await gc(grace);
    assert.isFalse(files.has(storedPath));
    assert.isUndefined(db.prepare(`SELECT 1 FROM ${blobs}`).get());
  });
});
