const { loadEngine } = require("./harness.js");
(async () => {
  const PV = await loadEngine(process.argv[2] + "/njs/node_modules/@techstark/opencv-js"); const cv = PV.cv;
  const W = 600, H = 400, img = new cv.Mat(H, W, cv.CV_8UC3, new cv.Scalar(200, 210, 220));
  cv.ellipse(img, new cv.Point(300, 210), new cv.Size(110, 150), 0, 0, 360, new cv.Scalar(95, 100, 90), -1);
  const d = img.data; let s = 1; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = Math.max(0, Math.min(255, d[i] + (s % 24) - 12)); }
  const truth = new cv.Mat(H, W, cv.CV_8UC1, new cv.Scalar(0)); cv.ellipse(truth, new cv.Point(300, 210), new cv.Size(110, 150), 0, 0, 360, new cv.Scalar(255), -1);
  const iou = (m) => { let a = 0, b = 0; const md = m.data, td = truth.data; for (let i = 0; i < md.length; i++) { const x = md[i] > 0, y = td[i] > 0; if (x && y) a++; if (x || y) b++; } return a / b; };
  const m1 = PV.segment.grabcut(img, { polygon: [[120, 30], [480, 20], [520, 380], [90, 390]], bandPx: 12, iters: 5, strokes: [] });
  const strokes = [{ kind: "fg", pts: [[300, 80], [300, 340]], r: 120 }]; const region = new cv.Mat(H, W, cv.CV_8UC1);
  const layer = PV.segment.strokeLayer(W, H, strokes, 1); for (let i = 0; i < layer.length; i++) region.data[i] = layer[i] === 1 ? 255 : 0;
  const m2 = PV.segment.grabcut(img, { strokes, region, bandPx: 12, iters: 5, seed: true });
  const m3 = PV.segment.applyEdits(m2, [{ kind: "bg", pts: [[300, 60], [300, 120]], r: 30 }]);
  const cnt = (m) => { let n = 0; for (const v of m.data) if (v) n++; return n; };
  console.log(JSON.stringify({ loosePolygonIoU: +iou(m1).toFixed(3), paintOnlyIoU: +iou(m2).toFixed(3), editRemoved: cnt(m2) - cnt(m3) }));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
