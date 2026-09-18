type Rect = { left: number; top: number; width: number; height: number };
type Target = {
  getClientRects?: () => ArrayLike<Rect>;
  toRange?: () => Target;
  collapsed?: boolean;
  startContainer?: Node;
  startOffset?: number;
};

/** Optional Zotero internals: absent capabilities leave native navigation alone. */
export type EpubNavigationView = {
  initializedPromise?: Promise<unknown>;
  _getHrefTarget?: (href: string) => Target | null;
  getRange?: (cfi: string) => Target | null;
  getCFI?: (range: Range) => { toString(): string } | null;
  _iframeWindow?: { innerWidth: number; innerHeight: number };
  flow?: {
    _isVertical?: boolean;
    _spreadWidth?: number;
    _spreadHeight?: number;
    _offsetLeft?: number;
    _offsetTop?: number;
    _setOffset?: (left: number, top: number) => void;
    _refreshUserAnchor?: () => void;
    _onViewUpdate?: () => void;
  };
  navigateToNextPage?: () => void;
};

/** Element-boundary CFIs have no rectangle; resolve to their first text position. */
export function resolveEpubNavigationLocation(
  view: EpubNavigationView | undefined,
  location: { href?: string; pageNumber?: string },
): typeof location {
  if (!location.pageNumber?.startsWith("epubcfi(") || !view?.getCFI)
    return location;
  try {
    let target = view.getRange?.(location.pageNumber);
    if (target?.toRange) target = target.toRange();
    if (!target?.collapsed || target.startContainer?.nodeType !== 1)
      return location;
    const root = target.startContainer.childNodes[target.startOffset || 0];
    const doc = root?.ownerDocument;
    if (!root || !doc) return location;
    const walker = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
    let text = root.nodeType === 3 ? root : walker.nextNode();
    while (text && !text.textContent?.trim()) text = walker.nextNode();
    if (!text) return location;
    const range = doc.createRange();
    range.setStart(text, 0);
    range.collapse(true);
    const cfi = view.getCFI(range)?.toString();
    return cfi?.startsWith("epubcfi(") ? { pageNumber: cfi } : location;
  } catch {
    return location;
  }
}

/**
 * Zotero's paginated EPUB flow floors the target coordinate divided by a spread
 * measured with integer offsetWidth/Height. Fractional CSS column widths can
 * leave a boundary anchor on the next spread. Correct only that observed case,
 * using native pagination once; never change reader layout or document styles.
 */
export function correctEpubPageBoundary(
  view: EpubNavigationView | undefined,
  location: { href?: string; pageNumber?: string },
): boolean {
  if (!view?.navigateToNextPage || !view.flow || !view._iframeWindow)
    return false;
  try {
    const vertical = view.flow._isVertical === true;
    const spread = vertical ? view.flow._spreadHeight : view.flow._spreadWidth;
    const viewport = vertical
      ? view._iframeWindow.innerHeight
      : view._iframeWindow.innerWidth;
    // Scrolled EPUB views do not expose a paginated spread size.
    if (!Number.isFinite(spread) || !spread || spread <= 0 || viewport <= 0)
      return false;
    let target = location.href
      ? view._getHrefTarget?.(location.href)
      : location.pageNumber?.startsWith("epubcfi(")
        ? view.getRange?.(location.pageNumber)
        : null;
    if (target?.toRange) target = target.toRange();
    const rect = Array.from(target?.getClientRects?.() || []).find(
      (r) => r.width > 0 || r.height > 0,
    );
    if (!rect) return false;
    const start = vertical ? rect.top : rect.left;
    // The anchor must be outside this viewport and inside exactly the next
    // spread. Do not turn pages for visible anchors or arbitrary bad positions.
    if (start < viewport || start - spread < 0 || start - spread >= viewport)
      return false;
    view.navigateToNextPage();
    const current = () => {
      const r = Array.from(target?.getClientRects?.() || []).find(
        (r) => r.width > 0 || r.height > 0,
      );
      return r ? (vertical ? r.top : r.left) : undefined;
    };
    // At a short book's final spread, Zotero's rounded end-of-section test can
    // also refuse Next despite a visible next-column anchor. Use the same native
    // offset/anchor/update operations only if Next left the target unmoved.
    const flow = view.flow;
    if (
      current() === start &&
      flow._setOffset &&
      flow._refreshUserAnchor &&
      flow._onViewUpdate &&
      Number.isFinite(flow._offsetLeft) &&
      Number.isFinite(flow._offsetTop)
    ) {
      flow._setOffset(
        flow._offsetLeft! + (vertical ? 0 : spread),
        flow._offsetTop! + (vertical ? spread : 0),
      );
      flow._refreshUserAnchor();
      flow._onViewUpdate();
    }
    const end = current();
    return end !== undefined && end >= 0 && end < viewport;
  } catch {
    ztoolkit.log("LLM: EPUB boundary correction unavailable");
    return false;
  }
}
