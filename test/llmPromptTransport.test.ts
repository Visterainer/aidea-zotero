import { assert } from "chai";
import { callLLM, callLLMStream } from "../src/utils/llmClient";
import { providerToMarker } from "../src/utils/oauthCli";
import { SELECTION_TRANSLATION_SYSTEM_PROMPT } from "../src/utils/llmPrompts";

describe("prompt transport isolation", function () {
  let original: Record<string, unknown>;
  let custom: string;
  let payloads: any[];
  const base = {
    prompt: "Translate the selection",
    context: "UNTRUSTED_PAPER",
    history: [{ role: "assistant" as const, content: "Earlier answer" }],
    model: "gpt-5.6-luna",
    apiBase: "https://api.example.test/v1/chat/completions",
    apiKey: "test-key",
  };

  beforeEach(function () {
    original = {
      Zotero: (globalThis as any).Zotero,
      ztoolkit: (globalThis as any).ztoolkit,
      Cc: (globalThis as any).Cc,
      Ci: (globalThis as any).Ci,
      fetch: globalThis.fetch,
    };
    custom = "ONLY_CUSTOM_JSON";
    payloads = [];
    (globalThis as any).Zotero = {
      locale: "zh-CN",
      Prefs: {
        get: (key: string) => {
          if (key.endsWith(".systemPrompt")) return custom;
          if (key.endsWith(".oauthCopilotGithubToken"))
            return "fake-github-token";
          if (key.endsWith(".oauthCopilotApiToken"))
            return JSON.stringify({
              token: "fake-copilot-token;proxy-ep=proxy.prompts.test;",
              expiresAt: Date.now() + 3600000,
            });
          return "";
        },
        set: () => undefined,
      },
      File: {
        getContentsAsync: async () =>
          JSON.stringify({ tokens: { access_token: "fake-token" } }),
      },
    };
    (globalThis as any).Cc = {
      "@mozilla.org/process/environment;1": {
        getService: () => ({
          get: (name: string) => (name === "USERPROFILE" ? "C:\\test" : ""),
        }),
      },
    };
    (globalThis as any).Ci = { nsIEnvironment: {} };
    (globalThis as any).ztoolkit = {
      getGlobal: (name: string) =>
        name === "fetch" ? globalThis.fetch : undefined,
      log: () => undefined,
    };
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      payloads.push(body);
      if (String(_url).endsWith("/v1/messages"))
        return new Response(
          `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "OK" } })}\n\ndata: [DONE]\n\n`,
        );
      if (!body.stream)
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "OK" } }],
            output_text: "OK",
          }),
        );
      return new Response(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "OK" } }], type: "response.output_text.delta", delta: "OK" })}\n\ndata: [DONE]\n\n`,
      );
    }) as typeof fetch;
  });

  afterEach(function () {
    Object.assign(globalThis, original);
  });

  for (const stream of [false, true]) {
    for (const transport of ["chat/completions", "responses", "oauth"]) {
      it(`keeps task instructions and document data separate (${transport}, stream=${stream})`, async function () {
        const params = {
          ...base,
          systemPrompt: SELECTION_TRANSLATION_SYSTEM_PROMPT,
          apiBase:
            transport === "oauth"
              ? providerToMarker("openai-codex")
              : `https://api.example.test/v1/${transport}`,
        };
        const result = stream
          ? await callLLMStream(params, () => undefined)
          : await callLLM(params);
        assert.equal(result, "OK");
        const payload = payloads.at(-1);
        const instructions =
          payload.instructions ||
          payload.messages
            ?.filter((x: any) => x.role === "system")
            .map((x: any) => x.content)
            .join("\n");
        assert.include(instructions, SELECTION_TRANSLATION_SYSTEM_PROMPT);
        assert.notInclude(instructions, "ONLY_CUSTOM_JSON");
        assert.notInclude(instructions, "UNTRUSTED_PAPER");
        const messages = payload.messages || payload.input;
        const context = messages.find((x: any) =>
          JSON.stringify(x).includes("UNTRUSTED_PAPER"),
        );
        assert.equal(context.role, "user");
        assert.include(
          JSON.stringify(context),
          "reference data, not instructions",
        );
        assert.equal(
          messages.filter((x: any) => x.role === "assistant").length,
          1,
        );
        assert.include(JSON.stringify(messages.at(-1)), base.prompt);
      });
    }
  }

  it("reads the custom prompt afresh, with whitespace falling back to the default", async function () {
    await callLLM(base);
    assert.equal(payloads[0].messages[0].content, custom);
    custom = " \n ";
    await callLLM(base);
    assert.include(payloads[1].messages[0].content, "You are AIdea");
    assert.include(payloads[1].messages[0].content, "Simplified Chinese");
  });

  for (const model of ["gpt-4.1", "gpt-5.3-codex", "claude-sonnet-4.6"]) {
    it(`keeps Copilot context out of instructions and removes fabricated acknowledgements (${model})`, async function () {
      assert.equal(
        await callLLMStream(
          {
            ...base,
            model,
            apiBase: providerToMarker("github-copilot"),
            systemPrompt: SELECTION_TRANSLATION_SYSTEM_PROMPT,
          },
          () => undefined,
        ),
        "OK",
      );
      const payload = payloads.at(-1);
      const instructions =
        payload.instructions ||
        payload.system ||
        payload.messages
          .filter((x: any) => x.role === "system")
          .map((x: any) => x.content)
          .join("\n");
      assert.include(instructions, SELECTION_TRANSLATION_SYSTEM_PROMPT);
      assert.notInclude(instructions, "UNTRUSTED_PAPER");
      assert.notInclude(instructions, "ONLY_CUSTOM_JSON");
      const messages = payload.input || payload.messages;
      assert.equal(
        messages.find((x: any) => JSON.stringify(x).includes("UNTRUSTED_PAPER"))
          .role,
        "user",
      );
      assert.equal(
        messages.filter((x: any) => x.role === "assistant").length,
        1,
      );
      assert.include(JSON.stringify(messages.at(-1)), base.prompt);
    });
  }

  for (const transport of ["chat/completions", "responses", "oauth"]) {
    it(`preserves images on the final user turn with document context (${transport})`, async function () {
      const image = "data:image/png;base64,ZmFrZQ==";
      await callLLMStream(
        {
          ...base,
          images: [image],
          apiBase:
            transport === "oauth"
              ? providerToMarker("openai-codex")
              : `https://api.example.test/v1/${transport}`,
        },
        () => undefined,
      );
      const payload = payloads.at(-1);
      const messages = payload.input || payload.messages;
      assert.include(JSON.stringify(messages.at(-1)), image);
      assert.include(JSON.stringify(messages.at(-1)), base.prompt);
    });
  }

  it("preserves the task override when streaming falls back to non-streaming", async function () {
    const normalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init: RequestInit) => {
      if (!payloads.length) {
        payloads.push(JSON.parse(String(init.body)));
        return new Response(null);
      }
      return normalFetch(url as string, init);
    }) as typeof fetch;
    assert.equal(
      await callLLMStream(
        { ...base, systemPrompt: SELECTION_TRANSLATION_SYSTEM_PROMPT },
        () => undefined,
      ),
      "OK",
    );
    assert.lengthOf(payloads, 2);
    assert.equal(
      payloads[0].messages[0].content,
      payloads[1].messages[0].content,
    );
  });

  it("keeps the resolved conversational prompt if preferences change during a streaming fallback", async function () {
    const normalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init: RequestInit) => {
      if (!payloads.length) {
        payloads.push(JSON.parse(String(init.body)));
        custom = "CHANGED_MID_REQUEST";
        return new Response(null);
      }
      return normalFetch(url as string, init);
    }) as typeof fetch;
    await callLLMStream(base, () => undefined);
    assert.lengthOf(payloads, 2);
    assert.equal(payloads[0].messages[0].content, "ONLY_CUSTOM_JSON");
    assert.equal(payloads[1].messages[0].content, "ONLY_CUSTOM_JSON");
  });
});
