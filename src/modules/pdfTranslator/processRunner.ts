/* ---------------------------------------------------------------------------
 * pdfTranslator/processRunner.ts  –  Launch and manage pdf2zh_next subprocess
 *
 * Wraps Gecko nsIProcess for starting/killing the bridge script.
 * -------------------------------------------------------------------------*/

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
  const file = (Components.classes as any)["@mozilla.org/file/local;1"]
    .createInstance((Components.interfaces as any).nsIFile);
  file.initWithPath(exe);

  const proc = (Components.classes as any)["@mozilla.org/process/util;1"]
    .createInstance((Components.interfaces as any).nsIProcess);
  proc.init(file);

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
      try { proc.kill(); } catch { /* already dead */ }
    },
    done,
  };
}
