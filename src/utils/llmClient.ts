/**
 * LLM API Client
 *
 * Provides streaming and non-streaming API calls to OpenAI-compatible endpoints.
 */

import { config } from "../../package.json";
import {
  getPrimaryConnectionMode,
  getApiProfiles,
} from "../modules/contextPanel/prefHelpers";
import {
  getAnthropicReasoningProfileForModel,
  getGeminiReasoningProfileForModel,
  getGrokReasoningProfileForModel,
  getOpenAIReasoningProfileForModel,
  getQwenReasoningProfileForModel,
  getReasoningDefaultLevelForModel,
  getRuntimeReasoningOptionsForModel,
  shouldUseDeepseekThinkingPayload,
  supportsReasoningForModel,
} from "./reasoningProfiles";
import type {
  ReasoningProvider,
  ReasoningLevel,
  OpenAIReasoningEffort,
  OpenAIReasoningProfile,
  GeminiThinkingParam,
  GeminiThinkingValue,
  GeminiReasoningOption,
  GeminiReasoningProfile,
  AnthropicReasoningProfile,
  QwenReasoningProfile,
  RuntimeReasoningOption,
} from "./reasoningProfiles";
import {
  API_ENDPOINT,
  RESPONSES_ENDPOINT,
  EMBEDDINGS_ENDPOINT,
  FILES_ENDPOINT,
  IMAGE_GENERATIONS_ENDPOINT,
  resolveEndpoint,
  buildHeaders,
  usesMaxCompletionTokens,
  isResponsesBase,
} from "./apiHelpers";
import { pathToFileUrl } from "./pathFileUrl";
import {
  normalizeOptionalTemperature,
  normalizeOptionalMaxTokens,
} from "./normalization";
import {
  fetchWithTransientRetry,
  isRetryableTransientError,
  parseHttpStatusFromErrorMessage,
  withTransientRetry,
} from "./transientRetry";
import {
  callProviderEmbeddingsUnsupported,
  chatWithProviderOAuth,
  markerToProvider,
} from "./oauthCli";
import {
  ModelOutputStreamNormalizer,
  normalizeModelOutput,
} from "./modelOutputNormalizer";
import {
  applyProviderOutputCapabilities,
  disableMiniMaxReasoningSplit,
  isMiniMaxReasoningSplitRejection,
} from "./modelProviderCapabilities";

// =============================================================================
// Types
// =============================================================================

/** Image content for vision-capable models */
export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
};

/** Text content */
export type TextContent = {
  type: "text";
  text: string;
};

/** Message content can be string or array of content parts (for vision) */
export type MessageContent = string | (TextContent | ImageContent)[];

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: MessageContent;
};

export type ReasoningConfig = {
  provider: ReasoningProvider;
  level: ReasoningLevel;
};
export type ChatFileAttachment = {
  name: string;
  mimeType?: string;
  storedPath?: string;
  contentHash?: string;
};

export type ChatParams = {
  prompt: string;
  context?: string;
  history?: ChatMessage[];
  signal?: AbortSignal;
  /** Base64 data URL of an image to include with the prompt (legacy single-image field) */
  image?: string;
  /** Base64 data URLs to include with the prompt */
  images?: string[];
  /** Override model for this request */
  model?: string;
  /** Override API base for this request */
  apiBase?: string;
  /** Override API key for this request */
  apiKey?: string;
  /** Optional reasoning control from UI */
  reasoning?: ReasoningConfig;
  /** Optional custom sampling temperature. Omitted values are not sent. */
  temperature?: number;
  /** Optional custom token budget for completion/output. Omitted values are not sent. */
  maxTokens?: number;
  /** Local files to upload and attach when using Responses API */
  attachments?: ChatFileAttachment[];
};

export type ImageGenerationParams = {
  prompt: string;
  context?: string;
  history?: ChatMessage[];
  signal?: AbortSignal;
  /** Base64 data URLs to include with the prompt when the provider supports multimodal image generation. */
  images?: string[];
  /** Local files to attach when the provider supports request attachments. */
  attachments?: ChatFileAttachment[];
  /** Override image generation model. Defaults to the imageGenerationModel pref or gpt-image-2. */
  model?: string;
  /** Override API base for this request. */
  apiBase?: string;
  /** Override API key for this request. */
  apiKey?: string;
  size?: string;
  quality?: string;
  background?: string;
  outputFormat?: string;
};

export type GeneratedImage = {
  mimeType: string;
  base64?: string;
  dataUrl?: string;
  url?: string;
  revisedPrompt?: string;
};

export type ReasoningEvent = {
  summary?: string;
  details?: string;
};

interface StreamChoice {
  delta?: {
    content?: unknown;
    reasoning_content?: unknown;
    reasoning_details?: unknown;
    reasoning?: unknown;
    thinking?: unknown;
    thought?: unknown;
  };
  message?: {
    content?: unknown;
    reasoning_content?: unknown;
    reasoning_details?: unknown;
    reasoning?: unknown;
    thinking?: unknown;
    thought?: unknown;
  };
}

interface CompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
      reasoning_content?: unknown;
      reasoning_details?: unknown;
      reasoning?: unknown;
      thinking?: unknown;
      thought?: unknown;
    };
    text?: string;
  }>;
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

interface ImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
    mime_type?: string;
    output_format?: string;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_SYSTEM_PROMPT = `You are an intelligent research assistant integrated into Zotero. You help users analyze and understand academic papers and documents.

IMPORTANT — Document Access Rules:
If a "Document Context" message is provided below, it contains the paper/document content that has been automatically extracted and injected by the Zotero plugin. This IS the document content — you already have access to it. You MUST NOT tell the user that you "only have excerpts", that you "cannot read the full text", or ask them to "upload the PDF" or "paste more text". Instead, answer their questions directly based on the content provided to you. If the context says "Full context", you have the complete document. If it contains numbered sections, they are the most relevant portions selected by the retrieval system — answer based on them and note if a specific section might contain more detail.

When answering questions:
- Be concise but thorough
- Cite specific parts of the document when relevant
- Use markdown formatting for better readability (headers, lists, bold, code blocks)
- For mathematical expressions, use standard LaTeX syntax with dollar signs: use $...$ for inline math (e.g., $x^2 + y^2 = z^2$) and $$...$$ for display equations on their own line. IMPORTANT: Always use $ delimiters, never use \\( \\) or \\[ \\] delimiters.
- For tables, use markdown table syntax with pipes and a header divider row
- If you don't have enough information from the provided context to fully answer, explain what you can determine and what additional information would help
- Provide actionable insights when possible`;

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const DEFAULT_IMAGE_GENERATION_MODEL = "gpt-image-2";

// =============================================================================
// Utilities
// =============================================================================

const prefKey = (key: string) => `${config.prefsPrefix}.${key}`;
const getPref = (key: string) => Zotero.Prefs.get(prefKey(key), true) as string;

export function getApiConfig(overrides?: {
  apiBase?: string;
  apiKey?: string;
  model?: string;
}) {
  const connectionMode = getPrimaryConnectionMode();
  const primaryProfile = getApiProfiles().primary;
  const apiBase = (overrides?.apiBase || primaryProfile.apiBase)
    .trim()
    .replace(/\/+$/, "");
  const apiKey = (overrides?.apiKey || primaryProfile.apiKey || "").trim();
  const model = (overrides?.model || primaryProfile.model).trim();
  const embeddingModel = getPref("embeddingModel") || DEFAULT_EMBEDDING_MODEL;
  const customSystemPrompt = getPref("systemPrompt") || "";

  if (!apiBase) {
    throw new Error("API URL is missing in preferences");
  }
  if (connectionMode === "custom" && !model) {
    throw new Error("Model is required in custom mode");
  }

  return {
    apiBase,
    apiKey,
    model,
    embeddingModel,
    systemPrompt: customSystemPrompt || DEFAULT_SYSTEM_PROMPT,
  };
}

function getImageApiConfig(overrides?: {
  apiBase?: string;
  apiKey?: string;
  model?: string;
}) {
  const primaryProfile = getApiProfiles().primary;
  const apiBase = (overrides?.apiBase || primaryProfile.apiBase)
    .trim()
    .replace(/\/+$/, "");
  const apiKey = (overrides?.apiKey || primaryProfile.apiKey || "").trim();
  const model = (
    overrides?.model ||
    getPref("imageGenerationModel") ||
    DEFAULT_IMAGE_GENERATION_MODEL
  ).trim();

  if (!apiBase) {
    throw new Error("API URL is missing in preferences");
  }
  if (!model) {
    throw new Error("Image generation model is missing");
  }

  return { apiBase, apiKey, model };
}

function isImageGenerationEndpointModel(model: string | undefined): boolean {
  const normalized = (model || "").trim().toLowerCase();
  return (
    normalized.startsWith("gpt-image") ||
    normalized.startsWith("dall-e") ||
    normalized.includes("image") ||
    normalized.includes("imagen")
  );
}

function parseImageMarkdownResults(text: string): GeneratedImage[] {
  const images: GeneratedImage[] = [];
  const pattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const src = match[1]?.trim() || "";
    if (!src) continue;
    if (src.startsWith("data:image/")) {
      const dataMatch = src.match(/^data:([^;,]+);base64,(.+)$/);
      if (dataMatch) {
        images.push({
          mimeType: normalizeImageMimeType(dataMatch[1]),
          base64: dataMatch[2],
          dataUrl: src,
        });
      }
      continue;
    }
    images.push({
      mimeType: "image/png",
      url: src,
    });
  }
  return images;
}

