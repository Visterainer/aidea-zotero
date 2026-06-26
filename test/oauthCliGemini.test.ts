import { assert } from "chai";
import {
  GEMINI_CODE_ASSIST_STREAM_URL,
  buildGeminiCodeAssistRequestPayload,
  extractGeminiResponseText,
} from "../src/utils/oauthCli";

describe("oauthCli Gemini Code Assist helpers", function () {
  it("should build a Cloud Code Assist payload instead of a Vertex request", function () {
    assert.equal(
      GEMINI_CODE_ASSIST_STREAM_URL,
      "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse",
    );

    const payload = buildGeminiCodeAssistRequestPayload({
      model: "models/gemini-2.5-flash",
      prompt: "Current question",
      projectId: "test-project",
      context: "Paper context",
      history: [{ role: "assistant", content: "Previous answer" }],
      systemPrompt: "Be precise",
      temperature: 0.2,
      maxTokens: 256,
    }) as any;

    assert.equal(payload.model, "gemini-2.5-flash");
    assert.equal(payload.project, "test-project");
    assert.match(payload.user_prompt_id, /^aidea-/);
    assert.deepEqual(payload.request.generationConfig, {
      temperature: 0.2,
      maxOutputTokens: 256,
    });
    assert.include(
      payload.request.contents[0].parts[0].text,
      "System:\nBe precise",
    );
    assert.include(
      payload.request.contents[0].parts[0].text,
      "Document Context:\nPaper context",
    );
    assert.include(
      payload.request.contents[0].parts[0].text,
      "Assistant:\nPrevious answer",
    );
    assert.include(
      payload.request.contents[0].parts[0].text,
      "User:\nCurrent question",
    );
  });

  it("should omit generationConfig when optional generation params are absent", function () {
    const payload = buildGeminiCodeAssistRequestPayload({
      model: "models/gemini-2.5-flash",
      prompt: "Current question",
      projectId: "test-project",
    }) as any;

    assert.notProperty(payload.request, "generationConfig");
  });

  it("should extract text from raw Code Assist responses", function () {
    const text = extractGeminiResponseText({
      response: {
        candidates: [
          { content: { parts: [{ text: "Hello" }, { text: "World" }] } },
        ],
      },
    });

    assert.equal(text, "Hello\nWorld");
  });

  it("should extract text from normalized Gemini candidate responses", function () {
    const text = extractGeminiResponseText({
      candidates: [
        { content: { parts: [{ text: "Normalized" }] } },
        { content: { parts: [{ text: "Response" }] } },
      ],
    });

    assert.equal(text, "Normalized\nResponse");
  });
});
