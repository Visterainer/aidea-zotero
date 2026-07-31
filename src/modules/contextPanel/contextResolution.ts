import {
  sanitizeText,
  normalizeSelectedText,
  isLikelyCorruptedSelectedText,
  setStatus,
} from "./textUtils";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  normalizePaperContextRefs,
  normalizeSelectedTextSource,
} from "./normalizers";
import {
  GLOBAL_CONVERSATION_KEY_BASE,
  INLINE_CONTEXT_COLLAPSE_THRESHOLD,
  MAX_SELECTED_TEXT_CONTEXTS,
} from "./constants";
import {
  selectedTextCache,
  selectedTextPreviewExpandedCache,
  recentReaderSelectionCache,
} from "./state";
import type {
  ZoteroTabsState,
  ResolvedContextSource,
  SelectedTextContext,
  SelectedTextSource,
  PaperContextRef,
} from "./types";
import { isGlobalPortalItem } from "./portalScope";
import { formatOpenChatTextContextLabel } from "./paperAttribution";
import {
  getFirstSelectionFromReader,
  getSelectionFromDocument,
} from "./readerSelection";
import { getPanelI18n } from "./i18n";
import {
  getReaderDocumentCapabilities,
  getReaderDocumentKind,
} from "./documentContext";

const SELECTED_TEXT_GROUP_EXPANDED_INDEX = -2;

function getActiveReaderForSelectedTab(): any | null {
  const tabs = getZoteroTabsState();
  const selectedTabId = tabs?.selectedID;
  if (selectedTabId === undefined || selectedTabId === null) return null;
  return (
    (
      Zotero as unknown as {
        Reader?: { getByTabID?: (id: string | number) => any };
      }
    ).Reader?.getByTabID?.(selectedTabId as string | number) || null
  );
}

