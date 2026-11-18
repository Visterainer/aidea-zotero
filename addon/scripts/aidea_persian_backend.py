"""Opt-in Persian output adapter for the pinned BabelDOC PDF pipeline.

The translator emits logical strings in PdfSameStyleUnicodeCharacters. The
ordinary typesetter then destroys those runs, sometimes dropping unmappable
characters. Snapshot eligible runs *before* that step, but always run it:
its result is the fallback. Only the translated page writer sees replacements;
BabelDOC still builds the source side, dual layouts, subsets and final files.
"""

from __future__ import annotations

import logging
import math
import sys
import unicodedata
from dataclasses import dataclass, replace
from functools import wraps
from importlib.metadata import PackageNotFoundError, version

_log = logging.getLogger(__name__)
_VERSIONS = {"pdf2zh-next": "2.9.0", "BabelDOC": "0.6.2", "PyMuPDF": "1.25.2"}
_PLANS = "_aidea_persian_page_plans"


def _persian(language):
    return isinstance(language, str) and language.strip().lower().replace("_", "-") in (
        "fa",
        "fa-ir",
    )


def _enabled(config):
    return (
        _persian(config.lang_out)
        and not config.ocr_workaround
        and not config.skip_translation
    )


@dataclass(frozen=True)
class _Run:
    box: tuple
    text: str
    size: float
    color: tuple
    bold: bool
    italic: bool


@dataclass
class _Plan:
    page_id: int
    total: int
    runs: dict
    reason: str = "layout"
    last_report: tuple | None = None

    def report(self, page_number, replaced, reason):
        skipped = max(0, self.total - replaced)
        current = replaced, skipped, reason
        if self.last_report != current:
            # No user text or per-paragraph diagnostics. A native writer retry
            # with the same outcome does not produce duplicate markers.
            print(
                f"AIDEA_PERSIAN_PAGE page={page_number + 1} replaced={replaced} "
                f"skipped={skipped} reason={reason}",
                file=sys.stderr,
                flush=True,
            )
            self.last_report = current


def _arabic_text(text):
    return isinstance(text, str) and any(
        unicodedata.bidirectional(c) == "AL" for c in text
    )


def _bounds(box):
    if box is not None:
        coords = box.x, box.y, box.x2, box.y2
        if (
            all(isinstance(v, (int, float)) and math.isfinite(v) for v in coords)
            and coords[0] <= coords[2]
            and coords[1] <= coords[3]
        ):
            return coords
    return None


def _color(style):
    # Do not turn clipped, transparent or invisible text into opaque black.
    # 0.6.2 stores the state as either a string or a lazy string proxy.
    state = style.graphic_state
    tokens = str(state.passthrough_per_char_instruction or "").split() if state else []
    rgb = (0.0, 0.0, 0.0)
    numbers = []
    for token in tokens:
        arity = {"g": 1, "G": 1, "rg": 3, "RG": 3, "Tr": 1}.get(token)
        if arity is None:
            try:
                numbers.append(float(token))
            except ValueError:
                return None
        else:
            if len(numbers) != arity or not all(0 <= n <= 1 for n in numbers):
                return None
            if token == "Tr" and numbers != [0]:
                return None
            if token in ("g", "rg"):
                rgb = tuple(numbers * 3 if token == "g" else numbers)
            numbers = []
    return None if numbers else rgb


def _candidate(paragraph, fonts):
    if (
        not paragraph.debug_id
        or paragraph.vertical
        or paragraph.xobj_id not in (None, -1, 0)
    ):
        return None
    box = _bounds(paragraph.box)
    if not box or box[0] == box[2] or box[1] == box[3]:
        return None
    text = []
    style = None
    for comp in paragraph.pdf_paragraph_composition:
        run = comp.pdf_same_style_unicode_characters
        if (
            run is None
            or run.debug_info
            or not isinstance(run.unicode, str)
            or comp.pdf_formula
            or comp.pdf_character
            or comp.pdf_line
            or comp.pdf_same_style_characters
            or run.pdf_style is None
        ):
            return None
        if style is not None and run.pdf_style != style:
            return None  # Single-style callback; never flatten rich text/formulas.
        style = run.pdf_style
        text.append(run.unicode)
    text = "".join(text)
    if style is None or not _arabic_text(text):
        return None
    size = style.font_size
    color = _color(style)
    if color is None or not isinstance(size, (float, int)) or not 0 < size < math.inf:
        return None
    font = fonts.get(style.font_id)
    return _Run(
        box, text, size, color, bool(font and font.bold), bool(font and font.italic)
    )


