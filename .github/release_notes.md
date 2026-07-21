## What's Changed

- **Codex OAuth full-document translation reliability**: fixed full-document PDF translation failures on Windows caused by local loopback requests being routed through the system proxy. Temporary HTTP 502 and SSL EOF failures now use an extended Codex OAuth retry window, while non-retryable request errors still fail immediately. Thanks @qinyue021 for the detailed report and diagnostic logs in #60.
- **Accurate output, status, and progress**: only translated PDFs created or actually updated during the current run are treated as valid output. If no new PDF is generated, AIdea now reports a clear failure reason and full log location instead of displaying “Translation complete.” Rich log timestamps are also no longer misidentified as page progress.
- **Streaming Markdown layout**: fixed extra blank lines appearing between Markdown paragraphs while an answer is being generated, keeping the layout consistent during and after streaming. Thanks @siyuanj for the contribution in #59.
- **Development tooling maintenance**: updated ESLint, Prettier, and tsx to their latest compatible non-major versions through #56.

After updating, restart Zotero before testing the new behavior. The full-document translation environment does not need to be reinstalled or updated.

## 更新内容

- **Codex OAuth 全文翻译可靠性**：修复 Windows 系统代理错误转发本地回环请求时，Codex OAuth 全文 PDF 翻译失败的问题。针对临时 HTTP 502 和 SSL EOF 故障延长了 Codex OAuth 专用重试窗口，不可重试的请求错误仍会立即失败。感谢 @qinyue021 在 #60 中提供详细的问题报告和诊断日志。
- **产物、状态与进度更准确**：只有本次任务中新建或实际更新的翻译 PDF 才会被识别为有效产物。如果没有生成新 PDF，AIdea 会显示明确的失败原因和完整日志位置，不再错误显示“翻译完成”。Rich 日志时间戳也不再被误识别为页码进度。
- **流式 Markdown 排版修复**：修复回答生成过程中 Markdown 段落之间出现额外空行的问题，使流式生成期间和完成后的排版保持一致。感谢 @siyuanj 在 #59 中提交修复。
- **开发工具维护**：通过 #56 更新 ESLint、Prettier 和 tsx 的兼容非主版本。

更新后请重启 Zotero，再测试相关功能。本次修复不需要重新安装或更新全文翻译环境。
