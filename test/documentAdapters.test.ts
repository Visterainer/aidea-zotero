import { assert } from "chai";
import {
  buildReaderDocumentContext,
  isDocumentContextQueryDependent,
  type ReaderDocument,
} from "../src/modules/contextPanel/documentContext";
import {
  buildEpubDocumentExtraction,
  epubDocumentAdapter,
} from "../src/modules/contextPanel/document/adapters/epubAdapter";
import { pdfDocumentAdapter } from "../src/modules/contextPanel/document/adapters/pdfAdapter";
import {
  extractEpubContent,
  type EpubContentUnit,
} from "../src/modules/contextPanel/document/epub/contentExtractor";
import { getDocumentAdapterForItem } from "../src/modules/contextPanel/document/registry";
import {
  resolveEpubReference,
  type EpubPackage,
  type EpubPackageReader,
} from "../src/modules/contextPanel/document/epub/packageReader";
import {
  appendEpubStructureNode,
  buildEpubNavigationStructure,
  getEpubNodeLocation,
  type EpubNavigationNode,
} from "../src/modules/contextPanel/document/epub/structure";
import { createDocumentTextContext } from "../src/modules/contextPanel/document/retrieval";
import {
  buildSectionCatalog,
  resolveSectionRetrievalPlan,
} from "../src/modules/contextPanel/document/sectionRouting";
import {
  buildSectionPlannerPrompt,
  createLlmSectionPlanner,
  parseSectionRetrievalPlan,
  SECTION_PLANNER_CATALOG_MAX_CHARS,
} from "../src/modules/contextPanel/document/sectionPlanner";
import type {
  DocumentExtraction,
  DocumentStructure,
  DocumentStructureNode,
} from "../src/modules/contextPanel/document/types";
import { buildContext } from "../src/modules/contextPanel/pdfContext";

const originalZtoolkit = (globalThis as Record<string, unknown>).ztoolkit;

type RawEpubTocEntry = {
  href: string;
  fragment?: string;
  title: string;
  tocPath?: string[];
};

type RawEpubSection = {
  href: string;
  fragment?: string;
  endFragment?: string;
  text: string;
  heading?: string;
  role: "content" | "navigation" | "frontmatter" | "notes";
  tocEntries?: RawEpubTocEntry[];
  semanticRoles?: string[];
  linear?: boolean;
};

