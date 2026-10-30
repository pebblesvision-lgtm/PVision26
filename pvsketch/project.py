"""A project = one photo + its calibration, mask, outline and annotations.

Stored as a folder so work can be reopened later (fully offline):

    workspace/<id>/
        original.<ext>   the uploaded photo
        rectified.jpg    metric-plane image (after calibration)
        mask.png         stone mask (after segmentation)
        project.json     everything else
"""
from __future__ import annotations

import json
import os
import re
import time
import uuid
from datetime import datetime
from typing import Any

import cv2
import numpy as np

from . import calibrate as cal_mod
from . import contour as contour_mod
from . import segment as seg_mod
from .geometry import Dimension, Drawing, Label, Polyline, primitive_from_dict

DEFAULT_WORKSPACE = os.environ.get("PVSKETCH_WORKSPACE", os.path.join(os.getcwd(), "workspace"))

DEFAULT_OUTLINE_PARAMS: dict[str, Any] = {
    "epsilon_mm": 1.0,
    "arc_fit": True,
    "smooth_window": 5,
    "min_arc_radius_mm": 15.0,
    "min_arc_len_mm": 12.0,
    "detail": {"enabled": False, "low": 30, "high": 90, "min_len_mm": 15.0, "smooth": 5, "inset_mm": 3.0},
}


def _safe_name(name: str) -> str:
    base = os.path.basename(name or "photo")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", base)[:80] or "photo"


