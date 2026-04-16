/* ---------------------------------------------------------------------------
 * pdfTranslator/translateTabController.ts
 *
 * Wires up the Translate tab UI:
 *   - Populates the model selector from the shared model list
 *   - Persists per-tab model selection in Zotero prefs
 *   - Handles env setup / path / start / pause / clear button events
 * -------------------------------------------------------------------------*/

import {
  getModelChoices,
} from "../contextPanel/setupHandlers/controllers/modelSelectionController";
import { getPanelI18n } from "../contextPanel/i18n";
import type { ProgressData, TranslationStats, WarningStats } from "./types";

/* ── Per-tab model pref key ── */

const TRANSLATE_MODEL_PREF = "lastUsedModelName.translate";
const TRANSLATE_PROVIDER_PREF = "lastUsedModelProvider.translate";
const TRANSLATE_PREFS = {
  skipRefsAuto: "translate.skipReferencesAuto",
  outputDir: "translate.outputDir",
} as const;

declare const Zotero: any;
declare const addon: any;

const LOW_SIGNAL_ENGINE_DETAIL_RE = /(?:INFO:pdf2zh_next|INFO:babeldoc|WARNING:babeldoc|il_translator_llm_only\.py:(?:774|783|797|824))/i;

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
  if (/(download|retry|overlay-translated|proxy|font subsetting|save with clean)/i.test(detail)) {
    return true;
  }
  return !LOW_SIGNAL_ENGINE_DETAIL_RE.test(detail);
}

function buildTranslationSummaryLine(stats?: TranslationStats): string {
  if (!stats || stats.total === undefined) return "";
  const parts = [`Paragraphs ${stats.total}`];
  if (stats.successful !== undefined) parts.push(`successful ${stats.successful}`);
  if (stats.fallback !== undefined) parts.push(`fallback ${stats.fallback}`);
  return parts.join(" | ");
}

function buildWarningSummaryLine(stats?: WarningStats, warningCount?: number): string {
  if (!stats || (!warningCount && Object.keys(stats).length === 0)) return "";
  const parts: string[] = [];
  if (stats.sameAsInput) parts.push(`same-as-input ${stats.sameAsInput}`);
  if (stats.lengthMismatch) parts.push(`length-mismatch ${stats.lengthMismatch}`);
  if (stats.editDistanceSmall) parts.push(`edit-distance ${stats.editDistanceSmall}`);
  if (stats.fallbackToSimple) parts.push(`fallback ${stats.fallbackToSimple}`);
  if (stats.other) parts.push(`other ${stats.other}`);
  const summary = parts.join(" | ");
  if (warningCount && summary) return `Warnings ${warningCount} | ${summary}`;
  if (warningCount) return `Warnings ${warningCount}`;
  return summary;
}

function prefKey(): string {
  return `${addon.data.config.prefsPrefix}.${TRANSLATE_MODEL_PREF}`;
}

function translatePrefKey(key: string): string {
  return `${addon.data.config.prefsPrefix}.${key}`;
}

function getBoolPref(key: string, defaultValue: boolean): boolean {
  try {
    const value = Zotero.Prefs.get(translatePrefKey(key), true);
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const v = value.trim().toLowerCase();
      if (v === "true" || v === "1") return true;
      if (v === "false" || v === "0") return false;
    }
  } catch {
    // ignore
  }
  return defaultValue;
}

function setBoolPref(key: string, value: boolean): void {
  try {
    Zotero.Prefs.set(translatePrefKey(key), value, true);
  } catch {
    // ignore
  }
}

function getStringPref(key: string, defaultValue = ""): string {
  try {
    const value = Zotero.Prefs.get(translatePrefKey(key), true);
    if (typeof value === "string") return value.trim();
  } catch {
    // ignore
  }
  return defaultValue;
}

function setStringPref(key: string, value: string): void {
  try {
    Zotero.Prefs.set(translatePrefKey(key), value.trim(), true);
  } catch {
    // ignore
  }
}

function getPersistedTranslateModel(): string {
  try {
    return String(Zotero.Prefs.get(prefKey(), true) || "").trim();
  } catch {
    return "";
  }
}

function getPersistedTranslateProvider(): string {
  try {
    return String(Zotero.Prefs.get(`${addon.data.config.prefsPrefix}.${TRANSLATE_PROVIDER_PREF}`, true) || "").trim();
  } catch {
    return "";
  }
}

function persistTranslateModel(name: string): void {
  try {
    Zotero.Prefs.set(prefKey(), name, true);
  } catch { /* ignore */ }
}

