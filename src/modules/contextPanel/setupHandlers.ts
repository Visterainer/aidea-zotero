import { createElement } from "../../utils/domHelpers";
import {
  AUTO_SCROLL_BOTTOM_THRESHOLD,
  MAX_SELECTED_IMAGES,
  MAX_SELECTED_PAPER_CONTEXTS,
  formatFigureCountLabel,
  formatFileCountLabel,
  FONT_SCALE_MIN_PERCENT,
  FONT_SCALE_MAX_PERCENT,
  FONT_SCALE_STEP_PERCENT,
  FONT_SCALE_DEFAULT_PERCENT,
  SELECT_TEXT_EXPANDED_LABEL,
  SELECT_TEXT_COMPACT_LABEL,
  SCREENSHOT_EXPANDED_LABEL,
  SCREENSHOT_COMPACT_LABEL,
  UPLOAD_FILE_EXPANDED_LABEL,
  UPLOAD_FILE_COMPACT_LABEL,
  ACTION_LAYOUT_CONTEXT_ICON_WIDTH_PX,
  ACTION_LAYOUT_DROPDOWN_ICON_WIDTH_PX,
  ACTION_LAYOUT_MODEL_WRAP_MIN_CHARS,
  ACTION_LAYOUT_MODEL_FULL_MAX_LINES,
  MODEL_PROFILE_ORDER,
  GLOBAL_HISTORY_LIMIT,
  PAPER_CONVERSATION_KEY_BASE,
  PAPER_HISTORY_LIMIT,
  type ModelProfileKey,
} from "./constants";
import {
  selectedModelCache,
  selectedModelProviderCache,
  selectedImageCache,
  selectedFileAttachmentCache,
  selectedImagePreviewExpandedCache,
  selectedImagePreviewActiveIndexCache,
  selectedFilePreviewExpandedCache,
  selectedPaperContextCache,
  selectedPaperPreviewExpandedCache,
  cancelPanelRequest,
  isPanelGenerating,
  panelFontScalePercent,
  setPanelFontScalePercent,
  responseMenuTarget,
  setResponseMenuTarget,
  promptMenuTarget,
  setPromptMenuTarget,
  chatHistory,
  loadedConversationKeys,
  activeGlobalConversationByLibrary,
  activeConversationModeByLibrary,
  conversationContextPool,
  draftInputCache,
  activePaperConversationByItem,
} from "./state";
import {
  sanitizeText,
  setStatus,
  clampNumber,
  buildQuestionWithSelectedTextContexts,
  buildModelPromptWithFileContext,
  resolvePromptText,
  getSelectedTextWithinBubble,
  getAttachmentTypeLabel,
  normalizeSelectedTextSource,
} from "./textUtils";
import { normalizeSelectedTextPaperContexts } from "./normalizers";
import {
  positionMenuBelowButton,
  positionMenuAtPointer,
} from "./menuPositioning";
import {
  getApiProfiles,
  getSelectedProfileForItem,
  applyPanelFontScale,
  getAdvancedModelParamsForProfile,
  getLastUsedModelProfileKey,
  setLastUsedModelProfileKey,
  getStringPref,
  persistFileAttachmentState,
  getPanelContentHeight,
  setPanelContentHeight,
  getPanelBottomHeight,
  setPanelBottomHeight,
} from "./prefHelpers";
import {
  sendQuestion,
  refreshChat,
  syncUserContextAlignmentWidths,
  getConversationKey,
  ensureConversationLoaded,
  persistChatScrollSnapshot,
  isScrollUpdateSuspended,
  withScrollGuard,
  copyTextToClipboard,
  copyRenderedMarkdownToClipboard,
  retryLatestAssistantResponse,
  editLatestUserMessageAndRetry,
  findLatestRetryPair,
  type EditLatestTurnMarker,
} from "./chat";
import {
  getActiveReaderSelectionText,
  getActiveContextAttachmentFromTabs,
  addSelectedTextContext,
  applySelectedTextPreview,
  getSelectedTextContextEntries,
  getSelectedTextContexts,
  getSelectedTextExpandedIndex,
  includeSelectedTextFromReader,
  resolveContextSourceItem,
  setSelectedTextContextEntries,
  setSelectedTextContexts,
  setSelectedTextExpandedIndex,
} from "./contextResolution";
import { resolvePaperContextRefFromAttachment } from "./paperAttribution";
import { captureScreenshotSelection, optimizeImageDataUrl } from "./screenshot";
import {
  createNoteFromAssistantText,
  createNoteFromChatHistory,
  createStandaloneNoteFromChatHistory,
  buildChatHistoryNotePayload,
} from "./notes";
import {
  persistAttachmentBlob,
  isManagedBlobPath,
  removeAttachmentFile,
  removeConversationAttachmentFiles,
} from "./attachmentStorage";
import {
  clearConversation as clearStoredConversation,
  createGlobalConversation,
  createPaperConversation,
  deleteAllGlobalConversationsByLibrary,
  deleteGlobalConversation,
  deletePaperConversation,
  getGlobalConversationUserTurnCount,
  getLatestEmptyGlobalConversation,
  getLatestPaperConversation,
  getPaperConversationUserTurnCount,
  listGlobalConversations,
  listPaperConversations,
  touchGlobalConversationTitle,
  touchPaperConversationTitle,
  renameGlobalConversation,
  renamePaperConversation,
  pinGlobalConversation,
  pinPaperConversation,
} from "../../utils/chatStore";
import {
  ATTACHMENT_GC_MIN_AGE_MS,
  clearOwnerAttachmentRefs,
  collectAndDeleteUnreferencedBlobs,
} from "../../utils/attachmentRefStore";
import type { AdvancedModelParams, ChatAttachment, PaperContextRef, SelectedTextContext } from "./types";
import {
  searchPaperCandidates,
  type PaperSearchAttachmentCandidate,
  type PaperSearchGroupCandidate,
} from "./paperSearch";
import {
  createGlobalPortalItem,
  isGlobalPortalItem,
  resolveActiveLibraryID,
} from "./portalScope";
import { getPanelDomRefs } from "./setupHandlers/domRefs";
import { getPanelI18n } from "./i18n";
import {
  MODEL_MENU_OPEN_CLASS,
  RETRY_MODEL_MENU_OPEN_CLASS,
  SLASH_MENU_OPEN_CLASS,
  isFloatingMenuOpen,
  positionFloatingMenu,
  setFloatingMenuOpen,
} from "./setupHandlers/controllers/menuController";
import {
  getScreenshotDisabledHint,
  isScreenshotUnsupportedModel,
} from "./setupHandlers/controllers/modelReasoningController";
import {
  GLOBAL_HISTORY_UNDO_WINDOW_MS,
  type ConversationHistoryEntry,
  type HistorySwitchTarget,
  type PendingHistoryDeletion,
  formatGlobalHistoryTimestamp,
  formatHistoryRowDisplayTitle,
  normalizeConversationTitleSeed,
  normalizeHistoryTitle,
} from "./setupHandlers/controllers/conversationHistoryController";
import {
  formatPaperContextChipLabel,
  formatPaperContextChipTitle,
  normalizePaperContextEntries,
  resolvePaperContextDisplayMetadata,
} from "./setupHandlers/controllers/composeContextController";
import {
  createFileIntakeController,
  extractFilesFromClipboard,
  isFileDragEvent,
  isZoteroItemDragEvent,
  resolveZoteroItemFiles,
} from "./setupHandlers/controllers/fileIntakeController";
import { createSendFlowController } from "./setupHandlers/controllers/sendFlowController";
import {
  getModelChoices,
  getSelectedModelInfo as getSelectedModelInfoFromController,
  persistModelName,
  persistModelProvider,
  getPersistedModelName,
  pickBestDefaultModel,
} from "./setupHandlers/controllers/modelSelectionController";
import { bootstrapSettingTab } from "../preferenceScript";
import { createHeightSync } from "./heightSync";

