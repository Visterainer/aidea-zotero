import { assert } from "chai";
import { readFileSync } from "node:fs";
import {
  buildReaderDocumentContext,
  type ReaderDocument,
} from "../src/modules/contextPanel/documentContext";
import {
  epubDocumentAdapter,
  MAX_EPUB_NORMALIZED_TEXT_CHARS,
} from "../src/modules/contextPanel/document/adapters/epubAdapter";
import { pdfDocumentAdapter } from "../src/modules/contextPanel/document/adapters/pdfAdapter";
import { getDocumentAdapterForItem } from "../src/modules/contextPanel/document/registry";
import {
  isSafeEpubEntryPath,
  MAX_EPUB_ARCHIVE_ENTRIES,
  MAX_EPUB_TEXT_ENTRY_BYTES,
  MAX_EPUB_TOTAL_TEXT_BYTES,
  resolveEpubReference,
} from "../src/modules/contextPanel/document/epub/packageReader";
import {
  buildEpubNavigationStructure,
  getEpubNodeLocation,
} from "../src/modules/contextPanel/document/epub/structure";
import {
  buildDocumentContext,
  createDocumentTextContext,
} from "../src/modules/contextPanel/document/retrieval";
import {
  buildDeterministicSectionPlan,
  buildSectionCatalog,
  resolveSectionRetrievalPlan,
} from "../src/modules/contextPanel/document/sectionRouting";
import type {
  DocumentSegment,
  DocumentStructure,
} from "../src/modules/contextPanel/document/types";
import { buildContext } from "../src/modules/contextPanel/pdfContext";

const originalZtoolkit = (globalThis as Record<string, unknown>).ztoolkit;

function makeAttachment(
  id: number,
  contentType: string,
  title: string,
): Zotero.Item {
  return {
    id,
    libraryID: 1,
    parentID: null,
    attachmentContentType: contentType,
    isAttachment: () => true,
    isRegularItem: () => false,
    getField: (field: string) => (field === "title" ? title : ""),
  } as unknown as Zotero.Item;
}

function makeEpubContext(
  entries: Array<{
    id: string;
    label: string;
    text: string;
    linear?: boolean;
    role?: DocumentSegment["role"];
    parentId?: string;
  }>,
) {
  const structure: DocumentStructure = {
    rootIds: entries
      .filter((entry) => !entry.parentId)
      .map((entry) => entry.id),
    nodes: entries.map((entry, index) => ({
      id: entry.id,
      parentId: entry.parentId,
      childIds: entries
        .filter((candidate) => candidate.parentId === entry.id)
        .map((candidate) => candidate.id),
      label: entry.label,
      path: entry.parentId
        ? [
            entries.find((candidate) => candidate.id === entry.parentId)
              ?.label || "",
            entry.label,
          ].filter(Boolean)
        : [entry.label],
      source: "epub3-nav",
      confidence: "authoritative" as const,
      navigationOrder: index + 1,
      locator: { kind: "epub-location" as const, href: `${entry.id}.xhtml` },
    })),
  };
  const segments: DocumentSegment[] = entries
    .filter((entry) => entry.text)
    .map((entry, index) => ({
      id: `segment-${entry.id}`,
      title: entry.label,
      text: entry.text,
      structureNodeId: entry.id,
      tocPath: structure.nodes.find((node) => node.id === entry.id)?.path,
      role: entry.role || "content",
      linear: entry.linear !== false,
      readingOrder: index + 1,
      locator: { kind: "epub-location", href: `${entry.id}.xhtml` },
      source: "epub3-nav",
      confidence: "authoritative",
    }));
  return createDocumentTextContext({
    title: "Test Book",
    text: segments.map((segment) => segment.text).join("\n\n"),
    kind: "epub",
    capabilities: epubDocumentAdapter.capabilities,
    completeness: "complete",
    presentation: epubDocumentAdapter.presentation,
    sourceSegments: segments,
    structure,
  });
}

