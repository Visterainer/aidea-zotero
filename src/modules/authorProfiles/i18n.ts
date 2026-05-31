import type { PanelLang } from "../contextPanel/languages";

type AuthorProfileDirection = "ltr" | "rtl";

export type AuthorProfileCopy = {
  languageName: string;
  dir: AuthorProfileDirection;
  noteTitle: string;
  noteTag: string;
  settingsTitle: string;
  settingsContextMenu: string;
  settingsContextMenuHint: string;
  settingsModel?: string;
  settingsModelFollow?: string;
  settingsLanguage: string;
  settingsLanguageFollow?: string;
  settingsLanguageHint: string;
  beta?: string;
  menuSingle: string;
  menuBatch: (count: number) => string;
  confirmBatch: (count: number) => string;
  progressSingleTitle: string;
  progressBatchTitle: string;
  close: string;
  minimize: string;
  restore: string;
  elapsed: string;
  eta: string;
  done: string;
  skipped?: string;
  failed: string;
  metaGeneratedAt: string;
  metaModel: string;
  metaSources: string;
  defaultSource: string;
  stageMetadata: string;
  stagePdf: string;
  stageSources: string;
  stageResolve: string;
  stageEnrich: string;
  stageLlm: string;
  stageNote: string;
  doneCreated: string;
  doneUpdated: string;
  generationFailed: string;
  batchFinishedWithFailures: string;
  generationCompleted: string;
  emptyResponseError: string;
  headings: {
    correspondingAuthor: string;
    academicInformation: string;
    relationToPaper: string;
    sources: string;
  };
  fields: {
    name: string;
    affiliation: string;
    email: string;
    evidenceConfidence: string;
    paperRelatedTopics: string;
    publicScholarlyIndicators: string;
    evidence: string;
    dataSources: string;
  };
  relationInstruction: string;
  missingMetrics: string;
  paperTopicRule: string;
};

