import { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";
import { applyCurrentThemeToRoot } from "./contextPanel/theme";

export const NOTICE_ID = "v3.5.0-selection-translation-reliability-v1";
const NOTICE_PREF = `${config.prefsPrefix}.updateNoticeSeen`;

type UpdateNoticeCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  note: string;
  alsoLabel?: string;
  alsoItems?: Array<{ label: string; text: string }>;
  exampleLabel: string;
  examplePrompt: string;
  modeItems?: Array<{ label: string; text: string }>;
  confirm: string;
  close: string;
};

const COPIES: Record<PanelLang, UpdateNoticeCopy> = {
  "en-US": {
    eyebrow: "Update",
    title: "OpenAI OAuth now supports image generation",
    lead: "OpenAI OAuth authorization now supports image generation with image2.",
    note: "Note: Image generation is currently available only through OpenAI OAuth authorization.",
    exampleLabel: "Try this example",
    examplePrompt:
      "Create a research paper framework image to summarize the core content of the article.",
    confirm: "Copy example and confirm",
    close: "Close update notice",
  },
  "zh-CN": {
    eyebrow: "更新提示",
    title: "OpenAI OAuth 现在支持图片生成",
    lead: "OpenAI OAuth 授权方式现在支持使用 image2 进行图片生成。",
    note: "注意：图片生成功能目前仅支持 OpenAI OAuth 授权方式。",
    exampleLabel: "体验示例",
    examplePrompt: "生成一张论文框架图片，用作概述文章核心内容。",
    confirm: "复制示例并确认",
    close: "关闭更新提示",
  },
  "zh-TW": {
    eyebrow: "更新提示",
    title: "OpenAI OAuth 現在支援圖片生成",
    lead: "OpenAI OAuth 授權方式現在支援使用 image2 產生圖片。",
    note: "注意：圖片生成功能目前僅支援 OpenAI OAuth 授權方式。",
    exampleLabel: "體驗示例",
    examplePrompt: "生成一張論文框架圖片，用於概述文章核心內容。",
    confirm: "複製示例並確認",
    close: "關閉更新提示",
  },
  "ja-JP": {
    eyebrow: "更新のお知らせ",
    title: "OpenAI OAuth が画像生成に対応しました",
    lead: "OpenAI OAuth 認証で image2 による画像生成が利用できるようになりました。",
    note: "注意: 画像生成機能は現在 OpenAI OAuth 認証方式でのみ利用できます。",
    exampleLabel: "お試し例",
    examplePrompt:
      "論文の核心内容を概説するための論文フレームワーク画像を作成してください。",
    confirm: "例をコピーして確認",
    close: "更新通知を閉じる",
  },
  "ko-KR": {
    eyebrow: "업데이트 안내",
    title: "OpenAI OAuth가 이미지 생성을 지원합니다",
    lead: "OpenAI OAuth 인증 방식에서 image2를 사용한 이미지 생성이 지원됩니다.",
    note: "주의: 이미지 생성 기능은 현재 OpenAI OAuth 인증 방식에서만 지원됩니다.",
    exampleLabel: "체험 예시",
    examplePrompt:
      "논문의 핵심 내용을 개요로 보여 주는 논문 프레임워크 이미지를 생성해 주세요.",
    confirm: "예시 복사 후 확인",
    close: "업데이트 안내 닫기",
  },
  "fr-FR": {
    eyebrow: "Mise a jour",
    title: "OpenAI OAuth prend en charge la generation d'images",
    lead: "L'autorisation OpenAI OAuth prend maintenant en charge la generation d'images avec image2.",
    note: "Attention : la generation d'images est actuellement disponible uniquement avec l'autorisation OpenAI OAuth.",
    exampleLabel: "Exemple a essayer",
    examplePrompt:
      "Cree une image de cadre d'article scientifique pour resumer le contenu central de l'article.",
    confirm: "Copier l'exemple et confirmer",
    close: "Fermer l'avis de mise a jour",
  },
  "de-DE": {
    eyebrow: "Update",
    title: "OpenAI OAuth unterstuetzt jetzt Bilderzeugung",
    lead: "Die OpenAI-OAuth-Autorisierung unterstuetzt jetzt Bilderzeugung mit image2.",
    note: "Hinweis: Die Bilderzeugung ist derzeit nur ueber die OpenAI-OAuth-Autorisierung verfuegbar.",
    exampleLabel: "Beispiel ausprobieren",
    examplePrompt:
      "Erstelle ein Bild des Forschungsrahmens, das den Kerninhalt des Artikels zusammenfasst.",
    confirm: "Beispiel kopieren und bestaetigen",
    close: "Update-Hinweis schliessen",
  },
  "es-ES": {
    eyebrow: "Actualizacion",
    title: "OpenAI OAuth ahora admite generacion de imagenes",
    lead: "La autorizacion mediante OpenAI OAuth ahora admite generacion de imagenes con image2.",
    note: "Atencion: la generacion de imagenes actualmente solo esta disponible mediante OpenAI OAuth.",
    exampleLabel: "Ejemplo para probar",
    examplePrompt:
      "Crea una imagen del marco de un articulo academico para resumir el contenido central del articulo.",
    confirm: "Copiar ejemplo y confirmar",
    close: "Cerrar aviso de actualizacion",
  },
  "ru-RU": {
    eyebrow: "Obnovlenie",
    title: "OpenAI OAuth teper podderzhivaet generatsiyu izobrazheniy",
    lead: "Avtorizatsiya OpenAI OAuth teper podderzhivaet generatsiyu izobrazheniy s image2.",
    note: "Vnimanie: generatsiya izobrazheniy seychas dostupna tolko cherez OpenAI OAuth.",
    exampleLabel: "Primer dlya proby",
    examplePrompt:
      "Sozday izobrazhenie struktury nauchnoy stati, chtoby kratko pokazat osnovnoe soderzhanie stati.",
    confirm: "Skopirovat primer i podtverdit",
    close: "Zakryt uvedomlenie ob obnovlenii",
  },
  "pt-BR": {
    eyebrow: "Atualizacao",
    title: "OpenAI OAuth agora oferece geracao de imagens",
    lead: "A autorizacao OpenAI OAuth agora oferece geracao de imagens com image2.",
    note: "Atencao: a geracao de imagens atualmente esta disponivel apenas pela autorizacao OpenAI OAuth.",
    exampleLabel: "Exemplo para testar",
    examplePrompt:
      "Crie uma imagem da estrutura de um artigo academico para resumir o conteudo central do artigo.",
    confirm: "Copiar exemplo e confirmar",
    close: "Fechar aviso de atualizacao",
  },
  "ar-SA": {
    eyebrow: "تحديث",
    title: "يدعم OpenAI OAuth الآن توليد الصور",
    lead: "أصبح أسلوب التفويض OpenAI OAuth يدعم توليد الصور باستخدام image2.",
    note: "تنبيه: ميزة توليد الصور متاحة حالياً فقط عبر أسلوب التفويض OpenAI OAuth.",
    exampleLabel: "مثال للتجربة",
    examplePrompt:
      "أنشئ صورة لإطار ورقة بحثية تُستخدم لتلخيص المحتوى الأساسي للمقال.",
    confirm: "نسخ المثال والتأكيد",
    close: "إغلاق إشعار التحديث",
  },
  "hi-IN": {
    eyebrow: "अपडेट",
    title: "OpenAI OAuth अब image generation सपोर्ट करता है",
    lead: "OpenAI OAuth authorization अब image2 के साथ image generation सपोर्ट करता है।",
    note: "ध्यान दें: image generation feature अभी केवल OpenAI OAuth authorization method में उपलब्ध है।",
    exampleLabel: "Try करने का उदाहरण",
    examplePrompt:
      "Article के core content को summarize करने के लिए एक research paper framework image बनाएं।",
    confirm: "Example copy करें और confirm करें",
    close: "अपडेट सूचना बंद करें",
  },
};

