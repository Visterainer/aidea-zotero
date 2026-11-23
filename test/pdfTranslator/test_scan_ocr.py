"""Run with the verified translation environment's Python."""

from pathlib import Path
import os
import sys
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import fitz

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "addon" / "scripts"))
import aidea_scan_ocr as ocr
from aidea_bridge import _use_per_page_ocr


class ScanOCRTest(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)

    def create_scan(self, pdf):
        with fitz.open() as document:
            page = document.new_page(width=240, height=160)
            page.insert_text((30, 45), "Telescope sample", fontsize=14)
            raster = page.get_pixmap()
        page = pdf.new_page(width=240, height=160)
        page.insert_image(page.rect, pixmap=raster)
        page.insert_text((100, 152), "1")

    def test_leaves_digital_pages_untouched_and_preserves_page_order(self):
        source = self.root / "mixed.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page(width=240, height=160)
            page.insert_text((30, 45), "Digital reference")
            self.create_scan(pdf)
            pdf.save(source)
        original = source.read_bytes()
        with fitz.open() as doc:
            page = doc.new_page(width=240, height=160)
            page.insert_text((30, 45), "Telescope sample", render_mode=3)
            recognized = doc.tobytes()
        with (
            patch.object(ocr, "_language_data", return_value=("eng", self.root)),
            patch.object(ocr, "_orientation_score", return_value=0),
            patch.object(fitz.Pixmap, "pdfocr_tobytes", return_value=recognized) as read_scan,
        ):
            out = ocr.prepare_input(source, self.root, "en", True, lambda *_: None, lambda _: None)
        read_scan.assert_called_once_with(language="eng", tessdata=str(self.root))
        self.assertEqual(source.read_bytes(), original)
        self.assertEqual(out.name, source.name)
        with fitz.open(out) as pdf:
            self.assertEqual(len(pdf), 2)
            self.assertEqual(pdf[0].get_text().strip(), "Digital reference")
            self.assertEqual(pdf[1].get_text().strip(), "Telescope sample")

    def test_explains_how_to_enable_recognition_for_an_image_only_pdf(self):
        source = self.root / "scan.pdf"
        with fitz.open() as doc:
            self.create_scan(doc)
            doc.save(source)
        with self.assertRaisesRegex(ocr.ScanOCRError, "Enable Automatic OCR"):
            ocr.prepare_input(source, self.root, "en", False, lambda *_: None, lambda _: None)

    def test_normalizes_rotated_digital_pages_without_rasterizing_or_changing_order(self):
        source = self.root / "rotated-mixed.pdf"
        with fitz.open() as pdf:
            for rotation in (0, 90, 180, 270):
                page = pdf.new_page(width=240, height=160)
                page.insert_text((35, 45), f"Digital reference {rotation}")
                page.set_rotation(rotation)
            pdf.save(source)
        original = source.read_bytes()
        normalized = ocr.normalize_page_geometry(source, self.root / "normalized")
        self.assertEqual(source.read_bytes(), original)
        with fitz.open(source) as before, fitz.open(normalized) as after:
            self.assertEqual(len(after), len(before))
            for current, expected in zip(after, before, strict=True):
                self.assertEqual(current.rotation, 0)
                self.assertEqual(current.rect, expected.rect)
                self.assertEqual(current.mediabox, expected.rect)
                self.assertEqual(current.get_text(), expected.get_text())
                self.assertEqual(current.get_pixmap().samples, expected.get_pixmap().samples)
        self.assertIsNone(ocr.normalize_page_geometry(normalized, self.root / "other"))

    def test_preserves_asymmetric_crop_and_body_at_each_rotation(self):
        source = self.root / "rotated-crop.pdf"
        with fitz.open() as pdf:
            for rotation in (0, 90, 180, 270):
                page = pdf.new_page(width=527, height=731)
                page.set_mediabox(fitz.Rect(-20, -43, 507, 688))
                page.insert_text((24, 24), "Outside the visible crop")
                page.set_cropbox(fitz.Rect(9, 67, 439, 680))
                page.insert_text((31, 56), "Asymmetrically cropped PDF")
                page.draw_rect(fitz.Rect(20, 100, 130, 130), fill=(.8, .9, 1))
                page.set_rotation(rotation)
            pdf.save(source)
        original = source.read_bytes()
        normalized = ocr.normalize_page_geometry(source, self.root / "normalized")
        self.assertEqual(source.read_bytes(), original)
        with fitz.open(source) as before, fitz.open(normalized) as after:
            for current, expected in zip(after, before, strict=True):
                self.assertEqual(current.rotation, 0)
                self.assertEqual(current.rect, expected.rect)
                self.assertEqual(current.mediabox, expected.rect)
                self.assertEqual(current.get_text(), expected.get_text())
                self.assertNotIn("Outside the visible crop", current.get_text())
                self.assertEqual(current.get_pixmap().samples, expected.get_pixmap().samples)

    def test_preserves_multiline_text_markup_on_rotated_cropped_pages(self):
        source = self.root / "highlighted.pdf"
        with fitz.open() as pdf:
            for rotation in (90, 180, 270):
                page = pdf.new_page(width=500, height=650)
                page.set_cropbox(fitz.Rect(30, 55, 461, 590))
                page.insert_text((45, 85), "The first highlighted phrase")
                page.insert_text((45, 105), "The second highlighted phrase")
                quads = page.search_for("highlighted phrase", quads=True)
                self.assertEqual(len(quads), 2)
                for add in (page.add_highlight_annot, page.add_underline_annot, page.add_strikeout_annot):
                    mark = add(quads)
                    mark.set_colors(stroke=(0, 1, 0))
                    mark.set_opacity(0.6)
                    mark.set_info(title="QA", content="Keep both lines")
                    mark.update()
                page.set_rotation(rotation)
            pdf.save(source)
        before = source.read_bytes()
        output = ocr.normalize_page_geometry(source, self.root / "stage")
        self.assertEqual(source.read_bytes(), before)
        with fitz.open(source) as original, fitz.open(output) as normalized:
            for src, dest in zip(original, normalized, strict=True):
                self.assertEqual(len(list(dest.annots())), 3)
                for old, new in zip(src.annots(), dest.annots(), strict=True):
                    self.assertEqual(new.type[0], old.type[0])
                    self.assertEqual(new.info["content"], old.info["content"])
                    self.assertEqual(new.info["title"], old.info["title"])
                    self.assertEqual(new.colors, old.colors)
                    self.assertEqual(new.opacity, old.opacity)
                    for wanted, actual in zip(old.vertices, new.vertices, strict=True):
                        expected = fitz.Point(wanted) * src.rotation_matrix
                        self.assertAlmostEqual(actual[0], expected.x, places=3)
                        self.assertAlmostEqual(actual[1], expected.y, places=3)

    def test_recreates_text_markup_in_the_original_panel_after_babeldoc_composes(self):
        from babeldoc.format.pdf.document_il.backend.pdf_creater import PDFCreater

        for translate_first in (True, False):
            with (
                self.subTest(translate_first=translate_first),
                fitz.open() as source,
                fitz.open() as translated,
            ):
                page = source.new_page(width=240, height=160)
                page.insert_text((35, 55), "Original phrase")
                quads = page.search_for("Original phrase", quads=True)
                for add in (page.add_highlight_annot, page.add_underline_annot, page.add_strikeout_annot):
                    original = add(quads)
                    original.set_info(content="Original annotation")
                    original.update()
                input_path = self.root / f"source-{translate_first}.pdf"
                source.save(input_path)
                other = translated.new_page(width=265, height=190)
                other.insert_text((35, 55), "Translated phrase")
                config = SimpleNamespace(dual_translate_first=translate_first)
                output_path = self.root / f"dual-{translate_first}.pdf"
                with PDFCreater.create_side_by_side_dual_pdf(
                    SimpleNamespace(), source, translated, str(self.root / "dual.pdf"), config
                ) as dual:
                    dual.save(output_path)
                self.assertEqual(
                    ocr.restore_dual_text_markup(input_path, output_path, translated_first=translate_first), 3
                )
                self.assertEqual(
                    ocr.restore_dual_text_markup(input_path, output_path, translated_first=translate_first), 0
                )
                with fitz.open(output_path) as dual:
                    sheet = dual[0]
                    target = sheet.search_for("Original phrase", quads=True)[0]
                    marks = list(sheet.annots())
                    self.assertEqual(
                        {mark.type[0] for mark in marks},
                        {fitz.PDF_ANNOT_HIGHLIGHT, fitz.PDF_ANNOT_UNDERLINE, fitz.PDF_ANNOT_STRIKE_OUT},
                    )
                    for mark in marks:
                        self.assertEqual(mark.info["content"], "Original annotation")
                        for point, position in zip(target, mark.vertices, strict=True):
                            self.assertAlmostEqual(point.x, position[0], places=3)
                            self.assertAlmostEqual(point.y, position[1], places=3)

    def test_restores_alternating_highlights_only_to_original_pages(self):
        source = self.root / "highlight-source.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page()
            page.insert_text((35, 55), "Original phrase")
            page.add_highlight_annot(page.search_for("Original phrase"))
            pdf.save(source)
        for translate_first in (True, False):
            with self.subTest(translate_first=translate_first), fitz.open() as dual:
                index = int(translate_first)
                for i in range(2):
                    page = dual.new_page()
                    page.insert_text((35, 55), "Original phrase" if i == index else "Translated phrase")
                output = self.root / f"alternating-{translate_first}.pdf"
                dual.save(output)
                self.assertEqual(ocr.restore_dual_text_markup(source, output, True, translate_first), 1)
                with fitz.open(output) as result:
                    self.assertEqual([len(list(page.annots())) for page in result],
                                     [int(i == index) for i in range(2)])

    def test_repeated_restoration_deduplicates_clipped_text_markup(self):
        source = self.root / "crop-edge.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page(width=160, height=100)
            quads = [fitz.Rect(120, 25, 178, 38).quad, fitz.Rect(178, 42, 230, 54).quad]
            for color in ((0, 0.5, 0), (0.5, 0, 0)):
                annot = page.add_highlight_annot(quads)
                annot.set_colors(stroke=color)
                annot.update()
            pdf.save(source)
        output = self.root / "crop-edge-dual.pdf"
        with fitz.open() as dual:
            dual.new_page(width=320, height=100)
            dual.save(output)
        self.assertEqual(ocr.restore_dual_text_markup(source, output), 2)
        self.assertEqual(ocr.restore_dual_text_markup(source, output), 0)
        with fitz.open(output) as dual:
            page = dual[0]
            marks = list(page.annots())
            self.assertEqual(len(marks), 2)
            for mark in marks:
                self.assertEqual(len(mark.vertices), 4)
                self.assertEqual(max(point[0] for point in mark.vertices), 160)
            translated_panel = fitz.Rect(160, 0, 320, 100)
            self.assertEqual(page.get_pixmap(clip=translated_panel).samples,
                             page.get_pixmap(clip=translated_panel, annots=False).samples)

    def test_clips_slanted_markup_without_reshaping_its_appearance(self):
        source = self.root / "slanted-edge.pdf"
        with fitz.open() as pdf:
            page = pdf.new_page(width=345, height=200)
            page.set_cropbox(fitz.Rect(10, 0, 310, 200))
            for vertices in (
                ((293, 50), (317, 39), (305, 70), (329, 59)),
                ((291, 97), (326, 110), (283, 122), (319, 135)),
            ):
                page.add_highlight_annot(fitz.Quad(vertices))
            pdf.save(source)
        prepared = ocr.normalize_page_geometry(source, self.root / "stage")
        output = self.root / "slanted-edge-dual.pdf"
        with fitz.open() as dual:
            dual.new_page(width=600, height=200)
            dual.save(output)
        self.assertEqual(ocr.restore_dual_text_markup(prepared, output), 2)
        self.assertEqual(ocr.restore_dual_text_markup(prepared, output), 0)
        with fitz.open(source) as original, fitz.open(output) as dual:
            page = dual[0]
            self.assertEqual(page.get_pixmap(clip=original[0].rect).samples,
                             original[0].get_pixmap().samples)
            for mark in page.annots():
                self.assertLessEqual(mark.rect.x1, 300)
                self.assertLessEqual(max(x for x, _ in mark.vertices), 300)
            translation = fitz.Rect(300, 0, 600, 200)
            self.assertEqual(page.get_pixmap(clip=translation).samples,
                             page.get_pixmap(clip=translation, annots=False).samples)

    def test_ocr_preserves_editable_markup_when_correcting_scan_direction(self):
        source = self.root / "annotated-sideways.pdf"
        with fitz.open() as pdf:
            self.create_scan(pdf)
            page = pdf[0]
            markup = page.add_underline_annot(fitz.Rect(25, 22, 82, 35).quad)
            markup.set_info(content="Scanned annotation")
            markup.update()
            other = page.add_rect_annot(fitz.Rect(100, 75, 145, 105))
            other.update()
            marked_pixels = page.get_pixmap(dpi=216).samples
            pdf.save(source)

        with fitz.open(source) as original:
            page = original[0]
            original_quad = fitz.Quad(page.first_annot.vertices)
            markup_free = ocr._scan_pixels(page, 216, list(ocr._page_text_markup(page)))
            self.assertNotEqual(markup_free.samples, page.get_pixmap(dpi=216, annots=False).samples)
            self.assertEqual(page.get_pixmap(dpi=216).samples, marked_pixels)

        def read_rotated(pixels, *, language, tessdata):
            with fitz.open() as recognized:
                page = recognized.new_page(width=pixels.width / 3, height=pixels.height / 3)
                page.insert_image(page.rect, pixmap=pixels)
                page.insert_text((25, 40), "Telescope sample", render_mode=3)
                return recognized.tobytes()

        before = source.read_bytes()
        with (
            patch.object(ocr, "_language_data", return_value=("eng", self.root)),
            patch.object(ocr, "_orientation_score", side_effect=[10, 120, 8, 14]),
            patch.object(fitz.Pixmap, "pdfocr_tobytes", new=read_rotated),
        ):
            out = ocr.prepare_input(source, self.root, "en", True, lambda *_: None, lambda _: None)
        self.assertEqual(source.read_bytes(), before)
        with fitz.open(out) as recognized:
            page = recognized[0]
            mark, = page.annots()
            self.assertEqual(mark.type[0], fitz.PDF_ANNOT_UNDERLINE)
            self.assertEqual(mark.info["content"], "Scanned annotation")
            rotated_quad = original_quad * fitz.Matrix(0, -1, 1, 0, 0, 240)
            for expected, actual in zip(rotated_quad, mark.vertices, strict=True):
                self.assertAlmostEqual(actual[0], expected.x, places=3)
                self.assertAlmostEqual(actual[1], expected.y, places=3)

    def test_corrects_scan_orientation_before_full_size_recognition(self):
        with fitz.open() as pdf:
            page = pdf.new_page(width=240, height=160)
            page.insert_text((30, 45), "Telescope sample", fontsize=14)
            pixels = page.get_pixmap(dpi=216)
        for angle, scores in (
            (0, [98, 11, 54, 7]),
            (1, [11, 54, 7, 98]),
            (2, [54, 7, 98, 11]),
            (3, [7, 98, 11, 54]),
        ):
            with self.subTest(angle=angle):
                source = ocr._rotate_scan(pixels, angle) if angle else pixels
                with patch.object(ocr, "_orientation_score", side_effect=scores) as score:
                    corrected, turns = ocr._orient_scan(source, "eng", self.root)
                self.assertEqual(turns, -angle % 4)
                self.assertEqual(corrected.samples, pixels.samples)
                self.assertEqual((corrected.xres, corrected.yres), (216, 216))
                self.assertEqual(score.call_count, 4)
        with patch.object(ocr, "_orientation_score", side_effect=[61, 6, 65, 2]):
            self.assertEqual(ocr._orient_scan(pixels, "eng", self.root), (pixels, 0))

    def test_removes_grid_for_recognition_but_keeps_original_table_image(self):
        source = self.root / "scanned-table.pdf"
        with fitz.open() as paper:
            page = paper.new_page(width=240, height=160)
            page.draw_rect(fitz.Rect(20, 20, 220, 140), width=1)
            page.draw_line((20, 80), (220, 80), width=1)
            page.draw_line((120, 20), (120, 140), width=1)
            page.insert_text((133, 66), "127.4 mV")
            pixels = page.get_pixmap(dpi=216)
        with fitz.open() as scan:
            page = scan.new_page(width=240, height=160)
            page.insert_image(page.rect, pixmap=pixels)
            scan.save(source)
            original = page.get_pixmap(dpi=216).samples

        def read_table(recognition_pixels, *, language, tessdata):
            self.assertGreater(recognition_pixels.pixel(360, 240)[0], 240)
            self.assertEqual(language, "eng")
            self.assertEqual(tessdata, str(self.root))
            with fitz.open() as result:
                page = result.new_page(width=240, height=160)
                page.insert_image(page.rect, pixmap=recognition_pixels)
                page.insert_text((133, 66), "127.4 mV", render_mode=3)
                return result.tobytes()

        with (
            patch.object(ocr, "_language_data", return_value=("eng", self.root)),
            patch.object(ocr, "_orientation_score", return_value=0),
            patch.object(fitz.Pixmap, "pdfocr_tobytes", new=read_table),
        ):
            out = ocr.prepare_input(source, self.root, "en", True, lambda *_: None, lambda _: None)
        with fitz.open(out) as result:
            self.assertEqual(result[0].get_text().strip(), "127.4 mV")
            self.assertEqual(result[0].get_pixmap(dpi=216).samples, original)

    def test_rejects_corrupted_model_data(self):
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = b"incorrect model"
        with (
            patch.dict(os.environ, {"TESSDATA_PREFIX": ""}),
            patch.object(Path, "home", return_value=self.root),
            patch.object(ocr, "urlopen", return_value=response),
        ):
            with self.assertRaisesRegex(ocr.ScanOCRError, "failed verification"):
                ocr._language_data("en")
        self.assertEqual(list(self.root.rglob("*.traineddata")), [])

    def test_per_page_ocr_disables_engine_wide_ocr_without_changing_table_settings(self):
        config = self.root / "engine.toml"
        config.write_text(
            "[pdf]\nauto_enable_ocr_workaround = true\nocr_workaround = true\ntranslate_table_text = true\n",
            encoding="utf-8",
        )
        _use_per_page_ocr(config)
        self.assertEqual(
            config.read_text(encoding="utf-8"),
            "[pdf]\nauto_enable_ocr_workaround = false\nocr_workaround = false\ntranslate_table_text = true\n",
        )

    def test_groups_alternating_lines_by_prose_region(self):
        def glyph(text, region, kind="text", xobj=0):
            return SimpleNamespace(
                text=text, xobj_id=xobj, layout=SimpleNamespace(id=region, name=kind)
            )

        left_first, left_second = glyph("left 1", 1), glyph("left 2", 1)
        right_first, right_second = glyph("right 1", 2), glyph("right 2", 2)
        other_object = glyph("different object", 1, xobj=1)
        equation = glyph("equation", 3, "formula")
        reordered = ocr._group_ocr_prose(
            [left_first, right_first, left_second, right_second, other_object, equation],
            lambda char: char.layout,
        )
        self.assertEqual(
            reordered, [left_first, left_second, right_first, right_second, other_object, equation]
        )

    def test_preserves_explicit_word_boundaries_in_invisible_ocr_text(self):
        data = b"BT\n3 Tr\n/F0 10 Tf\n<0061>Tj\n7 0 Td\n<006400610072006b>Tj\nET\n"
        expected = data.replace(b">Tj", b"0020>Tj")
        document = unittest.mock.Mock()
        document.xref_stream.return_value = data
        page = unittest.mock.Mock()
        page.get_contents.return_value = [1]
        ocr._preserve_ocr_word_spaces(document, page, "eng")
        document.update_stream.assert_called_once_with(1, expected)

        document.reset_mock()
        ocr._preserve_ocr_word_spaces(document, page, "jpn")
        document.update_stream.assert_not_called()

    def test_keeps_space_between_recognized_decimals_and_units(self):
        def token(text):
            return b"<" + text.encode("utf-16-be").hex().encode("ascii") + b">Tj"

        for text, expected in [("1.2mV", "1.2 mV"), ("-1,4kPa", "-1,4 kPa"),
                               ("2020s", "2020s"), ("1.23", "1.23")]:
            with self.subTest(text=text):
                self.assertEqual(ocr._OCR_WORD.sub(ocr._space_ocr_word, token(text)),
                                 token(expected + " "))


if __name__ == "__main__":
    unittest.main()
