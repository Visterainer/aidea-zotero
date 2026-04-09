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

declare const Zotero: any;
declare const addon: any;

function prefKey(): string {
  return `${addon.data.config.prefsPrefix}.${TRANSLATE_MODEL_PREF}`;
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

  // Populate on init
  populateTranslateModelSelector(modelSelect);

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
