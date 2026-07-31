import type { ModelProfileKey } from "./constants";
import type { DocumentKind } from "./document/types";
import type {
  Message,
  DocumentTextContext,
  CustomShortcut,
  ChatAttachment,
  SelectedTextContext,
  PaperContextRef,
} from "./types";

// =============================================================================
// Conversation Context Pool
// =============================================================================

export type ConversationContextPoolEntry = {
  /** Built PDF context text (from the active tab at first message time). */
  basePdfContext: string;
  /** Zotero PDF attachment ID, or null if no base PDF was resolved. */
  basePdfItemId: number | null;
  /** Human-readable title for the base PDF. */
  basePdfTitle: string;
  /** True when the user has explicitly unpinned the base PDF. */
  basePdfRemoved: boolean;
  /** Canonical kind for the legacy-named base context fields above. */
  baseDocumentKind: DocumentKind | null;
  /** Most recently emitted structural segment scope for chat follow-ups. */
  baseDocumentSegmentIds: string[];
  /** Accumulated supplemental paper contexts, keyed by contextItemId. */
  supplementalContexts: Map<
    number,
    {
      ref: PaperContextRef;
      builtContext: string;
      addedAtTurn: number;
    }
  >;
};

/** Per-conversation cache of built document contexts. */
export const conversationContextPool = new Map<
  number,
  ConversationContextPoolEntry
>();

/** Clear a missing/replaced base document without carrying its derived scope. */
export function resetBaseDocumentState(
  entry: ConversationContextPoolEntry,
): void {
  entry.basePdfContext = "";
  entry.basePdfItemId = null;
  entry.basePdfTitle = "";
  entry.baseDocumentKind = null;
  entry.baseDocumentSegmentIds = [];
}

// =============================================================================
// Module State
// =============================================================================

export const chatHistory = new Map<number, Message[]>();
export const loadedConversationKeys = new Set<number>();
export const loadingConversationTasks = new Map<number, Promise<void>>();
export const selectedModelCache = new Map<number, string>();
/** Parallel cache: tracks which provider label the selected model belongs to. */
export const selectedModelProviderCache = new Map<number, string>();

export const documentTextCache = new Map<number, DocumentTextContext>();
export const documentTextLoadingTasks = new Map<number, Promise<void>>();
// Compatibility aliases for existing selection and supplemental-PDF callers.
export const pdfTextCache = documentTextCache;
export const pdfTextLoadingTasks = documentTextLoadingTasks;
export const documentTextRetryAfterByItem = new Map<number, number>();
export const epubTextRetryAfterByItem = documentTextRetryAfterByItem;
export const shortcutTextCache = new Map<string, string>();
export const shortcutMoveModeState = new WeakMap<Element, boolean>();
export const shortcutRenderItemState = new WeakMap<
  Element,
  Zotero.Item | null | undefined
>();
export const shortcutEscapeListenerAttached = new WeakSet<Document>();
export let readerContextPanelRegistered = false;
export function setReaderContextPanelRegistered(value: boolean) {
  readerContextPanelRegistered = value;
}

export let currentRequestId = 0;
export function nextRequestId(): number {
  return ++currentRequestId;
}
type PanelRequestState = {
  latestRequestId: number;
  activeRequestId: number;
  cancelledRequestId: number;
  abortController: AbortController | null;
};

const panelRequestState = new WeakMap<Element, PanelRequestState>();

function ensurePanelRequestState(panel: Element): PanelRequestState {
  let state = panelRequestState.get(panel);
  if (!state) {
    state = {
      latestRequestId: 0,
      activeRequestId: 0,
      cancelledRequestId: -1,
      abortController: null,
    };
    panelRequestState.set(panel, state);
  }
  return state;
}

export function beginPanelRequest(panel: Element, requestId: number): void {
  const state = ensurePanelRequestState(panel);
  state.latestRequestId = requestId;
  state.activeRequestId = requestId;
}

export function getPanelAbortController(
  panel: Element,
): AbortController | null {
  return ensurePanelRequestState(panel).abortController;
}

export function attachPanelAbortController(
  panel: Element,
  requestId: number,
  value: AbortController | null,
): boolean {
  const state = ensurePanelRequestState(panel);
  if (state.activeRequestId !== requestId) {
    value?.abort();
    return false;
  }
  state.abortController = value;
  return true;
}

export function isPanelRequestCancelled(
  panel: Element,
  requestId: number,
): boolean {
  return ensurePanelRequestState(panel).cancelledRequestId >= requestId;
}

export function cancelPanelRequest(panel: Element): number {
  const state = ensurePanelRequestState(panel);
  state.abortController?.abort();
  state.cancelledRequestId = Math.max(
    state.cancelledRequestId,
    state.activeRequestId || state.latestRequestId,
  );
  return state.activeRequestId || state.latestRequestId;
}

export function isPanelGenerating(panel: Element): boolean {
  return ensurePanelRequestState(panel).activeRequestId > 0;
}

export function finishPanelRequest(panel: Element, requestId: number): boolean {
  const state = ensurePanelRequestState(panel);
  if (state.activeRequestId !== requestId) {
    return false;
  }
  state.activeRequestId = 0;
  state.abortController = null;
  return true;
}
export let panelFontScalePercent = 120; // FONT_SCALE_DEFAULT_PERCENT
export function setPanelFontScalePercent(value: number) {
  panelFontScalePercent = value;
}

export let responseMenuTarget: {
  item: Zotero.Item;
  contentText: string;
  modelName: string;
  imageDataUrl?: string;
} | null = null;
export function setResponseMenuTarget(value: typeof responseMenuTarget) {
  responseMenuTarget = value;
}

export let promptMenuTarget: {
  item: Zotero.Item;
  conversationKey: number;
  userTimestamp: number;
  assistantTimestamp: number;
} | null = null;
export function setPromptMenuTarget(value: typeof promptMenuTarget) {
  promptMenuTarget = value;
}

// Screenshot selection state (per item)
export const selectedImageCache = new Map<number, string[]>();
export const selectedFileAttachmentCache = new Map<number, ChatAttachment[]>();
export const selectedFilePreviewExpandedCache = new Map<number, boolean>();
export const selectedPaperContextCache = new Map<number, PaperContextRef[]>();
export const selectedPaperPreviewExpandedCache = new Map<number, boolean>();
export const activeGlobalConversationByLibrary = new Map<number, number>();
export const activeConversationModeByLibrary = new Map<
  number,
  "paper" | "global"
>();
export const selectedTextCache = new Map<number, SelectedTextContext[]>();
export const selectedTextPreviewExpandedCache = new Map<number, number>();
export const selectedImagePreviewExpandedCache = new Map<number, boolean>();
export const selectedImagePreviewActiveIndexCache = new Map<number, number>();
export const recentReaderSelectionCache = new Map<number, string>();
export const draftInputCache = new Map<number, string>();
/** Maps PDF item.id → active paper conversation key (1B range). */
export const activePaperConversationByItem = new Map<number, number>();
