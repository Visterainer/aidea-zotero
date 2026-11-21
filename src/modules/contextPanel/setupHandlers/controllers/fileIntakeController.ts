import {
  MAX_SELECTED_IMAGES,
  MAX_UPLOAD_PDF_SIZE_BYTES,
} from "../../constants";
import type { ChatAttachment } from "../../types";
import {
  readFileAsDataURL,
  readFileAsText,
  readFileAsArrayBuffer,
  extractTextFromPdfPath,
  extractTextFromStoredFile,
} from "../../../../utils/fileExtraction";
import { getZoteroItem } from "../../../../utils/zoteroItems";
import { getPanelI18n } from "../../i18n";

type StatusLevel = "ready" | "warning" | "error";

type FileIntakeControllerDeps = {
  body: Element;
  getItem: () => Zotero.Item | null;
  getCurrentModel: () => string;
  getHistoryGeneration: () => number;
  isScreenshotUnsupportedModel: (modelName: string) => boolean;
  optimizeImageDataUrl: (win: Window, dataUrl: string) => Promise<string>;
  persistAttachmentBlob: (
    fileName: string,
    bytes: Uint8Array,
  ) => Promise<{ storedPath: string; contentHash: string }>;
  selectedImageCache: Map<number, string[]>;
  selectedFileAttachmentCache: Map<number, ChatAttachment[]>;
  updateImagePreview: () => void;
  updateFilePreview: () => void;
  scheduleAttachmentGc: () => void;
  setStatusMessage?: (message: string, level: StatusLevel) => void;
  onFileStateChanged?: (itemId: number, fileIds: string[]) => void;
};

