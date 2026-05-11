import { config } from "../../package.json";
import { HTML_NS } from "../utils/domHelpers";
import {
  autoConfigureEnvironment,
  fetchAvailableModels,
  fetchCustomEndpointModels,
  getOAuthProviderPingInfo,
  getProviderAccountSummary,
  getProviderLabel,
  pingCodexModel,
  pingGeminiModel,
  pingModel,
  providerToMarker,
  removeProviderOAuthCredential,
  runProviderOAuthLogin,
  type OAuthProviderId,
  type ProviderModelOption,
} from "../utils/oauthCli";
import { clearAllChatHistory } from "../utils/chatStore";
import { clearSelectionTranslateColdStartCache } from "../utils/selectionTranslateCacheStore";
import {
  canonicalizeSelectedModelIds,
  getDefaultSelectedModelIds,
  normalizeModelId,
  parseModelSelectionCache,
  reconcileModelSelectionCache,
  reconcileProviderModelSelection,
  serializeModelSelectionCache,
  type ProviderModelSelectionCache,
} from "../utils/oauthModelSelection";
import { renderShortcuts } from "./contextPanel/shortcuts";
import { shortcutRenderItemState } from "./contextPanel/state";
import { getPanelI18n } from "./contextPanel/i18n";
import { refreshTranslateTabI18n } from "./contextPanel/i18n";
import {
  detectPanelLangFromLocale,
  getUiLanguageOption,
  normalizeUiLanguageCode,
  TRANSLATION_LANGUAGE_OPTIONS,
  UI_LANGUAGE_OPTIONS,
  type PanelLang,
} from "./contextPanel/languages";
import { getPrimaryConnectionMode } from "./contextPanel/prefHelpers";
import {
  getModelChoices,
  pickBestDefaultModel,
} from "./contextPanel/setupHandlers/controllers/modelSelectionController";

type PrefKey =
  | "apiBase"
  | "apiKey"
  | "model"
  | "apiBasePrimary"
  | "apiKeyPrimary"
  | "modelPrimary"
  | "apiBaseSecondary"
  | "apiKeySecondary"
  | "modelSecondary"
  | "apiBaseTertiary"
  | "apiKeyTertiary"
  | "modelTertiary"
  | "apiBaseQuaternary"
  | "apiKeyQuaternary"
  | "modelQuaternary"
  | "systemPrompt"
  | "oauthModelListCache"
  | "oauthModelSelectionCache"
  | "oauthSetupLog"
  | "oauthRiskAccepted"
  | "primaryConnectionMode"
  | "settingsSectionState"
  | "settingsScrollTop"
  | "selectionTranslate.model"
  | "selectionTranslate.provider"
  | "selectionTranslate.sourceLang"
  | "selectionTranslate.targetLang"
  | "uiLanguage";

type Lang = PanelLang;
const OAUTH_ENV_UPDATE_LOG_EVENT = `${config.addonRef}-oauth-env-update-log`;
const PROVIDERS: OAuthProviderId[] = [
  "openai-codex",
  "google-gemini-cli",
  "github-copilot",
];
const PROFILE_KEYS = [
  "Primary",
  "Secondary",
  "Tertiary",
  "Quaternary",
] as const;

const pref = (key: PrefKey) => `${config.prefsPrefix}.${key}`;
const getPref = (key: PrefKey): string => {
  const value = Zotero.Prefs.get(pref(key), true);
  return typeof value === "string" ? value : "";
};
const setPref = (key: PrefKey, value: string) =>
  Zotero.Prefs.set(pref(key), value, true);
const getBoolPref = (key: string, fallback: boolean): boolean => {
  const value = Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return fallback;
};
const setBoolPref = (key: string, value: boolean) =>
  Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);

function getLang(): Lang {
  const saved = (getPref("uiLanguage") || "").trim();
  const savedLang = normalizeUiLanguageCode(saved);
  if (savedLang) return savedLang;
  // Auto-detect from Zotero locale
  try {
    const detected = detectPanelLangFromLocale(
      String((Zotero as any)?.locale || ""),
    );
    // Persist the detected language so future opens don't re-detect
    setPref("uiLanguage", detected);
    return detected;
  } catch {
    return "en-US";
  }
}

const I18N = {
  "zh-CN": {
    primaryConnectionMode: "主连接模式",
    oauthProvidersMode: "OAuth 提供商",
    customCompatibleMode: "API 方式",
    modelConfigTitle: "模型配置",
    customEndpointHint:
      "OAuth 提供商卡片会一直保留。切换到自定义模式后，请填写基础配置中的 API Base URL 和 Model；API Key 可选。",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "例如：http://127.0.0.1:11434/v1/",
    customApiBaseHint:
      "支持 localhost 与 http 地址。保存时会自动去除首尾空格，并规范为单个尾部斜杠。",
    customApiKey: "API Key（可选）",
    customApiKeyPlaceholder: "留空则不发送 Authorization 头",
    customApiKeyHint:
      "仅保存在基础偏好设置中；如果服务端不需要鉴权，可以留空。",
    customModel: "Model *",
    customModelPlaceholder: "例如：gpt-4.1-mini 或 llama3.1:8b",
    customModelHint: "自定义模式请求成功至少需要 API Base URL 和 Model。",
    fetchModels: "自动获取模型列表",
    fetchModelsRunning: "正在获取模型列表...",
    fetchModelsDone: "已获取 {n} 个模型",
    fetchModelsFailed: "获取模型列表失败，请检查 API Base URL 和 API Key",
    fetchModelsEmpty: "未找到可用模型",
    customModeDisabled:
      "当前使用 OAuth 提供商模式；已保存的自定义值会保留，切回自定义模式即可继续使用。",
    customModeMissing:
      "自定义模式下必须填写 API Base URL 和 Model；API Key 可选。",
    customModeReady:
      "自定义模式已就绪：将使用基础 prefs 中的 API Base URL / API Key / Model。",
    installEnv: "安装/更新环境",
    refreshAllModels: "刷新全部模型列表",
    running: "执行中...",
    setupDone: "环境配置完成",
    setupPartialFail: "环境配置部分失败，请查看日志",
    accounts: "授权账号",
    models: "可用模型列表",
    language: "界面语言",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "OAuth 登录",
    oauthDelete: "删除授权",
    refreshModels: "刷新模型",
    loggingIn: "正在启动 OAuth 登录...",
    refreshingModels: "正在刷新模型列表...",
    noModels: "暂无模型（请先完成 OAuth 登录并刷新模型列表）",
    provider: "提供商",
    account: "账号",
    status: "状态",
    modelId: "模型 ID",
    source: "来源",
    internalNote: "只有勾选的模型会出现在侧边栏对话框中。",
    systemPrompt: "自定义系统提示词（可选）",
    systemPromptHint: "覆盖默认系统提示词（留空使用默认值）",
    showAddText: "在阅读器选择弹窗显示 添加文本",
    showAddTextHint:
      "如果不想在 Zotero 文本选择弹出菜单中显示 添加文本 选项，请关闭此开关。",
    showAllModels: "在下拉菜单中显示所有模型",
    showAllModelsHint:
      "开启后显示所有可用模型。关闭时仅显示每个提供商的精选模型。",
    hideTabNav: "标签栏:",
    hideTabNavOn: "隐藏",
    hideTabNavOff: "显示",
    restoreDefaults: "恢复默认",
    restoreDefaultsConfirm:
      "确定要恢复所有配置到默认值吗？\n\n这将重置所有模型配置、系统提示词等设置。",
    restoreDefaultsDone: "已恢复默认配置",
    clearAllHistory: "清空历史",
    clearAllHistoryConfirm:
      "确定要清空所有聊天记录吗？\n\n此操作不可撤销，所有对话历史将被永久删除。",
    clearAllHistoryDone: "已清空全部聊天记录",
    clearAllHistoryRunning: "正在清空...",
    developing: "此功能正在开发中，敬请期待！",
    console: "控制台",
    advanced: "高级",
    copy: "复制",
    providerLabel: "提供商标签:",
    addModelLabel: "模型名称:",
    addModelPlaceholder: "输入模型 ID",
    manualAdd: "手动添加",
    all: "全选",
    clear: "清空",
    saveSelectedModels: "💾 保存勾选模型",
    saved: "✔ 已保存",
    delete: "删除",
    defaults: "默认",
    selectAll: "全选",
    removeProvider: "删除提供商",
    removeProviderConfirm: "确定要删除提供商「{provider}」及其所有模型吗？",
    removeModel: "删除模型",
    testingModels: "✔ {n} 个模型，正在测试可用性...",
    pingSummary: "✔ {ok} 可用, {fail} 不可用",
    selectedSummary: "已勾选 {selected}/{total}",
    refreshFailed: "✖ 刷新失败: {msg}",
    systemPromptPlaceholder: "给 AI 助手的自定义指令...",
    oauthDeviceNotice:
      "⚠️ OAuth 授权提示\n\n将启动 Device Code OAuth 流程：\n1. 稍后会显示验证网址和授权码\n2. 打开浏览器完成授权\n\n请注意：\n• OAuth 令牌仅保存在本地设备\n• 此用法未经服务商明确授权，理论上存在账号被限制的可能性\n• 使用 AI 服务可能产生费用\n• 本插件完全免费且开源，不收集任何用户数据\n\n是否继续？",
    oauthInstallNotice:
      "⚠️ OAuth 授权提示\n\n“安装环境”将执行以下操作：\n1. 安装 Node.js 运行环境（如尚未安装）\n2. 安装对应提供商的 CLI 工具\n3. 通过 OAuth 协议打开浏览器登录\n\n请注意：\n• OAuth 登录生成的访问令牌仅保存在本地，不会上传至任何第三方服务器\n• 插件直接调用 AI 服务商的官方 API\n• 本插件借助 CLI 的 OAuth 令牌调用 API，此用法未经服务商明确授权，理论上存在账号被限制的可能性\n• 使用 AI 服务可能产生费用，具体取决于您的账号计费方式\n• 本插件完全免费且开源，不收集任何用户数据\n\n是否继续？",
    authLoggedIn: "已登录",
    authNotLoggedIn: "未登录",
    authTokenMayBeExpired: "令牌可能已过期",
    authTokenExpired: "令牌已过期",
    authProject: "项目",
    authExpiresIn: "剩余",
    authUsed: "已使用",
  },
  "en-US": {
    primaryConnectionMode: "Primary connection mode",
    oauthProvidersMode: "OAuth Providers",
    customCompatibleMode: "API Mode",
    modelConfigTitle: "Model Config",
    customEndpointHint:
      "OAuth provider cards always stay visible. In custom mode, fill the base-pref API Base URL and Model; API Key is optional.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "Example: http://127.0.0.1:11434/v1/",
    customApiBaseHint:
      "Localhost and plain http URLs are allowed. Saving trims whitespace and normalizes to a single trailing slash.",
    customApiKey: "API Key (Optional)",
    customApiKeyPlaceholder: "Leave empty to omit the Authorization header",
    customApiKeyHint:
      "Stored only in the base prefs; leave blank if your endpoint does not require auth.",
    customModel: "Model *",
    customModelPlaceholder: "Example: gpt-4.1-mini or llama3.1:8b",
    customModelHint:
      "A successful custom-mode request requires API Base URL and Model.",
    fetchModels: "Auto Fetch Models",
    fetchModelsRunning: "Fetching models...",
    fetchModelsDone: "{n} models found",
    fetchModelsFailed:
      "Failed to fetch models. Check API Base URL and API Key.",
    fetchModelsEmpty: "No models found",
    customModeDisabled:
      "OAuth provider mode is active. Saved custom values are retained; switch back to custom mode to use them.",
    customModeMissing:
      "Custom mode requires API Base URL and Model; API Key is optional.",
    customModeReady:
      "Custom mode is ready: requests will use the base-pref API Base URL / API Key / Model.",
    installEnv: "Install/Update Env",
    refreshAllModels: "Refresh All Models",
    running: "Running...",
    setupDone: "Environment setup completed",
    setupPartialFail: "Environment setup partially failed; check logs",
    accounts: "Authorized Accounts",
    models: "Available Models",
    language: "UI Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "OAuth Login",
    oauthDelete: "Remove Auth",
    refreshModels: "Refresh Models",
    loggingIn: "Starting OAuth login...",
    refreshingModels: "Refreshing model list...",
    noModels:
      "No models yet (complete OAuth login and refresh model list first)",
    provider: "Provider",
    account: "Account",
    status: "Status",
    modelId: "Model ID",
    source: "Source",
    internalNote: "Only checked models appear in the sidebar dropdown.",
    systemPrompt: "Custom System Prompt (Optional)",
    systemPromptHint:
      "Override the default system prompt (leave empty to use default)",
    showAddText: 'Show "Add Text" in reader selection popup',
    showAddTextHint:
      "Disable this if you prefer not to show the Add Text option in Zotero's text selection popup menu.",
    selectionTranslateTitle: "Selection Translation",
    selectionTranslateEnable: "Enable selection translation",
    selectionTranslateEnableHint:
      "When enabled, Zotero reader text selections can be translated in the selection popup.",
    selectionTranslateAuto: "Translate automatically after selection",
    selectionTranslateAutoHint:
      "When disabled, the popup shows a translate button instead of starting immediately.",
    selectionTranslateModel: "Selection translation model",
    selectionTranslateModelHint:
      "Uses the same OAuth/API model list as the discussion panel.",
    selectionTranslateSourceLang: "Source language",
    selectionTranslateTargetLang: "Target language",
    selectionTranslateAutoDetect: "Auto detect",
    selectionTranslateNoModels: "No available model",
    selectionTranslateColdStartHint:
      "Cold start runs once per paper when selection translation is enabled: AIdea reads the paper text, creates a compact overview and terminology summary, and stores it locally. Later selections reuse that local cache as context; clear the cold-start cache to regenerate it.",
    selectionTranslateClearCache: "Clear cold-start cache",
    selectionTranslateClearCacheRunning: "Clearing...",
    selectionTranslateClearCacheDone: "Cold-start cache cleared ({n})",
    showAllModels: "Show all models in dropdown",
    showAllModelsHint:
      "When enabled, shows all available models. When disabled, only the best models per provider are shown.",
    hideTabNav: "Tab Bar:",
    hideTabNavOn: "Hide",
    hideTabNavOff: "Show",
    restoreDefaults: "Restore Defaults",
    restoreDefaultsConfirm:
      "Are you sure you want to restore all settings to defaults?\n\nThis will reset all model configurations, system prompt, etc.",
    restoreDefaultsDone: "Default configuration restored",
    clearAllHistory: "Clear History",
    clearAllHistoryConfirm:
      "Are you sure you want to clear ALL chat history?\n\nThis action cannot be undone. All conversation history will be permanently deleted.",
    clearAllHistoryDone: "All chat history cleared",
    clearAllHistoryRunning: "Clearing...",
    developing: "This feature is under development. Stay tuned!",
    console: "Console",
    advanced: "Advanced",
    copy: "Copy",
    providerLabel: "Provider Label:",
    addModelLabel: "Model ID:",
    addModelPlaceholder: "Enter model ID",
    manualAdd: "Manual Add",
    all: "All",
    clear: "Clear",
    saveSelectedModels: "💾 Save Models",
    saved: "✔ Saved",
    delete: "Delete",
    defaults: "Defaults",
    selectAll: "Select All",
    removeProvider: "Remove Provider",
    removeProviderConfirm: 'Remove provider "{provider}" and all its models?',
    removeModel: "Remove model",
    testingModels: "✔ {n} models, testing availability...",
    pingSummary: "✔ {ok} ok, {fail} failed",
    selectedSummary: "Selected {selected}/{total}",
    refreshFailed: "✖ Refresh failed: {msg}",
    systemPromptPlaceholder: "Custom instructions for the AI assistant...",
    oauthDeviceNotice:
      "⚠️ OAuth Authorization Notice\n\nThis will start the Device Code OAuth flow:\n1. A verification URL and code will be displayed\n2. Open your browser to authorize the application\n\nPlease note:\n• OAuth tokens are stored locally on your device only\n• This plugin uses OAuth tokens which is not officially endorsed — theoretical risk of account restrictions\n• Using AI services may incur charges\n• This plugin is free, open-source, and collects no user data\n\nDo you wish to continue?",
    oauthInstallNotice:
      '⚠️ OAuth Authorization Notice\n\n"Install Environment" will perform the following:\n1. Install Node.js runtime (if not already installed)\n2. Install the CLI tool for this provider\n3. Open your browser via OAuth to sign in\n\nPlease note:\n• OAuth tokens are stored locally on your device only and are never sent to any third-party server\n• The plugin communicates directly with the AI provider\'s official API\n• This plugin uses OAuth tokens which is not an officially endorsed usage — there is a theoretical risk of account restrictions\n• Using AI services may incur charges depending on your account billing plan\n• This plugin is completely free, open-source, and does not collect any user data\n\nDo you wish to continue?',
    authLoggedIn: "Logged in",
    authNotLoggedIn: "Not logged in",
    authTokenMayBeExpired: "token may be expired",
    authTokenExpired: "token expired",
    authProject: "project",
    authExpiresIn: "expires in",
    authUsed: "used",
  },
} as const;

