import { assert } from "chai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

import {
  ModelOutputStreamNormalizer,
  normalizeModelOutput,
} from "../src/utils/modelOutputNormalizer";

type Fixture = {
  name: string;
  input: string;
  expected: string;
};

const fixtures = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("./fixtures/model-output-normalization.json", import.meta.url),
    ),
    "utf8",
  ),
) as Fixture[];

function normalizeChunks(chunks: string[]): string {
  const normalizer = new ModelOutputStreamNormalizer();
  let emitted = "";
  for (const chunk of chunks) {
    for (const event of normalizer.push({ type: "content", text: chunk })) {
      if (event.type === "content") emitted += event.text;
    }
  }
  const completed = normalizer.finish();
  for (const event of completed.events) {
    if (event.type === "content") emitted += event.text;
  }
  assert.equal(emitted, completed.output.text);
  return completed.output.text;
}

describe("model output normalizer", function () {
  it("normalizes every shared fixture", function () {
    for (const fixture of fixtures) {
      assert.equal(normalizeModelOutput(fixture.input).text, fixture.expected);
    }
  });

  it("normalizes every two-chunk split for every fixture", function () {
    for (const fixture of fixtures) {
      for (let split = 0; split <= fixture.input.length; split += 1) {
        assert.equal(
          normalizeChunks([
            fixture.input.slice(0, split),
            fixture.input.slice(split),
          ]),
          fixture.expected,
          `split at ${split}`,
        );
      }
    }
  });

  it("normalizes character-sized chunks for every fixture", function () {
    for (const fixture of fixtures) {
      assert.equal(normalizeChunks([...fixture.input]), fixture.expected);
    }
  });

  it("drops structured reasoning events while preserving content", function () {
    const normalizer = new ModelOutputStreamNormalizer();
    const events = [
      ...normalizer.push({
        type: "reasoning" as const,
        text: "private",
        channel: "details" as const,
      }),
      ...normalizer.push({ type: "content" as const, text: "Visible" }),
    ];
    const completed = normalizer.finish();
    assert.equal(completed.output.text, "Visible");
    assert.equal(completed.output.filteredReasoningChars, 7);
    assert.deepEqual(
      events.filter((event) => event.type === "content"),
      [{ type: "content", text: "Visible" }],
    );
  });
});
