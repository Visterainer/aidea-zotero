from pathlib import Path
import re
import sys
import unittest

import pymupdf as pdf

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "addon" / "scripts"))
from aidea_pdf_pipeline import uses_rust_engine
from aidea_persian_render import render_paragraph


@unittest.skipUnless(uses_rust_engine(), "Rust translation environment required")
class PersianPDFTest(unittest.TestCase):
    def test_copy_map_retains_persian_controls_digits_and_latin_runs(self):
        sample = ("پژوهشگران چگونه گزارش می‌نویسند؟ نسخهٔ GPT-4.1 (2026) و آزمون ۱۲۳. "
                  "در پایان، داده‌ها را در DOI: 10.1000/test بررسی می‌کنیم.")
        with pdf.open() as document:
            page = document.new_page(width=480, height=288)
            bounds = pdf.Rect(38.182, 95.666, 347.673, 163.775)
            self.assertTrue(render_paragraph(page, bounds, sample, 13))
            streams = [document.xref_stream(xref)
                       for xref in range(1, document.xref_length())
                       if document.xref_is_stream(xref)]
            actual = "".join(
                bytes.fromhex(token.decode()).decode("utf-16be")
                for stream in streams
                for token in re.findall(rb"/ActualText\s*<FEFF([a-fA-F0-9]+)>", stream)
            )
            self.assertEqual(" ".join(actual.split()), sample)
            rendered = page.get_pixmap(clip=bounds, colorspace=pdf.csGRAY)
            self.assertLess(min(rendered.samples), 128)


if __name__ == "__main__":
    unittest.main()
