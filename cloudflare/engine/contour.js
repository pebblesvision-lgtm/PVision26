/* Outline extraction: mask -> clean outer contour -> lines + arcs (port of contour.py).
   Needs PV.cv (OpenCV.js) to be initialised. Masks are cv.Mat CV_8UC1 (255 = stone). */
(function (PV) {
  "use strict";
  const C = (PV.contour = {});
  const G = () => PV.geo;
  const hyp = Math.hypot;

  // ------------------------------------------------------------ outline
  /** Largest external contour as [[x,y],...] (px, dense) or null. */
  C.outerContour = (mask) => {
    const cv = PV.cv;
    const src = PV.copyMat(mask); const cs = new cv.MatVector(); const hier = new cv.Mat();
    try {
      cv.findContours(src, cs, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);
      let best = -1, bestA = -1;
      for (let i = 0; i < cs.size(); i++) { const a = cv.contourArea(cs.get(i)); if (a > bestA) { bestA = a; best = i; } }
      if (best < 0 || bestA < 25) return null;
      const d = cs.get(best).data32S; const out = new Array(d.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = [d[2 * i], d[2 * i + 1]];
      return out;
    } finally { src.delete(); cs.delete(); hier.delete(); }
  };

  /** Circular moving average with numpy's convolve(mode="same") alignment. */
  C.smoothContour = (pts, w = 5) => {
    const N = pts.length;
    if (w <= 1 || N < w * 2) return pts;
    const h = Math.floor((w - 1) / 2);
    const out = new Array(N);
    for (let c = 0; c < 2; c++) {
      const col = new Float64Array(N + 2 * w);
      for (let i = 0; i < w; i++) col[i] = pts[N - w + i][c];
      for (let i = 0; i < N; i++) col[w + i] = pts[i][c];
      for (let i = 0; i < w; i++) col[w + N + i] = pts[i][c];
      for (let p = 0; p < N; p++) {
        const i = p + w; let s = 0;
        for (let j = 0; j < w; j++) s += col[i + h - j];
        if (c === 0) out[p] = [s / w, 0]; else out[p][1] = s / w;
      }
    }
    return out;
  };

  C.simplify = (pts, eps) => {
    const cv = PV.cv; const flat = new Float32Array(pts.length * 2);
    for (let i = 0; i < pts.length; i++) { flat[2 * i] = pts[i][0]; flat[2 * i + 1] = pts[i][1]; }
    const m = cv.matFromArray(pts.length, 1, cv.CV_32FC2, Array.from(flat)); const o = new cv.Mat();
    try {
      cv.approxPolyDP(m, o, eps, true);
      const d = o.data32F; const out = new Array(o.rows);
      for (let i = 0; i < o.rows; i++) out[i] = [d[2 * i], d[2 * i + 1]];
      return out;
    } finally { m.delete(); o.delete(); }
  };

  // ------------------------------------------------------------ arc fitting
  /** Kasa least-squares circle fit on mean-centred points -> {cx,cy,r,rms} or null. */
  C.fitCircle = (pts) => {
    const n = pts.length; if (n < 3) return null;
    let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= n; my /= n;
    let Sxx = 0, Sxy = 0, Syy = 0, Sx = 0, Sy = 0, Sxb = 0, Syb = 0, Sb = 0;
    for (const p of pts) {
      const x = p[0] - mx, y = p[1] - my, b = x * x + y * y;
      Sxx += x * x; Sxy += x * y; Syy += y * y; Sx += x; Sy += y; Sxb += x * b; Syb += y * b; Sb += b;
    }
    const M = [[Sxx, Sxy, Sx, Sxb], [Sxy, Syy, Sy, Syb], [Sx, Sy, n, Sb]];
    for (let c = 0; c < 3; c++) {                                  // Gaussian elimination, partial pivot
      let piv = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = c + 1; r < 3; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
    }
    const s2 = M[2][3] / M[2][2], s1 = (M[1][3] - M[1][2] * s2) / M[1][1], s0 = (M[0][3] - M[0][1] * s1 - M[0][2] * s2) / M[0][0];
    const cx = s0 / 2, cy = s1 / 2, r2 = s2 + cx * cx + cy * cy;
    if (!(r2 > 0)) return null;
    const r = Math.sqrt(r2);
    let ss = 0; for (const p of pts) { const e = hyp(p[0] - mx - cx, p[1] - my - cy) - r; ss += e * e; }
    return { cx: cx + mx, cy: cy + my, r, rms: Math.sqrt(ss / n) };
  };
  const arcLen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  const lineDeviation = (pts) => {
    const p0 = pts[0], p1 = pts[pts.length - 1]; const dx = p1[0] - p0[0], dy = p1[1] - p0[1]; const n = hyp(dx, dy);
    if (n < 1e-9) return 0;
    let m = 0; for (const p of pts) m = Math.max(m, Math.abs(dx * (p[1] - p0[1]) - dy * (p[0] - p0[0])) / n);
    return m;
  };

  C.fitLinesAndArcs = (dense, vidx, tol, opts = {}) => {
    const minArcPoints = opts.minArcPoints || 3, maxRadius = opts.maxRadius || null, minRadius = opts.minRadius || 0, minArcLen = opts.minArcLen || 0;
    const n = vidx.length;
    const pt = (p) => [p[0], p[1]];
    if (n < 3) return [{ type: "polyline", points: vidx.map((i) => pt(dense[i])), closed: true }];
    const run = (i, j) => {
      const a = vidx[i % n], b = vidx[j % n];
      return b > a ? dense.slice(a, b + 1) : dense.slice(a).concat(dense.slice(0, b + 1));
    };
    const prims = []; let cur = []; let i = 0, consumed = 0;
    while (consumed < n) {
      let best = null;
      for (let span = minArcPoints; span <= n - consumed; span++) {
        const pts = run(i, i + span);
        if (pts.length < 5) continue;
        const fit = C.fitCircle(pts);
        if (!fit) break;
        const { cx, cy, r } = fit;
        if (maxRadius && r > maxRadius) break;
        if (r < minRadius) continue;
        let maxres = 0; for (const p of pts) maxres = Math.max(maxres, Math.abs(hyp(p[0] - cx, p[1] - cy) - r));
        if (maxres > tol) break;
        if (lineDeviation(pts) <= tol * 1.5) continue;
        if (minArcLen && arcLen(pts) < minArcLen) continue;
        best = { span, cx, cy, r };
      }
      if (best) {
        const pts = run(i, i + best.span);
        if (cur.length) { cur.push(pt(pts[0])); prims.push({ type: "polyline", points: cur, closed: false }); cur = []; }
        const v0 = [pts[0][0] - best.cx, pts[0][1] - best.cy], mid = pts[Math.floor(pts.length / 2)], v1 = [mid[0] - best.cx, mid[1] - best.cy];
        const ccw = v0[0] * v1[1] - v0[1] * v1[0] > 0;
        prims.push({ type: "arc", center: [best.cx, best.cy], radius: best.r, start: pt(pts[0]), end: pt(pts[pts.length - 1]), ccw });
        i += best.span; consumed += best.span;
      } else { cur.push(pt(dense[vidx[i % n]])); i++; consumed++; }
    }
    if (cur.length) { cur.push(pt(dense[vidx[i % n]])); prims.push({ type: "polyline", points: cur, closed: false }); }
    if (prims.length >= 2 && prims[0].type === "polyline" && prims[prims.length - 1].type === "polyline") {
      prims[0] = { type: "polyline", points: prims[prims.length - 1].points.slice(0, -1).concat(prims[0].points), closed: false };
      prims.pop();
    }
    if (prims.length === 1 && prims[0].type === "polyline") {
      const p = prims[0].points; const same = p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1];
      return [{ type: "polyline", points: same ? p.slice(0, -1) : p, closed: true }];
    }
    return prims;
  };

  function vertexIndices(dense, simp) {
    const idx = [];
    for (const v of simp) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < dense.length; i++) { const d = (dense[i][0] - v[0]) ** 2 + (dense[i][1] - v[1]) ** 2; if (d < bd) { bd = d; best = i; } }
      idx.push(best);
    }
    return Array.from(new Set(idx)).sort((a, b) => a - b);
  }

  /** mask (px) -> outline primitives in mm. */
  C.extractOutline = (mask, ppm, o = {}) => {
    const eps0 = o.epsilon_mm === undefined ? 1.0 : o.epsilon_mm, arcFit = o.arc_fit !== false;
    const win = o.smooth_window === undefined ? 5 : o.smooth_window;
    const minR = o.min_arc_radius_mm === undefined ? 15 : o.min_arc_radius_mm, minL = o.min_arc_len_mm === undefined ? 12 : o.min_arc_len_mm;
    const densePx = C.outerContour(mask); if (!densePx) return [];
    const dense = C.smoothContour(densePx, win).map((p) => [p[0] / ppm, p[1] / ppm]);
    const eps = Math.max(0.05, eps0);
    const simp = C.simplify(dense, eps); if (simp.length < 3) return [];
    if (!arcFit) return [{ type: "polyline", points: simp.map((p) => [p[0], p[1]]), closed: true }];
    const vidx = vertexIndices(dense, simp);
    const tol = o.arc_tol_mm !== undefined && o.arc_tol_mm !== null ? o.arc_tol_mm : eps * 1.2;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of dense) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    return C.fitLinesAndArcs(dense, vidx, tol, { maxRadius: hyp(x1 - x0, y1 - y0) * 3, minRadius: minR, minArcLen: minL });
  };

  // ------------------------------------------------------------ details
  /** Zhang-Suen thinning on a 0/255 Uint8Array (w*h) -> new 0/255 skeleton. */
  C.thin = (bin, w, h) => {
    const img = new Uint8Array(w * h); for (let i = 0; i < img.length; i++) img[i] = bin[i] > 0 ? 1 : 0;
    let y0 = h, y1 = 0; for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) if (img[y * w + x]) { if (y < y0) y0 = y; y1 = y; break; } }
    y0 = Math.max(1, y0); y1 = Math.min(h - 2, y1);
    const del = []; let changed = true;
    while (changed) {
      changed = false;
      for (let step = 0; step < 2; step++) {
        del.length = 0;
        for (let y = y0; y <= y1; y++) for (let x = 1; x < w - 1; x++) {
          const i = y * w + x; if (!img[i]) continue;
          const P2 = img[i - w], P3 = img[i - w + 1], P4 = img[i + 1], P5 = img[i + w + 1], P6 = img[i + w], P7 = img[i + w - 1], P8 = img[i - 1], P9 = img[i - w - 1];
          const B = P2 + P3 + P4 + P5 + P6 + P7 + P8 + P9; if (B < 2 || B > 6) continue;
          const A = (P2 === 0 && P3 === 1) + (P3 === 0 && P4 === 1) + (P4 === 0 && P5 === 1) + (P5 === 0 && P6 === 1) + (P6 === 0 && P7 === 1) + (P7 === 0 && P8 === 1) + (P8 === 0 && P9 === 1) + (P9 === 0 && P2 === 1);
          if (A !== 1) continue;
          if (step === 0) { if (P2 * P4 * P6 !== 0 || P4 * P6 * P8 !== 0) continue; } else if (P2 * P4 * P8 !== 0 || P2 * P6 * P8 !== 0) continue;
          del.push(i);
        }
        if (del.length) { for (const i of del) img[i] = 0; changed = true; }
      }
    }
    for (let i = 0; i < img.length; i++) img[i] = img[i] * 255;
    return img;
  };

  /** findContours traces a 1-px open curve out and back; return one pass as an open polyline, rings stay closed. */
  function unfoldSkeleton(pts) {
    const n = pts.length; if (n < 4) return { pts, closed: false };
    const rev = [];
    for (let i = 0; i < n; i++) { const p = pts[(i + n - 1) % n], q = pts[(i + 1) % n]; if (p[0] === q[0] && p[1] === q[1]) rev.push(i); }
    if (rev.length < 2) return { pts, closed: true };
    let best = null;
    for (let i = 0; i < rev.length; i++) {
      const r1 = rev[i], r2 = rev[(i + 1) % rev.length];
      const seg = r2 > r1 ? pts.slice(r1, r2 + 1) : pts.slice(r1).concat(pts.slice(0, r2 + 1));
      if (!best || seg.length > best.length) best = seg;
    }
    return { pts: best, closed: false };
  }
  const pathLen = (pts, closed) => { let s = 0; for (let i = 1; i < pts.length; i++) s += hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (closed && pts.length > 1) s += hyp(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]); return s; };

  /** Canny edges inside the stone as polylines in mm. img: RGB Mat (CV_8UC3). */
  C.detailLines = (img, mask, ppm, o = {}) => {
    const cv = PV.cv; const low = o.low === undefined ? 30 : o.low, high = o.high === undefined ? 90 : o.high;
    const minLen = o.min_len_mm === undefined ? 10 : o.min_len_mm, smooth = o.smooth === undefined ? 5 : o.smooth;
    const epsMm = o.epsilon_mm === undefined ? 0.6 : o.epsilon_mm, insetMm = o.inset_mm === undefined ? 3 : o.inset_mm;
    const gray = new cv.Mat(), bil = new cv.Mat(), edges = new cv.Mat(), inner = new cv.Mat(), edges2 = new cv.Mat(), dil = new cv.Mat();
    const cs = new cv.MatVector(), hier = new cv.Mat(); const k = Math.max(1, Math.round(insetMm * ppm));
    const ker = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2 * k + 1, 2 * k + 1)); const k3 = cv.Mat.ones(3, 3, cv.CV_8U);
    const out = [];
    try {
      cv.cvtColor(img, gray, cv.COLOR_RGB2GRAY);
      let g = gray; if (smooth > 0) { cv.bilateralFilter(gray, bil, smooth | 1, 25, 25); g = bil; }
      cv.Canny(g, edges, low, high, 3, true);
      cv.erode(mask, inner, ker); cv.bitwise_and(edges, inner, edges2); cv.dilate(edges2, dil, k3);
      const w = dil.cols, h = dil.rows; const sk = C.thin(dil.data, w, h);
      const skm = new cv.Mat(h, w, cv.CV_8UC1); skm.data.set(sk);
      cv.findContours(skm, cs, hier, cv.RETR_LIST, cv.CHAIN_APPROX_NONE); skm.delete();
      const list = [];
      for (let i = 0; i < cs.size(); i++) { const d = cs.get(i).data32S; const pts = new Array(d.length / 2); for (let j = 0; j < pts.length; j++) pts[j] = [d[2 * j], d[2 * j + 1]]; list.push(pts); }
      list.sort((a, b) => pathLen(b, false) - pathLen(a, false));
      const seen = [];
      for (const c of list) {
        const u = unfoldSkeleton(c);
        if (pathLen(u.pts, u.closed) < minLen * ppm) continue;
        if (u.closed) {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of u.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
          const box = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
          if (seen.some((b) => box.every((v, i) => Math.abs(v - b[i]) <= 3))) continue;
          seen.push(box);
        }
        const s = C.simplifyOpen(u.pts, epsMm * ppm, u.closed); if (s.length < 2) continue;
        const pl = { type: "polyline", points: s.map((p) => [p[0] / ppm, p[1] / ppm]), closed: u.closed };
        if (G().polylineLength(pl) >= minLen) out.push(pl);
      }
    } finally { gray.delete(); bil.delete(); edges.delete(); inner.delete(); edges2.delete(); dil.delete(); cs.delete(); hier.delete(); ker.delete(); k3.delete(); }
    return out;
  };
  C.simplifyOpen = (pts, eps, closed) => {
    const cv = PV.cv; const m = cv.matFromArray(pts.length, 1, cv.CV_32FC2, pts.flat()); const o = new cv.Mat();
    try { cv.approxPolyDP(m, o, eps, closed); const d = o.data32F; const out = []; for (let i = 0; i < o.rows; i++) out.push([d[2 * i], d[2 * i + 1]]); return out; }
    finally { m.delete(); o.delete(); }
  };
})(globalThis.PV = globalThis.PV || {});
