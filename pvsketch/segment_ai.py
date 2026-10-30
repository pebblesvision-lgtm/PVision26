"""Optional "smart select": click-to-segment with a Segment-Anything model
running offline through onnxruntime. Used in the Isolate step when the model
files are present; otherwise the tool is simply hidden and GrabCut remains.

Model files (put them in ``<workspace>/_models/`` or set PVSKETCH_MODELS):

    mobile_sam_encoder.onnx   image encoder (MobileSAM / TinyViT, ~40 MB)
    mobile_sam_decoder.onnx   prompt decoder (~16 MB, SAM's standard ONNX export)

Both come from the MobileSAM project (github.com/ChaoningZhang/MobileSAM,
"ONNX" section) or any SAM-compatible export with the same interface:
    encoder : float32 image [1,3,1024,1024] (resized+padded, ImageNet mean/std)
              -> image_embeddings [1,256,64,64]
    decoder : image_embeddings, point_coords [1,N,2], point_labels [1,N],
              mask_input [1,1,256,256], has_mask_input [1], orig_im_size [2]
              -> masks [1,1,H,W] (logits), iou_predictions, low_res_masks

The sandbox this was written in could not download the weights, so this file
is tested only for the preprocessing/postprocessing path with a stub model;
report an error message from it and it will be fixed quickly.
"""
from __future__ import annotations

import os
from typing import Any, Sequence

import cv2
import numpy as np

ENCODER = "mobile_sam_encoder.onnx"
DECODER = "mobile_sam_decoder.onnx"
MEAN = np.array([123.675, 116.28, 103.53], np.float32)
STD = np.array([58.395, 57.12, 57.375], np.float32)
SIDE = 1024


def models_dir(root: str) -> str:
    return os.environ.get("PVSKETCH_MODELS") or os.path.join(root, "_models")


def available(root: str) -> bool:
    d = models_dir(root)
    if not (os.path.isfile(os.path.join(d, ENCODER)) and os.path.isfile(os.path.join(d, DECODER))):
        return False
    try:
        import onnxruntime  # noqa: F401
    except ImportError:
        return False
    return True


class SmartSelector:
    """One instance per process; image embeddings are cached per project."""

    def __init__(self, root: str):
        import onnxruntime as ort
        d = models_dir(root)
        opts = ort.SessionOptions()
        self.enc = ort.InferenceSession(os.path.join(d, ENCODER), opts, providers=["CPUExecutionProvider"])
        self.dec = ort.InferenceSession(os.path.join(d, DECODER), opts, providers=["CPUExecutionProvider"])
        self.enc_input = self.enc.get_inputs()[0].name
        self._cache: dict[str, tuple[np.ndarray, float]] = {}

    # ---------------------------------------------------------- encoding
    @staticmethod
    def preprocess(img_bgr: np.ndarray) -> tuple[np.ndarray, float]:
        h, w = img_bgr.shape[:2]
        scale = SIDE / max(h, w)
        nh, nw = int(round(h * scale)), int(round(w * scale))
        rgb = cv2.cvtColor(cv2.resize(img_bgr, (nw, nh), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB).astype(np.float32)
        rgb = (rgb - MEAN) / STD
        pad = np.zeros((SIDE, SIDE, 3), np.float32)
        pad[:nh, :nw] = rgb
        return pad.transpose(2, 0, 1)[None], scale

    def embed(self, key: str, img_bgr: np.ndarray) -> tuple[np.ndarray, float]:
        if key not in self._cache:
            x, scale = self.preprocess(img_bgr)
            emb = self.enc.run(None, {self.enc_input: x})[0]
            if len(self._cache) > 4:
                self._cache.pop(next(iter(self._cache)))
            self._cache[key] = (emb, scale)
        return self._cache[key]

    # ---------------------------------------------------------- decoding
    def mask(self, key: str, img_bgr: np.ndarray, fg_points: Sequence[Sequence[float]],
             bg_points: Sequence[Sequence[float]] = (), box: Sequence[float] | None = None) -> np.ndarray:
        """Points in image px -> binary mask (uint8 0/255) of the image size."""
        emb, scale = self.embed(key, img_bgr)
        h, w = img_bgr.shape[:2]
        coords, labels = [], []
        for p in fg_points:
            coords.append([p[0] * scale, p[1] * scale]); labels.append(1)
        for p in bg_points:
            coords.append([p[0] * scale, p[1] * scale]); labels.append(0)
        if box is not None and len(box) == 4:
            x, y, bw, bh = box
            coords += [[x * scale, y * scale], [(x + bw) * scale, (y + bh) * scale]]; labels += [2, 3]
        if not coords:
            raise ValueError("click at least one point on the stone")
        coords.append([0.0, 0.0]); labels.append(-1)   # SAM's padding point
        feed: dict[str, Any] = {
            "image_embeddings": emb.astype(np.float32),
            "point_coords": np.array([coords], np.float32),
            "point_labels": np.array([labels], np.float32),
            "mask_input": np.zeros((1, 1, 256, 256), np.float32),
            "has_mask_input": np.zeros(1, np.float32),
            "orig_im_size": np.array([h, w], np.float32),
        }
        names = {i.name for i in self.dec.get_inputs()}
        feed = {k: v for k, v in feed.items() if k in names}
        out = self.dec.run(None, feed)
        masks = out[0]
        m = masks[0, 0] if masks.ndim == 4 else masks[0]
        if m.shape != (h, w):
            m = cv2.resize(m.astype(np.float32), (w, h), interpolation=cv2.INTER_LINEAR)
        return np.where(m > 0, 255, 0).astype(np.uint8)
