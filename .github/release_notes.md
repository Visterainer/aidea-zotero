## ✨ What's Changed

- 📖 **Question-aware reading context**: Refreshes paper content for each question, supports follow-ups and multiple documents, and shares a context budget across documents, history, and attachments. Short documents use full text when space permits; longer documents use relevant excerpts.
- 🔗 **Clickable source citations**: Opens PDF pages or EPUB chapters when reliable locations are available. Citations persist in chat history and are retained as source links when copying, exporting, or saving notes.
- 💾 **Portable chat archives**: Manually export and import conversations with optional screenshots, images, and uploaded files. Imports merge new messages, preserve conversation branches, and avoid duplicates on repeated imports. Existing chat records receive stable identifiers with a verified backup before migration. Thanks @siyuanj for the multi-device workflow suggestions in [#84](https://github.com/Visterainer/aidea-zotero/issues/84).
- 💬 **Better conversation continuity**: Improves incremental history summaries and reading shortcuts while preserving custom instructions. Fixes recalled memories being lost during context-budget trimming.
- 🛠️ **Citation and navigation fixes**: Improves EPUB chapter navigation, prevents unmatched backticks from suppressing citations, and uses the parent paper title instead of generic attachment names.
- 🎨 **Improved response layout**: Fixes clipped themed bubbles while preserving their appearance. Wide tables scroll horizontally and keep words readable. Thanks @Dousongyao for reporting [#87](https://github.com/Visterainer/aidea-zotero/issues/87).

## 📝 更新内容

- 📖 **阅读上下文随问题更新**：每轮重新选择论文材料，支持连续追问与多篇文献，统一分配文档、历史和附件的上下文预算。短文在空间允许时提供全文，长文选取相关片段。
- 🔗 **点击引用查看原文**：有可靠位置时，支持跳转到 PDF 页面或 EPUB 章节。聊天历史保留引用，复制、导出和保存笔记时保留来源链接。
- 💾 **聊天记录手动迁移**：支持导出、导入会话，可选择包含截图、图片和上传文件。导入合并新增消息，保留对话分支，重复导入避免重复添加。旧记录升级时增加稳定标识，迁移前生成并校验恢复备份。感谢 @siyuanj 在 [#84](https://github.com/Visterainer/aidea-zotero/issues/84) 中提出多设备使用建议。
- 💬 **长对话更连贯**：改进增量历史摘要与阅读快捷指令，保留已有自定义指令；修复上下文预算裁剪时召回记忆丢失的问题。
- 🛠️ **引用与导航修复**：改进 EPUB 章节跳转，修复未配对反引号导致引用失效的问题，并优先显示父文献标题，避免使用通用附件名称。
- 🎨 **回复显示更完整**：修复主题气泡右侧裁切，保留原有外观。宽表格支持横向滚动，避免单词过度拆行。感谢 @Dousongyao 在 [#87](https://github.com/Visterainer/aidea-zotero/issues/87) 中反馈。

## ✅ Compatibility and Validation / 兼容性与验证

- Supports Zotero 7–10. / 支持 Zotero 7–10。
- Passed 604 unit tests, the plugin/TypeScript build, Prettier, and ESLint. / 604 项单元测试、插件及 TypeScript 构建、Prettier 和 ESLint 通过。
- Feature testing covered Windows / Zotero 10.0.2; archive transfer and branch merging were also tested with Linux / Zotero 9.0.1. This does not represent full validation on every supported platform or version. / 功能测试覆盖 Windows / Zotero 10.0.2；归档迁移与分支合并另在 Linux / Zotero 9.0.1 上验证，不代表所有支持平台及版本均已完整验收。

## 📦 Installation / 安装

Download `AIdea-3.6.0.xpi`, install through **Tools → Plugins → Install Plugin From File**, then restart Zotero.

下载 `AIdea-3.6.0.xpi`，通过 **工具 → 插件 → 从文件安装插件** 安装，然后重启 Zotero。

## ℹ️ Scope and Limitations / 范围与限制

- Chat transfer is manual. Settings, credentials, and the Memory database are not included. / 聊天迁移为手动操作，不包含设置、认证凭据或 Memory 数据库。
- Zotero-managed paper originals are not bundled. Cross-device citation navigation requires matching library items and unchanged source files; unavailable locations are not guessed. / 不打包 Zotero 管理的论文原件。跨设备引用跳转需要匹配的文献条目及内容一致的原文文件，不猜测缺失位置。
- Citations identify sources; they do not independently verify the model’s conclusions. Exact passage highlighting is not included. / 引用用于标明来源，不等于模型结论已经验证；本次不包含精确原文高亮。
