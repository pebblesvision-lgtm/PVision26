/* pvsketch UI - vanilla JS, no build step, works offline. Nederlands standaard, English via settings. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ------------------------------------------------------------- i18n ----
  // Static page text: data-i18n keys (innerHTML). Dynamic text: t("english text").
  const NL = {
    "projects": "Projecten", "newphoto": "Nieuwe foto", "set.lang": "Taal / Language", "set.tips": "Uitleg tonen",
    "step.photo": "Foto", "step.isolate": "Isoleren", "step.outline": "Omtrek", "step.measure": "Opmeten", "step.draw": "Tekenen", "step.export": "Exporteren",
    "photo.h": "1. Foto", "photo.p": "Fotografeer het steenvlak <b>recht van voren</b>, in egaal licht. De foto geeft alleen de vorm; elke maat typt u zelf in.",
    "photo.drop": "Sleep een foto hierheen of tik om te kiezen<br><span class=\"muted\">JPEG / PNG / HEIC</span>", "photo.camera": "Foto maken", "photo.sample": "Voorbeeldfoto", "photo.recent": "Recente projecten",
    "iso.h": "2. De steen isoleren", "iso.p": "<b>Punten</b>: tik langs de buitenlijn (ongeveer is goed), dan <b>Uitvoeren</b>. De rand wordt gezocht in de band rond uw punten. Of sleep een <b>Kader</b>. Corrigeer met de kwasten en de <b>Gum</b>.",
    "iso.points": "Punten", "iso.box": "Kader", "iso.fg": "Steen", "iso.bg": "Achtergrond", "iso.erase": "Gum", "iso.brush": "Kwast", "iso.band": "Band", "iso.exact": "Punten exact als omtrek gebruiken", "iso.iters": "GrabCut-iteraties", "iso.clearpts": "Punten wissen", "iso.clearpaint": "Verf wissen", "run": "Uitvoeren", "advanced": "Geavanceerd",
    "ol.h": "3. Omtrek", "ol.eps": "Vereenvoudiging", "ol.arcs": "Bogen passen", "ol.dton": "Detaillijnen", "ol.go": "Omtrek bepalen", "ol.view": "Bekijken", "ol.edit": "Punten verplaatsen",
    "ol.editp": "Sleep punten, dubbeltik op een lijn om een punt toe te voegen, Alt+klik (of selecteer + Delete) om te verwijderen. Opnieuw bepalen overschrijft uw wijzigingen.", "showphoto": "Foto onder de tekening tonen",
    "ol.minr": "Min. boogstraal", "ol.minlen": "Min. booglengte", "ol.smooth": "Gladstrijken px", "low": "laag", "high": "hoog", "ol.minlenmm": "Min. lengte", "ol.grain": "Korrel",
    "me.h": "4. Opmeten", "me.p": "Tik twee punten en typ de maat die u gemeten heeft. <b>Er wordt niets uit de foto gemeten.</b> De eerste maat die u invoert bepaalt de schaal van de tekening. Sleep een maatlijn om die van de steen af te zetten.",
    "me.template": "Elementsjabloon", "me.item": "Maat", "me.aligned": "Schuin", "me.horizontal": "Horizontaal", "me.vertical": "Verticaal", "me.label": "Tekst", "me.snap": "Vastklikken", "line": "Lijn", "solid": "doorlopend", "dashed": "gestreept", "dotted": "gestippeld", "me.tidy": "Opruimen", "label": "Omschrijving", "me.value": "mm", "me.off": "Afst.",
    "dr.h": "5. Bewerkingen &amp; tekenen", "dr.p": "Tik de hoeken van een vlak, dan <b>Vlak sluiten</b>. Het vlak wordt gearceerd met het patroon van die bewerking en krijgt F1, F2… Lijnen, pijlen en tekst voor al het andere.",
    "dr.region": "Bewerkingsvlak", "dr.line": "Lijn", "dr.arrow": "Pijl + tekst", "dr.text": "Tekst", "dr.kind": "Bewerking", "dr.strokes": "Slagen per 10 cm", "dr.strokes_s": "/10cm", "dr.angle": "Richting °", "dr.width": "Band mm", "dr.comment": "Opmerking (komt in de legenda)", "dr.comment_s": "Opmerking", "cancel": "Annuleren", "dr.close": "Vlak sluiten / lijn beëindigen",
    "ex.h": "6. Exporteren", "ex.png": "Afbeelding (PNG)", "ex.jpg": "Afbeelding (JPEG)", "ex.svgphoto": "SVG + foto", "ex.tb": "Titelblok", "ex.name": "Tekeningnaam", "tb.project": "Project", "tb.element": "Element", "tb.material": "Steensoort", "tb.quantity": "Aantal", "tb.finish": "Afwerking (algemeen)", "tb.drawn_by": "Getekend door", "tb.notes": "Opmerkingen",
    "ex.views": "Andere aanzichten van dit element op hetzelfde blad", "ex.viewsp": "Een zijaanzicht, profiel of bovenaanzicht is een ander project (een andere foto van hetzelfde element). Koppel het hier; het wordt naast dit aanzicht getekend onder hetzelfde titelblok.",
    "photo.import": "Project openen (.json)", "photo.storage": "Projecten staan op dit apparaat, in de browser. Maak een back-up via Exporteren → JSON, of installeer de app via Delen → Zet op beginscherm.",
    "view.side": "Zijaanzicht", "view.profile": "Profiel", "view.top": "Bovenaanzicht", "view.back": "Achteraanzicht", "add": "Toevoegen",
    // dynamic
    "Upload a photo to begin": "Maak of kies een foto om te beginnen", "Uploading…": "Uploaden…", "Photo loaded": "Foto geladen", "Working…": "Bezig…",
    "Tap points along the outer line (or drag a box), then Run": "Tik punten langs de buitenlijn (of sleep een kader), dan Uitvoeren",
    "Tap 2 points for a dimension · drag a dimension line to move it": "Tik 2 punten voor een maat · sleep een maatlijn om die te verplaatsen",
    "Drag vertices · double-tap a line to add · Alt+click to delete": "Sleep punten · dubbeltik op een lijn om toe te voegen · Alt+klik om te verwijderen",
    "Tap the corners of the area, then Close region": "Tik de hoeken van het vlak, dan Vlak sluiten",
    "Click at least 3 points along the stone or drag a box first": "Tik eerst minstens 3 punten langs de steen of sleep een kader", "'Use points exactly' needs at least 3 points": "'Punten exact gebruiken' heeft minstens 3 punten nodig",
    "Check the red boundary. Wrong somewhere? Add points or brush there and Run again.": "Controleer de rode rand. Klopt iets niet? Zet daar punten of kwaststreken en voer opnieuw uit.",
    "You edited this outline by hand. Re-extracting replaces your edits. Continue?": "U heeft deze omtrek handmatig bewerkt. Opnieuw bepalen overschrijft uw wijzigingen. Doorgaan?",
    "straight segments": "rechte stukken", "arcs": "bogen", "detail lines": "detaillijnen", "(edited by hand)": "(handmatig bewerkt)", "no outline found - check the mask in step 2": "geen omtrek gevonden - controleer het masker in stap 2",
    "Label text": "Tekst", "e.g. width": "bv. breedte", "delete": "verwijderen", "offset of the dimension line, mm": "afstand van de maatlijn, mm", "line style": "lijnstijl",
    "Sample loaded": "Voorbeeld geladen", "No projects yet": "Nog geen projecten", "outlined": "omtrek", "isolated": "geïsoleerd", "photo": "foto", "dims": "maten",
    "Text": "Tekst", "A region needs at least 3 points": "Een vlak heeft minstens 3 punten nodig", "auto": "auto", "Measure": "Meten", "Now measure": "Meet nu", "type the value": "typ de maat", "not on photo": "niet op de foto",
    "Not to scale yet: type the first measurement": "Nog niet op schaal: voer de eerste maat in", "Scale set by": "Schaal bepaald door", "use as scale": "als schaal", "Use this dimension as the scale of the drawing?": "Deze maat als schaal van de tekening gebruiken?",
    "Project imported": "Project geopend", "Value for": "Maat voor", "Scale set": "Schaal bepaald",
    "Side view": "Zijaanzicht", "Profile": "Profiel", "Top view": "Bovenaanzicht", "Back view": "Achteraanzicht",
  };
  let LANG = (() => { try { return localStorage.getItem("pvsketch.lang") || "nl"; } catch (_) { return "nl"; } })();
  const t = (s) => (LANG === "nl" && NL[s]) ? NL[s] : s;
  const EN_HTML = {};
  function applyI18n() {
    for (const el of $$("[data-i18n]")) {
      const k = el.dataset.i18n;
      if (!(k in EN_HTML)) EN_HTML[k] = el.innerHTML;
      el.innerHTML = LANG === "nl" && NL[k] ? NL[k] : EN_HTML[k];
    }
    document.documentElement.lang = LANG;
    $("#lang").value = LANG;
  }

  // ------------------------------------------------------------ state ----
  const S = {
    project: null, step: "photo", img: null, imgKind: null,
    view: { scale: 1, tx: 0, ty: 0 },
    seg: null, drawing: null,
    outlineTool: "view", edit: { drag: null, sel: null },
    measure: { tool: "aligned", pending: null, hover: null, hl: null, dragDim: null, entry: null },
    draw: { tool: "region", pts: [], hover: null },
    finishKinds: [], templates: [], armed: null,
    showPhoto: true, panning: null,
  };
  const newSeg = () => ({ rect: null, polygon: [], strokes: [], tool: "points", drag: null, dragStart: null, stroke: null, dragPoint: null, justAdded: false });
  S.seg = newSeg();
  const canvas = $("#canvas");
  const ctx = canvas.getContext("2d");
  const DPR = window.devicePixelRatio || 1;

  // ----------------------------------------------------------- history ----
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
  const annGet = () => S.drawing ? { dimensions: S.drawing.dimensions, labels: S.drawing.labels, finishes: S.drawing.finishes, sketches: S.drawing.sketches, checklist: S.drawing.checklist || [] } : { dimensions: [], labels: [], finishes: [], sketches: [], checklist: [] };
  const annHist = new History(annGet, (v) => { if (S.drawing) { Object.assign(S.drawing, v); saveAnnotations(); renderDimTable(); renderChecklist(); renderDrawTables(); draw(); } });
  const activeHist = () => ({ isolate: segHist, outline: outlineHist, measure: annHist, draw: annHist })[S.step] || null;
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
    const el = $("#toast"); el.textContent = msg; el.hidden = false; el.className = err ? "err" : "";
    clearTimeout(toastT); toastT = setTimeout(() => (el.hidden = true), err ? 6000 : 2500);
  };
  const busy = (btn, on) => { if (btn) { btn.disabled = on; if (on) { btn.dataset.label = btn.innerHTML; btn.textContent = t("Working…"); } else if (btn.dataset.label) btn.innerHTML = btn.dataset.label; } };
  const fmt = (v, d = 1) => Number(v).toFixed(d);
  const fmtg = (v) => (v == null || v === "" ? "?" : String(+(+v).toFixed(2)));
  const ppm = () => (S.project && S.project.calibration ? S.project.calibration.ppm : 1);
  const scaled = () => !!(S.project && S.project.calibration && S.project.calibration.scaled);
  const pid = () => S.project.id;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // images go through fetch so they also work when the engine runs in the browser (no network round trip)
  const loadImage = async (url) => {
    const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    const objUrl = URL.createObjectURL(await r.blob());
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => { URL.revokeObjectURL(objUrl); res(im); }; im.onerror = rej; im.src = objUrl; });
  };
  async function setPreview() {
    try {
      const r = await fetch(`/api/projects/${pid()}/image/preview?t=${Date.now()}`); if (!r.ok) return;
      const el = $("#export-preview"); if (el.dataset.url) URL.revokeObjectURL(el.dataset.url);
      el.dataset.url = URL.createObjectURL(await r.blob()); el.src = el.dataset.url;
    } catch (_) { /* preview is optional */ }
  }

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
  const pxTolMm = (px) => px / S.view.scale / ppm();

  // -------------------------------------------------- dimension geometry ----
  function dimGeom(d) {
    const [x1, y1] = d.p1, [x2, y2] = d.p2, off = +d.offset_mm || 0;
    let q1, q2, ang;
    if (d.kind === "horizontal") { const yl = (off >= 0 ? Math.max(y1, y2) : Math.min(y1, y2)) + off; q1 = [x1, yl]; q2 = [x2, yl]; ang = 0; }
    else if (d.kind === "vertical") { const xl = (off >= 0 ? Math.max(x1, x2) : Math.min(x1, x2)) + off; q1 = [xl, y1]; q2 = [xl, y2]; ang = -Math.PI / 2; }
    else {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      q1 = [x1 + nx * off, y1 + ny * off]; q2 = [x2 + nx * off, y2 + ny * off];
      ang = Math.atan2(dy, dx); if (ang > Math.PI / 2 || ang < -Math.PI / 2) ang += Math.PI;
    }
    return { ext: [[d.p1, q1], [d.p2, q2]], line: [q1, q2], mid: [(q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2], ang };
  }
  function dimAuto(d) { const dx = d.p2[0] - d.p1[0], dy = d.p2[1] - d.p1[1]; return d.kind === "horizontal" ? Math.abs(dx) : d.kind === "vertical" ? Math.abs(dy) : Math.hypot(dx, dy); }
  function dimText(d) { const v = fmtg(d.manual_mm); return d.label ? `${d.label}: ${v}` : v; }
  function offsetFor(d, m) {
    if (d.kind === "horizontal") { const hi = Math.max(d.p1[1], d.p2[1]), lo = Math.min(d.p1[1], d.p2[1]); return m[1] >= hi ? m[1] - hi : m[1] <= lo ? m[1] - lo : 0; }
    if (d.kind === "vertical") { const hi = Math.max(d.p1[0], d.p2[0]), lo = Math.min(d.p1[0], d.p2[0]); return m[0] >= hi ? m[0] - hi : m[0] <= lo ? m[0] - lo : 0; }
    const dx = d.p2[0] - d.p1[0], dy = d.p2[1] - d.p1[1], L = Math.hypot(dx, dy) || 1;
    return ((m[0] - d.p1[0]) * (-dy / L) + (m[1] - d.p1[1]) * (dx / L));
  }
  function distToSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const u = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    return dist(p, [a[0] + u * dx, a[1] + u * dy]);
  }

  // -------------------------------------------------------------- draw ----
  function draw() {
    const r = canvas.getBoundingClientRect();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    if (!S.img) { ctx.fillStyle = "#8e98a3"; ctx.font = "16px system-ui"; ctx.textAlign = "center"; ctx.fillText(t("Upload a photo to begin"), r.width / 2, r.height / 2); return; }
    ctx.save();
    ctx.translate(S.view.tx, S.view.ty); ctx.scale(S.view.scale, S.view.scale);
    ctx.imageSmoothingEnabled = S.view.scale < 2;
    const showPhoto = S.step === "isolate" || S.showPhoto;
    if (showPhoto) ctx.drawImage(S.img, 0, 0);
    else { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S.img.width, S.img.height); }
    ctx.restore();
    if (S.step === "isolate") drawSegmentation();
    if (["outline", "measure", "draw", "export"].includes(S.step)) drawVectors();
    if (S.step === "outline" && S.outlineTool === "edit") drawEditHandles();
    if (S.step === "measure") drawMeasure();
    if (S.step === "draw") drawDrawTool();
  }
  function dot(p, color, label, rad = 6) {
    const [x, y] = toScreen(p[0], p[1]);
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#000"; ctx.stroke();
    if (label !== undefined) { ctx.fillStyle = "#fff"; ctx.font = "bold 12px system-ui"; ctx.textAlign = "left"; ctx.fillText(label, x + 9, y - 9); }
  }
  const strokeLayer = document.createElement("canvas");
  function drawSegmentation() {
    const g = S.seg;
    const rect = g.drag || g.rect;
    if (rect) {
      const [x, y] = toScreen(rect[0], rect[1]);
      ctx.setLineDash([6, 4]); ctx.strokeStyle = "#4fb3ff"; ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, rect[2] * S.view.scale, rect[3] * S.view.scale); ctx.setLineDash([]);
    }
    const r = canvas.getBoundingClientRect();
    if (strokeLayer.width !== canvas.width || strokeLayer.height !== canvas.height) { strokeLayer.width = canvas.width; strokeLayer.height = canvas.height; }
    const lc = strokeLayer.getContext("2d");
    lc.setTransform(DPR, 0, 0, DPR, 0, 0); lc.clearRect(0, 0, r.width, r.height);
    lc.lineCap = "round"; lc.lineJoin = "round";
    for (const s of g.strokes.concat(g.stroke ? [g.stroke] : [])) {
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
    const poly = g.polygon;
    if (poly.length) {
      ctx.beginPath();
      poly.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = "#f2a93b"; ctx.lineWidth = 1.5; ctx.stroke();
      if (poly.length > 2) {
        const a = toScreen(...poly[poly.length - 1]), b = toScreen(...poly[0]);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        if (!$("#seg-exact").checked) {
          ctx.beginPath();
          poly.forEach((p, i) => { const [x, y] = toScreen(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          ctx.closePath(); ctx.strokeStyle = "rgba(242,169,59,.18)"; ctx.lineWidth = Math.max(1, 2 * bandPx() * S.view.scale); ctx.stroke();
        }
      }
      poly.forEach((p, i) => dot(p, i === 0 ? "#fff" : "#f2a93b", undefined, 6));
    }
    if (["fg", "bg", "erase"].includes(g.tool) && g.cursor) {
      const [x, y] = toScreen(...g.cursor);
      ctx.beginPath(); ctx.arc(x, y, (+$("#brush-size").value) * S.view.scale, 0, Math.PI * 2);
      ctx.strokeStyle = g.tool === "erase" ? "#fff" : g.tool === "fg" ? "#4fd18b" : "#ff6b6b"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  // search band in image px: slider units are 1/1000 of the longer image side
  const bandPx = () => (+$("#band-mm").value) * (S.img ? Math.max(S.img.width, S.img.height) : 1000) / 1000;
  function pathArc(prim) {
    const [cx, cy] = mmToScreen(prim.center);
    const r = prim.radius * ppm() * S.view.scale;
    const a0 = Math.atan2(prim.start[1] - prim.center[1], prim.start[0] - prim.center[0]);
    const a1 = Math.atan2(prim.end[1] - prim.center[1], prim.end[0] - prim.center[0]);
    ctx.arc(cx, cy, r, a0, a1, !prim.ccw);
  }
  function traceOutline(outline) {
    ctx.beginPath();
    let first = true, last = null;
    const pStart = (pr) => pr.type === "polyline" ? pr.points[0] : pr.start, pEnd = (pr) => pr.type === "polyline" ? pr.points[pr.points.length - 1] : pr.end;
    for (const prim of outline) {
      if (!first && last && dist(last, pStart(prim)) > 1e-6) { ctx.closePath(); first = true; }
      if (prim.type === "polyline") prim.points.forEach((p, i) => { const [x, y] = mmToScreen(p); (first && i === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
      else { if (first) { const [x, y] = mmToScreen(prim.start); ctx.moveTo(x, y); } pathArc(prim); }
      first = false; last = prim.type === "polyline" && prim.closed ? null : pEnd(prim);
      if (prim.type === "polyline" && prim.closed) { ctx.closePath(); first = true; }
    }
    ctx.closePath();
  }
  const DASHES = { solid: [], dashed: [8, 4], dotted: [2, 4] };
  function polyPath(pts, closed) {
    ctx.beginPath();
    pts.forEach((p, i) => { const [x, y] = mmToScreen(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (closed) ctx.closePath();
  }
  function arrowHead(a, b, size, color) {
    const A = mmToScreen(a), B = mmToScreen(b);
    const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
    ctx.beginPath(); ctx.moveTo(...B);
    ctx.lineTo(B[0] - size * Math.cos(ang - 0.4), B[1] - size * Math.sin(ang - 0.4));
    ctx.lineTo(B[0] - size * Math.cos(ang + 0.4), B[1] - size * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }
  function finishName(kind) { const k = S.finishKinds.find((f) => f.kind === kind); return k ? (LANG === "nl" ? k.nl : k.en) : kind; }
  function finishLegend(f) {
    let s = f.label || finishName(f.kind);
    if (f.strokes_per_10cm) s += `, ${f.strokes_per_10cm} ${LANG === "nl" ? "slagen/10 cm" : "strokes/10 cm"}`;
    if (f.comment) s += ` - ${f.comment}`;
    return s;
  }
  function drawVectors() {
    const d = S.drawing; if (!d) return;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const [i, f] of (d.finishes || []).entries()) {
      const h = f.hatch || { lines: [], dots: [] };
      ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [p, q] of h.lines) { const P = mmToScreen(p), Q = mmToScreen(q); ctx.moveTo(...P); ctx.lineTo(...Q); }
      ctx.stroke();
      if (h.dots.length) { ctx.fillStyle = "rgba(255,255,255,.8)"; for (const p of h.dots) { const [x, y] = mmToScreen(p); ctx.fillRect(x - 1, y - 1, 2.2, 2.2); } }
      polyPath(f.polygon, true); ctx.setLineDash([4, 3]); ctx.strokeStyle = "rgba(255,230,106,.8)"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
      const c = f.centroid || f.polygon[0];
      const [cx, cy] = mmToScreen(c);
      const txt = `F${i + 1} ${finishLegend(f)}`;
      ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(txt, cx, cy); ctx.fillStyle = "#ffe76a"; ctx.fillText(txt, cx, cy);
    }
    if (d.outline && d.outline.length) {
      traceOutline(d.outline);
      ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = "#ffe76a"; ctx.lineWidth = 2; ctx.stroke();
      if (S.step === "outline" && S.outlineTool !== "edit") for (const v of outlineVertices()) { const [x, y] = mmToScreen(v); ctx.fillStyle = "#ffe76a"; ctx.fillRect(x - 2, y - 2, 4, 4); }
    }
    if (d.detail && d.detail.length) {
      ctx.beginPath();
      for (const pl of d.detail) { pl.points.forEach((p, i) => { const [x, y] = mmToScreen(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); if (pl.closed) ctx.closePath(); }
      ctx.strokeStyle = "rgba(0,0,0,.7)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = "#8fd1ff"; ctx.lineWidth = 1.2; ctx.stroke();
    }
    for (const sk of d.sketches || []) {
      if (sk.points.length >= 2) {
        polyPath(sk.points, false); ctx.setLineDash(DASHES[sk.style] || []);
        ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.lineWidth = 3.5; ctx.stroke(); ctx.strokeStyle = "#8fd1ff"; ctx.lineWidth = 1.6; ctx.stroke(); ctx.setLineDash([]);
        if (sk.arrow) arrowHead(sk.points[sk.points.length - 2], sk.points[sk.points.length - 1], 11, "#8fd1ff");
      }
      if (sk.text) { const [x, y] = mmToScreen(sk.points[0]); ctx.font = "bold 13px system-ui"; ctx.textAlign = "left"; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.strokeText(sk.text, x + 6, y - 6); ctx.fillStyle = "#8fd1ff"; ctx.fillText(sk.text, x + 6, y - 6); }
    }
    for (const [i, dim] of (d.dimensions || []).entries()) drawDim(dim, i, S.measure.hl === i);
    for (const lb of d.labels || []) {
      const [x, y] = mmToScreen(lb.pos);
      ctx.font = "bold 13px system-ui"; ctx.textAlign = "left"; ctx.lineWidth = 3; ctx.strokeStyle = "#000"; ctx.strokeText(lb.text, x, y); ctx.fillStyle = "#8fd1ff"; ctx.fillText(lb.text, x, y);
    }
  }
  function drawEditHandles() {
    for (const h of editHandles()) {
      const [x, y] = mmToScreen(h.p);
      const sel = S.edit.sel && S.edit.sel.key === h.key;
      ctx.beginPath(); ctx.rect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = sel ? "#ff6b6b" : h.arc ? "#4fb3ff" : "#ffe76a"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  function drawDim(dim, idx, hl) {
    const g = dimGeom(dim);
    const q1 = mmToScreen(g.line[0]), q2 = mmToScreen(g.line[1]);
    const dx = q2[0] - q1[0], dy = q2[1] - q1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const missing = dim.manual_mm == null || dim.manual_mm === "";
    const color = hl ? "#fff" : missing ? "#ffb04f" : "#ff6b6b";
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    for (const [a, b] of g.ext) { const A = mmToScreen(a), B = mmToScreen(b); if (dist(A, B) > 1) { ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); } }
    ctx.setLineDash(DASHES[dim.style] || []); ctx.lineWidth = hl ? 2.5 : 1.6;
    ctx.beginPath(); ctx.moveTo(...q1); ctx.lineTo(...q2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); for (const q of [q1, q2]) { ctx.moveTo(q[0] - nx * 7, q[1] - ny * 7); ctx.lineTo(q[0] + nx * 7, q[1] + ny * 7); } ctx.stroke();
    const txt = `D${idx + 1}  ${dimText(dim)}`;
    ctx.save(); ctx.translate((q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2); ctx.rotate(g.ang);
    ctx.font = "bold 13px system-ui"; ctx.textAlign = "center";
    ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(txt, 0, -5); ctx.fillStyle = hl ? "#fff" : missing ? "#ffd27f" : "#ff8d8d"; ctx.fillText(txt, 0, -5);
    ctx.restore();
  }
  function drawMeasure() {
    const m = S.measure;
    if (m.pending) dot(mmToImg(m.pending), "#ff6b6b");
    if (m.hover && !m.dragDim) {
      const [x, y] = mmToScreen(m.hover.p);
      ctx.beginPath(); ctx.arc(x, y, m.hover.snapped ? 8 : 4, 0, Math.PI * 2);
      ctx.strokeStyle = m.hover.snapped ? "#4fd18b" : "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
      if (m.pending) {
        const g = dimGeom({ p1: m.pending, p2: m.hover.p, kind: m.tool, offset_mm: 0 });
        const a = mmToScreen(g.line[0]), b = mmToScreen(g.line[1]);
        ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.setLineDash([4, 4]); ctx.strokeStyle = "#ff6b6b"; ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  function drawDrawTool() {
    const dtool = S.draw;
    if (dtool.pts.length) {
      const pts = dtool.hover ? dtool.pts.concat([dtool.hover]) : dtool.pts;
      polyPath(pts, dtool.tool === "region" && pts.length > 2);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "#ffe76a"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      dtool.pts.forEach((p, i) => dot(mmToImg(p), i === 0 ? "#fff" : "#ffe76a", undefined, 5));
    }
  }
  function outlineVertices() {
    const d = S.drawing; if (!d || !d.outline) return [];
    const v = [];
    for (const prim of d.outline) { if (prim.type === "polyline") v.push(...prim.points); else v.push(prim.start, prim.end); }
    return v;
  }
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
    const can = { photo: true, isolate: !!p, outline: !!(p && p.segmentation), measure: !!(p && p.outline), draw: !!(p && p.outline), export: !!(p && p.outline) };
    for (const b of $$("#steps .step")) {
      const s = b.dataset.step; b.disabled = !can[s];
      b.classList.toggle("active", s === S.step);
      b.classList.toggle("done", s !== S.step && ({ photo: !!p, isolate: !!(p && p.segmentation), outline: !!(p && p.outline), measure: !!(p && p.dimensions && p.dimensions.length), draw: !!(p && ((p.finishes || []).length || (p.sketches || []).length)), export: false })[s]);
    }
    $("#project-title").textContent = p ? `${p.name}  ·  ${p.id}` : "";
    updateUndoButtons();
  }
  async function goStep(step) {
    S.step = step;
    for (const pane of $$(".pane")) pane.hidden = pane.dataset.pane !== step;
    updateStepButtons();
    const hint = $("#viewer-hint");
    S.measure.pending = null; S.measure.hover = null; S.edit = { drag: null, sel: null }; S.draw.pts = []; S.draw.hover = null;
    $("#value-entry").hidden = true; S.measure.entry = null;
    try {
      if (step === "photo") { hint.textContent = ""; if (S.project) await showImage("original"); await refreshProjects(); }
      if (step === "isolate") { hint.textContent = t("Tap points along the outer line (or drag a box), then Run"); await showImage(S.project.segmentation ? "overlay" : "rectified"); }
      if (step === "outline") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); if (!S.project.outline) await runOutline(); }
      if (step === "measure") { hint.textContent = t("Tap 2 points for a dimension · drag a dimension line to move it"); await showImage("rectified"); await loadDrawing(); await ensureTemplates(); renderDimTable(); renderChecklist(); renderScaleLine(); }
      if (step === "draw") { hint.textContent = t("Tap the corners of the area, then Close region"); await showImage("rectified"); await loadDrawing(); await ensureFinishKinds(); renderDrawTables(); }
      if (step === "export") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); setupExport(); await renderViews(); }
    } catch (e) { toast(e.message, true); }
    touchHint();
    updateUndoButtons();
    draw();
  }
  $$("#steps .step").forEach((b) => b.addEventListener("click", () => goStep(b.dataset.step)));

  // ------------------------------------------------------------ upload ----
  async function upload(file) {
    if (!file) return;
    const fd = new FormData(); fd.append("photo", file, file.name);
    toast(t("Uploading…"));
    try {
      const st = await api("/api/projects", { method: "POST", body: fd });
      await openProject(st.id);
      toast(t("Photo loaded"));
      goStep("isolate");
    } catch (e) { toast(e.message, true); }
  }
  async function openProject(id) {
    S.project = await api(`/api/projects/${id}`);
    S.seg = newSeg(); S.drawing = null;
    segHist.clear(); outlineHist.clear(); annHist.clear();
    const sg = S.project.segmentation;
    if (sg) {
      S.seg.rect = sg.rect ? [...sg.rect] : null;
      S.seg.polygon = (sg.polygon || []).map((p) => [...p]);
      S.seg.strokes = sg.strokes || [];
      $("#seg-exact").checked = sg.mode === "polygon";
      if (!S.seg.polygon.length && S.seg.rect) setSegTool("box");
    }
    $("#proj-name").value = S.project.name || "";
    for (const inp of $$("input.tb")) inp.value = (S.project.titleblock || {})[inp.dataset.tb] || "";
    updateStepButtons();
  }
  async function refreshProjects() {
    const list = await api("/api/projects");
    const ul = $("#project-list"); ul.innerHTML = "";
    for (const p of list.slice(0, 40)) {
      const li = document.createElement("li");
      const a = document.createElement("a"); a.textContent = `${p.name || p.id}`; a.title = p.id;
      a.onclick = async () => { try { await openProject(p.id); goStep(p.outlined ? "measure" : p.segmented ? "outline" : "isolate"); } catch (e) { toast(e.message, true); } };
      const meta = document.createElement("span"); meta.className = "muted small";
      meta.textContent = `${(p.updated || p.created || "").replace("T", " ").slice(0, 16)} · ${t(p.outlined ? "outlined" : p.segmented ? "isolated" : "photo")}${p.dimensions ? ` · ${p.dimensions} ${t("dims")}` : ""}`;
      li.append(a, meta); ul.append(li);
    }
    if (!list.length) ul.innerHTML = `<li class="muted">${t("No projects yet")}</li>`;
  }
  const dz = $("#dropzone");
  dz.onclick = () => $("#file-input").click();
  $("#btn-new").onclick = () => $("#file-input").click();
  $("#btn-camera").onclick = () => $("#camera-input").click();
  $("#btn-projects").onclick = () => goStep("photo");
  $("#file-input").onchange = (e) => upload(e.target.files[0]);
  $("#camera-input").onchange = (e) => upload(e.target.files[0]);
  $("#btn-import").onclick = () => $("#import-input").click();
  $("#import-input").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { const st = await post("/api/projects/import", { text: await f.text() }); await openProject(st.id); toast(t("Project imported")); goStep(st.outline ? "measure" : st.segmentation ? "outline" : "isolate"); }
    catch (err) { toast(err.message, true); }
    e.target.value = "";
  };
  $("#btn-sample").onclick = async () => {
    try { const st = await api("/api/projects/sample", { method: "POST" }); await openProject(st.id); toast(t("Sample loaded")); goStep("isolate"); }
    catch (e) { toast(e.message, true); }
  };
  for (const ev of ["dragenter", "dragover"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); });
  dz.addEventListener("drop", (e) => upload(e.dataTransfer.files[0]));
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0] && S.step === "photo") upload(e.dataTransfer.files[0]); });

  // ---------------------------------------------------------- settings ----
  $("#btn-settings").onclick = () => { $("#settings").hidden = !$("#settings").hidden; };
  document.addEventListener("click", (e) => { if (!$("#settings").hidden && !$("#settings").contains(e.target) && e.target !== $("#btn-settings")) $("#settings").hidden = true; });
  $("#lang").onchange = async (e) => {
    LANG = e.target.value; try { localStorage.setItem("pvsketch.lang", LANG); } catch (_) { /* private mode */ }
    applyI18n(); renderDimTable(); renderDrawTables(); populateFinishKinds(); updateStepButtons(); touchHint(); draw();
    if (S.step === "export") setupExport();
    if (S.project) { try { S.project = await patch(`/api/projects/${pid()}`, { lang: LANG }); } catch (_) { /* offline edit */ } if (S.step === "measure") { await ensureTemplates(); renderChecklist(); renderScaleLine(); } }
  };
  $("#set-tips").onchange = (e) => { document.body.classList.toggle("no-tips", !e.target.checked); try { localStorage.setItem("pvsketch.tips", e.target.checked ? "1" : "0"); } catch (_) { /* */ } };
  try { if (localStorage.getItem("pvsketch.tips") === "0") { $("#set-tips").checked = false; document.body.classList.add("no-tips"); } } catch (_) { /* */ }

  // ------------------------------------------------------- segmentation ----
  function setSegTool(tool) { S.seg.tool = tool; $$('[data-pane="isolate"] .tool').forEach((x) => x.classList.toggle("active", x.dataset.tool === tool)); draw(); }
  $$('[data-pane="isolate"] .tool').forEach((b) => b.onclick = () => setSegTool(b.dataset.tool));
  $("#brush-size").oninput = (e) => { $("#brush-size-v").textContent = e.target.value; draw(); };
  $("#band-mm").oninput = (e) => { $("#band-mm-v").textContent = e.target.value; draw(); };
  $("#seg-exact").onchange = draw;
  $("#btn-seg-clear").onclick = () => { if (!S.seg.strokes.length) return; segHist.snap(); S.seg.strokes = []; draw(); };
  $("#btn-seg-clear-points").onclick = () => { if (!S.seg.polygon.length) return; segHist.snap(); S.seg.polygon = []; draw(); };
  $("#btn-segment").onclick = async () => {
    const g = S.seg, exact = $("#seg-exact").checked;
    if (g.polygon.length < 3 && !g.rect) { toast(t("Click at least 3 points along the stone or drag a box first"), true); return; }
    if (exact && g.polygon.length < 3) { toast(t("'Use points exactly' needs at least 3 points"), true); return; }
    const btn = $("#btn-segment"); busy(btn, true);
    try {
      const r = await post(`/api/projects/${pid()}/segment`, { rect: g.rect, polygon: g.polygon, strokes: g.strokes, brush_px: +$("#brush-size").value,
        iters: +$("#gc-iters").value, band_px: bandPx(), mode: exact ? "polygon" : "grabcut" });
      S.project = r.state; S.drawing = null; outlineHist.clear();
      $("#seg-result").className = "result ok"; $("#seg-result").textContent = t("Check the red boundary. Wrong somewhere? Add points or brush there and Run again.");
      await showImage("overlay"); updateStepButtons();
    } catch (e) { $("#seg-result").className = "result err"; $("#seg-result").textContent = e.message; }
    busy(btn, false);
  };

  // ------------------------------------------------------------ outline ----
  $("#ol-eps").oninput = (e) => ($("#ol-eps-v").textContent = e.target.value);
  $("#show-photo").onchange = (e) => { S.showPhoto = e.target.checked; draw(); };
  $$('[data-pane="outline"] .tool').forEach((b) => b.onclick = () => { S.outlineTool = b.dataset.tool; S.edit = { drag: null, sel: null }; $$('[data-pane="outline"] .tool').forEach((x) => x.classList.toggle("active", x === b)); $("#viewer-hint").textContent = S.outlineTool === "edit" ? t("Drag vertices · double-tap a line to add · Alt+click to delete") : ""; touchHint(); draw(); });
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
    if (S.project.outline_edited && !confirm(t("You edited this outline by hand. Re-extracting replaces your edits. Continue?"))) return;
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
    $("#ol-result").className = "result ok";
    $("#ol-result").textContent = d.bbox ? `${segs} ${t("straight segments")}, ${arcs} ${t("arcs")}, ${d.detail.length} ${t("detail lines")}${S.project.outline_edited ? " " + t("(edited by hand)") : ""}` : t("no outline found - check the mask in step 2");
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
  function moveVertex(from, to) {
    for (const prim of S.drawing.outline) {
      if (prim.type === "polyline") prim.points.forEach((p, i) => { if (dist(p, from) < 1e-6) prim.points[i] = [...to]; });
      else for (const f of ["start", "end"]) if (dist(prim[f], from) < 1e-6) { prim[f] = [...to]; refitArc(prim); }
    }
  }
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
    if (prim.type === "arc") out[h.pi] = { type: "polyline", points: [prim.start, prim.end], closed: false };
    else if (prim.points.length > (prim.closed ? 3 : 2)) prim.points.splice(h.i, 1);
    else if (!prim.closed && out.length > 1) out.splice(h.pi, 1);
    saveOutline(); draw();
  }
  function insertVertexAt(mm) {
    const tol = pxTolMm(10); let best = null;
    S.drawing.outline.forEach((prim, pi) => {
      if (prim.type !== "polyline") return;
      const n = prim.points.length, segs = prim.closed ? n : n - 1;
      for (let i = 0; i < segs; i++) { const dd = distToSegment(mm, prim.points[i], prim.points[(i + 1) % n]); if (dd < tol && (!best || dd < best.d)) best = { d: dd, pi, i }; }
    });
    if (!best) return false;
    outlineHist.snap(); S.drawing.outline[best.pi].points.splice(best.i + 1, 0, mm); saveOutline(); draw(); return true;
  }
  function handleAt(sx, sy) {
    const mm = screenToMm(sx, sy); const tol = pxTolMm(12); let best = null;
    for (const h of editHandles()) { const dd = dist(h.p, mm); if (dd < tol && (!best || dd < best.d)) best = { ...h, d: dd }; }
    return best;
  }

  // ------------------------------------------------------------ measure ----
  $$('[data-pane="measure"] .tool').forEach((b) => b.onclick = () => { S.measure.tool = b.dataset.tool; S.measure.pending = null; $$('[data-pane="measure"] .tool').forEach((x) => x.classList.toggle("active", x === b)); draw(); });
  function snapPoint(mm) {
    if (!$("#snap").checked) return { p: mm, snapped: false };
    const tol = pxTolMm(12); let best = null, bd = tol;
    for (const v of outlineVertices()) { const d = dist(v, mm); if (d < bd) { bd = d; best = v; } }
    return best ? { p: [...best], snapped: true } : { p: mm, snapped: false };
  }
  function dimLineAt(mm) {
    const tol = pxTolMm(9); let best = null;
    (S.drawing.dimensions || []).forEach((d, i) => { const g = dimGeom(d); const dd = distToSegment(mm, g.line[0], g.line[1]); if (dd < tol && (!best || dd < best.d)) best = { i, d: dd }; });
    return best;
  }
  let saveT = null;
  function saveAnnotations(then) {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      try {
        S.drawing = await put(`/api/projects/${pid()}/annotations`, annGet());
        S.project.dimensions = S.drawing.dimensions; S.project.labels = S.drawing.labels; S.project.finishes = S.drawing.finishes; S.project.sketches = S.drawing.sketches; S.project.checklist = S.drawing.checklist;
        updateStepButtons(); renderDimTable(); renderChecklist(); renderDrawTables(); draw();
        if (then) then();
      } catch (e) { toast(e.message, true); }
    }, 200);
  }
  // the typed value of a dimension; the first one sets the scale of the drawing
  function setDimValue(i, value) {
    const d = S.drawing; const dim = d.dimensions[i]; if (!dim) return;
    annHist.snap();
    dim.manual_mm = value === "" || value == null ? null : +value;
    const first = !scaled() && dim.manual_mm != null && dim.manual_mm > 0;
    saveAnnotations(first ? () => applyScale(i, dim.manual_mm) : null);
  }
  async function applyScale(i, mm) {
    try {
      const r = await put(`/api/projects/${pid()}/scale`, { index: i, mm });
      S.project = r.state; S.drawing = r.drawing; annHist.clear();
      renderDimTable(); renderChecklist(); renderScaleLine(); draw();
      toast(`${t("Scale set")}: D${i + 1} = ${fmtg(mm)} mm`);
    } catch (e) { toast(e.message, true); }
  }
  function renderScaleLine() {
    const el = $("#scale-line"); if (!S.project) return;
    const c = S.project.calibration || {};
    el.className = "result " + (c.scaled ? "ok" : "err");
    el.textContent = c.scaled ? `${t("Scale set by")} ${(c.scale_note || "").replace(/^(schaal uit|scale from) /, "")}` : t("Not to scale yet: type the first measurement");
  }
  function showValueEntry(i) {
    S.measure.entry = i;
    const box = $("#value-entry"); const dim = S.drawing.dimensions[i];
    if (!dim) { box.hidden = true; return; }
    box.hidden = false;
    $("#value-entry-label").textContent = `${t("Value for")} D${i + 1}${dim.label ? " · " + dim.label : ""} (mm)`;
    const inp = $("#value-input"); inp.value = dim.manual_mm ?? ""; setTimeout(() => { inp.focus(); inp.select(); }, 50);
  }
  function commitValueEntry() {
    const i = S.measure.entry; if (i == null) return;
    const v = $("#value-input").value;
    $("#value-entry").hidden = true; S.measure.entry = null;
    if (v !== "") setDimValue(i, v);
  }
  $("#btn-value-ok").onclick = commitValueEntry;
  $("#value-input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commitValueEntry(); } if (e.key === "Escape") { $("#value-entry").hidden = true; S.measure.entry = null; } });
  function renderDimTable() {
    const tb = $("#dim-table tbody"); tb.innerHTML = "";
    const d = S.drawing; if (!d) return;
    d.dimensions.forEach((dim, i) => {
      const tr = document.createElement("tr"); if (S.measure.hl === i) tr.className = "hl";
      const kindAbbr = { aligned: "⟋", horizontal: "↔", vertical: "↕" }[dim.kind] || "";
      const missing = dim.manual_mm == null || dim.manual_mm === "";
      tr.innerHTML = `<td title="${dim.kind}">D${i + 1} <span class="muted">${kindAbbr}</span></td>
        <td><input class="lbl w-lbl" value="${(dim.label || "").replace(/"/g, "&quot;")}" placeholder="${t("e.g. width")}"></td>
        <td><input class="manual w-num${missing ? " missing" : ""}" type="number" inputmode="decimal" step="0.5" value="${dim.manual_mm ?? ""}" placeholder="?"></td>
        <td><input class="off w-off" type="number" inputmode="numeric" step="1" value="${Math.round(dim.offset_mm || 0)}" title="${t("offset of the dimension line, mm")}"></td>
        <td><select class="sty" title="${t("line style")}"><option value="solid">—</option><option value="dashed">- -</option><option value="dotted">···</option></select></td>
        <td>${!missing ? `<button class="ghost scale-btn" title="${t("use as scale")}">⌖</button>` : ""}</td>
        <td><span class="x" title="${t("delete")}">✕</span></td>`;
      tr.querySelector(".sty").value = dim.style || "solid";
      tr.querySelector(".lbl").onchange = (e) => { annHist.snap(); dim.label = e.target.value; saveAnnotations(); };
      tr.querySelector(".manual").onchange = (e) => setDimValue(i, e.target.value);
      tr.querySelector(".off").onchange = (e) => { annHist.snap(); dim.offset_mm = +e.target.value || 0; saveAnnotations(); };
      tr.querySelector(".sty").onchange = (e) => { annHist.snap(); dim.style = e.target.value; saveAnnotations(); };
      const sb = tr.querySelector(".scale-btn"); if (sb) sb.onclick = () => { if (confirm(t("Use this dimension as the scale of the drawing?"))) applyScale(i, dim.manual_mm); };
      tr.querySelector(".x").onclick = () => { annHist.snap(); d.dimensions.splice(i, 1); relinkChecklist(i); saveAnnotations(); };
      tr.onmouseenter = () => { S.measure.hl = i; draw(); }; tr.onmouseleave = () => { S.measure.hl = null; draw(); };
      tb.append(tr);
    });
    const ul = $("#label-list"); ul.innerHTML = "";
    d.labels.forEach((lb, i) => {
      const li = document.createElement("li");
      const inp = document.createElement("input"); inp.value = lb.text; inp.style.flex = "1"; inp.onchange = () => { annHist.snap(); lb.text = inp.value; saveAnnotations(); };
      const x = document.createElement("span"); x.className = "x"; x.textContent = "✕"; x.onclick = () => { annHist.snap(); d.labels.splice(i, 1); saveAnnotations(); };
      li.append(inp, x); ul.append(li);
    });
  }
  // ---- element templates / checklist
  async function ensureTemplates() {
    if (!S.templates.length || S.templates._lang !== LANG) { S.templates = await api(`/api/templates?lang=${LANG}`); S.templates._lang = LANG; }
    const sel = $("#tpl-select"); sel.innerHTML = '<option value="">–</option>';
    for (const tp of S.templates) { const o = document.createElement("option"); o.value = tp.key; o.textContent = tp.name; sel.append(o); }
    sel.value = S.project.template || "";
  }
  $("#tpl-select").onchange = async (e) => {
    try {
      const r = await put(`/api/projects/${pid()}/template`, { template: e.target.value });
      S.project.template = r.template; S.project.checklist = r.checklist; if (S.drawing) S.drawing.checklist = r.checklist;
      S.armed = null; renderChecklist();
    } catch (err) { toast(err.message, true); }
  };
  function relinkChecklist(deletedIdx) {
    for (const c of (S.drawing.checklist || [])) {
      if (!c.dim_id) continue;
      const n = parseInt(c.dim_id.slice(1), 10) - 1;
      if (n === deletedIdx) c.dim_id = ""; else if (n > deletedIdx) c.dim_id = `D${n}`;
    }
  }
  function renderChecklist() {
    const tbl = $("#checklist"); const tb = tbl.querySelector("tbody"); tb.innerHTML = "";
    const cl = (S.drawing && S.drawing.checklist) || [];
    tbl.hidden = !cl.length;
    cl.forEach((c, i) => {
      const tr = document.createElement("tr");
      const dim = c.dim_id ? (S.drawing.dimensions || [])[parseInt(c.dim_id.slice(1), 10) - 1] : null;
      const done = (dim && dim.manual_mm != null) || c.value_mm != null;
      tr.className = (done ? "done " : "") + (S.armed === i ? "armed" : "");
      const name = LANG === "nl" ? c.nl : c.en;
      const hint = LANG === "nl" ? (c.hint_nl ?? c.hint ?? "") : (c.hint_en ?? c.hint ?? "");
      tr.innerHTML = `<td>${name}<div class="hint">${hint} ${c.kind === "value" ? "· " + t("not on photo") : ""}</div></td>
        <td>${dim ? `<b>${fmtg(dim.manual_mm)}</b> <span class="muted">${c.dim_id}</span>` : `<input type="number" inputmode="decimal" step="0.5" value="${c.value_mm ?? ""}" placeholder="${t("type the value")}">`}</td>
        <td>${c.kind !== "value" && !dim ? `<button class="ghost arm">${t("Measure")}</button>` : ""}</td>`;
      const inp = tr.querySelector("input");
      if (inp) inp.onchange = () => { annHist.snap(); c.value_mm = inp.value === "" ? null : +inp.value; saveAnnotations(); };
      const arm = tr.querySelector(".arm");
      if (arm) arm.onclick = () => { S.armed = S.armed === i ? null : i; S.measure.tool = c.kind; $$('[data-pane="measure"] .tool').forEach((x) => x.classList.toggle("active", x.dataset.tool === c.kind)); S.measure.pending = null;
        $("#viewer-hint").textContent = S.armed === i ? `${t("Now measure")}: ${name}` : t("Tap 2 points for a dimension · drag a dimension line to move it"); touchHint(); renderChecklist(); draw(); };
      tb.append(tr);
    });
  }
  $("#btn-tidy").onclick = () => {
    const d = S.drawing; if (!d || !d.dimensions.length) return;
    annHist.snap();
    const bb = d.bbox || [0, 0, 0, 0];
    const groups = { horizontal: [], vertical: [], aligned: [] };
    d.dimensions.forEach((dim) => groups[dim.kind || "aligned"].push(dim));
    const step = Math.max(8, (bb[2] - bb[0]) * 0.04);
    groups.horizontal.sort((a, b) => dimAuto(a) - dimAuto(b)).forEach((dim, i) => { const base = Math.max(dim.p1[1], dim.p2[1]); dim.offset_mm = (bb[3] - base) + step * (i + 1); });
    groups.vertical.sort((a, b) => dimAuto(a) - dimAuto(b)).forEach((dim, i) => { const base = Math.max(dim.p1[0], dim.p2[0]); dim.offset_mm = (bb[2] - base) + step * (i + 1); });
    groups.aligned.forEach((dim) => { if (!dim.offset_mm) {
      const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, mx = (dim.p1[0] + dim.p2[0]) / 2, my = (dim.p1[1] + dim.p2[1]) / 2;
      const dx = dim.p2[0] - dim.p1[0], dy = dim.p2[1] - dim.p1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      dim.offset_mm = ((mx - cx) * nx + (my - cy) * ny) >= 0 ? step : -step; } });
    saveAnnotations();
  };

  // --------------------------------------------------------------- draw ----
  async function ensureFinishKinds() { if (!S.finishKinds.length) { S.finishKinds = await api("/api/finishes"); populateFinishKinds(); } }
  function populateFinishKinds() {
    const sel = $("#fin-kind"); const cur = sel.value; sel.innerHTML = "";
    for (const f of S.finishKinds) { const o = document.createElement("option"); o.value = f.kind; o.textContent = LANG === "nl" ? f.nl : f.en; sel.append(o); }
    if (cur) sel.value = cur;
    finishOptsForKind();
  }
  function finishOptsForKind() {
    const f = S.finishKinds.find((x) => x.kind === $("#fin-kind").value); if (!f) return;
    const hasLines = ["lines", "groups", "herringbone"].includes(f.pattern);
    $("#fin-angle").placeholder = hasLines ? `${f.angle}` : "–";
    $("#fin-angle").parentElement.style.display = hasLines ? "" : "none";
    $("#fin-strokes").parentElement.style.display = f.pattern === "none" ? "none" : "";
    $("#fin-width").parentElement.style.display = (f.pattern === "edge" || f.pattern === "herringbone") ? "" : "none";
    $("#fin-width").placeholder = f.pattern === "herringbone" ? "40" : "25";
  }
  $("#fin-kind").onchange = finishOptsForKind;
  function setDrawTool(tool) {
    S.draw.tool = tool; S.draw.pts = [];
    $$('[data-pane="draw"] .tool').forEach((x) => x.classList.toggle("active", x.dataset.tool === tool));
    $("#dr-region-opts").hidden = tool !== "region"; $("#dr-line-opts").hidden = !(tool === "line" || tool === "arrow");
    draw();
  }
  $$('[data-pane="draw"] .tool').forEach((b) => b.onclick = () => setDrawTool(b.dataset.tool));
  function finishDrawShape() {
    const dtool = S.draw; const pts = dtool.pts;
    if (dtool.tool === "region") {
      if (pts.length < 3) { toast(t("A region needs at least 3 points"), true); return; }
      annHist.snap();
      const num = (id) => ($(id).value === "" ? null : +$(id).value);
      S.drawing.finishes.push({ polygon: pts.slice(), kind: $("#fin-kind").value, angle_deg: num("#fin-angle"), spacing_mm: null, width_mm: num("#fin-width"),
        strokes_per_10cm: num("#fin-strokes"), comment: $("#fin-comment").value, label: "" });
    } else if (dtool.tool === "line" || dtool.tool === "arrow") {
      if (pts.length < 2) { dtool.pts = []; draw(); return; }
      let text = "";
      if (dtool.tool === "arrow") { text = prompt(t("Text")) || ""; }
      annHist.snap();
      S.drawing.sketches.push({ points: pts.slice(), style: $("#sk-style").value, arrow: dtool.tool === "arrow", text });
    }
    dtool.pts = []; dtool.hover = null; saveAnnotations(); draw();
  }
  $("#btn-dr-close").onclick = finishDrawShape;
  $("#btn-dr-cancel").onclick = () => { S.draw.pts = []; S.draw.hover = null; draw(); };
  function renderDrawTables() {
    const d = S.drawing; const tb = $("#fin-table tbody"); tb.innerHTML = "";
    if (!d) return;
    (d.finishes || []).forEach((f, i) => {
      const tr = document.createElement("tr");
      const opts = S.finishKinds.map((k) => `<option value="${k.kind}">${LANG === "nl" ? k.nl : k.en}</option>`).join("");
      tr.innerHTML = `<td>F${i + 1}</td><td><select class="kind">${opts}</select></td>
        <td><input class="st w-off" type="number" inputmode="decimal" step="1" value="${f.strokes_per_10cm ?? ""}" placeholder="–"></td>
        <td><input class="cm" value="${(f.comment || "").replace(/"/g, "&quot;")}"></td>
        <td><span class="x" title="${t("delete")}">✕</span></td>`;
      tr.querySelector(".kind").value = f.kind;
      tr.querySelector(".kind").onchange = (e) => { annHist.snap(); f.kind = e.target.value; saveAnnotations(); };
      tr.querySelector(".st").onchange = (e) => { annHist.snap(); f.strokes_per_10cm = e.target.value === "" ? null : +e.target.value; saveAnnotations(); };
      tr.querySelector(".cm").onchange = (e) => { annHist.snap(); f.comment = e.target.value; saveAnnotations(); };
      tr.querySelector(".x").onclick = () => { annHist.snap(); d.finishes.splice(i, 1); saveAnnotations(); };
      tb.append(tr);
    });
    const ul = $("#sketch-list"); ul.innerHTML = "";
    (d.sketches || []).forEach((sk, i) => {
      const li = document.createElement("li");
      const tag = document.createElement("span"); tag.className = "muted small"; tag.textContent = `S${i + 1} ${sk.arrow ? "→" : "—"} ${t(sk.style)}`;
      const inp = document.createElement("input"); inp.value = sk.text || ""; inp.placeholder = t("Text"); inp.style.flex = "1"; inp.onchange = () => { annHist.snap(); sk.text = inp.value; saveAnnotations(); };
      const x = document.createElement("span"); x.className = "x"; x.textContent = "✕"; x.onclick = () => { annHist.snap(); d.sketches.splice(i, 1); saveAnnotations(); };
      li.append(tag, inp, x); ul.append(li);
    });
  }

  // ------------------------------------------------------------- export ----
  function setupExport() {
    const base = `/api/projects/${pid()}/export`, L = `lang=${LANG}`;
    $("#exp-svg").href = `${base}.svg?${L}`; $("#exp-svg-photo").href = `${base}.svg?photo=1&${L}`;
    $("#exp-dxf").href = `${base}.dxf?${L}`; $("#exp-dxf12").href = `${base}.dxf?version=R12&${L}`;
    $("#exp-pdf").href = `${base}.pdf?${L}`; $("#exp-pdf-a4").href = `${base}.pdf?paper=a4&${L}`; $("#exp-pdf-a3").href = `${base}.pdf?paper=a3&${L}`;
    $("#exp-csv").href = `${base}.csv?${L}`; $("#exp-png").href = `${base}.png?photo=1&${L}`; $("#exp-jpg").href = `${base}.jpg?photo=1&${L}`; $("#exp-json").href = `${base}.json`;
    setPreview();
  }
  async function renderViews() {
    const list = await api("/api/projects");
    const sel = $("#view-project"); sel.innerHTML = "";
    for (const p of list) { if (p.id === pid() || !p.outlined) continue; const o = document.createElement("option"); o.value = p.id; o.textContent = `${p.name} (${p.id.slice(0, 15)})`; sel.append(o); }
    const ul = $("#view-list"); ul.innerHTML = "";
    const names = { side: "Side view", profile: "Profile", top: "Top view", back: "Back view" };
    (S.project.views || []).forEach((v, i) => {
      const li = document.createElement("li");
      const sp = document.createElement("span"); sp.style.flex = "1"; const pr = list.find((p) => p.id === v.project);
      sp.textContent = `${t(names[v.name] || v.name)}: ${pr ? pr.name : v.project}`;
      const x = document.createElement("span"); x.className = "x"; x.textContent = "✕";
      x.onclick = async () => { const views = S.project.views.slice(); views.splice(i, 1); S.project = await patch(`/api/projects/${pid()}`, { views }); renderViews(); setupExport(); };
      li.append(sp, x); ul.append(li);
    });
  }
  $("#btn-view-add").onclick = async () => {
    const vp = $("#view-project").value; if (!vp) return;
    const views = (S.project.views || []).concat([{ project: vp, name: $("#view-name").value }]);
    try { S.project = await patch(`/api/projects/${pid()}`, { views }); renderViews(); setupExport(); } catch (e) { toast(e.message, true); }
  };
  $("#proj-name").onchange = async (e) => { try { S.project = await patch(`/api/projects/${pid()}`, { name: e.target.value }); updateStepButtons(); } catch (err) { toast(err.message, true); } };
  for (const inp of $$("input.tb")) inp.onchange = async () => {
    const tb = {}; for (const i of $$("input.tb")) tb[i.dataset.tb] = i.value;
    try { S.project = await patch(`/api/projects/${pid()}`, { titleblock: tb, lang: LANG }); setupExport(); } catch (err) { toast(err.message, true); }
  };

  // --------------------------------------------------------- interaction ----
  function zoomAt(sx, sy, f) {
    const ns = Math.min(40, Math.max(0.02, S.view.scale * f));
    S.view.tx = sx - (sx - S.view.tx) * (ns / S.view.scale); S.view.ty = sy - (sy - S.view.ty) * (ns / S.view.scale); S.view.scale = ns;
    draw();
  }
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("wheel", (e) => { if (!S.img) return; e.preventDefault(); const [sx, sy] = evtPos(e); zoomAt(sx, sy, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  const centre = () => { const r = canvas.getBoundingClientRect(); return [r.width / 2, r.height / 2]; };
  $("#btn-zoom-in").onclick = () => { if (S.img) zoomAt(...centre(), 1.4); };
  $("#btn-zoom-out").onclick = () => { if (S.img) zoomAt(...centre(), 1 / 1.4); };
  $("#btn-fit").onclick = () => { if (S.img) { fitView(); draw(); } };

  const TOUCH = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  function touchHint() {
    if (!TOUCH) return;
    const h = $("#viewer-hint");
    if (h.textContent && !/vingers|fingers/.test(h.textContent)) h.textContent += LANG === "nl" ? " · twee vingers = zoom / verschuiven" : " · two fingers = zoom / pan";
  }
  const touches = new Map();
  let pinch = null, touchIgnore = false;
  function cancelInProgress() {
    const g = S.seg;
    if (g.stroke) g.stroke = null;
    if (g.drag) g.drag = null;
    if (g.dragPoint != null) { if (g.dragPoint === g.polygon.length - 1 && g.justAdded) g.polygon.pop(); g.dragPoint = null; }
    g.justAdded = false;
    S.edit.drag = null; S.measure.dragDim = null; S.measure.pending = null; S.panning = null;
  }
  function pinchStart() {
    const [a, b] = Array.from(touches.values());
    pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], view0: { ...S.view } };
  }
  function pinchMove() {
    const [a, b] = Array.from(touches.values());
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const f = Math.min(40, Math.max(0.02, pinch.view0.scale * d / pinch.d0)) / pinch.view0.scale;
    S.view.scale = pinch.view0.scale * f;
    S.view.tx = pinch.mid0[0] - (pinch.mid0[0] - pinch.view0.tx) * f + (mid[0] - pinch.mid0[0]);
    S.view.ty = pinch.mid0[1] - (pinch.mid0[1] - pinch.view0.ty) * f + (mid[1] - pinch.mid0[1]);
    draw();
  }
  canvas.addEventListener("dblclick", (e) => {
    if (S.step === "outline" && S.outlineTool === "edit" && S.drawing) { const [sx, sy] = evtPos(e); insertVertexAt(screenToMm(sx, sy)); }
    if (S.step === "draw" && S.draw.pts.length) { S.draw.pts.pop(); finishDrawShape(); }
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (!S.img) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointer */ }
    const [sx, sy] = evtPos(e);
    if (e.pointerType === "touch") {
      touches.set(e.pointerId, [sx, sy]);
      if (touches.size === 2) { cancelInProgress(); pinchStart(); return; }
      if (touches.size > 2 || touchIgnore) return;
    }
    const interactive = ["isolate", "measure", "draw"].includes(S.step) || (S.step === "outline" && S.outlineTool === "edit");
    if (e.button === 1 || e.button === 2 || e.shiftKey || !interactive) { S.panning = { sx, sy, tx: S.view.tx, ty: S.view.ty }; return; }
    const ip = toImg(sx, sy);
    if (S.step === "isolate") {
      const g = S.seg;
      if (g.tool === "points") {
        const tol = 12 / S.view.scale; let hit = -1;
        g.polygon.forEach((p, i) => { if (dist(p, ip) < tol) hit = i; });
        segHist.snap();
        if (hit >= 0) { g.dragPoint = hit; g.justAdded = false; } else { g.polygon.push(ip); g.dragPoint = g.polygon.length - 1; g.justAdded = true; }
      } else if (g.tool === "box") { g.drag = [ip[0], ip[1], 0, 0]; g.dragStart = ip; }
      else g.stroke = { kind: g.tool, pts: [ip], r: +$("#brush-size").value };
      draw();
    } else if (S.step === "outline") {
      const h = handleAt(sx, sy);
      if (h && e.altKey) { deleteHandle(h); return; }
      if (h) { outlineHist.snap(); S.edit.drag = { from: [...h.p] }; S.edit.sel = h; for (const prim of S.drawing.outline) if (prim.type === "arc") prim._mid = arcMid(prim); }
      else S.edit.sel = null;
      draw();
    } else if (S.step === "measure") {
      const mm = screenToMm(sx, sy);
      if (S.measure.tool === "label") { const text = prompt(t("Label text")); if (!text) return; annHist.snap(); S.drawing.labels.push({ pos: mm, text }); saveAnnotations(); return; }
      if (!S.measure.pending) { const hit = dimLineAt(mm); if (hit) { annHist.snap(); S.measure.dragDim = hit.i; S.measure.hl = hit.i; draw(); return; } }
      const sp = snapPoint(mm).p;
      if (!S.measure.pending) { S.measure.pending = sp; draw(); return; }
      const dim = { p1: S.measure.pending, p2: sp, kind: S.measure.tool, auto_mm: 0, manual_mm: null, label: "", offset_mm: 0, style: $("#dim-style").value };
      if (dimAuto(dim) < pxTolMm(3)) { S.measure.pending = null; draw(); return; }
      annHist.snap();
      if (S.armed != null && S.drawing.checklist && S.drawing.checklist[S.armed]) {
        const c = S.drawing.checklist[S.armed];
        dim.label = LANG === "nl" ? c.nl : c.en; dim.kind = c.kind === "value" ? "aligned" : c.kind;
        c.dim_id = `D${S.drawing.dimensions.length + 1}`; c.value_mm = null; S.armed = null;
        $("#viewer-hint").textContent = t("Tap 2 points for a dimension · drag a dimension line to move it"); touchHint();
      }
      S.drawing.dimensions.push(dim); S.measure.pending = null;
      const idx = S.drawing.dimensions.length - 1;
      saveAnnotations(() => showValueEntry(idx));
      renderDimTable(); draw();
    } else if (S.step === "draw") {
      const mm = snapPoint(screenToMm(sx, sy)).p;
      if (S.draw.tool === "text") { const text = prompt(t("Text")); if (!text) return; annHist.snap(); S.drawing.sketches.push({ points: [mm], style: "solid", arrow: false, text }); saveAnnotations(); return; }
      if (S.draw.tool === "region" && S.draw.pts.length >= 3 && dist(S.draw.pts[0], mm) < pxTolMm(12)) { finishDrawShape(); return; }
      S.draw.pts.push(mm); draw();
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!S.img) return;
    const [sx, sy] = evtPos(e);
    if (e.pointerType === "touch" && touches.has(e.pointerId)) {
      touches.set(e.pointerId, [sx, sy]);
      if (pinch && touches.size >= 2) { pinchMove(); return; }
      if (touchIgnore) return;
    }
    const ip = toImg(sx, sy);
    if (S.panning) { S.view.tx = S.panning.tx + (sx - S.panning.sx); S.view.ty = S.panning.ty + (sy - S.panning.sy); draw(); return; }
    $("#status").textContent = scaled() ? `x ${fmt(ip[0] / ppm(), 0)}  y ${fmt(ip[1] / ppm(), 0)} mm   zoom ${fmt(S.view.scale * 100, 0)}%` : `zoom ${fmt(S.view.scale * 100, 0)}%`;
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
    } else if (S.step === "draw") {
      if (S.draw.pts.length) { S.draw.hover = snapPoint(screenToMm(sx, sy)).p; draw(); }
    }
  });
  const endPointer = (e) => {
    if (e && e.pointerType === "touch") {
      touches.delete(e.pointerId);
      if (pinch) { pinch = null; touchIgnore = touches.size > 0; return; }
      if (touchIgnore) { touchIgnore = touches.size > 0; return; }
    }
    if (S.panning) { S.panning = null; return; }
    if (S.step === "isolate") {
      const g = S.seg;
      if (g.drag) { if (g.drag[2] > 4 && g.drag[3] > 4) { segHist.snap(); g.rect = g.drag; } g.drag = null; }
      if (g.stroke) { segHist.snap(); g.strokes.push(g.stroke); g.stroke = null; }
      g.dragPoint = null; draw();
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
    if (e.key === "Escape") { S.measure.pending = null; S.seg.drag = null; S.edit.sel = null; S.draw.pts = []; draw(); }
    if (e.key === "Enter" && S.step === "draw" && S.draw.pts.length) finishDrawShape();
    if (e.key === "f" && S.img) { fitView(); draw(); }
    if (e.key === "Backspace" || e.key === "Delete") {
      if (S.step === "isolate" && S.seg.tool === "points" && S.seg.polygon.length) { e.preventDefault(); segHist.snap(); S.seg.polygon.pop(); draw(); }
      if (S.step === "outline" && S.outlineTool === "edit" && S.edit.sel) { e.preventDefault(); const h = editHandles().find((x) => x.key === S.edit.sel.key); if (h) deleteHandle(h); S.edit.sel = null; }
      if (S.step === "draw" && S.draw.pts.length) { e.preventDefault(); S.draw.pts.pop(); draw(); }
    }
    if (S.step === "isolate") { const map = { p: "points", b: "box", s: "fg", g: "bg", e: "erase" }; if (map[e.key]) setSegTool(map[e.key]); }
  });
  new ResizeObserver(resizeCanvas).observe($("#viewer"));

  // -------------------------------------------------------------- boot ----
  applyI18n(); resizeCanvas(); goStep("photo");
})();
