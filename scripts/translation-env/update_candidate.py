"""Create a candidate remote catalog; publishing remains a reviewed PR."""

import hashlib
import json
import pathlib
import subprocess
import urllib.request

from packaging.version import Version

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = ROOT / "site" / "public" / "translate-env"
manifest_path = CATALOG / "manifest.json"
manifest = json.loads(manifest_path.read_text())
requirements_path = CATALOG / "requirements.in"
requirements = requirements_path.read_text().splitlines()


def latest_version(name):
    request = urllib.request.Request(
        f"https://pypi.org/pypi/{name}/json",
        headers={"User-Agent": "AIdea-translation-env-update-check/1"},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)["info"]["version"]


updates = {
    "pdf2zh-next": latest_version("pdf2zh-next"),
    "babeldoc": latest_version("babeldoc"),
}
changed = False
for index, line in enumerate(requirements):
    for name, latest in updates.items():
        if line.startswith(f"{name}=="):
            current = line.split("==", 1)[1]
            if Version(latest) > Version(current):
                requirements[index] = f"{name}=={latest}"
                changed = True

if not changed:
    print("Translation environment is already using current upstream releases")
    raise SystemExit(0)

revision = manifest["revision"] + 1
requirements_path.write_text("\n".join(requirements) + "\n")
lock_path = CATALOG / f"requirements-{revision}.lock"
subprocess.run(
    [
        "uv", "pip", "compile", str(requirements_path),
        "--universal", "--python-version", "3.12", "--no-annotate",
        "--only-binary", ":all:",
        "--quiet", "--output-file", str(lock_path),
    ],
    check=True,
    cwd=ROOT,
)
contents = lock_path.read_bytes()
manifest["revision"] = revision
manifest["requirementsUrl"] = (
    "https://visterainer.github.io/aidea-zotero/translate-env/"
    f"requirements-{revision}.lock"
)
manifest["requirementsSha256"] = hashlib.sha256(contents).hexdigest()
manifest["versions"].update(updates)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Created candidate translation environment revision {revision}")