const COPY_BY_LANGUAGE: Record<string, AuthorProfileCopy> = {
  "zh-CN": {
    languageName: "Simplified Chinese",
    dir: "ltr",
    noteTitle: "通讯作者介绍",
    noteTag: "通讯作者介绍",
    settingsTitle: "联网搜索作者信息",
    settingsContextMenu: "右键生成通讯作者介绍",
    settingsContextMenuHint:
      "在条目右键菜单中显示 AIdea 入口；支持多选条目后批量生成；重新生成会覆盖旧笔记。",
    settingsModel: "生成模型",
    settingsModelFollow: "跟随当前对话模型",
    settingsLanguage: "输出语言",
    settingsLanguageFollow: "跟随插件界面语言",
    settingsLanguageHint:
      "默认跟随插件界面语言；手动选择后会固定使用所选语言。",
    beta: "BETA",
    menuSingle: "AIdea: 生成通讯作者介绍",
    menuBatch: (count) => `AIdea: 批量生成通讯作者介绍（${count} 个条目）`,
    confirmBatch: (count) =>
      `将按顺序为 ${count} 个条目生成通讯作者介绍。已有 AIdea 通讯作者介绍的条目会被重新生成并覆盖。继续吗？`,
    progressSingleTitle: "AIdea 正在生成通讯作者介绍",
    progressBatchTitle: "AIdea 正在批量生成通讯作者介绍",
    close: "关闭",
    minimize: "最小化",
    restore: "展开",
    elapsed: "耗时",
    eta: "预计剩余",
    done: "完成",
    skipped: "跳过",
    failed: "失败",
    metaGeneratedAt: "生成时间",
    metaModel: "模型",
    metaSources: "数据来源",
    defaultSource: "AIdea",
    stageMetadata: "读取 Zotero 条目元数据",
    stagePdf: "读取本地 PDF 中的通讯作者线索",
    stageSources: "查询 Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve: "合并作者记录并判断通讯作者",
    stageEnrich: "补充作者指标与机构信息",
    stageLlm: "调用 AIdea 模型生成介绍",
    stageNote: "写入 Zotero 子笔记",
    doneCreated: "已创建通讯作者介绍",
    doneUpdated: "已更新通讯作者介绍",
    generationFailed: "生成失败",
    batchFinishedWithFailures: "批量处理完成，部分条目失败",
    generationCompleted: "通讯作者介绍已生成",
    emptyResponseError: "AI 返回了空的通讯作者介绍",
    headings: {
      correspondingAuthor: "通讯作者",
      academicInformation: "学术信息",
      relationToPaper: "与本文的关系",
      sources: "来源",
    },
    fields: {
      name: "姓名",
      affiliation: "单位",
      email: "邮箱",
      evidenceConfidence: "判断依据",
      paperRelatedTopics: "本文相关方向",
      publicScholarlyIndicators: "公开学术指标",
      evidence: "证据",
      dataSources: "数据来源",
    },
    relationInstruction: "用一段简洁、学术化的中文说明该作者与本文的关系。",
    missingMetrics: "未检索到可靠公开学术指标。",
    paperTopicRule:
      "研究方向只写“从本文主题可见，本文相关方向包括……”，不要写成作者长期研究方向，除非证据数据直接提供。",
  },
  "zh-TW": {
    languageName: "Traditional Chinese",
    dir: "ltr",
    noteTitle: "通訊作者介紹",
    noteTag: "通訊作者介紹",
    settingsTitle: "線上搜尋作者資訊",
    settingsContextMenu: "右鍵生成通訊作者介紹",
    settingsContextMenuHint:
      "在條目右鍵選單中顯示 AIdea 入口；支援多選條目後批次生成；重新生成會覆蓋舊筆記。",
    settingsModel: "生成模型",
    settingsModelFollow: "跟隨目前對話模型",
    settingsLanguage: "輸出語言",
    settingsLanguageFollow: "跟隨外掛介面語言",
    settingsLanguageHint:
      "預設跟隨外掛介面語言；手動選擇後會固定使用所選語言。",
    beta: "BETA",
    menuSingle: "AIdea: 生成通訊作者介紹",
    menuBatch: (count) => `AIdea: 批次生成通訊作者介紹（${count} 個條目）`,
    confirmBatch: (count) =>
      `將依序為 ${count} 個條目生成通訊作者介紹。既有 AIdea 通訊作者介紹會重新生成並覆蓋。是否繼續？`,
    progressSingleTitle: "AIdea 正在生成通訊作者介紹",
    progressBatchTitle: "AIdea 正在批次生成通訊作者介紹",
    close: "關閉",
    minimize: "最小化",
    restore: "展開",
    elapsed: "耗時",
    eta: "預估剩餘",
    done: "完成",
    skipped: "跳過",
    failed: "失敗",
    metaGeneratedAt: "生成時間",
    metaModel: "模型",
    metaSources: "資料來源",
    defaultSource: "AIdea",
    stageMetadata: "讀取 Zotero 條目中繼資料",
    stagePdf: "讀取本機 PDF 中的通訊作者線索",
    stageSources: "查詢 Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve: "合併作者記錄並判斷通訊作者",
    stageEnrich: "補充作者指標與機構資訊",
    stageLlm: "呼叫 AIdea 模型生成介紹",
    stageNote: "寫入 Zotero 子筆記",
    doneCreated: "已建立通訊作者介紹",
    doneUpdated: "已更新通訊作者介紹",
    generationFailed: "生成失敗",
    batchFinishedWithFailures: "批次處理完成，部分條目失敗",
    generationCompleted: "通訊作者介紹已生成",
    emptyResponseError: "AI 回傳了空的通訊作者介紹",
    headings: {
      correspondingAuthor: "通訊作者",
      academicInformation: "學術資訊",
      relationToPaper: "與本文的關係",
      sources: "來源",
    },
    fields: {
      name: "姓名",
      affiliation: "單位",
      email: "電子郵件",
      evidenceConfidence: "判斷依據",
      paperRelatedTopics: "本文相關方向",
      publicScholarlyIndicators: "公開學術指標",
      evidence: "證據",
      dataSources: "資料來源",
    },
    relationInstruction: "用一段簡潔、學術化的繁體中文說明該作者與本文的關係。",
    missingMetrics: "未檢索到可靠公開學術指標。",
    paperTopicRule:
      "研究方向只寫成本文相關方向，不要寫成作者長期研究方向，除非證據資料直接提供。",
  },
  en: {
    languageName: "English",
    dir: "ltr",
    noteTitle: "Corresponding Author Profile",
    noteTag: "Corresponding Author Profile",
    settingsTitle: "Online Author Lookup",
    settingsContextMenu: "Right-click author profile generation",
    settingsContextMenuHint:
      "Adds an AIdea item menu entry; multi-selected items can be generated in batch; regenerated notes overwrite old ones.",
    settingsModel: "Generation model",
    settingsModelFollow: "Follow current chat model",
    settingsLanguage: "Output language",
    settingsLanguageFollow: "Follow plugin UI language",
    settingsLanguageHint:
      "Defaults to the plugin UI language until you choose a language manually.",
    beta: "BETA",
    menuSingle: "AIdea: Generate Corresponding Author Profile",
    menuBatch: (count) => `AIdea: Generate Author Profiles (${count} items)`,
    confirmBatch: (count) =>
      `AIdea will generate author profiles for ${count} selected items in sequence. Existing AIdea author profile notes will be regenerated and overwritten. Continue?`,
    progressSingleTitle: "AIdea is generating the author profile",
    progressBatchTitle: "AIdea is generating author profiles",
    close: "Close",
    minimize: "Minimize",
    restore: "Restore",
    elapsed: "Elapsed",
    eta: "ETA",
    done: "Done",
    skipped: "Skipped",
    failed: "Failed",
    metaGeneratedAt: "Generated",
    metaModel: "Model",
    metaSources: "Sources",
    defaultSource: "AIdea",
    stageMetadata: "Reading Zotero item metadata",
    stagePdf: "Reading corresponding-author evidence from local PDFs",
    stageSources: "Querying Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve: "Merging author records and resolving corresponding authors",
    stageEnrich: "Enriching author metrics and affiliations",
    stageLlm: "Calling the AIdea model",
    stageNote: "Writing the Zotero child note",
    doneCreated: "Created corresponding author profile",
    doneUpdated: "Updated corresponding author profile",
    generationFailed: "Generation failed",
    batchFinishedWithFailures: "Batch finished with some failures",
    generationCompleted: "Author profile generation completed",
    emptyResponseError: "AI returned an empty author profile",
    headings: {
      correspondingAuthor: "Corresponding Author",
      academicInformation: "Academic Information",
      relationToPaper: "Relation to This Paper",
      sources: "Sources",
    },
    fields: {
      name: "Name",
      affiliation: "Affiliation",
      email: "Email",
      evidenceConfidence: "Evidence and confidence",
      paperRelatedTopics: "Paper-related topics",
      publicScholarlyIndicators: "Public scholarly indicators",
      evidence: "Evidence",
      dataSources: "Data sources",
    },
    relationInstruction: "Write one concise academic paragraph.",
    missingMetrics: "No reliable public scholarly indicators were found.",
    paperTopicRule:
      "Describe research focus as paper-related topics unless the evidence directly gives a broader author profile.",
  },
  ja: {
    languageName: "Japanese",
    dir: "ltr",
    noteTitle: "責任著者プロフィール",
    noteTag: "責任著者プロフィール",
    settingsTitle: "オンライン著者情報検索",
    settingsContextMenu: "右クリックで責任著者プロフィールを生成",
    settingsContextMenuHint:
      "Zotero 項目の右クリックメニューに AIdea の項目を追加します。複数選択した項目は一括生成できます。既存の AIdea 責任著者プロフィールは再生成して上書きします。",
    settingsLanguage: "責任著者プロフィールの言語",
    settingsLanguageHint:
      "既定ではプラグインの表示言語に従い、手動で選択するとその言語を固定して使用します。",
    menuSingle: "AIdea: 責任著者プロフィールを生成",
    menuBatch: (count) =>
      `AIdea: 責任著者プロフィールを一括生成（${count} 件）`,
    confirmBatch: (count) =>
      `${count} 件の項目について責任著者プロフィールを順番に生成します。既存の AIdea プロフィールは再生成され、上書きされます。続行しますか？`,
    progressSingleTitle: "AIdea が責任著者プロフィールを生成しています",
    progressBatchTitle: "AIdea が責任著者プロフィールを一括生成しています",
    close: "閉じる",
    minimize: "最小化",
    restore: "展開",
    elapsed: "経過時間",
    eta: "残り時間",
    done: "完了",
    failed: "失敗",
    metaGeneratedAt: "生成時刻",
    metaModel: "モデル",
    metaSources: "データソース",
    defaultSource: "AIdea",
    stageMetadata: "Zotero 項目メタデータを読み取り中",
    stagePdf: "ローカル PDF から責任著者の手掛かりを読み取り中",
    stageSources: "Crossref / OpenAlex / Semantic Scholar / PMC を照会中",
    stageResolve: "著者レコードを統合し、責任著者を判定中",
    stageEnrich: "著者指標と所属情報を補完中",
    stageLlm: "現在の AIdea モデルで生成中",
    stageNote: "Zotero 子ノートに書き込み中",
    doneCreated: "責任著者プロフィールを作成しました",
    doneUpdated: "責任著者プロフィールを更新しました",
    generationFailed: "生成に失敗しました",
    batchFinishedWithFailures:
      "一括処理が完了しました。一部の項目は失敗しました",
    generationCompleted: "責任著者プロフィールを生成しました",
    emptyResponseError: "AI が空の責任著者プロフィールを返しました",
    headings: {
      correspondingAuthor: "責任著者",
      academicInformation: "学術情報",
      relationToPaper: "本論文との関係",
      sources: "出典",
    },
    fields: {
      name: "氏名",
      affiliation: "所属",
      email: "メール",
      evidenceConfidence: "根拠と信頼度",
      paperRelatedTopics: "本論文に関連するテーマ",
      publicScholarlyIndicators: "公開学術指標",
      evidence: "根拠",
      dataSources: "データソース",
    },
    relationInstruction:
      "この著者と本論文の関係を簡潔で学術的な一段落で述べる。",
    missingMetrics: "信頼できる公開学術指標は見つかりませんでした。",
    paperTopicRule:
      "証拠が明示しない限り、研究分野は著者の長期的な専門ではなく、本論文に関連するテーマとして記述する。",
  },
  ko: {
    languageName: "Korean",
    dir: "ltr",
    noteTitle: "교신저자 소개",
    noteTag: "교신저자 소개",
    settingsTitle: "온라인 저자 정보 검색",
    settingsContextMenu: "오른쪽 클릭 교신저자 소개 생성 사용",
    settingsContextMenuHint:
      "Zotero 항목 오른쪽 클릭 메뉴에 AIdea 항목을 추가합니다. 여러 항목을 선택하면 일괄 생성할 수 있으며 기존 AIdea 교신저자 소개는 다시 생성되어 덮어씁니다.",
    settingsLanguage: "교신저자 소개 생성 언어",
    settingsLanguageHint:
      "기본값은 플러그인 UI 언어를 따르며, 직접 선택한 뒤에는 선택한 언어를 고정해서 사용합니다.",
    menuSingle: "AIdea: 교신저자 소개 생성",
    menuBatch: (count) => `AIdea: 교신저자 소개 일괄 생성 (${count}개 항목)`,
    confirmBatch: (count) =>
      `${count}개 항목의 교신저자 소개를 순서대로 생성합니다. 기존 AIdea 교신저자 소개는 다시 생성되어 덮어씁니다. 계속할까요?`,
    progressSingleTitle: "AIdea가 교신저자 소개를 생성 중입니다",
    progressBatchTitle: "AIdea가 교신저자 소개를 일괄 생성 중입니다",
    close: "닫기",
    minimize: "최소화",
    restore: "펼치기",
    elapsed: "소요 시간",
    eta: "예상 남은 시간",
    done: "완료",
    failed: "실패",
    metaGeneratedAt: "생성 시간",
    metaModel: "모델",
    metaSources: "데이터 출처",
    defaultSource: "AIdea",
    stageMetadata: "Zotero 항목 메타데이터 읽는 중",
    stagePdf: "로컬 PDF에서 교신저자 단서 읽는 중",
    stageSources: "Crossref / OpenAlex / Semantic Scholar / PMC 조회 중",
    stageResolve: "저자 기록 병합 및 교신저자 판정 중",
    stageEnrich: "저자 지표와 소속 정보 보강 중",
    stageLlm: "현재 AIdea 모델로 생성 중",
    stageNote: "Zotero 하위 노트에 쓰는 중",
    doneCreated: "교신저자 소개를 만들었습니다",
    doneUpdated: "교신저자 소개를 업데이트했습니다",
    generationFailed: "생성 실패",
    batchFinishedWithFailures:
      "일괄 처리가 완료되었지만 일부 항목이 실패했습니다",
    generationCompleted: "교신저자 소개 생성이 완료되었습니다",
    emptyResponseError: "AI가 빈 교신저자 소개를 반환했습니다",
    headings: {
      correspondingAuthor: "교신저자",
      academicInformation: "학술 정보",
      relationToPaper: "이 논문과의 관계",
      sources: "출처",
    },
    fields: {
      name: "이름",
      affiliation: "소속",
      email: "이메일",
      evidenceConfidence: "근거와 신뢰도",
      paperRelatedTopics: "논문 관련 주제",
      publicScholarlyIndicators: "공개 학술 지표",
      evidence: "근거",
      dataSources: "데이터 출처",
    },
    relationInstruction:
      "해당 저자와 이 논문의 관계를 간결하고 학술적인 한 문단으로 설명한다.",
    missingMetrics: "신뢰할 수 있는 공개 학술 지표를 찾지 못했습니다.",
    paperTopicRule:
      "증거가 직접 제공하지 않는 한 연구 초점은 장기 연구 분야가 아니라 논문 관련 주제로 설명한다.",
  },
  fr: {
    languageName: "French",
    dir: "ltr",
    noteTitle: "Profil de l'auteur correspondant",
    noteTag: "Profil de l'auteur correspondant",
    settingsTitle: "Recherche d'auteur en ligne",
    settingsContextMenu: "Activer le profil d'auteur par clic droit",
    settingsContextMenuHint:
      "Ajoute une entrée AIdea au menu contextuel des éléments Zotero. Les éléments sélectionnés en lot peuvent être générés ensemble ; les profils AIdea existants sont régénérés et remplacés.",
    settingsLanguage: "Langue du profil d'auteur",
    settingsLanguageHint:
      "Suit par défaut la langue de l'interface du plugin, puis conserve la langue choisie manuellement.",
    menuSingle: "AIdea : générer le profil de l'auteur correspondant",
    menuBatch: (count) => `AIdea : générer les profils (${count} éléments)`,
    confirmBatch: (count) =>
      `AIdea générera les profils d'auteur pour ${count} éléments dans l'ordre. Les profils AIdea existants seront régénérés et remplacés. Continuer ?`,
    progressSingleTitle: "AIdea génère le profil de l'auteur",
    progressBatchTitle: "AIdea génère les profils d'auteur",
    close: "Fermer",
    minimize: "Réduire",
    restore: "Restaurer",
    elapsed: "Temps écoulé",
    eta: "Temps restant",
    done: "Terminé",
    failed: "Échec",
    metaGeneratedAt: "Généré le",
    metaModel: "Modèle",
    metaSources: "Sources",
    defaultSource: "AIdea",
    stageMetadata: "Lecture des métadonnées Zotero",
    stagePdf: "Lecture des indices d'auteur correspondant dans les PDF locaux",
    stageSources:
      "Interrogation de Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve:
      "Fusion des auteurs et identification de l'auteur correspondant",
    stageEnrich: "Enrichissement des indicateurs et affiliations",
    stageLlm: "Appel du modèle AIdea actuel",
    stageNote: "Écriture de la note enfant Zotero",
    doneCreated: "Profil de l'auteur correspondant créé",
    doneUpdated: "Profil de l'auteur correspondant mis à jour",
    generationFailed: "Échec de la génération",
    batchFinishedWithFailures: "Traitement terminé avec quelques échecs",
    generationCompleted: "Génération du profil terminée",
    emptyResponseError: "L'IA a retourné un profil vide",
    headings: {
      correspondingAuthor: "Auteur correspondant",
      academicInformation: "Informations académiques",
      relationToPaper: "Relation avec cet article",
      sources: "Sources",
    },
    fields: {
      name: "Nom",
      affiliation: "Affiliation",
      email: "E-mail",
      evidenceConfidence: "Preuve et niveau de confiance",
      paperRelatedTopics: "Thèmes liés à l'article",
      publicScholarlyIndicators: "Indicateurs académiques publics",
      evidence: "Preuve",
      dataSources: "Sources de données",
    },
    relationInstruction: "Rédiger un paragraphe académique concis.",
    missingMetrics: "Aucun indicateur académique public fiable n'a été trouvé.",
    paperTopicRule:
      "Décrire les thèmes comme liés à l'article, sauf si les preuves donnent directement un profil plus large de l'auteur.",
  },
  de: {
    languageName: "German",
    dir: "ltr",
    noteTitle: "Profil des korrespondierenden Autors",
    noteTag: "Profil des korrespondierenden Autors",
    settingsTitle: "Online-Autorensuche",
    settingsContextMenu:
      "Rechtsklick-Profil für korrespondierende Autoren aktivieren",
    settingsContextMenuHint:
      "Fügt Zotero-Eintragsmenüs einen AIdea-Menüpunkt hinzu. Mehrfach ausgewählte Einträge können als Stapel erzeugt werden; vorhandene AIdea-Profile werden neu erzeugt und überschrieben.",
    settingsLanguage: "Sprache des Autorenprofils",
    settingsLanguageHint:
      "Folgt standardmäßig der Plugin-Oberflächensprache und verwendet nach manueller Auswahl die gewählte Sprache dauerhaft.",
    menuSingle: "AIdea: Profil des korrespondierenden Autors erzeugen",
    menuBatch: (count) => `AIdea: Autorenprofile erzeugen (${count} Einträge)`,
    confirmBatch: (count) =>
      `AIdea erzeugt der Reihe nach Autorenprofile für ${count} ausgewählte Einträge. Vorhandene AIdea-Profile werden neu erzeugt und überschrieben. Fortfahren?`,
    progressSingleTitle: "AIdea erzeugt das Autorenprofil",
    progressBatchTitle: "AIdea erzeugt Autorenprofile",
    close: "Schließen",
    minimize: "Minimieren",
    restore: "Wiederherstellen",
    elapsed: "Vergangen",
    eta: "Restzeit",
    done: "Fertig",
    failed: "Fehlgeschlagen",
    metaGeneratedAt: "Erzeugt",
    metaModel: "Modell",
    metaSources: "Quellen",
    defaultSource: "AIdea",
    stageMetadata: "Zotero-Metadaten werden gelesen",
    stagePdf:
      "Hinweise zum korrespondierenden Autor aus lokalen PDFs werden gelesen",
    stageSources:
      "Crossref / OpenAlex / Semantic Scholar / PMC werden abgefragt",
    stageResolve:
      "Autorendatensätze werden zusammengeführt und korrespondierende Autoren bestimmt",
    stageEnrich: "Autorenmetriken und Affiliations werden ergänzt",
    stageLlm: "Aktuelles AIdea-Modell wird aufgerufen",
    stageNote: "Zotero-Kindnotiz wird geschrieben",
    doneCreated: "Profil des korrespondierenden Autors erstellt",
    doneUpdated: "Profil des korrespondierenden Autors aktualisiert",
    generationFailed: "Erzeugung fehlgeschlagen",
    batchFinishedWithFailures:
      "Stapelverarbeitung mit einigen Fehlern abgeschlossen",
    generationCompleted: "Autorenprofil-Erzeugung abgeschlossen",
    emptyResponseError: "Die KI hat ein leeres Autorenprofil zurückgegeben",
    headings: {
      correspondingAuthor: "Korrespondierender Autor",
      academicInformation: "Akademische Informationen",
      relationToPaper: "Bezug zu diesem Artikel",
      sources: "Quellen",
    },
    fields: {
      name: "Name",
      affiliation: "Affiliation",
      email: "E-Mail",
      evidenceConfidence: "Nachweis und Vertrauen",
      paperRelatedTopics: "Artikelbezogene Themen",
      publicScholarlyIndicators: "Öffentliche akademische Kennzahlen",
      evidence: "Nachweis",
      dataSources: "Datenquellen",
    },
    relationInstruction: "Einen knappen akademischen Absatz schreiben.",
    missingMetrics:
      "Es wurden keine verlässlichen öffentlichen akademischen Kennzahlen gefunden.",
    paperTopicRule:
      "Forschungsschwerpunkte als artikelbezogene Themen beschreiben, sofern die Evidenz kein breiteres Autorenprofil direkt belegt.",
  },
  es: {
    languageName: "Spanish",
    dir: "ltr",
    noteTitle: "Perfil del autor de correspondencia",
    noteTag: "Perfil del autor de correspondencia",
    settingsTitle: "Búsqueda de autor en línea",
    settingsContextMenu: "Activar perfil de autor con clic derecho",
    settingsContextMenuHint:
      "Añade una entrada de AIdea al menú contextual de Zotero. Los elementos seleccionados en lote pueden generarse juntos; los perfiles existentes se regeneran y sobrescriben.",
    settingsLanguage: "Idioma del perfil de autor",
    settingsLanguageHint:
      "Por defecto sigue el idioma de la interfaz del plugin; tras elegir manualmente, conserva ese idioma.",
    menuSingle: "AIdea: generar perfil del autor de correspondencia",
    menuBatch: (count) =>
      `AIdea: generar perfiles de autor (${count} elementos)`,
    confirmBatch: (count) =>
      `AIdea generará perfiles de autor para ${count} elementos seleccionados en secuencia. Los perfiles existentes se regenerarán y sobrescribirán. ¿Continuar?`,
    progressSingleTitle: "AIdea está generando el perfil de autor",
    progressBatchTitle: "AIdea está generando perfiles de autor",
    close: "Cerrar",
    minimize: "Minimizar",
    restore: "Restaurar",
    elapsed: "Transcurrido",
    eta: "Restante",
    done: "Completado",
    failed: "Fallido",
    metaGeneratedAt: "Generado",
    metaModel: "Modelo",
    metaSources: "Fuentes",
    defaultSource: "AIdea",
    stageMetadata: "Leyendo metadatos del elemento Zotero",
    stagePdf: "Leyendo evidencia del autor de correspondencia en PDF locales",
    stageSources: "Consultando Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve:
      "Fusionando registros de autores y resolviendo autores de correspondencia",
    stageEnrich: "Enriqueciendo métricas y afiliaciones de autores",
    stageLlm: "Llamando al modelo actual de AIdea",
    stageNote: "Escribiendo la nota secundaria de Zotero",
    doneCreated: "Perfil del autor de correspondencia creado",
    doneUpdated: "Perfil del autor de correspondencia actualizado",
    generationFailed: "Error de generación",
    batchFinishedWithFailures: "Lote finalizado con algunos errores",
    generationCompleted: "Generación del perfil completada",
    emptyResponseError: "La IA devolvió un perfil de autor vacío",
    headings: {
      correspondingAuthor: "Autor de correspondencia",
      academicInformation: "Información académica",
      relationToPaper: "Relación con este artículo",
      sources: "Fuentes",
    },
    fields: {
      name: "Nombre",
      affiliation: "Afiliación",
      email: "Correo electrónico",
      evidenceConfidence: "Evidencia y confianza",
      paperRelatedTopics: "Temas relacionados con el artículo",
      publicScholarlyIndicators: "Indicadores académicos públicos",
      evidence: "Evidencia",
      dataSources: "Fuentes de datos",
    },
    relationInstruction: "Escribir un párrafo académico conciso.",
    missingMetrics:
      "No se encontraron indicadores académicos públicos fiables.",
    paperTopicRule:
      "Describir el enfoque como temas relacionados con el artículo, salvo que la evidencia proporcione directamente un perfil más amplio del autor.",
  },
  ru: {
    languageName: "Russian",
    dir: "ltr",
    noteTitle: "Профиль автора для переписки",
    noteTag: "Профиль автора для переписки",
    settingsTitle: "Онлайн-поиск сведений об авторе",
    settingsContextMenu: "Включить профиль автора через контекстное меню",
    settingsContextMenuHint:
      "Добавляет пункт AIdea в контекстное меню элементов Zotero. Несколько выбранных элементов можно обработать пакетом; существующие профили AIdea пересоздаются и заменяются.",
    settingsLanguage: "Язык профиля автора",
    settingsLanguageHint:
      "По умолчанию следует языку интерфейса плагина; после ручного выбора использует выбранный язык.",
    menuSingle: "AIdea: создать профиль автора для переписки",
    menuBatch: (count) => `AIdea: создать профили авторов (${count} элементов)`,
    confirmBatch: (count) =>
      `AIdea последовательно создаст профили авторов для ${count} выбранных элементов. Существующие профили AIdea будут пересозданы и заменены. Продолжить?`,
    progressSingleTitle: "AIdea создает профиль автора",
    progressBatchTitle: "AIdea создает профили авторов",
    close: "Закрыть",
    minimize: "Свернуть",
    restore: "Развернуть",
    elapsed: "Прошло",
    eta: "Осталось",
    done: "Готово",
    failed: "Ошибка",
    metaGeneratedAt: "Создано",
    metaModel: "Модель",
    metaSources: "Источники",
    defaultSource: "AIdea",
    stageMetadata: "Чтение метаданных элемента Zotero",
    stagePdf: "Чтение признаков автора для переписки из локальных PDF",
    stageSources: "Запрос Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve:
      "Объединение записей авторов и определение автора для переписки",
    stageEnrich: "Дополнение метрик и аффилиаций автора",
    stageLlm: "Вызов текущей модели AIdea",
    stageNote: "Запись дочерней заметки Zotero",
    doneCreated: "Профиль автора для переписки создан",
    doneUpdated: "Профиль автора для переписки обновлен",
    generationFailed: "Не удалось создать",
    batchFinishedWithFailures: "Пакетная обработка завершена с ошибками",
    generationCompleted: "Создание профиля автора завершено",
    emptyResponseError: "ИИ вернул пустой профиль автора",
    headings: {
      correspondingAuthor: "Автор для переписки",
      academicInformation: "Академическая информация",
      relationToPaper: "Связь с этой статьей",
      sources: "Источники",
    },
    fields: {
      name: "Имя",
      affiliation: "Аффилиация",
      email: "Эл. почта",
      evidenceConfidence: "Доказательство и уверенность",
      paperRelatedTopics: "Темы, связанные со статьей",
      publicScholarlyIndicators: "Публичные академические показатели",
      evidence: "Доказательство",
      dataSources: "Источники данных",
    },
    relationInstruction: "Написать один краткий академический абзац.",
    missingMetrics: "Надежные публичные академические показатели не найдены.",
    paperTopicRule:
      "Описывать направления как темы, связанные со статьей, если данные прямо не подтверждают более широкий профиль автора.",
  },
  pt: {
    languageName: "Brazilian Portuguese",
    dir: "ltr",
    noteTitle: "Perfil do autor correspondente",
    noteTag: "Perfil do autor correspondente",
    settingsTitle: "Busca on-line de autor",
    settingsContextMenu: "Ativar perfil de autor pelo botão direito",
    settingsContextMenuHint:
      "Adiciona uma entrada do AIdea ao menu de contexto dos itens do Zotero. Itens selecionados em lote podem ser gerados juntos; perfis existentes são recriados e substituídos.",
    settingsLanguage: "Idioma do perfil de autor",
    settingsLanguageHint:
      "Por padrão segue o idioma da interface do plugin; após escolha manual, mantém o idioma selecionado.",
    menuSingle: "AIdea: gerar perfil do autor correspondente",
    menuBatch: (count) => `AIdea: gerar perfis de autor (${count} itens)`,
    confirmBatch: (count) =>
      `O AIdea gerará perfis de autor para ${count} itens selecionados em sequência. Perfis existentes serão recriados e substituídos. Continuar?`,
    progressSingleTitle: "AIdea está gerando o perfil de autor",
    progressBatchTitle: "AIdea está gerando perfis de autor",
    close: "Fechar",
    minimize: "Minimizar",
    restore: "Restaurar",
    elapsed: "Decorrido",
    eta: "Restante",
    done: "Concluído",
    failed: "Falha",
    metaGeneratedAt: "Gerado em",
    metaModel: "Modelo",
    metaSources: "Fontes",
    defaultSource: "AIdea",
    stageMetadata: "Lendo metadados do item Zotero",
    stagePdf: "Lendo evidências do autor correspondente em PDFs locais",
    stageSources: "Consultando Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve:
      "Mesclando registros de autores e resolvendo autores correspondentes",
    stageEnrich: "Enriquecendo métricas e afiliações de autores",
    stageLlm: "Chamando o modelo atual do AIdea",
    stageNote: "Gravando a nota filha do Zotero",
    doneCreated: "Perfil do autor correspondente criado",
    doneUpdated: "Perfil do autor correspondente atualizado",
    generationFailed: "Falha na geração",
    batchFinishedWithFailures: "Lote concluído com algumas falhas",
    generationCompleted: "Geração do perfil concluída",
    emptyResponseError: "A IA retornou um perfil de autor vazio",
    headings: {
      correspondingAuthor: "Autor correspondente",
      academicInformation: "Informações acadêmicas",
      relationToPaper: "Relação com este artigo",
      sources: "Fontes",
    },
    fields: {
      name: "Nome",
      affiliation: "Afiliação",
      email: "E-mail",
      evidenceConfidence: "Evidência e confiança",
      paperRelatedTopics: "Tópicos relacionados ao artigo",
      publicScholarlyIndicators: "Indicadores acadêmicos públicos",
      evidence: "Evidência",
      dataSources: "Fontes de dados",
    },
    relationInstruction: "Escreva um parágrafo acadêmico conciso.",
    missingMetrics:
      "Nenhum indicador acadêmico público confiável foi encontrado.",
    paperTopicRule:
      "Descreva o foco como tópicos relacionados ao artigo, salvo se a evidência fornecer diretamente um perfil mais amplo do autor.",
  },
  ar: {
    languageName: "Arabic",
    dir: "rtl",
    noteTitle: "ملف المؤلف المسؤول عن المراسلة",
    noteTag: "ملف المؤلف المسؤول عن المراسلة",
    settingsTitle: "البحث عن معلومات المؤلف عبر الإنترنت",
    settingsContextMenu: "تفعيل إنشاء ملف المؤلف من قائمة النقر الأيمن",
    settingsContextMenuHint:
      "يضيف عنصر AIdea إلى قائمة عناصر Zotero. يمكن إنشاء عدة عناصر محددة دفعة واحدة؛ وسيعاد إنشاء ملفات AIdea الموجودة واستبدالها.",
    settingsLanguage: "لغة ملف المؤلف",
    settingsLanguageHint:
      "يتبع افتراضيا لغة واجهة الإضافة، وبعد الاختيار اليدوي يستخدم اللغة المختارة.",
    menuSingle: "AIdea: إنشاء ملف المؤلف المسؤول عن المراسلة",
    menuBatch: (count) => `AIdea: إنشاء ملفات المؤلفين (${count} عناصر)`,
    confirmBatch: (count) =>
      `سينشئ AIdea ملفات المؤلفين لـ ${count} عناصر محددة بالتسلسل. ستتم إعادة إنشاء ملفات AIdea الموجودة واستبدالها. هل تريد المتابعة؟`,
    progressSingleTitle: "يقوم AIdea بإنشاء ملف المؤلف",
    progressBatchTitle: "يقوم AIdea بإنشاء ملفات المؤلفين",
    close: "إغلاق",
    minimize: "تصغير",
    restore: "استعادة",
    elapsed: "المنقضي",
    eta: "المتبقي",
    done: "اكتمل",
    failed: "فشل",
    metaGeneratedAt: "وقت الإنشاء",
    metaModel: "النموذج",
    metaSources: "المصادر",
    defaultSource: "AIdea",
    stageMetadata: "قراءة بيانات عنصر Zotero",
    stagePdf: "قراءة أدلة المؤلف المسؤول عن المراسلة من ملفات PDF المحلية",
    stageSources: "الاستعلام من Crossref / OpenAlex / Semantic Scholar / PMC",
    stageResolve: "دمج سجلات المؤلفين وتحديد المؤلف المسؤول عن المراسلة",
    stageEnrich: "إثراء مؤشرات المؤلف والانتماءات",
    stageLlm: "استدعاء نموذج AIdea الحالي",
    stageNote: "كتابة الملاحظة الفرعية في Zotero",
    doneCreated: "تم إنشاء ملف المؤلف المسؤول عن المراسلة",
    doneUpdated: "تم تحديث ملف المؤلف المسؤول عن المراسلة",
    generationFailed: "فشل الإنشاء",
    batchFinishedWithFailures: "اكتملت المعالجة مع بعض الإخفاقات",
    generationCompleted: "اكتمل إنشاء ملف المؤلف",
    emptyResponseError: "أعاد الذكاء الاصطناعي ملف مؤلف فارغا",
    headings: {
      correspondingAuthor: "المؤلف المسؤول عن المراسلة",
      academicInformation: "المعلومات الأكاديمية",
      relationToPaper: "العلاقة بهذه الورقة",
      sources: "المصادر",
    },
    fields: {
      name: "الاسم",
      affiliation: "الانتماء",
      email: "البريد الإلكتروني",
      evidenceConfidence: "الدليل ومستوى الثقة",
      paperRelatedTopics: "موضوعات مرتبطة بالورقة",
      publicScholarlyIndicators: "مؤشرات أكاديمية عامة",
      evidence: "الدليل",
      dataSources: "مصادر البيانات",
    },
    relationInstruction: "اكتب فقرة أكاديمية موجزة واحدة.",
    missingMetrics: "لم يتم العثور على مؤشرات أكاديمية عامة موثوقة.",
    paperTopicRule:
      "صف التركيز البحثي كموضوعات مرتبطة بالورقة ما لم تقدم الأدلة مباشرة ملفا أوسع للمؤلف.",
  },
  hi: {
    languageName: "Hindi",
    dir: "ltr",
    noteTitle: "संपर्क लेखक प्रोफ़ाइल",
    noteTag: "संपर्क लेखक प्रोफ़ाइल",
    settingsTitle: "ऑनलाइन लेखक खोज",
    settingsContextMenu: "राइट-क्लिक लेखक प्रोफ़ाइल सक्षम करें",
    settingsContextMenuHint:
      "Zotero item context menu में AIdea entry जोड़ता है। कई चुने गए items को batch में बनाया जा सकता है; मौजूदा AIdea लेखक प्रोफ़ाइल फिर से बनाकर overwrite की जाती हैं।",
    settingsLanguage: "लेखक प्रोफ़ाइल भाषा",
    settingsLanguageHint:
      "डिफ़ॉल्ट रूप से plugin UI भाषा का पालन करता है; manual चयन के बाद चुनी गई भाषा स्थिर रहती है।",
    menuSingle: "AIdea: संपर्क लेखक प्रोफ़ाइल बनाएँ",
    menuBatch: (count) => `AIdea: लेखक प्रोफ़ाइल बनाएँ (${count} items)`,
    confirmBatch: (count) =>
      `AIdea ${count} चुने गए items के लिए क्रम से लेखक प्रोफ़ाइल बनाएगा। मौजूदा AIdea प्रोफ़ाइल फिर से बनाकर overwrite की जाएँगी। जारी रखें?`,
    progressSingleTitle: "AIdea लेखक प्रोफ़ाइल बना रहा है",
    progressBatchTitle: "AIdea लेखक प्रोफ़ाइल बना रहा है",
    close: "बंद करें",
    minimize: "छोटा करें",
    restore: "खोलें",
    elapsed: "बीता समय",
    eta: "शेष समय",
    done: "पूर्ण",
    failed: "विफल",
    metaGeneratedAt: "बनाया गया",
    metaModel: "मॉडल",
    metaSources: "स्रोत",
    defaultSource: "AIdea",
    stageMetadata: "Zotero item metadata पढ़ा जा रहा है",
    stagePdf: "स्थानीय PDF से संपर्क लेखक संकेत पढ़े जा रहे हैं",
    stageSources:
      "Crossref / OpenAlex / Semantic Scholar / PMC query हो रहा है",
    stageResolve: "लेखक records मिलाकर संपर्क लेखक पहचाना जा रहा है",
    stageEnrich: "लेखक metrics और affiliations जोड़े जा रहे हैं",
    stageLlm: "मौजूदा AIdea model से generation हो रहा है",
    stageNote: "Zotero child note लिखा जा रहा है",
    doneCreated: "संपर्क लेखक प्रोफ़ाइल बनाई गई",
    doneUpdated: "संपर्क लेखक प्रोफ़ाइल अपडेट हुई",
    generationFailed: "Generation विफल",
    batchFinishedWithFailures: "Batch पूरा हुआ, कुछ items विफल रहे",
    generationCompleted: "लेखक प्रोफ़ाइल generation पूरा हुआ",
    emptyResponseError: "AI ने खाली लेखक प्रोफ़ाइल लौटाई",
    headings: {
      correspondingAuthor: "संपर्क लेखक",
      academicInformation: "शैक्षणिक जानकारी",
      relationToPaper: "इस लेख से संबंध",
      sources: "स्रोत",
    },
    fields: {
      name: "नाम",
      affiliation: "संस्था",
      email: "ईमेल",
      evidenceConfidence: "साक्ष्य और विश्वास",
      paperRelatedTopics: "लेख-संबंधित विषय",
      publicScholarlyIndicators: "सार्वजनिक शैक्षणिक संकेतक",
      evidence: "साक्ष्य",
      dataSources: "डेटा स्रोत",
    },
    relationInstruction: "एक संक्षिप्त academic paragraph लिखें।",
    missingMetrics: "विश्वसनीय सार्वजनिक शैक्षणिक संकेतक नहीं मिले।",
    paperTopicRule:
      "जब तक evidence व्यापक लेखक profile सीधे न दे, research focus को लेख-संबंधित विषयों के रूप में लिखें।",
  },
};