type Dict = Record<string, string>;
const SETTINGS_I18N_BASE_OVERRIDES: Partial<Record<Lang, Dict>> = {
  "zh-CN": {
    selectionTranslateTitle: "划词翻译",
    selectionTranslateEnable: "启用划词翻译",
    selectionTranslateEnableHint:
      "开启后，Zotero 阅读器划词弹窗会显示划词翻译结果。",
    selectionTranslateAuto: "划词后自动翻译",
    selectionTranslateAutoHint:
      "关闭后，弹窗中显示翻译按钮，需要手动点击后再翻译。",
    selectionTranslateModel: "划词翻译模型",
    selectionTranslateModelHint:
      "复用对话框中的 OAuth/API 模型列表和调用方式。",
    selectionTranslateSourceLang: "源语言",
    selectionTranslateTargetLang: "目标语言",
    selectionTranslateAutoDetect: "自动识别",
    selectionTranslateNoModels: "暂无可用模型",
    selectionTranslateColdStartHint:
      "冷启动会在某篇文献首次启用划词翻译时执行一次：AIdea 读取全文，生成精简概述和专业术语摘要并保存在本地。之后划词翻译会复用这份本地缓存作为上下文；需要重建时可清理冷启动缓存。",
    selectionTranslateClearCache: "清理冷启动缓存",
    selectionTranslateClearCacheRunning: "正在清理...",
    selectionTranslateClearCacheDone: "已清理冷启动缓存（{n}）",
  },
  "zh-TW": {
    primaryConnectionMode: "主要連線模式",
    oauthProvidersMode: "OAuth 提供商",
    customCompatibleMode: "API 模式",
    modelConfigTitle: "模型設定",
    customEndpointHint:
      "OAuth 提供商卡片會一直保留。切換到自訂模式後，請填寫 API Base URL 和 Model；API Key 可選。",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "例如：http://127.0.0.1:11434/v1/",
    customApiBaseHint: "OpenAI 相容端點，必須以 /v1/ 結尾。",
    customApiKey: "API Key",
    customApiKeyPlaceholder: "可選，留空則不傳送 Authorization",
    customApiKeyHint: "會保存在本機 Zotero 設定中。",
    customModel: "模型 *",
    customModelPlaceholder: "例如：llama3.1、deepseek-chat",
    customModelHint: "側邊欄會把自訂模型列在 OAuth 模型之後。",
    fetchModels: "取得模型",
    fetchModelsRunning: "正在取得模型...",
    fetchModelsDone: "已取得 {n} 個模型",
    fetchModelsFailed: "取得模型失敗：{msg}",
    fetchModelsEmpty: "端點未返回任何模型",
    customModeDisabled: "若要啟用自訂 API 模式，請填寫 API Base URL 和 Model。",
    customModeMissing: "仍缺少：{fields}",
    customModeReady: "自訂 API 模式已就緒。",
    installEnv: "安裝/更新環境",
    refreshAllModels: "重新整理全部模型",
    running: "執行中...",
    setupDone: "設定完成",
    setupPartialFail: "部分設定失敗",
    accounts: "已授權帳戶",
    models: "可用模型",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "OAuth 登入",
    oauthDelete: "移除授權",
    refreshModels: "重新整理模型",
    loggingIn: "正在啟動 OAuth 登入...",
    refreshingModels: "正在重新整理模型清單...",
    noModels: "尚無模型（請先完成 OAuth 登入並重新整理模型清單）",
    provider: "提供商",
    account: "帳戶",
    status: "狀態",
    modelId: "模型 ID",
    source: "來源",
    internalNote: "只有勾選的模型會出現在側邊欄下拉選單中。",
    systemPrompt: "自訂系統提示詞（可選）",
    systemPromptHint: "覆寫預設系統提示詞（留空則使用預設）",
    showAddText: "在閱讀器選取文字彈窗中顯示「Add Text」",
    showAddTextHint:
      "若不想在 Zotero 文字選取彈窗中顯示 Add Text 選項，可關閉此項。",
    showAllModels: "在下拉選單中顯示所有模型",
    showAllModelsHint:
      "啟用後顯示所有可用模型；停用後只顯示每個提供商的最佳模型。",
    hideTabNav: "分頁列：",
    hideTabNavOn: "隱藏",
    hideTabNavOff: "顯示",
    restoreDefaults: "還原預設值",
    restoreDefaultsConfirm:
      "確定要將所有設定還原為預設值嗎？\n\n這會重設所有模型配置、系統提示詞等。",
    restoreDefaultsDone: "已還原預設設定",
    clearAllHistory: "清除歷史",
    clearAllHistoryConfirm:
      "確定要清除全部聊天歷史嗎？\n\n此操作無法復原，所有對話歷史將被永久刪除。",
    clearAllHistoryDone: "已清除全部聊天歷史",
    clearAllHistoryRunning: "正在清除...",
    developing: "此功能仍在開發中，敬請期待！",
    oauthDeviceNotice:
      "OAuth 授權提醒\n\n這會啟動裝置碼 OAuth 流程，並要求你在瀏覽器中完成授權。\n\nOAuth Token 只會儲存在本機；使用 AI 服務可能產生費用。是否繼續？",
    oauthInstallNotice:
      "OAuth 授權提醒\n\n「安裝/更新環境」會安裝所需執行環境與 CLI 工具，並透過瀏覽器登入。\n\nOAuth Token 只會儲存在本機；使用 AI 服務可能產生費用。是否繼續？",
    authLoggedIn: "已登入",
    authNotLoggedIn: "未登入",
    authTokenMayBeExpired: "Token 可能已過期",
    authTokenExpired: "Token 已過期",
    authProject: "專案",
    authExpiresIn: "剩餘",
    authUsed: "已使用",
  },
  "ja-JP": {
    primaryConnectionMode: "主な接続モード",
    oauthProvidersMode: "OAuth プロバイダー",
    customCompatibleMode: "API モード",
    modelConfigTitle: "モデル設定",
    customEndpointHint:
      "OAuth プロバイダーカードは常に表示されます。カスタムモードでは API Base URL と Model を入力してください。API Key は任意です。",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "例：http://127.0.0.1:11434/v1/",
    customApiBaseHint:
      "OpenAI 互換エンドポイントです。末尾は /v1/ にしてください。",
    customApiKey: "API Key",
    customApiKeyPlaceholder: "任意。空欄の場合 Authorization は送信されません",
    customApiKeyHint: "ローカルの Zotero 設定に保存されます。",
    customModel: "モデル *",
    customModelPlaceholder: "例：llama3.1、deepseek-chat",
    customModelHint:
      "サイドバーではカスタムモデルが OAuth モデルの後に表示されます。",
    fetchModels: "モデルを取得",
    fetchModelsRunning: "モデルを取得中...",
    fetchModelsDone: "{n} 個のモデルを取得しました",
    fetchModelsFailed: "モデル取得に失敗しました：{msg}",
    fetchModelsEmpty: "エンドポイントからモデルが返されませんでした",
    customModeDisabled:
      "カスタム API モードを有効にするには API Base URL と Model を入力してください。",
    customModeMissing: "不足項目：{fields}",
    customModeReady: "カスタム API モードは使用可能です。",
    installEnv: "環境をインストール/更新",
    refreshAllModels: "すべてのモデルを更新",
    running: "実行中...",
    setupDone: "セットアップ完了",
    setupPartialFail: "一部のセットアップに失敗しました",
    accounts: "認証済みアカウント",
    models: "利用可能なモデル",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "OAuth ログイン",
    oauthDelete: "認証を削除",
    refreshModels: "モデルを更新",
    loggingIn: "OAuth ログインを開始中...",
    refreshingModels: "モデル一覧を更新中...",
    noModels:
      "モデルはまだありません（先に OAuth ログインとモデル更新を完了してください）",
    provider: "プロバイダー",
    account: "アカウント",
    status: "状態",
    modelId: "モデル ID",
    source: "ソース",
    internalNote:
      "チェックしたモデルだけがサイドバーのドロップダウンに表示されます。",
    systemPrompt: "カスタムシステムプロンプト（任意）",
    systemPromptHint:
      "既定のシステムプロンプトを上書きします（空欄なら既定を使用）",
    showAddText: "リーダーの選択ポップアップに「Add Text」を表示",
    showAddTextHint:
      "Zotero の文字選択ポップアップに Add Text オプションを表示したくない場合は無効にしてください。",
    showAllModels: "ドロップダウンにすべてのモデルを表示",
    showAllModelsHint:
      "有効にすると利用可能な全モデルを表示します。無効にすると各プロバイダーの推奨モデルのみ表示します。",
    hideTabNav: "タブバー：",
    hideTabNavOn: "非表示",
    hideTabNavOff: "表示",
    restoreDefaults: "既定値に戻す",
    restoreDefaultsConfirm:
      "すべての設定を既定値に戻しますか？\n\nモデル設定、システムプロンプトなどがリセットされます。",
    restoreDefaultsDone: "既定設定を復元しました",
    clearAllHistory: "履歴を消去",
    clearAllHistoryConfirm:
      "すべてのチャット履歴を消去しますか？\n\nこの操作は元に戻せません。すべての会話履歴が完全に削除されます。",
    clearAllHistoryDone: "すべてのチャット履歴を消去しました",
    clearAllHistoryRunning: "消去中...",
    developing: "この機能は開発中です。しばらくお待ちください。",
    oauthDeviceNotice:
      "OAuth 認証の注意\n\nデバイスコード OAuth フローを開始し、ブラウザーで認証を完了します。\n\nOAuth トークンはローカルにのみ保存されます。AI サービスの利用には料金が発生する場合があります。続行しますか？",
    oauthInstallNotice:
      "OAuth 認証の注意\n\n「環境をインストール/更新」は必要なランタイムと CLI ツールをインストールし、ブラウザーでログインします。\n\nOAuth トークンはローカルにのみ保存されます。AI サービスの利用には料金が発生する場合があります。続行しますか？",
    authLoggedIn: "ログイン済み",
    authNotLoggedIn: "未ログイン",
    authTokenMayBeExpired: "トークンの期限が切れている可能性があります",
    authTokenExpired: "トークン期限切れ",
    authProject: "プロジェクト",
    authExpiresIn: "残り",
    authUsed: "使用済み",
  },
  "ko-KR": {
    primaryConnectionMode: "기본 연결 모드",
    oauthProvidersMode: "OAuth 제공자",
    customCompatibleMode: "API 모드",
    modelConfigTitle: "모델 설정",
    customEndpointHint:
      "OAuth 제공자 카드는 항상 유지됩니다. 사용자 지정 모드에서는 API Base URL과 Model을 입력하세요. API Key는 선택 사항입니다.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "예: http://127.0.0.1:11434/v1/",
    customApiBaseHint: "OpenAI 호환 엔드포인트이며 /v1/로 끝나야 합니다.",
    customApiKey: "API Key",
    customApiKeyPlaceholder:
      "선택 사항입니다. 비워 두면 Authorization을 보내지 않습니다",
    customApiKeyHint: "로컬 Zotero 설정에 저장됩니다.",
    customModel: "모델 *",
    customModelPlaceholder: "예: llama3.1, deepseek-chat",
    customModelHint:
      "사이드바에서 사용자 지정 모델은 OAuth 모델 뒤에 표시됩니다.",
    fetchModels: "모델 가져오기",
    fetchModelsRunning: "모델을 가져오는 중...",
    fetchModelsDone: "모델 {n}개를 가져왔습니다",
    fetchModelsFailed: "모델 가져오기 실패: {msg}",
    fetchModelsEmpty: "엔드포인트가 모델을 반환하지 않았습니다",
    customModeDisabled:
      "사용자 지정 API 모드를 사용하려면 API Base URL과 Model을 입력하세요.",
    customModeMissing: "아직 부족한 항목: {fields}",
    customModeReady: "사용자 지정 API 모드가 준비되었습니다.",
    installEnv: "환경 설치/업데이트",
    refreshAllModels: "모든 모델 새로고침",
    running: "실행 중...",
    setupDone: "설정 완료",
    setupPartialFail: "일부 설정 실패",
    accounts: "인증된 계정",
    models: "사용 가능한 모델",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "OAuth 로그인",
    oauthDelete: "인증 제거",
    refreshModels: "모델 새로고침",
    loggingIn: "OAuth 로그인을 시작하는 중...",
    refreshingModels: "모델 목록을 새로고침하는 중...",
    noModels:
      "아직 모델이 없습니다(OAuth 로그인 후 모델 목록을 새로고침하세요)",
    provider: "제공자",
    account: "계정",
    status: "상태",
    modelId: "모델 ID",
    source: "출처",
    internalNote: "선택한 모델만 사이드바 드롭다운에 표시됩니다.",
    systemPrompt: "사용자 지정 시스템 프롬프트(선택 사항)",
    systemPromptHint:
      "기본 시스템 프롬프트를 덮어씁니다(비워 두면 기본값 사용)",
    showAddText: '리더 선택 팝업에 "Add Text" 표시',
    showAddTextHint:
      "Zotero 텍스트 선택 팝업에서 Add Text 옵션을 보이지 않게 하려면 비활성화하세요.",
    showAllModels: "드롭다운에 모든 모델 표시",
    showAllModelsHint:
      "활성화하면 사용 가능한 모든 모델을 표시합니다. 비활성화하면 제공자별 추천 모델만 표시합니다.",
    hideTabNav: "탭 바:",
    hideTabNavOn: "숨기기",
    hideTabNavOff: "표시",
    restoreDefaults: "기본값 복원",
    restoreDefaultsConfirm:
      "모든 설정을 기본값으로 복원하시겠습니까?\n\n모든 모델 설정, 시스템 프롬프트 등이 초기화됩니다.",
    restoreDefaultsDone: "기본 설정을 복원했습니다",
    clearAllHistory: "기록 지우기",
    clearAllHistoryConfirm:
      "모든 채팅 기록을 지우시겠습니까?\n\n이 작업은 되돌릴 수 없으며 모든 대화 기록이 영구적으로 삭제됩니다.",
    clearAllHistoryDone: "모든 채팅 기록을 지웠습니다",
    clearAllHistoryRunning: "지우는 중...",
    developing: "이 기능은 개발 중입니다. 잠시 기다려 주세요.",
    oauthDeviceNotice:
      "OAuth 인증 알림\n\n장치 코드 OAuth 흐름을 시작하고 브라우저에서 인증을 완료합니다.\n\nOAuth 토큰은 로컬에만 저장됩니다. AI 서비스 사용 시 요금이 발생할 수 있습니다. 계속하시겠습니까?",
    oauthInstallNotice:
      "OAuth 인증 알림\n\n「환경 설치/업데이트」는 필요한 런타임과 CLI 도구를 설치하고 브라우저에서 로그인합니다.\n\nOAuth 토큰은 로컬에만 저장됩니다. AI 서비스 사용 시 요금이 발생할 수 있습니다. 계속하시겠습니까?",
    authLoggedIn: "로그인됨",
    authNotLoggedIn: "로그인되지 않음",
    authTokenMayBeExpired: "토큰이 만료되었을 수 있음",
    authTokenExpired: "토큰 만료",
    authProject: "프로젝트",
    authExpiresIn: "남은 시간",
    authUsed: "사용됨",
  },
  "fr-FR": {
    primaryConnectionMode: "Mode de connexion principal",
    oauthProvidersMode: "Fournisseurs OAuth",
    customCompatibleMode: "Mode API",
    modelConfigTitle: "Configuration du modèle",
    customEndpointHint:
      "Les cartes des fournisseurs OAuth restent visibles. En mode personnalisé, renseignez API Base URL et Model ; API Key est facultatif.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "Exemple : http://127.0.0.1:11434/v1/",
    customApiBaseHint: "Point d'accès compatible OpenAI, avec /v1/ à la fin.",
    customApiKey: "API Key",
    customApiKeyPlaceholder:
      "Facultatif ; vide, aucun Authorization n'est envoyé",
    customApiKeyHint: "Enregistré dans les préférences locales de Zotero.",
    customModel: "Modèle *",
    customModelPlaceholder: "Exemple : llama3.1, deepseek-chat",
    customModelHint:
      "Les modèles personnalisés apparaissent après les modèles OAuth dans la barre latérale.",
    fetchModels: "Récupérer les modèles",
    fetchModelsRunning: "Récupération des modèles...",
    fetchModelsDone: "{n} modèles récupérés",
    fetchModelsFailed: "Échec de la récupération : {msg}",
    fetchModelsEmpty: "Le point d'accès n'a renvoyé aucun modèle",
    customModeDisabled:
      "Pour activer le mode API personnalisé, renseignez API Base URL et Model.",
    customModeMissing: "Champs manquants : {fields}",
    customModeReady: "Le mode API personnalisé est prêt.",
    installEnv: "Installer/mettre à jour l'environnement",
    refreshAllModels: "Actualiser tous les modèles",
    running: "En cours...",
    setupDone: "Configuration terminée",
    setupPartialFail: "Configuration partiellement échouée",
    accounts: "Comptes autorisés",
    models: "Modèles disponibles",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "Connexion OAuth",
    oauthDelete: "Supprimer l'autorisation",
    refreshModels: "Actualiser les modèles",
    loggingIn: "Démarrage de la connexion OAuth...",
    refreshingModels: "Actualisation de la liste des modèles...",
    noModels:
      "Aucun modèle pour l'instant (connectez-vous via OAuth puis actualisez la liste)",
    provider: "Fournisseur",
    account: "Compte",
    status: "Statut",
    modelId: "ID du modèle",
    source: "Source",
    internalNote:
      "Seuls les modèles cochés apparaissent dans la liste déroulante de la barre latérale.",
    systemPrompt: "Invite système personnalisée (facultatif)",
    systemPromptHint:
      "Remplace l'invite système par défaut (laisser vide pour utiliser la valeur par défaut)",
    showAddText:
      "Afficher « Add Text » dans la fenêtre de sélection du lecteur",
    showAddTextHint:
      "Désactivez cette option si vous ne voulez pas afficher Add Text dans le menu de sélection de texte de Zotero.",
    showAllModels: "Afficher tous les modèles dans la liste",
    showAllModelsHint:
      "Activé : affiche tous les modèles disponibles. Désactivé : affiche seulement les meilleurs modèles par fournisseur.",
    hideTabNav: "Barre d'onglets :",
    hideTabNavOn: "Masquer",
    hideTabNavOff: "Afficher",
    restoreDefaults: "Restaurer les valeurs par défaut",
    restoreDefaultsConfirm:
      "Restaurer tous les paramètres par défaut ?\n\nCela réinitialisera les configurations de modèles, l'invite système, etc.",
    restoreDefaultsDone: "Configuration par défaut restaurée",
    clearAllHistory: "Effacer l'historique",
    clearAllHistoryConfirm:
      "Effacer tout l'historique des conversations ?\n\nCette action est irréversible. Tout l'historique sera supprimé définitivement.",
    clearAllHistoryDone: "Tout l'historique a été effacé",
    clearAllHistoryRunning: "Effacement...",
    developing: "Cette fonctionnalité est en cours de développement.",
    oauthDeviceNotice:
      "Avis d'autorisation OAuth\n\nLe flux OAuth par code d'appareil va démarrer et vous devrez autoriser l'application dans le navigateur.\n\nLes jetons OAuth restent stockés localement. L'utilisation des services IA peut entraîner des frais. Continuer ?",
    oauthInstallNotice:
      "Avis d'autorisation OAuth\n\n« Installer/mettre à jour l'environnement » installe le runtime et les outils CLI nécessaires, puis ouvre la connexion dans le navigateur.\n\nLes jetons OAuth restent stockés localement. L'utilisation des services IA peut entraîner des frais. Continuer ?",
    authLoggedIn: "Connecté",
    authNotLoggedIn: "Non connecté",
    authTokenMayBeExpired: "le jeton a peut-être expiré",
    authTokenExpired: "jeton expiré",
    authProject: "projet",
    authExpiresIn: "expire dans",
    authUsed: "utilisé",
  },
  "de-DE": {
    primaryConnectionMode: "Primärer Verbindungsmodus",
    oauthProvidersMode: "OAuth-Anbieter",
    customCompatibleMode: "API-Modus",
    modelConfigTitle: "Modellkonfiguration",
    customEndpointHint:
      "OAuth-Anbieterkarten bleiben sichtbar. Im benutzerdefinierten Modus API Base URL und Model ausfüllen; API Key ist optional.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "Beispiel: http://127.0.0.1:11434/v1/",
    customApiBaseHint: "OpenAI-kompatibler Endpunkt, muss mit /v1/ enden.",
    customApiKey: "API Key",
    customApiKeyPlaceholder: "Optional; leer bedeutet ohne Authorization",
    customApiKeyHint: "Wird in den lokalen Zotero-Einstellungen gespeichert.",
    customModel: "Modell *",
    customModelPlaceholder: "Beispiel: llama3.1, deepseek-chat",
    customModelHint:
      "Benutzerdefinierte Modelle erscheinen in der Seitenleiste nach den OAuth-Modellen.",
    fetchModels: "Modelle abrufen",
    fetchModelsRunning: "Modelle werden abgerufen...",
    fetchModelsDone: "{n} Modelle abgerufen",
    fetchModelsFailed: "Modelle konnten nicht abgerufen werden: {msg}",
    fetchModelsEmpty: "Der Endpunkt hat keine Modelle zurückgegeben",
    customModeDisabled:
      "Zum Aktivieren des benutzerdefinierten API-Modus API Base URL und Model ausfüllen.",
    customModeMissing: "Noch fehlend: {fields}",
    customModeReady: "Benutzerdefinierter API-Modus ist bereit.",
    installEnv: "Umgebung installieren/aktualisieren",
    refreshAllModels: "Alle Modelle aktualisieren",
    running: "Wird ausgeführt...",
    setupDone: "Einrichtung abgeschlossen",
    setupPartialFail: "Einrichtung teilweise fehlgeschlagen",
    accounts: "Autorisierte Konten",
    models: "Verfügbare Modelle",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "OAuth-Anmeldung",
    oauthDelete: "Autorisierung entfernen",
    refreshModels: "Modelle aktualisieren",
    loggingIn: "OAuth-Anmeldung wird gestartet...",
    refreshingModels: "Modellliste wird aktualisiert...",
    noModels:
      "Noch keine Modelle (zuerst OAuth-Anmeldung abschließen und Modellliste aktualisieren)",
    provider: "Anbieter",
    account: "Konto",
    status: "Status",
    modelId: "Modell-ID",
    source: "Quelle",
    internalNote: "Nur markierte Modelle erscheinen im Seitenleisten-Dropdown.",
    systemPrompt: "Benutzerdefinierter System-Prompt (optional)",
    systemPromptHint:
      "Überschreibt den Standard-System-Prompt (leer lassen, um den Standard zu verwenden)",
    showAddText: '"Add Text" im Auswahl-Popup des Readers anzeigen',
    showAddTextHint:
      "Deaktivieren, wenn die Option Add Text im Zotero-Textauswahlmenü nicht angezeigt werden soll.",
    showAllModels: "Alle Modelle im Dropdown anzeigen",
    showAllModelsHint:
      "Aktiviert: alle verfügbaren Modelle. Deaktiviert: nur die besten Modelle je Anbieter.",
    hideTabNav: "Tableiste:",
    hideTabNavOn: "Ausblenden",
    hideTabNavOff: "Anzeigen",
    restoreDefaults: "Standardwerte wiederherstellen",
    restoreDefaultsConfirm:
      "Alle Einstellungen auf Standardwerte zurücksetzen?\n\nDadurch werden Modellkonfigurationen, System-Prompt usw. zurückgesetzt.",
    restoreDefaultsDone: "Standardkonfiguration wiederhergestellt",
    clearAllHistory: "Verlauf löschen",
    clearAllHistoryConfirm:
      "Den gesamten Chatverlauf löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden. Der gesamte Verlauf wird dauerhaft gelöscht.",
    clearAllHistoryDone: "Gesamter Chatverlauf gelöscht",
    clearAllHistoryRunning: "Wird gelöscht...",
    developing: "Diese Funktion befindet sich in Entwicklung.",
    oauthDeviceNotice:
      "OAuth-Autorisierungshinweis\n\nDer Device-Code-OAuth-Ablauf wird gestartet und die Autorisierung im Browser abgeschlossen.\n\nOAuth-Tokens werden nur lokal gespeichert. Die Nutzung von KI-Diensten kann Kosten verursachen. Fortfahren?",
    oauthInstallNotice:
      'OAuth-Autorisierungshinweis\n\n"Umgebung installieren/aktualisieren" installiert benötigte Laufzeitumgebungen und CLI-Tools und öffnet die Anmeldung im Browser.\n\nOAuth-Tokens werden nur lokal gespeichert. Die Nutzung von KI-Diensten kann Kosten verursachen. Fortfahren?',
    authLoggedIn: "Angemeldet",
    authNotLoggedIn: "Nicht angemeldet",
    authTokenMayBeExpired: "Token ist möglicherweise abgelaufen",
    authTokenExpired: "Token abgelaufen",
    authProject: "Projekt",
    authExpiresIn: "läuft ab in",
    authUsed: "verwendet",
  },
  "es-ES": {
    primaryConnectionMode: "Modo de conexión principal",
    oauthProvidersMode: "Proveedores OAuth",
    customCompatibleMode: "Modo API",
    modelConfigTitle: "Configuración del modelo",
    customEndpointHint:
      "Las tarjetas de proveedores OAuth permanecen visibles. En modo personalizado, rellena API Base URL y Model; API Key es opcional.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "Ejemplo: http://127.0.0.1:11434/v1/",
    customApiBaseHint: "Endpoint compatible con OpenAI; debe terminar en /v1/.",
    customApiKey: "API Key",
    customApiKeyPlaceholder:
      "Opcional; si está vacío no se envía Authorization",
    customApiKeyHint: "Se guarda en las preferencias locales de Zotero.",
    customModel: "Modelo *",
    customModelPlaceholder: "Ejemplo: llama3.1, deepseek-chat",
    customModelHint:
      "Los modelos personalizados aparecen después de los modelos OAuth en la barra lateral.",
    fetchModels: "Obtener modelos",
    fetchModelsRunning: "Obteniendo modelos...",
    fetchModelsDone: "{n} modelos obtenidos",
    fetchModelsFailed: "Error al obtener modelos: {msg}",
    fetchModelsEmpty: "El endpoint no devolvió modelos",
    customModeDisabled:
      "Para activar el modo API personalizado, rellena API Base URL y Model.",
    customModeMissing: "Falta: {fields}",
    customModeReady: "El modo API personalizado está listo.",
    installEnv: "Instalar/actualizar entorno",
    refreshAllModels: "Actualizar todos los modelos",
    running: "Ejecutando...",
    setupDone: "Configuración completada",
    setupPartialFail: "Configuración parcialmente fallida",
    accounts: "Cuentas autorizadas",
    models: "Modelos disponibles",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "Inicio de sesión OAuth",
    oauthDelete: "Eliminar autorización",
    refreshModels: "Actualizar modelos",
    loggingIn: "Iniciando sesión OAuth...",
    refreshingModels: "Actualizando lista de modelos...",
    noModels:
      "Aún no hay modelos (completa el inicio OAuth y actualiza la lista)",
    provider: "Proveedor",
    account: "Cuenta",
    status: "Estado",
    modelId: "ID del modelo",
    source: "Origen",
    internalNote:
      "Solo los modelos marcados aparecen en el desplegable de la barra lateral.",
    systemPrompt: "Prompt de sistema personalizado (opcional)",
    systemPromptHint:
      "Anula el prompt de sistema predeterminado (dejar vacío para usar el predeterminado)",
    showAddText: 'Mostrar "Add Text" en el popup de selección del lector',
    showAddTextHint:
      "Desactívalo si no quieres mostrar Add Text en el menú de selección de texto de Zotero.",
    showAllModels: "Mostrar todos los modelos en el desplegable",
    showAllModelsHint:
      "Activado: muestra todos los modelos disponibles. Desactivado: solo los mejores modelos por proveedor.",
    hideTabNav: "Barra de pestañas:",
    hideTabNavOn: "Ocultar",
    hideTabNavOff: "Mostrar",
    restoreDefaults: "Restaurar valores predeterminados",
    restoreDefaultsConfirm:
      "¿Restaurar todos los ajustes a los valores predeterminados?\n\nEsto restablecerá configuraciones de modelos, prompt de sistema, etc.",
    restoreDefaultsDone: "Configuración predeterminada restaurada",
    clearAllHistory: "Borrar historial",
    clearAllHistoryConfirm:
      "¿Borrar TODO el historial de chat?\n\nEsta acción no se puede deshacer. Todo el historial se eliminará permanentemente.",
    clearAllHistoryDone: "Todo el historial de chat fue borrado",
    clearAllHistoryRunning: "Borrando...",
    developing: "Esta función está en desarrollo.",
    oauthDeviceNotice:
      "Aviso de autorización OAuth\n\nSe iniciará el flujo OAuth con código de dispositivo y deberás autorizar la aplicación en el navegador.\n\nLos tokens OAuth se guardan solo localmente. El uso de servicios de IA puede generar cargos. ¿Continuar?",
    oauthInstallNotice:
      'Aviso de autorización OAuth\n\n"Instalar/actualizar entorno" instala el runtime y las herramientas CLI necesarias, y abre el inicio de sesión en el navegador.\n\nLos tokens OAuth se guardan solo localmente. El uso de servicios de IA puede generar cargos. ¿Continuar?',
    authLoggedIn: "Sesión iniciada",
    authNotLoggedIn: "Sin sesión",
    authTokenMayBeExpired: "el token puede haber expirado",
    authTokenExpired: "token expirado",
    authProject: "proyecto",
    authExpiresIn: "expira en",
    authUsed: "usado",
  },
  "ru-RU": {
    primaryConnectionMode: "Основной режим подключения",
    oauthProvidersMode: "Поставщики OAuth",
    customCompatibleMode: "Режим API",
    modelConfigTitle: "Настройка модели",
    customEndpointHint:
      "Карточки поставщиков OAuth остаются видимыми. В пользовательском режиме заполните API Base URL и Model; API Key необязателен.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "Например: http://127.0.0.1:11434/v1/",
    customApiBaseHint:
      "OpenAI-совместимый эндпоинт, должен заканчиваться на /v1/.",
    customApiKey: "API Key",
    customApiKeyPlaceholder:
      "Необязательно; если пусто, Authorization не отправляется",
    customApiKeyHint: "Сохраняется в локальных настройках Zotero.",
    customModel: "Модель *",
    customModelPlaceholder: "Например: llama3.1, deepseek-chat",
    customModelHint:
      "Пользовательские модели отображаются в боковой панели после моделей OAuth.",
    fetchModels: "Получить модели",
    fetchModelsRunning: "Получение моделей...",
    fetchModelsDone: "Получено моделей: {n}",
    fetchModelsFailed: "Не удалось получить модели: {msg}",
    fetchModelsEmpty: "Эндпоинт не вернул моделей",
    customModeDisabled:
      "Чтобы включить пользовательский режим API, заполните API Base URL и Model.",
    customModeMissing: "Не заполнено: {fields}",
    customModeReady: "Пользовательский режим API готов.",
    installEnv: "Установить/обновить среду",
    refreshAllModels: "Обновить все модели",
    running: "Выполняется...",
    setupDone: "Настройка завершена",
    setupPartialFail: "Настройка частично не удалась",
    accounts: "Авторизованные аккаунты",
    models: "Доступные модели",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "Вход OAuth",
    oauthDelete: "Удалить авторизацию",
    refreshModels: "Обновить модели",
    loggingIn: "Запуск входа OAuth...",
    refreshingModels: "Обновление списка моделей...",
    noModels:
      "Моделей пока нет (сначала выполните вход OAuth и обновите список)",
    provider: "Поставщик",
    account: "Аккаунт",
    status: "Статус",
    modelId: "ID модели",
    source: "Источник",
    internalNote:
      "В выпадающем списке боковой панели отображаются только отмеченные модели.",
    systemPrompt: "Пользовательский системный промпт (необязательно)",
    systemPromptHint:
      "Переопределяет системный промпт по умолчанию (оставьте пустым для значения по умолчанию)",
    showAddText: 'Показывать "Add Text" во всплывающем меню выделения в ридере',
    showAddTextHint:
      "Отключите, если не хотите показывать Add Text в меню выделения текста Zotero.",
    showAllModels: "Показывать все модели в выпадающем списке",
    showAllModelsHint:
      "Включено: все доступные модели. Выключено: только лучшие модели каждого поставщика.",
    hideTabNav: "Панель вкладок:",
    hideTabNavOn: "Скрыть",
    hideTabNavOff: "Показать",
    restoreDefaults: "Восстановить настройки по умолчанию",
    restoreDefaultsConfirm:
      "Восстановить все настройки по умолчанию?\n\nБудут сброшены конфигурации моделей, системный промпт и т. д.",
    restoreDefaultsDone: "Настройки по умолчанию восстановлены",
    clearAllHistory: "Очистить историю",
    clearAllHistoryConfirm:
      "Очистить ВСЮ историю чатов?\n\nЭто действие нельзя отменить. Вся история будет удалена навсегда.",
    clearAllHistoryDone: "Вся история чатов очищена",
    clearAllHistoryRunning: "Очистка...",
    developing: "Эта функция находится в разработке.",
    oauthDeviceNotice:
      "Уведомление об авторизации OAuth\n\nБудет запущен OAuth-поток с кодом устройства, а авторизация завершится в браузере.\n\nOAuth-токены хранятся только локально. Использование AI-сервисов может привести к расходам. Продолжить?",
    oauthInstallNotice:
      "Уведомление об авторизации OAuth\n\n«Установить/обновить среду» установит нужную среду выполнения и CLI-инструменты, затем откроет вход в браузере.\n\nOAuth-токены хранятся только локально. Использование AI-сервисов может привести к расходам. Продолжить?",
    authLoggedIn: "Выполнен вход",
    authNotLoggedIn: "Вход не выполнен",
    authTokenMayBeExpired: "токен мог истечь",
    authTokenExpired: "токен истек",
    authProject: "проект",
    authExpiresIn: "истекает через",
    authUsed: "использовано",
  },
  "pt-BR": {
    primaryConnectionMode: "Modo de conexão principal",
    oauthProvidersMode: "Provedores OAuth",
    customCompatibleMode: "Modo API",
    modelConfigTitle: "Configuração do modelo",
    customEndpointHint:
      "Os cartões de provedores OAuth permanecem visíveis. No modo personalizado, preencha API Base URL e Model; API Key é opcional.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "Exemplo: http://127.0.0.1:11434/v1/",
    customApiBaseHint:
      "Endpoint compatível com OpenAI; deve terminar com /v1/.",
    customApiKey: "API Key",
    customApiKeyPlaceholder: "Opcional; vazio não envia Authorization",
    customApiKeyHint: "Salvo nas preferências locais do Zotero.",
    customModel: "Modelo *",
    customModelPlaceholder: "Exemplo: llama3.1, deepseek-chat",
    customModelHint:
      "Modelos personalizados aparecem depois dos modelos OAuth na barra lateral.",
    fetchModels: "Buscar modelos",
    fetchModelsRunning: "Buscando modelos...",
    fetchModelsDone: "{n} modelos encontrados",
    fetchModelsFailed: "Falha ao buscar modelos: {msg}",
    fetchModelsEmpty: "O endpoint não retornou modelos",
    customModeDisabled:
      "Para ativar o modo API personalizado, preencha API Base URL e Model.",
    customModeMissing: "Ainda falta: {fields}",
    customModeReady: "O modo API personalizado está pronto.",
    installEnv: "Instalar/atualizar ambiente",
    refreshAllModels: "Atualizar todos os modelos",
    running: "Executando...",
    setupDone: "Configuração concluída",
    setupPartialFail: "Configuração parcialmente falhou",
    accounts: "Contas autorizadas",
    models: "Modelos disponíveis",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "Login OAuth",
    oauthDelete: "Remover autorização",
    refreshModels: "Atualizar modelos",
    loggingIn: "Iniciando login OAuth...",
    refreshingModels: "Atualizando lista de modelos...",
    noModels: "Ainda não há modelos (conclua o login OAuth e atualize a lista)",
    provider: "Provedor",
    account: "Conta",
    status: "Status",
    modelId: "ID do modelo",
    source: "Origem",
    internalNote: "Somente modelos marcados aparecem no menu da barra lateral.",
    systemPrompt: "Prompt de sistema personalizado (opcional)",
    systemPromptHint:
      "Substitui o prompt de sistema padrão (deixe vazio para usar o padrão)",
    showAddText: 'Mostrar "Add Text" no popup de seleção do leitor',
    showAddTextHint:
      "Desative se não quiser mostrar Add Text no menu de seleção de texto do Zotero.",
    showAllModels: "Mostrar todos os modelos no menu",
    showAllModelsHint:
      "Ativado: mostra todos os modelos disponíveis. Desativado: mostra só os melhores modelos por provedor.",
    hideTabNav: "Barra de abas:",
    hideTabNavOn: "Ocultar",
    hideTabNavOff: "Mostrar",
    restoreDefaults: "Restaurar padrões",
    restoreDefaultsConfirm:
      "Restaurar todas as configurações para os padrões?\n\nIsso redefinirá configurações de modelos, prompt de sistema etc.",
    restoreDefaultsDone: "Configuração padrão restaurada",
    clearAllHistory: "Limpar histórico",
    clearAllHistoryConfirm:
      "Limpar TODO o histórico de chat?\n\nEsta ação não pode ser desfeita. Todo o histórico será removido permanentemente.",
    clearAllHistoryDone: "Todo o histórico de chat foi limpo",
    clearAllHistoryRunning: "Limpando...",
    developing: "Este recurso está em desenvolvimento.",
    oauthDeviceNotice:
      "Aviso de autorização OAuth\n\nO fluxo OAuth por código de dispositivo será iniciado e a autorização será concluída no navegador.\n\nTokens OAuth ficam salvos apenas localmente. O uso de serviços de IA pode gerar cobranças. Continuar?",
    oauthInstallNotice:
      'Aviso de autorização OAuth\n\n"Instalar/atualizar ambiente" instala o runtime e as ferramentas CLI necessárias, depois abre o login no navegador.\n\nTokens OAuth ficam salvos apenas localmente. O uso de serviços de IA pode gerar cobranças. Continuar?',
    authLoggedIn: "Logado",
    authNotLoggedIn: "Não logado",
    authTokenMayBeExpired: "o token pode ter expirado",
    authTokenExpired: "token expirado",
    authProject: "projeto",
    authExpiresIn: "expira em",
    authUsed: "usado",
  },
  "ar-SA": {
    primaryConnectionMode: "وضع الاتصال الأساسي",
    oauthProvidersMode: "موفرو OAuth",
    customCompatibleMode: "وضع API",
    modelConfigTitle: "إعدادات النموذج",
    customEndpointHint:
      "تظل بطاقات موفري OAuth ظاهرة. في الوضع المخصص، أدخل API Base URL و Model؛ أما API Key فهو اختياري.",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "مثال: http://127.0.0.1:11434/v1/",
    customApiBaseHint: "نقطة نهاية متوافقة مع OpenAI ويجب أن تنتهي بـ /v1/.",
    customApiKey: "API Key",
    customApiKeyPlaceholder:
      "اختياري؛ إذا تُرك فارغًا فلن يتم إرسال Authorization",
    customApiKeyHint: "يُحفظ في إعدادات Zotero المحلية.",
    customModel: "النموذج *",
    customModelPlaceholder: "مثال: llama3.1 أو deepseek-chat",
    customModelHint: "تظهر النماذج المخصصة بعد نماذج OAuth في الشريط الجانبي.",
    fetchModels: "جلب النماذج",
    fetchModelsRunning: "جارٍ جلب النماذج...",
    fetchModelsDone: "تم جلب {n} نموذج",
    fetchModelsFailed: "فشل جلب النماذج: {msg}",
    fetchModelsEmpty: "لم تُرجع نقطة النهاية أي نماذج",
    customModeDisabled: "لتفعيل وضع API المخصص، أدخل API Base URL و Model.",
    customModeMissing: "ما زال ناقصًا: {fields}",
    customModeReady: "وضع API المخصص جاهز.",
    installEnv: "تثبيت/تحديث البيئة",
    refreshAllModels: "تحديث كل النماذج",
    running: "جارٍ التنفيذ...",
    setupDone: "اكتمل الإعداد",
    setupPartialFail: "فشل الإعداد جزئيًا",
    accounts: "الحسابات المصرح بها",
    models: "النماذج المتاحة",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "تسجيل دخول OAuth",
    oauthDelete: "إزالة التفويض",
    refreshModels: "تحديث النماذج",
    loggingIn: "جارٍ بدء تسجيل دخول OAuth...",
    refreshingModels: "جارٍ تحديث قائمة النماذج...",
    noModels: "لا توجد نماذج بعد (أكمل تسجيل دخول OAuth ثم حدّث القائمة)",
    provider: "الموفر",
    account: "الحساب",
    status: "الحالة",
    modelId: "معرّف النموذج",
    source: "المصدر",
    internalNote: "تظهر النماذج المحددة فقط في قائمة الشريط الجانبي.",
    systemPrompt: "موجه النظام المخصص (اختياري)",
    systemPromptHint:
      "يتجاوز موجه النظام الافتراضي (اتركه فارغًا لاستخدام الافتراضي)",
    showAddText: 'إظهار "Add Text" في نافذة تحديد النص بالقارئ',
    showAddTextHint:
      "عطّل هذا الخيار إذا كنت لا تريد إظهار Add Text في قائمة تحديد النص في Zotero.",
    showAllModels: "إظهار كل النماذج في القائمة",
    showAllModelsHint:
      "عند التفعيل تُعرض كل النماذج المتاحة؛ وعند التعطيل تُعرض أفضل النماذج لكل موفر فقط.",
    hideTabNav: "شريط التبويبات:",
    hideTabNavOn: "إخفاء",
    hideTabNavOff: "إظهار",
    restoreDefaults: "استعادة الافتراضيات",
    restoreDefaultsConfirm:
      "هل تريد استعادة كل الإعدادات إلى القيم الافتراضية؟\n\nسيؤدي ذلك إلى إعادة ضبط إعدادات النماذج وموجه النظام وغير ذلك.",
    restoreDefaultsDone: "تمت استعادة الإعدادات الافتراضية",
    clearAllHistory: "مسح السجل",
    clearAllHistoryConfirm:
      "هل تريد مسح كل سجل المحادثات؟\n\nلا يمكن التراجع عن هذا الإجراء وسيتم حذف كل السجل نهائيًا.",
    clearAllHistoryDone: "تم مسح كل سجل المحادثات",
    clearAllHistoryRunning: "جارٍ المسح...",
    developing: "هذه الميزة قيد التطوير.",
    oauthDeviceNotice:
      "تنبيه تفويض OAuth\n\nسيبدأ تدفق OAuth برمز الجهاز وستكمل التفويض في المتصفح.\n\nتُخزن رموز OAuth محليًا فقط. قد يترتب على استخدام خدمات الذكاء الاصطناعي رسوم. هل تريد المتابعة؟",
    oauthInstallNotice:
      "تنبيه تفويض OAuth\n\nسيقوم «تثبيت/تحديث البيئة» بتثبيت بيئة التشغيل وأدوات CLI المطلوبة، ثم فتح تسجيل الدخول في المتصفح.\n\nتُخزن رموز OAuth محليًا فقط. قد يترتب على استخدام خدمات الذكاء الاصطناعي رسوم. هل تريد المتابعة؟",
    authLoggedIn: "تم تسجيل الدخول",
    authNotLoggedIn: "لم يتم تسجيل الدخول",
    authTokenMayBeExpired: "قد تكون صلاحية الرمز منتهية",
    authTokenExpired: "انتهت صلاحية الرمز",
    authProject: "المشروع",
    authExpiresIn: "ينتهي خلال",
    authUsed: "مستخدم",
  },
  "hi-IN": {
    primaryConnectionMode: "मुख्य कनेक्शन मोड",
    oauthProvidersMode: "OAuth प्रदाता",
    customCompatibleMode: "API मोड",
    modelConfigTitle: "मॉडल कॉन्फ़िगरेशन",
    customEndpointHint:
      "OAuth प्रदाता कार्ड हमेशा दिखेंगे। कस्टम मोड में API Base URL और Model भरें; API Key वैकल्पिक है।",
    customApiBase: "API Base URL *",
    customApiBasePlaceholder: "उदाहरण: http://127.0.0.1:11434/v1/",
    customApiBaseHint: "OpenAI-संगत endpoint, जो /v1/ पर समाप्त होना चाहिए।",
    customApiKey: "API Key",
    customApiKeyPlaceholder:
      "वैकल्पिक; खाली होने पर Authorization नहीं भेजा जाएगा",
    customApiKeyHint: "स्थानीय Zotero सेटिंग्स में सहेजा जाएगा।",
    customModel: "मॉडल *",
    customModelPlaceholder: "उदाहरण: llama3.1, deepseek-chat",
    customModelHint: "कस्टम मॉडल साइडबार में OAuth मॉडल के बाद दिखाई देंगे।",
    fetchModels: "मॉडल लाएँ",
    fetchModelsRunning: "मॉडल लाए जा रहे हैं...",
    fetchModelsDone: "{n} मॉडल मिले",
    fetchModelsFailed: "मॉडल लाने में विफल: {msg}",
    fetchModelsEmpty: "Endpoint ने कोई मॉडल वापस नहीं किया",
    customModeDisabled:
      "कस्टम API मोड सक्षम करने के लिए API Base URL और Model भरें।",
    customModeMissing: "अभी बाकी है: {fields}",
    customModeReady: "कस्टम API मोड तैयार है।",
    installEnv: "Environment इंस्टॉल/अपडेट करें",
    refreshAllModels: "सभी मॉडल रीफ़्रेश करें",
    running: "चल रहा है...",
    setupDone: "सेटअप पूरा हुआ",
    setupPartialFail: "सेटअप आंशिक रूप से विफल",
    accounts: "अधिकृत खाते",
    models: "उपलब्ध मॉडल",
    language: "Language",
    langZh: "CN",
    langEn: "EN",
    oauthLogin: "OAuth लॉगिन",
    oauthDelete: "Authorization हटाएँ",
    refreshModels: "मॉडल रीफ़्रेश करें",
    loggingIn: "OAuth लॉगिन शुरू हो रहा है...",
    refreshingModels: "मॉडल सूची रीफ़्रेश हो रही है...",
    noModels:
      "अभी कोई मॉडल नहीं है (पहले OAuth लॉगिन पूरा करें और मॉडल सूची रीफ़्रेश करें)",
    provider: "प्रदाता",
    account: "खाता",
    status: "स्थिति",
    modelId: "मॉडल ID",
    source: "स्रोत",
    internalNote: "केवल चुने गए मॉडल साइडबार dropdown में दिखाई देंगे।",
    systemPrompt: "कस्टम सिस्टम प्रॉम्प्ट (वैकल्पिक)",
    systemPromptHint:
      "डिफ़ॉल्ट सिस्टम प्रॉम्प्ट को बदलता है (डिफ़ॉल्ट के लिए खाली छोड़ें)",
    showAddText: 'Reader selection popup में "Add Text" दिखाएँ',
    showAddTextHint:
      "यदि Zotero के text selection menu में Add Text विकल्प नहीं दिखाना चाहते, तो इसे बंद करें।",
    showAllModels: "Dropdown में सभी मॉडल दिखाएँ",
    showAllModelsHint:
      "चालू होने पर सभी उपलब्ध मॉडल दिखेंगे। बंद होने पर हर प्रदाता के केवल श्रेष्ठ मॉडल दिखेंगे।",
    hideTabNav: "Tab Bar:",
    hideTabNavOn: "छिपाएँ",
    hideTabNavOff: "दिखाएँ",
    restoreDefaults: "डिफ़ॉल्ट पुनर्स्थापित करें",
    restoreDefaultsConfirm:
      "क्या आप सभी सेटिंग्स को डिफ़ॉल्ट पर लौटाना चाहते हैं?\n\nइससे सभी मॉडल कॉन्फ़िगरेशन, सिस्टम प्रॉम्प्ट आदि रीसेट हो जाएँगे।",
    restoreDefaultsDone: "डिफ़ॉल्ट कॉन्फ़िगरेशन पुनर्स्थापित हुआ",
    clearAllHistory: "इतिहास साफ़ करें",
    clearAllHistoryConfirm:
      "क्या आप पूरा चैट इतिहास साफ़ करना चाहते हैं?\n\nयह कार्य वापस नहीं होगा। पूरा वार्तालाप इतिहास स्थायी रूप से हट जाएगा।",
    clearAllHistoryDone: "पूरा चैट इतिहास साफ़ हुआ",
    clearAllHistoryRunning: "साफ़ हो रहा है...",
    developing: "यह सुविधा विकास में है।",
    oauthDeviceNotice:
      "OAuth authorization सूचना\n\nDevice Code OAuth flow शुरू होगा और आपको browser में authorization पूरा करना होगा।\n\nOAuth tokens केवल local रूप से सहेजे जाते हैं। AI सेवाओं के उपयोग से शुल्क लग सकता है। जारी रखें?",
    oauthInstallNotice:
      'OAuth authorization सूचना\n\n"Environment इंस्टॉल/अपडेट करें" आवश्यक runtime और CLI tools इंस्टॉल करेगा, फिर browser में login खोलेगा।\n\nOAuth tokens केवल local रूप से सहेजे जाते हैं। AI सेवाओं के उपयोग से शुल्क लग सकता है। जारी रखें?',
    authLoggedIn: "लॉगिन है",
    authNotLoggedIn: "लॉगिन नहीं है",
    authTokenMayBeExpired: "token समाप्त हो सकता है",
    authTokenExpired: "token समाप्त",
    authProject: "प्रोजेक्ट",
    authExpiresIn: "समाप्त होने में",
    authUsed: "उपयोग हुआ",
  },
};
const SETTINGS_I18N_OVERRIDES: Partial<Record<Lang, Dict>> = {
  "zh-TW": {
    console: "控制台",
    advanced: "進階",
    copy: "複製",
    providerLabel: "提供商標籤:",
    addModelLabel: "模型 ID:",
    addModelPlaceholder: "輸入模型 ID",
    manualAdd: "手動新增",
    all: "全選",
    clear: "清空",
    saveSelectedModels: "💾 儲存勾選模型",
    saved: "✔ 已儲存",
    delete: "刪除",
    defaults: "預設",
    selectAll: "全選",
    removeProvider: "刪除提供商",
    removeProviderConfirm: "確定要刪除提供商「{provider}」及其所有模型嗎？",
    removeModel: "刪除模型",
    testingModels: "✔ {n} 個模型，正在測試可用性...",
    pingSummary: "✔ {ok} 可用, {fail} 不可用",
    selectedSummary: "已勾選 {selected}/{total}",
    refreshFailed: "✖ 重新整理失敗: {msg}",
    systemPromptPlaceholder: "給 AI 助手的自訂指令...",
  },
  "ja-JP": {
    console: "コンソール",
    advanced: "詳細",
    copy: "コピー",
    providerLabel: "プロバイダーラベル:",
    addModelLabel: "モデル ID:",
    addModelPlaceholder: "モデル ID を入力",
    manualAdd: "手動追加",
    all: "すべて",
    clear: "クリア",
    saveSelectedModels: "💾 選択モデルを保存",
    saved: "✔ 保存済み",
    delete: "削除",
    defaults: "既定",
    selectAll: "すべて選択",
    removeProvider: "プロバイダーを削除",
    removeProviderConfirm:
      "プロバイダー「{provider}」とすべてのモデルを削除しますか？",
    removeModel: "モデルを削除",
    testingModels: "✔ {n} 個のモデル、利用可能性をテスト中...",
    pingSummary: "✔ {ok} 使用可, {fail} 失敗",
    selectedSummary: "{selected}/{total} 選択済み",
    refreshFailed: "✖ 更新失敗: {msg}",
    systemPromptPlaceholder: "AI アシスタントへのカスタム指示...",
  },
  "ko-KR": {
    console: "콘솔",
    advanced: "고급",
    copy: "복사",
    providerLabel: "제공자 라벨:",
    addModelLabel: "모델 ID:",
    addModelPlaceholder: "모델 ID 입력",
    manualAdd: "수동 추가",
    all: "전체 선택",
    clear: "지우기",
    saveSelectedModels: "💾 선택한 모델 저장",
    saved: "✔ 저장됨",
    delete: "삭제",
    defaults: "기본값",
    selectAll: "전체 선택",
    removeProvider: "제공자 제거",
    removeProviderConfirm: '제공자 "{provider}" 및 모든 모델을 제거할까요?',
    removeModel: "모델 제거",
    testingModels: "✔ 모델 {n}개, 사용 가능 여부 테스트 중...",
    pingSummary: "✔ {ok}개 사용 가능, {fail}개 실패",
    selectedSummary: "{selected}/{total} 선택됨",
    refreshFailed: "✖ 새로고침 실패: {msg}",
    systemPromptPlaceholder: "AI 어시스턴트용 사용자 지정 지침...",
  },
  "fr-FR": {
    console: "Console",
    advanced: "Avancé",
    copy: "Copier",
    providerLabel: "Libellé du fournisseur :",
    addModelLabel: "ID du modèle :",
    addModelPlaceholder: "Saisir l'ID du modèle",
    manualAdd: "Ajout manuel",
    all: "Tout",
    clear: "Effacer",
    saveSelectedModels: "💾 Enregistrer les modèles",
    saved: "✔ Enregistré",
    delete: "Supprimer",
    defaults: "Défauts",
    selectAll: "Tout sélectionner",
    removeProvider: "Supprimer le fournisseur",
    removeProviderConfirm:
      "Supprimer le fournisseur « {provider} » et tous ses modèles ?",
    removeModel: "Supprimer le modèle",
    testingModels: "✔ {n} modèles, test de disponibilité...",
    pingSummary: "✔ {ok} OK, {fail} échecs",
    selectedSummary: "{selected}/{total} sélectionnés",
    refreshFailed: "✖ Échec de l'actualisation : {msg}",
    systemPromptPlaceholder:
      "Instructions personnalisées pour l'assistant IA...",
  },
  "de-DE": {
    console: "Konsole",
    advanced: "Erweitert",
    copy: "Kopieren",
    providerLabel: "Anbieterlabel:",
    addModelLabel: "Modell-ID:",
    addModelPlaceholder: "Modell-ID eingeben",
    manualAdd: "Manuell hinzufügen",
    all: "Alle",
    clear: "Leeren",
    saveSelectedModels: "💾 Modelle speichern",
    saved: "✔ Gespeichert",
    delete: "Löschen",
    defaults: "Standards",
    selectAll: "Alle auswählen",
    removeProvider: "Anbieter entfernen",
    removeProviderConfirm: "Anbieter „{provider}“ und alle Modelle entfernen?",
    removeModel: "Modell entfernen",
    testingModels: "✔ {n} Modelle, Verfügbarkeit wird getestet...",
    pingSummary: "✔ {ok} OK, {fail} fehlgeschlagen",
    selectedSummary: "{selected}/{total} ausgewählt",
    refreshFailed: "✖ Aktualisierung fehlgeschlagen: {msg}",
    systemPromptPlaceholder:
      "Benutzerdefinierte Anweisungen für den KI-Assistenten...",
  },
  "es-ES": {
    console: "Consola",
    advanced: "Avanzado",
    copy: "Copiar",
    providerLabel: "Etiqueta del proveedor:",
    addModelLabel: "ID del modelo:",
    addModelPlaceholder: "Introduce el ID del modelo",
    manualAdd: "Añadir manualmente",
    all: "Todo",
    clear: "Borrar",
    saveSelectedModels: "💾 Guardar modelos",
    saved: "✔ Guardado",
    delete: "Eliminar",
    defaults: "Predeterminados",
    selectAll: "Seleccionar todo",
    removeProvider: "Eliminar proveedor",
    removeProviderConfirm:
      "¿Eliminar el proveedor «{provider}» y todos sus modelos?",
    removeModel: "Eliminar modelo",
    testingModels: "✔ {n} modelos, probando disponibilidad...",
    pingSummary: "✔ {ok} OK, {fail} fallidos",
    selectedSummary: "{selected}/{total} seleccionados",
    refreshFailed: "✖ Error al actualizar: {msg}",
    systemPromptPlaceholder:
      "Instrucciones personalizadas para el asistente de IA...",
  },
  "ru-RU": {
    console: "Консоль",
    advanced: "Дополнительно",
    copy: "Копировать",
    providerLabel: "Метка провайдера:",
    addModelLabel: "ID модели:",
    addModelPlaceholder: "Введите ID модели",
    manualAdd: "Добавить вручную",
    all: "Все",
    clear: "Очистить",
    saveSelectedModels: "💾 Сохранить модели",
    saved: "✔ Сохранено",
    delete: "Удалить",
    defaults: "По умолчанию",
    selectAll: "Выбрать все",
    removeProvider: "Удалить провайдера",
    removeProviderConfirm: "Удалить провайдера «{provider}» и все его модели?",
    removeModel: "Удалить модель",
    testingModels: "✔ {n} моделей, проверка доступности...",
    pingSummary: "✔ {ok} доступно, {fail} не удалось",
    selectedSummary: "Выбрано {selected}/{total}",
    refreshFailed: "✖ Ошибка обновления: {msg}",
    systemPromptPlaceholder: "Пользовательские инструкции для AI-ассистента...",
  },
  "pt-BR": {
    console: "Console",
    advanced: "Avançado",
    copy: "Copiar",
    providerLabel: "Rótulo do provedor:",
    addModelLabel: "ID do modelo:",
    addModelPlaceholder: "Digite o ID do modelo",
    manualAdd: "Adicionar manualmente",
    all: "Tudo",
    clear: "Limpar",
    saveSelectedModels: "💾 Salvar modelos",
    saved: "✔ Salvo",
    delete: "Excluir",
    defaults: "Padrões",
    selectAll: "Selecionar tudo",
    removeProvider: "Remover provedor",
    removeProviderConfirm:
      'Remover o provedor "{provider}" e todos os seus modelos?',
    removeModel: "Remover modelo",
    testingModels: "✔ {n} modelos, testando disponibilidade...",
    pingSummary: "✔ {ok} OK, {fail} falharam",
    selectedSummary: "{selected}/{total} selecionados",
    refreshFailed: "✖ Falha ao atualizar: {msg}",
    systemPromptPlaceholder:
      "Instruções personalizadas para o assistente de IA...",
  },
  "ar-SA": {
    console: "وحدة التحكم",
    advanced: "متقدم",
    copy: "نسخ",
    providerLabel: "تسمية المزود:",
    addModelLabel: "معرّف النموذج:",
    addModelPlaceholder: "أدخل معرّف النموذج",
    manualAdd: "إضافة يدوية",
    all: "الكل",
    clear: "مسح",
    saveSelectedModels: "💾 حفظ النماذج",
    saved: "✔ تم الحفظ",
    delete: "حذف",
    defaults: "الافتراضي",
    selectAll: "تحديد الكل",
    removeProvider: "إزالة المزود",
    removeProviderConfirm: 'إزالة المزود "{provider}" وكل نماذجه؟',
    removeModel: "إزالة النموذج",
    testingModels: "✔ {n} نموذج، جارٍ اختبار التوفر...",
    pingSummary: "✔ {ok} متاح، {fail} فشل",
    selectedSummary: "تم تحديد {selected}/{total}",
    refreshFailed: "✖ فشل التحديث: {msg}",
    systemPromptPlaceholder: "تعليمات مخصصة لمساعد الذكاء الاصطناعي...",
  },
  "hi-IN": {
    console: "कंसोल",
    advanced: "उन्नत",
    copy: "कॉपी",
    providerLabel: "प्रदाता लेबल:",
    addModelLabel: "मॉडल ID:",
    addModelPlaceholder: "मॉडल ID दर्ज करें",
    manualAdd: "मैन्युअल जोड़ें",
    all: "सभी",
    clear: "साफ़ करें",
    saveSelectedModels: "💾 मॉडल सहेजें",
    saved: "✔ सहेजा गया",
    delete: "हटाएँ",
    defaults: "डिफ़ॉल्ट",
    selectAll: "सभी चुनें",
    removeProvider: "प्रदाता हटाएँ",
    removeProviderConfirm: 'प्रदाता "{provider}" और उसके सभी मॉडल हटाएँ?',
    removeModel: "मॉडल हटाएँ",
    testingModels: "✔ {n} मॉडल, उपलब्धता जाँची जा रही है...",
    pingSummary: "✔ {ok} उपलब्ध, {fail} विफल",
    selectedSummary: "{selected}/{total} चुने गए",
    refreshFailed: "✖ रीफ़्रेश विफल: {msg}",
    systemPromptPlaceholder: "AI assistant के लिए कस्टम निर्देश...",
  },
};
const SETTINGS_I18N_SELECTION_TRANSLATE_OVERRIDES: Partial<Record<Lang, Dict>> =
  {
    "zh-TW": {
      selectionTranslateColdStartHint:
        "冷啟動會在某篇文獻首次啟用劃詞翻譯時執行一次：AIdea 讀取全文，產生精簡概述與專業術語摘要，並儲存在本機。之後劃詞翻譯會重用這份本機快取作為上下文；需要重建時可清理冷啟動快取。",
    },
    "ja-JP": {
      selectionTranslateColdStartHint:
        "コールドスタートは、文献で初めて選択範囲翻訳を有効にしたときに一度だけ実行されます。AIdea が全文を読み、要約と専門用語の短いまとめを作成してローカルに保存します。以後の翻訳ではこのローカルキャッシュを文脈として再利用します。作り直す場合はコールドスタートキャッシュをクリアしてください。",
    },
    "ko-KR": {
      selectionTranslateColdStartHint:
        "콜드 스타트는 문헌에서 선택 번역을 처음 사용할 때 한 번 실행됩니다. AIdea가 전체 텍스트를 읽고 간단한 개요와 전문 용어 요약을 만든 뒤 로컬에 저장합니다. 이후 선택 번역은 이 로컬 캐시를 문맥으로 재사용합니다. 다시 만들려면 콜드 스타트 캐시를 지우세요.",
    },
    "fr-FR": {
      selectionTranslateColdStartHint:
        "Le démarrage à froid s'exécute une fois par article lorsque la traduction de sélection est activée : AIdea lit le texte complet, crée un aperçu compact et un résumé terminologique, puis les stocke localement. Les traductions suivantes réutilisent ce cache local comme contexte ; effacez le cache pour le régénérer.",
    },
    "de-DE": {
      selectionTranslateColdStartHint:
        "Der Kaltstart wird pro Dokument einmal ausgeführt, wenn die Markierungsübersetzung aktiviert ist: AIdea liest den Volltext, erstellt eine kurze Übersicht und eine Fachbegriff-Zusammenfassung und speichert sie lokal. Spätere Übersetzungen verwenden diesen lokalen Cache als Kontext; zum Neuerstellen den Kaltstart-Cache leeren.",
    },
    "es-ES": {
      selectionTranslateColdStartHint:
        "El arranque en frío se ejecuta una vez por documento cuando se activa la traducción de selección: AIdea lee el texto completo, crea una descripción breve y un resumen de términos técnicos, y lo guarda localmente. Las traducciones posteriores reutilizan esa caché local como contexto; borra la caché para regenerarla.",
    },
    "ru-RU": {
      selectionTranslateColdStartHint:
        "Холодный запуск выполняется один раз для статьи при включении перевода выделенного текста: AIdea читает полный текст, создает краткий обзор и сводку терминов, затем сохраняет их локально. Последующие переводы используют этот локальный кэш как контекст; очистите кэш, чтобы создать его заново.",
    },
    "pt-BR": {
      selectionTranslateColdStartHint:
        "A inicialização a frio é executada uma vez por artigo quando a tradução por seleção é ativada: o AIdea lê o texto completo, cria um resumo compacto e uma síntese de termos técnicos, e salva tudo localmente. As próximas traduções reutilizam esse cache local como contexto; limpe o cache para recriá-lo.",
    },
    "ar-SA": {
      selectionTranslateColdStartHint:
        "يعمل البدء البارد مرة واحدة لكل مقالة عند تفعيل ترجمة التحديد: يقرأ AIdea النص الكامل، وينشئ ملخصا موجزا وملخصا للمصطلحات المتخصصة، ثم يحفظهما محليا. تستخدم الترجمات اللاحقة هذا التخزين المحلي كسياق؛ امسح ذاكرة البدء البارد لإعادة إنشائها.",
    },
    "hi-IN": {
      selectionTranslateColdStartHint:
        "कोल्ड स्टार्ट हर लेख के लिए चयन अनुवाद पहली बार सक्षम होने पर एक बार चलता है: AIdea पूरा पाठ पढ़ता है, संक्षिप्त सार और तकनीकी शब्दों का सारांश बनाता है, और उसे स्थानीय रूप से सहेजता है। बाद के चयन अनुवाद इसी स्थानीय कैश को संदर्भ के रूप में उपयोग करते हैं; इसे फिर से बनाने के लिए कोल्ड-स्टार्ट कैश साफ करें।",
    },
  };
