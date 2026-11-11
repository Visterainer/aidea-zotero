import { assert } from "chai";

type LlmClientModule = typeof import("../src/utils/llmClient");

let llmClient: LlmClientModule;
let originalFetch: typeof globalThis.fetch | undefined;
const prefs = new Map<string, string>();

const sse = (body: string) =>
  new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });

const chatChunk = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`;

const CHAT_BASE = "https://api.example.test/v1/chat/completions";
const RESPONSES_BASE = "https://api.example.test/v1/responses";

function streamWith(body: string, apiBase = CHAT_BASE) {
  globalThis.fetch = (async () => sse(body)) as typeof globalThis.fetch;
  const deltas: string[] = [];
  const result = llmClient.callLLMStream(
    { prompt: "Hello", model: "test-model", apiBase, apiKey: "k" },
    (delta) => deltas.push(delta),
  );
  return { result, deltas };
}

async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected the call to reject");
}

describe("llmClient audit regressions", function () {
  describe("llmClient stream edge cases", function () {
    before(async function () {
      originalFetch = globalThis.fetch;
      (globalThis as any).Zotero = {
        Prefs: {
          get: (key: string) => prefs.get(key) ?? "",
          set: (key: string, value: string) => void prefs.set(key, value),
        },
      };
      (globalThis as any).ztoolkit = {
        getGlobal(name: string) {
          if (name === "fetch") return globalThis.fetch;
          return undefined;
        },
        log: () => undefined,
      };
      llmClient = await import("../src/utils/llmClient");
    });

    afterEach(function () {
      globalThis.fetch = originalFetch as typeof globalThis.fetch;
      prefs.clear();
    });

    it("keeps the last chat chunk when the stream has no trailing newline", async function () {
      const { result } = streamWith(
        `${chatChunk("Hel")}\n\n${chatChunk("lo")}`,
      );
      assert.equal(await result, "Hello");
    });

    it("keeps a final Responses event that has no trailing newline", async function () {
      const { result } = streamWith(
        `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Hi" })}`,
        RESPONSES_BASE,
      );
      assert.equal(await result, "Hi");
    });

    it("surfaces a provider error sent inside a 200 chat stream", async function () {
      const { result } = streamWith(
        `data: ${JSON.stringify({ error: { message: "Insufficient credits" } })}\n\n`,
      );
      assert.include((await rejection(result)).message, "Insufficient credits");
    });

    it("surfaces a Responses response.failed event", async function () {
      const { result } = streamWith(
        `data: ${JSON.stringify({
          type: "response.failed",
          response: { error: { message: "context_length_exceeded" } },
        })}\n\n`,
        RESPONSES_BASE,
      );
      assert.include(
        (await rejection(result)).message,
        "context_length_exceeded",
      );
    });

    it("keeps a partial answer when the error arrives after text", async function () {
      const { result, deltas } = streamWith(
        `${chatChunk("Partial")}\n\n` +
          `data: ${JSON.stringify({ error: { message: "upstream dropped" } })}\n\n`,
      );
      assert.equal(await result, "Partial");
      assert.deepEqual(deltas, ["Partial"]);
    });

    it("reads a plain JSON body from a server that ignores stream:true", async function () {
      const { result } = streamWith(
        JSON.stringify({ choices: [{ message: { content: "Whole answer" } }] }),
      );
      assert.equal(await result, "Whole answer");
    });

    it("does not treat a null error field as a failure", async function () {
      const { result } = streamWith(
        `data: ${JSON.stringify({
          error: null,
          choices: [{ delta: { content: "OK" } }],
        })}\n\n`,
      );
      assert.equal(await result, "OK");
    });
  });

  describe("llmClient API key resolution", function () {
    const PREFIX = "extensions.zotero.aidea";

    before(async function () {
      (globalThis as any).Zotero = {
        Prefs: {
          get: (key: string) => prefs.get(key) ?? "",
          set: (key: string, value: string) => void prefs.set(key, value),
        },
      };
      llmClient = await import("../src/utils/llmClient");
    });

    beforeEach(function () {
      prefs.clear();
      prefs.set(`${PREFIX}.apiBasePrimary`, "https://primary.example/v1");
      prefs.set(`${PREFIX}.apiKeyPrimary`, "primary-secret");
      prefs.set(`${PREFIX}.modelPrimary`, "primary-model");
    });

    after(function () {
      prefs.clear();
    });

    it("uses the primary key for the primary endpoint", function () {
      const primary = llmClient.getApiConfig();
      if (primary.apiKey !== "primary-secret") {
        // The profile pref layout differs from this test's assumption; the
        // remaining cases would be vacuous, so fail loudly instead.
        assert.fail(`primary key was not resolved (got "${primary.apiKey}")`);
      }
      assert.equal(
        llmClient.getApiConfig({ apiBase: "https://primary.example/v1/" })
          .apiKey,
        "primary-secret",
      );
    });

    it("never sends the primary key to a different keyless endpoint", function () {
      assert.equal(
        llmClient.getApiConfig({ apiBase: "http://localhost:11434/v1" }).apiKey,
        "",
      );
    });

    it("prefers an explicit key for any endpoint", function () {
      assert.equal(
        llmClient.getApiConfig({
          apiBase: "http://localhost:11434/v1",
          apiKey: "other",
        }).apiKey,
        "other",
      );
    });
  });
});
