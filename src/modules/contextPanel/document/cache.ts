import {
  documentTextCache,
  documentTextLoadingTasks,
  documentTextRetryAfterByItem,
} from "../state";
import type { DocumentTextContext } from "../types";
import { getDocumentAdapter } from "./registry";
import { createDocumentTextContext } from "./retrieval";
import type {
  DocumentAdapter,
  DocumentCompleteness,
  DocumentDescriptor,
  DocumentKind,
  DocumentSegment,
  DocumentStructure,
} from "./types";

export type CacheExtractedDocumentTextOptions = {
  kind?: DocumentKind;
  completeness?: DocumentCompleteness;
  warnings?: string[];
  fingerprint?: string;
  sourceRevision?: string;
  presentation?: DocumentAdapter["presentation"];
  sourceSegments?: DocumentSegment[];
  structure?: DocumentStructure;
};

/**
 * Compatibility cache entry point used by the existing selection-translation
 * tests and callers. New adapter code should use ensureCachedDocumentContext.
 */
export function cacheExtractedDocumentText(
  item: Zotero.Item,
  title: string,
  documentText: string,
  options: CacheExtractedDocumentTextOptions = {},
): DocumentTextContext {
  const adapter = options.kind ? getDocumentAdapter(options.kind) : null;
  const context = createDocumentTextContext({
    title,
    text: documentText,
    kind: options.kind,
    capabilities: adapter?.capabilities,
    completeness:
      options.completeness || (documentText ? "complete" : "unavailable"),
    warnings: options.warnings,
    fingerprint: options.fingerprint,
    sourceRevision: options.sourceRevision,
    presentation: options.presentation || adapter?.presentation,
    sourceSegments: options.sourceSegments,
    structure: options.structure,
  });
  documentTextCache.set(item.id, context);
  return context;
}

export async function ensureCachedDocumentContext(
  document: DocumentDescriptor,
): Promise<DocumentTextContext | null> {
  const adapter = getDocumentAdapter(document.kind);
  if (!adapter || !adapter.supports(document.item)) return null;

  const sourceRevision = await adapter.getSourceRevision?.(document.item);
  let cached = documentTextCache.get(document.item.id);
  const cacheMatchesSource = Boolean(
    cached &&
    (cached.documentKind === undefined ||
      cached.documentKind === adapter.kind) &&
    (cached.sourceRevision === undefined ||
      !sourceRevision ||
      cached.sourceRevision === sourceRevision),
  );
  if (cached && !cacheMatchesSource) {
    documentTextCache.delete(document.item.id);
    documentTextRetryAfterByItem.delete(document.item.id);
    cached = undefined;
  }
  if (cached?.chunks.length) {
    documentTextRetryAfterByItem.delete(document.item.id);
    return cached;
  }
  if (cached) {
    const retryDelay = adapter.emptyCacheRetryDelayMs;
    if (!retryDelay) return cached;
    const retryAfter = documentTextRetryAfterByItem.get(document.item.id) || 0;
    if (retryAfter > Date.now()) return cached;
    documentTextCache.delete(document.item.id);
  }

  const existingTask = documentTextLoadingTasks.get(document.item.id);
  if (existingTask) {
    await existingTask;
    return ensureCachedDocumentContext(document);
  }

  const task = (async () => {
    try {
      const extraction = await adapter.extract(document.item);
      cacheExtractedDocumentText(
        document.item,
        document.title,
        extraction.text,
        {
          kind: adapter.kind,
          completeness: extraction.completeness,
          warnings: extraction.warnings,
          fingerprint: extraction.fingerprint,
          sourceRevision,
          presentation: adapter.presentation,
          sourceSegments: extraction.segments,
          structure: extraction.structure,
        },
      );
      if (extraction.text) {
        documentTextRetryAfterByItem.delete(document.item.id);
      } else if (adapter.emptyCacheRetryDelayMs) {
        documentTextRetryAfterByItem.set(
          document.item.id,
          Date.now() + adapter.emptyCacheRetryDelayMs,
        );
      }
    } catch (err) {
      ztoolkit.log(
        `LLM: ${adapter.kind.toUpperCase()} context extraction failed`,
        err,
      );
      cacheExtractedDocumentText(document.item, document.title, "", {
        kind: adapter.kind,
        completeness: "unavailable",
        sourceRevision,
        presentation: adapter.presentation,
      });
      if (adapter.emptyCacheRetryDelayMs) {
        documentTextRetryAfterByItem.set(
          document.item.id,
          Date.now() + adapter.emptyCacheRetryDelayMs,
        );
      }
    } finally {
      documentTextLoadingTasks.delete(document.item.id);
    }
  })();
  documentTextLoadingTasks.set(document.item.id, task);
  await task;
  return documentTextCache.get(document.item.id) || null;
}
