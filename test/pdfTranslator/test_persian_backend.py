"""Optional: run with the pinned translation env's Python, offline and without Zotero.

    <env>/bin/python -IB test/pdfTranslator/test_persian_backend.py

Only the final renderer and the asset-backed font mapper are test doubles.
Everything else, including BabelDOC's character writer and dual layouts, is real.
"""

import io
import sys
import unittest
from contextlib import redirect_stderr
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "addon" / "scripts"))
import aidea_persian_backend as backend


class PersianBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            if not all(version(p) == v for p, v in backend._VERSIONS.items()):
                raise unittest.SkipTest("requires the pinned translation environment")
        except PackageNotFoundError:
            raise unittest.SkipTest("requires the pinned translation environment")

    def test_native_writes_and_atomic_fallback(self):
        import pymupdf as pdf
        from babeldoc.format.pdf.document_il import il_version_1 as il
        from babeldoc.format.pdf.document_il.backend.pdf_creater import PDFCreater
        from babeldoc.format.pdf.document_il.midend.typesetting import Typesetting
        from babeldoc.format.pdf.translation_config import WatermarkOutputMode

        logical = "یادگیری پژوهش OLDLTR"
        calls = []
        explode = False

        def render(page, rect, text, size, *, color, bold, italic):
            calls.append((tuple(rect), text, size, color, bold, italic))
            if "REFUSE" in text:
                return False
            if explode:
                page.insert_text((30, 50), "DIRTY PARTIAL")
                raise ValueError("intentional fixture failure")
            page.insert_text((rect.x0 + 3, rect.y0 + 14), "REPLACED", fontsize=size)
            return True

        # Restore the monkeypatches even if an assertion fails in a test suite.
        native_render = Typesetting.render_page
        self.addCleanup(setattr, Typesetting, "render_page", native_render)
        self.addCleanup(
            setattr,
            PDFCreater,
            "update_page_content_stream",
            PDFCreater.update_page_content_stream,
        )
        renderer = SimpleNamespace(render_paragraph=render)
        with patch.dict(sys.modules, {"aidea_persian_render": renderer}):
            self.assertFalse(backend.install("en"))
            with (
                patch.object(backend, "version", return_value="unknown"),
                redirect_stderr(io.StringIO()),
            ):
                self.assertFalse(backend.install("fa"))
            self.assertIs(Typesetting.render_page, native_render)
            self.assertTrue(backend.install("fa-IR"))
            self.assertTrue(backend.install("fa"))

        style = il.PdfStyle(
            font_id="native",
            font_size=11,
            graphic_state=il.GraphicState("0.1 0.2 0.3 rg 0 G"),
        )
        font = pdf.Font("helv")
        font.font_id = "native"
        ilfont = il.PdfFont(
            name=font.name, font_id="native", bold=True, encoding_length=2
        )

        def paragraph(text, y, idx):
            run = il.PdfSameStyleUnicodeCharacters(unicode=text, pdf_style=style)
            return il.PdfParagraph(
                box=il.Box(22, y, 210, y + 25),
                pdf_style=style,
                pdf_paragraph_composition=[
                    il.PdfParagraphComposition(pdf_same_style_unicode_characters=run)
                ],
                xobj_id=0,
                unicode=text,
                debug_id=str(idx),
                render_order=idx,
            )

        def translated(lang):
            good = paragraph(logical, 185, 1)
            refused = paragraph("یادگیری REFUSE", 145, 2)
            over_graphic = paragraph("پژوهش OVERLAP", 92, 3)
            formula = paragraph("پژوهش FORMULA", 53, 4)
            symbol = il.PdfCharacter(
                box=il.Box(200, 55, 205, 64),
                pdf_style=style,
                char_unicode="X",
                pdf_character_id=font.has_glyph(ord("X")),
                xobj_id=0,
                render_order=4,
            )
            formula.pdf_paragraph_composition = [
                il.PdfParagraphComposition(
                    pdf_formula=il.PdfFormula(box=symbol.box, pdf_character=[symbol])
                )
            ]
            red = il.PdfRectangle(
                box=il.Box(70, 105, 150, 117),
                graphic_state=il.GraphicState("1 0 0 rg 1 0 0 RG"),
                debug_info=True,
                fill_background=True,
                render_order=10,
            )
            page = il.Page(
                cropbox=il.Cropbox(il.Box(0, 0, 240, 240)),
                mediabox=il.Mediabox(il.Box(0, 0, 240, 240)),
                page_number=0,
                unit="point",
                pdf_font=[ilfont],
                pdf_paragraph=[good, refused, over_graphic, formula],
                pdf_rectangle=[red],
            )
            config = SimpleNamespace(
                lang_out=lang,
                ocr_workaround=False,
                skip_translation=False,
                watermark_output_mode=WatermarkOutputMode.NoWatermark,
                progress_monitor=None,
                raise_if_cancelled=lambda: None,
                skip_curve_render=False,
                skip_form_render=False,
                debug=True,
                dual_translate_first=False,
            )
            typesetter = object.__new__(Typesetting)
            typesetter.translation_config = config
            typesetter.font_mapper = SimpleNamespace(
                fontid2font={},
                base_font=font,
                map=lambda _, c: font if font.has_glyph(ord(c)) else None,
            )
            typesetter.lang_code = lang.upper()
            typesetter.is_cjk = False
            typesetter.typesetting_document(il.Document(page=[page]))
            doc = pdf.open()
            self.addCleanup(doc.close)
            dst = doc.new_page(width=240, height=240)
            dst.insert_font(fontname="native", fontbuffer=font.buffer)
            dst.insert_text((22, 70), "ORIGINAL ENGLISH")
            original = doc.tobytes()
            writer = object.__new__(PDFCreater)
            writer.translation_config = config
            writer.original_pdf_path = "offline-fixture.pdf"
            writer.update_page_content_stream(False, page, doc, config)
            return writer, config, page, doc, original

        with redirect_stderr(io.StringIO()) as err:
            writer, cfg, page, mono, original = translated("fa")
        self.assertIn("AIDEA_PERSIAN_PAGE page=1 replaced=1 skipped=3", err.getvalue())
        self.assertEqual(len(calls), 2)
        self.assertEqual(
            calls[0], ((22, 30, 210, 55), logical, 11, (0.1, 0.2, 0.3), True, False)
        )
        expected = ["REPLACED", "REFUSE", "OVERLAP", "X"]
        self.assertEqual(mono[0].get_text().split(), expected)
        self.assertTrue(mono[0].get_drawings())
        for first in (False, True):
            cfg.dual_translate_first = first
            with (
                pdf.open(stream=original) as src,
                writer.create_side_by_side_dual_pdf(src, mono, "unused", cfg) as dual,
            ):
                for side, words in [
                    (int(first), ["ORIGINAL", "ENGLISH"]),
                    (int(not first), expected),
                ]:
                    clip = pdf.Rect(240 * side, 0, 240 * (1 + side), 240)
                    self.assertEqual(dual[0].get_text(clip=clip).split(), words)
            with pdf.open(stream=original) as src:
                dual = writer.create_alternating_pages_dual_pdf(src, mono, cfg)
                self.assertEqual(
                    dual[int(first)].get_text().strip(), "ORIGINAL ENGLISH"
                )
                self.assertEqual(dual[int(not first)].get_text().split(), expected)

        # A retry must rebuild, not accumulate, successful replacements.
        with redirect_stderr(io.StringIO()) as err:
            writer.update_page_content_stream(True, page, mono, cfg)
        self.assertEqual(err.getvalue(), "")
        self.assertEqual(mono[0].get_text().split(), expected)

        calls.clear()
        native_text = translated("en")[3][0].get_text()
        self.assertIn("OLDLTR", native_text)
        self.assertFalse(calls)
        explode = True
        with redirect_stderr(io.StringIO()) as err:
            self.assertEqual(translated("fa")[3][0].get_text(), native_text)
        self.assertIn("replaced=0 skipped=4 reason=stage_error", err.getvalue())

        # Simulate a native Form graft that partially changed the destination
        # before failing. The writer must reinstall its complete stock stream.
        def fail_graft(dst, *args, **kwargs):
            dst.insert_text((10, 20), "BAD GRAFT")
            raise RuntimeError("intentional graft failure")

        explode = False
        with (
            patch.object(pdf.Page, "show_pdf_page", fail_graft),
            redirect_stderr(io.StringIO()) as err,
        ):
            self.assertEqual(translated("fa")[3][0].get_text(), native_text)
        self.assertIn("replaced=0 skipped=4 reason=graft_error", err.getvalue())


if __name__ == "__main__":
    unittest.main()
