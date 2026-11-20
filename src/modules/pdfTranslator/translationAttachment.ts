/* Zotero placement and discovery. Filesystem inspection and all publication
 * decisions live in translationOutputs, shared by both translation entry points. */

declare const Zotero: any;
type ZItem = Zotero.Item;
export type TranslationOutputKind = "mono" | "dual";
export const TRANSLATION_TAG = "AIdea Translation";

export function fileBaseName(path: string): string {
  return path.split(/[\\/]/).pop() || "";
}

export function isPdfAttachment(item: ZItem): boolean {
  if (!item || item.deleted || !item.isAttachment?.()) return false;
  return typeof item.isPDFAttachment === "function"
    ? item.isPDFAttachment()
    : /\.pdf$/i.test(item.attachmentFilename || "");
}

function childAttachments(parent: ZItem): ZItem[] {
  return (parent.getAttachments?.() || [])
    .map((id) => Zotero.Items.get(id))
    .filter(isPdfAttachment);
}

export function findPdfAttachment(item: ZItem): ZItem | null {
  if (!item || item.deleted) return null;
  if (item.isAttachment?.()) return isPdfAttachment(item) ? item : null;
  return item.isRegularItem?.() ? childAttachments(item)[0] || null : null;
}

export interface SourcePdf {
  attachment: ZItem;
  pdfPath: string;
}

export async function resolveSourcePdf(item: ZItem): Promise<SourcePdf | null> {
  if (!item || item.deleted) return null;
  const candidates: ZItem[] = [];
  if (item.isAttachment?.()) candidates.push(item);
  else if (item.isRegularItem?.()) {
    try {
      const best = await item.getBestAttachment();
      if (best) candidates.push(best);
    } catch {
      /* Best attachment unavailable: check the other children. */
    }
    candidates.push(...childAttachments(item));
  }
  for (const attachment of new Set(candidates)) {
    if (!isPdfAttachment(attachment)) continue;
    try {
      const pdfPath = await attachment.getFilePathAsync();
      if (pdfPath) return { attachment, pdfPath };
    } catch {
      /* A different child may have a local copy. */
    }
  }
  return null;
}

/** Match the complete engine name, not a prefix or an incidental 'mono'. */
export function matchTranslationOutput(
  filename: string,
  sourceFilename: string,
  targetLang: string,
): TranslationOutputKind | null {
  const stem = fileBaseName(sourceFilename).replace(/\.pdf$/i, "");
  const name = fileBaseName(filename);
  if (!stem || !name.startsWith(`${stem}.`)) return null;
  const rest = name.slice(stem.length).toLowerCase();
  for (const kind of ["mono", "dual"] as const) {
    const suffix = `.${targetLang.toLowerCase()}.${kind}.pdf`;
    if (rest === suffix || rest === `.no_watermark${suffix}`) return kind;
  }
  return null;
}

export interface DeliveryTarget {
  attach: boolean;
  saveDir: string;
}

function parentID(item: ZItem): number | undefined {
  return item.parentItemID || undefined;
}

/** Top-level items have no sibling list. Discover managed names directly in
 * the library, including after a crash immediately following the Zotero import.
 * Legacy top-level outputs may ONLY be attributed via a source relation. */
