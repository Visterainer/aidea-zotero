import { assert } from "chai";
import { createSendFlowController } from "../src/modules/contextPanel/setupHandlers/controllers/sendFlowController";

describe("sendFlowController selected text conversation key", function () {
  it("reads and clears selected text contexts by conversation key", async function () {
    const item = { id: 42 } as unknown as Zotero.Item;
    const conversationKey = 2_000_000_123;
    const selectedContext = {
      text: "Quoted PDF passage",
      source: "pdf" as const,
      paperContext: undefined,
    };

    const queriedKeys: number[] = [];
    const clearedKeys: number[] = [];
    const sentPayloads: Array<{
      displayQuestion?: string;
      selectedTexts?: string[];
      selectedTextSources?: string[];
    }> = [];

    const { doSend } = createSendFlowController({
      body: { ownerDocument: null } as unknown as Element,
      inputBox: { value: "" } as HTMLTextAreaElement,
      isPanelGenerating: () => false,
      getItem: () => item,
      closeSlashMenu: () => {},
      closePaperPicker: () => {},
      getSelectedTextContextEntries: (key) => {
        queriedKeys.push(key);
        return key === conversationKey ? [selectedContext] : [];
      },
      getSelectedPaperContexts: () => [],
      getSelectedFiles: () => [],
      getSelectedImages: () => [],
      resolvePromptText: (_text, selectedText) =>
        selectedText ? "Please explain this selected text." : "",
      buildQuestionWithSelectedTextContexts: (texts, sources, promptText) => {
        assert.deepEqual(texts, [selectedContext.text]);
        assert.deepEqual(sources, [selectedContext.source]);
        return `${promptText}\n${texts.join("\n")}`;
      },
      buildModelPromptWithFileContext: (question) => question,
      isGlobalMode: () => false,
      normalizeConversationTitleSeed: (raw) => `${raw || ""}`.trim(),
      getConversationKey: () => conversationKey,
      touchGlobalConversationTitle: async () => {},
      touchPaperConversationTitle: async () => {},
      getSelectedProfile: () => ({
        key: "openai",
        model: "gpt-test",
        apiBase: "https://example.com",
        apiKey: "token",
      }),
      getCurrentModelName: () => "gpt-test",
      isScreenshotUnsupportedModel: () => false,
      getAdvancedModelParams: () => undefined,
      getActiveEditSession: () => null,
      setActiveEditSession: () => {},
      getLatestEditablePair: async () => null,
      editLatestUserMessageAndRetry: async () => "missing",
      sendQuestion: async (
        _body,
        _item,
        _question,
        _images,
        _model,
        _apiBase,
        _apiKey,
        _advanced,
        displayQuestion,
        selectedTexts,
        selectedTextSources,
      ) => {
        sentPayloads.push({
          displayQuestion,
          selectedTexts,
          selectedTextSources,
        });
      },
      clearSelectedImageState: () => {},
      clearSelectedPaperState: () => {},
      clearSelectedFileState: () => {},
      clearSelectedTextState: (key) => {
        clearedKeys.push(key);
      },
      updatePaperPreviewPreservingScroll: () => {},
      updateFilePreviewPreservingScroll: () => {},
      updateImagePreviewPreservingScroll: () => {},
      updateSelectedTextPreviewPreservingScroll: () => {},
      scheduleAttachmentGc: () => {},
      refreshGlobalHistoryHeader: () => {},
      setStatusMessage: () => {},
      editStaleStatusText: "stale",
    });

    await doSend();

    assert.deepEqual(queriedKeys, [conversationKey]);
    assert.deepEqual(clearedKeys, [conversationKey]);
    assert.lengthOf(sentPayloads, 1);
    assert.deepEqual(sentPayloads[0]?.selectedTexts, [selectedContext.text]);
    assert.deepEqual(sentPayloads[0]?.selectedTextSources, [
      selectedContext.source,
    ]);
    assert.equal(
      sentPayloads[0]?.displayQuestion,
      "Please explain this selected text.",
    );
  });
});
