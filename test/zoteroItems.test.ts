import { assert } from "chai";
import { getZoteroItem } from "../src/utils/zoteroItems";

const originalZotero = (globalThis as Record<string, unknown>).Zotero;

describe("zoteroItems", function () {
  afterEach(function () {
    (globalThis as Record<string, unknown>).Zotero = originalZotero;
  });

  it("returns an existing Zotero item unchanged", function () {
    const item = { id: 42 } as Zotero.Item;
    (globalThis as Record<string, unknown>).Zotero = {
      Items: {
        get: () => item,
      },
    };

    assert.strictEqual(getZoteroItem(42), item);
  });

  it("normalizes Zotero's missing-item false sentinel to null", function () {
    (globalThis as Record<string, unknown>).Zotero = {
      Items: {
        get: () => false,
      },
    };

    assert.isNull(getZoteroItem(404));
  });
});
