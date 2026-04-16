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
import type { TranslateCredentials } from "./modelResolver";
import { checkEnvironment, installEnvironment } from "./envManager";
import { generateConfigToml, generateTaskJson } from "./configWriter";
import { launchProcess, type RunningProcess } from "./processRunner";
import { ProgressPoller } from "./progressPoller";

declare const Services: any;
declare const rootURI: string | undefined;

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
    credentials: TranslateCredentials,
  ): Promise<void> {
    /* 1. Check environment */
    const env = await checkEnvironment();
    if (env.status !== "ready") {
      this.callback({ type: "error", message: `Environment not ready: ${env.status}` });
      return;
    }

    /* 2. Temp file paths */
    const tempDir = String(PathUtils.tempDir || "").trim();
    if (!tempDir) {
      throw new Error("Cannot resolve temporary directory (PathUtils.tempDir is empty)");
    }
    const tmpDir = PathUtils.join(tempDir, "aidea-translate");
    await IOUtils.makeDirectory(tmpDir, { ignoreExisting: true });

    const configPath = PathUtils.join(tmpDir, "config.toml");
    const taskPath   = PathUtils.join(tmpDir, "task.json");
    const progressPath = PathUtils.join(tmpDir, "progress.json");

    /* 3. Write config.toml with OAuth token */
    const toml = generateConfigToml({
      model: params.modelId,
      apiKey: credentials.apiKey,
      apiUrl: credentials.apiUrl,
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      qps: params.qps ?? 10,
      noDual: !params.generateDual,
      noMono: !params.generateMono,
      disableRichTextTranslate: params.disableRichTextTranslate,
      enhanceCompatibility: params.enhanceCompatibility,
      translateTableText: params.translateTableText,
      fontFamily: params.fontFamily,
      ocr: params.ocr,
      autoOcr: params.autoOcr,
      saveGlossary: params.saveGlossary,
      disableGlossary: params.disableGlossary,
      dualMode: params.dualMode,
      transFirst: params.transFirst,
      skipClean: params.skipClean,
      noWatermark: params.noWatermark,
    });
    await IOUtils.writeUTF8(configPath, toml);

    /* 4. Write task.json */
    const taskJson = generateTaskJson({
      pdf2zhBin: env.pdf2zhBin,
      pdfPath: params.pdfPath,
      outputDir: params.outputDir,
      configFile: configPath,
      progressFile: progressPath,
      modelId: params.modelId,
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      noDual: !params.generateDual,
      noMono: !params.generateMono,
      qps: params.qps ?? 10,
      poolMaxWorker: params.poolMaxWorker ?? 1,
      disableRichTextTranslate: params.disableRichTextTranslate,
      enhanceCompatibility: params.enhanceCompatibility,
      translateTableText: params.translateTableText,
      fontFamily: params.fontFamily,
      ocr: params.ocr,
      autoOcr: params.autoOcr,
      saveGlossary: params.saveGlossary,
      disableGlossary: params.disableGlossary,
      dualMode: params.dualMode,
      transFirst: params.transFirst,
      skipClean: params.skipClean,
      noWatermark: params.noWatermark,
      skipReferencesAuto: params.skipReferencesAuto,
      keepAppendixTranslated: params.keepAppendixTranslated,
      protectAuthorBlock: params.protectAuthorBlock,
      oauthProxy: credentials.oauthProxy,
    });
    await IOUtils.writeUTF8(taskPath, taskJson);

    /* 5. Clean stale progress file */
    try { await IOUtils.remove(progressPath); } catch { /* ok */ }

    /* 6. Find bridge script */
    const bridgePath = this.getBridgeScriptPath(tmpDir);
    this.callback({
      type: "env_progress",
      step: "bridge",
      detail: `Bridge script: ${bridgePath}`,
    });

    /* 7. Launch bridge subprocess */
    this.setState("running");
    this.process = launchProcess(env.pythonBin, [bridgePath, taskPath]);

    /* 8. Start progress poller */
    this.poller = new ProgressPoller(progressPath, (data) => {
      this.callback({ type: "progress", data });
      if (data.status === "done") this.setState("done");
      if (data.status === "error") {
        this.setState("error");
        const detail = (data.errorDetail || "").trim();
        const logHint = data.logFile ? ` (log: ${data.logFile})` : "";
        const message = detail
          ? `${data.message}\n${detail}${logHint}`
          : `${data.message}${logHint}`;
        this.callback({ type: "error", message });
      }
    });
    this.poller.start();

    /* 9. Handle process completion */
    try {
      const exitCode = await this.process.done;
      // Give poller one final tick to read the "done" status from progress.json
      if (this.poller) {
        try { await this.poller.tick(); } catch { /* ok */ }
      }
      if (exitCode === 0 && this.state === "running") {
        // Poller didn't catch it — force done
        this.setState("done");
      } else if (exitCode !== 0 && this.state === "running") {
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
  private getBridgeScriptPath(stageDir: string): string {
    const rootUris = this.getAddonRootUriCandidates();
    const candidates = this.getAddonDirCandidates(rootUris);
    for (const addonDir of candidates) {
      const bridgePath = this.tryJoin(addonDir, "scripts", "aidea_bridge.py");
      if (!bridgePath) continue;
      if (this.fileExists(bridgePath)) return bridgePath;
    }

    for (const root of rootUris) {
      const extracted = this.extractBridgeFromJarRootUri(root, stageDir);
      if (extracted && this.fileExists(extracted)) return extracted;
    }

    throw new Error(
      "Cannot resolve bridge script path (aidea_bridge.py). " +
      "Addon root URI/path is unavailable in current runtime context.",
    );
  }

  private getAddonRootUriCandidates(): string[] {
    const uris = [
      this.asNonEmptyString((globalThis as any)?.rootURI),
      this.asNonEmptyString((globalThis as any)?._globalThis?.rootURI),
      this.asNonEmptyString(typeof rootURI !== "undefined" ? rootURI : ""),
    ].filter(Boolean);

    const out: string[] = [];
    const seen = new Set<string>();
    for (const uri of uris) {
      const key = uri.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }

  private getAddonDirCandidates(rootUris: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const uri of rootUris) {
      const path = this.uriOrPathToNativePath(uri);
      if (!path) continue;
      if (seen.has(path)) continue;
      seen.add(path);
      out.push(path);
    }
    return out;
  }

  private tryJoin(base: string, ...segments: string[]): string {
    try {
      return PathUtils.join(base, ...segments);
    } catch {
      return "";
    }
  }

  private extractBridgeFromJarRootUri(rootUri: string, stageDir: string): string {
    const raw = this.asNonEmptyString(rootUri);
    if (!raw || !raw.startsWith("jar:")) return "";

    try {
      const Ci = (Components.interfaces as any);
      const Cc = (Components.classes as any);
      const uri = Services.io.newURI(raw);
      const jarUri = uri.QueryInterface(Ci.nsIJARURI);
      const jarFileUri = jarUri.JARFile.QueryInterface(Ci.nsIFileURL);
      const jarFile = jarFileUri.file;
      if (!jarFile?.exists?.()) return "";

      const jarRoot = String(jarUri.JAREntry || "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");
      const bridgeEntry = [jarRoot, "scripts", "aidea_bridge.py"]
        .filter(Boolean)
        .join("/");

      const zipReader = Cc["@mozilla.org/libjar/zip-reader;1"]
        .createInstance(Ci.nsIZipReader);
      zipReader.open(jarFile);
      try {
        if (!zipReader.hasEntry(bridgeEntry)) return "";

        const outPath = this.tryJoin(stageDir, "aidea_bridge.py");
        if (!outPath) return "";
        const outFile = Cc["@mozilla.org/file/local;1"]
          .createInstance(Ci.nsIFile);
        outFile.initWithPath(outPath);
        if (outFile.exists()) {
          try { outFile.remove(false); } catch { /* ignore */ }
        }
        zipReader.extract(bridgeEntry, outFile);
        return outPath;
      } finally {
        try { zipReader.close(); } catch { /* ignore */ }
      }
    } catch {
      return "";
    }
  }

  private asNonEmptyString(value: unknown): string {
    const text = typeof value === "string" ? value.trim() : "";
    return text;
  }

  private uriOrPathToNativePath(value: string): string {
    const raw = this.asNonEmptyString(value);
    if (!raw) return "";
    const isWin = Boolean((Zotero as any).isWin);

    // Native Windows path, e.g. C:\...
    if (isWin && /^[A-Za-z]:[\\/]/.test(raw)) {
      return raw.replace(/\//g, "\\");
    }

    // UNC path on Windows.
    if (isWin && raw.startsWith("\\\\")) {
      return raw;
    }

    // Non-file URI schemes are not local paths (e.g. jar:, chrome:).
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !raw.startsWith("file://")) {
      return "";
    }

    // file:///C:/... or file:///home/...
    if (raw.startsWith("file://")) {
      let noScheme = raw.replace(/^file:\/\//i, "");
      if (isWin) {
        noScheme = noScheme.replace(/^localhost\//i, "");
        noScheme = noScheme.replace(/^\/+/, "");
      } else {
        if (noScheme.startsWith("localhost/")) {
          noScheme = noScheme.slice("localhost".length);
        }
        if (!noScheme.startsWith("/")) {
          noScheme = `/${noScheme}`;
        }
      }

      const decoded = decodeURIComponent(noScheme);
      if (isWin) {
        if (!/^[A-Za-z]:[\\/]/.test(decoded)) return "";
        return decoded.replace(/\//g, "\\");
      }
      return decoded.replace(/\/+/g, "/");
    }

    // Already a native absolute path.
    if (isWin) return raw.replace(/\//g, "\\");
    return raw;
  }

  private fileExists(path: string): boolean {
    try {
      const file = (Components.classes as any)["@mozilla.org/file/local;1"]
        .createInstance((Components.interfaces as any).nsIFile);
      file.initWithPath(path);
      return Boolean(file.exists());
    } catch {
      return false;
    }
  }
}
