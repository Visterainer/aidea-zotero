import { assert } from "chai";

describe("author profile title-search matching", function () {
  let originalZotero: unknown;
  let originalFetch: unknown;
  let utils: typeof import("../src/modules/authorProfiles/utils");
  let sources: typeof import("../src/modules/authorProfiles/sources");

  const metadata = (title: string, doi = "") =>
    ({ title, doi, creators: [] }) as any;

  const stubFetch = (respond: (url: string) => unknown) => {
    (globalThis as any).fetch = async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(respond(String(url))),
    });
  };

  before(async function () {
    originalZotero = (globalThis as any).Zotero;
    originalFetch = (globalThis as any).fetch;
    (globalThis as any).Zotero = {
      locale: "en-US",
      Prefs: { get: () => undefined },
    };
    utils = await import("../src/modules/authorProfiles/utils");
    sources = await import("../src/modules/authorProfiles/sources");
  });

  after(function () {
    (globalThis as any).Zotero = originalZotero;
    (globalThis as any).fetch = originalFetch;
  });

  it("matches titles that differ only in case, punctuation or markup", function () {
    assert.isTrue(
      utils.isSameWorkTitle(
        "Deep-Learning for Protein Folding: A Survey",
        "Deep learning for <i>protein</i> folding - a survey.",
      ),
    );
  });

  it("accepts containment only for reasonably long titles", function () {
    assert.isTrue(
      utils.isSameWorkTitle(
        "Attention is all you need",
        "Attention Is All You Need: Extended Version",
      ),
    );
    assert.isFalse(utils.isSameWorkTitle("Attention", "Attention deficits"));
  });

  it("rejects unrelated and empty titles", function () {
    assert.isFalse(
      utils.isSameWorkTitle(
        "Graph neural networks for chemistry",
        "A history of medieval trade routes",
      ),
    );
    assert.isFalse(utils.isSameWorkTitle("Some title", ""));
    assert.isFalse(utils.isSameWorkTitle("", undefined));
  });

  it("drops an unrelated top hit from every title search", async function () {
    stubFetch((url) => {
      if (url.includes("crossref.org")) {
        return {
          message: {
            items: [
              { title: ["Unrelated work"], author: [{ family: "Wrong" }] },
            ],
          },
        };
      }
      if (url.includes("openalex.org")) {
        return {
          results: [
            {
              title: "Unrelated work",
              authorships: [
                { raw_author_name: "Wrong Person", is_corresponding: true },
              ],
            },
          ],
        };
      }
      return {
        data: [{ title: "Unrelated work", authors: [{ name: "Wrong" }] }],
      };
    });
    const input = metadata("Graph neural networks for chemistry");
    for (const result of [
      await sources.fetchCrossrefAuthors(input),
      await sources.fetchOpenAlexAuthors(input),
      await sources.fetchSemanticScholarAuthors(input),
    ]) {
      assert.deepEqual(result.authors, []);
      assert.isFalse(result.result.ok);
      assert.equal(result.result.detail, "No matching work");
    }
  });

  it("keeps a title-search hit for the same paper", async function () {
    stubFetch(() => ({
      message: {
        items: [
          {
            title: ["Graph Neural Networks for Chemistry"],
            author: [{ given: "Ada", family: "Right" }],
          },
        ],
      },
    }));
    const result = await sources.fetchCrossrefAuthors(
      metadata("Graph neural networks for chemistry"),
    );
    assert.isTrue(result.result.ok);
    assert.equal(result.authors[0]?.name, "Ada Right");
  });

  it("does not overwrite a personal note that mentions AIdea and the profile title", async function () {
    const { saveAuthorProfileNote } =
      await import("../src/modules/authorProfiles/cache");
    const title = "Corresponding Author Profile";
    const personalHtml = `<p>Reading notes</p><p>Compare AIdea's ${title} with the paper.</p>`;
    class Note {
      constructor(public html = "") {}
      isNote() {
        return true;
      }
      getNote() {
        return this.html;
      }
      getNoteTitle() {
        return this.html === personalHtml ? "Reading notes" : title;
      }
      setNote(html: string) {
        this.html = html;
      }
      async saveTx() {
        if (!notes.includes(this)) notes.push(this);
      }
    }
    const notes: Note[] = [new Note(personalHtml)];
    const parent = {
      id: 42,
      libraryID: 1,
      getNotes: () => notes.map((_, i) => i + 1),
    } as Zotero.Item;
    const result = {
      language: "en",
      noteTitle: title,
      markdown: "Profile v1",
      sources: [],
      model: "test",
      generatedAt: "2026-03-01T00:00:00.000Z",
    };
    const previous = (globalThis as any).Zotero;
    try {
      (globalThis as any).Zotero = {
        ...previous,
        Item: Note,
        Items: { get: (id: number) => notes[id - 1] },
      };
      assert.equal(await saveAuthorProfileNote(parent, result), "created");
      assert.equal(notes[0].html, personalHtml);
      // Zotero's editor can strip the ownership comment on a real profile.
      notes[1].html = notes[1].html.replace(/<!--.*?-->/, "");
      assert.equal(
        await saveAuthorProfileNote(parent, {
          ...result,
          markdown: "Profile v2",
        }),
        "updated",
      );
      assert.lengthOf(notes, 2);
      assert.equal(notes[0].html, personalHtml);
      assert.include(notes[1].html, "Profile v2");
    } finally {
      (globalThis as any).Zotero = previous;
    }
  });

  it("does not title-check DOI lookups", async function () {
    stubFetch((url) =>
      url.includes("filter=doi")
        ? {
            results: [
              {
                title: "Published title differs",
                authorships: [{ raw_author_name: "Ada Right" }],
              },
            ],
          }
        : { results: [] },
    );
    const result = await sources.fetchOpenAlexAuthors(
      metadata("Preprint title", "10.1000/xyz"),
    );
    assert.isTrue(result.result.ok);
    assert.equal(result.authors.length, 1);
  });
});
