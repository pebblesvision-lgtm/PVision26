"""Isolate the stone from its background with GrabCut (fully offline, no model).

Workflow: the operator drags a rectangle around the stone on the rectified
image; GrabCut does the rest. On weathered stone against a similar-coloured
wall, a few foreground/background brush strokes fix the mistakes.
"""
from __future__ import annotations

from typing import Sequence

import cv2
import numpy as np

Stroke = Sequence[Sequence[float]]  # [[x, y], ...] in rectified px

WORK_MAX_SIDE = 1400  # GrabCut is O(pixels * iters); downscale big photos for it


def _paint_strokes(mask: np.ndarray, strokes: Sequence[Stroke], value: int, radius: int) -> None:
    for s in strokes:
        pts = np.asarray(s, dtype=np.int32).reshape(-1, 2)
        if len(pts) == 1:
            cv2.circle(mask, tuple(pts[0]), radius, int(value), -1)
        else:
            cv2.polylines(mask, [pts], False, int(value), thickness=max(1, 2 * radius))


def grabcut(img: np.ndarray, rect: Sequence[float], fg: Sequence[Stroke] = (), bg: Sequence[Stroke] = (),
            brush_px: int = 8, iters: int = 5, keep_largest: bool = True, fill_holes: bool = True) -> np.ndarray:
    """Return a binary mask (uint8, 255 = stone) in rectified-image pixels.

    ``rect`` is (x, y, w, h). Strokes are polylines in the same pixel space.
    """
    h, w = img.shape[:2]
    scale = 1.0
    work = img
    if max(h, w) > WORK_MAX_SIDE:
        scale = WORK_MAX_SIDE / max(h, w)
        work = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    wh, ww = work.shape[:2]

    x, y, rw, rh = [float(v) for v in rect]
    x0 = int(max(0, min(ww - 2, round(x * scale))))
    y0 = int(max(0, min(wh - 2, round(y * scale))))
    x1 = int(max(x0 + 2, min(ww - 1, round((x + rw) * scale))))
    y1 = int(max(y0 + 2, min(wh - 1, round((y + rh) * scale))))
    gc_rect = (x0, y0, x1 - x0, y1 - y0)

    mask = np.full((wh, ww), cv2.GC_BGD, np.uint8)
    mask[y0:y1, x0:x1] = cv2.GC_PR_FGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)

    if fg or bg:
        r = max(1, int(round(brush_px * scale)))
        _paint_strokes(mask, [np.asarray(s) * scale for s in bg], cv2.GC_BGD, r)
        _paint_strokes(mask, [np.asarray(s) * scale for s in fg], cv2.GC_FGD, r)
        # GrabCut needs at least one probable/definite fg and bg pixel
        if not np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)).any():
            mask[y0:y1, x0:x1] = cv2.GC_PR_FGD
        cv2.grabCut(work, mask, gc_rect, bgd, fgd, int(iters), cv2.GC_INIT_WITH_MASK)
    else:
        cv2.grabCut(work, mask, gc_rect, bgd, fgd, int(iters), cv2.GC_INIT_WITH_RECT)

    out = np.where(np.isin(mask, (cv2.GC_FGD, cv2.GC_PR_FGD)), 255, 0).astype(np.uint8)
    out = cv2.morphologyEx(out, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    if keep_largest:
        out = largest_component(out)
    if fill_holes:
        out = fill_mask_holes(out)
    if scale != 1.0:
        out = cv2.resize(out, (w, h), interpolation=cv2.INTER_LINEAR)
        out = np.where(out > 127, 255, 0).astype(np.uint8)
    return out


def largest_component(mask: np.ndarray) -> np.ndarray:
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n <= 2:
        return mask
    idx = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    return np.where(labels == idx, 255, 0).astype(np.uint8)


def fill_mask_holes(mask: np.ndarray) -> np.ndarray:
    """Fill enclosed holes (staining/dark pockets that GrabCut dropped)."""
    h, w = mask.shape
    ff = mask.copy()
    border = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, border, (0, 0), 255)
    holes = cv2.bitwise_not(ff)
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
