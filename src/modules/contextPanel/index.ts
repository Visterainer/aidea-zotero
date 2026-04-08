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
import { getSharedLibraryPanelHost } from "./libraryPanel";
import { getSharedReaderPanelHostForItem } from "./readerPanel";
import { getPanelI18n } from "./i18n";

// =============================================================================
// Public API
// =============================================================================

// =============================================================================
// Section Visibility
// =============================================================================


export function registerLLMStyles(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  if (doc.getElementById(`${config.addonRef}-styles`)) return;

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

export function registerReaderContextPanel() {
  if (readerContextPanelRegistered) return;
  setReaderContextPanelRegistered(true);
  Zotero.ItemPaneManager.registerSection({
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
      // Enable for both reader and library. In library mode without a selected
      // item, the section DOM is created by libraryPanel.ts calling
      // renderCustomSections() directly. The UI bootstrap is also done there.
      const enabled = tabType === "reader" || tabType === "library";
      setEnabled(enabled);
      ztoolkit.log(`LLM: panel init tabType=${tabType} enabled=${enabled}`);
    },
    onItemChange: ({ body, setEnabled, tabType }) => {
      const enabled = tabType === "reader" || tabType === "library";
      setEnabled(enabled);
      ztoolkit.log(
        `LLM: panel itemChange tabType=${tabType} enabled=${enabled}`,
      );
      if (tabType === "library") {
        // Synchronously reparent the cached host into the (possibly new) body
        // to avoid flash. This runs before any async render.
        try {
          const doc = body.ownerDocument;
          const win = doc?.defaultView;
          if (win) {
            const host = getSharedLibraryPanelHost(win);
            if (!body.contains(host)) {
              body.appendChild(host);
            }
            host.style.display = "flex";
          }
        } catch (err) {
          ztoolkit.log("LLM: library itemChange reparent failed", err);
        }
        // Removed: deferredScrollToSection(body) — was hijacking sidebar scroll
        // Return false to prevent Zotero from calling onRender/onAsyncRender,
        // which would cause a visible flash as the body gets cleared.
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
      // ── Library mode: synchronously reparent the cached host ──
      // This prevents flash by ensuring the DOM is never empty between
      // render cycles. The async bootstrap only runs once.
      if (tabType === "library") {
        try {
          const doc = body.ownerDocument;
          const win = doc?.defaultView;
          if (win) {
            const host = getSharedLibraryPanelHost(win);
            if (!body.contains(host)) {
              body.appendChild(host);
            }
            host.style.display = "flex";
          }
          // Removed: scrollSectionIntoView(body) — was hijacking sidebar scroll
        } catch (err) {
          ztoolkit.log("LLM: library sync reparent failed", err);
        }
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
      const enabled = tabType === "reader" || tabType === "library";
      setEnabled(enabled);
      ztoolkit.log(
        `LLM: panel asyncRender tabType=${tabType} enabled=${enabled} hasItem=${Boolean(item)}`,
      );

      if (typeof tabType === "string") {
        (body as HTMLElement).dataset.tabType = tabType;
      }

      // ── Library mode: bootstrap shared persistent DOM ──
      if (tabType === "library") {
        const doc = body.ownerDocument;
        if (!doc) return;
        const win = doc.defaultView;
        if (!win) return;

        const host = getSharedLibraryPanelHost(win);

        // Always ensure host is attached and visible
        if (!body.contains(host)) {
          body.appendChild(host);
        }
        host.style.display = "flex";
        // Removed: scrollSectionIntoView(body) — was hijacking sidebar scroll

        const { bootstrapSharedLibraryPanel } =
          await import("./libraryPanel");
        await bootstrapSharedLibraryPanel(win, host);
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

      const { bootstrapSharedReaderPanel } =
        await import("./readerPanel");
      await bootstrapSharedReaderPanel(win, host, readerItem);
    },
  });
}

export function registerReaderSelectionTracking() {
  const readerAPI = Zotero.Reader as _ZoteroTypes.Reader & {
    __llmSelectionTrackingRegistered?: boolean;
  };
  if (!readerAPI || readerAPI.__llmSelectionTrackingRegistered) return;

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

    if (selectedText || showAddTextInPopup) {
      let popupSentinelEl: HTMLElement | null = null;
      const addTextToPanel = () => {
        const effectiveSelectedText =
          normalizeSelectedText(selectedText) ||
          resolveSelectedTextForPopupAction();
        if (!effectiveSelectedText) {
          ztoolkit.log("LLM: Add Text popup action skipped (no selection)");
          return;
        }
        try {
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
              };
            })
            .filter(
              (state) => state.panelItemId !== null && state.conversationKey,
            );
          if (!rootStates.length) return;
          const sameLibraryStates =
            normalizedReaderLibraryID > 0
              ? rootStates.filter((state) => state.sameLibrary)
              : [];
          const rankedStates = sameLibraryStates.length
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
            addTextToPanel();
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
  readerAPI.__llmSelectionTrackingRegistered = true;
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
