const PDF_TEXT_MAX_CHARS = 50000;

export const readFileAsDataURL = async (
  owner: Element,
  file: File,
): Promise<string> => {
  const view = owner.ownerDocument?.defaultView;
  const FileReaderCtor = view?.FileReader || globalThis.FileReader;
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReaderCtor();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Invalid data URL result"));
    };
    reader.onerror = () =>
      reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
};

export const readFileAsText = async (
  owner: Element,
  file: File,
): Promise<string> => {
  const view = owner.ownerDocument?.defaultView;
  const FileReaderCtor = view?.FileReader || globalThis.FileReader;
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReaderCtor();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Invalid text result"));
    };
    reader.onerror = () =>
      reject(reader.error || new Error("File read failed"));
    reader.readAsText(file);
  });
};

export const readFileAsArrayBuffer = async (
  owner: Element,
  file: File,
): Promise<ArrayBuffer> => {
  const withArrayBuffer = file as File & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  if (typeof withArrayBuffer.arrayBuffer === "function") {
    return await withArrayBuffer.arrayBuffer();
  }
  const view = owner.ownerDocument?.defaultView;
  const FileReaderCtor = view?.FileReader || globalThis.FileReader;
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReaderCtor();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error("Invalid arrayBuffer result"));
    };
    reader.onerror = () =>
      reject(reader.error || new Error("File read failed"));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Extract text from a PDF stored at `filePath` using Zotero's built-in
 * PDFWorker — exactly the same engine that Zotero uses to index its own
 * PDF attachments. Falls back to Zotero.File or raw pdf.js when the
 * PDFWorker path is unavailable.
 */
export async function extractTextFromPdfPath(
  filePath: string,
): Promise<string | undefined> {
  // Strategy 1: Zotero.PDFWorker (the proven path for Zotero-managed PDFs)
  try {
    const PDFWorker = (Zotero as any).PDFWorker;
    if (PDFWorker) {
      // Try Zotero.Fulltext.getTextForFile first (higher-level API).
      const Fulltext = (Zotero as any).Fulltext;
      if (Fulltext?.getTextForFile) {
        const result = await Fulltext.getTextForFile(filePath);
        const text = typeof result === "string" ? result : result?.text;
        if (text && text.trim()) {
          ztoolkit.log(
            "LLM: PDF text extracted via Zotero.Fulltext.getTextForFile",
          );
          return text.slice(0, PDF_TEXT_MAX_CHARS);
        }
      }
      // Try PDFWorker.getFullText with a fake-ish path-based call
      if (typeof PDFWorker.getFullTextFromPath === "function") {
        const result = await PDFWorker.getFullTextFromPath(filePath);
        const text = typeof result === "string" ? result : result?.text;
        if (text && text.trim()) {
          ztoolkit.log(
            "LLM: PDF text extracted via PDFWorker.getFullTextFromPath",
          );
          return text.slice(0, PDF_TEXT_MAX_CHARS);
        }
      }
      // Try to import a temporary attachment item to leverage Zotero's pipeline
      try {
        const importedItem = await Zotero.Attachments.importFromFile({
          file: filePath,
          libraryID: Zotero.Libraries.userLibraryID,
          collections: [],
        });
        if (importedItem) {
          try {
            const result = await PDFWorker.getFullText(importedItem.id);
            const text = typeof result === "string" ? result : result?.text;
            if (text && text.trim()) {
              ztoolkit.log(
                "LLM: PDF text extracted via temporary Zotero Item + PDFWorker",
              );
              // Clean up the temporary item
              await importedItem.eraseTx();
              return text.slice(0, PDF_TEXT_MAX_CHARS);
            }
          } finally {
            // Always clean up even if extraction failed
            try {
              if (!importedItem.deleted) {
                await importedItem.eraseTx();
              }
            } catch {
              /* ignore cleanup errors */
            }
          }
        }
      } catch (importErr) {
        ztoolkit.log(
          "LLM: Temporary PDF import for text extraction failed",
          importErr,
        );
      }
    }
  } catch (err) {
    ztoolkit.log(
      "LLM: Zotero PDFWorker extraction failed, trying fallback",
      err,
    );
  }

  // Strategy 2: Direct pdf.js (original fallback)
  return extractTextFromPdfBuffer_fallback(filePath);
}

/**
 * Fallback: read the PDF file bytes and extract text via pdf.js.
 */
