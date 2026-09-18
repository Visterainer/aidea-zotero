import type { DocumentLocator } from "../modules/contextPanel/document/types";
/** Portable archive metadata. No local IDs, paths, caches or credentials. */
export type TransferSource = {
  library: string | null;
  key: string;
  title: string;
  parentKey?: string;
  kind?: "pdf" | "epub";
};
export type TransferCitation = {
  id: string;
  text: string;
  source: TransferSource;
  documentHash?: string;
  locator?: DocumentLocator;
};
export type TransferMessage = {
  uuid: string;
  legacyKey?: string;
  originUuid?: string;
  parent: string | null;
  activeChild: string | null;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  model: string | null;
  selectedTexts: string[];
  citations: TransferCitation[];
  missingAttachments: string[];
  resources?: TransferResource[];
};
export type TransferResource = {
  index: number;
  hash: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "screenshot" | "attachment" | "inline";
  category: "image" | "pdf" | "markdown" | "code" | "text" | "file";
  textContent?: string;
};
export type TransferConversation = {
  uuid: string;
  legacyKey?: string;
  title: string | null;
  createdAt: number;
  source: TransferSource | null;
  activeLeaf: string | null;
  messages: TransferMessage[];
};
export type ChatArchive = {
  format: "aidea-chat";
  version: 1 | 2;
  exportedAt: number;
  conversations: TransferConversation[];
};
export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const idPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid archive object / 记录结构无效");
  return value as Record<string, unknown>;
}
function str(value: unknown, max = 1_000_000): string {
  if (typeof value !== "string" || value.length > max)
    throw new Error("Invalid or oversized text / 文本无效或过长");
  return value;
}
function uuid(value: unknown): string {
  const id = str(value, 36);
  if (!idPattern.test(id)) throw new Error("Invalid UUID");
  return id;
}
function legacy(value: unknown): { legacyKey?: string } {
  if (value === undefined) return {};
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Invalid legacy identity");
  return { legacyKey: value };
}
function optionalId(value: unknown): string | null {
  return value === null ? null : uuid(value);
}
function time(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error("Invalid timestamp");
  return Number(value);
}
function citationPosition(c: Record<string, unknown>): {
  documentHash?: string;
  locator?: DocumentLocator;
} {
  if (c.documentHash === undefined && c.locator === undefined) return {};
  const hash = str(c.documentHash, 64);
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw new Error("Invalid document fingerprint");
  const p = record(c.locator);
  if (p.kind === "pdf-page")
    return {
      documentHash: hash,
      locator: {
        kind: p.kind,
        pageIndex: time(p.pageIndex),
        ...(p.pageLabel !== undefined
          ? { pageLabel: str(p.pageLabel, 200) }
          : {}),
      },
    };
  if (p.kind !== "epub-location") throw new Error("Invalid citation position");
  const cfi = p.cfi === undefined ? undefined : str(p.cfi, 4000);
  const href = p.href === undefined ? undefined : str(p.href, 4000);
  if (
    (!cfi && !href) ||
    (cfi && !/^epubcfi\(.+\)$/.test(cfi)) ||
    (href && (/^(?:[a-z]+:|[/\\])/i.test(href) || href.includes("\\")))
  )
    throw new Error("Invalid EPUB position");
  return {
    documentHash: hash,
    locator: {
      kind: p.kind,
      ...(cfi ? { cfi } : {}),
      ...(href ? { href } : {}),
      ...(p.locationLabel !== undefined
        ? { locationLabel: str(p.locationLabel, 1000) }
        : {}),
    },
  };
}
function list(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error("Invalid or oversized list / 记录数量超限");
  return value;
}
function source(value: unknown): TransferSource {
  const r = record(value);
  const key = str(r.key, 64);
  if (!/^[A-Z0-9]*$/.test(key)) throw new Error("Invalid item key");
  const library = r.library === null ? null : str(r.library, 80);
  if (library !== null && !/^(user|group):[0-9]+$/.test(library))
    throw new Error("Invalid library identity");
  return {
    key,
    library,
    title: str(r.title, 4000),
    ...(r.parentKey ? { parentKey: str(r.parentKey, 64) } : {}),
    ...(r.kind === "pdf" || r.kind === "epub" ? { kind: r.kind } : {}),
  };
}

