import { assert } from "chai";

type ThemeModule = typeof import("../src/modules/contextPanel/theme");

const PREF_PREFIX = "extensions.zotero.aidea";

let theme: ThemeModule;
let prefStore: Map<string, unknown>;
let mockMainWindows: Array<{ document: MockDocument }>;

function pluginPrefKey(key: string): string {
  return `${PREF_PREFIX}.${key}`;
}

function setPluginPref(key: string, value: unknown): void {
  prefStore.set(pluginPrefKey(key), value);
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
  public parentElement: MockElement | null = null;
  public id = "";
  public className = "";

  public constructor(public readonly ownerDocument: MockDocument) {}

  public appendChild(node: MockElement): MockElement {
    node.parentElement = this;
    this.children.push(node);
    return node;
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
    const matches = (node: MockElement) => {
      if (selector.startsWith("#")) return node.id === selector.slice(1);
      if (selector.startsWith(".")) {
        return node.className.split(/\s+/).includes(selector.slice(1));
      }
      return false;
    };
    const results: MockElement[] = [];
    const walk = (node: MockElement) => {
      for (const child of node.children) {
        if (matches(child)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }
}

class MockDocument {
  public readonly body = new MockElement(this);
  public defaultView: any = { frames: [] };

  public createElement(): MockElement {
    return new MockElement(this);
  }

  public querySelectorAll(selector: string): MockElement[] {
    return this.body.querySelectorAll(selector);
  }
}

function createRoot(
  doc: MockDocument,
  id: string,
  className = "",
): MockElement {
  const root = new MockElement(doc);
  root.id = id;
  root.className = className;
  doc.body.appendChild(root);
  return root;
}

describe("plugin theme state", function () {
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
      getMainWindows: () => mockMainWindows,
      getMainWindow: () => null,
    };
    (globalThis as any).Cc = {};
    (globalThis as any).Ci = {};

    theme = await import("../src/modules/contextPanel/theme");
  });

  beforeEach(function () {
    prefStore.clear();
    mockMainWindows = [];
  });

  it("normalizes builtin aliases, invalid JSON, and legacy custom selection", function () {
    assert.equal(
      theme.resolvePluginThemeState("soft-blue", "", "").selection,
      "blue-porcelain",
    );
    assert.equal(
      theme.resolvePluginThemeState("custom:missing", "not json", "").selection,
      "default",
    );

    const customList = JSON.stringify([
      {
        id: "custom:first",
        name: "First",
        palette: { accent: "#123456", text: "#234567" },
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const state = theme.resolvePluginThemeState("custom", customList, "");

    assert.equal(state.selection, "custom:first");
    assert.equal(state.palette.accent, "#123456");
    assert.equal(state.palette.text, "#234567");
  });

  it("deduplicates custom themes and applies builtin overrides", function () {
    const customThemes = theme.parseCustomComposerThemes(
      JSON.stringify([
        {
          id: "custom:a",
          name: "Same",
          palette: {},
          createdAt: 1,
          updatedAt: 1,
        },
        {
          id: "custom:b",
          name: "Same",
          palette: {},
          createdAt: 2,
          updatedAt: 2,
        },
      ]),
    );
    assert.lengthOf(customThemes, 1);

    const state = theme.resolvePluginThemeState(
      "blue-porcelain",
      "",
      JSON.stringify({
        "blue-porcelain": { accent: "#112233", text: "#445566" },
      }),
    );

    assert.equal(state.selection, "blue-porcelain");
    assert.equal(state.palette.accent, "#112233");
    assert.equal(state.palette.text, "#445566");
  });

  it("keeps only edited colors from a legacy full-palette override", function () {
    const legacy = {
      ...theme.BUILTIN_COMPOSER_THEME_PALETTES["blue-porcelain"],
      accent: "#112233",
      inputText: "system",
      inputPlaceholder: "system",
    };
    const state = theme.resolvePluginThemeState(
      "blue-porcelain",
      "",
      JSON.stringify({ "blue-porcelain": legacy }),
    );

    assert.deepEqual(state.builtinOverrides["blue-porcelain"], {
      accent: "#112233",
    });
    assert.equal(state.palette.accent, "#112233");
    assert.equal(state.palette.inputText, "#1f3342");
    assert.equal(state.palette.inputPlaceholder, "#657985");
    assert.deepEqual(
      JSON.parse(
        theme.serializeBuiltinComposerThemeOverrides(state.builtinOverrides),
      ),
      { __v: 2, "blue-porcelain": { accent: "#112233" } },
    );
  });

  it("does not re-migrate a current-format override that sets every colour", function () {
    const everyColour = {
      ...theme.BUILTIN_COMPOSER_THEME_PALETTES["blue-porcelain"],
      accent: "#112233",
      // Equal to the 3.6.1 default; a legacy migration would drop it.
      inputText: "system",
    };
    const serialized = theme.serializeBuiltinComposerThemeOverrides({
      "blue-porcelain": everyColour,
    });
    const state = theme.resolvePluginThemeState(
      "blue-porcelain",
      "",
      serialized,
    );
    assert.equal(state.palette.accent, "#112233");
    assert.equal(state.palette.inputText, "system");
  });

  it("provides solid, readable surfaces for the redesigned themes", function () {
    const contrast = (foreground: string, background: string) => {
      const luminance = (hex: string) => {
        const channels = [1, 3, 5].map((start) => {
          const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
          return channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const values = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a,
      );
      return (values[0] + 0.05) / (values[1] + 0.05);
    };
    for (const id of [
      "eye-green",
      "warm-cream",
      "premium-gray",
      "midnight-black",
      "sakura-pink",
    ] as const) {
      const palette = theme.BUILTIN_COMPOSER_THEME_PALETTES[id];
      assert.match(palette.chatBg, /^#[0-9a-f]{6}$/i, id);
      for (const [foreground, background] of [
        [palette.text, palette.chatBg],
        [palette.mutedText, palette.chatBg],
        [palette.userBubbleText, palette.userBubbleBg],
        [palette.assistantBubbleText, palette.assistantBubbleBg],
        [palette.inputText, palette.inputBg],
        [palette.codeText, palette.codeBg],
      ]) {
        assert.isAtLeast(contrast(foreground, background), 4.5, id);
      }
    }
  });

  it("reads current prefs and applies the effective palette to one root", function () {
    setPluginPref("composerTheme", "blue-porcelain");
    setPluginPref(
      "composerThemeBuiltinOverrides",
      JSON.stringify({
        "blue-porcelain": { accent: "#112233", text: "#445566" },
      }),
    );
    const doc = new MockDocument();
    const root = createRoot(doc, "llm-main");

    theme.applyCurrentThemeToRoot(root as unknown as HTMLElement);

    assert.equal(root.dataset.composerTheme, "blue-porcelain");
    assert.equal(root.dataset.composerThemeSurface, "true");
    assert.equal(root.style["--llm-theme-accent"], "#112233");
    assert.equal(root.style["--llm-theme-chat-fg"], "#445566");
  });

  it("applies the current theme to open panels and external plugin surfaces", function () {
    setPluginPref("composerTheme", "blue-porcelain");
    setPluginPref(
      "composerThemeBuiltinOverrides",
      JSON.stringify({
        "blue-porcelain": { accent: "#abcdef", text: "#123456" },
      }),
    );
    const doc = new MockDocument();
    const panelRoot = createRoot(doc, "llm-main");
    const selectionPopup = createRoot(doc, "", "llm-selection-translate-wrap");
    mockMainWindows = [{ document: doc }];

    theme.applyCurrentThemeToAllSurfaces();

    assert.equal(panelRoot.style["--llm-theme-accent"], "#abcdef");
    assert.equal(selectionPopup.dataset.composerTheme, "blue-porcelain");
    assert.equal(selectionPopup.style["--llm-theme-chat-fg"], "#123456");
  });
});
