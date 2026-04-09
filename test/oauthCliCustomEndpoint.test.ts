import { assert } from "chai";

type OAuthCliModule = typeof import("../src/utils/oauthCli");

let oauthCli: OAuthCliModule;

describe("oauthCli custom endpoint model discovery", function () {
  before(async function () {
    (globalThis as any).Zotero = {
      Prefs: {
        get() {
          return "";
        },
      },
      locale: "en-US",
    };
    (globalThis as any).ztoolkit = {
      getGlobal: () => undefined,
      log: () => undefined,
    };

    oauthCli = await import("../src/utils/oauthCli");
  });

  afterEach(function () {
    delete (globalThis as any).fetch;
  });

  it("should parse OpenAI-style data payloads", async function () {
    (globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
      assert.equal(init?.method, "GET");
      assert.deepInclude(init?.headers as Record<string, string>, {
        Accept: "application/json",
        Authorization: "Bearer test-key",
      });
      return {
        ok: true,
        async json() {
          return {
            data: [
              { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
              { id: "gpt-4.1-mini", name: "Duplicate" },
              { id: "o3-mini" },
            ],
          };
        },
      };
    };

    const models = await oauthCli.fetchCustomEndpointModels(
      "https://example.com/v1/",
      "test-key",
    );

    assert.deepEqual(models, [
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { id: "o3-mini", label: "o3-mini" },
    ]);
  });

  it("should parse Ollama-style models payloads without an API key", async function () {
    (globalThis as any).fetch = async (_url: string, init?: RequestInit) => {
      assert.equal(init?.method, "GET");
      assert.deepEqual(init?.headers, { Accept: "application/json" });
      return {
        ok: true,
        async json() {
          return {
            models: [
              { name: "llama3.1:8b" },
              { name: "qwen2.5:14b" },
            ],
          };
        },
      };
    };

    const models = await oauthCli.fetchCustomEndpointModels(
      "http://localhost:11434/v1",
    );

    assert.deepEqual(models, [
      { id: "llama3.1:8b", label: "llama3.1:8b" },
      { id: "qwen2.5:14b", label: "qwen2.5:14b" },
    ]);
  });

  it("should throw on HTTP failures so the UI can show an error state", async function () {
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 401,
      async json() {
        return {};
      },
    });

    let error: unknown = null;
    try {
      await oauthCli.fetchCustomEndpointModels(
        "https://example.com/v1",
        "bad-key",
      );
    } catch (err) {
      error = err;
    }

    assert.instanceOf(error, Error);
    assert.include((error as Error).message, "Custom endpoint models HTTP 401");
  });
});
