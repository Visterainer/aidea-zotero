import { assert } from "chai";

type DraftModule =
  typeof import("../src/modules/contextPanel/setupHandlers/controllers/composeDraftController");
type State = typeof import("../src/modules/contextPanel/state");
const DRAFT = "extensions.zotero.extensions.AIdea.draftInput.";
const COMPOSE = "extensions.zotero.extensions.AIdea.composeState.";
const FILE_IDS = "extensions.zotero.aidea.fileAttachments_";
const file = {
  id: "attachment-1",
  name: "private.txt",
  mimeType: "text/plain",
  sizeBytes: 1,
  category: "text" as const,
  storedPath: "/blob",
  contentHash: "f".repeat(64),
};
const screenshot = "data:image/png;base64,c2VjcmV0";
const snapshot = JSON.stringify({
  files: [file],
  screenshots: [screenshot],
  textContexts: [{ text: "private quote", source: "pdf" }],
  papers: [{ itemId: 7, contextItemId: 8, title: "private paper" }],
});
class Input extends EventTarget {
  value = "";
}

describe("clear all history: compose data", function () {
  const pref = new Map<string, unknown>();
  const disposals: (() => void)[] = [];
  let originalZotero: unknown;
  let originalToolkit: unknown;
  let store: typeof import("../src/utils/chatStore");
  let drafts: DraftModule;
  let state: State;
  let failDB = false;
  const bind = (key: number, itemId: number, refresh?: () => void) => {
    const input = new Input();
    const binding = drafts.bindComposeDraft({
      inputBox: input as unknown as HTMLTextAreaElement,
      getKey: () => key,
      getItemId: () => itemId,
      refreshAfterClear: () => {
        // Preview redraw in setupHandlers also schedules a save.
        binding.scheduleComposeStateSave();
        refresh?.();
      },
    });
    disposals.push(binding.dispose);
    return { input, binding };
  };

  beforeEach(async function () {
    originalZotero = (globalThis as any).Zotero;
    originalToolkit = (globalThis as any).ztoolkit;
    failDB = false;
    pref.clear();
    (globalThis as any).ztoolkit = { log() {}, getGlobal() {} };
    const name = (key: string, global?: boolean) =>
      global ? key : `extensions.zotero.${key}`;
    (globalThis as any).Zotero = {
      locale: "en-US",
      Prefs: {
        get: (key: string, global?: boolean) => pref.get(name(key, global)),
        set: (key: string, value: unknown, global?: boolean) =>
          pref.set(name(key, global), value),
        clear: (key: string, global?: boolean) =>
          pref.delete(name(key, global)),
        resetBranch(_: string[], prefix: string) {
          for (const key of pref.keys())
            if (key.startsWith(prefix)) pref.delete(key);
        },
      },
      DB: {
        executeTransaction: async (fn: () => Promise<void>) => fn(),
        queryAsync: async () => {
          if (failDB) throw new Error("DB clear failed");
          return [];
        },
        valueQueryAsync: async () => false,
      },
    };
    await import("../src/modules/contextPanel/chat"); // real post-commit listener
    store = await import("../src/utils/chatStore");
    drafts =
      await import("../src/modules/contextPanel/setupHandlers/controllers/composeDraftController");
    state = await import("../src/modules/contextPanel/state");
  });

  afterEach(function () {
    for (const dispose of disposals.splice(0)) dispose();
    drafts.clearAllComposeDrafts();
    (globalThis as any).Zotero = originalZotero;
    (globalThis as any).ztoolkit = originalToolkit;
  });

  it("clears open and offline drafts, including both panels' pending writes before a key is reused", async function () {
    const readerKey = 1000000001,
      globalKey = 2000000001,
      closedKey = 2000000002;
    for (const key of [readerKey, globalKey, closedKey]) {
      pref.set(DRAFT + key, "saved prompt");
      pref.set(COMPOSE + key, snapshot);
      pref.set(FILE_IDS + key, JSON.stringify([file.id]));
    }
    const unrelated = "extensions.zotero.aidea.fileAttachmentsEnabled";
    pref.set(unrelated, true);
    const { input: reader, binding: readerDraft } = bind(readerKey, 42, () => {
      throw new Error("detached preview");
    });
    const { input: library, binding: libraryDraft } = bind(
      globalKey,
      globalKey,
    );
    for (const [input, binding] of [
      [reader, readerDraft],
      [library, libraryDraft],
    ] as const) {
      assert.equal(
        input.value,
        "saved prompt",
        "legacy draft key still restores",
      );
      input.value = "pending secret";
      input.dispatchEvent(new Event("input")); // 600ms text timer
      binding.scheduleComposeStateSave(); // 800ms attachment timer
    }
    assert.deepEqual(state.selectedImageCache.get(42), [screenshot]);
    assert.equal(
      state.selectedFileAttachmentCache.get(globalKey)?.[0].id,
      file.id,
    );
    state.draftInputCache.set(closedKey, "cached only");
    await store.clearAllChatHistory();
    assert.equal(reader.value, "");
    assert.equal(
      library.value,
      "",
      "the other window resets even when a detached UI throws",
    );
    for (const cache of [
      state.selectedImageCache,
      state.selectedTextCache,
      state.selectedFileAttachmentCache,
      state.selectedPaperContextCache,
      state.draftInputCache,
    ])
      assert.equal(cache.size, 0);
    await new Promise((resolve) => setTimeout(resolve, 850));
    assert.deepEqual(
      [...pref],
      [[unrelated, true]],
      "no delayed save recreated deleted prefs",
    );
    const { input: reused } = bind(readerKey, 42);
    assert.equal(reused.value, "");
    assert.isFalse(state.selectedImageCache.has(42));
    assert.isFalse(state.selectedFileAttachmentCache.has(42));
    // Clearing is a boundary, not a permanent disable.
    reused.value = "new prompt";
    reused.dispatchEvent(new Event("input"));
    await new Promise((resolve) => setTimeout(resolve, 620));
    assert.equal(pref.get(DRAFT + readerKey), "new prompt");
  });

  it("saves pending edits on ordinary panel disposal, but clears them even with no open panel", async function () {
    const key = 2000000001;
    const { input, binding } = bind(key, key);
    input.value = "closing window";
    input.dispatchEvent(new Event("input"));
    state.selectedFileAttachmentCache.set(key, [file]);
    state.selectedImageCache.set(key, [screenshot]);
    binding.scheduleComposeStateSave();
    binding.dispose();
    assert.equal(pref.get(DRAFT + key), input.value);
    assert.deepEqual(JSON.parse(String(pref.get(COMPOSE + key))).screenshots, [
      screenshot,
    ]);
    await store.clearAllChatHistory();
    const reopened = bind(key, key);
    assert.equal(reopened.input.value, "");
    assert.isFalse(pref.has(COMPOSE + key));
    assert.isFalse(state.selectedFileAttachmentCache.has(key));
  });

  it("keeps both pending writes when the history transaction fails", async function () {
    const key = 1000000001;
    const { input, binding } = bind(key, 42);
    input.value = "unsaved prompt";
    input.dispatchEvent(new Event("input"));
    state.selectedFileAttachmentCache.set(42, [file]);
    state.selectedImageCache.set(42, [screenshot]);
    binding.scheduleComposeStateSave();
    failDB = true;
    const generation = drafts.getComposeHistoryGeneration();
    const err = await store.clearAllChatHistory().catch((err) => err);
    assert.include(String(err), "DB clear failed");
    assert.equal(drafts.getComposeHistoryGeneration(), generation);
    assert.equal(input.value, "unsaved prompt");
    await new Promise((resolve) => setTimeout(resolve, 850));
    assert.equal(pref.get(DRAFT + key), "unsaved prompt");
    const saved = JSON.parse(String(pref.get(COMPOSE + key)));
    assert.deepEqual(saved.screenshots, [screenshot]);
    assert.deepEqual(saved.files, [file]);
  });

  for (const fails of [false, true]) {
    it(`does not resurrect a previous batch when blob persistence ${fails ? "rejects" : "resolves"} after clear`, async function () {
      const item = { id: 42 } as Zotero.Item;
      state.selectedFileAttachmentCache.set(item.id, [file]);
      state.selectedImageCache.set(item.id, [screenshot]);
      let finish!: () => void, announce!: () => void;
      const started = new Promise<void>((resolve) => {
        announce = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      let writes = 0;
      const { createFileIntakeController } =
        await import("../src/modules/contextPanel/setupHandlers/controllers/fileIntakeController");
      const { processIncomingFiles } = createFileIntakeController({
        body: {} as Element,
        getItem: () => item,
        getCurrentModel: () => "model",
        isScreenshotUnsupportedModel: () => false,
        optimizeImageDataUrl: async (_, url) => url,
        getHistoryGeneration: drafts.getComposeHistoryGeneration,
        persistAttachmentBlob: async () => {
          announce();
          await pending;
          if (fails) throw new Error("disk write failed");
          return { storedPath: "/new", contentHash: "a".repeat(64) };
        },
        selectedImageCache: state.selectedImageCache,
        selectedFileAttachmentCache: state.selectedFileAttachmentCache,
        updateImagePreview() {},
        updateFilePreview() {},
        scheduleAttachmentGc() {},
        onFileStateChanged() {
          writes++;
        },
      });
      const batch = processIncomingFiles([new File(["draft"], "adding.txt")]);
      await started;
      assert.isTrue(state.selectedFileAttachmentCache.get(42)?.[1]?.processing);
      await store.clearAllChatHistory();
      finish();
      await batch;
      assert.isFalse(state.selectedFileAttachmentCache.has(42));
      assert.isFalse(state.selectedImageCache.has(42));
      assert.equal(writes, 0);
    });
  }
});
