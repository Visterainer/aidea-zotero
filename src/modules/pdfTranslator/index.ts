/* ---------------------------------------------------------------------------
 * pdfTranslator/index.ts  –  Translation flow orchestrator
 *
 * Coordinates:  envManager → configWriter → processRunner → progressPoller
 * -------------------------------------------------------------------------*/

import type {
  TranslateParams,
  TranslateState,
  ProgressData,
} from "./types";
import { checkEnvironment, installEnvironment } from "./envManager";
import { generateConfigToml, generateTaskJson } from "./configWriter";
import { launchProcess, type RunningProcess } from "./processRunner";
import { ProgressPoller } from "./progressPoller";

/** Callback signature for UI updates */
export type TranslateUICallback = (event: TranslateEvent) => void;

export type TranslateEvent =
  | { type: "state"; state: TranslateState }
  | { type: "progress"; data: ProgressData }
  | { type: "env_progress"; step: string; detail: string }
  | { type: "error"; message: string };

/**
 * TranslateController  –  manages the lifecycle of a single translation job.
 *
 * Usage:
 *   const ctrl = new TranslateController(uiCallback);
 *   await ctrl.start(params);   // kicks off translation
 *   ctrl.pause();               // kills subprocess
 *   await ctrl.start(params);   // resumes (pdf2zh_next cached pages)
 *   ctrl.clearCache(dir);
 */
export class TranslateController {
  private state: TranslateState = "idle";
  private process: RunningProcess | null = null;
  private poller: ProgressPoller | null = null;

  constructor(private callback: TranslateUICallback) {}

  getState(): TranslateState {
    return this.state;
  }

  /* ── Install environment ── */

  async setupEnv(): Promise<void> {
    this.setState("running");
    try {
      await installEnvironment((step, detail) => {
        this.callback({ type: "env_progress", step, detail });
      });
      this.setState("idle");
    } catch (err) {
      this.setState("error");
      this.callback({
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /* ── Start / resume translation ── */

  async start(
    params: TranslateParams,
    oauthToken: string,
    apiUrl: string,
  ): Promise<void> {
    /* 1. Check environment */
    const env = await checkEnvironment();
    if (env.status !== "ready") {
      this.callback({ type: "error", message: `Environment not ready: ${env.status}` });
      return;
    }

    /* 2. Temp file paths */
    const tmpDir = PathUtils.join(PathUtils.tempDir, "aidea-translate");
    await IOUtils.makeDirectory(tmpDir, { ignoreExisting: true });

    const configPath = PathUtils.join(tmpDir, "config.toml");
    const taskPath   = PathUtils.join(tmpDir, "task.json");
    const progressPath = PathUtils.join(tmpDir, "progress.json");

    /* 3. Write config.toml with OAuth token */
    const toml = generateConfigToml({
      model: params.modelId,
      apiKey: oauthToken,
      apiUrl,
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      qps: params.qps ?? 10,
      noDual: !params.generateDual,
      noMono: !params.generateMono,
    });
    await IOUtils.writeUTF8(configPath, toml);

    /* 4. Write task.json */
    const taskJson = generateTaskJson({
      pdf2zhBin: env.pdf2zhBin,
      pdfPath: params.pdfPath,
      outputDir: params.outputDir,
      configFile: configPath,
      progressFile: progressPath,
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      noDual: !params.generateDual,
      noMono: !params.generateMono,
      qps: params.qps ?? 10,
    });
    await IOUtils.writeUTF8(taskPath, taskJson);

    /* 5. Clean stale progress file */
    try { await IOUtils.remove(progressPath); } catch { /* ok */ }

    /* 6. Find bridge script */
    const bridgePath = this.getBridgeScriptPath();

    /* 7. Launch bridge subprocess */
    this.setState("running");
    this.process = launchProcess(env.pythonBin, [bridgePath, taskPath]);

    /* 8. Start progress poller */
    this.poller = new ProgressPoller(progressPath, (data) => {
      this.callback({ type: "progress", data });
      if (data.status === "done") this.setState("done");
      if (data.status === "error") this.setState("error");
    });
    this.poller.start();

    /* 9. Handle process completion */
    try {
      const exitCode = await this.process.done;
      if (exitCode !== 0 && this.state === "running") {
        this.setState("error");
        this.callback({
          type: "error",
          message: `Bridge process exited with code ${exitCode}`,
        });
      }
    } catch (err) {
      if (this.state === "running") {
        this.setState("error");
        this.callback({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      this.poller?.stop();
      this.process = null;
    }
  }

  /* ── Pause (kill subprocess) ── */

  pause(): void {
    if (this.state !== "running") return;
    this.process?.kill();
    this.poller?.stop();
    this.process = null;
    this.setState("paused");
  }

  /* ── Clear output cache ── */

  async clearCache(outputDir: string): Promise<void> {
    try {
      await IOUtils.remove(outputDir, { recursive: true });
    } catch { /* directory may not exist */ }
    this.setState("idle");
  }

  /* ── Internals ── */

  private setState(s: TranslateState): void {
    this.state = s;
    this.callback({ type: "state", state: s });
  }

  /** Resolve path to addon/scripts/aidea_bridge.py */
  private getBridgeScriptPath(): string {
    // In Zotero plugin context, rootURI points to the addon directory
    const uri = (typeof globalThis !== "undefined" && (globalThis as any).rootURI)
      ? String((globalThis as any).rootURI)
      : "";
    // Convert file:/// URI to native path
    const sep = (Zotero as any).isWin ? "\\" : "/";
    const addonDir = uri.replace(/^file:\/\/\//, "").replace(/\//g, sep);
    return PathUtils.join(addonDir, "scripts", "aidea_bridge.py");
  }
}
