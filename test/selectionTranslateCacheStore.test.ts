import { assert } from "chai";

import { initSelectionTranslateCacheStore } from "../src/utils/selectionTranslateCacheStore";

describe("selection translation cache migration", function () {
  it("deletes all cache rows from schema versions older than v2", async function () {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    (globalThis as any).Zotero = {
      DB: {
        async executeTransaction<T>(fn: () => Promise<T>): Promise<T> {
          return fn();
        },
        async queryAsync(sql: string, params: unknown[] = []) {
          calls.push({ sql, params });
          return [];
        },
      },
    };
    await initSelectionTranslateCacheStore();
    const deletion = calls.find((call) =>
      call.sql.includes("WHERE schema_version < ?"),
    );
    assert.deepEqual(deletion?.params, [2]);
  });
});
