import {
  DEFAULT_PANEL_LANG,
  detectPanelLangFromLocale,
  normalizeUiLanguageCode,
  type PanelLang,
} from "./languages";

export type { PanelLang };

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
  generateImage: string;
  generateImageActive: string;
  imagePromptPlaceholder: string;
  cancel: string;
  statusNoContext: string;
  statusReady: string;
  statusSelectItem: string;
  placeholderGlobal: string;
  placeholderPaper: string;
  emptyPromptStatus: string;
  placeholderGlobalTips: readonly string[];
  placeholderPaperTips: readonly string[];
  modelSelectHint: string;
  modelNoModels: string;
  modelClickChoose: string;
  modelOnlyOne: string;
  chatReadinessTitle: string;
  chatReadinessNoModels: string;
  chatReadinessSelectModel: string;
  chatReadinessCustomConfig: string;
  chatReadinessOpenSettings: string;
  uploadFiles: string;
  selectReferences: string;
  conversationLoaded: string;
  noEditableLatestPrompt: string;
  referencePickerReady: string;
  paperAlreadySelected: string;
  paperContextAdded: (n: number, max: number) => string;
  cancelled: string;
  retry: string;
  branchToNewChat: string;
  previousVariant: string;
  nextVariant: string;
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
  settingPanelLoading: string;
  swapLanguages: string;
  console: string;
  copyAll: string;
  openPdfFirst: string;
  scrollToBottom: string;
  requiredOutputFolder: string;
  expandFigures: string;
  collapseFigures: string;
  clearSelectedScreenshots: string;
  selectedScreenshotPreview: string;
  selectFigureScreenshot: string;
  expandFiles: string;
  collapseFiles: string;
  clearUploadedFiles: string;
  contextActions: string;
  newConversation: string;
  expandPapers: string;
  collapsePapers: string;
  supplementalPaper: string;
  figureBadgeIcon: string;
  paperBadgeIcon: string;
  fileBadgeIcon: string;
  figureCount: (count: number, max: number) => string;
  fileCount: (count: number) => string;
  paperCount: (count: number, max: number) => string;
  uploadedAttachments: (added: number, replaced: number) => string;
  uploadSkippedLargePdfs: (count: number) => string;
  uploadSkippedImages: (count: number) => string;
  uploadPersistFailed: (count: number) => string;
  pdfTextExtractionIncomplete: (count: number) => string;
  screenshotNth: (n: number) => string;
  openAttachment: (name: string) => string;
  fileFallback: string;
  usingCachedDocumentContext: string;
  rebuildingDocumentContext: string;
  waitForCurrentResponse: string;
  noRetryableResponseFound: string;
  nothingToRetryLatestTurn: string;
  preparingRetry: string;
  preparingRequest: string;
  generatingImage: string;
  noResponse: string;
  noAssistantTextSelected: string;
  copiedResponse: string;
  createdNewNote: string;
  failedToCreateNote: string;
  editingLatestPrompt: string;
  failedToSaveEditedPrompt: string;
  noChatHistoryDetected: string;
  copiedChatAsMd: string;
  savedChatHistoryToNewNote: string;
  pinFilesPanel: string;
  pinFiguresPanel: string;
  conversationRestored: string;
  noActiveLibraryForDeletion: string;
  cannotDeleteActiveConversation: string;
  conversationDeletedUndo: string;
  reusedExistingEmptyPaperChat: string;
  failedToCreateNewPaperConversation: string;
  startedNewPaperChat: string;
  noActiveLibraryForGlobalConversation: string;
  failedToCreateConversation: string;
  waitForResponseBeforeSwitching: string;
  selectRegion: string;
  selectionCancelled: string;
  screenshotFailed: string;
  copied: string;
  figuresCleared: string;
  filesCleared: string;
  paperContextDismissed: string;
  selectedTextRemoved: string;
  cleared: string;
  textContextLimit: string;
  clearSelectedContext: string;
  shortcutPromptEmpty: string;
  dragToReorder: string;
  currentPdfPage: (page: number) => string;
  selectionTranslateColdStart: string;
  selectionTranslateTranslating: string;
  selectionTranslateFailed: string;
  selectionTranslateNoContext: string;
  selectionTranslateWriteToAnnotation: string;
  selectionTranslateColdStartStatus: string;
  selectionTranslateCacheReady: string;
  addToNote: string;
  addingToNote: string;
  addedToNote: string;
  addToNoteFailed: string;
  screenshotSelectionInstruction: string;
  cancelEsc: string;
  pinTextContext: string;
  unpinTextContext: string;
  unpinNamedContext: (name: string) => string;
  expandPdfs: string;
  collapsePdfs: string;
  untitledChat: string;
  paperChat: string;
  standaloneChat: string;
  deletedConversation: (title: string) => string;
  renameConversationAria: (title: string) => string;
  pinConversationAria: (title: string) => string;
  unpinConversationAria: (title: string) => string;
  deleteConversation: string;
  deleteConversationAria: (title: string) => string;
  conversationNamePlaceholder: string;
  noPapersMatched: string;
  pdfCount: (count: number) => string;
  pdfAttachment: string;
  trLogFullPath: string;
  trLogOutputFormat: (mono: boolean, dual: boolean) => string;
  trLogResolvingCredentials: string;
  trLogCheckingEnvironment: string;
  trLogEnvironmentNotReady: (status: string) => string;
  trLogInstallEnvironmentInstruction: string;
  trLogBridgeError: (message: string) => string;
  trLogTotalTime: (duration: string) => string;
  trLogJobFinished: string;
  trLogEngineStarted: string;
  trLogPausedCached: string;
  trLogLaunchingEngine: string;
  trLogStackTrace: string;
  trLogError: (message: string) => string;
  trLogDetails: (details: string) => string;
  trLogEnvironmentSetupStarting: string;
  trLogEnvironmentSetupComplete: string;
  trLogResumed: string;
  trLogPaused: string;
  trLogPauseError: (message: string) => string;
  trLogCannotClearRunning: string;
  trLogCacheDetails: (removed: number, skipped: number) => string;
  trLogClearDone: string;
  trLogClearError: (message: string) => string;
  trLogJobStarted: string;
  trLogPdfLabel: string;
  trLogModelLabel: string;
  trLogLanguageLabel: string;
  trLogOutputLabel: string;
  trLogAdvancedOptions: (
    skipReferences: boolean,
    compatibility: boolean,
    forceOcr: boolean,
    autoOcr: boolean,
  ) => string;
  trLogFailedToResolveCredentials: (message: string) => string;
  trLogAuthLabel: string;
  trLogModelIdLabel: string;
  trLogApiBaseLabel: string;
  trLogEnvironmentReady: (venvDir: string) => string;
  trLogPythonLabel: string;
  trLogPdf2zhLabel: string;
  trLogPageProgress: (
    current: number | string,
    total: number | string,
    percent: number | string,
    elapsed: string,
  ) => string;
  trLogOutputFile: (file: string) => string;
  trLogCompletedWithErrors: (count: number) => string;
  trLogFullLog: (path: string) => string;
  trLogSeeDetailsAbove: string;
  trLogUnknownError: string;
  attachmentRemoved: (count: number) => string;
  operationFailed: (message: string) => string;
};

type PanelI18nReadinessKeys = Pick<
  PanelI18n,
  | "chatReadinessTitle"
  | "chatReadinessNoModels"
  | "chatReadinessSelectModel"
  | "chatReadinessCustomConfig"
  | "chatReadinessOpenSettings"
>;

type PanelI18nPlaceholderTips = Pick<
  PanelI18n,
  "placeholderGlobalTips" | "placeholderPaperTips"
>;

declare const Zotero: any;

export function getPanelLang(): PanelLang {
  try {
    const pref = String(
      Zotero.Prefs.get("extensions.zotero.aidea.uiLanguage", true) || "",
    ).trim();
    const saved = normalizeUiLanguageCode(pref);
    if (saved) return saved;
    // No explicit preference set — auto-detect from Zotero's own locale
    return detectPanelLangFromLocale(String((Zotero as any)?.locale || ""));
  } catch {
    return DEFAULT_PANEL_LANG;
  }
}

const PANEL_I18N_PLACEHOLDER_TIPS: Record<PanelLang, PanelI18nPlaceholderTips> =
  {
    "en-US": {
      placeholderGlobalTips: [
        "Ask a research question",
        "Paste text for AIdea to explain or summarize",
        "Compare two methods or concepts",
        "Ask for a reading plan on a topic",
      ],
      placeholderPaperTips: [
        "Summarize this paper's core contribution",
        "What are this paper's method limitations?",
        "Explain the key terms in this paper",
        "Turn this paper's method into steps",
      ],
    },
    "zh-CN": {
      placeholderGlobalTips: [
        "提出一个研究问题",
        "粘贴一段文字，让 AIdea 解释或总结",
        "比较两个方法或概念",
        "让 AIdea 帮你整理阅读思路",
      ],
      placeholderPaperTips: [
        "总结这篇论文的核心贡献",
        "这篇论文的方法有什么局限？",
        "解释这篇论文中的关键术语",
        "把这篇论文的研究方法整理成步骤",
      ],
    },
    "zh-TW": {
      placeholderGlobalTips: [
        "提出一個研究問題",
        "貼上一段文字，讓 AIdea 解釋或摘要",
        "比較兩個方法或概念",
        "讓 AIdea 幫你整理閱讀思路",
      ],
      placeholderPaperTips: [
        "摘要這篇論文的核心貢獻",
        "這篇論文的方法有什麼侷限？",
        "解釋這篇論文中的關鍵術語",
        "把這篇論文的研究方法整理成步驟",
      ],
    },
    "ja-JP": {
      placeholderGlobalTips: [
        "研究上の質問を入力",
        "文章を貼り付けて説明や要約を依頼",
        "2つの手法や概念を比較",
        "トピックの読み方を相談",
      ],
      placeholderPaperTips: [
        "この論文の核心的な貢献を要約",
        "この論文の手法の限界は？",
        "この論文の重要用語を説明",
        "この論文の手法を手順に整理",
      ],
    },
    "ko-KR": {
      placeholderGlobalTips: [
        "연구 질문을 입력하세요",
        "텍스트를 붙여넣어 설명이나 요약 요청",
        "두 방법이나 개념을 비교",
        "주제별 읽기 흐름을 정리",
      ],
      placeholderPaperTips: [
        "이 논문의 핵심 기여를 요약",
        "이 논문 방법의 한계는 무엇인가요?",
        "이 논문의 핵심 용어를 설명",
        "이 논문의 연구 방법을 단계로 정리",
      ],
    },
    "fr-FR": {
      placeholderGlobalTips: [
        "Posez une question de recherche",
        "Collez un texte à expliquer ou résumer",
        "Comparez deux méthodes ou concepts",
        "Demandez un plan de lecture sur un sujet",
      ],
      placeholderPaperTips: [
        "Résumez la contribution principale de cet article",
        "Quelles sont les limites de la méthode ?",
        "Expliquez les termes clés de cet article",
        "Transformez la méthode en étapes",
      ],
    },
    "de-DE": {
      placeholderGlobalTips: [
        "Stellen Sie eine Forschungsfrage",
        "Fügen Sie Text zum Erklären oder Zusammenfassen ein",
        "Vergleichen Sie zwei Methoden oder Konzepte",
        "Fragen Sie nach einem Leseplan zu einem Thema",
      ],
      placeholderPaperTips: [
        "Fassen Sie den Kernbeitrag dieses Papers zusammen",
        "Welche Grenzen hat die Methode dieses Papers?",
        "Erklären Sie die Schlüsselbegriffe dieses Papers",
        "Gliedern Sie die Methode dieses Papers in Schritte",
      ],
    },
    "es-ES": {
      placeholderGlobalTips: [
        "Plantea una pregunta de investigación",
        "Pega texto para explicarlo o resumirlo",
        "Compara dos métodos o conceptos",
        "Pide un plan de lectura sobre un tema",
      ],
      placeholderPaperTips: [
        "Resume la contribución principal de este artículo",
        "¿Qué limitaciones tiene el método?",
        "Explica los términos clave de este artículo",
        "Convierte el método en pasos",
      ],
    },
    "ru-RU": {
      placeholderGlobalTips: [
        "Задайте исследовательский вопрос",
        "Вставьте текст для объяснения или краткого вывода",
        "Сравните два метода или понятия",
        "Попросите план чтения по теме",
      ],
      placeholderPaperTips: [
        "Кратко изложите главный вклад этой статьи",
        "Какие ограничения есть у метода статьи?",
        "Объясните ключевые термины этой статьи",
        "Разбейте метод статьи на шаги",
      ],
    },
    "pt-BR": {
      placeholderGlobalTips: [
        "Faça uma pergunta de pesquisa",
        "Cole um texto para explicar ou resumir",
        "Compare dois métodos ou conceitos",
        "Peça um plano de leitura sobre um tema",
      ],
      placeholderPaperTips: [
        "Resuma a contribuição principal deste artigo",
        "Quais são as limitações do método?",
        "Explique os termos-chave deste artigo",
        "Organize o método deste artigo em etapas",
      ],
    },
    "ar-SA": {
      placeholderGlobalTips: [
        "اطرح سؤالًا بحثيًا",
        "الصق نصًا ليشرحه AIdea أو يلخصه",
        "قارن بين طريقتين أو مفهومين",
        "اطلب خطة قراءة حول موضوع",
      ],
      placeholderPaperTips: [
        "لخص المساهمة الأساسية لهذه الورقة",
        "ما حدود المنهج في هذه الورقة؟",
        "اشرح المصطلحات الأساسية في هذه الورقة",
        "حوّل منهج هذه الورقة إلى خطوات",
      ],
    },
    "hi-IN": {
      placeholderGlobalTips: [
        "एक शोध प्रश्न पूछें",
        "समझाने या सारांश के लिए पाठ चिपकाएं",
        "दो तरीकों या अवधारणाओं की तुलना करें",
        "किसी विषय के लिए पढ़ने की योजना पूछें",
      ],
      placeholderPaperTips: [
        "इस पेपर के मुख्य योगदान का सारांश दें",
        "इस पेपर की विधि की सीमाएं क्या हैं?",
        "इस पेपर के मुख्य शब्द समझाएं",
        "इस पेपर की विधि को चरणों में बदलें",
      ],
    },
  };

const PANEL_I18N_READINESS_OVERRIDES: Partial<
  Record<PanelLang, PanelI18nReadinessKeys>
> = {
  "zh-TW": {
    chatReadinessTitle: "AIdea 尚未準備好",
    chatReadinessNoModels:
      "目前沒有可用模型。請在 AIdea 設定中登入或重新整理模型清單。",
    chatReadinessSelectModel: "請先在 AIdea 設定中選擇模型，再開始對話。",
    chatReadinessCustomConfig:
      "請先在 AIdea 設定中補齊自訂 API Base URL 和模型，再開始對話。",
    chatReadinessOpenSettings: "開啟 AIdea 設定",
  },
  "ja-JP": {
    chatReadinessTitle: "AIdea はまだ準備できていません",
    chatReadinessNoModels:
      "利用可能なモデルがありません。AIdea 設定でログインするか、モデル一覧を更新してください。",
    chatReadinessSelectModel:
      "チャットを始める前に AIdea 設定でモデルを選択してください。",
    chatReadinessCustomConfig:
      "チャットを始める前に、AIdea 設定でカスタム API Base URL とモデルを入力してください。",
    chatReadinessOpenSettings: "AIdea 設定を開く",
  },
  "ko-KR": {
    chatReadinessTitle: "AIdea가 아직 준비되지 않았습니다",
    chatReadinessNoModels:
      "사용 가능한 모델이 없습니다. AIdea 설정에서 로그인하거나 모델 목록을 새로 고치세요.",
    chatReadinessSelectModel:
      "채팅을 시작하기 전에 AIdea 설정에서 모델을 선택하세요.",
    chatReadinessCustomConfig:
      "채팅을 시작하기 전에 AIdea 설정에서 사용자 지정 API Base URL과 모델을 입력하세요.",
    chatReadinessOpenSettings: "AIdea 설정 열기",
  },
  "fr-FR": {
    chatReadinessTitle: "AIdea n'est pas encore prêt",
    chatReadinessNoModels:
      "Aucun modèle disponible. Connectez-vous ou actualisez la liste des modèles dans les paramètres AIdea.",
    chatReadinessSelectModel:
      "Sélectionnez un modèle dans les paramètres AIdea avant de discuter.",
    chatReadinessCustomConfig:
      "Complétez l'API Base URL personnalisée et le modèle dans les paramètres AIdea avant de discuter.",
    chatReadinessOpenSettings: "Ouvrir les paramètres AIdea",
  },
  "de-DE": {
    chatReadinessTitle: "AIdea ist noch nicht bereit",
    chatReadinessNoModels:
      "Kein Modell verfügbar. Melden Sie sich in den AIdea-Einstellungen an oder aktualisieren Sie die Modellliste.",
    chatReadinessSelectModel:
      "Wählen Sie in den AIdea-Einstellungen ein Modell aus, bevor Sie den Chat starten.",
    chatReadinessCustomConfig:
      "Ergänzen Sie in den AIdea-Einstellungen die benutzerdefinierte API Base URL und das Modell, bevor Sie den Chat starten.",
    chatReadinessOpenSettings: "AIdea-Einstellungen öffnen",
  },
  "es-ES": {
    chatReadinessTitle: "AIdea aún no está listo",
    chatReadinessNoModels:
      "No hay modelos disponibles. Inicia sesión o actualiza la lista de modelos en la configuración de AIdea.",
    chatReadinessSelectModel:
      "Selecciona un modelo en la configuración de AIdea antes de iniciar el chat.",
    chatReadinessCustomConfig:
      "Completa la API Base URL personalizada y el modelo en la configuración de AIdea antes de iniciar el chat.",
    chatReadinessOpenSettings: "Abrir configuración de AIdea",
  },
  "ru-RU": {
    chatReadinessTitle: "AIdea ещё не готов",
    chatReadinessNoModels:
      "Нет доступных моделей. Войдите или обновите список моделей в настройках AIdea.",
    chatReadinessSelectModel:
      "Выберите модель в настройках AIdea, прежде чем начинать чат.",
    chatReadinessCustomConfig:
      "Укажите пользовательский API Base URL и модель в настройках AIdea, прежде чем начинать чат.",
    chatReadinessOpenSettings: "Открыть настройки AIdea",
  },
  "pt-BR": {
    chatReadinessTitle: "AIdea ainda não está pronto",
    chatReadinessNoModels:
      "Nenhum modelo disponível. Faça login ou atualize a lista de modelos nas configurações do AIdea.",
    chatReadinessSelectModel:
      "Selecione um modelo nas configurações do AIdea antes de iniciar o chat.",
    chatReadinessCustomConfig:
      "Preencha a API Base URL personalizada e o modelo nas configurações do AIdea antes de iniciar o chat.",
    chatReadinessOpenSettings: "Abrir configurações do AIdea",
  },
  "ar-SA": {
    chatReadinessTitle: "AIdea ليس جاهزًا بعد",
    chatReadinessNoModels:
      "لا توجد نماذج متاحة. افتح إعدادات AIdea لتسجيل الدخول أو تحديث قائمة النماذج.",
    chatReadinessSelectModel: "اختر نموذجًا في إعدادات AIdea قبل بدء المحادثة.",
    chatReadinessCustomConfig:
      "أكمل API Base URL المخصص والنموذج في إعدادات AIdea قبل بدء المحادثة.",
    chatReadinessOpenSettings: "فتح إعدادات AIdea",
  },
  "hi-IN": {
    chatReadinessTitle: "AIdea अभी तैयार नहीं है",
    chatReadinessNoModels:
      "कोई उपलब्ध मॉडल नहीं है। लॉग इन करने या मॉडल सूची रीफ़्रेश करने के लिए AIdea सेटिंग्स खोलें।",
    chatReadinessSelectModel:
      "चैट शुरू करने से पहले AIdea सेटिंग्स में मॉडल चुनें।",
    chatReadinessCustomConfig:
      "चैट शुरू करने से पहले AIdea सेटिंग्स में custom API Base URL और मॉडल पूरा करें।",
    chatReadinessOpenSettings: "AIdea सेटिंग्स खोलें",
  },
};

