/* Isolate the stone: GrabCut guided by a polygon band / box, with ordered brush strokes (port of segment.py).
   Images are RGB cv.Mat (CV_8UC3); masks CV_8UC1 with 255 = stone. */
(function (PV) {
  "use strict";
  const S = (PV.segment = {});
  const WORK_MAX_SIDE = 1400;
  const LBL_NONE = 0, LBL_FG = 1, LBL_BG = 2;

  S.normaliseStrokes = (fg = [], bg = [], strokes = [], brush = 8) => {
    const out = [];
    for (const s of fg) out.push({ kind: "fg", pts: s.map((p) => [+p[0], +p[1]]), r: brush });
    for (const s of bg) out.push({ kind: "bg", pts: s.map((p) => [+p[0], +p[1]]), r: brush });
    for (const s of strokes || []) {
      if (!["fg", "bg", "erase"].includes(s.kind) || !s.pts || !s.pts.length) continue;
      out.push({ kind: s.kind, pts: s.pts.map((p) => [+p[0], +p[1]]), r: Math.round(s.r || brush) });
    }
    return out;
  };

  function ptsMat(cv, pts, scale) {
    const flat = []; for (const p of pts) flat.push(Math.round(p[0] * scale), Math.round(p[1] * scale));
    return cv.matFromArray(pts.length, 1, cv.CV_32SC2, flat);
  }
  function paintPolyline(cv, layer, pts, scale, value, radius) {
    if (pts.length === 1) { cv.circle(layer, new cv.Point(Math.round(pts[0][0] * scale), Math.round(pts[0][1] * scale)), Math.max(1, radius), new cv.Scalar(value), -1); return; }
    const m = ptsMat(cv, pts, scale), mv = new cv.MatVector(); mv.push_back(m);
    cv.polylines(layer, mv, false, new cv.Scalar(value), Math.max(1, 2 * radius)); mv.delete(); m.delete();
  }
  /** Rasterise ordered strokes: 0 none, 1 stone, 2 background (eraser resets to 0). Returns a Uint8Array. */
  S.strokeLayer = (w, h, strokes, scale = 1) => {
    const cv = PV.cv; const layer = new cv.Mat(h, w, cv.CV_8UC1, new cv.Scalar(0));
    for (const s of strokes) paintPolyline(cv, layer, s.pts, scale, { fg: LBL_FG, bg: LBL_BG, erase: LBL_NONE }[s.kind], Math.max(1, Math.round(s.r * scale)));
    const out = new Uint8Array(layer.data); layer.delete(); return out;
  };
  function polygonMask(w, h, polygon, scale = 1) {
    const cv = PV.cv; const m = new cv.Mat(h, w, cv.CV_8UC1, new cv.Scalar(0));
    if (polygon.length >= 3) { const pm = ptsMat(cv, polygon, scale), mv = new cv.MatVector(); mv.push_back(pm); cv.fillPoly(m, mv, new cv.Scalar(255)); mv.delete(); pm.delete(); }
    return m;
  }
  function largestComponent(mask) {
    const cv = PV.cv; const labels = new cv.Mat(), stats = new cv.Mat(), cen = new cv.Mat();
    const n = cv.connectedComponentsWithStats(mask, labels, stats, cen, 8, cv.CV_32S);
    if (n <= 2) { labels.delete(); stats.delete(); cen.delete(); return mask; }
    let best = 1, ba = -1; for (let i = 1; i < n; i++) { const a = stats.intAt(i, 4); if (a > ba) { ba = a; best = i; } }
    const out = new cv.Mat(mask.rows, mask.cols, cv.CV_8UC1, new cv.Scalar(0));
    const lab = labels.data32S, od = out.data;          // WASM views: fetch only after the last allocation
    for (let i = 0; i < lab.length; i++) if (lab[i] === best) od[i] = 255;
    labels.delete(); stats.delete(); cen.delete(); mask.delete(); return out;
  }
  /** Fill enclosed holes: flood the background from every border pixel; unreached zeros are holes. */
  function fillHoles(mask) {
    const w = mask.cols, h = mask.rows, md = mask.data;                 // no allocation of Mats below
    const seen = new Uint8Array(w * h), q = new Int32Array(w * h); let qh = 0, qt = 0;
    const push = (i) => { if (md[i] === 0 && !seen[i]) { seen[i] = 1; q[qt++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (qh < qt) {
      const i = q[qh++], x = i % w;
      if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i < w * (h - 1)) push(i + w);
    }
    for (let i = 0; i < md.length; i++) if (md[i] === 0 && !seen[i]) md[i] = 255;
    return mask;
  }
  S.largestComponent = largestComponent; S.fillHoles = fillHoles;

  /** Independent copy of a rectangle (roi()__CLONE__ shares memory in this OpenCV.js build, so copy rows by hand). */
  function cropCopy(mat, r, ch) {
    const cv = PV.cv; const out = new cv.Mat(r.height, r.width, ch === 3 ? cv.CV_8UC3 : cv.CV_8UC1);
    const src = mat.data, dst = out.data, sw = mat.cols * ch, rw = r.width * ch;
    for (let y = 0; y < r.height; y++) dst.set(src.subarray((r.y + y) * sw + r.x * ch, (r.y + y) * sw + r.x * ch + rw), y * rw);
    return out;
  }

  /** Returns a new CV_8UC1 mask (caller deletes). rect: [x,y,w,h] or null; polygon: [[x,y],...] or null. */
  S.grabcut = (img, o) => {
    const cv = PV.cv; const rect = o.rect, polygon = o.polygon, strokes = o.strokes || [], iters = o.iters || 5;
    const H = img.rows, W = img.cols; let scale = 1, work = img, ownWork = false;
    if (Math.max(H, W) > WORK_MAX_SIDE) { scale = WORK_MAX_SIDE / Math.max(H, W); work = new cv.Mat(); cv.resize(img, work, new cv.Size(Math.round(W * scale), Math.round(H * scale)), 0, 0, cv.INTER_AREA); ownWork = true; }
    const wh = work.rows, ww = work.cols;
    const mask = new cv.Mat(wh, ww, cv.CV_8UC1, new cv.Scalar(cv.GC_BGD));
    let gcRect;
    try {
      let region = null;
      if (polygon && polygon.length >= 3) region = polygonMask(ww, wh, polygon, scale);
      else if (o.region) { region = new cv.Mat(); cv.resize(o.region, region, new cv.Size(ww, wh), 0, 0, cv.INTER_NEAREST); const rd = region.data; for (let i = 0; i < rd.length; i++) rd[i] = rd[i] ? 255 : 0; }
      if (region && o.seed) {
        // only painted stone: the paint is certain, the rest of the photo "probably background";
        // GrabCut grows the stone outwards from the paint
        // paint may overshoot the edge, so only its core is certain
        const dIn = new cv.Mat(); cv.distanceTransform(region, dIn, cv.DIST_L2, 5);
        const pd = region.data, di = dIn.data32F, md = mask.data; let maxIn = 0;
        for (let i = 0; i < di.length; i++) if (pd[i] && di[i] > maxIn) maxIn = di[i];
        for (let i = 0; i < md.length; i++) md[i] = !pd[i] ? cv.GC_PR_BGD : di[i] >= 0.6 * maxIn ? cv.GC_FGD : cv.GC_PR_FGD;
        region.delete(); dIn.delete(); if (!maxIn) throw new Error("empty selection");
        gcRect = new cv.Rect(0, 0, ww, wh);
      } else if (region) {
        // points / paint are a rough guess: inside = "probably stone", only the deep core is certain
        const band = Math.max(2, Math.round((o.bandPx || 20) * scale));
        const inv = new cv.Mat(), dIn = new cv.Mat(), dOut = new cv.Mat();
        cv.bitwise_not(region, inv); cv.distanceTransform(region, dIn, cv.DIST_L2, 5); cv.distanceTransform(inv, dOut, cv.DIST_L2, 5);
        const pd = region.data, di = dIn.data32F, dout = dOut.data32F, md = mask.data;   // fresh views, no allocation below
        let maxIn = 0; for (let i = 0; i < di.length; i++) if (pd[i] && di[i] > maxIn) maxIn = di[i];
        const core = Math.max(band, 0.6 * maxIn);
        let x0 = ww, y0 = wh, x1 = 0, y1 = 0;
        for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) {
          const i = y * ww + x; const inside = pd[i] > 0;
          if (inside && di[i] > core) md[i] = cv.GC_FGD;
          else if (inside) md[i] = cv.GC_PR_FGD;
          else if (dout[i] <= band) md[i] = cv.GC_PR_BGD;
          if (inside || dout[i] <= band) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 < x0) throw new Error("empty selection");
        gcRect = new cv.Rect(x0, y0, Math.max(1, x1 - x0 + 1), Math.max(1, y1 - y0 + 1));
        region.delete(); inv.delete(); dIn.delete(); dOut.delete();
      } else if (rect) {
        let [x, y, rw, rh] = rect.map(Number);
        const cx0 = Math.max(0, Math.min(ww - 2, Math.round(x * scale))), cy0 = Math.max(0, Math.min(wh - 2, Math.round(y * scale)));
        const cx1 = Math.max(cx0 + 2, Math.min(ww - 1, Math.round((x + rw) * scale))), cy1 = Math.max(cy0 + 2, Math.min(wh - 1, Math.round((y + rh) * scale)));
        gcRect = new cv.Rect(cx0, cy0, cx1 - cx0, cy1 - cy0);
        const md = mask.data;
        for (let yy = cy0; yy < cy1; yy++) for (let xx = cx0; xx < cx1; xx++) md[yy * ww + xx] = cv.GC_PR_FGD;
      } else throw new Error("need a box, points or painted stone");

      const layer = strokes.length ? S.strokeLayer(ww, wh, strokes, scale) : null;
      let md = mask.data;
      const seed = !!o.seed;   // seed: the paint was handled above (it may overshoot)
      if (layer) for (let i = 0; i < md.length; i++) { if (layer[i] === LBL_FG && !seed) md[i] = cv.GC_FGD; else if (layer[i] === LBL_BG) md[i] = cv.GC_BGD; }
      let hasFg = false, hasBg = false; for (let i = 0; i < md.length; i++) { const v = md[i]; if (v === cv.GC_FGD || v === cv.GC_PR_FGD) hasFg = true; else hasBg = true; if (hasFg && hasBg) break; }
      if (!hasFg || !hasBg) throw new Error("the box/polygon must leave some background around the stone");

      // GrabCut only needs the region around the band/box: crop (with a margin of definite background) to save time
      const pad = 10; let cx0 = Math.max(0, gcRect.x - pad), cy0 = Math.max(0, gcRect.y - pad);
      let cx1 = Math.min(ww, gcRect.x + gcRect.width + pad), cy1 = Math.min(wh, gcRect.y + gcRect.height + pad);
      const bgd = new cv.Mat(), fgd = new cv.Mat();
      const cropR = new cv.Rect(cx0, cy0, cx1 - cx0, cy1 - cy0);
      const workC = cropCopy(work, cropR, 3), maskC = cropCopy(mask, cropR, 1);
      let okC = false; { const mc = maskC.data; let f = false, b = false; for (let i = 0; i < mc.length; i++) { if (mc[i] === cv.GC_FGD || mc[i] === cv.GC_PR_FGD) f = true; else b = true; if (f && b) { okC = true; break; } } }
      const useMode = !polygon && !o.region && !layer ? cv.GC_INIT_WITH_RECT : cv.GC_INIT_WITH_MASK;
      if (okC) {
        cv.grabCut(workC, maskC, new cv.Rect(gcRect.x - cx0, gcRect.y - cy0, gcRect.width, gcRect.height), bgd, fgd, iters, useMode);
        const md2 = mask.data, mc2 = maskC.data, cw = cx1 - cx0, chh = cy1 - cy0;
        for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) md2[(cy0 + y) * ww + cx0 + x] = mc2[y * cw + x];
      } else cv.grabCut(work, mask, gcRect, bgd, fgd, iters, useMode);
      workC.delete(); maskC.delete(); bgd.delete(); fgd.delete();

      let out = new cv.Mat(wh, ww, cv.CV_8UC1, new cv.Scalar(0)); const od = out.data; md = mask.data;   // views refreshed after grabCut/alloc
      for (let i = 0; i < md.length; i++) od[i] = md[i] === cv.GC_FGD || md[i] === cv.GC_PR_FGD ? 255 : 0;
      const k5 = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5)), opened = new cv.Mat();
      cv.morphologyEx(out, opened, cv.MORPH_OPEN, k5); out.delete(); k5.delete(); out = opened;
      if (layer) { const d2 = out.data; for (let i = 0; i < d2.length; i++) { if (layer[i] === LBL_FG && !seed) d2[i] = 255; else if (layer[i] === LBL_BG) d2[i] = 0; } }
      out = largestComponent(out); out = fillHoles(out);
      if (scale !== 1) {
        const big = new cv.Mat(); cv.resize(out, big, new cv.Size(W, H), 0, 0, cv.INTER_LINEAR); out.delete();
        const bd = big.data; for (let i = 0; i < bd.length; i++) bd[i] = bd[i] > 127 ? 255 : 0; out = big;
      }
      return out;
    } finally { mask.delete(); if (ownWork) work.delete(); }
  };

  /** Brush edits after a run: stone adds to the mask, background (gum) removes. Returns a new Mat. */
  S.applyEdits = (base, edits) => {
    const m = PV.copyMat(base); if (!edits || !edits.length) return m;
    const layer = S.strokeLayer(m.cols, m.rows, edits, 1), d = m.data;
    for (let i = 0; i < d.length; i++) { if (layer[i] === LBL_FG) d[i] = 255; else if (layer[i] === LBL_BG) d[i] = 0; }
    return m;
  };
  S.LBL_FG = LBL_FG;

  /** No GrabCut: the clicked polygon is the mask; strokes still add/remove. */
  S.exactPolygon = (w, h, polygon, strokes = []) => {
    const cv = PV.cv; let m = polygonMask(w, h, polygon, 1);
    if (strokes.length) { const layer = S.strokeLayer(w, h, strokes, 1); const d = m.data; for (let i = 0; i < d.length; i++) { if (layer[i] === LBL_FG) d[i] = 255; else if (layer[i] === LBL_BG) d[i] = 0; } }
    let any = false; const d = m.data; for (let i = 0; i < d.length; i++) if (d[i]) { any = true; break; }
    if (any) { m = largestComponent(m); m = fillHoles(m); }
    return m;
  };

  /** RGB image tinted over the mask with a red boundary -> Uint8Array RGBA (w*h*4). */
  S.overlayRGBA = (img, mask) => {
    const cv = PV.cv; const w = img.cols, h = img.rows, src = img.data, md = mask.data, out = new Uint8Array(w * h * 4);
    const tint = [255, 200, 0], a = 0.45;
    for (let i = 0; i < w * h; i++) {
      const m = md[i] > 0;
      out[4 * i] = m ? src[3 * i] * (1 - a) + tint[0] * a : src[3 * i]; out[4 * i + 1] = m ? src[3 * i + 1] * (1 - a) + tint[1] * a : src[3 * i + 1];
      out[4 * i + 2] = m ? src[3 * i + 2] * (1 - a) + tint[2] * a : src[3 * i + 2]; out[4 * i + 3] = 255;
    }
    const cs = new cv.MatVector(), hier = new cv.Mat(), clone = PV.copyMat(mask);
    try {
      cv.findContours(clone, cs, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const rgba = cv.matFromArray(h, w, cv.CV_8UC4, Array.from(out)); const rgb = new cv.Mat();
      cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB); cv.drawContours(rgb, cs, -1, new cv.Scalar(255, 0, 0), 2);
      cv.cvtColor(rgb, rgba, cv.COLOR_RGB2RGBA); const res = new Uint8Array(rgba.data); rgba.delete(); rgb.delete(); return res;
    } finally { cs.delete(); hier.delete(); clone.delete(); }
  };
})(globalThis.PV = globalThis.PV || {});