const EXTRA_LANGUAGE_ALIASES: Record<string, string> = {
  "en-US": "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "fr-FR": "fr",
  "de-DE": "de",
  "es-ES": "es",
  "ru-RU": "ru",
  "pt-BR": "pt",
  "ar-SA": "ar",
  "hi-IN": "hi",
  it: "it",
  nl: "nl",
  pl: "pl",
  tr: "tr",
  vi: "vi",
  th: "th",
  id: "id",
  uk: "uk",
};

COPY_BY_LANGUAGE.it = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Italian",
  noteTitle: "Profilo dell'autore corrispondente",
  noteTag: "Profilo dell'autore corrispondente",
};
COPY_BY_LANGUAGE.nl = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Dutch",
  noteTitle: "Profiel van de corresponderende auteur",
  noteTag: "Profiel van de corresponderende auteur",
};
COPY_BY_LANGUAGE.pl = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Polish",
  noteTitle: "Profil autora korespondencyjnego",
  noteTag: "Profil autora korespondencyjnego",
};
COPY_BY_LANGUAGE.tr = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Turkish",
  noteTitle: "Sorumlu Yazar Profili",
  noteTag: "Sorumlu Yazar Profili",
};
COPY_BY_LANGUAGE.vi = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Vietnamese",
  noteTitle: "Hồ sơ tác giả liên hệ",
  noteTag: "Hồ sơ tác giả liên hệ",
};
COPY_BY_LANGUAGE.th = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Thai",
  noteTitle: "โปรไฟล์ผู้เขียนที่ติดต่อได้",
  noteTag: "โปรไฟล์ผู้เขียนที่ติดต่อได้",
};
COPY_BY_LANGUAGE.id = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Indonesian",
  noteTitle: "Profil Penulis Korespondensi",
  noteTag: "Profil Penulis Korespondensi",
};
COPY_BY_LANGUAGE.uk = {
  ...COPY_BY_LANGUAGE.en,
  languageName: "Ukrainian",
  noteTitle: "Профіль автора для листування",
  noteTag: "Профіль автора для листування",
};

