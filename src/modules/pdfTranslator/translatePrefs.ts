/* ---------------------------------------------------------------------------
 * pdfTranslator/translatePrefs.ts  –  Saved full-PDF translation settings
 *
 * The Translate tab writes these prefs; the tab and the library context menu
 * both read them. Pref keys must stay stable.
 * -------------------------------------------------------------------------*/

import { config } from "../../../package.json";

declare const Zotero: any;

export const TRANSLATE_MODEL_PREF = "lastUsedModelName.translate";
export const TRANSLATE_PROVIDER_PREF = "lastUsedModelProvider.translate";
export const TRANSLATE_PREFS = {
  sourceLang: "translate.sourceLang",
  targetLang: "translate.targetLang",
  outputMono: "translate.outputMono",
  outputDual: "translate.outputDual",
  skipRefsAuto: "translate.skipReferencesAuto",
  outputDir: "translate.outputDir",
  qps: "translate.qps",
  poolMaxWorker: "translate.poolMaxWorker",
  keepAppendixTranslated: "translate.keepAppendixTranslated",
  protectAuthorBlock: "translate.protectAuthorBlock",
  disableRichTextTranslate: "translate.disableRichTextTranslate",
  enhanceCompatibility: "translate.enhanceCompatibility",
  translateTableText: "translate.translateTableText",
  ocr: "translate.ocr",
  autoOcr: "translate.autoOcr",
  saveGlossary: "translate.saveGlossary",
  disableGlossary: "translate.disableGlossary",
  fontFamily: "translate.fontFamily",
  advancedCollapsed: "translate.advancedCollapsed",
  consoleCollapsed: "translate.consoleCollapsed",
  scrollTop: "translate.scrollTop",
} as const;

export type TranslateFontFamily = "auto" | "serif" | "sans-serif" | "script";

/** The translation options the Translate tab persists between runs. */
export interface SavedTranslateOptions {
  sourceLang: string;
  targetLang: string;
  generateMono: boolean;
  generateDual: boolean;
  qps: number;
  poolMaxWorker: number;
  skipReferencesAuto: boolean;
  keepAppendixTranslated: boolean;
  protectAuthorBlock: boolean;
  disableRichTextTranslate: boolean;
  enhanceCompatibility: boolean;
  translateTableText: boolean;
  ocr: boolean;
  autoOcr: boolean;
  saveGlossary: boolean;
  disableGlossary: boolean;
  fontFamily: TranslateFontFamily;
}

function translatePrefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}

export function getBoolPref(key: string, defaultValue: boolean): boolean {
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

export function setBoolPref(key: string, value: boolean): void {
  try {
    Zotero.Prefs.set(translatePrefKey(key), value, true);
  } catch {
    // ignore
  }
}

export function getStringPref(key: string, defaultValue = ""): string {
  try {
    const value = Zotero.Prefs.get(translatePrefKey(key), true);
    if (typeof value === "string") return value.trim();
  } catch {
    // ignore
  }
  return defaultValue;
}

export function setStringPref(key: string, value: string): void {
  try {
    Zotero.Prefs.set(translatePrefKey(key), value.trim(), true);
  } catch {
    // ignore
  }
}

export function getNumberPref(
  key: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  try {
    const value = Zotero.Prefs.get(translatePrefKey(key), true);
    const parsed =
      typeof value === "number"
        ? value
        : parseInt(String(value ?? "").trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.max(min, Math.min(max, Math.floor(parsed)));
    }
  } catch {
    // ignore
  }
  return defaultValue;
}

export function setNumberPref(
  key: string,
  value: number,
  min: number,
  max: number,
): number {
  const normalized = Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.floor(value)))
    : min;
  setStringPref(key, String(normalized));
  return normalized;
}

export function getPersistedTranslateModel(): string {
  try {
    return String(
      Zotero.Prefs.get(translatePrefKey(TRANSLATE_MODEL_PREF), true) || "",
    ).trim();
  } catch {
    return "";
  }
}

export function getPersistedTranslateProvider(): string {
  try {
    return String(
      Zotero.Prefs.get(translatePrefKey(TRANSLATE_PROVIDER_PREF), true) || "",
    ).trim();
  } catch {
    return "";
  }
}

export function persistTranslateModel(name: string): void {
  try {
    Zotero.Prefs.set(translatePrefKey(TRANSLATE_MODEL_PREF), name, true);
  } catch {
    /* ignore */
  }
}

export function persistTranslateProvider(providerId: string): void {
  try {
    Zotero.Prefs.set(
      translatePrefKey(TRANSLATE_PROVIDER_PREF),
      providerId,
      true,
    );
  } catch {
    /* ignore */
  }
}

function normalizeFontFamily(value: string): TranslateFontFamily {
  return value === "serif" || value === "sans-serif" || value === "script"
    ? value
    : "auto";
}

/**
 * Read the options last saved by the Translate tab, with the same defaults
 * the tab applies to a fresh profile.
 */
export function readSavedTranslateOptions(): SavedTranslateOptions {
  return {
    sourceLang: getStringPref(TRANSLATE_PREFS.sourceLang, "en") || "en",
    targetLang: getStringPref(TRANSLATE_PREFS.targetLang, "zh-CN") || "zh-CN",
    generateMono: getBoolPref(TRANSLATE_PREFS.outputMono, true),
    generateDual: getBoolPref(TRANSLATE_PREFS.outputDual, true),
    qps: getNumberPref(TRANSLATE_PREFS.qps, 10, 1, 100),
    poolMaxWorker: getNumberPref(TRANSLATE_PREFS.poolMaxWorker, 1, 1, 32),
    skipReferencesAuto: getBoolPref(TRANSLATE_PREFS.skipRefsAuto, true),
    keepAppendixTranslated: getBoolPref(
      TRANSLATE_PREFS.keepAppendixTranslated,
      true,
    ),
    protectAuthorBlock: getBoolPref(TRANSLATE_PREFS.protectAuthorBlock, true),
    disableRichTextTranslate: getBoolPref(
      TRANSLATE_PREFS.disableRichTextTranslate,
      false,
    ),
    enhanceCompatibility: getBoolPref(
      TRANSLATE_PREFS.enhanceCompatibility,
      false,
    ),
    translateTableText: getBoolPref(TRANSLATE_PREFS.translateTableText, false),
    ocr: getBoolPref(TRANSLATE_PREFS.ocr, false),
    autoOcr: getBoolPref(TRANSLATE_PREFS.autoOcr, false),
    saveGlossary: getBoolPref(TRANSLATE_PREFS.saveGlossary, true),
    disableGlossary: getBoolPref(TRANSLATE_PREFS.disableGlossary, false),
    fontFamily: normalizeFontFamily(
      getStringPref(TRANSLATE_PREFS.fontFamily, "auto"),
    ),
  };
}
