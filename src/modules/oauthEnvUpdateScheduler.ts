import { config } from "../../package.json";
import {
  autoConfigureEnvironment,
  checkOAuthCliEnvironmentUpdates,
  getAuthorizedOAuthCliProviders,
  getProviderLabel,
  type OAuthProviderId,
} from "../utils/oauthCli";
import {
  getDueOAuthEnvUpdateProviders,
  recordOAuthEnvUpdateChecked,
  snoozeOAuthEnvUpdateProviders,
} from "../utils/oauthEnvUpdateState";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_DELAY_MS = 90 * 1000;
const COUNTDOWN_SECONDS = 60;
const PROMPT_SNOOZE_MS = 24 * 60 * 60 * 1000;
const TOAST_ID = `${config.addonRef}-oauth-env-update-toast`;
const LOG_EVENT = `${config.addonRef}-oauth-env-update-log`;
const MODE_PREF = `${config.prefsPrefix}.oauthEnvUpdateMode`;

export type OAuthEnvUpdateMode = "auto" | "notify" | "silent";

type SchedulerWindowState = {
  cleanup: () => void;
};

type PromptState = {
  providers: OAuthProviderId[];
  root: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  status: HTMLElement;
  actions: HTMLElement;
  nowButton: HTMLButtonElement;
  laterButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  minimizeButton: HTMLButtonElement;
  countdownTimer: ReturnType<typeof setInterval> | null;
  countdownRemaining: number;
  mode: "auto" | "notify" | "updating";
  minimized: boolean;
  dismissSnoozes: boolean;
};

type OAuthEnvUpdateCopy = {
  title: string;
  active: string;
  idle: string;
  updating: string;
  done: string;
  failed: string;
  providers: string;
  now: string;
  later: string;
  countdown: string;
  snoozed: string;
  ok: string;
  close?: string;
  minimize?: string;
  restore?: string;
};

