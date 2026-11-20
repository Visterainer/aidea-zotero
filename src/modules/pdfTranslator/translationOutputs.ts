import {
  canLinkBeside,
  checkAttachmentWritable,
  createTranslationAttachment,
  fileBaseName,
  isPdfAttachment,
  legacyManagedName,
  matchTranslationOutput,
  refreshTranslationAttachment,
  translationCandidates,
  type DeliveryTarget,
  type TranslationOutputKind,
} from "./translationAttachment";

export type { TranslationOutputKind } from "./translationAttachment";

export interface OutputCell {
  id: string;
  destination: "attachment" | "folder";
  kind: TranslationOutputKind;
  exists: boolean;
  path?: string;
  stamp?: string;
  itemID?: number;
  itemKey?: string;
}

/** JSON-only snapshot. An observed file, not just its format, is the scope of
 * replacement approval. Never use a deserialized cell's path as a write target. */
export interface OutputPlan {
  sourceID: number | null;
  libraryID: number | null;
  sourceKey: string;
  pdfPath: string;
  sourceStamp?: string;
  targetLang: string;
  kinds: TranslationOutputKind[];
  output: DeliveryTarget;
  cells: OutputCell[];
  generateKinds: TranslationOutputKind[];
  overwrite: boolean;
  /** Private per-job nonce. Persist this with the plan before any publication. */
  reservationToken?: string;
}

export function newReservationToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** Check the complete engine report before checkpointing a fresh job. A
 * publisher resuming that checkpoint only needs bytes for still-needed cells. */
export function validateGeneratedManifest(
  plan: OutputPlan,
  files: readonly string[],
): Map<TranslationOutputKind, string> {
  return manifestByKind(plan, files, plan.generateKinds);
}

export class MissingStagedFormatError extends Error {
  constructor(readonly kind: TranslationOutputKind) {
    super(`Missing staged ${kind} translation`);
    this.name = "MissingStagedFormatError";
  }
}

function manifestByKind(
  plan: OutputPlan,
  files: readonly string[],
  required: Iterable<TranslationOutputKind>,
): Map<TranslationOutputKind, string> {
  const byKind = new Map<TranslationOutputKind, string>();
  for (const path of files) {
    const kind = matchTranslationOutput(path, plan.pdfPath, plan.targetLang);
    if (!kind || !plan.generateKinds.includes(kind) || byKind.has(kind))
      throw new Error(`Unexpected or duplicate engine output: ${path}`);
    byKind.set(kind, path);
  }
  for (const kind of required) {
    if (!byKind.has(kind)) throw new MissingStagedFormatError(kind);
  }
  return byKind;
}

function absolute(path: string): string {
  if (
    !path ||
    !PathUtils.isAbsolute(path) ||
    /\0|(?:^|[\\/])\.{1,2}(?:[\\/]|$)/.test(path) ||
    (Zotero.isWin &&
      (/^\\\\[?.]\\/.test(path) || path.replace(/^[A-Z]:/i, "").includes(":")))
  )
    throw new Error(`Invalid absolute file path: ${path}`);
  return path;
}

function missing(err: unknown): boolean {
  return [
    "NotFoundError",
    "NS_ERROR_FILE_NOT_FOUND",
    "NS_ERROR_FILE_TARGET_DOES_NOT_EXIST",
  ].includes(String((err as Error)?.name));
}

/** normalize() resolves aliases in existing paths; allow a not-yet-created
 * leaf, but bind it to the canonical parent. Keep input symlinks out of writes. */
function canonical(path: string): string {
  const f = Zotero.File.pathToFile(absolute(path));
  try {
    f.normalize();
  } catch (err) {
    // A positively missing stored attachment can have no storage/key directory
    // yet. Resolve the existing ancestor without masking permission errors.
    const parent = PathUtils.parent(path);
    if (!missing(err) || !parent || parent === path) throw err;
    return PathUtils.join(canonical(parent), fileBaseName(path));
  }
  return Zotero.isWin ? f.path.toLowerCase() : f.path;
}

const MARKER_PREFIX = "AIdea publication in progress: ";

