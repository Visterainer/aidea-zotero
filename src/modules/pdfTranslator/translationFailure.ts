import type { QueuePauseKind } from "./translationQueue";
import type { ProgressData } from "./types";

/**
 * Decide whether a failed translation says something about the document or
 * about the setup. Setup failures would repeat for every remaining document,
 * so they pause the queue instead of burning through it.
 */
export function classifyFailure(message: string): QueuePauseKind | "document" {
  const text = String(message || "").toLowerCase();
  // Log records also contain page numbers, token counts and foo.py:429.
  // Only interpret a number as a status when the diagnostic identifies it.
  const status =
    /\b(?:http(?:\/\d(?:\.\d)?)?\s+|(?:status(?: code)?|error code)\s*[:=]?\s*)(401|403|429|502|503|504)\b/g;
  const codes = Array.from(text.matchAll(status), (match) => match[1]);
  if (
    codes.includes("429") ||
    /\bratelimiterror\b|\brate[-_ ]limit(?:ed|s|[_ ]exceeded|[_ ]reached)?\b|too many requests|insufficient_quota|quota exceeded|exceeded .*quota|usage limit/.test(
      text,
    )
  ) {
    return "rate_limit";
  }
  if (
    codes.includes("401") ||
    codes.includes("403") ||
    /unauthori[sz]ed|403 forbidden|authenticationerror|permissiondeniederror|invalid.{0,12}(api.?key|token|credentials)|not logged in|sign in again/.test(
      text,
    )
  ) {
    return "credentials";
  }
  if (
    codes.some((code) => ["502", "503", "504"].includes(code)) ||
    /networkerror|apiconnectionerror|apitimeouterror|urlopen error|econnrefused|econnreset|enotfound|etimedout|connection (refused|reset|error|aborted|timed out)|could not connect|failed to connect|cannot connect|name resolution|getaddrinfo|\bssl:|sslerror|certificate.verify|proxyerror|proxy connection|tunnel connection failed/.test(
      text,
    )
  ) {
    return "network";
  }
  return "document";
}

/** A PDF may be written even when every model request failed. Never file
 * such an output or overwrite the old copy. Generic logged errors remain
 * warnings: BabelDOC's fallback counter isn't a measure of translation loss. */
export function publicationBlocker(
  data: Pick<ProgressData, "errorLines"> | null | undefined,
): { kind: QueuePauseKind; detail: string } | null {
  for (const line of data?.errorLines || []) {
    const kind = classifyFailure(line);
    if (kind !== "document") return { kind, detail: line.slice(0, 500) };
  }
  return null;
}
