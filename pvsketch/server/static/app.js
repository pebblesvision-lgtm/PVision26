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
    seg: { rect: null, fg: [], bg: [], tool: "box", stroke: null, drag: null },
    drawing: null,           // {outline, detail, dimensions, labels, bbox, width_mm...}
    measure: { tool: "dim", pending: null, hover: null },
    showPhoto: true,
    panning: null,
  };
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const DPR = window.devicePixelRatio || 1;

  // ----------------------------------------------------------- helpers ----
  const api = async (url, opts = {}) => {
    const r = await fetch(url, opts);
    let body = null;
    try { body = await r.json(); } catch (_) { /* no body */ }
    if (!r.ok) throw new Error((body && body.error) || `${r.status} ${r.statusText}`);
    return body;
  };
  const post = (url, data) => api(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const put = (url, data) => api(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const patch = (url, data) => api(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

  let toastT = null;
  const toast = (msg, err = false) => {
    const t = $("#toast"); t.textContent = msg; t.hidden = false; t.className = err ? "err" : "";
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), err ? 6000 : 2500);
  };
  const busy = (btn, on) => { if (btn) { btn.disabled = on; btn.dataset.label ??= btn.textContent; btn.textContent = on ? "Working…" : btn.dataset.label; } };
  const fmt = (v, d = 1) => Number(v).toFixed(d);
  const ppm = () => (S.project && S.project.calibration ? S.project.calibration.ppm : 1);
  const pid = () => S.project.id;

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
  const evtPos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

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
    if (S.step === "measure") drawMeasure();
  }
  function drawEmpty(r) {
    ctx.fillStyle = "#8e98a3"; ctx.font = "15px system-ui"; ctx.textAlign = "center";
    ctx.fillText("Upload a photo to begin", r.width / 2, r.height / 2);
  }
  function dot(p, color, label) {
    const [x, y] = toScreen(p[0], p[1]);
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12);
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
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
  function drawSegmentation() {
    const g = S.seg;
    const rect = g.drag || g.rect;
    if (rect) {
      const [x, y] = toScreen(rect[0], rect[1]);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = "#4fb3ff"; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, rect[2] * S.view.scale, rect[3] * S.view.scale); ctx.setLineDash([]);
    }
    const bw = +$("#brush-size").value * S.view.scale;
    const strokes = [[g.fg, "rgba(79,209,139,.85)"], [g.bg, "rgba(255,107,107,.85)"]];
    if (g.stroke) strokes.push([[g.stroke.pts], g.stroke.kind === "fg" ? "rgba(79,209,139,.85)" : "rgba(255,107,107,.85)"]);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, bw);
    for (const [list, color] of strokes) {
      ctx.strokeStyle = color;
      for (const s of list) {
        ctx.beginPath();
        s.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        if (s.length === 1) { const [x, y] = toScreen(s[0][0], s[0][1]); ctx.lineTo(x + 0.1, y); }
        ctx.stroke();
      }
    }
  }
  function pathPrimitive(prim) {
    if (prim.type === "polyline") {
      prim.points.forEach((p, i) => { const [x, y] = toScreen(...mmToImg(p)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (prim.closed) ctx.closePath();
    } else {
      const [cx, cy] = toScreen(...mmToImg(prim.center));
      const r = prim.radius * ppm() * S.view.scale;
      const a0 = Math.atan2(prim.start[1] - prim.center[1], prim.start[0] - prim.center[0]);
      const a1 = Math.atan2(prim.end[1] - prim.center[1], prim.end[0] - prim.center[0]);
      ctx.arc(cx, cy, r, a0, a1, !prim.ccw);
    }
  }
  function drawVectors() {
    const d = S.drawing; if (!d) return;
    // outline
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    if (d.outline && d.outline.length) {
      ctx.beginPath();
      let first = true;
      for (const prim of d.outline) {
        if (prim.type === "polyline" && d.outline.length === 1) { pathPrimitive(prim); break; }
        if (prim.type === "polyline") { prim.points.forEach((p, i) => { const [x, y] = toScreen(...mmToImg(p)); (first && i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); }
        else {
          if (first) { const [x, y] = toScreen(...mmToImg(prim.start)); ctx.moveTo(x, y); }
          pathPrimitive(prim);
        }
        first = false;
      }
      if (d.outline.length > 1) ctx.closePath();
      ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = "#ffe76a"; ctx.lineWidth = 2; ctx.stroke();
      // mark arcs + vertices
      for (const prim of d.outline) {
        if (prim.type === "arc") {
          const [cx, cy] = toScreen(...mmToImg(prim.center));
          ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = "#4fb3ff"; ctx.fill();
          ctx.fillStyle = "#4fb3ff"; ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.fillText(`R${fmt(prim.radius)}`, cx + 5, cy - 5);
        }
      }
      for (const v of outlineVertices()) { const [x, y] = toScreen(...mmToImg(v)); ctx.fillStyle = "#ffe76a"; ctx.fillRect(x - 2, y - 2, 4, 4); }
    }
    if (d.detail && d.detail.length) {
      ctx.beginPath();
      for (const pl of d.detail) { pl.points.forEach((p, i) => { const [x, y] = toScreen(...mmToImg(p)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (pl.closed) ctx.closePath(); }
      ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = "#8fd1ff"; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // dimensions
    for (const [i, dim] of (d.dimensions || []).entries()) drawDim(dim, i, S.measure.hl === i);
    for (const lb of d.labels || []) {
      const [x, y] = toScreen(...mmToImg(lb.pos));
      ctx.font = "bold 13px system-ui"; ctx.textAlign = "left";
      ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.strokeText(lb.text, x, y); ctx.fillStyle = "#8fd1ff"; ctx.fillText(lb.text, x, y);
    }
  }
  function drawDim(dim, idx, hl) {
    const a = toScreen(...mmToImg(dim.p1)), b = toScreen(...mmToImg(dim.p2));
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    ctx.strokeStyle = hl ? "#fff" : "#ff6b6b"; ctx.lineWidth = hl ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b);
    for (const p of [a, b]) { ctx.moveTo(p[0] - nx * 7, p[1] - ny * 7); ctx.lineTo(p[0] + nx * 7, p[1] + ny * 7); }
    ctx.stroke();
    const val = dim.manual_mm != null && dim.manual_mm !== "" ? Number(dim.manual_mm) : dim.auto_mm;
    let txt = `${fmt(val)}`;
    if (dim.manual_mm != null && dim.manual_mm !== "" && Math.abs(dim.manual_mm - dim.auto_mm) > 0.05) txt += ` (photo ${fmt(dim.auto_mm)})`;
    if (dim.label) txt = `${dim.label}: ${txt}`;
    let ang = Math.atan2(dy, dx); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    ctx.save(); ctx.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); ctx.rotate(ang);
    ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(txt, 0, -6); ctx.fillStyle = "#ff8d8d"; ctx.fillText(txt, 0, -6);
    ctx.fillStyle = "#ff6b6b"; ctx.font = "10px system-ui"; ctx.fillText(`D${idx + 1}`, 0, 12);
    ctx.restore();
  }
  function drawMeasure() {
    const m = S.measure;
    if (m.pending) dot(mmToImg(m.pending), "#ff6b6b");
    if (m.hover) {
      const [x, y] = toScreen(...mmToImg(m.hover.p));
      ctx.beginPath(); ctx.arc(x, y, m.hover.snapped ? 7 : 4, 0, Math.PI * 2);
      ctx.strokeStyle = m.hover.snapped ? "#4fd18b" : "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      if (m.pending) {
        const [px, py] = toScreen(...mmToImg(m.pending));
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.setLineDash([4, 4]); ctx.strokeStyle = "#ff6b6b"; ctx.stroke(); ctx.setLineDash([]);
        const L = Math.hypot(m.hover.p[0] - m.pending[0], m.hover.p[1] - m.pending[1]);
        ctx.fillStyle = "#fff"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "left"; ctx.fillText(`${fmt(L)} mm`, x + 10, y - 10);
      }
    }
  }
  function outlineVertices() {
    const d = S.drawing; if (!d || !d.outline) return [];
    const v = [];
    for (const prim of d.outline) {
      if (prim.type === "polyline") v.push(...prim.points);
      else { v.push(prim.start, prim.end); }
    }
    return v;
  }

  // ------------------------------------------------------------- steps ----
  const STEPS = ["photo", "calibrate", "isolate", "outline", "measure", "export"];
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
  }
  async function goStep(step) {
    S.step = step;
    for (const pane of $$(".pane")) pane.hidden = pane.dataset.pane !== step;
    updateStepButtons();
    const hint = $("#viewer-hint");
    S.measure.pending = null; S.measure.hover = null;
    try {
      if (step === "photo") { hint.textContent = ""; if (S.project) await showImage("original"); await refreshProjects(); }
      if (step === "calibrate") { hint.textContent = "Click reference corners · wheel = zoom · right-drag = pan"; await showImage("original"); }
      if (step === "isolate") { hint.textContent = "Drag a box around the stone, then Run GrabCut"; await showImage(S.project.segmentation ? "overlay" : "rectified"); }
      if (step === "outline") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); if (!S.project.outline) await runOutline(); }
      if (step === "measure") { hint.textContent = "Click 2 points for a dimension · right-drag = pan"; await showImage("rectified"); await loadDrawing(); renderDimTable(); }
      if (step === "export") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); setupExport(); }
    } catch (e) { toast(e.message, true); }
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
    S.calPoints = []; S.seg = { rect: null, fg: [], bg: [], tool: "box", stroke: null, drag: null }; S.drawing = null;
    if (S.project.calibration && S.project.calibration.mode !== "aruco") S.calPoints = S.project.calibration.ref_points_px.map((p) => [...p]);
    if (S.project.segmentation && S.project.segmentation.rect) {
      S.seg.rect = [...S.project.segmentation.rect]; S.seg.fg = S.project.segmentation.fg || []; S.seg.bg = S.project.segmentation.bg || [];
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
      a.onclick = async () => { try { await openProject(p.id); goStep(p.outline ? "measure" : p.segmented ? "outline" : p.calibrated ? "isolate" : "calibrate"); } catch (e) { toast(e.message, true); } };
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
      S.project = r.state; S.seg = { rect: null, fg: [], bg: [], tool: "box", stroke: null, drag: null }; S.drawing = null;
      const c = r.calibration;
      $("#cal-result").className = "result ok";
      $("#cal-result").textContent = `${c.note}\nrectified image ${c.out_size[0]} x ${c.out_size[1]} px = ${fmt(c.out_size[0] / c.ppm, 0)} x ${fmt(c.out_size[1] / c.ppm, 0)} mm\n${fmt(c.ppm, 2)} px/mm (resolution ≈ ${fmt(1 / c.ppm, 2)} mm per pixel)`;
      updateStepButtons(); toast("Calibrated"); goStep("isolate");
    } catch (e) { $("#cal-result").className = "result err"; $("#cal-result").textContent = e.message; }
    busy(btn, false);
  };

  // ------------------------------------------------------- segmentation ----
  $$('[data-pane="isolate"] .tool').forEach((b) => b.onclick = () => { S.seg.tool = b.dataset.tool; $$('[data-pane="isolate"] .tool').forEach((x) => x.classList.toggle("active", x === b)); });
  $("#brush-size").oninput = (e) => { $("#brush-size-v").textContent = e.target.value; draw(); };
  $("#btn-seg-clear").onclick = () => { S.seg.fg = []; S.seg.bg = []; draw(); };
  $("#btn-segment").onclick = async () => {
    if (!S.seg.rect) { toast("Drag a box around the stone first", true); return; }
    const btn = $("#btn-segment"); busy(btn, true);
    try {
      const r = await post(`/api/projects/${pid()}/segment`, { rect: S.seg.rect, fg: S.seg.fg, bg: S.seg.bg, brush_px: +$("#brush-size").value, iters: +$("#gc-iters").value });
      S.project = r.state; S.drawing = null;
      const areaMm2 = r.mask_px / (ppm() * ppm());
      $("#seg-result").className = "result ok"; $("#seg-result").textContent = `stone area ≈ ${fmt(areaMm2 / 100, 0)} cm²  (${r.mask_px} px). Check the red boundary; brush and re-run if needed, then go to 4.`;
      await showImage("overlay"); updateStepButtons();
    } catch (e) { $("#seg-result").className = "result err"; $("#seg-result").textContent = e.message; }
    busy(btn, false);
  };

  // ------------------------------------------------------------ outline ----
  $("#ol-eps").oninput = (e) => ($("#ol-eps-v").textContent = e.target.value);
  $("#show-photo").onchange = (e) => { S.showPhoto = e.target.checked; draw(); };
  function outlineParams() {
    return { epsilon_mm: +$("#ol-eps").value, arc_fit: $("#ol-arcs").checked, smooth_window: +$("#ol-smooth").value,
      detail: { enabled: $("#dt-on").checked, low: +$("#dt-low").value, high: +$("#dt-high").value, min_len_mm: +$("#dt-minlen").value, smooth: +$("#dt-smooth").value } };
  }
  function applyParamsToUI(p) {
    if (!p) return;
    $("#ol-eps").value = p.epsilon_mm; $("#ol-eps-v").textContent = p.epsilon_mm; $("#ol-arcs").checked = !!p.arc_fit; $("#ol-smooth").value = p.smooth_window ?? 5;
    const d = p.detail || {}; $("#dt-on").checked = !!d.enabled; $("#dt-low").value = d.low ?? 30; $("#dt-high").value = d.high ?? 90; $("#dt-minlen").value = d.min_len_mm ?? 15; $("#dt-smooth").value = d.smooth ?? 5;
  }
  async function runOutline() {
    const btn = $("#btn-outline"); busy(btn, true);
    try {
      S.drawing = await post(`/api/projects/${pid()}/outline`, { params: outlineParams() });
      S.project = await api(`/api/projects/${pid()}`);
      describeOutline(); updateStepButtons(); draw();
    } catch (e) { $("#ol-result").className = "result err"; $("#ol-result").textContent = e.message; }
    busy(btn, false);
  }
  function describeOutline() {
    const d = S.drawing; if (!d) return;
    const arcs = d.outline.filter((p) => p.type === "arc").length;
    const segs = d.outline.reduce((n, p) => n + (p.type === "arc" ? 1 : Math.max(0, p.points.length - (p.closed ? 0 : 1))), 0);
    const bb = d.bbox;
    $("#ol-result").className = "result ok";
    $("#ol-result").textContent = bb ? `bounding box ${fmt(bb[2] - bb[0])} x ${fmt(bb[3] - bb[1])} mm\n${segs} straight segments, ${arcs} arcs, ${d.detail.length} detail lines` : "no outline found - check the mask in step 3";
  }
  $("#btn-outline").onclick = runOutline;
  async function loadDrawing() {
    S.drawing = await api(`/api/projects/${pid()}/drawing`);
    applyParamsToUI(S.project.outline_params); describeOutline();
  }

  // ------------------------------------------------------------ measure ----
  $$('[data-pane="measure"] .tool').forEach((b) => b.onclick = () => { S.measure.tool = b.dataset.tool; S.measure.pending = null; $$('[data-pane="measure"] .tool').forEach((x) => x.classList.toggle("active", x === b)); draw(); });
  function snapPoint(mm) {
    if (!$("#snap").checked) return { p: mm, snapped: false };
    const tol = 10 / S.view.scale / ppm(); // 10 screen px in mm
    let best = null, bd = tol;
    for (const v of outlineVertices()) { const d = Math.hypot(v[0] - mm[0], v[1] - mm[1]); if (d < bd) { bd = d; best = v; } }
    return best ? { p: [...best], snapped: true } : { p: mm, snapped: false };
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
      tr.innerHTML = `<td>D${i + 1}</td><td><input class="lbl" value="${(dim.label || "").replace(/"/g, "&quot;")}" placeholder="e.g. width"></td>
        <td>${fmt(dim.auto_mm)}</td><td><input class="manual" type="number" step="0.5" value="${dim.manual_mm ?? ""}" placeholder="${fmt(dim.auto_mm)}"></td><td><span class="x" title="delete">✕</span></td>`;
      tr.querySelector(".lbl").onchange = (e) => { dim.label = e.target.value; saveAnnotations(); };
      tr.querySelector(".manual").onchange = (e) => { dim.manual_mm = e.target.value === "" ? null : +e.target.value; saveAnnotations(); };
      tr.querySelector(".x").onclick = () => { d.dimensions.splice(i, 1); saveAnnotations(); };
      tr.onmouseenter = () => { S.measure.hl = i; draw(); }; tr.onmouseleave = () => { S.measure.hl = null; draw(); };
      tb.append(tr);
    });
    const ul = $("#label-list"); ul.innerHTML = "";
    d.labels.forEach((lb, i) => {
      const li = document.createElement("li");
      const inp = document.createElement("input"); inp.value = lb.text; inp.style.flex = "1"; inp.onchange = () => { lb.text = inp.value; saveAnnotations(); };
      const x = document.createElement("span"); x.className = "x"; x.textContent = "✕"; x.onclick = () => { d.labels.splice(i, 1); saveAnnotations(); };
      li.append(inp, x); ul.append(li);
    });
  }

  // ------------------------------------------------------------- export ----
  function setupExport() {
    const base = `/api/projects/${pid()}/export`;
    $("#exp-svg").href = `${base}.svg`; $("#exp-svg-photo").href = `${base}.svg?photo=1`; $("#exp-dxf").href = `${base}.dxf`;
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

  canvas.addEventListener("pointerdown", (e) => {
    if (!S.img) return;
    canvas.setPointerCapture(e.pointerId);
    const [sx, sy] = evtPos(e);
    if (e.button === 1 || e.button === 2 || e.shiftKey || (S.step !== "calibrate" && S.step !== "isolate" && S.step !== "measure")) {
      S.panning = { sx, sy, tx: S.view.tx, ty: S.view.ty }; return;
    }
    const ip = toImg(sx, sy);
    if (S.step === "calibrate") {
      const max = calMode() === "two_point" ? 2 : 4;
      if (calMode() === "aruco") return;
      if (S.calPoints.length >= max) S.calPoints = [];
      S.calPoints.push(ip); draw();
    } else if (S.step === "isolate") {
      if (S.seg.tool === "box") S.seg.drag = [ip[0], ip[1], 0, 0], S.seg.dragStart = ip;
      else S.seg.stroke = { kind: S.seg.tool, pts: [ip] };
      draw();
    } else if (S.step === "measure") {
      const mm = imgToMm(ip);
      if (S.measure.tool === "probe") { toast(`x ${fmt(mm[0])} mm, y ${fmt(mm[1])} mm`); return; }
      if (S.measure.tool === "label") {
        const text = prompt("Label text"); if (!text) return;
        S.drawing.labels.push({ pos: mm, text }); saveAnnotations(); return;
      }
      const sp = snapPoint(mm).p;
      if (!S.measure.pending) { S.measure.pending = sp; draw(); return; }
      const p1 = S.measure.pending, p2 = sp;
      const auto = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (auto < 0.5) { S.measure.pending = null; draw(); return; }
      S.drawing.dimensions.push({ p1, p2, auto_mm: auto, manual_mm: null, label: "" });
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
      if (S.seg.drag) { const s = S.seg.dragStart; S.seg.drag = [Math.min(s[0], ip[0]), Math.min(s[1], ip[1]), Math.abs(ip[0] - s[0]), Math.abs(ip[1] - s[1])]; draw(); }
      else if (S.seg.stroke) { S.seg.stroke.pts.push(ip); draw(); }
    } else if (S.step === "measure" && S.measure.tool === "dim") {
      S.measure.hover = snapPoint(imgToMm(ip)); draw();
    }
  });
  const endPointer = (e) => {
    if (S.panning) { S.panning = null; return; }
    if (S.step === "isolate") {
      if (S.seg.drag) { if (S.seg.drag[2] > 4 && S.seg.drag[3] > 4) S.seg.rect = S.seg.drag; S.seg.drag = null; }
      if (S.seg.stroke) { (S.seg.stroke.kind === "fg" ? S.seg.fg : S.seg.bg).push(S.seg.stroke.pts); S.seg.stroke = null; }
      draw();
    }
  };
  canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", endPointer);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { S.measure.pending = null; S.seg.drag = null; draw(); }
    if (e.key === "f" && S.img && document.activeElement.tagName !== "INPUT") { fitView(); draw(); }
  });
  new ResizeObserver(resizeCanvas).observe($("#viewer"));

  // -------------------------------------------------------------- boot ----
  resizeCanvas(); goStep("photo");
})();
