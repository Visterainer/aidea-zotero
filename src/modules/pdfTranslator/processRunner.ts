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
        if (topic === "process-finished") {
          resolve(proc.exitValue);
        } else if (topic === "process-failed") {
          reject(new Error(`Process failed to start: ${exe}`));
        }
      },
    };
    proc.runAsync(args, args.length, observer);
  });

  return {
    kill() {
      const pid = Number((proc as any).pid || 0);
      if (IS_WIN_PROC && pid > 0 && killWindowsProcessTree(pid)) return;
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
