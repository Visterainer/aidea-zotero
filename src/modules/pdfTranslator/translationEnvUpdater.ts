import {
  BUNDLED_ENV_MANIFEST,
  BUNDLED_ENV_REQUIREMENTS,
} from "./bundledEnvironment";
import { config } from "../../../package.json";
import {
  chooseTranslationEnvAction,
  parseTranslationEnvManifest,
  TRANSLATION_ENV_URL,
  validateTranslationRequirements,
  type TranslationEnvAction,
  type TranslationEnvManifest,
} from "./environmentPolicy";
import {
  activateTranslationEnvironment,
  checkEnvironment,
  ensureUvBinary,
  getActiveTranslationEnvironment,
  getCondaEnvDir,
  getEnvRoot,
  getPdf2zhBin,
  getPythonBin,
  runCmd,
} from "./envManager";
import type { EnvStatus } from "./types";

const REMOTE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RUNTIME_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MAX_MANIFEST_BYTES = 8_192;
const MAX_LOCK_BYTES = 100_000;
const LAST_REMOTE_ATTEMPT_PREF = `${config.prefsPrefix}.translate.envLastRemoteAttempt`;

type Catalog = {
  manifest: TranslationEnvManifest;
  requirements: string;
  checkedAt: number;
};

export interface TranslationEnvInspection {
  action: TranslationEnvAction;
  environment: EnvStatus;
  targetRevision: number;
  installedRevision: number | null;
  targetVersions: TranslationEnvManifest["versions"];
  warning?: string;
}

export interface TranslationEnvUpdateResult {
  action: TranslationEnvAction;
  environment: EnvStatus;
  revision: number;
}

const verifiedRuntime = new Map<string, number>();
let updateInProgress: Promise<TranslationEnvUpdateResult> | null = null;

function bundledCatalog(): Catalog {
  return {
    manifest: parseTranslationEnvManifest(
      BUNDLED_ENV_MANIFEST,
      BUNDLED_ENV_MANIFEST.revision,
    ),
    requirements: BUNDLED_ENV_REQUIREMENTS,
    checkedAt: 0,
  };
}

function cachePath(): string {
  return `${getEnvRoot()}-catalog.json`;
}

