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

let owner: symbol | null = null;

/** Acquire before the first await; release in finally, after start has settled. */
export function tryReserveTranslation(): (() => void) | null {
  if (owner !== null) return null;
  const token = Symbol();
  owner = token;
  return () => {
    if (owner === token) owner = null;
  };
}

export function isTranslationRunning(): boolean {
  return owner !== null;
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

  const abortController = () => {
    // The running event fires just before launchProcess installs its handle.
    // Even a cancel from that event's listener must wait for the handle.
    void Promise.resolve().then(() => {
      try {
        controller?.abort();
      } catch {
        /* keep the reservation until start actually returns */
      }
    });
  };

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
      if (cancelled) {
        // If cancellation met an idle controller still preparing, don't let
        // a subsequent launch escape it.
        if (event.type === "state" && event.state === "running")
          abortController();
        return;
      }
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
    if (cancelled) return { status: "cancelled" };

    await controller.start(
      buildTranslateParams({
        pdfPath: request.pdfPath,
        outputDir: request.outputDir,
        modelId: resolved.creds.modelId,
        options: request.options,
      }),
      resolved.creds,
    );
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

  const release = tryReserveTranslation();
  if (!release) {
    return { cancel: () => undefined, done: Promise.resolve(blocked("busy")) };
  }

  const done = run()
    .catch((err): TranslationJobOutcome => ({
      status: "error",
      message: errorText(err),
    }))
    .then((outcome): TranslationJobOutcome =>
      cancelled ? { status: "cancelled" } : outcome,
    )
    .finally(release);

  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      abortController();
    },
    done,
  };
}
