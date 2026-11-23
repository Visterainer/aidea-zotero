"""Keep translated PDF text extractable without changing its drawing commands."""

from collections import Counter
from copy import copy
import json
import os
import re
from tempfile import NamedTemporaryFile
from unicodedata import category, normalize


def install_space_mapping():
    from babeldoc.format.pdf.document_il.backend import pdf_creater

    make_tounicode = pdf_creater.make_tounicode

    def make_tounicode_with_spaces(cmap, used):
        # BabelDOC selects glyphs by outline when rebuilding ToUnicode after
        # subsetting. Spaces have an advance but no outline. Keep their
        # original Unicode mapping so readers do not extract the raw CID.
        spaces = {
            glyph for glyph, code in cmap.items()
            if 0x20 <= code <= 0x3000 and category(chr(code)) == "Zs"
        }
        return make_tounicode(cmap, sorted(set(used) | spaces))

    pdf_creater.make_tounicode = make_tounicode_with_spaces


_NUMBER = r"[+\-−]?\d+(?:\.\d+)?%?"
_NUMBER_LIST = re.compile(rf"{_NUMBER}(?:\s*[,;，；、]\s*{_NUMBER})+")
_LIST_PUNCTUATION = re.compile(r"[\s,;，；、]+")
_FORMULA_CALL = re.compile(r"[A-Za-z_]\w*\s*\(")
_FORMULA_FIELD = re.compile(r"\$[A-Za-z_]\w*")
_FORMULA_PART = re.compile(
    r"[A-Za-z_]\w*(?=\s*\()|\$[A-Za-z_]\w*|\d+(?:\.\d+)?(?:[eE][+\-−]?\d+)?"
    r"|[\s(),.\[\]{}+\-−*/%^<>=!:;]"
)


def _contains_only_formula_code(text):
    # A listing can contain row IDs and multiple expressions in one detected
    # paragraph. Require a call and a dollar-prefixed operand, and reject any
    # prose outside the expression tokens.
    return (
        _FORMULA_FIELD.search(text) is not None
        and _FORMULA_CALL.search(text) is not None
        and not _FORMULA_PART.sub("", text)
    )


def _preserved_data(text):
    if not isinstance(text, str) or not (text := text.strip()):
        return False
    return bool(_NUMBER_LIST.fullmatch(text) or _LIST_PUNCTUATION.fullmatch(text)
                or _contains_only_formula_code(text))


def install_data_paragraph_preservation():
    from babeldoc.format.pdf.document_il.midend import il_translator, il_translator_llm_only
    from babeldoc.format.pdf.document_il.utils.paragraph_helper import is_pure_numeric_paragraph

    def is_preserved_data(paragraph):
        text = getattr(paragraph, "unicode", None)
        if is_pure_numeric_paragraph(paragraph):
            return True
        # Layout detection can place list separators in a separate paragraph.
        return _preserved_data(text)

    # Both the batched translator and its single-paragraph fallback import
    # their own reference to the helper. Keep the original PDF glyphs in both.
    il_translator.is_pure_numeric_paragraph = is_preserved_data
    il_translator_llm_only.is_pure_numeric_paragraph = is_preserved_data


