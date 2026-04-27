import { assert } from "chai";
import { __paperSearchTest } from "../src/modules/contextPanel/paperSearch";

describe("paperSearch normalization", function () {
  it("normalizes case, full-width forms, punctuation, and accents", function () {
    assert.equal(
      __paperSearchTest.normalizeSearchToken("Ｆáctor-Miner"),
      "factor miner",
    );
  });

  it("splits English query into tokens by whitespace", function () {
    assert.deepEqual(__paperSearchTest.splitSearchTokens("machine learning"), [
      "machine",
      "learning",
    ]);
  });

  it("splits CJK, Kana, and Hangul characters individually", function () {
    assert.deepEqual(__paperSearchTest.splitSearchTokens("机器学習모델"), [
      "机",
      "器",
      "学",
      "習",
      "모",
      "델",
    ]);
  });
});
