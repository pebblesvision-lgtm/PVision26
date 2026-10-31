/* Several views of one element on one sheet (port of views.py). */
(function (PV) {
  "use strict";
  const V = (PV.views = {});
  const GAP = 40;
  V.viewName = (key, lang) => ((PV.VIEW_NAMES[lang] || PV.VIEW_NAMES.en)[key]) || key;
  const ext = (dr) => {
    const g = PV.geo; const bb = (g.outlineBBox(dr.outline) || [0, 0, dr.width_mm, dr.height_mm]).slice();
    const add = (p) => { bb[0] = Math.min(bb[0], p[0]); bb[1] = Math.min(bb[1], p[1]); bb[2] = Math.max(bb[2], p[0]); bb[3] = Math.max(bb[3], p[1]); };
    for (const d of dr.dimensions) g.dimGeometry(d).line.forEach(add);
    for (const f of dr.finishes) f.polygon.forEach(add);
    return bb;
  };
  /** Lay views [[name, drawing], ...] to the right of main, tops aligned. */
  V.combine = (main, views, lang) => {
    if (!views.length) return main;
    const g = PV.geo, mb = ext(main), out = g.clone(main); let nDim = out.dimensions.length;
    out.labels.push({ pos: [mb[0], mb[1] - 8], text: V.viewName("front", lang), id: "V0" });
    let x = mb[2] + GAP;
    views.forEach(([name, dr], i) => {
      const vb = ext(dr), sh = g.translateDrawing(dr, x - vb[0], mb[1] - vb[1]);
      for (const d of sh.dimensions) { nDim++; d.id = `D${nDim}`; }
      out.outline.push(...sh.outline); out.detail.push(...sh.detail); out.dimensions.push(...sh.dimensions); out.labels.push(...sh.labels);
      out.finishes.push(...sh.finishes); out.sketches.push(...sh.sketches);
      out.labels.push({ pos: [x, mb[1] - 8], text: V.viewName(name, lang), id: `V${i + 1}` });
      for (const [n, v] of g.typedValues(dr)) { const t = `${V.viewName(name, lang)}: ${n}`; out.checklist.push({ key: `v${i + 1}`, nl: t, en: t, kind: "value", value_mm: v, dim_id: "" }); }
      x += vb[2] - vb[0] + GAP;
    });
    out.width_mm = Math.max(out.width_mm, x); out.meta.views = views.map((v) => v[0]);
    return out;
  };
})(globalThis.PV = globalThis.PV || {});
