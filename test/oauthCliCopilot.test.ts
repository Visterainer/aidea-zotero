import { assert } from "chai";
import {
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

describe("oauthCli Copilot model parsing", function () {
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
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
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
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
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
    assert.deepEqual(seenUrls, [
      "https://api.responses-route.test/responses",
    ]);
  });
});
