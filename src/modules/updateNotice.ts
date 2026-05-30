import { DialogHelper } from "zotero-plugin-toolkit";
import { config } from "../../package.json";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";

const NOTICE_ID = "v2.3.4-oauth-env-update-modes-v1";
const NOTICE_PREF = `${config.prefsPrefix}.updateNoticeSeen`;

type UpdateNoticeCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  note: string;
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

const OAUTH_ENV_UPDATE_COPIES: Partial<Record<PanelLang, UpdateNoticeCopy>> = {
  "en-US": {
    eyebrow: "Update",
    title: "OAuth environment updates can now run in the background",
    lead: "AIdea now supports background updates for OAuth configuration environments. The update frequency depends on the OAuth provider.",
    note: "Note: the plugin has been updated. Please restart Zotero to make sure the new plugin code is active.",
    exampleLabel: "OAuth configuration environment update modes",
    examplePrompt: "",
    modeItems: [
      {
        label: "Auto update",
        text: "When an OAuth environment update is detected, AIdea shows a prompt. If there is no action within 60 seconds, it updates automatically. Later, close, or minimize pauses the prompt for 24 hours.",
      },
      {
        label: "Notify update",
        text: "When an OAuth environment update is detected, AIdea only shows a prompt and does not update automatically. It updates only after you click Update now. This is the default.",
      },
      {
        label: "Silent",
        text: "AIdea does not check OAuth environment updates and does not show prompts.",
      },
    ],
    confirm: "OK",
    close: "Close update notice",
  },
  "zh-CN": {
    eyebrow: "更新提示",
    title: "支持后台自动更新 OAuth 配置环境",
    lead: "支持后台自动更新 OAuth 配置环境，更新频率取决于 OAuth 提供商。",
    note: "注意：插件已更新，请重启 Zotero 确保插件生效。",
    exampleLabel: "OAuth 配置环境更新模式",
    examplePrompt: "",
    modeItems: [
      {
        label: "自动更新",
        text: "检查到 OAuth 环境更新后弹出提示，60 秒内未操作则自动更新；稍后、关闭或最小化会暂停 24 小时。",
      },
      {
        label: "提示更新",
        text: "检查到 OAuth 环境更新后只弹出提示，不会自动更新；只有点击“立即更新”才会更新。默认设置。",
      },
      {
        label: "静默",
        text: "不检查 OAuth 环境更新，也不显示弹窗。请定期手动更新。",
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
};

let noticeShowingOrSeen = false;

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

function createNoticeBody(copy: UpdateNoticeCopy, dir: string) {
  const detailChildren = copy.modeItems?.length
    ? copy.modeItems.map((item) => {
        const separator = /[A-Za-z]/.test(item.label) ? ": " : "：";
        return {
          tag: "div",
          namespace: "html",
          styles: {
            marginBottom: "9px",
            color: "#1f2328",
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
            color: "#1f2328",
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
    attributes: { dir },
    styles: {
      width: "520px",
      padding: "22px 24px 8px",
      boxSizing: "border-box",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: "#1f2328",
      background: "#fff",
    },
    children: [
      {
        tag: "div",
        namespace: "html",
        properties: { innerText: copy.eyebrow },
        styles: {
          marginBottom: "8px",
          color: "#0d9488",
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
          color: "#111827",
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
          color: "#374151",
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
      {
        tag: "div",
        namespace: "html",
        styles: {
          padding: "13px 14px",
          border: "1px solid rgba(13, 148, 136, 0.22)",
          borderRadius: "8px",
          background: "rgba(13, 148, 136, 0.06)",
        },
        children: [
          {
            tag: "div",
            namespace: "html",
            properties: { innerText: copy.exampleLabel },
            styles: {
              marginBottom: "7px",
              color: "#0f766e",
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

export function maybeShowOpenAIUpdateNotice(win: Window): void {
  if (noticeShowingOrSeen || wasNoticeSeen()) return;

  const lang = getPanelLang();
  const copy =
    OAUTH_ENV_UPDATE_COPIES[lang] ||
    OAUTH_ENV_UPDATE_COPIES["en-US"] ||
    COPIES["en-US"];
  const language = getUiLanguageOption(lang);
  noticeShowingOrSeen = true;

  try {
    const dialog = new DialogHelper(1, 1);
    dialog
      .addCell(0, 0, createNoticeBody(copy, language.dir), false)
      .addButton(copy.confirm, "confirm-update-notice", {
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
        width: 560,
        height: 420,
        centerscreen: true,
        resizable: false,
        fitContent: true,
        alwaysRaised: true,
      });
    (globalThis as any).addon.data.dialog = dialog;
  } catch (err) {
    ztoolkit.log("AIdea: DialogHelper update notice failed", err);
    markNoticeSeen();
  }
}
