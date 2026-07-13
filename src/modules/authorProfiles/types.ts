export type AuthorProfileSourceName =
  | "Zotero"
  | "PDF"
  | "OpenAlex"
  | "Semantic Scholar"
  | "Crossref"
  | "PubMed Central";

export type PaperAuthor = {
  name: string;
  givenName?: string;
  familyName?: string;
  sequence?: number;
  affiliations: string[];
  emails: string[];
  orcid?: string;
  openAlexId?: string;
  semanticScholarId?: string;
  isCorresponding?: boolean;
  correspondenceSources: AuthorProfileSourceName[];
  evidence: string[];
  metrics: {
    worksCount?: number;
    citedByCount?: number;
    paperCount?: number;
    citationCount?: number;
    hIndex?: number;
  };
};

export type PaperMetadata = {
  itemId: number;
  libraryId: number;
  itemType?: string;
  title: string;
  doi: string;
  url?: string;
  extra?: string;
  year?: string;
  publicationTitle?: string;
  abstractNote?: string;
  creators: PaperAuthor[];
};

export type SourceResult = {
  name: AuthorProfileSourceName;
  ok: boolean;
  detail: string;
};

export type AuthorContact = {
  name?: string;
  email: string;
  affiliation?: string;
  source: AuthorProfileSourceName;
  evidence: string;
};

export type CorrespondingAuthorResolution = {
  status: "explicit" | "inferred" | "not_found";
  reason: string;
  isPreprintLike: boolean;
};

export type AuthorProfileInput = {
  metadata: PaperMetadata;
  authors: PaperAuthor[];
  selectedAuthors: PaperAuthor[];
  contactAuthors: AuthorContact[];
  resolution: CorrespondingAuthorResolution;
  sourceResults: SourceResult[];
  localSnippets: string[];
};

export type AuthorProfileResult = {
  markdown: string;
  noteTitle: string;
  language: string;
  generatedAt: string;
  model: string;
  sources: SourceResult[];
};

export type AuthorProfileStage =
  "metadata" | "sources" | "resolve" | "llm" | "note" | "done";

export type AuthorProfileProgress = {
  stage: AuthorProfileStage;
  message: string;
  fraction: number;
};

export type AuthorProfileProgressCallback = (
  progress: AuthorProfileProgress,
) => void;
