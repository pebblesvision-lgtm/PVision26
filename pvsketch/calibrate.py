"""Drawing space.

The app does not measure from the photo. The photo only gives the shape; every
number is typed by the person on site. Internally the drawing still lives in a
millimetre space so that DXF/SVG/PDF come out at true scale: the photo pixels
are mapped to "mm" with a scale factor that the first typed measurement sets
(``Project.scale_from_dimension``). Until then the drawing is "ongeschaald".
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

import numpy as np

MAX_SIDE = 4000          # cap the working image for speed and memory
UNSCALED_UNITS = 1000.0  # longer photo side = 1000 units until a real measurement sets the scale


@dataclass
class Calibration:
    ppm: float                          # pixels per mm in the working image
    out_size: tuple[int, int]           # working image size (w, h) in px
    scaled: bool = False                # True once a typed measurement defined the scale
    scale_note: str = ""                # e.g. "schaal uit D1 (lengte 1240 mm)"
    mode: str = "manual"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "Calibration":
        return Calibration(ppm=float(d["ppm"]), out_size=tuple(d["out_size"]), scaled=bool(d.get("scaled", False)),
                           scale_note=d.get("scale_note", ""), mode=d.get("mode", "manual"))

    @property
    def width_mm(self) -> float:
        return self.out_size[0] / self.ppm

    @property
    def height_mm(self) -> float:
        return self.out_size[1] / self.ppm

    @property
    def note(self) -> str:
        return self.scale_note or "ongeschaald"


def initial_calibration(img_shape: tuple[int, int]) -> Calibration:
    h, w = img_shape[:2]
    return Calibration(ppm=max(w, h) / UNSCALED_UNITS, out_size=(int(w), int(h)))


def working_image(img: np.ndarray) -> np.ndarray:
    """Downscale very large photos; the shape doesn't need 48 megapixels."""
    import cv2
    h, w = img.shape[:2]
    if max(h, w) <= MAX_SIDE:
        return img
    s = MAX_SIDE / max(h, w)
    return cv2.resize(img, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA)
