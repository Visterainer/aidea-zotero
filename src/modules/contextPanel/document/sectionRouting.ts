import type { DocumentTextContext } from "../types";
import type {
  DocumentChunkMetadata,
  DocumentSegment,
  DocumentStructureConfidence,
  DocumentStructureNode,
} from "./types";

export type SectionCoverage = "focused" | "balanced";
export type SectionPlanScope = "document" | "sections";
export const MAX_SECTION_PLAN_IDS = 12;
const SECTION_ROUTING_PREVIEW_CHARS = 240;

export type SectionCard = {
  id: string;
  label: string;
  path: string[];
  source: string;
  confidence: DocumentStructureConfidence;
  role?: DocumentSegment["role"];
  linear?: boolean;
  characterCount: number;
  preview?: string;
};

export type SectionRetrievalPlan = {
  scope: SectionPlanScope;
  sectionIds: string[];
  coverage: SectionCoverage;
};

export type SectionCatalog = {
  cards: SectionCard[];
  segmentIdsBySectionId: Map<string, string[]>;
  sectionIdByDirectSegmentId: Map<string, string>;
};

export type ResolvedSectionRetrievalPlan = SectionRetrievalPlan & {
  segmentIds: Set<string>;
};

const WHOLE_DOCUMENT_QUERY =
  /\b(?:whole|entire)\s+(?:book|document|text)\b|\b(?:book|document)\s+overview\b|全书|整本(?:书)?|全文概览|整篇概览/i;

