import type {
  DocumentLocator,
  DocumentKind,
  DocumentCompleteness,
} from "./types";

export type EvidenceRef = {
  id: string;
  itemId: number;
  attachmentId?: string;
  itemKey?: string;
  libraryId?: number;
  libraryType?: string;
  groupId?: number;
  title: string;
  kind?: DocumentKind;
  sourceRevision?: string;
  /** Portable content hash, checked again before using imported positions. */
  documentHash?: string;
  segmentId?: string;
  text: string;
  locator?: DocumentLocator;
};
export type DocumentContextResult = {
  text: string;
  evidenceRefs: EvidenceRef[];
  coverage: {
    extraction: DocumentCompleteness;
    supplied: "full" | "excerpts" | "abstract" | "unavailable";
  };
  budgetUsage: number;
};
export type SummaryCheckpoint = {
  text: string;
  coveredMessageIds: number[];
};
