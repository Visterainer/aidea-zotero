"""Validate the static translation environment catalog before publishing."""

import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = ROOT / "site" / "public" / "translate-env"
MANIFEST = json.loads((CATALOG / "manifest.json").read_text())
REVISION = MANIFEST["revision"]
LOCK = CATALOG / f"requirements-{REVISION}.lock"
URL = (
    "https://visterainer.github.io/aidea-zotero/translate-env/"
    f"requirements-{REVISION}.lock"
)

assert MANIFEST["schemaVersion"] == 1
assert MANIFEST["bridgeApi"] == 1
assert MANIFEST["python"] == "3.12"
assert isinstance(REVISION, int) and REVISION >= 1
assert MANIFEST["requirementsUrl"] == URL
contents = LOCK.read_text()
assert hashlib.sha256(contents.encode()).hexdigest() == MANIFEST["requirementsSha256"]

assert len(contents) <= 1_000_000, "Lock too large for the plugin to accept"
packages = {}
# Each pin is followed by the hashes of its files on continuation lines.
for raw in re.sub(r"[ \t]*\\\r?\n", " ", contents).splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    pin, *hashes = re.split(r"\s+(?=--hash=)", line)
    match = re.fullmatch(
        r"([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9][A-Za-z0-9.!+_-]*)"
        r"(?:\s*;\s*[A-Za-z0-9_ .<>=!'\"(),-]+)?",
        pin.strip(),
    )
    assert match, f"Unsafe requirement: {line[:80]}"
    assert hashes and all(
        re.fullmatch(r"--hash=sha256:[a-f0-9]{64}", token.strip()) for token in hashes
    ), f"Requirement is not hash-pinned: {match.group(1)}"
    packages.setdefault(match.group(1).lower().replace("_", "-"), set()).add(
        match.group(2)
    )

for name, version in MANIFEST["versions"].items():
    assert packages[name] == {version}, f"{name} not pinned to {version}"

print(f"Validated translation environment revision {REVISION}: {len(packages)} packages")
if len(sys.argv) > 1 and sys.argv[1] == "--print-lock-path":
    print(LOCK)
