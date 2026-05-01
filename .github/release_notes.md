## What's Changed

- **Selection translation in the PDF reader**: translate highlighted text directly from Zotero's reader selection popup, with a dedicated enable switch, model picker, source language, and target language.
- **Paper cold-start cache**: the first selection translation for a paper builds a local compact overview and terminology cache, then reuses it as context for later selections.
- **Better selection popup layout**: the translation result panel now dynamically sizes and repositions itself around the selected text to reduce covering the original passage.
- **Save translations to Zotero notes**: translated selections can be added back to the current item's AIdea selection translation note.
- **Settings and persistence updates**: selection translation settings are grouped separately, include cache cleanup, and preserve panel section state across Zotero restarts.
- **Original-quality generated image export**: generated images in chat can be exported through a filesystem picker without re-encoding.
- **Documentation and website refresh**: README files, multilingual docs, third-party notices, screenshots, and the project website now describe the selection translation workflow.

## 更新内容

- **PDF 阅读器划词翻译**：在 Zotero 阅读器划词弹窗中直接翻译选中文本，并支持独立开关、独立模型选择、源语言和目标语言设置。
- **论文冷启动缓存**：某篇文献首次使用划词翻译时，会在本地生成文章精简概述和专业术语缓存，后续划词翻译复用这份上下文。
- **更好的划词弹窗布局**：译文窗口会根据选中文本和阅读器视口动态调整大小与位置，尽量减少遮挡原文。
- **译文加入 Zotero 笔记**：划词翻译结果可以直接写回当前文献的 AIdea 划词翻译笔记。
- **设置与状态持久化**：划词翻译拥有单独设置分组，支持清理冷启动缓存，并保留设置面板折叠状态。
- **原画质生成图片导出**：对话中生成的图片可以通过文件系统选择器导出原始图片字节，不重新编码。
- **文档与网站更新**：README、多语言文档、第三方声明、截图和项目网站均已补充划词翻译说明。
