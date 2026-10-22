"""Shared contract and real loopback HTTP tests, invoked by test_bridge.py."""
import json
from pathlib import Path
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import aidea_bridge as bridge


def run_token_policy_tests(assert_eq):
    fixtures = json.loads((Path(__file__).parents[1] / "fixtures" / "tokenParameterPolicy.json").read_text(encoding="utf-8"))
    bridge._token_parameter_cache.clear()
    for case in fixtures["selections"]:
        policy = bridge._TokenParameterPolicy("fixture", case["url"], case["model"])
        assert_eq(policy.apply({"max_tokens": 2345}), {case["field"]: 2345}, f"shared budget rule: {case['model']} at {case['url']}")
        assert_eq(policy.apply({}), {}, "omitted budget remains omitted")
    for case in fixtures["errors"]:
        assert_eq(bridge._replacement_token_field(case["status"], case["body"], case["current"]), case["expected"], "shared rejection rule")

    def rejection(field, other):
        return {"error": {"param": field, "message": f"Unsupported parameter: '{field}' is not supported with this model. Use '{other}' instead."}}

    # No external services: the production proxy forwards to this local upstream.
    requests = []
    behavior = {"mode": "accept"}

    class Upstream(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            requests.append((self.path, body))
            status = 200
            response = {"choices": [{"message": {"content": "Translated"}}]}
            mode = behavior["mode"]
            if mode == "generic":
                status, response = 400, {"error": {"message": "max_tokens exceeds the allowed budget"}}
            elif mode in ("modern", "bounce") and "max_tokens" in body:
                status, response = 400, rejection("max_tokens", "max_completion_tokens")
            elif mode in ("legacy", "bounce") and "max_completion_tokens" in body:
                status, response = 422, rejection("max_completion_tokens", "max_tokens")
            elif mode == "unauthorized":
                status, response = 401, rejection("max_tokens", "max_completion_tokens")
            data = json.dumps(response).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

    upstream = ThreadingHTTPServer(("127.0.0.1", 0), Upstream)
    worker = threading.Thread(target=upstream.serve_forever, daemon=True)
    worker.start()
    base = f"http://127.0.0.1:{upstream.server_address[1]}/v1"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def post(proxy, payload):
        req = urllib.request.Request(proxy.base_url + "/chat/completions", json.dumps(payload).encode(), {"Content-Type": "application/json"})
        with opener.open(req, timeout=5) as response:
            return json.loads(response.read())

    try:
        for provider in ("openai-compatible", "github-copilot"):
            cfg = {"provider": provider, "apiBase": base, "apiKey": "test-key", "accessToken": "test-token", "supportedEndpoints": ["/chat/completions"]}
            proxy = bridge.OAuthCompatProxyServer(cfg)
            proxy.start()
            payload = {"model": "gpt-6.1-sol", "messages": [{"role": "user", "content": "Translate"}], "max_tokens": 2345}
            try:
                behavior["mode"] = "accept"
                start = len(requests)
                result = post(proxy, payload)
                assert_eq(result["choices"][0]["message"]["content"], "Translated", f"{provider}: real HTTP proxy returns translated text")
                assert_eq(len(requests) - start, 1, "GPT-6.1 succeeds on first upstream request")
                assert_eq(requests[-1][1].get("max_completion_tokens"), 2345, "GPT-6.1 preserves budget in new field")
                assert_eq("max_tokens" in requests[-1][1], False, "old field removed")

                behavior["mode"] = "modern"
                alias = dict(payload, model="alias")
                start = len(requests)
                post(proxy, alias)
                post(proxy, alias)
                assert_eq(len(requests) - start, 3, "alias recovers once then uses cached correction")
                assert_eq([body.get("max_completion_tokens") for _, body in requests[start:]], [None, 2345, 2345], "captured upstream budgets prove correction and cache")

                behavior["mode"] = "legacy"
                start = len(requests)
                post(proxy, alias)
                post(proxy, alias)
                assert_eq(len(requests) - start, 3, "stale cache corrects in reverse once then caches success")

                behavior["mode"] = "bounce"
                start = len(requests)
                try:
                    post(proxy, dict(alias, model="bounce-alias"))
                    raise AssertionError("expected proxy error")
                except urllib.error.HTTPError as error:
                    assert_eq("max_tokens" in error.read().decode(), True, "failed recovery surfaces upstream error")
                assert_eq(len(requests) - start, 2, "only one token correction per request")
                behavior["mode"] = "accept"
                post(proxy, dict(alias, model="bounce-alias"))
                assert_eq(requests[-1][1].get("max_tokens"), 2345, "failed correction was not cached")

                for mode in ("generic", "unauthorized"):
                    behavior["mode"] = mode
                    start = len(requests)
                    try:
                        post(proxy, alias)
                        raise AssertionError("expected proxy error")
                    except urllib.error.HTTPError:
                        pass
                    assert_eq(len(requests) - start, 1, f"{mode} error does not trigger token retry")

                behavior["mode"] = "accept"
                post(proxy, {k: v for k, v in payload.items() if k != "max_tokens"})
                assert_eq(any(k in requests[-1][1] for k in bridge._TOKEN_FIELDS), False, "PDF omitted budget stays omitted")
                post(proxy, {**{k: v for k, v in payload.items() if k != "max_tokens"}, "max_completion_tokens": 2345})
                assert_eq(requests[-1][1].get("max_completion_tokens"), 2345, "PDF accepts new field on input")
                post(proxy, dict(payload, max_completion_tokens=2345))
                assert_eq("max_tokens" in requests[-1][1], False, "equal duplicate budgets normalize to one field")
                start = len(requests)
                try:
                    post(proxy, dict(payload, max_completion_tokens=100))
                    raise AssertionError("expected conflict")
                except urllib.error.HTTPError as error:
                    assert_eq(error.code, 400, "conflicting input budgets return 400")
                    assert_eq("Conflicting" in error.read().decode(), True, "conflict is explicit")
                assert_eq(len(requests), start, "conflicting input never reaches upstream")

                text = bridge._translate_overlay_text(proxy, "gpt-6.1-sol", "English", "Chinese", "Example title", {}, candidate_kind="title")
                assert_eq(text, "Translated", "PDF title overlay uses real adapter")
                assert_eq("max_completion_tokens" in requests[-1][1], True, "overlay budget uses same policy")

                # A different translation configuration must not inherit learned aliases.
                behavior["mode"] = "modern"
                other = bridge.OAuthCompatProxyServer(cfg)
                start = len(requests)
                other.handle_chat_completion(dict(alias, model="alias"))
                assert_eq(len(requests) - start, 2, "separate translation configuration has isolated cache")
            finally:
                proxy.stop()
    finally:
        upstream.shutdown()
        upstream.server_close()
        worker.join(timeout=2)
