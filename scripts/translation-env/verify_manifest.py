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

packages = {}
for raw in contents.splitlines():
    line = raw.strip()
    if not line or line.startswith("#"):
        continue
    match = re.fullmatch(
        r"([A-Za-z0-9][A-Za-z0-9._-]*)==([A-Za-z0-9][A-Za-z0-9.!+_-]*)"
        r"(?:\s*;\s*[A-Za-z0-9_ .<>=!'\"(),-]+)?",
        line,
    )
    assert match, f"Unsafe requirement: {line}"
    packages.setdefault(match.group(1).lower().replace("_", "-"), set()).add(
        match.group(2)
    )

for name, version in MANIFEST["versions"].items():
    assert packages[name] == {version}, f"{name} not pinned to {version}"

print(f"Validated translation environment revision {REVISION}: {len(packages)} packages")
if len(sys.argv) > 1 and sys.argv[1] == "--print-lock-path":
    print(LOCK)