export function setupHandlers(
  body: Element,
  initialItem?: Zotero.Item | null,
) {
  const i18n = getPanelI18n();
  let item = initialItem || null;
  const tabType = (body as HTMLElement).dataset?.tabType || "";
  const initialPaperItem =
    item && !isGlobalPortalItem(item) ? (item as Zotero.Item) : null;
  const resolveLibraryIdFromItem = (
    targetItem: Zotero.Item | null | undefined,
  ): number => {
    const parsed = Number(targetItem?.libraryID);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return resolveActiveLibraryID() || 0;
  };
  // In reader tab, always use paper mode (item is already the PDF attachment).
  // In library tab, item is already a GlobalPortalItem from index.ts.
  // Only apply the legacy modeLock fallback for edge cases not covered above.
  if (initialPaperItem && tabType !== "reader") {
    const libraryID = resolveLibraryIdFromItem(initialPaperItem);
    const modeLock = activeConversationModeByLibrary.get(libraryID);
    const rememberedGlobalKey = Number(
      activeGlobalConversationByLibrary.get(libraryID) || 0,
    );
    if (
      modeLock === "global" &&
      Number.isFinite(rememberedGlobalKey) &&
      rememberedGlobalKey > 0
    ) {
      item = createGlobalPortalItem(libraryID, Math.floor(rememberedGlobalKey));
    }
  }
  const basePaperItem = initialPaperItem;

  const {
    inputBox,
    inputSection,
    sendBtn,
    cancelBtn,
    modelBtn,
    modelSlot,
    modelMenu,
    actionsRow,
    actionsLeft,
    actionsRight,
    exportBtn,
    clearBtn,
    titleStatic,
    historyBar,
    historyNewBtn,
    historyToggleBtn,
    historyModeIndicator,
    historyMenu,
    historyUndo,
    historyUndoText,
    historyUndoBtn,
    selectTextBtn,
    screenshotBtn,
    uploadBtn,
    newChatBtn,
    uploadInput,
    slashMenu,
    slashUploadOption,
    slashReferenceOption,
    imagePreview,
    selectedContextList,
    previewStrip,
    previewExpanded,
    previewSelected,
    previewSelectedImg,
    previewMeta,
    removeImgBtn,
    filePreview,
    filePreviewMeta,
    filePreviewExpanded,
    filePreviewList,
    filePreviewClear,
    paperPreview,
    paperPreviewList,
    paperPicker,
    paperPickerList,
    responseMenu,
    responseMenuCopyBtn,
    responseMenuNoteBtn,
    promptMenu,
    promptMenuEditBtn,
    exportMenu,
    exportMenuCopyBtn,
    exportMenuNoteBtn,
    retryModelMenu,
    status,
    chatBox,
    scrollBottomBtn,
    settingScroll,
    settingConsole,
    contentWrapper,
    bottomWrapper,
    panelRoot,
  } = getPanelDomRefs(body);

  if (!inputBox || !sendBtn) {
    ztoolkit.log("LLM: Could not find input or send button");
    return;
  }

  if (!panelRoot) {
    ztoolkit.log("LLM: Could not find panel root");
    return;
  }
  const panelDoc = body.ownerDocument;
  if (!panelDoc) {
    ztoolkit.log("LLM: Could not find panel document");
    return;
  }
  const panelWin = panelDoc?.defaultView || null;

  const ElementCtor = panelDoc.defaultView?.Element;
  const isElementNode = (value: unknown): value is Element =>
    Boolean(ElementCtor && value instanceof ElementCtor);
  panelRoot.tabIndex = 0;
  applyPanelFontScale(panelRoot);

  if (settingScroll && !settingScroll.dataset.rendered) {
    settingScroll.dataset.rendered = "true";
    settingScroll.textContent = "";
    // Console is now inline in the scroll area; consoleContainer param is unused
    bootstrapSettingTab(panelDoc, settingScroll, settingScroll).catch((e) => {
      ztoolkit.log("LLM: Failed to bootstrap setting tab", e);
    });
  }

  // ── Translate tab controller ──
  try {
    const { initTranslateTab } = require("../pdfTranslator/translateTabController");
    initTranslateTab(body);
  } catch (e) {
    ztoolkit.log("LLM: Failed to init translate tab", e);
  }

  // ── Height sync controller ──
  // Applies initial heights from prefs, tracks resize, and syncs
  // between Discussion (two-pane) and Setting (single-pane) layouts.
  const existingHeightSync = (
    panelRoot as typeof panelRoot & {
      __llmHeightSync?: { dispose?: () => void } | null;
    }
  ).__llmHeightSync;
  if (existingHeightSync?.dispose) {
    existingHeightSync.dispose();
  }
  (
    panelRoot as typeof panelRoot & {
      __llmHeightSync?: { dispose?: () => void } | null;
    }
  ).__llmHeightSync = null;

  const initialContentHeight = getPanelContentHeight();
  if (initialContentHeight && contentWrapper) {
    if (initialContentHeight.includes("px") || initialContentHeight.includes("vh") || initialContentHeight.includes("%")) {
      contentWrapper.style.height = initialContentHeight;
      contentWrapper.style.flex = "none";
    }
  }

  const initialBottomHeight = getPanelBottomHeight();
  if (initialBottomHeight && bottomWrapper) {
    if (initialBottomHeight.includes("px") || initialBottomHeight.includes("vh") || initialBottomHeight.includes("%")) {
      bottomWrapper.style.height = initialBottomHeight;
      bottomWrapper.style.flex = "none";
    }
  }

  if (contentWrapper && bottomWrapper) {
    const heightSync = createHeightSync({
      contentWrapper,
      bottomWrapper,
      gap: 3,
      onH1Change: setPanelContentHeight,
      onH2Change: setPanelBottomHeight,
    });

    // Wire tab buttons to height sync
    const settingTabBtn = panelRoot.querySelector("#llm-tab-btn-setting");
    const discussionTabBtn = panelRoot.querySelector("#llm-tab-btn-discussion");
    const translateTabBtn = panelRoot.querySelector("#llm-tab-btn-translate");
    settingTabBtn?.addEventListener("click", () => heightSync.switchToSetting());
    discussionTabBtn?.addEventListener("click", () => heightSync.switchToDiscussion());
    // Translate tab uses setting layout (single pane, no bottom wrapper)
    translateTabBtn?.addEventListener("click", () => heightSync.switchToSetting());
    (
      panelRoot as typeof panelRoot & {
        __llmHeightSync?: { dispose?: () => void } | null;
      }
    ).__llmHeightSync = heightSync;
  }

  const isGlobalMode = () => Boolean(item && isGlobalPortalItem(item));
  const getCurrentLibraryID = (): number => {
    const fromItem =
      item && Number.isFinite(item.libraryID) && item.libraryID > 0
        ? Math.floor(item.libraryID)
        : 0;
    if (fromItem > 0) return fromItem;
    return resolveActiveLibraryID() || 0;
  };

  // Mutable callback wired to compose-state persistence once it's defined.
  const composeHook: { save: (() => void) | null } = { save: null };

  // Compute conversation key early so all closures can reference it.
  let conversationKey = item ? getConversationKey(item) : null;
  const getTextContextConversationKey = (): number | null =>
    Number.isFinite(conversationKey) && (conversationKey as number) > 0
      ? (conversationKey as number)
      : null;
  const syncConversationIdentity = () => {
    conversationKey = item ? getConversationKey(item) : null;
    panelRoot.dataset.itemId =
      Number.isFinite(conversationKey) && (conversationKey as number) > 0
        ? `${conversationKey}`
        : "";
    const libraryID = getCurrentLibraryID();
    panelRoot.dataset.libraryId = libraryID > 0 ? `${libraryID}` : "";
    if (item && libraryID > 0) {
      const mode = isGlobalMode() ? "global" : "paper";
      activeConversationModeByLibrary.set(libraryID, mode);
      if (mode === "global") {
        activeGlobalConversationByLibrary.set(libraryID, item.id);
      }
    }
    if (historyModeIndicator) {
      historyModeIndicator.textContent = "";
      historyModeIndicator.style.display = "none";
    }
  };
  syncConversationIdentity();
  let activeEditSession: EditLatestTurnMarker | null = null;
  let attachmentGcTimer: number | null = null;
  const scheduleAttachmentGc = (delayMs = 5_000) => {
    const win = body.ownerDocument?.defaultView;
    const clearTimer = () => {
      if (attachmentGcTimer === null) return;
      if (win) {
        win.clearTimeout(attachmentGcTimer);
      } else {
        clearTimeout(attachmentGcTimer);
      }
      attachmentGcTimer = null;
    };
    clearTimer();
    const runGc = () => {
      attachmentGcTimer = null;
      void collectAndDeleteUnreferencedBlobs(ATTACHMENT_GC_MIN_AGE_MS).catch(
        (err) => {
          ztoolkit.log("LLM: Attachment GC failed", err);
        },
      );
    };
    if (win) {
      attachmentGcTimer = win.setTimeout(runGc, delayMs);
    } else {
      attachmentGcTimer =
        (setTimeout(runGc, delayMs) as unknown as number) || 0;
    }
  };

  const persistCurrentChatScrollSnapshot = () => {
    if (!item || !chatBox || !chatBox.childElementCount) return;
    if (!isChatViewportVisible(chatBox)) return;
    persistChatScrollSnapshot(item, chatBox);
  };

  const isChatViewportVisible = (box: HTMLDivElement): boolean => {
    return box.clientHeight > 0 && box.getClientRects().length > 0;
  };

  type ChatBoxViewportState = {
    width: number;
    height: number;
    maxScrollTop: number;
    scrollTop: number;
    nearBottom: boolean;
  };
  const buildChatBoxViewportState = (): ChatBoxViewportState | null => {
    if (!chatBox) return null;
    if (!isChatViewportVisible(chatBox)) return null;
    const width = Math.max(0, Math.round(chatBox.clientWidth));
    const height = Math.max(0, Math.round(chatBox.clientHeight));
    const maxScrollTop = Math.max(
      0,
      chatBox.scrollHeight - chatBox.clientHeight,
    );
    const scrollTop = Math.max(0, Math.min(maxScrollTop, chatBox.scrollTop));
    const nearBottom = maxScrollTop - scrollTop <= AUTO_SCROLL_BOTTOM_THRESHOLD;
    return {
      width,
      height,
      maxScrollTop,
      scrollTop,
      nearBottom,
    };
  };
  let chatBoxViewportState = buildChatBoxViewportState();
  const captureChatBoxViewportState = () => {
    chatBoxViewportState = buildChatBoxViewportState();
  };

  if (item && chatBox) {
    const persistScroll = () => {
      if (!item) return;
      if (!chatBox.childElementCount) return;
      if (!isChatViewportVisible(chatBox)) return;
      const currentWidth = Math.max(0, Math.round(chatBox.clientWidth));
      const currentHeight = Math.max(0, Math.round(chatBox.clientHeight));
      const previousViewport = chatBoxViewportState;
      let viewportResized = false;
      if (previousViewport) {
        viewportResized =
          currentWidth !== previousViewport.width ||
          currentHeight !== previousViewport.height;
      }
      // Ignore resize-induced scroll events so the last pre-resize viewport
      // state remains available for relative-position restoration.
      if (viewportResized) return;

      if (scrollBottomBtn) {
        const isBottom = chatBox.scrollHeight - chatBox.clientHeight - chatBox.scrollTop <= AUTO_SCROLL_BOTTOM_THRESHOLD;
        if (isBottom) {
          scrollBottomBtn.classList.remove("visible");
        } else {
          scrollBottomBtn.classList.add("visible");
        }
      }

      // Skip persistence when scroll was caused by our own programmatic
      // scrollTop writes or by layout mutations (e.g. button relayout
      // changing the flex-sized chat area).
      if (isScrollUpdateSuspended()) {
        captureChatBoxViewportState();
        return;
      }
      persistChatScrollSnapshot(item, chatBox);
      captureChatBoxViewportState();
    };
    chatBox.addEventListener("scroll", persistScroll, { passive: true });

    if (scrollBottomBtn) {
      scrollBottomBtn.addEventListener("click", (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
      });
    }
  }

  // Capture scroll before click/focus interactions that may trigger a panel
  // re-render, so restore uses the most recent user position.
  body.addEventListener("pointerdown", persistCurrentChatScrollSnapshot, true);
  // NOTE: We intentionally do NOT persist on "focusin" because focusin fires
  // AFTER focus() has already caused a potential scroll adjustment in Gecko.
  // Persisting at that point overwrites the correct pre-interaction snapshot
  // (captured by pointerdown) with a corrupted position. The scroll event
  // handler on chatBox already keeps the snapshot up to date for programmatic
  // scroll changes.

  let retryMenuAnchor: HTMLButtonElement | null = null;
  const closeResponseMenu = () => {
    if (responseMenu) responseMenu.style.display = "none";
    setResponseMenuTarget(null);
  };
  const closePromptMenu = () => {
    if (promptMenu) promptMenu.style.display = "none";
    setPromptMenuTarget(null);
  };
  const closeExportMenu = () => {
    if (exportMenu) exportMenu.style.display = "none";
  };
  const closeHistoryMenu = () => {
    if (historyMenu) historyMenu.style.display = "none";
    if (historyToggleBtn) {
      historyToggleBtn.setAttribute("aria-expanded", "false");
    }
  };
  const closeSlashMenu = () => {
    setFloatingMenuOpen(slashMenu, SLASH_MENU_OPEN_CLASS, false);
    if (uploadBtn) {
      uploadBtn.setAttribute("aria-expanded", "false");
    }
  };
  const isHistoryMenuOpen = () =>
    Boolean(historyMenu && historyMenu.style.display !== "none");
  const closeRetryModelMenu = () => {
    setFloatingMenuOpen(retryModelMenu, RETRY_MODEL_MENU_OPEN_CLASS, false);
    retryMenuAnchor = null;
  };

  // Show floating "Quote" action when selecting assistant response text.
  // Keep one quote instance per panel and proactively clean stale DOM buttons.
  const popupHost = panelRoot as HTMLDivElement & {
    __llmSelectionPopupCleanup?: () => void;
  };
  panelRoot
    .querySelectorAll(".llm-assistant-selection-action")
    .forEach((node: Element) => node.remove());
  if (popupHost.__llmSelectionPopupCleanup) {
    popupHost.__llmSelectionPopupCleanup();
    delete popupHost.__llmSelectionPopupCleanup;
  }
  const selectionPopup = createElement(
    panelDoc,
    "button",
    "llm-shortcut-btn llm-assistant-selection-action",
    {
      type: "button",
      textContent: "❞ Quote",
      title: "Quote selected text",
    },
  ) as HTMLButtonElement;
  panelRoot.appendChild(selectionPopup);
  let selectionPopupText = "";
  let selectionDragStartBubble: HTMLElement | null = null;

  const showSelectionPopup = () => {
    if (!selectionPopup.classList.contains("is-visible")) {
      selectionPopup.classList.add("is-visible");
    }
  };
  const hideSelectionPopup = () => {
    selectionPopup.classList.remove("is-visible");
    selectionPopupText = "";
  };

  const findAssistantBubbleFromSelection = (): HTMLElement | null => {
    if (!chatBox || !panelWin) return null;
    const selection = panelWin.getSelection?.();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      return null;
    }
    const anchorEl = isElementNode(selection.anchorNode)
      ? selection.anchorNode
      : selection.anchorNode?.parentElement || null;
    const focusEl = isElementNode(selection.focusNode)
      ? selection.focusNode
      : selection.focusNode?.parentElement || null;
    if (!anchorEl || !focusEl) return null;
    const bubbleA = anchorEl.closest(".llm-bubble.assistant");
    const bubbleB = focusEl.closest(".llm-bubble.assistant");
    if (!bubbleA || !bubbleB || bubbleA !== bubbleB) return null;
    if (!chatBox.contains(bubbleA)) return null;
    return bubbleA as HTMLElement;
  };

  const updateSelectionPopup = (bubble?: HTMLElement | null) => {
    if (
      !panelWin ||
      !chatBox ||
      !panelRoot.isConnected ||
      panelRoot.getClientRects().length === 0
    ) {
      hideSelectionPopup();
      return;
    }
    const targetBubble = bubble || findAssistantBubbleFromSelection();
    if (!targetBubble) {
      hideSelectionPopup();
      return;
    }
    const selected = sanitizeText(
      getSelectedTextWithinBubble(panelDoc, targetBubble),
    ).trim();
    if (!selected) {
      hideSelectionPopup();
      return;
    }
    selectionPopupText = selected;
    const selection = panelWin.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      hideSelectionPopup();
      return;
    }
    const range = selection.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    const rects = range.getClientRects();
    const anchorRect =
      rects && rects.length > 0
        ? rects[rects.length - 1] || rects[0] || rect
        : rect;
    // Prefer the selection focus endpoint (where mouse-up happened),
    // so the popup appears near the "last selected" text.
    let focusRect: DOMRect | null = null;
    try {
      const focusNode = selection.focusNode;
      if (focusNode) {
        const focusRange = panelDoc.createRange();
        focusRange.setStart(focusNode, selection.focusOffset);
        focusRange.setEnd(focusNode, selection.focusOffset);
        let fr = focusRange.getBoundingClientRect();
        const frs = focusRange.getClientRects();
        if ((!fr.width || !fr.height) && frs && frs.length > 0) {
          const first = frs[0];
          if (first) fr = first;
        }
        if (fr.width || fr.height) {
          focusRect = fr;
        }
      }
    } catch (_err) {
      void _err;
    }
    const positionRect = focusRect || anchorRect || rect;
    if ((!rect.width || !rect.height) && anchorRect) {
      rect = anchorRect;
    }
    if (!rect.width && !rect.height) {
      hideSelectionPopup();
      return;
    }
    const panelRect = panelRoot.getBoundingClientRect();
    const chatRect = chatBox.getBoundingClientRect();
    const popupRect = selectionPopup.getBoundingClientRect();
    const margin = 8;
    const hostLeft = chatRect.left - panelRect.left;
    const hostTop = chatRect.top - panelRect.top;
    const hostRight = hostLeft + chatRect.width;
    const hostBottom = hostTop + chatRect.height;
    // Anchor to focus endpoint (last selected text) for natural placement.
    const focusX = positionRect.right - panelRect.left;
    const focusTop = positionRect.top - panelRect.top;
    const focusBottom = positionRect.bottom - panelRect.top;
    let left = focusX + 8;
    let top = focusTop - popupRect.height - 10;
    if (top < hostTop + margin) top = rect.bottom - panelRect.top + 10;
    if (top < hostTop + margin) top = focusBottom + 10;
    if (left > hostRight - popupRect.width - margin) {
      left = focusX - popupRect.width - 8;
    }
    left = clampNumber(
      left,
      hostLeft + margin,
      hostRight - popupRect.width - margin,
    );
    top = clampNumber(
      top,
      hostTop + margin,
      hostBottom - popupRect.height - margin,
    );
    selectionPopup.style.left = `${Math.round(left)}px`;
    selectionPopup.style.top = `${Math.round(top)}px`;
    showSelectionPopup();
  };

  const quoteSelectedAssistantText = () => {
    if (!item) {
      hideSelectionPopup();
      return;
    }
    let selected = sanitizeText(selectionPopupText).trim();
    if (!selected) {
      const targetBubble = findAssistantBubbleFromSelection();
      if (targetBubble) {
        selected = sanitizeText(
          getSelectedTextWithinBubble(panelDoc, targetBubble),
        ).trim();
      }
    }
    if (!selected) {
      hideSelectionPopup();
      if (status) setStatus(status, "No assistant text selected", "error");
      return;
    }
    let added = false;
    const activeItemId = getTextContextConversationKey();
    if (!activeItemId) {
      hideSelectionPopup();
      return;
    }
    runWithChatScrollGuard(() => {
      added = addSelectedTextContext(body, activeItemId, selected, {
        successStatusText: "Selected response text included",
        focusInput: false,
        source: "model",
      });
    });
    hideSelectionPopup();
    if (added) {
      updateSelectedTextPreviewPreservingScroll();
      inputBox.focus({ preventScroll: true });
    }
  };

  const onPanelMouseUp = (e: Event) => {
    if (!panelWin) return;
    if (!panelRoot.isConnected) {
      disposeSelectionPopup();
      return;
    }
    const me = e as MouseEvent;
    if (typeof me.button === "number" && me.button !== 0) {
      selectionDragStartBubble = null;
      hideSelectionPopup();
      return;
    }
    const target = e.target as Element | null;
    const targetInsidePanel = Boolean(target && panelRoot.contains(target));
    if (!targetInsidePanel && !selectionDragStartBubble) {
      hideSelectionPopup();
      return;
    }
    const bubble = target?.closest(
      ".llm-bubble.assistant",
    ) as HTMLElement | null;
    const fallbackBubble = bubble || selectionDragStartBubble;
    selectionDragStartBubble = null;
    panelWin.setTimeout(() => updateSelectionPopup(fallbackBubble), 0);
  };
  const onDocKeyUp = () => {
    if (!panelRoot.isConnected) {
      disposeSelectionPopup();
      return;
    }
    panelWin?.setTimeout(() => updateSelectionPopup(), 0);
  };
  const onPanelPointerDown = (e: Event) => {
    const target = e.target as Node | null;
    if (target && selectionPopup.contains(target)) return;
    const targetEl = target as Element | null;
    selectionDragStartBubble =
      (targetEl?.closest(".llm-bubble.assistant") as HTMLElement | null) ||
      null;
    hideSelectionPopup();
  };
  const onChatScrollHide = () => hideSelectionPopup();
  const onChatContextMenu = () => hideSelectionPopup();

  selectionPopup.addEventListener("mousedown", (e: Event) => {
    const me = e as MouseEvent;
    if (me.button !== 0) return;
    me.preventDefault();
    me.stopPropagation();
    quoteSelectedAssistantText();
  });
  selectionPopup.addEventListener("contextmenu", (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    hideSelectionPopup();
  });

  panelDoc.addEventListener("mouseup", onPanelMouseUp, true);
  panelDoc.addEventListener("keyup", onDocKeyUp, true);
  panelRoot.addEventListener("pointerdown", onPanelPointerDown, true);
  chatBox?.addEventListener("scroll", onChatScrollHide, { passive: true });
  chatBox?.addEventListener("contextmenu", onChatContextMenu, true);
  panelWin?.addEventListener("resize", onChatScrollHide, { passive: true });

  const disposeSelectionPopup = () => {
    panelDoc.removeEventListener("mouseup", onPanelMouseUp, true);
    panelDoc.removeEventListener("keyup", onDocKeyUp, true);
    panelRoot.removeEventListener("pointerdown", onPanelPointerDown, true);
    chatBox?.removeEventListener("scroll", onChatScrollHide);
    chatBox?.removeEventListener("contextmenu", onChatContextMenu, true);
    panelWin?.removeEventListener("resize", onChatScrollHide);
    selectionPopup.remove();
    if (popupHost.__llmSelectionPopupCleanup === disposeSelectionPopup) {
      delete popupHost.__llmSelectionPopupCleanup;
    }
  };
  popupHost.__llmSelectionPopupCleanup = disposeSelectionPopup;

  if (responseMenu && responseMenuCopyBtn && responseMenuNoteBtn) {
    if (!responseMenu.dataset.listenerAttached) {
      responseMenu.dataset.listenerAttached = "true";
      // Stop propagation for both pointer and mouse events so that the
      // document-level dismiss handler cannot race with button clicks.
      responseMenu.addEventListener("pointerdown", (e: Event) => {
        e.stopPropagation();
      });
      responseMenu.addEventListener("mousedown", (e: Event) => {
        e.stopPropagation();
      });
      responseMenu.addEventListener("contextmenu", (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      });
      responseMenuCopyBtn.addEventListener("click", async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const target = responseMenuTarget;
        closeResponseMenu();
        if (!target) return;
        // Render through renderMarkdownForNote and copy both HTML
        // (for rich-text paste into Zotero notes) and plain text
        // (for plain-text editors).  Uses the selection if present,
        // otherwise the full response.
        await copyRenderedMarkdownToClipboard(body, target.contentText);
        if (status) setStatus(status, "Copied response", "ready");
      });
      responseMenuNoteBtn.addEventListener("click", async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        // Capture all needed values immediately before any async work,
        // so that even if responseMenuTarget is cleared we still have them.
        const target = responseMenuTarget;
        closeResponseMenu();
        if (!target) {
          ztoolkit.log("LLM: Note save – no responseMenuTarget");
          return;
        }
        const { item: targetItem, contentText, modelName } = target;
        if (!targetItem || !contentText) {
          ztoolkit.log("LLM: Note save – missing item or contentText");
          return;
        }
        try {
          if (isGlobalPortalItem(targetItem)) {
            const libraryID =
              Number.isFinite(targetItem.libraryID) && targetItem.libraryID > 0
                ? Math.floor(targetItem.libraryID)
                : getCurrentLibraryID();
            await createStandaloneNoteFromChatHistory(libraryID, [
              {
                role: "assistant",
                text: contentText,
                timestamp: Date.now(),
                modelName,
              },
            ]);
            if (status) {
              setStatus(status, "Created a new note", "ready");
            }
            return;
          }
          const saveResult = await createNoteFromAssistantText(
            targetItem,
            contentText,
            modelName,
          );
          if (status) {
            setStatus(
              status,
              saveResult === "appended"
                ? "Appended to existing note"
                : "Created a new note",
              "ready",
            );
          }
        } catch (err) {
          ztoolkit.log("Create note failed:", err);
          if (status) setStatus(status, "Failed to create note", "error");
        }
      });
    }
  }

  if (promptMenu && promptMenuEditBtn) {
    if (!promptMenu.dataset.listenerAttached) {
      promptMenu.dataset.listenerAttached = "true";
      promptMenu.addEventListener("pointerdown", (e: Event) => {
        e.stopPropagation();
      });
      promptMenu.addEventListener("mousedown", (e: Event) => {
        e.stopPropagation();
      });
      promptMenu.addEventListener("contextmenu", (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      });
      promptMenuEditBtn.addEventListener("click", async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const target = promptMenuTarget;
        closePromptMenu();
        if (!item || !target) return;
        if (
          target.item.id !== item.id ||
          target.conversationKey !== getConversationKey(item)
        ) {
          activeEditSession = null;
          if (status) setStatus(status, EDIT_STALE_STATUS_TEXT, "error");
          return;
        }
        const latest = await getLatestEditablePair();
        if (!latest) {
          activeEditSession = null;
          if (status) setStatus(status, i18n.noEditableLatestPrompt, "error");
          return;
        }
        const { conversationKey: latestKey, pair } = latest;
        if (
          pair.assistantMessage.streaming ||
          pair.userMessage.timestamp !== target.userTimestamp ||
          pair.assistantMessage.timestamp !== target.assistantTimestamp
        ) {
          activeEditSession = null;
          if (status) setStatus(status, EDIT_STALE_STATUS_TEXT, "error");
          return;
        }

        inputBox.value = sanitizeText(pair.userMessage.text || "");

        const restoredSelectedTexts = Array.isArray(
          pair.userMessage.selectedTexts,
        )
          ? pair.userMessage.selectedTexts
              .map((value) =>
                typeof value === "string" ? sanitizeText(value).trim() : "",
              )
              .filter(Boolean)
          : typeof pair.userMessage.selectedText === "string" &&
              sanitizeText(pair.userMessage.selectedText).trim()
            ? [sanitizeText(pair.userMessage.selectedText).trim()]
            : [];
        const selectedTextPaperContexts = normalizeSelectedTextPaperContexts(
          pair.userMessage.selectedTextPaperContexts,
          restoredSelectedTexts.length,
          { sanitizeText },
        );
        const restoredSelectedEntries = restoredSelectedTexts.map(
          (text, index) => ({
            text,
            source: normalizeSelectedTextSource(
              pair.userMessage.selectedTextSources?.[index],
            ),
            paperContext: selectedTextPaperContexts[index],
          }),
        );
        const textContextKey = getTextContextConversationKey();
        if (!textContextKey) return;
        if (restoredSelectedEntries.length) {
          setSelectedTextContextEntries(textContextKey, restoredSelectedEntries);
        } else {
          clearSelectedTextState(textContextKey);
        }
        setSelectedTextExpandedIndex(textContextKey, null);

        // Do NOT restore paper contexts from history — they may reference
        // stale Zotero items.  Let the system auto-detect the currently
        // focused PDF via resolveContextSourceItem() instead.
        clearSelectedPaperState(item.id);

        const restoredFiles = (
          Array.isArray(pair.userMessage.attachments)
            ? pair.userMessage.attachments.filter(
                (attachment) =>
                  Boolean(attachment) &&
                  typeof attachment === "object" &&
                  attachment.category !== "image" &&
                  typeof attachment.id === "string" &&
                  attachment.id.trim() &&
                  typeof attachment.name === "string" &&
                  attachment.name.trim(),
              )
            : []
        ).map((attachment) => ({
          ...attachment,
          id: attachment.id.trim(),
          name: attachment.name.trim(),
          mimeType:
            typeof attachment.mimeType === "string" &&
            attachment.mimeType.trim()
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
            typeof attachment.storedPath === "string" &&
            attachment.storedPath.trim()
              ? attachment.storedPath.trim()
              : undefined,
          contentHash:
            typeof attachment.contentHash === "string" &&
            /^[a-f0-9]{64}$/i.test(attachment.contentHash.trim())
              ? attachment.contentHash.trim().toLowerCase()
              : undefined,
        }));
        // Filter out ghost entries: no storedPath + no textContent = unusable
        const validFiles = restoredFiles.filter(
          (f) => f.storedPath || f.textContent,
        );
        if (validFiles.length) {
          selectedFileAttachmentCache.set(item.id, validFiles);
          selectedFilePreviewExpandedCache.set(item.id, false);
        } else {
          clearSelectedFileState(item.id);
        }

        const restoredImages = Array.isArray(pair.userMessage.screenshotImages)
          ? pair.userMessage.screenshotImages
              .filter((entry): entry is string => typeof entry === "string")
              .map((entry) => entry.trim())
              .filter(Boolean)
              .slice(0, MAX_SELECTED_IMAGES)
          : [];
        if (restoredImages.length) {
          selectedImageCache.set(item.id, restoredImages);
          selectedImagePreviewExpandedCache.set(item.id, false);
          selectedImagePreviewActiveIndexCache.set(item.id, 0);
        } else {
          clearSelectedImageState(item.id);
        }

        updatePaperPreviewPreservingScroll();
        updateFilePreviewPreservingScroll();
        updateImagePreviewPreservingScroll();
        updateSelectedTextPreviewPreservingScroll();
        activeEditSession = {
          conversationKey: latestKey,
          userTimestamp: pair.userMessage.timestamp,
          assistantTimestamp: pair.assistantMessage.timestamp,
        };
        inputBox.focus({ preventScroll: true });
        if (status) setStatus(status, "Editing latest prompt", "ready");
      });
    }
  }

  if (exportMenu && exportMenuCopyBtn && exportMenuNoteBtn) {
    if (!exportMenu.dataset.listenerAttached) {
      exportMenu.dataset.listenerAttached = "true";
      exportMenu.addEventListener("pointerdown", (e: Event) => {
        e.stopPropagation();
      });
      exportMenu.addEventListener("mousedown", (e: Event) => {
        e.stopPropagation();
      });
      exportMenu.addEventListener("contextmenu", (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      });
      exportMenuCopyBtn.addEventListener("click", async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (!item) return;
        await ensureConversationLoaded(item);
        const conversationKey = getConversationKey(item);
        const history = chatHistory.get(conversationKey) || [];
        const payload = buildChatHistoryNotePayload(history);
        if (!payload.noteText) {
          if (status) setStatus(status, "No chat history detected.", "ready");
          closeExportMenu();
          return;
        }
        // Match single-response "copy as md": copy markdown/plain text only.
        await copyTextToClipboard(body, payload.noteText);
        if (status) setStatus(status, "Copied chat as md", "ready");
        closeExportMenu();
      });
      exportMenuNoteBtn.addEventListener("click", async (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const currentItem = item;
        const currentLibraryID = getCurrentLibraryID();
        closeExportMenu();
        if (!currentItem) return;
        try {
          await ensureConversationLoaded(currentItem);
          const conversationKey = getConversationKey(currentItem);
          const history = chatHistory.get(conversationKey) || [];
          const payload = buildChatHistoryNotePayload(history);
          if (!payload.noteText) {
            if (status) setStatus(status, "No chat history detected.", "ready");
            return;
          }
          if (isGlobalMode()) {
            await createStandaloneNoteFromChatHistory(
              currentLibraryID,
              history,
            );
          } else {
            await createNoteFromChatHistory(currentItem, history);
          }
          if (status)
            setStatus(status, "Saved chat history to new note", "ready");
        } catch (err) {
          ztoolkit.log("Save chat history note failed:", err);
          const errMsg =
            err instanceof Error ? err.message : String(err);
          if (status)
            setStatus(
              status,
              `Failed to save chat history: ${errMsg}`,
              "error",
            );
        }
      });
    }
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (exportBtn.disabled || !exportMenu || !item) return;
      closeRetryModelMenu();
      closeSlashMenu();
      closeResponseMenu();
      closePromptMenu();
      closeHistoryMenu();
      if (exportMenu.style.display !== "none") {
        closeExportMenu();
        return;
      }
      positionMenuBelowButton(body, exportMenu, exportBtn);
    });
  }

  // Clicking non-interactive panel area gives keyboard focus to the panel.
  panelRoot.addEventListener("mousedown", (e: Event) => {
    const me = e as MouseEvent;
    if (me.button !== 0) return;
    const target = me.target as Element | null;
    if (!target) return;
    const isInteractive = Boolean(
      target.closest(
        "input, textarea, button, select, option, a[href], [contenteditable='true']",
      ),
    );
    if (!isInteractive) {
      panelRoot.focus({ preventScroll: true });
    }
  });

  const clearSelectedImageState = (itemId: number) => {
    selectedImageCache.delete(itemId);
    selectedImagePreviewExpandedCache.delete(itemId);
    selectedImagePreviewActiveIndexCache.delete(itemId);
  };

  const clearSelectedFileState = (itemId: number) => {
    selectedFileAttachmentCache.delete(itemId);
    selectedFilePreviewExpandedCache.delete(itemId);
  };

  // Track dismissed auto-loaded paper context to prevent re-adding
  const dismissedAutoLoadPaperCache = new Map<number, string>();

  const clearSelectedPaperState = (itemId: number) => {
    selectedPaperContextCache.delete(itemId);
    selectedPaperPreviewExpandedCache.delete(itemId);
  };

  const clearSelectedTextState = (itemId: number) => {
    setSelectedTextContexts(itemId, []);
    setSelectedTextExpandedIndex(itemId, null);
  };
  const clearTransientComposeStateForItem = (
    itemId: number,
    textContextKey: number = itemId,
  ) => {
    clearSelectedImageState(itemId);
    clearSelectedPaperState(itemId);
    clearSelectedFileState(itemId);
    clearSelectedTextState(textContextKey);
  };
  const runWithChatScrollGuard = (fn: () => void) => {
    withScrollGuard(chatBox, conversationKey, fn);
  };
  const EDIT_STALE_STATUS_TEXT =
    "Edit target changed. Please edit latest prompt again.";
  const getLatestEditablePair = async () => {
    if (!item) return null;
    await ensureConversationLoaded(item);
    const key = getConversationKey(item);
    const history = chatHistory.get(key) || [];
    const pair = findLatestRetryPair(history);
    if (!pair) return null;
    return { conversationKey: key, pair };
  };

  const resolveAutoLoadedPaperContext = (): PaperContextRef | null => {
    const tabType = (body as HTMLElement).dataset?.tabType;
    if (tabType === "library") return null;
    if (!item || isGlobalMode()) return null;
    // Only auto-inject for NEW conversations (empty history).
    // If the conversation already has messages, the context state was
    // persisted to DB and will be restored from there — don't re-inject.
    const key = getConversationKey(item);
    const history = chatHistory.get(key);
    if (history && history.length > 0) return null;
    const contextSource = resolveContextSourceItem(item);
    const ref = resolvePaperContextRefFromAttachment(contextSource.contextItem);
    if (!ref) return null;
    // If user dismissed this exact auto-loaded context, don't re-add it
    const dismissKey = `${ref.itemId}:${ref.contextItemId}`;
    if (dismissedAutoLoadPaperCache.get(item.id) === dismissKey) {
      return null;
    }
    return ref;
  };

  const appendPaperChip = (
    ownerDoc: Document,
    list: HTMLDivElement,
    paperContext: PaperContextRef,
    options?: { removable?: boolean; removableIndex?: number; autoLoaded?: boolean },
  ) => {
    const removable = options?.removable === true;
    const chip = createElement(
      ownerDoc,
      "div",
      "llm-selected-context llm-paper-context-chip",
    );
    if (options?.autoLoaded) {
      chip.classList.add("llm-paper-context-chip-autoloaded");
      chip.dataset.autoLoaded = "true";
    }
    if (removable) {
      chip.dataset.paperContextIndex = `${options?.removableIndex ?? -1}`;
    }
    chip.classList.add("collapsed");

    const chipHeader = createElement(
      ownerDoc,
      "div",
      "llm-image-preview-header llm-selected-context-header llm-paper-context-chip-header",
    );
    const chipLabel = createElement(
      ownerDoc,
      "span",
      "llm-paper-context-chip-label",
      {
        textContent: formatPaperContextChipLabel(paperContext),
        title: formatPaperContextChipTitle(paperContext),
      },
    );
    chipHeader.append(chipLabel);

    if (removable) {
      const removeBtn = createElement(
        ownerDoc,
        "button",
        "llm-remove-img-btn llm-paper-context-clear",
        {
          type: "button",
          textContent: "×",
          title: `Remove ${paperContext.title}`,
        },
      ) as HTMLButtonElement;
      removeBtn.dataset.paperContextIndex = `${options?.removableIndex ?? -1}`;
      removeBtn.setAttribute("aria-label", `Remove ${paperContext.title}`);
      chipHeader.append(removeBtn);
    }

    chip.append(chipHeader);
    list.appendChild(chip);
  };

  const updatePaperPreview = () => {
    if (!item || !paperPreview || !paperPreviewList) return;
    const selectedPapers = normalizePaperContextEntries(
      selectedPaperContextCache.get(item.id) || [],
    );
    const autoLoadedPaperContext = resolveAutoLoadedPaperContext();

    // Check if the auto-loaded paper is already in the manually selected list
    const autoLoadedAlreadySelected = autoLoadedPaperContext
      ? selectedPapers.some(
          (entry) =>
            entry.itemId === autoLoadedPaperContext.itemId &&
            entry.contextItemId === autoLoadedPaperContext.contextItemId,
        )
      : false;

    // Also check if the auto-loaded paper is the same as the base PDF in the
    // context pool — if so, skip it to avoid showing a duplicate chip.
    const poolKeyForDedup = conversationKey ?? (item ? getConversationKey(item) : null);
    const poolForDedup = poolKeyForDedup !== null ? conversationContextPool.get(poolKeyForDedup) : undefined;
    const autoLoadedMatchesBasePdf = autoLoadedPaperContext && poolForDedup
      && poolForDedup.basePdfItemId !== null
      && !poolForDedup.basePdfRemoved
      && (autoLoadedPaperContext.itemId === poolForDedup.basePdfItemId
        || autoLoadedPaperContext.contextItemId === poolForDedup.basePdfItemId);

    // Phase 4: Resolve base PDF from context pool for display.
    const poolKey = conversationKey ?? (item ? getConversationKey(item) : null);
    const pool = poolKey !== null ? conversationContextPool.get(poolKey) : undefined;
    const hasBasePdf = pool && pool.basePdfItemId !== null && !pool.basePdfRemoved;

    if (!selectedPapers.length && !autoLoadedPaperContext && !hasBasePdf) {
      paperPreview.style.display = "none";
      paperPreviewList.innerHTML = "";
      clearSelectedPaperState(item.id);
      return;
    }
    if (selectedPapers.length) {
      selectedPaperContextCache.set(item.id, selectedPapers);
    } else {
      clearSelectedPaperState(item.id);
    }
    selectedPaperPreviewExpandedCache.set(item.id, false);
    paperPreview.style.display = "contents";
    paperPreviewList.style.display = "contents";
    paperPreviewList.innerHTML = "";
    const ownerDoc = body.ownerDocument;
    if (!ownerDoc) return;

    // Phase 4: Show base PDF chip at the top if pool has one.
    if (hasBasePdf && pool) {
      const basePdfTitle = pool.basePdfTitle || "Active Document";
      const isCompressed = pool.basePdfContext.startsWith("[摘要]") || pool.basePdfContext.startsWith("[Summary]");
      const labelText = isCompressed ? `📝 ${basePdfTitle} [Summary]` : `📝 ${basePdfTitle}`;
      const chip = createElement(
        ownerDoc,
        "div",
        "llm-selected-context llm-paper-context-chip llm-base-pdf-chip",
      );
      chip.classList.add("collapsed");
      const chipHeader = createElement(
        ownerDoc,
        "div",
        "llm-image-preview-header llm-selected-context-header llm-paper-context-chip-header",
      );
      const chipLabel = createElement(
        ownerDoc,
        "span",
        "llm-paper-context-chip-label",
        {
          textContent: labelText,
          title: `Active document context: ${basePdfTitle}`,
        },
      );
      chipHeader.append(chipLabel);
      const removeBtn = createElement(
        ownerDoc,
        "button",
        "llm-remove-img-btn llm-paper-context-clear",
        {
          type: "button",
          textContent: "×",
          title: `Unpin ${basePdfTitle}`,
        },
      ) as HTMLButtonElement;
      removeBtn.setAttribute("aria-label", `Unpin ${basePdfTitle}`);
      removeBtn.addEventListener("click", (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (pool) {
          pool.basePdfRemoved = true;
          ztoolkit.log(`LLM UI: User unpinned base PDF (itemId=${pool.basePdfItemId})`);
          updatePaperPreview();
        }
      });
      chipHeader.append(removeBtn);
      chip.append(chipHeader);
      paperPreviewList.appendChild(chip);
    }

    // Only show auto-loaded chip if it's not already in the selected list
    // and not the same as the base PDF chip.
    // NOTE: Do NOT add it to selectedPaperContextCache — the base PDF is
    // handled separately through resolveContextSourceItem → pool.basePdfContext.
    // Adding it here would cause duplicate content injection.
    if (autoLoadedPaperContext && !autoLoadedAlreadySelected && !autoLoadedMatchesBasePdf) {
      // Show auto-loaded chip as display-only (dismissible via dismissedAutoLoadPaperCache)
      appendPaperChip(ownerDoc, paperPreviewList, autoLoadedPaperContext, {
        removable: true,
        removableIndex: -1,
        autoLoaded: true,
      });
      selectedPapers.forEach((paperContext, index) => {
        appendPaperChip(ownerDoc, paperPreviewList, paperContext, {
          removable: true,
          removableIndex: index,
        });
      });
    } else {
      selectedPapers.forEach((paperContext, index) => {
        appendPaperChip(ownerDoc, paperPreviewList, paperContext, {
          removable: true,
          removableIndex: index,
        });
      });
    }
    if (composeHook.save) composeHook.save();
  };

  // Track inline file chips so we can clean them up on re-render
  let inlineFileChips: HTMLElement[] = [];
  // Track which category groups are expanded (per item)
  const fileCategoryExpandedCache = new Map<number, Set<string>>();

  const clearInlineFileChips = () => {
    inlineFileChips.forEach((el) => el.remove());
    inlineFileChips = [];
  };

  const updateFilePreview = () => {
    if (
      !item ||
      !filePreview ||
      !filePreviewMeta ||
      !filePreviewExpanded ||
      !filePreviewList
    )
      return;

    // Always clear previous inline chips first
    clearInlineFileChips();

    const files = selectedFileAttachmentCache.get(item.id) || [];
    const filePreviewHeader = filePreview.querySelector("#llm-file-context-header") as HTMLElement | null;
    
    if (!files.length) {
      filePreview.style.display = "none";
      filePreview.classList.remove("expanded", "collapsed");
      filePreviewExpanded.style.display = "none";
      if (filePreviewHeader) filePreviewHeader.style.display = "";
      filePreviewMeta.textContent = formatFileCountLabel(0);
      filePreviewMeta.classList.remove("expanded");
      filePreviewMeta.setAttribute("aria-expanded", "false");
      filePreviewMeta.title = "Pin files panel";
      filePreviewList.innerHTML = "";
      clearSelectedFileState(item.id);
      fileCategoryExpandedCache.delete(item.id);
      return;
    }

    const ownerDoc = body.ownerDocument;
    if (!ownerDoc) return;

    // Helper: create an onRemove handler for a given file index
    const makeOnRemove = (index: number) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      const currentFiles = selectedFileAttachmentCache.get(item.id) || [];
      const removedEntry = currentFiles[index];
      const nextFiles = currentFiles.filter((_entry, i) => i !== index);
      if (nextFiles.length) {
        selectedFileAttachmentCache.set(item.id, nextFiles);
      } else {
        clearSelectedFileState(item.id);
      }
      // Persist current file state so removals survive Zotero restarts.
      // Skip in reader mode — reader file state is session-only.
      if (conversationKey !== null && tabType !== "reader") {
        persistFileAttachmentState(
          conversationKey,
          nextFiles.map((f) => f.id),
        );
      }
      if (
        removedEntry?.storedPath &&
        !removedEntry.contentHash &&
        !isManagedBlobPath(removedEntry.storedPath)
      ) {
        void removeAttachmentFile(removedEntry.storedPath).catch((err) => {
          ztoolkit.log(
            "LLM: Failed to remove discarded attachment file",
            err,
          );
        });
      } else if (removedEntry?.storedPath) {
        scheduleAttachmentGc();
      }
      updateFilePreview();
      if (status) {
        setStatus(
          status,
          `Attachment removed (${nextFiles.length})`,
          "ready",
        );
      }
    };

    // Helper: remove all files in a set of indices
    const makeOnRemoveGroup = (indices: number[]) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      const currentFiles = selectedFileAttachmentCache.get(item.id) || [];
      const removeSet = new Set(indices);
      const removed = indices.map((i) => currentFiles[i]).filter(Boolean);
      const nextFiles = currentFiles.filter((_, i) => !removeSet.has(i));
      if (nextFiles.length) {
        selectedFileAttachmentCache.set(item.id, nextFiles);
      } else {
        clearSelectedFileState(item.id);
      }
      // Persist current file state so group removals survive Zotero restarts.
      // Skip in reader mode — reader file state is session-only.
      if (conversationKey !== null && tabType !== "reader") {
        persistFileAttachmentState(
          conversationKey,
          nextFiles.map((f) => f.id),
        );
      }
      removed.forEach((entry) => {
        if (
          entry?.storedPath &&
          !entry.contentHash &&
          !isManagedBlobPath(entry.storedPath)
        ) {
          void removeAttachmentFile(entry.storedPath).catch((err) => {
            ztoolkit.log("LLM: Failed to remove discarded attachment file", err);
          });
        } else if (entry?.storedPath) {
          scheduleAttachmentGc();
        }
      });
      updateFilePreview();
      if (status) {
        setStatus(status, `Group removed (${nextFiles.length})`, "ready");
      }
    };

    // The parent contextPreviews container
    const contextPreviews = filePreview.parentElement;
    if (!contextPreviews) return;

    // ── Group files by category ──
    const groups = new Map<string, { attachment: any; index: number }[]>();
    files.forEach((attachment, index) => {
      const cat = attachment.category || "file";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push({ attachment, index });
    });

    // Get or create expanded set for this item
    let expandedSet = fileCategoryExpandedCache.get(item.id);
    if (!expandedSet) {
      expandedSet = new Set<string>();
      fileCategoryExpandedCache.set(item.id, expandedSet);
    }

    // Helper: get display label for a category
    const getCategoryLabel = (cat: string): string => {
      switch (cat) {
        case "pdf": return "PDF";
        case "markdown": return "Markdown";
        case "code": return "Code";
        case "text": return "Text";
        case "image": return "Image";
        default: return "Files";
      }
    };

    // Helper: create an individual file chip
    const createFileChip = (attachment: any, index: number) => {
      const chip = createElement(
        ownerDoc,
        "div",
        "llm-selected-context llm-paper-context-chip llm-file-chip-inline",
      );
      chip.classList.add("collapsed");
      chip.style.flexBasis = "100%";
      chip.style.width = "100%";
      chip.dataset.category = attachment.category || "file";
      if (attachment.processing) {
        chip.classList.add("llm-file-chip-processing");
      }

      const chipHeader = createElement(
        ownerDoc,
        "div",
        "llm-image-preview-header llm-selected-context-header llm-paper-context-chip-header",
      );

      const labelText = attachment.processing
        ? `${attachment.name || "Processing..."}…`
        : attachment.name;

      const chipLabel = createElement(
        ownerDoc,
        "span",
        "llm-paper-context-chip-label",
        {
          textContent: labelText,
          title: attachment.processing
            ? "Processing..."
            : `${attachment.name} · ${attachment.mimeType || "file"} · ${(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
        },
      );
      chipHeader.append(chipLabel);

      const removeBtn = createElement(
        ownerDoc,
        "button",
        "llm-remove-img-btn llm-paper-context-clear",
        {
          type: "button",
          textContent: "×",
          title: `Remove ${attachment.name}`,
        },
      ) as HTMLButtonElement;
      removeBtn.setAttribute("aria-label", `Remove ${attachment.name}`);
      removeBtn.addEventListener("click", makeOnRemove(index));
      chipHeader.append(removeBtn);

      chip.append(chipHeader);
      return chip;
    };

    // Helper: create a category summary chip
    const createCategorySummaryChip = (
      cat: string,
      catFiles: { attachment: any; index: number }[],
      isGroupExpanded: boolean,
    ) => {
      const procCount = catFiles.filter((cf) => cf.attachment.processing).length;
      const catLabel = getCategoryLabel(cat);
      const summaryText = procCount > 0
        ? `${catLabel} (${catFiles.length - procCount}/${catFiles.length})`
        : `${catLabel} (${catFiles.length})`;

      const chip = createElement(
        ownerDoc,
        "div",
        "llm-selected-context llm-paper-context-chip llm-file-chip-inline",
      );
      chip.classList.add("collapsed");
      chip.style.flexBasis = "100%";
      chip.style.width = "100%";
      chip.style.cursor = "pointer";
      chip.dataset.category = cat;
      if (procCount > 0) {
        chip.classList.add("llm-file-chip-processing");
      }

      const chipHeader = createElement(
        ownerDoc,
        "div",
        "llm-image-preview-header llm-selected-context-header llm-paper-context-chip-header",
      );

      const chipLabel = createElement(
        ownerDoc,
        "span",
        "llm-paper-context-chip-label",
        {
          textContent: summaryText,
          title: isGroupExpanded ? "Click to collapse" : "Click to expand",
        },
      );

      const indicator = createElement(ownerDoc, "span", "", {
        textContent: isGroupExpanded ? " ▴" : " ▾",
      });
      indicator.style.opacity = "0.5";
      indicator.style.fontSize = "10px";
      indicator.style.marginLeft = "4px";
      chipLabel.appendChild(indicator);

      chipHeader.append(chipLabel);

      // Clear-group button
      const clearBtn = createElement(
        ownerDoc,
        "button",
        "llm-remove-img-btn llm-paper-context-clear",
        {
          type: "button",
          textContent: "×",
          title: `Remove all ${catLabel} files`,
        },
      ) as HTMLButtonElement;
      clearBtn.setAttribute("aria-label", `Remove all ${catLabel} files`);
      clearBtn.addEventListener(
        "click",
        makeOnRemoveGroup(catFiles.map((cf) => cf.index)),
      );
      chipHeader.append(clearBtn);

      chip.append(chipHeader);

      // Toggle expand/collapse
      chip.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".llm-remove-img-btn")) return;
        if (!item) return;
        if (isGroupExpanded) expandedSet!.delete(cat);
        else expandedSet!.add(cat);
        updateFilePreview();
      });

      return chip;
    };

    // Hide the card container by default; only show if any group is expanded
    filePreview.style.display = "none";
    filePreview.classList.remove("expanded", "collapsed");
    filePreviewExpanded.style.display = "none";
    filePreviewList.innerHTML = "";

    // Track whether any group needs the card container
    let hasExpandedGroup = false;

    // ── Render each category group ──
    groups.forEach((catFiles, cat) => {
      if (catFiles.length <= 3) {
        // Individual chips for each file
        catFiles.forEach(({ attachment, index }) => {
          const chip = createFileChip(attachment, index);
          contextPreviews.insertBefore(chip, filePreview);
          inlineFileChips.push(chip);
        });
      } else {
        // Summary chip for this category
        const isGroupExpanded = expandedSet!.has(cat);
        const summaryChip = createCategorySummaryChip(cat, catFiles, isGroupExpanded);
        contextPreviews.insertBefore(summaryChip, filePreview);
        inlineFileChips.push(summaryChip);

        if (isGroupExpanded) {
          hasExpandedGroup = true;
        }
      }
    });

    // ── Show card container if any category group is expanded ──
    if (hasExpandedGroup) {
      filePreview.style.display = "flex";
      filePreview.classList.add("expanded");
      filePreview.classList.remove("collapsed");
      filePreviewExpanded.style.display = "grid";
      if (filePreviewHeader) {
        filePreviewHeader.style.display = "none";
      }

      // Render rows for all expanded groups
      groups.forEach((catFiles, cat) => {
        if (catFiles.length > 3 && expandedSet!.has(cat)) {
          catFiles.forEach(({ attachment, index }) => {
            const row = createElement(ownerDoc, "div", "llm-file-context-item");
            if (attachment.processing) {
              row.classList.add("llm-file-processing");
            }
            const type = createElement(ownerDoc, "span", "llm-file-context-type", {
              textContent: getAttachmentTypeLabel(attachment),
              title: attachment.mimeType || attachment.category || "file",
            });
            type.setAttribute("data-category", attachment.category || "file");
            const info = createElement(ownerDoc, "div", "llm-file-context-text");
            const name = createElement(ownerDoc, "span", "llm-file-context-name");
            if (attachment.processing) {
              name.classList.add("llm-file-name-loading");
            } else {
              name.textContent = attachment.name;
              name.title = attachment.name;
            }
            const meta = createElement(
              ownerDoc,
              "span",
              "llm-file-context-meta-info",
              {
                textContent: attachment.processing
                  ? "Processing..."
                  : `${attachment.mimeType || "application/octet-stream"} · ${(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
              },
            );
            const removeBtn = createElement(
              ownerDoc,
              "button",
              "llm-file-context-remove",
              {
                type: "button",
                textContent: "×",
                title: `Remove ${attachment.name}`,
              },
            );
            removeBtn.addEventListener("click", makeOnRemove(index));
            info.append(name, meta);
            row.append(type, info, removeBtn);
            filePreviewList.appendChild(row);
          });
        }
      });
    }
    if (composeHook.save) composeHook.save();
  };

  // Helper to update image preview UI
  const updateImagePreview = () => {
    if (
      !item ||
      !imagePreview ||
      !previewStrip ||
      !previewExpanded ||
      !previewSelected ||
      !previewSelectedImg ||
      !previewMeta ||
      !screenshotBtn
    )
      return;
    const ownerDoc = body.ownerDocument;
    if (!ownerDoc) return;
    const { currentModel } = getSelectedModelInfo();
    const screenshotUnsupported = isScreenshotUnsupportedModel(currentModel);
    const screenshotDisabledHint = getScreenshotDisabledHint(currentModel);
    let selectedImages = selectedImageCache.get(item.id) || [];
    if (screenshotUnsupported && selectedImages.length) {
      clearSelectedImageState(item.id);
      selectedImages = [];
    }
    if (selectedImages.length) {
      const imageCount = selectedImages.length;
      let expanded = selectedImagePreviewExpandedCache.get(item.id);
      if (typeof expanded !== "boolean") {
        expanded = false;
        selectedImagePreviewExpandedCache.set(item.id, false);
      }

      let activeIndex = selectedImagePreviewActiveIndexCache.get(item.id);
      if (typeof activeIndex !== "number" || !Number.isFinite(activeIndex)) {
        activeIndex = imageCount - 1;
      }
      activeIndex = Math.max(
        0,
        Math.min(imageCount - 1, Math.floor(activeIndex)),
      );
      selectedImagePreviewActiveIndexCache.set(item.id, activeIndex);

      previewMeta.textContent = formatFigureCountLabel(imageCount);
      previewMeta.classList.toggle("expanded", expanded);
      previewMeta.setAttribute("aria-expanded", expanded ? "true" : "false");
      previewMeta.title = expanded
        ? "Unpin figures panel"
        : "Pin figures panel";

      imagePreview.style.display = "flex";
      imagePreview.classList.toggle("expanded", expanded);
      imagePreview.classList.toggle("collapsed", !expanded);
      previewExpanded.hidden = false;
      previewExpanded.style.display = "grid";
      previewSelected.style.display = "";

      previewStrip.innerHTML = "";
      for (const [index, imageUrl] of selectedImages.entries()) {
        const thumbItem = createElement(ownerDoc, "div", "llm-preview-item");
        const thumbBtn = createElement(
          ownerDoc,
          "button",
          "llm-preview-thumb",
          {
            type: "button",
            title: `Screenshot ${index + 1}`,
          },
        ) as HTMLButtonElement;
        thumbBtn.classList.toggle("active", index === activeIndex);
        const thumb = createElement(ownerDoc, "img", "llm-preview-img", {
          alt: "Selected screenshot",
        }) as HTMLImageElement;
        thumb.src = imageUrl;
        thumbBtn.appendChild(thumb);
        thumbBtn.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (!item) return;
          selectedImagePreviewActiveIndexCache.set(item.id, index);
          if (selectedImagePreviewExpandedCache.get(item.id) !== true) {
            selectedImagePreviewExpandedCache.set(item.id, true);
          }
          updateImagePreviewPreservingScroll();
        });

        const removeOneBtn = createElement(
          ownerDoc,
          "button",
          "llm-preview-remove-one",
          {
            type: "button",
            textContent: "×",
            title: `Remove screenshot ${index + 1}`,
          },
        );
        removeOneBtn.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          if (!item) return;
          const currentImages = selectedImageCache.get(item.id) || [];
          if (index < 0 || index >= currentImages.length) return;
          const nextImages = currentImages.filter((_, i) => i !== index);
          if (nextImages.length) {
            selectedImageCache.set(item.id, nextImages);
            let nextActive =
              selectedImagePreviewActiveIndexCache.get(item.id) || 0;
            if (index < nextActive) {
              nextActive -= 1;
            }
            if (nextActive >= nextImages.length) {
              nextActive = nextImages.length - 1;
            }
            selectedImagePreviewActiveIndexCache.set(item.id, nextActive);
          } else {
            clearSelectedImageState(item.id);
          }
          updateImagePreviewPreservingScroll();
          if (status) {
            setStatus(
              status,
              `Screenshot removed (${nextImages.length})`,
              "ready",
            );
          }
        });
        thumbItem.append(thumbBtn, removeOneBtn);
        previewStrip.appendChild(thumbItem);
      }
      previewSelectedImg.src = selectedImages[activeIndex];
      previewSelectedImg.alt = `Selected screenshot ${activeIndex + 1}`;
      screenshotBtn.disabled =
        screenshotUnsupported || imageCount >= MAX_SELECTED_IMAGES;
      screenshotBtn.title = screenshotUnsupported
        ? screenshotDisabledHint
        : imageCount >= MAX_SELECTED_IMAGES
          ? `Max ${MAX_SELECTED_IMAGES} screenshots`
          : `Add screenshot (${imageCount})`;
    } else {
      imagePreview.style.display = "none";
      imagePreview.classList.remove("expanded", "collapsed");
      previewExpanded.hidden = true;
      previewExpanded.style.display = "none";
      previewStrip.innerHTML = "";
      previewSelected.style.display = "none";
      previewSelectedImg.removeAttribute("src");
      previewSelectedImg.alt = "Selected screenshot preview";
      previewMeta.textContent = formatFigureCountLabel(0);
      previewMeta.classList.remove("expanded");
      previewMeta.setAttribute("aria-expanded", "false");
      previewMeta.title = "Pin figures panel";
      clearSelectedImageState(item.id);
      screenshotBtn.disabled = screenshotUnsupported;
      screenshotBtn.title = screenshotUnsupported
        ? screenshotDisabledHint
        : "Select figure screenshot";
    }
    applyResponsiveActionButtonsLayout();
    if (composeHook.save) composeHook.save();
  };

  const updateSelectedTextPreview = () => {
    if (!item) return;
    const textContextKey = getTextContextConversationKey();
    if (!textContextKey) return;
    applySelectedTextPreview(body, textContextKey);
    if (composeHook.save) composeHook.save();
  };
  const updatePaperPreviewPreservingScroll = () => {
    runWithChatScrollGuard(() => {
      updatePaperPreview();
    });
  };
  const updateFilePreviewPreservingScroll = () => {
    runWithChatScrollGuard(() => {
      updateFilePreview();
    });
  };
  const updateImagePreviewPreservingScroll = () => {
    runWithChatScrollGuard(() => {
      updateImagePreview();
    });
  };
  const updateSelectedTextPreviewPreservingScroll = () => {
    runWithChatScrollGuard(() => {
      updateSelectedTextPreview();
    });
  };
  const refreshChatPreservingScroll = () => {
    runWithChatScrollGuard(() => {
      refreshChat(body, item);
    });
  };

  let latestConversationHistory: ConversationHistoryEntry[] = [];
  let globalHistoryLoadSeq = 0;
  let pendingHistoryDeletion: PendingHistoryDeletion | null = null;
  const pendingHistoryDeletionKeys = new Set<number>();

  const getWindowTimeout = (fn: () => void, delayMs: number): number => {
    const win = body.ownerDocument?.defaultView;
    if (win) return win.setTimeout(fn, delayMs);
    return (setTimeout(fn, delayMs) as unknown as number) || 0;
  };

  const clearWindowTimeout = (timeoutId: number | null) => {
    if (!Number.isFinite(timeoutId)) return;
    const win = body.ownerDocument?.defaultView;
    if (win) {
      win.clearTimeout(timeoutId as number);
      return;
    }
    clearTimeout(timeoutId as unknown as ReturnType<typeof setTimeout>);
  };

  const hideHistoryUndoToast = () => {
    if (historyUndo) historyUndo.style.display = "none";
    if (historyUndoText) historyUndoText.textContent = "";
  };

  const showHistoryUndoToast = (title: string) => {
    if (!historyUndo || !historyUndoText) return;
    const displayTitle =
      normalizeHistoryTitle(title) || normalizeHistoryTitle("Untitled chat");
    historyUndoText.textContent = `Deleted "${displayTitle}"`;
    historyUndo.style.display = "flex";
  };

  const getPaperHistoryEntries = async (): Promise<ConversationHistoryEntry[]> => {
    if (!basePaperItem) return [];
    const parentItemId = basePaperItem.id;
    let paperConversations: Awaited<ReturnType<typeof listPaperConversations>> = [];
    try {
      paperConversations = await listPaperConversations(parentItemId, PAPER_HISTORY_LIMIT);
    } catch (err) {
      ztoolkit.log("LLM: Failed to list paper conversations", err);
    }
    if (!paperConversations.length) return [];
    const entries: ConversationHistoryEntry[] = [];
    for (const pc of paperConversations) {
      if (pendingHistoryDeletionKeys.has(pc.conversationKey)) continue;
      const history = chatHistory.get(pc.conversationKey) || [];
      let firstUserText = "";
      for (const msg of history) {
        if (msg.role === "user" && typeof msg.text === "string" && msg.text.trim()) {
          firstUserText = msg.text.trim();
          break;
        }
      }
      const MAX_TITLE_LEN = 50;
      const title = pc.title
        ? normalizeHistoryTitle(pc.title)
        : firstUserText
          ? (firstUserText.length > MAX_TITLE_LEN
              ? firstUserText.slice(0, MAX_TITLE_LEN) + "…"
              : firstUserText)
          : normalizeHistoryTitle(basePaperItem.getField("title")) || "Paper chat";
      entries.push({
        kind: "paper",
        conversationKey: pc.conversationKey,
        title,
        timestampText: pc.lastActivityAt
          ? formatGlobalHistoryTimestamp(pc.lastActivityAt)
          : "Paper chat",
        deletable: true,
        isDraft: pc.userTurnCount === 0,
        isPendingDelete: false,
        lastActivityAt: pc.lastActivityAt || 0,
        isPinned: pc.isPinned ?? false,
      });
    }
    return entries;
  };

  const isHistoryEntryActive = (entry: ConversationHistoryEntry): boolean => {
    if (!item) return false;
    const activeConversationKey = getConversationKey(item);
    if (entry.kind === "paper") {
      return !isGlobalMode() && activeConversationKey === entry.conversationKey;
    }
    return isGlobalMode() && activeConversationKey === entry.conversationKey;
  };

  const SVG_NS = "http://www.w3.org/2000/svg";
  const createTrashIcon = (doc: Document): Element => {
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    const paths = [
      "M2 4h12",
      "M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4",
      "M3.333 4v9.333a1.333 1.333 0 0 0 1.334 1.334h6.666a1.333 1.333 0 0 0 1.334-1.334V4",
      "M6.667 7.333v4",
      "M9.333 7.333v4",
    ];
    for (const d of paths) {
      const path = doc.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  };

  const createPinIcon = (doc: Document): Element => {
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    // Clean star outline — same stroke style as the trash icon
    const paths = [
      "M8 1.5 L10 6 L15 6.5 L11 10 L12 15 L8 12.5 L4 15 L5 10 L1 6.5 L6 6 Z",
    ];
    for (const d of paths) {
      const path = doc.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  };

  const createEditIcon = (doc: Document): Element => {
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    // Clean pencil icon — same stroke style as the trash icon
    const paths = [
      // Pencil body (parallelogram)
      "M11 2 L14 5 L5.5 13.5 L2.5 13.5 L2.5 10.5 Z",
      // Tip detail line
      "M9 4 L12 7",
    ];
    for (const d of paths) {
      const path = doc.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    return svg;
  };

  const renderGlobalHistoryMenu = () => {
    if (!historyMenu) return;
    historyMenu.innerHTML = "";

    const header = createElement(
      body.ownerDocument as Document,
      "div",
      "llm-history-menu-header",
      {
        textContent: i18n.chatHistory,
      },
    );
    historyMenu.appendChild(header);

    const visibleEntries = latestConversationHistory.filter(
      (entry) => !entry.isPendingDelete,
    );

    if (!visibleEntries.length) {
      const emptyRow = createElement(
        body.ownerDocument as Document,
        "div",
        "llm-history-menu-empty",
        {
          textContent: i18n.noHistoryYet,
        },
      );
      historyMenu.appendChild(emptyRow);
    } else {
      const listContainer = createElement(
        body.ownerDocument as Document,
        "div",
        "llm-history-menu-list",
      );

      for (const entry of visibleEntries) {
        const row = createElement(
          body.ownerDocument as Document,
          "div",
          "llm-history-menu-row",
        ) as HTMLDivElement;
        row.dataset.conversationKey = `${entry.conversationKey}`;
        row.dataset.historyKind = entry.kind;
        if (entry.isPinned) {
          row.classList.add("pinned");
        }
        if (isHistoryEntryActive(entry)) {
          row.classList.add("active");
        }

        // ── Pin indicator chip (left of title) ──
        if (entry.isPinned) {
          const pinChip = createElement(
            body.ownerDocument as Document,
            "span",
            "llm-history-pin-chip",
            { title: i18n.unpinConversation },
          );
          pinChip.textContent = "⭐";
          row.appendChild(pinChip);
        }

        const rowMain = createElement(
          body.ownerDocument as Document,
          "button",
          "llm-history-menu-row-main",
          {
            type: "button",
          },
        ) as HTMLButtonElement;
        rowMain.dataset.action = "switch";
        const titleEl = createElement(
          body.ownerDocument as Document,
          "span",
          "llm-history-row-title",
          {
            textContent: formatHistoryRowDisplayTitle(entry.title),
            title: entry.title,
          },
        );
        const meta = createElement(
          body.ownerDocument as Document,
          "span",
          "llm-history-row-meta",
          {
            textContent: entry.timestampText,
            title: entry.timestampText,
          },
        );
        rowMain.append(titleEl, meta);
        row.appendChild(rowMain);

        // ── Action buttons ──
        // Rename button
        const renameBtn = createElement(
          body.ownerDocument as Document,
          "button",
          "llm-history-row-action llm-history-row-rename",
          {
            type: "button",
            title: i18n.renameConversation,
          },
        ) as HTMLButtonElement;
        renameBtn.appendChild(createEditIcon(body.ownerDocument as Document));
        renameBtn.setAttribute("aria-label", `Rename ${entry.title}`);
        renameBtn.dataset.action = "rename";
        row.appendChild(renameBtn);

        // Pin toggle button
        const pinBtn = createElement(
          body.ownerDocument as Document,
          "button",
          "llm-history-row-action llm-history-row-pin",
          {
            type: "button",
            title: entry.isPinned ? i18n.unpinConversation : i18n.pinConversation,
          },
        ) as HTMLButtonElement;
        pinBtn.classList.toggle("is-pinned", entry.isPinned);
        pinBtn.appendChild(createPinIcon(body.ownerDocument as Document));
        pinBtn.setAttribute(
          "aria-label",
          entry.isPinned ? `Unpin ${entry.title}` : `Pin ${entry.title}`,
        );
        pinBtn.dataset.action = "pin";
        row.appendChild(pinBtn);

        if (entry.deletable) {
          const deleteBtn = createElement(
            body.ownerDocument as Document,
            "button",
            "llm-history-row-action llm-history-row-delete",
            {
              type: "button",
              title: "Delete conversation",
            },
          ) as HTMLButtonElement;
          deleteBtn.appendChild(createTrashIcon(body.ownerDocument as Document));
          deleteBtn.setAttribute("aria-label", `Delete ${entry.title}`);
          deleteBtn.dataset.action = "delete";
          row.appendChild(deleteBtn);
        }

        listContainer.appendChild(row);
      }

      historyMenu.appendChild(listContainer);
    }

    // Always show delete-all when there are deletable entries (global or paper)
    const hasDeletable = latestConversationHistory.some(
      (entry) => entry.deletable && !entry.isPendingDelete,
    );
    if (hasDeletable) {
      const divider = createElement(
        body.ownerDocument as Document,
        "div",
        "llm-history-menu-divider",
      );
      const deleteAllBtn = createElement(
        body.ownerDocument as Document,
        "button",
        "llm-history-delete-all",
        {
          type: "button",
          textContent: i18n.deleteAll,
        },
      ) as HTMLButtonElement;
      deleteAllBtn.dataset.action = "delete-all";
      historyMenu.append(divider, deleteAllBtn);
    }
  };


  const refreshGlobalHistoryHeader = async () => {
    if (!historyBar || !titleStatic || !item) {
      if (titleStatic) titleStatic.style.display = "";
      if (historyBar) historyBar.style.display = "none";
      closeHistoryMenu();
      hideHistoryUndoToast();
      return;
    }

    const tabType = (body as HTMLElement).dataset?.tabType || "";
    const requestId = ++globalHistoryLoadSeq;
    const nextEntries: ConversationHistoryEntry[] = [];

    // ── Reader mode: list all paper conversations ──
    // Each Reader tab is fully isolated — no global conversations shown.
    if (tabType === "reader") {
      const paperEntries = await getPaperHistoryEntries();
      if (requestId !== globalHistoryLoadSeq) return;
      for (const pe of paperEntries) {
        nextEntries.push(pe);
      }
      latestConversationHistory = nextEntries;
      titleStatic.style.display = "none";
      historyBar.style.display = "inline-flex";
      renderGlobalHistoryMenu();
      return;
    }

    // ── Library / Global mode: query global conversations table ──
    const libraryID = getCurrentLibraryID();

    if (libraryID) {
      let historyEntries: Awaited<ReturnType<typeof listGlobalConversations>> =
        [];
      try {
        historyEntries = await listGlobalConversations(
          libraryID,
          GLOBAL_HISTORY_LIMIT,
          false,
        );
      } catch (err) {
        ztoolkit.log("LLM: Failed to load global history entries", err);
      }
      if (requestId !== globalHistoryLoadSeq) return;

      const globalEntries: ConversationHistoryEntry[] = [];
      const seenGlobalKeys = new Set<number>();
      for (const entry of historyEntries) {
        const conversationKey = Number(entry.conversationKey);
        if (!Number.isFinite(conversationKey) || conversationKey <= 0) continue;
        const normalizedKey = Math.floor(conversationKey);
        if (pendingHistoryDeletionKeys.has(normalizedKey)) continue;
        if (seenGlobalKeys.has(normalizedKey)) continue;
        seenGlobalKeys.add(normalizedKey);
        const title = normalizeHistoryTitle(entry.title) || "Untitled chat";
        const lastActivity = Number(entry.lastActivityAt || entry.createdAt || 0);
        globalEntries.push({
          kind: "global",
          conversationKey: normalizedKey,
          title,
          timestampText:
            formatGlobalHistoryTimestamp(lastActivity) || "Standalone chat",
          deletable: true,
          isDraft: false,
          isPendingDelete: false,
          lastActivityAt: Number.isFinite(lastActivity)
            ? Math.floor(lastActivity)
            : 0,
          isPinned: entry.isPinned ?? false,
        });
      }

      let activeGlobalKey = 0;
      if (isGlobalMode() && item && Number.isFinite(item.id) && item.id > 0) {
        activeGlobalKey = Math.floor(item.id);
      } else {
        const remembered = Number(activeGlobalConversationByLibrary.get(libraryID));
        if (Number.isFinite(remembered) && remembered > 0) {
          activeGlobalKey = Math.floor(remembered);
        }
      }
      if (activeGlobalKey > 0 && !pendingHistoryDeletionKeys.has(activeGlobalKey)) {
        const existsInHistorical = globalEntries.some(
          (entry) => entry.conversationKey === activeGlobalKey,
        );
        if (!existsInHistorical) {
          // Active conversation is empty (not in non-empty history list).
          // Do NOT insert it as a draft — empty conversations should not appear in history.
        }
      }

      const dedupedGlobalEntries: ConversationHistoryEntry[] = [];
      const seenGlobalEntryKeys = new Set<number>();
      for (const entry of globalEntries) {
        if (seenGlobalEntryKeys.has(entry.conversationKey)) continue;
        seenGlobalEntryKeys.add(entry.conversationKey);
        dedupedGlobalEntries.push(entry);
      }
      nextEntries.push(...dedupedGlobalEntries);
    }

    latestConversationHistory = nextEntries.filter(
      (entry) => !pendingHistoryDeletionKeys.has(entry.conversationKey),
    );

    titleStatic.style.display = "none";
    historyBar.style.display = "inline-flex";
    renderGlobalHistoryMenu();
  };

  const resetComposePreviewUI = () => {
    updatePaperPreviewPreservingScroll();
    updateFilePreviewPreservingScroll();
    updateImagePreviewPreservingScroll();
    updateSelectedTextPreviewPreservingScroll();
  };

  const switchGlobalConversation = async (nextConversationKey: number) => {
    if (!item) return;
    const libraryID = getCurrentLibraryID();
    if (!libraryID) return;
    const normalizedConversationKey = Number.isFinite(nextConversationKey)
      ? Math.floor(nextConversationKey)
      : 0;
    if (normalizedConversationKey <= 0) return;
    const nextItem = createGlobalPortalItem(libraryID, normalizedConversationKey);
    item = nextItem;
    syncConversationIdentity();
    activeEditSession = null;
    closePaperPicker();
    closePromptMenu();
    closeResponseMenu();
    closeRetryModelMenu();
    closeExportMenu();
    closeHistoryMenu();
    await ensureConversationLoaded(item);
    refreshChatPreservingScroll();
    resetComposePreviewUI();
    updateModelButton();
    void refreshGlobalHistoryHeader();
  };

  const switchToHistoryTarget = async (
    target: HistorySwitchTarget,
  ): Promise<void> => {
    if (!target) return;
    if (target.kind === "paper") {
      await switchPaperConversation(target.conversationKey);
      return;
    }
    await switchGlobalConversation(target.conversationKey);
  };

  const resolveFallbackAfterGlobalDelete = async (
    libraryID: number,
    deletedConversationKey: number,
  ): Promise<HistorySwitchTarget> => {
    let remainingHistorical: Awaited<ReturnType<typeof listGlobalConversations>> =
      [];
    try {
      remainingHistorical = await listGlobalConversations(
        libraryID,
        GLOBAL_HISTORY_LIMIT,
        false,
      );
    } catch (err) {
      ztoolkit.log(
        "LLM: Failed to load fallback global history candidates",
        err,
      );
    }
    for (const entry of remainingHistorical) {
      const candidateKey = Number(entry.conversationKey);
      if (!Number.isFinite(candidateKey) || candidateKey <= 0) continue;
      const normalizedKey = Math.floor(candidateKey);
      if (normalizedKey === deletedConversationKey) continue;
      if (pendingHistoryDeletionKeys.has(normalizedKey)) continue;
      return { kind: "global", conversationKey: normalizedKey };
    }
    if (basePaperItem) {
      const activeKey = activePaperConversationByItem.get(basePaperItem.id);
      if (activeKey && activeKey > 0) {
        return { kind: "paper", conversationKey: activeKey };
      }
    }

    const isEmptyDraft = async (conversationKey: number): Promise<boolean> => {
      if (!Number.isFinite(conversationKey) || conversationKey <= 0) return false;
      const normalizedKey = Math.floor(conversationKey);
      if (normalizedKey === deletedConversationKey) return false;
      if (pendingHistoryDeletionKeys.has(normalizedKey)) return false;
      try {
        const count = await getGlobalConversationUserTurnCount(normalizedKey);
        return count === 0;
      } catch (err) {
        ztoolkit.log(
          "LLM: Failed to inspect draft candidate user turn count",
          err,
        );
        return false;
      }
    };

    let candidateDraftKey = Number(activeGlobalConversationByLibrary.get(libraryID));
    if (!(await isEmptyDraft(candidateDraftKey))) {
      candidateDraftKey = 0;
      try {
        const latestEmpty = await getLatestEmptyGlobalConversation(libraryID);
        const latestEmptyKey = Number(latestEmpty?.conversationKey || 0);
        if (await isEmptyDraft(latestEmptyKey)) {
          candidateDraftKey = Math.floor(latestEmptyKey);
        }
      } catch (err) {
        ztoolkit.log("LLM: Failed to load latest empty draft candidate", err);
      }
    }
    if (candidateDraftKey > 0) {
      return {
        kind: "global",
        conversationKey: Math.floor(candidateDraftKey),
      };
    }

    let createdDraftKey = 0;
    try {
      createdDraftKey = await createGlobalConversation(libraryID);
    } catch (err) {
      ztoolkit.log("LLM: Failed to create fallback draft conversation", err);
    }
    if (createdDraftKey > 0) {
      ztoolkit.log("LLM: Fallback target created new draft", {
        libraryID,
        conversationKey: createdDraftKey,
      });
      return {
        kind: "global",
        conversationKey: Math.floor(createdDraftKey),
      };
    }
    return null;
  };

  const clearPendingDeletionCaches = (conversationKey: number) => {
    chatHistory.delete(conversationKey);
    loadedConversationKeys.delete(conversationKey);
    selectedModelCache.delete(conversationKey);
    clearTransientComposeStateForItem(conversationKey);
  };

  const finalizeConversationDeletion = async (
    pending: PendingHistoryDeletion,
  ): Promise<void> => {
    const conversationKey = pending.conversationKey;
    if (pending.kind === "global") {
      const rememberedKey = Number(
        activeGlobalConversationByLibrary.get(pending.libraryID),
      );
      if (
        Number.isFinite(rememberedKey) &&
        Math.floor(rememberedKey) === conversationKey
      ) {
        activeGlobalConversationByLibrary.delete(pending.libraryID);
      }
    } else {
      // Paper: remove from activePaperConversationByItem if it matches
      for (const [itemId, pKey] of activePaperConversationByItem.entries()) {
        if (pKey === conversationKey) {
          activePaperConversationByItem.delete(itemId);
        }
      }
    }
    clearPendingDeletionCaches(conversationKey);
    let hasError = false;
    try {
      await clearStoredConversation(conversationKey);
    } catch (err) {
      hasError = true;
      ztoolkit.log("LLM: Failed to clear deleted history conversation", err);
    }
    try {
      await clearOwnerAttachmentRefs("conversation", conversationKey);
    } catch (err) {
      hasError = true;
      ztoolkit.log(
        "LLM: Failed to clear deleted history attachment refs",
        err,
      );
    }
    try {
      await removeConversationAttachmentFiles(conversationKey);
    } catch (err) {
      hasError = true;
      ztoolkit.log("LLM: Failed to remove deleted history attachment files", err);
    }
    try {
      if (pending.kind === "paper") {
        await deletePaperConversation(conversationKey);
      } else {
        await deleteGlobalConversation(conversationKey);
      }
    } catch (err) {
      hasError = true;
      ztoolkit.log("LLM: Failed to delete history conversation", err);
    }
    scheduleAttachmentGc();
    if (hasError && status) {
      setStatus(
        status,
        "Failed to fully delete conversation. Check logs.",
        "error",
      );
    }
  };

  const clearPendingHistoryDeletion = (
    restoreRowVisibility: boolean,
  ): PendingHistoryDeletion | null => {
    if (!pendingHistoryDeletion) return null;
    const pending = pendingHistoryDeletion;
    clearWindowTimeout(pending.timeoutId);
    pending.timeoutId = null;
    if (restoreRowVisibility) {
      pendingHistoryDeletionKeys.delete(pending.conversationKey);
    }
    pendingHistoryDeletion = null;
    hideHistoryUndoToast();
    return pending;
  };

  const finalizePendingHistoryDeletion = async (
    reason: "timeout" | "superseded",
  ) => {
    const pending = clearPendingHistoryDeletion(false);
    if (!pending) return;
    ztoolkit.log("LLM: Finalizing pending history deletion", {
      reason,
      conversationKey: pending.conversationKey,
      libraryID: pending.libraryID,
      title: pending.title,
    });
    await finalizeConversationDeletion(pending);
    pendingHistoryDeletionKeys.delete(pending.conversationKey);
    await refreshGlobalHistoryHeader();
  };

  const undoPendingHistoryDeletion = async () => {
    const pending = clearPendingHistoryDeletion(true);
    if (!pending) return;
    ztoolkit.log("LLM: Restoring pending history deletion", {
      conversationKey: pending.conversationKey,
      libraryID: pending.libraryID,
      kind: pending.kind,
      title: pending.title,
    });
    if (pending.wasActive) {
      if (pending.kind === "paper") {
        await switchPaperConversation(pending.conversationKey);
      } else {
        await switchGlobalConversation(pending.conversationKey);
      }
      if (status) setStatus(status, "Conversation restored", "ready");
      return;
    }
    await refreshGlobalHistoryHeader();
    if (status) setStatus(status, "Conversation restored", "ready");
  };

  const findHistoryEntryByKey = (
    historyKind: "paper" | "global",
    conversationKey: number,
  ): ConversationHistoryEntry | null => {
    return (
      latestConversationHistory.find(
        (entry) =>
          entry.kind === historyKind && entry.conversationKey === conversationKey,
      ) || null
    );
  };

  const queueHistoryDeletion = async (entry: ConversationHistoryEntry) => {
    if (!item) return;
    if (!entry.deletable) return;
    if (entry.kind !== "global" && entry.kind !== "paper") return;
    const libraryID = getCurrentLibraryID();
    if (!libraryID) {
      if (status) setStatus(status, "No active library for deletion", "error");
      return;
    }

    if (pendingHistoryDeletion) {
      if (pendingHistoryDeletion.conversationKey === entry.conversationKey) {
        return;
      }
      await finalizePendingHistoryDeletion("superseded");
    }

    const wasActive = isHistoryEntryActive(entry);
    let fallbackTarget: HistorySwitchTarget = null;
    if (wasActive) {
      // When deleting the active conversation, create a fresh new conversation
      let newConversationKey = 0;
      try {
        if (entry.kind === "paper") {
          newConversationKey = await createPaperConversation(item.id);
        } else {
          newConversationKey = await createGlobalConversation(libraryID);
        }
      } catch (err) {
        ztoolkit.log("LLM: Failed to create new conversation after deleting active", err);
      }
      if (!newConversationKey) {
        if (status) {
          setStatus(status, "Cannot delete active conversation right now", "error");
        }
        return;
      }
      fallbackTarget = { kind: entry.kind, conversationKey: newConversationKey };
      await switchToHistoryTarget(fallbackTarget);
    }

    pendingHistoryDeletionKeys.add(entry.conversationKey);
    const pending: PendingHistoryDeletion = {
      conversationKey: entry.conversationKey,
      libraryID,
      kind: entry.kind,
      title: entry.title,
      wasActive,
      fallbackTarget,
      expiresAt: Date.now() + GLOBAL_HISTORY_UNDO_WINDOW_MS,
      timeoutId: null,
    };
    pending.timeoutId = getWindowTimeout(() => {
      void finalizePendingHistoryDeletion("timeout");
    }, GLOBAL_HISTORY_UNDO_WINDOW_MS);
    pendingHistoryDeletion = pending;

    ztoolkit.log("LLM: Queued history deletion", {
      conversationKey: entry.conversationKey,
      libraryID,
      kind: entry.kind,
      wasActive,
      fallbackTarget,
      expiresAt: pending.expiresAt,
    });
    showHistoryUndoToast(entry.title);
    await refreshGlobalHistoryHeader();
    if (status) setStatus(status, "Conversation deleted. Undo available.", "ready");
  };

  /** Core batch-delete logic shared by "delete unpinned" and "delete all" */
  const executeBatchDelete = async (entriesToDelete: ConversationHistoryEntry[]) => {
    if (!item) return;
    const libraryID = getCurrentLibraryID();
    if (!libraryID) return;

    if (pendingHistoryDeletion) {
      await finalizePendingHistoryDeletion("superseded");
    }

    if (!entriesToDelete.length) return;

    const globalEntries = entriesToDelete.filter((e) => e.kind === "global");
    const paperEntries = entriesToDelete.filter((e) => e.kind === "paper");

    if (globalEntries.length) {
      if (globalEntries.length === latestConversationHistory.filter((e) => e.kind === "global" && e.deletable).length) {
        // All globals — use fast batch delete (but we need to exclude pinned ones that are kept)
        // Since we only call this for entries we want to delete, do individual deletes to handle partial
        for (const entry of globalEntries) {
          clearPendingDeletionCaches(entry.conversationKey);
          try { await clearStoredConversation(entry.conversationKey); } catch (_err) { /* best-effort */ }
          try { await clearOwnerAttachmentRefs("conversation", entry.conversationKey); } catch (_err) { /* best-effort */ }
          try { await removeConversationAttachmentFiles(entry.conversationKey); } catch (_err) { /* best-effort */ }
          try { await deleteGlobalConversation(entry.conversationKey); } catch (_err) { /* best-effort */ }
          if (activeGlobalConversationByLibrary.get(libraryID) === entry.conversationKey) {
            activeGlobalConversationByLibrary.delete(libraryID);
          }
        }
      } else {
        for (const entry of globalEntries) {
          clearPendingDeletionCaches(entry.conversationKey);
          try { await clearStoredConversation(entry.conversationKey); } catch (_err) { /* best-effort */ }
          try { await clearOwnerAttachmentRefs("conversation", entry.conversationKey); } catch (_err) { /* best-effort */ }
          try { await removeConversationAttachmentFiles(entry.conversationKey); } catch (_err) { /* best-effort */ }
          try { await deleteGlobalConversation(entry.conversationKey); } catch (_err) { /* best-effort */ }
          if (activeGlobalConversationByLibrary.get(libraryID) === entry.conversationKey) {
            activeGlobalConversationByLibrary.delete(libraryID);
          }
        }
      }
    }

    for (const entry of paperEntries) {
      clearPendingDeletionCaches(entry.conversationKey);
      try { await clearStoredConversation(entry.conversationKey); } catch (_err) { /* best-effort */ }
      try { await clearOwnerAttachmentRefs("conversation", entry.conversationKey); } catch (_err) { /* best-effort */ }
      try { await removeConversationAttachmentFiles(entry.conversationKey); } catch (_err) { /* best-effort */ }
      try { await deletePaperConversation(entry.conversationKey); } catch (_err) { /* best-effort */ }
    }
    scheduleAttachmentGc();

    // Switch to a fresh conversation
    if (tabType === "reader" && item) {
      let newKey = 0;
      try { newKey = await createPaperConversation(item.id); } catch (_err) { /* */ }
      if (newKey > 0) {
        await switchPaperConversation(newKey);
      }
    } else {
      const remaining = await listGlobalConversations(libraryID, 1, false);
      if (remaining.length > 0) {
        await switchGlobalConversation(remaining[0].conversationKey);
      } else {
        let newKey = 0;
        try { newKey = await createGlobalConversation(libraryID); } catch (_err) { /* */ }
        if (newKey > 0) {
          activeGlobalConversationByLibrary.set(libraryID, newKey);
          await switchGlobalConversation(newKey);
        }
      }
    }

    closeHistoryMenu();
    hideHistoryUndoToast();
    await refreshGlobalHistoryHeader();
    if (status) setStatus(status, i18n.deleteAllConfirm, "ready");
  };

  /** Show a three-option confirmation inside the history menu */
  const deleteAllVisibleHistory = async () => {
    if (!item) return;
    if (!historyMenu) return;

    const deletable = latestConversationHistory.filter(
      (e) => e.deletable && !e.isPendingDelete,
    );
    if (!deletable.length) return;

    const unpinnedCount = deletable.filter((e) => !e.isPinned).length;
    const hasPinned = deletable.some((e) => e.isPinned);

    // Build the inline confirm panel
    const confirmPanel = createElement(
      body.ownerDocument as Document,
      "div",
      "llm-history-delete-confirm",
    ) as HTMLDivElement;

    const confirmTitle = createElement(
      body.ownerDocument as Document,
      "div",
      "llm-history-delete-confirm-title",
      { textContent: i18n.confirmDeleteTitle },
    );
    confirmPanel.appendChild(confirmTitle);

    const btnRow = createElement(
      body.ownerDocument as Document,
      "div",
      "llm-history-delete-confirm-btns",
    );

    // Option 1: Delete unpinned (only shown if there are pinned items)
    if (hasPinned && unpinnedCount > 0) {
      const unpinnedBtn = createElement(
        body.ownerDocument as Document,
        "button",
        "llm-history-confirm-btn llm-history-confirm-btn--warn",
        {
          type: "button",
          textContent: i18n.deleteUnpinned,
        },
      ) as HTMLButtonElement;
      unpinnedBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        confirmPanel.remove();
        void executeBatchDelete(deletable.filter((entry) => !entry.isPinned));
      });
      btnRow.appendChild(unpinnedBtn);
    }

    // Option 2: Delete all
    const deleteAllBtn2 = createElement(
      body.ownerDocument as Document,
      "button",
      "llm-history-confirm-btn llm-history-confirm-btn--danger",
      {
        type: "button",
        textContent: i18n.deleteAllHistory,
      },
    ) as HTMLButtonElement;
    deleteAllBtn2.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmPanel.remove();
      void executeBatchDelete(deletable);
    });
    btnRow.appendChild(deleteAllBtn2);

    // Option 3: Cancel
    const cancelBtn2 = createElement(
      body.ownerDocument as Document,
      "button",
      "llm-history-confirm-btn llm-history-confirm-btn--cancel",
      {
        type: "button",
        textContent: i18n.cancelAction,
      },
    ) as HTMLButtonElement;
    cancelBtn2.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      confirmPanel.remove();
    });
    btnRow.appendChild(cancelBtn2);

    confirmPanel.appendChild(btnRow);

    // Replace delete-all button with the confirm panel
    const existingDeleteAll = historyMenu.querySelector(".llm-history-delete-all");
    if (existingDeleteAll) {
      existingDeleteAll.replaceWith(confirmPanel);
    } else {
      historyMenu.appendChild(confirmPanel);
    }
  };

  /** Toggle pin for a conversation */
  const togglePinConversation = async (
    historyKind: "paper" | "global",
    conversationKey: number,
  ) => {
    const entry = findHistoryEntryByKey(historyKind, conversationKey);
    if (!entry) return;
    const nextPinned = !entry.isPinned;
    try {
      if (historyKind === "global") {
        await pinGlobalConversation(conversationKey, nextPinned);
      } else {
        await pinPaperConversation(conversationKey, nextPinned);
      }
    } catch (err) {
      ztoolkit.log("LLM: Failed to toggle pin", err);
    }
    await refreshGlobalHistoryHeader();
  };

  /** Start inline rename for a conversation */
  const startInlineRename = (
    historyKind: "paper" | "global",
    conversationKey: number,
    rowEl: HTMLDivElement,
  ) => {
    const entry = findHistoryEntryByKey(historyKind, conversationKey);
    if (!entry) return;

    // Prevent double-open
    if (rowEl.querySelector(".llm-history-rename-input")) return;

    const doc = body.ownerDocument as Document;
    const rowMain = rowEl.querySelector(".llm-history-menu-row-main") as HTMLButtonElement | null;
    if (!rowMain) return;

    // Build inline input overlay
    const renameWrapper = createElement(doc, "div", "llm-history-rename-wrapper");
    const input = createElement(doc, "input", "llm-history-rename-input", {
      type: "text",
      value: entry.title,
      placeholder: "Conversation name…",
      maxLength: 64,
    }) as HTMLInputElement;

    const confirmRename = async () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== entry.title) {
        try {
          if (historyKind === "global") {
            await renameGlobalConversation(conversationKey, newTitle);
          } else {
            await renamePaperConversation(conversationKey, newTitle);
          }
        } catch (err) {
          ztoolkit.log("LLM: Failed to rename conversation", err);
        }
      }
      renameWrapper.remove();
      rowMain.style.display = "";
      await refreshGlobalHistoryHeader();
    };

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void confirmRename();
      } else if (e.key === "Escape") {
        e.preventDefault();
        renameWrapper.remove();
        rowMain.style.display = "";
      }
    });
    input.addEventListener("blur", () => {
      // Small delay to allow click on confirm button
      getWindowTimeout(() => {
        if (renameWrapper.isConnected) {
          void confirmRename();
        }
      }, 150);
    });

    const okBtn = createElement(doc, "button", "llm-history-rename-ok", {
      type: "button",
      textContent: "✓",
      title: "Confirm rename",
    }) as HTMLButtonElement;
    okBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void confirmRename();
    });

    renameWrapper.append(input, okBtn);
    rowMain.style.display = "none";
    // Insert after rowMain
    rowMain.insertAdjacentElement("afterend", renameWrapper);
    // Use a timeout to focus after DOM paint
    getWindowTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  };


  // ── Paper conversation switching (Reader multi-history) ──
  const switchPaperConversation = async (nextPaperKey: number) => {
    if (!item) return;
    activePaperConversationByItem.set(item.id, nextPaperKey);
    syncConversationIdentity();
    activeEditSession = null;
    closePaperPicker();
    closePromptMenu();
    closeResponseMenu();
    closeRetryModelMenu();
    closeExportMenu();
    closeHistoryMenu();
    await ensureConversationLoaded(item);
    refreshChatPreservingScroll();
    resetComposePreviewUI();
    updateModelButton();
    void refreshGlobalHistoryHeader();
  };

  const clearAndRestartPaperConversation = async () => {
    if (!item) return;
    if (isPanelGenerating(body) || historyNewBtn?.disabled) {
      if (status) {
        setStatus(
          status,
          "Wait for the current response to finish before starting a new chat",
          "ready"
        );
      }
      return;
    }

    const currentItemId = item.id;

    // Check if the current paper conversation is empty (no user turns).
    // If so, just reuse it instead of creating a new one.
    const currentPaperKey = activePaperConversationByItem.get(currentItemId);
    if (currentPaperKey && currentPaperKey > 0) {
      try {
        const turnCount = await getPaperConversationUserTurnCount(currentPaperKey);
        if (turnCount === 0) {
          // Already an empty conversation — just clear compose state and refocus.
          clearTransientComposeStateForItem(currentItemId, currentPaperKey);
          resetComposePreviewUI();
          clearDraftInput();
          clearComposeState();
          if (status) setStatus(status, "Reused existing empty paper chat", "ready");
          if (inputBox) inputBox.focus({ preventScroll: true });
          return;
        }
      } catch (err) {
        ztoolkit.log("LLM: Failed to check paper conversation turn count", err);
      }
    }

    // Create a new paper conversation for this PDF item.
    let newKey = 0;
    try {
      newKey = await createPaperConversation(currentItemId);
    } catch (err) {
      ztoolkit.log("LLM: Failed to create new paper conversation", err);
    }
    if (!newKey) {
      if (status) setStatus(status, "Failed to create new paper conversation", "error");
      return;
    }

    clearTransientComposeStateForItem(
      currentItemId,
      currentPaperKey || currentItemId,
    );
    resetComposePreviewUI();
    closeHistoryMenu();
    closeExportMenu();
    closePromptMenu();
    closePaperPicker();
    clearDraftInput();
    clearComposeState();
    activeEditSession = null;

    await switchPaperConversation(newKey);

    if (status) setStatus(status, "Started new paper chat", "ready");
    if (inputBox) inputBox.focus({ preventScroll: true });
  };

  const createAndSwitchGlobalConversation = async () => {
    if (!item) return;
    if (isPanelGenerating(body) || historyNewBtn?.disabled) {
      if (status) {
        setStatus(
          status,
          "Wait for the current response to finish before starting a new chat",
          "ready",
        );
      }
      return;
    }
    const libraryID = getCurrentLibraryID();
    if (!libraryID) {
      if (status) {
        setStatus(status, "No active library for global conversation", "error");
      }
      return;
    }

    let targetConversationKey = 0;
    let reuseReason: "active-draft" | "latest-draft" | null = null;

    const currentCandidate = isGlobalMode()
      ? getConversationKey(item)
      : Number(activeGlobalConversationByLibrary.get(libraryID) || 0);
    const normalizedCurrentCandidate = Number.isFinite(currentCandidate)
      ? Math.floor(currentCandidate)
      : 0;
    if (normalizedCurrentCandidate > 0) {
      try {
        const turnCount = await getGlobalConversationUserTurnCount(
          normalizedCurrentCandidate,
        );
        if (turnCount === 0) {
          targetConversationKey = normalizedCurrentCandidate;
          reuseReason = "active-draft";
        }
      } catch (err) {
        ztoolkit.log(
          "LLM: Failed to inspect active candidate for draft reuse",
          err,
        );
      }
    }

    if (targetConversationKey <= 0) {
      try {
        const latestEmpty = await getLatestEmptyGlobalConversation(libraryID);
        const latestEmptyKey = Number(latestEmpty?.conversationKey || 0);
        if (Number.isFinite(latestEmptyKey) && latestEmptyKey > 0) {
          targetConversationKey = Math.floor(latestEmptyKey);
          reuseReason = "latest-draft";
        }
      } catch (err) {
        ztoolkit.log("LLM: Failed to load latest empty global conversation", err);
      }
    }

    if (targetConversationKey <= 0) {
      try {
        targetConversationKey = await createGlobalConversation(libraryID);
      } catch (err) {
        ztoolkit.log("LLM: Failed to create new global conversation", err);
      }
      reuseReason = null;
    }
    if (!targetConversationKey) {
      if (status) setStatus(status, "Failed to create conversation", "error");
      return;
    }

    ztoolkit.log("LLM: + conversation action", {
      libraryID,
      targetConversationKey,
      action: reuseReason ? "reuse" : "create",
      reason: reuseReason || "new",
    });
    activeGlobalConversationByLibrary.set(libraryID, targetConversationKey);
    await switchGlobalConversation(targetConversationKey);
    if (status) {
      setStatus(
        status,
        reuseReason
          ? "Reused existing new conversation"
          : "Started new conversation",
        "ready",
      );
    }

    // Auto-attach the currently open PDF as paper context.
    // Prefer the panel's own item (correct for this reader tab) over the
    // global active-tab query, which may return a different reader's PDF
    // when multiple reader tabs are open.
    try {
      const panelAttachment =
        item?.isAttachment?.() &&
        item.attachmentContentType === "application/pdf"
          ? item
          : null;
      const activeAttachment =
        panelAttachment || getActiveContextAttachmentFromTabs();
      if (activeAttachment) {
        const paperRef = resolvePaperContextRefFromAttachment(activeAttachment);
        if (paperRef) {
          upsertPaperContext(paperRef);
        }
      }
    } catch (err) {
      ztoolkit.log("LLM: Failed to auto-attach paper context on new chat", err);
    }

    inputBox.focus({ preventScroll: true });
  };

  if (historyNewBtn) {
    historyNewBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (tabType === "reader") {
        void clearAndRestartPaperConversation();
      } else {
        void createAndSwitchGlobalConversation();
      }
    });
  }

  // New chat button in the action bar (same as historyNewBtn)
  if (newChatBtn) {
    newChatBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (tabType === "reader") {
        void clearAndRestartPaperConversation();
      } else {
        void createAndSwitchGlobalConversation();
      }
    });
  }

  if (historyUndoBtn) {
    historyUndoBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      void undoPendingHistoryDeletion();
    });
  }

  if (historyToggleBtn && historyMenu) {
    historyToggleBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      void (async () => {
        closeModelMenu();
        closeRetryModelMenu();
        closeSlashMenu();
        closeResponseMenu();
        closePromptMenu();
        closeExportMenu();
        await refreshGlobalHistoryHeader();
        // Allow opening even when empty — shows an empty menu state
        if (isHistoryMenuOpen()) {
          closeHistoryMenu();
          return;
        }
        renderGlobalHistoryMenu();
        positionMenuBelowButton(body, historyMenu, historyToggleBtn);
        historyMenu.style.display = "flex";
        historyToggleBtn.setAttribute("aria-expanded", "true");
      })();
    });
  }

  if (historyMenu) {
    historyMenu.addEventListener("click", (e: Event) => {
      const target = e.target as Element | null;
      if (!target || !item) return;
      const isGenerating =
        isPanelGenerating(body) || Boolean(historyNewBtn?.disabled);

      const deleteBtn = target.closest(
        ".llm-history-row-delete",
      ) as HTMLButtonElement | null;
      if (deleteBtn) {
        if (isGenerating) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const row = deleteBtn.closest(".llm-history-menu-row") as
          | HTMLDivElement
          | null;
        if (!row) return;
        e.preventDefault();
        e.stopPropagation();
        const parsedConversationKey = Number.parseInt(
          row.dataset.conversationKey || "",
          10,
        );
        if (
          !Number.isFinite(parsedConversationKey) ||
          parsedConversationKey <= 0
        ) {
          return;
        }
        const historyKind = row.dataset.historyKind === "paper" ? "paper" : "global";
        const entry = findHistoryEntryByKey(historyKind, parsedConversationKey);
        if (!entry || !entry.deletable) return;
        void queueHistoryDeletion(entry);
        return;
      }

      // Pin toggle button
      const pinBtn = target.closest(
        ".llm-history-row-pin",
      ) as HTMLButtonElement | null;
      if (pinBtn) {
        e.preventDefault();
        e.stopPropagation();
        const row = pinBtn.closest(".llm-history-menu-row") as HTMLDivElement | null;
        if (!row) return;
        const parsedKey = Number.parseInt(row.dataset.conversationKey || "", 10);
        if (!Number.isFinite(parsedKey) || parsedKey <= 0) return;
        const hKind = row.dataset.historyKind === "paper" ? "paper" : "global";
        void togglePinConversation(hKind, parsedKey);
        return;
      }

      // Rename button
      const renameBtn = target.closest(
        ".llm-history-row-rename",
      ) as HTMLButtonElement | null;
      if (renameBtn) {
        e.preventDefault();
        e.stopPropagation();
        const row = renameBtn.closest(".llm-history-menu-row") as HTMLDivElement | null;
        if (!row) return;
        const parsedKey = Number.parseInt(row.dataset.conversationKey || "", 10);
        if (!Number.isFinite(parsedKey) || parsedKey <= 0) return;
        const hKind = row.dataset.historyKind === "paper" ? "paper" : "global";
        startInlineRename(hKind, parsedKey, row);
        return;
      }

      const deleteAllBtn = target.closest(
        ".llm-history-delete-all",
      ) as HTMLButtonElement | null;
      if (deleteAllBtn) {
        if (isGenerating) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        void deleteAllVisibleHistory();
        return;
      }

      const rowMain = target.closest(
        ".llm-history-menu-row-main",
      ) as HTMLButtonElement | null;
      if (!rowMain) return;
      if (isGenerating) {
        e.preventDefault();
        e.stopPropagation();
        closeHistoryMenu();
        if (status) {
          setStatus(status, "Wait for the response to finish before switching", "ready");
        }
        return;
      }
      const row = rowMain.closest(".llm-history-menu-row") as HTMLDivElement | null;
      if (!row) return;
      e.preventDefault();
      e.stopPropagation();
      const parsedConversationKey = Number.parseInt(
        row.dataset.conversationKey || "",
        10,
      );
      if (!Number.isFinite(parsedConversationKey) || parsedConversationKey <= 0) {
        return;
      }
      const historyKind = row.dataset.historyKind === "paper" ? "paper" : "global";
      void (async () => {
        if (historyKind === "paper") {
          await switchPaperConversation(parsedConversationKey);
        } else {
          await switchGlobalConversation(parsedConversationKey);
        }
        if (status) setStatus(status, i18n.conversationLoaded, "ready");
      })();
    });
  }


  // Model selection is delegated to modelSelectionController.ts
  const getSelectedModelInfo = () => getSelectedModelInfoFromController(item?.id ?? null);

  type ActionLabelMode = "icon" | "full";
  type ModelLabelMode = "icon" | "full-single" | "full-wrap2";
  type ActionLayoutMode = "icon" | "half" | "full";
  type ActionRevealState = {
    send: ActionLabelMode;
    model: ModelLabelMode;
    screenshot: ActionLabelMode;
    selectText: ActionLabelMode;
  };

  const setActionButtonLabel = (
    button: HTMLButtonElement | null,
    expandedLabel: string,
    compactLabel: string,
    mode: ActionLabelMode,
  ) => {
    if (!button) return;
    const nextLabel = mode === "icon" ? compactLabel : expandedLabel;
    if (button.textContent !== nextLabel) {
      button.textContent = nextLabel;
    }
    button.classList.toggle("llm-action-icon-only", mode === "icon");
  };

  const setSendButtonLabel = (mode: ActionLabelMode) => {
    setActionButtonLabel(sendBtn, "Send", "↑", mode);
    sendBtn.title = "Send";
    setActionButtonLabel(cancelBtn, "Cancel", "X", mode);
    if (cancelBtn) {
      cancelBtn.title = "Cancel";
    }
  };

  const setPanelActionLayoutMode = (mode: ActionLayoutMode) => {
    if (panelRoot.dataset.llmActionLayoutMode !== mode) {
      panelRoot.dataset.llmActionLayoutMode = mode;
    }
  };

  let layoutRetryScheduled = false;
  const applyResponsiveActionButtonsLayout = () => {
    if (!modelBtn || !actionsLeft) return;
    const modelLabel = modelBtn.dataset.modelLabel || "default";
    const modelHint = modelBtn.dataset.modelHint || "";
    const modelCanUseTwoLineWrap =
      [...(modelLabel || "").trim()].length >
      ACTION_LAYOUT_MODEL_WRAP_MIN_CHARS;
    const immediateAvailableWidth = (() => {
      const rowWidth = actionsRow?.clientWidth || 0;
      if (rowWidth > 0) return rowWidth;
      const leftWidth = actionsLeft.clientWidth || 0;
      if (leftWidth > 0) return leftWidth;
      return panelRoot?.clientWidth || 0;
    })();
    if (immediateAvailableWidth <= 0) {
      const view = body.ownerDocument?.defaultView;
      if (view && !layoutRetryScheduled) {
        layoutRetryScheduled = true;
        view.requestAnimationFrame(() => {
          layoutRetryScheduled = false;
          applyResponsiveActionButtonsLayout();
        });
      }
      return;
    }

    const getComputedSizePx = (
      style: CSSStyleDeclaration | null | undefined,
      property: string,
      fallback = 0,
    ) => {
      if (!style) return fallback;
      const value = Number.parseFloat(style.getPropertyValue(property));
      return Number.isFinite(value) ? value : fallback;
    };

    const textMeasureContext = (() => {
      const canvas = body.ownerDocument?.createElement(
        "canvas",
      ) as HTMLCanvasElement | null;
      return (
        (canvas?.getContext("2d") as CanvasRenderingContext2D | null) || null
      );
    })();

    const measureLabelTextWidth = (
      button: HTMLButtonElement | null,
      label: string,
    ) => {
      if (!button || !label) return 0;
      const view = body.ownerDocument?.defaultView;
      const style = view?.getComputedStyle(button);
      if (textMeasureContext && style) {
        const font =
          style.font && style.font !== ""
            ? style.font
            : `${style.fontWeight || "400"} ${style.fontSize || "12px"} ${style.fontFamily || "sans-serif"}`;
        textMeasureContext.font = font;
        return textMeasureContext.measureText(label).width;
      }
      return label.length * 8;
    };

    const getElementGapPx = (element: HTMLElement | null) => {
      if (!element) return 0;
      const view = body.ownerDocument?.defaultView;
      const style = view?.getComputedStyle(element);
      const columnGap = getComputedSizePx(style, "column-gap", NaN);
      if (Number.isFinite(columnGap)) return columnGap;
      return getComputedSizePx(style, "gap", 0);
    };

    const getButtonNaturalWidth = (
      button: HTMLButtonElement | null,
      label: string,
      maxLines = 1,
    ) => {
      if (!button) return 0;
      const view = body.ownerDocument?.defaultView;
      const style = view?.getComputedStyle(button);
      const textWidth = measureLabelTextWidth(button, label);
      const normalizedMaxLines = Math.max(1, Math.floor(maxLines));
      const wrappedTextWidth =
        normalizedMaxLines > 1
          ? (() => {
              const segments = label
                .split(/[\s._-]+/g)
                .map((segment) => segment.trim())
                .filter(Boolean);
              const longestSegmentWidth = segments.reduce((max, segment) => {
                return Math.max(max, measureLabelTextWidth(button, segment));
              }, 0);
              return Math.max(
                textWidth / normalizedMaxLines,
                longestSegmentWidth,
              );
            })()
          : textWidth;
      const paddingWidth =
        getComputedSizePx(style, "padding-left") +
        getComputedSizePx(style, "padding-right");
      const borderWidth =
        getComputedSizePx(style, "border-left-width") +
        getComputedSizePx(style, "border-right-width");
      const chevronAllowance = button === modelBtn ? 16 : 0;
      return Math.ceil(
        wrappedTextWidth + paddingWidth + borderWidth + chevronAllowance,
      );
    };

    const getSlotWidthBounds = (slot: HTMLElement | null) => {
      const view = body.ownerDocument?.defaultView;
      const style = slot ? view?.getComputedStyle(slot) : null;
      const minWidth = getComputedSizePx(style, "min-width", 0);
      const maxRaw = getComputedSizePx(
        style,
        "max-width",
        Number.POSITIVE_INFINITY,
      );
      const maxWidth = Number.isFinite(maxRaw)
        ? maxRaw
        : Number.POSITIVE_INFINITY;
      return { minWidth, maxWidth };
    };

    const getFullSlotRequiredWidth = (
      slot: HTMLElement | null,
      button: HTMLButtonElement | null,
      label: string,
      maxLines = 1,
    ) => {
      if (!button) return 0;
      const naturalWidth = getButtonNaturalWidth(button, label, maxLines);
      if (!slot) return naturalWidth;
      const { minWidth, maxWidth } = getSlotWidthBounds(slot);
      return Math.min(maxWidth, Math.max(minWidth, naturalWidth));
    };

    const getRenderedWidthPx = (
      element: HTMLElement | null,
      fallback: number,
    ) => {
      const width = element?.getBoundingClientRect?.().width || 0;
      return width > 0 ? Math.ceil(width) : fallback;
    };

    const getAvailableRowWidth = () => {
      const hostWidth = Math.ceil(
        (body as HTMLElement | null)?.getBoundingClientRect?.().width || 0,
      );
      const rowWidth = actionsRow?.clientWidth || 0;
      if (rowWidth > 0)
        return hostWidth > 0 ? Math.min(rowWidth, hostWidth) : rowWidth;
      const panelWidth = panelRoot?.clientWidth || 0;
      if (panelWidth > 0)
        return hostWidth > 0 ? Math.min(panelWidth, hostWidth) : panelWidth;
      const leftWidth = actionsLeft.clientWidth || 0;
      if (leftWidth > 0)
        return hostWidth > 0 ? Math.min(leftWidth, hostWidth) : leftWidth;
      return hostWidth;
    };

    const uploadSlot = uploadBtn?.parentElement as HTMLElement | null;
    const selectTextSlot = selectTextBtn?.parentElement as HTMLElement | null;
    const screenshotSlot = screenshotBtn?.parentElement as HTMLElement | null;
    const sendSlot = sendBtn?.parentElement as HTMLElement | null;

    const getModelWidth = (mode: ModelLabelMode) => {
      if (!modelBtn) return 0;
      if (mode === "icon") return ACTION_LAYOUT_DROPDOWN_ICON_WIDTH_PX;
      const maxLines =
        mode === "full-wrap2" ? ACTION_LAYOUT_MODEL_FULL_MAX_LINES : 1;
      return getFullSlotRequiredWidth(
        modelSlot,
        modelBtn,
        modelLabel,
        maxLines,
      );
    };

    const getContextButtonWidth = (
      slot: HTMLElement | null,
      button: HTMLButtonElement | null,
      expandedLabel: string,
      mode: ActionLabelMode,
    ) => {
      if (!button) return 0;
      return mode === "full"
        ? getFullSlotRequiredWidth(slot, button, expandedLabel)
        : ACTION_LAYOUT_CONTEXT_ICON_WIDTH_PX;
    };

    const getSendWidth = (mode: ActionLabelMode) => {
      if (!sendBtn) return 0;
      if (mode === "icon") {
        return ACTION_LAYOUT_CONTEXT_ICON_WIDTH_PX;
      }
      const sendWidth = getFullSlotRequiredWidth(sendSlot, sendBtn, "Send");
      const cancelWidth = getFullSlotRequiredWidth(
        sendSlot,
        cancelBtn,
        "Cancel",
      );
      return Math.max(sendWidth, cancelWidth, 72);
    };

    const newChatSlotEl = newChatBtn?.parentElement as HTMLElement | null;

    const getRequiredWidth = (state: ActionRevealState) => {
      const leftSlotWidths = [
        newChatBtn
          ? getRenderedWidthPx(
              newChatSlotEl || newChatBtn,
              ACTION_LAYOUT_CONTEXT_ICON_WIDTH_PX,
            )
          : 0,
        uploadBtn
          ? getRenderedWidthPx(
              uploadSlot || uploadBtn,
              Math.max(
                uploadBtn.scrollWidth || 0,
                ACTION_LAYOUT_CONTEXT_ICON_WIDTH_PX,
              ),
            )
          : 0,
        // Screenshot is always icon-only
        screenshotBtn ? ACTION_LAYOUT_CONTEXT_ICON_WIDTH_PX : 0,
        getContextButtonWidth(
          selectTextSlot,
          selectTextBtn,
          i18n.addText,
          state.selectText,
        ),
        getModelWidth(state.model),
      ].filter((width) => width > 0);
      const leftGap = getElementGapPx(actionsLeft);
      const leftRequiredWidth =
        leftSlotWidths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, leftSlotWidths.length - 1) * leftGap;
      const rightRequiredWidth = getSendWidth(state.send);
      const rowGap = getElementGapPx(actionsRow);
      return leftRequiredWidth + rightRequiredWidth + rowGap;
    };

    const doesStateFit = (state: ActionRevealState) =>
      getAvailableRowWidth() + 1 >= getRequiredWidth(state);

    const getPanelLayoutMode = (state: ActionRevealState): ActionLayoutMode => {
      if (state.selectText === "full") {
        return "full";
      }
      if (
        state.screenshot === "full" ||
        state.model !== "icon"
      ) {
        return "half";
      }
      return "icon";
    };

    const applyMeasurementBaseline = () => {
      // Normalize controls into a stable full-text style before measuring.
      // This keeps width estimation independent from the currently rendered
      // icon/full state and prevents flip-flopping around thresholds.
      setActionButtonLabel(
        uploadBtn,
        UPLOAD_FILE_EXPANDED_LABEL,
        UPLOAD_FILE_COMPACT_LABEL,
        "icon",
      );
      setActionButtonLabel(
        selectTextBtn,
        i18n.addText,
        SELECT_TEXT_COMPACT_LABEL,
        "full",
      );
      setActionButtonLabel(
        screenshotBtn,
        SCREENSHOT_EXPANDED_LABEL,
        SCREENSHOT_COMPACT_LABEL,
        "icon",
      );
      setSendButtonLabel("full");

      modelBtn.classList.toggle("llm-model-btn-collapsed", false);
      modelSlot?.classList.toggle("llm-model-dropdown-collapsed", false);
      modelBtn.classList.toggle("llm-model-btn-wrap-2line", false);
      modelBtn.textContent = modelLabel;
      modelBtn.title = modelHint;

    };

    const applyState = (state: ActionRevealState) => {
      setActionButtonLabel(
        uploadBtn,
        UPLOAD_FILE_EXPANDED_LABEL,
        UPLOAD_FILE_COMPACT_LABEL,
        "icon",
      );
      setActionButtonLabel(
        selectTextBtn,
        i18n.addText,
        SELECT_TEXT_COMPACT_LABEL,
        state.selectText,
      );
      setActionButtonLabel(
        screenshotBtn,
        i18n.screenshots,
        SCREENSHOT_COMPACT_LABEL,
        "icon",
      );
      setSendButtonLabel(state.send);

      const modelCollapsed = state.model === "icon";
      modelBtn.classList.toggle("llm-model-btn-collapsed", modelCollapsed);
      modelSlot?.classList.toggle(
        "llm-model-dropdown-collapsed",
        modelCollapsed,
      );
      modelBtn.classList.toggle(
        "llm-model-btn-wrap-2line",
        state.model === "full-wrap2",
      );
      if (modelCollapsed) {
        modelBtn.textContent = "";
        modelBtn.title = modelHint ? `${modelLabel}\n${modelHint}` : modelLabel;
      } else {
        modelBtn.textContent = modelLabel;
        modelBtn.title = modelHint;
      }

      setPanelActionLayoutMode(getPanelLayoutMode(state));
    };

    const widestState: ActionRevealState = {
      send: "full",
      model: "full-single",
      screenshot: "full",
      selectText: "full",
    };
    const screenshotState: ActionRevealState = {
      send: "full",
      model: "full-single",
      screenshot: "full",
      selectText: "icon",
    };
    const modelState: ActionRevealState = {
      send: "full",
      model: "full-single",
      screenshot: "icon",
      selectText: "icon",
    };
    const sendState: ActionRevealState = {
      send: "full",
      model: "icon",
      screenshot: "icon",
      selectText: "icon",
    };
    const iconOnlyState: ActionRevealState = {
      send: "icon",
      model: "icon",
      screenshot: "icon",
      selectText: "icon",
    };

    // Reveal order as width grows:
    // send/cancel -> model -> screenshots -> add text.
    const candidateStates: ActionRevealState[] = [
      widestState,
      screenshotState,
      modelState,
      sendState,
      iconOnlyState,
    ];

    if (modelCanUseTwoLineWrap) {
      candidateStates.splice(
        1,
        0,
        { ...widestState, model: "full-wrap2" },
        { ...screenshotState, model: "full-wrap2" },
        { ...modelState, model: "full-wrap2" },
      );
    }

    applyMeasurementBaseline();
    for (const state of candidateStates) {
      if (!doesStateFit(state)) continue;
      applyState(state);
      return;
    }

    applyState(iconOnlyState);
  };

  const updateModelButton = () => {
    if (!item || !modelBtn) return;
    withScrollGuard(chatBox, conversationKey, () => {
      const { choices, currentModel } = getSelectedModelInfo();
      const hasSecondary = choices.length > 1;
      const hasModels = choices.length > 0 && Boolean(currentModel.trim());
      modelBtn.dataset.modelLabel = hasModels ? currentModel : "No models";
      modelBtn.dataset.modelHint = hasModels
        ? hasSecondary
          ? i18n.modelClickChoose
          : i18n.modelOnlyOne
        : i18n.modelNoModels;
      modelBtn.disabled = !item || !hasModels;
      applyResponsiveActionButtonsLayout();
      updateImagePreview();
    });
  };

  const isPrimaryPointerEvent = (e: Event): boolean => {
    const me = e as MouseEvent;
    return typeof me.button !== "number" || me.button === 0;
  };

  const appendDropdownInstruction = (
    menu: HTMLDivElement,
    text: string,
    className: string,
  ) => {
    const hint = createElement(
      body.ownerDocument as Document,
      "div",
      className,
      {
        textContent: text,
      },
    );
    hint.setAttribute("aria-hidden", "true");
    menu.appendChild(hint);
  };

  const rebuildModelMenu = () => {
    if (!item || !modelMenu) return;
    const { choices } = getModelChoices();
    const { currentModel, currentProvider } = getSelectedModelInfo();

    modelMenu.innerHTML = "";
    appendDropdownInstruction(
      modelMenu,
      i18n.modelSelectHint,
      "llm-model-menu-hint",
    );
    if (!choices.length) {
      const empty = createElement(
        body.ownerDocument as Document,
        "div",
        "llm-model-menu-hint",
        { textContent: i18n.modelNoModels },
      );
      modelMenu.appendChild(empty);
      return;
    }

    // Group by provider and render with headers
    let lastProvider = "";
    for (const entry of choices) {
      // Insert provider header when provider changes
      const providerLabel = entry.provider || "";
      if (providerLabel && providerLabel !== lastProvider) {
        lastProvider = providerLabel;
        const header = createElement(
          body.ownerDocument as Document,
          "div",
          "llm-model-provider-header",
          { textContent: providerLabel },
        );
        modelMenu.appendChild(header);
      }

      // Match selection by model name + provider to handle same-name models across providers
      const isSelected =
        entry.model.trim().toLowerCase() === currentModel.trim().toLowerCase()
        && (entry.provider || "").toLowerCase() === (currentProvider || "").toLowerCase();
      const optionClasses = isSelected
        ? "llm-response-menu-item llm-model-option llm-model-option-selected"
        : "llm-response-menu-item llm-model-option";
      const option = createElement(
        body.ownerDocument as Document,
        "button",
        optionClasses,
        {
          type: "button",
          textContent: isSelected
            ? `✓  ${entry.model}`
            : `    ${entry.model}`,
        },
      );
      const applyModelSelection = (e: Event) => {
        if (!isPrimaryPointerEvent(e)) return;
        e.preventDefault();
        e.stopPropagation();
        if (!item) return;
        // Store the model name and provider ID for the current item
        selectedModelCache.set(item.id, entry.model);
        if (entry.providerId) selectedModelProviderCache.set(item.id, entry.providerId);
        // Persist model name and provider ID so new conversations remember it
        persistModelName(entry.model);
        if (entry.providerId) persistModelProvider(entry.providerId);
        // Clear the persisted profile key so it doesn't shadow the in-session choice
        try {
          Zotero.Prefs.set(
            `${addon.data.config.prefsPrefix}.lastUsedModelProfile`,
            "",
            true,
          );
        } catch { /* ignore */ }
        setFloatingMenuOpen(modelMenu, MODEL_MENU_OPEN_CLASS, false);
        updateModelButton();
      };
      option.addEventListener("pointerdown", applyModelSelection);
      option.addEventListener("click", applyModelSelection);
      modelMenu.appendChild(option);
    }
  };

  const rebuildRetryModelMenu = () => {
    if (!item || !retryModelMenu) return;
    const { choices } = getModelChoices();
    const { currentModel, currentProvider } = getSelectedModelInfo();
    retryModelMenu.innerHTML = "";

    // Group by provider with headers
    let lastProvider = "";
    for (const entry of choices) {
      const providerLabel = entry.provider || "";
      if (providerLabel && providerLabel !== lastProvider) {
        lastProvider = providerLabel;
        const header = createElement(
          body.ownerDocument as Document,
          "div",
          "llm-model-provider-header",
          { textContent: providerLabel },
        );
        retryModelMenu.appendChild(header);
      }

      const isSelected =
        entry.model.trim().toLowerCase() === currentModel.trim().toLowerCase()
        && (entry.provider || "").toLowerCase() === (currentProvider || "").toLowerCase();
      const optionClasses = isSelected
        ? "llm-response-menu-item llm-model-option llm-model-option-selected"
        : "llm-response-menu-item llm-model-option";
      const option = createElement(
        body.ownerDocument as Document,
        "button",
        optionClasses,
        {
          type: "button",
          textContent: isSelected
            ? `✓  ${entry.model}`
            : `    ${entry.model}`,
        },
      );
      const runRetry = async (e: Event) => {
        if (!isPrimaryPointerEvent(e)) return;
        e.preventDefault();
        e.stopPropagation();
        if (!item) return;
        closeRetryModelMenu();
        // Sync model selection with the bottom model selector
        selectedModelCache.set(item.id, entry.model);
        if (entry.providerId) selectedModelProviderCache.set(item.id, entry.providerId);
        persistModelName(entry.model);
        if (entry.providerId) persistModelProvider(entry.providerId);
        try {
          Zotero.Prefs.set(
            `${addon.data.config.prefsPrefix}.lastUsedModelProfile`,
            "",
            true,
          );
        } catch { /* ignore */ }
        updateModelButton();
        // Get resolved profile for the now-selected model
        const resolvedProfile = getSelectedProfileForItem(item.id);
        const retryAdvanced = getAdvancedModelParams(entry.key);
        await retryLatestAssistantResponse(
          body,
          item,
          entry.model,
          resolvedProfile.apiBase,
          resolvedProfile.apiKey,
          retryAdvanced,
        );
      };
      option.addEventListener("click", (e: Event) => {
        void runRetry(e);
      });
      retryModelMenu.appendChild(option);
    }
  };

  const syncModelFromPrefs = () => {
    updateModelButton();
    if (isFloatingMenuOpen(modelMenu)) {
      rebuildModelMenu();
    }
  };

  // Initialize preview state
  updatePaperPreviewPreservingScroll();
  updateFilePreviewPreservingScroll();
  updateImagePreviewPreservingScroll();
  updateSelectedTextPreviewPreservingScroll();
  syncModelFromPrefs();
  void refreshGlobalHistoryHeader();

  // ── Draft input persistence ──
  const DRAFT_PREF_PREFIX = "extensions.AIdea.draftInput.";
  let draftSaveTimer: ReturnType<typeof setTimeout> | null = null;

  const saveDraftInput = () => {
    if (!conversationKey) return;
    const text = inputBox.value || "";
    draftInputCache.set(conversationKey, text);
    try {
      Zotero.Prefs.set(`${DRAFT_PREF_PREFIX}${conversationKey}`, text);
    } catch (_) { /* pref write failure is non-critical */ }
  };

  const clearDraftInput = () => {
    if (draftSaveTimer) { clearTimeout(draftSaveTimer); draftSaveTimer = null; }
    if (!conversationKey) return;
    draftInputCache.delete(conversationKey);
    try {
      Zotero.Prefs.clear(`${DRAFT_PREF_PREFIX}${conversationKey}`);
    } catch (_) { /* pref clear failure is non-critical */ }
  };

  const scheduleDraftSave = () => {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(saveDraftInput, 600);
  };

  // Restore draft on init
  if (conversationKey && inputBox) {
    let draft = draftInputCache.get(conversationKey) || "";
    if (!draft) {
      try {
        draft = (Zotero.Prefs.get(`${DRAFT_PREF_PREFIX}${conversationKey}`) as string) || "";
      } catch (_) { /* ignore */ }
    }
    if (draft) {
      inputBox.value = draft;
    }
  }

  // Save draft on input changes
  inputBox.addEventListener("input", scheduleDraftSave);

  // ── Compose state persistence (files, screenshots, papers) ──
  const COMPOSE_PREF_PREFIX = "extensions.AIdea.composeState.";
  let composeStateSaveTimer: ReturnType<typeof setTimeout> | null = null;

  const saveComposeState = () => {
    if (!conversationKey || !item) return;
    try {
      const files = (selectedFileAttachmentCache.get(item.id) || []).map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        storedPath: f.storedPath,
        sizeBytes: f.sizeBytes,
        category: f.category,
        contentHash: f.contentHash,
      }));
      const screenshots = selectedImageCache.get(item.id) || [];
      const papers = normalizePaperContextEntries(
        selectedPaperContextCache.get(item.id) || [],
      );
      const textContextKey = getTextContextConversationKey();
      const textContexts = textContextKey
        ? getSelectedTextContextEntries(textContextKey)
        : [];
      const snapshot = JSON.stringify({ files, screenshots, papers, textContexts });
      Zotero.Prefs.set(`${COMPOSE_PREF_PREFIX}${conversationKey}`, snapshot);
    } catch (_) { /* non-critical */ }
  };

  const clearComposeState = () => {
    if (composeStateSaveTimer) { clearTimeout(composeStateSaveTimer); composeStateSaveTimer = null; }
    if (!conversationKey) return;
    try {
      Zotero.Prefs.clear(`${COMPOSE_PREF_PREFIX}${conversationKey}`);
    } catch (_) { /* non-critical */ }
  };

  const scheduleComposeStateSave = () => {
    if (composeStateSaveTimer) clearTimeout(composeStateSaveTimer);
    composeStateSaveTimer = setTimeout(saveComposeState, 800);
  };

  // Restore compose state from Prefs on init (overrides message-based restore)
  if (conversationKey && item) {
    try {
      const raw = Zotero.Prefs.get(`${COMPOSE_PREF_PREFIX}${conversationKey}`) as string;
      if (raw) {
        const snapshot = JSON.parse(raw) as {
          files?: ChatAttachment[];
          screenshots?: string[];
          papers?: PaperContextRef[];
          textContexts?: SelectedTextContext[];
        };
        if (Array.isArray(snapshot.files) && snapshot.files.length) {
          selectedFileAttachmentCache.set(item.id, snapshot.files);
        }
        if (Array.isArray(snapshot.screenshots) && snapshot.screenshots.length) {
          selectedImageCache.set(item.id, snapshot.screenshots);
        }
        if (Array.isArray(snapshot.papers) && snapshot.papers.length) {
          selectedPaperContextCache.set(item.id, snapshot.papers);
        }
        const textContextKey = getTextContextConversationKey();
        if (
          textContextKey &&
          Array.isArray(snapshot.textContexts) &&
          snapshot.textContexts.length
        ) {
          setSelectedTextContextEntries(textContextKey, snapshot.textContexts);
        }
      }
    } catch (_) { /* ignore parse errors */ }
  }

  // Wire compose-state persistence hook now that scheduleComposeStateSave is defined.
  composeHook.save = scheduleComposeStateSave;

  // Re-render previews with data restored from compose-state snapshot.
  // The initial render at the top of setupHandlers runs before the Prefs
  // snapshot is loaded, so a second pass is needed.
  updatePaperPreviewPreservingScroll();
  updateFilePreviewPreservingScroll();
  updateImagePreviewPreservingScroll();
  updateSelectedTextPreviewPreservingScroll();

  // Preferences can change outside this panel (e.g., settings window).
  // Re-sync model label when the user comes back (pointerenter).
  // NOTE: We intentionally do NOT sync on "focusin" because focusin fires
  // on every internal focus change (e.g. clicking the input box).
  // syncModelFromPrefs → updateModelButton → applyResponsiveActionButtonsLayout
  // mutates DOM → changes flex layout → resizes .llm-messages → shifts scroll
  // position.  pointerenter is sufficient and fires before interaction.
  body.addEventListener("pointerenter", () => {
    withScrollGuard(chatBox, conversationKey, syncModelFromPrefs);
  });
  const ResizeObserverCtor = body.ownerDocument?.defaultView?.ResizeObserver;
  if (ResizeObserverCtor && panelRoot && modelBtn) {
    const ro = new ResizeObserverCtor(() => {
      // Wrap layout mutations in scroll guard so that flex-driven
      // resize of .llm-messages doesn't corrupt the scroll snapshot.
      withScrollGuard(
        chatBox,
        conversationKey,
        () => {
          applyResponsiveActionButtonsLayout();
          syncUserContextAlignmentWidths(body);
        },
        "relative",
      );
    });
    ro.observe(panelRoot);
    if (actionsRow) ro.observe(actionsRow);
    if (actionsLeft) ro.observe(actionsLeft);
    if (chatBox) {
      const chatBoxResizeObserver = new ResizeObserverCtor(() => {
        if (!chatBox) return;
        if (!isChatViewportVisible(chatBox)) return;
        const previous = chatBoxViewportState;
        const current = buildChatBoxViewportState();
        if (!current) return;
        const viewportChanged = Boolean(
          previous &&
          (current.width !== previous.width ||
            current.height !== previous.height),
        );
        if (viewportChanged && previous && previous.nearBottom) {
          const targetBottom = Math.max(
            0,
            chatBox.scrollHeight - chatBox.clientHeight,
          );
          if (Math.abs(chatBox.scrollTop - targetBottom) > 1) {
            chatBox.scrollTop = chatBox.scrollHeight;
          }
          captureChatBoxViewportState();
          if (item && chatBox.childElementCount) {
            persistChatScrollSnapshot(item, chatBox);
          }
          return;
        }
        if (
          viewportChanged &&
          previous &&
          !previous.nearBottom &&
          previous.maxScrollTop > 0
        ) {
          const progress = Math.max(
            0,
            Math.min(1, previous.scrollTop / previous.maxScrollTop),
          );
          const targetScrollTop = Math.round(current.maxScrollTop * progress);
          if (Math.abs(chatBox.scrollTop - targetScrollTop) > 1) {
            chatBox.scrollTop = targetScrollTop;
          }
          captureChatBoxViewportState();
          if (item && chatBox.childElementCount) {
            persistChatScrollSnapshot(item, chatBox);
          }
          return;
        }
        chatBoxViewportState = current;
      });
      chatBoxResizeObserver.observe(chatBox);
    }
  }

  const getSelectedProfile = () => {
    if (!item) return null;
    return getSelectedProfileForItem(item.id);
  };

  const getAdvancedModelParams = (
    profileKey: ModelProfileKey | undefined,
  ): AdvancedModelParams | undefined => {
    if (!profileKey) return undefined;
    return getAdvancedModelParamsForProfile(profileKey);
  };

  const { processIncomingFiles } = createFileIntakeController({
    body,
    getItem: () => item,
    getCurrentModel: () => getSelectedModelInfo().currentModel,
    isScreenshotUnsupportedModel,
    optimizeImageDataUrl,
    persistAttachmentBlob,
    selectedImageCache,
    selectedFileAttachmentCache,
    updateImagePreview,
    updateFilePreview,
    scheduleAttachmentGc,
    setStatusMessage: status
      ? (message, level) => {
          setStatus(status, message, level);
        }
      : undefined,
    onFileStateChanged: (_itemId, fileIds) => {
      // In reader mode, file attachments are session-only and should not be
      // persisted into the shared conversation preference (which is also read
      // by library-paper mode).  Only persist for non-reader contexts.
      if (conversationKey !== null && tabType !== "reader") {
        persistFileAttachmentState(conversationKey, fileIds);
      }
    },
  });

  const setInputDropActive = (active: boolean) => {
    if (inputSection) {
      inputSection.classList.toggle("llm-input-drop-active", active);
    }
    if (inputBox) {
      inputBox.classList.toggle("llm-input-drop-active", active);
    }
  };

  type ActiveSlashToken = {
    query: string;
    slashStart: number;
    caretEnd: number;
  };
  type PaperPickerRow =
    | {
        kind: "paper";
        groupIndex: number;
      }
    | {
        kind: "attachment";
        groupIndex: number;
        attachmentIndex: number;
      };
  let paperPickerGroups: PaperSearchGroupCandidate[] = [];
  let paperPickerExpandedGroupKeys = new Set<number>();
  let paperPickerRows: PaperPickerRow[] = [];
  let paperPickerActiveRowIndex = 0;
  let paperPickerRequestSeq = 0;
  let paperPickerDebounceTimer: number | null = null;
  const getActiveSlashToken = (): ActiveSlashToken | null => {
    const caretEnd =
      typeof inputBox.selectionStart === "number"
        ? inputBox.selectionStart
        : inputBox.value.length;
    const prefix = inputBox.value.slice(0, caretEnd);
    const match = prefix.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) return null;
    const raw = match[0] || "";
    const fullStart = (match.index ?? prefix.length - raw.length) || 0;
    const slashStart = raw.startsWith(" ") ? fullStart + 1 : fullStart;
    return {
      query: sanitizeText(match[1] || "").trim(),
      slashStart,
      caretEnd,
    };
  };
  const isPaperPickerOpen = () =>
    Boolean(paperPicker && paperPicker.style.display !== "none");
  const closePaperPicker = () => {
    if (!paperPicker || !paperPickerList) return;
    paperPicker.style.display = "none";
    paperPickerGroups = [];
    paperPickerExpandedGroupKeys = new Set<number>();
    paperPickerRows = [];
    paperPickerActiveRowIndex = 0;
    paperPickerList.innerHTML = "";
  };
  const buildPaperMetaText = (paper: {
    citationKey?: string;
    firstCreator?: string;
    year?: string;
  }): string => {
    const parts = [
      paper.citationKey || "",
      paper.firstCreator || "",
      paper.year || "",
    ].filter(Boolean);
    return parts.join(" · ");
  };
  const getPaperPickerAttachmentDisplayTitle = (
    group: PaperSearchGroupCandidate,
    attachment: PaperSearchAttachmentCandidate,
    attachmentIndex: number,
  ): string => {
    const normalizedTitle = sanitizeText(attachment.title || "").trim();
    if (normalizedTitle) return normalizedTitle;
    return group.attachments.length > 1 ? `PDF ${attachmentIndex + 1}` : "PDF";
  };
  const getPaperPickerGroupKey = (group: PaperSearchGroupCandidate): number =>
    group.itemId;
  const isPaperPickerGroupExpanded = (
    group: PaperSearchGroupCandidate,
  ): boolean => {
    if (group.attachments.length <= 1) return false;
    return paperPickerExpandedGroupKeys.has(getPaperPickerGroupKey(group));
  };
  const rebuildPaperPickerRows = () => {
    const rows: PaperPickerRow[] = [];
    paperPickerGroups.forEach((group, groupIndex) => {
      rows.push({
        kind: "paper",
        groupIndex,
      });
      if (group.attachments.length <= 1) return;
      if (!isPaperPickerGroupExpanded(group)) return;
      group.attachments.forEach((_attachment, attachmentIndex) => {
        rows.push({
          kind: "attachment",
          groupIndex,
          attachmentIndex,
        });
      });
    });
    paperPickerRows = rows;
    if (!paperPickerRows.length) {
      paperPickerActiveRowIndex = 0;
      return;
    }
    paperPickerActiveRowIndex = Math.max(
      0,
      Math.min(paperPickerRows.length - 1, paperPickerActiveRowIndex),
    );
  };
  const getPaperPickerRowAt = (index: number): PaperPickerRow | null =>
    paperPickerRows[index] || null;
  const findPaperPickerPaperRowIndex = (groupIndex: number): number => {
    for (let index = 0; index < paperPickerRows.length; index += 1) {
      const row = paperPickerRows[index];
      if (row.kind === "paper" && row.groupIndex === groupIndex) {
        return index;
      }
    }
    return -1;
  };
  const findPaperPickerFirstAttachmentRowIndex = (groupIndex: number): number => {
    for (let index = 0; index < paperPickerRows.length; index += 1) {
      const row = paperPickerRows[index];
      if (row.kind === "attachment" && row.groupIndex === groupIndex) {
        return index;
      }
    }
    return -1;
  };
  const togglePaperPickerGroupExpanded = (
    groupIndex: number,
    expanded?: boolean,
  ): boolean => {
    const group = paperPickerGroups[groupIndex];
    if (!group || group.attachments.length <= 1) return false;
    const groupKey = getPaperPickerGroupKey(group);
    const currentlyExpanded = paperPickerExpandedGroupKeys.has(groupKey);
    const nextExpanded = expanded === undefined ? !currentlyExpanded : expanded;
    if (nextExpanded === currentlyExpanded) return false;
    if (nextExpanded) {
      paperPickerExpandedGroupKeys.add(groupKey);
    } else {
      paperPickerExpandedGroupKeys.delete(groupKey);
    }
    rebuildPaperPickerRows();
    return true;
  };
  const upsertPaperContext = (paper: PaperContextRef): boolean => {
    if (!item) return false;
    const selectedPapers = normalizePaperContextEntries(
      selectedPaperContextCache.get(item.id) || [],
    );
    const duplicate = selectedPapers.some(
      (entry) =>
        entry.itemId === paper.itemId &&
        entry.contextItemId === paper.contextItemId,
    );
    if (duplicate) {
      if (status) setStatus(status, i18n.paperAlreadySelected, "warning");
      return false;
    }
    if (selectedPapers.length >= MAX_SELECTED_PAPER_CONTEXTS) {
      if (status) {
        setStatus(
          status,
          `Paper Context up to ${MAX_SELECTED_PAPER_CONTEXTS}`,
          "error",
        );
      }
      return false;
    }
    const metadata = resolvePaperContextDisplayMetadata(paper);
    const nextPapers = [
      ...selectedPapers,
      {
        ...paper,
        firstCreator: metadata.firstCreator || paper.firstCreator,
        year: metadata.year || paper.year,
      },
    ];
    selectedPaperContextCache.set(item.id, nextPapers);
    selectedPaperPreviewExpandedCache.set(item.id, false);
    updatePaperPreviewPreservingScroll();
    if (status) {
      setStatus(
        status,
        i18n.paperContextAdded(nextPapers.length, MAX_SELECTED_PAPER_CONTEXTS),
        "ready",
      );
    }
    return true;
  };
  const consumeActiveSlashToken = (): boolean => {
    const token = getActiveSlashToken();
    if (!token) return false;
    const beforeSlash = inputBox.value.slice(0, token.slashStart);
    const afterCaret = inputBox.value.slice(token.caretEnd);
    inputBox.value = `${beforeSlash}${afterCaret}`;
    const nextCaret = beforeSlash.length;
    inputBox.setSelectionRange(nextCaret, nextCaret);
    return true;
  };
  const selectPaperPickerAttachment = (
    groupIndex: number,
    attachmentIndex: number,
    selectionKind: "paper-single" | "attachment",
  ): boolean => {
    const selectedGroup = paperPickerGroups[groupIndex];
    if (!selectedGroup) return false;
    const selectedAttachment = selectedGroup.attachments[attachmentIndex];
    if (!selectedAttachment) return false;
    consumeActiveSlashToken();
    ztoolkit.log("LLM: Paper picker selection", {
      selectionKind,
      itemId: selectedGroup.itemId,
      contextItemId: selectedAttachment.contextItemId,
    });
    upsertPaperContext({
      itemId: selectedGroup.itemId,
      contextItemId: selectedAttachment.contextItemId,
      title: selectedGroup.title,
      citationKey: selectedGroup.citationKey,
      firstCreator: selectedGroup.firstCreator,
      year: selectedGroup.year,
    });
    closePaperPicker();
    inputBox.focus({ preventScroll: true });
    return true;
  };
  const selectPaperPickerRowAt = (index: number): boolean => {
    const row = getPaperPickerRowAt(index);
    if (!row) return false;
    if (row.kind === "attachment") {
      return selectPaperPickerAttachment(
        row.groupIndex,
        row.attachmentIndex,
        "attachment",
      );
    }
    const group = paperPickerGroups[row.groupIndex];
    if (!group) return false;
    if (group.attachments.length <= 1) {
      return selectPaperPickerAttachment(row.groupIndex, 0, "paper-single");
    }
    if (!isPaperPickerGroupExpanded(group)) {
      togglePaperPickerGroupExpanded(row.groupIndex, true);
      ztoolkit.log("LLM: Paper picker expanded group via keyboard", {
        itemId: group.itemId,
      });
      renderPaperPicker();
      return true;
    }
    const firstChildIndex = findPaperPickerFirstAttachmentRowIndex(
      row.groupIndex,
    );
    if (firstChildIndex >= 0) {
      paperPickerActiveRowIndex = firstChildIndex;
      renderPaperPicker();
      return true;
    }
    return false;
  };
  const handlePaperPickerArrowRight = (): boolean => {
    const activeRow = getPaperPickerRowAt(paperPickerActiveRowIndex);
    if (!activeRow || activeRow.kind !== "paper") return false;
    const group = paperPickerGroups[activeRow.groupIndex];
    if (!group || group.attachments.length <= 1) return false;
    if (!isPaperPickerGroupExpanded(group)) {
      togglePaperPickerGroupExpanded(activeRow.groupIndex, true);
      renderPaperPicker();
      return true;
    }
    const firstChildIndex = findPaperPickerFirstAttachmentRowIndex(
      activeRow.groupIndex,
    );
    if (firstChildIndex >= 0 && firstChildIndex !== paperPickerActiveRowIndex) {
      paperPickerActiveRowIndex = firstChildIndex;
      renderPaperPicker();
      return true;
    }
    return false;
  };
  const handlePaperPickerArrowLeft = (): boolean => {
    const activeRow = getPaperPickerRowAt(paperPickerActiveRowIndex);
    if (!activeRow) return false;
    if (activeRow.kind === "attachment") {
      const parentIndex = findPaperPickerPaperRowIndex(activeRow.groupIndex);
      if (parentIndex >= 0 && parentIndex !== paperPickerActiveRowIndex) {
        paperPickerActiveRowIndex = parentIndex;
        renderPaperPicker();
        return true;
      }
      return false;
    }
    const group = paperPickerGroups[activeRow.groupIndex];
    if (!group || group.attachments.length <= 1) return false;
    if (!isPaperPickerGroupExpanded(group)) return false;
    togglePaperPickerGroupExpanded(activeRow.groupIndex, false);
    const parentIndex = findPaperPickerPaperRowIndex(activeRow.groupIndex);
    if (parentIndex >= 0) {
      paperPickerActiveRowIndex = parentIndex;
    }
    renderPaperPicker();
    return true;
  };
  const renderPaperPicker = () => {
    if (!paperPicker || !paperPickerList) return;
    const ownerDoc = body.ownerDocument;
    if (!ownerDoc) return;
    if (!paperPickerGroups.length) {
      paperPickerList.innerHTML = "";
      const empty = createElement(ownerDoc, "div", "llm-paper-picker-empty", {
        textContent: "No papers matched.",
      });
      paperPickerList.appendChild(empty);
      paperPicker.style.display = "block";
      return;
    }
    rebuildPaperPickerRows();
    if (!paperPickerRows.length) {
      paperPickerList.innerHTML = "";
      const empty = createElement(ownerDoc, "div", "llm-paper-picker-empty", {
        textContent: "No papers matched.",
      });
      paperPickerList.appendChild(empty);
      paperPicker.style.display = "block";
      return;
    }
    paperPickerList.innerHTML = "";
    paperPickerRows.forEach((row, rowIndex) => {
      const option = createElement(
        ownerDoc,
        "div",
        `llm-paper-picker-item ${
          row.kind === "paper"
            ? "llm-paper-picker-group-row"
            : "llm-paper-picker-attachment-row"
        }`,
      );
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        rowIndex === paperPickerActiveRowIndex ? "true" : "false",
      );
      option.tabIndex = -1;

      if (row.kind === "paper") {
        const group = paperPickerGroups[row.groupIndex];
        if (!group) return;
        const isMultiAttachment = group.attachments.length > 1;
        const expanded = isPaperPickerGroupExpanded(group);
        if (isMultiAttachment) {
          option.setAttribute("aria-expanded", expanded ? "true" : "false");
        }
        const rowMain = createElement(
          ownerDoc,
          "div",
          "llm-paper-picker-group-row-main",
        );
        const titleLine = createElement(
          ownerDoc,
          "div",
          "llm-paper-picker-group-title-line",
        );
        const title = createElement(ownerDoc, "span", "llm-paper-picker-title", {
          textContent: group.title,
          title: group.title,
        });
        titleLine.appendChild(title);
        if (isMultiAttachment) {
          const attachmentCount = createElement(
            ownerDoc,
            "span",
            "llm-paper-picker-group-meta",
            {
              textContent: `${group.attachments.length} PDFs`,
            },
          );
          const chevron = createElement(
            ownerDoc,
            "span",
            "llm-paper-picker-group-chevron",
            {
              textContent: expanded ? "▾" : "▸",
            },
          );
          titleLine.append(attachmentCount, chevron);
        }
        rowMain.appendChild(titleLine);
        const meta = createElement(ownerDoc, "span", "llm-paper-picker-meta", {
          textContent: buildPaperMetaText(group) || "Supplemental paper",
        });
        rowMain.appendChild(meta);
        option.appendChild(rowMain);
      } else {
        const group = paperPickerGroups[row.groupIndex];
        if (!group) return;
        const attachment = group.attachments[row.attachmentIndex];
        if (!attachment) return;
        const attachmentTitle = getPaperPickerAttachmentDisplayTitle(
          group,
          attachment,
          row.attachmentIndex,
        );
        const indent = createElement(
          ownerDoc,
          "span",
          "llm-paper-picker-attachment-indent",
        );
        const attachmentMain = createElement(
          ownerDoc,
          "div",
          "llm-paper-picker-attachment-main",
        );
        const title = createElement(ownerDoc, "span", "llm-paper-picker-title", {
          textContent: attachmentTitle,
          title: attachmentTitle,
        });
        const meta = createElement(ownerDoc, "span", "llm-paper-picker-meta", {
          textContent: "PDF attachment",
        });
        attachmentMain.append(title, meta);
        option.append(indent, attachmentMain);
      }

      const choosePaperRow = (e: Event) => {
        const mouse = e as MouseEvent;
        if (typeof mouse.button === "number" && mouse.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        if (row.kind === "paper") {
          paperPickerActiveRowIndex = rowIndex;
          const group = paperPickerGroups[row.groupIndex];
          if (!group) return;
          if (group.attachments.length <= 1) {
            selectPaperPickerAttachment(row.groupIndex, 0, "paper-single");
            return;
          }
          togglePaperPickerGroupExpanded(row.groupIndex);
          const parentIndex = findPaperPickerPaperRowIndex(row.groupIndex);
          if (parentIndex >= 0) {
            paperPickerActiveRowIndex = parentIndex;
          }
          renderPaperPicker();
          return;
        }
        paperPickerActiveRowIndex = rowIndex;
        selectPaperPickerAttachment(
          row.groupIndex,
          row.attachmentIndex,
          "attachment",
        );
      };
      option.addEventListener("mousedown", choosePaperRow);
      option.addEventListener("click", (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
      });
      paperPickerList.appendChild(option);
    });
    paperPicker.style.display = "block";
  };
  const schedulePaperPickerSearch = () => {
    if (!item || !paperPicker || !paperPickerList) {
      closePaperPicker();
      return;
    }
    const slashToken = getActiveSlashToken();
    if (!slashToken) {
      closePaperPicker();
      return;
    }
    if (paperPickerDebounceTimer !== null) {
      const win = body.ownerDocument?.defaultView;
      if (win) {
        win.clearTimeout(paperPickerDebounceTimer);
      } else {
        clearTimeout(paperPickerDebounceTimer);
      }
      paperPickerDebounceTimer = null;
    }
    const requestId = ++paperPickerRequestSeq;
    const runSearch = async () => {
      paperPickerDebounceTimer = null;
      if (!item) return;
      const activeSlashToken = getActiveSlashToken();
      if (!activeSlashToken) {
        closePaperPicker();
        return;
      }
      const libraryID = getCurrentLibraryID();
      if (!libraryID) {
        closePaperPicker();
        return;
      }
      const contextSource = resolveContextSourceItem(item);
      const excludeContextItemId = contextSource.contextItem?.id ?? null;
      const results = await searchPaperCandidates(
        libraryID,
        activeSlashToken.query,
        excludeContextItemId,
        20,
      );
      if (requestId !== paperPickerRequestSeq) return;
      if (!getActiveSlashToken()) {
        closePaperPicker();
        return;
      }
      paperPickerGroups = results;
      paperPickerExpandedGroupKeys = new Set<number>();
      if (activeSlashToken.query.trim()) {
        for (const group of paperPickerGroups) {
          if (
            group.attachments.length > 1 &&
            group.attachments.some((attachment) => attachment.score > 0)
          ) {
            paperPickerExpandedGroupKeys.add(getPaperPickerGroupKey(group));
          }
        }
      }
      const attachmentCount = paperPickerGroups.reduce(
        (count, group) => count + group.attachments.length,
        0,
      );
      ztoolkit.log("LLM: Paper picker grouped candidates", {
        groups: paperPickerGroups.length,
        attachments: attachmentCount,
        autoExpandedGroups: paperPickerExpandedGroupKeys.size,
      });
      paperPickerActiveRowIndex = 0;
      renderPaperPicker();
    };
    const win = body.ownerDocument?.defaultView;
    if (win) {
      paperPickerDebounceTimer = win.setTimeout(() => {
        void runSearch();
      }, 120);
    } else {
      paperPickerDebounceTimer =
        (setTimeout(() => {
          void runSearch();
        }, 120) as unknown as number) || 0;
    }
  };

  if (inputSection && inputBox) {
    let fileDragDepth = 0;

    inputSection.addEventListener("dragenter", (e: Event) => {
      const dragEvent = e as DragEvent;
      if (!isFileDragEvent(dragEvent) && !isZoteroItemDragEvent(dragEvent))
        return;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      fileDragDepth += 1;
      setInputDropActive(true);
    });

    inputSection.addEventListener("dragover", (e: Event) => {
      const dragEvent = e as DragEvent;
      if (!isFileDragEvent(dragEvent) && !isZoteroItemDragEvent(dragEvent))
        return;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      if (dragEvent.dataTransfer) {
        dragEvent.dataTransfer.dropEffect = "copy";
      }
      if (!inputSection.classList.contains("llm-input-drop-active")) {
        setInputDropActive(true);
      }
    });

    inputSection.addEventListener("dragleave", (e: Event) => {
      const dragEvent = e as DragEvent;
      if (!isFileDragEvent(dragEvent) && !isZoteroItemDragEvent(dragEvent))
        return;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      fileDragDepth = Math.max(0, fileDragDepth - 1);
      if (fileDragDepth === 0) {
        setInputDropActive(false);
      }
    });

    inputSection.addEventListener("drop", (e: Event) => {
      const dragEvent = e as DragEvent;
      if (!isFileDragEvent(dragEvent) && !isZoteroItemDragEvent(dragEvent))
        return;
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      fileDragDepth = 0;
      setInputDropActive(false);
      if (isZoteroItemDragEvent(dragEvent)) {
        void resolveZoteroItemFiles(dragEvent).then((files) => {
          if (files.length) void processIncomingFiles(files);
        });
      } else {
        const files = dragEvent.dataTransfer?.files
          ? Array.from(dragEvent.dataTransfer.files)
          : [];
        if (!files.length) return;
        void processIncomingFiles(files);
      }
      inputBox.focus({ preventScroll: true });
    });

    inputBox.addEventListener("paste", (e: Event) => {
      if (!item) return;
      const clipboardEvent = e as ClipboardEvent;
      const files = extractFilesFromClipboard(clipboardEvent);
      if (!files.length) return;
      clipboardEvent.preventDefault();
      clipboardEvent.stopPropagation();
      void processIncomingFiles(files);
      inputBox.focus({ preventScroll: true });
    });

    // Track IME composition state (e.g. Chinese pinyin input)
    let isComposingIME = false;
    inputBox.addEventListener("compositionstart", () => {
      isComposingIME = true;
    });
    inputBox.addEventListener("compositionend", () => {
      isComposingIME = false;
      // Fire search after composition completes with final characters
      schedulePaperPickerSearch();
    });

    inputBox.addEventListener("input", () => {
      // Skip search during IME composition — wait for compositionend
      if (isComposingIME) return;
      schedulePaperPickerSearch();
    });
    inputBox.addEventListener("click", () => {
      schedulePaperPickerSearch();
    });
    inputBox.addEventListener("keyup", (e: Event) => {
      if (isComposingIME) return;
      const key = (e as KeyboardEvent).key;
      if (
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight"
      )
        return;
      if (key === "Enter" || key === "Tab" || key === "Escape") return;
      schedulePaperPickerSearch();
    });
  }

  const { doSend } = createSendFlowController({
    body,
    inputBox,
    isPanelGenerating: () => isPanelGenerating(body),
    getItem: () => item,
    closeSlashMenu,
    closePaperPicker,
    getSelectedTextContextEntries,
    getSelectedPaperContexts: (itemId) =>
      normalizePaperContextEntries(selectedPaperContextCache.get(itemId) || []),
    getSelectedFiles: (itemId) => selectedFileAttachmentCache.get(itemId) || [],
    getSelectedImages: (itemId) => selectedImageCache.get(itemId) || [],
    resolvePromptText,
    buildQuestionWithSelectedTextContexts,
    buildModelPromptWithFileContext,
    isGlobalMode,
    normalizeConversationTitleSeed,
    getConversationKey,
    touchGlobalConversationTitle,
    touchPaperConversationTitle,
    getSelectedProfile,
    getCurrentModelName: () => getSelectedModelInfo().currentModel,
    isScreenshotUnsupportedModel,
    getAdvancedModelParams,
    getActiveEditSession: () => activeEditSession,
    setActiveEditSession: (nextEditSession) => {
      activeEditSession = nextEditSession;
    },
    getLatestEditablePair,
    editLatestUserMessageAndRetry,
    sendQuestion,
    clearSelectedImageState,
    clearSelectedPaperState,
    clearSelectedFileState,
    clearSelectedTextState,
    updatePaperPreviewPreservingScroll,
    updateFilePreviewPreservingScroll,
    updateImagePreviewPreservingScroll,
    updateSelectedTextPreviewPreservingScroll,
    scheduleAttachmentGc,
    refreshGlobalHistoryHeader: () => {
      void refreshGlobalHistoryHeader();
    },
    setStatusMessage: status
      ? (message, level) => {
          setStatus(status, message, level);
        }
      : undefined,
    editStaleStatusText: EDIT_STALE_STATUS_TEXT,
  });

  // Send button - use addEventListener
  sendBtn.addEventListener("click", (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    doSend();
    clearDraftInput();
    clearComposeState();
  });

  // Enter key (Shift+Enter for newline)
  inputBox.addEventListener("keydown", (e: Event) => {
    const ke = e as KeyboardEvent;
    if (isPaperPickerOpen()) {
      if (ke.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (paperPickerRows.length) {
          paperPickerActiveRowIndex =
            (paperPickerActiveRowIndex + 1) % paperPickerRows.length;
          renderPaperPicker();
        }
        return;
      }
      if (ke.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (paperPickerRows.length) {
          paperPickerActiveRowIndex =
            (paperPickerActiveRowIndex - 1 + paperPickerRows.length) %
            paperPickerRows.length;
          renderPaperPicker();
        }
        return;
      }
      if (ke.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        handlePaperPickerArrowRight();
        return;
      }
      if (ke.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        handlePaperPickerArrowLeft();
        return;
      }
      if (ke.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closePaperPicker();
        return;
      }
      if (ke.key === "Enter" || ke.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        selectPaperPickerRowAt(paperPickerActiveRowIndex);
        return;
      }
    }
    if (ke.key === "Enter" && !ke.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      doSend();
      clearDraftInput();
      clearComposeState();
    }
  });

  if (
    panelDoc &&
    !(panelDoc as unknown as { __llmFontScaleShortcut?: boolean })
      .__llmFontScaleShortcut
  ) {
    const isEventWithinActivePanel = (event: Event) => {
      const panel = panelDoc.querySelector("#llm-main") as HTMLElement | null;
      if (!panel) return null;
      const target = event.target as Node | null;
      const activeEl = panelDoc.activeElement;
      const inPanel = Boolean(
        (target && panel.contains(target)) ||
        (activeEl && panel.contains(activeEl)),
      );
      if (!inPanel) return null;
      return panel;
    };

    const applyDelta = (
      event: Event,
      delta: number | null,
      reset: boolean = false,
    ) => {
      if (!reset && delta === null) return;
      const panel = isEventWithinActivePanel(event);
      if (!panel) return;
      setPanelFontScalePercent(
        reset
          ? FONT_SCALE_DEFAULT_PERCENT
          : clampNumber(
              panelFontScalePercent + (delta || 0),
              FONT_SCALE_MIN_PERCENT,
              FONT_SCALE_MAX_PERCENT,
            ),
      );
      event.preventDefault();
      event.stopPropagation();
      applyPanelFontScale(panel);
    };

    panelDoc.addEventListener(
      "keydown",
      (e: Event) => {
        const ke = e as KeyboardEvent;
        if (!(ke.metaKey || ke.ctrlKey) || ke.altKey) return;

        if (
          ke.key === "+" ||
          ke.key === "=" ||
          ke.code === "Equal" ||
          ke.code === "NumpadAdd"
        ) {
          applyDelta(ke, FONT_SCALE_STEP_PERCENT);
        } else if (
          ke.key === "-" ||
          ke.key === "_" ||
          ke.code === "Minus" ||
          ke.code === "NumpadSubtract"
        ) {
          applyDelta(ke, -FONT_SCALE_STEP_PERCENT);
        } else if (
          ke.key === "0" ||
          ke.code === "Digit0" ||
          ke.code === "Numpad0"
        ) {
          applyDelta(ke, null, true);
        }
      },
      true,
    );

    // Some platforms route Cmd/Ctrl +/- through zoom commands instead of keydown.
    panelDoc.addEventListener(
      "command",
      (e: Event) => {
        const target = e.target as Element | null;
        const commandId = target?.id || "";
        if (
          commandId === "cmd_fullZoomEnlarge" ||
          commandId === "cmd_textZoomEnlarge"
        ) {
          applyDelta(e, FONT_SCALE_STEP_PERCENT);
        } else if (
          commandId === "cmd_fullZoomReduce" ||
          commandId === "cmd_textZoomReduce"
        ) {
          applyDelta(e, -FONT_SCALE_STEP_PERCENT);
        } else if (
          commandId === "cmd_fullZoomReset" ||
          commandId === "cmd_textZoomReset"
        ) {
          applyDelta(e, null, true);
        }
      },
      true,
    );

    (
      panelDoc as unknown as { __llmFontScaleShortcut?: boolean }
    ).__llmFontScaleShortcut = true;
  }

  if (selectTextBtn) {
    let pendingSelectedText = "";
    const cacheSelectionBeforeFocusShift = () => {
      if (!item) return;
      pendingSelectedText = getActiveReaderSelectionText(
        body.ownerDocument as Document,
        item,
      );
    };
    selectTextBtn.addEventListener(
      "pointerdown",
      cacheSelectionBeforeFocusShift,
    );
    selectTextBtn.addEventListener("mousedown", cacheSelectionBeforeFocusShift);
    selectTextBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      const selectedText = pendingSelectedText;
      pendingSelectedText = "";
      const activeReaderAttachment =
        item?.isAttachment?.() &&
        item.attachmentContentType === "application/pdf"
          ? item
          : getActiveContextAttachmentFromTabs();
      const resolvedPaperContext =
        resolvePaperContextRefFromAttachment(activeReaderAttachment);
      const textContextKey = getTextContextConversationKey();
      if (!textContextKey) return;
      if (!isGlobalMode()) {
        // Compare using the Zotero item ID (and its parent), NOT the
        // paper conversation key which lives in a different numeric range.
        const currentItemId = item?.id;
        const currentParentId = item?.parentID;
        const paperMismatch =
          !resolvedPaperContext ||
          (resolvedPaperContext.itemId !== currentItemId &&
            resolvedPaperContext.itemId !== currentParentId);
        if (paperMismatch) {
          if (status) {
            setStatus(
              status,
              "Paper mode only accepts text from this paper",
              "error",
            );
          }
          return;
        }
      }
      includeSelectedTextFromReader(body, item, selectedText, {
        targetItemId: textContextKey,
        paperContext: isGlobalMode() ? resolvedPaperContext : null,
      });
      updateSelectedTextPreviewPreservingScroll();
    });
  }

  // Screenshot button
  if (screenshotBtn) {
    screenshotBtn.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      const { currentModel } = getSelectedModelInfo();
      if (isScreenshotUnsupportedModel(currentModel)) {
        if (status) {
          setStatus(status, getScreenshotDisabledHint(currentModel), "error");
        }
        updateImagePreviewPreservingScroll();
        return;
      }

      // Get the main Zotero window
      // Try multiple methods to find the correct window
      let mainWindow: Window | null = null;

      // Method 1: Try Zotero.getMainWindow()
      mainWindow = Zotero.getMainWindow();
      ztoolkit.log("Screenshot: Zotero.getMainWindow() =", mainWindow);

      // Method 2: If that doesn't work, try getting top window from our document
      if (!mainWindow) {
        const panelWin = body.ownerDocument?.defaultView;
        mainWindow = panelWin?.top || panelWin || null;
        ztoolkit.log("Screenshot: Using panel's top window");
      }

      if (!mainWindow) {
        ztoolkit.log("Screenshot: No window found");
        return;
      }

      ztoolkit.log(
        "Screenshot: Using window, body exists:",
        !!mainWindow.document.body,
      );
      ztoolkit.log(
        "Screenshot: documentElement exists:",
        !!mainWindow.document.documentElement,
      );

      const currentImages = selectedImageCache.get(item.id) || [];
      if (currentImages.length >= MAX_SELECTED_IMAGES) {
        if (status) {
          setStatus(
            status,
            `Maximum ${MAX_SELECTED_IMAGES} screenshots allowed`,
            "error",
          );
        }
        updateImagePreviewPreservingScroll();
        return;
      }
      if (status) setStatus(status, "Select a region...", "sending");

      try {
        ztoolkit.log("Screenshot: Starting capture selection...");
        const dataUrl = await captureScreenshotSelection(mainWindow);
        ztoolkit.log(
          "Screenshot: Capture returned:",
          dataUrl ? "image data" : "null",
        );
        if (dataUrl) {
          const optimized = await optimizeImageDataUrl(mainWindow, dataUrl);
          const existingImages = selectedImageCache.get(item.id) || [];
          const nextImages = [...existingImages, optimized].slice(
            0,
            MAX_SELECTED_IMAGES,
          );
          selectedImageCache.set(item.id, nextImages);
          const expandedBeforeCapture = selectedImagePreviewExpandedCache.get(
            item.id,
          );
          selectedImagePreviewExpandedCache.set(
            item.id,
            typeof expandedBeforeCapture === "boolean"
              ? expandedBeforeCapture
              : false,
          );
          selectedImagePreviewActiveIndexCache.set(
            item.id,
            nextImages.length - 1,
          );
          updateImagePreviewPreservingScroll();
          if (status) {
            setStatus(
              status,
              `Screenshot captured (${nextImages.length})`,
              "ready",
            );
          }
        } else {
          if (status) setStatus(status, "Selection cancelled", "ready");
        }
      } catch (err) {
        ztoolkit.log("Screenshot selection error:", err);
        if (status) setStatus(status, "Screenshot failed", "error");
      }
    });
  }

  const openReferenceSlashFromMenu = () => {
    if (!item) return;
    const existingToken = getActiveSlashToken();
    if (!existingToken) {
      const selectionStart =
        typeof inputBox.selectionStart === "number"
          ? inputBox.selectionStart
          : inputBox.value.length;
      const selectionEnd =
        typeof inputBox.selectionEnd === "number"
          ? inputBox.selectionEnd
          : selectionStart;
      const before = inputBox.value.slice(0, selectionStart);
      const after = inputBox.value.slice(selectionEnd);
      const needsLeadingSpace = before.length > 0 && !/\s$/.test(before);
      const insertion = `${needsLeadingSpace ? " " : ""}@`;
      inputBox.value = `${before}${insertion}${after}`;
      const nextCaret = before.length + insertion.length;
      inputBox.setSelectionRange(nextCaret, nextCaret);
    }
    inputBox.focus({ preventScroll: true });
    schedulePaperPickerSearch();
    if (status) {
      setStatus(status, i18n.referencePickerReady, "ready");
    }
  };

  if (uploadBtn && uploadInput) {
    uploadBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      if (!slashMenu) {
        uploadInput.click();
        return;
      }
      if (isFloatingMenuOpen(slashMenu)) {
        closeSlashMenu();
        return;
      }
      closeRetryModelMenu();
      closeModelMenu();
      closeHistoryMenu();
      closeResponseMenu();
      closePromptMenu();
      closeExportMenu();
      positionFloatingMenu(body, slashMenu, uploadBtn);
      setFloatingMenuOpen(slashMenu, SLASH_MENU_OPEN_CLASS, true);
      uploadBtn.setAttribute("aria-expanded", "true");
    });
    uploadInput.addEventListener("change", async () => {
      if (!item) return;
      const files = Array.from(uploadInput.files || []);
      uploadInput.value = "";
      await processIncomingFiles(files);
    });
  }

  if (slashUploadOption && uploadInput) {
    slashUploadOption.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      closeSlashMenu();
      uploadInput.click();
    });
  }

  if (slashReferenceOption) {
    slashReferenceOption.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      closeSlashMenu();
      openReferenceSlashFromMenu();
    });
  }

  const openModelMenu = () => {
    if (!modelMenu || !modelBtn) return;
    closeSlashMenu();
    closeRetryModelMenu();
    closePromptMenu();
    closeHistoryMenu();
    updateModelButton();
    rebuildModelMenu();
    if (!modelMenu.childElementCount) {
      closeModelMenu();
      return;
    }
    positionFloatingMenu(body, modelMenu, modelBtn);
    setFloatingMenuOpen(modelMenu, MODEL_MENU_OPEN_CLASS, true);
  };

  const closeModelMenu = () => {
    setFloatingMenuOpen(modelMenu, MODEL_MENU_OPEN_CLASS, false);
  };

  const openRetryModelMenu = (anchor: HTMLButtonElement) => {
    if (!item || !retryModelMenu) return;
    closeSlashMenu();
    closeResponseMenu();
    closeExportMenu();
    closePromptMenu();
    closeHistoryMenu();
    closeModelMenu();
    rebuildRetryModelMenu();
    if (!retryModelMenu.childElementCount) {
      closeRetryModelMenu();
      return;
    }
    retryMenuAnchor = anchor;
    positionFloatingMenu(body, retryModelMenu, anchor);
    setFloatingMenuOpen(retryModelMenu, RETRY_MODEL_MENU_OPEN_CLASS, true);
  };

  if (modelMenu) {
    modelMenu.addEventListener("pointerdown", (e: Event) => {
      e.stopPropagation();
    });
    modelMenu.addEventListener("mousedown", (e: Event) => {
      e.stopPropagation();
    });
  }

  if (retryModelMenu) {
    retryModelMenu.addEventListener("pointerdown", (e: Event) => {
      e.stopPropagation();
    });
    retryModelMenu.addEventListener("mousedown", (e: Event) => {
      e.stopPropagation();
    });
  }

  if (slashMenu) {
    slashMenu.addEventListener("pointerdown", (e: Event) => {
      e.stopPropagation();
    });
    slashMenu.addEventListener("mousedown", (e: Event) => {
      e.stopPropagation();
    });
  }

  if (historyMenu) {
    historyMenu.addEventListener("pointerdown", (e: Event) => {
      e.stopPropagation();
    });
    historyMenu.addEventListener("mousedown", (e: Event) => {
      e.stopPropagation();
    });
  }

  const bodyWithRetryMenuDismiss = body as Element & {
    __llmRetryMenuDismissHandler?: (event: PointerEvent) => void;
  };
  if (bodyWithRetryMenuDismiss.__llmRetryMenuDismissHandler) {
    panelDoc.removeEventListener(
      "pointerdown",
      bodyWithRetryMenuDismiss.__llmRetryMenuDismissHandler,
      true,
    );
  }
  const dismissRetryMenuOnOutsidePointerDown = (e: PointerEvent) => {
    if (typeof e.button === "number" && e.button !== 0) return;
    if (!retryModelMenu || !isFloatingMenuOpen(retryModelMenu)) return;
    const target = e.target as Node | null;
    if (target && retryModelMenu.contains(target)) return;
    closeRetryModelMenu();
  };
  panelDoc.addEventListener(
    "pointerdown",
    dismissRetryMenuOnOutsidePointerDown,
    true,
  );
  bodyWithRetryMenuDismiss.__llmRetryMenuDismissHandler =
    dismissRetryMenuOnOutsidePointerDown;

  const bodyWithPromptMenuDismiss = body as Element & {
    __llmPromptMenuDismissHandler?: (event: PointerEvent) => void;
  };
  if (bodyWithPromptMenuDismiss.__llmPromptMenuDismissHandler) {
    panelDoc.removeEventListener(
      "pointerdown",
      bodyWithPromptMenuDismiss.__llmPromptMenuDismissHandler,
      true,
    );
  }
  const dismissPromptMenuOnOutsidePointerDown = (e: PointerEvent) => {
    if (!promptMenu || promptMenu.style.display === "none") return;
    const target = e.target as Node | null;
    if (target && promptMenu.contains(target)) return;
    closePromptMenu();
  };
  panelDoc.addEventListener(
    "pointerdown",
    dismissPromptMenuOnOutsidePointerDown,
    true,
  );
  bodyWithPromptMenuDismiss.__llmPromptMenuDismissHandler =
    dismissPromptMenuOnOutsidePointerDown;

  const bodyWithPaperPickerDismiss = body as Element & {
    __llmPaperPickerDismissHandler?: (event: PointerEvent) => void;
  };
  if (bodyWithPaperPickerDismiss.__llmPaperPickerDismissHandler) {
    panelDoc.removeEventListener(
      "pointerdown",
      bodyWithPaperPickerDismiss.__llmPaperPickerDismissHandler,
      true,
    );
  }
  const dismissPaperPickerOnOutsidePointerDown = (e: PointerEvent) => {
    if (!isPaperPickerOpen()) return;
    const target = e.target as Node | null;
    if (target && paperPicker?.contains(target)) return;
    if (target && inputBox.contains(target)) return;
    closePaperPicker();
  };
  panelDoc.addEventListener(
    "pointerdown",
    dismissPaperPickerOnOutsidePointerDown,
    true,
  );
  bodyWithPaperPickerDismiss.__llmPaperPickerDismissHandler =
    dismissPaperPickerOnOutsidePointerDown;

  if (chatBox) {
    chatBox.addEventListener("click", (e: Event) => {
      // Copy code block or math block content
      const blockCopyTarget = (e.target as Element | null)?.closest(
        ".llm-block-copy-btn",
      ) as HTMLElement | null;
      if (blockCopyTarget) {
        e.preventDefault();
        e.stopPropagation();
        const textToCopy = blockCopyTarget.dataset.copyText || "";
        if (!textToCopy) return;
        void copyTextToClipboard(body, textToCopy).then(() => {
          blockCopyTarget.classList.add("copied");
          const win = body.ownerDocument?.defaultView;
          if (win) {
            win.setTimeout(() => {
              blockCopyTarget.classList.remove("copied");
            }, 1500);
          }
        });
        return;
      }

      // Copy single message
      const copyTarget = (e.target as Element | null)?.closest(
        ".llm-msg-copy-btn",
      ) as HTMLButtonElement | null;
      if (copyTarget) {
        e.preventDefault();
        e.stopPropagation();
        const msgIndex = Number(copyTarget.dataset.msgIndex || "");
        if (!item || !Number.isFinite(msgIndex)) return;
        const key = getConversationKey(item);
        const history = chatHistory.get(key) || [];
        const msg = history[msgIndex];
        if (!msg?.text?.trim()) return;
        void copyTextToClipboard(body, msg.text.trim()).then(() => {
          if (status) setStatus(status, "Copied", "ready");
        });
        return;
      }

      // Save single message as note
      const noteTarget = (e.target as Element | null)?.closest(
        ".llm-msg-note-btn",
      ) as HTMLButtonElement | null;
      if (noteTarget) {
        e.preventDefault();
        e.stopPropagation();
        const msgIndex = Number(noteTarget.dataset.msgIndex || "");
        if (!item || !Number.isFinite(msgIndex)) return;
        const key = getConversationKey(item);
        const history = chatHistory.get(key) || [];
        const msg = history[msgIndex];
        if (!msg?.text?.trim()) return;
        const modelName = msg.modelName?.trim() || (msg.role === "user" ? "user" : "model");
        void (async () => {
          try {
            if (isGlobalPortalItem(item)) {
              const libraryID = getCurrentLibraryID();
              await createStandaloneNoteFromChatHistory(libraryID, [msg]);
            } else {
              await createNoteFromAssistantText(item, msg.text, modelName);
            }
            if (status) setStatus(status, i18n.saveAsNote, "ready");
          } catch (err) {
            ztoolkit.log("Save single message as note failed:", err);
            const errMsg = err instanceof Error ? err.message : String(err);
            if (status) setStatus(status, `Failed: ${errMsg}`, "error");
          }
        })();
        return;
      }

      const editTarget = (e.target as Element | null)?.closest(
        ".llm-edit-latest",
      ) as HTMLButtonElement | null;
      if (editTarget) {
        e.preventDefault();
        e.stopPropagation();
        closeResponseMenu();
        closeExportMenu();
        closeRetryModelMenu();
        if (!item || !promptMenuEditBtn) return;
        const userTimestamp = Number(editTarget.dataset.userTimestamp || "");
        const assistantTimestamp = Number(
          editTarget.dataset.assistantTimestamp || "",
        );
        if (
          !Number.isFinite(userTimestamp) ||
          !Number.isFinite(assistantTimestamp)
        ) {
          if (status) setStatus(status, i18n.noEditableLatestPrompt, "error");
          return;
        }
        setPromptMenuTarget({
          item,
          conversationKey: getConversationKey(item),
          userTimestamp,
          assistantTimestamp,
        });
        promptMenuEditBtn.click();
        return;
      }

      const retryTarget = (e.target as Element | null)?.closest(
        ".llm-retry-latest",
      ) as HTMLButtonElement | null;
      if (!retryTarget) return;
      e.preventDefault();
      e.stopPropagation();
      closePromptMenu();
      if (!item || !retryModelMenu) return;
      if (isFloatingMenuOpen(retryModelMenu)) {
        closeRetryModelMenu();
      } else {
        openRetryModelMenu(retryTarget);
      }
    });
  }

  if (modelBtn) {
    modelBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item || !modelMenu) return;
      if (!isFloatingMenuOpen(modelMenu)) {
        openModelMenu();
      } else {
        closeModelMenu();
      }
    });
  }

  const doc = body.ownerDocument;
  if (
    doc &&
    !(doc as unknown as { __llmModelMenuDismiss?: boolean })
      .__llmModelMenuDismiss
  ) {
    doc.addEventListener("mousedown", (e: Event) => {
      const me = e as MouseEvent;
      const modelMenus = Array.from(
        doc.querySelectorAll("#llm-model-menu"),
      ) as HTMLDivElement[];
      const target = e.target as Node | null;
      const retryButtonTarget = isElementNode(target)
        ? (target.closest(".llm-retry-latest") as HTMLButtonElement | null)
        : null;
      const retryModelMenus = Array.from(
        doc.querySelectorAll("#llm-retry-model-menu"),
      ) as HTMLDivElement[];
      const responseMenus = Array.from(
        doc.querySelectorAll("#llm-response-menu"),
      ) as HTMLDivElement[];
      const promptMenus = Array.from(
        doc.querySelectorAll("#llm-prompt-menu"),
      ) as HTMLDivElement[];
      const exportMenus = Array.from(
        doc.querySelectorAll("#llm-export-menu"),
      ) as HTMLDivElement[];
      const slashMenus = Array.from(
        doc.querySelectorAll("#llm-slash-menu"),
      ) as HTMLDivElement[];
      const historyMenus = Array.from(
        doc.querySelectorAll("#llm-history-menu"),
      ) as HTMLDivElement[];
      for (const modelMenuEl of modelMenus) {
        if (!isFloatingMenuOpen(modelMenuEl)) continue;
        const panelRoot = modelMenuEl.closest("#llm-main");
        const modelButtonEl = panelRoot?.querySelector(
          "#llm-model-toggle",
        ) as HTMLButtonElement | null;
        if (
          !target ||
          (!modelMenuEl.contains(target) && !modelButtonEl?.contains(target))
        ) {
          setFloatingMenuOpen(modelMenuEl, MODEL_MENU_OPEN_CLASS, false);
        }
      }
      for (const retryModelMenuEl of retryModelMenus) {
        if (!isFloatingMenuOpen(retryModelMenuEl)) continue;
        const panelRoot = retryModelMenuEl.closest("#llm-main");
        const clickedRetryButtonInSamePanel = Boolean(
          retryButtonTarget &&
          panelRoot &&
          panelRoot.contains(retryButtonTarget),
        );
        if (
          !target ||
          (!retryModelMenuEl.contains(target) && !clickedRetryButtonInSamePanel)
        ) {
          setFloatingMenuOpen(
            retryModelMenuEl,
            RETRY_MODEL_MENU_OPEN_CLASS,
            false,
          );
          retryMenuAnchor = null;
        }
      }
      if (me.button === 0) {
        let responseMenuClosed = false;
        for (const responseMenuEl of responseMenus) {
          if (responseMenuEl.style.display === "none") continue;
          if (target && responseMenuEl.contains(target)) continue;
          responseMenuEl.style.display = "none";
          responseMenuClosed = true;
        }
        if (responseMenuClosed) {
          setResponseMenuTarget(null);
        }
        let promptMenuClosed = false;
        for (const promptMenuEl of promptMenus) {
          if (promptMenuEl.style.display === "none") continue;
          if (target && promptMenuEl.contains(target)) continue;
          promptMenuEl.style.display = "none";
          promptMenuClosed = true;
        }
        if (promptMenuClosed) {
          setPromptMenuTarget(null);
        }

        for (const exportMenuEl of exportMenus) {
          if (exportMenuEl.style.display === "none") continue;
          if (target && exportMenuEl.contains(target)) continue;
          const panelRoot = exportMenuEl.closest("#llm-main");
          const exportButtonEl = panelRoot?.querySelector(
            "#llm-export",
          ) as HTMLButtonElement | null;
          if (target && exportButtonEl?.contains(target)) continue;
          exportMenuEl.style.display = "none";
        }

        for (const slashMenuEl of slashMenus) {
          if (slashMenuEl.style.display === "none") continue;
          if (target && slashMenuEl.contains(target)) continue;
          const panelRoot = slashMenuEl.closest("#llm-main");
          const slashButtonEl = panelRoot?.querySelector(
            "#llm-upload-file",
          ) as HTMLButtonElement | null;
          if (target && slashButtonEl?.contains(target)) continue;
          slashMenuEl.style.display = "none";
          slashButtonEl?.setAttribute("aria-expanded", "false");
        }

        for (const historyMenuEl of historyMenus) {
          if (historyMenuEl.style.display === "none") continue;
          if (target && historyMenuEl.contains(target)) continue;
          const panelRoot = historyMenuEl.closest("#llm-main");
          const historyToggleEl = panelRoot?.querySelector(
            "#llm-history-toggle",
          ) as HTMLButtonElement | null;
          const historyNewEl = panelRoot?.querySelector(
            "#llm-history-new",
          ) as HTMLButtonElement | null;
          if (target && historyToggleEl?.contains(target)) continue;
          if (target && historyNewEl?.contains(target)) continue;
          historyMenuEl.style.display = "none";
          historyToggleEl?.setAttribute("aria-expanded", "false");
        }
      }
    });
    (
      doc as unknown as { __llmModelMenuDismiss?: boolean }
    ).__llmModelMenuDismiss = true;
  }

  // Remove image button
  if (previewMeta) {
    previewMeta.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      const selectedImages = selectedImageCache.get(item.id) || [];
      if (!selectedImages.length) return;
      const expanded = selectedImagePreviewExpandedCache.get(item.id) === true;
      const nextExpanded = !expanded;
      selectedImagePreviewExpandedCache.set(item.id, nextExpanded);
      if (nextExpanded) {
        selectedImagePreviewActiveIndexCache.set(item.id, 0);
        const textContextKey = getTextContextConversationKey();
        if (textContextKey) {
          setSelectedTextExpandedIndex(textContextKey, null);
        }
        selectedPaperPreviewExpandedCache.set(item.id, false);
        selectedFilePreviewExpandedCache.set(item.id, false);
      }
      updatePaperPreviewPreservingScroll();
      updateFilePreviewPreservingScroll();
      updateSelectedTextPreviewPreservingScroll();
      updateImagePreviewPreservingScroll();
    });
  }

  if (removeImgBtn) {
    removeImgBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      clearSelectedImageState(item.id);
      updateImagePreviewPreservingScroll();
      if (status) setStatus(status, "Figures cleared", "ready");
    });
  }

  if (filePreviewMeta) {
    filePreviewMeta.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      const selectedFiles = selectedFileAttachmentCache.get(item.id) || [];
      if (!selectedFiles.length) return;
      const expanded = selectedFilePreviewExpandedCache.get(item.id) === true;
      const nextExpanded = !expanded;
      selectedFilePreviewExpandedCache.set(item.id, nextExpanded);
      if (nextExpanded) {
        const textContextKey = getTextContextConversationKey();
        if (textContextKey) {
          setSelectedTextExpandedIndex(textContextKey, null);
        }
        selectedImagePreviewExpandedCache.set(item.id, false);
        selectedPaperPreviewExpandedCache.set(item.id, false);
      }
      updatePaperPreview();
      updateSelectedTextPreview();
      updateImagePreview();
      updateFilePreview();
    });
  }

  if (filePreviewClear) {
    filePreviewClear.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (!item) return;
      const selectedFiles = selectedFileAttachmentCache.get(item.id) || [];
      for (const entry of selectedFiles) {
        if (!entry?.storedPath) continue;
        if (entry.contentHash || isManagedBlobPath(entry.storedPath)) continue;
        void removeAttachmentFile(entry.storedPath).catch((err) => {
          ztoolkit.log("LLM: Failed to remove cleared attachment file", err);
        });
      }
      clearSelectedFileState(item.id);
      updateFilePreview();
      scheduleAttachmentGc();
      if (status) setStatus(status, "Files cleared", "ready");
    });
  }

  if (paperPreview) {
    paperPreview.addEventListener("click", (e: Event) => {
      if (!item) return;
      const target = e.target as Element | null;
      if (!target) return;
      const clearBtn = target.closest(
        ".llm-paper-context-clear",
      ) as HTMLButtonElement | null;
      if (!clearBtn) return;
      e.preventDefault();
      e.stopPropagation();
      const index = Number.parseInt(
        clearBtn.dataset.paperContextIndex || "",
        10,
      );

      // Auto-loaded chip (index -1): dismiss via dismissedAutoLoadPaperCache
      if (index === -1) {
        const autoRef = resolveAutoLoadedPaperContext();
        if (autoRef) {
          const dismissKey = `${autoRef.itemId}:${autoRef.contextItemId}`;
          dismissedAutoLoadPaperCache.set(item.id, dismissKey);
        }
        updatePaperPreview();
        if (status) setStatus(status, "Paper context dismissed", "ready");
        return;
      }

      const selectedPapers = normalizePaperContextEntries(
        selectedPaperContextCache.get(item.id) || [],
      );
      if (
        !Number.isFinite(index) ||
        index < 0 ||
        index >= selectedPapers.length
      ) {
        return;
      }
      // If user is removing an auto-loaded paper, record dismissal
      const removedPaper = selectedPapers[index];
      if (removedPaper) {
        const dismissKey = `${removedPaper.itemId}:${removedPaper.contextItemId}`;
        dismissedAutoLoadPaperCache.set(item.id, dismissKey);
      }
      const nextPapers = selectedPapers.filter((_, i) => i !== index);
      if (nextPapers.length) {
        selectedPaperContextCache.set(item.id, nextPapers);
      } else {
        clearSelectedPaperState(item.id);
      }
      updatePaperPreview();
      if (status) {
        setStatus(
          status,
          `Paper context removed (${nextPapers.length})`,
          "ready",
        );
      }
    });
  }

  if (selectedContextList) {
    selectedContextList.addEventListener("click", (e: Event) => {
      if (!item) return;
      const target = e.target as Element | null;
      if (!target) return;

      const clearBtn = target.closest(
        ".llm-selected-context-clear",
      ) as HTMLButtonElement | null;
      if (clearBtn) {
        e.preventDefault();
        e.stopPropagation();
        const textContextKey = getTextContextConversationKey();
        if (!textContextKey) return;
        const index = Number.parseInt(clearBtn.dataset.contextIndex || "", 10);
        const selectedContexts = getSelectedTextContextEntries(textContextKey);
        if (
          !Number.isFinite(index) ||
          index < 0 ||
          index >= selectedContexts.length
        ) {
          return;
        }
        const nextContexts = selectedContexts.filter((_, i) => i !== index);
        setSelectedTextContextEntries(textContextKey, nextContexts);
        setSelectedTextExpandedIndex(textContextKey, null);
        updateSelectedTextPreviewPreservingScroll();
        if (status) setStatus(status, "Selected text removed", "ready");
        return;
      }

      const metaBtn = target.closest(
        ".llm-selected-context-meta",
      ) as HTMLButtonElement | null;
      if (!metaBtn) return;
      e.preventDefault();
      e.stopPropagation();
      const textContextKey = getTextContextConversationKey();
      if (!textContextKey) return;
      const index = Number.parseInt(metaBtn.dataset.contextIndex || "", 10);
      const selectedContexts = getSelectedTextContextEntries(textContextKey);
      if (
        !Number.isFinite(index) ||
        index < 0 ||
        index >= selectedContexts.length
      )
        return;
      const expandedIndex = getSelectedTextExpandedIndex(
        textContextKey,
        selectedContexts.length,
      );
      const nextExpandedIndex = expandedIndex === index ? null : index;
      setSelectedTextExpandedIndex(textContextKey, nextExpandedIndex);
      if (nextExpandedIndex !== null) {
        selectedImagePreviewExpandedCache.set(item.id, false);
        selectedPaperPreviewExpandedCache.set(item.id, false);
        selectedFilePreviewExpandedCache.set(item.id, false);
      }
      updatePaperPreviewPreservingScroll();
      updateFilePreviewPreservingScroll();
      updateImagePreviewPreservingScroll();
      updateSelectedTextPreviewPreservingScroll();
    });
  }

  const bodyWithPinnedDismiss = body as Element & {
    __llmPinnedContextDismissHandler?: (event: MouseEvent) => void;
  };
  if (bodyWithPinnedDismiss.__llmPinnedContextDismissHandler) {
    body.removeEventListener(
      "mousedown",
      bodyWithPinnedDismiss.__llmPinnedContextDismissHandler,
      true,
    );
  }
  const dismissPinnedContextPanels = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (!item) return;
    const target = e.target as Node | null;
    const clickedInsideTextPanel = Boolean(
      selectedContextList && target && selectedContextList.contains(target),
    );
    const clickedInsideFigurePanel = Boolean(
      imagePreview && target && imagePreview.contains(target),
    );
    const clickedInsideFilePanel = Boolean(
      filePreview && target && filePreview.contains(target),
    );
    const clickedInsidePaperPanel = Boolean(
      paperPreview && target && paperPreview.contains(target),
    );
    if (
      clickedInsideTextPanel ||
      clickedInsideFigurePanel ||
      clickedInsideFilePanel ||
      clickedInsidePaperPanel
    )
      return;

    const textContextKey = getTextContextConversationKey();
    if (!textContextKey) return;
    const textPinned =
      getSelectedTextExpandedIndex(
        textContextKey,
        getSelectedTextContexts(textContextKey).length,
      ) >= 0;
    const figurePinned =
      selectedImagePreviewExpandedCache.get(item.id) === true;
    const paperPinned = selectedPaperPreviewExpandedCache.get(item.id) === true;
    const filePinned = selectedFilePreviewExpandedCache.get(item.id) === true;
    if (!textPinned && !figurePinned && !paperPinned && !filePinned) return;

    setSelectedTextExpandedIndex(textContextKey, null);
    selectedImagePreviewExpandedCache.set(item.id, false);
    selectedPaperPreviewExpandedCache.set(item.id, false);
    selectedFilePreviewExpandedCache.set(item.id, false);
    updatePaperPreviewPreservingScroll();
    updateFilePreviewPreservingScroll();
    updateSelectedTextPreviewPreservingScroll();
    updateImagePreviewPreservingScroll();
  };
  body.addEventListener("mousedown", dismissPinnedContextPanels, true);
  bodyWithPinnedDismiss.__llmPinnedContextDismissHandler =
    dismissPinnedContextPanels;

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      cancelPanelRequest(body);
      if (status) setStatus(status, "Ready", "ready");
      // Re-enable UI
      if (sendBtn) {
        sendBtn.style.display = "";
        sendBtn.disabled = false;
      }
      cancelBtn.style.display = "none";
      if (historyNewBtn) {
        historyNewBtn.disabled = false;
        historyNewBtn.setAttribute("aria-disabled", "false");
      }
      if (historyToggleBtn) {
        historyToggleBtn.disabled = false;
        historyToggleBtn.setAttribute("aria-disabled", "false");
      }
    });
  }

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener("click", (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      closePaperPicker();
      closeExportMenu();
      closePromptMenu();
      closeHistoryMenu();
      activeEditSession = null;
      if (!item) return;
      const conversationToClear = getConversationKey(item);
      const currentItemId = item.id;
      const libraryID = getCurrentLibraryID();
      clearTransientComposeStateForItem(currentItemId, conversationToClear);
      resetComposePreviewUI();
      void (async () => {
        chatHistory.delete(conversationToClear);
        loadedConversationKeys.add(conversationToClear);
        try {
          await clearStoredConversation(conversationToClear);
        } catch (err) {
          ztoolkit.log("LLM: Failed to clear persisted chat history", err);
        }
        try {
          await clearOwnerAttachmentRefs("conversation", conversationToClear);
        } catch (err) {
          ztoolkit.log(
            "LLM: Failed to clear conversation attachment refs",
            err,
          );
        }
        try {
          await removeConversationAttachmentFiles(conversationToClear);
        } catch (err) {
          ztoolkit.log("LLM: Failed to clear chat attachment files", err);
        }

        if (isGlobalMode() && libraryID > 0) {
          try {
            await deleteGlobalConversation(conversationToClear);
          } catch (err) {
            ztoolkit.log("LLM: Failed to delete global conversation row", err);
          }
          let nextConversationKey = 0;
          try {
            const nextConversations = await listGlobalConversations(
              libraryID,
              1,
              true,
            );
            nextConversationKey = nextConversations[0]?.conversationKey || 0;
          } catch (err) {
            ztoolkit.log(
              "LLM: Failed to load next global conversation after clear",
              err,
            );
          }
          if (!nextConversationKey) {
            if (basePaperItem) {
              const paperKey = activePaperConversationByItem.get(basePaperItem.id);
              if (paperKey && paperKey > 0) {
                await switchPaperConversation(paperKey);
              }
              void refreshGlobalHistoryHeader();
              scheduleAttachmentGc();
              if (status) setStatus(status, "Cleared", "ready");
              return;
            }
            nextConversationKey = await createGlobalConversation(libraryID);
          }
          if (nextConversationKey > 0) {
            activeGlobalConversationByLibrary.set(
              libraryID,
              nextConversationKey,
            );
            await switchGlobalConversation(nextConversationKey);
          } else {
            refreshChatPreservingScroll();
          }
          void refreshGlobalHistoryHeader();
        } else {
          refreshChatPreservingScroll();
          void refreshGlobalHistoryHeader();
        }
        scheduleAttachmentGc();
        if (status) setStatus(status, "Cleared", "ready");
      })();
    });
  }

  // Listen for model config changes from the Setting tab
  // so the Discussion tab model menu refreshes immediately.
  if (panelDoc) {
    panelDoc.addEventListener("llm-models-changed", () => {
      updateModelButton();
    });
  }
}