async function pdfStamp(
  path: string,
  reservation?: string,
): Promise<string | undefined> {
  absolute(path);
  try {
    if (Zotero.File.pathToFile(path).isSymlink())
      throw new Error(`Refusing symbolic-link PDF: ${path}`);
    const info = await IOUtils.stat(path);
    if (info.type !== "regular") throw new Error(`Not a regular PDF: ${path}`);
    // Read a small prefix, not the whole document. Stat alone counts broken,
    // placeholder or unreadable files as already translated.
    const bytes = await IOUtils.read(path, { maxBytes: 1024 });
    const prefix = String.fromCharCode(...bytes);
    if (
      reservation &&
      info.size === reservation.length &&
      prefix === reservation
    )
      return undefined;
    if (prefix.startsWith(MARKER_PREFIX) || !/%PDF-\d\.\d/.test(prefix))
      throw new Error(`Not a readable PDF: ${path}`);
    return `${info.size}:${info.lastModified}:${info.creationTime ?? ""}`;
  } catch (err) {
    if (missing(err)) return undefined;
    throw err;
  }
}

async function directory(path: string, writable: boolean): Promise<string> {
  if ((await IOUtils.stat(absolute(path))).type !== "directory")
    throw new Error(`Not a directory: ${path}`);
  const file = Zotero.File.pathToFile(path);
  if (!file.isReadable() || (writable && !file.isWritable()))
    throw new Error(`Cannot access output directory: ${path}`);
  return canonical(path);
}

async function ownerToken(
  source: Zotero.Item | null,
  pdfPath: string,
): Promise<string> {
  if (source) {
    if (
      !Number.isSafeInteger(source.libraryID) ||
      source.libraryID < 1 ||
      typeof source.key !== "string" ||
      !/^[a-zA-Z0-9]{1,32}$/.test(source.key)
    )
      throw new Error("Invalid source library or item key");
    const library = Zotero.Libraries.get(source.libraryID);
    const libraryType = library && library.libraryType;
    if (libraryType === "group") {
      const group = Zotero.Groups.getGroupIDFromLibraryID(source.libraryID);
      if (!Number.isSafeInteger(group) || group < 1)
        throw new Error("Cannot identify the source Zotero group");
      return `G${group}-${source.key}`;
    }
    if (libraryType !== "user") throw new Error("Unsupported source library");
    const user = Zotero.Users.getCurrentUserID();
    if (Number.isSafeInteger(user) && user > 0) return `U${user}-${source.key}`;
    const local = Zotero.Users.getLocalUserKey();
    if (typeof local !== "string" || !/^[A-Za-z0-9]{1,32}$/.test(local))
      throw new Error("Invalid local Zotero user key");
    return `P${local}-${source.key}`;
  }
  return `file-${await sha256(canonical(pdfPath))}`;
}

async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

/** A marker is a capability for just this persisted job and originally
 * observed cell. Don't put the nonce itself on a shared filesystem. */
async function reservations(plan: OutputPlan): Promise<Map<string, string>> {
  const marks = new Map<string, string>();
  if (
    typeof plan.reservationToken !== "string" ||
    !/^[a-f0-9]{32}$/.test(plan.reservationToken)
  )
    throw new Error("Invalid or missing publication reservation token");
  for (const cell of plan.cells) {
    if (!cell.path) continue;
    const digest = await sha256(
      JSON.stringify([
        plan.reservationToken,
        plan.libraryID,
        plan.sourceKey,
        plan.pdfPath,
        plan.sourceStamp,
        cell.id,
        cell.path,
      ]),
    );
    marks.set(reservationKey(cell), MARKER_PREFIX + digest);
  }
  return marks;
}

function reservationKey(
  cell: Pick<
    OutputCell,
    "destination" | "kind" | "path" | "itemID" | "itemKey"
  >,
): string {
  return JSON.stringify([
    cell.destination,
    cell.kind,
    cell.path,
    cell.itemID,
    cell.itemKey,
  ]);
}

function managedName(
  token: string,
  dest: OutputCell["destination"],
  lang: string,
  kind: TranslationOutputKind,
): string {
  // Never reuse bare engine names in a user directory: their source could be
  // another attachment/library with exactly the same paper filename.
  return `AIdea-${dest}-${token}.${lang.toLowerCase()}.${kind}.pdf`;
}

