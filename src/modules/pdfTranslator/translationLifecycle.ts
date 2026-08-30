export interface PausedTranslationSession {
  isPaused: boolean;
  activeController: unknown;
}

/**
 * Resume a cached translation by starting a fresh bridge process.
 *
 * pdf2zh_next owns the page cache, so the paused controller itself cannot be
 * resumed after its process tree has been stopped. Clearing the old controller
 * before invoking restart also prevents the normal "already running" guard
 * from blocking the new bridge.
 */
export function restartPausedTranslation(
  session: PausedTranslationSession,
  restart: () => Promise<void>,
  onError: (error: unknown) => void,
): void {
  session.activeController = null;
  session.isPaused = false;
  void restart().catch(onError);
}
