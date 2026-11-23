import { HTML_NS } from "../../utils/domHelpers";
import { getPanelI18n } from "./i18n";

function estimateDataUrlByteLength(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return dataUrl.length;
  const payloadLength = dataUrl.length - commaIndex - 1;
  return Math.max(0, Math.floor((payloadLength * 3) / 4));
}

async function optimizeImageDataUrl(
  win: Window,
  dataUrl: string,
): Promise<string> {
  const maxDimension = 2048;
  const maxLosslessBytes = 2 * 1024 * 1024;
  const maxPassthroughBytes = 4 * 1024 * 1024;
  const jpegQuality = 0.88;

  try {
    const ImageCtor = win.Image as typeof Image;
    const img = new ImageCtor();
    img.src = dataUrl;
    await img.decode();

    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return dataUrl;

    const sourceBytes = estimateDataUrlByteLength(dataUrl);
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const needsResize = targetWidth !== width || targetHeight !== height;

    // Keep already-small images untouched to avoid unnecessary quality loss.
    if (!needsResize && sourceBytes <= maxLosslessBytes) {
      return dataUrl;
    }

    const canvas = win.document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    try {
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return dataUrl;

      ctx.imageSmoothingEnabled = true;
      (
        ctx as CanvasRenderingContext2D & {
          imageSmoothingQuality?: "low" | "medium" | "high";
        }
      ).imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Prefer lossless encoding for charts/figures when the payload is manageable.
      const pngDataUrl = canvas.toDataURL("image/png");
      if (estimateDataUrlByteLength(pngDataUrl) <= maxLosslessBytes) {
        return pngDataUrl;
      }
      if (!needsResize && sourceBytes <= maxPassthroughBytes) {
        return dataUrl;
      }
      return canvas.toDataURL("image/jpeg", jpegQuality);
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } catch (err) {
    ztoolkit.log("Screenshot optimize failed:", err);
    return dataUrl;
  }
}

/**
 * Screenshot selection overlay for capturing regions from the PDF reader
 */
async function captureScreenshotSelection(win: Window): Promise<string | null> {
  return new Promise((resolve) => {
    const doc = win.document;
    const i18n = getPanelI18n();

    // Find the appropriate container (body for HTML, documentElement for XUL)
    const container = doc.body || doc.documentElement;
    if (!container) {
      ztoolkit.log("Screenshot: No container found");
      resolve(null);
      return;
    }

    // Cancel any pre-existing capture overlay before mounting a new one.
    const existingOverlay = doc.getElementById("llm-screenshot-overlay") as
      (HTMLElement & { __llmCancelScreenshot?: () => void }) | null;
    if (existingOverlay) {
      existingOverlay.__llmCancelScreenshot?.();
      existingOverlay.remove();
    }

    // Create overlay with inline styles using HTML namespace
    const overlay = doc.createElementNS(HTML_NS, "div") as HTMLDivElement & {
      __llmCancelScreenshot?: () => void;
    };
    overlay.id = "llm-screenshot-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      width: "100vw",
      height: "100vh",
      zIndex: "10000",
      cursor: "crosshair",
      background: "rgba(0, 0, 0, 0.3)",
    });

    // Instructions
    const instructions = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
    Object.assign(instructions.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0, 0, 0, 0.8)",
      color: "white",
      padding: "12px 20px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      zIndex: "10001",
      pointerEvents: "none",
    });
    instructions.textContent = i18n.screenshotSelectionInstruction;

    // Cancel button
    const cancelBtn = doc.createElementNS(
      HTML_NS,
      "button",
    ) as HTMLButtonElement;
    Object.assign(cancelBtn.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#dc2626",
      color: "white",
      border: "none",
      padding: "10px 24px",
      borderRadius: "8px",
      fontSize: "14px",
      fontWeight: "500",
      cursor: "pointer",
      zIndex: "10001",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      lineHeight: "1",
      minWidth: "120px",
    });
    cancelBtn.textContent = i18n.cancelEsc;

    // Selection rectangle
    const selection = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
    Object.assign(selection.style, {
      position: "absolute",
      border: "2px dashed #2563eb",
      background: "rgba(37, 99, 235, 0.2)",
      pointerEvents: "none",
      display: "none",
    });

    overlay.append(instructions, cancelBtn, selection);

    try {
      container.appendChild(overlay);
      ztoolkit.log("Screenshot: Overlay appended to", container.tagName);
    } catch (err) {
      ztoolkit.log("Screenshot: Failed to append overlay", err);
      resolve(null);
      return;
    }

    let startX = 0;
    let startY = 0;
    let isSelecting = false;
    let isReady = false;
    let resolved = false;
    let readyTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (readyTimer !== null) {
        clearTimeout(readyTimer);
        readyTimer = null;
      }
      if (overlay.parentNode) {
        overlay.remove();
      }
      doc.removeEventListener("keydown", onKeyDown);
      win.removeEventListener("mousemove", onMouseMove);
      win.removeEventListener("mouseup", onMouseUp);
    };

    const safeResolve = (value: string | null, reason: string) => {
      if (resolved) return;
      resolved = true;
      ztoolkit.log(
        "Screenshot: Resolving with",
        value ? "image" : "null",
        "-",
        reason,
      );
      cleanup();
      resolve(value);
    };
    overlay.__llmCancelScreenshot = () =>
      safeResolve(null, "Replaced by new capture");

    const onKeyDown = (e: KeyboardEvent) => {
      ztoolkit.log("Screenshot: Key pressed:", e.key);
      if (e.key === "Escape") {
        safeResolve(null, "Escape pressed");
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isSelecting) return;
      e.preventDefault();
      const currentX = e.clientX;
      const currentY = e.clientY;

      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      selection.style.left = `${left}px`;
      selection.style.top = `${top}px`;
      selection.style.width = `${width}px`;
      selection.style.height = `${height}px`;
    };

    const onMouseUp = async (e: MouseEvent) => {
      ztoolkit.log(
        "Screenshot: mouseup, isReady:",
        isReady,
        "isSelecting:",
        isSelecting,
      );
      if (!isReady) {
        ztoolkit.log("Screenshot: Ignoring mouseup - not ready yet");
        return;
      }
      if (!isSelecting || e.button !== 0) {
        ztoolkit.log("Screenshot: Ignoring mouseup - not selecting");
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      isSelecting = false;

      const endX = e.clientX;
      const endY = e.clientY;

      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      ztoolkit.log("Screenshot: Selection size:", width, "x", height);

      // Minimum selection size - just reset if too small
      if (width < 20 || height < 20) {
        ztoolkit.log("Screenshot: Selection too small, resetting");
        selection.style.display = "none";
        return;
      }

      // Hide overlay before capture
      overlay.style.display = "none";

      try {
        const dataUrl = await captureRegion(win, left, top, width, height);
        safeResolve(dataUrl, "Capture complete");
      } catch (err) {
        ztoolkit.log("Screenshot capture failed:", err);
        safeResolve(null, "Capture error");
      }
    };

    doc.addEventListener("keydown", onKeyDown);
    win.addEventListener("mousemove", onMouseMove);
    win.addEventListener("mouseup", onMouseUp);

    cancelBtn.addEventListener("click", (e: MouseEvent) => {
      ztoolkit.log("Screenshot: Cancel button clicked");
      e.preventDefault();
      e.stopPropagation();
      safeResolve(null, "Cancel clicked");
    });

    // Wait before accepting mouse events to prevent button click from triggering
    readyTimer = setTimeout(() => {
      readyTimer = null;
      isReady = true;
      ztoolkit.log("Screenshot: Now ready for selection");
    }, 200);

    overlay.addEventListener("mousedown", (e: MouseEvent) => {
      ztoolkit.log(
        "Screenshot: mousedown, isReady:",
        isReady,
        "target:",
        (e.target as Element)?.tagName,
      );
      if (!isReady) {
        ztoolkit.log("Screenshot: Ignoring mousedown - not ready yet");
        return;
      }
      if (e.button !== 0 || e.target === cancelBtn) return;
      e.preventDefault();
      e.stopPropagation();
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selection.style.left = `${startX}px`;
      selection.style.top = `${startY}px`;
      selection.style.width = "0px";
      selection.style.height = "0px";
      selection.style.display = "block";
      ztoolkit.log("Screenshot: Selection started at", startX, startY);
    });
  });
}

