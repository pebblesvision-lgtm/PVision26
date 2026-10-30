"""Several views of one element on one sheet.

A project is one photo = one view. For a moulding or an ornament you also
need the side (profile) or the top. Each extra view is simply another project
of the same element; the main project lists them in ``state["views"]`` and
the exporters draw them next to each other, tops aligned, each with its view
name, under one title block.
"""
from __future__ import annotations

from typing import Any

from .geometry import Arc, Dimension, Drawing, Finish, Label, Polyline, Sketch

GAP_MM = 40.0
VIEW_NAMES = {"en": {"front": "Front view", "side": "Side view", "top": "Top view", "profile": "Profile", "back": "Back view"},
              "nl": {"front": "Vooraanzicht", "side": "Zijaanzicht", "top": "Bovenaanzicht", "profile": "Profiel", "back": "Achteraanzicht"}}


def view_name(key_or_text: str, lang: str) -> str:
    return VIEW_NAMES.get(lang, VIEW_NAMES["en"]).get(key_or_text, key_or_text)


def translate_drawing(dr: Drawing, dx: float, dy: float) -> Drawing:
    T = lambda p: (p[0] + dx, p[1] + dy)  # noqa: E731
    out = Drawing(width_mm=dr.width_mm, height_mm=dr.height_mm, meta=dict(dr.meta), titleblock=dict(dr.titleblock),
                  checklist=[dict(c) for c in dr.checklist])
    for prim in dr.outline:
        if isinstance(prim, Polyline):
            out.outline.append(Polyline(points=[T(p) for p in prim.points], closed=prim.closed))
        else:
            out.outline.append(Arc(center=T(prim.center), radius=prim.radius, start=T(prim.start), end=T(prim.end), ccw=prim.ccw))
    out.detail = [Polyline(points=[T(p) for p in pl.points], closed=pl.closed) for pl in dr.detail]
    out.dimensions = [Dimension(p1=T(d.p1), p2=T(d.p2), auto_mm=d.auto_mm, manual_mm=d.manual_mm, label=d.label, id=d.id,
                                kind=d.kind, offset_mm=d.offset_mm, style=d.style, note=d.note) for d in dr.dimensions]
    out.labels = [Label(pos=T(l.pos), text=l.text, id=l.id) for l in dr.labels]
    out.finishes = [Finish(polygon=[T(p) for p in f.polygon], kind=f.kind, angle_deg=f.angle_deg, spacing_mm=f.spacing_mm,
                           width_mm=f.width_mm, label=f.label, id=f.id) for f in dr.finishes]
    out.sketches = [Sketch(points=[T(p) for p in s.points], style=s.style, arrow=s.arrow, text=s.text, id=s.id) for s in dr.sketches]
    return out


def _extent(dr: Drawing) -> tuple[float, float, float, float]:
    bb = list(dr.outline_bbox() or (0, 0, dr.width_mm, dr.height_mm))
    for d in dr.dimensions:
        from .geometry import dimension_geometry
        for q in dimension_geometry(d)["line"]:
            bb[0] = min(bb[0], q[0]); bb[1] = min(bb[1], q[1]); bb[2] = max(bb[2], q[0]); bb[3] = max(bb[3], q[1])
    for f in dr.finishes:
        for p in f.polygon:
            bb[0] = min(bb[0], p[0]); bb[1] = min(bb[1], p[1]); bb[2] = max(bb[2], p[0]); bb[3] = max(bb[3], p[1])
    return tuple(bb)  # type: ignore[return-value]


def combine(main: Drawing, views: list[tuple[str, Drawing]], lang: str = "en") -> Drawing:
    """Lay ``views`` (name, drawing) to the right of ``main``, tops aligned."""
    if not views:
        return main
    mb = _extent(main)
    out = translate_drawing(main, 0, 0)
    n_dim = len(out.dimensions)
    out.labels.append(Label(pos=(mb[0], mb[1] - 8), text=view_name("front", lang), id="V0"))
    x = mb[2] + GAP_MM
    for i, (name, dr) in enumerate(views, 1):
        vb = _extent(dr)
        shifted = translate_drawing(dr, x - vb[0], mb[1] - vb[1])
        # renumber dimensions so D-numbers stay unique on the sheet
        for d in shifted.dimensions:
            n_dim += 1
            d.id = f"D{n_dim}"
        out.outline.extend(shifted.outline); out.detail.extend(shifted.detail)
        out.dimensions.extend(shifted.dimensions); out.labels.extend(shifted.labels)
        out.finishes.extend(shifted.finishes); out.sketches.extend(shifted.sketches)
        out.labels.append(Label(pos=(x, mb[1] - 8), text=view_name(name, lang), id=f"V{i}"))
        for name_, v in dr.typed_values():
            out.checklist.append({"key": f"v{i}", "nl": f"{view_name(name, lang)}: {name_}", "en": f"{view_name(name, lang)}: {name_}", "kind": "value", "value_mm": v, "dim_id": ""})
        x += (vb[2] - vb[0]) + GAP_MM
    out.width_mm = max(out.width_mm, x)
    out.meta["views"] = [name for name, _ in views]
    return out
