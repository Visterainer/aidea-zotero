const AdmZip = require("adm-zip");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");

const outputDir = __dirname;
mkdirSync(outputDir, { recursive: true });

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

function addStoredMimetype(zip) {
  zip.addFile("mimetype", Buffer.from("application/epub+zip"));
  zip.getEntry("mimetype").header.method = 0;
}

function writeEpub3() {
  const zip = new AdmZip();
  addStoredMimetype(zip);
  zip.addFile("META-INF/container.xml", Buffer.from(containerXml));
  zip.addFile(
    "OEBPS/content.opf",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">aidea-epub3</dc:identifier><dc:title>AIdea EPUB 3 Fixture</dc:title><dc:language>en</dc:language></metadata>
  <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="book" href="book.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine><itemref idref="book"/></spine>
</package>`),
  );
  zip.addFile(
    "OEBPS/nav.xhtml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="book.xhtml#one">Chapter One</a></li><li><a href="book.xhtml#two">Chapter Two</a></li></ol></nav></body></html>`),
  );
  zip.addFile(
    "OEBPS/book.xhtml",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><section id="one"><h1>Chapter One</h1><p>EPUB3_FIRST_CHAPTER introduces the fixture.</p></section><section id="two"><h1>Chapter Two</h1><p>EPUB3_SECOND_CHAPTER completes the fixture.</p></section></body></html>`),
  );
  zip.writeZip(join(outputDir, "epub3-sections.epub"));
}

function writeEpub2() {
  const zip = new AdmZip();
  addStoredMimetype(zip);
  zip.addFile("META-INF/container.xml", Buffer.from(containerXml));
  zip.addFile(
    "OEBPS/content.opf",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">aidea-epub2</dc:identifier><dc:title>AIdea EPUB 2 Fixture</dc:title><dc:language>en</dc:language></metadata>
  <manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine toc="ncx"><itemref idref="one"/><itemref idref="notes" linear="no"/></spine>
</package>`),
  );
  zip.addFile(
    "OEBPS/toc.ncx",
    Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint id="one"><navLabel><text>Opening</text></navLabel><content src="one.xhtml"/></navPoint><navPoint id="notes"><navLabel><text>Notes</text></navLabel><content src="notes.xhtml"/></navPoint></navMap></ncx>`),
  );
  zip.addFile(
    "OEBPS/one.xhtml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Opening</h1><p>EPUB2_OPENING_CONTENT</p></body></html>`,
    ),
  );
  zip.addFile(
    "OEBPS/notes.xhtml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Notes</h1><p>EPUB2_NON_LINEAR_NOTES</p></body></html>`,
    ),
  );
  zip.writeZip(join(outputDir, "epub2-ncx.epub"));
}

writeEpub3();
writeEpub2();
