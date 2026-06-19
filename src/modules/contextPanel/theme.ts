export type BuiltinComposerThemeId =
  | "default"
  | "blue-porcelain"
  | "eye-green"
  | "warm-cream"
  | "premium-gray"
  | "midnight-black"
  | "sakura-pink";

export type ComposerThemeSelection =
  | BuiltinComposerThemeId
  | `custom:${string}`;

export type ComposerThemeLabelKey =
  | "composerThemeDefault"
  | "composerThemeBluePorcelain"
  | "composerThemeEyeGreen"
  | "composerThemeWarmCream"
  | "composerThemePremiumGray"
  | "composerThemeMidnightBlack"
  | "composerThemeSakuraPink";

export const BUILTIN_COMPOSER_THEME_OPTIONS: Array<{
  value: BuiltinComposerThemeId;
  labelKey: ComposerThemeLabelKey;
  fallbackName: string;
}> = [
  { value: "default", labelKey: "composerThemeDefault", fallbackName: "默认" },
  {
    value: "blue-porcelain",
    labelKey: "composerThemeBluePorcelain",
    fallbackName: "青花瓷",
  },
  {
    value: "eye-green",
    labelKey: "composerThemeEyeGreen",
    fallbackName: "护眼绿",
  },
  {
    value: "warm-cream",
    labelKey: "composerThemeWarmCream",
    fallbackName: "米白色",
  },
  {
    value: "premium-gray",
    labelKey: "composerThemePremiumGray",
    fallbackName: "高级灰",
  },
  {
    value: "midnight-black",
    labelKey: "composerThemeMidnightBlack",
    fallbackName: "暗夜黑",
  },
  {
    value: "sakura-pink",
    labelKey: "composerThemeSakuraPink",
    fallbackName: "樱花粉",
  },
];

const BUILTIN_THEME_IDS = new Set(
  BUILTIN_COMPOSER_THEME_OPTIONS.map((option) => option.value),
);

const LEGACY_THEME_ALIASES: Record<string, BuiltinComposerThemeId> = {
  "soft-blue": "blue-porcelain",
  "paper-mint": "eye-green",
  porcelain: "warm-cream",
  graphite: "midnight-black",
};

export type ThemeColorMode = "color" | "system" | "transparent";
export type ThemeColorValue = `#${string}` | ThemeColorMode;

export type ThemeColorKey =
  | "chatBg"
  | "text"
  | "mutedText"
  | "border"
  | "shadowColor"
  | "accent"
  | "keyword"
  | "link"
  | "userBubbleBg"
  | "userBubbleText"
  | "userBubbleBorder"
  | "assistantBubbleBg"
  | "assistantBubbleText"
  | "assistantBubbleBorder"
  | "composerBg"
  | "inputBg"
  | "inputText"
  | "inputPlaceholder"
  | "codeBg"
  | "codeText"
  | "menuBg"
  | "chipBg";

export type ComposerThemePalette = Record<ThemeColorKey, ThemeColorValue>;

export type CustomComposerTheme = {
  id: `custom:${string}`;
  name: string;
  palette: ComposerThemePalette;
  createdAt: number;
  updatedAt: number;
};