function chatMessageContentToPlainText(content: MessageContent): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const part of content) {
    if (part.type === "text") {
      const text = part.text.trim();
      if (text) parts.push(text);
      continue;
    }
    if (part.type === "image_url") {
      const url = part.image_url?.url?.trim();
      parts.push(url ? `[Image input: ${url}]` : "[Image input]");
    }
  }
  return parts.join("\n").trim();
}

function formatHistoryForImagePrompt(
  history: ChatMessage[] | undefined,
): string {
  if (!Array.isArray(history) || !history.length) return "";
  return history
    .map((message) => {
      const content = chatMessageContentToPlainText(message.content);
      if (!content) return "";
      const role =
        message.role === "assistant"
          ? "Assistant"
          : message.role === "system"
            ? "System"
            : "User";
      return `${role}:\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function buildImagePromptWithChatInputs(
  params: ImageGenerationParams,
  prompt: string,
): string {
  const blocks: string[] = [];
  if (params.context?.trim()) {
    blocks.push(`Document Context:\n${params.context.trim()}`);
  }
  const historyText = formatHistoryForImagePrompt(params.history);
  if (historyText) {
    blocks.push(`Previous conversation:\n${historyText}`);
  }
  const attachmentLines = Array.isArray(params.attachments)
    ? params.attachments
        .map((attachment) => {
          const name = attachment?.name?.trim();
          if (!name) return "";
          return `- ${name} (${attachment.mimeType || "application/octet-stream"})`;
        })
        .filter(Boolean)
    : [];
  if (attachmentLines.length) {
    blocks.push(`Attached files:\n${attachmentLines.join("\n")}`);
  }
  const imageLines = Array.isArray(params.images)
    ? params.images
        .map((image, index) =>
          typeof image === "string" && image.trim()
            ? `- Image ${index + 1}: ${image.trim()}`
            : "",
        )
        .filter(Boolean)
    : [];
  if (imageLines.length) {
    blocks.push(`Current image inputs:\n${imageLines.join("\n")}`);
  }
  blocks.push(`Image generation request:\n${prompt}`);
  return blocks.join("\n\n====================\n\n");
}

type IOUtilsLike = {
  read?: (path: string) => Promise<Uint8Array | ArrayBuffer>;
};

type OSFileLike = {
  read?: (path: string) => Promise<Uint8Array | ArrayBuffer>;
};

type ZoteroFileLike = {
  getContentsAsync?: (
    source: string | nsIFile,
    charset?: string,
    maxLength?: number,
  ) => Promise<unknown> | unknown;
  getBinaryContentsAsync?: (
    source: string | nsIFile,
    maxLength?: number,
  ) => Promise<string> | string;
};

const uploadedResponseFileIdCache = new Map<string, string>();

function getIOUtils(): IOUtilsLike | undefined {
  const fromGlobal = (globalThis as unknown as { IOUtils?: IOUtilsLike })
    .IOUtils;
  if (fromGlobal?.read) return fromGlobal;
  const fromToolkit = ztoolkit.getGlobal("IOUtils") as IOUtilsLike | undefined;
  return fromToolkit?.read ? fromToolkit : undefined;
}

function getOSFile(): OSFileLike | undefined {
  const fromGlobal = (globalThis as { OS?: { File?: OSFileLike } }).OS?.File;
  if (fromGlobal?.read) return fromGlobal;
  const toolkitOS = ztoolkit.getGlobal("OS") as
    { File?: OSFileLike } | undefined;
  const fromToolkit = toolkitOS?.File;
  return fromToolkit?.read ? fromToolkit : undefined;
}

function getZoteroFile(): ZoteroFileLike | undefined {
  const fromGlobal = (globalThis as { Zotero?: { File?: ZoteroFileLike } })
    .Zotero?.File;
  if (fromGlobal?.getContentsAsync || fromGlobal?.getBinaryContentsAsync) {
    return fromGlobal;
  }
  const toolkitZotero = ztoolkit.getGlobal("Zotero") as
    { File?: ZoteroFileLike } | undefined;
  const fromToolkit = toolkitZotero?.File;
  if (fromToolkit?.getContentsAsync || fromToolkit?.getBinaryContentsAsync) {
    return fromToolkit;
  }
  return undefined;
}

function binaryStringToBytes(data: string): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    out[i] = data.charCodeAt(i) & 0xff;
  }
  return out;
}

function coerceToBytes(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === "string") {
    // Many Zotero/Gecko APIs return binary content as a byte-string.
    return binaryStringToBytes(data);
  }
  return null;
}

async function readLocalFileBytes(path: string): Promise<Uint8Array> {
  const normalizedPath = (path || "").trim();
  if (!normalizedPath) {
    throw new Error("Attachment file path is empty");
  }
  const attempted: string[] = [];

  const io = getIOUtils();
  if (io?.read) {
    attempted.push("IOUtils.read");
    const data = await io.read(normalizedPath);
    const bytes = coerceToBytes(data);
    if (bytes) return bytes;
  }

  const osFile = getOSFile();
  if (osFile?.read) {
    attempted.push("OS.File.read");
    const data = await osFile.read(normalizedPath);
    const bytes = coerceToBytes(data);
    if (bytes) return bytes;
  }

  const zoteroFile = getZoteroFile();
  if (zoteroFile?.getContentsAsync) {
    attempted.push("Zotero.File.getContentsAsync");
    try {
      const data = await zoteroFile.getContentsAsync(normalizedPath);
      const bytes = coerceToBytes(data);
      if (bytes) return bytes;
    } catch (err) {
      ztoolkit.log("LLM: Zotero.File.getContentsAsync failed", err);
    }
  }
  if (zoteroFile?.getBinaryContentsAsync) {
    attempted.push("Zotero.File.getBinaryContentsAsync");
    try {
      const data = await zoteroFile.getBinaryContentsAsync(normalizedPath);
      const bytes = coerceToBytes(data);
      if (bytes) return bytes;
    } catch (err) {
      ztoolkit.log("LLM: Zotero.File.getBinaryContentsAsync failed", err);
    }
  }

  const fileUrl = pathToFileUrl(normalizedPath);
  if (fileUrl) {
    attempted.push("fetch(file://)");
    try {
      const res = await getFetch()(fileUrl);
      if (res.ok) {
        return new Uint8Array(await res.arrayBuffer());
      }
      ztoolkit.log(
        "LLM: fetch(file://) returned non-OK status",
        res.status,
        res.statusText,
      );
    } catch (err) {
      ztoolkit.log("LLM: fetch(file://) failed", err);
    }
  }

  throw new Error(
    `No binary file read API available (tried: ${attempted.join(", ") || "none"})`,
  );
}

function createAbortError(): Error {
  const err = new Error("Aborted");
  (err as { name?: string }).name = "AbortError";
  return err;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

function normalizeUploadableAttachments(
  attachments: ChatFileAttachment[] | undefined,
): ChatFileAttachment[] {
  if (!Array.isArray(attachments) || !attachments.length) return [];
  const out: ChatFileAttachment[] = [];
  const seen = new Set<string>();
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== "object") continue;
    const storedPath =
      typeof attachment.storedPath === "string"
        ? attachment.storedPath.trim()
        : "";
    if (!storedPath) continue;
    const name =
      typeof attachment.name === "string" && attachment.name.trim()
        ? attachment.name.trim()
        : "attachment";
    const mimeType =
      typeof attachment.mimeType === "string" && attachment.mimeType.trim()
        ? attachment.mimeType.trim()
        : "application/octet-stream";
    const contentHash =
      typeof attachment.contentHash === "string" &&
      /^[a-f0-9]{64}$/i.test(attachment.contentHash.trim())
        ? attachment.contentHash.trim().toLowerCase()
        : undefined;
    const key = contentHash || storedPath;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      mimeType,
      storedPath,
      contentHash,
    });
  }
  return out;
}

function extractUploadedFileId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const typed = data as { id?: unknown; file_id?: unknown };
  if (typeof typed.id === "string" && typed.id.trim()) {
    return typed.id.trim();
  }
  if (typeof typed.file_id === "string" && typed.file_id.trim()) {
    return typed.file_id.trim();
  }
  return "";
}

function isPurposeValidationError(status: number, bodyText: string): boolean {
  if (status !== 400 && status !== 422) return false;
  return /purpose/i.test(bodyText);
}

function getFormDataCtor(): typeof FormData | undefined {
  const fromGlobal = (globalThis as { FormData?: typeof FormData }).FormData;
  if (typeof fromGlobal === "function") return fromGlobal;
  const fromToolkit = ztoolkit.getGlobal("FormData") as
    typeof FormData | undefined;
  return typeof fromToolkit === "function" ? fromToolkit : undefined;
}

function getBlobCtor(): typeof Blob | undefined {
  const fromGlobal = (globalThis as { Blob?: typeof Blob }).Blob;
  if (typeof fromGlobal === "function") return fromGlobal;
  const fromToolkit = ztoolkit.getGlobal("Blob") as typeof Blob | undefined;
  return typeof fromToolkit === "function" ? fromToolkit : undefined;
}

function toSafeMultipartToken(value: string): string {
  return (value || "").replace(/[\r\n"]/g, "_").trim() || "attachment";
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function buildManualMultipartBody(params: {
  purpose: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): { body: Uint8Array; contentType: string } {
  const encoder = new TextEncoder();
  const boundary = `----aidea-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const safePurpose = toSafeMultipartToken(params.purpose);
  const safeFileName = toSafeMultipartToken(params.fileName);
  const safeMimeType = toSafeMultipartToken(params.mimeType);

  const prefix = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="purpose"\r\n\r\n` +
      `${safePurpose}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${safeFileName}"\r\n` +
      `Content-Type: ${safeMimeType}\r\n\r\n`,
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  return {
    body: concatBytes([prefix, params.bytes, suffix]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function buildUploadRequest(params: {
  purpose: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): { body: BodyInit; contentType?: string; mode: "formdata" | "manual" } {
  const FormDataCtor = getFormDataCtor();
  const BlobCtor = getBlobCtor();
  if (FormDataCtor && BlobCtor) {
    const body = new FormDataCtor();
    const blob = new BlobCtor([params.bytes], {
      type: params.mimeType || "application/octet-stream",
    });
    body.append("purpose", params.purpose || "assistants");
    body.append("file", blob, params.fileName || "attachment");
    return { body, mode: "formdata" };
  }

  const manual = buildManualMultipartBody({
    purpose: params.purpose,
    fileName: params.fileName,
    mimeType: params.mimeType,
    bytes: params.bytes,
  });
  return {
    body: manual.body,
    contentType: manual.contentType,
    mode: "manual",
  };
}

async function uploadAttachmentForResponses(params: {
  apiBase: string;
  apiKey: string;
  attachment: ChatFileAttachment;
  signal?: AbortSignal;
}): Promise<string> {
  const filesUrl = resolveEndpoint(params.apiBase, FILES_ENDPOINT);
  const storedPath = (params.attachment.storedPath || "").trim();
  if (!storedPath) {
    throw new Error("Attachment stored path is missing");
  }
  const cacheKey = [
    filesUrl,
    params.apiKey,
    params.attachment.contentHash || storedPath,
  ].join("::");
  const cached = uploadedResponseFileIdCache.get(cacheKey);
  if (cached) return cached;

  throwIfAborted(params.signal);
  const bytes = await readLocalFileBytes(storedPath);
  throwIfAborted(params.signal);

  const headers: Record<string, string> = {};
  if (params.apiKey) {
    headers.Authorization = `Bearer ${params.apiKey}`;
  }
  const uploadPurposes = ["assistants", "user_data"];
  let lastError = "Unknown file upload error";
  for (let index = 0; index < uploadPurposes.length; index++) {
    const purpose = uploadPurposes[index];
    const uploadRequest = buildUploadRequest({
      purpose,
      fileName: params.attachment.name || "attachment",
      mimeType: params.attachment.mimeType || "application/octet-stream",
      bytes,
    });
    const requestHeaders = uploadRequest.contentType
      ? {
          ...headers,
          "Content-Type": uploadRequest.contentType,
        }
      : headers;
    if (uploadRequest.mode === "manual") {
      ztoolkit.log(
        "LLM: Uploading attachment via manual multipart fallback",
        params.attachment.name,
      );
    }

    const res = await fetchWithTransientRetry(getFetch(), filesUrl, {
      method: "POST",
      headers: requestHeaders,
      body: uploadRequest.body,
      signal: params.signal,
    });
    if (res.ok) {
      const data = (await res.json()) as unknown;
      const fileId = extractUploadedFileId(data);
      if (!fileId) {
        throw new Error("File upload succeeded but no file ID was returned");
      }
      uploadedResponseFileIdCache.set(cacheKey, fileId);
      return fileId;
    }

    const errText = await res.text();
    lastError = `${res.status} ${res.statusText} - ${errText}`;
    if (
      index === uploadPurposes.length - 1 ||
      !isPurposeValidationError(res.status, errText)
    ) {
      break;
    }
  }

  throw new Error(lastError);
}

async function uploadFilesForResponses(params: {
  apiBase: string;
  apiKey: string;
  attachments: ChatFileAttachment[] | undefined;
  signal?: AbortSignal;
}): Promise<string[]> {
  const uploadable = normalizeUploadableAttachments(params.attachments);
  if (!uploadable.length) return [];
  const fileIds: string[] = [];
  const seen = new Set<string>();
  for (const attachment of uploadable) {
    throwIfAborted(params.signal);
    try {
      const fileId = await uploadAttachmentForResponses({
        apiBase: params.apiBase,
        apiKey: params.apiKey,
        attachment,
        signal: params.signal,
      });
      if (!fileId || seen.has(fileId)) continue;
      seen.add(fileId);
      fileIds.push(fileId);
    } catch (err) {
      ztoolkit.log(
        "LLM: Failed to upload attachment to Responses API",
        attachment.name,
        err,
      );
    }
  }
  return fileIds;
}

/** Build messages array from params */
function buildMessages(
  params: ChatParams,
  systemPrompt: string,
): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (params.context) {
    const contextPreamble =
      `[INSTRUCTION: The text below is the document content automatically extracted by the Zotero plugin. ` +
      `Answer user questions based on this content. Do NOT say you only have excerpts or ask users to upload the PDF.]\n\n`;
    messages.push({
      role: "system",
      content: `Document Context:\n${contextPreamble}${params.context}`,
    });
  }

  if (params.history?.length) {
    messages.push(...params.history);
  }

  const imageUrls: string[] = [];
  if (Array.isArray(params.images)) {
    for (const image of params.images) {
      if (typeof image === "string" && image.trim()) {
        imageUrls.push(image.trim());
      }
    }
  }
  if (typeof params.image === "string" && params.image.trim()) {
    imageUrls.push(params.image.trim());
  }

  // Build user message - with image(s) if provided (vision API format)
  if (imageUrls.length) {
    const contentParts: (TextContent | ImageContent)[] = [
      { type: "text", text: params.prompt },
    ];
    for (const url of imageUrls) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url,
          detail: "high",
        },
      });
    }
    messages.push({
      role: "user",
      content: contentParts,
    });
  } else {
    messages.push({
      role: "user",
      content: params.prompt,
    });
  }

  return messages;
}

/** Get fetch function from Zotero global */
function getFetch(): typeof fetch {
  return ztoolkit.getGlobal("fetch") as typeof fetch;
}

function normalizeStreamText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeStreamText(entry))
      .filter(Boolean)
      .join("");
  }
  if (value && typeof value === "object") {
    const row = value as {
      text?: unknown;
      content?: unknown;
      reasoning?: unknown;
      summary?: unknown;
      delta?: unknown;
      thinking?: unknown;
      thought?: unknown;
    };
    return (
      normalizeStreamText(row.text) ||
      normalizeStreamText(row.content) ||
      normalizeStreamText(row.reasoning) ||
      normalizeStreamText(row.summary) ||
      normalizeStreamText(row.delta) ||
      normalizeStreamText(row.thinking) ||
      normalizeStreamText(row.thought)
    );
  }
  return "";
}

