import type {
  DocumentAdapter,
  DocumentCompleteness,
  DocumentExtraction,
  DocumentSegment,
  DocumentStructure,
} from "../types";
import { fnv1aHex } from "../../../../utils/hash";
import {
  extractEpubContent,
  type EpubContentUnit,
} from "../epub/contentExtractor";
import { EpubPackageReader } from "../epub/packageReader";
import {
  getAttachmentContentType,
  getAttachmentSourceRevision,
  getDocumentTitle,
} from "./shared";

export const EPUB_CONTENT_TYPE = "application/epub+zip";
export const EPUB_CONTEXT_RETRY_DELAY_MS = 60_000;
export const MAX_EPUB_NORMALIZED_TEXT_CHARS = 8_000_000;

const capabilities: DocumentAdapter["capabilities"] = {
  selectionText: true,
  panelChat: true,
  structuredSections: true,
  navigableLocators: true,
  // Region capture works independently of pagination and is particularly
  // useful for fixed-layout or image-heavy EPUBs.
  screenshot: true,
  fullDocumentTranslation: false,
};

type ZoteroFulltext = {
  getItemCacheFile?: (item: Zotero.Item) => unknown;
  indexItems?: (
    itemIDs: number[] | number,
    options?: { complete?: boolean; ignoreErrors?: boolean },
  ) => Promise<unknown>;
};

function getFulltextAPI(): ZoteroFulltext | null {
  const zotero = Zotero as unknown as {
    Fulltext?: ZoteroFulltext;
    FullText?: ZoteroFulltext;
  };
  return zotero.Fulltext || zotero.FullText || null;
}

function getCacheFilePath(cacheFile: unknown): string {
  if (typeof cacheFile === "string") return cacheFile.trim();
  if (!cacheFile || typeof cacheFile !== "object") return "";
  const path = (cacheFile as { path?: unknown }).path;
  return typeof path === "string" ? path.trim() : "";
}

async function readFulltextCache(
  fulltext: ZoteroFulltext,
  item: Zotero.Item,
): Promise<string> {
  if (typeof fulltext.getItemCacheFile !== "function") return "";
  try {
    const cachePath = getCacheFilePath(fulltext.getItemCacheFile(item));
    if (!cachePath) return "";
    return String((await Zotero.File.getContentsAsync(cachePath)) || "").trim();
  } catch {
    return "";
  }
}

