import type { DocumentSegment } from "./types";

/** Validate page boundaries before assigning positions; preserve empty-page indexes. */
export function extractPdfPageSegments(
  text: string,
  counts: unknown,
  extractedPages?: number,
): DocumentSegment[] | undefined {
  // Recent Zotero workers return form-feed boundaries instead of pageChars.
  // Accept them only when the worker's independently reported page count agrees.
  if (
    counts === undefined &&
    Number.isSafeInteger(extractedPages) &&
    extractedPages! > 0
  ) {
    const pages = text.split("\f");
    if (pages.length !== extractedPages) return undefined;
    return pages.map((pageText, pageIndex) => ({
      id: `page-${pageIndex}`,
      text: pageText,
      title: `PDF page ${pageIndex + 1}`,
      locator: { kind: "pdf-page" as const, pageIndex },
    }));
  }
  if (
    !Array.isArray(counts) ||
    !counts.length ||
    (Number.isSafeInteger(extractedPages) &&
      extractedPages! > 0 &&
      counts.length !== extractedPages) ||
    counts.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    counts.reduce((a, b) => a + b, 0) !== text.length
  )
    return undefined;
  let offset = 0;
  return counts.map((count, pageIndex) => {
    const pageText = text.slice(offset, offset + count);
    offset += count;
    return {
      id: `page-${pageIndex}`,
      text: pageText,
      title: `PDF page ${pageIndex + 1}`,
      locator: { kind: "pdf-page" as const, pageIndex },
    };
  });
}
