import { assert } from "chai";
import { callLLM, callLLMStream } from "../src/utils/llmClient";
import { fetchCustomEndpointModels } from "../src/utils/oauthCli";
import {
  cacheApiReasoningCatalog,
  getApiReasoningSupport,
  getCachedModelReasoningSupport,
  parseApiReasoningSupport,
  resolveRequestReasoningEffort,
} from "../src/utils/reasoningEffort";
import { resetTokenPolicyCacheForTests } from "../src/utils/tokenParameterPolicy";

const base = "https://catalog.example.test/v1";
const key = "test-private-key";
const row = {
  id: "alias",
  supported_reasoning_levels: ["low", "high"],
  default_reasoning_level: "low",
};
const prefix = "extensions.zotero.aidea.";

describe("API Key reasoning capability and transport", function () {
  let originals: Record<string, unknown>;
  let prefs: Map<string, unknown>;
  let payloads: Record<string, any>[];
  let respond: (
    p: Record<string, any>,
    index: number,
  ) => { status: number; body?: unknown; disconnect?: boolean };
  const success = (p: Record<string, any>) =>
    p.stream
      ? `data: ${JSON.stringify({ choices: [{ delta: { content: "OK" } }], type: "response.output_text.delta", delta: "OK" })}\n\ndata: [DONE]\n\n`
      : JSON.stringify({
          choices: [{ message: { content: "OK" } }],
          output_text: "OK",
        });

  beforeEach(function () {
    originals = Object.fromEntries(
      ["Zotero", "ztoolkit", "fetch", "XMLHttpRequest"].map((k) => [
        k,
        (globalThis as any)[k],
      ]),
    );
    prefs = new Map();
    payloads = [];
    (globalThis as any).Zotero = {
      Prefs: {
        get: (k: string) => prefs.get(k),
        set: (k: string, v: unknown) => prefs.set(k, v),
      },
    };
    (globalThis as any).ztoolkit = {
      getGlobal: (n: string) => (n === "fetch" ? globalThis.fetch : undefined),
      log() {},
    };
    (globalThis as any).XMLHttpRequest = undefined;
    resetTokenPolicyCacheForTests();
    respond = () => ({ status: 200 });
    globalThis.fetch = (async (_url, init) => {
      const p = JSON.parse(String(init?.body));
      payloads.push(p);
      const r = respond(p, payloads.length - 1);
      return new Response(r.body ? JSON.stringify(r.body) : success(p), {
        status: r.status,
      });
    }) as typeof fetch;
  });

  afterEach(function () {
    Object.assign(globalThis, originals);
  });

  it("requires explicit levels, distinguishes unknown from unsupported, and never guesses model families", function () {
    assert.deepEqual(parseApiReasoningSupport({ id: "gpt-6.1-sol" }, base), {
      efforts: [],
      catalogMissing: true,
    });
    assert.deepEqual(
      parseApiReasoningSupport(
        { ...row, supported_parameters: ["temperature"] },
        base,
      ),
      { efforts: [] },
    );
    assert.deepEqual(
      parseApiReasoningSupport({ ...row, supports_reasoning: false }, base),
      { efforts: [] },
    );
    assert.deepEqual(
      parseApiReasoningSupport({ supported_parameters: ["reasoning"] }, base),
      { efforts: [], catalogMissing: true },
    );
    assert.deepEqual(
      parseApiReasoningSupport(
        { ...row, supported_reasoning_levels: [] },
        base,
      ),
      { efforts: [] },
    );
    assert.isTrue(
      parseApiReasoningSupport(
        { reasoning: { supported_efforts: ["low", "high"] } },
        base,
      ).catalogMissing,
    );
    assert.isTrue(
      parseApiReasoningSupport(
        { ...row, supported_reasoning_levels: [true, 123] },
        base,
      ).catalogMissing,
    );
    assert.deepEqual(parseApiReasoningSupport(row, base), {
      efforts: ["low", "high"],
      defaultEffort: "low",
      wire: "reasoning_effort",
    });
  });

  it("reads OpenRouter ladders and keeps mandatory thinking enabled", function () {
    assert.deepEqual(
      parseApiReasoningSupport(
        {
          id: "vendor/model",
          supported_parameters: ["reasoning"],
          reasoning: {
            supported_efforts: ["none", "high", "low"],
            mandatory: true,
          },
        },
        base,
      ),
      { efforts: ["low", "high"], wire: "reasoning" },
    );
    const adaptive = {
      id: "anthropic/claude-adaptive",
      supported_parameters: ["reasoning", "verbosity"],
      reasoning: { supported_efforts: ["low", "high"], mandatory: true },
    };
    assert.equal(
      parseApiReasoningSupport(adaptive, "https://openrouter.ai/api/v1").wire,
      "verbosity",
    );
    assert.isTrue(
      parseApiReasoningSupport(
        { ...adaptive, supported_parameters: ["reasoning"] },
        "https://openrouter.ai/api/v1",
      ).catalogMissing,
    );
  });

  it("isolates endpoint paths and credentials; does not store credentials", function () {
    cacheApiReasoningCatalog(base, key, [row]);
    cacheApiReasoningCatalog(base + "/other", key, [
      { ...row, supported_reasoning_levels: ["medium"] },
    ]);
    assert.deepEqual(
      getApiReasoningSupport(base + "/responses", "alias", key).efforts,
      ["low", "high"],
    );
    assert.deepEqual(
      getApiReasoningSupport(base + "/other", "alias", key).efforts,
      ["medium"],
    );
    assert.isTrue(
      getApiReasoningSupport(base, "alias", "other-key").catalogMissing,
    );
    assert.notInclude(
      String(prefs.get(prefix + "apiReasoningCapabilities")),
      key,
    );
    assert.isTrue(getApiReasoningSupport(base, "unknown", key).catalogMissing);
  });

  it("expires cached capabilities and clears stale levels on refresh", function () {
    cacheApiReasoningCatalog(base, key, [row]);
    const cache = JSON.parse(
      String(prefs.get(prefix + "apiReasoningCapabilities")),
    );
    Object.values(cache).forEach((c: any) => (c.updated -= 25 * 3600 * 1000));
    prefs.set(prefix + "apiReasoningCapabilities", JSON.stringify(cache));
    assert.isTrue(getApiReasoningSupport(base, "alias", key).catalogMissing);
    cacheApiReasoningCatalog(base, key, [{ id: "alias" }]);
    assert.isTrue(getApiReasoningSupport(base, "alias", key).catalogMissing);
  });

  it("discovers metadata from the actual models URL and invalidates on a failed refresh", async function () {
    globalThis.fetch = (async (url) => {
      assert.equal(String(url), base + "/models");
      return new Response(JSON.stringify({ data: [row] }));
    }) as typeof fetch;
    await fetchCustomEndpointModels(base + "/chat/completions", key);
    prefs.set(
      prefix + "oauthModelListCache",
      JSON.stringify({
        "custom-label": [{ id: "alias", apiBase: base, apiKey: key }],
      }),
    );
    assert.deepEqual(
      getCachedModelReasoningSupport("custom-label", "alias").efforts,
      ["low", "high"],
    );
    assert.equal(
      resolveRequestReasoningEffort(base, "alias", "ultra", key),
      "high",
    );
    globalThis.fetch = (async () =>
      new Response("Denied", { status: 401 })) as typeof fetch;
    try {
      await fetchCustomEndpointModels(base, key);
      assert.fail("expected failed refresh");
    } catch (e) {
      assert.include(String(e), "401");
    }
    assert.isTrue(getApiReasoningSupport(base, "alias", key).catalogMissing);
  });

  function enableXhr() {
    (globalThis as any).XMLHttpRequest = class {
      status = 0;
      statusText = "";
      responseText = "";
      onload?: () => void;
      onprogress?: () => void;
      onerror?: () => void;
      open() {}
      setRequestHeader() {}
      abort() {}
      send(body: string) {
        const p = JSON.parse(body);
        payloads.push(p);
        const r = respond(p, payloads.length - 1);
        this.status = r.status;
        this.responseText = r.body ? JSON.stringify(r.body) : success(p);
        this.onprogress?.();
        if (r.disconnect) this.onerror?.();
        else this.onload?.();
      }
    };
  }

  for (const mode of [
    "fetch",
    "fetch-stream",
    "xhr",
    "responses",
    "responses-stream",
  ]) {
    const isResponses = mode === "responses" || mode === "responses-stream";
    const route = base + "/route-" + mode;
    const field = isResponses ? "reasoning" : "reasoning_effort";
    const call = (extra = {}) => {
      if (mode === "xhr") enableXhr();
      const p = {
        prompt: "Hello",
        model: "alias",
        apiBase: route + (isResponses ? "/responses" : ""),
        apiKey: key,
        reasoningEffort: "ultra",
        ...extra,
      };
      return mode === "fetch" || mode === "responses"
        ? callLLM(p)
        : callLLMStream(p, () => {});
    };
    it(`${mode}: clamps to the catalog, sends the correct wire, and preserves optional budgets`, async function () {
      cacheApiReasoningCatalog(route, key, [row]);
      assert.equal(await call({ maxTokens: 321 }), "OK");
      assert.deepEqual(
        payloads[0][field],
        isResponses ? { effort: "high" } : "high",
      );
      assert.equal(
        payloads[0][isResponses ? "max_output_tokens" : "max_tokens"],
        321,
      );
      assert.notProperty(
        payloads[0],
        isResponses ? "reasoning_effort" : "reasoning",
      );
    });
    it(`${mode}: unknown/unsupported capability keeps chat working without effort`, async function () {
      assert.equal(await call(), "OK");
      assert.notProperty(payloads[0], field);
      cacheApiReasoningCatalog(route, key, [
        { ...row, supported_reasoning_levels: [] },
      ]);
      assert.equal(await call(), "OK");
      assert.notProperty(payloads[1], field);
    });
    it(`${mode}: rejected effort retries once without it and grays only this connection`, async function () {
      cacheApiReasoningCatalog(route, key, [row]);
      cacheApiReasoningCatalog(route, "other-key", [row]);
      respond = (p) =>
        p[field]
          ? {
              status: 422,
              body: {
                error: {
                  param: field,
                  message: `Unsupported parameter: ${field}`,
                },
              },
            }
          : { status: 200 };
      assert.equal(await call(), "OK");
      assert.lengthOf(payloads, 2);
      assert.notProperty(payloads[1], field);
      assert.deepEqual(getApiReasoningSupport(route, "alias", key).efforts, []);
      assert.deepEqual(
        getApiReasoningSupport(route, "alias", "other-key").efforts,
        ["low", "high"],
      );
      assert.equal(await call(), "OK");
      assert.notProperty(payloads[2], field);
      cacheApiReasoningCatalog(route, key, [row]);
      assert.deepEqual(getApiReasoningSupport(route, "alias", key).efforts, [
        "low",
        "high",
      ]);
    });
    it(`${mode}: preserves token/temperature corrections when effort is rejected last`, async function () {
      cacheApiReasoningCatalog(route, key, [row]);
      respond = (p) => {
        if (!isResponses && p.max_tokens)
          return {
            status: 400,
            body: {
              error: {
                param: "max_tokens",
                message:
                  "Unsupported parameter max_tokens, use max_completion_tokens instead",
              },
            },
          };
        if (p.temperature !== undefined)
          return {
            status: 400,
            body: {
              error: {
                param: "temperature",
                message: "temperature is not supported with reasoning",
              },
            },
          };
        if (p[field])
          return {
            status: 400,
            body: { error: { param: field, message: "Invalid value: high" } },
          };
        return { status: 200 };
      };
      assert.equal(await call({ maxTokens: 321, temperature: 0.2 }), "OK");
      assert.lengthOf(payloads, isResponses ? 3 : 4);
      const last = payloads[payloads.length - 1];
      assert.equal(
        last[isResponses ? "max_output_tokens" : "max_completion_tokens"],
        321,
      );
      assert.notProperty(last, field);
      assert.notProperty(last, "temperature");
    });
    it(`${mode}: does not mistake authentication or unrelated validation for rejected effort`, async function () {
      cacheApiReasoningCatalog(route, key, [row]);
      for (const status of [401, 400]) {
        payloads = [];
        respond = () => ({
          status,
          body: {
            error: {
              param: "messages",
              message: `Invalid reasoning request: messages missing`,
            },
          },
        });
        try {
          await call();
          assert.fail("expected rejection");
        } catch (e) {
          assert.include(String(e), String(status));
        }
        assert.lengthOf(payloads, 1);
        assert.deepEqual(getApiReasoningSupport(route, "alias", key).efforts, [
          "low",
          "high",
        ]);
      }
    });
  }

  it("uses nested reasoning for advertised gateways and verbosity for confirmed adaptive OpenRouter", async function () {
    cacheApiReasoningCatalog(base, key, [
      {
        id: "alias",
        supported_parameters: ["reasoning"],
        reasoning: { supported_efforts: ["low", "high"] },
      },
    ]);
    await callLLM({
      prompt: "Hello",
      apiBase: base,
      apiKey: key,
      model: "alias",
      reasoningEffort: "high",
    });
    assert.deepEqual(payloads[0].reasoning, { effort: "high" });
    const router = "https://openrouter.ai/api/v1";
    cacheApiReasoningCatalog(router, key, [
      {
        id: "anthropic/test",
        supported_parameters: ["reasoning", "verbosity"],
        reasoning: { mandatory: true, supported_efforts: ["low", "high"] },
      },
    ]);
    await callLLM({
      prompt: "Hello",
      apiBase: router,
      apiKey: key,
      model: "anthropic/test",
      reasoningEffort: "high",
    });
    assert.equal(payloads[1].verbosity, "high");
    assert.notProperty(payloads[1], "reasoning");
  });

  it("XHR never replays output after a partial stream", async function () {
    enableXhr();
    cacheApiReasoningCatalog(base, key, [row]);
    respond = () => ({ status: 200, disconnect: true });
    let output = "";
    try {
      await callLLMStream(
        {
          prompt: "Hello",
          apiBase: base,
          apiKey: key,
          model: "alias",
          reasoningEffort: "high",
        },
        (d) => (output += d),
      );
      assert.fail("expected disconnect");
    } catch (e) {
      assert.include(String(e).toLowerCase(), "network");
    }
    assert.equal(output, "OK");
    assert.lengthOf(payloads, 1);
  });
});
