"""
test/pdfTranslator/test_bridge.py

Tests for aidea_bridge.py helpers.
Run: python test/pdfTranslator/test_bridge.py
"""

import json
import os
import sys
import tempfile

# Add addon/scripts to path so we can import the bridge.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "addon", "scripts"))

from aidea_bridge import (  # noqa: E402
    _as_bool,
    _rewrite_translation_custom_prompt,
    _sanitize_multiline_prompt,
    build_author_protection_prompt,
    build_pages_spec,
    make_progress,
    parse_progress,
    write_progress,
)

passed = 0
failed = 0


def assert_eq(actual, expected, msg):
    global passed, failed
    if actual == expected:
        print(f"  [OK] {msg}")
        passed += 1
    else:
        print(f"  [FAIL] {msg}: expected {expected!r}, got {actual!r}")
        failed += 1


print("\n=== parse_progress: N/M pattern ===")
result = parse_progress("Translating: 45%|███   | 9/20 [00:12<00:15]")
assert_eq(result, (9, 20, 45), "tqdm-style progress line")

result = parse_progress("Processing page 3/10")
assert_eq(result, (3, 10, 30), "simple N/M pattern")

result = parse_progress("1/1 complete")
assert_eq(result, (1, 1, 100), "1/1 = 100%")

print("\n=== parse_progress: percentage pattern ===")
result = parse_progress("Progress: 75%")
assert_eq(result is not None, True, "matches percentage")
if result:
    assert_eq(result[2], 75, "extracts 75%")

print("\n=== parse_progress: no match ===")
result = parse_progress("Loading model...")
assert_eq(result, None, "no numbers = None")

result = parse_progress("")
assert_eq(result, None, "empty string = None")

result = parse_progress("Using BabelDOC v1.2.3")
assert_eq(result, None, "version string not matched as progress")

print("\n=== make_progress ===")
p = make_progress("running", 50, "test", current=5, total=10)
assert_eq(p["status"], "running", "status")
assert_eq(p["progress"], 50, "progress")
assert_eq(p["message"], "test", "message")
assert_eq(p["current"], 5, "current")
assert_eq(p["total"], 10, "total")

print("\n=== build_pages_spec ===")
assert_eq(build_pages_spec([1, 2, 3, 5, 7, 8]), "1-3,5,7-8", "compress page ranges")
assert_eq(build_pages_spec([4]), "4", "single page range")
assert_eq(build_pages_spec([]), "", "empty page list")

print("\n=== _as_bool ===")
assert_eq(_as_bool(True), True, "bool true")
assert_eq(_as_bool("true"), True, "string true")
assert_eq(_as_bool("0"), False, "string false")
assert_eq(_as_bool(None, True), True, "default value")

print("\n=== build_author_protection_prompt ===")
prompt = build_author_protection_prompt(["Alice A.", "alice@example.com", "University of Example"])
assert_eq("Alice A." in prompt, True, "contains protected person name")
assert_eq("alice@example.com" in prompt, True, "contains protected email")
assert_eq("University of Example" in prompt, True, "contains protected organization")

print("\n=== _sanitize_multiline_prompt ===")
cleaned = _sanitize_multiline_prompt("line1\nline2\t\u0001bad")
assert_eq(cleaned, "line1\nline2 bad", "removes control chars and keeps newlines")

print("\n=== write_progress (atomic write) ===")
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
    tmp_path = f.name

try:
    write_progress(tmp_path, {"status": "done", "progress": 100, "message": "ok"})
    with open(tmp_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert_eq(data["status"], "done", "written status")
    assert_eq(data["progress"], 100, "written progress")
    assert_eq(data["message"], "ok", "written message")
    assert_eq(os.path.exists(tmp_path + ".tmp"), False, ".tmp file cleaned up")
finally:
    os.unlink(tmp_path)

print("\n=== _rewrite_translation_custom_prompt ===")
cfg_fd, cfg_path = tempfile.mkstemp(suffix=".toml")
os.close(cfg_fd)
try:
    with open(cfg_path, "w", encoding="utf-8") as f:
        f.write(
            '[translation]\n'
            'custom_system_prompt = "broken line1\nline2"\n'
            'lang_in = "en"\n'
        )
    _rewrite_translation_custom_prompt(cfg_path, "a\nb")
    with open(cfg_path, "r", encoding="utf-8") as f:
        rewritten = f.read()
    assert_eq(rewritten.count("custom_system_prompt = "), 1, "single custom prompt entry after rewrite")
    assert_eq("\\n" in rewritten, True, "prompt newline escaped in TOML string")
finally:
    os.unlink(cfg_path)

print(f"\n{'=' * 40}")
print(f"Results: {passed} passed, {failed} failed")
if failed > 0:
    sys.exit(1)
