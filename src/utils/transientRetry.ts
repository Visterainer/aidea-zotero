export const RETRYABLE_TRANSIENT_STATUS_CODES = new Set([
  408,
  409,
  425,
  429,
  500,
  502,
  503,
  504,
]);

const RETRYABLE_TRANSIENT_MESSAGE_FRAGMENTS = [
  "unexpected_eof_while_reading",
  "eof occurred in violation of protocol",
  "remote end closed connection without response",
  "connection reset by peer",
  "connection reset",
  "connection aborted",
  "network error",
  "temporarily unavailable",
  "tlsv1 alert",
  "sslv3 alert",
  "timed out",
  "timeout",
];

export function parseHttpStatusFromErrorMessage(message: string): number | null {
  const trimmed = String(message || "").trim();
  const direct = trimmed.match(/^(\d{3})\b/);
  if (direct) {
    const value = Number.parseInt(direct[1], 10);
    if (Number.isFinite(value)) return value;
  }
  const embedded = trimmed.match(/\bHTTP\s+(\d{3})\b/i);
  if (!embedded) return null;
  const value = Number.parseInt(embedded[1], 10);
  return Number.isFinite(value) ? value : null;
}

export function isRetryableTransientStatus(status: number): boolean {
  return RETRYABLE_TRANSIENT_STATUS_CODES.has(status);
}

export function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === "AbortError";
  if (error instanceof Error) return error.name === "AbortError";
  return String(error || "").includes("AbortError");
}

export function isRetryableTransientErrorMessage(message: string): boolean {
  const text = String(message || "").toLowerCase();
  return RETRYABLE_TRANSIENT_MESSAGE_FRAGMENTS.some((fragment) =>
    text.includes(fragment),
  );
}

export function isRetryableTransientError(error: unknown): boolean {
  if (isAbortLikeError(error)) return false;
  const message =
    error instanceof Error
      ? String(error.message || "")
      : String(error || "");
  const status = parseHttpStatusFromErrorMessage(message);
  if (typeof status === "number" && isRetryableTransientStatus(status)) {
    return true;
  }
  return isRetryableTransientErrorMessage(message);
}

async function delayWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  if (!ms || ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    if (signal) {
      if (signal.aborted) {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

export async function withTransientRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterMs?: number;
    signal?: AbortSignal;
    shouldRetryError?: (error: unknown) => boolean;
    onRetry?: (info: {
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      error: unknown;
    }) => void;
  },
): Promise<T> {
  const maxAttempts = Math.max(1, opts?.maxAttempts ?? 4);
  const baseDelayMs = Math.max(0, opts?.baseDelayMs ?? 800);
  const maxDelayMs = Math.max(baseDelayMs, opts?.maxDelayMs ?? 4000);
  const jitterMs = Math.max(0, opts?.jitterMs ?? 250);
  const shouldRetryError = opts?.shouldRetryError ?? isRetryableTransientError;

  let attempt = 1;
  while (true) {
    if (opts?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    try {
      return await fn(attempt);
    } catch (error) {
      if (
        attempt >= maxAttempts ||
        !shouldRetryError(error) ||
        isAbortLikeError(error)
      ) {
        throw error;
      }
      const exponentialDelay = Math.min(
        baseDelayMs * 2 ** (attempt - 1),
        maxDelayMs,
      );
      const delayMs = exponentialDelay + Math.random() * jitterMs;
      opts?.onRetry?.({
        attempt,
        maxAttempts,
        delayMs,
        error,
      });
      await delayWithSignal(delayMs, opts?.signal);
      attempt += 1;
    }
  }
}

export async function fetchWithTransientRetry(
  fetchImpl: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  opts?: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    jitterMs?: number;
    signal?: AbortSignal;
    onRetry?: (info: {
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      error: unknown;
    }) => void;
  },
): Promise<Response> {
  return withTransientRetry(
    async () => {
      const response = await fetchImpl(input, init);
      if (!isRetryableTransientStatus(response.status)) {
        return response;
      }
      const retryBody = await response.clone().text().catch(() => "");
      throw new Error(
        `${response.status} ${response.statusText}${
          retryBody ? ` - ${retryBody.slice(0, 400)}` : ""
        }`,
      );
    },
    {
      ...opts,
      signal: opts?.signal ?? init?.signal ?? undefined,
    },
  );
}
