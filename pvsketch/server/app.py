"""Local, offline web UI. Everything runs on this machine; no external calls."""
from __future__ import annotations

import io
import os
from typing import Any

import cv2
import numpy as np
from flask import Flask, abort, jsonify, render_template, request, send_file

from .. import calibrate as cal_mod
from .. import segment as seg_mod
from ..export_dxf import drawing_to_dxf
from ..export_pdf import drawing_to_pdf
from ..export_svg import drawing_to_png, drawing_to_svg
from ..export_table import dimensions_csv
from ..project import DEFAULT_WORKSPACE, Project

MAX_UPLOAD_MB = 60


def _png_response(img: np.ndarray, jpeg: bool = False):
    ext, params = (".jpg", [cv2.IMWRITE_JPEG_QUALITY, 88]) if jpeg else (".png", [])
    ok, buf = cv2.imencode(ext, img, params)
    if not ok:
        abort(500)
    return send_file(io.BytesIO(buf.tobytes()), mimetype="image/jpeg" if jpeg else "image/png")


def create_app(workspace: str | None = None) -> Flask:
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config["WORKSPACE"] = os.path.abspath(workspace or DEFAULT_WORKSPACE)
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024
    os.makedirs(app.config["WORKSPACE"], exist_ok=True)

    def load(pid: str) -> Project:
        try:
            return Project.load(pid, app.config["WORKSPACE"])
        except FileNotFoundError:
            abort(404)

    def err(msg: str, code: int = 400):
        return jsonify({"error": msg}), code

    # ------------------------------------------------------------- pages
    @app.get("/")
    def index():
        return render_template("index.html", sheets=cal_mod.REFERENCE_SHEETS)

    # ---------------------------------------------------------- projects
    @app.get("/api/projects")
    def list_projects():
        return jsonify(Project.list_all(app.config["WORKSPACE"]))

    @app.post("/api/projects")
    def create_project():
        f = request.files.get("photo")
        if f is None or not f.filename:
            return err("no photo uploaded")
        try:
            p = Project.create(f.read(), f.filename, app.config["WORKSPACE"])
        except ValueError as e:
            return err(str(e))
        return jsonify(p.state)

    @app.get("/api/projects/<pid>")
    def get_project(pid):
        return jsonify(load(pid).state)

    @app.patch("/api/projects/<pid>")
    def patch_project(pid):
        p = load(pid)
        body = request.get_json(force=True) or {}
        if "name" in body:
            p.state["name"] = str(body["name"])[:80]
        p.save()
        return jsonify(p.state)

    @app.get("/api/projects/<pid>/image/<kind>")
    def project_image(pid, kind):
        p = load(pid)
        if kind == "original":
            return _png_response(p.original(), jpeg=True)
        if kind == "rectified":
            if not p.calibration:
                abort(404)
            return _png_response(p.rectified(), jpeg=True)
        if kind == "mask":
            m = p.mask()
            if m is None:
                abort(404)
            return _png_response(m)
        if kind == "overlay":
            m = p.mask()
            if m is None:
                abort(404)
            return _png_response(seg_mod.overlay(p.rectified(), m), jpeg=True)
        if kind == "preview":
            dr = p.drawing()
            return _png_response(drawing_to_png(dr, px_per_mm=3, background=p.rectified()))
        abort(404)

    # ------------------------------------------------------- calibration
    @app.post("/api/projects/<pid>/calibrate")
    def calibrate(pid):
        p = load(pid)
        b: dict[str, Any] = request.get_json(force=True) or {}
        mode = b.get("mode", "quad")
        ppm = b.get("ppm")
        ppm = float(ppm) if ppm else None
        try:
            if mode == "quad":
                pts = b.get("points") or []
                if len(pts) != 4:
                    return err("click the 4 corners of the reference")
                sheet = (b.get("sheet") or "custom").lower()
                if sheet in cal_mod.REFERENCE_SHEETS:
                    cal = p.calibrate_sheet(pts, sheet, ppm)
                else:
                    w, h = float(b["width_mm"]), float(b["height_mm"])
                    if w <= 0 or h <= 0:
                        return err("reference size must be positive")
                    cal = p.calibrate_quad(pts, w, h, ppm)
            elif mode == "aruco":
                cal = p.calibrate_aruco(float(b.get("marker_mm", 100)), b.get("marker_id"), ppm)
            elif mode == "two_point":
                pts = b.get("points") or []
                if len(pts) != 2:
                    return err("click 2 points")
                cal = p.calibrate_two_point(pts[0], pts[1], float(b["dist_mm"]))
            else:
                return err("unknown mode")
        except (ValueError, KeyError, cv2.error) as e:
            return err(f"calibration failed: {e}")
        return jsonify({"calibration": cal.to_dict(), "state": p.state})

    @app.get("/api/projects/<pid>/aruco")
    def aruco(pid):
        p = load(pid)
        return jsonify(cal_mod.detect_aruco(p.original()))

    # ------------------------------------------------------ segmentation
    @app.post("/api/projects/<pid>/segment")
    def segment(pid):
        p = load(pid)
        if not p.calibration:
            return err("calibrate first")
        b = request.get_json(force=True) or {}
        rect = b.get("rect")
        polygon = b.get("polygon") or []
        mode = b.get("mode", "grabcut")
        if rect and (len(rect) != 4 or rect[2] < 4 or rect[3] < 4):
            rect = None
        if not rect and len(polygon) < 3:
            return err("drag a box around the stone or click points along its outer line first")
        try:
            m = p.segment(rect, b.get("fg", []), b.get("bg", []), int(b.get("brush_px", 8)), int(b.get("iters", 5)),
                          strokes=b.get("strokes"), polygon=polygon, band_px=float(b.get("band_px", 20)), mode=mode)
        except (cv2.error, ValueError) as e:
            return err(f"segmentation failed: {e}")
        return jsonify({"mask_px": int((m > 0).sum()), "state": p.state})

    # ----------------------------------------------------------- outline
    @app.post("/api/projects/<pid>/outline")
    def outline(pid):
        p = load(pid)
        if p.mask() is None:
            return err("segment first")
        b = request.get_json(force=True) or {}
        try:
            dr = p.outline(b.get("params"))
        except (ValueError, RuntimeError) as e:
            return err(str(e))
        return jsonify(dr)

    @app.put("/api/projects/<pid>/outline")
    def put_outline(pid):
        p = load(pid)
        b = request.get_json(force=True) or {}
        try:
            return jsonify(p.set_outline(b.get("outline") or []))
        except (KeyError, ValueError, TypeError) as e:
            return err(f"bad outline: {e}")

    @app.get("/api/projects/<pid>/drawing")
    def drawing(pid):
        p = load(pid)
        if not p.calibration:
            return err("calibrate first")
        return jsonify(p.drawing().to_dict())

    # ------------------------------------------------------- annotations
    @app.put("/api/projects/<pid>/annotations")
    def annotations(pid):
        p = load(pid)
        b = request.get_json(force=True) or {}
        p.set_annotations(b.get("dimensions", []), b.get("labels", []))
        return jsonify(p.drawing().to_dict())

    # ------------------------------------------------------------ export
    @app.get("/api/projects/<pid>/export.<fmt>")
    def export(pid, fmt):
        p = load(pid)
        if not p.calibration:
            return err("nothing to export yet")
        dr = p.drawing()
        name = (p.state.get("name") or p.id)
        with_photo = request.args.get("photo") == "1"
        if fmt == "svg":
            svg = drawing_to_svg(dr, background=p.rectified() if with_photo else None)
            return send_file(io.BytesIO(svg.encode("utf-8")), mimetype="image/svg+xml",
                             as_attachment=True, download_name=f"{name}.svg")
        if fmt == "dxf":
            version = "R12" if request.args.get("version", "").upper() == "R12" else "R2010"
            path = os.path.join(p.dir, f"export-{version}.dxf")
            drawing_to_dxf(dr, path, version=version)
            return send_file(path, mimetype="application/dxf", as_attachment=True,
                             download_name=f"{name}{'-r12' if version == 'R12' else ''}.dxf")
        if fmt == "pdf":
            paper = request.args.get("paper", "auto").lower()
            if paper not in ("auto", "a4", "a3"):
                paper = "auto"
            return send_file(io.BytesIO(drawing_to_pdf(dr, paper=paper)), mimetype="application/pdf",
                             as_attachment=True, download_name=f"{name}.pdf")
        if fmt == "csv":
            return send_file(io.BytesIO(dimensions_csv(dr).encode("utf-8-sig")), mimetype="text/csv",
                             as_attachment=True, download_name=f"{name}-measurements.csv")
        if fmt == "png":
            img = drawing_to_png(dr, px_per_mm=4, background=p.rectified() if with_photo else None)
            ok, buf = cv2.imencode(".png", img)
            return send_file(io.BytesIO(buf.tobytes()), mimetype="image/png", as_attachment=True,
                             download_name=f"{name}.png")
        if fmt == "json":
            return send_file(p.json_path, mimetype="application/json", as_attachment=True,
                             download_name=f"{name}.pvsketch.json")
        abort(404)

    # ------------------------------------------------------------ marker
    @app.get("/api/marker/<int:mid>.png")
    def marker(mid):
        size = float(request.args.get("size_mm", 100))
        img, dpi = cal_mod.marker_image(mid, size)
        from PIL import Image
        buf = io.BytesIO()
        Image.fromarray(img).save(buf, format="PNG", dpi=(dpi, dpi))
        buf.seek(0)
        return send_file(buf, mimetype="image/png", as_attachment=True, download_name=f"pvsketch-marker-{mid}-{size:g}mm.png")

    return app


app = None  # created lazily by `python -m pvsketch serve`