export async function translationCandidates(
  source: ZItem,
  targetLang: string,
  kinds: TranslationOutputKind[],
  managedName: (kind: TranslationOutputKind) => string,
): Promise<Partial<Record<TranslationOutputKind, ZItem>>> {
  const parent = parentID(source);
  let candidates: ZItem[];
  if (parent) {
    const item = await Zotero.Items.getAsync(parent);
    if (!item || item.deleted || item.libraryID !== source.libraryID)
      throw new Error("Source attachment parent is unavailable");
    candidates = await Zotero.Items.getAsync(item.getAttachments());
  } else {
    const related = await Promise.all(
      (source.relatedItems || []).map((key) =>
        Zotero.Items.getByLibraryAndKeyAsync(source.libraryID, key),
      ),
    );
    // A stored path is 'storage:<leaf>'; a linked path is absolute or
    // 'attachments:<relative>'. Filter managed leaves before loading items.
    const patterns = kinds.flatMap((kind) => {
      const name = managedName(kind);
      return [`storage:${name}`, `attachments:${name}`, `%/${name}`];
    });
    const ids: number[] = await Zotero.DB.columnQueryAsync(
      `SELECT itemID FROM itemAttachments JOIN items USING (itemID)
       WHERE libraryID=? AND parentItemID IS NULL AND (${patterns.map(() => "REPLACE(path, CHAR(92), '/') LIKE ?").join(" OR ")})`,
      [source.libraryID, ...patterns],
    );
    candidates = [...related, ...(await Zotero.Items.getAsync(ids))];
  }
  candidates = candidates.filter(
    (item) =>
      isPdfAttachment(item) &&
      item.id !== source.id &&
      item.libraryID === source.libraryID &&
      parentID(item) === parent,
  );
  function unambiguousLegacy(
    item: ZItem,
    kind: TranslationOutputKind,
  ): boolean {
    const name = item.attachmentFilename;
    if (
      /^AIdea-(attachment|folder)-/i.test(name) ||
      matchTranslationOutput(name, source.attachmentFilename, targetLang) !==
        kind
    )
      return false;
    // Both duplicate stems and a source actually named foo.no_watermark.pdf
    // could have produced this legacy name. Do not claim it for either one.
    return !candidates.some(
      (other) =>
        other.id !== item.id &&
        matchTranslationOutput(name, other.attachmentFilename, targetLang) ===
          kind,
    );
  }
  const found: Partial<Record<TranslationOutputKind, ZItem>> = {};
  for (const kind of kinds) {
    const matches = candidates.filter(
      (sibling) =>
        sibling.attachmentFilename === managedName(kind) ||
        unambiguousLegacy(sibling, kind),
    );
    if (new Set(matches.map((item) => item.id)).size > 1)
      throw new Error(
        `Multiple ${kind} translations match ${source.attachmentFilename}; resolve the duplicate attachments first`,
      );
    if (matches[0]) found[kind] = matches[0];
  }
  return found;
}

export function canLinkBeside(source: ZItem): boolean {
  return (
    source.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_FILE &&
    Zotero.Libraries.get(source.libraryID).allowsLinkedFiles === true
  );
}

export function checkAttachmentWritable(source: ZItem): void {
  const library = Zotero.Libraries.get(source.libraryID);
  if (!library?.editable || !library.filesEditable)
    throw new Error(
      `Library ${source.libraryID} is not writable for attachments`,
    );
}

/** The source file and its metadata are never modified. The managed filename
 * is enough to rediscover even a top-level item before its optional tag saves. */
export async function createTranslationAttachment(
  source: ZItem,
  file: string,
  name: string,
  linked: boolean,
): Promise<ZItem> {
  const parentItemID = parentID(source);
  const placement = parentItemID
    ? { parentItemID }
    : { libraryID: source.libraryID, collections: source.getCollections() };
  const options = {
    file,
    title: `${source.attachmentFilename.replace(/\.pdf$/i, "")}.${name.split(".").slice(-3).join(".")}`,
    contentType: "application/pdf",
    ...placement,
  };
  const item: ZItem = linked
    ? await Zotero.Attachments.linkFromFile(options)
    : await Zotero.Attachments.importFromFile({
        ...options,
        fileBaseName: name.slice(0, -4),
      });
  try {
    item.addTag(TRANSLATION_TAG);
    item.addRelatedItem(source);
    await item.saveTx();
  } catch (error) {
    Zotero.logError(error);
  }
  return item;
}

export function pickAttachmentToOpen(
  items: (ZItem | false | undefined)[],
): ZItem | null {
  const live = items.filter((item): item is ZItem => !!item && !item.deleted);
  return (
    live.find((item) => /\.mono\.pdf$/i.test(item.attachmentFilename)) ||
    live[0] ||
    null
  );
}
