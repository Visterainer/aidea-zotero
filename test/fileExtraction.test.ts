import { assert } from "chai";
import {
  readFileAsText,
  readFileAsArrayBuffer,
} from "../src/utils/fileExtraction";

describe("fileExtraction", function () {
  it("readFileAsArrayBuffer should prefer file.arrayBuffer() if available", async function () {
    const textStr = "hello world";
    const enc = new TextEncoder();
    const expectedBuffer = enc.encode(textStr).buffer;

    // Mock the File object that has arrayBuffer() natively
    const fakeFile = {
      arrayBuffer: async () => expectedBuffer,
    } as any;

    // Mock owner element
    const fakeOwner = { ownerDocument: { defaultView: {} } } as Element;

    const result = await readFileAsArrayBuffer(fakeOwner, fakeFile);
    assert.strictEqual(result, expectedBuffer);
  });
});
