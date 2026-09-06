import { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";
import { applyCurrentThemeToRoot } from "./contextPanel/theme";

export const NOTICE_ID = "v3.5.2-natural-responses-math-v1";
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
      title: "AIdea v3.5.2: More Natural Answers and Improved Math Display",
      lead: "Improved default responses and math rendering, together with recent selection-translation enhancements.",
      alsoLabel: "This update includes",
      alsoItems: [
        {
          label: "Task-focused answers",
          text: "Direct answers to simple questions, with necessary reasoning and assumptions retained for complex analysis.",
        },
        {
          label: "Custom response style",
          text: "Adjust responses under Settings → Advanced → Custom System Prompt. Leave it blank for the defaults. Existing custom prompts are preserved.",
        },
        {
          label: "Independent task prompts",
          text: "Selection translation, summaries, and other internal tasks use dedicated prompts, unaffected by custom chat instructions.",
        },
        {
          label: "Numeric math fix",
          text: "Fixed inline numbers and decimals displaying as raw formula text, with improved handling of currency and code snippets.",
        },
        {
          label: "Long-document fallback",
          text: "Retained progressively smaller context retries and selection-only translation when the context remains too long.",
        },
        {
          label: "Annotations and remembered choices",
          text: "Retained translation-to-highlight support and checkbox persistence across Zotero restarts, without overwriting existing comments.",
        },
      ],
      note: "Restart Zotero after updating. “Write translation to annotation” is off by default. When enabled, wait for the translation before choosing a highlight color.",
      confirm: "Got it",
      close: "Close update notice",
      exampleLabel: "",
      examplePrompt: "",
    },
    "zh-CN": {
      eyebrow: "更新提示",
      title: "AIdea v3.5.2：自然回答与公式显示改进",
      lead: "优化默认回答方式和数学公式显示，并保留近期的划词翻译改进。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "回答更贴合问题",
          text: "简单问题直接回答，复杂分析保留必要的推导与条件，减少无关扩展。",
        },
        {
          label: "自定义回答风格",
          text: "在“设置 → 高级 → 自定义系统提示词”中调整回答方式。留空使用默认规则，已有自定义内容不会被覆盖。",
        },
        {
          label: "内部任务独立",
          text: "划词翻译、摘要等内部任务使用专用提示词，不受自定义对话风格影响。",
        },
        {
          label: "数字公式显示修复",
          text: "修复纯数字、小数等行内公式原样显示的问题，同时改进金额与代码片段的识别。",
        },
        {
          label: "长文档自动兜底",
          text: "保留上下文过长时逐级缩减重试、最终仅翻译选中文本的机制。",
        },
        {
          label: "标注与选项记忆",
          text: "保留译文写入高亮标注及勾选状态记忆，重启 Zotero 后仍保持选择，已有批注不会被覆盖。",
        },
      ],
      note: "更新后请重启 Zotero。“将译文写入标注”默认关闭；开启后，请等待译文生成，再选择高亮颜色。",
      confirm: "知道了",
      close: "关闭更新提示",
      exampleLabel: "",
      examplePrompt: "",
    },
    "zh-TW": {
      eyebrow: "更新提示",
      title: "AIdea v3.5.2：自然回答與公式顯示改進",
      lead: "最佳化預設回答方式與數學公式顯示，並保留近期的選取文字翻譯改進。",
      alsoLabel: "本次更新包括",
      alsoItems: [
        {
          label: "回答更貼合問題",
          text: "簡單問題直接回答，複雜分析保留必要的推導與條件，減少無關延伸。",
        },
        {
          label: "自訂回答風格",
          text: "在「設定 → 進階 → 自訂系統提示詞」中調整回答方式。留空使用預設規則，既有自訂內容不會被覆蓋。",
        },
        {
          label: "內部任務獨立",
          text: "選取文字翻譯、摘要等內部任務使用專用提示詞，不受自訂對話風格影響。",
        },
        {
          label: "數字公式顯示修正",
          text: "修正純數字、小數等行內公式原樣顯示的問題，同時改進金額與程式碼片段的辨識。",
        },
        {
          label: "長文件自動備援",
          text: "保留內容過長時逐級縮減上下文並重試、最終僅翻譯選取文字的機制。",
        },
        {
          label: "註記與選項記憶",
          text: "保留將譯文寫入螢光標記註記及勾選狀態記憶，重新啟動 Zotero 後仍保持選擇，既有註解不會被覆蓋。",
        },
      ],
      note: "更新後請重新啟動 Zotero。「將譯文寫入註記」預設關閉；開啟後，請等待譯文產生，再選擇螢光標記顏色。",
      confirm: "知道了",
      close: "關閉更新提示",
      exampleLabel: "",
      examplePrompt: "",
    },
    "ja-JP": {
      eyebrow: "更新のお知らせ",
      title: "AIdea v3.5.2：より自然な回答と数式表示の改善",
      lead: "既定の回答と数式表示を改善し、最近の選択範囲の翻訳機能の改善も引き続き利用できます。",
      alsoLabel: "今回の更新内容",
      alsoItems: [
        {
          label: "質問に合った回答",
          text: "簡単な質問には直接回答し、複雑な分析では必要な推論と前提条件を維持します。",
        },
        {
          label: "回答スタイルのカスタマイズ",
          text: "「設定 → 詳細 → カスタムシステムプロンプト」で調整できます。空欄なら既定のルールが使われ、既存のカスタム内容は上書きされません。",
        },
        {
          label: "内部タスク専用のプロンプト",
          text: "選択範囲の翻訳や要約などは専用のプロンプトを使用し、チャットのカスタム指示の影響を受けません。",
        },
        {
          label: "数字の数式表示を修正",
          text: "整数や小数のインライン数式が未処理のまま表示される問題を修正し、金額とコード片の処理も改善しました。",
        },
        {
          label: "長い文書の自動フォールバック",
          text: "コンテキストを段階的に縮小して再試行し、それでも長すぎる場合は選択したテキストのみを翻訳する仕組みを維持しました。",
        },
        {
          label: "注釈と選択状態の記憶",
          text: "訳文のハイライト注釈への書き込みとチェック状態の保存を維持しました。Zotero の再起動後も選択を記憶し、既存のコメントは上書きしません。",
        },
      ],
      note: "更新後は Zotero を再起動してください。「訳文を注釈に書き込む」は既定でオフです。有効にした場合は、翻訳が完了してからハイライトの色を選んでください。",
      confirm: "了解",
      close: "更新のお知らせを閉じる",
      exampleLabel: "",
      examplePrompt: "",
    },
    "ko-KR": {
      eyebrow: "업데이트 안내",
      title: "AIdea v3.5.2: 더 자연스러운 답변과 수식 표시 개선",
      lead: "기본 답변 방식과 수식 표시를 개선했으며, 최근의 선택 영역 번역 개선 사항도 유지합니다.",
      alsoLabel: "이번 업데이트 내용",
      alsoItems: [
        {
          label: "질문에 맞는 답변",
          text: "간단한 질문에는 바로 답하고, 복잡한 분석에는 필요한 추론과 전제 조건을 유지합니다.",
        },
        {
          label: "답변 스타일 설정",
          text: "설정 → 고급 → 사용자 지정 시스템 프롬프트에서 답변 방식을 조정할 수 있습니다. 비워 두면 기본 규칙을 사용하며, 기존 사용자 지정 내용은 덮어쓰지 않습니다.",
        },
        {
          label: "독립적인 내부 작업 프롬프트",
          text: "선택 영역 번역, 요약 등 내부 작업에는 전용 프롬프트를 사용하므로 사용자 지정 대화 지침의 영향을 받지 않습니다.",
        },
        {
          label: "숫자 수식 표시 수정",
          text: "정수와 소수 등의 인라인 수식이 원문 그대로 표시되는 문제를 수정하고, 금액과 코드 조각의 처리를 개선했습니다.",
        },
        {
          label: "긴 문서 자동 대체 처리",
          text: "문맥을 단계적으로 줄여 재시도하고, 그래도 너무 길면 선택한 텍스트만 번역하는 방식을 유지합니다.",
        },
        {
          label: "주석과 선택 상태 기억",
          text: "번역문을 하이라이트 주석에 쓰는 기능과 체크 상태 저장을 유지합니다. Zotero를 다시 시작해도 선택 상태가 유지되며, 기존 댓글은 덮어쓰지 않습니다.",
        },
      ],
      note: "업데이트 후 Zotero를 다시 시작하세요. ‘번역문을 주석에 쓰기’는 기본적으로 꺼져 있습니다. 켠 경우 번역이 완료된 후 하이라이트 색상을 선택하세요.",
      confirm: "확인",
      close: "업데이트 안내 닫기",
      exampleLabel: "",
      examplePrompt: "",
    },
    "fr-FR": {
      eyebrow: "Mise à jour",
      title:
        "AIdea v3.5.2 : réponses plus naturelles et meilleur affichage des formules",
      lead: "Amélioration des réponses par défaut et du rendu des formules, avec maintien des améliorations récentes de la traduction de sélection.",
      alsoLabel: "Cette mise à jour comprend",
      alsoItems: [
        {
          label: "Des réponses adaptées",
          text: "Des réponses directes aux questions simples, tout en conservant le raisonnement et les hypothèses nécessaires aux analyses complexes.",
        },
        {
          label: "Style de réponse personnalisé",
          text: "Réglez les réponses dans Paramètres → Avancé → Invite système personnalisée. Laissez ce champ vide pour les règles par défaut. Les invites existantes sont conservées.",
        },
        {
          label: "Invites dédiées aux tâches internes",
          text: "La traduction de sélection, les résumés et les autres tâches internes utilisent leurs propres invites, sans être affectés par les consignes de discussion personnalisées.",
        },
        {
          label: "Correction des formules numériques",
          text: "Correction des entiers et décimales en ligne affichés comme du texte brut, avec une meilleure gestion des montants et des extraits de code.",
        },
        {
          label: "Repli pour les longs documents",
          text: "Le contexte est toujours réduit progressivement lors des nouvelles tentatives ; s’il reste trop long, seul le texte sélectionné est traduit.",
        },
        {
          label: "Annotations et choix mémorisés",
          text: "L’ajout de la traduction aux annotations surlignées et la mémorisation de la case cochée après redémarrage de Zotero sont conservés, sans écraser les commentaires existants.",
        },
      ],
      note: "Redémarrez Zotero après la mise à jour. « Écrire la traduction dans l’annotation » est désactivé par défaut. Une fois activé, attendez la traduction avant de choisir une couleur de surlignage.",
      confirm: "Compris",
      close: "Fermer l’avis de mise à jour",
      exampleLabel: "",
      examplePrompt: "",
    },
    "de-DE": {
      eyebrow: "Update",
      title:
        "AIdea v3.5.2: Natürlichere Antworten und verbesserte Formeldarstellung",
      lead: "Verbesserte Standardantworten und Formeldarstellung sowie die bisherigen Verbesserungen bei der Übersetzung markierter Texte.",
      alsoLabel: "Dieses Update enthält",
      alsoItems: [
        {
          label: "Passende Antworten",
          text: "Einfache Fragen werden direkt beantwortet; bei komplexen Analysen bleiben die nötigen Herleitungen und Annahmen erhalten.",
        },
        {
          label: "Eigener Antwortstil",
          text: "Anpassbar unter Einstellungen → Erweitert → Benutzerdefinierter System-Prompt. Ein leeres Feld verwendet die Standardregeln. Vorhandene eigene Prompts bleiben erhalten.",
        },
        {
          label: "Unabhängige Aufgaben-Prompts",
          text: "Übersetzungen markierter Texte, Zusammenfassungen und andere interne Aufgaben verwenden eigene Prompts, unabhängig von benutzerdefinierten Chat-Anweisungen.",
        },
        {
          label: "Zahlenformeln korrigiert",
          text: "Ganze Zahlen und Dezimalzahlen in Inline-Formeln werden nicht mehr als unbearbeiteter Formeltext angezeigt. Auch die Erkennung von Geldbeträgen und Code wurde verbessert.",
        },
        {
          label: "Fallback für lange Dokumente",
          text: "Der Kontext wird bei erneuten Versuchen weiterhin schrittweise verkleinert. Bleibt er zu lang, wird nur der markierte Text übersetzt.",
        },
        {
          label: "Annotationen und gespeicherte Auswahl",
          text: "Die Übersetzung in Hervorhebungsannotationen und der Zustand des Kontrollkästchens bleiben auch nach einem Zotero-Neustart erhalten. Vorhandene Kommentare werden nicht überschrieben.",
        },
      ],
      note: "Starten Sie Zotero nach dem Update neu. „Übersetzung in Annotation schreiben“ ist standardmäßig deaktiviert. Nach dem Aktivieren warten Sie auf die Übersetzung, bevor Sie eine Hervorhebungsfarbe wählen.",
      confirm: "Verstanden",
      close: "Update-Hinweis schließen",
      exampleLabel: "",
      examplePrompt: "",
    },
    "es-ES": {
      eyebrow: "Actualización",
      title:
        "AIdea v3.5.2: respuestas más naturales y mejor visualización de fórmulas",
      lead: "Mejoras en las respuestas predeterminadas y las fórmulas, junto con las mejoras recientes de la traducción de selecciones.",
      alsoLabel: "Esta actualización incluye",
      alsoItems: [
        {
          label: "Respuestas ajustadas a la pregunta",
          text: "Respuestas directas a preguntas sencillas, conservando el razonamiento y los supuestos necesarios en análisis complejos.",
        },
        {
          label: "Estilo de respuesta personalizado",
          text: "Ajuste las respuestas en Ajustes → Avanzado → Prompt del sistema personalizado. Déjelo vacío para usar las reglas predeterminadas. Los prompts existentes se conservan.",
        },
        {
          label: "Prompts independientes para tareas internas",
          text: "La traducción de selecciones, los resúmenes y otras tareas internas usan prompts específicos, sin verse afectados por las instrucciones personalizadas del chat.",
        },
        {
          label: "Corrección de fórmulas numéricas",
          text: "Corregida la visualización de enteros y decimales en línea como texto de fórmula sin procesar, con mejoras para importes y fragmentos de código.",
        },
        {
          label: "Alternativa para documentos largos",
          text: "Se mantienen los reintentos con un contexto cada vez menor y la traducción solo del texto seleccionado si el contexto sigue siendo demasiado largo.",
        },
        {
          label: "Anotaciones y opciones recordadas",
          text: "Se mantienen la escritura de traducciones en anotaciones resaltadas y el estado de la casilla tras reiniciar Zotero, sin sobrescribir comentarios existentes.",
        },
      ],
      note: "Reinicie Zotero después de actualizar. «Escribir la traducción en la anotación» está desactivado por defecto. Si lo activa, espere a que termine la traducción antes de elegir un color de resaltado.",
      confirm: "Entendido",
      close: "Cerrar aviso de actualización",
      exampleLabel: "",
      examplePrompt: "",
    },
    "ru-RU": {
      eyebrow: "Обновление",
      title:
        "AIdea v3.5.2: более естественные ответы и улучшенное отображение формул",
      lead: "Улучшены ответы по умолчанию и отображение формул; сохранены недавние улучшения перевода выделенного текста.",
      alsoLabel: "В этом обновлении",
      alsoItems: [
        {
          label: "Ответы по существу",
          text: "Прямые ответы на простые вопросы с сохранением необходимых рассуждений и допущений при сложном анализе.",
        },
        {
          label: "Свой стиль ответов",
          text: "Настройте ответы в разделе «Настройки → Дополнительно → Пользовательский системный промпт». Пустое поле включает правила по умолчанию. Существующие промпты сохраняются.",
        },
        {
          label: "Отдельные промпты внутренних задач",
          text: "Перевод выделенного текста, краткие обзоры и другие внутренние задачи используют отдельные промпты, не зависящие от пользовательских инструкций чата.",
        },
        {
          label: "Исправление числовых формул",
          text: "Исправлено отображение целых и дробных чисел во встроенных формулах как необработанного текста. Улучшена обработка денежных сумм и фрагментов кода.",
        },
        {
          label: "Резервный режим для длинных документов",
          text: "Сохранены повторные попытки с постепенным сокращением контекста. Если он всё ещё слишком длинный, переводится только выделенный текст.",
        },
        {
          label: "Аннотации и сохранение выбора",
          text: "Сохранены запись перевода в аннотацию выделения и состояние флажка после перезапуска Zotero. Существующие комментарии не перезаписываются.",
        },
      ],
      note: "После обновления перезапустите Zotero. Параметр «Записывать перевод в аннотацию» по умолчанию выключен. Если он включён, дождитесь перевода, затем выберите цвет выделения.",
      confirm: "Понятно",
      close: "Закрыть уведомление об обновлении",
      exampleLabel: "",
      examplePrompt: "",
    },
    "pt-BR": {
      eyebrow: "Atualização",
      title:
        "AIdea v3.5.2: respostas mais naturais e melhor exibição de fórmulas",
      lead: "Melhorias nas respostas padrão e na renderização de fórmulas, mantendo os aprimoramentos recentes da tradução de seleções.",
      alsoLabel: "Esta atualização inclui",
      alsoItems: [
        {
          label: "Respostas adequadas à pergunta",
          text: "Respostas diretas a perguntas simples, preservando o raciocínio e as premissas necessários para análises complexas.",
        },
        {
          label: "Estilo de resposta personalizado",
          text: "Ajuste as respostas em Configurações → Avançado → Prompt de sistema personalizado. Deixe vazio para usar as regras padrão. Os prompts existentes são preservados.",
        },
        {
          label: "Prompts independentes para tarefas internas",
          text: "Tradução de seleções, resumos e outras tarefas internas usam prompts próprios, sem influência das instruções personalizadas do chat.",
        },
        {
          label: "Correção de fórmulas numéricas",
          text: "Corrigida a exibição de inteiros e decimais em fórmulas em linha como texto bruto, com melhorias no tratamento de valores monetários e trechos de código.",
        },
        {
          label: "Alternativa para documentos longos",
          text: "Mantidas as novas tentativas com contexto progressivamente menor e a tradução apenas do texto selecionado quando o contexto ainda for muito longo.",
        },
        {
          label: "Anotações e escolhas lembradas",
          text: "Mantidas a inclusão de traduções em anotações de destaque e a persistência da caixa de seleção após reiniciar o Zotero, sem sobrescrever comentários existentes.",
        },
      ],
      note: "Reinicie o Zotero após atualizar. “Escrever tradução na anotação” fica desativado por padrão. Quando ativado, aguarde a tradução antes de escolher a cor do destaque.",
      confirm: "Entendi",
      close: "Fechar aviso de atualização",
      exampleLabel: "",
      examplePrompt: "",
    },
    "ar-SA": {
      eyebrow: "تحديث",
      title: "AIdea v3.5.2: إجابات أكثر طبيعية وعرض محسّن للمعادلات",
      lead: "تحسين الإجابات الافتراضية وعرض المعادلات، مع الإبقاء على التحسينات الأخيرة لترجمة النص المحدد.",
      alsoLabel: "يتضمن هذا التحديث",
      alsoItems: [
        {
          label: "إجابات تناسب السؤال",
          text: "إجابات مباشرة للأسئلة البسيطة، مع الاحتفاظ بالاستدلال والافتراضات اللازمة للتحليل المعقد.",
        },
        {
          label: "تخصيص أسلوب الإجابة",
          text: "يمكن ضبط الإجابات من الإعدادات ← متقدم ← موجّه النظام المخصص. اترك الحقل فارغًا لاستخدام القواعد الافتراضية. لن تُستبدل الموجّهات المخصصة الموجودة.",
        },
        {
          label: "موجّهات مستقلة للمهام الداخلية",
          text: "تستخدم ترجمة النص المحدد والتلخيص والمهام الداخلية الأخرى موجّهات مخصصة لها، ولا تتأثر بتعليمات المحادثة المخصصة.",
        },
        {
          label: "إصلاح عرض المعادلات الرقمية",
          text: "إصلاح ظهور الأعداد الصحيحة والعشرية في المعادلات المضمنة كنص خام، مع تحسين التعامل مع المبالغ المالية ومقاطع الشيفرة.",
        },
        {
          label: "حل بديل للمستندات الطويلة",
          text: "الإبقاء على إعادة المحاولة مع تقليص السياق تدريجيًا، ثم ترجمة النص المحدد وحده إذا ظل السياق طويلًا جدًا.",
        },
        {
          label: "التعليقات وتذكّر الاختيارات",
          text: "الإبقاء على كتابة الترجمة في تعليقات التظليل وحفظ حالة مربع الاختيار بعد إعادة تشغيل Zotero، دون استبدال التعليقات الموجودة.",
        },
      ],
      note: "أعد تشغيل Zotero بعد التحديث. خيار «كتابة الترجمة في التعليق» معطّل افتراضيًا. عند تفعيله، انتظر اكتمال الترجمة قبل اختيار لون التظليل.",
      confirm: "فهمت",
      close: "إغلاق إشعار التحديث",
      exampleLabel: "",
      examplePrompt: "",
    },
    "hi-IN": {
      eyebrow: "अपडेट",
      title: "AIdea v3.5.2: अधिक स्वाभाविक उत्तर और बेहतर सूत्र प्रदर्शन",
      lead: "डिफ़ॉल्ट उत्तरों और गणितीय सूत्रों के प्रदर्शन में सुधार, साथ ही चुने हुए पाठ के अनुवाद में हाल के सुधार बरकरार हैं।",
      alsoLabel: "इस अपडेट में शामिल है",
      alsoItems: [
        {
          label: "प्रश्न के अनुरूप उत्तर",
          text: "सरल प्रश्नों के सीधे उत्तर, जबकि जटिल विश्लेषण में आवश्यक तर्क और मान्यताएँ बरकरार रहती हैं।",
        },
        {
          label: "उत्तर देने की शैली बदलें",
          text: "सेटिंग्स → उन्नत → कस्टम सिस्टम प्रॉम्प्ट में शैली बदलें। डिफ़ॉल्ट नियमों के लिए इसे खाली छोड़ें। मौजूदा कस्टम प्रॉम्प्ट बदले नहीं जाएँगे।",
        },
        {
          label: "आंतरिक कार्यों के स्वतंत्र प्रॉम्प्ट",
          text: "चुने हुए पाठ के अनुवाद, सारांश और अन्य आंतरिक कार्यों के अपने प्रॉम्प्ट हैं, जिन पर कस्टम चैट निर्देशों का प्रभाव नहीं पड़ता।",
        },
        {
          label: "संख्यात्मक सूत्रों का सुधार",
          text: "पूर्णांक और दशमलव वाले इनलाइन सूत्रों के कच्चे पाठ की तरह दिखने की समस्या ठीक की गई है। धनराशि और कोड अंशों की पहचान भी बेहतर हुई है।",
        },
        {
          label: "लंबे दस्तावेज़ों के लिए वैकल्पिक तरीका",
          text: "संदर्भ को क्रमशः घटाकर दोबारा कोशिश करने का तरीका बरकरार है। संदर्भ फिर भी बहुत लंबा हो तो केवल चुना हुआ पाठ अनुवादित होता है।",
        },
        {
          label: "एनोटेशन और विकल्पों की याद",
          text: "अनुवाद को हाइलाइट एनोटेशन में लिखने और चेकबॉक्स की स्थिति सहेजने की सुविधा बरकरार है। Zotero दोबारा शुरू होने पर भी चयन बना रहता है और मौजूदा टिप्पणियाँ बदली नहीं जातीं।",
        },
      ],
      note: "अपडेट के बाद Zotero दोबारा शुरू करें। “अनुवाद को एनोटेशन में लिखें” डिफ़ॉल्ट रूप से बंद है। चालू करने पर हाइलाइट रंग चुनने से पहले अनुवाद पूरा होने दें।",
      confirm: "समझ गया",
      close: "अपडेट सूचना बंद करें",
      exampleLabel: "",
      examplePrompt: "",
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
