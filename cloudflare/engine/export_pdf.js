/* Vector PDF at true scale (port of export_pdf.py). Returns a Uint8Array (Latin-1 content). */
(function (PV) {
  "use strict";
  const P = (PV.exportPdf = {});
  const G = () => PV.geo, T = (lang, k) => PV.i18n.t(lang, k);
  const PAPER = { a4: [210, 297], a3: [297, 420] }, PT = 72 / 25.4, SCALES = [1, 2, 2.5, 5, 10, 20];
  const DASH = { solid: "[] 0", dashed: "[6 3] 0", dotted: "[1 2.5] 0" };
  const esc = (t) => String(t).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const f = (v) => { if (Math.abs(v) <= 1e-9) return "0"; let s = v.toFixed(3); if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, ""); return s; };

  function arcBeziers(a) {
    const [cx, cy] = a.center; const a0 = Math.atan2(a.start[1] - cy, a.start[0] - cx);
    const sweep = ((G().sweepDeg(a) * Math.PI) / 180) * (a.ccw ? 1 : -1);
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2))), step = sweep / n, k = (4 / 3) * Math.tan(step / 4), out = [];
    for (let i = 0; i < n; i++) {
      const t0 = a0 + step * i, t1 = t0 + step, r = a.radius;
      const p0 = [cx + r * Math.cos(t0), cy + r * Math.sin(t0)], p3 = [cx + r * Math.cos(t1), cy + r * Math.sin(t1)];
      out.push([[p0[0] - k * r * Math.sin(t0), p0[1] + k * r * Math.cos(t0)], [p3[0] + k * r * Math.sin(t1), p3[1] - k * r * Math.cos(t1)], p3]);
    }
    return out;
  }
  function chooseLayout(w, h, paper = "auto", margin = 15, titleH = 30) {
    const papers = paper === "auto" ? ["a4", "a3"] : [paper];
    for (const s of SCALES) for (const p of papers) for (const land of [false, true]) {
      const [pw, ph] = PAPER[p]; const [W, H] = land ? [ph, pw] : [pw, ph];
      if (w / s + 2 * margin <= W && h / s + 2 * margin + titleH <= H) return [p, land, s];
    }
    return [papers[papers.length - 1], true, SCALES[SCALES.length - 1]];
  }
  P.chooseLayout = chooseLayout;

  P.drawingToPdf = (dr, paper = "auto", marginMm = 15) => {
    const g = G(), lang = g.lang(dr);
    const bb = g.extent(dr); const cw = bb[2] - bb[0] + 20, ch = bb[3] - bb[1] + 20;
    const [pname, landscape, s] = chooseLayout(cw, ch, paper, marginMm);
    let [pw, ph] = PAPER[pname]; if (landscape) [pw, ph] = [ph, pw];
    const titleH = 30, areaW = pw - 2 * marginMm, areaH = ph - 2 * marginMm - titleH;
    const ox = marginMm + (areaW - cw / s) / 2 - (bb[0] - 10) / s, oy = marginMm + titleH + (areaH - ch / s) / 2;
    const XY = (p) => [(ox + p[0] / s) * PT, (oy + (bb[3] + 10 - p[1]) / s) * PT];
    const c = ["1 J 1 j", `${f(0.5 * PT * 0.6)} w 0 0 0 RG [] 0 d`];
    for (const loop of g.outlineLoops(dr.outline)) {
      let first = true;
      for (const prim of loop) {
        if (prim.type === "polyline") { prim.points.forEach((p, i) => { const [x, y] = XY(p); c.push(`${f(x)} ${f(y)} ${first && i === 0 ? "m" : "l"}`); }); first = false; }
        else {
          if (first) { const [x, y] = XY(prim.start); c.push(`${f(x)} ${f(y)} m`); }
          for (const [p1, p2, p3] of arcBeziers(prim)) { const a = XY(p1), b = XY(p2), d = XY(p3); c.push(`${f(a[0])} ${f(a[1])} ${f(b[0])} ${f(b[1])} ${f(d[0])} ${f(d[1])} c`); }
          first = false;
        }
      }
      c.push("h S");
    }
    if (dr.detail.length) {
      c.push(`${f(0.2 * PT)} w 0.35 0.35 0.35 RG`);
      for (const pl of dr.detail) { pl.points.forEach((p, i) => { const [x, y] = XY(p); c.push(`${f(x)} ${f(y)} ${i === 0 ? "m" : "l"}`); }); c.push(pl.closed ? "h S" : "S"); }
    }
    const font = 3.2 * PT;
    dr.finishes.forEach((fi, i) => {
      const fd = g.finishFull(fi);
      c.push(`0.45 0.45 0.45 RG ${f(0.12 * PT)} w [0.8 0.8] 0 d`);
      fi.polygon.forEach((p, k) => { const [x, y] = XY(p); c.push(`${f(x)} ${f(y)} ${k === 0 ? "m" : "l"}`); });
      c.push("h S [] 0 d", `0.2 0.2 0.2 RG ${f(0.15 * PT)} w`);
      for (const [p, q] of fd.hatch.lines) { const a = XY(p), b = XY(q); c.push(`${f(a[0])} ${f(a[1])} m ${f(b[0])} ${f(b[1])} l S`); }
      if (fd.hatch.dots.length) {
        const r = (Math.max(0.2, (g.finishSpacing(fi) || 4) * 0.12) / s) * PT; c.push("0.2 0.2 0.2 rg");
        for (const p of fd.hatch.dots) { const [x, y] = XY(p); c.push(`${f(x - r)} ${f(y - r)} ${f(2 * r)} ${f(2 * r)} re f`); }
      }
      const [cx, cy] = XY(fd.centroid); const label = `F${i + 1} ${fi.label || PV.i18n.finishName(fi.kind, lang)}`;
      c.push(`BT /F1 ${f(font)} Tf 0 g ${f(cx - label.length * font * 0.25)} ${f(cy)} Td (${esc(label)}) Tj ET`);
    });
    for (const sk of dr.sketches) {
      c.push(`0 0.4 0.8 RG ${f(0.3 * PT)} w ${DASH[sk.style] || "[] 0"} d`);
      sk.points.forEach((p, k) => { const [x, y] = XY(p); c.push(`${f(x)} ${f(y)} ${k === 0 ? "m" : "l"}`); });
      c.push("S [] 0 d");
      if (sk.arrow && sk.points.length >= 2) {
        const a = XY(sk.points[sk.points.length - 2]), b = XY(sk.points[sk.points.length - 1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), sz = 2.5 * PT;
        const l = [b[0] - sz * Math.cos(ang - 0.4), b[1] - sz * Math.sin(ang - 0.4)], r = [b[0] - sz * Math.cos(ang + 0.4), b[1] - sz * Math.sin(ang + 0.4)];
        c.push(`0 0.4 0.8 rg ${f(b[0])} ${f(b[1])} m ${f(l[0])} ${f(l[1])} l ${f(r[0])} ${f(r[1])} l h f`);
      }
      if (sk.text) { const [x, y] = XY(sk.points[0]); c.push(`BT /F1 ${f(font)} Tf 0 0.4 0.8 rg ${f(x + 1.5 * PT)} ${f(y + 1.5 * PT)} Td (${esc(sk.text)}) Tj ET`); }
    }
    dr.dimensions.forEach((d, i) => {
      const gg = g.dimGeometry(d);
      c.push(`0.8 0 0 RG ${f(0.18 * PT)} w [1.5 1.5] 0 d`);
      for (const [a, b] of gg.ext) if (g.dist(a, b) > 0.05) { const A = XY(a), B = XY(b); c.push(`${f(A[0])} ${f(A[1])} m ${f(B[0])} ${f(B[1])} l S`); }
      const q1 = XY(gg.line[0]), q2 = XY(gg.line[1]);
      c.push(`${DASH[d.style] || "[] 0"} d ${f(0.3 * PT)} w ${f(q1[0])} ${f(q1[1])} m ${f(q2[0])} ${f(q2[1])} l S [] 0 d`);
      const dx = q2[0] - q1[0], dy = q2[1] - q1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, t = 1.6 * PT;
      for (const q of [q1, q2]) c.push(`${f(q[0] - nx * t)} ${f(q[1] - ny * t)} m ${f(q[0] + nx * t)} ${f(q[1] + ny * t)} l S`);
      let ang = Math.atan2(dy, dx); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
      const txt = `D${i + 1}  ${gg.text}`, tw = txt.length * font * 0.5, mx = (q1[0] + q2[0]) / 2, my = (q1[1] + q2[1]) / 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const tx = mx - (ca * tw) / 2 + -sa * 1.2 * PT, ty = my - (sa * tw) / 2 + ca * 1.2 * PT;
      c.push(`BT /F1 ${f(font)} Tf 0.8 0 0 rg ${f(ca)} ${f(sa)} ${f(-sa)} ${f(ca)} ${f(tx)} ${f(ty)} Tm (${esc(txt)}) Tj ET`);
    });
    for (const lb of dr.labels) { const [x, y] = XY(lb.pos); c.push(`BT /F1 ${f(3.5 * PT)} Tf 0 0.4 0.8 rg ${f(x)} ${f(y)} Td (${esc(lb.text)}) Tj ET`); }

    // title block
    const m = marginMm * PT; c.push(`0 0 0 RG 0.4 w ${f(m)} ${f(m + titleH * PT)} m ${f(pw * PT - m)} ${f(m + titleH * PT)} l S`);
    const ob = g.outlineBBox(dr.outline), tb = dr.titleblock || {};
    const bbTxt = ob ? `${T(lang, "outline")} ${(ob[2] - ob[0]).toFixed(1)} x ${(ob[3] - ob[1]).toFixed(1)} mm` : "";
    let head = String(tb.project || dr.meta.name || "stone"); for (const k of ["element", "material", "quantity"]) if (tb[k]) head += `   ${T(lang, k)}: ${tb[k]}`;
    const lines = [head,
      `${T(lang, "title")}  -  ${new Date().toISOString().slice(0, 10)}  -  ${T(lang, "scale")} 1:${s}  -  ${bbTxt}  -  ${T(lang, "units")}`,
      `${dr.meta.calibration || ""}  -  ${T(lang, "source")} ${dr.meta.source || ""}` + (tb.drawn_by ? `  -  ${T(lang, "drawn_by")}: ${tb.drawn_by}` : "") + `  -  ${T(lang, "print")}`];
    const leg = (tb.finish ? [String(tb.finish)] : []).concat(dr.finishes.map((fi, i) => `F${i + 1} ${g.finishLegend(fi, lang)}`));
    if (!dr.meta.scaled) lines.splice(1, 0, T(lang, "unscaled"));
    if (leg.length) lines.push(`${T(lang, "finishes")}: ` + leg.join(", "));
    if (tb.notes) lines.push(`${T(lang, "notes")}: ${tb.notes}`);
    lines.slice(0, 5).forEach((line, k) => c.push(`BT /F1 ${f((k === 0 ? 3.4 : 2.8) * PT)} Tf 0 g ${f(m + 2 * PT)} ${f(m + (titleH - 5 - 4.3 * k) * PT)} Td (${esc(line)}) Tj ET`));
    const rows = dr.dimensions.map((d, k) => `D${k + 1} ${d.label || ""}: ` + (d.manual_mm !== null && d.manual_mm !== undefined ? `${g.fmtG(d.manual_mm)} mm` : "?"))
      .concat(g.typedValues(dr).map(([n, v]) => `${n}: ${g.fmtG(v)} mm`));
    if (rows.length) {
      const col = pw * PT * 0.56; c.push(`BT /F1 ${f(2.6 * PT)} Tf 0 g ${f(col)} ${f(m + (titleH - 5) * PT)} Td (${esc(T(lang, "measurements"))}) Tj ET`);
      rows.slice(0, 15).forEach((row, k) => c.push(`BT /F1 ${f(2.6 * PT)} Tf ${f(col + Math.floor(k / 5) * (pw * PT * 0.15))} ${f(m + (titleH - 9 - 3.8 * (k % 5)) * PT)} Td (${esc(row)}) Tj ET`));
    }
    const bar = (100 / s) * PT, bx = pw * PT - m - bar, by = m + 3 * PT;
    c.push(`0 0 0 RG 1.2 w ${f(bx)} ${f(by)} m ${f(bx + bar)} ${f(by)} l S`, `BT /F1 ${f(2.6 * PT)} Tf 0 g ${f(bx)} ${f(by + 2 * PT)} Td (${esc(`100 mm, 1:${s}`)}) Tj ET`);

    const lat1 = (str) => { let o = ""; for (const ch of str) o += ch.charCodeAt(0) < 256 ? ch : "?"; return o; };
    const content = lat1(c.join("\n"));
    const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw * PT)} ${f(ph * PT)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"];
    let out = "%PDF-1.4\n%âãÏÓ\n"; const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return bytes;
  };
})(globalThis.PV = globalThis.PV || {});
