## ✨ What's Changed

- 📚 **EPUB context chat**: AIdea can now use EPUB books as the active document context in Zotero’s reader panel. It supports EPUB 3 navigation documents and EPUB 2 NCX structure, with semantic headings and spine order as fallbacks for less structured books. Thanks @senlinyy for contributing the document-adapter and EPUB parsing work in #69; the integrated commit preserves the original Git authorship.

- 🎯 **Deterministic, bounded retrieval**: Explicit chapter references, whole-book requests, and ambiguous follow-ups are routed locally. AIdea sends only bounded relevant excerpts to the answering model and does not make an additional model request to plan sections.

- 🌐 **Context-aware EPUB selection translation**: EPUB selections use bounded, selection-anchored book context directly, without a separate cold-start request. Selection translation remains automatic, with no additional custom-instruction setting.

- 🛡️ **Safer EPUB processing**: Archive paths, entry counts, individual decompressed entries, total extracted text, and normalized book text are bounded to prevent malformed or oversized EPUB files from exhausting Zotero resources.

- 🐛 **Reliable panel startup**: Required chat tables are committed before optional historical migrations run. Failed core initialization can be retried, migration failures no longer leave the AIdea panel blank, and Zotero SQLite `LIKE` patterns use bound parameters. Thanks @senlinyy for reporting #71.

- 🔄 **PDF and history compatibility**: Existing PDF context behavior and legacy `basePdf` conversation data remain compatible while the shared document-adapter architecture supports future formats.

- ✅ **Validation**: The release has passed 438 TypeScript tests, formatting and lint checks, production builds, reproducible EPUB 2/3 fixture tests, GitHub CI, and local Zotero verification covering EPUB reading, panel initialization, and selection translation.

- 🔁 **After updating**: Restart Zotero, then open a PDF or EPUB and use the same AIdea reader panel. No additional mode switch is required.

- 🔒 **Privacy and model requests**: EPUB extraction and section routing run locally. Only the bounded context selected for the current request is sent to the configured model provider. No additional planning-model request is made.

- ⚠️ **EPUB structure**: Retrieval quality benefits from publisher-provided navigation and chapter structure. For less structured books, AIdea falls back to semantic headings and spine reading order.

## 📝 更新内容

- 📚 **EPUB 上下文对话**：AIdea 现在可以在 Zotero 阅读器侧边栏中把 EPUB 图书作为当前文档上下文。支持 EPUB 3 Navigation Document 和 EPUB 2 NCX 目录结构；对于结构不完整的图书，会使用语义标题和 spine 阅读顺序作为后备。感谢 @senlinyy 在 #69 中贡献文档适配器与 EPUB 解析工作；整合后的提交保留了原始 Git 作者信息。

- 🎯 **本地确定性有界检索**：明确章节、全书请求和模糊追问均在本地完成章节路由。AIdea 只把有界的相关原文片段发送给回答模型，不会为了规划章节而额外调用一次模型。

- 🌐 **带上下文的 EPUB 划词翻译**：EPUB 划词翻译直接使用以选中文本为锚点的有界图书上下文，不再执行单独的冷启动请求。划词翻译仍然自动工作，不增加自定义指令设置。

- 🛡️ **更安全的 EPUB 处理**：对压缩包路径、条目数量、单个解压条目、累计提取文本和规范化图书文本设置明确上限，避免异常或超大 EPUB 占用过多 Zotero 资源。

- 🐛 **面板启动更加可靠**：聊天所需的核心数据表会先提交，再运行可选的历史迁移。核心初始化失败后可以重试，迁移失败不再导致 AIdea 面板空白，同时 Zotero SQLite 的 `LIKE` 查询改为绑定参数。感谢 @senlinyy 报告 #71。

- 🔄 **兼容现有 PDF 和历史记录**：原有 PDF 上下文行为保持不变，并继续兼容旧版 `basePdf` 对话数据；共享文档适配器架构也为后续格式扩展提供统一入口。

- ✅ **验证情况**：已通过 438 项 TypeScript 测试、格式与 lint 检查、生产构建、可复现的 EPUB 2/3 fixture 测试、GitHub CI，以及覆盖 EPUB 阅读、面板初始化和划词翻译的本地 Zotero 验证。

- 🔁 **更新后操作**：请重启 Zotero，然后打开 PDF 或 EPUB，直接使用同一个 AIdea 阅读器侧边栏，无需切换额外模式。

- 🔒 **隐私与模型调用**：EPUB 内容提取和章节路由均在本地完成，只有针对当前请求选出的有界上下文会发送给已配置的模型服务商，不会额外调用章节规划模型。

- ⚠️ **EPUB 结构说明**：检索效果会受图书内置目录和章节结构影响。对于结构不完整的图书，AIdea 会使用语义标题和 spine 阅读顺序作为后备。
