"""Minimal vector PDF writer: the drawing at true scale (or a stated reduction)
on A4/A3, portrait or landscape, with a title block and scale bar.

No third-party PDF library: a PDF with lines, Bézier arcs, dashes and Helvetica
text is ~100 lines of plain text objects. Opens in any viewer; prints at 1:1
when the printer is set to 100 % / "actual size".
"""
from __future__ import annotations

import math
from datetime import date

from .geometry import Arc, Drawing, Polyline, dimension_geometry
from .i18n import finish_name, t as tr

PAPER = {"a4": (210.0, 297.0), "a3": (297.0, 420.0)}
PT = 72.0 / 25.4  # points per mm
SCALES = (1, 2, 2.5, 5, 10, 20)
DASH = {"solid": "[] 0", "dashed": "[6 3] 0", "dotted": "[1 2.5] 0"}


def _esc(t: str) -> str:
    return t.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _f(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".") if abs(v) > 1e-9 else "0"


def _arc_beziers(a: Arc) -> list[tuple]:
    """Cubic Bézier segments approximating the arc (<= 90 deg each)."""
    cx, cy = a.center
    a0 = math.atan2(a.start[1] - cy, a.start[0] - cx)
    sweep = math.radians(a.sweep_deg()) * (1 if a.ccw else -1)
    n = max(1, int(math.ceil(abs(sweep) / (math.pi / 2))))
    step = sweep / n
    k = 4.0 / 3.0 * math.tan(step / 4)
    out = []
    for i in range(n):
        t0 = a0 + step * i
        t1 = t0 + step
        p0 = (cx + a.radius * math.cos(t0), cy + a.radius * math.sin(t0))
        p3 = (cx + a.radius * math.cos(t1), cy + a.radius * math.sin(t1))
        p1 = (p0[0] - k * a.radius * math.sin(t0), p0[1] + k * a.radius * math.cos(t0))
        p2 = (p3[0] + k * a.radius * math.sin(t1), p3[1] - k * a.radius * math.cos(t1))
        out.append((p1, p2, p3))
    return out


def choose_layout(w_mm: float, h_mm: float, paper: str = "auto", margin: float = 15.0,
                  title_h: float = 30.0) -> tuple[str, bool, float]:
    """(paper, landscape, scale_divisor) such that the drawing fits at 1:1 if possible."""
    papers = ["a4", "a3"] if paper == "auto" else [paper]
    for s in SCALES:
        for p in papers:
            pw, ph = PAPER[p]
            for landscape in (False, True):
                W, H = (ph, pw) if landscape else (pw, ph)
                if w_mm / s + 2 * margin <= W and h_mm / s + 2 * margin + title_h <= H:
                    return p, landscape, s
    return papers[-1], True, SCALES[-1]