const OAUTH_ENV_UPDATE_COPIES: Record<PanelLang, OAuthEnvUpdateCopy> = {
  "en-US": {
    title: "OAuth environment update needed",
    active:
      "AIdea detected that the OAuth authorization environment needs an update or repair. Zotero is currently active, so AIdea will not update automatically.",
    idle: "AIdea detected that the OAuth authorization environment needs an update or repair. Zotero appears idle, so AIdea will update automatically after the countdown.",
    updating: "Updating OAuth authorization environment...",
    done: "OAuth authorization environment updated.",
    failed:
      "OAuth authorization environment update did not finish. Check the Settings log later.",
    providers: "Authorization",
    now: "Update now",
    later: "Later",
    countdown: "Auto update in {n}s",
    snoozed: "Snoozed",
    ok: "OK",
    close: "Close",
    minimize: "Minimize",
    restore: "Restore",
  },
  "zh-CN": {
    title: "OAuth 环境需要更新",
    active:
      "已检测到 OAuth 授权环境需要更新或修复。当前检测到你正在使用 Zotero，AIdea 不会自动更新。",
    idle: "已检测到 OAuth 授权环境需要更新或修复。当前处于空闲状态，倒计时结束后将自动更新。",
    updating: "正在更新 OAuth 授权环境...",
    done: "OAuth 授权环境已更新。",
    failed: "OAuth 授权环境更新未完成，请稍后在 Settings 中查看日志。",
    providers: "授权方式",
    now: "立即更新",
    later: "稍后更新",
    countdown: "将在 {n} 秒后自动更新",
    snoozed: "已稍后提醒",
    ok: "确定",
  },
  "zh-TW": {
    title: "OAuth 環境需要更新",
    active:
      "已偵測到 OAuth 授權環境需要更新或修復。目前偵測到你正在使用 Zotero，AIdea 不會自動更新。",
    idle: "已偵測到 OAuth 授權環境需要更新或修復。目前處於閒置狀態，倒數結束後將自動更新。",
    updating: "正在更新 OAuth 授權環境...",
    done: "OAuth 授權環境已更新。",
    failed: "OAuth 授權環境更新未完成，請稍後在 Settings 中查看日誌。",
    providers: "授權方式",
    now: "立即更新",
    later: "稍後更新",
    countdown: "將在 {n} 秒後自動更新",
    snoozed: "已稍後提醒",
    ok: "確定",
  },
  "ja-JP": {
    title: "OAuth 環境の更新が必要です",
    active:
      "OAuth 認証環境に更新または修復が必要です。現在 Zotero を使用中のため、AIdea は自動更新しません。",
    idle: "OAuth 認証環境に更新または修復が必要です。現在アイドル状態のため、カウントダウン後に自動更新します。",
    updating: "OAuth 認証環境を更新しています...",
    done: "OAuth 認証環境を更新しました。",
    failed:
      "OAuth 認証環境の更新が完了しませんでした。後で Settings のログを確認してください。",
    providers: "認証",
    now: "今すぐ更新",
    later: "後で",
    countdown: "{n} 秒後に自動更新",
    snoozed: "後で通知します",
    ok: "OK",
  },
  "ko-KR": {
    title: "OAuth 환경 업데이트 필요",
    active:
      "OAuth 인증 환경에 업데이트 또는 복구가 필요합니다. 현재 Zotero 사용 중이므로 AIdea가 자동 업데이트하지 않습니다.",
    idle: "OAuth 인증 환경에 업데이트 또는 복구가 필요합니다. 현재 유휴 상태이므로 카운트다운 후 자동으로 업데이트합니다.",
    updating: "OAuth 인증 환경을 업데이트하는 중...",
    done: "OAuth 인증 환경이 업데이트되었습니다.",
    failed:
      "OAuth 인증 환경 업데이트가 완료되지 않았습니다. 나중에 Settings 로그를 확인하세요.",
    providers: "인증",
    now: "지금 업데이트",
    later: "나중에",
    countdown: "{n}초 후 자동 업데이트",
    snoozed: "나중에 알림",
    ok: "확인",
  },
  "fr-FR": {
    title: "Mise a jour de l'environnement OAuth requise",
    active:
      "AIdea a detecte que l'environnement d'autorisation OAuth doit etre mis a jour ou repare. Zotero est en cours d'utilisation ; AIdea ne lancera pas la mise a jour automatiquement.",
    idle: "AIdea a detecte que l'environnement d'autorisation OAuth doit etre mis a jour ou repare. Zotero semble inactif ; AIdea lancera la mise a jour apres le compte a rebours.",
    updating: "Mise a jour de l'environnement d'autorisation OAuth...",
    done: "L'environnement d'autorisation OAuth a ete mis a jour.",
    failed:
      "La mise a jour de l'environnement OAuth n'a pas abouti. Verifiez plus tard le journal dans Settings.",
    providers: "Autorisation",
    now: "Mettre a jour",
    later: "Plus tard",
    countdown: "Mise a jour auto dans {n} s",
    snoozed: "Reporte",
    ok: "OK",
  },
  "de-DE": {
    title: "OAuth-Umgebung muss aktualisiert werden",
    active:
      "AIdea hat erkannt, dass die OAuth-Autorisierungsumgebung aktualisiert oder repariert werden muss. Zotero wird gerade verwendet, daher startet AIdea kein automatisches Update.",
    idle: "AIdea hat erkannt, dass die OAuth-Autorisierungsumgebung aktualisiert oder repariert werden muss. Zotero scheint inaktiv zu sein, daher startet AIdea nach dem Countdown automatisch.",
    updating: "OAuth-Autorisierungsumgebung wird aktualisiert...",
    done: "OAuth-Autorisierungsumgebung wurde aktualisiert.",
    failed:
      "Die Aktualisierung der OAuth-Umgebung wurde nicht abgeschlossen. Pruefen Sie spaeter das Protokoll in Settings.",
    providers: "Autorisierung",
    now: "Jetzt aktualisieren",
    later: "Spaeter",
    countdown: "Automatisches Update in {n} s",
    snoozed: "Verschoben",
    ok: "OK",
  },
  "es-ES": {
    title: "Se requiere actualizar el entorno OAuth",
    active:
      "AIdea detecto que el entorno de autorizacion OAuth necesita una actualizacion o reparacion. Zotero esta en uso, por lo que AIdea no actualizara automaticamente.",
    idle: "AIdea detecto que el entorno de autorizacion OAuth necesita una actualizacion o reparacion. Zotero parece inactivo, por lo que AIdea actualizara automaticamente despues de la cuenta atras.",
    updating: "Actualizando el entorno de autorizacion OAuth...",
    done: "El entorno de autorizacion OAuth se actualizo.",
    failed:
      "La actualizacion del entorno OAuth no se completo. Revise el registro en Settings mas tarde.",
    providers: "Autorizacion",
    now: "Actualizar ahora",
    later: "Mas tarde",
    countdown: "Actualizacion automatica en {n}s",
    snoozed: "Pospuesto",
    ok: "Aceptar",
  },
  "ru-RU": {
    title: "Требуется обновление среды OAuth",
    active:
      "AIdea обнаружила, что среду авторизации OAuth нужно обновить или восстановить. Сейчас Zotero используется, поэтому AIdea не будет обновлять автоматически.",
    idle: "AIdea обнаружила, что среду авторизации OAuth нужно обновить или восстановить. Zotero бездействует, поэтому AIdea запустит обновление после обратного отсчета.",
    updating: "Обновление среды авторизации OAuth...",
    done: "Среда авторизации OAuth обновлена.",
    failed:
      "Не удалось завершить обновление среды OAuth. Позже проверьте журнал в Settings.",
    providers: "Авторизация",
    now: "Обновить сейчас",
    later: "Позже",
    countdown: "Автообновление через {n} с",
    snoozed: "Отложено",
    ok: "OK",
  },
  "pt-BR": {
    title: "Atualizacao do ambiente OAuth necessaria",
    active:
      "AIdea detectou que o ambiente de autorizacao OAuth precisa de atualizacao ou reparo. O Zotero esta em uso, entao AIdea nao atualizara automaticamente.",
    idle: "AIdea detectou que o ambiente de autorizacao OAuth precisa de atualizacao ou reparo. O Zotero parece ocioso, entao AIdea atualizara automaticamente apos a contagem regressiva.",
    updating: "Atualizando o ambiente de autorizacao OAuth...",
    done: "Ambiente de autorizacao OAuth atualizado.",
    failed:
      "A atualizacao do ambiente OAuth nao foi concluida. Verifique o log em Settings mais tarde.",
    providers: "Autorizacao",
    now: "Atualizar agora",
    later: "Mais tarde",
    countdown: "Atualizacao automatica em {n}s",
    snoozed: "Adiado",
    ok: "OK",
  },
  "ar-SA": {
    title: "يلزم تحديث بيئة OAuth",
    active:
      "اكتشف AIdea أن بيئة تفويض OAuth تحتاج إلى تحديث أو إصلاح. Zotero قيد الاستخدام حاليا، لذلك لن يتم التحديث تلقائيا.",
    idle: "اكتشف AIdea أن بيئة تفويض OAuth تحتاج إلى تحديث أو إصلاح. يبدو أن Zotero في وضع الخمول، لذلك سيبدأ التحديث تلقائيا بعد العد التنازلي.",
    updating: "جار تحديث بيئة تفويض OAuth...",
    done: "تم تحديث بيئة تفويض OAuth.",
    failed: "لم يكتمل تحديث بيئة OAuth. تحقق من سجل Settings لاحقا.",
    providers: "التفويض",
    now: "التحديث الآن",
    later: "لاحقا",
    countdown: "تحديث تلقائي خلال {n} ث",
    snoozed: "تم التأجيل",
    ok: "موافق",
  },
  "hi-IN": {
    title: "OAuth परिवेश अपडेट आवश्यक",
    active:
      "AIdea ने पाया कि OAuth authorization environment को update या repair की जरूरत है. Zotero अभी उपयोग में है, इसलिए AIdea अपने आप update नहीं करेगा.",
    idle: "AIdea ने पाया कि OAuth authorization environment को update या repair की जरूरत है. Zotero idle लगता है, इसलिए countdown के बाद update अपने आप शुरू होगा.",
    updating: "OAuth authorization environment update हो रहा है...",
    done: "OAuth authorization environment update हो गया.",
    failed:
      "OAuth environment update पूरा नहीं हुआ. बाद में Settings log देखें.",
    providers: "Authorization",
    now: "अभी update करें",
    later: "बाद में",
    countdown: "{n}s में auto update",
    snoozed: "बाद में याद दिलाएगा",
    ok: "OK",
  },
};

