"""Assemble the static web app for Cloudflare Pages into ./cloudflare/ (and a zip next to it).

    python tools/build_cloudflare.py            # build folder + zip
    python tools/build_cloudflare.py --no-zip

The folder is exactly what you upload (drag the folder or the zip into
Cloudflare Pages -> Create -> Upload assets). No server code: the Python
engine is replaced by the JavaScript engine in web/engine, running in a Web
Worker with OpenCV.js; projects are stored in the browser (IndexedDB).
"""
import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "cloudflare")
STATIC = os.path.join(ROOT, "pvsketch", "server", "static")
TEMPLATE = os.path.join(ROOT, "pvsketch", "server", "templates", "index.html")
WEB = os.path.join(ROOT, "web")
OPENCV_NPM = os.path.join(WEB, "node_modules", "@techstark", "opencv-js", "dist", "opencv.js")


def find_opencv() -> str:
    cand = [os.environ.get("OPENCV_JS", ""), OPENCV_NPM, os.path.join(OUT, "vendor", "opencv.js")]
    for c in cand:
        if c and os.path.isfile(c):
            return c
    print("OpenCV.js not found; running `npm install` in web/ ...")
    subprocess.check_call(["npm", "install", "--prefix", WEB])
    return OPENCV_NPM


def icon(size: int, path: str) -> None:
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (size, size), (31, 36, 42))
    d = ImageDraw.Draw(im)
    m = size // 8
    d.rounded_rectangle([m, m, size - m, size - m], radius=size // 6, outline=(242, 169, 59), width=max(3, size // 32))
    # a small arched stone outline
    w = size - 4 * m
    x0, y0 = 2 * m, 2 * m
    d.arc([x0, y0, x0 + w, y0 + w], 180, 360, fill=(255, 231, 106), width=max(3, size // 40))
    d.line([x0, y0 + w // 2, x0, y0 + w], fill=(255, 231, 106), width=max(3, size // 40))
    d.line([x0 + w, y0 + w // 2, x0 + w, y0 + w], fill=(255, 231, 106), width=max(3, size // 40))
    d.line([x0, y0 + w, x0 + w, y0 + w], fill=(255, 231, 106), width=max(3, size // 40))
    im.save(path)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-zip", action="store_true")
    a = ap.parse_args()

    subprocess.check_call([sys.executable, os.path.join(ROOT, "tools", "gen_engine_data.py")])
    opencv = find_opencv()
    keep_opencv = os.path.join(ROOT, "_opencv_tmp.js")
    shutil.copyfile(opencv, keep_opencv)               # OUT may contain the previous copy
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(os.path.join(OUT, "vendor"))
    os.makedirs(os.path.join(OUT, "engine"))
    shutil.move(keep_opencv, os.path.join(OUT, "vendor", "opencv.js"))

    for f in ("app.css", "app.js"):
        shutil.copyfile(os.path.join(STATIC, f), os.path.join(OUT, f))
    for f in os.listdir(os.path.join(WEB, "engine")):
        shutil.copyfile(os.path.join(WEB, "engine", f), os.path.join(OUT, "engine", f))
    for f in ("worker.js", "shim.js"):
        shutil.copyfile(os.path.join(WEB, f), os.path.join(OUT, f))
    shutil.copyfile(os.path.join(ROOT, "samples", "sample.jpg"), os.path.join(OUT, "sample.jpg"))

    html = open(TEMPLATE, encoding="utf-8").read()
    html = re.sub(r"\{\{\s*url_for\('static',\s*filename='([^']+)'\)\s*\}\}", r"\1", html)
    html = html.replace('<link rel="stylesheet" href="app.css">',
                        '<link rel="stylesheet" href="app.css">\n<link rel="manifest" href="manifest.webmanifest">\n'
                        '<meta name="theme-color" content="#1f242a">\n<meta name="apple-mobile-web-app-capable" content="yes">\n'
                        '<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
                        '<link rel="apple-touch-icon" href="icon-192.png">')
    html = html.replace('<script src="app.js"></script>', '<script src="shim.js"></script>\n<script src="app.js"></script>')
    assert "shim.js" in html and "manifest.webmanifest" in html, "template markers changed; update tools/build_cloudflare.py"
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)

    icon(192, os.path.join(OUT, "icon-192.png"))
    icon(512, os.path.join(OUT, "icon-512.png"))
    open(os.path.join(OUT, "manifest.webmanifest"), "w").write(
        '{\n "name": "pvsketch",\n "short_name": "pvsketch",\n "description": "Productietekening uit foto, maten zelf invoeren",\n'
        ' "start_url": "./",\n "scope": "./",\n "display": "standalone",\n "orientation": "any",\n "background_color": "#15181c",\n "theme_color": "#1f242a",\n'
        ' "icons": [{"src": "icon-192.png", "sizes": "192x192", "type": "image/png"}, {"src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable"}]\n}\n')
    open(os.path.join(OUT, "_headers"), "w").write(
        "/*\n  Cache-Control: public, max-age=0, must-revalidate\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n"
        "/vendor/*\n  Cache-Control: public, max-age=86400\n/sw.js\n  Cache-Control: no-cache\n")

    # version = hash of everything except sw.js, so the service worker cache is replaced on every change
    h = hashlib.sha1()
    for dp, _, fs in sorted(os.walk(OUT)):
        for f in sorted(fs):
            with open(os.path.join(dp, f), "rb") as fh:
                h.update(f.encode()); h.update(fh.read())
    version = h.hexdigest()[:10]
    open(os.path.join(OUT, "sw.js"), "w").write(open(os.path.join(WEB, "sw.js")).read().replace("__VERSION__", version))
    open(os.path.join(OUT, "version.txt"), "w").write(version + "\n")

    total = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
    print(f"built {OUT}  version {version}  {total/1e6:.1f} MB")
    if not a.no_zip:
        zp = os.path.join(ROOT, "pvsketch-cloudflare-pages.zip")
        with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for dp, _, fs in os.walk(OUT):
                for f in fs:
                    full = os.path.join(dp, f)
                    z.write(full, os.path.relpath(full, OUT))
        print(f"zip {zp}  {os.path.getsize(zp)/1e6:.1f} MB")


if __name__ == "__main__":
    main()
