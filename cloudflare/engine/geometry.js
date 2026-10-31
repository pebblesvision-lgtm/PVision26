/* Geometry (mm, y-down). Plain JSON-compatible objects, same shapes as the Python version.
   polyline: {type:"polyline", points:[[x,y],...], closed}
   arc:      {type:"arc", center, radius, start, end, ccw}
*/
(function (PV) {
  "use strict";
  const G = (PV.geo = {});
  const RAD = Math.PI / 180;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  G.dist = dist;
  G.clone = (x) => JSON.parse(JSON.stringify(x));
  /** Python's "%g": up to 6 significant digits, no trailing zeros. */
  G.fmtG = (v) => String(+Number(v).toPrecision(6));
  const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  G.num = num;

  // ------------------------------------------------------------ primitives
  G.sweepDeg = (a) => {
    const a0 = Math.atan2(a.start[1] - a.center[1], a.start[0] - a.center[0]) / RAD;
    const a1 = Math.atan2(a.end[1] - a.center[1], a.end[0] - a.center[0]) / RAD;
    const d = (((a1 - a0) % 360) + 360) % 360;
    return a.ccw ? d : (((360 - d) % 360) + 360) % 360;
  };
  G.sampleArc = (arc, stepDeg = 5) => {
    const [cx, cy] = arc.center;
    const a0 = Math.atan2(arc.start[1] - cy, arc.start[0] - cx);
    let sweep = G.sweepDeg(arc) * RAD;
    if (!arc.ccw) sweep = -sweep;
    const n = Math.max(2, Math.floor(Math.abs(sweep / RAD) / stepDeg) + 1);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      pts.push([cx + arc.radius * Math.cos(a), cy + arc.radius * Math.sin(a)]);
    }
    pts[0] = arc.start.slice(); pts[n] = arc.end.slice();
    return pts;
  };
  G.primitivePoints = (p, step = 5) => (p.type === "polyline" ? p.points.map((q) => q.slice()) : G.sampleArc(p, step));
  const pStart = (p) => (p.type === "polyline" ? p.points[0] : p.start);
  const pEnd = (p) => (p.type === "polyline" ? p.points[p.points.length - 1] : p.end);
  G.primStart = pStart; G.primEnd = pEnd;
  G.polylineLength = (pl) => {
    const pts = pl.closed && pl.points.length ? pl.points.concat([pl.points[0]]) : pl.points;
    let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s;
  };
  G.outlineBBox = (outline) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const prim of outline || []) for (const p of G.primitivePoints(prim)) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return x0 === Infinity ? null : [x0, y0, x1, y1];
  };
  /** Split a flat primitive list into closed loops wherever consecutive primitives don't connect. */
  G.outlineLoops = (prims, tol = 1e-6) => {
    const loops = []; let cur = [];
    for (const prim of prims || []) {
      if (cur.length) {
        const last = cur[cur.length - 1];
        if ((last.type === "polyline" && last.closed) || dist(pEnd(last), pStart(prim)) > tol) { loops.push(cur); cur = []; }
      }
      cur.push(prim);
    }
    if (cur.length) loops.push(cur);
    return loops;
  };
  G.primitiveFromDict = (d) => (d.type === "arc"
    ? { type: "arc", center: d.center.map(Number), radius: Number(d.radius), start: d.start.map(Number), end: d.end.map(Number), ccw: !!d.ccw }
    : { type: "polyline", points: d.points.map((p) => [Number(p[0]), Number(p[1])]), closed: !!d.closed });

  // ------------------------------------------------------------ dimensions
  G.dimFromDict = (d) => {
    let kind = d.kind || "aligned"; if (!["aligned", "horizontal", "vertical"].includes(kind)) kind = "aligned";
    let style = d.style || "solid"; if (!["solid", "dashed", "dotted"].includes(style)) style = "solid";
    return {
      p1: [Number(d.p1[0]), Number(d.p1[1])], p2: [Number(d.p2[0]), Number(d.p2[1])], auto_mm: Number(d.auto_mm || 0),
      manual_mm: num(d.manual_mm), label: String(d.label || ""), id: String(d.id || ""), kind,
      offset_mm: Number(d.offset_mm || 0), style, note: String(d.note || ""),
    };
  };
  G.dimToDict = (d) => Object.assign({}, d, { value_mm: d.manual_mm });
  G.measuredAuto = (d) => {
    const dx = d.p2[0] - d.p1[0], dy = d.p2[1] - d.p1[1];
    return d.kind === "horizontal" ? Math.abs(dx) : d.kind === "vertical" ? Math.abs(dy) : Math.hypot(dx, dy);
  };
  G.dimText = (d) => {
    let t = d.manual_mm !== null && d.manual_mm !== undefined ? G.fmtG(d.manual_mm) : "?";
    if (d.label) t = `${d.label}: ${t}`;
    return t;
  };
  G.dimGeometry = (dim) => {
    const [x1, y1] = dim.p1, [x2, y2] = dim.p2; const off = dim.offset_mm || 0;
    let q1, q2, ang;
    if (dim.kind === "horizontal") {
      const yl = (off >= 0 ? Math.max(y1, y2) : Math.min(y1, y2)) + off; q1 = [x1, yl]; q2 = [x2, yl]; ang = 0;
    } else if (dim.kind === "vertical") {
      const xl = (off >= 0 ? Math.max(x1, x2) : Math.min(x1, x2)) + off; q1 = [xl, y1]; q2 = [xl, y2]; ang = -90;
    } else {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      q1 = [x1 + nx * off, y1 + ny * off]; q2 = [x2 + nx * off, y2 + ny * off];
      ang = Math.atan2(dy, dx) / RAD; if (ang > 90 || ang < -90) ang += 180;
    }
    return { ext: [[dim.p1, q1], [dim.p2, q2]], line: [q1, q2], mid: [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2], angle_deg: ang, text: G.dimText(dim) };
  };

  // ------------------------------------------------------------ labels / finishes / sketches
  G.labelFromDict = (d) => ({ pos: [Number(d.pos[0]), Number(d.pos[1])], text: String(d.text || ""), id: String(d.id || "") });
  G.finishFromDict = (d) => ({
    polygon: (d.polygon || []).map((p) => [Number(p[0]), Number(p[1])]), kind: String(d.kind || "frijnen"),
    angle_deg: num(d.angle_deg), spacing_mm: num(d.spacing_mm), width_mm: num(d.width_mm), label: String(d.label || ""),
    id: String(d.id || ""), strokes_per_10cm: num(d.strokes_per_10cm), comment: String(d.comment || ""),
  });
  G.finishSpacing = (f) => (f.strokes_per_10cm ? 100 / Number(f.strokes_per_10cm) : f.spacing_mm);
  G.finishLegend = (f, lang) => {
    let t = f.label || PV.i18n.finishName(f.kind, lang);
    if (f.strokes_per_10cm) t += `, ${G.fmtG(f.strokes_per_10cm)} ${lang === "nl" ? "slagen/10 cm" : "strokes/10 cm"}`;
    if (f.comment) t += ` - ${f.comment}`;
    return t;
  };
  /** Finish with the computed hatch + centroid (what the UI and exporters draw). */
  G.finishFull = (f) => Object.assign({}, f, {
    hatch: PV.hatch.finishHatch(f.polygon, f.kind, f.angle_deg, G.finishSpacing(f), f.width_mm),
    centroid: PV.hatch.centroid(f.polygon),
  });
  G.sketchFromDict = (d) => ({
    points: (d.points || []).map((p) => [Number(p[0]), Number(p[1])]),
    style: ["solid", "dashed", "dotted"].includes(d.style) ? d.style : "solid", arrow: !!d.arrow, text: String(d.text || ""), id: String(d.id || ""),
  });

  // ------------------------------------------------------------ drawing
  G.newDrawing = (w, h) => ({ width_mm: w, height_mm: h, outline: [], detail: [], dimensions: [], labels: [], finishes: [], sketches: [], meta: {}, titleblock: {}, checklist: [] });
  G.lang = (dr) => (dr.meta && dr.meta.lang) || "nl";
  G.typedValues = (dr) => {
    const out = [];
    for (const c of dr.checklist || []) if (c.value_mm !== null && c.value_mm !== undefined && !c.dim_id) out.push([c[G.lang(dr)] || c.en || c.key || "", Number(c.value_mm)]);
    return out;
  };
  /** Deep copy with every point mapped through f(p). Spacings (physical mm) are untouched. */
  G.mapDrawing = (dr, f, radiusFactor = 1) => {
    const out = G.clone(dr);
    for (const prim of out.outline) {
      if (prim.type === "polyline") prim.points = prim.points.map(f);
      else { prim.center = f(prim.center); prim.start = f(prim.start); prim.end = f(prim.end); prim.radius *= radiusFactor; }
    }
    for (const pl of out.detail) pl.points = pl.points.map(f);
    for (const d of out.dimensions) { d.p1 = f(d.p1); d.p2 = f(d.p2); d.auto_mm *= radiusFactor; d.offset_mm *= radiusFactor; }
    for (const l of out.labels) l.pos = f(l.pos);
    for (const fi of out.finishes) fi.polygon = fi.polygon.map(f);
    for (const sk of out.sketches) sk.points = sk.points.map(f);
    return out;
  };
  G.scaleDrawing = (dr, k) => { const o = G.mapDrawing(dr, (p) => [p[0] * k, p[1] * k], k); o.width_mm *= k; o.height_mm *= k; return o; };
  G.translateDrawing = (dr, dx, dy) => G.mapDrawing(dr, (p) => [p[0] + dx, p[1] + dy], 1);
  /** bbox of outline + dimension lines + finishes + labels + sketches */
  G.extent = (dr) => {
    const bb = (G.outlineBBox(dr.outline) || [0, 0, dr.width_mm, dr.height_mm]).slice();
    const add = (p) => { bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.min(bb[1], p[1]); bb[2] = Math.max(bb[2], p[0]); bb[3] = Math.max(bb[3], p[1]); };
    for (const d of dr.dimensions) for (const q of G.dimGeometry(d).line) add(q);
    for (const f of dr.finishes) f.polygon.forEach(add);
    for (const l of dr.labels) add(l.pos);
    for (const s of dr.sketches) s.points.forEach(add);
    return bb;
  };
  G.drawingToDict = (dr) => ({
    width_mm: dr.width_mm, height_mm: dr.height_mm, outline: dr.outline, detail: dr.detail,
    dimensions: dr.dimensions.map(G.dimToDict), labels: dr.labels, finishes: dr.finishes.map(G.finishFull), sketches: dr.sketches,
    meta: dr.meta, titleblock: dr.titleblock, checklist: dr.checklist, bbox: G.outlineBBox(dr.outline),
  });
})(globalThis.PV = globalThis.PV || {});
