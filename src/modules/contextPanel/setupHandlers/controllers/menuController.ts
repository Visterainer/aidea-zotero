export const MODEL_MENU_OPEN_CLASS = "llm-model-menu-open";
export const RETRY_MODEL_MENU_OPEN_CLASS = "llm-model-menu-open";
export const SLASH_MENU_OPEN_CLASS = "llm-slash-menu-open";

const CONTEXT_MENU_Z_INDEX = "var(--llm-z-context-menu, 190)";
const MODEL_MENU_Z_INDEX = "var(--llm-z-model-menu, 180)";

export function setFloatingMenuOpen(
  menu: HTMLDivElement | null,
  openClass: string,
  isOpen: boolean,
): void {
  if (!menu) return;
  if (isOpen) {
    menu.style.display = "grid";
    menu.classList.add(openClass);
    return;
  }
  menu.classList.remove(openClass);
  menu.style.display = "none";
}

export function isFloatingMenuOpen(menu: HTMLDivElement | null): boolean {
  return Boolean(menu && menu.style.display !== "none");
}

export function positionFloatingMenu(
  owner: Element,
  menu: HTMLDivElement,
  anchor: HTMLButtonElement,
): void {
  const win = owner.ownerDocument?.defaultView;
  if (!win) return;

  const viewportMargin = 8;
  const gap = 6;
  const minUsableHeight = 96;

  menu.style.position = "fixed";
  menu.style.display = "grid";
  menu.style.visibility = "hidden";
  menu.style.zIndex = menu.classList.contains("llm-response-menu")
    ? CONTEXT_MENU_Z_INDEX
    : MODEL_MENU_Z_INDEX;
  menu.style.maxHeight = `${Math.max(
    minUsableHeight,
    win.innerHeight - viewportMargin * 2,
  )}px`;
  menu.style.overflowY = "auto";

  const anchorRect = anchor.getBoundingClientRect();
  const initialMenuRect = menu.getBoundingClientRect();
  const availableBelow = Math.max(
    0,
    win.innerHeight - viewportMargin - (anchorRect.bottom + gap),
  );
  const availableAbove = Math.max(0, anchorRect.top - gap - viewportMargin);
  const opensBelow =
    initialMenuRect.height <= availableBelow ||
    availableBelow >= availableAbove;
  const availableHeight = opensBelow ? availableBelow : availableAbove;
  menu.style.maxHeight = `${Math.max(
    minUsableHeight,
    Math.min(win.innerHeight - viewportMargin * 2, availableHeight),
  )}px`;
  const menuRect = menu.getBoundingClientRect();

  let left = anchorRect.left;
  const maxLeft = Math.max(
    viewportMargin,
    win.innerWidth - menuRect.width - viewportMargin,
  );
  left = Math.min(Math.max(viewportMargin, left), maxLeft);

  const unclampedTop = opensBelow
    ? anchorRect.bottom + gap
    : anchorRect.top - gap - menuRect.height;
  const maxTop = Math.max(
    viewportMargin,
    win.innerHeight - menuRect.height - viewportMargin,
  );
  const top = Math.min(Math.max(viewportMargin, unclampedTop), maxTop);

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
  menu.style.visibility = "visible";
}
