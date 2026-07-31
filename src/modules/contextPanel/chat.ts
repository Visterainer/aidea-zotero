import { renderMarkdown, renderMarkdownForNote } from "../../utils/markdown";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  findAssistantBubbleByMessageId,
  patchStreamingBubble,
  finalizeStreamingBubble,
  createQueuedStreamingPatch,
  createStreamingAutoScroller,
} from "./streamingUpdate";
import {
  appendMessageNode,
  clearConversation as clearStoredConversation,
  createSiblingBranch,
  loadConversationPath,
  loadConversationTree,
  setActiveChild as setStoredActiveChild,
  updateMessageNode,
  StoredChatMessage,
  ContextRefsJson,
} from "../../utils/chatStore";
import {
  callLLMStream,
  callLLM,
  ChatFileAttachment,
  ChatMessage,
} from "../../utils/llmClient";
import {
  PERSISTED_HISTORY_LIMIT,
  MAX_HISTORY_MESSAGES,
  AUTO_SCROLL_BOTTOM_THRESHOLD,
  MAX_SELECTED_IMAGES,
  MAX_SELECTED_PAPER_CONTEXTS,
  GLOBAL_CONVERSATION_KEY_BASE,
  ACTIVE_PAPER_MULTI_CONTEXT_MAX_CHUNKS,
  ACTIVE_PAPER_MULTI_CONTEXT_MAX_LENGTH,
  CONTEXT_COMPACTION_THRESHOLD,
  RECENT_TURNS_PROTECTED,
} from "./constants";
import type {
  Message,
  AdvancedModelParams,
  ChatAttachment,
  SelectedTextSource,
  PaperContextRef,
  SelectedTextContext,
} from "./types";
import {
  chatHistory,
  loadedConversationKeys,
  loadingConversationTasks,
  selectedModelCache,
  beginPanelRequest,
  isPanelRequestCancelled,
  getPanelAbortController,
  attachPanelAbortController,
  finishPanelRequest,
  isPanelGenerating,
  nextRequestId,
  setResponseMenuTarget,
  setPromptMenuTarget,
  pdfTextCache,
  conversationContextPool,
  ConversationContextPoolEntry,
  selectedFileAttachmentCache,
  selectedPaperContextCache,
  selectedImageCache,
  selectedTextCache,
} from "./state";
import {
  sanitizeText,
  formatTime,
  setStatus,
  getSelectedTextWithinBubble,
  getAttachmentTypeLabel,
  buildQuestionWithSelectedTextContexts,
  buildModelPromptWithFileContext,
  resolvePromptText,
} from "./textUtils";
import {
  getConversationKey,
  isScrollUpdateSuspended,
  withScrollGuard,
  persistChatScrollSnapshot,
  persistChatScrollSnapshotByKey,
  applyChatScrollPolicy,
  scheduleFollowBottomStabilization,
  applyChatScrollSnapshot,
  buildChatScrollSnapshot,
  getChatScrollSnapshot,
  cancelFollowBottomStabilization,
  suspendScrollUpdates,
  resumeScrollUpdates,
} from "./chatScroll";
import {
  normalizeSelectedTextPaperContexts as normalizeSelectedTextPaperContextEntries,
  normalizeSelectedTextSources,
  normalizePaperContextRefs,
  normalizeAttachmentContentHash,
} from "./normalizers";
import { positionMenuAtPointer } from "./menuPositioning";
import {
  getSelectedProfileForItem,
  getApiProfiles,
  getPrimaryConnectionMode,
  getStringPref,
  loadPersistedFileAttachmentIds,
} from "./prefHelpers";
import { buildContext, ensurePDFTextCached } from "./pdfContext";
import {
  buildSupplementalPaperContext,
  buildSinglePaperContext,
} from "./paperContext";
import { formatPaperCitationLabel } from "./paperAttribution";
import { resolveContextSourceItem } from "./contextResolution";
import { buildChatHistoryNotePayload } from "./notes";
import {
  extractManagedBlobHash,
  writeGeneratedImageFileToDirectory,
} from "./attachmentStorage";
import { toFileUrl } from "../../utils/pathFileUrl";
import { replaceOwnerAttachmentRefs } from "../../utils/attachmentRefStore";
import { getPanelI18n, getPanelLang } from "./i18n";
import { getUiLanguageOption } from "./languages";
import {
  autoCaptureUserMemories,
  formatRelevantMemoriesContext,
  resolveMemoryLibraryID,
  searchMemories,
} from "../../utils/memoryStore";

const activeStreamingAssistantMessages = new Map<number, Message>();

function getAbortController(): new () => AbortController {
  return (
    (ztoolkit.getGlobal("AbortController") as new () => AbortController) ||
    (
      globalThis as typeof globalThis & {
        AbortController: new () => AbortController;
      }
    ).AbortController
  );
}

function setHistoryControlsDisabled(body: Element, disabled: boolean): void {
  const historyNewBtn = body.querySelector(
    "#llm-history-new",
  ) as HTMLButtonElement | null;
  if (historyNewBtn) {
    historyNewBtn.disabled = disabled;
    historyNewBtn.setAttribute("aria-disabled", disabled ? "true" : "false");
  }
  // historyToggleBtn is intentionally NOT disabled during generation
  // so users can still open the history menu to browse (but not switch).
  if (disabled) {
    const historyMenu = body.querySelector(
      "#llm-history-menu",
    ) as HTMLDivElement | null;
    if (historyMenu) {
      historyMenu.style.display = "none";
    }
  }
}

function resolveMultimodalRetryHint(
  errorMessage: string,
  imageCount: number,
): string {
  if (imageCount <= 0) return "";
  const normalized = errorMessage.trim().toLowerCase();
  if (!normalized) return "";
  const looksLikeSizeOrTokenIssue =
    normalized.includes("413") ||
    normalized.includes("payload too large") ||
    normalized.includes("request too large") ||
    normalized.includes("context length") ||
    normalized.includes("maximum context") ||
    normalized.includes("too many tokens") ||
    normalized.includes("max_input_tokens") ||
    normalized.includes("input too long");
  if (!looksLikeSizeOrTokenIssue) return "";
  if (imageCount >= 8) {
    return " Try fewer screenshots (for example 4-6) or tighter crops.";
  }
  return " Try fewer screenshots or tighter crops.";
}

function openStoredAttachmentFromMessage(attachment: ChatAttachment): boolean {
  const fileUrl = toFileUrl(attachment.storedPath);
  if (!fileUrl) return false;
  try {
    const launch = (Zotero as any).launchURL as
      ((url: string) => void) | undefined;
    if (typeof launch === "function") {
      launch(fileUrl);
      return true;
    }
  } catch (_err) {
    void _err;
  }
  try {
    const win = Zotero.getMainWindow?.() as
      (Window & { open?: (url?: string, target?: string) => unknown }) | null;
    if (win?.open) {
      win.open(fileUrl, "_blank");
      return true;
    }
  } catch (_err) {
    void _err;
  }
  return false;
}

function normalizeSelectedTexts(
  selectedTexts: unknown,
  legacySelectedText?: unknown,
): string[] {
  const normalize = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return sanitizeText(value).trim();
  };
  if (Array.isArray(selectedTexts)) {
    return selectedTexts.map((value) => normalize(value)).filter(Boolean);
  }
  const legacy = normalize(legacySelectedText);
  return legacy ? [legacy] : [];
}

function normalizeSelectedTextPaperContextsByIndex(
  selectedTextPaperContexts: unknown,
  count: number,
): (PaperContextRef | undefined)[] {
  return normalizeSelectedTextPaperContextEntries(
    selectedTextPaperContexts,
    count,
    {
      sanitizeText,
    },
  );
}

function normalizePaperContexts(paperContexts: unknown): PaperContextRef[] {
  return normalizePaperContextRefs(paperContexts, { sanitizeText });
}

function getVisibleHistoryPaperContexts(msg: Message): PaperContextRef[] {
  const paperContexts = normalizePaperContexts(msg.paperContexts);
  const basePdf = msg.contextRefs?.basePdf;
  if (!basePdf || basePdf.removed) return paperContexts;
  return paperContexts.filter(
    (ref) =>
      ref.contextItemId !== basePdf.contextItemId &&
      ref.itemId !== basePdf.contextItemId &&
      ref.contextItemId !== basePdf.itemId &&
      ref.itemId !== basePdf.itemId,
  );
}

function collectAttachmentHashesFromStoredMessages(
  messages: StoredChatMessage[],
): string[] {
  const hashes = new Set<string>();
  for (const message of messages) {
    const attachments = Array.isArray(message.attachments)
      ? message.attachments
      : [];
    for (const attachment of attachments) {
      if (!attachment || attachment.category === "image") continue;
      const contentHash =
        normalizeAttachmentContentHash(attachment.contentHash) ||
        extractManagedBlobHash(attachment.storedPath);
      if (!contentHash) continue;
      hashes.add(contentHash);
    }
  }
  return Array.from(hashes);
}

function getMessageSelectedTexts(message: Message): string[] {
  return normalizeSelectedTexts(message.selectedTexts, message.selectedText);
}

type UserContextPopoverDisplay = "block" | "flex" | "grid";

let activeUserContextPopoverClose: (() => void) | null = null;

function closeActiveUserContextPopover(): void {
  const close = activeUserContextPopoverClose;
  if (!close) return;
  activeUserContextPopoverClose = null;
  close();
}

function getUserContextPopoverBounds(
  body: Element,
  win: Window,
): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const viewport = {
    left: 0,
    top: 0,
    right: win.innerWidth,
    bottom: win.innerHeight,
    width: win.innerWidth,
    height: win.innerHeight,
  };
  const bodyRect = body.getBoundingClientRect();
  if (bodyRect.width <= 0 || bodyRect.height <= 0) return viewport;
  const left = Math.max(viewport.left, bodyRect.left);
  const top = Math.max(viewport.top, bodyRect.top);
  const right = Math.min(viewport.right, bodyRect.right);
  const bottom = Math.min(viewport.bottom, bodyRect.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return viewport;
  return { left, top, right, bottom, width, height };
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function positionUserContextPopover(
  body: Element,
  anchor: HTMLElement,
  popover: HTMLElement,
  display: UserContextPopoverDisplay,
): void {
  const doc = body.ownerDocument;
  if (!doc) return;
  const win = doc.defaultView;
  if (!win) return;

  const margin = 8;
  const gap = 6;
  const bounds = getUserContextPopoverBounds(body, win);
  const anchorRect = anchor.getBoundingClientRect();
  const availableWidth = Math.max(180, bounds.width - margin * 2);
  const preferredWidth = Number.parseFloat(
    popover.dataset.preferredWidth || "",
  );
  const popoverWidth = Math.min(
    Number.isFinite(preferredWidth) && preferredWidth > 0
      ? preferredWidth
      : 620,
    availableWidth,
  );

  popover.hidden = false;
  popover.style.display = display;
  popover.style.position = "fixed";
  popover.style.width = `${popoverWidth}px`;
  popover.style.maxWidth = `${popoverWidth}px`;
  popover.style.left = "0px";
  popover.style.top = "0px";
  popover.style.maxHeight = "";
  popover.style.visibility = "hidden";

  const naturalHeight = Math.max(
    80,
    Math.min(
      popover.scrollHeight || popover.offsetHeight || 0,
      420,
      Math.max(80, bounds.height - margin * 2),
    ),
  );
  const availableBelow = Math.max(
    0,
    bounds.bottom - anchorRect.bottom - gap - margin,
  );
  const availableAbove = Math.max(
    0,
    anchorRect.top - bounds.top - gap - margin,
  );
  const placeBelow =
    availableBelow >= Math.min(naturalHeight, 220) ||
    availableBelow >= availableAbove;
  const availableHeight = placeBelow ? availableBelow : availableAbove;
  const maxHeight = Math.max(
    80,
    Math.min(
      naturalHeight,
      Math.max(80, availableHeight),
      Math.max(80, bounds.height - margin * 2),
    ),
  );

  popover.style.maxHeight = `${maxHeight}px`;
  const measuredHeight = Math.min(popover.offsetHeight || maxHeight, maxHeight);
  const left = clampNumber(
    anchorRect.right - popoverWidth,
    bounds.left + margin,
    bounds.right - margin - popoverWidth,
  );
  const rawTop = placeBelow
    ? anchorRect.bottom + gap
    : anchorRect.top - gap - measuredHeight;
  const top = clampNumber(
    rawTop,
    bounds.top + margin,
    bounds.bottom - margin - measuredHeight,
  );

  popover.classList.toggle("llm-user-context-popover-above", !placeBelow);
  popover.classList.toggle("llm-user-context-popover-below", placeBelow);
  popover.style.left = `${Math.round(left)}px`;
  popover.style.top = `${Math.round(top)}px`;
  popover.style.visibility = "";
}

function openUserContextPopover(params: {
  body: Element;
  chatBox: HTMLDivElement;
  anchor: HTMLElement;
  popover: HTMLElement;
  display: UserContextPopoverDisplay;
  close: () => void;
}): void {
  closeActiveUserContextPopover();

  const { body, chatBox, anchor, popover, display, close } = params;
  const doc = body.ownerDocument;
  if (!doc) return;
  const win = doc.defaultView;
  let disposed = false;
  let listenersAttached = false;

  const cleanup = () => {
    if (!listenersAttached) return;
    listenersAttached = false;
    doc.removeEventListener("mousedown", handleDocumentMouseDown, true);
    doc.removeEventListener("keydown", handleDocumentKeyDown, true);
    chatBox.removeEventListener("scroll", handleScroll);
    win?.removeEventListener("resize", handleResize, true);
  };
  const closeSelf = () => {
    if (disposed) return;
    disposed = true;
    cleanup();
    if (activeUserContextPopoverClose === closeSelf) {
      activeUserContextPopoverClose = null;
    }
    close();
  };
  const handleDocumentMouseDown = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && (anchor.contains(target) || popover.contains(target))) {
      return;
    }
    closeSelf();
  };
  const handleDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      closeSelf();
    }
  };
  const handleScroll = () => {
    closeSelf();
  };
  const handleResize = () => {
    if (!disposed) {
      positionUserContextPopover(body, anchor, popover, display);
    }
  };

  positionUserContextPopover(body, anchor, popover, display);
  activeUserContextPopoverClose = closeSelf;
  win?.setTimeout(() => {
    if (disposed) return;
    listenersAttached = true;
    doc.addEventListener("mousedown", handleDocumentMouseDown, true);
    doc.addEventListener("keydown", handleDocumentKeyDown, true);
    chatBox.addEventListener("scroll", handleScroll, { passive: true });
    win.addEventListener("resize", handleResize, true);
  }, 0);
}

