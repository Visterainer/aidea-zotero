import { publicationBlocker } from "./translationFailure";
import { confirmPdfLayout } from "./persianLayout";
import { bindTranslationChoices } from "./translationFields";
/* ---------------------------------------------------------------------------
 * pdfTranslator/translateTabController.ts
 *
 * Wires up the Translate tab UI:
 *   - Populates the model selector from the shared model list
 *   - Persists per-tab model selection in Zotero prefs
 *   - Handles env setup / path / start / pause / clear button events
 * -------------------------------------------------------------------------*/

import { getModelChoices } from "../contextPanel/setupHandlers/controllers/modelSelectionController";
import { getPanelI18n, getPanelLang } from "../contextPanel/i18n";
import { renderReasoningEffortDropdown } from "../contextPanel/reasoningDropdown";
import {
  formatReasoningEffort,
  getTranslateReasoningEffort,
  setTranslateReasoningEffort,
} from "../../utils/reasoningEffort";
import type { TranslationStats, WarningStats } from "./types";
import type { TranslateController, TranslateUICallback } from "./index";
import {
  TRANSLATE_PREFS,
  getBoolPref,
  getNumberPref,
  getPersistedTranslateModel,
  getPersistedTranslateProvider,
  getStringPref,
  persistTranslateModel,
  persistTranslateProvider,
  readSavedTranslateOptions,
  type SavedTranslateOptions,
  setBoolPref,
  setNumberPref,
  setStringPref,
  isSaveToOutputDirEnabled,
} from "./translatePrefs";
import {
  buildTranslateParams,
  checkTranslationEnvironment,
  resolveTranslationCredentials,
  tryReserveTranslation,
} from "./translationJob";
import { getQueueCopy } from "./queueI18n";
import { getTranslateMenuCopy } from "./menuI18n";
import {
  mountTranslateQueueView,
  takeTabOverwrite,
} from "./translateQueueView";
import { batchCopy } from "./translationBatchStrings";
import {
  findPdfAttachment,
  type TranslationOutputKind,
} from "./translationAttachment";
import {
  inspectTranslationOutputs,
  validateGeneratedManifest,
  publishTranslationOutputs,
  type OutputPlan,
} from "./translationOutputs";

declare const Zotero: any;

const LOW_SIGNAL_ENGINE_DETAIL_RE =
  /(?:INFO:pdf2zh_next|INFO:babeldoc|WARNING:babeldoc|il_translator_llm_only\.py:(?:774|783|797|824))/i;

function getStageSummaryLabel(stage?: string, message?: string): string {
  switch (stage) {
    case "author_block":
      return "Analyzing author/affiliation block...";
    case "reference_detection":
      return "Detecting references/appendix pages...";
    case "initializing":
      return "Initializing translation engine...";
    case "finalizing":
      return "Finalizing translated PDF...";
    default:
      return message || "";
  }
}

function shouldLogEngineDetail(detail: string): boolean {
  if (!detail) return false;
  if (/\bERROR\b/i.test(detail)) return true;
  if (
    /(download|retry|overlay-translated|proxy|font subsetting|save with clean)/i.test(
      detail,
    )
  ) {
    return true;
  }
  return !LOW_SIGNAL_ENGINE_DETAIL_RE.test(detail);
}

function buildTranslationSummaryLine(stats?: TranslationStats): string {
  if (!stats || stats.total === undefined) return "";
  const parts = [`Paragraphs ${stats.total}`];
  if (stats.successful !== undefined)
    parts.push(`successful ${stats.successful}`);
  if (stats.fallback !== undefined) parts.push(`fallback ${stats.fallback}`);
  return parts.join(" | ");
}

function buildWarningSummaryLine(
  stats?: WarningStats,
  warningCount?: number,
): string {
  if (!stats || (!warningCount && Object.keys(stats).length === 0)) return "";
  const parts: string[] = [];
  if (stats.sameAsInput) parts.push(`same-as-input ${stats.sameAsInput}`);
  if (stats.lengthMismatch)
    parts.push(`length-mismatch ${stats.lengthMismatch}`);
  if (stats.editDistanceSmall)
    parts.push(`edit-distance ${stats.editDistanceSmall}`);
  if (stats.fallbackToSimple) parts.push(`fallback ${stats.fallbackToSimple}`);
  if (stats.other) parts.push(`other ${stats.other}`);
  const summary = parts.join(" | ");
  if (warningCount && summary) return `Warnings ${warningCount} | ${summary}`;
  if (warningCount) return `Warnings ${warningCount}`;
  return summary;
}

