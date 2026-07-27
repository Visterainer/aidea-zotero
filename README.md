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
  <strong>🌐 Website:</strong> <a href="https://visterainer.github.io/aidea-zotero/en/">https://visterainer.github.io/aidea-zotero/en/</a>
</p>

<p align="center">
  <strong>A free, open-source AI assistant plugin for Zotero</strong><br/>
  🔐 OAuth login with OpenAI (ChatGPT), Google Gemini, and GitHub Copilot<br/>
  ⚙️ OpenAI-compatible APIs and local or self-hosted models via Ollama, LM Studio, vLLM, and similar runtimes
</p>

<p align="center">
  <img alt="OpenAI ChatGPT" src="https://img.shields.io/badge/OpenAI-ChatGPT-10A37F?style=for-the-badge&logo=openai&logoColor=white" />
  <img alt="Google Gemini" src="https://img.shields.io/badge/Google-Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white" />
  <img alt="GitHub Copilot" src="https://img.shields.io/badge/GitHub-Copilot-111111?style=for-the-badge&logo=github&logoColor=white" />
</p>

<p align="center">
  <img alt="OpenAI Compatible API" src="https://img.shields.io/badge/OpenAI-Compatible%20API-4B5563?style=flat-square&logo=openai&logoColor=white" />
  <img alt="Ollama" src="https://img.shields.io/badge/Ollama-1F2937?style=flat-square&logoColor=white" />
  <img alt="LM Studio" src="https://img.shields.io/badge/LM%20Studio-2563EB?style=flat-square&logoColor=white" />
  <img alt="vLLM" src="https://img.shields.io/badge/vLLM-7C3AED?style=flat-square&logoColor=white" />
</p>

<p align="center">
  <a href="#-features">Features</a> &nbsp;|&nbsp;
  <a href="#-installation">Installation</a> &nbsp;|&nbsp;
  <a href="#-getting-started">Getting Started</a> &nbsp;|&nbsp;
  <a href="#-configuration">Configuration</a> &nbsp;|&nbsp;
  <a href="#-license">License</a>
</p>

---

## ✨ Features

### 💬 AI Chat in the Side Panel

Chat with AI directly in Zotero's side panel, available in both the **Library** view and the **PDF Reader**. Ask questions, get summaries, and stay inside the same research workflow.

<p align="center">
  <img src="doc/screenshots/chat_panel_en.png" alt="Side panel chat" width="800" />
</p>

### 📄 Paper-Aware Context

Select text in the PDF reader and click **Add Text** to attach the selected passage to the context area. AIdea can then answer against the selected passage instead of relying on a generic summary.

### 📝 Selection Translation

Translate selected text directly in Zotero's PDF or EPUB reader popup. AIdea detects the active format automatically, with no manual switch required. Selection translation uses the same OAuth/API model list as the chat panel, but can be configured with its own enable switch, model, source language, and target language.

The first time this feature is used for a paper, AIdea creates a local cold-start cache with a compact paper overview and terminology summary. Later selection translations reuse that local cache as context, and translated passages can be added back to Zotero notes.

<p align="center">
  <img src="doc/screenshots/selection_translation_popup.png" alt="Selection translation popup in the PDF reader" width="800" />
</p>

<p align="center">
  <img src="doc/screenshots/selection_translation_settings.png" alt="Selection translation settings" width="800" />
</p>

### ⚡ Quick Action Shortcuts

Use one-click shortcuts for common tasks such as **Summarize**, **Explain**, and **Translate**. Shortcuts can be added, edited, reordered, or removed to match your workflow.

### 🖼️ Multimodal Support

Attach screenshots, figures, and charts to your messages. AIdea supports drag and drop, clipboard paste, and screenshot capture directly from PDF content.

### 🔐 OAuth Login Without an API Key

Sign in with your existing account through OAuth. AIdea supports multiple providers with provider-specific OAuth flows, so you can start without managing an API key manually.

