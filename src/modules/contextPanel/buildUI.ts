import { config } from "../../../package.json";
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
  // Apply auto-hide if user preference is set
  try {
    const hideNav = Zotero.Prefs.get(`${config.prefsPrefix}.hideTabNav`, true);
    if (hideNav === true || String(hideNav).toLowerCase() === "true") {
      tabNav.classList.add("llm-tab-nav--auto-hide");
    }
  } catch { /* pref not yet registered */ }
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

  // Root container
  const trRoot = createElement(doc, "div", "llm-tr-root");

  // ── Helper: create a collapsible section (title + body) ──
  const buildSection = (id: string, label: string, defaultOpen: boolean) => {
    const title = createElement(doc, "div", "llm-tr-title llm-tr-collapsible-toggle", { id: `${id}-toggle` });
    title.textContent = label;
    title.dataset.collapsed = defaultOpen ? "false" : "true";
    const body = createElement(doc, "div", "llm-tr-section-body", { id: `${id}-body` });
    if (!defaultOpen) body.style.display = "none";
    title.addEventListener("click", () => {
      const isOpen = title.dataset.collapsed === "false";
      title.dataset.collapsed = isOpen ? "true" : "false";
      body.style.display = isOpen ? "none" : "";
    });
    return { title, body };
  };

  // ═══════════════════════════════════════════════════════════
  // Section 1: 基础配置 (Basic Config) — default open
  // ═══════════════════════════════════════════════════════════
  const sec1 = buildSection("llm-tr-sec-basic", i18n.trSectionBasic, true);

  // Input path row: [label] [input] [select file btn]
  const trInputPathSection = createElement(doc, "div", "llm-tr-path-block");
  const trInputPathLabel = createElement(doc, "div", "llm-tr-field-label", { textContent: i18n.trInputPath });
  const trInputPathRow = createElement(doc, "div", "llm-tr-row");
  const trPdfName = createElement(doc, "div", "llm-tr-pdf-name", {
    id: "llm-tr-pdf-name",
    textContent: i18n.trNoPdfFound,
  });
  const trPickFileBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-primary llm-tr-btn-small", {
    id: "llm-tr-pick-file",
    type: "button",
    textContent: i18n.trSelectLocalPdf,
  });
  trInputPathRow.append(trPdfName, trPickFileBtn);
  trInputPathSection.append(trInputPathLabel, trInputPathRow);

  // Save path row: [label] [input] [browse btn] — aligned with input path
  const trSavePathSection = createElement(doc, "div", "llm-tr-path-block");
  const trSavePathLabel = createElement(doc, "div", "llm-tr-field-label", { textContent: i18n.trSavePath });
  const trSavePathRow = createElement(doc, "div", "llm-tr-row");
  const trPathInput = createElement(doc, "input", "llm-tr-input", {
    id: "llm-tr-output-dir",
    type: "text",
    placeholder: "Required: choose output folder",
  }) as HTMLInputElement;
  const trPathBrowseBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-primary llm-tr-btn-small", {
    id: "llm-tr-browse-dir",
    type: "button",
    textContent: i18n.trBrowsePath,
  });
  trSavePathRow.append(trPathInput, trPathBrowseBtn);
  trSavePathSection.append(trSavePathLabel, trSavePathRow);

  // Model selector row — custom dropdown to avoid native select styling issues
  const trModelRow = createElement(doc, "div", "llm-tr-path-block");
  const trModelLabel = createElement(doc, "div", "llm-tr-field-label", { textContent: i18n.modelSelectHint });
  // Custom dropdown wrapper
  const trModelDropdown = createElement(doc, "div", "llm-tr-dropdown", { id: "llm-tr-model" }) as HTMLDivElement;
  const trModelTrigger = createElement(doc, "div", "llm-tr-dropdown-trigger") as HTMLDivElement;
  trModelTrigger.textContent = "—";
  const trModelArrow = createElement(doc, "span", "llm-tr-dropdown-arrow") as HTMLSpanElement;
  trModelArrow.textContent = "▾";
  trModelTrigger.appendChild(trModelArrow);
  const trModelMenu = createElement(doc, "div", "llm-tr-dropdown-menu") as HTMLDivElement;
  trModelMenu.style.display = "none";
  trModelDropdown.append(trModelTrigger, trModelMenu);
  // Toggle menu on trigger click
  trModelTrigger.addEventListener("click", () => {
    const open = trModelMenu.style.display !== "none";
    trModelMenu.style.display = open ? "none" : "block";
    trModelDropdown.classList.toggle("open", !open);
  });
  // Close on outside click
  doc.addEventListener("click", (e: Event) => {
    if (!trModelDropdown.contains(e.target as Node)) {
      trModelMenu.style.display = "none";
      trModelDropdown.classList.remove("open");
    }
  });
  trModelRow.append(trModelLabel, trModelDropdown);

  // ── Reusable custom dropdown builder ──
  const buildDropdown = (id: string, options: { value: string; label: string }[], defaultValue: string) => {
    const dd = createElement(doc, "div", "llm-tr-dropdown", { id }) as HTMLDivElement;
    const trigger = createElement(doc, "div", "llm-tr-dropdown-trigger") as HTMLDivElement;
    const arrow = createElement(doc, "span", "llm-tr-dropdown-arrow") as HTMLSpanElement;
    arrow.textContent = "▾";
    trigger.textContent = "—";
    trigger.appendChild(arrow);
    const menu = createElement(doc, "div", "llm-tr-dropdown-menu") as HTMLDivElement;
    menu.style.display = "none";
    dd.append(trigger, menu);

    const selectItem = (value: string, label: string) => {
      dd.dataset.value = value;
      const arrowEl = trigger.querySelector(".llm-tr-dropdown-arrow");
      trigger.textContent = label;
      if (arrowEl) trigger.appendChild(arrowEl);
      menu.querySelectorAll(".llm-tr-dropdown-item").forEach((el: Element) => {
        (el as HTMLElement).classList.toggle("selected", (el as HTMLElement).dataset.value === value);
      });
      menu.style.display = "none";
      dd.classList.remove("open");
    };

    for (const opt of options) {
      const item = createElement(doc, "div", "llm-tr-dropdown-item") as HTMLDivElement;
      item.dataset.value = opt.value;
      item.textContent = opt.label;
      item.addEventListener("click", () => selectItem(opt.value, opt.label));
      menu.appendChild(item);
    }

    // Set default
    const defaultOpt = options.find(o => o.value === defaultValue) || options[0];
    if (defaultOpt) selectItem(defaultOpt.value, defaultOpt.label);

    trigger.addEventListener("click", () => {
      const open = menu.style.display !== "none";
      menu.style.display = open ? "none" : "block";
      dd.classList.toggle("open", !open);
    });
    doc.addEventListener("click", (e: Event) => {
      if (!dd.contains(e.target as Node)) {
        menu.style.display = "none";
        dd.classList.remove("open");
      }
    });

    return dd;
  };

  // Language selectors with swap button
  const trLangRow = createElement(doc, "div", "llm-tr-lang-row");
  const trSrcLangSection = createElement(doc, "div", "llm-tr-lang-half");
  const trSrcLangLabel = createElement(doc, "div", "llm-tr-field-label", { textContent: i18n.trSourceLang });

  const trTgtLangSection = createElement(doc, "div", "llm-tr-lang-half");
  const trTgtLangLabel = createElement(doc, "div", "llm-tr-field-label", { textContent: i18n.trTargetLang });

  const trLangSwapBtn = createElement(doc, "button", "llm-tr-lang-swap", {
    id: "llm-tr-lang-swap",
    type: "button",
    textContent: "⇄",
    title: "Swap languages",
  });

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
    { code: "ar", label: "العربية" },
    { code: "hi", label: "हिन्दी" },
    { code: "it", label: "Italiano" },
    { code: "nl", label: "Nederlands" },
    { code: "pl", label: "Polski" },
    { code: "tr", label: "Türkçe" },
    { code: "vi", label: "Tiếng Việt" },
    { code: "th", label: "ภาษาไทย" },
    { code: "id", label: "Bahasa Indonesia" },
    { code: "uk", label: "Українська" },
  ];
  const langDropdownOpts = LANG_OPTIONS.map(l => ({ value: l.code, label: l.label }));

  const trSrcLangSelect = buildDropdown("llm-tr-source-lang", langDropdownOpts, "en");
  const trTgtLangSelect = buildDropdown("llm-tr-target-lang", langDropdownOpts, "zh-CN");

  trSrcLangSection.append(trSrcLangLabel, trSrcLangSelect);
  trTgtLangSection.append(trTgtLangLabel, trTgtLangSelect);
  trLangRow.append(trSrcLangSection, trLangSwapBtn, trTgtLangSection);

  // Assemble section 1
  sec1.body.append(trInputPathSection, trSavePathSection, trModelRow, trLangRow);

  // ═══════════════════════════════════════════════════════════
  // Section 2: 翻译引擎 (Translation Engine) — default open
  // ═══════════════════════════════════════════════════════════
  const sec2 = buildSection("llm-tr-sec-engine", i18n.trSectionEngine, true);

  // Output format checkboxes
  const trOptionsTitle = createElement(doc, "div", "llm-tr-subtitle", { textContent: i18n.trOutputFormat });
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

  const trSkipRefsLabel = createElement(doc, "label", "llm-tr-checkbox-label");
  const trSkipRefsInput = createElement(doc, "input", "", {
    id: "llm-tr-skip-refs-auto",
    type: "checkbox",
  }) as HTMLInputElement;
  trSkipRefsInput.checked = true;
  trSkipRefsLabel.title = i18n.trHintSkipReferences;
  trSkipRefsLabel.append(trSkipRefsInput, doc.createTextNode(` ${i18n.trSkipReferencesAuto}`));

  trFormatRow.append(trMonoLabel, trDualLabel, trSkipRefsLabel);

  // Helper: build a numeric stepper (label + ‹ [input] ›)
  const buildStepper = (id: string, label: string, defaultVal: number, min: number, max: number, step: number) => {
    const wrapper = createElement(doc, "div", "llm-tr-stepper");
    const lbl = createElement(doc, "span", "llm-tr-stepper-label", { textContent: label });
    const group = createElement(doc, "div", "llm-tr-stepper-group");

    // Arrow style helper
    const makeArrow = (text: string) => {
      const arrow = createElement(doc, "span", "") as HTMLSpanElement;
      arrow.textContent = text;
      Object.assign(arrow.style, {
        color: "#888", fontSize: "14px", fontWeight: "700",
        cursor: "pointer", userSelect: "none",
        padding: "0 3px", lineHeight: "20px",
        transition: "color 0.15s ease",
      });
      arrow.addEventListener("mouseenter", () => { arrow.style.color = "#ccc"; });
      arrow.addEventListener("mouseleave", () => { arrow.style.color = "#888"; });
      return arrow;
    };

    const btnDec = makeArrow("‹");
    const btnInc = makeArrow("›");

    // Editable value
    const valInput = createElement(doc, "div", "llm-tr-stepper-value", { id }) as HTMLDivElement;
    valInput.setAttribute("contenteditable", "true");
    valInput.textContent = String(defaultVal);
    Object.assign(valInput.style, {
      width: "40px", height: "20px", lineHeight: "20px",
      padding: "0 4px", margin: "0",
      border: "1px solid rgba(128,128,128,0.25)",
      borderRadius: "4px",
      color: "inherit", fontSize: "10px", fontFamily: "inherit",
      textAlign: "center", boxSizing: "border-box",
      cursor: "text", overflow: "hidden", whiteSpace: "nowrap",
    });
    valInput.style.setProperty("background", "color-mix(in srgb, var(--material-sidepane, #2b2b2b) 92%, var(--fill-primary, #fff) 8%)");

    const clamp = () => {
      let v = parseInt(valInput.textContent || String(defaultVal), 10);
      if (isNaN(v)) v = defaultVal;
      valInput.textContent = String(Math.max(min, Math.min(max, v)));
    };

    btnDec.addEventListener("click", () => {
      clamp();
      let v = parseInt(valInput.textContent || String(defaultVal), 10);
      valInput.textContent = String(Math.max(min, v - step));
    });
    btnInc.addEventListener("click", () => {
      clamp();
      let v = parseInt(valInput.textContent || String(defaultVal), 10);
      valInput.textContent = String(Math.min(max, v + step));
    });
    valInput.addEventListener("keydown", (e: Event) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        clamp();
        (valInput as HTMLElement).blur();
      }
    });
    valInput.addEventListener("blur", clamp);

    group.append(btnDec, valInput, btnInc);
    wrapper.append(lbl, group);
    return wrapper;
  };

  // Collapsible Advanced sub-section (collapsed by default)
  const trAdvTitle = createElement(doc, "div", "llm-tr-subtitle llm-tr-collapsible-toggle", {
    id: "llm-tr-advanced-toggle",
  });
  trAdvTitle.textContent = i18n.trAdvanced;
  trAdvTitle.dataset.collapsed = "true";

  const trAdvBody = createElement(doc, "div", "llm-tr-advanced-body", {
    id: "llm-tr-advanced-body",
  });
  trAdvBody.style.display = "none";

  trAdvTitle.addEventListener("click", () => {
    const isOpen = trAdvTitle.dataset.collapsed === "false";
    trAdvTitle.dataset.collapsed = isOpen ? "true" : "false";
    trAdvBody.style.display = isOpen ? "none" : "";
  });

  // Helper to create advanced checkbox with tooltip
  const advCheck = (id: string, label: string, checked: boolean, tooltip?: string) => {
    const row = createElement(doc, "label", "llm-tr-checkbox-label llm-tr-adv-label");
    if (tooltip) row.title = tooltip;
    const inp = createElement(doc, "input", "", { id, type: "checkbox" }) as HTMLInputElement;
    inp.checked = checked;
    row.append(inp, doc.createTextNode(` ${label}`));
    return row;
  };

  // Pool stepper & QPS stepper
  const trPoolStepper = buildStepper("llm-tr-pool-max-worker", i18n.trPoolMaxWorker, 1, 1, 32, 1);
  trPoolStepper.title = i18n.trHintPoolMaxWorker;
  const advQpsStepper = buildStepper("llm-tr-qps", i18n.trQps, 10, 1, 100, 1);
  advQpsStepper.title = i18n.trHintQps;

  // Advanced checkboxes
  const advKeepAppendix = advCheck("llm-tr-keep-appendix", i18n.trKeepAppendixTranslated, true, i18n.trHintKeepAppendix);
  const advProtectAuthor = advCheck("llm-tr-protect-author", i18n.trProtectAuthorBlock, true, i18n.trHintProtectAuthor);
  const advDisableRichText = advCheck("llm-tr-disable-rich-text", i18n.trDisableRichTextTranslate, false, i18n.trHintDisableRichText);
  const advEnhanceCompat = advCheck("llm-tr-enhance-compat", i18n.trEnhanceCompatibility, false, i18n.trHintEnhanceCompat);
  const advTranslateTable = advCheck("llm-tr-translate-table", i18n.trTranslateTableText, false, i18n.trHintTranslateTable);
  const advOcr = advCheck("llm-tr-ocr", i18n.trOCR, false, i18n.trHintOcr);
  const advAutoOcr = advCheck("llm-tr-auto-ocr", i18n.trAutoOCR, true, i18n.trHintAutoOcr);
  const advSaveGlossary = advCheck("llm-tr-save-glossary", i18n.trSaveGlossary, true, i18n.trHintSaveGlossary);
  const advDisableGlossary = advCheck("llm-tr-disable-glossary", i18n.trDisableGlossary, false, i18n.trHintDisableGlossary);

  // Font family drop-down (custom dropdown)
  const advFontRow = createElement(doc, "div", "llm-tr-row llm-tr-adv-font-row");
  advFontRow.title = i18n.trHintFontFamily;
  const advFontLabel = createElement(doc, "span", "llm-tr-adv-font-label", { textContent: i18n.trFontFamily });
  const advFontSelect = buildDropdown("llm-tr-font-family", [
    { value: "auto", label: i18n.trFontFamilyAuto },
    { value: "serif", label: i18n.trFontFamilySerif },
    { value: "sans-serif", label: i18n.trFontFamilySansSerif },
    { value: "script", label: i18n.trFontFamilyScript },
  ], "auto");
  advFontRow.append(advFontLabel, advFontSelect);

  trAdvBody.append(
    trPoolStepper, advQpsStepper,
    advKeepAppendix, advProtectAuthor,
    advDisableRichText, advEnhanceCompat, advTranslateTable,
    advOcr, advAutoOcr,
    advSaveGlossary, advDisableGlossary,
    advFontRow,
  );

  // Assemble section 2
  sec2.body.append(trOptionsTitle, trFormatRow, trAdvTitle, trAdvBody);

  // ═══════════════════════════════════════════════════════════
  // Section 3: 执行 (Execute) — default open
  // ═══════════════════════════════════════════════════════════
  const sec3 = buildSection("llm-tr-sec-exec", i18n.trSectionExecute, true);

  // Progress bar
  const trProgressSection = createElement(doc, "div", "llm-tr-progress-section", {
    id: "llm-tr-progress-section",
  });
  const trProgressBarOuter = createElement(doc, "div", "llm-tr-progress-bar");
  const trProgressBarInner = createElement(doc, "div", "llm-tr-progress-fill", {
    id: "llm-tr-progress-fill",
  });
  trProgressBarOuter.appendChild(trProgressBarInner);
  trProgressSection.appendChild(trProgressBarOuter);

  // Console (collapsible, default EXPANDED)
  const SVG_NS = "http://www.w3.org/2000/svg";
  const trConsoleTitle = createElement(doc, "div", "llm-tr-subtitle llm-tr-collapsible-toggle", {
    id: "llm-tr-console-toggle",
  });
  trConsoleTitle.textContent = "Console";
  trConsoleTitle.dataset.collapsed = "false";

  const trConsole = createElement(doc, "div", "llm-tr-console", {
    id: "llm-tr-console",
  });
  // default expanded — no display:none

  trConsoleTitle.addEventListener("click", () => {
    const isOpen = trConsoleTitle.dataset.collapsed === "false";
    trConsoleTitle.dataset.collapsed = isOpen ? "true" : "false";
    trConsole.style.display = isOpen ? "none" : "";
  });

  const trConsoleHeader = createElement(doc, "div", "llm-tr-console-header");
  const trConsoleActions = createElement(doc, "div", "llm-tr-console-actions");

  // Copy button with SVG icon
  const trConsoleCopyBtn = createElement(doc, "button", "llm-tr-console-icon-btn", {
    id: "llm-tr-console-copy",
    type: "button",
    title: "Copy all",
  });
  const copySvg = doc.createElementNS(SVG_NS, "svg");
  copySvg.setAttribute("viewBox", "0 0 16 16");
  for (const d of [
    "M4 4V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2",
    "M2 6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6z",
  ]) {
    const p = doc.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    copySvg.appendChild(p);
  }
  trConsoleCopyBtn.appendChild(copySvg);

  // Clear button with SVG icon
  const trConsoleClearBtn = createElement(doc, "button", "llm-tr-console-icon-btn", {
    id: "llm-tr-console-clear",
    type: "button",
    title: "Clear",
  });
  const trashSvg = doc.createElementNS(SVG_NS, "svg");
  trashSvg.setAttribute("viewBox", "0 0 16 16");
  for (const d of [
    "M2 4h12",
    "M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4",
    "M3.333 4v9.333a1.333 1.333 0 0 0 1.334 1.334h6.666a1.333 1.333 0 0 0 1.334-1.334V4",
    "M6.667 7.333v4",
    "M9.333 7.333v4",
  ]) {
    const p = doc.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    trashSvg.appendChild(p);
  }
  trConsoleClearBtn.appendChild(trashSvg);

  trConsoleActions.append(trConsoleCopyBtn, trConsoleClearBtn);
  trConsoleHeader.appendChild(trConsoleActions);
  const trConsoleBody = createElement(doc, "div", "llm-tr-console-body", {
    id: "llm-tr-console-body",
  });
  trConsole.append(trConsoleHeader, trConsoleBody);

  // Action buttons: [Install] ... spacer ... [Start / Pause] [Clear]
  const trInstallBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-pink llm-tr-btn-action", {
    id: "llm-tr-install-env",
    type: "button",
    textContent: `⚙ ${i18n.trInstallEnv}`,
  });
  const trStartBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-primary llm-tr-btn-action", {
    id: "llm-tr-start",
    type: "button",
    textContent: `▶ ${i18n.trStartTranslation}`,
  });
  const trPauseBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-warning llm-tr-btn-action", {
    id: "llm-tr-pause",
    type: "button",
    textContent: `⏸ ${i18n.trPause}`,
  });
  trPauseBtn.style.display = "none";
  const trClearBtn = createElement(doc, "button", "llm-tr-btn llm-tr-btn-danger llm-tr-btn-action", {
    id: "llm-tr-clear",
    type: "button",
    textContent: `🗑 ${i18n.trClearCache}`,
  });
  const trActions = createElement(doc, "div", "llm-tr-actions");
  const trActionsSpacer = createElement(doc, "div", "llm-tr-actions-spacer");
  trActions.append(trInstallBtn, trActionsSpacer, trStartBtn, trPauseBtn, trClearBtn);

  // Assemble section 3
  sec3.body.append(trProgressSection, trConsoleTitle, trConsole, trActions);

  // ═══════════════════════════════════════════════════════════
  // Assemble all sections into root
  // ═══════════════════════════════════════════════════════════
  trRoot.append(
    sec1.title, sec1.body,
    sec2.title, sec2.body,
    sec3.title, sec3.body,
  );
  translateScroll.appendChild(trRoot);
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

  // ── Setting Bottom (spacer to maintain height) ──
  const settingBottom = createElement(doc, "div", "llm-tab-bottom", {
    id: "llm-tab-bottom-setting",
  });
  settingBottom.dataset.tab = "setting";
  // Setting tab uses the bottom as a spacer — no content needed,
  // but it fills the space so wrapper height stays linked.
  bottomWrapper.appendChild(settingBottom);

  // ── Translate Bottom (spacer to maintain height, like Setting) ──
  const translateBottom = createElement(doc, "div", "llm-tab-bottom", {
    id: "llm-tab-bottom-translate",
  });
  translateBottom.dataset.tab = "translate";
  // Console + actions are now inside translateScroll (contentWrapper),
  // so this bottom panel is an empty spacer — same as settingBottom.
  bottomWrapper.appendChild(translateBottom);

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
  const tabBottoms = [discussionBottom, settingBottom, translateBottom];
  for (const btn of tabBtns) {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      // Track active tab on container for CSS-driven visibility
      container.dataset.activeTab = tab || "discussion";
      // Update button active state
      for (const b of tabBtns) b.classList.toggle("active", b === btn);
      // Toggle panel visibility (upper)
      for (const p of tabPanels) p.classList.toggle("visible", p.dataset.tab === tab);
      // Toggle bottom visibility (lower) — wrapper always visible, height stays linked
      for (const b of tabBottoms) b.classList.toggle("visible", b.dataset.tab === tab);
      // Swap header icon based on active tab
      const logoMap: Record<string, string> = {
        discussion: "chrome://aidea/content/icons/logo-talk.png",
        translate: "chrome://aidea/content/icons/logo-translate.png",
        setting: "chrome://aidea/content/icons/logo-setting.png",
      };
      const activeTab = tab || "discussion";
      (headerIcon as HTMLImageElement).src =
        logoMap[activeTab] ?? "chrome://aidea/content/icons/logo-talk.png";
    });
  }
}

export { buildUI };
