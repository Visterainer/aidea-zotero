"""Page routing and output assembly for the Rust-backed PDF engine."""

from contextlib import ExitStack
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from tempfile import TemporaryDirectory
import os
import shutil

import pymupdf as pdf


def uses_rust_engine():
    try:
        major, minor, *_ = version("babeldoc").split(".")
    except PackageNotFoundError:
        return False
    return (int(major), int(minor)) >= (0, 7)


def translation_partitions(total, selected, scanned):
    pages = set(range(1, total + 1)) if selected is None else set(selected)
    digital, ocr = pages - scanned, pages & scanned
    return [(sorted(group), scan) for group, scan in ((digital, False), (ocr, True)) if group]


def merge_glossaries(paths, destination):
    import csv

    source_terms = set()
    with destination.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.writer(output)
        fields = None
        for path in paths:
            with path.open(encoding="utf-8-sig", newline="") as terms:
                reader = csv.reader(terms)
                header = next(reader, [])
                if not header:
                    continue
                if fields is None:
                    fields = header
                    writer.writerow(fields)
                if header != fields:
                    raise ValueError("Glossary columns changed between translation passes")
                for row in reader:
                    if row and row[0] not in source_terms:
                        writer.writerow(row)
                        source_terms.add(row[0])


def assemble_outputs(source, passes, destination, *, mono, dual, alternating, save_glossary):
    """Validate all full-page outputs before making any of them visible to Zotero."""
    stage = Path(passes[0][0]).parent / "assembled"
    stage.mkdir(exist_ok=True)
    owners = {number - 1: index for index, (_, pages) in enumerate(passes) for number in pages}
    staged = []
    with pdf.open(source) as original:
        for kind, enabled in (("mono", mono), ("dual", dual)):
            if not enabled:
                continue
            pair_size = 2 if kind == "dual" and alternating else 1
            expected = len(original) * pair_size
            with ExitStack() as stack:
                paths = [list(Path(folder).glob(f"*.{kind}.pdf")) for folder, _ in passes]
                if any(len(files) != 1 for files in paths):
                    raise ValueError(f"Expected one {kind} PDF from every translation pass")
                artifacts = [stack.enter_context(pdf.open(files[0])) for files in paths]
                if any(len(doc) != expected for doc in artifacts):
                    raise ValueError(f"Could not match {kind} PDF pages to the input document")
                name = paths[0][0].name
                if len(artifacts) == 1:
                    shutil.copyfile(paths[0][0], stage / name)
                else:
                    combined = stack.enter_context(pdf.open())
                    page_links = []
                    for index in range(expected):
                        artifact = artifacts[owners.get(index // pair_size, 0)]
                        page_links.append(artifact[index].get_links())
                        combined.insert_pdf(artifact, from_page=index, to_page=index, links=False)
                    for page, links in zip(combined, page_links, strict=True):
                        for link in links:
                            if link["kind"] in (pdf.LINK_URI, pdf.LINK_GOTO) and link.get("page", 0) >= 0:
                                page.insert_link(link)
                    combined.set_metadata(artifacts[0].metadata)
                    outline = artifacts[0].get_toc(simple=False)
                    if outline:
                        combined.set_toc(outline)
                    labels = artifacts[0].get_page_labels()
                    if labels:
                        combined.set_page_labels(labels)
                    combined.save(stage / name, deflate=True, garbage=3)
                staged.append(stage / name)
    if save_glossary:
        terms = [p for folder, _ in passes for p in Path(folder).glob("*.glossary.csv")]
        if terms:
            glossary = stage / terms[0].name
            merge_glossaries(terms, glossary)
            staged.append(glossary)
    return publish_outputs(staged, destination)


def publish_outputs(staged, destination):
    # The final directory may be on a different volume than the task folder.
    # Copy to a sibling staging directory so the final rename is atomic.
    published = []
    with TemporaryDirectory(prefix=".aidea-pdf-", dir=destination) as pending:
        pending = Path(pending)
        previous = pending / "previous"
        previous.mkdir()
        for path in staged:
            shutil.copyfile(path, pending / path.name)
            original = Path(destination) / path.name
            if original.exists():
                shutil.copy2(original, previous / path.name)
        try:
            for path in staged:
                os.replace(pending / path.name, Path(destination) / path.name)
                published.append(path)
        except OSError:
            for path in reversed(published):
                original = Path(destination) / path.name
                backup = previous / path.name
                if backup.exists():
                    os.replace(backup, original)
                else:
                    original.unlink()
            raise
    return [path.name for path in published if path.suffix == ".pdf"]
