"""Selectable logical-text layer for an unrotated, shaped Persian scratch page."""

import re
import unicodedata as ud
from statistics import median
import pymupdf as pdf


def _key(s):
    # Only used to align traces to SOURCE indices. Never recover copy text from glyphs.
    # MuPDF exports presentation forms and can mirror the glyph for punctuation.
    return "".join(
        {")": "(", "]": "[", "}": "{", "»": "«"}.get(c, c)
        for c in ud.normalize("NFKD", s)
        if not (c.isspace() or ud.category(c) in ("Mn", "Cf"))
    )


def _lines(page, source):
    keys = [(i, k) for i, c in enumerate(source) for k in _key(c)]
    cursor = 0
    lines = []
    for sp in page.get_texttrace():
        if sp["dir"] != (1.0, 0.0):
            raise ValueError("only unrotated horizontal shaped text is supported")
        for cp, gid, (x, y), box in sp["chars"]:
            key = _key(chr(cp))
            if not key:
                continue
            if "".join(k for _, k in keys[cursor : cursor + len(key)]) != key:
                raise ValueError(
                    f"cannot align glyph {chr(cp)!r} at normalized offset {cursor}; supply positioned lines instead"
                )
            a, b = keys[cursor][0], keys[cursor + len(key) - 1][0] + 1
            cursor += len(key)
            if not lines or abs(y - lines[-1][0][4]) > max(0.5, sp["size"] * 0.15):
                lines.append([])
            lines[-1].append((a, b, box[0], box[2], y, sp["size"]))
    if cursor != len(keys) or not lines:
        raise ValueError("source and visible text coverage differ")
    return lines


def _tokens(line, source, end):
    # Shape traces are in logical stream order, x is visual. Words are atomic;
    # join words whose X extents run left-to-right into a single selectable run.
    pieces = []
    for m in re.finditer(r"\S+", source[line[0][0] : end]):
        a, b = (v + line[0][0] for v in m.span())
        glyphs = [g for g in line if g[0] < b and a < g[1]]
        if not glyphs:
            raise ValueError("word without visible glyphs")
        pieces.append([m[0], min(g[2] for g in glyphs), max(g[3] for g in glyphs)])

    def merge(i):
        s, x1, x2 = pieces[i]
        t, y1, y2 = pieces.pop(i + 1)
        pieces[i] = [s + " " + t, min(x1, y1), max(x2, y2)]

    # In RTL visual order, two increasing/overlapping boxes are one LTR island.
    i = 0
    while i + 1 < len(pieces):
        if pieces[i][1] < pieces[i + 1][2] - 0.1:
            merge(i)
            i = max(0, i - 1)
        else:
            i += 1

    def strong_r(s):
        return ud.bidirectional(s[0]) in ("R", "AL")

    # Adjacent non-R tokens can be reordered by bidi; keep that group atomic.
    i = 0
    while i + 1 < len(pieces):
        if not strong_r(pieces[i][0]) and not strong_r(pieces[i + 1][0]):
            merge(i)
        else:
            i += 1
    # In an LTR-dominant or ambiguous line one atomic glyph is the safe fallback.
    if len(pieces) > 1 and sum(strong_r(p[0]) for p in pieces) / len(pieces) < 0.3:
        while len(pieces) > 1:
            merge(0)
    return pieces


def positioned_runs(page, source):
    if not source.strip() or any(ud.category(c) == "Cf" and c != "‌" for c in source):
        raise ValueError("expected pristine logical text, not visual bidi controls")
    lines = _lines(page, source)
    out = []
    for i, line in enumerate(lines):
        end = lines[i + 1][0][0] if i + 1 < len(lines) else len(source)
        if i and not source[line[0][0] - 1].isspace():
            raise ValueError("wrap inside a word is not supported")
        pieces = _tokens(line, source, end)
        fs = median(g[5] for g in line)
        baseline = median(g[4] for g in line)
        for j, (s, x0, x1) in enumerate(pieces):
            if j + 1 < len(pieces):
                nxt, nx0, nx1 = pieces[j + 1]
                # Across descending word boxes the horizontal LTR gap is always
                # negative, so the reader's computed positive gap threshold is 1pt.
                rtl = lambda t: ud.bidirectional(t[0]) in ("AL", "R", "AN")
                threshold = (
                    (fs**2 + (x1 - x0) ** 2) ** 0.5
                    if any(ud.category(c) == "Mn" for c in s)
                    else fs
                )
                inferred = (
                    x0 - nx1 > 1 if rtl(s) and rtl(nxt) else nx0 - x1 < -threshold
                )
                if not inferred:
                    s += " "
            out.append((s, x0, x1, baseline, fs))
    if " ".join(s.strip() for s, *_ in out) != " ".join(source.split()):
        raise ValueError("run mapping lost source text")
    for i, (_, left, right, y, em) in enumerate(out):
        if not (
            0 <= left < right <= page.rect.width + 0.05
            and 0 <= y <= page.rect.height
            and em > 0
        ):
            raise ValueError("nonpositive or off-page copy rectangle")
        if i and y < out[i - 1][3] - 0.01:
            raise ValueError("expected a single top-to-bottom column")
    return out