def install_rust_data_preservation():
    """Preserve numeric lists and code at the engine's translator callback."""
    from babeldoc.rust_translation_service import RustTranslatorService

    translate = RustTranslatorService.translate
    llm_translate = RustTranslatorService.llm_translate

    def translate_data(self, text, rate_limit_params=None):
        if _preserved_data(text):
            return text
        return translate(self, text, rate_limit_params)

    def translate_batch(self, prompt, rate_limit_params=None):
        marker = "Now translate the following text:\n"
        if isinstance(prompt, str) and marker in prompt:
            text = prompt.rsplit(marker, 1)[1].strip()
            if _preserved_data(text):
                return text
        rows = _translation_batch(prompt)
        protected = {str(row["id"]): row for row in rows if _preserved_data(row["input"])}
        if protected and len(protected) == len(rows):
            return json.dumps([{"id": row["id"], "output": row["input"]} for row in protected.values()],
                              ensure_ascii=False)
        result = llm_translate(self, prompt, rate_limit_params)
        if not protected:
            return result
        try:
            response = json.loads(re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", result))
        except (ValueError, TypeError):
            return result
        if not isinstance(response, list):
            return result
        for row in response:
            if isinstance(row, dict) and str(row.get("id")) in protected:
                row["output"] = protected[str(row["id"])]["input"]
        return json.dumps(response, ensure_ascii=False)

    RustTranslatorService.translate = translate_data
    RustTranslatorService.llm_translate = translate_batch


def _translation_batch(prompt):
    if not isinstance(prompt, str):
        return []
    # The real request follows the example batch in the native prompt.
    for marker in reversed(list(re.finditer(r"\[\s*\{", prompt))):
        try:
            rows, _ = json.JSONDecoder().raw_decode(prompt, marker.start())
        except ValueError:
            continue
        if rows and all(isinstance(row, dict) and isinstance(row.get("input"), str)
                        and isinstance(row.get("id"), (str, int)) for row in rows):
            return rows
    return []


_NUMERIC_TOKEN = re.compile(r"[-+−]?\d+(?:\.\d+)?")
_NON_NUMERIC = re.compile(r"[^\d\s,.;%+−-]")


def _numeric_columns(page):
    rows = {}
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            if line["dir"] != (1, 0):
                continue
            for span in line["spans"]:
                text = span["text"].strip()
                if "," in text and _NUMBER_LIST.fullmatch(text) and len(_NUMERIC_TOKEN.findall(text)) > 1:
                    rows.setdefault(round(span["origin"][0]), []).append(span)
    for spans in rows.values():
        spans.sort(key=lambda span: span["origin"][1])
        column = []
        for span in spans:
            if column and span["origin"][1] - column[-1]["origin"][1] > 2 * span["size"]:
                if len(column) > 1:
                    yield column
                column = []
            column.append(span)
        if len(column) > 1:
            yield column


def redact_only_page_text(page, rectangles):
    """Remove glyphs from a working page while keeping existing annotations."""
    import pymupdf as pdf

    document, xref = page.parent, page.xref
    annotations = document.xref_get_key(xref, "Annots")[1]
    try:
        if annotations != "null":
            document.xref_set_key(xref, "Annots", "[]")
            page = document.reload_page(page)
        for bounds in rectangles:
            page.add_redact_annot(bounds, fill=False, cross_out=False)
        page.apply_redactions(images=pdf.PDF_REDACT_IMAGE_NONE,
                              graphics=pdf.PDF_REDACT_LINE_ART_NONE)
    finally:
        if annotations != "null":
            document.xref_set_key(xref, "Annots", annotations)
    return document.reload_page(page) if annotations != "null" else page


def restore_numeric_columns(source_path, output_path, *, dual, alternating, translated_first, pages):
    """Repair reflowed separators in columns consisting entirely of number lists."""
    import pymupdf as pdf

    if not pages:
        return 0
    output_path = os.fspath(output_path)
    temporary = None
    restored = 0
    font = pdf.Font("tiro")
    try:
        with pdf.open(source_path) as source, pdf.open(output_path) as output:
            for number in sorted(pages):
                original = source[number - 1]
                index = number - 1
                if dual and alternating:
                    index = index * 2 + int(not translated_first)
                page = output[index]
                dx = dy = 0
                if dual and not alternating:
                    dx = 0 if translated_first else page.rect.width - original.rect.width
                    dy = (page.rect.height - original.rect.height) / 2
                shift = (dx, dy, dx, dy)
                columns = list(_numeric_columns(original))
                if not columns:
                    continue
                edits = []
                text_boxes = [
                    (chr(char[0]), pdf.Rect(char[3]))
                    for span in page.get_texttrace() for char in span["chars"]
                ]
                for spans in columns:
                    original_box = pdf.Rect()
                    for span in spans:
                        original_box |= pdf.Rect(span["bbox"])
                    original_box += (-0.75, -0.9, 0.75, 0.9)
                    expected = [span["text"].strip() for span in spans]
                    if any(not font.has_glyph(ord(char)) for line in expected for char in line):
                        continue
                    target = original_box + shift
                    actual = page.get_text(clip=target)
                    if "".join(normalize("NFKC", actual).split()) == "".join("".join(expected).split()):
                        continue
                    # A partially overlapping row or neighboring text makes
                    # the region ambiguous. Preserve the engine's output.
                    if _NON_NUMERIC.search(actual) or any(
                        box.intersects(target) and _NON_NUMERIC.search(char) for char, box in text_boxes
                    ):
                        continue
                    if Counter(_NUMERIC_TOKEN.findall(actual)) != Counter(_NUMERIC_TOKEN.findall(" ".join(expected))):
                        continue
                    spans_with_text = [(span, text) for span, text in zip(spans, expected, strict=True)]
                    edits.append((target, spans_with_text))
                if not edits:
                    continue
                page = redact_only_page_text(page, (bounds for bounds, _ in edits))
                for _, spans in edits:
                    for span, text in spans:
                        anchor = pdf.Point(span["origin"]) + (dx, dy)
                        scale = pdf.Rect(span["bbox"]).width / font.text_length(text, fontsize=span["size"])
                        color = tuple((span["color"] >> n & 255) / 255 for n in (16, 8, 0))
                        page.insert_text(anchor, text, fontname="tiro", fontsize=span["size"],
                                         color=color, morph=(anchor, pdf.Matrix(scale, 1)))
                    restored += 1
            if restored:
                with NamedTemporaryFile(dir=os.path.dirname(output_path), suffix=".pdf", delete=False) as f:
                    temporary = f.name
                output.save(temporary, garbage=3, deflate=True)
        if temporary:
            os.replace(temporary, output_path)
        return restored
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def _inside_table(box, table):
    if box is None:
        return False
    area = (box.x2 - box.x) * (box.y2 - box.y)
    if area <= 0:
        return False
    width = max(0, min(box.x2, table.x2) - max(box.x, table.x))
    height = max(0, min(box.y2, table.y2) - max(box.y, table.y))
    return width * height >= 0.9 * area


def _join_table_line_wraps(page, regions):
    from babeldoc.format.pdf.document_il.il_version_1 import Box

    removed = set()
    for region in regions:
        cells = [p for p in page.pdf_paragraph if _inside_table(p.box, region)]
        for upper in cells:
            text = (upper.unicode or "").rstrip()
            if id(upper) in removed or not re.search(r"[A-Za-z]{2,}[-‐]$", text):
                continue
            box = upper.box
            line_height = box.y2 - box.y
            following = next((
                p for p in cells
                if id(p) not in removed and p.xobj_id == upper.xobj_id
                and abs(p.box.x - box.x) <= 1.5
                and p.box.y < box.y
                and -1.0 <= box.y - p.box.y2 <= line_height
                and re.match(r"^[a-z]", (p.unicode or "").lstrip())
            ), None)
            if following is None:
                continue
            upper.pdf_paragraph_composition.extend(following.pdf_paragraph_composition)
            upper.unicode = text[:-1] + following.unicode.lstrip()
            upper.box = Box(
                x=min(box.x, following.box.x), y=following.box.y,
                x2=max(box.x2, following.box.x2), y2=box.y2,
            )
            removed.add(id(following))
    if removed:
        page.pdf_paragraph = [p for p in page.pdf_paragraph if id(p) not in removed]


def install_table_cell_bounds():
    from babeldoc.format.pdf.document_il.midend.styles_and_formulas import StylesAndFormulas
    from babeldoc.format.pdf.document_il.midend.typesetting import Typesetting

    process_page = StylesAndFormulas.process_page
    find_layout = Typesetting._find_optimal_scale_and_layout
    render_paragraph = Typesetting.render_paragraph
    typeset_document = Typesetting.typesetting_document
    source_cells = {}

    def save_table_cells(self, page):
        regions = [
            layout.box for layout in page.page_layout
            if layout.class_name == "table" and layout.box is not None
        ]
        if not regions:
            return process_page(self, page)
        _join_table_line_wraps(page, regions)
        process_page(self, page)
        for paragraph in page.pdf_paragraph:
            if paragraph.layout_label in {"table_caption", "table_title", "table_footnote"}:
                continue
            if any(_inside_table(paragraph.box, region) for region in regions):
                source = copy(paragraph)
                source.box = copy(paragraph.box)
                source_cells[id(paragraph)] = (paragraph, source)

    def fit_table_cell(self, paragraph, page, units, initial_scale=1.0,
                       use_english_line_break=True, apply_layout=False):
        cell = source_cells.get(id(paragraph))
        if cell is None:
            return find_layout(self, paragraph, page, units, initial_scale,
                               use_english_line_break, apply_layout)
        # The standard typesetter borrows room below and beside a paragraph.
        # In a table this can cross a rule or intrude on the adjacent cell.
        bounded = copy(self)
        bounded.get_max_bottom_space = lambda box, _page: box.y - 2
        bounded.get_max_right_space = lambda box, _page: box.x2 + 5
        return find_layout(
            bounded, paragraph, page, units, max(0.55, initial_scale),
            use_english_line_break, apply_layout,
        )

    def render_table_cell(self, paragraph, page, fonts):
        cell = source_cells.get(id(paragraph))
        if cell is None:
            return render_paragraph(self, paragraph, page, fonts)
        _, source = cell
        old_curve_count = len(page.pdf_curve)
        old_form_count = len(page.pdf_form)
        render_paragraph(self, paragraph, page, fonts)
        # Roll back the abandoned layout and let the native renderer flatten
        # the original glyphs, as it does for untranslated paragraphs.
        if not paragraph.pdf_paragraph_composition or (paragraph.scale or 0) < 0.55:
            paragraph.box = source.box
            paragraph.unicode = source.unicode
            paragraph.pdf_paragraph_composition = source.pdf_paragraph_composition
            del page.pdf_curve[old_curve_count:]
            del page.pdf_form[old_form_count:]
            return render_paragraph(self, paragraph, page, fonts)

    def clear_after_typesetting(self, document):
        try:
            return typeset_document(self, document)
        finally:
            for page in document.page:
                for paragraph in page.pdf_paragraph:
                    source_cells.pop(id(paragraph), None)

    StylesAndFormulas.process_page = save_table_cells
    Typesetting._find_optimal_scale_and_layout = fit_table_cell
    Typesetting.render_paragraph = render_table_cell
    Typesetting.typesetting_document = clear_after_typesetting


_TEX_EXTENSION_FONT = re.compile(r"(?:txex[a-z]*|(?:cmex|lmex)[0-9]+)$", re.IGNORECASE)
_DELIMITERS = {
    "parenleft": "(", "parenright": ")", "bracketleft": "[", "bracketright": "]",
    "braceleft": "{", "braceright": "}", "angleleft": "⟨", "angleright": "⟩",
    "floorleft": "⌊", "floorright": "⌋", "ceilingleft": "⌈", "ceilingright": "⌉",
}
_SIZED_DELIMITER = re.compile(r"([a-z]+?)(?:bigg|big)(?:\..+)?$", re.IGNORECASE)
_BF_BLOCK = re.compile(rb"(\d+)\s+begin(bfchar|bfrange)\s+(.*?)\s+end\2", re.DOTALL)
_BF_CHAR = re.compile(rb"<([a-f0-9]{2})>\s*<[a-f0-9]+>", re.IGNORECASE)
_BF_RANGE = re.compile(
    rb"<([a-f0-9]{2})>\s*<([a-f0-9]{2})>\s*(?:<[a-f0-9]+>|\[[^\]]*\])", re.IGNORECASE,
)


def _complete_tex_delimiter_cmap(cmap, encoding):
    """Add only absent entries for intact delimiters in a one-byte CMap."""
    if not re.search(rb"\b1\s+begincodespacerange\s+<00>\s*<ff>\s+endcodespacerange\b",
                     cmap, re.IGNORECASE):
        return cmap
    blocks = list(_BF_BLOCK.finditer(cmap))
    if not blocks or len(blocks) != cmap.count(b"beginbfchar") + cmap.count(b"beginbfrange"):
        return cmap
    covered = set()
    for count, kind, data in (match.groups() for match in blocks):
        entries = (_BF_CHAR if kind == b"bfchar" else _BF_RANGE).findall(data)
        if len(entries) != int(count):
            return cmap
        if kind == b"bfchar":
            covered.update(int(code, 16) for code in entries)
        else:
            for start, end in entries:
                covered.update(range(int(start, 16), int(end, 16) + 1))

    additions = []
    for code, name in enumerate(encoding[:256]):
        sized = _SIZED_DELIMITER.fullmatch(name) if isinstance(name, str) else None
        if sized and code not in covered:
            char = _DELIMITERS.get(sized[1].lower())
            if char:
                additions.append(f"<{code:02X}> <{ord(char):04X}>\n")
    if not additions:
        return cmap
    block = f"{len(additions)} beginbfchar\n{''.join(additions)}endbfchar\n"
    return cmap.replace(b"endcmap", block.encode("ascii") + b"endcmap", 1)


def repair_math_delimiters(path):
    """Repair extraction of sized TeX delimiters without touching glyphs."""
    import fitz
    from fontTools.misc import psLib

    changes = 0
    temporary = None
    try:
        with fitz.open(path) as doc:
            fonts = {
                font[0] for page in doc for font in page.get_fonts()
                if font[2] == "Type1" and _TEX_EXTENSION_FONT.fullmatch(font[3].split("+")[-1])
            }
            # The embedded font's encoding is authoritative only when the PDF
            # has no explicit encoding or differences dictionary.
            for xref in fonts:
                kind, reference = doc.xref_get_key(xref, "ToUnicode")
                if kind != "xref" or doc.xref_get_key(xref, "Encoding")[0] != "null":
                    continue
                cmap_xref = int(reference.split()[0])
                cmap = doc.xref_stream(cmap_xref)
                _, extension, _, program = doc.extract_font(xref)
                if not cmap or extension != "pfa" or not program:
                    continue
                try:
                    encoding = psLib.suckfont(program, "ascii").get("Encoding")
                except Exception:
                    continue
                if not isinstance(encoding, (tuple, list)):
                    continue
                updated = _complete_tex_delimiter_cmap(cmap, encoding)
                if updated != cmap:
                    mapping = doc.get_new_xref()
                    doc.update_object(mapping, "<<>>")
                    doc.update_stream(mapping, updated)
                    doc.xref_set_key(xref, "ToUnicode", f"{mapping} 0 R")
                    changes += 1
            if changes:
                with NamedTemporaryFile(dir=os.path.dirname(os.path.abspath(path)), delete=False) as stream:
                    temporary = stream.name
                doc.save(temporary, deflate=True)
        if changes:
            os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
    return changes
