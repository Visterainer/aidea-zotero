import { FilePickerHelper } from "zotero-plugin-toolkit";
import {
  exportChatArchive,
  importChatArchive,
  type ExportScope,
} from "../../utils/chatTransfer";
import {
  MAX_BUNDLE_BYTES,
  packChatBundle,
  readChatBundle,
} from "../../utils/chatTransferAssets";
import { getPanelLang } from "./i18n";
import { chatHistory, loadedConversationKeys } from "./state";

export function bindChatTransferMenu(options: {
  menu: HTMLElement;
  currentScope: () => ExportScope;
  close: () => void;
  refreshed: () => Promise<void>;
}) {
  if (options.menu.dataset.transferBound) return;
  options.menu.dataset.transferBound = "true";
  const doc = options.menu.ownerDocument;
  if (!doc?.defaultView) return;
  const win = doc.defaultView;
  const zh = getPanelLang().startsWith("zh");
  const label = (cn: string, en: string) => (zh ? cn : en);
  const busy = () =>
    [...chatHistory.values()].some((messages) =>
      messages.some((m) => m.streaming),
    );
  let running = false;
  const button = (name: string, action: () => Promise<void>) => {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = options.menu.querySelector("button")?.className || "";
    element.textContent = name;
    element.addEventListener("click", async (event) => {
      event.stopPropagation();
      options.close();
      if (running) return;
      if (busy()) {
        win.alert(
          label(
            "请等回答完成后再导入或导出。",
            "Wait for active answers to finish before transferring chats.",
          ),
        );
        return;
      }
      running = true;
      try {
        await action();
      } catch (error) {
        win.alert(
          `${label("聊天记录迁移失败，已有记录未被替换：", "Chat transfer failed; existing records were not replaced:")}\n${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        running = false;
      }
    });
    options.menu.appendChild(element);
  };
  const exportScope = async (scope: ExportScope) => {
    const prompt = Services.prompt;
    const choice = prompt.confirmEx(
      win as unknown as mozIDOMWindowProxy,
      label("导出聊天记录", "Export chats"),
      label(
        "选择导出内容。Zotero 管理的论文原件不重复打包。",
        "Choose what to export. Zotero-managed paper originals are not bundled.",
      ),
      Ci.nsIPromptService.BUTTON_TITLE_IS_STRING! *
        (Ci.nsIPromptService.BUTTON_POS_0! +
          Ci.nsIPromptService.BUTTON_POS_1! +
          Ci.nsIPromptService.BUTTON_POS_2!),
      label("包括图片和附件", "Include images and files"),
      label("取消", "Cancel"),
      label("仅导出文字", "Text only"),
      "",
      { value: false },
    );
    if (choice !== 0 && choice !== 2) return;
    const includeResources = choice === 0;
    const extension = includeResources ? "zip" : "json";
    const path = await new FilePickerHelper(
      label("导出聊天记录", "Export chat archive"),
      "save",
      [["AIdea chat", `*.aidea-chat.${extension}`]],
      `AIdea-chats.aidea-chat.${extension}`,
    ).open();
    if (!path) return;
    if (busy())
      throw new Error(
        label(
          "仍有回答正在生成，请稍后重试。",
          "An answer is in progress; retry later.",
        ),
      );
    const blobs = includeResources ? new Map<string, Uint8Array>() : undefined;
    const archive = await exportChatArchive(scope, blobs);
    if (!archive.conversations.length) {
      win.alert(label("没有可导出的会话。", "No conversations to export."));
      return;
    }
    const bytes = blobs
      ? await packChatBundle({ archive, blobs })
      : new TextEncoder().encode(JSON.stringify(archive, null, 2));
    const size =
      bytes.length < 1024 * 1024
        ? `${Math.ceil(bytes.length / 1024)} KiB`
        : `${(bytes.length / 1024 / 1024).toFixed(2)} MiB`;
    const count = blobs?.size || 0;
    if (
      !win.confirm(
        label(
          `导出 ${archive.conversations.length} 个会话、${count} 个去重资源，文件大小 ${size}。${includeResources ? "包含可读取的截图和上传附件；已丢失的文件无法打包。" : "仅包含文字和引用，图片及附件文件不包含在内。"}继续？`,
          `Export ${archive.conversations.length} conversations and ${count} unique resources (${size}). ${includeResources ? "Readable screenshots and uploads are included; missing files cannot be bundled." : "Text and citations only; image and attachment files are excluded."} Continue?`,
        ),
      )
    )
      return;
    await IOUtils.write(path, bytes, {
      tmpPath: `${path}.tmp`,
    });
    win.alert(
      label(
        `已导出 ${archive.conversations.length} 个会话。`,
        `Exported ${archive.conversations.length} conversations.`,
      ),
    );
  };
  button(label("导出当前会话文件…", "Export current conversation…"), () =>
    exportScope(options.currentScope()),
  );
  button(
    label("导出当前论文全部会话…", "Export all paper conversations…"),
    async () => {
      const scope = options.currentScope();
      if (!scope.paperItemID) {
        win.alert(
          label(
            "请在论文对话中使用此选项。",
            "Open a paper conversation to use this option.",
          ),
        );
        return;
      }
      await exportScope({
        libraryID: scope.libraryID,
        paperItemID: scope.paperItemID,
      });
    },
  );
  button(
    label("导出当前文库全部会话…", "Export all library conversations…"),
    () => exportScope({ libraryID: options.currentScope().libraryID }),
  );
  button(label("导入聊天记录文件…", "Import chat archive…"), async () => {
    const scope = options.currentScope();
    const path = await new FilePickerHelper(
      label("导入聊天记录", "Import chat archive"),
      "open",
      [["AIdea chat", "*.zip;*.json"]],
    ).open();
    if (!path) return;
    if (((await IOUtils.stat(path)).size || 0) > MAX_BUNDLE_BYTES)
      throw new Error("Archive exceeds 128 MiB / 文件超过 128 MiB");
    const bundle = await readChatBundle(await IOUtils.read(path));
    const text = JSON.stringify(bundle.archive);
    const preview = await importChatArchive(
      text,
      scope.libraryID,
      true,
      bundle.blobs,
    );
    const summary = (r: typeof preview) =>
      label(
        `新增会话 ${r.conversations}，补入消息 ${r.messages}，跳过重复 ${r.duplicates}，保留冲突 ${r.conflicts}，文献待关联 ${r.unresolved}，标题差异 ${r.titleConflicts}。`,
        `New conversations: ${r.conversations}; new messages: ${r.messages}; duplicates: ${r.duplicates}; conflicts retained: ${r.conflicts}; unresolved sources: ${r.unresolved}; title differences: ${r.titleConflicts}.`,
      );
    if (
      !win.confirm(
        `${summary(preview)}\n${label(`归档包含 ${bundle.blobs.size} 个去重资源。`, `Archive contains ${bundle.blobs.size} unique resources.`)}\n\n${label("保留已有消息和分支，补入归档中的图片与附件。确认合并？", "Keep existing messages and branches; restore bundled images and files. Merge?")}`,
      )
    )
      return;
    if (busy())
      throw new Error(
        label(
          "有回答正在生成，请稍后重试。",
          "An answer is in progress; retry later.",
        ),
      );
    const result = await importChatArchive(
      text,
      scope.libraryID,
      false,
      bundle.blobs,
    );
    for (const key of result.conversationKeys) {
      loadedConversationKeys.delete(key);
      chatHistory.delete(key);
    }
    await options.refreshed();
    win.alert(
      `${summary(result)}\n${label("可在历史列表查看导入会话。原文同步后，重新打开历史即可自动关联待关联会话。", "Imported conversations are in History. After sources sync, reopen History to associate pending paper conversations.")}`,
    );
  });
}
