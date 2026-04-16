#!/usr/bin/env python3
"""
aidea_bridge.py - bridge between AIdea Zotero plugin and pdf2zh_next CLI

Usage: python aidea_bridge.py <task.json>
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import random
import threading
from collections import deque
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import fitz  # PyMuPDF
except Exception:
    fitz = None


def _prepare_pdf2zh_runtime_env():
    """
    Build a subprocess env for pdf2zh_next that injects a sitecustomize patch.

    Rationale:
    babeldoc may select the `modelscope` upstream for model assets; its RapidOCR
    URL can return 404 in some regions. We remap modelscope model URLs to the
    known-good huggingface URLs at interpreter startup.
    """
    patch_dir = tempfile.mkdtemp(prefix="aidea-pdf2zh-patch-")
    sitecustomize_path = os.path.join(patch_dir, "sitecustomize.py")
    patch_code = (
        "try:\n"
        "    from babeldoc.assets import embedding_assets_metadata as _m\n"
        "    _hf_rapid = _m.TABLE_DETECTION_RAPIDOCR_MODEL_URL.get('huggingface')\n"
        "    if _hf_rapid:\n"
        "        _m.TABLE_DETECTION_RAPIDOCR_MODEL_URL['modelscope'] = _hf_rapid\n"
        "    _hf_doc = _m.DOC_LAYOUT_ONNX_MODEL_URL.get('huggingface')\n"
        "    if _hf_doc:\n"
        "        _m.DOC_LAYOUT_ONNX_MODEL_URL['modelscope'] = _hf_doc\n"
        "except Exception:\n"
        "    pass\n"
    )
    with open(sitecustomize_path, "w", encoding="utf-8") as f:
        f.write(patch_code)

    env = dict(os.environ)
    existing = env.get("PYTHONPATH", "").strip()
    env["PYTHONPATH"] = (
        patch_dir if not existing else f"{patch_dir}{os.pathsep}{existing}"
    )
    return env, patch_dir


def write_progress(path, data):
    """Atomic write: write to .tmp then rename."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, path)


def make_progress(status, progress=0, message="", **kwargs):
    d = {"status": status, "progress": progress, "message": message}
    d.update(kwargs)
    return d


PROGRESS_PATTERNS = [
    re.compile(r"(\d+)/(\d+)"),
    re.compile(r"(\d+)%"),
]


def parse_progress(line):
    m = PROGRESS_PATTERNS[0].search(line)
    if m:
        current, total = int(m.group(1)), int(m.group(2))
        if total > 0:
            pct = min(round(current / total * 100), 100)
            return current, total, pct

    m = PROGRESS_PATTERNS[1].search(line)
    if m:
        pct = min(int(m.group(1)), 100)
        return None, None, pct

    return None


REFERENCE_HEADING_RE = re.compile(
    r"(?im)^\s*(references|bibliography|works\s+cited|参考文献|参考资料)\s*$"
)
APPENDIX_HEADING_RE = re.compile(
    r"(?im)^\s*(appendix(?:es)?|supplementary(?:\s+materials?)?|附录|补充材料)\b"
)
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
PERSON_LINE_RE = re.compile(
    r"^[A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,4}(?:\s*[\*\u2020\u2021\d]+)?$"
)
ORG_KEYWORD_RE = re.compile(
    r"(university|institute|laboratory|lab|department|school|research|academy|college|google|microsoft|meta|openai|大学|学院|研究所|实验室|研究中心)",
    re.IGNORECASE,
)


PERSON_TOKEN_RE = re.compile(r"^[A-Z][A-Za-z'鈥?\-]*$")
AUTHOR_MARKER_RE = re.compile(r"[\*\u2020\u2021\d]+$")
AUTHOR_ENTITY_SPLIT_RE = re.compile(r"[;,|/]+")
PERSON_NAME_STOPWORDS = {
    "Abstract",
    "All",
    "And",
    "Attention",
    "Figure",
    "Introduction",
    "Need",
    "Provided",
    "The",
    "You",
}
LICENSE_LINE_RE = re.compile(
    r"(provided\s+proper\s+attribution|grants?\s+permission|journalistic|scholarly\s+works?|reproduce\s+the\s+tables?\s+and\s+figures?)",
    re.IGNORECASE,
)


def _as_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("true", "1", "yes", "y", "on"):
            return True
        if v in ("false", "0", "no", "n", "off"):
            return False
    return default


def _sanitize_text(value, max_len=180):
    text = str(value or "")
    text = CONTROL_CHAR_RE.sub("", text)
    text = text.replace("\u2028", " ").replace("\u2029", " ")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[:max_len].rstrip()
    return text


