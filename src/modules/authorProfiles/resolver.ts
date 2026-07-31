import type {
  AuthorContact,
  AuthorProfileInput,
  AuthorProfileProgressCallback,
  CorrespondingAuthorResolution,
  PaperAuthor,
  PaperMetadata,
  SourceResult,
} from "./types";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  fetchCrossrefAuthors,
  fetchOpenAlexAuthorMetrics,
  fetchOpenAlexAuthors,
  fetchPubMedCentralAuthors,
  fetchSemanticAuthorMetrics,
  fetchSemanticScholarAuthors,
} from "./sources";
import { getAuthorProfileCopy } from "./i18n";
import {
  createAuthor,
  dedupeStrings,
  getAuthorProfileLanguage,
  lastNameKey,
  mergeIntoAuthor,
  normalizeDoi,
  normalizeName,
  normalizeWhitespace,
  truncateText,
} from "./utils";

function getField(item: Zotero.Item, field: string): string {
  try {
    return normalizeWhitespace(item.getField(field));
  } catch {
    return "";
  }
}

function extractYear(item: Zotero.Item): string | undefined {
  const raw =
    getField(item, "year") ||
    getField(item, "date") ||
    getField(item, "issued");
  const match = raw.match(/\b(1[6-9]\d{2}|20\d{2}|21\d{2})\b/);
  return match?.[1];
}

function readCreators(item: Zotero.Item): PaperAuthor[] {
  let creators: any[];
  try {
    creators = Array.isArray(item.getCreators?.()) ? item.getCreators() : [];
  } catch {
    creators = [];
  }
  return creators
    .filter((creator) => {
      const creatorType = String(creator?.creatorType || "").toLowerCase();
      return !creatorType || creatorType === "author";
    })
    .map((creator, index) => {
      const givenName = normalizeWhitespace(creator?.firstName);
      const familyName = normalizeWhitespace(creator?.lastName);
      const name =
        normalizeWhitespace(creator?.name) ||
        normalizeWhitespace([givenName, familyName].filter(Boolean).join(" "));
      return createAuthor({
        name,
        givenName,
        familyName,
        sequence: index + 1,
      });
    })
    .filter((author) => author.name);
}

export function readPaperMetadata(item: Zotero.Item): PaperMetadata {
  return {
    itemId: item.id,
    libraryId: item.libraryID,
    itemType: normalizeWhitespace((item as any).itemType),
    title: getField(item, "title"),
    doi: normalizeDoi(getField(item, "DOI")),
    url: getField(item, "url"),
    extra: getField(item, "extra"),
    year: extractYear(item),
    publicationTitle:
      getField(item, "publicationTitle") ||
      getField(item, "journalAbbreviation"),
    abstractNote: getField(item, "abstractNote"),
    creators: readCreators(item),
  };
}

function getPdfAttachments(item: Zotero.Item): Zotero.Item[] {
  const out: Zotero.Item[] = [];
  const pushIfPdf = (candidate: Zotero.Item | false | null | undefined) => {
    if (
      candidate &&
      candidate.isAttachment?.() &&
      candidate.attachmentContentType === "application/pdf"
    ) {
      out.push(candidate);
    }
  };
  if (item.isAttachment?.()) {
    pushIfPdf(item);
    return out;
  }
  try {
    for (const id of item.getAttachments?.() || []) {
      pushIfPdf(getZoteroItem(id));
    }
  } catch {
    /* no attachments */
  }
  return out;
}

function extractCorrespondenceSnippets(text: string): string[] {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  if (!normalized.trim()) return [];
  const patterns = [
    /correspond(?:ing|ence)? author/gi,
    /correspondence(?:\s+to)?/gi,
    /e-?mail\s*:/gi,
    /email\s*:/gi,
    /通讯作者/g,
    /通信作者/g,
  ];
  const snippets: string[] = [];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) && snippets.length < 8) {
      const start = Math.max(0, match.index - 420);
      const end = Math.min(normalized.length, match.index + 620);
      snippets.push(truncateText(normalized.slice(start, end), 900));
    }
  }
  return dedupeStrings(snippets).slice(0, 8);
}