function readStepperValue(
  el: HTMLElement | null,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const parsed = parseInt(el?.textContent || String(defaultValue), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function bindCheckboxPref(
  body: Element,
  id: string,
  key: string,
  defaultValue: boolean,
): HTMLInputElement | null {
  const el = body.querySelector(`#${id}`) as HTMLInputElement | null;
  if (!el) return null;
  el.checked = getBoolPref(key, defaultValue);
  el.addEventListener("change", () => setBoolPref(key, !!el.checked));
  return el;
}

function bindStepperPref(
  body: Element,
  id: string,
  key: string,
  defaultValue: number,
  min: number,
  max: number,
): HTMLElement | null {
  const el = body.querySelector(`#${id}`) as HTMLElement | null;
  if (!el) return null;
  const apply = (value: number) => {
    const normalized = setNumberPref(key, value, min, max);
    el.textContent = String(normalized);
  };
  apply(getNumberPref(key, defaultValue, min, max));
  const persist = () => apply(readStepperValue(el, defaultValue, min, max));
  el.addEventListener("input", persist);
  el.addEventListener("blur", persist);
  el.parentElement?.addEventListener("click", () => {
    const win = el.ownerDocument?.defaultView;
    if (win) {
      win.setTimeout(persist, 0);
    } else {
      persist();
    }
  });
  return el;
}

function setTranslateCollapsible(
  toggle: HTMLElement | null,
  body: HTMLElement | null,
  collapsed: boolean,
): void {
  if (!toggle || !body) return;
  toggle.dataset.collapsed = String(collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-controls", body.id);
  body.style.display = collapsed ? "none" : "";
}

function bindCollapsiblePref(
  root: Element,
  toggleId: string,
  bodyId: string,
  key: string,
  defaultCollapsed: boolean,
): void {
  const toggle = root.querySelector(`#${toggleId}`) as HTMLElement | null;
  const content = root.querySelector(`#${bodyId}`) as HTMLElement | null;
  if (!toggle || !content) return;
  setTranslateCollapsible(toggle, content, getBoolPref(key, defaultCollapsed));
  toggle.addEventListener("click", () => {
    const collapsed = toggle.dataset.collapsed !== "true";
    setTranslateCollapsible(toggle, content, collapsed);
    setBoolPref(key, collapsed);
  });
}

function bindTranslateScrollPref(body: Element): void {
  const scroll = body.querySelector(
    "#llm-translate-scroll",
  ) as HTMLElement | null;
  if (!scroll) return;
  const saved = getNumberPref(TRANSLATE_PREFS.scrollTop, 0, 0, 1000000);
  const win = scroll.ownerDocument?.defaultView;
  if (saved > 0) {
    const restore = () => {
      scroll.scrollTop = saved;
    };
    if (win) win.setTimeout(restore, 0);
    else restore();
  }
  let saveTimer = 0;
  scroll.addEventListener("scroll", () => {
    if (!win) {
      setNumberPref(
        TRANSLATE_PREFS.scrollTop,
        scroll.scrollTop || 0,
        0,
        1000000,
      );
      return;
    }
    if (saveTimer) win.clearTimeout(saveTimer);
    saveTimer = win.setTimeout(() => {
      setNumberPref(
        TRANSLATE_PREFS.scrollTop,
        scroll.scrollTop || 0,
        0,
        1000000,
      );
      saveTimer = 0;
    }, 150);
  });
}

function persistCurrentTranslateOptions(body: Element): void {
  const checkboxPrefs: Array<[string, string]> = [
    ["llm-tr-mono", TRANSLATE_PREFS.outputMono],
    ["llm-tr-dual", TRANSLATE_PREFS.outputDual],
    ["llm-tr-skip-refs-auto", TRANSLATE_PREFS.skipRefsAuto],
    ["llm-tr-keep-appendix", TRANSLATE_PREFS.keepAppendixTranslated],
    ["llm-tr-protect-author", TRANSLATE_PREFS.protectAuthorBlock],
    ["llm-tr-disable-rich-text", TRANSLATE_PREFS.disableRichTextTranslate],
    ["llm-tr-enhance-compat", TRANSLATE_PREFS.enhanceCompatibility],
    ["llm-tr-translate-table", TRANSLATE_PREFS.translateTableText],
    ["llm-tr-ocr", TRANSLATE_PREFS.ocr],
    ["llm-tr-auto-ocr", TRANSLATE_PREFS.autoOcr],
    ["llm-tr-save-glossary", TRANSLATE_PREFS.saveGlossary],
    ["llm-tr-disable-glossary", TRANSLATE_PREFS.disableGlossary],
  ];
  for (const [id, key] of checkboxPrefs) {
    const el = body.querySelector(`#${id}`) as HTMLInputElement | null;
    if (el) setBoolPref(key, !!el.checked);
  }

  const dropdownPrefs: Array<[string, string, string]> = [
    ["llm-tr-source-lang", TRANSLATE_PREFS.sourceLang, "en"],
    ["llm-tr-target-lang", TRANSLATE_PREFS.targetLang, "zh-CN"],
    ["llm-tr-font-family", TRANSLATE_PREFS.fontFamily, "auto"],
  ];
  for (const [id, key, fallback] of dropdownPrefs) {
    const el = body.querySelector<HTMLSelectElement>(`#${id}`);
    setStringPref(key, el?.value || fallback);
  }

  setNumberPref(
    TRANSLATE_PREFS.qps,
    readStepperValue(
      body.querySelector("#llm-tr-qps") as HTMLElement | null,
      10,
      1,
      100,
    ),
    1,
    100,
  );
  setNumberPref(
    TRANSLATE_PREFS.poolMaxWorker,
    readStepperValue(
      body.querySelector("#llm-tr-pool-max-worker") as HTMLElement | null,
      1,
      1,
      32,
    ),
    1,
    32,
  );
}

/**
 * Populate the translate tab's custom dropdown with the same models
 * available in the chat tab.
 *
 * @param dropdownEl  the #llm-tr-model custom dropdown div element
 * @returns           the currently selected model name
 */
export function populateTranslateModelSelector(
  dropdownEl: HTMLElement,
): string {
  const { choices } = getModelChoices();
  const persisted = getPersistedTranslateModel();
  const persistedProvider = getPersistedTranslateProvider();
  const prevValue = dropdownEl.dataset.value || persisted;
  const prevProvider = dropdownEl.dataset.providerId || persistedProvider;

  const trigger = dropdownEl.querySelector(
    ".llm-tr-dropdown-trigger",
  ) as HTMLElement | null;
  const menu = dropdownEl.querySelector(
    ".llm-tr-dropdown-menu",
  ) as HTMLElement | null;
  if (!trigger || !menu) return "";

  // Clear menu
  menu.innerHTML = "";

  if (!choices.length) {
    if (trigger) {
      // Keep arrow
      const arrow = trigger.querySelector(".llm-tr-dropdown-arrow");
      trigger.textContent = "—";
      if (arrow) trigger.appendChild(arrow);
    }
    dropdownEl.dataset.value = "";
    dropdownEl.dataset.providerId = "";
    refreshTranslateReasoningSelector(dropdownEl, "", "");
    return "";
  }

  // Group by provider
  let lastProvider = "";
  let selectedModel = "";
  let selectedProviderId = "";
  const doc = dropdownEl.ownerDocument!;

  const selectItem = (model: string, providerId: string) => {
    dropdownEl.dataset.value = model;
    dropdownEl.dataset.providerId = providerId;
    // Update trigger text
    const arrow = trigger!.querySelector(".llm-tr-dropdown-arrow");
    trigger!.textContent = model;
    if (arrow) trigger!.appendChild(arrow);
    // Update selected highlight
    menu!.querySelectorAll(".llm-tr-dropdown-item").forEach((el: Element) => {
      const elModel = (el as HTMLElement).dataset.value || "";
      const elProvider = (el as HTMLElement).dataset.providerId || "";
      (el as HTMLElement).classList.toggle(
        "selected",
        elModel === model && elProvider === providerId,
      );
    });
    // Close menu
    menu!.style.display = "none";
    dropdownEl.classList.remove("open");
    // Persist
    persistTranslateModel(model);
    persistTranslateProvider(providerId);
    refreshTranslateReasoningSelector(dropdownEl, model, providerId);
  };

  for (const entry of choices) {
    const provider = entry.provider || "";
    if (provider && provider !== lastProvider) {
      lastProvider = provider;
      const groupLabel = doc.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "div",
      ) as HTMLDivElement;
      groupLabel.className = "llm-tr-dropdown-group";
      groupLabel.textContent = provider;
      menu.appendChild(groupLabel);
    }

    const item = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLDivElement;
    item.className = "llm-tr-dropdown-item";
    item.dataset.value = entry.model;
    item.dataset.providerId = entry.providerId || "";
    item.textContent = entry.model;
    item.addEventListener("click", () =>
      selectItem(entry.model, entry.providerId || ""),
    );
    menu.appendChild(item);

    // Match by model + providerId for disambiguation
    if (
      (entry.model === prevValue ||
        entry.model.toLowerCase() === prevValue.toLowerCase()) &&
      (!prevProvider || entry.providerId === prevProvider)
    ) {
      selectedModel = entry.model;
      selectedProviderId = entry.providerId || "";
    } else if (
      !selectedModel &&
      (entry.model === prevValue ||
        entry.model.toLowerCase() === prevValue.toLowerCase())
    ) {
      selectedModel = entry.model;
      selectedProviderId = entry.providerId || "";
    }
  }

  // Apply selection
  if (!selectedModel) {
    selectedModel = choices[0]?.model || "";
    selectedProviderId = choices[0]?.providerId || "";
  }
  if (selectedModel) {
    selectItem(selectedModel, selectedProviderId);
  }

  return selectedModel;
}

/** Show the reasoning efforts the selected translate model supports. */
function refreshTranslateReasoningSelector(
  modelDropdown: HTMLElement,
  model: string,
  providerId: string,
): void {
  const root =
    modelDropdown.closest("#llm-main") || modelDropdown.ownerDocument;
  const row = root?.querySelector(
    "#llm-tr-reasoning-row",
  ) as HTMLElement | null;
  const dropdown = root?.querySelector(
    "#llm-tr-reasoning",
  ) as HTMLElement | null;
  if (!row || !dropdown) return;
  const choice = getModelChoices().choices.find(
    (entry) => entry.model === model && (entry.providerId || "") === providerId,
  );
  renderReasoningEffortDropdown({
    apiBase: choice?.apiBase,
    apiKey: choice?.apiKey,
    dropdown,
    row,
    providerId,
    model,
    selected: getTranslateReasoningEffort(),
    onSelect: setTranslateReasoningEffort,
  });
}

/**
 * Get the currently selected translate model name.
 */
export function getTranslateModel(dropdownEl: HTMLElement): string {
  return dropdownEl.dataset.value || "";
}

/* ── Init: wire up event listeners ── */

type TabController = Pick<
  TranslateController,
  "getState" | "start" | "pause" | "abort"
>;

const tabEngine = {
  inspectTranslationOutputs,
  publishTranslationOutputs,
  resolveTranslationCredentials,
  checkTranslationEnvironment,
  async createController(
    callback: TranslateUICallback,
  ): Promise<TabController> {
    const { TranslateController } = await import("./index");
    return new TranslateController(callback);
  },
};

/**
 * Initialize the translate tab controller.
 * Call this once after buildUI completes and the DOM is ready.
 *
 * @param body  the panel body element (contains #llm-main)
 */
export function initTranslateTab(body: Element, engine = tabEngine): void {
  const modelSelect = body.querySelector("#llm-tr-model") as HTMLElement | null;
  if (!modelSelect) return;

  const outputDirEl = body.querySelector(
    "#llm-tr-output-dir",
  ) as HTMLInputElement | null;

  // Populate on init
  populateTranslateModelSelector(modelSelect);

  // Restore persisted translate options
  bindTranslationChoices(body);
  bindCheckboxPref(body, "llm-tr-mono", TRANSLATE_PREFS.outputMono, true);
  bindCheckboxPref(body, "llm-tr-dual", TRANSLATE_PREFS.outputDual, true);
  bindCheckboxPref(
    body,
    "llm-tr-skip-refs-auto",
    TRANSLATE_PREFS.skipRefsAuto,
    true,
  );
  bindCheckboxPref(
    body,
    "llm-tr-keep-appendix",
    TRANSLATE_PREFS.keepAppendixTranslated,
    true,
  );
  bindCheckboxPref(
    body,
    "llm-tr-protect-author",
    TRANSLATE_PREFS.protectAuthorBlock,
    true,
  );
  bindCheckboxPref(
    body,
    "llm-tr-disable-rich-text",
    TRANSLATE_PREFS.disableRichTextTranslate,
    false,
  );
  bindCheckboxPref(
    body,
    "llm-tr-enhance-compat",
    TRANSLATE_PREFS.enhanceCompatibility,
    false,
  );
  bindCheckboxPref(
    body,
    "llm-tr-translate-table",
    TRANSLATE_PREFS.translateTableText,
    false,
  );
  bindCheckboxPref(body, "llm-tr-ocr", TRANSLATE_PREFS.ocr, false);
  bindCheckboxPref(body, "llm-tr-auto-ocr", TRANSLATE_PREFS.autoOcr, false);
  bindCheckboxPref(
    body,
    "llm-tr-save-glossary",
    TRANSLATE_PREFS.saveGlossary,
    true,
  );
  bindCheckboxPref(
    body,
    "llm-tr-disable-glossary",
    TRANSLATE_PREFS.disableGlossary,
    false,
  );
  bindStepperPref(body, "llm-tr-qps", TRANSLATE_PREFS.qps, 10, 1, 100);
  bindStepperPref(
    body,
    "llm-tr-pool-max-worker",
    TRANSLATE_PREFS.poolMaxWorker,
    1,
    1,
    32,
  );
  bindCollapsiblePref(
    body,
    "llm-tr-advanced-toggle",
    "llm-tr-advanced-body",
    TRANSLATE_PREFS.advancedCollapsed,
    true,
  );
  bindCollapsiblePref(
    body,
    "llm-tr-console-toggle",
    "llm-tr-console",
    TRANSLATE_PREFS.consoleCollapsed,
    false,
  );
  bindTranslateScrollPref(body);
  if (outputDirEl)
    outputDirEl.value = getStringPref(TRANSLATE_PREFS.outputDir, "");
  try {
    mountTranslateQueueView(body, () => {
      persistCurrentTranslateOptions(body);
      persistTranslateModel(modelSelect.dataset.value || "");
      persistTranslateProvider(modelSelect.dataset.providerId || "");
    });
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to mount the translation queue view", err);
  }

  // Persist translate options on change
  outputDirEl?.addEventListener("change", () =>
    setStringPref(TRANSLATE_PREFS.outputDir, outputDirEl.value || ""),
  );
  outputDirEl?.addEventListener("blur", () =>
    setStringPref(TRANSLATE_PREFS.outputDir, outputDirEl.value || ""),
  );

  // Model selection persistence is handled internally by the custom dropdown

  // Re-populate when tab becomes visible (models may have been added/removed)
  const tabBtn = body.querySelector(
    "#llm-tab-btn-translate",
  ) as HTMLButtonElement | null;
  if (tabBtn) {
    tabBtn.addEventListener("click", () => {
      populateTranslateModelSelector(modelSelect);
      updatePdfSourceFromItem(body);
      void refreshEnvironmentNotice();
    });
  }
  const panelRoot = body.querySelector("#llm-main") as HTMLElement | null;
  if (panelRoot?.dataset.activeTab === "translate") {
    void updatePdfSourceFromItem(body);
  }

  // ── File picker button ──
  const pickFileBtn = body.querySelector(
    "#llm-tr-pick-file",
  ) as HTMLButtonElement | null;
  if (pickFileBtn) {
    pickFileBtn.addEventListener("click", async () => {
      try {
        const { pickPdfFile } = await import("./nativePicker");
        const win = (body.ownerDocument as any)?.defaultView;
        if (!win) return;
        const path = await pickPdfFile(win);
        if (path) {
          setSelectedPdfPath(body, path);
        }
      } catch (err) {
        const i18n = getPanelI18n();
        consoleLog(body, `❌ ${i18n.trLogError(String(err))}`, "error");
      }
    });
  }

  // ── Browse output directory ──
  const browseDirBtn = body.querySelector(
    "#llm-tr-browse-dir",
  ) as HTMLButtonElement | null;
  if (browseDirBtn) {
    browseDirBtn.addEventListener("click", async () => {
      try {
        const { pickDirectory } = await import("./nativePicker");
        const win = (body.ownerDocument as any)?.defaultView;
        if (!win) return;
        const path = await pickDirectory(win);
        if (path) {
          const dirInput = body.querySelector(
            "#llm-tr-output-dir",
          ) as HTMLInputElement | null;
          if (dirInput) {
            dirInput.value = path;
            // Native picker changes do not fire DOM events. Notify the same
            // preference and validation listeners as a manually edited path.
            dirInput.dispatchEvent(new win.Event("change", { bubbles: true }));
          }
        }
      } catch (err) {
        const i18n = getPanelI18n();
        consoleLog(body, `❌ ${i18n.trLogError(String(err))}`, "error");
      }
    });
  }

  // ── Console clear button ──
  const consoleClearBtn = body.querySelector(
    "#llm-tr-console-clear",
  ) as HTMLButtonElement | null;
  if (consoleClearBtn) {
    consoleClearBtn.addEventListener("click", () => {
      clearConsole(body);
    });
  }

  // ── Console copy button ──
  const consoleCopyBtn = body.querySelector(
    "#llm-tr-console-copy",
  ) as HTMLButtonElement | null;
  if (consoleCopyBtn) {
    consoleCopyBtn.addEventListener("click", () => {
      copyConsole(body);
    });
  }

  // ── Fixed install/update button and inline update notice ──
  const installBtn = body.querySelector(
    "#llm-tr-install-env",
  ) as HTMLButtonElement | null;
  const envNotice = body.querySelector(
    "#llm-tr-env-update-status",
  ) as HTMLElement | null;
  let noticeBusy = false;
  let noticePending = false;
  async function refreshEnvironmentNotice(forceRemote = false): Promise<void> {
    if (!envNotice) return;
    if (noticeBusy) {
      noticePending = true;
      return;
    }
    noticeBusy = true;
    const zh = getPanelLang().startsWith("zh");
    envNotice.textContent = zh
      ? "正在检查翻译环境…"
      : "Checking translation environment…";
    try {
      const { inspectTranslationEnvironment } =
        await import("./translationEnvUpdater");
      const state = await inspectTranslationEnvironment(forceRemote);
      const labels = zh
        ? {
            install: "尚未安装翻译环境，点击按钮安装。",
            current: "翻译环境已是当前兼容版本。",
            update: `发现已验证的环境更新（修订版 ${state.targetRevision}），点击按钮更新。`,
            repair: "翻译环境需要修复，点击按钮重新安装。",
          }
        : {
            install: "Translation environment is missing. Click to install.",
            current: "Translation environment is current and compatible.",
            update: `Verified environment revision ${state.targetRevision} is available. Click to update.`,
            repair: "Translation environment needs repair. Click to reinstall.",
          };
      envNotice.textContent = labels[state.action];
      if (state.warning && state.action === "current") {
        envNotice.textContent = zh
          ? "当前环境可用；在线检查未完成，点击按钮重试。"
          : "Current environment works; online check failed. Click to retry.";
      }
      envNotice.dataset.action = state.action;
      if (state.warning) {
        envNotice.title = state.warning;
      } else {
        envNotice.removeAttribute("title");
      }
    } catch (err) {
      envNotice.textContent = zh
        ? "环境检查失败；点击按钮重试。"
        : "Environment check failed. Click to retry.";
      envNotice.title = String(err);
    } finally {
      noticeBusy = false;
      if (noticePending) {
        noticePending = false;
        void refreshEnvironmentNotice();
      }
    }
  }
  if (panelRoot?.dataset.activeTab === "translate") {
    void refreshEnvironmentNotice();
  }
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      const i18n = getPanelI18n();
      installBtn.disabled = true;
      consoleLog(
        body,
        "🔍 Checking translation environment updates...",
        "info",
      );
      try {
        const { installOrUpdateTranslationEnvironment } =
          await import("./translationEnvUpdater");
        const result = await installOrUpdateTranslationEnvironment(
          (step, detail) => {
            consoleLog(
              body,
              detail,
              detail.startsWith("✅") ? "success" : "info",
            );
          },
        );
        consoleLog(
          body,
          `✅ ${result.action === "current" ? (getPanelLang().startsWith("zh") ? "已是当前兼容版本，无需更新。" : "Environment is current; no update needed.") : i18n.trLogEnvironmentSetupComplete}`,
          "success",
        );
      } catch (err) {
        consoleLog(body, `❌ ${i18n.trLogError(String(err))}`, "error");
      } finally {
        installBtn.disabled = false;
        void refreshEnvironmentNotice();
      }
    });
  }

  // ── Start translation button ──
  const startBtn = body.querySelector(
    "#llm-tr-start",
  ) as HTMLButtonElement | null;
  const pauseBtn = body.querySelector(
    "#llm-tr-pause",
  ) as HTMLButtonElement | null;
  const clearBtn = body.querySelector(
    "#llm-tr-clear",
  ) as HTMLButtonElement | null;
  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true;
      try {
        await startTranslation(body, engine);
      } catch (err) {
        const i18n = getPanelI18n();
        consoleLog(body, `❌ ${i18n.trLogError(String(err))}`, "error");
      } finally {
        startBtn.disabled = false;
      }
    });
  }

  // ── Pause / Resume button ──
  if (pauseBtn) {
    pauseBtn.addEventListener("click", async () => {
      const session = getTranslationSession(body);
      if (!session.activeController) return;
      try {
        if (session.isPaused) {
          // Resume from pdf2zh_next's cache with a fresh bridge/OAuth proxy.
          // Keep the paused controller and original source until a restart is
          // admitted and prepared. A busy/failed attempt must remain resumable.
          if (session.activeRequest) {
            await startTranslation(body, engine, session.activeRequest);
          }
        } else if (session.activeController.getState() === "running") {
          // Pause
          session.activeController.pause();
          session.isPaused = true;
          const i18n = getPanelI18n();
          pauseBtn.textContent = `▶ ${i18n.trResume}`;
          pauseBtn.className = "llm-tr-btn llm-tr-btn-primary";
          consoleLog(body, `⏸ ${i18n.trLogPaused}`, "info");
        }
      } catch (err) {
        const i18n = getPanelI18n();
        consoleLog(body, `❌ ${i18n.trLogPauseError(String(err))}`, "error");
      }
    });
  }

  // ── Clear cache button ──
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      // Block clearing while translation is actively running
      const session = getTranslationSession(body);
      const release = tryReserveTranslation();
      if (!release) {
        const i18n = getPanelI18n();
        consoleLog(body, `⚠️ ${i18n.trLogCannotClearRunning}`, "error");
        return;
      }
      clearBtn.disabled = true;
      try {
        // Stop active controller if paused
        if (session.activeController) {
          try {
            session.activeController.abort?.();
          } catch {
            /* ignore */
          }
        }
        const cleared = await clearTranslateTempCache();
        const i18n = getPanelI18n();
        consoleLog(
          body,
          i18n.trLogCacheDetails(cleared.removed, cleared.skippedRunning),
          "info",
        );
        consoleLog(body, `🗑 ${i18n.trLogClearDone}`, "info");
      } catch (err) {
        const i18n = getPanelI18n();
        consoleLog(body, `❌ ${i18n.trLogClearError(String(err))}`, "error");
      } finally {
        release();
        resetTranslationSessionUi(session, body);
      }
    });
  }
}

