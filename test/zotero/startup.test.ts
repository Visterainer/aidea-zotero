import { assert } from "chai";
import { config } from "../../package.json";
import {
  renderReasoningEffortDropdown,
  updateReasoningEffortButton,
} from "../../src/modules/contextPanel/reasoningDropdown";
import {
  cacheApiReasoningCatalog,
  getCachedModelReasoningSupport,
  rejectApiReasoningSupport,
} from "../../src/utils/reasoningEffort";
import { getPanelI18n } from "../../src/modules/contextPanel/i18n";

describe("startup", function () {
  it("should have plugin instance defined", function () {
    assert.isNotEmpty(Zotero[config.addonInstance]);
  });

  it("shows catalog levels and hides for unsupported models", function () {
    const pref = `${config.prefsPrefix}.oauthModelListCache`;
    const previous = Zotero.Prefs.get(pref, true);
    Zotero.Prefs.set(
      pref,
      JSON.stringify({
        "openai-codex": [
          {
            id: "gpt-6-luna",
            reasoningLevels: ["low", "medium", "high", "xhigh"],
            defaultReasoningLevel: "medium",
          },
          { id: "no-default-value", reasoningLevels: ["low", "high"] },
        ],
      }),
      true,
    );

    try {
      const row = document.createElement("div");
      const dropdown = document.createElement("div");
      dropdown.innerHTML =
        '<div class="llm-tr-dropdown-trigger"><span class="llm-tr-dropdown-arrow">▾</span></div>' +
        '<div class="llm-tr-dropdown-menu"></div>';
      row.appendChild(dropdown);
      let selected = "";
      const render = (providerId: string, model: string, choice = "high") =>
        renderReasoningEffortDropdown({
          dropdown,
          row,
          providerId,
          model,
          selected: choice,
          onSelect: (effort) => {
            selected = effort;
          },
        });

      render("openai-codex", "gpt-6-luna");
      assert.equal(row.style.display, "");
      assert.equal(dropdown.dataset.value, "high");
      const options = dropdown.querySelectorAll(".llm-tr-dropdown-item");
      assert.lengthOf(options, 4);
      assert.equal(options[0].textContent, "Low");
      assert.notInclude(dropdown.textContent || "", "Default");
      (options[3] as HTMLElement).click();
      assert.equal(selected, "xhigh");
      assert.equal(dropdown.dataset.value, "xhigh");

      render("openai-codex", "gpt-6-luna", "");
      assert.equal(selected, "medium");
      assert.equal(dropdown.dataset.value, "medium");

      render("github-copilot", "gpt-6-luna");
      assert.equal(row.style.display, "none");

      render("openai-codex", "no-default-value", "");
      assert.equal(selected, "low");
      assert.equal(row.style.display, "");
      assert.include(
        dropdown.querySelector(".llm-tr-dropdown-item")?.textContent || "",
        "Low",
      );
    } finally {
      Zotero.Prefs.set(pref, previous || "", true);
    }
  });

  it("updates API lamp availability from the selected connection and keeps the saved effort", function () {
    const pref = `${config.prefsPrefix}.apiReasoningCapabilities`;
    const previous = Zotero.Prefs.get(pref, true);
    const base = "https://native-test.invalid/v1";
    const button = document.createElement("button");
    const labels = getPanelI18n();
    const show = (key = "test-key") =>
      updateReasoningEffortButton({
        button,
        selected: "ultra",
        labels,
        support: getCachedModelReasoningSupport("custom", "alias", base, key),
      });
    try {
      show();
      assert.isTrue(button.disabled);
      assert.equal(button.title, labels.reasoningEffortUnknown);
      cacheApiReasoningCatalog(base, "test-key", [
        { id: "alias", supported_reasoning_levels: ["low", "high"] },
      ]);
      show();
      assert.isFalse(button.disabled);
      assert.include(button.title, "Ultra → High");
      assert.equal(button.dataset.reasoningEffort, "high");
      show("other-key");
      assert.isTrue(button.disabled);
      rejectApiReasoningSupport(base, "alias", "test-key");
      show();
      assert.isTrue(button.disabled);
      assert.equal(button.title, labels.reasoningEffortUnavailable);
    } finally {
      Zotero.Prefs.set(pref, previous || "{}", true);
    }
  });

  it("turns the lamp gray with a clear hint when support is unavailable, then restores its color", async function () {
    const sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = "chrome://aidea/content/zoteroPane.css";
    const loaded = new Promise<void>((resolve, reject) => {
      sheet.onload = () => resolve();
      sheet.onerror = () => reject(new Error("Could not load plugin CSS"));
    });
    document.head.appendChild(sheet);
    const slot = document.createElement("div");
    slot.className =
      "llm-action-slot llm-reasoning-dropdown llm-reasoning-dropdown-collapsed";
    const button = document.createElement("button");
    button.className = "llm-reasoning-btn llm-reasoning-btn-collapsed";
    slot.appendChild(button);
    document.body.appendChild(slot);
    const labels = getPanelI18n();
    try {
      await loaded;
      const show = (support: { efforts: string[]; catalogMissing?: boolean }) =>
        updateReasoningEffortButton({
          button,
          slot,
          support,
          selected: "high",
          labels,
        });
      show({ efforts: ["low", "high"] });
      assert.isFalse(button.disabled);
      assert.equal(window.getComputedStyle(button).color, "rgb(136, 81, 189)");
      assert.equal(window.getComputedStyle(button, "::before").width, "16px");
      assert.equal(window.getComputedStyle(button, "::before").height, "16px");
      show({ efforts: [] });
      assert.isTrue(button.disabled);
      assert.equal(button.title, labels.reasoningEffortUnavailable);
      assert.equal(slot.title, button.title);
      assert.equal(button.getAttribute("aria-disabled"), "true");
      assert.equal(window.getComputedStyle(button).color, "rgb(129, 144, 152)");
      show({ efforts: [], catalogMissing: true });
      assert.equal(button.title, labels.reasoningEffortUnknown);
      assert.equal(window.getComputedStyle(button).color, "rgb(129, 144, 152)");
      show({ efforts: ["low", "high"] });
      assert.isFalse(button.disabled);
      assert.equal(button.dataset.reasoningEffort, "high");
      assert.equal(window.getComputedStyle(button).color, "rgb(136, 81, 189)");
    } finally {
      slot.remove();
      sheet.remove();
    }
  });
});