def _sanitize_log_line(value, max_len=4000):
    text = str(value or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = CONTROL_CHAR_RE.sub("", text)
    if len(text) > max_len:
        text = text[-max_len:]
    return text


def _unique_keep_order(items):
    out = []
    seen = set()
    for item in items:
        key = _sanitize_text(item)
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def _is_appendix_letter_heading(head_lines, letter_re):
    """Detect standalone appendix letter headings.

    Matches patterns like:
      A                          (line by itself)
      Factor Expression...       (descriptive title follows)

    Skips common false positives: paper title/author header lines.
    Only matches single uppercase letters A-Z (not "I" which is too ambiguous).
    """
    if not head_lines:
        return False
    # Skip header/footer lines (common in preprints: "Preprint, ,", "Wang et al.")
    content_lines = []
    for line in head_lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Skip obvious header/footer patterns
        if stripped.lower().startswith(("preprint", "accepted", "published")):
            continue
        if "et al" in stripped.lower():
            continue
        content_lines.append(stripped)
        if len(content_lines) >= 3:
            break

    if len(content_lines) < 2:
        return False

    first = content_lines[0]
    second = content_lines[1]
    # First line must be a single uppercase letter (A-Z, skip I)
    if len(first) == 1 and first.isalpha() and first.isupper() and first != "I":
        # Second line should be a descriptive title (starts with uppercase, multi-word)
        if second and second[0].isupper() and len(second.split()) >= 2:
            return True
    return False


def classify_reference_and_appendix_pages(pdf_path, keep_appendix_translated=True):
    """Section-based reference detection.

    Instead of scoring each page independently (prone to false positives on
    chart pages with many year labels), we:
      1. Scan all pages for section headings (References, Appendix, etc.)
      2. Find the "References" heading → mark as ref block start
      3. Find the next heading after it → mark as ref block end
      4. All pages between start and end = reference pages
      5. If no "References" heading found → skip nothing (safe fallback)
    """
    result = {
        "total_pages": 0,
        "reference_pages": [],
        "appendix_pages": [],
    }
    if fitz is None:
        return result

    try:
        doc = fitz.open(pdf_path)
    except Exception:
        return result

    # Phase 1: Scan all pages for section headings
    # Each entry: (heading_type, page_no)
    #   heading_type: "references" | "appendix" | "other_section"
    sections = []
    OTHER_SECTION_RE = re.compile(
        r"(?im)^\s*(?:"
        r"(?:[A-Z]\.?\s+)"           # "A ", "B " (appendix-style sections)
        r"|(?:\d+\.?\s+)"            # "1 ", "2." (numbered sections)
        r")"
        r"[A-Z][A-Za-z]",            # followed by a capitalized word
    )

    # Regex for standalone appendix-letter headings:
    # Matches "A" alone on a line, followed by a descriptive title on the next line
    # Common in academic papers: "A\nFactor Expression and Operator Library"
    APPENDIX_LETTER_RE = re.compile(
        r"(?m)^\s*([A-Z])\s*$"
    )

    try:
        total_pages = len(doc)
        result["total_pages"] = total_pages

        for page_index in range(total_pages):
            page_no = page_index + 1
            try:
                text = doc[page_index].get_text("text") or ""
            except Exception:
                text = ""
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            head = "\n".join(lines[:10])

            if REFERENCE_HEADING_RE.search(head):
                sections.append(("references", page_no))
            elif APPENDIX_HEADING_RE.search(head):
                sections.append(("appendix", page_no))
            elif _is_appendix_letter_heading(lines[:6], APPENDIX_LETTER_RE):
                # Standalone letter heading (A, B, C...) followed by a title
                sections.append(("appendix", page_no))
            elif OTHER_SECTION_RE.search(head) and page_no > total_pages // 2:
                # Only track "other" sections in the back half of the paper
                # to avoid noise from intro/methodology sections
                sections.append(("other_section", page_no))
    finally:
        doc.close()

    # Phase 2: Determine reference page range
    ref_start = None
    ref_end = None  # exclusive (first page NOT in the ref block)

    for i, (sec_type, page_no) in enumerate(sections):
        if sec_type == "references":
            ref_start = page_no
            # Look for the next non-reference section after this one
            for j in range(i + 1, len(sections)):
                next_type, next_page = sections[j]
                if next_type != "references":
                    ref_end = next_page  # appendix or other section starts here
                    break
            if ref_end is None:
                # No section after References → ref block goes to end of document
                ref_end = total_pages + 1
            break  # only use the first References heading

    if ref_start is None:
        # No "References" heading found → don't skip anything
        return result

    reference_pages = set(range(ref_start, ref_end))
    appendix_pages = set()

    # Mark appendix pages (pages with appendix headings after references)
    for sec_type, page_no in sections:
        if sec_type == "appendix":
            appendix_pages.add(page_no)

    if keep_appendix_translated:
        reference_pages.difference_update(appendix_pages)

    result["reference_pages"] = sorted(reference_pages)
    result["appendix_pages"] = sorted(appendix_pages)
    return result


def build_pages_spec(page_numbers):
    pages = sorted(set(int(p) for p in page_numbers if int(p) > 0))
    if not pages:
        return ""
    ranges = []
    start = pages[0]
    prev = pages[0]
    for p in pages[1:]:
        if p == prev + 1:
            prev = p
            continue
        ranges.append((start, prev))
        start = p
        prev = p
    ranges.append((start, prev))
    return ",".join(f"{s}-{e}" if s != e else str(s) for s, e in ranges)


def _looks_like_person_name(line):
    cleaned = _sanitize_text(line, max_len=180)
    if not cleaned or LICENSE_LINE_RE.search(cleaned):
        return False
    if ORG_KEYWORD_RE.search(cleaned):
        return False
    tokens = cleaned.split()
    if len(tokens) < 2 or len(tokens) > 5:
        return False
    normalized = []
    for token in tokens:
        stripped = AUTHOR_MARKER_RE.sub("", token).strip("()[]{}.,:")
        if not stripped:
            continue
        if not PERSON_TOKEN_RE.match(stripped):
            return False
        if stripped in PERSON_NAME_STOPWORDS:
            return False
        normalized.append(stripped)
    return len(normalized) >= 2


def _collect_author_block_terms_from_lines(lines, max_terms=60):
    terms = []
    for raw_line in lines[:140]:
        line = _sanitize_text(raw_line, max_len=180)
        if not line:
            continue
        lower = line.lower()
        if lower.startswith(("abstract", "keywords", "introduction")):
            break
        if len(line) > 140 or LICENSE_LINE_RE.search(line):
            continue
        if "@" in line:
            for m in EMAIL_RE.finditer(line):
                terms.append(m.group(0))
            continue
        if ORG_KEYWORD_RE.search(line) and len(line.split()) <= 8:
            terms.append(line)
            continue
        if AUTHOR_ENTITY_SPLIT_RE.search(line):
            for chunk in AUTHOR_ENTITY_SPLIT_RE.split(line):
                chunk = _sanitize_text(chunk, max_len=120)
                if _looks_like_person_name(chunk):
                    terms.append(chunk)
            continue
        if _looks_like_person_name(line):
            terms.append(line)
        if len(terms) >= max_terms:
            break
    return _unique_keep_order(terms)[:max_terms]


def extract_author_block_terms(pdf_path, max_pages=2, max_terms=60):
    if fitz is None:
        return []
    try:
        doc = fitz.open(pdf_path)
    except Exception:
        return []

    try:
        for page_index in range(min(max_pages, len(doc))):
            text = doc[page_index].get_text("text") or ""
            lines = [line for line in text.splitlines() if _sanitize_text(line)]
            terms = _collect_author_block_terms_from_lines(lines, max_terms=max_terms)
            if terms:
                return terms[:max_terms]
    finally:
        doc.close()

    return []


def build_author_protection_prompt(terms):
    lines = [
        "Translation constraints:",
        "1. Do NOT translate person names, institutional names, email addresses, URLs, DOI/arXiv IDs.",
        "2. You MAY translate surrounding title-page prose, copyright notices, headings, and abstract text.",
        "3. Preserve footnote markers in author metadata (*, †, ‡, superscript numbers).",
    ]
    lines.append(
        "4. Keep only the protected entities below exactly as-is; do not preserve the full surrounding line unless every token is protected."
    )
    protected = _unique_keep_order(terms)
    if protected:
        lines.append("Protected terms (keep exactly as-is):")
        for term in protected[:60]:
            lines.append(f"- {term}")
    return "\n".join(lines)


def _sanitize_multiline_prompt(text):
    raw = str(text or "")
    raw = CONTROL_CHAR_RE.sub("", raw)
    raw = raw.replace("\r\n", "\n").replace("\r", "\n")
    lines = [_sanitize_text(line, max_len=300) for line in raw.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def _rewrite_translation_custom_prompt(config_file, prompt):
    with open(config_file, "r", encoding="utf-8") as f:
        toml = f.read()

    prompt_literal = json.dumps(_sanitize_multiline_prompt(prompt), ensure_ascii=False)
    target_line = f"custom_system_prompt = {prompt_literal}"
    # Remove any pre-existing custom_system_prompt line/block first.
    # This also heals malformed multi-line prompt strings from previous runs.
    cleaned = re.sub(
        r'(?ms)^custom_system_prompt\s*=\s*"(?:[^"\\]|\\.)*"\s*$\n?',
        "",
        toml,
    )

    # Insert after [translation].
    if "[translation]" in cleaned:
        replaced = cleaned.replace("[translation]\n", f"[translation]\n{target_line}\n", 1)
    else:
        replaced = cleaned + f"\n[translation]\n{target_line}\n"

    with open(config_file, "w", encoding="utf-8") as f:
        f.write(replaced)


def _extract_text_from_openai_content(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text" and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts)
    return ""


def _http_post_json(url, payload, headers, timeout=180):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            return body.decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {err.code} from {url}: {body}") from err


_RETRYABLE_HTTP_STATUS_CODES = {408, 409, 425, 429, 500, 502, 503, 504}
_RETRYABLE_ERROR_MESSAGE_FRAGMENTS = (
    "unexpected_eof_while_reading",
    "eof occurred in violation of protocol",
    "remote end closed connection without response",
    "connection reset by peer",
    "connection aborted",
    "temporarily unavailable",
    "tlsv1 alert",
    "sslv3 alert",
    "timed out",
    "timeout",
)


def _extract_http_status_code(exc):
    if isinstance(exc, urllib.error.HTTPError):
        return int(exc.code)
    if not isinstance(exc, RuntimeError):
        return None
    match = re.search(r"\bHTTP\s+(\d{3})\b", str(exc))
    if not match:
        return None
    try:
        return int(match.group(1))
    except Exception:
        return None


def _is_retryable_transport_error(exc):
    status_code = _extract_http_status_code(exc)
    if status_code in _RETRYABLE_HTTP_STATUS_CODES:
        return True
    message = str(exc).lower()
    return any(fragment in message for fragment in _RETRYABLE_ERROR_MESSAGE_FRAGMENTS)


def _http_post_json_with_retry(
    url,
    payload,
    headers,
    timeout=180,
    max_attempts=4,
    base_delay_sec=1.0,
):
    attempt = 1
    while True:
        try:
            return _http_post_json(url, payload, headers, timeout=timeout)
        except Exception as exc:
            if attempt >= max_attempts or not _is_retryable_transport_error(exc):
                raise
            wait_sec = min(base_delay_sec * (2 ** (attempt - 1)), 6.0)
            wait_sec += random.uniform(0.0, 0.25)
            print(
                f"[AIdea] transient upstream error from {url}; retrying "
                f"{attempt}/{max_attempts - 1} in {wait_sec:.2f}s: {exc}",
                file=sys.stderr,
            )
            time.sleep(wait_sec)
            attempt += 1


_BENIGN_PDF2ZH_CLEANUP_TRACE_FRAGMENTS = (
    "ERROR:asyncio:Task exception",
    "was never retrieved",
    "future: <Task finished",
    "name='Task-",
    "coro=<<async_generator_athrow",
    "exception=SubprocessCrashError",
    "Traceback (most recent call last):",
    "GeneratorExit",
    "During handling of the above exception",
    "Translation subprocess crashed with exit code -15",
    "exit code: -15",
    "high_level.py\", line",
)


def _is_benign_pdf2zh_cleanup_trace_line(line):
    text = str(line or "")
    return any(fragment in text for fragment in _BENIGN_PDF2ZH_CLEANUP_TRACE_FRAGMENTS)


def _build_codex_instructions(messages):
    system_parts = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        if msg.get("role") != "system":
            continue
        text = _extract_text_from_openai_content(msg.get("content"))
        if text.strip():
            system_parts.append(text.strip())
    if system_parts:
        return "\n\n".join(system_parts)
    return "You are a helpful AI assistant."


def _build_codex_input(messages):
    out = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        if role not in ("user", "assistant"):
            continue
        text = _extract_text_from_openai_content(msg.get("content")).strip()
        if not text:
            continue
        if role == "assistant":
            out.append({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": text}],
            })
        else:
            out.append({
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": text}],
            })
    if not out:
        out.append({
            "type": "message",
            "role": "user",
            "content": [{"type": "input_text", "text": "Translate this text."}],
        })
    return out


def _extract_codex_output_text(data):
    if isinstance(data, dict):
        direct = data.get("output_text")
        if isinstance(direct, str) and direct.strip():
            return direct

        response = data.get("response")
        if isinstance(response, dict):
            rt = response.get("output_text")
            if isinstance(rt, str) and rt.strip():
                return rt

        output = data.get("output")
        if isinstance(output, list):
            texts = []
            for item in output:
                if not isinstance(item, dict):
                    continue
                content = item.get("content")
                if not isinstance(content, list):
                    continue
                for part in content:
                    if not isinstance(part, dict):
                        continue
                    part_type = str(part.get("type", ""))
                    text = part.get("text")
                    if part_type in ("output_text", "text") and isinstance(text, str):
                        texts.append(text)
            if texts:
                return "\n".join(texts)
    return ""


def _extract_codex_output_text_from_sse(raw):
    out = []
    completed_text = ""
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed.startswith("data:"):
            continue
        payload = trimmed[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            event = json.loads(payload)
        except Exception:
            continue

        if (
            isinstance(event, dict)
            and event.get("type") == "response.output_text.delta"
            and isinstance(event.get("delta"), str)
        ):
            out.append(event["delta"])
            continue

        if (
            isinstance(event, dict)
            and event.get("type") == "response.completed"
            and isinstance(event.get("response"), dict)
            and isinstance(event["response"].get("output_text"), str)
        ):
            completed_text = event["response"]["output_text"]

    joined = "".join(out).strip()
    if joined:
        return joined
    return completed_text.strip()


def _generate_prompt_id():
    suffix = "".join(f"{random.randint(0, 255):02x}" for _ in range(8))
    return f"aidea-{int(time.time())}-{suffix}"


def _build_gemini_prompt(messages):
    parts = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "user"))
        text = _extract_text_from_openai_content(msg.get("content")).strip()
        if not text:
            continue
        role_label = "User"
        if role == "assistant":
            role_label = "Assistant"
        elif role == "system":
            role_label = "System"
        parts.append(f"{role_label}:\n{text}")
    if not parts:
        return "Translate this text."
    return "\n\n".join(parts)


def _extract_gemini_text_from_json(data):
    candidates = []
    if isinstance(data, dict):
        root_candidates = data.get("candidates")
        if isinstance(root_candidates, list):
            candidates = root_candidates
        response = data.get("response")
        if isinstance(response, dict) and isinstance(response.get("candidates"), list):
            candidates = response["candidates"]

    out = []
    for cand in candidates:
        if not isinstance(cand, dict):
            continue
        content = cand.get("content")
        if not isinstance(content, dict):
            continue
        parts = content.get("parts")
        if not isinstance(parts, list):
            continue
        for part in parts:
            if isinstance(part, dict) and isinstance(part.get("text"), str):
                out.append(part["text"])
    return "".join(out)


def _extract_gemini_text_from_sse(raw):
    out = []
    for line in raw.splitlines():
        trimmed = line.strip()
        if not trimmed.startswith("data:"):
            continue
        payload = trimmed[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            parsed = json.loads(payload)
        except Exception:
            continue
        text = _extract_gemini_text_from_json(parsed)
        if text:
            out.append(text)
    return "".join(out)


COPILOT_EDITOR_VERSION = "vscode/1.96.2"
COPILOT_USER_AGENT = "GitHubCopilotChat/0.26.7"
COPILOT_DEFAULT_API_BASE = "https://api.individual.githubcopilot.com"


def _build_copilot_ide_headers():
    return {
        "Editor-Version": COPILOT_EDITOR_VERSION,
        "User-Agent": COPILOT_USER_AGENT,
    }


def _build_copilot_dynamic_headers():
    headers = dict(_build_copilot_ide_headers())
    headers["Copilot-Integration-Id"] = "vscode-chat"
    headers["Openai-Intent"] = "conversation-edits"
    return headers


def _derive_copilot_api_base_url(token):
    token_text = str(token or "").strip()
    match = re.search(r"(?:^|;)\s*proxy-ep=([^;\s]+)", token_text, re.IGNORECASE)
    proxy_ep = match.group(1).strip() if match else ""
    if not proxy_ep:
        return COPILOT_DEFAULT_API_BASE
    host = re.sub(r"^https?://", "", proxy_ep, flags=re.IGNORECASE)
    host = re.sub(r"^proxy\.", "api.", host, flags=re.IGNORECASE)
    return f"https://{host}" if host else COPILOT_DEFAULT_API_BASE


def _normalize_copilot_supported_endpoints(values):
    if not isinstance(values, list):
        return []
    normalized = []
    for value in values:
        text = str(value or "").strip().lower()
        if text:
            normalized.append(text)
    return normalized


def _is_copilot_claude_model(model):
    return str(model or "").strip().lower().startswith("claude-")


def _resolve_copilot_transport_kind(model, supported_endpoints=None):
    if _is_copilot_claude_model(model):
        return "anthropic-messages"

    supported = set(_normalize_copilot_supported_endpoints(supported_endpoints))
    if "/responses" in supported:
        return "responses"
    if "/chat/completions" in supported:
        return "chat-completions"

    normalized = str(model or "").strip().lower()
    if (
        normalized.startswith("gemini-")
        or normalized.startswith("grok-")
        or normalized.startswith("gpt-4")
        or normalized.startswith("gpt-3.5")
    ):
        return "chat-completions"

    return "responses"


def _build_copilot_instructions(messages):
    parts = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        if str(msg.get("role", "")).strip().lower() != "system":
            continue
        text = _extract_text_from_openai_content(msg.get("content")).strip()
        if text:
            parts.append(text)
    if parts:
        return "\n\n".join(parts)
    return ""


def _build_copilot_responses_input(messages):
    items = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).strip().lower()
        if role not in ("user", "assistant"):
            continue
        text = _extract_text_from_openai_content(msg.get("content")).strip()
        if not text:
            continue
        content_type = "output_text" if role == "assistant" else "input_text"
        items.append({
            "role": role,
            "content": [{"type": content_type, "text": text}],
        })
    if not items:
        items.append({
            "role": "user",
            "content": [{"type": "input_text", "text": "Translate this text."}],
        })
    return items


def _build_copilot_anthropic_messages(messages):
    anthropic_messages = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).strip().lower()
        if role == "system":
            continue
        if role not in ("user", "assistant"):
            role = "user"
        text = _extract_text_from_openai_content(msg.get("content")).strip()
        if not text:
            continue
        last = anthropic_messages[-1] if anthropic_messages else None
        if last and last.get("role") == role:
            last["content"] += f"\n{text}"
        else:
            anthropic_messages.append({"role": role, "content": text})
    if not anthropic_messages:
        anthropic_messages.append({"role": "user", "content": "Translate this text."})
    return anthropic_messages


def _extract_openai_chat_text(data):
    if not isinstance(data, dict):
        return ""
    choices = data.get("choices")
    if not isinstance(choices, list):
        return ""
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        message = choice.get("message")
        if not isinstance(message, dict):
            continue
        content = message.get("content")
        if isinstance(content, str) and content.strip():
            return content
        if isinstance(content, list):
            parts = []
            for part in content:
                if not isinstance(part, dict):
                    continue
                text = part.get("text")
                if isinstance(text, str):
                    parts.append(text)
            if parts:
                return "\n".join(parts)
    return ""


def _extract_anthropic_text(data):
    if not isinstance(data, dict):
        return ""
    content = data.get("content")
    if not isinstance(content, list):
        return ""
    parts = []
    for part in content:
        if not isinstance(part, dict):
            continue
        if str(part.get("type", "")).strip().lower() == "text":
            text = part.get("text")
            if isinstance(text, str):
                parts.append(text)
    return "\n".join(parts).strip()


def _coerce_max_output_tokens(value, default_value):
    if isinstance(value, (int, float)):
        return max(16, int(value))
    return default_value


def _to_openai_completion_text_response(model, text):
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": text},
                "finish_reason": "stop",
            }
        ],
    }


