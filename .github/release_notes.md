## ✨ What's Changed

- 💡 **Reasoning effort controls**: Configure chat, full-document translation, and selection translation independently. A colored bulb beside the chat model selector indicates effort. Switching models preserves your saved choice; unsupported levels resolve to a supported level with an explanatory hint. Thanks @jbq8814-lab for suggesting [#101](https://github.com/Visterainer/aidea-zotero/issues/101), implemented by @Visterainer in [#103](https://github.com/Visterainer/aidea-zotero/pull/103).
- 🎛️ **Model-specific capabilities**: Codex OAuth and API key connections use capability information returned by the model service instead of a fixed three-level menu. Missing or unsupported capabilities disable the control while ordinary requests remain available. Explicit rejection of the effort parameter triggers a retry without it.
- ⚡ **Selection translation guidance**: Adds localized guidance recommending the lowest reasoning effort for faster translation, usually with little impact on accuracy.
- 🔧 **Token parameter compatibility**: Fixes chat and full-document translation failures caused by models requiring `max_completion_tokens` instead of `max_tokens`. Thanks @wintermydream for reporting [#100](https://github.com/Visterainer/aidea-zotero/issues/100).
- 📦 **Dependency maintenance**: Updates six dependencies, including KaTeX 0.19.0, and synchronizes the bundled stylesheet. Thanks @dependabot[bot] for [#97](https://github.com/Visterainer/aidea-zotero/pull/97), with the stylesheet follow-up by @Visterainer.

## Validation and Compatibility

755 TypeScript tests, 217 Python checks, and 4 native Zotero tests passed, along with type checking, lint, formatting, and production build checks. One Windows-only test was skipped on macOS.

Declared compatibility: Zotero 7–10. Install `AIdea-3.7.0.xpi` through **Tools → Plugins → Install Plugin From File**, then restart Zotero.

API effort selection requires explicit capability metadata from the service. If the service does not return it, the control remains disabled even if the model supports reasoning. Refresh the model list to retrieve updated capabilities. Transport tests use simulated upstream responses; they do not establish compatibility with every live provider.

## 📝 更新内容

- 💡 **思考强度控制**：聊天、全文翻译和划词翻译可分别设置思考强度。聊天模型旁新增彩色灯泡按钮；切换模型保留已选设置，不支持该档位时使用支持的档位并显示提示。感谢 @jbq8814-lab 在 [#101](https://github.com/Visterainer/aidea-zotero/issues/101) 中提出建议，由 @Visterainer 在 [#103](https://github.com/Visterainer/aidea-zotero/pull/103) 中实现。
- 🎛️ **按模型显示支持范围**：Codex OAuth 和 API Key 接入依据模型服务返回的能力显示档位，不再固定为三档。无法获取能力或不支持时，控件置灰，普通请求仍可正常使用。接口明确拒绝强度参数时，自动移除该参数后重试。
- ⚡ **划词翻译速度建议**：新增适配界面语言的说明，建议使用最低推理强度以加快翻译，通常对翻译准确性的影响较小。
- 🔧 **Token 参数兼容修复**：修复部分模型要求使用 `max_completion_tokens`、不接受 `max_tokens` 而导致聊天或全文翻译失败的问题。感谢 @wintermydream 在 [#100](https://github.com/Visterainer/aidea-zotero/issues/100) 中报告问题。
- 📦 **依赖维护**：更新包括 KaTeX 0.19.0 在内的六项依赖，并同步内置样式。感谢 @dependabot[bot] 提交 [#97](https://github.com/Visterainer/aidea-zotero/pull/97)，由 @Visterainer 补齐样式同步修复。

## 验证与兼容性

755 项 TypeScript 测试、217 项 Python 检查、4 项 Zotero 原生测试，以及类型检查、代码规范、格式检查和正式构建通过。1 项 Windows 专用测试在 macOS 上跳过。

声明兼容 Zotero 7–10。通过 **工具 → 插件 → 从文件安装插件** 安装 `AIdea-3.7.0.xpi`，然后重启 Zotero。

API 思考强度选择依赖服务端明确返回能力信息。服务端未返回时，即使模型本身具有推理能力，控件也会保持置灰；可刷新模型列表获取最新信息。接口测试使用模拟响应，不代表所有真实服务商均已逐一验证。
