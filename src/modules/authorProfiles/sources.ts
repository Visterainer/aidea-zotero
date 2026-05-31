import type { PaperAuthor, PaperMetadata, SourceResult } from "./types";
import {
  createAuthor,
  dedupeStrings,
  lastNameKey,
  mergeIntoAuthor,
  normalizeDoi,
  normalizeName,
  normalizeWhitespace,
  truncateText,
} from "./utils";

type SourceFetchResult = {
  authors: PaperAuthor[];
  snippets: string[];
  result: SourceResult;
};

type JsonObject = Record<string, any>;

const FETCH_TIMEOUT_MS = 12000;

function isPaperAuthor(author: PaperAuthor | null): author is PaperAuthor {
  return Boolean(author);
}

function elements(list: HTMLCollectionOf<Element>): Element[] {
  return Array.from(list as unknown as Element[]);
}

function sourceOk(name: SourceResult["name"], detail: string): SourceResult {
  return { name, ok: true, detail };
}

function sourceFail(name: SourceResult["name"], detail: string): SourceResult {
  return { name, ok: false, detail };
}

async function fetchTextWithTimeout(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, text/xml;q=0.9, */*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

async function fetchJsonWithTimeout(
  url: string,
  signal?: AbortSignal,
): Promise<JsonObject> {
  const text = await fetchTextWithTimeout(url, signal);
  return JSON.parse(text) as JsonObject;
}

function authorFromName(name: string, sequence?: number): PaperAuthor | null {
  const clean = normalizeWhitespace(name);
  if (!clean) return null;
  return createAuthor({ name: clean, sequence });
}

function parseCrossrefName(
  row: JsonObject,
  sequence: number,
): PaperAuthor | null {
  const givenName = normalizeWhitespace(row.given);
  const familyName = normalizeWhitespace(row.family);
  const name = normalizeWhitespace(
    [givenName, familyName].filter(Boolean).join(" "),
  );
  if (!name) return null;
  const author = createAuthor({ name, givenName, familyName, sequence });
  author.orcid = normalizeWhitespace(row.ORCID).replace(
    /^https?:\/\/orcid\.org\//i,
    "",
  );
  author.affiliations = dedupeStrings(
    Array.isArray(row.affiliation)
      ? row.affiliation.map((entry: JsonObject) => entry?.name)
      : [],
  );
  return author;
}

export async function fetchCrossrefAuthors(
  metadata: PaperMetadata,
  signal?: AbortSignal,
): Promise<SourceFetchResult> {
  const doi = normalizeDoi(metadata.doi);
  const title = normalizeWhitespace(metadata.title);
  if (!doi && !title) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail("Crossref", "No DOI or title"),
    };
  }
  try {
    const url = doi
      ? `https://api.crossref.org/works/${encodeURIComponent(doi)}`
      : `https://api.crossref.org/works?rows=1&query.title=${encodeURIComponent(
          title,
        )}`;
    const json = await fetchJsonWithTimeout(url, signal);
    const message = doi
      ? json?.message || {}
      : Array.isArray(json?.message?.items)
        ? json.message.items[0] || {}
        : {};
    const authors = Array.isArray(message.author)
      ? message.author
          .map((row: JsonObject, index: number) =>
            parseCrossrefName(row, index + 1),
          )
          .filter(isPaperAuthor)
      : [];
    return {
      authors,
      snippets: [],
      result: sourceOk(
        "Crossref",
        `${authors.length} author records via ${doi ? "DOI" : "title"}`,
      ),
    };
  } catch (err) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail(
        "Crossref",
        err instanceof Error ? err.message : String(err),
      ),
    };
  }
}

function parseOpenAlexAuthorship(
  row: JsonObject,
  sequence: number,
): PaperAuthor | null {
  const authorInfo = row?.author || {};
  const name =
    normalizeWhitespace(row.raw_author_name) ||
    normalizeWhitespace(authorInfo.display_name);
  const author = authorFromName(name, sequence);
  if (!author) return null;
  author.openAlexId = normalizeWhitespace(authorInfo.id);
  author.affiliations = dedupeStrings([
    ...(Array.isArray(row.institutions)
      ? row.institutions.map((inst: JsonObject) => inst?.display_name)
      : []),
    ...(Array.isArray(row.raw_affiliation_strings)
      ? row.raw_affiliation_strings
      : []),
  ]);
  if (row.is_corresponding) {
    author.isCorresponding = true;
    author.correspondenceSources.push("OpenAlex");
    author.evidence.push("OpenAlex marks this authorship as corresponding");
  }
  return author;
}

export async function fetchOpenAlexAuthors(
  metadata: PaperMetadata,
  signal?: AbortSignal,
): Promise<SourceFetchResult> {
  const doi = normalizeDoi(metadata.doi);
  const title = normalizeWhitespace(metadata.title);
  if (!doi && !title) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail("OpenAlex", "No DOI or title"),
    };
  }
  try {
    const urls: string[] = [];
    if (doi) {
      const doiUrl = `https://doi.org/${doi}`;
      urls.push(
        `https://api.openalex.org/works?filter=doi:${encodeURIComponent(
          doiUrl,
        )}&per-page=1`,
      );
    }
    if (title) {
      urls.push(
        `https://api.openalex.org/works?search=${encodeURIComponent(
          title,
        )}&per-page=1`,
      );
    }

    let work: JsonObject | null = null;
    for (const url of urls) {
      const json = await fetchJsonWithTimeout(url, signal);
      const results = Array.isArray(json.results) ? json.results : [];
      if (results[0]) {
        work = results[0];
        break;
      }
    }

    if (!work) {
      return {
        authors: [],
        snippets: [],
        result: sourceFail("OpenAlex", "No matching work"),
      };
    }

    const authors = Array.isArray(work.authorships)
      ? work.authorships
          .map((row: JsonObject, index: number) =>
            parseOpenAlexAuthorship(row, index + 1),
          )
          .filter(isPaperAuthor)
      : [];
    return {
      authors,
      snippets: [],
      result: sourceOk("OpenAlex", `${authors.length} authorship records`),
    };
  } catch (err) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail(
        "OpenAlex",
        err instanceof Error ? err.message : String(err),
      ),
    };
  }
}

function parseSemanticPaperAuthor(
  row: JsonObject,
  sequence: number,
): PaperAuthor | null {
  const author = authorFromName(row?.name, sequence);
  if (!author) return null;
  author.semanticScholarId = normalizeWhitespace(row.authorId);
  author.affiliations = dedupeStrings(
    Array.isArray(row.affiliations) ? row.affiliations : [],
  );
  return author;
}

export async function fetchSemanticScholarAuthors(
  metadata: PaperMetadata,
  signal?: AbortSignal,
): Promise<SourceFetchResult> {
  const doi = normalizeDoi(metadata.doi);
  const title = normalizeWhitespace(metadata.title);
  if (!doi && !title) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail("Semantic Scholar", "No DOI or title"),
    };
  }
  try {
    const fields = [
      "title",
      "year",
      "externalIds",
      "authors.authorId",
      "authors.name",
      "authors.affiliations",
      "citationCount",
      "referenceCount",
      "venue",
      "abstract",
    ].join(",");
    const url = doi
      ? `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(
          doi,
        )}?fields=${encodeURIComponent(fields)}`
      : `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
          title,
        )}&limit=1&fields=${encodeURIComponent(fields)}`;
    const json = await fetchJsonWithTimeout(url, signal);
    const paper = doi
      ? json
      : Array.isArray(json?.data)
        ? json.data[0] || {}
        : {};
    const authors = Array.isArray(paper.authors)
      ? paper.authors
          .map((row: JsonObject, index: number) =>
            parseSemanticPaperAuthor(row, index + 1),
          )
          .filter(isPaperAuthor)
      : [];
    const snippets = [
      paper.abstract
        ? `Semantic Scholar abstract: ${truncateText(paper.abstract, 800)}`
        : "",
    ].filter(Boolean);
    return {
      authors,
      snippets,
      result: sourceOk(
        "Semantic Scholar",
        `${authors.length} author records via ${doi ? "DOI" : "title"}`,
      ),
    };
  } catch (err) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail(
        "Semantic Scholar",
        err instanceof Error ? err.message : String(err),
      ),
    };
  }
}

function textContent(node: Element | null | undefined): string {
  return normalizeWhitespace(node?.textContent || "");
}

function parseJatsContrib(
  contrib: Element,
  sequence: number,
): PaperAuthor | null {
  const nameEl = contrib.getElementsByTagName("name")[0];
  const surname = textContent(nameEl?.getElementsByTagName("surname")[0]);
  const given = textContent(nameEl?.getElementsByTagName("given-names")[0]);
  const fallbackName = textContent(
    contrib.getElementsByTagName("string-name")[0],
  );
  const name =
    normalizeWhitespace([given, surname].filter(Boolean).join(" ")) ||
    fallbackName;
  const author = authorFromName(name, sequence);
  if (!author) return null;
  author.givenName = given || author.givenName;
  author.familyName = surname || author.familyName;
  const emails = elements(contrib.getElementsByTagName("email")).map((email) =>
    textContent(email),
  );
  author.emails = dedupeStrings(emails);
  if (contrib.getAttribute("corresp") === "yes") {
    author.isCorresponding = true;
    author.correspondenceSources.push("PubMed Central");
    author.evidence.push('JATS contributor has corresp="yes"');
  }
  return author;
}

function extractCorrespondenceNotes(doc: Document): string[] {
  const notes = elements(doc.getElementsByTagName("corresp")).map((node) =>
    truncateText(textContent(node), 700),
  );
  return dedupeStrings(notes).slice(0, 6);
}

export async function fetchPubMedCentralAuthors(
  metadata: PaperMetadata,
  signal?: AbortSignal,
): Promise<SourceFetchResult> {
  const doi = normalizeDoi(metadata.doi);
  if (!doi) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail("PubMed Central", "No DOI"),
    };
  }
  try {
    const idconvUrl = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?tool=AIdea&format=json&ids=${encodeURIComponent(
      doi,
    )}`;
    const idconv = await fetchJsonWithTimeout(idconvUrl, signal);
    const record = Array.isArray(idconv.records) ? idconv.records[0] : null;
    const pmcid = normalizeWhitespace(record?.pmcid).replace(/^PMC/i, "");
    if (!pmcid) {
      return {
        authors: [],
        snippets: [],
        result: sourceFail("PubMed Central", "No PMCID for DOI"),
      };
    }
    const xmlText = await fetchTextWithTimeout(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${encodeURIComponent(
        pmcid,
      )}&retmode=xml`,
      signal,
    );
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "text/xml");
    const authors = elements(doc.getElementsByTagName("contrib"))
      .filter((node) => node.getAttribute("contrib-type") === "author")
      .map((node, index) => parseJatsContrib(node, index + 1))
      .filter(isPaperAuthor);
    const snippets = extractCorrespondenceNotes(doc);
    for (const snippet of snippets) {
      const normalizedSnippet = normalizeName(snippet);
      for (const author of authors) {
        if (!author) continue;
        const authorKey = normalizeName(author.name);
        const familyKey = lastNameKey(author.name);
        if (
          (authorKey && normalizedSnippet.includes(authorKey)) ||
          (familyKey && normalizedSnippet.includes(familyKey))
        ) {
          mergeIntoAuthor(author, {
            isCorresponding: true,
            correspondenceSources: ["PubMed Central"],
            evidence: [
              `PMC correspondence note: ${truncateText(snippet, 220)}`,
            ],
          });
        }
      }
    }
    return {
      authors,
      snippets: snippets.map((snippet) => `PMC correspondence: ${snippet}`),
      result: sourceOk(
        "PubMed Central",
        `${authors.length} JATS author records`,
      ),
    };
  } catch (err) {
    return {
      authors: [],
      snippets: [],
      result: sourceFail(
        "PubMed Central",
        err instanceof Error ? err.message : String(err),
      ),
    };
  }
}

export async function fetchOpenAlexAuthorMetrics(
  author: PaperAuthor,
  signal?: AbortSignal,
): Promise<void> {
  if (!author.openAlexId) return;
  try {
    const url = author.openAlexId.replace(/^http:/, "https:");
    const json = await fetchJsonWithTimeout(url, signal);
    mergeIntoAuthor(author, {
      affiliations: dedupeStrings(
        Array.isArray(json.last_known_institutions)
          ? json.last_known_institutions.map(
              (inst: JsonObject) => inst?.display_name,
            )
          : [],
      ),
      metrics: {
        worksCount: Number(json.works_count) || undefined,
        citedByCount: Number(json.cited_by_count) || undefined,
      },
    });
  } catch {
    /* metrics are optional */
  }
}

export async function fetchSemanticAuthorMetrics(
  author: PaperAuthor,
  signal?: AbortSignal,
): Promise<void> {
  if (!author.semanticScholarId) return;
  try {
    const fields = [
      "name",
      "affiliations",
      "paperCount",
      "citationCount",
      "hIndex",
      "homepage",
    ].join(",");
    const url = `https://api.semanticscholar.org/graph/v1/author/${encodeURIComponent(
      author.semanticScholarId,
    )}?fields=${encodeURIComponent(fields)}`;
    const json = await fetchJsonWithTimeout(url, signal);
    mergeIntoAuthor(author, {
      affiliations: dedupeStrings(
        Array.isArray(json.affiliations) ? json.affiliations : [],
      ),
      metrics: {
        paperCount: Number(json.paperCount) || undefined,
        citationCount: Number(json.citationCount) || undefined,
        hIndex: Number(json.hIndex) || undefined,
      },
    });
  } catch {
    /* metrics are optional */
  }
}