/** Also strips unknown fields instead of allowing arbitrary metadata into storage. */
export function parseChatArchive(input: string): ChatArchive {
  if (new TextEncoder().encode(input).length > MAX_ARCHIVE_BYTES)
    throw new Error("Archive exceeds 50 MiB / 导入文件超过 50 MiB");
  const root = record(JSON.parse(input));
  if (
    root.format !== "aidea-chat" ||
    (root.version !== 1 && root.version !== 2)
  )
    throw new Error("Unsupported chat archive version / 不支持的聊天文件版本");
  const conversationIds = new Set<string>();
  const messageIds = new Set<string>();
  let total = 0;
  const conversations = list(root.conversations, 5000).map((value) => {
    const r = record(value);
    const id = uuid(r.uuid);
    if (conversationIds.has(id)) throw new Error("Duplicate conversation UUID");
    conversationIds.add(id);
    const messages = list(r.messages, 100000).map((value): TransferMessage => {
      const m = record(value);
      const mid = uuid(m.uuid);
      if (messageIds.has(mid)) throw new Error("Duplicate message UUID");
      messageIds.add(mid);
      if (++total > 100000) throw new Error("Too many messages");
      if (m.role !== "user" && m.role !== "assistant")
        throw new Error("Invalid message role");
      return {
        uuid: mid,
        ...legacy(m.legacyKey),
        ...(m.originUuid ? { originUuid: uuid(m.originUuid) } : {}),
        parent: optionalId(m.parent),
        activeChild: optionalId(m.activeChild),
        role: m.role,
        text: str(m.text),
        timestamp: time(m.timestamp),
        model: m.model === null ? null : str(m.model, 1000),
        selectedTexts: list(m.selectedTexts, 1000).map((v) => str(v)),
        citations: list(m.citations, 1000).map((v) => {
          const c = record(v);
          const cid = str(c.id, 100);
          if (!/^[A-Za-z0-9_-]+$/.test(cid))
            throw new Error("Invalid citation ID");
          return {
            id: cid,
            text: str(c.text),
            source: source(c.source),
            ...citationPosition(c),
          };
        }),
        missingAttachments: list(m.missingAttachments, 1000).map((v) =>
          str(v, 1000),
        ),
        ...(root.version === 2
          ? {
              resources: list(m.resources, 1000).map(
                (value): TransferResource => {
                  const resource = record(value);
                  const hash = str(resource.hash, 64);
                  if (!/^[a-f0-9]{64}$/.test(hash))
                    throw new Error("Invalid resource hash");
                  const kind = resource.kind;
                  if (
                    kind !== "screenshot" &&
                    kind !== "attachment" &&
                    kind !== "inline"
                  )
                    throw new Error("Invalid resource kind");
                  const category = resource.category;
                  if (
                    category !== "image" &&
                    category !== "pdf" &&
                    category !== "markdown" &&
                    category !== "code" &&
                    category !== "text" &&
                    category !== "file"
                  )
                    throw new Error("Invalid attachment category");
                  const mimeType = str(resource.mimeType, 100);
                  if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(mimeType))
                    throw new Error("Invalid resource MIME type");
                  if (
                    kind !== "attachment" &&
                    !/^image\/(png|jpeg|gif|webp|bmp)$/i.test(mimeType)
                  )
                    throw new Error("Unsupported image type");
                  const name = str(resource.name, 1000);
                  if (
                    !name ||
                    /[\\/]/.test(name) ||
                    Array.from(name).some((ch) => ch.charCodeAt(0) < 32) ||
                    name === "." ||
                    name === ".."
                  )
                    throw new Error("Invalid resource name");
                  return {
                    index: time(resource.index),
                    hash,
                    name,
                    mimeType,
                    kind,
                    category,
                    size: time(resource.size),
                    ...(resource.textContent !== undefined
                      ? { textContent: str(resource.textContent) }
                      : {}),
                  };
                },
              ),
            }
          : {}),
      };
    });
    const byId = new Map(messages.map((m) => [m.uuid, m]));
    for (const m of messages) {
      if (m.parent && !byId.has(m.parent))
        throw new Error("Missing or cross-conversation parent");
      if (m.activeChild && byId.get(m.activeChild)?.parent !== m.uuid)
        throw new Error("Invalid active child");
      if (new Set(m.citations.map((c) => c.id)).size !== m.citations.length)
        throw new Error("Duplicate citation ID");
    }
    // Iterative traversal: malformed or very deep archives must not overflow the stack.
    const sorted = orderMessages(messages);
    const activeLeaf = optionalId(r.activeLeaf);
    if (activeLeaf && !byId.has(activeLeaf))
      throw new Error("Missing active leaf");
    return {
      uuid: id,
      ...legacy(r.legacyKey),
      title: r.title === null ? null : str(r.title, 4000),
      createdAt: time(r.createdAt),
      source: r.source === null ? null : source(r.source),
      activeLeaf,
      messages: sorted,
    };
  });
  return {
    format: "aidea-chat",
    version: root.version,
    exportedAt: time(root.exportedAt),
    conversations,
  };
}

export function orderMessages(messages: TransferMessage[]): TransferMessage[] {
  const children = new Map<string | null, TransferMessage[]>();
  for (const m of messages) {
    const siblings = children.get(m.parent) || [];
    siblings.push(m);
    children.set(m.parent, siblings);
  }
  const queue = [...(children.get(null) || [])];
  for (let i = 0; i < queue.length; i++) {
    for (const child of children.get(queue[i].uuid) || []) queue.push(child);
  }
  if (queue.length !== messages.length)
    throw new Error("Cyclic message tree / 消息关系存在循环");
  return queue;
}

/** Selection state is device-local for existing conversations, not message content. */
export function messageContent(m: TransferMessage): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, v]) => [key, canonical(v)]),
      );
    return value;
  };
  return JSON.stringify(
    canonical([
      m.role,
      m.text,
      m.timestamp,
      m.model,
      m.selectedTexts,
      m.citations.map(({ id, text, source }) => ({ id, text, source })),
      m.missingAttachments,
    ]),
  );
}
