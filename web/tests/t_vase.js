const fs = require("fs"); const S = process.argv[2]; const { loadEngine } = require("./harness.js");
(async () => {
  const PV = await loadEngine(S + "/njs/node_modules/@techstark/opencv-js"); const cv = PV.cv;
  const meta = JSON.parse(fs.readFileSync(S + "/vase.json")); const img = new cv.Mat(meta.h, meta.w, cv.CV_8UC3); img.data.set(fs.readFileSync(S + "/vase.rgb"));
  const m = PV.segment.grabcut(img, { polygon: meta.polygon, bandPx: 12, iters: 5, strokes: [] });
  fs.writeFileSync(S + "/vase_mask.raw", Buffer.from(m.data));
  // paint-only: one fat stroke down the middle of the vase
  const region = new cv.Mat(meta.h, meta.w, cv.CV_8UC1); const strokes = [{ kind: "fg", pts: [[240, 160], [240, 520]], r: 110 }];
  const layer = PV.segment.strokeLayer(meta.w, meta.h, strokes, 1); for (let i = 0; i < layer.length; i++) region.data[i] = layer[i] === 1 ? 255 : 0;
  const m2 = PV.segment.grabcut(img, { strokes, region, bandPx: 12, iters: 5, seed: true });
  fs.writeFileSync(S + "/vase_mask2.raw", Buffer.from(m2.data));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
