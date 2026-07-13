import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  MAX_ALLOWED_TOKENS,
} from "../../utils/llmDefaults";
import {
  normalizeTemperature,
  normalizeMaxTokens,
} from "../../utils/normalization";
import {
  config,
  MODEL_PROFILE_SUFFIX,
  ASSISTANT_NOTE_MAP_PREF_KEY,
  CUSTOM_SHORTCUT_ID_PREFIX,
  type ModelProfileKey,
} from "./constants";
import type { ApiProfile, CustomShortcut } from "./types";
import {
  selectedModelCache,
  selectedModelProviderCache,
  panelFontScalePercent,
} from "./state";
import { providerToMarker, type OAuthProviderId } from "../../utils/oauthCli";

export type PrimaryConnectionMode = "oauth" | "custom";

const PRIMARY_CONNECTION_MODE_PREF_KEY = "primaryConnectionMode";
const OAUTH_MARKER_PREFIX = "oauth://";
const DEFAULT_PRIMARY_MODEL = "gpt-4o-mini";
export const PANEL_TYPOGRAPHY_REFRESH_EVENT = "aidea-panel-typography-refresh";
const SELECTION_POPUP_HEIGHT_PREF_KEY = "font.selectionPopupHeight";
export const SELECTION_POPUP_HEIGHT_BOUNDS = { min: 30, max: 720 } as const;

export type PanelTypographySettings = {
  chatFontSize: number;
  chatLineHeight: number;
  messageGap: number;
  bubblePaddingY: number;
  bubblePaddingX: number;
  composerFontSize: number;
  composerLineHeight: number;
  composerPaddingY: number;
  composerPaddingX: number;
  composerGap: number;
  selectionFontSize: number;
  selectionLineHeight: number;
  selectionPopupWidth: number;
  chatImageScale: number;
};

export type PanelTypographyPreset =
  | "compact"
  | "standard"
  | "comfortable"
  | "large";

export const PANEL_TYPOGRAPHY_PRESETS: Record<
  PanelTypographyPreset,
  PanelTypographySettings
> = {
  compact: {
    chatFontSize: 13,
    chatLineHeight: 1.45,
    messageGap: 8,
    bubblePaddingY: 8,
    bubblePaddingX: 12,
    composerFontSize: 13,
    composerLineHeight: 1.45,
    composerPaddingY: 10,
    composerPaddingX: 12,
    composerGap: 8,
    selectionFontSize: 12,
    selectionLineHeight: 1.45,
    selectionPopupWidth: 420,
    chatImageScale: 1,
  },
  standard: {
    chatFontSize: 14,
    chatLineHeight: 1.5,
    messageGap: 12,
    bubblePaddingY: 10,
    bubblePaddingX: 14,
    composerFontSize: 14,
    composerLineHeight: 1.5,
    composerPaddingY: 11,
    composerPaddingX: 13,
    composerGap: 9,
    selectionFontSize: 13,
    selectionLineHeight: 1.5,
    selectionPopupWidth: 450,
    chatImageScale: 1,
  },
  comfortable: {
    chatFontSize: 15,
    chatLineHeight: 1.6,
    messageGap: 14,
    bubblePaddingY: 11,
    bubblePaddingX: 15,
    composerFontSize: 15,
    composerLineHeight: 1.55,
    composerPaddingY: 12,
    composerPaddingX: 14,
    composerGap: 10,
    selectionFontSize: 14,
    selectionLineHeight: 1.55,
    selectionPopupWidth: 480,
    chatImageScale: 1,
  },
  large: {
    chatFontSize: 17,
    chatLineHeight: 1.7,
    messageGap: 16,
    bubblePaddingY: 12,
    bubblePaddingX: 16,
    composerFontSize: 17,
    composerLineHeight: 1.65,
    composerPaddingY: 13,
    composerPaddingX: 16,
    composerGap: 12,
    selectionFontSize: 16,
    selectionLineHeight: 1.65,
    selectionPopupWidth: 540,
    chatImageScale: 1,
  },
};

