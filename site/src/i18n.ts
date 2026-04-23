export type Locale =
  | "en"
  | "zh-CN"
  | "zh-TW"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "ru"
  | "pt"
  | "ar"
  | "hi";

export type LocaleDefinition = {
  code: Locale;
  label: string;
  href: string;
  routeSegment: string | null;
  ogLocale: string;
  usesChineseMedia: boolean;
  dir: "ltr" | "rtl";
};

export const localeDefinitions: LocaleDefinition[] = [
  {
    code: "en",
    label: "English",
    href: "/en/",
    routeSegment: "en",
    ogLocale: "en_US",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "zh-CN",
    label: "简体中文",
    href: "/",
    routeSegment: null,
    ogLocale: "zh_CN",
    usesChineseMedia: true,
    dir: "ltr",
  },
  {
    code: "zh-TW",
    label: "繁體中文",
    href: "/zh-tw/",
    routeSegment: "zh-tw",
    ogLocale: "zh_TW",
    usesChineseMedia: true,
    dir: "ltr",
  },
  {
    code: "ja",
    label: "日本語",
    href: "/ja/",
    routeSegment: "ja",
    ogLocale: "ja_JP",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "ko",
    label: "한국어",
    href: "/ko/",
    routeSegment: "ko",
    ogLocale: "ko_KR",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "fr",
    label: "Français",
    href: "/fr/",
    routeSegment: "fr",
    ogLocale: "fr_FR",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "de",
    label: "Deutsch",
    href: "/de/",
    routeSegment: "de",
    ogLocale: "de_DE",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "es",
    label: "Español",
    href: "/es/",
    routeSegment: "es",
    ogLocale: "es_ES",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "ru",
    label: "Русский",
    href: "/ru/",
    routeSegment: "ru",
    ogLocale: "ru_RU",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "pt",
    label: "Português",
    href: "/pt/",
    routeSegment: "pt",
    ogLocale: "pt_PT",
    usesChineseMedia: false,
    dir: "ltr",
  },
  {
    code: "ar",
    label: "العربية",
    href: "/ar/",
    routeSegment: "ar",
    ogLocale: "ar_AR",
    usesChineseMedia: false,
    dir: "rtl",
  },
  {
    code: "hi",
    label: "हिन्दी",
    href: "/hi/",
    routeSegment: "hi",
    ogLocale: "hi_IN",
    usesChineseMedia: false,
    dir: "ltr",
  },
];

export const localeOptions = localeDefinitions.map(({ code, label, href }) => ({
  code,
  label,
  href,
}));

export const getLocaleDefinition = (code: Locale) => {
  const locale = localeDefinitions.find((item) => item.code === code);

  if (!locale) {
    throw new Error(`Unknown locale: ${code}`);
  }

  return locale;
};
