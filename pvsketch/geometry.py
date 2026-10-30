"""Plain geometric primitives, all coordinates in millimetres unless noted."""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import Any

Point = tuple[float, float]


@dataclass
class Polyline:
    points: list[Point]
    closed: bool = False

    def length(self) -> float:
        pts = self.points + ([self.points[0]] if self.closed and self.points else [])
        return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))

    def to_dict(self) -> dict[str, Any]:
        return {"type": "polyline", "points": [list(p) for p in self.points], "closed": self.closed}


@dataclass
class Arc:
    """Circular arc. Angles in degrees, measured counter-clockwise in a y-up frame.

    Because image coordinates are y-down, the sweep direction is stored explicitly
    via ``ccw`` relative to the stored (y-down) frame; exporters flip as needed.
    """
    center: Point
    radius: float
    start: Point
    end: Point
    ccw: bool  # sweep direction in the y-down source frame

    def sweep_deg(self) -> float:
        a0 = math.degrees(math.atan2(self.start[1] - self.center[1], self.start[0] - self.center[0]))
        a1 = math.degrees(math.atan2(self.end[1] - self.center[1], self.end[0] - self.center[0]))
        d = (a1 - a0) % 360.0
        return d if self.ccw else (360.0 - d) % 360.0

    def length(self) -> float:
        return math.radians(self.sweep_deg()) * self.radius

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": "arc",
            "center": list(self.center),
            "radius": self.radius,
            "start": list(self.start),
            "end": list(self.end),
            "ccw": self.ccw,
        }


Primitive = Polyline | Arc


@dataclass
class Dimension:
    """A measured distance between two points.

    ``auto_mm`` is what the calibrated photo says. ``manual_mm`` is the value the
    operator registered with a tape/caliper on site; when present it is the value
    that goes on the drawing, with the photo value kept for reference.
    """
    p1: Point
    p2: Point
    auto_mm: float
    manual_mm: float | None = None
    label: str = ""
    id: str = ""

    @property
    def value_mm(self) -> float:
        return self.manual_mm if self.manual_mm is not None else self.auto_mm

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["value_mm"] = self.value_mm
        return d

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "Dimension":
        return Dimension(
            p1=tuple(d["p1"]), p2=tuple(d["p2"]), auto_mm=float(d["auto_mm"]),
            manual_mm=(None if d.get("manual_mm") in (None, "") else float(d["manual_mm"])),
            label=d.get("label", ""), id=d.get("id", ""),
        )


@dataclass
class Label:
    pos: Point
    text: str
    id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "Label":
        return Label(pos=tuple(d["pos"]), text=d.get("text", ""), id=d.get("id", ""))


@dataclass
class Drawing:
    """Everything needed to render/export one production drawing (mm, y-down)."""
    width_mm: float
    height_mm: float
    outline: list[Primitive] = field(default_factory=list)
    detail: list[Polyline] = field(default_factory=list)
    dimensions: list[Dimension] = field(default_factory=list)
    labels: list[Label] = field(default_factory=list)
    meta: dict[str, Any] = field(default_factory=dict)

    def outline_bbox(self) -> tuple[float, float, float, float] | None:
        xs: list[float] = []
        ys: list[float] = []
        for prim in self.outline:
            for p in primitive_points(prim):
                xs.append(p[0]); ys.append(p[1])
        if not xs:
            return None
        return min(xs), min(ys), max(xs), max(ys)

    def to_dict(self) -> dict[str, Any]:
        return {
            "width_mm": self.width_mm,
            "height_mm": self.height_mm,
            "outline": [p.to_dict() for p in self.outline],
            "detail": [p.to_dict() for p in self.detail],
            "dimensions": [d.to_dict() for d in self.dimensions],
            "labels": [l.to_dict() for l in self.labels],
            "meta": self.meta,
            "bbox": self.outline_bbox(),
        }


def primitive_points(prim: Primitive, arc_step_deg: float = 5.0) -> list[Point]:
    """Sample a primitive into points (used for bbox, PNG preview, length)."""
    if isinstance(prim, Polyline):
        return list(prim.points)
    return sample_arc(prim, arc_step_deg)


def sample_arc(arc: Arc, step_deg: float = 5.0) -> list[Point]:
    cx, cy = arc.center
    a0 = math.atan2(arc.start[1] - cy, arc.start[0] - cx)
    sweep = math.radians(arc.sweep_deg())
    if not arc.ccw:
        sweep = -sweep
    n = max(2, int(abs(math.degrees(sweep)) / step_deg) + 1)
    pts = []
    for i in range(n + 1):
        a = a0 + sweep * i / n
        pts.append((cx + arc.radius * math.cos(a), cy + arc.radius * math.sin(a)))
    pts[0] = arc.start
    pts[-1] = arc.end
    return pts


def primitive_from_dict(d: dict[str, Any]) -> Primitive:
    if d["type"] == "arc":
        return Arc(center=tuple(d["center"]), radius=float(d["radius"]),
                   start=tuple(d["start"]), end=tuple(d["end"]), ccw=bool(d["ccw"]))
    return Polyline(points=[tuple(p) for p in d["points"]], closed=bool(d.get("closed", False)))
