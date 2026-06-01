/**
 * Context Panel Module
 *
 * This is the main entry point for the LLM context panel, which provides
 * a chat interface in Zotero's reader/library side panel.
 *
 * The module is split into focused sub-modules:
 * - constants.ts   – shared constants
 * - types.ts       – shared type definitions
 * - state.ts       – module-level mutable state
 * - buildUI.ts     – UI construction
 * - setupHandlers.ts – event handler wiring
 * - chat.ts        – conversation logic, send/refresh
 * - shortcuts.ts   – shortcut rendering and management
 * - screenshot.ts  – screenshot capture from PDF reader
 * - pdfContext.ts   – PDF text extraction, chunking, BM25, embeddings
 * - notes.ts       – Zotero note creation from chat
 * - contextResolution.ts – tab/reader context resolution
 * - menuPositioning.ts   – dropdown/context menu positioning
 * - prefHelpers.ts – preference access helpers
 * - textUtils.ts   – text sanitization, formatting
 */

import { getLocaleID } from "../../utils/locale";
import { renderMarkdown } from "../../utils/markdown";
import { config, GLOBAL_CONVERSATION_KEY_BASE, PANE_ID } from "./constants";
import type { Message } from "./types";
import {
  activeConversationModeByLibrary,
  activeGlobalConversationByLibrary,
  chatHistory,
  loadedConversationKeys,
  readerContextPanelRegistered,
  setReaderContextPanelRegistered,
  recentReaderSelectionCache,
  conversationContextPool,
} from "./state";
import { clearConversation as clearStoredConversation } from "../../utils/chatStore";
import {
  ATTACHMENT_GC_MIN_AGE_MS,
  clearOwnerAttachmentRefs,
  collectAndDeleteUnreferencedBlobs,
} from "../../utils/attachmentRefStore";
import { normalizeSelectedText, setStatus } from "./textUtils";
import { zoneBSummaryCache } from "./chat";
import {
  getItemSelectionCacheKeys,
  appendSelectedTextContextForItem,
  applySelectedTextPreview,
  getActiveContextAttachmentFromTabs,
} from "./contextResolution";
import {
  getFirstSelectionFromReader,
  getSelectionFromDocument,
} from "./readerSelection";
import { resolvePaperContextRefFromAttachment } from "./paperAttribution";
import {
  bootstrapSharedReaderPanel,
  getSharedReaderPanelHostForItem,
} from "./readerPanel";
import { getPanelI18n } from "./i18n";
import {
  isSelectionTranslateEnabled,
  translateSelectedTextForReader,
} from "./selectionTranslate";
import { appendSelectionTranslationToNote } from "./notes";
import {
  PANEL_TYPOGRAPHY_REFRESH_EVENT,
  getPanelTypographySettings,
} from "./prefHelpers";

type ReaderSelectionPopupHandler =
  _ZoteroTypes.Reader.EventHandler<"renderTextSelectionPopup">;

let readerContextPanelSectionKey: string | null = null;
let readerSelectionPopupHandler: ReaderSelectionPopupHandler | null = null;

// =============================================================================
// Public API
// =============================================================================

// =============================================================================
// Section Visibility
// =============================================================================

export function registerLLMStyles(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  removeLLMStyles(win);

  // Main styles
  const link = doc.createElement("link") as HTMLLinkElement;
  link.id = `${config.addonRef}-styles`;
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = `chrome://${config.addonRef}/content/zoteroPane.css`;
  doc.documentElement?.appendChild(link);

  // KaTeX styles for math rendering
  const katexLink = doc.createElement("link") as HTMLLinkElement;
  katexLink.id = `${config.addonRef}-katex-styles`;
  katexLink.rel = "stylesheet";
  katexLink.type = "text/css";
  katexLink.href = `chrome://${config.addonRef}/content/vendor/katex/katex.min.css`;
  doc.documentElement?.appendChild(katexLink);
}

export function removeLLMStyles(win: Window) {
  const doc = win.document;
  doc.getElementById(`${config.addonRef}-styles`)?.remove();
  doc.getElementById(`${config.addonRef}-katex-styles`)?.remove();
}

