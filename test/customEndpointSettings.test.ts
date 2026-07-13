import { assert } from "chai";

type PreferenceScriptModule = typeof import("../src/modules/preferenceScript");

type PrefStore = Map<string, unknown>;

const PREF_PREFIX = "extensions.zotero.aidea";
const ADDON_REF = "aidea";

let preferenceScript: PreferenceScriptModule;
let prefStore: PrefStore;
let mockMainWindows: Array<{ document: MockDocument }>;

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

class MockStyle {
  [key: string]: string | ((name: string, value?: string) => string | void);

  public setProperty(name: string, value: string): void {
    this[name] = value;
  }

  public removeProperty(name: string): string {
    const previous = String(this[name] || "");
    delete this[name];
    return previous;
  }
}

class MockElement {
  public readonly children: MockElement[] = [];
  public readonly style = new MockStyle() as Record<string, string> & MockStyle;
  public readonly dataset: Record<string, string> = {};
  public readonly attributes = new Map<string, string>();
  public readonly listeners = new Map<string, Array<(event: any) => void>>();
  private readonly classNames = new Set<string>();
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
  public readonly classList = {
    add: (...names: string[]) => {
      for (const name of names) {
        if (name) this.classNames.add(name);
      }
    },
    remove: (...names: string[]) => {
      for (const name of names) this.classNames.delete(name);
    },
    toggle: (name: string, force?: boolean) => {
      const shouldAdd = force ?? !this.classNames.has(name);
      if (shouldAdd) {
        this.classNames.add(name);
      } else {
        this.classNames.delete(name);
      }
      return shouldAdd;
    },
    contains: (name: string) => this.classNames.has(name),
  };

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

  public get firstChild(): MockElement | null {
    return this.children[0] || null;
  }

  public get className(): string {
    return Array.from(this.classNames).join(" ");
  }

  public set className(value: string) {
    this.classNames.clear();
    for (const name of String(value || "").split(/\s+/)) {
      if (name) this.classNames.add(name);
    }
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
    if (name === "class") {
      this.className = value;
    }
    if (name === "style") {
      parseStyleText(this.style, value);
    }
  }

