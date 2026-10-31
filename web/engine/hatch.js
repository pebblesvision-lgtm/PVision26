/* Hatch patterns for hand-tooled finishes (port of hatch.py). Points are [x,y] in mm. */
(function (PV) {
  "use strict";
  const H = (PV.hatch = {});

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0; let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rot = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; };

  function scanlines(poly, ys) {
    const out = []; const n = poly.length;
    for (const y of ys) {
      const xs = [];
      for (let i = 0; i < n; i++) {
        const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
        if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 0.3) out.push([[xs[k], y], [xs[k + 1], y]]);
    }
    return out;
  }
  function parallelLines(poly, angleDeg, spacing, groups = 1, gapRatio = 2.5) {
    if (poly.length < 3 || spacing <= 0) return [];
    const a = (-angleDeg * Math.PI) / 180;
    const rp = poly.map((p) => rot(p, a));
    let y0 = Infinity, y1 = -Infinity; for (const p of rp) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const ys = [];
    if (groups <= 1) { for (let y = y0 + spacing / 2; y < y1; y += spacing) ys.push(y); }
    else {
      const pitch = spacing / groups;
      for (let y = y0 + spacing / 2; y < y1; y += spacing * gapRatio) for (let k = 0; k < groups; k++) { const yy = y + k * pitch; if (yy < y1) ys.push(yy); }
    }
    return scanlines(rp, ys).map(([p, q]) => [rot(p, -a), rot(q, -a)]);
  }
  function pointInPoly(pt, poly) {
    const [x, y] = pt; let inside = false; const n = poly.length;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
      if ((y1 > y) !== (y2 > y)) { const xi = x1 + ((y - y1) * (x2 - x1)) / (y2 - y1); if (x < xi) inside = !inside; }
    }
    return inside;
  }
  function dotField(poly, spacing) {
    if (poly.length < 3 || spacing <= 0) return [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const out = []; let row = 0;
    for (let y = y0 + spacing / 2; y < y1; y += spacing * 0.866) {
      for (let x = x0 + (row % 2 ? spacing / 2 : spacing); x < x1; x += spacing) if (pointInPoly([x, y], poly)) out.push([x, y]);
      row++;
    }
    return out;
  }
  function randomStrokes(poly, spacing, lengthRatio = 0.8, seed = 7) {
    const rnd = mulberry32(seed); const out = [];
    for (const [cx, cy] of dotField(poly, spacing)) {
      const jx = (rnd() - 0.5) * spacing * 0.6, jy = (rnd() - 0.5) * spacing * 0.6;
      const a = rnd() * Math.PI, L = spacing * lengthRatio * (0.6 + 0.8 * rnd());
      const p = [cx + jx - (Math.cos(a) * L) / 2, cy + jy - (Math.sin(a) * L) / 2];
      const q = [cx + jx + (Math.cos(a) * L) / 2, cy + jy + (Math.sin(a) * L) / 2];
      if (pointInPoly(p, poly) && pointInPoly(q, poly)) out.push([p, q]);
    }
    return out;
  }
  function edgeTicks(poly, spacing, width) {
    if (poly.length < 3 || spacing <= 0) return [];
    let area = 0; const n = poly.length;
    for (let i = 0; i < n; i++) area += poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1];
    const sign = area > 0 ? 1 : -1; const out = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % n];
      const L = Math.hypot(x2 - x1, y2 - y1); if (L < 1e-6) continue;
      const ux = (x2 - x1) / L, uy = (y2 - y1) / L, nx = -uy * sign, ny = ux * sign;
      for (let d = spacing / 2; d < L; d += spacing) {
        const p = [x1 + ux * d, y1 + uy * d], q = [p[0] + nx * width, p[1] + ny * width];
        if (pointInPoly([p[0] + nx * width * 0.5, p[1] + ny * width * 0.5], poly)) out.push([p, q]);
      }
    }
    return out;
  }
  function clipPoly(subject, rect) {
    const xs = rect.map((p) => p[0]), ys = rect.map((p) => p[1]);
    const bounds = [["x>", Math.min(...xs)], ["x<", Math.max(...xs)], ["y>", Math.min(...ys)], ["y<", Math.max(...ys)]];
    let pts = subject.slice();
    for (const [kind, v] of bounds) {
      if (!pts.length) break;
      const inside = kind === "x>" ? (p) => p[0] >= v : kind === "x<" ? (p) => p[0] <= v : kind === "y>" ? (p) => p[1] >= v : (p) => p[1] <= v;
      const inter = (a, b) => {
        if (kind[0] === "x") { const t = b[0] !== a[0] ? (v - a[0]) / (b[0] - a[0]) : 0; return [v, a[1] + t * (b[1] - a[1])]; }
        const t = b[1] !== a[1] ? (v - a[1]) / (b[1] - a[1]) : 0; return [a[0] + t * (b[0] - a[0]), v];
      };
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length];
        if (inside(cur)) { if (!inside(prev)) out.push(inter(prev, cur)); out.push(cur); }
        else if (inside(prev)) out.push(inter(prev, cur));
      }
      pts = out;
    }
    return pts;
  }
  function verticalScanlines(poly, x) {
    const sw = poly.map((p) => [p[1], p[0]]);
    return scanlines(sw, [x]).map(([q, r]) => [[q[1], q[0]], [r[1], r[0]]]);
  }
  function herringbone(poly, spacing, band, angleDeg = 45) {
    if (poly.length < 3 || spacing <= 0 || band <= 0) return [];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    let out = []; let k = 0;
    for (let x = x0; x < x1; x += band, k++) {
      const xe = Math.min(x + band, x1 + 1);
      const clipped = clipPoly(poly, [[x, y0 - 1], [xe, y0 - 1], [xe, y1 + 1], [x, y1 + 1]]);
      if (clipped.length >= 3) {
        out = out.concat(parallelLines(clipped, k % 2 === 0 ? angleDeg : -angleDeg, spacing));
        if (k > 0) out = out.concat(verticalScanlines(poly, x));
      }
    }
    return out;
  }
  function curvedStrokes(poly, spacing, seed = 11) {
    const rnd = mulberry32(seed); const out = [];
    for (const [cx, cy] of dotField(poly, spacing * 2.2)) {
      const a0 = rnd() * Math.PI, r = spacing * (1.2 + rnd()), sweep = 1.1 + rnd() * 0.8, n = 5;
      const pts = []; for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(a0 + (sweep * i) / n), cy + r * Math.sin(a0 + (sweep * i) / n)]);
      if (pts.every((p) => pointInPoly(p, poly))) for (let i = 0; i < n; i++) out.push([pts[i], pts[i + 1]]);
    }
    return out;
  }
  const thinOut = (arr, max) => (arr.length > max ? arr.filter((_, i) => i % Math.ceil(arr.length / max) === 0) : arr);

  H.centroid = (polygon) => {
    if (!polygon.length) return [0, 0];
    let sx = 0, sy = 0; for (const p of polygon) { sx += p[0]; sy += p[1]; } return [sx / polygon.length, sy / polygon.length];
  };
  /** -> {lines: [[p,q],...], dots: [p,...]} in mm */
  H.finishHatch = (polygon, kind, angleDeg, spacing, width) => {
    const poly = polygon.map((p) => [Number(p[0]), Number(p[1])]);
    const D = PV.FINISH_DEFAULTS[kind] || PV.FINISH_DEFAULTS.frijnen;
    const ang = angleDeg === null || angleDeg === undefined ? D.angle : Number(angleDeg);
    const sp = spacing === null || spacing === undefined ? D.spacing : Number(spacing);
    let lines = [], dots = [];
    if (poly.length >= 3 && sp > 0) {
      switch (D.pattern) {
        case "lines": lines = parallelLines(poly, ang, sp); break;
        case "groups": lines = parallelLines(poly, ang, sp, 4); break;
        case "dots": dots = dotField(poly, sp); break;
        case "strokes": lines = randomStrokes(poly, sp); break;
        case "edge": lines = edgeTicks(poly, sp, Number(width || D.width || 25)); break;
        case "herringbone": lines = herringbone(poly, sp, Number(width || D.width || 40), ang); break;
        case "curves": lines = curvedStrokes(poly, sp); break;
        default: break;
      }
    }
    return { lines: thinOut(lines, 6000), dots: thinOut(dots, 6000) };
  };
  H.pointInPoly = pointInPoly;
})(globalThis.PV = globalThis.PV || {});
