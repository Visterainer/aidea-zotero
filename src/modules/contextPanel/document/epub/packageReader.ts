import {
  buildEpubNavigationStructure,
  type EpubNavigationNode,
} from "./structure";
import type { DocumentStructure } from "../types";

export type EpubManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties: string[];
};

export type EpubSpineItem = {
  idref: string;
  href: string;
  mediaType: string;
  properties: string[];
  linear: boolean;
  spineIndex: number;
};

export type EpubPackage = {
  contentPath: string;
  manifest: EpubManifestItem[];
  spine: EpubSpineItem[];
  structure: DocumentStructure;
};

type ZipReader = {
  close(): void;
  findEntries(pattern: string | null): nsIUTF8StringEnumerator;
  getEntry(entry: string): nsIZipEntry;
  getInputStream(entry: string): nsIInputStream;
  hasEntry(entry: string): boolean;
  open(file: nsIFile): void;
};

export const MAX_EPUB_ARCHIVE_ENTRIES = 5_000;
export const MAX_EPUB_TEXT_ENTRY_BYTES = 8 * 1024 * 1024;
export const MAX_EPUB_TOTAL_TEXT_BYTES = 64 * 1024 * 1024;

export function isSafeEpubEntryPath(value: string): boolean {
  const path = String(value || "").replace(/\\/g, "/");
  if (!path || path.startsWith("/") || /^[a-z]:/i.test(path)) return false;
  return !path.split("/").some((part) => part === "..");
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDirectChildren(
  element: Element | null | undefined,
  localName: string,
): Element[] {
  if (!element) return [];
  return Array.from(element.children).filter(
    (child) => child.localName.toLowerCase() === localName.toLowerCase(),
  );
}

function getFirstDirectChild(
  element: Element | null | undefined,
  localName: string,
): Element | null {
  return getDirectChildren(element, localName)[0] || null;
}

function getFirstDescendant(
  element: ParentNode | null | undefined,
  localName: string,
): Element | null {
  if (!element) return null;
  return (
    (Array.from(element.querySelectorAll("*")) as Element[]).find(
      (child) => child.localName.toLowerCase() === localName.toLowerCase(),
    ) || null
  );
}

function getAttributeByLocalName(
  element: Element | null | undefined,
  localName: string,
): string {
  if (!element) return "";
  const attribute = Array.from(element.attributes).find(
    (candidate) =>
      candidate.localName.toLowerCase() === localName.toLowerCase(),
  );
  return normalizeText(attribute?.value);
}

function getSemanticRoles(...elements: Array<Element | null>): string[] {
  const roles = new Set<string>();
  for (const element of elements) {
    const value = getAttributeByLocalName(element, "type");
    for (const role of value.toLowerCase().split(/\s+/).filter(Boolean)) {
      roles.add(role);
    }
    const ariaRole = normalizeText(element?.getAttribute("role")).toLowerCase();
    if (ariaRole.startsWith("doc-")) roles.add(ariaRole.substring(4));
  }
  return [...roles];
}

function splitProperties(value: string | null): string[] {
  return normalizeText(value).toLowerCase().split(/\s+/).filter(Boolean);
}

function normalizeFragment(value: string): string | undefined {
  const raw = String(value || "")
    .replace(/^#/, "")
    .trim();
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function decodeEpubPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function resolveEpubReference(
  baseHref: string,
  referencedHref: string,
): { href: string; fragment?: string } | null {
  const raw = String(referencedHref || "").trim();
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  try {
    const resolved = new URL(raw, `zip:/${baseHref}`);
    const fragment = normalizeFragment(resolved.hash);
    return {
      // URL resolves relative EPUB references correctly but percent-encodes
      // spaces and non-ASCII characters. nsIZipReader addresses archive
      // entries by their decoded names, so convert the URL path back once.
      href: decodeEpubPath(resolved.pathname.substring(1)),
      fragment,
    };
  } catch {
    return null;
  }
}

function findTocNav(doc: XMLDocument): Element | null {
  const navs = Array.from(doc.getElementsByTagNameNS("*", "nav"));
  return (
    navs.find((nav) => {
      const roles = getSemanticRoles(nav);
      return (
        roles.includes("toc") ||
        normalizeText(nav.getAttribute("role"))
          .toLowerCase()
          .split(/\s+/)
          .includes("doc-toc")
      );
    }) || null
  );
}

function getNavigationLabel(element: Element | null): string {
  return normalizeText(element?.textContent);
}

function parseEpub3List(
  list: Element,
  documentHref: string,
): EpubNavigationNode[] {
  const nodes: EpubNavigationNode[] = [];
  for (const listItem of getDirectChildren(list, "li")) {
    const labelElement =
      getDirectChildren(listItem, "a")[0] ||
      getDirectChildren(listItem, "span")[0] ||
      null;
    const nestedList =
      getDirectChildren(listItem, "ol")[0] ||
      getDirectChildren(listItem, "ul")[0] ||
      null;
    const children = nestedList ? parseEpub3List(nestedList, documentHref) : [];
    const reference =
      labelElement?.localName.toLowerCase() === "a"
        ? resolveEpubReference(
            documentHref,
            labelElement.getAttribute("href") || "",
          )
        : null;
    const label = getNavigationLabel(labelElement);
    if (!label && !reference && !children.length) continue;
    nodes.push({
      sourceId:
        normalizeText(listItem.getAttribute("id")) ||
        normalizeText(labelElement?.getAttribute("id")) ||
        undefined,
      label: label || undefined,
      href: reference?.href,
      fragment: reference?.fragment,
      semanticRoles: getSemanticRoles(listItem, labelElement),
      children,
    });
  }
  return nodes;
}

function parseEpub3Navigation(
  doc: XMLDocument,
  documentHref: string,
): EpubNavigationNode[] {
  const toc = findTocNav(doc);
  const list = getFirstDirectChild(toc, "ol") || getFirstDirectChild(toc, "ul");
  return list ? parseEpub3List(list, documentHref) : [];
}

function parseNcxPoints(
  parent: Element,
  documentHref: string,
): EpubNavigationNode[] {
  const nodes: EpubNavigationNode[] = [];
  for (const navPoint of getDirectChildren(parent, "navPoint")) {
    const navLabel = getFirstDirectChild(navPoint, "navLabel");
    const label = getNavigationLabel(getFirstDescendant(navLabel, "text"));
    const content = getFirstDirectChild(navPoint, "content");
    const reference = resolveEpubReference(
      documentHref,
      content?.getAttribute("src") || "",
    );
    const children = parseNcxPoints(navPoint, documentHref);
    if (!label && !reference && !children.length) continue;
    nodes.push({
      sourceId: normalizeText(navPoint.getAttribute("id")) || undefined,
      label: label || undefined,
      href: reference?.href,
      fragment: reference?.fragment,
      children,
    });
  }
  return nodes;
}

function parseNcxNavigation(
  doc: XMLDocument,
  documentHref: string,
): EpubNavigationNode[] {
  const navMap =
    Array.from(doc.getElementsByTagNameNS("*", "navMap"))[0] || null;
  return navMap ? parseNcxPoints(navMap, documentHref) : [];
}

function emptyStructure(): DocumentStructure {
  return { rootIds: [], nodes: [] };
}

export class EpubPackageReader {
  private readonly zipReader: ZipReader;
  private totalTextBytesRead = 0;

  constructor(filePath: string) {
    const classes = Components.classes as unknown as Record<
      string,
      { createInstance(iid: unknown): unknown }
    >;
    const zipReader = classes[
      "@mozilla.org/libjar/zip-reader;1"
    ].createInstance(Components.interfaces.nsIZipReader) as ZipReader;
    zipReader.open(Zotero.File.pathToFile(filePath));
    this.zipReader = zipReader;
    try {
      this.validateArchiveShape();
    } catch (error) {
      zipReader.close();
      throw error;
    }
  }

  private validateArchiveShape(): void {
    const entries = this.zipReader.findEntries(null);
    let count = 0;
    while (entries.hasMore()) {
      const entry = entries.getNext();
      count += 1;
      if (count > MAX_EPUB_ARCHIVE_ENTRIES) {
        throw new Error(
          `EPUB contains more than ${MAX_EPUB_ARCHIVE_ENTRIES} archive entries`,
        );
      }
      if (!isSafeEpubEntryPath(entry)) {
        throw new Error(`EPUB contains an unsafe archive path: ${entry}`);
      }
    }
  }

  close(): void {
    this.zipReader.close();
  }

  hasEntry(entry: string): boolean {
    return this.zipReader.hasEntry(entry);
  }

  async readDocument(entry: string, mediaType: string): Promise<XMLDocument> {
    if (!isSafeEpubEntryPath(entry)) {
      throw new Error(`EPUB contains an unsafe document path: ${entry}`);
    }
    if (!this.zipReader.hasEntry(entry)) {
      throw new Error(`EPUB entry is missing: ${entry}`);
    }
    const declaredSize = Number(this.zipReader.getEntry(entry).realSize || 0);
    if (declaredSize > MAX_EPUB_TEXT_ENTRY_BYTES) {
      throw new Error(
        `EPUB text entry exceeds ${MAX_EPUB_TEXT_ENTRY_BYTES} bytes: ${entry}`,
      );
    }
    if (this.totalTextBytesRead + declaredSize > MAX_EPUB_TOTAL_TEXT_BYTES) {
      throw new Error(
        `EPUB text extraction exceeds ${MAX_EPUB_TOTAL_TEXT_BYTES} bytes`,
      );
    }
    this.totalTextBytesRead += declaredSize;
    const stream = this.zipReader.getInputStream(entry);
    try {
      const contents = await Zotero.File.getContentsAsync(stream);
      const doc = new DOMParser().parseFromString(
        String(contents || ""),
        mediaType === "application/xhtml+xml"
          ? "application/xhtml+xml"
          : "text/xml",
      );
      if (doc.getElementsByTagName("parsererror").length) {
        throw new Error(`Could not parse EPUB entry: ${entry}`);
      }
      return doc;
    } finally {
      stream.close();
    }
  }

  async readPackage(): Promise<EpubPackage> {
    const container = await this.readDocument(
      "META-INF/container.xml",
      "text/xml",
    );
    const rootfiles = Array.from(
      container.getElementsByTagNameNS("*", "rootfile"),
    );
    const rootfile =
      rootfiles.find(
        (entry) =>
          normalizeText(entry.getAttribute("media-type")) ===
          "application/oebps-package+xml",
      ) ||
      rootfiles[0] ||
      null;
    const contentPath = normalizeText(rootfile?.getAttribute("full-path"));
    if (!contentPath) {
      throw new Error("EPUB container does not identify a package document");
    }

    const packageDoc = await this.readDocument(contentPath, "text/xml");
    const packageElement = packageDoc.documentElement;
    const manifestElement = getFirstDirectChild(packageElement, "manifest");
    const spineElement = getFirstDirectChild(packageElement, "spine");
    if (!manifestElement || !spineElement) {
      throw new Error("EPUB package does not contain a manifest and spine");
    }

    const manifest: EpubManifestItem[] = [];
    for (const element of getDirectChildren(manifestElement, "item")) {
      const id = normalizeText(element.getAttribute("id"));
      const reference = resolveEpubReference(
        contentPath,
        element.getAttribute("href") || "",
      );
      if (!id || !reference?.href || reference.fragment) continue;
      manifest.push({
        id,
        href: reference.href,
        mediaType: normalizeText(element.getAttribute("media-type")),
        properties: splitProperties(element.getAttribute("properties")),
      });
    }
    const manifestById = new Map(manifest.map((item) => [item.id, item]));

    const spine: EpubSpineItem[] = [];
    for (const element of getDirectChildren(spineElement, "itemref")) {
      const idref = normalizeText(element.getAttribute("idref"));
      const manifestItem = manifestById.get(idref);
      if (!manifestItem) continue;
      spine.push({
        idref,
        href: manifestItem.href,
        mediaType: manifestItem.mediaType,
        properties: [
          ...manifestItem.properties,
          ...splitProperties(element.getAttribute("properties")),
        ],
        linear:
          normalizeText(element.getAttribute("linear")).toLowerCase() !== "no",
        spineIndex: spine.length,
      });
    }

    let structure = emptyStructure();
    const navItem = manifest.find((item) => item.properties.includes("nav"));
    if (navItem && this.hasEntry(navItem.href)) {
      const navDoc = await this.readDocument(navItem.href, navItem.mediaType);
      const roots = parseEpub3Navigation(navDoc, navItem.href);
      if (roots.length) {
        structure = buildEpubNavigationStructure(roots, "epub3-nav");
      }
    }

    if (!structure.nodes.length) {
      const ncxId = normalizeText(spineElement.getAttribute("toc"));
      const ncxItem =
        manifestById.get(ncxId) ||
        manifest.find((item) => item.mediaType === "application/x-dtbncx+xml");
      if (ncxItem && this.hasEntry(ncxItem.href)) {
        const ncxDoc = await this.readDocument(ncxItem.href, ncxItem.mediaType);
        const roots = parseNcxNavigation(ncxDoc, ncxItem.href);
        if (roots.length) {
          structure = buildEpubNavigationStructure(roots, "epub2-ncx");
        }
      }
    }

    return { contentPath, manifest, spine, structure };
  }
}