function parseItemID(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isTabsState(value: unknown): value is ZoteroTabsState {
  if (!value || typeof value !== "object") return false;
  const obj = value as any;
  return (
    "selectedID" in obj || "selectedType" in obj || Array.isArray(obj._tabs)
  );
}

function getZoteroTabsStateWithSource(): {
  tabs: ZoteroTabsState | null;
  source: string;
} {
  const candidates: Array<{ source: string; value: unknown }> = [];
  const push = (source: string, value: unknown) => {
    candidates.push({ source, value });
  };

  push(
    "local.Zotero.Tabs",
    (Zotero as unknown as { Tabs?: ZoteroTabsState }).Tabs,
  );

  let mainWindow: any = null;
  try {
    mainWindow = Zotero.getMainWindow?.() || null;
  } catch (_error) {
    void _error;
  }
  if (mainWindow) {
    push("mainWindow.Zotero.Tabs", mainWindow.Zotero?.Tabs);
    push("mainWindow.Zotero_Tabs", mainWindow.Zotero_Tabs);
    push("mainWindow.Tabs", mainWindow.Tabs);
  }

  let activePaneWindow: any = null;
  try {
    activePaneWindow =
      Zotero.getActiveZoteroPane?.()?.document?.defaultView || null;
  } catch (_error) {
    void _error;
  }
  if (activePaneWindow) {
    push("activePaneWindow.Zotero.Tabs", activePaneWindow.Zotero?.Tabs);
    push("activePaneWindow.Zotero_Tabs", activePaneWindow.Zotero_Tabs);
  }

  let anyMainWindow: any = null;
  try {
    const windows = Zotero.getMainWindows?.() || [];
    anyMainWindow = windows[0] || null;
  } catch (_error) {
    void _error;
  }
  if (anyMainWindow) {
    push("mainWindows[0].Zotero.Tabs", anyMainWindow.Zotero?.Tabs);
    push("mainWindows[0].Zotero_Tabs", anyMainWindow.Zotero_Tabs);
  }

  try {
    const wmRecent = (Services as any).wm?.getMostRecentWindow?.(
      "navigator:browser",
    ) as any;
    push("wm:navigator:browser.Zotero.Tabs", wmRecent?.Zotero?.Tabs);
    push("wm:navigator:browser.Zotero_Tabs", wmRecent?.Zotero_Tabs);
  } catch (_error) {
    void _error;
  }
  try {
    const wmAny = (Services as any).wm?.getMostRecentWindow?.("") as any;
    push("wm:any.Zotero.Tabs", wmAny?.Zotero?.Tabs);
    push("wm:any.Zotero_Tabs", wmAny?.Zotero_Tabs);
  } catch (_error) {
    void _error;
  }

  const globalAny = globalThis as any;
  push("globalThis.Zotero_Tabs", globalAny.Zotero_Tabs);
  push("globalThis.window.Zotero_Tabs", globalAny.window?.Zotero_Tabs);

  for (const candidate of candidates) {
    if (isTabsState(candidate.value)) {
      return { tabs: candidate.value, source: candidate.source };
    }
  }
  return { tabs: null, source: "none" };
}

function getZoteroTabsState(): ZoteroTabsState | null {
  return getZoteroTabsStateWithSource().tabs;
}

function collectCandidateItemIDsFromObject(source: any): number[] {
  if (!source || typeof source !== "object") return [];
  const directCandidates = [
    source.itemID,
    source.itemId,
    source.attachmentID,
    source.attachmentId,
    source.readerItemID,
    source.readerItemId,
    source.id,
  ];
  const nestedObjects = [
    source.item,
    source.attachment,
    source.reader,
    source.state,
    source.params,
    source.extraData,
  ];
  const out: number[] = [];
  const seen = new Set<number>();
  const pushParsed = (value: unknown) => {
    const parsed = parseItemID(value);
    if (parsed === null || seen.has(parsed)) return;
    seen.add(parsed);
    out.push(parsed);
  };

  for (const candidate of directCandidates) {
    pushParsed(candidate);
  }
  for (const nested of nestedObjects) {
    if (!nested || typeof nested !== "object") continue;
    pushParsed((nested as any).itemID);
    pushParsed((nested as any).itemId);
    pushParsed((nested as any).attachmentID);
    pushParsed((nested as any).attachmentId);
    pushParsed((nested as any).id);
  }
  return out;
}

function getActiveReaderAttachmentFromTabs(
  isSupported: (item: Zotero.Item | null | undefined) => boolean,
): Zotero.Item | null {
  const tabs = getZoteroTabsState();
  if (!tabs) return null;
  const selectedType = `${tabs.selectedType || ""}`.toLowerCase();
  if (selectedType && !selectedType.includes("reader")) return null;

  const selectedId =
    tabs.selectedID === undefined || tabs.selectedID === null
      ? ""
      : `${tabs.selectedID}`;
  if (!selectedId) return null;

  const tabList = Array.isArray(tabs._tabs) ? tabs._tabs : [];
  const activeTab = tabList.find((tab) => `${tab?.id || ""}` === selectedId);
  const activeType = `${activeTab?.type || ""}`.toLowerCase();
  if (!activeTab || (activeType && !activeType.includes("reader"))) return null;

  const data = activeTab.data || {};
  const candidateIDs = collectCandidateItemIDsFromObject(data);
  for (const itemId of candidateIDs) {
    const item = getZoteroItem(itemId);
    if (item && isSupported(item)) return item;
  }

  // Fallback: map selected tab id to reader instance if available.
  const reader = (
    Zotero as unknown as {
      Reader?: { getByTabID?: (id: string | number) => any };
    }
  ).Reader?.getByTabID?.(selectedId);
  const readerItemId = parseItemID(reader?._item?.id ?? reader?.itemID);
  if (readerItemId !== null) {
    const readerItem = getZoteroItem(readerItemId);
    if (readerItem && isSupported(readerItem)) return readerItem;
  }

  return null;
}

export function getActiveReaderDocumentAttachmentFromTabs(): Zotero.Item | null {
  return getActiveReaderAttachmentFromTabs(
    (item) => getReaderDocumentKind(item) !== null,
  );
}

export function getActiveContextAttachmentFromTabs(): Zotero.Item | null {
  return getActiveReaderAttachmentFromTabs(isSupportedContextAttachment);
}

function isSupportedContextAttachment(
  item: Zotero.Item | null | undefined,
): item is Zotero.Item {
  return Boolean(
    item &&
    item.isAttachment() &&
    item.attachmentContentType === "application/pdf",
  );
}

function getContextItemLabel(item: Zotero.Item): string {
  const title = sanitizeText(item.getField("title") || "").trim();
  if (title) return title;
  return `Attachment ${item.id}`;
}

function getFirstPdfChildAttachment(
  item: Zotero.Item | null | undefined,
): Zotero.Item | null {
  if (!item || item.isAttachment()) return null;
  const attachments = item.getAttachments();
  for (const attachmentId of attachments) {
    const attachment = getZoteroItem(attachmentId);
    if (isSupportedContextAttachment(attachment)) {
      return attachment;
    }
  }
  return null;
}

export function resolveContextSourceItem(
  panelItem: Zotero.Item,
): ResolvedContextSource {
  if (isGlobalPortalItem(panelItem)) {
    return {
      contextItem: null,
      statusText: "No active paper context. Type @ to add papers.",
    };
  }

  // Prefer the panel's own item so each reader tab stays isolated. Document
  // adapters decide which attachment formats can provide panel context.
  if (getReaderDocumentCapabilities(panelItem)?.panelChat) {
    const label = getContextItemLabel(panelItem);
    return {
      contextItem: panelItem,
      statusText: `Using context: ${label}`,
    };
  }
  // (Parent item fallback removed to enforce strict isolation between Library and Reader)
  // No supported document context found for this item — return null.
  // (Previously fell back to the globally active reader tab, but that
  // leaked reader PDF context into the library panel.)

  const selectedTab = getZoteroTabsState();
  const selectedId =
    selectedTab?.selectedID === undefined || selectedTab?.selectedID === null
      ? ""
      : `${selectedTab.selectedID}`;
  const activeTab = Array.isArray(selectedTab?._tabs)
    ? selectedTab!._tabs!.find((tab) => `${tab?.id || ""}` === selectedId)
    : null;
  const dataKeys = activeTab?.data
    ? Object.keys(activeTab.data).slice(0, 6)
    : [];
  return {
    contextItem: null,
    statusText: `No active document context (tab=${selectedTab?.selectedID ?? "?"}, type=${selectedTab?.selectedType ?? "?"}, tabType=${activeTab?.type ?? "?"}, dataKeys=${dataKeys.join("|") || "-"})`,
  };
}

export function getItemSelectionCacheKeys(
  item: Zotero.Item | null | undefined,
): number[] {
  if (!item) return [];
  return [item.id];
}

export function getActiveReaderSelectionText(
  panelDoc: Document,
  currentItem?: Zotero.Item | null,
): string {
  const reader = getActiveReaderForSelectedTab();
  const fromReader = getFirstSelectionFromReader(reader, normalizeSelectedText);
  if (fromReader) return fromReader;

  // 3. Check the panel document and its iframes
  const fromPanelDoc = getSelectionFromDocument(
    panelDoc,
    normalizeSelectedText,
  );
  if (fromPanelDoc) return fromPanelDoc;

  const iframes = Array.from(
    panelDoc.querySelectorAll("iframe"),
  ) as HTMLIFrameElement[];
  for (const frame of iframes) {
    const fromFrame = getSelectionFromDocument(
      frame.contentDocument,
      normalizeSelectedText,
    );
    if (fromFrame) return fromFrame;
  }

  // 4. Cache fallback — populated by the renderTextSelectionPopup event
  //    handler which also tracks popup lifecycle via a sentinel element.
  //    When the popup is dismissed the sentinel becomes disconnected and
  //    the cache entry is automatically cleared, preventing stale results.
  const itemId = reader?._item?.id || reader?.itemID;
  if (typeof itemId === "number") {
    const readerItem = getZoteroItem(itemId);
    const readerKeys = getItemSelectionCacheKeys(readerItem);
    for (const key of readerKeys) {
      const fromCache = recentReaderSelectionCache.get(key) || "";
      if (fromCache) return fromCache;
    }
  }

  const panelKeys = getItemSelectionCacheKeys(currentItem || null);
  for (const key of panelKeys) {
    const fromCache = recentReaderSelectionCache.get(key) || "";
    if (fromCache) return fromCache;
  }

  return "";
}

function normalizeSelectedTextContexts(value: unknown): SelectedTextContext[] {
  if (Array.isArray(value)) {
    const out: SelectedTextContext[] = [];
    for (const entry of value) {
      if (typeof entry === "string") {
        const normalizedText = normalizeSelectedText(entry);
        if (!normalizedText) continue;
        out.push({ text: normalizedText, source: "pdf" });
        continue;
      }
      if (!entry || typeof entry !== "object") continue;
      const typed = entry as {
        text?: unknown;
        source?: unknown;
        paperContext?: unknown;
      };
      const normalizedText = normalizeSelectedText(
        typeof typed.text === "string" ? typed.text : "",
      );
      if (!normalizedText) continue;
      const normalizedPaperContext = normalizePaperContextRefs([
        typed.paperContext,
      ])[0];
      out.push({
        text: normalizedText,
        source: normalizeSelectedTextSource(typed.source),
        paperContext: normalizedPaperContext,
      });
    }
    return out;
  }
  if (typeof value === "string") {
    const normalized = normalizeSelectedText(value);
    return normalized ? [{ text: normalized, source: "pdf" }] : [];
  }
  return [];
}

export function getSelectedTextContexts(itemId: number): string[] {
  return getSelectedTextContextEntries(itemId).map((entry) => entry.text);
}

export function getSelectedTextContextEntries(
  itemId: number,
): SelectedTextContext[] {
  const raw = selectedTextCache.get(itemId);
  return normalizeSelectedTextContexts(raw);
}

export function setSelectedTextContexts(itemId: number, texts: string[]): void {
  const normalized = texts
    .map((text) => normalizeSelectedText(text))
    .filter(Boolean)
    .map((text) => ({ text, source: "pdf" as const }));
  setSelectedTextContextEntries(itemId, normalized);
}

export function setSelectedTextContextEntries(
  itemId: number,
  contexts: SelectedTextContext[],
): void {
  const normalized = normalizeSelectedTextContexts(contexts);
  if (!normalized.length) {
    selectedTextCache.delete(itemId);
    selectedTextPreviewExpandedCache.delete(itemId);
    return;
  }
  selectedTextCache.set(itemId, normalized);
}

export function appendSelectedTextContextForItem(
  itemId: number,
  text: string,
  source: SelectedTextSource = "pdf",
  paperContext?: PaperContextRef | null,
): boolean {
  const normalizedText = normalizeSelectedText(text || "");
  if (!normalizedText) return false;
  const existingContexts = getSelectedTextContextEntries(itemId);
  const normalizedPaperContext = normalizePaperContextRefs([paperContext])[0];
  const dedupeKey = (entry: SelectedTextContext): string => {
    const paperKey = entry.paperContext
      ? `${entry.paperContext.itemId}:${entry.paperContext.contextItemId}`
      : "-";
    return `${entry.text}\u241f${paperKey}`;
  };
  const incomingKey = dedupeKey({
    text: normalizedText,
    source: normalizeSelectedTextSource(source),
    paperContext: normalizedPaperContext,
  });
  if (existingContexts.some((entry) => dedupeKey(entry) === incomingKey)) {
    return false;
  }
  if (existingContexts.length >= MAX_SELECTED_TEXT_CONTEXTS) return false;
  setSelectedTextContextEntries(itemId, [
    ...existingContexts,
    {
      text: normalizedText,
      source: normalizeSelectedTextSource(source),
      paperContext: normalizedPaperContext,
    },
  ]);
  selectedTextPreviewExpandedCache.delete(itemId);
  return true;
}

export function getSelectedTextExpandedIndex(
  itemId: number,
  count: number,
): number {
  const raw = selectedTextPreviewExpandedCache.get(itemId) as unknown;
  const normalized = (() => {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return Math.floor(raw);
    }
    if (raw === true) return 0;
    return -1;
  })();
  if (normalized === SELECTED_TEXT_GROUP_EXPANDED_INDEX) {
    return -1;
  }
  if (normalized < 0 || normalized >= count) {
    selectedTextPreviewExpandedCache.delete(itemId);
    return -1;
  }
  return normalized;
}

