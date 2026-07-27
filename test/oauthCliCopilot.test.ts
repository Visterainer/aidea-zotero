import { assert } from "chai";
import {
  buildCodexOAuthHeaders,
  chatWithProviderOAuth,
  parseCopilotModelsResponse,
} from "../src/utils/oauthCli";

const OAUTH_PREF_PREFIX = "extensions.zotero.aidea.";

function buildCopilotSseResponse(text: string): Response {
  const body =
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\n` +
    `data: ${JSON.stringify({ type: "response.completed", response: { output_text: text } })}\n\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

function buildCopilotImageSseResponse(): Response {
  const body =
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "Done" })}\n\n` +
    `data: ${JSON.stringify({
      type: "response.output_item.done",
      item: {
        type: "image_generation_call",
        result: "abc123",
        output_format: "png",
      },
    })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

function buildOpenAICompatSseResponse(text: string): Response {
  const body =
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

function buildAnthropicSseResponse(text: string): Response {
  const body =
    `data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

describe("oauthCli Copilot model parsing", function () {
  it("uses the first-party Codex client identity", function () {
    const headers = buildCodexOAuthHeaders({
      accessToken: "test-token",
      accountId: "account-1",
    });

    assert.equal(headers.originator, "codex_cli_rs");
    assert.match(headers["User-Agent"], /^codex_cli_rs\//);
    assert.equal(headers["ChatGPT-Account-ID"], "account-1");
    assert.notProperty(headers, "ChatGPT-Account-Id");
  });

  it("reads the account id from the OAuth JWT when auth.json omits it", function () {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString("base64url");
    const accessToken = `${encode({ alg: "none" })}.${encode({
      "https://api.openai.com/auth": {
        chatgpt_account_id: "account-from-jwt",
      },
    })}.signature`;

    const headers = buildCodexOAuthHeaders({ accessToken });

    assert.equal(headers["ChatGPT-Account-ID"], "account-from-jwt");
  });

  it("keeps the base Codex client headers for a malformed token", function () {
    const headers = buildCodexOAuthHeaders({ accessToken: "not-a-jwt" });

    assert.equal(headers.originator, "codex_cli_rs");
    assert.match(headers["User-Agent"], /^codex_cli_rs\//);
    assert.notProperty(headers, "ChatGPT-Account-ID");
  });

  it("should parse the OpenAI-style data array returned by Copilot", function () {
    const models = parseCopilotModelsResponse({
      data: [
        {
          id: "gpt-5.4",
          name: "GPT-5.4",
          object: "model",
          supported_endpoints: ["/responses", "/chat/completions"],
          capabilities: { family: "gpt-5.4" },
        },
        {
          id: "claude-sonnet-4.6",
          name: "Claude Sonnet 4.6",
          object: "model",
          supported_endpoints: ["/v1/messages"],
          capabilities: { family: "claude-sonnet-4.6" },
        },
      ],
    });

    assert.deepEqual(
      models.map((model) => ({
        id: model.id,
        label: model.label,
        supportedEndpoints: model.supportedEndpoints,
      })),
      [
        {
          id: "claude-sonnet-4.6",
          label: "Claude Sonnet 4.6",
          supportedEndpoints: ["/v1/messages"],
        },
        {
          id: "gpt-5.4",
          label: "GPT-5.4",
          supportedEndpoints: ["/responses", "/chat/completions"],
        },
      ],
    );
  });

  it("should accept fallback models arrays and de-duplicate by id", function () {
    const models = parseCopilotModelsResponse({
      models: [
        { id: "gpt-4o", label: "GPT-4o" },
        { model: "gpt-4o", name: "GPT-4o Duplicate" },
        { model: "o3-mini", name: "o3 Mini" },
      ],
    });

    assert.deepEqual(
      models.map((model) => ({ id: model.id, label: model.label })),
      [
        { id: "gpt-4o", label: "GPT-4o" },
        { id: "o3-mini", label: "o3 Mini" },
      ],
    );
  });

  it("should return an empty list for unexpected payloads", function () {
    assert.deepEqual(parseCopilotModelsResponse({ ok: true }), []);
    assert.deepEqual(parseCopilotModelsResponse(null), []);
  });

  it("should exclude models that Copilot marks disabled", function () {
    const models = parseCopilotModelsResponse({
      data: [
        {
          id: "gpt-5.4",
          name: "GPT-5.4",
          policy: { state: "disabled" },
          supported_endpoints: ["/responses", "/chat/completions"],
        },
        {
          id: "gpt-5.3-codex",
          name: "GPT-5.3-Codex",
          policy: { state: "enabled" },
          supported_endpoints: ["/responses"],
        },
      ],
    });

    assert.deepEqual(
      models.map((model) => ({
        id: model.id,
        label: model.label,
        supportedEndpoints: model.supportedEndpoints,
        policyState: model.policyState,
      })),
      [
        {
          id: "gpt-5.3-codex",
          label: "GPT-5.3-Codex",
          supportedEndpoints: ["/responses"],
          policyState: "enabled",
        },
      ],
    );
  });

  it("should exclude alias-only Copilot models that have no supported endpoints", function () {
    const models = parseCopilotModelsResponse({
      data: [
        {
          id: "gpt-41-copilot",
          name: "GPT-4.1 Copilot",
        },
        {
          id: "gpt-4.1",
          name: "GPT-4.1",
          supported_endpoints: ["/chat/completions"],
        },
      ],
    });

    assert.deepEqual(
      models.map((model) => model.id),
      ["gpt-4.1"],
    );
  });

  it("should exclude known Copilot models that advertise support but fail live", function () {
    const models = parseCopilotModelsResponse({
      data: [
        {
          id: "claude-sonnet-4",
          name: "Claude Sonnet 4",
          supported_endpoints: ["/chat/completions", "/v1/messages"],
          policy: { state: "enabled" },
        },
        {
          id: "claude-opus-4.6",
          name: "Claude Opus 4.6",
          supported_endpoints: ["/v1/messages"],
          policy: { state: "enabled" },
        },
      ],
    });

    assert.deepEqual(
      models.map((model) => model.id),
      ["claude-opus-4.6"],
    );
  });
});

// Keep transport hooks isolated from the pure model/header parsing tests.
describe("oauthCli Copilot temperature handling", function () {
  let prefStore: Map<string, unknown>;
  let originalFetch: typeof globalThis.fetch | undefined;

  function setOAuthPref(key: string, value: string): void {
    prefStore.set(`${OAUTH_PREF_PREFIX}${key}`, value);
  }

  before(function () {
    originalFetch = globalThis.fetch;
    (globalThis as any).Zotero = {
      Prefs: {
        get(key: string) {
          return prefStore.get(key);
        },
        set(key: string, value: unknown) {
          prefStore.set(key, value);
        },
      },
    };
    (globalThis as any).ztoolkit = {
      getGlobal: () => undefined,
      log: () => undefined,
    };
  });

  beforeEach(function () {
    prefStore = new Map<string, unknown>();
    globalThis.fetch = originalFetch as typeof globalThis.fetch;
  });

  afterEach(function () {
    globalThis.fetch = originalFetch as typeof globalThis.fetch;
  });

  it("does not send temperature for Copilot Responses models even when configured", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.no-temp.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );

    const seenPayloads: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      seenPayloads.push(payload);
      assert.notProperty(payload, "temperature");
      return buildCopilotSseResponse("Recovered");
    }) as typeof globalThis.fetch;

    const deltas: string[] = [];
    const result = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-5.3-codex",
      prompt: "Hello",
      temperature: 0.7,
      onDelta: (delta) => deltas.push(delta),
    });

    assert.equal(result, "Recovered");
    assert.deepEqual(deltas, ["Recovered"]);
    assert.lengthOf(seenPayloads, 1);
  });

  it("keeps temperature omitted across multiple Copilot Responses calls", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.still-no-temp.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );

    const seenPayloads: Array<Record<string, unknown>> = [];
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      seenPayloads.push(payload);
      assert.notProperty(payload, "temperature");
      return buildCopilotSseResponse(
        seenPayloads.length === 1 ? "First pass" : "Second pass",
      );
    }) as typeof globalThis.fetch;

    const first = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-5.3-codex",
      prompt: "First",
      temperature: 0.4,
    });
    const second = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-5.3-codex",
      prompt: "Second",
      temperature: 1.2,
    });

    assert.equal(first, "First pass");
    assert.equal(second, "Second pass");
    assert.lengthOf(seenPayloads, 2);
  });

  it("routes Copilot chat-completions models away from /responses", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.chat-route.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );
    setOAuthPref(
      "oauthModelListCache",
      JSON.stringify({
        "github-copilot": [
          {
            id: "gpt-4.1",
            label: "GPT-4.1",
            supportedEndpoints: ["/chat/completions"],
            policyState: "enabled",
          },
        ],
      }),
    );

    const seenUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      seenUrls.push(String(url));
      return buildOpenAICompatSseResponse("Chat path");
    }) as typeof globalThis.fetch;

    const result = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-4.1",
      prompt: "Hello",
      temperature: 0.5,
    });

    assert.equal(result, "Chat path");
    assert.deepEqual(seenUrls, [
      "https://api.chat-route.test/chat/completions",
    ]);
  });

  it("omits max_tokens for Copilot chat-completions calls without explicit budgets", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.chat-no-limit.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );
    setOAuthPref(
      "oauthModelListCache",
      JSON.stringify({
        "github-copilot": [
          {
            id: "gpt-4.1",
            label: "GPT-4.1",
            supportedEndpoints: ["/chat/completions"],
            policyState: "enabled",
          },
        ],
      }),
    );

    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      return buildOpenAICompatSseResponse("Chat path");
    }) as typeof globalThis.fetch;

    await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-4.1",
      prompt: "Hello",
    });

    assert.notProperty(seenPayload, "max_tokens");
    assert.notProperty(seenPayload, "temperature");
  });

  it("routes Copilot responses-only models to /responses", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.responses-route.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );
    setOAuthPref(
      "oauthModelListCache",
      JSON.stringify({
        "github-copilot": [
          {
            id: "gpt-5.3-codex",
            label: "GPT-5.3-Codex",
            supportedEndpoints: ["/responses"],
            policyState: "enabled",
          },
        ],
      }),
    );

    const seenUrls: string[] = [];
    globalThis.fetch = (async (url: string | URL | Request) => {
      seenUrls.push(String(url));
      return buildCopilotSseResponse("Responses path");
    }) as typeof globalThis.fetch;

    const result = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-5.3-codex",
      prompt: "Hello",
      temperature: 0.5,
    });

    assert.equal(result, "Responses path");
    assert.deepEqual(seenUrls, ["https://api.responses-route.test/responses"]);
  });

  it("omits max_output_tokens for Copilot Responses calls without explicit budgets", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.responses-no-limit.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );

    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      return buildCopilotSseResponse("Responses path");
    }) as typeof globalThis.fetch;

    await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-5.3-codex",
      prompt: "Hello",
    });

    assert.notProperty(seenPayload, "max_output_tokens");
    assert.notProperty(seenPayload, "temperature");
  });

  it("keeps the required 8192 max_tokens fallback for Copilot Claude calls", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.claude-fallback.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );

    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      return buildAnthropicSseResponse("Claude path");
    }) as typeof globalThis.fetch;

    const result = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "claude-sonnet-4.6",
      prompt: "Hello",
    });

    assert.equal(result, "Claude path");
    assert.equal(seenPayload?.max_tokens, 8192);
    assert.notProperty(seenPayload, "temperature");
  });

  it("converts Copilot Responses image outputs into markdown images", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.image-output.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );

    globalThis.fetch = (async () =>
      buildCopilotImageSseResponse()) as typeof globalThis.fetch;

    const deltas: string[] = [];
    const result = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-5.3-codex",
      prompt: "Generate an image",
      onDelta: (delta) => deltas.push(delta),
    });

    assert.equal(
      result,
      "Done\n\n![Generated image 1](data:image/png;base64,abc123)",
    );
    assert.deepEqual(deltas, [
      "Done",
      "\n\n![Generated image 1](data:image/png;base64,abc123)",
    ]);
  });

  it("adds the Responses image_generation tool for Copilot image requests", async function () {
    setOAuthPref("oauthCopilotGithubToken", "github-token");
    setOAuthPref(
      "oauthCopilotApiToken",
      JSON.stringify({
        token: "copilot-token;proxy-ep=proxy.image-tool.test;",
        expiresAt: Date.now() + 60 * 60 * 1000,
      }),
    );

    let seenPayload: Record<string, unknown> | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      return buildCopilotImageSseResponse();
    }) as typeof globalThis.fetch;

    const result = await chatWithProviderOAuth({
      provider: "github-copilot",
      model: "gpt-5.3-codex",
      prompt: "Generate an image",
      imageGeneration: true,
    });

    assert.include(result, "![Generated image 1]");
    assert.deepEqual(seenPayload?.tools, [{ type: "image_generation" }]);
  });

  it("offers the image_generation tool automatically for OpenAI Codex OAuth chat requests", async function () {
    (globalThis as any).Cc = {
      "@mozilla.org/process/environment;1": {
        getService: () => ({
          get: (name: string) => (name === "USERPROFILE" ? "C:\\test" : ""),
        }),
      },
    };
    (globalThis as any).Ci = { nsIEnvironment: {} };
    (globalThis as any).Zotero.File = {
      getContentsAsync: async () =>
        JSON.stringify({
          tokens: {
            access_token: "codex-token",
            account_id: "account-1",
          },
        }),
    };

    let seenPayload: Record<string, unknown> | null = null;
    let seenHeaders: Headers | null = null;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      seenPayload = JSON.parse(String(init?.body || "{}")) as Record<
        string,
        unknown
      >;
      seenHeaders = new Headers(init?.headers);
      return buildCopilotSseResponse("Normal answer");
    }) as typeof globalThis.fetch;

    const result = await chatWithProviderOAuth({
      provider: "openai-codex",
      model: "gpt-5.6-luna",
      prompt: "Hello",
    });

    assert.equal(result, "Normal answer");
    assert.equal(seenPayload?.model, "gpt-5.6-luna");
    assert.deepEqual(seenPayload?.tools, [{ type: "image_generation" }]);
    assert.equal(seenHeaders?.get("originator"), "codex_cli_rs");
    assert.match(seenHeaders?.get("User-Agent") || "", /^codex_cli_rs\//);
    assert.equal(seenHeaders?.get("ChatGPT-Account-ID"), "account-1");
    assert.notProperty(seenPayload, "temperature");
    assert.notProperty(seenPayload, "max_output_tokens");
    assert.include(
      String(seenPayload?.instructions || ""),
      "Use it only when the user clearly asks",
    );
  });
});