/**
 * Refresh the translate model selector (e.g., after OAuth model list update).
 */
export function refreshTranslateModels(body: Element): void {
  const modelSelect = body.querySelector("#llm-tr-model") as HTMLElement | null;
  if (modelSelect) populateTranslateModelSelector(modelSelect);
}

/* ── Internal helpers ── */

interface TabRequest {
  pdfPath: string;
  modelName: string;
  modelProviderId: string;
  options: SavedTranslateOptions;
  plan: OutputPlan;
}

interface TranslationSession {
  selectedPdfPath: string;
  translationStartTime: number;
  isPaused: boolean;
  activeController: TabController | null;
  activeRequest: TabRequest | null;
  progressTimer: ReturnType<typeof setInterval> | null;
  targetProgressPct: number;
  displayProgressPct: number;
  translationBody: Element | null;
  heartbeatCounter: number;
  lastKnownCurrentPage: number | null;
  lastKnownTotalPages: number | null;
  recentPageDurationsSec: number[];
  lastPageBoundaryAt: number;
  lastPageBoundaryPage: number | null;
}

const _translationSessions = new WeakMap<Element, TranslationSession>();

function createTranslationSession(): TranslationSession {
  return {
    selectedPdfPath: "",
    translationStartTime: 0,
    isPaused: false,
    activeController: null,
    activeRequest: null,
    progressTimer: null,
    targetProgressPct: 0,
    displayProgressPct: 0,
    translationBody: null,
    heartbeatCounter: 0,
    lastKnownCurrentPage: null,
    lastKnownTotalPages: null,
    recentPageDurationsSec: [],
    lastPageBoundaryAt: 0,
    lastPageBoundaryPage: null,
  };
}

