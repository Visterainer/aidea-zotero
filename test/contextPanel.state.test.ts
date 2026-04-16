import { assert } from "chai";
import {
  beginPanelRequest,
  attachPanelAbortController,
  cancelPanelRequest,
  finishPanelRequest,
  getPanelAbortController,
  isPanelGenerating,
  isPanelRequestCancelled,
} from "../src/modules/contextPanel/state";

describe("contextPanel panel request state", function () {
  it("does not let an older request clear a newer active request", function () {
    const panel = {} as Element;

    beginPanelRequest(panel, 1);
    const controller1 = new AbortController();
    assert.isTrue(attachPanelAbortController(panel, 1, controller1));
    cancelPanelRequest(panel);
    assert.isTrue(controller1.signal.aborted);
    assert.isTrue(isPanelGenerating(panel));
    assert.isTrue(isPanelRequestCancelled(panel, 1));

    beginPanelRequest(panel, 2);
    const controller2 = new AbortController();
    assert.isTrue(attachPanelAbortController(panel, 2, controller2));
    assert.strictEqual(getPanelAbortController(panel), controller2);

    assert.isFalse(finishPanelRequest(panel, 1));
    assert.isTrue(isPanelGenerating(panel));
    assert.strictEqual(getPanelAbortController(panel), controller2);

    cancelPanelRequest(panel);
    assert.isTrue(controller2.signal.aborted);
    assert.isTrue(isPanelRequestCancelled(panel, 2));

    assert.isTrue(finishPanelRequest(panel, 2));
    assert.isFalse(isPanelGenerating(panel));
    assert.isNull(getPanelAbortController(panel));
  });

  it("rejects stale controller attachment after a newer request begins", function () {
    const panel = {} as Element;

    beginPanelRequest(panel, 10);
    beginPanelRequest(panel, 11);

    const staleController = new AbortController();
    assert.isFalse(attachPanelAbortController(panel, 10, staleController));
    assert.isTrue(staleController.signal.aborted);
    assert.isNull(getPanelAbortController(panel));
  });
});