const PANEL_TYPOGRAPHY_DEFAULTS = PANEL_TYPOGRAPHY_PRESETS.comfortable;
const PANEL_TYPOGRAPHY_PREF_KEYS: Record<
  keyof PanelTypographySettings,
  string
> = {
  chatFontSize: "font.chatSize",
  chatLineHeight: "font.chatLineHeight",
  messageGap: "font.messageGap",
  bubblePaddingY: "font.bubblePaddingY",
  bubblePaddingX: "font.bubblePaddingX",
  composerFontSize: "font.composerSize",
  composerLineHeight: "font.composerLineHeight",
  composerPaddingY: "font.composerPaddingY",
  composerPaddingX: "font.composerPaddingX",
  composerGap: "font.composerGap",
  selectionFontSize: "font.selectionSize",
  selectionLineHeight: "font.selectionLineHeight",
  selectionPopupWidth: "font.selectionPopupWidth",
  chatImageScale: "font.chatImageScale",
};

const PANEL_TYPOGRAPHY_BOUNDS: Record<
  keyof PanelTypographySettings,
  { min: number; max: number; step: number }
> = {
  chatFontSize: { min: 10, max: 28, step: 1 },
  chatLineHeight: { min: 1.2, max: 2.2, step: 0.05 },
  messageGap: { min: 2, max: 36, step: 1 },
  bubblePaddingY: { min: 4, max: 32, step: 1 },
  bubblePaddingX: { min: 6, max: 36, step: 1 },
  composerFontSize: { min: 10, max: 28, step: 1 },
  composerLineHeight: { min: 1.2, max: 2.2, step: 0.05 },
  composerPaddingY: { min: 6, max: 24, step: 1 },
  composerPaddingX: { min: 8, max: 30, step: 1 },
  composerGap: { min: 4, max: 24, step: 1 },
  selectionFontSize: { min: 10, max: 26, step: 1 },
  selectionLineHeight: { min: 1.2, max: 2.2, step: 0.05 },
  selectionPopupWidth: { min: 184, max: 900, step: 10 },
  chatImageScale: { min: 0.6, max: 1.4, step: 0.05 },
};

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeTypographyValue(
  key: keyof PanelTypographySettings,
  value: unknown,
): number {
  const bounds = PANEL_TYPOGRAPHY_BOUNDS[key];
  const fallback = PANEL_TYPOGRAPHY_DEFAULTS[key];
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = clampNumber(parsed, bounds.min, bounds.max);
  return bounds.step < 1 ? Number(clamped.toFixed(2)) : Math.round(clamped);
}

export function getStringPref(key: string): string {
  const value = Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  return typeof value === "string" ? value : "";
}

export function getPanelTypographyBounds() {
  return PANEL_TYPOGRAPHY_BOUNDS;
}

export function getPanelTypographySettings(): PanelTypographySettings {
  const settings = { ...PANEL_TYPOGRAPHY_DEFAULTS };
  for (const key of Object.keys(PANEL_TYPOGRAPHY_PREF_KEYS) as Array<
    keyof PanelTypographySettings
  >) {
    settings[key] = normalizeTypographyValue(
      key,
      Zotero.Prefs.get(
        `${config.prefsPrefix}.${PANEL_TYPOGRAPHY_PREF_KEYS[key]}`,
        true,
      ),
    );
  }
  return settings;
}

export function setPanelTypographySettings(
  partial: Partial<PanelTypographySettings>,
): PanelTypographySettings {
  const current = getPanelTypographySettings();
  const next = { ...current };
  for (const key of Object.keys(partial) as Array<
    keyof PanelTypographySettings
  >) {
    next[key] = normalizeTypographyValue(key, partial[key]);
    Zotero.Prefs.set(
      `${config.prefsPrefix}.${PANEL_TYPOGRAPHY_PREF_KEYS[key]}`,
      String(next[key]),
      true,
    );
  }
  return next;
}