function extractEmails(text: string): string[] {
  const emails = String(text || "").match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  );
  return dedupeStrings(emails || []);
}

function extractArxivId(text: string): string | undefined {
  const match = String(text || "").match(
    /\barXiv\s*:?\s*(\d{4}\.\d{4,5})(?:v\d+)?\b/i,
  );
  return match?.[1];
}

function extractDoiFromText(text: string): string | undefined {
  const match = String(text || "").match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
  return match ? normalizeDoi(match[0].replace(/[.,;)\]]+$/, "")) : undefined;
}

function extractFrontMatter(text: string): string {
  const normalized = String(text || "").replace(/\r\n?/g, "\n");
  const abstractIndex = normalized.search(/\n\s*abstract\b/i);
  return truncateText(
    abstractIndex > 0 ? normalized.slice(0, abstractIndex) : normalized,
    5000,
  );
}

function extractPdfAuthorContacts(
  metadata: PaperMetadata,
  text: string,
): AuthorContact[] {
  const frontMatter = extractFrontMatter(text);
  const emails = extractEmails(frontMatter);
  if (!emails.length) return [];

  const creators = metadata.creators;
  return emails.map((email, index) => ({
    name: emails.length === creators.length ? creators[index]?.name : undefined,
    email,
    source: "PDF",
    evidence: "PDF front matter author email block",
  }));
}

async function collectPdfEvidence(
  metadata: PaperMetadata,
  item: Zotero.Item,
): Promise<{
  correspondenceSnippets: string[];
  contextSnippets: string[];
  contacts: AuthorContact[];
  doi?: string;
  arxivId?: string;
  preprintLike: boolean;
}> {
  const correspondenceSnippets: string[] = [];
  const contextSnippets: string[] = [];
  const contacts: AuthorContact[] = [];
  let doi = "";
  let arxivId = "";
  let preprintLike = false;
  for (const pdf of getPdfAttachments(item).slice(0, 3)) {
    try {
      const result = await Zotero.PDFWorker.getFullText(pdf.id);
      const rawText = String(result?.text || "");
      const normalizedText = normalizeWhitespace(rawText);
      if (!normalizedText) continue;
      if (!doi) doi = extractDoiFromText(normalizedText) || "";
      if (!arxivId) arxivId = extractArxivId(rawText) || "";
      preprintLike =
        preprintLike ||
        /\barXiv\s*:|\barxiv\.org\b|\bpreprint\b/i.test(rawText);

      const frontMatter = extractFrontMatter(rawText);
      const pdfContacts = extractPdfAuthorContacts(metadata, rawText);
      contacts.push(...pdfContacts);
      if (pdfContacts.length) {
        contextSnippets.push(
          `PDF front matter author emails: ${pdfContacts
            .map((contact) =>
              contact.name
                ? `${contact.name} <${contact.email}>`
                : contact.email,
            )
            .join("; ")}`,
        );
      }
      if (frontMatter) {
        contextSnippets.push(
          `PDF front matter: ${truncateText(frontMatter, 900)}`,
        );
      }
      correspondenceSnippets.push(...extractCorrespondenceSnippets(rawText));
    } catch (err) {
      ztoolkit?.log?.("AIdea: author profile PDF text extraction failed", err);
    }
  }
  return {
    correspondenceSnippets: dedupeStrings(correspondenceSnippets).slice(0, 8),
    contextSnippets: dedupeStrings(contextSnippets).slice(0, 8),
    contacts: dedupeContacts(contacts).slice(0, 12),
    doi: doi || undefined,
    arxivId: arxivId || undefined,
    preprintLike,
  };
}

function dedupeContacts(contacts: AuthorContact[]): AuthorContact[] {
  const seen = new Set<string>();
  const out: AuthorContact[] = [];
  for (const contact of contacts) {
    const email = normalizeWhitespace(contact.email).toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({ ...contact, email: normalizeWhitespace(contact.email) });
  }
  return out;
}

