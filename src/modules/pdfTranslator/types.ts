/* ---------------------------------------------------------------------------
 * pdfTranslator/types.ts  –  Shared type definitions for the translate module
 * -------------------------------------------------------------------------*/

/** Status of the Python environment for pdf2zh_next */
export type EnvStatus =
  | { status: "no_uv" }
  | { status: "no_venv" }
  | { status: "no_pdf2zh" }
  | { status: "ready"; venvDir: string; pdf2zhBin: string; pythonBin: string };

/** Progress data written by aidea_bridge.py, read by the plugin */
export interface WarningStats {
  sameAsInput?: number;
  lengthMismatch?: number;
  editDistanceSmall?: number;
  fallbackToSimple?: number;
  other?: number;
}

export interface TranslationStats {
  total?: number;
  successful?: number;
  fallback?: number;
}

export interface ProgressData {
  status: "init" | "running" | "done" | "error" | "cancelled";
  progress: number;          // 0–100
  current?: number;          // current page
  total?: number;            // total pages
  message: string;
  stage?: string;            // coarse-grained task phase for UI summaries
  detail?: string;           // latest engine output line (raw)
  outputFiles?: string[];    // populated when status === "done"
  startTime?: number;        // unix timestamp
  error?: string;            // populated when status === "error"
  errorDetail?: string;      // tail logs when bridge/process fails
  logFile?: string;          // bridge log path for diagnosis
  warningCount?: number;     // total warning/fallback-related events
  warningStats?: WarningStats;
  translationStats?: TranslationStats;
  errorCount?: number;
  errorLines?: string[];
  hasErrors?: boolean;
}

/** Parameters to start a translation */
export interface TranslateParams {
  pdfPath: string;           // absolute path to the source PDF
  outputDir: string;         // directory to write translated PDFs
  targetLang: string;        // e.g. "zh-CN"
  sourceLang: string;        // e.g. "en"
  modelId: string;           // LLM model identifier
  generateMono: boolean;     // produce single-language PDF
  generateDual: boolean;     // produce bilingual PDF
  qps?: number;              // queries per second (default 10)
  poolMaxWorker?: number;    // parallel translation workers (default 1)
  // Layout / compatibility
  disableRichTextTranslate?: boolean;
  enhanceCompatibility?: boolean;
  translateTableText?: boolean;
  fontFamily?: "auto" | "serif" | "sans-serif" | "script";
  // OCR / glossary
  ocr?: boolean;
  autoOcr?: boolean;
  saveGlossary?: boolean;
  disableGlossary?: boolean;
  // Output mode / behavior
  dualMode?: "LR" | "TB";
  transFirst?: boolean;
  skipClean?: boolean;
  noWatermark?: boolean;
  // Policy
  skipReferencesAuto?: boolean;
  keepAppendixTranslated?: boolean;
  protectAuthorBlock?: boolean;
}

/** Task descriptor passed to aidea_bridge.py via task.json */
export interface BridgeTask {
  pdf2zhBin: string;
  pdfPath: string;
  outputDir: string;
  configFile: string;
  progressFile: string;
  modelId: string;
  sourceLang: string;
  targetLang: string;
  noDual: boolean;
  noMono: boolean;
  qps: number;
  poolMaxWorker?: number;
  // Layout / compatibility
  disableRichTextTranslate?: boolean;
  enhanceCompatibility?: boolean;
  translateTableText?: boolean;
  fontFamily?: "auto" | "serif" | "sans-serif" | "script";
  // OCR / glossary
  ocr?: boolean;
  autoOcr?: boolean;
  saveGlossary?: boolean;
  disableGlossary?: boolean;
  // Output mode / behavior
  dualMode?: "LR" | "TB";
  transFirst?: boolean;
  skipClean?: boolean;
  noWatermark?: boolean;
  // Policy
  skipReferencesAuto?: boolean;
  keepAppendixTranslated?: boolean;
  protectAuthorBlock?: boolean;
  referencePolicyDebug?: boolean;
  oauthProxy?: {
    provider:
      | "openai-codex"
      | "google-gemini-cli"
      | "github-copilot"
      | "openai-compatible";
    accessToken: string;
    accountId?: string;
    projectId?: string;
    apiBase?: string;
    apiKey?: string;
    supportedEndpoints?: string[];
  };
}

/** Translation controller state machine */
export type TranslateState =
  | "idle"
  | "running"
  | "paused"
  | "done"
  | "error";

/** Supported target languages */
export const TARGET_LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "en",    label: "English" },
  { code: "ja",    label: "日本語" },
  { code: "ko",    label: "한국어" },
  { code: "fr",    label: "Français" },
  { code: "de",    label: "Deutsch" },
  { code: "es",    label: "Español" },
  { code: "ru",    label: "Русский" },
  { code: "pt",    label: "Português" },
] as const;
