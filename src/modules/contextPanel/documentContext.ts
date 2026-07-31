import { cacheExtractedDocumentText, ensurePDFTextCached } from "./pdfContext";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  epubTextRetryAfterByItem,
  pdfTextCache,
  pdfTextLoadingTasks,
} from "./state";
import type { PdfContext } from "./types";

export const PDF_CONTENT_TYPE = "application/pdf";
export const EPUB_CONTENT_TYPE = "application/epub+zip";
export const EPUB_CONTEXT_RETRY_DELAY_MS = 60_000;

export type ReaderDocumentKind = "pdf" | "epub";

export type ReaderDocument = {
  item: Zotero.Item;
  kind: ReaderDocumentKind;
};

export type ResolveReaderDocumentOptions = {
  preferredItemID?: number;
  preferredKind?: ReaderDocumentKind;
};

// Compatibility alias: existing PDF chat callers can keep PdfContext while
// new reader-document code uses a format-neutral name.
export type DocumentContext = PdfContext;

type ZoteroFulltext = {
  getItemCacheFile?: (item: Zotero.Item) => unknown;
  indexItems?: (
    itemIDs: number[] | number,
    options?: { complete?: boolean; ignoreErrors?: boolean },
  ) => Promise<unknown>;
};

function getAttachmentContentType(item: Zotero.Item): string {
  return String(item.attachmentContentType || "")
    .trim()
    .toLowerCase();
}

export function getReaderDocumentKind(
  item: Zotero.Item | null | undefined,
): ReaderDocumentKind | null {
  if (!item?.isAttachment?.()) return null;
  const contentType = getAttachmentContentType(item);
  if (contentType === PDF_CONTENT_TYPE) return "pdf";
  if (contentType === EPUB_CONTENT_TYPE) return "epub";
  return null;
}

function asReaderDocument(
  item: Zotero.Item | null | undefined,
): ReaderDocument | null {
  if (!item) return null;
  const kind = getReaderDocumentKind(item);
  if (!kind) return null;
  return {
    item,
    kind,
  };
}

export function resolveReaderDocument(
  item: Zotero.Item | null | undefined,
  options: ResolveReaderDocumentOptions = {},
): ReaderDocument | null {
  if (!item) return null;

  // Reader tabs provide the attachment item itself. Never call
  // getAttachments() on attachments: Zotero intentionally throws.
  if (item.isAttachment?.()) {
    return asReaderDocument(item);
  }
  if (!item.isRegularItem?.()) return null;

  const attachmentIDs = item.getAttachments();
  const documents: ReaderDocument[] = [];
  for (const id of attachmentIDs) {
    const document = asReaderDocument(getZoteroItem(id));
    if (document) documents.push(document);
  }
  if (!documents.length) return null;

  if (options.preferredItemID !== undefined) {
    const preferredItem = documents.find(
      (document) => document.item.id === options.preferredItemID,
    );
    if (preferredItem) return preferredItem;
  }
  if (options.preferredKind) {
    const preferredKind = documents.find(
      (document) => document.kind === options.preferredKind,
    );
    if (preferredKind) return preferredKind;
  }

  // Preserve the previous PDF-only resolver's behavior for callers that only
  // have a regular parent item. Reader code should pass the actual attachment
  // whenever the active tab makes it available.
  return documents.find((document) => document.kind === "pdf") || documents[0];
}

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

export async function extractEpubTextFromAttachment(
  item: Zotero.Item,
): Promise<string> {
  if (getReaderDocumentKind(item) !== "epub") return "";

  const fulltext = getFulltextAPI();
  if (fulltext) {
    const cached = await readFulltextCache(fulltext, item);
    if (cached) return cached;

    if (typeof fulltext.indexItems === "function") {
      try {
        await fulltext.indexItems([item.id], { ignoreErrors: false });
      } catch (err) {
        ztoolkit.log("LLM: EPUB full-text indexing failed", err);
      }
      const indexed = await readFulltextCache(fulltext, item);
      if (indexed) return indexed;
    }
  }

  // attachmentText can return an already-indexed EPUB on Zotero versions
  // where the Fulltext cache helpers are not exposed. It is deliberately a
  // fallback because partially indexed EPUBs may return an empty string.
  try {
    return String(
      (await (item as Zotero.Item & { attachmentText?: Promise<string> })
        .attachmentText) || "",
    ).trim();
  } catch (err) {
    ztoolkit.log("LLM: EPUB attachment text fallback failed", err);
    return "";
  }
}

function getDocumentTitle(item: Zotero.Item): string {
  try {
    const parent =
      item.isAttachment?.() && item.parentID
        ? getZoteroItem(item.parentID)
        : null;
    return String(
      parent?.getField?.("title") || item.getField?.("title") || "",
    ).trim();
  } catch {
    return "";
  }
}

async function ensureEpubTextCached(item: Zotero.Item): Promise<void> {
  const cached = pdfTextCache.get(item.id);
  if (cached?.chunks.length) {
    epubTextRetryAfterByItem.delete(item.id);
    return;
  }
  if (cached) {
    const retryAfter = epubTextRetryAfterByItem.get(item.id) || 0;
    if (retryAfter > Date.now()) return;
    pdfTextCache.delete(item.id);
  }

  const existingTask = pdfTextLoadingTasks.get(item.id);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    try {
      const text = await extractEpubTextFromAttachment(item);
      cacheExtractedDocumentText(item, getDocumentTitle(item), text);
      if (text) {
        epubTextRetryAfterByItem.delete(item.id);
      } else {
        epubTextRetryAfterByItem.set(
          item.id,
          Date.now() + EPUB_CONTEXT_RETRY_DELAY_MS,
        );
      }
    } catch (err) {
      ztoolkit.log("LLM: EPUB context extraction failed", err);
      cacheExtractedDocumentText(item, getDocumentTitle(item), "");
      epubTextRetryAfterByItem.set(
        item.id,
        Date.now() + EPUB_CONTEXT_RETRY_DELAY_MS,
      );
    } finally {
      pdfTextLoadingTasks.delete(item.id);
    }
  })();
  pdfTextLoadingTasks.set(item.id, task);
  await task;
}

export async function ensureDocumentContext(
  document: ReaderDocument,
): Promise<DocumentContext | null> {
  if (document.kind === "pdf") {
    await ensurePDFTextCached(document.item);
  } else {
    await ensureEpubTextCached(document.item);
  }
  return pdfTextCache.get(document.item.id) || null;
}
