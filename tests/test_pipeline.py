"""End-to-end check on the synthetic sample: known 300 x 180 mm stone with
R90 corners, photographed obliquely next to an A4 sheet."""
from __future__ import annotations

import json
import math
import os
import sys
import tempfile
import unittest

import cv2
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "samples"))

from make_sample import make  # noqa: E402
from pvsketch import calibrate as cal_mod  # noqa: E402
from pvsketch.export_dxf import drawing_to_dxf  # noqa: E402
from pvsketch.export_svg import drawing_to_svg  # noqa: E402
from pvsketch.geometry import Arc  # noqa: E402
from pvsketch.project import Project  # noqa: E402


class PipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.photo = os.path.join(cls.tmp.name, "sample.jpg")
        cls.truth = make(cls.photo)
        cls.project = Project.from_path(cls.photo, root=os.path.join(cls.tmp.name, "ws"))
        cls.cal = cls.project.calibrate_sheet(cls.truth["a4_corners_px"], "a4")
        x0, y0, x1, y1 = cls.truth["stone_bbox_px"]
        pts = cal_mod.original_to_rectified([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cls.cal)
        pad = 30
        rect = [pts[:, 0].min() - pad, pts[:, 1].min() - pad,
                np.ptp(pts[:, 0]) + 2 * pad, np.ptp(pts[:, 1]) + 2 * pad]
        cls.project.segment(rect)
        cls.project.outline({"epsilon_mm": 1.0, "arc_fit": True, "detail": {"enabled": True}})
        cls.drawing = cls.project.drawing()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_calibration_reference_maps_to_a4(self):
        # the A4 corners must land on a 210 x 297 rectangle in the rectified image
        pts = cal_mod.original_to_rectified(self.truth["a4_corners_px"], self.cal) / self.cal.ppm
        w = math.dist(pts[0], pts[1]); h = math.dist(pts[1], pts[2])
        self.assertAlmostEqual(w, 210.0, delta=0.5)
        self.assertAlmostEqual(h, 297.0, delta=0.5)

    def test_outline_size_within_tolerance(self):
        bb = self.drawing.outline_bbox()
        self.assertIsNotNone(bb)
        W, H = bb[2] - bb[0], bb[3] - bb[1]
        self.assertAlmostEqual(W, 300.0, delta=3.0)   # 1 %
        self.assertAlmostEqual(H, 180.0, delta=3.0)

    def test_arcs_found_with_right_radius(self):
        arcs = [p for p in self.drawing.outline if isinstance(p, Arc)]
        self.assertGreaterEqual(len(arcs), 2)
        for a in arcs:
            self.assertAlmostEqual(a.radius, 90.0, delta=3.0)

    def test_detail_layer_finds_crack(self):
        lengths = sorted(pl.length() for pl in self.drawing.detail)
        self.assertTrue(lengths, "no detail lines")
        self.assertTrue(any(150 <= L <= 190 for L in lengths), f"crack (~168 mm) not traced: {lengths}")

    def test_exports(self):
        self.project.set_annotations(
            [{"p1": [0, 0], "p2": [300, 0], "auto_mm": 0, "manual_mm": 301.5, "label": "W"}],
            [{"pos": [10, 10], "text": "test"}])
        dr = self.project.drawing()
        svg = drawing_to_svg(dr)
        self.assertIn('width="', svg); self.assertIn("mm\"", svg); self.assertIn("<path", svg); self.assertIn("301.5", svg)
        self.assertIn(" A ", svg)  # arcs exported as arc commands
        path = os.path.join(self.tmp.name, "t.dxf")
        drawing_to_dxf(dr, path)
        import ezdxf
        doc = ezdxf.readfile(path)
        types = {e.dxftype() for e in doc.modelspace()}
        self.assertIn("ARC", types); self.assertIn("LWPOLYLINE", types); self.assertIn("DIMENSION", types)
        self.assertEqual(doc.header["$INSUNITS"], 4)

    def test_two_point_and_aruco_paths(self):
        cal = cal_mod.calibrate_two_point((1000, 1000), (100, 100), (400, 100), 150.0)
        self.assertAlmostEqual(cal.ppm, 2.0)
        img, dpi = cal_mod.marker_image(3, 100.0, dpi=150)
        self.assertEqual(dpi, 150)
        # the generated marker must be detectable again
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        found = cal_mod.detect_aruco(bgr)
        self.assertEqual(found[0]["id"], 3)
        cal2 = cal_mod.calibrate_aruco(bgr, 100.0)
        self.assertEqual(cal2.mode, "aruco")

    def test_project_reload(self):
        p2 = Project.load(self.project.id, root=os.path.join(self.tmp.name, "ws"))
        self.assertEqual(p2.state["outline"], self.project.state["outline"])
        self.assertIsNotNone(p2.mask())


class ServerTest(unittest.TestCase):
    def test_api_roundtrip(self):
        from pvsketch.server.app import create_app
        with tempfile.TemporaryDirectory() as tmp:
            photo = os.path.join(tmp, "s.jpg"); truth = make(photo)
            app = create_app(workspace=os.path.join(tmp, "ws")); app.testing = True
            c = app.test_client()
            self.assertEqual(c.get("/").status_code, 200)
            with open(photo, "rb") as f:
                r = c.post("/api/projects", data={"photo": (f, "s.jpg")}, content_type="multipart/form-data")
            self.assertEqual(r.status_code, 200, r.data); pid = r.get_json()["id"]
            r = c.post(f"/api/projects/{pid}/calibrate", json={"mode": "quad", "sheet": "a4", "points": truth["a4_corners_px"]})
            self.assertEqual(r.status_code, 200, r.data)
            cal = cal_mod.Calibration.from_dict(r.get_json()["calibration"])
            x0, y0, x1, y1 = truth["stone_bbox_px"]
            pts = cal_mod.original_to_rectified([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cal)
            rect = [float(pts[:, 0].min() - 30), float(pts[:, 1].min() - 30), float(np.ptp(pts[:, 0]) + 60), float(np.ptp(pts[:, 1]) + 60)]
            r = c.post(f"/api/projects/{pid}/segment", json={"rect": rect}); self.assertEqual(r.status_code, 200, r.data)
            r = c.post(f"/api/projects/{pid}/outline", json={"params": {"epsilon_mm": 1.0}}); self.assertEqual(r.status_code, 200, r.data)
            bb = r.get_json()["bbox"]; self.assertAlmostEqual(bb[2] - bb[0], 300, delta=3)
            r = c.put(f"/api/projects/{pid}/annotations", json={"dimensions": [{"p1": [bb[0], bb[3]], "p2": [bb[2], bb[3]], "auto_mm": 0, "manual_mm": 300}], "labels": []})
            self.assertAlmostEqual(r.get_json()["dimensions"][0]["auto_mm"], 300, delta=3)
            for fmt in ("svg", "dxf", "png", "json"):
                self.assertEqual(c.get(f"/api/projects/{pid}/export.{fmt}").status_code, 200, fmt)
            self.assertEqual(c.get(f"/api/projects/{pid}/image/overlay").status_code, 200)
            self.assertEqual(c.get("/api/marker/0.png?size_mm=80").status_code, 200)


if __name__ == "__main__":
    unittest.main()
