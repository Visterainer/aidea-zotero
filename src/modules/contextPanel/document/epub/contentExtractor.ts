import type {
  DocumentSegment,
  DocumentStructure,
  DocumentStructureConfidence,
  DocumentStructureNode,
} from "../types";
import type {
  EpubPackage,
  EpubPackageReader,
  EpubSpineItem,
} from "./packageReader";
import {
  appendEpubStructureNode,
  getEpubNodeLocation,
  type EpubStructureSource,
} from "./structure";

export type EpubContentUnit = {
  id: string;
  href: string;
  fragment?: string;
  endFragment?: string;
  text: string;
  title?: string;
  headingPath?: string[];
  structureNodeId?: string;
  semanticRoles?: string[];
  source: EpubStructureSource;
  confidence: DocumentStructureConfidence;
  role: NonNullable<DocumentSegment["role"]>;
  linear: boolean;
  spineIndex: number;
};

export type EpubContentExtraction = {
  units: EpubContentUnit[];
  structure: DocumentStructure;
  completeness: "complete" | "partial" | "unavailable";
  warnings?: string[];
};

type Boundary = {
  target: Element;
  node: DocumentStructureNode;
  fragment?: string;
};

const STRUCTURAL_SEMANTICS = new Set([
  "acknowledgments",
  "afterword",
  "appendix",
  "backmatter",
  "bibliography",
  "bodymatter",
  "chapter",
  "conclusion",
  "dedication",
  "division",
  "endnotes",
  "epigraph",
  "epilogue",
  "footnotes",
  "foreword",
  "frontmatter",
  "glossary",
  "index",
  "introduction",
  "notes",
  "part",
  "preface",
  "prologue",
  "section",
  "subchapter",
  "volume",
]);

const FRONTMATTER_SEMANTICS = new Set([
  "frontmatter",
  "cover",
  "titlepage",
  "copyright-page",
  "dedication",
  "epigraph",
  "foreword",
  "preface",
  "prologue",
  "introduction",
]);

const NOTES_SEMANTICS = new Set([
  "notes",
  "footnotes",
  "endnotes",
  "rearnotes",
]);

const BLOCK_ELEMENTS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "td",
  "th",
  "tr",
  "ul",
]);

const NON_CONTENT_ELEMENTS = new Set([
  "nav",
  "noscript",
  "script",
  "style",
  "template",
]);

// Zotero add-ons run in a privileged sandbox where DOMParser and Range are
// available, but the global Node constructor may not be. Keep these standard
// DOM bitmask values local so EPUB extraction does not depend on a window
// global that is absent at runtime.
const TEXT_NODE_TYPE = 3;
const DOCUMENT_POSITION_PRECEDING = 0x02;
const DOCUMENT_POSITION_FOLLOWING = 0x04;

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
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

function uniqueValues(values: Array<string | undefined>): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function getAttributeByLocalName(
  element: Element | null | undefined,
  localName: string,
): string {
  if (!element) return "";
  const attribute = Array.from(element.attributes).find(
    (candidate) =>
      candidate.localName.toLowerCase() === localName.toLowerCase(),
  );
  return normalizeText(attribute?.value);
}

function getSemanticRoles(element: Element | null | undefined): string[] {
  if (!element) return [];
  const roles = getAttributeByLocalName(element, "type")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const ariaRole = normalizeText(element.getAttribute("role")).toLowerCase();
  if (ariaRole.startsWith("doc-")) roles.push(ariaRole.substring(4));
  return uniqueValues(roles);
}

function getInheritedSemanticRoles(
  element: Element | null | undefined,
): string[] {
  const roles: string[] = [];
  let current = element || null;
  while (current) {
    roles.push(...getSemanticRoles(current));
    current = current.parentElement;
  }
  return uniqueValues(roles);
}

function getRootElement(doc: XMLDocument): Element | null {
  return doc.body || doc.documentElement || null;
}

function getFragmentTarget(
  doc: XMLDocument,
  fragment: string | undefined,
): Element | null {
  const normalized = normalizeFragment(fragment);
  if (!normalized) return getRootElement(doc);
  const byId = doc.getElementById(normalized);
  if (byId) return byId;
  return (
    (Array.from(doc.getElementsByTagName("*")) as Element[]).find(
      (element) =>
        normalizeFragment(element.getAttribute("name") || undefined) ===
        normalized,
    ) || null
  );
}

