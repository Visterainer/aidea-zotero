import { assert } from "chai";
import { tokenizeText } from "../src/modules/contextPanel/pdfContext";

describe("pdfContext", function () {
  describe("tokenizeText", function () {
    it("should tokenize English words (3+ chars, no stopwords)", function () {
      const tokens = tokenizeText(
        "The machine learning algorithm processes data efficiently.",
      );
      // "the" is a stopword, "machine" (7), "learning" (8), "algorithm" (9),
      // "processes" (9), "data" (4), "efficiently" (11) — all >= 3 chars
      assert.include(tokens, "machine");
      assert.include(tokens, "learning");
      assert.include(tokens, "algorithm");
      assert.include(tokens, "data");
      assert.notInclude(tokens, "the");
    });

    it("should filter out English words shorter than 3 chars", function () {
      const tokens = tokenizeText("I am OK in CS 101 of AI");
      // "am" (2 chars) should be excluded, "101" (3 chars) stays
      assert.notInclude(tokens, "am");
      assert.notInclude(tokens, "in"); // also a very short word
      assert.include(tokens, "101");
    });

    it("should filter English stopwords", function () {
      const tokens = tokenizeText(
        "the and for with that this from are was were",
      );
      assert.lengthOf(tokens, 0);
    });

    it("should tokenize individual Chinese characters", function () {
      const tokens = tokenizeText("机器学习算法可以处理数据");
      // Each CJK character should be a separate token
      assert.include(tokens, "机");
      assert.include(tokens, "器");
      assert.include(tokens, "学");
      assert.include(tokens, "习");
      assert.include(tokens, "算");
      assert.include(tokens, "法");
      assert.include(tokens, "数");
      assert.include(tokens, "据");
    });

    it("should filter Chinese stopwords", function () {
      const tokens = tokenizeText("的了在是我有和就不");
      // All of these are in the Chinese stopword list
      assert.notInclude(tokens, "的");
      assert.notInclude(tokens, "了");
      assert.notInclude(tokens, "在");
      assert.notInclude(tokens, "是");
    });

    it("should tokenize mixed English and Chinese text", function () {
      const tokens = tokenizeText("The transformer模型 uses attention机制");
      // English: "transformer" (11), "uses" — wait, "uses" (4 chars >= 3)
      // "attention" (9)
      // Chinese: 模, 型, 机, 制 — individual chars (excluding 用 which isn't here)
      assert.include(tokens, "transformer");
      assert.include(tokens, "attention");
      assert.include(tokens, "模");
      assert.include(tokens, "型");
      assert.include(tokens, "机");
      assert.include(tokens, "制");
      assert.notInclude(tokens, "the"); // stopword
    });

    it("should return empty array for empty input", function () {
      assert.deepEqual(tokenizeText(""), []);
    });

    it("should handle pure punctuation input", function () {
      const tokens = tokenizeText("!!! ... ???");
      assert.deepEqual(tokens, []);
    });

    it("should tokenize Korean Hangul characters", function () {
      const tokens = tokenizeText("머신러닝 알고리즘");
      // Each Hangul syllable should be a separate token
      assert.include(tokens, "머");
      assert.include(tokens, "신");
      assert.include(tokens, "러");
    });

    it("should tokenize Japanese Hiragana as runs", function () {
      const tokens = tokenizeText("こんにちは 機械学習");
      // Hiragana: "こんにちは" as a single run
      assert.include(tokens, "こんにちは");
      // Kanji: individual characters
      assert.include(tokens, "機");
      assert.include(tokens, "械");
    });
  });
});
