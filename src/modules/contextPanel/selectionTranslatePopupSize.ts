export function getSelectionTranslateSingleLineHeight(params: {
  fontSize: number;
  lineHeight: number;
  paddingY?: number;
  borderWidth?: number;
}): number {
  const { fontSize, lineHeight, paddingY = 10, borderWidth = 1 } = params;
  const textLineHeight = Math.max(0, fontSize) * Math.max(0, lineHeight);
  return Math.ceil(
    textLineHeight + Math.max(0, paddingY) * 2 + Math.max(0, borderWidth) * 2,
  );
}

export function getSelectionTranslateContentHeight(params: {
  contentHeight: number;
  minimumHeight: number;
  heightCap: number;
}): number {
  const minimumHeight = Math.max(0, params.minimumHeight);
  const heightCap = Math.max(minimumHeight, params.heightCap);
  return Math.min(heightCap, Math.max(minimumHeight, params.contentHeight));
}

export function getSelectionTranslateDefaultHeightCap(params: {
  viewerHeight: number;
  minimumHeight: number;
}): number {
  const minimumHeight = Math.max(0, params.minimumHeight);
  return Math.max(
    minimumHeight,
    Math.min(320, Math.round(Math.max(0, params.viewerHeight) * 0.42)),
  );
}

export function resolveSelectionTranslateContentHeight(params: {
  contentHeight: number;
  viewerHeight: number;
  minimumHeight: number;
  rememberedHeight: number | null;
}): number {
  const heightCap =
    params.rememberedHeight === null
      ? getSelectionTranslateDefaultHeightCap(params)
      : Math.max(params.minimumHeight, params.rememberedHeight);
  return getSelectionTranslateContentHeight({
    contentHeight: params.contentHeight,
    minimumHeight: params.minimumHeight,
    heightCap,
  });
}

export function getSelectionTranslateMeasuredHeight(params: {
  boundingHeight: number;
  offsetHeight: number;
  scrollHeight: number;
  minimumHeight: number;
}): number {
  return Math.max(
    Math.max(0, params.minimumHeight),
    Math.ceil(
      Math.max(params.boundingHeight, params.offsetHeight, params.scrollHeight),
    ),
  );
}

export function scheduleSelectionTranslateLayout<T>(params: {
  scheduleFrame: (callback: () => void) => void;
  readLayoutState: () => T;
  applyLayout: (state: T) => void;
}): void {
  // Read state inside the deferred callback so an older queued relayout cannot
  // replay the height that was current when it was scheduled.
  params.scheduleFrame(() => {
    params.applyLayout(params.readLayoutState());
  });
}
