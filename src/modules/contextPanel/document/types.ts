export type DocumentKind = "pdf" | "epub";

export type DocumentCapabilities = {
  selectionText: boolean;
  panelChat: boolean;
  structuredSections: boolean;
  navigableLocators: boolean;
  screenshot: boolean;
  fullDocumentTranslation: boolean;
};

export type DocumentPresentation = {
  /** Lower-case noun used in chunk labels, for example `paper` or `book`. */
  noun: string;
  fullTextHeading: string;
  excerptsHeading: string;
  relevantSectionsNotice: string;
  partialRelevantSectionsNotice?: string;
};

export type DocumentCompleteness = "complete" | "partial" | "unavailable";

export type DocumentLocator =
  | {
      kind: "pdf-page";
      pageIndex: number;
      pageLabel?: string;
    }
  | {
      kind: "epub-location";
      cfi?: string;
      href?: string;
      locationLabel?: string;
    };

export type DocumentStructureConfidence =
  "authoritative" | "derived" | "fallback";

/**
 * A format-neutral publisher/author-defined document hierarchy.
 *
 * Structure nodes do not own text. Text lives in non-overlapping
 * DocumentSegments, which can point back to a node through structureNodeId.
 */
export type DocumentStructureNode = {
  id: string;
  parentId?: string;
  childIds: string[];
  label?: string;
  path: string[];
  locator?: DocumentLocator;
  /** Open-ended native semantics, for example EPUB's `chapter` or `notes`. */
  semanticRoles?: string[];
  /** Adapter-defined provenance, for example `epub3-nav` or `pdf-outline`. */
  source: string;
  confidence: DocumentStructureConfidence;
  /** One-based order in the native structure traversal. */
  navigationOrder?: number;
};

export type DocumentStructure = {
  rootIds: string[];
  nodes: DocumentStructureNode[];
};

export type DocumentSegment = {
  id: string;
  title?: string;
  aliases?: string[];
  text: string;
  headingPath?: string[];
  locator?: DocumentLocator;
  role?: "content" | "navigation" | "frontmatter" | "notes";
  /** @deprecated Use readingOrder for TOC order. */
  order?: number;
  /** One-based order in the document's navigation/TOC. */
  readingOrder?: number;
  /** Hierarchical native TOC labels, from broadest to most specific. */
  tocPath?: string[];
  /** Native intra-resource anchor, such as an EPUB element id. */
  fragment?: string;
  /** Native anchor at which this non-overlapping content unit ends. */
  endFragment?: string;
  /** Publisher/author structure represented by this content unit. */
  structureNodeId?: string;
  /** Native structural semantics inherited by this content unit. */
  semanticRoles?: string[];
  /** Extraction provenance, such as `epub3-nav`, `heading`, or `spine`. */
  source?: string;
  confidence?: DocumentStructureConfidence;
  /** Whether this unit belongs to the format's primary reading order. */
  linear?: boolean;
  /** Zero-based native reading-order position. */
  spineIndex?: number;
};

export type DocumentChunkMetadata = {
  segmentId: string;
  title?: string;
  aliases?: string[];
  headingPath?: string[];
  locator?: DocumentLocator;
  order?: number;
  readingOrder?: number;
  tocPath?: string[];
  fragment?: string;
  endFragment?: string;
  structureNodeId?: string;
  semanticRoles?: string[];
  source?: string;
  confidence?: DocumentStructureConfidence;
  linear?: boolean;
  spineIndex?: number;
  role?: DocumentSegment["role"];
};

export type DocumentExtraction = {
  text: string;
  /** Non-overlapping native content units used for bounded retrieval. */
  segments?: DocumentSegment[];
  /** Optional hierarchy kept separate from non-overlapping text segments. */
  structure?: DocumentStructure;
  completeness: DocumentCompleteness;
  warnings?: string[];
  fingerprint?: string;
};

export type DocumentContextPolicy = {
  strategy: "full-or-retrieval" | "retrieval";
  useEmbeddings: boolean;
  maxChunks?: number;
  maxLength?: number;
  /** Warm the extracted context when the reader opens. */
  eagerWarmup?: boolean;
};

export type DocumentSelectionContextPolicy = {
  strategy: "cold-start-cache" | "retrieval";
  /** Whether reader text is valid without a bibliographic paper reference. */
  allowUnattributedSelection: boolean;
  maxChunks?: number;
  maxLength?: number;
};

export type DocumentDescriptor = {
  item: Zotero.Item;
  kind: DocumentKind;
  title: string;
  capabilities: DocumentCapabilities;
};

export type DocumentContextRef = {
  kind: DocumentKind;
  itemId: number;
  contextItemId: number;
  title: string;
  removed?: boolean;
  /** Derived retrieval scope for contextual follow-up questions. */
  retrievalSegmentIds?: string[];
};

export interface DocumentAdapter {
  readonly kind: DocumentKind;
  readonly contentTypes: readonly string[];
  readonly capabilities: DocumentCapabilities;
  readonly presentation: DocumentPresentation;
  readonly contextPolicy: DocumentContextPolicy;
  readonly selectionContextPolicy: DocumentSelectionContextPolicy;
  /**
   * Empty extractions are cached for this long before another extraction is
   * attempted. Omit the value to preserve the existing permanent cache
   * behavior for formats such as PDF.
   */
  readonly emptyCacheRetryDelayMs?: number;
  supports(item: Zotero.Item | null | undefined): item is Zotero.Item;
  describe(item: Zotero.Item): DocumentDescriptor;
  /** Revision of the attachment source used to invalidate extracted context. */
  getSourceRevision?(item: Zotero.Item): Promise<string | undefined>;
  extract(item: Zotero.Item): Promise<DocumentExtraction>;
}