function makeCell(
  owner: string,
  lang: string,
  data: Omit<OutputCell, "id" | "exists">,
): OutputCell {
  const { destination, kind, itemKey, path, stamp } = data;
  return {
    ...data,
    exists: !!stamp,
    id: JSON.stringify([
      owner,
      lang,
      destination,
      kind,
      itemKey || "",
      data.itemID || 0,
      path || "",
      stamp || "",
    ]),
  };
}

function checkSync(item: Zotero.Item, exists: boolean): void {
  if (!item.isStoredFileAttachment()) return;
  const state = item.attachmentSyncState;
  // Zotero storage state constants are stable on Zotero 7+.
  if (
    [1, 4, 5, "to_download", "force_download", "in_conflict"].includes(state) ||
    (!exists &&
      (state === 2 ||
        state === "in_sync" ||
        item.attachmentSyncedHash ||
        item.attachmentSyncedModificationTime))
  )
    throw new Error(
      `Sync or download the existing translation before continuing: ${item.attachmentFilename} (#${item.id})`,
    );
}

function storageRoot(): string {
  // Zotero.getStorageDirectory() creates storage/ as a side effect.
  return PathUtils.join(Zotero.DataDirectory.dir, "storage");
}

function attachmentPath(item: Zotero.Item): string | false {
  if (
    item.isStoredFileAttachment() &&
    !Zotero.File.pathToFile(storageRoot()).isDirectory()
  )
    throw new Error("Zotero storage directory is unavailable");
  return item.getFilePath();
}

function protectSource(path: string, sourcePath: string): void {
  const parent = PathUtils.parent(absolute(path));
  const sourceParent = PathUtils.parent(sourcePath);
  // Refuse even case/normalization aliases on case-sensitive volumes.
  if (
    !parent ||
    !sourceParent ||
    (canonical(parent).normalize().toLowerCase() ===
      canonical(sourceParent).normalize().toLowerCase() &&
      fileBaseName(path).normalize().toLowerCase() ===
        fileBaseName(sourcePath).normalize().toLowerCase())
  )
    throw new Error(`Refusing to write to the source PDF: ${path}`);
}

/** A folder can itself be the directory of a linked attachment in any
 * library. Authority to update the folder copy is NOT authority to update
 * that item's PDF. Check live (and trashed) references immediately before
 * publication, even if the referenced local file is currently missing. */
async function checkBacking(path: string, own?: Zotero.Item): Promise<void> {
  const parent = PathUtils.parent(path)!;
  const storage = Zotero.File.pathToFile(canonical(storageRoot()));
  const parentFile = Zotero.File.pathToFile(canonical(parent));
  if (own?.isStoredFileAttachment()) {
    if (!parentFile.equals(Zotero.Attachments.getStorageDirectory(own)))
      throw new Error(`Invalid stored attachment path: ${path}`);
  } else if (storage.equals(parentFile) || storage.contains(parentFile)) {
    throw new Error(
      `Cannot publish a user file inside Zotero storage: ${path}`,
    );
  }
  // Resolve relative links as Zotero does, not relative to the current working
  // directory. Filter by leaf in JS (including Unicode folding/normalization).
  const rows = await Zotero.DB.queryAsync(
    "SELECT itemID, path FROM itemAttachments WHERE linkMode=? AND path LIKE ?",
    [
      Zotero.Attachments.LINK_MODE_LINKED_FILE,
      `%${fileBaseName(path).split(".").slice(-2).join(".")}`,
    ],
  );
  if (!rows) throw new Error("Cannot inspect linked attachment paths");
  const leaf = fileBaseName(path).normalize().toLowerCase();
  for (const row of rows) {
    if (
      row.itemID === own?.id ||
      fileBaseName(String(row.path || "").replace(/^attachments:/, ""))
        .normalize()
        .toLowerCase() !== leaf
    )
      continue;
    const other = await Zotero.Items.getAsync(row.itemID);
    const backed = other && other.getFilePath();
    if (!backed)
      throw new Error(
        `Cannot resolve another attachment with this filename: #${row.itemID}`,
      );
    const dir = PathUtils.parent(backed);
    if (
      dir &&
      canonical(dir).normalize().toLowerCase() ===
        parentFile.path.normalize().toLowerCase()
    )
      throw new Error(
        `Output also backs another Zotero attachment (#${row.itemID}): ${path}`,
      );
  }
}

