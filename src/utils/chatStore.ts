import type {
  SelectedTextSource,
  PaperContextRef,
  GlobalConversationSummary,
} from "../modules/contextPanel/types";
import {
  GLOBAL_CONVERSATION_KEY_BASE,
  PAPER_CONVERSATION_KEY_BASE,
} from "../modules/contextPanel/constants";
import {
  normalizeSelectedTextPaperContexts,
  normalizeSelectedTextSource,
  normalizePaperContextRefs,
} from "../modules/contextPanel/normalizers";

export type ContextRefsJson = {
  basePdf?: {
    itemId: number;
    contextItemId: number;
    title: string;
    removed?: boolean;
  };
  supplementalPapers?: PaperContextRef[];
  fileAttachmentIds?: string[];
  compactedSummary?: string;
};

export type StoredChatMessage = {
  messageId?: number;
  parentMessageId?: number | null;
  activeChildMessageId?: number | null;
  branchIndex?: number;
  siblingIndex?: number;
  siblingCount?: number;
  siblingMessageIds?: number[];
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  selectedText?: string;
  selectedTexts?: string[];
  selectedTextSources?: SelectedTextSource[];
  selectedTextPaperContexts?: (PaperContextRef | undefined)[];
  paperContexts?: PaperContextRef[];
  screenshotImages?: string[];
  attachments?: Array<{
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    category: "image" | "pdf" | "markdown" | "code" | "text" | "file";
    imageDataUrl?: string;
    textContent?: string;
    storedPath?: string;
    contentHash?: string;
  }>;
  modelName?: string;
  reasoningSummary?: string;
  reasoningDetails?: string;
  contextRefs?: ContextRefsJson;
};

const CHAT_MESSAGES_TABLE = "zotero_ai_chat_messages";
const CHAT_MESSAGES_INDEX = "zotero_ai_chat_messages_conversation_idx";
const CHAT_TREE_STATE_TABLE = "zotero_ai_chat_tree_state";
const GLOBAL_CONVERSATIONS_TABLE = "zotero_ai_global_conversations";
const GLOBAL_CONVERSATIONS_LIBRARY_INDEX =
  "zotero_ai_global_conversations_library_idx";
const PAPER_CONVERSATIONS_TABLE = "zotero_ai_paper_conversations";
const PAPER_CONVERSATIONS_ITEM_INDEX = "zotero_ai_paper_conversations_item_idx";

function normalizeConversationKey(conversationKey: number): number | null {
  if (!Number.isFinite(conversationKey)) return null;
  const normalized = Math.floor(conversationKey);
  return normalized > 0 ? normalized : null;
}

function normalizeLibraryID(libraryID: number): number | null {
  if (!Number.isFinite(libraryID)) return null;
  const normalized = Math.floor(libraryID);
  return normalized > 0 ? normalized : null;
}

function normalizeConversationTitleSeed(value: string): string {
  if (typeof value !== "string") return "";
  const normalized = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized.slice(0, 64);
}

function normalizeLimit(limit: number, fallback: number): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.floor(limit));
}