def _unobstructed(page, runs):
    """Reject ambiguous stacking; check both original and typeset page geometry."""
    if not runs:
        return {}
    from rtree.index import Index  # Already required by the pinned typesetter.

    index = Index()
    try:

        def add(owner, box, padding=0.0):
            b = _bounds(box)
            if b is None:
                return False
            index.insert(
                owner, (b[0] - padding, b[1] - padding, b[2] + padding, b[3] + padding)
            )
            return True

        for p in page.pdf_paragraph:
            if not add(id(p), p.box):
                return {}
        # 0.6.2's objects have page-space boxes. Never suppress these, and
        # don't put a new text layer above/below a possibly overlapping mark.
        for objects in (
            page.pdf_character,
            page.pdf_figure,
            page.pdf_form,
            page.pdf_curve,
            page.pdf_rectangle,
        ):
            for obj in objects:
                if not add(-1, obj.box, 0.5):
                    return {}
        return {
            owner: run
            for owner, run in runs.items()
            if all(i == owner for i in index.intersection(run.box))
        }
    finally:
        index.close()


def _snapshot(page):
    fonts = {f.font_id: f for f in page.pdf_font}
    runs = {}
    for p in page.pdf_paragraph:
        candidate = _candidate(p, fonts)
        if candidate is not None:
            runs[id(p)] = candidate
    return _unobstructed(page, runs)


def _stage(pymupdf, render, layer, native, page, runs):
    # The writer starts the IL stream with cm(-crop.x, -crop.y). Match
    # that translation FIRST, then convert default PDF space to MuPDF space.
    crop = _bounds(page.cropbox.box)
    m = native.transformation_matrix
    if (
        not crop
        or native.rotation
        or page.unit not in (None, "point")
        or (m.a, m.b, m.c, m.d) != (1, 0, 0, -1)
    ):
        return set()
    bounds = native.rect
    if (
        abs(bounds.width - (crop[2] - crop[0])) > 0.01
        or abs(bounds.height - (crop[3] - crop[1])) > 0.01
    ):
        return set()
    scratch = layer.new_page(width=bounds.width, height=bounds.height)
    accepted = set()
    for p in page.pdf_paragraph:
        run = runs.get(id(p))
        # A pure translated run becomes either just stock PdfCharacters, or
        # nothing if BabelDOC's font mapping found no glyphs.
        if not run or any(
            comp.pdf_character is None or comp.pdf_formula
            for comp in p.pdf_paragraph_composition
        ):
            continue
        x, y, x2, y2 = run.box
        rect = pymupdf.Rect(x - crop[0], y - crop[1], x2 - crop[0], y2 - crop[1]) * m
        if rect.is_empty or rect not in bounds:
            continue
        if (
            render(
                scratch,
                rect,
                run.text,
                run.size,
                color=run.color,
                bold=run.bold,
                italic=run.italic,
            )
            is True
        ):
            accepted.add(id(p))
    return accepted


