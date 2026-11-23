"""Recognize image-only PDF pages locally before BabelDOC translates them."""

from collections import Counter
from contextlib import contextmanager
from copy import copy
from dataclasses import dataclass
from hashlib import sha256
import os
from pathlib import Path
import re
from statistics import median
from tempfile import NamedTemporaryFile
from urllib.request import urlopen

import fitz


# Official tessdata_fast 4.1.0 data, downloaded on demand and checked before use.
_MODEL_ROOT = "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0"
_MODELS = {
    "en": ("eng", "7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2"),
    "zh-cn": ("chi_sim", "a5fcb6f0db1e1d6d8522f39db4e848f05984669172e584e8d76b6b3141e1f730"),
    "zh-tw": ("chi_tra", "529c5b5797d64b126065cd55f2bb4c7fd7b15790798091b1ff259941a829330b"),
    "ja": ("jpn", "1f5de9236d2e85f5fdf4b3c500f2d4926f8d9449f28f5394472d9e8d83b91b4d"),
    "ko": ("kor", "6b85e11d9bbf07863b97b3523b1b112844c43e713df8b66418a081fd1060b3b2"),
    "fr": ("fra", "ced037562e8c80c13122dece28dd477d399af80911a28791a66a63ac1e3445ca"),
    "de": ("deu", "19d219bbb6672c869d20a9636c6816a81eb9a71796cb93ebe0cb1530e2cdb22d"),
    "es": ("spa", "6f2e04d02774a18f01bed44b1111f2cd7f3ba7ac9dc4373cd3f898a40ea6b464"),
    "ru": ("rus", "e16e5e036cce1d9ec2b00063cf8b54472625b9e14d893a169e2b0dedeb4df225"),
    "pt": ("por", "c4932b937207a9514b7514d518b931a99938c02a28a5a5a553f8599ed58b7deb"),
    "ar": ("ara", "e3206d3dc87fd50c24a0fb9f01838615911d25168f4e64415244b67d2bb3e729"),
    "fa": ("fas", "db1c0a91208aff00d3cf1ed2c1d23f76419afd5f024688b4f71adc3f2ce4a505"),
    "hi": ("hin", "4c73ffc59d497c186b19d1e90f5d721d678ea6b2e277b719bee4e2af12271825"),
    "it": ("ita", "b8f89e1e785118dac4d51ae042c029a64edb5c3ee42ef73027a6d412748d8827"),
    "nl": ("nld", "ced0e5e046a84c908a6aa7accbef9a232c4a5d9a8276691b81c6ee64d02963f6"),
    "pl": ("pol", "c4476cdbc0e33d898d32345122b7be1cbf85ace15f920f06c7714756e1ef79b2"),
    "tr": ("tur", "7393381111e1152420fc4092cb44eef4237580d21b92bf30d7d221aad192c6b7"),
    "vi": ("vie", "79df64caf7bcfb2a27df5042ecb6121e196eada34da774956995747636d5bfa1"),
    "th": ("tha", "294227cc2d1292b0acb28d61d4115c88252b96d466ca90b417cf4cf0c67bf07c"),
    "id": ("ind", "69786901da87ab8766c1ea7fbb10b28f2110c14da3f6c8f2735df131fba95d88"),
    "uk": ("ukr", "d59e53e2bded32f4445f124b4b00240fcac7e8044c003ab822ccb94f0b3db59b"),
}
_MAX_MODEL_BYTES = 16 * 1024 * 1024
_PROSE_LAYOUTS = {"abstract", "content", "paragraph", "paragraph_hybrid", "plain text", "text", "tiny text"}
_OCR_WORD = re.compile(rb"(?m)^(<[0-9A-Fa-f]+)>[ \t]*Tj$")
_OCR_NUMBER_WITH_UNIT = re.compile(
    r"([+−-]?\d+[.,]\d+)([fpnumkMGTµμ]?(?:V|A|W|Hz|Pa|Ω|F|J|N|s|g|m)|°[CF])"
)
_UNSPACED_OCR_LANGUAGES = {"chi_sim", "chi_tra", "jpn", "tha"}
_TEXT_MARKUP_CREATORS = {
    fitz.PDF_ANNOT_HIGHLIGHT: fitz.Page.add_highlight_annot,
    fitz.PDF_ANNOT_UNDERLINE: fitz.Page.add_underline_annot,
    fitz.PDF_ANNOT_STRIKE_OUT: fitz.Page.add_strikeout_annot,
}


