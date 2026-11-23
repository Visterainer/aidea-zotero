"""Run with the verified translation environment's Python."""

from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from babeldoc.format.pdf.document_il.backend import pdf_creater
from babeldoc.format.pdf.document_il.il_version_1 import Box
from babeldoc.format.pdf.document_il.midend import il_translator, il_translator_llm_only

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "addon" / "scripts"))
from aidea_pdf_text import (
    _complete_tex_delimiter_cmap,
    _join_table_line_wraps,
    install_data_paragraph_preservation,
    install_space_mapping,
)


class CMapTest(unittest.TestCase):
    def test_preserves_unicode_spaces_when_they_have_no_glyph_outline(self):
        original = pdf_creater.make_tounicode
        cmap = {1: 0x20, 2: ord("1"), 3: 0xA0, 4: ord("7"), 5: 0x01, 6: 0x660069}
        with patch.object(pdf_creater, "make_tounicode", original):
            install_space_mapping()
            rebuilt = pdf_creater.make_tounicode(cmap, iter((2, 4)))
        self.assertEqual(
            pdf_creater.parse_tounicode_cmap(rebuilt.encode("ascii")),
            {1: 0x20, 2: ord("1"), 3: 0xA0, 4: ord("7")},
        )

    def test_adds_missing_tex_delimiters_without_overwriting_existing_mappings(self):
        original = (
            b"begincmap\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n"
            b"1 beginbfrange\n<01> <02> [<0029> <005D>]\nendbfrange\n"
            b"1 beginbfchar\n<D5> <2211FE01>\nendbfchar\nendcmap\n"
        )
        encoding = ["parenleftbig", "parenrightbig", "bracketrightBig", "parenlefttp"]
        result = _complete_tex_delimiter_cmap(original, encoding)
        self.assertEqual(
            result, original.replace(b"endcmap", b"1 beginbfchar\n<00> <0028>\nendbfchar\nendcmap")
        )
        self.assertEqual(_complete_tex_delimiter_cmap(result, encoding), result)

    def test_keeps_numeric_table_lists_for_both_translation_paths(self):
        modules = (il_translator, il_translator_llm_only)
        with (
            patch.object(modules[0], "is_pure_numeric_paragraph", modules[0].is_pure_numeric_paragraph),
            patch.object(modules[1], "is_pure_numeric_paragraph", modules[1].is_pure_numeric_paragraph),
        ):
            install_data_paragraph_preservation()
            for module in modules:
                is_numeric = module.is_pure_numeric_paragraph
                self.assertTrue(is_numeric(SimpleNamespace(unicode="006, 009, 012, 013, 016")))
                self.assertTrue(is_numeric(SimpleNamespace(unicode="0.23")))
                self.assertTrue(is_numeric(SimpleNamespace(unicode="−1.20%, 1.18%")))
                self.assertTrue(is_numeric(SimpleNamespace(unicode=",, , ,")))
                self.assertFalse(is_numeric(SimpleNamespace(unicode="006, 009 in the sample")))
                self.assertFalse(is_numeric(SimpleNamespace(unicode="007: Factor name")))
                self.assertTrue(is_numeric(SimpleNamespace(
                    unicode="015 Mul(Neg(Delta($returns, 3)), Std($returns, 12)) "
                            "016 Neg(Div($volume, Add(EMA($volume, 12), 1e-6)))"
                )))
                self.assertFalse(is_numeric(SimpleNamespace(
                    unicode="The analysis uses Delta($returns, 3) as its reference."
                )))

    def test_joins_wrapped_words_inside_one_table_cell_without_changing_source_glyphs(self):
        def cell(x, y, x2, y2, text):
            return SimpleNamespace(
                box=Box(x=x, y=y, x2=x2, y2=y2), xobj_id=0, unicode=text,
                pdf_paragraph_composition=[text],
            )

        upper = cell(40, 20, 90, 27, "Compare previous fea-")
        next_column = cell(96, 19, 111, 25, "higher")
        continuation = cell(40, 12, 54, 18, "tures.")
        next_row = cell(40, 2, 64, 8, "Other row")
        page = SimpleNamespace(pdf_paragraph=[upper, next_column, continuation, next_row])
        _join_table_line_wraps(page, [Box(x=35, y=0, x2=120, y2=33)])
        self.assertEqual(page.pdf_paragraph, [upper, next_column, next_row])
        self.assertEqual(upper.unicode, "Compare previous features.")
        self.assertEqual(upper.pdf_paragraph_composition, ["Compare previous fea-", "tures."])
        self.assertEqual(upper.box.y, 12)


if __name__ == "__main__":
    unittest.main()
