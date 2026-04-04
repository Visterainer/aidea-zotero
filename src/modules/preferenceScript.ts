import { config } from "../../package.json";
import { HTML_NS } from "../utils/domHelpers";
import {
  autoConfigureEnvironment,
  fetchAvailableModels,
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

function parseModelCache(): Partial<
  Record<OAuthProviderId, ProviderModelOption[]>
> {
  const raw = (getPref("oauthModelListCache") || "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<
      Record<OAuthProviderId, ProviderModelOption[]>
    >;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveModelCache(
  cache: Partial<Record<OAuthProviderId, ProviderModelOption[]>>,
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
  cache: Partial<Record<OAuthProviderId, ProviderModelOption[]>>,
  selectionCache: ProviderModelSelectionCache,
) {
  const flattened: Array<{ provider: OAuthProviderId; model: string }> = [];
  for (const provider of PROVIDERS) {
    const selected = new Set(
      reconcileProviderModelSelection(
        provider,
        cache[provider] || [],
        selectionCache,
      ).map(normalizeModelId),
    );
    for (const row of cache[provider] || []) {
      const id = String(row.id || "").trim();
      if (!id || !selected.has(normalizeModelId(id))) continue;
      flattened.push({ provider, model: id });
      if (flattened.length >= 4) break;
    }
    if (flattened.length >= 4) break;
  }

  PROFILE_KEYS.forEach((suffix, idx) => {
    const entry = flattened[idx];
    setPref(
      `apiBase${suffix}` as PrefKey,
      entry ? providerToMarker(entry.provider) : "",
    );
    setPref(`apiKey${suffix}` as PrefKey, "");
    setPref(`model${suffix}` as PrefKey, entry ? entry.model : "");
  });

  const first = flattened[0];
  if (getPrimaryConnectionMode() !== "custom") {
    setPref("apiBase", first ? providerToMarker(first.provider) : "");
    setPref("apiKey", "");
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

export async function registerPrefsScripts(_window: Window | undefined | null) {
  if (!_window) return;
  const win = _window;
  const doc = win.document;
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

  const modelSections = doc.querySelector(
    `#${config.addonRef}-model-sections`,
  ) as HTMLDivElement | null;
  if (!modelSections) return;
  modelSections.innerHTML = "";

  const root = createNode(
    doc,
    "div",
    "display:flex; flex-direction:column; gap:14px;",
  );
  modelSections.appendChild(root);

  const langBox = createNode(
    doc,
    "div",
    "border:1px solid #ddd; border-radius:8px; padding:12px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;",
  );
  const langLabel = createNode(
    doc,
    "label",
    "font-weight:700; font-size:13px;",
  );

  // Custom dropdown — native <select> shows a bullet on the selected <option> in Gecko
  const LANG_OPTIONS: { value: Lang; label: string }[] = [
    { value: "zh-CN", label: "CN" },
    { value: "en-US", label: "EN" },
  ];
  const dropdownWrap = createNode(
    doc,
    "div",
    "position:relative; display:inline-block;",
  );
  const dropdownBtn = createNode(
    doc,
    "button",
    "padding:6px 12px; border:1px solid #ccc; border-radius:6px; font-size:13px; font-weight:600; background:#fff; cursor:pointer; min-width:80px; display:flex; align-items:center; justify-content:space-between; gap:8px;",
  ) as HTMLButtonElement;
  dropdownBtn.type = "button";
  const dropdownBtnLabel = createNode(
    doc,
    "span",
    "",
    LANG_OPTIONS.find((o) => o.value === lang)?.label ?? lang,
  );
  const dropdownBtnArrow = createNode(
    doc,
    "span",
    "font-size:10px; color:#666;",
    "\u25be",
  );
  dropdownBtn.append(dropdownBtnLabel, dropdownBtnArrow);

  const dropdownList = createNode(
    doc,
    "div",
    "position:absolute; top:calc(100% + 2px); left:0; min-width:100%; border:1px solid #ccc; border-radius:6px; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,.12); z-index:9999; overflow:hidden; display:none;",
  );

  const dropdownItems = LANG_OPTIONS.map((opt) => {
    const item = createNode(
      doc,
      "div",
      "padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; background:#fff; color:#111; white-space:nowrap;",
      opt.label,
    );
    item.addEventListener("mouseenter", () => {
      item.style.background = "#f3f4f6";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = lang === opt.value ? "#eff6ff" : "#fff";
    });
    item.addEventListener("click", () => {
      switchLang(opt.value);
      dropdownBtnLabel.textContent = opt.label;
      dropdownList.style.display = "none";
      dropdownItems.forEach((i) => {
        i.style.background = "#fff";
      });
      item.style.background = "#eff6ff";
    });
    if (opt.value === lang) item.style.background = "#eff6ff";
    dropdownList.appendChild(item);
    return item;
  });

  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownList.style.display =
      dropdownList.style.display === "none" ? "block" : "none";
  });
  doc.addEventListener("click", () => {
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

  const envBox = createNode(
    doc,
    "div",
    "border:1px dashed #bbb; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;",
  );
  const envTitle = createNode(doc, "div", "font-weight:700; font-size:14px;");
  const envActionRow = createNode(
    doc,
    "div",
    "display:flex; gap:10px; align-items:center; flex-wrap:wrap;",
  );
  const commonBtnStyle =
    "padding:10px 16px; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; text-align:center; font-weight:600; line-height:1;";
  const refreshAllBtn = createNode(
    doc,
    "button",
    `${commonBtnStyle} border:1px solid #666; background:#fff; color:#111;`,
  ) as HTMLButtonElement;
  refreshAllBtn.type = "button";
  const restoreDefaultsBtn = createNode(
    doc,
    "button",
    `${commonBtnStyle} border:1px solid #d97706; background:#fff; color:#b45309;`,
  ) as HTMLButtonElement;
  restoreDefaultsBtn.type = "button";
  const clearAllHistoryBtn = createNode(
    doc,
    "button",
    `${commonBtnStyle} border:1px solid #dc2626; background:#fff; color:#b91c1c;`,
  ) as HTMLButtonElement;
  clearAllHistoryBtn.type = "button";
  const dangerStatus = createNode(
    doc,
    "span",
    "font-size:12px; color:#555; white-space:pre-wrap;",
  );
  envActionRow.append(
    refreshAllBtn,
    restoreDefaultsBtn,
    clearAllHistoryBtn,
    dangerStatus,
  );
  const progressText = createNode(
    doc,
    "span",
    "font-size:12px; color:#555; white-space:pre-wrap;",
  );
  const progressList = createNode(
    doc,
    "div",
    "border:1px solid #e5e7eb; border-radius:8px; padding:8px; max-height:140px; overflow:auto; background:#fafafa; font-size:12px; line-height:1.4;",
  );
  const logsBox = createNode(
    doc,
    "textarea",
    "width:100%; min-height:120px; padding:8px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:12px;",
  ) as HTMLTextAreaElement;
  logsBox.readOnly = true;
  logsBox.value = getPref("oauthSetupLog") || "";

  envBox.append(envTitle, envActionRow, progressText, progressList, logsBox);
  root.appendChild(envBox);

  const authCards = createNode(
    doc,
    "div",
    "display:flex; flex-direction:column; gap:12px;",
  );
  root.appendChild(authCards);

  const accountsBox = createNode(
    doc,
    "div",
    "border:1px solid #ddd; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;",
  );
  const accountsTitle = createNode(
    doc,
    "div",
    "font-weight:700; font-size:14px;",
  );
  const accountsTable = createNode(doc, "div", "font-size:12px;");
  accountsBox.append(accountsTitle, accountsTable);
  root.appendChild(accountsBox);

  const modelsBox = createNode(
    doc,
    "div",
    "border:1px solid #ddd; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;",
  );
  const modelsTitle = createNode(
    doc,
    "div",
    "font-weight:700; font-size:14px;",
  );
  const modelsTable = createNode(doc, "div", "font-size:12px;");
  const note = createNode(doc, "div", "font-size:12px; color:#555;");
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
    const header = createNode(
      doc,
      "div",
      "display:grid; grid-template-columns:2fr 1fr 2fr; gap:8px; font-weight:700; margin-bottom:6px;",
    );
    header.append(
      createNode(doc, "div", "", L.provider),
      createNode(doc, "div", "", L.account),
      createNode(doc, "div", "", L.status),
    );
    accountsTable.appendChild(header);
    for (const provider of PROVIDERS) {
      const s = await getProviderAccountSummary(provider);
      const row = createNode(
        doc,
        "div",
        "display:grid; grid-template-columns:2fr 1fr 2fr; gap:8px; padding:6px 0; border-top:1px solid #f0f0f0;",
      );
      row.append(
        createNode(doc, "div", "", s.label),
        createNode(doc, "div", "", s.account),
        createNode(doc, "div", "", s.status),
      );
      accountsTable.appendChild(row);
    }
  };

  const renderModels = () => {
    modelsTable.innerHTML = "";
    let count = 0;
    for (const provider of PROVIDERS) {
      const providerModels = cache[provider] || [];
      if (!providerModels.length) continue;
      count += providerModels.length;

      const selected = new Set(
        reconcileProviderModelSelection(
          provider,
          providerModels,
          selectionCache,
        ).map(normalizeModelId),
      );
      const selectedCount = providerModels.filter((row) =>
        selected.has(normalizeModelId(row.id)),
      ).length;

      const section = createNode(
        doc,
        "div",
        "border-top:1px solid #f0f0f0; padding:10px 0; display:flex; flex-direction:column; gap:8px;",
      );
      const header = createNode(
        doc,
        "div",
        "display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;",
      );
      const title = createNode(
        doc,
        "div",
        "font-weight:700; font-size:13px;",
        getProviderLabel(provider),
      );
      const summaryText =
        lang === "zh-CN"
          ? `已勾选 ${selectedCount}/${providerModels.length}`
          : `Selected ${selectedCount}/${providerModels.length}`;
      const summary = createNode(
        doc,
        "div",
        "font-size:12px; color:#6b7280;",
        summaryText,
      );
      header.append(title, summary);

      const actions = createNode(
        doc,
        "div",
        "display:flex; gap:6px; flex-wrap:wrap;",
      );
      const actionBtnStyle =
        "padding:4px 10px; border-radius:999px; border:1px solid #d1d5db; background:#fff; color:#111827; cursor:pointer; font-size:12px;";
      const defaultBtn = createNode(
        doc,
        "button",
        actionBtnStyle,
        lang === "zh-CN" ? "默认" : "Defaults",
      ) as HTMLButtonElement;
      defaultBtn.type = "button";
      defaultBtn.addEventListener("click", () => {
        setProviderSelection(
          provider,
          getDefaultSelectedModelIds(provider, providerModels),
        );
      });
      const allBtn = createNode(
        doc,
        "button",
        actionBtnStyle,
        lang === "zh-CN" ? "全选" : "Select All",
      ) as HTMLButtonElement;
      allBtn.type = "button";
      allBtn.addEventListener("click", () => {
        setProviderSelection(
          provider,
          providerModels.map((row) => row.id),
        );
      });
      const clearBtn = createNode(
        doc,
        "button",
        actionBtnStyle,
        lang === "zh-CN" ? "清空" : "Clear",
      ) as HTMLButtonElement;
      clearBtn.type = "button";
      clearBtn.addEventListener("click", () => {
        setProviderSelection(provider, []);
      });
      actions.append(defaultBtn, allBtn, clearBtn);
      section.append(header, actions);

      for (const row of providerModels) {
        const id = String(row.id || "").trim();
        if (!id) continue;
        const line = createNode(
          doc,
          "label",
          "display:flex; align-items:flex-start; gap:8px; padding:6px 8px; border:1px solid #f3f4f6; border-radius:8px; cursor:pointer;",
        );
        const checkbox = createNode(doc, "input") as HTMLInputElement;
        checkbox.type = "checkbox";
        checkbox.checked = selected.has(normalizeModelId(id));
        checkbox.style.marginTop = "2px";
        checkbox.addEventListener("change", () => {
          const nextSelected = new Set(
            reconcileProviderModelSelection(
              provider,
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
          setProviderSelection(provider, nextIds);
        });

        const textBox = createNode(
          doc,
          "div",
          "display:flex; flex-direction:column; gap:2px;",
        );
        textBox.append(
          createNode(doc, "div", "font-size:12px; color:#111827;", id),
        );
        if (row.label && row.label !== id) {
          textBox.append(
            createNode(doc, "div", "font-size:11px; color:#6b7280;", row.label),
          );
        }
        line.append(checkbox, textBox);
        section.appendChild(line);
      }

      modelsTable.appendChild(section);
    }
    if (!count) {
      modelsTable.appendChild(
        createNode(doc, "div", "padding:8px 0; color:#6b7280;", L.noModels),
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
    const card = createNode(
      doc,
      "div",
      "border:1px solid #ddd; border-radius:10px; padding:12px; display:flex; flex-direction:column; gap:8px;",
    );
    const title = createNode(
      doc,
      "div",
      "font-weight:700; font-size:13px;",
      getProviderLabel(provider),
    );
    const row = createNode(
      doc,
      "div",
      "display:flex; gap:8px; align-items:center; flex-wrap:wrap;",
    );
    const perProviderSetupBtn = createNode(
      doc,
      "button",
      `${commonBtnStyle} border:1px solid #059669; background:#059669; color:#fff;`,
    ) as HTMLButtonElement;
    perProviderSetupBtn.type = "button";
    const loginBtn = createNode(
      doc,
      "button",
      `${commonBtnStyle} border:1px solid #2563eb; background:#2563eb; color:#fff;`,
    ) as HTMLButtonElement;
    loginBtn.type = "button";
    const refreshBtn = createNode(
      doc,
      "button",
      `${commonBtnStyle} border:1px solid #666; background:#fff; color:#111;`,
    ) as HTMLButtonElement;
    refreshBtn.type = "button";
    const deleteBtn = createNode(
      doc,
      "button",
      `${commonBtnStyle} border:1px solid #dc2626; background:#fff; color:#b91c1c;`,
    ) as HTMLButtonElement;
    deleteBtn.type = "button";
    const status = createNode(
      doc,
      "span",
      "font-size:12px; color:#555; white-space:pre-wrap;",
    ) as HTMLSpanElement;
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

  renderStaticText();
  renderModels();
  await renderAccounts();
  persistSelectionState();

  const systemPromptInput = doc.querySelector(
    `#${config.addonRef}-system-prompt`,
  ) as HTMLTextAreaElement | null;
  if (systemPromptInput) {
    systemPromptInput.value = getPref("systemPrompt") || "";
    systemPromptInput.addEventListener("input", () =>
      setPref("systemPrompt", systemPromptInput.value),
    );
  }
  const popupInput = doc.querySelector(
    `#${config.addonRef}-popup-add-text-enabled`,
  ) as HTMLInputElement | null;
  if (popupInput) {
    const prefValue = Zotero.Prefs.get(
      `${config.prefsPrefix}.showPopupAddText`,
      true,
    );
    popupInput.checked =
      prefValue !== false && `${prefValue || ""}`.toLowerCase() !== "false";
    popupInput.addEventListener("change", () => {
      Zotero.Prefs.set(
        `${config.prefsPrefix}.showPopupAddText`,
        popupInput.checked,
        true,
      );
    });
  }
  const showAllModelsInput = doc.querySelector(
    `#${config.addonRef}-show-all-models`,
  ) as HTMLInputElement | null;
  if (showAllModelsInput) {
    const section = showAllModelsInput.closest("div");
    if (section) {
      section.setAttribute("style", "display:none;");
    }
    Zotero.Prefs.set(`${config.prefsPrefix}.showAllModels`, false, true);
  }
}
