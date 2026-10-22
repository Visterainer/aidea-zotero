import { parseHttpStatusFromErrorMessage } from "./transientRetry";

export type ChatTokenField = "max_tokens" | "max_completion_tokens";
export type TokenPolicyContext = {
  /** Stable provider/configuration identity; never a credential. */
  provider: string;
  url: string;
  model: string;
};

const cache = new Map<string, ChatTokenField>();
const fields: ChatTokenField[] = ["max_tokens", "max_completion_tokens"];

export function modelUsesCompletionTokens(model: string): boolean {
  const name = model.trim().toLowerCase();
  const gpt = /^gpt-(\d+)(?:[.-]|$)/.exec(name);
  return Boolean((gpt && Number(gpt[1]) >= 5) || /^o\d+(?:[.-]|$)/.test(name));
}

function endpoint(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

export function tokenBudget(
  payload: Record<string, unknown>,
): number | undefined {
  const a = payload.max_tokens;
  const b = payload.max_completion_tokens;
  if (a != null && b != null && a !== b) {
    throw new Error("Conflicting max_tokens and max_completion_tokens budgets");
  }
  const value = a ?? b;
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** A narrowly scoped, explicit server instruction; never infer from a generic 400. */
export function replacementTokenField(
  status: number | null,
  body: string,
  current: ChatTokenField,
): ChatTokenField | undefined {
  if (status !== 400 && status !== 422) return undefined;
  let message = body;
  try {
    const parsed = JSON.parse(body.slice(body.indexOf("{")));
    const error = parsed.error || parsed;
    if (error.param && error.param !== current) return undefined;
    if (typeof error.message === "string") message = error.message;
  } catch {
    /* Some proxies return plain text or truncated JSON. */
  }
  const other = fields.find((field) => field !== current)!;
  const text = message.toLowerCase();
  const quoted = `[\x27\x22\x60]?${current}[\x27\x22\x60]?`;
  const rejected = new RegExp(
    `(?:unsupported|unknown|unrecognized|not supported|not allowed)(?:\\s+(?:parameter|argument|field))?\\s*:?\\s*${quoted}\\b|${quoted}\\s+(?:parameter\\s+)?(?:is\\s+)?(?:not supported|unsupported|not allowed|unknown)`,
  ).test(text);
  const requested = new RegExp(
    `(?:use|replace\\s+(?:it\\s+)?with|instead\\s+use)\\s+[\x27\x22\x60]?${other}\\b`,
  ).test(text);
  return rejected && requested ? other : undefined;
}

/** One instance per logical request, shared across all other parameter recoveries. */
export class TokenParameterPolicy {
  private readonly key: string;
  private readonly enabled: boolean;
  private field: ChatTokenField;
  private corrected = false;

  constructor(context: TokenPolicyContext) {
    const url = endpoint(context.url);
    this.enabled = Boolean(url && /\/chat\/completions\/?$/.test(url.pathname));
    this.key = JSON.stringify([context.provider, context.url, context.model]);
    this.field =
      cache.get(this.key) ||
      (url?.hostname.toLowerCase() === "api.openai.com" ||
      modelUsesCompletionTokens(context.model)
        ? "max_completion_tokens"
        : "max_tokens");
  }

  apply(payload: Record<string, unknown>): Record<string, unknown> {
    if (!this.enabled) return payload;
    const value = tokenBudget(payload);
    if (value === undefined) return payload;
    const next = { ...payload };
    for (const field of fields) delete next[field];
    next[this.field] = value;
    return next;
  }

  recover(
    error: unknown,
    payload: Record<string, unknown>,
    blocked = false,
  ): boolean {
    if (!this.enabled || blocked || tokenBudget(payload) === undefined)
      return false;
    if (error instanceof Error && error.name === "AbortError") return false;
    const message = error instanceof Error ? error.message : String(error);
    const next = replacementTokenField(
      parseHttpStatusFromErrorMessage(message),
      message,
      this.field,
    );
    if (!next) return false;
    cache.delete(this.key);
    if (this.corrected) return false;
    this.field = next;
    this.corrected = true;
    return true;
  }

  accept(): void {
    if (!this.corrected) return;
    cache.delete(this.key);
    cache.set(this.key, this.field);
    if (cache.size > 256) cache.delete(cache.keys().next().value!);
  }
}

/** For adapters which need the original HTTP response (including probe failures). */
export async function fetchWithTokenPolicy(
  context: TokenPolicyContext,
  payload: Record<string, unknown>,
  send: (payload: Record<string, unknown>) => Promise<Response>,
  signal?: AbortSignal,
): Promise<Response> {
  const policy = new TokenParameterPolicy(context);
  for (;;) {
    if (signal?.aborted) {
      const error = new Error("Aborted");
      error.name = "AbortError";
      throw error;
    }
    const body = policy.apply(payload);
    const response = await send(body);
    if (response.ok) {
      policy.accept();
      return response;
    }
    if (response.status !== 400 && response.status !== 422) return response;
    const error = new Error(
      `${response.status} - ${await response.clone().text()}`,
    );
    if (!policy.recover(error, body, signal?.aborted)) return response;
  }
}

export function resetTokenPolicyCacheForTests(): void {
  cache.clear();
}
