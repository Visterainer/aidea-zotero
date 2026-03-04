import { renderMarkdownForNote } from "../../utils/markdown";
import {
  sanitizeText,
  escapeNoteHtml,
  getCurrentLocalTimestamp,
} from "./textUtils";
import { MAX_SELECTED_IMAGES } from "./constants";
import {
  getTrackedAssistantNoteForParent,
  removeAssistantNoteMapEntry,
  rememberAssistantNoteForParent,
} from "./prefHelpers";
import type { Message } from "./types";

function resolveParentItemForNote(item: Zotero.Item): Zotero.Item | null {
  if (item.isAttachment() && item.parentID) {
    const parent = Zotero.Items.get(item.parentID) || null;
    if (parent && parent.isRegularItem()) return parent;
    return null;
  }
  if (item.isRegularItem()) return item;
  return null;
}

function buildAssistantNoteHtml(
  contentText: string,
  modelName: string,
): string {
  const response = sanitizeText(contentText || "").trim();
  const source = modelName.trim() || "unknown";
  const timestamp = getCurrentLocalTimestamp();
  let responseHtml = "";
  try {
    // Use Zotero note-editor native math format so that note.setNote()
    // loads math correctly through ProseMirror's schema parser.
    responseHtml = renderMarkdownForNote(response);
  } catch (err) {
    ztoolkit.log("Note markdown render error:", err);
    responseHtml = escapeNoteHtml(response).replace(/\n/g, "<br/>");
  }
  return `<p><strong>${escapeNoteHtml(timestamp)}</strong></p><p><strong>${escapeNoteHtml(source)}:</strong></p><div>${responseHtml}</div><hr/><p>Written by AIdea plugin</p>`;
}

function renderChatMessageHtmlForNote(text: string): string {
  const safeText = sanitizeText(text || "").trim();
  if (!safeText) return "";
  try {
    // Reuse the same markdown-to-note rendering path as single-response save.
    return renderMarkdownForNote(safeText);
  } catch (err) {
    ztoolkit.log("Chat history markdown render error:", err);
    return escapeNoteHtml(safeText).replace(/\n/g, "<br/>");
  }
}

function normalizeScreenshotImagesForNote(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  const out: string[] = [];
  for (const raw of images) {
    if (typeof raw !== "string") continue;
    const src = raw.trim();
    if (!src) continue;
    // Persist only embedded image data URLs; blob/object URLs are ephemeral.
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(src)) continue;
    out.push(src);
    if (out.length >= MAX_SELECTED_IMAGES) break;
  }
  return out;
}

function formatScreenshotEmbeddedLabel(count: number): string {
  return `Screenshots (${count}) are embedded below`;
}

function buildScreenshotImagesHtmlForNote(images: string[]): string {
  if (!images.length) return "";
  const label = formatScreenshotEmbeddedLabel(images.length);
  const blocks = images
    .map((src, index) => {
      const alt = `Screenshot ${index + 1}`;
      return `<p><img src="${escapeNoteHtml(src)}" alt="${escapeNoteHtml(alt)}"/></p>`;
    })
    .join("");
  return `<div><p>${escapeNoteHtml(label)}</p>${blocks}</div>`;
}

export function buildChatHistoryNotePayload(messages: Message[]): {
  noteHtml: string;
  noteText: string;
} {
  const timestamp = getCurrentLocalTimestamp();
  const textLines: string[] = [];
  const htmlBlocks: string[] = [];
  for (const msg of messages) {
    const text = sanitizeText(msg.text || "").trim();
    const screenshotImages = normalizeScreenshotImagesForNote(
      msg.screenshotImages,
    );
    const screenshotCount = screenshotImages.length;
    if (!text && !screenshotCount) continue;
    const speaker =
      msg.role === "user"
        ? "user"
        : sanitizeText(msg.modelName || "").trim() || "model";
    const screenshotHtml =
      msg.role === "user"
        ? buildScreenshotImagesHtmlForNote(screenshotImages)
        : "";
    const rendered = renderChatMessageHtmlForNote(text);
    if (!rendered && !screenshotHtml) continue;
    textLines.push(`${speaker}: ${text}`);
    const renderedBlock = rendered ? `<div>${rendered}</div>` : "";
    htmlBlocks.push(
      `<p><strong>${escapeNoteHtml(speaker)}:</strong></p>${renderedBlock}${screenshotHtml}`,
    );
  }
  const noteText = textLines.join("\n\n");
  const bodyHtml = htmlBlocks.join("<hr/>");
  return {
    noteText,
    noteHtml: `<p><strong>Chat history saved at ${escapeNoteHtml(timestamp)}</strong></p><div>${bodyHtml}</div><hr/><p>Written by AIdea plugin</p>`,
  };
}

