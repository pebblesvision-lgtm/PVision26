# pvsketch — photo to true-scale production outline (offline)

Turns a photo of a stone element into a **clean outer contour at real scale in
millimetres**, exported as **SVG and DXF**, with a click-to-measure overlay on
which hand-measured values are registered. Built for restoration work: the aim
is a production drawing you can put dimensions on, not a pencil-sketch effect.

Everything runs locally. No model downloads, no cloud calls.

```
photo ──► 1 calibrate ──► 2 isolate ──► 3 outline ──► 4 measure ──► SVG / DXF (mm)
          (A4 / marker)   (GrabCut)     (lines+arcs)  (register tape values)
```

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m pvsketch serve
```

Open <http://127.0.0.1:5000>. Projects are stored in `./workspace/` (override
with `--workspace DIR` or `PVSKETCH_WORKSPACE`).

Try it without a real stone first:

```bash
python samples/make_sample.py samples/sample.jpg
```

then upload `samples/sample.jpg`: it is a synthetic 300 × 180 mm stone with
R90 corners and a 40 mm notch next to an A4 sheet, seen obliquely.

## Run it as a web app (for testing from any device)

The same app runs on a server; nothing changes except the launcher. Set
`PVSKETCH_PASSWORD` so only you can reach it (any user name, that password),
and `PVSKETCH_RETENTION_DAYS` so test projects are pruned.

**Render.com, free, from this repository (about 5 minutes):**

1. Sign in at <https://render.com> with your GitHub account.
2. *New +* → *Blueprint* → pick `pebblesvision-lgtm/PVision26`. Render reads
   `render.yaml` and asks for the password. Deploy.
3. Open the URL Render gives you (`https://pvsketch-xxxx.onrender.com`).
   The first request after 15 minutes idle takes ~1 minute: the free plan
   sleeps. Every `git push` to the branch redeploys automatically.

Free hosting has no persistent disk: projects vanish on redeploy or after
sleep. Download the *Project JSON* or the exports you want to keep. For real
use, run it on a machine of your own (the Docker image below, or the Quick
start above) where the `workspace` folder stays.

**Cloudflare (recommended if you already use it).** Cloudflare Pages/Workers
cannot run this app (it needs Python + OpenCV on a real CPU), but a
**Cloudflare Tunnel** publishes the app running on your own Mac, NAS or a small
VPS on your own domain, with Cloudflare Access in front for login. Projects stay
on your machine. `docker-compose.yml` has both containers:

1. Cloudflare dashboard → Zero Trust → Networks → Tunnels → *Create a tunnel*
   (Cloudflared). Copy the token.
2. Public hostname: `sketch.yourdomain.nl` → service `http://pvsketch:8000`.
3. Copy `.env.example` to `.env`, fill in the token and a password, then:

```bash
docker compose up -d --build
```

4. Optional: Zero Trust → Access → Applications → add `sketch.yourdomain.nl`
   with a policy "e-mail ends with @yourcompany.nl". Then the basic-auth
   password is a second lock behind Cloudflare's login.

Without Docker, the quick way to try it is to run the app locally and
`brew install cloudflared && cloudflared tunnel --url http://localhost:5000`,
which prints a temporary public URL (set `PVSKETCH_PASSWORD` first).

**Any Docker host** (Fly.io, Railway, Hugging Face Spaces, a NAS, a VPS):

```bash
docker build -t pvsketch .
```

```bash
docker run -p 8000:8000 -e PVSKETCH_PASSWORD=choose-one -v $PWD/workspace:/data/workspace pvsketch
```

Then open <http://localhost:8000>. The `-v` keeps projects on the host disk.

## Language

The interface switches between English and Nederlands with the EN/NL control
top right. The language is also stored per project and used for the exported
drawings (title block, "foto" in dimensions, finish names).

## How to photograph

Measurements only come out right when the reference and the face you measure
lie **in the same plane**.

1. Lay an **A4 sheet** flat on the stone face (or next to it, on the same
   plane), or a printed **ArUco marker** (`python -m pvsketch marker --size 100`,
   print at 100 %, check with a ruler). A ruler works too with the two-point
   mode, but that mode does no perspective correction.
2. Shoot as square-on as you can, with the whole stone and the reference in
   frame, in flat light. Oblique shots are rectified, but accuracy drops with
   the angle and with distance from the reference.
3. Features that stand out of the plane (a moulding, a broken edge angled
   away) will be foreshortened. Measure those by hand and register the value.

## The steps in the app

