"""Reflow isolated Persian text in the Rust engine's finished PDF."""

from contextlib import ExitStack
import os
from pathlib import Path
from tempfile import NamedTemporaryFile
import unicodedata

import pymupdf as pdf

from aidea_persian_render import render_paragraph


def contains_persian(text):
    return any(unicodedata.bidirectional(char) == "AL" for char in text)


def _translated_panels(document, source, dual, alternating, translated_first):
    for index, original in enumerate(source):
        page_index = index
        if dual and alternating:
            page_index = 2 * index + int(not translated_first)
        page = document[page_index]
        box = page.rect
        if dual and not alternating:
            x = 0 if translated_first else page.rect.width - original.rect.width
            y = (page.rect.height - original.rect.height) / 2
            box = original.rect + (x, y, x, y)
        yield index + 1, page, box


def _paragraphs(page, panel, scanned):
    traces = page.get_texttrace()
    graphics = [pdf.Rect(drawing["rect"]) + (-.35, -.35, .35, .35)
                for drawing in page.get_drawings()
                if drawing["type"] != "f" or drawing["fill"] not in ((1, 1, 1), (1,))]
    images = [pdf.Rect(image["bbox"]) for image in page.get_image_info()]
    links = [pdf.Rect(link["from"]) for link in page.get_links()]
    for block in page.get_text("dict", clip=panel, flags=pdf.TEXTFLAGS_TEXT)["blocks"]:
        rendered = "".join(span["text"] for line in block["lines"] for span in line["spans"])
        if not contains_persian(rendered):
            continue
        box = pdf.Rect(block["bbox"]) + (-.1, -.1, .1, .1)
        if (not panel.contains(box) or any(line["dir"] != (1, 0) for line in block["lines"])
                or any(box.intersects(region) for region in (*graphics, *links))
                or any(box.intersects(image) and not (scanned and image.contains(box)) for image in images)):
            yield None
            continue
        glyphs, styles = [], set()
        for span in traces:
            # Combining marks and zero-width join controls have empty glyph
            # boxes. Their origins still belong to the paragraph.
            if not box.intersects(pdf.Rect(span["bbox"]) + (-.01, -.01, .01, .01)):
                continue
            selected = [char for char in span["chars"] if box.contains(pdf.Point(char[2]))]
            if selected:
                glyphs.extend(selected)
                styles.add((round(span["size"], 2), span["type"], span["opacity"], span["dir"],
                            tuple(span["color"])))
        text = "".join(chr(char[0]) for char in glyphs).strip()
        if len(styles) != 1 or not contains_persian(text) or "\ufffd" in text:
            yield None
            continue
        size, render_mode, opacity, direction, color = styles.pop()
        if render_mode != 0 or opacity != 1 or direction != (1, 0) or not 0 < size < 256:
            yield None
            continue
        yield box, text, size, color


def _replace_paragraphs(page, panel, scanned):
    replaced = skipped = 0
    with ExitStack() as stack:
        layers = []
        for candidate in _paragraphs(page, panel, scanned):
            if candidate is None:
                skipped += 1
                continue
            box, text, size, color = candidate
            layer = stack.enter_context(pdf.open())
            target = layer.new_page(width=box.width, height=box.height)
            if not render_paragraph(target, target.rect, text, size, color=color):
                skipped += 1
                continue
            layers.append((box, layer))
        if not layers:
            return replaced, skipped

        document, xref = page.parent, page.xref
        annotations = document.xref_get_key(xref, "Annots")[1]
        try:
            if annotations != "null":
                document.xref_set_key(xref, "Annots", "[]")
                page = document.reload_page(page)
            for box, _ in layers:
                page.add_redact_annot(box, fill=False, cross_out=False)
            page.apply_redactions(images=pdf.PDF_REDACT_IMAGE_NONE,
                                  graphics=pdf.PDF_REDACT_LINE_ART_NONE)
        finally:
            if annotations != "null":
                document.xref_set_key(xref, "Annots", annotations)
        if annotations != "null":
            page = document.reload_page(page)
        for box, layer in layers:
            page.show_pdf_page(box, layer, 0, keep_proportion=False)
            replaced += 1
    return replaced, skipped


def reflow_persian_pdf(path, source, *, dual, alternating, translated_first, scanned, translated):
    """Keep original panels untouched and report every uncorrected paragraph."""
    path = Path(path)
    temporary = None
    report = {}
    try:
        with pdf.open(path) as document, pdf.open(source) as original:
            panels = _translated_panels(document, original, dual, alternating, translated_first)
            for number, page, panel in panels:
                if number in translated:
                    corrected, skipped = _replace_paragraphs(page, panel, number in scanned)
                    if corrected or skipped:
                        report[number] = corrected, skipped
            if any(corrected for corrected, _ in report.values()):
                with NamedTemporaryFile(dir=path.parent, suffix=".pdf", delete=False) as stream:
                    temporary = Path(stream.name)
                document.save(temporary, deflate=True, garbage=3)
        if temporary is not None:
            os.replace(temporary, path)
        return report
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
