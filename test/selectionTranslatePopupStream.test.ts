import { assert } from "chai";
import { createSelectionTranslatePopupStream } from "../src/modules/contextPanel/selectionTranslatePopupStream";

describe("selection translate popup streaming", function () {
  it("coalesces deltas and renders the latest accumulated text", function () {
    const frames: Array<() => void> = [];
    const rendered: string[] = [];
    const stream = createSelectionTranslatePopupStream({
      scheduleFrame(callback) {
        frames.push(callback);
      },
      render(text) {
        rendered.push(text);
      },
    });

    stream.push("A");
    stream.push("B");
    stream.push("C");

    assert.lengthOf(frames, 1);
    assert.isTrue(stream.hasContent);
    frames[0]();
    assert.deepEqual(rendered, ["ABC"]);
  });

  it("preserves whitespace between streamed chunks", function () {
    const frames: Array<() => void> = [];
    const rendered: string[] = [];
    const stream = createSelectionTranslatePopupStream({
      scheduleFrame(callback) {
        frames.push(callback);
      },
      render(text) {
        rendered.push(text);
      },
    });

    stream.push("hello ");
    stream.push("world");
    frames[0]();

    assert.deepEqual(rendered, ["hello world"]);
  });

  it("invalidates queued and future deltas after finalization", function () {
    const frames: Array<() => void> = [];
    const rendered: string[] = [];
    const stream = createSelectionTranslatePopupStream({
      scheduleFrame(callback) {
        frames.push(callback);
      },
      render(text) {
        rendered.push(text);
      },
    });

    stream.push("partial");
    stream.invalidate();
    stream.push("late");
    frames[0]();

    assert.deepEqual(rendered, []);
  });
});
