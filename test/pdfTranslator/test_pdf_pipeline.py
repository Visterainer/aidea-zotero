from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

import pymupdf as pdf

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "addon" / "scripts"))
from aidea_pdf_pipeline import assemble_outputs, translation_partitions
from aidea_pdf_tables import fit_translated_table_cells


class PDFPipelineTest(unittest.TestCase):
    def test_partitions_keep_skipped_pages_out_of_both_translation_passes(self):
        self.assertEqual(translation_partitions(5, [1, 2, 4, 5], {2, 3, 5}),
                         [([1, 4], False), ([2, 5], True)])

    def test_merges_alternating_pairs_in_place_and_preserves_internal_links(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "Source.pdf"
            with pdf.open() as source_doc:
                for _ in range(3):
                    source_doc.new_page()
                source_doc.save(source)
            for name in ("first", "second"):
                folder = root / name
                folder.mkdir()
                with pdf.open() as document:
                    for index in range(6):
                        page = document.new_page()
                        page.insert_text((20, 20), f"{name} page {index + 1}")
                    document[0].insert_link({"kind": pdf.LINK_GOTO, "from": pdf.Rect(15, 8, 120, 25),
                                             "page": 5, "to": pdf.Point(20, 20)})
                    document.set_toc([[1, "End", 6]])
                    document.save(folder / "Source.fa.dual.pdf")
            destination = root / "output"
            destination.mkdir()
            assemblies = [(root / "first", [1]), (root / "second", [3])]
            names = assemble_outputs(source, assemblies, destination, mono=False, dual=True,
                                     alternating=True, save_glossary=False)
            with pdf.open(destination / names[0]) as result:
                self.assertEqual([page.get_text().strip().split()[0] for page in result],
                                 ["first"] * 4 + ["second"] * 2)
                self.assertEqual(result[0].get_links()[0]["page"], 5)
                self.assertEqual(result.get_toc(), [[1, "End", 6]])

    def test_reflows_only_the_overflowing_cell_above_the_last_rule(self):
        with TemporaryDirectory() as directory:
            source, translated = (Path(directory) / name for name in ("source.pdf", "target.pdf"))
            for path in (source, translated):
                with pdf.open() as document:
                    page = document.new_page(width=320, height=160)
                    page.draw_line((20, 27), (290, 27))
                    page.draw_line((20, 110), (290, 110))
                    page.insert_text((24, 90), "Row one", fontsize=8)
                    page.insert_text((104, 90), "Unchanged", fontsize=8)
                    page.insert_text((24, 102), "Row two", fontsize=8)
                    for baseline, text in ((102, "Preserve the text"), (109, "inside the last"),
                                           (116, "cell")) if path == translated else ((102, "Short cell"),):
                        page.insert_text((104, baseline), text, fontsize=8)
                    document.save(path)
            arguments = dict(dual=False, alternating=False, translated_first=False, pages={1})
            self.assertEqual(fit_translated_table_cells(source, translated, **arguments), 1)
            with pdf.open(translated) as document:
                page = document[0]
                self.assertIn("Unchanged", page.get_text())
                self.assertIn("Row two", page.get_text())
                self.assertIn("Preserve the text inside the last cell",
                              " ".join(page.get_text(clip=pdf.Rect(99, 94, 290, 110)).split()))
                self.assertEqual(page.get_text(clip=pdf.Rect(99, 111, 290, 130)), "")


if __name__ == "__main__":
    unittest.main()
