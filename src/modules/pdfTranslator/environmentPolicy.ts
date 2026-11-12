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

/** Upper bound for a lock file; a hash-pinned universal lock is ~300 kB. */
export const MAX_TRANSLATION_LOCK_BYTES = 1_000_000;

const VERSION_RE = /^[0-9][A-Za-z0-9.!+_-]*$/;
const PACKAGE_LINE_RE =
  /^([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9][A-Za-z0-9.!+_-]*)(?:\s*;\s*[A-Za-z0-9_ .<>=!'"(),-]+)?$/;
const HASH_TOKEN_RE = /^--hash=sha256:[a-f0-9]{64}$/;

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

/**
 * A lock is a list of `name==version [; marker]` pins, each followed by the
 * SHA-256 of every file that may satisfy it. Nothing else is allowed: no
 * index options, no URLs, no unpinned or unhashed packages. The hashes are
 * what makes it safe to download the same packages from a mirror.
 */
export function validateTranslationRequirements(
  contents: string,
  manifest: TranslationEnvManifest,
): void {
  if (contents.length > MAX_TRANSLATION_LOCK_BYTES) {
    throw new Error("Requirements too large");
  }
  const packages = new Map<string, Set<string>>();
  // uv writes one hash per continuation line.
  const logicalLines = contents.replace(/[ \t]*\\\r?\n/g, " ").split(/\r?\n/);
  for (const rawLine of logicalLines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [pin, ...hashes] = line.split(/\s+(?=--hash=)/);
    const match = PACKAGE_LINE_RE.exec(pin.trim());
    if (!match) {
      throw new Error(`Unsafe requirements line: ${line.slice(0, 80)}`);
    }
    if (
      !hashes.length ||
      hashes.some((token) => !HASH_TOKEN_RE.test(token.trim()))
    ) {
      throw new Error(`Requirement is not hash-pinned: ${match[1]}`);
    }
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

/* ── Platform support ── */

export interface TranslationPlatformInfo {
  os: "windows" | "macos" | "linux";
  /** Machine architecture(s) as reported by the OS; empty when unknown. */
  arch: string[];
  /** Darwin kernel major version (macOS 13 is Darwin 22). */
  darwinMajor?: number;
  libc?: { kind: "glibc"; major: number; minor: number } | { kind: "musl" };
}

// The pinned packages are installed from wheels only. These floors come from
// resolving the lock for each target (`uv pip install --dry-run
// --python-platform ...`): onnx needs macOS 13, several packages publish
// only manylinux_2_28 wheels and none for musl or 32-bit systems.
const MIN_DARWIN_MAJOR = 22;
const MIN_GLIBC: [number, number] = [2, 28];
const SUPPORTED_ARCH = /^(x86_64|amd64|x64|aarch64|arm64)$/i;

/**
 * Null when the platform can run the translation engine or when not enough
 * is known to say otherwise; an unknown system is allowed to try.
 */
export function describeUnsupportedTranslationPlatform(
  info: TranslationPlatformInfo,
): string | null {
  const arch = info.arch.map((value) => value.trim()).filter(Boolean);
  if (arch.length && !arch.some((value) => SUPPORTED_ARCH.test(value))) {
    return (
      `The translation engine needs a 64-bit x86 or ARM system (found ${arch.join("/")}). / ` +
      `翻译引擎需要 64 位 x86 或 ARM 系统（当前为 ${arch.join("/")}）。`
    );
  }
  if (
    info.os === "macos" &&
    info.darwinMajor !== undefined &&
    info.darwinMajor < MIN_DARWIN_MAJOR
  ) {
    return (
      "The translation engine needs macOS 13 or later. / " +
      "翻译引擎需要 macOS 13 或更高版本。"
    );
  }
  if (info.os === "linux" && info.libc?.kind === "musl") {
    return (
      "The translation engine does not support musl-based Linux (e.g. Alpine). / " +
      "翻译引擎不支持基于 musl 的 Linux（如 Alpine）。"
    );
  }
  if (info.os === "linux" && info.libc?.kind === "glibc") {
    const { major, minor } = info.libc;
    if (
      major < MIN_GLIBC[0] ||
      (major === MIN_GLIBC[0] && minor < MIN_GLIBC[1])
    ) {
      return (
        `The translation engine needs glibc ${MIN_GLIBC.join(".")} or later (found ${major}.${minor}). / ` +
        `翻译引擎需要 glibc ${MIN_GLIBC.join(".")} 或更高版本（当前为 ${major}.${minor}）。`
      );
    }
  }
  return null;
}

/**
 * Parse the output of the Unix probe: `uname -m`, `uname -r`, then whatever
 * `getconf GNU_LIBC_VERSION` or `ldd --version` printed.
 */
export function parseUnixPlatformProbe(
  os: "macos" | "linux",
  output: string,
): TranslationPlatformInfo {
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const info: TranslationPlatformInfo = { os, arch: [] };
  if (lines[0] && /^[A-Za-z0-9_]+$/.test(lines[0])) info.arch = [lines[0]];
  if (os === "macos") {
    const major = Number((lines[1] || "").match(/^(\d+)\./)?.[1]);
    if (Number.isInteger(major) && major > 0) info.darwinMajor = major;
    return info;
  }
  const rest = lines.slice(2).join("\n");
  const glibc = rest.match(
    /(?:glibc|gnu libc|gnu c library)[^\d\n]*(\d+)\.(\d+)/i,
  );
  if (glibc) {
    info.libc = {
      kind: "glibc",
      major: Number(glibc[1]),
      minor: Number(glibc[2]),
    };
  } else if (/musl/i.test(rest)) {
    info.libc = { kind: "musl" };
  }
  return info;
}

/* ── Download sources ── */

export type TranslationDownloadSource = "official" | "mirror";

/**
 * Mirrors reachable from mainland China. Packages are verified against the
 * hashes in the lock, so a mirror cannot substitute different files.
 */
const MIRROR_PYPI_INDEX = "https://mirrors.aliyun.com/pypi/simple/";
const MIRROR_PYTHON_BUILDS =
  "https://registry.npmmirror.com/-/binary/python-build-standalone";

/** Environment for uv when it creates the venv and downloads packages. */
export function buildUvDownloadEnv(
  source: TranslationDownloadSource,
): Record<string, string> {
  // uv's default 30 s read timeout is too short for large wheels on slow or
  // proxied connections.
  const env: Record<string, string> = { UV_HTTP_TIMEOUT: "120" };
  if (source === "mirror") {
    env.UV_DEFAULT_INDEX = MIRROR_PYPI_INDEX;
    // Name used by uv releases before 0.4.23.
    env.UV_INDEX_URL = MIRROR_PYPI_INDEX;
    env.UV_PYTHON_INSTALL_MIRROR = MIRROR_PYTHON_BUILDS;
  }
  return env;
}

/**
 * Sources to try, in order. "auto" starts with the mirror for Simplified
 * Chinese locales and falls back to the other source; an explicit choice is
 * never second-guessed.
 */
export function resolveDownloadSources(
  preference: string,
  locale: string,
): TranslationDownloadSource[] {
  const choice = String(preference || "")
    .trim()
    .toLowerCase();
  if (choice === "official" || choice === "mirror") return [choice];
  const zhCN = /^zh(?:[-_](?:cn|hans|sg))?$/i.test(
    String(locale || "")
      .trim()
      .split(/[-_]/)
      .slice(0, 2)
      .join("-"),
  );
  return zhCN ? ["mirror", "official"] : ["official", "mirror"];
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

/** `aidea-translate-env-r<revision>-<sha8>-<nonce>`, as created by the updater. */
const REVISIONED_ENV_NAME_RE =
  /^aidea-translate-env-r\d+-[a-f0-9]{8}-[a-z0-9]*$/;
const LEGACY_ENV_NAMES = ["aidea-translate-env", "aidea-translate-conda-env"];

/**
 * Decide which entries of the environment parent directory are leftovers.
 *
 * Works on bare entry names so the caller can only ever delete direct
 * children of that directory. Nothing is removable unless the active
 * environment is itself a revisioned one that is present in the listing.
 */
export function selectRemovableEnvironmentDirs(
  entryNames: string[],
  activeName: string,
  previousName?: string,
): string[] {
  if (
    !REVISIONED_ENV_NAME_RE.test(activeName) ||
    !entryNames.includes(activeName)
  ) {
    return [];
  }
  // Windows and default macOS volumes are case-insensitive.
  const keep = new Set(
    [activeName, previousName || ""].map((name) => name.toLowerCase()),
  );
  return entryNames.filter(
    (name) =>
      !keep.has(name.toLowerCase()) &&
      (REVISIONED_ENV_NAME_RE.test(name) || LEGACY_ENV_NAMES.includes(name)),
  );
}
