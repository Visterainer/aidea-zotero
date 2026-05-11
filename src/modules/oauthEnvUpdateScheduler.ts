import { config } from "../../package.json";
import {
  autoConfigureEnvironment,
  checkOAuthCliEnvironmentUpdates,
  getAuthorizedOAuthCliProviders,
  getProviderLabel,
  type OAuthProviderId,
} from "../utils/oauthCli";
import {
  OAUTH_ENV_UPDATE_INTERVAL_MS,
  getDueOAuthEnvUpdateProviders,
  recordOAuthEnvUpdateChecked,
  snoozeOAuthEnvUpdateProviders,
} from "../utils/oauthEnvUpdateState";
import { getPanelLang, type PanelLang } from "./contextPanel/i18n";
import { getUiLanguageOption } from "./contextPanel/languages";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const STARTUP_DELAY_MS = 90 * 1000;
const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const COUNTDOWN_SECONDS = 60;
const TOAST_ID = `${config.addonRef}-oauth-env-update-toast`;

type SchedulerWindowState = {
  cleanup: () => void;
};

type PromptState = {
  providers: OAuthProviderId[];
  root: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  status: HTMLElement;
  nowButton: HTMLButtonElement;
  laterButton: HTMLButtonElement;
  countdownTimer: ReturnType<typeof setInterval> | null;
  countdownRemaining: number;
  mode: "active" | "idle" | "updating";
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

const windowStates = new Map<Window, SchedulerWindowState>();

let lastActivityAt = Date.now();
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

function getHostWindow(): Window | null {
  const main = Zotero.getMainWindow?.() as Window | null;
  if (main && !main.closed) return main;
  for (const win of windowStates.keys()) {
    if (!win.closed) return win;
  }
  return null;
}

function isUserActive(now = Date.now()): boolean {
  return now - lastActivityAt < ACTIVE_THRESHOLD_MS;
}

function markActivity(): void {
  lastActivityAt = Date.now();
  if (promptState?.mode === "idle" && !updateRunning) {
    switchPromptMode("active");
  }
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

function setButtonDisabled(button: HTMLButtonElement, disabled: boolean): void {
  button.disabled = disabled;
  Object.assign(button.style, {
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? "0.55" : "1",
    pointerEvents: disabled ? "none" : "auto",
  });
}

function closePrompt(): void {
  if (!promptState) return;
  if (promptState.countdownTimer) {
    clearInterval(promptState.countdownTimer);
  }
  promptState.root.remove();
  promptState = null;
}

function switchPromptMode(mode: "active" | "idle" | "updating"): void {
  const prompt = promptState;
  if (!prompt) return;
  const copy = getCopy();
  prompt.mode = mode;
  if (prompt.countdownTimer) {
    clearInterval(prompt.countdownTimer);
    prompt.countdownTimer = null;
  }

  prompt.title.textContent = copy.title;
  prompt.body.textContent =
    mode === "updating"
      ? copy.updating
      : mode === "idle"
        ? copy.idle
        : copy.active;
  prompt.status.textContent =
    mode === "idle"
      ? copy.countdown.replace("{n}", String(prompt.countdownRemaining))
      : `${copy.providers}: ${providerText(prompt.providers)}`;
  setButtonDisabled(prompt.nowButton, mode === "updating");
  setButtonDisabled(prompt.laterButton, mode === "updating");

  if (mode === "idle") {
    prompt.countdownTimer = setInterval(() => {
      if (!promptState || promptState !== prompt) return;
      if (isUserActive()) {
        switchPromptMode("active");
        return;
      }
      prompt.countdownRemaining -= 1;
      prompt.status.textContent = copy.countdown.replace(
        "{n}",
        String(Math.max(0, prompt.countdownRemaining)),
      );
      if (prompt.countdownRemaining <= 0) {
        closePrompt();
        void runOAuthEnvUpdate(prompt.providers);
      }
    }, 1000);
  }
}

function showOAuthEnvUpdatePrompt(providers: OAuthProviderId[]): void {
  const win = getHostWindow();
  const doc = win?.document;
  if (!win || !doc?.documentElement) return;

  closePrompt();
  const existing = doc.getElementById(TOAST_ID);
  existing?.remove();

  const copy = getCopy();
  const root = makeEl(doc, "div");
  root.id = TOAST_ID;
  root.setAttribute("dir", getLanguageDirection());
  applyToastStyles(root);

  const title = makeEl(doc, "div", "", copy.title);
  Object.assign(title.style, {
    marginBottom: "7px",
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
  root.append(title, body, status, actions);
  doc.documentElement.appendChild(root);

  promptState = {
    providers,
    root,
    title,
    body,
    status,
    nowButton,
    laterButton,
    countdownTimer: null,
    countdownRemaining: COUNTDOWN_SECONDS,
    mode: "active",
  };

  let updateStarted = false;
  nowButton.addEventListener("click", () => {
    if (updateStarted || updateRunning) return;
    updateStarted = true;
    setButtonDisabled(nowButton, true);
    setButtonDisabled(laterButton, true);
    const targetProviders = [...providers];
    closePrompt();
    void runOAuthEnvUpdate(targetProviders);
  });
  let snoozeStarted = false;
  laterButton.addEventListener("click", () => {
    if (snoozeStarted || updateRunning) return;
    snoozeStarted = true;
    setButtonDisabled(nowButton, true);
    setButtonDisabled(laterButton, true);
    snoozeOAuthEnvUpdateProviders(
      providers,
      Date.now() + OAUTH_ENV_UPDATE_INTERVAL_MS,
    );
    status.textContent = copy.snoozed;
    closePrompt();
    scheduleNextCheck(OAUTH_ENV_UPDATE_INTERVAL_MS);
  });

  switchPromptMode(isUserActive() ? "active" : "idle");
}

async function runOAuthEnvUpdate(providers: OAuthProviderId[]): Promise<void> {
  if (updateRunning || !providers.length) return;
  updateRunning = true;
  showOAuthEnvUpdatePrompt(providers);
  switchPromptMode("updating");

  const logs: string[] = [];
  let allOk = true;
  for (const provider of providers) {
    const label = getProviderLabel(provider);
    promptState &&
      (promptState.status.textContent = `${label}: ${getCopy().updating}`);
    const result = await autoConfigureEnvironment({
      provider,
      onProgress: (event) => {
        if (!promptState) return;
        const prefix = `${label}: ${event.step}`;
        promptState.status.textContent = event.output
          ? `${prefix} - ${String(event.output).split(/\r?\n/g)[0].slice(0, 120)}`
          : prefix;
      },
    });
    logs.push(`## ${label}\n${result.logs}`);
    if (!result.ok) allOk = false;
  }

  setStringPref("oauthSetupLog", logs.join("\n\n"));
  const copy = getCopy();
  if (promptState) {
    promptState.body.textContent = allOk ? copy.done : copy.failed;
    promptState.status.textContent = `${copy.providers}: ${providerText(
      providers,
    )}`;
    setButtonDisabled(promptState.nowButton, true);
    const okButton = promptState.laterButton.cloneNode(
      true,
    ) as HTMLButtonElement;
    okButton.textContent = copy.ok;
    styleButton(okButton, false);
    setButtonDisabled(okButton, false);
    okButton.addEventListener("click", closePrompt);
    promptState.laterButton.replaceWith(okButton);
    promptState.laterButton = okButton;
  }

  if (!allOk) {
    snoozeOAuthEnvUpdateProviders(
      providers,
      Date.now() + Math.floor(OAUTH_ENV_UPDATE_INTERVAL_MS / 3),
    );
  }
  updateRunning = false;
  scheduleNextCheck();
}

async function checkOAuthEnvUpdateDue(): Promise<void> {
  try {
    if (updateRunning || promptState) {
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
  const onActivity = () => markActivity();
  const events = ["keydown", "pointerdown", "mousedown", "wheel", "scroll"];
  for (const event of events) {
    win.document?.addEventListener?.(event, onActivity, {
      capture: true,
      passive: true,
    } as AddEventListenerOptions);
  }
  windowStates.set(win, {
    cleanup: () => {
      for (const event of events) {
        win.document?.removeEventListener?.(event, onActivity, {
          capture: true,
        } as EventListenerOptions);
      }
    },
  });
  scheduleNextCheck(STARTUP_DELAY_MS);
}

export function unregisterOAuthEnvUpdateSchedulerWindow(win: Window): void {
  const state = windowStates.get(win);
  if (!state) return;
  state.cleanup();
  windowStates.delete(win);
  if (!windowStates.size) closePrompt();
}

export function shutdownOAuthEnvUpdateScheduler(): void {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }
  closePrompt();
  for (const state of windowStates.values()) {
    state.cleanup();
  }
  windowStates.clear();
  updateRunning = false;
}