const tt = (l: Lang): Dict =>
  ({
    ...(I18N["en-US"] as unknown as Dict),
    ...((I18N as unknown as Partial<Record<Lang, Dict>>)[l] || {}),
    ...(SETTINGS_I18N_BASE_OVERRIDES[l] || {}),
    ...(SETTINGS_I18N_OVERRIDES[l] || {}),
    ...(SETTINGS_I18N_SELECTION_TRANSLATE_OVERRIDES[l] || {}),
  }) as Dict;

function localizeAuthStatus(raw: string, L: Dict): string {
  const status = String(raw || "");
  if (!status) return "";
  if (/^Not logged in$/i.test(status)) return L.authNotLoggedIn;
  if (/^Logged in \(token may be expired\)$/i.test(status)) {
    return `${L.authLoggedIn} (${L.authTokenMayBeExpired})`;
  }
  return status
    .replace(/\bNot logged in\b/g, L.authNotLoggedIn)
    .replace(/\bLogged in\b/g, L.authLoggedIn)
    .replace(/\btoken may be expired\b/gi, L.authTokenMayBeExpired)
    .replace(/\btoken expired\b/gi, L.authTokenExpired)
    .replace(/\bproject:\s*/gi, `${L.authProject}: `)
    .replace(/\bexpires in\s*/gi, `${L.authExpiresIn} `)
    .replace(/\bused\b/gi, L.authUsed);
}

