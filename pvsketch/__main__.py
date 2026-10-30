"""Command line entry points.

    python -m pvsketch serve [--host 127.0.0.1] [--port 5000]
    python -m pvsketch marker --id 0 --size 100 --out marker.png
    python -m pvsketch run photo.jpg --sheet a4 --corners x1,y1,x2,y2,x3,y3,x4,y4 --rect x,y,w,h --out out/
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


def cmd_marker(a: argparse.Namespace) -> int:
    from PIL import Image
    from .calibrate import marker_image
    img, dpi = marker_image(a.id, a.size, dpi=a.dpi)
    Image.fromarray(img).save(a.out, dpi=(dpi, dpi))
    print(f"wrote {a.out}: ArUco id {a.id}, {a.size:g} mm at {dpi} dpi. Print at 100% / 'actual size'.")
    return 0


def cmd_board(a: argparse.Namespace) -> int:
    from .board import board_pdf
    with open(a.out, "wb") as f:
        f.write(board_pdf(a.paper))
    print(f"wrote {a.out}: {a.paper.upper()} calibration board. Print at 100%, check the 100 mm bar, glue flat on foam board.")
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
    from .project import Project
    p = Project.from_path(a.photo, root=a.workspace)
    if a.board:
        cal = p.calibrate_board(a.board)
    elif a.aruco is not None:
        cal = p.calibrate_aruco(a.aruco, a.marker_id)
    elif a.corners:
        c = _floats(a.corners)
        if len(c) != 8:
            print("--corners needs 8 numbers: x1,y1,...,x4,y4", file=sys.stderr); return 2
        quad = [c[i:i + 2] for i in range(0, 8, 2)]
        if a.ref_mm:
            w, h = _floats(a.ref_mm)
            cal = p.calibrate_quad(quad, w, h)
        else:
            cal = p.calibrate_sheet(quad, a.sheet)
    elif a.two_point:
        c = _floats(a.two_point)
        cal = p.calibrate_two_point(c[0:2], c[2:4], c[4])
    else:
        print("need one of --aruco SIZE_MM, --corners ..., --two-point x1,y1,x2,y2,dist_mm", file=sys.stderr)
        return 2
    print(f"project {p.id}: {cal.note}; rectified {cal.out_size[0]}x{cal.out_size[1]} px, {cal.ppm:.2f} px/mm")
    if a.rect:
        rect = _floats(a.rect)
    else:
        W, H = cal.out_size
        rect = [W * 0.05, H * 0.05, W * 0.9, H * 0.9]
        print("no --rect given: using 90% of the rectified frame as the GrabCut box")
    p.segment(rect, iters=a.iters)
    p.outline({"epsilon_mm": a.epsilon, "arc_fit": not a.no_arcs,
               "detail": {"enabled": a.detail}})
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

    m = sub.add_parser("marker", help="write a printable ArUco marker PNG")
    m.add_argument("--id", type=int, default=0); m.add_argument("--size", type=float, default=100.0, help="mm")
    m.add_argument("--dpi", type=int, default=300); m.add_argument("--out", default="pvsketch-marker.png")
    m.set_defaults(fn=cmd_marker)

    bd = sub.add_parser("board", help="write the printable A3/A4 marker board (PDF, true scale)")
    bd.add_argument("--paper", default="a3", choices=["a3", "a4"]); bd.add_argument("--out", default="pvsketch-board-a3.pdf")
    bd.set_defaults(fn=cmd_board)

    r = sub.add_parser("run", help="headless: photo -> svg/dxf/png")
    r.add_argument("photo")
    r.add_argument("--sheet", default="a4", choices=["a5", "a4", "a3", "letter"])
    r.add_argument("--ref-mm", default=None, help="custom reference W,H in mm (with --corners)")
    r.add_argument("--corners", default=None, help="x1,y1,x2,y2,x3,y3,x4,y4 of the reference in the photo")
    r.add_argument("--aruco", type=float, default=None, help="marker side in mm; auto-detect the marker")
    r.add_argument("--board", default=None, choices=["a3", "a4"], help="auto-detect the printed marker board")
    r.add_argument("--marker-id", type=int, default=None)
    r.add_argument("--two-point", default=None, help="x1,y1,x2,y2,dist_mm (scale only)")
    r.add_argument("--rect", default=None, help="x,y,w,h GrabCut box in rectified px")
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
