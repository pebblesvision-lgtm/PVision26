/* Raster rendering of a drawing (PNG / JPEG export and the export preview) with Canvas 2D. Port of drawing_to_png. */
(function (PV) {
  "use strict";
  PV.render = {
    async drawingToImage(dr, o = {}) {
      const g = PV.geo, lang = g.lang(dr), margin = 20, bb = g.extent(dr);
      const wmm = bb[2] - bb[0] + 2 * margin, hmm = bb[3] - bb[1] + 2 * margin;
      let k = o.pxPerMm || 4; if (o.maxSide) k = Math.min(k, o.maxSide / Math.max(wmm, hmm));
      const x0 = bb[0] - margin, y0 = bb[1] - margin, W = Math.max(10, Math.round(wmm * k)), H = Math.max(10, Math.round(hmm * k));
      const canvas = PV.io.createCanvas(W, H), ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
      if (o.background) {
        const bmp = await PV.io.bitmapFromBytes(o.background), s = k / (dr.meta.ppm || k);
        ctx.save(); ctx.globalAlpha = 0.4; ctx.setTransform(s, 0, 0, s, -x0 * k, -y0 * k); ctx.drawImage(bmp, 0, 0); ctx.restore(); bmp.close && bmp.close();
      }
      const Pt = (p) => [(p[0] - x0) * k, (p[1] - y0) * k];
      const poly = (pts, closed, color, w) => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = Pt(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (closed) ctx.closePath(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); };
      const line = (a, b, color, w) => { const A = Pt(a), B = Pt(b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(); };
      const text = (t, p, color, size) => { const [x, y] = Pt(p); ctx.font = `${size}px sans-serif`; ctx.fillStyle = color; ctx.fillText(t, x, y); };
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      for (const pl of dr.detail) poly(pl.points, false, "#787878", 1);
      for (const loop of g.outlineLoops(dr.outline)) { const pts = []; for (const prim of loop) pts.push(...g.primitivePoints(prim)); if (pts.length) poly(pts, true, "#000", 2); }
      for (const f of dr.finishes) {
        const fd = g.finishFull(f); ctx.beginPath();
        for (const [p, q] of fd.hatch.lines) { const A = Pt(p), B = Pt(q); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
        ctx.strokeStyle = "#5a5a5a"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "#5a5a5a"; for (const p of fd.hatch.dots) { const [x, y] = Pt(p); ctx.fillRect(x - 1, y - 1, 2, 2); }
        poly(f.polygon, true, "#8c8c8c", 1);
      }
      for (const sk of dr.sketches) { if (sk.points.length >= 2) poly(sk.points, false, "#0064c8", 1); if (sk.text) text(sk.text, sk.points[0], "#0064c8", 14); }
      dr.dimensions.forEach((d, i) => {
        const gg = g.dimGeometry(d);
        for (const [a, b] of gg.ext) line(a, b, "#e67878", 1);
        line(gg.line[0], gg.line[1], "#c80000", 1);
        for (const q of gg.line) { const [x, y] = Pt(q); ctx.fillStyle = "#c80000"; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
        const mid = [(gg.line[0][0] + gg.line[1][0]) / 2, (gg.line[0][1] + gg.line[1][1]) / 2]; const [mx, my] = Pt(mid);
        ctx.font = "14px sans-serif"; ctx.fillStyle = "#c80000"; ctx.textAlign = "center"; ctx.fillText(`D${i + 1} ${gg.text}`, mx, my - 6); ctx.textAlign = "left";
      });
      for (const l of dr.labels) text(l.text, l.pos, "#0064c8", 15);
      if (!dr.meta.scaled) { ctx.font = "bold 18px sans-serif"; ctx.fillStyle = "#c80000"; ctx.fillText("NIET OP SCHAAL / NOT TO SCALE", 10, H - 10); }
      const blob = await canvas.convertToBlob({ type: o.mime || "image/png", quality: 0.9 });
      return new Uint8Array(await blob.arrayBuffer());
    },
  };
})(globalThis.PV = globalThis.PV || {});
