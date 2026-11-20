import { assert } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as p from "node:path";
import { createHash } from "node:crypto";
import {
  inspectTranslationOutputs as inspect,
  publishTranslationOutputs as publish,
  type OutputPlan,
  type TranslationOutputKind,
} from "../../src/modules/pdfTranslator/translationOutputs";

/** Real files, a minimal Zotero item store, and Gecko error names. The race
 * hook runs at exclusive creation, after all user-space existence checks. */
describe("translation output plan and publication", function () {
  const g = globalThis as any;
  let originals: any, dir: string, store: string, folder: string, stage: string;
  let items: any[], source: any, z: any, io: any, sequence: number;
  const noOp = () => {};
  const data = (text: string) => `%PDF-1.7\n${text}\n%%EOF`;
  const write = (path: string, text: string) => {
    fs.mkdirSync(p.dirname(path), { recursive: true });
    fs.writeFileSync(path, data(text));
    return path;
  };
  const text = (path: string) => fs.readFileSync(path, "utf8");
  const generated = (kind = "mono", content = "NEW") =>
    write(p.join(stage, `Paper.no_watermark.zh-CN.${kind}.pdf`), content);
  function wrap<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        (e as Error).name = "NotFoundError";
      throw e;
    }
  }
  function ns(path: string) {
    return {
      path,
      normalize() {
        this.path = wrap(() => fs.realpathSync(this.path));
      },
      isSymlink: () => wrap(() => fs.lstatSync(path).isSymbolicLink()),
      isDirectory: () => wrap(() => fs.statSync(path).isDirectory()),
      isFile: () => wrap(() => fs.statSync(path).isFile()),
      get fileSize() {
        return fs.statSync(path).size;
      },
      renameTo: (parent: any, leaf: string) =>
        fs.renameSync(path, p.join(parent.path, leaf)),
      remove: () => fs.unlinkSync(path),
      isReadable: () => true,
      isWritable: () => true,
      equals: (other: any) => other.path === path,
      contains: (other: any) => other.path.startsWith(`${path}/`),
    };
  }
  function item(path: string, extra: any = {}) {
    const id = ++sequence;
    const it: any = {
      id,
      key: `ITEM${id}`,
      path,
      libraryID: 1,
      parentItemID: 1,
      attachmentLinkMode: 0,
      relatedItems: [],
      tags: [],
      get attachmentFilename() {
        return p.basename(this.path);
      },
      getFilePath() {
        return this.path;
      },
      isAttachment: () => true,
      isPDFAttachment: () => true,
      isStoredFileAttachment() {
        return this.attachmentLinkMode === 0;
      },
      getCollections: () => [12],
      addTag(tag: string) {
        this.tags.push(tag);
      },
      addRelatedItem(other: any) {
        this.relatedItems.push(other.key);
      },
      saveTx: async () => {},
      ...extra,
    };
    items.push(it);
    return it;
  }
  function plan(
    attach = true,
    saveDir = folder,
    overwrite = false,
    kinds: TranslationOutputKind[] = ["mono", "dual"],
  ) {
    return inspect(
      source,
      source.path,
      "zh-CN",
      kinds,
      { attach, saveDir },
      overwrite,
    );
  }
  const cell = (
    plan: OutputPlan,
    destination: "attachment" | "folder",
    kind: TranslationOutputKind = "mono",
  ) =>
    plan.cells.find((c) => c.destination === destination && c.kind === kind)!;
  async function rejects(fn: Promise<unknown>, match: RegExp) {
    let error: unknown;
    try {
      await fn;
    } catch (e) {
      error = e;
    }
    assert.match(String(error), match);
  }

  beforeEach(function () {
    originals = {
      Zotero: g.Zotero,
      IOUtils: g.IOUtils,
      PathUtils: g.PathUtils,
    };
    dir = fs.realpathSync(
      fs.mkdtempSync(p.join(os.tmpdir(), "aidea-outputs-")),
    );
    store = p.join(dir, "storage");
    folder = p.join(dir, "translations");
    stage = p.join(dir, "engine");
    for (const d of [store, folder, stage]) fs.mkdirSync(d);
    sequence = 1;
    items = [
      {
        id: 1,
        libraryID: 1,
        getAttachments: () =>
          items.filter((i) => i.parentItemID === 1).map((i) => i.id),
      },
    ];
    source = item(write(p.join(store, "ORIGINAL", "Paper.pdf"), "SOURCE"));
    z = g.Zotero = {
      File: { pathToFile: ns },
      DataDirectory: { dir },
      getStorageDirectory: () => ns(store),
      Items: {
        get: (id: number) => items.find((i) => i.id === id) || false,
        getByLibraryAndKey: (lib: number, key: string) =>
          items.find((i) => i.key === key && i.libraryID === lib) || false,
      },
      Libraries: {
        get: (lib: number) => ({
          editable: true,
          filesEditable: true,
          allowsLinkedFiles: lib === 1,
        }),
      },
      DB: {
        queryAsync: async () =>
          items
            .filter((i) => i.attachmentLinkMode === 2)
            .map((i) => ({ itemID: i.id, path: i.path })),
        columnQueryAsync: async (_sql: string, args: any[]) =>
          items
            .filter(
              (i) =>
                !i.parentItemID &&
                i.libraryID === args[0] &&
                args.includes(`storage:${i.attachmentFilename}`),
            )
            .map((i) => i.id),
      },
      Attachments: {
        LINK_MODE_LINKED_FILE: 2,
        getStorageDirectory: (it: any) => ns(p.dirname(it.path)),
        importFromFile: async (o: any) => {
          const dest = p.join(
            store,
            `NEW${sequence + 1}`,
            o.fileBaseName + ".pdf",
          );
          fs.mkdirSync(p.dirname(dest));
          fs.copyFileSync(o.file, dest);
          return item(dest, {
            parentItemID: o.parentItemID,
            libraryID: o.libraryID || 1,
            collections: o.collections,
          });
        },
        linkFromFile: async (o: any) =>
          item(o.file, {
            attachmentLinkMode: 2,
            parentItemID: o.parentItemID,
            collections: o.collections,
          }),
      },
      logError: noOp,
    };
    z.Items.getAsync = async (id: any) =>
      Array.isArray(id) ? id.map(z.Items.get) : z.Items.get(id);
    z.Items.getByLibraryAndKeyAsync = z.Items.getByLibraryAndKey;
    g.PathUtils = { parent: p.dirname, join: p.join, isAbsolute: p.isAbsolute };
    io = g.IOUtils = {
      stat: async (path: string) =>
        wrap(() => {
          const s = fs.statSync(path);
          return {
            type: s.isFile()
              ? "regular"
              : s.isDirectory()
                ? "directory"
                : "other",
            size: s.size,
            lastModified: s.mtimeMs,
            creationTime: s.birthtimeMs,
          };
        }),
      read: async (path: string) =>
        wrap(() => fs.readFileSync(path).subarray(0, 1024)),
      createUniqueDirectory: async (parent: string, prefix: string) =>
        fs.mkdtempSync(p.join(parent, prefix)),
      copy: async (a: string, b: string) =>
        fs.copyFileSync(a, b, fs.constants.COPYFILE_EXCL),
      writeUTF8: async (dest: string, marker: string, options: any) => {
        assert.equal(options.mode, "create");
        fs.writeFileSync(dest, marker, { flag: "wx" });
      },
      makeDirectory: async (path: string) =>
        fs.mkdirSync(path, { recursive: true }),
      remove: async (path: string) =>
        fs.rmSync(path, { recursive: true, force: true }),
      computeHexDigest: async (path: string) =>
        createHash("sha256").update(fs.readFileSync(path)).digest("hex"),
    };
  });

  afterEach(function () {
    Object.assign(g, originals);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("inspects the selected destination × format without writes, including same-named sources", async function () {
    const legacy = write(p.join(folder, "Paper.zh-CN.mono.pdf"), "UNOWNED");
    const att = item(
      write(p.join(store, "ATT", "Paper.zh-CN.mono.pdf"), "LEGACY"),
    );
    const a = await plan();
    assert.lengthOf(a.cells, 4);
    assert.isTrue(cell(a, "attachment").exists);
    assert.deepEqual(a.generateKinds, ["mono", "dual"]);
    assert.deepEqual((await plan(true, "", false, ["mono"])).generateKinds, []);
    assert.deepEqual(
      (await plan(false, folder, false, ["mono"])).generateKinds,
      ["mono"],
    );
    assert.deepEqual(fs.readdirSync(folder), ["Paper.zh-CN.mono.pdf"]);
    const b = await inspect(
      item(write(p.join(store, "OTHER", "Paper.pdf"), "OTHER")),
      p.join(store, "OTHER", "Paper.pdf"),
      "zh-CN",
      ["mono"],
      { attach: true, saveDir: folder },
      true,
    );
    assert.notEqual(cell(a, "folder").path, cell(b, "folder").path);
    assert.isFalse(cell(b, "attachment").exists);
    assert.equal(text(att.path), data("LEGACY"));
    assert.equal(text(legacy), data("UNOWNED"));
  });

  it("files only missing cells, returns old and new receipts; overwrite preserves attachment IDs in place", async function () {
    const old = item(
      write(p.join(store, "ATT", "Paper.zh-CN.mono.pdf"), "EXISTING"),
    );
    const first = await plan();
    const done: string[] = [];
    const files = [generated(), generated("dual")];
    const out = await publish(
      JSON.parse(JSON.stringify(first)),
      files,
      [],
      (id) => done.push(id),
    );
    assert.sameMembers(
      done,
      first.cells.map((c) => c.id),
    );
    assert.include(out.itemIDs, old.id);
    assert.lengthOf(out.itemIDs, 2);
    assert.lengthOf(out.savedFiles, 2);
    assert.equal(text(old.path), data("EXISTING"));
    assert.deepEqual((await plan()).generateKinds, []);
    const next = await plan(true, folder, true);
    const overwrite = await publish(next, files, [], noOp);
    assert.sameMembers(overwrite.itemIDs, out.itemIDs);
    assert.sameMembers(overwrite.savedFiles, out.savedFiles);
    assert.equal(text(old.path), data("NEW"));
    assert.equal(old.attachmentSyncState, "to_upload");
    assert.equal(text(source.path), data("SOURCE"));
    assert.lengthOf(fs.readdirSync(folder), 2);
  });

  it("uses no-clobber even for an authorized batch when the missing file appears at exclusive creation", async function () {
    const a = await plan(false, folder, true, ["mono"]);
    const path = a.cells[0].path!;
    const reserve = io.writeUTF8;
    io.writeUTF8 = async (x: string, y: string, o: any) => {
      write(path, "WINNER");
      await reserve(x, y, o);
    };
    assert.deepEqual((await publish(a, [generated()], [], noOp)).savedFiles, [
      path,
    ]);
    assert.equal(text(path), data("WINNER"));
  });

  it("retains the last good PDF after a staging failure, and never uses v2 files", async function () {
    const path = cell(await plan(false), "folder").path!;
    write(path, "GOOD");
    const a = await plan(false, folder, true, ["mono"]);
    io.copy = async (_a: string, b: string) => {
      fs.writeFileSync(b, "partial");
      throw Error("disk full");
    };
    const f = generated();
    await rejects(publish(a, [f], [], noOp), /disk full/);
    assert.equal(text(path), data("GOOD"));
    assert.deepEqual(fs.readdirSync(folder), [p.basename(path)]);
    assert.equal(text(f), data("NEW"));
  });

  it("reconciles a saved checkpoint against disk, repairing missing cells, without rerunning a completed overwrite", async function () {
    const a = await plan(true, folder, true, ["mono"]);
    const done: string[] = [];
    const path = cell(a, "folder").path!;
    const create = z.Attachments.importFromFile;
    z.Attachments.importFromFile = async () => {
      throw Error("failed import");
    };
    const paths = [generated()];
    await rejects(
      publish(a, paths, done, (id) => done.push(id)),
      /failed import/,
    );
    assert.deepEqual(done, [cell(a, "folder").id]);
    write(path, "USER EDIT");
    z.Attachments.importFromFile = create;
    const out = await publish(a, paths, done, noOp);
    assert.equal(text(path), data("USER EDIT"));
    assert.lengthOf(out.itemIDs, 1);
    fs.unlinkSync(path);
    await publish(
      a,
      paths,
      a.cells.map((c) => c.id),
      noOp,
    );
    assert.equal(text(path), data("NEW"));
    assert.lengthOf(
      items.filter((i) => i.tags?.length),
      1,
    );
  });

  it("repairs a positively missing file on the same record; never repairs a remote-only record", async function () {
    const path = p.join(store, "ATT", "Paper.zh-CN.mono.pdf");
    const a = item(path, { attachmentSyncState: 1 });
    await rejects(plan(true, "", true, ["mono"]), /Sync or download/);
    a.attachmentSyncState = 2;
    await rejects(plan(true, "", false, ["mono"]), /Sync or download/);
    a.attachmentSyncState = 0;
    const missing = await plan(true, "", false, ["mono"]);
    assert.isFalse(missing.cells[0].exists);
    assert.deepEqual(
      (await publish(missing, [generated()], [], noOp)).itemIDs,
      [a.id],
    );
    assert.equal(text(path), data("NEW"));
  });

  it("does not count permission failures, invalid PDFs or symlinks as missing", async function () {
    const path = cell(await plan(false), "folder").path!;
    fs.writeFileSync(path, "broken");
    await rejects(plan(false), /Not a readable PDF/);
    fs.unlinkSync(path);
    fs.symlinkSync(source.path, path);
    await rejects(plan(false), /symbolic-link/);
    assert.equal(text(source.path), data("SOURCE"));
    fs.unlinkSync(path);
    write(path, "VALID");
    const read = io.read;
    io.read = async (pathname: string) => {
      if (pathname === path) throw Error("permission denied");
      return read(pathname);
    };
    await rejects(plan(false), /permission denied/);
  });

  it("validates the source, manifest, language and deserialized cell paths before publishing", async function () {
    const a = await plan(false, folder, true, ["mono"]);
    const f = generated();
    await rejects(publish(a, [f, f], [], noOp), /duplicate/);
    await rejects(
      publish(a, [write(p.join(stage, "Paper.ja.mono.pdf"), "JA")], [], noOp),
      /Unexpected/,
    );
    await rejects(publish(a, [], [], noOp), /Missing staged/);
    await rejects(
      inspect(
        source,
        source.path,
        "../ja",
        ["mono"],
        { attach: false, saveDir: folder },
        true,
      ),
      /Invalid/,
    );
    await rejects(
      inspect(source, f, "ja", ["mono"], { attach: true, saveDir: "" }, true),
      /no longer matches/,
    );
    a.cells[0].path = source.path;
    await rejects(publish(a, [f], [], noOp), /Invalid saved/);
    assert.equal(text(source.path), data("SOURCE"));
    assert.isEmpty(fs.readdirSync(folder));
  });

  it("keeps linked and folder cells distinct and never overwrites an unrelated linked backing file", async function () {
    source.path = write(p.join(dir, "Paper.pdf"), "SOURCE");
    source.attachmentLinkMode = 2;
    const a = await plan(true, dir, false, ["mono"]);
    assert.notEqual(cell(a, "attachment").path, cell(a, "folder").path);
    const out = await publish(a, [generated()], [], noOp);
    const linked = z.Items.get(out.itemIDs[0]);
    assert.equal(linked.attachmentLinkMode, 2);
    assert.equal(p.dirname(linked.path), dir);
    item(out.savedFiles[0], { parentItemID: 77, attachmentLinkMode: 2 });
    await rejects(
      plan(false, dir, true, ["mono"]),
      /also backs another Zotero/,
    );
  });

  it("recovers an interrupted link, and refuses to adopt or replace an unrelated orphan", async function () {
    source.path = write(p.join(dir, "Paper.pdf"), "SOURCE");
    source.attachmentLinkMode = 2;
    const a = await plan(true, "", true, ["mono"]);
    const path = a.cells[0].path!;
    const files = [generated()];
    const link = z.Attachments.linkFromFile;
    z.Attachments.linkFromFile = async () => {
      throw Error("DB error");
    };
    await rejects(publish(a, files, [], noOp), /DB error/);
    assert.equal(text(path), data("NEW"));
    z.Attachments.linkFromFile = link;
    write(path, "FOREIGN");
    await rejects(publish(a, files, [], noOp), /filename is occupied/);
    assert.equal(text(path), data("FOREIGN"));
    write(path, "NEW");
    assert.lengthOf((await publish(a, files, [], noOp)).itemIDs, 1);
  });

  it("files group and top-level results in the original library/collections, never links into a group", async function () {
    source.parentItemID = undefined;
    source.libraryID = 5;
    source.attachmentLinkMode = 2;
    const a = await plan(true, "", false, ["mono"]);
    const [id] = (await publish(a, [generated()], [], noOp)).itemIDs;
    const created = z.Items.get(id);
    assert.equal(created.libraryID, 5);
    assert.equal(created.attachmentLinkMode, 0);
    assert.isUndefined(created.parentItemID);
    assert.deepEqual(created.collections, [12]);
    assert.deepEqual(source.relatedItems, []);
    assert.deepEqual((await plan(true, "", false, ["mono"])).generateKinds, []);
  });

  it("uses stable, distinct paths for disk-only inputs with identical names", async function () {
    const opts = { attach: false, saveDir: folder };
    const b = write(p.join(dir, "elsewhere", "Paper.pdf"), "OTHER");
    const first = await inspect(null, source.path, "en", ["mono"], opts, false);
    const other = await inspect(null, b, "en", ["mono"], opts, false);
    assert.notEqual(first.cells[0].path, other.cells[0].path);
    assert.deepEqual(
      (await inspect(null, source.path, "en", ["mono"], opts, false)).cells,
      first.cells,
    );
  });
});
