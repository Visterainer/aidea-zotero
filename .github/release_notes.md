## ✨ What's Changed

- 🛡️ **Automatic fallback for long PDFs**: When a PDF cold-start request is rejected because the input is too long, AIdea automatically retries with progressively smaller document context: full text, 50%, 25%, 15%, 10%, and 5%. If every tier is still too long, it translates the selected text only and skips repeated cold starts for the same document/model for 30 minutes. Thanks @Aaaanano for reporting #79.
- 📝 **Translations in Zotero highlight annotations**: After selection translation finishes, enable **Write translation to annotation** before choosing a highlight color. AIdea writes the translation into the new annotation comment and appends it instead of overwriting existing comment text.
- 🌐 **One-time localized update notice**: Added a once-per-version explanation of the retry and annotation workflow in all 12 interface languages.
- 📚 **Documentation**: Updated the English and Chinese READMEs and all localized website selection-translation sections.

## ✅ Compatibility and Validation

- Compatible with Zotero 7–10 (`strict_min_version: 6.999`, `strict_max_version: 10.0.*`).
- Passed 460 TypeScript unit tests and 110 Python bridge tests.
- Passed Prettier, ESLint, TypeScript/plugin build, and the 12-page website build.
- The packaged XPI was locally installed and tested on Zotero 8.0.3, covering version display, the one-time update notice, restart non-repeat, selection translation, and translation-to-highlight annotation.

## 📦 Installation

Download `AIdea-3.5.0.xpi`, then open Zotero and select:

**Tools → Plugins → Gear icon → Install Plugin From File**

Restart Zotero after installation.

## ℹ️ Known Behavior

- Context shrinking is triggered only for errors classified as input-length or request-size failures. Authentication, quota, model, parameter, and other provider errors remain visible.
- **Write translation to annotation** applies only to the current selection and must be enabled before choosing a highlight color.

---

## ✨ 本次更新

- 🛡️ **长文档自动降级重试**：当 PDF 冷启动请求因输入过长而被模型拒绝时，AIdea 会依次使用全文、50%、25%、15%、10% 和 5% 的文档上下文自动重试。如果所有层级仍然过长，则直接使用划选文本完成翻译，并在接下来的 30 分钟内跳过同一文档和模型的重复冷启动。感谢 @Aaaanano 在 #79 中反馈这个问题。
- 📝 **将译文写入 Zotero 高亮标注**：划词翻译完成后，可以先勾选“将译文写入标注”，再选择上方的高亮颜色。AIdea 会把译文写入新建标注的批注内容；如果标注已经存在批注内容，则追加译文，不会覆盖原内容。
- 🌐 **一次性多语言更新说明**：新增覆盖全部 12 种界面语言的版本更新弹窗，每个版本仅显示一次，用于说明自动重试和译文写入标注的使用方法。
- 📚 **文档更新**：同步更新英文、中文 README，以及网站全部语言版本中的划词翻译说明。

## ✅ 兼容性与验证

- 支持 Zotero 7–10（`strict_min_version: 6.999`，`strict_max_version: 10.0.*`）。
- 460 项 TypeScript 单元测试和 110 项 Python Bridge 测试全部通过。
- Prettier、ESLint、TypeScript/插件构建以及包含 12 个页面的网站构建全部通过。
- 已在 Zotero 8.0.3 中安装并实测候选 XPI，覆盖版本显示、一次性更新弹窗、重启后不重复显示、划词翻译以及译文自动写入高亮标注。

## 📦 安装方法

下载 `AIdea-3.5.0.xpi`，然后在 Zotero 中依次选择：

**工具 → 插件 → 齿轮按钮 → 从文件安装插件**

安装完成后重启 Zotero。

## ℹ️ 使用说明

- 只有被识别为输入长度或请求体过大的错误才会触发上下文缩减重试；身份验证、额度、模型、参数及其他服务商错误仍会正常显示。
- “将译文写入标注”仅对当前这次划词有效，必须在选择高亮颜色之前勾选。
