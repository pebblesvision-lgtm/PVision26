"""Isolate the stone from its background with GrabCut (fully offline, no model).

Three ways to tell GrabCut where the stone is, which can be combined:

* a **box** dragged around the stone (everything outside is background)
* a **polygon** of points clicked along the outer line: inside (shrunk by a
  band) is definite stone, outside (grown by the band) is definite background
  and GrabCut only has to decide the exact edge within the band. On grey stone
  against a grey wall this is what makes it work.
* **brush strokes**: stone / background / erase, applied in order so an eraser
  stroke undoes earlier paint under it.

Or skip GrabCut altogether and use the polygon as the mask.
"""
from __future__ import annotations

from typing import Any, Sequence

import cv2
import numpy as np

Stroke = dict[str, Any]  # {"kind": "fg"|"bg"|"erase", "pts": [[x, y], ...], "r": px}

WORK_MAX_SIDE = 1400  # GrabCut is O(pixels * iters); downscale big photos for it

LBL_NONE, LBL_FG, LBL_BG = 0, 1, 2


def normalise_strokes(fg: Sequence = (), bg: Sequence = (), strokes: Sequence[Stroke] | None = None,
                      brush_px: int = 8) -> list[Stroke]:
    """Accept both the old (fg/bg lists) and the new ordered-stroke format."""
    out: list[Stroke] = []
    for s in fg:
        out.append({"kind": "fg", "pts": [list(map(float, p)) for p in s], "r": brush_px})
    for s in bg:
        out.append({"kind": "bg", "pts": [list(map(float, p)) for p in s], "r": brush_px})
    for s in strokes or []:
        if s.get("kind") not in ("fg", "bg", "erase") or not s.get("pts"):
            continue
        out.append({"kind": s["kind"], "pts": [list(map(float, p)) for p in s["pts"]],
                    "r": int(s.get("r", brush_px))})
    return out


def _paint(layer: np.ndarray, pts: np.ndarray, value: int, radius: int) -> None:
    pts = pts.astype(np.int32).reshape(-1, 2)
    if len(pts) == 1:
        cv2.circle(layer, tuple(pts[0]), max(1, radius), int(value), -1)
    else:
        cv2.polylines(layer, [pts], False, int(value), thickness=max(1, 2 * radius))


def stroke_layer(shape: tuple[int, int], strokes: Sequence[Stroke], scale: float = 1.0) -> np.ndarray:
    """Rasterise ordered strokes into a label layer (0 none, 1 stone, 2 background)."""
    layer = np.zeros(shape, np.uint8)
    for s in strokes:
        val = {"fg": LBL_FG, "bg": LBL_BG, "erase": LBL_NONE}[s["kind"]]
        _paint(layer, np.asarray(s["pts"], dtype=np.float64) * scale, val, max(1, int(round(s["r"] * scale))))
    return layer


def polygon_mask(shape: tuple[int, int], polygon: Sequence[Sequence[float]], scale: float = 1.0) -> np.ndarray:
    m = np.zeros(shape, np.uint8)
    pts = (np.asarray(polygon, dtype=np.float64) * scale).astype(np.int32).reshape(-1, 1, 2)
    if len(pts) >= 3:
        cv2.fillPoly(m, [pts], 255)
    return m