function createReadonlyContextRemovePlaceholder(
  doc: Document,
): HTMLSpanElement {
  const placeholder = doc.createElement("span") as HTMLSpanElement;
  placeholder.className =
    "llm-selected-context-clear llm-history-context-remove-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

function getUserBubbleElement(wrapper: HTMLElement): HTMLDivElement | null {
  const children = Array.from(wrapper.children) as HTMLElement[];
  for (const child of children) {
    if (
      child.classList.contains("llm-bubble") &&
      child.classList.contains("user")
    ) {
      return child as HTMLDivElement;
    }
  }
  return null;
}

export function syncUserContextAlignmentWidths(body: Element): void {
  const chatBox = body.querySelector("#llm-chat-box") as HTMLDivElement | null;
  if (!chatBox) return;
  const wrappers = Array.from(
    chatBox.querySelectorAll(
      ".llm-message-wrapper.user.llm-user-context-aligned",
    ),
  ) as HTMLDivElement[];
  for (const wrapper of wrappers) {
    const bubble = getUserBubbleElement(wrapper);
    if (!bubble) {
      wrapper.style.removeProperty("--llm-user-bubble-width");
      continue;
    }
    const bubbleWidth = Math.round(bubble.getBoundingClientRect().width);
    if (bubbleWidth > 0) {
      wrapper.style.setProperty("--llm-user-bubble-width", `${bubbleWidth}px`);
    } else {
      wrapper.style.removeProperty("--llm-user-bubble-width");
    }
  }
}

// Re-export scroll utilities so existing consumers of chat.ts don't break
export {
  getConversationKey,
  isScrollUpdateSuspended,
  withScrollGuard,
  persistChatScrollSnapshot,
} from "./chatScroll";

async function syncConversationAttachmentRefs(
  conversationKey: number,
): Promise<void> {
  const storedMessages = await loadConversationTree(conversationKey);
  const attachmentHashes =
    collectAttachmentHashesFromStoredMessages(storedMessages);
  await replaceOwnerAttachmentRefs(
    "conversation",
    conversationKey,
    attachmentHashes,
  );
}

async function persistConversationMessage(
  conversationKey: number,
  message: StoredChatMessage,
  parentMessageId?: number | null,
): Promise<number> {
  try {
    const messageId = await appendMessageNode(
      conversationKey,
      message,
      parentMessageId,
    );
    await syncConversationAttachmentRefs(conversationKey);
    return messageId;
  } catch (err) {
    ztoolkit.log("LLM: Failed to persist chat message", err);
    return 0;
  }
}

function toPanelMessage(message: StoredChatMessage): Message {
  const screenshotImages = Array.isArray(message.screenshotImages)
    ? message.screenshotImages.filter((entry) => Boolean(entry))
    : undefined;
  const attachments = Array.isArray(message.attachments)
    ? message.attachments.filter(
        (entry) =>
          Boolean(entry) &&
          typeof entry === "object" &&
          typeof entry.id === "string" &&
          Boolean(entry.id.trim()) &&
          typeof entry.name === "string" &&
          Boolean(entry.name.trim()),
      )
    : undefined;
  const selectedTexts = normalizeSelectedTexts(
    message.selectedTexts,
    message.selectedText,
  );
  const selectedTextSources = normalizeSelectedTextSources(
    message.selectedTextSources,
    selectedTexts.length,
  );
  const selectedTextPaperContexts = normalizeSelectedTextPaperContextsByIndex(
    message.selectedTextPaperContexts,
    selectedTexts.length,
  );
  const paperContexts = normalizePaperContexts(message.paperContexts);
  return {
    messageId: message.messageId,
    parentMessageId: message.parentMessageId,
    activeChildMessageId: message.activeChildMessageId,
    branchIndex: message.branchIndex,
    siblingIndex: message.siblingIndex,
    siblingCount: message.siblingCount,
    siblingMessageIds: message.siblingMessageIds,
    role: message.role,
    text: message.text,
    timestamp: message.timestamp,
    selectedText: selectedTexts[0] || message.selectedText,
    selectedTextExpanded: false,
    selectedTexts: selectedTexts.length ? selectedTexts : undefined,
    selectedTextSources: selectedTextSources.length
      ? selectedTextSources
      : undefined,
    selectedTextPaperContexts: selectedTextPaperContexts.some((entry) =>
      Boolean(entry),
    )
      ? selectedTextPaperContexts
      : undefined,
    selectedTextExpandedIndex: -1,
    paperContexts: paperContexts.length ? paperContexts : undefined,
    paperContextsExpanded: false,
    screenshotImages,
    attachments,
    attachmentsExpanded: false,
    screenshotExpanded: false,
    screenshotActiveIndex: screenshotImages?.length ? 0 : undefined,
    modelName: message.modelName,
    reasoningSummary: message.reasoningSummary,
    reasoningDetails: message.reasoningDetails,
    contextRefs: message.contextRefs,
  };
}

function overlayActiveStreamingMessage(message: Message): Message {
  if (!message.messageId) return message;
  const streaming = activeStreamingAssistantMessages.get(message.messageId);
  if (!streaming) return message;
  return {
    ...message,
    text: streaming.text,
    timestamp: streaming.timestamp,
    modelName: streaming.modelName,
    reasoningSummary: streaming.reasoningSummary,
    reasoningDetails: streaming.reasoningDetails,
    streaming: true,
  };
}

export async function ensureConversationLoaded(
  item: Zotero.Item,
): Promise<void> {
  const conversationKey = getConversationKey(item);

  if (loadedConversationKeys.has(conversationKey)) return;
  if (chatHistory.has(conversationKey)) {
    loadedConversationKeys.add(conversationKey);
    return;
  }

  const existingTask = loadingConversationTasks.get(conversationKey);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    try {
      const storedMessages = await loadConversationPath(
        conversationKey,
        PERSISTED_HISTORY_LIMIT,
      );
      chatHistory.set(
        conversationKey,
        storedMessages.map((message) =>
          overlayActiveStreamingMessage(toPanelMessage(message)),
        ),
      );
      // Phase 2: Restore conversation context pool from DB refs.
      restoreContextPoolFromStoredMessages(conversationKey, storedMessages);

      // Fallback: if pool was NOT restored (older messages without context_refs_json)
      // but the item is a PDF attachment (Reader mode), create a minimal pool
      // so the base PDF chip still appears.
      if (
        !conversationContextPool.has(conversationKey) &&
        storedMessages.length > 0 &&
        item.isAttachment?.() &&
        item.attachmentContentType === "application/pdf"
      ) {
        const parentTitle =
          (item.parentItem?.getField?.("title") as string) || "";
        conversationContextPool.set(conversationKey, {
          basePdfContext: "", // Lazy: rebuilt on next send.
          basePdfItemId: item.id,
          basePdfTitle: parentTitle || "Active Document",
          basePdfRemoved: false,
          supplementalContexts: new Map(),
        });
        ztoolkit.log(
          `LLM: Created fallback pool for PDF item ${item.id} (no context_refs_json in stored messages)`,
        );
      }

      // Phase 5: Restore file attachments from the last user message.
      restoreFileAttachmentsFromMessages(
        item.id,
        conversationKey,
        storedMessages,
      );
      // Phase 6: Restore paper context chips from the last user message.
      restorePaperContextsFromMessages(
        item.id,
        conversationKey,
        storedMessages,
      );
      // Phase 7: Restore screenshots from the last user message.
      restoreScreenshotsFromMessages(item.id, storedMessages);
      // Phase 8: Restore selected text contexts from the last user message.
      restoreSelectedTextsFromMessages(conversationKey, storedMessages);
    } catch (err) {
      ztoolkit.log("LLM: Failed to load chat history", err);
      if (!chatHistory.has(conversationKey)) {
        chatHistory.set(conversationKey, []);
      }
    } finally {
      loadedConversationKeys.add(conversationKey);
      loadingConversationTasks.delete(conversationKey);
    }
  })();

  loadingConversationTasks.set(conversationKey, task);
  await task;
}

export async function reloadActiveConversationPath(
  item: Zotero.Item,
  options?: { forceContextRestore?: boolean },
): Promise<Message[]> {
  const conversationKey = getConversationKey(item);
  const storedMessages = await loadConversationPath(
    conversationKey,
    PERSISTED_HISTORY_LIMIT,
  );
  const panelMessages = storedMessages.map((message) =>
    overlayActiveStreamingMessage(toPanelMessage(message)),
  );
  chatHistory.set(conversationKey, panelMessages);
  loadedConversationKeys.add(conversationKey);
  restoreContextPoolFromStoredMessages(conversationKey, storedMessages, {
    force: options?.forceContextRestore,
  });
  return panelMessages;
}

export async function switchConversationVariant(
  body: Element,
  item: Zotero.Item,
  parentMessageId: number | null,
  childMessageId: number,
): Promise<void> {
  const conversationKey = getConversationKey(item);
  await setStoredActiveChild(conversationKey, parentMessageId, childMessageId);
  loadedConversationKeys.delete(conversationKey);
  await reloadActiveConversationPath(item, { forceContextRestore: true });
  refreshChat(body, item);
}

export async function copyTextToClipboard(
  body: Element,
  text: string,
): Promise<void> {
  const safeText = sanitizeText(text).trim();
  if (!safeText) return;

  const win = body.ownerDocument?.defaultView as
    (Window & { navigator?: Navigator }) | undefined;
  if (win?.navigator?.clipboard?.writeText) {
    try {
      await win.navigator.clipboard.writeText(safeText);
      return;
    } catch (err) {
      ztoolkit.log("Clipboard API copy failed:", err);
    }
  }

  try {
    const helper = (
      globalThis as typeof globalThis & {
        Components?: {
          classes: Record<string, { getService: (iface: unknown) => unknown }>;
          interfaces: Record<string, unknown>;
        };
      }
    ).Components;
    const svc = helper?.classes?.[
      "@mozilla.org/widget/clipboardhelper;1"
    ]?.getService(helper.interfaces.nsIClipboardHelper) as
      { copyString: (value: string) => void } | undefined;
    if (svc) svc.copyString(safeText);
  } catch (err) {
    ztoolkit.log("Clipboard fallback copy failed:", err);
  }
}

/**
 * Render markdown text through renderMarkdownForNote and copy the result
 * to the clipboard as both text/html and text/plain.  When pasted into a
 * Zotero note, the HTML version is used, producing the same rendering as
 * "Save as note".  When pasted into a plain-text editor, the raw markdown
 * is used, matching "Copy chat as md".
 */
export async function copyRenderedMarkdownToClipboard(
  body: Element,
  markdownText: string,
): Promise<void> {
  const safeText = sanitizeText(markdownText).trim();
  if (!safeText) return;

  let renderedHtml = "";
  try {
    renderedHtml = renderMarkdownForNote(safeText);
  } catch (err) {
    ztoolkit.log("LLM: Copy markdown render error:", err);
  }

  // Try rich clipboard (HTML + plain) first so that paste into Zotero
  // notes gives properly rendered content with math.
  if (renderedHtml) {
    const win = body.ownerDocument?.defaultView as
      | (Window & {
          navigator?: Navigator;
          ClipboardItem?: new (items: Record<string, Blob>) => ClipboardItem;
        })
      | undefined;
    if (win?.navigator?.clipboard?.write && win.ClipboardItem) {
      try {
        const item = new win.ClipboardItem({
          "text/html": new Blob([renderedHtml], { type: "text/html" }),
          "text/plain": new Blob([safeText], { type: "text/plain" }),
        });
        await win.navigator.clipboard.write([item]);
        return;
      } catch (err) {
        ztoolkit.log("LLM: Rich clipboard write failed, falling back:", err);
      }
    }
  }

  // Fallback: copy raw markdown as plain text.
  await copyTextToClipboard(body, safeText);
}

