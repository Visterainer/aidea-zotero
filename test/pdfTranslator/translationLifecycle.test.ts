import { assert } from "chai";

import { restartPausedTranslation } from "../../src/modules/pdfTranslator/translationLifecycle";

describe("pdfTranslator pause/resume lifecycle", function () {
  it("clears the paused controller and starts a fresh bridge", async function () {
    const oldController = { id: "paused" };
    const session = { isPaused: true, activeController: oldController };
    let restartCount = 0;

    restartPausedTranslation(
      session,
      async () => {
        restartCount += 1;
      },
      () => assert.fail("restart should not fail"),
    );
    await Promise.resolve();

    assert.isFalse(session.isPaused);
    assert.isNull(session.activeController);
    assert.equal(restartCount, 1);
  });

  it("reports a restart rejection to the UI error callback", async function () {
    const session = { isPaused: true, activeController: {} };
    let reported: unknown;

    restartPausedTranslation(
      session,
      async () => {
        throw new Error("restart failed");
      },
      (error) => {
        reported = error;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.instanceOf(reported, Error);
    assert.equal((reported as Error).message, "restart failed");
  });
});
