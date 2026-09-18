import {
  getModelContextWindow,
  setModelContextWindow,
} from "../../utils/modelContextWindow";

/** Small field within the existing model configuration, no composer control. */
export function createModelBudgetSettings(
  doc: Document,
  connection: () => { apiBase: string; model: string },
  chinese: boolean,
): HTMLElement {
  const details = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "details",
  ) as HTMLDetailsElement;
  details.className = "llm-set-field";
  const summary = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "summary",
  );
  summary.textContent = chinese ? "高级设置" : "Advanced settings";
  const label = doc.createElementNS("http://www.w3.org/1999/xhtml", "label");
  label.className = "llm-set-field";
  label.textContent = chinese
    ? "上下文上限（tokens）"
    : "Context window (tokens)";
  const input = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "input",
  ) as HTMLInputElement;
  input.className = "llm-set-input";
  input.type = "number";
  input.min = "1024";
  input.step = "1";
  input.placeholder = "32768";
  const refresh = () => {
    const { apiBase, model } = connection();
    input.value = String(getModelContextWindow(apiBase, model) || "");
  };
  input.addEventListener("focus", refresh);
  details.addEventListener("toggle", () => {
    if (details.open) refresh();
  });
  details.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("change", () => {
    const { apiBase, model } = connection();
    if (!model || !apiBase) return;
    if (!input.checkValidity()) {
      input.reportValidity();
      return;
    }
    setModelContextWindow(
      apiBase,
      model,
      input.value ? Number(input.value) : undefined,
    );
  });
  const hint = doc.createElementNS("http://www.w3.org/1999/xhtml", "small");
  hint.textContent = chinese
    ? "留空使用自动预算；未知模型默认 32768。为回答预留空间，输入用量为估算值。"
    : "Leave blank for automatic budgeting; unknown models default to 32768. Output space is reserved; usage is estimated.";
  label.appendChild(input);
  details.append(summary, label, hint);
  refresh();
  return details;
}
