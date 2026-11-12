export type ExecResult = {
  code: number;
  stdout: string;
  stderr: string;
};

declare const Zotero: any;

declare const Components: any;
declare const ztoolkit: any;

declare const Ci: any;

declare const Cc: any;

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

function readEnv(name: string): string {
  try {
    const env = Cc["@mozilla.org/process/environment;1"].getService(
      Ci.nsIEnvironment,
    );
    return String(env.get(name) || "").trim();
  } catch {
    return "";
  }
}

/** Windows is not always installed in C:\\Windows. */
function getWindowsSystemRoot(): string {
  return (readEnv("SystemRoot") || readEnv("windir") || "C:\\Windows").replace(
    /[\\/]+$/,
    "",
  );
}

function fileExists(path: string): boolean {
  try {
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(path);
    return file.exists();
  } catch {
    return false;
  }
}

/** NixOS and some minimal systems have no /bin/bash. */
function resolveBashPath(): string {
  return (
    [
      "/bin/bash",
      "/usr/bin/bash",
      "/usr/local/bin/bash",
      "/run/current-system/sw/bin/bash",
    ].find(fileExists) || "/bin/bash"
  );
}

function getPlatform(): "windows" | "macos" | "linux" {
  if (Zotero?.isWin) return "windows";
  if (Zotero?.isMac) return "macos";
  return "linux";
}

function shellWrap(
  command: string,
  stdoutPath: string,
  stderrPath: string,
): { exe: string; args: string[] } {
  const platform = getPlatform();
  if (platform === "windows") {
    const script =
      `& { ${command} } 1> "${stdoutPath}" 2> "${stderrPath}"; ` +
      "$exitCode = if ($null -ne $global:LASTEXITCODE) { $global:LASTEXITCODE } elseif ($?) { 0 } else { 1 }; " +
      "exit $exitCode";
    return {
      exe: `${getWindowsSystemRoot()}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`,
      args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    };
  }
  // Group the command so the redirects cover every part of a pipeline or
  // `a || b` list, not only its last simple command.
  const script = `{ ${command}\n} 1> '${stdoutPath.replace(/'/g, "'\\''")}' 2> '${stderrPath.replace(/'/g, "'\\''")}'`;
  return {
    exe: resolveBashPath(),
    args: ["-lc", script],
  };
}

/** Best effort: stop the direct children of a wrapper shell (and on Windows its whole tree). */
function killChildProcesses(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 1) return;
  try {
    const windows = getPlatform() === "windows";
    const root = getWindowsSystemRoot();
    const exe = windows ? `${root}\\System32\\taskkill.exe` : "/bin/sh";
    const args = windows
      ? ["/PID", String(pid), "/T", "/F"]
      : ["-c", `pkill -KILL -P ${pid}`];
    const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
    file.initWithPath(exe);
    const killer = Cc["@mozilla.org/process/util;1"].createInstance(
      Ci.nsIProcess,
    );
    killer.init(file);
    try {
      killer.startHidden = true;
    } catch {
      // not supported on this Gecko
    }
    killer.run(true, args, args.length);
  } catch {
    // The wrapper is still killed by the caller.
  }
}

/** Exit code reported when a subprocess is killed for exceeding its timeout. */
export const PROCESS_TIMEOUT_EXIT_CODE = 124;

function runProcessAsync(
  exe: string,
  args: string[],
  hidden = false,
  timeoutMs = 0,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    const settle = (code: number) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      resolve(code);
    };
    try {
      const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(exe);
      const proc = Cc["@mozilla.org/process/util;1"].createInstance(
        Ci.nsIProcess,
      );
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
          if (topic !== "process-finished" && topic !== "process-failed")
            return;
          settle(typeof proc.exitValue === "number" ? proc.exitValue : 1);
        },
      };
      // runwAsync passes UTF-16 arguments; runAsync narrows each character
      // to one byte and corrupts non-ASCII paths (e.g. C:\\Users\\张三).
      if (typeof proc.runwAsync === "function") {
        proc.runwAsync(args, args.length, observer);
      } else {
        proc.runAsync(args, args.length, observer);
      }
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          // The command runs as a child of the wrapper shell; killing only
          // the shell would leave e.g. the installer running in the
          // background while the caller starts a second one.
          killChildProcesses(Number(proc.pid || 0));
          try {
            proc.kill();
          } catch {
            // already exited
          }
          settle(PROCESS_TIMEOUT_EXIT_CODE);
        }, timeoutMs);
      }
    } catch (err) {
      if (timer !== undefined) clearTimeout(timer);
      reject(err);
    }
  });
}

export async function runShellCommand(
  command: string,
  options?: {
    hidden?: boolean;
    /** Kill the process and return exit code 124 after this long; 0 = never. */
    timeoutMs?: number;
  },
): Promise<ExecResult> {
  const hidden = options?.hidden ?? false;
  const stdoutPath = makeTempFilePath("aidea-stdout");
  const stderrPath = makeTempFilePath("aidea-stderr");
  try {
    const wrapped = shellWrap(command, stdoutPath, stderrPath);
    const timeoutMs = options?.timeoutMs ?? 0;
    const code = await runProcessAsync(
      wrapped.exe,
      wrapped.args,
      hidden,
      timeoutMs,
    );
    const stderr = readFileTextSync(stderrPath);
    return {
      code,
      stdout: readFileTextSync(stdoutPath),
      stderr:
        code === PROCESS_TIMEOUT_EXIT_CODE && timeoutMs > 0
          ? [stderr.trim(), `Timed out after ${Math.round(timeoutMs / 1000)}s`]
              .filter(Boolean)
              .join("\n")
          : stderr,
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
