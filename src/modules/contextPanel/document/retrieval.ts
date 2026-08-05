import { callEmbeddings } from "../../../utils/llmClient";
import {
  CHUNK_TARGET_LENGTH,
  CHUNK_OVERLAP,
  MAX_CONTEXT_CHUNKS,
  EMBEDDING_BATCH_SIZE,
  HYBRID_WEIGHT_BM25,
  HYBRID_WEIGHT_EMBEDDING,
  MAX_CONTEXT_LENGTH,
  MAX_CONTEXT_LENGTH_WITH_IMAGE,
  FORCE_FULL_CONTEXT,
  FULL_CONTEXT_CHAR_LIMIT,
  STOPWORDS,
} from "../constants";
import type { ChunkStat, DocumentTextContext } from "../types";
import type {
  DocumentCapabilities,
  DocumentChunkMetadata,
  DocumentCompleteness,
  DocumentKind,
  DocumentPresentation,
  DocumentSegment,
  DocumentStructure,
} from "./types";
import {
  buildDeterministicSectionPlan,
  buildSectionCatalog,
  resolveSectionRetrievalPlan,
  type SectionCoverage,
} from "./sectionRouting";

export type CreateDocumentTextContextOptions = {
  title: string;
  text: string;
  kind?: DocumentKind;
  capabilities?: DocumentCapabilities;
  completeness?: DocumentCompleteness;
  warnings?: string[];
  fingerprint?: string;
  sourceRevision?: string;
  presentation?: DocumentPresentation;
  sourceSegments?: DocumentSegment[];
  structure?: DocumentStructure;
};

export type BuildDocumentContextOptions = {
  /**
   * Compatibility flag retained for existing PDF callers. Historically this
   * was diagnostic-only; use contextStrategy for adapter policy.
   */
  forceRetrieval?: boolean;
  contextStrategy?: "full-or-retrieval" | "retrieval";
  useEmbeddings?: boolean;
  /** Prefer the chunk containing this source text before query scoring. */
  anchorText?: string;
  /** Reuse this structural scope for an ambiguous conversational follow-up. */
  preferredSegmentIds?: string[];
  /** Receives the structural scope that was actually emitted. */
  onRetrievedSegments?: (segmentIds: string[]) => void;
  /** Cancels context preparation and provider-backed embedding requests. */
  signal?: AbortSignal;
  maxChunks?: number;
  maxLength?: number;
};

const PLANNED_SECTION_PRIMARY_BUDGET_RATIO = 0.75;
const ANCHOR_MATCH_PREFIX_CHARS = 240;

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const error = new Error("Document context preparation was cancelled");
  error.name = "AbortError";
  throw error;
}

export function createDocumentTextContext(
  options: CreateDocumentTextContextOptions,
): DocumentTextContext {
  const sourceText = String(options.text || "");
  const structured = buildStructuredChunks(options.sourceSegments || []);
  const chunks = structured
    ? structured.chunks
    : sourceText
      ? splitIntoChunks(sourceText, CHUNK_TARGET_LENGTH)
      : [];
  const chunkMetadata = structured?.metadata;
  const { chunkStats, docFreq, avgChunkLength } = buildChunkIndex(
    chunks,
    chunkMetadata,
  );
  return {
    title: options.title,
    chunks,
    chunkStats,
    docFreq,
    avgChunkLength,
    fullLength: sourceText.length,
    embeddingFailed: false,
    documentKind: options.kind,
    documentCapabilities: options.capabilities,
    completeness: options.completeness,
    warnings: options.warnings,
    fingerprint: options.fingerprint,
    sourceRevision: options.sourceRevision,
    documentPresentation: options.presentation,
    chunkMetadata,
    documentStructure: options.structure,
  };
}

function splitIntoChunks(text: string, targetLength: number): string[] {
  if (!text) return [];
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const para of paragraphs) {
    const p = para.trim();
    if (!p) continue;
    if (p.length > targetLength) {
      pushCurrent();
      let start = 0;
      while (start < p.length) {
        const end = Math.min(start + targetLength, p.length);
        const slice = p.slice(start, end).trim();
        if (slice) chunks.push(slice);
        if (end === p.length) break;
        start = Math.max(0, end - CHUNK_OVERLAP);
      }
      continue;
    }
    if (current.length + p.length + 2 <= targetLength) {
      current = current ? `${current}\n\n${p}` : p;
    } else {
      pushCurrent();
      current = p;
    }
  }
  pushCurrent();
  return chunks;
}