function addAuthorToMap(map: Map<string, PaperAuthor>, author: PaperAuthor) {
  const key = normalizeName(author.name);
  if (!key) return;
  const existing =
    map.get(key) ||
    Array.from(map.values()).find((candidate) => {
      const candidateKey = normalizeName(candidate.name);
      return (
        candidateKey === key ||
        (lastNameKey(candidate.name) &&
          lastNameKey(candidate.name) === lastNameKey(author.name) &&
          Math.abs((candidate.sequence || 0) - (author.sequence || 0)) <= 1)
      );
    });
  if (existing) {
    mergeIntoAuthor(existing, author);
    return;
  }
  map.set(key, author);
}

function mergeAuthors(
  metadata: PaperMetadata,
  fetchedAuthors: PaperAuthor[],
): PaperAuthor[] {
  const map = new Map<string, PaperAuthor>();
  for (const author of metadata.creators) addAuthorToMap(map, author);
  for (const author of fetchedAuthors) addAuthorToMap(map, author);
  const authors = Array.from(map.values());
  authors.sort((a, b) => (a.sequence || 9999) - (b.sequence || 9999));
  return authors;
}

function extractExplicitCorrespondingNameFragments(
  snippets: string[],
): string[] {
  const fragments: string[] = [];
  const patterns = [
    /corresponding\s+authors?\s*[:：]\s*([^.\n]+)/gi,
    /correspondence\s+(?:to|should be addressed to)\s*[:：]?\s*([^.\n]+)/gi,
    /for\s+correspondence\s*[:：]\s*([^.\n]+)/gi,
    /通讯作者\s*[:：]\s*([^。\n]+)/g,
    /通信作者\s*[:：]\s*([^。\n]+)/g,
  ];
  for (const snippet of snippets) {
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(snippet))) {
        const raw = String(match[1] || "")
          .replace(/\b(?:e-?mail|email|mail|tel|phone)\b\s*[:：]?.*$/i, "")
          .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
          .replace(/\([^)]*@[^)]*\)/g, "")
          .trim();
        fragments.push(raw);
      }
    }
  }
  return dedupeStrings(
    fragments.flatMap((fragment) =>
      fragment
        .split(/\s*(?:;|,|\band\b|&|、|，|；)\s*/i)
        .map((part) => part.replace(/^[*†‡§\s]+|[*†‡§\s]+$/g, "")),
    ),
  ).filter((part) => normalizeName(part).split(/\s+/).length >= 2);
}

function matchAuthorsByNameFragments(
  authors: PaperAuthor[],
  fragments: string[],
): PaperAuthor[] {
  const matched: PaperAuthor[] = [];
  for (const fragment of fragments) {
    const fragmentName = normalizeName(fragment);
    if (!fragmentName) continue;
    const fragmentLast = lastNameKey(fragment);
    for (const author of authors) {
      const authorName = normalizeName(author.name);
      const authorLast = lastNameKey(author.name);
      if (
        authorName === fragmentName ||
        authorName.includes(fragmentName) ||
        fragmentName.includes(authorName) ||
        (fragmentLast &&
          authorLast === fragmentLast &&
          fragmentName.includes(authorLast))
      ) {
        if (!matched.includes(author)) matched.push(author);
      }
    }
  }
  return matched;
}

function applyContactEmails(authors: PaperAuthor[], contacts: AuthorContact[]) {
  for (const contact of contacts) {
    const contactName = normalizeName(contact.name);
    const matched = contactName
      ? authors.find((author) => normalizeName(author.name) === contactName) ||
        authors.find(
          (author) =>
            lastNameKey(author.name) &&
            lastNameKey(author.name) === lastNameKey(contact.name || ""),
        )
      : undefined;
    if (!matched) continue;
    mergeIntoAuthor(matched, {
      emails: [contact.email],
      evidence: [contact.evidence],
    });
  }
}

