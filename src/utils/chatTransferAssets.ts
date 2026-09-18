import { zipSync, unzipSync } from "fflate";
import { persistAttachmentBlob } from "../modules/contextPanel/attachmentStorage";
import {
  type ChatArchive,
  type TransferMessage,
  type TransferResource,
  MAX_ARCHIVE_BYTES,
  parseChatArchive,
} from "./chatTransferFormat";

export const MAX_BUNDLE_BYTES = 128 * 1024 * 1024;
export const MAX_RESOURCE_BYTES = 32 * 1024 * 1024;
export type ResourceBlobs = Map<string, Uint8Array>;
export type ChatBundle = { archive: ChatArchive; blobs: ResourceBlobs };
export function resourceIdentity(refs: TransferResource[]): string {
  return JSON.stringify(
    refs
      .map((r) => [
        r.kind,
        r.index,
        r.hash,
        r.name,
        r.mimeType,
        r.category,
        r.size,
        r.textContent || "",
      ])
      .sort(
        (a, b) =>
          String(a[0]).localeCompare(String(b[0])) ||
          Number(a[1]) - Number(b[1]),
      ),
  );
}
const placeholder = "[Image not included / 图片未包含]";
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export async function resourceHash(bytes: Uint8Array): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new Uint8Array(bytes).buffer,
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
function parse(value: unknown, fallback: any): any {
  try {
    return typeof value === "string" ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
function dataBytes(url: string): { bytes: Uint8Array; mime: string } {
  const match =
    /^data:(image\/(?:png|jpeg|gif|webp|bmp));base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(
      url,
    );
  if (!match) throw new Error("Unsupported image data");
  if (match[2].length > MAX_RESOURCE_BYTES * 1.4)
    throw new Error("Image exceeds 32 MiB");
  const binary = atob(match[2]);
  return {
    bytes: Uint8Array.from(binary, (ch) => ch.charCodeAt(0)),
    mime: match[1].toLowerCase(),
  };
}
function dataURL(bytes: Uint8Array, mime: string): string {
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 32768)
    parts.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
  return `data:${mime};base64,${btoa(parts.join(""))}`;
}

/** Only reads resources explicitly attached to a message, never Zotero paper files. */
export async function collectMessageResources(
  row: Record<string, any>,
  _message: TransferMessage,
  blobs: ResourceBlobs,
): Promise<TransferResource[]> {
  const refs: TransferResource[] = [];
  const add = async (
    entry: Partial<TransferResource> & {
      kind: TransferResource["kind"];
      index: number;
    },
    data?: string,
    path?: string,
  ) => {
    let bytes: Uint8Array;
    let mime = entry.mimeType || "application/octet-stream";
    try {
      if (path && (await IOUtils.exists(path))) {
        if ((await IOUtils.stat(path)).size! > MAX_RESOURCE_BYTES)
          throw new Error("Resource exceeds 32 MiB");
        bytes = await IOUtils.read(path);
      } else if (data) {
        const image = dataBytes(data);
        bytes = image.bytes;
        mime = image.mime;
      } else if (
        entry.textContent !== undefined &&
        ["text", "markdown", "code"].includes(entry.category || "")
      )
        bytes = encoder.encode(entry.textContent);
      else return;
    } catch (error) {
      // Missing files are reported in the message. Oversized resources require an explicit text-only export.
      if (error instanceof Error && /exceeds/.test(error.message)) throw error;
      return;
    }
    if (bytes.length > MAX_RESOURCE_BYTES)
      throw new Error(
        "Resource exceeds 32 MiB / 附件超过 32 MiB，可选择仅导出文字",
      );
    const hash = await resourceHash(bytes);
    if (!blobs.has(hash)) {
      const total =
        [...blobs.values()].reduce((n, b) => n + b.length, 0) + bytes.length;
      if (total > MAX_BUNDLE_BYTES)
        throw new Error("Resources exceed 128 MiB / 附件总量超过 128 MiB");
      blobs.set(hash, bytes);
    }
    refs.push({
      index: entry.index,
      hash,
      size: bytes.length,
      name:
        Array.from((entry.name || "image.png").split(/[\\/]/).pop()!, (ch) =>
          ch.charCodeAt(0) < 32 ? "_" : ch,
        ).join("") || "attachment",
      kind: entry.kind,
      category: entry.category || "image",
      mimeType: mime,
      ...(entry.textContent !== undefined
        ? { textContent: entry.textContent }
        : {}),
    });
  };
  const screenshots = parse(row.screenshot_images, []) as string[];
  for (let index = 0; index < screenshots.length; index++)
    await add(
      { kind: "screenshot", index, name: `screenshot-${index + 1}.png` },
      screenshots[index],
    );
  const attachments = parse(row.attachments_json, []) as Record<string, any>[];
  for (let index = 0; index < attachments.length; index++) {
    const a = attachments[index];
    await add(
      {
        kind: "attachment",
        index,
        name: a.name,
        mimeType: a.mimeType,
        category: a.category || "file",
        ...(typeof a.textContent === "string"
          ? { textContent: a.textContent }
          : {}),
      },
      a.imageDataUrl,
      a.storedPath,
    );
  }
  const inline = [
    ...String(row.text).matchAll(/!\[[^\]]*\]\((data:image\/[^)]+)\)/g),
  ];
  for (let index = 0; index < inline.length; index++)
    await add(
      { kind: "inline", index, name: `inline-${index + 1}.png` },
      inline[index][1],
    );
  return refs;
}

