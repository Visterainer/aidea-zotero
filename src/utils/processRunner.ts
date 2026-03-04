export type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type ZoteroExecResult = string | { stdout?: string; stderr?: string; code?: number; exitCode?: number };

declare const Zotero: any;

declare const Components: any;
declare const ztoolkit: any;

declare const Ci: any;

declare const Cc: any;

function normalizeExecResult(result: ZoteroExecResult): ExecResult {
  if (typeof result === "string") {
    return { code: 0, stdout: result, stderr: "" };
  }
  const code =
    typeof (result as any)?.code === "number"
      ? Number((result as any).code)
      : typeof (result as any)?.exitCode === "number"
        ? Number((result as any).exitCode)
        : 0;
  return {
    code: Number.isFinite(code) ? code : 0,
    stdout: typeof (result as any)?.stdout === "string" ? (result as any).stdout : "",
    stderr: typeof (result as any)?.stderr === "string" ? (result as any).stderr : "",
  };
}

async function tryZoteroExec(command: string, args: string[]): Promise<ExecResult | null> {
  const execFn = Zotero?.Utilities?.Internal?.exec;
  if (typeof execFn !== "function") return null;
  try {
    const raw = (await execFn(command, args)) as ZoteroExecResult;
    return normalizeExecResult(raw);
  } catch (err) {
    ztoolkit?.log?.("AIdea: exec fallback", {
      command,
      args,
      error: String(err),
    });
    return null;
  }
}

function readFileTextSync(path: string): string {
  try {
    return String(Zotero.File.getContents(path) || "");
  } catch {
    return "";
  }
}

function makeTempFilePath(stem: string): string {
  const tempDir = Zotero.getTempDirectory?.();
  const dirPath = tempDir?.path || Zotero.DataDirectory?.dir || ".";
  const safeStem = (stem || "tmp").replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${dirPath}${dirPath.includes("\\") ? "\\" : "/"}${safeStem}-${Date.now()}-${Math.random().toString(16).slice(2)}.log`;
}

function removeFile(path: string): void {
  try {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    if (file.exists()) file.remove(false);
  } catch {
    // ignore
  }
}

function getPlatform(): "windows" | "macos" | "linux" {
  if (Zotero?.isWin) return "windows";
  if (Zotero?.isMac) return "macos";
  return "linux";
}

function shellWrap(command: string, stdoutPath: string, stderrPath: string): { exe: string; args: string[] } {
  const platform = getPlatform();
  if (platform === "windows") {
    const script = `${command} 1> \"${stdoutPath}\" 2> \"${stderrPath}\"`;
    return {
      exe: "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    };
  }
  const script = `${command} 1> '${stdoutPath.replace(/'/g, "'\\''")}' 2> '${stderrPath.replace(/'/g, "'\\''")}'`;
  return {
    exe: "/bin/bash",
    args: ["-lc", script],
  };
}

function runProcessAsync(exe: string, args: string[], hidden = false): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(exe);
      const proc = Cc["@mozilla.org/process/util;1"].createInstance(Ci.nsIProcess);
      proc.init(file);
      if (hidden) {
        try {
          proc.startHidden = true;
          proc.noShell = true;
        } catch {
          // older Gecko versions may not support these flags — ignore
        }
      }
      const observer = {
        observe(_subject: unknown, topic: string) {
          if (topic !== "process-finished" && topic !== "process-failed") return;
          const exitValue = typeof proc.exitValue === "number" ? proc.exitValue : 1;
          resolve(exitValue);
        },
      };
      proc.runAsync(args, args.length, observer);
    } catch (err) {
      reject(err);
    }
  });
}

export async function runShellCommand(command: string, options?: { hidden?: boolean }): Promise<ExecResult> {
  const platform = getPlatform();
  const hidden = options?.hidden ?? false;

  // When running hidden we skip the direct Zotero.Utilities.Internal.exec
  // path because it may still pop up a console window on Windows.
  if (!hidden) {
    const direct = await tryZoteroExec(platform === "windows" ? "powershell" : "/bin/bash", platform === "windows"
      ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command]
      : ["-lc", command]);
    if (direct) return direct;
  }

  const stdoutPath = makeTempFilePath("aidea-stdout");
  const stderrPath = makeTempFilePath("aidea-stderr");
  try {
    const wrapped = shellWrap(command, stdoutPath, stderrPath);
    const code = await runProcessAsync(wrapped.exe, wrapped.args, hidden);
    return {
      code,
      stdout: readFileTextSync(stdoutPath),
      stderr: readFileTextSync(stderrPath),
    };
  } finally {
    removeFile(stdoutPath);
    removeFile(stderrPath);
  }
}

export function escapeShellArg(value: string): string {
  const platform = getPlatform();
  if (platform === "windows") {
    return `'${String(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

export function currentPlatform(): "windows" | "macos" | "linux" {
  return getPlatform();
}
