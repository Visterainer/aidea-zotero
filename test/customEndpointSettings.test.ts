import { assert } from "chai";

type PreferenceScriptModule = typeof import("../src/modules/preferenceScript");

type PrefStore = Map<string, unknown>;

const PREF_PREFIX = "extensions.zotero.aidea";
const ADDON_REF = "aidea";

let preferenceScript: PreferenceScriptModule;
let prefStore: PrefStore;

function pluginPrefKey(key: string): string {
  return `${PREF_PREFIX}.${key}`;
}

function setPluginPref(key: string, value: unknown): void {
  prefStore.set(pluginPrefKey(key), value);
}

function getPluginPref(key: string): unknown {
  return prefStore.get(pluginPrefKey(key));
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}

function parseStyleText(style: Record<string, string>, cssText: string): void {
  for (const part of cssText.split(";")) {
    const [rawKey, ...rawValueParts] = part.split(":");
    const key = String(rawKey || "").trim();
    if (!key) continue;
    style[toCamelCase(key)] = rawValueParts.join(":").trim();
  }
}

class MockElement {
  public readonly children: MockElement[] = [];
  public readonly style: Record<string, string> = {};
  public readonly attributes = new Map<string, string>();
  public readonly listeners = new Map<string, Array<(event: any) => void>>();
  public parentElement: MockElement | null = null;
  public textContent = "";
  public value = "";
  public checked = false;
  public disabled = false;
  public type = "";
  public name = "";
  public placeholder = "";
  public readOnly = false;
  public scrollTop = 0;
  public scrollHeight = 0;
  public clientHeight = 0;

  public constructor(
    public readonly ownerDocument: MockDocument,
    public readonly tagName: string,
  ) {}

  public get id(): string {
    return this.attributes.get("id") || "";
  }

  public set id(value: string) {
    this.setAttribute("id", value);
  }

  public get parentNode(): MockElement | null {
    return this.parentElement;
  }

  public get innerHTML(): string {
    return "";
  }

  public set innerHTML(value: string) {
    if (value === "") this.clearChildren();
  }

