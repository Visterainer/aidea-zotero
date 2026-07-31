/**
 * PDF compatibility facade.
 *
 * Extraction now lives in the PDF document adapter and retrieval is shared by
 * all document formats. These exports intentionally retain their original
 * names so existing PDF and supplemental-paper callers keep the same behavior.
 */

import {
  cacheExtractedDocumentText,
  ensureCachedDocumentContext,
} from "./document/cache";
import { pdfDocumentAdapter } from "./document/adapters/pdfAdapter";
import { getDocumentTitle } from "./document/adapters/shared";
import type { DocumentTextContext } from "./types";
import {
  buildDocumentContext,
  tokenizeText,
  type BuildDocumentContextOptions,
} from "./document/retrieval";

export { cacheExtractedDocumentText };
export { tokenizeText };

export async function buildContext(
  context: DocumentTextContext | undefined,
  question: string,
  hasImage: boolean,
  apiOverrides?: { apiBase?: string; apiKey?: string },
  options?: BuildDocumentContextOptions,
): Promise<string> {
  if (context && !context.documentPresentation) {
    context.documentPresentation = pdfDocumentAdapter.presentation;
  }
  return buildDocumentContext(
    context,
    question,
    hasImage,
    apiOverrides,
    options,
  );
}

export async function ensurePDFTextCached(item: Zotero.Item): Promise<void> {
  // Preserve the previous behavior for accidental non-PDF callers: cache an
  // empty context instead of invoking PDFWorker with an unsupported item.
  if (!pdfDocumentAdapter.supports(item)) {
    cacheExtractedDocumentText(item, getDocumentTitle(item), "", {
      kind: "pdf",
      completeness: "unavailable",
    });
    return;
  }

  await ensureCachedDocumentContext(pdfDocumentAdapter.describe(item));
}
