"""Keep translated table text inside ruled cells in Rust engine PDFs."""

from contextlib import ExitStack
from html import escape
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from unicodedata import normalize

import pymupdf as pdf

from aidea_pdf_text import redact_only_page_text


def _spans(page, region=None):
    return [span for block in page.get_text("dict", clip=region, flags=pdf.TEXTFLAGS_TEXT)["blocks"]
            for line in block["lines"] if line["dir"] == (1, 0)
            for span in line["spans"] if span["text"].strip()]


def _last_row_cells(page):
    rules = {}
    for drawing in page.get_drawings():
        rect = pdf.Rect(drawing["rect"])
        if drawing["type"] == "s" and rect.width >= 60 and rect.height < .25:
            rules.setdefault((round(rect.x0), round(rect.x1)), set()).add(rect.y0)
    for (left, right), ys in rules.items():
        boundaries = sorted(ys)
        for top, bottom in zip(boundaries, boundaries[1:]):
            if bottom - top < 18:
                continue
            spans = _spans(page, pdf.Rect(left - 1, top, right + 1, bottom))
            rows = {}
            for span in spans:
                rows.setdefault(round(span["origin"][1]), []).append(span)
            for row in sorted(rows, reverse=True):
                starts = []
                for span in sorted(rows[row], key=lambda item: item["origin"][0]):
                    if not starts or span["origin"][0] > starts[-1]["bbox"][2] + 2:
                        starts.append(span)
                if len(starts) < 2:
                    continue
                limits = [item["origin"][0] for item in starts[1:]] + [right + 1]
                for span, limit in zip(starts, limits, strict=True):
                    size = span["size"]
                    cell = pdf.Rect(span["origin"][0] - .5, span["bbox"][1] - .35, limit - .65, bottom - .35)
                    if cell.width > 22 and cell.height >= size:
                        yield cell, bottom, size
                break


def _fit_cells(source, page, dx, dy):
    with ExitStack() as stack:
        edits = []
        for original_cell, bottom, size in _last_row_cells(source):
            if _spans(source, pdf.Rect(original_cell.x0, bottom, original_cell.x1, bottom + size * 2)):
                continue
            cell = original_cell + (dx, dy, dx, dy)
            limit = bottom + dy
            region = cell + (-.2, -size * .4, .2, size * 2)
            spans = [span for span in _spans(page, region)
                     if span["origin"][1] >= cell.y0 + size * .4]
            if not spans or max(span["bbox"][3] for span in spans) <= limit + .35:
                continue
            if (abs(spans[0]["origin"][0] - cell.x0) > 3
                    or len({span["color"] for span in spans}) != 1):
                continue
            pieces = []
            for span in spans:
                text = span["text"].strip()
                if pieces and re.search(r"[A-Za-z0-9]$", pieces[-1]) and re.match(r"[A-Za-z0-9]", text):
                    pieces.append(" ")
                pieces.append(text)
            text = "".join(pieces)
            if any(re.search(r"math|^(cmm|cmsy|cmex)", span["font"], re.I) for span in spans):
                continue
            if re.search(r"[∏∑√∫⁰-₟]|\$\w+", text):
                continue
            text = normalize("NFKC", text).replace("\u2010", "-").replace("\u2011", "-")
            layer = stack.enter_context(pdf.open())
            scratch = layer.new_page(width=cell.width, height=cell.height)
            html = f'<div style="font-size:{size:.3f}pt;color:#{spans[0]["color"]:06x}">{escape(text)}</div>'
            spare, _ = scratch.insert_htmlbox(
                scratch.rect, html, css="*{margin:0;padding:0;line-height:1.05}", scale_low=.7,
            )
            if spare < 0 or "".join(scratch.get_text().split()) != "".join(text.split()):
                continue
            # Remove only the selected lines at their baselines. A whole
            # block rectangle can touch neighboring rows' font extents.
            masks = [pdf.Rect(s["bbox"][0] + .05, s["origin"][1] - s["size"] * .42,
                              s["bbox"][2] - .05, s["origin"][1] - s["size"] * .33)
                     for s in spans]
            edits.append((cell, layer, masks))
        if edits:
            page = redact_only_page_text(page, (mask for _, _, masks in edits for mask in masks))
            for cell, layer, _ in edits:
                page.show_pdf_page(cell, layer, 0)
        return len(edits)


def fit_translated_table_cells(source_path, output_path, *, dual, alternating, translated_first, pages):
    output_path = Path(output_path)
    temporary = None
    count = 0
    try:
        with pdf.open(source_path) as source, pdf.open(output_path) as output:
            for number in sorted(pages):
                index = number - 1
                original = source[index]
                if dual and alternating:
                    index = index * 2 + int(not translated_first)
                page = output[index]
                dx = dy = 0
                if dual and not alternating:
                    dx = 0 if translated_first else page.rect.width - original.rect.width
                    dy = (page.rect.height - original.rect.height) / 2
                count += _fit_cells(original, page, dx, dy)
            if count:
                with NamedTemporaryFile(dir=output_path.parent, suffix=".pdf", delete=False) as stream:
                    temporary = Path(stream.name)
                output.save(temporary, garbage=3, deflate=True)
        if temporary is not None:
            os.replace(temporary, output_path)
        return count
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
