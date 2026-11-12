## ✨ What's Changed

- 📄 **Translate a PDF from the item menu**: Right-click a single library item with a PDF to translate it using the settings saved in AIdea’s Translate tab. Progress is shown in Zotero; the action can be cancelled from the item menu. When finished, AIdea adds the translated PDF to the item and opens it in Zotero’s reader. For a linked source file, the output is placed alongside the source; for a stored source, Zotero manages the imported attachment. Thanks @substil3 for suggesting [#104](https://github.com/Visterainer/aidea-zotero/issues/104).
- 🎨 **Refreshed themes**: Built-in palettes have clearer contrast, and theme colors now apply to the reader’s selection popup. Existing custom color changes are preserved when theme settings are migrated. ([commit](https://github.com/Visterainer/aidea-zotero/commit/a41b7f8039c322f59b496768231243dae4b549fd))
- 🔄 **Verified translation environment updates**: The Translate tab checks for compatible environment updates and installs a verified dependency set when the user chooses Install/Update. Installation and runtime checks were hardened across supported platforms. ([initial implementation](https://github.com/Visterainer/aidea-zotero/commit/b5dfd8223010db611ce81e6010043d6f47e9da07), [hardening](https://github.com/Visterainer/aidea-zotero/commit/7d12678ac72cb046a14da5be14d1cf9c8212c18a))
- 🐛 **Model refresh errors**: Codex OAuth model-list refresh now distinguishes network failures, rejected access and missing sign-in from a successful empty list, so the UI can show a useful reason. Thanks @aTanlin for reporting [#109](https://github.com/Visterainer/aidea-zotero/issues/109).
- 🐛 **Model availability test**: Exposes the browser globals needed in Zotero’s plugin sandbox, fixing the `AbortController is not defined` failure in model availability checks. Thanks @CAznable0079 for reporting [#108](https://github.com/Visterainer/aidea-zotero/issues/108).
- 🔧 **Stability and security fixes**: Includes fixes for streaming errors, chat persistence, PDF translation cancellation, OAuth handling and settings. It also limits the URLs accepted in rendered model output and protects the local translation proxy with a per-run token. ([audit fixes](https://github.com/Visterainer/aidea-zotero/commit/bb7e6ae676ec67881102d0f9345fd98a0a0e452b), [follow-up](https://github.com/Visterainer/aidea-zotero/commit/7d12678ac72cb046a14da5be14d1cf9c8212c18a))

## Validation and Compatibility

849 TypeScript tests, 234 Python checks and 5 native Zotero tests passed, along with type checking, lint, formatting and a production XPI build. One platform-specific TypeScript test was pending on macOS. The native tests cover plugin startup and the PDF menu’s visibility for single, empty and multiple selections. Translation job and attachment behavior were tested with simulated dependencies; a live provider translation was not run.

Declared compatibility: Zotero 7–10. Install `AIdea-3.8.0.xpi` through **Tools → Plugins → Install Plugin From File**, then restart Zotero. Before using the PDF menu action, select a translation model and prepare the translation environment in AIdea’s Translate tab.

**Known limits:** The menu translates one item at a time; batch and parallel translation are not included. Stored PDFs are imported into Zotero-managed storage, so their translations do not stay in the source file’s physical folder. The translation environment installer requires macOS 13 or later, glibc 2.28 or later on Linux, or a supported Windows system; musl and 32-bit systems are unsupported. Live provider compatibility depends on the configured service and network.

## 📝 更新内容

- 📄 **右键翻译全文 PDF**：对单个带有 PDF 的文献条目点击右键，即可使用 AIdea 翻译标签页保存的设置开始翻译。Zotero 会显示进度，也可从条目菜单取消。完成后，译文自动添加到该条目并在 Zotero 阅读器中打开。源文件为链接附件时，译文放在源文件旁；源文件为存储附件时，译文由 Zotero 作为附件管理。感谢 @substil3 在 [#104](https://github.com/Visterainer/aidea-zotero/issues/104) 中提出建议。
- 🎨 **主题配色更新**：内置主题的对比度更清晰，阅读器划词弹窗也会使用主题颜色。迁移主题设置时保留已有的自定义颜色。（[提交](https://github.com/Visterainer/aidea-zotero/commit/a41b7f8039c322f59b496768231243dae4b549fd)）
- 🔄 **已验证的翻译环境更新**：翻译标签页检查兼容的环境更新；点击“安装/更新”时安装经过验证的依赖组合，并加强了不同平台的安装与运行时检查。（[初始实现](https://github.com/Visterainer/aidea-zotero/commit/b5dfd8223010db611ce81e6010043d6f47e9da07)、[完善](https://github.com/Visterainer/aidea-zotero/commit/7d12678ac72cb046a14da5be14d1cf9c8212c18a)）
- 🐛 **模型列表错误提示**：Codex OAuth 刷新模型列表时，会区分网络故障、访问被拒和未登录，不再把失败显示成“成功获取零个模型”。感谢 @aTanlin 报告 [#109](https://github.com/Visterainer/aidea-zotero/issues/109)。
- 🐛 **模型可用性测试修复**：为 Zotero 插件沙箱提供所需的浏览器全局对象，修复可用性测试中的 `AbortController is not defined` 错误。感谢 @CAznable0079 报告 [#108](https://github.com/Visterainer/aidea-zotero/issues/108)。
- 🔧 **稳定性与安全性修复**：修复流式响应、聊天记录保存、PDF 翻译取消、OAuth 处理和设置中的多项问题；限制模型输出中可用的链接地址，并为本地翻译代理增加单次运行令牌。（[审计修复](https://github.com/Visterainer/aidea-zotero/commit/bb7e6ae676ec67881102d0f9345fd98a0a0e452b)、[后续完善](https://github.com/Visterainer/aidea-zotero/commit/7d12678ac72cb046a14da5be14d1cf9c8212c18a)）

## 验证与兼容性

849 项 TypeScript 测试、234 项 Python 检查、5 项 Zotero 原生测试通过，类型检查、代码规范、格式检查和正式 XPI 构建通过。macOS 上有 1 项特定平台的 TypeScript 测试待运行。原生测试覆盖插件启动，以及 PDF 菜单在单选、空选和多选时的显示；翻译任务与附件处理使用模拟依赖验证，未对真实模型服务执行全文翻译。

声明兼容 Zotero 7–10。通过 **工具 → 插件 → 从文件安装插件** 安装 `AIdea-3.8.0.xpi`，然后重启 Zotero。使用 PDF 右键菜单前，请在 AIdea 翻译标签页选择模型并准备翻译环境。

**已知限制：** 右键菜单一次只翻译一个条目，尚不支持批量或并行翻译。存储型 PDF 的译文会导入 Zotero 管理的附件空间，不会保留在源文件的物理文件夹中。翻译环境安装器要求 macOS 13 或以上、Linux glibc 2.28 或以上，或受支持的 Windows 系统；暂不支持 musl 和 32 位系统。真实服务商的兼容性仍取决于所用服务和网络。
