const MINIMAX_OFFICIAL_HOSTS = new Set(["api.minimaxi.com", "api.minimax.io"]);

const unsupportedMiniMaxReasoningSplit = new Set<string>();

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch (_err) {
    return null;
  }
}

function miniMaxCapabilityKey(url: string): string {
  const parsed = parseUrl(url);
  return `${parsed?.hostname.toLowerCase() || ""}:${parsed?.pathname.toLowerCase() || ""}`;
}

export function shouldUseMiniMaxReasoningSplit(
  url: string,
  model: string,
): boolean {
  const parsed = parseUrl(url);
  if (!parsed || !MINIMAX_OFFICIAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    return false;
  }
  if (!/\/chat\/completions\/?$/i.test(parsed.pathname)) return false;
  if (!/^minimax-m(?:2(?:\.\d+)?|3)(?:[-_.]|$)/i.test(model.trim())) {
    return false;
  }
  return !unsupportedMiniMaxReasoningSplit.has(miniMaxCapabilityKey(url));
}

export function applyProviderOutputCapabilities(params: {
  url: string;
  model: string;
  payload: Record<string, unknown>;
}): Record<string, unknown> {
  if (!shouldUseMiniMaxReasoningSplit(params.url, params.model)) {
    return params.payload;
  }
  return { ...params.payload, reasoning_split: true };
}

export function isMiniMaxReasoningSplitRejection(
  errorMessage: string,
): boolean {
  const statusMatch = errorMessage.match(/\b(400|422)\b/);
  return Boolean(
    statusMatch && errorMessage.toLowerCase().includes("reasoning_split"),
  );
}

export function disableMiniMaxReasoningSplit(
  url: string,
  _model: string,
): void {
  unsupportedMiniMaxReasoningSplit.add(miniMaxCapabilityKey(url));
}

export function resetProviderCapabilityCacheForTests(): void {
  unsupportedMiniMaxReasoningSplit.clear();
}