function getImageExtensionFromMime(mime: string): string {
  const normalized = mime.toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/bmp") return "bmp";
  if (normalized === "image/svg+xml") return "svg";
  const suffix = normalized
    .replace(/^image\//, "")
    .replace(/\+xml$/, "")
    .replace(/[^a-z0-9]/g, "");
  return suffix || "png";
}

function decodeBase64ImageBytes(body: Element, base64: string): Uint8Array {
  const win = body.ownerDocument?.defaultView as
    (Window & { atob?: (data: string) => string }) | undefined;
  const globalAtob = (globalThis as { atob?: (data: string) => string }).atob;
  const atobFn = win?.atob?.bind(win) || globalAtob?.bind(globalThis);
  if (!atobFn) {
    throw new Error("No base64 decoder available");
  }
  const binary = atobFn(base64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseGeneratedImageDataUrl(
  body: Element,
  dataUrl: string,
): { bytes: Uint8Array; extension: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const mime = (match[1] || "image/png").toLowerCase();
  const bytes = decodeBase64ImageBytes(body, match[2] || "");
  if (!bytes.length) return null;
  return {
    bytes,
    extension: getImageExtensionFromMime(mime),
  };
}

export function getGeneratedImageDataUrlFromElement(
  target: Element | null,
): string {
  const image = target?.closest?.(
    "img.llm-markdown-image",
  ) as HTMLImageElement | null;
  const src = image?.src?.trim() || "";
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(src) ? src : "";
}

export async function exportGeneratedImageDataUrl(
  body: Element,
  dataUrl: string,
): Promise<string | null> {
  const parsed = parseGeneratedImageDataUrl(body, dataUrl);
  if (!parsed) throw new Error("Invalid generated image data");
  const { pickDirectory } = await import("../pdfTranslator/nativePicker");
  const win = body.ownerDocument?.defaultView || undefined;
  const dirPath = await pickDirectory(win);
  if (!dirPath) return null;
  return writeGeneratedImageFileToDirectory(
    dirPath,
    parsed.bytes,
    parsed.extension,
  );
}

type PanelRequestUI = {
  inputBox: HTMLTextAreaElement | null;
  chatBox: HTMLDivElement | null;
  sendBtn: HTMLButtonElement | null;
  cancelBtn: HTMLButtonElement | null;
  status: HTMLElement | null;
};

function getPanelRequestUI(body: Element): PanelRequestUI {
  return {
    inputBox: body.querySelector("#llm-input") as HTMLTextAreaElement | null,
    chatBox: body.querySelector("#llm-chat-box") as HTMLDivElement | null,
    sendBtn: body.querySelector("#llm-send") as HTMLButtonElement | null,
    cancelBtn: body.querySelector("#llm-cancel") as HTMLButtonElement | null,
    status: body.querySelector("#llm-status") as HTMLElement | null,
  };
}

function setRequestUIBusy(
  body: Element,
  ui: PanelRequestUI,
  conversationKey: number,
  statusText: string,
): void {
  withScrollGuard(ui.chatBox, conversationKey, () => {
    if (ui.sendBtn) ui.sendBtn.style.display = "none";
    if (ui.cancelBtn) ui.cancelBtn.style.display = "";
    if (ui.status) setStatus(ui.status, statusText, "sending");
  });
  setHistoryControlsDisabled(body, true);
}

function restoreRequestUIIdle(
  body: Element,
  ui: PanelRequestUI,
  conversationKey: number,
  requestId: number,
): void {
  if (isPanelRequestCancelled(body, requestId)) return;
  withScrollGuard(ui.chatBox, conversationKey, () => {
    if (ui.inputBox) {
      ui.inputBox.focus({ preventScroll: true });
    }
    if (ui.sendBtn) {
      ui.sendBtn.style.display = "";
      ui.sendBtn.disabled = false;
    }
    if (ui.cancelBtn) ui.cancelBtn.style.display = "none";
  });
}

function createPanelUpdateHelpers(
  body: Element,
  item: Zotero.Item,
  conversationKey: number,
  ui: PanelRequestUI,
): {
  refreshChatSafely: () => void;
  setStatusSafely: (
    text: string,
    kind: Parameters<typeof setStatus>[2],
  ) => void;
} {
  const refreshChatSafely = () => {
    withScrollGuard(ui.chatBox, conversationKey, () => {
      refreshChat(body, item);
    });
  };
  const setStatusSafely = (
    text: string,
    kind: Parameters<typeof setStatus>[2],
  ) => {
    if (!ui.status) return;
    withScrollGuard(ui.chatBox, conversationKey, () => {
      setStatus(ui.status as HTMLElement, text, kind);
    });
  };
  return { refreshChatSafely, setStatusSafely };
}

type EffectiveRequestConfig = {
  model: string;
  apiBase: string;
  apiKey: string;
  advanced?: AdvancedModelParams;
};

function shouldRewriteApiBaseForDetectedProvider(apiBase: string): boolean {
  const normalized = apiBase.trim();
  // Only auto-detect when apiBase is truly empty.
  // An existing oauth:// marker was already resolved with provider
  // disambiguation by resolveModelCredentials; overwriting it here with
  // detectProviderForModel (which picks the first match) would break
  // same-name models across different providers.
  return !normalized;
}

export function resolveEffectiveRequestConfig(params: {
  item: Zotero.Item;
  model?: string;
  apiBase?: string;
  apiKey?: string;
  advanced?: AdvancedModelParams;
}): EffectiveRequestConfig {
  const primaryConnectionMode = getPrimaryConnectionMode();
  const fallbackProfile = getSelectedProfileForItem(params.item.id);
  const primaryProfile = getApiProfiles().primary;
  const modelFallback =
    primaryConnectionMode === "custom"
      ? getStringPref("model")
      : getStringPref("model") || "gpt-4o-mini";
  const model = (
    params.model ||
    fallbackProfile.model ||
    primaryProfile.model ||
    modelFallback
  ).trim();
  let apiBase = (params.apiBase ?? fallbackProfile.apiBase ?? "").trim();
  const apiKey = (
    params.apiKey ??
    fallbackProfile.apiKey ??
    primaryProfile.apiKey ??
    ""
  ).trim();

  if (primaryConnectionMode === "custom") {
    const missing: string[] = [];
    if (!apiBase) missing.push("API Base URL");
    if (!model) missing.push("Model");
    if (missing.length > 0) {
      throw new Error(
        `Custom mode requires ${missing.join(" and ")} before sending`,
      );
    }
  }

  if (model && shouldRewriteApiBaseForDetectedProvider(apiBase)) {
    const detectedProvider = detectProviderForModel(model);
    if (detectedProvider) {
      const correctMarker = `oauth://${detectedProvider}`;
      if (apiBase !== correctMarker) {
        apiBase = correctMarker;
      }
    }
  }

  return { model, apiBase, apiKey, advanced: params.advanced };
}

/**
 * Detect which OAuth provider owns a model by checking the oauthModelListCache.
 */
function detectProviderForModel(modelName: string): string | null {
  try {
    const cacheRaw = getStringPref("oauthModelListCache").trim();
    if (!cacheRaw) return null;
    const cache = JSON.parse(cacheRaw) as Record<string, Array<{ id: string }>>;
    const normalized = modelName.trim().toLowerCase();
    for (const [providerKey, models] of Object.entries(cache)) {
      if (!Array.isArray(models)) continue;
      for (const m of models) {
        if (
          String(m.id || "")
            .trim()
            .toLowerCase() === normalized
        ) {
          return providerKey;
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

async function buildCombinedContextForRequest(params: {
  item: Zotero.Item;
  question: string;
  imageCount: number;
  paperContexts: PaperContextRef[];
  apiBase: string;
  apiKey: string;
  conversationKey: number;
  setStatusSafely: (
    text: string,
    kind: Parameters<typeof setStatus>[2],
  ) => void;
}): Promise<string> {
  // ── Get or create the conversation-level context pool ──
  let pool = conversationContextPool.get(params.conversationKey);
  if (!pool) {
    pool = {
      basePdfContext: "",
      basePdfItemId: null,
      basePdfTitle: "",
      basePdfRemoved: false,
      supplementalContexts: new Map(),
    };
    conversationContextPool.set(params.conversationKey, pool);
  }

  // ── Zone A: Memory context (re-queried every turn) ──
  const memoryLibraryID = resolveMemoryLibraryID(params.item);
  let memoryContext = "";
  if (memoryLibraryID && params.question.trim()) {
    try {
      const memories = await searchMemories({
        libraryID: memoryLibraryID,
        query: params.question,
        limit: 3,
        minScore: 0.35,
      });
      if (memories.length) {
        memoryContext = formatRelevantMemoriesContext(
          memories.map((entry) => ({
            category: entry.entry.category,
            text: entry.entry.text,
          })),
        );
        params.setStatusSafely(
          `Using ${memories.length} memory item(s)`,
          "sending",
        );
      }
    } catch (err) {
      ztoolkit.log("LLM: Memory recall failed", err);
    }
  }

  // ── Zone A: Base PDF context (cached after first build) ──
  const hasSupplementalPaperContexts = params.paperContexts.length > 0;
  let pdfContext = "";
  if (pool.basePdfRemoved) {
    // User explicitly unpinned the base PDF — send nothing.
    pdfContext = "";
    ztoolkit.log("LLM context: base PDF was unpinned by user");
  } else if (pool.basePdfContext) {
    // Subsequent turns: use the cached context, no tab dependency.
    pdfContext = pool.basePdfContext;
    params.setStatusSafely(
      getPanelI18n().usingCachedDocumentContext,
      "sending",
    );
    ztoolkit.log(
      `LLM context: using cached basePdfContext (${pdfContext.length} chars, itemId=${pool.basePdfItemId})`,
    );
  } else if (pool.basePdfItemId !== null) {
    // Pool was restored from DB with a known item ID but empty text.
    // Rebuild from the stored ID instead of re-resolving from the current tab.
    params.setStatusSafely(getPanelI18n().rebuildingDocumentContext, "sending");
    try {
      const ctxItem = getZoteroItem(pool.basePdfItemId);
      if (ctxItem) {
        await ensurePDFTextCached(ctxItem);
        const cached = pdfTextCache.get(ctxItem.id);
        pdfContext = await buildContext(
          cached,
          params.question,
          params.imageCount > 0,
          { apiBase: params.apiBase, apiKey: params.apiKey },
          {
            forceRetrieval: hasSupplementalPaperContexts,
            maxChunks: hasSupplementalPaperContexts
              ? ACTIVE_PAPER_MULTI_CONTEXT_MAX_CHUNKS
              : undefined,
            maxLength: hasSupplementalPaperContexts
              ? ACTIVE_PAPER_MULTI_CONTEXT_MAX_LENGTH
              : undefined,
          },
        );
        pool.basePdfContext = pdfContext;
        ztoolkit.log(
          `LLM context: rebuilt basePdfContext from stored ID ${pool.basePdfItemId} (${pdfContext.length} chars)`,
        );
      } else {
        ztoolkit.log(
          `LLM context: stored basePdfItemId=${pool.basePdfItemId} no longer exists`,
        );
        pool.basePdfItemId = null;
      }
    } catch (err) {
      ztoolkit.log("LLM context: failed to rebuild from stored ID", err);
      pool.basePdfItemId = null;
    }
  } else {
    // First turn: resolve from tab and cache.
    const contextSource = resolveContextSourceItem(params.item);
    params.setStatusSafely(contextSource.statusText, "sending");
    if (contextSource.contextItem) {
      const ctxItem = contextSource.contextItem;
      ztoolkit.log(
        `LLM context: item=${ctxItem.id}, isAttachment=${ctxItem.isAttachment()}, ` +
          `contentType=${ctxItem.attachmentContentType || "N/A"}, hasCachedText=${pdfTextCache.has(ctxItem.id)}`,
      );
      await ensurePDFTextCached(ctxItem);
      const cached = pdfTextCache.get(ctxItem.id);
      ztoolkit.log(
        `LLM context: cached chunks=${cached?.chunks?.length ?? 0}, fullLength=${cached?.fullLength ?? 0}`,
      );
      pdfContext = await buildContext(
        cached,
        params.question,
        params.imageCount > 0,
        { apiBase: params.apiBase, apiKey: params.apiKey },
        {
          forceRetrieval: hasSupplementalPaperContexts,
          maxChunks: hasSupplementalPaperContexts
            ? ACTIVE_PAPER_MULTI_CONTEXT_MAX_CHUNKS
            : undefined,
          maxLength: hasSupplementalPaperContexts
            ? ACTIVE_PAPER_MULTI_CONTEXT_MAX_LENGTH
            : undefined,
        },
      );
      // Lock into the pool.
      pool.basePdfContext = pdfContext;
      pool.basePdfItemId = ctxItem.id;
      try {
        const parentItem = ctxItem.parentID
          ? getZoteroItem(ctxItem.parentID)
          : null;
        pool.basePdfTitle =
          (parentItem ? parentItem.getField("title") : "") ||
          ctxItem.getField("title") ||
          "Document";
      } catch (_e) {
        pool.basePdfTitle = "Document";
      }
      ztoolkit.log(
        `LLM context: pdfContext length=${pdfContext.length} (cached to pool)`,
      );
    } else {
      ztoolkit.log(
        `LLM context: no contextItem resolved. statusText="${contextSource.statusText}"`,
      );
    }
  }

  // ── Zone A: Supplemental paper contexts (accumulated) ──
  // Build only new papers; reuse already-built ones from the pool.
  // Filter out any supplemental paper that is the same as the base PDF
  // to avoid injecting the same document content twice.
  const rawPaperRefs = params.paperContexts;
  const currentPaperRefs =
    pool.basePdfItemId !== null && !pool.basePdfRemoved
      ? rawPaperRefs.filter(
          (ref) =>
            ref.contextItemId !== pool.basePdfItemId &&
            ref.itemId !== pool.basePdfItemId,
        )
      : rawPaperRefs;
  const currentRefIds = new Set(
    currentPaperRefs.map((ref) => ref.contextItemId),
  );
  // Remove papers that the user has unpinned from the preview area.
  for (const existingId of pool.supplementalContexts.keys()) {
    if (!currentRefIds.has(existingId)) {
      pool.supplementalContexts.delete(existingId);
      ztoolkit.log(
        `LLM context: removed unpinned supplemental paper contextItemId=${existingId}`,
      );
    }
  }
  // Build newly added papers or rebuild DB-restored ones with empty content.
  const turnNumber = (chatHistory.get(params.conversationKey)?.length ?? 0) + 1;
  for (const ref of currentPaperRefs) {
    const existing = pool.supplementalContexts.get(ref.contextItemId);
    if (existing && existing.builtContext) continue; // Already built, skip.
    const built = await buildSinglePaperContext(
      ref,
      params.question,
      pool.supplementalContexts.size,
      { apiBase: params.apiBase, apiKey: params.apiKey },
    );
    pool.supplementalContexts.set(ref.contextItemId, {
      ref,
      builtContext: built,
      addedAtTurn: existing?.addedAtTurn ?? turnNumber,
    });
    ztoolkit.log(
      `LLM context: ${existing ? "rebuilt" : "built"} supplemental paper contextItemId=${ref.contextItemId} (${built.length} chars)`,
    );
  }
  if (pool.supplementalContexts.size > 0) {
    params.setStatusSafely(
      getPanelI18n().paperCount(pool.supplementalContexts.size, Number.NaN),
      "sending",
    );
  }

  // ── Combine all Zone A segments ──
  const supplementalBlocks = [...pool.supplementalContexts.values()]
    .map((entry) => entry.builtContext)
    .filter(Boolean);
  const supplementalPaperContext = supplementalBlocks.length
    ? `Supplemental Paper Contexts:\n\n${supplementalBlocks.join("\n\n---\n\n")}`
    : "";

  return [memoryContext, pdfContext, supplementalPaperContext]
    .map((entry) => sanitizeText(entry || "").trim())
    .filter(Boolean)
    .join("\n\n====================\n\n");
}

/**
 * Build a lightweight snapshot of the current context pool for DB persistence.
 * Only stores references (itemId, title), not the full text.
 */
function buildContextRefsSnapshot(
  conversationKey: number,
): ContextRefsJson | undefined {
  const pool = conversationContextPool.get(conversationKey);
  if (!pool) return undefined;

  const refs: ContextRefsJson = {};
  if (pool.basePdfItemId !== null) {
    // Find the parent item ID from the PDF attachment.
    let parentItemId = pool.basePdfItemId;
    try {
      const attachment = getZoteroItem(pool.basePdfItemId);
      if (attachment?.parentID) {
        parentItemId = attachment.parentID;
      }
    } catch (_e) {
      // Fallback to using the attachment ID as both.
    }
    refs.basePdf = {
      itemId: parentItemId,
      contextItemId: pool.basePdfItemId,
      title: pool.basePdfTitle || "Document",
      removed: pool.basePdfRemoved || undefined,
    };
  }
  if (pool.supplementalContexts.size > 0) {
    refs.supplementalPapers = [...pool.supplementalContexts.values()].map(
      (entry) => entry.ref,
    );
  }
  // Persist Zone B summary if available.
  const cachedZoneBSummary = zoneBSummaryCache.get(conversationKey);
  if (cachedZoneBSummary) {
    refs.compactedSummary = cachedZoneBSummary;
  }
  return Object.keys(refs).length > 0 ? refs : undefined;
}

/**
 * Restore the conversation context pool from DB-stored context refs.
 * Called during ensureConversationLoaded after messages are loaded.
 * The actual PDF text is NOT rebuilt here (lazy: built on next send).
 */
function restoreContextPoolFromStoredMessages(
  conversationKey: number,
  storedMessages: StoredChatMessage[],
  options?: { force?: boolean },
): void {
  // Don't overwrite if pool already exists (e.g., still in memory).
  if (!options?.force && conversationContextPool.has(conversationKey)) return;

  // Find the latest user message with contextRefs.
  let latestContextRefs: ContextRefsJson | undefined;
  for (let i = storedMessages.length - 1; i >= 0; i--) {
    const msg = storedMessages[i];
    if (msg.role === "user" && msg.contextRefs) {
      latestContextRefs = msg.contextRefs;
      break;
    }
  }
  if (!latestContextRefs) {
    if (options?.force) {
      conversationContextPool.delete(conversationKey);
      zoneBSummaryCache.delete(conversationKey);
    }
    return;
  }

  const pool: ConversationContextPoolEntry = {
    basePdfContext: "", // Will be rebuilt lazily on next send.
    basePdfItemId: latestContextRefs.basePdf?.contextItemId ?? null,
    basePdfTitle: latestContextRefs.basePdf?.title ?? "",
    basePdfRemoved: latestContextRefs.basePdf?.removed ?? false,
    supplementalContexts: new Map(),
  };

  // Restore supplemental paper refs (builtContext = "" → rebuilt on next send).
  if (Array.isArray(latestContextRefs.supplementalPapers)) {
    for (const [index, ref] of latestContextRefs.supplementalPapers.entries()) {
      if (!ref || !ref.contextItemId) continue;
      pool.supplementalContexts.set(ref.contextItemId, {
        ref,
        builtContext: "", // Lazy: rebuilt on next send.
        addedAtTurn: index + 1,
      });
    }
  }

  conversationContextPool.set(conversationKey, pool);

  // Restore Zone B summary if persisted.
  if (
    typeof latestContextRefs.compactedSummary === "string" &&
    latestContextRefs.compactedSummary.trim()
  ) {
    zoneBSummaryCache.set(
      conversationKey,
      latestContextRefs.compactedSummary.trim(),
    );
    ztoolkit.log(
      `LLM: Restored Zone B summary from DB (${latestContextRefs.compactedSummary.length} chars)`,
    );
  } else if (options?.force) {
    zoneBSummaryCache.delete(conversationKey);
  }

  ztoolkit.log(
    `LLM: Restored context pool from DB refs for conversation ${conversationKey}. ` +
      `basePdf=${pool.basePdfItemId}, supplementals=${pool.supplementalContexts.size}, removed=${pool.basePdfRemoved}`,
  );
}

/**
 * Restore file attachments from the last user message into the in-memory cache.
 * If a persisted file-attachment ID list exists (from user add/remove actions),
 * only attachments whose IDs are in that list are restored.  Otherwise, all
 * valid attachments from the last user message are restored.
 */
function restoreFileAttachmentsFromMessages(
  itemId: number,
  conversationKey: number,
  storedMessages: StoredChatMessage[],
): void {
  // Don't overwrite if cache already has entries for this item.
  if (selectedFileAttachmentCache.has(itemId)) return;

  // Check for a persisted file-attachment ID list (set when user adds/removes).
  const persistedIds = loadPersistedFileAttachmentIds(conversationKey);
  const persistedIdSet = persistedIds ? new Set(persistedIds) : null;

  // If pref explicitly says empty array → user cleared all files, don't restore.
  if (persistedIds && persistedIds.length === 0) return;

  // Walk backwards to find the last user message with attachments.
  for (let i = storedMessages.length - 1; i >= 0; i--) {
    const msg = storedMessages[i];
    if (msg.role !== "user" || !Array.isArray(msg.attachments)) continue;

    const validAttachments: ChatAttachment[] = msg.attachments
      .filter(
        (att) =>
          Boolean(att) &&
          typeof att === "object" &&
          typeof att.id === "string" &&
          att.id.trim() &&
          typeof att.name === "string" &&
          att.name.trim() &&
          att.category !== "image" &&
          // Must have storedPath or textContent to be usable
          (att.storedPath || att.textContent) &&
          // If we have persisted IDs, only restore those
          (!persistedIdSet || persistedIdSet.has(att.id.trim())),
      )
      .map((att) => ({
        ...att,
        id: att.id.trim(),
        name: att.name.trim(),
        mimeType:
          typeof att.mimeType === "string" && att.mimeType.trim()
            ? att.mimeType.trim()
            : "application/octet-stream",
        sizeBytes: Number.isFinite(att.sizeBytes)
          ? Math.max(0, att.sizeBytes)
          : 0,
      }));

    if (validAttachments.length) {
      selectedFileAttachmentCache.set(itemId, validAttachments);
      ztoolkit.log(
        `LLM: Restored ${validAttachments.length} file attachment(s) for item ${itemId}` +
          (persistedIdSet
            ? ` (filtered by ${persistedIds!.length} persisted IDs)`
            : " (from message)"),
      );
    }
    break; // Only check the last user message
  }
}

/**
 * Restore paper context chips from the last user message into the in-memory
 * selectedPaperContextCache so the compose area shows previously attached papers
 * after reopening the conversation (e.g., after Zotero restart).
 *
 * Papers that match the base PDF (already shown as the base PDF chip) are
 * excluded to avoid duplicate chips.
 */
function restorePaperContextsFromMessages(
  itemId: number,
  conversationKey: number,
  storedMessages: StoredChatMessage[],
): void {
  // Don't overwrite if cache already has entries for this item.
  if (selectedPaperContextCache.has(itemId)) return;

  // Find the base PDF item ID from the context pool (if restored).
  const pool = conversationContextPool.get(conversationKey);
  const basePdfItemId = pool?.basePdfItemId ?? null;

  // Walk backwards to find the last user message with paper contexts.
  for (let i = storedMessages.length - 1; i >= 0; i--) {
    const msg = storedMessages[i];
    if (msg.role !== "user") continue;
    const paperContexts = normalizePaperContexts(msg.paperContexts);
    if (!paperContexts.length) continue;

    // Filter out the base PDF to avoid duplicate chips.
    const supplementalOnly =
      basePdfItemId !== null
        ? paperContexts.filter(
            (ref) =>
              ref.contextItemId !== basePdfItemId &&
              ref.itemId !== basePdfItemId,
          )
        : paperContexts;

    if (supplementalOnly.length) {
      selectedPaperContextCache.set(itemId, supplementalOnly);
      ztoolkit.log(
        `LLM: Restored ${supplementalOnly.length} paper context(s) for item ${itemId} from DB`,
      );
    }
    break; // Only check the last user message
  }
}

/**
 * Restore screenshot images from the last user message into selectedImageCache
 * so the compose area shows previously attached screenshots after reopening.
 */
function restoreScreenshotsFromMessages(
  itemId: number,
  storedMessages: StoredChatMessage[],
): void {
  // Don't overwrite if cache already has entries for this item.
  if (selectedImageCache.has(itemId)) return;

  // Walk backwards to find the last user message with screenshots.
  for (let i = storedMessages.length - 1; i >= 0; i--) {
    const msg = storedMessages[i];
    if (msg.role !== "user") continue;
    const screenshots = Array.isArray(msg.screenshotImages)
      ? msg.screenshotImages.filter((entry) => Boolean(entry))
      : [];
    if (!screenshots.length) continue;

    selectedImageCache.set(itemId, screenshots);
    ztoolkit.log(
      `LLM: Restored ${screenshots.length} screenshot(s) for item ${itemId} from DB`,
    );
    break; // Only check the last user message
  }
}

/**
 * Restore selected text contexts from the last user message in stored conversation.
 * Mirrors the pattern used by restoreScreenshotsFromMessages and restoreFileAttachmentsFromMessages.
 */
function restoreSelectedTextsFromMessages(
  conversationKey: number,
  storedMessages: StoredChatMessage[],
): void {
  // Don't overwrite if cache already has entries for this conversation.
  if (selectedTextCache.has(conversationKey)) return;

  // Walk backwards to find the last user message with selected texts.
  for (let i = storedMessages.length - 1; i >= 0; i--) {
    const msg = storedMessages[i];
    if (msg.role !== "user") continue;

    const texts = Array.isArray(msg.selectedTexts)
      ? msg.selectedTexts.filter((t) => Boolean(t))
      : [];
    if (!texts.length) continue;

    // Normalize sources and paper contexts
    const sources = normalizeSelectedTextSources(
      msg.selectedTextSources,
      texts.length,
    );
    const paperContexts = normalizeSelectedTextPaperContextEntries(
      msg.selectedTextPaperContexts,
      texts.length,
    );

    // Build SelectedTextContext array
    const contexts: SelectedTextContext[] = texts.map((text, idx) => ({
      text,
      source: sources[idx],
      paperContext: paperContexts[idx],
    }));

    selectedTextCache.set(conversationKey, contexts);
    ztoolkit.log(
      `LLM: Restored ${contexts.length} selected text(s) for conversation ${conversationKey} from DB`,
    );
    break; // Only check the last user message
  }
}

// =============================================================================
// Phase 3: Zone B/C Conversation History Compression
// =============================================================================

/** A per-conversation cache for Zone B summaries. */
export const zoneBSummaryCache = new Map<number, string>();

/**
 * Estimate character length of history messages for threshold checks.
 */
function estimateHistoryLength(messages: Message[]): number {
  let total = 0;
  for (const msg of messages) {
    total += stripGeneratedImageMarkdown(msg.text).length;
    if (msg.selectedText) total += msg.selectedText.length;
    if (Array.isArray(msg.selectedTexts)) {
      for (const t of msg.selectedTexts) total += (t || "").length;
    }
  }
  return total;
}

/**
 * Split history into Zone B (old, to compress) and Zone C (recent, protected).
 * Returns { zoneBMessages, zoneCMessages }.
 */
function buildZoneBCSplit(historyForLLM: Message[]): {
  zoneBMessages: Message[];
  zoneCMessages: Message[];
} {
  const protectedCount = RECENT_TURNS_PROTECTED * 2; // Each turn = user + assistant
  if (historyForLLM.length <= protectedCount) {
    return { zoneBMessages: [], zoneCMessages: historyForLLM };
  }
  const splitIndex = historyForLLM.length - protectedCount;
  return {
    zoneBMessages: historyForLLM.slice(0, splitIndex),
    zoneCMessages: historyForLLM.slice(splitIndex),
  };
}

/**
 * Format old messages into text for the summarisation prompt.
 */
function formatMessagesForSummary(messages: Message[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === "user" ? "User" : "Assistant";
      return `[${role}]: ${stripGeneratedImageMarkdown(msg.text).slice(0, 2000)}`;
    })
    .join("\n\n");
}

const COMPACTION_SUMMARY_PROMPT =
  `Please summarise the following conversation history into a structured summary. ` +
  `The summary will be used to provide context for an ongoing conversation.\n\n` +
  `Format:\n` +
  `## Discussion Topics\n[What was discussed?]\n\n` +
  `## Key Conclusions\n[What conclusions were reached?]\n\n` +
  `## Open Questions\n[What questions remain unanswered?]\n\n` +
  `## Key Terms/Concepts\n[Important terminology or concepts mentioned]\n\n` +
  `Keep the summary concise (under 1000 characters). Write in the same language as the conversation.\n\n` +
  `--- CONVERSATION HISTORY ---\n`;

/**
 * Compact conversation history into Zone B summary + Zone C recent turns.
 *
 * Called before each LLM request. If the total estimated context < threshold,
 * returns all history unmodified (no Zone B). Otherwise, compresses older turns
 * into a summary and returns updated llmHistory with the summary prepended.
 *
 * @returns Updated llmHistory (ChatMessage[]) with optional Zone B summary.
 */
async function compactConversationHistory(params: {
  conversationKey: number;
  combinedContext: string;
  historyForLLM: Message[];
  currentQuestion: string;
  apiBase: string;
  apiKey: string;
  model?: string;
}): Promise<ChatMessage[]> {
  const totalEstimate =
    params.combinedContext.length +
    estimateHistoryLength(params.historyForLLM) +
    params.currentQuestion.length;

  // Check if we already have a cached Zone B summary.
  const cachedSummary = zoneBSummaryCache.get(params.conversationKey);

  if (totalEstimate <= CONTEXT_COMPACTION_THRESHOLD && !cachedSummary) {
    // Under threshold, no compression needed.
    return buildLLMHistoryMessages(params.historyForLLM);
  }

  const { zoneBMessages, zoneCMessages } = buildZoneBCSplit(
    params.historyForLLM,
  );

  // If nothing to compress (all messages are in Zone C), return as-is.
  if (!zoneBMessages.length && !cachedSummary) {
    return buildLLMHistoryMessages(params.historyForLLM);
  }

  let zoneBSummary = cachedSummary || "";

  // Generate new summary if we have new messages to compress.
  if (zoneBMessages.length > 0) {
    const oldConversationText = formatMessagesForSummary(zoneBMessages);
    const summaryInput = cachedSummary
      ? `Previous summary:\n${cachedSummary}\n\nNew turns to incorporate:\n${oldConversationText}`
      : oldConversationText;

    try {
      ztoolkit.log(
        `LLM: Compacting ${zoneBMessages.length} old messages into Zone B summary ` +
          `(total estimate: ${totalEstimate} chars, threshold: ${CONTEXT_COMPACTION_THRESHOLD})`,
      );
      const summary = await callLLM({
        prompt: COMPACTION_SUMMARY_PROMPT + summaryInput,
        model: params.model,
        apiBase: params.apiBase,
        apiKey: params.apiKey,
        temperature: 0.2,
        maxTokens: 1200,
      });
      if (summary && summary.trim().length > 20) {
        zoneBSummary = summary.trim();
        zoneBSummaryCache.set(params.conversationKey, zoneBSummary);
        ztoolkit.log(
          `LLM: Zone B summary generated (${zoneBSummary.length} chars)`,
        );
      }
    } catch (err) {
      ztoolkit.log(
        "LLM: Failed to generate Zone B summary, falling back to truncation",
        err,
      );
      // Fallback: just use Zone C without summary.
      if (!cachedSummary) {
        return buildLLMHistoryMessages(zoneCMessages);
      }
    }
  }

  // Build final history: [Zone B summary] + [Zone C messages]
  const result: ChatMessage[] = [];
  if (zoneBSummary) {
    result.push({
      role: "user",
      content: `[Previous conversation summary — for context only, do not respond to this directly]\n\n${zoneBSummary}`,
    });
    result.push({
      role: "assistant",
      content: "Understood, I'll use this context to inform my responses.",
    });
  }
  result.push(...buildLLMHistoryMessages(zoneCMessages));
  return result;
}

async function autoCaptureRequestMemories(params: {
  item: Zotero.Item;
  conversationKey: number;
  userMessageText?: string;
  selectedTexts?: string[];
}): Promise<void> {
  const libraryID = resolveMemoryLibraryID(params.item);
  if (!libraryID) return;
  const candidates = [
    params.userMessageText || "",
    ...(Array.isArray(params.selectedTexts) ? params.selectedTexts : []),
  ]
    .map((entry) => sanitizeText(entry || "").trim())
    .filter(Boolean);
  if (!candidates.length) return;
  try {
    await autoCaptureUserMemories({
      libraryID,
      conversationKey: params.conversationKey,
      texts: candidates,
      maxChars: 500,
    });
  } catch (err) {
    ztoolkit.log("LLM: Memory auto-capture failed", err);
  }
}

function createQueuedRefresh(refresh: () => void): () => void {
  let refreshQueued = false;
  return () => {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      refresh();
    }, 50);
  };
}

export type LatestRetryPair = {
  userIndex: number;
  userMessage: Message;
  assistantMessage: Message;
};

const GENERATED_IMAGE_MARKDOWN_RE =
  /!\[[^\]]*?\]\((data:image\/[a-z0-9.+-]+;base64,[^)]+)\)/gi;

function extractGeneratedImageDataUrls(text: string | undefined): string[] {
  const source = typeof text === "string" ? text : "";
  const out: string[] = [];
  GENERATED_IMAGE_MARKDOWN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GENERATED_IMAGE_MARKDOWN_RE.exec(source))) {
    const dataUrl = (match[1] || "").trim();
    if (dataUrl && !out.includes(dataUrl)) out.push(dataUrl);
  }
  return out;
}

function stripGeneratedImageMarkdown(text: string | undefined): string {
  return sanitizeText(
    (typeof text === "string" ? text : "").replace(
      GENERATED_IMAGE_MARKDOWN_RE,
      "[Generated image]",
    ),
  );
}

function collectRecentGeneratedImageDataUrls(
  history: Message[],
  limit = MAX_SELECTED_IMAGES,
): string[] {
  const out: string[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < limit; i--) {
    const msg = history[i];
    if (msg.role !== "assistant") continue;
    for (const dataUrl of extractGeneratedImageDataUrls(msg.text)) {
      if (!out.includes(dataUrl)) out.push(dataUrl);
      if (out.length >= limit) break;
    }
  }
  return out.reverse();
}

export function findLatestRetryPair(
  history: Message[],
): LatestRetryPair | null {
  for (let i = history.length - 1; i >= 1; i--) {
    if (history[i]?.role !== "assistant") continue;
    if (history[i - 1]?.role !== "user") return null;
    return {
      userIndex: i - 1,
      userMessage: history[i - 1],
      assistantMessage: history[i],
    };
  }
  return null;
}

function reconstructRetryPayload(userMessage: Message): {
  question: string;
  screenshotImages: string[];
  fileAttachments: ChatFileAttachment[];
  paperContexts: PaperContextRef[];
} {
  const selectedTexts = getMessageSelectedTexts(userMessage);
  const selectedTextSources = normalizeSelectedTextSources(
    userMessage.selectedTextSources,
    selectedTexts.length,
  );
  const selectedTextPaperContexts = normalizeSelectedTextPaperContextsByIndex(
    userMessage.selectedTextPaperContexts,
    selectedTexts.length,
  );
  const primarySelectedText = selectedTexts[0] || "";
  const fileAttachments = (
    Array.isArray(userMessage.attachments)
      ? userMessage.attachments.filter(
          (attachment) =>
            Boolean(attachment) &&
            typeof attachment === "object" &&
            typeof attachment.id === "string" &&
            attachment.id.trim() &&
            typeof attachment.name === "string" &&
            attachment.category !== "image",
        )
      : []
  ) as ChatAttachment[];
  const promptText = resolvePromptText(
    sanitizeText(userMessage.text || ""),
    primarySelectedText,
    fileAttachments.length > 0,
  );
  const composedQuestionBase = primarySelectedText
    ? buildQuestionWithSelectedTextContexts(
        selectedTexts,
        selectedTextSources,
        promptText,
        {
          selectedTextPaperContexts,
          includePaperAttribution: selectedTextPaperContexts.some((entry) =>
            Boolean(entry),
          ),
        },
      )
    : promptText;
  const question = buildModelPromptWithFileContext(
    composedQuestionBase,
    fileAttachments,
  );
  const screenshotImages = Array.isArray(userMessage.screenshotImages)
    ? userMessage.screenshotImages
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, MAX_SELECTED_IMAGES)
    : [];
  const paperContexts = normalizePaperContexts(userMessage.paperContexts);
  const fileAttachmentsForModel: ChatFileAttachment[] = [];
  for (const attachment of fileAttachments) {
    if (
      !attachment.name ||
      typeof attachment.storedPath !== "string" ||
      !attachment.storedPath.trim()
    ) {
      continue;
    }
    fileAttachmentsForModel.push({
      name: attachment.name,
      mimeType: attachment.mimeType,
      storedPath: attachment.storedPath.trim(),
      contentHash: attachment.contentHash,
    });
  }
  return {
    question,
    screenshotImages,
    fileAttachments: fileAttachmentsForModel,
    paperContexts,
  };
}

