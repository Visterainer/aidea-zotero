/* ---------------------------------------------------------------------------
 * pdfTranslator/translationJob.ts  –  UI-free translation job steps
 *
 * The Translate tab and the library context menu both start full-PDF
 * translations. This module holds the parts that do not touch any DOM:
 * resolving credentials, checking the environment, building the engine
 * parameters, tracking which jobs are running, and (for callers without their
 * own console) running one job from start to finish.
 * -------------------------------------------------------------------------*/

import {
  getApiReasoningSupport,
  getTranslateReasoningEffort,
  resolveRequestReasoningEffort,
} from "../../utils/reasoningEffort";
import type { TranslateEvent } from "./index";
import type { TranslateCredentials } from "./modelResolver";
import type { SavedTranslateOptions } from "./translatePrefs";
import type {
  EnvStatus,
  ProgressData,
  TranslateParams,
  TranslateState,
} from "./types";

type ReadyEnv = Extract<EnvStatus, { status: "ready" }>;

/* ── Engine parameters ── */

/** Build the engine parameters for one PDF from the saved tab options. */
export function buildTranslateParams(input: {
  pdfPath: string;
  outputDir: string;
  modelId: string;
  options: SavedTranslateOptions;
}): TranslateParams {
  const { options } = input;
  return {
    pdfPath: input.pdfPath,
    outputDir: input.outputDir,
    sourceLang: options.sourceLang,
    targetLang: options.targetLang,
    modelId: input.modelId,
    generateMono: options.generateMono,
    generateDual: options.generateDual,
    qps: options.qps,
    poolMaxWorker: options.poolMaxWorker,
    disableRichTextTranslate: options.disableRichTextTranslate,
    enhanceCompatibility: options.enhanceCompatibility,
    translateTableText: options.translateTableText,
    fontFamily: options.fontFamily,
    ocr: options.ocr,
    autoOcr: options.autoOcr,
    saveGlossary: options.saveGlossary,
    disableGlossary: options.disableGlossary,
    noWatermark: true,
    dualMode: "LR",
    transFirst: false, // LR mode: original left, translation right
    skipClean: false,
    skipReferencesAuto: options.skipReferencesAuto,
    keepAppendixTranslated: options.keepAppendixTranslated,
    protectAuthorBlock: options.protectAuthorBlock,
  };
}

/* ── Credentials ── */

export interface ResolvedTranslationCredentials {
  creds: TranslateCredentials;
  /** Human-readable auth mode for logs, e.g. "OAuth (openai-codex)". */
  authMode: string;
  /** Reasoning effort applied to the proxy config, or "" for the default. */
  reasoningEffort: string;
}

/**
 * Resolve credentials for the selected model and apply the saved translate
 * reasoning effort to the proxy config. Throws when the model has no usable
 * credentials.
 */
export async function resolveTranslationCredentials(
  modelName: string,
  providerId?: string,
): Promise<ResolvedTranslationCredentials> {
  const { resolveModelCredentialsOrThrow } = await import("./modelResolver");
  const creds = await resolveModelCredentialsOrThrow(
    modelName,
    providerId || undefined,
  );
  const authMode = creds.oauthProxy
    ? creds.oauthProxy.provider === "openai-compatible"
      ? "API Key (proxied)"
      : `OAuth (${creds.oauthProxy.provider})`
    : "API Key";
  let reasoningEffort = "";
  if (
    creds.oauthProxy?.provider === "openai-codex" ||
    creds.oauthProxy?.provider === "openai-compatible"
  ) {
    reasoningEffort =
      resolveRequestReasoningEffort(
        creds.oauthProxy.provider === "openai-codex"
          ? "oauth://openai-codex"
          : creds.oauthProxy.apiBase,
        creds.modelId,
        getTranslateReasoningEffort(),
        creds.oauthProxy.apiKey,
      ) || "";
    if (reasoningEffort) {
      creds.oauthProxy.reasoningEffort = reasoningEffort;
      if (creds.oauthProxy.provider === "openai-compatible") {
        creds.oauthProxy.reasoningWire = getApiReasoningSupport(
          creds.oauthProxy.apiBase || "",
          creds.modelId,
          creds.oauthProxy.apiKey,
        ).wire;
      }
    }
  }
  return { creds, authMode, reasoningEffort };
}

/* ── Environment ── */

export type TranslationEnvironmentCheck =
  | { ok: true; env: ReadyEnv }
  | {
      ok: false;
      reason: "not_ready";
      status: string;
      diagnostics: string[];
    }
  | { ok: false; reason: "needs_repair"; detail: string };

/** Check that the Python environment exists and its runtime still works. */
export async function checkTranslationEnvironment(): Promise<TranslationEnvironmentCheck> {
  const { checkEnvironment } = await import("./envManager");
  const env = await checkEnvironment();
  if (env.status !== "ready") {
    return {
      ok: false,
      reason: "not_ready",
      status: env.status,
      diagnostics: env.diagnostics || [],
    };
  }
  const { verifyTranslationEnvironmentRuntime } =
    await import("./translationEnvUpdater");
  const runtime = await verifyTranslationEnvironmentRuntime(env);
  if (!runtime.ok) {
    return {
      ok: false,
      reason: "needs_repair",
      detail: runtime.detail || "unknown error",
    };
  }
  return { ok: true, env };
}

/* ── Running-job registry ── */

/** The part of `TranslateController` this module relies on. */
export interface TranslationControllerLike {
  getState(): TranslateState;
  start(
    params: TranslateParams,
    credentials: TranslateCredentials,
  ): Promise<void>;
  abort(): void;
}

const trackedControllers = new Set<
  Pick<TranslationControllerLike, "getState">
>();
let reservedJobs = 0;