const OAUTH_ENV_UPDATE_MODE_BODY_OVERRIDES: Partial<
  Record<PanelLang, { auto: string; notify: string }>
> = {
  "en-US": {
    auto: "AIdea detected that the OAuth authorization environment needs an update or repair. AIdea will update automatically after the countdown unless you postpone or minimize it.",
    notify:
      "AIdea detected that the OAuth authorization environment needs an update or repair. Nothing will be changed unless you click Update now.",
  },
  "zh-CN": {
    auto: "AIdea 检测到 OAuth 授权环境需要更新或修复。倒计时结束后会自动更新；点击稍后或最小化会暂停 24 小时。",
    notify:
      "AIdea 检测到 OAuth 授权环境需要更新或修复。只有点击立即更新时才会执行更新。",
  },
  "zh-TW": {
    auto: "AIdea 偵測到 OAuth 授權環境需要更新或修復。倒數結束後會自動更新；點擊稍後或最小化會暫停 24 小時。",
    notify:
      "AIdea 偵測到 OAuth 授權環境需要更新或修復。只有點擊立即更新時才會執行更新。",
  },
};

const OAUTH_ENV_UPDATE_CONTROL_COPIES: Record<
  PanelLang,
  { close: string; minimize: string; restore: string }
> = {
  "en-US": { close: "Close", minimize: "Minimize", restore: "Restore" },
  "zh-CN": { close: "关闭", minimize: "最小化", restore: "展开" },
  "zh-TW": { close: "關閉", minimize: "最小化", restore: "展開" },
  "ja-JP": { close: "閉じる", minimize: "最小化", restore: "展開" },
  "ko-KR": { close: "닫기", minimize: "최소화", restore: "펼치기" },
  "fr-FR": { close: "Fermer", minimize: "Reduire", restore: "Restaurer" },
  "de-DE": {
    close: "Schliessen",
    minimize: "Minimieren",
    restore: "Wiederherstellen",
  },
  "es-ES": { close: "Cerrar", minimize: "Minimizar", restore: "Restaurar" },
  "ru-RU": {
    close: "Закрыть",
    minimize: "Свернуть",
    restore: "Развернуть",
  },
  "pt-BR": { close: "Fechar", minimize: "Minimizar", restore: "Restaurar" },
  "ar-SA": { close: "إغلاق", minimize: "تصغير", restore: "استعادة" },
  "hi-IN": { close: "बंद करें", minimize: "छोटा करें", restore: "फैलाएँ" },
};