function toStoredMessageFromPanelMessage(message: Message): StoredChatMessage {
  return {
    role: message.role,
    text: message.text,
    timestamp: message.timestamp,
    selectedText: message.selectedText,
    selectedTexts: message.selectedTexts,
    selectedTextSources: message.selectedTextSources,
    selectedTextPaperContexts: message.selectedTextPaperContexts,
    paperContexts: message.paperContexts,
    screenshotImages: message.screenshotImages,
    attachments: message.attachments,
    modelName: message.modelName,
    reasoningSummary: message.reasoningSummary,
    reasoningDetails: message.reasoningDetails,
    contextRefs: message.contextRefs as ContextRefsJson | undefined,
  };
}

function buildHistoryMessageForLLM(message: Message): ChatMessage {
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: stripGeneratedImageMarkdown(message.text),
    };
  }
  const { question } = reconstructRetryPayload(message);
  return {
    role: "user",
    content: question.trim() ? question : sanitizeText(message.text || ""),
  };
}

function buildLLMHistoryMessages(history: Message[]): ChatMessage[] {
  return history.map((message) => buildHistoryMessageForLLM(message));
}

function normalizeModelFileAttachments(
  attachments?: ChatAttachment[],
): ChatFileAttachment[] {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  return attachments
    .filter(
      (attachment) =>
        Boolean(attachment) &&
        typeof attachment === "object" &&
        attachment.category !== "image" &&
        typeof attachment.name === "string" &&
        attachment.name.trim() &&
        typeof attachment.storedPath === "string" &&
        attachment.storedPath.trim(),
    )
    .map((attachment) => ({
      name: attachment.name.trim(),
      mimeType:
        typeof attachment.mimeType === "string" && attachment.mimeType.trim()
          ? attachment.mimeType.trim()
          : "application/octet-stream",
      storedPath: attachment.storedPath?.trim(),
      contentHash:
        typeof attachment.contentHash === "string" &&
        /^[a-f0-9]{64}$/i.test(attachment.contentHash.trim())
          ? attachment.contentHash.trim().toLowerCase()
          : undefined,
    }));
}

export type EditLatestTurnMarker = {
  conversationKey: number;
  userTimestamp: number;
  assistantTimestamp: number;
};

export type EditLatestTurnResult =
  "ok" | "missing" | "stale" | "persist-failed";

