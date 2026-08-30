## ✨ What's Changed

- 🧩 **Zotero 10 compatibility**: Fixed the incompatible-version error when installing AIdea on Zotero 10. The XPI and automatic-update manifest now both support Zotero 10.0.x, while retaining Zotero 7–9 compatibility. Thanks @Saywhatyousay for reporting and @JorgeESantos for confirming #77.

- 🗂️ **Correct library scope**: Use Zotero 10's `getSelectedLibraryIDs()` API instead of its removed singular getter. Selecting a group library now keeps the correct conversation scope. In a multi-library view, AIdea uses the selected items' library when it is unambiguous; otherwise it falls back to the personal library. Zotero 7–9 keep their existing API fallback.

- 🛡️ **Resilient selection fallback**: A library-selection API error no longer prevents AIdea from checking the selected items. Regression tests cover the new API, older Zotero versions, group libraries, and ambiguous multi-library selections.

- 🌐 **One-time localized update notice**: Added a once-per-version Zotero 10 compatibility notice in all 12 interface languages, including restart and official update guidance without adding a new Settings or PDF/EPUB mode.

- ✅ **Validation**: Passed 451 TypeScript unit tests and 110 Python bridge tests, formatting and lint checks, and a production build. Full local QA on Windows with Zotero 10.0.1 covered XPI installation, restart, disable/re-enable, no/single/multi-selection scope, settings, global/PDF/EPUB chat, attachments, conversation history, notes, image generation, and a 27-page monolingual and bilingual PDF translation using the existing OpenAI Codex connection only. Translation pause/resume also verified Windows process-tree cleanup and a fresh bridge restart. No group library was available in the local profile; group-library scope is covered by automated regression tests.

- 🔁 **How to update**: Install `AIdea-3.4.1.xpi` from this release, or use Zotero's plugin update check, then restart Zotero. There is no need to edit or repackage `manifest.json` manually.

## 📝 更新内容

- 🧩 **兼容 Zotero 10**：修复在 Zotero 10 中安装 AIdea 时提示版本不兼容的问题。XPI 安装包和自动更新清单现已同时支持 Zotero 10.0.x，并保留 Zotero 7–9 兼容性。感谢 @Saywhatyousay 报告问题，并感谢 @JorgeESantos 确认 #77。

- 🗂️ **正确识别资料库范围**：改用 Zotero 10 的 `getSelectedLibraryIDs()` 接口，不再调用已移除的单资料库接口。选择群组文库时保留正确的会话范围；同时选择多个资料库时，优先采用所选条目明确所属的资料库，范围不明确时回退到个人文库。Zotero 7–9 继续使用原有接口作为后备。

- 🛡️ **更可靠的选择回退**：资料库选择接口报错时，仍会继续检查所选条目，不再直接跳过。新增回归测试覆盖新旧 Zotero 接口、群组文库和跨资料库选择。

- 🌐 **一次性多语言更新提示**：新增覆盖全部 12 种界面语言、每个版本只显示一次的 Zotero 10 兼容提示，包含重启和官方更新说明，不增加新的设置或 PDF/EPUB 模式。

- ✅ **验证情况**：已通过 451 项 TypeScript 单元测试、110 项 Python bridge 测试、格式与 lint 检查及生产构建。在 Windows 的 Zotero 10.0.1 中完成了全功能本机验收，覆盖 XPI 安装、重启、禁用后重新启用、无选择/单选/多选范围、设置页、全局/PDF/EPUB 对话、附件、会话历史、笔记、图片生成，以及仅使用现有 OpenAI Codex 连接完成的 27 页单语与双语 PDF 全文翻译；暂停与继续还验证了 Windows 进程树清理及新 bridge 重启。本机 Profile 没有群组文库，该范围由自动化回归测试覆盖。

- 🔁 **更新方法**：安装本次发布的 `AIdea-3.4.1.xpi`，或使用 Zotero 的插件更新检查，然后重启 Zotero。无需手动修改或重新打包 `manifest.json`。
