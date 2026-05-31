import { config } from "../../../package.json";
import {
  detectPanelLangFromLocale,
  getUiLanguageOption,
  normalizeUiLanguageCode,
} from "../contextPanel/languages";
import type { PaperAuthor } from "./types";
import { normalizeAuthorProfileLanguage } from "./i18n";

export const NOTE_MARKER = "aidea-author-profile-v1";

export function isZhLocale(): boolean {
  try {
    return /^zh/i.test(String((Zotero as any)?.locale || ""));
  } catch {
    return false;
  }
}

export function getBoolPref(key: string, fallback: boolean): boolean {
  const value = Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
}

export function getStringPref(key: string, fallback = ""): string {
  const value = Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  const text = normalizeWhitespace(value);
  return text || fallback;
}

export function getDefaultAuthorProfileLanguage(): string {
  const uiLanguagePref = getStringPref("uiLanguage", "");
  const savedUiLanguage = normalizeUiLanguageCode(uiLanguagePref);
  if (savedUiLanguage) {
    return normalizeAuthorProfileLanguage(
      getUiLanguageOption(savedUiLanguage).translateCode,
    );
  }

  try {
    const detected = detectPanelLangFromLocale(
      String((Zotero as any)?.locale || ""),
    );
    return normalizeAuthorProfileLanguage(
      getUiLanguageOption(detected).translateCode,
    );
  } catch {
    return isZhLocale() ? "zh-CN" : "en";
  }
}

export function getAuthorProfileLanguage(): string {
  return normalizeAuthorProfileLanguage(
    getStringPref("authorProfiles.language", getDefaultAuthorProfileLanguage()),
  );
}

export function normalizeWhitespace(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDoi(value: unknown): string {
  return normalizeWhitespace(value)
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
}

export function normalizeName(value: unknown): string {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function lastNameKey(value: string): string {
  const normalized = normalizeName(value);
  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] || normalized;
}

export function dedupeStrings(
  values: Array<string | undefined | null>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = normalizeWhitespace(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function mergeIntoAuthor(
  target: PaperAuthor,
  patch: Partial<PaperAuthor>,
) {
  if (patch.givenName && !target.givenName) target.givenName = patch.givenName;
  if (patch.familyName && !target.familyName)
    target.familyName = patch.familyName;
  if (patch.sequence && !target.sequence) target.sequence = patch.sequence;
  if (patch.orcid && !target.orcid) target.orcid = patch.orcid;
  if (patch.openAlexId && !target.openAlexId)
    target.openAlexId = patch.openAlexId;
  if (patch.semanticScholarId && !target.semanticScholarId) {
    target.semanticScholarId = patch.semanticScholarId;
  }
  target.affiliations = dedupeStrings([
    ...target.affiliations,
    ...(patch.affiliations || []),
  ]);
  target.emails = dedupeStrings([...target.emails, ...(patch.emails || [])]);
  target.evidence = dedupeStrings([
    ...target.evidence,
    ...(patch.evidence || []),
  ]);
  target.correspondenceSources = Array.from(
    new Set([
      ...target.correspondenceSources,
      ...(patch.correspondenceSources || []),
    ]),
  );
  target.metrics = {
    ...target.metrics,
    ...(patch.metrics || {}),
  };
  if (patch.isCorresponding) target.isCorresponding = true;
}

export function createAuthor(params: {
  name: string;
  givenName?: string;
  familyName?: string;
  sequence?: number;
}): PaperAuthor {
  return {
    name: normalizeWhitespace(params.name),
    givenName: normalizeWhitespace(params.givenName) || undefined,
    familyName: normalizeWhitespace(params.familyName) || undefined,
    sequence: params.sequence,
    affiliations: [],
    emails: [],
    correspondenceSources: [],
    evidence: [],
    metrics: {},
  };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function truncateText(text: string, maxLength: number): string {
  const normalized = normalizeWhitespace(text);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