class ScanOCRError(RuntimeError):
    pass


def _pdf_array(numbers):
    return "[" + " ".join(f"{number:.8f}" for number in numbers) + "]"


@dataclass
class _TextMarkup:
    kind: int
    quads: list
    color: tuple
    opacity: float
    flags: int
    info: dict

    @classmethod
    def capture(cls, annot):
        vertices = annot.vertices
        if not vertices or len(vertices) % 4:
            return None
        quads = [fitz.Quad(vertices[i:i + 4]) for i in range(0, len(vertices), 4)]
        quads = [quad for quad in quads if quad.is_convex and not quad.is_empty]
        if not quads:
            return None
        color = tuple(annot.colors["stroke"] or ())
        return cls(annot.type[0], quads, color, annot.opacity, annot.flags, annot.info)

    def placement_key(self, quads):
        return (self.kind, self.info["content"], self.info["title"], self.color,
                round(self.opacity, 4), self.flags,
                tuple((round(p.x, 2), round(p.y, 2)) for quad in quads for p in quad))

    def project(self, matrix, clip):
        projected = (quad * matrix for quad in self.quads)
        return [quad for quad in projected if not (quad.rect & clip).is_empty]

    @staticmethod
    def bounded_quads(quads, clip):
        bounded = []
        for quad in quads:
            if clip.contains(quad.rect):
                bounded.append(quad)
                continue
            clamped = fitz.Quad([
                fitz.Point(min(max(p.x, clip.x0), clip.x1),
                           min(max(p.y, clip.y0), clip.y1))
                for p in quad
            ])
            bounded.append(clamped if clamped.is_convex and not clamped.is_empty
                           else (quad.rect & clip).quad)
        return bounded

    def place(self, page, quads, clip, *, editable_quads=None):
        if not quads:
            return
        annot = _TEXT_MARKUP_CREATORS[self.kind](page, quads)
        annot.set_info(self.info)
        annot.set_flags(self.flags)
        if self.color:
            annot.set_colors(stroke=self.color)
        if self.opacity >= 0:
            annot.set_opacity(self.opacity)
        annot.update()
        # Build the vector appearance from the original slope, then clip it.
        # Rebuilding it from clamped vertices deforms the visible part of a
        # slanted highlight or line. Private stages keep the unclipped quads
        # so the final overlay can render the same shape again.
        document = page.parent
        to_pdf = ~page.transformation_matrix
        if not clip.contains(annot.rect):
            kind, reference = document.xref_get_key(annot.xref, "AP/N")
            if kind == "xref":
                xref = int(reference.split()[0])
                # The generated Form uses page coordinates. Matching the
                # annotation rectangle to this BBox keeps the appearance
                # at its original scale and limits the interactive area.
                box = _pdf_array((annot.rect & clip) * to_pdf)
                document.xref_set_key(xref, "BBox", box)
                document.xref_set_key(annot.xref, "Rect", box)
        if editable_quads is not None and editable_quads != quads:
            document.xref_set_key(annot.xref, "QuadPoints", _pdf_array(
                value for quad in editable_quads for point in quad * to_pdf for value in point
            ))


def _page_text_markup(page):
    for annot in page.annots(types=tuple(_TEXT_MARKUP_CREATORS)):
        markup = _TextMarkup.capture(annot)
        if markup is not None:
            yield annot.xref, markup


