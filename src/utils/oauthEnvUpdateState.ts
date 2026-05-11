import { config } from "../../package.json";

export const OAUTH_ENV_UPDATE_INTERVAL_MS = 72 * 60 * 60 * 1000;

const PREF_KEY = `${config.prefsPrefix}.oauthEnvUpdateState`;

export type OAuthEnvProviderUpdateState = {
  lastCheckedAt?: number;
  lastUpdatedAt?: number;
  snoozeUntil?: number;
};

export type OAuthEnvUpdateState = Record<string, OAuthEnvProviderUpdateState>;

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function readOAuthEnvUpdateState(): OAuthEnvUpdateState {
  try {
    const raw = Zotero.Prefs.get(PREF_KEY, true);
    if (typeof raw !== "string" || !raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: OAuthEnvUpdateState = {};
    for (const [provider, state] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!provider || !state || typeof state !== "object") continue;
      const row = state as Record<string, unknown>;
      out[provider] = {};
      if (isFiniteTimestamp(row.lastUpdatedAt)) {
        out[provider].lastUpdatedAt = row.lastUpdatedAt;
      }
      if (isFiniteTimestamp(row.lastCheckedAt)) {
        out[provider].lastCheckedAt = row.lastCheckedAt;
      }
      if (isFiniteTimestamp(row.snoozeUntil)) {
        out[provider].snoozeUntil = row.snoozeUntil;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeOAuthEnvUpdateState(state: OAuthEnvUpdateState): void {
  try {
    Zotero.Prefs.set(PREF_KEY, JSON.stringify(state), true);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to persist OAuth env update state", err);
  }
}

export function getDueOAuthEnvUpdateProviders(
  providers: string[],
  now = Date.now(),
): string[] {
  const state = readOAuthEnvUpdateState();
  return providers.filter((provider) => {
    const row = state[provider] || {};
    if (row.snoozeUntil && row.snoozeUntil > now) return false;
    const lastRunAt = Math.max(row.lastCheckedAt || 0, row.lastUpdatedAt || 0);
    return now - lastRunAt >= OAUTH_ENV_UPDATE_INTERVAL_MS;
  });
}

export function recordOAuthEnvUpdateChecked(
  providers: string[],
  now = Date.now(),
): void {
  const state = readOAuthEnvUpdateState();
  for (const provider of providers) {
    if (!provider) continue;
    state[provider] = {
      ...(state[provider] || {}),
      lastCheckedAt: now,
    };
  }
  writeOAuthEnvUpdateState(state);
}

export function recordOAuthEnvUpdateSuccess(
  provider: string,
  now = Date.now(),
): void {
  if (!provider) return;
  const state = readOAuthEnvUpdateState();
  state[provider] = {
    ...(state[provider] || {}),
    lastCheckedAt: now,
    lastUpdatedAt: now,
  };
  delete state[provider].snoozeUntil;
  writeOAuthEnvUpdateState(state);
}

export function snoozeOAuthEnvUpdateProviders(
  providers: string[],
  until: number,
): void {
  const state = readOAuthEnvUpdateState();
  for (const provider of providers) {
    if (!provider) continue;
    state[provider] = {
      ...(state[provider] || {}),
      snoozeUntil: until,
    };
  }
  writeOAuthEnvUpdateState(state);
}
