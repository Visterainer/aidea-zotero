import { assert } from "chai";
import {
  mountTranslateBatchView,
  takeTabOverwrite,
} from "../../../src/modules/pdfTranslator/translateBatchView";
import { batchCopy } from "../../../src/modules/pdfTranslator/translationBatchStrings";
import {
  getBatchDraft,
  removeDraftItem,
  stageLibraryItems,
} from "../../../src/modules/pdfTranslator/translationBatch";

// Exercise Gecko's capture/target order, drag surfaces and cached panel teardown.
// No file picker, translator or model is involved.
describe("Translate tab batch intake", function () {
  it("stages on both surfaces, protects the last checkbox, and detaches when disposed", async function () {
    const doc = document;
    const root = doc.createElement("div");
    const tab = doc.createElement("button");
    tab.id = "llm-tab-btn-translate";
    const panel = doc.createElement("div");
    panel.id = "llm-tab-panel-translate";
    const settings = doc.createElement("div");
    settings.className = "llm-tr-root";
    const check = (id: string, checked = false) => {
      const input = doc.createElement("input");
      input.type = "checkbox";
      input.id = `llm-tr-${id}`;
      input.checked = checked;
      settings.append(input);
      return input;
    };
    const attach = check("output-attach", true);
    const folder = check("output-save-dir");
    const mono = check("mono", true);
    check("dual");
    const overwrite = check("overwrite");
    const path = doc.createElement("input");
    path.id = "llm-tr-output-dir";
    settings.append(path);
    panel.append(settings);
    root.append(tab, panel);
    doc.body.append(root);
    const lifetime = new AbortController();
    const c = batchCopy();
    const book = new Zotero.Item("book");
    book.setField("title", "Intake test (no PDF)");
    await book.saveTx();
    const draftID = Number.MAX_SAFE_INTEGER;
    try {
      mountTranslateBatchView(root, lifetime.signal);
      mountTranslateBatchView(root, lifetime.signal);
      assert.lengthOf(root.querySelectorAll("#llm-tr-batch"), 1);
      const change = (input: HTMLInputElement, checked: boolean) => {
        input.checked = checked;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const warning = root.querySelector("[role='alert']")!;
      change(attach, false);
      assert.isTrue(attach.checked);
      assert.equal(warning.textContent, c.needDestination);
      change(mono, false);
      assert.isTrue(mono.checked);
      assert.equal(warning.textContent, c.needFormat);
      change(folder, true);
      assert.equal(warning.textContent, c.needFolder);
      path.value = "/folder";
      path.dispatchEvent(new Event("input", { bubbles: true }));
      assert.equal(warning.textContent, "");
      change(attach, false);
      assert.isFalse(attach.checked);
      change(overwrite, true);
      assert.isTrue(takeTabOverwrite(root));
      assert.isFalse(takeTabOverwrite(root));

      let opens = 0;
      tab.addEventListener("click", () => opens++);
      const drag = (target: Element, name: string, type: string) => {
        const event = new Event(name, { bubbles: true, cancelable: true });
        Object.defineProperty(event, "dataTransfer", {
          value: { types: [type], getData: () => String(book.id) },
        });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const feedback = root.querySelector(".llm-tr-batch-feedback")!;
      for (const target of [tab, panel]) {
        assert.isFalse(drag(target, "dragover", "Files"));
        assert.isFalse(drag(target, "drop", "text/uri-list"));
        assert.isTrue(drag(target, "dragover", "zotero/item"));
        assert.isTrue(target.classList.contains("llm-tr-drop-active"));
        const reported = new Promise<void>((resolve) => {
          const observer = new MutationObserver(() => {
            observer.disconnect();
            resolve();
          });
          observer.observe(feedback, { childList: true });
        });
        assert.isTrue(drag(target, "drop", "zotero/item"));
        assert.isFalse(target.classList.contains("llm-tr-drop-active"));
        await reported;
        assert.equal(
          feedback.textContent,
          c.staged({ added: 0, duplicates: 0, withoutPdf: 1 }),
        );
      }
      assert.equal(opens, 1, "dropping on the tab opens it exactly once");

      // Stage a lightweight source; it never enters the queue or touches disk.
      await stageLibraryItems([
        {
          id: draftID,
          isAttachment: () => true,
          isPDFAttachment: () => true,
          getFilePathAsync: async () => "/test.pdf",
          getDisplayTitle: () => "Staged PDF",
        } as unknown as Zotero.Item,
      ]);
      const row = Array.from(
        root.querySelectorAll(".llm-tr-batch-list li"),
      ).find((el) => el.textContent?.includes("Staged PDF"));
      assert.exists(row);
      row!.querySelector("button")!.click();
      assert.isFalse(
        getBatchDraft().some((item) => item.attachmentID === draftID),
      );
      lifetime.abort();
      assert.isFalse(drag(tab, "drop", "zotero/item"));
      assert.equal(opens, 1);
    } finally {
      lifetime.abort();
      if (getBatchDraft().some((item) => item.attachmentID === draftID))
        removeDraftItem(draftID);
      root.remove();
      await book.eraseTx();
    }
  });
});
