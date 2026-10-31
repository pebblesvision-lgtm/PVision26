/* DXF (R12 / AC1009, mm, y-up). Opens in virtually every CAD/CAM package.
   Layers: OUTLINE, DETAIL, DIM, TEXT, FINISH, FINISH_BOUNDARY, SKETCH. Dimensions are exploded (lines + text). */
(function (PV) {
  "use strict";
  const D = (PV.exportDxf = {});
  const G = () => PV.geo, T = (lang, k) => PV.i18n.t(lang, k);
  const LT = { solid: "CONTINUOUS", dashed: "DASHED", dotted: "DOT" };
  const ascii = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "?");
  const n4 = (v) => (Number.isFinite(v) ? v.toFixed(4) : "0.0000");

  D.drawingToDxf = (dr) => {
    const g = G(), lang = g.lang(dr), H = dr.height_mm, o = [];
    const add = (code, val) => { o.push(String(code)); o.push(String(val)); };
    const Y = (p) => [p[0], H - p[1]];
    const layers = [["OUTLINE", 7], ["DETAIL", 8], ["DIM", 1], ["TEXT", 5], ["FINISH", 8], ["FINISH_BOUNDARY", 9], ["SKETCH", 4]];
    add(0, "SECTION"); add(2, "HEADER"); add(9, "$ACADVER"); add(1, "AC1009"); add(0, "ENDSEC");
    add(0, "SECTION"); add(2, "TABLES");
    add(0, "TABLE"); add(2, "LTYPE"); add(70, 3);
    add(0, "LTYPE"); add(2, "CONTINUOUS"); add(70, 0); add(3, "Solid line"); add(72, 65); add(73, 0); add(40, "0.0");
    add(0, "LTYPE"); add(2, "DASHED"); add(70, 0); add(3, "Dashed"); add(72, 65); add(73, 2); add(40, "6.0"); add(49, "4.0"); add(49, "-2.0");
    add(0, "LTYPE"); add(2, "DOT"); add(70, 0); add(3, "Dot"); add(72, 65); add(73, 2); add(40, "1.5"); add(49, "0.3"); add(49, "-1.2");
    add(0, "ENDTAB");
    add(0, "TABLE"); add(2, "LAYER"); add(70, layers.length);
    for (const [name, color] of layers) { add(0, "LAYER"); add(2, name); add(70, 0); add(62, color); add(6, "CONTINUOUS"); }
    add(0, "ENDTAB");
    add(0, "TABLE"); add(2, "STYLE"); add(70, 1); add(0, "STYLE"); add(2, "STANDARD"); add(70, 0); add(40, "0.0"); add(41, "1.0"); add(50, "0.0"); add(71, 0); add(42, "2.5"); add(3, "txt"); add(4, ""); add(0, "ENDTAB");
    add(0, "ENDSEC");
    add(0, "SECTION"); add(2, "ENTITIES");

    const lineEnt = (a, b, layer, lt) => { add(0, "LINE"); add(8, layer); if (lt && lt !== "CONTINUOUS") add(6, lt); add(10, n4(a[0])); add(20, n4(a[1])); add(30, "0.0"); add(11, n4(b[0])); add(21, n4(b[1])); add(31, "0.0"); };
    const polyEnt = (pts, closed, layer, lt) => {
      if (pts.length < 2) return;
      add(0, "POLYLINE"); add(8, layer); if (lt && lt !== "CONTINUOUS") add(6, lt); add(66, 1); add(70, closed ? 1 : 0);
      for (const p of pts) { add(0, "VERTEX"); add(8, layer); add(10, n4(p[0])); add(20, n4(p[1])); add(30, "0.0"); }
      add(0, "SEQEND"); add(8, layer);
    };
    const textEnt = (text, p, height, layer, rot = 0, center = false) => {
      add(0, "TEXT"); add(8, layer); add(10, n4(p[0])); add(20, n4(p[1])); add(30, "0.0"); add(40, n4(height)); add(1, ascii(text));
      if (rot) add(50, n4(rot));
      if (center) { add(72, 1); add(73, 1); add(11, n4(p[0])); add(21, n4(p[1])); add(31, "0.0"); }
    };
    const norm = (a) => ((a % 360) + 360) % 360;

    for (const prim of dr.outline) {
      if (prim.type === "polyline") polyEnt(prim.points.map(Y), prim.closed, "OUTLINE");
      else {
        const [cx, cy] = Y(prim.center), [sx, sy] = Y(prim.start), [ex, ey] = Y(prim.end);
        let a0 = (Math.atan2(sy - cy, sx - cx) * 180) / Math.PI, a1 = (Math.atan2(ey - cy, ex - cx) * 180) / Math.PI;
        if (prim.ccw) [a0, a1] = [a1, a0];                          // flipping y reverses the sweep direction
        add(0, "ARC"); add(8, "OUTLINE"); add(10, n4(cx)); add(20, n4(cy)); add(30, "0.0"); add(40, n4(prim.radius)); add(50, n4(norm(a0))); add(51, n4(norm(a1)));
      }
    }
    for (const pl of dr.detail) polyEnt(pl.points.map(Y), pl.closed, "DETAIL");
    dr.finishes.forEach((f, i) => {
      const fd = g.finishFull(f);
      polyEnt(f.polygon.map(Y), true, "FINISH_BOUNDARY", "DASHED");
      for (const [p, q] of fd.hatch.lines) lineEnt(Y(p), Y(q), "FINISH");
      for (const p of fd.hatch.dots) { const [x, y] = Y(p); add(0, "CIRCLE"); add(8, "FINISH"); add(10, n4(x)); add(20, n4(y)); add(30, "0.0"); add(40, n4(Math.max(0.2, (g.finishSpacing(f) || 4) * 0.12))); }
      textEnt(`F${i + 1} ${g.finishLegend(f, lang)}`, Y(fd.centroid), 3, "TEXT", 0, true);
    });
    for (const sk of dr.sketches) {
      polyEnt(sk.points.map(Y), false, "SKETCH", LT[sk.style]);
      if (sk.arrow && sk.points.length >= 2) {
        const a = Y(sk.points[sk.points.length - 2]), b = Y(sk.points[sk.points.length - 1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        for (const da of [-0.4, 0.4]) lineEnt(b, [b[0] - 2.5 * Math.cos(ang + da), b[1] - 2.5 * Math.sin(ang + da)], "SKETCH");
      }
      if (sk.text) { const p = Y(sk.points[0]); textEnt(sk.text, [p[0] + 1.5, p[1] + 1.5], 3, "SKETCH"); }
    }
    dr.dimensions.forEach((d, i) => {
      const gg = g.dimGeometry(d), q1 = Y(gg.line[0]), q2 = Y(gg.line[1]); if (g.dist(q1, q2) < 1e-6) return;
      for (const [a, b] of gg.ext) lineEnt(Y(a), Y(b), "DIM");
      lineEnt(q1, q2, "DIM", LT[d.style]);
      const dx = q2[0] - q1[0], dy = q2[1] - q1[1], L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      for (const q of [q1, q2]) lineEnt([q[0] - nx * 2, q[1] - ny * 2], [q[0] + nx * 2, q[1] + ny * 2], "DIM");
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI; if (ang > 90 || ang < -90) ang += 180;
      textEnt(`D${i + 1} ${gg.text}`, [(q1[0] + q2[0]) / 2 + nx * 1.5, (q1[1] + q2[1]) / 2 + ny * 1.5], 3.5, "DIM", ang, true);
    });
    for (const lb of dr.labels) textEnt(lb.text, Y(lb.pos), 3.5, "TEXT");
    const tb = dr.titleblock || {}; let head = String(tb.project || dr.meta.name || "");
    for (const k of ["element", "material", "quantity", "finish", "drawn_by"]) if (tb[k]) head += `  ${T(lang, k)}: ${tb[k]}`;
    let note = `pvsketch - ${T(lang, "units")} - ${dr.meta.calibration || ""} - ${dr.meta.source || ""}`; if (!dr.meta.scaled) note = T(lang, "unscaled") + " - " + note;
    const bb = g.outlineBBox(dr.outline); let ty = bb ? H - bb[3] - 12 : -12; const tx = bb ? bb[0] : 0;
    if (head.trim()) { textEnt(head, [tx, ty], 3.5, "TEXT"); ty -= 6; }
    textEnt(note, [tx, ty], 3, "TEXT"); if (tb.notes) textEnt(String(tb.notes), [tx, ty - 6], 3, "TEXT");
    add(0, "ENDSEC"); add(0, "EOF");
    return o.join("\n") + "\n";
  };
})(globalThis.PV = globalThis.PV || {});
