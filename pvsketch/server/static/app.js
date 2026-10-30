/* pvsketch UI - vanilla JS, no build step, works offline. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ------------------------------------------------------------ state ----
  const S = {
    project: null,           // server state
    step: "photo",
    img: null,               // HTMLImageElement currently shown
    imgKind: null,           // "original" | "rectified" | "overlay"
    view: { scale: 1, tx: 0, ty: 0 },
    calPoints: [],           // original px
    seg: null,               // see newSeg()
    drawing: null,           // {outline, detail, dimensions, labels, bbox, width_mm...}
    outlineTool: "view",
    edit: { drag: null, sel: null },
    measure: { tool: "aligned", pending: null, hover: null, hl: null, dragDim: null },
    showPhoto: true,
    panning: null,
  };
  const newSeg = () => ({ rect: null, polygon: [], strokes: [], tool: "points", drag: null, dragStart: null, stroke: null, dragPoint: null });
  S.seg = newSeg();
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const DPR = window.devicePixelRatio || 1;

  // ----------------------------------------------------------- history ----
  // One undo stack per editable thing; the active one follows the step.
  class History {
    constructor(get, set) { this.get = get; this.set = set; this.past = []; this.future = []; }
    snap() { this.past.push(JSON.stringify(this.get())); if (this.past.length > 100) this.past.shift(); this.future = []; updateUndoButtons(); }
    undo() { if (!this.past.length) return false; this.future.push(JSON.stringify(this.get())); this.set(JSON.parse(this.past.pop())); updateUndoButtons(); return true; }
    redo() { if (!this.future.length) return false; this.past.push(JSON.stringify(this.get())); this.set(JSON.parse(this.future.pop())); updateUndoButtons(); return true; }
    clear() { this.past = []; this.future = []; updateUndoButtons(); }
  }
  const segHist = new History(() => ({ rect: S.seg.rect, polygon: S.seg.polygon, strokes: S.seg.strokes }),
    (v) => { Object.assign(S.seg, v, { drag: null, stroke: null, dragPoint: null }); draw(); });
  const outlineHist = new History(() => S.drawing ? S.drawing.outline : [],
    (v) => { if (S.drawing) { S.drawing.outline = v; saveOutline(); draw(); } });
  const dimHist = new History(() => S.drawing ? { dimensions: S.drawing.dimensions, labels: S.drawing.labels } : { dimensions: [], labels: [] },
    (v) => { if (S.drawing) { S.drawing.dimensions = v.dimensions; S.drawing.labels = v.labels; saveAnnotations(); renderDimTable(); draw(); } });
  const activeHist = () => ({ isolate: segHist, outline: outlineHist, measure: dimHist })[S.step] || null;
  function updateUndoButtons() {
    const h = activeHist();
    $("#btn-undo").disabled = !(h && h.past.length);
    $("#btn-redo").disabled = !(h && h.future.length);
  }
  $("#btn-undo").onclick = () => { const h = activeHist(); if (h) h.undo(); };
  $("#btn-redo").onclick = () => { const h = activeHist(); if (h) h.redo(); };

  // ----------------------------------------------------------- helpers ----
  const api = async (url, opts = {}) => {
    const r = await fetch(url, opts);
    let body = null;
    try { body = await r.json(); } catch (_) { /* no body */ }
    if (!r.ok) throw new Error((body && body.error) || `${r.status} ${r.statusText}`);
    return body;
  };
  const json = (method) => (url, data) => api(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const post = json("POST"), put = json("PUT"), patch = json("PATCH");

  let toastT = null;
  const toast = (msg, err = false) => {
    const t = $("#toast"); t.textContent = msg; t.hidden = false; t.className = err ? "err" : "";
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), err ? 6000 : 2500);
  };
  const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.dataset.label ??= btn.textContent; btn.textContent = on ? "Working…" : btn.dataset.label; } };
  const fmt = (v, d = 1) => Number(v).toFixed(d);
  const ppm = () => (S.project && S.project.calibration ? S.project.calibration.ppm : 1);
  const pid = () => S.project.id;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });

  async function showImage(kind) {
    if (!S.project) return;
    const im = await loadImage(`/api/projects/${pid()}/image/${kind}?t=${Date.now()}`);
    const sameSize = S.img && S.img.width === im.width && S.img.height === im.height;
    S.img = im; S.imgKind = kind;
    if (!sameSize) fitView();
    draw();
  }

  // --------------------------------------------------------- view math ----
  function resizeCanvas() {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.round(r.width * DPR); canvas.height = Math.round(r.height * DPR);
    draw();
  }
  function fitView() {
    if (!S.img) return;
    const r = canvas.getBoundingClientRect();
    const s = Math.min(r.width / S.img.width, r.height / S.img.height) * 0.96;
    S.view = { scale: s, tx: (r.width - S.img.width * s) / 2, ty: (r.height - S.img.height * s) / 2 };
  }
  const toImg = (sx, sy) => [(sx - S.view.tx) / S.view.scale, (sy - S.view.ty) / S.view.scale];
  const toScreen = (ix, iy) => [ix * S.view.scale + S.view.tx, iy * S.view.scale + S.view.ty];
  const mmToImg = (p) => [p[0] * ppm(), p[1] * ppm()];
  const imgToMm = (p) => [p[0] / ppm(), p[1] / ppm()];
  const mmToScreen = (p) => toScreen(...mmToImg(p));
  const screenToMm = (sx, sy) => imgToMm(toImg(sx, sy));
  const evtPos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const pxTolMm = (px) => px / S.view.scale / ppm();   // screen px -> mm at current zoom

  // -------------------------------------------------- dimension geometry ----
  // Mirror of pvsketch.geometry.dimension_geometry (mm, y-down).
  function dimGeom(d) {
    const [x1, y1] = d.p1, [x2, y2] = d.p2, off = +d.offset_mm || 0;
    let q1, q2, ang;
    if (d.kind === "horizontal") {
      const yl = (off >= 0 ? Math.max(y1, y2) : Math.min(y1, y2)) + off;
      q1 = [x1, yl]; q2 = [x2, yl]; ang = 0;
    } else if (d.kind === "vertical") {
      const xl = (off >= 0 ? Math.max(x1, x2) : Math.min(x1, x2)) + off;
      q1 = [xl, y1]; q2 = [xl, y2]; ang = -Math.PI / 2;
    } else {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      q1 = [x1 + nx * off, y1 + ny * off]; q2 = [x2 + nx * off, y2 + ny * off];
      ang = Math.atan2(dy, dx); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    }
    return { ext: [[d.p1, q1], [d.p2, q2]], line: [q1, q2], mid: [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2], ang };
  }
  const dimValue = (d) => (d.manual_mm != null && d.manual_mm !== "" ? Number(d.manual_mm) : d.auto_mm);
  function dimAuto(d) {
    const dx = d.p2[0] - d.p1[0], dy = d.p2[1] - d.p1[1];
    return d.kind === "horizontal" ? Math.abs(dx) : d.kind === "vertical" ? Math.abs(dy) : Math.hypot(dx, dy);
  }
  function dimText(d) {
    let txt = fmt(dimValue(d));
    if (d.manual_mm != null && d.manual_mm !== "" && Math.abs(d.manual_mm - d.auto_mm) > 0.05) txt += ` (photo ${fmt(d.auto_mm)})`;
    if (d.label) txt = `${d.label}: ${txt}`;
    return txt;
  }
  // offset such that the dimension line passes through mm point m (for dragging)
  function offsetFor(d, m) {
    if (d.kind === "horizontal") { const yb = m[1] >= Math.max(d.p1[1], d.p2[1]) ? Math.max(d.p1[1], d.p2[1]) : m[1] <= Math.min(d.p1[1], d.p2[1]) ? Math.min(d.p1[1], d.p2[1]) : null; return yb == null ? 0 : m[1] - yb; }
    if (d.kind === "vertical") { const xb = m[0] >= Math.max(d.p1[0], d.p2[0]) ? Math.max(d.p1[0], d.p2[0]) : m[0] <= Math.min(d.p1[0], d.p2[0]) ? Math.min(d.p1[0], d.p2[0]) : null; return xb == null ? 0 : m[0] - xb; }
    const dx = d.p2[0] - d.p1[0], dy = d.p2[1] - d.p1[1], L = Math.hypot(dx, dy) || 1;
    return ((m[0] - d.p1[0]) * (-dy / L) + (m[1] - d.p1[1]) * (dx / L));
  }
  function distToSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    return dist(p, [a[0] + t * dx, a[1] + t * dy]);
  }

  // -------------------------------------------------------------- draw ----
  function draw() {
    const r = canvas.getBoundingClientRect();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    if (!S.img) { drawEmpty(r); return; }
    ctx.save();
    ctx.translate(S.view.tx, S.view.ty); ctx.scale(S.view.scale, S.view.scale);
    ctx.imageSmoothingEnabled = S.view.scale < 2;
    const showPhoto = S.step === "calibrate" || S.step === "isolate" || S.showPhoto;
    if (showPhoto) ctx.drawImage(S.img, 0, 0);
    else { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S.img.width, S.img.height); }
    ctx.restore();

    if (S.step === "calibrate") drawCalibration();
    if (S.step === "isolate") drawSegmentation();
    if (["outline", "measure", "export"].includes(S.step)) drawVectors();
    if (S.step === "outline" && S.outlineTool === "edit") drawEditHandles();
    if (S.step === "measure") drawMeasure();
  }
  function drawEmpty(r) {
    ctx.fillStyle = "#8e98a3"; ctx.font = "15px system-ui"; ctx.textAlign = "center";
    ctx.fillText("Upload a photo to begin", r.width / 2, r.height / 2);
  }
  function dot(p, color, label, rad = 6) {
    const [x, y] = toScreen(p[0], p[1]);
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.stroke();
    if (label !== undefined) { ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "left"; ctx.fillText(label, x + 9, y - 9); }
  }
  function drawCalibration() {
    const pts = S.calPoints;
    if (pts.length >= 2) {
      ctx.beginPath();
      pts.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (pts.length === 4) ctx.closePath();
      ctx.strokeStyle = "rgba(242,169,59,.9)"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    pts.forEach((p, i) => dot(p, "#f2a93b", String(i + 1)));
  }
  // strokes are rendered in order onto an offscreen layer so the eraser really erases
  const strokeLayer = document.createElement("canvas");
  function drawSegmentation() {
    const g = S.seg;
    const rect = g.drag || g.rect;
    if (rect) {
      const [x, y] = toScreen(rect[0], rect[1]);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = "#4fb3ff"; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, rect[2] * S.view.scale, rect[3] * S.view.scale); ctx.setLineDash([]);
    }
    // paint layer
    const r = canvas.getBoundingClientRect();
    if (strokeLayer.width !== canvas.width || strokeLayer.height !== canvas.height) { strokeLayer.width = canvas.width; strokeLayer.height = canvas.height; }
    const lc = strokeLayer.getContext("2d");
    lc.setTransform(DPR, 0, 0, DPR, 0, 0); lc.clearRect(0, 0, r.width, r.height);
    lc.lineCap = "round"; lc.lineJoin = "round";
    const all = g.strokes.concat(g.stroke ? [g.stroke] : []);
    for (const s of all) {
      lc.globalCompositeOperation = s.kind === "erase" ? "destination-out" : "source-over";
      lc.strokeStyle = s.kind === "fg" ? "rgba(79,209,139,.8)" : s.kind === "bg" ? "rgba(255,107,107,.8)" : "rgba(0,0,0,1)";
      lc.lineWidth = Math.max(2, 2 * s.r * S.view.scale);
      lc.beginPath();
      s.pts.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); i ? lc.lineTo(x, y) : lc.moveTo(x, y); });
      if (s.pts.length === 1) { const [x, y] = toScreen(s.pts[0][0], s.pts[0][1]); lc.lineTo(x + 0.1, y); }
      lc.stroke();
    }
    lc.globalCompositeOperation = "source-over";
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(strokeLayer, 0, 0); ctx.restore();
    // polygon
    const poly = g.polygon;
    if (poly.length) {
      ctx.beginPath();
      poly.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = "#f2a93b"; ctx.lineWidth = 1.5; ctx.stroke();
      if (poly.length > 2) {
        const a = toScreen(...poly[poly.length - 1]), b = toScreen(...poly[0]);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
      }
      // band preview
      if (!$("#seg-exact").checked && poly.length > 2) {
        ctx.beginPath();
        poly.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath(); ctx.strokeStyle = "rgba(242,169,59,.18)"; ctx.lineWidth = Math.max(1, 2 * (+$("#band-mm").value) * ppm() * S.view.scale); ctx.stroke();
      }
      poly.forEach((p, i) => dot(p, i === 0 ? "#fff" : "#f2a93b", undefined, 5));
    }
    // brush cursor
    if (["fg", "bg", "erase"].includes(g.tool) && g.cursor) {
      const [x, y] = toScreen(...g.cursor);
      ctx.beginPath(); ctx.arc(x, y, (+$("#brush-size").value) * S.view.scale, 0, Math.PI * 2);
      ctx.strokeStyle = g.tool === "erase" ? "#fff" : g.tool === "fg" ? "#4fd18b" : "#ff6b6b"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  function pathArc(prim) {
    const [cx, cy] = mmToScreen(prim.center);
    const r = prim.radius * ppm() * S.view.scale;
    const a0 = Math.atan2(prim.start[1] - prim.center[1], prim.start[0] - prim.center[0]);
    const a1 = Math.atan2(prim.end[1] - prim.center[1], prim.end[0] - prim.center[0]);
    ctx.arc(cx, cy, r, a0, a1, !prim.ccw);
  }
  function traceOutline(outline) {
    ctx.beginPath();
    let first = true;
    for (const prim of outline) {
      if (prim.type === "polyline") {
        prim.points.forEach((p, i) => { const [x, y] = mmToScreen(p); (first && i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      } else {
        if (first) { const [x, y] = mmToScreen(prim.start); ctx.moveTo(x, y); }
        pathArc(prim);
      }
      first = false;
    }
    ctx.closePath();
  }
  function drawVectors() {
    const d = S.drawing; if (!d) return;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (d.outline && d.outline.length) {
      traceOutline(d.outline);
      ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = "#ffe76a"; ctx.lineWidth = 2; ctx.stroke();
      if (S.step === "outline") {
        for (const prim of d.outline) {
          if (prim.type === "arc") {
            const [cx, cy] = mmToScreen(prim.center);
            ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = "#4fb3ff"; ctx.fill();
            ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.fillText(`R${fmt(prim.radius)}`, cx + 5, cy - 5);
          }
        }
        if (S.outlineTool !== "edit") for (const v of outlineVertices()) { const [x, y] = mmToScreen(v); ctx.fillStyle = "#ffe76a"; ctx.fillRect(x - 2, y - 2, 4, 4); }
      }
    }
    if (d.detail && d.detail.length) {
      ctx.beginPath();
      for (const pl of d.detail) { pl.points.forEach((p, i) => { const [x, y] = mmToScreen(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (pl.closed) ctx.closePath(); }
      ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = "#8fd1ff"; ctx.lineWidth = 1.2; ctx.stroke();
    }
    for (const [i, dim] of (d.dimensions || []).entries()) drawDim(dim, i, S.measure.hl === i);
    for (const lb of d.labels || []) {
      const [x, y] = mmToScreen(lb.pos);
      ctx.font = "bold 13px system-ui"; ctx.textAlign = "left";
      ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.strokeText(lb.text, x, y); ctx.fillStyle = "#8fd1ff"; ctx.fillText(lb.text, x, y);
    }
  }
  function drawEditHandles() {
    const d = S.drawing; if (!d) return;
    for (const h of editHandles()) {
      const [x, y] = mmToScreen(h.p);
      const sel = S.edit.sel && S.edit.sel.key === h.key;
      ctx.beginPath(); ctx.rect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = sel ? "#ff6b6b" : h.arc ? "#4fb3ff" : "#ffe76a"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  const DASHES = { solid: [], dashed: [8, 4], dotted: [2, 4] };
  function drawDim(dim, idx, hl) {
    const g = dimGeom(dim);
    const q1 = mmToScreen(g.line[0]), q2 = mmToScreen(g.line[1]);
    const dx = q2[0] - q1[0], dy = q2[1] - q1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const color = hl ? "#fff" : "#ff6b6b";
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    for (const [a, b] of g.ext) { const A = mmToScreen(a), B = mmToScreen(b); if (dist(A, B) > 1) { ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); } }
    ctx.setLineDash(DASHES[dim.style] || []); ctx.lineWidth = hl ? 2.5 : 1.6;
    ctx.beginPath(); ctx.moveTo(...q1); ctx.lineTo(...q2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath();
    for (const q of [q1, q2]) { ctx.moveTo(q[0] - nx * 7, q[1] - ny * 7); ctx.lineTo(q[0] + nx * 7, q[1] + ny * 7); }
    ctx.stroke();
    const txt = `D${idx + 1}  ${dimText(dim)}`;
    const mx = (q1[0] + q2[0]) / 2, my = (q1[1] + q2[1]) / 2;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(g.ang);
    ctx.font = "bold 12px system-ui"; ctx.textAlign = "center";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(txt, 0, -5); ctx.fillStyle = hl ? "#fff" : "#ff8d8d"; ctx.fillText(txt, 0, -5);
    ctx.restore();
  }
  function drawMeasure() {
    const m = S.measure;
    if (m.pending) dot(mmToImg(m.pending), "#ff6b6b");
    if (m.hover && !m.dragDim) {
      const [x, y] = mmToScreen(m.hover.p);
      ctx.beginPath(); ctx.arc(x, y, m.hover.snapped ? 7 : 4, 0, Math.PI * 2);
      ctx.strokeStyle = m.hover.snapped ? "#4fd18b" : "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      if (m.pending) {
        const tmp = { p1: m.pending, p2: m.hover.p, kind: m.tool, offset_mm: 0, auto_mm: 0, style: "solid" };
        tmp.auto_mm = dimAuto(tmp);
        const g = dimGeom(tmp);
        const a = mmToScreen(g.line[0]), b = mmToScreen(g.line[1]);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.setLineDash([4, 4]); ctx.strokeStyle = "#ff6b6b"; ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "left"; ctx.fillText(`${fmt(tmp.auto_mm)} mm`, x + 10, y - 10);
      }
    }
  }
  function outlineVertices() {
    const d = S.drawing; if (!d || !d.outline) return [];
    const v = [];
    for (const prim of d.outline) {
      if (prim.type === "polyline") v.push(...prim.points);
      else v.push(prim.start, prim.end);
    }
    return v;
  }
  // every editable point: {key, p, prim index, field}
  function editHandles() {
    const out = [];
    (S.drawing.outline || []).forEach((prim, pi) => {
      if (prim.type === "polyline") prim.points.forEach((p, i) => out.push({ key: `${pi}:${i}`, p, pi, i }));
      else { out.push({ key: `${pi}:s`, p: prim.start, pi, field: "start", arc: true }); out.push({ key: `${pi}:e`, p: prim.end, pi, field: "end", arc: true }); }
    });
    return out;
  }

  // ------------------------------------------------------------- steps ----
  function updateStepButtons() {
    const p = S.project;
    const can = { photo: true, calibrate: !!p, isolate: !!(p && p.calibration), outline: !!(p && p.segmentation),
      measure: !!(p && p.outline), export: !!(p && p.calibration) };
    for (const b of $$("#steps .step")) {
      const s = b.dataset.step; b.disabled = !can[s];
      b.classList.toggle("active", s === S.step);
      b.classList.toggle("done", s !== S.step && ({ photo: !!p, calibrate: !!(p && p.calibration), isolate: !!(p && p.segmentation), outline: !!(p && p.outline), measure: !!(p && p.dimensions && p.dimensions.length), export: false })[s]);
    }
    $("#project-title").textContent = p ? `${p.name}  ·  ${p.id}` : "";
    updateUndoButtons();
  }
  async function goStep(step) {
    S.step = step;
    for (const pane of $$(".pane")) pane.hidden = pane.dataset.pane !== step;
    updateStepButtons();
    const hint = $("#viewer-hint");
    S.measure.pending = null; S.measure.hover = null; S.edit = { drag: null, sel: null };
    try {
      if (step === "photo") { hint.textContent = ""; if (S.project) await showImage("original"); await refreshProjects(); }
      if (step === "calibrate") { hint.textContent = "Click reference corners · wheel = zoom · right-drag = pan"; await showImage("original"); }
      if (step === "isolate") { hint.textContent = "Click points along the outer line (or drag a box), then Run · right-drag = pan · Ctrl+Z undo"; await showImage(S.project.segmentation ? "overlay" : "rectified"); }
      if (step === "outline") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); if (!S.project.outline) await runOutline(); }
      if (step === "measure") { hint.textContent = "Click 2 points for a dimension · drag a dimension line to move it · right-drag = pan"; await showImage("rectified"); await loadDrawing(); renderDimTable(); }
      if (step === "export") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); setupExport(); }
    } catch (e) { toast(e.message, true); }
    updateUndoButtons();
    draw();
  }
  $$("#steps .step").forEach((b) => b.addEventListener("click", () => goStep(b.dataset.step)));

  // ------------------------------------------------------------ upload ----
  async function upload(file) {
    if (!file) return;
    const fd = new FormData(); fd.append("photo", file, file.name);
    toast("Uploading…");
    try {
      const st = await api("/api/projects", { method: "POST", body: fd });
      await openProject(st.id);
      toast("Photo loaded");
      goStep("calibrate");
    } catch (e) { toast(e.message, true); }
  }
  async function openProject(id) {
    S.project = await api(`/api/projects/${id}`);
    S.calPoints = []; S.seg = newSeg(); S.drawing = null;
    segHist.clear(); outlineHist.clear(); dimHist.clear();
    if (S.project.calibration && S.project.calibration.mode !== "aruco") S.calPoints = S.project.calibration.ref_points_px.map((p) => [...p]);
    const sg = S.project.segmentation;
    if (sg) {
      S.seg.rect = sg.rect ? [...sg.rect] : null;
      S.seg.polygon = (sg.polygon || []).map((p) => [...p]);
      S.seg.strokes = sg.strokes || [...(sg.fg || []).map((pts) => ({ kind: "fg", pts, r: sg.brush_px || 8 })), ...(sg.bg || []).map((pts) => ({ kind: "bg", pts, r: sg.brush_px || 8 }))];
      $("#seg-exact").checked = sg.mode === "polygon";
      if (sg.band_px) { $("#band-mm").value = Math.round(sg.band_px / ppm()); $("#band-mm-v").textContent = $("#band-mm").value; }
      if (!S.seg.polygon.length && S.seg.rect) setSegTool("box");
    }
    $("#proj-name").value = S.project.name || "";
    updateStepButtons();
  }
  async function refreshProjects() {
    const list = await api("/api/projects");
    const ul = $("#project-list"); ul.innerHTML = "";
    for (const p of list.slice(0, 30)) {
      const li = document.createElement("li");
      const a = document.createElement("a"); a.textContent = `${p.name || p.id}`; a.title = p.id;
      a.onclick = async () => { try { await openProject(p.id); goStep(p.outlined ? "measure" : p.segmented ? "outline" : p.calibrated ? "isolate" : "calibrate"); } catch (e) { toast(e.message, true); } };
      const meta = document.createElement("span"); meta.className = "muted small";
      meta.textContent = `${(p.updated || p.created || "").replace("T", " ").slice(0, 16)} · ${p.outlined ? "outlined" : p.segmented ? "isolated" : p.calibrated ? "calibrated" : "photo"}${p.dimensions ? ` · ${p.dimensions} dims` : ""}`;
      li.append(a, meta); ul.append(li);
    }
    if (!list.length) ul.innerHTML = '<li class="muted">No projects yet</li>';
  }
  const dz = $("#dropzone");
  dz.onclick = () => $("#file-input").click();
  $("#btn-new").onclick = () => $("#file-input").click();
  $("#btn-projects").onclick = () => goStep("photo");
  $("#file-input").onchange = (e) => upload(e.target.files[0]);
  for (const ev of ["dragenter", "dragover"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); });
  dz.addEventListener("drop", (e) => upload(e.dataTransfer.files[0]));
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0] && S.step === "photo") upload(e.dataTransfer.files[0]); });

  // -------------------------------------------------------- calibration ----
  const calMode = () => $("#cal-mode").value;
  $("#cal-mode").onchange = () => {
    const m = calMode();
    $("#cal-custom").hidden = m !== "custom"; $("#cal-aruco").hidden = m !== "aruco"; $("#cal-two").hidden = m !== "two_point";
    $("#cal-instructions").innerHTML = m === "aruco" ? "Lay the printed marker flat on the stone face. Press <b>Detect</b>, then <b>Calibrate</b>."
      : m === "two_point" ? "Click <b>2 points</b> with a known distance between them (e.g. the ends of a ruler). No perspective correction: only use when the camera was square to the face."
      : "Click the <b>4 corners</b> of the reference rectangle in the photo (any order). Zoom with the wheel for precision; drag with the right mouse button to pan.";
    S.calPoints = []; draw();
  };
  $("#btn-cal-clear").onclick = () => { S.calPoints = []; draw(); };
  $("#btn-aruco-detect").onclick = async () => {
    try {
      const ms = await api(`/api/projects/${pid()}/aruco`);
      $("#aruco-result").textContent = ms.length ? `found ${ms.length} marker(s): ids ${ms.map((m) => m.id).join(", ")}` : "no marker found";
      S.calPoints = ms.length ? ms[0].corners : []; draw();
    } catch (e) { toast(e.message, true); }
  };
  $("#btn-calibrate").onclick = async () => {
    const m = calMode();
    const body = { mode: m === "aruco" ? "aruco" : m === "two_point" ? "two_point" : "quad", points: S.calPoints };
    const ppmIn = $("#cal-ppm").value; if (ppmIn) body.ppm = +ppmIn;
    if (m === "custom") { body.sheet = "custom"; body.width_mm = +$("#cal-w").value; body.height_mm = +$("#cal-h").value; }
    else if (m === "aruco") { body.marker_mm = +$("#cal-marker-mm").value; }
    else if (m === "two_point") { body.dist_mm = +$("#cal-dist").value; }
    else body.sheet = m;
    const btn = $("#btn-calibrate"); busy(btn, true);
    try {
      const r = await post(`/api/projects/${pid()}/calibrate`, body);
      S.project = r.state; S.seg = newSeg(); S.drawing = null; segHist.clear();
      const c = r.calibration;
      $("#cal-result").className = "result ok";
      $("#cal-result").textContent = `${c.note}\nrectified image ${c.out_size[0]} x ${c.out_size[1]} px = ${fmt(c.out_size[0] / c.ppm, 0)} x ${fmt(c.out_size[1] / c.ppm, 0)} mm\n${fmt(c.ppm, 2)} px/mm (resolution ≈ ${fmt(1 / c.ppm, 2)} mm per pixel)`;
      updateStepButtons(); toast("Calibrated"); goStep("isolate");
    } catch (e) { $("#cal-result").className = "result err"; $("#cal-result").textContent = e.message; }
    busy(btn, false);
  };

  // ------------------------------------------------------- segmentation ----
  function setSegTool(t) { S.seg.tool = t; $$('[data-pane="isolate"] .tool').forEach((x) => x.classList.toggle("active", x.dataset.tool === t)); draw(); }
  $$('[data-pane="isolate"] .tool').forEach((b) => b.onclick = () => setSegTool(b.dataset.tool));
  $("#brush-size").oninput = (e) => { $("#brush-size-v").textContent = e.target.value; draw(); };
  $("#band-mm").oninput = (e) => { $("#band-mm-v").textContent = e.target.value; draw(); };
  $("#seg-exact").onchange = draw;
  $("#btn-seg-clear").onclick = () => { if (!S.seg.strokes.length) return; segHist.snap(); S.seg.strokes = []; draw(); };
  $("#btn-seg-clear-points").onclick = () => { if (!S.seg.polygon.length) return; segHist.snap(); S.seg.polygon = []; draw(); };
  $("#btn-segment").onclick = async () => {
    const g = S.seg;
    const exact = $("#seg-exact").checked;
    if (g.polygon.length < 3 && !g.rect) { toast("Click at least 3 points along the stone or drag a box first", true); return; }
    if (exact && g.polygon.length < 3) { toast("'Use points exactly' needs at least 3 points", true); return; }
    const btn = $("#btn-segment"); busy(btn, true);
    try {
      const r = await post(`/api/projects/${pid()}/segment`, { rect: g.rect, polygon: g.polygon, strokes: g.strokes, brush_px: +$("#brush-size").value,
        iters: +$("#gc-iters").value, band_px: (+$("#band-mm").value) * ppm(), mode: exact ? "polygon" : "grabcut" });
      S.project = r.state; S.drawing = null; outlineHist.clear();
      const areaMm2 = r.mask_px / (ppm() * ppm());
      $("#seg-result").className = "result ok"; $("#seg-result").textContent = `stone area ≈ ${fmt(areaMm2 / 100, 0)} cm². Check the red boundary. Wrong somewhere? Add points or brush there and Run again, then go to 4.`;
      await showImage("overlay"); updateStepButtons();
    } catch (e) { $("#seg-result").className = "result err"; $("#seg-result").textContent = e.message; }
    busy(btn, false);
  };

  // ------------------------------------------------------------ outline ----
  $("#ol-eps").oninput = (e) => ($("#ol-eps-v").textContent = e.target.value);
  $("#show-photo").onchange = (e) => { S.showPhoto = e.target.checked; draw(); };
  $$('[data-pane="outline"] .tool').forEach((b) => b.onclick = () => { S.outlineTool = b.dataset.tool; S.edit = { drag: null, sel: null }; $$('[data-pane="outline"] .tool').forEach((x) => x.classList.toggle("active", x === b)); $("#viewer-hint").textContent = S.outlineTool === "edit" ? "Drag vertices · double-click a line to add · Alt+click to delete · Ctrl+Z undo" : ""; draw(); });
  function outlineParams() {
    return { epsilon_mm: +$("#ol-eps").value, arc_fit: $("#ol-arcs").checked, smooth_window: +$("#ol-smooth").value,
      min_arc_radius_mm: +$("#ol-minr").value, min_arc_len_mm: +$("#ol-minlen").value,
      detail: { enabled: $("#dt-on").checked, low: +$("#dt-low").value, high: +$("#dt-high").value, min_len_mm: +$("#dt-minlen").value, smooth: +$("#dt-smooth").value } };
  }
  function applyParamsToUI(p) {
    if (!p) return;
    $("#ol-eps").value = p.epsilon_mm; $("#ol-eps-v").textContent = p.epsilon_mm; $("#ol-arcs").checked = !!p.arc_fit; $("#ol-smooth").value = p.smooth_window ?? 5;
    $("#ol-minr").value = p.min_arc_radius_mm ?? 15; $("#ol-minlen").value = p.min_arc_len_mm ?? 12;
    const d = p.detail || {}; $("#dt-on").checked = !!d.enabled; $("#dt-low").value = d.low ?? 30; $("#dt-high").value = d.high ?? 90; $("#dt-minlen").value = d.min_len_mm ?? 15; $("#dt-smooth").value = d.smooth ?? 5;
  }
  async function runOutline() {
    if (S.project.outline_edited && !confirm("You edited this outline by hand. Re-extracting replaces your edits. Continue?")) return;
    const btn = $("#btn-outline"); busy(btn, true);
    try {
      S.drawing = await post(`/api/projects/${pid()}/outline`, { params: outlineParams() });
      S.project = await api(`/api/projects/${pid()}`);
      outlineHist.clear(); describeOutline(); updateStepButtons(); draw();
    } catch (e) { $("#ol-result").className = "result err"; $("#ol-result").textContent = e.message; }
    busy(btn, false);
  }
  function describeOutline() {
    const d = S.drawing; if (!d) return;
    const arcs = d.outline.filter((p) => p.type === "arc").length;
    const segs = d.outline.reduce((n, p) => n + (p.type === "arc" ? 1 : Math.max(0, p.points.length - (p.closed ? 0 : 1))), 0);
    const bb = d.bbox;
    $("#ol-result").className = "result ok";
    $("#ol-result").textContent = bb ? `bounding box ${fmt(bb[2] - bb[0])} x ${fmt(bb[3] - bb[1])} mm\n${segs} straight segments, ${arcs} arcs, ${d.detail.length} detail lines${S.project.outline_edited ? "\n(edited by hand)" : ""}` : "no outline found - check the mask in step 3";
  }
  $("#btn-outline").onclick = runOutline;
  async function loadDrawing() {
    S.drawing = await api(`/api/projects/${pid()}/drawing`);
    applyParamsToUI(S.project.outline_params); describeOutline();
  }
  let saveOutlineT = null;
  function saveOutline() {
    clearTimeout(saveOutlineT);
    saveOutlineT = setTimeout(async () => {
      try {
        S.drawing = await put(`/api/projects/${pid()}/outline`, { outline: S.drawing.outline });
        S.project.outline = S.drawing.outline; S.project.outline_edited = true; describeOutline(); draw();
      } catch (e) { toast(e.message, true); }
    }, 300);
  }
  // move a vertex: all primitive endpoints coincident with it move together
  function moveVertex(from, to) {
    const eps = 1e-6;
    for (const prim of S.drawing.outline) {
      if (prim.type === "polyline") prim.points.forEach((p, i) => { if (dist(p, from) < eps) prim.points[i] = [...to]; });
      else {
        for (const f of ["start", "end"]) if (dist(prim[f], from) < eps) { prim[f] = [...to]; refitArc(prim); }
      }
    }
  }
  // arc through its (kept) midpoint and the moved endpoints
  function refitArc(a) {
    const mid = a._mid || arcMid(a);
    const c = circleFrom3(a.start, mid, a.end);
    if (!c) return;
    a.center = [c.cx, c.cy]; a.radius = c.r;
    const v0 = [a.start[0] - c.cx, a.start[1] - c.cy], v1 = [mid[0] - c.cx, mid[1] - c.cy];
    a.ccw = (v0[0] * v1[1] - v0[1] * v1[0]) > 0;
  }
  function arcMid(a) {
    const a0 = Math.atan2(a.start[1] - a.center[1], a.start[0] - a.center[0]);
    const a1 = Math.atan2(a.end[1] - a.center[1], a.end[0] - a.center[0]);
    let sweep = (a1 - a0) % (2 * Math.PI); if (sweep < 0) sweep += 2 * Math.PI;
    if (!a.ccw) sweep = sweep - 2 * Math.PI;
    const am = a0 + sweep / 2;
    return [a.center[0] + a.radius * Math.cos(am), a.center[1] + a.radius * Math.sin(am)];
  }
  function circleFrom3(p1, p2, p3) {
    const ax = p1[0], ay = p1[1], bx = p2[0], by = p2[1], cx = p3[0], cy = p3[1];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-9) return null;
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { cx: ux, cy: uy, r: Math.hypot(ax - ux, ay - uy) };
  }
  function deleteHandle(h) {
    const out = S.drawing.outline; const prim = out[h.pi];
    outlineHist.snap();
    if (prim.type === "arc") {
      // arc -> straight line between its ends
      out[h.pi] = { type: "polyline", points: [prim.start, prim.end], closed: false };
    } else if (prim.points.length > (prim.closed ? 3 : 2)) {
      prim.points.splice(h.i, 1);
    } else if (!prim.closed && out.length > 1) {
      out.splice(h.pi, 1);
    }
    saveOutline(); draw();
  }
  function insertVertexAt(mm) {
    // find nearest polyline segment within tolerance
    const tol = pxTolMm(8); let best = null;
    S.drawing.outline.forEach((prim, pi) => {
      if (prim.type !== "polyline") return;
      const n = prim.points.length, segs = prim.closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const a = prim.points[i], b = prim.points[(i + 1) % n];
        const dd = distToSegment(mm, a, b);
        if (dd < tol && (!best || dd < best.d)) best = { d: dd, pi, i };
      }
    });
    if (!best) return false;
    outlineHist.snap();
    S.drawing.outline[best.pi].points.splice(best.i + 1, 0, mm);
    saveOutline(); draw(); return true;
  }
  function handleAt(sx, sy) {
    const mm = screenToMm(sx, sy); const tol = pxTolMm(9); let best = null;
    for (const h of editHandles()) { const dd = dist(h.p, mm); if (dd < tol && (!best || dd < best.d)) best = { ...h, d: dd }; }
    return best;
  }

  // ------------------------------------------------------------ measure ----
  $$('[data-pane="measure"] .tool').forEach((b) => b.onclick = () => { S.measure.tool = b.dataset.tool; S.measure.pending = null; $$('[data-pane="measure"] .tool').forEach((x) => x.classList.toggle("active", x === b)); draw(); });
  function snapPoint(mm) {
    if (!$("#snap").checked) return { p: mm, snapped: false };
    const tol = pxTolMm(10);
    let best = null, bd = tol;
    for (const v of outlineVertices()) { const d = dist(v, mm); if (d < bd) { bd = d; best = v; } }
    return best ? { p: [...best], snapped: true } : { p: mm, snapped: false };
  }
  function dimLineAt(mm) {
    const tol = pxTolMm(7); let best = null;
    (S.drawing.dimensions || []).forEach((d, i) => { const g = dimGeom(d); const dd = distToSegment(mm, g.line[0], g.line[1]); if (dd < tol && (!best || dd < best.d)) best = { i, d: dd }; });
    return best;
  }
  let saveT = null;
  function saveAnnotations() {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try {
        S.drawing = await put(`/api/projects/${pid()}/annotations`, { dimensions: S.drawing.dimensions, labels: S.drawing.labels });
        S.project.dimensions = S.drawing.dimensions; S.project.labels = S.drawing.labels; updateStepButtons(); renderDimTable(); draw();
      } catch (e) { toast(e.message, true); }
    }, 250);
  }
  function renderDimTable() {
    const tb = $("#dim-table tbody"); tb.innerHTML = "";
    const d = S.drawing; if (!d) return;
    d.dimensions.forEach((dim, i) => {
      const tr = document.createElement("tr"); if (S.measure.hl === i) tr.className = "hl";
      const kindAbbr = { aligned: "al", horizontal: "H", vertical: "V" }[dim.kind] || "al";
      tr.innerHTML = `<td title="${dim.kind}">D${i + 1}<br><span class="muted">${kindAbbr}</span></td>
        <td><input class="lbl w-lbl" value="${(dim.label || "").replace(/"/g, "&quot;")}" placeholder="e.g. width"></td>
        <td class="num">${fmt(dim.auto_mm)}</td>
        <td><input class="manual w-num" type="number" step="0.5" value="${dim.manual_mm ?? ""}" placeholder="${fmt(dim.auto_mm)}"></td>
        <td><input class="off w-off" type="number" step="1" value="${Math.round(dim.offset_mm || 0)}" title="offset of the dimension line, mm"></td>
        <td><select class="sty" title="line style"><option value="solid">—</option><option value="dashed">- -</option><option value="dotted">···</option></select></td>
        <td><span class="x" title="delete">✕</span></td>`;
      tr.querySelector(".sty").value = dim.style || "solid";
      const commit = () => { dimHist.snap(); saveAnnotations(); };
      tr.querySelector(".lbl").onchange = (e) => { dimHist.snap(); dim.label = e.target.value; saveAnnotations(); };
      tr.querySelector(".manual").onchange = (e) => { dimHist.snap(); dim.manual_mm = e.target.value === "" ? null : +e.target.value; saveAnnotations(); };
      tr.querySelector(".off").onchange = (e) => { dimHist.snap(); dim.offset_mm = +e.target.value || 0; saveAnnotations(); };
      tr.querySelector(".sty").onchange = (e) => { dimHist.snap(); dim.style = e.target.value; saveAnnotations(); };
      tr.querySelector(".x").onclick = () => { dimHist.snap(); d.dimensions.splice(i, 1); saveAnnotations(); };
      tr.onmouseenter = () => { S.measure.hl = i; draw(); }; tr.onmouseleave = () => { S.measure.hl = null; draw(); };
      tb.append(tr);
    });
    const ul = $("#label-list"); ul.innerHTML = "";
    d.labels.forEach((lb, i) => {
      const li = document.createElement("li");
      const inp = document.createElement("input"); inp.value = lb.text; inp.style.flex = "1"; inp.onchange = () => { dimHist.snap(); lb.text = inp.value; saveAnnotations(); };
      const x = document.createElement("span"); x.className = "x"; x.textContent = "✕"; x.onclick = () => { dimHist.snap(); d.labels.splice(i, 1); saveAnnotations(); };
      li.append(inp, x); ul.append(li);
    });
  }
  // spread dimension lines so they don't sit on top of each other / the stone
  $("#btn-tidy").onclick = () => {
    const d = S.drawing; if (!d || !d.dimensions.length) return;
    dimHist.snap();
    const bb = d.bbox || [0, 0, 0, 0];
    const groups = { horizontal: [], vertical: [], aligned: [] };
    d.dimensions.forEach((dim) => groups[dim.kind || "aligned"].push(dim));
    const step = 12;
    // horizontal: below the stone, shortest nearest; vertical: right of the stone
    groups.horizontal.sort((a, b) => dimAuto(a) - dimAuto(b)).forEach((dim, i) => { const base = Math.max(dim.p1[1], dim.p2[1]); dim.offset_mm = (bb[3] - base) + step * (i + 1); });
    groups.vertical.sort((a, b) => dimAuto(a) - dimAuto(b)).forEach((dim, i) => { const base = Math.max(dim.p1[0], dim.p2[0]); dim.offset_mm = (bb[2] - base) + step * (i + 1); });
    groups.aligned.forEach((dim) => { if (!dim.offset_mm) { // push away from the stone centre
      const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, mx = (dim.p1[0] + dim.p2[0]) / 2, my = (dim.p1[1] + dim.p2[1]) / 2;
      const dx = dim.p2[0] - dim.p1[0], dy = dim.p2[1] - dim.p1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      dim.offset_mm = ((mx - cx) * nx + (my - cy) * ny) >= 0 ? step : -step; } });
    saveAnnotations();
  };

  // ------------------------------------------------------------- export ----
  function setupExport() {
    const base = `/api/projects/${pid()}/export`;
    $("#exp-svg").href = `${base}.svg`; $("#exp-svg-photo").href = `${base}.svg?photo=1`;
    $("#exp-dxf").href = `${base}.dxf`; $("#exp-dxf12").href = `${base}.dxf?version=R12`;
    $("#exp-pdf").href = `${base}.pdf`; $("#exp-pdf-a4").href = `${base}.pdf?paper=a4`; $("#exp-pdf-a3").href = `${base}.pdf?paper=a3`;
    $("#exp-csv").href = `${base}.csv`;
    $("#exp-png").href = `${base}.png?photo=1`; $("#exp-json").href = `${base}.json`;
    $("#export-preview").src = `/api/projects/${pid()}/image/preview?t=${Date.now()}`;
  }
  $("#proj-name").onchange = async (e) => { try { S.project = await patch(`/api/projects/${pid()}`, { name: e.target.value }); updateStepButtons(); } catch (err) { toast(err.message, true); } };

  // --------------------------------------------------------- interaction ----
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => {
    if (!S.img) return; e.preventDefault();
    const [sx, sy] = evtPos(e);
    const f = Math.exp(-e.deltaY * 0.0015);
    const ns = Math.min(40, Math.max(0.02, S.view.scale * f));
    S.view.tx = sx - (sx - S.view.tx) * (ns / S.view.scale); S.view.ty = sy - (sy - S.view.ty) * (ns / S.view.scale); S.view.scale = ns;
    draw();
  }, { passive: false });

  canvas.addEventListener("dblclick", (e) => {
    if (S.step === "outline" && S.outlineTool === "edit" && S.drawing) { const [sx, sy] = evtPos(e); insertVertexAt(screenToMm(sx, sy)); }
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (!S.img) return;
    canvas.setPointerCapture(e.pointerId);
    const [sx, sy] = evtPos(e);
    const interactive = ["calibrate", "isolate", "measure"].includes(S.step) || (S.step === "outline" && S.outlineTool === "edit");
    if (e.button === 1 || e.button === 2 || e.shiftKey || !interactive) { S.panning = { sx, sy, tx: S.view.tx, ty: S.view.ty }; return; }
    const ip = toImg(sx, sy);
    if (S.step === "calibrate") {
      const max = calMode() === "two_point" ? 2 : 4;
      if (calMode() === "aruco") return;
      if (S.calPoints.length >= max) S.calPoints = [];
      S.calPoints.push(ip); draw();
    } else if (S.step === "isolate") {
      const g = S.seg;
      if (g.tool === "points") {
        // drag an existing point if close, else add
        const tol = 9 / S.view.scale; let hit = -1;
        g.polygon.forEach((p, i) => { if (dist(p, ip) < tol) hit = i; });
        segHist.snap();
        if (hit >= 0) g.dragPoint = hit; else { g.polygon.push(ip); g.dragPoint = g.polygon.length - 1; }
      } else if (g.tool === "box") { g.drag = [ip[0], ip[1], 0, 0]; g.dragStart = ip; }
      else { g.stroke = { kind: g.tool, pts: [ip], r: +$("#brush-size").value }; }
      draw();
    } else if (S.step === "outline") {
      const h = handleAt(sx, sy);
      if (h && e.altKey) { deleteHandle(h); return; }
      if (h) { outlineHist.snap(); S.edit.drag = { from: [...h.p] }; S.edit.sel = h; for (const prim of S.drawing.outline) if (prim.type === "arc") prim._mid = arcMid(prim); }
      else S.edit.sel = null;
      draw();
    } else if (S.step === "measure") {
      const mm = screenToMm(sx, sy);
      if (S.measure.tool === "probe") { toast(`x ${fmt(mm[0])} mm, y ${fmt(mm[1])} mm`); return; }
      if (S.measure.tool === "label") {
        const text = prompt("Label text"); if (!text) return;
        dimHist.snap(); S.drawing.labels.push({ pos: mm, text }); saveAnnotations(); return;
      }
      // drag an existing dimension line?
      if (!S.measure.pending) {
        const hit = dimLineAt(mm);
        if (hit) { dimHist.snap(); S.measure.dragDim = hit.i; S.measure.hl = hit.i; draw(); return; }
      }
      const sp = snapPoint(mm).p;
      if (!S.measure.pending) { S.measure.pending = sp; draw(); return; }
      const p1 = S.measure.pending, p2 = sp;
      const dim = { p1, p2, kind: S.measure.tool, auto_mm: 0, manual_mm: null, label: "", offset_mm: 0, style: $("#dim-style").value };
      dim.auto_mm = dimAuto(dim);
      if (dim.auto_mm < 0.5) { S.measure.pending = null; draw(); return; }
      dimHist.snap();
      S.drawing.dimensions.push(dim);
      S.measure.pending = null; saveAnnotations();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!S.img) return;
    const [sx, sy] = evtPos(e);
    const ip = toImg(sx, sy);
    if (S.panning) { S.view.tx = S.panning.tx + (sx - S.panning.sx); S.view.ty = S.panning.ty + (sy - S.panning.sy); draw(); return; }
    const inRect = S.imgKind !== "original" && S.project && S.project.calibration;
    $("#status").textContent = inRect ? `x ${fmt(ip[0] / ppm())} mm  y ${fmt(ip[1] / ppm())} mm   zoom ${fmt(S.view.scale * 100, 0)}%` : `x ${fmt(ip[0], 0)} px  y ${fmt(ip[1], 0)} px   zoom ${fmt(S.view.scale * 100, 0)}%`;
    if (S.step === "isolate") {
      const g = S.seg; g.cursor = ip;
      if (g.drag) { const s = g.dragStart; g.drag = [Math.min(s[0], ip[0]), Math.min(s[1], ip[1]), Math.abs(ip[0] - s[0]), Math.abs(ip[1] - s[1])]; }
      else if (g.stroke) g.stroke.pts.push(ip);
      else if (g.dragPoint != null) g.polygon[g.dragPoint] = ip;
      draw();
    } else if (S.step === "outline" && S.outlineTool === "edit") {
      if (S.edit.drag) { const to = screenToMm(sx, sy); moveVertex(S.edit.drag.from, to); S.edit.drag.from = to; S.edit.sel.p = to; draw(); }
    } else if (S.step === "measure") {
      const mm = screenToMm(sx, sy);
      if (S.measure.dragDim != null) { const d = S.drawing.dimensions[S.measure.dragDim]; d.offset_mm = Math.round(offsetFor(d, mm) * 2) / 2; draw(); return; }
      if (["aligned", "horizontal", "vertical"].includes(S.measure.tool)) { S.measure.hover = snapPoint(mm); canvas.style.cursor = dimLineAt(mm) && !S.measure.pending ? "move" : "crosshair"; draw(); }
    }
  });
  const endPointer = () => {
    if (S.panning) { S.panning = null; return; }
    if (S.step === "isolate") {
      const g = S.seg;
      if (g.drag) { if (g.drag[2] > 4 && g.drag[3] > 4) { segHist.snap(); g.rect = g.drag; } g.drag = null; }
      if (g.stroke) { segHist.snap(); g.strokes.push(g.stroke); g.stroke = null; }
      g.dragPoint = null;
      draw();
    } else if (S.step === "outline" && S.edit.drag) {
      S.edit.drag = null; for (const prim of S.drawing.outline) delete prim._mid; saveOutline(); draw();
    } else if (S.step === "measure" && S.measure.dragDim != null) {
      S.measure.dragDim = null; saveAnnotations();
    }
  };
  canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
  window.addEventListener("keydown", (e) => {
    const inInput = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z" && !inInput) { e.preventDefault(); const h = activeHist(); if (h) (e.shiftKey ? h.redo() : h.undo()); return; }
    if (mod && e.key.toLowerCase() === "y" && !inInput) { e.preventDefault(); const h = activeHist(); if (h) h.redo(); return; }
    if (inInput) return;
    if (e.key === "Escape") { S.measure.pending = null; S.seg.drag = null; S.edit.sel = null; draw(); }
    if (e.key === "f" && S.img) { fitView(); draw(); }
    if ((e.key === "Backspace" || e.key === "Delete")) {
      if (S.step === "isolate" && S.seg.tool === "points" && S.seg.polygon.length) { e.preventDefault(); segHist.snap(); S.seg.polygon.pop(); draw(); }
      if (S.step === "outline" && S.outlineTool === "edit" && S.edit.sel) { e.preventDefault(); const h = editHandles().find((x) => x.key === S.edit.sel.key); if (h) deleteHandle(h); S.edit.sel = null; }
    }
    if (S.step === "isolate") { const map = { p: "points", b: "box", s: "fg", g: "bg", e: "erase" }; if (map[e.key]) setSegTool(map[e.key]); }
  });
  new ResizeObserver(resizeCanvas).observe($("#viewer"));

  // -------------------------------------------------------------- boot ----
  resizeCanvas(); goStep("photo");
})();
