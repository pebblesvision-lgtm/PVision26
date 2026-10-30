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
from pvsketch.export_pdf import drawing_to_pdf  # noqa: E402
from pvsketch.export_svg import drawing_to_svg  # noqa: E402
from pvsketch.export_table import dimensions_csv  # noqa: E402
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

    def test_polygon_guided_grabcut_and_exact_polygon(self):
        """A rough polygon (±12 px) around the stone must still give the true size."""
        poly = np.asarray(self.truth["stone_polygon_px"], dtype=np.float64)
        rect_poly = cal_mod.original_to_rectified(poly, self.cal)
        rng = np.random.default_rng(0)
        rough = (rect_poly + rng.uniform(-12, 12, rect_poly.shape)).tolist()
        p = Project.from_path(self.photo, root=os.path.join(self.tmp.name, "ws2"))
        p.calibrate_sheet(self.truth["a4_corners_px"], "a4")
        p.segment(polygon=rough, band_px=25)
        bb = p.outline({"detail": {"enabled": False}})["bbox"]
        self.assertAlmostEqual(bb[2] - bb[0], 300, delta=3); self.assertAlmostEqual(bb[3] - bb[1], 180, delta=3)
        # eraser: a background stroke through the stone, then erased, must not cut it
        cx, cy = rect_poly.mean(axis=0)
        strokes = [{"kind": "bg", "pts": [[cx - 100, cy], [cx + 100, cy]], "r": 10},
                   {"kind": "erase", "pts": [[cx - 120, cy], [cx + 120, cy]], "r": 14}]
        p.segment(polygon=rough, strokes=strokes, band_px=25)
        bb = p.outline()["bbox"]
        self.assertAlmostEqual(bb[3] - bb[1], 180, delta=3)
        # exact polygon mode uses the clicked points as the mask
        p.segment(polygon=rect_poly.tolist(), mode="polygon")
        bb = p.outline()["bbox"]
        self.assertAlmostEqual(bb[2] - bb[0], 300, delta=2)
        # hand-edited outline round-trips
        out = p.state["outline"]
        d = p.set_outline(out)
        self.assertTrue(p.state["outline_edited"]); self.assertEqual(len(d["outline"]), len(out))

    def test_dimension_kinds(self):
        from pvsketch.geometry import Dimension, dimension_geometry
        h = Dimension(p1=(0, 0), p2=(30, 40), auto_mm=0, kind="horizontal", offset_mm=10)
        v = Dimension(p1=(0, 0), p2=(30, 40), auto_mm=0, kind="vertical", offset_mm=-5)
        a = Dimension(p1=(0, 0), p2=(30, 40), auto_mm=0, kind="aligned", offset_mm=0)
        self.assertEqual(h.measured_auto(), 30); self.assertEqual(v.measured_auto(), 40); self.assertAlmostEqual(a.measured_auto(), 50)
        g = dimension_geometry(h)
        self.assertEqual(g["line"][0][1], 50); self.assertEqual(g["line"][1][1], 50)
        g = dimension_geometry(v)
        self.assertEqual(g["line"][0][0], -5)

    def test_finishes_and_titleblock(self):
        from pvsketch.hatch import finish_hatch
        sq = [[0, 0], [100, 0], [100, 60], [0, 60]]
        for kind in ("frijnen", "scharreren", "gradineren", "spitsen", "randslag"):
            h = finish_hatch(sq, kind)
            self.assertTrue(h["lines"], kind)
            for p, q in h["lines"]:
                for x, y in (p, q):
                    self.assertTrue(-0.01 <= x <= 100.01 and -0.01 <= y <= 60.01, (kind, p, q))
        self.assertTrue(finish_hatch(sq, "boucharderen")["dots"])
        self.assertEqual(finish_hatch(sq, "gezoet"), {"lines": [], "dots": []})
        self.project.state["lang"] = "nl"
        self.project.set_titleblock({"project": "Westgevel", "element": "R-03", "material": "Bentheimer", "quantity": "2"})
        self.project.set_annotations([], [], finishes=[{"polygon": sq, "kind": "frijnen"}],
                                     sketches=[{"points": [[0, 0], [50, 50]], "arrow": True, "text": "scheur", "style": "dashed"}])
        dr = self.project.drawing()
        self.assertEqual(dr.lang, "nl"); self.assertEqual(dr.finishes[0].id, "F1")
        svg = drawing_to_svg(dr)
        self.assertIn("productietekening", svg); self.assertIn("F1 gefrijnd", svg); self.assertIn("Bentheimer", svg); self.assertIn("scheur", svg)
        pdf = drawing_to_pdf(dr)
        self.assertIn(b"gefrijnd", pdf); self.assertIn(b"Westgevel", pdf)
        path = os.path.join(self.tmp.name, "fin.dxf"); drawing_to_dxf(dr, path)
        import ezdxf
        layers = {e.dxf.layer for e in ezdxf.readfile(path).modelspace()}
        self.assertIn("FINISH", layers); self.assertIn("SKETCH", layers)
        self.project.state["lang"] = "en"; self.project.set_annotations([], [], finishes=[], sketches=[])

    def test_board_and_templates(self):
        from pvsketch import board as B
        from pvsketch.templates import checklist_from_template, ELEMENT_TEMPLATES
        img = B.board_image("a4", dpi=120)
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        h, w = bgr.shape[:2]
        M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), np.float32([[60, 40], [w - 30, 20], [w - 90, h - 30], [20, h - 70]]))
        photo = cv2.warpPerspective(bgr, M, (w, h), borderValue=(100, 100, 100))
        cal, ids = B.calibrate_board(photo, "a4")
        self.assertEqual(ids, [0, 1, 2, 3])
        # the board's own corners must come out at 297 x 210 mm
        c = cv2.perspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]).reshape(-1, 1, 2), M).reshape(-1, 2)
        r = cal_mod.original_to_rectified(c, cal) / cal.ppm
        self.assertAlmostEqual(math.dist(r[0], r[1]), 297, delta=1.0); self.assertAlmostEqual(math.dist(r[1], r[2]), 210, delta=1.0)
        self.assertTrue(B.board_pdf("a3").startswith(b"%PDF"))
        cl = checklist_from_template("raamdorpel")
        self.assertTrue(any(c["key"] == "lengte" for c in cl)); self.assertIn("vrij", ELEMENT_TEMPLATES)

    def test_exports(self):
        self.project.set_annotations(
            [{"p1": [0, 0], "p2": [300, 0], "auto_mm": 0, "manual_mm": 301.5, "label": "W", "kind": "horizontal", "offset_mm": 15, "style": "dashed"},
             {"p1": [0, 0], "p2": [0, 180], "auto_mm": 0, "kind": "vertical", "offset_mm": -10}],
            [{"pos": [10, 10], "text": "test"}])
        dr = self.project.drawing()
        pdf = drawing_to_pdf(dr)
        self.assertTrue(pdf.startswith(b"%PDF-1.4")); self.assertIn(b"/MediaBox", pdf); self.assertIn(b"301.5", pdf)
        csv_txt = dimensions_csv(dr)
        self.assertIn("D1;W;horizontal;301.5;", csv_txt)
        path12 = os.path.join(self.tmp.name, "t12.dxf")
        drawing_to_dxf(dr, path12, version="R12")
        import ezdxf
        d12 = ezdxf.readfile(path12)
        self.assertEqual(d12.dxfversion, "AC1009")
        self.assertIn("POLYLINE", {e.dxftype() for e in d12.modelspace()})
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
            for fmt in ("svg", "dxf", "dxf?version=R12", "png", "json", "pdf", "pdf?paper=a4", "csv"):
                self.assertEqual(c.get(f"/api/projects/{pid}/export.{fmt}").status_code, 200, fmt)
            # polygon + strokes through the API
            poly = cal_mod.original_to_rectified(truth["stone_polygon_px"], cal).tolist()
            r = c.post(f"/api/projects/{pid}/segment", json={"polygon": poly, "strokes": [{"kind": "erase", "pts": [[1, 1]], "r": 5}], "band_px": 20})
            self.assertEqual(r.status_code, 200, r.data)
            r = c.put(f"/api/projects/{pid}/outline", json={"outline": c.post(f"/api/projects/{pid}/outline", json={}).get_json()["outline"]})
            self.assertEqual(r.status_code, 200, r.data)
            self.assertEqual(c.get(f"/api/projects/{pid}/image/overlay").status_code, 200)
            self.assertEqual(c.get("/api/marker/0.png?size_mm=80").status_code, 200)
            self.assertEqual(c.get("/api/finishes").get_json()[0]["kind"], "frijnen")
            r = c.patch(f"/api/projects/{pid}", json={"lang": "nl", "titleblock": {"project": "P1", "bogus": "x"}})
            self.assertEqual(r.get_json()["titleblock"], {"project": "P1"}); self.assertEqual(r.get_json()["lang"], "nl")
            r = c.put(f"/api/projects/{pid}/annotations", json={"dimensions": [], "labels": [], "finishes": [{"polygon": [[bb[0], bb[1]], [bb[2], bb[1]], [bb[2], bb[3]]], "kind": "randslag"}], "sketches": []})
            self.assertTrue(r.get_json()["finishes"][0]["hatch"]["lines"])
            self.assertEqual(c.post("/api/projects/sample").status_code, 200)
            self.assertEqual(c.get("/api/board/a3.pdf").status_code, 200)
            self.assertEqual(c.get("/api/templates?lang=nl").get_json()[0]["name"], "Raamdorpel")
            r = c.put(f"/api/projects/{pid}/template", json={"template": "raamdorpel"})
            self.assertEqual(r.status_code, 200); cl = r.get_json()["checklist"]; self.assertTrue(cl)
            cl[1]["value_mm"] = 240
            r = c.put(f"/api/projects/{pid}/annotations", json={"dimensions": [], "labels": [], "checklist": cl})
            self.assertEqual(r.get_json()["checklist"][1]["value_mm"], 240)
            self.assertIn("240.0", c.get(f"/api/projects/{pid}/export.csv").data.decode("utf-8-sig"))
            self.assertEqual(c.get("/healthz").status_code, 200)


if __name__ == "__main__":
    unittest.main()
