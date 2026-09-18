/** Conservative estimates, not provider tokenizer counts. */
export function estimateTokens(text: string): number {
  let units = 0;
  for (const ch of text)
    units += /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/u.test(ch)
      ? 1.5
      : ch.codePointAt(0)! > 127
        ? 1
        : 0.3;
  return Math.ceil(units);
}

export function sliceToTokens(text: string, limit: number): string {
  if (limit <= 0) return "";
  if (estimateTokens(text) <= limit) return text;
  let low = 0,
    high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (estimateTokens(text.slice(0, mid)) <= limit) low = mid;
    else high = mid - 1;
  }
  return text.slice(0, low).replace(/[\uD800-\uDBFF]$/, "");
}

export function resolveInputBudget(
  contextWindow?: number,
  outputTokens = 4096,
) {
  const window =
    Number.isFinite(contextWindow) && contextWindow! >= 1024
      ? Math.floor(contextWindow!)
      : 32768;
  const output =
    Number.isFinite(outputTokens) && outputTokens > 0
      ? Math.floor(outputTokens)
      : 4096;
  return {
    contextWindow: window,
    inputTokens: Math.max(0, window - output - Math.ceil(window * 0.1)),
    outputTokens: output,
  };
}

export function historyTokens(
  history: { role: string; content: string | unknown[] }[],
): number {
  return history.reduce(
    (total, message) =>
      total +
      8 +
      estimateTokens(
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content),
      ),
    0,
  );
}

/** Keep complete recent user/assistant groups, never half a tool or answer. */
export function fitHistory<
  T extends { role: string; content: string | unknown[] },
>(history: T[], limit: number): T[] {
  let start = history.length;
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].role !== "user") continue;
    if (historyTokens(history.slice(index)) > limit) break;
    start = index;
  }
  return history.slice(start);
}
