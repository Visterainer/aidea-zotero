/* ---------------------------------------------------------------------------
 * pdfTranslator/progressPoller.ts  –  Poll progress.json written by bridge
 *
 * The bridge script writes progress to a JSON file on disk.
 * We poll it periodically and invoke a callback with parsed data.
 * -------------------------------------------------------------------------*/

import type { ProgressData } from "./types";

const DEFAULT_INTERVAL_MS = 500;

/** Minimal subset of IOUtils we need (Gecko global) */
declare const IOUtils: {
  readUTF8(path: string): Promise<string>;
  exists(path: string): Promise<boolean>;
};

export class ProgressPoller {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private filePath: string,
    private callback: (data: ProgressData) => void,
    private intervalMs: number = DEFAULT_INTERVAL_MS,
  ) {}

  start(): void {
    if (this.timer) return;                       // already running
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /** Single poll cycle — public so tests can invoke it directly */
  async tick(): Promise<void> {
    try {
      const exists = await IOUtils.exists(this.filePath);
      if (!exists) return;                       // file not created yet

      const text = await IOUtils.readUTF8(this.filePath);
      if (!text.trim()) return;                  // empty / being written

      const data = JSON.parse(text) as ProgressData;
      this.callback(data);

      if (data.status === "done" || data.status === "error") {
        this.stop();                             // auto-stop on terminal state
      }
    } catch {
      // File may be mid-write (atomic replace not yet visible).
      // Silently retry on next tick.
    }
  }
}