export function getSelectionTranslatePopupHeight(): number | null {
  const raw = Zotero.Prefs.get(
    `${config.prefsPrefix}.${SELECTION_POPUP_HEIGHT_PREF_KEY}`,
    true,
  );
  const parsed = Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(
    clampNumber(
      parsed,
      SELECTION_POPUP_HEIGHT_BOUNDS.min,
      SELECTION_POPUP_HEIGHT_BOUNDS.max,
    ),
  );
}

export function setSelectionTranslatePopupWidth(width: number): number {
  return setPanelTypographySettings({ selectionPopupWidth: width })
    .selectionPopupWidth;
}

export function setSelectionTranslatePopupHeight(
  height: number,
  minimumHeight: number = SELECTION_POPUP_HEIGHT_BOUNDS.min,
): number {
  const normalizedHeight = Math.round(
    clampNumber(
      height,
      Math.max(SELECTION_POPUP_HEIGHT_BOUNDS.min, minimumHeight),
      SELECTION_POPUP_HEIGHT_BOUNDS.max,
    ),
  );
  Zotero.Prefs.set(
    `${config.prefsPrefix}.${SELECTION_POPUP_HEIGHT_PREF_KEY}`,
    String(normalizedHeight),
    true,
  );
  return normalizedHeight;
}

export function setSelectionTranslatePopupSize(
  width: number,
  height: number,
  minimumHeight: number = SELECTION_POPUP_HEIGHT_BOUNDS.min,
): { width: number; height: number } {
  return {
    width: setSelectionTranslatePopupWidth(width),
    height: setSelectionTranslatePopupHeight(height, minimumHeight),
  };
}

export function resetPanelTypographySettings(): PanelTypographySettings {
  const next = setPanelTypographySettings(PANEL_TYPOGRAPHY_DEFAULTS);
  Zotero.Prefs.set(
    `${config.prefsPrefix}.${SELECTION_POPUP_HEIGHT_PREF_KEY}`,
    "0",
    true,
  );
  return next;
}

const LAST_MODEL_PROFILE_PREF_KEY = "lastUsedModelProfile";
const MODEL_PROFILE_KEYS = new Set<ModelProfileKey>([
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
]);

export function getLastUsedModelProfileKey(): ModelProfileKey | null {
  const raw = getStringPref(LAST_MODEL_PROFILE_PREF_KEY).trim().toLowerCase();
  if (!raw || !MODEL_PROFILE_KEYS.has(raw as ModelProfileKey)) return null;
  return raw as ModelProfileKey;
}

export function setLastUsedModelProfileKey(key: ModelProfileKey): void {
  if (!MODEL_PROFILE_KEYS.has(key)) return;
  Zotero.Prefs.set(
    `${config.prefsPrefix}.${LAST_MODEL_PROFILE_PREF_KEY}`,
    key,
    true,
  );
}

function normalizeTemperaturePref(raw: string): number {
  return normalizeTemperature(raw);
}

function normalizeMaxTokensPref(raw: string): number {
  return normalizeMaxTokens(raw);
}

function isOAuthMarker(apiBase: string): boolean {
  return apiBase.trim().startsWith(OAUTH_MARKER_PREFIX);
}

export function migratePrimaryConnectionMode(): PrimaryConnectionMode {
  const currentMode = getStringPref(PRIMARY_CONNECTION_MODE_PREF_KEY).trim();
  if (currentMode === "oauth" || currentMode === "custom") {
    return currentMode;
  }

  const apiBase = getStringPref("apiBase").trim();
  const nextMode: PrimaryConnectionMode =
    apiBase && !isOAuthMarker(apiBase) ? "custom" : "oauth";
  Zotero.Prefs.set(
    `${config.prefsPrefix}.${PRIMARY_CONNECTION_MODE_PREF_KEY}`,
    nextMode,
    true,
  );
  return nextMode;
}

