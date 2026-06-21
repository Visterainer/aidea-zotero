## What's Changed

- **Conversation themes**: added built-in conversation themes for the chat tab, including Blue Porcelain, Eye Green, Warm Cream, Premium Gray, Midnight Black, and Sakura Pink. The Default theme keeps the existing system-style appearance.
- **Composer and reply visual polish**: refined the input area with theme-aware surfaces, clearer center editor contrast, theme-colored Send button, and theme-aware bold emphasis in model replies.
- **Send button refinement**: replaced the visible Send text with a paper-plane icon while keeping localized tooltips and accessibility labels.
- **Shortcut menu layering fix**: fixed the shortcut bubble menu layering problem described in #43, so right-click shortcut menus are no longer covered by higher overlay layers. Thanks @zh-hongda for the PR and root-cause notes.
- **OAuth environment updates**: improved OAuth authorization environment checks, installs, and updates across Windows, macOS, and Ubuntu. AIdea now runs available automatic steps and gives clearer terminal guidance when manual action is required.
- **Provider settings layout**: improved OAuth provider setup button sizing so Install/Update Env labels are not clipped in narrow settings panels.
- **Update notice refresh**: updated the one-time update notice to explain the conversation theme, Send button, and OAuth environment changes in user-facing language.

## 更新内容

- **对话主题**：新增多套对话标签页内置主题，包括青花瓷、护眼绿、米白色、高级灰、暗夜黑和樱花粉。默认主题继续保持原有系统样式。
- **输入区与回复视觉优化**：输入区域现在会跟随主题呈现柔和背景，中心输入框层次更清晰，发送按钮跟随主题色，模型回复中的加粗重点内容也会使用主题强调色。
- **发送按钮优化**：将可见的 Send / 发送文字改为纸飞机图标，同时保留跟随界面语言的悬停提示和无障碍标签。
- **快捷气泡菜单浮层修复**：修复 #43 中描述的快捷气泡右键菜单被更高浮层遮挡的问题。感谢 @zh-hongda 提交 PR 并说明根因。
- **OAuth 授权环境更新**：改进 Windows、macOS 和 Ubuntu 下 OAuth 授权环境的检查、安装与更新流程。AIdea 会自动执行可完成的步骤；需要用户手动处理时，会给出更明确的终端提示。
- **Provider 设置布局优化**：优化 OAuth Provider 区域按钮宽度，避免 Install/Update Env 在窄设置面板中被裁切。
- **更新提示刷新**：更新插件升级后的一次性提示面板，用面向用户的语言说明对话主题、发送按钮和 OAuth 环境更新。
