import {
  ATTACHMENT_BLOBS_TABLE,
  extractManagedBlobHash,
  removeAttachmentFile,
  tryLockAttachmentBlob,
} from "../modules/contextPanel/attachmentStorage";
import { fileUrlToPath } from "./pathFileUrl";

export type AttachmentRefOwnerType = "conversation" | "note";

const ATTACHMENT_REFS_TABLE = "zotero_ai_attachment_refs";
const ATTACHMENT_REFS_BLOB_INDEX = "zotero_ai_attachment_refs_blob_idx";
export const ATTACHMENT_GC_MIN_AGE_MS = 24 * 60 * 60 * 1000;

let refStoreInitTask: Promise<void> | null = null;

function normalizeOwnerId(ownerId: number): number | null {
  if (!Number.isFinite(ownerId)) return null;
  const normalized = Math.floor(ownerId);
  return normalized > 0 ? normalized : null;
}

function normalizeHashes(hashes: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const raw of hashes) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(trimmed)) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

async function ensureAttachmentRefTables(): Promise<void> {
  if (!refStoreInitTask) {
    refStoreInitTask = (async () => {
      await Zotero.DB.queryAsync(
        `CREATE TABLE IF NOT EXISTS ${ATTACHMENT_BLOBS_TABLE} (
          hash TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          size_bytes INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )`,
      );
      await Zotero.DB.queryAsync(
        `CREATE TABLE IF NOT EXISTS ${ATTACHMENT_REFS_TABLE} (
          owner_type TEXT NOT NULL CHECK(owner_type IN ('conversation', 'note')),
          owner_id INTEGER NOT NULL,
          blob_hash TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY(owner_type, owner_id, blob_hash)
        )`,
      );
      await Zotero.DB.queryAsync(
        `CREATE INDEX IF NOT EXISTS ${ATTACHMENT_REFS_BLOB_INDEX}
         ON ${ATTACHMENT_REFS_TABLE} (blob_hash)`,
      );
    })();
  }
  await refStoreInitTask;
}

async function filterKnownBlobHashes(hashes: string[]): Promise<string[]> {
  if (!hashes.length) return [];
  const placeholders = hashes.map(() => "?").join(", ");
  const rows = (await Zotero.DB.queryAsync(
    `SELECT hash FROM ${ATTACHMENT_BLOBS_TABLE} WHERE hash IN (${placeholders})`,
    hashes,
  )) as Array<{ hash?: unknown }> | undefined;
  if (!rows?.length) return [];
  return normalizeHashes(
    rows
      .map((row) => (typeof row.hash === "string" ? row.hash : ""))
      .filter(Boolean),
  );
}

function extractManagedBlobHashesFromNoteHtml(noteHtml: string): string[] {
  if (!noteHtml.trim()) return [];
  const hashes = new Set<string>();
  const hrefPattern = /href\s*=\s*(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(noteHtml))) {
    const href = (match[2] || "").trim();
    if (!href) continue;
    const path = fileUrlToPath(href) || href;
    const hash = extractManagedBlobHash(path);
    if (!hash) continue;
    hashes.add(hash);
  }
  return Array.from(hashes);
}

export async function initAttachmentRefStore(): Promise<void> {
  await ensureAttachmentRefTables();
}

export async function replaceOwnerAttachmentRefs(
  ownerType: AttachmentRefOwnerType,
  ownerId: number,
  hashes: readonly string[],
  // Zotero transactions do not nest: a nested executeTransaction waits for
  // the outer one until it times out. Callers already inside a transaction
  // must say so.
  options?: { inTransaction?: boolean },
): Promise<void> {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  if (!normalizedOwnerId) return;
  await ensureAttachmentRefTables();
  const requestedHashes = normalizeHashes(hashes);
  const write = async () => {
    // GC may have claimed a blob while this owner was waiting for its turn.
    const normalizedHashes = await filterKnownBlobHashes(requestedHashes);
    await Zotero.DB.queryAsync(
      `DELETE FROM ${ATTACHMENT_REFS_TABLE}
       WHERE owner_type = ?
         AND owner_id = ?`,
      [ownerType, normalizedOwnerId],
    );
    if (!normalizedHashes.length) return;
    const now = Date.now();
    for (const hash of normalizedHashes) {
      await Zotero.DB.queryAsync(
        `INSERT OR REPLACE INTO ${ATTACHMENT_REFS_TABLE}
          (owner_type, owner_id, blob_hash, updated_at)
         VALUES (?, ?, ?, ?)`,
        [ownerType, normalizedOwnerId, hash, now],
      );
    }
  };
  if (options?.inTransaction) await write();
  else await Zotero.DB.executeTransaction(write);
}

export async function clearOwnerAttachmentRefs(
  ownerType: AttachmentRefOwnerType,
  ownerId: number,
): Promise<void> {
  const normalizedOwnerId = normalizeOwnerId(ownerId);
  if (!normalizedOwnerId) return;
  await ensureAttachmentRefTables();
  await Zotero.DB.queryAsync(
    `DELETE FROM ${ATTACHMENT_REFS_TABLE}
     WHERE owner_type = ?
       AND owner_id = ?`,
    [ownerType, normalizedOwnerId],
  );
}