function getTranslationSession(body: Element): TranslationSession {
  let session = _translationSessions.get(body);
  if (!session) {
    session = createTranslationSession();
    _translationSessions.set(body, session);
  }
  return session;
}

/** Track translation start time for elapsed/remaining calculations */

/** Track pause state */

/** Active controller instance for pause/resume/clear */

/** Independent progress bar refresh timer (1s) */
/** Last known progress percentage for timer-based refresh */
/** Reference to body element for timer-based updates */
/** Heartbeat counter — log every 15s when idle */

const PROGRESS_TIMER_INTERVAL_MS = 250;
const PROGRESS_SMOOTHING_FACTOR = 0.18;
const PROGRESS_MIN_STEP = 0.25;
const PAGE_DURATION_HISTORY_LIMIT = 8;
const ACTIVE_JOB_LOCK_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function setSelectedPdfPath(body: Element, pdfPath: string): void {
  getTranslationSession(body).selectedPdfPath = pdfPath;
  const nameEl = body.querySelector("#llm-tr-pdf-name") as HTMLElement | null;
  if (nameEl) {
    // Show just the filename
    const basename = pdfPath.split(/[\\/]/).pop() || pdfPath;
    nameEl.textContent = basename;
    nameEl.title = pdfPath;
  }
}

function resetProgressTracking(session: TranslationSession): void {
  session.targetProgressPct = 0;
  session.displayProgressPct = 0;
  session.lastKnownCurrentPage = null;
  session.lastKnownTotalPages = null;
  session.recentPageDurationsSec = [];
  session.lastPageBoundaryAt = 0;
  session.lastPageBoundaryPage = null;
}

function recordPageProgress(
  session: TranslationSession,
  current?: number,
  total?: number,
): void {
  if (
    typeof current !== "number" ||
    !Number.isFinite(current) ||
    typeof total !== "number" ||
    !Number.isFinite(total) ||
    current <= 0 ||
    total <= 0
  ) {
    return;
  }

  session.lastKnownCurrentPage = current;
  session.lastKnownTotalPages = total;

  const now = Date.now();
  if (
    session.lastPageBoundaryPage !== null &&
    current > session.lastPageBoundaryPage &&
    session.lastPageBoundaryAt > 0
  ) {
    const deltaPages = current - session.lastPageBoundaryPage;
    const deltaSec = (now - session.lastPageBoundaryAt) / 1000;
    if (deltaPages > 0 && deltaSec > 0) {
      session.recentPageDurationsSec.push(deltaSec / deltaPages);
      if (session.recentPageDurationsSec.length > PAGE_DURATION_HISTORY_LIMIT) {
        session.recentPageDurationsSec = session.recentPageDurationsSec.slice(
          -PAGE_DURATION_HISTORY_LIMIT,
        );
      }
    }
  }

  if (
    session.lastPageBoundaryPage === null ||
    current !== session.lastPageBoundaryPage
  ) {
    session.lastPageBoundaryPage = current;
    session.lastPageBoundaryAt = now;
  }
}

