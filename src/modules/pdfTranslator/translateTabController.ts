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

/* ── Per-tab model pref key ── */

const TRANSLATE_MODEL_PREF = "lastUsedModelName.translate";
const TRANSLATE_PREFS = {
  skipRefsAuto: "translate.skipReferencesAuto",
  outputDir: "translate.outputDir",
} as const;

declare const Zotero: any;
declare const addon: any;

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

function persistTranslateModel(name: string): void {
  try {
    Zotero.Prefs.set(prefKey(), name, true);
  } catch { /* ignore */ }
}

/* ── Model selector population ── */

/**
 * Populate the translate tab's <select> with the same models
 * available in the chat tab.
 *
 * @param selectEl  the #llm-tr-model <select> element
 * @returns         the currently selected model name
 */
export function populateTranslateModelSelector(
  selectEl: HTMLSelectElement,
): string {
  const { choices } = getModelChoices();
  const persisted = getPersistedTranslateModel();

  // Remember current value before clearing
  const prevValue = selectEl.value || persisted;

  // Clear existing options
  selectEl.innerHTML = "";

  if (!choices.length) {
    const opt = selectEl.ownerDocument!.createElement("option");
    opt.value = "";
    opt.textContent = "—";
    selectEl.appendChild(opt);
    return "";
  }

  // Group by provider
  let lastProvider = "";
  let selectedModel = "";

  for (const entry of choices) {
    // Provider header (as optgroup)
    const provider = entry.provider || "";
    if (provider && provider !== lastProvider) {
      lastProvider = provider;
      // We use optgroup for visual grouping
      const group = selectEl.ownerDocument!.createElement("optgroup");
      group.label = provider;
      selectEl.appendChild(group);
    }

    const opt = selectEl.ownerDocument!.createElement("option");
    opt.value = entry.model;
    opt.textContent = entry.model;
    // Append to current optgroup if exists, else to select directly
    const lastGroup = selectEl.querySelector("optgroup:last-of-type");
    if (lastGroup && (entry.provider || "") === lastProvider) {
      lastGroup.appendChild(opt);
    } else {
      selectEl.appendChild(opt);
    }

    // Select the previously persisted model
    if (entry.model === prevValue || entry.model.toLowerCase() === prevValue.toLowerCase()) {
      selectedModel = entry.model;
    }
  }

  // Apply selection
  if (selectedModel) {
    selectEl.value = selectedModel;
  } else {
    // Default to first option
    selectedModel = choices[0]?.model || "";
    selectEl.value = selectedModel;
  }

  return selectedModel;
}

/**
 * Get the currently selected translate model name.
 */
export function getTranslateModel(selectEl: HTMLSelectElement): string {
  return selectEl.value || "";
}

/* ── Init: wire up event listeners ── */

/**
 * Initialize the translate tab controller.
 * Call this once after buildUI completes and the DOM is ready.
 *
 * @param body  the panel body element (contains #llm-main)
 */
export function initTranslateTab(body: Element): void {
  const modelSelect = body.querySelector("#llm-tr-model") as HTMLSelectElement | null;
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

  // Persist selection changes
  modelSelect.addEventListener("change", () => {
    const model = modelSelect.value;
    if (model) persistTranslateModel(model);
  });

  // Re-populate when tab becomes visible (models may have been added/removed)
  const tabBtn = body.querySelector("#llm-tab-btn-translate") as HTMLButtonElement | null;
  if (tabBtn) {
    tabBtn.addEventListener("click", () => {
      populateTranslateModelSelector(modelSelect);
      updatePdfSourceFromItem(body);
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
        updateStatus(body, `Error: ${err}`);
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
        updateStatus(body, `Error: ${err}`);
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
          updateStatus(body, detail);
          consoleLog(body, detail, detail.startsWith("✅") ? "success" : "info");
        });
        updateStatus(body, "✅ Environment ready");
        consoleLog(body, "✅ Environment setup complete!", "success");
      } catch (err) {
        updateStatus(body, `❌ ${err}`);
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
  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true;
      try {
        await startTranslation(body);
      } catch (err) {
        updateStatus(body, `❌ ${err}`);
        consoleLog(body, `❌ ${err}`, "error");
      } finally {
        startBtn.disabled = false;
      }
    });
  }
}

/**
 * Refresh the translate model selector (e.g., after OAuth model list update).
 */
export function refreshTranslateModels(body: Element): void {
  const modelSelect = body.querySelector("#llm-tr-model") as HTMLSelectElement | null;
  if (modelSelect) populateTranslateModelSelector(modelSelect);
}

/* ── Internal helpers ── */

/** Store the currently selected PDF path as a data attribute */
let _selectedPdfPath = "";

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

function updateStatus(body: Element, msg: string): void {
  const el = body.querySelector("#llm-tr-status") as HTMLElement | null;
  if (el) el.textContent = msg;
}

