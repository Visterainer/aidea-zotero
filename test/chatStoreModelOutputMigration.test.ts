import { assert } from "chai";

import { migratePersistedModelOutputs } from "../src/utils/chatStore";

type Row = {
  id: number;
  role: "user" | "assistant";
  text: string;
  reasoning_summary: string | null;
  reasoning_details: string | null;
  context_refs_json: string | null;
};

describe("chatStore model output migration", function () {
  it("is idempotent and only cleans assistant output plus compacted summaries", async function () {
    const rows: Row[] = [
      {
        id: 1,
        role: "assistant",
        text: "<think>private</think>Visible",
        reasoning_summary: "private summary",
        reasoning_details: "private details",
        context_refs_json: null,
      },
      {
        id: 2,
        role: "user",
        text: "<think>literal user input</think>Keep me",
        reasoning_summary: null,
        reasoning_details: null,
        context_refs_json: null,
      },
      {
        id: 3,
        role: "assistant",
        text: "<thought>reasoning only</thought>",
        reasoning_summary: null,
        reasoning_details: null,
        context_refs_json: JSON.stringify({
          compactedSummary: "<THINK>summary reasoning</think>Clean summary",
        }),
      },
    ];
    (globalThis as any).Zotero = {
      DB: {
        async queryAsync(sql: string, params: unknown[] = []) {
          if (sql.includes("SELECT id AS messageId, text")) {
            return rows
              .filter(
                (row) =>
                  row.role === "assistant" &&
                  /<(?:think|thought)>/i.test(row.text),
              )
              .map((row) => ({ messageId: row.id, text: row.text }));
          }
          if (sql.includes("SET text = ? WHERE id = ?")) {
            const row = rows.find((entry) => entry.id === Number(params[1]));
            if (row) row.text = String(params[0]);
            return [];
          }
          if (sql.includes("SET reasoning_summary = NULL")) {
            for (const row of rows) {
              row.reasoning_summary = null;
              row.reasoning_details = null;
            }
            return [];
          }
          if (sql.includes("SELECT id AS messageId, context_refs_json")) {
            return rows
              .filter(
                (row) =>
                  typeof row.context_refs_json === "string" &&
                  /<(?:think|thought)>/i.test(row.context_refs_json),
              )
              .map((row) => ({
                messageId: row.id,
                contextRefsJson: row.context_refs_json,
              }));
          }
          if (sql.includes("SET context_refs_json = ? WHERE id = ?")) {
            const row = rows.find((entry) => entry.id === Number(params[1]));
            if (row) row.context_refs_json = String(params[0]);
            return [];
          }
          return [];
        },
      },
    };

    await migratePersistedModelOutputs();
    const once = JSON.stringify(rows);
    await migratePersistedModelOutputs();

    assert.equal(rows[0].text, "Visible");
    assert.equal(rows[1].text, "<think>literal user input</think>Keep me");
    assert.equal(rows[2].text, "");
    assert.deepEqual(JSON.parse(rows[2].context_refs_json || "{}"), {
      compactedSummary: "Clean summary",
    });
    assert.equal(rows[0].reasoning_summary, null);
    assert.equal(rows[0].reasoning_details, null);
    assert.equal(JSON.stringify(rows), once);
  });
});
