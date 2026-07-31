"""
test/pdfTranslator/test_bridge.py

Tests for aidea_bridge.py helpers.
Run: python test/pdfTranslator/test_bridge.py
"""

import base64
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
    _build_codex_oauth_headers,
    _build_copilot_dynamic_headers,
    _build_overlay_textbox_kwargs,
    _collect_output_files,
    _collect_author_block_terms_from_lines,
    _group_overlay_words_into_lines,
    _group_overlay_words_into_regions,
    _derive_copilot_api_base_url,
    _ensure_loopback_no_proxy,
    _http_post_json_with_retry,
    _is_figure_overlay_page_text,
    _is_benign_pdf2zh_cleanup_trace_line,
    _is_retryable_transport_error,
    _make_no_output_error_progress,
    _normalize_model_output,
    _should_translate_overlay_line,
    _resolve_copilot_transport_kind,
    _rewrite_translation_custom_prompt,
    _sanitize_multiline_prompt,
    _snapshot_output_files,
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

result = parse_progress("[07/21/26 10:08:04] INFO pdf2zh_next initialized")
assert_eq(result, None, "Rich timestamp is not treated as page progress")

result = parse_progress("[07/21/26 10:08:04] Processing page 3/10")
assert_eq(result, (3, 10, 30), "keeps real progress after a Rich timestamp")

result = parse_progress("trace output [07/21/26 10:08:04] INFO initialized")
assert_eq(result, None, "interleaved Rich timestamp is not treated as page progress")

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

print("\n=== local OAuth proxy bypass ===")
proxy_env = _ensure_loopback_no_proxy({
    "NO_PROXY": "example.com,localhost",
    "no_proxy": "internal.test",
})
assert_eq(
    proxy_env["NO_PROXY"],
    "example.com,localhost,internal.test,127.0.0.1,::1",
    "preserves existing bypasses and adds loopback hosts",
)
assert_eq(proxy_env["no_proxy"], proxy_env["NO_PROXY"], "keeps both env spellings aligned")

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

print("\n=== overlay line grouping ===")
grouped = _group_overlay_words_into_lines([
    (120.0, 199.2, 134.3, 215.2, "The"),
    (135.9, 198.1, 148.3, 215.2, "Law"),
    (149.9, 202.3, 162.3, 215.2, "will"),
    (163.9, 191.9, 176.3, 215.2, "never"),
    (177.8, 204.9, 190.2, 215.2, "be"),
    (191.8, 186.7, 204.2, 215.2, "perfect"),
])
assert_eq(len(grouped), 1, "groups nearby figure words into one line")
assert_eq(grouped[0]["text"], "The Law will never be perfect", "reconstructs grouped figure sentence")

regions = _group_overlay_words_into_regions([
    (121.9, 199.2, 134.3, 215.2, "The"),
    (135.9, 198.1, 148.3, 215.2, "Law"),
    (149.9, 202.3, 162.3, 215.2, "will"),
    (163.9, 191.9, 176.3, 215.2, "never"),
    (177.8, 204.9, 190.2, 215.2, "be"),
    (191.8, 186.7, 204.2, 215.2, "perfect"),
    (121.9, 312.1, 134.3, 328.2, "The"),
    (135.9, 312.1, 148.3, 329.2, "Law"),
    (149.9, 312.1, 162.3, 325.1, "will"),
    (163.9, 312.1, 176.3, 335.4, "never"),
    (177.8, 312.1, 190.2, 322.5, "be"),
    (191.8, 312.1, 204.2, 340.6, "perfect"),
])
assert_eq(len(regions), 2, "splits repeated figure text into separate vertical regions")

