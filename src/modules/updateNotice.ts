import { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";
import { applyCurrentThemeToRoot } from "./contextPanel/theme";

export const NOTICE_ID = "v3.4.0-epub-context-chat-v1";
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

export const CURRENT_UPDATE_NOTICE_COPIES: Record<PanelLang, UpdateNoticeCopy> =
  {
    "en-US": {
      eyebrow: "Update",
      title: "EPUB context chat and more reliable panel startup",
      lead: "AIdea can now use EPUB books as document context in Zotero's reader panel, with local section routing and bounded retrieval from EPUB 2/3 structure.",
      note: "Restart Zotero after updating. Open a PDF or EPUB and use the same AIdea reader panel; no additional mode switch is required.",
      alsoLabel: "This update includes",
      alsoItems: [
        {
          label: "EPUB side-panel chat",
          text: "Ask about chapters or the whole book directly in the Zotero EPUB reader.",
        },
        {
          label: "Local bounded retrieval",
          text: "Publisher structure, follow-up scope, and whole-book sampling are handled locally without an additional planning-model request.",
        },
        {
          label: "Context-aware selection translation",
          text: "EPUB selections use bounded book context directly, without a separate cold-start request.",
        },
        {
          label: "Reliable and safe",
          text: "Panel initialization can recover from optional migration failures, and malformed or oversized EPUB archives are bounded.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Got it",
      close: "Close update notice",
    },
    "zh-CN": {
      eyebrow: "更新提示",
      title: "EPUB 上下文对话与更可靠的面板启动",
      lead: "AIdea 现在可以在 Zotero EPUB 阅读器侧边栏中把图书作为文档上下文，并根据 EPUB 2/3 结构在本地完成章节路由和有界检索。",
      note: "更新后请重启 Zotero。打开 PDF 或 EPUB 后直接使用同一个 AIdea 阅读器面板，无需切换额外模式。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "EPUB 侧边栏对话",
          text: "可以直接在 Zotero EPUB 阅读器中询问具体章节或整本图书。",
        },
        {
          label: "本地有界检索",
          text: "出版目录结构、追问范围和全书采样均在本地处理，不会额外调用模型规划章节。",
        },
        {
          label: "带上下文的划词翻译",
          text: "EPUB 划词直接使用有界图书上下文，不再执行单独的冷启动请求。",
        },
        {
          label: "启动可靠且处理安全",
          text: "可选迁移失败后面板仍可恢复，异常或超大的 EPUB 压缩包也会受到明确限制。",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "知道了",
      close: "关闭更新提示",
    },
    "zh-TW": {
      eyebrow: "更新提示",
      title: "EPUB 上下文對話與更可靠的面板啟動",
      lead: "AIdea 現在可以在 Zotero EPUB 閱讀器側邊欄中把圖書作為文件上下文，並依 EPUB 2/3 結構在本地完成章節路由和有界檢索。",
      note: "更新後請重新啟動 Zotero。開啟 PDF 或 EPUB 後直接使用同一個 AIdea 閱讀器面板，無需切換額外模式。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "EPUB 側邊欄對話",
          text: "可以直接在 Zotero EPUB 閱讀器中詢問特定章節或整本圖書。",
        },
        {
          label: "本地有界檢索",
          text: "出版目錄結構、追問範圍與全書取樣均在本地處理，不會額外呼叫模型規劃章節。",
        },
        {
          label: "帶上下文的劃詞翻譯",
          text: "EPUB 劃詞直接使用有界圖書上下文，不再執行單獨的冷啟動請求。",
        },
        {
          label: "啟動可靠且處理安全",
          text: "可選遷移失敗後面板仍可恢復，異常或超大的 EPUB 壓縮檔也會受到明確限制。",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "知道了",
      close: "關閉更新提示",
    },
    "ja-JP": {
      eyebrow: "更新のお知らせ",
      title: "EPUB コンテキストチャットと安定したパネル起動",
      lead: "AIdea は Zotero の EPUB リーダーパネルで書籍を文書コンテキストとして利用し、EPUB 2/3 構造からローカルで章のルーティングと範囲を制限した検索を行えるようになりました。",
      note: "更新後に Zotero を再起動してください。PDF または EPUB を開き、同じ AIdea リーダーパネルをそのまま利用できます。追加のモード切り替えは不要です。",
      alsoLabel: "今回の更新内容",
      alsoItems: [
        {
          label: "EPUB サイドパネルチャット",
          text: "Zotero の EPUB リーダーで特定の章や書籍全体について直接質問できます。",
        },
        {
          label: "ローカルで範囲を制限した検索",
          text: "出版者構造、追質問の範囲、書籍全体のサンプリングをローカルで処理し、章の計画に追加のモデル呼び出しを行いません。",
        },
        {
          label: "コンテキスト付き選択翻訳",
          text: "EPUB の選択範囲は、別のコールドスタート要求なしで範囲を制限した書籍コンテキストを直接利用します。",
        },
        {
          label: "安定した起動と安全な処理",
          text: "任意の移行に失敗してもパネルは回復でき、不正または過大な EPUB アーカイブには明確な制限が適用されます。",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "了解",
      close: "更新通知を閉じる",
    },
    "ko-KR": {
      eyebrow: "업데이트 안내",
      title: "EPUB 컨텍스트 채팅과 안정적인 패널 시작",
      lead: "AIdea는 이제 Zotero EPUB 리더 패널에서 책을 문서 컨텍스트로 사용하고 EPUB 2/3 구조를 기반으로 로컬 장 라우팅과 제한된 검색을 수행합니다.",
      note: "업데이트 후 Zotero를 다시 시작하세요. PDF 또는 EPUB를 열고 동일한 AIdea 리더 패널을 사용하면 되며 추가 모드 전환은 필요하지 않습니다.",
      alsoLabel: "이번 업데이트 내용",
      alsoItems: [
        {
          label: "EPUB 사이드 패널 채팅",
          text: "Zotero EPUB 리더에서 특정 장이나 책 전체에 대해 직접 질문할 수 있습니다.",
        },
        {
          label: "로컬 제한 검색",
          text: "출판 구조, 후속 질문 범위 및 책 전체 샘플링을 로컬에서 처리하며 장 계획을 위한 추가 모델 호출이 없습니다.",
        },
        {
          label: "컨텍스트 기반 선택 번역",
          text: "EPUB 선택 영역은 별도의 콜드 스타트 요청 없이 제한된 책 컨텍스트를 바로 사용합니다.",
        },
        {
          label: "안정적인 시작과 안전한 처리",
          text: "선택적 마이그레이션이 실패해도 패널이 복구되며 비정상적이거나 지나치게 큰 EPUB 아카이브에는 명확한 제한이 적용됩니다.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "확인",
      close: "업데이트 안내 닫기",
    },
    "fr-FR": {
      eyebrow: "Mise à jour",
      title: "Chat contextuel EPUB et démarrage fiable du panneau",
      lead: "AIdea peut désormais utiliser un livre EPUB comme contexte dans le panneau du lecteur Zotero, avec routage local des sections et recherche bornée à partir des structures EPUB 2/3.",
      note: "Redémarrez Zotero après la mise à jour. Ouvrez un PDF ou un EPUB et utilisez le même panneau AIdea, sans changer de mode.",
      alsoLabel: "Cette mise à jour comprend",
      alsoItems: [
        {
          label: "Chat EPUB dans le panneau latéral",
          text: "Interrogez directement un chapitre ou l'ensemble du livre dans le lecteur EPUB de Zotero.",
        },
        {
          label: "Recherche locale bornée",
          text: "La structure éditoriale, la portée des questions de suivi et l'échantillonnage du livre sont traités localement sans appel supplémentaire au modèle de planification.",
        },
        {
          label: "Traduction de sélection contextualisée",
          text: "Les sélections EPUB utilisent directement un contexte de livre borné, sans requête distincte de démarrage à froid.",
        },
        {
          label: "Démarrage fiable et traitement sûr",
          text: "Le panneau récupère après l'échec d'une migration facultative et les archives EPUB malformées ou surdimensionnées sont limitées.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Compris",
      close: "Fermer l’avis de mise à jour",
    },
    "de-DE": {
      eyebrow: "Update",
      title: "EPUB-Kontextchat und zuverlässiger Panel-Start",
      lead: "AIdea kann EPUB-Bücher jetzt im Zotero-Reader-Panel als Dokumentkontext verwenden und führt lokales Abschnittsrouting sowie begrenzte Suche anhand der EPUB-2/3-Struktur aus.",
      note: "Starten Sie Zotero nach dem Update neu. Öffnen Sie eine PDF- oder EPUB-Datei und verwenden Sie dasselbe AIdea-Reader-Panel ohne zusätzlichen Moduswechsel.",
      alsoLabel: "Dieses Update enthält",
      alsoItems: [
        {
          label: "EPUB-Chat im Seitenbereich",
          text: "Fragen Sie direkt im Zotero-EPUB-Reader nach Kapiteln oder dem gesamten Buch.",
        },
        {
          label: "Lokale begrenzte Suche",
          text: "Verlagsstruktur, Rückfragebereich und Buchstichproben werden lokal ohne zusätzlichen Planungsmodell-Aufruf verarbeitet.",
        },
        {
          label: "Kontextbezogene Auswahlübersetzung",
          text: "EPUB-Auswahlen verwenden direkt begrenzten Buchkontext ohne separate Kaltstartanfrage.",
        },
        {
          label: "Zuverlässiger Start und sichere Verarbeitung",
          text: "Das Panel erholt sich von optionalen Migrationsfehlern; fehlerhafte oder übergroße EPUB-Archive werden begrenzt.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Verstanden",
      close: "Update-Hinweis schließen",
    },
    "es-ES": {
      eyebrow: "Actualización",
      title: "Chat contextual EPUB e inicio fiable del panel",
      lead: "AIdea ahora puede usar libros EPUB como contexto en el panel del lector de Zotero, con enrutamiento local de secciones y recuperación limitada desde estructuras EPUB 2/3.",
      note: "Reinicia Zotero después de actualizar. Abre un PDF o EPUB y usa el mismo panel de AIdea, sin cambiar de modo.",
      alsoLabel: "Esta actualización incluye",
      alsoItems: [
        {
          label: "Chat EPUB en el panel lateral",
          text: "Pregunta directamente por capítulos o por el libro completo en el lector EPUB de Zotero.",
        },
        {
          label: "Recuperación local limitada",
          text: "La estructura editorial, el alcance de preguntas posteriores y el muestreo del libro se procesan localmente sin otra llamada al modelo de planificación.",
        },
        {
          label: "Traducción de selección con contexto",
          text: "Las selecciones EPUB usan directamente contexto limitado del libro sin una solicitud separada de inicio en frío.",
        },
        {
          label: "Inicio fiable y procesamiento seguro",
          text: "El panel se recupera de fallos de migración opcionales y los archivos EPUB dañados o demasiado grandes quedan limitados.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Entendido",
      close: "Cerrar aviso de actualización",
    },
    "ru-RU": {
      eyebrow: "Обновление",
      title: "Контекстный чат EPUB и надёжный запуск панели",
      lead: "AIdea теперь использует книги EPUB как контекст в панели ридера Zotero и выполняет локальную маршрутизацию разделов и ограниченный поиск по структуре EPUB 2/3.",
      note: "После обновления перезапустите Zotero. Откройте PDF или EPUB и используйте ту же панель AIdea без переключения режима.",
      alsoLabel: "В это обновление входит",
      alsoItems: [
        {
          label: "Чат EPUB в боковой панели",
          text: "Задавайте вопросы о главе или всей книге прямо в EPUB-ридере Zotero.",
        },
        {
          label: "Локальный ограниченный поиск",
          text: "Структура издателя, область последующих вопросов и выборка по книге обрабатываются локально без дополнительного вызова модели планирования.",
        },
        {
          label: "Перевод выделения с контекстом",
          text: "Выделения EPUB сразу используют ограниченный контекст книги без отдельного запроса холодного запуска.",
        },
        {
          label: "Надёжный запуск и безопасная обработка",
          text: "Панель восстанавливается после сбоев необязательной миграции, а повреждённые или слишком большие архивы EPUB ограничиваются.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Понятно",
      close: "Закрыть уведомление об обновлении",
    },
    "pt-BR": {
      eyebrow: "Atualização",
      title: "Chat contextual EPUB e inicialização confiável do painel",
      lead: "O AIdea agora usa livros EPUB como contexto no painel do leitor Zotero, com roteamento local de seções e recuperação limitada pelas estruturas EPUB 2/3.",
      note: "Reinicie o Zotero após atualizar. Abra um PDF ou EPUB e use o mesmo painel AIdea, sem trocar de modo.",
      alsoLabel: "Esta atualização inclui",
      alsoItems: [
        {
          label: "Chat EPUB no painel lateral",
          text: "Pergunte diretamente sobre capítulos ou o livro inteiro no leitor EPUB do Zotero.",
        },
        {
          label: "Recuperação local limitada",
          text: "A estrutura editorial, o escopo das perguntas seguintes e a amostragem do livro são tratados localmente sem chamada adicional ao modelo de planejamento.",
        },
        {
          label: "Tradução de seleção com contexto",
          text: "Seleções EPUB usam diretamente contexto limitado do livro sem solicitação separada de inicialização a frio.",
        },
        {
          label: "Inicialização confiável e processamento seguro",
          text: "O painel se recupera de falhas de migração opcionais e arquivos EPUB malformados ou grandes demais são limitados.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "Entendido",
      close: "Fechar aviso de atualização",
    },
    "ar-SA": {
      eyebrow: "تحديث",
      title: "محادثة EPUB بالسياق وبدء موثوق للوحة",
      lead: "يستطيع AIdea الآن استخدام كتب EPUB كسياق للمستند في لوحة قارئ Zotero، مع توجيه محلي للأقسام واسترجاع محدود من بنية EPUB 2/3.",
      note: "أعد تشغيل Zotero بعد التحديث. افتح PDF أو EPUB واستخدم لوحة AIdea نفسها دون تبديل وضع إضافي.",
      alsoLabel: "يتضمن هذا التحديث",
      alsoItems: [
        {
          label: "محادثة EPUB في اللوحة الجانبية",
          text: "اسأل عن فصل أو عن الكتاب كاملاً مباشرة في قارئ EPUB في Zotero.",
        },
        {
          label: "استرجاع محلي محدود",
          text: "تُعالج بنية الناشر ونطاق الأسئلة اللاحقة وأخذ عينات الكتاب محليًا دون استدعاء إضافي لنموذج التخطيط.",
        },
        {
          label: "ترجمة تحديد مدعومة بالسياق",
          text: "تستخدم تحديدات EPUB سياقًا محدودًا للكتاب مباشرة دون طلب بدء بارد منفصل.",
        },
        {
          label: "بدء موثوق ومعالجة آمنة",
          text: "تتعافى اللوحة بعد فشل عمليات الترحيل الاختيارية وتُفرض حدود على أرشيفات EPUB التالفة أو الضخمة.",
        },
      ],
      exampleLabel: "",
      examplePrompt: "",
      confirm: "فهمت",
      close: "إغلاق إشعار التحديث",
    },
    "hi-IN": {
      eyebrow: "अपडेट",
      title: "EPUB context chat और भरोसेमंद panel startup",
      lead: "AIdea अब Zotero EPUB reader panel में पुस्तकों को document context की तरह उपयोग करता है और EPUB 2/3 structure से local section routing तथा bounded retrieval करता है।",
      note: "अपडेट के बाद Zotero को पुनः शुरू करें। PDF या EPUB खोलें और बिना किसी अतिरिक्त mode switch के वही AIdea reader panel उपयोग करें।",
      alsoLabel: "इस अपडेट में शामिल है",
      alsoItems: [
        {
          label: "EPUB side-panel chat",
          text: "Zotero EPUB reader में किसी chapter या पूरी पुस्तक के बारे में सीधे पूछें।",
        },
        {
          label: "Local bounded retrieval",
          text: "Publisher structure, follow-up scope और whole-book sampling local रूप से संभाले जाते हैं, planning model की अतिरिक्त call के बिना।",
        },
        {
          label: "Context-aware selection translation",
          text: "EPUB selections अलग cold-start request के बिना bounded book context का सीधे उपयोग करते हैं।",
        },
        {
          label: "Reliable और safe",
          text: "Optional migration failure के बाद panel recover कर सकता है और malformed या oversized EPUB archives पर स्पष्ट limits लागू होती हैं।",
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
    PDF_TRANSLATION_UPDATE_COPIES["en-US"] ||
    OAUTH_ENV_UPDATE_COPIES["en-US"] ||
    COPIES["en-US"];
  const localizedCopy =
    CURRENT_UPDATE_NOTICE_COPIES[lang] ||
    CURRENT_UPDATE_NOTICE_COPIES["en-US"] ||
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
