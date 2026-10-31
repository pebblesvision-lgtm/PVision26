"""Outline extraction: mask -> clean outer contour -> lines + arcs in mm.

Also an optional "detail" layer: Canny edges inside the stone (tooling marks,
mouldings, breaks) after bilateral smoothing to suppress grain.
"""
from __future__ import annotations

import math

import cv2
import numpy as np

from .geometry import Arc, Polyline, Primitive


def _pt(p) -> tuple[float, float]:
    return (float(p[0]), float(p[1]))


# ------------------------------------------------------------ outline ----
def outer_contour(mask: np.ndarray) -> np.ndarray | None:
    """Largest external contour of the mask as (N,2) float px, dense."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None
    c = max(contours, key=cv2.contourArea)
    if cv2.contourArea(c) < 25:
        return None
    return c.reshape(-1, 2).astype(np.float64)


def smooth_contour(points: np.ndarray, window: int = 5) -> np.ndarray:
    """Circular moving average to take the pixel staircase off a dense contour."""
    if window <= 1 or len(points) < window * 2:
        return points
    k = np.ones(window) / window
    out = np.empty_like(points)
    for i in range(2):
        col = np.concatenate([points[-window:, i], points[:, i], points[:window, i]])
        out[:, i] = np.convolve(col, k, mode="same")[window:-window]
    return out


def simplify(points: np.ndarray, epsilon: float) -> np.ndarray:
    """Douglas-Peucker on a closed contour (epsilon in the points' units)."""
    c = points.reshape(-1, 1, 2).astype(np.float32)
    s = cv2.approxPolyDP(c, float(epsilon), True)
    return s.reshape(-1, 2).astype(np.float64)


# ---------------------------------------------------------- arc fitting ----
def fit_circle(pts: np.ndarray) -> tuple[float, float, float, float] | None:
    """Algebraic (Kasa) least-squares circle fit -> (cx, cy, r, rms_residual)."""
    if len(pts) < 3:
        return None
    x, y = pts[:, 0], pts[:, 1]
    A = np.c_[x, y, np.ones_like(x)]
    b = x * x + y * y
    try:
        sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    except np.linalg.LinAlgError:
        return None
    cx, cy = sol[0] / 2, sol[1] / 2
    r2 = sol[2] + cx * cx + cy * cy
    if r2 <= 0:
        return None
    r = math.sqrt(r2)
    res = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) - r
    return cx, cy, r, float(np.sqrt(np.mean(res ** 2)))


def _arc_len(pts: np.ndarray) -> float:
    return float(np.sum(np.hypot(np.diff(pts[:, 0]), np.diff(pts[:, 1]))))


def _line_deviation(pts: np.ndarray) -> float:
    """Max distance of pts from the chord between first and last."""
    p0, p1 = pts[0], pts[-1]
    d = p1 - p0
    n = np.hypot(*d)
    if n < 1e-9:
        return 0.0
    v = pts - p0
    return float(np.max(np.abs(d[0] * v[:, 1] - d[1] * v[:, 0])) / n)