type AuthorProfileCopyPatch = Partial<
  Omit<AuthorProfileCopy, "headings" | "fields">
> & {
  headings?: Partial<AuthorProfileCopy["headings"]>;
  fields?: Partial<AuthorProfileCopy["fields"]>;
};

function patchCopy(code: string, patch: AuthorProfileCopyPatch): void {
  const base = COPY_BY_LANGUAGE[code] || COPY_BY_LANGUAGE.en;
  COPY_BY_LANGUAGE[code] = {
    ...base,
    ...patch,
    headings: { ...base.headings, ...(patch.headings || {}) },
    fields: { ...base.fields, ...(patch.fields || {}) },
  };
}

patchCopy("it", {
  menuSingle: "AIdea: genera il profilo dell'autore corrispondente",
  menuBatch: (count) => `AIdea: genera profili autore (${count} elementi)`,
  confirmBatch: (count) =>
    `AIdea genererà i profili autore per ${count} elementi selezionati in sequenza. I profili AIdea esistenti saranno rigenerati e sovrascritti. Continuare?`,
  progressSingleTitle: "AIdea sta generando il profilo autore",
  progressBatchTitle: "AIdea sta generando i profili autore",
  close: "Chiudi",
  minimize: "Riduci",
  restore: "Ripristina",
  elapsed: "Trascorso",
  eta: "Rimanente",
  done: "Completato",
  skipped: "Saltato",
  failed: "Non riuscito",
  metaGeneratedAt: "Generato",
  metaModel: "Modello",
  metaSources: "Fonti",
  stageMetadata: "Lettura dei metadati Zotero",
  stagePdf: "Lettura delle evidenze dai PDF locali",
  stageSources:
    "Interrogazione di Crossref / OpenAlex / Semantic Scholar / PMC",
  stageResolve:
    "Unione dei record autore e identificazione dell'autore corrispondente",
  stageEnrich: "Arricchimento di metriche e affiliazioni",
  stageLlm: "Chiamata al modello AIdea corrente",
  stageNote: "Scrittura della nota figlia di Zotero",
  doneCreated: "Profilo dell'autore corrispondente creato",
  doneUpdated: "Profilo dell'autore corrispondente aggiornato",
  generationFailed: "Generazione non riuscita",
  batchFinishedWithFailures: "Elaborazione completata con alcuni errori",
  generationCompleted: "Generazione del profilo completata",
  emptyResponseError: "L'AI ha restituito un profilo vuoto",
  headings: {
    correspondingAuthor: "Autore corrispondente",
    academicInformation: "Informazioni accademiche",
    relationToPaper: "Relazione con questo articolo",
    sources: "Fonti",
  },
  fields: {
    name: "Nome",
    affiliation: "Affiliazione",
    email: "Email",
    evidenceConfidence: "Evidenza e confidenza",
    paperRelatedTopics: "Temi relativi all'articolo",
    publicScholarlyIndicators: "Indicatori accademici pubblici",
    evidence: "Evidenza",
    dataSources: "Fonti dati",
  },
  relationInstruction: "Scrivere un paragrafo accademico conciso.",
  missingMetrics:
    "Non sono stati trovati indicatori accademici pubblici affidabili.",
  paperTopicRule:
    "Descrivere l'ambito come temi relativi all'articolo, salvo evidenze dirette di un profilo autore più ampio.",
});