const OAUTH_ENV_UPDATE_COPIES: Record<PanelLang, UpdateNoticeCopy> = {
  "en-US": {
    eyebrow: "Update",
    title: "Library sidebar and selection translation improvements",
    lead: "This update improves how AIdea appears in the Zotero Library and PDF reader sidebars, and makes first-use context preparation for selection translation more reliable.",
    note: "The plugin has been updated. Restart Zotero to make sure the new behavior is active.",
    alsoLabel: "This update includes",
    alsoItems: [
      {
        label: "Library multi-select",
        text: 'When multiple items are selected in the Library, Zotero\'s native "N items selected" message remains visible, and AIdea no longer covers it.',
      },
      {
        label: "Library single-item view",
        text: "When one item is selected, AIdea stays inside Zotero's native item pane. Info, Attachments, Notes, Tags, Related, and AIdea sections can be switched and scrolled normally.",
      },
      {
        label: "Empty selection",
        text: "When no item is selected, AIdea remains available in the Library sidebar for general chat.",
      },
      {
        label: "More stable selection translation",
        text: "When selection translation is first used for a paper, AIdea prepares local context automatically, reduces interference from reference lists, and adjusts the context if the paper is too long.",
      },
    ],
    exampleLabel: "Selection translation context preparation",
    examplePrompt: "",
    modeItems: [
      {
        label: "Per paper",
        text: "Each paper is prepared independently the first time selection translation is used.",
      },
      {
        label: "Local cache",
        text: "Later selections reuse the local context cache, so translation starts faster.",
      },
      {
        label: "Regenerate when needed",
        text: "Use Clear cold-start cache in Settings when you want AIdea to prepare the context again.",
      },
    ],
    confirm: "OK",
    close: "Close update notice",
  },
  "zh-CN": {
    eyebrow: "更新提示",
    title: "Library 侧边栏与划词翻译体验优化",
    lead: "本次更新优化了 AIdea 在 Zotero Library 和 PDF 阅读器中的侧边栏显示，并改进了划词翻译首次准备上下文的稳定性。",
    note: "插件已更新，请重启 Zotero 确保新功能生效。",
    alsoLabel: "本次更新包括",
    alsoItems: [
      {
        label: "Library 多选体验优化",
        text: "在 Library 中选择多个条目时，Zotero 原生的“已选择 N 个条目”提示会正常保留，AIdea 不再覆盖该提示。",
      },
      {
        label: "Library 单选体验优化",
        text: "选择单个条目时，AIdea 会作为 Zotero 原生条目面板的一部分显示，Info、Attachments、Notes、Tags、Related 和 AIdea 区域可以正常切换和滚动。",
      },
      {
        label: "空选状态继续可用",
        text: "未选择条目时，AIdea 仍会显示在 Library 侧边栏中，方便直接使用全局对话。",
      },
      {
        label: "划词翻译更稳定",
        text: "首次使用某篇文献的划词翻译时，AIdea 会自动准备本地上下文，并尽量减少参考文献部分对翻译理解的干扰。如果文章过长，AIdea 会自动调整上下文范围后重试，无需手动选择复杂度。",
      },
    ],
    exampleLabel: "划词翻译上下文准备",
    examplePrompt: "",
    modeItems: [
      {
        label: "每篇文献独立处理",
        text: "每篇文献首次使用划词翻译时，都会自动准备上下文。",
      },
      {
        label: "后续速度更快",
        text: "后续划词翻译会复用本地缓存，减少重复准备时间。",
      },
      {
        label: "需要时可重新生成",
        text: "如需重新生成上下文，可在设置中清理冷启动缓存。",
      },
    ],
    confirm: "确认",
    close: "关闭更新提示",
  },
  "zh-TW": {
    eyebrow: "更新提示",
    title: "支援背景自動更新 OAuth 設定環境",
    lead: "支援背景自動更新 OAuth 設定環境，更新頻率取決於 OAuth 提供商。",
    note: "注意：外掛已更新，請重啟 Zotero 以確保外掛生效。",
    exampleLabel: "OAuth 配置環境更新模式",
    examplePrompt: "",
    modeItems: [
      {
        label: "自動更新",
        text: "檢查到 OAuth 環境更新後顯示提示，60 秒內未操作則自動更新；稍後、關閉或最小化會暫停 24 小時。",
      },
      {
        label: "提示更新",
        text: "檢查到 OAuth 環境更新後只顯示提示，不會自動更新；只有點擊「立即更新」才會更新。這是預設設定。",
      },
      {
        label: "靜默",
        text: "不檢查 OAuth 環境更新，也不顯示彈窗。",
      },
    ],
    confirm: "確認",
    close: "關閉更新提示",
  },
  "ja-JP": {
    eyebrow: "更新",
    title: "OAuth 環境更新をバックグラウンドで実行できます",
    lead: "AIdea は OAuth 設定環境のバックグラウンド更新に対応しました。更新頻度は OAuth プロバイダーによって異なります。",
    note: "注意: プラグインは更新されています。新しいコードを有効にするため Zotero を再起動してください。",
    exampleLabel: "OAuth 設定環境の更新モード",
    examplePrompt: "",
    modeItems: [
      {
        label: "自動更新",
        text: "OAuth 環境の更新を検出すると AIdea が通知します。60 秒以内に操作がない場合は自動更新します。後で、閉じる、最小化を選ぶと 24 時間通知を停止します。",
      },
      {
        label: "通知のみ",
        text: "OAuth 環境の更新を検出しても通知のみ表示し、自動更新はしません。今すぐ更新をクリックした場合だけ更新します。既定値です。",
      },
      {
        label: "サイレント",
        text: "AIdea は OAuth 環境更新を確認せず、通知も表示しません。",
      },
    ],
    confirm: "OK",
    close: "更新通知を閉じる",
  },
  "ko-KR": {
    eyebrow: "업데이트",
    title: "OAuth 환경 업데이트를 백그라운드에서 실행할 수 있습니다",
    lead: "AIdea가 OAuth 구성 환경의 백그라운드 업데이트를 지원합니다. 업데이트 빈도는 OAuth 제공자에 따라 달라집니다.",
    note: "주의: 플러그인이 업데이트되었습니다. 새 플러그인 코드가 적용되도록 Zotero를 다시 시작하세요.",
    exampleLabel: "OAuth 구성 환경 업데이트 모드",
    examplePrompt: "",
    modeItems: [
      {
        label: "자동 업데이트",
        text: "OAuth 환경 업데이트가 감지되면 AIdea가 알림을 표시합니다. 60초 동안 동작이 없으면 자동으로 업데이트합니다. 나중에, 닫기, 최소화는 알림을 24시간 일시 중지합니다.",
      },
      {
        label: "업데이트 알림",
        text: "OAuth 환경 업데이트가 감지되면 AIdea는 알림만 표시하고 자동 업데이트하지 않습니다. 지금 업데이트를 클릭한 경우에만 업데이트합니다. 기본값입니다.",
      },
      {
        label: "무음",
        text: "AIdea는 OAuth 환경 업데이트를 확인하지 않고 알림도 표시하지 않습니다.",
      },
    ],
    confirm: "확인",
    close: "업데이트 알림 닫기",
  },
  "fr-FR": {
    eyebrow: "Mise a jour",
    title:
      "Les mises a jour de l'environnement OAuth peuvent s'executer en arriere-plan",
    lead: "AIdea prend maintenant en charge les mises a jour en arriere-plan des environnements de configuration OAuth. La frequence depend du fournisseur OAuth.",
    note: "Remarque : le plugin a ete mis a jour. Redemarrez Zotero pour activer le nouveau code du plugin.",
    exampleLabel: "Modes de mise a jour de l'environnement OAuth",
    examplePrompt: "",
    modeItems: [
      {
        label: "Mise a jour auto",
        text: "Quand une mise a jour OAuth est detectee, AIdea affiche une invite. Sans action pendant 60 secondes, la mise a jour s'execute automatiquement. Plus tard, fermer ou reduire met l'invite en pause pendant 24 heures.",
      },
      {
        label: "Notifier",
        text: "Quand une mise a jour OAuth est detectee, AIdea affiche seulement une invite et ne met pas a jour automatiquement. La mise a jour se lance uniquement apres un clic sur Mettre a jour maintenant. C'est le reglage par defaut.",
      },
      {
        label: "Silencieux",
        text: "AIdea ne verifie pas les mises a jour OAuth et n'affiche pas d'invite.",
      },
    ],
    confirm: "OK",
    close: "Fermer l'avis de mise a jour",
  },
  "de-DE": {
    eyebrow: "Update",
    title: "OAuth-Umgebungsupdates koennen jetzt im Hintergrund laufen",
    lead: "AIdea unterstuetzt jetzt Hintergrundupdates fuer OAuth-Konfigurationsumgebungen. Die Haeufigkeit haengt vom OAuth-Anbieter ab.",
    note: "Hinweis: Das Plugin wurde aktualisiert. Starten Sie Zotero neu, damit der neue Plugin-Code aktiv wird.",
    exampleLabel: "Update-Modi fuer die OAuth-Konfigurationsumgebung",
    examplePrompt: "",
    modeItems: [
      {
        label: "Automatisch",
        text: "Wenn ein OAuth-Umgebungsupdate erkannt wird, zeigt AIdea eine Meldung. Ohne Aktion innerhalb von 60 Sekunden wird automatisch aktualisiert. Spaeter, Schliessen oder Minimieren pausiert die Meldung fuer 24 Stunden.",
      },
      {
        label: "Benachrichtigen",
        text: "Wenn ein OAuth-Umgebungsupdate erkannt wird, zeigt AIdea nur eine Meldung und aktualisiert nicht automatisch. Aktualisiert wird erst nach Klick auf Jetzt aktualisieren. Dies ist die Voreinstellung.",
      },
      {
        label: "Still",
        text: "AIdea prueft keine OAuth-Umgebungsupdates und zeigt keine Meldungen.",
      },
    ],
    confirm: "OK",
    close: "Update-Hinweis schliessen",
  },
  "es-ES": {
    eyebrow: "Actualizacion",
    title:
      "Las actualizaciones del entorno OAuth pueden ejecutarse en segundo plano",
    lead: "AIdea ahora admite actualizaciones en segundo plano para entornos de configuracion OAuth. La frecuencia depende del proveedor OAuth.",
    note: "Nota: el plugin se ha actualizado. Reinicia Zotero para asegurarte de que el nuevo codigo del plugin este activo.",
    exampleLabel: "Modos de actualizacion del entorno OAuth",
    examplePrompt: "",
    modeItems: [
      {
        label: "Actualizacion automatica",
        text: "Cuando se detecta una actualizacion del entorno OAuth, AIdea muestra un aviso. Si no hay accion en 60 segundos, actualiza automaticamente. Mas tarde, cerrar o minimizar pausa el aviso durante 24 horas.",
      },
      {
        label: "Notificar",
        text: "Cuando se detecta una actualizacion del entorno OAuth, AIdea solo muestra un aviso y no actualiza automaticamente. Solo actualiza al hacer clic en Actualizar ahora. Es el valor predeterminado.",
      },
      {
        label: "Silencioso",
        text: "AIdea no comprueba actualizaciones del entorno OAuth ni muestra avisos.",
      },
    ],
    confirm: "Aceptar",
    close: "Cerrar aviso de actualizacion",
  },
  "ru-RU": {
    eyebrow: "Обновление",
    title: "Обновления среды OAuth теперь могут работать в фоне",
    lead: "AIdea теперь поддерживает фоновые обновления сред конфигурации OAuth. Частота обновлений зависит от провайдера OAuth.",
    note: "Примечание: плагин обновлен. Перезапустите Zotero, чтобы новый код плагина точно был активен.",
    exampleLabel: "Режимы обновления среды конфигурации OAuth",
    examplePrompt: "",
    modeItems: [
      {
        label: "Автообновление",
        text: "Когда обнаружено обновление среды OAuth, AIdea показывает подсказку. Если в течение 60 секунд нет действий, обновление запускается автоматически. Позже, закрыть или свернуть приостанавливает подсказку на 24 часа.",
      },
      {
        label: "Уведомлять",
        text: "Когда обнаружено обновление среды OAuth, AIdea только показывает подсказку и не обновляет автоматически. Обновление запускается только после нажатия Обновить сейчас. Это значение по умолчанию.",
      },
      {
        label: "Тихий режим",
        text: "AIdea не проверяет обновления среды OAuth и не показывает подсказки.",
      },
    ],
    confirm: "OK",
    close: "Закрыть уведомление об обновлении",
  },
  "pt-BR": {
    eyebrow: "Atualizacao",
    title: "Atualizacoes do ambiente OAuth agora podem rodar em segundo plano",
    lead: "AIdea agora oferece atualizacoes em segundo plano para ambientes de configuracao OAuth. A frequencia depende do provedor OAuth.",
    note: "Observacao: o plugin foi atualizado. Reinicie o Zotero para garantir que o novo codigo do plugin esteja ativo.",
    exampleLabel: "Modos de atualizacao do ambiente OAuth",
    examplePrompt: "",
    modeItems: [
      {
        label: "Atualizacao automatica",
        text: "Quando uma atualizacao do ambiente OAuth e detectada, AIdea mostra um aviso. Se nao houver acao em 60 segundos, atualiza automaticamente. Mais tarde, fechar ou minimizar pausa o aviso por 24 horas.",
      },
      {
        label: "Notificar",
        text: "Quando uma atualizacao do ambiente OAuth e detectada, AIdea apenas mostra um aviso e nao atualiza automaticamente. A atualizacao ocorre apenas ao clicar em Atualizar agora. Este e o padrao.",
      },
      {
        label: "Silencioso",
        text: "AIdea nao verifica atualizacoes do ambiente OAuth e nao mostra avisos.",
      },
    ],
    confirm: "OK",
    close: "Fechar aviso de atualizacao",
  },
  "ar-SA": {
    eyebrow: "تحديث",
    title: "يمكن الآن تشغيل تحديثات بيئة OAuth في الخلفية",
    lead: "يدعم AIdea الآن تحديثات الخلفية لبيئات إعداد OAuth. يعتمد معدل التحديث على مزود OAuth.",
    note: "ملاحظة: تم تحديث الإضافة. أعد تشغيل Zotero للتأكد من تفعيل كود الإضافة الجديد.",
    exampleLabel: "أوضاع تحديث بيئة إعداد OAuth",
    examplePrompt: "",
    modeItems: [
      {
        label: "تحديث تلقائي",
        text: "عند اكتشاف تحديث لبيئة OAuth يعرض AIdea تنبيها. إذا لم يحدث أي إجراء خلال 60 ثانية فسيتم التحديث تلقائيا. لاحقا أو إغلاق أو تصغير يوقف التنبيه لمدة 24 ساعة.",
      },
      {
        label: "تنبيه فقط",
        text: "عند اكتشاف تحديث لبيئة OAuth يعرض AIdea تنبيها فقط ولا يحدث تلقائيا. يتم التحديث فقط بعد النقر على حدث الآن. هذا هو الوضع الافتراضي.",
      },
      {
        label: "صامت",
        text: "لا يفحص AIdea تحديثات بيئة OAuth ولا يعرض تنبيهات.",
      },
    ],
    confirm: "حسنا",
    close: "إغلاق تنبيه التحديث",
  },
  "hi-IN": {
    eyebrow: "अपडेट",
    title: "OAuth वातावरण अपडेट अब पृष्ठभूमि में चल सकते हैं",
    lead: "AIdea अब OAuth कॉन्फ़िगरेशन वातावरण के लिए पृष्ठभूमि अपडेट का समर्थन करता है। अपडेट आवृत्ति OAuth प्रदाता पर निर्भर करती है।",
    note: "नोट: प्लगइन अपडेट हो गया है। नया प्लगइन कोड सक्रिय करने के लिए Zotero पुनः शुरू करें।",
    exampleLabel: "OAuth कॉन्फ़िगरेशन वातावरण अपडेट मोड",
    examplePrompt: "",
    modeItems: [
      {
        label: "स्वचालित अपडेट",
        text: "OAuth वातावरण अपडेट मिलने पर AIdea एक संकेत दिखाता है। 60 सेकंड तक कोई कार्रवाई न होने पर यह अपने आप अपडेट होगा। बाद में, बंद करें या छोटा करें संकेत को 24 घंटे रोकता है।",
      },
      {
        label: "अपडेट सूचना",
        text: "OAuth वातावरण अपडेट मिलने पर AIdea केवल संकेत दिखाता है और अपने आप अपडेट नहीं करता। अपडेट तभी होता है जब आप अभी अपडेट करें पर क्लिक करते हैं। यह डिफ़ॉल्ट है।",
      },
      {
        label: "मौन",
        text: "AIdea OAuth वातावरण अपडेट की जांच नहीं करता और संकेत नहीं दिखाता।",
      },
    ],
    confirm: "ठीक है",
    close: "अपडेट सूचना बंद करें",
  },
};