export async function editUserMessageAndRetry(
  body: Element,
  item: Zotero.Item,
  messageId: number,
  displayQuestion: string,
  model?: string,
  apiBase?: string,
  apiKey?: string,
  advanced?: AdvancedModelParams,
): Promise<EditLatestTurnResult> {
  const ui = getPanelRequestUI(body);
  const i18n = getPanelI18n();
  if (isPanelGenerating(body)) {
    if (ui.status) {
      setStatus(ui.status, i18n.waitForCurrentResponse, "ready");
    }
    return "stale";
  }

  await ensureConversationLoaded(item);
  const conversationKey = getConversationKey(item);
  const history = chatHistory.get(conversationKey) || [];
  const sourceUserIndex = history.findIndex(
    (entry) => entry.role === "user" && entry.messageId === messageId,
  );
  const sourceUser = history[sourceUserIndex];
  if (sourceUserIndex < 0 || !sourceUser?.messageId) return "missing";
  if (history.some((entry) => entry.streaming)) return "stale";

  const nextDisplayQuestion = sanitizeText(displayQuestion || "");
  const nextUserMessage: Message = {
    ...sourceUser,
    messageId: undefined,
    activeChildMessageId: undefined,
    siblingIndex: undefined,
    siblingCount: undefined,
    siblingMessageIds: undefined,
    text: nextDisplayQuestion,
    timestamp: Date.now(),
    selectedTextExpanded: false,
    selectedTextExpandedIndex: -1,
    screenshotExpanded: false,
    screenshotActiveIndex: sourceUser.screenshotImages?.length ? 0 : undefined,
    paperContextsExpanded: false,
    attachmentsExpanded: false,
    attachmentActiveIndex: undefined,
  };
  const { question, screenshotImages, fileAttachments, paperContexts } =
    reconstructRetryPayload(nextUserMessage);
  if (!question.trim()) return "missing";

  let effectiveRequestConfig: EffectiveRequestConfig;
  try {
    effectiveRequestConfig = resolveEffectiveRequestConfig({
      item,
      model,
      apiBase,
      apiKey,
      advanced,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (ui.status) setStatus(ui.status, errMsg, "error");
    return "stale";
  }

  restoreContextPoolFromStoredMessages(
    conversationKey,
    [toStoredMessageFromPanelMessage(sourceUser)],
    { force: true },
  );

  const thisRequestId = nextRequestId();
  beginPanelRequest(body, thisRequestId);
  setRequestUIBusy(body, ui, conversationKey, i18n.preparingRetry);
  const { refreshChatSafely, setStatusSafely } = createPanelUpdateHelpers(
    body,
    item,
    conversationKey,
    ui,
  );

  const historyForLLM = history
    .slice(0, sourceUserIndex)
    .slice(-MAX_HISTORY_MESSAGES);
  const generatedImageContext =
    collectRecentGeneratedImageDataUrls(historyForLLM);
  const nextUserId = await createSiblingBranch(
    conversationKey,
    sourceUser.messageId,
    toStoredMessageFromPanelMessage(nextUserMessage),
  );
  if (!nextUserId) {
    restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    setHistoryControlsDisabled(body, false);
    return "persist-failed";
  }
  nextUserMessage.messageId = nextUserId;
  nextUserMessage.parentMessageId = sourceUser.parentMessageId ?? null;

  const assistantMessage: Message = {
    role: "assistant",
    text: "",
    timestamp: Date.now(),
    modelName: effectiveRequestConfig.model,
    streaming: true,
  };
  const assistantId = await appendMessageNode(
    conversationKey,
    toStoredMessageFromPanelMessage(assistantMessage),
    nextUserId,
  );
  if (!assistantId) {
    restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    setHistoryControlsDisabled(body, false);
    return "persist-failed";
  }
  assistantMessage.messageId = assistantId;
  assistantMessage.parentMessageId = nextUserId;
  activeStreamingAssistantMessages.set(assistantId, assistantMessage);

  await reloadActiveConversationPath(item, { forceContextRestore: true });
  refreshChatSafely();

  const persistAssistantUpdate = async () => {
    if (!assistantMessage.messageId) return;
    await updateMessageNode(conversationKey, assistantMessage.messageId, {
      text: assistantMessage.text,
      timestamp: assistantMessage.timestamp,
      modelName: assistantMessage.modelName,
    });
  };

  try {
    const combinedContext = await buildCombinedContextForRequest({
      item,
      question,
      imageCount: screenshotImages.length,
      paperContexts,
      apiBase: effectiveRequestConfig.apiBase,
      apiKey: effectiveRequestConfig.apiKey,
      conversationKey,
      setStatusSafely,
    });
    const refreshedContextRefs = buildContextRefsSnapshot(conversationKey);
    nextUserMessage.contextRefs = refreshedContextRefs;
    await updateMessageNode(conversationKey, nextUserId, {
      contextRefs: refreshedContextRefs,
    });

    const llmHistory = await compactConversationHistory({
      conversationKey,
      combinedContext,
      historyForLLM,
      currentQuestion: question,
      apiBase: effectiveRequestConfig.apiBase,
      apiKey: effectiveRequestConfig.apiKey,
      model: effectiveRequestConfig.model,
    });

    const AbortControllerCtor = getAbortController();
    const attached = attachPanelAbortController(
      body,
      thisRequestId,
      AbortControllerCtor ? new AbortControllerCtor() : null,
    );
    if (!attached) {
      assistantMessage.text = `*(${i18n.cancelled})*`;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      return "stale";
    }
    const panelAbortController = getPanelAbortController(body);
    const editAutoScroller = createStreamingAutoScroller(
      ui.chatBox as HTMLDivElement | null,
      suspendScrollUpdates,
      resumeScrollUpdates,
    );
    const queueEditPatch = createQueuedStreamingPatch(() => {
      editAutoScroller.patchAndScroll(() => {
        patchStreamingBubble(
          findAssistantBubbleByMessageId(
            ui.chatBox as HTMLDivElement | null,
            assistantMessage.messageId,
          ),
          assistantMessage.text,
        );
      });
    });
    const requestImages = [...generatedImageContext, ...screenshotImages].slice(
      -MAX_SELECTED_IMAGES,
    );
    let streamedAnswer = "";
    const answer = await callLLMStream(
      {
        prompt: question,
        context: combinedContext,
        history: llmHistory,
        signal: panelAbortController?.signal,
        images: requestImages,
        attachments: fileAttachments,
        model: effectiveRequestConfig.model,
        apiBase: effectiveRequestConfig.apiBase,
        apiKey: effectiveRequestConfig.apiKey,
        temperature: effectiveRequestConfig.advanced?.temperature,
        maxTokens: effectiveRequestConfig.advanced?.maxTokens,
      },
      (delta) => {
        streamedAnswer += sanitizeText(delta);
        assistantMessage.text = streamedAnswer;
        queueEditPatch();
      },
    );

    if (
      isPanelRequestCancelled(body, thisRequestId) ||
      Boolean(panelAbortController?.signal.aborted)
    ) {
      finalizeStreamingBubble(
        findAssistantBubbleByMessageId(
          ui.chatBox as HTMLDivElement | null,
          assistantMessage.messageId,
        ),
      );
      assistantMessage.text = streamedAnswer || assistantMessage.text;
      if (!assistantMessage.text)
        assistantMessage.text = `*(${i18n.cancelled})*`;
      assistantMessage.timestamp = Date.now();
      assistantMessage.modelName = effectiveRequestConfig.model;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      setStatusSafely(i18n.statusReady, "ready");
      return "ok";
    }

    finalizeStreamingBubble(
      findAssistantBubbleByMessageId(
        ui.chatBox as HTMLDivElement | null,
        assistantMessage.messageId,
      ),
    );
    assistantMessage.text =
      sanitizeText(answer) || streamedAnswer || i18n.noResponse;
    assistantMessage.timestamp = Date.now();
    assistantMessage.modelName = effectiveRequestConfig.model;
    assistantMessage.streaming = false;
    refreshChatSafely();
    await persistAssistantUpdate();
    if (assistantMessage.messageId) {
      activeStreamingAssistantMessages.delete(assistantMessage.messageId);
    }
    await syncConversationAttachmentRefs(conversationKey);
    await reloadActiveConversationPath(item, { forceContextRestore: true });
    refreshChatSafely();

    setStatusSafely(i18n.statusReady, "ready");
    await autoCaptureRequestMemories({
      item,
      conversationKey,
      userMessageText: nextUserMessage.text,
      selectedTexts: getMessageSelectedTexts(nextUserMessage),
    });
    return "ok";
  } catch (err) {
    const isCancelled =
      isPanelRequestCancelled(body, thisRequestId) ||
      Boolean(getPanelAbortController(body)?.signal.aborted) ||
      (err as { name?: string }).name === "AbortError";
    if (isCancelled) {
      assistantMessage.streaming = false;
      if (!assistantMessage.text)
        assistantMessage.text = `*(${i18n.cancelled})*`;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      setStatusSafely(i18n.statusReady, "ready");
      return "ok";
    }
    const errMsg = (err as Error).message || "Error";
    const retryHint = resolveMultimodalRetryHint(
      errMsg,
      screenshotImages.length,
    );
    assistantMessage.text = i18n.operationFailed(`${errMsg}${retryHint}`);
    assistantMessage.streaming = false;
    refreshChatSafely();
    await persistAssistantUpdate();
    if (assistantMessage.messageId) {
      activeStreamingAssistantMessages.delete(assistantMessage.messageId);
    }
    await reloadActiveConversationPath(item, { forceContextRestore: true });
    refreshChatSafely();
    setStatusSafely(
      i18n.operationFailed(`${errMsg}${retryHint}`.slice(0, 40)),
      "error",
    );
    return "ok";
  } finally {
    if (finishPanelRequest(body, thisRequestId)) {
      setHistoryControlsDisabled(body, false);
      restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    }
  }
}

export async function editLatestUserMessageAndRetry(
  body: Element,
  item: Zotero.Item,
  displayQuestion: string,
  _selectedTexts?: string[],
  _selectedTextSources?: SelectedTextSource[],
  _selectedTextPaperContexts?: (PaperContextRef | undefined)[],
  _screenshotImages?: string[],
  _paperContexts?: PaperContextRef[],
  _attachments?: ChatAttachment[],
  expected?: EditLatestTurnMarker,
  model?: string,
  apiBase?: string,
  apiKey?: string,
  advanced?: AdvancedModelParams,
): Promise<EditLatestTurnResult> {
  await ensureConversationLoaded(item);
  const conversationKey = getConversationKey(item);
  const history = chatHistory.get(conversationKey) || [];
  const retryPair = findLatestRetryPair(history);
  if (!retryPair?.userMessage.messageId) return "missing";
  if (retryPair.assistantMessage.streaming) return "stale";
  if (
    expected &&
    (expected.conversationKey !== conversationKey ||
      retryPair.userMessage.timestamp !== expected.userTimestamp ||
      retryPair.assistantMessage.timestamp !== expected.assistantTimestamp)
  ) {
    return "stale";
  }
  return editUserMessageAndRetry(
    body,
    item,
    retryPair.userMessage.messageId,
    displayQuestion,
    model,
    apiBase,
    apiKey,
    advanced,
  );
}

export async function retryLatestAssistantResponse(
  body: Element,
  item: Zotero.Item,
  model?: string,
  apiBase?: string,
  apiKey?: string,
  advanced?: AdvancedModelParams,
) {
  const ui = getPanelRequestUI(body);
  const i18n = getPanelI18n();
  if (isPanelGenerating(body)) {
    if (ui.status) {
      setStatus(ui.status, i18n.waitForCurrentResponse, "ready");
    }
    return;
  }

  await ensureConversationLoaded(item);
  const conversationKey = getConversationKey(item);
  const history = chatHistory.get(conversationKey) || [];
  const retryPair = findLatestRetryPair(history);
  if (!retryPair) {
    if (ui.status) setStatus(ui.status, i18n.noRetryableResponseFound, "error");
    return;
  }
  if (!retryPair.userMessage.messageId) {
    if (ui.status) setStatus(ui.status, i18n.noRetryableResponseFound, "error");
    return;
  }

  const thisRequestId = nextRequestId();
  beginPanelRequest(body, thisRequestId);
  setRequestUIBusy(body, ui, conversationKey, i18n.preparingRetry);
  const { refreshChatSafely, setStatusSafely } = createPanelUpdateHelpers(
    body,
    item,
    conversationKey,
    ui,
  );

  const historyForLLM = history
    .slice(0, retryPair.userIndex)
    .slice(-MAX_HISTORY_MESSAGES);
  const generatedImageContext =
    collectRecentGeneratedImageDataUrls(historyForLLM);
  const { question, screenshotImages, fileAttachments, paperContexts } =
    reconstructRetryPayload(retryPair.userMessage);
  if (!question.trim()) {
    setStatusSafely(i18n.nothingToRetryLatestTurn, "error");
    restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    setHistoryControlsDisabled(body, false);
    return;
  }

  let effectiveRequestConfig: EffectiveRequestConfig;
  try {
    effectiveRequestConfig = resolveEffectiveRequestConfig({
      item,
      model,
      apiBase,
      apiKey,
      advanced,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setStatusSafely(errMsg, "error");
    restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    setHistoryControlsDisabled(body, false);
    return;
  }

  restoreContextPoolFromStoredMessages(
    conversationKey,
    [toStoredMessageFromPanelMessage(retryPair.userMessage)],
    { force: true },
  );

  const assistantMessage: Message = {
    role: "assistant",
    text: "",
    timestamp: Date.now(),
    modelName: effectiveRequestConfig.model,
    streaming: true,
  };
  const assistantId = await appendMessageNode(
    conversationKey,
    toStoredMessageFromPanelMessage(assistantMessage),
    retryPair.userMessage.messageId,
  );
  if (!assistantId) {
    setStatusSafely(i18n.operationFailed("persist"), "error");
    restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    setHistoryControlsDisabled(body, false);
    return;
  }
  assistantMessage.messageId = assistantId;
  assistantMessage.parentMessageId = retryPair.userMessage.messageId;
  activeStreamingAssistantMessages.set(assistantId, assistantMessage);
  await reloadActiveConversationPath(item, { forceContextRestore: true });
  refreshChatSafely();
  let streamedAnswer = "";

  const persistAssistantUpdate = async () => {
    if (!assistantMessage.messageId) return;
    await updateMessageNode(conversationKey, assistantMessage.messageId, {
      text: assistantMessage.text,
      timestamp: assistantMessage.timestamp,
      modelName: assistantMessage.modelName,
    });
  };

  try {
    const combinedContext = await buildCombinedContextForRequest({
      item,
      question,
      imageCount: screenshotImages.length,
      paperContexts,
      apiBase: effectiveRequestConfig.apiBase,
      apiKey: effectiveRequestConfig.apiKey,
      conversationKey,
      setStatusSafely,
    });
    if (isPanelRequestCancelled(body, thisRequestId)) {
      assistantMessage.text = `*(${i18n.cancelled})*`;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      setStatusSafely(i18n.cancelled, "ready");
      return;
    }
    const llmHistory = await compactConversationHistory({
      conversationKey,
      combinedContext,
      historyForLLM,
      currentQuestion: question,
      apiBase: effectiveRequestConfig.apiBase,
      apiKey: effectiveRequestConfig.apiKey,
      model: effectiveRequestConfig.model,
    });

    const AbortControllerCtor = getAbortController();
    const attached = attachPanelAbortController(
      body,
      thisRequestId,
      AbortControllerCtor ? new AbortControllerCtor() : null,
    );
    if (!attached) {
      assistantMessage.text = `*(${i18n.cancelled})*`;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      setStatusSafely(i18n.cancelled, "ready");
      return;
    }
    const panelAbortController = getPanelAbortController(body);
    if (isPanelRequestCancelled(body, thisRequestId)) {
      panelAbortController?.abort();
      assistantMessage.text = `*(${i18n.cancelled})*`;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      setStatusSafely(i18n.cancelled, "ready");
      return;
    }

    // Incremental DOM update: find the skeleton bubble that refreshChat
    // created and patch it in place instead of re-rendering the whole chat.
    const retryAutoScroller = createStreamingAutoScroller(
      ui.chatBox as HTMLDivElement | null,
      suspendScrollUpdates,
      resumeScrollUpdates,
    );
    const queueRetryPatch = createQueuedStreamingPatch(() => {
      retryAutoScroller.patchAndScroll(() => {
        patchStreamingBubble(
          findAssistantBubbleByMessageId(
            ui.chatBox as HTMLDivElement | null,
            assistantMessage.messageId,
          ),
          assistantMessage.text,
        );
      });
    });

    const requestImages = [...generatedImageContext, ...screenshotImages].slice(
      -MAX_SELECTED_IMAGES,
    );

    const answer = await callLLMStream(
      {
        prompt: question,
        context: combinedContext,
        history: llmHistory,
        signal: panelAbortController?.signal,
        images: requestImages,
        attachments: fileAttachments,
        model: effectiveRequestConfig.model,
        apiBase: effectiveRequestConfig.apiBase,
        apiKey: effectiveRequestConfig.apiKey,
        temperature: effectiveRequestConfig.advanced?.temperature,
        maxTokens: effectiveRequestConfig.advanced?.maxTokens,
      },
      (delta) => {
        streamedAnswer += sanitizeText(delta);
        assistantMessage.text = streamedAnswer;
        queueRetryPatch();
      },
    );

    if (
      isPanelRequestCancelled(body, thisRequestId) ||
      Boolean(panelAbortController?.signal.aborted)
    ) {
      // Keep whatever the LLM has already generated
      finalizeStreamingBubble(
        findAssistantBubbleByMessageId(
          ui.chatBox as HTMLDivElement | null,
          assistantMessage.messageId,
        ),
      );
      assistantMessage.text = streamedAnswer || assistantMessage.text;
      assistantMessage.timestamp = Date.now();
      assistantMessage.modelName = effectiveRequestConfig.model;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      setStatusSafely(i18n.statusReady, "ready");
      return;
    }

    finalizeStreamingBubble(
      findAssistantBubbleByMessageId(
        ui.chatBox as HTMLDivElement | null,
        assistantMessage.messageId,
      ),
    );
    assistantMessage.text =
      sanitizeText(answer) || streamedAnswer || i18n.noResponse;
    assistantMessage.timestamp = Date.now();
    assistantMessage.modelName = effectiveRequestConfig.model;
    assistantMessage.streaming = false;
    refreshChatSafely();

    await persistAssistantUpdate();
    if (assistantMessage.messageId) {
      activeStreamingAssistantMessages.delete(assistantMessage.messageId);
    }
    await reloadActiveConversationPath(item, { forceContextRestore: true });
    refreshChatSafely();

    setStatusSafely(i18n.statusReady, "ready");
    await autoCaptureRequestMemories({
      item,
      conversationKey,
      userMessageText: retryPair.userMessage.text,
      selectedTexts: getMessageSelectedTexts(retryPair.userMessage),
    });
  } catch (err) {
    const isCancelled =
      isPanelRequestCancelled(body, thisRequestId) ||
      Boolean(getPanelAbortController(body)?.signal.aborted) ||
      (err as { name?: string }).name === "AbortError";
    if (isCancelled) {
      // Keep whatever the LLM has already generated
      if (assistantMessage.text) {
        assistantMessage.streaming = false;
        refreshChatSafely();
        assistantMessage.timestamp = Date.now();
        assistantMessage.modelName = effectiveRequestConfig.model;
        await persistAssistantUpdate();
        if (assistantMessage.messageId) {
          activeStreamingAssistantMessages.delete(assistantMessage.messageId);
        }
      } else {
        assistantMessage.text = `*(${i18n.cancelled})*`;
        assistantMessage.streaming = false;
        refreshChatSafely();
        await persistAssistantUpdate();
        if (assistantMessage.messageId) {
          activeStreamingAssistantMessages.delete(assistantMessage.messageId);
        }
      }
      await reloadActiveConversationPath(item, { forceContextRestore: true });
      refreshChatSafely();
      setStatusSafely(i18n.statusReady, "ready");
      return;
    }

    const errMsg = (err as Error).message || "Error";
    const retryHint = resolveMultimodalRetryHint(
      errMsg,
      screenshotImages.length,
    );
    assistantMessage.text = i18n.operationFailed(`${errMsg}${retryHint}`);
    assistantMessage.streaming = false;
    refreshChatSafely();
    await persistAssistantUpdate();
    if (assistantMessage.messageId) {
      activeStreamingAssistantMessages.delete(assistantMessage.messageId);
    }
    await reloadActiveConversationPath(item, { forceContextRestore: true });
    refreshChatSafely();
    setStatusSafely(
      `Retry failed: ${`${errMsg}${retryHint}`.slice(0, 48)}`,
      "error",
    );
  } finally {
    if (finishPanelRequest(body, thisRequestId)) {
      setHistoryControlsDisabled(body, false);
      restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    }
  }
}

export async function sendQuestion(
  body: Element,
  item: Zotero.Item,
  question: string,
  images?: string[],
  model?: string,
  apiBase?: string,
  apiKey?: string,
  advanced?: AdvancedModelParams,
  displayQuestion?: string,
  selectedTexts?: string[],
  selectedTextSources?: SelectedTextSource[],
  selectedTextPaperContexts?: (PaperContextRef | undefined)[],
  paperContexts?: PaperContextRef[],
  attachments?: ChatAttachment[],
) {
  const ui = getPanelRequestUI(body);
  const i18n = getPanelI18n();
  if (isPanelGenerating(body)) {
    if (ui.status) {
      setStatus(ui.status, i18n.waitForCurrentResponse, "ready");
    }
    return;
  }

  // Track this request
  const thisRequestId = nextRequestId();
  beginPanelRequest(body, thisRequestId);
  const initialConversationKey = getConversationKey(item);

  // Show cancel, hide send
  setRequestUIBusy(body, ui, initialConversationKey, i18n.preparingRequest);

  await ensureConversationLoaded(item);
  const conversationKey = getConversationKey(item);
  const { refreshChatSafely, setStatusSafely } = createPanelUpdateHelpers(
    body,
    item,
    conversationKey,
    ui,
  );

  // Add user message with attached selected text / screenshots metadata
  if (!chatHistory.has(conversationKey)) {
    chatHistory.set(conversationKey, []);
  }
  const history = chatHistory.get(conversationKey)!;
  const parentMessageId = history.length
    ? (history[history.length - 1]?.messageId ?? null)
    : null;
  const historyForLLM = history.slice(-MAX_HISTORY_MESSAGES);
  const generatedImageContext = collectRecentGeneratedImageDataUrls(history);
  const requestFileAttachments = normalizeModelFileAttachments(attachments);
  let effectiveRequestConfig: EffectiveRequestConfig;
  try {
    effectiveRequestConfig = resolveEffectiveRequestConfig({
      item,
      model,
      apiBase,
      apiKey,
      advanced,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setStatusSafely(errMsg, "error");
    restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    setHistoryControlsDisabled(body, false);
    return;
  }
  const shownQuestion = displayQuestion || question;
  const selectedTextsForMessage = normalizeSelectedTexts(selectedTexts);
  const selectedTextSourcesForMessage = normalizeSelectedTextSources(
    selectedTextSources,
    selectedTextsForMessage.length,
  );
  const selectedTextPaperContextsForMessage =
    normalizeSelectedTextPaperContextsByIndex(
      selectedTextPaperContexts,
      selectedTextsForMessage.length,
    );
  const selectedTextForMessage = selectedTextsForMessage[0] || "";
  const paperContextsForMessage = normalizePaperContexts(paperContexts);
  const screenshotImagesForMessage = Array.isArray(images)
    ? images
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, MAX_SELECTED_IMAGES)
    : [];
  const imageCount = screenshotImagesForMessage.length;
  const userMessageText = shownQuestion;
  const userMessage: Message = {
    role: "user",
    text: userMessageText,
    timestamp: Date.now(),
    selectedText: selectedTextForMessage || undefined,
    selectedTextExpanded: false,
    selectedTexts: selectedTextsForMessage.length
      ? selectedTextsForMessage
      : undefined,
    selectedTextSources: selectedTextSourcesForMessage.length
      ? selectedTextSourcesForMessage
      : undefined,
    selectedTextPaperContexts: selectedTextPaperContextsForMessage.some(
      (entry) => Boolean(entry),
    )
      ? selectedTextPaperContextsForMessage
      : undefined,
    selectedTextExpandedIndex: -1,
    paperContexts: paperContextsForMessage.length
      ? paperContextsForMessage
      : undefined,
    paperContextsExpanded: false,
    screenshotImages: screenshotImagesForMessage.length
      ? screenshotImagesForMessage
      : undefined,
    screenshotExpanded: false,
    screenshotActiveIndex: 0,
    attachments: attachments?.length ? attachments : undefined,
    contextRefs: buildContextRefsSnapshot(conversationKey),
  };
  history.push(userMessage);
  const userMessageId = await persistConversationMessage(
    conversationKey,
    {
      role: "user",
      text: userMessage.text,
      timestamp: userMessage.timestamp,
      selectedText: userMessage.selectedText,
      selectedTexts: userMessage.selectedTexts,
      selectedTextSources: userMessage.selectedTextSources,
      selectedTextPaperContexts: userMessage.selectedTextPaperContexts,
      paperContexts: userMessage.paperContexts,
      screenshotImages: userMessage.screenshotImages,
      attachments: userMessage.attachments,
      contextRefs: userMessage.contextRefs as ContextRefsJson | undefined,
    },
    parentMessageId,
  );
  if (userMessageId) {
    userMessage.messageId = userMessageId;
    userMessage.parentMessageId = parentMessageId;
  }

  const assistantMessage: Message = {
    role: "assistant",
    text: "",
    timestamp: Date.now(),
    modelName: effectiveRequestConfig.model,
    streaming: true,
  };
  history.push(assistantMessage);
  const assistantMessageId = await persistConversationMessage(
    conversationKey,
    {
      role: "assistant",
      text: assistantMessage.text,
      timestamp: assistantMessage.timestamp,
      modelName: assistantMessage.modelName,
    },
    userMessageId || userMessage.messageId || null,
  );
  if (assistantMessageId) {
    assistantMessage.messageId = assistantMessageId;
    assistantMessage.parentMessageId =
      userMessageId || userMessage.messageId || null;
    activeStreamingAssistantMessages.set(assistantMessageId, assistantMessage);
  }
  refreshChatSafely();

  const persistAssistantUpdate = async () => {
    if (!assistantMessage.messageId) return;
    await updateMessageNode(conversationKey, assistantMessage.messageId, {
      text: assistantMessage.text,
      timestamp: assistantMessage.timestamp,
      modelName: assistantMessage.modelName,
    });
  };
  const markCancelled = async () => {
    if (assistantMessage.text) {
      // Keep whatever the LLM has already generated
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
    } else {
      // Nothing generated yet — keep the assistant message as a
      // "cancelled" placeholder so that the user-assistant pair stays
      // intact.  This lets the user still edit / retry the last prompt
      // via findLatestRetryPair().
      assistantMessage.text = `*(${i18n.cancelled})*`;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantUpdate();
      if (assistantMessage.messageId) {
        activeStreamingAssistantMessages.delete(assistantMessage.messageId);
      }
    }
    setStatusSafely(i18n.statusReady, "ready");
  };

  try {
    const combinedContext = await buildCombinedContextForRequest({
      item,
      question,
      imageCount,
      paperContexts: paperContextsForMessage,
      apiBase: effectiveRequestConfig.apiBase,
      apiKey: effectiveRequestConfig.apiKey,
      conversationKey,
      setStatusSafely,
    });
    const refreshedContextRefs = buildContextRefsSnapshot(conversationKey);
    userMessage.contextRefs = refreshedContextRefs;
    if (userMessage.messageId) {
      await updateMessageNode(conversationKey, userMessage.messageId, {
        contextRefs: refreshedContextRefs,
      });
    }

    const llmHistory = await compactConversationHistory({
      conversationKey,
      combinedContext,
      historyForLLM,
      currentQuestion: question,
      apiBase: effectiveRequestConfig.apiBase,
      apiKey: effectiveRequestConfig.apiKey,
      model: effectiveRequestConfig.model,
    });

    const AbortControllerCtor = getAbortController();
    const attached = attachPanelAbortController(
      body,
      thisRequestId,
      AbortControllerCtor ? new AbortControllerCtor() : null,
    );
    if (!attached) {
      await markCancelled();
      return;
    }
    const panelAbortController = getPanelAbortController(body);
    // Incremental DOM update: patch the concrete assistant node if it is
    // currently visible. Variant switches can hide it while streaming.
    const sendAutoScroller = createStreamingAutoScroller(
      ui.chatBox as HTMLDivElement | null,
      suspendScrollUpdates,
      resumeScrollUpdates,
    );
    const queueStreamingPatch = createQueuedStreamingPatch(() => {
      sendAutoScroller.patchAndScroll(() => {
        patchStreamingBubble(
          findAssistantBubbleByMessageId(
            ui.chatBox as HTMLDivElement | null,
            assistantMessage.messageId,
          ),
          assistantMessage.text,
        );
      });
    });

    const requestImages = [
      ...generatedImageContext,
      ...screenshotImagesForMessage,
    ].slice(-MAX_SELECTED_IMAGES);

    const answer = await callLLMStream(
      {
        prompt: question,
        context: combinedContext,
        history: llmHistory,
        signal: panelAbortController?.signal,
        images: requestImages,
        attachments: requestFileAttachments,
        model: effectiveRequestConfig.model,
        apiBase: effectiveRequestConfig.apiBase,
        apiKey: effectiveRequestConfig.apiKey,
        temperature: effectiveRequestConfig.advanced?.temperature,
        maxTokens: effectiveRequestConfig.advanced?.maxTokens,
      },
      (delta) => {
        assistantMessage.text += sanitizeText(delta);
        queueStreamingPatch();
      },
    );

    if (
      isPanelRequestCancelled(body, thisRequestId) ||
      Boolean(panelAbortController?.signal.aborted)
    ) {
      await markCancelled();
      return;
    }

    finalizeStreamingBubble(
      findAssistantBubbleByMessageId(
        ui.chatBox as HTMLDivElement | null,
        assistantMessage.messageId,
      ),
    );
    assistantMessage.text =
      sanitizeText(answer) || assistantMessage.text || i18n.noResponse;
    assistantMessage.streaming = false;
    refreshChatSafely();
    await persistAssistantUpdate();
    if (assistantMessage.messageId) {
      activeStreamingAssistantMessages.delete(assistantMessage.messageId);
    }

    setStatusSafely(i18n.statusReady, "ready");
    await autoCaptureRequestMemories({
      item,
      conversationKey,
      userMessageText: userMessage.text,
      selectedTexts: selectedTextsForMessage,
    });
  } catch (err) {
    const isCancelled =
      isPanelRequestCancelled(body, thisRequestId) ||
      Boolean(getPanelAbortController(body)?.signal.aborted) ||
      (err as { name?: string }).name === "AbortError";
    if (isCancelled) {
      await markCancelled();
      return;
    }

    const errMsg = (err as Error).message || "Error";
    const retryHint = resolveMultimodalRetryHint(errMsg, imageCount);
    assistantMessage.text = i18n.operationFailed(`${errMsg}${retryHint}`);
    assistantMessage.streaming = false;
    refreshChatSafely();
    await persistAssistantUpdate();
    if (assistantMessage.messageId) {
      activeStreamingAssistantMessages.delete(assistantMessage.messageId);
    }

    setStatusSafely(
      i18n.operationFailed(`${errMsg}${retryHint}`.slice(0, 40)),
      "error",
    );
  } finally {
    if (finishPanelRequest(body, thisRequestId)) {
      setHistoryControlsDisabled(body, false);
      restoreRequestUIIdle(body, ui, conversationKey, thisRequestId);
    }
  }
}

export function refreshChat(body: Element, item?: Zotero.Item | null) {
  const chatBox = body.querySelector("#llm-chat-box") as HTMLDivElement | null;
  if (!chatBox) return;
  const doc = body.ownerDocument!;
  const contextPopoverRoot =
    body instanceof (doc.defaultView?.HTMLElement || HTMLElement) &&
    (body as HTMLElement).id === "llm-main"
      ? (body as HTMLElement)
      : ((body.querySelector("#llm-main") as HTMLElement | null) ?? body);
  const i18n = getPanelI18n();
  const bubbleLanguage = getUiLanguageOption(getPanelLang());
  setPromptMenuTarget(null);
  closeActiveUserContextPopover();
  body
    .querySelectorAll(".llm-user-context-popover, .llm-history-context-popover")
    .forEach((popover: Element) => popover.remove());

  if (!item) {
    chatBox.innerHTML = `
        <div class="llm-welcome">
          <div class="llm-welcome-icon">AIdea</div>
        <div class="llm-welcome-text">${i18n.statusSelectItem}</div>
        </div>
      `;
    return;
  }

  const conversationKey = getConversationKey(item);
  const isGlobalConversation = conversationKey >= GLOBAL_CONVERSATION_KEY_BASE;
  const mutateChatWithScrollGuard = (fn: () => void) => {
    withScrollGuard(chatBox, conversationKey, fn);
  };
  const hasExistingRenderedContent = chatBox.childElementCount > 0;
  const cachedSnapshot = getChatScrollSnapshot(conversationKey);
  const baselineSnapshot =
    !hasExistingRenderedContent && cachedSnapshot
      ? cachedSnapshot
      : buildChatScrollSnapshot(chatBox);
  const history = chatHistory.get(conversationKey) || [];

  if (history.length === 0) {
    chatBox.innerHTML = `
      <div class="llm-welcome">
        <div class="llm-welcome-icon">AIdea</div>
      </div>
    `;
    return;
  }

  chatBox.innerHTML = "";

  const latestRetryPair = findLatestRetryPair(history);
  const latestAssistantIndex = latestRetryPair
    ? latestRetryPair.userIndex + 1
    : -1;
  const hasStreamingMessage = history.some((entry) => Boolean(entry.streaming));

  for (const [index, msg] of history.entries()) {
    const isUser = msg.role === "user";
    const canShowEditUserMessage = Boolean(
      isUser && item && Number.isFinite(msg.messageId),
    );
    const canEditUserMessage = Boolean(
      canShowEditUserMessage && !hasStreamingMessage,
    );
    let hasUserContext = false;
    const wrapper = doc.createElement("div") as HTMLDivElement;
    wrapper.className = `llm-message-wrapper ${isUser ? "user" : "assistant"}`;
    if (Number.isFinite(msg.messageId)) {
      wrapper.dataset.messageId = String(msg.messageId);
    }

    const bubble = doc.createElement("div") as HTMLDivElement;
    bubble.className = `llm-bubble ${isUser ? "user" : "assistant"}`;
    if (!isUser && msg.streaming) {
      // Mark the empty skeleton as streaming before the first delta arrives.
      // Late queued patches are still rejected after finalization removes it.
      bubble.classList.add("streaming");
    }
    bubble.lang = bubbleLanguage.htmlLang;
    bubble.dir = bubbleLanguage.dir === "rtl" ? "rtl" : "auto";

    if (isUser) {
      const contextBadgesRow = doc.createElement("div") as HTMLDivElement;
      contextBadgesRow.className =
        "llm-context-previews llm-user-context-badges llm-history-context-previews";
      let hasContextBadge = false;

      const screenshotImages = Array.isArray(msg.screenshotImages)
        ? msg.screenshotImages.filter((entry) => Boolean(entry))
        : [];
      let selectedTextExpanded: HTMLDivElement | null = null;
      let screenshotExpanded: HTMLDivElement | null = null;
      let papersExpanded: HTMLDivElement | null = null;
      let filesExpanded: HTMLDivElement | null = null;
      const selectedTexts = getMessageSelectedTexts(msg);
      const selectedTextSources = normalizeSelectedTextSources(
        msg.selectedTextSources,
        selectedTexts.length,
      );
      const selectedTextPaperContexts =
        normalizeSelectedTextPaperContextsByIndex(
          msg.selectedTextPaperContexts,
          selectedTexts.length,
        );
      const hasScreenshotContext = screenshotImages.length > 0;
      const hasSelectedTextContext = selectedTexts.length > 0;
      hasUserContext = hasScreenshotContext || hasSelectedTextContext;
      if (hasSelectedTextContext) {
        const selectedChip = doc.createElement("div") as HTMLDivElement;
        selectedChip.className =
          "llm-selected-context llm-selected-context-summary llm-history-context-chip";
        selectedChip.dataset.contextSummary = "selected-text";

        const selectedHeader = doc.createElement("div") as HTMLDivElement;
        selectedHeader.className =
          "llm-image-preview-header llm-selected-context-header";

        const selectedTrigger = doc.createElement(
          "button",
        ) as HTMLButtonElement;
        selectedTrigger.type = "button";
        selectedTrigger.className =
          "llm-image-preview-meta llm-selected-context-meta llm-selected-context-summary-toggle llm-history-context-trigger";
        selectedTrigger.textContent =
          selectedTexts.length > 1
            ? `Text Context (${selectedTexts.length})`
            : "Text Context";
        selectedTrigger.title = selectedTexts.join("\n");
        selectedHeader.appendChild(selectedTrigger);
        selectedChip.appendChild(selectedHeader);

        const selectedExpandedEl = doc.createElement("div") as HTMLDivElement;
        selectedExpandedEl.className =
          "llm-image-preview-expanded llm-selected-context-expanded llm-selected-context-group-expanded llm-user-context-popover llm-history-context-popover llm-history-selected-text-popover";
        selectedTextExpanded = selectedExpandedEl;

        const detailList = doc.createElement("div") as HTMLDivElement;
        detailList.className =
          "llm-selected-context-detail-list llm-history-selected-text-detail-list";

        selectedTexts.forEach((selectedText, contextIndex) => {
          const selectedSource = selectedTextSources[contextIndex] || "pdf";
          const selectedTextPaperContext =
            selectedTextPaperContexts[contextIndex];
          const selectedTextPaperLabel =
            isGlobalConversation &&
            selectedSource === "pdf" &&
            selectedTextPaperContext
              ? formatPaperCitationLabel(selectedTextPaperContext)
              : "";
          const contextLabel =
            selectedTextPaperLabel ||
            (contextIndex > 0
              ? `Text Context (${contextIndex + 1})`
              : "Text Context");

          const row = doc.createElement("div") as HTMLDivElement;
          row.className =
            "llm-selected-context-detail-item llm-history-selected-text-detail-item llm-history-readonly-context-row";
          row.dataset.contextSource = selectedSource;

          const indexPill = doc.createElement("span") as HTMLSpanElement;
          indexPill.className = "llm-context-detail-index";
          indexPill.textContent = `${contextIndex + 1}`;

          const textWrap = doc.createElement("div") as HTMLDivElement;
          textWrap.className = "llm-selected-context-detail-text";

          const label = doc.createElement("span") as HTMLSpanElement;
          label.className = "llm-selected-context-detail-label";
          label.textContent = contextLabel;
          label.title = contextLabel;

          const text = doc.createElement("div") as HTMLDivElement;
          text.className = "llm-selected-context-detail-body";
          text.textContent = selectedText;
          text.title = selectedText;

          const removePlaceholder = createReadonlyContextRemovePlaceholder(doc);
          textWrap.append(label, text);
          row.append(indexPill, textWrap, removePlaceholder);
          detailList.appendChild(row);
        });

        selectedExpandedEl.appendChild(detailList);

        const applySelectedTextState = () => {
          const expanded = Boolean(msg.selectedTextExpanded);
          selectedChip.classList.toggle("expanded", expanded);
          selectedChip.classList.toggle("collapsed", !expanded);
          selectedTrigger.classList.toggle("expanded", expanded);
          selectedTrigger.setAttribute(
            "aria-expanded",
            expanded ? "true" : "false",
          );
          selectedExpandedEl.hidden = !expanded;
          selectedExpandedEl.classList.toggle(
            "llm-history-context-popover-open",
            expanded,
          );
          selectedExpandedEl.style.display = expanded ? "grid" : "none";
          if (expanded) {
            positionUserContextPopover(
              chatBox,
              selectedTrigger,
              selectedExpandedEl,
              "grid",
            );
          }
          selectedTrigger.title = expanded
            ? "Collapse Text Context"
            : "Expand Text Context";
        };
        const toggleSelectedTextExpanded = () => {
          mutateChatWithScrollGuard(() => {
            const nextExpanded = !msg.selectedTextExpanded;
            if (!nextExpanded) {
              closeActiveUserContextPopover();
              msg.selectedTextExpanded = false;
              applySelectedTextState();
              return;
            }
            closeActiveUserContextPopover();
            msg.selectedTextExpanded = true;
            applySelectedTextState();
            openUserContextPopover({
              body: chatBox,
              chatBox,
              anchor: selectedTrigger,
              popover: selectedExpandedEl,
              display: "grid",
              close: () => {
                msg.selectedTextExpanded = false;
                applySelectedTextState();
              },
            });
          });
        };
        applySelectedTextState();
        selectedTrigger.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          toggleSelectedTextExpanded();
        });
        selectedTrigger.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        selectedTrigger.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleSelectedTextExpanded();
        });

        contextBadgesRow.appendChild(selectedChip);
        hasContextBadge = true;
      }
      if (hasScreenshotContext) {
        const screenshotChip = doc.createElement("div") as HTMLDivElement;
        screenshotChip.className =
          "llm-image-preview llm-image-preview-large-thumbs llm-history-context-chip";

        const screenshotHeader = doc.createElement("div") as HTMLDivElement;
        screenshotHeader.className = "llm-image-preview-header";

        const screenshotTrigger = doc.createElement(
          "button",
        ) as HTMLButtonElement;
        screenshotTrigger.type = "button";
        screenshotTrigger.className =
          "llm-image-preview-meta llm-history-context-trigger";
        screenshotTrigger.textContent = i18n.figureCount(
          screenshotImages.length,
          MAX_SELECTED_IMAGES,
        );
        screenshotHeader.appendChild(screenshotTrigger);
        screenshotChip.appendChild(screenshotHeader);

        const screenshotExpandedEl = doc.createElement("div") as HTMLDivElement;
        screenshotExpandedEl.className =
          "llm-image-preview-expanded llm-user-context-popover llm-history-context-popover llm-history-screenshots-popover";
        screenshotExpandedEl.dataset.preferredWidth = `${screenshotImages.length * 210 + 24}`;
        screenshotExpanded = screenshotExpandedEl;

        const screenshotGrid = doc.createElement("div") as HTMLDivElement;
        screenshotGrid.className =
          "llm-image-preview-strip llm-history-screenshots-grid";

        screenshotImages.forEach((imageUrl, index) => {
          const imageItem = doc.createElement("div") as HTMLDivElement;
          imageItem.className = "llm-preview-item";
          imageItem.title = i18n.screenshotNth(index + 1);

          const imageFrame = doc.createElement("div") as HTMLDivElement;
          imageFrame.className = "llm-preview-thumb llm-history-preview-thumb";

          const image = doc.createElement("img") as HTMLImageElement;
          image.className = "llm-preview-img";
          image.src = imageUrl;
          image.alt = i18n.screenshotNth(index + 1);

          const removePlaceholder = createReadonlyContextRemovePlaceholder(doc);
          removePlaceholder.classList.add("llm-preview-remove-one");
          imageFrame.appendChild(image);
          imageItem.append(imageFrame, removePlaceholder);
          screenshotGrid.appendChild(imageItem);
        });

        screenshotExpandedEl.appendChild(screenshotGrid);

        const applyScreenshotState = () => {
          const expanded = Boolean(msg.screenshotExpanded);
          screenshotChip.classList.toggle("expanded", expanded);
          screenshotChip.classList.toggle("collapsed", !expanded);
          screenshotTrigger.classList.toggle("expanded", expanded);
          screenshotTrigger.setAttribute(
            "aria-expanded",
            expanded ? "true" : "false",
          );
          screenshotExpandedEl.hidden = !expanded;
          screenshotExpandedEl.classList.toggle(
            "llm-history-context-popover-open",
            expanded,
          );
          screenshotExpandedEl.style.display = expanded ? "grid" : "none";
          if (expanded) {
            positionUserContextPopover(
              chatBox,
              screenshotTrigger,
              screenshotExpandedEl,
              "grid",
            );
          }
          screenshotTrigger.title = expanded
            ? i18n.collapseFigures
            : i18n.expandFigures;
        };

        const toggleScreenshotsExpanded = () => {
          mutateChatWithScrollGuard(() => {
            const nextExpanded = !msg.screenshotExpanded;
            if (!nextExpanded) {
              closeActiveUserContextPopover();
              msg.screenshotExpanded = false;
              applyScreenshotState();
              return;
            }
            closeActiveUserContextPopover();
            msg.screenshotExpanded = true;
            applyScreenshotState();
            openUserContextPopover({
              body: chatBox,
              chatBox,
              anchor: screenshotTrigger,
              popover: screenshotExpandedEl,
              display: "grid",
              close: () => {
                msg.screenshotExpanded = false;
                applyScreenshotState();
              },
            });
          });
        };
        applyScreenshotState();
        screenshotTrigger.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          toggleScreenshotsExpanded();
        });
        screenshotTrigger.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        screenshotTrigger.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleScreenshotsExpanded();
        });

        contextBadgesRow.appendChild(screenshotChip);
        hasContextBadge = true;
      }

      const paperContexts = getVisibleHistoryPaperContexts(msg);
      hasUserContext = hasUserContext || paperContexts.length > 0;
      if (paperContexts.length) {
        const papersChip = doc.createElement("div") as HTMLDivElement;
        papersChip.className =
          "llm-selected-context llm-paper-context-chip llm-file-chip-inline llm-paper-context-summary llm-history-context-chip";
        papersChip.dataset.category = "pdf";

        const papersHeader = doc.createElement("div") as HTMLDivElement;
        papersHeader.className =
          "llm-image-preview-header llm-selected-context-header llm-paper-context-chip-header";

        const papersTrigger = doc.createElement("button") as HTMLButtonElement;
        papersTrigger.type = "button";
        papersTrigger.className =
          "llm-paper-context-summary-trigger llm-history-context-trigger";
        papersTrigger.title = i18n.expandPapers;

        const papersIcon = doc.createElement("span") as HTMLSpanElement;
        papersIcon.className = "llm-paper-context-summary-icon";
        papersIcon.textContent = "📝";
        papersIcon.setAttribute("aria-hidden", "true");

        const papersLabel = doc.createElement("span") as HTMLSpanElement;
        papersLabel.className = "llm-paper-context-chip-label";
        papersLabel.textContent = i18n.paperCount(
          paperContexts.length,
          MAX_SELECTED_PAPER_CONTEXTS,
        );
        papersLabel.title = paperContexts
          .map((entry) => entry.title)
          .join("\n");
        papersTrigger.append(papersIcon, papersLabel);
        papersHeader.appendChild(papersTrigger);
        papersChip.appendChild(papersHeader);

        const papersExpandedEl = doc.createElement("div") as HTMLDivElement;
        papersExpandedEl.className =
          "llm-image-preview-expanded llm-paper-context-expanded llm-user-context-popover llm-history-context-popover llm-history-papers-popover";
        papersExpanded = papersExpandedEl;
        const papersList = doc.createElement("div") as HTMLDivElement;
        papersList.className = "llm-paper-context-list";
        for (const [paperIndex, paperContext] of paperContexts.entries()) {
          const displayIndex = paperIndex + 1;
          const rowLabel = displayIndex > 1 ? `PDF (${displayIndex})` : "PDF";
          const metaParts = [
            paperContext.firstCreator || "",
            paperContext.year || "",
          ].filter(Boolean);
          const bodyText = metaParts.length
            ? `${paperContext.title} · ${metaParts.join(" · ")}`
            : paperContext.title;

          const paperItem = doc.createElement("div") as HTMLDivElement;
          paperItem.className =
            "llm-paper-context-item llm-paper-context-detail-item llm-selected-context-detail-item llm-history-readonly-context-row";

          const indexPill = doc.createElement("span") as HTMLSpanElement;
          indexPill.className =
            "llm-context-detail-index llm-paper-context-index";
          indexPill.textContent = `${displayIndex}`;

          const textWrap = doc.createElement("div") as HTMLDivElement;
          textWrap.className = "llm-selected-context-detail-text";

          const label = doc.createElement("span") as HTMLSpanElement;
          label.className =
            "llm-paper-context-row-label llm-selected-context-detail-label";
          label.textContent = rowLabel;
          label.title = rowLabel;

          const body = doc.createElement("span") as HTMLSpanElement;
          body.className =
            "llm-paper-context-detail-body llm-selected-context-detail-body";
          body.textContent = bodyText;
          body.title = bodyText;

          const removePlaceholder = createReadonlyContextRemovePlaceholder(doc);
          textWrap.append(label, body);
          paperItem.append(indexPill, textWrap, removePlaceholder);
          papersList.appendChild(paperItem);
        }
        papersExpandedEl.appendChild(papersList);

        const applyPapersState = () => {
          const expanded = Boolean(msg.paperContextsExpanded);
          papersChip.classList.toggle("expanded", expanded);
          papersChip.classList.toggle("collapsed", !expanded);
          papersTrigger.classList.toggle("expanded", expanded);
          papersTrigger.setAttribute(
            "aria-expanded",
            expanded ? "true" : "false",
          );
          papersExpandedEl.hidden = !expanded;
          papersExpandedEl.classList.toggle(
            "llm-history-context-popover-open",
            expanded,
          );
          papersExpandedEl.style.display = expanded ? "grid" : "none";
          if (expanded) {
            positionUserContextPopover(
              chatBox,
              papersTrigger,
              papersExpandedEl,
              "grid",
            );
          }
          papersTrigger.title = expanded
            ? i18n.collapsePapers
            : i18n.expandPapers;
        };
        const togglePapersExpanded = () => {
          mutateChatWithScrollGuard(() => {
            const nextExpanded = !msg.paperContextsExpanded;
            if (!nextExpanded) {
              closeActiveUserContextPopover();
              msg.paperContextsExpanded = false;
              applyPapersState();
              return;
            }
            closeActiveUserContextPopover();
            msg.paperContextsExpanded = true;
            applyPapersState();
            openUserContextPopover({
              body: chatBox,
              chatBox,
              anchor: papersTrigger,
              popover: papersExpandedEl,
              display: "grid",
              close: () => {
                msg.paperContextsExpanded = false;
                applyPapersState();
              },
            });
          });
        };
        applyPapersState();
        papersTrigger.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          togglePapersExpanded();
        });
        papersTrigger.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        papersTrigger.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          togglePapersExpanded();
        });

        contextBadgesRow.appendChild(papersChip);
        hasContextBadge = true;
      }

      const fileAttachments = Array.isArray(msg.attachments)
        ? msg.attachments.filter(
            (entry) =>
              entry &&
              typeof entry === "object" &&
              entry.category !== "image" &&
              typeof entry.name === "string",
          )
        : [];
      hasUserContext = hasUserContext || fileAttachments.length > 0;
      if (fileAttachments.length) {
        const filesBar = doc.createElement("button") as HTMLButtonElement;
        filesBar.type = "button";
        filesBar.className = "llm-user-files-bar";

        const filesIcon = doc.createElement("span") as HTMLSpanElement;
        filesIcon.className = "llm-user-files-icon";
        filesIcon.setAttribute("aria-hidden", "true");

        const filesLabel = doc.createElement("span") as HTMLSpanElement;
        filesLabel.className = "llm-user-files-label";
        filesLabel.textContent = i18n.fileCount(fileAttachments.length);
        filesLabel.title = fileAttachments.map((f) => f.name).join("\n");

        filesBar.append(filesIcon, filesLabel);

        const filesExpandedEl = doc.createElement("div") as HTMLDivElement;
        filesExpandedEl.className =
          "llm-user-files-expanded llm-user-context-popover";
        filesExpanded = filesExpandedEl;
        const filesList = doc.createElement("div") as HTMLDivElement;
        filesList.className = "llm-user-files-list";

        for (const attachment of fileAttachments) {
          const canOpen = Boolean(toFileUrl(attachment.storedPath));
          const fileItem = doc.createElement(canOpen ? "button" : "div") as
            HTMLButtonElement | HTMLDivElement;
          fileItem.className = "llm-user-files-item";
          if (canOpen) {
            fileItem.classList.add("llm-user-files-item-openable");
            (fileItem as HTMLButtonElement).type = "button";
            (fileItem as HTMLButtonElement).title = i18n.openAttachment(
              attachment.name,
            );
            fileItem.addEventListener("mousedown", (e: Event) => {
              const mouse = e as MouseEvent;
              if (mouse.button !== 0) return;
              mouse.preventDefault();
              mouse.stopPropagation();
              openStoredAttachmentFromMessage(attachment);
            });
            fileItem.addEventListener("click", (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
            });
            fileItem.addEventListener("keydown", (e: KeyboardEvent) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              e.stopPropagation();
              openStoredAttachmentFromMessage(attachment);
            });
          }

          const fileType = doc.createElement("span") as HTMLSpanElement;
          fileType.className = "llm-user-files-item-type";
          fileType.textContent = getAttachmentTypeLabel(attachment);
          fileType.title =
            attachment.mimeType || attachment.category || i18n.fileFallback;
          fileType.setAttribute("data-category", attachment.category || "file");

          const fileInfo = doc.createElement("div") as HTMLDivElement;
          fileInfo.className = "llm-user-files-item-text";

          const fileName = doc.createElement("span") as HTMLSpanElement;
          fileName.className = "llm-user-files-item-name";
          fileName.textContent = attachment.name;
          fileName.title = attachment.name;

          const fileMeta = doc.createElement("span") as HTMLSpanElement;
          fileMeta.className = "llm-user-files-item-meta";
          fileMeta.textContent = `${attachment.mimeType || "application/octet-stream"} | ${(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB`;

          fileInfo.append(fileName, fileMeta);
          fileItem.append(fileType, fileInfo);
          filesList.appendChild(fileItem);
        }
        filesExpandedEl.appendChild(filesList);

        const applyFilesState = () => {
          const expanded = Boolean(msg.attachmentsExpanded);
          filesBar.classList.toggle("expanded", expanded);
          filesBar.setAttribute("aria-expanded", expanded ? "true" : "false");
          filesExpandedEl.hidden = !expanded;
          filesExpandedEl.style.display = expanded ? "block" : "none";
          if (expanded) {
            positionUserContextPopover(
              chatBox,
              filesBar,
              filesExpandedEl,
              "block",
            );
          }
          filesBar.title = expanded ? i18n.collapseFiles : i18n.expandFiles;
        };
        const toggleFilesExpanded = () => {
          mutateChatWithScrollGuard(() => {
            const nextExpanded = !msg.attachmentsExpanded;
            if (!nextExpanded) {
              closeActiveUserContextPopover();
              msg.attachmentsExpanded = false;
              applyFilesState();
              return;
            }
            closeActiveUserContextPopover();
            msg.attachmentsExpanded = true;
            applyFilesState();
            openUserContextPopover({
              body: chatBox,
              chatBox,
              anchor: filesBar,
              popover: filesExpandedEl,
              display: "block",
              close: () => {
                msg.attachmentsExpanded = false;
                applyFilesState();
              },
            });
          });
        };
        applyFilesState();
        filesBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          toggleFilesExpanded();
        });
        filesBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        filesBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleFilesExpanded();
        });

        contextBadgesRow.appendChild(filesBar);
        hasContextBadge = true;
      }

      if (hasContextBadge) {
        wrapper.appendChild(contextBadgesRow);
      }
      if (selectedTextExpanded) {
        contextPopoverRoot.appendChild(selectedTextExpanded);
      }
      if (screenshotExpanded) {
        contextPopoverRoot.appendChild(screenshotExpanded);
      }
      if (papersExpanded) {
        contextPopoverRoot.appendChild(papersExpanded);
      }
      if (filesExpanded) {
        contextPopoverRoot.appendChild(filesExpanded);
      }

      bubble.textContent = sanitizeText(msg.text || "");
      const canOpenLegacyPromptMenu = false;
      if (canOpenLegacyPromptMenu && canEditUserMessage) {
        bubble.addEventListener("contextmenu", (e: Event) => {
          const me = e as MouseEvent;
          me.preventDefault();
          me.stopPropagation();
          if (typeof me.stopImmediatePropagation === "function") {
            me.stopImmediatePropagation();
          }
          const promptMenu = body.querySelector(
            "#llm-prompt-menu",
          ) as HTMLDivElement | null;
          const responseMenu = body.querySelector(
            "#llm-response-menu",
          ) as HTMLDivElement | null;
          const exportMenu = body.querySelector(
            "#llm-export-menu",
          ) as HTMLDivElement | null;
          const retryModelMenu = body.querySelector(
            "#llm-retry-model-menu",
          ) as HTMLDivElement | null;
          if (!promptMenu) return;
          if (responseMenu) responseMenu.style.display = "none";
          if (exportMenu) exportMenu.style.display = "none";
          if (retryModelMenu) {
            retryModelMenu.classList.remove("llm-model-menu-open");
            retryModelMenu.style.display = "none";
          }
          setResponseMenuTarget(null);
          positionMenuAtPointer(body, promptMenu, me.clientX, me.clientY);
        });
      }
    } else {
      const hasModelName = Boolean(msg.modelName?.trim());
      const hasAnswerText = Boolean(msg.text);
      if (hasAnswerText) {
        const safeText = sanitizeText(msg.text);
        const renderAssistantMarkdown = (target: HTMLDivElement) => {
          try {
            target.innerHTML = renderMarkdown(safeText);
          } catch (err) {
            ztoolkit.log("LLM render error:", err);
            target.textContent = safeText;
          }
        };
        if (msg.streaming) {
          const streamingContent = doc.createElement("div") as HTMLDivElement;
          streamingContent.setAttribute("data-streaming-content", "true");
          renderAssistantMarkdown(streamingContent);
          bubble.appendChild(streamingContent);
        } else {
          renderAssistantMarkdown(bubble);
        }
        bubble.addEventListener("contextmenu", (e: Event) => {
          const me = e as MouseEvent;
          me.preventDefault();
          me.stopPropagation();
          if (typeof me.stopImmediatePropagation === "function") {
            me.stopImmediatePropagation();
          }
          const responseMenu = body.querySelector(
            "#llm-response-menu",
          ) as HTMLDivElement | null;
          const exportMenu = body.querySelector(
            "#llm-export-menu",
          ) as HTMLDivElement | null;
          const promptMenu = body.querySelector(
            "#llm-prompt-menu",
          ) as HTMLDivElement | null;
          const retryModelMenu = body.querySelector(
            "#llm-retry-model-menu",
          ) as HTMLDivElement | null;
          if (!responseMenu || !item) return;
          if (exportMenu) exportMenu.style.display = "none";
          if (promptMenu) promptMenu.style.display = "none";
          if (retryModelMenu) {
            retryModelMenu.classList.remove("llm-model-menu-open");
            retryModelMenu.style.display = "none";
          }
          setPromptMenuTarget(null);
          const imageDataUrl = getGeneratedImageDataUrlFromElement(
            me.target as Element | null,
          );
          const exportImageBtn = responseMenu.querySelector(
            "#llm-response-menu-export-image",
          ) as HTMLButtonElement | null;
          if (exportImageBtn) {
            exportImageBtn.style.display = imageDataUrl ? "" : "none";
          }
          // If the user has text selected within this bubble, extract
          // just that portion (with KaTeX math properly handled).
          // Otherwise fall back to the full raw markdown source.
          const selectedText = getSelectedTextWithinBubble(doc, bubble);
          const fullMarkdown = sanitizeText(msg.text || "").trim();
          const contentText = selectedText || fullMarkdown;
          if (!contentText) return;
          setResponseMenuTarget({
            item,
            contentText,
            modelName: msg.modelName?.trim() || "unknown",
            imageDataUrl: imageDataUrl || undefined,
          });
          positionMenuAtPointer(body, responseMenu, me.clientX, me.clientY);
        });
      }

      if (!hasAnswerText) {
        if (msg.streaming) {
          // Skeleton loading animation: 3 shimmer bars
          const skeleton = doc.createElement("div") as HTMLDivElement;
          skeleton.className = "llm-streaming-skeleton";
          for (let i = 0; i < 3; i++) {
            const bar = doc.createElement("div") as HTMLDivElement;
            bar.className = "llm-skeleton-bar";
            skeleton.appendChild(bar);
          }
          bubble.appendChild(skeleton);
        } else {
          const typing = doc.createElement("div") as HTMLDivElement;
          typing.className = "llm-typing";
          typing.innerHTML =
            '<span class="llm-typing-dot"></span><span class="llm-typing-dot"></span><span class="llm-typing-dot"></span>';
          bubble.appendChild(typing);
        }
      }

      if (hasModelName) {
        const modelName = doc.createElement("div") as HTMLDivElement;
        modelName.className = "llm-model-name";
        modelName.textContent = msg.modelName?.trim() || "";
        bubble.insertBefore(modelName, bubble.firstChild);
      }
    }

    const meta = doc.createElement("div") as HTMLDivElement;
    meta.className = "llm-message-meta";

    const appendVariantNav = () => {
      if (
        !Number.isFinite(msg.messageId) ||
        (msg.siblingCount || 0) <= 1 ||
        !Array.isArray(msg.siblingMessageIds) ||
        msg.siblingMessageIds.length <= 1
      ) {
        return;
      }
      const siblingIndex = Math.max(1, msg.siblingIndex || 1);
      const siblingCount = msg.siblingMessageIds.length;
      const currentOffset = Math.max(0, siblingIndex - 1);
      const prevId = msg.siblingMessageIds[currentOffset - 1];
      const nextId = msg.siblingMessageIds[currentOffset + 1];
      const parentId = msg.parentMessageId ?? null;
      const variantWrap = doc.createElement("span") as HTMLSpanElement;
      variantWrap.className = "llm-variant-nav";
      variantWrap.dataset.variantKind = isUser ? "user" : "assistant";
      const makeVariantButton = (
        direction: "prev" | "next",
        targetId: number | undefined,
      ) => {
        const btn = doc.createElement("button") as HTMLButtonElement;
        btn.type = "button";
        btn.className = `llm-variant-btn llm-variant-${direction}`;
        btn.textContent = direction === "prev" ? "<" : ">";
        btn.title =
          direction === "prev" ? i18n.previousVariant : i18n.nextVariant;
        btn.setAttribute("aria-label", btn.title);
        btn.disabled = !targetId;
        btn.dataset.variantKind = isUser ? "user" : "assistant";
        btn.dataset.parentMessageId = parentId === null ? "" : String(parentId);
        if (targetId) btn.dataset.childMessageId = String(targetId);
        return btn;
      };
      variantWrap.appendChild(makeVariantButton("prev", prevId));
      const indicator = doc.createElement("span") as HTMLSpanElement;
      indicator.className = "llm-variant-indicator";
      indicator.textContent = `${siblingIndex}/${siblingCount}`;
      variantWrap.appendChild(indicator);
      variantWrap.appendChild(makeVariantButton("next", nextId));
      meta.appendChild(variantWrap);
    };

    if (!isUser) {
      appendVariantNav();
    }

    // Copy button for every message with text
    if (msg.text?.trim()) {
      const copyBtn = doc.createElement("button") as HTMLButtonElement;
      copyBtn.type = "button";
      copyBtn.className = "llm-msg-copy-btn";
      copyBtn.title = i18n.copy;
      copyBtn.setAttribute("aria-label", i18n.copy);
      copyBtn.dataset.msgIndex = String(index);
      if (Number.isFinite(msg.messageId)) {
        copyBtn.dataset.messageId = String(msg.messageId);
      }
      meta.appendChild(copyBtn);

      if (!isUser) {
        // Save as note button (book with plus)
        const noteBtn = doc.createElement("button") as HTMLButtonElement;
        noteBtn.type = "button";
        noteBtn.className = "llm-msg-note-btn";
        noteBtn.title = i18n.saveAsNote;
        noteBtn.setAttribute("aria-label", i18n.saveAsNote);
        noteBtn.dataset.msgIndex = String(index);
        if (Number.isFinite(msg.messageId)) {
          noteBtn.dataset.messageId = String(msg.messageId);
        }
        meta.appendChild(noteBtn);
      }
    }

    if (canShowEditUserMessage) {
      const editBtn = doc.createElement("button") as HTMLButtonElement;
      editBtn.type = "button";
      editBtn.className = "llm-edit-message";
      editBtn.textContent = "";
      editBtn.title = i18n.edit;
      editBtn.setAttribute("aria-label", i18n.edit);
      editBtn.dataset.messageId = String(msg.messageId);
      editBtn.disabled = !canEditUserMessage;
      meta.appendChild(editBtn);
    }

    if (isUser) {
      appendVariantNav();
    } else {
      const time = doc.createElement("span") as HTMLSpanElement;
      time.className = "llm-message-time";
      time.textContent = formatTime(msg.timestamp);
      meta.appendChild(time);
    }

    if (!isUser && !msg.streaming && msg.text.trim() && msg.messageId) {
      const branchBtn = doc.createElement("button") as HTMLButtonElement;
      branchBtn.type = "button";
      branchBtn.className = "llm-branch-chat";
      branchBtn.textContent = "";
      branchBtn.title = i18n.branchToNewChat;
      branchBtn.setAttribute("aria-label", i18n.branchToNewChat);
      branchBtn.dataset.messageId = String(msg.messageId);
      meta.appendChild(branchBtn);
    }

    if (
      !isUser &&
      index === latestAssistantIndex &&
      !msg.streaming &&
      msg.text.trim()
    ) {
      const retryBtn = doc.createElement("button") as HTMLButtonElement;
      retryBtn.type = "button";
      retryBtn.className = "llm-retry-latest";
      retryBtn.textContent = "";
      retryBtn.title = i18n.retry;
      retryBtn.setAttribute("aria-label", i18n.retry);
      if (Number.isFinite(msg.messageId)) {
        retryBtn.dataset.messageId = String(msg.messageId);
      }
      meta.appendChild(retryBtn);
    }

    wrapper.appendChild(bubble);
    wrapper.appendChild(meta);
    chatBox.appendChild(wrapper);
    if (isUser && hasUserContext) {
      wrapper.classList.add("llm-user-context-aligned");
    }
  }

  syncUserContextAlignmentWidths(body);

  applyChatScrollSnapshot(chatBox, baselineSnapshot);
  persistChatScrollSnapshotByKey(conversationKey, chatBox);
  if (baselineSnapshot.mode === "followBottom") {
    scheduleFollowBottomStabilization(body, conversationKey, chatBox);
  } else {
    const win = body.ownerDocument?.defaultView;
    cancelFollowBottomStabilization(win, conversationKey);
  }
}