function updateProgress(
  session: TranslationSession,
  body: Element,
  pct: number,
  _text: string,
  opts?: { current?: number; total?: number; force?: boolean },
): void {
  const safePct = Math.max(0, Math.min(100, pct));
  if (opts?.force) {
    session.targetProgressPct = safePct;
    session.displayProgressPct = safePct;
  } else {
    session.targetProgressPct = Math.max(session.targetProgressPct, safePct);
  }
  recordPageProgress(session, opts?.current, opts?.total);
  _refreshProgressBar(session, body);
}

function estimateRemainingSeconds(
  session: TranslationSession,
  elapsedSeconds: number,
): number | null {
  if (session.displayProgressPct >= 100) return 0;

  if (
    session.lastKnownCurrentPage !== null &&
    session.lastKnownTotalPages !== null &&
    session.recentPageDurationsSec.length > 0
  ) {
    const remainingPages = Math.max(
      0,
      session.lastKnownTotalPages - session.lastKnownCurrentPage,
    );
    const avgPerPage =
      session.recentPageDurationsSec.reduce((sum, value) => sum + value, 0) /
      session.recentPageDurationsSec.length;
    return remainingPages * avgPerPage;
  }

  if (session.displayProgressPct > 0 && elapsedSeconds > 0) {
    const totalEstimated = elapsedSeconds / (session.displayProgressPct / 100);
    return Math.max(0, totalEstimated - elapsedSeconds);
  }

  return null;
}

function advanceDisplayedProgress(session: TranslationSession): void {
  if (session.displayProgressPct >= session.targetProgressPct) return;
  const delta = session.targetProgressPct - session.displayProgressPct;
  const step =
    session.targetProgressPct >= 100
      ? delta
      : Math.max(PROGRESS_MIN_STEP, delta * PROGRESS_SMOOTHING_FACTOR);
  session.displayProgressPct = Math.min(
    session.targetProgressPct,
    session.displayProgressPct + step,
  );
}

/** Refresh progress bar time display (called by both poller and timer) */
function _refreshProgressBar(session: TranslationSession, body: Element): void {
  const fill = body.querySelector(
    "#llm-tr-progress-fill",
  ) as HTMLElement | null;
  if (fill) {
    const pct = Math.max(0, Math.min(100, session.displayProgressPct));
    fill.style.width = `${pct}%`;
    const i18n = getPanelI18n();
    const elapsed =
      session.translationStartTime > 0
        ? (Date.now() - session.translationStartTime) / 1000
        : 0;
    const elapsedStr = formatDuration(elapsed);
    let remainStr = "--:--";
    const remaining = estimateRemainingSeconds(session, elapsed);
    if (remaining !== null && pct < 100) {
      remainStr = formatDuration(remaining);
    } else if (pct >= 100) {
      remainStr = "00:00";
    }
    const isZh = getPanelLang().startsWith("zh");
    const elapsedLabel = isZh ? "已用" : "Elapsed";
    const remainLabel = isZh ? "剩余" : "Remaining";
    const pageText =
      session.lastKnownCurrentPage !== null &&
      session.lastKnownTotalPages !== null &&
      session.lastKnownTotalPages > 0
        ? ` | Page ${session.lastKnownCurrentPage}/${session.lastKnownTotalPages}`
        : "";
    fill.textContent =
      pct > 0
        ? `${Math.round(pct)}%${pageText} | ${elapsedLabel}: ${elapsedStr} | ${remainLabel}: ${remainStr}`
        : "";
  }
}

/** Start the independent 1s progress bar timer */
function _startProgressTimer(session: TranslationSession, body: Element): void {
  _stopProgressTimer(session);
  session.translationBody = body;
  session.heartbeatCounter = 0;
  session.progressTimer = setInterval(() => {
    if (session.translationBody && session.translationStartTime > 0) {
      advanceDisplayedProgress(session);
      _refreshProgressBar(session, session.translationBody);
    }
  }, PROGRESS_TIMER_INTERVAL_MS);
}

/** Stop the progress bar timer */
function _stopProgressTimer(session: TranslationSession): void {
  if (session.progressTimer) {
    clearInterval(session.progressTimer);
    session.progressTimer = null;
  }
  session.translationBody = null;
  session.heartbeatCounter = 0;
}

function restoreTranslationControls(body: Element): void {
  const i18n = getPanelI18n();
  const startBtn = body.querySelector(
    "#llm-tr-start",
  ) as HTMLButtonElement | null;
  const pauseBtn = body.querySelector(
    "#llm-tr-pause",
  ) as HTMLButtonElement | null;
  const clearBtn = body.querySelector(
    "#llm-tr-clear",
  ) as HTMLButtonElement | null;

  if (startBtn) {
    startBtn.style.display = "";
    startBtn.disabled = false;
  }
  if (pauseBtn) {
    pauseBtn.style.display = "none";
    pauseBtn.disabled = false;
    pauseBtn.textContent = `⏸ ${i18n.trPause}`;
    pauseBtn.className = "llm-tr-btn llm-tr-btn-warning";
  }
  if (clearBtn) clearBtn.disabled = false;
}

function resetTranslationSessionUi(
  session: TranslationSession,
  body: Element,
): void {
  _stopProgressTimer(session);
  session.translationStartTime = 0;
  session.isPaused = false;
  session.activeController = null;
  session.activeRequest = null;
  resetProgressTracking(session);
  updateProgress(session, body, 0, "", { force: true });
  restoreTranslationControls(body);
}
function isAbsolutePath(path: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.startsWith("\\\\") ||
    path.startsWith("/")
  );
}

function resolveChildPath(parent: string, child: string): string {
  return isAbsolutePath(child) ? child : PathUtils.join(parent, child);
}

async function isActiveJobDirectory(jobDir: string): Promise<boolean> {
  const lockPath = PathUtils.join(jobDir, "running.lock");
  try {
    if (!(await IOUtils.exists(lockPath))) return false;
    const text = await IOUtils.readUTF8(lockPath);
    const data = JSON.parse(text) as { startedAt?: unknown };
    const startedAt = typeof data.startedAt === "number" ? data.startedAt : 0;
    if (!Number.isFinite(startedAt) || startedAt <= 0) return true;
    return Date.now() - startedAt < ACTIVE_JOB_LOCK_MAX_AGE_MS;
  } catch {
    return true;
  }
}

async function clearTranslateTempCache(): Promise<{
  removed: number;
  skippedRunning: number;
}> {
  const tempDir = String(PathUtils.tempDir || "").trim();
  if (!tempDir) return { removed: 0, skippedRunning: 0 };

  const cacheDir = PathUtils.join(tempDir, "aidea-translate");
  const legacyEntries = [
    "progress.json",
    "progress.json.tmp",
    "config.toml",
    "task.json",
    "bridge.log",
  ];

  let removed = 0;
  let skippedRunning = 0;
  for (const entry of legacyEntries) {
    try {
      await IOUtils.remove(PathUtils.join(cacheDir, entry), {
        recursive: true,
      });
      removed += 1;
    } catch {
      /* file may not exist */
    }
  }

  const jobsDir = PathUtils.join(cacheDir, "jobs");
  try {
    if (!(await IOUtils.exists(jobsDir))) return { removed, skippedRunning };
    const children = (await (IOUtils as any).getChildren(jobsDir)) as string[];
    for (const child of children) {
      const jobPath = resolveChildPath(jobsDir, String(child));
      if (await isActiveJobDirectory(jobPath)) {
        skippedRunning += 1;
        continue;
      }
      try {
        await IOUtils.remove(jobPath, { recursive: true });
        removed += 1;
      } catch {
        /* ignore per-job cleanup failure */
      }
    }
  } catch {
    /* ignore cleanup failure */
  }

  return { removed, skippedRunning };
}

