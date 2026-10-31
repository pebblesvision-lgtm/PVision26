"""Hatch patterns that stand for hand-tooled stone finishes on a drawing.

Each finish is a polygon region (mm) plus a kind; this module turns it into
plain line segments / dots clipped to the polygon, so every exporter (SVG, DXF,
PDF, PNG) and the browser can draw exactly the same thing without needing
HATCH entities or clip paths.

    frijnen       fine parallel chisel lines         (lines, ~3 mm)
    scharreren    broader parallel strokes            (lines, ~10 mm)
    gradineren    toothed chisel: groups of lines     (groups)
    boucharderen  bush hammer: dot field              (dots)
    spitsen       pitched: short random strokes       (strokes)
    gevlamd       flamed: irregular strokes           (strokes, finer)
    randslag      drafted margin along the edges      (edge ticks)
    gezoet / gepolijst / gezaagd / geschuurd: no hatch, label only
"""
from __future__ import annotations

import math
import random
from typing import Any, Sequence

Point = tuple[float, float]
Segment = tuple[Point, Point]

FINISH_DEFAULTS: dict[str, dict[str, Any]] = {
    "frijnen": {"pattern": "lines", "spacing": 3.0, "angle": 45.0},
    "frijnen_v": {"pattern": "lines", "spacing": 3.0, "angle": 90.0},
    "frijnen_h": {"pattern": "lines", "spacing": 3.0, "angle": 0.0},
    "kathedraal": {"pattern": "herringbone", "spacing": 3.0, "angle": 45.0, "width": 40.0},
    "kathedraal_vrij": {"pattern": "curves", "spacing": 4.0, "angle": 0.0},
    "scharreren": {"pattern": "lines", "spacing": 10.0, "angle": 45.0},
    "gradineren": {"pattern": "groups", "spacing": 12.0, "angle": 45.0},
    "boucharderen": {"pattern": "dots", "spacing": 4.0, "angle": 0.0},
    "spitsen": {"pattern": "strokes", "spacing": 9.0, "angle": 0.0},
    "gevlamd": {"pattern": "strokes", "spacing": 5.0, "angle": 0.0},
    "randslag": {"pattern": "edge", "spacing": 4.0, "angle": 0.0, "width": 25.0},
    "gezoet": {"pattern": "none", "spacing": 0.0, "angle": 0.0},
    "gepolijst": {"pattern": "none", "spacing": 0.0, "angle": 0.0},
    "gezaagd": {"pattern": "none", "spacing": 0.0, "angle": 0.0},
    "geschuurd": {"pattern": "none", "spacing": 0.0, "angle": 0.0},
}


def _rot(p: Point, a: float) -> Point:
    c, s = math.cos(a), math.sin(a)
    return (p[0] * c - p[1] * s, p[0] * s + p[1] * c)