export const COMPOSER_THEME_COLOR_CONTROLS: Array<{
  key: ThemeColorKey;
  labelKey: string;
}> = [
  { key: "chatBg", labelKey: "composerThemeCustomChatBg" },
  { key: "text", labelKey: "composerThemeCustomText" },
  { key: "mutedText", labelKey: "composerThemeCustomMutedText" },
  { key: "border", labelKey: "composerThemeCustomBorder" },
  { key: "shadowColor", labelKey: "composerThemeCustomShadow" },
  { key: "accent", labelKey: "composerThemeCustomAccent" },
  { key: "keyword", labelKey: "composerThemeCustomKeyword" },
  { key: "link", labelKey: "composerThemeCustomLink" },
  { key: "userBubbleBg", labelKey: "composerThemeCustomUserBubbleBg" },
  { key: "userBubbleText", labelKey: "composerThemeCustomUserBubbleText" },
  { key: "userBubbleBorder", labelKey: "composerThemeCustomUserBubbleBorder" },
  {
    key: "assistantBubbleBg",
    labelKey: "composerThemeCustomAssistantBubbleBg",
  },
  {
    key: "assistantBubbleText",
    labelKey: "composerThemeCustomAssistantBubbleText",
  },
  {
    key: "assistantBubbleBorder",
    labelKey: "composerThemeCustomAssistantBubbleBorder",
  },
  { key: "composerBg", labelKey: "composerThemeCustomComposerBg" },
  { key: "inputBg", labelKey: "composerThemeCustomInputBg" },
  { key: "inputText", labelKey: "composerThemeCustomInputText" },
  { key: "inputPlaceholder", labelKey: "composerThemeCustomInputPlaceholder" },
  { key: "codeBg", labelKey: "composerThemeCustomCodeBg" },
  { key: "codeText", labelKey: "composerThemeCustomCodeText" },
  { key: "menuBg", labelKey: "composerThemeCustomMenuBg" },
  { key: "chipBg", labelKey: "composerThemeCustomChipBg" },
];

const CSS_VARIABLE_BY_COLOR_KEY: Record<ThemeColorKey, string> = {
  chatBg: "--llm-theme-chat-bg",
  text: "--llm-theme-chat-fg",
  mutedText: "--llm-theme-chat-muted",
  border: "--llm-theme-border",
  shadowColor: "--llm-theme-shadow-color",
  accent: "--llm-theme-accent",
  keyword: "--llm-theme-keyword",
  link: "--llm-theme-link",
  userBubbleBg: "--llm-theme-user-bubble-bg",
  userBubbleText: "--llm-theme-user-bubble-fg",
  userBubbleBorder: "--llm-theme-user-bubble-border",
  assistantBubbleBg: "--llm-theme-assistant-bubble-bg",
  assistantBubbleText: "--llm-theme-assistant-bubble-fg",
  assistantBubbleBorder: "--llm-theme-assistant-bubble-border",
  composerBg: "--llm-theme-composer-bg",
  inputBg: "--llm-theme-input-bg",
  inputText: "--llm-theme-input-fg",
  inputPlaceholder: "--llm-theme-input-placeholder",
  codeBg: "--llm-theme-code-bg",
  codeText: "--llm-theme-code-fg",
  menuBg: "--llm-theme-menu-bg",
  chipBg: "--llm-theme-chip-bg",
};

const THEME_CSS_VARIABLES = Object.values(CSS_VARIABLE_BY_COLOR_KEY);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

const palette = (
  values: Record<ThemeColorKey, ThemeColorValue>,
): ComposerThemePalette => values;

export const BUILTIN_COMPOSER_THEME_PALETTES: Record<
  BuiltinComposerThemeId,
  ComposerThemePalette