  public setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "id") {
      this.ownerDocument.registerId(value, this);
    }
    if (name === "style") {
      parseStyleText(this.style, value);
    }
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public append(...nodes: MockElement[]): void {
    for (const node of nodes) this.appendChild(node);
  }

  public appendChild(node: MockElement): MockElement {
    node.parentElement = this;
    this.children.push(node);
    return node;
  }

  public addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  public emit(type: string): void {
    for (const listener of this.listeners.get(type) || []) {
      listener({
        target: this,
        currentTarget: this,
        stopPropagation() {},
      });
    }
  }

  public querySelector(selector: string): MockElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const matcher = (node: MockElement) => {
      if (selector.startsWith("#")) {
        return node.id === selector.slice(1);
      }
      return node.tagName.toLowerCase() === selector.toLowerCase();
    };
    const walk = (node: MockElement) => {
      for (const child of node.children) {
        if (matcher(child)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  public closest(selector: string): MockElement | null {
    let current: MockElement | null = this;
    while (current) {
      if (selector.startsWith("#")) {
        if (current.id === selector.slice(1)) return current;
      } else if (current.tagName.toLowerCase() === selector.toLowerCase()) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  private clearChildren(): void {
    while (this.children.length) {
      const child = this.children.pop();
      if (!child) continue;
      child.parentElement = null;
      this.ownerDocument.unregisterTree(child);
    }
  }
}

class MockDocument {
  public readonly ids = new Map<string, MockElement>();
  public readonly body = new MockElement(this, "body");
  public readonly documentElement = this.body;
  public readonly listeners = new Map<string, Array<(event: any) => void>>();

  public createElementNS(_ns: string, tagName: string): MockElement {
    return new MockElement(this, tagName);
  }

  public querySelector(selector: string): MockElement | null {
    if (selector.startsWith("#")) {
      return this.ids.get(selector.slice(1)) || null;
    }
    return this.body.querySelector(selector);
  }

  public querySelectorAll(selector: string): MockElement[] {
    if (selector.startsWith("#")) {
      const match = this.querySelector(selector);
      return match ? [match] : [];
    }
    return this.body.querySelectorAll(selector);
  }

  public addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  public registerId(id: string, element: MockElement): void {
    this.ids.set(id, element);
  }

  public unregisterTree(element: MockElement): void {
    if (element.id) this.ids.delete(element.id);
    for (const child of element.children) this.unregisterTree(child);
  }
}

function appendStaticShell(doc: MockDocument): void {
  const modelSections = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div",
  );
  modelSections.id = `${ADDON_REF}-model-sections`;
  doc.body.appendChild(modelSections);

  const systemPrompt = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "textarea",
  );
  systemPrompt.id = `${ADDON_REF}-system-prompt`;
  doc.body.appendChild(systemPrompt);

  const systemPromptLabel = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "label",
  );
  systemPromptLabel.id = `${ADDON_REF}-system-prompt-label`;
  doc.body.appendChild(systemPromptLabel);

  const systemPromptHint = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "span",
  );
  systemPromptHint.id = `${ADDON_REF}-system-prompt-hint`;
  doc.body.appendChild(systemPromptHint);

  const popupSection = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div",
  );
  const popupInput = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "input",
  );
  popupInput.id = `${ADDON_REF}-popup-add-text-enabled`;
  popupSection.appendChild(popupInput);
  const popupLabel = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "span",
  );
  popupLabel.id = `${ADDON_REF}-popup-add-text-label`;
  popupSection.appendChild(popupLabel);
  const popupHint = doc.createElementNS("http://www.w3.org/1999/xhtml", "span");
  popupHint.id = `${ADDON_REF}-popup-add-text-hint`;
  popupSection.appendChild(popupHint);
  doc.body.appendChild(popupSection);

  const showAllSection = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "div",
  );
  const showAllInput = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "input",
  );
  showAllInput.id = `${ADDON_REF}-show-all-models`;
  showAllSection.appendChild(showAllInput);
  const showAllLabel = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "span",
  );
  showAllLabel.id = `${ADDON_REF}-show-all-models-label`;
  showAllSection.appendChild(showAllLabel);
  const showAllHint = doc.createElementNS(
    "http://www.w3.org/1999/xhtml",
    "span",
  );
  showAllHint.id = `${ADDON_REF}-show-all-models-hint`;
  showAllSection.appendChild(showAllHint);
  doc.body.appendChild(showAllSection);
}

function createMockWindow(): {
  document: MockDocument;
  setTimeout: typeof setTimeout;
  confirm: () => true;
} {
  const document = new MockDocument();
  appendStaticShell(document);
  return {
    document,
    setTimeout,
    confirm: () => true,
  };
}

function findTextCount(root: MockElement, text: string): number {
  let count = root.textContent === text ? 1 : 0;
  for (const child of root.children) {
    count += findTextCount(child, text);
  }
  return count;
}

