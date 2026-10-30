"""SVG at true scale: 1 user unit = 1 mm, document size in mm."""
from __future__ import annotations

import base64
import math
from datetime import date
from xml.sax.saxutils import escape

import cv2
import numpy as np

from .geometry import Arc, Drawing, Polyline, dimension_geometry, primitive_points, sample_arc

DASH = {"solid": "", "dashed": "3 1.5", "dotted": "0.6 1.2"}


def _fmt(v: float) -> str:
    return f"{v:.3f}".rstrip("0").rstrip(".") if abs(v) > 1e-9 else "0"


def _path_outline(prims) -> str:
    """One SVG path for the (closed) outline, arcs as elliptical-arc commands."""
    if not prims:
        return ""
    d = []
    last = None
    for i, prim in enumerate(prims):
        if isinstance(prim, Polyline):
            pts = prim.points
            if i == 0:
                d.append(f"M {_fmt(pts[0][0])} {_fmt(pts[0][1])}")
                last = pts[0]
                pts = pts[1:]
            for p in pts:
                if last is not None and abs(p[0] - last[0]) < 1e-6 and abs(p[1] - last[1]) < 1e-6:
                    continue
                d.append(f"L {_fmt(p[0])} {_fmt(p[1])}")
                last = p
        else:
            a: Arc = prim
            if i == 0:
                d.append(f"M {_fmt(a.start[0])} {_fmt(a.start[1])}")
            large = 1 if a.sweep_deg() > 180 else 0
            # SVG sweep-flag=1 means clockwise in screen (y-down) coordinates,
            # which is "positive angle" in that frame; our ccw flag is also in
            # the y-down frame, so sweep = 1 when ccw is True.
            sweep = 1 if a.ccw else 0
            r = _fmt(a.radius)
            d.append(f"A {r} {r} 0 {large} {sweep} {_fmt(a.end[0])} {_fmt(a.end[1])}")
            last = a.end
    d.append("Z")
    return " ".join(d)


def _dimension_svg(dim, font: float, color: str, idx: int | None = None) -> str:
    g = dimension_geometry(dim)
    (q1, q2) = g["line"]
    L = math.hypot(q2[0] - q1[0], q2[1] - q1[1])
    if L < 1e-6:
        return ""
    nx, ny = -(q2[1] - q1[1]) / L, (q2[0] - q1[0]) / L
    t = font * 0.5
    sw = _fmt(font * 0.08)
    dash = DASH.get(dim.style, "")
    dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
    parts = ['<g class="dim">']
    for (a, b) in g["ext"]:
        if math.dist(a, b) > 0.05:
            parts.append(f'<line x1="{_fmt(a[0])}" y1="{_fmt(a[1])}" x2="{_fmt(b[0])}" y2="{_fmt(b[1])}" stroke="{color}" stroke-width="{_fmt(font*0.05)}" stroke-dasharray="0.8 0.8"/>')
    parts.append(f'<line x1="{_fmt(q1[0])}" y1="{_fmt(q1[1])}" x2="{_fmt(q2[0])}" y2="{_fmt(q2[1])}" stroke="{color}" stroke-width="{sw}"{dash_attr}/>')
    for q in (q1, q2):
        parts.append(f'<line x1="{_fmt(q[0] - nx*t)}" y1="{_fmt(q[1] - ny*t)}" x2="{_fmt(q[0] + nx*t)}" y2="{_fmt(q[1] + ny*t)}" stroke="{color}" stroke-width="{sw}"/>')
    mx, my = g["mid"]
    txt = escape(g["text"])
    if idx is not None:
        txt = f"D{idx}  {txt}"
    parts.append(f'<text x="{_fmt(mx)}" y="{_fmt(my - font*0.35)}" font-size="{_fmt(font)}" text-anchor="middle" fill="{color}" '
                 f'transform="rotate({_fmt(g["angle_deg"])} {_fmt(mx)} {_fmt(my)})">{txt}</text>')
    parts.append('</g>')
    return "".join(parts)