function appendAssistantAnswerToNoteHtml(
  existingHtml: string,
  newAnswerHtml: string,
): string {
  const base = (existingHtml || "").trim();
  const addition = (newAnswerHtml || "").trim();
  if (!base) return addition;
  if (!addition) return base;
  return `${base}<hr/>${addition}`;
}

export async function createNoteFromAssistantText(
  item: Zotero.Item,
  contentText: string,
  modelName: string,
): Promise<"created" | "appended"> {
  const parentItem = resolveParentItemForNote(item);
  const parentId = parentItem?.id;

  // Always render from the plain-text / markdown source via
  // renderMarkdownForNote.  This produces clean HTML that Zotero's
  // ProseMirror note-editor can reliably parse.  (The previous approach
  // of injecting rendered DOM HTML from the bubble was fragile — KaTeX
  // span trees and sanitised classless wrappers were mostly dropped by
  // ProseMirror.)
  const html = buildAssistantNoteHtml(contentText, modelName);

  // Try to find an existing tracked note for this parent item.
  // If one exists and is still valid, append the new content to it.
  if (parentId) {
    const existingNote = getTrackedAssistantNoteForParent(parentId);
    if (existingNote) {
      try {
        const appendedHtml = appendAssistantAnswerToNoteHtml(
          existingNote.getNote() || "",
          html,
        );
        existingNote.setNote(appendedHtml);
        await existingNote.saveTx();
        ztoolkit.log(
          `LLM: Appended to existing note ${existingNote.id} for parent ${parentId}`,
        );
        return "appended";
      } catch (appendErr) {
        // If appending fails (e.g. note was deleted externally), fall through
        // to create a new note instead.
        ztoolkit.log(
          "LLM: Failed to append to existing note, creating new:",
          appendErr,
        );
        removeAssistantNoteMapEntry(parentId);
      }
    }
  }

  // No existing tracked note (or append failed) – create a brand-new note.
  const note = new Zotero.Item("note");
  note.libraryID = (parentItem || item).libraryID;
  if (parentId) {
    note.parentID = parentId;
  }
  note.setNote(html);
  const saveResult = await note.saveTx();
  // saveTx() returns the new item ID (number) on creation.
  // Also check note.id as a fallback.
  const newNoteId =
    typeof saveResult === "number" && saveResult > 0 ? saveResult : note.id;
  if (newNoteId && newNoteId > 0) {
    if (parentId) {
      rememberAssistantNoteForParent(parentId, newNoteId);
    }
    ztoolkit.log(`LLM: Created new note ${newNoteId} for parent ${parentId ?? "standalone"}`);
  } else {
    ztoolkit.log(
      "LLM: Warning – note was saved but could not determine note ID",
    );
  }
  return "created";
}

export async function createNoteFromChatHistory(
  item: Zotero.Item,
  history: Message[],
): Promise<void> {
  const parentItem = resolveParentItemForNote(item);
  const parentId = parentItem?.id;
  // Chat history export always creates a brand-new, standalone note.
  // It does NOT append to the tracked assistant note and does NOT
  // update the tracked note ID, so single-response "Save as note"
  // keeps its own append chain undisturbed.
  const note = new Zotero.Item("note");
  note.libraryID = (parentItem || item).libraryID;
  if (parentId) {
    note.parentID = parentId;
  }
  note.setNote(buildChatHistoryNotePayload(history).noteHtml);
  await note.saveTx();
  ztoolkit.log(
    `LLM: Created chat history note for parent ${parentId ?? "standalone"}`,
  );
}

export async function createStandaloneNoteFromChatHistory(
  libraryID: number,
  history: Message[],
): Promise<void> {
  const normalizedLibraryID = Number.isFinite(libraryID)
    ? Math.floor(libraryID)
    : 0;
  if (normalizedLibraryID <= 0) {
    throw new Error("Invalid library ID for standalone note export");
  }
  const note = new Zotero.Item("note");
  note.libraryID = normalizedLibraryID;
  note.setNote(buildChatHistoryNotePayload(history).noteHtml);
  await note.saveTx();
  ztoolkit.log(
    `LLM: Created standalone chat history note in library ${normalizedLibraryID}`,
  );
}
