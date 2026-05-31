import type { AuthorProfileCopy } from "./i18n";
import { getAuthorProfileCopy } from "./i18n";
import { formatDuration, getAuthorProfileLanguage } from "./utils";

type ToastStatus = "running" | "success" | "error";

export type ToastUpdate = {
  title?: string;
  body?: string;
  status?: ToastStatus;
  progress?: number;
  itemTitle?: string;
  itemIndex?: number;
  totalItems?: number;
  completed?: number;
  skipped?: number;
  failed?: number;
  elapsedMs?: number;
  etaMs?: number;
};

function getCopy(): AuthorProfileCopy {
  return getAuthorProfileCopy(getAuthorProfileLanguage());
}

function getHostWindow(): Window | null {
  try {
    const mainWindow = (Zotero as any).getMainWindow?.();
    if (mainWindow) return mainWindow as Window;
  } catch {
    /* ignore */
  }
  try {
    const windows = (Zotero as any).getMainWindows?.();
    if (Array.isArray(windows) && windows[0]) return windows[0] as Window;
  } catch {
    /* ignore */
  }
  return null;
}

function makeEl<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    tag,
  ) as HTMLElementTagNameMap[K];
  if (text !== undefined) el.textContent = text;
  return el;
}

function styleRoot(root: HTMLElement): void {
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
  root.dir = getCopy().dir;
}

function styleIconButton(button: HTMLButtonElement, rightPx: number): void {
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

export class AuthorProfileProgressToast {
  private root: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private bodyEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private barEl: HTMLElement | null = null;
  private metaEl: HTMLElement | null = null;
  private minimizeButton: HTMLButtonElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private minimized = false;

  constructor(private readonly mode: "single" | "batch") {
    this.mount();
  }

  private mount(): void {
    const win = getHostWindow();
    const doc = win?.document;
    if (!doc?.documentElement) return;
    const existing = doc.getElementById("aidea-author-profile-progress-toast");
    existing?.remove();

    const copy = getCopy();
    const root = makeEl(doc, "div");
    root.id = "aidea-author-profile-progress-toast";
    styleRoot(root);

    const closeButton = makeEl(doc, "button", "x");
    closeButton.type = "button";
    closeButton.title = copy.close;
    styleIconButton(closeButton, 8);

    const minimizeButton = makeEl(doc, "button", "-");
    minimizeButton.type = "button";
    minimizeButton.title = copy.minimize;
    styleIconButton(minimizeButton, 36);

    const title = makeEl(
      doc,
      "div",
      this.mode === "batch"
        ? copy.progressBatchTitle
        : copy.progressSingleTitle,
    );
    Object.assign(title.style, {
      marginBottom: "7px",
      paddingRight: "58px",
      fontWeight: "750",
      fontSize: "14px",
      color: "#111827",
    });

    const body = makeEl(doc, "div", "");
    Object.assign(body.style, {
      marginBottom: "8px",
      color: "#374151",
    });

    const status = makeEl(doc, "div", "");
    Object.assign(status.style, {
      marginBottom: "9px",
      color: "#6b7280",
      fontSize: "12px",
    });

    const barTrack = makeEl(doc, "div");
    Object.assign(barTrack.style, {
      height: "7px",
      borderRadius: "999px",
      background: "#e5e7eb",
      overflow: "hidden",
      marginBottom: "8px",
    });
    const bar = makeEl(doc, "div");
    Object.assign(bar.style, {
      width: "0%",
      height: "100%",
      borderRadius: "999px",
      background: "linear-gradient(90deg, #2563eb, #7c3aed)",
      transition: "width 180ms ease",
    });
    barTrack.appendChild(bar);

    const meta = makeEl(doc, "div", "");
    Object.assign(meta.style, {
      color: "#6b7280",
      fontSize: "12px",
    });

    root.append(
      closeButton,
      minimizeButton,
      title,
      body,
      status,
      barTrack,
      meta,
    );
    doc.documentElement.appendChild(root);

    closeButton.addEventListener("click", () => this.close());
    minimizeButton.addEventListener("click", () =>
      this.setMinimized(!this.minimized),
    );

    this.root = root;
    this.titleEl = title;
    this.bodyEl = body;
    this.statusEl = status;
    this.barEl = bar;
    this.metaEl = meta;
    this.minimizeButton = minimizeButton;
    this.closeButton = closeButton;
  }

  private setMinimized(minimized: boolean): void {
    if (!this.root) return;
    const copy = getCopy();
    this.minimized = minimized;
    for (const el of [
      this.bodyEl,
      this.statusEl,
      this.barEl?.parentElement as HTMLElement | null | undefined,
      this.metaEl,
    ]) {
      if (el) el.style.display = minimized ? "none" : "";
    }
    this.root.style.width = minimized ? "300px" : "360px";
    this.root.style.padding = minimized
      ? "10px 72px 10px 12px"
      : "14px 14px 12px";
    if (this.titleEl) this.titleEl.style.marginBottom = minimized ? "0" : "7px";
    if (this.minimizeButton) {
      this.minimizeButton.textContent = minimized ? "+" : "-";
      this.minimizeButton.title = minimized ? copy.restore : copy.minimize;
    }
    if (this.closeButton) this.closeButton.title = copy.close;
  }

  update(update: ToastUpdate): void {
    if (!this.root) return;
    const copy = getCopy();
    if (update.title && this.titleEl) this.titleEl.textContent = update.title;
    if (update.body !== undefined && this.bodyEl)
      this.bodyEl.textContent = update.body;
    if (this.statusEl) {
      const parts: string[] = [];
      if (update.itemIndex && update.totalItems) {
        parts.push(`${update.itemIndex}/${update.totalItems}`);
      }
      if (update.itemTitle) parts.push(update.itemTitle);
      this.statusEl.textContent = parts.join(" - ");
    }
    if (this.barEl) {
      const percent = Math.round(
        Math.max(0, Math.min(1, update.progress ?? 0)) * 100,
      );
      this.barEl.style.width = `${percent}%`;
      this.barEl.style.background =
        update.status === "error"
          ? "#dc2626"
          : update.status === "success"
            ? "#059669"
            : "linear-gradient(90deg, #2563eb, #7c3aed)";
    }
    if (this.metaEl) {
      const meta: string[] = [];
      if (typeof update.completed === "number") {
        meta.push(`${copy.done}: ${update.completed}`);
      }
      if (typeof update.skipped === "number" && update.skipped > 0) {
        meta.push(`${copy.skipped || "Skipped"}: ${update.skipped}`);
      }
      if (typeof update.failed === "number" && update.failed > 0) {
        meta.push(`${copy.failed}: ${update.failed}`);
      }
      if (this.mode === "batch" && typeof update.elapsedMs === "number") {
        meta.push(`${copy.elapsed}: ${formatDuration(update.elapsedMs)}`);
      }
      if (this.mode === "batch" && typeof update.etaMs === "number") {
        meta.push(`${copy.eta}: ${formatDuration(update.etaMs)}`);
      }
      this.metaEl.textContent = meta.join(" · ");
    }
  }

  close(): void {
    this.root?.remove();
    this.root = null;
  }
}