export function setSelectedTextGroupExpanded(
  itemId: number,
  expanded: boolean,
): void {
  if (expanded) {
    selectedTextPreviewExpandedCache.set(
      itemId,
      SELECTED_TEXT_GROUP_EXPANDED_INDEX,
    );
    return;
  }
  selectedTextPreviewExpandedCache.delete(itemId);
}

export function isSelectedTextGroupExpanded(itemId: number): boolean {
  return (
    selectedTextPreviewExpandedCache.get(itemId) ===
    SELECTED_TEXT_GROUP_EXPANDED_INDEX
  );
}

export function setSelectedTextExpandedIndex(
  itemId: number,
  index: number | null,
): void {
  if (index === null || index < 0 || !Number.isFinite(index)) {
    selectedTextPreviewExpandedCache.delete(itemId);
    return;
  }
  selectedTextPreviewExpandedCache.set(itemId, Math.floor(index));
}

type AddSelectedTextContextOptions = {
  noSelectionStatusText?: string;
  successStatusText?: string;
  focusInput?: boolean;
  source?: SelectedTextSource;
  paperContext?: PaperContextRef | null;
};

export function addSelectedTextContext(
  body: Element,
  itemId: number,
  text: string,
  options: AddSelectedTextContextOptions = {},
): boolean {
  const normalizedText = normalizeSelectedText(text || "");
  const status = body.querySelector("#llm-status") as HTMLElement | null;
  if (!normalizedText) {
    if (status && options.noSelectionStatusText) {
      setStatus(status, options.noSelectionStatusText, "error");
    }
    return false;
  }

  const appended = appendSelectedTextContextForItem(
    itemId,
    normalizedText,
    options.source || "pdf",
    options.paperContext,
  );
  if (!appended) {
    if (status) setStatus(status, getPanelI18n().textContextLimit, "error");
    return false;
  }
  applySelectedTextPreview(body, itemId);
  if (status && options.successStatusText) {
    setStatus(status, options.successStatusText, "ready");
  }
  if (options.focusInput !== false) {
    const inputEl = body.querySelector(
      "#llm-input",
    ) as HTMLTextAreaElement | null;
    inputEl?.focus({ preventScroll: true });
  }
  return true;
}

