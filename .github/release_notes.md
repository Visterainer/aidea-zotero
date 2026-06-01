## What's Changed

- **Interface language coverage**: expanded localization coverage across the AIdea context panel, settings, selection translation, PDF translation, update prompts, and author-profile workflows.
- **Display and font controls**: added the Display and Font entry and improved typography controls for the context panel and selection translation popup. This addresses the font-size request in #33. Thanks @gonigoni17 for the feedback.
- **Settings UI refresh**: reorganized the basic settings layout, added the input theme selector, improved narrow-panel wrapping, and refined the first-run/update notice.
- **Model refresh and network/proxy handling**: improved OAuth environment refresh and proxy/path handling for cases where model refresh returns 0 models even after updating the environment. This addresses the network/model-refresh investigation in #34. Thanks @zp946 for the detailed logs and proxy diagnosis.
- **Author profile beta**: added a beta right-click action for online corresponding-author information lookup, available from Settings -> Advanced -> Beta test features. This feature is disabled by default and must be enabled explicitly. Thanks @siyuanj for proposing and prototyping this workflow in #36.
- **Context panel stability and persistence**: improved panel hot reload behavior, library panel selection handling, multi-item drag behavior, and persistence for panel, translation, and settings state.
- **PDF translation and file picker refinements**: improved translation settings persistence and native file picker behavior.
- **Diagnostics and tests**: expanded tests around custom endpoint settings, context persistence, PDF translation picker behavior, and OAuth environment handling.

## 更新内容

- **界面多语言覆盖**：扩展 AIdea 对话面板、设置页、划词翻译、PDF 翻译、更新提示和作者信息抓取流程的多语言适配。
- **显示与字体控制**：新增“显示与字体”入口，并改进对话面板和划词翻译弹窗的字体控制。该项回应 #33 中的字号调整需求，感谢 @gonigoni17 的反馈。
- **设置界面刷新**：重组基础设置布局，新增输入框主题选择，优化窄面板换行，并完善首次安装/更新提示。
- **模型刷新与网络/代理处理**：改进 OAuth 环境刷新以及代理/路径处理，减少环境更新后模型列表仍为 0 的情况。该项回应 #34 中的网络与模型刷新问题排查，感谢 @zp946 提供详细日志和代理诊断。
- **作者信息 Beta 功能**：新增“右键联网搜索通信作者信息”Beta 功能，可在“设置 -> 高级 -> Beta 测试功能”中开启。该功能默认关闭，需要用户显式启用。感谢 @siyuanj 在 #36 中提出并原型实现这个方向。
- **面板稳定性与状态持久化**：改进面板热重载、文库面板选择、多条目拖拽，以及面板、翻译和设置状态持久化。
- **PDF 翻译与文件选择优化**：改进翻译设置持久化和原生文件选择器行为。
- **诊断与测试**：扩展自定义端点设置、上下文状态、PDF 翻译文件选择器和 OAuth 环境处理相关测试。
