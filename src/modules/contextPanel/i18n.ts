export type PanelLang = "zh-CN" | "en-US";

export type PanelI18n = {
  title: string;
  clear: string;
  history: string;
  export: string;
  undo: string;
  edit: string;
  delete: string;
  add: string;
  move: string;
  reset: string;
  copy: string;
  saveAsNote: string;
  copyChatMd: string;
  saveChatAsNote: string;
  send: string;
  cancel: string;
  statusNoContext: string;
  statusReady: string;
  statusSelectItem: string;
  placeholderGlobal: string;
  placeholderPaper: string;
  modelSelectHint: string;
  modelNoModels: string;
  modelClickChoose: string;
  modelOnlyOne: string;
  uploadFiles: string;
  selectReferences: string;
  conversationLoaded: string;
  noEditableLatestPrompt: string;
  referencePickerReady: string;
  paperAlreadySelected: string;
  paperContextAdded: (n: number, max: number) => string;
  cancelled: string;
  retry: string;
  addText: string;
  addTextPopupTitle: string;
  addTextTitle: string;
  screenshots: string;
  translate: string;
  summarize: string;
  keyPoints: string;
  methodology: string;
  limitations: string;
  deleteAll: string;
  chatHistory: string;
  deleteAllConfirm: string;
  noHistoryYet: string;
  newChat: string;
  pinConversation: string;
  unpinConversation: string;
  renameConversation: string;
  deleteUnpinned: string;
  deleteAllHistory: string;
  cancelAction: string;
  confirmDeleteTitle: string;
  tabDiscussion: string;
  tabSetting: string;
  tabTranslate: string;
  trFormatDisclaimer: string;
  trSectionBasic: string;
  trSectionEngine: string;
  trSectionExecute: string;
  trInputPath: string;
  trCurrentPdf: string;
  trSelectLocalPdf: string;
  trNoPdfFound: string;
  trSourceLang: string;
  trTargetLang: string;
  trOutputFormat: string;
  trOutputMono: string;
  trOutputDual: string;
  trSavePath: string;
  trBrowsePath: string;
  trStartTranslation: string;
  trPause: string;
  trResume: string;
  trClearCache: string;
  trInstallEnv: string;
  trEnvNotReady: string;
  trTranslating: string;
  trDone: string;
  trError: string;
  trIdle: string;
  trAdvanced: string;
  trQps: string;
  trPoolMaxWorker: string;
  trSkipReferencesAuto: string;
  trKeepAppendixTranslated: string;
  trProtectAuthorBlock: string;
  trDisableRichTextTranslate: string;
  trEnhanceCompatibility: string;
  trTranslateTableText: string;
  trOCR: string;
  trAutoOCR: string;
  trSaveGlossary: string;
  trDisableGlossary: string;
  trFontFamily: string;
  trFontFamilyAuto: string;
  trFontFamilySerif: string;
  trFontFamilySansSerif: string;
  // Tooltip hints
  trHintPoolMaxWorker: string;
  trHintSkipReferences: string;
  trHintKeepAppendix: string;
  trHintProtectAuthor: string;
  trHintDisableRichText: string;
  trHintEnhanceCompat: string;
  trHintTranslateTable: string;
  trHintOcr: string;
  trHintAutoOcr: string;
  trHintSaveGlossary: string;
  trHintDisableGlossary: string;
  trHintFontFamily: string;
  trHintQps: string;
  trFontFamilyScript: string;
};

declare const Zotero: any;

export function getPanelLang(): PanelLang {
  try {
    const pref = String(
      Zotero.Prefs.get("extensions.zotero.aidea.uiLanguage", true) || "",
    ).trim();
    if (pref === "en-US") return "en-US";
    if (pref === "zh-CN") return "zh-CN";
    // No explicit preference set — auto-detect from Zotero's own locale
    const locale = String((Zotero as any)?.locale || "");
    return /^zh/i.test(locale) ? "zh-CN" : "en-US";
  } catch {
    return "en-US";
  }
}

