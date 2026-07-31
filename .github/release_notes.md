## What's Changed

- **Unified final-answer boundary**: AIdea now separates model reasoning from final content across chat, selection translation, and full-document PDF translation. The protection applies to API key and OAuth connections, as well as streaming and non-streaming requests.
- **Reasoning content no longer reaches user data**: structured reasoning fields and leading `<think>` or `<thought>` blocks are removed before content reaches the UI, database, future conversation context, local caches, copied results, new Zotero notes, or newly translated PDFs. Thanks @Ultramarine1939-syujie for reporting #65.
- **Safer MiniMax compatibility**: official MiniMax Chat Completions endpoints automatically request separated reasoning output for supported M2/M3 models. If the endpoint rejects the parameter, AIdea retries once without it and remembers the endpoint capability for the current session. Custom proxies do not receive MiniMax-specific parameters and remain protected by the general output filter.
- **Automatic historical cleanup**: on startup, AIdea cleans identifiable reasoning blocks from existing assistant messages and compacted summaries, clears previously stored reasoning fields, and removes outdated selection-translation caches. User messages are not modified.
- **No raw-response exposure**: when a provider returns only reasoning or an unrecognized response without final content, AIdea uses the existing no-response state instead of exposing raw JSON or internal model output.
- **Regression coverage**: validated with 421 TypeScript tests, 110 Python bridge tests, a production build, formatting checks, and lint checks.

No new setting, mode, or visible control has been added. The filtering is automatic across supported providers and output paths.

Restart Zotero after updating.

Existing notes or PDFs that already contain reasoning text are not modified automatically. Recreate the note or translate the PDF again if a clean copy is needed.

This release fixes the reasoning-content exposure reported in #65. Translation style can still vary by model, so this update does not guarantee word-for-word translation from every provider.

## 更新内容

- **统一最终答案边界**：AIdea 现在会在对话、划词翻译和全文 PDF 翻译中统一分离模型推理与最终正文。API Key、OAuth、流式和非流式请求均受到相同保护。
- **推理内容不再进入用户数据**：结构化推理字段以及前置的 `<think>`、`<thought>` 推理块，会在内容进入界面、数据库、后续对话上下文、本地缓存、复制结果、新建 Zotero 笔记或新生成的翻译 PDF 之前被移除。感谢 @Ultramarine1939-syujie 报告 #65。
- **更安全的 MiniMax 兼容处理**：对于 MiniMax 官方 Chat Completions 接口和受支持的 M2/M3 模型，AIdea 会自动请求独立的推理输出。如果接口拒绝该参数，则自动移除参数重试一次，并在当前会话中记住接口能力。自定义代理不会收到 MiniMax 专属参数，但仍受通用输出过滤保护。
- **自动清理历史数据**：启动时会清理历史助手消息和压缩摘要中可确定识别的推理块，清空过去存储的推理字段，并删除旧版划词翻译缓存。用户消息不会被修改。
- **不再暴露原始响应**：如果供应商只返回推理内容，或返回无法识别且没有最终正文的响应，AIdea 会使用现有的“无响应”状态，不再显示原始 JSON 或模型内部输出。
- **完整回归验证**：已通过 421 项 TypeScript 测试、110 项 Python bridge 测试、生产构建、格式检查和 lint 检查。

本次更新没有新增设置、模式或可见控件，所有受支持供应商和输出路径都会自动应用过滤。

更新后请重启 Zotero。

已经写入笔记或生成 PDF 的历史推理内容不会被自动修改。如需干净版本，请重新创建笔记或重新翻译 PDF。

本次更新解决 #65 报告的推理内容泄露问题。不同模型的翻译风格仍可能存在差异，因此本次更新不承诺所有供应商都提供逐字翻译。