def install(target_language):
    """Install in this worker only. Return False without patching on mismatch."""
    if not _persian(target_language):
        return False
    for pkg, expected in _VERSIONS.items():
        try:
            actual = version(pkg)
        except PackageNotFoundError:
            actual = "missing"
        if actual != expected:
            print(
                f"AIDEA_PERSIAN_BACKEND enabled=0 reason=version package={pkg} "
                f"expected={expected} actual={actual}",
                file=sys.stderr,
                flush=True,
            )
            return False

    try:
        import pymupdf
        from aidea_persian_render import render_paragraph
        from babeldoc.format.pdf.document_il.backend.pdf_creater import PDFCreater
        from babeldoc.format.pdf.document_il.midend.typesetting import Typesetting
    except Exception:  # noqa: BLE001 -- optional backend must fail back to native output
        print(
            "AIDEA_PERSIAN_BACKEND enabled=0 reason=import_error",
            file=sys.stderr,
            flush=True,
        )
        _log.debug("Cannot import Persian worker hooks", exc_info=True)
        return False

    if getattr(Typesetting.render_page, "_aidea_persian", False):
        return True
    native_render = Typesetting.render_page
    native_write = PDFCreater.update_page_content_stream

    @wraps(native_render)
    def render_page(self, page):
        config = self.translation_config
        if _persian(config.lang_out):
            # Slot-based IL objects aren't weak-referenceable. Keep small
            # snapshots on this job's config, not a process-global page-number
            # cache. A writer retry must still see its own plan.
            plans = getattr(config, _PLANS, None)
            if plans is None:
                plans = {}
                setattr(config, _PLANS, plans)
            plan = _Plan(
                id(page), sum(_arabic_text(p.unicode) for p in page.pdf_paragraph), {}
            )
            plans[page.page_number] = plan
            if _enabled(config):
                try:
                    plan.runs = _snapshot(page)
                except Exception:  # noqa: BLE001 -- optional backend must fail back to native output
                    plan.reason = "snapshot_error"
                    _log.debug("Persian IL snapshot failed", exc_info=True)
            else:
                plan.reason = "ocr_or_untranslated"
        return native_render(self, page)

    @wraps(native_write)
    def write_page(
        self, check_font_exists, page, pdf, translation_config, skip_char=False
    ):
        def write(il_page):
            return native_write(
                self, check_font_exists, il_page, pdf, translation_config, skip_char
            )

        if skip_char or not _persian(translation_config.lang_out):
            return write(page)
        plan = getattr(translation_config, _PLANS, {}).get(page.page_number)
        if plan is None or plan.page_id != id(page):
            # E.g. the engine probes scanned pages before translation.
            return write(page)
        reason = plan.reason
        if not plan.runs or not _enabled(translation_config):
            result = write(page)
            plan.report(page.page_number, 0, reason)
            return result
        with pymupdf.open() as layer:
            try:
                native = pdf[page.page_number]
                accepted = _stage(
                    pymupdf,
                    render_paragraph,
                    layer,
                    native,
                    page,
                    _unobstructed(page, plan.runs),
                )
            except Exception:  # noqa: BLE001 -- optional backend must fail back to native output
                # Even a renderer that drew before raising only dirtied the
                # disposable layer. Never commit a half-rendered paragraph.
                _log.debug("Persian staging failed", exc_info=True)
                reason = "stage_error"
                accepted = set()
            if accepted:
                # Shallow IL view: other paragraphs, page graphics, and all
                # XObjects remain BabelDOC's. Don't mutate the retryable IL.
                view = replace(
                    page,
                    pdf_paragraph=[
                        p for p in page.pdf_paragraph if id(p) not in accepted
                    ],
                )
                result = write(view)
                try:
                    # Prepend a transparent layer, so the native stream's cm
                    # cannot affect it. Only disjoint candidates reach here.
                    native.show_pdf_page(native.rect, layer, 0, overlay=False)
                except Exception:  # noqa: BLE001 -- optional backend must fail back to native output
                    # Native write sets /Contents to a fresh stream. Rebuild
                    # with ALL original units, discarding any partial graft.
                    _log.debug("Persian page graft failed", exc_info=True)
                    result = write(page)
                    plan.report(page.page_number, 0, "graft_error")
                    return result
                plan.report(page.page_number, len(accepted), "layout")
                return result
        result = write(page)
        plan.report(page.page_number, 0, reason)
        return result

    render_page._aidea_persian = True
    Typesetting.render_page = render_page
    PDFCreater.update_page_content_stream = write_page
    return True
