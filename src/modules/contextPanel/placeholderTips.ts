import type { PanelI18n } from "./i18n";

export type ChatPlaceholderMode = "global" | "paper";

export function getChatPlaceholderTips(
  i18n: PanelI18n,
  mode: ChatPlaceholderMode,
): readonly string[] {
  return mode === "paper"
    ? i18n.placeholderPaperTips
    : i18n.placeholderGlobalTips;
}

export function pickChatInputPlaceholder(
  i18n: PanelI18n,
  mode: ChatPlaceholderMode,
): string {
  const tips = getChatPlaceholderTips(i18n, mode).filter(
    (tip) => tip.trim().length > 0,
  );
  const fallback =
    mode === "paper" ? i18n.placeholderPaper : i18n.placeholderGlobal;
  if (!tips.length) return fallback;
  return tips[Math.floor(Math.random() * tips.length)] || fallback;
}