function getElementFragment(element: Element): string | undefined {
  return normalizeFragment(
    element.getAttribute("id") || element.getAttribute("name") || undefined,
  );
}

function getRangeText(doc: XMLDocument, start: Element, end?: Element): string {
  try {
    const range = doc.createRange();
    range.setStartBefore(start);
    if (end) {
      range.setEndBefore(end);
    } else {
      const root = getRootElement(doc);
      if (!root) return "";
      range.setEndAfter(root);
    }
    const fragment = range.cloneContents();
    const parts: string[] = [];
    const visit = (node: Node) => {
      if (node.nodeType === TEXT_NODE_TYPE) {
        parts.push(node.nodeValue || "");
        return;
      }
      const element = node as Element;
      const elementName = element.localName?.toLowerCase() || "";
      if (NON_CONTENT_ELEMENTS.has(elementName)) return;
      if (elementName === "br") {
        parts.push("\n");
        return;
      }
      for (const child of Array.from(node.childNodes)) {
        if (child) visit(child);
      }
      if (BLOCK_ELEMENTS.has(elementName)) {
        parts.push("\n\n");
      }
    };
    visit(fragment);
    return parts
      .join("")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch (error) {
    ztoolkit.log("LLM: EPUB DOM range extraction failed", error);
    return "";
  }
}

function compareElements(left: Element, right: Element): number {
  if (left === right) return 0;
  const position = left.compareDocumentPosition(right);
  if (position & DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

function getDirectHeading(element: Element): Element | null {
  const isHeading = (candidate: Element) =>
    /^h[1-6]$/i.test(candidate.localName);
  const direct = Array.from(element.children).find(isHeading);
  if (direct) return direct;
  const header = Array.from(element.children).find(
    (candidate) => candidate.localName.toLowerCase() === "header",
  );
  return header ? Array.from(header.children).find(isHeading) || null : null;
}

function getHeadingLabel(element: Element): string {
  const heading = /^h[1-6]$/i.test(element.localName)
    ? element
    : getDirectHeading(element);
  return normalizeText(heading?.textContent);
}

function getDocumentHeading(doc: XMLDocument): string {
  const root = getRootElement(doc);
  if (!root) return "";
  const heading = (
    Array.from(root.getElementsByTagName("*")) as Element[]
  ).find((element) => /^h[1-6]$/i.test(element.localName));
  return normalizeText(heading?.textContent);
}

function getUnitRole(
  semanticRoles: string[],
): NonNullable<DocumentSegment["role"]> {
  if (semanticRoles.some((role) => NOTES_SEMANTICS.has(role))) return "notes";
  if (semanticRoles.some((role) => FRONTMATTER_SEMANTICS.has(role))) {
    return "frontmatter";
  }
  return "content";
}

function getNodeById(
  structure: DocumentStructure,
  nodeId: string | undefined,
): DocumentStructureNode | undefined {
  return nodeId
    ? structure.nodes.find((candidate) => candidate.id === nodeId)
    : undefined;
}

function getUnitId(
  spineItem: EpubSpineItem,
  fragment: string | undefined,
  unitIndex: number,
): string {
  return fragment
    ? `epub:${spineItem.href}#${fragment}`
    : `epub:${spineItem.href}::${unitIndex + 1}`;
}

function createUnit(
  spineItem: EpubSpineItem,
  text: string,
  unitIndex: number,
  options: {
    node?: DocumentStructureNode;
    fragment?: string;
    endFragment?: string;
    semanticRoles?: string[];
    source: EpubStructureSource;
    confidence: DocumentStructureConfidence;
    title?: string;
    headingPath?: string[];
  },
): EpubContentUnit | null {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) return null;
  const semanticRoles = uniqueValues([
    ...(options.node?.semanticRoles || []),
    ...(options.semanticRoles || []),
  ]);
  return {
    id: getUnitId(spineItem, options.fragment, unitIndex),
    href: spineItem.href,
    fragment: options.fragment,
    endFragment: options.endFragment,
    text: normalizedText,
    title: options.title || options.node?.label,
    headingPath:
      options.headingPath ||
      (options.node?.path.length ? options.node.path : undefined),
    structureNodeId: options.node?.id,
    semanticRoles: semanticRoles.length ? semanticRoles : undefined,
    source: options.source,
    confidence: options.confidence,
    role: getUnitRole(semanticRoles),
    linear: spineItem.linear,
    spineIndex: spineItem.spineIndex,
  };
}

function groupNavigationBoundaries(
  doc: XMLDocument,
  nodes: DocumentStructureNode[],
): Boundary[] {
  const candidates = nodes.reduce<Boundary[]>((result, node) => {
    const location = getEpubNodeLocation(node);
    const target = getFragmentTarget(doc, location?.fragment);
    if (location && target) {
      result.push({
        target,
        node,
        fragment: location.fragment,
      });
    }
    return result;
  }, []);
  candidates.sort((left, right) => compareElements(left.target, right.target));

  const boundaries: Boundary[] = [];
  for (const candidate of candidates) {
    const previous = boundaries[boundaries.length - 1];
    if (previous?.target === candidate.target) {
      // A parent and child can point to the same location. The deepest node
      // owns the text; the parent remains a hierarchy-only container.
      if (candidate.node.path.length >= previous.node.path.length) {
        boundaries[boundaries.length - 1] = candidate;
      }
      continue;
    }
    boundaries.push(candidate);
  }
  return boundaries;
}

function makeFallbackNodeId(
  source: EpubStructureSource,
  spineItem: EpubSpineItem,
  index: number,
): string {
  return `epub-structure:${source}:${spineItem.spineIndex}:${index + 1}`;
}

function appendSpineFallbackNode(
  structure: DocumentStructure,
  spineItem: EpubSpineItem,
  index: number,
  title: string,
): DocumentStructureNode {
  return appendEpubStructureNode(structure, {
    id: makeFallbackNodeId("spine", spineItem, index),
    label: title || undefined,
    href: spineItem.href,
    source: "spine",
    confidence: "fallback",
  });
}

function extractNavigationUnits(
  doc: XMLDocument,
  spineItem: EpubSpineItem,
  structure: DocumentStructure,
  nodes: DocumentStructureNode[],
  activeNodeId: string | undefined,
): { units: EpubContentUnit[]; activeNodeId?: string } {
  const root = getRootElement(doc);
  if (!root) return { units: [], activeNodeId };
  const boundaries = groupNavigationBoundaries(doc, nodes);
  if (!boundaries.length) {
    const activeNode = getNodeById(structure, activeNodeId);
    if (!activeNode) return { units: [], activeNodeId };
    const unit = createUnit(spineItem, getRangeText(doc, root), 0, {
      node: activeNode,
      fragment: getElementFragment(root),
      source: activeNode.source as EpubStructureSource,
      confidence: activeNode.confidence,
      semanticRoles: getSemanticRoles(root),
    });
    return { units: unit ? [unit] : [], activeNodeId };
  }

  const units: EpubContentUnit[] = [];
  let unitIndex = 0;
  const first = boundaries[0];
  if (first.target !== root) {
    const prefixText = getRangeText(doc, root, first.target);
    if (prefixText) {
      const activeNode = getNodeById(structure, activeNodeId);
      const fallbackNode =
        activeNode ||
        appendSpineFallbackNode(
          structure,
          spineItem,
          unitIndex,
          getDocumentHeading(doc),
        );
      const prefix = createUnit(spineItem, prefixText, unitIndex, {
        node: fallbackNode,
        fragment: getElementFragment(root),
        endFragment: first.fragment,
        source: activeNode
          ? (activeNode.source as EpubStructureSource)
          : "spine",
        confidence: activeNode?.confidence || "fallback",
        semanticRoles: getInheritedSemanticRoles(root),
      });
      if (prefix) {
        units.push(prefix);
        unitIndex += 1;
      }
    }
  }

  boundaries.forEach((boundary, index) => {
    const next = boundaries[index + 1];
    const unit = createUnit(
      spineItem,
      getRangeText(doc, boundary.target, next?.target),
      unitIndex,
      {
        node: boundary.node,
        fragment: boundary.fragment || getElementFragment(boundary.target),
        endFragment: next?.fragment,
        source: boundary.node.source as EpubStructureSource,
        confidence: boundary.node.confidence,
        semanticRoles: getInheritedSemanticRoles(boundary.target),
      },
    );
    if (unit) {
      units.push(unit);
      unitIndex += 1;
    }
  });
  return {
    units,
    activeNodeId: boundaries[boundaries.length - 1].node.id,
  };
}

function getSemanticCandidates(root: Element): Element[] {
  return [
    root,
    ...(Array.from(root.getElementsByTagName("*")) as Element[]),
  ].filter((element) =>
    getSemanticRoles(element).some((role) => STRUCTURAL_SEMANTICS.has(role)),
  );
}

function getHeadingCandidates(root: Element): Element[] {
  return (Array.from(root.getElementsByTagName("*")) as Element[]).filter(
    (element) => /^h[1-6]$/i.test(element.localName),
  );
}

function appendFallbackNodes(
  structure: DocumentStructure,
  spineItem: EpubSpineItem,
  candidates: Element[],
  source: "semantic-html" | "heading",
): Map<Element, DocumentStructureNode> {
  const nodes = new Map<Element, DocumentStructureNode>();
  const headingStack: Array<{ level: number; nodeId: string }> = [];
  candidates.forEach((candidate, index) => {
    let parentId: string | undefined;
    if (source === "semantic-html") {
      let ancestor = candidate.parentElement;
      while (ancestor && !parentId) {
        parentId = nodes.get(ancestor)?.id;
        ancestor = ancestor.parentElement;
      }
    } else {
      const level = Number.parseInt(candidate.localName.substring(1), 10);
      while (
        headingStack.length &&
        headingStack[headingStack.length - 1].level >= level
      ) {
        headingStack.pop();
      }
      parentId = headingStack[headingStack.length - 1]?.nodeId;
    }

    const fragment = getElementFragment(candidate);
    const semanticRoles = getSemanticRoles(candidate);
    const node = appendEpubStructureNode(structure, {
      id: makeFallbackNodeId(source, spineItem, index),
      parentId,
      label: getHeadingLabel(candidate) || undefined,
      href: spineItem.href,
      fragment,
      semanticRoles,
      source,
      confidence: source === "semantic-html" ? "derived" : "fallback",
    });
    nodes.set(candidate, node);
    if (source === "heading") {
      headingStack.push({
        level: Number.parseInt(candidate.localName.substring(1), 10),
        nodeId: node.id,
      });
    }
  });
  return nodes;
}

function extractFallbackUnits(
  doc: XMLDocument,
  spineItem: EpubSpineItem,
  structure: DocumentStructure,
): EpubContentUnit[] {
  const root = getRootElement(doc);
  if (!root) return [];
  const semanticCandidates = getSemanticCandidates(root);
  const headingCandidates = getHeadingCandidates(root);
  if (!semanticCandidates.length && !headingCandidates.length) {
    const node = appendSpineFallbackNode(
      structure,
      spineItem,
      0,
      getDocumentHeading(doc),
    );
    const unit = createUnit(spineItem, getRangeText(doc, root), 0, {
      node,
      fragment: getElementFragment(root),
      source: "spine",
      confidence: "fallback",
      semanticRoles: getInheritedSemanticRoles(root),
    });
    return unit ? [unit] : [];
  }
  const fallbackSource: "semantic-html" | "heading" = semanticCandidates.length
    ? "semantic-html"
    : "heading";
  const candidates =
    fallbackSource === "semantic-html" ? semanticCandidates : headingCandidates;

  candidates.sort(compareElements);
  const nodeByCandidate = appendFallbackNodes(
    structure,
    spineItem,
    candidates,
    fallbackSource,
  );
  const units: EpubContentUnit[] = [];
  let unitIndex = 0;
  if (candidates[0] !== root) {
    const prefixText = getRangeText(doc, root, candidates[0]);
    if (prefixText) {
      const node = appendSpineFallbackNode(
        structure,
        spineItem,
        unitIndex,
        getDocumentHeading(doc),
      );
      const prefix = createUnit(spineItem, prefixText, unitIndex, {
        node,
        fragment: getElementFragment(root),
        endFragment: getElementFragment(candidates[0]),
        source: "spine",
        confidence: "fallback",
        semanticRoles: getInheritedSemanticRoles(root),
      });
      if (prefix) {
        units.push(prefix);
        unitIndex += 1;
      }
    }
  }
  candidates.forEach((candidate, index) => {
    const next = candidates[index + 1];
    const node = nodeByCandidate.get(candidate);
    if (!node) return;
    const unit = createUnit(
      spineItem,
      getRangeText(doc, candidate, next),
      unitIndex,
      {
        node,
        fragment: getElementFragment(candidate),
        endFragment: next ? getElementFragment(next) : undefined,
        source: fallbackSource,
        confidence: fallbackSource === "semantic-html" ? "derived" : "fallback",
        semanticRoles: getInheritedSemanticRoles(candidate),
      },
    );
    if (unit) {
      units.push(unit);
      unitIndex += 1;
    }
  });
  return units;
}

function nodesByHref(
  structure: DocumentStructure,
): Map<string, DocumentStructureNode[]> {
  const byHref = new Map<string, DocumentStructureNode[]>();
  for (const node of structure.nodes) {
    const location = getEpubNodeLocation(node);
    if (!location) continue;
    const nodes = byHref.get(location.href) || [];
    nodes.push(node);
    byHref.set(location.href, nodes);
  }
  return byHref;
}

export async function extractEpubContent(
  reader: EpubPackageReader,
  epubPackage: EpubPackage,
): Promise<EpubContentExtraction> {
  const structure: DocumentStructure = {
    rootIds: [...epubPackage.structure.rootIds],
    nodes: epubPackage.structure.nodes.map((node) => ({
      ...node,
      childIds: [...node.childIds],
      path: [...node.path],
      semanticRoles: node.semanticRoles ? [...node.semanticRoles] : undefined,
    })),
  };
  const navigationNodes = nodesByHref(structure);
  const hasPublisherNavigation = epubPackage.structure.nodes.length > 0;
  const units: EpubContentUnit[] = [];
  const warnings: string[] = [];
  let activeNodeId: string | undefined;
  let incompleteLinearItems = 0;

  for (const spineItem of epubPackage.spine) {
    if (spineItem.properties.includes("nav")) continue;
    if (!reader.hasEntry(spineItem.href)) {
      if (spineItem.linear) incompleteLinearItems += 1;
      warnings.push(`Missing EPUB spine resource: ${spineItem.href}`);
      continue;
    }
    if (
      spineItem.mediaType !== "application/xhtml+xml" &&
      spineItem.mediaType !== "image/svg+xml"
    ) {
      if (spineItem.linear) incompleteLinearItems += 1;
      warnings.push(
        `Unsupported EPUB spine media type: ${spineItem.mediaType || "unknown"}`,
      );
      continue;
    }

    let doc: XMLDocument;
    try {
      doc = await reader.readDocument(spineItem.href, spineItem.mediaType);
    } catch {
      if (spineItem.linear) incompleteLinearItems += 1;
      warnings.push(`Unreadable EPUB spine resource: ${spineItem.href}`);
      continue;
    }

    const matchingNodes = navigationNodes.get(spineItem.href) || [];
    const root = getRootElement(doc);
    const hasExplicitSemanticStructure = Boolean(
      root && getSemanticCandidates(root).length,
    );
    let extracted: EpubContentUnit[] = [];
    if (
      hasPublisherNavigation &&
      (matchingNodes.length || (activeNodeId && !hasExplicitSemanticStructure))
    ) {
      const navigation = extractNavigationUnits(
        doc,
        spineItem,
        structure,
        matchingNodes,
        activeNodeId,
      );
      extracted = navigation.units;
      activeNodeId = navigation.activeNodeId;
    }
    if (!extracted.length) {
      extracted = extractFallbackUnits(doc, spineItem, structure);
      if (hasExplicitSemanticStructure) {
        activeNodeId = extracted[extracted.length - 1]?.structureNodeId;
      }
    }
    if (spineItem.linear && !extracted.length) incompleteLinearItems += 1;
    units.push(...extracted);
  }

  const textLength = units.reduce((total, unit) => total + unit.text.length, 0);
  return {
    units,
    structure,
    completeness: !textLength
      ? "unavailable"
      : incompleteLinearItems
        ? "partial"
        : "complete",
    warnings: warnings.length ? warnings : undefined,
  };
}