| Step | What happens | Notes |
|---|---|---|
| 1 Photo | Upload JPEG/PNG (60 MB cap) | Earlier projects are listed to reopen |
| 2 Calibrate | Click the 4 corners of the sheet, or Detect the marker | Homography → rectified image at a fixed px/mm. Any corner order; portrait/landscape auto |
| 3 Isolate | **Points**: click along the outer line (roughly), Run | GrabCut only looks for the exact edge inside a band around your points, so grey stone on a grey wall works. Or drag a **Box**. Correct with *stone* / *background* brushes and the **Eraser**; undo/redo everything. Tick *use the points exactly* to skip GrabCut |
| 4 Outline | Douglas-Peucker simplification + least-squares **arc fitting** | Tolerance in mm, minimum arc radius/length so weathering bumps don't become arcs. **Edit vertices**: drag, double-click to add, Alt+click to delete (an arc becomes a line). Optional *detail* layer: Canny inside the stone after grain smoothing |
| 5 Measure | Click 2 points → **aligned / horizontal / vertical** dimension (snaps to corners) | **Drag the dimension line** away from the stone, CAD-style, with extension lines. Solid / dashed / dotted. *Tidy up* fans them out. Type the **tape value** to register it; the drawing shows it with the photo value in brackets. D1…Dn numbering matches the table, CSV and PDF |
| 6 Draw | **Finish regions** (bewerkingen) and free lines | Click a polygon on the face and pick the finish: gefrijnd, gescharreerd, gegradineerd, gebouchardeerd, gespitst, randslag, gezoet, gepolijst, gezaagd, gevlamd, geschuurd. It is hatched with the matching pattern (direction and spacing adjustable), labelled F1…Fn and listed in the title block. Lines/arrows/leader text in solid, dashed or dotted |
| 7 Export | DXF 2010, DXF R12, SVG, **PDF at true scale** (A4/A3 auto, 1:2 / 1:5 when it doesn't fit), CSV of measurements, PNG, JSON | All in mm. DXF: layers `OUTLINE`, `DETAIL`, `DIM`, `TEXT`, `$INSUNITS` = mm. R12 uses POLYLINE and exploded dimensions for old CAM/CAD software |

Viewer: wheel = zoom, right-drag (or shift-drag) = pan, `f` = fit, `Esc` = cancel,
Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z redo. Isolate shortcuts: `p` points, `b` box,
`s` stone brush, `g` background brush, `e` eraser, Backspace removes the last point.

### Importing into stone software

The DXF is the file to take into CAD/CAM. Try the 2010 version first; if the
program complains, use the R12 one. Outline on layer `OUTLINE` as polylines and
true arcs, measurements on `DIM`. The PDF is for the workshop and the project
file, the CSV for a spreadsheet or a price calculation.

## Headless / batch

```bash
# A4 corners known (x1,y1,...,x4,y4 in the photo), box around the stone in rectified px
python -m pvsketch run photo.jpg --sheet a4 --corners 205,241,736,230,667,1005,147,989 --rect 950,400,770,470 --detail --out out/

# printed 100 mm marker in the photo, auto-detected
python -m pvsketch run photo.jpg --aruco 100 --out out/

# re-export a project from the web app
python -m pvsketch export 20261030-221034-b22fff --out out/ --with-photo
```

## Accuracy on the synthetic sample

| quantity | truth | measured |
|---|---|---|
| width | 300 mm | 300.6–301.1 mm |
| height | 180 mm | 180.4–181.2 mm |
| corner radius | 90 mm | 89.6–89.9 mm |

The ~0.5 mm excess is the mask edge sitting half a pixel outside the true
edge at 2.5 px/mm; a closer photo (more px/mm) shrinks it. Real stone will
be worse than this: expect a few mm over a 300 mm piece from a careful
square-on photo, which is why hand-measured values are registered on top.

## Layout

```
pvsketch/
  calibrate.py   homography from quad / ArUco / two points; marker generator
  segment.py     GrabCut guided by box / polygon band, ordered strokes with eraser
  contour.py     outer contour → simplify → lines + arcs; detail edge tracing
  geometry.py    Polyline / Arc / Dimension / Label / Drawing (mm, y-down)
  export_svg.py  SVG at 1 unit = 1 mm with title block and scale bar; PNG preview
  export_dxf.py  DXF via ezdxf (y flipped to CAD y-up), R2010 or R12
  export_pdf.py  dependency-free vector PDF at true scale with title block + table
  export_table.py CSV of the registered measurements
  hatch.py       hatch patterns for hand finishes (lines, groups, dots, strokes, edge ticks)
  i18n.py        strings for exported drawings (en/nl) and finish names
  project.py     per-project folder: original, rectified.jpg, mask.png, project.json
  server/        Flask API + single-page UI (vanilla JS, no CDN, works offline)
  __main__.py    serve / run / export / marker
Dockerfile, render.yaml, docker-compose.yml   web deployment (gunicorn, password, Cloudflare Tunnel)
samples/make_sample.py   synthetic test photo with ground truth
tests/test_pipeline.py   end-to-end checks (python -m unittest)
```

## Why not the two starting-point projects

*DoodlePic* gives a pencil-shading effect (divide-blend of a blurred inverse),
no geometry and no vector output. *Image-To-Drawing* re-implements Canny and
XDoG in PyTorch, its flow-based XDoG is a stub, and its main script imports a
model and weights that are not in the repository. Neither can produce a
measurable contour. This project uses OpenCV's own Canny/GrabCut and adds the
parts that matter for production drawings: metric calibration, arc fitting,
dimension registration and CAD export.

## Known limits

- One plane per calibration. For a return or a second face, take a second photo.
- GrabCut needs some colour/texture contrast between stone and background; use the brushes when it fails.
- Detail lines are a visual aid, not geometry you should machine from.
- HEIC photos from iPhones must be converted to JPEG first.