type CaptureBounds = Pick<DOMRect, "left" | "top" | "right" | "bottom">;
type ReaderFrame = Element & {
  contentDocument?: Document | null;
  clientLeft: number;
  clientTop: number;
};

function intersectBounds(
  a: CaptureBounds,
  b: CaptureBounds,
): CaptureBounds | null {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

function findActiveReaderFrame(
  win: Window,
  selection: CaptureBounds,
): ReaderFrame | null {
  const selectedTabId = win.Zotero_Tabs?.selectedID;
  const reader = selectedTabId
    ? Zotero.Reader.getByTabID?.(selectedTabId)
    : Zotero.Reader._readers?.find((reader) => reader._window === win);
  const activeFrame = (reader?._iframe ??
    reader?._iframeWindow?.frameElement) as ReaderFrame | null | undefined;
  if (activeFrame?.contentDocument)
    return intersectBounds(activeFrame.getBoundingClientRect(), selection)
      ? activeFrame
      : null;

  // Older Zotero versions and detached readers may not expose the reader
  // instance. Use the frame containing the largest part of the selection.
  let bestFrame: ReaderFrame | null = null;
  let bestArea = 0;
  for (const frame of win.document.querySelectorAll<ReaderFrame>(
    'browser.reader, iframe[src*="reader"]',
  )) {
    if (!frame.contentDocument) continue;
    const overlap = intersectBounds(frame.getBoundingClientRect(), selection);
    if (!overlap) continue;
    const area =
      (overlap.right - overlap.left) * (overlap.bottom - overlap.top);
    if (area <= bestArea) continue;
    bestArea = area;
    bestFrame = frame;
  }
  return bestFrame;
}

function collectPdfCanvases(
  doc: Document,
  offsetX: number,
  offsetY: number,
  clip: CaptureBounds,
): Array<{
  canvas: HTMLCanvasElement;
  rect: CaptureBounds & { width: number; height: number };
  clip: CaptureBounds;
}> {
  const canvases = Array.from<HTMLCanvasElement>(
    doc.querySelectorAll<HTMLCanvasElement>(
      ".pdfViewer canvas, .canvasWrapper canvas, canvas.pdfViewer",
    ),
  ).map((canvas) => {
    const { left, top, right, bottom, width, height } =
      canvas.getBoundingClientRect();
    return {
      canvas,
      rect: {
        left: left + offsetX,
        top: top + offsetY,
        right: right + offsetX,
        bottom: bottom + offsetY,
        width,
        height,
      },
      clip,
    };
  });
  // The outer Zotero reader contains one PDF.js iframe per visible view.
  // Canvas coordinates in each view are local to that iframe.
  for (const frame of doc.querySelectorAll<ReaderFrame>(
    'iframe[src*="pdf/web/viewer.html"]',
  )) {
    if (!frame.contentDocument) continue;
    const rect = frame.getBoundingClientRect();
    const left = offsetX + rect.left + frame.clientLeft;
    const top = offsetY + rect.top + frame.clientTop;
    const frameClip = intersectBounds(clip, {
      left,
      top,
      right: left + frame.clientWidth,
      bottom: top + frame.clientHeight,
    });
    if (frameClip)
      canvases.push(
        ...collectPdfCanvases(frame.contentDocument, left, top, frameClip),
      );
  }
  return canvases;
}

/**
 * Capture a region of the window using canvas
 */
async function captureRegion(
  win: Window,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<string | null> {
  try {
    const selection = { left: x, top: y, right: x + width, bottom: y + height };
    const frame = findActiveReaderFrame(win, selection);
    const outer = frame?.getBoundingClientRect();
    const offsetX = outer && frame ? outer.left + frame.clientLeft : 0;
    const offsetY = outer && frame ? outer.top + frame.clientTop : 0;
    const clip = outer ? intersectBounds(selection, outer) : selection;
    const overlaps = clip
      ? collectPdfCanvases(
          frame?.contentDocument || win.document,
          offsetX,
          offsetY,
          clip,
        ).flatMap(({ canvas, rect, clip }) => {
          if (!canvas.width || !canvas.height || !rect.width || !rect.height)
            return [];
          const area = intersectBounds(rect, clip);
          return area
            ? [
                {
                  canvas,
                  rect,
                  area,
                  scaleX: canvas.width / rect.width,
                  scaleY: canvas.height / rect.height,
                },
              ]
            : [];
        })
      : [];

    if (overlaps.length) {
      const outScaleX = overlaps[0].scaleX;
      const outScaleY = overlaps[0].scaleY;
      const outWidth = Math.max(1, Math.round(width * outScaleX));
      const outHeight = Math.max(1, Math.round(height * outScaleY));
      const tempCanvas = win.document.createElement(
        "canvas",
      ) as HTMLCanvasElement;
      tempCanvas.width = outWidth;
      tempCanvas.height = outHeight;
      try {
        const ctx = tempCanvas.getContext(
          "2d",
        ) as CanvasRenderingContext2D | null;
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, outWidth, outHeight);
          for (const hit of overlaps) {
            const { left, top, right, bottom } = hit.area;
            const srcX = Math.max(0, (left - hit.rect.left) * hit.scaleX);
            const srcY = Math.max(0, (top - hit.rect.top) * hit.scaleY);
            const srcW = Math.min(
              (right - left) * hit.scaleX,
              hit.canvas.width - srcX,
            );
            const srcH = Math.min(
              (bottom - top) * hit.scaleY,
              hit.canvas.height - srcY,
            );
            if (srcW <= 0 || srcH <= 0) continue;
            const dstX = (left - x) * outScaleX;
            const dstY = (top - y) * outScaleY;
            const dstW = (right - left) * outScaleX;
            const dstH = (bottom - top) * outScaleY;
            ctx.drawImage(
              hit.canvas,
              srcX,
              srcY,
              srcW,
              srcH,
              dstX,
              dstY,
              dstW,
              dstH,
            );
          }
          return tempCanvas.toDataURL("image/png");
        }
      } finally {
        tempCanvas.width = 0;
        tempCanvas.height = 0;
      }
    }

    // EPUB content lives inside a srcdoc iframe. Snap each visible view
    // directly so reader controls and the selection popup cannot cover it.
    const canvas = win.document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    try {
      const ctx = canvas.getContext("2d") as
        | (CanvasRenderingContext2D & {
            drawWindow?: (
              target: Window,
              x: number,
              y: number,
              width: number,
              height: number,
              background: string,
            ) => void;
          })
        | null;
      if (!ctx?.drawWindow) return null;
      const views =
        frame?.contentDocument?.querySelectorAll<HTMLIFrameElement>(
          "iframe[srcdoc]",
        );
      let drewView = false;
      if (views && clip) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        for (const view of views) {
          const target = view.contentWindow;
          if (!target) continue;
          const rect = view.getBoundingClientRect();
          const left = offsetX + rect.left + view.clientLeft;
          const top = offsetY + rect.top + view.clientTop;
          const area = intersectBounds(clip, {
            left,
            top,
            right: left + view.clientWidth,
            bottom: top + view.clientHeight,
          });
          if (!area) continue;
          ctx.save();
          try {
            ctx.translate(area.left - x, area.top - y);
            ctx.drawWindow(
              target,
              area.left - left + target.scrollX,
              area.top - top + target.scrollY,
              area.right - area.left,
              area.bottom - area.top,
              "white",
            );
            drewView = true;
          } finally {
            ctx.restore();
          }
        }
      }
      if (!drewView) ctx.drawWindow(win, x, y, width, height, "white");
      return canvas.toDataURL("image/png");
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } catch (err) {
    ztoolkit.log("Capture region error:", err);
    return null;
  }
}

export { optimizeImageDataUrl, captureScreenshotSelection, captureRegion };
