import { getZoteroItem } from "../../../../utils/zoteroItems";

export function getDocumentTitle(item: Zotero.Item): string {
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

export function getAttachmentContentType(item: Zotero.Item): string {
  return String(item.attachmentContentType || "")
    .trim()
    .toLowerCase();
}

/**
 * Return a cheap revision for an attachment's current file. Zotero exposes the
 * file modification time directly, so cache validation does not need to hash a
 * potentially large document on every chat turn.
 */
export async function getAttachmentSourceRevision(
  item: Zotero.Item,
): Promise<string | undefined> {
  if (!item?.isAttachment?.()) return undefined;
  let modificationTime: number | undefined;
  try {
    modificationTime = await item.attachmentModificationTime;
  } catch (error) {
    ztoolkit.log("LLM: attachment revision lookup failed", error);
  }
  const itemVersion = Number.isFinite(item.version) ? item.version : 0;
  return [
    `item:${item.id}`,
    `version:${itemVersion}`,
    `mtime:${modificationTime ?? "unknown"}`,
    `type:${getAttachmentContentType(item)}`,
  ].join("|");
}
