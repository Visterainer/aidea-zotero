import { config } from "../../../package.json";
import { ReasoningLevel as LLMReasoningLevel } from "../../utils/llmClient";

// =============================================================================
// Constants
// =============================================================================

export const PANE_ID = "llm-context-panel";
export const MAX_CONTEXT_LENGTH = 200000;
export const MAX_CONTEXT_LENGTH_WITH_IMAGE = 100000;
export const FORCE_FULL_CONTEXT = true;
export const FULL_CONTEXT_CHAR_LIMIT = 500000;
export const CHUNK_TARGET_LENGTH = 2000;
export const CHUNK_OVERLAP = 200;
export const MAX_CONTEXT_CHUNKS = 60;
export const EMBEDDING_BATCH_SIZE = 16;
export const HYBRID_WEIGHT_BM25 = 0.5;
export const HYBRID_WEIGHT_EMBEDDING = 0.5;
export const MAX_HISTORY_MESSAGES = 12;
export const PERSISTED_HISTORY_LIMIT = 200;
export const AUTO_SCROLL_BOTTOM_THRESHOLD = 64;
export const FONT_SCALE_DEFAULT_PERCENT = 120;
export const FONT_SCALE_MIN_PERCENT = 80;
export const FONT_SCALE_MAX_PERCENT = 180;
export const FONT_SCALE_STEP_PERCENT = 10;
export const SELECTED_TEXT_MAX_LENGTH = 4000;
export const SELECTED_TEXT_PREVIEW_LENGTH = 240;
export const MAX_SELECTED_TEXT_CONTEXTS = 20;
export const INLINE_CONTEXT_COLLAPSE_THRESHOLD = 3;
export const MAX_EDITABLE_SHORTCUTS = 10;
export const MAX_SELECTED_IMAGES = 50;
export const MAX_UPLOAD_PDF_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_SELECTED_PAPER_CONTEXTS = 20;
export const CHAT_ATTACHMENTS_DIR_NAME = "chat-attachments";
export const PAPER_CONVERSATION_KEY_BASE = 1_000_000_000;
export const GLOBAL_CONVERSATION_KEY_BASE = 2_000_000_000;
export const GLOBAL_HISTORY_LIMIT = 10;
export const PAPER_HISTORY_LIMIT = 10;
export const ACTIVE_PAPER_MULTI_CONTEXT_MAX_CHUNKS = 40;
export const ACTIVE_PAPER_MULTI_CONTEXT_MAX_LENGTH = 150000;
export const SUPPLEMENTAL_PAPER_CONTEXT_MAX_CHUNKS = 20;
export const SUPPLEMENTAL_PAPER_CONTEXT_MAX_LENGTH = 60000;
export const SUPPLEMENTAL_PAPER_CONTEXT_TOTAL_MAX_LENGTH = 200000;
export const CONTEXT_COMPACTION_THRESHOLD = 150000; // ~37K tokens; triggers Zone B compression
export const RECENT_TURNS_PROTECTED = 5; // Zone C: keep last 5 turns (10 messages) intact

export function formatFigureCountLabel(
  count: number,
  maxCount = MAX_SELECTED_IMAGES,
): string {
  if (count <= 0) return "";
  const noun = count === 1 ? "Figure" : "Figures";
  if (!Number.isFinite(maxCount)) return `${noun} (${count})`;
  return `${noun} (${count}/${maxCount})`;
}

export function formatFileCountLabel(count: number): string {
  if (count <= 0) return "";
  return `Files (${count})`;
}

export function formatPaperCountLabel(
  count: number,
  maxCount = MAX_SELECTED_PAPER_CONTEXTS,
): string {
  if (count <= 0) return "";
  if (!Number.isFinite(maxCount)) return `Papers (${count})`;
  return `Papers (${count}/${maxCount})`;
}

export const SELECT_TEXT_EXPANDED_LABEL = "Add Text";
export const SELECT_TEXT_COMPACT_LABEL = "";
export const SCREENSHOT_EXPANDED_LABEL = "Screenshots";
export const SCREENSHOT_COMPACT_LABEL = "";
export const UPLOAD_FILE_EXPANDED_LABEL = "";
export const UPLOAD_FILE_COMPACT_LABEL = "";
export const REASONING_COMPACT_LABEL = "";
export const ACTION_LAYOUT_FULL_MODE_BUFFER_PX = 0;
export const ACTION_LAYOUT_PARTIAL_MODE_BUFFER_PX = 0;
export const ACTION_LAYOUT_CONTEXT_ICON_WIDTH_PX = 36;
export const ACTION_LAYOUT_DROPDOWN_ICON_WIDTH_PX = 56;
export const ACTION_LAYOUT_MODEL_WRAP_MIN_CHARS = 12;
export const ACTION_LAYOUT_MODEL_FULL_MAX_LINES = 3;
export const CUSTOM_SHORTCUT_ID_PREFIX = "custom-shortcut";

export const BUILTIN_SHORTCUT_FILES = [
  { id: "translate", label: "Translate", file: "translate.txt" },
  { id: "summarize", label: "Summarize", file: "summarize.txt" },
  { id: "key-points", label: "Key Points", file: "key-points.txt" },
  { id: "methodology", label: "Methodology", file: "methodology.txt" },
  { id: "limitations", label: "Limitations", file: "limitations.txt" },
] as const;

export const STOPWORDS = new Set([
  // English stop words
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
  "but",
  "not",
  "you",
  "your",
  "our",
  "their",
  "its",
  "they",
  "them",
  "can",
  "could",
  "may",
  "might",
  "will",
  "would",
  "also",
  "than",
  "then",
  "into",
  "about",
  "what",
  "which",
  "when",
  "where",
  "how",
  "why",
  "who",
  "whom",
  "been",
  "being",
  "such",
  "over",
  "under",
  "between",
  "within",
  "using",
  "use",
  "used",
  "via",
  "per",
  "et",
  "al",
  // Chinese stop words (common function words / particles)
  "的",
  "了",
  "在",
  "是",
  "我",
  "有",
  "和",
  "就",
  "不",
  "人",
  "都",
  "一",
  "个",
  "上",
  "也",
  "很",
  "到",
  "说",
  "要",
  "去",
  "你",
  "会",
  "着",
  "没",
  "那",
  "这",
  "她",
  "他",
  "它",
  "吗",
  "吧",
  "呢",
  "啊",
  "把",
  "被",
  "让",
  "给",
  "从",
  "对",
  "而",
  "但",
  "以",
  "与",
  "及",
  "或",
  "等",
  "所",
  "其",
  "如",
  "之",
  "于",
  "为",
  "则",
  "因",
  "由",
  "此",
]);

export type ModelProfileKey =
  | "primary"
  | "secondary"
  | "tertiary"
  | "quaternary";

export const MODEL_PROFILE_ORDER: ModelProfileKey[] = [
  "primary",
  "secondary",
  "tertiary",
  "quaternary",
];
export const ASSISTANT_NOTE_MAP_PREF_KEY = "assistantNoteMap";

export const MODEL_PROFILE_SUFFIX: Record<ModelProfileKey, string> = {
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Tertiary",
  quaternary: "Quaternary",
};

export { config };
export type { LLMReasoningLevel };
