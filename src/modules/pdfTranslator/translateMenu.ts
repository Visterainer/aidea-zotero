/* ---------------------------------------------------------------------------
 * pdfTranslator/translateMenu.ts  –  Library context menu: translate full PDF
 *
 * One click translates the selected item's PDF with the settings saved by the
 * Translate tab, shows progress in a Zotero progress window, and files the
 * result next to the original. One job at a time; while a job started here is
 * running the same menu entry cancels it.
 * -------------------------------------------------------------------------*/

import { config } from "../../../package.json";
import { getPanelLang } from "../contextPanel/i18n";
import type { TranslateEvent } from "./index";
import { getTranslateMenuCopy, type TranslateMenuCopy } from "./menuI18n";
import {
  getPersistedTranslateModel,
  getPersistedTranslateProvider,
  readSavedTranslateOptions,
} from "./translatePrefs";
import {
  attachTranslatedPdfs,
  findExistingTranslations,
  findPdfAttachment,
  pickAttachmentToOpen,
  resolveSourcePdf,
  type TranslationOutputKind,
} from "./translationAttachment";
import {
  isTranslationRunning,
  startTranslationJob,
  type TranslationJobHandle,
  type TranslationJobOutcome,
} from "./translationJob";

declare const Services: any;

const MENU_ID = `${config.addonRef}-translate-pdf-context-menu`;
const MENU_ICON = `chrome://${config.addonRef}/content/icons/icon-20.png`;
const RESULT_CLOSE_MS = 6000;
const ERROR_CLOSE_MS = 15000;

type ProgressWindow = InstanceType<typeof ztoolkit.ProgressWindow>;

interface ActiveMenuJob {
  handle: TranslationJobHandle;
  percent: number;
  progressWindow: ProgressWindow | null;
}

let registered = false;
let activeJob: ActiveMenuJob | null = null;
/** True from the click until the job is handed to `activeJob`. */
let starting = false;

function copy(): TranslateMenuCopy {
  return getTranslateMenuCopy(getPanelLang());
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function firstLine(text: string): string {
  return (
    String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) || ""
  );
}

function closeProgressWindow(win: ProgressWindow | null): void {
  try {
    win?.close();
  } catch {
    /* already closed */
  }
}

/** Show a short self-closing message. */
function notify(text: string, type: "default" | "success" | "fail"): void {
  try {
    new ztoolkit.ProgressWindow(copy().progressTitle, {
      closeOnClick: true,
      closeTime: type === "fail" ? ERROR_CLOSE_MS : RESULT_CLOSE_MS,
    })
      .createLine({ text, type, progress: 100 })
      .show();
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to show translate menu message", text, err);
  }
}