def _scanlines(poly: Sequence[Point], ys: Sequence[float]) -> list[Segment]:
    """Horizontal segments at each y clipped to the polygon (even-odd rule)."""
    out: list[Segment] = []
    n = len(poly)
    for y in ys:
        xs: list[float] = []
        for i in range(n):
            (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
            if (y1 <= y < y2) or (y2 <= y < y1):
                xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            if b - a > 0.3:
                out.append(((a, y), (b, y)))
    return out


def parallel_lines(poly: Sequence[Point], angle_deg: float, spacing: float,
                   groups: int = 1, group_gap_ratio: float = 2.5) -> list[Segment]:
    """Lines at ``angle_deg`` every ``spacing`` mm, clipped to the polygon.

    ``groups`` > 1 produces bundles of lines (toothed chisel): ``groups`` lines
    ``spacing/groups`` apart, then a gap.
    """
    if len(poly) < 3 or spacing <= 0:
        return []
    a = math.radians(-angle_deg)
    rp = [_rot(p, a) for p in poly]
    y0 = min(p[1] for p in rp)
    y1 = max(p[1] for p in rp)
    ys: list[float] = []
    if groups <= 1:
        y = y0 + spacing / 2
        while y < y1:
            ys.append(y); y += spacing
    else:
        pitch = spacing / groups
        y = y0 + spacing / 2
        while y < y1:
            for k in range(groups):
                yy = y + k * pitch
                if yy < y1:
                    ys.append(yy)
            y += spacing * group_gap_ratio
    segs = _scanlines(rp, ys)
    return [(_rot(p, -a), _rot(q, -a)) for p, q in segs]


def point_in_poly(pt: Point, poly: Sequence[Point]) -> bool:
    x, y = pt
    inside = False
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                inside = not inside
    return inside


def dot_field(poly: Sequence[Point], spacing: float) -> list[Point]:
    """Staggered grid of points inside the polygon."""
    if len(poly) < 3 or spacing <= 0:
        return []
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    out: list[Point] = []
    row = 0
    y = min(ys) + spacing / 2
    while y < max(ys):
        x = min(xs) + (spacing / 2 if row % 2 else spacing)
        while x < max(xs):
            if point_in_poly((x, y), poly):
                out.append((x, y))
            x += spacing
        y += spacing * 0.866
        row += 1
    return out


def random_strokes(poly: Sequence[Point], spacing: float, length_ratio: float = 0.8,
                   seed: int = 7) -> list[Segment]:
    """Short strokes at random angles, roughly one per spacing² cell (pitched face)."""
    rng = random.Random(seed)
    out: list[Segment] = []
    for cx, cy in dot_field(poly, spacing):
        jx, jy = (rng.random() - 0.5) * spacing * 0.6, (rng.random() - 0.5) * spacing * 0.6
        a = rng.random() * math.pi
        L = spacing * length_ratio * (0.6 + 0.8 * rng.random())
        p = (cx + jx - math.cos(a) * L / 2, cy + jy - math.sin(a) * L / 2)
        q = (cx + jx + math.cos(a) * L / 2, cy + jy + math.sin(a) * L / 2)
        if point_in_poly(p, poly) and point_in_poly(q, poly):
            out.append((p, q))
    return out


def herringbone(poly: Sequence[Point], spacing: float, band: float, angle_deg: float = 45.0) -> list[Segment]:
    """Kathedraalslag: vertical bands of chisel lines, direction alternating
    +angle / -angle per band, plus the band boundaries."""
    if len(poly) < 3 or spacing <= 0 or band <= 0:
        return []
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    out: list[Segment] = []
    k = 0
    x = x0
    while x < x1:
        strip = [(x, y0 - 1), (min(x + band, x1 + 1), y0 - 1), (min(x + band, x1 + 1), y1 + 1), (x, y1 + 1)]
        clipped = _clip_poly(poly, strip)
        if len(clipped) >= 3:
            out += parallel_lines(clipped, angle_deg if k % 2 == 0 else -angle_deg, spacing)
            if k > 0:
                out += _scanlines_vertical(poly, x)
        x += band; k += 1
    return out


def _scanlines_vertical(poly: Sequence[Point], x: float) -> list[Segment]:
    rp = [(p[1], p[0]) for p in poly]           # swap axes and reuse the horizontal clipper
    return [((q[1], q[0]), (r[1], r[0])) for q, r in _scanlines(rp, [x])]


def _clip_poly(subject: Sequence[Point], clip_rect: Sequence[Point]) -> list[Point]:
    """Sutherland-Hodgman clip of ``subject`` by an axis-aligned rectangle."""
    xs = [p[0] for p in clip_rect]; ys = [p[1] for p in clip_rect]
    bounds = [("x>", min(xs)), ("x<", max(xs)), ("y>", min(ys)), ("y<", max(ys))]
    pts = list(subject)
    for kind, v in bounds:
        if not pts:
            break
        inside = (lambda p: p[0] >= v) if kind == "x>" else (lambda p: p[0] <= v) if kind == "x<" else \
                 (lambda p: p[1] >= v) if kind == "y>" else (lambda p: p[1] <= v)
        def inter(a, b):
            if kind[0] == "x":
                t = (v - a[0]) / (b[0] - a[0]) if b[0] != a[0] else 0.0
                return (v, a[1] + t * (b[1] - a[1]))
            t = (v - a[1]) / (b[1] - a[1]) if b[1] != a[1] else 0.0
            return (a[0] + t * (b[0] - a[0]), v)
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
        pts = out
    return pts


def curved_strokes(poly: Sequence[Point], spacing: float, seed: int = 11) -> list[Segment]:
    """Vrije kathedraalslag: short arcs in loose rows, as polyline segments."""
    rng = random.Random(seed)
    out: list[Segment] = []
    for cx, cy in dot_field(poly, spacing * 2.2):
        a0 = rng.random() * math.pi
        r = spacing * (1.2 + rng.random())
        sweep = 1.1 + rng.random() * 0.8
        n = 5
        pts = [(cx + r * math.cos(a0 + sweep * i / n), cy + r * math.sin(a0 + sweep * i / n)) for i in range(n + 1)]
        if all(point_in_poly(p, poly) for p in pts):
            out += list(zip(pts, pts[1:]))
    return out


def edge_ticks(poly: Sequence[Point], spacing: float, width: float) -> list[Segment]:
    """Drafted margin: short lines perpendicular to each edge, pointing inward,
    plus the inner boundary of the band."""
    if len(poly) < 3 or spacing <= 0:
        return []
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1]
               for i in range(len(poly)))
    sign = 1.0 if area > 0 else -1.0   # y-down: positive area => clockwise on screen
    out: list[Segment] = []
    n = len(poly)
    for i in range(n):
        (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
        L = math.hypot(x2 - x1, y2 - y1)
        if L < 1e-6:
            continue
        ux, uy = (x2 - x1) / L, (y2 - y1) / L
        nx, ny = -uy * sign, ux * sign  # inward normal
        d = spacing / 2
        while d < L:
            p = (x1 + ux * d, y1 + uy * d)
            q = (p[0] + nx * width, p[1] + ny * width)
            if point_in_poly((p[0] + nx * width * 0.5, p[1] + ny * width * 0.5), poly):
                out.append((p, q))
            d += spacing
    return out


def finish_hatch(polygon: Sequence[Sequence[float]], kind: str, angle_deg: float | None = None,
                 spacing: float | None = None, width: float | None = None) -> dict[str, Any]:
    """-> {"lines": [[p, q], ...], "dots": [p, ...]} in mm."""
    poly = [(float(p[0]), float(p[1])) for p in polygon]
    d = FINISH_DEFAULTS.get(kind, FINISH_DEFAULTS["frijnen"])
    ang = d["angle"] if angle_deg is None else float(angle_deg)
    sp = d["spacing"] if spacing is None else float(spacing)
    pat = d["pattern"]
    lines: list[Segment] = []
    dots: list[Point] = []
    if len(poly) >= 3 and sp > 0:
        if pat == "lines":
            lines = parallel_lines(poly, ang, sp)
        elif pat == "groups":
            lines = parallel_lines(poly, ang, sp, groups=4)
        elif pat == "dots":
            dots = dot_field(poly, sp)
        elif pat == "strokes":
            lines = random_strokes(poly, sp)
        elif pat == "edge":
            lines = edge_ticks(poly, sp, float(width or d.get("width", 25.0)))
        elif pat == "herringbone":
            lines = herringbone(poly, sp, float(width or d.get("width", 40.0)), ang)
        elif pat == "curves":
            lines = curved_strokes(poly, sp)
    # keep the export light
    if len(lines) > 6000:
        lines = lines[:: math.ceil(len(lines) / 6000)]
    if len(dots) > 6000:
        dots = dots[:: math.ceil(len(dots) / 6000)]
    return {"lines": [[list(p), list(q)] for p, q in lines], "dots": [list(p) for p in dots]}


def centroid(polygon: Sequence[Sequence[float]]) -> Point:
    xs = [float(p[0]) for p in polygon]; ys = [float(p[1]) for p in polygon]
    return (sum(xs) / len(xs), sum(ys) / len(ys)) if xs else (0.0, 0.0)
