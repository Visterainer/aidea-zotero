// Share concurrent clicks only; completed hashes are never cached across edits.
const inFlight = new WeakMap<Zotero.Item, Promise<string | undefined>>();
export function documentFingerprint(
  item: Zotero.Item,
): Promise<string | undefined> {
  const pending = inFlight.get(item);
  if (pending) return pending;
  const task = computeDocumentFingerprint(item).finally(() =>
    inFlight.delete(item),
  );
  inFlight.set(item, task);
  return task;
}

/** Content identity is portable; local item IDs, paths and mtimes are not. */
async function computeDocumentFingerprint(
  item: Zotero.Item,
): Promise<string | undefined> {
  try {
    const path = await item.getFilePathAsync();
    if (!path) return undefined;
    const before = await IOUtils.stat(path);
    let result: string;
    const classes =
      typeof Components !== "undefined"
        ? (Components.classes as unknown as typeof Cc)
        : undefined;
    const hashFactory = classes?.["@mozilla.org/security/hash;1"];
    if (hashFactory?.createInstance && Components.interfaces?.nsICryptoHash) {
      const hash = hashFactory.createInstance(
        Components.interfaces.nsICryptoHash,
      );
      hash.initWithString("sha256");
      for (let offset = 0; offset < before.size!; offset += 4 * 1024 * 1024) {
        const bytes = await IOUtils.read(path, {
          offset,
          maxBytes: 4 * 1024 * 1024,
        });
        hash.update(bytes, bytes.length);
      }
      result = Array.from(hash.finish(false), (c) =>
        c.charCodeAt(0).toString(16).padStart(2, "0"),
      ).join("");
    } else {
      const bytes = await IOUtils.read(path);
      const hash = await crypto.subtle.digest(
        "SHA-256",
        new Uint8Array(bytes).buffer,
      );
      result = Array.from(new Uint8Array(hash), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    }
    const after = await IOUtils.stat(path);
    return before.size === after.size &&
      before.lastModified === after.lastModified
      ? result
      : undefined;
  } catch {
    return undefined;
  }
}