type ParameterSource =
  "explicit-task" | "omitted-provider-default" | "provider-required-fallback";

function buildTokenParam(model: string, maxTokens: number | undefined) {
  if (maxTokens === undefined) return {};
  return usesMaxCompletionTokens(model)
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
}

function buildResponsesTokenParam(maxTokens: number | undefined) {
  if (maxTokens === undefined) return {};
  return { max_output_tokens: maxTokens };
}

function getPayloadTokenParam(payload: Record<string, unknown>):
  | {
      field: "max_tokens" | "max_completion_tokens" | "max_output_tokens";
      value: unknown;
    }
  | undefined {
  for (const field of [
    "max_tokens",
    "max_completion_tokens",
    "max_output_tokens",
  ] as const) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      return { field, value: payload[field] };
    }
  }
  return undefined;
}

function logLlmParameterPolicy(params: {
  provider: string;
  model: string;
  endpointType: string;
  payload: Record<string, unknown>;
  parameterSource: ParameterSource;
}) {
  const tokenParam = getPayloadTokenParam(params.payload);
  ztoolkit?.log?.("AIdea: LLM request parameters", {
    provider: params.provider,
    model: params.model,
    endpointType: params.endpointType,
    temperatureSent: Object.prototype.hasOwnProperty.call(
      params.payload,
      "temperature",
    ),
    tokenField: tokenParam?.field || null,
    tokenValue: tokenParam?.value ?? null,
    parameterSource: params.parameterSource,
  });
}

function getOptionalParameterSource(params: {
  effectiveTemperature?: number;
  effectiveMaxTokens?: number;
}): ParameterSource {
  return params.effectiveTemperature !== undefined ||
    params.effectiveMaxTokens !== undefined
    ? "explicit-task"
    : "omitted-provider-default";
}

const OPENAI_EFFORT_ORDER: OpenAIReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

const REASONING_LEVEL_ALIAS_MAP: Partial<
  Record<ReasoningLevel, ReasoningLevel>
> = {
  minimal: "low",
  xhigh: "high",
};

function getReasoningLevelAlias(level: ReasoningLevel): ReasoningLevel | null {
  return REASONING_LEVEL_ALIAS_MAP[level] || null;
}

// Re-export reasoning profile helpers so consumers can import from llmClient
// without coupling directly to reasoningProfiles.
export type {
  ReasoningProvider,
  ReasoningLevel,
  OpenAIReasoningEffort,
  OpenAIReasoningProfile,
  GeminiThinkingParam,
  GeminiThinkingValue,
  GeminiReasoningOption,
  GeminiReasoningProfile,
  AnthropicReasoningProfile,
  QwenReasoningProfile,
  RuntimeReasoningOption,
} from "./reasoningProfiles";