describe("custom endpoint settings UI", function () {
  before(async function () {
    prefStore = new Map<string, unknown>();
    (globalThis as any).Zotero = {
      Prefs: {
        get(key: string) {
          return prefStore.get(key);
        },
        set(key: string, value: unknown) {
          prefStore.set(key, value);
        },
      },
      locale: "en-US",
      getMainWindows: () => [],
      getMainWindow: () => null,
    };
    (globalThis as any).ztoolkit = {
      getGlobal: () => undefined,
      log: () => undefined,
    };
    (globalThis as any).Cc = {};
    (globalThis as any).Ci = {};

    preferenceScript = await import("../src/modules/preferenceScript");
  });

  beforeEach(function () {
    prefStore.clear();
    setPluginPref("uiLanguage", "en-US");
  });

  it("normalizes custom API base input to one trailing slash", function () {
    assert.equal(
      preferenceScript.normalizeCustomApiBaseInput(
        "  http://127.0.0.1:11434/v1///  ",
      ),
      "http://127.0.0.1:11434/v1/",
    );
    assert.equal(
      preferenceScript.normalizeCustomApiBaseInput("http://localhost:8080"),
      "http://localhost:8080/",
    );
    assert.equal(preferenceScript.normalizeCustomApiBaseInput("   "), "");
  });

  it("tracks missing required custom-mode fields without requiring API key", function () {
    assert.deepEqual(preferenceScript.getCustomEndpointMissingFields("", ""), [
      "apiBase",
      "model",
    ]);
    assert.deepEqual(
      preferenceScript.getCustomEndpointMissingFields(
        "http://localhost:11434/",
        "",
      ),
      ["model"],
    );
    assert.deepEqual(
      preferenceScript.getCustomEndpointMissingFields(
        "http://localhost:11434/",
        "llama3.1",
      ),
      [],
    );
  });

  it("renders the mode selector, preserves OAuth cards, and saves trimmed custom prefs", async function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref("apiBase", "");
    setPluginPref("apiKey", "");
    setPluginPref("model", "");

    const win = createMockWindow();
    await preferenceScript.registerPrefsScripts(win as unknown as Window);

    const customFields = win.document.querySelector(
      `#${ADDON_REF}-custom-openai-fields`,
    ) as unknown as MockElement;
    const oauthModeRadio = win.document.querySelector(
      `#${ADDON_REF}-primary-connection-mode-oauth`,
    ) as unknown as MockElement;
    const customModeRadio = win.document.querySelector(
      `#${ADDON_REF}-primary-connection-mode-custom`,
    ) as unknown as MockElement;
    const apiBaseInput = win.document.querySelector(
      `#${ADDON_REF}-custom-api-base`,
    ) as unknown as MockElement;
    const apiKeyInput = win.document.querySelector(
      `#${ADDON_REF}-custom-api-key`,
    ) as unknown as MockElement;
    const modelInput = win.document.querySelector(
      `#${ADDON_REF}-custom-model`,
    ) as unknown as MockElement;
    const status = win.document.querySelector(
      `#${ADDON_REF}-custom-openai-status`,
    ) as unknown as MockElement;

    assert.equal(customFields.style.display, "none");
    assert.equal((apiBaseInput as any).disabled, true);
    assert.equal(findTextCount(win.document.body, "OAuth Login"), 4);

    (oauthModeRadio as any).checked = false;
    (customModeRadio as any).checked = true;
    customModeRadio.emit("change");

    assert.equal(getPluginPref("primaryConnectionMode"), "custom");
    assert.equal(customFields.style.display, "flex");
    assert.equal((apiBaseInput as any).disabled, false);
    assert.include(status.textContent, "requires API Base URL and Model");

    apiBaseInput.value = "  http://localhost:11434/v1///  ";
    apiBaseInput.emit("change");
    apiKeyInput.value = "  local-token  ";
    apiKeyInput.emit("change");
    modelInput.value = "  llama3.1:8b  ";
    modelInput.emit("change");

    assert.equal(getPluginPref("apiBase"), "http://localhost:11434/v1/");
    assert.equal(getPluginPref("apiKey"), "local-token");
    assert.equal(getPluginPref("model"), "llama3.1:8b");
    assert.include(status.textContent, "Custom mode is ready");

    (customModeRadio as any).checked = false;
    (oauthModeRadio as any).checked = true;
    oauthModeRadio.emit("change");

    assert.equal(getPluginPref("primaryConnectionMode"), "oauth");
    assert.equal(customFields.style.display, "none");
    assert.equal(getPluginPref("apiBase"), "http://localhost:11434/v1/");
    assert.equal(getPluginPref("apiKey"), "local-token");
    assert.equal(getPluginPref("model"), "llama3.1:8b");
  });
});
