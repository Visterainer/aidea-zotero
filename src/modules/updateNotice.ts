import { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";
import { applyCurrentThemeToRoot } from "./contextPanel/theme";

const NOTICE_ID = "v3.2.4-selection-translation-and-codex-models-v1";
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

export const CURRENT_UPDATE_NOTICE_COPIES: Record<PanelLang, UpdateNoticeCopy> =
  {
    "en-US": {
      eyebrow: "Update",
      title: "Selection translation and Codex model updates",
      lead: "This update further improves selection translation and expands Codex OAuth model support.",
      note: "Restart Zotero after updating the plugin. The new models may not work correctly until the Codex OAuth environment is updated.",
      alsoLabel: "This update includes",
      alsoItems: [
        {
          label: "Streaming translation",
          text: "Selection translations now appear in real time as they are generated.",
        },
        {
          label: "Copy and notes",
          text: "Copy the complete translation or add it directly to a Zotero note.",
        },
        {
          label: "Popup size",
          text: "Drag to resize the popup; its height adapts dynamically to the translated content.",
        },
        {
          label: "Stable position",
          text: "Fixed the popup moving after Copy or Add to Note is clicked.",
        },
        {
          label: "New models",
          text: "Added support for gpt-5.6-sol, gpt-5.6-terra, and gpt-5.6-luna.",
        },
      ],
      exampleLabel: "Before using the new models",
      examplePrompt:
        "Setting → Model Config → OAuth Providers → ChatGPT (Codex OAuth) → Install/Update Env. Once the environment update finishes, the new models are ready to use.",
      confirm: "Got it",
      close: "Close update notice",
    },
    "zh-CN": {
      eyebrow: "更新提示",
      title: "划词翻译与 Codex 模型更新",
      lead: "本次更新进一步优化了划词翻译体验，并扩展了 Codex OAuth 模型支持。",
      note: "更新插件后请重启 Zotero。若未更新 Codex OAuth 环境，新模型可能无法正常调用。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "流式翻译",
          text: "划词翻译内容支持实时流式显示。",
        },
        {
          label: "复制与笔记",
          text: "支持复制完整译文，并可直接添加到 Zotero 笔记。",
        },
        {
          label: "弹窗尺寸",
          text: "可拖动调整弹窗大小，并根据内容动态适配高度。",
        },
        {
          label: "位置稳定",
          text: "修复点击“复制”或“添加到笔记”后弹窗位置跳动的问题。",
        },
        {
          label: "新增模型",
          text: "现已支持 gpt-5.6-sol、gpt-5.6-terra 和 gpt-5.6-luna。",
        },
      ],
      exampleLabel: "使用新模型前",
      examplePrompt:
        "设置 → 模型配置 → OAuth 提供商 → ChatGPT (Codex OAuth) → 安装/更新环境。完成后即可使用新模型。",
      confirm: "知道了",
      close: "关闭更新提示",
    },
    "zh-TW": {
      eyebrow: "更新提示",
      title: "劃詞翻譯與 Codex 模型更新",
      lead: "本次更新進一步改善了劃詞翻譯體驗，並擴充了 Codex OAuth 模型支援。",
      note: "更新外掛後請重新啟動 Zotero。若未更新 Codex OAuth 環境，新模型可能無法正常使用。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "串流翻譯",
          text: "劃詞翻譯內容支援即時串流顯示。",
        },
        {
          label: "複製與筆記",
          text: "支援複製完整譯文，並可直接加入 Zotero 筆記。",
        },
        {
          label: "彈窗尺寸",
          text: "可拖曳調整彈窗大小，並依內容動態調整高度。",
        },
        {
          label: "位置穩定",
          text: "修正點擊「複製」或「加入筆記」後彈窗位置跳動的問題。",
        },
        {
          label: "新增模型",
          text: "現已支援 gpt-5.6-sol、gpt-5.6-terra 和 gpt-5.6-luna。",
        },
      ],
      exampleLabel: "使用新模型前",
      examplePrompt:
        "設定 → 模型設定 → OAuth 提供商 → ChatGPT (Codex OAuth) → 安裝/更新環境。完成後即可使用新模型。",
      confirm: "知道了",
      close: "關閉更新提示",
    },
    "ja-JP": {
      eyebrow: "更新のお知らせ",
      title: "選択範囲翻訳と Codex モデルのアップデート",
      lead: "今回のアップデートでは、選択範囲翻訳をさらに改善し、Codex OAuth で利用できるモデルを拡充しました。",
      note: "プラグインの更新後に Zotero を再起動してください。Codex OAuth 環境を更新しないと、新しいモデルが正しく動作しない場合があります。",
      alsoLabel: "今回の更新内容",
      alsoItems: [
        {
          label: "ストリーミング翻訳",
          text: "選択範囲の翻訳結果が生成中にリアルタイムで表示されます。",
        },
        {
          label: "コピーとノート",
          text: "翻訳全文をコピーしたり、Zotero のノートに直接追加したりできます。",
        },
        {
          label: "ポップアップサイズ",
          text: "ドラッグしてサイズを変更でき、内容に合わせて高さが動的に調整されます。",
        },
        {
          label: "位置の安定化",
          text: "「コピー」または「ノートに追加」をクリックした後にポップアップが移動する問題を修正しました。",
        },
        {
          label: "新しいモデル",
          text: "gpt-5.6-sol、gpt-5.6-terra、gpt-5.6-luna に対応しました。",
        },
      ],
      exampleLabel: "新しいモデルを使用する前に",
      examplePrompt:
        "設定 → モデル設定 → OAuth プロバイダー → ChatGPT (Codex OAuth) → 環境をインストール/更新。完了後、新しいモデルを利用できます。",
      confirm: "了解",
      close: "更新通知を閉じる",
    },
    "ko-KR": {
      eyebrow: "업데이트 안내",
      title: "선택 번역 및 Codex 모델 업데이트",
      lead: "이번 업데이트에서는 선택 번역 환경을 더욱 개선하고 Codex OAuth 모델 지원을 확대했습니다.",
      note: "플러그인 업데이트 후 Zotero를 다시 시작하세요. Codex OAuth 환경을 업데이트하지 않으면 새 모델이 정상적으로 작동하지 않을 수 있습니다.",
      alsoLabel: "이번 업데이트 내용",
      alsoItems: [
        {
          label: "스트리밍 번역",
          text: "선택 번역 결과가 생성되는 즉시 실시간으로 표시됩니다.",
        },
        {
          label: "복사 및 노트",
          text: "전체 번역을 복사하거나 Zotero 노트에 바로 추가할 수 있습니다.",
        },
        {
          label: "팝업 크기",
          text: "드래그하여 팝업 크기를 조절할 수 있으며 내용에 따라 높이가 동적으로 맞춰집니다.",
        },
        {
          label: "위치 안정화",
          text: "복사 또는 노트에 추가를 클릭한 뒤 팝업 위치가 이동하는 문제를 수정했습니다.",
        },
        {
          label: "새 모델",
          text: "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna 지원을 추가했습니다.",
        },
      ],
      exampleLabel: "새 모델을 사용하기 전에",
      examplePrompt:
        "설정 → 모델 설정 → OAuth 제공자 → ChatGPT (Codex OAuth) → 환경 설치/업데이트. 완료되면 새 모델을 사용할 수 있습니다.",
      confirm: "확인",
      close: "업데이트 안내 닫기",
    },
    "fr-FR": {
      eyebrow: "Mise à jour",
      title: "Traduction de sélection et modèles Codex",
      lead: "Cette mise à jour améliore encore la traduction de sélection et étend la prise en charge des modèles Codex OAuth.",
      note: "Redémarrez Zotero après la mise à jour du plugin. Les nouveaux modèles risquent de ne pas fonctionner correctement tant que l’environnement Codex OAuth n’a pas été mis à jour.",
      alsoLabel: "Cette mise à jour comprend",
      alsoItems: [
        {
          label: "Traduction en continu",
          text: "La traduction de la sélection s’affiche en temps réel pendant sa génération.",
        },
        {
          label: "Copie et notes",
          text: "Copiez la traduction complète ou ajoutez-la directement à une note Zotero.",
        },
        {
          label: "Taille de la fenêtre",
          text: "Redimensionnez la fenêtre par glisser-déposer ; sa hauteur s’adapte dynamiquement au contenu traduit.",
        },
        {
          label: "Position stable",
          text: "Correction du déplacement de la fenêtre après un clic sur Copier ou Ajouter à la note.",
        },
        {
          label: "Nouveaux modèles",
          text: "Prise en charge de gpt-5.6-sol, gpt-5.6-terra et gpt-5.6-luna.",
        },
      ],
      exampleLabel: "Avant d’utiliser les nouveaux modèles",
      examplePrompt:
        "Paramètres → Configuration du modèle → Fournisseurs OAuth → ChatGPT (Codex OAuth) → Installer/mettre à jour l’environnement. Une fois la mise à jour terminée, les nouveaux modèles sont disponibles.",
      confirm: "Compris",
      close: "Fermer l’avis de mise à jour",
    },
    "de-DE": {
      eyebrow: "Update",
      title: "Auswahlübersetzung und Codex-Modellupdate",
      lead: "Dieses Update verbessert die Auswahlübersetzung weiter und erweitert die Unterstützung für Codex-OAuth-Modelle.",
      note: "Starten Sie Zotero nach dem Plugin-Update neu. Ohne Aktualisierung der Codex-OAuth-Umgebung funktionieren die neuen Modelle möglicherweise nicht korrekt.",
      alsoLabel: "Dieses Update enthält",
      alsoItems: [
        {
          label: "Streaming-Übersetzung",
          text: "Die Übersetzung der Auswahl wird während der Generierung in Echtzeit angezeigt.",
        },
        {
          label: "Kopieren und Notizen",
          text: "Kopieren Sie die vollständige Übersetzung oder fügen Sie sie direkt zu einer Zotero-Notiz hinzu.",
        },
        {
          label: "Popup-Größe",
          text: "Ziehen Sie zum Ändern der Popup-Größe; die Höhe passt sich dynamisch an den übersetzten Inhalt an.",
        },
        {
          label: "Stabile Position",
          text: "Das Verschieben des Popups nach einem Klick auf Kopieren oder Zu Notiz hinzufügen wurde behoben.",
        },
        {
          label: "Neue Modelle",
          text: "Unterstützung für gpt-5.6-sol, gpt-5.6-terra und gpt-5.6-luna hinzugefügt.",
        },
      ],
      exampleLabel: "Vor der Verwendung der neuen Modelle",
      examplePrompt:
        "Einstellungen → Modellkonfiguration → OAuth-Anbieter → ChatGPT (Codex OAuth) → Umgebung installieren/aktualisieren. Nach Abschluss können die neuen Modelle verwendet werden.",
      confirm: "Verstanden",
      close: "Update-Hinweis schließen",
    },
    "es-ES": {
      eyebrow: "Actualización",
      title: "Traducción de selección y modelos Codex",
      lead: "Esta actualización mejora aún más la traducción de selección y amplía la compatibilidad con modelos Codex OAuth.",
      note: "Reinicia Zotero después de actualizar el complemento. Es posible que los nuevos modelos no funcionen correctamente hasta que se actualice el entorno Codex OAuth.",
      alsoLabel: "Esta actualización incluye",
      alsoItems: [
        {
          label: "Traducción en tiempo real",
          text: "La traducción de la selección se muestra en tiempo real mientras se genera.",
        },
        {
          label: "Copia y notas",
          text: "Copia la traducción completa o añádela directamente a una nota de Zotero.",
        },
        {
          label: "Tamaño de la ventana",
          text: "Arrastra para cambiar el tamaño de la ventana; su altura se adapta dinámicamente al contenido traducido.",
        },
        {
          label: "Posición estable",
          text: "Se corrigió el desplazamiento de la ventana tras pulsar Copiar o Añadir a la nota.",
        },
        {
          label: "Nuevos modelos",
          text: "Se añadió compatibilidad con gpt-5.6-sol, gpt-5.6-terra y gpt-5.6-luna.",
        },
      ],
      exampleLabel: "Antes de usar los nuevos modelos",
      examplePrompt:
        "Configuración → Configuración del modelo → Proveedores OAuth → ChatGPT (Codex OAuth) → Instalar/actualizar entorno. Cuando termine la actualización, podrás usar los nuevos modelos.",
      confirm: "Entendido",
      close: "Cerrar aviso de actualización",
    },
    "ru-RU": {
      eyebrow: "Обновление",
      title: "Перевод выделенного текста и модели Codex",
      lead: "Это обновление дополнительно улучшает перевод выделенного текста и расширяет поддержку моделей Codex OAuth.",
      note: "Перезапустите Zotero после обновления плагина. Новые модели могут работать некорректно, пока среда Codex OAuth не будет обновлена.",
      alsoLabel: "В это обновление входит",
      alsoItems: [
        {
          label: "Потоковый перевод",
          text: "Перевод выделенного текста отображается в реальном времени по мере создания.",
        },
        {
          label: "Копирование и заметки",
          text: "Скопируйте перевод целиком или добавьте его непосредственно в заметку Zotero.",
        },
        {
          label: "Размер окна",
          text: "Изменяйте размер окна перетаскиванием; его высота динамически подстраивается под переведенный текст.",
        },
        {
          label: "Стабильное положение",
          text: "Исправлено перемещение окна после нажатия Копировать или Добавить в заметку.",
        },
        {
          label: "Новые модели",
          text: "Добавлена поддержка gpt-5.6-sol, gpt-5.6-terra и gpt-5.6-luna.",
        },
      ],
      exampleLabel: "Перед использованием новых моделей",
      examplePrompt:
        "Настройки → Настройка модели → Поставщики OAuth → ChatGPT (Codex OAuth) → Установить/обновить среду. После завершения новые модели будут доступны.",
      confirm: "Понятно",
      close: "Закрыть уведомление об обновлении",
    },
    "pt-BR": {
      eyebrow: "Atualização",
      title: "Tradução de seleção e modelos Codex",
      lead: "Esta atualização aprimora ainda mais a tradução de seleção e amplia o suporte aos modelos Codex OAuth.",
      note: "Reinicie o Zotero após atualizar o plugin. Os novos modelos podem não funcionar corretamente até que o ambiente Codex OAuth seja atualizado.",
      alsoLabel: "Esta atualização inclui",
      alsoItems: [
        {
          label: "Tradução em tempo real",
          text: "A tradução da seleção aparece em tempo real enquanto é gerada.",
        },
        {
          label: "Cópia e notas",
          text: "Copie a tradução completa ou adicione-a diretamente a uma nota do Zotero.",
        },
        {
          label: "Tamanho da janela",
          text: "Arraste para redimensionar a janela; a altura se adapta dinamicamente ao conteúdo traduzido.",
        },
        {
          label: "Posição estável",
          text: "Foi corrigido o deslocamento da janela após clicar em Copiar ou Adicionar à nota.",
        },
        {
          label: "Novos modelos",
          text: "Adicionado suporte a gpt-5.6-sol, gpt-5.6-terra e gpt-5.6-luna.",
        },
      ],
      exampleLabel: "Antes de usar os novos modelos",
      examplePrompt:
        "Configurações → Configuração do modelo → Provedores OAuth → ChatGPT (Codex OAuth) → Instalar/atualizar ambiente. Depois da atualização, os novos modelos estarão disponíveis.",
      confirm: "Entendido",
      close: "Fechar aviso de atualização",
    },
    "ar-SA": {
      eyebrow: "تحديث",
      title: "تحديث ترجمة النص المحدد ونماذج Codex",
      lead: "يحسن هذا التحديث تجربة ترجمة النص المحدد ويوسع دعم نماذج Codex OAuth.",
      note: "أعد تشغيل Zotero بعد تحديث الإضافة. قد لا تعمل النماذج الجديدة بصورة صحيحة قبل تحديث بيئة Codex OAuth.",
      alsoLabel: "يتضمن هذا التحديث",
      alsoItems: [
        {
          label: "الترجمة المتدفقة",
          text: "تظهر ترجمة النص المحدد لحظيا أثناء إنشائها.",
        },
        {
          label: "النسخ والملاحظات",
          text: "انسخ الترجمة كاملة أو أضفها مباشرة إلى ملاحظة في Zotero.",
        },
        {
          label: "حجم النافذة",
          text: "اسحب لتغيير حجم النافذة؛ ويتكيف ارتفاعها تلقائيا مع المحتوى المترجم.",
        },
        {
          label: "ثبات الموضع",
          text: "تم إصلاح انتقال النافذة بعد النقر على نسخ أو إضافة إلى الملاحظة.",
        },
        {
          label: "نماذج جديدة",
          text: "تمت إضافة دعم \u2068gpt-5.6-sol\u2069 و\u2068gpt-5.6-terra\u2069 و\u2068gpt-5.6-luna\u2069.",
        },
      ],
      exampleLabel: "قبل استخدام النماذج الجديدة",
      examplePrompt:
        "الإعدادات ← إعدادات النموذج ← موفرو OAuth ← \u2068ChatGPT (Codex OAuth)\u2069 ← تثبيت/تحديث البيئة. بعد اكتمال التحديث، يمكنك استخدام النماذج الجديدة.",
      confirm: "فهمت",
      close: "إغلاق إشعار التحديث",
    },
    "hi-IN": {
      eyebrow: "अपडेट",
      title: "चयनित टेक्स्ट अनुवाद और Codex मॉडल अपडेट",
      lead: "यह अपडेट चयनित टेक्स्ट के अनुवाद को बेहतर बनाता है और Codex OAuth मॉडल समर्थन का विस्तार करता है।",
      note: "प्लगइन अपडेट करने के बाद Zotero को पुनः शुरू करें। Codex OAuth environment अपडेट किए बिना नए मॉडल ठीक से काम नहीं कर सकते।",
      alsoLabel: "इस अपडेट में शामिल है",
      alsoItems: [
        {
          label: "स्ट्रीमिंग अनुवाद",
          text: "चयनित टेक्स्ट का अनुवाद बनते समय रीयल टाइम में दिखाई देता है।",
        },
        {
          label: "कॉपी और नोट्स",
          text: "पूरा अनुवाद कॉपी करें या उसे सीधे Zotero नोट में जोड़ें।",
        },
        {
          label: "पॉपअप का आकार",
          text: "खींचकर पॉपअप का आकार बदलें; उसकी ऊंचाई अनुवादित सामग्री के अनुसार अपने आप बदलती है।",
        },
        {
          label: "स्थिर स्थान",
          text: "कॉपी या नोट में जोड़ें पर क्लिक करने के बाद पॉपअप के खिसकने की समस्या ठीक की गई।",
        },
        {
          label: "नए मॉडल",
          text: "gpt-5.6-sol, gpt-5.6-terra और gpt-5.6-luna के लिए समर्थन जोड़ा गया।",
        },
      ],
      exampleLabel: "नए मॉडल इस्तेमाल करने से पहले",
      examplePrompt:
        "सेटिंग्स → मॉडल कॉन्फ़िगरेशन → OAuth प्रदाता → ChatGPT (Codex OAuth) → Environment इंस्टॉल/अपडेट करें। पूरा होने के बाद नए मॉडल इस्तेमाल किए जा सकते हैं।",
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
    OAUTH_ENV_UPDATE_COPIES["en-US"] ||
    COPIES["en-US"];
  const localizedCopy =
    CURRENT_UPDATE_NOTICE_COPIES[lang] ||
    CURRENT_UPDATE_NOTICE_COPIES["en-US"] ||
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