def drawing_to_pdf(dr: Drawing, paper: str = "auto", margin_mm: float = 15.0) -> bytes:
    bbox = list(dr.outline_bbox() or (0, 0, dr.width_mm, dr.height_mm))
    for d in dr.dimensions:
        for q in dimension_geometry(d)["line"]:
            bbox[0] = min(bbox[0], q[0]); bbox[1] = min(bbox[1], q[1]); bbox[2] = max(bbox[2], q[0]); bbox[3] = max(bbox[3], q[1])
    for lb in dr.labels:
        bbox[0] = min(bbox[0], lb.pos[0]); bbox[1] = min(bbox[1], lb.pos[1]); bbox[2] = max(bbox[2], lb.pos[0]); bbox[3] = max(bbox[3], lb.pos[1])
    for pt in [p for f in dr.finishes for p in f.polygon] + [p for sk in dr.sketches for p in sk.points]:
        bbox[0] = min(bbox[0], pt[0]); bbox[1] = min(bbox[1], pt[1]); bbox[2] = max(bbox[2], pt[0]); bbox[3] = max(bbox[3], pt[1])
    lang = dr.lang
    cw, ch = bbox[2] - bbox[0] + 20, bbox[3] - bbox[1] + 20  # 10 mm air around content
    pname, landscape, s = choose_layout(cw, ch, paper, margin_mm)
    pw, ph = PAPER[pname]
    if landscape:
        pw, ph = ph, pw
    title_h = 30.0
    # content origin so the drawing is centred in the area above the title block
    area_w, area_h = pw - 2 * margin_mm, ph - 2 * margin_mm - title_h
    ox = margin_mm + (area_w - cw / s) / 2 - (bbox[0] - 10) / s
    oy = margin_mm + title_h + (area_h - ch / s) / 2  # bottom of the content, from the page bottom

    def X(p):  # mm (y-down drawing) -> PDF points (y-up page)
        return (ox + p[0] / s) * PT, (oy + (bbox[3] + 10 - p[1]) / s) * PT

    c: list[str] = []
    c.append("1 J 1 j")  # round caps/joins

    # outline
    c.append(f"{_f(0.5 * PT * 0.6)} w 0 0 0 RG [] 0 d")
    if dr.outline:
        first = True
        for prim in dr.outline:
            if isinstance(prim, Polyline):
                for i, p in enumerate(prim.points):
                    x, y = X(p)
                    c.append(f"{_f(x)} {_f(y)} {'m' if first and i == 0 else 'l'}")
                first = False
            else:
                if first:
                    x, y = X(prim.start); c.append(f"{_f(x)} {_f(y)} m")
                for p1, p2, p3 in _arc_beziers(prim):
                    a, b, d = X(p1), X(p2), X(p3)
                    c.append(f"{_f(a[0])} {_f(a[1])} {_f(b[0])} {_f(b[1])} {_f(d[0])} {_f(d[1])} c")
                first = False
        c.append("h S")
    # detail
    if dr.detail:
        c.append(f"{_f(0.2 * PT)} w 0.35 0.35 0.35 RG")
        for pl in dr.detail:
            for i, p in enumerate(pl.points):
                x, y = X(p); c.append(f"{_f(x)} {_f(y)} {'m' if i == 0 else 'l'}")
            c.append("h S" if pl.closed else "S")
    # finishes (hatch) and sketches
    font = 3.2 * PT
    for i, f in enumerate(dr.finishes, 1):
        fd = f.to_dict()
        c.append(f"0.45 0.45 0.45 RG {_f(0.12 * PT)} w [0.8 0.8] 0 d")
        for k, p in enumerate(f.polygon):
            x, y = X(p); c.append(f"{_f(x)} {_f(y)} {'m' if k == 0 else 'l'}")
        c.append("h S [] 0 d")
        c.append(f"0.2 0.2 0.2 RG {_f(0.15 * PT)} w")
        for p, q in fd["hatch"]["lines"]:
            xa, ya = X(p); xb, yb = X(q)
            c.append(f"{_f(xa)} {_f(ya)} m {_f(xb)} {_f(yb)} l S")
        if fd["hatch"]["dots"]:
            r = max(0.2, (f.spacing_mm or 4) * 0.12) / s * PT
            c.append("0.2 0.2 0.2 rg")
            for p in fd["hatch"]["dots"]:
                x, y = X(p)
                c.append(f"{_f(x - r)} {_f(y - r)} {_f(2 * r)} {_f(2 * r)} re f")
        cx_, cy_ = X(fd["centroid"])
        label = f"F{i} {f.label or finish_name(f.kind, lang)}"
        c.append(f"BT /F1 {_f(font)} Tf 0 g {_f(cx_ - len(label) * font * 0.25)} {_f(cy_)} Td ({_esc(label)}) Tj ET")
    for sk in dr.sketches:
        c.append(f"0 0.4 0.8 RG {_f(0.3 * PT)} w {DASH.get(sk.style, '[] 0')} d")
        for k, p in enumerate(sk.points):
            x, y = X(p); c.append(f"{_f(x)} {_f(y)} {'m' if k == 0 else 'l'}")
        c.append("S [] 0 d")
        if sk.arrow and len(sk.points) >= 2:
            a, b = X(sk.points[-2]), X(sk.points[-1])
            ang = math.atan2(b[1] - a[1], b[0] - a[0]); sz = 2.5 * PT
            l = (b[0] - sz * math.cos(ang - 0.4), b[1] - sz * math.sin(ang - 0.4)); r_ = (b[0] - sz * math.cos(ang + 0.4), b[1] - sz * math.sin(ang + 0.4))
            c.append(f"0 0.4 0.8 rg {_f(b[0])} {_f(b[1])} m {_f(l[0])} {_f(l[1])} l {_f(r_[0])} {_f(r_[1])} l h f")
        if sk.text:
            x, y = X(sk.points[0])
            c.append(f"BT /F1 {_f(font)} Tf 0 0.4 0.8 rg {_f(x + 1.5 * PT)} {_f(y + 1.5 * PT)} Td ({_esc(sk.text)}) Tj ET")
    # dimensions
    for i, d in enumerate(dr.dimensions, 1):
        g = dimension_geometry(d, lang)
        c.append(f"0.8 0 0 RG {_f(0.18 * PT)} w [1.5 1.5] 0 d")
        for (a, b) in g["ext"]:
            if math.dist(a, b) > 0.05:
                xa, ya = X(a); xb, yb = X(b)
                c.append(f"{_f(xa)} {_f(ya)} m {_f(xb)} {_f(yb)} l S")
        q1, q2 = X(g["line"][0]), X(g["line"][1])
        c.append(f"{DASH.get(d.style, '[] 0')} d {_f(0.3 * PT)} w {_f(q1[0])} {_f(q1[1])} m {_f(q2[0])} {_f(q2[1])} l S [] 0 d")
        dx, dy = q2[0] - q1[0], q2[1] - q1[1]
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L, dx / L
        t = 1.6 * PT
        for q in (q1, q2):
            c.append(f"{_f(q[0]-nx*t)} {_f(q[1]-ny*t)} m {_f(q[0]+nx*t)} {_f(q[1]+ny*t)} l S")
        ang = math.atan2(dy, dx)
        if ang > math.pi / 2 or ang < -math.pi / 2:
            ang += math.pi
        txt = f"D{i}  {g['text']}"
        tw = len(txt) * font * 0.5
        mx, my = (q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2
        ca, sa = math.cos(ang), math.sin(ang)
        # place text above the line (in its own frame)
        tx, ty = mx - ca * tw / 2 + (-sa) * 1.2 * PT, my - sa * tw / 2 + ca * 1.2 * PT
        c.append(f"BT /F1 {_f(font)} Tf 0.8 0 0 rg {_f(ca)} {_f(sa)} {_f(-sa)} {_f(ca)} {_f(tx)} {_f(ty)} Tm ({_esc(txt)}) Tj ET")
    # labels
    for lb in dr.labels:
        x, y = X(lb.pos)
        c.append(f"BT /F1 {_f(3.5*PT)} Tf 0 0.4 0.8 rg {_f(x)} {_f(y)} Td ({_esc(lb.text)}) Tj ET")

    # title block
    m = margin_mm * PT
    c.append(f"0 0 0 RG 0.4 w {_f(m)} {_f(m + title_h*PT)} m {_f(pw*PT - m)} {_f(m + title_h*PT)} l S")
    ob = dr.outline_bbox()
    tb = dr.titleblock or {}
    bb = f"{tr(lang, 'outline')} {ob[2]-ob[0]:.1f} x {ob[3]-ob[1]:.1f} mm" if ob else ""
    head = str(tb.get("project") or dr.meta.get("name", "stone"))
    for key in ("element", "material", "quantity"):
        if tb.get(key):
            head += f"   {tr(lang, key)}: {tb[key]}"
    lines = [
        head,
        f"{tr(lang, 'title')}  -  {date.today().isoformat()}  -  {tr(lang, 'scale')} 1:{s:g}  -  {bb}  -  {tr(lang, 'units')}",
        f"{dr.meta.get('calibration', '')}  -  {tr(lang, 'source')} {dr.meta.get('source', '')}"
        + (f"  -  {tr(lang, 'drawn_by')}: {tb['drawn_by']}" if tb.get("drawn_by") else "")
        + f"  -  {tr(lang, 'print')}",
    ]
    leg = ([str(tb["finish"])] if tb.get("finish") else []) + [f"F{i} {f.label or finish_name(f.kind, lang)}" for i, f in enumerate(dr.finishes, 1)]
    if leg:
        lines.append(f"{tr(lang, 'finishes')}: " + ", ".join(leg))
    if tb.get("notes"):
        lines.append(f"{tr(lang, 'notes')}: {tb['notes']}")
    for k, line in enumerate(lines[:5]):
        size = 3.4 if k == 0 else 2.8
        c.append(f"BT /F1 {_f(size*PT)} Tf 0 g {_f(m + 2*PT)} {_f(m + (title_h - 5 - 4.3*k)*PT)} Td ({_esc(line)}) Tj ET")
    # measurement table (right part of title block) when there are dimensions
    if dr.dimensions:
        col = pw * PT * 0.56
        c.append(f"BT /F1 {_f(2.6*PT)} Tf 0 g {_f(col)} {_f(m + (title_h - 5)*PT)} Td ({_esc(tr(lang, 'measurements'))}) Tj ET")
        for k, d in enumerate(dr.dimensions[:10]):
            row = f"D{k+1} {d.label or ''}: {d.value_mm:.1f}" + (f" / {d.auto_mm:.1f}" if d.manual_mm is not None else "") + " mm"
            cx_ = col + (k // 5) * (pw * PT * 0.2)
            c.append(f"BT /F1 {_f(2.6*PT)} Tf {_f(cx_)} {_f(m + (title_h - 9 - 3.8*(k % 5))*PT)} Td ({_esc(row)}) Tj ET")
    # scale bar: 100 mm at drawing scale
    bar = 100.0 / s * PT
    bx, by = pw * PT - m - bar, m + 3 * PT
    c.append(f"0 0 0 RG 1.2 w {_f(bx)} {_f(by)} m {_f(bx+bar)} {_f(by)} l S")
    c.append(f"BT /F1 {_f(2.6*PT)} Tf 0 g {_f(bx)} {_f(by + 2*PT)} Td ({_esc(f'100 mm, 1:{s:g}')}) Tj ET")

    content = "\n".join(c).encode("latin-1", "replace")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {_f(pw*PT)} {_f(ph*PT)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(),
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)
