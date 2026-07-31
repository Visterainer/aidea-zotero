import { config } from "../../../package.json";
import { getZoteroItem } from "../../utils/zoteroItems";
import {
  isAuthorProfileRunInProgress,
  runAuthorProfileGeneration,
} from "./batchRunner";
import { getAuthorProfileCopy } from "./i18n";
import { getAuthorProfileLanguage, getBoolPref } from "./utils";

const MENU_ID = `${config.addonRef}-author-profiles-context-menu`;
const MENU_ICON = `chrome://${config.addonRef}/content/icons/icon-20.png`;

let registered = false;

function resolveProcessableItem(item: Zotero.Item): Zotero.Item | null {
  if (!item) return null;
  if (item.isRegularItem?.()) return item;
  if (item.isAttachment?.() && item.parentID) {
    return getZoteroItem(item.parentID);
  }
  return null;
}

function uniqueProcessableItems(items?: Zotero.Item[]): Zotero.Item[] {
  const out: Zotero.Item[] = [];
  const seen = new Set<number>();
  for (const rawItem of items || []) {
    const item = resolveProcessableItem(rawItem);
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function labelForCount(count: number): string {
  const copy = getAuthorProfileCopy(getAuthorProfileLanguage());
  return count > 1 ? copy.menuBatch(count) : copy.menuSingle;
}

export function registerAuthorProfileMenu(): void {
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
          const items = uniqueProcessableItems(context.items);
          const enabledByPref = getBoolPref(
            "authorProfiles.contextMenuEnabled",
            false,
          );
          const visible = enabledByPref && items.length > 0;
          context.setVisible(visible);
          context.setEnabled(visible && !isAuthorProfileRunInProgress());
          context.setIcon(MENU_ICON);
          context.menuElem.setAttribute("label", labelForCount(items.length));
        },
        onCommand: (_event, context) => {
          const items = uniqueProcessableItems(context.items);
          void runAuthorProfileGeneration(items);
        },
      },
    ],
  });
  registered = Boolean(result);
}

export function unregisterAuthorProfileMenu(): void {
  if (!registered || !(Zotero as any).MenuManager?.unregisterMenu) return;
  try {
    Zotero.MenuManager.unregisterMenu(MENU_ID);
  } catch (err) {
    ztoolkit?.log?.("AIdea: failed to unregister author profile menu", err);
  } finally {
    registered = false;
  }
}