def fit_lines_and_arcs(dense: np.ndarray, vertices_idx: np.ndarray, tol: float,
                       min_arc_points: int = 3, max_radius: float | None = None,
                       min_radius: float = 0.0, min_arc_len: float = 0.0) -> list[Primitive]:
    """Replace runs of short segments on a closed contour by circular arcs.

    ``dense`` is the full contour, ``vertices_idx`` the indices (into dense) of
    the simplified polygon's vertices, in contour order. Greedy: from vertex i,
    extend j while all dense points between still fit one circle within ``tol``
    and the run is genuinely curved (not a straight line within tol).
    Straight parts are merged into one Polyline; arcs become Arc primitives.
    """
    n = len(vertices_idx)
    if n < 3:
        return [Polyline(points=[_pt(dense[i]) for i in vertices_idx], closed=True)]

    def run(i_idx: int, j_idx: int) -> np.ndarray:
        a, b = vertices_idx[i_idx % n], vertices_idx[j_idx % n]
        if b > a:
            return dense[a:b + 1]
        return np.concatenate([dense[a:], dense[:b + 1]])

    prims: list[Primitive] = []
    cur_line: list[tuple[float, float]] = []
    i = 0
    consumed = 0
    while consumed < n:
        best = None
        # try to extend as far as possible
        for span in range(min_arc_points, n - consumed + 1):
            pts = run(i, i + span)
            if len(pts) < 5:
                continue
            fit = fit_circle(pts)
            if fit is None:
                break
            cx, cy, r, rms = fit
            if max_radius and r > max_radius:
                break
            if r < min_radius:
                continue
            maxres = float(np.max(np.abs(np.hypot(pts[:, 0] - cx, pts[:, 1] - cy) - r)))
            if maxres > tol:
                break
            if _line_deviation(pts) <= tol * 1.5:   # not curved enough to call an arc
                continue
            if min_arc_len and _arc_len(pts) < min_arc_len:
                continue
            best = (span, cx, cy, r)
        if best:
            span, cx, cy, r = best
            pts = run(i, i + span)
            if cur_line:
                cur_line.append(_pt(pts[0]))
                prims.append(Polyline(points=cur_line, closed=False))
                cur_line = []
            # sweep direction: sign of the signed area of the run around the center
            v0 = pts[0] - (cx, cy)
            v1 = pts[len(pts) // 2] - (cx, cy)
            ccw = bool((v0[0] * v1[1] - v0[1] * v1[0]) > 0)
            prims.append(Arc(center=(float(cx), float(cy)), radius=float(r), start=_pt(pts[0]), end=_pt(pts[-1]), ccw=ccw))
            i += span
            consumed += span
        else:
            cur_line.append(_pt(dense[vertices_idx[i % n]]))
            i += 1
            consumed += 1
    if cur_line:
        cur_line.append(_pt(dense[vertices_idx[i % n]]))
        prims.append(Polyline(points=cur_line, closed=False))
    # Merge a trailing line into a leading line if both exist (closed loop)
    if len(prims) >= 2 and isinstance(prims[0], Polyline) and isinstance(prims[-1], Polyline):
        prims[0] = Polyline(points=prims[-1].points[:-1] + prims[0].points, closed=False)
        prims.pop()
    if len(prims) == 1 and isinstance(prims[0], Polyline):
        p = prims[0]
        pts = p.points[:-1] if p.points[0] == p.points[-1] else p.points
        return [Polyline(points=pts, closed=True)]
    return prims


def _vertex_indices(dense: np.ndarray, simplified: np.ndarray) -> np.ndarray:
    """Map simplified vertices back to indices on the dense contour."""
    idx = []
    for v in simplified:
        d = np.hypot(dense[:, 0] - v[0], dense[:, 1] - v[1])
        idx.append(int(np.argmin(d)))
    idx = np.array(idx)
    # keep contour order, drop duplicates
    order = np.argsort(idx)
    idx = idx[order]
    return np.unique(idx)


def extract_outline(mask: np.ndarray, ppm: float, epsilon_mm: float = 1.0, arc_fit: bool = True,
                    arc_tol_mm: float | None = None, smooth_window: int = 5,
                    min_arc_radius_mm: float = 15.0, min_arc_len_mm: float = 12.0) -> list[Primitive]:
    """Mask (rectified px) -> outline primitives in mm."""
    dense_px = outer_contour(mask)
    if dense_px is None:
        return []
    dense = smooth_contour(dense_px, smooth_window) / ppm  # -> mm
    eps = max(0.05, epsilon_mm)
    simp = simplify(dense, eps)
    if len(simp) < 3:
        return []
    if not arc_fit:
        return [Polyline(points=[_pt(p) for p in simp], closed=True)]
    vidx = _vertex_indices(dense, simp)
    tol = arc_tol_mm if arc_tol_mm is not None else eps * 1.2
    bbox_diag = math.hypot(np.ptp(dense[:, 0]), np.ptp(dense[:, 1]))
    return fit_lines_and_arcs(dense, vidx, tol=tol, max_radius=bbox_diag * 3,
                              min_radius=min_arc_radius_mm, min_arc_len=min_arc_len_mm)


# ------------------------------------------------------------- details ----
def thin(binary: np.ndarray) -> np.ndarray:
    """Zhang-Suen thinning (vectorised numpy), binary uint8 0/255 -> 0/255 skeleton."""
    img = (binary > 0).astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            p = np.pad(img, 1)
            P2 = p[:-2, 1:-1]; P3 = p[:-2, 2:]; P4 = p[1:-1, 2:]; P5 = p[2:, 2:]
            P6 = p[2:, 1:-1]; P7 = p[2:, :-2]; P8 = p[1:-1, :-2]; P9 = p[:-2, :-2]
            seq = [P2, P3, P4, P5, P6, P7, P8, P9, P2]
            B = sum(x.astype(np.int8) for x in seq[:-1])
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.int8) for i in range(8))
            cond = (img == 1) & (B >= 2) & (B <= 6) & (A == 1)
            if step == 0:
                cond &= (P2 * P4 * P6 == 0) & (P4 * P6 * P8 == 0)
            else:
                cond &= (P2 * P4 * P8 == 0) & (P2 * P6 * P8 == 0)
            if cond.any():
                img[cond] = 0
                changed = True
    return (img * 255).astype(np.uint8)