export {
  getRuntimeReasoningOptionsForModel as getRuntimeReasoningOptions,
  getOpenAIReasoningProfileForModel as getOpenAIReasoningProfile,
  getGrokReasoningProfileForModel as getGrokReasoningProfile,
  getGeminiReasoningProfileForModel as getGeminiReasoningProfile,
  getAnthropicReasoningProfileForModel as getAnthropicReasoningProfile,
  getQwenReasoningProfileForModel as getQwenReasoningProfile,
} from "./reasoningProfiles";

// Local aliases for internal use (re-exports above don't create local bindings)
const getOpenAIReasoningProfile = getOpenAIReasoningProfileForModel;
const getGrokReasoningProfile = getGrokReasoningProfileForModel;
const getGeminiReasoningProfile = getGeminiReasoningProfileForModel;
const getAnthropicReasoningProfile = getAnthropicReasoningProfileForModel;
const getQwenReasoningProfile = getQwenReasoningProfileForModel;

function resolveOpenAIReasoningEffort(
  provider: "openai" | "grok",
  level: ReasoningLevel,
  modelName?: string,
  apiBase?: string,
): OpenAIReasoningEffort | null {
  const profile =
    provider === "grok"
      ? getGrokReasoningProfile(modelName)
      : getOpenAIReasoningProfile(modelName);
  const direct = profile.levelToEffort[level];
  if (direct !== undefined) {
    return direct;
  }

  const requestedAlias = getReasoningLevelAlias(level);
  if (requestedAlias) {
    const aliasValue = profile.levelToEffort[requestedAlias];
    if (aliasValue !== undefined) {
      return aliasValue;
    }
  }

  for (const candidate of OPENAI_EFFORT_ORDER) {
    if (profile.supportedEfforts.includes(candidate)) {
      return candidate;
    }
  }

  const defaultEffort = profile.levelToEffort[profile.defaultLevel];
  if (defaultEffort !== undefined) {
    return defaultEffort;
  }

  return null;
}

function resolveAnthropicThinkingBudget(
  level: ReasoningLevel,
  profile: AnthropicReasoningProfile,
): number {
  const direct = profile.levelToBudgetTokens[level];
  if (Number.isFinite(direct)) {
    return Number(direct);
  }

  const aliasLevel = getReasoningLevelAlias(level);
  if (aliasLevel) {
    const aliasBudget = profile.levelToBudgetTokens[aliasLevel];
    if (Number.isFinite(aliasBudget)) {
      return Number(aliasBudget);
    }
  }

  const defaultBudget = profile.levelToBudgetTokens[profile.defaultLevel];
  if (Number.isFinite(defaultBudget)) {
    return Number(defaultBudget);
  }

  return profile.defaultBudgetTokens;
}

function resolveQwenEnableThinking(
  level: ReasoningLevel,
  profile: QwenReasoningProfile,
): boolean | null {
  const direct = profile.levelToEnableThinking[level];
  if (typeof direct === "boolean" || direct === null) {
    return direct;
  }

  const aliasLevel = getReasoningLevelAlias(level);
  if (aliasLevel) {
    const aliasValue = profile.levelToEnableThinking[aliasLevel];
    if (typeof aliasValue === "boolean" || aliasValue === null) {
      return aliasValue;
    }
  }

  const defaultValue = profile.levelToEnableThinking[profile.defaultLevel];
  if (typeof defaultValue === "boolean" || defaultValue === null) {
    return defaultValue;
  }

  return profile.defaultEnableThinking;
}

function isDashScopeApiBase(apiBase?: string): boolean {
  const normalized = (apiBase || "").trim().toLowerCase();
  if (!normalized) return false;
  return /dashscope(?:-intl)?\.aliyuncs\.com/.test(normalized);
}

function resolveGeminiReasoningOption(
  level: ReasoningLevel,
  profile: GeminiReasoningProfile,
): GeminiReasoningOption {
  const direct = profile.levelToValue[level];
  if (direct !== undefined) {
    return { level, value: direct };
  }

  const aliasLevel = getReasoningLevelAlias(level);
  if (aliasLevel) {
    const aliasValue = profile.levelToValue[aliasLevel];
    if (aliasValue !== undefined) {
      return { level: aliasLevel, value: aliasValue };
    }
  }

  const defaultMapped = profile.levelToValue[profile.defaultLevel];
  if (defaultMapped !== undefined) {
    return { level: profile.defaultLevel, value: defaultMapped };
  }

  const byDefaultValue = profile.options.find(
    (option) => option.value === profile.defaultValue,
  );
  if (byDefaultValue) return byDefaultValue;

  return profile.options[0] || { level: "medium", value: profile.defaultValue };
}

function stringifyContent(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.text : ""))
    .filter(Boolean)
    .join("\n");
}

function buildResponsesInput(
  messages: ChatMessage[],
  responseFileIds?: string[],
) {
  const instructionsParts: string[] = [];
  const input: Array<{
    type: "message";
    role: "user" | "assistant";
    content:
      | string
      | Array<
          | { type: "input_text"; text: string }
          | { type: "input_image"; image_url: string; detail?: string }
          | { type: "input_file"; file_id: string }
        >;
  }> = [];
  const normalizedFileIds = Array.isArray(responseFileIds)
    ? responseFileIds
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    if (message.role === "system") {
      const text = stringifyContent(message.content);
      if (text) instructionsParts.push(text);
      continue;
    }
    const appendFilesToMessage =
      message.role === "user" &&
      index === messages.length - 1 &&
      normalizedFileIds.length > 0;

    if (typeof message.content === "string") {
      if (appendFilesToMessage) {
        const contentParts: Array<
          | { type: "input_text"; text: string }
          | { type: "input_file"; file_id: string }
        > = [{ type: "input_text", text: message.content }];
        for (const fileId of normalizedFileIds) {
          contentParts.push({
            type: "input_file",
            file_id: fileId,
          });
        }
        input.push({
          type: "message",
          role: message.role,
          content: contentParts,
        });
        continue;
      }
      input.push({
        type: "message",
        role: message.role,
        content: message.content,
      });
      continue;
    }

    const contentParts: Array<
      | { type: "input_text"; text: string }
      | { type: "input_image"; image_url: string; detail?: string }
      | { type: "input_file"; file_id: string }
    > = message.content.map((part) => {
      if (part.type === "text") {
        return { type: "input_text" as const, text: part.text };
      }
      return {
        type: "input_image" as const,
        image_url: part.image_url.url,
        detail: part.image_url.detail,
      };
    });
    if (appendFilesToMessage) {
      for (const fileId of normalizedFileIds) {
        contentParts.push({
          type: "input_file",
          file_id: fileId,
        });
      }
    }

    input.push({
      type: "message",
      role: message.role,
      content: contentParts,
    });
  }

  return {
    instructions: instructionsParts.length
      ? instructionsParts.join("\n\n")
      : undefined,
    input,
  };
}

function emptyReasoningPayload() {
  return { extra: {}, omitTemperature: false } as const;
}

function buildReasoningPayload(
  reasoning: ReasoningConfig | undefined,
  useResponses: boolean,
  modelName?: string,
  apiBase?: string,
): { extra: Record<string, unknown>; omitTemperature: boolean } {
  if (!reasoning) {
    return emptyReasoningPayload();
  }
  if (!supportsReasoningForModel(reasoning.provider, modelName)) {
    return emptyReasoningPayload();
  }

  if (reasoning.provider === "openai" || reasoning.provider === "grok") {
    const effort = resolveOpenAIReasoningEffort(
      reasoning.provider,
      reasoning.level,
      modelName,
      apiBase,
    );
    const omitTemperature = reasoning.provider === "openai";
    if (useResponses) {
      const responseReasoning: Record<string, unknown> = {
        summary: "detailed",
      };
      if (effort) {
        responseReasoning.effort = effort;
      }
      return {
        extra: {
          reasoning: responseReasoning,
        },
        // GPT-5 families may reject temperature when reasoning is configured.
        omitTemperature,
      };
    }
    return {
      extra: effort ? { reasoning_effort: effort } : {},
      omitTemperature,
    };
  }

  if (reasoning.provider === "gemini") {
    const profile = getGeminiReasoningProfile(modelName);
    const resolvedOption = resolveGeminiReasoningOption(
      reasoning.level,
      profile,
    );

    // Keep request valid if a stale/unsupported level is selected.
    const thinkingConfig: Record<string, unknown> = {
      include_thoughts: true,
    };
    if (profile.param === "thinking_budget") {
      thinkingConfig.thinking_budget =
        typeof resolvedOption.value === "number" ? resolvedOption.value : 8192;
    } else {
      thinkingConfig.thinking_level =
        resolvedOption.value === "low" ||
        resolvedOption.value === "medium" ||
        resolvedOption.value === "high"
          ? resolvedOption.value
          : "medium";
    }

    return {
      extra: {
        extra_body: {
          google: {
            thinking_config: thinkingConfig,
          },
        },
      },
      omitTemperature: false,
    };
  }

  if (reasoning.provider === "qwen") {
    const profile = getQwenReasoningProfile(modelName);
    const enableThinking = resolveQwenEnableThinking(reasoning.level, profile);
    if (enableThinking === null) {
      return emptyReasoningPayload();
    }
    if (isDashScopeApiBase(apiBase)) {
      return {
        extra: {
          enable_thinking: enableThinking,
        },
        omitTemperature: false,
      };
    }
    return {
      extra: {
        chat_template_kwargs: {
          enable_thinking: enableThinking,
        },
      },
      omitTemperature: false,
    };
  }

  if (reasoning.provider === "deepseek") {
    if (!shouldUseDeepseekThinkingPayload(modelName)) {
      return emptyReasoningPayload();
    }
    return {
      extra: {
        thinking: {
          type: "enabled",
        },
      },
      omitTemperature: false,
    };
  }

  if (reasoning.provider === "kimi") {
    // Kimi reasoning models generally expose reasoning by model choice;
    // keep payload conservative to avoid provider-specific parameter errors.
    return emptyReasoningPayload();
  }

  if (reasoning.provider === "anthropic") {
    const profile = getAnthropicReasoningProfile(modelName);
    const budgetTokens = resolveAnthropicThinkingBudget(
      reasoning.level,
      profile,
    );
    return {
      extra: {
        thinking: {
          type: "enabled",
          budget_tokens: Math.max(1024, Math.floor(budgetTokens)),
        },
      },
      omitTemperature: false,
    };
  }

  return emptyReasoningPayload();
}

