import { assert } from "chai";
import {
  correctEpubPageBoundary,
  resolveEpubNavigationLocation,
  type EpubNavigationView,
} from "../src/modules/contextPanel/document/epub/navigation";

function fixture(left = 10353.1338) {
  let turns = 0;
  const rect = { left, top: 20, width: 315.5333, height: 100 };
  const target = { getClientRects: () => [rect] };
  const view: EpubNavigationView = {
    _iframeWindow: { innerWidth: 396, innerHeight: 480 },
    flow: { _spreadWidth: 10315, _spreadHeight: 10440 },
    _getHrefTarget: () => target,
    getRange: () => ({ toRange: () => target }),
    navigateToNextPage: () => {
      turns++;
      if (view.flow?._isVertical) rect.top -= 10440;
      else rect.left -= 10315;
    },
  };
  return { view, rect, turns: () => turns };
}

describe("EPUB fractional page boundary navigation", function () {
  it("corrects the measured Zotero boundary error exactly once", function () {
    const f = fixture();
    assert.isTrue(correctEpubPageBoundary(f.view, { href: "book.xhtml#two" }));
    assert.closeTo(f.rect.left, 38.1338, 0.001);
    assert.isFalse(correctEpubPageBoundary(f.view, { href: "book.xhtml#two" }));
    assert.equal(f.turns(), 1);
  });

  it("resolves native CFI persistent ranges without changing the CFI", function () {
    const f = fixture();
    const cfi = "epubcfi(/6/2!/4/4)";
    const original = f.view.getRange!;
    f.view.getRange = (value) => {
      assert.equal(value, cfi);
      return original(value);
    };
    assert.isTrue(correctEpubPageBoundary(f.view, { pageNumber: cfi }));
    assert.equal(f.turns(), 1);
  });

  it("leaves visible anchors and distant or missing targets alone", function () {
    for (const left of [38, -20, 25000]) {
      const f = fixture(left);
      assert.isFalse(correctEpubPageBoundary(f.view, { href: "book.xhtml" }));
      assert.equal(f.turns(), 0);
    }
    const f = fixture();
    f.view._getHrefTarget = () => null;
    assert.isFalse(correctEpubPageBoundary(f.view, { href: "missing.xhtml" }));
    assert.equal(f.turns(), 0);
  });

  it("uses the vertical axis for vertical pagination", function () {
    const f = fixture(20);
    f.view.flow!._isVertical = true;
    f.rect.top = 10460;
    assert.isTrue(correctEpubPageBoundary(f.view, { href: "book.xhtml#two" }));
    assert.equal(f.rect.top, 20);
    assert.equal(f.turns(), 1);
  });

  it("does not alter scrolling mode or readers lacking optional internals", function () {
    assert.isFalse(correctEpubPageBoundary(undefined, { href: "book.xhtml" }));
    const f = fixture();
    delete f.view.flow!._spreadWidth;
    assert.isFalse(correctEpubPageBoundary(f.view, { href: "book.xhtml" }));
    assert.equal(f.turns(), 0);
  });

  it("corrects a short final spread when native Next refuses the rounded boundary", function () {
    const f = fixture();
    const calls: string[] = [];
    f.view.navigateToNextPage = () => calls.push("next");
    Object.assign(f.view.flow!, {
      _offsetLeft: 0,
      _offsetTop: 0,
      _setOffset(left: number, top: number) {
        assert.equal(left, 10315);
        assert.equal(top, 0);
        f.rect.left -= left;
        calls.push("offset");
      },
      _refreshUserAnchor: () => calls.push("anchor"),
      _onViewUpdate: () => calls.push("update"),
    });
    assert.isTrue(correctEpubPageBoundary(f.view, { href: "book.xhtml#two" }));
    assert.deepEqual(calls, ["next", "offset", "anchor", "update"]);
  });

  it("normalizes element CFIs to text points but leaves existing text CFIs intact", function () {
    const text = { nodeType: 3, textContent: "Chapter Two" };
    const range = {
      setStart(node: unknown, offset: number) {
        assert.strictEqual(node, text);
        assert.equal(offset, 0);
      },
      collapse(start: boolean) {
        assert.isTrue(start);
      },
    };
    const root = {
      nodeType: 1,
      ownerDocument: {
        createTreeWalker: () => ({ nextNode: () => text }),
        createRange: () => range,
      },
    };
    const point = {
      collapsed: true,
      startContainer: { nodeType: 1, childNodes: [root] } as unknown as Node,
      startOffset: 0,
    };
    const view: EpubNavigationView = {
      getRange: () => ({ toRange: () => point }),
      getCFI(r) {
        assert.strictEqual(r as unknown, range);
        return { toString: () => "epubcfi(/6/2!/4/4/2/1:0)" };
      },
    };
    const input = { pageNumber: "epubcfi(/6/2!/4/4[two])" };
    assert.deepEqual(resolveEpubNavigationLocation(view, input), {
      pageNumber: "epubcfi(/6/2!/4/4/2/1:0)",
    });
    point.startContainer = text as unknown as Node;
    assert.strictEqual(resolveEpubNavigationLocation(view, input), input);
    assert.strictEqual(resolveEpubNavigationLocation(undefined, input), input);
  });
});