def _unfold_skeleton_contour(c: np.ndarray) -> tuple[np.ndarray, bool]:
    """findContours traces a 1-px open curve out and back, visiting each pixel
    twice and reversing at the two ends. Return the single pass between the two
    reversal points as an open polyline; a ring (no reversals) stays closed."""
    pts = c.reshape(-1, 2)
    n = len(pts)
    if n < 4:
        return pts, False
    prev = np.roll(pts, 1, axis=0)
    nxt = np.roll(pts, -1, axis=0)
    rev = np.where((prev == nxt).all(axis=1))[0]
    if len(rev) < 2:
        return pts, True
    # longest run between consecutive reversal points (cyclic) = one full pass
    best = None
    for i in range(len(rev)):
        r1 = rev[i]
        r2 = rev[(i + 1) % len(rev)]
        seg = pts[r1:r2 + 1] if r2 > r1 else np.concatenate([pts[r1:], pts[:r2 + 1]])
        if best is None or len(seg) > len(best):
            best = seg
    return best, False


def detail_lines(img: np.ndarray, mask: np.ndarray, ppm: float, low: int = 30, high: int = 90,
                 min_len_mm: float = 10.0, smooth: int = 5, epsilon_mm: float = 0.6,
                 inset_mm: float = 3.0) -> list[Polyline]:
    """Canny edges inside the stone, vectorised to polylines (mm).

    Bilateral smoothing first so grain/staining doesn't become spaghetti. The
    mask is eroded by ``inset_mm`` so the outer edge isn't duplicated. Edges are
    thinned to 1 px and traced into open or closed polylines.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    if smooth > 0:
        gray = cv2.bilateralFilter(gray, int(smooth) | 1, 25, 25)
    edges = cv2.Canny(gray, int(low), int(high), L2gradient=True)
    k = max(1, int(round(inset_mm * ppm)))
    inner = cv2.erode(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1)))
    edges = cv2.bitwise_and(edges, inner)
    # bridge 1px gaps so we get longer strokes, then thin back to 1 px
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8))
    edges = thin(edges)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    out: list[Polyline] = []
    seen_boxes: list[tuple[int, int, int, int]] = []
    min_len_px = min_len_mm * ppm
    for c in sorted(contours, key=lambda c: -cv2.arcLength(c, False)):
        pts, closed = _unfold_skeleton_contour(c)
        if cv2.arcLength(pts.reshape(-1, 1, 2).astype(np.int32), closed) < min_len_px:
            continue
        if closed:
            # inner and outer trace of a 1-px ring are near duplicates
            box = cv2.boundingRect(pts.reshape(-1, 1, 2).astype(np.int32))
            if any(all(abs(box[i] - b[i]) <= 3 for i in range(4)) for b in seen_boxes):
                continue
            seen_boxes.append(box)
        s = cv2.approxPolyDP(pts.reshape(-1, 1, 2).astype(np.float32), epsilon_mm * ppm, closed)
        s = s.reshape(-1, 2).astype(np.float64)
        if len(s) < 2:
            continue
        pl = Polyline(points=[_pt(p) for p in (s / ppm)], closed=closed)
        if pl.length() >= min_len_mm:
            out.append(pl)
    return out
