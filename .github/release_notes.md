## ✨ What's Changed

- 💬 **More natural, task-focused answers**: Updated the default chat prompt to answer simple questions directly and retain necessary reasoning, evidence, and assumptions for complex analysis. Document-based answers should distinguish available source material from inference and avoid claiming access to unavailable pages or figures. Thanks @siyuanj for the feedback in [#81](https://github.com/Visterainer/aidea-zotero/issues/81).
- ⚙️ **Custom response style**: Adjust responses under **Settings → Advanced → Custom System Prompt**. Leave it blank to use the defaults; a non-empty prompt replaces the default chat instructions. Existing custom prompts are preserved. Changes apply to the next request without restarting Zotero; start a new conversation for a clean comparison.
- 🧩 **Independent internal-task prompts**: Selection translation, cold-start summaries, conversation compaction, and author profiles now use dedicated prompts, unaffected by custom chat instructions. Full-document translation retains its own configuration.
- 🔢 **Fixed numeric inline math**: Fixed formulas such as `$9$`, `$0$`, and `$9.5$` displaying as raw text. Improved delimiter matching, ordinary currency handling, code protection, and streaming updates. Chat rendering and note HTML use consistent formula-recognition rules.
- 🔧 **Dependency updates**: Integrated the dependency updates from [#80](https://github.com/Visterainer/aidea-zotero/pull/80), including KaTeX 0.18.5 and build-tool updates. Added matching resource checks and formula regression tests. Thanks [Dependabot](https://github.com/apps/dependabot) for the update PR.
- 🛡️ **Retained long-document fallback**: Kept the selection-translation improvements from v3.5.0–v3.5.1. Input-length failures trigger progressively smaller cold-start context retries: full text, 50%, 25%, 15%, 10%, and 5%. If all tiers remain too long, only the selected text is translated, and repeated cold starts for the same document/model are skipped for 30 minutes. Thanks @Aaaanano for reporting [#79](https://github.com/Visterainer/aidea-zotero/issues/79).
- 💾 **Retained annotations and remembered choices**: **Write translation to annotation** remembers both enabling and disabling across selections, documents, and Zotero restarts. When enabled, wait for translation to finish before choosing a highlight color. Translation is appended without overwriting existing comments.
- 🌐 **Localized update notice and documentation**: Updated the one-time notice in all 12 interface languages, retaining the recent translation guidance. Updated settings help in all 12 languages and the English and Chinese READMEs.

## ✅ Compatibility and Validation

- Compatible with Zotero 7–10 (`strict_min_version: 6.999`, `strict_max_version: 10.0.*`).
- Passed 548 TypeScript unit tests, 110 Python bridge checks, Prettier, ESLint, the plugin/TypeScript build, and the 12-page website build.
- Verified the latest candidate on Windows with Zotero 8.0.3: installation, full restart, restored chat history and numeric formulas, update-notice layout, and no repeated notice after restart.
- Completed a 48-request, small-sample comparison of the old and new prompts using `gpt-5.6-luna`. This was not a GPT-5.4 versus GPT-5.6 capability comparison or a guarantee of faster responses.

## 📦 Installation

Download `AIdea-3.5.2.xpi`, then select:

**Tools → Plugins → Gear icon → Install Plugin From File**

Restart Zotero after installation.

## ℹ️ Known Behavior

- This update does not restore unavailable models or change provider-side model availability. Response quality, latency, and occasional formatting errors can still vary.
- **Write translation to annotation** is off by default. Enabling or disabling it is remembered.
- Context shrinking applies to recognized input-length or request-size failures. Authentication, quota, model, parameter, and other provider errors remain visible.

---

## 📝 更新内容

- 💬 **默认回答更自然、更贴合问题**：简单问题直接回答，复杂分析保留必要的推导、证据和成立条件。针对文献的问题，明确区分已提供的材料与推断，避免声称看过未提供的页面或图像。感谢 @siyuanj 在 [#81](https://github.com/Visterainer/aidea-zotero/issues/81) 中反馈回答体验。
- ⚙️ **支持自定义回答风格**：可在 **设置 → 高级 → 自定义系统提示词** 中调整回答方式。留空使用默认规则；填写后替换默认对话提示词。已有自定义内容不会被覆盖，修改从下一次请求生效，无需重启 Zotero。建议新建对话进行对比，避免旧回答影响后续表现。
- 🧩 **内部任务使用独立提示词**：划词翻译、冷启动摘要、历史压缩和作者档案使用专用提示词，不受自定义对话指令影响。全文翻译仍使用自身配置。
- 🔢 **修复纯数字行内公式显示**：修复 `$9$`、`$0$`、`$9.5$` 等公式原样显示的问题，改进公式定界符配对、普通金额识别、代码保护和流式更新。聊天显示与笔记 HTML 使用一致的公式识别规则。
- 🔧 **依赖更新与配套验证**：纳入 [#80](https://github.com/Visterainer/aidea-zotero/pull/80) 的依赖更新，包括 KaTeX 0.18.5 和构建工具更新，并补充资源一致性检查及公式回归测试。感谢 [Dependabot](https://github.com/apps/dependabot) 提供更新 PR。
- 🛡️ **保留长文档自动兜底**：延续 v3.5.0–v3.5.1 的划词翻译改进。冷启动请求因输入过长失败时，依次使用全文、50%、25%、15%、10% 和 5% 的文档上下文重试；若仍然过长，则仅翻译选中文本，并在接下来的 30 分钟内跳过同一文档和模型的重复冷启动。感谢 @Aaaanano 在 [#79](https://github.com/Visterainer/aidea-zotero/issues/79) 中反馈问题。
- 💾 **保留标注功能及选项记忆**：“将译文写入标注”的勾选和取消状态会跨选区、跨文献保存，重启 Zotero 后仍然保持。开启后，等待翻译完成，再选择高亮颜色即可写入译文；已有批注采用追加方式，不会被覆盖。
- 🌐 **多语言弹窗与文档更新**：更新全部 12 种界面语言的一次性弹窗，并保留近期的划词翻译说明。同步更新 12 种语言的设置帮助及中英文 README。

## ✅ 兼容性与验证

- 支持 Zotero 7–10（`strict_min_version: 6.999`，`strict_max_version: 10.0.*`）。
- 548 项 TypeScript 单元测试、110 项 Python Bridge 检查、Prettier、ESLint、插件及 TypeScript 构建、12 页面网站构建均通过。
- 最新候选包已在 Windows / Zotero 8.0.3 中验证安装、完整重启、历史对话及数字公式恢复、更新弹窗排版，以及重启后不重复弹出。
- 使用 `gpt-5.6-luna` 完成新旧提示词共 48 次请求的小样本对照。这不是 GPT-5.4 与 GPT-5.6 的模型能力比较，也不构成稳定提速承诺。

## 📦 安装方法

下载 `AIdea-3.5.2.xpi`，然后依次选择：

**工具 → 插件 → 齿轮按钮 → 从文件安装插件**

安装完成后重启 Zotero。

## ℹ️ 使用说明

- 本次更新不恢复已不可用的模型，也不改变服务商侧的模型可用性。回答质量、延迟和偶发格式错误仍可能随模型及服务状态变化。
- “将译文写入标注”默认关闭，勾选和取消状态都会保存。
- 只有被识别为输入长度或请求体过大的错误才触发上下文缩减；身份验证、额度、模型、参数及其他服务商错误仍会正常显示。