/** Format seconds to MM:SS or HH:MM:SS */
function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Append a timestamped line to the console log area. */
function consoleLog(
  body: Element,
  msg: string,
  level: "info" | "success" | "error" = "info",
): HTMLDivElement | undefined {
  const consoleBody = body.querySelector(
    "#llm-tr-console-body",
  ) as HTMLElement | null;
  if (!consoleBody) return;
  const doc = body.ownerDocument;
  if (!doc) return;

  // Auto-expand console if it is collapsed
  const consoleToggle = body.querySelector(
    "#llm-tr-console-toggle",
  ) as HTMLElement | null;
  const consoleEl = body.querySelector("#llm-tr-console") as HTMLElement | null;
  if (
    consoleToggle &&
    consoleToggle.dataset.collapsed === "true" &&
    consoleEl
  ) {
    setTranslateCollapsible(consoleToggle, consoleEl, false);
  }

  const line = doc.createElement("div");
  line.className = `llm-tr-console-line ${level}`;

  const time = doc.createElement("span");
  time.className = "llm-tr-console-time";
  const now = new Date();
  time.textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const msgSpan = doc.createElement("span");
  msgSpan.className = "llm-tr-console-msg";
  msgSpan.textContent = msg;

  line.append(time, msgSpan);
  consoleBody.appendChild(line);

  // Auto-scroll to bottom
  consoleBody.scrollTop = consoleBody.scrollHeight;
  return line;
}

/** Clear all console log lines. */
function clearConsole(body: Element): void {
  const consoleBody = body.querySelector(
    "#llm-tr-console-body",
  ) as HTMLElement | null;
  if (consoleBody) consoleBody.textContent = "";
}

/** Copy all console text to clipboard. */
function copyConsole(body: Element): void {
  const consoleBody = body.querySelector(
    "#llm-tr-console-body",
  ) as HTMLElement | null;
  if (!consoleBody) return;
  const lines = consoleBody.querySelectorAll(".llm-tr-console-line");
  const text = (Array.from(lines) as Element[])
    .map((line) => {
      const time =
        line.querySelector(".llm-tr-console-time")?.textContent || "";
      const msg = line.querySelector(".llm-tr-console-msg")?.textContent || "";
      return `${time}  ${msg}`;
    })
    .join("\n");
  // Use Zotero's built-in clipboard helper
  try {
    const clipboardHelper = (Components.classes as any)[
      "@mozilla.org/widget/clipboardhelper;1"
    ]?.getService((Components.interfaces as any).nsIClipboardHelper);
    if (clipboardHelper) {
      clipboardHelper.copyString(text);
    }
  } catch {
    // Fallback: modern clipboard API
    try {
      (body.ownerDocument as any)?.defaultView?.navigator?.clipboard?.writeText(
        text,
      );
    } catch {
      /* ignore */
    }
  }
}

/**
 * Auto-detect PDF from the current Zotero item.
 */
async function updatePdfSourceFromItem(body: Element): Promise<void> {
  try {
    const { resolveItemPdfPath } = await import("./pdfSourceResolver");
    // Get current item from Zotero
    const pane = (Zotero as any).getActiveZoteroPane?.();
    const items = pane?.getSelectedItems?.() || [];
    const item = items[0];
    if (item) {
      const path = await resolveItemPdfPath(item);
      if (path) {
        setSelectedPdfPath(body, path);
        return;
      }
    }
  } catch {
    // ignore — user can always pick manually
  }
}

/**
 * The Zotero PDF attachment whose file is `pdfPath`, if the PDF being
 * translated belongs to the selected item rather than to a file picked from
 * disk.
 */
async function findAttachmentForPdfPath(pdfPath: string): Promise<any | null> {
  try {
    const pane = (Zotero as any).getActiveZoteroPane?.();
    for (const item of pane?.getSelectedItems?.() || []) {
      const candidates = item.isAttachment?.()
        ? [item]
        : (item.getAttachments?.() || []).map((id: number) =>
            Zotero.Items.get(id),
          );
      for (const attachment of candidates) {
        if (!attachment || !findPdfAttachment(attachment)) continue;
        if ((await attachment.getFilePathAsync?.()) === pdfPath) {
          return attachment;
        }
      }
    }
  } catch {
    /* treated as a PDF without a Zotero item */
  }
  return null;
}

/**
 * Main translation flow.
 */
async function startTranslation(
  body: Element,
  engine: typeof tabEngine,
  resumeRequest?: TabRequest,
): Promise<void> {
  const release = tryReserveTranslation();
  if (!release) {
    consoleLog(
      body,
      getPanelI18n().trLogError(getTranslateMenuCopy(getPanelLang()).busy),
      "error",
    );
    return;
  }
  try {
    const request = resumeRequest ?? (await prepareTabRequest(body, engine));
    if (request)
      await runTabTranslation(body, engine, request, !!resumeRequest);
  } finally {
    release();
  }
}

/** Snapshot the settings, source, and authorized destinations at Start. A resume
 * reuses this exact plan; it cannot inherit new targets or overwrite consent. */
async function prepareTabRequest(
  body: Element,
  engine: typeof tabEngine,
): Promise<TabRequest | null> {
  const i18n = getPanelI18n();
  const copy = batchCopy();
  const overwrite = takeTabOverwrite(body);
  const pdfPath = getTranslationSession(body).selectedPdfPath;
  const model = body.querySelector<HTMLElement>("#llm-tr-model");
  const modelName = model?.dataset.value || "";
  const modelProviderId = model?.dataset.providerId || "";
  if (!pdfPath) {
    consoleLog(body, i18n.trLogError(i18n.trNoPdfFound), "error");
    return null;
  }
  persistCurrentTranslateOptions(body);
  const options = readSavedTranslateOptions();
  const checked = (id: string, fallback: boolean) =>
    body.querySelector<HTMLInputElement>(`#llm-tr-${id}`)?.checked ?? fallback;
  const kinds: TranslationOutputKind[] = [];
  if (checked("mono", options.generateMono)) kinds.push("mono");
  if (checked("dual", options.generateDual)) kinds.push("dual");
  const wantsAttach = checked(
    "output-attach",
    getBoolPref(TRANSLATE_PREFS.outputAttach, true),
  );
  const wantsFolder = checked("output-save-dir", isSaveToOutputDirEnabled());
  const saveDir = wantsFolder
    ? (
        body.querySelector<HTMLInputElement>("#llm-tr-output-dir")?.value || ""
      ).trim()
    : "";
  const invalid = !kinds.length
    ? copy.needFormat
    : !wantsAttach && !wantsFolder
      ? copy.needDestination
      : wantsFolder && !saveDir
        ? copy.needFolder
        : "";
  if (invalid) {
    consoleLog(body, invalid, "error");
    return null;
  }
  if (saveDir) setStringPref(TRANSLATE_PREFS.outputDir, saveDir);
  const source = await findAttachmentForPdfPath(pdfPath);
  if (!source && !saveDir) {
    consoleLog(body, copy.needFolder, "error");
    return null;
  }
  const plan = await engine.inspectTranslationOutputs(
    source,
    pdfPath,
    options.targetLang,
    kinds,
    { attach: wantsAttach && !!source, saveDir },
    overwrite,
  );
  if (!plan.generateKinds.length) {
    consoleLog(body, getQueueCopy(getPanelLang()).status.skipped, "info");
    return null;
  }
  if (!modelName) {
    consoleLog(body, i18n.trLogError(i18n.modelNoModels), "error");
    return null;
  }
  if (!confirmPdfLayout(options.targetLang, getPanelLang())) return null;
  const existing = plan.cells.filter((cell) => cell.exists).length;
  if (plan.overwrite && existing) {
    const summary = copy.confirm({
      documents: 1,
      skip: 0,
      generate: 1,
      replace: existing,
      missing: plan.cells.length - existing,
    });
    if (!body.ownerDocument?.defaultView?.confirm(summary)) return null;
  }
  return {
    pdfPath,
    modelName,
    modelProviderId,
    plan,
    options: {
      ...options,
      generateMono: plan.generateKinds.includes("mono"),
      generateDual: plan.generateKinds.includes("dual"),
    },
  };
}

