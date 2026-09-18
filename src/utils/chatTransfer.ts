import {
  initAttachmentRefStore,
  reconcileConversationAttachmentRefs,
} from "./attachmentRefStore";
import {
  type ChatArchive,
  type TransferConversation,
  type TransferMessage,
  type TransferSource,
  messageContent,
  parseChatArchive,
} from "./chatTransferFormat";
import {
  collectMessageResources,
  restoreMessageResources,
  validateBundle,
  resourceIdentity,
  resourceHash,
  type ResourceBlobs,
} from "./chatTransferAssets";
import { documentFingerprint } from "./documentFingerprint";
import { getAttachmentSourceRevision } from "../modules/contextPanel/document/adapters/shared";

const M = "zotero_ai_chat_messages";
const G = "zotero_ai_global_conversations";
const P = "zotero_ai_paper_conversations";
const T = "zotero_ai_chat_tree_state";
const S = "zotero_ai_transfer_sources";
const randomID =
  "lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))";
type Row = Record<string, any>;
async function rows(sql: string, args: any[] = []): Promise<Row[]> {
  return (await Zotero.DB.queryAsync(sql, args)) || [];
}
async function scalar(sql: string, args: any[] = []): Promise<any> {
  return Zotero.DB.valueQueryAsync(sql, args);
}
function json(value: unknown, fallback: any = null): any {
  try {
    return typeof value === "string" ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function backupChatData(data: Record<string, Row[]>): Promise<void> {
  const directory = PathUtils.join(
    Zotero.DataDirectory.dir,
    "aidea-chat-backups",
  );
  await IOUtils.makeDirectory(directory, { ignoreExisting: true });
  const path = PathUtils.join(directory, `before-uuid-${Date.now()}.json`);
  const text = JSON.stringify({
    format: "aidea-local-chat-backup",
    version: 1,
    tables: data,
  });
  await IOUtils.writeUTF8(path, text, { tmpPath: `${path}.tmp` });
  if ((await IOUtils.readUTF8(path)) !== text)
    throw new Error("Chat backup verification failed");
}

/** Additive migration. Failure leaves legacy chat usable; callers disable transfer. */
export async function ensureChatTransferSchema(
  backup: (data: Record<string, Row[]>) => Promise<void> = backupChatData,
): Promise<void> {
  await Zotero.DB.executeTransaction(async () => {
    const tables = [M, G, P];
    const missing: string[] = [];
    const legacyUpgrade = new Set<string>();
    for (const table of tables) {
      const columns = await rows(`PRAGMA table_info(${table})`);
      if (!columns.length) throw new Error("Chat store is not initialized");
      if (!columns.some((c) => c.name === "legacy_key"))
        legacyUpgrade.add(table);
      if (
        !columns.some((c) => c.name === "uuid") ||
        Number(
          await scalar(
            `SELECT COUNT(*) FROM ${table} WHERE uuid IS NULL OR uuid = ''`,
          ),
        )
      )
        missing.push(table);
    }
    const orphans =
      await rows(`SELECT conversation_key, MIN(timestamp) AS created_at FROM ${M}
      WHERE conversation_key NOT IN (SELECT conversation_key FROM ${G})
      AND conversation_key NOT IN (SELECT conversation_key FROM ${P}) GROUP BY conversation_key`);
    if (missing.length || orphans.length || legacyUpgrade.size) {
      const snapshot: Record<string, Row[]> = {};
      for (const table of [...tables, T]) {
        const columns = (await rows(`PRAGMA table_info(${table})`)).map(
          (c) => c.name,
        );
        // Zotero returns mozStorage proxies: JSON.stringify(row) probes a missing
        // toJSON column. Materialize only actual schema columns before backup.
        snapshot[table] = (await rows(`SELECT * FROM ${table}`)).map((row) =>
          Object.fromEntries(columns.map((column) => [column, row[column]])),
        );
      }
      await backup(snapshot); // Must succeed before changing legacy rows.
    }
    for (const table of tables) {
      const columns = await rows(`PRAGMA table_info(${table})`);
      if (!columns.some((c) => c.name === "uuid"))
        await Zotero.DB.queryAsync(`ALTER TABLE ${table} ADD COLUMN uuid TEXT`);
      if (legacyUpgrade.has(table))
        await Zotero.DB.queryAsync(
          `ALTER TABLE ${table} ADD COLUMN legacy_key TEXT`,
        );
      await Zotero.DB.queryAsync(
        `UPDATE ${table} SET uuid = ${randomID} WHERE uuid IS NULL OR uuid = ''`,
      );
      await Zotero.DB.queryAsync(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_uuid ON ${table}(uuid)`,
      );
      const key = table === M ? "id" : "conversation_key";
      // Triggers cover existing write paths and records created by a downgraded plugin.
      await Zotero.DB
        .queryAsync(`CREATE TRIGGER IF NOT EXISTS ${table}_assign_uuid
        AFTER INSERT ON ${table} WHEN NEW.uuid IS NULL OR NEW.uuid = ''
        BEGIN UPDATE ${table} SET uuid = ${randomID} WHERE ${key} = NEW.${key}; END`);
    }
    for (const orphan of orphans) {
      // Earlier versions used the Zotero item ID directly as the conversation key.
      const item =
        orphan.conversation_key < 1000000000
          ? Zotero.Items.get(orphan.conversation_key)
          : null;
      if (item)
        await Zotero.DB.queryAsync(
          `INSERT INTO ${P} (conversation_key,parent_item_id,created_at,title) VALUES (?,?,?,?)`,
          [
            orphan.conversation_key,
            item.id,
            orphan.created_at,
            "Recovered legacy conversation / 旧版会话",
          ],
        );
      else
        await Zotero.DB.queryAsync(
          `INSERT INTO ${G} (conversation_key,library_id,created_at,title) VALUES (?,?,?,?)`,
          [
            orphan.conversation_key,
            Zotero.Libraries.userLibraryID,
            orphan.created_at,
            "Recovered legacy conversation / 旧版会话",
          ],
        );
    }
    // This frozen, versioned identity is only assigned to pre-transfer records.
    // Copies of a legacy database retain numeric IDs and creation timestamps.
    // Text/title are excluded so edits become conflicts, not unrelated chats.
    if (legacyUpgrade.size || orphans.length) {
      const hash = (parts: unknown[]) =>
        resourceHash(new TextEncoder().encode(JSON.stringify(parts)));
      for (const table of [G, P]) {
        const conversations = await rows(
          `SELECT * FROM ${table} WHERE legacy_key IS NULL`,
        );
        for (const conversation of conversations) {
          const key = conversation.conversation_key;
          if (
            !legacyUpgrade.has(table) &&
            !orphans.some((o) => o.conversation_key === key)
          )
            continue;
          const messages = await rows(
            `SELECT id,timestamp,role FROM ${M} WHERE conversation_key=? ORDER BY id`,
            [key],
          );
          const first = messages[0];
          // Empty conversations have no evidence of shared history.
          if (
            !first ||
            !Number.isSafeInteger(conversation.created_at) ||
            conversation.created_at <= 0 ||
            !Number.isSafeInteger(first.timestamp) ||
            first.timestamp <= 0
          )
            continue;
          const source =
            table === P ? Zotero.Items.get(conversation.parent_item_id) : null;
          const identity = await hash([
            "aidea-legacy-conversation-v1",
            table,
            key,
            conversation.created_at,
            source ? source.key : null,
            first.id,
            first.timestamp,
          ]);
          await Zotero.DB.queryAsync(
            `UPDATE ${table} SET legacy_key=? WHERE conversation_key=?`,
            [identity, key],
          );
          for (const message of messages) {
            const messageIdentity = await hash([
              "aidea-legacy-message-v1",
              identity,
              message.id,
              message.timestamp,
              message.role,
            ]);
            await Zotero.DB.queryAsync(
              `UPDATE ${M} SET legacy_key=? WHERE id=? AND legacy_key IS NULL`,
              [messageIdentity, message.id],
            );
          }
        }
        await Zotero.DB.queryAsync(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${table}_legacy_key ON ${table}(legacy_key)`,
        );
      }
    }
    const columns = await rows(`PRAGMA table_info(${M})`);
    for (const name of ["origin_uuid", "transfer_data"]) {
      if (!columns.some((c) => c.name === name))
        await Zotero.DB.queryAsync(`ALTER TABLE ${M} ADD COLUMN ${name} TEXT`);
    }
    await Zotero.DB.queryAsync(`CREATE TABLE IF NOT EXISTS ${S}
      (conversation_key INTEGER PRIMARY KEY, source_json TEXT NOT NULL)`);
  });
}

// Imported sessions retain their key when a delayed source becomes available.
const reboundPaperKeys = new Set<number>();
export function isGlobalChatKey(key: number): boolean {
  return key >= 2_000_000_000 && !reboundPaperKeys.has(key);
}

/** Identity-only association; never match titles or invent a new conversation. */
export async function reconcileTransferredConversations(): Promise<void> {
  const exists = await Zotero.DB.valueQueryAsync(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${S}'`,
  );
  if (!exists) return;
  const bound = await Zotero.DB.executeTransaction(async () => {
    const pending = await rows(`SELECT g.*, s.source_json FROM ${G} g
      JOIN ${S} s ON s.conversation_key=g.conversation_key`);
    const paperColumns = await rows(`PRAGMA table_info(${P})`);
    const hasPinned = paperColumns.some((c) => c.name === "is_pinned");
    for (const c of pending) {
      const item = await resolveSource(json(c.source_json, null), c.library_id);
      if (!item) continue;
      const title = String(c.title || "").replace(
        /^\[Source pending \/ 文献待关联\] /,
        "",
      );
      await Zotero.DB.queryAsync(
        `INSERT INTO ${P} (conversation_key,parent_item_id,created_at,title,uuid,legacy_key${hasPinned ? ",is_pinned" : ""}) VALUES (?,?,?,?,?,?${hasPinned ? ",?" : ""})`,
        [
          c.conversation_key,
          item.id,
          c.created_at,
          title,
          c.uuid,
          c.legacy_key ?? null,
          ...(hasPinned ? [c.is_pinned || 0] : []),
        ],
      );
      await Zotero.DB.queryAsync(`DELETE FROM ${G} WHERE conversation_key=?`, [
        c.conversation_key,
      ]);
    }
    return rows(
      `SELECT conversation_key FROM ${P} WHERE conversation_key>=2000000000`,
    );
  });
  reboundPaperKeys.clear();
  for (const c of bound) reboundPaperKeys.add(c.conversation_key);
}

function libraryIdentity(id: number): string | null {
  const library = Zotero.Libraries.get(id);
  if (library && library.libraryType === "group") {
    const group = Zotero.Groups.getByLibraryID(id);
    return group ? `group:${group.id}` : null;
  }
  const user = Zotero.Users.getCurrentUserID();
  return user ? `user:${user}` : null;
}
export function transferSource(
  item: Zotero.Item | false | null | undefined,
): TransferSource | null {
  if (!item) return null;
  const type = item.isAttachment() ? item.attachmentContentType : "";
  return {
    library: libraryIdentity(item.libraryID),
    key: item.key,
    title: String(item.getField("title") || "Untitled source"),
    ...(item.parentKey ? { parentKey: item.parentKey } : {}),
    ...(type === "application/pdf"
      ? { kind: "pdf" as const }
      : type === "application/epub+zip"
        ? { kind: "epub" as const }
        : {}),
  };
}
async function resolveSource(
  source: TransferSource | null,
  libraryID: number,
): Promise<Zotero.Item | null> {
  if (
    !source?.library ||
    !source.key ||
    source.library !== libraryIdentity(libraryID)
  )
    return null;
  const item = await Zotero.Items.getByLibraryAndKeyAsync(
    libraryID,
    source.key,
  );
  return item && !item.deleted ? item : null;
}
function localMessage(row: Row, idMap: Map<number, string>): TransferMessage {
  const saved = json(row.transfer_data, {});
  const refs = json(row.context_refs_json, {});
  const citations =
    saved.citations ||
    (refs.citations || []).map((ref: Row) => {
      const source = transferSource(Zotero.Items.get(ref.itemId)) || {
        library: null,
        key: "",
        title: String(ref.title || "Unavailable source"),
      };
      return { id: ref.id, text: ref.text || "", source };
    });
  const attachments = json(row.attachments_json, []);
  const names = attachments.map((a: Row) => String(a.name || "Attachment"));
  const images = json(row.screenshot_images, []);
  if (images.length) names.push(`${images.length} image(s)`);
  return {
    uuid: row.uuid,
    ...(row.legacy_key ? { legacyKey: row.legacy_key } : {}),
    ...(row.origin_uuid ? { originUuid: row.origin_uuid } : {}),
    parent:
      row.parent_id == null ? null : idMap.get(row.parent_id) || "missing",
    activeChild:
      row.active_child_id == null
        ? null
        : idMap.get(row.active_child_id) || "missing",
    role: row.role,
    text: String(row.text).replace(
      /!\[[^\]]*\]\(data:image\/[^)]+\)/g,
      "[Image not included / 图片未包含]",
    ),
    timestamp: row.timestamp,
    model: row.model_name || null,
    selectedTexts: json(
      row.selected_texts_json,
      row.selected_text ? [row.selected_text] : [],
    ),
    citations,
    missingAttachments: saved.missingAttachments || names,
    ...(saved.resources ? { resources: saved.resources } : {}),
  };
}
export type ExportScope = {
  libraryID: number;
  conversationKey?: number;
  paperItemID?: number;
};
export async function exportChatArchive(
  scope: ExportScope,
  blobs?: ResourceBlobs,
): Promise<ChatArchive> {
  await ensureChatTransferSchema();
  return Zotero.DB.executeTransaction(async () => {
    const conversations: TransferConversation[] = [];
    const fingerprints = new Map<number, Promise<string | undefined>>();
    const all = [
      ...(await rows(`SELECT *, 'global' AS kind FROM ${G}`)),
      ...(await rows(`SELECT *, 'paper' AS kind FROM ${P}`)),
    ];
    for (const c of all) {
      const item =
        c.kind === "paper" ? Zotero.Items.get(c.parent_item_id) : null;
      // A permanently deleted item no longer tells us its library. Keep these
      // otherwise unreachable chats in the personal-library backup scope.
      const libraryID =
        c.kind === "global"
          ? c.library_id
          : item
            ? item.libraryID
            : Zotero.Libraries.userLibraryID;
      if (libraryID !== scope.libraryID) continue;
      if (
        scope.conversationKey !== undefined &&
        c.conversation_key !== scope.conversationKey
      )
        continue;
      if (scope.paperItemID !== undefined) {
        const target = Zotero.Items.get(scope.paperItemID);
        const parent = item && (item.parentID || item.id);
        if (!target || parent !== (target.parentID || target.id)) continue;
      }
      const messages = await rows(
        `SELECT * FROM ${M} WHERE conversation_key = ? ORDER BY branch_index, id`,
        [c.conversation_key],
      );
      const ids = new Map(messages.map((m) => [m.id, m.uuid]));
      const leaf = await scalar(
        `SELECT active_leaf_id FROM ${T} WHERE conversation_key = ?`,
        [c.conversation_key],
      );
      const saved = await scalar(
        `SELECT source_json FROM ${S} WHERE conversation_key = ?`,
        [c.conversation_key],
      );
      const portableMessages = [];
      for (const row of messages) {
        const message = localMessage(row, ids);
        const originalRefs = json(row.context_refs_json, {}).citations || [];
        for (const citation of message.citations) {
          if (citation.documentHash) continue;
          const ref = originalRefs.find((r: Row) => r.id === citation.id);
          if (
            !ref?.locator ||
            (citation.source.kind !== "pdf" && citation.source.kind !== "epub")
          )
            continue;
          const source = Zotero.Items.get(ref.itemId);
          if (
            !source ||
            !ref.sourceRevision ||
            ref.sourceRevision !== (await getAttachmentSourceRevision(source))
          )
            continue;
          if (!fingerprints.has(source.id))
            fingerprints.set(source.id, documentFingerprint(source));
          const hash = await fingerprints.get(source.id);
          if (hash) {
            citation.documentHash = hash;
            citation.locator = ref.locator;
          }
        }
        if (blobs)
          message.resources = await collectMessageResources(
            row,
            message,
            blobs,
          );
        portableMessages.push(message);
      }
      conversations.push({
        uuid: c.uuid,
        ...(c.legacy_key ? { legacyKey: c.legacy_key } : {}),
        title: c.title || null,
        createdAt: c.created_at,
        source:
          json(saved) ||
          transferSource(item) ||
          (c.kind === "paper"
            ? { library: null, key: "", title: c.title || "Unavailable source" }
            : null),
        activeLeaf: ids.get(leaf) || null,
        messages: portableMessages,
      });
    }
    // The writer validates its own archive: broken local trees are never silently truncated.
    return parseChatArchive(
      JSON.stringify({
        format: "aidea-chat",
        version: blobs ? 2 : 1,
        exportedAt: Date.now(),
        conversations,
      }),
    );
  });
}

