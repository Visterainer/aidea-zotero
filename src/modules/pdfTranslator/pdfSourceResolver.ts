/* ---------------------------------------------------------------------------
 * pdfTranslator/pdfSourceResolver.ts  –  Resolve PDF path from Zotero Item
 *
 * Given a Zotero.Item, find the first / best PDF attachment and return
 * its absolute filesystem path.
 * -------------------------------------------------------------------------*/

declare const Zotero: any;
declare const IOUtils: { exists(path: string): Promise<boolean> };

/**
 * Resolve the best PDF attachment path for a Zotero item.
 *
 * Logic:
 *   1. If the item is itself a PDF attachment → return its file path.
 *   2. If the item is a regular item → use `item.getBestAttachment()`.
 *   3. Validate the path exists on disk.
 *
 * @returns  absolute file path, or `null` if no valid PDF is found.
 */
export async function resolveItemPdfPath(
  item: any, /* Zotero.Item */
): Promise<string | null> {
  if (!item) return null;

  let attachItem: any = null;

  if (item.isAttachment?.()) {
    // The item itself is an attachment — check if it's a PDF
    attachItem = item;
  } else if (item.isRegularItem?.()) {
    // Regular item — get its best (earliest) attachment
    try {
      attachItem = await item.getBestAttachment();
    } catch {
      return null;
    }
  }

  if (!attachItem) return null;

  // Get file path from the attachment
  let filepath: string | null = null;
  try {
    const raw = attachItem.getFilePath?.();
    filepath = raw ? String(raw) : null;
  } catch {
    return null;
  }

  if (!filepath || !filepath.endsWith(".pdf")) return null;

  // Verify the file exists on disk
  try {
    const exists = await IOUtils.exists(filepath);
    if (!exists) return null;
  } catch {
    return null;
  }

  return filepath;
}

/**
 * Get the default output directory for translated PDFs.
 * Uses the same directory as the source PDF.
 *
 * @param pdfPath  absolute path to the source PDF
 * @returns        absolute path to the parent directory
 */
export function getDefaultOutputDir(pdfPath: string): string {
  // PathUtils is a Gecko global
  return (globalThis as any).PathUtils?.parent?.(pdfPath) || "";
}