def _to_openai_completion_stream_chunks(model, text):
    cid = f"chatcmpl-{uuid.uuid4().hex}"
    created = int(time.time())
    first = {
        "id": cid,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [
            {
                "index": 0,
                "delta": {"role": "assistant", "content": text},
                "finish_reason": None,
            }
        ],
    }
    done = {
        "id": cid,
        "object": "chat.completion.chunk",
        "created": created,
        "model": model,
        "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
    }
    return [first, done]


class OAuthCompatProxyServer:
    """Temporary local OpenAI-compatible adapter for OAuth and proxied API providers."""

    GEMINI_STREAM_URL = "https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse"
    CODEX_URL = "https://chatgpt.com/backend-api/codex/responses"

    def __init__(self, proxy_cfg):
        self.proxy_cfg = proxy_cfg or {}
        self.httpd = None
        self.thread = None
        self.port = None

    @property
    def base_url(self):
        if self.port is None:
            raise RuntimeError("Proxy server not started")
        return f"http://127.0.0.1:{self.port}/v1"

    def start(self):
        parent = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, format_, *args):
                return

            def _send_json(self, status, payload):
                data = json.dumps(payload).encode("utf-8")
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def do_POST(self):
                if self.path.rstrip("/") != "/v1/chat/completions":
                    self._send_json(404, {"error": {"message": f"Unsupported path: {self.path}"}})
                    return
                try:
                    length = int(self.headers.get("Content-Length", "0"))
                    raw = self.rfile.read(length) if length > 0 else b"{}"
                    payload = json.loads(raw.decode("utf-8", errors="replace"))
                    model = str(payload.get("model", "")).strip() or "unknown-model"
                    text = parent.handle_chat_completion(payload)
                    stream = bool(payload.get("stream"))
                    if stream:
                        self.send_response(200)
                        self.send_header("Content-Type", "text/event-stream")
                        self.send_header("Cache-Control", "no-cache")
                        self.send_header("Connection", "close")
                        self.end_headers()
                        for chunk in _to_openai_completion_stream_chunks(model, text):
                            line = f"data: {json.dumps(chunk, ensure_ascii=False)}\\n\\n"
                            self.wfile.write(line.encode("utf-8"))
                        self.wfile.write(b"data: [DONE]\\n\\n")
                        return
                    self._send_json(200, _to_openai_completion_text_response(model, text))
                except Exception as err:
                    self._send_json(500, {"error": {"message": str(err)}})

        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.port = int(self.httpd.server_address[1])
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
            self.httpd = None
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2)
        self.thread = None

    def handle_chat_completion(self, payload):
        provider = str(self.proxy_cfg.get("provider", "")).strip()
        if provider == "openai-compatible":
            return self._forward_openai_compatible(payload)
        if provider == "openai-codex":
            return self._forward_codex(payload)
        if provider == "google-gemini-cli":
            return self._forward_gemini(payload)
        if provider == "github-copilot":
            return self._forward_copilot(payload)
        raise RuntimeError(f"Unsupported OAuth proxy provider: {provider}")

    def _forward_openai_compatible(self, payload):
        base_url = str(self.proxy_cfg.get("apiBase", "")).strip().rstrip("/")
        if not base_url:
            raise RuntimeError("Missing API base URL for openai-compatible proxy")

        api_key = str(self.proxy_cfg.get("apiKey", "")).strip()
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        raw = _http_post_json_with_retry(
            f"{base_url}/chat/completions",
            payload,
            headers,
            timeout=300,
        )
        try:
            data = json.loads(raw)
        except Exception:
            data = {}
        text = _extract_openai_chat_text(data).strip()
        if not text:
            raise RuntimeError("OpenAI-compatible response did not contain output text")
        return text

    def _forward_codex(self, payload):
        access_token = str(self.proxy_cfg.get("accessToken", "")).strip()
        if not access_token:
            raise RuntimeError("Missing OAuth access token for openai-codex")
        model = str(payload.get("model", "")).strip()
        messages = payload.get("messages")
        if not isinstance(messages, list):
            messages = []

        req_body = {
            "model": model,
            "instructions": _build_codex_instructions(messages),
            "input": _build_codex_input(messages),
            "store": False,
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }
        account_id = str(self.proxy_cfg.get("accountId", "")).strip()
        if account_id:
            headers["ChatGPT-Account-Id"] = account_id

        raw = _http_post_json_with_retry(self.CODEX_URL, req_body, headers, timeout=300)
        text = _extract_codex_output_text_from_sse(raw).strip()
        if not text:
            try:
                data = json.loads(raw)
            except Exception:
                data = {}
            text = _extract_codex_output_text(data).strip()
        if not text:
            raise RuntimeError("Codex OAuth response did not contain output text")
        return text

    def _forward_gemini(self, payload):
        access_token = str(self.proxy_cfg.get("accessToken", "")).strip()
        if not access_token:
            raise RuntimeError("Missing OAuth access token for google-gemini-cli")
        project_id = str(self.proxy_cfg.get("projectId", "")).strip()
        if not project_id:
            raise RuntimeError(
                "Missing Google project ID for Gemini OAuth. Re-login in AIdea settings."
            )

        model = str(payload.get("model", "")).strip()
        if model.startswith("models/"):
            model = model[7:]
        messages = payload.get("messages")
        if not isinstance(messages, list):
            messages = []

        request = {
            "contents": [{"role": "user", "parts": [{"text": _build_gemini_prompt(messages)}]}],
        }
        generation_cfg = {}
        temp = payload.get("temperature")
        max_tokens = payload.get("max_tokens")
        if isinstance(temp, (int, float)):
            generation_cfg["temperature"] = float(temp)
        if isinstance(max_tokens, (int, float)):
            generation_cfg["maxOutputTokens"] = max(1, int(max_tokens))
        if generation_cfg:
            request["generationConfig"] = generation_cfg

        req_body = {
            "model": model,
            "project": project_id,
            "user_prompt_id": _generate_prompt_id(),
            "request": request,
        }
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "User-Agent": f"AIdea/1.0/{model}",
        }
        raw = _http_post_json_with_retry(self.GEMINI_STREAM_URL, req_body, headers, timeout=300)
        text = _extract_gemini_text_from_sse(raw).strip()
        if not text:
            try:
                data = json.loads(raw)
            except Exception:
                data = {}
            text = _extract_gemini_text_from_json(data).strip()
        if not text:
            raise RuntimeError("Gemini OAuth response did not contain output text")
        return text

    def _forward_copilot(self, payload):
        access_token = str(self.proxy_cfg.get("accessToken", "")).strip()
        if not access_token:
            raise RuntimeError("Missing OAuth access token for github-copilot")

        base_url = str(self.proxy_cfg.get("apiBase", "")).strip()
        if not base_url:
            base_url = _derive_copilot_api_base_url(access_token)
        base_url = base_url.rstrip("/")

        model = str(payload.get("model", "")).strip()
        messages = payload.get("messages")
        if not isinstance(messages, list):
            messages = []

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            **_build_copilot_dynamic_headers(),
        }
        transport_kind = _resolve_copilot_transport_kind(
            model,
            self.proxy_cfg.get("supportedEndpoints"),
        )
        max_tokens = payload.get("max_tokens")
        response_format = payload.get("response_format")

        if transport_kind == "anthropic-messages":
            req_body = {
                "model": model,
                "messages": _build_copilot_anthropic_messages(messages),
                "max_tokens": _coerce_max_output_tokens(max_tokens, 8192),
                "stream": False,
            }
            instructions = _build_copilot_instructions(messages)
            if instructions:
                req_body["system"] = instructions
            raw = _http_post_json_with_retry(
                f"{base_url}/v1/messages",
                req_body,
                headers,
                timeout=300,
            )
            try:
                data = json.loads(raw)
            except Exception:
                data = {}
            text = _extract_anthropic_text(data).strip()
            if not text:
                raise RuntimeError("Copilot Anthropic response did not contain output text")
            return text

        if transport_kind == "chat-completions":
            req_body = {
                "model": model,
                "messages": messages,
                "stream": False,
            }
            if isinstance(max_tokens, (int, float)):
                req_body["max_tokens"] = max(1, int(max_tokens))
            if isinstance(response_format, dict) and response_format:
                req_body["response_format"] = response_format
            raw = _http_post_json_with_retry(
                f"{base_url}/chat/completions",
                req_body,
                headers,
                timeout=300,
            )
            try:
                data = json.loads(raw)
            except Exception:
                data = {}
            text = _extract_openai_chat_text(data).strip()
            if not text:
                raise RuntimeError("Copilot chat/completions response did not contain output text")
            return text

        req_body = {
            "model": model,
            "input": _build_copilot_responses_input(messages),
            "stream": False,
        }
        instructions = _build_copilot_instructions(messages)
        if instructions:
            req_body["instructions"] = instructions
        if isinstance(max_tokens, (int, float)):
            req_body["max_output_tokens"] = _coerce_max_output_tokens(max_tokens, 16)
        if (
            isinstance(response_format, dict)
            and str(response_format.get("type", "")).strip().lower() == "json_object"
        ):
            req_body["text"] = {"format": {"type": "json_object"}}
        raw = _http_post_json_with_retry(
            f"{base_url}/responses",
            req_body,
            headers,
            timeout=300,
        )
        try:
            data = json.loads(raw)
        except Exception:
            data = {}
        text = _extract_codex_output_text(data).strip()
        if not text:
            raise RuntimeError("Copilot Responses API response did not contain output text")
        return text


