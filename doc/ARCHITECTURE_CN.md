# Zotero LLM Plugin — 技术架构文档

> 最后更新：2026-03-04 (v7)
> 目的：为开发者提供快速定位代码、理解模块职责的完整技术参考。
>
> [🇬🇧 English Version](./ARCHITECTURE_EN.md)

---

## 目录

1. [项目概览](#1-项目概览)
2. [目录结构](#2-目录结构)
3. [构建与开发](#3-构建与开发)
4. [入口与生命周期](#4-入口与生命周期)
5. [核心模块：contextPanel](#5-核心模块contextpanel)
6. [工具层：utils](#6-工具层utils)
7. [UI 构建：buildUI.ts](#7-ui-构建builduits)
8. [事件处理：setupHandlers.ts](#8-事件处理setuphandlersts)
9. [聊天流程：chat.ts](#9-聊天流程chatts)
   - 9.1. [流式增量更新：streamingUpdate.ts](#91-流式增量更新streamingupdatets)
10. [上下文解析：contextResolution.ts](#10-上下文解析contextresolutionts)
11. [控制器层：setupHandlers/controllers](#11-控制器层setuphandlerscontrollers)
12. [LLM 客户端：llmClient.ts](#12-llm-客户端llmclientts)
13. [聊天持久化：chatStore.ts](#13-聊天持久化chatstorets)
14. [数据类型定义：types.ts](#14-数据类型定义typests)
15. [常量配置：constants.ts](#15-常量配置constantsts)
16. [全局状态：state.ts](#16-全局状态statets)
17. [CSS 样式体系](#17-css-样式体系)
18. [文件预览系统](#18-文件预览系统)
19. [截图与图片系统](#19-截图与图片系统)
20. [论文上下文系统](#20-论文上下文系统)
21. [面板缓存：libraryPanel / readerPanel](#21-面板缓存librarypanel--readerpanel)
22. [偏好设置](#22-偏好设置)
23. [文件内容提取：fileExtraction.ts](#23-文件内容提取fileextractionts)
24. [Markdown 渲染：markdown.ts](#24-markdown-渲染markdownts)
25. [记忆系统：memoryStore.ts](#25-记忆系统memorystorets)
26. [OAuth 认证：oauthCli.ts](#26-oauth-认证oauthclits)
27. [推理配置：reasoningProfiles.ts](#27-推理配置reasoningprofilests)
28. [快捷指令系统：shortcuts.ts](#28-快捷指令系统shortcutsts)
29. [笔记导出：notes.ts](#29-笔记导出notests)
30. [国际化：i18n.ts](#30-国际化i18nts)
31. [测试](#31-测试)
32. [关键修改速查表](#32-关键修改速查表)

---

## 1. 项目概览

| 属性     | 值                                      |
| -------- | --------------------------------------- |
| 名称     | `aidea-for-zotero` (addonName: `AIdea`) |
| 插件 ID  | `aidea@visterainer`                     |
| 偏好前缀 | `extensions.zotero.aidea`               |
| 目标环境 | Zotero 7 (Firefox 115 ESR)              |
| 语言     | TypeScript → esbuild 打包 → JS          |
| 样式     | 原生 CSS（无框架）                      |
| 许可证   | AGPL-3.0-or-later                       |

本插件在 Zotero 的 PDF 阅读器 / 文库侧边栏中提供一个 **AI 聊天面板**，支持多模型、多轮对话、文件上传、截图、论文上下文引用等功能。

---

## 2. 目录结构

```
Zotero_LLM_Plugin/
├── addon/                          # 插件静态资源（直接打包进 XPI）
│   ├── bootstrap.js                # Zotero 7 bootstrap 入口
│   ├── manifest.json               # 插件清单
│   ├── prefs.js                    # 默认偏好值
│   ├── content/
│   │   ├── zoteroPane.css          # ★ 主 CSS 文件（所有面板样式, ~3300行）
│   │   ├── icons/                  # SVG 图标（action-* + file-type-* + preview-*）
│   │   ├── preferences.xhtml       # 偏好面板 UI
│   │   └── scripts/                # 构建输出目标目录
│   └── locale/                     # Zotero FTL 文件（en-US / zh-CN fallback）
│
├── src/                            # TypeScript 源码
│   ├── index.ts                    # 全局入口（注册 addon 实例）
│   ├── addon.ts                    # Addon 单例类
│   ├── hooks.ts                    # 生命周期钩子
│   ├── modules/
│   │   ├── contextPanel/           # ★ 核心面板模块（见第 5 节）
│   │   └── preferenceScript.ts     # 偏好面板逻辑（26KB）
│   └── utils/                      # 工具函数层（见第 6 节）
│
├── test/                           # 单元测试（Mocha + Chai）
├── typings/                        # 全局类型声明
├── zotero-plugin.config.ts         # 构建配置
└── package.json                    # 依赖与脚本
```

---

## 3. 构建与开发

### 3.1 构建命令

```bash
npm run build        # 生产构建 + TypeScript 类型检查
npm run start        # 开发模式（热重载）
npm run test:unit    # 运行单元测试
```

### 3.2 构建流程

定义在 `zotero-plugin.config.ts`：

1. **esbuild** 将 `src/index.ts` 打包为 `addon/content/scripts/aidea.js`
   - target: `firefox115`
   - bundle: `true`
2. **zotero-plugin-scaffold** 将 `addon/` 所有资源 + 打包后 JS → `.scaffold/build/zotero-ai.xpi`
3. **tsc --noEmit** 进行类型检查

### 3.3 部署

构建产物：`.scaffold/build/zotero-ai.xpi`
手动拷贝到桌面或直接在 Zotero → Tools → Add-ons 安装。

---

## 4. 入口与生命周期

### 4.1 入口文件

| 文件           | 职责                                     |
| -------------- | ---------------------------------------- |
| `src/index.ts` | 注册全局 `Zotero.AIdea` 实例             |
| `src/addon.ts` | `Addon` 类，持有 `data.initialized` 状态 |
| `src/hooks.ts` | Zotero 插件生命周期钩子                  |

### 4.2 钩子流程

```
onStartup
  ├── Zotero.initializationPromise / unlockPromise / uiReadyPromise
  ├── runLegacyMigrations()          ← 数据库迁移
  ├── initLocale()                   ← 国际化
  ├── ensureZoteroProxyFromSystem()  ← 自动检测系统代理
  ├── initChatStore()                ← 初始化聊天数据库表
  ├── initMemoryStore()              ← 初始化记忆数据库表
  ├── initAttachmentRefStore()       ← 初始化附件引用计数
  ├── reconcileNoteAttachmentRefs()  ← 后台附件 GC
  ├── registerPrefsPane()            ← 注册偏好面板
  └── onMainWindowLoad(win)
       ├── registerLLMStyles(win)            ← 注入 CSS
       ├── registerReaderContextPanel()      ← 注册侧边栏面板
       ├── registerReaderSelectionTracking() ← 监听 PDF 选区
       └── injectLibraryPanel(win)           ← 注册文库面板

onMainWindowUnload(win)
  ├── removeLibraryPanel(win)        ← 清理文库面板
  ├── removeReaderPanels(win)        ← 清理阅读器面板缓存
  └── ztoolkit.unregisterAll()
```

---

## 5. 核心模块：contextPanel

**路径**: `src/modules/contextPanel/`

这是插件最核心的模块，约 **29 个源文件 + 1 个子目录**。负责聊天面板的 UI 构建、事件处理、消息发送、上下文管理等一切功能。

### 5.1 文件清单

| 文件                   | 大小      | 职责                                              |
| ---------------------- | --------- | ------------------------------------------------- |
| `index.ts`             | 30KB      | 模块公共 API，注册面板，独占模式管理              |
| **`setupHandlers.ts`** | **185KB** | ★ 最大文件！所有 UI 事件绑定（~5236行）           |
| `buildUI.ts`           | 19KB      | DOM 元素创建                                      |
| **`chat.ts`**          | **100KB** | ★ 聊天消息渲染、发送、重试、编辑、压缩（~2795行） |
| `contextResolution.ts` | 22KB      | 上下文/选中文本解析                               |
| `constants.ts`         | 5.5KB     | 常量定义                                          |
| `types.ts`             | 3KB       | 类型定义                                          |
| `state.ts`             | 4KB       | 全局状态缓存（集中管理）                          |
| `textUtils.ts`         | 11KB      | 文本处理工具                                      |
| `screenshot.ts`        | 12KB      | 截图捕获与优化                                    |
| `pdfContext.ts`        | 13KB      | PDF 内容分块 & 检索                               |
| `attachmentStorage.ts` | 14KB      | 附件文件管理（含 blob 存储）                      |
| `notes.ts`             | 8.5KB     | Zotero 笔记导出                                   |
| `shortcuts.ts`         | 27KB      | 快捷指令系统                                      |
| `paperContext.ts`      | 5KB       | 论文引用上下文                                    |
| `paperSearch.ts`       | 8KB       | `@` 搜索论文                                      |
| `paperAttribution.ts`  | 5KB       | 论文归属解析                                      |
| `chatScroll.ts`        | 9KB       | 聊天滚动管理                                      |
| `streamingUpdate.ts`   | 5KB       | 流式输出增量 DOM 更新                             |
| `menuPositioning.ts`   | 3KB       | 浮动菜单定位                                      |
| `normalizers.ts`       | 4KB       | 数据规范化                                        |
| `portalScope.ts`       | 2KB       | 全局对话"虚拟 Item"                               |
| `prefHelpers.ts`       | 11KB      | 偏好读写帮助（含文件附件状态持久化）              |
| `readerSelection.ts`   | 2KB       | 阅读器选区读取                                    |
| `i18n.ts`              | 5KB       | 面板内国际化（12 种 UI 语言）                     |
| **`libraryPanel.ts`**  | **6KB**   | ★ 文库模式面板 DOM 缓存/重挂载                    |
| **`readerPanel.ts`**   | **3KB**   | ★ 阅读器模式面板 DOM 缓存/重挂载                  |
| `README.md`            | 3KB       | 模块自述                                          |

### 5.2 子目录 setupHandlers/

| 文件               | 职责                                              |
| ------------------ | ------------------------------------------------- |
| `domRefs.ts` (8KB) | DOM 元素引用查询（60+ 字段 `querySelector` 映射） |
| `types.ts`         | setupHandlers 内部类型                            |
| `controllers/`     | 功能控制器拆分（见第 11 节）                      |

---

## 6. 工具层：utils

**路径**: `src/utils/`

| 文件                    | 大小     | 职责                                                    |
| ----------------------- | -------- | ------------------------------------------------------- |
| **`llmClient.ts`**      | **67KB** | ★ LLM API 调用（流式/非流式, ~2275行）                  |
| **`chatStore.ts`**      | **35KB** | ★ 聊天持久化（SQLite via Zotero.DB, ~1020行）           |
| **`oauthCli.ts`**       | **35KB** | ★ OAuth 认证流程（openai-codex / google-gemini-cli）    |
| `markdown.ts`           | 25KB     | Markdown 渲染（含 KaTeX 公式）                          |
| `reasoningProfiles.ts`  | 16KB     | 推理配置文件（GPT-5/o1/Claude/Gemini/Qwen/DeepSeek 等） |
| `memoryStore.ts`        | 14KB     | 记忆系统存储                                            |
| `fileExtraction.ts`     | 10KB     | 文件内容提取（PDF/MD/代码等）                           |
| `attachmentRefStore.ts` | 7KB      | 附件引用计数 & GC                                       |
| `processRunner.ts`      | 5KB      | 进程运行器                                              |
| `apiHelpers.ts`         | 4KB      | API 请求工具                                            |
| `locale.ts`             | 3KB      | 语言环境获取                                            |
| `migrations.ts`         | 2KB      | 数据迁移                                                |
| `normalization.ts`      | 1KB      | 字符串规范化                                            |
| `pathFileUrl.ts`        | 1KB      | 路径 ↔ file:// URL 转换                                 |
| `domHelpers.ts`         | 0.5KB    | `createElement` 帮助函数                                |
| `ztoolkit.ts`           | 2KB      | zotero-plugin-toolkit 封装                              |
| `llmDefaults.ts`        | 0.1KB    | LLM 默认参数                                            |

---

## 7. UI 构建：buildUI.ts

**路径**: `src/modules/contextPanel/buildUI.ts`
**核心函数**: `buildUI(body: Element, item?: Zotero.Item | null)`

该文件负责创建面板的所有 DOM 元素。主要区域有：

```
┌─────────────────────────────────────────┐
│ llm-main                                │
│ ├── llm-header (标题栏、历史、导出)      │
│ ├── llm-content                         │
│ │   ├── llm-chat-box (消息列表)         │
│ │   └── llm-typing-indicator            │
│ ├── llm-input-section                   │
│ │   ├── llm-context-previews            │
│ │   │   ├── #llm-selected-context-list  │
│ │   │   ├── #llm-paper-context-preview  │
│ │   │   ├── .llm-image-preview          │
│ │   │   └── #llm-file-context-preview   │
│ │   ├── llm-input (textarea)            │
│ │   └── llm-actions (操作栏)            │
│ └── llm-status                          │
└─────────────────────────────────────────┘
```

---

## 8. 事件处理：setupHandlers.ts

**路径**: `src/modules/contextPanel/setupHandlers.ts`
**核心函数**: `setupHandlers(body: Element, initialItem?: Zotero.Item | null)`

这是项目中 **最大的单文件**（185KB / ~5236行），负责：

### 8.1 DOM 引用解析

通过 `setupHandlers/domRefs.ts` 的 `getPanelDomRefs()` 函数获取 60+ 个 DOM 元素引用。

### 8.2 关键内部函数

| 函数                        | 行范围 (约) | 职责                                     |
| --------------------------- | ----------- | ---------------------------------------- |
| `resolveLibraryIdFromItem`  | ~195        | 解析 Item 的 libraryID                   |
| `scheduleAttachmentGc`      | ~341        | 附件垃圾回收定时器                       |
| `persistScroll`             | ~411        | 持久化聊天滚动位置                       |
| `updateSelectionPopup`      | ~537        | 更新选区弹出菜单                         |
| `updateSelectedTextPreview` | ~700+       | 更新选中文本预览                         |
| `appendPaperChip`           | ~1162       | 创建论文上下文 chip                      |
| `updatePaperPreview`        | ~1219       | 更新论文预览                             |
| **`updateFilePreview`**     | **~1285**   | **★ 文件预览渲染（按类型分组+SVG图标）** |
| `updateImagePreview`        | ~1650+      | 截图预览渲染                             |
| `appendMessageBubble`       | ~2300+      | 渲染消息气泡                             |
| `refreshChat`               | ~3200+      | 刷新整个聊天 UI                          |
| `handleSend`                | ~3900+      | 处理发送逻辑                             |

---

## 9. 聊天流程：chat.ts

**路径**: `src/modules/contextPanel/chat.ts` (100KB, ~2795行)

### 9.1 核心流程

```
用户输入 → handleSend() → buildCombinedContextForRequest()
    → chatWithProvider() / chatWithProviderOAuth()
    → 流式接收 → appendMessageBubble() → renderMarkdown()
    → persistConversationMessage() → updateLatestAssistantMessage()
```

### 9.2 关键函数

| 函数                                   | 职责                                   |
| -------------------------------------- | -------------------------------------- |
| `ensureConversationLoaded`             | 加载历史对话                           |
| `persistConversationMessage`           | 持久化消息到数据库                     |
| `toPanelMessage`                       | 数据库消息 → UI 消息格式               |
| `refreshChat`                          | 渲染全部消息气泡（~730行）             |
| `sendQuestion`                         | 发送问题并处理流式响应                 |
| `retryLatestAssistantResponse`         | 重试最后一条 AI 回复（可选切换模型）   |
| `editLatestUserMessageAndRetry`        | 编辑最后一条用户消息并重新发送         |
| `buildCombinedContextForRequest`       | 构建完整上下文（PDF + 论文 + 记忆）    |
| `buildContextRefsSnapshot`             | 构建轻量上下文快照用于持久化           |
| `restoreContextPoolFromStoredMessages` | 从 DB 恢复上下文池                     |
| `restoreFileAttachmentsFromMessages`   | 从 DB 恢复文件附件缓存                 |
| `compactConversationHistory`           | Zone B/C 长对话压缩                    |
| `autoCaptureRequestMemories`           | 自动提取用户记忆                       |
| `copyRenderedMarkdownToClipboard`      | 复制渲染后的 Markdown（HTML + 纯文本） |

### 9.3 流式增量更新：streamingUpdate.ts

**路径**: `src/modules/contextPanel/streamingUpdate.ts` (5KB)

解决流式输出时的性能瓶颈：仅更新最后一个 assistant 气泡的 `innerHTML`，而非全量重渲染。

```text
onDelta(token) → assistantMessage.text += token
  → queueStreamingPatch()              ← 30ms 节流
    → patchStreamingBubble(bubbleRef)   ← 只更新 1 个 bubble
      → contentEl.innerHTML = renderMarkdown(text)
      → autoScrollStreamingIfNeeded()   ← 自动跟底
  → 流式结束:
    → finalizeStreamingBubble()         ← 移除 streaming class
    → refreshChatSafely()              ← 最终一致性全量渲染
```

---

## 10. 上下文解析：contextResolution.ts

**路径**: `src/modules/contextPanel/contextResolution.ts` (22KB)

| 函数                                 | 职责                      |
| ------------------------------------ | ------------------------- |
| `getActiveReaderForSelectedTab`      | 获取当前标签页的 Reader   |
| `getActiveContextAttachmentFromTabs` | 获取当前阅读器的 PDF 附件 |
| `resolveContextSourceItem`           | 解析面板 Item 的源 PDF    |
| `getActiveReaderSelectionText`       | 获取 Reader 中选中的文本  |
| `addSelectedTextContext`             | 添加选中文本到面板        |
| `applySelectedTextPreview`           | 渲染选中文本预览          |
| `includeSelectedTextFromReader`      | 从阅读器导入选中文本      |

---

## 11. 控制器层：setupHandlers/controllers

**路径**: `src/modules/contextPanel/setupHandlers/controllers/`

| 文件                               | 大小  | 职责                                  |
| ---------------------------------- | ----- | ------------------------------------- |
| `composeContextController.ts`      | 4KB   | 组合发送上下文（文本+图片+文件+论文） |
| `fileIntakeController.ts`          | 13KB  | 文件上传处理（拖拽/粘贴/选择）        |
| `sendFlowController.ts`            | 11KB  | 消息发送流程控制                      |
| `modelSelectionController.ts`      | 6KB   | 模型选择 & 持久化                     |
| `conversationHistoryController.ts` | 2KB   | 会话历史管理                          |
| `menuController.ts`                | 2KB   | 菜单状态控制                          |
| `modelReasoningController.ts`      | 0.4KB | 推理模式判断                          |

---

## 12. LLM 客户端：llmClient.ts

**路径**: `src/utils/llmClient.ts` (67KB, ~2275行)

### 12.1 关键函数

| 函数                    | 职责                       |
| ----------------------- | -------------------------- |
| `getApiConfig()`        | 读取偏好中的 API 配置      |
| `chatWithProvider()`    | 直接 API 调用（流式）      |
| `callEmbeddings()`      | 调用 Embedding API         |
| `resolveSystemPrompt()` | 构建系统提示词             |
| `buildApiPayload()`     | 构建 API 请求体            |
| `parseSSEStream()`      | 解析 Server-Sent Events 流 |

### 12.2 流式处理

使用 `fetch` + `ReadableStream` 实现逐字符流式输出：

```
fetch(apiBase + "/chat/completions") → response.body.getReader()
  → 逐块读取 → 解析 SSE → 提取 delta.content → onToken 回调
```

---

## 13. 聊天持久化：chatStore.ts

**路径**: `src/utils/chatStore.ts` (35KB, ~1020行)

### 13.1 数据表

| 表名                             | 用途                                                      |
| -------------------------------- | --------------------------------------------------------- |
| `zotero_ai_chat_messages`        | 聊天消息存储（含 `context_refs_json` 轻量级上下文持久化） |
| `zotero_ai_global_conversations` | 全局对话元数据                                            |

### 13.2 关键函数

| 函数                                      | 职责                     |
| ----------------------------------------- | ------------------------ |
| `initChatStore()`                         | 初始化数据表             |
| `loadConversation(key, limit)`            | 加载对话消息             |
| `appendMessage(key, msg)`                 | 追加消息                 |
| `updateLatestUserMessage()`               | 更新最新用户消息         |
| `updateLatestAssistantMessage()`          | 更新最新助手消息         |
| `clearConversation(key)`                  | 清除对话                 |
| `pruneConversation(key, keep)`            | 裁剪对话至指定条数       |
| `createGlobalConversation(libID)`         | 创建全局对话             |
| `listGlobalConversations(libID)`          | 列出全局对话             |
| `deleteGlobalConversation(key)`           | 删除全局对话             |
| `deleteAllGlobalConversationsByLibrary()` | 批量删除某库全部全局对话 |
| `clearAllChatHistory()`                   | 清除所有聊天历史         |
| `getLatestEmptyGlobalConversation()`      | 获取最新空全局对话       |

### 13.3 对话键（Conversation Key）

- **Reader 模式**: `conversationKey = item.id`（Zotero Item ID）
- **全局模式**: `conversationKey >= 2_000_000_000`（由 `GLOBAL_CONVERSATION_KEY_BASE` 定义）

---

## 14. 数据类型定义：types.ts

**路径**: `src/modules/contextPanel/types.ts`

### 14.1 核心类型

```typescript
// 消息
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

// 文件附件
type ChatAttachmentCategory = "image" | "pdf" | "markdown" | "code" | "text" | "file";
type ChatAttachment = {
  id: string; name: string; mimeType: string; sizeBytes: number;
  category: ChatAttachmentCategory;
  imageDataUrl?: string; textContent?: string;
  storedPath?: string; contentHash?: string; processing?: boolean;
};

// 论文引用
type PaperContextRef = {
  itemId: number; contextItemId: number; citationKey?: string;
  title: string; firstCreator?: string; year?: string;
};

// PDF 上下文
type PdfContext = {
  title: string; chunks: string[]; chunkStats: ChunkStat[];
  docFreq: Record<string, number>; avgChunkLength: number; fullLength: number;
  embeddings?: number[][]; embeddingPromise?: Promise<number[][] | null>;
  embeddingFailed?: boolean;
};

// 轻量上下文引用（DB 持久化用）
interface ContextRefsJson {
  basePdf?: { itemId: number; contextItemId: number; title: string; removed?: boolean };
  supplementalPapers?: PaperContextRef[];
  fileAttachmentIds?: string[];
  compactedSummary?: string;
}

// 全局对话摘要
type GlobalConversationSummary = {
  conversationKey: number; libraryID: number; createdAt: number;
  title?: string; lastActivityAt: number; userTurnCount: number;
};

// 全局虚拟 Item
type GlobalPortalItem = { __llmGlobalPortalItem: true; id: number; libraryID: number; ... };
```

---

## 15. 常量配置：constants.ts

**路径**: `src/modules/contextPanel/constants.ts`

| 常量                                          | 值      | 用途                     |
| --------------------------------------------- | ------- | ------------------------ |
| `MAX_CONTEXT_LENGTH`                          | 200,000 | 上下文最大字符数         |
| `MAX_CONTEXT_LENGTH_WITH_IMAGE`               | 100,000 | 含图片时上下文限制       |
| `FORCE_FULL_CONTEXT`                          | true    | 强制全文上下文           |
| `FULL_CONTEXT_CHAR_LIMIT`                     | 500,000 | 全文上下文上限           |
| `MAX_HISTORY_MESSAGES`                        | 12      | 发送时最大历史消息数     |
| `PERSISTED_HISTORY_LIMIT`                     | 200     | 持久化最大消息数         |
| `MAX_SELECTED_IMAGES`                         | 50      | 最大截图数               |
| `MAX_SELECTED_PAPER_CONTEXTS`                 | 20      | 最大论文引用数           |
| `MAX_UPLOAD_PDF_SIZE_BYTES`                   | 50MB    | PDF 上传大小限制         |
| `CHUNK_TARGET_LENGTH`                         | 2,000   | PDF 分块目标长度         |
| `MAX_CONTEXT_CHUNKS`                          | 60      | 最大上下文分块数         |
| `GLOBAL_CONVERSATION_KEY_BASE`                | 2×10⁹   | 全局对话键基数           |
| `GLOBAL_HISTORY_LIMIT`                        | 10      | 全局历史列表条数         |
| `FONT_SCALE_DEFAULT_PERCENT`                  | 120     | 默认字体缩放             |
| `AUTO_SCROLL_BOTTOM_THRESHOLD`                | 64px    | 自动滚动阈值             |
| `CONTEXT_COMPACTION_THRESHOLD`                | 150,000 | Zone B 对话压缩字数阈值  |
| `RECENT_TURNS_PROTECTED`                      | 5       | Zone C 近期保留交互轮数  |
| `SELECTED_TEXT_MAX_LENGTH`                    | 4,000   | 选中文本最大长度         |
| `MAX_SELECTED_TEXT_CONTEXTS`                  | 20      | 最大选中文本条数         |
| `SUPPLEMENTAL_PAPER_CONTEXT_TOTAL_MAX_LENGTH` | 200,000 | 补充论文上下文总长度限制 |

---

## 16. 全局状态：state.ts

**路径**: `src/modules/contextPanel/state.ts` (4KB)

集中管理所有面板级可变状态，避免散落在各文件中：

```typescript
// 上下文池
conversationContextPool: Map<number, ConversationContextPoolEntry>;

// 对话状态
chatHistory: Map<number, Message[]>;
loadedConversationKeys: Set<number>;
loadingConversationTasks: Map<number, Promise<void>>;
selectedModelCache: Map<number, string>;

// PDF 缓存
pdfTextCache: Map<number, PdfContext>;
pdfTextLoadingTasks: Map<number, Promise<void>>;

// 选择状态缓存（per Item ID）
selectedImageCache: Map<number, string[]>;
selectedFileAttachmentCache: Map<number, ChatAttachment[]>;
selectedPaperContextCache: Map<number, PaperContextRef[]>;
selectedTextCache: Map<number, SelectedTextContext[]>;
activeGlobalConversationByLibrary: Map<number, number>;
activeConversationModeByLibrary: Map<number, "paper" | "global">;

// 请求控制
currentRequestId / cancelledRequestId / currentAbortController;

// 右键菜单
responseMenuTarget / promptMenuTarget;
```

---

## 17. CSS 样式体系

**路径**: `addon/content/zoteroPane.css` (~3304 行)

### 17.1 SVG 图标体系

所有图标位于 `addon/content/icons/`：

**文件类型图标**（16×16 `currentColor`）：

| 图标文件                 | `data-category` | CSS 颜色         | 用途          |
| ------------------------ | --------------- | ---------------- | ------------- |
| `file-type-pdf.svg`      | `pdf`           | `#dc2626` 红     | PDF 文档      |
| `file-type-markdown.svg` | `markdown`      | `#2563eb` 蓝     | Markdown 文件 |
| `file-type-code.svg`     | `code`          | `#059669` 绿     | 代码文件      |
| `file-type-text.svg`     | `text`          | `#6b7280` 灰     | 纯文本        |
| `file-type-image.svg`    | `image`         | `#c026d3` 紫     | 图片文件      |
| `file-type-generic.svg`  | `file`          | `#7c3aed` 紫罗兰 | 通用文件      |

**操作栏图标**（`action-*.svg`）：add-text / history-new / model-chip / new-chat / reasoning-brain / screenshot / slash / upload-file

**预览图标**：`preview-image.svg` / `preview-paper.svg` / `robot.svg`

### 17.2 动画

| 动画                   | 用途             |
| ---------------------- | ---------------- |
| `llm-typing-bounce`    | 打字指示器       |
| `llm-skeleton-shimmer` | 骨架屏闪烁       |
| `llm-file-shimmer`     | 文件处理中闪烁   |
| `llm-file-pulse`       | 文件处理中脉冲   |
| `llm-cursor-blink`     | 流式输出光标闪烁 |

---

## 18. 文件预览系统

### 18.1 核心机制：按 category 分组

```
所有文件 → 按 category 分组
  → 每个 category 独立判断:
    ├── 该类型 ≤ 3 个 → 每个文件渲染独立 chip（带 SVG 图标 + × 按钮）
    └── 该类型 > 3 个 → 渲染该类型的折叠汇总 chip（如 "PDF (5) ▾"）
                        ├── 点击展开 → 显示卡片容器
                        └── × 按钮 → 一次性清除该类型全部文件
```

### 18.2 文件分类（`resolveAttachmentCategory`）

**位置**: `controllers/fileIntakeController.ts`

| category   | 匹配条件                                          |
| ---------- | ------------------------------------------------- |
| `image`    | MIME `image/*`                                    |
| `pdf`      | MIME `application/pdf` 或 `.pdf`                  |
| `markdown` | `.md` / `.markdown`                               |
| `code`     | `.js/.ts/.py/.java/.c/.cpp/.go/.rs` 等            |
| `text`     | 文本 MIME 或 `.txt/.csv/.log/.xml/.json/.yaml` 等 |
| `file`     | 以上都不匹配                                      |

---

## 19. 截图与图片系统

**路径**: `screenshot.ts` + `setupHandlers.ts` → `updateImagePreview()`

```
截图按钮点击 → captureScreenshotSelection()
  → 裁剪 canvas → optimizeImageDataUrl()
  → selectedImageCache.set() → updateImagePreview()
```

---

## 20. 论文上下文系统

| 文件                  | 职责                             |
| --------------------- | -------------------------------- |
| `paperContext.ts`     | PDF 内容提取与分块               |
| `paperSearch.ts`      | `@` 搜索论文                     |
| `paperAttribution.ts` | 论文归属解析                     |
| `pdfContext.ts`       | PDF 分块 + BM25 + Embedding 检索 |

---

## 21. 面板缓存：libraryPanel / readerPanel

这两个模块提供 **持久 DOM 缓存与重挂载**机制，避免用户切换标签页时重复执行 `buildUI + setupHandlers + refreshChat`。

### 21.1 libraryPanel.ts (6KB)

处理文库模式下"无选中项"的场景。每个 window 共享一个 `div#llm-library-panel-host`，在 `registerSection` 的 `onAsyncRender` 中通过 `getSharedLibraryPanelHost()` 获取并挂载。

| 函数                                     | 职责                                                |
| ---------------------------------------- | --------------------------------------------------- |
| `getSharedLibraryPanelHost(win)`         | 获取/创建共享 host 元素                             |
| `bootstrapSharedLibraryPanel(win, host)` | 首次初始化（buildUI → setupHandlers → refreshChat） |
| `removeLibraryPanel(win)`                | 清理                                                |

### 21.2 readerPanel.ts (3KB)

处理阅读器模式。每个 `(window, itemId)` 对维护一个独立的 `ReaderPanelState`。

| 函数                                          | 职责                              |
| --------------------------------------------- | --------------------------------- |
| `getSharedReaderPanelHostForItem(win, item)`  | 获取/创建 per-item host 元素      |
| `bootstrapSharedReaderPanel(win, host, item)` | 首次初始化（含 PDF 提取延迟加载） |
| `removeReaderPanels(win)`                     | 清理该窗口所有阅读器面板          |

---

## 22. 偏好设置

**路径**: `src/modules/preferenceScript.ts` (26KB)

管理插件设置界面，配置项包括：

- API Base URL / API Key / 模型名称（支持 4 个配置文件：Primary / Secondary / Tertiary / Quaternary）
- OAuth 认证（openai-codex / google-gemini-cli）
- 推理模式（off / low / medium / high / default）
- 自定义快捷指令（增删改拖拽排序）
- 高级参数（Temperature / Max Tokens）
- 环境自动配置（`autoConfigureEnvironment`）
- 清除所有聊天记录（`clearAllChatHistory`）
- 刷新所有侧边栏快捷指令（`refreshAllSidebarShortcuts`）

偏好键前缀：`extensions.zotero.aidea.*`

---

## 23. 文件内容提取：fileExtraction.ts

**路径**: `src/utils/fileExtraction.ts` (10KB)

| 函数                                    | 职责                                                  |
| --------------------------------------- | ----------------------------------------------------- |
| `readFileAsDataURL(owner, file)`        | File → data URL（图片用）                             |
| `readFileAsText(owner, file)`           | File → 文本字符串                                     |
| `readFileAsArrayBuffer(owner, file)`    | File → ArrayBuffer                                    |
| `extractTextFromPdfPath(filePath)`      | PDF 路径 → 文本（使用 Zotero PDFWorker，回退 pdf.js） |
| `extractTextFromStoredFile(path, mime)` | 非 PDF 文件 → 文本（HTML/EPUB/TXT 等）                |

常量：`PDF_TEXT_MAX_CHARS = 50000`

---

## 24. Markdown 渲染：markdown.ts

**路径**: `src/utils/markdown.ts` (25KB)

自研 Markdown → HTML 渲染器：

- **块级隔离**：每个块独立渲染，单块错误不影响其他块
- **LaTeX 公式**：通过 KaTeX 渲染行内 `$...$` 和块级 `$$...$$`
- 代码块（带语言高亮类名）、表格、列表、引用、标题、水平线

---

## 25. 记忆系统：memoryStore.ts

**路径**: `src/utils/memoryStore.ts` (14KB)

为 AI 提供跨会话的持久记忆能力。

| 函数                                      | 职责                                 |
| ----------------------------------------- | ------------------------------------ |
| `initMemoryStore()`                       | 创建数据表 `zotero_ai_memories`      |
| `storeMemory(params)`                     | 存储记忆（自动去重）                 |
| `searchMemories(params)`                  | 搜索相关记忆（token Jaccard 相似度） |
| `autoCaptureUserMemories(params)`         | 自动从用户消息中提取记忆             |
| `formatRelevantMemoriesContext(memories)` | 格式化记忆为系统提示词上下文         |
| `looksLikePromptInjection(text)`          | 防注入检测                           |

---

## 26. OAuth 认证：oauthCli.ts

**路径**: `src/utils/oauthCli.ts` (35KB)

### 26.1 Provider 类型

```typescript
type OAuthProviderId = "openai-codex" | "google-gemini-cli";
```

### 26.2 关键函数

| 函数                                  | 职责                                    |
| ------------------------------------- | --------------------------------------- |
| `readCodexOAuthCredential()`          | 读取 Codex 凭证                         |
| `readGeminiOAuthCredential()`         | 读取 Gemini 凭证                        |
| `runProviderOAuthLogin(provider)`     | 启动 OAuth 登录流程                     |
| `fetchAvailableModels(provider)`      | 获取可用模型列表                        |
| `chatWithProviderOAuth(...)`          | 使用 OAuth 凭证调用 API（支持流式输出） |
| `parseCodexSSEStream(body, onDelta)`  | 增量解析 Codex SSE 流                   |
| `parseGeminiSSEStream(body, onDelta)` | 增量解析 Gemini SSE 流                  |
| `ensureZoteroProxyFromSystem()`       | 自动检测 Windows 系统代理并应用到 Gecko |
| `autoConfigureEnvironment()`          | 自动配置运行环境                        |
| `getProviderAccountSummary()`         | 获取 OAuth 账户状态摘要                 |

### 26.3 OAuth 流式处理

- **Codex**：使用 `chatgpt.com/backend-api/codex/responses`（`stream: true`），通过 `ReadableStream` 解析 SSE
- **Gemini**：使用 `streamGenerateContent?alt=sse` 端点，通过 `ReadableStream` 解析

---

## 27. 推理配置：reasoningProfiles.ts

**路径**: `src/utils/reasoningProfiles.ts` (16KB)

基于模型名称正则匹配返回推理配置，支持的 provider：

| Provider  | 已配置模型                                  |
| --------- | ------------------------------------------- |
| OpenAI    | GPT-5, o1, o1-mini, o3, o3-mini, o4-mini    |
| Anthropic | Claude 3.5 Sonnet（extended thinking）      |
| Gemini    | 3.0 Pro, 2.5 Pro, 2.5 Flash, 2.5 Flash Lite |
| Grok      | xAI Grok                                    |
| DeepSeek  | R1, V3 (chat)                               |
| Qwen      | QWQ, QVQ, Qwen3                             |
| Kimi      | k1 (thinking)                               |

---

## 28. 快捷指令系统：shortcuts.ts

**路径**: `src/modules/contextPanel/shortcuts.ts` (27KB)

### 28.1 内置指令

| ID            | 标签        | 模板文件          |
| ------------- | ----------- | ----------------- |
| `translate`   | Translate   | `translate.txt`   |
| `summarize`   | Summarize   | `summarize.txt`   |
| `key-points`  | Key Points  | `key-points.txt`  |
| `methodology` | Methodology | `methodology.txt` |
| `limitations` | Limitations | `limitations.txt` |

### 28.2 自定义指令

- 最多 10 个（`MAX_EDITABLE_SHORTCUTS`）
- 支持增/删/改/拖拽排序/右键菜单
- 通过 `openShortcutEditDialog()` 弹出编辑对话框
- 持久化到偏好 `extensions.zotero.aidea.customShortcuts`

---

## 29. 笔记导出：notes.ts

**路径**: `src/modules/contextPanel/notes.ts` (8.5KB)

| 函数                                    | 职责                                               |
| --------------------------------------- | -------------------------------------------------- |
| `createNoteFromAssistantText()`         | 将 AI 回复保存为 Zotero 笔记（自动追加到已有笔记） |
| `createNoteFromChatHistory()`           | 将整个对话保存为 Zotero 笔记                       |
| `createStandaloneNoteFromChatHistory()` | 全局模式下创建独立笔记                             |
| `buildChatHistoryNotePayload()`         | 构建笔记 HTML/文本内容                             |

---

## 30. 国际化：i18n.ts

**路径**: `src/modules/contextPanel/i18n.ts` (5KB)

支持 12 种 UI 语言：`en-US`、`zh-CN`、`zh-TW`、`ja-JP`、`ko-KR`、`fr-FR`、`de-DE`、`es-ES`、`ru-RU`、`pt-BR`、`ar-SA`、`hi-IN`。通过偏好 `extensions.zotero.aidea.uiLanguage` 切换。

包含 ~50 个翻译键，覆盖面板标题、按钮文字、状态提示、模型选择提示等。

---

## 31. 测试

**路径**: `test/`

使用 **Mocha + Chai**，通过 `tsx` 运行 TypeScript 测试：

```bash
npm run test:unit
```

### 31.1 测试文件清单

| 测试文件                               | 覆盖模块                               |
| -------------------------------------- | -------------------------------------- |
| `markdown.test.ts`                     | Markdown 渲染                          |
| `memoryStore.test.ts`                  | 记忆系统                               |
| `reasoningProfiles.test.ts`            | 推理配置                               |
| `pdfContext.test.ts`                   | PDF 分块/检索                          |
| `constants.safeguards.test.ts`         | 常量安全检查                           |
| `contextPanel.normalizers.test.ts`     | 数据规范化                             |
| `apiHelpers.test.ts`                   | API 工具                               |
| `paperSearch.test.ts`                  | 论文搜索                               |
| `composeContextController.test.ts`     | 上下文组合                             |
| `xhrStreaming.test.ts`                 | XHR 流式处理                           |
| `streamingUpdate.test.ts`              | 流式增量 DOM 更新                      |
| `normalization.test.ts`                | 字符串规范化                           |
| `pathFileUrl.test.ts`                  | 路径转换                               |
| `paperAttribution.test.ts`             | 论文归属                               |
| `fileExtraction.test.ts`               | 文件提取                               |
| `textUtils.selectedTextPrompt.test.ts` | 选中文本                               |
| **`contextPersistence.test.ts`**       | **上下文持久化（36KB，最大测试文件）** |
| **`startup.test.ts`**                  | **启动流程**                           |

---

## 32. 关键修改速查表

| 需要修改的功能               | 文件                                      | 函数/位置                                                               |
| ---------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| **文件预览渲染逻辑**         | `setupHandlers.ts` ~L1285                 | `updateFilePreview()`                                                   |
| **文件分类（category）**     | `controllers/fileIntakeController.ts`     | `resolveAttachmentCategory()`                                           |
| **文件类型标签（PDF/MD/…）** | `textUtils.ts`                            | `getAttachmentTypeLabel()`                                              |
| **文件上传处理**             | `controllers/fileIntakeController.ts`     | `createFileIntakeController()`                                          |
| **文件内容提取**             | `utils/fileExtraction.ts`                 | `extractTextFromPdfPath()` / `extractTextFromStoredFile()`              |
| **文件附件状态持久化**       | `prefHelpers.ts`                          | `persistFileAttachmentState()` / `loadPersistedFileAttachmentIds()`     |
| **SVG 图标替换/新增**        | `addon/content/icons/file-type-*.svg`     | 16×16 `currentColor` SVG                                                |
| **内联 chip SVG 图标映射**   | `zoteroPane.css`                          | `.llm-file-chip-inline[data-category]`                                  |
| **卡片容器 SVG 图标映射**    | `zoteroPane.css`                          | `.llm-file-context-type[data-category]`                                 |
| **论文标签渲染**             | `setupHandlers.ts` ~L1162                 | `appendPaperChip()`                                                     |
| **截图预览更新**             | `setupHandlers.ts` ~L1650+                | `updateImagePreview()`                                                  |
| **选中文本预览**             | `contextResolution.ts`                    | `applySelectedTextPreview()`                                            |
| **消息气泡渲染**             | `chat.ts`                                 | `refreshChat()` (~730行)                                                |
| **消息发送流程**             | `controllers/sendFlowController.ts`       | 全文件                                                                  |
| **上下文组合**               | `controllers/composeContextController.ts` | 全文件                                                                  |
| **LLM API 调用**             | `utils/llmClient.ts`                      | `chatWithProvider()`                                                    |
| **流式 UI 增量更新**         | `contextPanel/streamingUpdate.ts`         | `patchStreamingBubble()`                                                |
| **轻量持久化 / DB 表**       | `utils/chatStore.ts`                      | `appendMessage()` / `loadConversation()`                                |
| **上下文状态缓存与恢复**     | `chat.ts`                                 | `buildContextRefsSnapshot()` / `restoreContextPoolFromStoredMessages()` |
| **Zone B 长对话压缩**        | `chat.ts`                                 | `compactConversationHistory()` / `buildZoneBCSplit()`                   |
| **重试/编辑最后一条**        | `chat.ts`                                 | `retryLatestAssistantResponse()` / `editLatestUserMessageAndRetry()`    |
| **Markdown 渲染**            | `utils/markdown.ts`                       | `renderMarkdown()` / `splitIntoBlocks()`                                |
| **记忆系统**                 | `utils/memoryStore.ts`                    | `storeMemory()` / `searchMemories()`                                    |
| **OAuth 认证**               | `utils/oauthCli.ts`                       | `runProviderOAuthLogin()`                                               |
| **推理配置**                 | `utils/reasoningProfiles.ts`              | 推理级别定义                                                            |
| **模型选择**                 | `controllers/modelSelectionController.ts` | `getModelChoices()`                                                     |
| **快捷指令**                 | `shortcuts.ts`                            | `renderShortcuts()`                                                     |
| **笔记导出**                 | `notes.ts`                                | `createNoteFromAssistantText()` / `createNoteFromChatHistory()`         |
| **偏好面板**                 | `modules/preferenceScript.ts`             | `registerPrefsScripts()`                                                |
| **面板 DOM 缓存（文库）**    | `libraryPanel.ts`                         | `bootstrapSharedLibraryPanel()`                                         |
| **面板 DOM 缓存（阅读器）**  | `readerPanel.ts`                          | `bootstrapSharedReaderPanel()`                                          |
| **全局状态管理**             | `state.ts`                                | 各 Map/Set 缓存                                                         |
| **国际化**                   | `i18n.ts`                                 | `getPanelI18n()`                                                        |
| **启动生命周期**             | `hooks.ts`                                | `onStartup()` / `onMainWindowLoad()`                                    |
| **CSS 样式**                 | `addon/content/zoteroPane.css`            | 按类名搜索                                                              |

---

> 📌 **提示**: 由于 `setupHandlers.ts` 文件极大（~185KB），修改时建议先用行号范围定位。该文件中的函数基本按照 UI 区域从上到下排列：辅助工具 → 选中文本 → 论文预览 → 文件预览 → 图片预览 → 消息渲染 → 操作栏 → 发送 → 历史 → 快捷键。