export async function inspectTranslationOutputs(
  source: Zotero.Item | null,
  pdfPath: string,
  targetLang: string,
  kinds: TranslationOutputKind[],
  output: DeliveryTarget,
  overwrite: boolean,
): Promise<OutputPlan> {
  const plan = await inspect(
    source,
    pdfPath,
    targetLang,
    kinds,
    output,
    overwrite,
  );
  return { ...plan, reservationToken: newReservationToken() };
}

async function inspect(
  source: Zotero.Item | null,
  pdfPath: string,
  targetLang: string,
  kinds: TranslationOutputKind[],
  output: DeliveryTarget,
  overwrite: boolean,
  marks?: ReadonlyMap<string, string>,
): Promise<OutputPlan> {
  absolute(pdfPath);
  if (
    !/\.pdf$/i.test(pdfPath) ||
    !/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(targetLang) ||
    targetLang.length > 48 ||
    !kinds.length ||
    kinds.some((k) => k !== "mono" && k !== "dual") ||
    typeof overwrite !== "boolean" ||
    typeof output.attach !== "boolean" ||
    typeof output.saveDir !== "string"
  )
    throw new Error(
      "Invalid translation source, target language, format or destination",
    );
  if (
    source &&
    (!isPdfAttachment(source) ||
      !source.id ||
      attachmentPath(source) !== pdfPath)
  )
    throw new Error(`Source attachment no longer matches ${pdfPath}`);
  const sourceStamp = await pdfStamp(pdfPath);
  if (!sourceStamp) throw new Error(`Source PDF not found: ${pdfPath}`);
  const { attach, saveDir } = output;
  if ((!attach && !saveDir) || (attach && !source))
    throw new Error("No available translation destination");
  const token = await ownerToken(source, pdfPath);
  const lang = targetLang.toLowerCase();
  kinds = [...new Set(kinds)];
  const name = (kind: TranslationOutputKind) =>
    managedName(token, "attachment", lang, kind);
  const includeOffline = token.startsWith("U");
  const attached =
    attach && source
      ? await translationCandidates(source, lang, kinds, name, includeOffline)
      : {};
  const cells: OutputCell[] = [];
  const leaves = new Map<string, string[]>();
  async function checkLegacy(
    path: string,
    dest: OutputCell["destination"],
    kind: TranslationOutputKind,
  ) {
    if (!source) return;
    // Even our local ID could denote a different library on another client.
    // A loose old folder copy or orphaned link is not provenance.
    const dir = PathUtils.parent(path)!;
    if (!leaves.has(dir))
      leaves.set(dir, (await IOUtils.getChildren(dir)).map(fileBaseName));
    const legacy = leaves
      .get(dir)!
      .find((n) =>
        legacyManagedName(n, dest, source.key, lang, kind, includeOffline),
      );
    if (legacy)
      throw new Error(
        `Cannot verify legacy output ${legacy}; move it aside after verifying its source`,
      );
  }
  if (saveDir) {
    const dir = await directory(saveDir, false);
    for (const kind of kinds) {
      const path = PathUtils.join(
        dir,
        managedName(token, "folder", lang, kind),
      );
      protectSource(path, pdfPath);
      const stamp = await pdfStamp(
        path,
        marks?.get(reservationKey({ destination: "folder", kind, path })),
      );
      if (!stamp) await checkLegacy(path, "folder", kind);
      if (!stamp || overwrite) {
        await directory(dir, true);
        await checkBacking(path);
      }
      cells.push(
        makeCell(token, lang, { destination: "folder", kind, path, stamp }),
      );
    }
  }
  if (attach && source) {
    for (const kind of kinds) {
      const item = attached[kind];
      const path = item
        ? attachmentPath(item)
        : canLinkBeside(source)
          ? PathUtils.join(PathUtils.parent(pdfPath)!, name(kind))
          : undefined;
      if (item && (!path || fileBaseName(path) !== item.attachmentFilename))
        throw new Error(
          `Translation attachment has no usable local path: #${item.id}`,
        );
      let stamp: string | undefined;
      if (path) {
        protectSource(path, pdfPath);
        const physical = await pdfStamp(
          path,
          marks?.get(
            reservationKey({
              destination: "attachment",
              kind,
              path,
              itemKey: item?.key,
              itemID: item?.id,
            }),
          ),
        );
        if (!item && !physical) await checkLegacy(path, "attachment", kind);
        if (item) {
          stamp = physical;
          checkSync(item, !!stamp);
        }
        // No DB record: a backing file alone never satisfies an attachment.
        if (!stamp || overwrite) {
          if (!item?.isStoredFileAttachment())
            await directory(PathUtils.parent(path)!, true);
          await checkBacking(path, item);
        }
      }
      if (!stamp || overwrite) checkAttachmentWritable(source);
      cells.push(
        makeCell(token, lang, {
          destination: "attachment",
          kind,
          ...(path ? { path } : {}),
          stamp,
          ...(item ? { itemID: item.id, itemKey: item.key } : {}),
        }),
      );
    }
  }
  return {
    sourceID: source?.id ?? null,
    libraryID: source?.libraryID ?? null,
    sourceKey: source?.key || "",
    pdfPath,
    sourceStamp,
    targetLang,
    kinds,
    output: { attach, saveDir },
    cells,
    generateKinds: kinds.filter((kind) =>
      cells.some((c) => c.kind === kind && (!c.exists || overwrite)),
    ),
    overwrite,
  };
}