const windowStates = new Map<Window, SchedulerWindowState>();

let checkTimer: ReturnType<typeof setTimeout> | null = null;
let promptState: PromptState | null = null;
let updateRunning = false;

function prefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}

function setStringPref(key: string, value: string): void {
  try {
    Zotero.Prefs.set(prefKey(key), value, true);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to persist OAuth env update pref", err);
  }
}

function normalizeOAuthEnvUpdateMode(value: unknown): OAuthEnvUpdateMode {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  return mode === "auto" || mode === "silent" || mode === "notify"
    ? mode
    : "notify";
}

export function getOAuthEnvUpdateMode(): OAuthEnvUpdateMode {
  try {
    return normalizeOAuthEnvUpdateMode(Zotero.Prefs.get(MODE_PREF, true));
  } catch {
    return "notify";
  }
}

function dispatchLogUpdate(detail: {
  logs?: string;
  progress?: string;
  color?: string;
  reset?: boolean;
}): void {
  const wins = new Set<Window>();
  const main = Zotero.getMainWindow?.() as Window | null;
  if (main && !main.closed) wins.add(main);
  for (const win of windowStates.keys()) {
    if (!win.closed) wins.add(win);
  }
  for (const win of wins) {
    try {
      const CustomEventCtor = (win as any).CustomEvent || CustomEvent;
      win.dispatchEvent(new CustomEventCtor(LOG_EVENT, { detail }));
    } catch (err) {
      ztoolkit?.log?.("AIdea: failed to dispatch OAuth env log update", err);
    }
  }
}

function publishSetupLog(
  logs: string,
  progress?: string,
  color?: string,
  reset?: boolean,
): void {
  setStringPref("oauthSetupLog", logs);
  dispatchLogUpdate({ logs, progress, color, reset });
}