function buildStructuredChunks(segments: DocumentSegment[]): {
  chunks: string[];
  metadata: DocumentChunkMetadata[];
} | null {
  const contentSegments = segments.filter(
    (segment) =>
      segment.role !== "navigation" && String(segment.text || "").trim(),
  );
  if (!contentSegments.length) return null;

  const chunks: string[] = [];
  const metadata: DocumentChunkMetadata[] = [];
  for (const segment of contentSegments) {
    const segmentChunks = splitIntoChunks(segment.text, CHUNK_TARGET_LENGTH);
    for (const chunk of segmentChunks) {
      chunks.push(chunk);
      metadata.push({
        segmentId: segment.id,
        title: segment.title,
        aliases: segment.aliases,
        headingPath: segment.headingPath,
        locator: segment.locator,
        order: segment.order,
        readingOrder: segment.readingOrder,
        tocPath: segment.tocPath,
        fragment: segment.fragment,
        endFragment: segment.endFragment,
        structureNodeId: segment.structureNodeId,
        semanticRoles: segment.semanticRoles,
        source: segment.source,
        confidence: segment.confidence,
        linear: segment.linear,
        spineIndex: segment.spineIndex,
        role: segment.role,
      });
    }
  }
  return chunks.length ? { chunks, metadata } : null;
}

export function tokenizeText(text: string): string[] {
  const englishTokens = text.toLowerCase().match(/[a-z0-9]+/g) || [];
  const cjkTokens =
    text.match(
      /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]|[\u3040-\u309f]+|[\u30a0-\u30ff]+|[\uac00-\ud7af]/g,
    ) || [];
  return [
    ...englishTokens.filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
    ...cjkTokens.filter((t) => !STOPWORDS.has(t)),
  ];
}

function buildChunkIndex(
  chunks: string[],
  metadata?: DocumentChunkMetadata[],
): {
  chunkStats: ChunkStat[];
  docFreq: Record<string, number>;
  avgChunkLength: number;
} {
  const docFreq: Record<string, number> = {};
  const chunkStats: ChunkStat[] = [];
  let totalLength = 0;

  chunks.forEach((chunk, index) => {
    const chunkMetadata = metadata?.[index];
    const headingText = Array.from(
      new Set(
        [chunkMetadata?.title, ...(chunkMetadata?.headingPath || [])].filter(
          (label): label is string => Boolean(label),
        ),
      ),
    ).join(" ");
    const tokens = tokenizeText(
      headingText ? `${headingText}\n${chunk}` : chunk,
    );
    const tf: Record<string, number> = {};
    for (const term of tokens) {
      tf[term] = (tf[term] || 0) + 1;
    }
    const uniqueTerms = Object.keys(tf);
    for (const term of uniqueTerms) {
      docFreq[term] = (docFreq[term] || 0) + 1;
    }
    const length = tokens.length;
    totalLength += length;
    chunkStats.push({ index, length, tf, uniqueTerms });
  });

  const avgChunkLength = chunks.length ? totalLength / chunks.length : 0;
  return { chunkStats, docFreq, avgChunkLength };
}

function tokenizeQuery(query: string): string[] {
  return Array.from(new Set(tokenizeText(query)));
}

function normalizeAnchorText(value: string): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findAnchorChunkIndex(chunks: string[], anchorText: string): number {
  // A long selection may cross chunk boundaries. Its leading fragment is
  // normally enough to locate the source chunk while staying inexpensive.
  const needle = normalizeAnchorText(anchorText).slice(
    0,
    ANCHOR_MATCH_PREFIX_CHARS,
  );
  if (!needle) return -1;
  return chunks.findIndex((chunk) =>
    normalizeAnchorText(chunk).includes(needle),
  );
}

function sampleEvenly(indexes: number[], limit: number): number[] {
  if (limit <= 0 || !indexes.length) return [];
  if (indexes.length <= limit) return [...indexes];
  if (limit === 1) return [indexes[Math.floor(indexes.length / 2)]];
  const sampled = new Set<number>();
  for (let sampleIndex = 0; sampleIndex < limit; sampleIndex++) {
    const position = Math.round(
      (sampleIndex * (indexes.length - 1)) / (limit - 1),
    );
    sampled.add(indexes[position]);
  }
  return [...sampled];
}