class Project:
    def __init__(self, pid: str, root: str):
        self.id = pid
        self.dir = os.path.join(root, pid)
        self.state: dict[str, Any] = {
            "id": pid,
            "name": "",
            "created": datetime.now().isoformat(timespec="seconds"),
            "original": None,
            "image_size": None,          # [w, h] of original
            "calibration": None,
            "segmentation": None,        # {rect, fg, bg, brush_px, iters}
            "outline_params": json.loads(json.dumps(DEFAULT_OUTLINE_PARAMS)),
            "outline": None,             # list of primitive dicts (mm)
            "detail": None,              # list of polyline dicts (mm)
            "dimensions": [],
            "labels": [],
        }
        self._cache: dict[str, Any] = {}

    # ---------------------------------------------------------- persistence
    @property
    def json_path(self) -> str:
        return os.path.join(self.dir, "project.json")

    def save(self) -> None:
        os.makedirs(self.dir, exist_ok=True)
        self.state["updated"] = datetime.now().isoformat(timespec="seconds")
        tmp = self.json_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(self.state, f, indent=1)
        os.replace(tmp, self.json_path)

    @classmethod
    def load(cls, pid: str, root: str = DEFAULT_WORKSPACE) -> "Project":
        if not re.fullmatch(r"[A-Za-z0-9_-]{4,64}", pid):
            raise FileNotFoundError(pid)
        p = cls(pid, root)
        with open(p.json_path, encoding="utf-8") as f:
            p.state.update(json.load(f))
        return p

    @classmethod
    def create(cls, image_bytes: bytes, filename: str, root: str = DEFAULT_WORKSPACE) -> "Project":
        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("could not decode image (use JPEG/PNG/TIFF/BMP/WebP)")
        pid = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
        p = cls(pid, root)
        os.makedirs(p.dir, exist_ok=True)
        ext = os.path.splitext(filename)[1].lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"):
            ext = ".jpg"
        orig = "original" + ext
        with open(os.path.join(p.dir, orig), "wb") as f:
            f.write(image_bytes)
        # re-check that the saved bytes decode with EXIF orientation respected
        img2 = cv2.imread(os.path.join(p.dir, orig), cv2.IMREAD_COLOR)
        if img2 is not None:
            img = img2
        p.state["original"] = orig
        p.state["name"] = _safe_name(os.path.splitext(filename)[0])
        p.state["image_size"] = [int(img.shape[1]), int(img.shape[0])]
        p._cache["original"] = img
        p.save()
        return p

    @classmethod
    def from_path(cls, path: str, root: str = DEFAULT_WORKSPACE) -> "Project":
        with open(path, "rb") as f:
            return cls.create(f.read(), os.path.basename(path), root)

    @staticmethod
    def list_all(root: str = DEFAULT_WORKSPACE) -> list[dict[str, Any]]:
        out = []
        if not os.path.isdir(root):
            return out
        for pid in sorted(os.listdir(root), reverse=True):
            jp = os.path.join(root, pid, "project.json")
            if os.path.isfile(jp):
                try:
                    with open(jp, encoding="utf-8") as f:
                        s = json.load(f)
                    out.append({"id": pid, "name": s.get("name", ""), "created": s.get("created"),
                                "updated": s.get("updated"), "calibrated": bool(s.get("calibration")),
                                "segmented": bool(s.get("segmentation")), "outlined": bool(s.get("outline")),
                                "dimensions": len(s.get("dimensions", []))})
                except (OSError, ValueError):
                    continue
        return out

    # ----------------------------------------------------------------- images
    def original(self) -> np.ndarray:
        if "original" not in self._cache:
            img = cv2.imread(os.path.join(self.dir, self.state["original"]), cv2.IMREAD_COLOR)
            if img is None:
                raise FileNotFoundError("original image missing")
            self._cache["original"] = img
        return self._cache["original"]

    def rectified(self) -> np.ndarray:
        if "rectified" not in self._cache:
            path = os.path.join(self.dir, "rectified.jpg")
            img = cv2.imread(path, cv2.IMREAD_COLOR) if os.path.isfile(path) else None
            if img is None:
                if not self.calibration:
                    raise RuntimeError("calibrate first")
                img = cal_mod.rectify(self.original(), self.calibration)
                cv2.imwrite(path, img, [cv2.IMWRITE_JPEG_QUALITY, 92])
            self._cache["rectified"] = img
        return self._cache["rectified"]

    def mask(self) -> np.ndarray | None:
        if "mask" not in self._cache:
            path = os.path.join(self.dir, "mask.png")
            self._cache["mask"] = cv2.imread(path, cv2.IMREAD_GRAYSCALE) if os.path.isfile(path) else None
        return self._cache["mask"]

    # ------------------------------------------------------------ calibration
    @property
    def calibration(self) -> cal_mod.Calibration | None:
        c = self.state.get("calibration")
        return cal_mod.Calibration.from_dict(c) if c else None

    def _invalidate_from(self, stage: str) -> None:
        """Downstream results depend on upstream ones; drop them."""
        order = ["calibration", "segmentation", "outline"]
        for s in order[order.index(stage):]:
            if s == "calibration":
                self.state["calibration"] = None
                for k in ("rectified.jpg",):
                    fp = os.path.join(self.dir, k)
                    if os.path.isfile(fp):
                        os.remove(fp)
                self._cache.pop("rectified", None)
            if s == "segmentation":
                self.state["segmentation"] = None
                fp = os.path.join(self.dir, "mask.png")
                if os.path.isfile(fp):
                    os.remove(fp)
                self._cache.pop("mask", None)
            if s == "outline":
                self.state["outline"] = None
                self.state["detail"] = None

    def set_calibration(self, cal: cal_mod.Calibration) -> None:
        self._invalidate_from("calibration")
        self.state["calibration"] = cal.to_dict()
        self.state["dimensions"] = []
        self.state["labels"] = []
        self.rectified()  # compute + cache now
        self.save()

    def calibrate_quad(self, quad_px, width_mm: float, height_mm: float, ppm: float | None = None) -> cal_mod.Calibration:
        img = self.original()
        cal = cal_mod.calibrate_quad(img.shape, quad_px, width_mm, height_mm, ppm=ppm)
        self.set_calibration(cal)
        return cal

    def calibrate_sheet(self, quad_px, sheet: str = "a4", ppm: float | None = None) -> cal_mod.Calibration:
        w, h = cal_mod.REFERENCE_SHEETS[sheet.lower()]
        cal = self.calibrate_quad(quad_px, w, h, ppm)
        cal.note = f"quad: {sheet.upper()} sheet {w:g} x {h:g} mm"
        self.state["calibration"] = cal.to_dict(); self.save()
        return cal

    def calibrate_aruco(self, marker_size_mm: float, marker_id: int | None = None, ppm: float | None = None) -> cal_mod.Calibration:
        cal = cal_mod.calibrate_aruco(self.original(), marker_size_mm, marker_id, ppm=ppm)
        self.set_calibration(cal)
        return cal

    def calibrate_two_point(self, p1, p2, dist_mm: float) -> cal_mod.Calibration:
        cal = cal_mod.calibrate_two_point(self.original().shape, p1, p2, dist_mm)
        self.set_calibration(cal)
        return cal

    # ----------------------------------------------------------- segmentation
    def segment(self, rect=None, fg=(), bg=(), brush_px: int = 8, iters: int = 5, strokes=None,
                polygon=None, band_px: float = 20.0, mode: str = "grabcut") -> np.ndarray:
        """Run GrabCut (box and/or polygon guided, with strokes) or take the
        polygon as the exact mask (``mode="polygon"``)."""
        img = self.rectified()
        st = seg_mod.normalise_strokes(fg, bg, strokes, brush_px)
        poly = [list(map(float, p)) for p in (polygon or [])]
        if mode == "polygon":
            if len(poly) < 3:
                raise ValueError("click at least 3 points along the outer line first")
            m = seg_mod.exact_polygon(img.shape, poly, st)
        else:
            m = seg_mod.grabcut(img, rect, st, polygon=poly if len(poly) >= 3 else None,
                                band_px=band_px, iters=iters)
        self._invalidate_from("segmentation")
        self.state["segmentation"] = {"rect": ([float(v) for v in rect] if rect else None),
                                      "polygon": poly, "strokes": st, "brush_px": brush_px,
                                      "iters": iters, "band_px": band_px, "mode": mode}
        cv2.imwrite(os.path.join(self.dir, "mask.png"), m)
        self._cache["mask"] = m
        self.save()
        return m

    def set_mask(self, m: np.ndarray) -> None:
        """Accept an externally produced mask (e.g. a hand-painted one)."""
        self._invalidate_from("segmentation")
        self.state["segmentation"] = {"rect": None, "polygon": [], "strokes": [], "external": True}
        cv2.imwrite(os.path.join(self.dir, "mask.png"), m)
        self._cache["mask"] = m
        self.save()

    # ---------------------------------------------------------------- outline
    def outline(self, params: dict[str, Any] | None = None) -> dict[str, Any]:
        m = self.mask()
        cal = self.calibration
        if m is None or cal is None:
            raise RuntimeError("segment first")
        p = json.loads(json.dumps(self.state["outline_params"]))
        if params:
            for k, v in params.items():
                if k == "detail" and isinstance(v, dict):
                    p["detail"].update(v)
                else:
                    p[k] = v
        prims = contour_mod.extract_outline(m, cal.ppm, epsilon_mm=float(p["epsilon_mm"]),
                                            arc_fit=bool(p["arc_fit"]), smooth_window=int(p.get("smooth_window", 5)),
                                            min_arc_radius_mm=float(p.get("min_arc_radius_mm", 15.0)),
                                            min_arc_len_mm=float(p.get("min_arc_len_mm", 12.0)))
        detail: list[Polyline] = []
        d = p["detail"]
        if d.get("enabled"):
            detail = contour_mod.detail_lines(self.rectified(), m, cal.ppm, low=int(d["low"]), high=int(d["high"]),
                                              min_len_mm=float(d["min_len_mm"]), smooth=int(d["smooth"]),
                                              inset_mm=float(d.get("inset_mm", 3.0)))
        self.state["outline_params"] = p
        self.state["outline"] = [x.to_dict() for x in prims]
        self.state["outline_edited"] = False
        self.state["detail"] = [x.to_dict() for x in detail]
        self.save()
        return self.drawing().to_dict()

    def set_outline(self, primitives: list[dict[str, Any]]) -> dict[str, Any]:
        """Store a hand-edited outline (vertices moved/added/removed in the UI)."""
        prims = [primitive_from_dict(d) for d in primitives]
        self.state["outline"] = [x.to_dict() for x in prims]
        self.state["outline_edited"] = True
        self.save()
        return self.drawing().to_dict()

    # ------------------------------------------------------------ annotations
    def set_annotations(self, dimensions: list[dict[str, Any]], labels: list[dict[str, Any]]) -> None:
        cal = self.calibration
        dims = []
        for i, d in enumerate(dimensions):
            dim = Dimension.from_dict(d)
            if cal is not None:
                dim.auto_mm = float(dim.measured_auto())
            dim.id = f"D{i+1}"
            dims.append(dim.to_dict())
        labs = []
        for i, l in enumerate(labels):
            lab = Label.from_dict(l)
            lab.id = lab.id or f"L{i+1}"
            labs.append(lab.to_dict())
        self.state["dimensions"] = dims
        self.state["labels"] = labs
        self.save()

    # ---------------------------------------------------------------- drawing
    def drawing(self) -> Drawing:
        cal = self.calibration
        if cal is None:
            raise RuntimeError("calibrate first")
        dr = Drawing(width_mm=cal.width_mm, height_mm=cal.height_mm)
        dr.outline = [primitive_from_dict(d) for d in (self.state.get("outline") or [])]
        dr.detail = [primitive_from_dict(d) for d in (self.state.get("detail") or [])]  # type: ignore[misc]
        dr.dimensions = [Dimension.from_dict(d) for d in self.state.get("dimensions", [])]
        dr.labels = [Label.from_dict(l) for l in self.state.get("labels", [])]
        dr.meta = {"name": self.state.get("name", ""), "source": self.state.get("original", ""),
                   "calibration": cal.note, "ppm": cal.ppm, "project": self.id}
        return dr