for (const lang of Object.keys(OAUTH_ENV_UPDATE_COPIES) as PanelLang[]) {
  if (lang !== "en-US" && lang !== "zh-CN") {
    OAUTH_ENV_UPDATE_COPIES[lang] = OAUTH_ENV_UPDATE_COPIES["en-US"];
  }
}

const PDF_TRANSLATION_UPDATE_COPIES: Record<PanelLang, UpdateNoticeCopy> = {
  "en-US": {
    eyebrow: "Update",
    title: "Full-document translation reliability and streaming display fixes",
    lead: "This update fixes Codex OAuth full-document PDF translation failures and incorrect completion states, while improving streaming response layout stability.",
    note: "Restart Zotero after installing this update. The full-document translation environment does not need to be reinstalled or updated.",
    alsoLabel: "This update includes",
    alsoItems: [
      {
        label: "More reliable full-document translation",
        text: "Temporary HTTP 502 errors, SSL EOF failures, and Windows system-proxy interference are handled more reliably.",
      },
      {
        label: "Accurate completion status",
        text: "A task is marked complete only when a translated PDF is created or updated during the current run.",
      },
      {
        label: "Old outputs cannot hide failures",
        text: "Unchanged PDF files from earlier runs are no longer treated as output from the current task.",
      },
      {
        label: "Clearer errors and progress",
        text: "AIdea shows a readable failure reason and log location, and timestamps are no longer misidentified as page progress.",
      },
      {
        label: "Streaming response layout fix",
        text: "Extra blank lines no longer appear between Markdown paragraphs while an answer is being generated.",
      },
    ],
    exampleLabel: "After updating",
    examplePrompt:
      "Restart Zotero, then retry full-document translation directly. No translation-environment reinstall is required.",
    confirm: "Got it",
    close: "Close update notice",
  },
  "zh-CN": {
    eyebrow: "更新提示",
    title: "全文翻译可靠性与流式显示修复",
    lead: "本次更新修复 Codex OAuth 全文 PDF 翻译失败及错误完成状态，并改善流式回答的显示稳定性。",
    note: "更新插件后请重启 Zotero。本次修复不需要重新安装或更新全文翻译环境。",
    alsoLabel: "本次更新包括",
    alsoItems: [
      {
        label: "全文翻译更稳定",
        text: "更好地处理临时 HTTP 502、SSL EOF 和 Windows 系统代理干扰。",
      },
      {
        label: "完成状态更准确",
        text: "只有本次确实生成或更新了翻译 PDF，任务才会显示完成。",
      },
      {
        label: "旧输出不再掩盖失败",
        text: "之前任务留下且未变化的 PDF 不再被当作本次翻译产物。",
      },
      {
        label: "错误与进度更清晰",
        text: "未生成 PDF 时会显示明确原因和日志位置；日志时间不再被误识别为页码进度。",
      },
      {
        label: "流式回答排版修复",
        text: "回答生成过程中不再出现额外段间空行，生成中和完成后的排版保持一致。",
      },
    ],
    exampleLabel: "更新后",
    examplePrompt:
      "重启 Zotero 后可直接重新运行全文翻译，无需重新安装翻译环境。",
    confirm: "知道了",
    close: "关闭更新提示",
  },
  "zh-TW": {
    eyebrow: "更新提示",
    title: "全文翻譯可靠性與串流顯示修正",
    lead: "本次更新修正 Codex OAuth 全文 PDF 翻譯失敗與錯誤完成狀態，並改善串流回答的版面穩定性。",
    note: "安裝更新後請重新啟動 Zotero。無需重新安裝或更新全文翻譯環境。",
    alsoLabel: "本次更新包括",
    alsoItems: [
      {
        label: "全文翻譯更穩定",
        text: "能更可靠地處理暫時性 HTTP 502、SSL EOF 與 Windows 系統代理干擾。",
      },
      {
        label: "完成狀態更準確",
        text: "只有本次確實建立或更新翻譯 PDF，工作才會顯示完成。",
      },
      {
        label: "舊輸出不再掩蓋失敗",
        text: "先前工作留下且未變更的 PDF 不再被視為本次翻譯產物。",
      },
      {
        label: "錯誤與進度更清楚",
        text: "未產生 PDF 時會顯示可讀原因與日誌位置，時間戳記不再被誤認為頁碼進度。",
      },
      {
        label: "串流回答版面修正",
        text: "回答產生期間，Markdown 段落之間不再出現額外空行。",
      },
    ],
    exampleLabel: "更新後",
    examplePrompt:
      "重新啟動 Zotero 後可直接重試全文翻譯，無需重新安裝翻譯環境。",
    confirm: "知道了",
    close: "關閉更新提示",
  },
  "ja-JP": {
    eyebrow: "更新のお知らせ",
    title: "文書全体翻訳の信頼性とストリーミング表示の修正",
    lead: "Codex OAuth による PDF 全体翻訳の失敗と誤った完了表示を修正し、ストリーミング回答のレイアウトを安定させました。",
    note: "更新後に Zotero を再起動してください。文書全体翻訳環境の再インストールや更新は不要です。",
    alsoLabel: "今回の更新内容",
    alsoItems: [
      {
        label: "文書全体翻訳の安定性",
        text: "一時的な HTTP 502、SSL EOF、Windows のシステムプロキシ干渉をより確実に処理します。",
      },
      {
        label: "正確な完了状態",
        text: "今回の実行で翻訳 PDF が作成または更新された場合のみ完了と表示します。",
      },
      {
        label: "古い出力による誤判定を防止",
        text: "以前の実行から残った未変更の PDF を今回の成果物として扱いません。",
      },
      {
        label: "明確なエラーと進捗",
        text: "PDF が生成されない場合は原因とログの場所を表示し、時刻をページ進捗として誤認しません。",
      },
      {
        label: "ストリーミング表示の修正",
        text: "回答生成中に Markdown 段落間へ余分な空行が表示されなくなりました。",
      },
    ],
    exampleLabel: "更新後",
    examplePrompt:
      "Zotero を再起動してから文書全体翻訳を再試行してください。翻訳環境の再インストールは不要です。",
    confirm: "了解",
    close: "更新通知を閉じる",
  },
  "ko-KR": {
    eyebrow: "업데이트 안내",
    title: "문서 전체 번역 안정성 및 스트리밍 표시 수정",
    lead: "Codex OAuth PDF 전체 번역 실패와 잘못된 완료 상태를 수정하고 스트리밍 응답 레이아웃을 안정화했습니다.",
    note: "업데이트 설치 후 Zotero를 다시 시작하세요. 문서 전체 번역 환경을 다시 설치하거나 업데이트할 필요는 없습니다.",
    alsoLabel: "이번 업데이트 내용",
    alsoItems: [
      {
        label: "안정적인 문서 전체 번역",
        text: "일시적인 HTTP 502, SSL EOF 및 Windows 시스템 프록시 간섭을 더 안정적으로 처리합니다.",
      },
      {
        label: "정확한 완료 상태",
        text: "현재 실행에서 번역 PDF가 생성되거나 업데이트된 경우에만 완료로 표시됩니다.",
      },
      {
        label: "이전 출력으로 인한 오판 방지",
        text: "이전 실행에서 남은 변경되지 않은 PDF를 현재 작업의 결과로 처리하지 않습니다.",
      },
      {
        label: "명확한 오류 및 진행률",
        text: "PDF가 생성되지 않으면 원인과 로그 위치를 표시하며 타임스탬프를 페이지 진행률로 잘못 인식하지 않습니다.",
      },
      {
        label: "스트리밍 응답 레이아웃 수정",
        text: "응답 생성 중 Markdown 단락 사이에 불필요한 빈 줄이 더 이상 나타나지 않습니다.",
      },
    ],
    exampleLabel: "업데이트 후",
    examplePrompt:
      "Zotero를 다시 시작한 뒤 문서 전체 번역을 바로 다시 시도하세요. 번역 환경 재설치는 필요하지 않습니다.",
    confirm: "확인",
    close: "업데이트 안내 닫기",
  },
  "fr-FR": {
    eyebrow: "Mise à jour",
    title: "Fiabilité de la traduction intégrale et affichage en continu",
    lead: "Cette mise à jour corrige les échecs de traduction intégrale PDF avec Codex OAuth, les états de réussite incorrects et la mise en page des réponses en continu.",
    note: "Redémarrez Zotero après l’installation. Il n’est pas nécessaire de réinstaller ou de mettre à jour l’environnement de traduction intégrale.",
    alsoLabel: "Cette mise à jour comprend",
    alsoItems: [
      {
        label: "Traduction intégrale plus fiable",
        text: "Les erreurs HTTP 502 temporaires, SSL EOF et les interférences du proxy système Windows sont mieux gérées.",
      },
      {
        label: "État de réussite exact",
        text: "La tâche est terminée uniquement si un PDF traduit est créé ou mis à jour pendant l’exécution actuelle.",
      },
      {
        label: "Les anciens fichiers ne masquent plus les échecs",
        text: "Les PDF inchangés provenant d’exécutions précédentes ne sont plus considérés comme de nouveaux résultats.",
      },
      {
        label: "Erreurs et progression plus claires",
        text: "AIdea affiche la cause et l’emplacement du journal, et ne confond plus les horodatages avec la progression des pages.",
      },
      {
        label: "Mise en page du streaming corrigée",
        text: "Les lignes vides superflues entre les paragraphes Markdown ont été supprimées pendant la génération.",
      },
    ],
    exampleLabel: "Après la mise à jour",
    examplePrompt:
      "Redémarrez Zotero, puis relancez directement la traduction intégrale. Aucune réinstallation de l’environnement n’est requise.",
    confirm: "Compris",
    close: "Fermer l’avis de mise à jour",
  },
  "de-DE": {
    eyebrow: "Update",
    title: "Zuverlässige Volltextübersetzung und Streaming-Anzeige",
    lead: "Dieses Update behebt Fehler bei der PDF-Volltextübersetzung mit Codex OAuth, falsche Abschlussmeldungen und Probleme beim Streaming-Layout.",
    note: "Starten Sie Zotero nach der Installation neu. Die Volltextübersetzungsumgebung muss nicht neu installiert oder aktualisiert werden.",
    alsoLabel: "Dieses Update enthält",
    alsoItems: [
      {
        label: "Zuverlässigere Volltextübersetzung",
        text: "Temporäre HTTP-502- und SSL-EOF-Fehler sowie Störungen durch den Windows-Systemproxy werden zuverlässiger behandelt.",
      },
      {
        label: "Korrekter Abschlussstatus",
        text: "Eine Aufgabe gilt nur als abgeschlossen, wenn im aktuellen Lauf eine übersetzte PDF erstellt oder aktualisiert wurde.",
      },
      {
        label: "Alte Ausgaben verdecken keine Fehler",
        text: "Unveränderte PDF-Dateien früherer Läufe gelten nicht mehr als Ergebnis der aktuellen Aufgabe.",
      },
      {
        label: "Klarere Fehler und Fortschritte",
        text: "AIdea zeigt Ursache und Protokollpfad an; Zeitstempel werden nicht mehr als Seitenfortschritt erkannt.",
      },
      {
        label: "Streaming-Layout korrigiert",
        text: "Während der Antwortgenerierung erscheinen keine zusätzlichen Leerzeilen mehr zwischen Markdown-Absätzen.",
      },
    ],
    exampleLabel: "Nach dem Update",
    examplePrompt:
      "Starten Sie Zotero neu und versuchen Sie die Volltextübersetzung erneut. Eine Neuinstallation der Übersetzungsumgebung ist nicht erforderlich.",
    confirm: "Verstanden",
    close: "Update-Hinweis schließen",
  },
  "es-ES": {
    eyebrow: "Actualización",
    title: "Fiabilidad de la traducción completa y visualización en streaming",
    lead: "Esta actualización corrige fallos de traducción completa de PDF con Codex OAuth, estados de finalización incorrectos y el diseño de las respuestas en streaming.",
    note: "Reinicia Zotero después de instalar la actualización. No es necesario reinstalar ni actualizar el entorno de traducción completa.",
    alsoLabel: "Esta actualización incluye",
    alsoItems: [
      {
        label: "Traducción completa más fiable",
        text: "Los errores temporales HTTP 502, SSL EOF y la interferencia del proxy del sistema de Windows se gestionan mejor.",
      },
      {
        label: "Estado de finalización preciso",
        text: "Una tarea solo se completa si durante la ejecución actual se crea o actualiza un PDF traducido.",
      },
      {
        label: "Los resultados antiguos no ocultan fallos",
        text: "Los PDF sin cambios de ejecuciones anteriores ya no se consideran resultados de la tarea actual.",
      },
      {
        label: "Errores y progreso más claros",
        text: "AIdea muestra la causa y la ubicación del registro; las marcas de tiempo ya no se confunden con páginas.",
      },
      {
        label: "Diseño de streaming corregido",
        text: "Ya no aparecen líneas en blanco adicionales entre párrafos Markdown durante la generación.",
      },
    ],
    exampleLabel: "Después de actualizar",
    examplePrompt:
      "Reinicia Zotero y vuelve a intentar directamente la traducción completa. No es necesario reinstalar el entorno.",
    confirm: "Entendido",
    close: "Cerrar aviso de actualización",
  },
  "ru-RU": {
    eyebrow: "Обновление",
    title: "Надёжность полного перевода и потокового отображения",
    lead: "Обновление исправляет сбои полного перевода PDF через Codex OAuth, неверный статус завершения и разметку потоковых ответов.",
    note: "Перезапустите Zotero после установки. Переустанавливать или обновлять среду полного перевода не требуется.",
    alsoLabel: "В это обновление входит",
    alsoItems: [
      {
        label: "Надёжный полный перевод",
        text: "Временные ошибки HTTP 502, SSL EOF и влияние системного прокси Windows обрабатываются надёжнее.",
      },
      {
        label: "Точный статус завершения",
        text: "Задача завершается только при создании или обновлении переведённого PDF в текущем запуске.",
      },
      {
        label: "Старые файлы не скрывают сбой",
        text: "Неизменённые PDF от предыдущих запусков больше не считаются результатом текущей задачи.",
      },
      {
        label: "Понятные ошибки и прогресс",
        text: "AIdea показывает причину и путь к журналу, а отметки времени не принимаются за номера страниц.",
      },
      {
        label: "Исправлена потоковая разметка",
        text: "При генерации ответа между абзацами Markdown больше не появляются лишние пустые строки.",
      },
    ],
    exampleLabel: "После обновления",
    examplePrompt:
      "Перезапустите Zotero и повторите полный перевод. Переустановка среды перевода не требуется.",
    confirm: "Понятно",
    close: "Закрыть уведомление об обновлении",
  },
  "pt-BR": {
    eyebrow: "Atualização",
    title: "Confiabilidade da tradução completa e exibição em streaming",
    lead: "Esta atualização corrige falhas na tradução completa de PDF com Codex OAuth, estados de conclusão incorretos e o layout das respostas em streaming.",
    note: "Reinicie o Zotero após instalar a atualização. Não é necessário reinstalar nem atualizar o ambiente de tradução completa.",
    alsoLabel: "Esta atualização inclui",
    alsoItems: [
      {
        label: "Tradução completa mais confiável",
        text: "Erros temporários HTTP 502, SSL EOF e interferência do proxy do sistema Windows são tratados melhor.",
      },
      {
        label: "Status de conclusão preciso",
        text: "Uma tarefa só é concluída quando um PDF traduzido é criado ou atualizado na execução atual.",
      },
      {
        label: "Saídas antigas não ocultam falhas",
        text: "PDFs inalterados de execuções anteriores não são mais considerados resultados da tarefa atual.",
      },
      {
        label: "Erros e progresso mais claros",
        text: "AIdea mostra a causa e o local do log; horários não são mais confundidos com progresso de páginas.",
      },
      {
        label: "Layout de streaming corrigido",
        text: "Linhas em branco extras não aparecem mais entre parágrafos Markdown durante a geração.",
      },
    ],
    exampleLabel: "Após atualizar",
    examplePrompt:
      "Reinicie o Zotero e tente novamente a tradução completa. Não é necessário reinstalar o ambiente.",
    confirm: "Entendido",
    close: "Fechar aviso de atualização",
  },
  "ar-SA": {
    eyebrow: "تحديث",
    title: "موثوقية ترجمة المستند بالكامل وإصلاح العرض المتدفق",
    lead: "يصلح هذا التحديث فشل ترجمة ملفات PDF بالكامل عبر Codex OAuth وحالات الإكمال غير الصحيحة وتخطيط الردود المتدفقة.",
    note: "أعد تشغيل Zotero بعد تثبيت التحديث. لا حاجة إلى إعادة تثبيت بيئة ترجمة المستند بالكامل أو تحديثها.",
    alsoLabel: "يتضمن هذا التحديث",
    alsoItems: [
      {
        label: "ترجمة كاملة أكثر موثوقية",
        text: "تتم معالجة أخطاء HTTP 502 المؤقتة وSSL EOF وتداخل وكيل نظام Windows بصورة أفضل.",
      },
      {
        label: "حالة إكمال دقيقة",
        text: "لا تكتمل المهمة إلا عند إنشاء ملف PDF مترجم أو تحديثه في التشغيل الحالي.",
      },
      {
        label: "المخرجات القديمة لا تخفي الفشل",
        text: "لا تعد ملفات PDF غير المتغيرة من عمليات سابقة ناتجا للمهمة الحالية.",
      },
      {
        label: "أخطاء وتقدم أوضح",
        text: "يعرض AIdea السبب وموقع السجل، ولا يخلط الطوابع الزمنية بتقدم الصفحات.",
      },
      {
        label: "إصلاح تخطيط البث",
        text: "لم تعد تظهر أسطر فارغة إضافية بين فقرات Markdown أثناء إنشاء الرد.",
      },
    ],
    exampleLabel: "بعد التحديث",
    examplePrompt:
      "أعد تشغيل Zotero ثم حاول ترجمة المستند بالكامل مباشرة. لا يلزم إعادة تثبيت بيئة الترجمة.",
    confirm: "فهمت",
    close: "إغلاق إشعار التحديث",
  },
  "hi-IN": {
    eyebrow: "अपडेट",
    title:
      "पूरे दस्तावेज़ के अनुवाद की विश्वसनीयता और स्ट्रीमिंग डिस्प्ले सुधार",
    lead: "यह अपडेट Codex OAuth से पूरे PDF के अनुवाद की विफलता, गलत पूर्ण स्थिति और स्ट्रीमिंग उत्तर के लेआउट को ठीक करता है।",
    note: "अपडेट इंस्टॉल करने के बाद Zotero को पुनः शुरू करें। पूरे दस्तावेज़ के अनुवाद environment को दोबारा इंस्टॉल या अपडेट करने की आवश्यकता नहीं है।",
    alsoLabel: "इस अपडेट में शामिल है",
    alsoItems: [
      {
        label: "अधिक विश्वसनीय पूरा अनुवाद",
        text: "अस्थायी HTTP 502, SSL EOF और Windows system proxy के हस्तक्षेप को बेहतर ढंग से संभाला जाता है।",
      },
      {
        label: "सही पूर्ण स्थिति",
        text: "कार्य तभी पूर्ण दिखता है जब वर्तमान run में अनुवादित PDF बनाया या अपडेट किया गया हो।",
      },
      {
        label: "पुराने output विफलता नहीं छिपाते",
        text: "पिछले run की बिना बदली PDF को वर्तमान कार्य का output नहीं माना जाता।",
      },
      {
        label: "स्पष्ट errors और progress",
        text: "AIdea कारण और log location दिखाता है तथा timestamps को page progress नहीं मानता।",
      },
      {
        label: "स्ट्रीमिंग लेआउट सुधार",
        text: "उत्तर बनते समय Markdown paragraphs के बीच अतिरिक्त खाली lines अब नहीं दिखतीं।",
      },
    ],
    exampleLabel: "अपडेट के बाद",
    examplePrompt:
      "Zotero को पुनः शुरू करें और पूरे दस्तावेज़ का अनुवाद फिर से चलाएं। Translation environment को दोबारा इंस्टॉल करने की जरूरत नहीं है।",
    confirm: "समझ गया",
    close: "अपडेट सूचना बंद करें",
  },
};

