"""Command line entry points.

    python -m pvsketch serve [--host 127.0.0.1] [--port 5000]
    python -m pvsketch run photo.jpg --rect x,y,w,h --width-mm 1240 --out out/
    python -m pvsketch export <project-id> --out out/
"""
from __future__ import annotations

import argparse
import os
import sys

import cv2


def _floats(s: str) -> list[float]:
    return [float(v) for v in s.replace(";", ",").split(",") if v.strip()]


def cmd_serve(a: argparse.Namespace) -> int:
    from .server.app import create_app
    app = create_app(workspace=a.workspace)
    print(f"pvsketch running at http://{a.host}:{a.port}/  (workspace: {app.config['WORKSPACE']})")
    app.run(host=a.host, port=a.port, debug=a.debug, threaded=True)
    return 0


def _export_all(project, out_dir: str, with_photo: bool) -> None:
    from .export_dxf import drawing_to_dxf
    from .export_svg import drawing_to_png, drawing_to_svg
    os.makedirs(out_dir, exist_ok=True)
    dr = project.drawing()
    base = os.path.join(out_dir, project.state.get("name") or project.id)
    bg = project.rectified() if with_photo else None
    with open(base + ".svg", "w", encoding="utf-8") as f:
        f.write(drawing_to_svg(dr, background=bg))
    drawing_to_dxf(dr, base + ".dxf")
    cv2.imwrite(base + ".png", drawing_to_png(dr, background=project.rectified()))
    bb = dr.outline_bbox()
    print(f"wrote {base}.svg / .dxf / .png")
    if bb:
        print(f"outline bbox: {bb[2]-bb[0]:.1f} x {bb[3]-bb[1]:.1f} mm")


def cmd_run(a: argparse.Namespace) -> int:
    """Headless: photo -> outline -> (optional scale by typed width) -> exports."""
    from .project import Project
    p = Project.from_path(a.photo, root=a.workspace)
    W, H = p.calibration.out_size
    if a.rect:
        rect = _floats(a.rect)
    else:
        rect = [W * 0.05, H * 0.05, W * 0.9, H * 0.9]
        print("no --rect given: using 90% of the frame as the GrabCut box")
    p.segment(rect, iters=a.iters)
    p.outline({"epsilon_mm": a.epsilon, "arc_fit": not a.no_arcs, "detail": {"enabled": a.detail}})
    if a.width_mm:
        bb = p.drawing().outline_bbox()
        p.set_annotations([{"p1": [bb[0], bb[3]], "p2": [bb[2], bb[3]], "kind": "horizontal", "label": "breedte", "manual_mm": a.width_mm}], [])
        p.scale_from_dimension(0, a.width_mm)
        print(f"scaled: outline width = {a.width_mm:g} mm (typed)")
    _export_all(p, a.out, with_photo=a.with_photo)
    return 0


def cmd_export(a: argparse.Namespace) -> int:
    from .project import Project
    p = Project.load(a.project, root=a.workspace)
    _export_all(p, a.out, with_photo=a.with_photo)
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="pvsketch", description="photo -> true-scale stone outline (offline)")
    ap.add_argument("--workspace", default=None, help="folder for projects (default ./workspace)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("serve", help="start the local web app")
    s.add_argument("--host", default="127.0.0.1"); s.add_argument("--port", type=int, default=5000)
    s.add_argument("--debug", action="store_true"); s.set_defaults(fn=cmd_serve)

    r = sub.add_parser("run", help="headless: photo -> svg/dxf/png")
    r.add_argument("photo")
    r.add_argument("--rect", default=None, help="x,y,w,h GrabCut box in working-image px")
    r.add_argument("--width-mm", type=float, default=None, help="typed overall width: sets the drawing scale")
    r.add_argument("--iters", type=int, default=5)
    r.add_argument("--epsilon", type=float, default=1.0, help="simplification tolerance mm")
    r.add_argument("--no-arcs", action="store_true")
    r.add_argument("--detail", action="store_true", help="add Canny detail layer")
    r.add_argument("--with-photo", action="store_true", help="embed the rectified photo in the SVG")
    r.add_argument("--out", default="out"); r.set_defaults(fn=cmd_run)

    e = sub.add_parser("export", help="export an existing project")
    e.add_argument("project"); e.add_argument("--out", default="out"); e.add_argument("--with-photo", action="store_true")
    e.set_defaults(fn=cmd_export)

    a = ap.parse_args(argv)
    if a.workspace is None:
        from .project import DEFAULT_WORKSPACE
        a.workspace = DEFAULT_WORKSPACE
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
