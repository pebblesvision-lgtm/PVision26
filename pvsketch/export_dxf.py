"""DXF export (mm, y-up) via ezdxf. Layers: OUTLINE, DETAIL, DIM, TEXT, PHOTO."""
from __future__ import annotations

import math

import ezdxf
from ezdxf.enums import TextEntityAlignment

from .geometry import Arc, Drawing, Polyline


def drawing_to_dxf(dr: Drawing, path: str, with_dimensions: bool = True) -> None:
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 4  # millimetres
    doc.header["$MEASUREMENT"] = 1
    msp = doc.modelspace()
    for name, color in (("OUTLINE", 7), ("DETAIL", 8), ("DIM", 1), ("TEXT", 5)):
        if name not in doc.layers:
            doc.layers.add(name, color=color)

    H = dr.height_mm

    def Y(p):  # y-down mm -> y-up mm
        return (float(p[0]), float(H - p[1]))

    # outline ------------------------------------------------------------
    for prim in dr.outline:
        if isinstance(prim, Polyline):
            pts = [Y(p) for p in prim.points]
            if len(pts) >= 2:
                msp.add_lwpolyline(pts, close=prim.closed, dxfattribs={"layer": "OUTLINE"})
        else:
            a: Arc = prim
            cx, cy = Y(a.center)
            sx, sy = Y(a.start)
            ex, ey = Y(a.end)
            a0 = math.degrees(math.atan2(sy - cy, sx - cx))
            a1 = math.degrees(math.atan2(ey - cy, ex - cx))
            # flipping y reverses the sweep direction: ccw in y-down == cw in y-up
            if a.ccw:
                a0, a1 = a1, a0
            msp.add_arc(center=(cx, cy), radius=a.radius, start_angle=a0, end_angle=a1,
                        dxfattribs={"layer": "OUTLINE"})

    # detail -------------------------------------------------------------
    for pl in dr.detail:
        pts = [Y(p) for p in pl.points]
        if len(pts) >= 2:
            msp.add_lwpolyline(pts, close=pl.closed, dxfattribs={"layer": "DETAIL"})

    # dimensions ---------------------------------------------------------
    if with_dimensions:
        for d in dr.dimensions:
            p1, p2 = Y(d.p1), Y(d.p2)
            if math.dist(p1, p2) < 1e-6:
                continue
            text = f"{d.value_mm:.1f}"
            if d.manual_mm is not None and abs(d.manual_mm - d.auto_mm) > 0.05:
                text = f"{d.value_mm:.1f} (photo {d.auto_mm:.1f})"
            if d.label:
                text = f"{d.label}: {text}"
            dim = msp.add_aligned_dim(p1=p1, p2=p2, distance=8.0, text=text,
                                      dxfattribs={"layer": "DIM"},
                                      override={"dimtxt": 3.5, "dimasz": 2.5, "dimexe": 1.5, "dimexo": 1.0})
            dim.render()

    for lb in dr.labels:
        msp.add_text(lb.text, height=3.5, dxfattribs={"layer": "TEXT"}).set_placement(
            Y(lb.pos), align=TextEntityAlignment.LEFT)

    note = (f"pvsketch - units mm - {dr.meta.get('calibration', '')} - {dr.meta.get('source', '')}")
    bbox = dr.outline_bbox()
    tx, ty = (bbox[0], H - bbox[3] - 12) if bbox else (0, -12)
    msp.add_text(note, height=3.0, dxfattribs={"layer": "TEXT"}).set_placement((tx, ty))
    doc.saveas(path)