const ZOTERO_10_UPDATE_NOTICE_COPIES: Record<PanelLang, UpdateNoticeCopy> = {
  "en-US": {
    eyebrow: "Update",
    title: "Zotero 10 compatibility",
    lead: "AIdea can now be installed and used on Zotero 10.0.x while retaining support for Zotero 7–9.",
    note: "Restart Zotero after updating. Install the official XPI or use automatic update; there is no need to edit manifest.json manually.",
    alsoLabel: "This update includes",
    alsoItems: [
      {
        label: "Official installation and updates",
        text: "The official XPI and automatic-update manifest now accept Zotero 10.0.x.",
      },
      {
        label: "Correct library scope",
        text: "Zotero 10's plural library-selection API keeps personal, group, and multi-library conversation scope correct.",
      },
      {
        label: "Zotero 7–9 retained",
        text: "Older Zotero versions continue to use the existing fallback API.",
      },
      {
        label: "No new modes",
        text: "Settings and the existing PDF/EPUB side panels keep the same workflow without an extra mode.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "Got it",
    close: "Close update notice",
  },
  "zh-CN": {
    eyebrow: "更新提示",
    title: "兼容 Zotero 10",
    lead: "AIdea 现在可以在 Zotero 10.0.x 中安装和使用，同时继续支持 Zotero 7–9。",
    note: "更新后请重启 Zotero。请安装官方 XPI 或使用自动更新，无需手动修改 manifest.json。",
    alsoLabel: "本次更新包括",
    alsoItems: [
      {
        label: "官方安装与自动更新兼容",
        text: "官方 XPI 和自动更新清单现已支持 Zotero 10.0.x。",
      },
      {
        label: "资料库范围修复",
        text: "改用 Zotero 10 的复数资料库选择接口，确保个人、群组和多资料库会话范围正确。",
      },
      {
        label: "保留 Zotero 7–9 支持",
        text: "旧版 Zotero 继续使用现有后备接口。",
      },
      {
        label: "不增加新模式",
        text: "设置页以及现有 PDF/EPUB 侧边栏继续使用原有流程，无需切换额外模式。",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "知道了",
    close: "关闭更新提示",
  },
  "zh-TW": {
    eyebrow: "更新提示",
    title: "相容 Zotero 10",
    lead: "AIdea 現在可以在 Zotero 10.0.x 中安裝和使用，同時繼續支援 Zotero 7–9。",
    note: "更新後請重新啟動 Zotero。請安裝官方 XPI 或使用自動更新，無需手動修改 manifest.json。",
    alsoLabel: "本次更新包括",
    alsoItems: [
      {
        label: "官方安裝與自動更新相容",
        text: "官方 XPI 與自動更新清單現已支援 Zotero 10.0.x。",
      },
      {
        label: "資料庫範圍修正",
        text: "改用 Zotero 10 的複數資料庫選取介面，確保個人、群組與多資料庫對話範圍正確。",
      },
      {
        label: "保留 Zotero 7–9 支援",
        text: "舊版 Zotero 繼續使用現有的後備介面。",
      },
      {
        label: "不增加新模式",
        text: "設定頁與現有 PDF/EPUB 側邊欄維持原有流程，無需切換額外模式。",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "知道了",
    close: "關閉更新提示",
  },
  "ja-JP": {
    eyebrow: "更新のお知らせ",
    title: "Zotero 10 への対応",
    lead: "AIdea を Zotero 10.0.x にインストールして利用できるようになり、Zotero 7–9 のサポートも継続します。",
    note: "更新後に Zotero を再起動してください。公式 XPI をインストールするか自動更新を使用でき、manifest.json を手動で変更する必要はありません。",
    alsoLabel: "今回の更新内容",
    alsoItems: [
      {
        label: "公式インストールと自動更新",
        text: "公式 XPI と自動更新マニフェストが Zotero 10.0.x に対応しました。",
      },
      {
        label: "ライブラリ範囲の修正",
        text: "Zotero 10 の複数ライブラリ選択 API により、個人、グループ、複数ライブラリの会話範囲を正しく保ちます。",
      },
      {
        label: "Zotero 7–9 のサポートを継続",
        text: "旧バージョンの Zotero では既存のフォールバック API を引き続き使用します。",
      },
      {
        label: "新しいモードは不要",
        text: "設定画面と既存の PDF/EPUB サイドパネルは、追加モードなしで従来の操作を維持します。",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "了解",
    close: "更新通知を閉じる",
  },
  "ko-KR": {
    eyebrow: "업데이트 안내",
    title: "Zotero 10 호환성",
    lead: "이제 AIdea를 Zotero 10.0.x에 설치해 사용할 수 있으며 Zotero 7–9 지원도 계속 유지됩니다.",
    note: "업데이트 후 Zotero를 다시 시작하세요. 공식 XPI를 설치하거나 자동 업데이트를 사용하면 되며 manifest.json을 직접 수정할 필요가 없습니다.",
    alsoLabel: "이번 업데이트 내용",
    alsoItems: [
      {
        label: "공식 설치 및 자동 업데이트",
        text: "공식 XPI와 자동 업데이트 매니페스트가 이제 Zotero 10.0.x를 지원합니다.",
      },
      {
        label: "라이브러리 범위 수정",
        text: "Zotero 10의 복수 라이브러리 선택 API로 개인, 그룹 및 다중 라이브러리 대화 범위를 올바르게 유지합니다.",
      },
      {
        label: "Zotero 7–9 지원 유지",
        text: "이전 Zotero 버전은 기존 대체 API를 계속 사용합니다.",
      },
      {
        label: "새 모드 없음",
        text: "설정과 기존 PDF/EPUB 사이드 패널은 추가 모드 없이 동일한 작업 흐름을 유지합니다.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "확인",
    close: "업데이트 안내 닫기",
  },
  "fr-FR": {
    eyebrow: "Mise à jour",
    title: "Compatibilité avec Zotero 10",
    lead: "AIdea peut désormais être installé et utilisé avec Zotero 10.0.x, tout en conservant la prise en charge de Zotero 7–9.",
    note: "Redémarrez Zotero après la mise à jour. Installez le XPI officiel ou utilisez la mise à jour automatique ; aucune modification manuelle de manifest.json n’est nécessaire.",
    alsoLabel: "Cette mise à jour comprend",
    alsoItems: [
      {
        label: "Installation officielle et mises à jour",
        text: "Le XPI officiel et le manifeste de mise à jour automatique acceptent maintenant Zotero 10.0.x.",
      },
      {
        label: "Portée de bibliothèque corrigée",
        text: "L’API plurielle de sélection des bibliothèques de Zotero 10 conserve la bonne portée pour les bibliothèques personnelles, de groupe et multiples.",
      },
      {
        label: "Prise en charge de Zotero 7–9 conservée",
        text: "Les anciennes versions de Zotero continuent d’utiliser l’API de repli existante.",
      },
      {
        label: "Aucun nouveau mode",
        text: "Les réglages et les panneaux latéraux PDF/EPUB existants conservent le même flux de travail sans mode supplémentaire.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "Compris",
    close: "Fermer l’avis de mise à jour",
  },
  "de-DE": {
    eyebrow: "Update",
    title: "Kompatibilität mit Zotero 10",
    lead: "AIdea kann jetzt unter Zotero 10.0.x installiert und verwendet werden; Zotero 7–9 werden weiterhin unterstützt.",
    note: "Starten Sie Zotero nach dem Update neu. Installieren Sie das offizielle XPI oder nutzen Sie das automatische Update; manifest.json muss nicht manuell geändert werden.",
    alsoLabel: "Dieses Update enthält",
    alsoItems: [
      {
        label: "Offizielle Installation und Updates",
        text: "Das offizielle XPI und das Manifest für automatische Updates unterstützen nun Zotero 10.0.x.",
      },
      {
        label: "Korrigierter Bibliotheksumfang",
        text: "Die Mehrfachauswahl-API von Zotero 10 hält den Gesprächsumfang für persönliche, Gruppen- und mehrere Bibliotheken korrekt.",
      },
      {
        label: "Zotero 7–9 bleiben unterstützt",
        text: "Ältere Zotero-Versionen verwenden weiterhin die bestehende Fallback-API.",
      },
      {
        label: "Keine neuen Modi",
        text: "Einstellungen und die vorhandenen PDF/EPUB-Seitenbereiche behalten denselben Ablauf ohne zusätzlichen Modus.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "Verstanden",
    close: "Update-Hinweis schließen",
  },
  "es-ES": {
    eyebrow: "Actualización",
    title: "Compatibilidad con Zotero 10",
    lead: "AIdea ya se puede instalar y usar en Zotero 10.0.x, manteniendo la compatibilidad con Zotero 7–9.",
    note: "Reinicia Zotero después de actualizar. Instala el XPI oficial o usa la actualización automática; no hace falta modificar manifest.json manualmente.",
    alsoLabel: "Esta actualización incluye",
    alsoItems: [
      {
        label: "Instalación oficial y actualizaciones",
        text: "El XPI oficial y el manifiesto de actualización automática ya admiten Zotero 10.0.x.",
      },
      {
        label: "Ámbito de biblioteca corregido",
        text: "La API plural de selección de bibliotecas de Zotero 10 mantiene el ámbito correcto para bibliotecas personales, de grupo y múltiples.",
      },
      {
        label: "Se conserva Zotero 7–9",
        text: "Las versiones anteriores de Zotero siguen usando la API alternativa existente.",
      },
      {
        label: "Sin modos nuevos",
        text: "Los ajustes y los paneles laterales PDF/EPUB existentes conservan el mismo flujo sin un modo adicional.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "Entendido",
    close: "Cerrar aviso de actualización",
  },
  "ru-RU": {
    eyebrow: "Обновление",
    title: "Совместимость с Zotero 10",
    lead: "AIdea теперь можно установить и использовать в Zotero 10.0.x с сохранением поддержки Zotero 7–9.",
    note: "После обновления перезапустите Zotero. Установите официальный XPI или используйте автообновление; вручную изменять manifest.json не нужно.",
    alsoLabel: "В это обновление входит",
    alsoItems: [
      {
        label: "Официальная установка и обновления",
        text: "Официальный XPI и манифест автообновления теперь поддерживают Zotero 10.0.x.",
      },
      {
        label: "Исправленная область библиотеки",
        text: "Множественный API выбора библиотек Zotero 10 сохраняет правильную область для личных, групповых и нескольких библиотек.",
      },
      {
        label: "Поддержка Zotero 7–9 сохранена",
        text: "Старые версии Zotero продолжают использовать существующий резервный API.",
      },
      {
        label: "Без новых режимов",
        text: "Настройки и существующие боковые панели PDF/EPUB работают как прежде, без дополнительного режима.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "Понятно",
    close: "Закрыть уведомление об обновлении",
  },
  "pt-BR": {
    eyebrow: "Atualização",
    title: "Compatibilidade com o Zotero 10",
    lead: "O AIdea agora pode ser instalado e usado no Zotero 10.0.x, mantendo o suporte ao Zotero 7–9.",
    note: "Reinicie o Zotero após atualizar. Instale o XPI oficial ou use a atualização automática; não é necessário editar manifest.json manualmente.",
    alsoLabel: "Esta atualização inclui",
    alsoItems: [
      {
        label: "Instalação oficial e atualizações",
        text: "O XPI oficial e o manifesto de atualização automática agora aceitam o Zotero 10.0.x.",
      },
      {
        label: "Escopo correto da biblioteca",
        text: "A API plural de seleção de bibliotecas do Zotero 10 mantém o escopo correto para bibliotecas pessoais, de grupo e múltiplas.",
      },
      {
        label: "Suporte ao Zotero 7–9 mantido",
        text: "Versões anteriores do Zotero continuam usando a API alternativa existente.",
      },
      {
        label: "Sem novos modos",
        text: "As configurações e os painéis laterais PDF/EPUB existentes mantêm o mesmo fluxo sem um modo adicional.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "Entendido",
    close: "Fechar aviso de atualização",
  },
  "ar-SA": {
    eyebrow: "تحديث",
    title: "التوافق مع Zotero 10",
    lead: "يمكن الآن تثبيت AIdea واستخدامه على Zotero 10.0.x مع استمرار دعم Zotero 7–9.",
    note: "أعد تشغيل Zotero بعد التحديث. ثبّت ملف XPI الرسمي أو استخدم التحديث التلقائي؛ لا حاجة إلى تعديل manifest.json يدويًا.",
    alsoLabel: "يتضمن هذا التحديث",
    alsoItems: [
      {
        label: "التثبيت الرسمي والتحديثات",
        text: "أصبح ملف XPI الرسمي وبيان التحديث التلقائي يدعمان Zotero 10.0.x.",
      },
      {
        label: "تصحيح نطاق المكتبة",
        text: "تحافظ واجهة اختيار المكتبات المتعددة في Zotero 10 على النطاق الصحيح للمكتبات الشخصية والجماعية والمتعددة.",
      },
      {
        label: "استمرار دعم Zotero 7–9",
        text: "تواصل إصدارات Zotero الأقدم استخدام واجهة الرجوع الحالية.",
      },
      {
        label: "من دون أوضاع جديدة",
        text: "تحافظ الإعدادات واللوحات الجانبية الحالية لـ PDF/EPUB على سير العمل نفسه دون وضع إضافي.",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "فهمت",
    close: "إغلاق إشعار التحديث",
  },
  "hi-IN": {
    eyebrow: "अपडेट",
    title: "Zotero 10 के साथ संगतता",
    lead: "AIdea अब Zotero 10.0.x पर install और use किया जा सकता है, जबकि Zotero 7–9 support भी जारी है।",
    note: "अपडेट के बाद Zotero को restart करें। Official XPI install करें या automatic update उपयोग करें; manifest.json को manually edit करने की जरूरत नहीं है।",
    alsoLabel: "इस अपडेट में शामिल है",
    alsoItems: [
      {
        label: "Official installation और updates",
        text: "Official XPI और automatic-update manifest अब Zotero 10.0.x को support करते हैं।",
      },
      {
        label: "सही library scope",
        text: "Zotero 10 का plural library-selection API personal, group और multi-library conversation scope सही रखता है।",
      },
      {
        label: "Zotero 7–9 support जारी",
        text: "पुराने Zotero versions मौजूदा fallback API का उपयोग जारी रखते हैं।",
      },
      {
        label: "कोई नया mode नहीं",
        text: "Settings और मौजूदा PDF/EPUB side panels बिना अतिरिक्त mode के वही workflow बनाए रखते हैं।",
      },
    ],
    exampleLabel: "",
    examplePrompt: "",
    confirm: "समझ गया",
    close: "अपडेट सूचना बंद करें",
  },
};

export const CURRENT_UPDATE_NOTICE_COPIES: Record<PanelLang, UpdateNoticeCopy> =
  {
    "en-US": {
      eyebrow: "Update",
      title: "Reliable selection translation and bilingual annotations",
      lead: "AIdea can now reduce document context and retry automatically when a long document exceeds the model's input limit. It can also save the generated translation directly to a new Zotero highlight annotation.",
      note: "Restart Zotero after updating. The checkbox applies only to the current selection and must be selected before choosing a highlight color.",
      alsoLabel: "This update includes",
      alsoItems: [
        {
          label: "Automatic retries for long documents",
          text: "If first-use context exceeds the input limit, AIdea progressively reduces it and retries automatically.",
        },
        {
          label: "Selection-only fallback",
          text: "If the reduced context is still too long, AIdea translates the selected text directly instead of stopping with a cold-start error.",
        },
        {
          label: "Translations in highlight annotations",
          text: 'After the translation is generated, select "Write translation to annotation" and choose a highlight color to write it into the new annotation comment.',
        },
        {
          label: "Existing comments are preserved",
          text: "If the annotation already contains a comment, AIdea appends the translation instead of replacing it.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Got it",
      close: "Close update notice",
    },
    "zh-CN": {
      eyebrow: "更新提示",
      title: "划词翻译自动兜底与双语标注",
      lead: "AIdea 现在可以在长文档超过模型输入限制时自动缩减上下文并重试，还可以将生成的译文直接写入新建的 Zotero 高亮标注。",
      note: "更新后请重启 Zotero。勾选框仅对当前选区生效，需要在选择高亮颜色前勾选。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "长文档自动重试",
          text: "首次准备上下文遇到输入过长错误时，AIdea 会逐级缩减内容并自动重试。",
        },
        {
          label: "超长失败自动兜底",
          text: "如果缩减后仍然超过限制，AIdea 会直接翻译当前选中的文本，不再因冷启动失败而中断。",
        },
        {
          label: "译文写入高亮标注",
          text: "译文生成后，勾选“将译文写入标注”，再选择上方的高亮颜色，即可将译文写入新标注的批注。",
        },
        {
          label: "安全保留已有批注",
          text: "如果标注已有批注内容，AIdea 会在其后追加译文，不会覆盖原内容。",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "知道了",
      close: "关闭更新提示",
    },
    "zh-TW": {
      eyebrow: "更新提示",
      title: "選取翻譯自動備援與雙語標註",
      lead: "AIdea 現在能在長文件超過模型輸入限制時自動縮減文件上下文並重試，也能將產生的譯文直接寫入新建立的 Zotero 高亮標註。",
      note: "更新後請重新啟動 Zotero。勾選框只套用於目前選取範圍，並須在選擇高亮顏色前勾選。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "長文件自動重試",
          text: "首次準備上下文時若超過輸入限制，AIdea 會逐步縮減內容並自動重試。",
        },
        {
          label: "僅選取文字備援",
          text: "若縮減後仍然過長，AIdea 會直接翻譯目前選取的文字，不會因冷啟動錯誤而停止。",
        },
        {
          label: "譯文寫入高亮標註",
          text: "產生譯文後，勾選「將譯文寫入標註」並選擇高亮顏色，即可把譯文寫入新標註的註解。",
        },
        {
          label: "保留既有註解",
          text: "如果標註已有註解內容，AIdea 會在其後附加譯文，而不會取代原內容。",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "知道了",
      close: "關閉更新提示",
    },
    "ja-JP": {
      eyebrow: "更新のお知らせ",
      title: "選択翻訳の自動フォールバックと二言語注釈",
      lead: "長い文書がモデルの入力上限を超えた場合、AIdea は文書コンテキストを段階的に縮小して自動的に再試行します。生成された翻訳を新しい Zotero ハイライト注釈へ直接保存することもできます。",
      note: "更新後に Zotero を再起動してください。チェックボックスは現在の選択範囲にのみ適用され、ハイライト色を選ぶ前に有効にする必要があります。",
      alsoLabel: "今回の更新内容",
      alsoItems: [
        {
          label: "長い文書を自動再試行",
          text: "初回コンテキストが入力上限を超えた場合、AIdea は内容を段階的に縮小して自動的に再試行します。",
        },
        {
          label: "選択テキストのみで継続",
          text: "縮小後も長すぎる場合は、コールドスタートエラーで停止せず、選択したテキストを直接翻訳します。",
        },
        {
          label: "ハイライト注釈へ翻訳を保存",
          text: "翻訳後に「翻訳を注釈に書き込む」を選び、ハイライト色を選択すると、新しい注釈のコメントへ翻訳を書き込みます。",
        },
        {
          label: "既存コメントを保持",
          text: "注釈にコメントがある場合、AIdea は内容を置き換えず、その後ろに翻訳を追加します。",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "了解",
      close: "更新通知を閉じる",
    },
    "ko-KR": {
      eyebrow: "업데이트 안내",
      title: "선택 번역 자동 대체 및 이중 언어 주석",
      lead: "긴 문서가 모델의 입력 한도를 초과하면 AIdea가 문서 컨텍스트를 단계적으로 줄여 자동으로 다시 시도합니다. 생성된 번역을 새 Zotero 하이라이트 주석에 바로 저장할 수도 있습니다.",
      note: "업데이트 후 Zotero를 다시 시작하세요. 체크박스는 현재 선택 영역에만 적용되며 하이라이트 색상을 선택하기 전에 체크해야 합니다.",
      alsoLabel: "이번 업데이트 내용",
      alsoItems: [
        {
          label: "긴 문서 자동 재시도",
          text: "최초 컨텍스트가 입력 한도를 초과하면 AIdea가 내용을 단계적으로 줄이고 자동으로 다시 시도합니다.",
        },
        {
          label: "선택 텍스트 전용 대체",
          text: "줄인 컨텍스트도 너무 길면 콜드 스타트 오류로 중단하지 않고 선택한 텍스트를 직접 번역합니다.",
        },
        {
          label: "하이라이트 주석에 번역 저장",
          text: "번역이 생성된 후 ‘번역을 주석에 쓰기’를 선택하고 하이라이트 색상을 고르면 새 주석의 댓글에 번역이 저장됩니다.",
        },
        {
          label: "기존 댓글 보존",
          text: "주석에 기존 댓글이 있으면 AIdea가 내용을 바꾸지 않고 번역을 뒤에 추가합니다.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "확인",
      close: "업데이트 안내 닫기",
    },
    "fr-FR": {
      eyebrow: "Mise à jour",
      title: "Traduction de sélection fiable et annotations bilingues",
      lead: "AIdea peut maintenant réduire progressivement le contexte et réessayer lorsqu’un document long dépasse la limite d’entrée du modèle. La traduction générée peut aussi être enregistrée directement dans une nouvelle annotation surlignée de Zotero.",
      note: "Redémarrez Zotero après la mise à jour. La case s’applique uniquement à la sélection actuelle et doit être cochée avant de choisir une couleur de surlignage.",
      alsoLabel: "Cette mise à jour comprend",
      alsoItems: [
        {
          label: "Nouvelles tentatives automatiques",
          text: "Si le contexte initial dépasse la limite d’entrée, AIdea le réduit progressivement et réessaie automatiquement.",
        },
        {
          label: "Repli sur le texte sélectionné",
          text: "Si le contexte réduit reste trop long, AIdea traduit directement le texte sélectionné au lieu de s’arrêter sur une erreur de démarrage.",
        },
        {
          label: "Traduction dans les annotations surlignées",
          text: "Après la traduction, cochez « Ajouter la traduction à l’annotation » puis choisissez une couleur pour écrire la traduction dans le commentaire de la nouvelle annotation.",
        },
        {
          label: "Commentaires existants conservés",
          text: "Si l’annotation contient déjà un commentaire, AIdea ajoute la traduction sans remplacer le contenu existant.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Compris",
      close: "Fermer l’avis de mise à jour",
    },
    "de-DE": {
      eyebrow: "Update",
      title: "Zuverlässige Auswahlübersetzung und zweisprachige Anmerkungen",
      lead: "AIdea kann den Dokumentkontext jetzt schrittweise verkleinern und automatisch erneut versuchen, wenn ein langes Dokument das Eingabelimit des Modells überschreitet. Die erzeugte Übersetzung lässt sich außerdem direkt in einer neuen Zotero-Hervorhebung speichern.",
      note: "Starten Sie Zotero nach dem Update neu. Das Kontrollkästchen gilt nur für die aktuelle Auswahl und muss vor der Auswahl einer Hervorhebungsfarbe aktiviert werden.",
      alsoLabel: "Dieses Update enthält",
      alsoItems: [
        {
          label: "Automatische Versuche bei langen Dokumenten",
          text: "Wenn der erste Kontext das Eingabelimit überschreitet, verkleinert AIdea ihn schrittweise und versucht es automatisch erneut.",
        },
        {
          label: "Fallback nur auf die Auswahl",
          text: "Bleibt der verkleinerte Kontext zu lang, übersetzt AIdea den ausgewählten Text direkt, statt mit einem Kaltstartfehler abzubrechen.",
        },
        {
          label: "Übersetzung in Hervorhebungen",
          text: "Aktivieren Sie nach der Übersetzung „Uebersetzung in die Anmerkung schreiben“ und wählen Sie eine Farbe, um die Übersetzung in den Kommentar der neuen Anmerkung zu schreiben.",
        },
        {
          label: "Vorhandene Kommentare bleiben erhalten",
          text: "Enthält die Anmerkung bereits einen Kommentar, hängt AIdea die Übersetzung an, ohne den vorhandenen Inhalt zu ersetzen.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Verstanden",
      close: "Update-Hinweis schließen",
    },
    "es-ES": {
      eyebrow: "Actualización",
      title: "Traducción de selección fiable y anotaciones bilingües",
      lead: "AIdea ahora puede reducir progresivamente el contexto y reintentar cuando un documento largo supera el límite de entrada del modelo. También puede guardar la traducción generada directamente en una nueva anotación resaltada de Zotero.",
      note: "Reinicia Zotero después de actualizar. La casilla solo se aplica a la selección actual y debe marcarse antes de elegir un color de resaltado.",
      alsoLabel: "Esta actualización incluye",
      alsoItems: [
        {
          label: "Reintentos automáticos para documentos largos",
          text: "Si el contexto inicial supera el límite de entrada, AIdea lo reduce progresivamente y reintenta automáticamente.",
        },
        {
          label: "Alternativa con solo la selección",
          text: "Si el contexto reducido sigue siendo demasiado largo, AIdea traduce directamente el texto seleccionado en lugar de detenerse por un error de inicio.",
        },
        {
          label: "Traducciones en anotaciones resaltadas",
          text: "Después de generar la traducción, marca «Guardar la traduccion en la anotacion» y elige un color para escribirla en el comentario de la nueva anotación.",
        },
        {
          label: "Se conservan los comentarios existentes",
          text: "Si la anotación ya contiene un comentario, AIdea añade la traducción sin reemplazar el contenido existente.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Entendido",
      close: "Cerrar aviso de actualización",
    },
    "ru-RU": {
      eyebrow: "Обновление",
      title: "Надёжный перевод выделения и двуязычные аннотации",
      lead: "Если длинный документ превышает входной лимит модели, AIdea теперь поэтапно сокращает контекст и автоматически повторяет запрос. Готовый перевод также можно сразу сохранить в новой выделенной аннотации Zotero.",
      note: "После обновления перезапустите Zotero. Флажок действует только для текущего выделения и должен быть установлен до выбора цвета.",
      alsoLabel: "В это обновление входит",
      alsoItems: [
        {
          label: "Автоповтор для длинных документов",
          text: "Если исходный контекст превышает входной лимит, AIdea поэтапно сокращает его и автоматически повторяет запрос.",
        },
        {
          label: "Резервный перевод только выделения",
          text: "Если сокращённый контекст всё ещё слишком длинный, AIdea переводит выделенный текст напрямую и не останавливается из-за ошибки холодного запуска.",
        },
        {
          label: "Перевод в выделенной аннотации",
          text: "После перевода установите «Записать перевод в аннотацию» и выберите цвет, чтобы записать перевод в комментарий новой аннотации.",
        },
        {
          label: "Сохранение существующих комментариев",
          text: "Если у аннотации уже есть комментарий, AIdea добавляет перевод после него, не заменяя существующий текст.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Понятно",
      close: "Закрыть уведомление об обновлении",
    },
    "pt-BR": {
      eyebrow: "Atualização",
      title: "Tradução de seleção confiável e anotações bilíngues",
      lead: "O AIdea agora reduz progressivamente o contexto e tenta novamente quando um documento longo excede o limite de entrada do modelo. A tradução gerada também pode ser salva diretamente em uma nova anotação destacada do Zotero.",
      note: "Reinicie o Zotero após atualizar. A caixa vale apenas para a seleção atual e deve ser marcada antes de escolher uma cor de destaque.",
      alsoLabel: "Esta atualização inclui",
      alsoItems: [
        {
          label: "Novas tentativas automáticas",
          text: "Se o contexto inicial exceder o limite de entrada, o AIdea o reduz progressivamente e tenta novamente de forma automática.",
        },
        {
          label: "Alternativa somente com a seleção",
          text: "Se o contexto reduzido continuar longo demais, o AIdea traduz diretamente o texto selecionado em vez de parar com um erro de inicialização.",
        },
        {
          label: "Tradução em anotações destacadas",
          text: "Depois da tradução, marque “Salvar a traducao na anotacao” e escolha uma cor para gravá-la no comentário da nova anotação.",
        },
        {
          label: "Comentários existentes preservados",
          text: "Se a anotação já tiver um comentário, o AIdea acrescenta a tradução sem substituir o conteúdo existente.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Entendido",
      close: "Fechar aviso de atualização",
    },
    "ar-SA": {
      eyebrow: "تحديث",
      title: "ترجمة تحديد موثوقة وتعليقات توضيحية ثنائية اللغة",
      lead: "يستطيع AIdea الآن تقليص سياق المستند تدريجيا وإعادة المحاولة تلقائيا عندما يتجاوز مستند طويل حد إدخال النموذج. ويمكن أيضا حفظ الترجمة الناتجة مباشرة في تعليق توضيحي جديد ومميز في Zotero.",
      note: "أعد تشغيل Zotero بعد التحديث. ينطبق مربع الاختيار على التحديد الحالي فقط ويجب تحديده قبل اختيار لون التمييز.",
      alsoLabel: "يتضمن هذا التحديث",
      alsoItems: [
        {
          label: "إعادة المحاولة تلقائيا للمستندات الطويلة",
          text: "إذا تجاوز السياق الأولي حد الإدخال، يقلصه AIdea تدريجيا ويعيد المحاولة تلقائيا.",
        },
        {
          label: "الرجوع إلى النص المحدد فقط",
          text: "إذا ظل السياق المختصر طويلا جدا، يترجم AIdea النص المحدد مباشرة بدلا من التوقف بسبب خطأ البدء البارد.",
        },
        {
          label: "الترجمة في التعليقات المميزة",
          text: "بعد إنشاء الترجمة، حدد «كتابة الترجمة في التعليق التوضيحي» ثم اختر لونا لكتابتها في تعليق التوضيح الجديد.",
        },
        {
          label: "الحفاظ على التعليقات الموجودة",
          text: "إذا كان التعليق التوضيحي يحتوي على نص، يضيف AIdea الترجمة بعده دون استبدال المحتوى الموجود.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "فهمت",
      close: "إغلاق إشعار التحديث",
    },
    "hi-IN": {
      eyebrow: "अपडेट",
      title: "विश्वसनीय चयन अनुवाद और द्विभाषी एनोटेशन",
      lead: "लंबा दस्तावेज़ मॉडल की input limit से बड़ा होने पर AIdea अब document context को चरणों में कम करके अपने आप फिर कोशिश करता है। तैयार अनुवाद को नए Zotero highlight annotation में सीधे सहेजा भी जा सकता है।",
      note: "अपडेट के बाद Zotero को फिर शुरू करें। Checkbox केवल मौजूदा selection पर लागू होता है और highlight color चुनने से पहले इसे चुनना आवश्यक है।",
      alsoLabel: "इस अपडेट में शामिल है",
      alsoItems: [
        {
          label: "लंबे दस्तावेज़ों के लिए automatic retry",
          text: "शुरुआती context input limit से बड़ा होने पर AIdea उसे चरणों में कम करता है और अपने आप फिर कोशिश करता है।",
        },
        {
          label: "केवल चुने हुए text का fallback",
          text: "कम किया गया context भी बहुत लंबा हो तो AIdea cold-start error पर रुकने के बजाय चुने हुए text का सीधे अनुवाद करता है।",
        },
        {
          label: "Highlight annotation में अनुवाद",
          text: "अनुवाद बनने के बाद ‘अनुवाद को एनोटेशन में लिखें’ चुनें और नया annotation comment बनाने के लिए highlight color चुनें।",
        },
        {
          label: "मौजूदा comments सुरक्षित",
          text: "Annotation में पहले से comment होने पर AIdea उसे बदलने के बजाय उसके बाद अनुवाद जोड़ता है।",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "समझ गया",
      close: "अपडेट सूचना बंद करें",
    },
  };

let noticeShowingOrSeen = false;
const NOTICE_DIALOG_WIDTH = 760;
const NOTICE_DIALOG_HEIGHT = 520;
const NOTICE_BODY_WIDTH = NOTICE_DIALOG_WIDTH - 40;
const NOTICE_CONFIRM_BUTTON_ID = "confirm-update-notice";

function wasNoticeSeen(): boolean {
  try {
    return String(Zotero.Prefs.get(NOTICE_PREF, true) || "") === NOTICE_ID;
  } catch {
    return false;
  }
}

function markNoticeSeen(): void {
  noticeShowingOrSeen = true;
  try {
    Zotero.Prefs.set(NOTICE_PREF, NOTICE_ID, true);
  } catch (err) {
    ztoolkit.log("AIdea: failed to persist update notice state", err);
  }
}

function getNoticeLabelSeparator(
  label: string,
  language: { htmlLang: string },
): string {
  const htmlLang = language.htmlLang.toLowerCase();
  if (
    htmlLang.startsWith("zh") ||
    htmlLang.startsWith("ja") ||
    htmlLang.startsWith("ko")
  ) {
    return "：";
  }
  return ": ";
}

function createNoticeBody(
  copy: UpdateNoticeCopy,
  language: { dir: string; htmlLang: string },
) {
  const alsoChildren = copy.alsoItems?.length
    ? [
        {
          tag: "div",
          namespace: "html",
          styles: {
            marginBottom: "7px",
            color: "var(--llm-theme-accent, #0f766e)",
            fontSize: "12px",
            fontWeight: "750",
          },
          properties: { innerText: copy.alsoLabel || "" },
        },
        ...copy.alsoItems.map((item) => {
          const separator = getNoticeLabelSeparator(item.label, language);
          return {
            tag: "div",
            namespace: "html",
            styles: {
              marginBottom: "9px",
              color: "var(--llm-theme-chat-fg, #1f2328)",
              fontSize: "13px",
              lineHeight: "1.58",
            },
            children: [
              {
                tag: "span",
                namespace: "html",
                properties: { innerText: `${item.label}${separator}` },
                styles: { fontWeight: "750" },
              },
              {
                tag: "span",
                namespace: "html",
                properties: { innerText: item.text },
              },
            ],
          };
        }),
      ]
    : [];
  const detailChildren = copy.modeItems?.length
    ? copy.modeItems.map((item) => {
        const separator = getNoticeLabelSeparator(item.label, language);
        return {
          tag: "div",
          namespace: "html",
          styles: {
            marginBottom: "9px",
            color: "var(--llm-theme-chat-fg, #1f2328)",
            fontSize: "13px",
            lineHeight: "1.58",
          },
          children: [
            {
              tag: "span",
              namespace: "html",
              properties: { innerText: `${item.label}${separator}` },
              styles: {
                fontWeight: "750",
              },
            },
            {
              tag: "span",
              namespace: "html",
              properties: { innerText: item.text },
            },
          ],
        };
      })
    : [
        {
          tag: "div",
          namespace: "html",
          properties: { innerText: copy.examplePrompt },
          styles: {
            color: "var(--llm-theme-chat-fg, #1f2328)",
            fontSize: "13px",
            lineHeight: "1.58",
            userSelect: "text",
            whiteSpace: "pre-wrap",
          },
        },
      ];
  const hasDetailCard = Boolean(
    copy.exampleLabel && (copy.examplePrompt || copy.modeItems?.length),
  );
  return {
    tag: "div",
    namespace: "html",
    attributes: {
      class: "llm-update-notice-body",
      dir: language.dir,
      lang: language.htmlLang,
    },
    styles: {
      width: `${NOTICE_BODY_WIDTH}px`,
      padding: "22px 24px 8px",
      boxSizing: "border-box",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: "var(--llm-theme-chat-fg, #1f2328)",
      background: "var(--llm-theme-menu-bg, #fff)",
    },
    children: [
      {
        tag: "div",
        namespace: "html",
        properties: { innerText: copy.eyebrow },
        styles: {
          marginBottom: "8px",
          color: "var(--llm-theme-accent, #0d9488)",
          fontSize: "12px",
          fontWeight: "700",
          letterSpacing: "0",
          textTransform: "uppercase",
        },
      },
      {
        tag: "div",
        namespace: "html",
        properties: { innerText: copy.title },
        styles: {
          marginBottom: "14px",
          color: "var(--llm-theme-chat-fg, #111827)",
          fontSize: "19px",
          fontWeight: "750",
          lineHeight: "1.3",
        },
      },
      {
        tag: "div",
        namespace: "html",
        properties: { innerText: copy.lead },
        styles: {
          marginBottom: "16px",
          color: "var(--llm-theme-chat-muted, #374151)",
          fontSize: "13px",
          fontWeight: "650",
          lineHeight: "1.55",
        },
      },
      ...(alsoChildren.length
        ? [
            {
              tag: "div",
              namespace: "html",
              styles: {
                marginBottom: "16px",
                padding: "12px 14px",
                border:
                  "1px solid var(--llm-theme-border, rgba(99, 102, 241, 0.18))",
                borderRadius: "8px",
                background:
                  "var(--llm-theme-chip-bg, rgba(99, 102, 241, 0.055))",
              },
              children: alsoChildren,
            },
          ]
        : []),
      ...(hasDetailCard
        ? [
            {
              tag: "div",
              namespace: "html",
              styles: {
                padding: "13px 14px",
                border:
                  "1px solid var(--llm-theme-border, rgba(13, 148, 136, 0.22))",
                borderRadius: "8px",
                background:
                  "var(--llm-theme-chip-bg, rgba(13, 148, 136, 0.06))",
              },
              children: [
                {
                  tag: "div",
                  namespace: "html",
                  properties: { innerText: copy.exampleLabel },
                  styles: {
                    marginBottom: "7px",
                    color: "var(--llm-theme-accent, #0f766e)",
                    fontSize: "12px",
                    fontWeight: "750",
                  },
                },
                ...detailChildren,
              ],
            },
          ]
        : []),
      {
        tag: "div",
        namespace: "html",
        properties: { innerText: copy.note },
        styles: {
          marginTop: "14px",
          padding: "10px 12px",
          borderInlineStart: "3px solid #dc2626",
          borderRadius: "6px",
          background: "rgba(220, 38, 38, 0.08)",
          color: "#b91c1c",
          fontSize: "12px",
          fontWeight: "750",
          lineHeight: "1.5",
        },
      },
    ],
  };
}

function styleConfirmButton(dialog: DialogHelper): void {
  const button = dialog.window?.document?.getElementById(
    NOTICE_CONFIRM_BUTTON_ID,
  ) as HTMLElement | null;
  if (!button) return;
  applyCurrentThemeToRoot(button);
  Object.assign(button.style, {
    minWidth: "86px",
    minHeight: "40px",
    padding: "6px 18px",
    borderRadius: "6px",
    color: "#ffffff",
    background: "var(--llm-theme-accent, #0d9488)",
    borderColor: "var(--llm-theme-accent, #0d9488)",
    fontSize: "14px",
    fontWeight: "650",
    lineHeight: "1.35",
  });
}

export function maybeShowOpenAIUpdateNotice(win: Window): void {
  if (noticeShowingOrSeen || wasNoticeSeen()) return;

  const lang = getPanelLang();
  const baseCopy =
    CURRENT_UPDATE_NOTICE_COPIES["en-US"] ||
    ZOTERO_10_UPDATE_NOTICE_COPIES["en-US"] ||
    PDF_TRANSLATION_UPDATE_COPIES["en-US"] ||
    OAUTH_ENV_UPDATE_COPIES["en-US"] ||
    COPIES["en-US"];
  const localizedCopy =
    CURRENT_UPDATE_NOTICE_COPIES[lang] ||
    CURRENT_UPDATE_NOTICE_COPIES["en-US"] ||
    ZOTERO_10_UPDATE_NOTICE_COPIES[lang] ||
    ZOTERO_10_UPDATE_NOTICE_COPIES["en-US"] ||
    PDF_TRANSLATION_UPDATE_COPIES[lang] ||
    PDF_TRANSLATION_UPDATE_COPIES["en-US"] ||
    OAUTH_ENV_UPDATE_COPIES[lang] ||
    OAUTH_ENV_UPDATE_COPIES["en-US"] ||
    COPIES["en-US"];
  const copy = {
    ...localizedCopy,
    alsoLabel: localizedCopy.alsoLabel || baseCopy.alsoLabel,
    alsoItems: localizedCopy.alsoItems || baseCopy.alsoItems,
  };
  const language = getUiLanguageOption(lang);
  noticeShowingOrSeen = true;

  try {
    const dialog = new DialogHelper(1, 1);
    dialog
      .addCell(0, 0, createNoticeBody(copy, language), false)
      .addButton(copy.confirm, NOTICE_CONFIRM_BUTTON_ID, {
        noClose: true,
        callback: () => {
          markNoticeSeen();
          dialog.window.close();
        },
      })
      .setDialogData({
        unloadCallback: () => {
          markNoticeSeen();
        },
      })
      .open(copy.title, {
        width: NOTICE_DIALOG_WIDTH,
        height: NOTICE_DIALOG_HEIGHT,
        centerscreen: true,
        resizable: false,
        fitContent: true,
        alwaysRaised: true,
      });
    styleConfirmButton(dialog);
    const noticeBody = dialog.window?.document?.querySelector(
      ".llm-update-notice-body",
    ) as HTMLElement | null;
    if (noticeBody) applyCurrentThemeToRoot(noticeBody);
    (globalThis as any).addon.data.dialog = dialog;
  } catch (err) {
    ztoolkit.log("AIdea: DialogHelper update notice failed", err);
    markNoticeSeen();
  }
}
