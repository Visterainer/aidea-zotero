/**
 * Resolve one Zotero item while hiding Zotero's `false` sentinel from callers.
 *
 * Zotero returns `false` when an item ID cannot be resolved. Normalizing that
 * value at this boundary keeps the rest of the application on the conventional
 * `Item | null` contract.
 */
export function getZoteroItem(itemID: number | string): Zotero.Item | null {
  return Zotero.Items.get(itemID) || null;
}
