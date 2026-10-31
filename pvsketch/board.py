"""Rigid calibration board: 4 ArUco markers at known positions on an A3/A4 sheet.

Print the PDF at 100 % and glue it to foam board or MDF. Paper on its own
curls; the board stays flat and is what makes the photo measurable. Up to
16 marker corners go into one homography (RANSAC), and it is auto-detected,
so there is nothing to click.

Layout (landscape, mm, origin top-left): a marker of side ``marker`` sits in
each corner inset by ``margin``; ids 0,1,2,3 = TL, TR, BR, BL.
"""
from __future__ import annotations

import math
from typing import Any

import cv2
import numpy as np

from .calibrate import ARUCO_DICT_NAME, Calibration, _aruco_dict, _fit_canvas, detect_aruco

BOARDS: dict[str, dict[str, Any]] = {
    "a3": {"size": (420.0, 297.0), "marker": 60.0, "margin": 15.0, "ids": (0, 1, 2, 3)},
    "a4": {"size": (297.0, 210.0), "marker": 45.0, "margin": 12.0, "ids": (0, 1, 2, 3)},
}


def marker_corners_mm(board: str) -> dict[int, np.ndarray]:
    """id -> 4x2 corner coordinates (TL, TR, BR, BL of the marker) in mm."""
    b = BOARDS[board]
    W, H = b["size"]; m = b["marker"]; g = b["margin"]
    origins = {b["ids"][0]: (g, g), b["ids"][1]: (W - g - m, g), b["ids"][2]: (W - g - m, H - g - m), b["ids"][3]: (g, H - g - m)}
    return {i: np.array([[x, y], [x + m, y], [x + m, y + m], [x, y + m]], dtype=np.float64) for i, (x, y) in origins.items()}


def calibrate_board(img: np.ndarray, board: str = "a3", ppm: float | None = None,
                    dict_name: str = ARUCO_DICT_NAME) -> tuple[Calibration, list[int]]:
    """Homography from every detected board marker. Returns (calibration, ids used)."""
    spec = BOARDS[board]
    want = marker_corners_mm(board)
    found = [m for m in detect_aruco(img, dict_name) if m["id"] in want]
    if not found:
        raise ValueError("no board markers found - is the whole board in the photo and in focus?")
    src = np.concatenate([np.asarray(m["corners"], dtype=np.float64) for m in found])
    dst_mm = np.concatenate([want[m["id"]] for m in found])
    if ppm is None:
        # keep the photo's resolution on the board: pixels along marker edges / mm
        per_px = sum(math.dist(c[i], c[(i + 1) % 4]) for m in found for c in [np.asarray(m["corners"])] for i in range(4))
        ppm = max(0.5, per_px / (4 * spec["marker"] * len(found)))
    dst = dst_mm * ppm
    if len(found) == 1:
        H_ref = cv2.getPerspectiveTransform(src.astype(np.float32), dst.astype(np.float32)).astype(np.float64)
    else:
        H_ref, _ = cv2.findHomography(src, dst, cv2.RANSAC, 3.0)
        if H_ref is None:
            raise ValueError("board markers found but no consistent homography - retake the photo")
    img_h, img_w = img.shape[:2]
    W, Hb = spec["size"]
    board_rect = np.array([[0, 0], [W * ppm, 0], [W * ppm, Hb * ppm], [0, Hb * ppm]])
    H, out, scale = _fit_canvas(H_ref, img_w, img_h, board_rect)
    ids = sorted(m["id"] for m in found)
    cal = Calibration(mode="board", ppm=ppm * scale, H=H.tolist(), out_size=out,
                      ref_points_px=src.tolist(), ref_size_mm=(W, Hb),
                      note=f"board {board.upper()}: {len(found)} marker(s) {ids}, {len(src)} corners")
    return cal, ids


# ------------------------------------------------------------ printing ----
PT = 72.0 / 25.4


def _marker_bits(marker_id: int, dict_name: str = ARUCO_DICT_NAME) -> np.ndarray:
    """6x6 cell grid (border + 4x4 payload) as 0/1, 1 = black."""
    img = cv2.aruco.generateImageMarker(_aruco_dict(dict_name), marker_id, 6)
    return (img < 128).astype(np.uint8)


def board_pdf(board: str = "a3", dict_name: str = ARUCO_DICT_NAME) -> bytes:
    """Vector PDF of the board at true scale: markers as filled squares."""
    spec = BOARDS[board]
    W, H = spec["size"]; m = spec["marker"]
    c: list[str] = ["0 g"]
    for mid, corners in marker_corners_mm(board).items():
        x0, y0 = corners[0]
        bits = _marker_bits(mid, dict_name)
        cell = m / 6.0
        for r in range(6):
            for col in range(6):
                if bits[r, col]:
                    x = x0 + col * cell
                    y = H - (y0 + (r + 1) * cell)  # PDF y-up
                    c.append(f"{x*PT:.3f} {y*PT:.3f} {cell*PT:.3f} {cell*PT:.3f} re f")
        # id caption under the marker
        c.append(f"BT /F1 {3*PT:.2f} Tf {x0*PT:.3f} {(H - y0 - m - 4)*PT:.3f} Td (id {mid}) Tj ET")
    # crop marks + ruler check bar
    c.append("0.5 w 0 G")
    for (x, y) in [(0, 0), (W, 0), (W, H), (0, H)]:
        c.append(f"{x*PT:.3f} {(H-y)*PT:.3f} m {(x + (5 if x == 0 else -5))*PT:.3f} {(H-y)*PT:.3f} l S")
    bx, by = W / 2 - 50, H / 2
    c.append(f"1 w {bx*PT:.3f} {(H-by)*PT:.3f} m {(bx+100)*PT:.3f} {(H-by)*PT:.3f} l S")
    for k in range(11):
        c.append(f"{(bx+10*k)*PT:.3f} {(H-by)*PT:.3f} m {(bx+10*k)*PT:.3f} {(H-by+3)*PT:.3f} l S")
    txt = (f"pvsketch calibration board {board.upper()} - {W:g} x {H:g} mm - markers {m:g} mm - "
           f"print at 100% / actual size, check the 100 mm bar with a ruler, glue flat on foam board")
    c.append(f"BT /F1 {3.2*PT:.2f} Tf {bx*PT:.3f} {(H-by-6)*PT:.3f} Td ({txt}) Tj ET")
    c.append(f"BT /F1 {4*PT:.2f} Tf {bx*PT:.3f} {(H-by+6)*PT:.3f} Td (100 mm) Tj ET")
    content = "\n".join(c).encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {W*PT:.3f} {H*PT:.3f}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(),
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out)); out += f"{i} 0 obj\n".encode() + o + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(out)


def board_image(board: str = "a3", dpi: int = 300, dict_name: str = ARUCO_DICT_NAME) -> np.ndarray:
    """Raster version (for a quick print or for synthetic tests)."""
    spec = BOARDS[board]
    W, H = spec["size"]; m = spec["marker"]
    px = lambda v: int(round(v / 25.4 * dpi))  # noqa: E731
    img = np.full((px(H), px(W)), 255, np.uint8)
    for mid, corners in marker_corners_mm(board).items():
        x0, y0 = corners[0]
        mk = cv2.aruco.generateImageMarker(_aruco_dict(dict_name), mid, px(m))
        img[px(y0):px(y0) + mk.shape[0], px(x0):px(x0) + mk.shape[1]] = mk
    cv2.line(img, (px(W / 2 - 50), px(H / 2)), (px(W / 2 + 50), px(H / 2)), 0, max(1, dpi // 100))
    return img
