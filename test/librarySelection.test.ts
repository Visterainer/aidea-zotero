import { assert } from "chai";
import {
  getLibraryPanelDisplayState,
  getLibrarySelectedItemIds,
  getLibrarySelectionState,
  getLibrarySelectionStateFromWindow,
  isManagedLibraryPanelSectionEnabled,
  resolveLibraryPanelDisplayState,
} from "../src/modules/contextPanel/librarySelection";
import { resolveActiveLibraryID } from "../src/modules/contextPanel/portalScope";

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

  describe("active library scope", function () {
    let originalZotero: unknown;
    let pane: Record<string, unknown>;

    beforeEach(function () {
      originalZotero = (globalThis as Record<string, unknown>).Zotero;
      pane = {};
      (globalThis as Record<string, unknown>).Zotero = {
        getActiveZoteroPane: () => pane,
        Libraries: { userLibraryID: 1 },
      };
    });

    afterEach(function () {
      (globalThis as Record<string, unknown>).Zotero = originalZotero;
    });

    it("uses Zotero 10's plural API without calling the removed getter", function () {
      pane.getSelectedLibraryIDs = () => [42];
      let legacyCalled = false;
      pane.getSelectedLibraryID = () => {
        legacyCalled = true;
        throw new Error("Use getSelectedLibraryIDs() instead");
      };

      assert.equal(resolveActiveLibraryID(), 42);
      assert.isFalse(legacyCalled);
    });

    it("keeps the singular API fallback for Zotero 7 through 9", function () {
      pane.getSelectedLibraryID = () => 42;
      assert.equal(resolveActiveLibraryID(), 42);
    });

    it("normalizes and deduplicates selected library IDs", function () {
      pane.getSelectedLibraryIDs = () => [null, 0, "42", 42, "invalid"];
      assert.equal(resolveActiveLibraryID(), 42);
    });

    it("uses the selected items' library when several libraries are selected", function () {
      pane.getSelectedLibraryIDs = () => [42, 84];
      pane.getSelectedItems = () => [{ libraryID: 84 }, { libraryID: 84 }];
      assert.equal(resolveActiveLibraryID(), 84);
    });

    it("does not pick an arbitrary library for items spanning libraries", function () {
      pane.getSelectedLibraryIDs = () => [42, 84];
      pane.getSelectedItems = () => [{ libraryID: 42 }, { libraryID: 84 }];
      assert.equal(resolveActiveLibraryID(), 1);
    });

    it("uses the personal library for a multi-library selection without items", function () {
      pane.getSelectedLibraryIDs = () => [42, 84];
      assert.equal(resolveActiveLibraryID(), 1);
    });

    it("still checks selected items when the library getter throws", function () {
      pane.getSelectedLibraryID = () => {
        throw new Error("Library selection unavailable");
      };
      pane.getSelectedItems = () => [{ libraryID: 42 }];
      assert.equal(resolveActiveLibraryID(), 42);
    });

    it("does not call the legacy getter when the plural selection is empty", function () {
      pane.getSelectedLibraryIDs = () => [];
      pane.getSelectedLibraryID = () => 84;
      pane.getSelectedItems = () => [{ libraryID: 42 }];
      assert.equal(resolveActiveLibraryID(), 42);
    });

    it("falls back safely when no selection can be read", function () {
      pane.getSelectedLibraryIDs = () => {
        throw new Error("Library selection unavailable");
      };
      pane.getSelectedItems = () => {
        throw new Error("Item selection unavailable");
      };
      assert.equal(resolveActiveLibraryID(), 1);
    });
  });
});