> = {
  default: palette({
    chatBg: "transparent",
    text: "system",
    mutedText: "system",
    border: "system",
    shadowColor: "transparent",
    accent: "system",
    keyword: "system",
    link: "system",
    userBubbleBg: "system",
    userBubbleText: "#ffffff",
    userBubbleBorder: "system",
    assistantBubbleBg: "transparent",
    assistantBubbleText: "system",
    assistantBubbleBorder: "transparent",
    composerBg: "system",
    inputBg: "system",
    inputText: "system",
    inputPlaceholder: "system",
    codeBg: "system",
    codeText: "system",
    menuBg: "system",
    chipBg: "transparent",
  }),
  "blue-porcelain": palette({
    chatBg: "#f5f9fb",
    text: "#1f3342",
    mutedText: "#64727c",
    border: "#cbdde8",
    shadowColor: "#6a8da3",
    accent: "#2d6f88",
    keyword: "#9a5a2e",
    link: "#1f7a9a",
    userBubbleBg: "#2d6f88",
    userBubbleText: "#ffffff",
    userBubbleBorder: "#2d6f88",
    assistantBubbleBg: "#ffffff",
    assistantBubbleText: "#1f3342",
    assistantBubbleBorder: "#d9e6ee",
    composerBg: "#edf5f8",
    inputBg: "#ffffff",
    inputText: "#1f3342",
    inputPlaceholder: "#7b8790",
    codeBg: "#edf4f7",
    codeText: "#213847",
    menuBg: "#ffffff",
    chipBg: "#edf4f7",
  }),
  "eye-green": palette({
    chatBg: "#f5faf4",
    text: "#26342b",
    mutedText: "#66766a",
    border: "#d5e3d4",
    shadowColor: "#6f9279",
    accent: "#2f7d5a",
    keyword: "#9a6b1f",
    link: "#1f7a64",
    userBubbleBg: "#2f7d5a",
    userBubbleText: "#ffffff",
    userBubbleBorder: "#2f7d5a",
    assistantBubbleBg: "#fffdf8",
    assistantBubbleText: "#26342b",
    assistantBubbleBorder: "#d9e7d7",
    composerBg: "#edf6eb",
    inputBg: "#fffdf8",
    inputText: "#26342b",
    inputPlaceholder: "#7a887c",
    codeBg: "#eef5ec",
    codeText: "#25392c",
    menuBg: "#fffdf8",
    chipBg: "#eef5ec",
  }),
  "warm-cream": palette({
    chatBg: "#faf7ef",
    text: "#312c24",
    mutedText: "#746a5f",
    border: "#e4d8c6",
    shadowColor: "#9b835f",
    accent: "#74684d",
    keyword: "#a35f28",
    link: "#5f6f87",
    userBubbleBg: "#6f6a5a",
    userBubbleText: "#ffffff",
    userBubbleBorder: "#6f6a5a",
    assistantBubbleBg: "#fffdf8",
    assistantBubbleText: "#312c24",
    assistantBubbleBorder: "#eadfcd",
    composerBg: "#f2ecdf",
    inputBg: "#fffdf8",
    inputText: "#312c24",
    inputPlaceholder: "#84796b",
    codeBg: "#f1eadc",
    codeText: "#3b3328",
    menuBg: "#fffdf8",
    chipBg: "#f1eadc",
  }),
  "premium-gray": palette({
    chatBg: "#f5f6f6",
    text: "#25282a",
    mutedText: "#6e7376",
    border: "#d7dadd",
    shadowColor: "#737b80",
    accent: "#4d6675",
    keyword: "#8a5c2e",
    link: "#2c7280",
    userBubbleBg: "#465864",
    userBubbleText: "#ffffff",
    userBubbleBorder: "#465864",
    assistantBubbleBg: "#ffffff",
    assistantBubbleText: "#25282a",
    assistantBubbleBorder: "#dde0e2",
    composerBg: "#edeff0",
    inputBg: "#ffffff",
    inputText: "#25282a",
    inputPlaceholder: "#7d8386",
    codeBg: "#eceeef",
    codeText: "#2b2f31",
    menuBg: "#ffffff",
    chipBg: "#eceeef",
  }),
  "midnight-black": palette({
    chatBg: "#181a1b",
    text: "#e7e4dc",
    mutedText: "#a8ada8",
    border: "#3a403d",
    shadowColor: "#000000",
    accent: "#2f7d6d",
    keyword: "#f2b84b",
    link: "#86d6c9",
    userBubbleBg: "#2f7d6d",
    userBubbleText: "#f8fbf8",
    userBubbleBorder: "#3a9a87",
    assistantBubbleBg: "#222426",
    assistantBubbleText: "#e7e4dc",
    assistantBubbleBorder: "#3a403d",
    composerBg: "#202322",
    inputBg: "#151718",
    inputText: "#e7e4dc",
    inputPlaceholder: "#8f9691",
    codeBg: "#111716",
    codeText: "#dce7df",
    menuBg: "#202223",
    chipBg: "#24302d",
  }),
  "sakura-pink": palette({
    chatBg: "#fff7fa",
    text: "#33282e",
    mutedText: "#7a6870",
    border: "#ead5df",
    shadowColor: "#b9839c",
    accent: "#b8547a",
    keyword: "#8a6a20",
    link: "#8663a8",
    userBubbleBg: "#b8547a",
    userBubbleText: "#ffffff",
    userBubbleBorder: "#b8547a",
    assistantBubbleBg: "#ffffff",
    assistantBubbleText: "#33282e",
    assistantBubbleBorder: "#efdce5",
    composerBg: "#faedf2",
    inputBg: "#ffffff",
    inputText: "#33282e",
    inputPlaceholder: "#8d7480",
    codeBg: "#f8edf2",
    codeText: "#3b2b32",
    menuBg: "#ffffff",
    chipBg: "#f8edf2",
  }),
};

