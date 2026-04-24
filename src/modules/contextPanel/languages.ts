export type PanelLang =
  | "en-US"
  | "zh-CN"
  | "zh-TW"
  | "ja-JP"
  | "ko-KR"
  | "fr-FR"
  | "de-DE"
  | "es-ES"
  | "ru-RU"
  | "pt-BR"
  | "ar-SA"
  | "hi-IN";

export type LanguageDirection = "ltr" | "rtl";

export type UiLanguageOption = {
  uiCode: PanelLang;
  translateCode: string;
  htmlLang: string;
  label: string;
  englishName: string;
  dir: LanguageDirection;
};

export type TranslationLanguageOption = {
  code: string;
  label: string;
};

export const UI_LANGUAGE_OPTIONS: UiLanguageOption[] = [
  {
    uiCode: "en-US",
    translateCode: "en",
    htmlLang: "en",
    label: "English",
    englishName: "English",
    dir: "ltr",
  },
  {
    uiCode: "zh-CN",
    translateCode: "zh-CN",
    htmlLang: "zh-CN",
    label: "简体中文",
    englishName: "Simplified Chinese",
    dir: "ltr",
  },
  {
    uiCode: "zh-TW",
    translateCode: "zh-TW",
    htmlLang: "zh-TW",
    label: "繁體中文",
    englishName: "Traditional Chinese",
    dir: "ltr",
  },
  {
    uiCode: "ja-JP",
    translateCode: "ja",
    htmlLang: "ja",
    label: "日本語",
    englishName: "Japanese",
    dir: "ltr",
  },
  {
    uiCode: "ko-KR",
    translateCode: "ko",
    htmlLang: "ko",
    label: "한국어",
    englishName: "Korean",
    dir: "ltr",
  },
  {
    uiCode: "fr-FR",
    translateCode: "fr",
    htmlLang: "fr",
    label: "Français",
    englishName: "French",
    dir: "ltr",
  },
  {
    uiCode: "de-DE",
    translateCode: "de",
    htmlLang: "de",
    label: "Deutsch",
    englishName: "German",
    dir: "ltr",
  },
  {
    uiCode: "es-ES",
    translateCode: "es",
    htmlLang: "es",
    label: "Español",
    englishName: "Spanish",
    dir: "ltr",
  },
  {
    uiCode: "ru-RU",
    translateCode: "ru",
    htmlLang: "ru",
    label: "Русский",
    englishName: "Russian",
    dir: "ltr",
  },
  {
    uiCode: "pt-BR",
    translateCode: "pt",
    htmlLang: "pt-BR",
    label: "Português",
    englishName: "Portuguese",
    dir: "ltr",
  },
  {
    uiCode: "ar-SA",
    translateCode: "ar",
    htmlLang: "ar",
    label: "العربية",
    englishName: "Arabic",
    dir: "rtl",
  },
  {
    uiCode: "hi-IN",
    translateCode: "hi",
    htmlLang: "hi",
    label: "हिन्दी",
    englishName: "Hindi",
    dir: "ltr",
  },
];

export const DEFAULT_PANEL_LANG: PanelLang = "en-US";

const UI_LANGUAGE_BY_CODE = new Map<PanelLang, UiLanguageOption>(
  UI_LANGUAGE_OPTIONS.map((language) => [language.uiCode, language]),
);

export function isPanelLang(value: string): value is PanelLang {
  return UI_LANGUAGE_BY_CODE.has(value as PanelLang);
}

export function normalizeUiLanguageCode(
  value: string | null | undefined,
): PanelLang | null {
  const normalized = String(value || "").trim();
  if (isPanelLang(normalized)) return normalized;
  if (normalized === "en") return "en-US";
  if (normalized === "zh") return "zh-CN";
  if (normalized === "zh-Hans") return "zh-CN";
  if (normalized === "zh-Hant") return "zh-TW";
  if (normalized === "ja") return "ja-JP";
  if (normalized === "ko") return "ko-KR";
  if (normalized === "fr") return "fr-FR";
  if (normalized === "de") return "de-DE";
  if (normalized === "es") return "es-ES";
  if (normalized === "ru") return "ru-RU";
  if (normalized === "pt") return "pt-BR";
  if (normalized === "ar") return "ar-SA";
  if (normalized === "hi") return "hi-IN";
  return null;
}

export function detectPanelLangFromLocale(locale: string): PanelLang {
  const normalized = String(locale || "")
    .trim()
    .replace("_", "-");
  const lower = normalized.toLowerCase();
  if (lower.startsWith("zh-tw") || lower.startsWith("zh-hk")) return "zh-TW";
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ja")) return "ja-JP";
  if (lower.startsWith("ko")) return "ko-KR";
  if (lower.startsWith("fr")) return "fr-FR";
  if (lower.startsWith("de")) return "de-DE";
  if (lower.startsWith("es")) return "es-ES";
  if (lower.startsWith("ru")) return "ru-RU";
  if (lower.startsWith("pt")) return "pt-BR";
  if (lower.startsWith("ar")) return "ar-SA";
  if (lower.startsWith("hi")) return "hi-IN";
  return DEFAULT_PANEL_LANG;
}

export function getUiLanguageOption(code: PanelLang): UiLanguageOption {
  return UI_LANGUAGE_BY_CODE.get(code) ?? UI_LANGUAGE_OPTIONS[0];
}

export const TRANSLATION_LANGUAGE_OPTIONS: TranslationLanguageOption[] = [
  ...UI_LANGUAGE_OPTIONS.map((language) => ({
    code: language.translateCode,
    label: language.label,
  })),
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "tr", label: "Türkçe" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "th", label: "ภาษาไทย" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "uk", label: "Українська" },
];
