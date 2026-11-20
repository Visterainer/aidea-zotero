import { createElement } from "../../utils/domHelpers";
import { TRANSLATION_LANGUAGE_OPTIONS } from "../contextPanel/languages";
import {
  getStringPref,
  setStringPref,
  TRANSLATE_PREFS,
} from "./translatePrefs";

type Choice = { value: string; label: string };

/** A fixed choice list needs no document-level listeners or popup positioning. */
export function createChoiceField(
  doc: Document,
  id: string,
  choices: readonly Choice[],
  initial: string,
): HTMLElement {
  const field = createElement(doc, "span", "llm-tr-dropdown llm-tr-choice");
  const select = createElement(
    doc,
    "select",
    "llm-tr-dropdown-trigger llm-tr-choice-select",
    { id },
  );
  for (const { value, label } of choices) {
    select.append(
      createElement(doc, "option", "llm-tr-dropdown-item", {
        value,
        textContent: label,
      }),
    );
  }
  select.value = initial;
  field.append(select);
  return field;
}

export function createLanguagePair(
  doc: Document,
  strings: {
    trSourceLang: string;
    trTargetLang: string;
    swapLanguages: string;
  },
): HTMLElement {
  const choices = TRANSLATION_LANGUAGE_OPTIONS.map(({ code, label }) => ({
    value: code,
    label,
  }));
  const field = (
    id: string,
    labelId: string,
    caption: string,
    initial: string,
  ) => {
    const label = createElement(doc, "label", "llm-tr-lang-half");
    label.append(
      createElement(doc, "span", "llm-tr-field-label", {
        id: labelId,
        textContent: caption,
      }),
      createChoiceField(doc, id, choices, initial),
    );
    return label;
  };
  const swap = createElement(doc, "button", "llm-tr-lang-swap", {
    id: "llm-tr-lang-swap",
    type: "button",
    title: strings.swapLanguages,
  });
  swap.setAttribute("aria-label", strings.swapLanguages);
  const row = createElement(doc, "div", "llm-tr-lang-row llm-tr-language-pair");
  row.append(
    field(
      "llm-tr-source-lang",
      "llm-tr-src-lang-label",
      strings.trSourceLang,
      "en",
    ),
    swap,
    field(
      "llm-tr-target-lang",
      "llm-tr-tgt-lang-label",
      strings.trTargetLang,
      "zh-CN",
    ),
  );
  return row;
}

export function bindTranslationChoices(root: Element): void {
  const bind = (id: string, key: string, fallback: string) => {
    const select = root.querySelector<HTMLSelectElement>(`#${id}`);
    if (!select) return null;
    select.value = getStringPref(key, fallback);
    if (!select.value) select.value = fallback;
    select.onchange = () => setStringPref(key, select.value);
    return select;
  };
  const src = bind("llm-tr-source-lang", TRANSLATE_PREFS.sourceLang, "en");
  const tgt = bind("llm-tr-target-lang", TRANSLATE_PREFS.targetLang, "zh-CN");
  bind("llm-tr-font-family", TRANSLATE_PREFS.fontFamily, "auto");
  const swap = root.querySelector<HTMLButtonElement>("#llm-tr-lang-swap");
  if (src && tgt && swap)
    swap.onclick = () => {
      if (src.value === tgt.value) return;
      const previous = src.value;
      src.value = tgt.value;
      tgt.value = previous;
      setStringPref(TRANSLATE_PREFS.sourceLang, src.value);
      setStringPref(TRANSLATE_PREFS.targetLang, tgt.value);
    };
}
