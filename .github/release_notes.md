## ✨ What's Changed

- 📚 **Batch PDF translation.** Select several Zotero items and preview their jobs before submitting. The queue runs one job at a time, supports filling in missing outputs, and can resume after a Zotero restart. If a completed translation fails to attach, retry filing the existing output from the queue. ([Batch preview](https://github.com/Visterainer/aidea-zotero/commit/ce488c0), [persistent queue](https://github.com/Visterainer/aidea-zotero/commit/97712ec))
- 🌐 **Persian interface and translation.** AIdea includes a فارسی interface, Persian as a translation target, and right-to-left display for selection translations. Ordinary horizontal Persian paragraphs in exported PDFs support text search and copying in logical reading order. Rotated text and complex paragraphs with inline equations may retain the engine’s original layout and copy order. Thanks @farnam-k for requesting Persian support in [#110](https://github.com/Visterainer/aidea-zotero/issues/110).
- 🔄 **Verified r3 translation environment.** The new environment ships with `pdf2zh-next 2.10.2`, `BabelDOC 0.7.1`, and `PyMuPDF 1.28.2` through a verified dependency lock. The r2 catalog remains available for older plugin versions. ([#111](https://github.com/Visterainer/aidea-zotero/pull/111))
- 📄 **Scan orientation, PDF annotations, and table text.** Scanned pages are oriented before OCR. Cropped, rotated pages preserve the position of embedded highlights, underlines, and strikethroughs. Table fixes improve text fit and numeric copying. This release removes the reader’s **Copy as LaTeX** command. ([PDF handling](https://github.com/Visterainer/aidea-zotero/commit/fcf83fd), [table cell fix](https://github.com/Visterainer/aidea-zotero/commit/dc22047))
- 🛠️ **Safer retries and storage.** Improved PDF delivery retries and chat history handling after failures. Storage reconciliation also preserves personal notes and note attachments. ([Delivery and history fixes](https://github.com/Visterainer/aidea-zotero/commit/4a96103), [notes and attachments](https://github.com/Visterainer/aidea-zotero/commit/aa863b0))

## Validation and Compatibility

The translation environments passed checks on macOS, Windows, and Linux. We also tested full-PDF translation in Zotero using Codex OAuth, including a 30-page mixed PDF, the FactorMiner paper, and Persian monolingual and bilingual output. Checks included scan orientation, two-column layouts, formulas, copying table values, and queue recovery after a Zotero restart.

Declared compatibility is Zotero 7–10. To install manually, select **Tools → Plugins → Install Plugin From File**, choose `AIdea-4.0.2.xpi`, and restart Zotero. For full-PDF translation, select a model and install or update the translation environment in AIdea’s Translate tab. The environment installer supports macOS 13 or later, Linux with glibc 2.28 or later, and supported 64-bit Windows systems.

## 📝 更新内容

- 📚 **批量 PDF 翻译**。一次选中多个 Zotero 条目，提交前可预览任务。队列按顺序执行，可仅补齐缺少的译文，重启 Zotero 后可继续。译文已经生成但归档失败时，可在队列中重试归档已有文件。([批量预览](https://github.com/Visterainer/aidea-zotero/commit/ce488c0)、[持久化队列](https://github.com/Visterainer/aidea-zotero/commit/97712ec))
- 🌐 **波斯语界面与翻译**。新增 فارسی 界面和波斯语翻译目标，划词译文支持从右向左显示。导出 PDF 的普通横排波斯语段落支持搜索，并可按阅读顺序复制。旋转文字、含行内公式的复杂段落可能保留引擎的排版和复制顺序。感谢 @farnam-k 在 [#110](https://github.com/Visterainer/aidea-zotero/issues/110) 提出波斯语支持需求。
- 🔄 **已验证的 r3 翻译环境**。新版环境通过校验过的依赖锁安装 `pdf2zh-next 2.10.2`、`BabelDOC 0.7.1` 和 `PyMuPDF 1.28.2`。旧版插件仍可从 r2 目录安装翻译环境。([#111](https://github.com/Visterainer/aidea-zotero/pull/111))
- 📄 **扫描方向、PDF 批注与表格文字**。OCR 前自动纠正扫描方向，保留裁剪旋转页上内嵌高亮、下划线和删除线的位置，改进译文表格的文字排版和数值复制。本版移除阅读器中的「复制为 LaTeX」入口。([PDF 处理](https://github.com/Visterainer/aidea-zotero/commit/fcf83fd)、[表格单元格修复](https://github.com/Visterainer/aidea-zotero/commit/dc22047))
- 🛠️ **归档重试与数据保存**。改进 PDF 归档失败后的重试和异常情况下的聊天记录保存。核对本地数据时会保留个人笔记和笔记附件。([归档与聊天记录修复](https://github.com/Visterainer/aidea-zotero/commit/4a96103)、[笔记与附件修复](https://github.com/Visterainer/aidea-zotero/commit/aa863b0))

## 验证与兼容性

翻译环境已通过 macOS、Windows 和 Linux 验证。在 Zotero 中使用真实 Codex OAuth 完成了 30 页混合 PDF、FactorMiner 论文和波斯语单语及双语译文的验证，检查了扫描方向、双栏、公式、表格数值复制，以及 Zotero 重启后的队列恢复。

插件声明兼容 Zotero 7–10。手动安装时，通过 **工具 → 插件 → 从文件安装插件** 选择 `AIdea-4.0.2.xpi`，然后重启 Zotero。使用全文翻译前，请在 AIdea 翻译标签页选择模型并安装或更新翻译环境。环境安装器支持 macOS 13 或以上、使用 glibc 2.28 或以上的 Linux，以及受支持的 64 位 Windows 系统。