export async function initChatStore(): Promise<void> {
  await Zotero.DB.executeTransaction(async () => {
    await Zotero.DB.queryAsync(
      `CREATE TABLE IF NOT EXISTS ${CHAT_MESSAGES_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_key INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        selected_text TEXT,
        selected_texts_json TEXT,
        selected_text_sources_json TEXT,
        selected_text_paper_contexts_json TEXT,
        paper_contexts_json TEXT,
        screenshot_images TEXT,
        attachments_json TEXT,
        model_name TEXT,
        reasoning_summary TEXT,
        reasoning_details TEXT
      )`,
    );

    const columns = (await Zotero.DB.queryAsync(
      `PRAGMA table_info(${CHAT_MESSAGES_TABLE})`,
    )) as Array<{ name?: unknown }> | undefined;
    const hasModelNameColumn = Boolean(
      columns?.some((column) => column?.name === "model_name"),
    );
    if (!hasModelNameColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN model_name TEXT`,
      );
    }
    const hasSelectedTextColumn = Boolean(
      columns?.some((column) => column?.name === "selected_text"),
    );
    if (!hasSelectedTextColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN selected_text TEXT`,
      );
    }
    const hasSelectedTextsJsonColumn = Boolean(
      columns?.some((column) => column?.name === "selected_texts_json"),
    );
    if (!hasSelectedTextsJsonColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN selected_texts_json TEXT`,
      );
    }
    const hasSelectedTextSourcesJsonColumn = Boolean(
      columns?.some((column) => column?.name === "selected_text_sources_json"),
    );
    if (!hasSelectedTextSourcesJsonColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN selected_text_sources_json TEXT`,
      );
    }
    const hasSelectedTextPaperContextsJsonColumn = Boolean(
      columns?.some(
        (column) => column?.name === "selected_text_paper_contexts_json",
      ),
    );
    if (!hasSelectedTextPaperContextsJsonColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN selected_text_paper_contexts_json TEXT`,
      );
    }
    const hasPaperContextsJsonColumn = Boolean(
      columns?.some((column) => column?.name === "paper_contexts_json"),
    );
    if (!hasPaperContextsJsonColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN paper_contexts_json TEXT`,
      );
    }
    const hasScreenshotImagesColumn = Boolean(
      columns?.some((column) => column?.name === "screenshot_images"),
    );
    if (!hasScreenshotImagesColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN screenshot_images TEXT`,
      );
    }
    const hasAttachmentsJsonColumn = Boolean(
      columns?.some((column) => column?.name === "attachments_json"),
    );
    if (!hasAttachmentsJsonColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN attachments_json TEXT`,
      );
    }
    const hasContextRefsJsonColumn = Boolean(
      columns?.some((column) => column?.name === "context_refs_json"),
    );
    if (!hasContextRefsJsonColumn) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN context_refs_json TEXT`,
      );
    }
    if (!columns?.some((column) => column?.name === "parent_id")) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN parent_id INTEGER`,
      );
    }
    if (!columns?.some((column) => column?.name === "active_child_id")) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN active_child_id INTEGER`,
      );
    }
    if (!columns?.some((column) => column?.name === "branch_index")) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${CHAT_MESSAGES_TABLE}
         ADD COLUMN branch_index INTEGER NOT NULL DEFAULT 0`,
      );
    }

    await Zotero.DB.queryAsync(
      `CREATE INDEX IF NOT EXISTS ${CHAT_MESSAGES_INDEX}
       ON ${CHAT_MESSAGES_TABLE} (conversation_key, timestamp, id)`,
    );

    await Zotero.DB.queryAsync(
      `CREATE TABLE IF NOT EXISTS ${CHAT_TREE_STATE_TABLE} (
        conversation_key INTEGER PRIMARY KEY,
        active_root_id INTEGER,
        active_leaf_id INTEGER
      )`,
    );

    await migrateLinearConversationsToTree();

    await Zotero.DB.queryAsync(
      `CREATE TABLE IF NOT EXISTS ${GLOBAL_CONVERSATIONS_TABLE} (
        conversation_key INTEGER PRIMARY KEY,
        library_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        title TEXT
      )`,
    );

    await Zotero.DB.queryAsync(
      `CREATE INDEX IF NOT EXISTS ${GLOBAL_CONVERSATIONS_LIBRARY_INDEX}
       ON ${GLOBAL_CONVERSATIONS_TABLE} (library_id, created_at DESC, conversation_key DESC)`,
    );

    // ── Paper conversations table ──
    await Zotero.DB.queryAsync(
      `CREATE TABLE IF NOT EXISTS ${PAPER_CONVERSATIONS_TABLE} (
        conversation_key INTEGER PRIMARY KEY,
        parent_item_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        title TEXT
      )`,
    );
    await Zotero.DB.queryAsync(
      `CREATE INDEX IF NOT EXISTS ${PAPER_CONVERSATIONS_ITEM_INDEX}
       ON ${PAPER_CONVERSATIONS_TABLE} (parent_item_id, created_at DESC, conversation_key DESC)`,
    );

    // ── Schema migrations: is_pinned column ──
    const globalColumns = (await Zotero.DB.queryAsync(
      `PRAGMA table_info(${GLOBAL_CONVERSATIONS_TABLE})`,
    )) as Array<{ name?: unknown }> | undefined;
    if (!globalColumns?.some((c) => c?.name === "is_pinned")) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${GLOBAL_CONVERSATIONS_TABLE} ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`,
      );
    }
    const paperColumns = (await Zotero.DB.queryAsync(
      `PRAGMA table_info(${PAPER_CONVERSATIONS_TABLE})`,
    )) as Array<{ name?: unknown }> | undefined;
    if (!paperColumns?.some((c) => c?.name === "is_pinned")) {
      await Zotero.DB.queryAsync(
        `ALTER TABLE ${PAPER_CONVERSATIONS_TABLE} ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`,
      );
    }
  });
}

type StoredChatMessageRow = {
  messageId?: unknown;
  parentMessageId?: unknown;
  activeChildMessageId?: unknown;
  branchIndex?: unknown;
  role: unknown;
  text: unknown;
  timestamp: unknown;
  selectedText?: unknown;
  selectedTextsJson?: unknown;
  selectedTextSourcesJson?: unknown;
  selectedTextPaperContextsJson?: unknown;
  paperContextsJson?: unknown;
  screenshotImages?: unknown;
  attachmentsJson?: unknown;
  modelName?: unknown;
  reasoningSummary?: unknown;
  reasoningDetails?: unknown;
  contextRefsJson?: unknown;
};

type ChatTreeNodeRow = {
  messageId?: unknown;
  parentMessageId?: unknown;
  activeChildMessageId?: unknown;
  branchIndex?: unknown;
};

type SerializedMessageFields = {
  timestamp: number;
  selectedTexts: string[];
  selectedTextSources: SelectedTextSource[];
  selectedTextPaperContexts: (PaperContextRef | undefined)[];
  paperContexts: PaperContextRef[];
  screenshotImages: string[];
  attachments: NonNullable<StoredChatMessage["attachments"]>;
};

function normalizeTreeId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isFinite(id)) return null;
  const normalized = Math.floor(id);
  return normalized > 0 ? normalized : null;
}

function normalizeBranchIndex(value: unknown): number {
  const index = Number(value);
  return Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
}

function serializeMessageFields(
  message: Partial<StoredChatMessage>,
): SerializedMessageFields {
  const timestamp = Number(message.timestamp);
  const selectedTexts = Array.isArray(message.selectedTexts)
    ? message.selectedTexts
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : typeof message.selectedText === "string" && message.selectedText.trim()
      ? [message.selectedText.trim()]
      : [];
  const selectedTextSources = selectedTexts.map((_, index) =>
    normalizeSelectedTextSource(message.selectedTextSources?.[index]),
  );
  const selectedTextPaperContexts = normalizeSelectedTextPaperContexts(
    message.selectedTextPaperContexts,
    selectedTexts.length,
  );
  const paperContexts = normalizePaperContextRefs(message.paperContexts);
  const screenshotImages = Array.isArray(message.screenshotImages)
    ? message.screenshotImages.filter(
        (entry): entry is string => typeof entry === "string" && Boolean(entry),
      )
    : [];
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
        .filter(
          (entry) => entry && typeof entry.id === "string" && entry.id.trim(),
        )
        .map((entry) => ({
          ...entry,
          storedPath:
            typeof entry.storedPath === "string" && entry.storedPath.trim()
              ? entry.storedPath.trim()
              : undefined,
          contentHash:
            typeof entry.contentHash === "string" &&
            /^[a-f0-9]{64}$/i.test(entry.contentHash.trim())
              ? entry.contentHash.trim().toLowerCase()
              : undefined,
        }))
    : [];
  return {
    timestamp: Number.isFinite(timestamp) ? Math.floor(timestamp) : Date.now(),
    selectedTexts,
    selectedTextSources,
    selectedTextPaperContexts,
    paperContexts,
    screenshotImages,
    attachments,
  };
}

function toStoredChatMessage(
  row: StoredChatMessageRow,
): StoredChatMessage | null {
  const role =
    row.role === "assistant"
      ? "assistant"
      : row.role === "user"
        ? "user"
        : null;
  if (!role) return null;

  const timestamp = Number(row.timestamp);
  let selectedTexts: string[] | undefined;
  if (typeof row.selectedTextsJson === "string" && row.selectedTextsJson) {
    try {
      const parsed = JSON.parse(row.selectedTextsJson) as unknown;
      if (Array.isArray(parsed)) {
        const normalized = parsed.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        );
        if (normalized.length) {
          selectedTexts = normalized;
        }
      }
    } catch (_err) {
      selectedTexts = undefined;
    }
  }
  let selectedTextSources: SelectedTextSource[] | undefined;
  if (
    typeof row.selectedTextSourcesJson === "string" &&
    row.selectedTextSourcesJson
  ) {
    try {
      const parsed = JSON.parse(row.selectedTextSourcesJson) as unknown;
      if (Array.isArray(parsed)) {
        selectedTextSources = parsed.map((entry) =>
          normalizeSelectedTextSource(entry),
        );
      }
    } catch (_err) {
      selectedTextSources = undefined;
    }
  }
  const normalizedTexts = selectedTexts?.length
    ? selectedTexts
    : typeof row.selectedText === "string" && row.selectedText.trim()
      ? [row.selectedText]
      : [];
  let selectedTextPaperContexts: (PaperContextRef | undefined)[] | undefined;
  if (
    typeof row.selectedTextPaperContextsJson === "string" &&
    row.selectedTextPaperContextsJson
  ) {
    try {
      const parsed = JSON.parse(row.selectedTextPaperContextsJson) as unknown;
      const normalized = normalizeSelectedTextPaperContexts(
        parsed,
        normalizedTexts.length,
      );
      if (normalized.some((entry) => Boolean(entry))) {
        selectedTextPaperContexts = normalized;
      }
    } catch (_err) {
      selectedTextPaperContexts = undefined;
    }
  }
  let paperContexts: PaperContextRef[] | undefined;
  if (typeof row.paperContextsJson === "string" && row.paperContextsJson) {
    try {
      const parsed = JSON.parse(row.paperContextsJson) as unknown;
      const normalized = normalizePaperContextRefs(parsed);
      if (normalized.length) {
        paperContexts = normalized;
      }
    } catch (_err) {
      paperContexts = undefined;
    }
  }
  let screenshotImages: string[] | undefined;
  if (typeof row.screenshotImages === "string" && row.screenshotImages) {
    try {
      const parsed = JSON.parse(row.screenshotImages) as unknown;
      if (Array.isArray(parsed)) {
        const normalized = parsed.filter(
          (entry): entry is string =>
            typeof entry === "string" && Boolean(entry.trim()),
        );
        if (normalized.length) {
          screenshotImages = normalized;
        }
      }
    } catch (_err) {
      screenshotImages = undefined;
    }
  }
  let attachments: StoredChatMessage["attachments"] | undefined;
  if (typeof row.attachmentsJson === "string" && row.attachmentsJson) {
    try {
      const parsed = JSON.parse(row.attachmentsJson) as unknown;
      if (Array.isArray(parsed)) {
        const normalized = parsed.reduce<
          NonNullable<StoredChatMessage["attachments"]>
        >((out, entry) => {
          if (!entry || typeof entry !== "object") return out;
          const typed = entry as Record<string, unknown>;
          const id =
            typeof typed.id === "string" && typed.id.trim()
              ? typed.id.trim()
              : null;
          const name =
            typeof typed.name === "string" && typed.name.trim()
              ? typed.name.trim()
              : null;
          const mimeType =
            typeof typed.mimeType === "string" && typed.mimeType.trim()
              ? typed.mimeType.trim()
              : "application/octet-stream";
          const sizeBytes = Number(typed.sizeBytes);
          const category = typed.category;
          const validCategory =
            category === "image" ||
            category === "pdf" ||
            category === "markdown" ||
            category === "code" ||
            category === "text" ||
            category === "file";
          if (!id || !name || !validCategory) return out;
          out.push({
            id,
            name,
            mimeType,
            sizeBytes: Number.isFinite(sizeBytes) ? Math.max(0, sizeBytes) : 0,
            category,
            imageDataUrl:
              typeof typed.imageDataUrl === "string" &&
              typed.imageDataUrl.trim()
                ? typed.imageDataUrl
                : undefined,
            textContent:
              typeof typed.textContent === "string" && typed.textContent
                ? typed.textContent
                : undefined,
            storedPath:
              typeof typed.storedPath === "string" && typed.storedPath.trim()
                ? typed.storedPath.trim()
                : undefined,
            contentHash:
              typeof typed.contentHash === "string" &&
              /^[a-f0-9]{64}$/i.test(typed.contentHash.trim())
                ? typed.contentHash.trim().toLowerCase()
                : undefined,
          });
          return out;
        }, []);
        if (normalized.length) {
          attachments = normalized;
        }
      }
    } catch (_err) {
      attachments = undefined;
    }
  }
  if (!attachments?.length && screenshotImages?.length) {
    attachments = screenshotImages.map((url, index) => ({
      id: `legacy-screenshot-${index + 1}`,
      name: `Screenshot ${index + 1}.png`,
      mimeType: "image/png",
      sizeBytes: 0,
      category: "image" as const,
      imageDataUrl: url,
    }));
  }
  let contextRefs: ContextRefsJson | undefined;
  if (typeof row.contextRefsJson === "string" && row.contextRefsJson) {
    try {
      const parsed = JSON.parse(row.contextRefsJson) as unknown;
      if (parsed && typeof parsed === "object") {
        contextRefs = parsed as ContextRefsJson;
      }
    } catch (_err) {
      contextRefs = undefined;
    }
  }

  return {
    messageId: normalizeTreeId(row.messageId) ?? undefined,
    parentMessageId: normalizeTreeId(row.parentMessageId),
    activeChildMessageId: normalizeTreeId(row.activeChildMessageId),
    branchIndex: normalizeBranchIndex(row.branchIndex),
    role,
    text: typeof row.text === "string" ? row.text : "",
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    selectedText:
      typeof row.selectedText === "string" ? row.selectedText : undefined,
    selectedTexts: normalizedTexts.length ? normalizedTexts : undefined,
    selectedTextSources: (() => {
      if (!normalizedTexts.length) return undefined;
      return normalizedTexts.map((_, index) =>
        normalizeSelectedTextSource(selectedTextSources?.[index]),
      );
    })(),
    selectedTextPaperContexts,
    paperContexts,
    screenshotImages,
    attachments,
    modelName: typeof row.modelName === "string" ? row.modelName : undefined,
    reasoningSummary:
      typeof row.reasoningSummary === "string"
        ? row.reasoningSummary
        : undefined,
    reasoningDetails:
      typeof row.reasoningDetails === "string"
        ? row.reasoningDetails
        : undefined,
    contextRefs,
  };
}

const CHAT_MESSAGE_SELECT_SQL = `id AS messageId,
            parent_id AS parentMessageId,
            active_child_id AS activeChildMessageId,
            branch_index AS branchIndex,
            role,
            text,
            timestamp,
            selected_text AS selectedText,
            selected_texts_json AS selectedTextsJson,
            selected_text_sources_json AS selectedTextSourcesJson,
            selected_text_paper_contexts_json AS selectedTextPaperContextsJson,
            paper_contexts_json AS paperContextsJson,
            screenshot_images AS screenshotImages,
            attachments_json AS attachmentsJson,
            model_name AS modelName,
            reasoning_summary AS reasoningSummary,
            reasoning_details AS reasoningDetails,
            context_refs_json AS contextRefsJson`;

function annotateSiblingMetadata(
  messages: StoredChatMessage[],
  treeRows: ChatTreeNodeRow[],
): StoredChatMessage[] {
  const groups = new Map<string, number[]>();
  const nodeOrder = new Map<number, { branchIndex: number; id: number }>();
  for (const row of treeRows) {
    const id = normalizeTreeId(row.messageId);
    if (!id) continue;
    const parentId = normalizeTreeId(row.parentMessageId);
    const key = parentId === null ? "root" : String(parentId);
    const branchIndex = normalizeBranchIndex(row.branchIndex);
    nodeOrder.set(id, { branchIndex, id });
    const list = groups.get(key) || [];
    list.push(id);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const aOrder = nodeOrder.get(a);
      const bOrder = nodeOrder.get(b);
      return (aOrder?.branchIndex ?? 0) - (bOrder?.branchIndex ?? 0) || a - b;
    });
  }
  for (const message of messages) {
    if (!message.messageId) continue;
    const key =
      message.parentMessageId === null || message.parentMessageId === undefined
        ? "root"
        : String(message.parentMessageId);
    const siblings = groups.get(key) || [message.messageId];
    message.siblingMessageIds = siblings.slice();
    message.siblingCount = siblings.length;
    message.siblingIndex = Math.max(1, siblings.indexOf(message.messageId) + 1);
  }
  return messages;
}

async function loadTreeRows(
  conversationKey: number,
): Promise<ChatTreeNodeRow[]> {
  const rows = (await Zotero.DB.queryAsync(
    `SELECT id AS messageId,
            parent_id AS parentMessageId,
            active_child_id AS activeChildMessageId,
            branch_index AS branchIndex
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ?
     ORDER BY timestamp ASC, id ASC`,
    [conversationKey],
  )) as ChatTreeNodeRow[] | undefined;
  return rows || [];
}

async function getTreeState(
  conversationKey: number,
): Promise<{ activeRootId: number | null; activeLeafId: number | null }> {
  const rows = (await Zotero.DB.queryAsync(
    `SELECT active_root_id AS activeRootId,
            active_leaf_id AS activeLeafId
     FROM ${CHAT_TREE_STATE_TABLE}
     WHERE conversation_key = ?
     LIMIT 1`,
    [conversationKey],
  )) as Array<{ activeRootId?: unknown; activeLeafId?: unknown }> | undefined;
  return {
    activeRootId: normalizeTreeId(rows?.[0]?.activeRootId),
    activeLeafId: normalizeTreeId(rows?.[0]?.activeLeafId),
  };
}

async function upsertTreeState(
  conversationKey: number,
  activeRootId: number | null,
  activeLeafId: number | null,
): Promise<void> {
  await Zotero.DB.queryAsync(
    `INSERT OR REPLACE INTO ${CHAT_TREE_STATE_TABLE}
      (conversation_key, active_root_id, active_leaf_id)
     VALUES (?, ?, ?)`,
    [conversationKey, activeRootId, activeLeafId],
  );
}

function resolveActiveLeafFromRows(
  rootId: number | null,
  treeRows: ChatTreeNodeRow[],
): number | null {
  if (!rootId) return null;
  const byId = new Map<number, ChatTreeNodeRow>();
  for (const row of treeRows) {
    const id = normalizeTreeId(row.messageId);
    if (id) byId.set(id, row);
  }
  let currentId: number | null = rootId;
  const visited = new Set<number>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const row = byId.get(currentId);
    const activeChildId = normalizeTreeId(row?.activeChildMessageId);
    if (!activeChildId || !byId.has(activeChildId)) return currentId;
    currentId = activeChildId;
  }
  return currentId;
}

async function repairActiveChildChain(
  conversationKey: number,
  rootId: number,
  treeRows: ChatTreeNodeRow[],
): Promise<number> {
  const groups = new Map<string, ChatTreeNodeRow[]>();
  for (const row of treeRows) {
    const id = normalizeTreeId(row.messageId);
    if (!id) continue;
    const parentId = normalizeTreeId(row.parentMessageId);
    const key = parentId === null ? "root" : String(parentId);
    const list = groups.get(key) || [];
    list.push(row);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const aId = normalizeTreeId(a.messageId) || 0;
      const bId = normalizeTreeId(b.messageId) || 0;
      return (
        normalizeBranchIndex(a.branchIndex) -
          normalizeBranchIndex(b.branchIndex) || aId - bId
      );
    });
  }

  let currentId = rootId;
  const visited = new Set<number>();
  while (!visited.has(currentId)) {
    visited.add(currentId);
    const current = treeRows.find(
      (row) => normalizeTreeId(row.messageId) === currentId,
    );
    const activeChildId = normalizeTreeId(current?.activeChildMessageId);
    const children = groups.get(String(currentId)) || [];
    const activeChildStillValid = children.some(
      (child) => normalizeTreeId(child.messageId) === activeChildId,
    );
    if (activeChildId && activeChildStillValid) {
      currentId = activeChildId;
      continue;
    }
    const fallbackChildId = normalizeTreeId(children[0]?.messageId);
    if (!fallbackChildId) return currentId;
    await Zotero.DB.queryAsync(
      `UPDATE ${CHAT_MESSAGES_TABLE}
       SET active_child_id = ?
       WHERE id = ? AND conversation_key = ?`,
      [fallbackChildId, currentId, conversationKey],
    );
    currentId = fallbackChildId;
  }
  return currentId;
}

async function migrateConversationToTreeState(
  conversationKey: number,
): Promise<void> {
  const rows = (await Zotero.DB.queryAsync(
    `SELECT id AS messageId,
            parent_id AS parentMessageId,
            active_child_id AS activeChildMessageId,
            branch_index AS branchIndex
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ?
     ORDER BY timestamp ASC, id ASC`,
    [conversationKey],
  )) as ChatTreeNodeRow[] | undefined;
  if (!rows?.length) {
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_TREE_STATE_TABLE}
       WHERE conversation_key = ?`,
      [conversationKey],
    );
    return;
  }

  const state = await getTreeState(conversationKey);
  const knownIds = new Set(
    rows
      .map((row) => normalizeTreeId(row.messageId))
      .filter((id): id is number => Boolean(id)),
  );
  if (state.activeRootId && knownIds.has(state.activeRootId)) return;

  const hasAnyParent = rows.some((row) => normalizeTreeId(row.parentMessageId));
  if (!hasAnyParent) {
    let previousId: number | null = null;
    for (const row of rows) {
      const id = normalizeTreeId(row.messageId);
      if (!id) continue;
      await Zotero.DB.queryAsync(
        `UPDATE ${CHAT_MESSAGES_TABLE}
         SET parent_id = ?,
             active_child_id = NULL,
             branch_index = 0
         WHERE id = ? AND conversation_key = ?`,
        [previousId, id, conversationKey],
      );
      if (previousId) {
        await Zotero.DB.queryAsync(
          `UPDATE ${CHAT_MESSAGES_TABLE}
           SET active_child_id = ?
           WHERE id = ? AND conversation_key = ?`,
          [id, previousId, conversationKey],
        );
      }
      previousId = id;
    }
    const firstId = normalizeTreeId(rows[0]?.messageId);
    const lastId = previousId;
    await upsertTreeState(conversationKey, firstId, lastId);
    return;
  }

  let roots = rows.filter((row) => !normalizeTreeId(row.parentMessageId));
  if (!roots.length) {
    const firstId = normalizeTreeId(rows[0]?.messageId);
    if (!firstId) return;
    await Zotero.DB.queryAsync(
      `UPDATE ${CHAT_MESSAGES_TABLE}
       SET parent_id = NULL,
           branch_index = 0
       WHERE id = ? AND conversation_key = ?`,
      [firstId, conversationKey],
    );
    rows[0].parentMessageId = null;
    roots = [rows[0]];
  }
  roots.sort((a, b) => {
    const aId = normalizeTreeId(a.messageId) || 0;
    const bId = normalizeTreeId(b.messageId) || 0;
    return (
      normalizeBranchIndex(a.branchIndex) -
        normalizeBranchIndex(b.branchIndex) || aId - bId
    );
  });
  const rootId = normalizeTreeId(roots[0]?.messageId);
  if (!rootId) return;
  const leafId = await repairActiveChildChain(conversationKey, rootId, rows);
  await upsertTreeState(conversationKey, rootId, leafId);
}

