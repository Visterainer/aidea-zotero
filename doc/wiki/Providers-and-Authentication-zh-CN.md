# Providers and Authentication zh-CN

AIdea 支持多个 AI 服务商，并使用 OAuth 登录流程，让用户直接用已有账号完成授权。

## 总览

| 服务商 | 登录方式 | 是否需要环境安装 | 说明 |
| --- | --- | --- | --- |
| OpenAI (ChatGPT) | 通过 Codex CLI 进行 OAuth 登录 | 是 | 依赖本地环境配置 |
| Google Gemini | 插件内 OAuth (PKCE) | 是 | 依赖本地环境配置 |
| Qwen | Device Code | 否 | 浏览器授权，带验证码复制流程 |
| GitHub Copilot | Device Code | 否 | 浏览器授权，带验证码复制流程 |

## 推荐操作顺序

在每个服务商卡片上按这个顺序执行：

1. `Install/Update Env`
2. `OAuth Login`
3. `Refresh Models`

对于 Qwen 和 GitHub Copilot，可以直接从第 2 步开始。

## 各个按钮的作用

### Install/Update Env

安装或更新该服务商所需的本地运行时与 CLI 依赖。这个步骤主要用于 OpenAI 和 Gemini。

### OAuth Login

启动服务商登录流程。

- OpenAI 和 Gemini 会打开浏览器完成授权。
- Qwen 和 GitHub Copilot 会显示授权码，自动复制并引导你在浏览器中完成登录。

### Refresh Models

读取当前账号可用的模型列表。如果已经登录成功但看不到模型，先尝试这个按钮。

### Remove Auth

清除该服务商在本地保存的认证状态。

## 安全说明

- 令牌保存在本地
- API 通信直接发生在用户与服务商之间
- 插件并不依赖单独的 AIdea 中转后端来转发模型请求

## 故障排查

- 模型列表为空时，先点 `Refresh Models`
- 登录状态异常时，先 `Remove Auth` 再重新登录
- OpenAI 或 Gemini 配置失败时，重新执行 `Install/Update Env`
- 如果服务商账号本身没有某个模型的访问权限，插件也无法显示它
