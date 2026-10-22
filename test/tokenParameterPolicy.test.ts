import { assert } from "chai";
import { readFileSync } from "node:fs";
import {
  TokenParameterPolicy,
  replacementTokenField,
  resetTokenPolicyCacheForTests,
} from "../src/utils/tokenParameterPolicy";
import { callLLM, callLLMStream } from "../src/utils/llmClient";
import { pingModel } from "../src/utils/oauthCli";

const fixtures = JSON.parse(
  readFileSync(
    new URL("./fixtures/tokenParameterPolicy.json", import.meta.url),
    "utf8",
  ),
);
const url = "https://token-policy.test/v1/chat/completions";
const context = { provider: "config-a", url, model: "alias" };
const rejection = (field = "max_tokens", other = "max_completion_tokens") => ({
  error: {
    param: field,
    message: `Unsupported parameter: '${field}' is not supported with this model. Use '${other}' instead.`,
  },
});

const selectionCases: Array<{ model: string; url: string; field: string }> =
  fixtures.selections;
const errorCases: Array<[number, any]> = fixtures.errors.map(
  (c: unknown, i: number) => [i, c],
);

describe("Token parameter policy", function () {
  describe("token parameter shared contract", function () {
    beforeEach(resetTokenPolicyCacheForTests);
    for (const { model, url, field } of selectionCases) {
      it(`selects ${field} for ${model} at ${url}`, function () {
        const p = new TokenParameterPolicy({ model, url, provider: "fixture" });
        assert.deepEqual(p.apply({ max_tokens: 2345 }), { [field]: 2345 });
        assert.deepEqual(p.apply({}), {});
      });
    }
    for (const [i, c] of errorCases) {
      it(`parses explicit rejection fixture ${i}`, function () {
        assert.equal(
          replacementTokenField(c.status, c.body, c.current),
          c.expected ?? undefined,
        );
      });
    }

    it("caches only success and isolates providers, paths and models", function () {
      const p = new TokenParameterPolicy(context);
      assert.isTrue(
        p.recover(new Error(`400 - ${JSON.stringify(rejection())}`), {
          max_tokens: 12,
        }),
      );
      assert.deepEqual(
        new TokenParameterPolicy(context).apply({ max_tokens: 12 }),
        { max_tokens: 12 },
      );
      p.accept();
      assert.deepEqual(
        new TokenParameterPolicy(context).apply({ max_tokens: 12 }),
        { max_completion_tokens: 12 },
      );
      for (const overrides of [
        { provider: "config-b" },
        { url: url.replace("/v1/", "/v2/") },
        { model: "alias2" },
      ]) {
        assert.deepEqual(
          new TokenParameterPolicy({ ...context, ...overrides }).apply({
            max_tokens: 12,
          }),
          { max_tokens: 12 },
        );
      }
    });

    it("evicts stale corrections and bounds the cache to 256 entries", function () {
      for (let i = 0; i < 257; i++) {
        const p = new TokenParameterPolicy({ ...context, model: `alias${i}` });
        p.recover(new Error(`400 - ${JSON.stringify(rejection())}`), {
          max_tokens: 12,
        });
        p.accept();
      }
      assert.deepEqual(
        new TokenParameterPolicy({ ...context, model: "alias0" }).apply({
          max_tokens: 12,
        }),
        { max_tokens: 12 },
      );
      const c = { ...context, model: "alias256" };
      const p = new TokenParameterPolicy(c);
      assert.isTrue(
        p.recover(
          new Error(
            `400 - ${JSON.stringify(rejection("max_completion_tokens", "max_tokens"))}`,
          ),
          { max_completion_tokens: 12 },
        ),
      );
      assert.deepEqual(p.apply({ max_tokens: 12 }), { max_tokens: 12 });
      assert.deepEqual(new TokenParameterPolicy(c).apply({ max_tokens: 12 }), {
        max_tokens: 12,
      });
      assert.isFalse(
        p.recover(new Error(`400 - ${JSON.stringify(rejection())}`), {
          max_tokens: 12,
        }),
      );
    });

    it("rejects conflicting budgets and leaves other protocols alone", function () {
      assert.throws(
        () =>
          new TokenParameterPolicy(context).apply({
            max_tokens: 1,
            max_completion_tokens: 2,
          }),
        /Conflicting/,
      );
      for (const path of ["responses", "messages"]) {
        const p = new TokenParameterPolicy({
          ...context,
          url: `https://api.openai.com/v1/${path}`,
        });
        assert.deepEqual(p.apply({ max_tokens: 12 }), { max_tokens: 12 });
        assert.isFalse(
          p.recover(new Error(`400 - ${JSON.stringify(rejection())}`), {
            max_tokens: 12,
          }),
        );
      }
    });
  });

  describe("real chat request token recovery", function () {
    let originals: Record<string, unknown>;
    let payloads: Record<string, any>[];
    let respond: (
      payload: Record<string, any>,
      index: number,
    ) => { status: number; body?: unknown; disconnect?: boolean };
    const params = {
      prompt: "Hello",
      model: "alias",
      apiBase: url,
      apiKey: "test-key",
      maxTokens: 2345,
    };
    const success = (payload: Record<string, any>) =>
      payload.stream
        ? `data: ${JSON.stringify({ choices: [{ delta: { content: "OK" } }], type: "response.output_text.delta", delta: "OK" })}\n\ndata: [DONE]\n\n`
        : JSON.stringify({ choices: [{ message: { content: "OK" } }] });

    beforeEach(function () {
      originals = Object.fromEntries(
        ["Zotero", "ztoolkit", "fetch", "XMLHttpRequest"].map((k) => [
          k,
          (globalThis as any)[k],
        ]),
      );
      resetTokenPolicyCacheForTests();
      payloads = [];
      (globalThis as any).Zotero = { Prefs: { get: () => "", set() {} } };
      (globalThis as any).ztoolkit = {
        getGlobal: (name: string) =>
          name === "fetch" ? globalThis.fetch : undefined,
        log() {},
      };
      (globalThis as any).XMLHttpRequest = undefined;
      respond = () => ({ status: 200 });
      globalThis.fetch = (async (_url, init) => {
        const payload = JSON.parse(String(init?.body));
        payloads.push(payload);
        const r = respond(payload, payloads.length - 1);
        return new Response(
          r.body ? JSON.stringify(r.body) : success(payload),
          {
            status: r.status,
          },
        );
      }) as typeof fetch;
    });

    afterEach(function () {
      Object.assign(globalThis, originals);
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
          const payload = JSON.parse(body);
          payloads.push(payload);
          const r = respond(payload, payloads.length - 1);
          this.status = r.status;
          this.responseText = r.body
            ? JSON.stringify(r.body)
            : success(payload);
          this.onprogress?.();
          if (r.disconnect) this.onerror?.();
          else this.onload?.();
        }
      };
    }

    for (const mode of ["fetch", "fetch-stream", "xhr"]) {
      const call = (extra = {}) => {
        if (mode === "xhr") enableXhr();
        return mode === "fetch"
          ? callLLM({ ...params, ...extra })
          : callLLMStream({ ...params, ...extra }, () => {});
      };
      it(`${mode}: sends the correct GPT-6.1 field on the first request`, async function () {
        assert.equal(await call({ model: "gpt-6.1-sol" }), "OK");
        assert.equal(payloads[0].max_completion_tokens, 2345);
        assert.notProperty(payloads[0], "max_tokens");
      });
      it(`${mode}: learns an alias and reuses the accepted field`, async function () {
        respond = (p) =>
          p.max_tokens ? { status: 400, body: rejection() } : { status: 200 };
        assert.equal(await call(), "OK");
        assert.equal(await call(), "OK");
        assert.deepEqual(
          payloads.map((p) => p.max_completion_tokens),
          [undefined, 2345, 2345],
        );
        assert.notProperty(payloads[1], "max_tokens");
      });
      it(`${mode}: supports an explicit reverse correction`, async function () {
        respond = (p) =>
          p.max_completion_tokens
            ? {
                status: 422,
                body: rejection("max_completion_tokens", "max_tokens"),
              }
            : { status: 200 };
        assert.equal(await call({ model: "gpt-6.1-sol" }), "OK");
        assert.equal(payloads.length, 2);
        assert.equal(payloads[1].max_tokens, 2345);
      });
      it(`${mode}: preserves corrections across temperature recovery in both orders`, async function () {
        for (const tokenFirst of [true, false]) {
          const start = payloads.length;
          respond = (p) => {
            const tokenError = { status: 400, body: rejection() };
            const tempError = {
              status: 400,
              body: { error: { message: "temperature is not supported" } },
            };
            if (tokenFirst && p.max_tokens) return tokenError;
            if (p.temperature !== undefined) return tempError;
            if (p.max_tokens) return tokenError;
            return { status: 200 };
          };
          assert.equal(
            await call({
              apiBase: url.replace(
                "token-policy",
                `temperature-${mode}-${tokenFirst}`,
              ),
              temperature: 0.5,
            }),
            "OK",
          );
          assert.equal(payloads.length - start, 3);
          assert.notProperty(payloads.at(-1), "temperature");
          assert.equal(payloads.at(-1)?.max_completion_tokens, 2345);
        }
      });
      it(`${mode}: preserves the token correction when reasoning parameters are rebuilt`, async function () {
        respond = (p) => {
          if (p.max_completion_tokens)
            return {
              status: 400,
              body: rejection("max_completion_tokens", "max_tokens"),
            };
          if (p.reasoning_effort !== undefined)
            return {
              status: 400,
              body: { error: { message: "reasoning_effort is not supported" } },
            };
          return { status: 200 };
        };
        assert.equal(
          await call({
            model: "gpt-5.1",
            reasoning: { provider: "openai", level: "high" },
          }),
          "OK",
        );
        assert.isAtMost(payloads.length, 4);
        assert.equal(payloads[0].max_completion_tokens, 2345);
        for (const body of payloads.slice(1)) {
          assert.equal(body.max_tokens, 2345);
          assert.notProperty(body, "max_completion_tokens");
        }
        assert.notProperty(payloads.at(-1), "reasoning_effort");
      });

      it(`${mode}: stops after one correction and does not cache failure`, async function () {
        respond = (p) => ({
          status: 400,
          body: p.max_tokens
            ? rejection()
            : rejection("max_completion_tokens", "max_tokens"),
        });
        try {
          await call();
          assert.fail("must reject");
        } catch (error) {
          assert.include(String(error), "400");
        }
        assert.equal(payloads.length, 2);
        respond = () => ({ status: 200 });
        await call();
        assert.equal(payloads[2].max_tokens, 2345);
      });
      it(`${mode}: does not retry generic errors or invent omitted budgets`, async function () {
        respond = () => ({
          status: 400,
          body: { error: { message: "max_tokens exceeds the allowed budget" } },
        });
        try {
          await call();
          assert.fail("must reject");
        } catch (error) {
          assert.include(String(error), "400");
        }
        assert.equal(payloads.length, 1);
        respond = () => ({ status: 200 });
        await call({ maxTokens: undefined });
        assert.notProperty(payloads[1], "max_tokens");
        assert.notProperty(payloads[1], "max_completion_tokens");
      });
      it(`${mode}: does not recover after cancellation`, async function () {
        const controller = new AbortController();
        respond = () => {
          controller.abort();
          return { status: 400, body: rejection() };
        };
        try {
          await call({ signal: controller.signal });
          assert.fail("must reject");
        } catch {
          /* expected */
        }
        assert.equal(payloads.length, 1);
      });
    }

    it("production chat isolates explicit provider configurations at the same endpoint", async function () {
      respond = (p) =>
        p.max_tokens ? { status: 400, body: rejection() } : { status: 200 };
      await callLLM({ ...params, providerConfigId: "a" });
      await callLLM({ ...params, providerConfigId: "a" });
      await callLLM({ ...params, providerConfigId: "b" });
      assert.deepEqual(
        payloads.map((p) => p.max_completion_tokens),
        [undefined, 2345, 2345, undefined, 2345],
      );
    });

    it("XHR does not replay a request after output has started", async function () {
      enableXhr();
      respond = () => ({ status: 200, disconnect: true });
      const deltas: string[] = [];
      try {
        await callLLMStream(params, (d) => deltas.push(d));
        assert.fail("must reject");
      } catch (error) {
        assert.include(String(error), "Network error");
      }
      assert.equal(payloads.length, 1);
      assert.equal(deltas.join(""), "OK");
    });

    it("model probe adapts parameters and preserves the existing existence result", async function () {
      respond = (p) =>
        p.max_tokens ? { status: 400, body: rejection() } : { status: 200 };
      assert.equal(
        await pingModel("https://probe.test/v1", "test-key", "alias"),
        "ok",
      );
      assert.equal(payloads[1].max_completion_tokens, 1);
      respond = () => ({
        status: 404,
        body: { error: { message: "model_not_found" } },
      });
      assert.equal(
        await pingModel("https://probe.test/v1", "test-key", "missing"),
        "fail",
      );
    });
  });
});
