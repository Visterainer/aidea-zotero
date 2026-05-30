import { normalizePaperContextRefs } from "../../normalizers";
import { sanitizeText } from "../../textUtils";
import { resolvePaperContextDisplayMetadata as resolvePaperContextDisplayMetadataShared } from "../../paperAttribution";
import type { PaperContextRef } from "../../types";

export function normalizePaperContextEntries(
  value: unknown,
): PaperContextRef[] {
  return normalizePaperContextRefs(value, { sanitizeText });
}

export function resolvePaperContextDisplayMetadata(
  paperContext: PaperContextRef,
): {
  firstCreator?: string;
  year?: string;
} {
  return resolvePaperContextDisplayMetadataShared(paperContext);
}

function extractFirstAuthorLastName(paperContext: PaperContextRef): string {
  const metadata = resolvePaperContextDisplayMetadata(paperContext);
  let creator = sanitizeText(metadata.firstCreator || "").trim();
  if (!creator) return "Paper";
  creator = creator
    .replace(/\s+et\s+al\.?$/i, "")
    .replace(/\s+al\.?$/i, "")
    .replace(/[;,.]+$/g, "")
    .trim();
  if (!creator) return "Paper";
  const primaryAuthor =
    creator.split(/\s+(?:and|&)\s+/i).find((part) => part.trim()) || creator;
  const normalizedPrimary = primaryAuthor.replace(/[;,.]+$/g, "").trim();
  if (!normalizedPrimary) return "Paper";
  if (normalizedPrimary.includes(",")) {
    const commaSeparated = normalizedPrimary.split(",")[0]?.trim();
    if (commaSeparated) return commaSeparated;
  }
  const parts = normalizedPrimary.split(/\s+/g).filter(Boolean);
  if (!parts.length) return "Paper";
  if (parts.length === 1) return parts[0];
  const trailingToken = parts[parts.length - 1];
  if (/^[A-Z](?:\.[A-Z])?\.?$/i.test(trailingToken)) {
    return parts[parts.length - 2] || parts[0];
  }
  return trailingToken;
}

function extractPaperYear(paperContext: PaperContextRef): string | null {
  return resolvePaperContextDisplayMetadata(paperContext).year || null;
}

function getZoteroItem(itemId: number): Zotero.Item | null {
  try {
    if (
      typeof Zotero === "undefined" ||
      typeof Zotero.Items?.get !== "function"
    ) {
      return null;
    }
    return Zotero.Items.get(itemId) || null;
  } catch {
    return null;
  }
}

function resolvePaperContextAttachmentItem(
  paperContext: PaperContextRef,
): Zotero.Item | null {
  const attachment = getZoteroItem(paperContext.contextItemId);
  if (!attachment?.isAttachment?.()) return null;
  return attachment;
}

function resolvePaperContextParentItem(
  paperContext: PaperContextRef,
): Zotero.Item | null {
  const item = getZoteroItem(paperContext.itemId);
  if (item?.isRegularItem?.()) return item;
  const contextAttachment = resolvePaperContextAttachmentItem(paperContext);
  if (contextAttachment?.parentID) {
    const parent = getZoteroItem(contextAttachment.parentID);
    if (parent?.isRegularItem?.()) return parent;
  }
  return null;
}

function resolveMultiPdfAttachmentTitle(paperContext: PaperContextRef): string {
  const parentItem = resolvePaperContextParentItem(paperContext);
  if (!parentItem) return "";
  const attachmentIds = parentItem.getAttachments?.() || [];
  let pdfCount = 0;
  for (const attachmentId of attachmentIds) {
    const attachment = getZoteroItem(attachmentId);
    if (
      attachment?.isAttachment?.() &&
      attachment.attachmentContentType === "application/pdf"
    ) {
      pdfCount += 1;
    }
  }
  if (pdfCount <= 1) return "";
  const contextAttachment = resolvePaperContextAttachmentItem(paperContext);
  if (!contextAttachment) return "";
  return sanitizeText(String(contextAttachment.getField("title") || ""))
    .replace(/\s+/g, " ")
    .trim();
}

export function formatPaperContextChipLabel(
  paperContext: PaperContextRef,
): string {
  const base = paperContext.title ? `📝 ${paperContext.title}` : "📝 Paper";
  const attachmentTitle = resolveMultiPdfAttachmentTitle(paperContext);
  return attachmentTitle && attachmentTitle !== paperContext.title
    ? `${base} - ${attachmentTitle}`
    : base;
}

export function formatPaperContextChipTitle(
  paperContext: PaperContextRef,
): string {
  const metadata = resolvePaperContextDisplayMetadata(paperContext);
  const meta = [metadata.firstCreator || "", metadata.year || ""]
    .filter(Boolean)
    .join(" · ");
  const attachmentTitle = resolveMultiPdfAttachmentTitle(paperContext);
  return [
    paperContext.title,
    meta,
    attachmentTitle ? `Attachment: ${attachmentTitle}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