patchCopy("nl", {
  menuSingle: "AIdea: profiel van de corresponderende auteur genereren",
  menuBatch: (count) => `AIdea: auteursprofielen genereren (${count} items)`,
  confirmBatch: (count) =>
    `AIdea genereert achtereenvolgens auteursprofielen voor ${count} geselecteerde items. Bestaande AIdea-profielen worden opnieuw gegenereerd en overschreven. Doorgaan?`,
  progressSingleTitle: "AIdea genereert het auteursprofiel",
  progressBatchTitle: "AIdea genereert auteursprofielen",
  close: "Sluiten",
  minimize: "Minimaliseren",
  restore: "Herstellen",
  elapsed: "Verstreken",
  eta: "Resterend",
  done: "Gereed",
  skipped: "Overgeslagen",
  failed: "Mislukt",
  metaGeneratedAt: "Gegenereerd",
  metaModel: "Model",
  metaSources: "Bronnen",
  stageMetadata: "Zotero-metadata lezen",
  stagePdf: "Bewijs uit lokale PDF's lezen",
  stageSources: "Crossref / OpenAlex / Semantic Scholar / PMC raadplegen",
  stageResolve: "Auteurrecords samenvoegen en corresponderende auteur bepalen",
  stageEnrich: "Auteursmetrics en affiliaties aanvullen",
  stageLlm: "Huidig AIdea-model aanroepen",
  stageNote: "Zotero-kindnotitie schrijven",
  doneCreated: "Profiel van de corresponderende auteur gemaakt",
  doneUpdated: "Profiel van de corresponderende auteur bijgewerkt",
  generationFailed: "Generatie mislukt",
  batchFinishedWithFailures: "Batch voltooid met enkele fouten",
  generationCompleted: "Auteursprofiel gegenereerd",
  emptyResponseError: "AI gaf een leeg auteursprofiel terug",
  headings: {
    correspondingAuthor: "Corresponderende auteur",
    academicInformation: "Academische informatie",
    relationToPaper: "Relatie tot dit artikel",
    sources: "Bronnen",
  },
  fields: {
    name: "Naam",
    affiliation: "Affiliatie",
    email: "E-mail",
    evidenceConfidence: "Bewijs en vertrouwen",
    paperRelatedTopics: "Artikelgerelateerde onderwerpen",
    publicScholarlyIndicators: "Publieke academische indicatoren",
    evidence: "Bewijs",
    dataSources: "Databronnen",
  },
  relationInstruction: "Schrijf één beknopte academische alinea.",
  missingMetrics:
    "Er zijn geen betrouwbare publieke academische indicatoren gevonden.",
  paperTopicRule:
    "Beschrijf de focus als artikelgerelateerde onderwerpen, tenzij bewijs direct een breder auteursprofiel geeft.",
});

