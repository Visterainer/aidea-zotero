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
      if (!isSelecting) {
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
      if (e.target === cancelBtn) return;
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

function findActiveReaderFrame(
  win: Window,
  x: number,
  y: number,
  width: number,
  height: number,
): HTMLIFrameElement | null {
  try {
    const selectedTabId = (
      win as unknown as { Zotero_Tabs?: { selectedID?: string } }
    ).Zotero_Tabs?.selectedID;
    const activeReader = selectedTabId
      ? (
          Zotero as unknown as {
            Reader?: {
              getByTabID?: (tabId: string) => {
                _iframeWindow?: { frameElement?: HTMLIFrameElement };
              } | null;
            };
          }
        ).Reader?.getByTabID?.(selectedTabId)
      : null;
    const activeFrame = activeReader?._iframeWindow?.frameElement;
    if (activeFrame?.contentDocument) {
      const rect = activeFrame.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return activeFrame;
    }
  } catch {
    /* fall back to visible frame matching selection bounds */
  }

  const frames = Array.from(
    win.document.querySelectorAll('iframe[src*="reader"]'),
  ) as HTMLIFrameElement[];
  const selRight = x + width;
  const selBottom = y + height;
  let bestFrame: HTMLIFrameElement | null = null;
  let bestOverlap = 0;
  for (const frame of frames) {
    if (!frame.contentDocument) continue;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const overlapW = Math.max(
      0,
      Math.min(selRight, rect.right) - Math.max(x, rect.left),
    );
    const overlapH = Math.max(
      0,
      Math.min(selBottom, rect.bottom) - Math.max(y, rect.top),
    );
    const overlap = overlapW * overlapH;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestFrame = frame;
    }
  }
  return bestFrame;
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
    const readerFrame = findActiveReaderFrame(win, x, y, width, height);
    const targetDoc = readerFrame?.contentDocument || win.document;
    const frameRect = readerFrame
      ? readerFrame.getBoundingClientRect()
      : { left: 0, top: 0 };
    const selLeft = x - frameRect.left;
    const selTop = y - frameRect.top;
    const selRight = selLeft + width;
    const selBottom = selTop + height;

    const canvases = Array.from(
      targetDoc.querySelectorAll(
        ".pdfViewer canvas, .canvasWrapper canvas, canvas.pdfViewer",
      ),
    ) as HTMLCanvasElement[];

    type CanvasOverlap = {
      canvas: HTMLCanvasElement;
      rect: DOMRect;
      ix0: number;
      iy0: number;
      ix1: number;
      iy1: number;
      scaleX: number;
      scaleY: number;
    };
    const overlaps: CanvasOverlap[] = [];
    for (const pdfCanvas of canvases) {
      if (pdfCanvas.width <= 0 || pdfCanvas.height <= 0) continue;
      const rect = pdfCanvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const ix0 = Math.max(selLeft, rect.left);
      const iy0 = Math.max(selTop, rect.top);
      const ix1 = Math.min(selRight, rect.right);
      const iy1 = Math.min(selBottom, rect.bottom);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      overlaps.push({
        canvas: pdfCanvas,
        rect,
        ix0,
        iy0,
        ix1,
        iy1,
        scaleX: pdfCanvas.width / rect.width,
        scaleY: pdfCanvas.height / rect.height,
      });
    }

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
            const srcX = Math.max(0, (hit.ix0 - hit.rect.left) * hit.scaleX);
            const srcY = Math.max(0, (hit.iy0 - hit.rect.top) * hit.scaleY);
            const srcW = Math.min(
              (hit.ix1 - hit.ix0) * hit.scaleX,
              hit.canvas.width - srcX,
            );
            const srcH = Math.min(
              (hit.iy1 - hit.iy0) * hit.scaleY,
              hit.canvas.height - srcY,
            );
            if (srcW <= 0 || srcH <= 0) continue;
            const dstX = (hit.ix0 - selLeft) * outScaleX;
            const dstY = (hit.iy0 - selTop) * outScaleY;
            const dstW = (hit.ix1 - hit.ix0) * outScaleX;
            const dstH = (hit.iy1 - hit.iy0) * outScaleY;
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

    // Fallback: use Firefox's drawWindow if available
    ztoolkit.log("No PDF canvas found, using fallback capture");

    const canvas = win.document.createElement("canvas") as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    try {
      const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
      if (!ctx) return null;

      if ("drawWindow" in ctx) {
        try {
          (
            ctx as CanvasRenderingContext2D & {
              drawWindow: (
                win: Window,
                x: number,
                y: number,
                w: number,
                h: number,
                bg: string,
              ) => void;
            }
          ).drawWindow(win, x, y, width, height, "white");
          return canvas.toDataURL("image/png");
        } catch (err) {
          ztoolkit.log("drawWindow failed:", err);
        }
      }

      return null;
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
