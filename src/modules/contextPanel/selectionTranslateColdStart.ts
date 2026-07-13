export type SelectionTranslateColdStartAttemptId =
  "full" | "first50" | "first25" | "first15";

export type SelectionTranslateColdStartAttempt = {
  id: SelectionTranslateColdStartAttemptId;
  paperText: string;
  selectedBodyLength: number;
  bodyRatio: number;
};

export type SelectionTranslateColdStartAttemptSet = {
  attempts: SelectionTranslateColdStartAttempt[];
  originalLength: number;
  referenceStrippedLength: number;
  referencesRemoved: boolean;
  referenceHeading?: string;
};

export const SELECTION_TRANSLATE_COLD_START_ALGORITHM_VERSION = "v3-auto";

const REFERENCES_SCAN_START_RATIO = 0.35;

const FALLBACK_RATIOS: Array<{
  id: SelectionTranslateColdStartAttemptId;
  ratio: number;
}> = [
  { id: "full", ratio: 1 },
  { id: "first50", ratio: 0.5 },
  { id: "first25", ratio: 0.25 },
  { id: "first15", ratio: 0.15 },
];

const REFERENCE_HEADINGS = new Set([
  "references",
  "reference",
  "bibliography",
  "works cited",
  "literature cited",
  "\u53c2\u8003\u6587\u732e",
]);

function normalizePaperText(value: string): string {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function normalizeHeading(value: string): string {
  let heading = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  heading = heading.replace(/^chapter\s+[0-9ivxlcdm]+\s*[:.\-)]*\s*/i, "");
  heading = heading.replace(
    /^\u7b2c[\u4e00-\u9fa50-9]+[\u7ae0\u8282\u7bc7]\s*/u,
    "",
  );
  heading = heading.replace(/^[0-9]+(?:\.[0-9]+)*\s*[:.\-)]*\s*/u, "");
  heading = heading.replace(/^[ivxlcdm]+(?:[:.\-)]\s*|\s+)/iu, "");
  heading = heading.replace(/^[-\u2013\u2014\u2022*]+\s*/u, "");
  heading = heading.replace(/\s*[:.\-)\]\u2013\u2014\uff1a]+$/u, "");
  return heading.toLowerCase();
}

function isReferenceHeading(rawLine: string, offset: number, total: number) {
  const line = String(rawLine || "").trim();
  if (!line || line.length > 120) return false;
  if (offset < total * REFERENCES_SCAN_START_RATIO) return false;
  return REFERENCE_HEADINGS.has(normalizeHeading(line));
}

function stripReferences(text: string): {
  text: string;
  removed: boolean;
  heading?: string;
} {
  let offset = 0;
  const lines = text.split("\n");
  for (const line of lines) {
    if (isReferenceHeading(line, offset, text.length)) {
      return {
        text: text.slice(0, offset).trim(),
        removed: true,
        heading: line.trim(),
      };
    }
    offset += line.length + 1;
  }
  return { text, removed: false };
}

function buildMetadataPrefix(params: {
  title?: string;
  abstractNote?: string;
}): string {
  const parts: string[] = [];
  const title = normalizePaperText(params.title || "");
  const abstractNote = normalizePaperText(params.abstractNote || "");
  if (title) parts.push(`Title:\n${title}`);
  if (abstractNote) parts.push(`Abstract:\n${abstractNote}`);
  return parts.join("\n\n");
}

function getBodySliceLength(bodyLength: number, ratio: number): number {
  if (bodyLength <= 0) return 0;
  if (ratio >= 1) return bodyLength;
  return Math.min(bodyLength, Math.max(1, Math.ceil(bodyLength * ratio)));
}

export function buildSelectionTranslateColdStartAttempts(params: {
  title?: string;
  abstractNote?: string;
  pdfText: string;
}): SelectionTranslateColdStartAttemptSet {
  const normalizedPdfText = normalizePaperText(params.pdfText);
  const stripped = stripReferences(normalizedPdfText);
  const metadata = buildMetadataPrefix({
    title: params.title,
    abstractNote: params.abstractNote,
  });
  const attempts = FALLBACK_RATIOS.map(({ id, ratio }) => {
    const selectedBodyLength = getBodySliceLength(stripped.text.length, ratio);
    const selectedBody = stripped.text.slice(0, selectedBodyLength).trim();
    return {
      id,
      paperText: [metadata, selectedBody].filter(Boolean).join("\n\n"),
      selectedBodyLength,
      bodyRatio: ratio,
    };
  });

  return {
    attempts,
    originalLength: normalizedPdfText.length,
    referenceStrippedLength: stripped.text.length,
    referencesRemoved: stripped.removed,
    referenceHeading: stripped.heading,
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message} ${error.stack || ""}`;
  }
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isSelectionTranslateInputLengthError(error: unknown): boolean {
  const text = errorText(error).toLowerCase();
  if (!text) return false;
  return [
    "range of input length",
    "context length",
    "maximum context",
    "max context",
    "too many tokens",
    "input length",
    "token limit",
    "request too large",
    "payload too large",
    "context window",
    "maximum input",
    "tokens exceed",
  ].some((needle) => text.includes(needle));
}

export async function runSelectionTranslateColdStartAttempts<T>(params: {
  attempts: SelectionTranslateColdStartAttempt[];
  run: (attempt: SelectionTranslateColdStartAttempt) => Promise<T>;
}): Promise<{
  attempt: SelectionTranslateColdStartAttempt;
  result: T;
}> {
  for (let index = 0; index < params.attempts.length; index++) {
    const attempt = params.attempts[index];
    try {
      return {
        attempt,
        result: await params.run(attempt),
      };
    } catch (error) {
      const canRetry =
        index < params.attempts.length - 1 &&
        isSelectionTranslateInputLengthError(error);
      if (!canRetry) throw error;
    }
  }
  throw new Error("Cold-start cache generation failed");
}