print("\n=== overlay candidate detection ===")
assert_eq(
    _should_translate_overlay_line(14, "The Law will never be perfect but its application should be just", (0, 0, 100, 20), [], "figure"),
    True,
    "detects residual figure sentence for overlay translation",
)
assert_eq(
    _should_translate_overlay_line(1, "Attention Is All You Need", (0, 0, 100, 20), [], "title"),
    True,
    "detects title-page title for overlay translation",
)
assert_eq(
    _should_translate_overlay_line(1, "Ashish Vaswani Google Brain", (0, 0, 100, 20), [], "title"),
    False,
    "does not treat author metadata as overlay translation candidate",
)
assert_eq(
    _should_translate_overlay_line(6, "Attention(Q, K, V ) = softmax(QKT", (0, 0, 100, 20), [], "figure"),
    False,
    "does not treat formulas as overlay translation candidates",
)
assert_eq(
    _should_translate_overlay_line(10, "Some reference title in English", (0, 0, 100, 20), [10, 11, 12], "figure"),
    False,
    "skips reference pages during overlay translation",
)

print("\n=== figure overlay page detection ===")
assert_eq(
    _is_figure_overlay_page_text("The Law\\n<EOS>\\n<pad>"),
    True,
    "detects figure pages via eos/pad markers",
)
assert_eq(
    _is_figure_overlay_page_text("Regular body paragraph without markers"),
    False,
    "does not treat normal body pages as figure overlay pages",
)

print("\n=== overlay textbox kwargs ===")
orig_find_fontfile = bridge._find_overlay_fontfile
try:
    bridge._find_overlay_fontfile = lambda _text: None
    assert_eq(
        _build_overlay_textbox_kwargs("Plain english")["fontname"],
        "helv",
        "uses built-in font when no overlay font file is available",
    )
    bridge._find_overlay_fontfile = lambda _text: r"C:\Windows\Fonts\msyh.ttc"
    kwargs = _build_overlay_textbox_kwargs("中文覆盖")
    assert_eq(kwargs["fontname"], "aidea_overlay_font", "uses explicit overlay font name when fontfile is present")
    assert_eq(kwargs["fontfile"], r"C:\Windows\Fonts\msyh.ttc", "passes overlay fontfile without using None fontname")
finally:
    bridge._find_overlay_fontfile = orig_find_fontfile

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

print("\n=== shared model output normalization ===")
fixture_path = os.path.join(
    os.path.dirname(__file__),
    "..",
    "fixtures",
    "model-output-normalization.json",
)
with open(fixture_path, "r", encoding="utf-8") as fixture_file:
    normalization_fixtures = json.load(fixture_file)
for fixture in normalization_fixtures:
    assert_eq(
        _normalize_model_output(fixture["input"])["text"],
        fixture["expected"],
        f"normalizes {fixture['name']}",
    )

print("\n=== MiniMax reasoning_split capability ===")
orig_post_with_retry = bridge._http_post_json_with_retry
minimax_payloads = []


def capture_minimax_post(
    url,
    payload,
    headers,
    timeout=180,
    max_attempts=4,
    base_delay_sec=1.0,
):
    minimax_payloads.append(dict(payload))
    if len(minimax_payloads) == 1:
        raise RuntimeError(
            "HTTP 422 from https://api.minimax.io/v1/chat/completions: "
            "unknown parameter reasoning_split"
        )
    return json.dumps({
        "choices": [{
            "message": {
                "reasoning_content": "private",
                "content": "<think>private fallback</think>translated text",
            },
        }],
    })


try:
    bridge._http_post_json_with_retry = capture_minimax_post
    proxy = OAuthCompatProxyServer({
        "provider": "openai-compatible",
        "apiBase": "https://api.minimax.io/v1",
        "apiKey": "sk-test",
    })
    text = proxy.handle_chat_completion({
        "model": "MiniMax-M2.1",
        "messages": [{"role": "user", "content": "hello"}],
        "stream": False,
    })
    assert_eq(
        minimax_payloads[0].get("reasoning_split"),
        True,
        "injects reasoning_split for official MiniMax reasoning models",
    )
    assert_eq(
        "reasoning_split" in minimax_payloads[1],
        False,
        "retries once without rejected reasoning_split",
    )
    assert_eq(text, "translated text", "filters tagged MiniMax reasoning")
    proxy.handle_chat_completion({
        "model": "MiniMax-M3",
        "messages": [{"role": "user", "content": "hello again"}],
        "stream": False,
    })
    assert_eq(
        "reasoning_split" in minimax_payloads[2],
        False,
        "caches unsupported MiniMax capability for the endpoint",
    )
    unknown_proxy = OAuthCompatProxyServer({
        "provider": "openai-compatible",
        "apiBase": "https://proxy.example.test/v1",
        "apiKey": "sk-test",
    })
    unknown_proxy.handle_chat_completion({
        "model": "MiniMax-M2.1",
        "messages": [{"role": "user", "content": "proxy request"}],
        "stream": False,
    })
    assert_eq(
        "reasoning_split" in minimax_payloads[3],
        False,
        "does not inject MiniMax parameters into unknown proxies",
    )
