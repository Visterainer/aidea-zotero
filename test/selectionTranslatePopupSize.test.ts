import { assert } from "chai";
import {
  getPanelTypographySettings,
  getSelectionTranslatePopupHeight,
  resetPanelTypographySettings,
  setSelectionTranslatePopupHeight,
  setSelectionTranslatePopupSize,
  setSelectionTranslatePopupWidth,
} from "../src/modules/contextPanel/prefHelpers";
import {
  getSelectionTranslateContentHeight,
  getSelectionTranslateDefaultHeightCap,
  getSelectionTranslateMeasuredHeight,
  getSelectionTranslateSingleLineHeight,
  resolveSelectionTranslateContentHeight,
  scheduleSelectionTranslateLayout,
} from "../src/modules/contextPanel/selectionTranslatePopupSize";

describe("selection translate popup size preferences", function () {
  let previousZotero: unknown;
  let prefs: Map<string, string | number | boolean>;

  beforeEach(function () {
    previousZotero = (globalThis as any).Zotero;
    prefs = new Map();
    (globalThis as any).Zotero = {
      Prefs: {
        get(key: string) {
          return prefs.get(key);
        },
        set(key: string, value: string | number | boolean) {
          prefs.set(key, value);
        },
      },
    };
  });

  afterEach(function () {
    (globalThis as any).Zotero = previousZotero;
  });

  it("uses automatic height until a manual size is stored", function () {
    assert.isNull(getSelectionTranslatePopupHeight());
    assert.equal(getPanelTypographySettings().selectionPopupWidth, 480);
  });

  it("clamps manual height to one complete line", function () {
    const stored = setSelectionTranslatePopupSize(100, 10, 44);

    assert.deepEqual(stored, { width: 184, height: 44 });
    assert.equal(getSelectionTranslatePopupHeight(), 44);
  });

  it("clamps and persists the maximum popup size", function () {
    const stored = setSelectionTranslatePopupSize(2000, 2000);

    assert.deepEqual(stored, { width: 900, height: 720 });
    assert.equal(getSelectionTranslatePopupHeight(), 720);
  });

  it("persists width and height independently", function () {
    setSelectionTranslatePopupSize(640, 300);

    assert.equal(setSelectionTranslatePopupWidth(700), 700);
    assert.equal(getPanelTypographySettings().selectionPopupWidth, 700);
    assert.equal(
      getSelectionTranslatePopupHeight(),
      300,
      "a width-only drag must preserve the previous height cap",
    );

    assert.equal(setSelectionTranslatePopupHeight(360, 44), 360);
    assert.equal(getSelectionTranslatePopupHeight(), 360);
    assert.equal(
      getPanelTypographySettings().selectionPopupWidth,
      700,
      "a height-only drag must preserve the previous width",
    );
  });

  it("clears the manual height when typography settings are reset", function () {
    setSelectionTranslatePopupSize(640, 420);
    assert.equal(getSelectionTranslatePopupHeight(), 420);

    resetPanelTypographySettings();

    assert.isNull(getSelectionTranslatePopupHeight());
  });

  it("calculates a one-line minimum from typography and box chrome", function () {
    assert.equal(
      getSelectionTranslateSingleLineHeight({
        fontSize: 14,
        lineHeight: 1.55,
      }),
      44,
    );
  });

  it("treats remembered height as a content height cap", function () {
    assert.equal(
      getSelectionTranslateContentHeight({
        contentHeight: 120,
        minimumHeight: 44,
        heightCap: 240,
      }),
      120,
      "short content hugs its content height",
    );
    assert.equal(
      getSelectionTranslateContentHeight({
        contentHeight: 400,
        minimumHeight: 44,
        heightCap: 240,
      }),
      240,
      "long content stops at the remembered height",
    );
    assert.equal(
      getSelectionTranslateContentHeight({
        contentHeight: 20,
        minimumHeight: 44,
        heightCap: 30,
      }),
      44,
      "font changes can raise the runtime minimum without rewriting storage",
    );
  });

  it("uses one line instead of 120px as the default minimum", function () {
    assert.equal(
      getSelectionTranslateDefaultHeightCap({
        viewerHeight: 200,
        minimumHeight: 44,
      }),
      84,
    );
    assert.equal(
      getSelectionTranslateDefaultHeightCap({
        viewerHeight: 80,
        minimumHeight: 44,
      }),
      44,
    );
    assert.equal(
      getSelectionTranslateDefaultHeightCap({
        viewerHeight: 1200,
        minimumHeight: 44,
      }),
      320,
    );
  });

  it("resolves automatic and remembered height caps against content", function () {
    assert.equal(
      resolveSelectionTranslateContentHeight({
        contentHeight: 60,
        viewerHeight: 600,
        minimumHeight: 44,
        rememberedHeight: null,
      }),
      60,
      "automatic mode keeps short content tight",
    );
    assert.equal(
      resolveSelectionTranslateContentHeight({
        contentHeight: 400,
        viewerHeight: 600,
        minimumHeight: 44,
        rememberedHeight: null,
      }),
      252,
      "automatic mode caps long content at 42% of the viewer",
    );
    assert.equal(
      resolveSelectionTranslateContentHeight({
        contentHeight: 120,
        viewerHeight: 600,
        minimumHeight: 44,
        rememberedHeight: 240,
      }),
      120,
      "remembered mode keeps short content tight",
    );
    assert.equal(
      resolveSelectionTranslateContentHeight({
        contentHeight: 400,
        viewerHeight: 600,
        minimumHeight: 44,
        rememberedHeight: 240,
      }),
      240,
      "remembered mode caps long content at the dragged height",
    );
    assert.equal(
      resolveSelectionTranslateContentHeight({
        contentHeight: 400,
        viewerHeight: 600,
        minimumHeight: 44,
        rememberedHeight: 20,
      }),
      44,
      "a stale remembered height cannot hide the complete first line",
    );
  });

  it("reads the latest height when a deferred layout actually runs", function () {
    const queuedFrames: Array<() => void> = [];
    const appliedHeights: number[] = [];
    let currentHeight = 44;

    scheduleSelectionTranslateLayout({
      scheduleFrame(callback) {
        queuedFrames.push(callback);
      },
      readLayoutState() {
        return { preferredHeight: currentHeight };
      },
      applyLayout(state) {
        appliedHeights.push(state.preferredHeight);
      },
    });

    currentHeight = 240;
    queuedFrames[0]();

    assert.deepEqual(appliedHeights, [240]);
  });

  it("does not let a small visible box hide a larger scroll height", function () {
    assert.equal(
      getSelectionTranslateMeasuredHeight({
        boundingHeight: 44,
        offsetHeight: 44,
        scrollHeight: 260,
        minimumHeight: 44,
      }),
      260,
    );
  });
});