  public getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  public append(...nodes: Array<MockElement | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        this.textContent += node;
      } else {
        this.appendChild(node);
      }
    }
  }

  public appendChild(node: MockElement): MockElement {
    node.parentElement = this;
    this.children.push(node);
    return node;
  }

  public removeChild(node: MockElement): MockElement {
    const index = this.children.indexOf(node);
    if (index >= 0) {
      this.children.splice(index, 1);
      node.parentElement = null;
      this.ownerDocument.unregisterTree(node);
    }
    return node;
  }

  public remove(): void {
    this.parentElement?.removeChild(this);
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
    if (selector.includes(",")) {
      const results: MockElement[] = [];
      const seen = new Set<MockElement>();
      for (const part of selector.split(",")) {
        for (const match of this.querySelectorAll(part.trim())) {
          if (seen.has(match)) continue;
          seen.add(match);
          results.push(match);
        }
      }
      return results;
    }
    const results: MockElement[] = [];
    const matcher = (node: MockElement) => {
      if (selector.startsWith("#")) {
        return node.id === selector.slice(1);
      }
      if (selector.startsWith(".")) {
        return node.classList.contains(selector.slice(1));
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
    const matches = (node: MockElement) => {
      if (selector.startsWith("#")) return node.id === selector.slice(1);
      if (selector.startsWith(".")) {
        return node.classList.contains(selector.slice(1));
      }
      return node.tagName.toLowerCase() === selector.toLowerCase();
    };
    if (matches(this)) return this;
    let current = this.parentElement;
    while (current) {
      if (matches(current)) return current;
      current = current.parentElement;
    }
    return null;
  }

  public contains(node: MockElement | null): boolean {
    if (!node) return false;
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }

  public getBoundingClientRect(): {
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    height: number;
  } {
    return { top: 0, bottom: 32, left: 0, right: 160, width: 160, height: 32 };
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
  public defaultView: any = null;

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
    if (selector.includes(",")) {
      const results: MockElement[] = [];
      const seen = new Set<MockElement>();
      for (const part of selector.split(",")) {
        for (const match of this.querySelectorAll(part.trim())) {
          if (seen.has(match)) continue;
          seen.add(match);
          results.push(match);
        }
      }
      return results;
    }
    if (selector.startsWith("#")) {
      const match = this.querySelector(selector);
      return match ? [match] : [];
    }
    if (selector.startsWith(".")) {
      return this.body.querySelectorAll(selector);
    }
    return this.body.querySelectorAll(selector);
  }

  public addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  public dispatchEvent(event: { type: string }): boolean {
    for (const listener of this.listeners.get(event.type) || []) {
      listener(event);
    }
    return true;
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
  addEventListener: (type: string, listener: (event: any) => void) => void;
  removeEventListener: (type: string, listener: (event: any) => void) => void;
  confirm: () => true;
} {
  const document = new MockDocument();
  const listeners = new Map<string, Array<(event: any) => void>>();
  const win = {
    document,
    setTimeout,
    innerHeight: 800,
    addEventListener(type: string, listener: (event: any) => void) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    removeEventListener(type: string, listener: (event: any) => void) {
      const entries = listeners.get(type) || [];
      listeners.set(
        type,
        entries.filter((entry) => entry !== listener),
      );
    },
    confirm: () => true,
  };
  document.defaultView = win;
  appendStaticShell(document);
  return win;
}

function createPanelRoot(doc: MockDocument): MockElement {
  const root = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  root.id = "llm-main";
  root.className = "llm-panel";
  doc.body.appendChild(root);
  return root;
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
    mockMainWindows = [];
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
      getMainWindows: () => mockMainWindows,
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
    mockMainWindows = [];
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
    await preferenceScript.bootstrapSettingTab(
      win.document as unknown as Document,
      win.document.body as unknown as HTMLElement,
      win.document.body as unknown as HTMLElement,
    );

    const customFields = win.document.querySelector(
      `#${ADDON_REF}-custom-openai-fields`,
    ) as unknown as MockElement;
    const oauthModeRadio = win.document.querySelector(
      `#${ADDON_REF}-primary-connection-mode-oauth`,
    ) as unknown as MockElement;
    const customModeRadio = win.document.querySelector(
      `#${ADDON_REF}-primary-connection-mode-custom`,
    ) as unknown as MockElement;
    const tabButtons = win.document.querySelectorAll(
      ".llm-set-tab-btn",
    ) as unknown as MockElement[];
    const oauthTabBtn = tabButtons.find(
      (button) => button.textContent === "OAuth Providers",
    ) as MockElement;
    const customTabBtn = tabButtons.find(
      (button) => button.textContent === "API Mode",
    ) as MockElement;
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
    assert.equal(findTextCount(win.document.body, "OAuth Login"), 3);

    (oauthModeRadio as any).checked = false;
    (customModeRadio as any).checked = true;
    customTabBtn.emit("click");

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
    oauthTabBtn.emit("click");

    assert.equal(getPluginPref("primaryConnectionMode"), "oauth");
    assert.equal(customFields.style.display, "none");
    assert.equal(getPluginPref("apiBase"), "http://localhost:11434/v1/");
    assert.equal(getPluginPref("apiKey"), "local-token");
    assert.equal(getPluginPref("model"), "llama3.1:8b");
  });

  it("notifies discussion panels about live custom-mode missing fields", async function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref("apiBase", "http://localhost:11434/v1/");
    setPluginPref("apiKey", "");
    setPluginPref("model", "llama3.1:8b");

    const win = createMockWindow();
    const modelEvents: Array<{
      primaryConnectionMode?: string;
      customMissingApiBase?: boolean;
      customMissingModel?: boolean;
    }> = [];
    win.document.addEventListener("llm-models-changed", (event: any) => {
      if (event?.detail) modelEvents.push(event.detail);
    });

    await preferenceScript.bootstrapSettingTab(
      win.document as unknown as Document,
      win.document.body as unknown as HTMLElement,
      win.document.body as unknown as HTMLElement,
    );
    modelEvents.length = 0;
    const latestModelEvent = () => modelEvents[modelEvents.length - 1] || {};

    const tabButtons = win.document.querySelectorAll(
      ".llm-set-tab-btn",
    ) as unknown as MockElement[];
    const oauthTabBtn = tabButtons.find(
      (button) => button.textContent === "OAuth Providers",
    ) as MockElement;
    const customTabBtn = tabButtons.find(
      (button) => button.textContent === "API Mode",
    ) as MockElement;
    const apiBaseInput = win.document.querySelector(
      `#${ADDON_REF}-custom-api-base`,
    ) as unknown as MockElement;
    const modelInput = win.document.querySelector(
      `#${ADDON_REF}-custom-model`,
    ) as unknown as MockElement;
    const status = win.document.querySelector(
      `#${ADDON_REF}-custom-openai-status`,
    ) as unknown as MockElement;

    customTabBtn.emit("click");
    assert.equal(latestModelEvent().primaryConnectionMode, "custom");

    apiBaseInput.value = "";
    apiBaseInput.emit("input");
    assert.equal(latestModelEvent().primaryConnectionMode, "custom");
    assert.equal(latestModelEvent().customMissingApiBase, true);
    assert.include(status.textContent, "requires API Base URL");

    apiBaseInput.value = "http://localhost:11434/v1/";
    modelInput.value = "";
    modelInput.emit("input");
    assert.equal(latestModelEvent().primaryConnectionMode, "custom");
    assert.equal(latestModelEvent().customMissingApiBase, false);
    assert.equal(latestModelEvent().customMissingModel, true);

    oauthTabBtn.emit("click");
    assert.equal(latestModelEvent().primaryConnectionMode, "oauth");
  });

  it("renders OAuth environment update mode buttons with tooltips and saves selection", async function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref("oauthEnvUpdateMode", "notify");

    const win = createMockWindow();
    await preferenceScript.bootstrapSettingTab(
      win.document as unknown as Document,
      win.document.body as unknown as HTMLElement,
      win.document.body as unknown as HTMLElement,
    );

    const tabButtons = win.document.querySelectorAll(
      ".llm-set-tab-btn",
    ) as unknown as MockElement[];
    const updateModeField = win.document.querySelector(
      ".llm-set-segment-field",
    ) as unknown as MockElement;
    const autoBtn = tabButtons.find(
      (button) => button.textContent === "Auto",
    ) as MockElement;
    const notifyBtn = tabButtons.find(
      (button) => button.textContent === "Notify",
    ) as MockElement;
    const silentBtn = tabButtons.find(
      (button) => button.textContent === "Silent",
    ) as MockElement;

    assert.exists(autoBtn);
    assert.exists(notifyBtn);
    assert.exists(silentBtn);
    assert.equal(updateModeField.querySelectorAll(".llm-set-hint").length, 0);
    assert.include((autoBtn as any).title || "", "60 seconds");
    assert.include((notifyBtn as any).title || "", "Update now");
    assert.include((silentBtn as any).title || "", "Disables");
    assert.equal(notifyBtn.classList.contains("active"), true);

    silentBtn.emit("click");

    assert.equal(getPluginPref("oauthEnvUpdateMode"), "silent");
    assert.equal(notifyBtn.classList.contains("active"), false);
    assert.equal(silentBtn.classList.contains("active"), true);
  });

  it("collapses provider model sections and persists their state", async function () {
    setPluginPref("primaryConnectionMode", "oauth");
    setPluginPref(
      "oauthModelListCache",
      JSON.stringify({
        "openai-codex": [
          { id: "gpt-5.2", label: "GPT 5.2" },
          { id: "gpt-5.3-codex", label: "GPT 5.3 Codex" },
        ],
        "google-gemini-cli": [
          { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
        ],
      }),
    );

    const win = createMockWindow();
    await preferenceScript.bootstrapSettingTab(
      win.document as unknown as Document,
      win.document.body as unknown as HTMLElement,
      win.document.body as unknown as HTMLElement,
    );

    const providerSections = win.document.querySelectorAll(
      ".llm-set-provider-section",
    ) as unknown as MockElement[];
    assert.lengthOf(providerSections, 2);

    const firstSection = providerSections[0];
    const firstToggle = firstSection.querySelector(
      ".llm-set-provider-toggle",
    ) as MockElement;
    const firstBody = firstSection.querySelector(
      ".llm-set-provider-body",
    ) as MockElement;

    assert.equal(firstToggle.getAttribute("aria-expanded"), "true");
    assert.equal(firstBody.style.display, "flex");

    firstToggle.emit("click");

    assert.equal(firstToggle.getAttribute("aria-expanded"), "false");
    assert.equal(firstBody.style.display, "none");
    assert.deepInclude(
      JSON.parse(String(getPluginPref("providerModelSectionState") || "{}")),
      { "openai-codex": false },
    );
  });

  it("selects builtin theme overrides and applies them to open panels", async function () {
    setPluginPref("composerTheme", "default");
    setPluginPref(
      "composerThemeBuiltinOverrides",
      JSON.stringify({
        "blue-porcelain": { accent: "#112233", text: "#445566" },
      }),
    );
    const panelDoc = new MockDocument();
    panelDoc.defaultView = { frames: [] };
    const panelRoot = createPanelRoot(panelDoc);
    mockMainWindows = [{ document: panelDoc }];

    const win = createMockWindow();
    await preferenceScript.bootstrapSettingTab(
      win.document as unknown as Document,
      win.document.body as unknown as HTMLElement,
      win.document.body as unknown as HTMLElement,
    );

    const themeItem = (
      win.document.querySelectorAll(
        ".llm-tr-dropdown-item",
      ) as unknown as MockElement[]
    ).find((item) => item.dataset.value === "blue-porcelain") as MockElement;

    assert.exists(themeItem);

    themeItem.emit("click");

    assert.equal(panelRoot.dataset.composerTheme, "blue-porcelain");
    assert.equal(panelRoot.dataset.composerThemeSurface, "true");
    assert.equal(panelRoot.style["--llm-theme-accent"], "#112233");
    assert.equal(panelRoot.style["--llm-theme-chat-fg"], "#445566");
  });

  it("lists custom themes and previews the selected custom palette globally", async function () {
    setPluginPref("composerTheme", "default");
    setPluginPref(
      "composerThemeCustomList",
      JSON.stringify([
        {
          id: "custom:test",
          name: "Research Dark",
          palette: { accent: "#654321", text: "#123456" },
          createdAt: 1,
          updatedAt: 1,
        },
      ]),
    );
    const panelDoc = new MockDocument();
    panelDoc.defaultView = { frames: [] };
    const panelRoot = createPanelRoot(panelDoc);
    mockMainWindows = [{ document: panelDoc }];

    const win = createMockWindow();
    await preferenceScript.bootstrapSettingTab(
      win.document as unknown as Document,
      win.document.body as unknown as HTMLElement,
      win.document.body as unknown as HTMLElement,
    );

    const themeItem = (
      win.document.querySelectorAll(
        ".llm-tr-dropdown-item",
      ) as unknown as MockElement[]
    ).find((item) => item.dataset.value === "custom:test") as MockElement;

    assert.exists(themeItem);

    themeItem.emit("click");

    assert.equal(getPluginPref("composerTheme"), "custom:test");
    assert.equal(panelRoot.dataset.composerTheme, "custom:test");
    assert.equal(panelRoot.style["--llm-theme-accent"], "#654321");
    assert.equal(panelRoot.style["--llm-theme-chat-fg"], "#123456");
  });

  it("renders and persists selection translation action visibility options", async function () {
    setPluginPref("selectionTranslate.showCopyButton", false);
    setPluginPref("selectionTranslate.showAddToNoteButton", true);

    const win = createMockWindow();
    await preferenceScript.bootstrapSettingTab(
      win.document as unknown as Document,
      win.document.body as unknown as HTMLElement,
      win.document.body as unknown as HTMLElement,
    );

    const copyInput = win.document.querySelector(
      `#${ADDON_REF}-selection-translate-show-copy`,
    ) as unknown as MockElement;
    const addToNoteInput = win.document.querySelector(
      `#${ADDON_REF}-selection-translate-show-add-to-note`,
    ) as unknown as MockElement;
    const modelLabel = win.document.querySelector(
      `#${ADDON_REF}-selection-translate-model-label`,
    ) as unknown as MockElement;
    const sourceLabel = win.document.querySelector(
      `#${ADDON_REF}-selection-translate-source-label`,
    ) as unknown as MockElement;
    const coldStartHint = win.document.querySelector(
      `#${ADDON_REF}-selection-translate-cold-start-hint`,
    ) as unknown as MockElement;

    assert.equal(copyInput.checked, false);
    assert.equal(addToNoteInput.checked, true);
    assert.exists(copyInput.closest(".llm-set-subsection"));
    assert.exists(addToNoteInput.closest(".llm-set-subsection"));
    assert.exists(modelLabel.closest(".llm-set-subsection"));
    assert.exists(sourceLabel.closest(".llm-set-subsection"));
    assert.exists(coldStartHint.closest(".llm-set-subsection"));

    copyInput.checked = true;
    copyInput.emit("change");
    addToNoteInput.checked = false;
    addToNoteInput.emit("change");

    assert.equal(getPluginPref("selectionTranslate.showCopyButton"), true);
    assert.equal(
      getPluginPref("selectionTranslate.showAddToNoteButton"),
      false,
    );
  });

  it("localizes selection translation action settings in all UI languages", async function () {
    const languages = [
      "en-US",
      "zh-CN",
      "zh-TW",
      "ja-JP",
      "ko-KR",
      "fr-FR",
      "de-DE",
      "es-ES",
      "ru-RU",
      "pt-BR",
      "ar-SA",
      "hi-IN",
    ];
    let englishCopyLabel = "";
    let englishAddToNoteLabel = "";

    for (const language of languages) {
      prefStore.clear();
      setPluginPref("uiLanguage", language);
      const win = createMockWindow();
      await preferenceScript.bootstrapSettingTab(
        win.document as unknown as Document,
        win.document.body as unknown as HTMLElement,
        win.document.body as unknown as HTMLElement,
      );

      const copyLabel = win.document.querySelector(
        `#${ADDON_REF}-selection-translate-show-copy-label`,
      ) as unknown as MockElement;
      const copyHint = win.document.querySelector(
        `#${ADDON_REF}-selection-translate-show-copy-hint`,
      ) as unknown as MockElement;
      const addToNoteLabel = win.document.querySelector(
        `#${ADDON_REF}-selection-translate-show-add-to-note-label`,
      ) as unknown as MockElement;
      const addToNoteHint = win.document.querySelector(
        `#${ADDON_REF}-selection-translate-show-add-to-note-hint`,
      ) as unknown as MockElement;

      assert.isNotEmpty(copyLabel.textContent, `${language} copy label`);
      assert.isNotEmpty(copyHint.textContent, `${language} copy hint`);
      assert.isNotEmpty(
        addToNoteLabel.textContent,
        `${language} add-to-note label`,
      );
      assert.isNotEmpty(
        addToNoteHint.textContent,
        `${language} add-to-note hint`,
      );
      if (language === "en-US") {
        englishCopyLabel = copyLabel.textContent;
        englishAddToNoteLabel = addToNoteLabel.textContent;
      } else {
        assert.notEqual(copyLabel.textContent, englishCopyLabel);
        assert.notEqual(addToNoteLabel.textContent, englishAddToNoteLabel);
      }
    }
  });
});