export function getPrimaryConnectionMode(): PrimaryConnectionMode {
  const currentMode = getStringPref(PRIMARY_CONNECTION_MODE_PREF_KEY).trim();
  if (currentMode === "oauth" || currentMode === "custom") {
    return currentMode;
  }
  return migratePrimaryConnectionMode();
}

function getPrimaryApiProfile(): ApiProfile {
  if (getPrimaryConnectionMode() === "custom") {
    return {
      apiBase: getStringPref("apiBase") || "",
      apiKey: getStringPref("apiKey") || "",
      model: getStringPref("model") || "",
    };
  }

  return {
    apiBase: getStringPref("apiBasePrimary") || getStringPref("apiBase") || "",
    apiKey: getStringPref("apiKeyPrimary") || getStringPref("apiKey") || "",
    model:
      getStringPref("modelPrimary") ||
      getStringPref("model") ||
      DEFAULT_PRIMARY_MODEL,
  };
}

export function getApiProfiles(): Record<ModelProfileKey, ApiProfile> {
  const primary = getPrimaryApiProfile();

  const profiles: Record<ModelProfileKey, ApiProfile> = {
    primary: {
      apiBase: primary.apiBase.trim(),
      apiKey: primary.apiKey.trim(),
      model: primary.model.trim(),
    },
    secondary: {
      apiBase: getStringPref("apiBaseSecondary").trim(),
      apiKey: getStringPref("apiKeySecondary").trim(),
      model: getStringPref("modelSecondary").trim(),
    },
    tertiary: {
      apiBase: getStringPref("apiBaseTertiary").trim(),
      apiKey: getStringPref("apiKeyTertiary").trim(),
      model: getStringPref("modelTertiary").trim(),
    },
    quaternary: {
      apiBase: getStringPref("apiBaseQuaternary").trim(),
      apiKey: getStringPref("apiKeyQuaternary").trim(),
      model: getStringPref("modelQuaternary").trim(),
    },
  };

  return profiles;
}

export function getSelectedProfileForItem(itemId: number): {
  key: ModelProfileKey;
  apiBase: string;
  apiKey: string;
  model: string;
} {
  const profiles = getApiProfiles();

  // Check the cache first — it may contain either a profile key or a model name
  const cachedValue = selectedModelCache.get(itemId);
  const cachedProvider = selectedModelProviderCache.get(itemId);

  // If the cache has a model name (not a profile key), resolve the correct
  // credentials by checking the model cache for the provider-specific entry.
  if (cachedValue && !MODEL_PROFILE_KEYS.has(cachedValue as ModelProfileKey)) {
    const resolved = resolveModelCredentials(cachedValue, cachedProvider);
    if (resolved) {
      return {
        key: "primary" as ModelProfileKey,
        apiBase: resolved.apiBase,
        apiKey: resolved.apiKey,
        model: cachedValue,
      };
    }
    // Fallback: use primary profile's credentials
    return {
      key: "primary" as ModelProfileKey,
      apiBase: profiles.primary.apiBase,
      apiKey: profiles.primary.apiKey,
      model: cachedValue,
    };
  }

  // Check persisted model name preference
  const persistedModelName = getStringPref("lastUsedModelName").trim();
  if (!cachedValue && persistedModelName) {
    const persistedProvider = getStringPref("lastUsedModelProvider").trim();
    const resolved = resolveModelCredentials(
      persistedModelName,
      persistedProvider || undefined,
    );
    if (resolved) {
      return {
        key: "primary" as ModelProfileKey,
        apiBase: resolved.apiBase,
        apiKey: resolved.apiKey,
        model: persistedModelName,
      };
    }
    return {
      key: "primary" as ModelProfileKey,
      apiBase: profiles.primary.apiBase,
      apiKey: profiles.primary.apiKey,
      model: persistedModelName,
    };
  }

  // Normal profile key lookup
  const preferredKey: ModelProfileKey =
    (cachedValue as ModelProfileKey) ||
    getLastUsedModelProfileKey() ||
    "primary";
  const selectedKey =
    preferredKey !== "primary" && profiles[preferredKey].model
      ? preferredKey
      : "primary";
  return { key: selectedKey, ...profiles[selectedKey] };
}

