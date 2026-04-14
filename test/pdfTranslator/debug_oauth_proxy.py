#!/usr/bin/env python3
"""
debug_oauth_proxy.py

Smoke-test the OAuth -> local OpenAI-compatible proxy path used by
addon/scripts/aidea_bridge.py.

Examples:
  python test/pdfTranslator/debug_oauth_proxy.py --provider openai-codex --model gpt-5.4
  python test/pdfTranslator/debug_oauth_proxy.py --provider google-gemini-cli --model gemini-2.5-pro
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional, Tuple
import urllib.error
import urllib.request


REPO_ROOT = Path(__file__).resolve().parents[2]
BRIDGE_DIR = REPO_ROOT / "addon" / "scripts"
sys.path.insert(0, str(BRIDGE_DIR))

from aidea_bridge import OAuthCompatProxyServer  # noqa: E402


def read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def read_codex_cred_from_home(home: Path) -> Tuple[str, str]:
    auth = read_json(home / ".codex" / "auth.json")
    tokens = auth.get("tokens") if isinstance(auth.get("tokens"), dict) else {}
    access = str(tokens.get("access_token") or "").strip()
    account_id = str(tokens.get("account_id") or "").strip()
    return access, account_id


def read_gemini_cred_from_home(home: Path) -> Tuple[str, str]:
    data = read_json(home / ".gemini" / "oauth_creds.json")
    access = str(data.get("access_token") or data.get("token") or "").strip()
    project = str(data.get("project_id") or data.get("projectId") or "").strip()
    return access, project


def read_gemini_cred_from_zotero_prefs() -> Tuple[str, str]:
    appdata = os.environ.get("APPDATA", "").strip()
    if not appdata:
        return "", ""
    profiles_dir = Path(appdata) / "Zotero" / "Zotero" / "Profiles"
    if not profiles_dir.exists():
        return "", ""

    token = ""
    project = ""
    token_re = re.compile(
        r'user_pref\("extensions\.zotero\.aidea\.geminiOAuthAccessToken",\s*"([^"]*)"\)'
    )
    project_re = re.compile(
        r'user_pref\("extensions\.zotero\.aidea\.geminiOAuthProjectId",\s*"([^"]*)"\)'
    )

    for profile in profiles_dir.iterdir():
        prefs = profile / "prefs.js"
        if not prefs.exists():
            continue
        text = prefs.read_text(encoding="utf-8", errors="ignore")
        if not token:
            m = token_re.search(text)
            if m:
                token = m.group(1).strip()
        if not project:
            m = project_re.search(text)
            if m:
                project = m.group(1).strip()
        if token and project:
            break
    return token, project


def post_chat_completion(base_url: str, model: str, prompt: str) -> str:
    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": "You are a translation assistant."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "temperature": 0,
        "max_tokens": 256,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer local-debug",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {err.code} {url}: {body}") from err

    parsed = json.loads(body)
    text = (
        parsed.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    return str(text or "").strip()


def ensure_token(token: str) -> str:
    value = token.strip()
    if value:
        return value
    value = input("Paste OAuth access token: ").strip()
    if not value:
        raise RuntimeError("OAuth access token is required")
    return value


def ensure_project_id(project_id: str) -> str:
    value = project_id.strip()
    if value:
        return value
    value = input("Paste Google project id (required for Gemini): ").strip()
    if not value:
        raise RuntimeError("Google project id is required for Gemini OAuth")
    return value


def resolve_credentials(args: argparse.Namespace) -> dict:
    provider = args.provider
    token = (args.token or "").strip()
    account_id = (args.account_id or "").strip()
    project_id = (args.project_id or "").strip()
    home = Path.home()

    if provider == "openai-codex":
        if not token:
            home_token, home_account = read_codex_cred_from_home(home)
            token = token or home_token
            account_id = account_id or home_account
        token = ensure_token(token)
        cfg = {"provider": provider, "accessToken": token}
        if account_id:
            cfg["accountId"] = account_id
        return cfg

    if provider == "google-gemini-cli":
        if not token or not project_id:
            home_token, home_project = read_gemini_cred_from_home(home)
            token = token or home_token
            project_id = project_id or home_project
        if not token or not project_id:
            zotero_token, zotero_project = read_gemini_cred_from_zotero_prefs()
            token = token or zotero_token
            project_id = project_id or zotero_project
        token = ensure_token(token)
        project_id = ensure_project_id(project_id)
        return {
            "provider": provider,
            "accessToken": token,
            "projectId": project_id,
        }

    raise RuntimeError(f"Unsupported provider: {provider}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--provider",
        required=True,
        choices=["openai-codex", "google-gemini-cli"],
        help="OAuth provider to test",
    )
    p.add_argument("--model", required=True, help="Model id (e.g. gpt-5.4)")
    p.add_argument(
        "--prompt",
        default="Translate to Chinese: Attention is all you need.",
        help="Prompt sent to model",
    )
    p.add_argument("--token", default="", help="OAuth access token")
    p.add_argument("--account-id", default="", help="Codex ChatGPT account id")
    p.add_argument("--project-id", default="", help="Gemini Google project id")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    cfg = resolve_credentials(args)

    proxy = OAuthCompatProxyServer(cfg)
    proxy.start()
    try:
        print(f"[debug] provider={args.provider}")
        print(f"[debug] model={args.model}")
        print(f"[debug] proxy={proxy.base_url}")
        text = post_chat_completion(proxy.base_url, args.model, args.prompt)
        if not text:
            raise RuntimeError("Empty response text from proxy")
        print("\n=== Response ===")
        print(text)
        print("\n[ok] OAuth proxy call succeeded.")
        return 0
    finally:
        proxy.stop()


if __name__ == "__main__":
    raise SystemExit(main())