const normalizeHexColor = (value: string): `#${string}` | null => {
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed)
    ? (trimmed.toLowerCase() as `#${string}`)
    : null;
};

export function normalizeThemeColorValue(
  value: unknown,
  fallback: ThemeColorValue,
): ThemeColorValue {
  if (value === "system" || value === "transparent") return value;
  if (typeof value === "string") {
    const color = normalizeHexColor(value);
    if (color) return color;
  }
  return fallback;
}

export function normalizePalette(
  value: unknown,
  fallback: ComposerThemePalette,
): ComposerThemePalette {
  const source =
    value && typeof value === "object"
      ? (value as Partial<Record<ThemeColorKey, unknown>>)
      : {};
  const result = { ...fallback };
  for (const key of Object.keys(result) as ThemeColorKey[]) {
    result[key] = normalizeThemeColorValue(source[key], fallback[key]);
  }
  return result;
}

export function palettesEqual(
  left: ComposerThemePalette,
  right: ComposerThemePalette,
): boolean {
  return (
    Object.keys(BUILTIN_COMPOSER_THEME_PALETTES.default) as ThemeColorKey[]
  ).every((key) => left[key] === right[key]);
}

export function parseCustomComposerThemes(raw: unknown): CustomComposerTheme[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const themes: CustomComposerTheme[] = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Partial<CustomComposerTheme>;
      const rawId = typeof record.id === "string" ? record.id : "";
      const id = rawId.startsWith("custom:")
        ? (rawId as `custom:${string}`)
        : (`custom:${rawId}` as `custom:${string}`);
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const nameKey = name.toLocaleLowerCase();
      if (
        !id ||
        id === "custom:" ||
        !name ||
        seenIds.has(id) ||
        seenNames.has(nameKey)
      ) {
        continue;
      }
      seenIds.add(id);
      seenNames.add(nameKey);
      const createdAt =
        typeof record.createdAt === "number" &&
        Number.isFinite(record.createdAt)
          ? record.createdAt
          : Date.now();
      const updatedAt =
        typeof record.updatedAt === "number" &&
        Number.isFinite(record.updatedAt)
          ? record.updatedAt
          : createdAt;
      themes.push({
        id,
        name,
        palette: normalizePalette(
          record.palette,
          BUILTIN_COMPOSER_THEME_PALETTES["blue-porcelain"],
        ),
        createdAt,
        updatedAt,
      });
    }
    return themes;
  } catch {
    return [];
  }
}

export function serializeCustomComposerThemes(
  themes: CustomComposerTheme[],
): string {
  return JSON.stringify(
    themes.map((theme) => ({
      id: theme.id,
      name: theme.name.trim(),
      palette: normalizePalette(theme.palette, theme.palette),
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
    })),
  );
}

export type BuiltinComposerThemeOverrides = Partial<
  Record<BuiltinComposerThemeId, ComposerThemePalette>
>;

