import { assert } from "chai";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  chooseTranslationEnvAction,
  parseTranslationEnvManifest,
  validateTranslationRequirements,
} from "../../src/modules/pdfTranslator/environmentPolicy";

const catalogDir = new URL("../../site/public/translate-env/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", catalogDir), "utf8"),
);
const lock = readFileSync(
  new URL(`requirements-${manifest.revision}.lock`, catalogDir),
  "utf8",
);

describe("translation environment policy", function () {
  it("accepts the published lock and its checksum", function () {
    const parsed = parseTranslationEnvManifest(manifest, 1);
    validateTranslationRequirements(lock, parsed);
    assert.equal(
      createHash("sha256").update(lock).digest("hex"),
      parsed.requirementsSha256,
    );
  });

  it("rejects an untrusted URL and an incompatible bridge API", function () {
    assert.throws(() =>
      parseTranslationEnvManifest(
        {
          ...manifest,
          requirementsUrl: "https://example.com/requirements.lock",
        },
        1,
      ),
    );
    assert.throws(() =>
      parseTranslationEnvManifest({ ...manifest, bridgeApi: 2 }, 1),
    );
  });

  it("rejects installer directives and unexpected engine versions", function () {
    const parsed = parseTranslationEnvManifest(manifest, 1);
    assert.throws(() =>
      validateTranslationRequirements(
        `${lock}\n--extra-index-url https://example.com\n`,
        parsed,
      ),
    );
    assert.throws(() =>
      validateTranslationRequirements(
        lock.replace("bitstring==4.4.0", "bitstring==5.0.0"),
        parsed,
      ),
    );
  });

  it("selects install, repair, update, and no-op actions", function () {
    assert.equal(chooseTranslationEnvAction(false, false, null, 1), "install");
    assert.equal(chooseTranslationEnvAction(true, false, 1, 1), "repair");
    assert.equal(chooseTranslationEnvAction(true, true, null, 1), "update");
    assert.equal(chooseTranslationEnvAction(true, true, 1, 2), "update");
    assert.equal(chooseTranslationEnvAction(true, true, 1, 1), "current");
  });
});
