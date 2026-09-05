## ✨ What's Changed

This patch remembers the annotation checkbox choice and includes the selection-translation improvements introduced in v3.5.0.

- 💾 **Remembered annotation choice — new in v3.5.1**: The **Write translation to annotation** checkbox now remembers both enabling and disabling across selections, documents, and Zotero restarts. When enabled, each completed translation is automatically prepared for the next highlight, so choosing a color is enough to save it. The option is off by default, and a failed translation does not reset the saved choice. Thanks @Aaaanano for the follow-up feedback in #79.
- 🛡️ **Automatic fallback for long PDFs**: When a PDF cold-start request is rejected because the input is too long, AIdea automatically retries with progressively smaller document context: full text, 50%, 25%, 15%, 10%, and 5%. If every tier is still too long, it translates the selected text only and skips repeated cold starts for the same document/model for 30 minutes. Thanks @Aaaanano for reporting #79.
- 📝 **Translations in Zotero highlight annotations**: After selection translation finishes, enable **Write translation to annotation** before choosing a highlight color. AIdea writes the translation into the new annotation comment and appends it instead of overwriting existing comment text.
- 🌐 **One-time localized update notice**: The v3.5.1 notice retains the v3.5.0 retry and annotation guidance and adds the remembered checkbox behavior in all 12 interface languages. It is shown once after upgrading to this version.
- 📚 **Documentation**: Updated the English and Chinese READMEs and all localized website selection-translation sections with the remembered checkbox behavior.

## ✅ Compatibility and Validation

- Compatible with Zotero 7–10 (`strict_min_version: 6.999`, `strict_max_version: 10.0.*`).
- Passed 466 TypeScript unit tests and 110 Python bridge tests. New regression coverage checks default-off behavior, automatic writing on subsequent selections, restoring the choice after recreating runtime state, remembering disabling, and retaining the choice after a failed translation.
- Passed Prettier, ESLint, TypeScript/plugin build, and the 12-page website build.
- The v3.5.0 XPI was previously installed and tested on Zotero 8.0.3 for selection translation and translation-to-highlight annotation. The #79 reporter also confirmed successful GPT-4o translation of the previously failing long 3GPP PDF and preservation of both the original text and translation in annotations.

## 📦 Installation

Download `AIdea-3.5.1.xpi`, then open Zotero and select:

**Tools → Plugins → Gear icon → Install Plugin From File**

Restart Zotero after installation.

## ℹ️ Known Behavior

- Context shrinking is triggered only for errors classified as input-length or request-size failures. Authentication, quota, model, parameter, and other provider errors remain visible.
- **Write translation to annotation** is off by default. Enabling or disabling it is remembered; when enabled, wait for the translation to finish before choosing a highlight color.

---

## ✨ 本次更新

本补丁版新增标注选项记忆，并包含 v3.5.0 引入的划词翻译改进。

- 💾 **记住标注选项——v3.5.1 新增**：“将译文写入标注”现在会记住勾选和取消状态，后续划词、切换文献及重启 Zotero 后仍然保持。开启后，每次翻译完成都会自动准备当前译文，直接选择高亮颜色即可写入。该选项默认关闭，某次翻译失败不会重置保存的选择。感谢 @Aaaanano 在 #79 中继续反馈使用体验。
- 🛡️ **长文档自动降级重试**：当 PDF 冷启动请求因输入过长而被模型拒绝时，AIdea 会依次使用全文、50%、25%、15%、10% 和 5% 的文档上下文自动重试。如果所有层级仍然过长，则直接使用划选文本完成翻译，并在接下来的 30 分钟内跳过同一文档和模型的重复冷启动。感谢 @Aaaanano 在 #79 中反馈这个问题。
- 📝 **将译文写入 Zotero 高亮标注**：划词翻译完成后，可以先勾选“将译文写入标注”，再选择上方的高亮颜色。AIdea 会把译文写入新建标注的批注内容；如果标注已经存在批注内容，则追加译文，不会覆盖原内容。
- 🌐 **一次性多语言更新说明**：v3.5.1 更新弹窗保留 v3.5.0 的自动重试及标注使用说明，并在全部 12 种界面语言中补充勾选状态记忆。升级到本版本后显示一次。
- 📚 **文档更新**：同步更新英文、中文 README，以及网站全部语言版本中的划词翻译说明，补充勾选状态记忆的使用方式。

## ✅ 兼容性与验证

- 支持 Zotero 7–10（`strict_min_version: 6.999`，`strict_max_version: 10.0.*`）。
- 466 项 TypeScript 单元测试和 110 项 Python Bridge 测试全部通过。新增回归测试覆盖默认关闭、后续划词自动写入、重新创建运行状态后恢复选择、记住取消勾选，以及翻译失败后保留偏好。
- Prettier、ESLint、TypeScript/插件构建以及包含 12 个页面的网站构建全部通过。
- 上一版 v3.5.0 XPI 已在 Zotero 8.0.3 中完成划词翻译及译文写入高亮标注的实机验证。#79 反馈者也已确认，GPT-4o 可正常翻译此前报错的长 3GPP 协议 PDF，标注能够同时保留原文和译文。

## 📦 安装方法

下载 `AIdea-3.5.1.xpi`，然后在 Zotero 中依次选择：

**工具 → 插件 → 齿轮按钮 → 从文件安装插件**

安装完成后重启 Zotero。

## ℹ️ 使用说明

- 只有被识别为输入长度或请求体过大的错误才会触发上下文缩减重试；身份验证、额度、模型、参数及其他服务商错误仍会正常显示。
- “将译文写入标注”默认关闭。勾选或取消都会记住；开启后，请等待翻译完成，再选择高亮颜色。
