# AIdea

AIdea is a free and open-source AI assistant for Zotero. It lets you chat with AI directly inside Zotero, work with paper context, and sign in with supported providers using your existing account instead of manually configuring API keys.

English | [中文](Home-zh-CN)

## What AIdea Does

- Chat with AI in the Zotero library side panel and PDF reader side panel
- Attach selected PDF text as context for grounded Q&A
- Use quick actions like summarize, explain, and translate
- Export responses to Zotero notes with Markdown and LaTeX support
- Keep persistent local chat history
- Use a local memory system to carry useful context across conversations
- Sign in with OpenAI, Gemini, Qwen, and GitHub Copilot

## Why People Use It

AIdea is designed for research workflows. Instead of switching between Zotero, browsers, and external AI apps, you can stay inside your library while reading papers, selecting passages, and asking targeted questions.

## Supported Providers

| Provider | Login Method | Extra Setup |
| --- | --- | --- |
| OpenAI (ChatGPT) | OAuth via Codex CLI | Node.js environment installed by plugin |
| Google Gemini | In-plugin OAuth (PKCE) | Node.js environment installed by plugin |
| Qwen | In-plugin OAuth (Device Code) | No extra runtime setup |
| GitHub Copilot | In-plugin OAuth (Device Code) | No extra runtime setup |

## Requirements

- Zotero 7 or later
- Node.js only for OpenAI and Gemini flows, with automatic setup handled by the plugin

## Install

1. Download the latest `.xpi` file from the GitHub Releases page.
2. In Zotero, open `Tools -> Add-ons`.
3. Choose `Install Add-on From File...`.
4. Select the downloaded `.xpi`.
5. Restart Zotero.

## Start Here

- New user: see [Getting Started](Getting-Started)
- Provider setup: see [Providers and Authentication](Providers-and-Authentication)
- Feature overview: see [Features and Workflow](Features-and-Workflow)
- Common questions: see [FAQ](FAQ)
- Chinese pages: see [Home zh-CN](Home-zh-CN)

## Project Links

- Repository: https://github.com/Visterainer/aidea-zotero
- Releases: https://github.com/Visterainer/aidea-zotero/releases
- Issues: https://github.com/Visterainer/aidea-zotero/issues
- Chinese README: https://github.com/Visterainer/aidea-zotero/blob/master/README_CN.md
