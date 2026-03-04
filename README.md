<p align="center">
  <img src="addon/content/icons/icon-96.png" alt="AIdea Logo" width="80" />
</p>

<h1 align="center">AIdea</h1>

<p align="center">
  <strong>A free, open-source AI assistant plugin for Zotero 7</strong>
</p>

<p align="center">
  <a href="./README_CN.md">🇨🇳 中文版</a> &nbsp;|&nbsp;
  <a href="#features">Features</a> &nbsp;|&nbsp;
  <a href="#installation">Installation</a> &nbsp;|&nbsp;
  <a href="#getting-started">Getting Started</a> &nbsp;|&nbsp;
  <a href="#license">License</a>
</p>

---

## ✨ Features

### 💬 AI Chat in Side Panel
Chat with AI directly in Zotero's side panel — available in both the **Library** view and the **PDF Reader**. Ask questions, get summaries, and interact with your research seamlessly.

<p align="center">
  <img src="doc/screenshots/chat_en.png" alt="Side panel chat" width="800" />
</p>

### 📄 Paper-Aware Context
Select text in the PDF reader and click **"Add Text"** to attach the selected passage to the context area. The AI will use it as reference when answering your questions — enabling precise, passage-level Q&A.

<p align="center">
  <img src="doc/screenshots/add_text.png" alt="Add Text popup" width="500" />
</p>

### ⚡ Quick Action Shortcuts
One-click shortcut buttons for common tasks like **Summarize**, **Explain**, **Translate**, and more. Fully customizable — add, edit, reorder, or remove shortcuts to fit your workflow.

### 🖼️ Multimodal Support
Attach images (screenshots, figures, charts) to your messages. Drag & drop, paste from clipboard, or use the screenshot tool to capture content directly from your PDFs.

### 🔐 OAuth Login (No API Key Required)
Sign in with your OpenAI account via OAuth — no need to manage API keys manually. The plugin leverages the Codex CLI OAuth flow for seamless authentication.

### 🌐 Multi-Provider Support
- **OpenAI (ChatGPT)** — Full support via Codex OAuth
- **Google Gemini** — Coming soon

### 📝 Note Export
Save AI responses as Zotero notes with one click. Responses are formatted in Markdown with full LaTeX math rendering support.

### 💾 Persistent Chat History
All conversations are saved locally in Zotero's database. Switch between multiple conversations, continue where you left off, and manage your chat history.

### 🧠 Memory System
The AI automatically captures and recalls important information across conversations, enabling personalized, context-aware responses that improve over time.

- **Auto-Capture** — detects user preferences, decisions, facts, and key entities from natural conversation (e.g., "I prefer concise answers", "My research focuses on NLP")
- **Per-Library Isolation** — memories are scoped to each Zotero library, keeping different research projects separate
- **Smart Deduplication** — uses Jaccard token similarity (≥90% threshold) to prevent storing redundant memories
- **Relevance-Ranked Retrieval** — multi-factor scoring (token overlap × 0.65 + substring boost + recency × 0.15 + importance × 0.20) ensures the most relevant memories surface
- **Prompt Injection Defense** — built-in pattern detection prevents malicious content from being stored in memory
- **Fully Local** — all memories are stored in Zotero's SQLite database; nothing is sent to external servers

### 🎨 Rich Rendering
- Full **Markdown** rendering (headings, lists, code blocks, tables)
- **LaTeX** math formula support (powered by KaTeX)
- **Syntax highlighting** for code blocks
- Smooth **streaming** responses

### 🌍 Bilingual Interface
Full support for **English** and **Chinese** (中文) — switch languages in settings at any time.

---

## 📦 Installation

### Requirements
- **Zotero 7** (version 7.0+)
- **Node.js** (v18+) — required for the OAuth CLI tools

### Install the Plugin

1. Download the latest `AIdea-x.x.x.xpi` from [Releases](https://github.com/Visterainer/aidea-zotero/releases)
2. In Zotero, go to **Tools → Add-ons**
3. Click the gear icon ⚙️ → **Install Add-on From File...**
4. Select the downloaded `.xpi` file
5. Restart Zotero

### Upgrade
Simply install the new `.xpi` file — it will automatically replace the old version. **All your chat history and settings are preserved.**

---

## 🚀 Getting Started

### 1. Open Settings
Go to **Tools → Add-ons → AIdea → Settings** (or **Edit → Settings → AIdea**)

<p align="center">
  <img src="doc/screenshots/settings_en.png" alt="Settings page" width="600" />
</p>

### 2. Auto Configure Environment
Click **"Auto Configure Environment"** to automatically install the required CLI tools. A risk notice will appear on the first run — read it carefully and confirm to proceed.

### 3. OAuth Login
Click **"OAuth Login"** on the OpenAI card. Your browser will open for authentication. After signing in, return to Zotero and click **"Refresh Models"** to load available models.

### 4. Start Chatting
- **Library Panel**: Select any item in your library — the AIdea panel appears in the right sidebar
- **PDF Reader**: Open any PDF — the AIdea panel appears in the reader's side panel
- Type your question and press **Send** or hit `Enter`

### 5. Use Shortcuts
Click any shortcut button (Summarize, Explain, etc.) for quick one-click actions. Right-click a shortcut to edit or remove it.

---

## ⚙️ Configuration

| Setting | Description | Default |
|---|---|---|
| **UI Language** | Interface language (EN / CN) | EN |
| **System Prompt** | Custom instructions for the AI | Empty (use default) |
| **Show "Add Text"** | Show the Add Text option in reader selection popup | ☑ On |
| **Show All Models** | Show all available models vs. curated best models | ☐ Off |

---

## 🔒 Privacy & Security

- 🔑 OAuth tokens are stored **locally only** — never sent to third-party servers
- 📡 All API communication is **directly between you and the AI provider**
- 🚫 This plugin **does not collect any user data**
- 📖 Fully **open-source** — inspect the code anytime

---

## 🗺️ Roadmap

Planned features for upcoming releases:

- 🔤 **Highlight Translation** — Select text in the PDF reader to instantly translate highlighted passages in place
- 📖 **One-Click Full Document Translation** — Translate the entire paper with a single click, generating a side-by-side bilingual view
- 🗂️ **One-Click Architecture Diagram** — Automatically generate a structural diagram from the paper's content, visualizing the research framework at a glance

> 💡 Have a feature request? Feel free to open an [Issue](https://github.com/Visterainer/aidea-zotero/issues)!

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Development mode (with hot reload)
npm start

# Build production XPI
npm run build

# Run tests
npm run test:unit
```

---

## 📄 License

[AGPL-3.0-or-later](./LICENSE)

This project is a fork of [llm-for-zotero](https://github.com/yilewang/llm-for-zotero) by Yile Wang. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for full attribution.

---

<p align="center">
  Author: <strong>zhile</strong>
</p>
