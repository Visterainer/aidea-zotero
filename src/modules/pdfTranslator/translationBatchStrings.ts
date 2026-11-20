import { getPanelLang } from "../contextPanel/i18n";
import { getQueueCopy } from "./queueI18n";
import type { PanelLang } from "../contextPanel/languages";

export type BatchPreview = {
  failed?: number;
  documents: number;
  skip: number;
  generate: number;
  replace: number;
  missing: number;
};

type IntakeCounts = { added: number; duplicates: number; withoutPdf: number };

type Labels = {
  menu: string;
  prepared: string;
  drop: string;
  addSelected: string;
  selectItems: string;
  begin: string;
  overwrite: string;
  overwriteWarning: string;
  changedOutputs: string;
  needFormat: string;
  needDestination: string;
  needFolder: string;
  retryFailed: string;
  outputs: string;
  preflight: (s: BatchPreview) => string;
  staged: (r: IntakeCounts) => string;
};

const labels: Record<PanelLang, Labels> = {
  "en-US": {
    changedOutputs:
      "The existing output changed after confirmation. Add this document to a new batch and review the replacements again.",
    menu: "Prepare translation batch",
    prepared: "Open the Translate tab to review and start the batch.",
    drop: "Drop Zotero items here",
    addSelected: "Add selected",
    selectItems: "Select items in the Zotero library first.",
    begin: "Begin batch",
    overwrite: "Replace existing translations for this run",
    overwriteWarning:
      "Replacing an existing translation may lose annotations on the translated PDF. Continue?",
    needFormat: "Choose at least one output format.",
    needDestination: "Choose at least one destination for the translation.",
    needFolder: "Choose an output folder to save translated PDFs.",
    retryFailed: "Retry failed",
    outputs: "Outputs",
    preflight: (s) =>
      `Documents: ${s.documents}\nSkip: ${s.skip}\nTranslate: ${s.generate}\nMissing outputs: ${s.missing}\nOutputs to replace: ${s.replace}`,
    staged: (r) =>
      `Added: ${r.added}; already listed: ${r.duplicates}; without a PDF: ${r.withoutPdf}`,
  },
  "zh-CN": {
    changedOutputs:
      "已有输出在确认后发生了变化。请将此文档加入新批次并重新确认替换项。",
    menu: "准备批量翻译",
    prepared: "请在“翻译”标签页中检查并开始批量翻译。",
    drop: "将 Zotero 条目拖到此处",
    addSelected: "添加所选条目",
    selectItems: "请先在 Zotero 文献库中选择条目。",
    begin: "开始批量翻译",
    overwrite: "仅本次替换已有译文",
    overwriteWarning: "替换已有译文可能会丢失译文 PDF 中的批注。是否继续？",
    needFormat: "请至少选择一种输出格式。",
    needDestination: "请至少选择一个译文保存位置。",
    needFolder: "请选择用于保存译文 PDF 的输出文件夹。",
    retryFailed: "重试失败项",
    outputs: "输出",
    preflight: (s) =>
      `文档：${s.documents} 篇\n跳过：${s.skip} 篇\n需翻译：${s.generate} 篇\n缺少的输出：${s.missing} 项\n将替换的输出：${s.replace} 项`,
    staged: (r) =>
      `已添加 ${r.added} 篇；已在列表中 ${r.duplicates} 篇；无 PDF ${r.withoutPdf} 项`,
  },
  "zh-TW": {
    changedOutputs:
      "現有輸出在確認後有所變更。請將此文件加入新批次，並重新確認要取代的項目。",
    menu: "準備批次翻譯",
    prepared: "請在「翻譯」分頁中檢查並開始批次翻譯。",
    drop: "將 Zotero 項目拖曳到這裡",
    addSelected: "加入所選項目",
    selectItems: "請先在 Zotero 文獻庫中選取項目。",
    begin: "開始批次翻譯",
    overwrite: "僅本次取代現有譯文",
    overwriteWarning: "取代現有譯文可能會遺失譯文 PDF 中的註解。是否繼續？",
    needFormat: "請至少選取一種輸出格式。",
    needDestination: "請至少選取一個譯文儲存位置。",
    needFolder: "請選取用於儲存譯文 PDF 的輸出資料夾。",
    retryFailed: "重試失敗項目",
    outputs: "輸出",
    preflight: (s) =>
      `文件：${s.documents} 篇\n略過：${s.skip} 篇\n需翻譯：${s.generate} 篇\n缺少的輸出：${s.missing} 項\n將取代的輸出：${s.replace} 項`,
    staged: (r) =>
      `已加入 ${r.added} 篇；已在清單中 ${r.duplicates} 篇；無 PDF ${r.withoutPdf} 項`,
  },
  "ja-JP": {
    changedOutputs:
      "確認後に既存の出力が変更されました。この文書を新しい一括翻訳に追加して、置き換える出力を再確認してください。",
    menu: "一括翻訳を準備",
    prepared: "「翻訳」タブで内容を確認し、一括翻訳を開始してください。",
    drop: "Zotero のアイテムをここにドロップ",
    addSelected: "選択項目を追加",
    selectItems: "先に Zotero ライブラリで項目を選択してください。",
    begin: "一括翻訳を開始",
    overwrite: "今回のみ既存の訳文を置き換える",
    overwriteWarning:
      "既存の訳文を置き換えると、翻訳済み PDF の注釈が失われる可能性があります。続行しますか？",
    needFormat: "出力形式を少なくとも 1 つ選択してください。",
    needDestination: "保存先を少なくとも 1 つ選択してください。",
    needFolder: "翻訳済み PDF の出力フォルダーを選択してください。",
    retryFailed: "失敗した項目を再試行",
    outputs: "出力",
    preflight: (s) =>
      `文書：${s.documents} 件\nスキップ：${s.skip} 件\n翻訳：${s.generate} 件\n不足している出力：${s.missing} 件\n置き換える出力：${s.replace} 件`,
    staged: (r) =>
      `追加：${r.added} 件、追加済み：${r.duplicates} 件、PDF なし：${r.withoutPdf} 件`,
  },
  "ko-KR": {
    changedOutputs:
      "확인한 뒤 기존 출력이 변경되었습니다. 이 문서를 새 일괄 번역에 추가하고 교체할 출력을 다시 확인하세요.",
    menu: "일괄 번역 준비",
    prepared: "번역 탭에서 내용을 확인하고 일괄 번역을 시작하세요.",
    drop: "여기에 Zotero 항목 놓기",
    addSelected: "선택 항목 추가",
    selectItems: "먼저 Zotero 라이브러리에서 항목을 선택하세요.",
    begin: "일괄 번역 시작",
    overwrite: "이번에만 기존 번역본 교체",
    overwriteWarning:
      "기존 번역본을 교체하면 번역된 PDF의 주석이 사라질 수 있습니다. 계속할까요?",
    needFormat: "출력 형식을 하나 이상 선택하세요.",
    needDestination: "저장 위치를 하나 이상 선택하세요.",
    needFolder: "번역된 PDF를 저장할 출력 폴더를 선택하세요.",
    retryFailed: "실패 항목 다시 시도",
    outputs: "출력",
    preflight: (s) =>
      `문서: ${s.documents}개\n건너뛰기: ${s.skip}개\n번역: ${s.generate}개\n누락된 출력: ${s.missing}개\n교체할 출력: ${s.replace}개`,
    staged: (r) =>
      `추가: ${r.added}개, 이미 목록에 있음: ${r.duplicates}개, PDF 없음: ${r.withoutPdf}개`,
  },
  "fr-FR": {
    changedOutputs:
      "Une sortie existante a changé depuis la confirmation. Ajoutez le document à un nouveau lot et vérifiez les remplacements.",
    menu: "Préparer un lot de traduction",
    prepared: "Vérifiez le lot dans l’onglet Traduction avant de le lancer.",
    drop: "Déposez des éléments Zotero ici",
    addSelected: "Ajouter la sélection",
    selectItems:
      "Sélectionnez d’abord des éléments dans la bibliothèque Zotero.",
    begin: "Lancer le lot",
    overwrite: "Remplacer les traductions existantes pour cette exécution",
    overwriteWarning:
      "Le remplacement risque de supprimer les annotations du PDF traduit. Continuer ?",
    needFormat: "Choisissez au moins un format de sortie.",
    needDestination: "Choisissez au moins une destination.",
    needFolder: "Choisissez un dossier pour enregistrer les PDF traduits.",
    retryFailed: "Réessayer les échecs",
    outputs: "Sorties",
    preflight: (s) =>
      `Documents : ${s.documents}\nÀ ignorer : ${s.skip}\nÀ traduire : ${s.generate}\nSorties manquantes : ${s.missing}\nSorties à remplacer : ${s.replace}`,
    staged: (r) =>
      `Ajouts : ${r.added} ; déjà dans la liste : ${r.duplicates} ; sans PDF : ${r.withoutPdf}`,
  },
  "de-DE": {
    changedOutputs:
      "Eine vorhandene Ausgabe wurde nach der Bestätigung geändert. Fügen Sie das Dokument einem neuen Stapel hinzu und prüfen Sie die Ersetzungen erneut.",
    menu: "Stapelübersetzung vorbereiten",
    prepared: "Prüfen und starten Sie den Stapel im Tab „Übersetzen“.",
    drop: "Zotero-Einträge hier ablegen",
    addSelected: "Auswahl hinzufügen",
    selectItems: "Wählen Sie zuerst Einträge in der Zotero-Bibliothek aus.",
    begin: "Stapel starten",
    overwrite: "Vorhandene Übersetzungen nur dieses Mal ersetzen",
    overwriteWarning:
      "Beim Ersetzen können Anmerkungen im übersetzten PDF verloren gehen. Fortfahren?",
    needFormat: "Wählen Sie mindestens ein Ausgabeformat.",
    needDestination: "Wählen Sie mindestens ein Speicherziel.",
    needFolder: "Wählen Sie einen Ausgabeordner für übersetzte PDFs.",
    retryFailed: "Fehlgeschlagene erneut versuchen",
    outputs: "Ausgaben",
    preflight: (s) =>
      `Dokumente: ${s.documents}\nÜberspringen: ${s.skip}\nÜbersetzen: ${s.generate}\nFehlende Ausgaben: ${s.missing}\nZu ersetzende Ausgaben: ${s.replace}`,
    staged: (r) =>
      `Hinzugefügt: ${r.added}; bereits gelistet: ${r.duplicates}; ohne PDF: ${r.withoutPdf}`,
  },
  "es-ES": {
    changedOutputs:
      "Una salida existente cambió después de la confirmación. Añade el documento a un lote nuevo y vuelve a revisar los reemplazos.",
    menu: "Preparar lote de traducción",
    prepared: "Revisa e inicia el lote en la pestaña Traducir.",
    drop: "Suelta aquí elementos de Zotero",
    addSelected: "Añadir selección",
    selectItems: "Selecciona primero los elementos en la biblioteca de Zotero.",
    begin: "Iniciar lote",
    overwrite: "Reemplazar traducciones existentes solo esta vez",
    overwriteWarning:
      "Al reemplazar una traducción se pueden perder las anotaciones del PDF traducido. ¿Continuar?",
    needFormat: "Elige al menos un formato de salida.",
    needDestination: "Elige al menos un destino.",
    needFolder: "Elige una carpeta para guardar los PDF traducidos.",
    retryFailed: "Reintentar los fallidos",
    outputs: "Salidas",
    preflight: (s) =>
      `Documentos: ${s.documents}\nOmitir: ${s.skip}\nTraducir: ${s.generate}\nSalidas que faltan: ${s.missing}\nSalidas que se reemplazarán: ${s.replace}`,
    staged: (r) =>
      `Añadidos: ${r.added}; ya en la lista: ${r.duplicates}; sin PDF: ${r.withoutPdf}`,
  },
  "ru-RU": {
    changedOutputs:
      "Существующий результат изменился после подтверждения. Добавьте документ в новый пакет и проверьте замены ещё раз.",
    menu: "Подготовить пакет перевода",
    prepared: "Проверьте и запустите пакет на вкладке перевода.",
    drop: "Перетащите сюда элементы Zotero",
    addSelected: "Добавить выбранные",
    selectItems: "Сначала выберите элементы в библиотеке Zotero.",
    begin: "Запустить пакет",
    overwrite: "Заменить существующие переводы только в этот раз",
    overwriteWarning:
      "При замене перевода могут быть утрачены аннотации в переведённом PDF. Продолжить?",
    needFormat: "Выберите хотя бы один выходной формат.",
    needDestination: "Выберите хотя бы одно место сохранения.",
    needFolder: "Выберите папку для сохранения переведённых PDF.",
    retryFailed: "Повторить неудачные",
    outputs: "Результаты",
    preflight: (s) =>
      `Документов: ${s.documents}\nПропустить: ${s.skip}\nПеревести: ${s.generate}\nНедостающих результатов: ${s.missing}\nБудет заменено: ${s.replace}`,
    staged: (r) =>
      `Добавлено: ${r.added}; уже в списке: ${r.duplicates}; без PDF: ${r.withoutPdf}`,
  },
  "pt-BR": {
    changedOutputs:
      "Uma saída existente mudou após a confirmação. Adicione o documento a um novo lote e revise as substituições novamente.",
    menu: "Preparar lote de tradução",
    prepared: "Revise e inicie o lote na aba Traduzir.",
    drop: "Solte itens do Zotero aqui",
    addSelected: "Adicionar seleção",
    selectItems: "Selecione primeiro os itens na biblioteca do Zotero.",
    begin: "Iniciar lote",
    overwrite: "Substituir traduções existentes só desta vez",
    overwriteWarning:
      "A substituição pode causar a perda de anotações no PDF traduzido. Continuar?",
    needFormat: "Escolha pelo menos um formato de saída.",
    needDestination: "Escolha pelo menos um destino.",
    needFolder: "Escolha uma pasta para salvar os PDFs traduzidos.",
    retryFailed: "Tentar novamente os que falharam",
    outputs: "Saídas",
    preflight: (s) =>
      `Documentos: ${s.documents}\nIgnorar: ${s.skip}\nTraduzir: ${s.generate}\nSaídas ausentes: ${s.missing}\nSaídas a substituir: ${s.replace}`,
    staged: (r) =>
      `Adicionados: ${r.added}; já na lista: ${r.duplicates}; sem PDF: ${r.withoutPdf}`,
  },
  "fa-IR": {
    changedOutputs:
      "پس از تأیید شما یکی از خروجی‌های موجود تغییر کرده است. سند را به گروه تازه‌ای بیفزایید و موارد جایگزین را دوباره بررسی کنید.",
    menu: "آماده‌سازی ترجمهٔ گروهی",
    prepared:
      "در زبانهٔ «ترجمه»، فهرست را بررسی کنید و ترجمهٔ گروهی را آغاز کنید.",
    drop: "موارد Zotero را اینجا رها کنید",
    addSelected: "افزودن موارد انتخاب‌شده",
    selectItems: "ابتدا مواردی را در کتابخانهٔ Zotero انتخاب کنید.",
    begin: "آغاز ترجمهٔ گروهی",
    overwrite: "فقط این بار ترجمه‌های موجود جایگزین شوند",
    overwriteWarning:
      "با جایگزین کردن ترجمه، ممکن است یادداشت‌های روی PDF ترجمه‌شده از دست بروند. ادامه می‌دهید؟",
    needFormat: "دست‌کم یک قالب خروجی انتخاب کنید.",
    needDestination: "دست‌کم یک محل برای ذخیرهٔ ترجمه انتخاب کنید.",
    needFolder: "پوشه‌ای برای ذخیرهٔ فایل‌های PDF ترجمه‌شده انتخاب کنید.",
    retryFailed: "تلاش دوباره برای موارد ناموفق",
    outputs: "خروجی‌ها",
    preflight: (s) =>
      `تعداد سندها: ${s.documents}\nرد می‌شوند: ${s.skip}\nترجمه می‌شوند: ${s.generate}\nخروجی‌های ناموجود: ${s.missing}\nخروجی‌هایی که جایگزین می‌شوند: ${s.replace}`,
    staged: (r) =>
      `افزوده شد: ${r.added}؛ از پیش در فهرست: ${r.duplicates}؛ بدون PDF: ${r.withoutPdf}`,
  },
  "ar-SA": {
    changedOutputs:
      "تغيّر أحد المخرجات الموجودة بعد التأكيد. أضف المستند إلى دفعة جديدة وراجع المخرجات المراد استبدالها مجددًا.",
    menu: "إعداد دفعة ترجمة",
    prepared: "راجع الدفعة وابدأها من تبويب الترجمة.",
    drop: "أفلت عناصر Zotero هنا",
    addSelected: "إضافة العناصر المحددة",
    selectItems: "حدد عناصر من مكتبة Zotero أولًا.",
    begin: "بدء الدفعة",
    overwrite: "استبدال الترجمات الموجودة هذه المرة فقط",
    overwriteWarning:
      "قد يؤدي استبدال الترجمة إلى فقدان التعليقات التوضيحية في ملف PDF المترجم. هل تريد المتابعة؟",
    needFormat: "اختر تنسيق إخراج واحدًا على الأقل.",
    needDestination: "اختر وجهة واحدة على الأقل لحفظ الترجمة.",
    needFolder: "اختر مجلدًا لحفظ ملفات PDF المترجمة.",
    retryFailed: "إعادة محاولة العناصر الفاشلة",
    outputs: "المخرجات",
    preflight: (s) =>
      `المستندات: ${s.documents}\nللتخطي: ${s.skip}\nللترجمة: ${s.generate}\nالمخرجات الناقصة: ${s.missing}\nالمخرجات المراد استبدالها: ${s.replace}`,
    staged: (r) =>
      `أُضيف: ${r.added}؛ موجود في القائمة: ${r.duplicates}؛ بدون PDF: ${r.withoutPdf}`,
  },
  "hi-IN": {
    changedOutputs:
      "पुष्टि के बाद मौजूदा आउटपुट बदल गया है। दस्तावेज़ को नए बैच में जोड़ें और बदले जाने वाले आउटपुट की फिर से जाँच करें।",
    menu: "अनुवाद बैच तैयार करें",
    prepared: "अनुवाद टैब में बैच की जाँच करें और उसे शुरू करें।",
    drop: "Zotero के आइटम यहाँ छोड़ें",
    addSelected: "चुने हुए आइटम जोड़ें",
    selectItems: "पहले Zotero लाइब्रेरी में आइटम चुनें।",
    begin: "बैच शुरू करें",
    overwrite: "केवल इस बार मौजूदा अनुवाद बदलें",
    overwriteWarning:
      "मौजूदा अनुवाद बदलने से अनूदित PDF की टिप्पणियाँ मिट सकती हैं। जारी रखें?",
    needFormat: "कम से कम एक आउटपुट प्रारूप चुनें।",
    needDestination: "अनुवाद सहेजने के लिए कम से कम एक स्थान चुनें।",
    needFolder: "अनूदित PDF सहेजने के लिए एक फ़ोल्डर चुनें।",
    retryFailed: "विफल आइटम फिर आज़माएँ",
    outputs: "आउटपुट",
    preflight: (s) =>
      `दस्तावेज़: ${s.documents}\nछोड़ेंगे: ${s.skip}\nअनुवाद करेंगे: ${s.generate}\nअनुपलब्ध आउटपुट: ${s.missing}\nबदले जाने वाले आउटपुट: ${s.replace}`,
    staged: (r) =>
      `जोड़े गए: ${r.added}; पहले से सूची में: ${r.duplicates}; बिना PDF: ${r.withoutPdf}`,
  },
};

export function batchCopy(lang: PanelLang = getPanelLang()) {
  const c = labels[lang] || labels["en-US"];
  return {
    ...c,
    menuAdd: (count: number) => `AIdea: ${c.menu} (${count})`,
    confirm: (s: BatchPreview) =>
      c.preflight(s) +
      (s.failed ? `\n${getQueueCopy(lang).status.failed}: ${s.failed}` : "") +
      (s.replace > 0 ? `\n\n${c.overwriteWarning}` : ""),
  };
}