describe("document adapters", function () {
  beforeEach(function () {
    (globalThis as Record<string, unknown>).ztoolkit = {
      log: () => undefined,
    };
  });

  afterEach(function () {
    (globalThis as Record<string, unknown>).ztoolkit = originalZtoolkit;
  });

  it("resolves PDF and EPUB attachments through the adapter registry", function () {
    const pdf = makeAttachment(1, "application/pdf", "Paper");
    const epub = makeAttachment(2, "application/epub+zip", "Book");
    const html = makeAttachment(3, "text/html", "Page");

    assert.strictEqual(getDocumentAdapterForItem(pdf), pdfDocumentAdapter);
    assert.strictEqual(getDocumentAdapterForItem(epub), epubDocumentAdapter);
    assert.isNull(getDocumentAdapterForItem(html));
  });

  it("normalizes relative EPUB references and fragments", function () {
    assert.deepEqual(
      resolveEpubReference(
        "OPS/navigation/nav.xhtml",
        "../text/book.xhtml#opening",
      ),
      { href: "OPS/text/book.xhtml", fragment: "opening" },
    );
    assert.isNull(resolveEpubReference("OPS/nav.xhtml", "https://example.com"));
  });

  it("rejects unsafe EPUB archive paths and exposes bounded limits", function () {
    assert.isTrue(isSafeEpubEntryPath("OEBPS/chapter-1.xhtml"));
    assert.isFalse(isSafeEpubEntryPath("../chapter-1.xhtml"));
    assert.isFalse(isSafeEpubEntryPath("OEBPS/../../escape.xhtml"));
    assert.isFalse(isSafeEpubEntryPath("C:\\escape.xhtml"));
    assert.isFalse(isSafeEpubEntryPath("/absolute.xhtml"));
    assert.strictEqual(MAX_EPUB_ARCHIVE_ENTRIES, 5_000);
    assert.strictEqual(MAX_EPUB_TEXT_ENTRY_BYTES, 8 * 1024 * 1024);
    assert.strictEqual(MAX_EPUB_TOTAL_TEXT_BYTES, 64 * 1024 * 1024);
    assert.strictEqual(MAX_EPUB_NORMALIZED_TEXT_CHARS, 8_000_000);
  });

  it("ships real EPUB 2 and EPUB 3 ZIP fixtures", function () {
    for (const name of ["epub3-sections.epub", "epub2-ncx.epub"]) {
      const bytes = readFileSync(
        new URL(`./fixtures/${name}`, import.meta.url),
      );
      assert.strictEqual(bytes.subarray(0, 2).toString("ascii"), "PK");
      const archiveText = bytes.toString("latin1");
      assert.include(archiveText, "mimetype");
      assert.include(archiveText, "META-INF/container.xml");
      assert.include(archiveText, "OEBPS/content.opf");
    }
  });

  it("preserves publisher hierarchy independently from text segments", function () {
    const structure = buildEpubNavigationStructure(
      [
        {
          label: "Part One",
          semanticRoles: ["part"],
          children: [
            {
              label: "Opening",
              href: "text/opening.xhtml",
              fragment: "start",
              children: [],
            },
          ],
        },
      ],
      "epub3-nav",
    );
    const opening = structure.nodes.find((node) => node.label === "Opening")!;
    assert.deepEqual(opening.path, ["Part One", "Opening"]);
    assert.deepEqual(getEpubNodeLocation(opening), {
      href: "text/opening.xhtml",
      fragment: "start",
    });
  });

  it("routes explicit publisher labels locally", function () {
    const context = makeEpubContext([
      { id: "opening", label: "Opening", text: "OPENING_BODY" },
      { id: "crossing", label: "Crossing", text: "CROSSING_BODY" },
    ]);
    const catalog = buildSectionCatalog(context)!;
    const plan = buildDeterministicSectionPlan(catalog, "Summarize Crossing");
    assert.deepEqual(plan, {
      scope: "sections",
      sectionIds: [catalog.cards.find((card) => card.label === "Crossing")!.id],
      coverage: "focused",
    });
    assert.strictEqual(
      resolveSectionRetrievalPlan(catalog, plan)?.segmentIds.size,
      1,
    );
    assert.deepEqual(buildDeterministicSectionPlan(catalog, "概括整本书"), {
      scope: "document",
      sectionIds: [],
      coverage: "balanced",
    });
    assert.isNull(buildDeterministicSectionPlan(catalog, "Why is that?"));
  });

  it("preserves the existing full-text behavior for short PDFs", async function () {
    const context = createDocumentTextContext({
      title: "Test Paper",
      text: "Existing PDF text",
      kind: "pdf",
      capabilities: pdfDocumentAdapter.capabilities,
      completeness: "complete",
    });
    const built = await buildContext(context, "What is this?", false);
    assert.include(built, "Existing PDF text");
    assert.include(built, "complete document");
  });

  it("uses bounded EPUB retrieval and selects an explicit chapter", async function () {
    const context = makeEpubContext([
      { id: "origins", label: "Origins", text: "ORIGINS_BODY begins." },
      {
        id: "crossing",
        label: "Crossing",
        text: "CROSSING_BODY explains the transition.",
      },
      { id: "arrival", label: "Arrival", text: "ARRIVAL_BODY concludes." },
    ]);
    const document: ReaderDocument = {
      item: makeAttachment(4, "application/epub+zip", "Journey"),
      kind: "epub",
    };
    const built = await buildReaderDocumentContext(
      document,
      context,
      "Summarize Crossing",
      false,
      undefined,
      { maxChunks: 1 },
    );
    assert.include(built, "CROSSING_BODY");
    assert.notInclude(built, "ORIGINS_BODY");
    assert.notInclude(built, "ARRIVAL_BODY");
    assert.notInclude(built, "Book Full Text");
  });

  it("reuses the previously retrieved section for ambiguous follow-ups", async function () {
    const context = makeEpubContext([
      { id: "one", label: "Chapter One", text: "FIRST_BODY" },
      { id: "two", label: "Chapter Two", text: "SECOND_BODY" },
    ]);
    let retrievedSegmentIds: string[] = [];
    const first = await buildDocumentContext(
      context,
      "Summarize Chapter Two",
      false,
      undefined,
      {
        contextStrategy: "retrieval",
        useEmbeddings: false,
        maxChunks: 1,
        onRetrievedSegments: (ids) => {
          retrievedSegmentIds = ids;
        },
      },
    );
    const followUp = await buildDocumentContext(
      context,
      "Why does the author say that?",
      false,
      undefined,
      {
        contextStrategy: "retrieval",
        useEmbeddings: false,
        maxChunks: 1,
        preferredSegmentIds: retrievedSegmentIds,
      },
    );
    assert.include(first, "SECOND_BODY");
    assert.include(followUp, "SECOND_BODY");
    assert.notInclude(followUp, "FIRST_BODY");
  });

  it("samples linear sections for whole-book summaries", async function () {
    const context = makeEpubContext([
      { id: "first", label: "First", text: "FIRST_LINEAR_BODY" },
      {
        id: "notes",
        label: "Notes",
        text: "NON_LINEAR_NOTES",
        linear: false,
        role: "notes",
      },
      { id: "last", label: "Last", text: "LAST_LINEAR_BODY" },
    ]);
    const built = await buildDocumentContext(
      context,
      "Summarize the whole book",
      false,
      undefined,
      {
        contextStrategy: "retrieval",
        useEmbeddings: false,
        maxChunks: 2,
      },
    );
    assert.include(built, "FIRST_LINEAR_BODY");
    assert.include(built, "LAST_LINEAR_BODY");
    assert.notInclude(built, "NON_LINEAR_NOTES");
  });

  it("honors cancellation during local context preparation", async function () {
    const context = makeEpubContext([
      { id: "one", label: "One", text: "BODY" },
    ]);
    const controller = new AbortController();
    controller.abort();
    let failure: unknown;
    try {
      await buildDocumentContext(context, "Question", false, undefined, {
        contextStrategy: "retrieval",
        useEmbeddings: false,
        signal: controller.signal,
      });
    } catch (error) {
      failure = error;
    }
    assert.strictEqual((failure as Error | undefined)?.name, "AbortError");
  });
});