export function registerReaderContextPanel() {
  if (readerContextPanelRegistered) return;
  unregisterReaderContextPanel();
  const sectionKey = Zotero.ItemPaneManager.registerSection({
    paneID: PANE_ID,
    pluginID: config.addonID,
    header: {
      l10nID: getLocaleID("llm-panel-head"),
      icon: `chrome://${config.addonRef}/content/icons/icon-20.png`,
    },
    sidenav: {
      l10nID: getLocaleID("llm-panel-sidenav-tooltip"),
      icon: `chrome://${config.addonRef}/content/icons/icon-20.png`,
    },
    onInit: ({ body, setEnabled, tabType }) => {
      // Reader tabs use Zotero's managed section. Library tabs are handled
      // by libraryPanel.ts so no/single/multi selection share one host.
      const enabled = tabType === "reader";
      setEnabled(enabled);
      ztoolkit.log(`LLM: panel init tabType=${tabType} enabled=${enabled}`);
    },
    onItemChange: ({ body, setEnabled, tabType }) => {
      const enabled = tabType === "reader";
      setEnabled(enabled);
      ztoolkit.log(
        `LLM: panel itemChange tabType=${tabType} enabled=${enabled}`,
      );
      if (tabType === "library") {
        return false;
      }
    },
    onRender: ({ body, item, tabType }) => {
      ztoolkit.log(
        `LLM: panel onRender tabType=${tabType} hasItem=${Boolean(item)}`,
      );
      if (typeof tabType === "string") {
        (body as HTMLElement).dataset.tabType = tabType;
      }
      // Library mode is fully owned by libraryPanel.ts.
      if (tabType === "library") {
        return;
      }
      // ── Reader mode: synchronously reparent the cached host ──
      if (tabType === "reader" && item) {
        try {
          const doc = body.ownerDocument;
          const win = doc?.defaultView;
          if (win) {
            // Resolve actual PDF attachment (Zotero may pass parent item)
            let renderItem = item;
            if (
              !item.isAttachment?.() ||
              item.attachmentContentType !== "application/pdf"
            ) {
              const pdfFromTab = getActiveContextAttachmentFromTabs();
              if (pdfFromTab) {
                renderItem = pdfFromTab;
              }
            }
            const host = getSharedReaderPanelHostForItem(win, renderItem);
            if (!body.contains(host)) {
              body.textContent = "";
              body.appendChild(host);
            }
            host.style.display = "flex";
          }
          // Removed: scrollSectionIntoView(body) — was hijacking sidebar scroll
        } catch (err) {
          ztoolkit.log("LLM: reader sync reparent failed", err);
        }
        return;
      }
      if (tabType !== "reader") return;
      try {
        // Removed: scrollSectionIntoView(body) — was hijacking sidebar scroll
      } catch (err) {
        ztoolkit.log("LLM: scroll section failed", err);
      }
    },
    onAsyncRender: async ({ body, item, setEnabled, tabType }) => {
      const enabled = tabType === "reader";
      setEnabled(enabled);
      ztoolkit.log(
        `LLM: panel asyncRender tabType=${tabType} enabled=${enabled} hasItem=${Boolean(item)}`,
      );

      if (typeof tabType === "string") {
        (body as HTMLElement).dataset.tabType = tabType;
      }

      // Library mode is fully owned by libraryPanel.ts.
      if (tabType === "library") {
        return;
      }

      // ── Reader mode: bootstrap shared persistent DOM ──
      // The host was already reparented synchronously in onRender.
      // Here we only run the one-time async bootstrap.
      if (tabType !== "reader") return;

      if (!item) return;
      const doc = body.ownerDocument;
      if (!doc) return;
      const win = doc.defaultView;
      if (!win) return;

      // Zotero sometimes passes the parent item instead of the PDF
      // attachment to the Reader tab's section. Resolve the actual PDF
      // from the active reader tab so panels can correctly auto-attach it.
      let readerItem = item;
      if (
        !item.isAttachment?.() ||
        item.attachmentContentType !== "application/pdf"
      ) {
        const pdfFromTab = getActiveContextAttachmentFromTabs();
        if (pdfFromTab) {
          readerItem = pdfFromTab;
        }
      }

      const host = getSharedReaderPanelHostForItem(win, readerItem);

      // Defensive: ensure host is attached (in case onRender didn't fire)
      if (!body.contains(host)) {
        body.textContent = "";
        body.appendChild(host);
        host.style.display = "flex";
      }

      const { bootstrapSharedReaderPanel } = await import("./readerPanel");
      await bootstrapSharedReaderPanel(win, host, readerItem);
    },
  });
  if (sectionKey === false) {
    ztoolkit.log("LLM: failed to register reader context panel");
    return;
  }
  readerContextPanelSectionKey = sectionKey;
  setReaderContextPanelRegistered(true);
}

export function unregisterReaderContextPanel() {
  const key = readerContextPanelSectionKey || PANE_ID;
  try {
    Zotero.ItemPaneManager.unregisterSection(key);
  } catch (_err) {
    void _err;
  }
  readerContextPanelSectionKey = null;
  setReaderContextPanelRegistered(false);
}

type SelectionPopupRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

function makeSelectionPopupRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
): SelectionPopupRect {
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function getViewportRect(doc: Document): SelectionPopupRect {
  const win = doc.defaultView;
  const width =
    doc.documentElement?.clientWidth ||
    doc.body?.clientWidth ||
    win?.innerWidth ||
    800;
  const height =
    doc.documentElement?.clientHeight ||
    doc.body?.clientHeight ||
    win?.innerHeight ||
    600;
  return makeSelectionPopupRect(0, 0, width, height);
}

function getReaderSelectionClientRect(
  doc: Document,
): SelectionPopupRect | null {
  const selection = doc.defaultView?.getSelection?.();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const rects = Array.from(range.getClientRects?.() || []).filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  if (!rects.length) {
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0
      ? makeSelectionPopupRect(rect.left, rect.top, rect.right, rect.bottom)
      : null;
  }
  return makeSelectionPopupRect(
    Math.min(...rects.map((rect) => rect.left)),
    Math.min(...rects.map((rect) => rect.top)),
    Math.max(...rects.map((rect) => rect.right)),
    Math.max(...rects.map((rect) => rect.bottom)),
  );
}

function getRectOverlapArea(
  a: SelectionPopupRect,
  b: SelectionPopupRect,
): number {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function movePopupToViewportPoint(
  popup: HTMLElement,
  left: number,
  top: number,
): void {
  const rect = popup.getBoundingClientRect();
  const currentLeft = Number.parseFloat(popup.style.left || "");
  const currentTop = Number.parseFloat(popup.style.top || "");
  const baseLeft = Number.isFinite(currentLeft)
    ? currentLeft
    : popup.offsetLeft;
  const baseTop = Number.isFinite(currentTop) ? currentTop : popup.offsetTop;
  popup.style.left = `${baseLeft + (left - rect.left)}px`;
  popup.style.top = `${baseTop + (top - rect.top)}px`;
}

function layoutSelectionTranslatePopup(params: {
  doc: Document;
  popup: HTMLElement | null;
  wrap: HTMLElement;
  resultBox: HTMLElement;
  selectionRect: SelectionPopupRect | null;
}): void {
  const { doc, popup, wrap, resultBox, selectionRect } = params;
  if (!popup?.isConnected || !wrap.isConnected) return;

  const viewport = getViewportRect(doc);
  const margin = 10;
  const gap = 8;
  const typography = getPanelTypographySettings();
  const availableWidth = Math.max(180, viewport.width - margin * 2);
  const width = clamp(
    typography.selectionPopupWidth,
    Math.min(260, availableWidth),
    availableWidth,
  );

  wrap.style.width = `${width}px`;
  wrap.style.maxWidth = `${availableWidth}px`;
  resultBox.style.width = "100%";
  resultBox.style.fontSize = `${typography.selectionFontSize}px`;
  resultBox.style.lineHeight = String(typography.selectionLineHeight);
  resultBox.style.maxHeight = `${Math.max(
    120,
    Math.min(320, Math.round(viewport.height * 0.42)),
  )}px`;

  const popupRect = popup.getBoundingClientRect();
  const popupWidth = Math.min(
    popupRect.width || width,
    viewport.width - 2 * margin,
  );
  const popupHeight = Math.min(
    popupRect.height || resultBox.scrollHeight || 120,
    viewport.height - 2 * margin,
  );

  if (!selectionRect) {
    movePopupToViewportPoint(
      popup,
      clamp(popupRect.left, margin, viewport.width - popupWidth - margin),
      clamp(popupRect.top, margin, viewport.height - popupHeight - margin),
    );
    return;
  }

  const centeredLeft =
    selectionRect.left + selectionRect.width / 2 - popupWidth / 2;
  const candidates = [
    {
      left: centeredLeft,
      top: selectionRect.bottom + gap,
      priority: 4,
    },
    {
      left: centeredLeft,
      top: selectionRect.top - popupHeight - gap,
      priority: 3.8,
    },
    {
      left: selectionRect.right + gap,
      top: selectionRect.top,
      priority: 3.2,
    },
    {
      left: selectionRect.left - popupWidth - gap,
      top: selectionRect.top,
      priority: 3,
    },
  ].map((candidate) => {
    const unclamped = makeSelectionPopupRect(
      candidate.left,
      candidate.top,
      candidate.left + popupWidth,
      candidate.top + popupHeight,
    );
    const left = clamp(
      candidate.left,
      margin,
      viewport.width - popupWidth - margin,
    );
    const top = clamp(
      candidate.top,
      margin,
      viewport.height - popupHeight - margin,
    );
    const rect = makeSelectionPopupRect(
      left,
      top,
      left + popupWidth,
      top + popupHeight,
    );
    const fits =
      unclamped.left >= margin &&
      unclamped.top >= margin &&
      unclamped.right <= viewport.width - margin &&
      unclamped.bottom <= viewport.height - margin;
    const overlap = getRectOverlapArea(rect, selectionRect);
    const visible = getRectOverlapArea(rect, viewport);
    return {
      left,
      top,
      score:
        (fits ? 1_000_000 : 0) +
        visible -
        overlap * 20 +
        candidate.priority * 10_000,
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (best) movePopupToViewportPoint(popup, best.left, best.top);
}

function scheduleSelectionTranslatePopupLayout(params: {
  doc: Document;
  popup: HTMLElement | null;
  wrap: HTMLElement;
  resultBox: HTMLElement;
  selectionRect: SelectionPopupRect | null;
}): void {
  const run = () => layoutSelectionTranslatePopup(params);
  const win = params.doc.defaultView;
  if (win?.requestAnimationFrame) {
    win.requestAnimationFrame(() => run());
  } else {
    setTimeout(run, 0);
  }
}

export function registerReaderSelectionTracking() {
  const readerAPI = Zotero.Reader as _ZoteroTypes.Reader & {
    __llmSelectionTrackingRegistered?: boolean;
    __llmSelectionTrackingHandler?: ReaderSelectionPopupHandler | null;
  };
  if (!readerAPI) return;
  if (readerAPI.__llmSelectionTrackingRegistered && readerSelectionPopupHandler)
    return;
  if (readerAPI.__llmSelectionTrackingHandler) {
    try {
      Zotero.Reader.unregisterEventListener(
        "renderTextSelectionPopup",
        readerAPI.__llmSelectionTrackingHandler,
      );
    } catch (_err) {
      void _err;
    }
  }
  readerAPI.__llmSelectionTrackingRegistered = false;
  readerAPI.__llmSelectionTrackingHandler = null;

  const handler: _ZoteroTypes.Reader.EventHandler<
    "renderTextSelectionPopup"
  > = (event) => {
    const i18n = getPanelI18n();
    const selectedText = (() => {
      const fromAnnotation = normalizeSelectedText(
        event.params?.annotation?.text || "",
      );
      if (fromAnnotation) return fromAnnotation;
      const fromPopupDoc = getSelectionFromDocument(
        event.doc,
        normalizeSelectedText,
      );
      if (fromPopupDoc) return fromPopupDoc;
      return getFirstSelectionFromReader(
        event.reader as any,
        normalizeSelectedText,
      );
    })();
    const itemId = event.reader?._item?.id || event.reader?.itemID;
    if (typeof itemId !== "number") return;
    const item = Zotero.Items.get(itemId) || null;
    const cacheKeys = getItemSelectionCacheKeys(item);
    const keys = cacheKeys.length ? cacheKeys : [itemId];
    const popupPrefValue = Zotero.Prefs.get(
      `${config.prefsPrefix}.showPopupAddText`,
      true,
    );
    const showAddTextInPopup =
      popupPrefValue !== false &&
      `${popupPrefValue || ""}`.toLowerCase() !== "false";
    let selectionTranslateRelayout: (() => void) | null = null;

    const resolveSelectedTextForPopupAction = (): string => {
      const fromPopupDoc = getSelectionFromDocument(
        event.doc,
        normalizeSelectedText,
      );
      if (fromPopupDoc) return fromPopupDoc;
      const fromParams = normalizeSelectedText(
        (event.params as unknown as { text?: string; selectedText?: string })
          ?.text ||
          (event.params as unknown as { text?: string; selectedText?: string })
            ?.selectedText ||
          "",
      );
      if (fromParams) return fromParams;
      const fromAnnotation = normalizeSelectedText(
        event.params?.annotation?.text || "",
      );
      if (fromAnnotation) return fromAnnotation;
      const fromReader = getFirstSelectionFromReader(
        event.reader as any,
        normalizeSelectedText,
      );
      if (fromReader) return fromReader;
      for (const key of keys) {
        const cached = normalizeSelectedText(
          recentReaderSelectionCache.get(key) || "",
        );
        if (cached) return cached;
      }
      return "";
    };
    const resolveSelectionPageLabel = (): string => {
      const i18n = getPanelI18n();
      const params = event.params as unknown as {
        pageIndex?: unknown;
        page?: unknown;
        annotation?: {
          pageIndex?: unknown;
          page?: unknown;
          position?: { pageIndex?: unknown; page?: unknown };
        };
      };
      const rawPageIndex =
        params?.annotation?.position?.pageIndex ??
        params?.annotation?.pageIndex ??
        params?.pageIndex;
      const rawPage =
        params?.annotation?.position?.page ??
        params?.annotation?.page ??
        params?.page;
      const pageNumber =
        typeof rawPageIndex === "number"
          ? rawPageIndex + 1
          : Number.isFinite(Number(rawPageIndex))
            ? Number(rawPageIndex) + 1
            : typeof rawPage === "number"
              ? rawPage
              : Number.isFinite(Number(rawPage))
                ? Number(rawPage)
                : 0;
      if (!pageNumber || pageNumber < 1) {
        return i18n.trCurrentPdf;
      }
      return i18n.currentPdfPage(Math.floor(pageNumber));
    };

    if (selectedText || showAddTextInPopup) {
      let popupSentinelEl: HTMLElement | null = null;
      const addTextToPanel = async () => {
        const effectiveSelectedText =
          normalizeSelectedText(selectedText) ||
          resolveSelectedTextForPopupAction();
        if (!effectiveSelectedText) {
          ztoolkit.log("LLM: Add Text popup action skipped (no selection)");
          return;
        }
        try {
          let preferredPanelRoot: HTMLDivElement | null = null;
          const readerWin = (event.doc.defaultView?.top ||
            null) as Window | null;
          if (readerWin && item) {
            try {
              const host = getSharedReaderPanelHostForItem(readerWin, item);
              await bootstrapSharedReaderPanel(readerWin, host, item);
              preferredPanelRoot = host.querySelector(
                "#llm-main",
              ) as HTMLDivElement | null;
            } catch (err) {
              ztoolkit.log(
                "LLM: Add Text popup reader panel bootstrap failed",
                err,
              );
            }
          }

          const docs = new Set<Document>();
          const pushDoc = (doc?: Document | null) => {
            if (doc) docs.add(doc);
          };
          pushDoc(event.doc);
          pushDoc(event.doc.defaultView?.top?.document || null);
          try {
            pushDoc(Zotero.getMainWindow()?.document || null);
          } catch (_err) {
            void _err;
          }
          try {
            const wins = Zotero.getMainWindows?.() || [];
            for (const win of wins) {
              pushDoc(win?.document || null);
            }
          } catch (_err) {
            void _err;
          }

          const panelRoots: HTMLDivElement[] = [];
          const seenRoots = new Set<Element>();
          if (preferredPanelRoot) {
            seenRoots.add(preferredPanelRoot);
            panelRoots.push(preferredPanelRoot);
          }
          for (const doc of docs) {
            const roots = Array.from(
              doc.querySelectorAll("#llm-main"),
            ) as HTMLDivElement[];
            for (const root of roots) {
              if (seenRoots.has(root)) continue;
              seenRoots.add(root);
              panelRoots.push(root);
            }
          }
          if (!panelRoots.length) return;

          const readerLibraryID = Number(item?.libraryID || 0);
          const normalizedReaderLibraryID =
            Number.isFinite(readerLibraryID) && readerLibraryID > 0
              ? Math.floor(readerLibraryID)
              : 0;
          const readerModeLock =
            normalizedReaderLibraryID > 0
              ? activeConversationModeByLibrary.get(normalizedReaderLibraryID)
              : null;
          const readerGlobalConversationKey =
            readerModeLock === "global" && normalizedReaderLibraryID > 0
              ? Math.floor(
                  Number(
                    activeGlobalConversationByLibrary.get(
                      normalizedReaderLibraryID,
                    ) || 0,
                  ),
                )
              : 0;
          const readerPaperContext = resolvePaperContextRefFromAttachment(item);
          const readerPaperConversationKey =
            readerPaperContext && Number.isFinite(readerPaperContext.itemId)
              ? Math.floor(readerPaperContext.itemId)
              : 0;
          const getPanelItemId = (root: HTMLDivElement): number | null => {
            const parsed = Number(root.dataset.itemId || 0);
            return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
          };
          const getPanelLibraryId = (root: HTMLDivElement): number | null => {
            const parsed = Number(root.dataset.libraryId || 0);
            return Number.isFinite(parsed) && parsed > 0
              ? Math.floor(parsed)
              : null;
          };
          const resolvePanelConversationKey = (
            root: HTMLDivElement,
            panelItemId: number | null,
          ): number | null => {
            if (!panelItemId) return null;
            const libraryID = getPanelLibraryId(root);
            if (libraryID) {
              const mode = activeConversationModeByLibrary.get(libraryID);
              if (mode === "global") {
                const lockedGlobal = Number(
                  activeGlobalConversationByLibrary.get(libraryID) || 0,
                );
                if (Number.isFinite(lockedGlobal) && lockedGlobal > 0) {
                  return Math.floor(lockedGlobal);
                }
              }
            }
            if (
              readerGlobalConversationKey > 0 &&
              panelItemId < GLOBAL_CONVERSATION_KEY_BASE
            ) {
              return readerGlobalConversationKey;
            }
            return panelItemId;
          };
          const isVisible = (root: HTMLElement) =>
            root.getClientRects().length > 0;
          const popupTopDoc = event.doc.defaultView?.top?.document || null;
          const rootStates = panelRoots
            .map((root) => {
              const ownerDoc = root.ownerDocument;
              const panelItemId = getPanelItemId(root);
              const panelLibraryId = getPanelLibraryId(root);
              const conversationKey = resolvePanelConversationKey(
                root,
                panelItemId,
              );
              return {
                root,
                panelItemId,
                panelLibraryId,
                conversationKey,
                visible: isVisible(root),
                sameDoc: popupTopDoc ? ownerDoc === popupTopDoc : false,
                sameLibrary:
                  normalizedReaderLibraryID > 0 &&
                  panelLibraryId === normalizedReaderLibraryID,
                matchesReaderPaper:
                  readerPaperConversationKey > 0 &&
                  conversationKey === readerPaperConversationKey,
                matchesLockedGlobal:
                  readerGlobalConversationKey > 0 &&
                  conversationKey === readerGlobalConversationKey,
                hasActiveFocus: Boolean(
                  ownerDoc?.activeElement &&
                  root.contains(ownerDoc.activeElement),
                ),
                isPreferredReaderRoot: root === preferredPanelRoot,
              };
            })
            .filter(
              (state) => state.panelItemId !== null && state.conversationKey,
            );
          if (!rootStates.length) return;
          const preferredStates = rootStates.filter(
            (state) => state.isPreferredReaderRoot,
          );
          const sameLibraryStates =
            normalizedReaderLibraryID > 0
              ? rootStates.filter((state) => state.sameLibrary)
              : [];
          const rankedStates = preferredStates.length
            ? preferredStates
            : sameLibraryStates.length
              ? sameLibraryStates
              : rootStates;

          // Deterministic status/focus target ranking:
          // 1) same doc + visible + focused panel
          // 2) visible + focused panel
          // 3) same doc + visible + matching global lock
          // 4) same doc + visible + matching reader paper
          // 5) same doc + visible
          // 6) visible + matching global lock
          // 7) visible + matching reader paper
          // 8) visible
          // 9) same doc
          // 10) focused panel
          const scoreState = (state: (typeof rankedStates)[number]) => {
            if (state.isPreferredReaderRoot) return 100;
            if (state.sameDoc && state.visible && state.hasActiveFocus)
              return 8;
            if (state.visible && state.hasActiveFocus) return 7;
            if (state.sameDoc && state.visible && state.matchesLockedGlobal)
              return 6.5;
            if (state.sameDoc && state.visible && state.matchesReaderPaper)
              return 6;
            if (state.sameDoc && state.visible) return 5;
            if (state.visible && state.matchesLockedGlobal) return 4.5;
            if (state.visible && state.matchesReaderPaper) return 4;
            if (state.visible) return 3;
            if (state.sameDoc) return 2;
            if (state.hasActiveFocus) return 1;
            return 0;
          };
          let bestState = rankedStates[0];
          let bestScore = scoreState(bestState);
          for (const state of rankedStates.slice(1)) {
            const score = scoreState(state);
            if (score > bestScore) {
              bestState = state;
              bestScore = score;
            }
          }

          const panelRoot = bestState.root;
          const conversationKey = bestState.conversationKey as number;
          const isGlobalConversation =
            conversationKey >= GLOBAL_CONVERSATION_KEY_BASE;
          if (!isGlobalConversation) {
            // Compare using the Zotero item/parent IDs, NOT the conversation
            // key which is now in the paper-conversation numeric range.
            const readerItemId = Number(item?.id || 0);
            const readerParentId = Number(item?.parentID || 0);
            const paperMismatch =
              !readerPaperContext ||
              (readerPaperContext.itemId !== readerItemId &&
                readerPaperContext.itemId !== readerParentId);
            if (paperMismatch) {
              const panelBody = panelRoot.parentElement || panelRoot;
              const status = panelBody.querySelector(
                "#llm-status",
              ) as HTMLElement | null;
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
          const selectedPaperContext = isGlobalConversation
            ? readerPaperContext
            : null;
          const added = appendSelectedTextContextForItem(
            conversationKey,
            effectiveSelectedText,
            "pdf",
            selectedPaperContext,
          );
          const refreshRoots = rootStates.filter(
            (state) => (state.conversationKey as number) === conversationKey,
          );
          for (const state of refreshRoots) {
            const panelBody = state.root.parentElement || state.root;
            applySelectedTextPreview(panelBody, conversationKey);
          }
          if (!refreshRoots.length) {
            const panelBody = panelRoot.parentElement || panelRoot;
            applySelectedTextPreview(panelBody, conversationKey);
          }
          const panelBody = panelRoot.parentElement || panelRoot;
          const status = panelBody.querySelector(
            "#llm-status",
          ) as HTMLElement | null;
          if (status) {
            setStatus(
              status,
              added ? "Selected text included" : "Text Context up to 5",
              added ? "ready" : "error",
            );
          }
          if (added) {
            const inputEl = panelBody.querySelector(
              "#llm-input",
            ) as HTMLTextAreaElement | null;
            inputEl?.focus({ preventScroll: true });
          }
        } catch (err) {
          ztoolkit.log("LLM: Add Text popup action failed", err);
        }
      };
      const stripPopupRowChrome = (
        row: HTMLElement | null,
        hideRow: boolean = false,
      ) => {
        if (!row) return;
        const HTMLElementCtor = event.doc.defaultView?.HTMLElement;
        if (hideRow) {
          row.style.display = "none";
        } else {
          row.style.width = "100%";
          row.style.padding = "0 12px";
          row.style.margin = "0";
          row.style.borderTop = "none";
          row.style.borderBottom = "none";
          row.style.boxShadow = "none";
          row.style.background = "transparent";
        }
        const isSeparator = (el: Element | null): el is HTMLElement => {
          if (!el || !HTMLElementCtor || !(el instanceof HTMLElementCtor))
            return false;
          const tag = el.tagName.toLowerCase();
          return tag === "hr" || el.getAttribute("role") === "separator";
        };
        const prev = row.previousElementSibling;
        const next = row.nextElementSibling;
        if (isSeparator(prev)) prev.style.display = "none";
        if (isSeparator(next)) next.style.display = "none";
      };

      if (selectedText && isSelectionTranslateEnabled()) {
        try {
          const i18n = getPanelI18n();
          const text = {
            coldStart: i18n.selectionTranslateColdStart,
            translating: i18n.selectionTranslateTranslating,
            failed: i18n.selectionTranslateFailed,
          };
          const noteText = {
            addToNote: i18n.addToNote,
            addingToNote: i18n.addingToNote,
            addedToNote: i18n.addedToNote,
            addToNoteFailed: i18n.addToNoteFailed,
          };
          const selectionPopup = event.doc.querySelector(
            ".selection-popup",
          ) as HTMLElement | null;
          if (selectionPopup) {
            selectionPopup.style.maxWidth = "none";
            selectionPopup.style.width = "auto";
            selectionPopup.style.boxSizing = "border-box";
          }
          const selectionRect = getReaderSelectionClientRect(event.doc);
          const typography = getPanelTypographySettings();
          const wrap = event.doc.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div",
          ) as HTMLDivElement;
          wrap.className = "llm-selection-translate-wrap";
          wrap.style.cssText = [
            "display:flex",
            "flex-direction:column",
            "gap:6px",
            `width:min(${typography.selectionPopupWidth}px, calc(100vw - 20px))`,
            "max-width:calc(100vw - 20px)",
            "margin:0",
            "box-sizing:border-box",
            "color:inherit",
          ].join(";");

          const resultBox = event.doc.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "div",
          ) as HTMLDivElement;
          resultBox.className = "llm-selection-translate-result";
          resultBox.textContent = text.translating;
          resultBox.style.cssText = [
            "display:block",
            "width:100%",
            "max-width:100%",
            "max-height:min(320px, 42vh)",
            "overflow:auto",
            "box-sizing:border-box",
            "padding:7px 8px",
            "border:1px solid rgba(130,130,130,0.32)",
            "border-radius:6px",
            "background:rgba(127,127,127,0.08)",
            "color:inherit",
            `font-size:${typography.selectionFontSize}px`,
            `line-height:${typography.selectionLineHeight}`,
            "white-space:pre-wrap",
          ].join(";");
          const setResultText = (value: string) => {
            try {
              resultBox.innerHTML = renderMarkdown(value);
            } catch {
              resultBox.textContent = value;
            }
            selectionTranslateRelayout?.();
          };
          const addToNoteBtn = event.doc.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "button",
          ) as HTMLButtonElement;
          addToNoteBtn.className = "llm-selection-translate-note-btn";
          addToNoteBtn.type = "button";
          addToNoteBtn.textContent = noteText.addToNote;
          addToNoteBtn.style.cssText = [
            "display:none",
            "width:fit-content",
            "align-self:flex-end",
            "margin:0",
            "padding:4px 9px",
            "box-sizing:border-box",
            "border:1px solid rgba(130,130,130,0.38)",
            "border-radius:5px",
            "background:rgba(255,255,255,0.04)",
            "color:inherit",
            `font-size:${typography.selectionFontSize}px`,
            "line-height:1.25",
            "text-align:center",
            "cursor:pointer",
          ].join(";");
          wrap.append(resultBox, addToNoteBtn);
          event.append(wrap);
          if (!popupSentinelEl) popupSentinelEl = wrap;
          stripPopupRowChrome(wrap.parentElement as HTMLElement | null);
          selectionTranslateRelayout = () =>
            scheduleSelectionTranslatePopupLayout({
              doc: event.doc,
              popup: selectionPopup,
              wrap,
              resultBox,
              selectionRect,
            });
          const popupWin = event.doc.defaultView;
          const refreshSelectionTypography = () => {
            if (!wrap.isConnected) {
              for (const target of selectionTypographyRefreshTargets) {
                target.removeEventListener(
                  PANEL_TYPOGRAPHY_REFRESH_EVENT,
                  refreshSelectionTypography,
                );
              }
              return;
            }
            const nextTypography = getPanelTypographySettings();
            resultBox.style.fontSize = `${nextTypography.selectionFontSize}px`;
            resultBox.style.lineHeight = String(
              nextTypography.selectionLineHeight,
            );
            addToNoteBtn.style.fontSize = `${nextTypography.selectionFontSize}px`;
            addToNoteBtn.style.lineHeight = "1.25";
            selectionTranslateRelayout?.();
          };
          const selectionTypographyRefreshTargets: Window[] = [];
          const addSelectionTypographyRefreshTarget = (
            target: Window | null | undefined,
          ) => {
            if (!target || selectionTypographyRefreshTargets.includes(target))
              return;
            target.addEventListener(
              PANEL_TYPOGRAPHY_REFRESH_EVENT,
              refreshSelectionTypography,
            );
            selectionTypographyRefreshTargets.push(target);
          };
          addSelectionTypographyRefreshTarget(popupWin);
          try {
            addSelectionTypographyRefreshTarget(
              Zotero.getMainWindow?.() || null,
            );
          } catch {
            /* ignore */
          }
          try {
            const mainWindows: Window[] = Zotero.getMainWindows?.() || [];
            for (const mainWindow of mainWindows) {
              addSelectionTypographyRefreshTarget(mainWindow);
            }
          } catch {
            /* ignore */
          }
          selectionTranslateRelayout();

          let latestSelectionTranslation: {
            selectedText: string;
            translation: string;
            model: string;
            provider?: string;
          } | null = null;
          let translateRunning = false;
          addToNoteBtn.addEventListener("click", async () => {
            if (!item || !latestSelectionTranslation) return;
            addToNoteBtn.disabled = true;
            addToNoteBtn.textContent = noteText.addingToNote;
            try {
              await appendSelectionTranslationToNote(item, {
                ...latestSelectionTranslation,
                pageLabel: resolveSelectionPageLabel(),
              });
              addToNoteBtn.textContent = noteText.addedToNote;
            } catch (err) {
              ztoolkit.log(
                "LLM: add selection translation to note failed",
                err,
              );
              addToNoteBtn.disabled = false;
              addToNoteBtn.textContent = noteText.addToNoteFailed;
            }
          });
          const runSelectionTranslate = async () => {
            if (translateRunning) return;
            translateRunning = true;
            latestSelectionTranslation = null;
            addToNoteBtn.style.display = "none";
            addToNoteBtn.disabled = true;
            addToNoteBtn.textContent = noteText.addToNote;
            try {
              const effectiveSelectedText =
                normalizeSelectedText(selectedText) ||
                resolveSelectedTextForPopupAction();
              if (!item || !effectiveSelectedText) {
                resultBox.textContent = text.failed;
                selectionTranslateRelayout?.();
                return;
              }
              const result = await translateSelectedTextForReader({
                item,
                selectedText: effectiveSelectedText,
                callbacks: {
                  onStage(stage) {
                    resultBox.textContent =
                      stage === "cold-start"
                        ? text.coldStart
                        : text.translating;
                    selectionTranslateRelayout?.();
                  },
                },
              });
              setResultText(result.translation);
              latestSelectionTranslation = {
                selectedText: effectiveSelectedText,
                translation: result.translation,
                model: result.model,
                provider: result.provider,
              };
              addToNoteBtn.disabled = false;
              addToNoteBtn.textContent = noteText.addToNote;
              addToNoteBtn.style.display = "block";
              selectionTranslateRelayout?.();
            } catch (err) {
              ztoolkit.log("LLM: selection translation failed", err);
              resultBox.textContent = `${text.failed}: ${
                err instanceof Error ? err.message : String(err)
              }`;
              selectionTranslateRelayout?.();
            } finally {
              translateRunning = false;
            }
          };
          setTimeout(() => void runSelectionTranslate(), 0);
        } catch (err) {
          ztoolkit.log("LLM: failed to append selection translate popup", err);
        }
      }

      if (showAddTextInPopup) {
        try {
          const addTextBtn = event.doc.createElementNS(
            "http://www.w3.org/1999/xhtml",
            "button",
          ) as HTMLButtonElement;
          addTextBtn.type = "button";
          addTextBtn.textContent = i18n.addText;
          addTextBtn.title = i18n.addTextPopupTitle;
          addTextBtn.style.cssText = [
            "display:block",
            "width:100%",
            "margin:0",
            "padding:6px 8px",
            "box-sizing:border-box",
            "border:1px solid rgba(130,130,130,0.38)",
            "border-radius:6px",
            "background:rgba(255,255,255,0.04)",
            // Keep text readable across light/dark themes.
            "color:inherit",
            "font-size:12px",
            "line-height:1.25",
            "text-align:center",
            "cursor:pointer",
          ].join(";");
          let addTextHandled = false;
          const handleAddTextAction = (e: Event) => {
            if (addTextHandled) return;
            addTextHandled = true;
            e.preventDefault();
            e.stopPropagation();
            void addTextToPanel();
          };
          const isPrimaryButton = (e: Event): boolean => {
            const maybeMouse = e as MouseEvent;
            return (
              typeof maybeMouse.button !== "number" || maybeMouse.button === 0
            );
          };
          // Reader popup items may be removed before "click" fires.
          // Handle early pointer/mouse down as the primary trigger.
          addTextBtn.addEventListener("pointerdown", (e: Event) => {
            if (!isPrimaryButton(e)) return;
            handleAddTextAction(e);
          });
          addTextBtn.addEventListener("mousedown", (e: Event) => {
            if (!isPrimaryButton(e)) return;
            handleAddTextAction(e);
          });
          addTextBtn.addEventListener("click", handleAddTextAction);
          addTextBtn.addEventListener("command", handleAddTextAction);
          event.append(addTextBtn);
          popupSentinelEl = addTextBtn;
          stripPopupRowChrome(addTextBtn.parentElement as HTMLElement | null);
          selectionTranslateRelayout?.();
        } catch (err) {
          ztoolkit.log("LLM: failed to append Add Text popup button", err);
        }
      }

      if (selectedText) {
        for (const key of keys) {
          recentReaderSelectionCache.set(key, selectedText);
        }
      } else {
        for (const key of keys) {
          recentReaderSelectionCache.delete(key);
        }
      }

      if (selectedText) {
        try {
          let sentinel = popupSentinelEl;
          if (!sentinel) {
            const fallback = event.doc.createElementNS(
              "http://www.w3.org/1999/xhtml",
              "span",
            ) as HTMLSpanElement;
            fallback.style.display = "none";
            event.append(fallback);
            stripPopupRowChrome(
              fallback.parentElement as HTMLElement | null,
              true,
            );
            sentinel = fallback;
          }

          let wasConnected = false;
          let checks = 0;
          const maxChecks = 600;

          const watchSentinel = () => {
            if (++checks > maxChecks) return;
            if (sentinel.isConnected) {
              wasConnected = true;
              setTimeout(watchSentinel, 500);
              return;
            }
            if (!wasConnected && checks <= 6) {
              setTimeout(watchSentinel, 200);
              return;
            }
            if (wasConnected) {
              for (const key of keys) {
                if (recentReaderSelectionCache.get(key) === selectedText) {
                  recentReaderSelectionCache.delete(key);
                }
              }
            }
          };
          setTimeout(watchSentinel, 100);
        } catch (_err) {
          ztoolkit.log("LLM: selection popup sentinel failed", _err);
        }
      }
    } else {
      for (const key of keys) {
        recentReaderSelectionCache.delete(key);
      }
    }
  };

  Zotero.Reader.registerEventListener(
    "renderTextSelectionPopup",
    handler,
    config.addonID,
  );
  readerSelectionPopupHandler = handler;
  readerAPI.__llmSelectionTrackingHandler = handler;
  readerAPI.__llmSelectionTrackingRegistered = true;
}

export function unregisterReaderSelectionTracking() {
  const readerAPI = Zotero.Reader as
    | (_ZoteroTypes.Reader & {
        __llmSelectionTrackingRegistered?: boolean;
        __llmSelectionTrackingHandler?: ReaderSelectionPopupHandler | null;
      })
    | undefined;
  if (!readerAPI) return;
  const handler =
    readerSelectionPopupHandler || readerAPI.__llmSelectionTrackingHandler;
  if (handler) {
    try {
      Zotero.Reader.unregisterEventListener(
        "renderTextSelectionPopup",
        handler,
      );
    } catch (_err) {
      void _err;
    }
  }
  readerSelectionPopupHandler = null;
  readerAPI.__llmSelectionTrackingHandler = null;
  readerAPI.__llmSelectionTrackingRegistered = false;
  recentReaderSelectionCache.clear();
}

export function clearConversation(itemId: number) {
  chatHistory.delete(itemId);
  conversationContextPool.delete(itemId);
  zoneBSummaryCache.delete(itemId);
  loadedConversationKeys.add(itemId);
  void clearStoredConversation(itemId).catch((err) => {
    ztoolkit.log("LLM: Failed to clear persisted chat history", err);
  });
  void clearOwnerAttachmentRefs("conversation", itemId).catch((err) => {
    ztoolkit.log(
      "LLM: Failed to clear persisted conversation attachment refs",
      err,
    );
  });
  void collectAndDeleteUnreferencedBlobs(ATTACHMENT_GC_MIN_AGE_MS).catch(
    (err) => {
      ztoolkit.log("LLM: Failed to collect unreferenced attachment blobs", err);
    },
  );
}

export function getConversationHistory(itemId: number): Message[] {
  return chatHistory.get(itemId) || [];
}
