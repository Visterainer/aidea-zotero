# Zotero AI Plugin — Technical Architecture

> Last updated: 2026-03-04 (v7)
> Purpose: A comprehensive technical reference for developers to quickly locate code and understand module responsibilities.
>
> [🇨🇳 中文版](./ARCHITECTURE_CN.md)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Build & Development](#3-build--development)
4. [Entry Points & Lifecycle](#4-entry-points--lifecycle)
5. [Core Module: contextPanel](#5-core-module-contextpanel)
6. [Utility Layer: utils](#6-utility-layer-utils)
7. [UI Construction: buildUI.ts](#7-ui-construction-builduits)
8. [Event Handling: setupHandlers.ts](#8-event-handling-setuphandlersts)
9. [Chat Flow: chat.ts](#9-chat-flow-chatts)
   - 9.1. [Streaming Incremental Updates: streamingUpdate.ts](#91-streaming-incremental-updates-streamingupdatets)
10. [Context Resolution: contextResolution.ts](#10-context-resolution-contextresolutionts)
11. [Controller Layer: setupHandlers/controllers](#11-controller-layer-setuphandlerscontrollers)
12. [LLM Client: llmClient.ts](#12-llm-client-llmclientts)
13. [Chat Persistence: chatStore.ts](#13-chat-persistence-chatstorets)
14. [Data Type Definitions: types.ts](#14-data-type-definitions-typests)
15. [Constants: constants.ts](#15-constants-constantsts)
16. [Global State: state.ts](#16-global-state-statets)
17. [CSS Styling System](#17-css-styling-system)
18. [File Preview System](#18-file-preview-system)
19. [Screenshot & Image System](#19-screenshot--image-system)
20. [Paper Context System](#20-paper-context-system)
21. [Panel Cache: libraryPanel / readerPanel](#21-panel-cache-librarypanel--readerpanel)
22. [Preferences](#22-preferences)
23. [File Content Extraction: fileExtraction.ts](#23-file-content-extraction-fileextractionts)
24. [Markdown Rendering: markdown.ts](#24-markdown-rendering-markdownts)
25. [Memory System: memoryStore.ts](#25-memory-system-memorystorets)
26. [OAuth Authentication: oauthCli.ts](#26-oauth-authentication-oauthclits)
27. [Reasoning Profiles: reasoningProfiles.ts](#27-reasoning-profiles-reasoningprofilests)
28. [Shortcut System: shortcuts.ts](#28-shortcut-system-shortcutsts)
29. [Note Export: notes.ts](#29-note-export-notests)
30. [Internationalization: i18n.ts](#30-internationalization-i18nts)
31. [Testing](#31-testing)
32. [Quick Reference Table](#32-quick-reference-table)

---

## 1. Project Overview

| Property           | Value                                   |
| ------------------ | --------------------------------------- |
| Name               | `aidea-for-zotero` (addonName: `AIdea`) |
| Plugin ID          | `aidea@visterainer`                     |
| Pref Prefix        | `extensions.zotero.aidea`               |
| Target Environment | Zotero 7 (Firefox 115 ESR)              |
| Language           | TypeScript → esbuild bundle → JS        |
| Styling            | Vanilla CSS (no framework)              |
| License            | AGPL-3.0-or-later                       |

This plugin provides an **AI chat panel** in Zotero's PDF Reader / Library sidebar, supporting multiple models, multi-turn conversations, file uploads, screenshots, paper context references, and more.

---

## 2. Directory Structure

```
Zotero_LLM_Plugin/
├── addon/                          # Static plugin resources (packed into XPI)
│   ├── bootstrap.js                # Zotero 7 bootstrap entry
│   ├── manifest.json               # Plugin manifest
│   ├── prefs.js                    # Default preference values
│   ├── content/
│   │   ├── zoteroPane.css          # ★ Main CSS file (all panel styles, ~3300 lines)
│   │   ├── icons/                  # SVG icons (action-* + file-type-* + preview-*)
│   │   ├── preferences.xhtml       # Preferences panel UI
│   │   └── scripts/                # Build output directory
│   └── locale/                     # Zotero FTL files (en-US / zh-CN fallback)
│
├── src/                            # TypeScript source code
│   ├── index.ts                    # Global entry (registers addon instance)
│   ├── addon.ts                    # Addon singleton class
│   ├── hooks.ts                    # Lifecycle hooks
│   ├── modules/
│   │   ├── contextPanel/           # ★ Core panel module (see §5)
│   │   └── preferenceScript.ts     # Preferences panel logic (26KB)
│   └── utils/                      # Utility functions layer (see §6)
│
├── test/                           # Unit tests (Mocha + Chai)
├── typings/                        # Global type declarations
├── zotero-plugin.config.ts         # Build configuration
└── package.json                    # Dependencies & scripts
```

---

## 3. Build & Development

### 3.1 Build Commands

```bash
npm run build        # Production build + TypeScript type checking
npm run start        # Development mode (hot reload)
npm run test:unit    # Run unit tests
```

### 3.2 Build Pipeline

Defined in `zotero-plugin.config.ts`:

1. **esbuild** bundles `src/index.ts` into `addon/content/scripts/aidea.js`
   - target: `firefox115`
   - bundle: `true`
2. **zotero-plugin-scaffold** packs all `addon/` resources + bundled JS → `.scaffold/build/zotero-ai.xpi`
3. **tsc --noEmit** performs type checking

### 3.3 Deployment

Build artifact: `.scaffold/build/zotero-ai.xpi`
Install manually via Zotero → Tools → Add-ons.

---

## 4. Entry Points & Lifecycle

### 4.1 Entry Files

| File           | Responsibility                                |
| -------------- | --------------------------------------------- |
| `src/index.ts` | Registers global `Zotero.AIdea` instance      |
| `src/addon.ts` | `Addon` class, holds `data.initialized` state |
| `src/hooks.ts` | Zotero plugin lifecycle hooks                 |

### 4.2 Hook Flow

```
onStartup
  ├── Zotero.initializationPromise / unlockPromise / uiReadyPromise
  ├── initLocale()                   ← i18n
  ├── ensureZoteroProxyFromSystem()  ← Auto-detect system proxy
  ├── initChatStore()                ← Initialize chat DB tables
  ├── initMemoryStore()              ← Initialize memory DB tables
  ├── initAttachmentRefStore()       ← Initialize attachment ref counting
  ├── reconcileNoteAttachmentRefs()  ← Background attachment GC
  ├── registerPrefsPane()            ← Register preferences panel
  └── onMainWindowLoad(win)
       ├── registerLLMStyles(win)            ← Inject CSS
       ├── registerReaderContextPanel()      ← Register sidebar panel
       ├── registerReaderSelectionTracking() ← Monitor PDF selection
       └── injectLibraryPanel(win)           ← Register library panel

onMainWindowUnload(win)
  ├── removeLibraryPanel(win)        ← Cleanup library panel
  ├── removeReaderPanels(win)        ← Cleanup reader panel caches
  └── ztoolkit.unregisterAll()
```

---

## 5. Core Module: contextPanel

**Path**: `src/modules/contextPanel/`

This is the plugin's core module, comprising approximately **29 source files + 1 subdirectory**. It handles chat panel UI construction, event handling, message sending, context management, and all related functionality.

### 5.1 File Inventory

| File                   | Size      | Responsibility                                                           |
| ---------------------- | --------- | ------------------------------------------------------------------------ |
| `index.ts`             | 30KB      | Module public API, panel registration, exclusive mode management         |
| **`setupHandlers.ts`** | **185KB** | ★ Largest file! All UI event bindings (~5236 lines)                      |
| `buildUI.ts`           | 19KB      | DOM element creation                                                     |
| **`chat.ts`**          | **100KB** | ★ Chat message rendering, sending, retry, edit, compaction (~2795 lines) |
| `contextResolution.ts` | 22KB      | Context / selected text resolution                                       |
| `constants.ts`         | 5.5KB     | Constant definitions                                                     |
| `types.ts`             | 3KB       | Type definitions                                                         |
| `state.ts`             | 4KB       | Global state caches (centralized management)                             |
| `textUtils.ts`         | 11KB      | Text processing utilities                                                |
| `screenshot.ts`        | 12KB      | Screenshot capture & optimization                                        |
| `pdfContext.ts`        | 13KB      | PDF content chunking & retrieval                                         |
| `attachmentStorage.ts` | 14KB      | Attachment file management (incl. blob storage)                          |
| `notes.ts`             | 8.5KB     | Zotero note export                                                       |
| `shortcuts.ts`         | 27KB      | Shortcut system                                                          |
| `paperContext.ts`      | 5KB       | Paper reference context                                                  |
| `paperSearch.ts`       | 8KB       | `@` paper search                                                         |
| `paperAttribution.ts`  | 5KB       | Paper attribution parsing                                                |
| `chatScroll.ts`        | 9KB       | Chat scroll management                                                   |
| `streamingUpdate.ts`   | 5KB       | Streaming incremental DOM updates                                        |
| `menuPositioning.ts`   | 3KB       | Floating menu positioning                                                |
| `normalizers.ts`       | 4KB       | Data normalization                                                       |
| `portalScope.ts`       | 2KB       | Global conversation "virtual Item"                                       |
| `prefHelpers.ts`       | 11KB      | Preference R/W helpers (incl. file attachment state persistence)         |
| `readerSelection.ts`   | 2KB       | Reader selection reading                                                 |
| `i18n.ts`              | 5KB       | Panel i18n (12 UI languages)                                             |
| **`libraryPanel.ts`**  | **6KB**   | ★ Library mode panel DOM caching/remounting                              |
| **`readerPanel.ts`**   | **3KB**   | ★ Reader mode panel DOM caching/remounting                               |
| `README.md`            | 3KB       | Module readme                                                            |

### 5.2 Subdirectory setupHandlers/

| File               | Responsibility                                                     |
| ------------------ | ------------------------------------------------------------------ |
| `domRefs.ts` (8KB) | DOM element reference queries (60+ field `querySelector` mappings) |
| `types.ts`         | Internal types for setupHandlers                                   |
| `controllers/`     | Feature controller splits (see §11)                                |

---

## 6. Utility Layer: utils

**Path**: `src/utils/`

| File                    | Size     | Responsibility                                                 |
| ----------------------- | -------- | -------------------------------------------------------------- |
| **`llmClient.ts`**      | **67KB** | ★ LLM API calls (streaming/non-streaming, ~2275 lines)         |
| **`chatStore.ts`**      | **35KB** | ★ Chat persistence (SQLite via Zotero.DB, ~1020 lines)         |
| **`oauthCli.ts`**       | **35KB** | ★ OAuth auth flow (openai-codex / google-gemini-cli)           |
| `markdown.ts`           | 25KB     | Markdown rendering (incl. KaTeX formulas)                      |
| `reasoningProfiles.ts`  | 16KB     | Reasoning profiles (GPT-5/o1/Claude/Gemini/Qwen/DeepSeek etc.) |
| `memoryStore.ts`        | 14KB     | Memory system storage                                          |
| `fileExtraction.ts`     | 10KB     | File content extraction (PDF/MD/code etc.)                     |
| `attachmentRefStore.ts` | 7KB      | Attachment reference counting & GC                             |
| `processRunner.ts`      | 5KB      | Process runner                                                 |
| `apiHelpers.ts`         | 4KB      | API request utilities                                          |
| `locale.ts`             | 3KB      | Locale detection                                               |
| `normalization.ts`      | 1KB      | String normalization                                           |
| `pathFileUrl.ts`        | 1KB      | Path ↔ file:// URL conversion                                  |
| `domHelpers.ts`         | 0.5KB    | `createElement` helper                                         |
| `ztoolkit.ts`           | 2KB      | zotero-plugin-toolkit wrapper                                  |
| `llmDefaults.ts`        | 0.1KB    | LLM default parameters                                         |

---

## 7. UI Construction: buildUI.ts

**Path**: `src/modules/contextPanel/buildUI.ts`
**Core function**: `buildUI(body: Element, item?: Zotero.Item | null)`

This file creates all DOM elements for the panel. Main areas:

```
┌─────────────────────────────────────────┐
│ llm-main                                │
│ ├── llm-header (title bar, history,     │
│ │              export)                  │
│ ├── llm-content                         │
│ │   ├── llm-chat-box (message list)     │
│ │   └── llm-typing-indicator            │
│ ├── llm-input-section                   │
│ │   ├── llm-context-previews            │
│ │   │   ├── #llm-selected-context-list  │
│ │   │   ├── #llm-paper-context-preview  │
│ │   │   ├── .llm-image-preview          │
│ │   │   └── #llm-file-context-preview   │
│ │   ├── llm-input (textarea)            │
│ │   └── llm-actions (action bar)        │
│ └── llm-status                          │
└─────────────────────────────────────────┘
```

---

## 8. Event Handling: setupHandlers.ts

**Path**: `src/modules/contextPanel/setupHandlers.ts`
**Core function**: `setupHandlers(body: Element, initialItem?: Zotero.Item | null)`

This is the project's **largest single file** (185KB / ~5236 lines), responsible for:

### 8.1 DOM Reference Resolution

Obtains 60+ DOM element references via the `getPanelDomRefs()` function in `setupHandlers/domRefs.ts`.

### 8.2 Key Internal Functions

| Function                    | Approx. Lines | Responsibility                                             |
| --------------------------- | ------------- | ---------------------------------------------------------- |
| `resolveLibraryIdFromItem`  | ~195          | Resolve Item's libraryID                                   |
| `scheduleAttachmentGc`      | ~341          | Attachment garbage collection timer                        |
| `persistScroll`             | ~411          | Persist chat scroll position                               |
| `updateSelectionPopup`      | ~537          | Update selection popup menu                                |
| `updateSelectedTextPreview` | ~700+         | Update selected text preview                               |
| `appendPaperChip`           | ~1162         | Create paper context chip                                  |
| `updatePaperPreview`        | ~1219         | Update paper preview                                       |
| **`updateFilePreview`**     | **~1285**     | **★ File preview rendering (grouped by type + SVG icons)** |
| `updateImagePreview`        | ~1650+        | Screenshot preview rendering                               |
| `appendMessageBubble`       | ~2300+        | Render message bubbles                                     |
| `refreshChat`               | ~3200+        | Refresh entire chat UI                                     |
| `handleSend`                | ~3900+        | Handle send logic                                          |

---

## 9. Chat Flow: chat.ts

**Path**: `src/modules/contextPanel/chat.ts` (100KB, ~2795 lines)

### 9.1 Core Flow

```
User input → handleSend() → buildCombinedContextForRequest()
    → chatWithProvider() / chatWithProviderOAuth()
    → Streaming reception → appendMessageBubble() → renderMarkdown()
    → persistConversationMessage() → updateLatestAssistantMessage()
```

### 9.2 Key Functions

| Function                               | Responsibility                                     |
| -------------------------------------- | -------------------------------------------------- |
| `ensureConversationLoaded`             | Load conversation history                          |
| `persistConversationMessage`           | Persist messages to DB                             |
| `toPanelMessage`                       | DB message → UI message format                     |
| `refreshChat`                          | Render all message bubbles (~730 lines)            |
| `sendQuestion`                         | Send question and handle streaming response        |
| `retryLatestAssistantResponse`         | Retry last AI response (optionally switch model)   |
| `editLatestUserMessageAndRetry`        | Edit last user message and resend                  |
| `buildCombinedContextForRequest`       | Build full context (PDF + papers + memory)         |
| `buildContextRefsSnapshot`             | Build lightweight context snapshot for persistence |
| `restoreContextPoolFromStoredMessages` | Restore context pool from DB                       |
| `restoreFileAttachmentsFromMessages`   | Restore file attachment cache from DB              |
| `compactConversationHistory`           | Zone B/C long conversation compaction              |
| `autoCaptureRequestMemories`           | Automatically extract user memories                |
| `copyRenderedMarkdownToClipboard`      | Copy rendered Markdown (HTML + plain text)         |

### 9.3 Streaming Incremental Updates: streamingUpdate.ts

**Path**: `src/modules/contextPanel/streamingUpdate.ts` (5KB)

Solves the streaming output performance bottleneck: only updates the last assistant bubble's `innerHTML`, instead of full re-rendering.

```text
onDelta(token) → assistantMessage.text += token
  → queueStreamingPatch()              ← 30ms throttle
    → patchStreamingBubble(bubbleRef)   ← Update only 1 bubble
      → contentEl.innerHTML = renderMarkdown(text)
      → autoScrollStreamingIfNeeded()   ← Auto-scroll to bottom
  → Stream ends:
    → finalizeStreamingBubble()         ← Remove streaming class
    → refreshChatSafely()              ← Final consistency full render
```

---

## 10. Context Resolution: contextResolution.ts

**Path**: `src/modules/contextPanel/contextResolution.ts` (22KB)

| Function                             | Responsibility                          |
| ------------------------------------ | --------------------------------------- |
| `getActiveReaderForSelectedTab`      | Get the current tab's Reader            |
| `getActiveContextAttachmentFromTabs` | Get the current reader's PDF attachment |
| `resolveContextSourceItem`           | Resolve the panel Item's source PDF     |
| `getActiveReaderSelectionText`       | Get text selected in Reader             |
| `addSelectedTextContext`             | Add selected text to panel              |
| `applySelectedTextPreview`           | Render selected text preview            |
| `includeSelectedTextFromReader`      | Import selected text from reader        |

---

## 11. Controller Layer: setupHandlers/controllers

**Path**: `src/modules/contextPanel/setupHandlers/controllers/`

| File                               | Size  | Responsibility                                  |
| ---------------------------------- | ----- | ----------------------------------------------- |
| `composeContextController.ts`      | 4KB   | Compose send context (text+images+files+papers) |
| `fileIntakeController.ts`          | 13KB  | File upload handling (drag/paste/select)        |
| `sendFlowController.ts`            | 11KB  | Message send flow control                       |
| `modelSelectionController.ts`      | 6KB   | Model selection & persistence                   |
| `conversationHistoryController.ts` | 2KB   | Conversation history management                 |
| `menuController.ts`                | 2KB   | Menu state control                              |
| `modelReasoningController.ts`      | 0.4KB | Reasoning mode detection                        |

---

## 12. LLM Client: llmClient.ts

**Path**: `src/utils/llmClient.ts` (67KB, ~2275 lines)

### 12.1 Key Functions

| Function                | Responsibility                   |
| ----------------------- | -------------------------------- |
| `getApiConfig()`        | Read API config from preferences |
| `chatWithProvider()`    | Direct API call (streaming)      |
| `callEmbeddings()`      | Call Embedding API               |
| `resolveSystemPrompt()` | Build system prompt              |
| `buildApiPayload()`     | Build API request body           |
| `parseSSEStream()`      | Parse Server-Sent Events stream  |

### 12.2 Streaming Processing

Uses `fetch` + `ReadableStream` for character-by-character streaming output:

```
fetch(apiBase + "/chat/completions") → response.body.getReader()
  → Read chunks → Parse SSE → Extract delta.content → onToken callback
```

---

## 13. Chat Persistence: chatStore.ts

**Path**: `src/utils/chatStore.ts` (35KB, ~1020 lines)

### 13.1 Database Tables

| Table                            | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `zotero_ai_chat_messages`        | Chat message storage (incl. `context_refs_json` lightweight context persistence) |
| `zotero_ai_global_conversations` | Global conversation metadata                                                     |

### 13.2 Key Functions

| Function                                  | Responsibility                                      |
| ----------------------------------------- | --------------------------------------------------- |
| `initChatStore()`                         | Initialize DB tables                                |
| `loadConversation(key, limit)`            | Load conversation messages                          |
| `appendMessage(key, msg)`                 | Append message                                      |
| `updateLatestUserMessage()`               | Update latest user message                          |
| `updateLatestAssistantMessage()`          | Update latest assistant message                     |
| `clearConversation(key)`                  | Clear conversation                                  |
| `pruneConversation(key, keep)`            | Prune conversation to specified count               |
| `createGlobalConversation(libID)`         | Create global conversation                          |
| `listGlobalConversations(libID)`          | List global conversations                           |
| `deleteGlobalConversation(key)`           | Delete global conversation                          |
| `deleteAllGlobalConversationsByLibrary()` | Batch delete all global conversations for a library |
| `clearAllChatHistory()`                   | Clear all chat history                              |
| `getLatestEmptyGlobalConversation()`      | Get latest empty global conversation                |

### 13.3 Conversation Keys

- **Reader mode**: `conversationKey = item.id` (Zotero Item ID)
- **Global mode**: `conversationKey >= 2_000_000_000` (defined by `GLOBAL_CONVERSATION_KEY_BASE`)

---

## 14. Data Type Definitions: types.ts

**Path**: `src/modules/contextPanel/types.ts`

### 14.1 Core Types

```typescript
// Message
interface Message {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  selectedTexts?: string[];
  selectedTextSources?: SelectedTextSource[];
  selectedTextPaperContexts?: (PaperContextRef | undefined)[];
  selectedTextExpandedIndex?: number;
  screenshotImages?: string[];
  screenshotExpanded?: boolean;
  screenshotActiveIndex?: number;
  paperContexts?: PaperContextRef[];
  paperContextsExpanded?: boolean;
  attachments?: ChatAttachment[];
  attachmentsExpanded?: boolean;
  attachmentActiveIndex?: number;
  modelName?: string;
  streaming?: boolean;
}

// File Attachment
type ChatAttachmentCategory = "image" | "pdf" | "markdown" | "code" | "text" | "file";
type ChatAttachment = {
  id: string; name: string; mimeType: string; sizeBytes: number;
  category: ChatAttachmentCategory;
  imageDataUrl?: string; textContent?: string;
  storedPath?: string; contentHash?: string; processing?: boolean;
};

// Paper Reference
type PaperContextRef = {
  itemId: number; contextItemId: number; citationKey?: string;
  title: string; firstCreator?: string; year?: string;
};

// PDF Context
type PdfContext = {
  title: string; chunks: string[]; chunkStats: ChunkStat[];
  docFreq: Record<string, number>; avgChunkLength: number; fullLength: number;
  embeddings?: number[][]; embeddingPromise?: Promise<number[][] | null>;
  embeddingFailed?: boolean;
};

// Lightweight Context Reference (DB persistence)
interface ContextRefsJson {
  basePdf?: { itemId: number; contextItemId: number; title: string; removed?: boolean };
  supplementalPapers?: PaperContextRef[];
  fileAttachmentIds?: string[];
  compactedSummary?: string;
}

// Global Conversation Summary
type GlobalConversationSummary = {
  conversationKey: number; libraryID: number; createdAt: number;
  title?: string; lastActivityAt: number; userTurnCount: number;
};

// Global Virtual Item
type GlobalPortalItem = { __llmGlobalPortalItem: true; id: number; libraryID: number; ... };
```

---

## 15. Constants: constants.ts

**Path**: `src/modules/contextPanel/constants.ts`

| Constant                                      | Value   | Purpose                                       |
| --------------------------------------------- | ------- | --------------------------------------------- |
| `MAX_CONTEXT_LENGTH`                          | 200,000 | Max context character count                   |
| `MAX_CONTEXT_LENGTH_WITH_IMAGE`               | 100,000 | Context limit with images                     |
| `FORCE_FULL_CONTEXT`                          | true    | Force full-text context                       |
| `FULL_CONTEXT_CHAR_LIMIT`                     | 500,000 | Full-text context upper limit                 |
| `MAX_HISTORY_MESSAGES`                        | 12      | Max history messages sent                     |
| `PERSISTED_HISTORY_LIMIT`                     | 200     | Max persisted messages                        |
| `MAX_SELECTED_IMAGES`                         | 50      | Max screenshots                               |
| `MAX_SELECTED_PAPER_CONTEXTS`                 | 20      | Max paper references                          |
| `MAX_UPLOAD_PDF_SIZE_BYTES`                   | 50MB    | PDF upload size limit                         |
| `CHUNK_TARGET_LENGTH`                         | 2,000   | PDF chunk target length                       |
| `MAX_CONTEXT_CHUNKS`                          | 60      | Max context chunks                            |
| `GLOBAL_CONVERSATION_KEY_BASE`                | 2×10⁹   | Global conversation key base                  |
| `GLOBAL_HISTORY_LIMIT`                        | 10      | Global history list entries                   |
| `FONT_SCALE_DEFAULT_PERCENT`                  | 120     | Default font scale                            |
| `AUTO_SCROLL_BOTTOM_THRESHOLD`                | 64px    | Auto-scroll threshold                         |
| `CONTEXT_COMPACTION_THRESHOLD`                | 150,000 | Zone B conversation compaction char threshold |
| `RECENT_TURNS_PROTECTED`                      | 5       | Zone C recent protected turn count            |
| `SELECTED_TEXT_MAX_LENGTH`                    | 4,000   | Selected text max length                      |
| `MAX_SELECTED_TEXT_CONTEXTS`                  | 20      | Max selected text entries                     |
| `SUPPLEMENTAL_PAPER_CONTEXT_TOTAL_MAX_LENGTH` | 200,000 | Supplemental paper context total length limit |

---

## 16. Global State: state.ts

**Path**: `src/modules/contextPanel/state.ts` (4KB)

Centrally manages all panel-level mutable state, preventing scatter across files:

```typescript
// Context Pool
conversationContextPool: Map<number, ConversationContextPoolEntry>;

// Conversation State
chatHistory: Map<number, Message[]>;
loadedConversationKeys: Set<number>;
loadingConversationTasks: Map<number, Promise<void>>;
selectedModelCache: Map<number, string>;

// PDF Cache
pdfTextCache: Map<number, PdfContext>;
pdfTextLoadingTasks: Map<number, Promise<void>>;

// Selection State Cache (per Item ID)
selectedImageCache: Map<number, string[]>;
selectedFileAttachmentCache: Map<number, ChatAttachment[]>;
selectedPaperContextCache: Map<number, PaperContextRef[]>;
selectedTextCache: Map<number, SelectedTextContext[]>;
activeGlobalConversationByLibrary: Map<number, number>;
activeConversationModeByLibrary: Map<number, "paper" | "global">;

// Request Control
currentRequestId / cancelledRequestId / currentAbortController;

// Context Menus
responseMenuTarget / promptMenuTarget;
```

---

## 17. CSS Styling System

**Path**: `addon/content/zoteroPane.css` (~3304 lines)

### 17.1 SVG Icon System

All icons are in `addon/content/icons/`:

**File type icons** (16×16 `currentColor`):

| Icon File                | `data-category` | CSS Color        | Purpose        |
| ------------------------ | --------------- | ---------------- | -------------- |
| `file-type-pdf.svg`      | `pdf`           | `#dc2626` red    | PDF documents  |
| `file-type-markdown.svg` | `markdown`      | `#2563eb` blue   | Markdown files |
| `file-type-code.svg`     | `code`          | `#059669` green  | Code files     |
| `file-type-text.svg`     | `text`          | `#6b7280` gray   | Plain text     |
| `file-type-image.svg`    | `image`         | `#c026d3` purple | Image files    |
| `file-type-generic.svg`  | `file`          | `#7c3aed` violet | Generic files  |

**Action bar icons** (`action-*.svg`): add-text / history-new / model-chip / new-chat / reasoning-brain / screenshot / slash / upload-file

**Preview icons**: `preview-image.svg` / `preview-paper.svg` / `robot.svg`

### 17.2 Animations

| Animation              | Purpose                       |
| ---------------------- | ----------------------------- |
| `llm-typing-bounce`    | Typing indicator              |
| `llm-skeleton-shimmer` | Skeleton screen shimmer       |
| `llm-file-shimmer`     | File processing shimmer       |
| `llm-file-pulse`       | File processing pulse         |
| `llm-cursor-blink`     | Streaming output cursor blink |

---

## 18. File Preview System

### 18.1 Core Mechanism: Group by Category

```
All files → Group by category
  → Each category independently:
    ├── ≤ 3 of that type → Render individual chips (SVG icon + × button)
    └── > 3 of that type → Render collapsed summary chip (e.g., "PDF (5) ▾")
                        ├── Click to expand → Show card container
                        └── × button → Remove all files of that type at once
```

### 18.2 File Classification (`resolveAttachmentCategory`)

**Location**: `controllers/fileIntakeController.ts`

| Category   | Match Criteria                                      |
| ---------- | --------------------------------------------------- |
| `image`    | MIME `image/*`                                      |
| `pdf`      | MIME `application/pdf` or `.pdf`                    |
| `markdown` | `.md` / `.markdown`                                 |
| `code`     | `.js/.ts/.py/.java/.c/.cpp/.go/.rs` etc.            |
| `text`     | Text MIME or `.txt/.csv/.log/.xml/.json/.yaml` etc. |
| `file`     | None of the above                                   |

---

## 19. Screenshot & Image System

**Path**: `screenshot.ts` + `setupHandlers.ts` → `updateImagePreview()`

```
Screenshot button click → captureScreenshotSelection()
  → Crop canvas → optimizeImageDataUrl()
  → selectedImageCache.set() → updateImagePreview()
```

---

## 20. Paper Context System

| File                  | Responsibility                            |
| --------------------- | ----------------------------------------- |
| `paperContext.ts`     | PDF content extraction & chunking         |
| `paperSearch.ts`      | `@` paper search                          |
| `paperAttribution.ts` | Paper attribution parsing                 |
| `pdfContext.ts`       | PDF chunking + BM25 + Embedding retrieval |

---

## 21. Panel Cache: libraryPanel / readerPanel

These two modules provide a **persistent DOM caching & remounting** mechanism, avoiding repeated `buildUI + setupHandlers + refreshChat` execution when users switch tabs.

### 21.1 libraryPanel.ts (6KB)

Handles the "no selected item" scenario in library mode. Each window shares a single `div#llm-library-panel-host`, mounted in `registerSection`'s `onAsyncRender` via `getSharedLibraryPanelHost()`.

| Function                                 | Responsibility                                          |
| ---------------------------------------- | ------------------------------------------------------- |
| `getSharedLibraryPanelHost(win)`         | Get/create shared host element                          |
| `bootstrapSharedLibraryPanel(win, host)` | First-time init (buildUI → setupHandlers → refreshChat) |
| `removeLibraryPanel(win)`                | Cleanup                                                 |

### 21.2 readerPanel.ts (3KB)

Handles reader mode. Each `(window, itemId)` pair maintains an independent `ReaderPanelState`.

| Function                                      | Responsibility                              |
| --------------------------------------------- | ------------------------------------------- |
| `getSharedReaderPanelHostForItem(win, item)`  | Get/create per-item host element            |
| `bootstrapSharedReaderPanel(win, host, item)` | First-time init (incl. lazy PDF extraction) |
| `removeReaderPanels(win)`                     | Cleanup all reader panels for the window    |

---

## 22. Preferences

**Path**: `src/modules/preferenceScript.ts` (26KB)

Manages the plugin settings interface, including:

- API Base URL / API Key / Model name (supports 4 profiles: Primary / Secondary / Tertiary / Quaternary)
- OAuth authentication (openai-codex / google-gemini-cli)
- Reasoning mode (off / low / medium / high / default)
- Custom shortcuts (add/delete/edit/drag-reorder)
- Advanced parameters (Temperature / Max Tokens)
- Auto environment configuration (`autoConfigureEnvironment`)
- Clear all chat history (`clearAllChatHistory`)
- Refresh all sidebar shortcuts (`refreshAllSidebarShortcuts`)

Preference key prefix: `extensions.zotero.aidea.*`

---

## 23. File Content Extraction: fileExtraction.ts

**Path**: `src/utils/fileExtraction.ts` (10KB)

| Function                                | Responsibility                                                |
| --------------------------------------- | ------------------------------------------------------------- |
| `readFileAsDataURL(owner, file)`        | File → data URL (for images)                                  |
| `readFileAsText(owner, file)`           | File → text string                                            |
| `readFileAsArrayBuffer(owner, file)`    | File → ArrayBuffer                                            |
| `extractTextFromPdfPath(filePath)`      | PDF path → text (uses Zotero PDFWorker, falls back to pdf.js) |
| `extractTextFromStoredFile(path, mime)` | Non-PDF file → text (HTML/EPUB/TXT etc.)                      |

Constant: `PDF_TEXT_MAX_CHARS = 50000`

---

## 24. Markdown Rendering: markdown.ts

**Path**: `src/utils/markdown.ts` (25KB)

Custom-built Markdown → HTML renderer:

- **Block-level isolation**: Each block renders independently; single-block errors don't affect others
- **LaTeX formulas**: Rendered via KaTeX for inline `$...$` and block `$$...$$`
- Code blocks (with language highlight class names), tables, lists, blockquotes, headings, horizontal rules

---

## 25. Memory System: memoryStore.ts

**Path**: `src/utils/memoryStore.ts` (14KB)

Provides cross-session persistent memory capability for the AI.

| Function                                  | Responsibility                                      |
| ----------------------------------------- | --------------------------------------------------- |
| `initMemoryStore()`                       | Create DB table `zotero_ai_memories`                |
| `storeMemory(params)`                     | Store memory (auto-deduplication)                   |
| `searchMemories(params)`                  | Search relevant memories (token Jaccard similarity) |
| `autoCaptureUserMemories(params)`         | Automatically extract memories from user messages   |
| `formatRelevantMemoriesContext(memories)` | Format memories as system prompt context            |
| `looksLikePromptInjection(text)`          | Anti-injection detection                            |

---

## 26. OAuth Authentication: oauthCli.ts

**Path**: `src/utils/oauthCli.ts` (35KB)

### 26.1 Provider Types

```typescript
type OAuthProviderId = "openai-codex" | "google-gemini-cli";
```

### 26.2 Key Functions

| Function                              | Responsibility                                        |
| ------------------------------------- | ----------------------------------------------------- |
| `readCodexOAuthCredential()`          | Read Codex credentials                                |
| `readGeminiOAuthCredential()`         | Read Gemini credentials                               |
| `runProviderOAuthLogin(provider)`     | Start OAuth login flow                                |
| `fetchAvailableModels(provider)`      | Fetch available model list                            |
| `chatWithProviderOAuth(...)`          | Call API using OAuth credentials (supports streaming) |
| `parseCodexSSEStream(body, onDelta)`  | Incrementally parse Codex SSE stream                  |
| `parseGeminiSSEStream(body, onDelta)` | Incrementally parse Gemini SSE stream                 |
| `ensureZoteroProxyFromSystem()`       | Auto-detect Windows system proxy and apply to Gecko   |
| `autoConfigureEnvironment()`          | Auto-configure runtime environment                    |
| `getProviderAccountSummary()`         | Get OAuth account status summary                      |

### 26.3 OAuth Streaming

- **Codex**: Uses `chatgpt.com/backend-api/codex/responses` (`stream: true`), parses SSE via `ReadableStream`
- **Gemini**: Uses `streamGenerateContent?alt=sse` endpoint, parses via `ReadableStream`

---

## 27. Reasoning Profiles: reasoningProfiles.ts

**Path**: `src/utils/reasoningProfiles.ts` (16KB)

Returns reasoning configuration based on regex matching of model names. Supported providers:

| Provider  | Configured Models                           |
| --------- | ------------------------------------------- |
| OpenAI    | GPT-5, o1, o1-mini, o3, o3-mini, o4-mini    |
| Anthropic | Claude 3.5 Sonnet (extended thinking)       |
| Gemini    | 3.0 Pro, 2.5 Pro, 2.5 Flash, 2.5 Flash Lite |
| Grok      | xAI Grok                                    |
| DeepSeek  | R1, V3 (chat)                               |
| Qwen      | QWQ, QVQ, Qwen3                             |
| Kimi      | k1 (thinking)                               |

---

## 28. Shortcut System: shortcuts.ts

**Path**: `src/modules/contextPanel/shortcuts.ts` (27KB)

### 28.1 Built-in Shortcuts

| ID            | Label       | Template File     |
| ------------- | ----------- | ----------------- |
| `translate`   | Translate   | `translate.txt`   |
| `summarize`   | Summarize   | `summarize.txt`   |
| `key-points`  | Key Points  | `key-points.txt`  |
| `methodology` | Methodology | `methodology.txt` |
| `limitations` | Limitations | `limitations.txt` |

### 28.2 Custom Shortcuts

- Up to 10 (`MAX_EDITABLE_SHORTCUTS`)
- Supports add/delete/edit/drag-reorder/context menu
- Edit dialog via `openShortcutEditDialog()`
- Persisted to preference `extensions.zotero.aidea.customShortcuts`

---

## 29. Note Export: notes.ts

**Path**: `src/modules/contextPanel/notes.ts` (8.5KB)

| Function                                | Responsibility                                                   |
| --------------------------------------- | ---------------------------------------------------------------- |
| `createNoteFromAssistantText()`         | Save AI response as Zotero note (auto-appends to existing notes) |
| `createNoteFromChatHistory()`           | Save entire conversation as Zotero note                          |
| `createStandaloneNoteFromChatHistory()` | Create standalone note in global mode                            |
| `buildChatHistoryNotePayload()`         | Build note HTML/text content                                     |

---

## 30. Internationalization: i18n.ts

**Path**: `src/modules/contextPanel/i18n.ts` (5KB)

Supports 12 UI languages: `en-US`, `zh-CN`, `zh-TW`, `ja-JP`, `ko-KR`, `fr-FR`, `de-DE`, `es-ES`, `ru-RU`, `pt-BR`, `ar-SA`, and `hi-IN`. Switchable via preference `extensions.zotero.aidea.uiLanguage`.

Contains ~50 translation keys covering panel titles, button labels, status messages, model selection hints, etc.

---

## 31. Testing

**Path**: `test/`

Uses **Mocha + Chai**, running TypeScript tests via `tsx`:

```bash
npm run test:unit
```

### 31.1 Test File Inventory

| Test File                              | Covered Module                                    |
| -------------------------------------- | ------------------------------------------------- |
| `markdown.test.ts`                     | Markdown rendering                                |
| `memoryStore.test.ts`                  | Memory system                                     |
| `reasoningProfiles.test.ts`            | Reasoning profiles                                |
| `pdfContext.test.ts`                   | PDF chunking/retrieval                            |
| `constants.safeguards.test.ts`         | Constants safety checks                           |
| `contextPanel.normalizers.test.ts`     | Data normalization                                |
| `apiHelpers.test.ts`                   | API utilities                                     |
| `paperSearch.test.ts`                  | Paper search                                      |
| `composeContextController.test.ts`     | Context composition                               |
| `xhrStreaming.test.ts`                 | XHR streaming                                     |
| `streamingUpdate.test.ts`              | Streaming incremental DOM updates                 |
| `normalization.test.ts`                | String normalization                              |
| `pathFileUrl.test.ts`                  | Path conversion                                   |
| `paperAttribution.test.ts`             | Paper attribution                                 |
| `fileExtraction.test.ts`               | File extraction                                   |
| `textUtils.selectedTextPrompt.test.ts` | Selected text                                     |
| **`contextPersistence.test.ts`**       | **Context persistence (36KB, largest test file)** |
| **`startup.test.ts`**                  | **Startup flow**                                  |

---

## 32. Quick Reference Table

| Feature to Modify                       | File                                      | Function/Location                                                       |
| --------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| **File preview rendering**              | `setupHandlers.ts` ~L1285                 | `updateFilePreview()`                                                   |
| **File classification (category)**      | `controllers/fileIntakeController.ts`     | `resolveAttachmentCategory()`                                           |
| **File type labels (PDF/MD/…)**         | `textUtils.ts`                            | `getAttachmentTypeLabel()`                                              |
| **File upload handling**                | `controllers/fileIntakeController.ts`     | `createFileIntakeController()`                                          |
| **File content extraction**             | `utils/fileExtraction.ts`                 | `extractTextFromPdfPath()` / `extractTextFromStoredFile()`              |
| **File attachment state persistence**   | `prefHelpers.ts`                          | `persistFileAttachmentState()` / `loadPersistedFileAttachmentIds()`     |
| **SVG icon replacement/addition**       | `addon/content/icons/file-type-*.svg`     | 16×16 `currentColor` SVG                                                |
| **Inline chip SVG icon mapping**        | `zoteroPane.css`                          | `.llm-file-chip-inline[data-category]`                                  |
| **Card container SVG icon mapping**     | `zoteroPane.css`                          | `.llm-file-context-type[data-category]`                                 |
| **Paper chip rendering**                | `setupHandlers.ts` ~L1162                 | `appendPaperChip()`                                                     |
| **Screenshot preview update**           | `setupHandlers.ts` ~L1650+                | `updateImagePreview()`                                                  |
| **Selected text preview**               | `contextResolution.ts`                    | `applySelectedTextPreview()`                                            |
| **Message bubble rendering**            | `chat.ts`                                 | `refreshChat()` (~730 lines)                                            |
| **Message send flow**                   | `controllers/sendFlowController.ts`       | Entire file                                                             |
| **Context composition**                 | `controllers/composeContextController.ts` | Entire file                                                             |
| **LLM API calls**                       | `utils/llmClient.ts`                      | `chatWithProvider()`                                                    |
| **Streaming UI incremental updates**    | `contextPanel/streamingUpdate.ts`         | `patchStreamingBubble()`                                                |
| **Lightweight persistence / DB tables** | `utils/chatStore.ts`                      | `appendMessage()` / `loadConversation()`                                |
| **Context state cache & restore**       | `chat.ts`                                 | `buildContextRefsSnapshot()` / `restoreContextPoolFromStoredMessages()` |
| **Zone B long conversation compaction** | `chat.ts`                                 | `compactConversationHistory()` / `buildZoneBCSplit()`                   |
| **Retry/edit last message**             | `chat.ts`                                 | `retryLatestAssistantResponse()` / `editLatestUserMessageAndRetry()`    |
| **Markdown rendering**                  | `utils/markdown.ts`                       | `renderMarkdown()` / `splitIntoBlocks()`                                |
| **Memory system**                       | `utils/memoryStore.ts`                    | `storeMemory()` / `searchMemories()`                                    |
| **OAuth authentication**                | `utils/oauthCli.ts`                       | `runProviderOAuthLogin()`                                               |
| **Reasoning profiles**                  | `utils/reasoningProfiles.ts`              | Reasoning level definitions                                             |
| **Model selection**                     | `controllers/modelSelectionController.ts` | `getModelChoices()`                                                     |
| **Shortcuts**                           | `shortcuts.ts`                            | `renderShortcuts()`                                                     |
| **Note export**                         | `notes.ts`                                | `createNoteFromAssistantText()` / `createNoteFromChatHistory()`         |
| **Preferences panel**                   | `modules/preferenceScript.ts`             | `registerPrefsScripts()`                                                |
| **Panel DOM cache (library)**           | `libraryPanel.ts`                         | `bootstrapSharedLibraryPanel()`                                         |
| **Panel DOM cache (reader)**            | `readerPanel.ts`                          | `bootstrapSharedReaderPanel()`                                          |
| **Global state management**             | `state.ts`                                | Various Map/Set caches                                                  |
| **Internationalization**                | `i18n.ts`                                 | `getPanelI18n()`                                                        |
| **Startup lifecycle**                   | `hooks.ts`                                | `onStartup()` / `onMainWindowLoad()`                                    |
| **CSS styles**                          | `addon/content/zoteroPane.css`            | Search by class name                                                    |

---

> 📌 **Tip**: Since `setupHandlers.ts` is extremely large (~185KB), use line number ranges for navigation when modifying. Functions in this file are generally arranged by UI section from top to bottom: utilities → selected text → paper preview → file preview → image preview → message rendering → action bar → send → history → shortcuts.
