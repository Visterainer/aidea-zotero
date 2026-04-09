"""
test/pdfTranslator/test_bridge.py

Tests for aidea_bridge.py progress parsing logic.
Run: python test/pdfTranslator/test_bridge.py
"""

import sys
import os

# Add addon/scripts to path so we can import the bridge
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "addon", "scripts"))

from aidea_bridge import parse_progress, make_progress, write_progress

passed = 0
failed = 0


def assert_eq(actual, expected, msg):
    global passed, failed
    if actual == expected:
        print(f"  ✅ {msg}")
        passed += 1
    else:
        print(f"  ❌ {msg}: expected {expected!r}, got {actual!r}")
        failed += 1


# ── parse_progress tests ──

print("\n=== parse_progress: N/M pattern ===")
result = parse_progress("Translating: 45%|████   | 9/20 [00:12<00:15]")
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

# ── make_progress tests ──

print("\n=== make_progress ===")
p = make_progress("running", 50, "test", current=5, total=10)
assert_eq(p["status"], "running", "status")
assert_eq(p["progress"], 50, "progress")
assert_eq(p["message"], "test", "message")
assert_eq(p["current"], 5, "current")
assert_eq(p["total"], 10, "total")

# ── write_progress tests ──

print("\n=== write_progress (atomic write) ===")
import tempfile
import json

with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
    tmp_path = f.name

try:
    write_progress(tmp_path, {"status": "done", "progress": 100, "message": "ok"})
    with open(tmp_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert_eq(data["status"], "done", "written status")
    assert_eq(data["progress"], 100, "written progress")
    assert_eq(data["message"], "ok", "written message")

    # Verify .tmp is cleaned up
    assert_eq(os.path.exists(tmp_path + ".tmp"), False, ".tmp file cleaned up")
finally:
    os.unlink(tmp_path)

# ── Summary ──

print(f"\n{'=' * 40}")
print(f"Results: {passed} passed, {failed} failed")
if failed > 0:
    sys.exit(1)
