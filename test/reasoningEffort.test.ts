import { assert } from "chai";
import {
  chatWithProviderOAuth,
  dedupeModels,
  parseCodexModelsResponse,
} from "../src/utils/oauthCli";
import {
  formatReasoningEffort,
  getChatReasoningEffort,
  initializeReasoningEffort,
  getCachedModelReasoningSupport,
  getModelReasoningSupport,
  parseCatalogReasoningLevels,
  resolveReasoningEffort,
  resolveRequestReasoningEffort,
  setChatReasoningEffort,
} from "../src/utils/reasoningEffort";

const PREF_PREFIX = "extensions.zotero.aidea.";

function buildCodexSseResponse(text: string): Response {
  const body =
    `data: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}\n\n` +
    "data: [DONE]\n\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("reasoning effort selection", function () {
  const globals = globalThis as any;
  let prefs: Map<string, unknown>;
  let originals: Record<string, unknown>;

  beforeEach(function () {
    originals = {
      Zotero: globals.Zotero,
      ztoolkit: globals.ztoolkit,
      Cc: globals.Cc,
      Ci: globals.Ci,
      fetch: globals.fetch,
    };
    prefs = new Map();
    globals.Zotero = {
      Prefs: {
        get: (key: string) => prefs.get(key),
        set: (key: string, value: unknown) => prefs.set(key, value),
      },
      File: {
        getContentsAsync: async () =>
          JSON.stringify({ tokens: { access_token: "codex-token" } }),
      },
    };
    globals.ztoolkit = { getGlobal: () => undefined, log: () => undefined };
    globals.Cc = {
      "@mozilla.org/process/environment;1": {
        getService: () => ({
          get: (name: string) => (name === "HOME" ? "/home/test" : ""),
        }),
      },
    };
    globals.Ci = { nsIEnvironment: {} };
  });

  afterEach(function () {
    for (const [key, value] of Object.entries(originals)) globals[key] = value;
  });

  it("parses catalog levels from strings and effort rows in ladder order", function () {
    assert.deepEqual(
      parseCatalogReasoningLevels([
        { effort: "High", description: "Deep" },
        "low",
        { effort: "xhigh" },
        "low",
        { effort: "" },
        "medium",
        "ultra",
      ]),
      ["low", "medium", "high", "xhigh", "ultra"],
    );
    assert.isUndefined(parseCatalogReasoningLevels([]));
    assert.isUndefined(parseCatalogReasoningLevels(null));
  });

  it("keeps Codex catalog levels and the default on model rows", function () {
    const rows = parseCodexModelsResponse({
      models: [
        {
          slug: "gpt-6-luna",
          supported_reasoning_levels: [
            { effort: "low" },
            { effort: "medium" },
            { effort: "high" },
            { effort: "xhigh" },
          ],
          default_reasoning_level: "medium",
        },
        { slug: "plain-model" },
        { slug: "no-reasoning-model", supported_reasoning_levels: [] },
      ],
    });
    const persistedRows = dedupeModels(rows);
    const row = persistedRows.find((model) => model.id === "gpt-6-luna")!;
    const plain = persistedRows.find((model) => model.id === "plain-model")!;
    const noReasoning = persistedRows.find(
      (model) => model.id === "no-reasoning-model",
    )!;
    assert.deepEqual(row.reasoningLevels, ["low", "medium", "high", "xhigh"]);
    assert.equal(row.defaultReasoningLevel, "medium");
    assert.notProperty(plain, "reasoningLevels");
    assert.notProperty(plain, "defaultReasoningLevel");
    assert.deepEqual(noReasoning.reasoningLevels, []);
  });

  it("offers efforts only for Codex, preferring catalog levels", function () {
    assert.deepEqual(
      getModelReasoningSupport("github-copilot", "gpt-5.4").efforts,
      [],
    );
    assert.deepEqual(
      getModelReasoningSupport("openai-codex", "gpt-6-luna", {
        reasoningLevels: ["low", "max"],
        defaultReasoningLevel: "low",
      }),
      { efforts: ["low", "max"], defaultEffort: "low" },
    );
    // Missing metadata must not invent three levels for an unknown model.
    assert.deepEqual(getModelReasoningSupport("openai-codex", "gpt-5.2"), {
      efforts: [],
      catalogMissing: true,
    });
    assert.deepEqual(
      getModelReasoningSupport("openai-codex", "gpt-5.2", {
        reasoningLevels: [],
      }).efforts,
      [],
    );
  });

  it("uses explicit levels and clamps unsupported picks to a weaker effort", function () {
    const efforts = ["low", "medium", "high"];
    assert.equal(resolveReasoningEffort("", efforts), "low");
    assert.equal(resolveReasoningEffort("", efforts, "medium"), "medium");
    assert.equal(resolveReasoningEffort("HIGH", efforts), "high");
    assert.equal(resolveReasoningEffort("xhigh", efforts), "high");
    assert.equal(resolveReasoningEffort("max", ["low", "xhigh"]), "xhigh");
    assert.equal(
      resolveReasoningEffort("ultra", ["low", "high", "max"]),
      "max",
    );
    // Nothing weaker: choose an explicit supported fallback.
    assert.equal(resolveReasoningEffort("minimal", efforts), "low");
    assert.isUndefined(resolveReasoningEffort("high", []));
    assert.equal(formatReasoningEffort("xhigh"), "XHigh");
  });

  it("initializes a legacy default once and preserves it across capability changes", function () {
    const support = {
      efforts: ["low", "medium", "high"],
      defaultEffort: "medium",
    };
    const selected = initializeReasoningEffort(
      "",
      support,
      setChatReasoningEffort,
    );
    assert.equal(selected, "medium");
    assert.equal(getChatReasoningEffort(), "medium");
    assert.equal(
      initializeReasoningEffort(
        selected,
        { ...support, defaultEffort: "low" },
        setChatReasoningEffort,
      ),
      "medium",
    );
    let calls = 0;
    assert.equal(
      initializeReasoningEffort("", { efforts: [] }, () => calls++),
      "",
    );
    assert.equal(calls, 0);
  });

  it("keeps one chat effort across model switches", function () {
    setChatReasoningEffort("high");
    assert.equal(getChatReasoningEffort(), "high");
    assert.equal(prefs.get(`${PREF_PREFIX}chatReasoningEffort`), "high");
    prefs.set(`${PREF_PREFIX}lastUsedModelName`, "gpt-6-sol");
    assert.equal(getChatReasoningEffort(), "high");
    setChatReasoningEffort("");
    assert.equal(getChatReasoningEffort(), "");
  });

  it("migrates the currently selected model's legacy effort once", function () {
    prefs.set(`${PREF_PREFIX}lastUsedModelProvider`, "openai-codex");
    prefs.set(`${PREF_PREFIX}lastUsedModelName`, "gpt-6-sol");
    prefs.set(
      `${PREF_PREFIX}chatReasoningEffortByModel`,
      JSON.stringify({
        "openai-codex:gpt-6-luna": "high",
        "openai-codex:gpt-6-sol": "low",
      }),
    );
    assert.equal(getChatReasoningEffort(), "low");
    assert.equal(prefs.get(`${PREF_PREFIX}chatReasoningEffortByModel`), "{}");
    setChatReasoningEffort("");
    assert.equal(getChatReasoningEffort(), "");
  });

  it("resolves request efforts from the cached Codex catalog", function () {
    prefs.set(
      `${PREF_PREFIX}oauthModelListCache`,
      JSON.stringify({
        "openai-codex": [
          { id: "gpt-6-luna", reasoningLevels: ["low", "high"] },
          { id: "gpt-5.2", reasoningLevels: [] },
        ],
      }),
    );
    assert.equal(
      resolveRequestReasoningEffort(
        "oauth://openai-codex",
        "gpt-6-luna",
        "xhigh",
      ),
      "high",
    );
    assert.isUndefined(
      resolveRequestReasoningEffort(
        "https://api.example.test/v1",
        "gpt-6-luna",
        "high",
      ),
    );
    assert.isUndefined(
      resolveRequestReasoningEffort("oauth://openai-codex", "gpt-5.2", "high"),
    );
  });

  it("sends the effort to Codex and omits it for the default", async function () {
    const payloads: Array<Record<string, unknown>> = [];
    globals.fetch = async (_url: unknown, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body || "{}")));
      return buildCodexSseResponse("ok");
    };

    await chatWithProviderOAuth({
      provider: "openai-codex",
      model: "gpt-6-luna",
      prompt: "Hello",
      reasoningEffort: "high",
    });
    await chatWithProviderOAuth({
      provider: "openai-codex",
      model: "gpt-6-luna",
      prompt: "Hello",
    });

    assert.deepEqual(payloads[0].reasoning, { effort: "high" });
    assert.notProperty(payloads[1], "reasoning");
  });

  it("uses each model's catalog range and keeps chat working without effort support", async function () {
    prefs.set(
      `${PREF_PREFIX}oauthModelListCache`,
      JSON.stringify({
        "openai-codex": [
          {
            id: "six-level",
            reasoningLevels: ["low", "medium", "high", "xhigh", "max", "ultra"],
          },
          {
            id: "five-level",
            reasoningLevels: ["low", "medium", "high", "xhigh", "max"],
          },
          { id: "no-effort", reasoningLevels: [] },
          { id: "unknown" },
        ],
      }),
    );
    const payloads: Array<Record<string, any>> = [];
    globals.fetch = async (_url: unknown, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body || "{}")));
      return buildCodexSseResponse("ok");
    };
    setChatReasoningEffort("ultra");
    for (const [model, count, expected] of [
      ["six-level", 6, "ultra"],
      ["five-level", 5, "max"],
      ["no-effort", 0, undefined],
      ["unknown", 0, undefined],
      ["six-level", 6, "ultra"],
    ] as const) {
      assert.lengthOf(
        getCachedModelReasoningSupport("openai-codex", model).efforts,
        count,
      );
      const response = await chatWithProviderOAuth({
        provider: "openai-codex",
        model,
        prompt: "Reply ok",
        reasoningEffort: resolveRequestReasoningEffort(
          "oauth://openai-codex",
          model,
          getChatReasoningEffort(),
        ),
      });
      assert.equal(response, "ok");
      assert.equal(payloads.at(-1)?.reasoning?.effort, expected);
      if (!expected) assert.notProperty(payloads.at(-1), "reasoning");
      assert.equal(getChatReasoningEffort(), "ultra");
    }
  });

  it("retries on the model default when Codex rejects the effort", async function () {
    const payloads: Array<Record<string, unknown>> = [];
    globals.fetch = async (_url: unknown, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body || "{}"));
      payloads.push(payload);
      if (payload.reasoning) {
        return new Response(
          JSON.stringify({ detail: "Unsupported reasoning effort: max" }),
          { status: 400 },
        );
      }
      return buildCodexSseResponse("fallback");
    };

    const text = await chatWithProviderOAuth({
      provider: "openai-codex",
      model: "gpt-6-luna",
      prompt: "Hello",
      reasoningEffort: "max",
    });

    assert.equal(text, "fallback");
    assert.lengthOf(payloads, 2);
    assert.notProperty(payloads[1], "reasoning");
  });

  it("does not retry unrelated Codex errors", async function () {
    let calls = 0;
    globals.fetch = async () => {
      calls += 1;
      return new Response("bad input", { status: 400 });
    };

    let error: unknown;
    try {
      await chatWithProviderOAuth({
        provider: "openai-codex",
        model: "gpt-6-luna",
        prompt: "Hello",
        reasoningEffort: "high",
      });
    } catch (err) {
      error = err;
    }
    assert.match(String(error), /Codex OAuth HTTP 400: bad input/);
    assert.equal(calls, 1);
  });
});
