"""Scale + perspective calibration.

A photo only yields real measurements for things lying in a plane whose
geometry we know. We therefore ask for a reference of known size in that plane
(an A4 sheet laid on the stone face, a custom rectangle, or a printed ArUco
marker) and compute the homography that maps the photo onto that plane, with a
fixed number of pixels per millimetre. Everything downstream works on the
rectified image, where 1 px = 1/ppm mm.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import Any

import cv2
import numpy as np

REFERENCE_SHEETS: dict[str, tuple[float, float]] = {
    "a5": (148.0, 210.0),
    "a4": (210.0, 297.0),
    "a3": (297.0, 420.0),
    "letter": (215.9, 279.4),
}

# Upper bound on the rectified canvas so a steep perspective can't explode memory.
MAX_RECTIFIED_SIDE = 6000


@dataclass
class Calibration:
    mode: str                              # "quad" | "aruco" | "two_point"
    ppm: float                             # pixels per millimetre in the rectified image
    H: list[list[float]]                   # 3x3 homography: original px -> rectified px
    out_size: tuple[int, int]              # rectified (width, height) in px
    ref_points_px: list[list[float]] = field(default_factory=list)  # in the original image
    ref_size_mm: tuple[float, float] | None = None
    note: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "Calibration":
        return Calibration(
            mode=d["mode"], ppm=float(d["ppm"]), H=d["H"], out_size=tuple(d["out_size"]),
            ref_points_px=d.get("ref_points_px", []),
            ref_size_mm=(tuple(d["ref_size_mm"]) if d.get("ref_size_mm") else None),
            note=d.get("note", ""),
        )

    @property
    def width_mm(self) -> float:
        return self.out_size[0] / self.ppm

    @property
    def height_mm(self) -> float:
        return self.out_size[1] / self.ppm

    def matrix(self) -> np.ndarray:
        return np.asarray(self.H, dtype=np.float64)


def order_quad(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    pts = np.asarray(pts, dtype=np.float64).reshape(4, 2)
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()  # y - x
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(d)]
    bl = pts[np.argmax(d)]
    return np.array([tl, tr, br, bl])


def _auto_ppm(quad_px: np.ndarray, width_mm: float, height_mm: float) -> float:
    """Keep roughly the photo's own resolution on the reference object."""
    per_px = sum(math.dist(quad_px[i], quad_px[(i + 1) % 4]) for i in range(4))
    per_mm = 2.0 * (width_mm + height_mm)
    return max(0.5, per_px / per_mm)


def _fit_canvas(H_ref: np.ndarray, img_w: int, img_h: int, ref_rect_px: np.ndarray,
                max_side: int = MAX_RECTIFIED_SIDE) -> tuple[np.ndarray, tuple[int, int]]:
    """Translate/clamp so the whole warped photo fits a bounded canvas.

    Image corners far from the reference plane can map to huge or negative
    coordinates (or beyond the horizon). We clamp the canvas to a window around
    the reference, at most ``max_side`` px, and return the adjusted homography.
    """
    corners = np.array([[0, 0], [img_w, 0], [img_w, img_h], [0, img_h]], dtype=np.float64)
    hom = cv2.perspectiveTransform(corners.reshape(-1, 1, 2), H_ref).reshape(-1, 2)

    # Points that cross the horizon come back with a flipped sign of w; detect via
    # the homogeneous coordinate and drop them from the extent estimate.
    homog = (H_ref @ np.c_[corners, np.ones(4)].T).T
    valid = homog[:, 2] > 1e-9
    pts = hom[valid] if valid.any() else ref_rect_px

    ref_cx, ref_cy = ref_rect_px.mean(axis=0)
    ref_w = ref_rect_px[:, 0].max() - ref_rect_px[:, 0].min()
    ref_h = ref_rect_px[:, 1].max() - ref_rect_px[:, 1].min()
    # Never extend more than 12x the reference size away from it: beyond that
    # the measurement is meaningless anyway.
    lim = 12.0 * max(ref_w, ref_h)
    x0 = max(pts[:, 0].min(), ref_cx - lim)
    y0 = max(pts[:, 1].min(), ref_cy - lim)
    x1 = min(pts[:, 0].max(), ref_cx + lim)
    y1 = min(pts[:, 1].max(), ref_cy + lim)
    x0 = min(x0, ref_rect_px[:, 0].min()); y0 = min(y0, ref_rect_px[:, 1].min())
    x1 = max(x1, ref_rect_px[:, 0].max()); y1 = max(y1, ref_rect_px[:, 1].max())

    w = x1 - x0
    h = y1 - y0
    scale = 1.0
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
    T = np.array([[scale, 0, -x0 * scale], [0, scale, -y0 * scale], [0, 0, 1]], dtype=np.float64)
    H = T @ H_ref
    out = (int(math.ceil(w * scale)), int(math.ceil(h * scale)))
    return H, out, scale


def calibrate_quad(img_shape: tuple[int, int], quad_px: list[list[float]] | np.ndarray,
                   width_mm: float, height_mm: float, ppm: float | None = None,
                   mode: str = "quad") -> Calibration:
    """Homography from 4 clicked corners of a rectangle of known size (mm).

    ``img_shape`` is (height, width) of the original image.
    The quad may be given in any order; it is re-ordered TL, TR, BR, BL. The
    reference's long side is matched to the longer of (width_mm, height_mm)
    so landscape/portrait placement doesn't matter.
    """
    img_h, img_w = img_shape[:2]
    q = order_quad(quad_px)
    # match orientation: top edge length vs left edge length
    top = math.dist(q[0], q[1]); left = math.dist(q[0], q[3])
    w_mm, h_mm = (width_mm, height_mm)
    if (top >= left) != (w_mm >= h_mm):
        w_mm, h_mm = h_mm, w_mm
    if ppm is None:
        ppm = _auto_ppm(q, w_mm, h_mm)
    dst = np.array([[0, 0], [w_mm * ppm, 0], [w_mm * ppm, h_mm * ppm], [0, h_mm * ppm]], dtype=np.float64)
    H_ref = cv2.getPerspectiveTransform(q.astype(np.float32), dst.astype(np.float32)).astype(np.float64)
    H, out, scale = _fit_canvas(H_ref, img_w, img_h, dst)
    return Calibration(mode=mode, ppm=ppm * scale, H=H.tolist(), out_size=out,
                       ref_points_px=q.tolist(), ref_size_mm=(w_mm, h_mm),
                       note=f"{mode}: reference {w_mm:g} x {h_mm:g} mm")


