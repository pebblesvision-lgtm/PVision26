"""DXF export (mm, y-up) via ezdxf. Layers: OUTLINE, DETAIL, DIM, TEXT.

``version`` "R2010" (default, LWPOLYLINE + DIMENSION) or "R12" for older
stone CAM / CAD programs (POLYLINE entities, dimensions as exploded lines+text).
"""
from __future__ import annotations

import math

import ezdxf
from ezdxf.enums import TextEntityAlignment

from .geometry import Arc, Drawing, Polyline, dimension_geometry
from .i18n import finish_name, t as tr

LINETYPE = {"solid": "CONTINUOUS", "dashed": "DASHED", "dotted": "DOT"}


def drawing_to_dxf(dr: Drawing, path: str, with_dimensions: bool = True, version: str = "R2010") -> None:
    version = "R12" if version.upper() in ("R12", "AC1009") else "R2010"
    doc = ezdxf.new(version, setup=True)
    doc.header["$INSUNITS"] = 4  # millimetres
    if version != "R12":
        doc.header["$MEASUREMENT"] = 1
    msp = doc.modelspace()
    lang = dr.lang
    for name, color in (("OUTLINE", 7), ("DETAIL", 8), ("DIM", 1), ("TEXT", 5), ("FINISH", 8), ("FINISH_BOUNDARY", 9), ("SKETCH", 4)):
        if name not in doc.layers:
            doc.layers.add(name, color=color)

    H = dr.height_mm

    def Y(p):  # y-down mm -> y-up mm
        return (float(p[0]), float(H - p[1]))

    def polyline(pts, closed, layer, linetype="CONTINUOUS"):
        if len(pts) < 2:
            return
        attribs = {"layer": layer}
        if linetype != "CONTINUOUS":
            attribs["linetype"] = linetype
        if version == "R12":
            msp.add_polyline2d(pts, close=closed, dxfattribs=attribs)
        else:
            msp.add_lwpolyline(pts, close=closed, dxfattribs=attribs)

    # outline ------------------------------------------------------------
    for prim in dr.outline:
        if isinstance(prim, Polyline):
            polyline([Y(p) for p in prim.points], prim.closed, "OUTLINE")
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
        polyline([Y(p) for p in pl.points], pl.closed, "DETAIL")

    # finishes: hatch as plain LINEs (every CAD/CAM reads those), boundary dashed
    for i, f in enumerate(dr.finishes, 1):
        fd = f.to_dict()
        polyline([Y(p) for p in f.polygon], True, "FINISH_BOUNDARY", "DASHED")
        for p, q in fd["hatch"]["lines"]:
            msp.add_line(Y(p), Y(q), dxfattribs={"layer": "FINISH"})
        for p in fd["hatch"]["dots"]:
            msp.add_circle(Y(p), radius=max(0.2, (f.spacing_mm or 4) * 0.12), dxfattribs={"layer": "FINISH"})
        msp.add_text(f"F{i} {f.label or finish_name(f.kind, lang)}", height=3.0, dxfattribs={"layer": "TEXT"}).set_placement(
            Y(fd["centroid"]), align=TextEntityAlignment.MIDDLE_CENTER)
    for sk in dr.sketches:
        polyline([Y(p) for p in sk.points], False, "SKETCH", LINETYPE.get(sk.style, "CONTINUOUS"))
        if sk.arrow and len(sk.points) >= 2:
            a, b = Y(sk.points[-2]), Y(sk.points[-1])
            ang = math.atan2(b[1] - a[1], b[0] - a[0])
            for da in (-0.4, 0.4):
                msp.add_line(b, (b[0] - 2.5 * math.cos(ang + da), b[1] - 2.5 * math.sin(ang + da)), dxfattribs={"layer": "SKETCH"})
        if sk.text:
            x, y = Y(sk.points[0])
            msp.add_text(sk.text, height=3.0, dxfattribs={"layer": "SKETCH"}).set_placement((x + 1.5, y + 1.5))

    # dimensions ---------------------------------------------------------
    if with_dimensions:
        for i, d in enumerate(dr.dimensions, 1):
            g = dimension_geometry(d, lang)
            q1, q2 = Y(g["line"][0]), Y(g["line"][1])
            if math.dist(q1, q2) < 1e-6:
                continue
            text = f"D{i} {g['text']}"
            lt = LINETYPE.get(d.style, "CONTINUOUS")
            if version == "R12":
                # exploded: extension lines, dimension line, ticks, text
                for (a, b) in g["ext"]:
                    msp.add_line(Y(a), Y(b), dxfattribs={"layer": "DIM"})
                msp.add_line(q1, q2, dxfattribs={"layer": "DIM", "linetype": lt})
                dx, dy = q2[0] - q1[0], q2[1] - q1[1]
                L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
                for q in (q1, q2):
                    msp.add_line((q[0] - nx * 2, q[1] - ny * 2), (q[0] + nx * 2, q[1] + ny * 2), dxfattribs={"layer": "DIM"})
                mid = ((q1[0] + q2[0]) / 2 + nx * 1.5, (q1[1] + q2[1]) / 2 + ny * 1.5)
                ang = math.degrees(math.atan2(dy, dx))
                if ang > 90 or ang < -90:
                    ang += 180
                msp.add_text(text, height=3.5, dxfattribs={"layer": "DIM", "rotation": ang}).set_placement(
                    mid, align=TextEntityAlignment.BOTTOM_CENTER)
            else:
                p1, p2 = Y(d.p1), Y(d.p2)
                attribs = {"layer": "DIM"}
                if lt != "CONTINUOUS":
                    attribs["linetype"] = lt
                override = {"dimtxt": 3.5, "dimasz": 2.5, "dimexe": 1.5, "dimexo": 1.0}
                if d.kind in ("horizontal", "vertical"):
                    angle = 0 if d.kind == "horizontal" else 90
                    dim = msp.add_linear_dim(base=q1, p1=p1, p2=p2, angle=angle, text=text,
                                             dxfattribs=attribs, override=override)
                else:
                    # signed distance of the dimension line from p1-p2 (y flipped => sign flips)
                    dim = msp.add_aligned_dim(p1=p1, p2=p2, distance=-d.offset_mm if d.offset_mm else 8.0,
                                              text=text, dxfattribs=attribs, override=override)
                dim.render()

    for lb in dr.labels:
        msp.add_text(lb.text, height=3.5, dxfattribs={"layer": "TEXT"}).set_placement(
            Y(lb.pos), align=TextEntityAlignment.LEFT)

    tb = dr.titleblock or {}
    head = str(tb.get("project") or dr.meta.get("name", ""))
    for key in ("element", "material", "quantity", "finish", "drawn_by"):
        if tb.get(key):
            head += f"  {tr(lang, key)}: {tb[key]}"
    note = f"pvsketch - {tr(lang, 'units')} - {dr.meta.get('calibration', '')} - {dr.meta.get('source', '')}"
    bbox = dr.outline_bbox()
    tx, ty = (bbox[0], H - bbox[3] - 12) if bbox else (0, -12)
    if head.strip():
        msp.add_text(head, height=3.5, dxfattribs={"layer": "TEXT"}).set_placement((tx, ty))
        ty -= 6
    msp.add_text(note, height=3.0, dxfattribs={"layer": "TEXT"}).set_placement((tx, ty))
    if tb.get("notes"):
        msp.add_text(str(tb["notes"]), height=3.0, dxfattribs={"layer": "TEXT"}).set_placement((tx, ty - 6))
    doc.saveas(path)