finally:
    bridge._http_post_json_with_retry = orig_post_with_retry

print("\n=== Codex OAuth request headers ===")
headers = _build_codex_oauth_headers("test-token", "account-1")
assert_eq(headers.get("originator"), "codex_cli_rs", "uses Codex originator")
assert_eq(
    headers.get("User-Agent"),
    "codex_cli_rs/0.0.0 (AIdea)",
    "uses Codex-shaped user agent",
)
assert_eq(
    headers.get("ChatGPT-Account-ID"),
    "account-1",
    "uses canonical Codex account header",
)
assert_eq(
    headers.get("ChatGPT-Account-Id"),
    None,
    "does not emit the legacy account header spelling",
)

jwt_payload = base64.urlsafe_b64encode(
    json.dumps({
        "https://api.openai.com/auth": {
            "chatgpt_account_id": "account-from-jwt",
        }
    }).encode("utf-8")
).decode("ascii").rstrip("=")
headers = _build_codex_oauth_headers(f"header.{jwt_payload}.signature")
assert_eq(
    headers.get("ChatGPT-Account-ID"),
    "account-from-jwt",
    "reads Codex account id from the OAuth JWT",
)

orig_post_with_retry = bridge._http_post_json_with_retry
captured_codex = {}


def capture_codex_post(
    url,
    payload,
    headers,
    timeout=180,
    max_attempts=4,
    base_delay_sec=1.0,
):
    captured_codex["url"] = url
    captured_codex["payload"] = payload
    captured_codex["headers"] = headers
    captured_codex["max_attempts"] = max_attempts
    return json.dumps({"output_text": "translated text"})


try:
    bridge._http_post_json_with_retry = capture_codex_post
    proxy = OAuthCompatProxyServer({
        "provider": "openai-codex",
        "accessToken": "test-token",
        "accountId": "account-1",
    })
    text = proxy.handle_chat_completion({
        "model": "gpt-5.6-luna",
        "messages": [{"role": "user", "content": "hello"}],
        "stream": False,
    })
    assert_eq(text, "translated text", "forwards Codex OAuth responses")
    assert_eq(
        captured_codex["payload"].get("model"),
        "gpt-5.6-luna",
        "keeps the Luna model slug unchanged",
    )
    assert_eq(
        captured_codex["headers"].get("originator"),
        "codex_cli_rs",
        "forwards the Codex originator",
    )
    assert_eq(
        captured_codex["headers"].get("User-Agent"),
        "codex_cli_rs/0.0.0 (AIdea)",
        "forwards the Codex-shaped user agent",
    )
    assert_eq(
        captured_codex["max_attempts"],
        6,
        "uses the extended retry window for Codex OAuth",
    )
    proxy.handle_chat_completion({
        "model": "gpt-5.6-sol",
        "messages": [
            {"role": "system", "content": "Use JSON mode when requested."},
            {"role": "user", "content": "Hello"},
        ],
        "response_format": {"type": "json_object"},
        "stream": False,
    })
    assert_eq(
        "text" in captured_codex["payload"],
        False,
        "does not force Codex JSON mode when only system instructions mention JSON",
    )
    proxy.handle_chat_completion({
        "model": "gpt-5.6-sol",
        "messages": [{"role": "user", "content": "Return a JSON object."}],
        "response_format": {"type": "json_object"},
        "stream": False,
    })
    assert_eq(
        captured_codex["payload"].get("text"),
        {"format": {"type": "json_object"}},
        "keeps Codex JSON-object mode when the prompt explicitly requests JSON",
    )
    proxy.handle_chat_completion({
        "model": "gpt-5.6-sol",
        "messages": [{"role": "user", "content": "Return a JSON array of the same length."}],
        "response_format": {"type": "json_object"},
        "stream": False,
    })
    assert_eq(
        "text" in captured_codex["payload"],
        False,
        "does not force JSON-object mode for PDF translation array batches",
    )
