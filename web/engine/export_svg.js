/* SVG at true scale (1 user unit = 1 mm). Port of export_svg.py. */
(function (PV) {
  "use strict";
  const X = (PV.exportSvg = {});
  const G = () => PV.geo, T = (lang, k) => PV.i18n.t(lang, k);
  const DASH = { solid: "", dashed: "3 1.5", dotted: "0.6 1.2" };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const f3 = (v) => { if (Math.abs(v) <= 1e-9) return "0"; let s = v.toFixed(3); if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, ""); return s === "-0" ? "0" : s; };
  X.fmt = f3; X.esc = esc;

  function pathOutline(prims) {
    const d = [];
    for (const loop of G().outlineLoops(prims)) {
      let last = null;
      loop.forEach((prim, i) => {
        if (prim.type === "polyline") {
          let pts = prim.points;
          if (i === 0) { d.push(`M ${f3(pts[0][0])} ${f3(pts[0][1])}`); last = pts[0]; pts = pts.slice(1); }
          for (const p of pts) {
            if (last && Math.abs(p[0] - last[0]) < 1e-6 && Math.abs(p[1] - last[1]) < 1e-6) continue;
            d.push(`L ${f3(p[0])} ${f3(p[1])}`); last = p;
          }
        } else {
          if (i === 0) d.push(`M ${f3(prim.start[0])} ${f3(prim.start[1])}`);
          const large = G().sweepDeg(prim) > 180 ? 1 : 0, sweep = prim.ccw ? 1 : 0, r = f3(prim.radius);
          d.push(`A ${r} ${r} 0 ${large} ${sweep} ${f3(prim.end[0])} ${f3(prim.end[1])}`); last = prim.end;
        }
      });
      d.push("Z");
    }
    return d.join(" ");
  }
  function dimensionSvg(dim, font, color, idx) {
    const g = G().dimGeometry(dim); const [q1, q2] = g.line; const L = Math.hypot(q2[0] - q1[0], q2[1] - q1[1]);
    if (L < 1e-6) return "";
    const nx = -(q2[1] - q1[1]) / L, ny = (q2[0] - q1[0]) / L, t = font * 0.5, sw = f3(font * 0.08), dash = DASH[dim.style] || "";
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ""; const parts = ['<g class="dim">'];
    for (const [a, b] of g.ext) if (G().dist(a, b) > 0.05) parts.push(`<line x1="${f3(a[0])}" y1="${f3(a[1])}" x2="${f3(b[0])}" y2="${f3(b[1])}" stroke="${color}" stroke-width="${f3(font * 0.05)}" stroke-dasharray="0.8 0.8"/>`);
    parts.push(`<line x1="${f3(q1[0])}" y1="${f3(q1[1])}" x2="${f3(q2[0])}" y2="${f3(q2[1])}" stroke="${color}" stroke-width="${sw}"${dashAttr}/>`);
    for (const q of [q1, q2]) parts.push(`<line x1="${f3(q[0] - nx * t)}" y1="${f3(q[1] - ny * t)}" x2="${f3(q[0] + nx * t)}" y2="${f3(q[1] + ny * t)}" stroke="${color}" stroke-width="${sw}"/>`);
    const [mx, my] = g.mid; let txt = esc(g.text); if (idx !== null && idx !== undefined) txt = `D${idx}  ${txt}`;
    parts.push(`<text x="${f3(mx)}" y="${f3(my - font * 0.35)}" font-size="${f3(font)}" text-anchor="middle" fill="${color}" transform="rotate(${f3(g.angle_deg)} ${f3(mx)} ${f3(my)})">${txt}</text></g>`);
    return parts.join("");
  }
  function arrowHead(a, b, size, color) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const l = [b[0] - size * Math.cos(ang - 0.4), b[1] - size * Math.sin(ang - 0.4)], r = [b[0] - size * Math.cos(ang + 0.4), b[1] - size * Math.sin(ang + 0.4)];
    return `<polygon points="${f3(b[0])},${f3(b[1])} ${f3(l[0])},${f3(l[1])} ${f3(r[0])},${f3(r[1])}" fill="${color}" stroke="none"/>`;
  }
  X.b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

  /** dr: drawing object; opts.backgroundJpeg: Uint8Array of the working photo (embedded at 35 % opacity). */
  X.drawingToSvg = (dr, opts = {}) => {
    const g = G(), lang = g.lang(dr), margin = opts.margin === undefined ? 20 : opts.margin, titleBlock = opts.titleBlock !== false;
    const bbox = g.outlineBBox(dr.outline); const ext = g.extent(dr);
    const x0 = ext[0] - margin, y0 = ext[1] - margin, x1 = ext[2] + margin, y1 = ext[3] + margin;
    const tbH = titleBlock ? 34 : 0, W = x1 - x0, H = y1 - y0 + tbH, font = Math.max(2.5, Math.min(6, W / 60));
    const parts = ['<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f3(W)}mm" height="${f3(H)}mm" viewBox="${f3(x0)} ${f3(y0)} ${f3(W)} ${f3(H)}" font-family="Helvetica, Arial, sans-serif">`,
      `<desc>pvsketch production outline. Units: mm (1 user unit = 1 mm). ${esc(dr.meta.calibration || "")}</desc>`,
      `<rect x="${f3(x0)}" y="${f3(y0)}" width="${f3(W)}" height="${f3(H)}" fill="white"/>`];
    if (opts.backgroundJpeg) parts.push(`<g id="photo" opacity="0.35"><image x="0" y="0" width="${f3(dr.width_mm)}" height="${f3(dr.height_mm)}" preserveAspectRatio="none" xlink:href="data:image/jpeg;base64,${X.b64(opts.backgroundJpeg)}"/></g>`);
    const swOut = f3(Math.max(0.25, W / 800)), swo = parseFloat(swOut);
    parts.push(`<g id="outline" fill="none" stroke="#000" stroke-width="${swOut}" stroke-linejoin="round"><path d="${pathOutline(dr.outline)}"/></g>`);
    if (dr.detail.length) {
      parts.push(`<g id="detail" fill="none" stroke="#555" stroke-width="${f3(swo * 0.5)}">`);
      for (const pl of dr.detail) parts.push(`<polyline points="${pl.points.map((p) => `${f3(p[0])},${f3(p[1])}`).join(" ")}"/>`);
      parts.push("</g>");
    }
    if (dr.dimensions.length) { parts.push('<g id="dimensions">'); dr.dimensions.forEach((d, i) => parts.push(dimensionSvg(d, font, "#c00", i + 1))); parts.push("</g>"); }
    if (dr.finishes.length) {
      parts.push(`<g id="finishes" stroke="#333" stroke-width="${f3(swo * 0.35)}" fill="none">`);
      dr.finishes.forEach((f, i) => {
        const fd = g.finishFull(f), pts = f.polygon.map((p) => `${f3(p[0])},${f3(p[1])}`).join(" ");
        parts.push(`<g class="finish" data-kind="${esc(f.kind)}"><polygon points="${pts}" stroke="#777" stroke-dasharray="1 1"/>`);
        const d = fd.hatch.lines.map(([p, q]) => `M ${f3(p[0])} ${f3(p[1])} L ${f3(q[0])} ${f3(q[1])}`).join(" ");
        if (d) parts.push(`<path d="${d}"/>`);
        if (fd.hatch.dots.length) { const r = f3(Math.max(0.2, (g.finishSpacing(f) || 4) * 0.12)); parts.push('<g fill="#333" stroke="none">' + fd.hatch.dots.map(([x, y]) => `<circle cx="${f3(x)}" cy="${f3(y)}" r="${r}"/>`).join("") + "</g>"); }
        const [cx, cy] = fd.centroid;
        parts.push(`<text x="${f3(cx)}" y="${f3(cy)}" font-size="${f3(font * 0.9)}" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="${f3(font * 0.25)}" paint-order="stroke">F${i + 1} ${esc(f.label || PV.i18n.finishName(f.kind, lang))}</text></g>`);
      });
      parts.push("</g>");
    }
    if (dr.sketches.length) {
      parts.push(`<g id="sketch" stroke="#06c" stroke-width="${f3(swo * 0.7)}" fill="none">`);
      for (const sk of dr.sketches) {
        const dash = DASH[sk.style] || "";
        parts.push(`<polyline points="${sk.points.map((p) => `${f3(p[0])},${f3(p[1])}`).join(" ")}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
        if (sk.arrow && sk.points.length >= 2) parts.push(arrowHead(sk.points[sk.points.length - 2], sk.points[sk.points.length - 1], font * 0.8, "#06c"));
        if (sk.text) parts.push(`<text x="${f3(sk.points[0][0] + 1.5)}" y="${f3(sk.points[0][1] - 1.5)}" font-size="${f3(font * 0.9)}" fill="#06c" stroke="none">${esc(sk.text)}</text>`);
      }
      parts.push("</g>");
    }
    if (dr.labels.length) { parts.push('<g id="labels">'); for (const l of dr.labels) parts.push(`<text x="${f3(l.pos[0])}" y="${f3(l.pos[1])}" font-size="${f3(font)}" fill="#06c">${esc(l.text)}</text>`); parts.push("</g>"); }
    if (titleBlock) {
      const ty = y1 + 4, info = dr.meta, tb = dr.titleblock || {};
      let line1 = esc(tb.project || info.name || "stone");
      for (const k of ["element", "material", "quantity"]) if (tb[k]) line1 += `  -  ${T(lang, k)}: ${esc(tb[k])}`;
      const bb = bbox ? `${T(lang, "outline")} ${(bbox[2] - bbox[0]).toFixed(1)} x ${(bbox[3] - bbox[1]).toFixed(1)} mm` : "";
      let line2 = `${T(lang, "title")}  -  ${new Date().toISOString().slice(0, 10)}  -  ${bb}  -  ${T(lang, "scale")} 1:1, ${T(lang, "units")}`;
      if (!info.scaled) line2 = `${T(lang, "unscaled")}  -  ` + line2;
      let line3 = `${esc(info.calibration || "")}  -  ${T(lang, "source")} ${esc(info.source || "")}`;
      if (tb.drawn_by) line3 += `  -  ${T(lang, "drawn_by")}: ${esc(tb.drawn_by)}`;
      if (tb.finish || dr.finishes.length) {
        const leg = (tb.finish ? [esc(tb.finish)] : []).concat(dr.finishes.map((f, i) => `F${i + 1} ${esc(g.finishLegend(f, lang))}`));
        line3 += `  -  ${T(lang, "finishes")}: ` + leg.join(", ");
      }
      parts.push(`<g id="titleblock" font-size="${f3(font * 0.8)}" fill="#000"><line x1="${f3(x0)}" y1="${f3(y1)}" x2="${f3(x1)}" y2="${f3(y1)}" stroke="#000" stroke-width="0.3"/>` +
        `<text x="${f3(x0 + 3)}" y="${f3(ty + font)}" font-weight="bold">${line1}</text><text x="${f3(x0 + 3)}" y="${f3(ty + font * 2.2)}">${line2}</text><text x="${f3(x0 + 3)}" y="${f3(ty + font * 3.4)}">${line3}</text>`);
      const extra = []; const tv = g.typedValues(dr);
      if (tv.length) extra.push(tv.map(([n, v]) => `${esc(n)} ${g.fmtG(v)} mm`).join(", "));
      if (tb.notes) extra.push(`${T(lang, "notes")}: ${esc(tb.notes)}`);
      if (extra.length) parts.push(`<text x="${f3(x0 + 3)}" y="${f3(ty + font * 4.6)}">${extra.join("  -  ")}</text>`);
      const bar = W > 160 ? 100 : 50, bx = x1 - bar - 4, by = ty + font * 2.2;
      parts.push(`<line x1="${f3(bx)}" y1="${f3(by)}" x2="${f3(bx + bar)}" y2="${f3(by)}" stroke="#000" stroke-width="0.8"/><text x="${f3(bx + bar / 2)}" y="${f3(by - 1.5)}" text-anchor="middle">${bar} mm</text></g>`);
    }
    parts.push("</svg>");
    return parts.join("\n");
  };
})(globalThis.PV = globalThis.PV || {});
