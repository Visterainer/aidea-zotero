/* ---------------------------------------------------------------------------
 * pdfTranslator/processRunner.ts  –  Launch and manage pdf2zh_next subprocess
 *
 * Wraps Gecko nsIProcess for starting/killing the bridge script.
 * On Windows, startHidden prevents command prompt windows from appearing.
 * -------------------------------------------------------------------------*/

const IS_WIN_PROC =
  (typeof Zotero !== "undefined" && Zotero.isWin) ||
  (typeof navigator !== "undefined" && /win/i.test(navigator.platform));

declare const Services: any;

export interface RunningProcess {
  /** Kill the subprocess tree */
  kill(): void;
  /** Promise that resolves with exit code when the process terminates */
  done: Promise<number>;
}

/**
 * Launch a process asynchronously.
 *
 * @param exe   absolute path to the executable (python, etc.)
 * @param args  command-line arguments
 * @returns     handle with kill() and a completion promise
 */
function killPosixProcessGroup(pid: number): void {
  try {
    const file = (Components.classes as any)[
      "@mozilla.org/file/local;1"
    ].createInstance((Components.interfaces as any).nsIFile);
    file.initWithPath("/bin/kill");
    const killer = (Components.classes as any)[
      "@mozilla.org/process/util;1"
    ].createInstance((Components.interfaces as any).nsIProcess);
    killer.init(file);
    const args = ["-KILL", "--", `-${Math.floor(pid)}`];
    killer.run(true, args, args.length);
  } catch {
    /* fall back to killing the bridge alone */
  }
}

let runningProcessCount = 0;

/** True while any bridge process launched from here has not exited. */
export function hasRunningProcess(): boolean {
  return runningProcessCount > 0;
}

export function launchProcess(exe: string, args: string[]): RunningProcess {
  const file = (Components.classes as any)[
    "@mozilla.org/file/local;1"
  ].createInstance((Components.interfaces as any).nsIFile);
  file.initWithPath(exe);

  const proc = (Components.classes as any)[
    "@mozilla.org/process/util;1"
  ].createInstance((Components.interfaces as any).nsIProcess);
  proc.init(file);

  // Suppress terminal window on Windows
  if (IS_WIN_PROC) {
    try {
      proc.startHidden = true;
    } catch {
      /* older Gecko may not support */
    }
    try {
      proc.noShell = true;
    } catch {
      /* best effort */
    }
  }

  const done = new Promise<number>((resolve, reject) => {
    const observer = {
      observe(_subject: unknown, topic: string) {
        if (topic === "process-finished" || topic === "process-failed") {
          // Gecko also reports a child that started and exited nonzero as
          // process-failed. Let the caller inspect its final progress file.
          const exitCode = proc.exitValue;
          if (typeof exitCode === "number" && Number.isFinite(exitCode))
            resolve(exitCode);
          else reject(new Error(`Process failed to start: ${exe}`));
        }
      },
    };
    // runwAsync passes UTF-16 arguments; runAsync narrows each character
    // to one byte and corrupts non-ASCII paths (e.g. C:\\Users\\张三).
    if (typeof proc.runwAsync === "function") {
      proc.runwAsync(args, args.length, observer);
    } else {
      proc.runAsync(args, args.length, observer);
    }
  });
  runningProcessCount++;
  const release = () => {
    runningProcessCount--;
  };
  done.then(release, release);

  return {
    kill() {
      const pid = Number((proc as any).pid || 0);
      if (IS_WIN_PROC && pid > 0 && killWindowsProcessTree(pid)) return;
      // The bridge leads its own process group, so signalling the group
      // also stops the translation engine and its workers; killing only the
      // bridge would orphan them.
      if (!IS_WIN_PROC && pid > 1) killPosixProcessGroup(pid);
      try {
        proc.kill();
      } catch {
        /* already dead */
      }
    },
    done,
  };
}

/**
 * nsIProcess.kill() only terminates the direct child on Windows. The bridge
 * launches pdf2zh_next, which then launches Python worker processes, so a
 * direct kill leaves those workers orphaned and disconnects them from the
 * temporary OAuth proxy. Use taskkill /T for an atomic best-effort tree stop.
 */
function killWindowsProcessTree(pid: number): boolean {
  try {
    const systemDir = Services.dirsvc.get(
      "SysD",
      (Components.interfaces as any).nsIFile,
    );
    const taskkillFile = systemDir.clone();
    taskkillFile.append("taskkill.exe");
    if (!taskkillFile.exists()) return false;

    const killer = (Components.classes as any)[
      "@mozilla.org/process/util;1"
    ].createInstance((Components.interfaces as any).nsIProcess);
    killer.init(taskkillFile);
    try {
      killer.startHidden = true;
    } catch {
      /* older Gecko may not support */
    }
    try {
      killer.noShell = true;
    } catch {
      /* best effort */
    }

    const killArgs = ["/PID", String(pid), "/T", "/F"];
    killer.run(true, killArgs, killArgs.length);
    return Number(killer.exitValue) === 0;
  } catch {
    return false;
  }
}