const createAttachmentId = () =>
  `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const CLIPBOARD_DATA_IMAGE_RE =
  /data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)/gi;

function dataUrlToFile(dataUrl: string, index: number): File | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=]+)$/i.exec(
    dataUrl.trim(),
  );
  if (!match) return null;
  const mimeType = match[1] || "image/png";
  const extension = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "png";
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new File(
      [bytes],
      `pasted-image-${Date.now()}-${index}.${extension}`,
      {
        type: mimeType,
        lastModified: Date.now(),
      },
    );
  } catch (err) {
    ztoolkit.log("LLM: Failed to decode pasted data URL image", err);
    return null;
  }
}

function extractDataUrlImageFiles(text: string, startIndex: number): File[] {
  const files: File[] = [];
  const seen = new Set<string>();
  CLIPBOARD_DATA_IMAGE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CLIPBOARD_DATA_IMAGE_RE.exec(text))) {
    const dataUrl = match[0];
    if (seen.has(dataUrl)) continue;
    seen.add(dataUrl);
    const file = dataUrlToFile(dataUrl, startIndex + files.length + 1);
    if (file) files.push(file);
  }
  return files;
}

const isTextLikeFile = (file: File): boolean => {
  const lowerName = (file.name || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();
  if (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.includes("xml") ||
    mime.includes("javascript") ||
    mime.includes("typescript")
  ) {
    return true;
  }
  return /\.(md|markdown|txt|json|ya?ml|xml|html?|css|scss|less|js|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|go|rs|rb|php|swift|kt|scala|sh|bash|zsh|sql|r|m|mm|lua|toml|ini|cfg|conf)$/i.test(
    lowerName,
  );
};

const resolveAttachmentCategory = (file: File): ChatAttachment["category"] => {
  const lowerName = (file.name || "").toLowerCase();
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf" || lowerName.endsWith(".pdf")) return "pdf";
  if (/\.(md|markdown)$/i.test(lowerName)) return "markdown";
  if (
    /\.(js|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|go|rs|rb|php|swift|kt|scala|sh|bash|zsh|sql|r|m|mm|lua)$/i.test(
      lowerName,
    )
  ) {
    return "code";
  }
  if (isTextLikeFile(file)) return "text";
  return "file";
};

// File extraction logic moved to src/utils/fileExtraction.ts

export function isFileDragEvent(event: DragEvent): boolean {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) return false;
  if (dataTransfer.files && dataTransfer.files.length > 0) return true;
  const types = Array.from(dataTransfer.types || []);
  return types.includes("Files");
}

export function isZoteroItemDragEvent(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes("zotero/item");
}

export function getSelectedZoteroItems(): Zotero.Item[] {
  try {
    const pane = Zotero.getActiveZoteroPane?.() as
      | {
          getSelectedItems?: () => Zotero.Item[];
          itemsView?: { getSelectedItems?: (asIDs?: boolean) => Zotero.Item[] };
        }
      | undefined;
    const items =
      pane?.getSelectedItems?.() || pane?.itemsView?.getSelectedItems?.() || [];
    return Array.isArray(items) ? items.filter(Boolean) : [];
  } catch (_err) {
    void _err;
  }
  return [];
}

/** Read only Zotero's item-ID payload. Neither files, text nor the current
 * selection are evidence of which items were dropped on the Translate tab. */
export function getZoteroDragItemIds(event: DragEvent): number[] {
  if (!isZoteroItemDragEvent(event)) return [];
  const raw = event.dataTransfer?.getData("zotero/item")?.trim() || "";
  if (!/^\d+(?:[\s,]+\d+)*$/.test(raw)) return [];
  return [...new Set(raw.split(/[\s,]+/).map(Number))].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
}

function getChatDragItemIds(event: DragEvent): number[] {
  // Chat intake historically also accepts serialized selections and expands
  // partial drags. Keep that behavior separate from explicit batch intake.
  const raw = event.dataTransfer?.getData("zotero/item") || "";
  const rawIds = Array.from(raw.matchAll(/\d+/g))
    .map((match) => Number.parseInt(match[0], 10))
    .filter((id) => Number.isFinite(id) && id > 0);
  const selectedIds = getSelectedZoteroItems()
    .map((item) => Number(item?.id || 0))
    .filter((id) => Number.isFinite(id) && id > 0);
  const selectedSet = new Set(selectedIds);
  if (
    selectedIds.length > rawIds.length &&
    (!rawIds.length || rawIds.some((id) => selectedSet.has(id)))
  ) {
    return Array.from(selectedSet);
  }
  return Array.from(new Set(rawIds));
}

function inferMimeType(fileName: string, fallback: string): string {
  const normalizedFallback = (fallback || "").trim();
  if (normalizedFallback) return normalizedFallback;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown"))
    return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/octet-stream";
}

function getFileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop()?.trim() || "document";
}

async function readAttachmentAsFile(
  attachment: Zotero.Item,
): Promise<File | null> {
  const filePath = await attachment.getFilePathAsync();
  if (!filePath) return null;
  const bytes: Uint8Array = await IOUtils.read(filePath);
  const fileName =
    (attachment as unknown as { attachmentFilename?: string })
      .attachmentFilename ||
    getFileNameFromPath(filePath) ||
    "document";
  const mimeType = inferMimeType(
    fileName,
    (attachment as unknown as { attachmentContentType?: string })
      .attachmentContentType || "",
  );
  return new File([bytes], fileName, { type: mimeType });
}

function isReadableLocalAttachment(
  item: Zotero.Item | null | undefined,
): boolean {
  if (!item?.isAttachment?.()) return false;
  const contentType =
    (item as unknown as { attachmentContentType?: string })
      .attachmentContentType || "";
  if (contentType === "text/x-moz-url") return false;
  return true;
}

export async function resolveZoteroItemFiles(
  event: DragEvent,
): Promise<File[]> {
  const ids = getChatDragItemIds(event);
  const files: File[] = [];
  const seenAttachmentIds = new Set<number>();
  for (const id of ids) {
    try {
      const zoteroItem = getZoteroItem(id);
      if (!zoteroItem) continue;
      const candidateAttachments: Zotero.Item[] = [];
      if (isReadableLocalAttachment(zoteroItem)) {
        candidateAttachments.push(zoteroItem);
      } else if (zoteroItem.isRegularItem()) {
        const attachmentIds = zoteroItem.getAttachments();
        for (const attId of attachmentIds) {
          const att = getZoteroItem(attId);
          if (att && isReadableLocalAttachment(att)) {
            candidateAttachments.push(att);
          }
        }
      }
      for (const attachment of candidateAttachments) {
        const attachmentId = Number(attachment.id || 0);
        if (attachmentId > 0 && seenAttachmentIds.has(attachmentId)) continue;
        const file = await readAttachmentAsFile(attachment);
        if (!file) continue;
        if (attachmentId > 0) seenAttachmentIds.add(attachmentId);
        files.push(file);
      }
    } catch (err) {
      ztoolkit.log("LLM: Failed to resolve Zotero item drag", id, err);
    }
  }
  return files;
}

export function extractFilesFromClipboard(event: ClipboardEvent): File[] {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return [];
  const files: File[] = [];
  if (clipboardData.files && clipboardData.files.length > 0) {
    files.push(...Array.from(clipboardData.files));
  }
  const items = Array.from(clipboardData.items || []);
  for (const item of items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;
    const duplicated = files.some(
      (existing) =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.type === file.type,
    );
    if (!duplicated) files.push(file);
  }
  for (const type of ["text/html", "text/plain", "text/uri-list"]) {
    const text = clipboardData.getData(type);
    if (!text) continue;
    for (const file of extractDataUrlImageFiles(text, files.length)) {
      const duplicated = files.some(
        (existing) =>
          existing.size === file.size && existing.type === file.type,
      );
      if (!duplicated) files.push(file);
    }
  }
  return files;
}

export function createFileIntakeController(deps: FileIntakeControllerDeps): {
  processIncomingFiles: (incomingFiles: File[]) => Promise<void>;
} {
  const processIncomingFiles = async (incomingFiles: File[]) => {
    const labels = getPanelI18n();
    const item = deps.getItem();
    if (!item || !incomingFiles.length) return;
    // Local copies may outlive a history clear while a file is being read,
    // stored, or extracted. Never publish such a copy into a reused key.
    const generation = deps.getHistoryGeneration();
    const wasCleared = () => generation !== deps.getHistoryGeneration();
    const imageUnsupported = deps.isScreenshotUnsupportedModel(
      deps.getCurrentModel(),
    );
    let addedCount = 0;
    let replacedCount = 0;
    let rejectedPdfCount = 0;
    let skippedImageCount = 0;
    let failedPersistCount = 0;
    let failedPdfTextExtractionCount = 0;

    for (const [index, file] of incomingFiles.entries()) {
      if (wasCleared()) return;
      const fileName =
        (file.name || "").trim() || `uploaded-file-${Date.now()}-${index + 1}`;
      const lowerName = fileName.toLowerCase();
      const isPdf =
        file.type === "application/pdf" || lowerName.endsWith(".pdf");
      if (isPdf && file.size > MAX_UPLOAD_PDF_SIZE_BYTES) {
        rejectedPdfCount += 1;
        continue;
      }
      const normalizedFile = new File([file], fileName, {
        type: file.type || "application/octet-stream",
        lastModified: file.lastModified || Date.now(),
      });
      const category = resolveAttachmentCategory(normalizedFile);
      if (category === "image") {
        const currentImages = deps.selectedImageCache.get(item.id) || [];
        if (imageUnsupported || currentImages.length >= MAX_SELECTED_IMAGES) {
          skippedImageCount += 1;
          continue;
        }
        try {
          const dataUrl = await readFileAsDataURL(deps.body, normalizedFile);
          if (wasCleared()) return;
          const panelWindow = deps.body.ownerDocument?.defaultView;
          const optimizedDataUrl = panelWindow
            ? await deps.optimizeImageDataUrl(panelWindow, dataUrl)
            : dataUrl;
          if (wasCleared()) return;
          const liveImages = [...(deps.selectedImageCache.get(item.id) || [])];
          if (liveImages.length >= MAX_SELECTED_IMAGES) {
            skippedImageCount += 1;
            continue;
          }
          liveImages.push(optimizedDataUrl);
          deps.selectedImageCache.set(item.id, liveImages);
          deps.updateImagePreview();
          addedCount += 1;
        } catch (err) {
          skippedImageCount += 1;
          ztoolkit.log("LLM: Failed to read image upload", err);
        }
        continue;
      }

      // --- Insert a processing placeholder into the live cache immediately ---
      const currentFiles = [
        ...(deps.selectedFileAttachmentCache.get(item.id) || []),
      ];
      const existingPlaceholderIndex = currentFiles.findIndex(
        (entry) =>
          entry &&
          typeof entry.name === "string" &&
          entry.name.trim().toLowerCase() === fileName.toLowerCase(),
      );
      const entryId =
        existingPlaceholderIndex >= 0
          ? currentFiles[existingPlaceholderIndex].id
          : createAttachmentId();
      const wasReplacement = existingPlaceholderIndex >= 0;
      const placeholderEntry: ChatAttachment = {
        id: entryId,
        name: fileName || "untitled",
        mimeType: normalizedFile.type || "application/octet-stream",
        sizeBytes: normalizedFile.size || 0,
        category,
        processing: true,
      };
      if (existingPlaceholderIndex >= 0) {
        currentFiles[existingPlaceholderIndex] = placeholderEntry;
      } else {
        currentFiles.push(placeholderEntry);
      }
      deps.selectedFileAttachmentCache.set(item.id, currentFiles);
      deps.updateFilePreview();

      // --- Persist the file FIRST so we have a storedPath for Zotero APIs ---
      let storedPath: string | undefined;
      let contentHash: string | undefined;
      try {
        const buffer = await readFileAsArrayBuffer(deps.body, normalizedFile);
        if (wasCleared()) return;
        const persisted = await deps.persistAttachmentBlob(
          fileName,
          new Uint8Array(buffer),
        );
        storedPath = persisted.storedPath;
        contentHash = persisted.contentHash;
      } catch (err) {
        if (wasCleared()) return;
        failedPersistCount += 1;
        ztoolkit.log("LLM: Failed to persist uploaded attachment", err);
        const liveFiles = (
          deps.selectedFileAttachmentCache.get(item.id) || []
        ).filter((e) => e.id !== entryId);
        deps.selectedFileAttachmentCache.set(item.id, liveFiles);
        deps.updateFilePreview();
        continue;
      }

      if (wasCleared()) return;
      // --- Extract text using the best available method ---
      let textContent: string | undefined;
      if (
        category === "markdown" ||
        category === "code" ||
        category === "text"
      ) {
        try {
          textContent = await readFileAsText(deps.body, normalizedFile);
        } catch (err) {
          ztoolkit.log("LLM: Failed to read text upload", err);
        }
        // If in-memory read failed, try from stored path
        if (!textContent && storedPath) {
          try {
            textContent = await extractTextFromStoredFile(
              storedPath,
              normalizedFile.type || "",
            );
          } catch (err) {
            ztoolkit.log("LLM: Failed to extract text from uploaded file", err);
          }
        }
      } else if (category === "pdf") {
        // Use Zotero's PDFWorker — same engine as Zotero's built-in PDF indexing
        if (storedPath) {
          try {
            textContent = await extractTextFromPdfPath(storedPath);
          } catch (err) {
            ztoolkit.log(
              "LLM: Failed to extract text from uploaded PDF via Zotero",
              err,
            );
          }
        }
        if (!textContent?.trim()) {
          failedPdfTextExtractionCount += 1;
        }
      } else if (category === "file" && storedPath) {
        // Try Zotero-based extraction for other file types (EPUB, HTML, etc.)
        try {
          textContent = await extractTextFromStoredFile(
            storedPath,
            normalizedFile.type || "",
          );
        } catch (err) {
          ztoolkit.log("LLM: Failed to extract text from uploaded file", err);
        }
      }

      if (wasCleared()) return;

      // Patch the live cache by entryId so concurrent uploads are not lost and
      // attachments removed/sent mid-extraction are never resurrected.
      const liveFiles = [
        ...(deps.selectedFileAttachmentCache.get(item.id) || []),
      ];
      const liveIndex = liveFiles.findIndex((e) => e.id === entryId);
      if (liveIndex < 0) continue;
      liveFiles[liveIndex] = {
        id: entryId,
        name: fileName || "untitled",
        mimeType: normalizedFile.type || "application/octet-stream",
        sizeBytes: normalizedFile.size || 0,
        category,
        textContent,
        storedPath,
        contentHash,
      };
      deps.selectedFileAttachmentCache.set(item.id, liveFiles);
      if (wasReplacement) {
        replacedCount += 1;
      } else {
        addedCount += 1;
      }
      deps.updateFilePreview();
    }

    if (wasCleared()) return;
    if (addedCount > 0 || replacedCount > 0) {
      deps.scheduleAttachmentGc();
    }

    deps.updateImagePreview();
    deps.updateFilePreview();

    // Notify caller about file state change for persistence.
    const finalFiles = deps.selectedFileAttachmentCache.get(item.id) || [];
    if (deps.onFileStateChanged && (addedCount > 0 || replacedCount > 0)) {
      deps.onFileStateChanged(
        item.id,
        finalFiles.map((f) => f.id),
      );
    }

    if (!deps.setStatusMessage) return;
    const warningParts: string[] = [];
    if (addedCount > 0 || replacedCount > 0) {
      warningParts.push(labels.uploadedAttachments(addedCount, replacedCount));
    }
    if (rejectedPdfCount > 0) {
      warningParts.push(labels.uploadSkippedLargePdfs(rejectedPdfCount));
    }
    if (skippedImageCount > 0) {
      warningParts.push(labels.uploadSkippedImages(skippedImageCount));
    }
    if (failedPersistCount > 0) {
      warningParts.push(labels.uploadPersistFailed(failedPersistCount));
    }
    if (failedPdfTextExtractionCount > 0) {
      warningParts.push(
        labels.pdfTextExtractionIncomplete(failedPdfTextExtractionCount),
      );
    }
    if (
      (addedCount > 0 || replacedCount > 0) &&
      (rejectedPdfCount > 0 ||
        skippedImageCount > 0 ||
        failedPersistCount > 0 ||
        failedPdfTextExtractionCount > 0)
    ) {
      deps.setStatusMessage(warningParts.join("; "), "warning");
      return;
    }
    if (addedCount > 0 || replacedCount > 0) {
      deps.setStatusMessage(
        labels.uploadedAttachments(addedCount, replacedCount),
        "ready",
      );
      return;
    }
    if (rejectedPdfCount > 0) {
      deps.setStatusMessage(
        labels.uploadSkippedLargePdfs(rejectedPdfCount),
        "error",
      );
      return;
    }
    if (skippedImageCount > 0) {
      deps.setStatusMessage(
        labels.uploadSkippedImages(skippedImageCount),
        "warning",
      );
      return;
    }
    if (failedPersistCount > 0) {
      deps.setStatusMessage(
        labels.uploadPersistFailed(failedPersistCount),
        "error",
      );
    }
  };

  return { processIncomingFiles };
}
