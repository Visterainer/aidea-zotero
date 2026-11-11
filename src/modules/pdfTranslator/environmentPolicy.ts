export const TRANSLATION_BRIDGE_API = 1;
export const TRANSLATION_ENV_URL =
  "https://visterainer.github.io/aidea-zotero/translate-env/manifest.json";

export interface TranslationEnvManifest {
  schemaVersion: 1;
  revision: number;
  bridgeApi: number;
  python: "3.12";
  requirementsUrl: string;
  requirementsSha256: string;
  versions: {
    "pdf2zh-next": string;
    babeldoc: string;
    bitstring: string;
  };
}

export type TranslationEnvAction = "install" | "current" | "update" | "repair";

const VERSION_RE = /^[0-9][A-Za-z0-9.!+_-]*$/;
const PACKAGE_LINE_RE =
  /^([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9][A-Za-z0-9.!+_-]*)(?:\s*;\s*[A-Za-z0-9_ .<>=!'"(),-]+)?$/;

/** Treat the remote catalog as data, never as an installer command. */
export function parseTranslationEnvManifest(
  value: unknown,
  minimumRevision: number,
): TranslationEnvManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid manifest");
  const m = value as Record<string, unknown>;
  if (
    m.schemaVersion !== 1 ||
    m.bridgeApi !== TRANSLATION_BRIDGE_API ||
    m.python !== "3.12" ||
    !Number.isSafeInteger(m.revision) ||
    (m.revision as number) < minimumRevision ||
    typeof m.requirementsSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(m.requirementsSha256)
  ) {
    throw new Error("Unsupported translation environment manifest");
  }
  const expectedUrl =
    `https://visterainer.github.io/aidea-zotero/translate-env/` +
    `requirements-${m.revision}.lock`;
  if (m.requirementsUrl !== expectedUrl) {
    throw new Error("Untrusted requirements URL");
  }
  const versions = m.versions;
  if (!versions || typeof versions !== "object") {
    throw new Error("Missing engine versions");
  }
  for (const name of ["pdf2zh-next", "babeldoc", "bitstring"]) {
    const version = (versions as Record<string, unknown>)[name];
    if (typeof version !== "string" || !VERSION_RE.test(version)) {
      throw new Error(`Invalid ${name} version`);
    }
  }
  return value as TranslationEnvManifest;
}

export function validateTranslationRequirements(
  contents: string,
  manifest: TranslationEnvManifest,
): void {
  if (contents.length > 100_000) throw new Error("Requirements too large");
  const packages = new Map<string, Set<string>>();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = PACKAGE_LINE_RE.exec(line);
    if (!match)
      throw new Error(`Unsafe requirements line: ${line.slice(0, 80)}`);
    const name = match[1].toLowerCase().replace(/[_.]+/g, "-");
    const versions = packages.get(name) || new Set<string>();
    versions.add(match[2]);
    packages.set(name, versions);
  }
  for (const [name, version] of Object.entries(manifest.versions)) {
    const pinned = packages.get(name);
    if (!pinned || pinned.size !== 1 || !pinned.has(version)) {
      throw new Error(`Lock does not pin ${name} ${version}`);
    }
  }
}

export function chooseTranslationEnvAction(
  installed: boolean,
  healthy: boolean,
  installedRevision: number | null,
  targetRevision: number,
): TranslationEnvAction {
  if (!installed) return "install";
  if (!healthy) return "repair";
  if (installedRevision === null || installedRevision < targetRevision) {
    return "update";
  }
  return "current";
}
