import {
  SUPPLEMENTAL_PAPER_CONTEXT_MAX_CHUNKS,
  SUPPLEMENTAL_PAPER_CONTEXT_MAX_LENGTH,
  SUPPLEMENTAL_PAPER_CONTEXT_TOTAL_MAX_LENGTH,
} from "./constants";
import { getZoteroItem } from "../../utils/zoteroItems";
import { ensurePDFTextCached, buildContext } from "./pdfContext";
import { pdfTextCache } from "./state";
import type { PaperContextRef } from "./types";

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function getFirstPdfChildAttachment(
  item: Zotero.Item | null | undefined,
): Zotero.Item | null {
  if (!item || item.isAttachment()) return null;
  const attachments = item.getAttachments();
  for (const attachmentId of attachments) {
    const attachment = getZoteroItem(attachmentId);
    if (
      attachment &&
      attachment.isAttachment() &&
      attachment.attachmentContentType === "application/pdf"
    ) {
      return attachment;
    }
  }
  return null;
}

function resolveContextItem(ref: PaperContextRef): Zotero.Item | null {
  const direct = getZoteroItem(ref.contextItemId);
  if (
    direct &&
    direct.isAttachment() &&
    direct.attachmentContentType === "application/pdf"
  ) {
    return direct;
  }
  const item = getZoteroItem(ref.itemId);
  return getFirstPdfChildAttachment(item);
}

function formatMetadataLabel(ref: PaperContextRef, index: number): string {
  const title = normalizeText(ref.title) || `Item ${ref.itemId}`;
  const parts = [`Title: ${title}`];
  const citationKey = normalizeText(ref.citationKey);
  if (citationKey) parts.push(`Citation key: ${citationKey}`);
  const firstCreator = normalizeText(ref.firstCreator);
  if (firstCreator) parts.push(`Author: ${firstCreator}`);
  const year = normalizeText(ref.year);
  if (year) parts.push(`Year: ${year}`);
  return `Supplemental Paper ${index + 1}\n${parts.join("\n")}`;
}

/**
 * Build context for a single supplemental paper.
 * Returns a formatted block with metadata + extracted PDF content.
 */
export async function buildSinglePaperContext(
  ref: PaperContextRef,
  question: string,
  index: number,
  apiOverrides?: { apiBase?: string; apiKey?: string },
): Promise<string> {
  const metadataLabel = formatMetadataLabel(ref, index);
  try {
    const contextItem = resolveContextItem(ref);
    if (contextItem) {
      await ensurePDFTextCached(contextItem);
    }
    const paperContext = contextItem
      ? await buildContext(
          pdfTextCache.get(contextItem.id),
          question,
          false,
          apiOverrides,
          {
            forceRetrieval: true,
            maxChunks: SUPPLEMENTAL_PAPER_CONTEXT_MAX_CHUNKS,
            maxLength: SUPPLEMENTAL_PAPER_CONTEXT_MAX_LENGTH,
          },
        )
      : "";
    if (paperContext.trim()) {
      return `${metadataLabel}\n\n${paperContext.trim()}`;
    }
    return `${metadataLabel}\n\n[No extractable PDF text available. Using metadata only.]`;
  } catch (err) {
    ztoolkit.log("LLM: Failed to build supplemental paper context", err);
    return `${metadataLabel}\n\n[Failed to build context. Using metadata only.]`;
  }
}

export async function buildSupplementalPaperContext(
  paperContexts: PaperContextRef[] | undefined,
  question: string,
  apiOverrides?: { apiBase?: string; apiKey?: string },
): Promise<string> {
  if (!Array.isArray(paperContexts) || !paperContexts.length) return "";
  const deduped: PaperContextRef[] = [];
  const seen = new Set<string>();
  for (const ref of paperContexts) {
    if (!ref || typeof ref !== "object") continue;
    const itemId = Number(ref.itemId);
    const contextItemId = Number(ref.contextItemId);
    if (!Number.isFinite(itemId) || !Number.isFinite(contextItemId)) continue;
    const normalized = {
      itemId: Math.floor(itemId),
      contextItemId: Math.floor(contextItemId),
      title: normalizeText(ref.title) || `Item ${Math.floor(itemId)}`,
      citationKey: normalizeText(ref.citationKey) || undefined,
      firstCreator: normalizeText(ref.firstCreator) || undefined,
      year: normalizeText(ref.year) || undefined,
    };
    if (normalized.itemId <= 0 || normalized.contextItemId <= 0) continue;
    const key = `${normalized.itemId}:${normalized.contextItemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }
  if (!deduped.length) return "";

  const blocks: string[] = [];
  let remaining = SUPPLEMENTAL_PAPER_CONTEXT_TOTAL_MAX_LENGTH;
  for (const [index, ref] of deduped.entries()) {
    if (remaining <= 0) break;
    const block = await buildSinglePaperContext(
      ref,
      question,
      index,
      apiOverrides,
    );
    if (!block) continue;
    if (block.length > remaining) {
      blocks.push(block.slice(0, Math.max(0, remaining)));
      break;
    }
    blocks.push(block);
    remaining -= block.length;
  }
  if (!blocks.length) return "";
  return `Supplemental Paper Contexts:\n\n${blocks.join("\n\n---\n\n")}`;
}
