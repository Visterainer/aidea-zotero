import { renderMarkdown, renderMarkdownForNote } from "../../utils/markdown";
import {
  findLastAssistantBubble,
  patchStreamingBubble,
  finalizeStreamingBubble,
  createQueuedStreamingPatch,
  createStreamingAutoScroller,
} from "./streamingUpdate";
import {
  appendMessage as appendStoredMessage,
  clearConversation as clearStoredConversation,
  loadConversation,
  pruneConversation,
  updateLatestUserMessage as updateStoredLatestUserMessage,
  updateLatestAssistantMessage as updateStoredLatestAssistantMessage,
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
  GLOBAL_CONVERSATION_KEY_BASE,
  formatFigureCountLabel,
  formatPaperCountLabel,
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
  getSelectedTextSourceIcon,
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
  getAdvancedModelParamsForProfile,
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
import { extractManagedBlobHash } from "./attachmentStorage";
import { toFileUrl } from "../../utils/pathFileUrl";
import { replaceOwnerAttachmentRefs } from "../../utils/attachmentRefStore";
import { getPanelI18n } from "./i18n";
import {
  autoCaptureUserMemories,
  formatRelevantMemoriesContext,
  resolveMemoryLibraryID,
  searchMemories,
} from "../../utils/memoryStore";

/** Get AbortController constructor from global scope */
const panelI18n = getPanelI18n();

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
      | ((url: string) => void)
      | undefined;
    if (typeof launch === "function") {
      launch(fileUrl);
      return true;
    }
  } catch (_err) {
    void _err;
  }
  try {
    const win = Zotero.getMainWindow?.() as
      | (Window & { open?: (url?: string, target?: string) => unknown })
      | null;
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

function getMessageSelectedTextExpandedIndex(
  message: Message,
  count: number,
): number {
  if (count <= 0) return -1;
  const rawIndex = message.selectedTextExpandedIndex;
  if (typeof rawIndex === "number" && Number.isFinite(rawIndex)) {
    const normalized = Math.floor(rawIndex);
    if (normalized >= 0 && normalized < count) return normalized;
  }
  if (message.selectedTextExpanded === true) return 0;
  return -1;
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

async function persistConversationMessage(
  conversationKey: number,
  message: StoredChatMessage,
): Promise<void> {
  try {
    await appendStoredMessage(conversationKey, message);
    await pruneConversation(conversationKey, PERSISTED_HISTORY_LIMIT);
    const storedMessages = await loadConversation(
      conversationKey,
      PERSISTED_HISTORY_LIMIT,
    );
    const attachmentHashes =
      collectAttachmentHashesFromStoredMessages(storedMessages);
    await replaceOwnerAttachmentRefs(
      "conversation",
      conversationKey,
      attachmentHashes,
    );
  } catch (err) {
    ztoolkit.log("LLM: Failed to persist chat message", err);
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
      const storedMessages = await loadConversation(
        conversationKey,
        PERSISTED_HISTORY_LIMIT,
      );
      chatHistory.set(
        conversationKey,
        storedMessages.map((message) => toPanelMessage(message)),
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

export async function copyTextToClipboard(
  body: Element,
  text: string,
): Promise<void> {
  const safeText = sanitizeText(text).trim();
  if (!safeText) return;

  const win = body.ownerDocument?.defaultView as
    | (Window & { navigator?: Navigator })
    | undefined;
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
      | { copyString: (value: string) => void }
      | undefined;
    if (svc) svc.copyString(safeText);
  } catch (err) {
    ztoolkit.log("Clipboard fallback copy failed:", err);
  }
}

/**
 * Render markdown text through renderMarkdownForNote and copy the result
 * to the clipboard as both text/html and text/plain.  When pasted into a
 * Zotero note, the HTML version is used 闂?producing the same rendering as
 * "Save as note".  When pasted into a plain-text editor, the raw markdown
 * is used 闂?matching "Copy chat as md".
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
  advanced: AdvancedModelParams;
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

  const advanced =
    params.advanced || getAdvancedModelParamsForProfile(fallbackProfile.key);
  return { model, apiBase, apiKey, advanced };
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
    params.setStatusSafely("Using cached document context", "sending");
    ztoolkit.log(
      `LLM context: using cached basePdfContext (${pdfContext.length} chars, itemId=${pool.basePdfItemId})`,
    );
  } else if (pool.basePdfItemId !== null) {
    // Pool was restored from DB with a known item ID but empty text.
    // Rebuild from the stored ID instead of re-resolving from the current tab.
    params.setStatusSafely("Rebuilding document context...", "sending");
    try {
      const ctxItem = Zotero.Items.get(pool.basePdfItemId);
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
          ? Zotero.Items.get(ctxItem.parentID)
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
      `Using ${pool.supplementalContexts.size} supplemental paper context(s)`,
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
      const attachment = Zotero.Items.get(pool.basePdfItemId);
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
): void {
  // Don't overwrite if pool already exists (e.g., still in memory).
  if (conversationContextPool.has(conversationKey)) return;

  // Find the latest user message with contextRefs.
  let latestContextRefs: ContextRefsJson | undefined;
  for (let i = storedMessages.length - 1; i >= 0; i--) {
    const msg = storedMessages[i];
    if (msg.role === "user" && msg.contextRefs) {
      latestContextRefs = msg.contextRefs;
      break;
    }
  }
  if (!latestContextRefs) return;

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
    total += (msg.text || "").length;
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
      return `[${role}]: ${(msg.text || "").slice(0, 2000)}`;
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

type AssistantMessageSnapshot = Pick<
  Message,
  "text" | "timestamp" | "modelName"
>;

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

function takeAssistantSnapshot(message: Message): AssistantMessageSnapshot {
  return {
    text: message.text,
    timestamp: message.timestamp,
    modelName: message.modelName,
  };
}

function restoreAssistantSnapshot(
  message: Message,
  snapshot: AssistantMessageSnapshot,
): void {
  message.text = snapshot.text;
  message.timestamp = snapshot.timestamp;
  message.modelName = snapshot.modelName;
  message.streaming = false;
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

function buildHistoryMessageForLLM(message: Message): ChatMessage {
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: sanitizeText(message.text || ""),
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
  | "ok"
  | "missing"
  | "stale"
  | "persist-failed";

function normalizeEditableAttachments(
  attachments?: ChatAttachment[],
): ChatAttachment[] {
  const normalized = (
    Array.isArray(attachments)
      ? attachments.filter(
          (attachment) =>
            Boolean(attachment) &&
            typeof attachment === "object" &&
            typeof attachment.id === "string" &&
            attachment.id.trim() &&
            typeof attachment.name === "string" &&
            attachment.name.trim() &&
            attachment.category !== "image",
        )
      : []
  ) as ChatAttachment[];
  return normalized.map((attachment) => ({
    ...attachment,
    id: attachment.id.trim(),
    name: attachment.name.trim(),
    mimeType:
      typeof attachment.mimeType === "string" && attachment.mimeType.trim()
        ? attachment.mimeType.trim()
        : "application/octet-stream",
    sizeBytes: Number.isFinite(attachment.sizeBytes)
      ? Math.max(0, attachment.sizeBytes)
      : 0,
    textContent:
      typeof attachment.textContent === "string"
        ? attachment.textContent
        : undefined,
    storedPath:
      typeof attachment.storedPath === "string" && attachment.storedPath.trim()
        ? attachment.storedPath.trim()
        : undefined,
    contentHash:
      typeof attachment.contentHash === "string" &&
      /^[a-f0-9]{64}$/i.test(attachment.contentHash.trim())
        ? attachment.contentHash.trim().toLowerCase()
        : undefined,
  }));
}

function normalizeEditablePaperContexts(
  paperContexts?: PaperContextRef[],
): PaperContextRef[] {
  return normalizePaperContexts(paperContexts);
}

export async function editLatestUserMessageAndRetry(
  body: Element,
  item: Zotero.Item,
  displayQuestion: string,
  selectedTexts?: string[],
  selectedTextSources?: SelectedTextSource[],
  selectedTextPaperContexts?: (PaperContextRef | undefined)[],
  screenshotImages?: string[],
  paperContexts?: PaperContextRef[],
  attachments?: ChatAttachment[],
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
  if (!retryPair) return "missing";
  if (retryPair.assistantMessage.streaming) return "stale";
  if (
    expected &&
    (expected.conversationKey !== conversationKey ||
      retryPair.userMessage.timestamp !== expected.userTimestamp ||
      retryPair.assistantMessage.timestamp !== expected.assistantTimestamp)
  ) {
    return "stale";
  }

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
  const screenshotImagesForMessage = Array.isArray(screenshotImages)
    ? screenshotImages
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .slice(0, MAX_SELECTED_IMAGES)
    : [];
  const paperContextsForMessage = normalizeEditablePaperContexts(paperContexts);
  const attachmentsForMessage = normalizeEditableAttachments(attachments);
  const updatedTimestamp = Date.now();
  const nextDisplayQuestion = sanitizeText(displayQuestion || "");

  retryPair.userMessage.text = nextDisplayQuestion;
  retryPair.userMessage.timestamp = updatedTimestamp;
  retryPair.userMessage.selectedText = selectedTextForMessage || undefined;
  retryPair.userMessage.selectedTextExpanded = false;
  retryPair.userMessage.selectedTexts = selectedTextsForMessage.length
    ? selectedTextsForMessage
    : undefined;
  retryPair.userMessage.selectedTextSources =
    selectedTextSourcesForMessage.length
      ? selectedTextSourcesForMessage
      : undefined;
  retryPair.userMessage.selectedTextPaperContexts =
    selectedTextPaperContextsForMessage.some((entry) => Boolean(entry))
      ? selectedTextPaperContextsForMessage
      : undefined;
  retryPair.userMessage.selectedTextExpandedIndex = -1;
  retryPair.userMessage.screenshotImages = screenshotImagesForMessage.length
    ? screenshotImagesForMessage
    : undefined;
  retryPair.userMessage.screenshotExpanded = false;
  retryPair.userMessage.screenshotActiveIndex =
    screenshotImagesForMessage.length ? 0 : undefined;
  retryPair.userMessage.paperContexts = paperContextsForMessage.length
    ? paperContextsForMessage
    : undefined;
  retryPair.userMessage.paperContextsExpanded = false;
  retryPair.userMessage.attachments = attachmentsForMessage.length
    ? attachmentsForMessage
    : undefined;
  retryPair.userMessage.attachmentsExpanded = false;
  retryPair.userMessage.attachmentActiveIndex = undefined;

  try {
    await updateStoredLatestUserMessage(conversationKey, {
      text: retryPair.userMessage.text,
      timestamp: retryPair.userMessage.timestamp,
      selectedText: retryPair.userMessage.selectedText,
      selectedTexts: retryPair.userMessage.selectedTexts,
      selectedTextSources: retryPair.userMessage.selectedTextSources,
      selectedTextPaperContexts:
        retryPair.userMessage.selectedTextPaperContexts,
      screenshotImages: retryPair.userMessage.screenshotImages,
      paperContexts: retryPair.userMessage.paperContexts,
      attachments: retryPair.userMessage.attachments,
    });

    const storedMessages = await loadConversation(
      conversationKey,
      PERSISTED_HISTORY_LIMIT,
    );
    const attachmentHashes =
      collectAttachmentHashesFromStoredMessages(storedMessages);
    await replaceOwnerAttachmentRefs(
      "conversation",
      conversationKey,
      attachmentHashes,
    );
  } catch (err) {
    ztoolkit.log("LLM: Failed to persist edited latest user message", err);
    return "persist-failed";
  }

  await retryLatestAssistantResponse(
    body,
    item,
    model,
    apiBase,
    apiKey,
    advanced,
  );
  return "ok";
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
  if (isPanelGenerating(body)) {
    if (ui.status) {
      setStatus(ui.status, "Wait for the current response to finish", "ready");
    }
    return;
  }

  await ensureConversationLoaded(item);
  const conversationKey = getConversationKey(item);
  const history = chatHistory.get(conversationKey) || [];
  const retryPair = findLatestRetryPair(history);
  if (!retryPair) {
    if (ui.status) setStatus(ui.status, "No retryable response found", "error");
    return;
  }

  const thisRequestId = nextRequestId();
  beginPanelRequest(body, thisRequestId);
  setRequestUIBusy(body, ui, conversationKey, "Preparing retry...");
  const { refreshChatSafely, setStatusSafely } = createPanelUpdateHelpers(
    body,
    item,
    conversationKey,
    ui,
  );

  const historyForLLM = history
    .slice(0, retryPair.userIndex)
    .slice(-MAX_HISTORY_MESSAGES);
  const { question, screenshotImages, fileAttachments, paperContexts } =
    reconstructRetryPayload(retryPair.userMessage);
  if (!question.trim()) {
    setStatusSafely("Nothing to retry for latest turn", "error");
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

  const assistantMessage = retryPair.assistantMessage;
  const assistantSnapshot = takeAssistantSnapshot(assistantMessage);
  assistantMessage.text = "";
  assistantMessage.streaming = true;
  refreshChatSafely();
  let streamedAnswer = "";

  const restoreOriginalAssistant = () => {
    restoreAssistantSnapshot(assistantMessage, assistantSnapshot);
    refreshChatSafely();
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
      restoreOriginalAssistant();
      setStatusSafely(panelI18n.cancelled, "ready");
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
      restoreOriginalAssistant();
      setStatusSafely(panelI18n.cancelled, "ready");
      return;
    }
    const panelAbortController = getPanelAbortController(body);
    if (isPanelRequestCancelled(body, thisRequestId)) {
      panelAbortController?.abort();
      restoreOriginalAssistant();
      setStatusSafely(panelI18n.cancelled, "ready");
      return;
    }

    // Incremental DOM update: find the skeleton bubble that refreshChat
    // created and patch it in place instead of re-rendering the whole chat.
    const retryBubbleRef = findLastAssistantBubble(
      ui.chatBox as HTMLDivElement | null,
    );
    const retryAutoScroller = createStreamingAutoScroller(
      ui.chatBox as HTMLDivElement | null,
      suspendScrollUpdates,
      resumeScrollUpdates,
    );
    const queueRetryPatch = createQueuedStreamingPatch(() => {
      retryAutoScroller.patchAndScroll(() => {
        patchStreamingBubble(retryBubbleRef, assistantMessage.text);
      });
    });

    const answer = await callLLMStream(
      {
        prompt: question,
        context: combinedContext,
        history: llmHistory,
        signal: panelAbortController?.signal,
        images: screenshotImages,
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
      finalizeStreamingBubble(retryBubbleRef);
      assistantMessage.text = streamedAnswer || assistantMessage.text;
      assistantMessage.timestamp = Date.now();
      assistantMessage.modelName = effectiveRequestConfig.model;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await updateStoredLatestAssistantMessage(conversationKey, {
        text: assistantMessage.text,
        timestamp: assistantMessage.timestamp,
        modelName: assistantMessage.modelName,
      });
      setStatusSafely("Ready", "ready");
      return;
    }

    finalizeStreamingBubble(retryBubbleRef);
    assistantMessage.text =
      sanitizeText(answer) || streamedAnswer || "No response.";
    assistantMessage.timestamp = Date.now();
    assistantMessage.modelName = effectiveRequestConfig.model;
    assistantMessage.streaming = false;
    refreshChatSafely();

    await updateStoredLatestAssistantMessage(conversationKey, {
      text: assistantMessage.text,
      timestamp: assistantMessage.timestamp,
      modelName: assistantMessage.modelName,
    });

    setStatusSafely("Ready", "ready");
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
        await updateStoredLatestAssistantMessage(conversationKey, {
          text: assistantMessage.text,
          timestamp: Date.now(),
          modelName: effectiveRequestConfig.model,
        });
      } else {
        restoreOriginalAssistant();
      }
      setStatusSafely("Ready", "ready");
      return;
    }

    restoreOriginalAssistant();
    const errMsg = (err as Error).message || "Error";
    const retryHint = resolveMultimodalRetryHint(
      errMsg,
      screenshotImages.length,
    );
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
  if (isPanelGenerating(body)) {
    if (ui.status) {
      setStatus(ui.status, "Wait for the current response to finish", "ready");
    }
    return;
  }

  // Track this request
  const thisRequestId = nextRequestId();
  beginPanelRequest(body, thisRequestId);
  const initialConversationKey = getConversationKey(item);

  // Show cancel, hide send
  setRequestUIBusy(body, ui, initialConversationKey, "Preparing request...");

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
  const historyForLLM = history.slice(-MAX_HISTORY_MESSAGES);
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
  };
  history.push(userMessage);
  await persistConversationMessage(conversationKey, {
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
    contextRefs: buildContextRefsSnapshot(conversationKey),
  });

  const assistantMessage: Message = {
    role: "assistant",
    text: "",
    timestamp: Date.now(),
    modelName: effectiveRequestConfig.model,
    streaming: true,
  };
  history.push(assistantMessage);
  if (history.length > PERSISTED_HISTORY_LIMIT) {
    history.splice(0, history.length - PERSISTED_HISTORY_LIMIT);
  }
  refreshChatSafely();

  let assistantPersisted = false;
  const persistAssistantOnce = async () => {
    if (assistantPersisted) return;
    assistantPersisted = true;
    await persistConversationMessage(conversationKey, {
      role: "assistant",
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
      await persistAssistantOnce();
    } else {
      // Nothing generated yet — keep the assistant message as a
      // "cancelled" placeholder so that the user-assistant pair stays
      // intact.  This lets the user still edit / retry the last prompt
      // via findLatestRetryPair().
      assistantMessage.text = `*(${panelI18n.cancelled})*`;
      assistantMessage.streaming = false;
      refreshChatSafely();
      await persistAssistantOnce();
    }
    setStatusSafely("Ready", "ready");
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
    // Incremental DOM update: find the skeleton bubble that refreshChat
    // created and patch it in place instead of re-rendering the whole chat.
    const sendBubbleRef = findLastAssistantBubble(
      ui.chatBox as HTMLDivElement | null,
    );
    const sendAutoScroller = createStreamingAutoScroller(
      ui.chatBox as HTMLDivElement | null,
      suspendScrollUpdates,
      resumeScrollUpdates,
    );
    const queueStreamingPatch = createQueuedStreamingPatch(() => {
      sendAutoScroller.patchAndScroll(() => {
        patchStreamingBubble(sendBubbleRef, assistantMessage.text);
      });
    });

    const answer = await callLLMStream(
      {
        prompt: question,
        context: combinedContext,
        history: llmHistory,
        signal: panelAbortController?.signal,
        images: images,
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

    finalizeStreamingBubble(sendBubbleRef);
    assistantMessage.text =
      sanitizeText(answer) || assistantMessage.text || "No response.";
    assistantMessage.streaming = false;
    refreshChatSafely();
    await persistAssistantOnce();

    setStatusSafely("Ready", "ready");
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
    assistantMessage.text = `Error: ${errMsg}${retryHint}`;
    assistantMessage.streaming = false;
    refreshChatSafely();
    await persistAssistantOnce();

    setStatusSafely(`Error: ${`${errMsg}${retryHint}`.slice(0, 40)}`, "error");
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
  setPromptMenuTarget(null);

  if (!item) {
    chatBox.innerHTML = `
      <div class="llm-welcome">
        <div class="llm-welcome-icon">AI</div>
        <div class="llm-welcome-text">Select an item or open a PDF to start.</div>
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
        <div class="llm-welcome-icon">AI</div>
      </div>
    `;
    return;
  }

  chatBox.innerHTML = "";

  const latestRetryPair = findLatestRetryPair(history);
  const latestAssistantIndex = latestRetryPair
    ? latestRetryPair.userIndex + 1
    : -1;
  const latestEditableUserIndex = latestRetryPair?.userIndex ?? -1;
  const latestEditableUserTimestamp = latestRetryPair?.userMessage.timestamp;
  const latestEditableAssistantTimestamp =
    latestRetryPair?.assistantMessage.timestamp;
  const latestEditableIsIdle = Boolean(
    latestRetryPair && !latestRetryPair.assistantMessage.streaming,
  );

  for (const [index, msg] of history.entries()) {
    const isUser = msg.role === "user";
    const canEditLatestUserPrompt = Boolean(
      isUser &&
      item &&
      latestEditableIsIdle &&
      index === latestEditableUserIndex &&
      Number.isFinite(latestEditableUserTimestamp) &&
      Number.isFinite(latestEditableAssistantTimestamp),
    );
    let hasUserContext = false;
    const wrapper = doc.createElement("div") as HTMLDivElement;
    wrapper.className = `llm-message-wrapper ${isUser ? "user" : "assistant"}`;

    const bubble = doc.createElement("div") as HTMLDivElement;
    bubble.className = `llm-bubble ${isUser ? "user" : "assistant"}`;

    if (isUser) {
      const contextBadgesRow = doc.createElement("div") as HTMLDivElement;
      contextBadgesRow.className = "llm-user-context-badges";
      let hasContextBadge = false;

      const screenshotImages = Array.isArray(msg.screenshotImages)
        ? msg.screenshotImages.filter((entry) => Boolean(entry))
        : [];
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
      if (hasScreenshotContext) {
        const screenshotBar = doc.createElement("button") as HTMLButtonElement;
        screenshotBar.type = "button";
        screenshotBar.className = "llm-user-screenshots-bar";

        const screenshotIcon = doc.createElement("span") as HTMLSpanElement;
        screenshotIcon.className = "llm-user-screenshots-icon";
        screenshotIcon.textContent = "IMG";

        const screenshotLabel = doc.createElement("span") as HTMLSpanElement;
        screenshotLabel.className = "llm-user-screenshots-label";
        screenshotLabel.textContent = formatFigureCountLabel(
          screenshotImages.length,
        );

        screenshotBar.append(screenshotIcon, screenshotLabel);

        const screenshotExpandedEl = doc.createElement("div") as HTMLDivElement;
        screenshotExpandedEl.className = "llm-user-screenshots-expanded";
        screenshotExpanded = screenshotExpandedEl;

        const thumbStrip = doc.createElement("div") as HTMLDivElement;
        thumbStrip.className = "llm-user-screenshots-thumbs";

        const previewWrap = doc.createElement("div") as HTMLDivElement;
        previewWrap.className = "llm-user-screenshots-preview";
        const previewImg = doc.createElement("img") as HTMLImageElement;
        previewImg.className = "llm-user-screenshots-preview-img";
        previewImg.alt = "Screenshot preview";
        previewWrap.appendChild(previewImg);

        const thumbButtons: HTMLButtonElement[] = [];
        screenshotImages.forEach((imageUrl, index) => {
          const thumbBtn = doc.createElement("button") as HTMLButtonElement;
          thumbBtn.type = "button";
          thumbBtn.className = "llm-user-screenshot-thumb";
          thumbBtn.title = `Screenshot ${index + 1}`;

          const thumbImg = doc.createElement("img") as HTMLImageElement;
          thumbImg.className = "llm-user-screenshot-thumb-img";
          thumbImg.src = imageUrl;
          thumbImg.alt = `Screenshot ${index + 1}`;
          thumbBtn.appendChild(thumbImg);

          const activateScreenshotThumb = (e: Event) => {
            const mouse = e as MouseEvent;
            if (typeof mouse.button === "number" && mouse.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            mutateChatWithScrollGuard(() => {
              msg.screenshotActiveIndex = index;
              if (!msg.screenshotExpanded) {
                msg.screenshotExpanded = true;
              }
              applyScreenshotState();
            });
          };
          thumbBtn.addEventListener("mousedown", activateScreenshotThumb);
          thumbBtn.addEventListener("click", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
          });
          thumbBtn.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            activateScreenshotThumb(e);
          });
          thumbButtons.push(thumbBtn);
          thumbStrip.appendChild(thumbBtn);
        });

        screenshotExpandedEl.append(thumbStrip, previewWrap);

        const applyScreenshotState = () => {
          const expanded = Boolean(msg.screenshotExpanded);
          let activeIndex =
            typeof msg.screenshotActiveIndex === "number"
              ? Math.floor(msg.screenshotActiveIndex)
              : 0;
          if (activeIndex < 0 || activeIndex >= screenshotImages.length) {
            activeIndex = 0;
            msg.screenshotActiveIndex = 0;
          }
          screenshotBar.classList.toggle("expanded", expanded);
          screenshotBar.setAttribute(
            "aria-expanded",
            expanded ? "true" : "false",
          );
          screenshotExpandedEl.hidden = !expanded;
          screenshotExpandedEl.style.display = expanded ? "flex" : "none";
          previewImg.src = screenshotImages[activeIndex];
          thumbButtons.forEach((btn, index) => {
            btn.classList.toggle("active", index === activeIndex);
          });
          screenshotBar.title = expanded
            ? "Collapse figures"
            : "Expand figures";
        };

        const toggleScreenshotsExpanded = () => {
          mutateChatWithScrollGuard(() => {
            msg.screenshotExpanded = !msg.screenshotExpanded;
            applyScreenshotState();
          });
        };
        applyScreenshotState();
        screenshotBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          toggleScreenshotsExpanded();
        });
        screenshotBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        screenshotBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleScreenshotsExpanded();
        });

        contextBadgesRow.appendChild(screenshotBar);
        hasContextBadge = true;
      }

      const paperContexts = normalizePaperContexts(msg.paperContexts);
      hasUserContext = hasUserContext || paperContexts.length > 0;
      if (paperContexts.length) {
        const papersBar = doc.createElement("button") as HTMLButtonElement;
        papersBar.type = "button";
        papersBar.className = "llm-user-papers-bar";

        const papersIcon = doc.createElement("span") as HTMLSpanElement;
        papersIcon.className = "llm-user-papers-icon";
        papersIcon.textContent = "REF";

        const papersLabel = doc.createElement("span") as HTMLSpanElement;
        papersLabel.className = "llm-user-papers-label";
        papersLabel.textContent = formatPaperCountLabel(paperContexts.length);
        papersLabel.title = paperContexts
          .map((entry) => entry.title)
          .join("\n");
        papersBar.append(papersIcon, papersLabel);

        const papersExpandedEl = doc.createElement("div") as HTMLDivElement;
        papersExpandedEl.className = "llm-user-papers-expanded";
        papersExpanded = papersExpandedEl;
        const papersList = doc.createElement("div") as HTMLDivElement;
        papersList.className = "llm-user-papers-list";
        for (const paperContext of paperContexts) {
          const paperItem = doc.createElement("div") as HTMLDivElement;
          paperItem.className = "llm-user-papers-item";

          if (paperContext.citationKey) {
            const keyBadge = doc.createElement("span") as HTMLSpanElement;
            keyBadge.className = "llm-user-papers-item-key";
            keyBadge.textContent = paperContext.citationKey;
            keyBadge.title = paperContext.citationKey;
            paperItem.appendChild(keyBadge);
          }

          const paperTitle = doc.createElement("span") as HTMLSpanElement;
          paperTitle.className = "llm-user-papers-item-title";
          paperTitle.textContent = paperContext.title;
          paperTitle.title = paperContext.title;

          const paperMeta = doc.createElement("span") as HTMLSpanElement;
          paperMeta.className = "llm-user-papers-item-meta";
          const metaParts = [
            paperContext.firstCreator || "",
            paperContext.year || "",
          ].filter(Boolean);
          paperMeta.textContent =
            metaParts.join(" 閻?") || "Supplemental paper";
          paperMeta.title = paperMeta.textContent;
          paperItem.append(paperTitle, paperMeta);
          papersList.appendChild(paperItem);
        }
        papersExpandedEl.appendChild(papersList);

        const applyPapersState = () => {
          const expanded = Boolean(msg.paperContextsExpanded);
          papersBar.classList.toggle("expanded", expanded);
          papersBar.setAttribute("aria-expanded", expanded ? "true" : "false");
          papersExpandedEl.hidden = !expanded;
          papersExpandedEl.style.display = expanded ? "block" : "none";
          papersBar.title = expanded ? "Collapse papers" : "Expand papers";
        };
        const togglePapersExpanded = () => {
          msg.paperContextsExpanded = !msg.paperContextsExpanded;
          applyPapersState();
        };
        applyPapersState();
        papersBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          togglePapersExpanded();
        });
        papersBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        papersBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          togglePapersExpanded();
        });

        contextBadgesRow.appendChild(papersBar);
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
        filesIcon.textContent = "FILE";

        const filesLabel = doc.createElement("span") as HTMLSpanElement;
        filesLabel.className = "llm-user-files-label";
        filesLabel.textContent = `Files (${fileAttachments.length})`;
        filesLabel.title = fileAttachments.map((f) => f.name).join("\n");

        filesBar.append(filesIcon, filesLabel);

        const filesExpandedEl = doc.createElement("div") as HTMLDivElement;
        filesExpandedEl.className = "llm-user-files-expanded";
        filesExpanded = filesExpandedEl;
        const filesList = doc.createElement("div") as HTMLDivElement;
        filesList.className = "llm-user-files-list";

        for (const attachment of fileAttachments) {
          const canOpen = Boolean(toFileUrl(attachment.storedPath));
          const fileItem = doc.createElement(canOpen ? "button" : "div") as
            | HTMLButtonElement
            | HTMLDivElement;
          fileItem.className = "llm-user-files-item";
          if (canOpen) {
            fileItem.classList.add("llm-user-files-item-openable");
            (fileItem as HTMLButtonElement).type = "button";
            (fileItem as HTMLButtonElement).title = `Open ${attachment.name}`;
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
          fileType.title = attachment.mimeType || attachment.category || "file";
          fileType.setAttribute("data-category", attachment.category || "file");

          const fileInfo = doc.createElement("div") as HTMLDivElement;
          fileInfo.className = "llm-user-files-item-text";

          const fileName = doc.createElement("span") as HTMLSpanElement;
          fileName.className = "llm-user-files-item-name";
          fileName.textContent = attachment.name;
          fileName.title = attachment.name;

          const fileMeta = doc.createElement("span") as HTMLSpanElement;
          fileMeta.className = "llm-user-files-item-meta";
          fileMeta.textContent = `${attachment.mimeType || "application/octet-stream"} 閻?${(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB`;

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
          filesBar.title = expanded ? "Collapse files" : "Expand files";
        };
        const toggleFilesExpanded = () => {
          msg.attachmentsExpanded = !msg.attachmentsExpanded;
          applyFilesState();
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
      if (screenshotExpanded) {
        wrapper.appendChild(screenshotExpanded);
      }
      if (papersExpanded) {
        wrapper.appendChild(papersExpanded);
      }
      if (filesExpanded) {
        wrapper.appendChild(filesExpanded);
      }

      if (hasSelectedTextContext) {
        let selectedTextExpandedIndex = getMessageSelectedTextExpandedIndex(
          msg,
          selectedTexts.length,
        );
        const syncSelectedTextExpandedState = () => {
          msg.selectedTextExpandedIndex = selectedTextExpandedIndex;
          msg.selectedTextExpanded = selectedTextExpandedIndex === 0;
        };
        syncSelectedTextExpandedState();
        const applySelectedTextStates: Array<() => void> = [];
        const renderSelectedTextStates = () => {
          for (const applyState of applySelectedTextStates) {
            applyState();
          }
        };

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
          const selectedBar = doc.createElement("button") as HTMLButtonElement;
          selectedBar.type = "button";
          selectedBar.className = "llm-user-selected-text";
          selectedBar.dataset.contextSource = selectedSource;

          const selectedIcon = doc.createElement("span") as HTMLSpanElement;
          selectedIcon.className = "llm-user-selected-text-icon";
          selectedIcon.textContent = getSelectedTextSourceIcon(selectedSource);

          const selectedContent = doc.createElement("span") as HTMLSpanElement;
          selectedContent.className = "llm-user-selected-text-content";
          selectedContent.textContent = selectedTextPaperLabel
            ? `${selectedTextPaperLabel} - ${selectedText}`
            : selectedText;

          const selectedExpanded = doc.createElement("div") as HTMLDivElement;
          selectedExpanded.className = "llm-user-selected-text-expanded";
          selectedExpanded.textContent = selectedTextPaperLabel
            ? `${selectedTextPaperLabel}\n\n${selectedText}`
            : selectedText;

          selectedBar.append(selectedIcon, selectedContent);
          const applySelectedTextState = () => {
            const expanded = selectedTextExpandedIndex === contextIndex;
            selectedBar.classList.toggle("expanded", expanded);
            selectedBar.setAttribute(
              "aria-expanded",
              expanded ? "true" : "false",
            );
            selectedExpanded.hidden = !expanded;
            selectedExpanded.style.display = expanded ? "block" : "none";
            selectedBar.title = expanded
              ? "Collapse selected text"
              : "Expand selected text";
          };
          const toggleSelectedTextExpanded = () => {
            mutateChatWithScrollGuard(() => {
              selectedTextExpandedIndex =
                selectedTextExpandedIndex === contextIndex ? -1 : contextIndex;
              syncSelectedTextExpandedState();
              renderSelectedTextStates();
            });
          };
          applySelectedTextStates.push(applySelectedTextState);
          selectedBar.addEventListener("mousedown", (e: Event) => {
            const mouse = e as MouseEvent;
            if (mouse.button !== 0) return;
            mouse.preventDefault();
            mouse.stopPropagation();
            toggleSelectedTextExpanded();
          });
          selectedBar.addEventListener("click", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
          });
          selectedBar.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            toggleSelectedTextExpanded();
          });
          wrapper.appendChild(selectedBar);
          wrapper.appendChild(selectedExpanded);
        });
        renderSelectedTextStates();
      }
      bubble.textContent = sanitizeText(msg.text || "");
      if (canEditLatestUserPrompt) {
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
          setPromptMenuTarget({
            item,
            conversationKey,
            userTimestamp: latestEditableUserTimestamp as number,
            assistantTimestamp: latestEditableAssistantTimestamp as number,
          });
          positionMenuAtPointer(body, promptMenu, me.clientX, me.clientY);
        });
      }
    } else {
      const hasModelName = Boolean(msg.modelName?.trim());
      const hasAnswerText = Boolean(msg.text);
      if (hasAnswerText) {
        const safeText = sanitizeText(msg.text);
        if (msg.streaming) bubble.classList.add("streaming");
        try {
          bubble.innerHTML = renderMarkdown(safeText);
        } catch (err) {
          ztoolkit.log("LLM render error:", err);
          bubble.textContent = safeText;
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

    // Copy button for every message with text
    if (msg.text?.trim()) {
      const copyBtn = doc.createElement("button") as HTMLButtonElement;
      copyBtn.type = "button";
      copyBtn.className = "llm-msg-copy-btn";
      copyBtn.title = panelI18n.copy;
      copyBtn.setAttribute("aria-label", panelI18n.copy);
      copyBtn.dataset.msgIndex = String(index);
      meta.appendChild(copyBtn);

      // Save as note button (book with plus)
      const noteBtn = doc.createElement("button") as HTMLButtonElement;
      noteBtn.type = "button";
      noteBtn.className = "llm-msg-note-btn";
      noteBtn.title = panelI18n.saveAsNote;
      noteBtn.setAttribute("aria-label", panelI18n.saveAsNote);
      noteBtn.dataset.msgIndex = String(index);
      meta.appendChild(noteBtn);
    }

    const time = doc.createElement("span") as HTMLSpanElement;
    time.className = "llm-message-time";
    time.textContent = formatTime(msg.timestamp);
    if (canEditLatestUserPrompt) {
      const editBtn = doc.createElement("button") as HTMLButtonElement;
      editBtn.type = "button";
      editBtn.className = "llm-edit-latest";
      editBtn.textContent = "";
      editBtn.title = panelI18n.edit;
      editBtn.setAttribute("aria-label", panelI18n.edit);
      editBtn.dataset.userTimestamp = String(
        latestEditableUserTimestamp as number,
      );
      editBtn.dataset.assistantTimestamp = String(
        latestEditableAssistantTimestamp as number,
      );
      meta.appendChild(editBtn);
    }
    meta.appendChild(time);
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
      retryBtn.title = panelI18n.retry;
      retryBtn.setAttribute("aria-label", panelI18n.retry);
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
