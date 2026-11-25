<p align="center">
  <img src="addon/content/icons/icon-96.png" alt="AIdea Logo" width="80" />
</p>

<h1 align="center">AIdea</h1>

<p align="center">
  <a href="./README.md">English</a>
  ·
  <a href="./doc/readme/README.zh-CN.md">简体中文</a>
  ·
  <a href="./doc/readme/README.zh-TW.md">繁體中文</a>
  ·
  <a href="./doc/readme/README.ja.md">日本語</a>
  ·
  <a href="./doc/readme/README.ko.md">한국어</a>
  ·
  <a href="./doc/readme/README.fr.md">Français</a>
</p>

<p align="center">
  <a href="https://visterainer.github.io/aidea-zotero/">Project website</a> · <a href="https://visterainer.github.io/aidea-zotero/guide/">User guide</a> · <a href="https://github.com/Visterainer/aidea-zotero/releases/latest">Download</a>
</p>

**AIdea is a free, open-source reading assistant for Zotero 7–10.** Ask about a passage in a PDF or EPUB, follow a citation back to the source, and keep the explanation in a note attached to the paper.

## Read PDFs and EPUBs

In [Attention Is All You Need](https://arxiv.org/html/1706.03762v7#S3.SS2.SSS1) by Vaswani et al., ask “Why does section 3.2.1 divide the dot products by √dₖ?” Figure 2 and equation (1) show where the scaling takes place, and the text explains how it helps avoid very small softmax gradients. When an answer includes a location, its citation opens the PDF page or EPUB chapter. Add a second paper with `@` to compare methods or findings in the same conversation.

Shortcuts can summarize key points, methods, or limitations. Attach a screenshot to ask about a figure. Answers support Markdown, tables, code, and LaTeX math, and can be saved as Zotero notes.

<p align="center">
  <a href="site/public/media/reader/chat-en-US.jpg"><img src="site/public/media/reader/chat-en-US.jpg" alt="Figure 2 and equation (1) alongside a question about scaling. The chat and selection screenshots use local demo responses in Simplified Chinese." width="1400" /></a>
  <br/><em>Figure 2 and equation (1) alongside a question about scaling. The chat and selection screenshots use local demo responses in Simplified Chinese.</em>
</p>

## Translate and annotate passages

Select a term or paragraph in a PDF or EPUB to read its translation alongside the source. Save the translation to a note, or keep it as the comment on a new highlight. Reopen the highlight to read it later.

<p align="center">
  <a href="site/public/media/reader/selection-en-US.jpg"><img src="site/public/media/reader/selection-en-US.jpg" alt="The English term “Scaled Dot-Product Attention” is translated as “缩放点积注意力”. The popup can save it to a note or a highlight." width="1400" /></a>
  <br/><em>The English term “Scaled Dot-Product Attention” is translated as “缩放点积注意力”. The popup can save it to a note or a highlight.</em>
</p>

## Translate one PDF or a batch

Export a **translated-only PDF** or a **bilingual PDF** as a Zotero attachment or a file in a folder. The PDF workflow corrects scan orientation before OCR and improves how translated table text fits and numeric values copy.

Review multiple papers before starting a batch. By default the queue fills missing formats and destinations, preserving existing annotated translations. It can resume after a Zotero restart. If a translation was generated but filing failed, retrying delivery reuses the finished file.

<p align="center">
  <a href="site/public/media/reader/translation-en-US.jpg"><img src="site/public/media/reader/translation-en-US.jpg" alt="The NeurIPS and arXiv versions of the same paper in the batch list." width="1400" /></a>
  <br/><em>The NeurIPS and arXiv versions of the same paper in the batch list.</em>
</p>

<p align="center">
  <a href="doc/screenshots/translate_example_table.png"><img src="doc/screenshots/translate_example_table.png" alt="English on the left and Simplified Chinese on the right. Table 1 on page 6 compares the computational complexity of different layer types." width="1400" /></a>
  <br/><em>English on the left and Simplified Chinese on the right. Table 1 on page 6 compares the computational complexity of different layer types.</em>
</p>

<p align="center">
  <a href="site/public/media/factorminer-figure-1-en-zh.png"><img src="site/public/media/factorminer-figure-1-en-zh.png" alt="FactorMiner Figure 1, with the English architecture diagram on the left and its Simplified Chinese translation on the right" width="1400" /></a>
  <br/><em>Full-text translation also covers labels inside architecture diagrams. In Figure 1 of FactorMiner, follow the blue arrows from “Memory Retrieval” to “Library Update” in the English original on the left. The same steps are labeled “记忆检索” and “库更新” in the Simplified Chinese translation on the right.</em>
</p>

## Keep and move conversations

Export **one conversation, all conversations for a paper, or a whole library’s conversations**. JSON preserves text and citations. ZIP can also include screenshots and uploaded files. Import merges new messages and preserves branches. Zotero syncs paper originals separately, so citations can reopen matching source files on another device.

<p align="center">
  <a href="site/public/media/reader/export-en-US.jpg"><img src="site/public/media/reader/export-en-US.jpg" alt="The chat menu offers three export scopes and an archive import action" width="1400" /></a>
  <br/><em>The chat menu offers three export scopes and an archive import action</em>
</p>

## Corresponding author profiles

Generate profiles for one or more papers using the paper and public scholarly records. Each profile is saved as a Zotero note under its paper and includes sources to check. Regenerating a profile updates its existing AIdea profile note.

## Models and languages

AIdea supports ChatGPT and GitHub Copilot accounts, OpenAI-compatible APIs, and local models served by tools such as Ollama and LM Studio. Models that expose reasoning levels can use different levels for chat, passage translation, and full-PDF translation. History and library-specific memory are stored locally. The selected model service processes the content needed for each request.

The interface is available in 13 languages. The translation target can be chosen independently.

---

[AGPL-3.0-or-later](LICENSE) · Based on [llm-for-zotero](https://github.com/yilewang/llm-for-zotero) (Yile Wang) · [Third-party notices](THIRD_PARTY_NOTICES.md)
