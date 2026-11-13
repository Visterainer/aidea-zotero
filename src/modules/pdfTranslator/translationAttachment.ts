/* ---------------------------------------------------------------------------
 * pdfTranslator/translationAttachment.ts  –  Translated PDFs as attachments
 *
 * Finds the PDF attachment to translate for a library item, and files the
 * engine's output next to it: a stored attachment under the same parent for
 * stored sources, a linked file in the same directory for linked sources.
 * An attachment that already holds the same translation is updated in place
 * instead of being duplicated.
 * -------------------------------------------------------------------------*/

declare const Zotero: any;

type ZItem = any; /* Zotero.Item */

export type TranslationOutputKind = "mono" | "dual";

function fileBaseName(path: string): string {
  return String(path).split(/[\\/]/).pop() || "";
}

function fileStem(path: string): string {
  return fileBaseName(path).replace(/\.pdf$/i, "");
}

export function isPdfAttachment(item: ZItem): boolean {
  if (!item?.isAttachment?.()) return false;
  try {
    if (typeof item.isPDFAttachment === "function") {
      return Boolean(item.isPDFAttachment());
    }
  } catch {
    /* fall through to the filename check */
  }
  return /\.pdf$/i.test(String(item.attachmentFilename || ""));
}

function childAttachments(parent: ZItem): ZItem[] {
  let ids: number[];
  try {
    ids = parent?.getAttachments?.() || [];
  } catch {
    return [];
  }
  const out: ZItem[] = [];
  for (const id of ids) {
    const child = Zotero.Items.get(id);
    if (child && !child.deleted) out.push(child);
  }
  return out;
}

/**
 * Synchronous check used while a context menu opens: the PDF attachment this
 * item would be translated from, or null.
 */
export function findPdfAttachment(item: ZItem): ZItem | null {
  if (!item) return null;
  if (item.isAttachment?.()) return isPdfAttachment(item) ? item : null;
  if (!item.isRegularItem?.()) return null;
  return childAttachments(item).find(isPdfAttachment) || null;
}

export interface SourcePdf {
  attachment: ZItem;
  pdfPath: string;
}

/**
 * Resolve the PDF attachment to translate and its file on disk. For a regular
 * item Zotero's "best attachment" wins when it is a PDF, so the original is
 * preferred over a translation added later.
 */
export async function resolveSourcePdf(item: ZItem): Promise<SourcePdf | null> {
  if (!item) return null;
  const candidates: ZItem[] = [];
  if (item.isAttachment?.()) {
    candidates.push(item);
  } else if (item.isRegularItem?.()) {
    try {
      const best = await item.getBestAttachment?.();
      if (best) candidates.push(best);
    } catch {
      /* fall back to the child list */
    }
    candidates.push(...childAttachments(item));
  }
  for (const attachment of candidates) {
    if (!isPdfAttachment(attachment)) continue;
    let pdfPath: string;
    try {
      pdfPath = String((await attachment.getFilePathAsync?.()) || "");
    } catch {
      continue;
    }
    if (pdfPath) return { attachment, pdfPath };
  }
  return null;
}

/**
 * A top-level PDF has no parent to collect its translations under, so they
 * are linked to it as related items when they are created.
 */
function relatedPdfAttachments(source: ZItem): ZItem[] {
  let keys: string[];
  try {
    keys = source?.relatedItems || [];
  } catch {
    return [];
  }
  const out: ZItem[] = [];
  for (const key of keys) {
    let related: ZItem | false | null = null;
    try {
      related = Zotero.Items.getByLibraryAndKey(source.libraryID, key);
    } catch {
      /* skip an unreadable relation */
    }
    if (
      related &&
      !related.deleted &&
      related.id !== source.id &&
      isPdfAttachment(related)
    ) {
      out.push(related);
    }
  }
  return out;
}

async function relateToSource(item: ZItem, source: ZItem): Promise<void> {
  try {
    if (item.addRelatedItem?.(source)) await item.saveTx();
    if (source.addRelatedItem?.(item)) await source.saveTx();
  } catch {
    /* the translation is in place; only duplicate detection is affected */
  }
}

/**
 * Other live PDF attachments that belong with `source`: its siblings under
 * the same parent, or its related items when it has no parent.
 */
function siblingAttachments(source: ZItem): ZItem[] {
  const parentID = source?.parentItemID || source?.parentID;
  if (!parentID) return relatedPdfAttachments(source);
  const parent = Zotero.Items.get(parentID);
  if (!parent) return [];
  return childAttachments(parent).filter(
    (child) => child.id !== source.id && isPdfAttachment(child),
  );
}

/**
 * The engine names its output `<source stem>[.no_watermark].<lang>.<kind>.pdf`.
 * Returns the kind when `filename` is such an output for this source and
 * target language, otherwise null.
 */
export function matchTranslationOutput(
  filename: string,
  sourceFilename: string,
  targetLang: string,
): TranslationOutputKind | null {
  const stem = fileStem(sourceFilename);
  const name = fileBaseName(filename);
  if (!stem || !name.startsWith(`${stem}.`)) return null;
  const rest = name.slice(stem.length).toLowerCase();
  const lang = targetLang.toLowerCase();
  for (const kind of ["mono", "dual"] as const) {
    if (rest.endsWith(`.${lang}.${kind}.pdf`)) return kind;
  }
  return null;
}

