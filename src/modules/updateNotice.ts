import { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";
import { applyCurrentThemeToRoot } from "./contextPanel/theme";

const NOTICE_ID = "v3.2.1-conversation-theme-oauth-env-v1";
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

const CURRENT_UPDATE_NOTICE_COPIES: Partial<
  Record<PanelLang, UpdateNoticeCopy>
> = {
  "en-US": {
    eyebrow: "Update",
    title: "Conversation experience update",
    lead: "This update refines AIdea's plugin-wide visual themes and improves OAuth authorization environment installation and update flows. The interface is more consistent, and environment maintenance is more automatic.",
    note: "The plugin has been updated. Restart Zotero to make sure the new interface styles and background environment update logic are fully active.",
    alsoLabel: "This update includes",
    alsoItems: [
      {
        label: "Plugin themes",
        text: "New built-in themes are available across AIdea's own interface: Blue Porcelain, Eye Green, Warm Cream, Premium Gray, Midnight Black, and Sakura Pink. The Default theme keeps the existing system style.",
      },
      {
        label: "Input area polish",
        text: "The input area now uses a soft theme background, the central editor keeps a clearer reading layer, and the Send button follows the current theme color.",
      },
      {
        label: "Clearer emphasis",
        text: "Bold content in model replies now uses the current theme's emphasis color, making summaries, conclusions, keywords, and structured points easier to scan.",
      },
      {
        label: "Send button",
        text: "The Send button now uses a paper-plane icon for a more stable layout. Its tooltip and accessibility label still follow the current interface language.",
      },
      {
        label: "OAuth environment updates",
        text: "OAuth authorization environment checks, installs, and updates have been improved. On Windows, macOS, and Ubuntu, AIdea will complete the available automatic steps and provide clearer terminal guidance when manual action is needed.",
      },
    ],
    exampleLabel: "Usage",
    examplePrompt: "",
    modeItems: [
      {
        label: "Choose a theme",
        text: "Switch themes from the plugin theme option in Settings.",
      },
      {
        label: "Default theme",
        text: "Use the Default theme if you prefer an interface closer to Zotero's native style.",
      },
      {
        label: "Environment update",
        text: "If the OAuth authorization environment needs an update, click Install/Update Env in Settings. AIdea will run the steps it can complete automatically.",
      },
    ],
    confirm: "OK",
    close: "Close update notice",
  },
  "zh-CN": {
    eyebrow: "更新提示",
    title: "对话体验更新",
    lead: "这次更新优化了对话标签页的主题视觉，并改进了 OAuth 授权环境的安装与更新流程。界面更统一，环境维护也更自动。",
    note: "插件已更新。建议重启 Zotero，以确保新的界面样式和后台环境更新逻辑完整生效。",
    alsoLabel: "本次更新包括",
    alsoItems: [
      {
        label: "插件主题",
        text: "新增多套内置插件主题：青花瓷、护眼绿、米白色、高级灰、暗夜黑、樱花粉。默认主题继续保持原有系统样式。",
      },
      {
        label: "输入区视觉优化",
        text: "输入区域现在会跟随主题呈现柔和背景，中心输入框保持更清晰的阅读层次，发送按钮也会同步使用当前主题色。",
      },
      {
        label: "重点文字更清晰",
        text: "模型回复中的加粗内容会使用当前主题的强调色显示，便于快速识别摘要、结论、关键词和结构化要点。",
      },
      {
        label: "发送按钮优化",
        text: "发送按钮改为纸飞机图标，视觉更稳定；鼠标悬停提示和无障碍标签仍会跟随当前界面语言。",
      },
      {
        label: "OAuth 授权环境更新",
        text: "优化了 OAuth 授权环境的检查、安装和更新流程。在 Windows、macOS 和 Ubuntu 上会尽量自动完成环境准备；需要用户手动处理时，会给出更明确的终端提示。",
      },
    ],
    exampleLabel: "使用说明",
    examplePrompt: "",
    modeItems: [
      {
        label: "选择主题",
        text: "可在设置中的插件主题选项里切换主题。",
      },
      {
        label: "默认主题",
        text: "如果希望界面尽量接近 Zotero 原生样式，可以继续使用默认主题。",
      },
      {
        label: "环境更新",
        text: "如果 OAuth 授权环境提示需要更新，可在设置中点击安装/更新环境，AIdea 会自动执行可完成的步骤。",
      },
    ],
    confirm: "我知道了",
    close: "关闭更新提示",
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
  return /[A-Za-z]/.test(label) ? ": " : "：";
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
          marginBottom: "12px",
          color: "var(--llm-theme-chat-muted, #374151)",
          fontSize: "13px",
          fontWeight: "650",
          lineHeight: "1.55",
        },
      },
      {
        tag: "div",
        namespace: "html",
        properties: { innerText: copy.note },
        styles: {
          marginBottom: "16px",
          padding: "10px 12px",
          borderInlineStart: "3px solid #dc2626",
          borderRadius: "6px",
          background: "rgba(220, 38, 38, 0.08)",
          color: "#b91c1c",
          fontSize: "13px",
          fontWeight: "700",
          lineHeight: "1.5",
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
                background: "var(--llm-theme-chip-bg, rgba(99, 102, 241, 0.055))",
              },
              children: alsoChildren,
            },
          ]
        : []),
      {
        tag: "div",
        namespace: "html",
        styles: {
          padding: "13px 14px",
          border:
            "1px solid var(--llm-theme-border, rgba(13, 148, 136, 0.22))",
          borderRadius: "8px",
          background: "var(--llm-theme-chip-bg, rgba(13, 148, 136, 0.06))",
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