async function sha256(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function validateCatalog(catalog: Catalog): Promise<void> {
  const manifest = parseTranslationEnvManifest(
    catalog.manifest,
    BUNDLED_ENV_MANIFEST.revision,
  );
  validateTranslationRequirements(catalog.requirements, manifest);
  if ((await sha256(catalog.requirements)) !== manifest.requirementsSha256) {
    throw new Error("Translation environment lock checksum mismatch");
  }
}

async function verifyLockedPackages(
  pythonBin: string,
  lockPath: string,
): Promise<void> {
  const code =
    "from packaging.requirements import Requirement; " +
    "import importlib.metadata as m, sys; " +
    "reqs = [Requirement(s.strip()) for s in open(sys.argv[1], encoding='utf-8') " +
    "if s.strip() and not s.lstrip().startswith('#')]; " +
    "assert all((r.marker is not None and not r.marker.evaluate()) " +
    "or r.specifier.contains(m.version(r.name), prereleases=True) for r in reqs), " +
    "'Installed packages differ from the verified lock'";
  await runCmd(pythonBin, ["-c", code, lockPath]);
}

async function loadCachedCatalog(): Promise<Catalog | null> {
  try {
    const path = cachePath();
    if (!(await IOUtils.exists(path))) return null;
    const raw = await IOUtils.readUTF8(path);
    if (raw.length > MAX_LOCK_BYTES + MAX_MANIFEST_BYTES) return null;
    const value = JSON.parse(raw) as Catalog;
    if (!Number.isFinite(value.checkedAt)) return null;
    await validateCatalog(value);
    return value;
  } catch {
    return null;
  }
}

async function fetchText(url: string, maxBytes: number): Promise<string> {
  const AbortControllerCtor = ztoolkit.getGlobal(
    "AbortController",
  ) as typeof AbortController;
  const fetchFn = ztoolkit.getGlobal("fetch") as typeof fetch;
  const controller = new AbortControllerCtor();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchFn(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    if (body.length > maxBytes) throw new Error("Response too large");
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function getTargetCatalog(
  forceRemote: boolean,
): Promise<{ catalog: Catalog; warning?: string }> {
  const fallback = bundledCatalog();
  await validateCatalog(fallback);
  const cached = await loadCachedCatalog();
  let lastAttempt = 0;
  try {
    lastAttempt = Number(Zotero.Prefs.get(LAST_REMOTE_ATTEMPT_PREF, true)) || 0;
  } catch {
    // No persisted check yet.
  }
  if (
    !forceRemote &&
    Date.now() - Math.max(cached?.checkedAt || 0, lastAttempt) <
      REMOTE_CHECK_INTERVAL_MS
  ) {
    return { catalog: cached || fallback };
  }
  try {
    Zotero.Prefs.set(LAST_REMOTE_ATTEMPT_PREF, String(Date.now()), true);
  } catch {
    // Best effort throttling only.
  }
  try {
    const raw = await fetchText(TRANSLATION_ENV_URL, MAX_MANIFEST_BYTES);
    const manifest = parseTranslationEnvManifest(
      JSON.parse(raw),
      Math.max(fallback.manifest.revision, cached?.manifest.revision || 0),
    );
    if (
      (manifest.revision === fallback.manifest.revision &&
        manifest.requirementsSha256 !== fallback.manifest.requirementsSha256) ||
      (cached &&
        manifest.revision === cached.manifest.revision &&
        manifest.requirementsSha256 !== cached.manifest.requirementsSha256)
    ) {
      throw new Error(
        "Published revision changed without a revision increment",
      );
    }
    const requirements = await fetchText(
      manifest.requirementsUrl,
      MAX_LOCK_BYTES,
    );
    const catalog = { manifest, requirements, checkedAt: Date.now() };
    await validateCatalog(catalog);
    try {
      await IOUtils.writeUTF8(cachePath(), JSON.stringify(catalog));
    } catch {
      // A cache write failure must not hide a valid online update.
    }
    return { catalog };
  } catch (err) {
    return {
      catalog:
        cached && cached.manifest.revision >= fallback.manifest.revision
          ? cached
          : fallback,
      warning: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Full import check is cached briefly; manual checks always bypass the cache. */
export async function verifyTranslationEnvironmentRuntime(
  env: EnvStatus,
  force = false,
): Promise<{ ok: boolean; detail?: string }> {
  if (env.status !== "ready") return { ok: false, detail: env.status };
  const checkedAt = verifiedRuntime.get(env.venvDir) || 0;
  if (!force && Date.now() - checkedAt < RUNTIME_CHECK_INTERVAL_MS) {
    return { ok: true };
  }
  try {
    const code = "from pdf2zh_next.main import cli";
    const active = getActiveTranslationEnvironment();
    const selected =
      active?.dir === env.venvDir
        ? active
        : active?.previous?.dir === env.venvDir
          ? active.previous
          : null;
    if (selected) {
      const lockPath = PathUtils.join(env.venvDir, "requirements.lock");
      const lock = await IOUtils.readUTF8(lockPath);
      if ((await sha256(lock)) !== selected.sha256) {
        throw new Error("Installed environment lock checksum mismatch");
      }
      await verifyLockedPackages(env.pythonBin, lockPath);
    }
    await runCmd(env.pythonBin, ["-c", code]);
    verifiedRuntime.set(env.venvDir, Date.now());
    return { ok: true };
  } catch (err) {
    verifiedRuntime.delete(env.venvDir);
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function inspectWithCatalog(
  catalog: Catalog,
  warning?: string,
  forceRuntime = false,
): Promise<TranslationEnvInspection> {
  const env = await checkEnvironment();
  const active = getActiveTranslationEnvironment();
  const installed =
    env.status === "ready" ||
    !!active ||
    (await IOUtils.exists(getEnvRoot())) ||
    (await IOUtils.exists(getCondaEnvDir()));
  const health =
    env.status === "ready"
      ? await verifyTranslationEnvironmentRuntime(env, forceRuntime)
      : { ok: false };
  const installedRevision =
    env.status === "ready" && active?.dir === env.venvDir
      ? active.revision
      : env.status === "ready" && active?.previous?.dir === env.venvDir
        ? active.previous.revision
        : null;
  const installedHash =
    env.status === "ready" && active?.dir === env.venvDir
      ? active.sha256
      : env.status === "ready" && active?.previous?.dir === env.venvDir
        ? active.previous.sha256
        : null;
  const action = chooseTranslationEnvAction(
    installed,
    health.ok,
    installedRevision,
    catalog.manifest.revision,
  );
  return {
    action:
      action === "current" &&
      installedRevision === catalog.manifest.revision &&
      installedHash !== catalog.manifest.requirementsSha256
        ? "update"
        : action,
    environment: env,
    targetRevision: catalog.manifest.revision,
    installedRevision,
    targetVersions: catalog.manifest.versions,
    warning: health.ok ? warning : health.detail || warning,
  };
}

export async function inspectTranslationEnvironment(
  forceRemote = false,
): Promise<TranslationEnvInspection> {
  const { catalog, warning } = await getTargetCatalog(forceRemote);
  return inspectWithCatalog(catalog, warning, forceRemote);
}

async function installWithCatalog(
  catalog: Catalog,
  action: TranslationEnvAction,
  onProgress: (step: string, detail: string) => void,
): Promise<TranslationEnvUpdateResult> {
  const uv = await ensureUvBinary();
  const { manifest, requirements } = catalog;
  const nonce = Math.random().toString(36).slice(2, 10);
  const dir = `${getEnvRoot()}-r${manifest.revision}-${manifest.requirementsSha256.slice(0, 8)}-${nonce}`;
  const pythonBin = getPythonBin(dir);
  const pdf2zhBin = getPdf2zhBin(dir);
  try {
    onProgress(
      "create_venv",
      `Creating Python ${manifest.python} environment...`,
    );
    await runCmd(uv, ["venv", dir, "--python", manifest.python]);
    const lockPath = PathUtils.join(dir, "requirements.lock");
    await IOUtils.writeUTF8(lockPath, requirements);
    onProgress(
      "install_pkg",
      `Installing verified environment revision ${manifest.revision}...`,
    );
    await runCmd(uv, [
      "pip",
      "sync",
      lockPath,
      "--python",
      pythonBin,
      "--only-binary",
      ":all:",
    ]);
    const versions = manifest.versions;
    const verifyCode =
      "import importlib.metadata as m; " +
      "from pdf2zh_next.main import cli; " +
      Object.entries(versions)
        .map(
          ([name, version]) =>
            `assert m.version('${name}') == '${version}', '${name} version mismatch'`,
        )
        .join("; ");
    onProgress("verify", "Checking package versions and engine imports...");
    await verifyLockedPackages(pythonBin, lockPath);
    await runCmd(pythonBin, ["-c", verifyCode]);
    await runCmd(pdf2zhBin, ["--help"]);
    if (
      !(await IOUtils.exists(pythonBin)) ||
      !(await IOUtils.exists(pdf2zhBin))
    ) {
      throw new Error("Validated environment is missing its executables");
    }
    activateTranslationEnvironment(
      dir,
      manifest.revision,
      manifest.requirementsSha256,
    );
    verifiedRuntime.set(dir, Date.now());
    const environment: EnvStatus = {
      status: "ready",
      venvDir: dir,
      pythonBin,
      pdf2zhBin,
    };
    return { action, environment, revision: manifest.revision };
  } catch (err) {
    try {
      await IOUtils.remove(dir, { recursive: true });
    } catch {
      // Preserve the original failure; an incomplete staging directory is inert.
    }
    throw err;
  }
}

/** A fixed Install/Update button checks first and only changes the environment when needed. */
export function installOrUpdateTranslationEnvironment(
  onProgress: (step: string, detail: string) => void,
): Promise<TranslationEnvUpdateResult> {
  if (updateInProgress) return updateInProgress;
  updateInProgress = (async (): Promise<TranslationEnvUpdateResult> => {
    onProgress("check", "Checking translation environment updates...");
    const { catalog, warning } = await getTargetCatalog(true);
    if (warning) onProgress("check", `Online check unavailable: ${warning}`);
    const inspection = await inspectWithCatalog(catalog, warning, true);
    if (inspection.action === "current") {
      return {
        action: "current",
        environment: inspection.environment,
        revision: Math.max(
          inspection.installedRevision || 0,
          catalog.manifest.revision,
        ),
      };
    }
    return installWithCatalog(catalog, inspection.action, onProgress);
  })().finally(() => {
    updateInProgress = null;
  });
  return updateInProgress;
}