function createChatPayloadBuilder(params: {
  model: string;
  messages: ChatMessage[];
  useResponses: boolean;
  responseFileIds?: string[];
  apiBase: string;
  effectiveTemperature?: number;
  effectiveMaxTokens?: number;
  stream: boolean;
}) {
  const {
    model,
    messages,
    useResponses,
    responseFileIds,
    apiBase,
    effectiveTemperature,
    effectiveMaxTokens,
    stream,
  } = params;
  return (reasoningOverride: ReasoningConfig | undefined) => {
    const reasoningPayload = buildReasoningPayload(
      reasoningOverride,
      useResponses,
      model,
      apiBase,
    );
    const temperatureParam =
      reasoningPayload.omitTemperature || effectiveTemperature === undefined
        ? {}
        : { temperature: effectiveTemperature };

    const payload = useResponses
      ? {
          model,
          ...buildResponsesInput(messages, responseFileIds),
          ...reasoningPayload.extra,
          ...temperatureParam,
          ...buildResponsesTokenParam(effectiveMaxTokens),
        }
      : {
          model,
          messages,
          ...reasoningPayload.extra,
          ...temperatureParam,
          ...buildTokenParam(model, effectiveMaxTokens),
        };

    if (stream) {
      return {
        ...payload,
        stream: true,
      } as Record<string, unknown>;
    }
    return payload as Record<string, unknown>;
  };
}

function stripTemperature(payload: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(payload, "temperature")) {
    return payload;
  }
  const clone = { ...payload };
  delete clone.temperature;
  return clone;
}

type TemperaturePolicy =
  { mode: "default" } | { mode: "omit" } | { mode: "fixed"; value: number };

const temperaturePolicyCache = new Map<string, TemperaturePolicy>();

function getTemperaturePolicyKey(
  url: string,
  payload: Record<string, unknown>,
) {
  const model =
    typeof payload.model === "string" ? payload.model.trim().toLowerCase() : "";
  return `${url}::${model}`;
}

function applyTemperaturePolicy(
  payload: Record<string, unknown>,
  policy: TemperaturePolicy,
) {
  if (policy.mode === "omit") {
    return stripTemperature(payload);
  }
  if (policy.mode === "fixed") {
    return {
      ...payload,
      temperature: policy.value,
    };
  }
  return payload;
}

