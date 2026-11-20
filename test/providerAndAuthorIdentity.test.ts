import { assert } from "chai";
import { createAuthor } from "../src/modules/authorProfiles/utils";
import { mergeAuthors } from "../src/modules/authorProfiles/resolver";
import {
  resolveModelCredentials,
  resolveModelCredentialsOrThrow,
} from "../src/modules/pdfTranslator/modelResolver";

describe("explicit translation routes and author identity", function () {
  describe("translation provider binding", function () {
    const global = globalThis as any;
    let saved: unknown;
    let prefs: Map<string, string>;
    const cache = (
      providers: Record<
        string,
        { id: string; apiBase?: string; apiKey?: string }[]
      >,
    ) => prefs.set("oauthModelListCache", JSON.stringify(providers));

    beforeEach(function () {
      saved = global.Zotero;
      prefs = new Map([
        ["primaryConnectionMode", "custom"],
        ["apiBase", "https://primary.invalid/v1"],
        ["apiKey", "primary-fixture"],
        ["model", "shared"],
      ]);
      global.Zotero = {
        Prefs: {
          get: (key: string) =>
            prefs.get(key.replace(/^extensions\.zotero\.aidea\./, "")) || "",
        },
      };
    });

    afterEach(function () {
      global.Zotero = saved;
    });

    it("does not select the public endpoint after the queued private provider disappears", async function () {
      cache({
        public: [{ id: "shared", apiBase: "https://public.invalid/v1" }],
      });
      assert.isNull(await resolveModelCredentials("shared", "removed-private"));
      let error = "";
      try {
        await resolveModelCredentialsOrThrow("shared", "removed-private");
      } catch (err) {
        error = String(err);
      }
      assert.include(error, "removed-private");
      assert.equal(
        (await resolveModelCredentials("shared"))?.oauthProxy?.apiBase,
        "https://public.invalid/v1",
      );
    });

    it("refuses a stale custom row instead of inheriting the primary profile or a different OAuth route", async function () {
      for (const apiBase of [undefined, "oauth://openai-codex"]) {
        cache({ private: [{ id: "shared", apiBase }] });
        assert.isNull(await resolveModelCredentials("shared", "private"));
      }
    });

    it("accepts a normalized model name only within the same selected provider", async function () {
      cache({
        public: [{ id: "shared", apiBase: "https://public.invalid/v1" }],
        private: [
          {
            id: "Shared",
            apiBase: "https://private.invalid/v1",
            apiKey: "private-fixture",
          },
        ],
      });
      const creds = await resolveModelCredentials("SHARED", "private");
      assert.equal(creds?.modelId, "Shared");
      assert.include(creds?.oauthProxy, {
        apiBase: "https://private.invalid/v1",
        apiKey: "private-fixture",
      });
    });
  });

  describe("author disambiguation", function () {
    function author(first: string, sequence: number) {
      return createAuthor({
        name: `${first} Zhang`,
        givenName: first,
        familyName: "Zhang",
        sequence,
      });
    }

    it("does not merge adjacent Wei and Wen or mix their evidence", function () {
      const wei = author("Wei", 1),
        wen = author("Wen", 2),
        row = author("Wen", 2);
      row.affiliations = ["Research Institute B"];
      const result = mergeAuthors({ creators: [wei, wen] }, [row]);
      assert.lengthOf(result, 2);
      assert.deepEqual(wei.affiliations, []);
      assert.deepEqual(wen.affiliations, row.affiliations);
    });

    it("merges a genuine unambiguous abbreviation but never assigns ambiguous initials to the first author", function () {
      const abbrev = author("W.", 1);
      abbrev.emails = ["author@example.invalid"];
      assert.lengthOf(
        mergeAuthors({ creators: [author("Wei", 1)] }, [abbrev]),
        1,
      );
      for (const creators of [
        [author("Wen", 1), author("Wei", 2)],
        [author("Wei", 1), author("Wen", 2)],
      ]) {
        const rows = mergeAuthors({ creators: [abbrev, ...creators] }, []);
        assert.lengthOf(rows, 3);
        assert.isTrue(creators.every((a) => a.emails.length === 0));
      }
    });
  });
});
