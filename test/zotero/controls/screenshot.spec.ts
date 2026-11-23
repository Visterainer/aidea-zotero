import { assert } from "chai";
import { captureRegion } from "../../../src/modules/contextPanel/screenshot";

const HTML = "http://www.w3.org/1999/xhtml";

function page(left: number, top: number, color: string) {
  const canvas = document.createElementNS(HTML, "canvas") as HTMLCanvasElement;
  canvas.width = 60;
  canvas.height = 40;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  canvas.getBoundingClientRect = () => new DOMRect(left, top, 30, 20);
  return canvas;
}

function frame(
  rect: DOMRect,
  contentDocument: Pick<Document, "querySelectorAll">,
) {
  return {
    contentDocument,
    getBoundingClientRect: () => rect,
    clientWidth: rect.width,
    clientHeight: rect.height,
    clientLeft: 0,
    clientTop: 0,
  };
}

describe("PDF screenshot capture in Zotero", function () {
  it("clips and combines both pages from the nested PDF.js view", async function () {
    const first = page(1, 1, "#ff0000");
    const second = page(1, 25, "#0000ff");
    const viewer = frame(new DOMRect(10, 20, 50, 60), {
      querySelectorAll: (selector: string) =>
        selector.startsWith("iframe") ? [] : [first, second],
    } as unknown as Document);
    const outer = frame(new DOMRect(100, 200, 100, 100), {
      querySelectorAll: (selector: string) =>
        selector.includes("viewer.html") ? [viewer] : [],
    } as unknown as Document);
    const win = {
      document: {
        querySelectorAll: () => [outer],
        createElement: (tag: string) => document.createElementNS(HTML, tag),
      },
    } as unknown as Window;

    const imageUrl = await captureRegion(win, 108, 216, 32, 54);
    assert.isString(imageUrl);
    const img = new Image();
    img.src = imageUrl!;
    await img.decode();

    const output = document.createElementNS(
      HTML,
      "canvas",
    ) as HTMLCanvasElement;
    output.width = img.naturalWidth;
    output.height = img.naturalHeight;
    assert.equal(output.width, 64);
    assert.equal(output.height, 108);
    const ctx = output.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const pixel = (x: number, y: number) =>
      Array.from(ctx.getImageData(x, y, 1, 1).data);
    assert.deepEqual(pixel(10, 16), [255, 0, 0, 255]);
    assert.deepEqual(pixel(10, 54), [255, 255, 255, 255]);
    assert.deepEqual(pixel(10, 72), [0, 0, 255, 255]);
    assert.deepEqual(pixel(2, 16), [255, 255, 255, 255]);
  });
});
