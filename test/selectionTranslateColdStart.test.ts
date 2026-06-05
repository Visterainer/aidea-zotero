import { assert } from "chai";
import {
  buildSelectionTranslateColdStartAttempts,
  isSelectionTranslateInputLengthError,
  runSelectionTranslateColdStartAttempts,
} from "../src/modules/contextPanel/selectionTranslateColdStart";
import { getPdfContextFingerprint } from "../src/modules/contextPanel/selectionTranslate";

function longText(char: string, length: number): string {
  return char.repeat(length);
}

function textWithLateHeading(heading: string): string {
  return `${longText("a", 5000)}\n\n${heading}\nref one\nref two`;
}

describe("selectionTranslateColdStart", function () {
  it("strips late References headings before building attempts", function () {
    for (const heading of [
      "References",
      "REFERENCES",
      "Bibliography",
      "Works Cited",
      "Literature Cited",
      "\u53c2\u8003\u6587\u732e",
    ]) {
      const result = buildSelectionTranslateColdStartAttempts({
        pdfText: textWithLateHeading(heading),
      });

      assert.isTrue(result.referencesRemoved, heading);
      assert.equal(result.referenceHeading, heading);
      assert.notInclude(result.attempts[0].paperText, "ref one");
    }
  });

  it("does not strip early ordinary references mentions", function () {
    const result = buildSelectionTranslateColdStartAttempts({
      pdfText: `References\nnot a bibliography heading\n${longText("b", 5000)}`,
    });

    assert.isFalse(result.referencesRemoved);
    assert.include(result.attempts[0].paperText, "not a bibliography heading");
  });

  it("builds a fixed full-to-short fallback sequence", function () {
    const result = buildSelectionTranslateColdStartAttempts({
      pdfText: longText("c", 1000),
    });

    assert.deepEqual(
      result.attempts.map((attempt) => attempt.id),
      ["full", "first50", "first25", "first15"],
    );
    assert.deepEqual(
      result.attempts.map((attempt) => attempt.selectedBodyLength),
      [1000, 500, 250, 150],
    );
  });

  it("keeps metadata outside body ratio calculations", function () {
    const result = buildSelectionTranslateColdStartAttempts({
      title: "Paper Title",
      abstractNote: "Metadata abstract.",
      pdfText: longText("d", 1000),
    });
    const first15 = result.attempts.find((attempt) => attempt.id === "first15");

    assert.equal(first15?.selectedBodyLength, 150);
    assert.isTrue(first15?.paperText.startsWith("Title:\nPaper Title"));
    assert.include(first15?.paperText || "", "Abstract:\nMetadata abstract.");
  });

  it("uses full as the reference-stripped body", function () {
    const result = buildSelectionTranslateColdStartAttempts({
      pdfText: textWithLateHeading("References"),
    });

    assert.equal(result.attempts[0].id, "full");
    assert.equal(
      result.attempts[0].selectedBodyLength,
      result.referenceStrippedLength,
    );
  });

  it("detects input-length errors", function () {
    assert.isTrue(
      isSelectionTranslateInputLengthError(
        "400 Range of input length should be [1, 30720]",
      ),
    );
    assert.isTrue(
      isSelectionTranslateInputLengthError(
        new Error("maximum context length exceeded"),
      ),
    );
    assert.isTrue(
      isSelectionTranslateInputLengthError({
        error: { message: "request too large: too many tokens" },
      }),
    );
    assert.isFalse(isSelectionTranslateInputLengthError("401 unauthorized"));
  });

  it("falls back only after input-length errors", async function () {
    const result = buildSelectionTranslateColdStartAttempts({
      pdfText: longText("e", 1000),
    });
    const visited: string[] = [];

    const output = await runSelectionTranslateColdStartAttempts({
      attempts: result.attempts,
      run: async (attempt) => {
        visited.push(attempt.id);
        if (attempt.id === "full") {
          throw new Error("Range of input length should be [1, 30720]");
        }
        return `ok:${attempt.id}`;
      },
    });

    assert.deepEqual(visited, ["full", "first50"]);
    assert.equal(output.attempt.id, "first50");
    assert.equal(output.result, "ok:first50");
  });

  it("does not fall back after non-length errors", async function () {
    const result = buildSelectionTranslateColdStartAttempts({
      pdfText: longText("f", 1000),
    });
    const visited: string[] = [];

    try {
      await runSelectionTranslateColdStartAttempts({
        attempts: result.attempts,
        run: async (attempt) => {
          visited.push(attempt.id);
          throw new Error("401 unauthorized");
        },
      });
      assert.fail("Expected non-length error to be thrown");
    } catch (error) {
      assert.match(String((error as Error).message), /unauthorized/);
    }

    assert.deepEqual(visited, ["full"]);
  });

  it("uses v3-auto in the cold-start fingerprint", function () {
    const pdfContext = {
      title: "Context title",
      fullLength: 2000,
      chunks: ["first chunk", "last chunk"],
      chunkStats: [],
      docFreq: {},
      avgChunkLength: 0,
      embeddingFailed: false,
    };

    const fingerprint = getPdfContextFingerprint(
      1,
      pdfContext,
      "Title",
      "Abstract",
    );

    assert.match(fingerprint, /^v3-auto-/);
  });
});