function uniqueLabels(values: Array<string | undefined>): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const label = String(value || "")
      .replace(/\s+/g, " ")
      .trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function normalizeFragment(value: string | undefined): string | undefined {
  const raw = String(value || "")
    .replace(/^#/, "")
    .trim();
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function fixtureNavigation(entries: RawEpubTocEntry[]): DocumentStructure {
  type MutableNavigationNode = EpubNavigationNode & {
    children: MutableNavigationNode[];
  };
  const roots: MutableNavigationNode[] = [];
  const byPath = new Map<string, MutableNavigationNode>();
  for (const entry of entries) {
    const labels = uniqueLabels([...(entry.tocPath || []), entry.title]);
    let siblings = roots;
    const path: string[] = [];
    labels.forEach((label, index) => {
      path.push(label);
      const key = path.map((part) => part.toLowerCase()).join("\u0000");
      let node = byPath.get(key);
      if (!node) {
        node = { label, children: [] };
        byPath.set(key, node);
        siblings.push(node);
      }
      if (index === labels.length - 1) {
        node.href = entry.href;
        node.fragment = entry.fragment;
      }
      siblings = node.children;
    });
  }
  return buildEpubNavigationStructure(roots, "epub3-nav");
}

function fixtureNodeForLocation(
  structure: DocumentStructure,
  href: string,
  fragment?: string,
): DocumentStructureNode | undefined {
  const normalizedFragment = normalizeFragment(fragment);
  return structure.nodes.find((node) => {
    const location = getEpubNodeLocation(node);
    return (
      location?.href === href &&
      normalizeFragment(location.fragment) === normalizedFragment
    );
  });
}

function buildStructuredEpubExtraction(
  sections: RawEpubSection[],
): DocumentExtraction {
  const structure = fixtureNavigation(
    sections.flatMap((section) => section.tocEntries || []),
  );
  const units: EpubContentUnit[] = [];
  sections.forEach((section, spineIndex) => {
    if (section.role === "navigation" || !section.text.trim()) return;
    const fragment = normalizeFragment(section.fragment);
    const node =
      fixtureNodeForLocation(structure, section.href, fragment) ||
      appendEpubStructureNode(structure, {
        id: `epub-structure:spine:${spineIndex}`,
        label: section.heading,
        href: section.href,
        fragment,
        semanticRoles: section.semanticRoles,
        source: "spine",
        confidence: "fallback",
      });
    units.push({
      id: fragment
        ? `epub:${section.href}#${fragment}`
        : `epub:${section.href}::1`,
      href: section.href,
      fragment,
      endFragment: normalizeFragment(section.endFragment),
      text: section.text.trim(),
      title: section.heading || node.label,
      headingPath: node.path,
      structureNodeId: node.id,
      semanticRoles: section.semanticRoles || node.semanticRoles,
      source: node.source as EpubContentUnit["source"],
      confidence: node.confidence,
      role: section.role,
      linear: section.linear !== false,
      spineIndex,
    });
  });
  return buildEpubDocumentExtraction(units, structure, "complete");
}

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

describe("document adapters", function () {
  beforeEach(function () {
    (globalThis as Record<string, unknown>).ztoolkit = {
      log: () => undefined,
    };
  });

  afterEach(function () {
    (globalThis as Record<string, unknown>).ztoolkit = originalZtoolkit;
  });

  it("resolves supported items through the adapter registry", function () {
    const pdf = makeAttachment(1, "application/pdf", "Paper");
    const epub = makeAttachment(2, "application/epub+zip", "Book");
    const html = makeAttachment(3, "text/html", "Page");

    assert.strictEqual(getDocumentAdapterForItem(pdf), pdfDocumentAdapter);
    assert.strictEqual(getDocumentAdapterForItem(epub), epubDocumentAdapter);
    assert.isNull(getDocumentAdapterForItem(html));
  });

  it("normalizes EPUB package references without relying on filenames", function () {
    assert.deepEqual(
      resolveEpubReference(
        "OPS/navigation/nav.xhtml",
        "../text/book.xhtml#opening",
      ),
      {
        href: "OPS/text/book.xhtml",
        fragment: "opening",
      },
    );
    assert.deepEqual(
      resolveEpubReference(
        "content.opf",
        "Ernest Hemingway - The Sun Also Rises_split_002.htm",
      ),
      {
        href: "Ernest Hemingway - The Sun Also Rises_split_002.htm",
        fragment: undefined,
      },
    );
    assert.isNull(
      resolveEpubReference(
        "OPS/navigation/nav.xhtml",
        "https://example.com/book.xhtml",
      ),
    );
  });

  it("extracts EPUB DOM text without a global Node constructor", async function () {
    const root = {
      localName: "body",
      children: [],
      attributes: [],
      parentElement: null,
      getAttribute: () => null,
      getElementsByTagName: () => [],
    };
    const textNode = {
      nodeType: 3,
      nodeValue: "Chapter body from Zotero's DOM range.",
      childNodes: [],
    };
    const paragraph = {
      nodeType: 1,
      localName: "p",
      childNodes: [textNode],
    };
    const embeddedNavigation = {
      nodeType: 1,
      localName: "nav",
      childNodes: [
        {
          nodeType: 3,
          nodeValue: "Repeated table of contents",
          childNodes: [],
        },
      ],
    };
    const script = {
      nodeType: 1,
      localName: "script",
      childNodes: [
        {
          nodeType: 3,
          nodeValue: "window.notBookText = true",
          childNodes: [],
        },
      ],
    };
    const fragment = {
      nodeType: 11,
      childNodes: [paragraph, embeddedNavigation, script],
    };
    const document = {
      body: root,
      documentElement: root,
      createRange: () => ({
        setStartBefore: () => undefined,
        setEndBefore: () => undefined,
        setEndAfter: () => undefined,
        cloneContents: () => fragment,
      }),
      getElementById: () => null,
      getElementsByTagName: () => [],
    } as unknown as XMLDocument;
    const reader = {
      hasEntry: () => true,
      readDocument: async () => document,
    } as unknown as EpubPackageReader;
    const epubPackage: EpubPackage = {
      contentPath: "content.opf",
      manifest: [],
      spine: [
        {
          idref: "chapter",
          href: "chapter.xhtml",
          mediaType: "application/xhtml+xml",
          properties: [],
          linear: true,
          spineIndex: 0,
        },
      ],
      structure: { rootIds: [], nodes: [] },
    };
    const nodeDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Node");
    try {
      Reflect.deleteProperty(globalThis, "Node");
      const extraction = await extractEpubContent(reader, epubPackage);
      assert.lengthOf(extraction.units, 1);
      assert.include(
        extraction.units[0].text,
        "Chapter body from Zotero's DOM range.",
      );
      assert.notInclude(extraction.units[0].text, "Repeated table of contents");
      assert.notInclude(extraction.units[0].text, "window.notBookText");
    } finally {
      if (nodeDescriptor) {
        Object.defineProperty(globalThis, "Node", nodeDescriptor);
      }
    }
  });

  it("preserves publisher hierarchy separately from text ownership", function () {
    const structure = buildEpubNavigationStructure(
      [
        {
          sourceId: "part-a",
          label: "Movement A",
          semanticRoles: ["part"],
          children: [
            {
              sourceId: "opening",
              label: "An Opening",
              href: "text/book.xhtml",
              fragment: "opening",
              semanticRoles: ["chapter"],
            },
            {
              sourceId: "turn",
              label: "The Turn",
              href: "text/book.xhtml",
              fragment: "turn",
            },
          ],
        },
      ],
      "epub2-ncx",
    );

    assert.lengthOf(structure.rootIds, 1);
    assert.lengthOf(structure.nodes, 3);
    assert.deepEqual(structure.nodes[0].semanticRoles, ["part"]);
    assert.deepEqual(structure.nodes[1].path, ["Movement A", "An Opening"]);
    assert.strictEqual(structure.nodes[1].parentId, structure.nodes[0].id);
    assert.strictEqual(structure.nodes[1].source, "epub2-ncx");
    assert.strictEqual(structure.nodes[1].confidence, "authoritative");
  });

  it("builds logical section cards that map containers to descendant text", function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "first.xhtml",
        text: "FIRST_BODY",
        role: "content",
        tocEntries: [
          {
            href: "first.xhtml",
            title: "First",
            tocPath: ["Part A", "First"],
          },
        ],
      },
      {
        href: "second.xhtml",
        text: "SECOND_BODY",
        role: "content",
        tocEntries: [
          {
            href: "second.xhtml",
            title: "Second",
            tocPath: ["Part A", "Second"],
          },
        ],
      },
    ]);
    const context = createDocumentTextContext({
      title: "Structured",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });
    const catalog = buildSectionCatalog(context);
    assert.isNotNull(catalog);
    const container = catalog?.cards.find((card) => card.label === "Part A");
    assert.exists(container);
    assert.strictEqual(container?.confidence, "authoritative");
    assert.include(container?.preview || "", "FIRST_BODY");
    assert.lengthOf(
      catalog?.segmentIdsBySectionId.get(container?.id || "") || [],
      2,
    );

    const resolved = resolveSectionRetrievalPlan(catalog!, {
      scope: "sections",
      sectionIds: [container!.id],
      coverage: "balanced",
    });
    assert.strictEqual(resolved?.segmentIds.size, 2);
  });

  it("validates LLM section plans and ignores unsupported output", async function () {
    const sections = [
      {
        id: "section-1",
        label: "Opening",
        path: ["Part A", "Opening"],
        source: "epub3-nav",
        confidence: "authoritative" as const,
        characterCount: 1200,
      },
      {
        id: "section-2",
        label: "Crossing",
        path: ["Part A", "Crossing"],
        source: "epub3-nav",
        confidence: "authoritative" as const,
        characterCount: 1800,
      },
    ];
    assert.deepEqual(
      parseSectionRetrievalPlan(
        '```json\n{"scope":"sections","sectionIds":["section-2","unknown"],"coverage":"focused"}\n```',
        new Set(sections.map((section) => section.id)),
      ),
      {
        scope: "sections",
        sectionIds: ["section-2"],
        coverage: "focused",
      },
    );
    assert.isNull(
      parseSectionRetrievalPlan(
        '{"scope":"sections","sectionIds":["unknown"],"coverage":"focused"}',
        new Set(sections.map((section) => section.id)),
      ),
    );

    let prompt = "";
    const planner = createLlmSectionPlanner(async (value) => {
      prompt = value;
      return '{"scope":"document","sectionIds":[],"coverage":"balanced"}';
    });
    assert.deepEqual(
      await planner({
        question: "概括整本书",
        sections,
        previousSectionIds: ["section-1"],
      }),
      {
        scope: "document",
        sectionIds: [],
        coverage: "balanced",
      },
    );
    assert.include(prompt, "Previously retrieved sections");
    assert.include(prompt, "section-1");
    assert.include(prompt, "概括整本书");
  });

  it("enforces the section catalogue budget for hostile publisher labels", function () {
    const prompt = buildSectionPlannerPrompt({
      question: "Find the relevant section",
      sections: [
        {
          id: "section-1",
          label: "Oversized",
          path: ["x".repeat(70_000)],
          source: "epub3-nav",
          confidence: "authoritative",
          characterCount: 1,
        },
      ],
    });
    const catalogJson =
      prompt
        .split("\n")
        .find((line) => line.startsWith("Section catalogue: "))
        ?.slice("Section catalogue: ".length) || "";

    assert.isAtMost(catalogJson.length, SECTION_PLANNER_CATALOG_MAX_CHARS);
    assert.lengthOf(JSON.parse(catalogJson), 1);
  });

  it("propagates caller cancellation through section planning", async function () {
    const controller = new AbortController();
    const planner = createLlmSectionPlanner(
      async (_prompt, signal) =>
        await new Promise<string>((_resolve, reject) => {
          signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true },
          );
        }),
    );
    const pending = planner({
      question: "Find it",
      sections: [
        {
          id: "section-1",
          label: "Opening",
          path: ["Opening"],
          source: "epub3-nav",
          confidence: "authoritative",
          characterCount: 100,
        },
      ],
      signal: controller.signal,
    });
    controller.abort();

    let failure: unknown;
    try {
      await pending;
    } catch (error) {
      failure = error;
    }
    assert.strictEqual((failure as Error | undefined)?.name, "AbortError");
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

    assert.strictEqual(
      built,
      [
        "Title: Test Paper",
        "Paper Full Text (complete document):",
        "Existing PDF text",
        "\n[Full document content provided — 17 chars]",
      ].join("\n\n"),
    );
  });

  it("uses bounded retrieval instead of injecting the full EPUB", async function () {
    const epub = makeAttachment(4, "application/epub+zip", "Garden Book");
    const orchidSection = `orchid ${"petal ".repeat(260)}`;
    const graniteSection = `granite ${"mineral ".repeat(260)}`;
    const context = createDocumentTextContext({
      title: "Garden Book",
      text: `${orchidSection}\n\n${graniteSection}`,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: "partial",
    });
    const document: ReaderDocument = { item: epub, kind: "epub" };
    const pdfDocument: ReaderDocument = {
      item: makeAttachment(5, "application/pdf", "Paper"),
      kind: "pdf",
    };

    assert.isTrue(isDocumentContextQueryDependent(document));
    assert.isFalse(isDocumentContextQueryDependent(pdfDocument));
    const built = await buildReaderDocumentContext(
      document,
      context,
      "How are orchids described?",
      false,
      undefined,
      { maxChunks: 1 },
    );

    assert.include(built, "Book Text:");
    assert.include(built, "orchid");
    assert.notInclude(built, "Book Full Text");
    assert.notInclude(built, "granite");
    assert.include(built, "available EPUB text");
  });

  it("keeps EPUB navigation local and routes a planner-selected publisher section", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "OEBPS/nav.xhtml",
        text: "Contents Early Ground Middle Path The Last Horizon",
        role: "navigation",
        tocEntries: [
          { href: "OEBPS/chapter-1.xhtml", title: "Early Ground" },
          { href: "OEBPS/chapter-2.xhtml", title: "Middle Path" },
          ...Array.from({ length: 15 }, (_, index) => ({
            href: `OEBPS/chapter-${index + 3}.xhtml`,
            title: `Chapter ${index + 3}`,
          })),
          {
            href: "OEBPS/chapter-18.xhtml",
            title: "The Last Horizon",
          },
        ],
      },
      {
        href: "OEBPS/titlepage.xhtml",
        text: "Publisher title page",
        role: "frontmatter",
      },
      {
        href: "OEBPS/chapter-1.xhtml",
        heading: "Chapter One",
        text: "EARLY_BODY describes the opening argument.",
        role: "content",
      },
      {
        href: "OEBPS/chapter-2.xhtml",
        heading: "Chapter Two",
        text: "MIDDLE_BODY develops the central argument.",
        role: "content",
      },
      ...Array.from({ length: 15 }, (_, index) => ({
        href: `OEBPS/chapter-${index + 3}.xhtml`,
        text: "",
        role: "content" as const,
      })),
      {
        href: "OEBPS/chapter-18.xhtml",
        heading: "Chapter Eighteen",
        text: "LATE_BODY concludes with the horizon argument.",
        role: "content",
      },
      {
        href: "OEBPS/chapter-18-fn.xhtml",
        text: "RARE_FOOTNOTE explains a source used in the conclusion.",
        role: "notes",
      },
    ]);

    assert.strictEqual(extraction.completeness, "complete");
    assert.include(extraction.text, "LATE_BODY");
    assert.include(extraction.text, "Publisher title page");
    assert.include(extraction.text, "RARE_FOOTNOTE");
    assert.notInclude(extraction.text, "Contents Early Ground");

    const context = createDocumentTextContext({
      title: "Structured Book",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });
    const document: ReaderDocument = {
      item: makeAttachment(6, "application/epub+zip", "Structured Book"),
      kind: "epub",
    };
    const built = await buildReaderDocumentContext(
      document,
      context,
      "Summarize chapter 18",
      false,
      undefined,
      {
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "The Last Horizon")!
              .id,
          ],
          coverage: "balanced",
        }),
      },
    );

    assert.include(built, "Book section — The Last Horizon");
    assert.include(built, "LATE_BODY");
    assert.notInclude(built, "Contents Early Ground");
    assert.notInclude(built, "Publisher title page");
    assert.notInclude(built, "RARE_FOOTNOTE");

    const notes = await buildReaderDocumentContext(
      document,
      context,
      "What does RARE_FOOTNOTE explain?",
      false,
    );
    assert.include(notes, "Book notes");
    assert.include(notes, "RARE_FOOTNOTE");
  });

  it("routes EPUB questions by TOC title and samples across chapters for summaries", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "nav.xhtml",
        text: "Table of Contents",
        role: "navigation",
        tocEntries: [
          { href: "one.xhtml", title: "Chapter 1: Origins" },
          { href: "two.xhtml", title: "Chapter 2: Crossing" },
          { href: "three.xhtml", title: "Chapter 3: Arrival" },
        ],
      },
      {
        href: "one.xhtml",
        heading: "Origins",
        text: "ORIGINS_BODY explains where the journey begins.",
        role: "content",
      },
      {
        href: "two.xhtml",
        heading: "Crossing",
        text: "CROSSING_BODY explains the difficult transition.",
        role: "content",
      },
      {
        href: "three.xhtml",
        heading: "Arrival",
        text: "ARRIVAL_BODY explains how the journey ends.",
        role: "content",
      },
    ]);
    const context = createDocumentTextContext({
      title: "Journey",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });
    const document: ReaderDocument = {
      item: makeAttachment(7, "application/epub+zip", "Journey"),
      kind: "epub",
    };

    const titled = await buildReaderDocumentContext(
      document,
      context,
      "What is the main idea of Crossing?",
      false,
    );
    assert.include(titled, "CROSSING_BODY");
    assert.notInclude(titled, "ORIGINS_BODY");
    assert.notInclude(titled, "ARRIVAL_BODY");

    const overview = await buildReaderDocumentContext(
      document,
      context,
      "Give me a summary of the whole book",
      false,
      undefined,
      {
        maxChunks: 2,
        sectionPlanner: async ({ sections }) => {
          assert.lengthOf(sections, 3);
          return {
            scope: "document",
            sectionIds: [],
            coverage: "balanced",
          };
        },
      },
    );
    assert.include(overview, "ORIGINS_BODY");
    assert.include(overview, "ARRIVAL_BODY");
    assert.notInclude(overview, "CROSSING_BODY");
    assert.lengthOf(overview.match(/Book section/g) || [], 2);

    const comparison = await buildReaderDocumentContext(
      document,
      context,
      "Compare chapters 1 and 3",
      false,
      undefined,
      {
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: sections
            .filter(
              (section) =>
                section.label === "Chapter 1: Origins" ||
                section.label === "Chapter 3: Arrival",
            )
            .map((section) => section.id),
          coverage: "balanced",
        }),
      },
    );
    assert.include(comparison, "ORIGINS_BODY");
    assert.include(comparison, "ARRIVAL_BODY");
    assert.notInclude(comparison, "CROSSING_BODY");

    const chineseSection = await buildReaderDocumentContext(
      document,
      context,
      "总结第三章",
      false,
      undefined,
      {
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "Chapter 3: Arrival")!
              .id,
          ],
          coverage: "balanced",
        }),
      },
    );
    assert.include(chineseSection, "ARRIVAL_BODY");
    assert.notInclude(chineseSection, "ORIGINS_BODY");
    assert.notInclude(chineseSection, "CROSSING_BODY");
  });

  it("lets a semantic planner route a cross-language section question", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "one.xhtml",
        text: "ORIGINS_BODY begins the journey.",
        role: "content",
        tocEntries: [{ href: "one.xhtml", title: "Origins" }],
      },
      {
        href: "two.xhtml",
        text: "CROSSING_BODY describes the difficult passage.",
        role: "content",
        tocEntries: [{ href: "two.xhtml", title: "Crossing" }],
      },
      {
        href: "three.xhtml",
        text: "ARRIVAL_BODY ends the journey.",
        role: "content",
        tocEntries: [{ href: "three.xhtml", title: "Arrival" }],
      },
    ]);
    const context = createDocumentTextContext({
      title: "Journey",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });
    const built = await buildReaderDocumentContext(
      {
        item: makeAttachment(70, "application/epub+zip", "Journey"),
        kind: "epub",
      },
      context,
      "哪一部分描述了艰难的旅程？",
      false,
      undefined,
      {
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "Crossing")!.id,
          ],
          coverage: "focused",
        }),
      },
    );
    assert.include(built, "CROSSING_BODY");
    assert.notInclude(built, "ORIGINS_BODY");
    assert.notInclude(built, "ARRIVAL_BODY");
  });

  it("keeps stronger global evidence when a planner selects the wrong section", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "opening.xhtml",
        text: "OPENING_BODY contains unrelated introductory material.",
        role: "content",
        tocEntries: [{ href: "opening.xhtml", title: "Opening" }],
      },
      {
        href: "later.xhtml",
        text: "LATER_BODY explains the UNIQUE_LATE_TOPIC in detail.",
        role: "content",
        tocEntries: [{ href: "later.xhtml", title: "Later" }],
      },
    ]);
    const context = createDocumentTextContext({
      title: "Planner Recovery",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });

    const built = await buildReaderDocumentContext(
      {
        item: makeAttachment(71, "application/epub+zip", "Planner Recovery"),
        kind: "epub",
      },
      context,
      "Where is UNIQUE_LATE_TOPIC explained?",
      false,
      undefined,
      {
        maxChunks: 2,
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "Opening")!.id,
          ],
          coverage: "focused",
        }),
      },
    );

    assert.include(built, "OPENING_BODY");
    assert.include(built, "UNIQUE_LATE_TOPIC");
  });

  it("enforces the EPUB adapter context cap even when a caller asks for more", async function () {
    const sections = Array.from({ length: 20 }, (_, index) => ({
      href: `chapter-${index + 1}.xhtml`,
      text: `CHAPTER_${index + 1}_BODY ${"detail ".repeat(20)}`,
      role: "content" as const,
    }));
    const extraction = buildStructuredEpubExtraction(sections);
    const context = createDocumentTextContext({
      title: "Long Book",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
    });
    const document: ReaderDocument = {
      item: makeAttachment(8, "application/epub+zip", "Long Book"),
      kind: "epub",
    };

    const built = await buildReaderDocumentContext(
      document,
      context,
      "Summarize the whole book",
      false,
      undefined,
      {
        maxChunks: 99,
        maxLength: 100_000,
        sectionPlanner: async () => ({
          scope: "document",
          sectionIds: [],
          coverage: "balanced",
        }),
      },
    );

    assert.lengthOf(built.match(/Book section:/g) || [], 16);
    assert.isAtMost(built.length, 50_500);
  });

  it("preserves publisher labels without deriving structure from their wording", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "nav.xhtml",
        text: "Contents",
        role: "navigation",
        tocEntries: [
          { href: "preface.xhtml", title: "Preface" },
          { href: "chapter-one.xhtml", title: "Chapter One" },
        ],
      },
      {
        href: "preface.xhtml",
        text: "PREFACE_ONLY introduces the author.",
        role: "content",
      },
      {
        href: "chapter-one.xhtml",
        text: "CHAPTER_ONE_ONLY begins the argument.",
        role: "content",
      },
    ]);
    const context = createDocumentTextContext({
      title: "Numbered Book",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });
    const document: ReaderDocument = {
      item: makeAttachment(9, "application/epub+zip", "Numbered Book"),
      kind: "epub",
    };

    const built = await buildReaderDocumentContext(
      document,
      context,
      "Summarize chapter 1",
      false,
      undefined,
      {
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "Chapter One")!.id,
          ],
          coverage: "balanced",
        }),
      },
    );

    assert.include(built, "CHAPTER_ONE_ONLY");
    assert.notInclude(built, "PREFACE_ONLY");
    assert.include(built, "Book section — Chapter One");
    const contentSegments =
      extraction.segments?.filter((segment) => segment.role === "content") ||
      [];
    assert.strictEqual(contentSegments[0].readingOrder, 1);
  });

  it("preserves fragment-level EPUB sections and reuses them for follow-ups", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "nav.xhtml",
        text: "Contents",
        role: "navigation",
        tocEntries: [
          {
            href: "book.xhtml",
            fragment: "chapter-one",
            title: "Chapter One",
          },
          {
            href: "book.xhtml",
            fragment: "chapter-two",
            title: "Chapter Two",
          },
        ],
      },
      {
        href: "book.xhtml",
        fragment: "chapter-one",
        text: "FIRST_FRAGMENT_BODY opens the argument.",
        role: "content",
      },
      {
        href: "book.xhtml",
        fragment: "chapter-two",
        text: "SECOND_FRAGMENT_BODY develops the argument.",
        role: "content",
      },
    ]);
    const context = createDocumentTextContext({
      title: "Single Resource Book",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });
    const document: ReaderDocument = {
      item: makeAttachment(10, "application/epub+zip", "Single Resource Book"),
      kind: "epub",
    };
    let retrievedSegmentIds: string[] = [];

    const first = await buildReaderDocumentContext(
      document,
      context,
      "Summarize chapter 2",
      false,
      undefined,
      {
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "Chapter Two")!.id,
          ],
          coverage: "balanced",
        }),
        onRetrievedSegments: (segmentIds) => {
          retrievedSegmentIds = segmentIds;
        },
      },
    );
    assert.include(first, "SECOND_FRAGMENT_BODY");
    assert.notInclude(first, "FIRST_FRAGMENT_BODY");
    assert.lengthOf(retrievedSegmentIds, 1);

    const followUp = await buildReaderDocumentContext(
      document,
      context,
      "Why does he say that?",
      false,
      undefined,
      { preferredSegmentIds: retrievedSegmentIds },
    );
    assert.include(followUp, "SECOND_FRAGMENT_BODY");
    assert.notInclude(followUp, "FIRST_FRAGMENT_BODY");

    const contentSegments =
      extraction.segments?.filter((segment) => segment.role === "content") ||
      [];
    assert.strictEqual(contentSegments.length, 2);
    assert.strictEqual(contentSegments[1].id, "epub:book.xhtml#chapter-two");
    assert.strictEqual(
      contentSegments[1].locator?.kind === "epub-location"
        ? contentSegments[1].locator.href
        : "",
      "book.xhtml#chapter-two",
    );
    assert.notProperty(
      context,
      "sourceSegments",
      "the cached context should not retain a second full copy of book text",
    );
  });

  it("delegates short publisher-title references to the planner", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "nav.xhtml",
        text: "Contents",
        role: "navigation",
        tocEntries: [
          { href: "time.xhtml", title: "Time" },
          { href: "memory.xhtml", title: "Memory" },
        ],
      },
      {
        href: "time.xhtml",
        text: "TIME_SECTION discusses chronology.",
        role: "content",
      },
      {
        href: "memory.xhtml",
        text: "MEMORY_SECTION also discusses time across the book.",
        role: "content",
      },
    ]);
    const context = createDocumentTextContext({
      title: "Themes",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });
    const document: ReaderDocument = {
      item: makeAttachment(11, "application/epub+zip", "Themes"),
      kind: "epub",
    };

    const explicitTitle = await buildReaderDocumentContext(
      document,
      context,
      'Summarize "Time"',
      false,
      undefined,
      {
        maxChunks: 1,
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "Time")!.id,
          ],
          coverage: "focused",
        }),
      },
    );
    assert.include(explicitTitle, "TIME_SECTION");
    assert.notInclude(explicitTitle, "MEMORY_SECTION");
  });

  it("routes publisher container labels to their descendant content units", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "nav.xhtml",
        text: "Contents",
        role: "navigation",
        tocEntries: [
          {
            href: "first.xhtml",
            title: "First",
            tocPath: ["Movement A", "First"],
          },
          {
            href: "second.xhtml",
            title: "Second",
            tocPath: ["Movement A", "Second"],
          },
          {
            href: "third.xhtml",
            title: "Third",
            tocPath: ["Movement B", "Third"],
          },
        ],
      },
      {
        href: "first.xhtml",
        text: "FIRST_MOVEMENT_BODY",
        role: "content",
      },
      {
        href: "second.xhtml",
        text: "SECOND_MOVEMENT_BODY",
        role: "content",
      },
      {
        href: "third.xhtml",
        text: "OTHER_MOVEMENT_BODY",
        role: "content",
      },
    ]);
    const context = createDocumentTextContext({
      title: "Movements",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });

    const built = await buildContext(
      context,
      'Summarize "Movement A"',
      false,
      undefined,
      {
        contextStrategy: "retrieval",
        useEmbeddings: false,
        maxChunks: 2,
        sectionPlanner: async ({ sections }) => ({
          scope: "sections",
          sectionIds: [
            sections.find((section) => section.label === "Movement A")!.id,
          ],
          coverage: "balanced",
        }),
      },
    );

    assert.include(built, "FIRST_MOVEMENT_BODY");
    assert.include(built, "SECOND_MOVEMENT_BODY");
    assert.notInclude(built, "OTHER_MOVEMENT_BODY");
  });

  it("keeps generic spine units as fallback publisher structure", function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "opening.xhtml",
        heading: "Opening",
        text: "OPENING_BODY",
        role: "content",
      },
      {
        href: "development.xhtml",
        heading: "Development",
        text: "DEVELOPMENT_BODY",
        role: "content",
      },
    ]);
    const segments = extraction.segments || [];

    assert.lengthOf(segments, 2);
    assert.deepEqual(
      extraction.structure?.nodes.map((node) => node.source),
      ["spine", "spine"],
    );
    assert.deepEqual(
      extraction.structure?.nodes.map((node) => node.confidence),
      ["fallback", "fallback"],
    );
  });

  it("keeps non-linear EPUB units searchable but out of broad samples", async function () {
    const extraction = buildStructuredEpubExtraction([
      {
        href: "first.xhtml",
        heading: "First",
        text: "FIRST_LINEAR_BODY",
        role: "content",
      },
      {
        href: "supplement.xhtml",
        heading: "Supplement",
        text: "NON_LINEAR_SUPPLEMENT",
        role: "content",
        linear: false,
      },
      {
        href: "last.xhtml",
        heading: "Last",
        text: "LAST_LINEAR_BODY",
        role: "content",
      },
    ]);
    const context = createDocumentTextContext({
      title: "Linear Book",
      text: extraction.text,
      kind: "epub",
      capabilities: epubDocumentAdapter.capabilities,
      completeness: extraction.completeness,
      sourceSegments: extraction.segments,
      structure: extraction.structure,
    });

    const overview = await buildContext(
      context,
      "Summarize the whole book",
      false,
      undefined,
      {
        contextStrategy: "retrieval",
        useEmbeddings: false,
        maxChunks: 2,
        sectionPlanner: async () => ({
          scope: "document",
          sectionIds: [],
          coverage: "balanced",
        }),
      },
    );
    assert.include(overview, "FIRST_LINEAR_BODY");
    assert.include(overview, "LAST_LINEAR_BODY");
    assert.notInclude(overview, "NON_LINEAR_SUPPLEMENT");

    const supplement = await buildContext(
      context,
      "What does NON_LINEAR_SUPPLEMENT contain?",
      false,
      undefined,
      {
        contextStrategy: "retrieval",
        useEmbeddings: false,
        maxChunks: 1,
      },
    );
    assert.include(supplement, "NON_LINEAR_SUPPLEMENT");
  });
});
