import type { PaperContextRef } from "./types";
import { getZoteroItem } from "../../utils/zoteroItems";

export type PaperSearchAttachmentCandidate = {
  contextItemId: number;
  title: string;
  score: number;
};

export type PaperSearchGroupCandidate = Omit<
  PaperContextRef,
  "contextItemId"
> & {
  attachments: PaperSearchAttachmentCandidate[];
  score: number;
  modifiedAt: number;
};

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeSearchToken(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      // eslint-disable-next-line no-control-regex -- strips unsafe search characters
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/[\p{P}\p{S}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function normalizeSearchCompact(value: string): string {
  return normalizeSearchToken(value).replace(/\s+/g, "");
}

function buildSearchText(values: unknown[]): string {
  return values
    .map((value) => normalizeSearchToken(normalizeText(value)))
    .filter(Boolean)
    .join(" ");
}

function buildCompactSearchText(values: unknown[]): string {
  return normalizeSearchCompact(buildSearchText(values));
}

/** Split search query into tokens; handles CJK/Kana/Hangul by splitting chars. */
function splitSearchTokens(query: string): string[] {
  const trimmed = normalizeSearchToken(query);
  if (!trimmed) return [];
  const rawTokens = trimmed.split(/\s+/g).filter(Boolean);
  const tokens: string[] = [];
  for (const token of rawTokens) {
    const parts = token.match(
      /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]|[^\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g,
    );
    if (parts) {
      tokens.push(...parts.filter(Boolean));
    } else {
      tokens.push(token);
    }
  }
  return tokens;
}

function extractYear(value: string): string | undefined {
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match?.[0];
}

function toModifiedTimestamp(value: unknown): number {
  const text = normalizeText(value);
  if (!text) return 0;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPdfAttachment(item: Zotero.Item | null | undefined): boolean {
  return Boolean(
    item &&
    item.isAttachment?.() &&
    item.attachmentContentType === "application/pdf",
  );
}

function getFieldText(item: Zotero.Item, field: string): string {
  try {
    return normalizeText(item.getField(field));
  } catch (_err) {
    return "";
  }
}

function getPdfChildAttachments(item: Zotero.Item): Zotero.Item[] {
  const out: Zotero.Item[] = [];
  if (!item?.isRegularItem?.()) return out;
  const attachments = item.getAttachments();
  for (const attachmentId of attachments) {
    const attachment = getZoteroItem(attachmentId);
    if (attachment && isPdfAttachment(attachment)) {
      out.push(attachment);
    }
  }
  return out;
}

function resolveAttachmentFilename(attachment: Zotero.Item): string {
  return normalizeText(
    (attachment as unknown as { attachmentFilename?: string })
      .attachmentFilename || "",
  );
}

function resolveAttachmentTitle(
  attachment: Zotero.Item,
  index: number,
  total: number,
): string {
  const title = getFieldText(attachment, "title");
  if (title) return title;
  const filename = resolveAttachmentFilename(attachment);
  if (filename) return filename;
  if (total > 1) return `PDF ${index + 1}`;
  return "PDF";
}

function buildAttachmentCandidates(
  attachments: Zotero.Item[],
): PaperSearchAttachmentCandidate[] {
  return attachments.map((attachment, index) => ({
    contextItemId: attachment.id,
    title: resolveAttachmentTitle(attachment, index, attachments.length),
    score: 0,
  }));
}

function buildGroupCandidate(
  item: Zotero.Item,
  attachments: Zotero.Item[],
): PaperSearchGroupCandidate | null {
  if (!attachments.length) return null;
  const title = getFieldText(item, "title") || `Item ${item.id}`;
  const citationKey = getFieldText(item, "citationKey") || undefined;
  const firstCreator =
    normalizeText(item.firstCreator) ||
    getFieldText(item, "firstCreator") ||
    undefined;
  const year =
    extractYear(getFieldText(item, "year")) ||
    extractYear(getFieldText(item, "date")) ||
    undefined;
  return {
    itemId: item.id,
    citationKey,
    title,
    firstCreator,
    year,
    attachments: buildAttachmentCandidates(attachments),
    score: 0,
    modifiedAt: toModifiedTimestamp(item.dateModified),
  };
}

function buildStandaloneAttachmentCandidate(
  attachment: Zotero.Item,
): PaperSearchGroupCandidate | null {
  if (!isPdfAttachment(attachment)) return null;
  const title =
    getFieldText(attachment, "title") ||
    resolveAttachmentFilename(attachment) ||
    `PDF ${attachment.id}`;
  const firstCreator =
    normalizeText(attachment.firstCreator) ||
    getFieldText(attachment, "firstCreator") ||
    undefined;
  const year =
    extractYear(getFieldText(attachment, "year")) ||
    extractYear(getFieldText(attachment, "date")) ||
    undefined;
  return {
    itemId: attachment.id,
    title,
    firstCreator,
    year,
    attachments: [
      {
        contextItemId: attachment.id,
        title,
        score: 0,
      },
    ],
    score: 0,
    modifiedAt: toModifiedTimestamp(attachment.dateModified),
  };
}

function scoreSearchFields(params: {
  normalizedQuery: string;
  compactQuery: string;
  queryTokens: string[];
  fields: unknown[];
  exactPrefixScore: number;
  containsScore: number;
  tokenScore: number;
}): number {
  const searchText = buildSearchText(params.fields);
  const compactSearchText = buildCompactSearchText(params.fields);
  if (!searchText) return 0;
  let score = 0;
  if (searchText.startsWith(params.normalizedQuery)) {
    score += params.exactPrefixScore;
  } else if (
    searchText.includes(params.normalizedQuery) ||
    (params.compactQuery && compactSearchText.includes(params.compactQuery))
  ) {
    score += params.containsScore;
  }
  if (params.queryTokens.length) {
    const tokenMatches = params.queryTokens.reduce((count, token) => {
      return count + (searchText.includes(token) ? 1 : 0);
    }, 0);
    score += tokenMatches * params.tokenScore;
  }
  return score;
}

function scorePaperMetadata(
  candidate: Pick<
    PaperContextRef,
    "citationKey" | "title" | "firstCreator" | "year"
  >,
  query: string,
): number {
  const normalizedQuery = normalizeSearchToken(query);
  if (!normalizedQuery) return 0;
  const compactQuery = normalizeSearchCompact(normalizedQuery);
  const queryTokens = splitSearchTokens(normalizedQuery);
  const citationKey = normalizeSearchToken(candidate.citationKey || "");
  const year = normalizeSearchToken(candidate.year || "");

  let score = 0;
  if (citationKey && citationKey.startsWith(normalizedQuery)) {
    score += 1200;
  } else if (citationKey && citationKey.includes(normalizedQuery)) {
    score += 1000;
  }
  score += scoreSearchFields({
    normalizedQuery,
    compactQuery,
    queryTokens,
    fields: [candidate.title, candidate.firstCreator, candidate.year],
    exactPrefixScore: 780,
    containsScore: 700,
    tokenScore: 80,
  });
  if (year && (year === normalizedQuery || year.includes(normalizedQuery))) {
    score += 300;
  }

  return score;
}

function scoreAttachmentTitle(title: string, query: string): number {
  const normalizedQuery = normalizeSearchToken(query);
  if (!normalizedQuery) return 0;
  return scoreSearchFields({
    normalizedQuery,
    compactQuery: normalizeSearchCompact(normalizedQuery),
    queryTokens: splitSearchTokens(normalizedQuery),
    fields: [title],
    exactPrefixScore: 640,
    containsScore: 560,
    tokenScore: 60,
  });
}

function updateCandidateScore(
  candidate: PaperSearchGroupCandidate,
  normalizedQuery: string,
): void {
  const paperScore = normalizedQuery
    ? scorePaperMetadata(candidate, normalizedQuery)
    : 0;
  for (const attachment of candidate.attachments) {
    attachment.score = normalizedQuery
      ? scoreAttachmentTitle(attachment.title, normalizedQuery)
      : 0;
  }
  const bestAttachmentScore = candidate.attachments.reduce(
    (maxScore, attachment) => Math.max(maxScore, attachment.score),
    0,
  );
  candidate.score = Math.max(paperScore, bestAttachmentScore);
  candidate.attachments.sort((a, b) => {
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) return scoreDelta;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

export async function searchPaperCandidates(
  libraryID: number,
  query: string,
  excludeContextItemId?: number | null,
  limit = 20,
): Promise<PaperSearchGroupCandidate[]> {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return [];
  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : 20;
  let items: Zotero.Item[];
  try {
    items = await Zotero.Items.getAll(libraryID, true, false, false);
  } catch (err) {
    ztoolkit.log("LLM: Failed to load library items for paper search", err);
    return [];
  }
  const excludeId =
    typeof excludeContextItemId === "number" &&
    Number.isFinite(excludeContextItemId) &&
    excludeContextItemId > 0
      ? Math.floor(excludeContextItemId)
      : null;
  const normalizedQuery = normalizeSearchToken(query);
  const candidates: PaperSearchGroupCandidate[] = [];

  for (const item of items) {
    if (isPdfAttachment(item)) {
      if (item.parentID || (excludeId && item.id === excludeId)) {
        continue;
      }
      const standalone = buildStandaloneAttachmentCandidate(item);
      if (!standalone) continue;
      updateCandidateScore(standalone, normalizedQuery);
      if (normalizedQuery && standalone.score <= 0) continue;
      candidates.push(standalone);
      continue;
    }

    if (!item?.isRegularItem?.()) continue;
    const contextAttachments = getPdfChildAttachments(item).filter(
      (attachment) => !excludeId || attachment.id !== excludeId,
    );
    if (!contextAttachments.length) continue;
    const candidate = buildGroupCandidate(item, contextAttachments);
    if (!candidate) continue;
    updateCandidateScore(candidate, normalizedQuery);
    if (normalizedQuery && candidate.score <= 0) continue;
    candidates.push(candidate);
  }

  candidates.sort((a, b) => {
    const scoreDelta = b.score - a.score;
    if (scoreDelta !== 0) return scoreDelta;
    return b.modifiedAt - a.modifiedAt;
  });
  return candidates.slice(0, normalizedLimit);
}

export const __paperSearchTest = {
  normalizeSearchToken,
  splitSearchTokens,
};