patchCopy("pl", {
  menuSingle: "AIdea: wygeneruj profil autora korespondencyjnego",
  menuBatch: (count) => `AIdea: wygeneruj profile autorów (${count} elementów)`,
  confirmBatch: (count) =>
    `AIdea wygeneruje kolejno profile autorów dla ${count} wybranych elementów. Istniejące profile AIdea zostaną odtworzone i zastąpione. Kontynuować?`,
  progressSingleTitle: "AIdea generuje profil autora",
  progressBatchTitle: "AIdea generuje profile autorów",
  close: "Zamknij",
  minimize: "Minimalizuj",
  restore: "Przywróć",
  elapsed: "Czas",
  eta: "Pozostało",
  done: "Gotowe",
  skipped: "Pominięto",
  failed: "Błąd",
  metaGeneratedAt: "Utworzono",
  metaModel: "Model",
  metaSources: "Źródła",
  stageMetadata: "Odczytywanie metadanych Zotero",
  stagePdf: "Odczytywanie dowodów z lokalnych PDF",
  stageSources: "Zapytanie do Crossref / OpenAlex / Semantic Scholar / PMC",
  stageResolve: "Scalanie autorów i ustalanie autora korespondencyjnego",
  stageEnrich: "Uzupełnianie metryk i afiliacji autora",
  stageLlm: "Wywoływanie bieżącego modelu AIdea",
  stageNote: "Zapisywanie notatki podrzędnej Zotero",
  doneCreated: "Utworzono profil autora korespondencyjnego",
  doneUpdated: "Zaktualizowano profil autora korespondencyjnego",
  generationFailed: "Generowanie nie powiodło się",
  batchFinishedWithFailures: "Przetwarzanie zakończone z częścią błędów",
  generationCompleted: "Generowanie profilu zakończone",
  emptyResponseError: "AI zwróciła pusty profil autora",
  headings: {
    correspondingAuthor: "Autor korespondencyjny",
    academicInformation: "Informacje akademickie",
    relationToPaper: "Związek z artykułem",
    sources: "Źródła",
  },
  fields: {
    name: "Imię i nazwisko",
    affiliation: "Afiliacja",
    email: "E-mail",
    evidenceConfidence: "Dowód i pewność",
    paperRelatedTopics: "Tematy związane z artykułem",
    publicScholarlyIndicators: "Publiczne wskaźniki akademickie",
    evidence: "Dowód",
    dataSources: "Źródła danych",
  },
  relationInstruction: "Napisz jeden zwięzły akapit akademicki.",
  missingMetrics:
    "Nie znaleziono wiarygodnych publicznych wskaźników akademickich.",
  paperTopicRule:
    "Opisuj tematykę jako związaną z artykułem, chyba że dowody bezpośrednio pokazują szerszy profil autora.",
});

