import { assert } from "chai";
import {
  fetchWithTransientRetry,
  isRetryableTransientError,
  parseHttpStatusFromErrorMessage,
  withTransientRetry,
} from "../src/utils/transientRetry";

describe("transientRetry", function () {
  it("parses HTTP status codes from direct and embedded messages", function () {
    assert.equal(parseHttpStatusFromErrorMessage("500 Internal Server Error"), 500);
    assert.equal(
      parseHttpStatusFromErrorMessage("Copilot OAuth HTTP 503: temporarily unavailable"),
      503,
    );
    assert.equal(parseHttpStatusFromErrorMessage("network error during streaming request"), null);
  });

  it("detects retryable transient errors without matching request errors", function () {
    assert.isTrue(
      isRetryableTransientError(new Error("500 Internal Server Error - upstream timeout")),
    );
    assert.isTrue(
      isRetryableTransientError(new Error("Network error during streaming request")),
    );
    assert.isFalse(
      isRetryableTransientError(new Error("400 Bad Request - temperature is not supported")),
    );
  });

  it("retries thrown transient errors until success", async function () {
    let attempts = 0;
    const result = await withTransientRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("500 Internal Server Error - temporarily unavailable");
        }
        return "ok";
      },
      {
        baseDelayMs: 1,
        maxDelayMs: 1,
        jitterMs: 0,
      },
    );
    assert.equal(result, "ok");
    assert.equal(attempts, 3);
  });

  it("retries fetch responses with transient status codes", async function () {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts < 3) {
        return new Response("upstream unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }
      return new Response('{"ok":true}', {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const res = await fetchWithTransientRetry(fetchImpl as typeof fetch, "https://example.test", undefined, {
      baseDelayMs: 1,
      maxDelayMs: 1,
      jitterMs: 0,
    });
    assert.equal(await res.text(), '{"ok":true}');
    assert.equal(attempts, 3);
  });

  it("does not retry non-transient fetch responses", async function () {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      return new Response("temperature unsupported", {
        status: 400,
        statusText: "Bad Request",
      });
    };

    const res = await fetchWithTransientRetry(fetchImpl as typeof fetch, "https://example.test");
    assert.equal(res.status, 400);
    assert.equal(await res.text(), "temperature unsupported");
    assert.equal(attempts, 1);
  });
});
