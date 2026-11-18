"""Shape a translated Persian paragraph in its own PDF box (pinned engine).

The Unicode supplied by the translator is always passed unchanged to the
selection layer. The direction hints below are for MuPDF's visual layout only.
"""

import html
import math
import re

# MuPDF 1.25.2 shapes Arabic-script glyphs, but its HTML bidi resolver can
# put a closing ASCII bracket before the Latin run in e.g. GPT-4.1 (2026).
# Mark the edges of contiguous Latin text, not the whole Persian paragraph.
_ASCII_RUN = re.compile(r"[\x21-\x7e]+(?: [\x21-\x7e]+)*")
_LATIN_OR_DIGIT = re.compile(r"[0-9A-Za-z]")


def _visual_html(text):
    def isolate(match):
        run = match.group()
        return "‎" + run + "‎" if _LATIN_OR_DIGIT.search(run) else run

    content = html.escape(_ASCII_RUN.sub(isolate, text)).replace("\n", "<br/>")
    return '<div lang="fa" dir="rtl">' + content + "</div>"


def render_paragraph(
    page, rect, text, font_size, color=(0, 0, 0), bold=False, italic=False
):
    """Draw only after staging a complete, selectable result. No redaction."""
    import pymupdf as pdf
    from aidea_persian_text import prepare_selectable_page

    rect = pdf.Rect(rect)
    if (
        rect.is_empty
        or rect.is_infinite
        or not text.strip()
        or not math.isfinite(font_size)
        or not 0 < font_size <= 256
    ):
        return False
    if any(not math.isfinite(v) for v in rect) or not page.rect.contains(rect):
        return False
    rgb = tuple(round(255 * max(0.0, min(1.0, v))) for v in color)
    css = (
        "*{margin:0;padding:0} div{"
        f"font-size:{font_size:.4f}pt;font-family:serif;line-height:1.22;"
        f"font-weight:{'bold' if bold else 'normal'};"
        f"font-style:{'italic' if italic else 'normal'};"
        f"color:rgb({rgb[0]},{rgb[1]},{rgb[2]});"
        # In the pinned Story renderer `right` on an RTL block is flipped
        # to the left; `start` correctly aligns to the right edge.
        "text-align:start;}"
    )
    with pdf.open() as stage:
        shaped = stage.new_page(width=rect.width, height=rect.height)
        spare, _ = shaped.insert_htmlbox(
            shaped.rect,
            _visual_html(text),
            css=css,
            scale_low=min(1, max(0.4, 5 / font_size)),
        )
        if spare < 0:
            return False
        # A wrap/ligature that cannot be matched to the logical string is
        # not safe to replace. Other paragraphs on this page can still work.
        try:
            selectable = prepare_selectable_page(shaped, text)
        except ValueError:
            return False
        with selectable:
            page.show_pdf_page(rect, selectable, 0, keep_proportion=False, overlay=True)
    return True