patchCopy("tr", {
  menuSingle: "AIdea: sorumlu yazar profilini oluştur",
  menuBatch: (count) => `AIdea: yazar profilleri oluştur (${count} öğe)`,
  confirmBatch: (count) =>
    `AIdea seçilen ${count} öğe için yazar profillerini sırayla oluşturacak. Mevcut AIdea profilleri yeniden oluşturulup üzerine yazılacak. Devam edilsin mi?`,
  progressSingleTitle: "AIdea yazar profilini oluşturuyor",
  progressBatchTitle: "AIdea yazar profilleri oluşturuyor",
  close: "Kapat",
  minimize: "Küçült",
  restore: "Geri yükle",
  elapsed: "Geçen",
  eta: "Kalan",
  done: "Tamamlandı",
  skipped: "Atlandı",
  failed: "Başarısız",
  metaGeneratedAt: "Oluşturuldu",
  metaModel: "Model",
  metaSources: "Kaynaklar",
  stageMetadata: "Zotero öğe meta verileri okunuyor",
  stagePdf: "Yerel PDF'lerden sorumlu yazar kanıtı okunuyor",
  stageSources: "Crossref / OpenAlex / Semantic Scholar / PMC sorgulanıyor",
  stageResolve: "Yazar kayıtları birleştiriliyor ve sorumlu yazar belirleniyor",
  stageEnrich: "Yazar metrikleri ve kurum bilgileri tamamlanıyor",
  stageLlm: "Geçerli AIdea modeli çağrılıyor",
  stageNote: "Zotero alt notu yazılıyor",
  doneCreated: "Sorumlu yazar profili oluşturuldu",
  doneUpdated: "Sorumlu yazar profili güncellendi",
  generationFailed: "Oluşturma başarısız",
  batchFinishedWithFailures: "Toplu işlem bazı hatalarla tamamlandı",
  generationCompleted: "Yazar profili oluşturma tamamlandı",
  emptyResponseError: "AI boş bir yazar profili döndürdü",
  headings: {
    correspondingAuthor: "Sorumlu yazar",
    academicInformation: "Akademik bilgiler",
    relationToPaper: "Bu makaleyle ilişkisi",
    sources: "Kaynaklar",
  },
  fields: {
    name: "Ad",
    affiliation: "Kurum",
    email: "E-posta",
    evidenceConfidence: "Kanıt ve güven",
    paperRelatedTopics: "Makale ile ilgili konular",
    publicScholarlyIndicators: "Kamusal akademik göstergeler",
    evidence: "Kanıt",
    dataSources: "Veri kaynakları",
  },
  relationInstruction: "Kısa ve akademik bir paragraf yaz.",
  missingMetrics: "Güvenilir kamusal akademik gösterge bulunamadı.",
  paperTopicRule:
    "Kanıt daha geniş bir yazar profili vermedikçe odağı makale ile ilgili konular olarak tanımla.",
});

patchCopy("vi", {
  menuSingle: "AIdea: tạo hồ sơ tác giả liên hệ",
  menuBatch: (count) => `AIdea: tạo hồ sơ tác giả (${count} mục)`,
  confirmBatch: (count) =>
    `AIdea sẽ tạo hồ sơ tác giả cho ${count} mục đã chọn theo thứ tự. Các hồ sơ AIdea hiện có sẽ được tạo lại và ghi đè. Tiếp tục?`,
  progressSingleTitle: "AIdea đang tạo hồ sơ tác giả",
  progressBatchTitle: "AIdea đang tạo hồ sơ tác giả",
  close: "Đóng",
  minimize: "Thu nhỏ",
  restore: "Khôi phục",
  elapsed: "Đã dùng",
  eta: "Còn lại",
  done: "Hoàn tất",
  skipped: "Bỏ qua",
  failed: "Thất bại",
  metaGeneratedAt: "Đã tạo",
  metaModel: "Mô hình",
  metaSources: "Nguồn",
  stageMetadata: "Đọc metadata mục Zotero",
  stagePdf: "Đọc bằng chứng tác giả liên hệ từ PDF cục bộ",
  stageSources: "Truy vấn Crossref / OpenAlex / Semantic Scholar / PMC",
  stageResolve: "Hợp nhất bản ghi tác giả và xác định tác giả liên hệ",
  stageEnrich: "Bổ sung chỉ số và đơn vị của tác giả",
  stageLlm: "Gọi mô hình AIdea hiện tại",
  stageNote: "Ghi ghi chú con Zotero",
  doneCreated: "Đã tạo hồ sơ tác giả liên hệ",
  doneUpdated: "Đã cập nhật hồ sơ tác giả liên hệ",
  generationFailed: "Tạo thất bại",
  batchFinishedWithFailures: "Xử lý xong, một số mục thất bại",
  generationCompleted: "Đã tạo xong hồ sơ tác giả",
  emptyResponseError: "AI trả về hồ sơ tác giả rỗng",
  headings: {
    correspondingAuthor: "Tác giả liên hệ",
    academicInformation: "Thông tin học thuật",
    relationToPaper: "Quan hệ với bài báo này",
    sources: "Nguồn",
  },
  fields: {
    name: "Tên",
    affiliation: "Đơn vị",
    email: "Email",
    evidenceConfidence: "Bằng chứng và độ tin cậy",
    paperRelatedTopics: "Chủ đề liên quan đến bài báo",
    publicScholarlyIndicators: "Chỉ số học thuật công khai",
    evidence: "Bằng chứng",
    dataSources: "Nguồn dữ liệu",
  },
  relationInstruction: "Viết một đoạn văn học thuật ngắn gọn.",
  missingMetrics: "Không tìm thấy chỉ số học thuật công khai đáng tin cậy.",
  paperTopicRule:
    "Mô tả hướng nghiên cứu như chủ đề liên quan đến bài báo, trừ khi bằng chứng trực tiếp cung cấp hồ sơ rộng hơn của tác giả.",
});

patchCopy("th", {
  menuSingle: "AIdea: สร้างโปรไฟล์ผู้เขียนที่ติดต่อได้",
  menuBatch: (count) => `AIdea: สร้างโปรไฟล์ผู้เขียน (${count} รายการ)`,
  confirmBatch: (count) =>
    `AIdea จะสร้างโปรไฟล์ผู้เขียนสำหรับ ${count} รายการตามลำดับ โปรไฟล์ AIdea ที่มีอยู่จะถูกสร้างใหม่และเขียนทับ ดำเนินการต่อหรือไม่?`,
  progressSingleTitle: "AIdea กำลังสร้างโปรไฟล์ผู้เขียน",
  progressBatchTitle: "AIdea กำลังสร้างโปรไฟล์ผู้เขียน",
  close: "ปิด",
  minimize: "ย่อ",
  restore: "คืนค่า",
  elapsed: "ใช้เวลา",
  eta: "เหลือ",
  done: "เสร็จ",
  skipped: "ข้าม",
  failed: "ล้มเหลว",
  metaGeneratedAt: "สร้างเมื่อ",
  metaModel: "โมเดล",
  metaSources: "แหล่งข้อมูล",
  stageMetadata: "อ่าน metadata ของรายการ Zotero",
  stagePdf: "อ่านหลักฐานผู้เขียนที่ติดต่อได้จาก PDF ในเครื่อง",
  stageSources: "ค้นหา Crossref / OpenAlex / Semantic Scholar / PMC",
  stageResolve: "รวมข้อมูลผู้เขียนและระบุผู้เขียนที่ติดต่อได้",
  stageEnrich: "เติมตัวชี้วัดและสังกัดของผู้เขียน",
  stageLlm: "เรียกใช้โมเดล AIdea ปัจจุบัน",
  stageNote: "เขียนโน้ตย่อยของ Zotero",
  doneCreated: "สร้างโปรไฟล์ผู้เขียนที่ติดต่อได้แล้ว",
  doneUpdated: "อัปเดตโปรไฟล์ผู้เขียนที่ติดต่อได้แล้ว",
  generationFailed: "สร้างไม่สำเร็จ",
  batchFinishedWithFailures: "ประมวลผลเสร็จ แต่บางรายการล้มเหลว",
  generationCompleted: "สร้างโปรไฟล์ผู้เขียนเสร็จแล้ว",
  emptyResponseError: "AI ส่งคืนโปรไฟล์ผู้เขียนว่าง",
  headings: {
    correspondingAuthor: "ผู้เขียนที่ติดต่อได้",
    academicInformation: "ข้อมูลทางวิชาการ",
    relationToPaper: "ความเกี่ยวข้องกับบทความนี้",
    sources: "แหล่งที่มา",
  },
  fields: {
    name: "ชื่อ",
    affiliation: "สังกัด",
    email: "อีเมล",
    evidenceConfidence: "หลักฐานและความเชื่อมั่น",
    paperRelatedTopics: "หัวข้อที่เกี่ยวข้องกับบทความ",
    publicScholarlyIndicators: "ตัวชี้วัดทางวิชาการสาธารณะ",
    evidence: "หลักฐาน",
    dataSources: "แหล่งข้อมูล",
  },
  relationInstruction: "เขียนหนึ่งย่อหน้าเชิงวิชาการอย่างกระชับ",
  missingMetrics: "ไม่พบตัวชี้วัดทางวิชาการสาธารณะที่เชื่อถือได้",
  paperTopicRule:
    "อธิบายความสนใจเป็นหัวข้อที่เกี่ยวข้องกับบทความ เว้นแต่หลักฐานจะให้โปรไฟล์ผู้เขียนที่กว้างกว่าโดยตรง",
});