finally:
    bridge._http_post_json_with_retry = orig_post_with_retry

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


def persistent_502_post(url, payload, headers, timeout=180):
    attempts["count"] += 1
    raise RuntimeError("HTTP 502 from https://example.test: upstream unavailable")


try:
    bridge._http_post_json = persistent_502_post
    bridge.time.sleep = lambda _delay: None
    bridge.random.uniform = lambda _a, _b: 0.0
    try:
        _http_post_json_with_retry(
            "https://example.test/chat/completions",
            {"model": "gpt-5.6-sol"},
            {"Authorization": "Bearer test"},
            max_attempts=6,
        )
        assert_eq(True, False, "raises after the extended retry window is exhausted")
    except RuntimeError as exc:
        assert_eq("HTTP 502" in str(exc), True, "preserves the final upstream status")
        assert_eq(attempts["count"], 6, "Codex retry window performs six attempts")
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

print("\n=== _collect_output_files ===")
with tempfile.TemporaryDirectory() as out_dir:
    open(os.path.join(out_dir, "Paper A.no_watermark.zh-CN.mono.pdf"), "w").close()
    open(os.path.join(out_dir, "Paper A.no_watermark.zh-CN.dual.pdf"), "w").close()
    open(os.path.join(out_dir, "Paper B.no_watermark.zh-CN.mono.pdf"), "w").close()
    files = _collect_output_files(out_dir, os.path.join(out_dir, "Paper A.pdf"))
    assert_eq(
        files,
        ["Paper A.no_watermark.zh-CN.dual.pdf", "Paper A.no_watermark.zh-CN.mono.pdf"],
        "lists only outputs for the current source PDF",
    )

print("\n=== fresh output detection ===")
with tempfile.TemporaryDirectory() as out_dir:
    source_pdf = os.path.join(out_dir, "Paper A.pdf")
    mono_name = "Paper A.no_watermark.zh-CN.mono.pdf"
    dual_name = "Paper A.no_watermark.zh-CN.dual.pdf"
    mono_path = os.path.join(out_dir, mono_name)
    dual_path = os.path.join(out_dir, dual_name)

    with open(mono_path, "wb") as f:
        f.write(b"old")
    baseline = _snapshot_output_files(out_dir, source_pdf)
    assert_eq(
        _collect_output_files(out_dir, source_pdf, baseline=baseline),
        [],
        "unchanged output from an earlier run is not fresh",
    )

    with open(mono_path, "ab") as f:
        f.write(b"-updated")
    with open(dual_path, "wb") as f:
        f.write(b"new")
    assert_eq(
        _collect_output_files(out_dir, source_pdf, baseline=baseline),
        [dual_name, mono_name],
        "new and updated outputs are fresh",
    )

print("\n=== no-output failure progress ===")
no_output = _make_no_output_error_progress(
    38,
    [
        "Translation subprocess",
        "initialization error: Error",
        "code: 502",
    ],
    r"C:\temp\bridge.log",
)
assert_eq(no_output["status"], "error", "no output is a failed task")
assert_eq(no_output["error"], "no_output_generated", "uses stable no-output error code")
assert_eq("HTTP 502" in no_output["message"], True, "surfaces wrapped upstream status")
assert_eq(no_output["logFile"], r"C:\temp\bridge.log", "keeps the diagnostic log path")

print(f"\n{'=' * 40}")
print(f"Results: {passed} passed, {failed} failed")
if failed > 0:
    sys.exit(1)