function extractFixedTemperature(message: string): number | null {
  const text = message.toLowerCase();
  const patterns = [
    /only\s+(-?\d+(?:\.\d+)?)\s+is\s+allowed/,
    /temperature[^.\n]*must\s+be\s+(-?\d+(?:\.\d+)?)/,
    /temperature[^.\n]*should\s+be\s+(-?\d+(?:\.\d+)?)/,
    /allowed\s+temperature[^.\n]*:\s*(-?\d+(?:\.\d+)?)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number.parseFloat(match[1]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function getTemperatureRecoveryPolicy(
  status: number,
  message: string,
): TemperaturePolicy | null {
  if (status !== 400 && status !== 422) return null;
  const text = message.toLowerCase();
  if (!text.includes("temperature")) return null;

  const fixedValue = extractFixedTemperature(text);
  if (fixedValue !== null) {
    return { mode: "fixed", value: fixedValue };
  }

  if (
    text.includes("not supported") ||
    text.includes("unsupported") ||
    text.includes("not allowed") ||
    text.includes("unknown parameter") ||
    text.includes("invalid parameter") ||
    text.includes("invalid temperature")
  ) {
    return { mode: "omit" };
  }

  return null;
}

async function postWithTemperatureFallback(params: {
  url: string;
  apiKey: string;
  payload: Record<string, unknown>;
  logPayload?: (payload: Record<string, unknown>) => void;
  signal?: AbortSignal;
}) {
  const policyKey = getTemperaturePolicyKey(params.url, params.payload);
  const hasTemperature = Object.prototype.hasOwnProperty.call(
    params.payload,
    "temperature",
  );
  const send = (bodyPayload: Record<string, unknown>) => {
    params.logPayload?.(bodyPayload);
    return fetchWithTransientRetry(getFetch(), params.url, {
      method: "POST",
      headers: buildHeaders(params.apiKey),
      body: JSON.stringify(bodyPayload),
      signal: params.signal,
    });
  };

  let requestPayload = params.payload;
  const cachedPolicy = temperaturePolicyCache.get(policyKey);
  if (hasTemperature && cachedPolicy) {
    requestPayload = applyTemperaturePolicy(params.payload, cachedPolicy);
  }

  let res = await send(requestPayload);
  if (res.ok) return res;

  const firstErr = await res.text();
  const recoveryPolicy = hasTemperature
    ? getTemperatureRecoveryPolicy(res.status, firstErr)
    : null;
  if (recoveryPolicy) {
    const fallbackPayload = applyTemperaturePolicy(
      params.payload,
      recoveryPolicy,
    );
    res = await send(fallbackPayload);
    if (res.ok) {
      temperaturePolicyCache.set(policyKey, recoveryPolicy);
      return res;
    }
    const secondErr = await res.text();
    throw new Error(`${res.status} ${res.statusText} - ${secondErr}`);
  }

  throw new Error(`${res.status} ${res.statusText} - ${firstErr}`);
}

function isReasoningErrorMessage(errorMessage: string): boolean {
  const status = parseHttpStatusFromErrorMessage(errorMessage);
  if (status !== 400 && status !== 422) return false;
  const text = errorMessage.toLowerCase();
  return (
    text.includes("reasoning") ||
    text.includes("effort") ||
    text.includes("thinking") ||
    text.includes("enable_thinking") ||
    text.includes("chat_template_kwargs") ||
    text.includes("thinking_level") ||
    text.includes("thinking_budget")
  );
}

function getReasoningRecoverySelection(params: {
  currentReasoning: ReasoningConfig | undefined;
  modelName?: string;
}): ReasoningConfig | undefined | null {
  const { currentReasoning, modelName } = params;
  if (!currentReasoning) return null;
  const defaultLevel = getReasoningDefaultLevelForModel(
    currentReasoning.provider,
    modelName,
  );
  if (defaultLevel && currentReasoning.level !== defaultLevel) {
    return {
      provider: currentReasoning.provider,
      level: defaultLevel,
    };
  }
  return undefined;
}

async function postWithReasoningFallback(params: {
  url: string;
  apiKey: string;
  modelName?: string;
  initialReasoning: ReasoningConfig | undefined;
  buildPayload: (
    reasoningOverride: ReasoningConfig | undefined,
  ) => Record<string, unknown>;
  logPayload?: (payload: Record<string, unknown>) => void;
  signal?: AbortSignal;
}) {
  let reasoningSelection = params.initialReasoning;
  let retries = 0;
  const maxRetries = 3;
  let lastError: unknown;
  let retriedWithoutMiniMaxReasoningSplit = false;
  const attemptedSelections = new Set<string>([
    reasoningSelection
      ? `${reasoningSelection.provider}:${reasoningSelection.level}`
      : "none",
  ]);

  while (retries <= maxRetries) {
    const payload = applyProviderOutputCapabilities({
      url: params.url,
      model: params.modelName || "",
      payload: params.buildPayload(reasoningSelection),
    });
    try {
      return await postWithTemperatureFallback({
        url: params.url,
        apiKey: params.apiKey,
        payload,
        logPayload: params.logPayload,
        signal: params.signal,
      });
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      if (
        !retriedWithoutMiniMaxReasoningSplit &&
        Object.prototype.hasOwnProperty.call(payload, "reasoning_split") &&
        isMiniMaxReasoningSplitRejection(message)
      ) {
        disableMiniMaxReasoningSplit(params.url, params.modelName || "");
        retriedWithoutMiniMaxReasoningSplit = true;
        retries += 1;
        continue;
      }
      if (!isReasoningErrorMessage(message)) {
        throw err;
      }
      const recovered = getReasoningRecoverySelection({
        currentReasoning: reasoningSelection,
        modelName: params.modelName,
      });
      if (recovered === null) {
        throw err;
      }
      const nextKey = recovered
        ? `${recovered.provider}:${recovered.level}`
        : "none";
      if (attemptedSelections.has(nextKey)) {
        throw err;
      }
      attemptedSelections.add(nextKey);
      reasoningSelection = recovered;
      retries += 1;
    }
  }

  throw (lastError as Error) || new Error("Request failed after retries");
}

function normalizeImageMimeType(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!raw) return "image/png";
  if (raw.startsWith("image/")) return raw;
  if (raw === "jpg") return "image/jpeg";
  if (["png", "jpeg", "webp", "gif"].includes(raw)) return `image/${raw}`;
  return "image/png";
}

function toImageMarkdown(src: string, alt: string): string {
  const safeSrc = src.trim();
  if (!safeSrc) return "";
  return `![${alt}](${safeSrc})`;
}

function extractOutputImageMarkdown(value: unknown, index: number): string {
  if (!value || typeof value !== "object") return "";
  const part = value as {
    type?: unknown;
    result?: unknown;
    b64_json?: unknown;
    data?: unknown;
    image_url?: unknown;
    url?: unknown;
    mime_type?: unknown;
    media_type?: unknown;
    output_format?: unknown;
    format?: unknown;
  };
  const type = typeof part.type === "string" ? part.type : "";
  const looksImageLike =
    type.includes("image") ||
    type === "image_generation_call" ||
    typeof part.image_url !== "undefined";
  if (!looksImageLike) return "";

  const alt =
    type === "image_generation_call"
      ? `Generated image ${index}`
      : `Image ${index}`;
  const imageUrl =
    typeof part.image_url === "string"
      ? part.image_url
      : part.image_url &&
          typeof part.image_url === "object" &&
          typeof (part.image_url as { url?: unknown }).url === "string"
        ? (part.image_url as { url: string }).url
        : typeof part.url === "string"
          ? part.url
          : "";
  if (imageUrl) return toImageMarkdown(imageUrl, alt);

  const base64 =
    typeof part.result === "string"
      ? part.result
      : typeof part.b64_json === "string"
        ? part.b64_json
        : typeof part.data === "string"
          ? part.data
          : "";
  if (!base64) return "";
  if (base64.trim().startsWith("data:image/")) {
    return toImageMarkdown(base64, alt);
  }
  const mimeType = normalizeImageMimeType(
    part.mime_type || part.media_type || part.output_format || part.format,
  );
  return toImageMarkdown(`data:${mimeType};base64,${base64.trim()}`, alt);
}

function extractResponsesOutputText(data: {
  output_text?: string;
  output?: Array<{
    type?: string;
    result?: string;
    b64_json?: string;
    data?: string;
    image_url?: string | { url?: string };
    url?: string;
    mime_type?: string;
    media_type?: string;
    output_format?: string;
    format?: string;
    content?: Array<{
      type?: string;
      text?: string;
      result?: string;
      b64_json?: string;
      data?: string;
      image_url?: string | { url?: string };
      url?: string;
      mime_type?: string;
      media_type?: string;
      output_format?: string;
      format?: string;
    }>;
  }>;
}): string {
  const chunks: string[] = [];
  let hasOutputContentText = false;
  let imageIndex = 1;

  for (const item of data?.output || []) {
    const itemImage = extractOutputImageMarkdown(item, imageIndex);
    if (itemImage) {
      chunks.push(itemImage);
      imageIndex += 1;
    }
    for (const content of item.content || []) {
      if (
        (content.type === "output_text" || content.type === "text") &&
        content.text
      ) {
        chunks.push(content.text);
        hasOutputContentText = true;
        continue;
      }
      const contentImage = extractOutputImageMarkdown(content, imageIndex);
      if (contentImage) {
        chunks.push(contentImage);
        imageIndex += 1;
      }
    }
  }

  if (data?.output_text && !hasOutputContentText) {
    chunks.unshift(data.output_text);
  }
  return chunks.filter(Boolean).join("\n\n");
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Call an OpenAI-compatible image generation endpoint.
 *
 * This intentionally stays separate from chat completions: text models can
 * produce image references in normal replies, while this is an explicit
 * generation action suitable for a UI button or future command surface.
 */
export async function callImageGeneration(
  params: ImageGenerationParams,
): Promise<GeneratedImage[]> {
  const prompt = params.prompt.trim();
  if (!prompt) {
    throw new Error("Image prompt is empty");
  }

  const {
    apiBase,
    apiKey,
    model: configuredModel,
  } = getImageApiConfig({
    apiBase: params.apiBase,
    apiKey: params.apiKey,
    model: params.model,
  });
  const oauthProvider = markerToProvider(apiBase);
  if (oauthProvider) {
    const text = await chatWithProviderOAuth({
      provider: oauthProvider,
      model: params.model || configuredModel || DEFAULT_MODEL,
      prompt,
      context: params.context,
      history: params.history,
      systemPrompt:
        "Generate an image for the user's prompt. Use the image_generation tool and return the generated image.",
      signal: params.signal,
      images: params.images,
      imageGeneration: true,
    });
    const images = parseImageMarkdownResults(normalizeModelOutput(text).text);
    if (!images.length) {
      throw new Error(
        "The current OAuth provider did not return an image. It may not support image_generation for this model.",
      );
    }
    return images;
  }
  if (!apiKey) {
    throw new Error("Image generation requires an API key");
  }
  const model = isImageGenerationEndpointModel(params.model)
    ? params.model!.trim()
    : (
        getPref("imageGenerationModel") || DEFAULT_IMAGE_GENERATION_MODEL
      ).trim();

  const payload: Record<string, unknown> = {
    model,
    prompt: buildImagePromptWithChatInputs(params, prompt),
  };
  if (params.size) payload.size = params.size;
  if (params.quality) payload.quality = params.quality;
  if (params.background) payload.background = params.background;
  if (params.outputFormat) payload.output_format = params.outputFormat;

  const url = resolveEndpoint(apiBase, IMAGE_GENERATIONS_ENDPOINT);
  const res = await fetchWithTransientRetry(getFetch(), url, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: params.signal,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${res.statusText} - ${err}`);
  }

  const data = (await res.json()) as ImageGenerationResponse;
  const images = (data.data || [])
    .map((entry): GeneratedImage | null => {
      const mimeType = normalizeImageMimeType(
        entry.mime_type || entry.output_format || params.outputFormat,
      );
      const base64 = (entry.b64_json || "").trim();
      const urlValue = (entry.url || "").trim();
      if (base64) {
        return {
          mimeType,
          base64,
          dataUrl: `data:${mimeType};base64,${base64}`,
          revisedPrompt: entry.revised_prompt,
        };
      }
      if (urlValue) {
        return {
          mimeType,
          url: urlValue,
          revisedPrompt: entry.revised_prompt,
        };
      }
      return null;
    })
    .filter((entry): entry is GeneratedImage => Boolean(entry));

  if (!images.length) {
    throw new Error("Image generation returned no images");
  }

  return images;
}

/**
 * Call LLM API (non-streaming)
 */
export async function callLLM(params: ChatParams): Promise<string> {
  const { apiBase, apiKey, model, systemPrompt } = getApiConfig({
    apiBase: params.apiBase,
    apiKey: params.apiKey,
    model: params.model,
  });
  const oauthProvider = markerToProvider(apiBase);
  if (oauthProvider) {
    const rawText = await chatWithProviderOAuth({
      provider: oauthProvider,
      model,
      prompt: params.prompt,
      context: params.context,
      history: params.history,
      systemPrompt,
      signal: params.signal,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      images: params.images,
    });
    return normalizeModelOutput(rawText).text;
  }
  const messages = buildMessages(params, systemPrompt);
  const useResponses = isResponsesBase(apiBase);
  const responseFileIds = useResponses
    ? await uploadFilesForResponses({
        apiBase,
        apiKey,
        attachments: params.attachments,
        signal: params.signal,
      })
    : [];
  const effectiveTemperature = normalizeOptionalTemperature(params.temperature);
  const effectiveMaxTokens = normalizeOptionalMaxTokens(params.maxTokens);
  const parameterSource = getOptionalParameterSource({
    effectiveTemperature,
    effectiveMaxTokens,
  });

  const url = resolveEndpoint(
    apiBase,
    useResponses ? RESPONSES_ENDPOINT : API_ENDPOINT,
  );
  const buildPayload = createChatPayloadBuilder({
    model,
    messages,
    useResponses,
    responseFileIds,
    apiBase,
    effectiveTemperature,
    effectiveMaxTokens,
    stream: false,
  });
  const res = await postWithReasoningFallback({
    url,
    apiKey,
    modelName: model,
    initialReasoning: params.reasoning,
    buildPayload,
    logPayload: (payload) =>
      logLlmParameterPolicy({
        provider: "openai-compatible",
        model,
        endpointType: useResponses ? "responses" : "chat-completions",
        payload,
        parameterSource,
      }),
    signal: params.signal,
  });

  const data = (await res.json()) as CompletionResponse & {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (useResponses) {
    return normalizeModelOutput(extractResponsesOutputText(data)).text;
  }
  return normalizeModelOutput(
    normalizeStreamText(
      data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "",
    ),
  ).text;
}

/**
 * Execute a single XHR streaming request. Returns the accumulated text.
 * Rejects on HTTP errors, network errors, or abort.
 */
function xhrStream(params: {
  XHRCtor: typeof XMLHttpRequest;
  url: string;
  apiKey: string;
  payload: Record<string, unknown>;
  signal?: AbortSignal;
  onDelta: (delta: string) => void;
  onReasoning?: (event: ReasoningEvent) => void;
}): Promise<string> {
  const { XHRCtor, url, apiKey, payload, signal, onDelta, onReasoning } =
    params;
  return new Promise<string>((resolve, reject) => {
    const xhr = new XHRCtor();
    xhr.open("POST", url, true);

    const headers = buildHeaders(apiKey);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.responseType = "text";
    let fullText = "";
    let processedLength = 0;
    let sseBuffer = "";

    // Handle abort signal
    if (signal) {
      if (signal.aborted) {
        reject(createAbortError());
        return;
      }
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(createAbortError());
      });
    }

    const processSseLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data) as { choices?: StreamChoice[] };
        const choice = parsed?.choices?.[0];
        const reasoningDelta = normalizeStreamText(
          choice?.delta?.reasoning_content ??
            choice?.delta?.reasoning_details ??
            choice?.delta?.reasoning ??
            choice?.delta?.thinking ??
            choice?.delta?.thought ??
            choice?.message?.reasoning_content ??
            choice?.message?.reasoning_details ??
            choice?.message?.reasoning ??
            choice?.message?.thinking ??
            choice?.message?.thought ??
            "",
        );
        if (reasoningDelta && onReasoning) {
          onReasoning({ details: reasoningDelta });
        }
        const deltaRaw = normalizeStreamText(
          choice?.delta?.content ?? choice?.message?.content ?? "",
        );
        if (deltaRaw) {
          fullText += deltaRaw;
          onDelta(deltaRaw);
        }
      } catch (err) {
        ztoolkit.log("LLM XHR stream parse error:", err);
      }
    };

    const processChunk = () => {
      const currentText = xhr.responseText || "";
      if (currentText.length <= processedLength) return;
      const newData = currentText.slice(processedLength);
      processedLength = currentText.length;
      sseBuffer += newData;
      const lines = sseBuffer.split(/\r?\n/);
      sseBuffer = lines.pop() || "";
      for (const line of lines) processSseLine(line);
    };

    xhr.onprogress = processChunk;

    xhr.onload = () => {
      // Process any remaining data
      processChunk();
      if (sseBuffer.trim()) {
        processSseLine(sseBuffer);
        sseBuffer = "";
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(fullText);
      } else {
        reject(
          new Error(
            `${xhr.status} ${xhr.statusText} - ${(xhr.responseText || "").slice(0, 200)}`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during streaming request"));
    };

    xhr.onabort = () => {
      reject(createAbortError());
    };

    xhr.send(JSON.stringify(payload));
  });
}

/**
 * Call LLM API with streaming response
 */
export async function callLLMStream(
  params: ChatParams,
  onDelta: (delta: string) => void,
  onReasoning?: (event: ReasoningEvent) => void,
): Promise<string> {
  const outputNormalizer = new ModelOutputStreamNormalizer();
  let sawRawContent = false;
  const dispatchNormalizedEvents = (
    events: ReturnType<ModelOutputStreamNormalizer["push"]>,
  ) => {
    for (const event of events) {
      if (event.type === "content") {
        onDelta(event.text);
      } else if (event.type === "reasoning" && onReasoning) {
        onReasoning(
          event.channel === "summary"
            ? { summary: event.text }
            : { details: event.text },
        );
      }
    }
  };
  const rawOnDelta = (delta: string) => {
    if (!delta) return;
    sawRawContent = true;
    dispatchNormalizedEvents(
      outputNormalizer.push({ type: "content", text: delta }),
    );
  };
  const rawOnReasoning = (event: ReasoningEvent) => {
    if (event.summary) {
      dispatchNormalizedEvents(
        outputNormalizer.push({
          type: "reasoning",
          text: event.summary,
          channel: "summary",
        }),
      );
    }
    if (event.details) {
      dispatchNormalizedEvents(
        outputNormalizer.push({
          type: "reasoning",
          text: event.details,
          channel: "details",
        }),
      );
    }
  };
  const finishNormalizedOutput = (rawFallback = ""): string => {
    if (!sawRawContent && rawFallback) {
      rawOnDelta(rawFallback);
    }
    const completed = outputNormalizer.finish();
    dispatchNormalizedEvents(completed.events);
    return completed.output.text;
  };

  const { apiBase, apiKey, model, systemPrompt } = getApiConfig({
    apiBase: params.apiBase,
    apiKey: params.apiKey,
    model: params.model,
  });
  const oauthProvider = markerToProvider(apiBase);
  if (oauthProvider) {
    const rawText = await chatWithProviderOAuth({
      provider: oauthProvider,
      model,
      prompt: params.prompt,
      context: params.context,
      history: params.history,
      systemPrompt,
      signal: params.signal,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      images: params.images,
      onDelta: rawOnDelta,
    });
    return finishNormalizedOutput(rawText);
  }
  const messages = buildMessages(params, systemPrompt);
  const useResponses = isResponsesBase(apiBase);
  const responseFileIds = useResponses
    ? await uploadFilesForResponses({
        apiBase,
        apiKey,
        attachments: params.attachments,
        signal: params.signal,
      })
    : [];
  const effectiveTemperature = normalizeOptionalTemperature(params.temperature);
  const effectiveMaxTokens = normalizeOptionalMaxTokens(params.maxTokens);
  const parameterSource = getOptionalParameterSource({
    effectiveTemperature,
    effectiveMaxTokens,
  });

  const url = resolveEndpoint(
    apiBase,
    useResponses ? RESPONSES_ENDPOINT : API_ENDPOINT,
  );
  const buildPayload = createChatPayloadBuilder({
    model,
    messages,
    useResponses,
    responseFileIds,
    apiBase,
    effectiveTemperature,
    effectiveMaxTokens,
    stream: true,
  });
  const buildEffectivePayload = (
    reasoningOverride: ReasoningConfig | undefined,
  ) =>
    applyProviderOutputCapabilities({
      url,
      model,
      payload: buildPayload(reasoningOverride),
    });

  // ----- XHR-based streaming (works in Zotero Gecko) -----
  // Skip XHR for Responses API — its SSE event format is incompatible
  // with the standard `data: {choices:[...]}` parser used below.
  // The fetch-based `parseResponsesStream` handles it correctly.
  const XHRCtor =
    !useResponses &&
    ((typeof XMLHttpRequest !== "undefined"
      ? XMLHttpRequest
      : ztoolkit?.getGlobal?.("XMLHttpRequest")) as
      typeof XMLHttpRequest | undefined);

  if (XHRCtor) {
    // Apply cached temperature policy if available
    const policyKey = getTemperaturePolicyKey(
      url,
      buildEffectivePayload(params.reasoning),
    );
    const cachedPolicy = temperaturePolicyCache.get(policyKey);

    // Build payload with reasoning and temperature policies applied
    let currentReasoning = params.reasoning;
    let payload = buildEffectivePayload(currentReasoning);
    if (
      cachedPolicy &&
      Object.prototype.hasOwnProperty.call(payload, "temperature")
    ) {
      payload = applyTemperaturePolicy(payload, cachedPolicy);
    }

    const maxRetries = 3;
    let retries = 0;
    let retriedWithoutMiniMaxReasoningSplit = false;
    const attemptedReasoningKeys = new Set<string>([
      currentReasoning
        ? `${currentReasoning.provider}:${currentReasoning.level}`
        : "none",
    ]);

    while (retries <= maxRetries) {
      try {
        logLlmParameterPolicy({
          provider: "openai-compatible",
          model,
          endpointType: "chat-completions",
          payload,
          parameterSource,
        });
        const rawText = await withTransientRetry(
          async () =>
            xhrStream({
              XHRCtor,
              url,
              apiKey,
              payload,
              signal: params.signal,
              onDelta: rawOnDelta,
              onReasoning: rawOnReasoning,
            }),
          {
            signal: params.signal,
            shouldRetryError: isRetryableTransientError,
            onRetry: ({ attempt, maxAttempts, error }) => {
              ztoolkit.log(
                `LLM: transient XHR upstream error, retry ${attempt}/${maxAttempts - 1}`,
                error,
              );
            },
          },
        );
        return finishNormalizedOutput(rawText);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        if (
          !retriedWithoutMiniMaxReasoningSplit &&
          Object.prototype.hasOwnProperty.call(payload, "reasoning_split") &&
          isMiniMaxReasoningSplitRejection(message)
        ) {
          disableMiniMaxReasoningSplit(url, model);
          retriedWithoutMiniMaxReasoningSplit = true;
          payload = buildEffectivePayload(currentReasoning);
          if (
            cachedPolicy &&
            Object.prototype.hasOwnProperty.call(payload, "temperature")
          ) {
            payload = applyTemperaturePolicy(payload, cachedPolicy);
          }
          retries += 1;
          continue;
        }

        // Check for recoverable reasoning errors (400/422 with reasoning keywords)
        if (isReasoningErrorMessage(message)) {
          const recovered = getReasoningRecoverySelection({
            currentReasoning,
            modelName: model,
          });
          if (recovered !== null) {
            const nextKey = recovered
              ? `${recovered.provider}:${recovered.level}`
              : "none";
            if (!attemptedReasoningKeys.has(nextKey)) {
              attemptedReasoningKeys.add(nextKey);
              currentReasoning = recovered;
              payload = buildEffectivePayload(currentReasoning);
              if (
                cachedPolicy &&
                Object.prototype.hasOwnProperty.call(payload, "temperature")
              ) {
                payload = applyTemperaturePolicy(payload, cachedPolicy);
              }
              retries += 1;
              continue;
            }
          }
        }

        // Check for recoverable temperature errors (400/422 with temperature keywords)
        const status = parseHttpStatusFromErrorMessage(message);
        if (
          (status === 400 || status === 422) &&
          message.toLowerCase().includes("temperature") &&
          Object.prototype.hasOwnProperty.call(payload, "temperature")
        ) {
          const recoveryPolicy = getTemperatureRecoveryPolicy(status, message);
          if (recoveryPolicy) {
            payload = applyTemperaturePolicy(
              buildEffectivePayload(currentReasoning),
              recoveryPolicy,
            );
            temperaturePolicyCache.set(policyKey, recoveryPolicy);
            retries += 1;
            continue;
          }
        }

        // Non-recoverable error — re-throw
        throw err;
      }
    }
  }

  // ----- Fallback: fetch-based streaming or non-streaming -----
  const res = await postWithReasoningFallback({
    url,
    apiKey,
    modelName: model,
    initialReasoning: params.reasoning,
    buildPayload,
    logPayload: (payload) =>
      logLlmParameterPolicy({
        provider: "openai-compatible",
        model,
        endpointType: useResponses ? "responses" : "chat-completions",
        payload,
        parameterSource,
      }),
    signal: params.signal,
  });

  if (!res.body) {
    return finishNormalizedOutput(await callLLM(params));
  }

  const rawText = useResponses
    ? await parseResponsesStream(res.body, rawOnDelta, rawOnReasoning)
    : await parseStreamResponse(res.body, rawOnDelta, rawOnReasoning);
  return finishNormalizedOutput(rawText);
}

/**
 * Call embeddings API
 */
export async function callEmbeddings(
  input: string[],
  overrides?: { apiBase?: string; apiKey?: string },
): Promise<number[][]> {
  const { apiBase, apiKey, embeddingModel } = getApiConfig({
    apiBase: overrides?.apiBase,
    apiKey: overrides?.apiKey,
  });
  if (markerToProvider(apiBase)) {
    return callProviderEmbeddingsUnsupported();
  }
  const payload = {
    model: embeddingModel,
    input,
  };

  const url = resolveEndpoint(apiBase, EMBEDDINGS_ENDPOINT);
  const res = await fetchWithTransientRetry(getFetch(), url, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }

  const data = (await res.json()) as EmbeddingResponse;
  const embeddings = data?.data?.map((item) => item.embedding || []) || [];
  return embeddings;
}

/**
 * Parse SSE stream response
 */
async function parseStreamResponse(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
  onReasoning?: (event: ReasoningEvent) => void,
): Promise<string> {
  const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as { choices?: StreamChoice[] };
          const choice = parsed?.choices?.[0];
          const reasoningDelta = normalizeStreamText(
            choice?.delta?.reasoning_content ??
              choice?.delta?.reasoning_details ??
              choice?.delta?.reasoning ??
              choice?.delta?.thinking ??
              choice?.delta?.thought ??
              choice?.message?.reasoning_content ??
              choice?.message?.reasoning_details ??
              choice?.message?.reasoning ??
              choice?.message?.thinking ??
              choice?.message?.thought ??
              "",
          );
          if (reasoningDelta && onReasoning) {
            onReasoning({ details: reasoningDelta });
          }

          const deltaRaw = normalizeStreamText(
            choice?.delta?.content ?? choice?.message?.content ?? "",
          );
          if (deltaRaw) {
            fullText += deltaRaw;
            onDelta(deltaRaw);
          }
        } catch (err) {
          ztoolkit.log("LLM stream parse error:", err);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}

async function parseResponsesStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: string) => void,
  onReasoning?: (event: ReasoningEvent) => void,
): Promise<string> {
  const reader = body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";
  let sawOutputTextDelta = false;
  let sawSummaryDelta = false;
  let sawDetailsDelta = false;
  let sawSummaryFinal = false;
  let sawDetailsFinal = false;
  const emittedImageMarkdown = new Set<string>();

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as {
            type?: string;
            delta?: string;
            text?: string;
            summary?: Array<{ type?: string; text?: string }> | string;
            reasoning?: string | Array<{ text?: string; summary?: string }>;
            message?: { content?: string };
            response?: {
              output_text?: string;
              output?: Array<{
                type?: string;
                result?: string;
                b64_json?: string;
                data?: string;
                image_url?: string | { url?: string };
                url?: string;
                mime_type?: string;
                media_type?: string;
                output_format?: string;
                format?: string;
                content?: Array<{
                  type?: string;
                  text?: string;
                  summary?: string;
                  result?: string;
                  b64_json?: string;
                  data?: string;
                  image_url?: string | { url?: string };
                  url?: string;
                  mime_type?: string;
                  media_type?: string;
                  output_format?: string;
                  format?: string;
                }>;
                summary?: Array<{ type?: string; text?: string }> | string;
              }>;
            };
            item?: {
              type?: string;
              result?: string;
              b64_json?: string;
              data?: string;
              image_url?: string | { url?: string };
              url?: string;
              mime_type?: string;
              media_type?: string;
              output_format?: string;
              format?: string;
              content?: Array<{
                type?: string;
                text?: string;
                result?: string;
                b64_json?: string;
                data?: string;
                image_url?: string | { url?: string };
                url?: string;
                mime_type?: string;
                media_type?: string;
                output_format?: string;
                format?: string;
              }>;
            };
          };

          const normalizeReasoningText = (value: unknown): string => {
            if (typeof value === "string") return value;
            if (Array.isArray(value)) {
              return value
                .map((entry) => {
                  if (typeof entry === "string") return entry;
                  if (entry && typeof entry === "object") {
                    const row = entry as { text?: string; summary?: string };
                    return row.text || row.summary || "";
                  }
                  return "";
                })
                .filter(Boolean)
                .join("\n");
            }
            if (value && typeof value === "object") {
              const row = value as { text?: string; summary?: string };
              return row.text || row.summary || "";
            }
            return "";
          };

          const extractSummary = (
            value: Array<{ type?: string; text?: string }> | string | undefined,
          ): string => {
            if (!value) return "";
            if (typeof value === "string") return value;
            return value
              .map((entry) => entry.text || "")
              .filter(Boolean)
              .join("\n");
          };

          const emitReasoning = (event: ReasoningEvent) => {
            if (!onReasoning) return;
            const summary =
              typeof event.summary === "string" && event.summary.length > 0
                ? event.summary
                : undefined;
            const details =
              typeof event.details === "string" && event.details.length > 0
                ? event.details
                : undefined;
            if (!summary && !details) return;
            onReasoning({ summary, details });
          };

          const emitImageMarkdown = (value: unknown) => {
            const markdown = extractOutputImageMarkdown(
              value,
              emittedImageMarkdown.size + 1,
            );
            if (!markdown || emittedImageMarkdown.has(markdown)) return;
            emittedImageMarkdown.add(markdown);
            const delta = fullText ? `\n\n${markdown}` : markdown;
            fullText += delta;
            onDelta(delta);
          };

          if (parsed.type === "response.output_text.delta" && parsed.delta) {
            sawOutputTextDelta = true;
            fullText += parsed.delta;
            onDelta(parsed.delta);
            continue;
          }

          if (parsed.type === "response.output_text.done" && parsed.text) {
            // Some providers emit full text in `done` after streaming deltas.
            // Ignore it when delta events have already been consumed.
            if (sawOutputTextDelta) {
              continue;
            }
            fullText += parsed.text;
            onDelta(parsed.text);
            continue;
          }

          if (
            parsed.type === "response.completed" &&
            parsed.response?.output_text
          ) {
            if (!fullText) {
              fullText = parsed.response.output_text;
              onDelta(parsed.response.output_text);
            }
          }

          if (
            (parsed.type === "response.reasoning_summary.delta" ||
              parsed.type === "response.reasoning_summary_text.delta") &&
            parsed.delta
          ) {
            sawSummaryDelta = true;
            emitReasoning({ summary: parsed.delta });
            continue;
          }

          if (
            (parsed.type === "response.reasoning_summary.done" ||
              parsed.type === "response.reasoning_summary_text.done") &&
            (parsed.text || parsed.delta)
          ) {
            sawSummaryFinal = true;
            if (!sawSummaryDelta) {
              emitReasoning({ summary: parsed.text || parsed.delta });
            }
            continue;
          }

          if (
            (parsed.type === "response.reasoning.delta" ||
              parsed.type === "response.reasoning_text.delta") &&
            parsed.delta
          ) {
            sawDetailsDelta = true;
            emitReasoning({ details: parsed.delta });
            continue;
          }

          if (
            (parsed.type === "response.reasoning.done" ||
              parsed.type === "response.reasoning_text.done") &&
            (parsed.text || parsed.delta)
          ) {
            sawDetailsFinal = true;
            if (!sawDetailsDelta) {
              emitReasoning({ details: parsed.text || parsed.delta });
            }
            continue;
          }

          if (parsed.type === "response.reasoning" && parsed.reasoning) {
            sawDetailsFinal = true;
            if (!sawDetailsDelta) {
              emitReasoning({
                details: normalizeReasoningText(parsed.reasoning),
              });
            }
            continue;
          }

          if (
            parsed.type === "response.output_item.added" ||
            parsed.type === "response.output_item.done" ||
            parsed.type === "response.completed"
          ) {
            if (parsed.item) {
              emitImageMarkdown(parsed.item);
              for (const content of parsed.item.content || []) {
                emitImageMarkdown(content);
              }
            }
            const outputs = parsed.response?.output || [];
            for (const out of outputs) {
              emitImageMarkdown(out);
              for (const content of out.content || []) {
                emitImageMarkdown(content);
              }
              if (out.type !== "reasoning") continue;
              if (!sawSummaryDelta && !sawSummaryFinal) {
                emitReasoning({
                  summary: extractSummary(out.summary),
                });
              }
              if (!sawDetailsDelta && !sawDetailsFinal) {
                emitReasoning({
                  details: normalizeReasoningText(out.content),
                });
              }
            }
          }
        } catch (err) {
          ztoolkit.log("LLM responses stream parse error:", err);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
