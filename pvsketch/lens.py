"""Lens (camera) calibration: take the barrel/pincushion distortion out of
phone photos before measuring.

Print the checkerboard, photograph it 8-12 times from different angles and
distances with the camera/lens you use for stone photos, and build a profile.
The profile is matched to later photos by EXIF make/model and image size, and
the photo is undistorted before anything is clicked or measured.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Sequence

import cv2
import numpy as np

PATTERN = (9, 6)          # inner corners (10 x 7 squares)
SQUARE_MM = 25.0
PT = 72.0 / 25.4


def checkerboard_pdf(cols: int = PATTERN[0] + 1, rows: int = PATTERN[1] + 1, square_mm: float = SQUARE_MM) -> bytes:
    """A4 landscape checkerboard at true scale (size doesn't affect undistortion)."""
    W, H = 297.0, 210.0
    ox, oy = (W - cols * square_mm) / 2, (H - rows * square_mm) / 2
    c = ["0 g"]
    for r in range(rows):
        for k in range(cols):
            if (r + k) % 2 == 0:
                x = ox + k * square_mm
                y = H - (oy + (r + 1) * square_mm)
                c.append(f"{x*PT:.3f} {y*PT:.3f} {square_mm*PT:.3f} {square_mm*PT:.3f} re f")
    txt = f"pvsketch lens checkerboard {cols}x{rows} squares of {square_mm:g} mm - print flat, photograph 8-12 times from different angles"
    c.append(f"BT /F1 {3*PT:.2f} Tf {ox*PT:.3f} {(oy - 6)*PT:.3f} Td ({txt}) Tj ET")
    content = "\n".join(c).encode("latin-1")
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W*PT:.3f} {H*PT:.3f}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(),
            b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out = bytearray(b"%PDF-1.4\n"); offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out)); out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def find_corners(img: np.ndarray, pattern: tuple[int, int] = PATTERN) -> np.ndarray | None:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    ok, corners = False, None
    if hasattr(cv2, "findChessboardCornersSB"):
        ok, corners = cv2.findChessboardCornersSB(gray, pattern, cv2.CALIB_CB_EXHAUSTIVE | cv2.CALIB_CB_ACCURACY)
    if not ok:
        ok, corners = cv2.findChessboardCorners(gray, pattern, cv2.CALIB_CB_ADAPTIVE_THRESH | cv2.CALIB_CB_NORMALIZE_IMAGE)
        if ok:
            corners = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1), (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1e-3))
    return corners.reshape(-1, 2).astype(np.float32) if ok else None


def calibrate_lens(images: Sequence[np.ndarray], pattern: tuple[int, int] = PATTERN, square_mm: float = SQUARE_MM,
                   name: str = "", make: str = "", model: str = "") -> dict[str, Any]:
    """-> profile dict. Needs >= 4 usable images; 8-12 from varied angles is good."""
    if not images:
        raise ValueError("no images")
    size = (images[0].shape[1], images[0].shape[0])
    objp = np.zeros((pattern[0] * pattern[1], 3), np.float32)
    objp[:, :2] = np.mgrid[0:pattern[0], 0:pattern[1]].T.reshape(-1, 2) * square_mm
    obj_pts, img_pts, used = [], [], 0
    for img in images:
        if (img.shape[1], img.shape[0]) != size:
            if (img.shape[0], img.shape[1]) == size:   # rotated phone photo: use as-is (same intrinsics up to transpose)
                img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
            else:
                continue
        c = find_corners(img, pattern)
        if c is None:
            continue
        obj_pts.append(objp); img_pts.append(c.reshape(-1, 1, 2)); used += 1
    if used < 4:
        raise ValueError(f"checkerboard found in only {used} image(s); need at least 4 clear ones (8-12 is better)")
    rms, K, dist, _, _ = cv2.calibrateCamera(obj_pts, img_pts, size, None, None)
    return {"name": name or "camera", "make": make, "model": model, "image_size": list(size),
            "camera_matrix": K.tolist(), "dist_coeffs": dist.ravel().tolist(), "rms_px": float(rms), "n_images": used,
            "pattern": list(pattern), "square_mm": square_mm}


def undistort(img: np.ndarray, profile: dict[str, Any]) -> np.ndarray:
    """Remove lens distortion; keeps the full field of view (black corners)."""
    h, w = img.shape[:2]
    pw, ph = profile["image_size"]
    K = np.asarray(profile["camera_matrix"], dtype=np.float64)
    if (w, h) != (pw, ph):
        if (h, w) == (pw, ph):   # portrait photo with a landscape profile: transpose intrinsics
            K = np.array([[K[1, 1], 0, K[1, 2]], [0, K[0, 0], K[0, 2]], [0, 0, 1]])
            pw, ph = ph, pw
        s = w / pw
        if abs(h / ph - s) > 0.02:
            raise ValueError("photo aspect ratio doesn't match the lens profile")
        K = K * np.array([[s, 1, s], [1, s, s], [1, 1, 1]])
    dist = np.asarray(profile["dist_coeffs"], dtype=np.float64)
    newK, _ = cv2.getOptimalNewCameraMatrix(K, dist, (w, h), 1.0, (w, h))
    return cv2.undistort(img, K, dist, None, newK)


# -------------------------------------------------------------- storage ----
def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)[:60] or "camera"


def profiles_dir(root: str) -> str:
    d = os.path.join(root, "_cameras")
    os.makedirs(d, exist_ok=True)
    return d


def save_profile(root: str, profile: dict[str, Any]) -> str:
    profile["name"] = _safe(profile.get("name", "camera"))
    with open(os.path.join(profiles_dir(root), profile["name"] + ".json"), "w", encoding="utf-8") as f:
        json.dump(profile, f, indent=1)
    return profile["name"]


def load_profile(root: str, name: str) -> dict[str, Any] | None:
    path = os.path.join(profiles_dir(root), _safe(name) + ".json")
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def list_profiles(root: str) -> list[dict[str, Any]]:
    out = []
    for fn in sorted(os.listdir(profiles_dir(root))):
        if fn.endswith(".json"):
            p = load_profile(root, fn[:-5])
            if p:
                out.append({k: p.get(k) for k in ("name", "make", "model", "image_size", "rms_px", "n_images")})
    return out


def delete_profile(root: str, name: str) -> bool:
    path = os.path.join(profiles_dir(root), _safe(name) + ".json")
    if os.path.isfile(path):
        os.remove(path); return True
    return False


def match_profile(root: str, make: str, model: str, size: tuple[int, int]) -> str | None:
    """Best profile for a photo: same make/model and same size (either orientation)."""
    w, h = size
    for p in list_profiles(root):
        full = load_profile(root, p["name"]) or {}
        ps = tuple(full.get("image_size") or ())
        same_size = ps in ((w, h), (h, w))
        same_cam = (full.get("model") or "").lower() == (model or "").lower() and (full.get("make") or "").lower() == (make or "").lower()
        if same_size and (same_cam or not full.get("model")):
            return p["name"]
    return None


def exif_make_model(data: bytes) -> tuple[str, str]:
    try:
        from PIL import Image
        import io as _io
        ex = Image.open(_io.BytesIO(data)).getexif()
        return str(ex.get(271, "")).strip(), str(ex.get(272, "")).strip()
    except Exception:  # noqa: BLE001
        return "", ""