function getHostWindow(): Window | null {
  const main = Zotero.getMainWindow?.() as Window | null;
  if (main && !main.closed) return main;
  for (const win of windowStates.keys()) {
    if (!win.closed) return win;
  }
  return null;
}

function scheduleNextCheck(delayMs = CHECK_INTERVAL_MS): void {
  if (checkTimer) clearTimeout(checkTimer);
  checkTimer = setTimeout(
    () => {
      checkTimer = null;
      void checkOAuthEnvUpdateDue();
    },
    Math.max(5_000, delayMs),
  );
}

function clearNextCheck(): void {
  if (!checkTimer) return;
  clearTimeout(checkTimer);
  checkTimer = null;
}

function getCopy(): OAuthEnvUpdateCopy {
  return (
    OAUTH_ENV_UPDATE_COPIES[getPanelLang()] || OAUTH_ENV_UPDATE_COPIES["en-US"]
  );
}

function getLanguageDirection(): "ltr" | "rtl" {
  return getUiLanguageOption(getPanelLang()).dir;
}

function providerText(providers: OAuthProviderId[]): string {
  return providers.map(getProviderLabel).join(", ");
}

function makeEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    tag,
  ) as HTMLElementTagNameMap[K];
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function applyToastStyles(root: HTMLElement): void {
  Object.assign(root.style, {
    position: "fixed",
    right: "18px",
    bottom: "18px",
    zIndex: "2147483647",
    width: "360px",
    maxWidth: "calc(100vw - 36px)",
    padding: "14px 14px 12px",
    border: "1px solid rgba(31, 41, 55, 0.18)",
    borderRadius: "8px",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.18)",
    background: "#ffffff",
    color: "#1f2937",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: "13px",
    lineHeight: "1.45",
  });
}

function styleButton(button: HTMLButtonElement, primary = false): void {
  Object.assign(button.style, {
    minHeight: "28px",
    padding: "5px 10px",
    borderRadius: "6px",
    border: primary ? "1px solid #2563eb" : "1px solid #d1d5db",
    background: primary ? "#2563eb" : "#ffffff",
    color: primary ? "#ffffff" : "#374151",
    fontSize: "12px",
    fontWeight: "650",
    cursor: "pointer",
  });
}

function stylePromptIconButton(
  button: HTMLButtonElement,
  rightPx: number,
): void {
  Object.assign(button.style, {
    position: "absolute",
    top: "8px",
    right: `${rightPx}px`,
    width: "24px",
    height: "24px",
    padding: "0",
    border: "1px solid transparent",
    borderRadius: "6px",
    background: "transparent",
    color: "#6b7280",
    fontSize: "18px",
    lineHeight: "20px",
    fontWeight: "700",
    cursor: "pointer",
  });
}

function setButtonDisabled(button: HTMLButtonElement, disabled: boolean): void {
  button.disabled = disabled;
  Object.assign(button.style, {
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? "0.55" : "1",
    pointerEvents: disabled ? "none" : "auto",
  });
}

function getMinimizeText(prompt: PromptState): string {
  const controls = OAUTH_ENV_UPDATE_CONTROL_COPIES[getPanelLang()];
  return prompt.minimized ? controls.restore : controls.minimize;
}

function getCloseText(): string {
  return OAUTH_ENV_UPDATE_CONTROL_COPIES[getPanelLang()].close;
}

function getModeBody(
  copy: OAuthEnvUpdateCopy,
  mode: PromptState["mode"],
): string {
  const body = OAUTH_ENV_UPDATE_MODE_BODY_OVERRIDES[getPanelLang()];
  if (mode === "auto") return body?.auto || copy.idle;
  if (mode === "notify") return body?.notify || copy.active;
  return copy.updating;
}

function clearPromptCountdown(prompt: PromptState | null = promptState): void {
  if (!prompt?.countdownTimer) return;
  clearInterval(prompt.countdownTimer);
  prompt.countdownTimer = null;
}