### 📄 Full-Document Translation

Translate full papers directly inside Zotero and export either a **bilingual dual-column PDF** or a **single-language PDF**. The translation workflow supports model selection, output path configuration, and end-to-end execution in the side panel.

<p align="center">
  <img src="doc/screenshots/translate_panel_en.png" alt="Full-document translation panel" width="800" />
</p>

Example outputs:

<p align="center">
  <img src="doc/screenshots/translate_example_architecture.png" alt="Bilingual architecture paper translation example" width="800" />
</p>

<p align="center">
  <img src="doc/screenshots/translate_example_formula.png" alt="Formula-heavy paper translation example" width="800" />
</p>

<p align="center">
  <img src="doc/screenshots/translate_example_table.png" alt="Table and prose translation example" width="800" />
</p>

### 🌐 Multi-Provider Support

| Provider             | Auth Method                   | Extra Setup              |
| -------------------- | ----------------------------- | ------------------------ |
| **OpenAI (ChatGPT)** | OAuth via Codex CLI           | Node.js (auto-installed) |
| **Google Gemini**    | In-plugin OAuth (PKCE)        | Node.js (auto-installed) |
| **GitHub Copilot**   | In-plugin OAuth (Device Code) | None                     |

### 📝 Note Export

Save AI responses as Zotero notes with one click. Responses are stored in Markdown and support LaTeX math rendering.

### 💾 Persistent Chat History

All conversations are stored locally in Zotero's database. You can switch between conversations, continue previous threads, and manage local chat history.

### 🧠 Memory System

AIdea captures and recalls useful information across conversations to improve continuity and context awareness over time.

- **Auto-capture** detects preferences, decisions, facts, and key entities from natural conversation
- **Per-library isolation** keeps memories scoped to each Zotero library
- **Smart deduplication** uses Jaccard token similarity to prevent redundant memories
- **Relevance-ranked retrieval** combines overlap, substring match, recency, and importance
- **Prompt injection defense** blocks malicious or irrelevant content from being stored
- **Fully local storage** keeps memory data inside Zotero's SQLite database

### 🎨 Rich Rendering

- Full **Markdown** rendering, including headings, lists, code blocks, and tables
- **LaTeX** math support via KaTeX
- **Syntax highlighting** for code blocks
- Smooth **streaming** responses

### 🌍 Interface Languages

The plugin interface now supports **12 UI languages**: **English**, **简体中文**, **繁體中文**, **日本語**, **한국어**, **Français**, **Deutsch**, **Español**, **Русский**, **Português**, **العربية**, and **हिन्दी**. Full-document translation keeps its broader target-language list independent from the UI language list.

---

## 📦 Installation

### Requirements

- **Zotero 7 or later**
- **Node.js**, required for OpenAI and Gemini, can be installed automatically by the plugin when needed

### Install the Plugin

