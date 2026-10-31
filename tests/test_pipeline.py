"""End-to-end checks on the synthetic sample: a 300 x 180 mm stone with R90
corners. The app measures nothing from the photo; the typed width defines the
scale, so after typing 300 the outline must be 300 wide and the height follows
(180 for the synthetic photo, which has no perspective on the stone face
relative to the sheet... it does, but the ratio check is loose)."""
from __future__ import annotations

import os
import sys
import tempfile
import unittest

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "samples"))

from make_sample import make  # noqa: E402
from pvsketch.export_dxf import drawing_to_dxf  # noqa: E402
from pvsketch.export_pdf import drawing_to_pdf  # noqa: E402
from pvsketch.export_svg import drawing_to_svg, drawing_to_png  # noqa: E402
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
        poly = cls.truth["stone_polygon_px"]
        rng = np.random.default_rng(0)
        rough = (np.asarray(poly[::5], dtype=np.float64) + rng.uniform(-10, 10, (len(poly[::5]), 2))).tolist()
        cls.project.segment(polygon=rough, band_px=25)
        cls.project.outline({"epsilon_mm": 1.0, "arc_fit": True, "detail": {"enabled": True}})
        cls.drawing = cls.project.drawing()

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_unscaled_until_typed(self):
        self.assertFalse(self.project.calibration.scaled)
        self.assertIn("ongeschaald", self.project.calibration.note)
        self.assertIn("NIET OP SCHAAL", drawing_to_svg(self.drawing))

    def test_outline_shape(self):
        bb = self.drawing.outline_bbox()
        self.assertIsNotNone(bb)
        ratio = (bb[2] - bb[0]) / (bb[3] - bb[1])
        self.assertAlmostEqual(ratio, 300 / 180, delta=0.25)  # oblique photo, so loose
        arcs = [p for p in self.drawing.outline if isinstance(p, Arc)]
        self.assertGreaterEqual(len(arcs), 1)

    def test_typed_width_sets_scale(self):
        p = Project.from_path(self.photo, root=os.path.join(self.tmp.name, "ws2"))
        p.segment(polygon=self.truth["stone_polygon_px"][::4], band_px=25)
        bb = p.outline()["bbox"]
        p.set_annotations([{"p1": [bb[0], bb[3]], "p2": [bb[2], bb[3]], "kind": "horizontal", "label": "breedte", "manual_mm": 300}], [],
                          finishes=[{"polygon": [[bb[0] + 10, bb[1] + 10], [bb[2] - 10, bb[1] + 10], [bb[2] - 10, bb[3] - 10], [bb[0] + 10, bb[3] - 10]],
                                     "kind": "kathedraal", "strokes_per_10cm": 8, "comment": "zoals bestaand"}])
        cal = p.scale_from_dimension(0, 300)
        self.assertTrue(cal.scaled)
        dr = p.drawing(); bb2 = dr.outline_bbox()
        self.assertAlmostEqual(bb2[2] - bb2[0], 300, delta=0.5)
        self.assertEqual(dr.dimensions[0].text("nl"), "breedte: 300")
        # the finish region scaled with the drawing and its legend carries strokes + comment
        self.assertAlmostEqual(dr.finishes[0].polygon[2][0], bb2[2] - 10 * (300 / (bb[2] - bb[0])), delta=0.5)
        self.assertIn("8 slagen/10 cm", dr.finishes[0].legend("nl")); self.assertIn("zoals bestaand", dr.finishes[0].legend("nl"))
        self.assertAlmostEqual(dr.finishes[0].effective_spacing, 12.5)
        # a later typed value on another dimension does not change the scale
        p.set_annotations(p.state["dimensions"] + [{"p1": [bb2[2], bb2[1]], "p2": [bb2[2], bb2[3]], "kind": "vertical", "manual_mm": 999}], [])
        bb3 = p.drawing().outline_bbox()
        self.assertAlmostEqual(bb3[2] - bb3[0], 300, delta=0.5)
        self.assertIn("schaal uit breedte = 300 mm", p.calibration.note)
        # survives reload
        self.assertTrue(Project.load(p.id, root=os.path.join(self.tmp.name, "ws2")).calibration.scaled)

    def test_finish_patterns(self):
        from pvsketch.hatch import finish_hatch
        sq = [[0, 0], [160, 0], [160, 90], [0, 90]]
        for kind in ("frijnen", "frijnen_v", "frijnen_h", "kathedraal", "kathedraal_vrij", "scharreren", "gradineren", "spitsen", "randslag"):
            h = finish_hatch(sq, kind)
            self.assertTrue(h["lines"], kind)
            for p, q in h["lines"]:
                for x, y in (p, q):
                    self.assertTrue(-0.01 <= x <= 160.01 and -0.01 <= y <= 90.01, (kind, p, q))
        v = finish_hatch(sq, "frijnen_v")["lines"][0]
        self.assertAlmostEqual(v[0][0], v[1][0], delta=1e-6)   # vertical lines
        self.assertTrue(finish_hatch(sq, "boucharderen")["dots"])
        self.assertEqual(finish_hatch(sq, "gezoet"), {"lines": [], "dots": []})

    def test_detail_layer_finds_crack(self):
        lengths = sorted(pl.length() for pl in self.drawing.detail)
        self.assertTrue(lengths, "no detail lines")

    def test_exports(self):
        self.project.state["lang"] = "nl"
        self.project.set_titleblock({"project": "Westgevel", "element": "R-03", "material": "Bentheimer", "quantity": "2"})
        self.project.set_annotations(
            [{"p1": [0, 0], "p2": [300, 0], "kind": "horizontal", "offset_mm": 15, "style": "dashed", "label": "W", "manual_mm": 301.5},
             {"p1": [0, 0], "p2": [0, 180], "kind": "vertical", "offset_mm": -10}],
            [{"pos": [10, 10], "text": "test"}],
            finishes=[{"polygon": [[0, 0], [100, 0], [100, 60], [0, 60]], "kind": "frijnen_v", "strokes_per_10cm": 12}],
            sketches=[{"points": [[0, 0], [50, 50]], "arrow": True, "text": "scheur", "style": "dashed"}])
        dr = self.project.drawing()
        svg = drawing_to_svg(dr)
        self.assertIn('width="', svg); self.assertIn("<path", svg); self.assertIn("W: 301.5", svg); self.assertIn("?", svg)
        self.assertIn("productietekening", svg); self.assertIn("gefrijnd verticaal, 12 slagen/10 cm", svg); self.assertIn("Bentheimer", svg)
        self.assertNotIn("(foto ", svg); self.assertNotIn("(photo ", svg)
        pdf = drawing_to_pdf(dr)
        self.assertTrue(pdf.startswith(b"%PDF-1.4")); self.assertIn(b"301.5", pdf); self.assertIn(b"NIET OP SCHAAL", pdf)
        csv_txt = dimensions_csv(dr)
        self.assertIn("D1;W;horizontal;301.5;", csv_txt); self.assertIn("F1;gefrijnd verticaal, 12 slagen/10 cm", csv_txt)
        import ezdxf
        for version in ("R2010", "R12"):
            path = os.path.join(self.tmp.name, f"t-{version}.dxf")
            drawing_to_dxf(dr, path, version=version)
            doc = ezdxf.readfile(path)
            layers = {e.dxf.layer for e in doc.modelspace()}
            self.assertIn("OUTLINE", layers); self.assertIn("FINISH", layers); self.assertIn("SKETCH", layers)
        img = drawing_to_png(dr, px_per_mm=2)
        self.assertEqual(img.ndim, 3)
        self.project.set_annotations([], [], finishes=[], sketches=[])

    def test_views_combined(self):
        from pvsketch.views import combine, translate_drawing
        main = self.project.drawing()
        side = translate_drawing(main, 500, 300)
        comb = combine(main, [("side", side)], "nl")
        bb_main = main.outline_bbox(); bb = comb.outline_bbox()
        self.assertGreater(bb[2] - bb[0], 2 * (bb_main[2] - bb_main[0]))
        self.assertAlmostEqual(bb[1], bb_main[1], delta=0.01)
        self.assertTrue(any(l.text == "Zijaanzicht" for l in comb.labels))
        self.assertEqual(drawing_to_svg(comb).count(" Z M "), 1)

    def test_templates(self):
        from pvsketch.templates import checklist_from_template, ELEMENT_TEMPLATES, templates_json
        cl = checklist_from_template("raamdorpel")
        self.assertTrue(any(c["key"] == "lengte" for c in cl)); self.assertIn("vrij", ELEMENT_TEMPLATES)
        self.assertEqual(templates_json("en")[0]["items"][0]["hint"], "incl. built-in tails")