def grabcut(img: np.ndarray, rect: Sequence[float] | None = None, strokes: Sequence[Stroke] = (),
            polygon: Sequence[Sequence[float]] | None = None, band_px: float = 20.0,
            iters: int = 5, keep_largest: bool = True, fill_holes: bool = True,
            region: np.ndarray | None = None, seed: bool = False) -> np.ndarray:
    """Return a binary mask (uint8, 255 = stone) in rectified-image pixels.

    ``rect`` is (x, y, w, h); ``polygon`` a list of points; both in the same
    pixel space as ``strokes``. At least one of rect/polygon is required.
    """
    h, w = img.shape[:2]
    scale = 1.0
    work = img
    if max(h, w) > WORK_MAX_SIDE:
        scale = WORK_MAX_SIDE / max(h, w)
        work = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    wh, ww = work.shape[:2]

    mask = np.full((wh, ww), cv2.GC_BGD, np.uint8)
    gc_rect = None

    region_mask = None
    if polygon is not None and len(polygon) >= 3:
        region_mask = polygon_mask((wh, ww), polygon, scale)
    elif region is not None:
        region_mask = np.where(cv2.resize(region, (ww, wh), interpolation=cv2.INTER_NEAREST) > 0, 255, 0).astype(np.uint8)
    if seed and region_mask is not None and region_mask.any():
        # Only painted stone: the paint is certain, the rest of the photo is "probably background";
        # GrabCut grows the stone outwards from the paint.
        # Paint may overshoot the edge, so only its core is certain.
        dist_in = cv2.distanceTransform(region_mask, cv2.DIST_L2, 5)
        mask[:] = cv2.GC_PR_BGD
        mask[region_mask > 0] = cv2.GC_PR_FGD
        mask[dist_in >= 0.6 * float(dist_in.max())] = cv2.GC_FGD
        gc_rect = (0, 0, ww, wh)
    elif region_mask is not None and region_mask.any():
        # The points / paint are a rough guess: inside is only "probably stone" (a loose polygon
        # contains sky or wall too); only the deep core is certain, the band outside is "probably background".
        band = max(2, int(round(band_px * scale)))
        dist_in = cv2.distanceTransform(region_mask, cv2.DIST_L2, 5)
        dist_out = cv2.distanceTransform(255 - region_mask, cv2.DIST_L2, 5)
        outer = (region_mask > 0) | (dist_out <= band)
        mask[outer] = cv2.GC_PR_BGD
        mask[region_mask > 0] = cv2.GC_PR_FGD
        mask[dist_in > max(band, 0.6 * float(dist_in.max()))] = cv2.GC_FGD
        x, y, rw, rh = cv2.boundingRect(outer.astype(np.uint8))
        gc_rect = (x, y, rw, rh)
    elif rect is not None:
        x, y, rw, rh = [float(v) for v in rect]
        x0 = int(max(0, min(ww - 2, round(x * scale))))
        y0 = int(max(0, min(wh - 2, round(y * scale))))
        x1 = int(max(x0 + 2, min(ww - 1, round((x + rw) * scale))))
        y1 = int(max(y0 + 2, min(wh - 1, round((y + rh) * scale))))
        gc_rect = (x0, y0, x1 - x0, y1 - y0)
        mask[y0:y1, x0:x1] = cv2.GC_PR_FGD
    else:
        raise ValueError("need a box, points or painted stone")

    layer = stroke_layer((wh, ww), strokes, scale) if strokes else None
    if layer is not None:
        if not seed:                          # (seed: the paint was handled above, it may overshoot)
            mask[layer == LBL_FG] = cv2.GC_FGD
        mask[layer == LBL_BG] = cv2.GC_BGD

    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    has_fg = np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).any()
    has_bg = np.isin(mask, (cv2.GC_BGD, cv2.GC_PR_BGD)).any()
    if not has_fg or not has_bg:
        raise ValueError("the box/polygon must leave some background around the stone")

    if region_mask is None and layer is None:
        cv2.grabCut(work, mask, gc_rect, bgd, fgd, int(iters), cv2.GC_INIT_WITH_RECT)
    else:
        cv2.grabCut(work, mask, gc_rect, bgd, fgd, int(iters), cv2.GC_INIT_WITH_MASK)

    out = np.where(np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)), 255, 0).astype(np.uint8)
    out = cv2.morphologyEx(out, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    # hard constraints win over GrabCut's opinion
    if layer is not None:
        if not seed:
            out[layer == LBL_FG] = 255
        out[layer == LBL_BG] = 0

    if keep_largest:
        out = largest_component(out)
    if fill_holes:
        out = fill_mask_holes(out)
    if scale != 1.0:
        out = cv2.resize(out, (w, h), interpolation=cv2.INTER_LINEAR)
        out = np.where(out > 127, 255, 0).astype(np.uint8)
    return out


def apply_edits(base: np.ndarray, edits: Sequence[Stroke]) -> np.ndarray:
    """Brush edits after a run: stone adds to the mask, background (gum) removes."""
    m = base.copy()
    if edits:
        layer = stroke_layer(m.shape[:2], edits)
        m[layer == LBL_FG] = 255
        m[layer == LBL_BG] = 0
    return m


def exact_polygon(img_shape: tuple[int, int], polygon: Sequence[Sequence[float]],
                  strokes: Sequence[Stroke] = ()) -> np.ndarray:
    """No GrabCut: the clicked polygon is the mask, strokes still add/remove."""
    h, w = img_shape[:2]
    m = polygon_mask((h, w), polygon)
    if strokes:
        layer = stroke_layer((h, w), strokes)
        m[layer == LBL_FG] = 255
        m[layer == LBL_BG] = 0
    return fill_mask_holes(largest_component(m)) if m.any() else m


def largest_component(mask: np.ndarray) -> np.ndarray:
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n <= 2:
        return mask
    idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return np.where(labels == idx, 255, 0).astype(np.uint8)


def fill_mask_holes(mask: np.ndarray) -> np.ndarray:
    """Fill enclosed holes (staining/dark pockets that GrabCut dropped). Background is
    flooded from the whole border (via a 1-px frame), so a stone touching two image
    edges doesn't turn the far side into a 'hole'."""
    h, w = mask.shape
    ff = np.zeros((h + 2, w + 2), np.uint8)
    ff[1:-1, 1:-1] = mask
    border = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(ff, border, (0, 0), 255)
    holes = cv2.bitwise_not(ff[1:-1, 1:-1])
    return cv2.bitwise_or(mask, holes)


def overlay(img: np.ndarray, mask: np.ndarray, color=(0, 200, 255), alpha: float = 0.45) -> np.ndarray:
    """Tint the masked area and draw its boundary, for the UI preview."""
    out = img.copy()
    tint = np.zeros_like(img)
    tint[:] = color
    m = mask > 0
    out[m] = cv2.addWeighted(img, 1 - alpha, tint, alpha, 0)[m]
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(out, contours, -1, (0, 0, 255), 2)
    return out