function sampleAcrossSegments(
  candidateIndexes: number[],
  metadata: DocumentChunkMetadata[],
  maxChunks: number,
): number[] {
  const groups = new Map<string, number[]>();
  for (const index of candidateIndexes) {
    const segmentId = metadata[index]?.segmentId;
    if (!segmentId) continue;
    const group = groups.get(segmentId) || [];
    group.push(index);
    groups.set(segmentId, group);
  }
  const orderedGroups = [...groups.values()];
  if (!orderedGroups.length) {
    return sampleEvenly(candidateIndexes, maxChunks);
  }

  const selectedGroups =
    orderedGroups.length > maxChunks
      ? sampleEvenly(
          orderedGroups.map((_, index) => index),
          maxChunks,
        ).map((index) => orderedGroups[index])
      : orderedGroups;
  const picked: number[] = [];
  let round = 0;
  while (picked.length < maxChunks) {
    let added = false;
    for (const group of selectedGroups) {
      const budget = Math.max(1, Math.ceil(maxChunks / selectedGroups.length));
      const samples = sampleEvenly(group, budget);
      const candidate = samples[round];
      if (candidate === undefined || picked.includes(candidate)) continue;
      picked.push(candidate);
      added = true;
      if (picked.length >= maxChunks) break;
    }
    if (!added) break;
    round += 1;
  }
  return picked;
}