export function getPanelI18n(): PanelI18n {
  const lang = getPanelLang();
  if (lang === "en-US") {
    return {
      title: "AIdea",
      clear: "Clear",
      history: "History",
      export: "Export",
      undo: "Undo",
      edit: "Edit",
      delete: "Delete",
      add: "Add",
      move: "Move",
      reset: "Reset",
      copy: "Copy",
      saveAsNote: "Save as note",
      copyChatMd: "Copy chat as md",
      saveChatAsNote: "Save chat as note",
      send: "Send",
      cancel: "Cancel",
      statusNoContext: "No active paper context. Type @ to add papers.",
      statusReady: "Ready",
      statusSelectItem: "Select an item or open a PDF",
      placeholderGlobal: "Ask anything... Type @ to add papers",
      placeholderPaper: "Ask about this paper... Type @ for adding other papers as context",
      modelSelectHint: "Select model",
      modelNoModels: "No models available. Login and refresh in Settings.",
      modelClickChoose: "Click to choose a model",
      modelOnlyOne: "Only one model is configured",
      uploadFiles: "Upload files",
      selectReferences: "Select references",
      conversationLoaded: "Conversation loaded",
      noEditableLatestPrompt: "No editable latest prompt",
      referencePickerReady: "Reference picker ready. Type after @ to search papers.",
      paperAlreadySelected: "Paper already selected",
      paperContextAdded: (n, max) => `Paper context added (${n}/${max})`,
      cancelled: "Cancelled",
      retry: "Retry",
      addText: "Add Text",
      addTextPopupTitle: "Add selected text to LLM panel",
      addTextTitle: "Include selected reader text",
      screenshots: "Screenshots",
      translate: "Translate",
      summarize: "Summarize",
      keyPoints: "Key Points",
      methodology: "Methodology",
      limitations: "Limitations",
      deleteAll: "Delete all",
      chatHistory: "Chat History",
      deleteAllConfirm: "All conversations deleted",
      noHistoryYet: "No history yet",
      newChat: "New Chat",
      pinConversation: "Pin conversation",
      unpinConversation: "Unpin conversation",
      renameConversation: "Rename",
      deleteUnpinned: "Delete unpinned",
      deleteAllHistory: "Delete all",
      cancelAction: "Cancel",
      confirmDeleteTitle: "Delete conversations",
      tabDiscussion: "Discussion",
      tabSetting: "Setting",
      tabTranslate: "Translate",
      trFormatDisclaimer: "⚠ Due to the inherent complexity of PDF formatting, occasional layout or style mismatches may occur in translated output. This is being continuously improved — thank you for your understanding.",
      trSectionBasic: "Basic Config",
      trSectionEngine: "Translation Engine",
      trSectionExecute: "Execute",
      trInputPath: "Input Path",
      trCurrentPdf: "Current PDF",
      trSelectLocalPdf: "Select Local File",
      trNoPdfFound: "No PDF attachment found",
      trSourceLang: "Source",
      trTargetLang: "Target",
      trOutputFormat: "Output",
      trOutputMono: "Translation only",
      trOutputDual: "Bilingual",
      trSavePath: "Save Path",
      trBrowsePath: "Browse",
      trStartTranslation: "Translate",
      trPause: "Pause",
      trResume: "Resume",
      trClearCache: "Clear cache",
      trInstallEnv: "Install Environment",
      trEnvNotReady: "Translation environment not ready",
      trTranslating: "Translating...",
      trDone: "Translation complete",
      trError: "Translation failed",
      trIdle: "Ready to translate",
      trAdvanced: "Advanced",
      trQps: "QPS (queries/sec)",
      trPoolMaxWorker: "Parallel workers",
      trSkipReferencesAuto: "Auto-skip references (detect by heading/pattern)",
      trKeepAppendixTranslated: "Keep appendix translated",
      trProtectAuthorBlock: "Protect author/affiliation block",
      trDisableRichTextTranslate: "Disable rich-text translation",
      trEnhanceCompatibility: "Enhance compatibility",
      trTranslateTableText: "Translate table text",
      trOCR: "Force OCR workaround",
      trAutoOCR: "Auto OCR workaround",
      trSaveGlossary: "Save extracted glossary",
      trDisableGlossary: "Disable glossary extraction",
      trFontFamily: "Primary font family",
      trFontFamilyAuto: "Auto",
      trFontFamilySerif: "Serif",
      trFontFamilySansSerif: "Sans-serif",
      trFontFamilyScript: "Script",
      // Tooltip hints
      trHintPoolMaxWorker: "Number of paragraphs translated concurrently. Higher = faster but may hit API rate limits.",
      trHintSkipReferences: "Detect the References section by heading and skip translating those pages.",
      trHintKeepAppendix: "Continue translating appendices (Appendix A/B/C) after the References section.",
      trHintProtectAuthor: "Preserve author names, emails, and affiliations on the title page without translating.",
      trHintDisableRichText: "Disable bold/italic style preservation. Output plain text only — cleaner but loses formatting.",
      trHintEnhanceCompat: "Use conservative PDF rendering for broader reader compatibility. May slightly reduce layout quality.",
      trHintTranslateTable: "Translate text inside tables. Off by default because complex tables may break after translation.",
      trHintOcr: "Force OCR on all pages. Use for PDFs with broken text layers or embedded images.",
      trHintAutoOcr: "Automatically detect scanned PDFs and enable OCR when needed.",
      trHintSaveGlossary: "Auto-extract a terminology glossary (e.g. Transformer → 变换器) and save to the output folder.",
      trHintDisableGlossary: "Completely disable automatic terminology extraction. May reduce translation consistency.",
      trHintFontFamily: "Auto = engine selects best match; Serif = Song/Times; Sans-serif = Hei/Arial; Script = italic/cursive.",
      trHintQps: "API requests per second. Free APIs: 3-5; Paid APIs: 10-20. Too high may trigger rate limiting.",
    };
  }
  return {
    title: "AIdea",
    clear: "清空",
    history: "历史",
    export: "导出",
    undo: "撤销",
    edit: "编辑",
    delete: "删除",
    add: "新增",
    move: "移动",
    reset: "重置",
    copy: "复制",
    saveAsNote: "保存为笔记",
    copyChatMd: "复制对话 Markdown",
    saveChatAsNote: "将对话保存为笔记",
    send: "发送",
    cancel: "取消",
    statusNoContext: "当前无论文上下文，输入 @ 可添加论文。",
    statusReady: "就绪",
    statusSelectItem: "请选择条目或打开 PDF",
    placeholderGlobal: "开始提问... 输入 @ 添加论文",
    placeholderPaper: "对当前论文提问... 输入 @ 添加其他论文上下文",
    modelSelectHint: "选择模型",
    modelNoModels: "暂无模型，请在设置中登录 OAuth 并刷新模型列表。",
    modelClickChoose: "点击选择模型",
    modelOnlyOne: "当前仅配置了一个模型",
    uploadFiles: "上传文件",
    selectReferences: "选择参考论文",
    conversationLoaded: "对话已加载",
    noEditableLatestPrompt: "没有可编辑的最近一条提问",
    referencePickerReady: "引用选择器已就绪，输入 @ 后继续键入搜索论文。",
    paperAlreadySelected: "该论文已添加",
    paperContextAdded: (n, max) => `已添加论文上下文（${n}/${max}）`,
    cancelled: "已取消",
    retry: "重试",
    addText: "添加文本",
    addTextPopupTitle: "将选中文本添加到 LLM 面板",
    addTextTitle: "添加选中的阅读器文本",
    screenshots: "截图",
    translate: "翻译",
    summarize: "摘要",
    keyPoints: "关键要点",
    methodology: "研究方法",
    limitations: "局限性",
    deleteAll: "全部删除",
    chatHistory: "聊天记录",
    deleteAllConfirm: "已删除所有对话",
    noHistoryYet: "暂无历史记录",
    newChat: "新建对话",
    pinConversation: "置顶对话",
    unpinConversation: "取消置顶",
    renameConversation: "重命名",
    deleteUnpinned: "清理非置顶",
    deleteAllHistory: "全部清理",
    cancelAction: "取消",
    confirmDeleteTitle: "删除对话",
    tabDiscussion: "对话",
    tabSetting: "设置",
    tabTranslate: "全文翻译",
    trFormatDisclaimer: "⚠ 由于 PDF 格式本身的复杂性，翻译后的文档偶尔可能出现排版或样式不一致的情况，正在持续改进中，敬请谅解。",
    trSectionBasic: "基础配置",
    trSectionEngine: "翻译引擎",
    trSectionExecute: "执行",
    trInputPath: "输入路径",
    trCurrentPdf: "当前 PDF",
    trSelectLocalPdf: "选择本地文件",
    trNoPdfFound: "未找到 PDF 附件",
    trSourceLang: "源语言",
    trTargetLang: "目标语言",
    trOutputFormat: "输出格式",
    trOutputMono: "仅译文",
    trOutputDual: "双语对照",
    trSavePath: "保存路径",
    trBrowsePath: "浏览",
    trStartTranslation: "翻译",
    trPause: "暂停",
    trResume: "继续",
    trClearCache: "清除缓存",
    trInstallEnv: "安装环境",
    trEnvNotReady: "翻译环境未就绪",
    trTranslating: "翻译中...",
    trDone: "翻译完成",
    trError: "翻译失败",
    trIdle: "准备翻译",
    trAdvanced: "高级选项",
    trQps: "QPS（每秒请求数）",
    trPoolMaxWorker: "并行线程数",
    trSkipReferencesAuto: "自动识别并跳过参考文献",
    trKeepAppendixTranslated: "附录继续翻译",
    trProtectAuthorBlock: "保护作者/机构信息",
    trDisableRichTextTranslate: "禁用富文本翻译",
    trEnhanceCompatibility: "增强兼容性",
    trTranslateTableText: "翻译表格文本",
    trOCR: "强制 OCR 兼容模式",
    trAutoOCR: "自动 OCR 兼容模式",
    trSaveGlossary: "保存自动术语表",
    trDisableGlossary: "禁用术语自动提取",
    trFontFamily: "首选字体族",
    trFontFamilyAuto: "自动",
    trFontFamilySerif: "衬线体",
    trFontFamilySansSerif: "无衬线体",
    trFontFamilyScript: "手写体",
    // Tooltip hints
    trHintPoolMaxWorker: "同时翻译的段落数。值越大越快，但可能触发 API 限速。",
    trHintSkipReferences: "通过章节标题检测参考文献区域，跳过翻译。",
    trHintKeepAppendix: "参考文献后面的附录（Appendix A/B/C）继续翻译，不跳过。",
    trHintProtectAuthor: "保留首页作者姓名、邮箱、单位等信息不翻译。",
    trHintDisableRichText: "禁用粗体/斜体等格式保留，翻译结果为纯文本。排版更简洁但丢失样式。",
    trHintEnhanceCompat: "使用更保守的 PDF 渲染方式，兼容更多阅读器。可能略微降低排版质量。",
    trHintTranslateTable: "翻译表格中的文字。默认关闭，因为复杂表格翻译后容易错位。",
    trHintOcr: "强制对所有页面使用 OCR 提取文字。用于文字层损坏或嵌入图片的 PDF。",
    trHintAutoOcr: "自动检测是否为扫描件 PDF，如果是则自动启用 OCR。",
    trHintSaveGlossary: "翻译时自动提取专业术语对照表并保存，下次可复用。",
    trHintDisableGlossary: "完全关闭术语自动提取。可能降低翻译一致性。",
    trHintFontFamily: "自动=引擎智能匹配；衬线体=宋体/Times；无衬线体=黑体/Arial；手写体=斜体/书法。",
    trHintQps: "每秒 API 请求数。免费 API 建议 3-5，付费 API 可设 10-20。过高会触发限速。",
  };
}

