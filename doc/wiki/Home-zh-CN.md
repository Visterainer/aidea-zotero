# AIdea 中文

AIdea 是一个免费、开源的 Zotero AI 助手插件。你可以直接在 Zotero 里与 AI 对话、结合论文上下文提问，并使用已有账号登录支持的 AI 服务，而不需要手动配置 API Key。

[English](Home) | 中文

## AIdea 能做什么

- 在 Zotero 文库侧边栏和 PDF 阅读器侧边栏中直接与 AI 对话
- 将 PDF 选中文本加入上下文，进行基于原文的问答
- 使用总结、解释、翻译等快捷操作
- 一键导出 AI 回复到 Zotero 笔记，支持 Markdown 与 LaTeX
- 保留本地聊天记录，方便继续之前的讨论
- 使用本地记忆系统，在多轮对话中保留有用上下文
- 支持 OpenAI、Gemini、Qwen 和 GitHub Copilot 登录

## 为什么适合 Zotero 用户

AIdea 面向研究工作流设计。相比在 Zotero、浏览器和外部 AI 应用之间来回切换，你可以直接在阅读文献时选中段落、提问、做笔记，把整个过程留在 Zotero 里完成。

## 支持的服务商

| 服务商 | 登录方式 | 额外配置 |
| --- | --- | --- |
| OpenAI (ChatGPT) | 通过 Codex CLI 进行 OAuth 登录 | 插件自动安装 Node.js 环境 |
| Google Gemini | 插件内 OAuth (PKCE) | 插件自动安装 Node.js 环境 |
| Qwen | 插件内 OAuth (Device Code) | 无需额外运行时 |
| GitHub Copilot | 插件内 OAuth (Device Code) | 无需额外运行时 |

## 环境要求

- Zotero 7 或更高版本
- OpenAI 和 Gemini 需要 Node.js，但插件会自动完成环境安装

## 安装方法

1. 从 GitHub Releases 页面下载最新 `.xpi` 安装包。
2. 在 Zotero 中打开 `工具 -> 插件`。
3. 选择 `从文件安装插件...`。
4. 选择下载好的 `.xpi` 文件。
5. 重启 Zotero。

## 从这里开始

- 新用户上手：[Getting Started zh-CN](Getting-Started-zh-CN)
- 服务商登录与配置：[Providers and Authentication zh-CN](Providers-and-Authentication-zh-CN)
- 功能概览与使用流程：[Features and Workflow zh-CN](Features-and-Workflow-zh-CN)
- 常见问题：[FAQ zh-CN](FAQ-zh-CN)

## 项目链接

- 仓库主页: https://github.com/Visterainer/aidea-zotero
- 发布页面: https://github.com/Visterainer/aidea-zotero/releases
- 问题反馈: https://github.com/Visterainer/aidea-zotero/issues
- 中文 README: https://github.com/Visterainer/aidea-zotero/blob/master/README_CN.md