function normalizeComparableText(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsefulLabel(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  return compact.length >= 2 && !/^\d+$/.test(compact);
}

/**
 * Route explicit publisher section references locally. Ambiguous questions are
 * intentionally left to normal retrieval; conversational follow-ups reuse the
 * previously emitted segment IDs in the caller.
 */
export function buildDeterministicSectionPlan(
  catalog: SectionCatalog,
  question: string,
): SectionRetrievalPlan | null {
  if (WHOLE_DOCUMENT_QUERY.test(question)) {
    return { scope: "document", sectionIds: [], coverage: "balanced" };
  }

  const normalizedQuestion = normalizeComparableText(question);
  if (!normalizedQuestion) return null;

  const matches = catalog.cards
    .map((card) => {
      const candidates = [card.label, ...card.path]
        .map(normalizeComparableText)
        .filter(isUsefulLabel);
      let score = 0;
      for (const candidate of candidates) {
        if (normalizedQuestion === candidate) {
          score = Math.max(score, 100);
        } else if (normalizedQuestion.includes(candidate)) {
          score = Math.max(score, 60 + Math.min(candidate.length, 30));
        }
      }
      return { id: card.id, score };
    })
    .filter((entry) => entry.score >= 60)
    .sort((left, right) => right.score - left.score);

  if (!matches.length) return null;
  const bestScore = matches[0].score;
  return {
    scope: "sections",
    sectionIds: matches
      .filter((entry) => entry.score === bestScore)
      .slice(0, MAX_SECTION_PLAN_IDS)
      .map((entry) => entry.id),
    coverage: "focused",
  };
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSegmentMetadata(
  context: DocumentTextContext,
): Map<string, DocumentChunkMetadata> {
  const byId = new Map<string, DocumentChunkMetadata>();
  for (const metadata of context.chunkMetadata || []) {
    if (!byId.has(metadata.segmentId)) {
      byId.set(metadata.segmentId, metadata);
    }
  }
  return byId;
}

function getChunkIndexesBySegment(
  context: DocumentTextContext,
): Map<string, number[]> {
  const bySegment = new Map<string, number[]>();
  (context.chunkMetadata || []).forEach((metadata, index) => {
    const indexes = bySegment.get(metadata.segmentId) || [];
    indexes.push(index);
    bySegment.set(metadata.segmentId, indexes);
  });
  return bySegment;
}

function getNodeOrder(node: DocumentStructureNode, fallback: number): number {
  return node.navigationOrder ?? Number.MAX_SAFE_INTEGER - 10_000 + fallback;
}

function getRepresentativeRole(
  metadata: DocumentChunkMetadata[],
): DocumentSegment["role"] | undefined {
  const roles = new Set(
    metadata
      .map((entry) => entry.role)
      .filter((role): role is NonNullable<DocumentSegment["role"]> =>
        Boolean(role),
      ),
  );
  return roles.size === 1 ? [...roles][0] : undefined;
}

function getRepresentativeLinear(
  metadata: DocumentChunkMetadata[],
): boolean | undefined {
  const values = metadata
    .map((entry) => entry.linear)
    .filter((value): value is boolean => typeof value === "boolean");
  if (!values.length) return undefined;
  return values.some(Boolean);
}

function getPreview(
  context: DocumentTextContext,
  segmentIds: Set<string>,
): string | undefined {
  const metadata = context.chunkMetadata || [];
  const preferredIndex = metadata.findIndex(
    (entry) =>
      segmentIds.has(entry.segmentId) &&
      entry.role !== "frontmatter" &&
      entry.role !== "notes",
  );
  const fallbackIndex = metadata.findIndex((entry) =>
    segmentIds.has(entry.segmentId),
  );
  const text = normalizeText(
    context.chunks[preferredIndex >= 0 ? preferredIndex : fallbackIndex],
  );
  return text ? text.slice(0, SECTION_ROUTING_PREVIEW_CHARS) : undefined;
}

function getCharacterCount(
  context: DocumentTextContext,
  segmentIds: Set<string>,
): number {
  return (context.chunkMetadata || []).reduce(
    (total, metadata, index) =>
      segmentIds.has(metadata.segmentId)
        ? total + (context.chunks[index]?.length || 0)
        : total,
    0,
  );
}

function getDescendantNodeIds(
  nodeId: string,
  nodesById: Map<string, DocumentStructureNode>,
  memo: Map<string, Set<string>>,
  visiting: Set<string> = new Set(),
): Set<string> {
  const cached = memo.get(nodeId);
  if (cached) return cached;
  if (visiting.has(nodeId)) return new Set([nodeId]);

  const nextVisiting = new Set(visiting);
  nextVisiting.add(nodeId);
  const descendants = new Set([nodeId]);
  for (const childId of nodesById.get(nodeId)?.childIds || []) {
    for (const descendantId of getDescendantNodeIds(
      childId,
      nodesById,
      memo,
      nextVisiting,
    )) {
      descendants.add(descendantId);
    }
  }
  memo.set(nodeId, descendants);
  return descendants;
}

/**
 * Build a lightweight logical-section catalogue. A card may represent a
 * publisher container such as a part and therefore map to several descendant
 * content segments. Text remains in the cached context and is never copied
 * into the catalogue beyond a short routing preview.
 */
export function buildSectionCatalog(
  context: DocumentTextContext,
): SectionCatalog | null {
  const metadata = context.chunkMetadata;
  if (!metadata?.length || metadata.length !== context.chunks.length) {
    return null;
  }

  const cards: SectionCard[] = [];
  const segmentIdsBySectionId = new Map<string, string[]>();
  const sectionIdByDirectSegmentId = new Map<string, string>();
  const metadataBySegment = getSegmentMetadata(context);
  const chunkIndexesBySegment = getChunkIndexesBySegment(context);
  const sourceStructureNodes = context.documentStructure?.nodes || [];
  const sourceOrderById = new Map(
    sourceStructureNodes.map((node, index) => [node.id, index]),
  );
  const structureNodes = [...sourceStructureNodes].sort(
    (left, right) =>
      getNodeOrder(left, sourceOrderById.get(left.id) || 0) -
      getNodeOrder(right, sourceOrderById.get(right.id) || 0),
  );
  const nodesById = new Map(structureNodes.map((node) => [node.id, node]));
  const descendantMemo = new Map<string, Set<string>>();
  const directSegmentIdsByNode = new Map<string, Set<string>>();

  for (const entry of metadataBySegment.values()) {
    if (!entry.structureNodeId) continue;
    const segmentIds =
      directSegmentIdsByNode.get(entry.structureNodeId) || new Set<string>();
    segmentIds.add(entry.segmentId);
    directSegmentIdsByNode.set(entry.structureNodeId, segmentIds);
  }

  for (const node of structureNodes) {
    const descendantNodeIds = getDescendantNodeIds(
      node.id,
      nodesById,
      descendantMemo,
    );
    const segmentIds = new Set<string>();
    for (const descendantId of descendantNodeIds) {
      for (const segmentId of directSegmentIdsByNode.get(descendantId) || []) {
        segmentIds.add(segmentId);
      }
    }
    if (!segmentIds.size) continue;

    const sectionId = `section-${cards.length + 1}`;
    const sectionMetadata = [...segmentIds]
      .map((segmentId) => metadataBySegment.get(segmentId))
      .filter((entry): entry is DocumentChunkMetadata => Boolean(entry));
    const path = node.path.map(normalizeText).filter(Boolean);
    cards.push({
      id: sectionId,
      label:
        normalizeText(node.label) ||
        path[path.length - 1] ||
        `Section ${cards.length + 1}`,
      path,
      source: node.source,
      confidence: node.confidence,
      role: getRepresentativeRole(sectionMetadata),
      linear: getRepresentativeLinear(sectionMetadata),
      characterCount: getCharacterCount(context, segmentIds),
      preview: getPreview(context, segmentIds),
    });
    segmentIdsBySectionId.set(sectionId, [...segmentIds]);
    for (const segmentId of directSegmentIdsByNode.get(node.id) || []) {
      sectionIdByDirectSegmentId.set(segmentId, sectionId);
    }
  }

  for (const [segmentId, entry] of metadataBySegment) {
    if (sectionIdByDirectSegmentId.has(segmentId)) continue;
    const sectionId = `section-${cards.length + 1}`;
    const segmentIds = new Set([segmentId]);
    const path = (entry.tocPath || entry.headingPath || [])
      .map(normalizeText)
      .filter(Boolean);
    cards.push({
      id: sectionId,
      label:
        normalizeText(entry.title) ||
        path[path.length - 1] ||
        `Reading unit ${cards.length + 1}`,
      path,
      source: entry.source || "segment",
      confidence: entry.confidence || "fallback",
      role: entry.role,
      linear: entry.linear,
      characterCount: (chunkIndexesBySegment.get(segmentId) || []).reduce(
        (total, index) => total + (context.chunks[index]?.length || 0),
        0,
      ),
      preview: getPreview(context, segmentIds),
    });
    segmentIdsBySectionId.set(sectionId, [segmentId]);
    sectionIdByDirectSegmentId.set(segmentId, sectionId);
  }

  return cards.length
    ? { cards, segmentIdsBySectionId, sectionIdByDirectSegmentId }
    : null;
}

export function getPreviousSectionIds(
  catalog: SectionCatalog,
  segmentIds: string[] | undefined,
): string[] {
  return Array.from(
    new Set(
      (segmentIds || [])
        .map((segmentId) => catalog.sectionIdByDirectSegmentId.get(segmentId))
        .filter((sectionId): sectionId is string => Boolean(sectionId)),
    ),
  );
}

export function resolveSectionRetrievalPlan(
  catalog: SectionCatalog,
  plan: SectionRetrievalPlan | null | undefined,
): ResolvedSectionRetrievalPlan | null {
  if (!plan) return null;
  if (plan.scope === "document") {
    return {
      scope: "document",
      sectionIds: [],
      coverage: plan.coverage,
      segmentIds: new Set(),
    };
  }

  const sectionIds = Array.from(
    new Set(
      plan.sectionIds.filter((sectionId) =>
        catalog.segmentIdsBySectionId.has(sectionId),
      ),
    ),
  ).slice(0, MAX_SECTION_PLAN_IDS);
  if (!sectionIds.length) return null;

  const segmentIds = new Set<string>();
  for (const sectionId of sectionIds) {
    for (const segmentId of catalog.segmentIdsBySectionId.get(sectionId) ||
      []) {
      segmentIds.add(segmentId);
    }
  }
  if (!segmentIds.size) return null;
  return {
    scope: "sections",
    sectionIds,
    coverage: plan.coverage,
    segmentIds,
  };
}
