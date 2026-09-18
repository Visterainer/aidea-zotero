import {
  createGlobalConversation,
  createPaperConversation,
} from "../src/utils/chatStore";
import { documentFingerprint } from "../src/utils/documentFingerprint";
import { collectAndDeleteUnreferencedBlobs } from "../src/utils/attachmentRefStore";
import { assert } from "chai";
import { getAttachmentSourceRevision } from "../src/modules/contextPanel/document/adapters/shared";
import {
  navigateCitation,
  citationSourceUrl,
  evidenceForExport,
} from "../src/modules/contextPanel/citations";
import { DatabaseSync } from "node:sqlite";
import {
  ensureChatTransferSchema,
  reconcileTransferredConversations,
  isGlobalChatKey,
  exportChatArchive,
  importChatArchive,
} from "../src/utils/chatTransfer";
import { parseChatArchive } from "../src/utils/chatTransferFormat";
import {
  packChatBundle,
  readChatBundle,
  resourceHash,
} from "../src/utils/chatTransferAssets";
import { zipSync, unzipSync } from "fflate";

const M = "zotero_ai_chat_messages";
const G = "zotero_ai_global_conversations";
const P = "zotero_ai_paper_conversations";
const T = "zotero_ai_chat_tree_state";
const globals = globalThis as any;
function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE ${M} (
    id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_key INTEGER, parent_id INTEGER,
    active_child_id INTEGER, branch_index INTEGER DEFAULT 0, role TEXT, text TEXT, timestamp INTEGER,
    selected_text TEXT, selected_texts_json TEXT, context_refs_json TEXT, screenshot_images TEXT,
    attachments_json TEXT, model_name TEXT);
    CREATE TABLE ${G} (conversation_key INTEGER PRIMARY KEY,library_id INTEGER,created_at INTEGER,title TEXT);
    CREATE TABLE ${P} (conversation_key INTEGER PRIMARY KEY,parent_item_id INTEGER,created_at INTEGER,title TEXT);
    CREATE TABLE ${T} (conversation_key INTEGER PRIMARY KEY,active_root_id INTEGER,active_leaf_id INTEGER);`);
  db.exec(
    "CREATE TABLE zotero_ai_attachment_blobs (hash TEXT PRIMARY KEY,path TEXT UNIQUE,size_bytes INTEGER,created_at INTEGER)",
  );
  db.exec(
    "CREATE TABLE zotero_ai_attachment_refs (owner_type TEXT,owner_id INTEGER,blob_hash TEXT,updated_at INTEGER,PRIMARY KEY(owner_type,owner_id,blob_hash))",
  );
  let depth = 0;
  const api = {
    async queryAsync(sql: string, args: any[] = []) {
      const stmt = db.prepare(sql);
      return stmt.columns().length
        ? stmt.all(...args)
        : (stmt.run(...args), []);
    },
    async valueQueryAsync(sql: string, args: any[] = []) {
      const row = db.prepare(sql).get(...args);
      return row ? Object.values(row)[0] : false;
    },
    async executeTransaction<T>(fn: () => Promise<T>): Promise<T> {
      if (depth++) {
        try {
          return await fn();
        } finally {
          depth--;
        }
      }
      db.exec("BEGIN");
      try {
        const result = await fn();
        db.exec("COMMIT");
        return result;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },
  };
  return { db, api };
}
const item = {
  id: 7,
  key: "ABCDEFGH",
  parentID: 5,
  parentKey: "PARENT12",
  libraryID: 1,
  attachmentContentType: "application/pdf",
  isAttachment: () => true,
  getField: () => "Test paper",
};
function use(f: ReturnType<typeof fixture>, user = 123) {
  globals.Zotero = {
    DB: f.api,
    Users: { getCurrentUserID: () => user },
    Libraries: { userLibraryID: 1, get: () => ({ libraryType: "user" }) },
    Items: {
      get: (id: number) => (id === 7 ? item : false),
      getByLibraryAndKeyAsync: async (_: number, key: string) =>
        key === item.key ? item : false,
    },
  };
}
function seed(f: ReturnType<typeof fixture>) {
  f.db.exec(`INSERT INTO ${G} VALUES (2000000001,1,100,'Test');
    INSERT INTO ${M} (id,conversation_key,parent_id,active_child_id,role,text,timestamp) VALUES
    (1,2000000001,NULL,2,'user','Question',100), (2,2000000001,1,NULL,'assistant','Answer',101);
    INSERT INTO ${T} VALUES (2000000001,1,2);`);
}
function addBranch(f: ReturnType<typeof fixture>, text: string) {
  f.db
    .prepare(
      `INSERT INTO ${M} (conversation_key,parent_id,role,text,timestamp) VALUES (2000000001,2,'user',?,200)`,
    )
    .run(text);
  const id = Number(f.db.prepare("SELECT last_insert_rowid() AS id").get()!.id);
  f.db.prepare(`UPDATE ${M} SET active_child_id=? WHERE id=2`).run(id);
  f.db.prepare(`UPDATE ${T} SET active_leaf_id=?`).run(id);
}

describe("chat archive migration and merging (real SQLite)", function () {
  const opened: ReturnType<typeof fixture>[] = [];
  let prior: any;
  let priorIO: any;
  const files = new Map<string, Uint8Array>();
  const make = () => {
    const f = fixture();
    opened.push(f);
    return f;
  };

  beforeEach(function () {
    prior = globals.Zotero;
    priorIO = globals.IOUtils;
    files.clear();
    globals.IOUtils = {
      exists: async (path: string) => files.has(path),
      remove: async (path: string) => {
        files.delete(path);
      },
      stat: async (path: string) => ({ size: files.get(path)?.length }),
      read: async (path: string) => {
        if (!files.has(path)) throw new Error("missing");
        return files.get(path)!;
      },
      makeDirectory: async () => {},
      write: async (path: string, data: Uint8Array) => {
        files.set(path, new Uint8Array(data));
      },
    };
  });

  afterEach(function () {
    globals.Zotero = prior;
    globals.IOUtils = priorIO;
    for (const f of opened.splice(0)) f.db.close();
  });

  it("associates delayed papers without changing message IDs, branches or UUIDs", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    archive.conversations[0].source = {
      library: "user:123",
      key: item.key,
      title: "Paper",
      kind: "pdf",
    };
    const b = make();
    use(b);
    globals.Zotero.Items.getByLibraryAndKeyAsync = async () => false;
    await ensureChatTransferSchema(async () => {});
    const imported = await importChatArchive(JSON.stringify(archive), 1, false);
    const key = imported.conversationKeys[0];
    const before = b.db.prepare(`SELECT * FROM ${M} ORDER BY id`).all();
    const tree = b.db.prepare(`SELECT * FROM ${T}`).all();
    await reconcileTransferredConversations();
    assert.isTrue(isGlobalChatKey(key));
    globals.Zotero.Items.getByLibraryAndKeyAsync = async () => item;
    globals.Zotero.Users.getCurrentUserID = () => 999;
    await reconcileTransferredConversations();
    assert.equal(b.db.prepare(`SELECT count(*) AS n FROM ${P}`).get()!.n, 0);
    globals.Zotero.Users.getCurrentUserID = () => 123;
    await reconcileTransferredConversations();
    await reconcileTransferredConversations();
    assert.isFalse(isGlobalChatKey(key));
    assert.equal(b.db.prepare(`SELECT count(*) AS n FROM ${G}`).get()!.n, 0);
    const bound = b.db.prepare(`SELECT * FROM ${P}`).get()!;
    assert.equal(bound.conversation_key, key);
    assert.equal(bound.uuid, archive.conversations[0].uuid);
    assert.equal(bound.title, "Test");
    assert.deepEqual(
      b.db.prepare(`SELECT * FROM ${M} ORDER BY id`).all(),
      before,
    );
    assert.deepEqual(b.db.prepare(`SELECT * FROM ${T}`).all(), tree);
    const repeated = await importChatArchive(JSON.stringify(archive), 1, false);
    assert.equal(repeated.messages, 0);
    assert.equal(repeated.conversations, 0);
    const globalKey = await createGlobalConversation(1);
    assert.isAbove(globalKey, key);
    const paperKey = await createPaperConversation(7);
    assert.isBelow(paperKey, 2_000_000_000);
    assert.isFalse(isGlobalChatKey(paperKey));
  });

  it("hashes a shared citation document once per export and rechecks the next export", async function () {
    const f = make();
    use(f);
    const path = "C:/paper.pdf";
    const bytes = new TextEncoder().encode("paper");
    files.set(path, bytes);
    const source = { ...item, getFilePathAsync: async () => path };
    globals.Zotero.Items.get = () => source;
    let reads = 0;
    const read = globals.IOUtils.read;
    globals.IOUtils.read = async (p: string) => {
      reads++;
      return read(p);
    };
    const ref: any = {
      id: "e1",
      itemId: 7,
      title: "Paper",
      text: "quote",
      kind: "pdf",
      documentHash: await resourceHash(bytes),
      locator: { kind: "pdf-page", pageIndex: 1 },
    };
    const result = await evidenceForExport([ref, { ...ref, id: "e2" }]);
    assert.equal(reads, 1);
    assert.exists(result[1].locator);
    files.set(path, new TextEncoder().encode("changed"));
    const changed = await evidenceForExport([ref]);
    assert.equal(reads, 2);
    assert.isUndefined(changed[0].locator);
    await Promise.all([
      documentFingerprint(source as any),
      documentFingerprint(source as any),
    ]);
    assert.equal(reads, 3);
  });

  it("bundles screenshots, uploads and inline images once and restores them on another device", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    const screenshot = "data:image/png;base64,iVBORw0KGgo=";
    const file = new TextEncoder().encode("附件内容 / uploaded text");
    files.set("C:/source/report.txt", file);
    a.db
      .prepare(
        `UPDATE ${M} SET screenshot_images=?,attachments_json=? WHERE id=1`,
      )
      .run(
        JSON.stringify([screenshot, screenshot]),
        JSON.stringify([
          {
            id: "upload1",
            name: "report.txt",
            mimeType: "text/plain",
            category: "text",
            storedPath: "C:/source/report.txt",
            textContent: "附件内容 / uploaded text",
          },
        ]),
      );
    a.db
      .prepare(`UPDATE ${M} SET text=? WHERE id=2`)
      .run(`Answer ![figure](${screenshot})`);
    const blobs = new Map<string, Uint8Array>();
    const archive = await exportChatArchive({ libraryID: 1 }, blobs);
    assert.equal(blobs.size, 2);
    const bytes = await packChatBundle({ archive, blobs });
    const bundle = await readChatBundle(bytes);
    assert.equal(Object.keys(unzipSync(bytes)).length, 3);
    assert.notInclude(
      new TextDecoder().decode(unzipSync(bytes)["chat.json"]),
      "C:/source",
    );
    assert.equal(
      (await importChatArchive(JSON.stringify(archive), 1, true, blobs))
        .conflicts,
      0,
    );
    const b = make();
    use(b);
    globals.Zotero.DataDirectory = { dir: "C:/target-device" };
    await ensureChatTransferSchema(async () => {});
    const textOnly = JSON.stringify({ ...archive, version: 1 });
    await importChatArchive(textOnly, 1, false);
    const merged = await importChatArchive(
      JSON.stringify(bundle.archive),
      1,
      false,
      bundle.blobs,
    );
    assert.equal(merged.messages, 0);
    const rows = b.db.prepare(`SELECT * FROM ${M} ORDER BY id`).all();
    assert.deepEqual(JSON.parse(String(rows[0].screenshot_images)), [
      screenshot,
      screenshot,
    ]);
    const restored = JSON.parse(String(rows[0].attachments_json))[0];
    assert.include(restored.storedPath, "target-device");
    assert.deepEqual(files.get(restored.storedPath), file);
    b.db.exec("UPDATE zotero_ai_attachment_blobs SET created_at=0");
    assert.equal(
      b.db.prepare("SELECT count(*) AS n FROM zotero_ai_attachment_refs").get()!
        .n,
      1,
    );
    await collectAndDeleteUnreferencedBlobs(0);
    assert.deepEqual(files.get(restored.storedPath), file);
    b.db.exec("DELETE FROM zotero_ai_attachment_refs");
    await collectAndDeleteUnreferencedBlobs(0);
    assert.deepEqual(files.get(restored.storedPath), file);

    assert.include(String(rows[1].text), screenshot);
    assert.deepEqual(
      JSON.parse(String(rows[0].context_refs_json)).unavailableAttachments,
      [],
    );
    files.set(restored.storedPath, new Uint8Array([0]));
    const again = await importChatArchive(
      JSON.stringify(bundle.archive),
      1,
      false,
      bundle.blobs,
    );
    assert.equal(again.messages, 0);
    assert.equal(again.conflicts, 0);
    assert.deepEqual(files.get(restored.storedPath), file);
    const reBlobs = new Map<string, Uint8Array>();
    const reExport = await exportChatArchive({ libraryID: 1 }, reBlobs);
    assert.equal(reBlobs.size, 2);
    use(a);
    assert.equal(
      (await importChatArchive(JSON.stringify(reExport), 1, true, reBlobs))
        .messages,
      0,
    );
  });

  it("preserves an image conflict as a branch instead of replacing existing media", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    f.db
      .prepare(`UPDATE ${M} SET screenshot_images=? WHERE id=1`)
      .run(JSON.stringify(["data:image/png;base64,AQID"]));
    const blobs = new Map<string, Uint8Array>();
    const archive = await exportChatArchive({ libraryID: 1 }, blobs);
    const image = new Uint8Array([4, 5, 6]);
    const hash = await resourceHash(image);
    const ref = archive.conversations[0].messages[0].resources![0];
    ref.hash = hash;
    blobs.clear();
    blobs.set(hash, image);
    const result = await importChatArchive(
      JSON.stringify(archive),
      1,
      false,
      blobs,
    );
    assert.equal(result.messages, 2);
    assert.equal(
      f.db.prepare(`SELECT screenshot_images FROM ${M} WHERE id=1`).get()!
        .screenshot_images,
      JSON.stringify(["data:image/png;base64,AQID"]),
    );
    assert.equal(
      (await importChatArchive(JSON.stringify(archive), 1, false, blobs))
        .messages,
      0,
    );
  });

  it("rejects corrupted resources, ZIP traversal, duplicate names and missing blobs before import", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    f.db
      .prepare(`UPDATE ${M} SET screenshot_images=? WHERE id=1`)
      .run(JSON.stringify(["data:image/png;base64,AQID"]));
    const blobs = new Map<string, Uint8Array>();
    const archive = await exportChatArchive({ libraryID: 1 }, blobs);
    const bundle = await packChatBundle({ archive, blobs });
    const entries = unzipSync(bundle);
    const resource = Object.keys(entries).find((n) =>
      n.startsWith("resources/"),
    )!;
    entries[resource] = new Uint8Array([9, 9, 9]);
    const fails = async (task: Promise<unknown>, match: RegExp) => {
      try {
        await task;
        assert.fail("accepted invalid archive");
      } catch (e) {
        assert.match(String(e), match);
      }
    };
    await fails(readChatBundle(zipSync(entries)), /SHA-256/);
    await fails(
      readChatBundle(zipSync({ "../escape": new Uint8Array() })),
      /path|路径/,
    );
    delete entries[resource];
    await fails(readChatBundle(zipSync(entries)), /Missing/);
    await fails(
      importChatArchive(JSON.stringify(archive), 1, false),
      /Missing/,
    );
    assert.equal(f.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n, 2);
  });

  it("rejects duplicate ZIP filenames and oversized expansion before extraction", async function () {
    const duplicate = zipSync({
      "chat.json": new Uint8Array(),
      "copy.json": new Uint8Array(),
    });
    const original = new TextEncoder().encode("copy.json"),
      replacement = new TextEncoder().encode("chat.json");
    for (let i = 0; i <= duplicate.length - original.length; i++)
      if (original.every((b, j) => duplicate[i + j] === b))
        duplicate.set(replacement, i);
    let error = "";
    try {
      await readChatBundle(duplicate);
    } catch (e) {
      error = String(e);
    }
    assert.include(error, "Duplicate ZIP");
    const oversized = zipSync({
      ["resources/" + "a".repeat(64)]: new Uint8Array(),
    });
    for (let i = 0; i < oversized.length - 28; i++)
      if (
        oversized[i] === 0x50 &&
        oversized[i + 1] === 0x4b &&
        oversized[i + 2] === 1 &&
        oversized[i + 3] === 2
      )
        new DataView(oversized.buffer).setUint32(
          i + 24,
          33 * 1024 * 1024,
          true,
        );
    error = "";
    try {
      await readChatBundle(oversized);
    } catch (e) {
      error = String(e);
    }
    assert.include(error, "expansion limit");
  });

  it("rolls back imported messages when writing an attachment fails", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    files.set("C:/upload.txt", new TextEncoder().encode("test"));
    a.db.prepare(`UPDATE ${M} SET attachments_json=? WHERE id=1`).run(
      JSON.stringify([
        {
          id: "x",
          name: "upload.txt",
          category: "text",
          mimeType: "text/plain",
          storedPath: "C:/upload.txt",
        },
      ]),
    );
    const blobs = new Map<string, Uint8Array>();
    const archive = await exportChatArchive({ libraryID: 1 }, blobs);
    const b = make();
    use(b);
    globals.Zotero.DataDirectory = { dir: "C:/failing-target" };
    await ensureChatTransferSchema(async () => {});
    globals.IOUtils.write = async () => {
      throw new Error("Disk full");
    };
    let error = "";
    try {
      await importChatArchive(JSON.stringify(archive), 1, false, blobs);
    } catch (e) {
      error = String(e);
    }
    assert.include(error, "Disk full");
    assert.equal(b.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n, 0);
    assert.equal(b.db.prepare(`SELECT count(*) AS n FROM ${G}`).get()!.n, 0);
  });

  it("backs up mozStorage proxy rows without probing nonexistent columns", async function () {
    const f = make();
    seed(f);
    use(f);
    const query = f.api.queryAsync.bind(f.api);
    f.api.queryAsync = async (sql, args) =>
      (await query(sql, args)).map(
        (row) =>
          new Proxy(row, {
            get(target, property) {
              if (typeof property === "string" && !(property in target))
                throw new Error(`Unknown column: ${property}`);
              return Reflect.get(target, property);
            },
          }),
      );
    let snapshotText = "";
    await ensureChatTransferSchema(async (snapshot) => {
      snapshotText = JSON.stringify(snapshot);
    });
    assert.equal(JSON.parse(snapshotText)[M][1].text, "Answer");
    assert.equal(
      f.db
        .prepare(`SELECT COUNT(*) AS n FROM ${M} WHERE uuid IS NOT NULL`)
        .get()!.n,
      2,
    );
  });

  it("keeps chats whose paper was permanently deleted in the backup", async function () {
    const f = make();
    seed(f);
    f.db.exec(
      `DELETE FROM ${G}; INSERT INTO ${P} VALUES (2000000001,999,100,'Deleted paper');`,
    );
    use(f);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    assert.lengthOf(archive.conversations, 1);
    assert.lengthOf(archive.conversations[0].messages, 2);
    assert.equal(archive.conversations[0].source!.key, "");
    const repeat = await importChatArchive(JSON.stringify(archive), 1, false);
    assert.equal(repeat.messages, 0);
    assert.equal(repeat.duplicates, 2);
  });

  it("backs up old rows, preserves IDs and branches, assigns stable IDs including future inserts", async function () {
    const f = make();
    seed(f);
    use(f);
    let backups = 0;
    await ensureChatTransferSchema(async (snapshot) => {
      backups++;
      assert.equal(snapshot[M].length, 2);
      assert.equal(snapshot[M][1].parent_id, 1);
    });
    const first = f.db.prepare(`SELECT id,uuid,parent_id,text FROM ${M}`).all();
    await ensureChatTransferSchema(async () => {
      backups++;
    });
    assert.deepEqual(
      f.db.prepare(`SELECT id,uuid,parent_id,text FROM ${M}`).all(),
      first,
    );
    assert.equal(backups, 1);
    addBranch(f, "New");
    assert.match(
      String(
        f.db.prepare(`SELECT uuid FROM ${M} WHERE text='New'`).get()!.uuid,
      ),
      /^[a-f0-9-]{36}$/,
    );
  });

  it("recovers legacy item-key conversations without renumbering their messages", async function () {
    const f = make();
    seed(f);
    use(f);
    f.db.exec(
      `DELETE FROM ${G}; UPDATE ${M} SET conversation_key=7; UPDATE ${T} SET conversation_key=7;`,
    );
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    assert.equal(archive.conversations.length, 1);
    assert.equal(archive.conversations[0].source!.key, item.key);
    assert.equal(
      f.db.prepare(`SELECT id FROM ${M} WHERE text='Question'`).get()!.id,
      1,
    );
    assert.equal(
      f.db.prepare(`SELECT conversation_key FROM ${P}`).get()!.conversation_key,
      7,
    );
  });

  it("does not alter legacy schema or data when backup fails", async function () {
    const f = make();
    seed(f);
    use(f);
    let failed = false;
    try {
      await ensureChatTransferSchema(async () => {
        throw new Error("Disk full");
      });
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
    assert.isFalse(
      f.db
        .prepare(`PRAGMA table_info(${M})`)
        .all()
        .some((r) => r.name === "uuid"),
    );
    assert.equal(f.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n, 2);
  });

  it("round-trips independent additions as branches without replacing the local active path", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    const archive = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    const b = make();
    use(b);
    await ensureChatTransferSchema(async () => {});
    const preview = await importChatArchive(archive, 1);
    assert.equal(preview.messages, 2);
    assert.equal(b.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n, 0);
    await importChatArchive(archive, 1, false);
    // Imported local conversation ID is independent from the original numeric ID.
    const bKey = Number(
      b.db.prepare(`SELECT conversation_key FROM ${G}`).get()!.conversation_key,
    );
    b.db.prepare(`UPDATE ${G} SET conversation_key=2000000001`).run();
    b.db.prepare(`UPDATE ${M} SET conversation_key=2000000001`).run();
    b.db
      .prepare(
        `UPDATE ${T} SET conversation_key=2000000001 WHERE conversation_key=?`,
      )
      .run(bKey);
    addBranch(b, "B follow-up");
    const fromB = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    use(a);
    addBranch(a, "A follow-up");
    const activeBefore = a.db.prepare(`SELECT active_leaf_id FROM ${T}`).get()!
      .active_leaf_id;
    const merged = await importChatArchive(fromB, 1, false);
    assert.equal(merged.messages, 1);
    assert.equal(merged.duplicates, 2);
    assert.equal(
      a.db.prepare(`SELECT count(*) AS n FROM ${M} WHERE parent_id=2`).get()!.n,
      2,
    );
    assert.equal(
      a.db.prepare(`SELECT active_leaf_id FROM ${T}`).get()!.active_leaf_id,
      activeBefore,
    );
    assert.equal((await importChatArchive(fromB, 1, false)).messages, 0);
    const roundTrip = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    use(b);
    assert.equal((await importChatArchive(roundTrip, 1, false)).messages, 1);
    assert.equal((await importChatArchive(roundTrip, 1, false)).messages, 0);
  });

  it("converges three replicas after interleaved additions and repeated round trips", async function () {
    const replicas = [make(), make(), make()];
    seed(replicas[0]);
    use(replicas[0]);
    await ensureChatTransferSchema(async () => {});
    const initial = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    for (const replica of replicas.slice(1)) {
      use(replica);
      await ensureChatTransferSchema(async () => {});
      await importChatArchive(initial, 1, false);
    }
    for (let round = 0; round < 10; round++) {
      for (const [index, replica] of replicas.entries()) {
        use(replica);
        const state = replica.db.prepare(`SELECT * FROM ${T}`).get()!;
        replica.db
          .prepare(
            `INSERT INTO ${M}
          (conversation_key,parent_id,role,text,timestamp)
          VALUES (?,?,?,?,?)`,
          )
          .run(
            state.conversation_key,
            state.active_leaf_id,
            "user",
            `Replica ${index} round ${round}`,
            200 + round,
          );
        const id = replica.db.prepare("SELECT last_insert_rowid() AS id").get()!
          .id;
        replica.db
          .prepare(`UPDATE ${M} SET active_child_id=? WHERE id=?`)
          .run(id, state.active_leaf_id);
        replica.db.prepare(`UPDATE ${T} SET active_leaf_id=?`).run(id);
      }
      const archives: string[] = [];
      for (const replica of replicas) {
        use(replica);
        archives.push(
          JSON.stringify(await exportChatArchive({ libraryID: 1 })),
        );
      }
      for (const [index, replica] of replicas.entries()) {
        use(replica);
        const leaf = replica.db
          .prepare(`SELECT active_leaf_id FROM ${T}`)
          .get()!.active_leaf_id;
        for (const input of [
          ...archives.slice(index),
          ...archives.slice(0, index),
        ]) {
          await importChatArchive(input, 1, false);
          assert.equal((await importChatArchive(input, 1, false)).messages, 0);
        }
        assert.equal(
          replica.db.prepare(`SELECT active_leaf_id FROM ${T}`).get()!
            .active_leaf_id,
          leaf,
        );
        assert.equal(
          replica.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n,
          2 + 3 * (round + 1),
        );
        assert.equal(
          replica.db.prepare(`SELECT count(*) AS n FROM ${G}`).get()!.n,
          1,
        );
      }
    }
    const normalized = [];
    for (const replica of replicas) {
      use(replica);
      const archive = await exportChatArchive({ libraryID: 1 });
      normalized.push(
        archive.conversations[0].messages
          .map(({ uuid, parent, text, timestamp }) => ({
            uuid,
            parent,
            text,
            timestamp,
          }))
          .sort((a, b) => a.uuid.localeCompare(b.uuid)),
      );
    }
    assert.deepEqual(normalized[0], normalized[1]);
    assert.deepEqual(normalized[1], normalized[2]);
  });

  it("preserves every message and parent in a 2000-message archive", async function () {
    this.timeout(30000);
    const source = make();
    seed(source);
    const insert = source.db.prepare(`INSERT INTO ${M}
      (id,conversation_key,parent_id,active_child_id,role,text,timestamp)
      VALUES (?,2000000001,?,?,?,?,?)`);
    source.db.exec("BEGIN");
    for (let id = 3; id <= 2000; id++) {
      insert.run(
        id,
        id - 1,
        id === 2000 ? null : id + 1,
        id % 2 ? "user" : "assistant",
        `消息 ${id} — bilingual evidence`,
        100 + id,
      );
    }
    source.db.exec(`UPDATE ${M} SET active_child_id=3 WHERE id=2;
      UPDATE ${T} SET active_leaf_id=2000; COMMIT;`);
    use(source);
    await ensureChatTransferSchema(async () => {});
    const original = await exportChatArchive({ libraryID: 1 });
    const target = make();
    use(target);
    await ensureChatTransferSchema(async () => {});
    const input = JSON.stringify(original);
    assert.equal((await importChatArchive(input, 1, false)).messages, 2000);
    assert.equal((await importChatArchive(input, 1, false)).messages, 0);
    const restored = await exportChatArchive({ libraryID: 1 });
    assert.deepEqual(restored.conversations, original.conversations);
  });

  it("retains conflicting content and its descendants exactly once", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    archive.conversations[0].messages[0].text = "Different question";
    const input = JSON.stringify(archive);
    const result = await importChatArchive(input, 1, false);
    assert.equal(result.conflicts, 2);
    assert.equal(result.messages, 2);
    assert.equal((await importChatArchive(input, 1, false)).messages, 0);
    assert.equal(
      f.db.prepare(`SELECT text FROM ${M} WHERE id=1`).get()!.text,
      "Question",
    );
    assert.equal(f.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n, 4);
  });

  it("merges independently upgraded legacy copies without leaving duplicate conversations", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    const input = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    const b = make();
    seed(b);
    addBranch(b, "B legacy follow-up");
    use(b);
    await ensureChatTransferSchema(async () => {});
    const result = await importChatArchive(input, 1, false);
    assert.equal(result.conversations, 0);
    assert.equal(result.messages, 0);
    assert.equal(result.duplicates, 2);
    const fromB = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    use(a);
    addBranch(a, "A new follow-up");
    assert.equal((await importChatArchive(fromB, 1, false)).messages, 1);
    assert.equal((await importChatArchive(fromB, 1, false)).messages, 0);
    assert.equal(a.db.prepare(`SELECT COUNT(*) AS n FROM ${G}`).get()!.n, 1);
    assert.equal(a.db.prepare(`SELECT COUNT(*) AS n FROM ${M}`).get()!.n, 4);
    const merged = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    use(b);
    assert.equal((await importChatArchive(merged, 1, false)).messages, 1);
    assert.equal((await importChatArchive(merged, 1, false)).messages, 0);
    assert.equal(b.db.prepare(`SELECT COUNT(*) AS n FROM ${G}`).get()!.n, 1);
  });

  it("keeps independently created sessions separate and preserves conflicting legacy edits once", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    const exported = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    const independent = make();
    seed(independent);
    independent.db.exec(
      `UPDATE ${G} SET created_at=500; UPDATE ${M} SET timestamp=timestamp+400`,
    );
    use(independent);
    await ensureChatTransferSchema(async () => {});
    assert.equal(
      (await importChatArchive(exported, 1, false)).conversations,
      1,
    );
    const copy = make();
    seed(copy);
    copy.db.exec(`UPDATE ${M} SET text='Edited legacy question' WHERE id=1`);
    use(copy);
    await ensureChatTransferSchema(async () => {});
    assert.equal((await importChatArchive(exported, 1, false)).messages, 2);
    assert.equal((await importChatArchive(exported, 1, false)).messages, 0);
    assert.equal(copy.db.prepare(`SELECT COUNT(*) AS n FROM ${G}`).get()!.n, 1);
    assert.equal(copy.db.prepare(`SELECT COUNT(*) AS n FROM ${M}`).get()!.n, 4);
  });

  it("does not bind nullable legacy predicates for new UUID-only conversations in Zotero", async function () {
    const f = make();
    use(f);
    await ensureChatTransferSchema(async () => {});
    f.db.exec(
      `INSERT INTO ${G} (conversation_key,library_id,created_at,title) VALUES (2000000001,1,100,'New one'),(2000000002,1,200,'New two')`,
    );
    const archive = await exportChatArchive({ libraryID: 1 });
    const query = f.api.queryAsync;
    f.api.queryAsync = async (sql, args = []) => {
      if (/SELECT.*legacy_key = \?/.test(sql))
        assert.notInclude(args, null, "Zotero rewrites null comparisons");
      return query(sql, args);
    };
    assert.equal(
      (await importChatArchive(JSON.stringify(archive), 1, false))
        .conversations,
      0,
    );
  });

  it("retains both legacy continuations even when their local IDs and timestamps collide", async function () {
    const a = make();
    seed(a);
    addBranch(a, "A branch before upgrade");
    use(a);
    await ensureChatTransferSchema(async () => {});
    const b = make();
    seed(b);
    addBranch(b, "B branch before upgrade");
    use(b);
    await ensureChatTransferSchema(async () => {});
    const input = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    use(a);
    assert.equal((await importChatArchive(input, 1, false)).messages, 1);
    assert.equal((await importChatArchive(input, 1, false)).messages, 0);
    assert.equal(a.db.prepare(`SELECT COUNT(*) AS n FROM ${G}`).get()!.n, 1);
    assert.equal(
      a.db.prepare(`SELECT COUNT(*) AS n FROM ${M} WHERE parent_id=2`).get()!.n,
      2,
    );
  });

  it("migrates verified PDF positions, enriches older imports and rechecks file identity on click", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    let path = "C:/original/paper.pdf";
    const source = {
      ...item,
      version: 1,
      attachmentModificationTime: Promise.resolve(100),
      getFilePathAsync: async () => path,
    };
    globals.Zotero.Items.get = () => source;
    globals.Zotero.Items.getByLibraryAndKeyAsync = async () => source;
    const bytes = new TextEncoder().encode("synthetic PDF document bytes");
    files.set(path, bytes);
    f.db.prepare(`UPDATE ${M} SET context_refs_json=? WHERE id=2`).run(
      JSON.stringify({
        citations: [
          {
            id: "e1",
            itemId: 7,
            text: "evidence",
            title: "Test paper",
            kind: "pdf",
            sourceRevision: await getAttachmentSourceRevision(source as any),
            locator: { kind: "pdf-page", pageIndex: 4, pageLabel: "5" },
          },
        ],
      }),
    );
    const archive = await exportChatArchive({ libraryID: 1 });
    const portable = archive.conversations[0].messages[1].citations[0];
    assert.equal(portable.documentHash, await resourceHash(bytes));
    assert.equal((portable.locator as any).pageIndex, 4);
    const old = structuredClone(archive);
    delete old.conversations[0].messages[1].citations[0].locator;
    delete old.conversations[0].messages[1].citations[0].documentHash;
    const target = make();
    use(target);
    await ensureChatTransferSchema(async () => {});
    globals.Zotero.Items.get = () => source;
    globals.Zotero.Items.getByLibraryAndKeyAsync = async () => source;
    await importChatArchive(JSON.stringify(old), 1, false);
    path = "D:/other-device/paper.pdf";
    files.set(path, bytes);
    const merged = await importChatArchive(JSON.stringify(archive), 1, false);
    assert.equal(merged.messages, 0);
    const ref = JSON.parse(
      String(
        target.db
          .prepare(`SELECT context_refs_json FROM ${M} WHERE role='assistant'`)
          .get()!.context_refs_json,
      ),
    ).citations[0];
    const opens: any[] = [];
    globals.Zotero.Reader = {
      open: async (...args: any[]) => {
        opens.push(args);
      },
    };
    await navigateCitation(ref);
    assert.deepEqual(opens.pop()[1], { pageIndex: 4 });
    files.delete(path);
    let error = "";
    try {
      await navigateCitation(ref);
    } catch (e) {
      error = String(e);
    }
    assert.include(error, "without jumping");
    assert.isUndefined(opens.pop()[1]);
    files.set(path, new TextEncoder().encode("replaced file"));
    try {
      await navigateCitation(ref);
    } catch {
      /* Expected refusal to use a position from a different file. */
    }
    assert.isUndefined(opens.pop()[1]);
    files.set(path, bytes);
    await navigateCitation(ref);
    assert.deepEqual(opens.pop()[1], { pageIndex: 4 });
    const reexport = await exportChatArchive({ libraryID: 1 });
    assert.equal(
      reexport.conversations[0].messages[1].citations[0].documentHash,
      portable.documentHash,
    );
    const olderMedia: any = structuredClone(old);
    olderMedia.version = 2;
    for (const m of olderMedia.conversations[0].messages) m.resources = [];
    const image = new Uint8Array([1, 2, 3]);
    const imageHash = await resourceHash(image);
    olderMedia.conversations[0].messages[1].resources = [
      {
        kind: "screenshot",
        index: 0,
        hash: imageHash,
        size: 3,
        name: "image.png",
        mimeType: "image/png",
        category: "image",
      },
    ];
    await importChatArchive(
      JSON.stringify(olderMedia),
      1,
      false,
      new Map([[imageHash, image]]),
    );
    const preserved = await exportChatArchive({ libraryID: 1 });
    assert.equal(
      preserved.conversations[0].messages[1].citations[0].documentHash,
      portable.documentHash,
      "older media archives must not erase newer citation positions",
    );
  });

  it("keeps unresolved same-library citation keys so a later sync can restore navigation", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    archive.conversations[0].messages[1].citations = [
      {
        id: "p",
        text: "later source",
        source: {
          library: "user:123",
          key: "LATERPDF",
          title: "Later paper",
          kind: "pdf",
        },
        documentHash: "b".repeat(64),
        locator: { kind: "pdf-page", pageIndex: 2 },
      },
    ];
    const target = make();
    use(target);
    await ensureChatTransferSchema(async () => {});
    await importChatArchive(JSON.stringify(archive), 1, false);
    const refs = JSON.parse(
      String(
        target.db
          .prepare(`SELECT context_refs_json FROM ${M} WHERE role='assistant'`)
          .get()!.context_refs_json,
      ),
    );
    assert.equal(refs.citations[0].itemId, 0);
    assert.equal(refs.citations[0].itemKey, "LATERPDF");
    assert.equal(refs.citations[0].libraryId, 1);
  });

  it("rebinds source-only citations after delayed sync without duplicating messages", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    archive.conversations[0].messages[1].citations = [
      {
        id: "source",
        text: "excerpt",
        source: {
          library: "user:123",
          key: "LATERPDF",
          title: "Later paper",
          kind: "pdf",
        },
      },
    ];
    const target = make();
    use(target);
    await ensureChatTransferSchema(async () => {});
    const readRef = () =>
      JSON.parse(
        String(
          target.db
            .prepare(
              `SELECT context_refs_json FROM ${M} WHERE role='assistant'`,
            )
            .get()!.context_refs_json,
        ),
      ).citations[0];
    const input = JSON.stringify(archive);
    await importChatArchive(input, 1, false);
    assert.equal(readRef().itemId, 0);
    assert.equal(readRef().itemKey, "LATERPDF");
    assert.equal(readRef().libraryId, 1);
    globals.Zotero.Items.getByLibraryAndKeyAsync = async () => ({
      ...item,
      key: "LATERPDF",
    });
    await importChatArchive(input, 1, true);
    assert.equal(
      readRef().itemId,
      0,
      "preview must not change saved references",
    );
    const merged = await importChatArchive(input, 1, false);
    assert.equal(merged.messages, 0);
    assert.equal(merged.duplicates, 2);
    assert.equal(readRef().itemId, 7);
    assert.equal(
      citationSourceUrl(readRef()),
      "zotero://select/library/items/LATERPDF",
    );
  });

  it("restores group identity on source-only citations and exported links", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    archive.conversations[0].messages[1].citations = [
      {
        id: "group",
        text: "excerpt",
        source: {
          library: "group:55",
          key: "GROUPPDF",
          title: "Group paper",
          kind: "pdf",
        },
      },
    ];
    const target = make();
    use(target);
    globals.Zotero.Libraries.get = (id: number) => ({
      libraryType: id === 2 ? "group" : "user",
    });
    globals.Zotero.Groups = { getByLibraryID: () => ({ id: 55 }) };
    globals.Zotero.Items.getByLibraryAndKeyAsync = async () => ({
      ...item,
      libraryID: 2,
      key: "GROUPPDF",
    });
    await ensureChatTransferSchema(async () => {});
    const input = JSON.stringify(archive);
    await importChatArchive(input, 2, false);
    const readRef = () =>
      JSON.parse(
        String(
          target.db
            .prepare(
              `SELECT context_refs_json FROM ${M} WHERE role='assistant'`,
            )
            .get()!.context_refs_json,
        ),
      ).citations[0];
    assert.equal(readRef().libraryType, "group");
    assert.equal(readRef().groupId, 55);
    assert.equal(
      citationSourceUrl(readRef()),
      "zotero://select/groups/55/items/GROUPPDF",
    );
    // Repair records created by the earlier implementation on reimport too.
    const broken = readRef();
    delete broken.libraryType;
    delete broken.groupId;
    target.db
      .prepare(`UPDATE ${M} SET context_refs_json=? WHERE role='assistant'`)
      .run(JSON.stringify({ citations: [broken] }));
    assert.equal((await importChatArchive(input, 2, false)).messages, 0);
    assert.equal(
      citationSourceUrl(readRef()),
      "zotero://select/groups/55/items/GROUPPDF",
    );
  });

  it("source-only local reimport preserves native positions and media without an account", async function () {
    const f = make();
    seed(f);
    use(f, 0);
    await ensureChatTransferSchema(async () => {});
    const locator = { kind: "pdf-page", pageIndex: 4 };
    f.db
      .prepare(
        `UPDATE ${M} SET context_refs_json=?,screenshot_images=? WHERE id=2`,
      )
      .run(
        JSON.stringify({
          citations: [
            {
              id: "local",
              itemId: 7,
              title: "Test paper",
              text: "excerpt",
              kind: "pdf",
              sourceRevision: "native-version",
              locator,
            },
          ],
        }),
        JSON.stringify(["existing-image"]),
      );
    const archive = await exportChatArchive({ libraryID: 1 });
    assert.isUndefined(
      archive.conversations[0].messages[1].citations[0].documentHash,
    );
    assert.equal(
      (await importChatArchive(JSON.stringify(archive), 1, false)).messages,
      0,
    );
    const row = f.db
      .prepare(
        `SELECT context_refs_json,screenshot_images FROM ${M} WHERE id=2`,
      )
      .get()!;
    const ref = JSON.parse(String(row.context_refs_json)).citations[0];
    assert.equal(ref.itemId, 7);
    assert.equal(ref.sourceRevision, "native-version");
    assert.deepEqual(ref.locator, locator);
    assert.deepEqual(JSON.parse(String(row.screenshot_images)), [
      "existing-image",
    ]);
  });

  it("keeps EPUB position metadata portable and rejects malformed position records", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    const ref = {
      id: "ep",
      text: "excerpt",
      source: {
        library: "user:123",
        key: "ABCDEFGH",
        title: "Book",
        kind: "epub" as const,
      },
      documentHash: "a".repeat(64),
      locator: {
        kind: "epub-location" as const,
        cfi: "epubcfi(/6/2!/4)",
        href: "OEBPS/ch1.xhtml#section",
        locationLabel: "Chapter 1",
      },
    };
    archive.conversations[0].messages[1].citations = [ref];
    const parsed = parseChatArchive(JSON.stringify(archive));
    assert.deepEqual(
      parsed.conversations[0].messages[1].citations[0].locator,
      ref.locator,
    );
    ref.locator.href = "https://example.com/";
    assert.throws(() => parseChatArchive(JSON.stringify(archive)), /EPUB/);
    (ref as any).locator = { kind: "pdf-page", pageIndex: -1 };
    assert.throws(() => parseChatArchive(JSON.stringify(archive)), /timestamp/);
  });

  it("maps paper identities, omits local paths and safely degrades citations", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    a.db.exec(
      `DELETE FROM ${G}; INSERT INTO ${P} (conversation_key,parent_item_id,created_at,title) VALUES (2000000001,7,100,'Paper');`,
    );
    a.db
      .prepare(
        `UPDATE ${M} SET context_refs_json=?,attachments_json=? WHERE id=2`,
      )
      .run(
        JSON.stringify({
          citations: [
            {
              id: "e1",
              itemId: 7,
              title: "Test paper",
              text: "excerpt",
              locator: { kind: "pdf-page", pageIndex: 9 },
              sourceRevision: "local-path",
            },
          ],
          compactedSummary: "cache",
        }),
        JSON.stringify([
          {
            name: "image.png",
            storedPath: "C:/private/secret",
            imageDataUrl: "SECRET",
          },
        ]),
      );
    const input = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    assert.equal((await importChatArchive(input, 1, true)).messages, 0);
    assert.notInclude(input, "private");
    assert.notInclude(input, "SECRET");
    assert.notInclude(input, "compactedSummary");
    const b = make();
    use(b);
    await ensureChatTransferSchema(async () => {});
    assert.equal((await importChatArchive(input, 1, false)).unresolved, 0);
    assert.equal(
      b.db.prepare(`SELECT parent_item_id FROM ${P}`).get()!.parent_item_id,
      7,
    );
    const refs = JSON.parse(
      String(
        b.db
          .prepare(`SELECT context_refs_json FROM ${M} WHERE role='assistant'`)
          .get()!.context_refs_json,
      ),
    );
    assert.equal(refs.citations[0].itemId, 7);
    assert.isUndefined(refs.citations[0].locator);
    assert.deepEqual(refs.unavailableAttachments, ["image.png"]);
    const c = make();
    use(c, 999);
    await ensureChatTransferSchema(async () => {});
    assert.equal((await importChatArchive(input, 1, false)).unresolved, 1);
    assert.include(
      String(c.db.prepare(`SELECT title FROM ${G}`).get()!.title),
      "pending",
    );
    assert.equal(
      (await exportChatArchive({ libraryID: 1 })).conversations[0].source!.key,
      item.key,
    );
  });

  it("rejects invalid trees and future formats before modifying data", async function () {
    const f = make();
    seed(f);
    use(f);
    await ensureChatTransferSchema(async () => {});
    const archive = await exportChatArchive({ libraryID: 1 });
    const copy = () => JSON.parse(JSON.stringify(archive));
    const cycle = copy();
    cycle.conversations[0].messages[0].parent =
      cycle.conversations[0].messages[1].uuid;
    assert.throws(() => parseChatArchive(JSON.stringify(cycle)), /Cyclic/);
    const missing = copy();
    missing.conversations[0].messages[1].parent =
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    assert.throws(
      () => parseChatArchive(JSON.stringify(missing)),
      /parent|active child/,
    );
    const duplicate = copy();
    duplicate.conversations.push(duplicate.conversations[0]);
    assert.throws(
      () => parseChatArchive(JSON.stringify(duplicate)),
      /Duplicate/,
    );
    assert.throws(
      () => parseChatArchive(JSON.stringify({ ...archive, version: 3 })),
      /version/,
    );
    assert.equal(f.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n, 2);
  });

  it("rolls back all imported rows on a mid-import database failure", async function () {
    const a = make();
    seed(a);
    use(a);
    await ensureChatTransferSchema(async () => {});
    const input = JSON.stringify(await exportChatArchive({ libraryID: 1 }));
    const b = make();
    use(b);
    await ensureChatTransferSchema(async () => {});
    const query = b.api.queryAsync;
    let inserts = 0;
    b.api.queryAsync = async (sql, args) => {
      if (sql.startsWith(`INSERT INTO ${M}`) && ++inserts === 2)
        throw new Error("Synthetic disk failure");
      return query(sql, args);
    };
    let failed = false;
    try {
      await importChatArchive(input, 1, false);
    } catch {
      failed = true;
    }
    assert.isTrue(failed);
    assert.equal(b.db.prepare(`SELECT count(*) AS n FROM ${M}`).get()!.n, 0);
    assert.equal(b.db.prepare(`SELECT count(*) AS n FROM ${G}`).get()!.n, 0);
  });
});
