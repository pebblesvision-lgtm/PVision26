"""Tabular exports of the registered measurements (CSV; spreadsheet-friendly)."""
from __future__ import annotations

import csv
import io

from .geometry import Drawing


def dimensions_csv(dr: Drawing) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["id", "label", "kind", "value_mm", "x1_mm", "y1_mm", "x2_mm", "y2_mm", "note"])
    for i, d in enumerate(dr.dimensions, 1):
        w.writerow([f"D{i}", d.label, d.kind, "" if d.manual_mm is None else f"{d.manual_mm:g}",
                    f"{d.p1[0]:.1f}", f"{d.p1[1]:.1f}", f"{d.p2[0]:.1f}", f"{d.p2[1]:.1f}", d.note])
    for name, v in dr.typed_values():
        w.writerow(["", name, "value", f"{v:g}", "", "", "", "", "typed, not on drawing"])
    if dr.finishes:
        w.writerow([])
        for i, f in enumerate(dr.finishes, 1):
            w.writerow([f"F{i}", f.legend(dr.lang)])
    bb = dr.outline_bbox()
    if bb:
        w.writerow([]); w.writerow(["outline_bbox_mm", f"{bb[2]-bb[0]:.1f}", f"{bb[3]-bb[1]:.1f}"])
    w.writerow(["project", dr.meta.get("name", ""), dr.meta.get("calibration", ""), "" if dr.meta.get("scaled") else "NOT TO SCALE"])
    return buf.getvalue()