export type ImportResult = {
  conversations: number;
  messages: number;
  duplicates: number;
  conflicts: number;
  unresolved: number;
  titleConflicts: number;
  conversationKeys: number[];
};
type Action = { sql: string; args: any[] };

async function planImport(
  archive: ChatArchive,
  libraryID: number,
): Promise<{
  result: ImportResult;
  actions: Action[];
  resourceRows: {
    id: number;
    message: import("./chatTransferFormat").TransferMessage;
  }[];
}> {
  const result: ImportResult = {
    conversations: 0,
    messages: 0,
    duplicates: 0,
    conflicts: 0,
    unresolved: 0,
    titleConflicts: 0,
    conversationKeys: [],
  };
  const actions: Action[] = [];
  const add = (sql: string, args: any[]) => actions.push({ sql, args });
  let nextMessage =
    Number(await scalar(`SELECT COALESCE(MAX(id), 0) FROM ${M}`)) + 1;
  let nextGlobal = Math.max(
    2000000000,
    Number(
      await scalar(
        `SELECT COALESCE(MAX(conversation_key), 0) FROM (SELECT conversation_key FROM ${G} UNION ALL SELECT conversation_key FROM ${P})`,
      ),
    ) + 1,
  );
  let nextPaper = Math.max(
    1000000000,
    Number(
      await scalar(
        `SELECT COALESCE(MAX(conversation_key), 0) FROM ${P} WHERE conversation_key < 2000000000`,
      ),
    ) + 1,
  );
  const occupied = new Set(
    (await rows(`SELECT uuid FROM ${M}`)).map((m) => m.uuid),
  );
  const resourceRows: {
    id: number;
    message: import("./chatTransferFormat").TransferMessage;
  }[] = [];
  for (const c of archive.conversations) {
    // Zotero rewrites `column = ?` with null to `column IS NULL`.
    // Omit the legacy predicate entirely for records born with UUIDs.
    const identityWhere = c.legacyKey
      ? "uuid = ? OR legacy_key = ?"
      : "uuid = ?";
    const identityArgs = c.legacyKey ? [c.uuid, c.legacyKey] : [c.uuid];
    const matches = [
      ...(await rows(
        `SELECT *, 'global' AS kind FROM ${G} WHERE ${identityWhere}`,
        identityArgs,
      )),
      ...(await rows(
        `SELECT *, 'paper' AS kind FROM ${P} WHERE ${identityWhere}`,
        identityArgs,
      )),
    ];
    if (matches.length > 1)
      throw new Error("Ambiguous local conversation UUID");
    const existing = matches[0];
    const sourceItem = await resolveSource(c.source, libraryID);
    if (c.source && !sourceItem && (!existing || existing.kind !== "paper"))
      result.unresolved++;
    if (existing) {
      const existingLibrary =
        existing.kind === "global"
          ? existing.library_id
          : (
              Zotero.Items.get(existing.parent_item_id) || {
                libraryID: Zotero.Libraries.userLibraryID,
              }
            ).libraryID;
      if (existingLibrary !== libraryID)
        throw new Error(
          "Conversation belongs to another library / 会话属于其他文库",
        );
      if (existing.title && c.title && existing.title !== c.title)
        result.titleConflicts++;
    }
    const key =
      existing?.conversation_key || (sourceItem ? nextPaper++ : nextGlobal++);
    result.conversationKeys.push(key);
    if (!existing) {
      result.conversations++;
      if (sourceItem)
        add(
          `INSERT INTO ${P} (conversation_key,parent_item_id,created_at,title,uuid) VALUES (?,?,?,?,?)`,
          [key, sourceItem.id, c.createdAt, c.title, c.uuid],
        );
      else
        add(
          `INSERT INTO ${G} (conversation_key,library_id,created_at,title,uuid) VALUES (?,?,?,?,?)`,
          [
            key,
            libraryID,
            c.createdAt,
            c.source
              ? `[Source pending / 文献待关联] ${c.title || c.source.title}`
              : c.title,
            c.uuid,
          ],
        );
      if (c.source)
        add(`INSERT INTO ${S} (conversation_key,source_json) VALUES (?,?)`, [
          key,
          JSON.stringify(c.source),
        ]);
      if (c.legacyKey)
        add(
          `UPDATE ${sourceItem ? P : G} SET legacy_key=? WHERE conversation_key=?`,
          [c.legacyKey, key],
        );
    }
    const local = existing
      ? await rows(
          `SELECT * FROM ${M} WHERE conversation_key = ? ORDER BY id`,
          [key],
        )
      : [];
    const localIds = new Map(local.map((m) => [m.id, m.uuid]));
    const mapped = new Map<string, number>();
    const parentById = new Map<number, number | null>(
      local.map((m) => [m.id, m.parent_id]),
    );
    const activeById = new Map<number, number | null>(
      local.map((m) => [m.id, m.active_child_id]),
    );
    const byUUID = new Map(local.map((m) => [m.uuid, m]));
    const byOrigin = new Map<string, Row[]>();
    const nextBranch = new Map<number | null, number>();
    for (const row of local) {
      const origin = row.legacy_key || row.origin_uuid || row.uuid;
      const variants = byOrigin.get(origin) || [];
      variants.push(row);
      byOrigin.set(origin, variants);
      const parent = row.parent_id || null;
      nextBranch.set(
        parent,
        Math.max(
          nextBranch.get(parent) || 0,
          Number(row.branch_index || 0) + 1,
        ),
      );
    }
    for (const m of c.messages) {
      const parent = m.parent ? mapped.get(m.parent) : null;
      if (m.parent && !parent) throw new Error("Parent mapping failed");
      const origin = m.legacyKey || m.originUuid || m.uuid;
      const exact = byUUID.get(m.uuid);
      const candidates = byOrigin.get(origin) || [];
      const content = messageContent(m);
      const matching = (exact ? [exact, ...candidates] : candidates).filter(
        (v) =>
          (v.parent_id || null) === (parent || null) &&
          messageContent(localMessage(v, localIds)) === content,
      );
      let same: Row | undefined;
      for (const candidate of matching) {
        if (m.resources?.length) {
          const savedResources = json(candidate.transfer_data, {}).resources;
          const existingResources =
            savedResources ||
            (await collectMessageResources(
              candidate,
              localMessage(candidate, localIds),
              new Map(),
            ));
          // A previous text-only import can be enriched; conflicting real assets form a branch.
          if (
            existingResources.length &&
            resourceIdentity(existingResources) !==
              resourceIdentity(m.resources)
          )
            continue;
        }
        same = candidate;
        break;
      }
      if (same) {
        mapped.set(m.uuid, same.id);
        result.duplicates++;
        if (m.resources?.length || m.citations.length)
          resourceRows.push({ id: same.id, message: m });
        continue;
      }
      // UUIDs cannot silently connect messages across unrelated conversations.
      if (!exact && occupied.has(m.uuid))
        throw new Error("Message UUID belongs to another conversation");
      const conflict = Boolean(exact || candidates.length);
      if (conflict) result.conflicts++;
      const id = nextMessage++;
      const assignedUUID = exact
        ? String(await scalar(`SELECT ${randomID}`))
        : m.uuid;
      const citations = [];
      for (const citation of m.citations) {
        const item = await resolveSource(citation.source, libraryID);
        citations.push({
          id: citation.id,
          text: citation.text,
          title: citation.source.title,
          itemId: item?.id || 0,
          ...(citation.documentHash
            ? { documentHash: citation.documentHash, locator: citation.locator }
            : {}),
          ...(item
            ? {
                itemKey: item.key,
                libraryId: item.libraryID,
                kind: citation.source.kind,
              }
            : {}),
        });
      }
      const refs = JSON.stringify({
        citations,
        unavailableAttachments: m.missingAttachments,
      });
      const data = JSON.stringify({
        citations: m.citations,
        missingAttachments: m.missingAttachments,
        ...(m.resources ? { resources: m.resources } : {}),
      });
      const branchIndex = nextBranch.get(parent || null) || 0;
      nextBranch.set(parent || null, branchIndex + 1);
      add(
        `INSERT INTO ${M} (id,uuid,origin_uuid,conversation_key,parent_id,active_child_id,branch_index,role,text,timestamp,model_name,selected_texts_json,context_refs_json,transfer_data)
        VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,?,?)`,
        [
          id,
          assignedUUID,
          m.originUuid || (conflict ? m.uuid : null),
          key,
          parent || null,
          branchIndex,
          m.role,
          m.text,
          m.timestamp,
          m.model,
          JSON.stringify(m.selectedTexts),
          refs,
          data,
        ],
      );
      if (m.legacyKey)
        add(`UPDATE ${M} SET legacy_key=? WHERE id=?`, [m.legacyKey, id]);
      mapped.set(m.uuid, id);
      parentById.set(id, parent || null);
      activeById.set(id, null);
      localIds.set(id, assignedUUID);
      const added = {
        id,
        uuid: assignedUUID,
        origin_uuid: m.originUuid || (conflict ? m.uuid : null),
        legacy_key: m.legacyKey || null,
        parent_id: parent || null,
        active_child_id: null,
        role: m.role,
        text: m.text,
        timestamp: m.timestamp,
        model_name: m.model,
        selected_texts_json: JSON.stringify(m.selectedTexts),
        transfer_data: data,
      };
      byUUID.set(assignedUUID, added);
      const variants = byOrigin.get(origin) || [];
      variants.push(added);
      byOrigin.set(origin, variants);
      occupied.add(assignedUUID);
      result.messages++;
      if (m.resources?.length || m.citations.length)
        resourceRows.push({ id, message: m });
    }
    // Preserve every existing active edge. Fill only absent selections.
    for (const m of c.messages) {
      const id = mapped.get(m.uuid)!;
      const child = m.activeChild ? mapped.get(m.activeChild) : null;
      if (child && !activeById.get(id)) {
        add(
          `UPDATE ${M} SET active_child_id = ? WHERE id = ? AND active_child_id IS NULL`,
          [child, id],
        );
        activeById.set(id, child);
      }
    }
    const state =
      existing &&
      (await scalar(
        `SELECT active_leaf_id FROM ${T} WHERE conversation_key = ?`,
        [key],
      ));
    if (!state) {
      const leaf = c.activeLeaf
        ? mapped.get(c.activeLeaf)
        : mapped.get(c.messages[c.messages.length - 1]?.uuid);
      if (leaf) {
        let root = leaf;
        while (parentById.get(root)) root = parentById.get(root)!;
        add(
          `INSERT OR REPLACE INTO ${T} (conversation_key,active_root_id,active_leaf_id) VALUES (?,?,?)`,
          [key, root, leaf],
        );
      }
    }
  }
  return { result, actions, resourceRows };
}