async function migrateLinearConversationsToTree(): Promise<void> {
  const keys = (await Zotero.DB.columnQueryAsync(
    `SELECT DISTINCT conversation_key
     FROM ${CHAT_MESSAGES_TABLE}
     ORDER BY conversation_key ASC`,
  )) as number[] | false;
  if (!keys) return;
  for (const rawKey of keys) {
    const key = normalizeConversationKey(Number(rawKey));
    if (!key) continue;
    await migrateConversationToTreeState(key);
  }
}

async function ensureTreeStateForConversation(
  conversationKey: number,
): Promise<void> {
  await migrateConversationToTreeState(conversationKey);
}

export async function loadConversation(
  conversationKey: number,
  limit: number,
): Promise<StoredChatMessage[]> {
  return loadConversationPath(conversationKey, limit);
}

export async function loadConversationPath(
  conversationKey: number,
  limit = 200,
): Promise<StoredChatMessage[]> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return [];

  await ensureTreeStateForConversation(normalizedKey);
  const normalizedLimit = normalizeLimit(limit, 200);
  const treeRows = await loadTreeRows(normalizedKey);
  const state = await getTreeState(normalizedKey);
  if (!state.activeRootId) return [];

  const byId = new Map<number, ChatTreeNodeRow>();
  for (const row of treeRows) {
    const id = normalizeTreeId(row.messageId);
    if (id) byId.set(id, row);
  }
  const activeIds: number[] = [];
  let currentId: number | null = state.activeRootId;
  const visited = new Set<number>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    activeIds.push(currentId);
    const row = byId.get(currentId);
    const nextId = normalizeTreeId(row?.activeChildMessageId);
    currentId = nextId && byId.has(nextId) ? nextId : null;
  }

  const limitedIds =
    activeIds.length > normalizedLimit
      ? activeIds.slice(-normalizedLimit)
      : activeIds;
  if (!limitedIds.length) return [];
  const placeholders = limitedIds.map(() => "?").join(",");
  const rows = (await Zotero.DB.queryAsync(
    `SELECT ${CHAT_MESSAGE_SELECT_SQL}
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ?
       AND id IN (${placeholders})`,
    [normalizedKey, ...limitedIds],
  )) as StoredChatMessageRow[] | undefined;
  if (!rows?.length) return [];
  const rowById = new Map<number, StoredChatMessageRow>();
  for (const row of rows) {
    const id = normalizeTreeId(row.messageId);
    if (id) rowById.set(id, row);
  }
  const messages = limitedIds
    .map((id) => {
      const row = rowById.get(id);
      return row ? toStoredChatMessage(row) : null;
    })
    .filter((message): message is StoredChatMessage => Boolean(message));
  return annotateSiblingMetadata(messages, treeRows);
}

