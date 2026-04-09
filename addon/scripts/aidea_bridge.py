#!/usr/bin/env python3
"""
aidea_bridge.py  –  Bridge between AIdea Zotero plugin and pdf2zh_next CLI

Usage:  python aidea_bridge.py <task.json>

Reads task parameters from task.json, invokes pdf2zh_next as a subprocess,
parses stdout for progress, and writes progress.json for the plugin to poll.

This script is distributed with the AIdea plugin (addon/scripts/).
"""

import json
import os
import re
import subprocess
import sys
import time

# ── Progress file I/O ──

def write_progress(path, data):
    """Atomic write: write to .tmp then rename."""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    # os.replace is atomic on all platforms
    os.replace(tmp, path)


def make_progress(status, progress=0, message="", **kwargs):
    """Build a progress dict."""
    d = {"status": status, "progress": progress, "message": message}
    d.update(kwargs)
    return d


# ── Progress parsing ──

# pdf2zh_next outputs lines like:
#   "Translating: 45%|████   | 9/20 [00:12<00:15]"
#   or simpler:  "Processing page 3/10"
PROGRESS_PATTERNS = [
    re.compile(r"(\d+)/(\d+)"),         # generic "N/M"
    re.compile(r"(\d+)%"),              # percentage
]


def parse_progress(line):
    """
    Try to extract (current, total, percent) from a log line.
    Returns None if no progress info found.
    """
    # Try N/M pattern first
    m = PROGRESS_PATTERNS[0].search(line)
    if m:
        current, total = int(m.group(1)), int(m.group(2))
        if total > 0:
            pct = min(round(current / total * 100), 100)
            return current, total, pct

    # Try percentage pattern
    m = PROGRESS_PATTERNS[1].search(line)
    if m:
        pct = min(int(m.group(1)), 100)
        return None, None, pct

    return None


# ── Main ──

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
    no_dual = task.get("noDual", False)
    no_mono = task.get("noMono", False)

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Build pdf2zh_next CLI command
    cmd = [
        pdf2zh_bin,
        pdf_path,
        "--openaicompatible",
        "--qps", str(qps),
        "--output", output_dir,
        "--lang-in", source_lang,
        "--lang-out", target_lang,
        "--config-file", config_file,
        "--watermark-output-mode", "no_watermark",
        "--use-alternating-pages-dual",
    ]

    if no_dual:
        cmd.append("--no-dual")
    if no_mono:
        cmd.append("--no-mono")

    # Write initial progress
    write_progress(progress_file, make_progress(
        "running", 0, "Initializing translation engine...",
        startTime=time.time(),
    ))

    # Launch pdf2zh_next
    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except FileNotFoundError:
        write_progress(progress_file, make_progress(
            "error", 0, f"pdf2zh_next not found: {pdf2zh_bin}",
            error="binary_not_found",
        ))
        sys.exit(1)

    # Stream stdout and parse progress
    last_pct = 0
    for line in proc.stdout:
        line = line.rstrip()
        if not line:
            continue

        # Print to our own stdout for debugging
        print(line, flush=True)

        result = parse_progress(line)
        if result:
            current, total, pct = result
            if pct > last_pct:
                last_pct = pct
                msg_parts = []
                if current is not None and total is not None:
                    msg_parts.append(f"Translating {current}/{total} pages...")
                else:
                    msg_parts.append(f"Translating... {pct}%")
                write_progress(progress_file, make_progress(
                    "running", pct, msg_parts[0],
                    current=current, total=total,
                ))

    returncode = proc.wait()

    if returncode == 0:
        # Collect output files
        output_files = []
        if os.path.isdir(output_dir):
            for fn in os.listdir(output_dir):
                if fn.endswith(".pdf") and ("mono" in fn or "dual" in fn):
                    output_files.append(fn)

        write_progress(progress_file, make_progress(
            "done", 100, "Translation complete",
            outputFiles=output_files,
        ))
    else:
        write_progress(progress_file, make_progress(
            "error", last_pct,
            f"Translation failed (exit code: {returncode})",
            error=f"exit_code_{returncode}",
        ))
        sys.exit(returncode)


if __name__ == "__main__":
    main()
