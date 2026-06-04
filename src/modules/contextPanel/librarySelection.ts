export type LibrarySelectionState = "empty" | "single" | "multiple";
export type LibraryPanelNativeMode = "item" | "message";
export type LibraryStandalonePanelPlacement = "replace" | "append" | null;

export interface LibraryPanelDisplayState {
  selectionState: LibrarySelectionState;
  nativeMode: LibraryPanelNativeMode;
  managedSectionEnabled: boolean;
  standaloneButtonVisible: boolean;
  standalonePanelVisible: boolean;
  standalonePanelPlacement: LibraryStandalonePanelPlacement;
}

export interface LibraryPanelDisplayResolution {
  displayState: LibraryPanelDisplayState;
  manualStandaloneActive: boolean;
  selectionChanged: boolean;
}

type LibrarySelectionItemLike =
  | {
      id?: unknown;
    }
  | null
  | undefined;

function normalizeItemId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isFinite(id) || id <= 0) return null;
  return Math.floor(id);
}

export function getLibrarySelectedItemIds(
  items: readonly LibrarySelectionItemLike[] | null | undefined,
): number[] {
  const ids = new Set<number>();
  for (const item of items || []) {
    const id = normalizeItemId(item?.id);
    if (id) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

export function getLibrarySelectionState(
  items: readonly LibrarySelectionItemLike[] | null | undefined,
): LibrarySelectionState {
  const count = getLibrarySelectedItemIds(items).length;
  if (count <= 0) return "empty";
  return count === 1 ? "single" : "multiple";
}

export function getLibraryPanelDisplayState(
  selectionState: LibrarySelectionState,
  manualStandaloneActive: boolean = false,
): LibraryPanelDisplayState {
  void manualStandaloneActive;

  if (selectionState === "single") {
    return {
      selectionState,
      nativeMode: "item",
      managedSectionEnabled: true,
      standaloneButtonVisible: false,
      standalonePanelVisible: false,
      standalonePanelPlacement: null,
    };
  }

  if (selectionState === "empty") {
    return {
      selectionState,
      nativeMode: "message",
      managedSectionEnabled: false,
      standaloneButtonVisible: true,
      standalonePanelVisible: true,
      standalonePanelPlacement: "replace",
    };
  }

  return {
    selectionState,
    nativeMode: "message",
    managedSectionEnabled: false,
    standaloneButtonVisible: true,
    standalonePanelVisible: true,
    standalonePanelPlacement: "append",
  };
}

export function resolveLibraryPanelDisplayState(params: {
  selectionState: LibrarySelectionState;
  selectionSignature: string;
  previousSelectionState?: LibrarySelectionState;
  previousSelectionSignature?: string;
  manualStandaloneActive?: boolean;
}): LibraryPanelDisplayResolution {
  const selectionChanged =
    params.previousSelectionState !== undefined &&
    params.previousSelectionSignature !== undefined &&
    (params.previousSelectionState !== params.selectionState ||
      params.previousSelectionSignature !== params.selectionSignature);
  const manualStandaloneActive = selectionChanged
    ? false
    : Boolean(params.manualStandaloneActive);

  return {
    displayState: getLibraryPanelDisplayState(
      params.selectionState,
      manualStandaloneActive,
    ),
    manualStandaloneActive,
    selectionChanged,
  };
}

export function isManagedLibraryPanelSectionEnabled(
  selectionState: LibrarySelectionState,
): boolean {
  return getLibraryPanelDisplayState(selectionState).managedSectionEnabled;
}

export function getLibrarySelectedItemIdsFromWindow(win: unknown): number[] {
  try {
    const pane = (win as { ZoteroPane?: { getSelectedItems?: () => unknown } })
      ?.ZoteroPane;
    const items = pane?.getSelectedItems?.();
    return Array.isArray(items) ? getLibrarySelectedItemIds(items) : [];
  } catch (_err) {
    void _err;
    return [];
  }
}

export function getLibrarySelectionStateFromWindow(
  win: unknown,
): LibrarySelectionState {
  try {
    const pane = (win as { ZoteroPane?: { getSelectedItems?: () => unknown } })
      ?.ZoteroPane;
    const items = pane?.getSelectedItems?.();
    return Array.isArray(items) ? getLibrarySelectionState(items) : "empty";
  } catch (_err) {
    void _err;
    return "empty";
  }
}
