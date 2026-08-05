/**
 * Compatibility facade for reader-document resolution and context building.
 *
 * Format-specific extraction is implemented by document adapters. Callers
 * should resolve a reader document here, then use ensureDocumentContext and
 * buildReaderDocumentContext without branching on MIME types.
 */

import { ensureCachedDocumentContext } from "./document/cache";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  EPUB_CONTENT_TYPE,
  EPUB_CONTEXT_RETRY_DELAY_MS,
  epubDocumentAdapter,
} from "./document/adapters/epubAdapter";
import { PDF_CONTENT_TYPE } from "./document/adapters/pdfAdapter";
import {
  getDocumentAdapter,
  getDocumentAdapterForItem,
} from "./document/registry";
import {
  buildDocumentContext,
  type BuildDocumentContextOptions,
} from "./document/retrieval";
import type { DocumentCapabilities, DocumentKind } from "./document/types";
import type { DocumentTextContext } from "./types";

export { EPUB_CONTENT_TYPE, EPUB_CONTEXT_RETRY_DELAY_MS, PDF_CONTENT_TYPE };

export type ReaderDocumentKind = DocumentKind;

export type ReaderDocument = {
  item: Zotero.Item;
  kind: ReaderDocumentKind;
};

export type ResolveReaderDocumentOptions = {
  preferredItemID?: number;
  preferredKind?: ReaderDocumentKind;
};

// Compatibility aliases for callers that still use the original names.
export type DocumentContext = DocumentTextContext;

export function getReaderDocumentKind(
  item: Zotero.Item | null | undefined,
): ReaderDocumentKind | null {
  return getDocumentAdapterForItem(item)?.kind || null;
}

export function getReaderDocumentCapabilities(
  item: Zotero.Item | null | undefined,
): DocumentCapabilities | null {
  return getDocumentAdapterForItem(item)?.capabilities || null;
}

function asReaderDocument(
  item: Zotero.Item | null | undefined,
): ReaderDocument | null {
  const adapter = getDocumentAdapterForItem(item);
  if (!item || !adapter) return null;
  return {
    item,
    kind: adapter.kind,
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

  const documents: ReaderDocument[] = [];
  for (const id of item.getAttachments()) {
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

  // Preserve the previous PDF-first fallback for regular parent items.
  return documents.find((document) => document.kind === "pdf") || documents[0];
}

export async function extractEpubTextFromAttachment(
  item: Zotero.Item,
): Promise<string> {
  if (!epubDocumentAdapter.supports(item)) return "";
  return (await epubDocumentAdapter.extract(item)).text;
}

export async function ensureDocumentContext(
  document: ReaderDocument,
): Promise<DocumentContext | null> {
  const adapter = getDocumentAdapter(document.kind);
  if (!adapter || !adapter.supports(document.item)) return null;
  return ensureCachedDocumentContext(adapter.describe(document.item));
}

export function isDocumentContextQueryDependent(
  document: ReaderDocument,
): boolean {
  return (
    getDocumentAdapter(document.kind)?.contextPolicy.strategy === "retrieval"
  );
}

export async function buildReaderDocumentContext(
  document: ReaderDocument,
  context: DocumentContext | undefined,
  question: string,
  hasImage: boolean,
  apiOverrides?: { apiBase?: string; apiKey?: string },
  options?: Omit<
    BuildDocumentContextOptions,
    "contextStrategy" | "useEmbeddings"
  >,
): Promise<string> {
  const adapter = getDocumentAdapter(document.kind);
  if (!adapter) return "";
  if (context && !context.documentPresentation) {
    context.documentPresentation = adapter.presentation;
  }
  const policy = adapter.contextPolicy;
  const maxChunks =
    policy.maxChunks === undefined
      ? options?.maxChunks
      : Math.min(options?.maxChunks ?? policy.maxChunks, policy.maxChunks);
  const maxLength =
    policy.maxLength === undefined
      ? options?.maxLength
      : Math.min(options?.maxLength ?? policy.maxLength, policy.maxLength);
  return buildDocumentContext(context, question, hasImage, apiOverrides, {
    ...options,
    maxChunks,
    maxLength,
    contextStrategy: policy.strategy,
    useEmbeddings: policy.useEmbeddings,
  });
}