export async function loadConversationTree(
  conversationKey: number,
): Promise<StoredChatMessage[]> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return [];
  await ensureTreeStateForConversation(normalizedKey);
  const rows = (await Zotero.DB.queryAsync(
    `SELECT ${CHAT_MESSAGE_SELECT_SQL}
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ?
     ORDER BY timestamp ASC, id ASC`,
    [normalizedKey],
  )) as StoredChatMessageRow[] | undefined;
  if (!rows?.length) return [];
  const messages = rows
    .map((row) => toStoredChatMessage(row))
    .filter((message): message is StoredChatMessage => Boolean(message));
  return annotateSiblingMetadata(messages, await loadTreeRows(normalizedKey));
}

export async function appendMessage(
  conversationKey: number,
  message: StoredChatMessage,
): Promise<number> {
  return appendMessageNode(conversationKey, message);
}

async function getDefaultAppendParentId(
  conversationKey: number,
): Promise<number | null> {
  await ensureTreeStateForConversation(conversationKey);
  const state = await getTreeState(conversationKey);
  return state.activeLeafId;
}

async function getSiblingBranchIndex(
  conversationKey: number,
  parentMessageId: number | null,
): Promise<number> {
  const rows = (await Zotero.DB.queryAsync(
    `SELECT MAX(branch_index) AS maxBranchIndex
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ?
       AND ${parentMessageId === null ? "parent_id IS NULL" : "parent_id = ?"}`,
    parentMessageId === null
      ? [conversationKey]
      : [conversationKey, parentMessageId],
  )) as Array<{ maxBranchIndex?: unknown }> | undefined;
  const maxBranchIndex = Number(rows?.[0]?.maxBranchIndex);
  return Number.isFinite(maxBranchIndex) ? Math.floor(maxBranchIndex) + 1 : 0;
}

