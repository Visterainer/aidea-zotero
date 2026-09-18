import { config } from "../../package.json";

const pref = `${config.prefsPrefix}.modelContextWindows`;
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
  const value = read()[key(apiBase, model)];
  return Number.isSafeInteger(value) && value >= 1024 ? value : undefined;
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
