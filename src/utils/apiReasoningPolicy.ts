import {
  getApiReasoningSupport,
  rejectApiReasoningSupport,
  resolveReasoningEffort,
  type ApiReasoningWire,
} from "./reasoningEffort";
import { parseHttpStatusFromErrorMessage } from "./transientRetry";

/** One policy per logical request, shared by fetch and Gecko XHR retries. */
export class ApiReasoningPolicy {
  private rejected = false;
  private readonly effort?: string;
  private readonly wire?: ApiReasoningWire;

  constructor(
    private readonly context: {
      apiBase: string;
      apiKey: string;
      model: string;
      selected?: string;
      useResponses: boolean;
    },
  ) {
    const support = getApiReasoningSupport(
      context.apiBase,
      context.model,
      context.apiKey,
    );
    // No request-level selection means no intervention (e.g. auxiliary calls).
    this.effort = context.selected
      ? resolveReasoningEffort(
          context.selected,
          support.efforts,
          support.defaultEffort,
        )
      : undefined;
    this.wire = context.useResponses
      ? support.wire === "verbosity"
        ? undefined
        : support.wire && "reasoning"
      : support.wire;
  }

  apply(payload: Record<string, unknown>): Record<string, unknown> {
    if (this.rejected || !this.effort || !this.wire) return payload;
    return {
      ...payload,
      [this.wire]:
        this.wire === "reasoning" ? { effort: this.effort } : this.effort,
    };
  }

  /** Only explicit parameter rejection, never auth/rate-limit/network/abort errors. */
  recover(error: unknown): boolean {
    if (this.rejected || !this.effort || !this.wire) return false;
    const message = error instanceof Error ? error.message : String(error);
    const status = parseHttpStatusFromErrorMessage(message);
    if (status !== 400 && status !== 422) return false;
    let detail = message;
    let parameterMatches = false;
    try {
      const parsed = JSON.parse(message.slice(message.indexOf("{")));
      const err = parsed.error || parsed;
      if (typeof err.param === "string") {
        parameterMatches =
          err.param === this.wire ||
          (this.wire === "reasoning" && err.param === "reasoning.effort");
        if (!parameterMatches) return false;
      }
      if (typeof err.message === "string") detail = err.message;
    } catch {
      /* Some services return plain text errors. */
    }
    const text = detail.toLowerCase();
    if (
      !parameterMatches &&
      /temperature|max_tokens|max_completion_tokens|max_output_tokens/.test(
        text,
      )
    )
      return false;
    const field =
      this.wire === "reasoning"
        ? /\breasoning\b|\breasoning\.effort\b/
        : new RegExp(`\\b${this.wire}\\b`);
    if (
      (!parameterMatches && !field.test(text)) ||
      !/unsupported|not supported|not allowed|unknown|unrecognized|invalid|allowed values|must be|extra (?:inputs|fields).*not permitted/.test(
        text,
      )
    )
      return false;
    this.rejected = true;
    rejectApiReasoningSupport(
      this.context.apiBase,
      this.context.model,
      this.context.apiKey,
    );
    return true;
  }
}