function setPromptMinimized(prompt: PromptState, minimized: boolean): void {
  prompt.minimized = minimized;
  prompt.body.style.display = minimized ? "none" : "";
  prompt.status.style.display = minimized ? "none" : "";
  prompt.actions.style.display = minimized ? "none" : "flex";
  prompt.root.style.width = minimized ? "300px" : "360px";
  prompt.root.style.padding = minimized
    ? "10px 72px 10px 12px"
    : "14px 14px 12px";
  prompt.title.style.marginBottom = minimized ? "0" : "7px";
  prompt.minimizeButton.textContent = minimized ? "+" : "-";
  prompt.minimizeButton.title = getMinimizeText(prompt);
  prompt.closeButton.title = getCloseText();
}

function closePrompt(): void {
  if (!promptState) return;
  clearPromptCountdown(promptState);
  promptState.root.remove();
  promptState = null;
}

function snoozePromptProviders(providers: OAuthProviderId[]): void {
  snoozeOAuthEnvUpdateProviders(providers, Date.now() + PROMPT_SNOOZE_MS);
  scheduleNextCheck(PROMPT_SNOOZE_MS);
}

function dismissPromptWithSnooze(prompt: PromptState): void {
  snoozePromptProviders(prompt.providers);
  closePrompt();
}

function renderPromptMode(mode: "auto" | "notify" | "updating"): void {
  const prompt = promptState;
  if (!prompt) return;
  const copy = getCopy();
  prompt.mode = mode;
  clearPromptCountdown(prompt);

  prompt.title.textContent = copy.title;
  prompt.body.textContent = getModeBody(copy, mode);
  prompt.status.textContent =
    mode === "auto"
      ? copy.countdown.replace("{n}", String(prompt.countdownRemaining))
      : `${copy.providers}: ${providerText(prompt.providers)}`;
  setButtonDisabled(prompt.nowButton, mode === "updating");
  setButtonDisabled(prompt.laterButton, mode === "updating");
  setButtonDisabled(prompt.closeButton, mode === "updating");
  setButtonDisabled(prompt.minimizeButton, mode === "updating");

  if (mode === "auto") {
    prompt.countdownRemaining = COUNTDOWN_SECONDS;
    prompt.status.textContent = copy.countdown.replace(
      "{n}",
      String(prompt.countdownRemaining),
    );
    prompt.countdownTimer = setInterval(() => {
      if (!promptState || promptState !== prompt) return;
      prompt.countdownRemaining -= 1;
      prompt.status.textContent = copy.countdown.replace(
        "{n}",
        String(Math.max(0, prompt.countdownRemaining)),
      );
      if (prompt.countdownRemaining <= 0) {
        const targetProviders = [...prompt.providers];
        closePrompt();
        void runOAuthEnvUpdate(targetProviders);
      }
    }, 1000);
  }
}

