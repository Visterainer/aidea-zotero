## What's Changed

- **EPUB selection translation and automatic format detection**: AIdea now supports translating selected text directly in Zotero's EPUB reader. The existing selection-translation action automatically detects the active PDF or EPUB, with no new setting or manual format switch required. Thanks @senlinyy for the contribution in #62.
- **More accurate attachment selection**: when a Zotero item contains both PDF and EPUB attachments, AIdea follows the attachment currently open in the reader instead of relying on attachment order.
- **Translation remains available without extracted context**: selection translation can continue when extracted document text is unavailable for either PDF or EPUB. Temporarily empty EPUB full-text caches are retried automatically.
- **Existing PDF workflow preserved**: normal PDF selection translation and PDF side-panel document chat continue to work as before, with additional coverage for mixed attachments and empty-context translation.
- **Dependency and rendering compatibility maintenance**: through #61, updated KaTeX, Zotero Plugin Toolkit, the Zotero ESLint configuration, and Prettier. The Toolkit import path and bundled KaTeX CSS were updated together, with regression coverage for formula rendering.

EPUB support in this release applies only to selection translation. Full-document translation is unchanged, and EPUB side-panel document chat is not included.

After updating, restart Zotero before testing the new behavior.

## 更新内容

- **EPUB 划词翻译与格式自动识别**：AIdea 现在支持在 Zotero EPUB 阅读器中直接翻译选中文本。现有划词翻译入口会自动识别当前打开的是 PDF 还是 EPUB，无需新增设置或手动切换文档格式。感谢 @senlinyy 在 #62 中提交这一功能。
- **混合附件选择更准确**：同一 Zotero 条目同时包含 PDF 和 EPUB 附件时，AIdea 会使用当前阅读器中实际打开的附件，不再依赖附件排列顺序。
- **缺少文档上下文时仍可翻译**：即使 PDF 或 EPUB 的全文内容尚未提取完成，划词翻译仍可继续使用；暂时为空的 EPUB 全文缓存也会自动重试。
- **保持现有 PDF 工作流**：PDF 划词翻译和 PDF 侧栏文档对话继续保持原有行为，并新增了混合附件及空上下文翻译的回归保障。
- **依赖与公式渲染兼容性维护**：通过 #61 更新 KaTeX、Zotero Plugin Toolkit、Zotero ESLint 配置和 Prettier；同时适配 Toolkit 新导入路径、同步更新内置 KaTeX 样式，并增加公式渲染回归测试。

本次 EPUB 支持仅适用于划词翻译。全文翻译功能没有变化，EPUB 侧栏文档对话暂不包含在本次更新中。

更新后请重启 Zotero，再测试相关功能。
