import { assert } from "chai";
import {
  supportsReasoningForModel,
  getReasoningDefaultLevelForModel,
  getRuntimeReasoningOptionsForModel,
  getOpenAIReasoningProfileForModel,
  getGeminiReasoningProfileForModel,
  getAnthropicReasoningProfileForModel,
  getQwenReasoningProfileForModel,
  shouldUseDeepseekThinkingPayload,
} from "../src/utils/reasoningProfiles";

describe("reasoningProfiles", function () {
  describe("OpenAI models", function () {
    it("gpt-5 should support reasoning", function () {
      assert.isTrue(supportsReasoningForModel("openai", "gpt-5"));
    });

    it("o3-mini should support reasoning", function () {
      assert.isTrue(supportsReasoningForModel("openai", "o3-mini"));
    });

    it("gpt-5.2 profile should include xhigh level", function () {
      const options = getRuntimeReasoningOptionsForModel("openai", "gpt-5.2");
      const levels = options.map((o) => o.level);
      assert.include(levels, "xhigh");
    });

    it("gpt-5 should have default level", function () {
      const defaultLevel = getReasoningDefaultLevelForModel("openai", "gpt-5");
      assert.equal(defaultLevel, "default");
    });

    it("should produce valid effort profile for gpt-5", function () {
      const profile = getOpenAIReasoningProfileForModel("gpt-5");
      assert.equal(profile.defaultEffort, "default");
      assert.isArray(profile.supportedEfforts);
    });
  });

  describe("Gemini models", function () {
    it("gemini-2.5-pro should support reasoning with thinking_budget", function () {
      assert.isTrue(supportsReasoningForModel("gemini", "gemini-2.5-pro"));
      const profile = getGeminiReasoningProfileForModel("gemini-2.5-pro");
      assert.equal(profile.param, "thinking_budget");
    });

    it("gemini-2.5-flash-lite should support reasoning", function () {
      assert.isTrue(
        supportsReasoningForModel("gemini", "gemini-2.5-flash-lite"),
      );
      const profile = getGeminiReasoningProfileForModel(
        "gemini-2.5-flash-lite",
      );
      assert.equal(profile.param, "thinking_budget");
      // Default should be "off" (0)
      assert.equal(profile.defaultValue, 0);
    });

    it("gemini-2.5-flash should use thinking_budget", function () {
      const profile = getGeminiReasoningProfileForModel("gemini-2.5-flash");
      assert.equal(profile.param, "thinking_budget");
    });

    it("generic gemini model should use thinking_level", function () {
      const profile = getGeminiReasoningProfileForModel("gemini-1.5-pro");
      assert.equal(profile.param, "thinking_level");
    });
  });

  describe("DeepSeek models", function () {
    it("deepseek-reasoner should use thinking payload", function () {
      assert.isTrue(shouldUseDeepseekThinkingPayload("deepseek-reasoner"));
      assert.isTrue(shouldUseDeepseekThinkingPayload("deepseek-r1"));
    });

    it("deepseek-chat should not use thinking payload", function () {
      assert.isFalse(shouldUseDeepseekThinkingPayload("deepseek-chat"));
    });

    it("deepseek-chat should not support reasoning", function () {
      assert.isFalse(supportsReasoningForModel("deepseek", "deepseek-chat"));
    });
  });

  describe("Anthropic models", function () {
    it("claude should support reasoning", function () {
      assert.isTrue(
        supportsReasoningForModel("anthropic", "claude-3.5-sonnet"),
      );
    });

    it("claude reasoning profile should have budget tokens", function () {
      const profile = getAnthropicReasoningProfileForModel("claude-3.5-sonnet");
      assert.isAbove(profile.defaultBudgetTokens, 0);
      assert.isObject(profile.levelToBudgetTokens);
    });
  });

  describe("Qwen models", function () {
    it("qwen3 should default to toggle profile", function () {
      assert.isTrue(supportsReasoningForModel("qwen", "qwen3"));
      const profile = getQwenReasoningProfileForModel("qwen3");
      assert.isNull(profile.defaultEnableThinking);
    });

    it("qwen3-thinking should be thinking-only", function () {
      const profile = getQwenReasoningProfileForModel(
        "qwen3-small-thinking-2507",
      );
      assert.isTrue(profile.defaultEnableThinking);
    });

    it("qwen3-instruct-2507 should be non-thinking", function () {
      assert.isFalse(
        supportsReasoningForModel("qwen", "qwen3-small-instruct-2507"),
      );
    });
  });

  describe("Grok models", function () {
    it("grok-3-mini should support reasoning with effort levels", function () {
      const options = getRuntimeReasoningOptionsForModel("grok", "grok-3-mini");
      const levels = options.map((o) => o.level);
      assert.include(levels, "default");
      assert.include(levels, "low");
      assert.include(levels, "high");
    });

    it("generic grok should support basic reasoning", function () {
      assert.isTrue(supportsReasoningForModel("grok", "grok-beta"));
    });
  });

  describe("edge cases", function () {
    it("should handle empty model name", function () {
      // Should fall back to default profile
      assert.isTrue(supportsReasoningForModel("openai", ""));
      assert.isTrue(supportsReasoningForModel("openai", undefined));
    });

    it("should handle case insensitivity", function () {
      assert.isTrue(supportsReasoningForModel("openai", "GPT-5"));
    });
  });
});