def restore_dual_text_markup(source_path, output_path, alternating=False, translated_first=False):
    """Copy text markup into the original-language part of a finished dual PDF."""
    output_path = Path(output_path)
    temporary = None
    count = 0
    try:
        with fitz.open(source_path) as original, fitz.open(output_path) as dual:
            markup = {page.number: list(_page_text_markup(page)) for page in original}
            if not any(markup.values()):
                return 0
            # BabelDOC sanitizes annotations before composition. The app keeps
            # every source page, including pages skipped by the translator.
            if len(dual) != len(original) * (2 if alternating else 1):
                raise ValueError("Cannot match bilingual pages to the source for text markup restoration")
            for source_index, marks in markup.items():
                if not marks:
                    continue
                source = original[source_index]
                number = source.number * 2 + int(translated_first) if alternating else source.number
                page = dual[number]
                if alternating:
                    offset = fitz.Identity
                else:
                    x = page.rect.width - source.rect.width if translated_first else 0
                    y = (page.rect.height - source.rect.height) / 2
                    offset = fitz.Matrix(1, 0, 0, 1, x, y)
                matrix = source.rotation_matrix * offset
                clip = source.rect * offset
                existing = Counter(mark.placement_key(mark.quads) for _, mark in _page_text_markup(page))
                for _, mark in marks:
                    quads = mark.project(matrix, clip)
                    if not quads:
                        continue
                    editable_quads = mark.bounded_quads(quads, clip)
                    key = mark.placement_key(editable_quads)
                    if existing[key]:
                        existing[key] -= 1
                    else:
                        mark.place(page, quads, clip, editable_quads=editable_quads)
                        count += 1
            if count:
                with NamedTemporaryFile(dir=output_path.parent, suffix=".pdf", delete=False) as stream:
                    temporary = Path(stream.name)
                dual.save(temporary, deflate=True)
        if temporary is not None:
            os.replace(temporary, output_path)
        return count
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _language_data(source_lang):
    code = source_lang.strip().lower().replace("_", "-")
    code = {"zh": "zh-cn", "zh-hans": "zh-cn", "zh-hant": "zh-tw"}.get(code, code)
    model = _MODELS.get(code) or _MODELS.get(code.split("-")[0])
    if model is None:
        raise ScanOCRError(f"No OCR model for source language {source_lang}.")
    name, expected_hash = model
    filename = f"{name}.traineddata"
    configured = os.environ.get("TESSDATA_PREFIX")
    if configured and (Path(configured) / filename).is_file():
        return name, Path(configured)

    directory = Path.home() / ".cache" / "aidea" / "tessdata-fast-4.1.0"
    target = directory / filename
    temporary = None
    try:
        if target.is_file() and sha256(target.read_bytes()).hexdigest() == expected_hash:
            return name, directory
        with urlopen(f"{_MODEL_ROOT}/{filename}", timeout=25) as response:
            data = response.read(_MAX_MODEL_BYTES + 1)
        if len(data) > _MAX_MODEL_BYTES or sha256(data).hexdigest() != expected_hash:
            raise ScanOCRError(f"OCR language data failed verification: {name}.")
        directory.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(dir=directory, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
        os.replace(temporary, target)
    except OSError as exc:
        raise ScanOCRError(
            f"Could not prepare OCR language data ({name}). Check the connection "
            "to raw.githubusercontent.com and retry, or configure TESSDATA_PREFIX."
        ) from exc
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return name, directory


def _needs_recognition(page):
    # A small digital page number is common over a scanned background.
    for word in page.get_text("words"):
        token = word[4]
        if any(char.isalpha() for char in token):
            return False
    area = page.rect.get_area()
    return area > 0 and any(
        ((fitz.Rect(info["bbox"]) * page.rotation_matrix) & page.rect).get_area() >= area * 0.65
        for info in page.get_image_info()
    )


def _preserve_ocr_word_spaces(document, page, language):
    if language in _UNSPACED_OCR_LANGUAGES:
        return
    for stream in page.get_contents():
        data = document.xref_stream(stream)
        # MuPDF writes each OCR word as its own invisible text-show operation.
        # Td resets the next word's position, so a space preserves the logical
        # boundary without moving subsequent words or modifying the scan.
        if b"\n3 Tr\n" in data and b"/F0 " in data:
            updated = _OCR_WORD.sub(_space_ocr_word, data)
            if updated != data:
                document.update_stream(stream, updated)


def _space_ocr_word(match):
    word = match[1]
    try:
        text = bytes.fromhex(word[1:].decode("ascii")).decode("utf-16-be")
    except ValueError:
        return word + b"0020>Tj"
    measurement = _OCR_NUMBER_WITH_UNIT.fullmatch(text)
    if measurement:
        # Tesseract occasionally reports a decimal and its SI unit as one
        # word. This text layer is invisible and the next Td positions the
        # next word independently, so the original table pixels stay intact.
        spaced = " ".join(measurement.groups()).encode("utf-16-be").hex()
        word = b"<" + spaced.encode("ascii")
    return word + b"0020>Tj"


def _pixels_for_ocr(pixels):
    """Remove grid rules from the recognition image without changing the scan."""
    import cv2
    import numpy as np

    rgb = np.frombuffer(pixels.samples_mv, dtype=np.uint8).reshape(
        pixels.height, pixels.width, 3
    )
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    ink = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)[1]
    horizontal = cv2.morphologyEx(
        ink, cv2.MORPH_OPEN, np.ones((1, max(40, pixels.width // 22)), np.uint8)
    )
    vertical = cv2.morphologyEx(
        ink, cv2.MORPH_OPEN, np.ones((max(40, pixels.height // 32), 1), np.uint8)
    )
    if not cv2.bitwise_and(horizontal, vertical).any():
        return pixels

    rules = cv2.dilate(cv2.bitwise_or(horizontal, vertical), np.ones((5, 5), np.uint8))
    cleaned = cv2.inpaint(rgb, rules, 2, cv2.INPAINT_TELEA)
    result = fitz.Pixmap(fitz.csRGB, pixels.width, pixels.height, cleaned.tobytes(), False)
    result.set_dpi(pixels.xres, pixels.yres)
    return result


def _rotate_scan(pixels, quarter_turns):
    import numpy as np

    rgb = np.frombuffer(pixels.samples_mv, dtype=np.uint8).reshape(
        pixels.height, pixels.width, 3
    )
    rotated = np.rot90(rgb, quarter_turns)
    result = fitz.Pixmap(fitz.csRGB, rotated.shape[1], rotated.shape[0], rotated.tobytes(), False)
    dpi = (pixels.yres, pixels.xres) if quarter_turns % 2 else (pixels.xres, pixels.yres)
    result.set_dpi(*dpi)
    return result


def _orientation_score(pixels, language, tessdata):
    data = pixels.pdfocr_tobytes(language=language, tessdata=str(tessdata))
    with fitz.open("pdf", data) as probe:
        words = probe[0].get_text("words")
    # Wrong orientations often turn punctuation, ruling and formulas into
    # short fragments. Score alphabetic runs rather than total characters.
    minimum = 1 if language in _UNSPACED_OCR_LANGUAGES else 3
    tokens = (word[4].strip("!?.,:;()[]{}'\"-/|“”«»") for word in words)
    return sum(min(len(token), 16) for token in tokens
               if len(token) >= minimum and token.isalpha())


def _orient_scan(pixels, language, tessdata):
    # Probe at half the usual OCR resolution. Use the original, full-quality
    # raster for the selected orientation and leave weak evidence unchanged.
    scale = min(1, 108 / max(pixels.xres, pixels.yres))
    width = max(1, round(pixels.width * scale))
    height = max(1, round(pixels.height * scale))
    bounds = fitz.IRect(pixels.x, pixels.y, pixels.x + width, pixels.y + height)
    preview = fitz.Pixmap(pixels, width, height, bounds)
    preview.set_dpi(round(pixels.xres * scale), round(pixels.yres * scale))
    scores = [
        _orientation_score(_rotate_scan(preview, turns) if turns else preview,
                           language, tessdata)
        for turns in range(4)
    ]
    best = max(range(4), key=scores.__getitem__)
    runner_up = max(score for turns, score in enumerate(scores) if turns != best)
    if best and scores[best] >= 24 and scores[best] - runner_up >= max(8, runner_up * 0.12):
        return _rotate_scan(pixels, best), best
    return pixels, 0


@contextmanager
def _recognize_page(pixels, language, tessdata):
    recognition_pixels = _pixels_for_ocr(pixels)
    layers = (recognition_pixels, pixels) if recognition_pixels is not pixels else (pixels,)
    for layer in layers:
        data = layer.pdfocr_tobytes(language=language, tessdata=str(tessdata))
        with fitz.open("pdf", data) as text_pdf:
            page = text_pdf[0]
            if not page.get_text().strip():
                continue
            if layer is not pixels:
                page.replace_image(page.get_images()[0][0], pixmap=pixels)
            _preserve_ocr_word_spaces(text_pdf, page, language)
            yield text_pdf
            return
    yield None


def _normalize_page_content(document, page):
    media, crop = page.mediabox, page.cropbox
    relative_crop = crop - (media.x0, 0, media.x0, 0)
    if page.rotation:
        # MuPDF derotates against the current CropBox but resets page boxes on
        # a quarter turn. Compute rotation in full MediaBox coordinates.
        full_page = fitz.Rect(media.x0, 0, media.x1, media.height)
        if crop != full_page:
            page.set_cropbox(full_page)
            page = document.reload_page(page)
        relative_crop *= page.rotation_matrix
        page.remove_rotation()
        page = document.reload_page(page)
    rotated_media = page.mediabox
    # The engine expands MediaBox to a zero origin and ignores CropBox when
    # assembling the source side. Move both the visible box and page content.
    x = rotated_media.x0 + relative_crop.x0
    y = rotated_media.y1 - relative_crop.y1
    if (x or y) and page.get_contents():
        contents = document.get_new_xref()
        document.update_object(contents, "<<>>")
        shift = f"1 0 0 1 {-x:.8f} {-y:.8f} cm\n".encode("ascii")
        document.update_stream(contents, shift + page.read_contents())
        page.set_contents(contents)
    media_box = fitz.Rect(0, 0, relative_crop.width, relative_crop.height)
    if page.mediabox != media_box or page.cropbox != media_box:
        page.set_mediabox(media_box)
    return document.reload_page(page)


def _trim_cropped_text(page):
    """Remove text beyond the crop, preserving any visible ink."""
    visible = page.rect
    rectangles = [fitz.Rect(bbox) for span in page.get_texttrace()
                  for _, _, _, bbox in span["chars"]]
    edges = [rect for rect in rectangles if not rect.is_empty and not rect.is_infinite
             and not visible.contains(rect)]
    if not edges:
        return page

    # A Form's visual clipping does not stop PDF text extractors at the seam
    # of a bilingual spread. Keep the visible strokes of split glyphs as
    # small image patches and remove their out-of-bounds text operators.
    zoom = fitz.Matrix(4, 4)
    visible_pieces = sorted((rect & visible for rect in edges), key=lambda rect: (rect.y0, rect.x0))
    regions = []
    for rect in visible_pieces:
        if rect.is_empty:
            continue
        if regions and rect.intersects(regions[-1]):
            regions[-1] |= rect
        else:
            regions.append(rect)
    pixels = [page.get_pixmap(matrix=zoom, clip=rect, alpha=True, annots=False)
              for rect in regions]

    extent = fitz.Rect(visible)
    for rect in edges:
        extent |= rect
    margins = (
        fitz.Rect(extent.x0, extent.y0, visible.x0, extent.y1),
        fitz.Rect(visible.x1, extent.y0, extent.x1, extent.y1),
        fitz.Rect(visible.x0, extent.y0, visible.x1, visible.y0),
        fitz.Rect(visible.x0, visible.y1, visible.x1, extent.y1),
    )
    document, page_xref = page.parent, page.xref
    pending = next(page.annots(types=(fitz.PDF_ANNOT_REDACT,)), None)
    annotations = document.xref_get_key(page_xref, "Annots")[1] if pending else None
    try:
        if annotations is not None:
            # MuPDF applies every redaction attached to a page. Keep the
            # document's annotations detached while applying the crop margins.
            document.xref_set_key(page_xref, "Annots", "[]")
            page = document.reload_page(page)
        for margin in margins:
            if not margin.is_empty:
                page.add_redact_annot(margin, fill=False, cross_out=False)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                              graphics=fitz.PDF_REDACT_LINE_ART_NONE)
    finally:
        if annotations is not None:
            document.xref_set_key(page_xref, "Annots", annotations)
    if annotations is not None:
        page = document.reload_page(page)
    for patch in pixels:
        page.insert_image(fitz.Rect(patch.irect) * ~zoom, pixmap=patch)
    return page


def normalize_page_geometry(source, directory):
    """Normalize the visible PDF page geometry without rasterizing digital text."""
    source = Path(source)
    with fitz.open(source) as document:
        pages = [page.number for page in document
                 if page.rotation or page.mediabox.tl != fitz.Point(0, 0)
                 or page.cropbox != page.mediabox]
        if not pages:
            return None
        for number in pages:
            page = document[number]
            matrix = page.rotation_matrix
            media = page.mediabox
            cropped = page.cropbox != fitz.Rect(media.x0, 0, media.x1, media.height)
            marks = list(_page_text_markup(page))
            # remove_rotation moves annotation rectangles but does not rotate
            # text markup QuadPoints or regenerate their appearances.
            for xref, _ in marks:
                page.delete_annot(page.load_annot(xref))
            page = _normalize_page_content(document, page)
            if cropped:
                page = _trim_cropped_text(page)
            for _, mark in marks:
                mark.place(page, mark.project(matrix, page.rect), page.rect)
        destination = Path(directory) / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        document.save(destination, deflate=True)
    return destination


def _scan_pixels(page, dpi, marks):
    # Keep the appearance of other annotations. Rasterizing text markup would
    # obscure the OCR input and make that markup impossible to edit afterward.
    try:
        for xref, mark in marks:
            page.load_annot(xref).set_flags(mark.flags | fitz.PDF_ANNOT_IS_HIDDEN)
        return page.get_pixmap(dpi=dpi, colorspace=fitz.csRGB, alpha=False)
    finally:
        for xref, mark in marks:
            page.load_annot(xref).set_flags(mark.flags)


def prepare_input(source, stage_dir, source_lang, enabled, on_progress, log):
    """Make a private same-name copy only if there are raster pages to recognize."""
    source = Path(source)
    with fitz.open(source) as pdf:
        pages = [page.number for page in pdf if _needs_recognition(page)]
        if not pages:
            return None
        if not enabled:
            if len(pages) == len(pdf):
                raise ScanOCRError("This PDF has no usable text layer. Enable Automatic OCR and retry.")
            return None

        on_progress(0, len(pages))
        language, tessdata = _language_data(source_lang)
        recognized = 0
        processed = 0
        with fitz.open() as output:
            candidates = set(pages)
            for page in pdf:
                number = page.number
                if number in candidates:
                    # Limit the longest edge on exceptionally large scans.
                    dpi = min(216, max(1, int(5000 * 72 / max(page.rect.width, page.rect.height))))
                    marks = list(_page_text_markup(page))
                    pixels = _scan_pixels(page, dpi, marks)
                    raster_bounds = fitz.Rect(0, 0, pixels.width * 72 / dpi, pixels.height * 72 / dpi)
                    try:
                        pixels, turns = _orient_scan(pixels, language, tessdata)
                        with _recognize_page(pixels, language, tessdata) as text_pdf:
                            if text_pdf is not None:
                                destination = text_pdf[0]
                                rotation = fitz.Matrix(-90 * turns)
                                rotated_bounds = raster_bounds * rotation
                                offset = fitz.Matrix(1, 0, 0, 1, -rotated_bounds.x0, -rotated_bounds.y0)
                                matrix = page.rotation_matrix * rotation * offset
                                for _, mark in marks:
                                    mark.place(destination, mark.project(matrix, destination.rect), destination.rect)
                                output.insert_pdf(text_pdf)
                                recognized += 1
                                if turns:
                                    log(f"Local OCR rotated scan page {number + 1} by {turns * 90}° counterclockwise.")
                            else:
                                output.insert_pdf(pdf, from_page=number, to_page=number)
                                log(f"Local OCR found no text on page {number + 1}; preserved the page.")
                    except RuntimeError as exc:
                        raise ScanOCRError(f"OCR failed on page {number + 1}: {exc}") from exc
                    processed += 1
                    on_progress(processed, len(pages))
                else:
                    output.insert_pdf(pdf, from_page=number, to_page=number)
            if recognized == 0:
                if len(pages) == len(pdf):
                    raise ScanOCRError("OCR did not recognize text. Check the source language and scan quality.")
                return None

            output.set_metadata(pdf.metadata)
            outline = pdf.get_toc()
            if outline:
                output.set_toc(outline)
            destination = Path(stage_dir) / "ocr-input" / source.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            output.save(destination, deflate=True)
    log(f"Local OCR recognized {recognized}/{len(pages)} scanned page(s), language={language}.")
    return destination


def _ocr_font_present(page):
    # MuPDF's Tesseract output uses an invisible font called GlyphLessFont.
    return any(font.name.endswith("GlyphLessFont") for font in page.pdf_font)


def _in_layout(box, regions):
    if box is None:
        return False
    x = (box.x + box.x2) / 2
    y = (box.y + box.y2) / 2
    return any(region.x <= x <= region.x2 and region.y <= y <= region.y2
               for region in regions)


def _ocr_page_number_boxes(page):
    """Find isolated, centered page numbers in the OCR text layer."""
    lines = {}
    for x0, y0, x1, y1, text, block, line, _ in page.get_text("words"):
        lines.setdefault((block, line), []).append((fitz.Rect(x0, y0, x1, y1), text))
    width, height = page.rect.width, page.rect.height
    to_pdf = ~page.transformation_matrix
    numbers = []
    for words in lines.values():
        if len(words) != 1:
            continue
        rect, text = words[0]
        if (text.isdecimal() and len(text) <= 4
                and abs((rect.x0 + rect.x1) / 2 - width / 2) <= width * 0.05
                and (rect.y1 <= height * 0.1 or rect.y0 >= height * 0.9)):
            numbers.append(rect * to_pdf)
    return numbers


def _group_ocr_prose(characters, layout_for):
    # OCR can emit alternating left and right lines. Keep each detected prose
    # region contiguous, while preserving the order within that region and
    # leaving headings, tables and formulas outside the grouping.
    groups = {}
    ordered = []
    for char in characters:
        layout = layout_for(char)
        if layout is None or layout.name not in _PROSE_LAYOUTS:
            ordered.append([char])
            continue
        key = (layout.id, char.xobj_id)
        if key not in groups:
            groups[key] = []
            ordered.append(groups[key])
        groups[key].append(char)
    return [char for group in ordered for char in group]


def _background_segments(box, preserved):
    segments = [fitz.Rect(box.x, box.y, box.x2, box.y2)]
    for number in preserved:
        protected = fitz.Rect(number.x, number.y, number.x2, number.y2) + (-1, -1, 1, 1)
        remaining = []
        for rect in segments:
            cut = rect & protected
            if cut.is_empty:
                remaining.append(rect)
                continue
            remaining.extend(piece for piece in (
                fitz.Rect(rect.x0, rect.y0, rect.x1, cut.y0),
                fitz.Rect(rect.x0, cut.y1, rect.x1, rect.y1),
                fitz.Rect(rect.x0, cut.y0, cut.x0, cut.y1),
                fitz.Rect(cut.x1, cut.y0, rect.x1, cut.y1),
            ) if not piece.is_empty)
        segments = remaining
    return segments


def _paper_color(pixels, rect):
    """Sample around the text rectangle, where the paper is unobstructed."""
    bounds = (rect + (-1, -1, 1, 1)) & fitz.Rect(0, 0, pixels.width, pixels.height)
    if bounds.is_empty:
        return None
    left, top = int(bounds.x0), int(bounds.y0)
    right, bottom = min(int(bounds.x1), pixels.width - 1), min(int(bounds.y1), pixels.height - 1)
    samples = []
    for step in range(1, 9):
        x = left + (right - left) * step // 9
        y = top + (bottom - top) * step // 9
        samples.extend((pixels.pixel(x, top), pixels.pixel(x, bottom),
                        pixels.pixel(left, y), pixels.pixel(right, y)))
    color = tuple(median(channel) for channel in zip(*samples))
    agreeing = sum(
        max(abs(value - reference) for value, reference in zip(sample, color)) <= 8
        for sample in samples
    )
    if agreeing >= 24 and min(color) >= 180 and color != (255, 255, 255):
        return " ".join(f"{value / 255:.5f}" for value in color)
    return None


def install_page_overlay():
    """Use BabelDOC's OCR overlay per recognized page, including mixed PDFs."""
    from babeldoc.format.pdf.document_il.backend.pdf_creater import CharacterRenderUnit, PDFCreater
    from babeldoc.format.pdf.document_il.il_version_1 import Box, GraphicState
    from babeldoc.format.pdf.document_il.midend.paragraph_finder import ParagraphFinder
    from babeldoc.format.pdf.document_il.utils.layout_helper import get_character_layout
    from babeldoc.format.pdf.document_il.utils.style_helper import BLACK

    process_document = ParagraphFinder.process
    process_page = ParagraphFinder.process_page
    group_characters = ParagraphFinder._group_characters_into_paragraphs
    render_page = PDFCreater.create_render_units_for_page
    original_text_by_page = {}
    page_number_boxes = {}

    def process_ocr_document(self, document):
        original_text_by_page.clear()
        page_number_boxes.clear()
        with fitz.open(self.translation_config.input_file) as source:
            for page in document.page:
                if _ocr_font_present(page):
                    page_number_boxes[page.page_number] = [
                        Box(rect.x0, rect.y0, rect.x1, rect.y1)
                        for rect in _ocr_page_number_boxes(source[page.page_number])
                    ]
        return process_document(self, document)

    def process_ocr_page(self, page):
        if not _ocr_font_present(page):
            return process_page(self, page)
        finder = copy(self)
        finder.translation_config = copy(self.translation_config)
        finder.translation_config.ocr_workaround = True
        finder.translation_config.split_short_lines = False
        # OCR word boxes do not encode cells. Keep the scanned table image
        # instead of laying text across rules or disturbing the numeric values.
        tables = [
            layout.box for layout in page.page_layout
            if layout.class_name == "table" and layout.box is not None
        ]
        # Isolated page numbers also stay in the scan. Keep their individual
        # text layer so the translator cannot join them to a nearby footer.
        keep_in_scan = tables + page_number_boxes.get(page.page_number, [])
        if keep_in_scan:
            prose = []
            original_text = []
            for char in page.pdf_character:
                if not _in_layout(char.box, keep_in_scan):
                    prose.append(char)
                    continue
                char.pdf_style = copy(char.pdf_style)
                # PyMuPDF OCR uses a 500-unit GlyphLessFont cell and scales it
                # to the recognized word. Reconstruct that advance so PDF
                # readers do not insert gaps inside decimals or words.
                scale = 100
                if char.advance and char.pdf_style.font_size and not char.vertical:
                    scale = 200 * char.advance / char.pdf_style.font_size
                char.pdf_style.graphic_state = GraphicState(
                    passthrough_per_char_instruction=f"3 Tr {scale:.6f} Tz"
                )
                original_text.append(char)
            page.pdf_character = prose
            original_text_by_page[id(page)] = original_text
        if tables:
            page.pdf_paragraph = [
                paragraph for paragraph in page.pdf_paragraph
                if not _in_layout(paragraph.box, tables)
            ]
            print(f"Local OCR preserved {len(tables)} scanned table region(s) in the source image.",
                  flush=True)
        for char in page.pdf_character:
            char.pdf_style.graphic_state = BLACK
            char.render_order = None
        return process_page(finder, page)

    def render_ocr_page(self, page, config):
        original_text = original_text_by_page.get(id(page), ())
        numbers = page_number_boxes.get(page.page_number, ())
        if numbers:
            # A translated footer may have a background wider than its text
            # box. Preserve the printed numeral beneath that background.
            page = copy(page)
            rectangles = []
            for rect in page.pdf_rectangle:
                if rect.fill_background:
                    for segment in _background_segments(rect.box, numbers):
                        piece = copy(rect)
                        piece.box = Box(segment.x0, segment.y0, segment.x1, segment.y1)
                        rectangles.append(piece)
                else:
                    rectangles.append(rect)
            page.pdf_rectangle = rectangles
        fills = [rect for rect in page.pdf_rectangle if rect.fill_background]
        if fills:
            config = copy(config)
            config.ocr_workaround = True
            scale = fitz.Matrix(0.5, 0.5)
            with fitz.open(self.original_pdf_path) as source:
                original = source[page.page_number]
                pixels = original.get_pixmap(matrix=scale, colorspace=fitz.csRGB, alpha=False)
                transform = ~original.transformation_matrix * scale
                for rect in fills:
                    box = rect.box
                    color = _paper_color(pixels, fitz.Rect(box.x, box.y, box.x2, box.y2) * transform)
                    if color:
                        rect.graphic_state = GraphicState(passthrough_per_char_instruction=f"{color} rg")
        units = render_page(self, page, config)
        units.extend(
            CharacterRenderUnit(char, None, index)
            for index, char in enumerate(original_text)
        )
        return units

    def group_ocr_characters(self, page, layout_index, layout_map):
        if _ocr_font_present(page):
            page.pdf_character = _group_ocr_prose(
                page.pdf_character,
                lambda char: get_character_layout(char, layout_index, layout_map),
            )
        return group_characters(self, page, layout_index, layout_map)

    ParagraphFinder.process = process_ocr_document
    ParagraphFinder.process_page = process_ocr_page
    ParagraphFinder._group_characters_into_paragraphs = group_ocr_characters
    PDFCreater.create_render_units_for_page = render_ocr_page