function sourceFrom(plan: OutputPlan): Zotero.Item | null {
  if (
    plan.sourceID === null &&
    plan.libraryID === null &&
    plan.sourceKey === ""
  )
    return null;
  const item = Zotero.Items.get(plan.sourceID!);
  if (
    !item ||
    !isPdfAttachment(item) ||
    item.libraryID !== plan.libraryID ||
    item.key !== plan.sourceKey ||
    attachmentPath(item) !== plan.pdfPath
  )
    throw new Error("The original source attachment is no longer available");
  return item;
}

export async function verifyPlanSource(plan: OutputPlan): Promise<void> {
  sourceFrom(plan);
  if (!plan.sourceStamp || (await pdfStamp(plan.pdfPath)) !== plan.sourceStamp)
    throw new Error("The source PDF changed after inspection");
}

/** IOUtils.move({noOverwrite:true}) uses a separate stat before rename and
 * treats a directory as a container. Reserve a missing leaf with PR_EXCL,
 * then rename the complete staged file to that exact leaf on the same volume.
 * Another ordinary creator can never win *and* have its file overwritten.
 * Gecko has no file-identity CAS against an external writer that deliberately
 * unlinks and replaces our live reservation between validation and rename.
 */
async function commitStagedPdf(
  temp: string,
  path: string,
  replace: boolean,
  marker: string | undefined,
): Promise<boolean> {
  const rename = () =>
    Zotero.File.pathToFile(temp).renameTo(
      Zotero.File.pathToFile(PathUtils.parent(path)!),
      fileBaseName(path),
    );
  if (replace) {
    rename();
    return true;
  }
  if (!marker) throw new Error(`Output identity changed: ${path}`);
  let createError: unknown;
  try {
    await IOUtils.writeUTF8(path, marker, { mode: "create", flush: true }); // PR_CREATE_FILE | PR_EXCL
  } catch (error) {
    createError = error; // EEXIST may be our own reservation from before a crash.
  }
  // Read this tiny record synchronously. In particular don't yield to another
  // JS creator between the final check and the rename. Never unlink the leaf,
  // even after a rename failure: the same checkpoint can reclaim it in place.
  const f = Zotero.File.pathToFile(path);
  if (
    !f.isSymlink() &&
    f.isFile() &&
    f.fileSize === marker.length &&
    Zotero.File.getContents(f, "UTF-8", marker.length + 1) === marker
  ) {
    rename();
    return true;
  }
  if (await pdfStamp(path)) return false;
  throw createError || new Error(`Output reservation changed: ${path}`);
}