export async function extractTextFromPdfBuffer_fallback(
  filePath: string,
): Promise<string | undefined> {
  try {
    // Read file bytes
    let buffer: ArrayBuffer | undefined;
    const io = (globalThis as any).IOUtils;
    if (io?.read) {
      const data = await io.read(filePath);
      if (data instanceof Uint8Array) {
        buffer = data.buffer as ArrayBuffer;
      }
    }
    if (!buffer) {
      const zFile = (Zotero as any).File;
      if (zFile?.getBinaryContentsAsync) {
        const raw = await zFile.getBinaryContentsAsync(filePath);
        if (raw instanceof ArrayBuffer) {
          buffer = raw;
        } else if (raw instanceof Uint8Array) {
          buffer = raw.buffer as ArrayBuffer;
        } else if (typeof raw === "string") {
          // Binary string: each charCodeAt is a raw byte value.
          // TextEncoder would corrupt bytes > 0x7F by encoding them as
          // multi-byte UTF-8 sequences.
          const bytes = new Uint8Array(raw.length);
          for (let i = 0; i < raw.length; i++) {
            bytes[i] = raw.charCodeAt(i) & 0xff;
          }
          buffer = bytes.buffer;
        }
      }
    }
    if (!buffer) return undefined;

    let pdfjsLib: any = null;
    try {
      pdfjsLib = (ChromeUtils as any).importESModule?.(
        "resource://zotero/pdfjs/pdf.mjs",
      );
    } catch {
      /* ignore */
    }
    if (!pdfjsLib?.getDocument) {
      try {
        pdfjsLib = (ChromeUtils as any).importESModule?.(
          "resource://pdf.js/pdf.mjs",
        );
      } catch {
        /* ignore */
      }
    }
    if (!pdfjsLib?.getDocument) {
      const globalAny = globalThis as any;
      pdfjsLib = globalAny.pdfjsLib || globalAny.pdfjs;
    }
    if (!pdfjsLib?.getDocument) {
      ztoolkit.log("LLM: pdf.js not available for fallback text extraction");
      return undefined;
    }

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const pdfDoc = await loadingTask.promise;
    const pageTexts: string[] = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (totalChars >= PDF_TEXT_MAX_CHARS) break;
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str || "")
        .join(" ")
        .trim();
      if (pageText) {
        pageTexts.push(pageText);
        totalChars += pageText.length;
      }
    }
    const result = pageTexts.join("\n\n").slice(0, PDF_TEXT_MAX_CHARS);
    return result || undefined;
  } catch (err) {
    ztoolkit.log("LLM: PDF fallback text extraction failed", err);
    return undefined;
  }
}

/**
 * Extract text from non-PDF stored files (HTML, EPUB, plain text, etc.)
 * using Zotero.File APIs. Returns undefined if extraction fails.
 */
export async function extractTextFromStoredFile(
  filePath: string,
  mimeType: string,
): Promise<string | undefined> {
  try {
    const zFile = (Zotero as any).File;
    if (!zFile) return undefined;

    const lower = (mimeType || "").toLowerCase();

    // HTML / XHTML — strip tags to get raw text
    if (lower.includes("html") || lower.includes("xhtml")) {
      let htmlContent: string | undefined;
      if (zFile.getContentsAsync) {
        htmlContent = String((await zFile.getContentsAsync(filePath)) || "");
      }
      if (htmlContent) {
        // Simple tag stripper
        const text = htmlContent
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
        return text.slice(0, PDF_TEXT_MAX_CHARS) || undefined;
      }
    }

    // EPUB — try Zotero.Fulltext if available
    if (
      lower === "application/epub+zip" ||
      filePath.toLowerCase().endsWith(".epub")
    ) {
      const Fulltext = (Zotero as any).Fulltext;
      if (Fulltext?.getTextForFile) {
        const result = await Fulltext.getTextForFile(filePath);
        const text = typeof result === "string" ? result : result?.text;
        if (text && text.trim()) {
          return text.slice(0, PDF_TEXT_MAX_CHARS);
        }
      }
    }

    // Plain text, XML, JSON, etc. — direct read
    if (
      lower.startsWith("text/") ||
      lower.includes("json") ||
      lower.includes("xml") ||
      lower.includes("javascript") ||
      lower.includes("typescript")
    ) {
      if (zFile.getContentsAsync) {
        const text = String((await zFile.getContentsAsync(filePath)) || "");
        return text.slice(0, PDF_TEXT_MAX_CHARS) || undefined;
      }
    }

    return undefined;
  } catch (err) {
    ztoolkit.log("LLM: extractTextFromStoredFile failed", err);
    return undefined;
  }
}