const PANEL_I18N_OVERRIDES: Partial<Record<PanelLang, Partial<PanelI18n>>> = {
  "zh-TW": {
    clear: "清空",
    history: "歷史",
    export: "匯出",
    undo: "復原",
    edit: "編輯",
    delete: "刪除",
    add: "新增",
    move: "移動",
    reset: "重設",
    copy: "複製",
    saveAsNote: "儲存為筆記",
    send: "傳送",
    cancel: "取消",
    statusReady: "就緒",
    statusSelectItem: "選取項目或開啟 PDF",
    placeholderGlobal: "詢問任何問題... 輸入 @ 加入論文",
    placeholderPaper: "詢問這篇論文... 輸入 @ 加入其他論文作為上下文",
    modelSelectHint: "選擇模型",
    modelNoModels: "沒有可用模型。請在設定中登入並重新整理。",
    uploadFiles: "上傳檔案",
    selectReferences: "選擇參考文獻",
    retry: "重試",
    addText: "加入文字",
    screenshots: "螢幕截圖",
    translate: "翻譯",
    summarize: "摘要",
    keyPoints: "重點",
    methodology: "方法",
    limitations: "限制",
    chatHistory: "聊天歷史",
    noHistoryYet: "尚無歷史",
    newChat: "新聊天",
    tabDiscussion: "討論",
    tabSetting: "設定",
    tabTranslate: "翻譯",
    trSectionBasic: "基本設定",
    trSectionEngine: "翻譯引擎",
    trSectionExecute: "執行",
    trInputPath: "輸入路徑",
    trCurrentPdf: "目前 PDF",
    trSelectLocalPdf: "選擇本機檔案",
    trNoPdfFound: "找不到 PDF 附件",
    trSourceLang: "來源語言",
    trTargetLang: "目標語言",
    trOutputFormat: "輸出",
    trOutputMono: "僅翻譯",
    trOutputDual: "雙語",
    trSavePath: "儲存路徑",
    trBrowsePath: "瀏覽",
    trStartTranslation: "翻譯",
    trPause: "暫停",
    trResume: "繼續",
    trClearCache: "清除快取",
    trInstallEnv: "安裝環境",
    trTranslating: "翻譯中...",
    trDone: "翻譯完成",
    trError: "翻譯失敗",
    trIdle: "準備翻譯",
    trAdvanced: "進階",
    settingPanelLoading: "設定面板載入中...",
    swapLanguages: "交換語言",
    console: "控制台",
    copyAll: "全部複製",
    openPdfFirst: "請先開啟 PDF",
  },
  "ja-JP": {
    clear: "クリア",
    history: "履歴",
    export: "エクスポート",
    undo: "元に戻す",
    edit: "編集",
    delete: "削除",
    add: "追加",
    move: "移動",
    reset: "リセット",
    copy: "コピー",
    saveAsNote: "ノートとして保存",
    send: "送信",
    cancel: "キャンセル",
    statusReady: "準備完了",
    statusSelectItem: "項目を選択するか PDF を開いてください",
    placeholderGlobal: "何でも質問... @ で論文を追加",
    placeholderPaper: "この論文について質問... @ で他の論文を追加",
    modelSelectHint: "モデルを選択",
    modelNoModels:
      "利用可能なモデルがありません。設定でログインして更新してください。",
    uploadFiles: "ファイルをアップロード",
    selectReferences: "参考文献を選択",
    retry: "再試行",
    addText: "テキストを追加",
    screenshots: "スクリーンショット",
    translate: "翻訳",
    summarize: "要約",
    keyPoints: "要点",
    methodology: "方法",
    limitations: "限界",
    chatHistory: "チャット履歴",
    noHistoryYet: "履歴はまだありません",
    newChat: "新しいチャット",
    tabDiscussion: "ディスカッション",
    tabSetting: "設定",
    tabTranslate: "翻訳",
    trSectionBasic: "基本設定",
    trSectionEngine: "翻訳エンジン",
    trSectionExecute: "実行",
    trInputPath: "入力パス",
    trCurrentPdf: "現在の PDF",
    trSelectLocalPdf: "ローカルファイルを選択",
    trNoPdfFound: "PDF 添付が見つかりません",
    trSourceLang: "元の言語",
    trTargetLang: "翻訳先",
    trOutputFormat: "出力",
    trOutputMono: "翻訳のみ",
    trOutputDual: "バイリンガル",
    trSavePath: "保存先",
    trBrowsePath: "参照",
    trStartTranslation: "翻訳",
    trPause: "一時停止",
    trResume: "再開",
    trClearCache: "キャッシュを消去",
    trInstallEnv: "環境をインストール",
    trTranslating: "翻訳中...",
    trDone: "翻訳完了",
    trError: "翻訳失敗",
    trIdle: "翻訳準備完了",
    trAdvanced: "詳細",
    settingPanelLoading: "設定パネルを読み込み中...",
    swapLanguages: "言語を入れ替え",
    console: "コンソール",
    copyAll: "すべてコピー",
    openPdfFirst: "先に PDF を開いてください",
  },
  "ko-KR": {
    clear: "지우기",
    history: "기록",
    export: "내보내기",
    undo: "실행 취소",
    edit: "편집",
    delete: "삭제",
    add: "추가",
    move: "이동",
    reset: "재설정",
    copy: "복사",
    saveAsNote: "노트로 저장",
    send: "보내기",
    cancel: "취소",
    statusReady: "준비됨",
    statusSelectItem: "항목을 선택하거나 PDF를 여세요",
    placeholderGlobal: "무엇이든 질문하세요... @로 논문 추가",
    placeholderPaper: "이 논문에 대해 질문하세요... @로 다른 논문 추가",
    modelSelectHint: "모델 선택",
    modelNoModels:
      "사용 가능한 모델이 없습니다. 설정에서 로그인하고 새로고침하세요.",
    uploadFiles: "파일 업로드",
    selectReferences: "참고문헌 선택",
    retry: "다시 시도",
    addText: "텍스트 추가",
    screenshots: "스크린샷",
    translate: "번역",
    summarize: "요약",
    keyPoints: "핵심 요점",
    methodology: "방법론",
    limitations: "한계",
    chatHistory: "채팅 기록",
    noHistoryYet: "기록 없음",
    newChat: "새 채팅",
    tabDiscussion: "토론",
    tabSetting: "설정",
    tabTranslate: "번역",
    trSectionBasic: "기본 설정",
    trSectionEngine: "번역 엔진",
    trSectionExecute: "실행",
    trInputPath: "입력 경로",
    trCurrentPdf: "현재 PDF",
    trSelectLocalPdf: "로컬 파일 선택",
    trNoPdfFound: "PDF 첨부를 찾을 수 없음",
    trSourceLang: "원본 언어",
    trTargetLang: "대상 언어",
    trOutputFormat: "출력",
    trOutputMono: "번역만",
    trOutputDual: "이중 언어",
    trSavePath: "저장 경로",
    trBrowsePath: "찾아보기",
    trStartTranslation: "번역",
    trPause: "일시 중지",
    trResume: "재개",
    trClearCache: "캐시 지우기",
    trInstallEnv: "환경 설치",
    trTranslating: "번역 중...",
    trDone: "번역 완료",
    trError: "번역 실패",
    trIdle: "번역 준비됨",
    trAdvanced: "고급",
    settingPanelLoading: "설정 패널 로딩 중...",
    swapLanguages: "언어 바꾸기",
    console: "콘솔",
    copyAll: "모두 복사",
    openPdfFirst: "먼저 PDF를 여세요",
  },
  "fr-FR": {
    clear: "Effacer",
    history: "Historique",
    export: "Exporter",
    undo: "Annuler",
    edit: "Modifier",
    delete: "Supprimer",
    add: "Ajouter",
    move: "Déplacer",
    reset: "Réinitialiser",
    copy: "Copier",
    saveAsNote: "Enregistrer comme note",
    send: "Envoyer",
    cancel: "Annuler",
    statusReady: "Prêt",
    statusSelectItem: "Sélectionnez un élément ou ouvrez un PDF",
    placeholderGlobal:
      "Posez une question... tapez @ pour ajouter des articles",
    placeholderPaper:
      "Questionnez cet article... tapez @ pour ajouter d'autres articles",
    modelSelectHint: "Choisir un modèle",
    modelNoModels:
      "Aucun modèle disponible. Connectez-vous et actualisez dans Paramètres.",
    uploadFiles: "Téléverser des fichiers",
    selectReferences: "Sélectionner les références",
    retry: "Réessayer",
    addText: "Ajouter du texte",
    screenshots: "Captures d'écran",
    translate: "Traduire",
    summarize: "Résumer",
    keyPoints: "Points clés",
    methodology: "Méthodologie",
    limitations: "Limites",
    chatHistory: "Historique du chat",
    noHistoryYet: "Aucun historique",
    newChat: "Nouveau chat",
    tabDiscussion: "Discussion",
    tabSetting: "Paramètres",
    tabTranslate: "Traduire",
    trSectionBasic: "Configuration de base",
    trSectionEngine: "Moteur de traduction",
    trSectionExecute: "Exécuter",
    trInputPath: "Chemin d'entrée",
    trCurrentPdf: "PDF actuel",
    trSelectLocalPdf: "Choisir un fichier local",
    trNoPdfFound: "Aucune pièce jointe PDF trouvée",
    trSourceLang: "Source",
    trTargetLang: "Cible",
    trOutputFormat: "Sortie",
    trOutputMono: "Traduction seule",
    trOutputDual: "Bilingue",
    trSavePath: "Chemin d'enregistrement",
    trBrowsePath: "Parcourir",
    trStartTranslation: "Traduire",
    trPause: "Pause",
    trResume: "Reprendre",
    trClearCache: "Vider le cache",
    trInstallEnv: "Installer l'environnement",
    trTranslating: "Traduction...",
    trDone: "Traduction terminée",
    trError: "Échec de la traduction",
    trIdle: "Prêt à traduire",
    trAdvanced: "Avancé",
    settingPanelLoading: "Chargement des paramètres...",
    swapLanguages: "Inverser les langues",
    console: "Console",
    copyAll: "Tout copier",
    openPdfFirst: "Ouvrez d'abord un PDF",
  },
  "de-DE": {
    clear: "Leeren",
    history: "Verlauf",
    export: "Exportieren",
    undo: "Rückgängig",
    edit: "Bearbeiten",
    delete: "Löschen",
    add: "Hinzufügen",
    move: "Verschieben",
    reset: "Zurücksetzen",
    copy: "Kopieren",
    saveAsNote: "Als Notiz speichern",
    send: "Senden",
    cancel: "Abbrechen",
    statusReady: "Bereit",
    statusSelectItem: "Element auswählen oder PDF öffnen",
    placeholderGlobal: "Alles fragen... @ eingeben, um Artikel hinzuzufügen",
    placeholderPaper: "Zu diesem Artikel fragen... @ für weitere Artikel",
    modelSelectHint: "Modell auswählen",
    modelNoModels:
      "Keine Modelle verfügbar. In den Einstellungen anmelden und aktualisieren.",
    uploadFiles: "Dateien hochladen",
    selectReferences: "Referenzen auswählen",
    retry: "Erneut versuchen",
    addText: "Text hinzufügen",
    screenshots: "Screenshots",
    translate: "Übersetzen",
    summarize: "Zusammenfassen",
    keyPoints: "Kernpunkte",
    methodology: "Methodik",
    limitations: "Einschränkungen",
    chatHistory: "Chatverlauf",
    noHistoryYet: "Noch kein Verlauf",
    newChat: "Neuer Chat",
    tabDiscussion: "Diskussion",
    tabSetting: "Einstellungen",
    tabTranslate: "Übersetzen",
    trSectionBasic: "Basiskonfiguration",
    trSectionEngine: "Übersetzungsengine",
    trSectionExecute: "Ausführen",
    trInputPath: "Eingabepfad",
    trCurrentPdf: "Aktuelles PDF",
    trSelectLocalPdf: "Lokale Datei wählen",
    trNoPdfFound: "Kein PDF-Anhang gefunden",
    trSourceLang: "Quelle",
    trTargetLang: "Ziel",
    trOutputFormat: "Ausgabe",
    trOutputMono: "Nur Übersetzung",
    trOutputDual: "Zweisprachig",
    trSavePath: "Speicherpfad",
    trBrowsePath: "Durchsuchen",
    trStartTranslation: "Übersetzen",
    trPause: "Pause",
    trResume: "Fortsetzen",
    trClearCache: "Cache leeren",
    trInstallEnv: "Umgebung installieren",
    trTranslating: "Übersetzung läuft...",
    trDone: "Übersetzung abgeschlossen",
    trError: "Übersetzung fehlgeschlagen",
    trIdle: "Bereit zum Übersetzen",
    trAdvanced: "Erweitert",
    settingPanelLoading: "Einstellungen werden geladen...",
    swapLanguages: "Sprachen tauschen",
    console: "Konsole",
    copyAll: "Alles kopieren",
    openPdfFirst: "Öffnen Sie zuerst ein PDF",
  },
  "es-ES": {
    clear: "Limpiar",
    history: "Historial",
    export: "Exportar",
    undo: "Deshacer",
    edit: "Editar",
    delete: "Eliminar",
    add: "Añadir",
    move: "Mover",
    reset: "Restablecer",
    copy: "Copiar",
    saveAsNote: "Guardar como nota",
    send: "Enviar",
    cancel: "Cancelar",
    statusReady: "Listo",
    statusSelectItem: "Selecciona un elemento o abre un PDF",
    placeholderGlobal:
      "Pregunta lo que quieras... escribe @ para añadir artículos",
    placeholderPaper:
      "Pregunta sobre este artículo... escribe @ para añadir otros",
    modelSelectHint: "Seleccionar modelo",
    modelNoModels:
      "No hay modelos disponibles. Inicia sesión y actualiza en Configuración.",
    uploadFiles: "Subir archivos",
    selectReferences: "Seleccionar referencias",
    retry: "Reintentar",
    addText: "Añadir texto",
    screenshots: "Capturas",
    translate: "Traducir",
    summarize: "Resumir",
    keyPoints: "Puntos clave",
    methodology: "Metodología",
    limitations: "Limitaciones",
    chatHistory: "Historial del chat",
    noHistoryYet: "Sin historial",
    newChat: "Nuevo chat",
    tabDiscussion: "Discusión",
    tabSetting: "Configuración",
    tabTranslate: "Traducir",
    trSectionBasic: "Configuración básica",
    trSectionEngine: "Motor de traducción",
    trSectionExecute: "Ejecutar",
    trInputPath: "Ruta de entrada",
    trCurrentPdf: "PDF actual",
    trSelectLocalPdf: "Seleccionar archivo local",
    trNoPdfFound: "No se encontró adjunto PDF",
    trSourceLang: "Origen",
    trTargetLang: "Destino",
    trOutputFormat: "Salida",
    trOutputMono: "Solo traducción",
    trOutputDual: "Bilingüe",
    trSavePath: "Ruta de guardado",
    trBrowsePath: "Examinar",
    trStartTranslation: "Traducir",
    trPause: "Pausar",
    trResume: "Reanudar",
    trClearCache: "Limpiar caché",
    trInstallEnv: "Instalar entorno",
    trTranslating: "Traduciendo...",
    trDone: "Traducción completa",
    trError: "Error de traducción",
    trIdle: "Listo para traducir",
    trAdvanced: "Avanzado",
    settingPanelLoading: "Cargando configuración...",
    swapLanguages: "Intercambiar idiomas",
    console: "Consola",
    copyAll: "Copiar todo",
    openPdfFirst: "Abre primero un PDF",
  },
  "ru-RU": {
    clear: "Очистить",
    history: "История",
    export: "Экспорт",
    undo: "Отменить",
    edit: "Редактировать",
    delete: "Удалить",
    add: "Добавить",
    move: "Переместить",
    reset: "Сбросить",
    copy: "Копировать",
    saveAsNote: "Сохранить как заметку",
    send: "Отправить",
    cancel: "Отмена",
    statusReady: "Готово",
    statusSelectItem: "Выберите элемент или откройте PDF",
    placeholderGlobal: "Задайте вопрос... введите @, чтобы добавить статьи",
    placeholderPaper: "Спросите об этой статье... введите @ для других статей",
    modelSelectHint: "Выбрать модель",
    modelNoModels: "Нет доступных моделей. Войдите и обновите в настройках.",
    uploadFiles: "Загрузить файлы",
    selectReferences: "Выбрать источники",
    retry: "Повторить",
    addText: "Добавить текст",
    screenshots: "Снимки экрана",
    translate: "Перевести",
    summarize: "Кратко",
    keyPoints: "Ключевые пункты",
    methodology: "Методология",
    limitations: "Ограничения",
    chatHistory: "История чата",
    noHistoryYet: "Истории пока нет",
    newChat: "Новый чат",
    tabDiscussion: "Обсуждение",
    tabSetting: "Настройки",
    tabTranslate: "Перевод",
    trSectionBasic: "Базовые настройки",
    trSectionEngine: "Движок перевода",
    trSectionExecute: "Выполнить",
    trInputPath: "Путь ввода",
    trCurrentPdf: "Текущий PDF",
    trSelectLocalPdf: "Выбрать локальный файл",
    trNoPdfFound: "PDF-вложение не найдено",
    trSourceLang: "Источник",
    trTargetLang: "Цель",
    trOutputFormat: "Вывод",
    trOutputMono: "Только перевод",
    trOutputDual: "Двуязычный",
    trSavePath: "Путь сохранения",
    trBrowsePath: "Обзор",
    trStartTranslation: "Перевести",
    trPause: "Пауза",
    trResume: "Продолжить",
    trClearCache: "Очистить кэш",
    trInstallEnv: "Установить среду",
    trTranslating: "Перевод...",
    trDone: "Перевод завершен",
    trError: "Ошибка перевода",
    trIdle: "Готово к переводу",
    trAdvanced: "Дополнительно",
    settingPanelLoading: "Загрузка настроек...",
    swapLanguages: "Поменять языки",
    console: "Консоль",
    copyAll: "Копировать все",
    openPdfFirst: "Сначала откройте PDF",
  },
  "pt-BR": {
    clear: "Limpar",
    history: "Histórico",
    export: "Exportar",
    undo: "Desfazer",
    edit: "Editar",
    delete: "Excluir",
    add: "Adicionar",
    move: "Mover",
    reset: "Redefinir",
    copy: "Copiar",
    saveAsNote: "Salvar como nota",
    send: "Enviar",
    cancel: "Cancelar",
    statusReady: "Pronto",
    statusSelectItem: "Selecione um item ou abra um PDF",
    placeholderGlobal:
      "Pergunte qualquer coisa... digite @ para adicionar artigos",
    placeholderPaper:
      "Pergunte sobre este artigo... digite @ para adicionar outros",
    modelSelectHint: "Selecionar modelo",
    modelNoModels:
      "Nenhum modelo disponível. Faça login e atualize em Configurações.",
    uploadFiles: "Enviar arquivos",
    selectReferences: "Selecionar referências",
    retry: "Tentar novamente",
    addText: "Adicionar texto",
    screenshots: "Capturas de tela",
    translate: "Traduzir",
    summarize: "Resumir",
    keyPoints: "Pontos-chave",
    methodology: "Metodologia",
    limitations: "Limitações",
    chatHistory: "Histórico do chat",
    noHistoryYet: "Sem histórico",
    newChat: "Novo chat",
    tabDiscussion: "Discussão",
    tabSetting: "Configurações",
    tabTranslate: "Traduzir",
    trSectionBasic: "Configuração básica",
    trSectionEngine: "Motor de tradução",
    trSectionExecute: "Executar",
    trInputPath: "Caminho de entrada",
    trCurrentPdf: "PDF atual",
    trSelectLocalPdf: "Selecionar arquivo local",
    trNoPdfFound: "Nenhum anexo PDF encontrado",
    trSourceLang: "Origem",
    trTargetLang: "Destino",
    trOutputFormat: "Saída",
    trOutputMono: "Somente tradução",
    trOutputDual: "Bilíngue",
    trSavePath: "Caminho para salvar",
    trBrowsePath: "Procurar",
    trStartTranslation: "Traduzir",
    trPause: "Pausar",
    trResume: "Retomar",
    trClearCache: "Limpar cache",
    trInstallEnv: "Instalar ambiente",
    trTranslating: "Traduzindo...",
    trDone: "Tradução concluída",
    trError: "Falha na tradução",
    trIdle: "Pronto para traduzir",
    trAdvanced: "Avançado",
    settingPanelLoading: "Carregando configurações...",
    swapLanguages: "Trocar idiomas",
    console: "Console",
    copyAll: "Copiar tudo",
    openPdfFirst: "Abra um PDF primeiro",
  },
  "ar-SA": {
    clear: "مسح",
    history: "السجل",
    export: "تصدير",
    undo: "تراجع",
    edit: "تحرير",
    delete: "حذف",
    add: "إضافة",
    move: "نقل",
    reset: "إعادة تعيين",
    copy: "نسخ",
    saveAsNote: "حفظ كملاحظة",
    send: "إرسال",
    cancel: "إلغاء",
    statusReady: "جاهز",
    statusSelectItem: "اختر عنصرًا أو افتح ملف PDF",
    placeholderGlobal: "اسأل أي شيء... اكتب @ لإضافة أوراق",
    placeholderPaper: "اسأل عن هذه الورقة... اكتب @ لإضافة أوراق أخرى",
    modelSelectHint: "اختر النموذج",
    modelNoModels: "لا توجد نماذج متاحة. سجّل الدخول وحدّث من الإعدادات.",
    uploadFiles: "رفع الملفات",
    selectReferences: "اختيار المراجع",
    retry: "إعادة المحاولة",
    addText: "إضافة نص",
    screenshots: "لقطات الشاشة",
    translate: "ترجمة",
    summarize: "تلخيص",
    keyPoints: "النقاط الرئيسية",
    methodology: "المنهجية",
    limitations: "القيود",
    chatHistory: "سجل المحادثة",
    noHistoryYet: "لا يوجد سجل بعد",
    newChat: "محادثة جديدة",
    tabDiscussion: "النقاش",
    tabSetting: "الإعدادات",
    tabTranslate: "الترجمة",
    trSectionBasic: "الإعداد الأساسي",
    trSectionEngine: "محرك الترجمة",
    trSectionExecute: "تنفيذ",
    trInputPath: "مسار الإدخال",
    trCurrentPdf: "ملف PDF الحالي",
    trSelectLocalPdf: "اختيار ملف محلي",
    trNoPdfFound: "لم يتم العثور على مرفق PDF",
    trSourceLang: "المصدر",
    trTargetLang: "الهدف",
    trOutputFormat: "الإخراج",
    trOutputMono: "الترجمة فقط",
    trOutputDual: "ثنائي اللغة",
    trSavePath: "مسار الحفظ",
    trBrowsePath: "استعراض",
    trStartTranslation: "ترجمة",
    trPause: "إيقاف مؤقت",
    trResume: "استئناف",
    trClearCache: "مسح التخزين المؤقت",
    trInstallEnv: "تثبيت البيئة",
    trTranslating: "جارٍ الترجمة...",
    trDone: "اكتملت الترجمة",
    trError: "فشلت الترجمة",
    trIdle: "جاهز للترجمة",
    trAdvanced: "متقدم",
    settingPanelLoading: "جارٍ تحميل الإعدادات...",
    swapLanguages: "تبديل اللغات",
    console: "وحدة التحكم",
    copyAll: "نسخ الكل",
    openPdfFirst: "افتح ملف PDF أولاً",
  },
  "hi-IN": {
    clear: "साफ़ करें",
    history: "इतिहास",
    export: "निर्यात",
    undo: "पूर्ववत",
    edit: "संपादित करें",
    delete: "हटाएँ",
    add: "जोड़ें",
    move: "स्थानांतरित करें",
    reset: "रीसेट",
    copy: "कॉपी",
    saveAsNote: "नोट के रूप में सहेजें",
    send: "भेजें",
    cancel: "रद्द करें",
    statusReady: "तैयार",
    statusSelectItem: "कोई आइटम चुनें या PDF खोलें",
    placeholderGlobal: "कुछ भी पूछें... पेपर जोड़ने के लिए @ लिखें",
    placeholderPaper:
      "इस पेपर के बारे में पूछें... अन्य पेपर जोड़ने के लिए @ लिखें",
    modelSelectHint: "मॉडल चुनें",
    modelNoModels: "कोई मॉडल उपलब्ध नहीं। सेटिंग्स में लॉगिन कर रीफ़्रेश करें।",
    uploadFiles: "फ़ाइलें अपलोड करें",
    selectReferences: "संदर्भ चुनें",
    retry: "फिर कोशिश करें",
    addText: "टेक्स्ट जोड़ें",
    screenshots: "स्क्रीनशॉट",
    translate: "अनुवाद",
    summarize: "सारांश",
    keyPoints: "मुख्य बिंदु",
    methodology: "कार्यप्रणाली",
    limitations: "सीमाएँ",
    chatHistory: "चैट इतिहास",
    noHistoryYet: "अभी कोई इतिहास नहीं",
    newChat: "नई चैट",
    tabDiscussion: "चर्चा",
    tabSetting: "सेटिंग्स",
    tabTranslate: "अनुवाद",
    trSectionBasic: "मूल कॉन्फ़िग",
    trSectionEngine: "अनुवाद इंजन",
    trSectionExecute: "चलाएँ",
    trInputPath: "इनपुट पथ",
    trCurrentPdf: "वर्तमान PDF",
    trSelectLocalPdf: "स्थानीय फ़ाइल चुनें",
    trNoPdfFound: "PDF अटैचमेंट नहीं मिला",
    trSourceLang: "स्रोत",
    trTargetLang: "लक्ष्य",
    trOutputFormat: "आउटपुट",
    trOutputMono: "केवल अनुवाद",
    trOutputDual: "द्विभाषी",
    trSavePath: "सहेजने का पथ",
    trBrowsePath: "ब्राउज़",
    trStartTranslation: "अनुवाद",
    trPause: "रोकें",
    trResume: "फिर शुरू करें",
    trClearCache: "कैश साफ़ करें",
    trInstallEnv: "वातावरण इंस्टॉल करें",
    trTranslating: "अनुवाद हो रहा है...",
    trDone: "अनुवाद पूर्ण",
    trError: "अनुवाद विफल",
    trIdle: "अनुवाद के लिए तैयार",
    trAdvanced: "उन्नत",
    settingPanelLoading: "सेटिंग पैनल लोड हो रहा है...",
    swapLanguages: "भाषाएँ बदलें",
    console: "कंसोल",
    copyAll: "सब कॉपी करें",
    openPdfFirst: "पहले PDF खोलें",
  },
};

const PANEL_I18N_EXTRA_OVERRIDES: Partial<
  Record<PanelLang, Partial<PanelI18n>>