/**
 * Resolve apiBase/apiKey for a model by looking it up in the oauthModelListCache.
 * If provider is specified, look in that provider's cache first.
 *
 * For custom-endpoint models (those with an `apiBase` stored in the cache),
 * returns the stored credentials directly.
 *
 * For OAuth models (no `apiBase` but belonging to a known OAuth provider),
 * returns the provider marker (e.g. `oauth://openai-codex`) so the chat
 * system can resolve the correct OAuth token.
 */
const KNOWN_OAUTH_PROVIDERS: ReadonlySet<string> = new Set([
  "openai-codex",
  "google-gemini-cli",
  "github-copilot",
]);

function resolveModelCredentials(
  modelName: string,
  provider?: string,
): { apiBase: string; apiKey: string } | null {
  const cacheRaw = getStringPref("oauthModelListCache").trim();
  if (!cacheRaw) return null;
  let modelCache: Record<
    string,
    Array<{ id: string; apiBase?: string; apiKey?: string }>
  >;
  try {
    modelCache = JSON.parse(cacheRaw);
    if (!modelCache || typeof modelCache !== "object") return null;
  } catch {
    return null;
  }

  const normalized = modelName.trim().toLowerCase();

  /**
   * Try to match a model in a single provider's list.
   * Returns credentials for custom endpoints, OAuth marker for OAuth providers,
   * or null if no match.
   */
  const tryMatch = (
    providerKey: string,
    models: Array<{ id: string; apiBase?: string; apiKey?: string }>,
  ): { apiBase: string; apiKey: string } | null => {
    const match = models.find(
      (m) =>
        String(m.id || "")
          .trim()
          .toLowerCase() === normalized,
    );
    if (!match) return null;
    // Custom endpoint: has explicit apiBase
    if (match.apiBase) {
      return { apiBase: match.apiBase, apiKey: match.apiKey || "" };
    }
    // Known OAuth provider: return the marker so the chat system resolves
    // the correct OAuth credential for this provider.
    if (KNOWN_OAUTH_PROVIDERS.has(providerKey)) {
      return {
        apiBase: providerToMarker(providerKey as OAuthProviderId),
        apiKey: "",
      };
    }
    return null;
  };

  // If provider is specified, look there first
  if (provider) {
    const providerModels = modelCache[provider];
    if (providerModels) {
      const result = tryMatch(provider, providerModels);
      if (result) return result;
    }
  }

  // Search all providers for the model
  for (const [providerKey, models] of Object.entries(modelCache)) {
    if (!Array.isArray(models)) continue;
    const result = tryMatch(providerKey, models);
    if (result) return result;
  }

  return null;
}

export function getAdvancedModelParamsForProfile(profileKey: ModelProfileKey): {
  temperature: number;
  maxTokens: number;
} {
  const suffix = MODEL_PROFILE_SUFFIX[profileKey];
  return {
    temperature: normalizeTemperaturePref(
      getStringPref(`temperature${suffix}`),
    ),
    maxTokens: normalizeMaxTokensPref(getStringPref(`maxTokens${suffix}`)),
  };
}

export function applyPanelFontScale(panel: HTMLElement | null): void {
  if (!panel) return;
  panel.style.setProperty("--llm-font-scale", `${panelFontScalePercent / 100}`);
}

