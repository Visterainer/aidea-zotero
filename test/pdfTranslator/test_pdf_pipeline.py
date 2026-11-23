from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

import pymupdf as pdf

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "addon" / "scripts"))
from aidea_pdf_pipeline import assemble_outputs, translation_partitions


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


if __name__ == "__main__":
    unittest.main()