function openRunningProgressWindow(): ProgressWindow | null {
  const strings = copy();
  try {
    return new ztoolkit.ProgressWindow(strings.progressTitle, {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({ text: strings.preparing, type: "default", progress: 0 })
      .createLine({ text: strings.cancelHint, type: "default" })
      .show(-1);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to open translate progress window", err);
    return null;
  }
}

function showProgress(job: ActiveMenuJob, event: TranslateEvent): void {
  if (event.type !== "progress") return;
  const strings = copy();
  const percent = Math.max(
    job.percent,
    Math.min(100, Math.round(Number(event.data.progress) || 0)),
  );
  job.percent = percent;
  const { current, total } = event.data;
  const pageText =
    typeof current === "number" && typeof total === "number" && total > 0
      ? ` · ${strings.page(current, total)}`
      : "";
  try {
    // Throws once the user has dismissed the window; the menu label still
    // carries the percentage and a fresh window reports the result.
    job.progressWindow?.changeLine({
      idx: 0,
      text: `${strings.translating(percent)}${pageText}`,
      progress: percent,
    });
  } catch {
    job.progressWindow = null;
  }
}

function describeOutcome(
  outcome: Exclude<TranslationJobOutcome, { status: "done" }>,
): { text: string; type: "default" | "fail" } {
  const strings = copy();
  if (outcome.status === "cancelled") {
    return { text: strings.cancelled, type: "default" };
  }
  if (outcome.status === "error") {
    return { text: strings.failed(firstLine(outcome.message)), type: "fail" };
  }
  switch (outcome.reason) {
    case "busy":
      return { text: strings.busy, type: "default" };
    case "no_model":
      return { text: strings.noModel, type: "fail" };
    case "credentials":
      return {
        text: strings.credentialsFailed(firstLine(outcome.detail)),
        type: "fail",
      };
    default:
      return { text: strings.envNotReady, type: "fail" };
  }
}

async function resolveModel(): Promise<{ name: string; providerId: string }> {
  const name = getPersistedTranslateModel();
  if (name) return { name, providerId: getPersistedTranslateProvider() };
  // The tab falls back to the first available model when none was saved.
  const { getModelChoices } =
    await import("../contextPanel/setupHandlers/controllers/modelSelectionController");
  const first = getModelChoices().choices[0];
  return { name: first?.model || "", providerId: first?.providerId || "" };
}

async function createOutputDir(): Promise<string> {
  const tempDir = String(PathUtils.tempDir || "").trim();
  if (!tempDir) throw new Error("PathUtils.tempDir is empty");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = PathUtils.join(tempDir, "aidea-translate", "menu-output", id);
  await IOUtils.makeDirectory(dir, { createAncestors: true });
  return dir;
}

async function removeDir(dir: string): Promise<void> {
  try {
    await IOUtils.remove(dir, { recursive: true, ignoreAbsent: true });
  } catch {
    /* best effort */
  }
}

async function openInReader(item: Zotero.Item | null): Promise<void> {
  if (!item?.id) return;
  try {
    await Zotero.Reader.open(item.id);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to open translated PDF", err);
  }
}

/**
 * Ask what to do when the item already has this translation.
 * @returns "open" | "translate" | "cancel"
 */
function promptExistingTranslation(
  targetLang: string,
): "open" | "translate" | "cancel" {
  const strings = copy();
  const prompt = Services.prompt;
  const choice = prompt.confirmEx(
    Zotero.getMainWindow(),
    strings.progressTitle,
    strings.existsPrompt(targetLang),
    prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_IS_STRING +
      prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_CANCEL +
      prompt.BUTTON_POS_2 * prompt.BUTTON_TITLE_IS_STRING,
    strings.openExisting,
    null,
    strings.translateAgain,
    null,
    {},
  );
  if (choice === 0) return "open";
  if (choice === 2) return "translate";
  return "cancel";
}

function confirmCancel(): boolean {
  const strings = copy();
  try {
    return Boolean(
      Services.prompt.confirm(
        Zotero.getMainWindow(),
        strings.progressTitle,
        strings.confirmCancel,
      ),
    );
  } catch {
    return true;
  }
}

async function translateItem(item: Zotero.Item): Promise<void> {
  const strings = copy();
  if (isTranslationRunning()) {
    notify(strings.busy, "default");
    return;
  }

  const source = await resolveSourcePdf(item);
  if (!source) {
    notify(strings.noPdf, "fail");
    return;
  }

  const options = readSavedTranslateOptions();
  // With both formats switched off the engine would produce nothing.
  if (!options.generateMono && !options.generateDual) {
    options.generateMono = true;
  }

  const existing = findExistingTranslations(
    source.attachment,
    options.targetLang,
  );
  const wanted: TranslationOutputKind[] = [];
  if (options.generateMono) wanted.push("mono");
  if (options.generateDual) wanted.push("dual");
  if (wanted.every((kind) => existing[kind])) {
    const choice = promptExistingTranslation(options.targetLang);
    if (choice === "cancel") return;
    if (choice === "open") {
      await openInReader(
        pickAttachmentToOpen(wanted.map((kind) => existing[kind])),
      );
      return;
    }
  }

  const model = await resolveModel();
  if (!model.name) {
    notify(strings.noModel, "fail");
    return;
  }

  const outputDir = await createOutputDir();
  const job: ActiveMenuJob = {
    handle: startTranslationJob(
      {
        pdfPath: source.pdfPath,
        outputDir,
        modelName: model.name,
        providerId: model.providerId,
        options,
      },
      (event) => showProgress(job, event),
    ),
    percent: 0,
    progressWindow: null,
  };
  job.progressWindow = openRunningProgressWindow();
  activeJob = job;

  let outcome: TranslationJobOutcome;
  try {
    outcome = await job.handle.done;
  } finally {
    activeJob = null;
    closeProgressWindow(job.progressWindow);
  }

  if (outcome.status !== "done") {
    await removeDir(outputDir);
    const message = describeOutcome(outcome);
    notify(message.text, message.type);
    return;
  }

  let attached;
  try {
    if (!outcome.outputFiles.length) throw new Error("no output file");
    attached = await attachTranslatedPdfs(
      source.attachment,
      outcome.outputFiles,
    );
  } catch (err) {
    // Keep the output so the finished translation is not lost.
    notify(copy().attachFailed(errorText(err), outputDir), "fail");
    return;
  }
  await removeDir(outputDir);
  notify(copy().done, "success");
  await openInReader(pickAttachmentToOpen(attached.items));
}

function onCommand(items: Zotero.Item[] | undefined): void {
  if (activeJob) {
    if (confirmCancel()) activeJob?.handle.cancel();
    return;
  }
  if (starting) return;
  const item = (items || [])[0];
  if (!item) return;
  starting = true;
  void translateItem(item)
    .catch((err) => {
      ztoolkit?.log?.("AIdea: context-menu translation failed", err);
      notify(copy().failed(firstLine(errorText(err))), "fail");
    })
    .finally(() => {
      starting = false;
    });
}

export function registerTranslateMenu(): void {
  if (registered || !(Zotero as any).MenuManager?.registerMenu) return;
  const result = Zotero.MenuManager.registerMenu({
    menuID: MENU_ID,
    pluginID: config.addonID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        icon: MENU_ICON,
        onShowing: (_event, context) => {
          const strings = copy();
          context.setIcon(MENU_ICON);
          if (activeJob) {
            // Reachable from any selection so the job can always be stopped.
            context.setVisible(true);
            context.setEnabled(true);
            context.menuElem.setAttribute(
              "label",
              strings.menuCancel(activeJob.percent),
            );
            return;
          }
          const items = context.items || [];
          const visible =
            items.length === 1 && Boolean(findPdfAttachment(items[0]));
          context.setVisible(visible);
          context.setEnabled(visible && !starting);
          context.menuElem.setAttribute("label", strings.menuTranslate);
        },
        onCommand: (_event, context) => onCommand(context.items),
      },
    ],
  });
  registered = Boolean(result);
}

export function unregisterTranslateMenu(): void {
  try {
    activeJob?.handle.cancel();
  } catch {
    /* ignore */
  }
  if (!registered || !(Zotero as any).MenuManager?.unregisterMenu) return;
  try {
    Zotero.MenuManager.unregisterMenu(MENU_ID);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to unregister translate menu", err);
  } finally {
    registered = false;
  }
}