/** The bridge reports filenames. Never publish or unlink a path outside this
 * invocation's private directory, even if an engine reports an absolute path. */
function stagedFiles(dir: string, manifest: string[]): string[] {
  if (!manifest.length)
    throw new Error("The engine did not report the output filenames.");
  return manifest.map((entry) => {
    const name = entry.split(/[\\/]/).pop() || "";
    if (!/\.pdf$/i.test(name)) throw new Error(`Unexpected output: ${entry}`);
    const file = PathUtils.join(dir, name);
    if (entry !== name && entry !== file)
      throw new Error(`Output outside the task directory: ${entry}`);
    return file;
  });
}

async function fileTabResult(
  body: Element,
  engine: typeof tabEngine,
  plan: OutputPlan,
  dir: string,
  manifest: string[],
  elapsed: number,
): Promise<void> {
  const i18n = getPanelI18n();
  const retained = (err: unknown) =>
    consoleLog(
      body,
      `${i18n.trLogError(String(err))}\n${i18n.trLogOutputLabel}: ${dir}`,
      "error",
    );
  let files: string[];
  try {
    files = stagedFiles(dir, manifest);
    validateGeneratedManifest(plan, files);
  } catch (err) {
    retained(err);
    return;
  }

  // Retrying this log entry only completes this plan, independent of current
  // selections. Already-filed cells (especially replacements) are not replayed.
  const completed: string[] = [];
  let failureLine: HTMLDivElement | undefined;
  const publish = async (): Promise<boolean> => {
    try {
      const { savedFiles } = await engine.publishTranslationOutputs(
        plan,
        files,
        completed,
        (id) => {
          if (!completed.includes(id)) completed.push(id);
        },
      );
      for (const file of savedFiles)
        consoleLog(body, i18n.trLogOutputFile(file), "success");
    } catch (err) {
      failureLine = retained(err);
      return false;
    }
    consoleLog(
      body,
      `${i18n.trDone}! ${i18n.trLogTotalTime(formatDuration(elapsed))}`,
      "success",
    );
    consoleLog(body, `─── ${i18n.trLogJobFinished} ───`, "success");
    try {
      // A glossary or unreported file may be the only copy. Never clean recursively.
      for (const file of files)
        await IOUtils.remove(file, { ignoreAbsent: true });
      if (!(await IOUtils.getChildren(dir)).length) await IOUtils.remove(dir);
      else consoleLog(body, `${i18n.trLogOutputLabel}: ${dir}`);
    } catch (err) {
      retained(err); // Filing succeeded; cleanup is not a reason to republish.
    }
    return true;
  };
  if ((await publish()) || !failureLine || !body.ownerDocument) return;
  const retry = body.ownerDocument.createElement("button");
  retry.type = "button";
  retry.className = "llm-tr-btn llm-tr-btn-small";
  retry.textContent = getQueueCopy(getPanelLang()).btnRetry;
  retry.addEventListener("click", async () => {
    if (retry.disabled) return;
    const release = tryReserveTranslation();
    if (!release) {
      consoleLog(body, getTranslateMenuCopy(getPanelLang()).busy, "error");
      return;
    }
    retry.disabled = true;
    try {
      if (await publish()) retry.remove();
      else retry.disabled = false;
    } finally {
      release();
    }
  });
  failureLine.appendChild(retry);
}

