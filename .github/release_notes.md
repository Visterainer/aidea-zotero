## What's Changed

- **OAuth environment auto-maintenance**: AIdea now silently checks authorized OAuth CLI environments every 72 hours and only shows a prompt when an update or repair is actually needed.
- **Codex CLI latest repair path**: OpenAI Codex OAuth setup now uses `npm install -g --force @openai/codex@latest` for install/update and for platform-package repair.
- **macOS platform package recovery**: if `codex --version` reports a missing `@openai/codex-*` optional dependency, AIdea forces a Codex reinstall and verifies the CLI again, addressing the issue reported by @werifu in #26.
- **Node/npm compatibility guardrails**: outdated Node.js versions are detected before updating npm or Codex; AIdea attempts a Node runtime update and avoids installing a latest npm version that the current Node cannot run.
- **Safer Codex OAuth model refresh**: stale Codex OAuth credentials are refreshed through the CLI before model discovery or validation retries.
- **Localized update prompt**: the OAuth environment update prompt supports all AIdea UI languages and disables action buttons immediately after an update starts.

## 更新内容

- **OAuth 环境自动维护**：AIdea 现在会每 72 小时静默检查已授权的 OAuth CLI 环境，只有确认需要更新或修复时才弹窗。
- **Codex CLI 固定最新版修复路径**：OpenAI Codex OAuth 环境安装、更新和平台包修复统一使用 `npm install -g --force @openai/codex@latest`。
- **macOS 平台包缺失恢复**：当 `codex --version` 报告缺失 `@openai/codex-*` 可选依赖时，AIdea 会强制重装 Codex 并再次验证 CLI，用于处理 @werifu 在 #26 中报告的问题。
- **Node/npm 兼容保护**：在更新 npm 或 Codex 之前先识别过旧 Node.js；AIdea 会尝试更新 Node runtime，并避免安装当前 Node 无法运行的最新版 npm。
- **更安全的 Codex OAuth 模型刷新**：Codex OAuth 凭据失效时，会先通过 CLI 刷新凭据，再重试模型发现和验证。
- **多语言更新提示**：OAuth 环境更新提示支持 AIdea 的全部 UI 语言，并在开始更新后立即禁用操作按钮，避免重复触发。
