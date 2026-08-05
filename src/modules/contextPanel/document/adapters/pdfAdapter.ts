import type { DocumentAdapter, DocumentExtraction } from "../types";
import {
  getAttachmentContentType,
  getAttachmentSourceRevision,
  getDocumentTitle,
} from "./shared";

export const PDF_CONTENT_TYPE = "application/pdf";

const capabilities: DocumentAdapter["capabilities"] = {
  selectionText: true,
  panelChat: true,
  structuredSections: false,
  navigableLocators: false,
  screenshot: true,
  fullDocumentTranslation: true,
};

async function extractPdfText(item: Zotero.Item): Promise<DocumentExtraction> {
  let text = "";
  try {
    const result = await Zotero.PDFWorker.getFullText(item.id);
    if (result?.text) {
      text = result.text;
    }
  } catch (err) {
    ztoolkit.log("PDF extraction failed:", err);
  }

  return {
    text,
    completeness: text ? "complete" : "unavailable",
  };
}

export const pdfDocumentAdapter: DocumentAdapter = {
  kind: "pdf",
  contentTypes: [PDF_CONTENT_TYPE],
  capabilities,
  presentation: {
    noun: "paper",
    fullTextHeading: "Paper Full Text (complete document):",
    excerptsHeading: "Paper Text:",
    relevantSectionsNotice: "Relevant sections extracted from the document",
  },
  contextPolicy: {
    strategy: "full-or-retrieval",
    useEmbeddings: true,
    eagerWarmup: true,
  },
  selectionContextPolicy: {
    strategy: "cold-start-cache",
    allowUnattributedSelection: false,
  },
  supports(item): item is Zotero.Item {
    return Boolean(
      item?.isAttachment?.() &&
      getAttachmentContentType(item) === PDF_CONTENT_TYPE,
    );
  },
  describe(item) {
    return {
      item,
      kind: "pdf",
      title: getDocumentTitle(item),
      capabilities,
    };
  },
  getSourceRevision: getAttachmentSourceRevision,
  extract: extractPdfText,
};
