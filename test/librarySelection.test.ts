import { assert } from "chai";
import {
  getLibraryPanelDisplayState,
  getLibrarySelectedItemIds,
  getLibrarySelectionState,
  getLibrarySelectionStateFromWindow,
  isManagedLibraryPanelSectionEnabled,
  resolveLibraryPanelDisplayState,
} from "../src/modules/contextPanel/librarySelection";

describe("librarySelection", function () {
  it("classifies no selected items as empty", function () {
    assert.equal(getLibrarySelectionState([]), "empty");
    assert.equal(getLibrarySelectionState(null), "empty");
    assert.equal(getLibrarySelectionState(undefined), "empty");
  });

  it("classifies one valid selected item as single", function () {
    assert.equal(getLibrarySelectionState([{ id: 42 }]), "single");
  });

  it("classifies more than one valid selected item as multiple", function () {
    assert.equal(
      getLibrarySelectionState([{ id: 42 }, { id: "43" }]),
      "multiple",
    );
  });

  it("ignores invalid selected item IDs", function () {
    assert.equal(
      getLibrarySelectionState([
        null,
        undefined,
        { id: 0 },
        { id: -1 },
        { id: Number.NaN },
        { id: "abc" },
      ]),
      "empty",
    );
  });

  it("dedupes and sorts selected item IDs", function () {
    assert.deepEqual(
      getLibrarySelectedItemIds([{ id: 3 }, { id: 1 }, { id: "3" }]),
      [1, 3],
    );
  });

  it("reads selected items from a Zotero window-like object", function () {
    const win = {
      ZoteroPane: {
        getSelectedItems: () => [{ id: 1 }, { id: 2 }],
      },
    };

    assert.equal(getLibrarySelectionStateFromWindow(win), "multiple");
  });

  it("falls back to empty when selected items cannot be read", function () {
    const win = {
      ZoteroPane: {
        getSelectedItems: () => {
          throw new Error("boom");
        },
      },
    };

    assert.equal(getLibrarySelectionStateFromWindow(win), "empty");
  });

  it("maps empty selection to active standalone library panel", function () {
    assert.deepEqual(getLibraryPanelDisplayState("empty"), {
      selectionState: "empty",
      nativeMode: "message",
      managedSectionEnabled: false,
      standaloneButtonVisible: true,
      standalonePanelVisible: true,
      standalonePanelPlacement: "replace",
    });
  });

  it("maps single selection to Zotero-managed item pane section", function () {
    assert.deepEqual(getLibraryPanelDisplayState("single"), {
      selectionState: "single",
      nativeMode: "item",
      managedSectionEnabled: true,
      standaloneButtonVisible: false,
      standalonePanelVisible: false,
      standalonePanelPlacement: null,
    });
    assert.isTrue(isManagedLibraryPanelSectionEnabled("single"));
  });

  it("maps multiple selection to native message with appended AIdea panel", function () {
    assert.deepEqual(getLibraryPanelDisplayState("multiple"), {
      selectionState: "multiple",
      nativeMode: "message",
      managedSectionEnabled: false,
      standaloneButtonVisible: true,
      standalonePanelVisible: true,
      standalonePanelPlacement: "append",
    });
    assert.isFalse(isManagedLibraryPanelSectionEnabled("multiple"));
  });

  it("keeps multiple selection panel appended after manual activation", function () {
    assert.deepEqual(getLibraryPanelDisplayState("multiple", true), {
      selectionState: "multiple",
      nativeMode: "message",
      managedSectionEnabled: false,
      standaloneButtonVisible: true,
      standalonePanelVisible: true,
      standalonePanelPlacement: "append",
    });
  });

  it("keeps multiple selection panel appended without manual activation", function () {
    assert.isTrue(
      getLibraryPanelDisplayState("multiple", true).standalonePanelVisible,
    );
    assert.isTrue(
      getLibraryPanelDisplayState("multiple", false).standalonePanelVisible,
    );
  });

  it("resets manual standalone activation when selection signature changes", function () {
    const resolution = resolveLibraryPanelDisplayState({
      selectionState: "multiple",
      selectionSignature: "1,2,3",
      previousSelectionState: "multiple",
      previousSelectionSignature: "1,2",
      manualStandaloneActive: true,
    });

    assert.isTrue(resolution.selectionChanged);
    assert.isFalse(resolution.manualStandaloneActive);
    assert.isTrue(resolution.displayState.standalonePanelVisible);
  });
});