function normalizeLabel(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueLabels(values: Array<string | undefined>): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const label = normalizeLabel(value);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function buildEpubDocumentExtraction(
  units: EpubContentUnit[],
  structure: DocumentStructure,
  completeness: DocumentCompleteness,
  warnings?: string[],
): DocumentExtraction {
  const nodeById = new Map(structure.nodes.map((node) => [node.id, node]));
  const segments: DocumentSegment[] = units
    .map((unit): DocumentSegment | null => {
      const text = String(unit.text || "").trim();
      if (!text) return null;
      const node = nodeById.get(unit.structureNodeId || "");
      const labels = uniqueLabels([
        unit.title,
        node?.label,
        ...(unit.headingPath || []),
      ]);
      const title = labels[0];
      const readingOrder = node?.navigationOrder;
      return {
        id: unit.id,
        title,
        aliases: labels.slice(1),
        text,
        headingPath:
          unit.headingPath?.length || node?.path.length
            ? unit.headingPath || node?.path
            : title
              ? [title]
              : undefined,
        locator: {
          kind: "epub-location",
          href: unit.fragment ? `${unit.href}#${unit.fragment}` : unit.href,
          locationLabel: title,
        },
        role: unit.role,
        order: readingOrder,
        readingOrder,
        tocPath: node?.path.length ? node.path : unit.headingPath,
        fragment: unit.fragment,
        endFragment: unit.endFragment,
        structureNodeId: unit.structureNodeId,
        semanticRoles: unit.semanticRoles,
        source: unit.source,
        confidence: unit.confidence,
        linear: unit.linear,
        spineIndex: unit.spineIndex,
      };
    })
    .filter((segment): segment is DocumentSegment => Boolean(segment));

  const text = segments
    .filter((segment) => segment.role !== "navigation")
    .map((segment) => segment.text)
    .join("\n\n");
  if (text.length > MAX_EPUB_NORMALIZED_TEXT_CHARS) {
    throw new Error(
      `EPUB normalized text exceeds ${MAX_EPUB_NORMALIZED_TEXT_CHARS} characters`,
    );
  }
  return {
    text,
    segments,
    structure,
    completeness: text ? completeness : "unavailable",
    warnings,
    fingerprint: `structured-epub-v4:${segments.length}:${text.length}:${fnv1aHex(text)}`,
  };
}

async function extractStructuredEpub(
  item: Zotero.Item,
): Promise<DocumentExtraction | null> {
  if (typeof item.getFilePathAsync !== "function") return null;
  const filePath = await item.getFilePathAsync();
  if (!filePath) return null;

  const reader = new EpubPackageReader(filePath);
  try {
    const epubPackage = await reader.readPackage();
    const content = await extractEpubContent(reader, epubPackage);
    const extraction = buildEpubDocumentExtraction(
      content.units,
      content.structure,
      content.completeness,
      content.warnings,
    );
    const roleCounts = content.units.reduce<Record<string, number>>(
      (counts, unit) => {
        counts[unit.role] = (counts[unit.role] || 0) + 1;
        return counts;
      },
      {},
    );
    ztoolkit.log(
      `LLM: structured EPUB extraction source=${epubPackage.structure.nodes[0]?.source || "fallback"}, ` +
        `spine=${epubPackage.spine.length}, units=${content.units.length}, ` +
        `content=${roleCounts.content || 0}, notes=${roleCounts.notes || 0}, ` +
        `frontmatter=${roleCounts.frontmatter || 0}, chars=${extraction.text.length}, ` +
        `completeness=${extraction.completeness}`,
    );
    return extraction.text ? extraction : null;
  } finally {
    reader.close();
  }
}

export async function extractEpubText(
  item: Zotero.Item,
): Promise<DocumentExtraction> {
  try {
    const structured = await extractStructuredEpub(item);
    if (structured) return structured;
  } catch (err) {
    // The package reader is isolated behind the adapter. Keep Zotero Fulltext
    // as a compatibility fallback for malformed or unsupported publications.
    ztoolkit.log("LLM: structured EPUB extraction failed", err);
  }

  const fulltext = getFulltextAPI();
  if (fulltext) {
    const cached = await readFulltextCache(fulltext, item);
    if (cached) {
      return {
        text: cached,
        // Zotero's normal full-text index may be character-limited.
        completeness: "partial",
      };
    }

    if (typeof fulltext.indexItems === "function") {
      try {
        await fulltext.indexItems([item.id], { ignoreErrors: false });
      } catch (err) {
        ztoolkit.log("LLM: EPUB full-text indexing failed", err);
      }
      const indexed = await readFulltextCache(fulltext, item);
      if (indexed) {
        return {
          text: indexed,
          completeness: "partial",
        };
      }
    }
  }

  try {
    const text = String(
      (await (item as Zotero.Item & { attachmentText?: Promise<string> })
        .attachmentText) || "",
    ).trim();
    return {
      text,
      completeness: text ? "partial" : "unavailable",
    };
  } catch (err) {
    ztoolkit.log("LLM: EPUB attachment text fallback failed", err);
    return {
      text: "",
      completeness: "unavailable",
      warnings: ["EPUB text extraction failed"],
    };
  }
}

export const epubDocumentAdapter: DocumentAdapter = {
  kind: "epub",
  contentTypes: [EPUB_CONTENT_TYPE],
  capabilities,
  presentation: {
    noun: "book",
    fullTextHeading: "Book Full Text (complete document):",
    excerptsHeading: "Book Text:",
    relevantSectionsNotice: "Relevant sections extracted from the book",
    partialRelevantSectionsNotice:
      "Relevant sections extracted from Zotero's available EPUB text",
  },
  contextPolicy: {
    // Always retrieve bounded content units rather than sending the extracted
    // publication wholesale.
    strategy: "retrieval",
    useEmbeddings: false,
    maxChunks: 16,
    maxLength: 50_000,
  },
  selectionContextPolicy: {
    strategy: "retrieval",
    allowUnattributedSelection: true,
    maxChunks: 8,
    maxLength: 12_000,
  },
  emptyCacheRetryDelayMs: EPUB_CONTEXT_RETRY_DELAY_MS,
  supports(item): item is Zotero.Item {
    return Boolean(
      item?.isAttachment?.() &&
      getAttachmentContentType(item) === EPUB_CONTENT_TYPE,
    );
  },
  describe(item) {
    return {
      item,
      kind: "epub",
      title: getDocumentTitle(item),
      capabilities,
    };
  },
  getSourceRevision: getAttachmentSourceRevision,
  extract: extractEpubText,
};
