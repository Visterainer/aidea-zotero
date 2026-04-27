/**
 * Shared API helpers used by both llmClient and preferenceScript.
 */

// =============================================================================
// Constants
// =============================================================================

export const API_ENDPOINT = "/v1/chat/completions";
export const RESPONSES_ENDPOINT = "/v1/responses";
export const EMBEDDINGS_ENDPOINT = "/v1/embeddings";
export const FILES_ENDPOINT = "/v1/files";
export const IMAGE_GENERATIONS_ENDPOINT = "/v1/images/generations";

// =============================================================================
// Functions
// =============================================================================

/**
 * Resolve a full API endpoint URL from a (possibly already-suffixed) base URL
 * and the desired path (e.g. `/v1/chat/completions`).
 */
export function resolveEndpoint(baseOrUrl: string, path: string): string {
  const cleaned = baseOrUrl.trim().replace(/\/$/, "");
  if (!cleaned) return "";
  const chatSuffix = "/chat/completions";
  const responsesSuffix = "/responses";
  const embeddingSuffix = "/embeddings";
  const filesSuffix = "/files";
  const imageGenerationsSuffix = "/images/generations";
  const hasChat = cleaned.endsWith(chatSuffix);
  const hasResponses = cleaned.endsWith(responsesSuffix);
  const hasEmbeddings = cleaned.endsWith(embeddingSuffix);
  const hasFiles = cleaned.endsWith(filesSuffix);
  const hasImageGenerations = cleaned.endsWith(imageGenerationsSuffix);

  if (hasChat) {
    if (path === EMBEDDINGS_ENDPOINT) {
      return cleaned.replace(/\/chat\/completions$/, embeddingSuffix);
    }
    if (path === RESPONSES_ENDPOINT) {
      return cleaned.replace(/\/chat\/completions$/, responsesSuffix);
    }
    if (path === FILES_ENDPOINT) {
      return cleaned.replace(/\/chat\/completions$/, filesSuffix);
    }
    if (path === IMAGE_GENERATIONS_ENDPOINT) {
      return cleaned.replace(/\/chat\/completions$/, imageGenerationsSuffix);
    }
    return cleaned;
  }

  if (hasResponses) {
    if (path === EMBEDDINGS_ENDPOINT) {
      return cleaned.replace(/\/responses$/, embeddingSuffix);
    }
    if (path === API_ENDPOINT) {
      return cleaned.replace(/\/responses$/, chatSuffix);
    }
    if (path === FILES_ENDPOINT) {
      return cleaned.replace(/\/responses$/, filesSuffix);
    }
    if (path === IMAGE_GENERATIONS_ENDPOINT) {
      return cleaned.replace(/\/responses$/, imageGenerationsSuffix);
    }
    return cleaned;
  }

  if (hasEmbeddings) {
    if (path === API_ENDPOINT) {
      return cleaned.replace(/\/embeddings$/, chatSuffix);
    }
    if (path === FILES_ENDPOINT) {
      return cleaned.replace(/\/embeddings$/, filesSuffix);
    }
    if (path === IMAGE_GENERATIONS_ENDPOINT) {
      return cleaned.replace(/\/embeddings$/, imageGenerationsSuffix);
    }
    return cleaned;
  }

  if (hasFiles) {
    if (path === API_ENDPOINT) {
      return cleaned.replace(/\/files$/, chatSuffix);
    }
    if (path === RESPONSES_ENDPOINT) {
      return cleaned.replace(/\/files$/, responsesSuffix);
    }
    if (path === EMBEDDINGS_ENDPOINT) {
      return cleaned.replace(/\/files$/, embeddingSuffix);
    }
    if (path === IMAGE_GENERATIONS_ENDPOINT) {
      return cleaned.replace(/\/files$/, imageGenerationsSuffix);
    }
    return cleaned;
  }

  if (hasImageGenerations) {
    if (path === API_ENDPOINT) {
      return cleaned.replace(/\/images\/generations$/, chatSuffix);
    }
    if (path === RESPONSES_ENDPOINT) {
      return cleaned.replace(/\/images\/generations$/, responsesSuffix);
    }
    if (path === EMBEDDINGS_ENDPOINT) {
      return cleaned.replace(/\/images\/generations$/, embeddingSuffix);
    }
    if (path === FILES_ENDPOINT) {
      return cleaned.replace(/\/images\/generations$/, filesSuffix);
    }
    return cleaned;
  }

  // If a version segment is already present (e.g., /v1 or /v1beta),
  // avoid appending a second /v1 from the default OpenAI path.
  const hasVersion = /\/v\d+(?:beta)?\b/.test(cleaned);
  const normalizedPath =
    hasVersion && path.startsWith("/v1/") ? path.replace(/^\/v1\//, "/") : path;

  return `${cleaned}${normalizedPath}`;
}

/** Build standard request headers for LLM API calls. */
export function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

/** Check whether a model name implies `max_completion_tokens` instead of `max_tokens`. */
export function usesMaxCompletionTokens(model: string): boolean {
  const name = model.toLowerCase();
  return (
    name.startsWith("gpt-5") ||
    name.startsWith("o1") ||
    name.startsWith("o3") ||
    name.startsWith("o4") ||
    name.includes("reasoning")
  );
}

/** Check whether the base URL points at a Responses API endpoint. */
export function isResponsesBase(baseOrUrl: string): boolean {
  const cleaned = baseOrUrl.trim().replace(/\/$/, "");
  return cleaned.endsWith("/v1/responses") || cleaned.endsWith("/responses");
}