> = {
  "zh-TW": {
    title: "AIdea",
    copyChatMd: "複製對話 Markdown",
    saveChatAsNote: "將對話儲存為筆記",
    statusNoContext: "目前沒有論文上下文，輸入 @ 可加入論文。",
    modelClickChoose: "點擊選擇模型",
    modelOnlyOne: "目前只設定了一個模型",
    conversationLoaded: "對話已載入",
    noEditableLatestPrompt: "沒有可編輯的最近提問",
    referencePickerReady: "引用選擇器已就緒，輸入 @ 後繼續搜尋論文。",
    paperAlreadySelected: "該論文已加入",
    paperContextAdded: (n, max) => `已加入論文上下文（${n}/${max}）`,
    cancelled: "已取消",
    addTextPopupTitle: "將選取文字加入 LLM 面板",
    addTextTitle: "加入選取的閱讀器文字",
    deleteAll: "全部刪除",
    deleteAllConfirm: "已刪除所有對話",
    pinConversation: "釘選對話",
    unpinConversation: "取消釘選",
    renameConversation: "重新命名",
    deleteUnpinned: "清理未釘選",
    deleteAllHistory: "全部清理",
    cancelAction: "取消",
    confirmDeleteTitle: "刪除對話",
    trFormatDisclaimer:
      "⚠ 由於 PDF 格式本身的複雜性，翻譯後的文件偶爾可能出現排版或樣式不一致的情況，我們正在持續改進，敬請理解。",
    trEnvNotReady: "翻譯環境尚未就緒",
    trQps: "QPS（每秒請求數）",
    trPoolMaxWorker: "並行工作數",
    trSkipReferencesAuto: "自動識別並跳過參考文獻",
    trKeepAppendixTranslated: "附錄繼續翻譯",
    trProtectAuthorBlock: "保護作者/機構資訊",
    trDisableRichTextTranslate: "停用富文字翻譯",
    trEnhanceCompatibility: "增強相容性",
    trTranslateTableText: "翻譯表格文字",
    trOCR: "強制 OCR 相容模式",
    trAutoOCR: "自動 OCR 相容模式",
    trSaveGlossary: "儲存自動術語表",
    trDisableGlossary: "停用術語自動擷取",
    trFontFamily: "首選字體族",
    trFontFamilyAuto: "自動",
    trFontFamilySerif: "襯線體",
    trFontFamilySansSerif: "無襯線體",
    trFontFamilyScript: "手寫體",
    trHintPoolMaxWorker:
      "同時翻譯的段落數。數值越大越快，但可能觸發 API 限速。",
    trHintSkipReferences: "透過章節標題偵測參考文獻區域並跳過翻譯。",
    trHintKeepAppendix: "參考文獻後的附錄仍繼續翻譯。",
    trHintProtectAuthor: "保留首頁作者姓名、信箱與機構資訊不翻譯。",
    trHintDisableRichText:
      "停用粗體/斜體等樣式保留，輸出為純文字。排版更簡潔但會失去樣式。",
    trHintEnhanceCompat:
      "使用較保守的 PDF 渲染方式以提升閱讀器相容性，可能略微降低排版品質。",
    trHintTranslateTable:
      "翻譯表格中的文字。預設關閉，因為複雜表格翻譯後容易錯位。",
    trHintOcr: "強制所有頁面使用 OCR。適用於文字層損壞或掃描型 PDF。",
    trHintAutoOcr: "自動偵測掃描型 PDF，必要時啟用 OCR。",
    trHintSaveGlossary: "翻譯時自動擷取術語表並儲存，方便下次重用。",
    trHintDisableGlossary: "完全關閉術語自動擷取，可能降低翻譯一致性。",
    trHintFontFamily:
      "自動=引擎智慧匹配；襯線體=宋體/Times；無襯線體=黑體/Arial；手寫體=斜體/書法。",
    trHintQps:
      "每秒 API 請求數。免費 API 建議 3-5，付費 API 可設 10-20。過高可能觸發限速。",
    scrollToBottom: "捲動到底部",
    requiredOutputFolder: "必填：請選擇輸出資料夾",
    expandFigures: "展開圖片",
    collapseFigures: "收起圖片",
    clearSelectedScreenshots: "清空已選截圖",
    selectedScreenshotPreview: "已選截圖預覽",
    selectFigureScreenshot: "選擇圖片截圖",
    expandFiles: "展開檔案",
    collapseFiles: "收起檔案",
    clearUploadedFiles: "清空上傳檔案",
    contextActions: "上下文操作",
    newConversation: "新建對話",
    expandPapers: "展開論文",
    collapsePapers: "收起論文",
    supplementalPaper: "補充論文",
    figureBadgeIcon: "圖",
    paperBadgeIcon: "文獻",
    fileBadgeIcon: "檔案",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `圖片（${count}/${max}）` : `圖片（${count}）`,
    fileCount: (count) => `檔案（${count}）`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `論文（${count}/${max}）` : `論文（${count}）`,
    screenshotNth: (n) => `截圖 ${n}`,
    openAttachment: (name) => `開啟 ${name}`,
    fileFallback: "檔案",
    usingCachedDocumentContext: "正在使用快取的文件上下文",
    rebuildingDocumentContext: "正在重建文件上下文...",
    waitForCurrentResponse: "請等待目前回覆完成",
    noRetryableResponseFound: "沒有可重試的回覆",
    nothingToRetryLatestTurn: "最近一輪沒有可重試內容",
    preparingRetry: "正在準備重試...",
    preparingRequest: "正在準備請求...",
    noResponse: "沒有回覆。",
    noAssistantTextSelected: "未選取助手文字",
    copiedResponse: "已複製回覆",
    createdNewNote: "已建立新筆記",
    failedToCreateNote: "建立筆記失敗",
    editingLatestPrompt: "正在編輯最近提問",
    noChatHistoryDetected: "未偵測到聊天記錄。",
    copiedChatAsMd: "已複製對話 Markdown",
    savedChatHistoryToNewNote: "已將聊天記錄儲存為新筆記",
    pinFilesPanel: "固定檔案面板",
    pinFiguresPanel: "固定圖片面板",
    conversationRestored: "對話已恢復",
    noActiveLibraryForDeletion: "沒有可刪除的活動文庫",
    cannotDeleteActiveConversation: "目前無法刪除正在使用的對話",
    conversationDeletedUndo: "對話已刪除，可復原。",
    reusedExistingEmptyPaperChat: "已重用現有空白論文對話",
    failedToCreateNewPaperConversation: "建立新論文對話失敗",
    startedNewPaperChat: "已開始新論文對話",
    noActiveLibraryForGlobalConversation: "沒有可用於全域對話的活動文庫",
    failedToCreateConversation: "建立對話失敗",
    waitForResponseBeforeSwitching: "請等待回覆完成後再切換",
    selectRegion: "請選擇區域...",
    selectionCancelled: "已取消選擇",
    screenshotFailed: "截圖失敗",
    copied: "已複製",
    figuresCleared: "圖片已清空",
    filesCleared: "檔案已清空",
    paperContextDismissed: "論文上下文已移除",
    selectedTextRemoved: "已移除選取文字",
    cleared: "已清空",
    textContextLimit: "文字上下文最多 5 條",
    clearSelectedContext: "清空已選上下文",
    shortcutPromptEmpty: "快捷指令提示詞不可為空",
    dragToReorder: "拖曳以排序",
    trLogFullPath: "完整路徑",
    trLogOutputFormat: (mono, dual) => `輸出格式：單語=${mono} | 雙語=${dual}`,
    trLogResolvingCredentials: "正在解析模型憑證...",
    trLogCheckingEnvironment: "正在檢查翻譯環境...",
    trLogEnvironmentNotReady: (status) => `環境尚未就緒（狀態：${status}）`,
    trLogInstallEnvironmentInstruction:
      "請點擊「安裝環境」按鈕設定 Python 環境",
    trLogBridgeError: (message) => `橋接錯誤：${message}`,
    trLogTotalTime: (duration) => `總耗時：${duration}`,
    trLogJobFinished: "任務完成",
    trLogEngineStarted: "翻譯引擎已啟動...",
    trLogPausedCached: "翻譯已暫停，進度已快取",
    trLogLaunchingEngine: "正在啟動翻譯引擎...",
    trLogStackTrace: "堆疊追蹤",
  },
  "ja-JP": {
    title: "AIdea",
    copyChatMd: "チャットを Markdown としてコピー",
    saveChatAsNote: "チャットをノートとして保存",
    statusNoContext:
      "有効な論文コンテキストがありません。@ で論文を追加できます。",
    modelClickChoose: "クリックしてモデルを選択",
    modelOnlyOne: "設定済みのモデルは 1 つだけです",
    conversationLoaded: "会話を読み込みました",
    noEditableLatestPrompt: "編集できる最新の質問がありません",
    referencePickerReady:
      "文献ピッカーの準備ができました。@ の後に入力して検索してください。",
    paperAlreadySelected: "この論文はすでに追加されています",
    paperContextAdded: (n, max) =>
      `論文コンテキストを追加しました（${n}/${max}）`,
    cancelled: "キャンセルしました",
    addTextPopupTitle: "選択したテキストを LLM パネルに追加",
    addTextTitle: "リーダーで選択したテキストを追加",
    deleteAll: "すべて削除",
    deleteAllConfirm: "すべての会話を削除しました",
    pinConversation: "会話をピン留め",
    unpinConversation: "ピン留めを解除",
    renameConversation: "名前を変更",
    deleteUnpinned: "ピン留め以外を削除",
    deleteAllHistory: "すべて削除",
    cancelAction: "キャンセル",
    confirmDeleteTitle: "会話を削除",
    trFormatDisclaimer:
      "⚠ PDF 形式は複雑なため、翻訳後の文書でレイアウトやスタイルが一部ずれる場合があります。継続的に改善しています。",
    trEnvNotReady: "翻訳環境の準備ができていません",
    trQps: "QPS（秒あたりのリクエスト数）",
    trPoolMaxWorker: "並列ワーカー数",
    trSkipReferencesAuto: "参考文献を自動検出してスキップ",
    trKeepAppendixTranslated: "付録を翻訳し続ける",
    trProtectAuthorBlock: "著者/所属情報を保護",
    trDisableRichTextTranslate: "リッチテキスト翻訳を無効化",
    trEnhanceCompatibility: "互換性を強化",
    trTranslateTableText: "表内テキストを翻訳",
    trOCR: "OCR 互換モードを強制",
    trAutoOCR: "OCR 互換モードを自動適用",
    trSaveGlossary: "自動用語集を保存",
    trDisableGlossary: "用語の自動抽出を無効化",
    trFontFamily: "優先フォントファミリー",
    trFontFamilyAuto: "自動",
    trFontFamilySerif: "セリフ",
    trFontFamilySansSerif: "サンセリフ",
    trFontFamilyScript: "スクリプト",
    trHintPoolMaxWorker:
      "同時に翻訳する段落数。大きいほど速くなりますが、API 制限にかかる可能性があります。",
    trHintSkipReferences:
      "見出しで参考文献セクションを検出し、そのページを翻訳しません。",
    trHintKeepAppendix: "参考文献の後にある付録も翻訳します。",
    trHintProtectAuthor:
      "タイトルページの著者名、メール、所属を翻訳せず保持します。",
    trHintDisableRichText:
      "太字や斜体の保持を無効化し、プレーンテキストで出力します。",
    trHintEnhanceCompat:
      "より保守的な PDF レンダリングで互換性を高めます。レイアウト品質が少し下がる場合があります。",
    trHintTranslateTable:
      "表内テキストを翻訳します。複雑な表ではずれる可能性があります。",
    trHintOcr:
      "すべてのページで OCR を強制します。文字層が壊れた PDF に有効です。",
    trHintAutoOcr:
      "スキャン PDF を自動検出し、必要に応じて OCR を有効化します。",
    trHintSaveGlossary: "翻訳時に用語集を自動抽出して保存します。",
    trHintDisableGlossary:
      "用語の自動抽出を完全に無効化します。一貫性が下がる場合があります。",
    trHintFontFamily:
      "自動=エンジンが最適選択；セリフ=Song/Times；サンセリフ=Hei/Arial；スクリプト=斜体/筆記体。",
    trHintQps:
      "API リクエスト数/秒。無料 API は 3-5、有料 API は 10-20 が目安です。",
    scrollToBottom: "一番下へスクロール",
    requiredOutputFolder: "必須：出力フォルダーを選択",
    expandFigures: "図を展開",
    collapseFigures: "図を折りたたむ",
    clearSelectedScreenshots: "選択したスクリーンショットをクリア",
    selectedScreenshotPreview: "選択したスクリーンショットのプレビュー",
    selectFigureScreenshot: "図のスクリーンショットを選択",
    expandFiles: "ファイルを展開",
    collapseFiles: "ファイルを折りたたむ",
    clearUploadedFiles: "アップロード済みファイルをクリア",
    contextActions: "コンテキスト操作",
    newConversation: "新しい会話",
    expandPapers: "論文を展開",
    collapsePapers: "論文を折りたたむ",
    supplementalPaper: "補足論文",
    figureBadgeIcon: "図",
    paperBadgeIcon: "文献",
    fileBadgeIcon: "ファイル",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `図（${count}/${max}）` : `図（${count}）`,
    fileCount: (count) => `ファイル（${count}）`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `論文（${count}/${max}）` : `論文（${count}）`,
    screenshotNth: (n) => `スクリーンショット ${n}`,
    openAttachment: (name) => `${name} を開く`,
    fileFallback: "ファイル",
    usingCachedDocumentContext: "キャッシュ済み文書コンテキストを使用中",
    rebuildingDocumentContext: "文書コンテキストを再構築中...",
    waitForCurrentResponse: "現在の応答が完了するまでお待ちください",
    noRetryableResponseFound: "再試行できる応答がありません",
    nothingToRetryLatestTurn: "最新ターンに再試行できる内容がありません",
    preparingRetry: "再試行を準備中...",
    preparingRequest: "リクエストを準備中...",
    noResponse: "応答がありません。",
    noAssistantTextSelected: "アシスタントのテキストが選択されていません",
    copiedResponse: "応答をコピーしました",
    createdNewNote: "新しいノートを作成しました",
    failedToCreateNote: "ノートの作成に失敗しました",
    editingLatestPrompt: "最新の質問を編集中",
    noChatHistoryDetected: "チャット履歴が見つかりません。",
    copiedChatAsMd: "チャットを Markdown としてコピーしました",
    savedChatHistoryToNewNote: "チャット履歴を新しいノートに保存しました",
    pinFilesPanel: "ファイルパネルを固定",
    pinFiguresPanel: "図パネルを固定",
    conversationRestored: "会話を復元しました",
    noActiveLibraryForDeletion: "削除対象のアクティブライブラリがありません",
    cannotDeleteActiveConversation: "現在の会話は今削除できません",
    conversationDeletedUndo: "会話を削除しました。元に戻せます。",
    reusedExistingEmptyPaperChat: "既存の空の論文チャットを再利用しました",
    failedToCreateNewPaperConversation: "新しい論文会話の作成に失敗しました",
    startedNewPaperChat: "新しい論文チャットを開始しました",
    noActiveLibraryForGlobalConversation:
      "グローバル会話用のアクティブライブラリがありません",
    failedToCreateConversation: "会話の作成に失敗しました",
    waitForResponseBeforeSwitching: "切り替える前に応答の完了を待ってください",
    selectRegion: "範囲を選択...",
    selectionCancelled: "選択をキャンセルしました",
    screenshotFailed: "スクリーンショットに失敗しました",
    copied: "コピーしました",
    figuresCleared: "図をクリアしました",
    filesCleared: "ファイルをクリアしました",
    paperContextDismissed: "論文コンテキストを削除しました",
    selectedTextRemoved: "選択テキストを削除しました",
    cleared: "クリアしました",
    textContextLimit: "テキストコンテキストは最大 5 件です",
    clearSelectedContext: "選択したコンテキストをクリア",
    shortcutPromptEmpty: "ショートカットプロンプトは空にできません",
    dragToReorder: "ドラッグして並べ替え",
    trLogFullPath: "フルパス",
    trLogOutputFormat: (mono, dual) =>
      `出力形式：単一=${mono} | 二言語=${dual}`,
    trLogResolvingCredentials: "モデル認証情報を解決中...",
    trLogCheckingEnvironment: "翻訳環境を確認中...",
    trLogEnvironmentNotReady: (status) =>
      `環境の準備ができていません（状態：${status}）`,
    trLogInstallEnvironmentInstruction:
      "Python 環境を設定するには「環境をインストール」をクリックしてください",
    trLogBridgeError: (message) => `ブリッジエラー：${message}`,
    trLogTotalTime: (duration) => `合計時間：${duration}`,
    trLogJobFinished: "ジョブ完了",
    trLogEngineStarted: "翻訳エンジンを開始しました...",
    trLogPausedCached: "翻訳を一時停止しました。進行状況は保存されました",
    trLogLaunchingEngine: "翻訳エンジンを起動中...",
    trLogStackTrace: "スタックトレース",
  },
  "ko-KR": {
    title: "AIdea",
    copyChatMd: "채팅을 Markdown으로 복사",
    saveChatAsNote: "채팅을 노트로 저장",
    statusNoContext:
      "활성 논문 컨텍스트가 없습니다. @를 입력해 논문을 추가하세요.",
    modelClickChoose: "클릭하여 모델 선택",
    modelOnlyOne: "설정된 모델이 하나뿐입니다",
    conversationLoaded: "대화를 불러왔습니다",
    noEditableLatestPrompt: "편집할 최신 질문이 없습니다",
    referencePickerReady:
      "참고문헌 선택기가 준비되었습니다. @ 뒤에 입력해 논문을 검색하세요.",
    paperAlreadySelected: "이미 추가된 논문입니다",
    paperContextAdded: (n, max) =>
      `논문 컨텍스트가 추가되었습니다 (${n}/${max})`,
    cancelled: "취소됨",
    addTextPopupTitle: "선택한 텍스트를 LLM 패널에 추가",
    addTextTitle: "리더에서 선택한 텍스트 포함",
    deleteAll: "모두 삭제",
    deleteAllConfirm: "모든 대화가 삭제되었습니다",
    pinConversation: "대화 고정",
    unpinConversation: "고정 해제",
    renameConversation: "이름 변경",
    deleteUnpinned: "고정되지 않은 항목 삭제",
    deleteAllHistory: "모두 삭제",
    cancelAction: "취소",
    confirmDeleteTitle: "대화 삭제",
    trFormatDisclaimer:
      "⚠ PDF 형식의 복잡성 때문에 번역 결과에서 레이아웃이나 스타일 차이가 발생할 수 있습니다. 계속 개선 중입니다.",
    trEnvNotReady: "번역 환경이 준비되지 않았습니다",
    trQps: "QPS(초당 요청 수)",
    trPoolMaxWorker: "병렬 작업 수",
    trSkipReferencesAuto: "참고문헌 자동 감지 후 건너뛰기",
    trKeepAppendixTranslated: "부록 계속 번역",
    trProtectAuthorBlock: "저자/소속 정보 보호",
    trDisableRichTextTranslate: "리치 텍스트 번역 비활성화",
    trEnhanceCompatibility: "호환성 향상",
    trTranslateTableText: "표 텍스트 번역",
    trOCR: "OCR 호환 모드 강제",
    trAutoOCR: "OCR 호환 모드 자동 적용",
    trSaveGlossary: "자동 용어집 저장",
    trDisableGlossary: "용어 자동 추출 비활성화",
    trFontFamily: "기본 글꼴군",
    trFontFamilyAuto: "자동",
    trFontFamilySerif: "세리프",
    trFontFamilySansSerif: "산세리프",
    trFontFamilyScript: "스크립트",
    trHintPoolMaxWorker:
      "동시에 번역할 문단 수입니다. 높을수록 빠르지만 API 제한에 걸릴 수 있습니다.",
    trHintSkipReferences:
      "제목으로 참고문헌 섹션을 감지하고 해당 페이지 번역을 건너뜁니다.",
    trHintKeepAppendix: "참고문헌 뒤의 부록도 계속 번역합니다.",
    trHintProtectAuthor:
      "제목 페이지의 저자명, 이메일, 소속을 번역하지 않고 보존합니다.",
    trHintDisableRichText:
      "굵게/기울임 같은 스타일 보존을 끕니다. 더 깔끔하지만 서식은 사라집니다.",
    trHintEnhanceCompat:
      "더 보수적인 PDF 렌더링을 사용해 호환성을 높입니다. 배치 품질이 조금 낮아질 수 있습니다.",
    trHintTranslateTable:
      "표 안의 텍스트를 번역합니다. 복잡한 표는 깨질 수 있습니다.",
    trHintOcr:
      "모든 페이지에 OCR을 강제합니다. 텍스트 레이어가 손상된 PDF에 사용하세요.",
    trHintAutoOcr: "스캔 PDF를 자동 감지하고 필요 시 OCR을 켭니다.",
    trHintSaveGlossary: "번역 중 용어집을 자동 추출해 저장합니다.",
    trHintDisableGlossary:
      "용어 자동 추출을 완전히 끕니다. 번역 일관성이 낮아질 수 있습니다.",
    trHintFontFamily:
      "자동=엔진이 최적 선택; 세리프=Song/Times; 산세리프=Hei/Arial; 스크립트=필기/기울임.",
    trHintQps:
      "초당 API 요청 수입니다. 무료 API는 3-5, 유료 API는 10-20을 권장합니다.",
    scrollToBottom: "맨 아래로 스크롤",
    requiredOutputFolder: "필수: 출력 폴더를 선택하세요",
    expandFigures: "그림 펼치기",
    collapseFigures: "그림 접기",
    clearSelectedScreenshots: "선택한 스크린샷 지우기",
    selectedScreenshotPreview: "선택한 스크린샷 미리보기",
    selectFigureScreenshot: "그림 스크린샷 선택",
    expandFiles: "파일 펼치기",
    collapseFiles: "파일 접기",
    clearUploadedFiles: "업로드한 파일 지우기",
    contextActions: "컨텍스트 작업",
    newConversation: "새 대화",
    expandPapers: "논문 펼치기",
    collapsePapers: "논문 접기",
    supplementalPaper: "보조 논문",
    figureBadgeIcon: "그림",
    paperBadgeIcon: "문헌",
    fileBadgeIcon: "파일",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `그림 (${count}/${max})` : `그림 (${count})`,
    fileCount: (count) => `파일 (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `논문 (${count}/${max})` : `논문 (${count})`,
    screenshotNth: (n) => `스크린샷 ${n}`,
    openAttachment: (name) => `${name} 열기`,
    fileFallback: "파일",
    usingCachedDocumentContext: "캐시된 문서 컨텍스트 사용 중",
    rebuildingDocumentContext: "문서 컨텍스트 재구성 중...",
    waitForCurrentResponse: "현재 응답이 끝날 때까지 기다리세요",
    noRetryableResponseFound: "다시 시도할 응답이 없습니다",
    nothingToRetryLatestTurn: "최신 턴에 다시 시도할 내용이 없습니다",
    preparingRetry: "다시 시도 준비 중...",
    preparingRequest: "요청 준비 중...",
    noResponse: "응답이 없습니다.",
    noAssistantTextSelected: "선택한 assistant 텍스트가 없습니다",
    copiedResponse: "응답을 복사했습니다",
    createdNewNote: "새 노트를 만들었습니다",
    failedToCreateNote: "노트 생성 실패",
    editingLatestPrompt: "최신 질문 편집 중",
    noChatHistoryDetected: "채팅 기록이 없습니다.",
    copiedChatAsMd: "채팅을 Markdown으로 복사했습니다",
    savedChatHistoryToNewNote: "채팅 기록을 새 노트로 저장했습니다",
    pinFilesPanel: "파일 패널 고정",
    pinFiguresPanel: "그림 패널 고정",
    conversationRestored: "대화를 복원했습니다",
    noActiveLibraryForDeletion: "삭제할 활성 라이브러리가 없습니다",
    cannotDeleteActiveConversation: "현재 활성 대화는 삭제할 수 없습니다",
    conversationDeletedUndo: "대화가 삭제되었습니다. 실행 취소할 수 있습니다.",
    reusedExistingEmptyPaperChat: "기존 빈 논문 채팅을 재사용했습니다",
    failedToCreateNewPaperConversation: "새 논문 대화 생성 실패",
    startedNewPaperChat: "새 논문 채팅을 시작했습니다",
    noActiveLibraryForGlobalConversation:
      "전역 대화에 사용할 활성 라이브러리가 없습니다",
    failedToCreateConversation: "대화 생성 실패",
    waitForResponseBeforeSwitching:
      "전환하기 전에 응답이 끝날 때까지 기다리세요",
    selectRegion: "영역을 선택하세요...",
    selectionCancelled: "선택이 취소되었습니다",
    screenshotFailed: "스크린샷 실패",
    copied: "복사됨",
    figuresCleared: "그림을 지웠습니다",
    filesCleared: "파일을 지웠습니다",
    paperContextDismissed: "논문 컨텍스트를 제거했습니다",
    selectedTextRemoved: "선택한 텍스트를 제거했습니다",
    cleared: "지웠습니다",
    textContextLimit: "텍스트 컨텍스트는 최대 5개입니다",
    clearSelectedContext: "선택한 컨텍스트 지우기",
    shortcutPromptEmpty: "단축 프롬프트는 비워 둘 수 없습니다",
    dragToReorder: "드래그하여 순서 변경",
    trLogFullPath: "전체 경로",
    trLogOutputFormat: (mono, dual) => `출력 형식: 단일=${mono} | 이중=${dual}`,
    trLogResolvingCredentials: "모델 자격 증명 확인 중...",
    trLogCheckingEnvironment: "번역 환경 확인 중...",
    trLogEnvironmentNotReady: (status) =>
      `환경이 준비되지 않았습니다 (상태: ${status})`,
    trLogInstallEnvironmentInstruction:
      "'환경 설치' 버튼을 클릭해 Python 환경을 설정하세요",
    trLogBridgeError: (message) => `브리지 오류: ${message}`,
    trLogTotalTime: (duration) => `총 시간: ${duration}`,
    trLogJobFinished: "작업 완료",
    trLogEngineStarted: "번역 엔진이 시작되었습니다...",
    trLogPausedCached: "번역이 일시 중지되었고 진행 상황이 캐시되었습니다",
    trLogLaunchingEngine: "번역 엔진 시작 중...",
    trLogStackTrace: "스택 추적",
  },
  "fr-FR": {
    title: "AIdea",
    copyChatMd: "Copier le chat en Markdown",
    saveChatAsNote: "Enregistrer le chat comme note",
    statusNoContext:
      "Aucun contexte d'article actif. Tapez @ pour ajouter des articles.",
    modelClickChoose: "Cliquer pour choisir un modèle",
    modelOnlyOne: "Un seul modèle est configuré",
    conversationLoaded: "Conversation chargée",
    noEditableLatestPrompt: "Aucune dernière question modifiable",
    referencePickerReady:
      "Sélecteur de références prêt. Tapez après @ pour chercher des articles.",
    paperAlreadySelected: "Article déjà ajouté",
    paperContextAdded: (n, max) => `Contexte d'article ajouté (${n}/${max})`,
    cancelled: "Annulé",
    addTextPopupTitle: "Ajouter le texte sélectionné au panneau LLM",
    addTextTitle: "Inclure le texte sélectionné dans le lecteur",
    deleteAll: "Tout supprimer",
    deleteAllConfirm: "Toutes les conversations ont été supprimées",
    pinConversation: "Épingler la conversation",
    unpinConversation: "Retirer l'épingle",
    renameConversation: "Renommer",
    deleteUnpinned: "Supprimer les non épinglées",
    deleteAllHistory: "Tout supprimer",
    cancelAction: "Annuler",
    confirmDeleteTitle: "Supprimer les conversations",
    trFormatDisclaimer:
      "⚠ En raison de la complexité du format PDF, la sortie traduite peut parfois présenter des écarts de mise en page ou de style. Nous continuons à l'améliorer.",
    trEnvNotReady: "Environnement de traduction non prêt",
    trQps: "QPS (requêtes/s)",
    trPoolMaxWorker: "Travailleurs parallèles",
    trSkipReferencesAuto: "Détecter et ignorer automatiquement les références",
    trKeepAppendixTranslated: "Continuer à traduire les annexes",
    trProtectAuthorBlock: "Protéger les auteurs/affiliations",
    trDisableRichTextTranslate: "Désactiver la traduction enrichie",
    trEnhanceCompatibility: "Améliorer la compatibilité",
    trTranslateTableText: "Traduire le texte des tableaux",
    trOCR: "Forcer le mode OCR",
    trAutoOCR: "Mode OCR automatique",
    trSaveGlossary: "Enregistrer le glossaire automatique",
    trDisableGlossary: "Désactiver l'extraction du glossaire",
    trFontFamily: "Famille de police principale",
    trFontFamilyAuto: "Auto",
    trFontFamilySerif: "Serif",
    trFontFamilySansSerif: "Sans-serif",
    trFontFamilyScript: "Script",
    trHintPoolMaxWorker:
      "Nombre de paragraphes traduits en parallèle. Plus haut = plus rapide, mais risque de limite API.",
    trHintSkipReferences:
      "Détecte la section Références par titre et ignore sa traduction.",
    trHintKeepAppendix: "Continue à traduire les annexes après les références.",
    trHintProtectAuthor:
      "Conserve les noms, e-mails et affiliations de la page de titre.",
    trHintDisableRichText:
      "Désactive la conservation gras/italique. Sortie plus propre mais sans style.",
    trHintEnhanceCompat:
      "Utilise un rendu PDF plus conservateur pour une meilleure compatibilité.",
    trHintTranslateTable:
      "Traduit le texte des tableaux. Les tableaux complexes peuvent se décaler.",
    trHintOcr:
      "Force l'OCR sur toutes les pages pour les PDF scannés ou au texte défectueux.",
    trHintAutoOcr:
      "Détecte automatiquement les PDF scannés et active l'OCR si nécessaire.",
    trHintSaveGlossary:
      "Extrait et enregistre automatiquement un glossaire terminologique.",
    trHintDisableGlossary: "Désactive complètement l'extraction du glossaire.",
    trHintFontFamily:
      "Auto = meilleur choix moteur ; Serif = Song/Times ; Sans-serif = Hei/Arial ; Script = italique/cursif.",
    trHintQps:
      "Requêtes API par seconde. Gratuit : 3-5 ; payant : 10-20. Trop haut peut limiter.",
    scrollToBottom: "Faire défiler en bas",
    requiredOutputFolder: "Obligatoire : choisir un dossier de sortie",
    expandFigures: "Développer les figures",
    collapseFigures: "Réduire les figures",
    clearSelectedScreenshots: "Effacer les captures sélectionnées",
    selectedScreenshotPreview: "Aperçu de la capture sélectionnée",
    selectFigureScreenshot: "Sélectionner une capture de figure",
    expandFiles: "Développer les fichiers",
    collapseFiles: "Réduire les fichiers",
    clearUploadedFiles: "Effacer les fichiers importés",
    contextActions: "Actions de contexte",
    newConversation: "Nouvelle conversation",
    expandPapers: "Développer les articles",
    collapsePapers: "Réduire les articles",
    supplementalPaper: "Article supplémentaire",
    figureBadgeIcon: "IMG",
    paperBadgeIcon: "RÉF",
    fileBadgeIcon: "FICH",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `Figures (${count}/${max})` : `Figures (${count})`,
    fileCount: (count) => `Fichiers (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max)
        ? `Articles (${count}/${max})`
        : `Articles (${count})`,
    screenshotNth: (n) => `Capture ${n}`,
    openAttachment: (name) => `Ouvrir ${name}`,
    fileFallback: "fichier",
    usingCachedDocumentContext: "Utilisation du contexte de document en cache",
    rebuildingDocumentContext: "Reconstruction du contexte du document...",
    waitForCurrentResponse: "Attendez la fin de la réponse en cours",
    noRetryableResponseFound: "Aucune réponse à réessayer",
    nothingToRetryLatestTurn: "Rien à réessayer pour le dernier tour",
    preparingRetry: "Préparation du nouvel essai...",
    preparingRequest: "Préparation de la requête...",
    noResponse: "Aucune réponse.",
    noAssistantTextSelected: "Aucun texte assistant sélectionné",
    copiedResponse: "Réponse copiée",
    createdNewNote: "Nouvelle note créée",
    failedToCreateNote: "Échec de création de la note",
    editingLatestPrompt: "Modification de la dernière question",
    noChatHistoryDetected: "Aucun historique de chat détecté.",
    copiedChatAsMd: "Chat copié en Markdown",
    savedChatHistoryToNewNote: "Historique enregistré dans une nouvelle note",
    pinFilesPanel: "Épingler le panneau fichiers",
    pinFiguresPanel: "Épingler le panneau figures",
    conversationRestored: "Conversation restaurée",
    noActiveLibraryForDeletion:
      "Aucune bibliothèque active pour la suppression",
    cannotDeleteActiveConversation:
      "Impossible de supprimer la conversation active maintenant",
    conversationDeletedUndo: "Conversation supprimée. Annulation disponible.",
    reusedExistingEmptyPaperChat: "Chat d'article vide existant réutilisé",
    failedToCreateNewPaperConversation:
      "Échec de création d'une conversation d'article",
    startedNewPaperChat: "Nouveau chat d'article démarré",
    noActiveLibraryForGlobalConversation:
      "Aucune bibliothèque active pour la conversation globale",
    failedToCreateConversation: "Échec de création de la conversation",
    waitForResponseBeforeSwitching:
      "Attendez la fin de la réponse avant de changer",
    selectRegion: "Sélectionnez une zone...",
    selectionCancelled: "Sélection annulée",
    screenshotFailed: "Échec de la capture",
    copied: "Copié",
    figuresCleared: "Figures effacées",
    filesCleared: "Fichiers effacés",
    paperContextDismissed: "Contexte d'article retiré",
    selectedTextRemoved: "Texte sélectionné supprimé",
    cleared: "Effacé",
    textContextLimit: "Contexte texte limité à 5",
    clearSelectedContext: "Effacer le contexte sélectionné",
    shortcutPromptEmpty: "Le prompt du raccourci ne peut pas être vide",
    dragToReorder: "Glisser pour réordonner",
    trLogFullPath: "Chemin complet",
    trLogOutputFormat: (mono, dual) =>
      `Format de sortie : Mono=${mono} | Bilingue=${dual}`,
    trLogResolvingCredentials: "Résolution des identifiants du modèle...",
    trLogCheckingEnvironment:
      "Vérification de l'environnement de traduction...",
    trLogEnvironmentNotReady: (status) =>
      `Environnement non prêt (statut : ${status})`,
    trLogInstallEnvironmentInstruction:
      "Cliquez sur « Installer l'environnement » pour configurer l'environnement Python",
    trLogBridgeError: (message) => `Erreur de pont : ${message}`,
    trLogTotalTime: (duration) => `Temps total : ${duration}`,
    trLogJobFinished: "Tâche terminée",
    trLogEngineStarted: "Moteur de traduction démarré...",
    trLogPausedCached: "Traduction en pause — progression enregistrée",
    trLogLaunchingEngine: "Lancement du moteur de traduction...",
    trLogStackTrace: "Trace de pile",
  },
  "de-DE": {
    title: "AIdea",
    copyChatMd: "Chat als Markdown kopieren",
    saveChatAsNote: "Chat als Notiz speichern",
    statusNoContext:
      "Kein aktiver Paper-Kontext. Tippen Sie @, um Paper hinzuzufügen.",
    modelClickChoose: "Klicken, um ein Modell auszuwählen",
    modelOnlyOne: "Nur ein Modell ist konfiguriert",
    conversationLoaded: "Unterhaltung geladen",
    noEditableLatestPrompt: "Keine bearbeitbare letzte Frage",
    referencePickerReady:
      "Referenzauswahl bereit. Tippen Sie nach @, um Paper zu suchen.",
    paperAlreadySelected: "Paper bereits ausgewählt",
    paperContextAdded: (n, max) => `Paper-Kontext hinzugefügt (${n}/${max})`,
    cancelled: "Abgebrochen",
    addTextPopupTitle: "Ausgewählten Text zum LLM-Panel hinzufügen",
    addTextTitle: "Ausgewählten Reader-Text einbeziehen",
    deleteAll: "Alle löschen",
    deleteAllConfirm: "Alle Unterhaltungen gelöscht",
    pinConversation: "Unterhaltung anheften",
    unpinConversation: "Anheften lösen",
    renameConversation: "Umbenennen",
    deleteUnpinned: "Nicht angeheftete löschen",
    deleteAllHistory: "Alle löschen",
    cancelAction: "Abbrechen",
    confirmDeleteTitle: "Unterhaltungen löschen",
    trFormatDisclaimer:
      "⚠ Aufgrund der Komplexität von PDF-Formaten kann die übersetzte Ausgabe gelegentlich Layout- oder Stilabweichungen enthalten. Wir verbessern dies kontinuierlich.",
    trEnvNotReady: "Übersetzungsumgebung nicht bereit",
    trQps: "QPS (Anfragen/Sek.)",
    trPoolMaxWorker: "Parallele Worker",
    trSkipReferencesAuto: "Referenzen automatisch erkennen und überspringen",
    trKeepAppendixTranslated: "Anhänge weiter übersetzen",
    trProtectAuthorBlock: "Autoren-/Institutsangaben schützen",
    trDisableRichTextTranslate: "Rich-Text-Übersetzung deaktivieren",
    trEnhanceCompatibility: "Kompatibilität verbessern",
    trTranslateTableText: "Tabellentext übersetzen",
    trOCR: "OCR-Modus erzwingen",
    trAutoOCR: "OCR-Modus automatisch",
    trSaveGlossary: "Automatisches Glossar speichern",
    trDisableGlossary: "Glossarextraktion deaktivieren",
    trFontFamily: "Primäre Schriftfamilie",
    trFontFamilyAuto: "Automatisch",
    trFontFamilySerif: "Serif",
    trFontFamilySansSerif: "Sans-serif",
    trFontFamilyScript: "Schreibschrift",
    trHintPoolMaxWorker:
      "Anzahl der gleichzeitig übersetzten Absätze. Höher = schneller, kann aber API-Limits auslösen.",
    trHintSkipReferences:
      "Erkennt den Referenzabschnitt per Überschrift und überspringt diese Seiten.",
    trHintKeepAppendix: "Übersetzt Anhänge nach dem Referenzabschnitt weiter.",
    trHintProtectAuthor:
      "Erhält Namen, E-Mails und Affiliations auf der Titelseite.",
    trHintDisableRichText:
      "Deaktiviert Fett/Kursiv-Erhaltung. Sauberer Text, aber ohne Formatierung.",
    trHintEnhanceCompat:
      "Nutzt konservativeres PDF-Rendering für bessere Reader-Kompatibilität.",
    trHintTranslateTable:
      "Übersetzt Text in Tabellen. Komplexe Tabellen können verrutschen.",
    trHintOcr:
      "Erzwingt OCR auf allen Seiten. Für PDFs mit defekter Textebene.",
    trHintAutoOcr:
      "Erkennt gescannte PDFs automatisch und aktiviert OCR bei Bedarf.",
    trHintSaveGlossary:
      "Extrahiert und speichert automatisch ein Terminologie-Glossar.",
    trHintDisableGlossary:
      "Deaktiviert die automatische Terminologieextraktion vollständig.",
    trHintFontFamily:
      "Auto = beste Engine-Auswahl; Serif = Song/Times; Sans-serif = Hei/Arial; Script = kursiv/Schreibschrift.",
    trHintQps:
      "API-Anfragen pro Sekunde. Kostenlose APIs: 3-5; bezahlte APIs: 10-20.",
    scrollToBottom: "Nach unten scrollen",
    requiredOutputFolder: "Pflichtfeld: Ausgabeordner wählen",
    expandFigures: "Abbildungen erweitern",
    collapseFigures: "Abbildungen einklappen",
    clearSelectedScreenshots: "Ausgewählte Screenshots löschen",
    selectedScreenshotPreview: "Vorschau des ausgewählten Screenshots",
    selectFigureScreenshot: "Abbildungs-Screenshot auswählen",
    expandFiles: "Dateien erweitern",
    collapseFiles: "Dateien einklappen",
    clearUploadedFiles: "Hochgeladene Dateien löschen",
    contextActions: "Kontextaktionen",
    newConversation: "Neue Unterhaltung",
    expandPapers: "Paper erweitern",
    collapsePapers: "Paper einklappen",
    supplementalPaper: "Zusätzliches Paper",
    figureBadgeIcon: "IMG",
    paperBadgeIcon: "REF",
    fileBadgeIcon: "DATEI",
    figureCount: (count, max) =>
      Number.isFinite(max)
        ? `Abbildungen (${count}/${max})`
        : `Abbildungen (${count})`,
    fileCount: (count) => `Dateien (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `Paper (${count}/${max})` : `Paper (${count})`,
    screenshotNth: (n) => `Screenshot ${n}`,
    openAttachment: (name) => `${name} öffnen`,
    fileFallback: "Datei",
    usingCachedDocumentContext:
      "Zwischengespeicherten Dokumentkontext verwenden",
    rebuildingDocumentContext: "Dokumentkontext wird neu aufgebaut...",
    waitForCurrentResponse: "Warten Sie, bis die aktuelle Antwort fertig ist",
    noRetryableResponseFound: "Keine wiederholbare Antwort gefunden",
    nothingToRetryLatestTurn: "Im letzten Durchgang nichts zum Wiederholen",
    preparingRetry: "Wiederholung wird vorbereitet...",
    preparingRequest: "Anfrage wird vorbereitet...",
    noResponse: "Keine Antwort.",
    noAssistantTextSelected: "Kein Assistententext ausgewählt",
    copiedResponse: "Antwort kopiert",
    createdNewNote: "Neue Notiz erstellt",
    failedToCreateNote: "Notiz konnte nicht erstellt werden",
    editingLatestPrompt: "Letzte Frage wird bearbeitet",
    noChatHistoryDetected: "Kein Chatverlauf erkannt.",
    copiedChatAsMd: "Chat als Markdown kopiert",
    savedChatHistoryToNewNote: "Chatverlauf in neuer Notiz gespeichert",
    pinFilesPanel: "Dateipanel anheften",
    pinFiguresPanel: "Abbildungspanel anheften",
    conversationRestored: "Unterhaltung wiederhergestellt",
    noActiveLibraryForDeletion: "Keine aktive Bibliothek zum Löschen",
    cannotDeleteActiveConversation:
      "Aktive Unterhaltung kann derzeit nicht gelöscht werden",
    conversationDeletedUndo: "Unterhaltung gelöscht. Rückgängig verfügbar.",
    reusedExistingEmptyPaperChat:
      "Vorhandenen leeren Paper-Chat wiederverwendet",
    failedToCreateNewPaperConversation:
      "Neue Paper-Unterhaltung konnte nicht erstellt werden",
    startedNewPaperChat: "Neuen Paper-Chat gestartet",
    noActiveLibraryForGlobalConversation:
      "Keine aktive Bibliothek für globale Unterhaltung",
    failedToCreateConversation: "Unterhaltung konnte nicht erstellt werden",
    waitForResponseBeforeSwitching:
      "Warten Sie vor dem Wechsel auf die fertige Antwort",
    selectRegion: "Bereich auswählen...",
    selectionCancelled: "Auswahl abgebrochen",
    screenshotFailed: "Screenshot fehlgeschlagen",
    copied: "Kopiert",
    figuresCleared: "Abbildungen gelöscht",
    filesCleared: "Dateien gelöscht",
    paperContextDismissed: "Paper-Kontext entfernt",
    selectedTextRemoved: "Ausgewählter Text entfernt",
    cleared: "Gelöscht",
    textContextLimit: "Textkontext maximal 5",
    clearSelectedContext: "Ausgewählten Kontext löschen",
    shortcutPromptEmpty: "Shortcut-Prompt darf nicht leer sein",
    dragToReorder: "Zum Sortieren ziehen",
    trLogFullPath: "Vollständiger Pfad",
    trLogOutputFormat: (mono, dual) =>
      `Ausgabeformat: Mono=${mono} | Zweisprachig=${dual}`,
    trLogResolvingCredentials: "Modellanmeldedaten werden aufgelöst...",
    trLogCheckingEnvironment: "Übersetzungsumgebung wird geprüft...",
    trLogEnvironmentNotReady: (status) =>
      `Umgebung nicht bereit (Status: ${status})`,
    trLogInstallEnvironmentInstruction:
      "Klicken Sie auf „Umgebung installieren“, um die Python-Umgebung einzurichten",
    trLogBridgeError: (message) => `Bridge-Fehler: ${message}`,
    trLogTotalTime: (duration) => `Gesamtzeit: ${duration}`,
    trLogJobFinished: "Auftrag abgeschlossen",
    trLogEngineStarted: "Übersetzungsengine gestartet...",
    trLogPausedCached: "Übersetzung pausiert — Fortschritt zwischengespeichert",
    trLogLaunchingEngine: "Übersetzungsengine wird gestartet...",
    trLogStackTrace: "Stacktrace",
  },
  "es-ES": {
    title: "AIdea",
    copyChatMd: "Copiar chat como Markdown",
    saveChatAsNote: "Guardar chat como nota",
    statusNoContext:
      "No hay contexto de artículo activo. Escribe @ para añadir artículos.",
    modelClickChoose: "Haz clic para elegir un modelo",
    modelOnlyOne: "Solo hay un modelo configurado",
    conversationLoaded: "Conversación cargada",
    noEditableLatestPrompt: "No hay una última pregunta editable",
    referencePickerReady:
      "Selector de referencias listo. Escribe después de @ para buscar artículos.",
    paperAlreadySelected: "Artículo ya seleccionado",
    paperContextAdded: (n, max) => `Contexto de artículo añadido (${n}/${max})`,
    cancelled: "Cancelado",
    addTextPopupTitle: "Añadir texto seleccionado al panel LLM",
    addTextTitle: "Incluir el texto seleccionado del lector",
    deleteAll: "Eliminar todo",
    deleteAllConfirm: "Todas las conversaciones eliminadas",
    pinConversation: "Fijar conversación",
    unpinConversation: "Desfijar conversación",
    renameConversation: "Cambiar nombre",
    deleteUnpinned: "Eliminar no fijadas",
    deleteAllHistory: "Eliminar todo",
    cancelAction: "Cancelar",
    confirmDeleteTitle: "Eliminar conversaciones",
    trFormatDisclaimer:
      "⚠ Debido a la complejidad del formato PDF, la salida traducida puede mostrar diferencias ocasionales de diseño o estilo. Seguimos mejorándolo.",
    trEnvNotReady: "El entorno de traducción no está listo",
    trQps: "QPS (consultas/seg)",
    trPoolMaxWorker: "Trabajadores paralelos",
    trSkipReferencesAuto: "Detectar y omitir referencias automáticamente",
    trKeepAppendixTranslated: "Seguir traduciendo apéndices",
    trProtectAuthorBlock: "Proteger autores/afiliaciones",
    trDisableRichTextTranslate: "Desactivar traducción con formato",
    trEnhanceCompatibility: "Mejorar compatibilidad",
    trTranslateTableText: "Traducir texto de tablas",
    trOCR: "Forzar modo OCR",
    trAutoOCR: "Modo OCR automático",
    trSaveGlossary: "Guardar glosario automático",
    trDisableGlossary: "Desactivar extracción de glosario",
    trFontFamily: "Familia de fuente principal",
    trFontFamilyAuto: "Auto",
    trFontFamilySerif: "Serif",
    trFontFamilySansSerif: "Sans-serif",
    trFontFamilyScript: "Script",
    trHintPoolMaxWorker:
      "Número de párrafos traducidos en paralelo. Más alto = más rápido, pero puede activar límites de API.",
    trHintSkipReferences:
      "Detecta la sección Referencias por encabezado y omite esas páginas.",
    trHintKeepAppendix:
      "Continúa traduciendo apéndices después de las referencias.",
    trHintProtectAuthor:
      "Conserva nombres, correos y afiliaciones en la portada.",
    trHintDisableRichText:
      "Desactiva la conservación de negrita/cursiva. Más limpio, pero pierde formato.",
    trHintEnhanceCompat:
      "Usa renderizado PDF conservador para mayor compatibilidad.",
    trHintTranslateTable:
      "Traduce texto dentro de tablas. Las tablas complejas pueden desalinearse.",
    trHintOcr:
      "Fuerza OCR en todas las páginas. Útil para PDF escaneados o con texto dañado.",
    trHintAutoOcr: "Detecta PDF escaneados y activa OCR si es necesario.",
    trHintSaveGlossary:
      "Extrae y guarda automáticamente un glosario terminológico.",
    trHintDisableGlossary:
      "Desactiva por completo la extracción automática de glosario.",
    trHintFontFamily:
      "Auto = el motor elige; Serif = Song/Times; Sans-serif = Hei/Arial; Script = cursiva/manuscrita.",
    trHintQps: "Solicitudes API por segundo. API gratis: 3-5; de pago: 10-20.",
    scrollToBottom: "Desplazar al final",
    requiredOutputFolder: "Obligatorio: elige una carpeta de salida",
    expandFigures: "Expandir figuras",
    collapseFigures: "Contraer figuras",
    clearSelectedScreenshots: "Borrar capturas seleccionadas",
    selectedScreenshotPreview: "Vista previa de captura seleccionada",
    selectFigureScreenshot: "Seleccionar captura de figura",
    expandFiles: "Expandir archivos",
    collapseFiles: "Contraer archivos",
    clearUploadedFiles: "Borrar archivos subidos",
    contextActions: "Acciones de contexto",
    newConversation: "Nueva conversación",
    expandPapers: "Expandir artículos",
    collapsePapers: "Contraer artículos",
    supplementalPaper: "Artículo suplementario",
    figureBadgeIcon: "IMG",
    paperBadgeIcon: "REF",
    fileBadgeIcon: "ARCH",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `Figuras (${count}/${max})` : `Figuras (${count})`,
    fileCount: (count) => `Archivos (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max)
        ? `Artículos (${count}/${max})`
        : `Artículos (${count})`,
    screenshotNth: (n) => `Captura ${n}`,
    openAttachment: (name) => `Abrir ${name}`,
    fileFallback: "archivo",
    usingCachedDocumentContext: "Usando contexto de documento en caché",
    rebuildingDocumentContext: "Reconstruyendo contexto del documento...",
    waitForCurrentResponse: "Espera a que termine la respuesta actual",
    noRetryableResponseFound: "No se encontró respuesta para reintentar",
    nothingToRetryLatestTurn: "Nada que reintentar en el último turno",
    preparingRetry: "Preparando reintento...",
    preparingRequest: "Preparando solicitud...",
    noResponse: "Sin respuesta.",
    noAssistantTextSelected: "No hay texto del asistente seleccionado",
    copiedResponse: "Respuesta copiada",
    createdNewNote: "Nueva nota creada",
    failedToCreateNote: "No se pudo crear la nota",
    editingLatestPrompt: "Editando la última pregunta",
    noChatHistoryDetected: "No se detectó historial de chat.",
    copiedChatAsMd: "Chat copiado como Markdown",
    savedChatHistoryToNewNote: "Historial guardado en una nueva nota",
    pinFilesPanel: "Fijar panel de archivos",
    pinFiguresPanel: "Fijar panel de figuras",
    conversationRestored: "Conversación restaurada",
    noActiveLibraryForDeletion: "No hay biblioteca activa para eliminar",
    cannotDeleteActiveConversation:
      "No se puede eliminar la conversación activa ahora",
    conversationDeletedUndo: "Conversación eliminada. Puedes deshacer.",
    reusedExistingEmptyPaperChat: "Chat de artículo vacío reutilizado",
    failedToCreateNewPaperConversation:
      "No se pudo crear la conversación de artículo",
    startedNewPaperChat: "Nuevo chat de artículo iniciado",
    noActiveLibraryForGlobalConversation:
      "No hay biblioteca activa para conversación global",
    failedToCreateConversation: "No se pudo crear la conversación",
    waitForResponseBeforeSwitching:
      "Espera a que termine la respuesta antes de cambiar",
    selectRegion: "Selecciona una región...",
    selectionCancelled: "Selección cancelada",
    screenshotFailed: "Error de captura",
    copied: "Copiado",
    figuresCleared: "Figuras borradas",
    filesCleared: "Archivos borrados",
    paperContextDismissed: "Contexto de artículo quitado",
    selectedTextRemoved: "Texto seleccionado eliminado",
    cleared: "Borrado",
    textContextLimit: "Contexto de texto hasta 5",
    clearSelectedContext: "Borrar contexto seleccionado",
    shortcutPromptEmpty: "El prompt del atajo no puede estar vacío",
    dragToReorder: "Arrastra para reordenar",
    trLogFullPath: "Ruta completa",
    trLogOutputFormat: (mono, dual) =>
      `Formato de salida: Mono=${mono} | Bilingüe=${dual}`,
    trLogResolvingCredentials: "Resolviendo credenciales del modelo...",
    trLogCheckingEnvironment: "Comprobando entorno de traducción...",
    trLogEnvironmentNotReady: (status) =>
      `Entorno no listo (estado: ${status})`,
    trLogInstallEnvironmentInstruction:
      "Haz clic en 'Instalar entorno' para configurar el entorno Python",
    trLogBridgeError: (message) => `Error de puente: ${message}`,
    trLogTotalTime: (duration) => `Tiempo total: ${duration}`,
    trLogJobFinished: "Tarea finalizada",
    trLogEngineStarted: "Motor de traducción iniciado...",
    trLogPausedCached: "Traducción pausada; progreso guardado",
    trLogLaunchingEngine: "Iniciando motor de traducción...",
    trLogStackTrace: "Traza de pila",
  },
  "ru-RU": {
    title: "AIdea",
    copyChatMd: "Копировать чат как Markdown",
    saveChatAsNote: "Сохранить чат как заметку",
    statusNoContext:
      "Нет активного контекста статьи. Введите @, чтобы добавить статьи.",
    modelClickChoose: "Нажмите, чтобы выбрать модель",
    modelOnlyOne: "Настроена только одна модель",
    conversationLoaded: "Диалог загружен",
    noEditableLatestPrompt: "Нет последнего вопроса для редактирования",
    referencePickerReady:
      "Выбор ссылок готов. Введите текст после @ для поиска статей.",
    paperAlreadySelected: "Статья уже выбрана",
    paperContextAdded: (n, max) => `Контекст статьи добавлен (${n}/${max})`,
    cancelled: "Отменено",
    addTextPopupTitle: "Добавить выделенный текст на панель LLM",
    addTextTitle: "Добавить выделенный текст из читалки",
    deleteAll: "Удалить все",
    deleteAllConfirm: "Все диалоги удалены",
    pinConversation: "Закрепить диалог",
    unpinConversation: "Открепить диалог",
    renameConversation: "Переименовать",
    deleteUnpinned: "Удалить незакрепленные",
    deleteAllHistory: "Удалить все",
    cancelAction: "Отмена",
    confirmDeleteTitle: "Удалить диалоги",
    trFormatDisclaimer:
      "⚠ Из-за сложности формата PDF в переведенном файле иногда возможны отличия верстки или стиля. Мы продолжаем улучшать результат.",
    trEnvNotReady: "Среда перевода не готова",
    trQps: "QPS (запросов/сек)",
    trPoolMaxWorker: "Параллельные обработчики",
    trSkipReferencesAuto:
      "Автоматически обнаруживать и пропускать список литературы",
    trKeepAppendixTranslated: "Продолжать перевод приложений",
    trProtectAuthorBlock: "Защищать авторов/аффилиации",
    trDisableRichTextTranslate: "Отключить перевод с форматированием",
    trEnhanceCompatibility: "Повысить совместимость",
    trTranslateTableText: "Переводить текст таблиц",
    trOCR: "Принудительный режим OCR",
    trAutoOCR: "Автоматический режим OCR",
    trSaveGlossary: "Сохранить автоматический глоссарий",
    trDisableGlossary: "Отключить извлечение глоссария",
    trFontFamily: "Основное семейство шрифтов",
    trFontFamilyAuto: "Авто",
    trFontFamilySerif: "С засечками",
    trFontFamilySansSerif: "Без засечек",
    trFontFamilyScript: "Рукописный",
    trHintPoolMaxWorker:
      "Число абзацев, переводимых одновременно. Больше = быстрее, но возможны лимиты API.",
    trHintSkipReferences:
      "Определяет раздел References по заголовку и пропускает эти страницы.",
    trHintKeepAppendix:
      "Продолжает перевод приложений после списка литературы.",
    trHintProtectAuthor:
      "Сохраняет имена авторов, e-mail и организации на титульной странице.",
    trHintDisableRichText:
      "Отключает сохранение жирного/курсива. Текст чище, но форматирование теряется.",
    trHintEnhanceCompat:
      "Использует более консервативный рендеринг PDF для лучшей совместимости.",
    trHintTranslateTable:
      "Переводит текст в таблицах. Сложные таблицы могут смещаться.",
    trHintOcr:
      "Принудительно применяет OCR ко всем страницам. Для сканов и поврежденного текстового слоя.",
    trHintAutoOcr:
      "Автоматически обнаруживает сканы PDF и включает OCR при необходимости.",
    trHintSaveGlossary:
      "Автоматически извлекает и сохраняет терминологический глоссарий.",
    trHintDisableGlossary:
      "Полностью отключает автоматическое извлечение терминов.",
    trHintFontFamily:
      "Авто = выбор движка; Serif = Song/Times; Sans-serif = Hei/Arial; Script = курсив/рукописный.",
    trHintQps:
      "Запросов API в секунду. Бесплатные API: 3-5; платные API: 10-20.",
    scrollToBottom: "Прокрутить вниз",
    requiredOutputFolder: "Обязательно: выберите папку вывода",
    expandFigures: "Развернуть рисунки",
    collapseFigures: "Свернуть рисунки",
    clearSelectedScreenshots: "Очистить выбранные скриншоты",
    selectedScreenshotPreview: "Предпросмотр выбранного скриншота",
    selectFigureScreenshot: "Выбрать скриншот рисунка",
    expandFiles: "Развернуть файлы",
    collapseFiles: "Свернуть файлы",
    clearUploadedFiles: "Очистить загруженные файлы",
    contextActions: "Действия контекста",
    newConversation: "Новый диалог",
    expandPapers: "Развернуть статьи",
    collapsePapers: "Свернуть статьи",
    supplementalPaper: "Дополнительная статья",
    figureBadgeIcon: "ИЗОБ",
    paperBadgeIcon: "ССЫЛ",
    fileBadgeIcon: "ФАЙЛ",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `Рисунки (${count}/${max})` : `Рисунки (${count})`,
    fileCount: (count) => `Файлы (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `Статьи (${count}/${max})` : `Статьи (${count})`,
    screenshotNth: (n) => `Скриншот ${n}`,
    openAttachment: (name) => `Открыть ${name}`,
    fileFallback: "файл",
    usingCachedDocumentContext: "Используется кэшированный контекст документа",
    rebuildingDocumentContext: "Перестроение контекста документа...",
    waitForCurrentResponse: "Дождитесь завершения текущего ответа",
    noRetryableResponseFound: "Нет ответа для повторной попытки",
    nothingToRetryLatestTurn: "В последнем ходе нечего повторять",
    preparingRetry: "Подготовка повтора...",
    preparingRequest: "Подготовка запроса...",
    noResponse: "Нет ответа.",
    noAssistantTextSelected: "Текст ассистента не выбран",
    copiedResponse: "Ответ скопирован",
    createdNewNote: "Создана новая заметка",
    failedToCreateNote: "Не удалось создать заметку",
    editingLatestPrompt: "Редактирование последнего вопроса",
    noChatHistoryDetected: "История чата не обнаружена.",
    copiedChatAsMd: "Чат скопирован как Markdown",
    savedChatHistoryToNewNote: "История чата сохранена в новую заметку",
    pinFilesPanel: "Закрепить панель файлов",
    pinFiguresPanel: "Закрепить панель рисунков",
    conversationRestored: "Диалог восстановлен",
    noActiveLibraryForDeletion: "Нет активной библиотеки для удаления",
    cannotDeleteActiveConversation: "Сейчас нельзя удалить активный диалог",
    conversationDeletedUndo: "Диалог удален. Доступна отмена.",
    reusedExistingEmptyPaperChat: "Повторно использован пустой чат статьи",
    failedToCreateNewPaperConversation:
      "Не удалось создать новый диалог статьи",
    startedNewPaperChat: "Начат новый чат статьи",
    noActiveLibraryForGlobalConversation:
      "Нет активной библиотеки для глобального диалога",
    failedToCreateConversation: "Не удалось создать диалог",
    waitForResponseBeforeSwitching:
      "Дождитесь завершения ответа перед переключением",
    selectRegion: "Выберите область...",
    selectionCancelled: "Выбор отменен",
    screenshotFailed: "Скриншот не удался",
    copied: "Скопировано",
    figuresCleared: "Рисунки очищены",
    filesCleared: "Файлы очищены",
    paperContextDismissed: "Контекст статьи удален",
    selectedTextRemoved: "Выделенный текст удален",
    cleared: "Очищено",
    textContextLimit: "Текстовый контекст до 5",
    clearSelectedContext: "Очистить выбранный контекст",
    shortcutPromptEmpty: "Промпт ярлыка не может быть пустым",
    dragToReorder: "Перетащите для изменения порядка",
    trLogFullPath: "Полный путь",
    trLogOutputFormat: (mono, dual) =>
      `Формат вывода: Mono=${mono} | Двуязычный=${dual}`,
    trLogResolvingCredentials: "Разрешение учетных данных модели...",
    trLogCheckingEnvironment: "Проверка среды перевода...",
    trLogEnvironmentNotReady: (status) => `Среда не готова (статус: ${status})`,
    trLogInstallEnvironmentInstruction:
      "Нажмите «Установить среду», чтобы настроить среду Python",
    trLogBridgeError: (message) => `Ошибка моста: ${message}`,
    trLogTotalTime: (duration) => `Общее время: ${duration}`,
    trLogJobFinished: "Задание завершено",
    trLogEngineStarted: "Движок перевода запущен...",
    trLogPausedCached: "Перевод приостановлен, прогресс сохранен",
    trLogLaunchingEngine: "Запуск движка перевода...",
    trLogStackTrace: "Трассировка стека",
  },
  "pt-BR": {
    title: "AIdea",
    copyChatMd: "Copiar chat como Markdown",
    saveChatAsNote: "Salvar chat como nota",
    statusNoContext:
      "Nenhum contexto de artigo ativo. Digite @ para adicionar artigos.",
    modelClickChoose: "Clique para escolher um modelo",
    modelOnlyOne: "Apenas um modelo está configurado",
    conversationLoaded: "Conversa carregada",
    noEditableLatestPrompt: "Nenhuma pergunta recente editável",
    referencePickerReady:
      "Seletor de referências pronto. Digite após @ para buscar artigos.",
    paperAlreadySelected: "Artigo já selecionado",
    paperContextAdded: (n, max) =>
      `Contexto de artigo adicionado (${n}/${max})`,
    cancelled: "Cancelado",
    addTextPopupTitle: "Adicionar texto selecionado ao painel LLM",
    addTextTitle: "Incluir texto selecionado no leitor",
    deleteAll: "Excluir tudo",
    deleteAllConfirm: "Todas as conversas foram excluídas",
    pinConversation: "Fixar conversa",
    unpinConversation: "Desafixar conversa",
    renameConversation: "Renomear",
    deleteUnpinned: "Excluir não fixadas",
    deleteAllHistory: "Excluir tudo",
    cancelAction: "Cancelar",
    confirmDeleteTitle: "Excluir conversas",
    trFormatDisclaimer:
      "⚠ Devido à complexidade do formato PDF, a saída traduzida pode apresentar diferenças ocasionais de layout ou estilo. Continuamos melhorando.",
    trEnvNotReady: "Ambiente de tradução não está pronto",
    trQps: "QPS (consultas/s)",
    trPoolMaxWorker: "Trabalhadores paralelos",
    trSkipReferencesAuto: "Detectar e pular referências automaticamente",
    trKeepAppendixTranslated: "Continuar traduzindo apêndices",
    trProtectAuthorBlock: "Proteger autores/afiliação",
    trDisableRichTextTranslate: "Desativar tradução com rich text",
    trEnhanceCompatibility: "Melhorar compatibilidade",
    trTranslateTableText: "Traduzir texto de tabelas",
    trOCR: "Forçar modo OCR",
    trAutoOCR: "Modo OCR automático",
    trSaveGlossary: "Salvar glossário automático",
    trDisableGlossary: "Desativar extração de glossário",
    trFontFamily: "Família de fonte principal",
    trFontFamilyAuto: "Auto",
    trFontFamilySerif: "Serifada",
    trFontFamilySansSerif: "Sem serifa",
    trFontFamilyScript: "Script",
    trHintPoolMaxWorker:
      "Número de parágrafos traduzidos em paralelo. Maior = mais rápido, mas pode atingir limites da API.",
    trHintSkipReferences:
      "Detecta a seção Referências pelo título e pula essas páginas.",
    trHintKeepAppendix: "Continua traduzindo apêndices após as referências.",
    trHintProtectAuthor:
      "Preserva nomes, e-mails e afiliações na página de título.",
    trHintDisableRichText:
      "Desativa preservação de negrito/itálico. Saída mais limpa, mas sem estilo.",
    trHintEnhanceCompat:
      "Usa renderização PDF mais conservadora para melhor compatibilidade.",
    trHintTranslateTable:
      "Traduz texto dentro de tabelas. Tabelas complexas podem desalinha.",
    trHintOcr:
      "Força OCR em todas as páginas. Use para PDFs escaneados ou com camada de texto ruim.",
    trHintAutoOcr:
      "Detecta PDFs escaneados automaticamente e ativa OCR quando necessário.",
    trHintSaveGlossary:
      "Extrai e salva automaticamente um glossário terminológico.",
    trHintDisableGlossary:
      "Desativa completamente a extração automática de termos.",
    trHintFontFamily:
      "Auto = melhor escolha do motor; Serifada = Song/Times; Sem serifa = Hei/Arial; Script = cursiva.",
    trHintQps:
      "Requisições de API por segundo. APIs gratuitas: 3-5; pagas: 10-20.",
    scrollToBottom: "Rolar para o final",
    requiredOutputFolder: "Obrigatório: escolha a pasta de saída",
    expandFigures: "Expandir figuras",
    collapseFigures: "Recolher figuras",
    clearSelectedScreenshots: "Limpar capturas selecionadas",
    selectedScreenshotPreview: "Prévia da captura selecionada",
    selectFigureScreenshot: "Selecionar captura de figura",
    expandFiles: "Expandir arquivos",
    collapseFiles: "Recolher arquivos",
    clearUploadedFiles: "Limpar arquivos enviados",
    contextActions: "Ações de contexto",
    newConversation: "Nova conversa",
    expandPapers: "Expandir artigos",
    collapsePapers: "Recolher artigos",
    supplementalPaper: "Artigo suplementar",
    figureBadgeIcon: "IMG",
    paperBadgeIcon: "REF",
    fileBadgeIcon: "ARQ",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `Figuras (${count}/${max})` : `Figuras (${count})`,
    fileCount: (count) => `Arquivos (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `Artigos (${count}/${max})` : `Artigos (${count})`,
    screenshotNth: (n) => `Captura ${n}`,
    openAttachment: (name) => `Abrir ${name}`,
    fileFallback: "arquivo",
    usingCachedDocumentContext: "Usando contexto do documento em cache",
    rebuildingDocumentContext: "Reconstruindo contexto do documento...",
    waitForCurrentResponse: "Aguarde a resposta atual terminar",
    noRetryableResponseFound: "Nenhuma resposta para tentar novamente",
    nothingToRetryLatestTurn: "Nada para tentar novamente no último turno",
    preparingRetry: "Preparando nova tentativa...",
    preparingRequest: "Preparando solicitação...",
    noResponse: "Sem resposta.",
    noAssistantTextSelected: "Nenhum texto do assistente selecionado",
    copiedResponse: "Resposta copiada",
    createdNewNote: "Nova nota criada",
    failedToCreateNote: "Falha ao criar nota",
    editingLatestPrompt: "Editando a pergunta mais recente",
    noChatHistoryDetected: "Nenhum histórico de chat detectado.",
    copiedChatAsMd: "Chat copiado como Markdown",
    savedChatHistoryToNewNote: "Histórico salvo em nova nota",
    pinFilesPanel: "Fixar painel de arquivos",
    pinFiguresPanel: "Fixar painel de figuras",
    conversationRestored: "Conversa restaurada",
    noActiveLibraryForDeletion: "Nenhuma biblioteca ativa para exclusão",
    cannotDeleteActiveConversation:
      "Não é possível excluir a conversa ativa agora",
    conversationDeletedUndo: "Conversa excluída. Desfazer disponível.",
    reusedExistingEmptyPaperChat: "Chat de artigo vazio reutilizado",
    failedToCreateNewPaperConversation:
      "Falha ao criar nova conversa de artigo",
    startedNewPaperChat: "Novo chat de artigo iniciado",
    noActiveLibraryForGlobalConversation:
      "Nenhuma biblioteca ativa para conversa global",
    failedToCreateConversation: "Falha ao criar conversa",
    waitForResponseBeforeSwitching:
      "Aguarde a resposta terminar antes de trocar",
    selectRegion: "Selecione uma região...",
    selectionCancelled: "Seleção cancelada",
    screenshotFailed: "Falha na captura",
    copied: "Copiado",
    figuresCleared: "Figuras limpas",
    filesCleared: "Arquivos limpos",
    paperContextDismissed: "Contexto de artigo removido",
    selectedTextRemoved: "Texto selecionado removido",
    cleared: "Limpo",
    textContextLimit: "Contexto de texto até 5",
    clearSelectedContext: "Limpar contexto selecionado",
    shortcutPromptEmpty: "O prompt do atalho não pode ficar vazio",
    dragToReorder: "Arraste para reordenar",
    trLogFullPath: "Caminho completo",
    trLogOutputFormat: (mono, dual) =>
      `Formato de saída: Mono=${mono} | Bilíngue=${dual}`,
    trLogResolvingCredentials: "Resolvendo credenciais do modelo...",
    trLogCheckingEnvironment: "Verificando ambiente de tradução...",
    trLogEnvironmentNotReady: (status) =>
      `Ambiente não pronto (status: ${status})`,
    trLogInstallEnvironmentInstruction:
      "Clique em 'Instalar ambiente' para configurar o ambiente Python",
    trLogBridgeError: (message) => `Erro de ponte: ${message}`,
    trLogTotalTime: (duration) => `Tempo total: ${duration}`,
    trLogJobFinished: "Tarefa concluída",
    trLogEngineStarted: "Motor de tradução iniciado...",
    trLogPausedCached: "Tradução pausada; progresso salvo em cache",
    trLogLaunchingEngine: "Iniciando motor de tradução...",
    trLogStackTrace: "Rastreamento de pilha",
  },
  "ar-SA": {
    title: "AIdea",
    copyChatMd: "نسخ المحادثة كـ Markdown",
    saveChatAsNote: "حفظ المحادثة كملاحظة",
    statusNoContext: "لا يوجد سياق ورقة نشط. اكتب @ لإضافة أوراق.",
    modelClickChoose: "انقر لاختيار نموذج",
    modelOnlyOne: "تم تكوين نموذج واحد فقط",
    conversationLoaded: "تم تحميل المحادثة",
    noEditableLatestPrompt: "لا يوجد آخر سؤال قابل للتحرير",
    referencePickerReady: "محدد المراجع جاهز. اكتب بعد @ للبحث عن أوراق.",
    paperAlreadySelected: "تم اختيار هذه الورقة مسبقًا",
    paperContextAdded: (n, max) => `تمت إضافة سياق الورقة (${n}/${max})`,
    cancelled: "تم الإلغاء",
    addTextPopupTitle: "إضافة النص المحدد إلى لوحة LLM",
    addTextTitle: "تضمين النص المحدد من القارئ",
    deleteAll: "حذف الكل",
    deleteAllConfirm: "تم حذف جميع المحادثات",
    pinConversation: "تثبيت المحادثة",
    unpinConversation: "إلغاء التثبيت",
    renameConversation: "إعادة التسمية",
    deleteUnpinned: "حذف غير المثبتة",
    deleteAllHistory: "حذف الكل",
    cancelAction: "إلغاء",
    confirmDeleteTitle: "حذف المحادثات",
    trFormatDisclaimer:
      "⚠ بسبب تعقيد تنسيق PDF، قد تظهر أحيانًا اختلافات في التخطيط أو النمط في الناتج المترجم. نواصل تحسين ذلك.",
    trEnvNotReady: "بيئة الترجمة غير جاهزة",
    trQps: "QPS (طلبات/ثانية)",
    trPoolMaxWorker: "العمال المتوازيون",
    trSkipReferencesAuto: "اكتشاف المراجع وتجاوزها تلقائيًا",
    trKeepAppendixTranslated: "متابعة ترجمة الملاحق",
    trProtectAuthorBlock: "حماية معلومات المؤلف/الانتماء",
    trDisableRichTextTranslate: "تعطيل ترجمة النص المنسق",
    trEnhanceCompatibility: "تحسين التوافق",
    trTranslateTableText: "ترجمة نص الجداول",
    trOCR: "فرض وضع OCR",
    trAutoOCR: "وضع OCR تلقائي",
    trSaveGlossary: "حفظ قاموس المصطلحات تلقائيًا",
    trDisableGlossary: "تعطيل استخراج القاموس",
    trFontFamily: "عائلة الخط الأساسية",
    trFontFamilyAuto: "تلقائي",
    trFontFamilySerif: "Serif",
    trFontFamilySansSerif: "Sans-serif",
    trFontFamilyScript: "Script",
    trHintPoolMaxWorker:
      "عدد الفقرات المترجمة بالتوازي. قيمة أعلى تعني سرعة أكبر لكنها قد تصطدم بحدود API.",
    trHintSkipReferences: "يكتشف قسم المراجع من العنوان ويتجاوز ترجمته.",
    trHintKeepAppendix: "يواصل ترجمة الملاحق بعد قسم المراجع.",
    trHintProtectAuthor:
      "يحافظ على أسماء المؤلفين والبريد والانتماءات في صفحة العنوان.",
    trHintDisableRichText:
      "يعطل الحفاظ على الغامق/المائل. الناتج أنظف لكنه يفقد التنسيق.",
    trHintEnhanceCompat: "يستخدم عرض PDF أكثر تحفظًا لتحسين التوافق مع القراء.",
    trHintTranslateTable: "يترجم النص داخل الجداول. قد تختل الجداول المعقدة.",
    trHintOcr:
      "يفرض OCR على كل الصفحات. مفيد لملفات PDF الممسوحة أو ذات طبقة نص تالفة.",
    trHintAutoOcr: "يكتشف ملفات PDF الممسوحة تلقائيًا ويفعل OCR عند الحاجة.",
    trHintSaveGlossary: "يستخرج ويحفظ قاموس مصطلحات تلقائيًا أثناء الترجمة.",
    trHintDisableGlossary: "يعطل استخراج المصطلحات تلقائيًا بالكامل.",
    trHintFontFamily:
      "تلقائي=اختيار المحرك؛ Serif=Song/Times؛ Sans-serif=Hei/Arial؛ Script=مائل/يدوي.",
    trHintQps: "طلبات API في الثانية. المجانية: 3-5؛ المدفوعة: 10-20.",
    scrollToBottom: "التمرير إلى الأسفل",
    requiredOutputFolder: "مطلوب: اختر مجلد الإخراج",
    expandFigures: "توسيع الصور",
    collapseFigures: "طي الصور",
    clearSelectedScreenshots: "مسح لقطات الشاشة المحددة",
    selectedScreenshotPreview: "معاينة لقطة الشاشة المحددة",
    selectFigureScreenshot: "اختيار لقطة شاشة لصورة",
    expandFiles: "توسيع الملفات",
    collapseFiles: "طي الملفات",
    clearUploadedFiles: "مسح الملفات المرفوعة",
    contextActions: "إجراءات السياق",
    newConversation: "محادثة جديدة",
    expandPapers: "توسيع الأوراق",
    collapsePapers: "طي الأوراق",
    supplementalPaper: "ورقة إضافية",
    figureBadgeIcon: "صورة",
    paperBadgeIcon: "مرجع",
    fileBadgeIcon: "ملف",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `صور (${count}/${max})` : `صور (${count})`,
    fileCount: (count) => `ملفات (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `أوراق (${count}/${max})` : `أوراق (${count})`,
    screenshotNth: (n) => `لقطة شاشة ${n}`,
    openAttachment: (name) => `فتح ${name}`,
    fileFallback: "ملف",
    usingCachedDocumentContext: "جارٍ استخدام سياق المستند المخزن مؤقتًا",
    rebuildingDocumentContext: "جارٍ إعادة بناء سياق المستند...",
    waitForCurrentResponse: "انتظر حتى ينتهي الرد الحالي",
    noRetryableResponseFound: "لا يوجد رد يمكن إعادة المحاولة عليه",
    nothingToRetryLatestTurn: "لا شيء لإعادة المحاولة في آخر دور",
    preparingRetry: "جارٍ تحضير إعادة المحاولة...",
    preparingRequest: "جارٍ تحضير الطلب...",
    noResponse: "لا يوجد رد.",
    noAssistantTextSelected: "لم يتم تحديد نص من المساعد",
    copiedResponse: "تم نسخ الرد",
    createdNewNote: "تم إنشاء ملاحظة جديدة",
    failedToCreateNote: "فشل إنشاء الملاحظة",
    editingLatestPrompt: "جارٍ تحرير آخر سؤال",
    noChatHistoryDetected: "لم يتم العثور على سجل محادثة.",
    copiedChatAsMd: "تم نسخ المحادثة كـ Markdown",
    savedChatHistoryToNewNote: "تم حفظ سجل المحادثة في ملاحظة جديدة",
    pinFilesPanel: "تثبيت لوحة الملفات",
    pinFiguresPanel: "تثبيت لوحة الصور",
    conversationRestored: "تمت استعادة المحادثة",
    noActiveLibraryForDeletion: "لا توجد مكتبة نشطة للحذف",
    cannotDeleteActiveConversation: "لا يمكن حذف المحادثة النشطة الآن",
    conversationDeletedUndo: "تم حذف المحادثة. يمكن التراجع.",
    reusedExistingEmptyPaperChat: "تمت إعادة استخدام محادثة ورقة فارغة",
    failedToCreateNewPaperConversation: "فشل إنشاء محادثة ورقة جديدة",
    startedNewPaperChat: "تم بدء محادثة ورقة جديدة",
    noActiveLibraryForGlobalConversation: "لا توجد مكتبة نشطة للمحادثة العامة",
    failedToCreateConversation: "فشل إنشاء المحادثة",
    waitForResponseBeforeSwitching: "انتظر انتهاء الرد قبل التبديل",
    selectRegion: "حدد منطقة...",
    selectionCancelled: "تم إلغاء التحديد",
    screenshotFailed: "فشل التقاط الشاشة",
    copied: "تم النسخ",
    figuresCleared: "تم مسح الصور",
    filesCleared: "تم مسح الملفات",
    paperContextDismissed: "تمت إزالة سياق الورقة",
    selectedTextRemoved: "تمت إزالة النص المحدد",
    cleared: "تم المسح",
    textContextLimit: "سياق النص حتى 5",
    clearSelectedContext: "مسح السياق المحدد",
    shortcutPromptEmpty: "لا يمكن أن يكون موجه الاختصار فارغًا",
    dragToReorder: "اسحب لإعادة الترتيب",
    trLogFullPath: "المسار الكامل",
    trLogOutputFormat: (mono, dual) =>
      `تنسيق الإخراج: أحادي=${mono} | ثنائي=${dual}`,
    trLogResolvingCredentials: "جارٍ حل بيانات اعتماد النموذج...",
    trLogCheckingEnvironment: "جارٍ فحص بيئة الترجمة...",
    trLogEnvironmentNotReady: (status) =>
      `البيئة غير جاهزة (الحالة: ${status})`,
    trLogInstallEnvironmentInstruction:
      "انقر زر 'تثبيت البيئة' لإعداد بيئة Python",
    trLogBridgeError: (message) => `خطأ الجسر: ${message}`,
    trLogTotalTime: (duration) => `الوقت الإجمالي: ${duration}`,
    trLogJobFinished: "اكتملت المهمة",
    trLogEngineStarted: "تم بدء محرك الترجمة...",
    trLogPausedCached: "تم إيقاف الترجمة مؤقتًا وحفظ التقدم",
    trLogLaunchingEngine: "جارٍ تشغيل محرك الترجمة...",
    trLogStackTrace: "تتبع المكدس",
  },
  "hi-IN": {
    title: "AIdea",
    copyChatMd: "चैट को Markdown के रूप में कॉपी करें",
    saveChatAsNote: "चैट को नोट के रूप में सहेजें",
    statusNoContext:
      "कोई सक्रिय पेपर संदर्भ नहीं है। पेपर जोड़ने के लिए @ टाइप करें।",
    modelClickChoose: "मॉडल चुनने के लिए क्लिक करें",
    modelOnlyOne: "केवल एक मॉडल कॉन्फ़िगर है",
    conversationLoaded: "बातचीत लोड हुई",
    noEditableLatestPrompt: "संपादित करने योग्य नवीनतम प्रश्न नहीं है",
    referencePickerReady:
      "संदर्भ चयन तैयार है। पेपर खोजने के लिए @ के बाद टाइप करें।",
    paperAlreadySelected: "पेपर पहले से चुना गया है",
    paperContextAdded: (n, max) => `पेपर संदर्भ जोड़ा गया (${n}/${max})`,
    cancelled: "रद्द किया गया",
    addTextPopupTitle: "चयनित टेक्स्ट को LLM पैनल में जोड़ें",
    addTextTitle: "रीडर में चयनित टेक्स्ट शामिल करें",
    deleteAll: "सब हटाएँ",
    deleteAllConfirm: "सभी बातचीत हटाई गईं",
    pinConversation: "बातचीत पिन करें",
    unpinConversation: "पिन हटाएँ",
    renameConversation: "नाम बदलें",
    deleteUnpinned: "अनपिन हटाएँ",
    deleteAllHistory: "सब हटाएँ",
    cancelAction: "रद्द करें",
    confirmDeleteTitle: "बातचीत हटाएँ",
    trFormatDisclaimer:
      "⚠ PDF फ़ॉर्मेट की जटिलता के कारण अनुवादित आउटपुट में कभी-कभी लेआउट या शैली में अंतर आ सकता है। हम इसे लगातार सुधार रहे हैं।",
    trEnvNotReady: "अनुवाद वातावरण तैयार नहीं है",
    trQps: "QPS (प्रति सेकंड अनुरोध)",
    trPoolMaxWorker: "समानांतर वर्कर",
    trSkipReferencesAuto: "संदर्भों को स्वतः पहचानकर छोड़ें",
    trKeepAppendixTranslated: "परिशिष्टों का अनुवाद जारी रखें",
    trProtectAuthorBlock: "लेखक/संस्था जानकारी सुरक्षित रखें",
    trDisableRichTextTranslate: "रिच-टेक्स्ट अनुवाद बंद करें",
    trEnhanceCompatibility: "संगतता बढ़ाएँ",
    trTranslateTableText: "तालिका टेक्स्ट का अनुवाद करें",
    trOCR: "OCR मोड बाध्य करें",
    trAutoOCR: "स्वचालित OCR मोड",
    trSaveGlossary: "स्वचालित शब्दावली सहेजें",
    trDisableGlossary: "शब्दावली निष्कर्षण बंद करें",
    trFontFamily: "मुख्य फ़ॉन्ट परिवार",
    trFontFamilyAuto: "स्वतः",
    trFontFamilySerif: "Serif",
    trFontFamilySansSerif: "Sans-serif",
    trFontFamilyScript: "Script",
    trHintPoolMaxWorker:
      "एक साथ अनुवादित पैराग्राफ़ों की संख्या। अधिक मान तेज़ है, पर API सीमा लग सकती है।",
    trHintSkipReferences:
      "शीर्षक से References अनुभाग पहचानकर उन पृष्ठों को छोड़ता है।",
    trHintKeepAppendix:
      "References के बाद आने वाले परिशिष्टों का अनुवाद जारी रखता है।",
    trHintProtectAuthor:
      "शीर्षक पृष्ठ पर लेखक, ईमेल और संस्था जानकारी को अनुवाद से बचाता है।",
    trHintDisableRichText:
      "बोल्ड/इटैलिक शैली संरक्षण बंद करता है। आउटपुट साफ़ होगा पर फ़ॉर्मेट खो सकता है।",
    trHintEnhanceCompat:
      "अधिक संगत PDF रेंडरिंग का उपयोग करता है। लेआउट गुणवत्ता थोड़ी घट सकती है।",
    trHintTranslateTable:
      "तालिका के अंदर टेक्स्ट का अनुवाद करता है। जटिल तालिकाएँ बिगड़ सकती हैं।",
    trHintOcr:
      "सभी पृष्ठों पर OCR बाध्य करता है। स्कैन या खराब टेक्स्ट-लेयर PDF के लिए।",
    trHintAutoOcr: "स्कैन PDF स्वतः पहचानता है और ज़रूरत पर OCR सक्षम करता है।",
    trHintSaveGlossary: "अनुवाद के दौरान शब्दावली स्वतः निकालकर सहेजता है।",
    trHintDisableGlossary: "स्वचालित शब्दावली निष्कर्षण पूरी तरह बंद करता है।",
    trHintFontFamily:
      "स्वतः=इंजन चुनेगा; Serif=Song/Times; Sans-serif=Hei/Arial; Script=इटैलिक/हस्तलिपि।",
    trHintQps: "प्रति सेकंड API अनुरोध। मुफ़्त API: 3-5; पेड API: 10-20।",
    scrollToBottom: "नीचे स्क्रॉल करें",
    requiredOutputFolder: "आवश्यक: आउटपुट फ़ोल्डर चुनें",
    expandFigures: "चित्र फैलाएँ",
    collapseFigures: "चित्र समेटें",
    clearSelectedScreenshots: "चयनित स्क्रीनशॉट साफ़ करें",
    selectedScreenshotPreview: "चयनित स्क्रीनशॉट पूर्वावलोकन",
    selectFigureScreenshot: "चित्र स्क्रीनशॉट चुनें",
    expandFiles: "फ़ाइलें फैलाएँ",
    collapseFiles: "फ़ाइलें समेटें",
    clearUploadedFiles: "अपलोड फ़ाइलें साफ़ करें",
    contextActions: "संदर्भ क्रियाएँ",
    newConversation: "नई बातचीत",
    expandPapers: "पेपर फैलाएँ",
    collapsePapers: "पेपर समेटें",
    supplementalPaper: "पूरक पेपर",
    figureBadgeIcon: "चित्र",
    paperBadgeIcon: "संदर्भ",
    fileBadgeIcon: "फ़ाइल",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `चित्र (${count}/${max})` : `चित्र (${count})`,
    fileCount: (count) => `फ़ाइलें (${count})`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `पेपर (${count}/${max})` : `पेपर (${count})`,
    screenshotNth: (n) => `स्क्रीनशॉट ${n}`,
    openAttachment: (name) => `${name} खोलें`,
    fileFallback: "फ़ाइल",
    usingCachedDocumentContext: "कैश किया दस्तावेज़ संदर्भ उपयोग हो रहा है",
    rebuildingDocumentContext: "दस्तावेज़ संदर्भ फिर बनाया जा रहा है...",
    waitForCurrentResponse: "वर्तमान उत्तर समाप्त होने तक प्रतीक्षा करें",
    noRetryableResponseFound: "दोबारा कोशिश करने योग्य उत्तर नहीं मिला",
    nothingToRetryLatestTurn: "नवीनतम चरण में दोबारा कोशिश करने को कुछ नहीं",
    preparingRetry: "दोबारा कोशिश की तैयारी...",
    preparingRequest: "अनुरोध की तैयारी...",
    noResponse: "कोई उत्तर नहीं।",
    noAssistantTextSelected: "कोई assistant टेक्स्ट चयनित नहीं",
    copiedResponse: "उत्तर कॉपी हुआ",
    createdNewNote: "नया नोट बनाया गया",
    failedToCreateNote: "नोट बनाने में विफल",
    editingLatestPrompt: "नवीनतम प्रश्न संपादित हो रहा है",
    noChatHistoryDetected: "चैट इतिहास नहीं मिला।",
    copiedChatAsMd: "चैट Markdown के रूप में कॉपी हुई",
    savedChatHistoryToNewNote: "चैट इतिहास नए नोट में सहेजा गया",
    pinFilesPanel: "फ़ाइल पैनल पिन करें",
    pinFiguresPanel: "चित्र पैनल पिन करें",
    conversationRestored: "बातचीत पुनर्स्थापित हुई",
    noActiveLibraryForDeletion: "हटाने के लिए कोई सक्रिय लाइब्रेरी नहीं",
    cannotDeleteActiveConversation: "सक्रिय बातचीत अभी हटाई नहीं जा सकती",
    conversationDeletedUndo: "बातचीत हटाई गई। पूर्ववत उपलब्ध है।",
    reusedExistingEmptyPaperChat: "मौजूदा खाली पेपर चैट फिर उपयोग की गई",
    failedToCreateNewPaperConversation: "नई पेपर बातचीत बनाने में विफल",
    startedNewPaperChat: "नई पेपर चैट शुरू हुई",
    noActiveLibraryForGlobalConversation:
      "वैश्विक बातचीत के लिए सक्रिय लाइब्रेरी नहीं",
    failedToCreateConversation: "बातचीत बनाने में विफल",
    waitForResponseBeforeSwitching:
      "बदलने से पहले उत्तर पूरा होने तक प्रतीक्षा करें",
    selectRegion: "क्षेत्र चुनें...",
    selectionCancelled: "चयन रद्द हुआ",
    screenshotFailed: "स्क्रीनशॉट विफल",
    copied: "कॉपी हुआ",
    figuresCleared: "चित्र साफ़ हुए",
    filesCleared: "फ़ाइलें साफ़ हुईं",
    paperContextDismissed: "पेपर संदर्भ हटाया गया",
    selectedTextRemoved: "चयनित टेक्स्ट हटाया गया",
    cleared: "साफ़ हुआ",
    textContextLimit: "टेक्स्ट संदर्भ अधिकतम 5",
    clearSelectedContext: "चयनित संदर्भ साफ़ करें",
    shortcutPromptEmpty: "शॉर्टकट प्रॉम्प्ट खाली नहीं हो सकता",
    dragToReorder: "क्रम बदलने के लिए खींचें",
    trLogFullPath: "पूरा पथ",
    trLogOutputFormat: (mono, dual) =>
      `आउटपुट फ़ॉर्मेट: Mono=${mono} | Dual=${dual}`,
    trLogResolvingCredentials: "मॉडल क्रेडेंशियल हल हो रहे हैं...",
    trLogCheckingEnvironment: "अनुवाद वातावरण जाँचा जा रहा है...",
    trLogEnvironmentNotReady: (status) =>
      `वातावरण तैयार नहीं (स्थिति: ${status})`,
    trLogInstallEnvironmentInstruction:
      "Python वातावरण सेट करने के लिए 'Install Environment' बटन क्लिक करें",
    trLogBridgeError: (message) => `ब्रिज त्रुटि: ${message}`,
    trLogTotalTime: (duration) => `कुल समय: ${duration}`,
    trLogJobFinished: "कार्य पूरा हुआ",
    trLogEngineStarted: "अनुवाद इंजन शुरू हुआ...",
    trLogPausedCached: "अनुवाद रोका गया; प्रगति कैश हुई",
    trLogLaunchingEngine: "अनुवाद इंजन शुरू किया जा रहा है...",
    trLogStackTrace: "स्टैक ट्रेस",
  },
};

const PANEL_I18N_RUNTIME_OVERRIDES: Partial<
  Record<PanelLang, Partial<PanelI18n>>
> = {
  "zh-TW": {
    currentPdfPage: (page) => `目前 PDF，第 ${page} 頁`,
    selectionTranslateColdStart: "冷啟動中...",
    selectionTranslateTranslating: "翻譯中...",
    selectionTranslateFailed: "翻譯失敗",
    selectionTranslateNoContext: "上下文過長，正在進行輕量翻譯...",
    selectionTranslateWriteToAnnotation: "將譯文寫入標註",
    selectionTranslateColdStartStatus: "選取翻譯冷啟動中...",
    selectionTranslateCacheReady: "選取翻譯快取已就緒",
    addToNote: "加入筆記",
    addingToNote: "加入中...",
    addedToNote: "已加入",
    addToNoteFailed: "加入失敗",
    screenshotSelectionInstruction: "點擊並拖曳以選擇區域，放開後完成",
    cancelEsc: "取消 (Esc)",
    pinTextContext: "釘選文字上下文",
    unpinTextContext: "取消釘選文字上下文",
    unpinNamedContext: (name) => `取消釘選 ${name}`,
    expandPdfs: "點擊展開 PDF",
    collapsePdfs: "點擊收合 PDF",
    untitledChat: "未命名對話",
    paperChat: "論文對話",
    standaloneChat: "獨立對話",
    deletedConversation: (title) => `已刪除「${title}」`,
    renameConversationAria: (title) => `重新命名 ${title}`,
    pinConversationAria: (title) => `釘選 ${title}`,
    unpinConversationAria: (title) => `取消釘選 ${title}`,
    deleteConversation: "刪除對話",
    deleteConversationAria: (title) => `刪除 ${title}`,
    conversationNamePlaceholder: "對話名稱...",
    noPapersMatched: "沒有符合的論文。",
    pdfCount: (count) => `${count} 個 PDF`,
    pdfAttachment: "PDF 附件",
  },
  "ja-JP": {
    currentPdfPage: (page) => `現在の PDF、${page} ページ`,
    selectionTranslateColdStart: "コールドスタート中...",
    selectionTranslateTranslating: "翻訳中...",
    selectionTranslateFailed: "翻訳に失敗しました",
    selectionTranslateNoContext: "文書コンテキストなしで翻訳中...",
    selectionTranslateWriteToAnnotation: "翻訳を注釈に書き込む",
    selectionTranslateColdStartStatus: "選択翻訳を準備中...",
    selectionTranslateCacheReady: "選択翻訳のキャッシュ準備完了",
    addToNote: "ノートに追加",
    addingToNote: "追加中...",
    addedToNote: "追加済み",
    addToNoteFailed: "追加に失敗しました",
    screenshotSelectionInstruction:
      "クリックしてドラッグし、範囲を選択して離します",
    cancelEsc: "キャンセル (Esc)",
    pinTextContext: "テキストコンテキストをピン留め",
    unpinTextContext: "テキストコンテキストのピン留めを解除",
    unpinNamedContext: (name) => `${name} のピン留めを解除`,
    expandPdfs: "クリックして PDF を展開",
    collapsePdfs: "クリックして PDF を折りたたむ",
    untitledChat: "無題のチャット",
    paperChat: "論文チャット",
    standaloneChat: "単独チャット",
    deletedConversation: (title) => `「${title}」を削除しました`,
    renameConversationAria: (title) => `${title} の名前を変更`,
    pinConversationAria: (title) => `${title} をピン留め`,
    unpinConversationAria: (title) => `${title} のピン留めを解除`,
    deleteConversation: "会話を削除",
    deleteConversationAria: (title) => `${title} を削除`,
    conversationNamePlaceholder: "会話名...",
    noPapersMatched: "一致する論文はありません。",
    pdfCount: (count) => `${count} 件の PDF`,
    pdfAttachment: "PDF 添付ファイル",
  },
  "ko-KR": {
    currentPdfPage: (page) => `현재 PDF, ${page}페이지`,
    selectionTranslateColdStart: "콜드 스타트 중...",
    selectionTranslateTranslating: "번역 중...",
    selectionTranslateFailed: "번역 실패",
    selectionTranslateNoContext: "문서 컨텍스트 없이 번역 중...",
    selectionTranslateWriteToAnnotation: "번역을 주석에 쓰기",
    selectionTranslateColdStartStatus: "선택 번역 준비 중...",
    selectionTranslateCacheReady: "선택 번역 캐시 준비 완료",
    addToNote: "노트에 추가",
    addingToNote: "추가 중...",
    addedToNote: "추가됨",
    addToNoteFailed: "추가 실패",
    screenshotSelectionInstruction:
      "클릭하고 드래그해 영역을 선택한 뒤 놓으세요",
    cancelEsc: "취소 (Esc)",
    pinTextContext: "텍스트 컨텍스트 고정",
    unpinTextContext: "텍스트 컨텍스트 고정 해제",
    unpinNamedContext: (name) => `${name} 고정 해제`,
    expandPdfs: "PDF 펼치기",
    collapsePdfs: "PDF 접기",
    untitledChat: "제목 없는 채팅",
    paperChat: "논문 채팅",
    standaloneChat: "독립 채팅",
    deletedConversation: (title) => `"${title}" 삭제됨`,
    renameConversationAria: (title) => `${title} 이름 변경`,
    pinConversationAria: (title) => `${title} 고정`,
    unpinConversationAria: (title) => `${title} 고정 해제`,
    deleteConversation: "대화 삭제",
    deleteConversationAria: (title) => `${title} 삭제`,
    conversationNamePlaceholder: "대화 이름...",
    noPapersMatched: "일치하는 논문이 없습니다.",
    pdfCount: (count) => `PDF ${count}개`,
    pdfAttachment: "PDF 첨부 파일",
  },
  "fr-FR": {
    currentPdfPage: (page) => `PDF actuel, page ${page}`,
    selectionTranslateColdStart: "Demarrage...",
    selectionTranslateTranslating: "Traduction...",
    selectionTranslateFailed: "Echec de la traduction",
    selectionTranslateNoContext: "Traduction sans contexte du document...",
    selectionTranslateWriteToAnnotation: "Ajouter la traduction a l'annotation",
    selectionTranslateColdStartStatus:
      "Demarrage de la traduction de selection...",
    selectionTranslateCacheReady: "Cache de traduction de selection pret",
    addToNote: "Ajouter a la note",
    addingToNote: "Ajout...",
    addedToNote: "Ajoute",
    addToNoteFailed: "Echec de l'ajout",
    screenshotSelectionInstruction:
      "Cliquez et faites glisser pour selectionner une zone, puis relachez",
    cancelEsc: "Annuler (Esc)",
    pinTextContext: "Epingler le contexte texte",
    unpinTextContext: "Retirer l'epingle du contexte texte",
    unpinNamedContext: (name) => `Retirer l'epingle de ${name}`,
    expandPdfs: "Cliquer pour developper les PDF",
    collapsePdfs: "Cliquer pour reduire les PDF",
    untitledChat: "Conversation sans titre",
    paperChat: "Conversation d'article",
    standaloneChat: "Conversation autonome",
    deletedConversation: (title) => `"${title}" supprimee`,
    renameConversationAria: (title) => `Renommer ${title}`,
    pinConversationAria: (title) => `Epingler ${title}`,
    unpinConversationAria: (title) => `Retirer l'epingle de ${title}`,
    deleteConversation: "Supprimer la conversation",
    deleteConversationAria: (title) => `Supprimer ${title}`,
    conversationNamePlaceholder: "Nom de la conversation...",
    noPapersMatched: "Aucun article correspondant.",
    pdfCount: (count) => `${count} PDF`,
    pdfAttachment: "Piece jointe PDF",
  },
  "de-DE": {
    currentPdfPage: (page) => `Aktuelles PDF, Seite ${page}`,
    selectionTranslateColdStart: "Start wird vorbereitet...",
    selectionTranslateTranslating: "Uebersetzung...",
    selectionTranslateFailed: "Uebersetzung fehlgeschlagen",
    selectionTranslateNoContext: "Uebersetzung ohne Dokumentkontext...",
    selectionTranslateWriteToAnnotation:
      "Uebersetzung in die Anmerkung schreiben",
    selectionTranslateColdStartStatus:
      "Auswahluebersetzung wird vorbereitet...",
    selectionTranslateCacheReady: "Cache fuer Auswahluebersetzung bereit",
    addToNote: "Zur Notiz hinzufuegen",
    addingToNote: "Wird hinzugefuegt...",
    addedToNote: "Hinzugefuegt",
    addToNoteFailed: "Hinzufuegen fehlgeschlagen",
    screenshotSelectionInstruction:
      "Klicken und ziehen, um einen Bereich auszuwaehlen, dann loslassen",
    cancelEsc: "Abbrechen (Esc)",
    pinTextContext: "Textkontext anheften",
    unpinTextContext: "Textkontext loesen",
    unpinNamedContext: (name) => `${name} loesen`,
    expandPdfs: "Klicken, um PDFs auszuklappen",
    collapsePdfs: "Klicken, um PDFs einzuklappen",
    untitledChat: "Unbenannter Chat",
    paperChat: "Paper-Chat",
    standaloneChat: "Eigenstaendiger Chat",
    deletedConversation: (title) => `"${title}" geloescht`,
    renameConversationAria: (title) => `${title} umbenennen`,
    pinConversationAria: (title) => `${title} anheften`,
    unpinConversationAria: (title) => `${title} loesen`,
    deleteConversation: "Unterhaltung loeschen",
    deleteConversationAria: (title) => `${title} loeschen`,
    conversationNamePlaceholder: "Name der Unterhaltung...",
    noPapersMatched: "Keine passenden Papers gefunden.",
    pdfCount: (count) => `${count} PDFs`,
    pdfAttachment: "PDF-Anhang",
  },
  "es-ES": {
    currentPdfPage: (page) => `PDF actual, pagina ${page}`,
    selectionTranslateColdStart: "Iniciando...",
    selectionTranslateTranslating: "Traduciendo...",
    selectionTranslateFailed: "Error de traduccion",
    selectionTranslateNoContext: "Traduciendo sin contexto del documento...",
    selectionTranslateWriteToAnnotation:
      "Guardar la traduccion en la anotacion",
    selectionTranslateColdStartStatus: "Iniciando traduccion de seleccion...",
    selectionTranslateCacheReady: "Cache de traduccion de seleccion listo",
    addToNote: "Anadir a la nota",
    addingToNote: "Anadiendo...",
    addedToNote: "Anadido",
    addToNoteFailed: "No se pudo anadir",
    screenshotSelectionInstruction:
      "Haz clic y arrastra para seleccionar una region, luego suelta",
    cancelEsc: "Cancelar (Esc)",
    pinTextContext: "Fijar contexto de texto",
    unpinTextContext: "Desfijar contexto de texto",
    unpinNamedContext: (name) => `Desfijar ${name}`,
    expandPdfs: "Haz clic para expandir PDF",
    collapsePdfs: "Haz clic para contraer PDF",
    untitledChat: "Chat sin titulo",
    paperChat: "Chat de articulo",
    standaloneChat: "Chat independiente",
    deletedConversation: (title) => `"${title}" eliminado`,
    renameConversationAria: (title) => `Cambiar nombre de ${title}`,
    pinConversationAria: (title) => `Fijar ${title}`,
    unpinConversationAria: (title) => `Desfijar ${title}`,
    deleteConversation: "Eliminar conversacion",
    deleteConversationAria: (title) => `Eliminar ${title}`,
    conversationNamePlaceholder: "Nombre de la conversacion...",
    noPapersMatched: "No hay articulos coincidentes.",
    pdfCount: (count) => `${count} PDF`,
    pdfAttachment: "Adjunto PDF",
  },
  "ru-RU": {
    currentPdfPage: (page) => `Текущий PDF, страница ${page}`,
    selectionTranslateColdStart: "Запуск...",
    selectionTranslateTranslating: "Перевод...",
    selectionTranslateFailed: "Ошибка перевода",
    selectionTranslateNoContext: "Перевод без контекста документа...",
    selectionTranslateWriteToAnnotation: "Записать перевод в аннотацию",
    selectionTranslateColdStartStatus: "Запуск перевода выделения...",
    selectionTranslateCacheReady: "Кеш перевода выделения готов",
    addToNote: "Добавить в заметку",
    addingToNote: "Добавление...",
    addedToNote: "Добавлено",
    addToNoteFailed: "Не удалось добавить",
    screenshotSelectionInstruction:
      "Нажмите и перетащите, чтобы выбрать область, затем отпустите",
    cancelEsc: "Отмена (Esc)",
    pinTextContext: "Закрепить текстовый контекст",
    unpinTextContext: "Открепить текстовый контекст",
    unpinNamedContext: (name) => `Открепить ${name}`,
    expandPdfs: "Нажмите, чтобы раскрыть PDF",
    collapsePdfs: "Нажмите, чтобы свернуть PDF",
    untitledChat: "Безымянный чат",
    paperChat: "Чат по статье",
    standaloneChat: "Отдельный чат",
    deletedConversation: (title) => `"${title}" удален`,
    renameConversationAria: (title) => `Переименовать ${title}`,
    pinConversationAria: (title) => `Закрепить ${title}`,
    unpinConversationAria: (title) => `Открепить ${title}`,
    deleteConversation: "Удалить диалог",
    deleteConversationAria: (title) => `Удалить ${title}`,
    conversationNamePlaceholder: "Название диалога...",
    noPapersMatched: "Подходящие статьи не найдены.",
    pdfCount: (count) => `${count} PDF`,
    pdfAttachment: "PDF-вложение",
  },
  "pt-BR": {
    currentPdfPage: (page) => `PDF atual, pagina ${page}`,
    selectionTranslateColdStart: "Iniciando...",
    selectionTranslateTranslating: "Traduzindo...",
    selectionTranslateFailed: "Falha na traducao",
    selectionTranslateNoContext: "Traduzindo sem contexto do documento...",
    selectionTranslateWriteToAnnotation: "Salvar a traducao na anotacao",
    selectionTranslateColdStartStatus: "Iniciando traducao da selecao...",
    selectionTranslateCacheReady: "Cache da traducao da selecao pronto",
    addToNote: "Adicionar a nota",
    addingToNote: "Adicionando...",
    addedToNote: "Adicionado",
    addToNoteFailed: "Falha ao adicionar",
    screenshotSelectionInstruction:
      "Clique e arraste para selecionar uma regiao, depois solte",
    cancelEsc: "Cancelar (Esc)",
    pinTextContext: "Fixar contexto de texto",
    unpinTextContext: "Desafixar contexto de texto",
    unpinNamedContext: (name) => `Desafixar ${name}`,
    expandPdfs: "Clique para expandir PDFs",
    collapsePdfs: "Clique para recolher PDFs",
    untitledChat: "Chat sem titulo",
    paperChat: "Chat do artigo",
    standaloneChat: "Chat independente",
    deletedConversation: (title) => `"${title}" excluida`,
    renameConversationAria: (title) => `Renomear ${title}`,
    pinConversationAria: (title) => `Fixar ${title}`,
    unpinConversationAria: (title) => `Desafixar ${title}`,
    deleteConversation: "Excluir conversa",
    deleteConversationAria: (title) => `Excluir ${title}`,
    conversationNamePlaceholder: "Nome da conversa...",
    noPapersMatched: "Nenhum artigo encontrado.",
    pdfCount: (count) => `${count} PDFs`,
    pdfAttachment: "Anexo PDF",
  },
  "ar-SA": {
    currentPdfPage: (page) => `ملف PDF الحالي، الصفحة ${page}`,
    selectionTranslateColdStart: "جار بدء التشغيل...",
    selectionTranslateTranslating: "جار الترجمة...",
    selectionTranslateFailed: "فشلت الترجمة",
    selectionTranslateNoContext: "جار الترجمة دون سياق المستند...",
    selectionTranslateWriteToAnnotation: "كتابة الترجمة في التعليق التوضيحي",
    selectionTranslateColdStartStatus: "جار تجهيز ترجمة التحديد...",
    selectionTranslateCacheReady: "ذاكرة ترجمة التحديد جاهزة",
    addToNote: "إضافة إلى الملاحظة",
    addingToNote: "جار الإضافة...",
    addedToNote: "تمت الإضافة",
    addToNoteFailed: "فشلت الإضافة",
    screenshotSelectionInstruction: "انقر واسحب لتحديد منطقة، ثم اترك الزر",
    cancelEsc: "إلغاء (Esc)",
    pinTextContext: "تثبيت سياق النص",
    unpinTextContext: "إلغاء تثبيت سياق النص",
    unpinNamedContext: (name) => `إلغاء تثبيت ${name}`,
    expandPdfs: "انقر لتوسيع ملفات PDF",
    collapsePdfs: "انقر لطي ملفات PDF",
    untitledChat: "محادثة بلا عنوان",
    paperChat: "محادثة الورقة",
    standaloneChat: "محادثة مستقلة",
    deletedConversation: (title) => `تم حذف "${title}"`,
    renameConversationAria: (title) => `إعادة تسمية ${title}`,
    pinConversationAria: (title) => `تثبيت ${title}`,
    unpinConversationAria: (title) => `إلغاء تثبيت ${title}`,
    deleteConversation: "حذف المحادثة",
    deleteConversationAria: (title) => `حذف ${title}`,
    conversationNamePlaceholder: "اسم المحادثة...",
    noPapersMatched: "لا توجد أوراق مطابقة.",
    pdfCount: (count) => `${count} ملفات PDF`,
    pdfAttachment: "مرفق PDF",
  },
  "hi-IN": {
    currentPdfPage: (page) => `वर्तमान PDF, पृष्ठ ${page}`,
    selectionTranslateColdStart: "शुरू हो रहा है...",
    selectionTranslateTranslating: "अनुवाद हो रहा है...",
    selectionTranslateFailed: "अनुवाद विफल",
    selectionTranslateNoContext: "दस्तावेज़ संदर्भ के बिना अनुवाद हो रहा है...",
    selectionTranslateWriteToAnnotation: "अनुवाद को एनोटेशन में लिखें",
    selectionTranslateColdStartStatus: "चयन अनुवाद शुरू हो रहा है...",
    selectionTranslateCacheReady: "चयन अनुवाद कैश तैयार है",
    addToNote: "नोट में जोड़ें",
    addingToNote: "जोड़ा जा रहा है...",
    addedToNote: "जोड़ा गया",
    addToNoteFailed: "जोड़ना विफल",
    screenshotSelectionInstruction:
      "क्षेत्र चुनने के लिए क्लिक करके खींचें, फिर छोड़ें",
    cancelEsc: "रद्द करें (Esc)",
    pinTextContext: "टेक्स्ट संदर्भ पिन करें",
    unpinTextContext: "टेक्स्ट संदर्भ अनपिन करें",
    unpinNamedContext: (name) => `${name} अनपिन करें`,
    expandPdfs: "PDF फैलाने के लिए क्लिक करें",
    collapsePdfs: "PDF समेटने के लिए क्लिक करें",
    untitledChat: "शीर्षकहीन चैट",
    paperChat: "पेपर चैट",
    standaloneChat: "स्वतंत्र चैट",
    deletedConversation: (title) => `"${title}" हटाया गया`,
    renameConversationAria: (title) => `${title} का नाम बदलें`,
    pinConversationAria: (title) => `${title} पिन करें`,
    unpinConversationAria: (title) => `${title} अनपिन करें`,
    deleteConversation: "बातचीत हटाएँ",
    deleteConversationAria: (title) => `${title} हटाएँ`,
    conversationNamePlaceholder: "बातचीत का नाम...",
    noPapersMatched: "कोई मेल खाता पेपर नहीं मिला।",
    pdfCount: (count) => `${count} PDF`,
    pdfAttachment: "PDF संलग्नक",
  },
};

type PanelI18nLogKeys = Pick<
  PanelI18n,
  | "trLogError"
  | "trLogDetails"
  | "trLogEnvironmentSetupStarting"
  | "trLogEnvironmentSetupComplete"
  | "trLogResumed"
  | "trLogPaused"
  | "trLogPauseError"
  | "trLogCannotClearRunning"
  | "trLogCacheDetails"
  | "trLogClearDone"
  | "trLogClearError"
  | "trLogJobStarted"
  | "trLogPdfLabel"
  | "trLogModelLabel"
  | "trLogLanguageLabel"
  | "trLogOutputLabel"
  | "trLogAdvancedOptions"
  | "trLogFailedToResolveCredentials"
  | "trLogAuthLabel"
  | "trLogModelIdLabel"
  | "trLogApiBaseLabel"
  | "trLogEnvironmentReady"
  | "trLogPythonLabel"
  | "trLogPdf2zhLabel"
  | "trLogPageProgress"
  | "trLogOutputFile"
  | "trLogCompletedWithErrors"
  | "trLogFullLog"
  | "trLogSeeDetailsAbove"
  | "trLogUnknownError"
  | "attachmentRemoved"
  | "operationFailed"
>;

type PanelI18nBaseKeys = Omit<PanelI18n, keyof PanelI18nLogKeys>;

const PANEL_I18N_LOG_OVERRIDES: Record<PanelLang, PanelI18nLogKeys> = {
  "en-US": {
    trLogError: (message) => `Error: ${message}`,
    trLogDetails: (details) => `Details: ${details}`,
    trLogEnvironmentSetupStarting: "Starting environment setup...",
    trLogEnvironmentSetupComplete: "Environment setup complete!",
    trLogResumed: "Resumed",
    trLogPaused: "Paused",
    trLogPauseError: (message) => `Pause error: ${message}`,
    trLogCannotClearRunning:
      "Cannot clear cache while translation is running. Pause or wait for it to finish.",
    trLogCacheDetails: (removed, skipped) =>
      `Cache details: ${removed} item(s) removed${
        skipped > 0 ? `, skipped active jobs: ${skipped}` : ""
      }`,
    trLogClearDone: "Cache cleared",
    trLogClearError: (message) => `Clear error: ${message}`,
    trLogJobStarted: "Translation Job Started",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "Model",
    trLogLanguageLabel: "Language",
    trLogOutputLabel: "Output",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `Skip references: ${skipReferences} | Compatibility: ${compatibility} | OCR: force=${forceOcr}, auto=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `Failed to resolve credentials: ${message}`,
    trLogAuthLabel: "Auth",
    trLogModelIdLabel: "Model ID",
    trLogApiBaseLabel: "API Base",
    trLogEnvironmentReady: (venvDir) => `Environment ready (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `Page ${current}/${total} (${percent}%) [${elapsed}]`,
    trLogOutputFile: (file) => `Output: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `Translation completed with ${count} error(s); some pages may contain untranslated text`,
    trLogFullLog: (path) => `Full log: ${path}`,
    trLogSeeDetailsAbove: "see details above",
    trLogUnknownError: "Unknown error",
    attachmentRemoved: (count) => `Attachment removed (${count})`,
    operationFailed: (message) => `Failed: ${message}`,
  },
  "zh-CN": {
    trLogError: (message) => `错误：${message}`,
    trLogDetails: (details) => `详情：${details}`,
    trLogEnvironmentSetupStarting: "正在安装翻译环境...",
    trLogEnvironmentSetupComplete: "翻译环境安装完成！",
    trLogResumed: "已继续",
    trLogPaused: "已暂停",
    trLogPauseError: (message) => `暂停/继续失败：${message}`,
    trLogCannotClearRunning:
      "翻译正在运行，不能清理缓存。请先暂停或等待任务结束。",
    trLogCacheDetails: (removed, skipped) =>
      `缓存详情：已移除 ${removed} 项${
        skipped > 0 ? `，跳过运行中的任务 ${skipped} 个` : ""
      }`,
    trLogClearDone: "缓存已清理",
    trLogClearError: (message) => `清理失败：${message}`,
    trLogJobStarted: "翻译任务已启动",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "模型",
    trLogLanguageLabel: "语言",
    trLogOutputLabel: "输出",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `跳过参考文献：${skipReferences} | 兼容模式：${compatibility} | OCR：强制=${forceOcr}，自动=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `解析模型凭证失败：${message}`,
    trLogAuthLabel: "认证",
    trLogModelIdLabel: "模型 ID",
    trLogApiBaseLabel: "API 地址",
    trLogEnvironmentReady: (venvDir) => `环境已就绪（${venvDir}）`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `第 ${current}/${total} 页（${percent}%）[${elapsed}]`,
    trLogOutputFile: (file) => `输出：${file}`,
    trLogCompletedWithErrors: (count) =>
      `翻译已完成，但有 ${count} 个错误；部分页面可能未完整翻译`,
    trLogFullLog: (path) => `完整日志：${path}`,
    trLogSeeDetailsAbove: "见上方详情",
    trLogUnknownError: "未知错误",
    attachmentRemoved: (count) => `附件已移除（剩余 ${count}）`,
    operationFailed: (message) => `失败：${message}`,
  },
  "zh-TW": {
    trLogError: (message) => `錯誤：${message}`,
    trLogDetails: (details) => `詳情：${details}`,
    trLogEnvironmentSetupStarting: "正在安裝翻譯環境...",
    trLogEnvironmentSetupComplete: "翻譯環境安裝完成！",
    trLogResumed: "已繼續",
    trLogPaused: "已暫停",
    trLogPauseError: (message) => `暫停/繼續失敗：${message}`,
    trLogCannotClearRunning:
      "翻譯正在執行，不能清理快取。請先暫停或等待任務結束。",
    trLogCacheDetails: (removed, skipped) =>
      `快取詳情：已移除 ${removed} 項${
        skipped > 0 ? `，略過執行中的任務 ${skipped} 個` : ""
      }`,
    trLogClearDone: "快取已清理",
    trLogClearError: (message) => `清理失敗：${message}`,
    trLogJobStarted: "翻譯任務已啟動",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "模型",
    trLogLanguageLabel: "語言",
    trLogOutputLabel: "輸出",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `略過參考文獻：${skipReferences} | 相容模式：${compatibility} | OCR：強制=${forceOcr}，自動=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `解析模型憑證失敗：${message}`,
    trLogAuthLabel: "驗證",
    trLogModelIdLabel: "模型 ID",
    trLogApiBaseLabel: "API 位址",
    trLogEnvironmentReady: (venvDir) => `環境已就緒（${venvDir}）`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `第 ${current}/${total} 頁（${percent}%）[${elapsed}]`,
    trLogOutputFile: (file) => `輸出：${file}`,
    trLogCompletedWithErrors: (count) =>
      `翻譯已完成，但有 ${count} 個錯誤；部分頁面可能未完整翻譯`,
    trLogFullLog: (path) => `完整日誌：${path}`,
    trLogSeeDetailsAbove: "見上方詳情",
    trLogUnknownError: "未知錯誤",
    attachmentRemoved: (count) => `附件已移除（剩餘 ${count}）`,
    operationFailed: (message) => `失敗：${message}`,
  },
  "ja-JP": {
    trLogError: (message) => `エラー: ${message}`,
    trLogDetails: (details) => `詳細: ${details}`,
    trLogEnvironmentSetupStarting: "翻訳環境をセットアップ中...",
    trLogEnvironmentSetupComplete: "翻訳環境のセットアップが完了しました！",
    trLogResumed: "再開しました",
    trLogPaused: "一時停止しました",
    trLogPauseError: (message) => `一時停止/再開エラー: ${message}`,
    trLogCannotClearRunning:
      "翻訳の実行中はキャッシュを削除できません。一時停止するか完了を待ってください。",
    trLogCacheDetails: (removed, skipped) =>
      `キャッシュ詳細: ${removed} 件を削除${
        skipped > 0 ? `、実行中のジョブ ${skipped} 件をスキップ` : ""
      }`,
    trLogClearDone: "キャッシュを削除しました",
    trLogClearError: (message) => `削除エラー: ${message}`,
    trLogJobStarted: "翻訳ジョブを開始しました",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "モデル",
    trLogLanguageLabel: "言語",
    trLogOutputLabel: "出力",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `参考文献スキップ: ${skipReferences} | 互換モード: ${compatibility} | OCR: 強制=${forceOcr}, 自動=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `モデル認証情報の解決に失敗しました: ${message}`,
    trLogAuthLabel: "認証",
    trLogModelIdLabel: "モデル ID",
    trLogApiBaseLabel: "API ベース",
    trLogEnvironmentReady: (venvDir) => `環境準備完了 (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `ページ ${current}/${total} (${percent}%) [${elapsed}]`,
    trLogOutputFile: (file) => `出力: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `翻訳は完了しましたが ${count} 件のエラーがあります。一部ページに未翻訳テキストが残る可能性があります`,
    trLogFullLog: (path) => `完全なログ: ${path}`,
    trLogSeeDetailsAbove: "上の詳細を確認してください",
    trLogUnknownError: "不明なエラー",
    attachmentRemoved: (count) => `添付ファイルを削除しました (${count})`,
    operationFailed: (message) => `失敗: ${message}`,
  },
  "ko-KR": {
    trLogError: (message) => `오류: ${message}`,
    trLogDetails: (details) => `세부 정보: ${details}`,
    trLogEnvironmentSetupStarting: "번역 환경 설정 중...",
    trLogEnvironmentSetupComplete: "번역 환경 설정 완료!",
    trLogResumed: "재개됨",
    trLogPaused: "일시 중지됨",
    trLogPauseError: (message) => `일시 중지/재개 오류: ${message}`,
    trLogCannotClearRunning:
      "번역 실행 중에는 캐시를 지울 수 없습니다. 일시 중지하거나 완료될 때까지 기다리세요.",
    trLogCacheDetails: (removed, skipped) =>
      `캐시 세부 정보: ${removed}개 항목 삭제${
        skipped > 0 ? `, 실행 중인 작업 ${skipped}개 건너뜀` : ""
      }`,
    trLogClearDone: "캐시를 지웠습니다",
    trLogClearError: (message) => `지우기 오류: ${message}`,
    trLogJobStarted: "번역 작업 시작됨",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "모델",
    trLogLanguageLabel: "언어",
    trLogOutputLabel: "출력",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `참고문헌 건너뛰기: ${skipReferences} | 호환 모드: ${compatibility} | OCR: 강제=${forceOcr}, 자동=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `모델 인증 정보 확인 실패: ${message}`,
    trLogAuthLabel: "인증",
    trLogModelIdLabel: "모델 ID",
    trLogApiBaseLabel: "API Base",
    trLogEnvironmentReady: (venvDir) => `환경 준비 완료 (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `페이지 ${current}/${total} (${percent}%) [${elapsed}]`,
    trLogOutputFile: (file) => `출력: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `번역은 완료되었지만 ${count}개의 오류가 있습니다. 일부 페이지에 번역되지 않은 텍스트가 남을 수 있습니다`,
    trLogFullLog: (path) => `전체 로그: ${path}`,
    trLogSeeDetailsAbove: "위 세부 정보를 확인하세요",
    trLogUnknownError: "알 수 없는 오류",
    attachmentRemoved: (count) => `첨부 파일 제거됨 (${count})`,
    operationFailed: (message) => `실패: ${message}`,
  },
  "fr-FR": {
    trLogError: (message) => `Erreur : ${message}`,
    trLogDetails: (details) => `Details : ${details}`,
    trLogEnvironmentSetupStarting:
      "Installation de l'environnement de traduction...",
    trLogEnvironmentSetupComplete: "Installation de l'environnement terminee !",
    trLogResumed: "Repris",
    trLogPaused: "Mis en pause",
    trLogPauseError: (message) => `Erreur de pause/reprise : ${message}`,
    trLogCannotClearRunning:
      "Impossible d'effacer le cache pendant la traduction. Mettez en pause ou attendez la fin.",
    trLogCacheDetails: (removed, skipped) =>
      `Details du cache : ${removed} element(s) supprime(s)${
        skipped > 0 ? `, taches actives ignorees : ${skipped}` : ""
      }`,
    trLogClearDone: "Cache efface",
    trLogClearError: (message) => `Erreur d'effacement : ${message}`,
    trLogJobStarted: "Tache de traduction lancee",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "Modele",
    trLogLanguageLabel: "Langue",
    trLogOutputLabel: "Sortie",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `Ignorer references : ${skipReferences} | Compatibilite : ${compatibility} | OCR : force=${forceOcr}, auto=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `Echec de resolution des identifiants : ${message}`,
    trLogAuthLabel: "Auth",
    trLogModelIdLabel: "ID modele",
    trLogApiBaseLabel: "Base API",
    trLogEnvironmentReady: (venvDir) => `Environnement pret (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `Page ${current}/${total} (${percent} %) [${elapsed}]`,
    trLogOutputFile: (file) => `Sortie : ${file}`,
    trLogCompletedWithErrors: (count) =>
      `Traduction terminee avec ${count} erreur(s) ; certaines pages peuvent contenir du texte non traduit`,
    trLogFullLog: (path) => `Journal complet : ${path}`,
    trLogSeeDetailsAbove: "voir les details ci-dessus",
    trLogUnknownError: "Erreur inconnue",
    attachmentRemoved: (count) => `Piece jointe supprimee (${count})`,
    operationFailed: (message) => `Echec : ${message}`,
  },
  "de-DE": {
    trLogError: (message) => `Fehler: ${message}`,
    trLogDetails: (details) => `Details: ${details}`,
    trLogEnvironmentSetupStarting: "Uebersetzungsumgebung wird eingerichtet...",
    trLogEnvironmentSetupComplete: "Uebersetzungsumgebung wurde eingerichtet!",
    trLogResumed: "Fortgesetzt",
    trLogPaused: "Pausiert",
    trLogPauseError: (message) => `Pause/Fortsetzen fehlgeschlagen: ${message}`,
    trLogCannotClearRunning:
      "Cache kann waehrend der Uebersetzung nicht geleert werden. Pausieren oder auf das Ende warten.",
    trLogCacheDetails: (removed, skipped) =>
      `Cache-Details: ${removed} Element(e) entfernt${
        skipped > 0 ? `, aktive Jobs uebersprungen: ${skipped}` : ""
      }`,
    trLogClearDone: "Cache geleert",
    trLogClearError: (message) => `Leeren fehlgeschlagen: ${message}`,
    trLogJobStarted: "Uebersetzungsjob gestartet",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "Modell",
    trLogLanguageLabel: "Sprache",
    trLogOutputLabel: "Ausgabe",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `Referenzen ueberspringen: ${skipReferences} | Kompatibilitaet: ${compatibility} | OCR: erzwingen=${forceOcr}, auto=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `Modell-Zugangsdaten konnten nicht aufgeloest werden: ${message}`,
    trLogAuthLabel: "Auth",
    trLogModelIdLabel: "Modell-ID",
    trLogApiBaseLabel: "API-Basis",
    trLogEnvironmentReady: (venvDir) => `Umgebung bereit (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `Seite ${current}/${total} (${percent} %) [${elapsed}]`,
    trLogOutputFile: (file) => `Ausgabe: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `Uebersetzung mit ${count} Fehler(n) abgeschlossen; einige Seiten koennen unuebersetzten Text enthalten`,
    trLogFullLog: (path) => `Vollstaendiges Protokoll: ${path}`,
    trLogSeeDetailsAbove: "Details siehe oben",
    trLogUnknownError: "Unbekannter Fehler",
    attachmentRemoved: (count) => `Anhang entfernt (${count})`,
    operationFailed: (message) => `Fehlgeschlagen: ${message}`,
  },
  "es-ES": {
    trLogError: (message) => `Error: ${message}`,
    trLogDetails: (details) => `Detalles: ${details}`,
    trLogEnvironmentSetupStarting: "Configurando el entorno de traduccion...",
    trLogEnvironmentSetupComplete: "Configuracion del entorno completada!",
    trLogResumed: "Reanudado",
    trLogPaused: "Pausado",
    trLogPauseError: (message) => `Error al pausar/reanudar: ${message}`,
    trLogCannotClearRunning:
      "No se puede borrar la cache mientras la traduccion esta en ejecucion. Pausa o espera a que termine.",
    trLogCacheDetails: (removed, skipped) =>
      `Detalles de cache: ${removed} elemento(s) eliminado(s)${
        skipped > 0 ? `, trabajos activos omitidos: ${skipped}` : ""
      }`,
    trLogClearDone: "Cache borrada",
    trLogClearError: (message) => `Error al borrar: ${message}`,
    trLogJobStarted: "Tarea de traduccion iniciada",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "Modelo",
    trLogLanguageLabel: "Idioma",
    trLogOutputLabel: "Salida",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `Omitir referencias: ${skipReferences} | Compatibilidad: ${compatibility} | OCR: forzar=${forceOcr}, auto=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `No se pudieron resolver las credenciales: ${message}`,
    trLogAuthLabel: "Autenticacion",
    trLogModelIdLabel: "ID de modelo",
    trLogApiBaseLabel: "Base API",
    trLogEnvironmentReady: (venvDir) => `Entorno listo (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `Pagina ${current}/${total} (${percent} %) [${elapsed}]`,
    trLogOutputFile: (file) => `Salida: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `La traduccion termino con ${count} error(es); algunas paginas pueden contener texto sin traducir`,
    trLogFullLog: (path) => `Registro completo: ${path}`,
    trLogSeeDetailsAbove: "vea los detalles arriba",
    trLogUnknownError: "Error desconocido",
    attachmentRemoved: (count) => `Adjunto eliminado (${count})`,
    operationFailed: (message) => `Error: ${message}`,
  },
  "ru-RU": {
    trLogError: (message) => `Ошибка: ${message}`,
    trLogDetails: (details) => `Подробности: ${details}`,
    trLogEnvironmentSetupStarting: "Настройка среды перевода...",
    trLogEnvironmentSetupComplete: "Настройка среды завершена!",
    trLogResumed: "Возобновлено",
    trLogPaused: "Приостановлено",
    trLogPauseError: (message) => `Ошибка паузы/возобновления: ${message}`,
    trLogCannotClearRunning:
      "Нельзя очистить кэш во время перевода. Приостановите задачу или дождитесь завершения.",
    trLogCacheDetails: (removed, skipped) =>
      `Детали кэша: удалено ${removed} элемент(ов)${
        skipped > 0 ? `, пропущено активных задач: ${skipped}` : ""
      }`,
    trLogClearDone: "Кэш очищен",
    trLogClearError: (message) => `Ошибка очистки: ${message}`,
    trLogJobStarted: "Задача перевода запущена",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "Модель",
    trLogLanguageLabel: "Язык",
    trLogOutputLabel: "Вывод",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `Пропускать ссылки: ${skipReferences} | Совместимость: ${compatibility} | OCR: принудительно=${forceOcr}, авто=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `Не удалось получить учетные данные модели: ${message}`,
    trLogAuthLabel: "Авторизация",
    trLogModelIdLabel: "ID модели",
    trLogApiBaseLabel: "API Base",
    trLogEnvironmentReady: (venvDir) => `Среда готова (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `Страница ${current}/${total} (${percent} %) [${elapsed}]`,
    trLogOutputFile: (file) => `Вывод: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `Перевод завершен с ${count} ошибк(ами); на некоторых страницах может остаться непереведенный текст`,
    trLogFullLog: (path) => `Полный журнал: ${path}`,
    trLogSeeDetailsAbove: "см. подробности выше",
    trLogUnknownError: "Неизвестная ошибка",
    attachmentRemoved: (count) => `Вложение удалено (${count})`,
    operationFailed: (message) => `Ошибка: ${message}`,
  },
  "pt-BR": {
    trLogError: (message) => `Erro: ${message}`,
    trLogDetails: (details) => `Detalhes: ${details}`,
    trLogEnvironmentSetupStarting: "Configurando ambiente de traducao...",
    trLogEnvironmentSetupComplete: "Configuracao do ambiente concluida!",
    trLogResumed: "Retomado",
    trLogPaused: "Pausado",
    trLogPauseError: (message) => `Erro ao pausar/retomar: ${message}`,
    trLogCannotClearRunning:
      "Nao e possivel limpar o cache enquanto a traducao esta em execucao. Pause ou aguarde terminar.",
    trLogCacheDetails: (removed, skipped) =>
      `Detalhes do cache: ${removed} item(ns) removido(s)${
        skipped > 0 ? `, tarefas ativas ignoradas: ${skipped}` : ""
      }`,
    trLogClearDone: "Cache limpo",
    trLogClearError: (message) => `Erro ao limpar: ${message}`,
    trLogJobStarted: "Tarefa de traducao iniciada",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "Modelo",
    trLogLanguageLabel: "Idioma",
    trLogOutputLabel: "Saida",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `Ignorar referencias: ${skipReferences} | Compatibilidade: ${compatibility} | OCR: forcar=${forceOcr}, auto=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `Falha ao resolver credenciais: ${message}`,
    trLogAuthLabel: "Autenticacao",
    trLogModelIdLabel: "ID do modelo",
    trLogApiBaseLabel: "Base API",
    trLogEnvironmentReady: (venvDir) => `Ambiente pronto (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `Pagina ${current}/${total} (${percent}%) [${elapsed}]`,
    trLogOutputFile: (file) => `Saida: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `Traducao concluida com ${count} erro(s); algumas paginas podem conter texto sem traducao`,
    trLogFullLog: (path) => `Log completo: ${path}`,
    trLogSeeDetailsAbove: "veja os detalhes acima",
    trLogUnknownError: "Erro desconhecido",
    attachmentRemoved: (count) => `Anexo removido (${count})`,
    operationFailed: (message) => `Falha: ${message}`,
  },
  "ar-SA": {
    trLogError: (message) => `خطأ: ${message}`,
    trLogDetails: (details) => `التفاصيل: ${details}`,
    trLogEnvironmentSetupStarting: "جار إعداد بيئة الترجمة...",
    trLogEnvironmentSetupComplete: "اكتمل إعداد بيئة الترجمة!",
    trLogResumed: "تم الاستئناف",
    trLogPaused: "تم الإيقاف المؤقت",
    trLogPauseError: (message) => `خطأ في الإيقاف/الاستئناف: ${message}`,
    trLogCannotClearRunning:
      "لا يمكن مسح الذاكرة المؤقتة أثناء تشغيل الترجمة. أوقف المهمة مؤقتا أو انتظر حتى تنتهي.",
    trLogCacheDetails: (removed, skipped) =>
      `تفاصيل الذاكرة المؤقتة: تمت إزالة ${removed} عنصر${
        skipped > 0 ? `، وتم تخطي ${skipped} مهمة نشطة` : ""
      }`,
    trLogClearDone: "تم مسح الذاكرة المؤقتة",
    trLogClearError: (message) => `خطأ في المسح: ${message}`,
    trLogJobStarted: "بدأت مهمة الترجمة",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "النموذج",
    trLogLanguageLabel: "اللغة",
    trLogOutputLabel: "الإخراج",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `تخطي المراجع: ${skipReferences} | التوافق: ${compatibility} | OCR: إجباري=${forceOcr}, تلقائي=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `فشل حل بيانات اعتماد النموذج: ${message}`,
    trLogAuthLabel: "التفويض",
    trLogModelIdLabel: "معرف النموذج",
    trLogApiBaseLabel: "عنوان API",
    trLogEnvironmentReady: (venvDir) => `البيئة جاهزة (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `الصفحة ${current}/${total} (${percent}%) [${elapsed}]`,
    trLogOutputFile: (file) => `الإخراج: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `اكتملت الترجمة مع ${count} أخطاء؛ قد تحتوي بعض الصفحات على نص غير مترجم`,
    trLogFullLog: (path) => `السجل الكامل: ${path}`,
    trLogSeeDetailsAbove: "راجع التفاصيل أعلاه",
    trLogUnknownError: "خطأ غير معروف",
    attachmentRemoved: (count) => `تمت إزالة المرفق (${count})`,
    operationFailed: (message) => `فشل: ${message}`,
  },
  "hi-IN": {
    trLogError: (message) => `त्रुटि: ${message}`,
    trLogDetails: (details) => `विवरण: ${details}`,
    trLogEnvironmentSetupStarting: "अनुवाद वातावरण सेट किया जा रहा है...",
    trLogEnvironmentSetupComplete: "अनुवाद वातावरण सेट हो गया!",
    trLogResumed: "फिर शुरू हुआ",
    trLogPaused: "रोका गया",
    trLogPauseError: (message) => `रोकने/फिर शुरू करने में त्रुटि: ${message}`,
    trLogCannotClearRunning:
      "अनुवाद चलते समय कैश साफ नहीं किया जा सकता। रोकें या पूरा होने तक प्रतीक्षा करें।",
    trLogCacheDetails: (removed, skipped) =>
      `कैश विवरण: ${removed} आइटम हटे${
        skipped > 0 ? `, ${skipped} सक्रिय कार्य छोड़े गए` : ""
      }`,
    trLogClearDone: "कैश साफ हुआ",
    trLogClearError: (message) => `साफ करने में त्रुटि: ${message}`,
    trLogJobStarted: "अनुवाद कार्य शुरू हुआ",
    trLogPdfLabel: "PDF",
    trLogModelLabel: "मॉडल",
    trLogLanguageLabel: "भाषा",
    trLogOutputLabel: "आउटपुट",
    trLogAdvancedOptions: (skipReferences, compatibility, forceOcr, autoOcr) =>
      `संदर्भ छोड़ें: ${skipReferences} | संगतता: ${compatibility} | OCR: force=${forceOcr}, auto=${autoOcr}`,
    trLogFailedToResolveCredentials: (message) =>
      `मॉडल क्रेडेंशियल हल नहीं हुए: ${message}`,
    trLogAuthLabel: "प्रमाणीकरण",
    trLogModelIdLabel: "मॉडल ID",
    trLogApiBaseLabel: "API Base",
    trLogEnvironmentReady: (venvDir) => `वातावरण तैयार (${venvDir})`,
    trLogPythonLabel: "Python",
    trLogPdf2zhLabel: "pdf2zh",
    trLogPageProgress: (current, total, percent, elapsed) =>
      `पृष्ठ ${current}/${total} (${percent}%) [${elapsed}]`,
    trLogOutputFile: (file) => `आउटपुट: ${file}`,
    trLogCompletedWithErrors: (count) =>
      `अनुवाद ${count} त्रुटियों के साथ पूरा हुआ; कुछ पृष्ठों में अनूदित न हुआ पाठ रह सकता है`,
    trLogFullLog: (path) => `पूरा लॉग: ${path}`,
    trLogSeeDetailsAbove: "ऊपर विवरण देखें",
    trLogUnknownError: "अज्ञात त्रुटि",
    attachmentRemoved: (count) => `अटैचमेंट हटाया गया (${count})`,
    operationFailed: (message) => `विफल: ${message}`,
  },
};

export function getPanelI18n(): PanelI18n {
  const lang = getPanelLang();
  if (lang !== "zh-CN") {
    const base: PanelI18nBaseKeys = {
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
      generateImage: "Generate image",
      generateImageActive: "Image generation mode",
      imagePromptPlaceholder: "Describe the image to generate...",
      cancel: "Cancel",
      statusNoContext: "No active paper context. Type @ to add papers.",
      statusReady: "Ready",
      statusSelectItem: "Select an item or open a PDF",
      placeholderGlobal: "Ask anything... Type @ to add papers",
      placeholderPaper:
        "Ask about this paper... Type @ for adding other papers as context",
      ...PANEL_I18N_PLACEHOLDER_TIPS["en-US"],
      emptyPromptStatus:
        "Type a question, or add text, PDFs, or images as context first.",
      modelSelectHint: "Select model",
      modelNoModels: "No models available. Login and refresh in Settings.",
      modelClickChoose: "Click to choose a model",
      modelOnlyOne: "Only one model is configured",
      chatReadinessTitle: "AIdea is not ready yet",
      chatReadinessNoModels:
        "No available model. Open AIdea Settings to log in or refresh models.",
      chatReadinessSelectModel:
        "Select a model in AIdea Settings before chatting.",
      chatReadinessCustomConfig:
        "Complete the custom API base URL and model in AIdea Settings before chatting.",
      chatReadinessOpenSettings: "Open AIdea Settings",
      uploadFiles: "Upload files",
      selectReferences: "Select references",
      conversationLoaded: "Conversation loaded",
      noEditableLatestPrompt: "No editable latest prompt",
      referencePickerReady:
        "Reference picker ready. Type after @ to search papers.",
      paperAlreadySelected: "Paper already selected",
      paperContextAdded: (n, max) => `Paper context added (${n}/${max})`,
      cancelled: "Cancelled",
      retry: "Retry",
      branchToNewChat: "Branch to new chat",
      previousVariant: "Previous version",
      nextVariant: "Next version",
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
      trFormatDisclaimer:
        "⚠ Due to the inherent complexity of PDF formatting, occasional layout or style mismatches may occur in translated output. This is being continuously improved — thank you for your understanding.",
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
      trHintPoolMaxWorker:
        "Number of paragraphs translated concurrently. Higher = faster but may hit API rate limits.",
      trHintSkipReferences:
        "Detect the References section by heading and skip translating those pages.",
      trHintKeepAppendix:
        "Continue translating appendices (Appendix A/B/C) after the References section.",
      trHintProtectAuthor:
        "Preserve author names, emails, and affiliations on the title page without translating.",
      trHintDisableRichText:
        "Disable bold/italic style preservation. Output plain text only — cleaner but loses formatting.",
      trHintEnhanceCompat:
        "Use conservative PDF rendering for broader reader compatibility. May slightly reduce layout quality.",
      trHintTranslateTable:
        "Translate text inside tables. Off by default because complex tables may break after translation.",
      trHintOcr:
        "Force OCR on all pages. Use for PDFs with broken text layers or embedded images.",
      trHintAutoOcr:
        "Automatically detect scanned PDFs and enable OCR when needed.",
      trHintSaveGlossary:
        "Auto-extract a terminology glossary (e.g. Transformer → 变换器) and save to the output folder.",
      trHintDisableGlossary:
        "Completely disable automatic terminology extraction. May reduce translation consistency.",
      trHintFontFamily:
        "Auto = engine selects best match; Serif = Song/Times; Sans-serif = Hei/Arial; Script = italic/cursive.",
      trHintQps:
        "API requests per second. Free APIs: 3-5; Paid APIs: 10-20. Too high may trigger rate limiting.",
      settingPanelLoading: "Setting panel loading...",
      swapLanguages: "Swap languages",
      console: "Console",
      copyAll: "Copy all",
      openPdfFirst: "Open a PDF first",
      scrollToBottom: "Scroll to bottom",
      requiredOutputFolder: "Required: choose output folder",
      expandFigures: "Expand figures",
      collapseFigures: "Collapse figures",
      clearSelectedScreenshots: "Clear selected screenshots",
      selectedScreenshotPreview: "Selected screenshot preview",
      selectFigureScreenshot: "Select figure screenshot",
      expandFiles: "Expand files",
      collapseFiles: "Collapse files",
      clearUploadedFiles: "Clear uploaded files",
      contextActions: "Context actions",
      newConversation: "New conversation",
      expandPapers: "Expand papers",
      collapsePapers: "Collapse papers",
      supplementalPaper: "Supplemental paper",
      figureBadgeIcon: "IMG",
      paperBadgeIcon: "REF",
      fileBadgeIcon: "FILE",
      figureCount: (count, max) =>
        Number.isFinite(max)
          ? `Figures (${count}/${max})`
          : `Figures (${count})`,
      fileCount: (count) => `Files (${count})`,
      paperCount: (count, max) =>
        Number.isFinite(max) ? `Papers (${count}/${max})` : `Papers (${count})`,
      uploadedAttachments: (added, replaced) =>
        `Uploaded ${added} attachment(s)${
          replaced > 0 ? `, replaced ${replaced}` : ""
        }`,
      uploadSkippedLargePdfs: (count) =>
        `${count} PDF(s) skipped because they exceed the 50MB limit`,
      uploadSkippedImages: (count) => `${count} image(s) skipped`,
      uploadPersistFailed: (count) =>
        `Failed to save ${count} file(s) to local chat attachments`,
      pdfTextExtractionIncomplete: (count) =>
        `Could not extract text from ${count} PDF(s); the file was attached, but answers may not use its text`,
      screenshotNth: (n) => `Screenshot ${n}`,
      openAttachment: (name) => `Open ${name}`,
      fileFallback: "file",
      usingCachedDocumentContext: "Using cached document context",
      rebuildingDocumentContext: "Rebuilding document context...",
      waitForCurrentResponse: "Wait for the current response to finish",
      noRetryableResponseFound: "No retryable response found",
      nothingToRetryLatestTurn: "Nothing to retry for latest turn",
      preparingRetry: "Preparing retry...",
      preparingRequest: "Preparing request...",
      generatingImage: "Generating image...",
      noResponse: "No response.",
      noAssistantTextSelected: "No assistant text selected",
      copiedResponse: "Copied response",
      createdNewNote: "Created a new note",
      failedToCreateNote: "Failed to create note",
      editingLatestPrompt: "Editing latest prompt",
      failedToSaveEditedPrompt: "Failed to save edited prompt",
      noChatHistoryDetected: "No chat history detected.",
      copiedChatAsMd: "Copied chat as md",
      savedChatHistoryToNewNote: "Saved chat history to new note",
      pinFilesPanel: "Pin files panel",
      pinFiguresPanel: "Pin figures panel",
      conversationRestored: "Conversation restored",
      noActiveLibraryForDeletion: "No active library for deletion",
      cannotDeleteActiveConversation:
        "Cannot delete active conversation right now",
      conversationDeletedUndo: "Conversation deleted. Undo available.",
      reusedExistingEmptyPaperChat: "Reused existing empty paper chat",
      failedToCreateNewPaperConversation:
        "Failed to create new paper conversation",
      startedNewPaperChat: "Started new paper chat",
      noActiveLibraryForGlobalConversation:
        "No active library for global conversation",
      failedToCreateConversation: "Failed to create conversation",
      waitForResponseBeforeSwitching:
        "Wait for the response to finish before switching",
      selectRegion: "Select a region...",
      selectionCancelled: "Selection cancelled",
      screenshotFailed: "Screenshot failed",
      copied: "Copied",
      figuresCleared: "Figures cleared",
      filesCleared: "Files cleared",
      paperContextDismissed: "Paper context dismissed",
      selectedTextRemoved: "Selected text removed",
      cleared: "Cleared",
      textContextLimit: "Text Context up to 5",
      clearSelectedContext: "Clear selected context",
      shortcutPromptEmpty: "Shortcut prompt cannot be empty",
      dragToReorder: "Drag to reorder",
      currentPdfPage: (page) => `Current PDF, page ${page}`,
      selectionTranslateColdStart: "Cold starting...",
      selectionTranslateTranslating: "Translating...",
      selectionTranslateFailed: "Translation failed",
      selectionTranslateNoContext:
        "Document context unavailable; translating selected text only...",
      selectionTranslateWriteToAnnotation: "Write translation to annotation",
      selectionTranslateColdStartStatus:
        "Selection translation cold starting...",
      selectionTranslateCacheReady: "Selection translation cache ready",
      addToNote: "Add to note",
      addingToNote: "Adding...",
      addedToNote: "Added",
      addToNoteFailed: "Add failed",
      screenshotSelectionInstruction:
        "Click and drag to select a region, then release",
      cancelEsc: "Cancel (Esc)",
      pinTextContext: "Pin text context",
      unpinTextContext: "Unpin text context",
      unpinNamedContext: (name) => `Unpin ${name}`,
      expandPdfs: "Click to expand PDFs",
      collapsePdfs: "Click to collapse PDFs",
      untitledChat: "Untitled chat",
      paperChat: "Paper chat",
      standaloneChat: "Standalone chat",
      deletedConversation: (title) => `Deleted "${title}"`,
      renameConversationAria: (title) => `Rename ${title}`,
      pinConversationAria: (title) => `Pin ${title}`,
      unpinConversationAria: (title) => `Unpin ${title}`,
      deleteConversation: "Delete conversation",
      deleteConversationAria: (title) => `Delete ${title}`,
      conversationNamePlaceholder: "Conversation name...",
      noPapersMatched: "No papers matched.",
      pdfCount: (count) => `${count} PDFs`,
      pdfAttachment: "PDF attachment",
      trLogFullPath: "Full path",
      trLogOutputFormat: (mono, dual) =>
        `Output format: Mono=${mono} | Dual=${dual}`,
      trLogResolvingCredentials: "Resolving model credentials...",
      trLogCheckingEnvironment: "Checking translation environment...",
      trLogEnvironmentNotReady: (status) =>
        `Environment not ready (status: ${status})`,
      trLogInstallEnvironmentInstruction:
        "Please click 'Install Environment' button to set up the Python environment",
      trLogBridgeError: (message) => `Bridge error: ${message}`,
      trLogTotalTime: (duration) => `Total time: ${duration}`,
      trLogJobFinished: "Job Finished",
      trLogEngineStarted: "Translation engine started...",
      trLogPausedCached: "Translation paused — progress cached",
      trLogLaunchingEngine: "Launching translation engine...",
      trLogStackTrace: "Stack trace",
    };
    return {
      ...base,
      ...(PANEL_I18N_OVERRIDES[lang] || {}),
      ...(PANEL_I18N_READINESS_OVERRIDES[lang] || {}),
      ...PANEL_I18N_PLACEHOLDER_TIPS[lang],
      ...(PANEL_I18N_EXTRA_OVERRIDES[lang] || {}),
      ...(PANEL_I18N_RUNTIME_OVERRIDES[lang] || {}),
      ...PANEL_I18N_LOG_OVERRIDES[lang],
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
    generateImage: "\u751f\u6210\u56fe\u7247",
    generateImageActive: "\u56fe\u7247\u751f\u6210\u6a21\u5f0f",
    imagePromptPlaceholder:
      "\u63cf\u8ff0\u4f60\u60f3\u751f\u6210\u7684\u56fe\u7247...",
    cancel: "取消",
    statusNoContext: "当前无论文上下文，输入 @ 可添加论文。",
    statusReady: "就绪",
    statusSelectItem: "请选择条目或打开 PDF",
    placeholderGlobal: "开始提问... 输入 @ 添加论文",
    placeholderPaper: "对当前论文提问... 输入 @ 添加其他论文上下文",
    ...PANEL_I18N_PLACEHOLDER_TIPS["zh-CN"],
    emptyPromptStatus:
      "\u8bf7\u8f93\u5165\u95ee\u9898\uff0c\u6216\u5148\u6dfb\u52a0\u6587\u672c\u3001PDF \u6216\u56fe\u7247\u4e0a\u4e0b\u6587\u3002",
    modelSelectHint: "选择模型",
    modelNoModels: "暂无模型，请在设置中登录 OAuth 并刷新模型列表。",
    modelClickChoose: "点击选择模型",
    modelOnlyOne: "当前仅配置了一个模型",
    chatReadinessTitle: "AIdea 尚未准备好",
    chatReadinessNoModels: "当前没有可用模型。请在设置中登录或刷新模型列表。",
    chatReadinessSelectModel: "请选择一个模型后再开始对话。",
    chatReadinessCustomConfig:
      "请在设置中补全自定义 API 地址和模型后再开始对话。",
    chatReadinessOpenSettings: "打开 AIdea 设置",
    uploadFiles: "上传文件",
    selectReferences: "选择参考论文",
    conversationLoaded: "对话已加载",
    noEditableLatestPrompt: "没有可编辑的最近一条提问",
    referencePickerReady: "引用选择器已就绪，输入 @ 后继续键入搜索论文。",
    paperAlreadySelected: "该论文已添加",
    paperContextAdded: (n, max) => `已添加论文上下文（${n}/${max}）`,
    cancelled: "已取消",
    retry: "重试",
    branchToNewChat: "分支到新聊天",
    previousVariant: "上一个版本",
    nextVariant: "下一个版本",
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
    trFormatDisclaimer:
      "⚠ 由于 PDF 格式本身的复杂性，翻译后的文档偶尔可能出现排版或样式不一致的情况，正在持续改进中，敬请谅解。",
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
    trHintKeepAppendix:
      "参考文献后面的附录（Appendix A/B/C）继续翻译，不跳过。",
    trHintProtectAuthor: "保留首页作者姓名、邮箱、单位等信息不翻译。",
    trHintDisableRichText:
      "禁用粗体/斜体等格式保留，翻译结果为纯文本。排版更简洁但丢失样式。",
    trHintEnhanceCompat:
      "使用更保守的 PDF 渲染方式，兼容更多阅读器。可能略微降低排版质量。",
    trHintTranslateTable:
      "翻译表格中的文字。默认关闭，因为复杂表格翻译后容易错位。",
    trHintOcr:
      "强制对所有页面使用 OCR 提取文字。用于文字层损坏或嵌入图片的 PDF。",
    trHintAutoOcr: "自动检测是否为扫描件 PDF，如果是则自动启用 OCR。",
    trHintSaveGlossary: "翻译时自动提取专业术语对照表并保存，下次可复用。",
    trHintDisableGlossary: "完全关闭术语自动提取。可能降低翻译一致性。",
    trHintFontFamily:
      "自动=引擎智能匹配；衬线体=宋体/Times；无衬线体=黑体/Arial；手写体=斜体/书法。",
    trHintQps:
      "每秒 API 请求数。免费 API 建议 3-5，付费 API 可设 10-20。过高会触发限速。",
    settingPanelLoading: "设置面板加载中...",
    swapLanguages: "交换语言",
    console: "控制台",
    copyAll: "全部复制",
    openPdfFirst: "请先打开 PDF",
    scrollToBottom: "滚动到底部",
    requiredOutputFolder: "必填：请选择输出文件夹",
    expandFigures: "展开图片",
    collapseFigures: "收起图片",
    clearSelectedScreenshots: "清空已选截图",
    selectedScreenshotPreview: "已选截图预览",
    selectFigureScreenshot: "选择图片截图",
    expandFiles: "展开文件",
    collapseFiles: "收起文件",
    clearUploadedFiles: "清空上传文件",
    contextActions: "上下文操作",
    newConversation: "新建对话",
    expandPapers: "展开论文",
    collapsePapers: "收起论文",
    supplementalPaper: "补充论文",
    figureBadgeIcon: "图",
    paperBadgeIcon: "文献",
    fileBadgeIcon: "文件",
    figureCount: (count, max) =>
      Number.isFinite(max) ? `图片（${count}/${max}）` : `图片（${count}）`,
    fileCount: (count) => `文件（${count}）`,
    paperCount: (count, max) =>
      Number.isFinite(max) ? `论文（${count}/${max}）` : `论文（${count}）`,
    uploadedAttachments: (added, replaced) =>
      `\u5df2\u4e0a\u4f20 ${added} \u4e2a\u9644\u4ef6${
        replaced > 0 ? `\uff0c\u5df2\u66ff\u6362 ${replaced} \u4e2a` : ""
      }`,
    uploadSkippedLargePdfs: (count) =>
      `${count} \u4e2a PDF \u8d85\u8fc7 50MB \u9650\u5236\uff0c\u5df2\u8df3\u8fc7`,
    uploadSkippedImages: (count) =>
      `${count} \u5f20\u56fe\u7247\u5df2\u8df3\u8fc7`,
    uploadPersistFailed: (count) =>
      `${count} \u4e2a\u6587\u4ef6\u672a\u80fd\u4fdd\u5b58\u5230\u672c\u5730\u5bf9\u8bdd\u9644\u4ef6`,
    pdfTextExtractionIncomplete: (count) =>
      `${count} \u4e2a PDF \u672a\u80fd\u63d0\u53d6\u6587\u672c\uff1b\u6587\u4ef6\u5df2\u9644\u52a0\uff0c\u4f46\u56de\u7b54\u53ef\u80fd\u65e0\u6cd5\u4f7f\u7528\u5176\u6587\u672c`,
    screenshotNth: (n) => `截图 ${n}`,
    openAttachment: (name) => `打开 ${name}`,
    fileFallback: "文件",
    usingCachedDocumentContext: "正在使用缓存的文档上下文",
    rebuildingDocumentContext: "正在重建文档上下文...",
    waitForCurrentResponse: "请等待当前回复完成",
    noRetryableResponseFound: "没有可重试的回复",
    nothingToRetryLatestTurn: "最近一轮没有可重试内容",
    preparingRetry: "正在准备重试...",
    preparingRequest: "正在准备请求...",
    generatingImage: "\u6b63\u5728\u751f\u6210\u56fe\u7247...",
    noResponse: "没有回复。",
    noAssistantTextSelected: "未选中助手文本",
    copiedResponse: "已复制回复",
    createdNewNote: "已创建新笔记",
    failedToCreateNote: "创建笔记失败",
    editingLatestPrompt: "正在编辑最近一条提问",
    failedToSaveEditedPrompt:
      "\u4fdd\u5b58\u7f16\u8f91\u540e\u7684\u63d0\u95ee\u5931\u8d25",
    noChatHistoryDetected: "未检测到聊天记录。",
    copiedChatAsMd: "已复制对话 Markdown",
    savedChatHistoryToNewNote: "已将聊天记录保存为新笔记",
    pinFilesPanel: "固定文件面板",
    pinFiguresPanel: "固定图片面板",
    conversationRestored: "对话已恢复",
    noActiveLibraryForDeletion: "没有可删除的活动文库",
    cannotDeleteActiveConversation: "当前无法删除正在使用的对话",
    conversationDeletedUndo: "对话已删除，可撤销。",
    reusedExistingEmptyPaperChat: "已复用现有空论文对话",
    failedToCreateNewPaperConversation: "创建新论文对话失败",
    startedNewPaperChat: "已开始新论文对话",
    noActiveLibraryForGlobalConversation: "没有可用于全局对话的活动文库",
    failedToCreateConversation: "创建对话失败",
    waitForResponseBeforeSwitching: "请等待回复完成后再切换",
    selectRegion: "请选择区域...",
    selectionCancelled: "已取消选择",
    screenshotFailed: "截图失败",
    copied: "已复制",
    figuresCleared: "图片已清空",
    filesCleared: "文件已清空",
    paperContextDismissed: "论文上下文已移除",
    selectedTextRemoved: "已移除选中文本",
    cleared: "已清空",
    textContextLimit: "文本上下文最多 5 条",
    clearSelectedContext: "清空已选上下文",
    shortcutPromptEmpty: "快捷指令提示词不能为空",
    dragToReorder: "拖动以排序",
    currentPdfPage: (page) => `当前 PDF，第 ${page} 页`,
    selectionTranslateColdStart: "冷启动中...",
    selectionTranslateTranslating: "翻译中...",
    selectionTranslateFailed: "翻译失败",
    selectionTranslateNoContext: "未使用文档上下文，正在翻译选中文本...",
    selectionTranslateWriteToAnnotation: "将译文写入标注",
    selectionTranslateColdStartStatus: "划词翻译冷启动中...",
    selectionTranslateCacheReady: "划词翻译缓存已就绪",
    addToNote: "添加到笔记",
    addingToNote: "正在添加...",
    addedToNote: "已添加",
    addToNoteFailed: "添加失败",
    screenshotSelectionInstruction: "点击并拖动选择区域，松开后完成",
    cancelEsc: "取消 (Esc)",
    pinTextContext: "固定文本上下文",
    unpinTextContext: "取消固定文本上下文",
    unpinNamedContext: (name) => `取消固定 ${name}`,
    expandPdfs: "点击展开 PDF",
    collapsePdfs: "点击收起 PDF",
    untitledChat: "未命名对话",
    paperChat: "论文对话",
    standaloneChat: "独立对话",
    deletedConversation: (title) => `已删除“${title}”`,
    renameConversationAria: (title) => `重命名 ${title}`,
    pinConversationAria: (title) => `置顶 ${title}`,
    unpinConversationAria: (title) => `取消置顶 ${title}`,
    deleteConversation: "删除对话",
    deleteConversationAria: (title) => `删除 ${title}`,
    conversationNamePlaceholder: "对话名称...",
    noPapersMatched: "没有匹配的论文。",
    pdfCount: (count) => `${count} 个 PDF`,
    pdfAttachment: "PDF 附件",
    trLogFullPath: "完整路径",
    trLogOutputFormat: (mono, dual) => `输出格式：单语=${mono} | 双语=${dual}`,
    trLogResolvingCredentials: "正在解析模型凭证...",
    trLogCheckingEnvironment: "正在检查翻译环境...",
    trLogEnvironmentNotReady: (status) => `环境未就绪（状态：${status}）`,
    trLogInstallEnvironmentInstruction: "请点击“安装环境”按钮设置 Python 环境",
    trLogBridgeError: (message) => `桥接错误：${message}`,
    trLogTotalTime: (duration) => `总用时：${duration}`,
    trLogJobFinished: "任务完成",
    trLogEngineStarted: "翻译引擎已启动...",
    trLogPausedCached: "翻译已暂停，进度已缓存",
    trLogLaunchingEngine: "正在启动翻译引擎...",
    trLogStackTrace: "堆栈跟踪",
    ...PANEL_I18N_LOG_OVERRIDES["zh-CN"],
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
  const pdfName = doc.getElementById("llm-tr-pdf-name") as HTMLElement | null;
  if (pdfName && !pdfName.title) pdfName.textContent = i18n.trNoPdfFound;
  setText("llm-tr-save-path-label", i18n.trSavePath);
  const outputDir = doc.getElementById(
    "llm-tr-output-dir",
  ) as HTMLInputElement | null;
  if (outputDir) outputDir.placeholder = i18n.requiredOutputFolder;
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
  setText("llm-tr-console-toggle", i18n.console);
  setText("llm-setting-placeholder", `⚙️ ${i18n.settingPanelLoading}`);

  const swapButton = doc.getElementById(
    "llm-tr-lang-swap",
  ) as HTMLElement | null;
  if (swapButton) swapButton.title = i18n.swapLanguages;
  const consoleCopy = doc.getElementById(
    "llm-tr-console-copy",
  ) as HTMLElement | null;
  if (consoleCopy) consoleCopy.title = i18n.copyAll;
  const consoleClear = doc.getElementById(
    "llm-tr-console-clear",
  ) as HTMLElement | null;
  if (consoleClear) consoleClear.title = i18n.clear;

  // Checkbox labels (output format)
  setCheckboxText("llm-tr-mono-label", i18n.trOutputMono);
  setCheckboxText("llm-tr-dual-label", i18n.trOutputDual);

  // Advanced checkboxes — query by input ID, update parent label text
  const advChecks: [string, string, string][] = [
    [
      "llm-tr-skip-refs-auto",
      i18n.trSkipReferencesAuto,
      i18n.trHintSkipReferences,
    ],
    [
      "llm-tr-keep-appendix",
      i18n.trKeepAppendixTranslated,
      i18n.trHintKeepAppendix,
    ],
    [
      "llm-tr-protect-author",
      i18n.trProtectAuthorBlock,
      i18n.trHintProtectAuthor,
    ],
    [
      "llm-tr-disable-rich-text",
      i18n.trDisableRichTextTranslate,
      i18n.trHintDisableRichText,
    ],
    [
      "llm-tr-enhance-compat",
      i18n.trEnhanceCompatibility,
      i18n.trHintEnhanceCompat,
    ],
    [
      "llm-tr-translate-table",
      i18n.trTranslateTableText,
      i18n.trHintTranslateTable,
    ],
    ["llm-tr-ocr", i18n.trOCR, i18n.trHintOcr],
    ["llm-tr-auto-ocr", i18n.trAutoOCR, i18n.trHintAutoOcr],
    ["llm-tr-save-glossary", i18n.trSaveGlossary, i18n.trHintSaveGlossary],
    [
      "llm-tr-disable-glossary",
      i18n.trDisableGlossary,
      i18n.trHintDisableGlossary,
    ],
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
