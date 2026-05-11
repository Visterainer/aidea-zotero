## What's Changed

- **Windows npm warning handling**: hidden PowerShell commands now return the real native process exit code, so `npm warn using --force` from `npm install -g --force @openai/codex@latest` is no longer treated as a failed install when npm succeeds.
- **Live Settings console sync**: OAuth environment updates started from the popup now stream progress into the Settings console and keep `oauthSetupLog` updated while the task is running.
- **Cleaner update prompt controls**: the OAuth update prompt now has a top-right minimize control, and after completion the action area is replaced with a single OK button that closes the prompt.
- **Clearer failure feedback**: if an OAuth environment update really fails, the prompt now shows the last failed step instead of only a generic message.

## 更新内容

- **Windows npm warning 处理**：隐藏 PowerShell 命令现在会返回真实的原生命令退出码，因此 `npm install -g --force @openai/codex@latest` 成功时产生的 `npm warn using --force` 不会再被误判为安装失败。
- **Settings 控制台实时同步**：从弹窗启动的 OAuth 环境更新现在会把进度实时写入 Settings 控制台，并在任务执行过程中持续更新 `oauthSetupLog`。
- **更清晰的更新弹窗控制**：OAuth 更新弹窗新增右上角最小化按钮；更新完成后，操作区会替换为单个“确定”按钮，点击后关闭弹窗。
- **更明确的失败反馈**：如果 OAuth 环境更新确实失败，弹窗会显示最后一个失败步骤，而不再只显示通用失败提示。