def drawing_to_svg(dr: Drawing, background: np.ndarray | None = None, margin_mm: float = 20.0,
                   title_block: bool = True, crop_to_outline: bool = True) -> str:
    """Render the drawing to an SVG string. Coordinates are millimetres.

    If ``crop_to_outline`` the viewBox is tightened around the outline plus
    margin (dimension points are included), otherwise the full rectified canvas
    is used. ``background`` (rectified BGR image) is embedded as a reference
    raster when given.
    """
    bbox = dr.outline_bbox()
    pts_extra = [p for d in dr.dimensions for p in (d.p1, d.p2, *dimension_geometry(d)["line"])] + [l.pos for l in dr.labels]
    if crop_to_outline and (bbox or pts_extra):
        xs = ([bbox[0], bbox[2]] if bbox else []) + [p[0] for p in pts_extra]
        ys = ([bbox[1], bbox[3]] if bbox else []) + [p[1] for p in pts_extra]
        x0, y0 = min(xs) - margin_mm, min(ys) - margin_mm
        x1, y1 = max(xs) + margin_mm, max(ys) + margin_mm
    else:
        x0, y0, x1, y1 = 0.0, 0.0, dr.width_mm, dr.height_mm
    tb_h = 28.0 if title_block else 0.0
    W, H = x1 - x0, (y1 - y0) + tb_h
    font = max(2.5, min(6.0, W / 60))

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        f'width="{_fmt(W)}mm" height="{_fmt(H)}mm" viewBox="{_fmt(x0)} {_fmt(y0)} {_fmt(W)} {_fmt(H)}" '
        f'font-family="Helvetica, Arial, sans-serif">',
        f'<desc>pvsketch production outline. Units: mm (1 user unit = 1 mm). {escape(str(dr.meta.get("calibration", "")))}</desc>',
        f'<rect x="{_fmt(x0)}" y="{_fmt(y0)}" width="{_fmt(W)}" height="{_fmt(H)}" fill="white"/>',
    ]
    if background is not None:
        # embed as JPEG, positioned on the mm grid (rectified image spans 0..width_mm)
        ok, buf = cv2.imencode(".jpg", background, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ok:
            b64 = base64.b64encode(buf.tobytes()).decode("ascii")
            parts.append(f'<g id="photo" opacity="0.35"><image x="0" y="0" width="{_fmt(dr.width_mm)}" '
                         f'height="{_fmt(dr.height_mm)}" preserveAspectRatio="none" '
                         f'xlink:href="data:image/jpeg;base64,{b64}"/></g>')
    sw_out = _fmt(max(0.25, W / 800))
    parts.append(f'<g id="outline" fill="none" stroke="#000" stroke-width="{sw_out}" stroke-linejoin="round">'
                 f'<path d="{_path_outline(dr.outline)}"/></g>')
    if dr.detail:
        parts.append(f'<g id="detail" fill="none" stroke="#555" stroke-width="{_fmt(float(sw_out)*0.5)}">')
        for pl in dr.detail:
            pts = " ".join(f"{_fmt(x)},{_fmt(y)}" for x, y in pl.points)
            parts.append(f'<polyline points="{pts}"/>')
        parts.append('</g>')
    if dr.dimensions:
        parts.append('<g id="dimensions">')
        for i, dim in enumerate(dr.dimensions, 1):
            parts.append(_dimension_svg(dim, font, "#c00", idx=i))
        parts.append('</g>')
    if dr.labels:
        parts.append('<g id="labels">')
        for lb in dr.labels:
            parts.append(f'<text x="{_fmt(lb.pos[0])}" y="{_fmt(lb.pos[1])}" font-size="{_fmt(font)}" fill="#06c">{escape(lb.text)}</text>')
        parts.append('</g>')
    if title_block:
        ty = y1 + 4
        info = dr.meta
        line1 = f"{escape(str(info.get('name', 'stone')))}  -  outline from photo  -  {date.today().isoformat()}"
        bb = f"bbox {bbox[2]-bbox[0]:.1f} x {bbox[3]-bbox[1]:.1f} mm" if bbox else ""
        line2 = f"{escape(str(info.get('calibration', '')))}  {bb}  -  scale 1:1 in mm  -  {escape(str(info.get('source', '')))}"
        parts.append(f'<g id="titleblock" font-size="{_fmt(font*0.8)}" fill="#000">'
                     f'<line x1="{_fmt(x0)}" y1="{_fmt(y1)}" x2="{_fmt(x1)}" y2="{_fmt(y1)}" stroke="#000" stroke-width="0.3"/>'
                     f'<text x="{_fmt(x0+3)}" y="{_fmt(ty+font)}">{line1}</text>'
                     f'<text x="{_fmt(x0+3)}" y="{_fmt(ty+font*2.3)}">{line2}</text>')
        # 100 mm scale bar
        bar = 100.0 if W > 160 else 50.0
        bx, by = x1 - bar - 4, ty + font * 2.2
        parts.append(f'<line x1="{_fmt(bx)}" y1="{_fmt(by)}" x2="{_fmt(bx+bar)}" y2="{_fmt(by)}" stroke="#000" stroke-width="0.8"/>'
                     f'<text x="{_fmt(bx+bar/2)}" y="{_fmt(by-1.5)}" text-anchor="middle">{bar:g} mm</text></g>')
    parts.append('</svg>')
    return "\n".join(parts)


def drawing_to_png(dr: Drawing, px_per_mm: float = 4.0, background: np.ndarray | None = None,
                   margin_mm: float = 20.0) -> np.ndarray:
    """Quick raster preview (BGR) of outline + dims, for the UI / sharing."""
    bbox = list(dr.outline_bbox() or (0, 0, dr.width_mm, dr.height_mm))
    for d in dr.dimensions:
        for q in dimension_geometry(d)["line"]:
            bbox[0] = min(bbox[0], q[0]); bbox[1] = min(bbox[1], q[1]); bbox[2] = max(bbox[2], q[0]); bbox[3] = max(bbox[3], q[1])
    x0, y0 = bbox[0] - margin_mm, bbox[1] - margin_mm
    W = int((bbox[2] - bbox[0] + 2 * margin_mm) * px_per_mm)
    H = int((bbox[3] - bbox[1] + 2 * margin_mm) * px_per_mm)
    W, H = max(W, 10), max(H, 10)
    img = np.full((H, W, 3), 255, np.uint8)
    if background is not None:
        # paste the background at the right scale/offset
        s = px_per_mm / dr.meta.get("ppm", px_per_mm)
        M = np.array([[s, 0, -x0 * px_per_mm], [0, s, -y0 * px_per_mm]], dtype=np.float64)
        bg = cv2.warpAffine(background, M, (W, H), borderValue=(255, 255, 255))
        img = cv2.addWeighted(img, 0.6, bg, 0.4, 0)

    def P(p):
        return (int(round((p[0] - x0) * px_per_mm)), int(round((p[1] - y0) * px_per_mm)))

    for pl in dr.detail:
        pts = np.array([P(p) for p in pl.points], np.int32)
        cv2.polylines(img, [pts], False, (120, 120, 120), 1, cv2.LINE_AA)
    outline_pts = []
    for prim in dr.outline:
        outline_pts.extend(primitive_points(prim))
    if outline_pts:
        pts = np.array([P(p) for p in outline_pts], np.int32)
        cv2.polylines(img, [pts], True, (0, 0, 0), 2, cv2.LINE_AA)
    for i, d in enumerate(dr.dimensions, 1):
        g = dimension_geometry(d)
        for (a, b) in g["ext"]:
            cv2.line(img, P(a), P(b), (120, 120, 230), 1, cv2.LINE_AA)
        q1, q2 = P(g["line"][0]), P(g["line"][1])
        cv2.line(img, q1, q2, (0, 0, 200), 1, cv2.LINE_AA)
        cv2.circle(img, q1, 3, (0, 0, 200), -1); cv2.circle(img, q2, 3, (0, 0, 200), -1)
        m = ((q1[0] + q2[0]) // 2, (q1[1] + q2[1]) // 2 - 6)
        cv2.putText(img, f"D{i} {g['text']}", m, cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 200), 1, cv2.LINE_AA)
    for lb in dr.labels:
        cv2.putText(img, lb.text, P(lb.pos), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 100, 0), 1, cv2.LINE_AA)
    return img
