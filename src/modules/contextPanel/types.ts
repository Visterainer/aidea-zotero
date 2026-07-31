import type {
  DocumentCapabilities,
  DocumentCompleteness,
  DocumentChunkMetadata,
  DocumentContextRef,
  DocumentKind,
  DocumentPresentation,
  DocumentStructure,
} from "./document/types";

export type SelectedTextSource = "pdf" | "model";
export type SelectedTextContext = {
  text: string;
  source: SelectedTextSource;
  paperContext?: PaperContextRef;
};

export interface Message {
  messageId?: number;
  parentMessageId?: number | null;
  activeChildMessageId?: number | null;
  branchIndex?: number;
  siblingIndex?: number;
  siblingCount?: number;
  siblingMessageIds?: number[];
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  selectedText?: string;
  selectedTextExpanded?: boolean;
  selectedTexts?: string[];
  selectedTextSources?: SelectedTextSource[];
  selectedTextPaperContexts?: (PaperContextRef | undefined)[];
  selectedTextExpandedIndex?: number;
  screenshotImages?: string[];
  paperContexts?: PaperContextRef[];
  paperContextsExpanded?: boolean;
  attachments?: ChatAttachment[];
  attachmentsExpanded?: boolean;
  attachmentActiveIndex?: number;
  screenshotExpanded?: boolean;
  screenshotActiveIndex?: number;
  modelName?: string;
  /** @deprecated Reasoning is request-scoped and is no longer persisted. */
  reasoningSummary?: string;
  /** @deprecated Reasoning is request-scoped and is no longer persisted. */
  reasoningDetails?: string;
  contextRefs?: {
    baseDocument?: DocumentContextRef;
    basePdf?: {
      itemId: number;
      contextItemId: number;
      title: string;
      removed?: boolean;
    };
    supplementalPapers?: PaperContextRef[];
    fileAttachmentIds?: string[];
    compactedSummary?: string;
  };
  streaming?: boolean;
}
export type ActionDropdownSpec = {
  slotId: string;
  slotClassName: string;
  buttonId: string;
  buttonClassName: string;
  buttonText: string;
  menuId: string;
  menuClassName: string;
  disabled?: boolean;
};
export type AdvancedModelParams = {
  temperature: number;
  maxTokens: number;
};
export type ApiProfile = {
  apiBase: string;
  apiKey: string;
  model: string;
};
export type CustomShortcut = {
  id: string;
  label: string;
  prompt: string;
};
export type ResolvedContextSource = {
  contextItem: Zotero.Item | null;
  statusText: string;
};

export type ChatAttachmentCategory =
  "image" | "pdf" | "markdown" | "code" | "text" | "file";

export type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: ChatAttachmentCategory;
  imageDataUrl?: string;
  textContent?: string;
  storedPath?: string;
  contentHash?: string;
  processing?: boolean;
};

export type DocumentTextContext = {
  title: string;
  chunks: string[];
  chunkStats: ChunkStat[];
  docFreq: Record<string, number>;
  avgChunkLength: number;
  fullLength: number;
  embeddings?: number[][];
  embeddingPromise?: Promise<number[][] | null>;
  embeddingFailed?: boolean;
  /** Format-neutral metadata. Optional for legacy/test-created contexts. */
  documentKind?: DocumentKind;
  documentCapabilities?: DocumentCapabilities;
  completeness?: DocumentCompleteness;
  warnings?: string[];
  fingerprint?: string;
  /** Attachment revision used to invalidate stale extracted text. */
  sourceRevision?: string;
  documentPresentation?: DocumentPresentation;
  chunkMetadata?: DocumentChunkMetadata[];
  /** Publisher/author hierarchy, kept separate from non-overlapping chunks. */
  documentStructure?: DocumentStructure;
};

/** @deprecated Use DocumentTextContext for format-neutral code. */
export type PdfContext = DocumentTextContext;

export type PaperContextRef = {
  itemId: number;
  contextItemId: number;
  citationKey?: string;
  title: string;
  firstCreator?: string;
  year?: string;
};

export type GlobalConversationSummary = {
  conversationKey: number;
  libraryID: number;
  createdAt: number;
  title?: string;
  lastActivityAt: number;
  userTurnCount: number;
  isPinned?: boolean;
};

export type GlobalPortalItem = {
  __llmGlobalPortalItem: true;
  id: number;
  libraryID: number;
  parentID?: number;
  attachmentContentType?: string;
  isAttachment: () => boolean;
  getAttachments: () => number[];
  getField: (field: string) => string;
  isRegularItem: () => boolean;
};

export type ChunkStat = {
  index: number;
  length: number;
  tf: Record<string, number>;
  uniqueTerms: string[];
};

export type ZoteroTabsState = {
  selectedID?: string | number;
  selectedType?: string;
  _tabs?: Array<{ id?: string | number; type?: string; data?: any }>;
};