def _rewrite_openai_base_url(config_file, base_url):
    with open(config_file, "r", encoding="utf-8") as f:
        toml = f.read()

    replaced = re.sub(
        r'(?m)^openai_compatible_base_url\s*=\s*".*?"\s*$',
        f'openai_compatible_base_url = "{base_url}"',
        toml,
    )
    if replaced == toml:
        replaced = toml + f'\nopenai_compatible_base_url = "{base_url}"\n'

    with open(config_file, "w", encoding="utf-8") as f:
        f.write(replaced)


def main():
    if len(sys.argv) < 2:
        print("Usage: aidea_bridge.py <task.json>", file=sys.stderr)
        sys.exit(1)

    task_file = sys.argv[1]
    with open(task_file, "r", encoding="utf-8") as f:
        task = json.load(f)

    progress_file = task["progressFile"]
    pdf2zh_bin = task["pdf2zhBin"]
    pdf_path = task["pdfPath"]
    output_dir = task["outputDir"]
    config_file = task["configFile"]
    source_lang = task.get("sourceLang", "en")
    target_lang = task.get("targetLang", "zh-CN")
    qps = task.get("qps", 10)
    pool_max_worker = int(task.get("poolMaxWorker", 1) or 1)
    no_dual = _as_bool(task.get("noDual", False))
    no_mono = _as_bool(task.get("noMono", False))
    no_watermark = _as_bool(task.get("noWatermark", True), True)
    disable_rich_text_translate = _as_bool(task.get("disableRichTextTranslate", False))
    enhance_compatibility = _as_bool(task.get("enhanceCompatibility", False))
    translate_table_text = _as_bool(task.get("translateTableText", False))
    ocr_workaround = _as_bool(task.get("ocr", False))
    auto_ocr_workaround = _as_bool(task.get("autoOcr", False))
    save_glossary = _as_bool(task.get("saveGlossary", False))
    disable_glossary = _as_bool(task.get("disableGlossary", False))
    dual_mode = str(task.get("dualMode", "LR") or "LR").strip().upper()
    trans_first = _as_bool(task.get("transFirst", False))
    skip_clean = _as_bool(task.get("skipClean", False))
    font_family = str(task.get("fontFamily", "auto") or "auto").strip().lower()
    skip_references_auto = _as_bool(task.get("skipReferencesAuto", False))
    keep_appendix_translated = _as_bool(task.get("keepAppendixTranslated", True), True)
    protect_author_block = _as_bool(task.get("protectAuthorBlock", False))
    reference_policy_debug = _as_bool(task.get("referencePolicyDebug", False))
    oauth_proxy_cfg = task.get("oauthProxy")

    os.makedirs(output_dir, exist_ok=True)
    log_file = str(task.get("logFile", "") or "").strip()
    if not log_file:
        progress_dir = os.path.dirname(progress_file) or tempfile.gettempdir()
        log_file = os.path.join(progress_dir, "bridge.log")

    def log_line(message):
        try:
            text = _sanitize_log_line(message)
            with open(log_file, "a", encoding="utf-8", errors="replace") as lf:
                lf.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {text}\n")
        except Exception:
            pass

    proxy = None
    patch_dir = None
    try:
        log_line(f"Task file: {task_file}")
        log_line(f"PDF: {pdf_path}")
        log_line(f"Output: {output_dir}")
        log_line(f"Model config: {config_file}")

        if isinstance(oauth_proxy_cfg, dict):
            proxy = OAuthCompatProxyServer(oauth_proxy_cfg)
            proxy.start()
            _rewrite_openai_base_url(config_file, proxy.base_url)
            log_line(f"OAuth proxy started: {oauth_proxy_cfg.get('provider')} @ {proxy.base_url}")

        if protect_author_block:
            write_progress(progress_file, make_progress(
                "running", 6, "Analyzing author/affiliation block...",
                startTime=time.time(),
            ))
            protected_terms = extract_author_block_terms(pdf_path)
            if protected_terms:
                prompt = build_author_protection_prompt(protected_terms)
                _rewrite_translation_custom_prompt(config_file, prompt)
                log_line(f"Author protection enabled; terms={len(protected_terms)}")
                print(
                    f"[aidea_bridge] Author block protection enabled "
                    f"(terms={len(protected_terms)})",
                    flush=True,
                )

        selected_pages_spec = ""
        if skip_references_auto:
            write_progress(progress_file, make_progress(
                "running", 8, "Detecting references/appendix pages...",
                startTime=time.time(),
            ))
            policy = classify_reference_and_appendix_pages(
                pdf_path,
                keep_appendix_translated=keep_appendix_translated,
            )
            total_pages = int(policy.get("total_pages") or 0)
            reference_pages = [int(p) for p in policy.get("reference_pages", [])]
            appendix_pages = [int(p) for p in policy.get("appendix_pages", [])]
            if reference_policy_debug:
                print(
                    f"[aidea_bridge] Reference policy: refs={reference_pages} "
                    f"appendix={appendix_pages}",
                    flush=True,
                )
            if total_pages > 0 and reference_pages:
                translate_pages = [
                    p for p in range(1, total_pages + 1)
                    if p not in set(reference_pages)
                ]
                selected_pages_spec = build_pages_spec(translate_pages)
                if not selected_pages_spec:
                    write_progress(progress_file, make_progress(
                        "error", 0,
                        "Reference detection excluded all pages. Please disable auto-skip references and retry.",
                        error="reference_policy_empty_pages",
                    ))
                    sys.exit(1)
                print(
                    f"[aidea_bridge] Auto-skip references active. "
                    f"Translating pages: {selected_pages_spec}",
                    flush=True,
                )
                log_line(
                    f"Auto-skip references active; pages={selected_pages_spec}; "
                    f"refs={reference_pages}; appendix={appendix_pages}"
                )

        runtime_env, patch_dir = _prepare_pdf2zh_runtime_env()

        cmd = [
            pdf2zh_bin,
            pdf_path,
            "--openaicompatible",
            "--qps", str(qps),
            "--output", output_dir,
            "--lang-in", source_lang,
            "--lang-out", target_lang,
            "--config-file", config_file,
            "--watermark-output-mode", "no_watermark" if no_watermark else "watermarked",
        ]
        if no_dual:
            cmd.append("--no-dual")
        if no_mono:
            cmd.append("--no-mono")
        if disable_rich_text_translate:
            cmd.append("--disable-rich-text-translate")
        if enhance_compatibility:
            cmd.append("--enhance-compatibility")
        if translate_table_text:
            cmd.append("--translate-table-text")
        if ocr_workaround:
            cmd.append("--ocr-workaround")
        if auto_ocr_workaround:
            cmd.append("--auto-enable-ocr-workaround")
        if save_glossary and not disable_glossary:
            cmd.append("--save-auto-extracted-glossary")
        if disable_glossary:
            cmd.append("--no-auto-extract-glossary")
        if dual_mode == "TB":
            cmd.append("--use-alternating-pages-dual")
        if trans_first:
            cmd.append("--dual-translate-first")
        if skip_clean:
            cmd.append("--skip-clean")
        if font_family in ("serif", "sans-serif", "script"):
            cmd.extend(["--primary-font-family", font_family])
        if selected_pages_spec:
            cmd.extend(["--pages", selected_pages_spec])
        if pool_max_worker and pool_max_worker > 1:
            cmd.extend(["--pool-max-worker", str(pool_max_worker)])
        log_line("Command: " + " ".join(cmd))

        # ── Phased progress mapping ──
        # Phase 1: Init           →  0 –  5%
        # Phase 2: Analysis       →  5 – 10%  (ref detection, author block)
        # Phase 3: Translation    → 10 – 95%  (page-level from pdf2zh_next)
        # Phase 4: Finalization   → 95 – 100%
        PHASE_TRANSLATE_START = 10
        PHASE_TRANSLATE_END = 95

        write_progress(progress_file, make_progress(
            "running", 5, "Initializing translation engine...",
            startTime=time.time(),
        ))

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                env=runtime_env,
            )
        except FileNotFoundError:
            write_progress(progress_file, make_progress(
                "error", 0, f"pdf2zh_next not found: {pdf2zh_bin}",
                error="binary_not_found",
                logFile=log_file,
            ))
            sys.exit(1)

        last_raw_pct = 0   # raw page-level pct from stdout (0-100)
        last_pct = PHASE_TRANSLATE_START  # mapped overall pct
        last_current = None
        last_total = None
        tail_lines = deque(maxlen=80)
        error_lines = []  # Track ERROR output from pdf2zh_next (full text)
        last_write_time = 0
        WRITE_THROTTLE_SEC = 0.8  # min interval between progress writes
        suppress_cleanup_trace = False

        def _map_page_pct(raw_pct):
            """Map raw 0–100 page pct to PHASE_TRANSLATE_START – PHASE_TRANSLATE_END."""
            return PHASE_TRANSLATE_START + int(
                raw_pct * (PHASE_TRANSLATE_END - PHASE_TRANSLATE_START) / 100
            )

        for line in proc.stdout:
            line = line.rstrip()
            if not line:
                continue

            if "Translate process did not finish in time, terminate it" in line:
                suppress_cleanup_trace = True
            elif suppress_cleanup_trace and _is_benign_pdf2zh_cleanup_trace_line(line):
                continue
            else:
                suppress_cleanup_trace = False

            print(line, flush=True)
            log_line(line)
            tail_lines.append(line)

            # Track ERROR lines from engine — keep FULL text for debugging
            is_error_line = bool(re.search(r'\bERROR\b', line))
            if is_error_line:
                full_error = _sanitize_log_line(line, max_len=2000)
                error_lines.append(full_error)
                # Immediately write error detail to progress (no throttle)
                write_progress(progress_file, make_progress(
                    "running", last_pct,
                    f"⚠ Engine error ({len(error_lines)})",
                    detail=full_error,
                    errorCount=len(error_lines),
                ))
                last_write_time = time.time()
                continue

            # Parse page progress (e.g. "4/14")
            result = parse_progress(line)
            if result:
                current, total, raw_pct = result
                if raw_pct > last_raw_pct:
                    last_raw_pct = raw_pct
                    last_pct = _map_page_pct(raw_pct)
                    last_current = current
                    last_total = total
                    if current is not None and total is not None:
                        message = f"Translating {current}/{total} pages..."
                    else:
                        message = f"Translating... {raw_pct}%"
                    write_progress(progress_file, make_progress(
                        "running", last_pct, message,
                        current=current, total=total,
                        detail=_sanitize_text(line, max_len=1000),
                    ))
                    last_write_time = time.time()
                    continue

            # For non-progress lines: write detail update (throttled)
            now = time.time()
            if now - last_write_time >= WRITE_THROTTLE_SEC:
                detail_text = _sanitize_text(line, max_len=1000)
                if detail_text:
                    # Keep message as the last known progress message,
                    # put the raw engine output in detail only.
                    # Omit current/total so TypeScript won't re-print page line.
                    if last_current is not None and last_total is not None:
                        keep_msg = f"Translating {last_current}/{last_total} pages..."
                    elif last_raw_pct > 0:
                        keep_msg = f"Translating... {last_raw_pct}%"
                    else:
                        keep_msg = "Processing..."
                    write_progress(progress_file, make_progress(
                        "running", last_pct, keep_msg,
                        detail=detail_text,
                    ))
                    last_write_time = now

        returncode = proc.wait()
        if returncode == 0:
            output_files = []
            if os.path.isdir(output_dir):
                for fn in os.listdir(output_dir):
                    if fn.endswith(".pdf") and ("mono" in fn or "dual" in fn):
                        output_files.append(fn)
            done_data = make_progress(
                "done", 100, "Translation complete", outputFiles=output_files,
                logFile=log_file,
            )
            # Warn if pdf2zh_next logged ERROR lines (e.g. API failures)
            if error_lines:
                done_data["errorCount"] = len(error_lines)
                done_data["errorLines"] = error_lines[:50]  # keep up to 50 for debugging
                done_data["hasErrors"] = True
            write_progress(progress_file, done_data)
        else:
            last_line = _sanitize_text(tail_lines[-1], max_len=220) if tail_lines else ""
            detail = "\n".join(_sanitize_log_line(x, max_len=500) for x in tail_lines).strip()
            message = f"Translation failed (exit code: {returncode})"
            if last_line:
                message = f"{message}: {last_line}"
            write_progress(progress_file, make_progress(
                "error", last_pct,
                message,
                error=f"exit_code_{returncode}",
                errorDetail=detail,
                logFile=log_file,
            ))
            sys.exit(returncode)
    except Exception as err:
        err_text = _sanitize_log_line(f"{type(err).__name__}: {err}")
        log_line(f"Unhandled error: {err_text}")
        write_progress(progress_file, make_progress(
            "error", 0,
            f"Bridge error: {err_text}",
            error="bridge_exception",
            errorDetail=err_text,
            logFile=log_file,
        ))
        raise
    finally:
        if proxy:
            proxy.stop()
        if patch_dir:
            try:
                shutil.rmtree(patch_dir, ignore_errors=True)
            except Exception:
                pass


if __name__ == "__main__":
    main()
