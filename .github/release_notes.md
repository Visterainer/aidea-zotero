## What's Changed

- **Selection translation interaction**: translation results can now be selected with the mouse. Ctrl/Cmd+C copies the selected portion, while Ctrl/Cmd+A selects only the translation result. Dedicated Copy and Add to Note actions and clearer selection feedback have also been added. Thanks @Buhaoran0307 for the suggestion and follow-up feedback in #51.
- **Popup sizing and position stability**: the selection translation popup can be resized from the lower-right corner and remembers the manually adjusted width and height limit. Short results remain compact, long results use the saved height, and clicking Copy or Add to Note no longer causes the popup to jump.
- **Streaming response fixes**: selection translation now supports streaming output, and chat replies once again appear progressively instead of waiting until generation finishes. Late queued updates are also rejected after completion to prevent stale or duplicate rendering. Thanks @siyuanj for the detailed regression analysis and transport-layer evidence in #52.
- **Codex OAuth model compatibility**: improved Codex OAuth request routing and fixed the `Model not found` error for `gpt-5.6-luna`. `gpt-5.6-sol`, `gpt-5.6-terra`, and `gpt-5.6-luna` are now supported. Before using them, update the environment from `Setting → Model Config → OAuth Providers → ChatGPT (Codex OAuth) → Install/Update Env`.
- **Settings and localization**: added separate settings for showing the Copy and Add to Note buttons. Popup actions, settings labels, long-language layouts, and RTL display are supported across all 12 interface languages.

## 更新内容

- **划词翻译交互**：翻译结果现在支持鼠标划选。Ctrl/Cmd+C 可以复制选中的部分，Ctrl/Cmd+A 只会全选翻译结果；同时新增完整译文“复制”和“添加到笔记”操作，并优化划选后的边界反馈。感谢 @Buhaoran0307 在 #51 中提出建议并持续提供反馈。
- **弹窗尺寸与位置稳定性**：划词翻译弹窗支持从右下角拖动调整尺寸，并记住用户手动设置的宽度和高度上限。短内容会自动贴紧，长内容会采用保存的高度；点击“复制”或“添加到笔记”后，弹窗位置也不会再发生跳动。
- **流式输出修复**：划词翻译现已支持流式输出，同时恢复对话回答生成过程中的逐步显示，无需等待生成完成后才一次性出现。回答完成后也会拒绝迟到的排队更新，避免旧内容或重复内容再次渲染。感谢 @siyuanj 在 #52 中提供详细的回归分析与传输层证据。
- **Codex OAuth 模型兼容性**：优化 Codex OAuth 请求路由，并修复 `gpt-5.6-luna` 的 `Model not found` 错误。目前已支持 `gpt-5.6-sol`、`gpt-5.6-terra` 和 `gpt-5.6-luna`。使用前请前往 `设置 → 模型配置 → OAuth 提供商 → ChatGPT (Codex OAuth) → 安装/更新环境`。
- **设置与多语言**：新增“复制”和“添加到笔记”按钮的独立显示设置，并补齐全部 12 种界面语言的弹窗操作、设置文案、长标签布局和 RTL 显示适配。
