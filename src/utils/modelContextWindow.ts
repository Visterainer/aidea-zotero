import { config } from "../../package.json";

const pref = `${config.prefsPrefix}.modelContextWindows`;
const modelCachePref = `${config.prefsPrefix}.oauthModelListCache`;

export function validContextWindow(value: unknown): number | undefined {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1024
    ? value
    : undefined;
}

/** Preserve a provider's effective input window, without guessing by model name. */
export function providerContextWindow(
  value: unknown,
  effectivePercent: unknown = 100,
): number | undefined {
  const window = validContextWindow(value);
  if (!window) return undefined;
  // A missing or malformed percent must not discard a valid window.
  const percent =
    typeof effectivePercent === "number" &&
    Number.isFinite(effectivePercent) &&
    effectivePercent > 0 &&
    effectivePercent <= 100
      ? effectivePercent
      : 100;
  return validContextWindow(Math.floor((window * percent) / 100));
}
function key(apiBase: string, model: string): string {
  return `${apiBase.trim().replace(/\/+$/, "").toLowerCase()}|${model.trim()}`;
}
function read(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(
      String(Zotero.Prefs.get(pref, true) || "{}"),
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}
export function getModelContextWindow(
  apiBase: string,
  model: string,
): number | undefined {
  return (
    getModelContextWindowOverride(apiBase, model) ??
    getDiscoveredModelContextWindow(apiBase, model)
  );
}

export function getModelContextWindowOverride(
  apiBase: string,
  model: string,
): number | undefined {
  return validContextWindow(read()[key(apiBase, model)]);
}

export function getDiscoveredModelContextWindow(
  apiBase: string,
  model: string,
): number | undefined {
  try {
    const cache = JSON.parse(
      String(Zotero.Prefs.get(modelCachePref, true) || "{}"),
    );
    const provider = apiBase
      .trim()
      .replace(/\/+$/, "")
      .replace(/^oauth:\/\//, "");
    const rows = cache?.[provider];
    if (!Array.isArray(rows)) return undefined;
    const wanted = model.trim().toLowerCase();
    const row = rows.find(
      (r: any) =>
        String(r?.id || "")
          .trim()
          .toLowerCase() === wanted,
    );
    return validContextWindow(row?.contextWindowTokens);
  } catch {
    return undefined;
  }
}
export function setModelContextWindow(
  apiBase: string,
  model: string,
  value?: number,
): void {
  const values = read();
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 1024))
    throw new Error("Context limit must be an integer of at least 1024 tokens");
  if (value === undefined) delete values[key(apiBase, model)];
  else values[key(apiBase, model)] = value;
  Zotero.Prefs.set(pref, JSON.stringify(values), true);
}
