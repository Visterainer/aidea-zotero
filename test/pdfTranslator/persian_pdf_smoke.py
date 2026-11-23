"""Offline Persian end-to-end fixture, not part of the Node/stdlib suite.

Run with the *verified translation venv's Python*, after BabelDOC's normal
assets are cached. Pass a new output directory; the PDFs and the expected
logical text are retained there to check with Zotero's reader. No real
provider is contacted. Only the translator's model responses are substituted.
"""

import argparse
from importlib.metadata import version
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pymupdf as pdf

TITLE = "Methods and results"
BODY = (
    "The research team recorded the results of the experiment in a public journal. "
    "This paper discusses a method for comparing model versions across different studies."
)
PERSIAN_TITLE = "روش پژوهش"
PERSIAN_BODY = (
    "پژوهشگران چگونه گزارش می‌نویسند؟ نسخهٔ GPT-4.1 (2026) و آزمون ۱۲۳. "
    "در پایان، داده‌ها را در DOI: 10.1000/test بررسی می‌کنیم."
)


def answer(source):
    return (
        PERSIAN_TITLE
        if TITLE.lower() in source.lower() and "research team" not in source.lower()
        else PERSIAN_BODY
    )


class Fixture(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        prompt = body["messages"][-1]["content"]
        translated = answer(prompt)
        for start in re.finditer(r"\[\s*\{", prompt):
            try:
                rows, _ = json.JSONDecoder().raw_decode(prompt[start.start() :])
            except ValueError:
                continue
            if rows and all(
                isinstance(r, dict) and "id" in r and isinstance(r.get("input"), str)
                for r in rows
            ):
                translated = json.dumps(
                    [{"id": r["id"], "output": answer(r["input"])} for r in rows],
                    ensure_ascii=False,
                )
        data = json.dumps(
            {
                "id": "fixture",
                "object": "chat.completion",
                "model": "fixture",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": translated},
                    }
                ],
                "usage": {
                    "prompt_tokens": 80,
                    "completion_tokens": 40,
                    "total_tokens": 120,
                },
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="new directory for this run")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    run = args.directory.resolve()
    run.mkdir(parents=True, exist_ok=False)
    dest = run / "output"
    dest.mkdir()
    source = run / "Research.pdf"
    with pdf.open() as original:
        p = original.new_page(width=480, height=288)
        p.insert_text((38, 64), TITLE, fontname="hebo", fontsize=19)
        p.insert_textbox(pdf.Rect(38, 92, 350, 216), BODY, fontsize=13)
        original.save(source)
    engine = Path(sys.executable).with_name(
        "pdf2zh_next.exe" if os.name == "nt" else "pdf2zh_next"
    )
    with ThreadingHTTPServer(("127.0.0.1", 0), Fixture) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            config = run / "config.toml"
            config.write_text(
                f"""openaicompatible = true
[translation]
lang_in = "en"
lang_out = "fa"
ignore_cache = true
[pdf]
watermark_output_mode = "no_watermark"
[openaicompatible_detail]
translate_engine_type = "OpenAICompatible"
support_llm = "yes"
openai_compatible_model = "fixture"
openai_compatible_api_key = "local-only"
openai_compatible_base_url = "http://127.0.0.1:{server.server_port}/v1"
openai_compatible_timeout = "20"
""",
                encoding="utf-8",
            )
            task = run / "task.json"
            progress = run / "progress.json"
            task.write_text(
                json.dumps(
                    dict(
                        pdf2zhBin=str(engine),
                        pdfPath=str(source),
                        outputDir=str(dest),
                        configFile=str(config),
                        progressFile=str(progress),
                        logFile=str(run / "bridge.log"),
                        targetLang="fa",
                        sourceLang="en",
                        modelId="fixture",
                        noMono=False,
                        noDual=False,
                        disableGlossary=True,
                        skipReferencesAuto=False,
                        protectAuthorBlock=False,
                    )
                ),
                encoding="utf-8",
            )
            # Read the pre-existing font/model assets, not the user's translation DB.
            home = run / "home"
            cache = home / ".cache" / "babeldoc"
            cache.mkdir(parents=True)
            for name in ["fonts", "cmap", "models", "tiktoken"]:
                existing = Path.home() / ".cache" / "babeldoc" / name
                if not existing.is_dir():
                    raise RuntimeError(f"Required offline asset folder missing: {name}")
                try:
                    (cache / name).symlink_to(existing, target_is_directory=True)
                except OSError:
                    shutil.copytree(existing, cache / name)
            env = {
                k: v
                for k, v in os.environ.items()
                if not any(
                    w in k.upper() for w in ("API_KEY", "TOKEN", "PROXY", "BASE_URL")
                )
            }
            env.update(
                HOME=str(home),
                USERPROFILE=str(home),
                HTTP_PROXY="http://127.0.0.1:1",
                HTTPS_PROXY="http://127.0.0.1:1",
                NO_PROXY="127.0.0.1,localhost",
                HF_HUB_OFFLINE="1",
            )
            with (run / "stdout.log").open("w") as log:
                subprocess.run(
                    [
                        sys.executable,
                        str(root / "addon/scripts/aidea_bridge.py"),
                        str(task),
                    ],
                    cwd=run,
                    env=env,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    check=True,
                )
        finally:
            server.shutdown()
            thread.join()
    report = json.loads(progress.read_text(encoding="utf-8"))
    assert report["status"] == "done" and report["persianLayout"] == {
        "corrected": 2,
        "skipped": 0,
    }, report
    assert len(report["outputFiles"]) == 2, report
    rust = tuple(map(int, version("babeldoc").split(".")[:2])) >= (0, 7)
    for name in report["outputFiles"]:
        with pdf.open(dest / name) as doc:
            txt = doc[0].get_text()
            if rust:
                # Check the actual marked logical PDF text, independently of
                # MuPDF's plain text bidi heuristics. Zotero's reader also uses
                # the glyph-level ToUnicode mappings on the same copy layer.
                parts = [
                    bytes.fromhex(token.decode()).decode("utf-16be")
                    for xref in range(1, doc.xref_length())
                    if doc.xref_is_stream(xref)
                    for token in re.findall(rb"/ActualText\s*<FEFF([a-fA-F0-9]+)>", doc.xref_stream(xref))
                ]
                logical = "".join(parts)
            else:
                logical = txt
            for needle in [
                "پژوهشگران",
                "می‌نویسند",
                "GPT-4.1 (2026)",
                "۱۲۳",
                "10.1000/test",
            ]:
                assert needle in logical, (name, needle, logical)
            assert PERSIAN_BODY in " ".join(logical.split()), (name, logical)
            assert (TITLE in txt) == (".dual." in name), (name, txt)
            doc[0].get_pixmap(matrix=pdf.Matrix(2, 2)).save(
                run / (Path(name).stem + ".png")
            )
    (run / "expected.json").write_text(
        json.dumps([PERSIAN_TITLE, PERSIAN_BODY], ensure_ascii=False), encoding="utf-8"
    )
    print(
        f"PASS: {report['persianLayout']}; check visual & reader selection with the fixtures in {dest}"
    )


if __name__ == "__main__":
    main()
