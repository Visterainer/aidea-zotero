import { assert } from "chai";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  buildUvDownloadEnv,
  chooseTranslationEnvAction,
  describeUnsupportedTranslationPlatform,
  parseTranslationEnvManifest,
  parseUnixPlatformProbe,
  resolveDownloadSources,
  selectRemovableEnvironmentDirs,
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

  it("rejects a lock with an unhashed or oddly hashed requirement", function () {
    const parsed = parseTranslationEnvManifest(manifest, 1);
    const hash = `--hash=sha256:${"a".repeat(64)}`;
    assert.throws(
      () =>
        validateTranslationRequirements(`${lock}\nextra-pkg==1.0\n`, parsed),
      /not hash-pinned/,
    );
    assert.throws(
      () =>
        validateTranslationRequirements(
          `${lock}\nextra-pkg==1.0 \\\n    --hash=md5:abc\n`,
          parsed,
        ),
      /not hash-pinned/,
    );
    assert.doesNotThrow(() =>
      validateTranslationRequirements(
        `${lock}\nextra-pkg==1.0 ; sys_platform == 'win32' \\\n    ${hash} \\\n    ${hash}\n`,
        parsed,
      ),
    );
  });

  it("refuses only platforms the pinned wheels cannot run on", function () {
    const check = describeUnsupportedTranslationPlatform;
    const linux = (output: string) =>
      check(parseUnixPlatformProbe("linux", output));
    assert.isNull(linux("x86_64\n6.8.0-45-generic\nglibc 2.39\n"));
    assert.isNull(linux("aarch64\n6.1.0\nldd (GNU libc) 2.28\n"));
    assert.match(
      linux("x86_64\n3.10.0\nldd (GNU libc) 2.17\n") || "",
      /glibc 2\.28/,
    );
    assert.match(linux("x86_64\n6.6.0\nmusl libc (x86_64)\n") || "", /musl/);
    assert.match(linux("armv7l\n6.1.0\nglibc 2.36\n") || "", /64-bit/);
    // Nothing known: allowed to try.
    assert.isNull(linux(""));
    const mac = (output: string) =>
      check(parseUnixPlatformProbe("macos", output));
    assert.isNull(mac("arm64\n27.2.0\n"));
    assert.isNull(mac("x86_64\n22.1.0\n"));
    assert.match(mac("x86_64\n21.6.0\n") || "", /macOS 13/);
    assert.isNull(check({ os: "windows", arch: ["AMD64", ""] }));
    assert.isNull(check({ os: "windows", arch: ["ARM64", ""] }));
    // 32-bit Zotero on 64-bit Windows.
    assert.isNull(check({ os: "windows", arch: ["x86", "AMD64"] }));
    assert.match(check({ os: "windows", arch: ["x86", ""] }) || "", /64-bit/);
  });

  it("chooses download sources from the preference and locale", function () {
    assert.deepEqual(resolveDownloadSources("", "en-US"), [
      "official",
      "mirror",
    ]);
    assert.deepEqual(resolveDownloadSources("auto", "zh-CN"), [
      "mirror",
      "official",
    ]);
    assert.deepEqual(resolveDownloadSources("", "zh-TW"), [
      "official",
      "mirror",
    ]);
    assert.deepEqual(resolveDownloadSources("mirror", "en-US"), ["mirror"]);
    assert.deepEqual(resolveDownloadSources("Official", "zh-CN"), ["official"]);
    assert.deepEqual(buildUvDownloadEnv("official"), {
      UV_HTTP_TIMEOUT: "120",
    });
    const mirror = buildUvDownloadEnv("mirror");
    assert.match(mirror.UV_DEFAULT_INDEX, /^https:\/\//);
    assert.equal(mirror.UV_INDEX_URL, mirror.UV_DEFAULT_INDEX);
    assert.match(mirror.UV_PYTHON_INSTALL_MIRROR, /^https:\/\//);
  });

  it("selects install, repair, update, and no-op actions", function () {
    assert.equal(chooseTranslationEnvAction(false, false, null, 1), "install");
    assert.equal(chooseTranslationEnvAction(true, false, 1, 1), "repair");
    assert.equal(chooseTranslationEnvAction(true, true, null, 1), "update");
    assert.equal(chooseTranslationEnvAction(true, true, 1, 2), "update");
    assert.equal(chooseTranslationEnvAction(true, true, 1, 1), "current");
  });

  it("removes only superseded, staging, and legacy environment directories", function () {
    const active = "aidea-translate-env-r3-0123abcd-k2j4h6g8";
    const previous = "aidea-translate-env-r2-89abcdef-a1b2c3d4";
    const superseded = "aidea-translate-env-r1-89abcdef-zzzz0000";
    const staging = "aidea-translate-env-r3-0123abcd-q9w8e7r6";
    const unrelated = [
      "aidea-translate-env-catalog.json",
      "aidea-translate-env-r3-0123abcd-k2j4h6g8.bak",
      "aidea-translate-env-rX-0123abcd-aaaa",
      "aidea-translate-env-backup",
      "my-aidea-translate-env",
      "zotero.sqlite",
      "storage",
    ];
    const entries = [
      active,
      previous,
      superseded,
      staging,
      "aidea-translate-env",
      "aidea-translate-conda-env",
      ...unrelated,
    ];
    assert.sameMembers(
      selectRemovableEnvironmentDirs(entries, active, previous),
      [superseded, staging, "aidea-translate-env", "aidea-translate-conda-env"],
    );
    assert.sameMembers(selectRemovableEnvironmentDirs(entries, active), [
      previous,
      superseded,
      staging,
      "aidea-translate-env",
      "aidea-translate-conda-env",
    ]);
    assert.notInclude(
      selectRemovableEnvironmentDirs(entries, active, previous.toUpperCase()),
      previous,
    );
  });

  it("removes nothing when the active environment is not a listed revisioned one", function () {
    const other = "aidea-translate-env-r1-89abcdef-zzzz0000";
    const entries = [other, "aidea-translate-env"];
    assert.isEmpty(
      selectRemovableEnvironmentDirs(entries, "aidea-translate-env"),
    );
    assert.isEmpty(selectRemovableEnvironmentDirs(entries, ""));
    assert.isEmpty(
      selectRemovableEnvironmentDirs(
        entries,
        "aidea-translate-env-r3-0123abcd-k2j4h6g8",
      ),
    );
    assert.isEmpty(selectRemovableEnvironmentDirs(entries, "../" + other));
  });
});
