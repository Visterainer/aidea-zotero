import { GLOBAL_CONVERSATION_KEY_BASE } from "./constants";
import { normalizePositiveInt } from "./normalizers";
import type { GlobalPortalItem } from "./types";

function getSingleLibraryID(values: unknown): number | null {
  if (!Array.isArray(values)) return null;
  const ids = new Set(
    values.map(normalizePositiveInt).filter((id): id is number => id !== null),
  );
  return ids.size === 1 ? [...ids][0] : null;
}

export function resolveActiveLibraryID(): number | null {
  try {
    const pane = Zotero.getActiveZoteroPane?.() as
      | {
          getSelectedLibraryIDs?: () => unknown;
          getSelectedLibraryID?: () => unknown;
          getSelectedItems?: () => Zotero.Item[];
        }
      | undefined;
    try {
      // Zotero 10's singular getter throws, even for a single selection.
      // Prefer the plural API and only use the old getter on older versions.
      const selectedLibraryID = getSingleLibraryID(
        typeof pane?.getSelectedLibraryIDs === "function"
          ? pane.getSelectedLibraryIDs()
          : [pane?.getSelectedLibraryID?.()],
      );
      if (selectedLibraryID) return selectedLibraryID;
    } catch (_err) {
      void _err;
    }

    // A multi-library view has no single scope. Use selected items only when
    // they agree on a library; otherwise keep the personal-library fallback.
    const selectedItems = pane?.getSelectedItems?.() || [];
    const selectedItemLibraryID = getSingleLibraryID(
      selectedItems.map((item) => item?.libraryID),
    );
    if (selectedItemLibraryID) return selectedItemLibraryID;
  } catch (_err) {
    void _err;
  }

  const userLibraryID = normalizePositiveInt(
    (Zotero as unknown as { Libraries?: { userLibraryID?: unknown } }).Libraries
      ?.userLibraryID,
  );
  return userLibraryID;
}

export function createGlobalPortalItem(
  libraryID: number,
  conversationKey: number,
): Zotero.Item {
  const normalizedLibraryID = normalizePositiveInt(libraryID) || 1;
  const normalizedConversationKey =
    normalizePositiveInt(conversationKey) || GLOBAL_CONVERSATION_KEY_BASE;
  const portalItem: GlobalPortalItem = {
    __llmGlobalPortalItem: true,
    id: normalizedConversationKey,
    libraryID: normalizedLibraryID,
    parentID: undefined,
    attachmentContentType: "",
    isAttachment: () => false,
    isRegularItem: () => false,
    getAttachments: () => [],
    getField: (field: string) => {
      if (field === "title") return "Global Library Portal";
      if (field === "libraryCatalog") return "Library";
      return "";
    },
  };
  return portalItem as unknown as Zotero.Item;
}

export function isGlobalPortalItem(item: unknown): item is GlobalPortalItem {
  if (!item || typeof item !== "object") return false;
  const typed = item as Partial<GlobalPortalItem>;
  if (typed.__llmGlobalPortalItem !== true) return false;
  const normalizedId = normalizePositiveInt(typed.id);
  return Boolean(normalizedId && normalizedId >= GLOBAL_CONVERSATION_KEY_BASE);
}
