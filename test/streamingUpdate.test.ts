import { assert } from "chai";
import {
  findAssistantBubbleByMessageId,
  findLastAssistantBubble,
  patchStreamingBubble,
  finalizeStreamingBubble,
  createQueuedStreamingPatch,
  autoScrollStreamingIfNeeded,
} from "../src/modules/contextPanel/streamingUpdate";

// ---------------------------------------------------------------------------
// Minimal DOM mock for Node.js environment (no JSDOM needed)
// ---------------------------------------------------------------------------

/**
 * Create a minimal HTMLDivElement-like object that is sufficient for the
 * streaming update functions.  This avoids requiring a full DOM library.
 */
function createMockDiv(className?: string): HTMLDivElement {
  const children: any[] = [];
  const classList = new Set(className ? className.split(" ") : []);
  const attributes = new Map<string, string>();

  const el: any = {
    tagName: "DIV",
    className: className || "",
    parentNode: null as any,
    children,
    childNodes: children,
    innerHTML: "",
    textContent: "",

    // ownerDocument
    ownerDocument: {
      createElement: (tag: string) => createMockDiv(),
    },

    // classList mock
    classList: {
      add: (cls: string) => classList.add(cls),
      remove: (cls: string) => classList.delete(cls),
      contains: (cls: string) => classList.has(cls),
      toggle: (cls: string, force?: boolean) => {
        if (force === true) classList.add(cls);
        else if (force === false) classList.delete(cls);
        else if (classList.has(cls)) classList.delete(cls);
        else classList.add(cls);
      },
    },

    // querySelector mock — searches children by class or attribute
    querySelector: (selector: string): any | null => {
      // Simple selector engine for our tests
      for (const child of children) {
        if (selectorMatches(child, selector)) return child;
        if (child.querySelector) {
          const found = child.querySelector(selector);
          if (found) return found;
        }
      }
      return null;
    },

    // querySelectorAll mock
    querySelectorAll: (selector: string): any[] => {
      const results: any[] = [];
      const walk = (node: any) => {
        if (selectorMatches(node, selector)) results.push(node);
        for (const child of node.children || []) {
          walk(child);
        }
      };
      for (const child of children) walk(child);
      return results;
    },

    setAttribute: (name: string, value: string) => {
      attributes.set(name, value);
    },

    getAttribute: (name: string) => attributes.get(name) || null,

    appendChild: (child: any) => {
      children.push(child);
      child.parentNode = el;
      return child;
    },

    remove: () => {
      if (el.parentNode) {
        const parent = el.parentNode as any;
        const idx = parent.children?.indexOf(el) ?? -1;
        if (idx >= 0) parent.children.splice(idx, 1);
        if (parent.childNodes) {
          const cIdx = parent.childNodes.indexOf(el);
          if (cIdx >= 0) parent.childNodes.splice(cIdx, 1);
        }
      }
      el.parentNode = null;
    },

    // Scroll properties for autoScrollStreamingIfNeeded
    scrollHeight: 0,
    scrollTop: 0,
    clientHeight: 0,
  };

  return el as unknown as HTMLDivElement;
}

/**
 * Simple selector matching for mocked elements.
 */
function selectorMatches(el: any, selector: string): boolean {
  if (!el) return false;

  // Handle compound selectors like ".llm-message-wrapper.assistant"
  if (
    selector.startsWith(".") &&
    !selector.includes(" ") &&
    !selector.includes("[") &&
    !selector.includes(":")
  ) {
    const classes = selector.split(".").filter(Boolean);
    const elClasses = (el.className || "").split(/\s+/);
    return classes.every((cls: string) => elClasses.includes(cls));
  }

  // Handle attribute selectors like "[data-streaming-content]"
  if (selector.startsWith("[") && selector.endsWith("]")) {
    const attrName = selector.slice(1, -1);
    if (el.getAttribute && el.getAttribute(attrName) !== null) return true;
    return false;
  }

  // Handle class selectors like ".llm-streaming-skeleton"
  if (selector.startsWith(".")) {
    const cls = selector.slice(1);
    const elClasses = (el.className || "").split(/\s+/);
    return elClasses.includes(cls);
  }

  return false;
}

/**
 * Build a chatBox with a predefined structure for testing.
 */