function applyLocalSnippetEvidence(authors: PaperAuthor[], snippets: string[]) {
  const emails = extractEmails(snippets.join("\n"));
  const explicitFragments = extractExplicitCorrespondingNameFragments(snippets);
  const explicitAuthors = matchAuthorsByNameFragments(
    authors,
    explicitFragments,
  );
  if (explicitAuthors.length) {
    for (const author of explicitAuthors) {
      mergeIntoAuthor(author, {
        isCorresponding: true,
        correspondenceSources: ["PDF"],
        emails,
        evidence: snippets
          .slice(0, 2)
          .map(
            (snippet) =>
              `PDF explicit correspondence: ${truncateText(snippet, 220)}`,
          ),
      });
    }
    return;
  }

  for (const snippet of snippets) {
    const snippetText = normalizeName(snippet);
    const matches = authors.filter((author) => {
      const fullName = normalizeName(author.name);
      const family = lastNameKey(author.name);
      return (
        (fullName && snippetText.includes(fullName)) ||
        (family && snippetText.includes(family))
      );
    });
    if (matches.length !== 1) continue;
    mergeIntoAuthor(matches[0], {
      isCorresponding: true,
      correspondenceSources: ["PDF"],
      emails,
      evidence: [`PDF correspondence clue: ${truncateText(snippet, 220)}`],
    });
  }
}

function detectPreprintLike(
  metadata: PaperMetadata,
  pdfEvidence: { arxivId?: string; preprintLike: boolean },
): boolean {
  if (pdfEvidence.preprintLike || pdfEvidence.arxivId) return true;
  const haystack = [
    metadata.itemType,
    metadata.title,
    metadata.publicationTitle,
    metadata.url,
    metadata.extra,
  ]
    .filter(Boolean)
    .join(" ");
  return /\barXiv\b|arxiv\.org|\bpreprint\b|\bbioRxiv\b|\bmedRxiv\b|\bSSRN\b|\bResearch Square\b/i.test(
    haystack,
  );
}

function chooseCorrespondingAuthors(
  authors: PaperAuthor[],
  options: { disableFallback: boolean; isPreprintLike: boolean },
): {
  authors: PaperAuthor[];
  resolution: CorrespondingAuthorResolution;
} {
  const pdfExplicit = authors.filter((author) =>
    author.correspondenceSources.includes("PDF"),
  );
  if (pdfExplicit.length) {
    return {
      authors: pdfExplicit.slice(0, 3),
      resolution: {
        status: "explicit",
        reason: "PDF evidence explicitly marks the corresponding author.",
        isPreprintLike: options.isPreprintLike,
      },
    };
  }
  const explicit = authors.filter((author) => author.isCorresponding);
  if (explicit.length) {
    return {
      authors: explicit.slice(0, 3),
      resolution: {
        status: "explicit",
        reason:
          "External metadata explicitly marks one or more corresponding authors.",
        isPreprintLike: options.isPreprintLike,
      },
    };
  }
  if (options.disableFallback) {
    return {
      authors: [],
      resolution: {
        status: "not_found",
        reason:
          "No explicit corresponding-author marker was found; last-author fallback was disabled for preprint or multi-email author-block evidence.",
        isPreprintLike: options.isPreprintLike,
      },
    };
  }
  const sorted = [...authors].sort(
    (a, b) => (a.sequence || 9999) - (b.sequence || 9999),
  );
  const last = sorted[sorted.length - 1];
  if (last) {
    mergeIntoAuthor(last, {
      evidence: [
        "No explicit correspondence marker was found; selected last author as a low-confidence fallback",
      ],
    });
    return {
      authors: [last],
      resolution: {
        status: "inferred",
        reason:
          "No explicit corresponding-author marker was found; selected the last author as a low-confidence fallback.",
        isPreprintLike: options.isPreprintLike,
      },
    };
  }
  return {
    authors: [],
    resolution: {
      status: "not_found",
      reason:
        "No author records were available for corresponding-author resolution.",
      isPreprintLike: options.isPreprintLike,
    },
  };
}

async function enrichSelectedAuthors(
  authors: PaperAuthor[],
  signal?: AbortSignal,
): Promise<void> {
  for (const author of authors) {
    await Promise.all([
      fetchOpenAlexAuthorMetrics(author, signal),
      fetchSemanticAuthorMetrics(author, signal),
    ]);
  }
}