export function applyPanelTypography(panel: HTMLElement | null): void {
  if (!panel) return;
  const settings = getPanelTypographySettings();
  panel.style.setProperty("--llm-chat-font-size", `${settings.chatFontSize}px`);
  panel.style.setProperty(
    "--llm-chat-line-height",
    String(settings.chatLineHeight),
  );
  panel.style.setProperty("--llm-message-gap", `${settings.messageGap}px`);
  panel.style.setProperty(
    "--llm-bubble-padding-y",
    `${settings.bubblePaddingY}px`,
  );
  panel.style.setProperty(
    "--llm-bubble-padding-x",
    `${settings.bubblePaddingX}px`,
  );
  panel.style.setProperty(
    "--llm-composer-font-size",
    `${settings.composerFontSize}px`,
  );
  panel.style.setProperty(
    "--llm-composer-line-height",
    String(settings.composerLineHeight),
  );
  panel.style.setProperty(
    "--llm-composer-padding-y",
    `${settings.composerPaddingY}px`,
  );
  panel.style.setProperty(
    "--llm-composer-padding-x",
    `${settings.composerPaddingX}px`,
  );
  panel.style.setProperty("--llm-composer-gap", `${settings.composerGap}px`);
  panel.style.setProperty(
    "--llm-chat-image-max-width",
    `${Math.round(720 * settings.chatImageScale)}px`,
  );
  panel.style.setProperty(
    "--llm-chat-image-max-height",
    `${Math.round(70 * settings.chatImageScale)}vh`,
  );
}

/** Get/set JSON preferences with error handling */
function getJsonPref(key: string): Record<string, string> {
  const raw =
    (Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true) as string) || "";
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function setJsonPref(key: string, value: Record<string, string>): void {
  Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, JSON.stringify(value), true);
}

export const getShortcutOverrides = () => getJsonPref("shortcuts");
export const setShortcutOverrides = (v: Record<string, string>) =>
  setJsonPref("shortcuts", v);
export const getShortcutLabelOverrides = () => getJsonPref("shortcutLabels");
export const setShortcutLabelOverrides = (v: Record<string, string>) =>
  setJsonPref("shortcutLabels", v);
export const getDeletedShortcutIds = () =>
  getStringArrayPref("shortcutDeleted");
export const setDeletedShortcutIds = (v: string[]) =>
  setStringArrayPref("shortcutDeleted", v);
export const getCustomShortcuts = () =>
  getCustomShortcutsPref("customShortcuts");
export const setCustomShortcuts = (v: CustomShortcut[]) =>
  setCustomShortcutsPref("customShortcuts", v);
export const getShortcutOrder = () => getStringArrayPref("shortcutOrder");
export const setShortcutOrder = (v: string[]) =>
  setStringArrayPref("shortcutOrder", v);

export function getPanelContentHeight(): string {
  return getStringPref("panelContentHeight");
}
export function setPanelContentHeight(height: string): void {
  Zotero.Prefs.set(`${config.prefsPrefix}.panelContentHeight`, height, true);
}
export function getPanelBottomHeight(): string {
  return getStringPref("panelBottomHeight");
}
export function setPanelBottomHeight(height: string): void {
  Zotero.Prefs.set(`${config.prefsPrefix}.panelBottomHeight`, height, true);
}

function getStringArrayPref(key: string): string[] {
  const raw =
    (Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true) as string) || "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function setStringArrayPref(key: string, value: string[]): void {
  Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, JSON.stringify(value), true);
}

function getCustomShortcutsPref(key: string): CustomShortcut[] {
  const raw =
    (Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true) as string) || "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const shortcuts: CustomShortcut[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const id =
        typeof (entry as any).id === "string" ? (entry as any).id.trim() : "";
      const label =
        typeof (entry as any).label === "string"
          ? (entry as any).label.trim()
          : "";
      const prompt =
        typeof (entry as any).prompt === "string"
          ? (entry as any).prompt.trim()
          : "";
      if (!id || !prompt) continue;
      shortcuts.push({
        id,
        label: label || "Custom Shortcut",
        prompt,
      });
    }
    return shortcuts;
  } catch {
    return [];
  }
}

function setCustomShortcutsPref(key: string, value: CustomShortcut[]): void {
  Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, JSON.stringify(value), true);
}

