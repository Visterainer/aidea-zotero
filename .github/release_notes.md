## ✨ What's Changed

- 📖 **Reading context and answer structure**: Uses model-service context capacity when available while preserving manual overrides. Supplies full text when it fits, improves excerpt coverage and overview follow-ups for longer papers, and distinguishes full text, excerpts, abstract-only input, and unavailable text. Paper explanations and complex analysis can use headings, lists, tables, and necessary detail; simple answers stay direct. Thanks @siyuanj for the feedback in #96.
- 🔗 **Evidence where it helps**: Guides the model to cite supplied material near important methods, results, data, comparisons, and quotations, without mechanically repeating citations. Historical answers are not treated as original evidence. Existing source links, custom system prompts, and separate internal-task prompts are preserved.
- 🔧 **Gemini CLI OAuth removed**: Removes the old connection and clears its obsolete configuration and cached credentials. Previous users must select and configure an available connection in model settings. This release does not add Antigravity or another replacement authentication provider. Thanks @jiang-gy for reporting #98.
- 🛠️ **Startup and history reliability**: Fixes update-notice tracking and a message-ID race during concurrent Zotero background writes that could prevent replies from being saved correctly.
- 📦 **Dependency maintenance**: Includes bundled KaTeX 0.18.7 and transitive dependency security fixes, with contributions from @dependabot[bot] in #88 and @Visterainer in #94.

## ✅ Validation and Compatibility

654 TypeScript tests and 110 Python checks passed, along with lint, production build, and diff checks. The local production XPI passed installation, restart, reading-state, citation navigation, history, and Gemini-configuration migration checks in an isolated Windows / Zotero 10.0.6 profile using a local simulated model service.

A separate before/after comparison used the same real model and synthetic paper across six scenario types. This small sample does not establish restored answer quality across models or real-world papers, and citations do not independently verify model conclusions. See [validation details](https://github.com/Visterainer/aidea-zotero/blob/v3.6.1/doc/reading-context-validation.md).

Declared compatibility: Zotero 7–10; this acceptance run covered Windows / Zotero 10.0.6. Install `AIdea-3.6.1.xpi` through **Tools → Plugins → Install Plugin From File**, then restart Zotero.

## 📝 更新内容

- 📖 **阅读上下文与回答结构**：优先使用模型服务返回的上下文容量，同时保留手动设置。放得下的论文提供全文，较长论文改善取材覆盖及整体讲解的连续追问，并区分全文、部分内容、仅摘要和正文不可用。论文讲解与复杂分析按需使用标题、列表、表格和必要细节，简单问题直接回答。感谢 @siyuanj 在 #96 中提供反馈。
- 🔗 **按需引用证据**：引导模型在关键方法、结果、数据、比较结论和直接引文附近引用本轮提供的对应材料，避免机械重复引用；历史回答不作为原文证据。保留现有来源链接、自定义系统提示词及内部任务的独立提示词。
- 🔧 **移除 Gemini CLI OAuth**：移除旧接入，清理失效配置和缓存凭据。此前使用该接入的用户，需要在模型设置中重新选择并配置可用接入。本次不接入 Antigravity 或其他替代认证服务。感谢 @jiang-gy 在 #98 中报告问题。
- 🛠️ **启动与历史可靠性**：修复更新弹窗状态记录，以及 Zotero 后台并发写入时消息 ID 获取错误导致回答无法正确保存的问题。
- 📦 **依赖维护**：包含内置 KaTeX 0.18.7 更新及间接依赖安全修复，对应 @dependabot[bot] 的 #88 和 @Visterainer 的 #94。

## ✅ 验证与兼容性

654 项 TypeScript 测试、110 项 Python 检查，以及静态检查、生产构建和差异检查通过。本地生产 XPI 在独立 Windows / Zotero 10.0.6 配置中，通过安装、重启、阅读状态、引用跳转、历史恢复及 Gemini 配置迁移检查；实机流程使用本机模拟模型接口。

另外使用同一真实模型与合成论文，完成六类场景的修改前后对照。小样本结果不代表所有模型或真实论文的回答质量已恢复，引用也不代表模型结论已经独立验证。详见[验收记录](https://github.com/Visterainer/aidea-zotero/blob/v3.6.1/doc/reading-context-validation.md)。

声明兼容 Zotero 7–10；本轮实机验收覆盖 Windows / Zotero 10.0.6。通过 **工具 → 插件 → 从文件安装插件** 安装 `AIdea-3.6.1.xpi`，然后重启 Zotero。
