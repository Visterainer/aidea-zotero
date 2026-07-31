import { renderMarkdownForNote } from "../../utils/markdown";
import { getZoteroItem } from "../../utils/zoteroItems";
import { getAllAuthorProfileNoteTitles, getAuthorProfileCopy } from "./i18n";
import type { AuthorProfileResult } from "./types";
import { NOTE_MARKER } from "./utils";

function isAuthorProfileNote(note: Zotero.Item | null | undefined): boolean {
  if (!note?.isNote?.()) return false;
  try {
    const html = note.getNote?.() || "";
    return (
      html.includes(NOTE_MARKER) ||
      (html.includes("AIdea") &&
        getAllAuthorProfileNoteTitles().some((title) => html.includes(title)))
    );
  } catch {
    return false;
  }
}

async function getChildNotes(parentItem: Zotero.Item): Promise<Zotero.Item[]> {
  const out: Zotero.Item[] = [];
  const seen = new Set<number>();
  try {
    const noteIds = await (parentItem as any).getNotes?.();
    if (Array.isArray(noteIds)) {
      for (const rawId of noteIds) {
        const id = Number(rawId);
        if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
        seen.add(id);
        const note = getZoteroItem(id);
        if (note?.isNote?.()) out.push(note);
      }
    }
  } catch {
    /* fall back to library scan */
  }

  if (out.length) return out;

  try {
    const items = await Zotero.Items.getAll(
      parentItem.libraryID,
      true,
      false,
      false,
    );
    for (const item of items) {
      if (item.parentID === parentItem.id && item.isNote?.()) out.push(item);
    }
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to scan child notes", err);
  }
  return out;
}

export async function findAuthorProfileNote(
  parentItem: Zotero.Item,
): Promise<Zotero.Item | null> {
  const notes = await getChildNotes(parentItem);
  return notes.find((note) => isAuthorProfileNote(note)) || null;
}

export async function hasAuthorProfileNote(
  parentItem: Zotero.Item,
): Promise<boolean> {
  return Boolean(await findAuthorProfileNote(parentItem));
}

function buildNoteHtml(result: AuthorProfileResult): string {
  const copy = getAuthorProfileCopy(result.language);
  const useCjkPunctuation = /^(zh|ja|ko)/i.test(result.language);
  const colon = useCjkPunctuation ? "：" : ": ";
  const separator = useCjkPunctuation ? "；" : "; ";
  const sourceNames = result.sources
    .filter((source) => source.ok)
    .map((source) => source.name)
    .join(" / ");
  const sourceText = sourceNames || copy.defaultSource;
  const title = result.noteTitle || copy.noteTitle;
  const meta = [
    `<p dir="${copy.dir}"><!-- ${NOTE_MARKER} --><strong>${title}</strong></p>`,
    `<p dir="${copy.dir}"><small>AIdea ${copy.metaGeneratedAt}${colon}${result.generatedAt}${separator}${copy.metaModel}${colon}${result.model || "default"}${separator}${copy.metaSources}${colon}${sourceText}</small></p>`,
    "<hr/>",
  ].join("");
  return `${meta}${normalizeRenderedHeadingLevel(renderMarkdownForNote(result.markdown))}`;
}

function normalizeRenderedHeadingLevel(html: string): string {
  return String(html || "")
    .replace(/<h4(\s[^>]*)?>/gi, "<h3$1>")
    .replace(/<\/h4>/gi, "</h3>");
}

export async function saveAuthorProfileNote(
  parentItem: Zotero.Item,
  result: AuthorProfileResult,
): Promise<"created" | "updated"> {
  const html = buildNoteHtml(result);
  const existing = await findAuthorProfileNote(parentItem);
  if (existing) {
    existing.setNote(html);
    await existing.saveTx();
    return "updated";
  }

  const note = new Zotero.Item("note");
  note.libraryID = parentItem.libraryID;
  note.parentID = parentItem.id;
  note.setNote(html);
  try {
    (note as any).addTag?.(getAuthorProfileCopy(result.language).noteTag);
  } catch {
    /* tag is optional */
  }
  await note.saveTx();
  return "created";
}
