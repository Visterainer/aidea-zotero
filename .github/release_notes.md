## ✨ What's Changed

- 🧩 **Zotero 10 compatibility**: Fixed the incompatible-version error when installing AIdea on Zotero 10. The XPI and automatic-update manifest now both support Zotero 10.0.x, while retaining Zotero 7–9 compatibility. Thanks @Saywhatyousay and @JorgeESantos for reporting and confirming #77.

- 🗂️ **Correct library scope**: Use Zotero 10's `getSelectedLibraryIDs()` API instead of its removed singular getter. Selecting a group library now keeps the correct conversation scope. In a multi-library view, AIdea uses the selected items' library when it is unambiguous; otherwise it falls back to the personal library. Zotero 7–9 keep their existing API fallback.

- 🛡️ **Resilient selection fallback**: A library-selection API error no longer prevents AIdea from checking the selected items. Regression tests cover the new API, older Zotero versions, group libraries, and ambiguous multi-library selections.

- ✅ **Validation**: Passed 447 automated tests, formatting and lint checks, and a production build. Local Windows testing on Zotero 10.0.1 covered native XPI compatibility checks, installation, restart, disable/re-enable, group and multi-library selection, settings, and PDF/EPUB reader panels. These smoke tests did not send requests to a model provider.

- 🔁 **How to update**: Install `AIdea-3.4.1.xpi` from this release, or use Zotero's plugin update check, then restart Zotero. There is no need to edit or repackage `manifest.json` manually.

## 📝 更新内容

- 🧩 **兼容 Zotero 10**：修复在 Zotero 10 中安装 AIdea 时提示版本不兼容的问题。XPI 安装包和自动更新清单现已同时支持 Zotero 10.0.x，并保留 Zotero 7–9 兼容性。感谢 @Saywhatyousay 和 @JorgeESantos 在 #77 中报告并确认问题。

- 🗂️ **正确识别资料库范围**：改用 Zotero 10 的 `getSelectedLibraryIDs()` 接口，不再调用已移除的单资料库接口。选择群组文库时保留正确的会话范围；同时选择多个资料库时，优先采用所选条目明确所属的资料库，范围不明确时回退到个人文库。Zotero 7–9 继续使用原有接口作为后备。

- 🛡️ **更可靠的选择回退**：资料库选择接口报错时，仍会继续检查所选条目，不再直接跳过。新增回归测试覆盖新旧 Zotero 接口、群组文库和跨资料库选择。

- ✅ **验证情况**：已通过 447 项自动化测试、格式与 lint 检查及生产构建。在 Windows 的 Zotero 10.0.1 中验证了原生 XPI 兼容性检查、安装、重启、禁用后重新启用、群组与多资料库选择、设置页及 PDF/EPUB 阅读器面板。本轮冒烟测试未向模型服务商发送请求。

- 🔁 **更新方法**：安装本次发布的 `AIdea-3.4.1.xpi`，或使用 Zotero 的插件更新检查，然后重启 Zotero。无需手动修改或重新打包 `manifest.json`。
