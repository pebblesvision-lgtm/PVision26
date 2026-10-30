"""Tabular exports of the registered measurements (CSV; spreadsheet-friendly)."""
from __future__ import annotations

import csv
import io

from .geometry import Drawing


def dimensions_csv(dr: Drawing) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["id", "label", "kind", "value_mm", "photo_mm", "registered_mm", "x1_mm", "y1_mm", "x2_mm", "y2_mm", "note"])
    for i, d in enumerate(dr.dimensions, 1):
        w.writerow([f"D{i}", d.label, d.kind, f"{d.value_mm:.1f}", f"{d.auto_mm:.1f}",
                    "" if d.manual_mm is None else f"{d.manual_mm:.1f}",
                    f"{d.p1[0]:.1f}", f"{d.p1[1]:.1f}", f"{d.p2[0]:.1f}", f"{d.p2[1]:.1f}", d.note])
    bb = dr.outline_bbox()
    if bb:
        w.writerow([]); w.writerow(["outline_bbox_mm", f"{bb[2]-bb[0]:.1f}", f"{bb[3]-bb[1]:.1f}"])
    w.writerow(["project", dr.meta.get("name", ""), dr.meta.get("calibration", "")])
    return buf.getvalue()