/** Preview performs only reads. Apply recalculates under a transaction; no stale plan. */
export async function importChatArchive(
  input: string,
  libraryID: number,
  preview = true,
  blobs?: ResourceBlobs,
): Promise<ImportResult> {
  if (!Number.isSafeInteger(libraryID) || libraryID <= 0)
    throw new Error("Invalid target library");
  const archive = parseChatArchive(input);
  if (archive.version === 2)
    await validateBundle({ archive, blobs: blobs || new Map() });
  await ensureChatTransferSchema();
  await initAttachmentRefStore();
  return Zotero.DB.executeTransaction(async () => {
    const { result, actions, resourceRows } = await planImport(
      archive,
      libraryID,
    );
    if (!preview) {
      for (const action of actions)
        await Zotero.DB.queryAsync(action.sql, action.args);
      for (const { id, message } of resourceRows) {
        const restored = message.resources?.length
          ? await restoreMessageResources(message, blobs!)
          : undefined;
        const record = (
          await rows(
            `SELECT context_refs_json, transfer_data FROM ${M} WHERE id = ?`,
            [id],
          )
        )[0];
        const refs = {
          ...json(record.context_refs_json, {}),
          ...(restored ? { unavailableAttachments: restored.missing } : {}),
        };
        // Reimporting an older archive may fill files, but must not erase newer
        // portable positions already attached to this same answer.
        const effectiveCitations = message.citations.map((c) => {
          const previous = refs.citations?.find((r: Row) => r.id === c.id);
          return !c.documentHash && previous?.documentHash && previous.locator
            ? {
                ...c,
                documentHash: previous.documentHash,
                locator: previous.locator,
              }
            : c;
        });
        if (effectiveCitations.length) {
          refs.citations = await Promise.all(
            effectiveCitations.map(async (c) => {
              const previous = refs.citations?.find((r: Row) => r.id === c.id);
              let item = await resolveSource(c.source, libraryID);
              // A local round trip without a Zotero account must not erase an
              // already resolved source on the existing message.
              if (!item) {
                const localItem = previous?.itemId
                  ? Zotero.Items.get(previous.itemId)
                  : null;
                if (
                  localItem &&
                  !localItem.deleted &&
                  localItem.key === c.source.key &&
                  localItem.libraryID === libraryID
                )
                  item = localItem;
              }
              return {
                id: c.id,
                text: c.text,
                title: c.source.title,
                itemId: item?.id || 0,
                itemKey:
                  item?.key ||
                  (c.source.library &&
                  c.source.library === libraryIdentity(libraryID)
                    ? c.source.key
                    : undefined),
                libraryId:
                  item?.libraryID ||
                  (c.source.library &&
                  c.source.library === libraryIdentity(libraryID)
                    ? libraryID
                    : undefined),
                kind: c.source.kind,
                // Enrich source-only archives without erasing a local answer's
                // still-bound native position. Never copy it to another item.
                ...(!c.documentHash && item && previous?.itemId === item.id
                  ? {
                      sourceRevision: previous.sourceRevision,
                      locator: previous.locator,
                    }
                  : {}),
                ...(c.documentHash
                  ? { documentHash: c.documentHash, locator: c.locator }
                  : {}),
                ...(c.source.library?.startsWith("group:")
                  ? {
                      libraryType: "group",
                      groupId: Number(c.source.library.slice(6)),
                    }
                  : {}),
              };
            }),
          );
        }
        const data = {
          ...json(record.transfer_data, {}),
          citations: effectiveCitations,
          missingAttachments: message.missingAttachments,
          ...(restored ? { resources: message.resources } : {}),
        };
        if (!restored) {
          await Zotero.DB.queryAsync(
            `UPDATE ${M} SET context_refs_json=?, transfer_data=? WHERE id=?`,
            [JSON.stringify(refs), JSON.stringify(data), id],
          );
          continue;
        }
        await Zotero.DB.queryAsync(
          `UPDATE ${M} SET text=?, screenshot_images=?, attachments_json=?, context_refs_json=?, transfer_data=? WHERE id=?`,
          [
            restored.text,
            JSON.stringify(restored.screenshots),
            JSON.stringify(restored.attachments),
            JSON.stringify(refs),
            JSON.stringify(data),
            id,
          ],
        );
      }
      await reconcileConversationAttachmentRefs(result.conversationKeys);
    }
    return result;
  });
}
