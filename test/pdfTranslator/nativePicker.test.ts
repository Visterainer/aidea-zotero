import { assert } from "chai";
import {
  pickDirectory,
  pickPdfFile,
  resetFilePickerHelperForTest,
  setFilePickerHelperForTest,
} from "../../src/modules/pdfTranslator/nativePicker";

type PickerMode = "open" | "folder";
type PickerFilter = [string, string];

let nextResult: string | false = false;
let shouldThrow = false;
let lastPicker:
  | {
      title: string;
      mode: PickerMode;
      filters?: PickerFilter[];
    }
  | undefined;

class MockFilePickerHelper {
  constructor(
    public title: string,
    public mode: PickerMode,
    public filters?: PickerFilter[],
  ) {
    lastPicker = { title, mode, filters };
  }

  async open(): Promise<string | false> {
    if (shouldThrow) {
      throw new Error("file picker failed");
    }
    return nextResult;
  }
}

describe("nativePicker", function () {
  beforeEach(function () {
    nextResult = false;
    shouldThrow = false;
    lastPicker = undefined;
    setFilePickerHelperForTest(MockFilePickerHelper);
  });

  afterEach(function () {
    resetFilePickerHelperForTest();
  });

  describe("pickPdfFile", function () {
    it("returns the selected PDF path", async function () {
      nextResult = "C:\\Users\\test\\paper.pdf";

      const result = await pickPdfFile({} as Window);

      assert.equal(result, nextResult);
      assert.deepEqual(lastPicker, {
        title: "Select PDF",
        mode: "open",
        filters: [["PDF Files (*.pdf)", "*.pdf"]],
      });
    });

    it("returns null when the file picker is cancelled", async function () {
      nextResult = false;

      const result = await pickPdfFile({} as Window);

      assert.isNull(result);
    });

    it("returns null when the file picker throws", async function () {
      shouldThrow = true;

      const result = await pickPdfFile({} as Window);

      assert.isNull(result);
    });
  });

  describe("pickDirectory", function () {
    it("returns the selected directory path", async function () {
      nextResult = "C:\\Users\\test\\output";

      const result = await pickDirectory({} as Window);

      assert.equal(result, nextResult);
      assert.deepEqual(lastPicker, {
        title: "Select Save Directory",
        mode: "folder",
        filters: undefined,
      });
    });

    it("returns null when the directory picker is cancelled", async function () {
      nextResult = false;

      const result = await pickDirectory({} as Window);

      assert.isNull(result);
    });

    it("returns null when the directory picker throws", async function () {
      shouldThrow = true;

      const result = await pickDirectory({} as Window);

      assert.isNull(result);
    });
  });
});