function persistTranslateProvider(providerId: string): void {
  try {
    Zotero.Prefs.set(`${addon.data.config.prefsPrefix}.${TRANSLATE_PROVIDER_PREF}`, providerId, true);
  } catch { /* ignore */ }
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

  const trigger = dropdownEl.querySelector(".llm-tr-dropdown-trigger") as HTMLElement | null;
  const menu = dropdownEl.querySelector(".llm-tr-dropdown-menu") as HTMLElement | null;
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
      (el as HTMLElement).classList.toggle("selected", elModel === model && elProvider === providerId);
    });
    // Close menu
    menu!.style.display = "none";
    dropdownEl.classList.remove("open");
    // Persist
    persistTranslateModel(model);
    persistTranslateProvider(providerId);
  };

  for (const entry of choices) {
    const provider = entry.provider || "";
    if (provider && provider !== lastProvider) {
      lastProvider = provider;
      const groupLabel = doc.createElementNS("http://www.w3.org/1999/xhtml", "div") as HTMLDivElement;
      groupLabel.className = "llm-tr-dropdown-group";
      groupLabel.textContent = provider;
      menu.appendChild(groupLabel);
    }

    const item = doc.createElementNS("http://www.w3.org/1999/xhtml", "div") as HTMLDivElement;
    item.className = "llm-tr-dropdown-item";
    item.dataset.value = entry.model;
    item.dataset.providerId = entry.providerId || "";
    item.textContent = entry.model;
    item.addEventListener("click", () => selectItem(entry.model, entry.providerId || ""));
    menu.appendChild(item);

    // Match by model + providerId for disambiguation
    if (
      (entry.model === prevValue || entry.model.toLowerCase() === prevValue.toLowerCase()) &&
      (!prevProvider || entry.providerId === prevProvider)
    ) {
      selectedModel = entry.model;
      selectedProviderId = entry.providerId || "";
    } else if (
      !selectedModel &&
      (entry.model === prevValue || entry.model.toLowerCase() === prevValue.toLowerCase())
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

/**
 * Get the currently selected translate model name.
 */
export function getTranslateModel(dropdownEl: HTMLElement): string {
  return dropdownEl.dataset.value || "";
}

/* ── Init: wire up event listeners ── */

/**
 * Initialize the translate tab controller.
 * Call this once after buildUI completes and the DOM is ready.
 *
 * @param body  the panel body element (contains #llm-main)
 */
export function initTranslateTab(body: Element): void {
  const modelSelect = body.querySelector("#llm-tr-model") as HTMLElement | null;
  if (!modelSelect) return;

  const skipRefsAutoEl = body.querySelector("#llm-tr-skip-refs-auto") as HTMLInputElement | null;
  const outputDirEl = body.querySelector("#llm-tr-output-dir") as HTMLInputElement | null;

  // Populate on init
  populateTranslateModelSelector(modelSelect);

  // Restore persisted translate options
  if (skipRefsAutoEl) skipRefsAutoEl.checked = getBoolPref(TRANSLATE_PREFS.skipRefsAuto, true);
  if (outputDirEl) outputDirEl.value = getStringPref(TRANSLATE_PREFS.outputDir, "");

  // Persist translate options on change
  skipRefsAutoEl?.addEventListener("change", () => setBoolPref(TRANSLATE_PREFS.skipRefsAuto, !!skipRefsAutoEl.checked));
  outputDirEl?.addEventListener("change", () => setStringPref(TRANSLATE_PREFS.outputDir, outputDirEl.value || ""));
  outputDirEl?.addEventListener("blur", () => setStringPref(TRANSLATE_PREFS.outputDir, outputDirEl.value || ""));

  // Model selection persistence is handled internally by the custom dropdown

  // Re-populate when tab becomes visible (models may have been added/removed)
  const tabBtn = body.querySelector("#llm-tab-btn-translate") as HTMLButtonElement | null;
  if (tabBtn) {
    tabBtn.addEventListener("click", () => {
      populateTranslateModelSelector(modelSelect);
      updatePdfSourceFromItem(body);
    });
  }

  // ── Language swap button ──
  const langSwapBtn = body.querySelector("#llm-tr-lang-swap") as HTMLButtonElement | null;
  if (langSwapBtn) {
    langSwapBtn.addEventListener("click", () => {
      const srcDD = body.querySelector("#llm-tr-source-lang") as HTMLElement | null;
      const tgtDD = body.querySelector("#llm-tr-target-lang") as HTMLElement | null;
      if (srcDD && tgtDD) {
        const srcVal = srcDD.dataset.value || "";
        const tgtVal = tgtDD.dataset.value || "";
        // Swap by clicking the matching items
        const srcItem = tgtDD.querySelector(`.llm-tr-dropdown-item[data-value="${srcVal}"]`) as HTMLElement | null;
        const tgtItem = srcDD.querySelector(`.llm-tr-dropdown-item[data-value="${tgtVal}"]`) as HTMLElement | null;
        if (srcItem) srcItem.click();
        if (tgtItem) tgtItem.click();
      }
    });
  }

  // ── File picker button ──
  const pickFileBtn = body.querySelector("#llm-tr-pick-file") as HTMLButtonElement | null;
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
        consoleLog(body, `❌ Error: ${err}`, "error");
      }
    });
  }

  // ── Browse output directory ──
  const browseDirBtn = body.querySelector("#llm-tr-browse-dir") as HTMLButtonElement | null;
  if (browseDirBtn) {
    browseDirBtn.addEventListener("click", async () => {
      try {
        const { pickDirectory } = await import("./nativePicker");
        const win = (body.ownerDocument as any)?.defaultView;
        if (!win) return;
        const path = await pickDirectory(win);
        if (path) {
          const dirInput = body.querySelector("#llm-tr-output-dir") as HTMLInputElement | null;
          if (dirInput) {
            dirInput.value = path;
            setStringPref(TRANSLATE_PREFS.outputDir, path);
          }
        }
      } catch (err) {
        consoleLog(body, `❌ Error: ${err}`, "error");
      }
    });
  }

  // ── Console clear button ──
  const consoleClearBtn = body.querySelector("#llm-tr-console-clear") as HTMLButtonElement | null;
  if (consoleClearBtn) {
    consoleClearBtn.addEventListener("click", () => {
      clearConsole(body);
    });
  }

  // ── Console copy button ──
  const consoleCopyBtn = body.querySelector("#llm-tr-console-copy") as HTMLButtonElement | null;
  if (consoleCopyBtn) {
    consoleCopyBtn.addEventListener("click", () => {
      copyConsole(body);
    });
  }

  // ── Install environment button ──
  const installBtn = body.querySelector("#llm-tr-install-env") as HTMLButtonElement | null;
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      installBtn.disabled = true;
      consoleLog(body, "Starting environment setup...", "info");
      try {
        const { installEnvironment } = await import("./envManager");
        await installEnvironment((step, detail) => {
          consoleLog(body, detail, detail.startsWith("✅") ? "success" : "info");
        });
        consoleLog(body, "✅ Environment setup complete!", "success");
      } catch (err) {
        consoleLog(body, `❌ Error: ${err}`, "error");
        // Try to read the stderr log for more details
        try {
          const tempDir = String(PathUtils.tempDir || "").trim();
          const logPath = tempDir ? PathUtils.join(tempDir, "aidea-cmd.log") : "";
          if (logPath && await IOUtils.exists(logPath)) {
            const logText = await IOUtils.readUTF8(logPath);
            if (logText.trim()) {
              consoleLog(body, `📝 Details: ${logText.trim()}`, "error");
            }
          }
        } catch { /* ignore log read failure */ }
      } finally {
        installBtn.disabled = false;
      }
    });
  }

  // ── Start translation button ──
  const startBtn = body.querySelector("#llm-tr-start") as HTMLButtonElement | null;
  const pauseBtn = body.querySelector("#llm-tr-pause") as HTMLButtonElement | null;
  const clearBtn = body.querySelector("#llm-tr-clear") as HTMLButtonElement | null;
  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true;
      try {
        await startTranslation(body);
      } catch (err) {
        consoleLog(body, `❌ ${err}`, "error");
      } finally {
        startBtn.disabled = false;
      }
    });
  }

  // ── Pause / Resume button ──
  if (pauseBtn) {
    pauseBtn.addEventListener("click", async () => {
      if (!_activeController) return;
      try {
        if (_isPaused) {
          // Resume — re-start translation to continue from cache
          _isPaused = false;
          const i18n = getPanelI18n();
          pauseBtn.textContent = `⏸ ${i18n.trPause}`;
          pauseBtn.className = "llm-tr-btn llm-tr-btn-warning";
          consoleLog(body, "▶️ " + i18n.trResume + "d", "info");
        } else {
          // Pause
          _activeController.pause();
          _isPaused = true;
          const i18n = getPanelI18n();
          pauseBtn.textContent = `▶ ${i18n.trResume}`;
          pauseBtn.className = "llm-tr-btn llm-tr-btn-primary";
          consoleLog(body, "⏸ " + i18n.trPause + "d", "info");
        }
      } catch (err) {
        consoleLog(body, `❌ Pause error: ${err}`, "error");
      }
    });
  }

  // ── Clear cache button ──
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      // Block clearing while translation is actively running
      if (_activeController && !_isPaused) {
        consoleLog(body, "⚠️ Cannot clear cache while translation is running. Pause or wait for it to finish.", "error");
        return;
      }
      try {
        // Stop active controller if paused
        if (_activeController) {
          try { _activeController.abort?.(); } catch { /* ignore */ }
        }
        // Only clear temp cache files (progress, config, task, log)
        // Do NOT delete the output directory or generated PDFs
        const tempDir = String(PathUtils.tempDir || "").trim();
        if (tempDir) {
          const cacheDir = PathUtils.join(tempDir, "aidea-translate");
          const cacheFiles = ["progress.json", "progress.json.tmp", "config.toml", "task.json", "bridge.log", "aidea_bridge.py"];
          for (const file of cacheFiles) {
            try {
              const filePath = PathUtils.join(cacheDir, file);
              await IOUtils.remove(filePath);
            } catch { /* file may not exist */ }
          }
        }
        // Reset UI state
        _isPaused = false;
        _activeController = null;
        const i18n = getPanelI18n();
        consoleLog(body, `🗑 ${i18n.trClearCache}: done`, "info");
        resetProgressTracking();
        updateProgress(body, 0, "", { force: true });
        _stopProgressTimer();
        _translationStartTime = 0;
        // Restore start button
        const startBtn = body.querySelector("#llm-tr-start") as HTMLButtonElement | null;
        const pauseBtn = body.querySelector("#llm-tr-pause") as HTMLButtonElement | null;
        if (startBtn) startBtn.style.display = "";
        if (pauseBtn) pauseBtn.style.display = "none";
      } catch (err) {
        consoleLog(body, `❌ Clear error: ${err}`, "error");
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

/** Store the currently selected PDF path as a data attribute */
let _selectedPdfPath = "";

/** Track translation start time for elapsed/remaining calculations */
let _translationStartTime = 0;

/** Track pause state */
let _isPaused = false;

/** Active controller instance for pause/resume/clear */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _activeController: any = null;

/** Independent progress bar refresh timer (1s) */
let _progressTimer: ReturnType<typeof setInterval> | null = null;
/** Last known progress percentage for timer-based refresh */
let _targetProgressPct = 0;
let _displayProgressPct = 0;
/** Reference to body element for timer-based updates */
let _translationBody: Element | null = null;
/** Heartbeat counter — log every 15s when idle */
let _heartbeatCounter = 0;

let _lastKnownCurrentPage: number | null = null;
let _lastKnownTotalPages: number | null = null;
let _recentPageDurationsSec: number[] = [];
let _lastPageBoundaryAt = 0;
let _lastPageBoundaryPage: number | null = null;

const PROGRESS_TIMER_INTERVAL_MS = 250;
const PROGRESS_SMOOTHING_FACTOR = 0.18;
const PROGRESS_MIN_STEP = 0.25;
const PAGE_DURATION_HISTORY_LIMIT = 8;

function setSelectedPdfPath(body: Element, pdfPath: string): void {
  _selectedPdfPath = pdfPath;
  const nameEl = body.querySelector("#llm-tr-pdf-name") as HTMLElement | null;
  if (nameEl) {
    // Show just the filename
    const basename = pdfPath.split(/[\\/]/).pop() || pdfPath;
    nameEl.textContent = basename;
    nameEl.title = pdfPath;
  }
}

function resetProgressTracking(): void {
  _targetProgressPct = 0;
  _displayProgressPct = 0;
  _lastKnownCurrentPage = null;
  _lastKnownTotalPages = null;
  _recentPageDurationsSec = [];
  _lastPageBoundaryAt = 0;
  _lastPageBoundaryPage = null;
}

function recordPageProgress(current?: number, total?: number): void {
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

  _lastKnownCurrentPage = current;
  _lastKnownTotalPages = total;

  const now = Date.now();
  if (
    _lastPageBoundaryPage !== null &&
    current > _lastPageBoundaryPage &&
    _lastPageBoundaryAt > 0
  ) {
    const deltaPages = current - _lastPageBoundaryPage;
    const deltaSec = (now - _lastPageBoundaryAt) / 1000;
    if (deltaPages > 0 && deltaSec > 0) {
      _recentPageDurationsSec.push(deltaSec / deltaPages);
      if (_recentPageDurationsSec.length > PAGE_DURATION_HISTORY_LIMIT) {
        _recentPageDurationsSec = _recentPageDurationsSec.slice(-PAGE_DURATION_HISTORY_LIMIT);
      }
    }
  }

  if (_lastPageBoundaryPage === null || current !== _lastPageBoundaryPage) {
    _lastPageBoundaryPage = current;
    _lastPageBoundaryAt = now;
  }
}

function updateProgress(
  body: Element,
  pct: number,
  _text: string,
  opts?: { current?: number; total?: number; force?: boolean },
): void {
  const safePct = Math.max(0, Math.min(100, pct));
  if (opts?.force) {
    _targetProgressPct = safePct;
    _displayProgressPct = safePct;
  } else {
    _targetProgressPct = Math.max(_targetProgressPct, safePct);
  }
  recordPageProgress(opts?.current, opts?.total);
  _refreshProgressBar(body);
}

function estimateRemainingSeconds(elapsedSeconds: number): number | null {
  if (_displayProgressPct >= 100) return 0;

  if (
    _lastKnownCurrentPage !== null &&
    _lastKnownTotalPages !== null &&
    _recentPageDurationsSec.length > 0
  ) {
    const remainingPages = Math.max(0, _lastKnownTotalPages - _lastKnownCurrentPage);
    const avgPerPage =
      _recentPageDurationsSec.reduce((sum, value) => sum + value, 0) /
      _recentPageDurationsSec.length;
    return remainingPages * avgPerPage;
  }

  if (_displayProgressPct > 0 && elapsedSeconds > 0) {
    const totalEstimated = elapsedSeconds / (_displayProgressPct / 100);
    return Math.max(0, totalEstimated - elapsedSeconds);
  }

  return null;
}

function advanceDisplayedProgress(): void {
  if (_displayProgressPct >= _targetProgressPct) return;
  const delta = _targetProgressPct - _displayProgressPct;
  const step = _targetProgressPct >= 100
    ? delta
    : Math.max(PROGRESS_MIN_STEP, delta * PROGRESS_SMOOTHING_FACTOR);
  _displayProgressPct = Math.min(_targetProgressPct, _displayProgressPct + step);
}

/** Refresh progress bar time display (called by both poller and timer) */
function _refreshProgressBar(body: Element): void {
  const fill = body.querySelector("#llm-tr-progress-fill") as HTMLElement | null;
  if (fill) {
    const pct = Math.max(0, Math.min(100, _displayProgressPct));
    fill.style.width = `${pct}%`;
    const i18n = getPanelI18n();
    const elapsed = _translationStartTime > 0 ? (Date.now() - _translationStartTime) / 1000 : 0;
    const elapsedStr = formatDuration(elapsed);
    let remainStr = "--:--";
    const remaining = estimateRemainingSeconds(elapsed);
    if (remaining !== null && pct < 100) {
      remainStr = formatDuration(remaining);
    } else if (pct >= 100) {
      remainStr = "00:00";
    }
    const isZh = i18n.tabTranslate === "翻译";
    const elapsedLabel = isZh ? "已用" : "Elapsed";
    const remainLabel = isZh ? "剩余" : "Remaining";
    const pageText = (
      _lastKnownCurrentPage !== null &&
      _lastKnownTotalPages !== null &&
      _lastKnownTotalPages > 0
    )
      ? ` | Page ${_lastKnownCurrentPage}/${_lastKnownTotalPages}`
      : "";
    fill.textContent = pct > 0
      ? `${Math.round(pct)}%${pageText} | ${elapsedLabel}: ${elapsedStr} | ${remainLabel}: ${remainStr}`
      : "";
  }
}

/** Start the independent 1s progress bar timer */
function _startProgressTimer(body: Element): void {
  _stopProgressTimer();
  _translationBody = body;
  _heartbeatCounter = 0;
  _progressTimer = setInterval(() => {
    if (_translationBody && _translationStartTime > 0) {
      advanceDisplayedProgress();
      _refreshProgressBar(_translationBody);
    }
  }, PROGRESS_TIMER_INTERVAL_MS);
}

/** Stop the progress bar timer */
function _stopProgressTimer(): void {
  if (_progressTimer) {
    clearInterval(_progressTimer);
    _progressTimer = null;
  }
  _translationBody = null;
  _heartbeatCounter = 0;
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
): void {
  const consoleBody = body.querySelector("#llm-tr-console-body") as HTMLElement | null;
  if (!consoleBody) return;
  const doc = body.ownerDocument;
  if (!doc) return;

  // Auto-expand console if it is collapsed
  const consoleToggle = body.querySelector("#llm-tr-console-toggle") as HTMLElement | null;
  const consoleEl = body.querySelector("#llm-tr-console") as HTMLElement | null;
  if (consoleToggle && consoleToggle.dataset.collapsed === "true" && consoleEl) {
    consoleToggle.dataset.collapsed = "false";
    consoleEl.style.display = "";
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
}

/** Clear all console log lines. */
function clearConsole(body: Element): void {
  const consoleBody = body.querySelector("#llm-tr-console-body") as HTMLElement | null;
  if (consoleBody) consoleBody.textContent = "";
}

/** Copy all console text to clipboard. */
function copyConsole(body: Element): void {
  const consoleBody = body.querySelector("#llm-tr-console-body") as HTMLElement | null;
  if (!consoleBody) return;
  const lines = consoleBody.querySelectorAll(".llm-tr-console-line");
  const text = (Array.from(lines) as Element[])
    .map((line) => {
      const time = line.querySelector(".llm-tr-console-time")?.textContent || "";
      const msg = line.querySelector(".llm-tr-console-msg")?.textContent || "";
      return `${time}  ${msg}`;
    })
    .join("\n");
  // Use Zotero's built-in clipboard helper
  try {
    const clipboardHelper = (Components.classes as any)["@mozilla.org/widget/clipboardhelper;1"]
      ?.getService((Components.interfaces as any).nsIClipboardHelper);
    if (clipboardHelper) {
      clipboardHelper.copyString(text);
    }
  } catch {
    // Fallback: modern clipboard API
    try {
      (body.ownerDocument as any)?.defaultView?.navigator?.clipboard?.writeText(text);
    } catch { /* ignore */ }
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
 * Main translation flow.
 */
async function startTranslation(body: Element): Promise<void> {
  const i18n = getPanelI18n();
  // Gather parameters
  const modelSelect = body.querySelector("#llm-tr-model") as HTMLElement | null;
  const modelName = modelSelect?.dataset.value || "";
  const modelProviderId = modelSelect?.dataset.providerId || "";
  if (!modelName) {
    consoleLog(body, "⚠️ No model selected — go to Settings tab to configure LLM models", "error");
    return;
  }
  if (!_selectedPdfPath) {
    consoleLog(body, "⚠️ No PDF file selected — click 'Select local PDF' or open a PDF in Zotero", "error");
    return;
  }

  const srcLang = (body.querySelector("#llm-tr-source-lang") as HTMLElement)?.dataset.value || "en";
  const tgtLang = (body.querySelector("#llm-tr-target-lang") as HTMLElement)?.dataset.value || "zh-CN";
  const monoChecked = (body.querySelector("#llm-tr-mono") as HTMLInputElement)?.checked ?? true;
  const dualChecked = (body.querySelector("#llm-tr-dual") as HTMLInputElement)?.checked ?? true;
  const outputDirInput = ((body.querySelector("#llm-tr-output-dir") as HTMLInputElement)?.value || "").trim();
  const skipReferencesAuto = (body.querySelector("#llm-tr-skip-refs-auto") as HTMLInputElement)?.checked ?? true;
  // ── Performance inputs ──
  const qps = parseInt(body.querySelector("#llm-tr-qps")?.textContent || "10", 10) || 10;
  const poolMaxWorker = parseInt(body.querySelector("#llm-tr-pool-max-worker")?.textContent || "1", 10) || 1;

  // ── Advanced settings (read from collapsible panel) ──
  const keepAppendixTranslated = (body.querySelector("#llm-tr-keep-appendix") as HTMLInputElement)?.checked ?? true;
  const protectAuthorBlock = (body.querySelector("#llm-tr-protect-author") as HTMLInputElement)?.checked ?? true;
  const disableRichTextTranslate = (body.querySelector("#llm-tr-disable-rich-text") as HTMLInputElement)?.checked ?? false;
  const enhanceCompatibility = (body.querySelector("#llm-tr-enhance-compat") as HTMLInputElement)?.checked ?? false;
  const translateTableText = (body.querySelector("#llm-tr-translate-table") as HTMLInputElement)?.checked ?? false;
  const ocr = (body.querySelector("#llm-tr-ocr") as HTMLInputElement)?.checked ?? false;
  const autoOcr = (body.querySelector("#llm-tr-auto-ocr") as HTMLInputElement)?.checked ?? true;
  const saveGlossary = (body.querySelector("#llm-tr-save-glossary") as HTMLInputElement)?.checked ?? true;
  const disableGlossary = (body.querySelector("#llm-tr-disable-glossary") as HTMLInputElement)?.checked ?? false;
  const fontFamily = ((body.querySelector("#llm-tr-font-family") as HTMLElement)?.dataset.value || "auto") as "auto" | "serif" | "sans-serif" | "script";

  if (!outputDirInput) {
    consoleLog(body, "⚠️ Save path is required. Click 'Browse' and select an output folder.", "error");
    return;
  }
  setStringPref(TRANSLATE_PREFS.outputDir, outputDirInput);
  const outputDir = outputDirInput;

  // Detailed console logging
  const pdfBasename = _selectedPdfPath.split(/[\\/]/).pop() || _selectedPdfPath;
  consoleLog(body, `─── Translation Job Started ───`, "info");
  consoleLog(body, `📄 PDF: ${pdfBasename}`, "info");
  consoleLog(body, `   Full path: ${_selectedPdfPath}`, "info");
  consoleLog(body, `🤖 Model: ${modelName}`, "info");
  consoleLog(body, `🌐 Language: ${srcLang} → ${tgtLang}`, "info");
  consoleLog(body, `📁 Output: ${outputDir}`, "info");
  consoleLog(body, `📝 Output format: Mono=${monoChecked} | Dual=${dualChecked}`, "info");
  consoleLog(body, `⚙️ Skip references: ${skipReferencesAuto} | Compatibility: ${enhanceCompatibility}`, "info");

  // Resolve model credentials
  consoleLog(body, `🔑 Resolving model credentials...`, "info");
  const { resolveModelCredentialsOrThrow } = await import("./modelResolver");
  let creds;
  try {
    creds = await resolveModelCredentialsOrThrow(modelName, modelProviderId || undefined);
  } catch (err) {
    consoleLog(body, `❌ Failed to resolve credentials: ${err}`, "error");
    return;
  }
  const authMode = creds.oauthProxy
    ? creds.oauthProxy.provider === "openai-compatible"
      ? "API Key (proxied)"
      : `OAuth (${creds.oauthProxy.provider})`
    : "API Key";
  consoleLog(body, `🔑 Auth: ${authMode}`, "success");
  consoleLog(body, `   Model ID: ${creds.modelId}`, "info");
  consoleLog(body, `   API Base: ${creds.apiUrl}`, "info");

  // Check environment
  consoleLog(body, `🔍 Checking translation environment...`, "info");
  const { checkEnvironment } = await import("./envManager");
  const envStatus = await checkEnvironment();
  if (envStatus.status !== "ready") {
    consoleLog(body, `❌ Environment not ready (status: ${envStatus.status})`, "error");
    consoleLog(body, `   Please click '⚙ Install Environment' button to set up the Python environment`, "error");
    return;
  }
  consoleLog(body, `✅ Environment ready (${envStatus.venvDir})`, "success");
  consoleLog(body, `   Python: ${envStatus.pythonBin}`, "info");
  consoleLog(body, `   pdf2zh: ${envStatus.pdf2zhBin}`, "info");

  // Reset timer and pause state
  _translationStartTime = Date.now();
  _isPaused = false;
  resetProgressTracking();
  updateProgress(body, 0, "", { force: true });
  _startProgressTimer(body);

  // Show pause button, hide start button
  const startBtn = body.querySelector("#llm-tr-start") as HTMLButtonElement | null;
  const pauseBtn = body.querySelector("#llm-tr-pause") as HTMLButtonElement | null;
  if (startBtn) startBtn.style.display = "none";
  if (pauseBtn) {
    pauseBtn.style.display = "";
    pauseBtn.textContent = `⏸ ${i18n.trPause}`;
    pauseBtn.className = "llm-tr-btn llm-tr-btn-warning";
  }

  // Use TranslateController to run the translation
  const { TranslateController } = await import("./index");
  let lastStageLogged = "";

  const controller = new TranslateController((event) => {
    switch (event.type) {
      case "progress": {
        const pct = event.data.progress;
        const msg = event.data.message || "";
        const status = event.data.status || "";
        const stage = event.data.stage || "";
        const detail = event.data.detail || "";
        updateProgress(body, pct, msg, {
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
        if (event.data.current !== undefined && event.data.total !== undefined) {
          lastStageLogged = "translating";
          const elapsed = _translationStartTime > 0 ? (Date.now() - _translationStartTime) / 1000 : 0;
          consoleLog(
            body,
            `📊 Page ${event.data.current}/${event.data.total} (${pct}%) [${formatDuration(elapsed)}]`,
            "info",
          );
        }

        // Show engine output detail (raw line from pdf2zh_next stdout)
        if (detail && detail !== msg && shouldLogEngineDetail(detail)) {
          // Detect log level from engine output (e.g. "ERROR:pdf2zh_next...")
          const detailLevel: "info" | "error" =
            /\bERROR\b/i.test(detail) ? "error" : "info";
          const detailIcon = detailLevel === "error" ? "❌" : "🔧";
          consoleLog(body, `${detailIcon} ${detail}`, detailLevel);
        } else if (msg && event.data.current === undefined && stageSummary !== msg) {
          // Non-page messages from bridge (init, detecting refs, etc.)
          consoleLog(body, `🔄 ${msg}`, "info");
        }

        // Log output files on completion
        if (status === "done" && event.data.outputFiles?.length) {
          for (const f of event.data.outputFiles) {
            consoleLog(body, `   📄 Output: ${f}`, "success");
          }
        }
        if (status === "done") {
          const translationSummary = buildTranslationSummaryLine(event.data.translationStats);
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
          consoleLog(body, `⚠️ Translation completed with ${errCount} error(s) — some pages may contain untranslated text`, "error");
          for (const errLine of errLines.slice(0, 10)) {
            consoleLog(body, `   ${errLine}`, "error");
          }
          if (event.data.logFile) {
            consoleLog(body, `   📝 Full log: ${event.data.logFile}`, "info");
          }
        }

        // Log errors with full detail
        if (status === "error") {
          const errMsg = event.data.error || event.data.message || "Unknown error";
          consoleLog(body, `❌ Bridge error: ${errMsg}`, "error");
          if (event.data.errorDetail) {
            const lines = event.data.errorDetail.split("\n").slice(-10);
            for (const line of lines) {
              if (line.trim()) consoleLog(body, `   ${line.trim()}`, "error");
            }
          }
          if (event.data.logFile) {
            consoleLog(body, `   📝 Full log: ${event.data.logFile}`, "info");
          }
        }
        break;
      }
      case "state":
        if (event.state === "done") {
          const totalElapsed = _translationStartTime > 0 ? (Date.now() - _translationStartTime) / 1000 : 0;
          updateProgress(body, 100, "", { force: true });
          consoleLog(body, `✅ ${i18n.trDone}! Total time: ${formatDuration(totalElapsed)}`, "success");
          consoleLog(body, `─── Job Finished ───`, "success");
          _translationStartTime = 0;
          _activeController = null;
          _isPaused = false;
          _stopProgressTimer();
          // Restore buttons
          if (startBtn) startBtn.style.display = "";
          if (pauseBtn) pauseBtn.style.display = "none";
        } else if (event.state === "error") {
          consoleLog(body, `❌ ${i18n.trError} — see details above`, "error");
          _translationStartTime = 0;
          _activeController = null;
          _isPaused = false;
          _stopProgressTimer();
          if (startBtn) startBtn.style.display = "";
          if (pauseBtn) pauseBtn.style.display = "none";
        } else if (event.state === "running") {
          lastStageLogged = "";
          consoleLog(body, "⏳ Translation engine started...", "info");
        } else if (event.state === "paused") {
          consoleLog(body, "⏸ Translation paused — progress cached", "info");
        }
        break;
      case "error":
        consoleLog(body, `❌ Error: ${event.message}`, "error");
        break;
      case "env_progress":
        consoleLog(body, `🔧 ${event.detail}`, "info");
        break;
    }
  });
  _activeController = controller;

  consoleLog(body, "⏳ Launching translation engine...", "info");

  try {
    await controller.start(
      {
        pdfPath: _selectedPdfPath,
        outputDir,
        sourceLang: srcLang,
        targetLang: tgtLang,
        modelId: creds.modelId,
        generateMono: monoChecked,
        generateDual: dualChecked,
        qps,
        poolMaxWorker,
        disableRichTextTranslate,
        enhanceCompatibility,
        translateTableText,
        fontFamily,
        ocr,
        autoOcr,
        saveGlossary,
        disableGlossary,
        noWatermark: true,
        dualMode: "LR",
        transFirst: false,            // LR mode: original left, translation right
        skipClean: false,
        skipReferencesAuto,
        keepAppendixTranslated,
        protectAuthorBlock,
      },
      creds,
    );
  } catch (err) {
    if (err instanceof Error && err.stack) {
      consoleLog(body, `Stack trace:\n${err.stack}`, "error");
    }
    consoleLog(body, `❌ ${i18n.trError}: ${err}`, "error");
    _translationStartTime = 0;
    _stopProgressTimer();
    // Restore buttons
    if (startBtn) startBtn.style.display = "";
    if (pauseBtn) pauseBtn.style.display = "none";
  }
}
