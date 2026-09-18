import type { EvidenceRef } from "./document/evidence";
import { getDocumentAdapter } from "./document/registry";
import { documentFingerprint } from "../../utils/documentFingerprint";

/**
 * Mark the parts of one line that belong to a closed inline code span. A
 * backtick run without a matching closer on the same line is literal text, so
 * it must not swallow the rest of the line or leak into later lines.
 */
function inlineCodeParts(parts: string[]): boolean[] {
  const inside = parts.map(() => false);
  for (let index = 0; index < parts.length; index++) {
    if (!/^`+$/.test(parts[index])) continue;
    const close = parts.findIndex(
      (part, other) => other > index && part === parts[index],
    );
    if (close < 0) continue;
    for (let span = index; span <= close; span++) inside[span] = true;
    index = close;
  }
  return inside;
}

/** Keep citation syntax inside fenced and inline code literal. */
export function mapCitationText(
  text: string,
  replace: (id: string) => string,
): string {
  let fence = "";
  return text
    .split(/(\r?\n)/)
    .map((line) => {
      const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (match) {
        if (!fence) fence = match[1];
        else if (
          match[1][0] === fence[0] &&
          match[1].length >= fence.length &&
          !match[2].trim()
        )
          fence = "";
        return line;
      }
      if (fence || /^(?: {4}|\t)/.test(line)) return line;
      const parts = line.split(/(`+)/g);
      const inside = inlineCodeParts(parts);
      return parts
        .map((part, index) =>
          inside[index]
            ? part
            : part.replace(/\[\[cite:([A-Za-z0-9_-]+)\]\]/g, (_, id: string) =>
                replace(id),
              ),
        )
        .join("");
    })
    .join("");
}

export function citedEvidence(
  text: string,
  refs: EvidenceRef[] = [],
): EvidenceRef[] {
  const ids = new Set<string>();
  mapCitationText(text, (id) => {
    ids.add(id);
    return "";
  });
  const known = new Set(refs.map((ref) => ref.id));
  const invalidCount = [...ids].filter((id) => !known.has(id)).length;
  if (invalidCount) ztoolkit.log("LLM invalid citations", { invalidCount });
  return refs.filter((ref) => ids.has(ref.id));
}

export function citationLabel(ref: EvidenceRef, compact = false): string {
  const fullTitle = ref.title.replace(/[[\]\\\r\n]/g, " ");
  const title =
    compact && fullTitle.length > 32 ? `${fullTitle.slice(0, 31)}…` : fullTitle;
  if (ref.locator?.kind === "pdf-page")
    return `${title} · ${(ref.locator.pageLabel || `PDF p. ${ref.locator.pageIndex + 1}`).replace(/[[\]\\\r\n]/g, " ")}`;
  if (ref.locator?.kind === "epub-location")
    return `${title} · ${(ref.locator.locationLabel || "EPUB").replace(/[[\]\\\r\n]/g, " ")}`;
  return title;
}

export function citationSourceUrl(ref: EvidenceRef): string | undefined {
  if (!ref.itemKey) return undefined;
  const scope =
    ref.libraryType === "group" && ref.groupId
      ? `groups/${ref.groupId}`
      : "library";
  const base = `zotero://select/${scope}/items/${encodeURIComponent(ref.itemKey)}`;
  if (ref.locator?.kind === "pdf-page")
    return `zotero://open-pdf/${scope}/items/${encodeURIComponent(ref.itemKey)}?page=${ref.locator.pageIndex + 1}`;
  if (ref.locator?.kind === "epub-location" && ref.locator.cfi)
    return `zotero://open/${scope}/items/${encodeURIComponent(ref.itemKey)}?cfi=${encodeURIComponent(ref.locator.cfi)}`;
  return base;
}

export function citationMarkdown(
  text: string,
  refs: EvidenceRef[] = [],
  exportMode = false,
): string {
  const byId = new Map(refs.map((ref) => [ref.id, ref]));
  return mapCitationText(text, (id) => {
    const ref = byId.get(id);
    if (!ref) return "";
    const label = citationLabel(ref, !exportMode);
    const url = exportMode
      ? citationSourceUrl(ref)
      : ref.itemId > 0 || (ref.itemKey && ref.libraryId)
        ? `aidea-cite:${id}`
        : undefined;
    return url ? `[${label}](${url})` : `(${label})`;
  });
}

export async function navigateCitation(ref: EvidenceRef): Promise<void> {
  const item =
    ref.itemKey && ref.libraryId
      ? await Zotero.Items.getByLibraryAndKeyAsync(ref.libraryId, ref.itemKey)
      : Zotero.Items.get(ref.itemId);
  if (!item || item.deleted)
    throw new Error(
      "Citation source is no longer available / 引用文献已不可用",
    );
  if (!item.isAttachment()) {
    await Zotero.getMainWindow().ZoteroPane.selectItem(item.id);
    return;
  }
  const adapter = ref.kind ? getDocumentAdapter(ref.kind) : null;
  const revision = await adapter?.getSourceRevision?.(item);
  const location = ref.documentHash
    ? (await documentFingerprint(item)) === ref.documentHash
      ? ref.locator
      : undefined
    : ref.sourceRevision && revision !== ref.sourceRevision
      ? undefined
      : ref.locator;
  if (adapter?.navigate) await adapter.navigate(item, location);
  else await Zotero.Reader.open(item.id);
  if (ref.documentHash && ref.locator && !location)
    throw new Error(
      "Source file unavailable or different; opened without jumping / 原文尚未同步或版本不同，已打开文献但未跳转",
    );
}

/** Recheck source versions at export time; saved external links are static thereafter. */
export async function evidenceForExport(
  refs: EvidenceRef[] = [],
): Promise<EvidenceRef[]> {
  const fingerprints = new Map<number, Promise<string | undefined>>();
  const fingerprint = (item: Zotero.Item) => {
    let task = fingerprints.get(item.id);
    if (!task) {
      task = documentFingerprint(item);
      fingerprints.set(item.id, task);
    }
    return task;
  };
  return Promise.all(
    refs.map(async (ref) => {
      if (!ref.itemId && !(ref.itemKey && ref.libraryId)) return ref;
      try {
        const item =
          ref.itemKey && ref.libraryId
            ? await Zotero.Items.getByLibraryAndKeyAsync(
                ref.libraryId,
                ref.itemKey,
              )
            : Zotero.Items.get(ref.itemId);
        if (!item || item.deleted)
          return { ...ref, itemKey: undefined, locator: undefined };
        if (ref.documentHash) {
          if ((await fingerprint(item)) !== ref.documentHash)
            return { ...ref, locator: undefined };
        } else if (ref.sourceRevision && ref.kind) {
          const revision = await getDocumentAdapter(
            ref.kind,
          )?.getSourceRevision?.(item);
          if (revision !== ref.sourceRevision)
            return { ...ref, locator: undefined };
        }
        return ref;
      } catch {
        return { ...ref, locator: undefined };
      }
    }),
  );
}
export async function exportCitationMarkdown(
  text: string,
  refs?: EvidenceRef[],
): Promise<string> {
  return citationMarkdown(text, await evidenceForExport(refs), true);
}
