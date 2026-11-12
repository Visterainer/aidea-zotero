/* ---------------------------------------------------------------------------
 * pdfTranslator/menuI18n.ts  –  Strings for the library "translate PDF" menu
 *
 * Covers every language the panel UI supports (see contextPanel/languages).
 * -------------------------------------------------------------------------*/

import type { PanelLang } from "../contextPanel/languages";

export type TranslateMenuCopy = {
  menuTranslate: string;
  menuCancel: (percent: number) => string;
  progressTitle: string;
  preparing: string;
  translating: (percent: number) => string;
  page: (current: number, total: number) => string;
  cancelHint: string;
  confirmCancel: string;
  busy: string;
  noPdf: string;
  noModel: string;
  envNotReady: string;
  credentialsFailed: (detail: string) => string;
  failed: (detail: string) => string;
  cancelled: string;
  done: string;
  attachFailed: (detail: string, outputDir: string) => string;
  existsPrompt: (targetLang: string) => string;
  openExisting: string;
  translateAgain: string;
};

const COPY: Record<PanelLang, TranslateMenuCopy> = {
  "en-US": {
    menuTranslate: "AIdea: Translate full PDF",
    menuCancel: (percent) => `AIdea: Cancel PDF translation (${percent}%)`,
    progressTitle: "AIdea PDF translation",
    preparing: "Preparing translation…",
    translating: (percent) => `Translating… ${percent}%`,
    page: (current, total) => `page ${current}/${total}`,
    cancelHint:
      "To cancel, right-click any item and choose “Cancel PDF translation”.",
    confirmCancel: "Cancel the running PDF translation?",
    busy: "A PDF translation is already running. Wait for it to finish or cancel it first.",
    noPdf: "No PDF file was found for this item.",
    noModel:
      "No translation model is available. Choose a model in the AIdea Translate tab first.",
    envNotReady:
      "The translation environment is not ready. Install or repair it in the AIdea Translate tab.",
    credentialsFailed: (detail) =>
      `Could not get credentials for the translation model: ${detail}`,
    failed: (detail) => `Translation failed: ${detail}`,
    cancelled: "Translation cancelled.",
    done: "Translation finished and added to the item.",
    attachFailed: (detail, outputDir) =>
      `Translation finished, but the PDF could not be added to Zotero: ${detail}\nThe files are in: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `This item already has a translation of this PDF (${targetLang}).`,
    openExisting: "Open existing",
    translateAgain: "Translate again",
  },
  "zh-CN": {
    menuTranslate: "AIdea：翻译全文 PDF",
    menuCancel: (percent) => `AIdea：取消 PDF 翻译（${percent}%）`,
    progressTitle: "AIdea PDF 翻译",
    preparing: "正在准备翻译…",
    translating: (percent) => `翻译中… ${percent}%`,
    page: (current, total) => `第 ${current}/${total} 页`,
    cancelHint: "如需取消，请右键任意条目并选择“取消 PDF 翻译”。",
    confirmCancel: "要取消正在进行的 PDF 翻译吗？",
    busy: "已有 PDF 翻译任务正在运行，请等待完成或先取消。",
    noPdf: "未找到该条目的 PDF 文件。",
    noModel: "没有可用的翻译模型，请先在 AIdea 翻译标签页中选择模型。",
    envNotReady: "翻译环境尚未就绪，请在 AIdea 翻译标签页中安装或修复。",
    credentialsFailed: (detail) => `无法获取翻译模型的凭据：${detail}`,
    failed: (detail) => `翻译失败：${detail}`,
    cancelled: "翻译已取消。",
    done: "翻译完成，已添加到条目。",
    attachFailed: (detail, outputDir) =>
      `翻译已完成，但无法将 PDF 添加到 Zotero：${detail}\n文件位于：${outputDir}`,
    existsPrompt: (targetLang) => `该条目已有此 PDF 的译文（${targetLang}）。`,
    openExisting: "打开已有译文",
    translateAgain: "重新翻译",
  },
  "zh-TW": {
    menuTranslate: "AIdea：翻譯全文 PDF",
    menuCancel: (percent) => `AIdea：取消 PDF 翻譯（${percent}%）`,
    progressTitle: "AIdea PDF 翻譯",
    preparing: "正在準備翻譯…",
    translating: (percent) => `翻譯中… ${percent}%`,
    page: (current, total) => `第 ${current}/${total} 頁`,
    cancelHint: "如需取消，請右鍵任一項目並選擇「取消 PDF 翻譯」。",
    confirmCancel: "要取消正在進行的 PDF 翻譯嗎？",
    busy: "已有 PDF 翻譯工作正在執行，請等待完成或先取消。",
    noPdf: "找不到此項目的 PDF 檔案。",
    noModel: "沒有可用的翻譯模型，請先在 AIdea 翻譯分頁中選擇模型。",
    envNotReady: "翻譯環境尚未就緒，請在 AIdea 翻譯分頁中安裝或修復。",
    credentialsFailed: (detail) => `無法取得翻譯模型的憑證：${detail}`,
    failed: (detail) => `翻譯失敗：${detail}`,
    cancelled: "翻譯已取消。",
    done: "翻譯完成，已加入項目。",
    attachFailed: (detail, outputDir) =>
      `翻譯已完成，但無法將 PDF 加入 Zotero：${detail}\n檔案位於：${outputDir}`,
    existsPrompt: (targetLang) =>
      `此項目已有這份 PDF 的譯文（${targetLang}）。`,
    openExisting: "開啟現有譯文",
    translateAgain: "重新翻譯",
  },
  "ja-JP": {
    menuTranslate: "AIdea：PDF 全文を翻訳",
    menuCancel: (percent) => `AIdea：PDF 翻訳をキャンセル（${percent}%）`,
    progressTitle: "AIdea PDF 翻訳",
    preparing: "翻訳を準備中…",
    translating: (percent) => `翻訳中… ${percent}%`,
    page: (current, total) => `${current}/${total} ページ`,
    cancelHint:
      "キャンセルするには、アイテムを右クリックして「PDF 翻訳をキャンセル」を選択します。",
    confirmCancel: "実行中の PDF 翻訳をキャンセルしますか？",
    busy: "PDF 翻訳がすでに実行中です。完了を待つか、先にキャンセルしてください。",
    noPdf: "このアイテムの PDF ファイルが見つかりません。",
    noModel:
      "利用できる翻訳モデルがありません。先に AIdea の翻訳タブでモデルを選択してください。",
    envNotReady:
      "翻訳環境の準備ができていません。AIdea の翻訳タブでインストールまたは修復してください。",
    credentialsFailed: (detail) =>
      `翻訳モデルの認証情報を取得できませんでした：${detail}`,
    failed: (detail) => `翻訳に失敗しました：${detail}`,
    cancelled: "翻訳をキャンセルしました。",
    done: "翻訳が完了し、アイテムに追加されました。",
    attachFailed: (detail, outputDir) =>
      `翻訳は完了しましたが、PDF を Zotero に追加できませんでした：${detail}\nファイルの場所：${outputDir}`,
    existsPrompt: (targetLang) =>
      `このアイテムにはこの PDF の翻訳（${targetLang}）がすでにあります。`,
    openExisting: "既存の翻訳を開く",
    translateAgain: "再翻訳",
  },
  "ko-KR": {
    menuTranslate: "AIdea: PDF 전체 번역",
    menuCancel: (percent) => `AIdea: PDF 번역 취소 (${percent}%)`,
    progressTitle: "AIdea PDF 번역",
    preparing: "번역 준비 중…",
    translating: (percent) => `번역 중… ${percent}%`,
    page: (current, total) => `${current}/${total}쪽`,
    cancelHint:
      "취소하려면 항목을 마우스 오른쪽 버튼으로 클릭하고 “PDF 번역 취소”를 선택하세요.",
    confirmCancel: "진행 중인 PDF 번역을 취소할까요?",
    busy: "이미 PDF 번역이 진행 중입니다. 완료될 때까지 기다리거나 먼저 취소하세요.",
    noPdf: "이 항목의 PDF 파일을 찾을 수 없습니다.",
    noModel:
      "사용할 수 있는 번역 모델이 없습니다. 먼저 AIdea 번역 탭에서 모델을 선택하세요.",
    envNotReady:
      "번역 환경이 준비되지 않았습니다. AIdea 번역 탭에서 설치하거나 복구하세요.",
    credentialsFailed: (detail) =>
      `번역 모델의 인증 정보를 가져올 수 없습니다: ${detail}`,
    failed: (detail) => `번역 실패: ${detail}`,
    cancelled: "번역이 취소되었습니다.",
    done: "번역이 완료되어 항목에 추가되었습니다.",
    attachFailed: (detail, outputDir) =>
      `번역은 완료되었지만 PDF를 Zotero에 추가하지 못했습니다: ${detail}\n파일 위치: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `이 항목에는 이 PDF의 번역본(${targetLang})이 이미 있습니다.`,
    openExisting: "기존 번역 열기",
    translateAgain: "다시 번역",
  },
  "fr-FR": {
    menuTranslate: "AIdea : traduire le PDF complet",
    menuCancel: (percent) =>
      `AIdea : annuler la traduction du PDF (${percent} %)`,
    progressTitle: "Traduction PDF AIdea",
    preparing: "Préparation de la traduction…",
    translating: (percent) => `Traduction… ${percent} %`,
    page: (current, total) => `page ${current}/${total}`,
    cancelHint:
      "Pour annuler, faites un clic droit sur un élément et choisissez « Annuler la traduction du PDF ».",
    confirmCancel: "Annuler la traduction du PDF en cours ?",
    busy: "Une traduction de PDF est déjà en cours. Attendez qu’elle se termine ou annulez-la d’abord.",
    noPdf: "Aucun fichier PDF trouvé pour cet élément.",
    noModel:
      "Aucun modèle de traduction disponible. Choisissez d’abord un modèle dans l’onglet Traduction d’AIdea.",
    envNotReady:
      "L’environnement de traduction n’est pas prêt. Installez-le ou réparez-le dans l’onglet Traduction d’AIdea.",
    credentialsFailed: (detail) =>
      `Impossible d’obtenir les identifiants du modèle de traduction : ${detail}`,
    failed: (detail) => `Échec de la traduction : ${detail}`,
    cancelled: "Traduction annulée.",
    done: "Traduction terminée et ajoutée à l’élément.",
    attachFailed: (detail, outputDir) =>
      `Traduction terminée, mais le PDF n’a pas pu être ajouté à Zotero : ${detail}\nLes fichiers se trouvent dans : ${outputDir}`,
    existsPrompt: (targetLang) =>
      `Cet élément possède déjà une traduction de ce PDF (${targetLang}).`,
    openExisting: "Ouvrir l’existante",
    translateAgain: "Retraduire",
  },
  "de-DE": {
    menuTranslate: "AIdea: Gesamtes PDF übersetzen",
    menuCancel: (percent) => `AIdea: PDF-Übersetzung abbrechen (${percent} %)`,
    progressTitle: "AIdea PDF-Übersetzung",
    preparing: "Übersetzung wird vorbereitet…",
    translating: (percent) => `Übersetzung läuft… ${percent} %`,
    page: (current, total) => `Seite ${current}/${total}`,
    cancelHint:
      "Zum Abbrechen einen Eintrag mit der rechten Maustaste anklicken und „PDF-Übersetzung abbrechen“ wählen.",
    confirmCancel: "Die laufende PDF-Übersetzung abbrechen?",
    busy: "Es läuft bereits eine PDF-Übersetzung. Warten Sie, bis sie fertig ist, oder brechen Sie sie zuerst ab.",
    noPdf: "Für diesen Eintrag wurde keine PDF-Datei gefunden.",
    noModel:
      "Kein Übersetzungsmodell verfügbar. Wählen Sie zuerst ein Modell im AIdea-Tab „Übersetzen“.",
    envNotReady:
      "Die Übersetzungsumgebung ist nicht bereit. Installieren oder reparieren Sie sie im AIdea-Tab „Übersetzen“.",
    credentialsFailed: (detail) =>
      `Zugangsdaten für das Übersetzungsmodell konnten nicht abgerufen werden: ${detail}`,
    failed: (detail) => `Übersetzung fehlgeschlagen: ${detail}`,
    cancelled: "Übersetzung abgebrochen.",
    done: "Übersetzung abgeschlossen und zum Eintrag hinzugefügt.",
    attachFailed: (detail, outputDir) =>
      `Übersetzung abgeschlossen, aber das PDF konnte nicht zu Zotero hinzugefügt werden: ${detail}\nDie Dateien liegen in: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `Dieser Eintrag hat bereits eine Übersetzung dieses PDFs (${targetLang}).`,
    openExisting: "Vorhandene öffnen",
    translateAgain: "Erneut übersetzen",
  },
  "es-ES": {
    menuTranslate: "AIdea: traducir el PDF completo",
    menuCancel: (percent) =>
      `AIdea: cancelar la traducción del PDF (${percent} %)`,
    progressTitle: "Traducción de PDF de AIdea",
    preparing: "Preparando la traducción…",
    translating: (percent) => `Traduciendo… ${percent} %`,
    page: (current, total) => `página ${current}/${total}`,
    cancelHint:
      "Para cancelar, haz clic derecho en un elemento y elige «Cancelar la traducción del PDF».",
    confirmCancel: "¿Cancelar la traducción del PDF en curso?",
    busy: "Ya hay una traducción de PDF en curso. Espera a que termine o cancélala primero.",
    noPdf: "No se encontró ningún archivo PDF para este elemento.",
    noModel:
      "No hay ningún modelo de traducción disponible. Elige primero un modelo en la pestaña Traducir de AIdea.",
    envNotReady:
      "El entorno de traducción no está listo. Instálalo o repáralo en la pestaña Traducir de AIdea.",
    credentialsFailed: (detail) =>
      `No se pudieron obtener las credenciales del modelo de traducción: ${detail}`,
    failed: (detail) => `Error de traducción: ${detail}`,
    cancelled: "Traducción cancelada.",
    done: "Traducción terminada y añadida al elemento.",
    attachFailed: (detail, outputDir) =>
      `La traducción terminó, pero no se pudo añadir el PDF a Zotero: ${detail}\nLos archivos están en: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `Este elemento ya tiene una traducción de este PDF (${targetLang}).`,
    openExisting: "Abrir la existente",
    translateAgain: "Traducir de nuevo",
  },
  "ru-RU": {
    menuTranslate: "AIdea: перевести PDF целиком",
    menuCancel: (percent) => `AIdea: отменить перевод PDF (${percent} %)`,
    progressTitle: "Перевод PDF в AIdea",
    preparing: "Подготовка перевода…",
    translating: (percent) => `Перевод… ${percent} %`,
    page: (current, total) => `страница ${current}/${total}`,
    cancelHint:
      "Чтобы отменить, щёлкните правой кнопкой по любому элементу и выберите «Отменить перевод PDF».",
    confirmCancel: "Отменить выполняющийся перевод PDF?",
    busy: "Перевод PDF уже выполняется. Дождитесь завершения или сначала отмените его.",
    noPdf: "Для этого элемента не найден файл PDF.",
    noModel:
      "Нет доступной модели перевода. Сначала выберите модель на вкладке «Перевод» в AIdea.",
    envNotReady:
      "Среда перевода не готова. Установите или восстановите её на вкладке «Перевод» в AIdea.",
    credentialsFailed: (detail) =>
      `Не удалось получить учётные данные модели перевода: ${detail}`,
    failed: (detail) => `Ошибка перевода: ${detail}`,
    cancelled: "Перевод отменён.",
    done: "Перевод завершён и добавлен к элементу.",
    attachFailed: (detail, outputDir) =>
      `Перевод завершён, но PDF не удалось добавить в Zotero: ${detail}\nФайлы находятся в: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `У этого элемента уже есть перевод этого PDF (${targetLang}).`,
    openExisting: "Открыть имеющийся",
    translateAgain: "Перевести заново",
  },
  "pt-BR": {
    menuTranslate: "AIdea: traduzir o PDF completo",
    menuCancel: (percent) => `AIdea: cancelar a tradução do PDF (${percent}%)`,
    progressTitle: "Tradução de PDF do AIdea",
    preparing: "Preparando a tradução…",
    translating: (percent) => `Traduzindo… ${percent}%`,
    page: (current, total) => `página ${current}/${total}`,
    cancelHint:
      "Para cancelar, clique com o botão direito em um item e escolha “Cancelar a tradução do PDF”.",
    confirmCancel: "Cancelar a tradução do PDF em andamento?",
    busy: "Já existe uma tradução de PDF em andamento. Aguarde a conclusão ou cancele-a primeiro.",
    noPdf: "Nenhum arquivo PDF foi encontrado para este item.",
    noModel:
      "Nenhum modelo de tradução disponível. Escolha primeiro um modelo na aba Traduzir do AIdea.",
    envNotReady:
      "O ambiente de tradução não está pronto. Instale-o ou repare-o na aba Traduzir do AIdea.",
    credentialsFailed: (detail) =>
      `Não foi possível obter as credenciais do modelo de tradução: ${detail}`,
    failed: (detail) => `Falha na tradução: ${detail}`,
    cancelled: "Tradução cancelada.",
    done: "Tradução concluída e adicionada ao item.",
    attachFailed: (detail, outputDir) =>
      `A tradução foi concluída, mas não foi possível adicionar o PDF ao Zotero: ${detail}\nOs arquivos estão em: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `Este item já tem uma tradução deste PDF (${targetLang}).`,
    openExisting: "Abrir a existente",
    translateAgain: "Traduzir novamente",
  },
  "ar-SA": {
    menuTranslate: "AIdea: ترجمة ملف PDF كاملًا",
    menuCancel: (percent) => `AIdea: إلغاء ترجمة PDF (${percent}%)`,
    progressTitle: "ترجمة PDF في AIdea",
    preparing: "جارٍ تحضير الترجمة…",
    translating: (percent) => `جارٍ الترجمة… ${percent}%`,
    page: (current, total) => `الصفحة ${current}/${total}`,
    cancelHint:
      "للإلغاء، انقر بزر الفأرة الأيمن على أي عنصر واختر «إلغاء ترجمة PDF».",
    confirmCancel: "هل تريد إلغاء ترجمة PDF الجارية؟",
    busy: "توجد ترجمة PDF قيد التشغيل بالفعل. انتظر حتى تنتهي أو ألغِها أولًا.",
    noPdf: "لم يتم العثور على ملف PDF لهذا العنصر.",
    noModel:
      "لا يوجد نموذج ترجمة متاح. اختر نموذجًا أولًا من تبويب الترجمة في AIdea.",
    envNotReady:
      "بيئة الترجمة غير جاهزة. ثبّتها أو أصلحها من تبويب الترجمة في AIdea.",
    credentialsFailed: (detail) =>
      `تعذّر الحصول على بيانات اعتماد نموذج الترجمة: ${detail}`,
    failed: (detail) => `فشلت الترجمة: ${detail}`,
    cancelled: "تم إلغاء الترجمة.",
    done: "اكتملت الترجمة وأُضيفت إلى العنصر.",
    attachFailed: (detail, outputDir) =>
      `اكتملت الترجمة، لكن تعذّرت إضافة ملف PDF إلى Zotero: ${detail}\nالملفات موجودة في: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `يحتوي هذا العنصر بالفعل على ترجمة لهذا الملف (${targetLang}).`,
    openExisting: "فتح الترجمة الموجودة",
    translateAgain: "إعادة الترجمة",
  },
  "hi-IN": {
    menuTranslate: "AIdea: पूरा PDF अनुवाद करें",
    menuCancel: (percent) => `AIdea: PDF अनुवाद रद्द करें (${percent}%)`,
    progressTitle: "AIdea PDF अनुवाद",
    preparing: "अनुवाद की तैयारी हो रही है…",
    translating: (percent) => `अनुवाद हो रहा है… ${percent}%`,
    page: (current, total) => `पृष्ठ ${current}/${total}`,
    cancelHint:
      "रद्द करने के लिए किसी आइटम पर राइट-क्लिक करें और “PDF अनुवाद रद्द करें” चुनें।",
    confirmCancel: "चल रहा PDF अनुवाद रद्द करें?",
    busy: "एक PDF अनुवाद पहले से चल रहा है। उसके पूरा होने की प्रतीक्षा करें या पहले उसे रद्द करें।",
    noPdf: "इस आइटम के लिए कोई PDF फ़ाइल नहीं मिली।",
    noModel:
      "कोई अनुवाद मॉडल उपलब्ध नहीं है। पहले AIdea के अनुवाद टैब में मॉडल चुनें।",
    envNotReady:
      "अनुवाद परिवेश तैयार नहीं है। AIdea के अनुवाद टैब में इसे इंस्टॉल या ठीक करें।",
    credentialsFailed: (detail) =>
      `अनुवाद मॉडल के क्रेडेंशियल प्राप्त नहीं हो सके: ${detail}`,
    failed: (detail) => `अनुवाद विफल: ${detail}`,
    cancelled: "अनुवाद रद्द किया गया।",
    done: "अनुवाद पूरा हुआ और आइटम में जोड़ दिया गया।",
    attachFailed: (detail, outputDir) =>
      `अनुवाद पूरा हुआ, लेकिन PDF को Zotero में जोड़ा नहीं जा सका: ${detail}\nफ़ाइलें यहाँ हैं: ${outputDir}`,
    existsPrompt: (targetLang) =>
      `इस आइटम में इस PDF का अनुवाद (${targetLang}) पहले से मौजूद है।`,
    openExisting: "मौजूदा अनुवाद खोलें",
    translateAgain: "फिर से अनुवाद करें",
  },
};

export function getTranslateMenuCopy(lang: PanelLang): TranslateMenuCopy {
  return COPY[lang] || COPY["en-US"];
}