export async function resolveAuthorProfileInput(
  item: Zotero.Item,
  progress?: AuthorProfileProgressCallback,
  signal?: AbortSignal,
): Promise<AuthorProfileInput> {
  const copy = getAuthorProfileCopy(getAuthorProfileLanguage());
  progress?.({
    stage: "metadata",
    message: copy.stageMetadata,
    fraction: 0.08,
  });
  let metadata = readPaperMetadata(item);
  const allFetchedAuthors: PaperAuthor[] = [];
  const contactAuthors: AuthorContact[] = [];
  const sourceResults: SourceResult[] = [
    {
      name: "Zotero",
      ok: Boolean(metadata.title || metadata.creators.length),
      detail: `${metadata.creators.length} creators`,
    },
  ];
  const localSnippets: string[] = [];
  const correspondenceSnippets: string[] = [];

  progress?.({
    stage: "sources",
    message: copy.stagePdf,
    fraction: 0.2,
  });
  const pdfEvidence = await collectPdfEvidence(metadata, item);
  if (!metadata.doi && pdfEvidence.doi) {
    metadata = { ...metadata, doi: pdfEvidence.doi };
  }
  localSnippets.push(
    ...pdfEvidence.contextSnippets,
    ...pdfEvidence.correspondenceSnippets,
  );
  correspondenceSnippets.push(...pdfEvidence.correspondenceSnippets);
  contactAuthors.push(...pdfEvidence.contacts);
  sourceResults.push({
    name: "PDF",
    ok:
      pdfEvidence.correspondenceSnippets.length > 0 ||
      pdfEvidence.contacts.length > 0 ||
      Boolean(pdfEvidence.doi) ||
      Boolean(pdfEvidence.arxivId),
    detail:
      [
        pdfEvidence.correspondenceSnippets.length
          ? `${pdfEvidence.correspondenceSnippets.length} correspondence snippets`
          : "",
        pdfEvidence.contacts.length
          ? `${pdfEvidence.contacts.length} author contact emails`
          : "",
        pdfEvidence.doi ? `DOI ${pdfEvidence.doi}` : "",
        pdfEvidence.arxivId ? `arXiv ${pdfEvidence.arxivId}` : "",
      ]
        .filter(Boolean)
        .join("; ") || "No local PDF correspondence evidence",
  });

  progress?.({
    stage: "sources",
    message: copy.stageSources,
    fraction: 0.36,
  });
  const sourceFetches = await Promise.all([
    fetchCrossrefAuthors(metadata, signal),
    fetchOpenAlexAuthors(metadata, signal),
    fetchSemanticScholarAuthors(metadata, signal),
    fetchPubMedCentralAuthors(metadata, signal),
  ]);
  for (const source of sourceFetches) {
    allFetchedAuthors.push(...source.authors);
    localSnippets.push(...source.snippets);
    if (source.result.name === "PubMed Central") {
      correspondenceSnippets.push(...source.snippets);
    }
    sourceResults.push(source.result);
  }
  // PDF evidence is collected before external lookups so DOI extraction can
  // improve Crossref/OpenAlex/Semantic Scholar matching.

  progress?.({
    stage: "resolve",
    message: copy.stageResolve,
    fraction: 0.58,
  });
  const authors = mergeAuthors(metadata, allFetchedAuthors);
  applyContactEmails(authors, contactAuthors);
  applyLocalSnippetEvidence(authors, correspondenceSnippets);
  const isPreprintLike = detectPreprintLike(metadata, pdfEvidence);
  const resolved = chooseCorrespondingAuthors(authors, {
    disableFallback: isPreprintLike || contactAuthors.length > 1,
    isPreprintLike,
  });
  const selectedAuthors = resolved.authors;

  progress?.({
    stage: "resolve",
    message: copy.stageEnrich,
    fraction: 0.7,
  });
  await enrichSelectedAuthors(selectedAuthors, signal);

  return {
    metadata,
    authors,
    selectedAuthors,
    contactAuthors: dedupeContacts(contactAuthors),
    resolution: resolved.resolution,
    sourceResults,
    localSnippets: dedupeStrings(localSnippets).slice(0, 10),
  };
}