1. Download the latest `AIdea-x.x.x.xpi` from [Releases](https://github.com/Visterainer/aidea-zotero/releases)
2. In Zotero, go to **Tools → Add-ons**
3. Click the gear icon ⚙️ and choose **Install Add-on From File...**
4. Select the downloaded `.xpi` file
5. Restart Zotero

### Upgrade

Install the newer `.xpi` package over the existing one. Chat history, stored memory, and local settings are preserved.

---

## 🚀 Getting Started

### 1. Open Settings

Go to **Tools → Add-ons → AIdea → Settings**. On older Zotero builds, the path may appear under **Edit → Settings → AIdea**.

### 2. Choose a Connection Mode

AIdea supports two connection modes. You can use either one or combine both.

#### Option A: OAuth Login

For each provider card, the typical setup order is:

> **① `Install/Update Env`** → **② `OAuth Login`** → **③ `Refresh Models`**

| Button                   | What it does                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`Install/Update Env`** | Installs and configures the required CLI tools and runtime, including Node.js and npm when needed. GitHub Copilot does not require this step.                                 |
| **`OAuth Login`**        | Starts the provider-specific login flow. OpenAI and Gemini open the browser directly. GitHub Copilot shows a device code, copies it, and opens the browser for authorization. |
| **`Refresh Models`**     | Loads the list of available models for the provider after login.                                                                                                              |
| **`Remove Auth`**        | Clears the locally stored OAuth token for that provider.                                                                                                                      |

<p align="center">
  <img src="doc/screenshots/settings_oauth_models_en.png" alt="OAuth providers and model management" width="700" />
</p>

> 💡 **Tip:** Each provider only needs to be configured once. The login session is stored locally and remains available after Zotero restarts.

#### Option B: OpenAI-Compatible API Endpoint

AIdea can also connect to any **OpenAI-compatible chat endpoint**, including local, self-hosted, or third-party services such as Ollama, LM Studio, vLLM, DeepSeek, OpenRouter, or Groq.

In **Settings**, switch to **API Mode** and fill in:

| Field            | Required | Description                                                                                                 |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| **API Base URL** | Yes      | The base URL of the compatible endpoint, such as `https://api.openai.com/v1` or `http://localhost:11434/v1` |
| **API Key**      | No       | Required only when the endpoint expects authentication                                                      |
| **Model**        | Yes      | Enter the model manually or click **Auto Fetch Models** to detect available models                          |

<p align="center">
  <img src="doc/screenshots/settings_api_en.png" alt="API mode custom endpoint" width="700" />
</p>

> **Note:** API mode targets compatible `/chat/completions` endpoints. It does not guarantee support for provider-specific features beyond standard chat completion.

### 3. Start Chatting

- In the **Library Panel**, select an item and use the AIdea panel in the right sidebar
- In the **PDF Reader**, open a PDF and use the AIdea panel in the reader sidebar
- Type your question and press **Send** or hit `Enter`

### 4. Use Quick Actions

Click shortcut buttons such as **Summarize**, **Explain**, or **Translate** for one-click actions. Right-click a shortcut to edit or remove it.

---

## ⚙️ Configuration

| Setting                         | Description                                                                    | Default                              |
| ------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------ |
| **UI Language**                 | Plugin interface language                                                      | Auto-detected, fallback EN           |
| **System Prompt**               | Custom instructions for the model                                              | Empty                                |
| **Show "Add Text"**             | Show the Add Text option in the reader selection popup                         | On                                   |
| **Selection Translation**       | Translate selected reader text in the popup and reuse local cold-start context | On                                   |
| **Selection Translation Model** | Dedicated model for reader selection translation                               | First available model unless changed |
| **Show All Models**             | Show all available models instead of a curated subset                          | Off                                  |
| **Tab Bar**                     | Show or hide the tab navigation bar                                            | Hidden                               |

---

## 🔒 Privacy & Security

- OAuth tokens are stored **locally only**
- API requests are sent **directly** to the selected provider or configured endpoint
- AIdea **does not collect usage telemetry or user data**
- Chat history and memory remain in Zotero's local database
- The code is fully available for inspection on [GitHub](https://github.com/Visterainer/aidea-zotero)

---

## 🗺️ Roadmap

Planned directions for future releases include:

- **One-click architecture diagrams**, for generating structural visualizations from paper content

> 💡 Feature requests are welcome through [Issues](https://github.com/Visterainer/aidea-zotero/issues).

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Development mode
npm start

# Build production XPI
npm run build

# Run tests
npm run test:unit
```

---

## 📄 License

[AGPL-3.0-or-later](./LICENSE)

This project is derived from [llm-for-zotero](https://github.com/yilewang/llm-for-zotero) by Yile Wang. See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for attribution details.

---

## ⭐ Star History

<a href="https://star-history.com/#Visterainer/aidea-zotero&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=Visterainer/aidea-zotero&type=Date" />
 </picture>
</a>

---

<p align="center">
  Author: <strong>zhile</strong>
</p>