/**
 * Translations of `source` into `targetLang` that already sit under the same
 * parent item, by kind.
 */
export function findExistingTranslations(
  source: ZItem,
  targetLang: string,
): Partial<Record<TranslationOutputKind, ZItem>> {
  const sourceName = String(source?.attachmentFilename || "");
  const found: Partial<Record<TranslationOutputKind, ZItem>> = {};
  if (!sourceName) return found;
  for (const sibling of siblingAttachments(source)) {
    const kind = matchTranslationOutput(
      String(sibling.attachmentFilename || ""),
      sourceName,
      targetLang,
    );
    if (kind && !found[kind]) found[kind] = sibling;
  }
  return found;
}

function isLinkedFile(item: ZItem): boolean {
  return item?.attachmentLinkMode === Zotero.Attachments.LINK_MODE_LINKED_FILE;
}

function attachmentPath(item: ZItem): string {
  try {
    return String(item.getFilePath?.() || "");
  } catch {
    return "";
  }
}

export interface AttachResult {
  /** One attachment per output file, in the order given. */
  items: ZItem[];
  created: number;
  updated: number;
}

/**
 * File the translated PDFs next to `source`.
 *
 * - An existing sibling attachment with the same filename has its file
 *   replaced, so translating again never adds a second copy.
 * - Otherwise a linked source gets the PDF copied into its directory and
 *   linked; any other source gets a stored copy under the same parent (or as
 *   a top-level item in the same collections when the source has no parent).
 */
export async function attachTranslatedPdfs(
  source: ZItem,
  files: string[],
): Promise<AttachResult> {
  const result: AttachResult = { items: [], created: 0, updated: 0 };
  const parentItemID: number | undefined =
    source.parentItemID || source.parentID || undefined;
  const placement = parentItemID
    ? { parentItemID }
    : { collections: source.getCollections?.() || [] };
  const siblings = siblingAttachments(source);
  const sourcePath = attachmentPath(source);

  for (const file of files) {
    const name = fileBaseName(file);
    if (!name) continue;

    const existing = siblings.find(
      (sibling) => String(sibling.attachmentFilename || "") === name,
    );
    const existingPath = existing ? attachmentPath(existing) : "";
    if (existing && existingPath) {
      if (existingPath !== file) await IOUtils.copy(file, existingPath);
      result.items.push(existing);
      result.updated += 1;
      continue;
    }

    let item: ZItem;
    const sourceDir = sourcePath ? PathUtils.parent(sourcePath) : null;
    if (isLinkedFile(source) && sourceDir) {
      const target = PathUtils.join(sourceDir, name);
      if (target !== file) await IOUtils.copy(file, target);
      item = await Zotero.Attachments.linkFromFile({
        file: target,
        title: name,
        ...placement,
      });
    } else {
      item = await Zotero.Attachments.importFromFile({
        file,
        title: name,
        ...(parentItemID ? {} : { libraryID: source.libraryID }),
        ...placement,
      });
    }
    if (!parentItemID) await relateToSource(item, source);
    result.items.push(item);
    result.created += 1;
  }
  return result;
}

/** Tag put on every translated PDF so they can be found (and removed) together. */
export const TRANSLATION_TAG = "AIdea Translation";

export interface DeliveryTarget {
  /** Add the PDFs to the source's Zotero item. */
  attach: boolean;
  /** Also copy them into this folder; "" for none. */
  saveDir: string;
}

export interface DeliveryResult {
  /** Attachments created or updated; empty when nothing was attached. */
  items: ZItem[];
  /** Copies written to the folder. */
  savedFiles: string[];
}

/**
 * Put finished translations where the user asked for them: on the Zotero
 * item, in a folder, or both. With neither chosen they are attached, so a
 * finished translation is never thrown away.
 */
export async function deliverTranslatedPdfs(
  source: ZItem,
  files: string[],
  target: DeliveryTarget,
): Promise<DeliveryResult> {
  const saveDir = String(target.saveDir || "").trim();
  const result: DeliveryResult = { items: [], savedFiles: [] };
  // The folder copy comes first: it cannot be affected by a Zotero error.
  if (saveDir) {
    await IOUtils.makeDirectory(saveDir, { createAncestors: true });
    for (const file of files) {
      const name = fileBaseName(file);
      if (!name) continue;
      const destination = PathUtils.join(saveDir, name);
      if (destination !== file) await IOUtils.copy(file, destination);
      result.savedFiles.push(destination);
    }
  }
  if (target.attach || !saveDir) {
    const attached = await attachTranslatedPdfs(source, files);
    result.items = attached.items;
    for (const item of attached.items) {
      try {
        if (!item.hasTag?.(TRANSLATION_TAG)) {
          item.addTag(TRANSLATION_TAG);
          await item.saveTx();
        }
      } catch {
        /* the attachment is in place; the tag is a convenience */
      }
    }
  }
  return result;
}

/** Prefer the translated-only PDF when both kinds were produced. */
export function pickAttachmentToOpen(items: ZItem[]): ZItem | null {
  return (
    items.find((item) =>
      /\.mono\.pdf$/i.test(String(item?.attachmentFilename || "")),
    ) ||
    items[0] ||
    null
  );
}
