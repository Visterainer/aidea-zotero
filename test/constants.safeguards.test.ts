import { assert } from "chai";
import {
  MAX_CONTEXT_LENGTH,
  MAX_CONTEXT_LENGTH_WITH_IMAGE,
  FULL_CONTEXT_CHAR_LIMIT,
  MAX_CONTEXT_CHUNKS,
  MAX_SELECTED_IMAGES,
  MAX_SELECTED_TEXT_CONTEXTS,
  MAX_SELECTED_PAPER_CONTEXTS,
  ACTIVE_PAPER_MULTI_CONTEXT_MAX_CHUNKS,
  ACTIVE_PAPER_MULTI_CONTEXT_MAX_LENGTH,
  SUPPLEMENTAL_PAPER_CONTEXT_MAX_CHUNKS,
  SUPPLEMENTAL_PAPER_CONTEXT_MAX_LENGTH,
  SUPPLEMENTAL_PAPER_CONTEXT_TOTAL_MAX_LENGTH,
  FORCE_FULL_CONTEXT,
  formatFigureCountLabel,
  formatPaperCountLabel,
} from "../src/modules/contextPanel/constants";

describe("constants — safeguard limits", function () {
  describe("P0-1: context length limits are finite", function () {
    it("MAX_CONTEXT_LENGTH should be finite and > 0", function () {
      assert.isTrue(Number.isFinite(MAX_CONTEXT_LENGTH));
      assert.isAbove(MAX_CONTEXT_LENGTH, 0);
    });

    it("MAX_CONTEXT_LENGTH_WITH_IMAGE should be finite and > 0", function () {
      assert.isTrue(Number.isFinite(MAX_CONTEXT_LENGTH_WITH_IMAGE));
      assert.isAbove(MAX_CONTEXT_LENGTH_WITH_IMAGE, 0);
    });

    it("FULL_CONTEXT_CHAR_LIMIT should be finite and > 0", function () {
      assert.isTrue(Number.isFinite(FULL_CONTEXT_CHAR_LIMIT));
      assert.isAbove(FULL_CONTEXT_CHAR_LIMIT, 0);
    });

    it("MAX_CONTEXT_CHUNKS should be finite and > 0", function () {
      assert.isTrue(Number.isFinite(MAX_CONTEXT_CHUNKS));
      assert.isAbove(MAX_CONTEXT_CHUNKS, 0);
    });

    it("FORCE_FULL_CONTEXT should still be enabled", function () {
      // Full-text path is preferred for normal documents
      assert.isTrue(FORCE_FULL_CONTEXT);
    });

    it("should allow reasonable documents (< FULL_CONTEXT_CHAR_LIMIT)", function () {
      // A 50-page paper is roughly 150K chars — should fit
      const typicalPaperLength = 150000;
      assert.isBelow(typicalPaperLength, FULL_CONTEXT_CHAR_LIMIT);
    });

    it("should reject extremely large documents (> FULL_CONTEXT_CHAR_LIMIT)", function () {
      // A 300-page thesis is roughly 900K chars — should trigger retrieval fallback
      const veryLargeDocument = 900000;
      assert.isAbove(veryLargeDocument, FULL_CONTEXT_CHAR_LIMIT);
    });
  });

  describe("P0-3: image/selection/paper limits are finite", function () {
    it("MAX_SELECTED_IMAGES should be finite (prevents memory exhaustion)", function () {
      assert.isTrue(Number.isFinite(MAX_SELECTED_IMAGES));
      assert.isAbove(MAX_SELECTED_IMAGES, 0);
      // UI and memory: base64 images at 200KB-2MB each, 50 should be plenty
      assert.isAtMost(MAX_SELECTED_IMAGES, 100);
    });

    it("MAX_SELECTED_TEXT_CONTEXTS should be finite", function () {
      assert.isTrue(Number.isFinite(MAX_SELECTED_TEXT_CONTEXTS));
      assert.isAbove(MAX_SELECTED_TEXT_CONTEXTS, 0);
    });

    it("MAX_SELECTED_PAPER_CONTEXTS should be finite", function () {
      assert.isTrue(Number.isFinite(MAX_SELECTED_PAPER_CONTEXTS));
      assert.isAbove(MAX_SELECTED_PAPER_CONTEXTS, 0);
    });

    it("ACTIVE_PAPER_MULTI_CONTEXT limits should be finite", function () {
      assert.isTrue(Number.isFinite(ACTIVE_PAPER_MULTI_CONTEXT_MAX_CHUNKS));
      assert.isTrue(Number.isFinite(ACTIVE_PAPER_MULTI_CONTEXT_MAX_LENGTH));
    });

    it("SUPPLEMENTAL_PAPER_CONTEXT limits should be finite", function () {
      assert.isTrue(Number.isFinite(SUPPLEMENTAL_PAPER_CONTEXT_MAX_CHUNKS));
      assert.isTrue(Number.isFinite(SUPPLEMENTAL_PAPER_CONTEXT_MAX_LENGTH));
      assert.isTrue(
        Number.isFinite(SUPPLEMENTAL_PAPER_CONTEXT_TOTAL_MAX_LENGTH),
      );
    });
  });

  describe("Label formatting with finite limits", function () {
    it("formatFigureCountLabel should show count/max format", function () {
      const label = formatFigureCountLabel(3);
      assert.include(label, "3");
      assert.include(label, `/${MAX_SELECTED_IMAGES}`);
    });

    it("formatPaperCountLabel should show count/max format", function () {
      const label = formatPaperCountLabel(2);
      assert.include(label, "2");
      assert.include(label, `/${MAX_SELECTED_PAPER_CONTEXTS}`);
    });

    it("formatFigureCountLabel should return empty for zero", function () {
      assert.equal(formatFigureCountLabel(0), "");
    });
  });
});