export function createCustomShortcutId(): string {
  const token = Math.random().toString(36).slice(2, 8);
  return `${CUSTOM_SHORTCUT_ID_PREFIX}-${Date.now()}-${token}`;
}

export function resetShortcutsToDefault(): void {
  setShortcutOverrides({});
  setShortcutLabelOverrides({});
  setDeletedShortcutIds([]);
  setCustomShortcuts([]);
  setShortcutOrder([]);
}

function getAssistantNoteMap(): Record<string, string> {
  try {
    return getJsonPref(ASSISTANT_NOTE_MAP_PREF_KEY);
  } catch (err) {
    ztoolkit.log("LLM: Failed to read assistantNoteMap pref:", err);
    return {};
  }
}

function setAssistantNoteMap(value: Record<string, string>): void {
  try {
    setJsonPref(ASSISTANT_NOTE_MAP_PREF_KEY, value);
  } catch (err) {
    ztoolkit.log("LLM: Failed to write assistantNoteMap pref:", err);
  }
}

export function removeAssistantNoteMapEntry(parentItemId: number): void {
  const parentKey = String(parentItemId);
  const map = getAssistantNoteMap();
  if (!(parentKey in map)) return;
  delete map[parentKey];
  setAssistantNoteMap(map);
}

export function getTrackedAssistantNoteForParent(
  parentItemId: number,
): Zotero.Item | null {
  const parentKey = String(parentItemId);
  const map = getAssistantNoteMap();
  const rawNoteId = map[parentKey];
  if (!rawNoteId) return null;
  const noteId = Number.parseInt(rawNoteId, 10);
  if (!Number.isFinite(noteId) || noteId <= 0) {
    removeAssistantNoteMapEntry(parentItemId);
    return null;
  }
  let note: Zotero.Item | null = null;
  try {
    note = Zotero.Items.get(noteId) || null;
  } catch {
    ztoolkit.log(`LLM: Failed to get note item ${noteId}`);
    removeAssistantNoteMapEntry(parentItemId);
    return null;
  }
  if (
    !note ||
    !note.isNote?.() ||
    note.deleted ||
    note.parentID !== parentItemId
  ) {
    removeAssistantNoteMapEntry(parentItemId);
    return null;
  }
  return note;
}

export function rememberAssistantNoteForParent(
  parentItemId: number,
  noteId: number,
): void {
  if (!Number.isFinite(noteId) || noteId <= 0) return;
  const map = getAssistantNoteMap();
  map[String(parentItemId)] = String(noteId);
  setAssistantNoteMap(map);
}

// =============================================================================
// File Attachment State Persistence
// =============================================================================

/**
 * Persist the current list of file attachment IDs for a conversation.
 * Called whenever files are added to or removed from the compose area.
 */
export function persistFileAttachmentState(
  conversationKey: number,
  attachmentIds: string[],
): void {
  try {
    const key = `${config.prefsPrefix}.fileAttachments_${conversationKey}`;
    Zotero.Prefs.set(key, JSON.stringify(attachmentIds), true);
  } catch {
    // ignore write errors
  }
}

/**
 * Load the persisted file attachment IDs for a conversation.
 * Returns null if no persisted state exists (fall back to message-based restore).
 */
export function loadPersistedFileAttachmentIds(
  conversationKey: number,
): string[] | null {
  try {
    const key = `${config.prefsPrefix}.fileAttachments_${conversationKey}`;
    const raw = Zotero.Prefs.get(key, true);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id: unknown) => typeof id === "string" && id.trim());
  } catch {
    return null;
  }
}

/**
 * Clear the persisted file attachment state for a conversation.
 */
export function clearPersistedFileAttachmentState(
  conversationKey: number,
): void {
  try {
    const key = `${config.prefsPrefix}.fileAttachments_${conversationKey}`;
    Zotero.Prefs.set(key, "", true);
  } catch {
    // ignore
  }
}
