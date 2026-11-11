"""Embed the currently published catalog as the plugin's offline fallback."""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = ROOT / "site" / "public" / "translate-env"
manifest = json.loads((CATALOG / "manifest.json").read_text())
lock = (CATALOG / f"requirements-{manifest['revision']}.lock").read_text()
out = ROOT / "src" / "modules" / "pdfTranslator" / "bundledEnvironment.ts"
out.write_text(
    f"/* Generated from translation environment revision {manifest['revision']}. */\n"
    f"export const BUNDLED_ENV_MANIFEST = {json.dumps(manifest, separators=(',', ':'))} as const;\n"
    f"export const BUNDLED_ENV_REQUIREMENTS = {json.dumps(lock)};\n"
)
print(f"Embedded translation environment revision {manifest['revision']}")