export function normalizeCustomApiBaseInput(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return `${trimmed.replace(/\/+$/, "")}/`;
}

/**
 * Generate a human-readable provider label from an API Base URL.
 * e.g. "https://api.deepseek.com/" → "api.deepseek.com"
 *      "http://localhost:8080/v1/" → "localhost:8080-v1"
 */
function generateProviderLabel(url: string): string {
  let label = String(url || "").trim();
  if (!label) return "custom api";
  // 1. Remove trailing slashes
  label = label.replace(/\/+$/, "");
  // 2. Remove protocol (everything up to and including "://")
  label = label.replace(/^[^:]+:\/\//, "");
  // 3. Replace "//" with "-"
  label = label.replace(/\/\//g, "-");
  // 4. Replace "/" with "-"
  label = label.replace(/\//g, "-");
  // 5. Trim leading/trailing "-"
  label = label.replace(/^-+|-+$/g, "");
  return label || "custom api";
}

export function getCustomEndpointMissingFields(
  apiBase: string,
  model: string,
): Array<"apiBase" | "model"> {
  const missing: Array<"apiBase" | "model"> = [];
  if (!String(apiBase || "").trim()) missing.push("apiBase");
  if (!String(model || "").trim()) missing.push("model");
  return missing;
}

function createNode<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  style?: string,
  text?: string,
) {
  const el = doc.createElementNS(HTML_NS, tag) as HTMLElementTagNameMap[K];
  if (style) el.setAttribute("style", style);
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Create an element with CSS class names (space-separated) instead of inline styles. */
function createEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
) {
  const el = doc.createElementNS(HTML_NS, tag) as HTMLElementTagNameMap[K];
  if (className) {
    for (const c of className.split(/\s+/)) {
      if (c) el.classList.add(c);
    }
  }
  if (text !== undefined) el.textContent = text;
  return el;
}

function parseModelCache(): Partial<Record<string, ProviderModelOption[]>> {
  const raw = (getPref("oauthModelListCache") || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<string, ProviderModelOption[]>
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveModelCache(cache: Partial<Record<string, ProviderModelOption[]>>) {
  setPref("oauthModelListCache", JSON.stringify(cache));
}

function parseModelSelectionState(): ProviderModelSelectionCache {
  return parseModelSelectionCache(getPref("oauthModelSelectionCache"));
}

function saveModelSelectionState(selectionCache: ProviderModelSelectionCache) {
  setPref(
    "oauthModelSelectionCache",
    serializeModelSelectionCache(selectionCache),
  );
}

export function syncSidebarModelPrefsFromSelection(
  cache: Partial<Record<string, ProviderModelOption[]>>,
  selectionCache: ProviderModelSelectionCache,
) {
  const flattened: Array<{
    provider: string;
    model: string;
    apiBase?: string;
    apiKey?: string;
  }> = [];
  const activeProviders = Array.from(
    new Set([...PROVIDERS, ...Object.keys(cache)]),
  );

  for (const provider of activeProviders) {
    const selected = new Set(
      reconcileProviderModelSelection(
        provider as OAuthProviderId,
        cache[provider as OAuthProviderId] || [],
        selectionCache,
      ).map(normalizeModelId),
    );
    for (const row of cache[provider as OAuthProviderId] || []) {
      const id = String(row.id || "").trim();
      if (!id || !selected.has(normalizeModelId(id))) continue;
      flattened.push({
        provider,
        model: id,
        apiBase: row.apiBase,
        apiKey: row.apiKey,
      });
      if (flattened.length >= 4) break;
    }
    if (flattened.length >= 4) break;
  }

  PROFILE_KEYS.forEach((suffix, idx) => {
    const entry = flattened[idx];
    if (entry && entry.apiBase) {
      setPref(`apiBase${suffix}` as PrefKey, entry.apiBase);
      setPref(`apiKey${suffix}` as PrefKey, entry.apiKey || "");
    } else {
      setPref(
        `apiBase${suffix}` as PrefKey,
        entry ? providerToMarker(entry.provider as OAuthProviderId) : "",
      );
      setPref(`apiKey${suffix}` as PrefKey, "");
    }
    setPref(`model${suffix}` as PrefKey, entry ? entry.model : "");
  });

  const first = flattened[0];
  if (getPrimaryConnectionMode() !== "custom") {
    if (first && first.apiBase) {
      setPref("apiBase", first.apiBase);
      setPref("apiKey", first.apiKey || "");
    } else {
      setPref(
        "apiBase",
        first ? providerToMarker(first.provider as OAuthProviderId) : "",
      );
      setPref("apiKey", "");
    }
    setPref("model", first ? first.model : "");
  }
}

/**
 * Re-render shortcut bubbles in every open sidebar panel across all Zotero windows.
 * This allows changes made in the settings page (e.g. Restore Defaults) to take
 * effect immediately without requiring the user to switch tabs.
 */
function refreshAllSidebarShortcuts(
  log?: (msg: string, color?: string) => void,
): void {
  try {
    const allDocs = new Set<Document>();

    // Strategy 1: Zotero.getMainWindows()
    try {
      const wins: Window[] = Zotero.getMainWindows?.() || [];
      for (const w of wins) {
        if (w?.document) allDocs.add(w.document);
      }
    } catch {
      /* ignore */
    }

    // Strategy 2: Zotero.getMainWindow()
    try {
      const mainWin: Window | null = Zotero.getMainWindow?.() || null;
      if (mainWin?.document) allDocs.add(mainWin.document);
    } catch {
      /* ignore */
    }

    // Strategy 3: Services.wm
    try {
      const wm = Cc["@mozilla.org/appshell/window-mediator;1"]?.getService(
        Ci.nsIWindowMediator,
      );
      if (wm) {
        const enumerator = wm.getEnumerator("navigator:browser");
        while (enumerator.hasMoreElements()) {
          const w = enumerator.getNext() as Window;
          if (w?.document) allDocs.add(w.document);
        }
      }
    } catch {
      /* ignore */
    }

    log?.(`Panel refresh: found ${allDocs.size} window(s)`, "#374151");

    let panelsFound = 0;
    let refreshed = 0;
    const panelI18n = getPanelI18n();
    for (const doc of allDocs) {
      const panelRoots = doc.querySelectorAll("#llm-main");
      panelsFound += panelRoots.length;
      for (const root of panelRoots) {
        const body = root.parentElement || root;
        const item = shortcutRenderItemState.get(body) ?? null;
        void renderShortcuts(body, item);

        // Update input placeholder
        const input = body.querySelector(
          "#llm-input",
        ) as HTMLTextAreaElement | null;
        if (input) {
          const hasItem =
            body.querySelector(".llm-user-selected-text") ||
            body.getAttribute("data-item-id");
          input.placeholder = hasItem
            ? panelI18n.placeholderPaper
            : panelI18n.placeholderGlobal;
        }

        // Update status bar
        const statusBar = body.querySelector(
          "#llm-status",
        ) as HTMLElement | null;
        if (statusBar) {
          const text = statusBar.textContent?.trim() || "";
          // Only update recognizable status strings
          if (text === "就绪" || text === "Ready") {
            statusBar.textContent = panelI18n.statusReady;
          }
        }

        // Update send button
        const sendBtn = body.querySelector("#llm-send") as HTMLElement | null;
        if (sendBtn) sendBtn.textContent = panelI18n.send;

        refreshed++;
      }
    }
    log?.(
      `Panel refresh: ${panelsFound} panel(s) found, ${refreshed} refreshed`,
      refreshed > 0 ? "#065f46" : "#b45309",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log?.(`Panel refresh failed: ${msg}`, "#991b1b");
  }
}
/**
 * Toggle the auto-hide CSS class on every `#llm-tab-nav` across all Zotero windows.
 */
export function applyHideTabNavToAllPanels(hide: boolean): void {
  try {
    const allDocs = new Set<Document>();
    try {
      const wins: Window[] = Zotero.getMainWindows?.() || [];
      for (const w of wins) {
        if (w?.document) allDocs.add(w.document);
      }
    } catch {
      /* ignore */
    }
    try {
      const mainWin: Window | null = Zotero.getMainWindow?.() || null;
      if (mainWin?.document) allDocs.add(mainWin.document);
    } catch {
      /* ignore */
    }
    try {
      const wm = Cc["@mozilla.org/appshell/window-mediator;1"]?.getService(
        Ci.nsIWindowMediator,
      );
      if (wm) {
        const enumerator = wm.getEnumerator("navigator:browser");
        while (enumerator.hasMoreElements()) {
          const w = enumerator.getNext() as Window;
          if (w?.document) allDocs.add(w.document);
        }
      }
    } catch {
      /* ignore */
    }

    for (const doc of allDocs) {
      doc.querySelectorAll("#llm-tab-nav").forEach((nav: Element) => {
        nav.classList.toggle("llm-tab-nav--auto-hide", hide);
      });
    }
  } catch {
    /* ignore */
  }
}

export async function bootstrapSettingTab(
  doc: Document,
  scrollContainer: HTMLElement,
  consoleContainer: HTMLElement,
) {
  const win = doc.defaultView;
  if (!win) return;
  await new Promise((r) => setTimeout(r, 80));

  let lang = getLang();
  let L = tt(lang);
  let cache = parseModelCache();
  let selectionCache = parseModelSelectionState();
  const initialSelection = reconcileModelSelectionCache(cache, selectionCache);
  if (initialSelection.changed) {
    selectionCache = initialSelection.cache;
    saveModelSelectionState(selectionCache);
  }

  const root = createEl(doc, "div", "llm-settings-root");
  scrollContainer.appendChild(root);

  type SettingsSectionId =
    | "connectionMode"
    | "models"
    | "selectionTranslate"
    | "advanced"
    | "console"
    | "accounts";
  const settingsSectionIds: SettingsSectionId[] = [
    "connectionMode",
    "models",
    "selectionTranslate",
    "advanced",
    "console",
    "accounts",
  ];
  const defaultSectionState = settingsSectionIds.reduce(
    (acc, id) => {
      acc[id] = true;
      return acc;
    },
    {} as Record<SettingsSectionId, boolean>,
  );
  const readSectionState = (): Record<SettingsSectionId, boolean> => {
    const state = { ...defaultSectionState };
    const raw = getPref("settingsSectionState").trim();
    if (!raw) return state;
    try {
      const parsed = JSON.parse(raw) as Partial<
        Record<SettingsSectionId, unknown>
      >;
      for (const id of settingsSectionIds) {
        if (typeof parsed?.[id] === "boolean") {
          state[id] = parsed[id] as boolean;
        }
      }
    } catch {
      /* keep defaults */
    }
    return state;
  };
  const sectionState = readSectionState();
  const saveSectionState = () => {
    setPref("settingsSectionState", JSON.stringify(sectionState));
  };
  const setCollapsibleState = (
    title: HTMLElement,
    body: HTMLElement,
    id: SettingsSectionId,
    collapsed: boolean,
    openDisplay = "",
  ) => {
    sectionState[id] = collapsed;
    title.dataset.collapsed = collapsed ? "true" : "false";
    body.style.display = collapsed ? "none" : openDisplay;
  };
  const applyCollapsibleState = (
    title: HTMLElement,
    body: HTMLElement,
    id: SettingsSectionId,
    openDisplay = "",
  ) => {
    setCollapsibleState(title, body, id, sectionState[id] ?? true, openDisplay);
  };
  const toggleCollapsibleState = (
    title: HTMLElement,
    body: HTMLElement,
    id: SettingsSectionId,
    openDisplay = "",
  ) => {
    const collapsed = title.dataset.collapsed !== "true";
    setCollapsibleState(title, body, id, collapsed, openDisplay);
    saveSectionState();
  };
  let scrollSaveTimer = 0;
  scrollContainer.addEventListener("scroll", () => {
    if (scrollSaveTimer) win.clearTimeout(scrollSaveTimer);
    scrollSaveTimer = win.setTimeout(() => {
      setPref(
        "settingsScrollTop",
        String(Math.max(0, Math.floor(scrollContainer.scrollTop || 0))),
      );
      scrollSaveTimer = 0;
    }, 150);
  });

  // ── ① Language dropdown + danger buttons toolbar ──
  const langBox = createEl(doc, "div", "llm-set-card llm-set-toolbar");
  const langLeft = createEl(doc, "div", "llm-set-toolbar-left");
  const langLabel = createEl(
    doc,
    "label",
    "llm-set-label llm-set-label--title",
  );

  const langDropdown = createEl(
    doc,
    "div",
    "llm-set-dropdown",
  ) as HTMLDivElement;
  const langTrigger = createEl(
    doc,
    "div",
    "llm-set-dropdown-trigger",
  ) as HTMLDivElement;
  const langArrow = createEl(
    doc,
    "span",
    "llm-set-dropdown-arrow",
  ) as HTMLSpanElement;
  langArrow.textContent = "▾";
  langTrigger.appendChild(langArrow);
  const langMenu = createEl(
    doc,
    "div",
    "llm-set-dropdown-menu",
  ) as HTMLDivElement;
  langMenu.style.display = "none";
  langDropdown.append(langTrigger, langMenu);

  const updateLanguageDropdown = (next: Lang) => {
    const option = getUiLanguageOption(next);
    langDropdown.dataset.value = next;
    langDropdown.lang = option.htmlLang;
    langDropdown.dir = option.dir;
    const arrow = langTrigger.querySelector(".llm-set-dropdown-arrow");
    langTrigger.textContent = option.label;
    if (arrow) langTrigger.appendChild(arrow);
    langMenu
      .querySelectorAll(".llm-set-dropdown-item")
      .forEach((el: Element) => {
        const item = el as HTMLElement;
        item.classList.toggle("selected", item.dataset.value === next);
      });
  };

  for (const option of UI_LANGUAGE_OPTIONS) {
    const item = createEl(
      doc,
      "div",
      "llm-set-dropdown-item",
    ) as HTMLDivElement;
    item.dataset.value = option.uiCode;
    item.lang = option.htmlLang;
    item.dir = option.dir;
    item.textContent = option.label;
    item.title = option.englishName;
    item.addEventListener("click", () => {
      switchLang(option.uiCode);
      langMenu.style.display = "none";
      langDropdown.classList.remove("open");
    });
    langMenu.appendChild(item);
  }

  langTrigger.addEventListener("click", () => {
    const open = langMenu.style.display !== "none";
    langMenu.style.display = open ? "none" : "block";
    langDropdown.classList.toggle("open", !open);
  });
  doc.addEventListener("click", (e: Event) => {
    if (!langDropdown.contains(e.target as Node)) {
      langMenu.style.display = "none";
      langDropdown.classList.remove("open");
    }
  });
  updateLanguageDropdown(lang);
  langLeft.append(langLabel, langDropdown);

  // ── Hide Tab Nav toggle (ON = hide, OFF = show) ──
  const hideNavGroup = createEl(doc, "div", "llm-set-toolbar-left");
  const hideNavLabel = createEl(
    doc,
    "label",
    "llm-set-label llm-set-label--title",
  );
  const HIDE_NAV_OPTIONS: {
    value: boolean;
    labelKey: "hideTabNavOn" | "hideTabNavOff";
  }[] = [
    { value: true, labelKey: "hideTabNavOn" },
    { value: false, labelKey: "hideTabNavOff" },
  ];
  const hideNavTabBar = createEl(doc, "div", "llm-set-tab-bar");
  const currentHideTabNav = () => {
    const v = Zotero.Prefs.get(`${config.prefsPrefix}.hideTabNav`, true);
    return v === true || String(v).toLowerCase() === "true";
  };
  let hideNavValue = currentHideTabNav();
  const hideNavBtns = HIDE_NAV_OPTIONS.map((opt) => {
    const btn = createEl(doc, "button", "llm-set-tab-btn") as HTMLButtonElement;
    btn.type = "button";
    if (opt.value === hideNavValue) btn.classList.add("active");
    btn.addEventListener("click", () => {
      hideNavValue = opt.value;
      Zotero.Prefs.set(`${config.prefsPrefix}.hideTabNav`, hideNavValue, true);
      hideNavBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      applyHideTabNavToAllPanels(hideNavValue);
    });
    hideNavTabBar.appendChild(btn);
    return btn;
  });
  hideNavGroup.append(hideNavLabel, hideNavTabBar);

  // Danger buttons (moved from bottom dangerZone)
  const langRight = createEl(doc, "div", "llm-set-toolbar-right");
  const restoreDefaultsBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--pill llm-set-btn--warn",
  ) as HTMLButtonElement;
  restoreDefaultsBtn.type = "button";
  const clearAllHistoryBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--pill llm-set-btn--danger",
  ) as HTMLButtonElement;
  clearAllHistoryBtn.type = "button";
  const dangerStatus = createEl(doc, "span", "llm-set-status");
  langRight.append(restoreDefaultsBtn, clearAllHistoryBtn);

  const switchLang = (next: Lang) => {
    lang = next;
    setPref("uiLanguage", lang);
    updateLanguageDropdown(lang);
    renderStaticText();
    renderModels();
    void renderAccounts();
    refreshAllSidebarShortcuts();
    refreshTranslateTabI18n(doc);
  };

  langBox.append(langLeft, hideNavGroup, langRight, dangerStatus);

  const refreshAllBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--pill llm-set-btn--accent",
  ) as HTMLButtonElement;
  refreshAllBtn.type = "button";
  const progressText = createEl(doc, "span", "llm-set-status");
  const progressListWrap = createEl(doc, "div", "llm-set-progress-wrap");
  const progressList = createEl(doc, "div", "llm-set-progress-list");
  const progressCopyBtn = createEl(
    doc,
    "button",
    "llm-set-console-copy",
  ) as HTMLButtonElement;
  progressCopyBtn.type = "button";
  progressCopyBtn.title = L.copy;
  progressCopyBtn.addEventListener("click", () => {
    const text = progressList.innerText || progressList.textContent || "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const helper = (Components.classes as any)[
        "@mozilla.org/widget/clipboardhelper;1"
      ]?.getService(Components.interfaces.nsIClipboardHelper);
      if (helper) helper.copyString(text);
      progressCopyBtn.classList.add("llm-set-console-copy--done");
      setTimeout(
        () => progressCopyBtn.classList.remove("llm-set-console-copy--done"),
        1500,
      );
    } catch (_e) {
      ztoolkit.log("LLM: clipboard copy failed");
    }
  });
  progressListWrap.append(progressList, progressCopyBtn);

  const logsWrap = createEl(doc, "div", "llm-set-logs-wrap");
  const logsBox = createEl(
    doc,
    "textarea",
    "llm-set-logs-area",
  ) as HTMLTextAreaElement;
  logsBox.readOnly = true;
  logsBox.rows = 5;
  logsBox.value = getPref("oauthSetupLog") || "";
  const logsCopyBtn = createEl(
    doc,
    "button",
    "llm-set-console-copy",
  ) as HTMLButtonElement;
  logsCopyBtn.type = "button";
  logsCopyBtn.title = L.copy;
  logsCopyBtn.addEventListener("click", () => {
    const text = logsBox.value || "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const helper = (Components.classes as any)[
        "@mozilla.org/widget/clipboardhelper;1"
      ]?.getService(Components.interfaces.nsIClipboardHelper);
      if (helper) helper.copyString(text);
      logsCopyBtn.classList.add("llm-set-console-copy--done");
      setTimeout(
        () => logsCopyBtn.classList.remove("llm-set-console-copy--done"),
        1500,
      );
    } catch (_e) {
      ztoolkit.log("LLM: clipboard copy failed");
    }
  });
  logsWrap.append(logsBox, logsCopyBtn);

  // Console area — collapsible, collapsed by default
  const consoleCard = createEl(
    doc,
    "div",
    "llm-set-card llm-set-collapsible-body",
  );
  consoleCard.append(logsWrap, progressListWrap);
  const consoleTitle = createEl(
    doc,
    "div",
    "llm-set-title llm-set-collapsible-toggle",
  );
  applyCollapsibleState(consoleTitle, consoleCard, "console", "flex");
  consoleTitle.addEventListener("click", () => {
    toggleCollapsibleState(consoleTitle, consoleCard, "console", "flex");
  });

  // ── ② Model Config — tab-bar style OAuth / Custom switcher ──
  const connectionModeBox = createEl(doc, "div", "llm-set-card");
  const connectionModeTitle = createEl(
    doc,
    "div",
    "llm-set-title llm-set-collapsible-toggle",
  );
  const connectionModeBody = createEl(doc, "div", "llm-set-collapsible-body");
  applyCollapsibleState(
    connectionModeTitle,
    connectionModeBody,
    "connectionMode",
  );
  connectionModeTitle.addEventListener("click", () => {
    toggleCollapsibleState(
      connectionModeTitle,
      connectionModeBody,
      "connectionMode",
    );
  });

  // Hidden radios keep pref synced; visibility is driven by tab buttons
  const connectionModeGroupName = `${config.addonRef}-primary-connection-mode`;
  const oauthModeRadio = createEl(doc, "input") as HTMLInputElement;
  oauthModeRadio.type = "radio";
  oauthModeRadio.name = connectionModeGroupName;
  oauthModeRadio.id = `${config.addonRef}-primary-connection-mode-oauth`;
  oauthModeRadio.value = "oauth";
  oauthModeRadio.style.display = "none";
  const customModeRadio = createEl(doc, "input") as HTMLInputElement;
  customModeRadio.type = "radio";
  customModeRadio.name = connectionModeGroupName;
  customModeRadio.id = `${config.addonRef}-primary-connection-mode-custom`;
  customModeRadio.value = "custom";
  customModeRadio.style.display = "none";

  // Tab bar for connection mode
  const modeTabBar = createEl(doc, "div", "llm-set-tab-bar");
  const oauthTabBtn = createEl(
    doc,
    "button",
    "llm-set-tab-btn",
  ) as HTMLButtonElement;
  oauthTabBtn.type = "button";
  const customTabBtn = createEl(
    doc,
    "button",
    "llm-set-tab-btn",
  ) as HTMLButtonElement;
  customTabBtn.type = "button";
  modeTabBar.append(oauthTabBtn, customTabBtn);

  // Panel containers for the two modes
  const oauthPanel = createEl(doc, "div", "llm-set-mode-panel");
  const customPanel = createEl(doc, "div", "llm-set-mode-panel");

  const customFieldsBox = createEl(doc, "div", "llm-set-custom-fields");
  customFieldsBox.id = `${config.addonRef}-custom-openai-fields`;

  const customApiBaseField = createEl(doc, "div", "llm-set-field");
  const customApiBaseLabel = createEl(doc, "label", "llm-set-label");
  customApiBaseLabel.setAttribute("for", `${config.addonRef}-custom-api-base`);
  const customApiBaseInput = createEl(
    doc,
    "input",
    "llm-set-input",
  ) as HTMLInputElement;
  customApiBaseInput.id = `${config.addonRef}-custom-api-base`;
  customApiBaseInput.type = "text";
  const customApiBaseHint = createEl(doc, "span", "llm-set-hint");
  customApiBaseField.append(
    customApiBaseLabel,
    customApiBaseInput,
    customApiBaseHint,
  );

  const customApiKeyField = createEl(doc, "div", "llm-set-field");
  const customApiKeyLabel = createEl(doc, "label", "llm-set-label");
  customApiKeyLabel.setAttribute("for", `${config.addonRef}-custom-api-key`);
  const customApiKeyInput = createEl(
    doc,
    "input",
    "llm-set-input",
  ) as HTMLInputElement;
  customApiKeyInput.id = `${config.addonRef}-custom-api-key`;
  customApiKeyInput.type = "password";
  const customApiKeyHint = createEl(doc, "span", "llm-set-hint");
  customApiKeyField.append(
    customApiKeyLabel,
    customApiKeyInput,
    customApiKeyHint,
  );

  const customModelField = createEl(doc, "div", "llm-set-field");
  const customModelLabel = createEl(doc, "label", "llm-set-label");
  customModelLabel.setAttribute("for", `${config.addonRef}-custom-model`);
  const customModelInput = createEl(
    doc,
    "input",
    "llm-set-input",
  ) as HTMLInputElement;
  customModelInput.id = `${config.addonRef}-custom-model`;
  customModelInput.type = "text";
  const customModelDatalist = doc.createElementNS(
    HTML_NS,
    "datalist",
  ) as HTMLDataListElement;
  customModelDatalist.id = `${config.addonRef}-custom-model-list`;
  customModelInput.setAttribute("list", customModelDatalist.id);
  const customModelInputRow = createEl(
    doc,
    "div",
    "llm-set-row llm-set-gap-sm",
  );
  const fetchModelsBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--primary llm-set-btn--pill",
  ) as HTMLButtonElement;
  fetchModelsBtn.type = "button";
  customModelInputRow.append(customModelInput);
  const customModelHint = createEl(doc, "span", "llm-set-hint");
  customModelField.append(
    customModelLabel,
    customModelInputRow,
    customModelDatalist,
    customModelHint,
  );

  const fetchedModelsBox = createEl(doc, "div", "llm-set-fetched-panel");
  const fetchedModelsHeader = createEl(
    doc,
    "div",
    "llm-set-row llm-set-row--spread",
  );
  const fetchedModelsLabelRow = createEl(
    doc,
    "div",
    "llm-set-row llm-set-gap-sm",
  );
  const fetchedModelsLabelText = createEl(doc, "label", "llm-set-label");
  const fetchedModelsLabelInput = createEl(
    doc,
    "input",
    "llm-set-input",
  ) as HTMLInputElement;
  fetchedModelsLabelInput.style.width = "auto";
  fetchedModelsLabelInput.style.minWidth = "120px";
  fetchedModelsLabelInput.value = "custom api";
  fetchedModelsLabelInput.type = "text";
  let labelManuallyEdited = false;
  fetchedModelsLabelInput.addEventListener("input", () => {
    labelManuallyEdited = true;
  });
  fetchedModelsLabelRow.append(fetchedModelsLabelText, fetchedModelsLabelInput);
  const fetchedModelsHeaderRight = createEl(
    doc,
    "div",
    "llm-set-row llm-set-gap-sm",
  );
  const selectAllFetchedBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--pill llm-set-btn--secondary",
  );
  const clearAllFetchedBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--pill llm-set-btn--secondary",
  );
  const saveModelsBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--success llm-set-btn--pill",
  );
  fetchedModelsHeaderRight.append(
    selectAllFetchedBtn,
    clearAllFetchedBtn,
    saveModelsBtn,
  );
  fetchedModelsHeader.append(fetchedModelsLabelRow, fetchedModelsHeaderRight);
  const fetchedModelsList = createEl(doc, "div", "llm-set-fetched-list");
  fetchedModelsBox.append(fetchedModelsHeader, fetchedModelsList);

  // Model add row — placed into customFieldsBox below API Key
  const addModelRow = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
  const addModelLabel = createEl(doc, "label", "llm-set-label");
  const addModelInput = createEl(
    doc,
    "input",
    "llm-set-input",
  ) as HTMLInputElement;
  addModelInput.type = "text";
  addModelInput.style.width = "38%";
  const addModelBtn = createEl(
    doc,
    "button",
    "llm-set-btn llm-set-btn--pill llm-set-btn--accent",
  ) as HTMLButtonElement;
  addModelBtn.type = "button";
  addModelRow.append(addModelLabel, addModelInput, addModelBtn, fetchModelsBtn);

  let lastFetchedModels: { id: string; label: string; checked: boolean }[] = [];

  const renderFetchedModels = () => {
    fetchedModelsList.innerHTML = "";
    for (const m of lastFetchedModels) {
      const row = createEl(doc, "label", "llm-set-fetched-row");
      const cb = createEl(doc, "input") as HTMLInputElement;
      cb.type = "checkbox";
      cb.checked = m.checked;
      cb.addEventListener("change", () => {
        m.checked = cb.checked;
      });
      const textLabel = createNode(
        doc,
        "span",
        "word-break:break-all;",
        m.label || m.id,
      );
      const delBtn = createEl(
        doc,
        "button",
        "llm-set-fetched-delete",
      ) as HTMLButtonElement;
      delBtn.type = "button";
      delBtn.title = L.delete;
      delBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        lastFetchedModels = lastFetchedModels.filter((x) => x.id !== m.id);
        renderFetchedModels();
      });
      row.append(cb, textLabel, delBtn);
      fetchedModelsList.append(row);
    }
  };

  addModelBtn.addEventListener("click", () => {
    const trimmed = addModelInput.value.trim();
    if (!trimmed) return;
    if (!lastFetchedModels.find((m) => m.id === trimmed)) {
      lastFetchedModels.unshift({ id: trimmed, label: trimmed, checked: true });
      renderFetchedModels();
    }
    addModelInput.value = "";
  });

  selectAllFetchedBtn.addEventListener("click", () => {
    lastFetchedModels.forEach((m) => {
      m.checked = true;
    });
    renderFetchedModels();
  });

  clearAllFetchedBtn.addEventListener("click", () => {
    lastFetchedModels.forEach((m) => {
      m.checked = false;
    });
    renderFetchedModels();
  });

  saveModelsBtn.addEventListener("click", () => {
    const label = fetchedModelsLabelInput.value.trim() || "custom api";
    const selected = lastFetchedModels.filter((m) => m.checked);
    const apiBase = customApiBaseInput.value.trim().replace(/\/+$/, "");
    const apiKey = customApiKeyInput.value.trim();

    // Rule 1: Replace — the checked list IS the new model list for this provider.
    const newModels = selected.map((m) => ({
      id: m.id,
      label: m.label,
      apiBase,
      apiKey,
    }));
    cache = { ...cache, [label as OAuthProviderId]: newModels };
    saveModelCache(cache);
    persistSelectionState();
    renderModels();

    // Flash the save button to confirm success
    const origText = saveModelsBtn.textContent || "";
    const origClassName = saveModelsBtn.className;
    saveModelsBtn.textContent = L.saved;
    saveModelsBtn.classList.remove("llm-set-btn--success");
    saveModelsBtn.classList.add("llm-set-btn--saved-flash");
    setTimeout(() => {
      saveModelsBtn.textContent = origText;
      saveModelsBtn.className = origClassName;
    }, 2000);
  });

  const customModeStatus = createEl(doc, "div", "llm-set-status");
  customModeStatus.id = `${config.addonRef}-custom-openai-status`;
  customFieldsBox.append(
    customApiBaseField,
    customApiKeyField,
    addModelRow,
    customModeStatus,
  );
  // Assemble customPanel with the custom fields
  customPanel.append(customFieldsBox, fetchedModelsBox);

  connectionModeBody.append(
    modeTabBar,
    oauthModeRadio,
    customModeRadio,
    oauthPanel,
    customPanel,
  );
  connectionModeBox.append(connectionModeTitle, connectionModeBody);

  const setCustomInputBorderState = (
    input: HTMLInputElement,
    missing: boolean,
  ) => {
    input.classList.toggle("llm-set-input--error", missing);
  };

  const updateCustomModeUi = () => {
    const isCustom = customModeRadio.checked;

    // Toggle tab-bar active state
    oauthTabBtn.classList.toggle("active", !isCustom);
    customTabBtn.classList.toggle("active", isCustom);

    // Toggle panel visibility
    oauthPanel.classList.toggle("active", !isCustom);
    customPanel.classList.toggle("active", isCustom);

    customFieldsBox.style.display = isCustom ? "flex" : "none";
    customApiBaseInput.disabled = !isCustom;
    customApiKeyInput.disabled = !isCustom;
    customModelInput.disabled = !isCustom;
    const missing = getCustomEndpointMissingFields(
      customApiBaseInput.value,
      customModelInput.value,
    );
    setCustomInputBorderState(
      customApiBaseInput,
      isCustom && missing.includes("apiBase"),
    );
    setCustomInputBorderState(
      customModelInput,
      isCustom && missing.includes("model"),
    );
    setCustomInputBorderState(customApiKeyInput, false);
    if (!isCustom) {
      customModeStatus.textContent = L.customModeDisabled;
      customModeStatus.style.color = "#6b7280";
      return;
    }
    if (missing.length) {
      customModeStatus.textContent = L.customModeMissing;
      customModeStatus.style.color = "#b45309";
      return;
    }
    customModeStatus.textContent = L.customModeReady;
    customModeStatus.style.color = "#065f46";
  };

  const persistCustomPref = (
    input: HTMLInputElement,
    key: "apiBase" | "apiKey" | "model",
    normalize: (value: string) => string,
  ) => {
    const nextValue = normalize(input.value);
    input.value = nextValue;
    setPref(key, nextValue);
    updateCustomModeUi();
  };

  customApiBaseInput.value = getPref("apiBase") || "";
  customApiKeyInput.value = getPref("apiKey") || "";
  customModelInput.value = getPref("model") || "";
  // Initial label set — resolve + load will happen later after helper functions are defined
  fetchedModelsLabelInput.value = generateProviderLabel(
    customApiBaseInput.value,
  );
  const initialMode = getPrimaryConnectionMode();
  oauthModeRadio.checked = initialMode !== "custom";
  customModeRadio.checked = initialMode === "custom";

  const authCards = createEl(doc, "div", "llm-settings-root");

  const accountsBox = createEl(doc, "div", "llm-set-card");
  const accountsTitle = createEl(
    doc,
    "div",
    "llm-set-title llm-set-title--sub llm-set-collapsible-toggle",
  );
  const accountsTable = createEl(
    doc,
    "div",
    "llm-set-table llm-set-collapsible-body",
  );
  applyCollapsibleState(accountsTitle, accountsTable, "accounts", "block");
  accountsTitle.addEventListener("click", () => {
    toggleCollapsibleState(accountsTitle, accountsTable, "accounts", "block");
  });
  accountsBox.append(accountsTitle, accountsTable);

  const modelsBox = createEl(doc, "div", "llm-set-card");
  const modelsTitle = createEl(
    doc,
    "div",
    "llm-set-title llm-set-collapsible-toggle",
  );
  const modelsBody = createEl(doc, "div", "llm-set-collapsible-body");
  applyCollapsibleState(modelsTitle, modelsBody, "models");
  modelsTitle.addEventListener("click", () => {
    toggleCollapsibleState(modelsTitle, modelsBody, "models");
  });
  const modelsActionRow = createEl(
    doc,
    "div",
    "llm-set-row llm-set-gap-sm llm-set-row--spread",
  );
  modelsActionRow.append(progressText, refreshAllBtn);
  const modelsTable = createEl(doc, "div", "llm-set-table");
  modelsBody.append(modelsActionRow, modelsTable);
  modelsBox.append(modelsTitle, modelsBody);

  const providerCards = new Map<
    OAuthProviderId,
    {
      status: HTMLSpanElement;
      setupBtn: HTMLButtonElement;
      loginBtn: HTMLButtonElement;
      deleteBtn: HTMLButtonElement;
    }
  >();

  const renderStaticText = () => {
    L = tt(lang);
    // "Language" label stays English regardless of selected language
    langLabel.textContent = "Language:";
    hideNavLabel.textContent = L.hideTabNav;
    HIDE_NAV_OPTIONS.forEach((opt, i) => {
      if (hideNavBtns[i])
        hideNavBtns[i].textContent = tt(lang)[opt.labelKey] as string;
    });
    consoleTitle.textContent = L.console;
    refreshAllBtn.textContent = L.refreshAllModels;
    restoreDefaultsBtn.textContent = L.restoreDefaults;
    clearAllHistoryBtn.textContent = L.clearAllHistory;
    accountsTitle.textContent = L.accounts;
    modelsTitle.textContent = L.models;

    connectionModeTitle.textContent = L.modelConfigTitle;
    advancedTitle.textContent = L.advanced;
    oauthTabBtn.textContent = L.oauthProvidersMode;
    customTabBtn.textContent = L.customCompatibleMode;

    customApiBaseLabel.textContent = L.customApiBase;
    customApiBaseInput.placeholder = L.customApiBasePlaceholder;
    customApiBaseHint.textContent = L.customApiBaseHint;
    customApiKeyLabel.textContent = L.customApiKey;
    customApiKeyInput.placeholder = L.customApiKeyPlaceholder;
    customApiKeyHint.textContent = L.customApiKeyHint;
    customModelLabel.textContent = L.customModel;
    customModelInput.placeholder = L.customModelPlaceholder;
    customModelHint.textContent = L.customModelHint;
    fetchModelsBtn.textContent = L.fetchModels;
    fetchedModelsLabelText.textContent = L.providerLabel;
    addModelLabel.textContent = L.addModelLabel;
    addModelInput.placeholder = L.addModelPlaceholder;
    addModelBtn.textContent = L.manualAdd;
    selectAllFetchedBtn.textContent = L.all;
    clearAllFetchedBtn.textContent = L.clear;
    saveModelsBtn.textContent = L.saveSelectedModels;
    for (const provider of PROVIDERS) {
      const refs = providerCards.get(provider);
      if (!refs) continue;
      refs.setupBtn.textContent = L.installEnv;
      refs.loginBtn.textContent = L.oauthLogin;
      refs.deleteBtn.textContent = L.oauthDelete;
    }
    // Update XHTML static labels
    const spl = doc.querySelector(`#${config.addonRef}-system-prompt-label`);
    if (spl) spl.textContent = L.systemPrompt;
    const spi = doc.querySelector(
      `#${config.addonRef}-system-prompt-input`,
    ) as HTMLTextAreaElement | null;
    if (spi) spi.placeholder = L.systemPromptPlaceholder;
    const sph = doc.querySelector(`#${config.addonRef}-system-prompt-hint`);
    if (sph) sph.textContent = L.systemPromptHint;
    const atl = doc.querySelector(`#${config.addonRef}-popup-add-text-label`);
    if (atl) atl.textContent = L.showAddText;
    const ath = doc.querySelector(`#${config.addonRef}-popup-add-text-hint`);
    if (ath) ath.textContent = L.showAddTextHint;
    const stTitle = doc.querySelector(
      `#${config.addonRef}-selection-translate-title`,
    );
    if (stTitle) stTitle.textContent = L.selectionTranslateTitle;
    const stEnable = doc.querySelector(
      `#${config.addonRef}-selection-translate-enable-label`,
    );
    if (stEnable) stEnable.textContent = L.selectionTranslateEnable;
    const stEnableHint = doc.querySelector(
      `#${config.addonRef}-selection-translate-enable-hint`,
    );
    if (stEnableHint) stEnableHint.textContent = L.selectionTranslateEnableHint;
    const stAuto = doc.querySelector(
      `#${config.addonRef}-selection-translate-auto-label`,
    );
    if (stAuto) stAuto.textContent = L.selectionTranslateAuto;
    const stAutoHint = doc.querySelector(
      `#${config.addonRef}-selection-translate-auto-hint`,
    );
    if (stAutoHint) stAutoHint.textContent = L.selectionTranslateAutoHint;
    const stModel = doc.querySelector(
      `#${config.addonRef}-selection-translate-model-label`,
    );
    if (stModel) stModel.textContent = L.selectionTranslateModel;
    const stModelHint = doc.querySelector(
      `#${config.addonRef}-selection-translate-model-hint`,
    );
    if (stModelHint) stModelHint.textContent = L.selectionTranslateModelHint;
    const stSource = doc.querySelector(
      `#${config.addonRef}-selection-translate-source-label`,
    );
    if (stSource) stSource.textContent = L.selectionTranslateSourceLang;
    const stTarget = doc.querySelector(
      `#${config.addonRef}-selection-translate-target-label`,
    );
    if (stTarget) stTarget.textContent = L.selectionTranslateTargetLang;
    const stColdStartHint = doc.querySelector(
      `#${config.addonRef}-selection-translate-cold-start-hint`,
    );
    if (stColdStartHint) {
      stColdStartHint.textContent = L.selectionTranslateColdStartHint;
    }
    const stClear = doc.querySelector(
      `#${config.addonRef}-selection-translate-clear-cache`,
    );
    if (stClear) stClear.textContent = L.selectionTranslateClearCache;
    renderSelectionTranslateLanguageOptions();
    renderSelectionTranslateModelOptions();
    const saml = doc.querySelector(`#${config.addonRef}-show-all-models-label`);
    if (saml) saml.textContent = L.showAllModels;
    const samh = doc.querySelector(`#${config.addonRef}-show-all-models-hint`);
    if (samh) samh.textContent = L.showAllModelsHint;
    updateCustomModeUi();
  };

  const appendProgress = (line: string, color = "#374151") => {
    // Auto-expand console section when progress is appended
    if (consoleTitle.dataset.collapsed === "true") {
      setCollapsibleState(consoleTitle, consoleCard, "console", false, "flex");
      saveSectionState();
    }
    const row = createNode(doc, "div", `color:${color};`);
    row.textContent = line;
    progressList.appendChild(row);
    progressList.scrollTop = progressList.scrollHeight;
  };

  const oauthEnvLogHandler = (event: Event) => {
    const detail = ((event as CustomEvent).detail || {}) as {
      logs?: unknown;
      progress?: unknown;
      color?: unknown;
      reset?: unknown;
    };
    if (detail.reset) {
      progressList.innerHTML = "";
    }
    if (typeof detail.logs === "string") {
      logsBox.value = detail.logs;
      logsBox.scrollTop = logsBox.scrollHeight;
    }
    if (typeof detail.progress === "string" && detail.progress.trim()) {
      appendProgress(
        detail.progress,
        typeof detail.color === "string" ? detail.color : "#374151",
      );
    }
  };
  const previousOauthEnvLogHandler = (win as any).__aideaOauthEnvLogHandler as
    | EventListener
    | undefined;
  if (previousOauthEnvLogHandler) {
    win.removeEventListener(
      OAUTH_ENV_UPDATE_LOG_EVENT,
      previousOauthEnvLogHandler,
    );
  }
  (win as any).__aideaOauthEnvLogHandler = oauthEnvLogHandler;
  win.addEventListener(OAUTH_ENV_UPDATE_LOG_EVENT, oauthEnvLogHandler);

  const flushUi = () =>
    new Promise<void>((resolve) => win.setTimeout(resolve, 0));

  const persistSelectionState = () => {
    const reconciled = reconcileModelSelectionCache(cache, selectionCache);
    selectionCache = reconciled.cache;
    saveModelSelectionState(selectionCache);
    syncSidebarModelPrefsFromSelection(cache, selectionCache);
    // Notify all open Discussion tabs to refresh their model menus
    try {
      doc.dispatchEvent(new Event("llm-models-changed"));
    } catch {
      /* ignore */
    }
  };

  const setProviderSelection = (
    provider: OAuthProviderId,
    modelIds: string[],
  ) => {
    selectionCache = {
      ...selectionCache,
      [provider]: canonicalizeSelectedModelIds(modelIds, cache[provider] || []),
    };
    persistSelectionState();
    renderModels();
  };

  const clearProviderState = (provider: OAuthProviderId) => {
    const nextCache = { ...cache, [provider]: [] };
    cache = nextCache;
    saveModelCache(cache);
    const nextSelection = { ...selectionCache };
    delete nextSelection[provider];
    selectionCache = nextSelection;
    persistSelectionState();
    renderModels();
  };

  const renderAccounts = async () => {
    accountsTable.innerHTML = "";
    const header = createEl(doc, "div", "llm-set-table-header");
    header.append(
      createEl(doc, "div", "", L.provider),
      createEl(doc, "div", "", L.account),
      createEl(doc, "div", "", L.status),
    );
    accountsTable.appendChild(header);
    for (const provider of PROVIDERS) {
      const s = await getProviderAccountSummary(provider);
      const row = createEl(doc, "div", "llm-set-table-row");
      row.append(
        createEl(doc, "div", "", s.label),
        createEl(doc, "div", "", s.account),
        createEl(doc, "div", "", localizeAuthStatus(s.status, L)),
      );
      accountsTable.appendChild(row);
    }
  };

  // Map to hold per-provider status elements across renderModels() rebuilds
  const providerStatusRefs = new Map<string, HTMLSpanElement>();
  let selectionTranslateModelDropdown: HTMLDivElement | null = null;
  let selectionTranslateSourceDropdown: HTMLDivElement | null = null;
  let selectionTranslateTargetDropdown: HTMLDivElement | null = null;

  const createTranslateStyleDropdown = (id: string): HTMLDivElement => {
    const dropdown = createEl(doc, "div", "llm-tr-dropdown") as HTMLDivElement;
    dropdown.id = id;
    const trigger = createEl(
      doc,
      "div",
      "llm-tr-dropdown-trigger",
    ) as HTMLDivElement;
    const arrow = createEl(
      doc,
      "span",
      "llm-tr-dropdown-arrow",
    ) as HTMLSpanElement;
    arrow.textContent = "\u25be";
    trigger.appendChild(arrow);
    const menu = createEl(doc, "div", "llm-tr-dropdown-menu") as HTMLDivElement;
    menu.style.display = "none";
    dropdown.append(trigger, menu);

    const positionMenu = () => {
      const view = doc.defaultView;
      const triggerRect = trigger.getBoundingClientRect();
      const scrollParent = dropdown.closest(
        ".llm-setting-scroll, .llm-translate-scroll",
      ) as HTMLElement | null;
      const scrollRect = scrollParent?.getBoundingClientRect();
      const viewportTop = 0;
      const viewportBottom =
        view?.innerHeight || doc.documentElement?.clientHeight || 600;
      const boundaryTop = Math.max(scrollRect?.top ?? viewportTop, viewportTop);
      const boundaryBottom = Math.min(
        scrollRect?.bottom ?? viewportBottom,
        viewportBottom,
      );
      const gap = 2;
      const preferredHeight = Math.min(menu.scrollHeight || 280, 280);
      const spaceBelow = boundaryBottom - triggerRect.bottom - gap;
      const spaceAbove = triggerRect.top - boundaryTop - gap;
      const openUp = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
      const available = openUp ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(80, Math.min(280, Math.floor(available)));

      menu.style.maxHeight = `${maxHeight}px`;
      menu.style.top = openUp ? "auto" : "calc(100% + 2px)";
      menu.style.bottom = openUp ? "calc(100% + 2px)" : "auto";
    };

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = menu.style.display !== "none";
      if (open) {
        menu.style.display = "none";
        dropdown.classList.remove("open");
        return;
      }
      menu.style.display = "block";
      dropdown.classList.add("open");
      positionMenu();
    });
    doc.addEventListener("click", (event: Event) => {
      if (!dropdown.contains(event.target as Node)) {
        menu.style.display = "none";
        dropdown.classList.remove("open");
      }
    });
    return dropdown;
  };

  const setDropdownTriggerText = (dropdown: HTMLDivElement, label: string) => {
    const trigger = dropdown.querySelector(
      ".llm-tr-dropdown-trigger",
    ) as HTMLDivElement | null;
    if (!trigger) return;
    const arrow = trigger.querySelector(".llm-tr-dropdown-arrow");
    trigger.textContent = label;
    if (arrow) trigger.appendChild(arrow);
  };

  const closeTranslateStyleDropdown = (dropdown: HTMLDivElement) => {
    const menu = dropdown.querySelector(
      ".llm-tr-dropdown-menu",
    ) as HTMLDivElement | null;
    if (menu) menu.style.display = "none";
    dropdown.classList.remove("open");
  };

  const renderSelectionTranslateModelOptions = () => {
    if (!selectionTranslateModelDropdown) return;
    const dropdown = selectionTranslateModelDropdown;
    const menu = dropdown.querySelector(
      ".llm-tr-dropdown-menu",
    ) as HTMLDivElement | null;
    if (!menu) return;
    const { choices } = getModelChoices();
    menu.innerHTML = "";
    if (!choices.length) {
      dropdown.dataset.value = "";
      dropdown.dataset.providerId = "";
      setDropdownTriggerText(dropdown, L.selectionTranslateNoModels);
      return;
    }

    const savedModel = getPref("selectionTranslate.model");
    const savedProvider = getPref("selectionTranslate.provider");
    const previousModel = dropdown.dataset.value || savedModel;
    const previousProvider = dropdown.dataset.providerId || savedProvider;
    let selectedChoice =
      (previousModel
        ? choices.find(
            (choice) =>
              choice.model === previousModel &&
              (choice.providerId || "") === previousProvider,
          ) || choices.find((choice) => choice.model === previousModel)
        : undefined) ||
      (savedModel
        ? choices.find(
            (choice) =>
              choice.model === savedModel &&
              (choice.providerId || "") === savedProvider,
          ) || choices.find((choice) => choice.model === savedModel)
        : undefined) ||
      undefined;
    if (!selectedChoice) {
      const bestModel = pickBestDefaultModel(choices);
      selectedChoice =
        choices.find((choice) => choice.model === bestModel) || choices[0];
    }

    const selectChoice = (
      model: string,
      providerId: string,
      persist: boolean,
    ) => {
      dropdown.dataset.value = model;
      dropdown.dataset.providerId = providerId;
      setDropdownTriggerText(dropdown, model);
      menu.querySelectorAll(".llm-tr-dropdown-item").forEach((el: Element) => {
        const item = el as HTMLElement;
        item.classList.toggle(
          "selected",
          item.dataset.value === model &&
            (item.dataset.providerId || "") === providerId,
        );
      });
      closeTranslateStyleDropdown(dropdown);
      if (persist) {
        setPref("selectionTranslate.model", model);
        setPref("selectionTranslate.provider", providerId);
      }
    };

    let lastProvider = "";
    for (const choice of choices) {
      const provider = choice.provider || "";
      if (provider && provider !== lastProvider) {
        lastProvider = provider;
        const groupLabel = createEl(
          doc,
          "div",
          "llm-tr-dropdown-group",
          provider,
        );
        menu.appendChild(groupLabel);
      }

      const item = createEl(
        doc,
        "div",
        "llm-tr-dropdown-item",
        choice.model,
      ) as HTMLDivElement;
      item.dataset.value = choice.model;
      item.dataset.providerId = choice.providerId || "";
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        selectChoice(choice.model, choice.providerId || "", true);
      });
      menu.appendChild(item);
    }
    if (selectedChoice) {
      selectChoice(
        selectedChoice.model,
        selectedChoice.providerId || "",
        false,
      );
    }
  };

  const buildSelectionLanguageOptions = (includeAuto: boolean) => {
    const options: { value: string; label: string }[] = [];
    const seen = new Set<string>();
    if (includeAuto) {
      options.push({
        value: "auto",
        label: L.selectionTranslateAutoDetect,
      });
      seen.add("auto");
    }
    for (const language of TRANSLATION_LANGUAGE_OPTIONS) {
      const code = String(language.code || "").trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      options.push({
        value: code,
        label: language.label || code,
      });
    }
    return options;
  };

  const renderSelectionLanguageDropdown = (
    dropdown: HTMLDivElement | null,
    includeAuto: boolean,
    prefKey: PrefKey,
    fallback: string,
  ) => {
    if (!dropdown) return;
    const menu = dropdown.querySelector(
      ".llm-tr-dropdown-menu",
    ) as HTMLDivElement | null;
    if (!menu) return;
    const saved = dropdown.dataset.value || getPref(prefKey) || fallback;
    const options = buildSelectionLanguageOptions(includeAuto);
    const selected =
      options.find((option) => option.value === saved) ||
      options.find((option) => option.value === fallback) ||
      options[0];
    menu.innerHTML = "";

    const selectOption = (value: string, label: string, persist: boolean) => {
      dropdown.dataset.value = value;
      setDropdownTriggerText(dropdown, label);
      menu.querySelectorAll(".llm-tr-dropdown-item").forEach((el: Element) => {
        const item = el as HTMLElement;
        item.classList.toggle("selected", item.dataset.value === value);
      });
      closeTranslateStyleDropdown(dropdown);
      if (persist) setPref(prefKey, value);
    };

    for (const option of options) {
      const item = createEl(
        doc,
        "div",
        "llm-tr-dropdown-item",
        option.label,
      ) as HTMLDivElement;
      item.dataset.value = option.value;
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        selectOption(option.value, option.label, true);
      });
      menu.appendChild(item);
    }
    if (selected) {
      selectOption(selected.value, selected.label, false);
    }
  };

  const renderSelectionTranslateLanguageOptions = () => {
    renderSelectionLanguageDropdown(
      selectionTranslateSourceDropdown,
      true,
      "selectionTranslate.sourceLang",
      "auto",
    );
    renderSelectionLanguageDropdown(
      selectionTranslateTargetDropdown,
      false,
      "selectionTranslate.targetLang",
      "zh-CN",
    );
  };

  const renderModels = () => {
    modelsTable.innerHTML = "";
    let count = 0;

    const activeProviders = Array.from(
      new Set([...PROVIDERS, ...Object.keys(cache)]),
    );

    for (const provider of activeProviders) {
      const providerModels = cache[provider as OAuthProviderId] || [];
      if (!providerModels.length) continue;
      count += providerModels.length;

      const selected = new Set(
        reconcileProviderModelSelection(
          provider as OAuthProviderId,
          providerModels,
          selectionCache,
        ).map(normalizeModelId),
      );
      const selectedCount = providerModels.filter((row) =>
        selected.has(normalizeModelId(row.id)),
      ).length;

      const section = createEl(doc, "div", "llm-set-provider-section");
      const header = createEl(doc, "div", "llm-set-row llm-set-row--spread");
      const title = createEl(
        doc,
        "div",
        "llm-set-provider-title",
        getProviderLabel(provider as OAuthProviderId),
      );
      const summaryText = L.selectedSummary
        .replace("{selected}", String(selectedCount))
        .replace("{total}", String(providerModels.length));
      const summary = createEl(
        doc,
        "div",
        "llm-set-provider-summary",
        summaryText,
      );
      header.append(title, summary);

      const actions = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
      const defaultBtn = createEl(
        doc,
        "button",
        "llm-set-btn llm-set-btn--pill llm-set-btn--secondary",
        L.defaults,
      ) as HTMLButtonElement;
      defaultBtn.type = "button";
      defaultBtn.addEventListener("click", () => {
        setProviderSelection(
          provider as OAuthProviderId,
          getDefaultSelectedModelIds(
            provider as OAuthProviderId,
            providerModels,
          ),
        );
      });
      const allBtn = createEl(
        doc,
        "button",
        "llm-set-btn llm-set-btn--pill llm-set-btn--secondary",
        L.selectAll,
      ) as HTMLButtonElement;
      allBtn.type = "button";
      allBtn.addEventListener("click", () => {
        setProviderSelection(
          provider as OAuthProviderId,
          providerModels.map((row) => row.id),
        );
      });
      const clearBtn = createEl(
        doc,
        "button",
        "llm-set-btn llm-set-btn--pill llm-set-btn--secondary",
        L.clear,
      ) as HTMLButtonElement;
      clearBtn.type = "button";
      clearBtn.addEventListener("click", () => {
        setProviderSelection(provider as OAuthProviderId, []);
      });
      const perProviderRefreshBtn = createEl(
        doc,
        "button",
        "llm-set-btn llm-set-btn--pill llm-set-btn--primary",
        L.refreshModels,
      ) as HTMLButtonElement;
      perProviderRefreshBtn.type = "button";
      const perProviderStatus = createEl(
        doc,
        "span",
        "llm-set-status",
      ) as HTMLSpanElement;
      // Persist status text from a previous render cycle (survives renderModels rebuilds)
      const prevStatus = providerStatusRefs.get(provider);
      if (prevStatus) {
        perProviderStatus.textContent = prevStatus.textContent;
        perProviderStatus.style.color = prevStatus.style.color;
      }
      providerStatusRefs.set(provider, perProviderStatus);
      perProviderRefreshBtn.addEventListener("click", async () => {
        await refreshOneProvider(provider as OAuthProviderId);
      });
      actions.append(
        defaultBtn,
        allBtn,
        clearBtn,
        perProviderRefreshBtn,
        perProviderStatus,
      );

      // Provider-level delete button (ghost style, requires confirm)
      const deleteProviderBtn = createEl(
        doc,
        "button",
        "llm-set-btn llm-set-btn--ghost",
        L.removeProvider,
      ) as HTMLButtonElement;
      deleteProviderBtn.type = "button";
      deleteProviderBtn.addEventListener("click", () => {
        const confirmed = win.confirm(
          L.removeProviderConfirm.replace(
            "{provider}",
            getProviderLabel(provider as OAuthProviderId),
          ),
        );
        if (!confirmed) return;
        // Fully remove from cache (not just clear to [])
        const nextCache = { ...cache };
        delete nextCache[provider as OAuthProviderId];
        cache = nextCache;
        saveModelCache(cache);
        const nextSelection = { ...selectionCache };
        delete nextSelection[provider as OAuthProviderId];
        selectionCache = nextSelection;
        persistSelectionState();
        renderModels();
      });

      const actionsLeft = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
      actionsLeft.append(
        defaultBtn,
        allBtn,
        clearBtn,
        perProviderRefreshBtn,
        perProviderStatus,
      );
      const actionsRow = createEl(
        doc,
        "div",
        "llm-set-row llm-set-row--spread",
      );
      actionsRow.append(actionsLeft, deleteProviderBtn);
      section.append(header, actionsRow);

      for (const row of providerModels) {
        const id = String(row.id || "").trim();
        if (!id) continue;
        const line = createEl(doc, "label", "llm-set-model-row");
        const checkbox = createEl(
          doc,
          "input",
          "llm-set-checkbox",
        ) as HTMLInputElement;
        checkbox.type = "checkbox";
        checkbox.checked = selected.has(normalizeModelId(id));
        checkbox.addEventListener("change", () => {
          const nextSelected = new Set(
            reconcileProviderModelSelection(
              provider as OAuthProviderId,
              providerModels,
              selectionCache,
            ).map(normalizeModelId),
          );
          const normalized = normalizeModelId(id);
          if (checkbox.checked) {
            nextSelected.add(normalized);
          } else {
            nextSelected.delete(normalized);
          }
          const nextIds = providerModels
            .map((model) => String(model.id || "").trim())
            .filter((modelId) => nextSelected.has(normalizeModelId(modelId)));
          setProviderSelection(provider as OAuthProviderId, nextIds);
        });

        const textBox = createEl(doc, "div", "llm-set-field");
        textBox.style.gap = "2px";
        textBox.style.flex = "1";
        const idRow = createEl(doc, "div", "llm-set-model-id-row");
        idRow.append(createEl(doc, "div", "llm-set-model-id", id));
        // Status badge
        if (row.status) {
          const badgeCls =
            row.status === "ok"
              ? "llm-set-model-status--ok"
              : row.status === "fail"
                ? "llm-set-model-status--fail"
                : "llm-set-model-status--testing";
          const badgeText =
            row.status === "ok"
              ? "\u2714"
              : row.status === "fail"
                ? "\u2716"
                : "\u23F3";
          idRow.append(createEl(doc, "span", badgeCls, badgeText));
        }
        textBox.append(idRow);
        if (row.label && row.label !== id) {
          textBox.append(
            createEl(doc, "div", "llm-set-model-label", row.label),
          );
        }

        // Per-model delete SVG (no confirm)
        const delModelBtn = createEl(
          doc,
          "button",
          "llm-set-fetched-delete",
        ) as HTMLButtonElement;
        delModelBtn.type = "button";
        delModelBtn.title = L.removeModel;
        delModelBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const updated = (cache[provider as OAuthProviderId] || []).filter(
            (m) => m.id !== id,
          );
          cache = { ...cache, [provider as OAuthProviderId]: updated };
          saveModelCache(cache);
          persistSelectionState();
          renderModels();
        });

        line.append(checkbox, textBox, delModelBtn);
        section.appendChild(line);
      }

      modelsTable.appendChild(section);
    }
    if (!count) {
      modelsTable.appendChild(createEl(doc, "div", "llm-set-hint", L.noModels));
    }
    renderSelectionTranslateModelOptions();
  };

  const refreshOneProvider = async (provider: OAuthProviderId) => {
    const isOAuth = (PROVIDERS as string[]).includes(provider);
    const getTarget = () => providerStatusRefs.get(provider) || progressText;
    const target = getTarget();
    target.textContent = L.refreshingModels;
    target.style.color = "#555";
    appendProgress(`[${getProviderLabel(provider)}] ${L.refreshingModels}`);
    await flushUi();

    try {
      let models: ProviderModelOption[];

      if (isOAuth) {
        // ── OAuth provider: replace model list ──
        models = await fetchAvailableModels(provider);
        cache = { ...cache, [provider]: models };
      } else {
        // ── Custom API provider: merge new models into existing ──
        const existing = cache[provider] || [];
        let fetched: ProviderModelOption[] = [];
        const firstModel = existing[0];
        if (firstModel?.apiBase) {
          try {
            fetched = await fetchCustomEndpointModels(
              firstModel.apiBase,
              firstModel.apiKey || "",
            );
          } catch {
            // Fetch failed — keep existing list unchanged
          }
        }
        // Merge: keep all existing, add new ones from fetch
        const existingIds = new Set(existing.map((m) => m.id));
        const merged = [...existing];
        for (const fm of fetched) {
          if (!existingIds.has(fm.id)) {
            merged.push({
              ...fm,
              apiBase: firstModel?.apiBase || "",
              apiKey: firstModel?.apiKey || "",
            });
          }
        }
        models = merged;
        cache = { ...cache, [provider]: models };
      }

      saveModelCache(cache);
      persistSelectionState();
      renderModels();
      await renderAccounts();

      const refs = providerCards.get(provider);
      if (refs) {
        const s = await getProviderAccountSummary(provider);
        refs.status.textContent = localizeAuthStatus(s.status, L);
        refs.status.style.color = /logged in/i.test(s.status)
          ? "green"
          : "#b45309";
      }

      const fetchMsg = L.testingModels.replace("{n}", String(models.length));
      const liveTarget1 = getTarget();
      liveTarget1.textContent = fetchMsg;
      liveTarget1.style.color = "#555";
      appendProgress(`[${getProviderLabel(provider)}] ${fetchMsg}`);

      // ── Ping each model ──
      // Mark all as "testing" first
      for (const m of models) m.status = "testing";
      renderModels();
      await flushUi();

      let okCount = 0;
      let failCount = 0;

      if (isOAuth) {
        // OAuth ping
        const pingInfo = await getOAuthProviderPingInfo(provider);
        if (provider === "openai-codex" && pingInfo) {
          // Codex: single token-level ping (all models share same token)
          const result = await pingCodexModel(pingInfo.headers);
          for (const m of models) {
            m.status = result;
            if (result === "ok") okCount++;
            else failCount++;
          }
          renderModels();
        } else if (provider === "google-gemini-cli" && pingInfo) {
          // Gemini CLI: single token-level ping (all models share same token)
          const result = await pingGeminiModel(
            pingInfo.headers,
            pingInfo.projectId || "",
          );
          for (const m of models) {
            m.status = result;
            if (result === "ok") okCount++;
            else failCount++;
          }
          renderModels();
        } else if (pingInfo) {
          // Qwen / Copilot: standard /chat/completions ping per model
          for (const m of models) {
            m.status = await pingModel(
              pingInfo.apiBase,
              "",
              m.id,
              pingInfo.headers,
            );
            if (m.status === "ok") okCount++;
            else failCount++;
            renderModels();
            await flushUi();
          }
        } else {
          // No ping info — clear status
          for (const m of models) m.status = undefined;
          renderModels();
        }
      } else {
        // Custom API: ping each model using stored apiBase/apiKey
        const firstModel = models[0];
        const apiBase = firstModel?.apiBase || "";
        const apiKey = firstModel?.apiKey || "";
        for (const m of models) {
          m.status = await pingModel(apiBase, apiKey, m.id);
          if (m.status === "ok") okCount++;
          else failCount++;
          renderModels();
          await flushUi();
        }
      }

      const doneMsg = L.pingSummary
        .replace("{ok}", String(okCount))
        .replace("{fail}", String(failCount));
      const liveTarget2 = getTarget();
      liveTarget2.textContent = doneMsg;
      liveTarget2.style.color = failCount === 0 ? "#065f46" : "#b45309";
      appendProgress(
        `[${getProviderLabel(provider)}] ${doneMsg}`,
        failCount === 0 ? "#065f46" : "#b45309",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const errMsg = L.refreshFailed.replace("{msg}", msg);
      const liveTarget = getTarget();
      liveTarget.textContent = errMsg;
      liveTarget.style.color = "#991b1b";
      appendProgress(`[${getProviderLabel(provider)}] ${errMsg}`, "#991b1b");
    }
  };

  for (const provider of PROVIDERS) {
    const card = createEl(doc, "div", "llm-set-card");
    const title = createEl(
      doc,
      "div",
      "llm-set-provider-title",
      getProviderLabel(provider),
    );
    const row = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
    const perProviderSetupBtn = createEl(
      doc,
      "button",
      "llm-set-btn llm-set-btn--success",
    ) as HTMLButtonElement;
    perProviderSetupBtn.type = "button";
    const loginBtn = createEl(
      doc,
      "button",
      "llm-set-btn llm-set-btn--secondary",
    ) as HTMLButtonElement;
    loginBtn.type = "button";

    const deleteBtn = createEl(
      doc,
      "button",
      "llm-set-btn llm-set-btn--ghost",
    ) as HTMLButtonElement;
    deleteBtn.type = "button";
    const status = createEl(doc, "span", "llm-set-status") as HTMLSpanElement;
    row.append(perProviderSetupBtn, loginBtn, deleteBtn, status);
    card.append(title, row);
    authCards.appendChild(card);
    providerCards.set(provider, {
      status,
      setupBtn: perProviderSetupBtn,
      loginBtn,
      deleteBtn,
    });

    // Copilot uses in-plugin Device Code flow — no CLI needed
    if (provider === "github-copilot") {
      perProviderSetupBtn.remove();

      loginBtn.addEventListener("click", async () => {
        // Show OAuth risk warning on first click only
        const alreadyAccepted = getPref("oauthRiskAccepted") === "true";
        if (!alreadyAccepted) {
          const riskMessage = L.oauthDeviceNotice;
          const accepted = win.confirm(riskMessage);
          if (!accepted) return;
          setPref("oauthRiskAccepted", "true");
        }
        status.textContent = L.loggingIn;
        status.style.color = "#555";
        appendProgress(`[${getProviderLabel(provider)}] ${L.loggingIn}`);
        await flushUi();
        const result = await runProviderOAuthLogin(provider);
        status.textContent = result.message;
        status.style.color = result.ok ? "green" : "red";
        appendProgress(
          `[${getProviderLabel(provider)}] ${result.message}`,
          result.ok ? "#065f46" : "#991b1b",
        );
        if (result.ok) {
          await refreshOneProvider(provider);
        } else {
          await renderAccounts();
        }
      });

      deleteBtn.addEventListener("click", async () => {
        status.textContent = L.running;
        status.style.color = "#555";
        appendProgress(`[${getProviderLabel(provider)}] ${L.oauthDelete}`);
        await flushUi();
        const result = await removeProviderOAuthCredential(provider);
        clearProviderState(provider);
        await renderAccounts();
        status.textContent = result.message;
        status.style.color = result.ok ? "#065f46" : "#991b1b";
        appendProgress(
          `[${getProviderLabel(provider)}] ${result.message}`,
          result.ok ? "#065f46" : "#991b1b",
        );
      });
    } else {
      perProviderSetupBtn.addEventListener("click", async () => {
        // Show OAuth risk warning on first click only
        const alreadyAccepted = getPref("oauthRiskAccepted") === "true";
        if (!alreadyAccepted) {
          const riskMessage = L.oauthInstallNotice;
          const accepted = win.confirm(riskMessage);
          if (!accepted) return;
          setPref("oauthRiskAccepted", "true");
        }

        status.textContent = L.running;
        status.style.color = "#555";
        progressList.innerHTML = "";
        appendProgress(`[${getProviderLabel(provider)}] ${L.running}`);
        await flushUi();
        const result = await autoConfigureEnvironment({
          provider,
          onProgress: (event) => {
            const prefix =
              event.phase === "start"
                ? "▶"
                : event.phase === "done"
                  ? event.ok
                    ? "✔"
                    : "✖"
                  : "•";
            const output = event.output
              ? `\n${event.output.slice(0, 220)}`
              : "";
            appendProgress(
              `${prefix} ${event.step}${output}`,
              event.phase === "done"
                ? event.ok
                  ? "#065f46"
                  : "#991b1b"
                : "#374151",
            );
          },
        });
        logsBox.value = result.logs;
        setPref("oauthSetupLog", result.logs);
        status.textContent = result.ok ? L.setupDone : L.setupPartialFail;
        status.style.color = result.ok ? "green" : "#b91c1c";
        await refreshOneProvider(provider);
      });

      loginBtn.addEventListener("click", async () => {
        status.textContent = L.loggingIn;
        status.style.color = "#555";
        appendProgress(`[${getProviderLabel(provider)}] ${L.loggingIn}`);
        await flushUi();
        const result = await runProviderOAuthLogin(provider);
        status.textContent = result.message;
        status.style.color = result.ok ? "green" : "red";
        appendProgress(
          `[${getProviderLabel(provider)}] ${result.message}`,
          result.ok ? "#065f46" : "#991b1b",
        );
        if (result.ok) {
          await refreshOneProvider(provider);
        } else {
          await renderAccounts();
        }
      });

      deleteBtn.addEventListener("click", async () => {
        status.textContent = L.running;
        status.style.color = "#555";
        appendProgress(`[${getProviderLabel(provider)}] ${L.oauthDelete}`);
        await flushUi();
        const result = await removeProviderOAuthCredential(provider);
        clearProviderState(provider);
        await renderAccounts();
        status.textContent = result.message;
        status.style.color = result.ok ? "#065f46" : "#991b1b";
        appendProgress(
          `[${getProviderLabel(provider)}] ${result.message}`,
          result.ok ? "#065f46" : "#991b1b",
        );
      });
    }
  }

  refreshAllBtn.addEventListener("click", async () => {
    progressText.textContent = L.refreshingModels;
    progressText.style.color = "#555";
    // Include all providers: OAuth built-ins + custom API providers in cache
    const allProviders = Array.from(
      new Set([...PROVIDERS, ...Object.keys(cache)]),
    );
    for (const provider of allProviders) {
      await refreshOneProvider(provider as OAuthProviderId);
    }
    progressText.textContent = "";
  });

  restoreDefaultsBtn.addEventListener("click", () => {
    const confirmed = win.confirm(L.restoreDefaultsConfirm);
    if (!confirmed) return;

    // Reset all model profile prefs to factory defaults
    const defaults: Record<string, string> = {
      primaryConnectionMode: "oauth",
      apiBase: "oauth://openai-codex",
      apiKey: "",
      model: "",
      apiBasePrimary: "oauth://openai-codex",
      apiKeyPrimary: "",
      modelPrimary: "",
      apiBaseSecondary: "oauth://google-gemini-cli",
      apiKeySecondary: "",
      modelSecondary: "",
      apiBaseTertiary: "oauth://openai-codex",
      apiKeyTertiary: "",
      modelTertiary: "",
      apiBaseQuaternary: "oauth://google-gemini-cli",
      apiKeyQuaternary: "",
      modelQuaternary: "",
      systemPrompt: "",
      oauthModelListCache: "",
      oauthModelSelectionCache: "",
      oauthSetupLog: "",
      oauthRiskAccepted: "",
      settingsSectionState: JSON.stringify(defaultSectionState),
      settingsScrollTop: "0",
      "selectionTranslate.model": "",
      "selectionTranslate.provider": "",
      "selectionTranslate.sourceLang": "auto",
      "selectionTranslate.targetLang": "zh-CN",
    };
    for (const [key, value] of Object.entries(defaults)) {
      setPref(key as PrefKey, value);
    }
    // Advanced params
    for (const suffix of PROFILE_KEYS) {
      Zotero.Prefs.set(
        `${config.prefsPrefix}.temperature${suffix}`,
        "0.3",
        true,
      );
      Zotero.Prefs.set(
        `${config.prefsPrefix}.maxTokens${suffix}`,
        "4096",
        true,
      );
    }
    Zotero.Prefs.set(`${config.prefsPrefix}.showPopupAddText`, true, true);
    Zotero.Prefs.set(`${config.prefsPrefix}.showAllModels`, false, true);
    setBoolPref("selectionTranslate.enabled", true);
    setBoolPref("selectionTranslate.auto", true);
    // Clear all shortcut customizations (custom bubbles, overrides, labels, order, deleted IDs)
    const shortcutPrefsToClear = [
      "shortcuts",
      "shortcutLabels",
      "shortcutDeleted",
      "customShortcuts",
      "shortcutOrder",
    ];
    for (const key of shortcutPrefsToClear) {
      Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, "", true);
    }

    // Diagnostic: verify prefs were actually cleared
    const verifyResults: string[] = [];
    for (const key of shortcutPrefsToClear) {
      const readBack = Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
      const isEmpty =
        readBack === "" || readBack === undefined || readBack === null;
      verifyResults.push(
        `${key}=${isEmpty ? "✓cleared" : `"${String(readBack).slice(0, 40)}"`}`,
      );
    }
    appendProgress(`Pref verify: ${verifyResults.join(", ")}`, "#374151");

    // Update local state
    cache = {};
    selectionCache = {};
    logsBox.value = "";
    renderModels();
    void renderAccounts();
    if (systemPromptInput) systemPromptInput.value = "";
    if (popupInput) popupInput.checked = true;
    if (selectionTranslateEnableInput) {
      selectionTranslateEnableInput.checked = true;
    }
    if (selectionTranslateAutoInput) {
      selectionTranslateAutoInput.checked = true;
    }
    if (selectionTranslateSourceInput) {
      selectionTranslateSourceInput.dataset.value = "auto";
    }
    if (selectionTranslateTargetInput) {
      selectionTranslateTargetInput.dataset.value = "zh-CN";
    }
    for (const id of settingsSectionIds) sectionState[id] = true;
    setCollapsibleState(
      connectionModeTitle,
      connectionModeBody,
      "connectionMode",
      true,
    );
    setCollapsibleState(modelsTitle, modelsBody, "models", true);
    setCollapsibleState(
      selectionTranslateTitle,
      selectionTranslateBody,
      "selectionTranslate",
      true,
    );
    setCollapsibleState(advancedTitle, advancedBody, "advanced", true);
    setCollapsibleState(consoleTitle, consoleCard, "console", true, "flex");
    setCollapsibleState(
      accountsTitle,
      accountsTable,
      "accounts",
      true,
      "block",
    );
    saveSectionState();
    scrollContainer.scrollTop = 0;
    setPref("settingsScrollTop", "0");
    renderSelectionTranslateLanguageOptions();
    renderSelectionTranslateModelOptions();
    oauthModeRadio.checked = true;
    customModeRadio.checked = false;
    // Clear custom endpoint UI fields — don't show OAuth markers in these inputs
    customApiBaseInput.value = "";
    customApiKeyInput.value = "";
    customModelInput.value = "";
    updateCustomModeUi();
    dangerStatus.textContent = L.restoreDefaultsDone;
    dangerStatus.style.color = "#065f46";
    appendProgress(`✔ ${L.restoreDefaultsDone}`, "#065f46");

    // Refresh all open sidebar panels
    refreshAllSidebarShortcuts(appendProgress);
  });

  clearAllHistoryBtn.addEventListener("click", async () => {
    const confirmed = win.confirm(L.clearAllHistoryConfirm);
    if (!confirmed) return;

    dangerStatus.textContent = L.clearAllHistoryRunning;
    dangerStatus.style.color = "#555";
    appendProgress(`▶ ${L.clearAllHistory}...`);
    try {
      await clearAllChatHistory();
      dangerStatus.textContent = L.clearAllHistoryDone;
      dangerStatus.style.color = "#065f46";
      appendProgress(`✔ ${L.clearAllHistoryDone}`, "#065f46");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dangerStatus.textContent = msg;
      dangerStatus.style.color = "#b91c1c";
      appendProgress(`✖ ${msg}`, "#991b1b");
    }
  });

  // (language switching wired above via switchLang)

  const handleModeChange = (mode: "oauth" | "custom") => {
    setPref("primaryConnectionMode", mode);
    oauthModeRadio.checked = mode === "oauth";
    customModeRadio.checked = mode === "custom";
    updateCustomModeUi();
  };

  oauthTabBtn.addEventListener("click", () => handleModeChange("oauth"));
  customTabBtn.addEventListener("click", () => handleModeChange("custom"));

  // ── Provider label resolution helpers ──

  /**
   * Rule 2: If `rawLabel` already exists in cache with different apiBase/apiKey,
   * append _2, _3, … until we find a free or matching slot.
   * Rule 1: If the existing label has same apiBase+apiKey, return as-is.
   * Rule 3: If label doesn't exist, return as-is.
   */
  const resolveProviderLabel = (
    rawLabel: string,
    apiBase: string,
    apiKey: string,
  ): string => {
    const check = (candidate: string): boolean => {
      const existing = cache[candidate as OAuthProviderId];
      if (!existing || existing.length === 0) return true; // free slot
      const first = existing[0];
      return (
        (first.apiBase || "") === apiBase && (first.apiKey || "") === apiKey
      ); // matching slot
    };
    if (check(rawLabel)) return rawLabel;
    let suffix = 2;
    while (true) {
      const candidate = `${rawLabel}_${suffix}`;
      if (check(candidate)) return candidate;
      suffix++;
      if (suffix > 100) break; // safety
    }
    return `${rawLabel}_${suffix}`;
  };

  /**
   * Load existing models from cache into fetchedModelsList if the current
   * (label, apiBase, apiKey) triple matches an existing provider.
   * All loaded models are checked by default.
   */
  const loadExistingProviderModels = () => {
    const label = fetchedModelsLabelInput.value.trim() || "custom api";
    const apiBase = customApiBaseInput.value.trim().replace(/\/+$/, "");
    const apiKey = customApiKeyInput.value.trim();
    const existing = cache[label as OAuthProviderId] || [];
    if (existing.length === 0) {
      // No match — only clear if user hasn't added anything manually yet
      if (lastFetchedModels.length === 0) renderFetchedModels();
      return;
    }
    // Verify triple match: the existing models must share the same apiBase+apiKey
    const first = existing[0];
    if ((first.apiBase || "") !== apiBase || (first.apiKey || "") !== apiKey) {
      return; // label exists but credentials differ — do not load
    }
    // Build a set of IDs already in lastFetchedModels so we don't duplicate
    const alreadyInList = new Set(lastFetchedModels.map((m) => m.id));
    let changed = false;
    for (const m of existing) {
      if (!alreadyInList.has(m.id)) {
        lastFetchedModels.push({
          id: m.id,
          label: m.label || m.id,
          checked: true,
        });
        changed = true;
      }
    }
    if (changed || lastFetchedModels.length > 0) renderFetchedModels();
  };

  const syncLabelFromApiBase = () => {
    if (!labelManuallyEdited) {
      const rawLabel = generateProviderLabel(customApiBaseInput.value);
      const apiBase = customApiBaseInput.value.trim().replace(/\/+$/, "");
      const apiKey = customApiKeyInput.value.trim();
      fetchedModelsLabelInput.value = resolveProviderLabel(
        rawLabel,
        apiBase,
        apiKey,
      );
    }
    loadExistingProviderModels();
  };
  const persistCustomApiBase = () => {
    persistCustomPref(
      customApiBaseInput,
      "apiBase",
      normalizeCustomApiBaseInput,
    );
    syncLabelFromApiBase();
  };
  const persistCustomApiKey = () => {
    persistCustomPref(customApiKeyInput, "apiKey", (value) => value.trim());
    // apiKey change may affect triple match — re-resolve label + reload models
    syncLabelFromApiBase();
  };
  const persistCustomModel = () =>
    persistCustomPref(customModelInput, "model", (value) => value.trim());

  customApiBaseInput.addEventListener("input", syncLabelFromApiBase);
  customApiBaseInput.addEventListener("change", persistCustomApiBase);
  customApiBaseInput.addEventListener("blur", persistCustomApiBase);
  customApiKeyInput.addEventListener("change", persistCustomApiKey);
  customApiKeyInput.addEventListener("blur", persistCustomApiKey);
  customModelInput.addEventListener("change", persistCustomModel);
  customModelInput.addEventListener("blur", persistCustomModel);
  // Manual label edit — re-check for existing models under the new label
  fetchedModelsLabelInput.addEventListener("blur", loadExistingProviderModels);

  // Deferred initial label resolution + model loading
  // (must be after resolveProviderLabel and loadExistingProviderModels are defined)
  {
    const rawLabel = generateProviderLabel(customApiBaseInput.value);
    const apiBase = customApiBaseInput.value.trim().replace(/\/+$/, "");
    const apiKey = customApiKeyInput.value.trim();
    fetchedModelsLabelInput.value = resolveProviderLabel(
      rawLabel,
      apiBase,
      apiKey,
    );
    loadExistingProviderModels();
  }

  // ── Fetch Models button handler ──
  let fetchModelsBusy = false;
  fetchModelsBtn.addEventListener("click", async () => {
    if (fetchModelsBusy) return;
    const apiBase = customApiBaseInput.value.trim().replace(/\/+$/, "");
    if (!apiBase) {
      customModelHint.textContent = L.fetchModelsFailed;
      customModelHint.style.color = "#dc2626";
      return;
    }
    fetchModelsBusy = true;
    fetchModelsBtn.disabled = true;
    const prevText = fetchModelsBtn.textContent;
    fetchModelsBtn.textContent = L.fetchModelsRunning;
    customModelHint.textContent = L.fetchModelsRunning;
    customModelHint.style.color = "#6b7280";
    try {
      const apiKey = customApiKeyInput.value.trim();
      const models = await fetchCustomEndpointModels(
        apiBase,
        apiKey || undefined,
      );
      // Populate datalist
      while (customModelDatalist.firstChild) {
        customModelDatalist.removeChild(customModelDatalist.firstChild);
      }
      for (const m of models) {
        const opt = doc.createElementNS(HTML_NS, "option") as HTMLOptionElement;
        opt.value = m.id;
        if (m.label && m.label !== m.id) opt.textContent = m.label;
        customModelDatalist.appendChild(opt);
      }

      if (models.length > 0) {
        // Prepare dynamic list UI
        const oldCheckState = new Map(
          lastFetchedModels.map((x) => [x.id, x.checked]),
        );
        lastFetchedModels = models.map((m) => ({
          id: m.id,
          label: m.label || m.id,
          checked: oldCheckState.get(m.id) ?? false,
        }));
        renderFetchedModels();

        customModelHint.textContent = L.fetchModelsDone.replace(
          "{n}",
          String(models.length),
        );
        customModelHint.style.color = "#065f46";
        if (!customModelInput.value.trim() && models.length > 0) {
          customModelInput.value = models[0].id;
          persistCustomModel();
        }
      } else {
        customModelHint.textContent = L.fetchModelsEmpty;
        customModelHint.style.color = "#b45309";
      }
    } catch (err) {
      customModelHint.textContent = L.fetchModelsFailed;
      customModelHint.style.color = "#dc2626";
      ztoolkit?.log?.("AIdea: Fetch models button error", err);
    } finally {
      fetchModelsBusy = false;
      fetchModelsBtn.disabled = false;
      fetchModelsBtn.textContent = prevText || L.fetchModels;
    }
  });

  const advancedGroup = createEl(doc, "div", "llm-set-card");
  const advancedTitle = createEl(
    doc,
    "div",
    "llm-set-title llm-set-collapsible-toggle",
  );
  const advancedBody = createEl(doc, "div", "llm-set-collapsible-body");
  applyCollapsibleState(advancedTitle, advancedBody, "advanced");
  advancedTitle.addEventListener("click", () => {
    toggleCollapsibleState(advancedTitle, advancedBody, "advanced");
  });

  renderStaticText();
  renderModels();
  // Fire-and-forget: accounts table is already wired into the DOM tree,
  // so it will populate asynchronously without blocking the settings UI.
  void renderAccounts();
  persistSelectionState();

  const systemPromptWrap = createEl(doc, "div", "llm-set-field");
  const systemPromptLabel = createEl(
    doc,
    "label",
    "llm-set-label llm-set-label--md",
    L.systemPrompt,
  );
  systemPromptLabel.id = `${config.addonRef}-system-prompt-label`;
  const systemPromptInput = createEl(
    doc,
    "textarea",
    "llm-set-input llm-set-textarea",
  ) as HTMLTextAreaElement;
  systemPromptInput.id = `${config.addonRef}-system-prompt-input`;
  systemPromptInput.rows = 4;
  systemPromptInput.placeholder = L.systemPromptPlaceholder;
  const systemPromptHint = createEl(
    doc,
    "span",
    "llm-set-hint",
    L.systemPromptHint,
  );
  systemPromptHint.id = `${config.addonRef}-system-prompt-hint`;
  systemPromptWrap.append(
    systemPromptLabel,
    systemPromptInput,
    systemPromptHint,
  );
  advancedBody.appendChild(systemPromptWrap);

  systemPromptInput.value = getPref("systemPrompt") || "";
  systemPromptInput.addEventListener("input", () =>
    setPref("systemPrompt", systemPromptInput.value),
  );
  const popupAddTextWrap = createEl(doc, "div", "llm-set-field");
  const popupAddTextLabel = createEl(doc, "label", "llm-set-radio-label");
  const popupInput = createEl(
    doc,
    "input",
    "llm-set-checkbox",
  ) as HTMLInputElement;
  popupInput.type = "checkbox";
  const popupText = createEl(doc, "span", "", L.showAddText);
  popupText.id = `${config.addonRef}-popup-add-text-label`;
  popupAddTextLabel.append(popupInput, popupText);
  const popupHint = createEl(doc, "span", "llm-set-hint", L.showAddTextHint);
  popupHint.id = `${config.addonRef}-popup-add-text-hint`;
  popupAddTextWrap.append(popupAddTextLabel, popupHint);
  advancedBody.appendChild(popupAddTextWrap);

  const prefValue = Zotero.Prefs.get(
    `${config.prefsPrefix}.showPopupAddText`,
    true,
  );
  popupInput.checked =
    prefValue !== false && String(prefValue).toLowerCase() !== "false";
  popupInput.addEventListener("change", () => {
    Zotero.Prefs.set(
      `${config.prefsPrefix}.showPopupAddText`,
      popupInput.checked,
      true,
    );
  });

  const selectionTranslateGroup = createEl(doc, "div", "llm-set-card");
  const selectionTranslateTitle = createEl(
    doc,
    "div",
    "llm-set-title llm-set-collapsible-toggle",
    L.selectionTranslateTitle,
  );
  selectionTranslateTitle.id = `${config.addonRef}-selection-translate-title`;
  const selectionTranslateBody = createEl(
    doc,
    "div",
    "llm-set-collapsible-body",
  );
  applyCollapsibleState(
    selectionTranslateTitle,
    selectionTranslateBody,
    "selectionTranslate",
  );
  selectionTranslateTitle.addEventListener("click", () => {
    toggleCollapsibleState(
      selectionTranslateTitle,
      selectionTranslateBody,
      "selectionTranslate",
    );
  });
  const selectionTranslateWrap = createEl(doc, "div", "llm-tr-section-body");

  const selectionTranslateEnableLabel = createEl(
    doc,
    "label",
    "llm-tr-checkbox-label",
  );
  const selectionTranslateEnableInput = createEl(
    doc,
    "input",
    "llm-set-checkbox",
  ) as HTMLInputElement;
  selectionTranslateEnableInput.type = "checkbox";
  selectionTranslateEnableInput.checked = getBoolPref(
    "selectionTranslate.enabled",
    true,
  );
  const selectionTranslateEnableText = createEl(
    doc,
    "span",
    "",
    L.selectionTranslateEnable,
  );
  selectionTranslateEnableText.id = `${config.addonRef}-selection-translate-enable-label`;
  selectionTranslateEnableLabel.append(
    selectionTranslateEnableInput,
    selectionTranslateEnableText,
  );
  const selectionTranslateEnableHint = createEl(
    doc,
    "span",
    "llm-set-hint",
    L.selectionTranslateEnableHint,
  );
  selectionTranslateEnableHint.id = `${config.addonRef}-selection-translate-enable-hint`;

  const selectionTranslateAutoLabel = createEl(
    doc,
    "label",
    "llm-tr-checkbox-label",
  );
  const selectionTranslateAutoInput = createEl(
    doc,
    "input",
    "llm-set-checkbox",
  ) as HTMLInputElement;
  selectionTranslateAutoInput.type = "checkbox";
  selectionTranslateAutoInput.checked = getBoolPref(
    "selectionTranslate.auto",
    true,
  );
  const selectionTranslateAutoText = createEl(
    doc,
    "span",
    "",
    L.selectionTranslateAuto,
  );
  selectionTranslateAutoText.id = `${config.addonRef}-selection-translate-auto-label`;
  selectionTranslateAutoLabel.append(
    selectionTranslateAutoInput,
    selectionTranslateAutoText,
  );
  const selectionTranslateAutoHint = createEl(
    doc,
    "span",
    "llm-set-hint",
    L.selectionTranslateAutoHint,
  );
  selectionTranslateAutoHint.id = `${config.addonRef}-selection-translate-auto-hint`;

  const selectionTranslateModelField = createEl(
    doc,
    "div",
    "llm-tr-path-block",
  );
  const selectionTranslateModelLabel = createEl(
    doc,
    "div",
    "llm-tr-field-label",
    L.selectionTranslateModel,
  );
  selectionTranslateModelLabel.id = `${config.addonRef}-selection-translate-model-label`;
  const selectionTranslateModelInput = createTranslateStyleDropdown(
    `${config.addonRef}-selection-translate-model`,
  );
  selectionTranslateModelDropdown = selectionTranslateModelInput;
  const selectionTranslateModelHint = createEl(
    doc,
    "span",
    "llm-set-hint",
    L.selectionTranslateModelHint,
  );
  selectionTranslateModelHint.id = `${config.addonRef}-selection-translate-model-hint`;
  selectionTranslateModelField.append(
    selectionTranslateModelLabel,
    selectionTranslateModelInput,
    selectionTranslateModelHint,
  );

  const languageRow = createEl(doc, "div", "llm-tr-lang-row");
  const selectionTranslateSourceField = createEl(
    doc,
    "div",
    "llm-tr-lang-half",
  );
  const selectionTranslateSourceLabel = createEl(
    doc,
    "div",
    "llm-tr-field-label",
    L.selectionTranslateSourceLang,
  );
  selectionTranslateSourceLabel.id = `${config.addonRef}-selection-translate-source-label`;
  const selectionTranslateSourceInput = createTranslateStyleDropdown(
    `${config.addonRef}-selection-translate-source`,
  );
  selectionTranslateSourceDropdown = selectionTranslateSourceInput;
  const selectionTranslateTargetField = createEl(
    doc,
    "div",
    "llm-tr-lang-half",
  );
  const selectionTranslateTargetLabel = createEl(
    doc,
    "div",
    "llm-tr-field-label",
    L.selectionTranslateTargetLang,
  );
  selectionTranslateTargetLabel.id = `${config.addonRef}-selection-translate-target-label`;
  const selectionTranslateTargetInput = createTranslateStyleDropdown(
    `${config.addonRef}-selection-translate-target`,
  );
  selectionTranslateTargetDropdown = selectionTranslateTargetInput;
  selectionTranslateSourceField.append(
    selectionTranslateSourceLabel,
    selectionTranslateSourceInput,
  );
  selectionTranslateTargetField.append(
    selectionTranslateTargetLabel,
    selectionTranslateTargetInput,
  );
  languageRow.append(
    selectionTranslateSourceField,
    selectionTranslateTargetField,
  );

  const selectionTranslateColdStartHint = createEl(
    doc,
    "div",
    "llm-set-hint",
    L.selectionTranslateColdStartHint,
  );
  selectionTranslateColdStartHint.id = `${config.addonRef}-selection-translate-cold-start-hint`;

  const selectionTranslateClearRow = createEl(
    doc,
    "div",
    "llm-tr-row llm-tr-format-row",
  );
  const selectionTranslateClearBtn = createEl(
    doc,
    "button",
    "llm-tr-btn llm-tr-btn-warning llm-tr-btn-small",
    L.selectionTranslateClearCache,
  ) as HTMLButtonElement;
  selectionTranslateClearBtn.type = "button";
  selectionTranslateClearBtn.id = `${config.addonRef}-selection-translate-clear-cache`;
  const selectionTranslateClearStatus = createEl(
    doc,
    "span",
    "llm-set-status",
  ) as HTMLSpanElement;
  selectionTranslateClearRow.append(
    selectionTranslateClearBtn,
    selectionTranslateClearStatus,
  );

  selectionTranslateWrap.append(
    selectionTranslateEnableLabel,
    selectionTranslateEnableHint,
    selectionTranslateModelField,
    languageRow,
    selectionTranslateColdStartHint,
    selectionTranslateClearRow,
  );
  selectionTranslateBody.appendChild(selectionTranslateWrap);
  selectionTranslateGroup.append(
    selectionTranslateTitle,
    selectionTranslateBody,
  );

  selectionTranslateEnableInput.addEventListener("change", () => {
    setBoolPref(
      "selectionTranslate.enabled",
      selectionTranslateEnableInput.checked,
    );
  });
  selectionTranslateAutoInput.addEventListener("change", () => {
    setBoolPref("selectionTranslate.auto", selectionTranslateAutoInput.checked);
  });
  selectionTranslateClearBtn.addEventListener("click", async () => {
    selectionTranslateClearBtn.disabled = true;
    selectionTranslateClearStatus.textContent =
      L.selectionTranslateClearCacheRunning;
    selectionTranslateClearStatus.style.color = "#374151";
    try {
      const count = await clearSelectionTranslateColdStartCache();
      selectionTranslateClearStatus.textContent =
        L.selectionTranslateClearCacheDone.replace("{n}", String(count));
      selectionTranslateClearStatus.style.color = "#065f46";
    } catch (err) {
      selectionTranslateClearStatus.textContent =
        err instanceof Error ? err.message : String(err);
      selectionTranslateClearStatus.style.color = "#dc2626";
    } finally {
      selectionTranslateClearBtn.disabled = false;
    }
  });
  renderSelectionTranslateLanguageOptions();
  renderSelectionTranslateModelOptions();

  // showAllModels feature is hidden from the UI but we must NOT force-write
  // the pref on every render — that would silently override any user/external value.
  const showAllModelsWrap = createEl(doc, "div");
  showAllModelsWrap.style.display = "none";
  const showAllModelsInput = createEl(doc, "input") as HTMLInputElement;
  showAllModelsInput.type = "checkbox";
  showAllModelsWrap.appendChild(showAllModelsInput);
  advancedBody.appendChild(showAllModelsWrap);
  advancedGroup.append(advancedTitle, advancedBody);

  // ── Build collapsible console section ──
  const consoleSection = createEl(doc, "div", "llm-set-card");
  consoleSection.append(consoleTitle, consoleCard);

  // ── Move authCards, accountsBox into OAuth panel ──
  oauthPanel.append(authCards, accountsBox);

  // ── Final assembly — optimized section order ──
  root.appendChild(langBox);
  root.appendChild(connectionModeBox);
  root.appendChild(modelsBox);
  root.appendChild(selectionTranslateGroup);
  root.appendChild(advancedGroup);
  root.appendChild(consoleSection);

  const savedScrollTop = Number(getPref("settingsScrollTop") || "0");
  if (Number.isFinite(savedScrollTop) && savedScrollTop > 0) {
    win.setTimeout(() => {
      scrollContainer.scrollTop = Math.max(0, Math.floor(savedScrollTop));
    }, 0);
  }
}
