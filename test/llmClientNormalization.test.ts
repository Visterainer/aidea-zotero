import { assert } from "chai";

import { resetProviderCapabilityCacheForTests } from "../src/utils/modelProviderCapabilities";

type LlmClientModule = typeof import("../src/utils/llmClient");

let llmClient: LlmClientModule;
let originalFetch: typeof globalThis.fetch | undefined;
let originalXhr: typeof XMLHttpRequest | undefined;

function sseResponse(events: unknown[]): Response {
  const body =
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("llmClient unified model output boundary", function () {
  before(async function () {
    originalFetch = globalThis.fetch;
    originalXhr = (globalThis as any).XMLHttpRequest;
    (globalThis as any).Zotero = {
      Prefs: {
        get() {
          return "";
        },
        set() {
          return undefined;
        },
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

  beforeEach(function () {
    resetProviderCapabilityCacheForTests();
  });

  afterEach(function () {
    globalThis.fetch = originalFetch as typeof globalThis.fetch;
    (globalThis as any).XMLHttpRequest = originalXhr;
  });

  it("filters tagged and structured reasoning before streaming callbacks", async function () {
    globalThis.fetch = (async () =>
      sseResponse([
        {
          choices: [
            {
              delta: {
                reasoning_details: "structured private",
                content: "<thi",
              },
            },
          ],
        },
        { choices: [{ delta: { content: "nk>tag private</think>Visible" } }] },
      ])) as typeof globalThis.fetch;
    const deltas: string[] = [];
    const reasoning: string[] = [];
    const result = await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "custom-reasoner",
        apiBase: "https://proxy.example.test/v1",
        apiKey: "test-key",
      },
      (delta) => deltas.push(delta),
      (event) => reasoning.push(event.details || event.summary || ""),
    );
    assert.equal(result, "Visible");
    assert.equal(deltas.join(""), "Visible");
    assert.include(reasoning.join(""), "structured private");
    assert.include(reasoning.join(""), "tag private");
  });

  it("does not reinterpret literal tags after normal content starts", async function () {
    globalThis.fetch = (async () =>
      sseResponse([
        { choices: [{ delta: { content: "Document " } }] },
        { choices: [{ delta: { content: "uses <think> literally." } }] },
      ])) as typeof globalThis.fetch;
    const result = await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "custom-model",
        apiBase: "https://proxy.example.test/v1",
        apiKey: "test-key",
      },
      () => undefined,
    );
    assert.equal(result, "Document uses <think> literally.");
  });

  it("normalizes XHR streaming across transport and tag chunk boundaries", async function () {
    const raw =
      `data: ${JSON.stringify({ choices: [{ delta: { content: "<thi" } }] })}\n\n` +
      `data: ${JSON.stringify({ choices: [{ delta: { content: "nk>private</think>Visible" } }] })}\n\n` +
      "data: [DONE]\n\n";
    class FakeXhr {
      responseText = "";
      responseType = "";
      status = 200;
      statusText = "OK";
      onprogress: (() => void) | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onabort: (() => void) | null = null;
      open() {}
      setRequestHeader() {}
      abort() {
        this.onabort?.();
      }
      send() {
        for (const end of [7, 23, 51, raw.length]) {
          this.responseText = raw.slice(0, end);
          this.onprogress?.();
        }
        this.onload?.();
      }
    }
    (globalThis as any).XMLHttpRequest = FakeXhr;
    const deltas: string[] = [];
    const result = await llmClient.callLLMStream(
      {
        prompt: "Hello",
        model: "custom-model",
        apiBase: "https://proxy.example.test/v1",
        apiKey: "test-key",
      },
      (delta) => deltas.push(delta),
    );
    assert.equal(result, "Visible");
    assert.equal(deltas.join(""), "Visible");
  });

  it("injects MiniMax reasoning_split and retries once when rejected", async function () {
    const payloads: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      payloads.push(JSON.parse(String(init?.body || "{}")));
      if (payloads.length === 1) {
        return new Response(
          JSON.stringify({
            error: { message: "unknown parameter reasoning_split" },
          }),
          { status: 422, statusText: "Unprocessable Entity" },
        );
      }
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                reasoning_content: "private",
                content: "<think>fallback private</think>Visible",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    const result = await llmClient.callLLM({
      prompt: "Hello",
      model: "MiniMax-M2.1",
      apiBase: "https://api.minimax.io/v1",
      apiKey: "test-key",
    });
    assert.equal(payloads[0].reasoning_split, true);
    assert.notProperty(payloads[1], "reasoning_split");
    assert.equal(result, "Visible");
    await llmClient.callLLM({
      prompt: "Hello again",
      model: "MiniMax-M3",
      apiBase: "https://api.minimax.io/v1",
      apiKey: "test-key",
    });
    assert.notProperty(
      payloads[2],
      "reasoning_split",
      "the endpoint-level capability cache applies across MiniMax models",
    );
  });

  it("does not send MiniMax-specific parameters to unknown proxies", async function () {
    let payload: Record<string, unknown> = {};
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      payload = JSON.parse(String(init?.body || "{}"));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Visible" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof globalThis.fetch;
    await llmClient.callLLM({
      prompt: "Hello",
      model: "MiniMax-M2.1",
      apiBase: "https://proxy.example.test/v1",
      apiKey: "test-key",
    });
    assert.notProperty(payload, "reasoning_split");
  });

  it("returns empty text instead of exposing an unrecognized raw response", async function () {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ request_id: "private-raw-response" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof globalThis.fetch;
    const result = await llmClient.callLLM({
      prompt: "Hello",
      model: "custom-model",
      apiBase: "https://proxy.example.test/v1",
      apiKey: "test-key",
    });
    assert.equal(result, "");
  });
});