/**
 * Register a controller so other entry points can see that it is running.
 * Controllers that are no longer running are dropped on the next query.
 */
export function trackTranslationController(
  controller: Pick<TranslationControllerLike, "getState">,
): void {
  trackedControllers.add(controller);
}

/**
 * Forget a controller whose `start` has returned or thrown. A launch failure
 * can leave a controller reporting "running" although nothing is running.
 */
export function untrackTranslationController(
  controller: Pick<TranslationControllerLike, "getState">,
): void {
  trackedControllers.delete(controller);
}

/** True while any tracked translation is running or being prepared. */
export function isTranslationRunning(): boolean {
  if (reservedJobs > 0) return true;
  let running = false;
  for (const controller of trackedControllers) {
    let state: TranslateState | "" = "";
    try {
      state = controller.getState();
    } catch {
      /* treat as finished */
    }
    if (state === "running") running = true;
    else trackedControllers.delete(controller);
  }
  return running;
}

/* ── One job from start to finish ── */

export interface TranslationJobRequest {
  pdfPath: string;
  outputDir: string;
  modelName: string;
  providerId?: string;
  options: SavedTranslateOptions;
}

export type TranslationJobBlockReason =
  "busy" | "no_model" | "credentials" | "env_not_ready" | "env_needs_repair";

export type TranslationJobOutcome =
  | {
      status: "done";
      /** Absolute paths of the PDFs the engine produced. */
      outputFiles: string[];
      progress: ProgressData | null;
    }
  | { status: "error"; message: string }
  | { status: "cancelled" }
  | { status: "blocked"; reason: TranslationJobBlockReason; detail: string };

export interface TranslationJobHandle {
  /** Stop the job. `done` then resolves with `{ status: "cancelled" }`. */
  cancel(): void;
  done: Promise<TranslationJobOutcome>;
}

export interface TranslationJobDeps {
  resolveCredentials: typeof resolveTranslationCredentials;
  checkEnvironment: typeof checkTranslationEnvironment;
  createController(
    callback: (event: TranslateEvent) => void,
  ): Promise<TranslationControllerLike> | TranslationControllerLike;
  joinPath(dir: string, name: string): string;
}

const defaultDeps: TranslationJobDeps = {
  resolveCredentials: resolveTranslationCredentials,
  checkEnvironment: checkTranslationEnvironment,
  async createController(callback) {
    const { TranslateController } = await import("./index");
    return new TranslateController(callback);
  },
  joinPath: (dir, name) => PathUtils.join(dir, name),
};

function isAbsolutePath(path: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.startsWith("\\\\") ||
    path.startsWith("/")
  );
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run a single translation without any panel UI. Refuses to start while
 * another tracked translation is running; every refusal and failure is
 * reported through the outcome rather than thrown.
 */
export function startTranslationJob(
  request: TranslationJobRequest,
  onEvent?: (event: TranslateEvent) => void,
  deps: TranslationJobDeps = defaultDeps,
): TranslationJobHandle {
  let cancelled = false;
  let controller: TranslationControllerLike | null = null;

  const blocked = (
    reason: TranslationJobBlockReason,
    detail = "",
  ): TranslationJobOutcome => ({ status: "blocked", reason, detail });

  const run = async (): Promise<TranslationJobOutcome> => {
    if (!request.modelName) return blocked("no_model");

    let resolved: ResolvedTranslationCredentials;
    try {
      resolved = await deps.resolveCredentials(
        request.modelName,
        request.providerId,
      );
    } catch (err) {
      return blocked("credentials", errorText(err));
    }
    if (cancelled) return { status: "cancelled" };

    const env = await deps.checkEnvironment();
    if (!env.ok) {
      return env.reason === "not_ready"
        ? blocked("env_not_ready", [env.status, ...env.diagnostics].join("\n"))
        : blocked("env_needs_repair", env.detail);
    }
    if (cancelled) return { status: "cancelled" };

    let lastError = "";
    let doneProgress: ProgressData | null = null;
    controller = await deps.createController((event) => {
      if (event.type === "error") lastError = event.message;
      if (event.type === "progress" && event.data.status === "done") {
        doneProgress = event.data;
      }
      try {
        onEvent?.(event);
      } catch {
        /* a listener failure must not break the job */
      }
    });
    trackTranslationController(controller);
    if (cancelled) return { status: "cancelled" };

    try {
      await controller.start(
        buildTranslateParams({
          pdfPath: request.pdfPath,
          outputDir: request.outputDir,
          modelId: resolved.creds.modelId,
          options: request.options,
        }),
        resolved.creds,
      );
    } catch (err) {
      if (cancelled) return { status: "cancelled" };
      return { status: "error", message: errorText(err) };
    } finally {
      untrackTranslationController(controller);
    }
    if (cancelled) return { status: "cancelled" };

    if (controller.getState() !== "done") {
      return {
        status: "error",
        message: lastError || "Translation did not finish",
      };
    }
    const names = (doneProgress as ProgressData | null)?.outputFiles || [];
    return {
      status: "done",
      outputFiles: names.map((name) =>
        isAbsolutePath(name) ? name : deps.joinPath(request.outputDir, name),
      ),
      progress: doneProgress,
    };
  };

  if (isTranslationRunning()) {
    return { cancel: () => undefined, done: Promise.resolve(blocked("busy")) };
  }

  reservedJobs += 1;
  const done = run()
    .catch((err): TranslationJobOutcome => ({
      status: "error",
      message: errorText(err),
    }))
    .finally(() => {
      reservedJobs -= 1;
    });

  return {
    cancel() {
      cancelled = true;
      try {
        controller?.abort();
      } catch {
        /* ignore */
      }
    },
    done,
  };
}