export function applySelectedTextPreview(body: Element, itemId: number) {
  const previewList = body.querySelector(
    "#llm-selected-context-list",
  ) as HTMLDivElement | null;
  const selectTextBtn = body.querySelector(
    "#llm-select-text",
  ) as HTMLButtonElement | null;
  if (!previewList) return;

  const selectedContexts = getSelectedTextContextEntries(itemId);
  if (!selectedContexts.length) {
    previewList.style.display = "none";
    previewList.innerHTML = "";
    selectedTextPreviewExpandedCache.delete(itemId);
    if (selectTextBtn) {
      selectTextBtn.classList.remove("llm-action-btn-active");
    }
    return;
  }

  const ownerDoc = body.ownerDocument;
  if (!ownerDoc) return;

  const expandedIndex = getSelectedTextExpandedIndex(
    itemId,
    selectedContexts.length,
  );
  const isGrouped = selectedContexts.length > INLINE_CONTEXT_COLLAPSE_THRESHOLD;
  const isGroupExpanded =
    isGrouped &&
    (selectedTextPreviewExpandedCache.get(itemId) ===
      SELECTED_TEXT_GROUP_EXPANDED_INDEX ||
      expandedIndex >= 0);
  const isGlobalConversation = itemId >= GLOBAL_CONVERSATION_KEY_BASE;
  previewList.style.display = "contents";
  previewList.innerHTML = "";

  const renderSelectedContext = (
    selectedContext: SelectedTextContext,
    index: number,
  ) => {
    const selectedText = selectedContext.text;
    const selectedSource = selectedContext.source;
    const isExpanded = expandedIndex === index;
    const contextLabel =
      isGlobalConversation && selectedSource === "pdf"
        ? formatOpenChatTextContextLabel(selectedContext.paperContext)
        : selectedContexts.length > 1 && index > 0
          ? `Text Context (${index + 1})`
          : "Text Context";

    const previewBox = ownerDoc.createElement("div");
    previewBox.className = "llm-selected-context";
    previewBox.dataset.contextIndex = `${index}`;
    previewBox.dataset.contextSource = selectedSource;
    previewBox.classList.toggle("expanded", isExpanded);
    previewBox.classList.toggle("collapsed", !isExpanded);
    previewBox.classList.toggle(
      "llm-selected-context-source-pdf",
      selectedSource === "pdf",
    );
    previewBox.classList.toggle(
      "llm-selected-context-source-model",
      selectedSource === "model",
    );

    const previewHeader = ownerDoc.createElement("div");
    previewHeader.className =
      "llm-image-preview-header llm-selected-context-header";

    const previewMeta = ownerDoc.createElement("button");
    previewMeta.type = "button";
    previewMeta.className = "llm-image-preview-meta llm-selected-context-meta";
    previewMeta.dataset.contextIndex = `${index}`;
    previewMeta.dataset.contextSource = selectedSource;
    previewMeta.classList.toggle(
      "llm-selected-context-source-pdf",
      selectedSource === "pdf",
    );
    previewMeta.classList.toggle(
      "llm-selected-context-source-model",
      selectedSource === "model",
    );
    previewMeta.textContent = contextLabel;
    const isCorrupted = isLikelyCorruptedSelectedText(selectedText);
    previewMeta.classList.toggle(
      "llm-selected-context-meta-corrupted",
      isCorrupted,
    );
    const i18n = getPanelI18n();
    previewMeta.title = isExpanded
      ? i18n.unpinTextContext
      : i18n.pinTextContext;
    previewMeta.setAttribute("aria-expanded", isExpanded ? "true" : "false");

    const previewClear = ownerDoc.createElement("button");
    previewClear.type = "button";
    previewClear.className = "llm-remove-img-btn llm-selected-context-clear";
    previewClear.dataset.contextIndex = `${index}`;
    previewClear.textContent = "×";
    previewClear.title = i18n.clearSelectedContext;
    previewClear.setAttribute("aria-label", i18n.clearSelectedContext);

    previewHeader.append(previewMeta, previewClear);

    const previewExpanded = ownerDoc.createElement("div");
    previewExpanded.className =
      "llm-image-preview-expanded llm-selected-context-expanded";
    previewExpanded.hidden = false;
    previewExpanded.style.display = "flex";

    const previewText = ownerDoc.createElement("div");
    previewText.className = "llm-selected-context-text";
    previewText.textContent = selectedText;

    const previewWarning = ownerDoc.createElement("div");
    previewWarning.className = "llm-selected-context-warning";
    previewWarning.textContent =
      "Recommend to use screenshots option for corrupted text";
    previewWarning.style.display = isCorrupted ? "block" : "none";

    previewExpanded.append(previewText, previewWarning);
    previewBox.append(previewHeader, previewExpanded);
    previewList.appendChild(previewBox);
  };

  if (isGrouped) {
    const summaryBox = ownerDoc.createElement("div");
    summaryBox.className = "llm-selected-context llm-selected-context-summary";
    summaryBox.classList.toggle("expanded", isGroupExpanded);
    summaryBox.classList.toggle("collapsed", !isGroupExpanded);
    summaryBox.dataset.contextSummary = "selected-text";

    const summaryHeader = ownerDoc.createElement("div");
    summaryHeader.className =
      "llm-image-preview-header llm-selected-context-header";

    const summaryMeta = ownerDoc.createElement("button");
    summaryMeta.type = "button";
    summaryMeta.className =
      "llm-image-preview-meta llm-selected-context-meta llm-selected-context-summary-toggle";
    summaryMeta.textContent = `Text Context (${selectedContexts.length})`;
    summaryMeta.setAttribute(
      "aria-expanded",
      isGroupExpanded ? "true" : "false",
    );

    const summaryClear = ownerDoc.createElement("button");
    summaryClear.type = "button";
    summaryClear.className =
      "llm-remove-img-btn llm-selected-context-clear-all";
    summaryClear.textContent = "×";
    const i18n = getPanelI18n();
    summaryClear.title = i18n.clearSelectedContext;
    summaryClear.setAttribute("aria-label", i18n.clearSelectedContext);

    summaryHeader.append(summaryMeta, summaryClear);

    const summaryExpanded = ownerDoc.createElement("div");
    summaryExpanded.className =
      "llm-image-preview-expanded llm-selected-context-expanded llm-selected-context-group-expanded";
    summaryExpanded.hidden = false;
    summaryExpanded.style.display = "grid";

    const detailList = ownerDoc.createElement("div");
    detailList.className = "llm-selected-context-detail-list";

    for (const [index, selectedContext] of selectedContexts.entries()) {
      const selectedText = selectedContext.text;
      const selectedSource = selectedContext.source;
      const contextLabel =
        isGlobalConversation && selectedSource === "pdf"
          ? formatOpenChatTextContextLabel(selectedContext.paperContext)
          : index > 0
            ? `Text Context (${index + 1})`
            : "Text Context";
      const isCorrupted = isLikelyCorruptedSelectedText(selectedText);

      const row = ownerDoc.createElement("div");
      row.className = "llm-selected-context-detail-item";
      row.dataset.contextIndex = `${index}`;
      row.dataset.contextSource = selectedSource;
      row.classList.toggle(
        "llm-selected-context-detail-item-corrupted",
        isCorrupted,
      );

      const indexPill = ownerDoc.createElement("span");
      indexPill.className = "llm-context-detail-index";
      indexPill.textContent = `${index + 1}`;

      const textWrap = ownerDoc.createElement("div");
      textWrap.className = "llm-selected-context-detail-text";

      const label = ownerDoc.createElement("span");
      label.className = "llm-selected-context-detail-label";
      label.textContent = contextLabel;

      const text = ownerDoc.createElement("div");
      text.className = "llm-selected-context-detail-body";
      text.textContent = selectedText;
      text.title = selectedText;

      textWrap.append(label, text);

      const removeBtn = ownerDoc.createElement("button");
      removeBtn.type = "button";
      removeBtn.className =
        "llm-file-context-remove llm-selected-context-clear";
      removeBtn.dataset.contextIndex = `${index}`;
      removeBtn.textContent = "×";
      removeBtn.title = i18n.clearSelectedContext;
      removeBtn.setAttribute("aria-label", i18n.clearSelectedContext);

      row.append(indexPill, textWrap, removeBtn);
      detailList.appendChild(row);
    }

    summaryExpanded.append(detailList);
    summaryBox.append(summaryHeader, summaryExpanded);
    previewList.appendChild(summaryBox);

    if (selectTextBtn) {
      selectTextBtn.classList.add("llm-action-btn-active");
    }
    return;
  }

  for (const [index, selectedContext] of selectedContexts.entries()) {
    renderSelectedContext(selectedContext, index);
  }

  if (selectTextBtn) {
    selectTextBtn.classList.add("llm-action-btn-active");
  }
}

export function includeSelectedTextFromReader(
  body: Element,
  item: Zotero.Item,
  prefetchedText?: string,
  options?: {
    paperContext?: PaperContextRef | null;
    targetItemId?: number | null;
  },
): boolean {
  const selectedText =
    normalizeSelectedText(prefetchedText || "") ||
    getActiveReaderSelectionText(body.ownerDocument as Document, item);
  const targetItemId =
    typeof options?.targetItemId === "number" && options.targetItemId > 0
      ? Math.floor(options.targetItemId)
      : item.id;
  return addSelectedTextContext(body, targetItemId, selectedText, {
    noSelectionStatusText: "No text selected in reader",
    successStatusText: "Selected text included",
    focusInput: true,
    source: "pdf",
    paperContext: options?.paperContext,
  });
}