function buildChatBoxWithMessages(): {
  chatBox: HTMLDivElement;
  userWrapper: any;
  assistantWrapper: any;
  assistantBubble: any;
} {
  const chatBox = createMockDiv();

  // User message wrapper
  const userWrapper = createMockDiv("llm-message-wrapper user");
  const userBubble = createMockDiv("llm-bubble user");
  userBubble.textContent = "Hello";
  userWrapper.appendChild(userBubble);
  chatBox.appendChild(userWrapper);

  // Assistant message wrapper with skeleton
  const assistantWrapper = createMockDiv("llm-message-wrapper assistant");
  const assistantBubble = createMockDiv("llm-bubble assistant streaming");

  // Model name
  const modelName = createMockDiv("llm-model-name");
  modelName.textContent = "gpt-4o";
  assistantBubble.appendChild(modelName);

  // Skeleton
  const skeleton = createMockDiv("llm-streaming-skeleton");
  assistantBubble.appendChild(skeleton);

  assistantWrapper.appendChild(assistantBubble);
  chatBox.appendChild(assistantWrapper);

  return { chatBox, userWrapper, assistantWrapper, assistantBubble };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("streamingUpdate", function () {
  // -----------------------------------------------------------------------
  // findLastAssistantBubble
  // -----------------------------------------------------------------------
  describe("findLastAssistantBubble", function () {
    it("should return null for null chatBox", function () {
      assert.isNull(findLastAssistantBubble(null));
    });

    it("should return null for empty chatBox", function () {
      const chatBox = createMockDiv();
      assert.isNull(findLastAssistantBubble(chatBox));
    });

    it("should return null when only user messages exist", function () {
      const chatBox = createMockDiv();
      const userWrapper = createMockDiv("llm-message-wrapper user");
      const userBubble = createMockDiv("llm-bubble user");
      userWrapper.appendChild(userBubble);
      chatBox.appendChild(userWrapper);
      assert.isNull(findLastAssistantBubble(chatBox));
    });

    it("should return the last assistant bubble", function () {
      const { chatBox, assistantBubble } = buildChatBoxWithMessages();
      const result = findLastAssistantBubble(chatBox);
      assert.strictEqual(result, assistantBubble);
    });

    it("should return the LAST assistant bubble when multiple exist", function () {
      const chatBox = createMockDiv();

      // First assistant
      const wrapper1 = createMockDiv("llm-message-wrapper assistant");
      const bubble1 = createMockDiv("llm-bubble assistant");
      wrapper1.appendChild(bubble1);
      chatBox.appendChild(wrapper1);

      // Second assistant
      const wrapper2 = createMockDiv("llm-message-wrapper assistant");
      const bubble2 = createMockDiv("llm-bubble assistant");
      wrapper2.appendChild(bubble2);
      chatBox.appendChild(wrapper2);

      const result = findLastAssistantBubble(chatBox);
      assert.strictEqual(result, bubble2);
    });
  });

  // -----------------------------------------------------------------------
  // findAssistantBubbleByMessageId
  // -----------------------------------------------------------------------
  describe("findAssistantBubbleByMessageId", function () {
    it("should find the assistant bubble for the requested message id", function () {
      const chatBox = createMockDiv();

      const wrapper1 = createMockDiv("llm-message-wrapper assistant");
      wrapper1.setAttribute("data-message-id", "101");
      const bubble1 = createMockDiv("llm-bubble assistant");
      wrapper1.appendChild(bubble1);
      chatBox.appendChild(wrapper1);

      const wrapper2 = createMockDiv("llm-message-wrapper assistant");
      wrapper2.setAttribute("data-message-id", "202");
      const bubble2 = createMockDiv("llm-bubble assistant");
      wrapper2.appendChild(bubble2);
      chatBox.appendChild(wrapper2);

      assert.strictEqual(findAssistantBubbleByMessageId(chatBox, 101), bubble1);
      assert.strictEqual(findAssistantBubbleByMessageId(chatBox, 202), bubble2);
    });

    it("should return null when the requested message is not visible", function () {
      const { chatBox } = buildChatBoxWithMessages();
      assert.isNull(findAssistantBubbleByMessageId(chatBox, 999));
    });
  });

  // -----------------------------------------------------------------------
  // patchStreamingBubble
  // -----------------------------------------------------------------------
  describe("patchStreamingBubble", function () {
    it("should be a no-op for null bubble", function () {
      // Should not throw
      patchStreamingBubble(null, "Hello");
    });

    it("should be a no-op for detached bubble (no parentNode)", function () {
      const bubble = createMockDiv("llm-bubble assistant streaming");
      (bubble as any).parentNode = null;
      patchStreamingBubble(bubble, "Hello");
      // No content element should be created
      assert.isNull(bubble.querySelector("[data-streaming-content]"));
    });

    it("should be a no-op for empty text", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      patchStreamingBubble(assistantBubble, "");
      // Skeleton should still be there
      assert.isNotNull(
        assistantBubble.querySelector(".llm-streaming-skeleton"),
      );
    });

    it("should remove skeleton on first content patch", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      assert.isNotNull(
        assistantBubble.querySelector(".llm-streaming-skeleton"),
        "skeleton should exist before patch",
      );

      patchStreamingBubble(assistantBubble, "Hello world");

      assert.isNull(
        assistantBubble.querySelector(".llm-streaming-skeleton"),
        "skeleton should be removed after patch",
      );
    });

    it("should recover the initial skeleton when the streaming class is missing", function () {
      const chatBox = createMockDiv();
      const wrapper = createMockDiv("llm-message-wrapper assistant");
      const bubble = createMockDiv("llm-bubble assistant");
      const skeleton = createMockDiv("llm-streaming-skeleton");
      bubble.appendChild(skeleton);
      wrapper.appendChild(bubble);
      chatBox.appendChild(wrapper);

      patchStreamingBubble(bubble, "First delta");

      assert.isTrue(bubble.classList.contains("streaming"));
      assert.isNull(bubble.querySelector(".llm-streaming-skeleton"));
      assert.include(
        bubble.querySelector("[data-streaming-content]")!.innerHTML,
        "First delta",
      );
    });

    it("should create a data-streaming-content element", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      patchStreamingBubble(assistantBubble, "Hello world");

      const contentEl = assistantBubble.querySelector(
        "[data-streaming-content]",
      );
      assert.isNotNull(contentEl, "content element should be created");
    });

    it("should not patch finalized bubbles", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      finalizeStreamingBubble(assistantBubble);

      patchStreamingBubble(assistantBubble, "Late patch");

      assert.isNull(
        assistantBubble.querySelector("[data-streaming-content]"),
        "late queued patches should not recreate streamed content",
      );
    });

    it("should not duplicate or mutate streamed content after finalization", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      patchStreamingBubble(assistantBubble, "Completed answer");
      const contentEl = assistantBubble.querySelector(
        "[data-streaming-content]",
      )!;
      const completedHtml = contentEl.innerHTML;

      finalizeStreamingBubble(assistantBubble);
      patchStreamingBubble(assistantBubble, "Completed answer plus late delta");

      assert.strictEqual(
        assistantBubble.querySelector("[data-streaming-content]"),
        contentEl,
      );
      assert.equal(contentEl.innerHTML, completedHtml);
      assert.lengthOf(
        assistantBubble.querySelectorAll("[data-streaming-content]"),
        1,
      );
    });

    it("should render markdown into the content element", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      patchStreamingBubble(assistantBubble, "**Bold** text");

      const contentEl = assistantBubble.querySelector(
        "[data-streaming-content]",
      );
      assert.isNotNull(contentEl);
      // renderMarkdown should produce <strong>Bold</strong>
      assert.include(contentEl!.innerHTML, "<strong>Bold</strong>");
    });

    it("should update content on subsequent patches", function () {
      const { assistantBubble } = buildChatBoxWithMessages();

      patchStreamingBubble(assistantBubble, "First");
      const contentEl1 = assistantBubble.querySelector(
        "[data-streaming-content]",
      );
      const firstContent = contentEl1!.innerHTML;

      patchStreamingBubble(assistantBubble, "First and second");
      const contentEl2 = assistantBubble.querySelector(
        "[data-streaming-content]",
      );
      // Should be the same element reference (reused)
      assert.strictEqual(contentEl1, contentEl2);
      // Content should have changed
      assert.notEqual(contentEl2!.innerHTML, firstContent);
    });

    it("should reuse a pre-rendered streaming content element", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      const existingContent = createMockDiv();
      existingContent.setAttribute("data-streaming-content", "true");
      existingContent.innerHTML = "<p>Initial</p>";
      assistantBubble.appendChild(existingContent);

      patchStreamingBubble(assistantBubble, "Updated");

      const contentEl = assistantBubble.querySelector(
        "[data-streaming-content]",
      );
      assert.strictEqual(contentEl, existingContent);
      assert.include(contentEl!.innerHTML, "Updated");
    });
  });

  // -----------------------------------------------------------------------
  // finalizeStreamingBubble
  // -----------------------------------------------------------------------
  describe("finalizeStreamingBubble", function () {
    it("should be a no-op for null bubble", function () {
      finalizeStreamingBubble(null);
    });

    it("should remove the streaming class", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      assert.isTrue(assistantBubble.classList.contains("streaming"));

      finalizeStreamingBubble(assistantBubble);

      assert.isFalse(assistantBubble.classList.contains("streaming"));
    });

    it("should remove leftover skeleton", function () {
      const { assistantBubble } = buildChatBoxWithMessages();
      assert.isNotNull(
        assistantBubble.querySelector(".llm-streaming-skeleton"),
      );

      finalizeStreamingBubble(assistantBubble);

      assert.isNull(assistantBubble.querySelector(".llm-streaming-skeleton"));
    });
  });

  // -----------------------------------------------------------------------
  // createQueuedStreamingPatch
  // -----------------------------------------------------------------------
  describe("createQueuedStreamingPatch", function () {
    it("should call the patch function", function (done) {
      let called = false;
      const patch = createQueuedStreamingPatch(() => {
        called = true;
      }, 10);

      patch();

      // Should not be called synchronously
      assert.isFalse(called, "should not be called synchronously");

      setTimeout(() => {
        assert.isTrue(called, "should be called after interval");
        done();
      }, 50);
    });

    it("should coalesce multiple rapid calls", function (done) {
      let callCount = 0;
      const patch = createQueuedStreamingPatch(() => {
        callCount++;
      }, 10);

      // Call it many times rapidly
      patch();
      patch();
      patch();
      patch();
      patch();

      setTimeout(() => {
        // Should only have been called once
        assert.equal(callCount, 1, "should coalesce multiple calls into one");
        done();
      }, 50);
    });

    it("should allow a second call after the interval elapses", function (done) {
      let callCount = 0;
      const patch = createQueuedStreamingPatch(() => {
        callCount++;
      }, 10);

      patch();

      setTimeout(() => {
        // First call should have happened
        assert.equal(callCount, 1);
        // Trigger again
        patch();
        setTimeout(() => {
          assert.equal(callCount, 2, "should allow second call after interval");
          done();
        }, 50);
      }, 30);
    });
  });

  // -----------------------------------------------------------------------
  // autoScrollStreamingIfNeeded
  // -----------------------------------------------------------------------
  describe("autoScrollStreamingIfNeeded", function () {
    it("should be a no-op for null chatBox", function () {
      autoScrollStreamingIfNeeded(null);
    });

    it("should scroll to bottom when near bottom", function () {
      const chatBox = createMockDiv();
      (chatBox as any).scrollHeight = 1000;
      (chatBox as any).scrollTop = 900;
      (chatBox as any).clientHeight = 80;
      // distance = 1000 - 900 - 80 = 20  (< 64 threshold)

      autoScrollStreamingIfNeeded(chatBox);

      assert.equal((chatBox as any).scrollTop, 1000);
    });

    it("should NOT scroll when user has scrolled up", function () {
      const chatBox = createMockDiv();
      (chatBox as any).scrollHeight = 1000;
      (chatBox as any).scrollTop = 300;
      (chatBox as any).clientHeight = 80;
      // distance = 1000 - 300 - 80 = 620  (> 64 threshold)

      autoScrollStreamingIfNeeded(chatBox);

      assert.equal(
        (chatBox as any).scrollTop,
        300,
        "scrollTop should not change",
      );
    });

    it("should scroll with custom threshold", function () {
      const chatBox = createMockDiv();
      (chatBox as any).scrollHeight = 1000;
      (chatBox as any).scrollTop = 850;
      (chatBox as any).clientHeight = 80;
      // distance = 1000 - 850 - 80 = 70

      // With default threshold (64), would NOT scroll
      autoScrollStreamingIfNeeded(chatBox, 64);
      assert.equal((chatBox as any).scrollTop, 850);

      // With threshold 100, SHOULD scroll
      autoScrollStreamingIfNeeded(chatBox, 100);
      assert.equal((chatBox as any).scrollTop, 1000);
    });
  });
});