function showOAuthEnvUpdatePrompt(providers: OAuthProviderId[]): void {
  const updateMode = getOAuthEnvUpdateMode();
  if (updateMode === "silent") return;
  const win = getHostWindow();
  const doc = win?.document;
  if (!win || !doc?.documentElement) return;

  if (promptState) {
    promptState.providers = [...providers];
    promptState.dismissSnoozes = true;
    setPromptMinimized(promptState, false);
    renderPromptMode(updateMode);
    return;
  }

  const existing = doc.getElementById(TOAST_ID);
  existing?.remove();

  const copy = getCopy();
  const root = makeEl(doc, "div");
  root.id = TOAST_ID;
  root.setAttribute("dir", getLanguageDirection());
  applyToastStyles(root);

  const closeButton = makeEl(doc, "button", "", "×");
  closeButton.type = "button";
  stylePromptIconButton(closeButton, 8);
  closeButton.title = getCloseText();

  const minimizeButton = makeEl(doc, "button", "", "-");
  minimizeButton.type = "button";
  stylePromptIconButton(minimizeButton, 36);
  minimizeButton.title =
    OAUTH_ENV_UPDATE_CONTROL_COPIES[getPanelLang()].minimize;

  const title = makeEl(doc, "div", "", copy.title);
  Object.assign(title.style, {
    marginBottom: "7px",
    paddingRight: "58px",
    fontWeight: "750",
    fontSize: "14px",
    color: "#111827",
  });

  const body = makeEl(doc, "div");
  Object.assign(body.style, {
    marginBottom: "9px",
    color: "#374151",
  });

  const status = makeEl(doc, "div");
  Object.assign(status.style, {
    marginBottom: "11px",
    color: "#6b7280",
    fontSize: "12px",
  });

  const actions = makeEl(doc, "div");
  Object.assign(actions.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  });

  const laterButton = makeEl(doc, "button", "", copy.later);
  const nowButton = makeEl(doc, "button", "", copy.now);
  laterButton.type = "button";
  nowButton.type = "button";
  styleButton(laterButton, false);
  styleButton(nowButton, true);
  setButtonDisabled(laterButton, false);
  setButtonDisabled(nowButton, false);
  actions.append(laterButton, nowButton);
  root.append(closeButton, minimizeButton, title, body, status, actions);
  doc.documentElement.appendChild(root);

  promptState = {
    providers: [...providers],
    root,
    title,
    body,
    status,
    actions,
    nowButton,
    laterButton,
    closeButton,
    minimizeButton,
    countdownTimer: null,
    countdownRemaining: COUNTDOWN_SECONDS,
    mode: updateMode,
    minimized: false,
    dismissSnoozes: true,
  };

  closeButton.addEventListener("click", () => {
    if (!promptState) return;
    if (promptState.dismissSnoozes) {
      dismissPromptWithSnooze(promptState);
      return;
    }
    closePrompt();
  });

  minimizeButton.addEventListener("click", () => {
    if (!promptState) return;
    if (!promptState.minimized && promptState.mode === "auto") {
      clearPromptCountdown(promptState);
      snoozePromptProviders(promptState.providers);
      promptState.status.textContent = copy.snoozed;
      setPromptMinimized(promptState, true);
      return;
    }
    setPromptMinimized(promptState, !promptState.minimized);
  });

  let updateStarted = false;
  nowButton.addEventListener("click", () => {
    if (!promptState || updateStarted || updateRunning) return;
    updateStarted = true;
    setButtonDisabled(nowButton, true);
    setButtonDisabled(laterButton, true);
    const targetProviders = [...promptState.providers];
    closePrompt();
    void runOAuthEnvUpdate(targetProviders);
  });
  let snoozeStarted = false;
  laterButton.addEventListener("click", () => {
    if (!promptState || snoozeStarted || updateRunning) return;
    snoozeStarted = true;
    setButtonDisabled(nowButton, true);
    setButtonDisabled(laterButton, true);
    status.textContent = copy.snoozed;
    dismissPromptWithSnooze(promptState);
  });

  renderPromptMode(updateMode);
}

async function runOAuthEnvUpdate(providers: OAuthProviderId[]): Promise<void> {
  if (updateRunning || !providers.length) return;
  updateRunning = true;
  showOAuthEnvUpdatePrompt(providers);
  if (promptState) promptState.dismissSnoozes = false;
  renderPromptMode("updating");

  const logs: string[] = [];
  const liveLogs: string[] = [];
  const failedSteps: string[] = [];
  const publishProgress = (line: string, color = "#374151", reset = false) => {
    if (reset) liveLogs.length = 0;
    liveLogs.push(line);
    publishSetupLog(liveLogs.join("\n"), line, color, reset);
  };
  publishProgress(
    `[${providerText(providers)}] ${getCopy().updating}`,
    "#374151",
    true,
  );
  let allOk = true;
  for (const provider of providers) {
    const label = getProviderLabel(provider);
    if (promptState) {
      promptState.status.textContent = `${label}: ${getCopy().updating}`;
    }
    const result = await autoConfigureEnvironment({
      provider,
      onProgress: (event) => {
        const prefix = `${label}: ${event.step}`;
        if (promptState) {
          promptState.status.textContent = event.output
            ? `${prefix} - ${String(event.output).split(/\r?\n/g)[0].slice(0, 120)}`
            : prefix;
        }
        const marker =
          event.phase === "start"
            ? "START"
            : event.phase === "done"
              ? event.ok
                ? "OK"
                : "FAIL"
              : "INFO";
        const eventLine = event.output
          ? `[${label}] ${marker} ${event.step}\n${String(event.output).trim()}`
          : `[${label}] ${marker} ${event.step}`;
        publishProgress(
          eventLine,
          event.phase === "done"
            ? event.ok
              ? "#065f46"
              : "#991b1b"
            : "#374151",
        );
        if (event.phase === "done" && event.ok === false) {
          const firstLine = event.output
            ? String(event.output).split(/\r?\n/g)[0].slice(0, 160)
            : "";
          failedSteps.push(firstLine ? `${prefix} - ${firstLine}` : prefix);
        }
      },
    });
    logs.push(`## ${label}\n${result.logs}`);
    if (!result.ok) allOk = false;
  }

  const finalLogs = logs.join("\n\n");
  publishSetupLog(finalLogs);
  const copy = getCopy();
  if (promptState) {
    promptState.body.textContent = allOk ? copy.done : copy.failed;
    promptState.status.textContent = allOk
      ? `${copy.providers}: ${providerText(providers)}`
      : failedSteps[failedSteps.length - 1] ||
        `${copy.providers}: ${providerText(providers)}`;
    setButtonDisabled(promptState.nowButton, true);
    setButtonDisabled(promptState.closeButton, false);
    setButtonDisabled(promptState.minimizeButton, false);
    const okButton = promptState.laterButton.cloneNode(
      true,
    ) as HTMLButtonElement;
    okButton.textContent = copy.ok;
    styleButton(okButton, false);
    setButtonDisabled(okButton, false);
    okButton.addEventListener("click", closePrompt);
    promptState.actions.replaceChildren(okButton);
    promptState.laterButton = okButton;
  }

  if (!allOk) {
    snoozeOAuthEnvUpdateProviders(providers, Date.now() + PROMPT_SNOOZE_MS);
  }
  updateRunning = false;
  scheduleNextCheck();
}

