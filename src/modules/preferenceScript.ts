import { config } from "../../package.json";
import { HTML_NS } from "../utils/domHelpers";
import {
  autoConfigureEnvironment,
  fetchAvailableModels,
  fetchCustomEndpointModels,
  getProviderAccountSummary,
  getProviderLabel,
  providerToMarker,
  removeProviderOAuthCredential,
  runProviderOAuthLogin,
  type OAuthProviderId,
  type ProviderModelOption,
} from "../utils/oauthCli";
import { clearAllChatHistory } from "../utils/chatStore";
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
import { getPrimaryConnectionMode } from "./contextPanel/prefHelpers";

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
  | "uiLanguage";

type Lang = "zh-CN" | "en-US";
const PROVIDERS: OAuthProviderId[] = [
  "openai-codex",
  "google-gemini-cli",
  "qwen",
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

function getLang(): Lang {
  const saved = (getPref("uiLanguage") || "").trim();
  if (saved === "en-US") return "en-US";
  if (saved === "zh-CN") return "zh-CN";
  // Auto-detect from Zotero locale
  try {
    const detected: Lang = /^zh/i.test(String((Zotero as any)?.locale || ""))
      ? "zh-CN"
      : "en-US";
    // Persist the detected language so future opens don't re-detect
    setPref("uiLanguage", detected);
    return detected;
  } catch {
    return "en-US";
  }
}

const I18N = {
  "zh-CN": {
    envOAuth: "环境与 OAuth",
    primaryConnectionMode: "主连接模式",
    oauthProvidersMode: "OAuth 提供商",
    customCompatibleMode: "自定义 OpenAI 兼容接口",
    customEndpointTitle: "自定义 OpenAI 兼容接口",
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
    fetchModels: "获取模型列表",
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
    internalNote:
      "只有勾选的模型会出现在侧边栏对话框中。前 4 个勾选模型会同步到配置槽位。",
    systemPrompt: "自定义系统提示词（可选）",
    systemPromptHint: "覆盖默认系统提示词（留空使用默认值）",
    showAddText: "在阅读器选择弹窗显示 Add Text",
    showAddTextHint:
      "如果不想在 Zotero 文本选择弹出菜单中显示 Add Text 选项，请关闭此开关。",
    showAllModels: "在下拉菜单中显示所有模型",
    showAllModelsHint:
      "开启后显示所有可用模型。关闭时仅显示每个提供商的精选模型。",
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
  },
  "en-US": {
    envOAuth: "Environment & OAuth",
    primaryConnectionMode: "Primary connection mode",
    oauthProvidersMode: "OAuth providers",
    customCompatibleMode: "Custom OpenAI-compatible",
    customEndpointTitle: "Custom OpenAI-compatible",
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
    fetchModels: "Fetch Models",
    fetchModelsRunning: "Fetching models...",
    fetchModelsDone: "{n} models found",
    fetchModelsFailed: "Failed to fetch models. Check API Base URL and API Key.",
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
    internalNote:
      "Only checked models appear in the sidebar dropdown. The first four checked models are synced to profile slots.",
    systemPrompt: "Custom System Prompt (Optional)",
    systemPromptHint:
      "Override the default system prompt (leave empty to use default)",
    showAddText: 'Show "Add Text" in reader selection popup',
    showAddTextHint:
      "Disable this if you prefer not to show the Add Text option in Zotero's text selection popup menu.",
    showAllModels: "Show all models in dropdown",
    showAllModelsHint:
      "When enabled, shows all available models. When disabled, only the best models per provider are shown.",
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
  },
} as const;

type Dict = Record<string, string>;
const tt = (l: Lang): Dict => I18N[l] as unknown as Dict;

export function normalizeCustomApiBaseInput(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return `${trimmed.replace(/\/+$/, "")}/`;
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

function parseModelCache(): Partial<
  Record<string, ProviderModelOption[]>
> {
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

function saveModelCache(
  cache: Partial<Record<string, ProviderModelOption[]>>,
) {
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
  const flattened: Array<{ provider: string; model: string; apiBase?: string; apiKey?: string }> = [];
  const activeProviders = Array.from(new Set([...PROVIDERS, ...Object.keys(cache)]));

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
      flattened.push({ provider, model: id, apiBase: row.apiBase, apiKey: row.apiKey });
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
      setPref("apiBase", first ? providerToMarker(first.provider as OAuthProviderId) : "");
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

export async function bootstrapSettingTab(doc: Document, scrollContainer: HTMLElement, consoleContainer: HTMLElement) {
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

  const langBox = createEl(doc, "div", "llm-set-card llm-set-card--inline");
  const langLabel = createEl(doc, "label", "llm-set-label");

  // Custom dropdown — native <select> shows a bullet on the selected <option> in Gecko
  const LANG_OPTIONS: { value: Lang; label: string }[] = [
    { value: "zh-CN", label: "CN" },
    { value: "en-US", label: "EN" },
  ];
  const dropdownWrap = createEl(doc, "div", "llm-set-dropdown-wrap");
  const dropdownBtn = createEl(doc, "button", "llm-set-dropdown-btn") as HTMLButtonElement;
  dropdownBtn.type = "button";
  const dropdownBtnLabel = createEl(
    doc, "span", "",
    LANG_OPTIONS.find((o) => o.value === lang)?.label ?? lang,
  );
  const dropdownBtnArrow = createEl(doc, "span", "llm-set-dropdown-arrow", "\u25be");
  dropdownBtn.append(dropdownBtnLabel, dropdownBtnArrow);

  const dropdownList = createEl(doc, "div", "llm-set-dropdown-list");

  const dropdownItems = LANG_OPTIONS.map((opt) => {
    const item = createEl(doc, "div", "llm-set-dropdown-item", opt.label);
    item.addEventListener("mouseenter", () => {
      item.style.background = "#f3f4f6";
    });
    item.addEventListener("mouseleave", () => {
      item.classList.toggle("llm-set-dropdown-item--active", lang === opt.value);
      item.style.background = "";
    });
    item.addEventListener("click", () => {
      switchLang(opt.value);
      dropdownBtnLabel.textContent = opt.label;
      dropdownList.style.display = "none";
      dropdownItems.forEach((i) => {
        i.classList.remove("llm-set-dropdown-item--active");
        i.style.background = "";
      });
      item.classList.add("llm-set-dropdown-item--active");
    });
    if (opt.value === lang) item.classList.add("llm-set-dropdown-item--active");
    dropdownList.appendChild(item);
    return item;
  });

  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownList.style.display =
      dropdownList.style.display === "none" ? "block" : "none";
  });
  // Scope the "click outside to close" listener to the settings scroll area
  // instead of the entire Zotero document to avoid a permanent global listener leak.
  scrollContainer.addEventListener("click", () => {
    dropdownList.style.display = "none";
  });

  dropdownWrap.append(dropdownBtn, dropdownList);

  const switchLang = (next: Lang) => {
    lang = next;
    setPref("uiLanguage", lang);
    renderStaticText();
    renderModels();
    void renderAccounts();
    refreshAllSidebarShortcuts();
  };

  langBox.append(langLabel, dropdownWrap);
  root.appendChild(langBox);

  const envBox = createEl(doc, "div", "llm-set-card llm-set-card--dashed");
  const envTitle = createEl(doc, "div", "llm-set-title");
  const envActionRow = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
  const refreshAllBtn = createEl(doc, "button", "llm-set-btn") as HTMLButtonElement;
  refreshAllBtn.type = "button";
  const restoreDefaultsBtn = createEl(doc, "button", "llm-set-btn llm-set-btn--warn") as HTMLButtonElement;
  restoreDefaultsBtn.type = "button";
  const clearAllHistoryBtn = createEl(doc, "button", "llm-set-btn llm-set-btn--danger") as HTMLButtonElement;
  clearAllHistoryBtn.type = "button";
  const dangerStatus = createEl(doc, "span", "llm-set-status");
  envActionRow.append(
    refreshAllBtn,
    restoreDefaultsBtn,
    clearAllHistoryBtn,
    dangerStatus,
  );
  const progressText = createEl(doc, "span", "llm-set-status");
  const progressList = createEl(doc, "div", "llm-set-progress-list");
  const logsBox = createEl(doc, "textarea", "llm-set-logs-area") as HTMLTextAreaElement;
  logsBox.readOnly = true;
  logsBox.value = getPref("oauthSetupLog") || "";

  envBox.append(envTitle, envActionRow, progressText);
  root.appendChild(envBox);

  // Console section — inline in scroll area between Environment and Connection Mode
  const consoleCard = createEl(doc, "div", "llm-set-card");
  consoleCard.append(progressList, logsBox);
  root.appendChild(consoleCard);

  const connectionModeBox = createEl(doc, "div", "llm-set-card");
  const connectionModeTitle = createEl(doc, "div", "llm-set-title");
  const connectionModeHint = createEl(doc, "div", "llm-set-hint");
  const connectionModeRow = createEl(doc, "div", "llm-set-row llm-set-gap-lg");
  const connectionModeGroupName = `${config.addonRef}-primary-connection-mode`;
  const oauthModeOption = createEl(doc, "label", "llm-set-radio-label");
  const oauthModeRadio = createEl(doc, "input") as HTMLInputElement;
  oauthModeRadio.type = "radio";
  oauthModeRadio.name = connectionModeGroupName;
  oauthModeRadio.id = `${config.addonRef}-primary-connection-mode-oauth`;
  oauthModeRadio.value = "oauth";
  const oauthModeText = createNode(doc, "span");
  oauthModeOption.append(oauthModeRadio, oauthModeText);
  const customModeOption = createNode(
    doc,
    "label",
    "display:inline-flex; align-items:center; gap:8px; font-size:13px; font-weight:600; cursor:pointer;",
  );
  const customModeRadio = createNode(doc, "input") as HTMLInputElement;
  customModeRadio.type = "radio";
  customModeRadio.name = connectionModeGroupName;
  customModeRadio.id = `${config.addonRef}-primary-connection-mode-custom`;
  customModeRadio.value = "custom";
  const customModeText = createNode(doc, "span");
  customModeOption.append(customModeRadio, customModeText);
  connectionModeRow.append(oauthModeOption, customModeOption);

  const customFieldsBox = createEl(doc, "div", "llm-set-custom-fields");
  customFieldsBox.id = `${config.addonRef}-custom-openai-fields`;

  const customApiBaseField = createEl(doc, "div", "llm-set-field");
  const customApiBaseLabel = createEl(doc, "label", "llm-set-label");
  customApiBaseLabel.setAttribute("for", `${config.addonRef}-custom-api-base`);
  const customApiBaseInput = createEl(doc, "input", "llm-set-input") as HTMLInputElement;
  customApiBaseInput.id = `${config.addonRef}-custom-api-base`;
  customApiBaseInput.type = "text";
  const customApiBaseHint = createEl(doc, "span", "llm-set-hint");
  customApiBaseField.append(customApiBaseLabel, customApiBaseInput, customApiBaseHint);

  const customApiKeyField = createEl(doc, "div", "llm-set-field");
  const customApiKeyLabel = createEl(doc, "label", "llm-set-label");
  customApiKeyLabel.setAttribute("for", `${config.addonRef}-custom-api-key`);
  const customApiKeyInput = createEl(doc, "input", "llm-set-input") as HTMLInputElement;
  customApiKeyInput.id = `${config.addonRef}-custom-api-key`;
  customApiKeyInput.type = "password";
  const customApiKeyHint = createEl(doc, "span", "llm-set-hint");
  customApiKeyField.append(customApiKeyLabel, customApiKeyInput, customApiKeyHint);

  const customModelField = createEl(doc, "div", "llm-set-field");
  const customModelLabel = createEl(doc, "label", "llm-set-label");
  customModelLabel.setAttribute("for", `${config.addonRef}-custom-model`);
  const customModelInput = createEl(doc, "input", "llm-set-input") as HTMLInputElement;
  customModelInput.id = `${config.addonRef}-custom-model`;
  customModelInput.type = "text";
  const customModelDatalist = doc.createElementNS(HTML_NS, "datalist") as HTMLDataListElement;
  customModelDatalist.id = `${config.addonRef}-custom-model-list`;
  customModelInput.setAttribute("list", customModelDatalist.id);
  const customModelInputRow = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
  const fetchModelsBtn = createEl(doc, "button", "llm-set-btn llm-set-btn--accent") as HTMLButtonElement;
  fetchModelsBtn.type = "button";
  customModelInputRow.append(customModelInput, fetchModelsBtn);
  const customModelHint = createEl(doc, "span", "llm-set-hint");
  customModelField.append(customModelLabel, customModelInputRow, customModelDatalist, customModelHint);

  const fetchedModelsBox = createEl(doc, "div", "llm-set-fetched-panel");
  const fetchedModelsHeader = createEl(doc, "div", "llm-set-row llm-set-row--spread");
  const fetchedModelsLabelRow = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
  const fetchedModelsLabelText = createEl(doc, "label", "llm-set-label");
  const fetchedModelsLabelInput = createEl(doc, "input", "llm-set-input") as HTMLInputElement;
  fetchedModelsLabelInput.style.width = "auto";
  fetchedModelsLabelInput.style.minWidth = "120px";
  fetchedModelsLabelInput.value = "custom api";
  fetchedModelsLabelInput.type = "text";
  fetchedModelsLabelRow.append(fetchedModelsLabelText, fetchedModelsLabelInput);
  const fetchedModelsHeaderRight = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
  const addCustomModelBtn = createEl(doc, "button", "llm-set-btn llm-set-btn--pill");
  const saveModelsBtn = createEl(doc, "button", "llm-set-btn llm-set-btn--success llm-set-btn--pill");
  fetchedModelsHeaderRight.append(addCustomModelBtn, saveModelsBtn);
  fetchedModelsHeader.append(fetchedModelsLabelRow, fetchedModelsHeaderRight);
  const fetchedModelsList = createEl(doc, "div", "llm-set-fetched-list");
  fetchedModelsBox.append(fetchedModelsHeader, fetchedModelsList);
  
  let lastFetchedModels: { id: string; label: string; checked: boolean }[] = [];

  const renderFetchedModels = () => {
    fetchedModelsList.innerHTML = "";
    for (const m of lastFetchedModels) {
      const row = createEl(doc, "label", "llm-set-fetched-row");
      const cb = createEl(doc, "input") as HTMLInputElement;
      cb.type = "checkbox";
      cb.checked = m.checked;
      cb.addEventListener("change", () => { m.checked = cb.checked; });
      const textLabel = createNode(doc, "span", "word-break:break-all;", m.label || m.id);
      row.append(cb, textLabel);
      fetchedModelsList.append(row);
    }
  };

  addCustomModelBtn.addEventListener("click", () => {
    const newId = win.prompt(lang === "zh-CN" ? "请输入自定义模型名称 (ID):" : "Enter custom model ID:");
    if (!newId) return;
    const trimmed = newId.trim();
    if (!trimmed) return;
    if (!lastFetchedModels.find(m => m.id === trimmed)) {
      lastFetchedModels.unshift({ id: trimmed, label: trimmed, checked: true });
      renderFetchedModels();
    }
  });

  saveModelsBtn.addEventListener("click", () => {
    const label = fetchedModelsLabelInput.value.trim() || "custom api";
    const selected = lastFetchedModels.filter(m => m.checked);
    const apiBase = customApiBaseInput.value.trim().replace(/\/+$/, "");
    const apiKey = customApiKeyInput.value.trim();
    
    // Issue 4 fix: If a different label already has models with the same apiBase,
    // remove that old entry to prevent duplicate provider groups.
    if (apiBase) {
      for (const existingLabel of Object.keys(cache)) {
        if (existingLabel === label) continue;
        const existingModels = cache[existingLabel as OAuthProviderId] || [];
        const hasMatchingBase = existingModels.some(m => m.apiBase === apiBase);
        if (hasMatchingBase) {
          delete cache[existingLabel as OAuthProviderId];
          // Also clean selection cache for the old label
          if (selectionCache[existingLabel as OAuthProviderId] !== undefined) {
            delete selectionCache[existingLabel as OAuthProviderId];
          }
        }
      }
    }
    
    const existing = cache[label as OAuthProviderId] || [];
    const newModels = selected.map(m => ({ id: m.id, label: m.label, apiBase, apiKey }));
    
    const mergedMap = new Map();
    for (const m of existing) mergedMap.set(m.id, m);
    for (const m of newModels) mergedMap.set(m.id, m);
    
    cache = { ...cache, [label as OAuthProviderId]: Array.from(mergedMap.values()) };
    saveModelCache(cache);
    persistSelectionState();
    renderModels();
    
    fetchedModelsBox.style.display = "none";
    customModelHint.textContent = lang === "zh-CN" ? "模型已保存" : "Models saved";
    customModelHint.style.color = "#059669";
  });

  const customModeStatus = createEl(doc, "div", "llm-set-status");
  customModeStatus.id = `${config.addonRef}-custom-openai-status`;
  customFieldsBox.append(
    customApiBaseField,
    customApiKeyField,
    customModelField,
    fetchedModelsBox,
    customModeStatus,
  );
  connectionModeBox.append(
    connectionModeTitle,
    connectionModeRow,
    connectionModeHint,
    customFieldsBox,
  );
  root.appendChild(connectionModeBox);

  const setCustomInputBorderState = (
    input: HTMLInputElement,
    missing: boolean,
  ) => {
    input.classList.toggle("llm-set-input--error", missing);
  };

  const updateCustomModeUi = () => {
    const isCustom = customModeRadio.checked;
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
  const initialMode = getPrimaryConnectionMode();
  oauthModeRadio.checked = initialMode !== "custom";
  customModeRadio.checked = initialMode === "custom";

  const authCards = createEl(doc, "div", "llm-settings-root");
  root.appendChild(authCards);

  const accountsBox = createEl(doc, "div", "llm-set-card");
  const accountsTitle = createEl(doc, "div", "llm-set-title");
  const accountsTable = createEl(doc, "div", "llm-set-table");
  accountsBox.append(accountsTitle, accountsTable);
  root.appendChild(accountsBox);

  const modelsBox = createEl(doc, "div", "llm-set-card");
  const modelsTitle = createEl(doc, "div", "llm-set-title");
  const modelsTable = createEl(doc, "div", "llm-set-table");
  const note = createEl(doc, "div", "llm-set-hint");
  modelsBox.append(modelsTitle, modelsTable, note);
  root.appendChild(modelsBox);

  const providerCards = new Map<
    OAuthProviderId,
    {
      status: HTMLSpanElement;
      setupBtn: HTMLButtonElement;
      loginBtn: HTMLButtonElement;
      refreshBtn: HTMLButtonElement;
      deleteBtn: HTMLButtonElement;
    }
  >();

  const renderStaticText = () => {
    L = tt(lang);
    // "UI Language" label stays English regardless of selected language
    langLabel.textContent = "UI Language:";
    envTitle.textContent = L.envOAuth;
    refreshAllBtn.textContent = L.refreshAllModels;
    restoreDefaultsBtn.textContent = L.restoreDefaults;
    clearAllHistoryBtn.textContent = L.clearAllHistory;
    accountsTitle.textContent = L.accounts;
    modelsTitle.textContent = L.models;
    note.textContent = L.internalNote;
    connectionModeTitle.textContent = L.customEndpointTitle;
    oauthModeText.textContent = L.oauthProvidersMode;
    customModeText.textContent = L.customCompatibleMode;
    connectionModeHint.textContent = L.customEndpointHint;
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
    fetchedModelsLabelText.textContent = lang === "zh-CN" ? "提供商标签:" : "Provider Label:";
    addCustomModelBtn.textContent = lang === "zh-CN" ? "➕ 添加自定义模型" : "➕ Add Custom";
    saveModelsBtn.textContent = lang === "zh-CN" ? "💾 保存勾选模型" : "💾 Save Models";
    for (const provider of PROVIDERS) {
      const refs = providerCards.get(provider);
      if (!refs) continue;
      refs.setupBtn.textContent = L.installEnv;
      refs.loginBtn.textContent = L.oauthLogin;
      refs.refreshBtn.textContent = L.refreshModels;
      refs.deleteBtn.textContent = L.oauthDelete;
    }
    // Update XHTML static labels
    const spl = doc.querySelector(`#${config.addonRef}-system-prompt-label`);
    if (spl) spl.textContent = L.systemPrompt;
    const sph = doc.querySelector(`#${config.addonRef}-system-prompt-hint`);
    if (sph) sph.textContent = L.systemPromptHint;
    const atl = doc.querySelector(`#${config.addonRef}-popup-add-text-label`);
    if (atl) atl.textContent = L.showAddText;
    const ath = doc.querySelector(`#${config.addonRef}-popup-add-text-hint`);
    if (ath) ath.textContent = L.showAddTextHint;
    const saml = doc.querySelector(`#${config.addonRef}-show-all-models-label`);
    if (saml) saml.textContent = L.showAllModels;
    const samh = doc.querySelector(`#${config.addonRef}-show-all-models-hint`);
    if (samh) samh.textContent = L.showAllModelsHint;
    updateCustomModeUi();
  };

  const appendProgress = (line: string, color = "#374151") => {
    const row = createNode(doc, "div", `color:${color};`);
    row.textContent = line;
    progressList.appendChild(row);
    progressList.scrollTop = progressList.scrollHeight;
  };

  const flushUi = () =>
    new Promise<void>((resolve) => win.setTimeout(resolve, 0));

  const persistSelectionState = () => {
    const reconciled = reconcileModelSelectionCache(cache, selectionCache);
    selectionCache = reconciled.cache;
    saveModelSelectionState(selectionCache);
    syncSidebarModelPrefsFromSelection(cache, selectionCache);
    // Notify all open Discussion tabs to refresh their model menus
    try { doc.dispatchEvent(new Event("llm-models-changed")); } catch { /* ignore */ }
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
        createEl(doc, "div", "", s.status),
      );
      accountsTable.appendChild(row);
    }
  };

  const renderModels = () => {
    modelsTable.innerHTML = "";
    let count = 0;
    
    const activeProviders = Array.from(new Set([...PROVIDERS, ...Object.keys(cache)]));
    
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
        doc, "div", "llm-set-provider-title",
        getProviderLabel(provider as OAuthProviderId),
      );
      const summaryText =
        lang === "zh-CN"
          ? `已勾选 ${selectedCount}/${providerModels.length}`
          : `Selected ${selectedCount}/${providerModels.length}`;
      const summary = createEl(doc, "div", "llm-set-provider-summary", summaryText);
      header.append(title, summary);

      const actions = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
      const defaultBtn = createEl(
        doc, "button", "llm-set-btn llm-set-btn--pill",
        lang === "zh-CN" ? "默认" : "Defaults",
      ) as HTMLButtonElement;
      defaultBtn.type = "button";
      defaultBtn.addEventListener("click", () => {
        setProviderSelection(
          provider as OAuthProviderId,
          getDefaultSelectedModelIds(provider as OAuthProviderId, providerModels),
        );
      });
      const allBtn = createEl(
        doc, "button", "llm-set-btn llm-set-btn--pill",
        lang === "zh-CN" ? "全选" : "Select All",
      ) as HTMLButtonElement;
      allBtn.type = "button";
      allBtn.addEventListener("click", () => {
        setProviderSelection(
          provider as OAuthProviderId,
          providerModels.map((row) => row.id),
        );
      });
      const clearBtn = createEl(
        doc, "button", "llm-set-btn llm-set-btn--pill",
        lang === "zh-CN" ? "清空" : "Clear",
      ) as HTMLButtonElement;
      clearBtn.type = "button";
      clearBtn.addEventListener("click", () => {
        setProviderSelection(provider as OAuthProviderId, []);
      });
      actions.append(defaultBtn, allBtn, clearBtn);
      section.append(header, actions);

      for (const row of providerModels) {
        const id = String(row.id || "").trim();
        if (!id) continue;
        const line = createEl(doc, "label", "llm-set-model-row");
        const checkbox = createEl(doc, "input", "llm-set-checkbox") as HTMLInputElement;
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
        textBox.append(createEl(doc, "div", "llm-set-model-id", id));
        if (row.label && row.label !== id) {
          textBox.append(createEl(doc, "div", "llm-set-model-label", row.label));
        }
        line.append(checkbox, textBox);
        section.appendChild(line);
      }

      modelsTable.appendChild(section);
    }
    if (!count) {
      modelsTable.appendChild(
        createEl(doc, "div", "llm-set-hint", L.noModels),
      );
    }
  };

  const refreshOneProvider = async (provider: OAuthProviderId) => {
    progressText.textContent = L.refreshingModels;
    appendProgress(`[${getProviderLabel(provider)}] ${L.refreshingModels}`);
    await flushUi();
    const models = await fetchAvailableModels(provider);
    cache = { ...cache, [provider]: models };
    saveModelCache(cache);
    persistSelectionState();
    renderModels();
    await renderAccounts();
    const refs = providerCards.get(provider);
    if (refs) {
      const s = await getProviderAccountSummary(provider);
      refs.status.textContent = s.status;
      refs.status.style.color = /logged in/i.test(s.status)
        ? "green"
        : "#b45309";
    }
    progressText.textContent = "";
  };

  for (const provider of PROVIDERS) {
    const card = createEl(doc, "div", "llm-set-card");
    const title = createEl(
      doc, "div", "llm-set-provider-title",
      getProviderLabel(provider),
    );
    const row = createEl(doc, "div", "llm-set-row llm-set-gap-sm");
    const perProviderSetupBtn = createEl(
      doc, "button", "llm-set-btn llm-set-btn--success",
    ) as HTMLButtonElement;
    perProviderSetupBtn.type = "button";
    const loginBtn = createEl(
      doc, "button", "llm-set-btn llm-set-btn--accent",
    ) as HTMLButtonElement;
    loginBtn.type = "button";
    const refreshBtn = createEl(
      doc, "button", "llm-set-btn",
    ) as HTMLButtonElement;
    refreshBtn.type = "button";
    const deleteBtn = createEl(
      doc, "button", "llm-set-btn llm-set-btn--danger",
    ) as HTMLButtonElement;
    deleteBtn.type = "button";
    const status = createEl(doc, "span", "llm-set-status") as HTMLSpanElement;
    row.append(perProviderSetupBtn, loginBtn, refreshBtn, deleteBtn, status);
    card.append(title, row);
    authCards.appendChild(card);
    providerCards.set(provider, {
      status,
      setupBtn: perProviderSetupBtn,
      loginBtn,
      refreshBtn,
      deleteBtn,
    });

    // Qwen and Copilot use in-plugin Device Code flows — no CLI needed
    if (provider === "qwen" || provider === "github-copilot") {
      perProviderSetupBtn.setAttribute(
        "style",
        perProviderSetupBtn.getAttribute("style") + "display:none;",
      );

      loginBtn.addEventListener("click", async () => {
        // Show OAuth risk warning on first click only
        const alreadyAccepted = getPref("oauthRiskAccepted") === "true";
        if (!alreadyAccepted) {
          const riskMessage =
            lang === "zh-CN"
              ? "\u26a0\ufe0f OAuth \u6388\u6743\u63d0\u793a\n\n" +
                "\u5c06\u542f\u52a8 Device Code OAuth \u6d41\u7a0b\uff1a\n" +
                "1. \u7a0d\u540e\u4f1a\u663e\u793a\u9a8c\u8bc1\u7f51\u5740\u548c\u6388\u6743\u7801\n" +
                "2. \u6253\u5f00\u6d4f\u89c8\u5668\u5b8c\u6210\u6388\u6743\n\n" +
                "\u8bf7\u6ce8\u610f\uff1a\n" +
                "\u2022 OAuth \u4ee4\u724c\u4ec5\u4fdd\u5b58\u5728\u672c\u5730\u8bbe\u5907\n" +
                "\u2022 \u6b64\u7528\u6cd5\u672a\u7ecf\u670d\u52a1\u5546\u660e\u786e\u6388\u6743\uff0c\u7406\u8bba\u4e0a\u5b58\u5728\u8d26\u53f7\u88ab\u9650\u5236\u7684\u53ef\u80fd\u6027\n" +
                "\u2022 \u4f7f\u7528 AI \u670d\u52a1\u53ef\u80fd\u4ea7\u751f\u8d39\u7528\n" +
                "\u2022 \u672c\u63d2\u4ef6\u5b8c\u5168\u514d\u8d39\u4e14\u5f00\u6e90\uff0c\u4e0d\u6536\u96c6\u4efb\u4f55\u7528\u6237\u6570\u636e\n\n" +
                "\u662f\u5426\u7ee7\u7eed\uff1f"
              : "\u26a0\ufe0f OAuth Authorization Notice\n\n" +
                "This will start the Device Code OAuth flow:\n" +
                "1. A verification URL and code will be displayed\n" +
                "2. Open your browser to authorize the application\n\n" +
                "Please note:\n" +
                "\u2022 OAuth tokens are stored locally on your device only\n" +
                "\u2022 This plugin uses OAuth tokens which is not officially endorsed \u2014 theoretical risk of account restrictions\n" +
                "\u2022 Using AI services may incur charges\n" +
                "\u2022 This plugin is free, open-source, and collects no user data\n\n" +
                "Do you wish to continue?";
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

      refreshBtn.addEventListener("click", async () => {
        await refreshOneProvider(provider);
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
          const riskMessage =
            lang === "zh-CN"
              ? "\u26a0\ufe0f OAuth \u6388\u6743\u63d0\u793a\n\n" +
                "\u201c\u5b89\u88c5\u73af\u5883\u201d\u5c06\u6267\u884c\u4ee5\u4e0b\u64cd\u4f5c\uff1a\n" +
                "1. \u5b89\u88c5 Node.js \u8fd0\u884c\u73af\u5883\uff08\u5982\u5c1a\u672a\u5b89\u88c5\uff09\n" +
                "2. \u5b89\u88c5\u5bf9\u5e94\u63d0\u4f9b\u5546\u7684 CLI \u5de5\u5177\n" +
                "3. \u901a\u8fc7 OAuth \u534f\u8bae\u6253\u5f00\u6d4f\u89c8\u5668\u767b\u5f55\n\n" +
                "\u8bf7\u6ce8\u610f\uff1a\n" +
                "\u2022 OAuth \u767b\u5f55\u751f\u6210\u7684\u8bbf\u95ee\u4ee4\u724c\u4ec5\u4fdd\u5b58\u5728\u672c\u5730\uff0c\u4e0d\u4f1a\u4e0a\u4f20\u81f3\u4efb\u4f55\u7b2c\u4e09\u65b9\u670d\u52a1\u5668\n" +
                "\u2022 \u63d2\u4ef6\u76f4\u63a5\u8c03\u7528 AI \u670d\u52a1\u5546\u7684\u5b98\u65b9 API\n" +
                "\u2022 \u672c\u63d2\u4ef6\u501f\u52a9 CLI \u7684 OAuth \u4ee4\u724c\u8c03\u7528 API\uff0c\u6b64\u7528\u6cd5\u672a\u7ecf\u670d\u52a1\u5546\u660e\u786e\u6388\u6743\uff0c\u7406\u8bba\u4e0a\u5b58\u5728\u8d26\u53f7\u88ab\u9650\u5236\u7684\u53ef\u80fd\u6027\n" +
                "\u2022 \u4f7f\u7528 AI \u670d\u52a1\u53ef\u80fd\u4ea7\u751f\u8d39\u7528\uff0c\u5177\u4f53\u53d6\u51b3\u4e8e\u60a8\u7684\u8d26\u53f7\u8ba1\u8d39\u65b9\u5f0f\n" +
                "\u2022 \u672c\u63d2\u4ef6\u5b8c\u5168\u514d\u8d39\u4e14\u5f00\u6e90\uff0c\u4e0d\u6536\u96c6\u4efb\u4f55\u7528\u6237\u6570\u636e\n\n" +
                "\u662f\u5426\u7ee7\u7eed\uff1f"
              : "\u26a0\ufe0f OAuth Authorization Notice\n\n" +
                '"Install Environment" will perform the following:\n' +
                "1. Install Node.js runtime (if not already installed)\n" +
                "2. Install the CLI tool for this provider\n" +
                "3. Open your browser via OAuth to sign in\n\n" +
                "Please note:\n" +
                "\u2022 OAuth tokens are stored locally on your device only and are never sent to any third-party server\n" +
                "\u2022 The plugin communicates directly with the AI provider's official API\n" +
                "\u2022 This plugin uses OAuth tokens which is not an officially endorsed usage \u2014 there is a theoretical risk of account restrictions\n" +
                "\u2022 Using AI services may incur charges depending on your account billing plan\n" +
                "\u2022 This plugin is completely free, open-source, and does not collect any user data\n\n" +
                "Do you wish to continue?";
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

      refreshBtn.addEventListener("click", async () => {
        await refreshOneProvider(provider);
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
    for (const provider of PROVIDERS) {
      await refreshOneProvider(provider);
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

  oauthModeRadio.addEventListener("change", () => {
    if (oauthModeRadio.checked) handleModeChange("oauth");
  });
  customModeRadio.addEventListener("change", () => {
    if (customModeRadio.checked) handleModeChange("custom");
  });

  const persistCustomApiBase = () =>
    persistCustomPref(
      customApiBaseInput,
      "apiBase",
      normalizeCustomApiBaseInput,
    );
  const persistCustomApiKey = () =>
    persistCustomPref(customApiKeyInput, "apiKey", (value) => value.trim());
  const persistCustomModel = () =>
    persistCustomPref(customModelInput, "model", (value) => value.trim());

  customApiBaseInput.addEventListener("change", persistCustomApiBase);
  customApiBaseInput.addEventListener("blur", persistCustomApiBase);
  customApiKeyInput.addEventListener("change", persistCustomApiKey);
  customApiKeyInput.addEventListener("blur", persistCustomApiKey);
  customModelInput.addEventListener("change", persistCustomModel);
  customModelInput.addEventListener("blur", persistCustomModel);

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
      const models = await fetchCustomEndpointModels(apiBase, apiKey || undefined);
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
        const oldCheckState = new Map(lastFetchedModels.map(x => [x.id, x.checked]));
        lastFetchedModels = models.map(m => ({
          id: m.id,
          label: m.label || m.id,
          checked: oldCheckState.get(m.id) ?? false
        }));
        renderFetchedModels();
        fetchedModelsBox.style.display = "flex";
        
        customModelHint.textContent = L.fetchModelsDone.replace("{n}", String(models.length));
        customModelHint.style.color = "#065f46";
        if (!customModelInput.value.trim() && models.length > 0) {
          customModelInput.value = models[0].id;
          persistCustomModel();
        }
      } else {
        fetchedModelsBox.style.display = "none";
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

  renderStaticText();
  renderModels();
  await renderAccounts();
  persistSelectionState();

  const advancedGroup = createEl(doc, "div", "llm-set-card");

  const systemPromptWrap = createEl(doc, "div", "llm-set-field");
  const systemPromptLabel = createEl(doc, "label", "llm-set-label", L.systemPrompt);
  const systemPromptInput = createEl(doc, "textarea", "llm-set-input llm-set-textarea") as HTMLTextAreaElement;
  systemPromptInput.rows = 4;
  systemPromptInput.placeholder = "Custom instructions for the AI assistant...";
  const systemPromptHint = createEl(doc, "span", "llm-set-hint", L.systemPromptHint);
  systemPromptWrap.append(systemPromptLabel, systemPromptInput, systemPromptHint);
  advancedGroup.appendChild(systemPromptWrap);

  systemPromptInput.value = getPref("systemPrompt") || "";
  systemPromptInput.addEventListener("input", () =>
    setPref("systemPrompt", systemPromptInput.value),
  );
  const popupAddTextWrap = createEl(doc, "div", "llm-set-field");
  const popupAddTextLabel = createEl(doc, "label", "llm-set-radio-label");
  const popupInput = createEl(doc, "input") as HTMLInputElement;
  popupInput.type = "checkbox";
  const popupText = createEl(doc, "span", "", L.showAddText);
  popupAddTextLabel.append(popupInput, popupText);
  const popupHint = createEl(doc, "span", "llm-set-hint", L.showAddTextHint);
  popupAddTextWrap.append(popupAddTextLabel, popupHint);
  advancedGroup.appendChild(popupAddTextWrap);

  const prefValue = Zotero.Prefs.get(
    `${config.prefsPrefix}.showPopupAddText`,
    true,
  );
  popupInput.checked = prefValue !== false && String(prefValue).toLowerCase() !== "false";
  popupInput.addEventListener("change", () => {
    Zotero.Prefs.set(`${config.prefsPrefix}.showPopupAddText`, popupInput.checked, true);
  });
  // showAllModels feature is hidden from the UI but we must NOT force-write
  // the pref on every render — that would silently override any user/external value.
  const showAllModelsWrap = createEl(doc, "div");
  showAllModelsWrap.style.display = "none";
  const showAllModelsInput = createEl(doc, "input") as HTMLInputElement;
  showAllModelsInput.type = "checkbox";
  showAllModelsWrap.appendChild(showAllModelsInput);
  advancedGroup.appendChild(showAllModelsWrap);

  root.appendChild(advancedGroup);
}