def calibrate_two_point(img_shape: tuple[int, int], p1: list[float], p2: list[float],
                        dist_mm: float) -> Calibration:
    """Scale-only fallback: two points of known separation, no perspective fix.

    Only valid when the camera was square to the stone face. Flagged in ``note``.
    """
    img_h, img_w = img_shape[:2]
    d_px = math.dist(p1, p2)
    if d_px < 2 or dist_mm <= 0:
        raise ValueError("two-point calibration needs two distinct points and a positive distance")
    ppm = d_px / dist_mm
    H = np.eye(3)
    out = (img_w, img_h)
    scale = 1.0
    if max(out) > MAX_RECTIFIED_SIDE:
        scale = MAX_RECTIFIED_SIDE / max(out)
        H = np.diag([scale, scale, 1.0])
        out = (int(img_w * scale), int(img_h * scale))
    return Calibration(mode="two_point", ppm=ppm * scale, H=H.tolist(), out_size=out,
                       ref_points_px=[list(map(float, p1)), list(map(float, p2))],
                       ref_size_mm=(dist_mm, 0.0),
                       note="two_point: scale only, no perspective correction "
                            "- camera must be square to the face")


# ---------------------------------------------------------------- ArUco ----
ARUCO_DICT_NAME = "DICT_4X4_50"


def _aruco_dict(name: str = ARUCO_DICT_NAME):
    return cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, name))


def detect_aruco(img: np.ndarray, dict_name: str = ARUCO_DICT_NAME) -> list[dict[str, Any]]:
    """Return detected markers as [{id, corners[[x,y]x4]}] sorted by size, largest first."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    detector = cv2.aruco.ArucoDetector(_aruco_dict(dict_name), cv2.aruco.DetectorParameters())
    corners, ids, _ = detector.detectMarkers(gray)
    found = []
    if ids is not None:
        for c, i in zip(corners, ids.ravel()):
            pts = c.reshape(4, 2)
            found.append({"id": int(i), "corners": pts.tolist(), "area": float(cv2.contourArea(pts))})
    found.sort(key=lambda m: -m["area"])
    return found


def calibrate_aruco(img: np.ndarray, marker_size_mm: float, marker_id: int | None = None,
                    dict_name: str = ARUCO_DICT_NAME, ppm: float | None = None) -> Calibration:
    markers = detect_aruco(img, dict_name)
    if not markers:
        raise ValueError("no ArUco marker found - print one with `pvsketch marker` and lay it flat on the stone face")
    if marker_id is not None:
        markers = [m for m in markers if m["id"] == marker_id]
        if not markers:
            raise ValueError(f"marker id {marker_id} not found")
    m = markers[0]
    cal = calibrate_quad(img.shape, m["corners"], marker_size_mm, marker_size_mm, ppm=ppm, mode="aruco")
    cal.note = f"aruco: marker id {m['id']} ({marker_size_mm:g} mm)"
    return cal


def marker_image(marker_id: int, size_mm: float, dpi: int = 300, dict_name: str = ARUCO_DICT_NAME,
                 border_mm: float = 10.0) -> tuple[np.ndarray, int]:
    """Printable marker on a white sheet with a size caption. Returns (image, dpi)."""
    px = int(round(size_mm / 25.4 * dpi))
    border = int(round(border_mm / 25.4 * dpi))
    marker = cv2.aruco.generateImageMarker(_aruco_dict(dict_name), marker_id, px)
    canvas = np.full((px + 2 * border + int(0.3 * border), px + 2 * border), 255, np.uint8)
    canvas[border:border + px, border:border + px] = marker
    text = f"pvsketch marker id {marker_id} - {size_mm:g} mm - print at 100%"
    cv2.putText(canvas, text, (border, px + 2 * border + int(0.1 * border)), cv2.FONT_HERSHEY_SIMPLEX,
                max(0.4, dpi / 400), 0, max(1, dpi // 150), cv2.LINE_AA)
    return canvas, dpi


# ----------------------------------------------------------------- apply ----
def rectify(img: np.ndarray, cal: Calibration) -> np.ndarray:
    """Warp the original photo into the metric plane."""
    H = cal.matrix()
    return cv2.warpPerspective(img, H, cal.out_size, flags=cv2.INTER_LINEAR,
                               borderMode=cv2.BORDER_CONSTANT, borderValue=(128, 128, 128))


def px_to_mm(points_px, cal: Calibration) -> np.ndarray:
    return np.asarray(points_px, dtype=np.float64) / cal.ppm


def mm_to_px(points_mm, cal: Calibration) -> np.ndarray:
    return np.asarray(points_mm, dtype=np.float64) * cal.ppm


def original_to_rectified(points_px, cal: Calibration) -> np.ndarray:
    pts = np.asarray(points_px, dtype=np.float64).reshape(-1, 1, 2)
    return cv2.perspectiveTransform(pts, cal.matrix()).reshape(-1, 2)