/**
 * Refresh all translatable text in the Translate tab for the given document.
 * Called when the UI language is switched in Settings.
 */
export function refreshTranslateTabI18n(doc: Document): void {
  const i18n = getPanelI18n();

  // Helper: set text content by element ID
  const setText = (id: string, text: string) => {
    const el = doc.getElementById(id);
    if (el) el.textContent = text;
  };

  // Helper: update checkbox label text (preserves the <input> child)
  const setCheckboxText = (id: string, text: string) => {
    const label = doc.getElementById(id);
    if (!label) return;
    for (let i = label.childNodes.length - 1; i >= 0; i--) {
      if (label.childNodes[i].nodeType === 3 /* TEXT_NODE */) {
        label.childNodes[i].textContent = ` ${text}`;
        return;
      }
    }
  };

  // Helper: update stepper label text (first .llm-tr-stepper-label child)
  const setStepperLabel = (wrapperId: string, text: string) => {
    const wrapper = doc.getElementById(wrapperId)?.closest(".llm-tr-stepper");
    const lbl = wrapper?.querySelector(".llm-tr-stepper-label");
    if (lbl) lbl.textContent = text;
  };

  // Disclaimer
  setText("llm-tr-disclaimer", i18n.trFormatDisclaimer);

  // Section titles (collapsible toggles — textContent is safe, ::before is CSS)
  setText("llm-tr-sec-basic-toggle", i18n.trSectionBasic);
  setText("llm-tr-sec-engine-toggle", i18n.trSectionEngine);
  setText("llm-tr-sec-exec-toggle", i18n.trSectionExecute);

  // Field labels
  setText("llm-tr-input-path-label", i18n.trInputPath);
  setText("llm-tr-save-path-label", i18n.trSavePath);
  setText("llm-tr-model-label", i18n.modelSelectHint);
  setText("llm-tr-src-lang-label", i18n.trSourceLang);
  setText("llm-tr-tgt-lang-label", i18n.trTargetLang);
  setText("llm-tr-output-title", i18n.trOutputFormat);

  // Buttons
  setText("llm-tr-pick-file", i18n.trSelectLocalPdf);
  setText("llm-tr-browse-dir", i18n.trBrowsePath);
  setText("llm-tr-install-env", `⚙ ${i18n.trInstallEnv}`);
  setText("llm-tr-start", `▶ ${i18n.trStartTranslation}`);
  setText("llm-tr-pause", `⏸ ${i18n.trPause}`);
  setText("llm-tr-clear", `🗑 ${i18n.trClearCache}`);

  // Advanced toggle
  setText("llm-tr-advanced-toggle", i18n.trAdvanced);

  // Checkbox labels (output format)
  setCheckboxText("llm-tr-mono-label", i18n.trOutputMono);
  setCheckboxText("llm-tr-dual-label", i18n.trOutputDual);

  // Advanced checkboxes — query by input ID, update parent label text
  const advChecks: [string, string, string][] = [
    ["llm-tr-skip-refs-auto", i18n.trSkipReferencesAuto, i18n.trHintSkipReferences],
    ["llm-tr-keep-appendix", i18n.trKeepAppendixTranslated, i18n.trHintKeepAppendix],
    ["llm-tr-protect-author", i18n.trProtectAuthorBlock, i18n.trHintProtectAuthor],
    ["llm-tr-disable-rich-text", i18n.trDisableRichTextTranslate, i18n.trHintDisableRichText],
    ["llm-tr-enhance-compat", i18n.trEnhanceCompatibility, i18n.trHintEnhanceCompat],
    ["llm-tr-translate-table", i18n.trTranslateTableText, i18n.trHintTranslateTable],
    ["llm-tr-ocr", i18n.trOCR, i18n.trHintOcr],
    ["llm-tr-auto-ocr", i18n.trAutoOCR, i18n.trHintAutoOcr],
    ["llm-tr-save-glossary", i18n.trSaveGlossary, i18n.trHintSaveGlossary],
    ["llm-tr-disable-glossary", i18n.trDisableGlossary, i18n.trHintDisableGlossary],
  ];
  for (const [inputId, label, hint] of advChecks) {
    const input = doc.getElementById(inputId);
    const parent = input?.closest("label");
    if (parent) {
      if (hint) (parent as HTMLElement).title = hint;
      for (let i = parent.childNodes.length - 1; i >= 0; i--) {
        if (parent.childNodes[i].nodeType === 3) {
          parent.childNodes[i].textContent = ` ${label}`;
          break;
        }
      }
    }
  }

  // Steppers
  setStepperLabel("llm-tr-pool-max-worker", i18n.trPoolMaxWorker);
  setStepperLabel("llm-tr-qps", i18n.trQps);

  // Font family label
  setText("llm-tr-font-label", i18n.trFontFamily);

  // Tab buttons (Discussion / Translate / Setting)
  const tabBtns: [string, string][] = [
    ["llm-tab-btn-discussion", i18n.tabDiscussion],
    ["llm-tab-btn-translate", i18n.tabTranslate],
    ["llm-tab-btn-setting", i18n.tabSetting],
  ];
  for (const [id, text] of tabBtns) {
    doc.querySelectorAll(`#${id}`).forEach((el: Element) => {
      el.textContent = text;
    });
  }
}