async function getRootIdFromRows(
  conversationKey: number,
): Promise<number | null> {
  const rootId = (await Zotero.DB.valueQueryAsync(
    `SELECT id
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ?
       AND parent_id IS NULL
     ORDER BY branch_index ASC, id ASC
     LIMIT 1`,
    [conversationKey],
  )) as number | false;
  return normalizeTreeId(rootId);
}

export async function appendMessageNode(
  conversationKey: number,
  message: StoredChatMessage,
  parentMessageId?: number | null,
): Promise<number> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return 0;
  const normalizedParent =
    parentMessageId === undefined
      ? await getDefaultAppendParentId(normalizedKey)
      : normalizeTreeId(parentMessageId);
  if (normalizedParent) {
    const parentConversationKey = (await Zotero.DB.valueQueryAsync(
      `SELECT conversation_key
       FROM ${CHAT_MESSAGES_TABLE}
       WHERE id = ?
       LIMIT 1`,
      [normalizedParent],
    )) as number | false;
    if (Number(parentConversationKey) !== normalizedKey) return 0;
  }

  const serialized = serializeMessageFields(message);
  const branchIndex = await getSiblingBranchIndex(
    normalizedKey,
    normalizedParent,
  );
  await Zotero.DB.queryAsync(
    `INSERT INTO ${CHAT_MESSAGES_TABLE}
      (conversation_key, parent_id, active_child_id, branch_index, role, text, timestamp, selected_text, selected_texts_json, selected_text_sources_json, selected_text_paper_contexts_json, paper_contexts_json, screenshot_images, attachments_json, model_name, reasoning_summary, reasoning_details, context_refs_json)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalizedKey,
      normalizedParent,
      branchIndex,
      message.role,
      message.text,
      serialized.timestamp,
      serialized.selectedTexts[0] || message.selectedText || null,
      serialized.selectedTexts.length
        ? JSON.stringify(serialized.selectedTexts)
        : null,
      serialized.selectedTextSources.length
        ? JSON.stringify(serialized.selectedTextSources)
        : null,
      serialized.selectedTextPaperContexts.some((entry) => Boolean(entry))
        ? JSON.stringify(serialized.selectedTextPaperContexts)
        : null,
      serialized.paperContexts.length
        ? JSON.stringify(serialized.paperContexts)
        : null,
      serialized.screenshotImages.length
        ? JSON.stringify(serialized.screenshotImages)
        : null,
      serialized.attachments.length
        ? JSON.stringify(serialized.attachments)
        : null,
      message.modelName || null,
      message.reasoningSummary || null,
      message.reasoningDetails || null,
      message.contextRefs ? JSON.stringify(message.contextRefs) : null,
    ],
  );
  const insertedId = normalizeTreeId(
    await Zotero.DB.valueQueryAsync(`SELECT last_insert_rowid()`),
  );
  if (!insertedId) return 0;

  if (normalizedParent) {
    await Zotero.DB.queryAsync(
      `UPDATE ${CHAT_MESSAGES_TABLE}
       SET active_child_id = ?
       WHERE id = ? AND conversation_key = ?`,
      [insertedId, normalizedParent, normalizedKey],
    );
  }
  const activeRootId =
    normalizedParent === null
      ? insertedId
      : (await getTreeState(normalizedKey)).activeRootId ||
        (await getRootIdFromRows(normalizedKey));
  await upsertTreeState(normalizedKey, activeRootId, insertedId);
  return insertedId;
}

export async function createSiblingBranch(
  conversationKey: number,
  sourceMessageId: number,
  message: StoredChatMessage,
): Promise<number> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  const sourceId = normalizeTreeId(sourceMessageId);
  if (!normalizedKey || !sourceId) return 0;
  const rows = (await Zotero.DB.queryAsync(
    `SELECT parent_id AS parentMessageId
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ? AND id = ?
     LIMIT 1`,
    [normalizedKey, sourceId],
  )) as Array<{ parentMessageId?: unknown }> | undefined;
  if (!rows?.length) return 0;
  return appendMessageNode(
    normalizedKey,
    message,
    normalizeTreeId(rows[0]?.parentMessageId),
  );
}

export async function updateMessageNode(
  conversationKey: number,
  messageId: number,
  message: Partial<StoredChatMessage>,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  const normalizedMessageId = normalizeTreeId(messageId);
  if (!normalizedKey || !normalizedMessageId) return;

  const assignments: string[] = [];
  const values: unknown[] = [];
  const serialized = serializeMessageFields(message);
  if (typeof message.text === "string") {
    assignments.push("text = ?");
    values.push(message.text);
  }
  if (message.timestamp !== undefined) {
    assignments.push("timestamp = ?");
    values.push(serialized.timestamp);
  }
  if (
    message.selectedText !== undefined ||
    message.selectedTexts !== undefined
  ) {
    assignments.push("selected_text = ?");
    assignments.push("selected_texts_json = ?");
    assignments.push("selected_text_sources_json = ?");
    assignments.push("selected_text_paper_contexts_json = ?");
    values.push(serialized.selectedTexts[0] || message.selectedText || null);
    values.push(
      serialized.selectedTexts.length
        ? JSON.stringify(serialized.selectedTexts)
        : null,
    );
    values.push(
      serialized.selectedTextSources.length
        ? JSON.stringify(serialized.selectedTextSources)
        : null,
    );
    values.push(
      serialized.selectedTextPaperContexts.some((entry) => Boolean(entry))
        ? JSON.stringify(serialized.selectedTextPaperContexts)
        : null,
    );
  }
  if (message.paperContexts !== undefined) {
    assignments.push("paper_contexts_json = ?");
    values.push(
      serialized.paperContexts.length
        ? JSON.stringify(serialized.paperContexts)
        : null,
    );
  }
  if (message.screenshotImages !== undefined) {
    assignments.push("screenshot_images = ?");
    values.push(
      serialized.screenshotImages.length
        ? JSON.stringify(serialized.screenshotImages)
        : null,
    );
  }
  if (message.attachments !== undefined) {
    assignments.push("attachments_json = ?");
    values.push(
      serialized.attachments.length
        ? JSON.stringify(serialized.attachments)
        : null,
    );
  }
  if (message.modelName !== undefined) {
    assignments.push("model_name = ?");
    values.push(message.modelName || null);
  }
  if (message.reasoningSummary !== undefined) {
    assignments.push("reasoning_summary = ?");
    values.push(message.reasoningSummary || null);
  }
  if (message.reasoningDetails !== undefined) {
    assignments.push("reasoning_details = ?");
    values.push(message.reasoningDetails || null);
  }
  if (message.contextRefs !== undefined) {
    assignments.push("context_refs_json = ?");
    values.push(
      message.contextRefs ? JSON.stringify(message.contextRefs) : null,
    );
  }
  if (!assignments.length) return;
  await Zotero.DB.queryAsync(
    `UPDATE ${CHAT_MESSAGES_TABLE}
     SET ${assignments.join(", ")}
     WHERE conversation_key = ? AND id = ?`,
    [...values, normalizedKey, normalizedMessageId],
  );
}

export async function setActiveChild(
  conversationKey: number,
  parentMessageId: number | null,
  childMessageId: number,
): Promise<StoredChatMessage[]> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  const normalizedParent = normalizeTreeId(parentMessageId);
  const normalizedChild = normalizeTreeId(childMessageId);
  if (!normalizedKey || !normalizedChild) return [];

  await ensureTreeStateForConversation(normalizedKey);
  const childRows = (await Zotero.DB.queryAsync(
    `SELECT parent_id AS parentMessageId
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ? AND id = ?
     LIMIT 1`,
    [normalizedKey, normalizedChild],
  )) as Array<{ parentMessageId?: unknown }> | undefined;
  if (!childRows?.length) return loadConversationPath(normalizedKey, 200);
  const childParent = normalizeTreeId(childRows[0]?.parentMessageId);
  if (childParent !== normalizedParent) {
    return loadConversationPath(normalizedKey, 200);
  }

  if (normalizedParent) {
    await Zotero.DB.queryAsync(
      `UPDATE ${CHAT_MESSAGES_TABLE}
       SET active_child_id = ?
       WHERE conversation_key = ? AND id = ?`,
      [normalizedChild, normalizedKey, normalizedParent],
    );
  }

  const treeRows = await loadTreeRows(normalizedKey);
  const leafId = resolveActiveLeafFromRows(normalizedChild, treeRows);
  const state = await getTreeState(normalizedKey);
  const activeRootId = normalizedParent
    ? state.activeRootId || (await getRootIdFromRows(normalizedKey))
    : normalizedChild;
  await upsertTreeState(normalizedKey, activeRootId, leafId || normalizedChild);
  return loadConversationPath(normalizedKey, 200);
}

function cloneStoredMessageForInsert(
  message: StoredChatMessage,
): StoredChatMessage {
  return {
    role: message.role,
    text: message.text,
    timestamp: message.timestamp,
    selectedText: message.selectedText,
    selectedTexts: message.selectedTexts
      ? message.selectedTexts.slice()
      : undefined,
    selectedTextSources: message.selectedTextSources
      ? message.selectedTextSources.slice()
      : undefined,
    selectedTextPaperContexts: message.selectedTextPaperContexts
      ? message.selectedTextPaperContexts.slice()
      : undefined,
    paperContexts: message.paperContexts
      ? message.paperContexts.slice()
      : undefined,
    screenshotImages: message.screenshotImages
      ? message.screenshotImages.slice()
      : undefined,
    attachments: message.attachments
      ? message.attachments.map((attachment) => ({ ...attachment }))
      : undefined,
    modelName: message.modelName,
    reasoningSummary: message.reasoningSummary,
    reasoningDetails: message.reasoningDetails,
    contextRefs: message.contextRefs,
  };
}

export async function cloneActivePathPrefixToConversation(
  sourceConversationKey: number,
  targetConversationKey: number,
  throughMessageId: number,
): Promise<number[]> {
  const normalizedSourceKey = normalizeConversationKey(sourceConversationKey);
  const normalizedTargetKey = normalizeConversationKey(targetConversationKey);
  const normalizedThroughId = normalizeTreeId(throughMessageId);
  if (!normalizedSourceKey || !normalizedTargetKey || !normalizedThroughId) {
    return [];
  }

  const activePath = await loadConversationPath(normalizedSourceKey, 10000);
  const throughIndex = activePath.findIndex(
    (message) => message.messageId === normalizedThroughId,
  );
  if (throughIndex < 0) return [];

  const clonedIds: number[] = [];
  let parentId: number | null = null;
  for (const message of activePath.slice(0, throughIndex + 1)) {
    const clonedId = await appendMessageNode(
      normalizedTargetKey,
      cloneStoredMessageForInsert(message),
      parentId,
    );
    if (!clonedId) break;
    clonedIds.push(clonedId);
    parentId = clonedId;
  }
  return clonedIds;
}

export async function updateLatestUserMessage(
  conversationKey: number,
  message: Pick<
    StoredChatMessage,
    | "text"
    | "timestamp"
    | "selectedText"
    | "selectedTexts"
    | "selectedTextSources"
    | "selectedTextPaperContexts"
    | "paperContexts"
    | "screenshotImages"
    | "attachments"
  >,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  const activePath = await loadConversationPath(normalizedKey, 10000);
  const latestUser = [...activePath]
    .reverse()
    .find((entry) => entry.role === "user" && entry.messageId);
  if (!latestUser?.messageId) return;
  await updateMessageNode(normalizedKey, latestUser.messageId, message);
}

export async function updateLatestAssistantMessage(
  conversationKey: number,
  message: Pick<
    StoredChatMessage,
    "text" | "timestamp" | "modelName" | "reasoningSummary" | "reasoningDetails"
  >,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  const activePath = await loadConversationPath(normalizedKey, 10000);
  const latestAssistant = [...activePath]
    .reverse()
    .find((entry) => entry.role === "assistant" && entry.messageId);
  if (!latestAssistant?.messageId) return;
  await updateMessageNode(normalizedKey, latestAssistant.messageId, message);
}

export async function clearConversation(
  conversationKey: number,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;

  await Zotero.DB.executeTransaction(async () => {
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_MESSAGES_TABLE}
       WHERE conversation_key = ?`,
      [normalizedKey],
    );
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_TREE_STATE_TABLE}
       WHERE conversation_key = ?`,
      [normalizedKey],
    );
  });
}

export async function pruneConversation(
  conversationKey: number,
  keep: number,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;

  const normalizedKeep = Number.isFinite(keep) ? Math.floor(keep) : 200;
  if (normalizedKeep <= 0) {
    await clearConversation(normalizedKey);
    return;
  }

  // Tree conversations keep hidden siblings and historical paths.  Pruning by
  // recency would corrupt branch navigation, so positive keep values are kept
  // as a compatibility no-op.
}

type GlobalConversationSummaryRow = {
  conversationKey?: unknown;
  libraryID?: unknown;
  createdAt?: unknown;
  title?: unknown;
  lastActivityAt?: unknown;
  userTurnCount?: unknown;
  isPinned?: unknown;
};

function toGlobalConversationSummary(
  row: GlobalConversationSummaryRow,
): GlobalConversationSummary | null {
  const conversationKey = normalizeConversationKey(Number(row.conversationKey));
  const libraryID = normalizeLibraryID(Number(row.libraryID));
  const createdAt = Number(row.createdAt);
  const lastActivityAt = Number(row.lastActivityAt);
  const userTurnCount = Number(row.userTurnCount);
  if (!conversationKey || !libraryID || !Number.isFinite(createdAt)) {
    return null;
  }
  return {
    conversationKey,
    libraryID,
    createdAt: Math.floor(createdAt),
    title:
      typeof row.title === "string" && row.title.trim()
        ? row.title.trim()
        : undefined,
    lastActivityAt: Number.isFinite(lastActivityAt)
      ? Math.floor(lastActivityAt)
      : Math.floor(createdAt),
    userTurnCount: Number.isFinite(userTurnCount)
      ? Math.max(0, Math.floor(userTurnCount))
      : 0,
    isPinned: Number(row.isPinned) === 1,
  };
}

export async function createGlobalConversation(
  libraryID: number,
): Promise<number> {
  const normalizedLibraryID = normalizeLibraryID(libraryID);
  if (!normalizedLibraryID) return 0;

  const createdAt = Date.now();
  return await Zotero.DB.executeTransaction(async () => {
    const rows = (await Zotero.DB.queryAsync(
      `SELECT MAX(conversation_key) AS maxConversationKey
       FROM ${GLOBAL_CONVERSATIONS_TABLE}`,
    )) as Array<{ maxConversationKey?: unknown }> | undefined;
    const maxConversationKey = Number(rows?.[0]?.maxConversationKey);
    const nextConversationKey = Number.isFinite(maxConversationKey)
      ? Math.max(
          GLOBAL_CONVERSATION_KEY_BASE,
          Math.floor(maxConversationKey) + 1,
        )
      : GLOBAL_CONVERSATION_KEY_BASE;
    await Zotero.DB.queryAsync(
      `INSERT INTO ${GLOBAL_CONVERSATIONS_TABLE}
        (conversation_key, library_id, created_at, title)
       VALUES (?, ?, ?, NULL)`,
      [nextConversationKey, normalizedLibraryID, createdAt],
    );
    return nextConversationKey;
  });
}

export async function listGlobalConversations(
  libraryID: number,
  limit: number,
  includeEmpty = false,
): Promise<GlobalConversationSummary[]> {
  const normalizedLibraryID = normalizeLibraryID(libraryID);
  if (!normalizedLibraryID) return [];
  const normalizedLimit = normalizeLimit(limit, 50);

  const rows = (await Zotero.DB.queryAsync(
    `SELECT gc.conversation_key AS conversationKey,
            gc.library_id AS libraryID,
            gc.created_at AS createdAt,
            gc.title AS title,
            gc.is_pinned AS isPinned,
            COALESCE(MAX(m.timestamp), gc.created_at) AS lastActivityAt,
            SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS userTurnCount
     FROM ${GLOBAL_CONVERSATIONS_TABLE} gc
     LEFT JOIN ${CHAT_MESSAGES_TABLE} m
       ON m.conversation_key = gc.conversation_key
     WHERE gc.library_id = ?
     GROUP BY gc.conversation_key, gc.library_id, gc.created_at, gc.title, gc.is_pinned
     ${includeEmpty ? "" : "HAVING SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) > 0"}
     ORDER BY gc.is_pinned DESC, lastActivityAt DESC, gc.conversation_key DESC
     LIMIT ?`,
    [normalizedLibraryID, normalizedLimit],
  )) as GlobalConversationSummaryRow[] | undefined;

  if (!rows?.length) return [];
  const out: GlobalConversationSummary[] = [];
  for (const row of rows) {
    const normalized = toGlobalConversationSummary(row);
    if (!normalized) continue;
    out.push(normalized);
  }
  return out;
}

export async function getGlobalConversationUserTurnCount(
  conversationKey: number,
): Promise<number> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return 0;
  const rows = (await Zotero.DB.queryAsync(
    `SELECT SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS userTurnCount
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ?`,
    [normalizedKey],
  )) as Array<{ userTurnCount?: unknown }> | undefined;
  const count = Number(rows?.[0]?.userTurnCount);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

export async function getLatestEmptyGlobalConversation(
  libraryID: number,
): Promise<GlobalConversationSummary | null> {
  const normalizedLibraryID = normalizeLibraryID(libraryID);
  if (!normalizedLibraryID) return null;
  const rows = (await Zotero.DB.queryAsync(
    `SELECT gc.conversation_key AS conversationKey,
            gc.library_id AS libraryID,
            gc.created_at AS createdAt,
            gc.title AS title,
            gc.created_at AS lastActivityAt,
            SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS userTurnCount
     FROM ${GLOBAL_CONVERSATIONS_TABLE} gc
     LEFT JOIN ${CHAT_MESSAGES_TABLE} m
       ON m.conversation_key = gc.conversation_key
     WHERE gc.library_id = ?
     GROUP BY gc.conversation_key, gc.library_id, gc.created_at, gc.title
     HAVING SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) = 0
     ORDER BY gc.created_at DESC, gc.conversation_key DESC
     LIMIT 1`,
    [normalizedLibraryID],
  )) as GlobalConversationSummaryRow[] | undefined;
  if (!rows?.length) return null;
  return toGlobalConversationSummary(rows[0]);
}

export async function getGlobalConversation(
  conversationKey: number,
): Promise<GlobalConversationSummary | null> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return null;
  const rows = (await Zotero.DB.queryAsync(
    `SELECT gc.conversation_key AS conversationKey,
            gc.library_id AS libraryID,
            gc.created_at AS createdAt,
            gc.title AS title,
            COALESCE(MAX(m.timestamp), gc.created_at) AS lastActivityAt,
            SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS userTurnCount
     FROM ${GLOBAL_CONVERSATIONS_TABLE} gc
     LEFT JOIN ${CHAT_MESSAGES_TABLE} m
       ON m.conversation_key = gc.conversation_key
     WHERE gc.conversation_key = ?
     GROUP BY gc.conversation_key, gc.library_id, gc.created_at, gc.title
     LIMIT 1`,
    [normalizedKey],
  )) as GlobalConversationSummaryRow[] | undefined;
  if (!rows?.length) return null;
  return toGlobalConversationSummary(rows[0]);
}

export async function touchGlobalConversationTitle(
  conversationKey: number,
  titleSeed: string,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  const title = normalizeConversationTitleSeed(titleSeed);
  if (!title) return;
  await Zotero.DB.queryAsync(
    `UPDATE ${GLOBAL_CONVERSATIONS_TABLE}
     SET title = ?
     WHERE conversation_key = ?
       AND (title IS NULL OR TRIM(title) = '')`,
    [title, normalizedKey],
  );
}

export async function deleteGlobalConversation(
  conversationKey: number,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  await Zotero.DB.executeTransaction(async () => {
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_MESSAGES_TABLE}
       WHERE conversation_key = ?`,
      [normalizedKey],
    );
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_TREE_STATE_TABLE}
       WHERE conversation_key = ?`,
      [normalizedKey],
    );
    await Zotero.DB.queryAsync(
      `DELETE FROM ${GLOBAL_CONVERSATIONS_TABLE}
       WHERE conversation_key = ?`,
      [normalizedKey],
    );
  });
}

export async function deleteAllGlobalConversationsByLibrary(
  libraryID: number,
): Promise<number[]> {
  const normalizedLibraryID = normalizeLibraryID(libraryID);
  if (!normalizedLibraryID) return [];

  return await Zotero.DB.executeTransaction(async () => {
    const rows = (await Zotero.DB.queryAsync(
      `SELECT conversation_key AS conversationKey
       FROM ${GLOBAL_CONVERSATIONS_TABLE}
       WHERE library_id = ?`,
      [normalizedLibraryID],
    )) as Array<{ conversationKey?: unknown }> | undefined;

    if (!rows?.length) return [];

    const deletedKeys: number[] = [];
    for (const row of rows) {
      const key = Number(row.conversationKey);
      if (!Number.isFinite(key) || key <= 0) continue;
      deletedKeys.push(Math.floor(key));
    }
    if (!deletedKeys.length) return [];

    const placeholders = deletedKeys.map(() => "?").join(",");
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_MESSAGES_TABLE}
       WHERE conversation_key IN (${placeholders})`,
      deletedKeys,
    );
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_TREE_STATE_TABLE}
       WHERE conversation_key IN (${placeholders})`,
      deletedKeys,
    );
    await Zotero.DB.queryAsync(
      `DELETE FROM ${GLOBAL_CONVERSATIONS_TABLE}
       WHERE library_id = ?`,
      [normalizedLibraryID],
    );

    return deletedKeys;
  });
}

export async function clearAllChatHistory(): Promise<void> {
  await Zotero.DB.executeTransaction(async () => {
    await Zotero.DB.queryAsync(`DELETE FROM ${CHAT_MESSAGES_TABLE}`);
    await Zotero.DB.queryAsync(`DELETE FROM ${CHAT_TREE_STATE_TABLE}`);
    await Zotero.DB.queryAsync(`DELETE FROM ${GLOBAL_CONVERSATIONS_TABLE}`);
    await Zotero.DB.queryAsync(`DELETE FROM ${PAPER_CONVERSATIONS_TABLE}`);
  });
}

// =============================================================================
// Paper Conversations (Reader multi-history)
// =============================================================================

export type PaperConversationSummary = {
  conversationKey: number;
  parentItemId: number;
  createdAt: number;
  title?: string;
  lastActivityAt: number;
  userTurnCount: number;
  isPinned?: boolean;
};

export async function createPaperConversation(
  parentItemId: number,
): Promise<number> {
  if (!Number.isFinite(parentItemId) || parentItemId <= 0) return 0;
  const normalizedParent = Math.floor(parentItemId);
  const createdAt = Date.now();
  return await Zotero.DB.executeTransaction(async () => {
    const rows = (await Zotero.DB.queryAsync(
      `SELECT MAX(conversation_key) AS maxKey FROM ${PAPER_CONVERSATIONS_TABLE}`,
    )) as Array<{ maxKey?: unknown }> | undefined;
    const maxKey = Number(rows?.[0]?.maxKey);
    const nextKey = Number.isFinite(maxKey)
      ? Math.max(PAPER_CONVERSATION_KEY_BASE, Math.floor(maxKey) + 1)
      : PAPER_CONVERSATION_KEY_BASE;
    await Zotero.DB.queryAsync(
      `INSERT INTO ${PAPER_CONVERSATIONS_TABLE}
        (conversation_key, parent_item_id, created_at, title)
       VALUES (?, ?, ?, NULL)`,
      [nextKey, normalizedParent, createdAt],
    );
    return nextKey;
  });
}

export async function listPaperConversations(
  parentItemId: number,
  limit: number,
): Promise<PaperConversationSummary[]> {
  if (!Number.isFinite(parentItemId) || parentItemId <= 0) return [];
  const normalizedParent = Math.floor(parentItemId);
  const normalizedLimit = normalizeLimit(limit, 10);

  // Use columnQueryAsync to get conversation keys — avoids Proxy-wrapped row
  // issues that cause queryAsync to return undefined for this table.
  const keys = (await Zotero.DB.columnQueryAsync(
    `SELECT conversation_key
     FROM ${PAPER_CONVERSATIONS_TABLE}
     WHERE parent_item_id = ?
     ORDER BY created_at DESC, conversation_key DESC
     LIMIT ?`,
    [normalizedParent, normalizedLimit],
  )) as number[] | false;

  if (!keys || !keys.length) return [];

  const results: PaperConversationSummary[] = [];
  for (const rawKey of keys) {
    const key = Math.floor(Number(rawKey));
    if (!Number.isFinite(key) || key <= 0) continue;

    const title = (await Zotero.DB.valueQueryAsync(
      `SELECT title FROM ${PAPER_CONVERSATIONS_TABLE} WHERE conversation_key = ?`,
      [key],
    )) as string | false;

    const createdAt = (await Zotero.DB.valueQueryAsync(
      `SELECT created_at FROM ${PAPER_CONVERSATIONS_TABLE} WHERE conversation_key = ?`,
      [key],
    )) as number | false;

    const lastActivityAt = (await Zotero.DB.valueQueryAsync(
      `SELECT COALESCE(MAX(timestamp), ?)
       FROM ${CHAT_MESSAGES_TABLE}
       WHERE conversation_key = ?`,
      [createdAt || 0, key],
    )) as number | false;

    const userTurnCount = (await Zotero.DB.valueQueryAsync(
      `SELECT COUNT(*)
       FROM ${CHAT_MESSAGES_TABLE}
       WHERE conversation_key = ? AND role = 'user'`,
      [key],
    )) as number | false;

    const isPinned = (await Zotero.DB.valueQueryAsync(
      `SELECT is_pinned FROM ${PAPER_CONVERSATIONS_TABLE} WHERE conversation_key = ?`,
      [key],
    )) as number | false;

    results.push({
      conversationKey: key,
      parentItemId: normalizedParent,
      createdAt: Math.floor(Number(createdAt) || 0),
      title: typeof title === "string" && title ? title : undefined,
      lastActivityAt: Math.floor(
        Number(lastActivityAt) || Number(createdAt) || 0,
      ),
      userTurnCount: Math.floor(Number(userTurnCount) || 0),
      isPinned: Number(isPinned) === 1,
    });
  }
  // Sort pinned first, then by lastActivityAt DESC
  results.sort(
    (a, b) =>
      (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
      b.lastActivityAt - a.lastActivityAt ||
      b.conversationKey - a.conversationKey,
  );
  return results;
}

export async function deletePaperConversation(
  conversationKey: number,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  await Zotero.DB.executeTransaction(async () => {
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_MESSAGES_TABLE} WHERE conversation_key = ?`,
      [normalizedKey],
    );
    await Zotero.DB.queryAsync(
      `DELETE FROM ${CHAT_TREE_STATE_TABLE} WHERE conversation_key = ?`,
      [normalizedKey],
    );
    await Zotero.DB.queryAsync(
      `DELETE FROM ${PAPER_CONVERSATIONS_TABLE} WHERE conversation_key = ?`,
      [normalizedKey],
    );
  });
}