def _object(doc, body, stream=None):
    n = doc.get_new_xref()
    doc.update_object(n, body)
    if stream is not None:
        doc.update_stream(n, stream)
    return n


def add_copy_runs(page, runs):
    """Add invisible glyphs (logical string, x-left, x-right, y-baseline, em).
    Coordinates in top-left-origin points; page must contain NO selectable text.
    """
    if page.get_texttrace():
        raise ValueError("copy layer requires text-free artwork")
    d = page.parent
    ops = ["q BT 3 Tr"]
    resources = int(d.xref_get_key(page.xref, "Resources")[1].split()[0])
    for k in range(0, len(runs), 100):
        batch = runs[k : k + 100]
        maps = []
        for i, (text, x0, x1, y, fs) in enumerate(batch, 1):
            dst = text.encode("utf-16be")
            if len(dst) > 512 or x1 <= x0:
                raise ValueError("invalid glyph extent or oversized CMap entry")
            maps.append(f"<{i:02X}> <{dst.hex()}>")
            w = x1 - x0
            a, c, x = w / fs, 0, x0
            if any(ud.category(ch) == "Mn" for ch in text):
                # Reader 5.7 sets advance=0 for *any* CMap string containing Mn.
                # Its axial bbox still includes the font height. Use a non-singular
                # shear to get the same word hit-box with or without that advance.
                a, c, x = 0.000001, w / fs, x0 + 0.25 * w
            # MuPDF honors ActualText; Zotero also needs the ToUnicode map and
            # the independently positioned hitboxes. Explicit separators here
            # prevent MuPDF gluing the Persian and Latin runs together.
            replacement = text.strip() + (" " if k + i < len(runs) else "")
            actual = replacement.encode("utf-16be").hex()
            ops.append(
                f"/Span << /ActualText <FEFF{actual}> >> BDC\n"
                f"/Copy{k} {fs:.6f} Tf {a:.8f} 0 {c:.8f} 1 {x:.6f} {page.rect.height - y:.6f} Tm <{i:02X}> Tj\nEMC"
            )
        cmap = (
            "/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n/CIDSystemInfo << /Registry (AIdea) /Ordering (Copy) /Supplement 0 >> def\n/CMapName /Copy def /CMapType 2 def\n1 begincodespacerange <00> <ff> endcodespacerange\n"
            + str(len(maps))
            + " beginbfchar\n"
            + "\n".join(maps)
            + "\nendbfchar endcmap CMapName currentdict /CMap defineresource pop end end"
        ).encode()
        cm = _object(d, "<<>>", cmap)
        glyph = _object(d, "<<>>", b"1000 0 0 0 0 0 d1")
        font = _object(
            d,
            f"<< /Type /Font /Subtype /Type3 /FontBBox [0 -200 1000 800] /FontMatrix [.001 0 0 .001 0 0] /Resources <<>> /CharProcs << /g {glyph} 0 R >> /Encoding << /Type /Encoding /Differences [1 "
            + " ".join(["/g"] * len(batch))
            + f"] >> /FirstChar 1 /LastChar {len(batch)} /Widths ["
            + " ".join(["1000"] * len(batch))
            + f"] /ToUnicode {cm} 0 R >>",
        )
        d.xref_set_key(resources, f"Font/Copy{k}", f"{font} 0 R")
    ops.append("ET Q")
    stream = _object(d, "<<>>", "\n".join(ops).encode())
    d.xref_set_key(
        page.xref,
        "Contents",
        "[" + " ".join(f"{x} 0 R" for x in [*page.get_contents(), stream]) + "]",
    )


def prepare_selectable_page(shaped_page, logical_text):
    if shaped_page.rotation or shaped_page.rect.top_left != (0, 0):
        raise ValueError("scratch page must be unrotated")
    runs = positioned_runs(shaped_page, logical_text)
    with pdf.open("svg", shaped_page.get_svg_image(text_as_path=True).encode()) as svg:
        data = svg.convert_to_pdf()
    # SVG roundtrip can round fractional page dimensions; preserve original media box.
    d = pdf.open()
    try:
        p = d.new_page(width=shaped_page.rect.width, height=shaped_page.rect.height)
        with pdf.open("pdf", data) as art:
            p.show_pdf_page(p.rect, art, 0, keep_proportion=False)
        add_copy_runs(p, runs)
        return d
    except Exception:
        d.close()
        raise
