## What's Changed

- **Library sidebar selection fix**: completed the follow-up fix for #38. When multiple items are selected in the Zotero Library, Zotero's native "N items selected" message is now preserved instead of being covered by AIdea. Single-item selection continues to use Zotero's native item pane sections, so Info, Attachments, Notes, Tags, Related, and AIdea can be switched and scrolled normally. Thanks @N3xed for the original report and @informalgit for identifying and verifying the multi-select regression.
- **Library panel alignment and stability**: improved the standalone AIdea panel placement for empty and multi-item Library selections, fixed sidebar icon alignment, and reduced unnecessary pane refreshes to avoid flicker.
- **Selection translation cold-start improvements**: improved first-use context preparation for long papers in #39. AIdea now reduces interference from reference lists, prepares context independently for each paper, and automatically retries with a smaller context when the model reports an input-length limit. Thanks @Buhaoran0307 for the detailed report and example papers.
- **Simpler selection translation settings**: removed the manual cold-start complexity selector. Context sizing is now handled automatically per paper, so users do not need to choose between complexity modes.
- **Update notice refresh**: updated the one-time update notice to explain the Library sidebar and selection translation improvements in user-facing language.
- **Diagnostics and tests**: added focused tests for selection-translation cold-start context building and fallback behavior, and verified the Library/sidebar package build.

## 更新内容

- **文库侧栏选择修复**：完成 #38 的后续修复。在 Zotero Library 中多选条目时，现在会保留 Zotero 原生的“已选择 N 个条目”提示，不再被 AIdea 覆盖。单选条目时仍使用 Zotero 原生条目详情面板，信息、附件、笔记、标签、相关和 AIdea 区域可以正常切换和滚动。感谢 @N3xed 提供最初的问题报告，也感谢 @informalgit 发现并验证多选回归问题。
- **文库面板对齐与稳定性优化**：优化空选和多选状态下 AIdea 独立面板的显示位置，修复侧栏图标对齐问题，并减少不必要的面板刷新，降低页面闪动。
- **划词翻译冷启动优化**：改进 #39 中长论文首次划词翻译可能失败的问题。AIdea 会减少参考文献部分对上下文的干扰，并按每篇文献独立准备上下文；当模型返回输入过长错误时，会自动缩小上下文范围后重试。感谢 @Buhaoran0307 提供详细反馈和示例论文。
- **划词翻译设置简化**：移除手动冷启动复杂度选择。上下文范围现在会按每篇文献自动处理，用户无需再手动选择复杂度档位。
- **更新提示刷新**：更新插件升级后的一次性提示面板，用更面向用户的语言说明文库侧栏和划词翻译体验改进。
- **诊断与测试**：新增划词翻译冷启动上下文构建和自动回退相关测试，并完成文库侧栏相关构建验证。