export async function touchPaperConversationTitle(
  conversationKey: number,
  titleSeed: string,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  const title = normalizeConversationTitleSeed(titleSeed);
  await Zotero.DB.queryAsync(
    `UPDATE ${PAPER_CONVERSATIONS_TABLE}
     SET title = COALESCE(title, ?)
     WHERE conversation_key = ?`,
    [title || null, normalizedKey],
  );
}

export async function getLatestPaperConversation(
  parentItemId: number,
): Promise<PaperConversationSummary | null> {
  if (!Number.isFinite(parentItemId) || parentItemId <= 0) return null;
  const list = await listPaperConversations(parentItemId, 1);
  return list.length > 0 ? list[0] : null;
}

export async function getPaperConversationUserTurnCount(
  conversationKey: number,
): Promise<number> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return 0;
  const cnt = (await Zotero.DB.valueQueryAsync(
    `SELECT COUNT(*)
     FROM ${CHAT_MESSAGES_TABLE}
     WHERE conversation_key = ? AND role = 'user'`,
    [normalizedKey],
  )) as number | false;
  return Math.floor(Number(cnt) || 0);
}

// =============================================================================
// Rename (force-overwrite title regardless of existing value)
// =============================================================================

export async function renameGlobalConversation(
  conversationKey: number,
  newTitle: string,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  const title = normalizeConversationTitleSeed(newTitle);
  await Zotero.DB.queryAsync(
    `UPDATE ${GLOBAL_CONVERSATIONS_TABLE} SET title = ? WHERE conversation_key = ?`,
    [title || null, normalizedKey],
  );
}

export async function renamePaperConversation(
  conversationKey: number,
  newTitle: string,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  const title = normalizeConversationTitleSeed(newTitle);
  await Zotero.DB.queryAsync(
    `UPDATE ${PAPER_CONVERSATIONS_TABLE} SET title = ? WHERE conversation_key = ?`,
    [title || null, normalizedKey],
  );
}

// =============================================================================
// Pin / Unpin
// =============================================================================

export async function pinGlobalConversation(
  conversationKey: number,
  pinned: boolean,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  await Zotero.DB.queryAsync(
    `UPDATE ${GLOBAL_CONVERSATIONS_TABLE} SET is_pinned = ? WHERE conversation_key = ?`,
    [pinned ? 1 : 0, normalizedKey],
  );
}

export async function pinPaperConversation(
  conversationKey: number,
  pinned: boolean,
): Promise<void> {
  const normalizedKey = normalizeConversationKey(conversationKey);
  if (!normalizedKey) return;
  await Zotero.DB.queryAsync(
    `UPDATE ${PAPER_CONVERSATIONS_TABLE} SET is_pinned = ? WHERE conversation_key = ?`,
    [pinned ? 1 : 0, normalizedKey],
  );
}
