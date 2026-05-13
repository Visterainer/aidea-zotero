## What's Changed

- **macOS Apple Silicon Node/npm detection**: OAuth CLI environment checks now respect the user's login shell PATH before falling back to built-in paths, and macOS fallback lookup now prefers `/opt/homebrew/bin` before legacy `/usr/local/bin`, preventing stale x64 Node installs from being selected on Apple Silicon Macs. Fixes #26, thanks @werifu for identifying the root cause.
- **macOS system proxy support**: AIdea now detects macOS system HTTP/HTTPS/SOCKS proxy settings with `scutil --proxy` and applies them to Zotero's Gecko networking and CLI subprocess environment, improving OAuth and model connectivity behind local proxy tools. Thanks @werifu for the contribution in #27.
- **Environment diagnostics**: OAuth environment logs now include `nodeArch`, making it easier to confirm whether the selected Node runtime is `arm64` or `x64`.

## 更新内容

- **macOS Apple Silicon Node/npm 检测**：OAuth CLI 环境检查现在会先尊重用户登录 shell 的 PATH，再使用内置路径兜底；macOS 兜底查找也会优先使用 `/opt/homebrew/bin`，再使用旧的 `/usr/local/bin`，避免 Apple Silicon Mac 误选残留的 x64 Node。修复 #26，感谢 @werifu 定位根因。
- **macOS 系统代理支持**：AIdea 现在会通过 `scutil --proxy` 检测 macOS 系统 HTTP/HTTPS/SOCKS 代理，并同步应用到 Zotero 的 Gecko 网络层和 CLI 子进程环境，改善本地代理工具场景下的 OAuth 与模型连接。感谢 @werifu 在 #27 中贡献修复。
- **环境诊断信息**：OAuth 环境日志现在会记录 `nodeArch`，便于确认当前选中的 Node 运行时是 `arm64` 还是 `x64`。
