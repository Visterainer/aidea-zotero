import { config } from "../../package.json";

/**
 * Google ended "Login with Google" for Gemini CLI / Code Assist individual
 * tiers on 2026-06-18, so the google-gemini-cli OAuth provider was removed.
 * Profiles, caches and tokens that still point at it are reset here so the
 * rest of the plugin never sees an unknown provider marker.
 */
const REMOVED_PROVIDER = "google-gemini-cli";
const REMOVED_MARKER = `oauth://${REMOVED_PROVIDER}`;
const REPLACEMENT_MARKER = "oauth://github-copilot";
const PROFILE_SUFFIXES = ["", "Primary", "Secondary", "Tertiary", "Quaternary"];
const PROVIDER_PREFS = [
  "selectionTranslate.provider",
  "authorProfiles.provider",
  "lastUsedModelProvider",
  "lastUsedModelProvider.translate",
];
const TOKEN_PREFS = [
  "geminiOAuthAccessToken",
  "geminiOAuthRefreshToken",
  "geminiOAuthExpiresAt",
  "geminiOAuthScope",
  "geminiOAuthProjectId",
];

function prefName(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}

function getPref(key: string): string {
  try {
    const value = Zotero.Prefs.get(prefName(key), true);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function setPref(key: string, value: string): void {
  try {
    Zotero.Prefs.set(prefName(key), value, true);
  } catch {
    /* prefs unavailable */
  }
}

function isRemovedProvider(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === REMOVED_PROVIDER || normalized === "gemini";
}

/** Returns true when any pref had to change. */
export function migrateRemovedGeminiOAuth(): boolean {
  let changed = false;
  for (const suffix of PROFILE_SUFFIXES) {
    if (getPref(`apiBase${suffix}`).trim() !== REMOVED_MARKER) continue;
    setPref(`apiBase${suffix}`, REPLACEMENT_MARKER);
    setPref(`model${suffix}`, "");
    changed = true;
  }
  for (const key of ["oauthModelListCache", "oauthModelSelectionCache"]) {
    const raw = getPref(key).trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Object.prototype.hasOwnProperty.call(parsed, REMOVED_PROVIDER)
      ) {
        delete (parsed as Record<string, unknown>)[REMOVED_PROVIDER];
        setPref(key, JSON.stringify(parsed));
        changed = true;
      }
    } catch {
      /* leave unparsable caches alone */
    }
  }
  for (const key of PROVIDER_PREFS) {
    if (!isRemovedProvider(getPref(key))) continue;
    setPref(key, "");
    changed = true;
  }
  for (const key of TOKEN_PREFS) {
    if (!getPref(key)) continue;
    setPref(key, "");
    changed = true;
  }
  return changed;
}