class ServerTest(unittest.TestCase):
    def test_api_roundtrip(self):
        from pvsketch.server.app import create_app
        with tempfile.TemporaryDirectory() as tmp:
            photo = os.path.join(tmp, "s.jpg"); truth = make(photo)
            app = create_app(workspace=os.path.join(tmp, "ws")); app.testing = True
            c = app.test_client()
            self.assertEqual(c.get("/").status_code, 200)
            self.assertEqual(c.get("/healthz").status_code, 200)
            with open(photo, "rb") as f:
                r = c.post("/api/projects", data={"photo": (f, "s.jpg")}, content_type="multipart/form-data")
            self.assertEqual(r.status_code, 200, r.data); st = r.get_json(); pid = st["id"]
            self.assertEqual(st["lang"], "nl"); self.assertFalse(st["calibration"]["scaled"])
            poly = truth["stone_polygon_px"][::4]
            r = c.post(f"/api/projects/{pid}/segment", json={"polygon": poly, "strokes": [{"kind": "erase", "pts": [[1, 1]], "r": 5}], "band_px": 25})
            self.assertEqual(r.status_code, 200, r.data)
            r = c.post(f"/api/projects/{pid}/outline", json={"params": {"epsilon_mm": 1.0}}); self.assertEqual(r.status_code, 200, r.data)
            bb = r.get_json()["bbox"]
            r = c.put(f"/api/projects/{pid}/outline", json={"outline": r.get_json()["outline"]}); self.assertEqual(r.status_code, 200)
            # template + measurement + scale
            self.assertEqual(c.get("/api/templates?lang=nl").get_json()[0]["name"], "Raamdorpel")
            cl = c.put(f"/api/projects/{pid}/template", json={"template": "raamdorpel"}).get_json()["checklist"]
            cl[1]["value_mm"] = 240
            r = c.put(f"/api/projects/{pid}/annotations", json={"dimensions": [{"p1": [bb[0], bb[3]], "p2": [bb[2], bb[3]], "kind": "horizontal", "manual_mm": 300, "label": "lengte"}], "labels": [], "checklist": cl})
            self.assertEqual(r.status_code, 200, r.data); self.assertEqual(r.get_json()["checklist"][1]["value_mm"], 240)
            r = c.put(f"/api/projects/{pid}/scale", json={"index": 0, "mm": 300})
            self.assertEqual(r.status_code, 200, r.data); self.assertTrue(r.get_json()["calibration"]["scaled"])
            bb2 = r.get_json()["drawing"]["bbox"]; self.assertAlmostEqual(bb2[2] - bb2[0], 300, delta=0.5)
            self.assertEqual(c.put(f"/api/projects/{pid}/scale", json={"index": 7, "mm": 300}).status_code, 400)
            # finishes list has the new kinds
            kinds = {f["kind"] for f in c.get("/api/finishes").get_json()}
            for k in ("frijnen_v", "frijnen_h", "kathedraal", "kathedraal_vrij", "randslag"):
                self.assertIn(k, kinds)
            r = c.patch(f"/api/projects/{pid}", json={"lang": "nl", "titleblock": {"project": "P1", "bogus": "x"}})
            self.assertEqual(r.get_json()["titleblock"], {"project": "P1"})
            for fmt in ("svg", "dxf", "dxf?version=R12", "png", "jpg", "json", "pdf", "pdf?paper=a4", "csv"):
                self.assertEqual(c.get(f"/api/projects/{pid}/export.{fmt}").status_code, 200, fmt)
            self.assertIn("240", c.get(f"/api/projects/{pid}/export.csv").data.decode("utf-8-sig"))
            self.assertEqual(c.get(f"/api/projects/{pid}/image/overlay").status_code, 200)
            # removed features are gone
            for url in ("/api/board/a3.pdf", "/api/cameras", "/api/checkerboard.pdf", "/api/marker/0.png", "/api/ai"):
                self.assertEqual(c.get(url).status_code, 404, url)
            self.assertEqual(c.post(f"/api/projects/{pid}/calibrate", json={}).status_code, 404)
            # views
            with open(photo, "rb") as f:
                pid2 = c.post("/api/projects", data={"photo": (f, "side.jpg")}, content_type="multipart/form-data").get_json()["id"]
            c.post(f"/api/projects/{pid2}/segment", json={"polygon": poly}); c.post(f"/api/projects/{pid2}/outline", json={})
            r = c.patch(f"/api/projects/{pid}", json={"views": [{"project": pid2, "name": "side"}, {"project": "bogus", "name": "x"}]})
            self.assertEqual(len(r.get_json()["views"]), 1)
            self.assertIn("Zijaanzicht", c.get(f"/api/projects/{pid}/export.svg?lang=nl").data.decode())
            self.assertEqual(c.post("/api/projects/sample").status_code, 200)


if __name__ == "__main__":
    unittest.main()
