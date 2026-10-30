"""Generate a synthetic "photo" to try pvsketch without a real stone.

A 300 x 180 mm stone with a rounded top (radius 90 mm) and a 40 mm notch, next
to an A4 sheet, both lying in the same plane, viewed from an oblique angle.
Ground truth and the projected A4 corners are written next to the image so the
pipeline can be tested headlessly:

    python samples/make_sample.py samples/sample.jpg
    python -m pvsketch run samples/sample.jpg --sheet a4 --corners "$(cat samples/sample.corners)" --out out
"""
from __future__ import annotations

import json
import sys

import cv2
import numpy as np

STONE_W, STONE_H, STONE_R = 300.0, 180.0, 90.0
NOTCH = 40.0


def stone_polygon_mm(ox: float, oy: float, n_arc: int = 60) -> np.ndarray:
    """Outline in mm (y-down): flat base, straight sides, semicircular arcs at
    the top corners, a square notch in the lower-left corner."""
    pts = []
    # start bottom-left after notch
    pts += [(ox + NOTCH, oy + STONE_H), (ox + STONE_W, oy + STONE_H), (ox + STONE_W, oy + STONE_R)]
    # top-right arc: center (ox+W-R, oy+R) from angle 0 to -90 (y-down)
    cx, cy = ox + STONE_W - STONE_R, oy + STONE_R
    for i in range(n_arc + 1):
        a = -np.pi / 2 * i / n_arc
        pts.append((cx + STONE_R * np.cos(a), cy + STONE_R * np.sin(a)))
    # top-left arc
    cx, cy = ox + STONE_R, oy + STONE_R
    for i in range(n_arc + 1):
        a = -np.pi / 2 - np.pi / 2 * i / n_arc
        pts.append((cx + STONE_R * np.cos(a), cy + STONE_R * np.sin(a)))
    pts += [(ox, oy + STONE_H - NOTCH), (ox + NOTCH, oy + STONE_H - NOTCH)]
    return np.array(pts, dtype=np.float64)


def make(out_path: str, ppm: float = 3.0, seed: int = 1) -> dict:
    rng = np.random.default_rng(seed)
    W_mm, H_mm = 700.0, 420.0
    W, H = int(W_mm * ppm), int(H_mm * ppm)
    # background: grey render-ish wall with noise
    img = np.full((H, W, 3), 150, np.uint8)
    img = (img.astype(np.int16) + rng.integers(-18, 18, (H, W, 1))).clip(0, 255).astype(np.uint8)
    # A4 sheet (portrait) at left
    a4 = np.array([[40, 60], [250, 60], [250, 357], [40, 357]], dtype=np.float64)
    cv2.fillPoly(img, [(a4 * ppm).astype(np.int32)], (245, 245, 245))
    # stone
    poly = stone_polygon_mm(320, 120)
    stone = img.copy()
    cv2.fillPoly(stone, [(poly * ppm).astype(np.int32)], (70, 85, 95))
    grain = rng.integers(-25, 25, (H, W, 1))
    stone = (stone.astype(np.int16) + grain).clip(0, 255).astype(np.uint8)
    mask = np.zeros((H, W), np.uint8)
    cv2.fillPoly(mask, [(poly * ppm).astype(np.int32)], 255)
    img[mask > 0] = stone[mask > 0]
    # a stain + a crack line as "details"
    cv2.ellipse(img, (int(450 * ppm), int(200 * ppm)), (int(30 * ppm), int(18 * ppm)), 20, 0, 360, (35, 40, 48), -1)
    cv2.line(img, (int(400 * ppm), int(280 * ppm)), (int(560 * ppm), (int(230 * ppm))), (30, 30, 30), 2)
    img = cv2.GaussianBlur(img, (3, 3), 0)

    # oblique view: perspective warp of the plane
    src = np.array([[0, 0], [W, 0], [W, H], [0, H]], np.float32)
    dst = np.array([[120, 90], [W - 60, 30], [W - 200, H - 40], [40, H - 120]], np.float32)
    Hm = cv2.getPerspectiveTransform(src, dst)
    photo = cv2.warpPerspective(img, Hm, (W, H), borderValue=(120, 120, 125))
    photo = cv2.GaussianBlur(photo, (3, 3), 0)
    cv2.imwrite(out_path, photo, [cv2.IMWRITE_JPEG_QUALITY, 92])

    a4_photo = cv2.perspectiveTransform((a4 * ppm).reshape(-1, 1, 2).astype(np.float32), Hm).reshape(-1, 2)
    stone_photo = cv2.perspectiveTransform((poly * ppm).reshape(-1, 1, 2).astype(np.float32), Hm).reshape(-1, 2)
    truth = {
        "a4_corners_px": a4_photo.round(2).tolist(),
        "stone_bbox_px": [float(v) for v in (stone_photo[:, 0].min(), stone_photo[:, 1].min(),
                                             stone_photo[:, 0].max(), stone_photo[:, 1].max())],
        "stone_polygon_px": stone_photo.round(2).tolist(),
        "stone_mm": {"width": STONE_W, "height": STONE_H, "corner_radius": STONE_R, "notch": NOTCH},
        "a4_origin_mm": [40, 60], "stone_origin_mm": [320, 120],
    }
    base = out_path.rsplit(".", 1)[0]
    with open(base + ".truth.json", "w") as f:
        json.dump(truth, f, indent=1)
    with open(base + ".corners", "w") as f:
        f.write(",".join(f"{v:.1f}" for p in a4_photo for v in p))
    return truth


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "samples/sample.jpg"
    t = make(out)
    print(json.dumps(t, indent=1))