export async function validateBundle(bundle: ChatBundle): Promise<void> {
  let total = 0;
  for (const [hash, bytes] of bundle.blobs) {
    total += bytes.length;
    if (bytes.length > MAX_RESOURCE_BYTES || total > MAX_BUNDLE_BYTES)
      throw new Error("Archive resource limit exceeded");
    if ((await resourceHash(bytes)) !== hash)
      throw new Error("Resource SHA-256 mismatch / 附件校验失败");
  }
  const used = new Set<string>();
  let referencedBytes = 0;
  for (const c of bundle.archive.conversations)
    for (const m of c.messages) {
      const slots = new Set<string>();
      for (const r of m.resources || []) {
        referencedBytes += r.size;
        if (referencedBytes > MAX_BUNDLE_BYTES)
          throw new Error("Restored resource size exceeds 128 MiB");
        if (slots.has(`${r.kind}:${r.index}`))
          throw new Error("Duplicate resource slot");
        slots.add(`${r.kind}:${r.index}`);
        if (bundle.blobs.get(r.hash)?.length !== r.size)
          throw new Error("Missing or truncated resource / 附件缺失或不完整");
        used.add(r.hash);
      }
    }
  if (used.size !== bundle.blobs.size) throw new Error("Unreferenced resource");
}
export async function packChatBundle(bundle: ChatBundle): Promise<Uint8Array> {
  const archive = parseChatArchive(JSON.stringify(bundle.archive));
  await validateBundle({ archive, blobs: bundle.blobs });
  const files: Record<string, Uint8Array> = {
    "chat.json": encoder.encode(JSON.stringify(archive)),
  };
  let total = files["chat.json"].length;
  for (const [hash, bytes] of bundle.blobs) {
    files[`resources/${hash}`] = bytes;
    total += bytes.length;
  }
  if (total > MAX_BUNDLE_BYTES) throw new Error("Archive exceeds 128 MiB");
  // Stored ZIP avoids recompressing images/PDFs and keeps large exports responsive.
  const packed = zipSync(files, { level: 0 });
  if (packed.length > MAX_BUNDLE_BYTES)
    throw new Error("Archive exceeds 128 MiB");
  return packed;
}
export async function readChatBundle(bytes: Uint8Array): Promise<ChatBundle> {
  if (bytes.length > MAX_BUNDLE_BYTES)
    throw new Error("Archive exceeds 128 MiB");
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b)
    return {
      archive: parseChatArchive(decoder.decode(bytes)),
      blobs: new Map(),
    };
  let total = 0;
  const names = new Set<string>();
  const files = unzipSync(bytes, {
    filter: (file) => {
      if (
        file.name !== "chat.json" &&
        !/^resources\/[a-f0-9]{64}$/.test(file.name)
      )
        throw new Error("Invalid ZIP entry / 归档包含非法路径");
      if (names.has(file.name)) throw new Error("Duplicate ZIP entry");
      names.add(file.name);
      total += file.originalSize;
      if (
        names.size > 100001 ||
        file.originalSize >
          (file.name === "chat.json"
            ? MAX_ARCHIVE_BYTES
            : MAX_RESOURCE_BYTES) ||
        total > MAX_BUNDLE_BYTES
      )
        throw new Error("ZIP expansion limit exceeded");
      return true;
    },
  });
  if (!files["chat.json"]) throw new Error("Missing chat.json");
  const archive = parseChatArchive(decoder.decode(files["chat.json"]));
  const blobs = new Map(
    Object.entries(files)
      .filter(([name]) => name !== "chat.json")
      .map(([name, data]) => [name.slice(10), data]),
  );
  const bundle = { archive, blobs };
  await validateBundle(bundle);
  return bundle;
}

export async function restoreMessageResources(
  message: TransferMessage,
  blobs: ResourceBlobs,
) {
  const screenshots: string[] = [];
  const attachments: Record<string, unknown>[] = [];
  const inline = new Map<number, string>();
  for (const ref of [...(message.resources || [])].sort(
    (a, b) => a.index - b.index,
  )) {
    const bytes = blobs.get(ref.hash)!;
    if (ref.kind === "screenshot")
      screenshots.push(dataURL(bytes, ref.mimeType));
    else if (ref.kind === "inline")
      inline.set(ref.index, `![image](${dataURL(bytes, ref.mimeType)})`);
    else {
      const persisted = await persistAttachmentBlob(ref.name, bytes);
      // An existing hash entry can outlive a damaged file. Verify the actual
      // destination rather than treating mere existence as successful restore.
      let valid = false;
      try {
        valid =
          (await resourceHash(await IOUtils.read(persisted.storedPath))) ===
          ref.hash;
      } catch {
        /* Rewrite an unreadable destination. */
      }
      if (!valid)
        await IOUtils.write(persisted.storedPath, bytes, {
          tmpPath: `${persisted.storedPath}.tmp`,
        });
      attachments.push({
        id: `${message.uuid}:${ref.index}`,
        name: ref.name,
        mimeType: ref.mimeType,
        category: ref.category,
        ...persisted,
        ...(ref.category === "image"
          ? { imageDataUrl: dataURL(bytes, ref.mimeType) }
          : {}),
        ...(ref.textContent !== undefined
          ? { textContent: ref.textContent }
          : {}),
      });
    }
  }
  let index = 0;
  const text = message.text.replaceAll(
    placeholder,
    () => inline.get(index++) || placeholder,
  );
  const included = new Set(attachments.map((a) => a.name));
  const missing = message.missingAttachments.filter(
    (name) => !included.has(name) && name !== `${screenshots.length} image(s)`,
  );
  return { screenshots, attachments, text, missing };
}