async function checkOAuthEnvUpdateDue(): Promise<void> {
  try {
    const updateMode = getOAuthEnvUpdateMode();
    if (updateMode === "silent") {
      closePrompt();
      clearNextCheck();
      return;
    }
    if (updateRunning || (promptState && !promptState.minimized)) {
      scheduleNextCheck();
      return;
    }
    const authorized = await getAuthorizedOAuthCliProviders();
    if (!authorized.length) {
      scheduleNextCheck();
      return;
    }
    const due = getDueOAuthEnvUpdateProviders(authorized).filter(
      (provider): provider is OAuthProviderId =>
        authorized.includes(provider as OAuthProviderId),
    );
    if (!due.length) {
      scheduleNextCheck();
      return;
    }
    const checks = await checkOAuthCliEnvironmentUpdates(due);
    const currentProviders = checks
      .filter((check) => !check.needsUpdate)
      .map((check) => check.provider);
    if (currentProviders.length) recordOAuthEnvUpdateChecked(currentProviders);
    const updateProviders = checks
      .filter((check) => check.needsUpdate)
      .map((check) => check.provider);
    if (!updateProviders.length) {
      scheduleNextCheck();
      return;
    }
    showOAuthEnvUpdatePrompt(updateProviders);
    scheduleNextCheck();
  } catch (err) {
    ztoolkit?.log?.("AIdea: OAuth env update scheduler failed", err);
    scheduleNextCheck();
  }
}

export function registerOAuthEnvUpdateSchedulerWindow(win: Window): void {
  if (windowStates.has(win)) return;
  windowStates.set(win, {
    cleanup: () => undefined,
  });
  if (getOAuthEnvUpdateMode() !== "silent") scheduleNextCheck(STARTUP_DELAY_MS);
}

export function refreshOAuthEnvUpdateSchedulerMode(): void {
  const updateMode = getOAuthEnvUpdateMode();
  if (updateMode === "silent") {
    clearNextCheck();
    closePrompt();
    return;
  }
  if (promptState) {
    setPromptMinimized(promptState, false);
    renderPromptMode(updateMode);
  }
  scheduleNextCheck(5_000);
}

export function unregisterOAuthEnvUpdateSchedulerWindow(win: Window): void {
  const state = windowStates.get(win);
  if (!state) return;
  state.cleanup();
  windowStates.delete(win);
  if (!windowStates.size) closePrompt();
}

export function shutdownOAuthEnvUpdateScheduler(): void {
  clearNextCheck();
  closePrompt();
  for (const state of windowStates.values()) {
    state.cleanup();
  }
  windowStates.clear();
  updateRunning = false;
}
