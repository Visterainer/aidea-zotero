"""Loopback proxy access-control and framing tests, invoked by test_bridge.py."""
import json
import os
import tempfile
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import aidea_bridge as bridge


def run_proxy_security_tests(assert_eq):
    class Upstream(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            self.rfile.read(int(self.headers["Content-Length"]))
            data = json.dumps({"choices": [{"message": {"content": "Translated"}}]}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{upstream.server_address[1]}/v1"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    cfg = {"provider": "openai-compatible", "apiBase": base, "apiKey": "upstream-key"}
    payload = {"model": "gpt-test", "messages": [{"role": "user", "content": "Translate"}]}

    def post(proxy, headers=None, body=None):
        """Return (status, raw body bytes)."""
        req = urllib.request.Request(
            proxy.base_url + "/chat/completions",
            json.dumps(body or payload).encode(),
            {"Content-Type": "application/json", **(headers or {})},
        )
        try:
            with opener.open(req, timeout=5) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as err:
            return err.code, err.read()

    proxy = bridge.OAuthCompatProxyServer(cfg, auth_token="run-token")
    proxy.start()
    try:
        assert_eq(post(proxy)[0], 401, "proxy rejects a request without the run token")
        assert_eq(
            post(proxy, {"Authorization": "Bearer wrong"})[0],
            401,
            "proxy rejects a wrong token",
        )
        status, raw = post(proxy, {"Authorization": "Bearer run-token"})
        assert_eq(status, 200, "proxy accepts the run token")
        assert_eq(
            json.loads(raw)["choices"][0]["message"]["content"],
            "Translated",
            "authorized request is forwarded",
        )
        assert_eq(
            post(proxy, {"Authorization": "Bearer run-token", "Origin": "https://example.com"})[0],
            403,
            "proxy rejects browser-originated requests",
        )

        status, raw = post(
            proxy,
            {"Authorization": "Bearer run-token"},
            {**payload, "stream": True},
        )
        text = raw.decode("utf-8")
        assert_eq(status, 200, "streaming request succeeds")
        assert_eq("\\n" in text, False, "SSE frames contain no literal backslash-n")
        assert_eq(text.endswith("data: [DONE]\n\n"), True, "SSE stream ends with a framed [DONE]")
        events = [line for line in text.split("\n\n") if line.startswith("data: {")]
        assert_eq(len(events) > 0, True, "SSE stream carries parseable data events")
        assert_eq(
            all(isinstance(json.loads(line[6:]), dict) for line in events),
            True,
            "each SSE event is one JSON object",
        )
    finally:
        proxy.stop()

    # Constructed without a token (tests, debug script): unchanged behaviour.
    open_proxy = bridge.OAuthCompatProxyServer(cfg)
    open_proxy.start()
    try:
        assert_eq(post(open_proxy)[0], 200, "proxy without a token stays open")
    finally:
        open_proxy.stop()
        upstream.shutdown()
        upstream.server_close()

    with tempfile.TemporaryDirectory() as tmp:
        config = os.path.join(tmp, "config.toml")
        with open(config, "w", encoding="utf-8") as f:
            f.write('openai_compatible_api_key = "aidea-oauth-proxy"\nother = "x"\n')
        bridge._rewrite_openai_api_key(config, "tok_-123")
        with open(config, "r", encoding="utf-8") as f:
            assert_eq(
                f.read(),
                'openai_compatible_api_key = "tok_-123"\nother = "x"\n',
                "config key is replaced with the run token",
            )
        with open(config, "w", encoding="utf-8") as f:
            f.write('other = "x"\n')
        bridge._rewrite_openai_api_key(config, "tok2")
        with open(config, "r", encoding="utf-8") as f:
            assert_eq(
                'openai_compatible_api_key = "tok2"' in f.read(),
                True,
                "config key is appended when missing",
            )

        progress = os.path.join(tmp, "progress.json")
        bridge.write_progress(progress, {"status": "running", "progress": 5})
        with open(progress, "r", encoding="utf-8") as f:
            assert_eq(json.load(f)["progress"], 5, "progress write still lands atomically")
        assert_eq(os.path.exists(progress + ".tmp"), False, "no temp file is left behind")