function getChunkLabel(context: DocumentTextContext, index: number): string {
  const metadata = context.chunkMetadata?.[index];
  if (!metadata) return `Section ${index + 1}`;

  const noun = context.documentPresentation?.noun || "document";
  const nounLabel = `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;
  const heading =
    metadata.headingPath?.filter(Boolean).join(" > ") || metadata.title || "";
  const prefix =
    metadata.role === "notes"
      ? `${nounLabel} notes`
      : metadata.role === "frontmatter"
        ? `${nounLabel} front matter`
        : `${nounLabel} section`;
  return heading ? `${prefix} — ${heading}` : prefix;
}

function scoreChunkBM25(
  chunk: ChunkStat,
  terms: string[],
  docFreq: Record<string, number>,
  totalChunks: number,
  avgChunkLength: number,
): number {
  if (!terms.length || !chunk.length) return 0;
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;

  for (const term of terms) {
    const tf = chunk.tf[term] || 0;
    if (!tf) continue;
    const df = docFreq[term] || 0;
    const idf = Math.log(1 + (totalChunks - df + 0.5) / (df + 0.5));
    const norm =
      (tf * (k1 + 1)) /
      (tf + k1 * (1 - b + (b * chunk.length) / avgChunkLength));
    score += idf * norm;
  }

  return score;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeScores(scores: number[]): number[] {
  if (!scores.length) return [];
  let min = scores[0];
  let max = scores[0];
  for (const score of scores) {
    if (score < min) min = score;
    if (score > max) max = score;
  }
  if (max === min) return scores.map(() => 0);
  return scores.map((score) => (score - min) / (max - min));
}

async function embedTexts(
  texts: string[],
  overrides?: { apiBase?: string; apiKey?: string },
): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await callEmbeddings(batch, overrides);
    all.push(...batchEmbeddings);
  }
  return all;
}

async function ensureEmbeddings(
  context: DocumentTextContext,
  overrides?: { apiBase?: string; apiKey?: string },
): Promise<boolean> {
  if (context.embeddingFailed) return false;
  if (context.embeddings?.length) {
    return context.embeddings.length === context.chunks.length;
  }

  if (context.embeddingPromise) {
    const result = await context.embeddingPromise;
    if (result) {
      context.embeddings = result;
      return result.length === context.chunks.length;
    }
    return false;
  }

  context.embeddingPromise = (async () => {
    try {
      return await embedTexts(context.chunks, overrides);
    } catch (err) {
      ztoolkit.log("Embedding generation failed:", err);
      return null;
    }
  })();

  const result = await context.embeddingPromise;
  context.embeddingPromise = undefined;
  if (result) {
    context.embeddings = result;
    return result.length === context.chunks.length;
  }
  context.embeddingFailed = true;
  return false;
}

const DEFAULT_DOCUMENT_PRESENTATION: DocumentPresentation = {
  noun: "document",
  fullTextHeading: "Document Full Text (complete document):",
  excerptsHeading: "Document Text:",
  relevantSectionsNotice: "Relevant sections extracted from the document",
};

function getContextLabels(context: DocumentTextContext): {
  fullText: string;
  excerpts: string;
  relevantNotice: string;
} {
  const presentation =
    context.documentPresentation || DEFAULT_DOCUMENT_PRESENTATION;
  return {
    fullText: presentation.fullTextHeading,
    excerpts: presentation.excerptsHeading,
    relevantNotice:
      context.completeness === "partial" &&
      presentation.partialRelevantSectionsNotice
        ? presentation.partialRelevantSectionsNotice
        : presentation.relevantSectionsNotice,
  };
}

export async function buildDocumentContext(
  context: DocumentTextContext | undefined,
  question: string,
  hasImage: boolean,
  apiOverrides?: { apiBase?: string; apiKey?: string },
  options?: BuildDocumentContextOptions,
): Promise<string> {
  if (!context) return "";
  const { title, chunks, chunkStats, docFreq, avgChunkLength, fullLength } =
    context;
  const labels = getContextLabels(context);
  const contextParts: string[] = [];
  if (title) contextParts.push(`Title: ${title}`);
  if (!chunks.length) {
    ztoolkit.log(`LLM buildContext: no chunks (title=${title})`);
    options?.onRetrievedSegments?.([]);
    return contextParts.join("\n\n");
  }

  const forceRetrieval = options?.forceRetrieval === true;
  const contextStrategy = options?.contextStrategy || "full-or-retrieval";
  const useEmbeddings = options?.useEmbeddings !== false;
  const maxChunks = Number.isFinite(options?.maxChunks)
    ? Math.max(1, Math.floor(options?.maxChunks as number))
    : MAX_CONTEXT_CHUNKS;
  const maxLength = Number.isFinite(options?.maxLength)
    ? Math.max(256, Math.floor(options?.maxLength as number))
    : hasImage
      ? MAX_CONTEXT_LENGTH_WITH_IMAGE
      : MAX_CONTEXT_LENGTH;

  if (FORCE_FULL_CONTEXT && contextStrategy === "full-or-retrieval") {
    if (!fullLength || fullLength <= FULL_CONTEXT_CHAR_LIMIT) {
      contextParts.push(labels.fullText);
      contextParts.push(chunks.join("\n\n"));
      if (fullLength) {
        contextParts.push(
          `\n[Full document content provided — ${fullLength} chars]`,
        );
      }
      return contextParts.join("\n\n");
    }
    contextParts.push(
      `\n[Full context ${fullLength} chars exceeds ${FULL_CONTEXT_CHAR_LIMIT}. Falling back to retrieval.]`,
    );
  }

  const structuredMetadata =
    context.chunkMetadata?.length === chunks.length
      ? context.chunkMetadata
      : undefined;
  const sectionCatalog = structuredMetadata
    ? buildSectionCatalog(context)
    : null;
  const plannedRetrieval = sectionCatalog
    ? resolveSectionRetrievalPlan(
        sectionCatalog,
        buildDeterministicSectionPlan(sectionCatalog, question),
      )
    : null;
  const routingHandledQuestion = Boolean(plannedRetrieval);
  const anchorIndex = findAnchorChunkIndex(chunks, options?.anchorText || "");
  const preferredSegmentIds = new Set(plannedRetrieval?.segmentIds || []);
  const anchorSegmentId =
    anchorIndex >= 0 ? structuredMetadata?.[anchorIndex]?.segmentId : undefined;
  let reusedPreferredSegments = false;
  if (structuredMetadata && !routingHandledQuestion && !anchorSegmentId) {
    const availableSegmentIds = new Set(
      structuredMetadata.map((metadata) => metadata.segmentId),
    );
    for (const segmentId of options?.preferredSegmentIds || []) {
      if (availableSegmentIds.has(segmentId)) {
        preferredSegmentIds.add(segmentId);
        reusedPreferredSegments = true;
      }
    }
  }

  // A native selection is a trustworthy hard scope. LLM-planned and
  // conversational scopes are preferences: keeping global scored candidates
  // available prevents a plausible but wrong plan from hiding stronger
  // evidence elsewhere in the document.
  const restrictedSegmentIds = new Set<string>();
  if (anchorSegmentId) restrictedSegmentIds.add(anchorSegmentId);
  const routedSegmentIds = new Set([
    ...restrictedSegmentIds,
    ...preferredSegmentIds,
  ]);

  const allIndexes = chunks.map((_, index) => index);
  const candidateIndexes = restrictedSegmentIds.size
    ? allIndexes.filter((index) => {
        const segmentId = structuredMetadata?.[index]?.segmentId;
        return Boolean(segmentId && restrictedSegmentIds.has(segmentId));
      })
    : allIndexes;
  const candidateSet = new Set(candidateIndexes);
  const preferredIndexes = preferredSegmentIds.size
    ? candidateIndexes.filter((index) => {
        const segmentId = structuredMetadata?.[index]?.segmentId;
        return Boolean(segmentId && preferredSegmentIds.has(segmentId));
      })
    : [];
  const preferredIndexSet = new Set(preferredIndexes);

  const terms = tokenizeQuery(question);
  const bm25Scores = chunkStats.map((chunk) =>
    scoreChunkBM25(chunk, terms, docFreq, chunks.length, avgChunkLength || 1),
  );

  let embeddingScores: number[] | null = null;
  const embeddingsReady =
    useEmbeddings && (await ensureEmbeddings(context, apiOverrides));
  if (embeddingsReady && context.embeddings) {
    try {
      const queryEmbedding =
        (await callEmbeddings([question], apiOverrides))[0] || [];
      if (queryEmbedding.length) {
        embeddingScores = context.embeddings.map((vector) =>
          cosineSimilarity(queryEmbedding, vector),
        );
      }
    } catch (err) {
      ztoolkit.log("Query embedding failed:", err);
    }
  }

  const bm25Norm = normalizeScores(bm25Scores);
  const embedNorm = embeddingScores ? normalizeScores(embeddingScores) : null;
  const bm25Weight = embedNorm ? HYBRID_WEIGHT_BM25 : 1;
  const embedWeight = embedNorm ? HYBRID_WEIGHT_EMBEDDING : 0;
  const scored = chunkStats.map((chunk, index) => ({
    index: chunk.index,
    score:
      bm25Norm[index] * bm25Weight +
      (embedNorm ? embedNorm[index] * embedWeight : 0),
  }));

  scored.sort((a, b) => b.score - a.score);
  throwIfAborted(options?.signal);
  const coverage: SectionCoverage =
    plannedRetrieval?.coverage ||
    (preferredSegmentIds.size > 1 ? "balanced" : "focused");
  const picked = new Set<number>();
  const addIndex = (index: number) => {
    if (index < 0 || index >= chunks.length) return;
    if (!candidateSet.has(index)) return;
    if (picked.size >= maxChunks) return;
    picked.add(index);
  };

  addIndex(anchorIndex);

  const primaryIndexes = preferredIndexes.length
    ? preferredIndexes
    : candidateIndexes;
  const primaryBudget = preferredIndexes.length
    ? Math.max(1, Math.ceil(maxChunks * PLANNED_SECTION_PRIMARY_BUDGET_RATIO))
    : maxChunks;

  if (structuredMetadata && coverage === "balanced") {
    const representativeIndexes = primaryIndexes.filter((index) => {
      const role = structuredMetadata[index]?.role;
      const linear = structuredMetadata[index]?.linear;
      return (role === undefined || role === "content") && linear !== false;
    });
    for (const index of sampleAcrossSegments(
      representativeIndexes.length ? representativeIndexes : primaryIndexes,
      structuredMetadata,
      primaryBudget,
    )) {
      addIndex(index);
    }
  } else if (preferredIndexes.length) {
    for (const entry of scored) {
      if (picked.size >= primaryBudget) break;
      if (!preferredIndexSet.has(entry.index)) continue;
      if (entry.score === 0 && picked.size > 0) break;
      addIndex(entry.index);
    }
    if (picked.size === 0) {
      addIndex(preferredIndexes[0] ?? -1);
      addIndex(preferredIndexes[1] ?? -1);
    }
  }

  for (const entry of scored) {
    if (picked.size >= maxChunks) break;
    if (!candidateSet.has(entry.index)) continue;
    if (entry.score === 0 && picked.size > 0) break;
    addIndex(entry.index);
  }

  if (picked.size === 0) {
    addIndex(candidateIndexes[0] ?? -1);
    addIndex(candidateIndexes[1] ?? -1);
  }

  if (picked.size < maxChunks) {
    const primary = Array.from(picked);
    const addAdjacentIndex = (index: number, sourceIndex: number) => {
      if (
        structuredMetadata &&
        structuredMetadata[index]?.segmentId !==
          structuredMetadata[sourceIndex]?.segmentId
      ) {
        return;
      }
      if (
        structuredMetadata &&
        preferredSegmentIds.size > 0 &&
        restrictedSegmentIds.size === 0
      ) {
        const segmentId = structuredMetadata[index]?.segmentId;
        if (!segmentId || !preferredSegmentIds.has(segmentId)) return;
      }
      if (
        structuredMetadata &&
        coverage === "balanced" &&
        restrictedSegmentIds.size === 0 &&
        preferredSegmentIds.size === 0
      ) {
        const role = structuredMetadata[index]?.role;
        const linear = structuredMetadata[index]?.linear;
        if ((role !== undefined && role !== "content") || linear === false) {
          return;
        }
      }
      addIndex(index);
    };
    for (const index of primary) {
      if (picked.size >= maxChunks) break;
      addAdjacentIndex(index - 1, index);
      if (picked.size >= maxChunks) break;
      addAdjacentIndex(index + 1, index);
    }
  }

  let remaining = maxLength;
  if (title) remaining -= `Title: ${title}`.length + 2;

  const excerpts: string[] = [];
  const emittedIndexes: number[] = [];
  const readingOrder = Array.from(picked).sort((a, b) => a - b);
  const outputOrder =
    anchorIndex >= 0 && picked.has(anchorIndex)
      ? [anchorIndex, ...readingOrder.filter((index) => index !== anchorIndex)]
      : readingOrder;
  for (const index of outputOrder) {
    if (index < 0 || index >= chunks.length) continue;
    const block = `${getChunkLabel(context, index)}:\n${chunks[index]}`;
    if (remaining <= 0) break;
    if (block.length > remaining) {
      excerpts.push(block.slice(0, Math.max(0, remaining)));
      emittedIndexes.push(index);
      break;
    }
    excerpts.push(block);
    emittedIndexes.push(index);
    remaining -= block.length + 2;
  }

  if (excerpts.length) {
    contextParts.push(labels.excerpts);
    contextParts.push(excerpts.join("\n\n"));
  }

  if (fullLength) {
    contextParts.push(
      `\n[${labels.relevantNotice} (${fullLength} chars total). Answer based on the content provided above.]`,
    );
  }

  const retrievedSegmentIds = Array.from(
    new Set(
      emittedIndexes
        .map((index) => structuredMetadata?.[index]?.segmentId)
        .filter((segmentId): segmentId is string => Boolean(segmentId)),
    ),
  );
  options?.onRetrievedSegments?.(retrievedSegmentIds);

  ztoolkit.log(
    `LLM buildContext: kind=${context.documentKind || "pdf"}, ` +
      `chunks=${chunks.length}, picked=${picked.size}, ` +
      `excerpts=${excerpts.length}, contextLen=${contextParts.join("\n\n").length}, ` +
      `fullLength=${fullLength}, maxLen=${maxLength}, forceRetrieval=${forceRetrieval}, ` +
      `strategy=${contextStrategy}, embeddings=${useEmbeddings}, ` +
      `routedSegments=${routedSegmentIds.size}, restrictedRoutes=${restrictedSegmentIds.size}, ` +
      `preferredRoutes=${preferredSegmentIds.size}, ` +
      `reusedPreferred=${reusedPreferredSegments}, localRouting=${routingHandledQuestion}, ` +
      `plannedSections=${plannedRetrieval?.sectionIds.length || 0}, coverage=${coverage}`,
  );

  return contextParts.join("\n\n");
}
