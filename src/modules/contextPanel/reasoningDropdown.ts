import {
  formatReasoningEffort,
  getCachedModelReasoningSupport,
  initializeReasoningEffort,
  resolveReasoningEffort,
  type ModelReasoningSupport,
} from "../../utils/reasoningEffort";
import type { PanelI18n } from "./i18n";

/** Keep the saved choice, but show an unavailable control in neutral gray. */
export function updateReasoningEffortButton(params: {
  button: HTMLButtonElement;
  slot?: HTMLElement | null;
  support: ModelReasoningSupport;
  selected: string;
  labels: Pick<
    PanelI18n,
    | "reasoningEffort"
    | "reasoningEffortDefault"
    | "reasoningEffortModelDefault"
    | "reasoningEffortUnavailable"
    | "reasoningEffortUnknown"
  >;
}): void {
  const { button, slot, support, selected, labels } = params;
  const available = support.efforts.length > 0;
  const effective = resolveReasoningEffort(
    selected,
    support.efforts,
    support.defaultEffort,
  );
  const label = formatReasoningEffort(selected || effective || "");
  button.dataset.reasoningEffort = available ? effective! : "unavailable";
  button.disabled = !available;
  button.setAttribute("aria-disabled", String(!available));
  button.classList.toggle("llm-reasoning-btn-unavailable", !available);
  button.classList.toggle("llm-reasoning-btn-active", available);
  button.title = available
    ? `${labels.reasoningEffort}: ${label}${
        selected && effective !== selected
          ? ` → ${formatReasoningEffort(effective!)}`
          : ""
      }`
    : support.catalogMissing
      ? labels.reasoningEffortUnknown
      : labels.reasoningEffortUnavailable;
  button.setAttribute("aria-label", button.title);
  // A disabled native button may not receive hover events; the wrapper still does.
  if (slot) slot.title = button.title;
}

/**
 * Fill an `llm-tr-dropdown` with the reasoning efforts of one model. The
 * `row` is hidden when the model offers no selectable effort.
 */
export function renderReasoningEffortDropdown(params: {
  dropdown: HTMLElement;
  row: HTMLElement;
  providerId: string;
  model: string;
  apiBase?: string;
  apiKey?: string;
  selected: string;
  onSelect: (effort: string) => void;
}): void {
  const { dropdown, row } = params;
  const trigger = dropdown.querySelector(
    ".llm-tr-dropdown-trigger",
  ) as HTMLElement | null;
  const menu = dropdown.querySelector(
    ".llm-tr-dropdown-menu",
  ) as HTMLElement | null;
  if (!trigger || !menu) return;
  menu.innerHTML = "";

  const support = getCachedModelReasoningSupport(
    params.providerId,
    params.model,
    params.apiBase,
    params.apiKey,
  );
  if (!support.efforts.length) {
    row.style.display = "none";
    dropdown.dataset.value = "";
    return;
  }
  row.style.display = "";

  const selected = initializeReasoningEffort(
    params.selected,
    support,
    params.onSelect,
  );
  const effective = resolveReasoningEffort(
    selected,
    support.efforts,
    support.defaultEffort,
  )!;
  const entries = support.efforts.map((effort) => ({
    effort,
    label: formatReasoningEffort(effort),
  }));
  if (!support.efforts.includes(selected)) {
    entries.push({
      effort: selected,
      label: `${formatReasoningEffort(selected)} → ${formatReasoningEffort(effective)}`,
    });
  }

  const show = (effort: string) => {
    const entry = entries.find((candidate) => candidate.effort === effort);
    dropdown.dataset.value = effort;
    const arrow = trigger.querySelector(".llm-tr-dropdown-arrow");
    trigger.textContent = entry?.label || formatReasoningEffort(effective);
    if (arrow) trigger.appendChild(arrow);
    menu.querySelectorAll(".llm-tr-dropdown-item").forEach((el: Element) => {
      (el as HTMLElement).classList.toggle(
        "selected",
        (el as HTMLElement).dataset.value === effort,
      );
    });
  };

  const doc = dropdown.ownerDocument!;
  for (const entry of entries) {
    const item = doc.createElementNS(
      "http://www.w3.org/1999/xhtml",
      "div",
    ) as HTMLDivElement;
    item.className = "llm-tr-dropdown-item";
    item.dataset.value = entry.effort;
    item.textContent = entry.label;
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      show(entry.effort);
      menu.style.display = "none";
      dropdown.classList.remove("open");
      params.onSelect(entry.effort);
    });
    menu.appendChild(item);
  }

  show(selected);
}
