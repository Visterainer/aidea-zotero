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

import aidea_bridge as bridge  # noqa: E402

from aidea_bridge import (  # noqa: E402
    OAuthCompatProxyServer,
    _as_bool,
    _build_copilot_dynamic_headers,
    _collect_author_block_terms_from_lines,
    _derive_copilot_api_base_url,
    _http_post_json_with_retry,
    _is_benign_pdf2zh_cleanup_trace_line,
    _is_retryable_transport_error,
    _resolve_copilot_transport_kind,
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
assert_eq(
    "surrounding title-page prose" in prompt,
    True,
    "allows non-entity title-page prose to translate",
)

print("\n=== author block term extraction ===")
terms = _collect_author_block_terms_from_lines([
    "Provided proper attribution is provided, Google hereby grants permission to",
    "Attention Is All You Need",
    "Ashish Vaswani*",
    "Google Brain",
    "avaswani@google.com",
    "University of Toronto",
])
assert_eq("Ashish Vaswani*" in terms, True, "keeps author names as protected entities")
assert_eq("Google Brain" in terms, True, "keeps institution names as protected entities")
assert_eq("avaswani@google.com" in terms, True, "keeps email addresses as protected entities")
assert_eq("Attention Is All You Need" in terms, False, "does not protect paper titles")
assert_eq(
    "Provided proper attribution is provided, Google hereby grants permission to" in terms,
    False,
    "does not protect copyright prose",
)

print("\n=== _sanitize_multiline_prompt ===")
cleaned = _sanitize_multiline_prompt("line1\nline2\t\u0001bad")
assert_eq(cleaned, "line1\nline2 bad", "removes control chars and keeps newlines")

print("\n=== Copilot proxy helpers ===")
headers = _build_copilot_dynamic_headers()
assert_eq(headers.get("Editor-Version"), "vscode/1.96.2", "includes Copilot IDE editor header")
assert_eq(headers.get("Copilot-Integration-Id"), "vscode-chat", "includes Copilot integration header")
assert_eq(
    _derive_copilot_api_base_url("abc;proxy-ep=proxy.business.githubcopilot.com;xyz"),
    "https://api.business.githubcopilot.com",
    "derives Copilot API base from exchanged token",
)
assert_eq(
    _resolve_copilot_transport_kind("claude-haiku-4.5", ["/chat/completions", "/v1/messages"]),
    "anthropic-messages",
    "routes Claude Copilot models to Anthropic Messages",
)
assert_eq(
    _resolve_copilot_transport_kind("gpt-5.4-mini", ["/responses"]),
    "responses",
    "routes GPT-5.4 mini to Responses API",
)
assert_eq(
    _resolve_copilot_transport_kind("gpt-4.1", ["/chat/completions"]),
    "chat-completions",
    "routes GPT-4.1 to chat/completions",
)

print("\n=== OpenAI-compatible proxy helper ===")
orig_post = bridge._http_post_json
captured = {}


def capture_post(url, payload, headers, timeout=180):
    captured["url"] = url
    captured["payload"] = payload
    captured["headers"] = headers
    return json.dumps({
        "choices": [{"message": {"content": "translated text"}}],
    })


try:
    bridge._http_post_json = capture_post
    proxy = OAuthCompatProxyServer({
        "provider": "openai-compatible",
        "apiBase": "https://api.example.test/v1",
        "apiKey": "sk-test",
    })
    text = proxy.handle_chat_completion({
        "model": "gpt-4.1",
        "messages": [{"role": "user", "content": "hello"}],
        "stream": False,
    })
    assert_eq(text, "translated text", "forwards proxied API responses")
    assert_eq(captured["url"], "https://api.example.test/v1/chat/completions", "uses upstream chat/completions endpoint")
    assert_eq(captured["headers"]["Authorization"], "Bearer sk-test", "passes bearer API key to proxied upstream")
finally:
    bridge._http_post_json = orig_post

print("\n=== Copilot retry helpers ===")
assert_eq(
    _is_retryable_transport_error(RuntimeError("HTTP 500 from https://example.test: boom")),
    True,
    "retries HTTP 500",
)
assert_eq(
    _is_retryable_transport_error(RuntimeError("HTTP 400 from https://example.test: bad request")),
    False,
    "does not retry HTTP 400",
)
assert_eq(
    _is_retryable_transport_error(RuntimeError("openai.InternalServerError: <urlopen error [SSL: UNEXPECTED_EOF_WHILE_READING]>")),
    True,
    "retries SSL EOF failures",
)

print("\n=== benign pdf2zh cleanup trace detection ===")
assert_eq(
    _is_benign_pdf2zh_cleanup_trace_line("ERROR:asyncio:Task exception was never retrieved"),
    True,
    "detects asyncio cleanup exception line",
)
assert_eq(
    _is_benign_pdf2zh_cleanup_trace_line("pdf2zh_next.high_level.SubprocessCrashError: Translation subprocess crashed with exit code -15"),
    True,
    "detects forced-terminate subprocess cleanup trace",
)
assert_eq(
    _is_benign_pdf2zh_cleanup_trace_line("ERROR:babeldoc.format.pdf.document_il_translator:Error translating paragraph"),
    False,
    "does not treat real translation failures as benign cleanup noise",
)

orig_post = bridge._http_post_json
orig_sleep = bridge.time.sleep
orig_uniform = bridge.random.uniform
attempts = {"count": 0}


def flaky_post(url, payload, headers, timeout=180):
    attempts["count"] += 1
    if attempts["count"] < 3:
        raise RuntimeError("HTTP 500 from https://example.test: temporarily unavailable")
    return '{"ok": true}'


try:
    bridge._http_post_json = flaky_post
    bridge.time.sleep = lambda _delay: None
    bridge.random.uniform = lambda _a, _b: 0.0
    raw = _http_post_json_with_retry(
        "https://example.test/chat/completions",
        {"model": "gpt-4.1"},
        {"Authorization": "Bearer test"},
        max_attempts=4,
        base_delay_sec=0.01,
    )
    assert_eq(raw, '{"ok": true}', "retries transient upstream failures until success")
    assert_eq(attempts["count"], 3, "stops retry loop after upstream recovers")
finally:
    bridge._http_post_json = orig_post
    bridge.time.sleep = orig_sleep
    bridge.random.uniform = orig_uniform

orig_post = bridge._http_post_json
orig_sleep = bridge.time.sleep
orig_uniform = bridge.random.uniform
attempts = {"count": 0}


def bad_request_post(url, payload, headers, timeout=180):
    attempts["count"] += 1
    raise RuntimeError("HTTP 400 from https://example.test: unsupported parameter")


try:
    bridge._http_post_json = bad_request_post
    bridge.time.sleep = lambda _delay: None
    bridge.random.uniform = lambda _a, _b: 0.0
    try:
        _http_post_json_with_retry(
            "https://example.test/chat/completions",
            {"model": "gpt-4.1"},
            {"Authorization": "Bearer test"},
            max_attempts=4,
            base_delay_sec=0.01,
        )
        assert_eq(True, False, "raises non-retryable upstream failures")
    except RuntimeError as exc:
        assert_eq("HTTP 400" in str(exc), True, "surfaces original non-retryable error")
        assert_eq(attempts["count"], 1, "does not retry non-retryable failures")
finally:
    bridge._http_post_json = orig_post
    bridge.time.sleep = orig_sleep
    bridge.random.uniform = orig_uniform

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
