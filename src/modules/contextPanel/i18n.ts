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
};

declare const Zotero: any;

export function getPanelLang(): PanelLang {
  try {
    const pref = String(
      Zotero.Prefs.get("extensions.zotero.aidea.uiLanguage", true) || "",
    ).trim();
    if (pref === "en-US") return "en-US";
  } catch {
    // ignore
  }
  return "zh-CN";
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
  };
}
