import { assert } from "chai";

const LINKED = 2;
const STORED = 0;

interface FakeItem {
  id: number;
  parentItemID?: number;
  libraryID: number;
  deleted?: boolean;
  attachmentFilename: string;
  attachmentLinkMode: number;
  path: string;
  isAttachment(): boolean;
  isRegularItem(): boolean;
  isPDFAttachment(): boolean;
  getFilePath(): string;
  getFilePathAsync(): Promise<string | false>;
  getCollections(): number[];
}

describe("pdfTranslator translated attachments", function () {
  let mod: typeof import("../../src/modules/pdfTranslator/translationAttachment");
  const original: Record<string, unknown> = {};
  let items: Map<number, any>;
  let copies: Array<[string, string]>;
  let imported: any[];
  let linked: any[];
  let nextId: number;

  const attachment = (
    id: number,
    path: string,
    extra: Partial<FakeItem> = {},
  ): FakeItem => {
    const item: FakeItem = {
      id,
      parentItemID: 1,
      libraryID: 1,
      attachmentFilename: path.split("/").pop() || "",
      attachmentLinkMode: STORED,
      path,
      isAttachment: () => true,
      isRegularItem: () => false,
      isPDFAttachment: () => /\.pdf$/i.test(path),
      getFilePath: () => path,
      getFilePathAsync: async () => path,
      getCollections: () => [],
      ...extra,
    };
    items.set(id, item);
    return item;
  };

  const parent = (childIds: number[], best?: number) => {
    const item = {
      id: 1,
      libraryID: 1,
      isAttachment: () => false,
      isRegularItem: () => true,
      getAttachments: () => childIds,
      getBestAttachment: async () => (best ? items.get(best) : false),
    };
    items.set(1, item);
    return item;
  };

  const created = (options: any, mode: number) => {
    const file = String(options.file);
    return attachment(nextId++, file, {
      parentItemID: options.parentItemID,
      attachmentLinkMode: mode,
    });
  };

  before(async function () {
    for (const name of ["Zotero", "IOUtils", "PathUtils"]) {
      original[name] = (globalThis as any)[name];
    }
    (globalThis as any).Zotero = {
      Items: { get: (id: number) => items.get(id) || false },
      Attachments: {
        LINK_MODE_IMPORTED_FILE: STORED,
        LINK_MODE_LINKED_FILE: LINKED,
        importFromFile: async (options: any) => {
          imported.push(options);
          return created(options, STORED);
        },
        linkFromFile: async (options: any) => {
          linked.push(options);
          return created(options, LINKED);
        },
      },
    };
    (globalThis as any).IOUtils = {
      copy: async (from: string, to: string) => {
        copies.push([from, to]);
      },
    };
    (globalThis as any).PathUtils = {
      join: (...parts: string[]) => parts.join("/"),
      parent: (path: string) => path.slice(0, path.lastIndexOf("/")) || null,
    };
    mod = await import("../../src/modules/pdfTranslator/translationAttachment");
  });

  after(function () {
    for (const [name, value] of Object.entries(original)) {
      (globalThis as any)[name] = value;
    }
  });

  beforeEach(function () {
    items = new Map();
    copies = [];
    imported = [];
    linked = [];
    nextId = 100;
  });

  it("recognises engine output names for a source and language", function () {
    const match = mod.matchTranslationOutput;
    assert.equal(
      match("Paper A.no_watermark.zh-CN.mono.pdf", "Paper A.pdf", "zh-CN"),
      "mono",
    );
    assert.equal(
      match("Paper A.zh-cn.DUAL.pdf", "Paper A.pdf", "zh-CN"),
      "dual",
    );
    assert.isNull(match("Paper A.zh-CN.mono.pdf", "Paper A.pdf", "ja"));
    assert.isNull(match("Paper AB.zh-CN.mono.pdf", "Paper A.pdf", "zh-CN"));
    assert.isNull(match("Paper A.pdf", "Paper A.pdf", "zh-CN"));
  });

  it("finds the PDF to translate for attachments and regular items", async function () {
    const pdf = attachment(2, "/store/AAA/Paper A.pdf");
    attachment(3, "/store/BBB/snapshot.html");
    attachment(4, "/store/CCC/Old.pdf", { deleted: true });
    const regular = parent([4, 3, 2]);

    assert.equal(mod.findPdfAttachment(pdf), pdf);
    assert.isNull(mod.findPdfAttachment(items.get(3)));
    assert.equal(mod.findPdfAttachment(regular), pdf);
    assert.isNull(mod.findPdfAttachment({ isAttachment: () => false }));

    const resolved = await mod.resolveSourcePdf(regular);
    assert.equal(resolved?.attachment, pdf);
    assert.equal(resolved?.pdfPath, "/store/AAA/Paper A.pdf");
    assert.isNull(await mod.resolveSourcePdf(items.get(3)));
  });

  it("prefers Zotero's best attachment and skips a PDF whose file is missing", async function () {
    attachment(2, "/store/AAA/Paper A.zh-CN.mono.pdf");
    const best = attachment(3, "/store/BBB/Paper A.pdf");
    const regular = parent([2, 3], 3);
    assert.equal((await mod.resolveSourcePdf(regular))?.attachment, best);

    best.getFilePathAsync = async () => false;
    assert.equal((await mod.resolveSourcePdf(regular))?.attachment.id, 2);
  });

  it("imports a stored copy under the same parent for a stored source", async function () {
    const source = attachment(2, "/store/AAA/Paper A.pdf");
    parent([2]);

    const result = await mod.attachTranslatedPdfs(source, [
      "/tmp/out/Paper A.no_watermark.zh-CN.mono.pdf",
      "/tmp/out/Paper A.no_watermark.zh-CN.dual.pdf",
    ]);

    assert.equal(result.created, 2);
    assert.equal(result.updated, 0);
    assert.lengthOf(linked, 0);
    assert.deepEqual(imported[0], {
      file: "/tmp/out/Paper A.no_watermark.zh-CN.mono.pdf",
      title: "Paper A.no_watermark.zh-CN.mono.pdf",
      parentItemID: 1,
    });
    assert.lengthOf(copies, 0);
    assert.equal(
      mod.pickAttachmentToOpen(result.items)?.attachmentFilename,
      "Paper A.no_watermark.zh-CN.mono.pdf",
    );
  });

  it("links a copy in the source directory for a linked source", async function () {
    const source = attachment(2, "/Users/me/papers/Paper A.pdf", {
      attachmentLinkMode: LINKED,
    });
    parent([2]);

    const result = await mod.attachTranslatedPdfs(source, [
      "/tmp/out/Paper A.no_watermark.zh-CN.dual.pdf",
    ]);

    const target = "/Users/me/papers/Paper A.no_watermark.zh-CN.dual.pdf";
    assert.deepEqual(copies, [
      ["/tmp/out/Paper A.no_watermark.zh-CN.dual.pdf", target],
    ]);
    assert.deepEqual(linked, [
      {
        file: target,
        title: "Paper A.no_watermark.zh-CN.dual.pdf",
        parentItemID: 1,
      },
    ]);
    assert.lengthOf(imported, 0);
    assert.equal(result.created, 1);
    assert.equal(mod.pickAttachmentToOpen(result.items), result.items[0]);
  });

  it("replaces the file of an existing translation instead of adding a duplicate", async function () {
    const source = attachment(2, "/store/AAA/Paper A.pdf");
    const existing = attachment(
      3,
      "/store/BBB/Paper A.no_watermark.zh-CN.mono.pdf",
    );
    attachment(4, "/store/CCC/Paper A.no_watermark.zh-CN.dual.pdf", {
      deleted: true,
    });
    parent([2, 3, 4]);

    assert.deepEqual(mod.findExistingTranslations(source, "zh-CN"), {
      mono: existing,
    });
    assert.deepEqual(mod.findExistingTranslations(source, "ja"), {});

    const result = await mod.attachTranslatedPdfs(source, [
      "/tmp/out/Paper A.no_watermark.zh-CN.mono.pdf",
      "/tmp/out/Paper A.no_watermark.zh-CN.dual.pdf",
    ]);

    assert.equal(result.updated, 1);
    assert.equal(result.created, 1);
    assert.equal(result.items[0], existing);
    assert.deepEqual(copies, [
      [
        "/tmp/out/Paper A.no_watermark.zh-CN.mono.pdf",
        "/store/BBB/Paper A.no_watermark.zh-CN.mono.pdf",
      ],
    ]);
    assert.lengthOf(imported, 1);
    assert.equal(
      imported[0].file,
      "/tmp/out/Paper A.no_watermark.zh-CN.dual.pdf",
    );
  });

  it("keeps a top-level PDF's translation top-level in the same collections", async function () {
    const source = attachment(2, "/store/AAA/Solo.pdf", {
      parentItemID: undefined,
      libraryID: 7,
      getCollections: () => [11, 12],
    });

    await mod.attachTranslatedPdfs(source, ["/tmp/out/Solo.zh-CN.mono.pdf"]);

    assert.deepEqual(imported, [
      {
        file: "/tmp/out/Solo.zh-CN.mono.pdf",
        title: "Solo.zh-CN.mono.pdf",
        libraryID: 7,
        collections: [11, 12],
      },
    ]);
  });
});