/** Copy across volumes into an exclusive private stage *on the final volume*,
 * then commit the complete file by rename. On any failure the existing PDF or
 * the original engine output is still available. Never remove a final path. */
async function installPdf(
  file: string,
  path: string,
  replace: boolean,
  marker: string | undefined,
  beforeCommit: () => Promise<boolean>,
): Promise<boolean> {
  const parent = PathUtils.parent(path)!;
  const stage = await IOUtils.createUniqueDirectory(
    parent,
    ".aidea-publish",
    0o700,
  );
  const temp = PathUtils.join(stage, "output.pdf");
  try {
    await IOUtils.copy(file, temp, { noOverwrite: true });
    if (!(await pdfStamp(temp))) throw new Error(`Cannot stage ${file}`);
    if (!(await beforeCommit())) return false;
    return await commitStagedPdf(temp, path, replace, marker);
  } finally {
    await IOUtils.remove(stage, { recursive: true, ignoreAbsent: true });
  }
}

async function publish(
  plan: OutputPlan,
  files: string[],
  completed: string[],
  onCell: (cellId: string, itemID?: number) => void,
) {
  const source = sourceFrom(plan);
  const token = await ownerToken(source, plan.pdfPath);
  const marks = await reservations(plan);
  const fresh = await inspect(
    source,
    plan.pdfPath,
    plan.targetLang,
    plan.kinds,
    plan.output,
    false,
    marks,
  );
  if (plan.sourceStamp !== fresh.sourceStamp)
    throw new Error("The source PDF changed after inspection");
  if (
    fresh.cells.length !== plan.cells.length ||
    typeof plan.overwrite !== "boolean" ||
    new Set(plan.cells.map((c) => `${c.destination}:${c.kind}`)).size !==
      fresh.cells.length
  )
    throw new Error("Invalid saved translation output plan");
  const lang = plan.targetLang.toLowerCase();
  // Attachment-only checkpoints made before group-stable names can still be
  // resumed against the proven related record. Folder paths must match exactly.
  const oldOwner = (cell: OutputCell) =>
    source &&
    cell.id === makeCell(`L${plan.libraryID}-${plan.sourceKey}`, lang, cell).id
      ? `L${plan.libraryID}-${plan.sourceKey}`
      : token;
  const canReplace = (old: OutputCell, now: OutputCell) =>
    plan.overwrite &&
    old.exists &&
    !completed.includes(old.id) &&
    old.id === makeCell(oldOwner(old), lang, now).id;
  const checkLive = (
    old: OutputCell,
    now: OutputCell | undefined,
  ): OutputCell => {
    if (
      !now ||
      (old.destination === "folder" && now.path !== old.path) ||
      (!now.exists && old.path && now.path !== old.path) ||
      (!now.exists &&
        old.itemID &&
        (now.itemID !== old.itemID || now.itemKey !== old.itemKey))
    )
      throw new Error(
        "Invalid saved output cell or destination changed after inspection",
      );
    return now;
  };
  const required = new Set<TranslationOutputKind>();
  for (const old of plan.cells) {
    if (
      old.exists !== !!old.stamp ||
      old.id !== makeCell(oldOwner(old), lang, old).id
    )
      throw new Error("Invalid saved translation output cell");
    const now = checkLive(
      old,
      fresh.cells.find(
        (c) => c.kind === old.kind && c.destination === old.destination,
      ),
    );
    if (!now.exists || canReplace(old, now)) required.add(old.kind);
  }
  const byKind = manifestByKind(plan, files, required);
  // Verify *all* still-needed formats before changing even the first cell.
  // A retry can omit a format already satisfied on disk, even without a receipt
  // (e.g. the process died after rename). Per-cell checks below still run live.
  for (const [kind, path] of byKind) {
    protectSource(path, plan.pdfPath);
    if (
      fresh.cells.some((c) => c.path && canonical(c.path) === canonical(path))
    )
      throw new Error(`Engine output is not staged: ${path}`);
    if (!(await pdfStamp(path))) {
      if (required.has(kind))
        throw new Error(`Missing staged ${kind} translation: ${path}`);
      byKind.delete(kind);
    }
  }
  const itemIDs: number[] = [],
    savedFiles: string[] = [];
  for (const old of plan.cells) {
    const liveCell = async () => {
      const justThis = await inspect(
        sourceFrom(plan),
        plan.pdfPath,
        plan.targetLang,
        [old.kind],
        {
          attach: old.destination === "attachment",
          saveDir: old.destination === "folder" ? plan.output.saveDir : "",
        },
        false,
        marks,
      );
      if (plan.sourceStamp !== justThis.sourceStamp)
        throw new Error("Source changed after inspection");
      return checkLive(old, justThis.cells[0]);
    };
    let cell = await liveCell();
    const file = byKind.get(old.kind);
    const existing = cell.itemID
      ? Zotero.Items.get(cell.itemID) || undefined
      : undefined;
    const replace = canReplace(old, cell);
    if (!cell.exists || replace) {
      if (!file)
        throw new Error(
          `Missing staged ${old.kind} translation for ${old.destination}`,
        );
      if (cell.destination === "attachment" && source)
        checkAttachmentWritable(source);
      if (cell.path) {
        const path = cell.path;
        await checkBacking(path, existing || undefined);
        if (existing && existing.isStoredFileAttachment() && !cell.exists)
          await IOUtils.makeDirectory(PathUtils.parent(path)!, {
            createAncestors: false,
            ignoreExisting: true,
          });
        const didWrite = await installPdf(
          file,
          path,
          replace,
          marks.get(reservationKey(cell)),
          async () => {
            const now = await liveCell();
            if (
              now.path !== path ||
              now.itemID !== cell.itemID ||
              now.id !== cell.id
            ) {
              if (now.exists) return false;
              throw new Error(`Output changed during publication: ${path}`);
            }
            await checkBacking(path, existing || undefined);
            return true;
          },
        );
        if (didWrite && existing) await refreshTranslationAttachment(existing);
        if (!existing && cell.destination === "attachment" && source) {
          // After a failed linkFromFile, retry may find our completed backing
          // file with no item yet. An unrelated file is never adopted/erased.
          const now = await liveCell();
          if (!now.exists) {
            if (
              !didWrite &&
              (await IOUtils.computeHexDigest(file, "sha256")) !==
                (await IOUtils.computeHexDigest(path, "sha256"))
            )
              throw new Error(`Linked output filename is occupied: ${path}`);
            await createTranslationAttachment(
              source,
              path,
              fileBaseName(path),
              true,
            );
          }
        }
      } else if (source && cell.destination === "attachment") {
        await createTranslationAttachment(
          source,
          file,
          managedName(token, "attachment", plan.targetLang, cell.kind),
          false,
        );
      }
      cell = await liveCell();
    } else if (
      file &&
      old.itemID === cell.itemID &&
      cell.path &&
      existing &&
      old.itemKey === existing.key &&
      !completed.includes(old.id) &&
      (!old.exists || plan.overwrite) &&
      cell.id !== old.id
    ) {
      // File rename succeeded but saveTx/the receipt may have failed. Only
      // repair sync bookkeeping for the exact bytes we were asked to file.
      if (
        (await IOUtils.computeHexDigest(file, "sha256")) ===
        (await IOUtils.computeHexDigest(cell.path, "sha256"))
      ) {
        checkAttachmentWritable(existing);
        await refreshTranslationAttachment(existing);
      }
    }
    if (!cell.exists)
      throw new Error(
        `Translation was not published: ${old.destination}/${old.kind}`,
      );
    if (cell.destination === "folder") savedFiles.push(cell.path!);
    else if (cell.itemID) itemIDs.push(cell.itemID);
    onCell(old.id, cell.itemID);
  }
  return { itemIDs, savedFiles };
}

// Importing a stored attachment allocates its own ID/filename. Serialize
// check-and-create across this plugin's windows, without a nested Zotero DB tx.
let publishing: Promise<unknown> = Promise.resolve();
export function publishTranslationOutputs(
  plan: OutputPlan,
  files: string[],
  completed: string[],
  onCell: (cellId: string, itemID?: number) => void,
): Promise<{ itemIDs: number[]; savedFiles: string[] }> {
  const job = publishing.then(() => publish(plan, files, completed, onCell));
  publishing = job.catch(() => undefined);
  return job;
}