function updateProgress(body: Element, pct: number, text: string): void {
  const fill = body.querySelector("#llm-tr-progress-fill") as HTMLElement | null;
  const textEl = body.querySelector("#llm-tr-progress-text") as HTMLElement | null;
  const section = body.querySelector("#llm-tr-progress-section") as HTMLElement | null;
  if (section) section.style.display = "";
  if (fill) fill.style.width = `${pct}%`;
  if (textEl) textEl.textContent = text;
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
  // Gather parameters
  const modelSelect = body.querySelector("#llm-tr-model") as HTMLSelectElement | null;
  const modelName = modelSelect?.value || "";
  if (!modelName) {
    updateStatus(body, "Please select a model");
    consoleLog(body, "⚠️ No model selected", "error");
    return;
  }
  if (!_selectedPdfPath) {
    updateStatus(body, "Please select a PDF file");
    consoleLog(body, "⚠️ No PDF file selected", "error");
    return;
  }

  const srcLang = (body.querySelector("#llm-tr-source-lang") as HTMLSelectElement)?.value || "en";
  const tgtLang = (body.querySelector("#llm-tr-target-lang") as HTMLSelectElement)?.value || "zh-CN";
  const monoChecked = (body.querySelector("#llm-tr-mono") as HTMLInputElement)?.checked ?? true;
  const dualChecked = (body.querySelector("#llm-tr-dual") as HTMLInputElement)?.checked ?? true;
  const outputDirInput = ((body.querySelector("#llm-tr-output-dir") as HTMLInputElement)?.value || "").trim();
  const skipReferencesAuto = (body.querySelector("#llm-tr-skip-refs-auto") as HTMLInputElement)?.checked ?? true;
  // Fixed policy defaults (no UI toggles)
  const keepAppendixTranslated = true;
  const protectAuthorBlock = true;
  const disableRichTextTranslate = false;
  const enhanceCompatibility = true;
  const translateTableText = true;
  const ocr = false;
  const autoOcr = false;
  const saveGlossary = true;
  const disableGlossary = false;
  const fontFamily = "serif" as const;

  if (!outputDirInput) {
    updateStatus(body, "Please choose a save folder before starting translation");
    consoleLog(body, "⚠️ Save path is required. Click 'Browse' and select an output folder.", "error");
    return;
  }
  setStringPref(TRANSLATE_PREFS.outputDir, outputDirInput);
  const outputDir = outputDirInput;

  consoleLog(body, `PDF: ${_selectedPdfPath}`, "info");
  consoleLog(body, `Model: ${modelName}`, "info");
  consoleLog(body, `${srcLang} → ${tgtLang}  |  Output: ${outputDir}`, "info");

  consoleLog(
    body,
    `Policy: skipRefs=${skipReferencesAuto} keepAppendix=${keepAppendixTranslated} protectAuthor=${protectAuthorBlock}`,
    "info",
  );
  consoleLog(
    body,
    `Layout: richText=${!disableRichTextTranslate} compat=${enhanceCompatibility} table=${translateTableText} font=${fontFamily}`,
    "info",
  );
  consoleLog(body, `Glossary: save=${saveGlossary}`, "info");

  // Resolve model credentials
  const { resolveModelCredentialsOrThrow } = await import("./modelResolver");
  const creds = await resolveModelCredentialsOrThrow(modelName);
  const authMode = creds.oauthProxy ? `oauth:${creds.oauthProxy.provider}` : "api-key";
  consoleLog(
    body,
    `Auth: ${authMode} | modelId=${creds.modelId} | base=${creds.apiUrl}`,
    "info",
  );

  // Check environment
  consoleLog(body, "Checking translation environment...", "info");
  const { checkEnvironment } = await import("./envManager");
  const envStatus = await checkEnvironment();
  if (envStatus.status !== "ready") {
    updateStatus(body, "❌ Translation environment not ready. Click 'Install Environment' first.");
    consoleLog(body, `❌ Environment not ready (status: ${envStatus.status})`, "error");
    return;
  }
  consoleLog(body, "✅ Environment ready", "success");

  // Use TranslateController to run the translation
  const { TranslateController } = await import("./index");

  const controller = new TranslateController((event) => {
    switch (event.type) {
      case "progress": {
        const pct = event.data.progress;
        const msg = event.data.message || "";
        updateProgress(body, pct, msg);
        updateStatus(body, msg || "Translating...");
        // Log progress milestones (every 10%) and page updates
        if (event.data.current !== undefined && event.data.total !== undefined) {
          consoleLog(body, `Page ${event.data.current}/${event.data.total} (${pct}%) — ${msg}`, "info");
        }
        break;
      }
      case "state":
        if (event.state === "done") {
          updateStatus(body, "✅ Translation complete!");
          updateProgress(body, 100, "Done");
          consoleLog(body, "✅ Translation complete!", "success");
        } else if (event.state === "error") {
          updateStatus(body, "❌ Translation failed");
          consoleLog(body, "❌ Translation failed", "error");
        } else if (event.state === "running") {
          consoleLog(body, "⏳ Translation running...", "info");
        }
        break;
      case "error":
        updateStatus(body, `❌ ${event.message}`);
        consoleLog(body, `❌ ${event.message}`, "error");
        break;
      case "env_progress":
        updateStatus(body, event.detail);
        consoleLog(body, event.detail, "info");
        break;
    }
  });

  updateStatus(body, "⏳ Starting translation...");
  updateProgress(body, 0, "Initializing...");
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
        transFirst: false,
        skipClean: false,
        skipReferencesAuto,
        keepAppendixTranslated,
        protectAuthorBlock,
      },
      creds,
    );
  } catch (err) {
    if (err instanceof Error && err.stack) {
      consoleLog(body, `Stack: ${err.stack}`, "error");
    }
    updateStatus(body, `❌ Translation failed: ${err}`);
    consoleLog(body, `❌ Translation failed: ${err}`, "error");
  }
}