async function runTabTranslation(
  body: Element,
  engine: typeof tabEngine,
  request: TabRequest,
  resuming: boolean,
): Promise<void> {
  const i18n = getPanelI18n();
  const session = getTranslationSession(body);
  const { pdfPath, modelName, modelProviderId, options, plan } = request;
  // Always stage in a new directory. The engine must never see a user-selected
  // destination (it can replace a live PDF before asking us to file anything).
  const outputDir = PathUtils.join(
    PathUtils.tempDir,
    "aidea-translate",
    "tab-output",
    `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  let manifest: string[] = [];
  let unsafeOutput = "";

  // Detailed console logging
  const pdfBasename = pdfPath.split(/[\\/]/).pop() || pdfPath;
  consoleLog(body, `─── ${i18n.trLogJobStarted} ───`, "info");
  consoleLog(body, `📄 ${i18n.trLogPdfLabel}: ${pdfBasename}`, "info");
  consoleLog(body, `   ${i18n.trLogFullPath}: ${pdfPath}`, "info");
  consoleLog(body, `🤖 ${i18n.trLogModelLabel}: ${modelName}`, "info");
  consoleLog(
    body,
    `🌐 ${i18n.trLogLanguageLabel}: ${options.sourceLang} → ${options.targetLang}`,
    "info",
  );
  consoleLog(body, `📁 ${i18n.trLogOutputLabel}: ${outputDir}`, "info");
  consoleLog(
    body,
    `📝 ${i18n.trLogOutputFormat(options.generateMono, options.generateDual)}`,
    "info",
  );
  consoleLog(
    body,
    `⚙️ ${i18n.trLogAdvancedOptions(
      options.skipReferencesAuto,
      options.enhanceCompatibility,
      options.ocr,
      options.autoOcr,
    )}`,
    "info",
  );

  // Resolve model credentials
  consoleLog(body, `🔑 ${i18n.trLogResolvingCredentials}`, "info");
  let resolved;
  try {
    resolved = await engine.resolveTranslationCredentials(
      modelName,
      modelProviderId || undefined,
    );
  } catch (err) {
    consoleLog(
      body,
      `❌ ${i18n.trLogFailedToResolveCredentials(String(err))}`,
      "error",
    );
    return;
  }
  const { creds, authMode, reasoningEffort } = resolved;
  consoleLog(body, `🔑 ${i18n.trLogAuthLabel}: ${authMode}`, "success");
  consoleLog(body, `   ${i18n.trLogModelIdLabel}: ${creds.modelId}`, "info");
  consoleLog(body, `   ${i18n.trLogApiBaseLabel}: ${creds.apiUrl}`, "info");
  if (reasoningEffort) {
    consoleLog(
      body,
      `   ${i18n.reasoningEffort}: ${formatReasoningEffort(reasoningEffort)}`,
      "info",
    );
  }

  // Check environment
  consoleLog(body, `🔍 ${i18n.trLogCheckingEnvironment}`, "info");
  const envCheck = await engine.checkTranslationEnvironment();
  if (!envCheck.ok && envCheck.reason === "not_ready") {
    consoleLog(
      body,
      `❌ ${i18n.trLogEnvironmentNotReady(envCheck.status)}`,
      "error",
    );
    for (const line of envCheck.diagnostics) {
      consoleLog(body, `   ${line}`, "info");
    }
    consoleLog(body, `   ${i18n.trLogInstallEnvironmentInstruction}`, "error");
    return;
  }
  if (!envCheck.ok) {
    consoleLog(
      body,
      `❌ ${getPanelLang().startsWith("zh") ? "翻译环境需要修复：" : "Translation environment needs repair: "}${envCheck.detail}`,
      "error",
    );
    const notice = body.querySelector(
      "#llm-tr-env-update-status",
    ) as HTMLElement | null;
    if (notice) {
      notice.textContent = getPanelLang().startsWith("zh")
        ? "翻译环境需要修复，点击“安装/更新翻译环境”。"
        : "Translation environment needs repair. Click Install/Update.";
    }
    return;
  }
  const envStatus = envCheck.env;
  consoleLog(
    body,
    `✅ ${i18n.trLogEnvironmentReady(envStatus.venvDir)}`,
    "success",
  );
  consoleLog(
    body,
    `   ${i18n.trLogPythonLabel}: ${envStatus.pythonBin}`,
    "info",
  );
  consoleLog(
    body,
    `   ${i18n.trLogPdf2zhLabel}: ${envStatus.pdf2zhBin}`,
    "info",
  );

  // Keep the previous (possibly paused) controls intact until preflight succeeds.
  const startBtn = body.querySelector(
    "#llm-tr-start",
  ) as HTMLButtonElement | null;
  const pauseBtn = body.querySelector(
    "#llm-tr-pause",
  ) as HTMLButtonElement | null;
  let lastStageLogged = "";

  const controller = await engine.createController((event) => {
    if (session.activeController !== controller || session.isPaused) return;
    switch (event.type) {
      case "progress": {
        const pct = event.data.progress;
        const msg = event.data.message || "";
        const status = event.data.status || "";
        const stage = event.data.stage || "";
        const detail = event.data.detail || "";
        updateProgress(session, body, pct, msg, {
          current: event.data.current,
          total: event.data.total,
        });

        const stageSummary = getStageSummaryLabel(stage, msg);
        if (
          stage &&
          stage !== lastStageLogged &&
          stageSummary &&
          event.data.current === undefined &&
          status === "running"
        ) {
          lastStageLogged = stage;
          consoleLog(body, `🔄 ${stageSummary}`, "info");
        }

        // Log page transitions (when page number is present)
        if (
          event.data.current !== undefined &&
          event.data.total !== undefined
        ) {
          lastStageLogged = "translating";
          const elapsed =
            session.translationStartTime > 0
              ? (Date.now() - session.translationStartTime) / 1000
              : 0;
          consoleLog(
            body,
            `📊 ${i18n.trLogPageProgress(
              event.data.current,
              event.data.total,
              pct,
              formatDuration(elapsed),
            )}`,
            "info",
          );
        }

        // Show engine output detail (raw line from pdf2zh_next stdout)
        if (detail && detail !== msg && shouldLogEngineDetail(detail)) {
          const cffFontWarning =
            /^MuPDF error: format error: Invalid offsize in CFF\b/i.test(
              detail.trim(),
            );
          // Detect log level from engine output (e.g. "ERROR:pdf2zh_next...")
          const detailLevel: "info" | "error" =
            !cffFontWarning && /\bERROR\b/i.test(detail) ? "error" : "info";
          const detailIcon = cffFontWarning
            ? "⚠"
            : detailLevel === "error"
              ? "❌"
              : "🔧";
          const displayedDetail = cffFontWarning
            ? getPanelLang().startsWith("zh")
              ? `PDF 内嵌 CFF 字体格式异常；引擎仍在处理，完成后请检查版面。（${detail}）`
              : `Embedded CFF font is malformed; processing continues. Check the output layout. (${detail})`
            : detail;
          consoleLog(body, `${detailIcon} ${displayedDetail}`, detailLevel);
        } else if (
          msg &&
          event.data.current === undefined &&
          stageSummary !== msg
        ) {
          // Non-page messages from bridge (init, detecting refs, etc.)
          consoleLog(body, `🔄 ${msg}`, "info");
        }

        // Log output files on completion
        if (status === "done")
          unsafeOutput ||= publicationBlocker(event.data)?.detail || "";
        if (status === "done" && event.data.outputFiles?.length) {
          manifest = event.data.outputFiles;
          for (const f of event.data.outputFiles) {
            consoleLog(body, `   📄 ${i18n.trLogOutputFile(f)}`, "success");
          }
        }
        if (status === "done") {
          const translationSummary = buildTranslationSummaryLine(
            event.data.translationStats,
          );
          if (translationSummary) {
            consoleLog(body, `📈 ${translationSummary}`, "info");
          }
          const warningSummary = buildWarningSummaryLine(
            event.data.warningStats,
            event.data.warningCount,
          );
          if (warningSummary) {
            consoleLog(body, `⚠ ${warningSummary}`, "info");
          }
        }
        // Warn if translation completed but engine logged errors
        if (status === "done" && event.data.hasErrors) {
          const errCount = event.data.errorCount || 0;
          const errLines: string[] = event.data.errorLines || [];
          consoleLog(
            body,
            `⚠️ ${i18n.trLogCompletedWithErrors(errCount)}`,
            "error",
          );
          for (const errLine of errLines.slice(0, 10)) {
            consoleLog(body, `   ${errLine}`, "error");
          }
          if (event.data.logFile) {
            consoleLog(
              body,
              `   📝 ${i18n.trLogFullLog(event.data.logFile)}`,
              "info",
            );
          }
        }

        // Log errors with full detail
        if (status === "error") {
          const errMsg =
            event.data.message || event.data.error || i18n.trLogUnknownError;
          consoleLog(body, `❌ ${i18n.trLogBridgeError(errMsg)}`, "error");
          if (event.data.errorDetail) {
            const lines = event.data.errorDetail.split("\n").slice(-10);
            for (const line of lines) {
              if (line.trim()) consoleLog(body, `   ${line.trim()}`, "error");
            }
          }
          if (event.data.logFile) {
            consoleLog(
              body,
              `   📝 ${i18n.trLogFullLog(event.data.logFile)}`,
              "info",
            );
          }
        }
        break;
      }
      case "state":
        if (event.state === "done") {
          updateProgress(session, body, 100, "", { force: true });
        } else if (event.state === "error") {
          consoleLog(
            body,
            `❌ ${i18n.trError} - ${i18n.trLogSeeDetailsAbove}`,
            "error",
          );
        } else if (event.state === "running") {
          if (pauseBtn) pauseBtn.disabled = false;
          lastStageLogged = "";
          consoleLog(body, `⏳ ${i18n.trLogEngineStarted}`, "info");
        } else if (event.state === "paused") {
          consoleLog(body, `⏸ ${i18n.trLogPausedCached}`, "info");
        } else if (event.state === "idle") {
          resetTranslationSessionUi(session, body);
        }
        break;
      case "error":
        consoleLog(body, `❌ ${i18n.trLogError(event.message)}`, "error");
        break;
      case "env_progress":
        consoleLog(body, `🔧 ${event.detail}`, "info");
        break;
    }
  });
  await IOUtils.makeDirectory(outputDir, {
    createAncestors: true,
    ignoreExisting: false,
    permissions: 0o700,
  });
  session.activeController = controller;
  session.activeRequest = request;
  session.isPaused = false;
  session.translationStartTime = Date.now();
  resetProgressTracking(session);
  updateProgress(session, body, 0, "", { force: true });
  _startProgressTimer(session, body);
  if (startBtn) startBtn.style.display = "none";
  if (pauseBtn) {
    pauseBtn.style.display = "";
    pauseBtn.disabled = true; // start() also awaits preflight before launching
    pauseBtn.textContent = `⏸ ${i18n.trPause}`;
    pauseBtn.className = "llm-tr-btn llm-tr-btn-warning";
  }
  if (resuming) consoleLog(body, `▶️ ${i18n.trLogResumed}`, "info");

  consoleLog(body, `⏳ ${i18n.trLogLaunchingEngine}`, "info");

  try {
    await controller.start(
      buildTranslateParams({
        pdfPath,
        outputDir,
        modelId: creds.modelId,
        options,
      }),
      creds,
    );
    if (!session.isPaused && controller.getState() === "done" && unsafeOutput) {
      consoleLog(
        body,
        `${i18n.trLogError(unsafeOutput)}\n${i18n.trLogOutputLabel}: ${outputDir}`,
        "error",
      );
      return; // Leave partial outputs for inspection; no filing or overwrite.
    }
    if (!session.isPaused && controller.getState() === "done")
      await fileTabResult(
        body,
        engine,
        plan,
        outputDir,
        manifest,
        (Date.now() - session.translationStartTime) / 1000,
      );
  } catch (err) {
    if (err instanceof Error && err.stack) {
      consoleLog(body, `${i18n.trLogStackTrace}:\n${err.stack}`, "error");
    }
    consoleLog(body, `❌ ${i18n.trLogError(String(err))}`, "error");
  } finally {
    _stopProgressTimer(session);
    // A refused launch or pause may have produced nothing. Nonrecursive
    // removal is intentional: partial engine output must remain recoverable.
    if (controller.getState() !== "done") {
      await IOUtils.remove(outputDir, { recursive: false }).catch(() => {});
    }
    if (!session.isPaused) {
      session.activeController = null;
      session.activeRequest = null;
      session.translationStartTime = 0;
      restoreTranslationControls(body);
    }
  }
}
