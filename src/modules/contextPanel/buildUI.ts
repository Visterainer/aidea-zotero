import { createElement } from "../../utils/domHelpers";
import {
  SCREENSHOT_EXPANDED_LABEL,
  UPLOAD_FILE_EXPANDED_LABEL,
  formatFigureCountLabel,
  formatFileCountLabel,
} from "./constants";
import type { ActionDropdownSpec } from "./types";
import { isGlobalPortalItem } from "./portalScope";
import { getPanelI18n } from "./i18n";

function createActionDropdown(doc: Document, spec: ActionDropdownSpec) {
  const slot = createElement(
    doc,
    "div",
    `llm-action-slot ${spec.slotClassName}`.trim(),
    { id: spec.slotId },
  );
  const button = createElement(doc, "button", spec.buttonClassName, {
    id: spec.buttonId,
    textContent: spec.buttonText,
    disabled: spec.disabled,
  });
  const menu = createElement(doc, "div", spec.menuClassName, {
    id: spec.menuId,
  });
  menu.style.display = "none";
  slot.append(button, menu);
  return { slot, button, menu };
}

function buildUI(body: Element, item?: Zotero.Item | null) {
  body.textContent = "";
  const doc = body.ownerDocument!;
  const hasItem = Boolean(item);
  const isGlobalMode = Boolean(item && isGlobalPortalItem(item));
  const conversationItemId =
    hasItem && item
      ? item.isAttachment() && item.parentID
        ? item.parentID
        : item.id
      : 0;
  const i18n = getPanelI18n();

  // Disable CSS scroll anchoring on the Zotero-provided panel body so that
  // Gecko doesn't fight with our programmatic scroll management.
  if (body instanceof (doc.defaultView?.HTMLElement || HTMLElement)) {
    const hostBody = body as HTMLElement;
    hostBody.style.overflowAnchor = "none";
    // Keep panel host width-bound: descendants (e.g., long KaTeX blocks)
    // must never raise the side panel's minimum width.
    hostBody.style.minWidth = "0";
    hostBody.style.width = "100%";
    hostBody.style.maxWidth = "100%";
    hostBody.style.overflowX = "hidden";
    hostBody.style.boxSizing = "border-box";
  }

  // Main container
  const container = createElement(doc, "div", "llm-panel", { id: "llm-main" });
  container.dataset.itemId = conversationItemId > 0 ? `${conversationItemId}` : "";
  container.dataset.libraryId = hasItem && item ? `${item.libraryID}` : "";
  container.dataset.activeTab = "discussion";

  // ═══════════════════════════════════════════════════════════
  // Tab Navigation
  // ═══════════════════════════════════════════════════════════
  const tabNav = createElement(doc, "div", "llm-tab-nav", { id: "llm-tab-nav" });
  const tabDiscussionBtn = createElement(doc, "button", "llm-tab-btn active", {
    id: "llm-tab-btn-discussion",
    type: "button",
    textContent: i18n.tabDiscussion,
  });
  tabDiscussionBtn.dataset.tab = "discussion";
  const tabSettingBtn = createElement(doc, "button", "llm-tab-btn", {
    id: "llm-tab-btn-setting",
    type: "button",
    textContent: i18n.tabSetting,
  });
  tabSettingBtn.dataset.tab = "setting";
  const tabTranslateBtn = createElement(doc, "button", "llm-tab-btn", {
    id: "llm-tab-btn-translate",
    type: "button",
    textContent: i18n.tabTranslate,
  });
  tabTranslateBtn.dataset.tab = "translate";
  tabNav.append(tabDiscussionBtn, tabTranslateBtn, tabSettingBtn);

  // ═══════════════════════════════════════════════════════════
  // Tab Content Wrapper (upper area — shared, resize: vertical via CSS)
  // ═══════════════════════════════════════════════════════════
  const contentWrapper = createElement(doc, "div", "llm-tab-content-wrapper", {
    id: "llm-tab-content-wrapper",
  });

  // ── Discussion Panel (upper) ──
  const discussionPanel = createElement(doc, "div", "llm-tab-panel visible", {
    id: "llm-tab-panel-discussion",
  });
  discussionPanel.dataset.tab = "discussion";

  // Header section
  const header = createElement(doc, "div", "llm-header");
  const headerTop = createElement(doc, "div", "llm-header-top");
  const headerInfo = createElement(doc, "div", "llm-header-info");
  const headerIcon = createElement(doc, "img", "llm-header-icon", {
    alt: "AIdea",
    src: `chrome://aidea/content/icons/logo-talk.png`,
  }) as HTMLImageElement;
  headerIcon.style.width = "28px";
  headerIcon.style.height = "28px";
  headerIcon.style.borderRadius = "4px";
  // const title = createElement(doc, "div", "llm-title", {
  //   textContent: "LLM Assistant",
  // });
  const title = createElement(doc, "div", "llm-title", {
    id: "llm-title-static",
    textContent: i18n.title,
  });
  if (hasItem) {
    title.style.display = "none";
  }
  const historyBar = createElement(doc, "div", "llm-history-bar", {
    id: "llm-history-bar",
  });
  historyBar.style.display = hasItem ? "inline-flex" : "none";
  const historyNewBtn = createElement(doc, "button", "llm-history-new", {
    id: "llm-history-new",
    type: "button",
    textContent: "",
    title: i18n.newChat,
  });
  historyNewBtn.setAttribute("aria-label", i18n.newChat);
  const historyToggleBtn = createElement(doc, "button", "llm-history-toggle", {
    id: "llm-history-toggle",
    type: "button",
    textContent: "",
    title: i18n.history,
  });
  historyToggleBtn.setAttribute("aria-haspopup", "menu");
  historyToggleBtn.setAttribute("aria-expanded", "false");
  const historyModeIndicator = createElement(
    doc,
    "span",
    "llm-history-mode-indicator",
    {
      id: "llm-history-mode-indicator",
      textContent: "",
    },
  );
  historyModeIndicator.setAttribute("aria-live", "polite");
  historyBar.append(historyNewBtn, historyToggleBtn, historyModeIndicator);

  const exportBtn = createElement(doc, "button", "llm-btn-icon llm-export-btn llm-discussion-only", {
    id: "llm-export",
    type: "button",
    textContent: "",
    title: i18n.export,
    disabled: !hasItem,
  });
  const clearBtn = createElement(doc, "button", "llm-btn-icon llm-clear-btn llm-discussion-only", {
    id: "llm-clear",
    type: "button",
    textContent: "",
    title: i18n.clear,
  });

  headerInfo.append(headerIcon, title, exportBtn, clearBtn);
  headerTop.appendChild(headerInfo);

  headerTop.appendChild(tabNav);

  const headerActions = createElement(doc, "div", "llm-header-actions llm-discussion-only");
  headerActions.append(historyBar);
  headerTop.appendChild(headerActions);
  header.appendChild(headerTop);
  const historyMenu = createElement(doc, "div", "llm-history-menu", {
    id: "llm-history-menu",
  });
  historyMenu.style.display = "none";
  header.appendChild(historyMenu);

  const historyUndo = createElement(doc, "div", "llm-history-undo", {
    id: "llm-history-undo",
  });
  historyUndo.style.display = "none";
  const historyUndoText = createElement(doc, "span", "llm-history-undo-text", {
    id: "llm-history-undo-text",
    textContent: "",
  });
  const historyUndoBtn = createElement(doc, "button", "llm-history-undo-btn", {
    id: "llm-history-undo-btn",
    type: "button",
    textContent: i18n.undo,
    title: i18n.undo,
  });
  historyUndo.append(historyUndoText, historyUndoBtn);
  header.appendChild(historyUndo);

  container.appendChild(header);

  // Chat display area
  const chatShell = createElement(doc, "div", "llm-chat-shell", {
    id: "llm-chat-shell",
  });
  const chatBox = createElement(doc, "div", "llm-messages", {
    id: "llm-chat-box",
  });
  const scrollBottomBtn = createElement(doc, "button", "llm-scroll-bottom-btn", {
    id: "llm-scroll-bottom",
    type: "button",
    title: "Scroll to bottom",
  });
  chatShell.append(chatBox, scrollBottomBtn);
  discussionPanel.appendChild(chatShell);

  contentWrapper.appendChild(discussionPanel);

  // ── Setting Panel (upper) ──
  const settingPanel = createElement(doc, "div", "llm-tab-panel", {
    id: "llm-tab-panel-setting",
  });
  settingPanel.dataset.tab = "setting";

  const settingScroll = createElement(doc, "div", "llm-setting-scroll", {
    id: "llm-setting-scroll",
  });
  // Setting content will be populated by settingTab.ts in Phase 2
  const settingPlaceholder = createElement(doc, "div", "llm-tab-placeholder", {
    id: "llm-setting-placeholder",
    textContent: "⚙️ Setting panel loading...",
  });
  settingScroll.appendChild(settingPlaceholder);

  settingPanel.append(settingScroll);

  contentWrapper.appendChild(settingPanel);

  // ── Translate Panel (upper) ──
  const translatePanel = createElement(doc, "div", "llm-tab-panel", {
    id: "llm-tab-panel-translate",
  });
  translatePanel.dataset.tab = "translate";

  const translateScroll = createElement(doc, "div", "llm-translate-scroll", {
    id: "llm-translate-scroll",
  });

  // PDF source section
  const trSourceSection = createElement(doc, "div", "llm-tr-section", { id: "llm-tr-source-section" });
  const trSourceLabel = createElement(doc, "div", "llm-tr-label", { textContent: i18n.trCurrentPdf });
  const trPdfName = createElement(doc, "div", "llm-tr-pdf-name", {
    id: "llm-tr-pdf-name",
    textContent: i18n.trNoPdfFound,
  });
  const trPickFileBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-secondary", {
    id: "llm-tr-pick-file",
    type: "button",
    textContent: i18n.trSelectLocalPdf,
  });
  trSourceSection.append(trSourceLabel, trPdfName, trPickFileBtn);

  // Model selector
  const trModelSection = createElement(doc, "div", "llm-tr-section");
  const trModelLabel = createElement(doc, "div", "llm-tr-label", { textContent: i18n.modelSelectHint });
  const trModelSelect = createElement(doc, "select", "llm-tr-select", {
    id: "llm-tr-model",
  }) as HTMLSelectElement;
  trModelSection.append(trModelLabel, trModelSelect);

  // Language selectors row
  const trLangRow = createElement(doc, "div", "llm-tr-row");
  const trSrcLangSection = createElement(doc, "div", "llm-tr-section llm-tr-half");
  const trSrcLangLabel = createElement(doc, "div", "llm-tr-label", { textContent: i18n.trSourceLang });
  const trSrcLangSelect = createElement(doc, "select", "llm-tr-select", {
    id: "llm-tr-source-lang",
  }) as HTMLSelectElement;
  trSrcLangSection.append(trSrcLangLabel, trSrcLangSelect);

  const trTgtLangSection = createElement(doc, "div", "llm-tr-section llm-tr-half");
  const trTgtLangLabel = createElement(doc, "div", "llm-tr-label", { textContent: i18n.trTargetLang });
  const trTgtLangSelect = createElement(doc, "select", "llm-tr-select", {
    id: "llm-tr-target-lang",
  }) as HTMLSelectElement;
  trTgtLangSection.append(trTgtLangLabel, trTgtLangSelect);
  trLangRow.append(trSrcLangSection, trTgtLangSection);

  // Populate language options
  const LANG_OPTIONS = [
    { code: "en", label: "English" },
    { code: "zh-CN", label: "简体中文" },
    { code: "zh-TW", label: "繁體中文" },
    { code: "ja", label: "日本語" },
    { code: "ko", label: "한국어" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "es", label: "Español" },
    { code: "ru", label: "Русский" },
    { code: "pt", label: "Português" },
  ];
  for (const lang of LANG_OPTIONS) {
    const srcOpt = doc.createElement("option");
    srcOpt.value = lang.code;
    srcOpt.textContent = lang.label;
    if (lang.code === "en") srcOpt.selected = true;
    trSrcLangSelect.appendChild(srcOpt);

    const tgtOpt = doc.createElement("option");
    tgtOpt.value = lang.code;
    tgtOpt.textContent = lang.label;
    if (lang.code === "zh-CN") tgtOpt.selected = true;
    trTgtLangSelect.appendChild(tgtOpt);
  }

  // Output format section
  const trFormatSection = createElement(doc, "div", "llm-tr-section");
  const trFormatRow = createElement(doc, "div", "llm-tr-row llm-tr-format-row");
  const trMonoLabel = createElement(doc, "label", "llm-tr-checkbox-label", { id: "llm-tr-mono-label" });
  const trMonoInput = createElement(doc, "input", "", {
    id: "llm-tr-mono",
    type: "checkbox",
  }) as HTMLInputElement;
  trMonoInput.checked = true;
  const trMonoText = doc.createTextNode(` ${i18n.trOutputMono}`);
  trMonoLabel.append(trMonoInput, trMonoText);

  const trDualLabel = createElement(doc, "label", "llm-tr-checkbox-label", { id: "llm-tr-dual-label" });
  const trDualInput = createElement(doc, "input", "", {
    id: "llm-tr-dual",
    type: "checkbox",
  }) as HTMLInputElement;
  trDualInput.checked = true;
  const trDualText = doc.createTextNode(` ${i18n.trOutputDual}`);
  trDualLabel.append(trDualInput, trDualText);
  trFormatRow.append(trMonoLabel, trDualLabel);
  trFormatSection.appendChild(trFormatRow);

  // Advanced options
  const trAdvancedSection = createElement(doc, "div", "llm-tr-section llm-tr-advanced-section");
  const trAdvancedLabel = createElement(doc, "div", "llm-tr-label", { textContent: i18n.trAdvanced });
  const trAdvancedGrid = createElement(doc, "div", "llm-tr-advanced-grid");

  const trSkipRefsLabel = createElement(doc, "label", "llm-tr-checkbox-label");
  const trSkipRefsInput = createElement(doc, "input", "", {
    id: "llm-tr-skip-refs-auto",
    type: "checkbox",
  }) as HTMLInputElement;
  trSkipRefsInput.checked = true;
  trSkipRefsLabel.append(trSkipRefsInput, doc.createTextNode(` ${i18n.trSkipReferencesAuto}`));
  trAdvancedGrid.appendChild(trSkipRefsLabel);
  trAdvancedSection.append(trAdvancedLabel, trAdvancedGrid);

  // Save path section
  const trPathSection = createElement(doc, "div", "llm-tr-section");
  const trPathLabel = createElement(doc, "div", "llm-tr-label", { textContent: i18n.trSavePath });
  const trPathRow = createElement(doc, "div", "llm-tr-row");
  const trPathInput = createElement(doc, "input", "llm-tr-input", {
    id: "llm-tr-output-dir",
    type: "text",
    placeholder: "Required: choose output folder",
  }) as HTMLInputElement;
  const trPathBrowseBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-secondary llm-tr-btn-small", {
    id: "llm-tr-browse-dir",
    type: "button",
    textContent: i18n.trBrowsePath,
  });
  trPathRow.append(trPathInput, trPathBrowseBtn);
  trPathSection.append(trPathLabel, trPathRow);

  // Progress section
  const trProgressSection = createElement(doc, "div", "llm-tr-section llm-tr-progress-section", {
    id: "llm-tr-progress-section",
  });
  trProgressSection.style.display = "none";
  const trProgressBarOuter = createElement(doc, "div", "llm-tr-progress-bar");
  const trProgressBarInner = createElement(doc, "div", "llm-tr-progress-fill", {
    id: "llm-tr-progress-fill",
  });
  trProgressBarOuter.appendChild(trProgressBarInner);
  const trProgressText = createElement(doc, "div", "llm-tr-progress-text", {
    id: "llm-tr-progress-text",
    textContent: "",
  });
  trProgressSection.append(trProgressBarOuter, trProgressText);

  // Status display
  const trStatus = createElement(doc, "div", "llm-tr-status", {
    id: "llm-tr-status",
    textContent: i18n.trIdle,
  });

  // Action buttons
  const trActions = createElement(doc, "div", "llm-tr-actions");
  const trInstallBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-secondary", {
    id: "llm-tr-install-env",
    type: "button",
    textContent: i18n.trInstallEnv,
  });
  const trStartBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-primary", {
    id: "llm-tr-start",
    type: "button",
    textContent: i18n.trStartTranslation,
  });
  const trPauseBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-secondary", {
    id: "llm-tr-pause",
    type: "button",
    textContent: i18n.trPause,
  });
  trPauseBtn.style.display = "none";
  const trClearBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-danger", {
    id: "llm-tr-clear",
    type: "button",
    textContent: i18n.trClearCache,
  });
  trClearBtn.style.display = "none";
  trActions.append(trInstallBtn, trStartBtn, trPauseBtn, trClearBtn);

  // Assemble translate panel
  translateScroll.append(
    trSourceSection,
    trModelSection,
    trLangRow,
    trFormatSection,
    trAdvancedSection,
    trPathSection,
    trProgressSection,
    trStatus,
  );

  // Console log area — shows env install & translation output
  const trConsole = createElement(doc, "div", "llm-tr-console", {
    id: "llm-tr-console",
  });
  const trConsoleHeader = createElement(doc, "div", "llm-tr-console-header");
  const trConsoleTitle = createElement(doc, "span", "", {
    textContent: "📋 Console",
  });
  const trConsoleActions = createElement(doc, "div", "llm-tr-console-actions");

  // Copy button — use text fallback since SVG innerHTML may be stripped in Zotero
  const trConsoleCopyBtn = createElement(doc, "button", "llm-tr-console-icon-btn", {
    id: "llm-tr-console-copy",
    type: "button",
    title: "Copy all",
    textContent: "📄",
  });
  // Clear button
  const trConsoleClearBtn = createElement(doc, "button", "llm-tr-console-icon-btn", {
    id: "llm-tr-console-clear",
    type: "button",
    title: "Clear",
    textContent: "🗑",
  });
  trConsoleActions.append(trConsoleCopyBtn, trConsoleClearBtn);
  trConsoleHeader.append(trConsoleTitle, trConsoleActions);
  const trConsoleBody = createElement(doc, "div", "llm-tr-console-body", {
    id: "llm-tr-console-body",
  });
  trConsole.append(trConsoleHeader, trConsoleBody);
  translateScroll.appendChild(trConsole);

  translateScroll.appendChild(trActions);
  translatePanel.appendChild(translateScroll);
  contentWrapper.appendChild(translatePanel);
  container.appendChild(contentWrapper);

  // ═══════════════════════════════════════════════════════════
  // Context Menus (absolute positioned, attached to container)
  // ═══════════════════════════════════════════════════════════

  // Shortcut context menu
  const shortcutMenu = createElement(doc, "div", "llm-shortcut-menu", {
    id: "llm-shortcut-menu",
  });
  shortcutMenu.style.display = "none";
  const menuEditBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-edit",
    type: "button",
    textContent: i18n.edit,
  });
  const menuDeleteBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-delete",
    type: "button",
    textContent: i18n.delete,
  });
  const menuAddBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-add",
    type: "button",
    textContent: i18n.add,
  });
  const menuMoveBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-move",
    type: "button",
    textContent: i18n.move,
  });
  const menuResetBtn = createElement(doc, "button", "llm-shortcut-menu-item", {
    id: "llm-shortcut-menu-reset",
    type: "button",
    textContent: i18n.reset,
  });
  shortcutMenu.append(
    menuEditBtn,
    menuDeleteBtn,
    menuAddBtn,
    menuMoveBtn,
    menuResetBtn,
  );
  container.appendChild(shortcutMenu);

  // Response context menu
  const responseMenu = createElement(doc, "div", "llm-response-menu", {
    id: "llm-response-menu",
  });
  responseMenu.style.display = "none";
  const responseMenuCopyBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-response-menu-copy",
      type: "button",
      textContent: i18n.copy,
    },
  );
  const responseMenuNoteBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-response-menu-note",
      type: "button",
      textContent: i18n.saveAsNote,
    },
  );
  responseMenu.append(responseMenuCopyBtn, responseMenuNoteBtn);
  container.appendChild(responseMenu);

  // Prompt context menu
  const promptMenu = createElement(doc, "div", "llm-response-menu", {
    id: "llm-prompt-menu",
  });
  promptMenu.style.display = "none";
  const promptMenuEditBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-prompt-menu-edit",
      type: "button",
      textContent: i18n.edit,
    },
  );
  promptMenu.append(promptMenuEditBtn);
  container.appendChild(promptMenu);

  // Export menu
  const exportMenu = createElement(doc, "div", "llm-response-menu", {
    id: "llm-export-menu",
  });
  exportMenu.style.display = "none";
  const exportMenuCopyBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-export-copy",
      type: "button",
      textContent: i18n.copyChatMd,
    },
  );
  const exportMenuNoteBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-export-note",
      type: "button",
      textContent: i18n.saveChatAsNote,
    },
  );
  exportMenu.append(exportMenuCopyBtn, exportMenuNoteBtn);
  container.appendChild(exportMenu);

  const slashMenu = createElement(doc, "div", "llm-response-menu llm-slash-menu", {
    id: "llm-slash-menu",
  });
  slashMenu.style.display = "none";
  const slashUploadBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-slash-upload-option",
      type: "button",
      textContent: i18n.uploadFiles,
    },
  );
  const slashReferenceBtn = createElement(
    doc,
    "button",
    "llm-response-menu-item",
    {
      id: "llm-slash-reference-option",
      type: "button",
      textContent: i18n.selectReferences,
    },
  );
  slashMenu.append(slashUploadBtn, slashReferenceBtn);
  container.appendChild(slashMenu);

  // Retry model menu (opened from latest assistant retry action)
  const retryModelMenu = createElement(doc, "div", "llm-model-menu", {
    id: "llm-retry-model-menu",
  });
  retryModelMenu.style.display = "none";
  container.appendChild(retryModelMenu);

  // ═══════════════════════════════════════════════════════════
  // Tab Bottom Wrapper (lower area — shared, resize: vertical via CSS)
  // ═══════════════════════════════════════════════════════════
  const bottomWrapper = createElement(doc, "div", "llm-tab-bottom-wrapper", {
    id: "llm-tab-bottom-wrapper",
  });

  // ── Discussion Bottom ──
  const discussionBottom = createElement(doc, "div", "llm-tab-bottom visible", {
    id: "llm-tab-bottom-discussion",
  });
  discussionBottom.dataset.tab = "discussion";

  // Input section
  const inputSection = createElement(doc, "div", "llm-input-section");

  const contextPreviews = createElement(doc, "div", "llm-context-previews", {
    id: "llm-context-previews",
  });
  const selectedContextList = createElement(
    doc,
    "div",
    "llm-selected-context-list",
    {
      id: "llm-selected-context-list",
    },
  );
  selectedContextList.style.display = "none";
  contextPreviews.appendChild(selectedContextList);

  const paperPreview = createElement(doc, "div", "llm-paper-context-inline", {
    id: "llm-paper-context-preview",
  });
  paperPreview.style.display = "none";
  const paperPreviewList = createElement(
    doc,
    "div",
    "llm-paper-context-inline-list",
    {
      id: "llm-paper-context-list",
    },
  );
  paperPreview.append(paperPreviewList);
  contextPreviews.appendChild(paperPreview);

  // Image preview area (shows selected screenshot)
  const imagePreview = createElement(doc, "div", "llm-image-preview", {
    id: "llm-image-preview",
  });
  imagePreview.style.display = "none";

  const imagePreviewMeta = createElement(
    doc,
    "button",
    "llm-image-preview-meta",
    {
      id: "llm-image-preview-meta",
      type: "button",
      textContent: formatFigureCountLabel(0),
      title: "Expand figures",
    },
  );
  const imagePreviewHeader = createElement(
    doc,
    "div",
    "llm-image-preview-header",
    {
      id: "llm-image-preview-header",
    },
  );
  const removeImgBtn = createElement(doc, "button", "llm-remove-img-btn", {
    id: "llm-remove-img",
    type: "button",
    textContent: "×",
    title: "Clear selected screenshots",
  });
  removeImgBtn.setAttribute("aria-label", "Clear selected screenshots");
  imagePreviewHeader.append(imagePreviewMeta, removeImgBtn);

  const imagePreviewExpanded = createElement(
    doc,
    "div",
    "llm-image-preview-expanded",
    {
      id: "llm-image-preview-expanded",
    },
  );
  const previewStrip = createElement(doc, "div", "llm-image-preview-strip", {
    id: "llm-image-preview-strip",
  });
  const previewLargeWrap = createElement(
    doc,
    "div",
    "llm-image-preview-selected",
    {
      id: "llm-image-preview-selected",
    },
  );
  const previewLargeImg = createElement(
    doc,
    "img",
    "llm-image-preview-selected-img",
    {
      id: "llm-image-preview-selected-img",
      alt: "Selected screenshot preview",
    },
  ) as HTMLImageElement;
  previewLargeWrap.appendChild(previewLargeImg);

  imagePreviewExpanded.append(previewStrip, previewLargeWrap);
  imagePreview.append(imagePreviewHeader, imagePreviewExpanded);
  contextPreviews.appendChild(imagePreview);

  const filePreview = createElement(doc, "div", "llm-image-preview", {
    id: "llm-file-context-preview",
  });
  filePreview.style.display = "none";
  const filePreviewMeta = createElement(
    doc,
    "button",
    "llm-image-preview-meta llm-file-context-meta",
    {
      id: "llm-file-context-meta",
      type: "button",
      textContent: formatFileCountLabel(0),
      title: "Expand files",
    },
  );
  const filePreviewHeader = createElement(
    doc,
    "div",
    "llm-image-preview-header",
    {
      id: "llm-file-context-header",
    },
  );
  const filePreviewClear = createElement(doc, "button", "llm-remove-img-btn", {
    id: "llm-file-context-clear",
    type: "button",
    textContent: "×",
    title: "Clear uploaded files",
  });
  filePreviewHeader.append(filePreviewMeta, filePreviewClear);
  const filePreviewExpanded = createElement(
    doc,
    "div",
    "llm-image-preview-expanded llm-file-context-expanded",
    {
      id: "llm-file-context-expanded",
    },
  );
  const filePreviewList = createElement(doc, "div", "llm-file-context-list", {
    id: "llm-file-context-list",
  });
  filePreviewExpanded.append(filePreviewList);
  filePreview.append(filePreviewHeader, filePreviewExpanded);
  contextPreviews.appendChild(filePreview);
  inputSection.appendChild(contextPreviews);

  const paperPicker = createElement(doc, "div", "llm-paper-picker", {
    id: "llm-paper-picker",
  });
  paperPicker.style.display = "none";
  const paperPickerList = createElement(doc, "div", "llm-paper-picker-list", {
    id: "llm-paper-picker-list",
  });
  paperPickerList.setAttribute("role", "listbox");
  paperPicker.appendChild(paperPickerList);
  inputSection.appendChild(paperPicker);

  const inputBox = createElement(doc, "textarea", "llm-input", {
    id: "llm-input",
    placeholder: hasItem
      ? isGlobalMode
        ? i18n.placeholderGlobal
        : i18n.placeholderPaper
      : "Open a PDF first",
    disabled: !hasItem,
  });
  inputSection.appendChild(inputBox);

  // Actions row
  const actionsRow = createElement(doc, "div", "llm-actions");
  const actionsLeft = createElement(doc, "div", "llm-actions-left");
  const actionsRight = createElement(doc, "div", "llm-actions-right");

  const selectTextBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-select-text-btn llm-action-icon-only",
    {
      id: "llm-select-text",
      textContent: "",
      title: i18n.addTextTitle,
      disabled: !hasItem,
    },
  );
  const selectTextSlot = createElement(doc, "div", "llm-action-slot");
  selectTextSlot.appendChild(selectTextBtn);

  // Screenshot button
  const screenshotBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-screenshot-btn",
    {
      id: "llm-screenshot",
      textContent: SCREENSHOT_EXPANDED_LABEL,
      title: "Select figure screenshot",
      disabled: !hasItem,
    },
  );
  const screenshotSlot = createElement(doc, "div", "llm-action-slot");
  screenshotSlot.appendChild(screenshotBtn);

  const uploadBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-upload-file-btn llm-slash-menu-btn",
    {
      id: "llm-upload-file",
      type: "button",
      textContent: UPLOAD_FILE_EXPANDED_LABEL,
      title: "Context actions",
      disabled: !hasItem,
    },
  );
  uploadBtn.setAttribute("aria-haspopup", "menu");
  uploadBtn.setAttribute("aria-expanded", "false");
  uploadBtn.setAttribute("aria-label", "Context actions");
  const uploadInput = createElement(doc, "input", "", {
    id: "llm-upload-input",
    type: "file",
  }) as HTMLInputElement;
  uploadInput.multiple = true;
  uploadInput.style.display = "none";
  const uploadSlot = createElement(doc, "div", "llm-action-slot");
  uploadSlot.append(uploadBtn, uploadInput);

  const {
    slot: modelDropdown,
    button: modelBtn,
    menu: modelMenu,
  } = createActionDropdown(doc, {
    slotId: "llm-model-dropdown",
    slotClassName: "llm-model-dropdown",
    buttonId: "llm-model-toggle",
    buttonClassName:
      "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-model-btn",
    buttonText: "Model: ...",
    menuId: "llm-model-menu",
    menuClassName: "llm-model-menu",
    disabled: !hasItem,
  });

  const sendBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-primary llm-send-btn",
    {
      id: "llm-send",
      textContent: i18n.send,
      title: i18n.send,
      disabled: !hasItem,
    },
  );
  const cancelBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-danger llm-send-btn llm-cancel-btn",
    {
      id: "llm-cancel",
      textContent: i18n.cancel,
    },
  );
  cancelBtn.style.display = "none";
  const sendSlot = createElement(doc, "div", "llm-action-slot");
  sendSlot.append(sendBtn, cancelBtn);

  // New conversation button
  const newChatBtn = createElement(
    doc,
    "button",
    "llm-shortcut-btn llm-action-btn llm-action-btn-secondary llm-new-chat-btn llm-action-icon-only",
    {
      id: "llm-new-chat",
      type: "button",
      textContent: "",
      title: "New conversation",
    },
  );
  const newChatSlot = createElement(doc, "div", "llm-action-slot");
  newChatSlot.appendChild(newChatBtn);

  // Order: ➕ new chat, 📎 upload/attach, ✂️ screenshot, Add Text, Model
  actionsLeft.append(newChatSlot, uploadSlot, screenshotSlot, selectTextSlot, modelDropdown);
  actionsRight.append(sendSlot);
  actionsRow.append(actionsLeft, actionsRight);
  inputSection.appendChild(actionsRow);

  // Shortcuts row — placed in bottomWrapper so contentWrapper's
  // resize grip appears between chat and shortcuts
  const shortcutsRow = createElement(doc, "div", "llm-shortcuts", {
    id: "llm-shortcuts",
  });
  discussionBottom.append(shortcutsRow, inputSection);

  bottomWrapper.appendChild(discussionBottom);
  container.appendChild(bottomWrapper);

  // ═══════════════════════════════════════════════════════════
  // Status line + final assembly
  // ═══════════════════════════════════════════════════════════
  const statusLine = createElement(doc, "div", "llm-status", {
    id: "llm-status",
    textContent: hasItem
      ? isGlobalMode
        ? i18n.statusNoContext
        : i18n.statusReady
      : i18n.statusSelectItem,
  });
  container.appendChild(statusLine);
  body.appendChild(container);

  // ═══════════════════════════════════════════════════════════
  // Tab switching logic
  // ═══════════════════════════════════════════════════════════
  const tabBtns = [tabDiscussionBtn, tabTranslateBtn, tabSettingBtn];
  const tabPanels = [discussionPanel, settingPanel, translatePanel];
  for (const btn of tabBtns) {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      // Track active tab on container for CSS-driven visibility
      container.dataset.activeTab = tab || "discussion";
      // Update button active state
      for (const b of tabBtns) b.classList.toggle("active", b === btn);
      // Toggle panel visibility
      for (const p of tabPanels) p.classList.toggle("visible", p.dataset.tab === tab);
      // Discussion bottom: only visible in discussion tab
      discussionBottom.classList.toggle("visible", tab === "discussion");
      // Swap header icon based on active tab
      (headerIcon as HTMLImageElement).src = tab === "setting"
        ? "chrome://aidea/content/icons/logo-setting.png"
        : "chrome://aidea/content/icons/logo-talk.png";
    });
  }
}

export { buildUI };
