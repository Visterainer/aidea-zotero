import type {
  DocumentStructure,
  DocumentStructureConfidence,
  DocumentStructureNode,
} from "../types";

export type EpubStructureSource =
  "epub3-nav" | "epub2-ncx" | "semantic-html" | "heading" | "spine";

export type EpubNavigationNode = {
  sourceId?: string;
  label?: string;
  href?: string;
  fragment?: string;
  semanticRoles?: string[];
  children?: EpubNavigationNode[];
};

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values: Array<string | undefined>): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

function normalizeFragment(value: string | undefined): string | undefined {
  const raw = String(value || "")
    .replace(/^#/, "")
    .trim();
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function makeNodeId(
  source: EpubStructureSource,
  sourceId: string | undefined,
  ordinal: number,
): string {
  const normalizedSourceId = normalizeText(sourceId).replace(
    /[^\p{L}\p{N}._:-]+/gu,
    "-",
  );
  return normalizedSourceId
    ? `epub-structure:${source}:${normalizedSourceId}`
    : `epub-structure:${source}:${ordinal}`;
}

export function buildEpubNavigationStructure(
  roots: EpubNavigationNode[],
  source: "epub3-nav" | "epub2-ncx",
): DocumentStructure {
  const nodes: DocumentStructureNode[] = [];
  const rootIds: string[] = [];
  const usedIds = new Set<string>();
  let ordinal = 0;

  const visit = (
    input: EpubNavigationNode,
    parentId: string | undefined,
    parentPath: string[],
  ): string | null => {
    const label = normalizeText(input.label);
    const href = normalizeText(input.href);
    const children = input.children || [];
    if (!label && !href && !children.length) return null;

    ordinal += 1;
    const baseId = makeNodeId(source, input.sourceId, ordinal);
    let id = baseId;
    let collision = 1;
    while (usedIds.has(id)) {
      collision += 1;
      id = `${baseId}:${collision}`;
    }
    usedIds.add(id);

    const path = label ? [...parentPath, label] : [...parentPath];
    const fragment = normalizeFragment(input.fragment);
    const node: DocumentStructureNode = {
      id,
      parentId,
      childIds: [],
      label: label || undefined,
      path,
      locator: href
        ? {
            kind: "epub-location",
            href: fragment ? `${href}#${fragment}` : href,
            locationLabel: label || undefined,
          }
        : undefined,
      semanticRoles: uniqueValues(input.semanticRoles || []),
      source,
      confidence: "authoritative",
      navigationOrder: ordinal,
    };
    if (!node.semanticRoles?.length) delete node.semanticRoles;
    nodes.push(node);

    for (const child of children) {
      const childId = visit(child, id, path);
      if (childId) node.childIds.push(childId);
    }
    return id;
  };

  for (const root of roots) {
    const id = visit(root, undefined, []);
    if (id) rootIds.push(id);
  }
  return { rootIds, nodes };
}

export function appendEpubStructureNode(
  structure: DocumentStructure,
  options: {
    id: string;
    parentId?: string;
    label?: string;
    path?: string[];
    href?: string;
    fragment?: string;
    semanticRoles?: string[];
    source: EpubStructureSource;
    confidence: DocumentStructureConfidence;
  },
): DocumentStructureNode {
  const label = normalizeText(options.label);
  const fragment = normalizeFragment(options.fragment);
  const parent = options.parentId
    ? structure.nodes.find((node) => node.id === options.parentId)
    : undefined;
  const node: DocumentStructureNode = {
    id: options.id,
    parentId: options.parentId,
    childIds: [],
    label: label || undefined,
    path:
      options.path ||
      (label ? [...(parent?.path || []), label] : [...(parent?.path || [])]),
    locator: options.href
      ? {
          kind: "epub-location",
          href: fragment ? `${options.href}#${fragment}` : options.href,
          locationLabel: label || undefined,
        }
      : undefined,
    semanticRoles: uniqueValues(options.semanticRoles || []),
    source: options.source,
    confidence: options.confidence,
  };
  if (!node.semanticRoles?.length) delete node.semanticRoles;
  structure.nodes.push(node);
  if (parent) {
    parent.childIds.push(node.id);
  } else {
    structure.rootIds.push(node.id);
  }
  return node;
}

export function getEpubNodeLocation(
  node: DocumentStructureNode,
): { href: string; fragment?: string } | null {
  if (node.locator?.kind !== "epub-location" || !node.locator.href) {
    return null;
  }
  const [href, rawFragment = ""] = node.locator.href.split("#", 2);
  const fragment = normalizeFragment(rawFragment);
  return href ? { href, fragment } : null;
}
