/* CSV of the registered measurements (semicolon separated, UTF-8 with BOM for Excel). */
(function (PV) {
  "use strict";
  const q = (v) => { const s = String(v === null || v === undefined ? "" : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  PV.exportTable = {
    dimensionsCsv: (dr) => {
      const g = PV.geo, lang = g.lang(dr), rows = [["id", "label", "kind", "value_mm", "x1_mm", "y1_mm", "x2_mm", "y2_mm", "note"]];
      dr.dimensions.forEach((d, i) => rows.push([`D${i + 1}`, d.label, d.kind, d.manual_mm === null ? "" : g.fmtG(d.manual_mm), d.p1[0].toFixed(1), d.p1[1].toFixed(1), d.p2[0].toFixed(1), d.p2[1].toFixed(1), d.note]));
      for (const [name, v] of g.typedValues(dr)) rows.push(["", name, "value", g.fmtG(v), "", "", "", "", "typed, not on drawing"]);
      if (dr.finishes.length) { rows.push([]); dr.finishes.forEach((f, i) => rows.push([`F${i + 1}`, g.finishLegend(f, lang)])); }
      const bb = g.outlineBBox(dr.outline); if (bb) { rows.push([]); rows.push(["outline_bbox_mm", (bb[2] - bb[0]).toFixed(1), (bb[3] - bb[1]).toFixed(1)]); }
      rows.push(["project", dr.meta.name || "", dr.meta.calibration || "", dr.meta.scaled ? "" : "NOT TO SCALE"]);
      return "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n") + "\r\n";
    },
  };
})(globalThis.PV = globalThis.PV || {});