export function parseBuiltinComposerThemeOverrides(
  raw: unknown,
): BuiltinComposerThemeOverrides {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const record = parsed as Partial<Record<BuiltinComposerThemeId, unknown>>;
    const overrides: BuiltinComposerThemeOverrides = {};
    for (const id of BUILTIN_THEME_IDS) {
      const override = record[id];
      if (!override) continue;
      const normalized = normalizePalette(
        override,
        BUILTIN_COMPOSER_THEME_PALETTES[id],
      );
      if (!palettesEqual(normalized, BUILTIN_COMPOSER_THEME_PALETTES[id])) {
        overrides[id] = normalized;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

export function serializeBuiltinComposerThemeOverrides(
  overrides: BuiltinComposerThemeOverrides,
): string {
  const normalized: BuiltinComposerThemeOverrides = {};
  for (const id of BUILTIN_THEME_IDS) {
    const override = overrides[id];
    if (!override) continue;
    const palette = normalizePalette(
      override,
      BUILTIN_COMPOSER_THEME_PALETTES[id],
    );
    if (!palettesEqual(palette, BUILTIN_COMPOSER_THEME_PALETTES[id])) {
      normalized[id] = palette;
    }
  }
  return Object.keys(normalized).length ? JSON.stringify(normalized) : "";
}

export function createCustomComposerThemeId(): `custom:${string}` {
  return `custom:${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function normalizeComposerThemeSelection(
  value: unknown,
  customThemes: CustomComposerTheme[] = [],
): ComposerThemeSelection {
  if (typeof value !== "string") return "default";
  if (value in LEGACY_THEME_ALIASES) return LEGACY_THEME_ALIASES[value];
  if (BUILTIN_THEME_IDS.has(value as BuiltinComposerThemeId)) {
    return value as BuiltinComposerThemeId;
  }
  if (value.startsWith("custom:")) {
    return customThemes.some((theme) => theme.id === value)
      ? (value as `custom:${string}`)
      : "default";
  }
  if (value === "custom") {
    return customThemes[0]?.id || "default";
  }
  return "default";
}

export function isBuiltinComposerTheme(
  selection: ComposerThemeSelection,
): selection is BuiltinComposerThemeId {
  return BUILTIN_THEME_IDS.has(selection as BuiltinComposerThemeId);
}

export function getBuiltinComposerThemePalette(
  id: BuiltinComposerThemeId,
  overrides: BuiltinComposerThemeOverrides = {},
): ComposerThemePalette {
  return overrides[id]
    ? normalizePalette(overrides[id], BUILTIN_COMPOSER_THEME_PALETTES[id])
    : { ...BUILTIN_COMPOSER_THEME_PALETTES[id] };
}

export function getEffectiveComposerThemePalette(
  selection: ComposerThemeSelection,
  customThemes: CustomComposerTheme[] = [],
  overrides: BuiltinComposerThemeOverrides = {},
): ComposerThemePalette {
  if (isBuiltinComposerTheme(selection)) {
    return getBuiltinComposerThemePalette(selection, overrides);
  }
  const custom = customThemes.find((theme) => theme.id === selection);
  return custom
    ? normalizePalette(custom.palette, custom.palette)
    : { ...BUILTIN_COMPOSER_THEME_PALETTES.default };
}

export function shouldApplyComposerThemeSurface(
  selection: ComposerThemeSelection,
  paletteValue: ComposerThemePalette,
): boolean {
  if (selection !== "default") return true;
  return !palettesEqual(paletteValue, BUILTIN_COMPOSER_THEME_PALETTES.default);
}

export function applyComposerThemePaletteToRoot(
  root: HTMLElement,
  selection: ComposerThemeSelection,
  paletteValue: ComposerThemePalette,
): void {
  const surface = shouldApplyComposerThemeSurface(selection, paletteValue);
  root.dataset.composerTheme = selection;
  root.dataset.composerThemeSurface = surface ? "true" : "false";
  for (const variable of THEME_CSS_VARIABLES) {
    root.style.removeProperty(variable);
  }
  if (!surface) return;
  for (const [key, variable] of Object.entries(
    CSS_VARIABLE_BY_COLOR_KEY,
  ) as Array<[ThemeColorKey, string]>) {
    const value = paletteValue[key];
    if (value === "system") continue;
    root.style.setProperty(variable, value);
  }
}

export function applyComposerThemeToRoot(
  root: HTMLElement,
  rawSelection: unknown,
  rawCustomThemes?: unknown,
  rawBuiltinOverrides?: unknown,
): void {
  const customThemes = parseCustomComposerThemes(rawCustomThemes);
  const overrides = parseBuiltinComposerThemeOverrides(rawBuiltinOverrides);
  const selection = normalizeComposerThemeSelection(rawSelection, customThemes);
  applyComposerThemePaletteToRoot(
    root,
    selection,
    getEffectiveComposerThemePalette(selection, customThemes, overrides),
  );
}