export async function reconcileNoteAttachmentRefsFromNoteContent(): Promise<void> {
  await ensureAttachmentRefTables();
  const rows = (await Zotero.DB.queryAsync(
    `SELECT DISTINCT owner_id AS ownerId
     FROM ${ATTACHMENT_REFS_TABLE}
     WHERE owner_type = 'note'`,
  )) as Array<{ ownerId?: unknown }> | undefined;
  if (!rows?.length) return;

  for (const row of rows) {
    const ownerId = Number(row.ownerId);
    if (!Number.isFinite(ownerId) || ownerId <= 0) continue;
    let noteHtml: string | null;
    try {
      const note = await Zotero.Items.getAsync(ownerId);
      noteHtml = note && note.isNote() ? note.getNote() : null;
    } catch (_err) {
      // Unloaded or unreadable note data is not evidence of deletion. Keep
      // its refs so the following GC cannot delete a still-linked file.
      continue;
    }
    if (noteHtml === null) {
      await clearOwnerAttachmentRefs("note", ownerId);
      continue;
    }
    const hashes = extractManagedBlobHashesFromNoteHtml(noteHtml);
    await replaceOwnerAttachmentRefs("note", ownerId, hashes);
  }
}

function hasChatMessagesTable() {
  return Zotero.DB.valueQueryAsync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='zotero_ai_chat_messages'",
  );
}

/** Rebuild from every branch, including archives imported by older builds. */
export async function reconcileConversationAttachmentRefs(
  conversationKeys?: readonly number[],
  options?: { inTransaction?: boolean },
): Promise<void> {
  await ensureAttachmentRefTables();
  if (!(await hasChatMessagesTable())) return;
  const rows = (await Zotero.DB.queryAsync(
    "SELECT conversation_key, attachments_json FROM zotero_ai_chat_messages",
  )) as Array<{ conversation_key: number; attachments_json?: string }>;
  const wanted = conversationKeys ? new Set(conversationKeys) : undefined;
  const owners = new Map<number, Set<string>>();
  for (const key of conversationKeys || []) owners.set(key, new Set());
  for (const row of rows || []) {
    if (wanted && !wanted.has(row.conversation_key)) continue;
    let hashes = owners.get(row.conversation_key);
    if (!hashes) owners.set(row.conversation_key, (hashes = new Set()));
    // Fail closed: malformed metadata must never authorize file deletion.
    const attachments = JSON.parse(row.attachments_json || "[]");
    if (!Array.isArray(attachments))
      throw new Error("Invalid attachment metadata");
    for (const attachment of attachments) {
      const hash = extractManagedBlobHash(attachment?.storedPath);
      if (hash) hashes.add(hash);
    }
  }
  for (const [key, hashes] of owners)
    await replaceOwnerAttachmentRefs("conversation", key, [...hashes], options);
  if (!wanted) {
    // A full rebuild also drops refs owned by conversations that no longer
    // have any message (deleted, or wiped by "clear all history"); otherwise
    // their blobs stay referenced forever and are never collected.
    await Zotero.DB.queryAsync(
      `DELETE FROM ${ATTACHMENT_REFS_TABLE}
       WHERE owner_type = 'conversation'
         AND owner_id NOT IN (
           SELECT DISTINCT conversation_key FROM zotero_ai_chat_messages
         )`,
    );
  }
}

export async function collectAndDeleteUnreferencedBlobs(
  minAgeMs: number,
): Promise<void> {
  await ensureAttachmentRefTables();
  await reconcileConversationAttachmentRefs();
  const minAge = Number.isFinite(minAgeMs)
    ? Math.max(0, Math.floor(minAgeMs))
    : ATTACHMENT_GC_MIN_AGE_MS;
  const cutoff = Date.now() - minAge;
  const rows = (await Zotero.DB.queryAsync(
    `SELECT b.hash AS hash, b.path AS path, b.created_at AS created_at
     FROM ${ATTACHMENT_BLOBS_TABLE} b
     LEFT JOIN ${ATTACHMENT_REFS_TABLE} r
       ON r.blob_hash = b.hash
     WHERE r.blob_hash IS NULL
       AND b.created_at <= ?`,
    [cutoff],
  )) as Array<{ hash: string; path: string; created_at: number }> | undefined;
  if (!rows?.length) return;

  // Message saves and their ref-table sync are separate. A newly saved message
  // containing the hash (in its path or contentHash) vetoes the claim even in
  // that gap. Err on the side of retention for ambiguous attachment metadata.
  const messageGuard = (await hasChatMessagesTable())
    ? `AND NOT EXISTS (SELECT 1 FROM zotero_ai_chat_messages WHERE attachments_json LIKE ?)`
    : "";
  for (const { hash, path, created_at } of rows) {
    if (!/^[a-f0-9]{64}$/.test(hash) || extractManagedBlobHash(path) !== hash)
      continue;
    let release: (() => void) | undefined;
    try {
      // Import already owns a DB transaction when it persists bytes. Take
      // the transaction first and skip busy hashes rather than waiting for IO.
      const claimed = await Zotero.DB.executeTransaction(async () => {
        release = tryLockAttachmentBlob(hash);
        if (!release) return false;
        // Matching the selected timestamp revalidates the original age cutoff.
        return Zotero.DB.valueQueryAsync<string>(
          `DELETE FROM ${ATTACHMENT_BLOBS_TABLE}
           WHERE hash = ? AND path = ? AND created_at = ?
             AND NOT EXISTS (SELECT 1 FROM ${ATTACHMENT_REFS_TABLE} WHERE blob_hash = ?)
             ${messageGuard}
           RETURNING path`,
          [
            hash,
            path,
            created_at,
            hash,
            ...(messageGuard ? [`%${hash}%`] : []),
          ],
        );
      });
      // Never unlink on a failed/rolled-back claim. Keep only the hash locked
      // until the old file is gone: a re-upload can then safely reuse its path.
      if (claimed === path) await removeAttachmentFile(path);
    } finally {
      release?.();
    }
  }
}