patchCopy("id", {
  menuSingle: "AIdea: buat profil penulis korespondensi",
  menuBatch: (count) => `AIdea: buat profil penulis (${count} item)`,
  confirmBatch: (count) =>
    `AIdea akan membuat profil penulis untuk ${count} item terpilih secara berurutan. Profil AIdea yang sudah ada akan dibuat ulang dan ditimpa. Lanjutkan?`,
  progressSingleTitle: "AIdea sedang membuat profil penulis",
  progressBatchTitle: "AIdea sedang membuat profil penulis",
  close: "Tutup",
  minimize: "Minimalkan",
  restore: "Pulihkan",
  elapsed: "Berjalan",
  eta: "Sisa",
  done: "Selesai",
  skipped: "Dilewati",
  failed: "Gagal",
  metaGeneratedAt: "Dibuat",
  metaModel: "Model",
  metaSources: "Sumber",
  stageMetadata: "Membaca metadata item Zotero",
  stagePdf: "Membaca bukti penulis korespondensi dari PDF lokal",
  stageSources: "Mengueri Crossref / OpenAlex / Semantic Scholar / PMC",
  stageResolve:
    "Menggabungkan catatan penulis dan menentukan penulis korespondensi",
  stageEnrich: "Melengkapi metrik dan afiliasi penulis",
  stageLlm: "Memanggil model AIdea saat ini",
  stageNote: "Menulis catatan anak Zotero",
  doneCreated: "Profil penulis korespondensi dibuat",
  doneUpdated: "Profil penulis korespondensi diperbarui",
  generationFailed: "Pembuatan gagal",
  batchFinishedWithFailures: "Batch selesai dengan beberapa kegagalan",
  generationCompleted: "Pembuatan profil penulis selesai",
  emptyResponseError: "AI mengembalikan profil penulis kosong",
  headings: {
    correspondingAuthor: "Penulis korespondensi",
    academicInformation: "Informasi akademik",
    relationToPaper: "Hubungan dengan artikel ini",
    sources: "Sumber",
  },
  fields: {
    name: "Nama",
    affiliation: "Afiliasi",
    email: "Email",
    evidenceConfidence: "Bukti dan keyakinan",
    paperRelatedTopics: "Topik terkait artikel",
    publicScholarlyIndicators: "Indikator akademik publik",
    evidence: "Bukti",
    dataSources: "Sumber data",
  },
  relationInstruction: "Tulis satu paragraf akademik yang ringkas.",
  missingMetrics:
    "Tidak ditemukan indikator akademik publik yang dapat diandalkan.",
  paperTopicRule:
    "Jelaskan fokus sebagai topik terkait artikel kecuali bukti secara langsung memberi profil penulis yang lebih luas.",
});

patchCopy("uk", {
  menuSingle: "AIdea: створити профіль автора для листування",
  menuBatch: (count) => `AIdea: створити профілі авторів (${count} елементів)`,
  confirmBatch: (count) =>
    `AIdea послідовно створить профілі авторів для ${count} вибраних елементів. Наявні профілі AIdea буде створено заново і замінено. Продовжити?`,
  progressSingleTitle: "AIdea створює профіль автора",
  progressBatchTitle: "AIdea створює профілі авторів",
  close: "Закрити",
  minimize: "Згорнути",
  restore: "Відновити",
  elapsed: "Минуло",
  eta: "Залишилось",
  done: "Готово",
  skipped: "Пропущено",
  failed: "Помилка",
  metaGeneratedAt: "Створено",
  metaModel: "Модель",
  metaSources: "Джерела",
  stageMetadata: "Читання метаданих елемента Zotero",
  stagePdf: "Читання доказів автора для листування з локальних PDF",
  stageSources: "Запит Crossref / OpenAlex / Semantic Scholar / PMC",
  stageResolve: "Об'єднання записів авторів і визначення автора для листування",
  stageEnrich: "Доповнення метрик та афіліацій автора",
  stageLlm: "Виклик поточної моделі AIdea",
  stageNote: "Запис дочірньої нотатки Zotero",
  doneCreated: "Профіль автора для листування створено",
  doneUpdated: "Профіль автора для листування оновлено",
  generationFailed: "Не вдалося створити",
  batchFinishedWithFailures: "Пакетну обробку завершено з деякими помилками",
  generationCompleted: "Створення профілю автора завершено",
  emptyResponseError: "AI повернув порожній профіль автора",
  headings: {
    correspondingAuthor: "Автор для листування",
    academicInformation: "Академічна інформація",
    relationToPaper: "Зв'язок із цією статтею",
    sources: "Джерела",
  },
  fields: {
    name: "Ім'я",
    affiliation: "Афіліація",
    email: "Електронна пошта",
    evidenceConfidence: "Доказ і впевненість",
    paperRelatedTopics: "Теми, пов'язані зі статтею",
    publicScholarlyIndicators: "Публічні академічні показники",
    evidence: "Доказ",
    dataSources: "Джерела даних",
  },
  relationInstruction: "Написати один стислий академічний абзац.",
  missingMetrics: "Надійні публічні академічні показники не знайдено.",
  paperTopicRule:
    "Описувати фокус як теми, пов'язані зі статтею, якщо докази прямо не дають ширший профіль автора.",
});

const UI_LANGUAGE_TO_AUTHOR_LANGUAGE: Record<PanelLang, string> = {
  "en-US": "en",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "fr-FR": "fr",
  "de-DE": "de",
  "es-ES": "es",
  "ru-RU": "ru",
  "pt-BR": "pt",
  "ar-SA": "ar",
  "hi-IN": "hi",
};

export const AUTHOR_PROFILE_SETTINGS_I18N: Record<
  PanelLang,
  Record<string, string>
> = Object.entries(UI_LANGUAGE_TO_AUTHOR_LANGUAGE).reduce(
  (acc, [uiLanguage, code]) => {
    const copy = {
      ...COPY_BY_LANGUAGE.en,
      ...(COPY_BY_LANGUAGE[code] || {}),
    };
    acc[uiLanguage as PanelLang] = {
      authorProfilesTitle: copy.settingsTitle,
      authorProfilesContextMenu: copy.settingsContextMenu,
      authorProfilesContextMenuHint: copy.settingsContextMenuHint,
      authorProfilesModel:
        copy.settingsModel || COPY_BY_LANGUAGE.en.settingsModel || "",
      authorProfilesModelFollow:
        copy.settingsModelFollow ||
        COPY_BY_LANGUAGE.en.settingsModelFollow ||
        "",
      authorProfilesLanguage: copy.settingsLanguage,
      authorProfilesLanguageFollow:
        copy.settingsLanguageFollow ||
        COPY_BY_LANGUAGE.en.settingsLanguageFollow ||
        "",
      authorProfilesLanguageHint: copy.settingsLanguageHint,
      authorProfilesBeta: copy.beta || COPY_BY_LANGUAGE.en.beta || "BETA",
    };
    return acc;
  },
  {} as Record<PanelLang, Record<string, string>>,
);

export function normalizeAuthorProfileLanguage(value: string): string {
  const normalized = String(value || "").trim();
  return EXTRA_LANGUAGE_ALIASES[normalized] || normalized || "zh-CN";
}

export function getAuthorProfileCopy(language: string): AuthorProfileCopy {
  const normalized = normalizeAuthorProfileLanguage(language);
  return COPY_BY_LANGUAGE[normalized] || COPY_BY_LANGUAGE.en;
}

export function getAllAuthorProfileNoteTitles(): string[] {
  return Array.from(
    new Set(Object.values(COPY_BY_LANGUAGE).map((copy) => copy.noteTitle)),
  );
}
