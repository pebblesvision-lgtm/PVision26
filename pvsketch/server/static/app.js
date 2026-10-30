/* pvsketch UI - vanilla JS, no build step, works offline. English / Nederlands. */
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ------------------------------------------------------------- i18n ----
  // Static page text: data-i18n keys (innerHTML). Dynamic text: t("english text").
  const NL = {
    "brand.sub": "foto &rarr; omtrek op ware grootte (offline)", "undo": "Ongedaan", "redo": "Opnieuw", "projects": "Projecten", "newphoto": "Nieuwe foto",
    "step.photo": "Foto", "step.calibrate": "Kalibreren", "step.isolate": "Isoleren", "step.outline": "Omtrek", "step.measure": "Opmeten", "step.draw": "Tekenen", "step.export": "Exporteren",
    "photo.h": "1. Foto", "photo.p": "Fotografeer het steenvlak <b>zo recht mogelijk van voren</b>, met een referentie van bekende afmeting plat <b>in hetzelfde vlak</b> als het vlak dat u wilt opmeten: een A4-vel, een geprinte marker of een duimstok.",
    "photo.drop": "Sleep een foto hierheen of klik om te kiezen<br><span class=\"muted\">JPEG / PNG / HEIC, tot 60 MB</span>", "photo.camera": "Foto maken (telefoon)", "photo.sample": "Probeer de voorbeeldfoto",
    "photo.marker": "Marker nodig? <a href=\"/api/marker/0.png?size_mm=100\">Download een ArUco-marker van 100 mm</a> en print op 100%. Controleer de geprinte maat met een duimstok.", "photo.recent": "Recente projecten",
    "cal.h": "2. Schaal &amp; perspectief kalibreren", "cal.ref": "Referentie", "cal.a4": "A4-vel (210 x 297 mm)", "cal.a3": "A3-vel (297 x 420 mm)", "cal.a5": "A5-vel (148 x 210 mm)", "cal.custom": "Eigen rechthoek (B x H mm)", "cal.aruco": "ArUco-marker (automatisch)", "cal.two": "Twee punten (alleen schaal, geen perspectief)",
    "cal.w": "Breedte mm", "cal.hh": "Hoogte mm", "cal.markermm": "Markerzijde mm", "cal.detect": "Detecteren", "cal.dist": "Afstand mm", "cal.clear": "Punten wissen", "cal.go": "Kalibreren", "advanced": "Geavanceerd", "cal.ppm": "Pixels per mm in het gecorrigeerde beeld (leeg = automatisch)",
    "iso.h": "3. De steen isoleren", "iso.p": "Werkt het best op echte steen: <b>Punten</b> - klik langs de buitenlijn (ongeveer is goed genoeg), dan <b>Uitvoeren</b>. GrabCut zoekt de exacte rand alleen binnen de band rond uw punten. Of sleep een <b>Kader</b>. Corrigeer met de kwasten en de <b>Gum</b>, ongedaan maken met Ctrl/Cmd+Z.",
    "iso.points": "Punten", "iso.box": "Kader", "iso.fg": "Kwast steen", "iso.bg": "Kwast achtergrond", "iso.erase": "Gum", "iso.brush": "Kwastgrootte", "iso.band": "Zoekband rond de punten", "iso.exact": "Punten exact als omtrek gebruiken (geen GrabCut)", "iso.iters": "GrabCut-iteraties", "iso.clearpts": "Punten wissen", "iso.clearpaint": "Verf wissen", "run": "Uitvoeren",
    "ol.h": "4. Omtrek", "ol.eps": "Vereenvoudigingstolerantie", "ol.arcs": "Bogen passen (rondingen worden echte cirkelbogen)", "ol.minr": "Min. boogstraal mm", "ol.minlen": "Min. booglengte mm", "ol.smooth": "Contour gladstrijken", "ol.detail": "Detaillijnen (binnen de steen)", "ol.dton": "Bewerkingssporen / breuken / profielen traceren", "low": "laag", "high": "hoog", "ol.minlenmm": "Min. lengte mm", "ol.grain": "Korrel gladstrijken", "ol.go": "Omtrek bepalen",
    "ol.edith": "Handmatig bewerken", "ol.view": "Bekijken", "ol.edit": "Punten verplaatsen", "ol.editp": "Sleep punten, dubbelklik op een lijn om een punt toe te voegen, Alt+klik om te verwijderen. Opnieuw bepalen overschrijft uw wijzigingen.", "showphoto": "Foto onder de tekening tonen",
    "me.h": "5. Opmeten &amp; registreren", "me.p": "Klik twee punten voor een maatlijn (klikt vast op hoeken van de omtrek). <b>Sleep de maatlijn</b> daarna van de steen af, zoals in CAD. Typ de <b>met de duimstok opgemeten waarde</b> om die te registreren; die komt op de tekening met de fotowaarde tussen haakjes.",
    "me.aligned": "Uitgelijnd", "me.horizontal": "Horizontaal", "me.vertical": "Verticaal", "me.label": "Tekst", "me.probe": "Coördinaat", "line": "Lijn", "solid": "doorlopend", "dashed": "gestreept", "dotted": "gestippeld", "me.snap": "Vastklikken op omtrek", "me.tidy": "Opruimen", "label": "Omschrijving", "me.photo": "Foto", "me.measured": "Opgemeten", "me.off": "Afst.",
    "dr.h": "6. Bewerkingen &amp; tekenen", "dr.p": "Geef ambachtelijke bewerkingen aan als vlakken: klik de hoeken van het vlak, dan <b>Vlak sluiten</b> (of dubbelklik). Het vlak wordt gearceerd met het patroon van die bewerking en krijgt F1, F2… Lijnen, pijlen en tekst voor al het andere.",
    "dr.region": "Bewerkingsvlak", "dr.line": "Lijn", "dr.arrow": "Pijl + tekst", "dr.text": "Tekst", "dr.kind": "Bewerking", "dr.angle": "Richting °", "dr.spacing": "Steek mm", "dr.width": "Band mm", "cancel": "Annuleren", "dr.close": "Vlak sluiten / lijn beëindigen",
    "ex.h": "7. Exporteren", "ex.p": "Alle exports zijn op <b>ware grootte in millimeters</b>. Y is gespiegeld voor DXF (CAD y-omhoog).", "ex.tb": "Titelblok", "ex.name": "Tekeningnaam", "tb.project": "Project", "tb.element": "Element", "tb.material": "Steensoort", "tb.quantity": "Aantal", "tb.finish": "Afwerking (algemeen)", "tb.drawn_by": "Getekend door", "tb.notes": "Opmerkingen",
    "ex.cad": "Voor CAD / CAM / steensoftware", "ex.dxf12": "DXF R12 (max. compatibiliteit, oudere programma's)", "ex.shop": "Voor de werkplaats / het dossier", "ex.pdf": "PDF, ware grootte op A4/A3 (automatisch)", "ex.csv": "CSV met maten (Excel)", "ex.svgphoto": "SVG met gecorrigeerde foto erin", "ex.png": "PNG-voorbeeld", "ex.json": "Project-JSON (back-up)", "ex.note": "Projectbestanden staan in de workspace-map van deze server; er wordt niets elders naartoe gestuurd.",
    // dynamic
    "Upload a photo to begin": "Upload een foto om te beginnen", "Uploading…": "Uploaden…", "Photo loaded": "Foto geladen", "Calibrated": "Gekalibreerd", "Working…": "Bezig…",
    "Click reference corners · wheel = zoom · right-drag = pan": "Klik de hoeken van de referentie · scrollwiel = zoom · rechts slepen = verschuiven",
    "Click points along the outer line (or drag a box), then Run · right-drag = pan · Ctrl+Z undo": "Klik punten langs de buitenlijn (of sleep een kader), dan Uitvoeren · rechts slepen = verschuiven · Ctrl+Z ongedaan",
    "Click 2 points for a dimension · drag a dimension line to move it · right-drag = pan": "Klik 2 punten voor een maatlijn · sleep een maatlijn om die te verplaatsen · rechts slepen = verschuiven",
    "Drag vertices · double-click a line to add · Alt+click to delete · Ctrl+Z undo": "Sleep punten · dubbelklik op een lijn om toe te voegen · Alt+klik om te verwijderen · Ctrl+Z ongedaan",
    "Click the corners of the area, then Close region (or double-click) · right-drag = pan": "Klik de hoeken van het vlak, dan Vlak sluiten (of dubbelklik) · rechts slepen = verschuiven",
    "Click the 4 corners of the sheet in the photo (any order). Zoom with the wheel for precision; drag with the right mouse button to pan.": "Klik de <b>4 hoeken</b> van het vel in de foto (willekeurige volgorde). Zoom met het scrollwiel voor precisie; sleep met de rechtermuisknop om te verschuiven.",
    "Lay the printed marker flat on the stone face. Press Detect, then Calibrate.": "Leg de geprinte marker plat op het steenvlak. Druk op <b>Detecteren</b>, dan <b>Kalibreren</b>.",
    "Click 2 points with a known distance between them (e.g. the ends of a ruler). No perspective correction: only use when the camera was square to the face.": "Klik <b>2 punten</b> met een bekende afstand ertussen (bv. de uiteinden van een duimstok). Geen perspectiefcorrectie: alleen gebruiken als de camera recht voor het vlak stond.",
    "click the 4 corners of the reference": "klik de 4 hoeken van de referentie", "found": "gevonden", "marker(s)": "marker(s)", "no marker found": "geen marker gevonden",
    "rectified image": "gecorrigeerd beeld", "resolution": "resolutie", "per pixel": "per pixel",
    "Click at least 3 points along the stone or drag a box first": "Klik eerst minstens 3 punten langs de steen of sleep een kader", "'Use points exactly' needs at least 3 points": "'Punten exact gebruiken' heeft minstens 3 punten nodig",
    "stone area": "steenoppervlak", "Check the red boundary. Wrong somewhere? Add points or brush there and Run again, then go to 4.": "Controleer de rode rand. Klopt iets niet? Zet daar punten of kwaststreken en voer opnieuw uit, ga dan naar 4.",
    "You edited this outline by hand. Re-extracting replaces your edits. Continue?": "U heeft deze omtrek handmatig bewerkt. Opnieuw bepalen overschrijft uw wijzigingen. Doorgaan?",
    "bounding box": "omhullende", "straight segments": "rechte stukken", "arcs": "bogen", "detail lines": "detaillijnen", "(edited by hand)": "(handmatig bewerkt)", "no outline found - check the mask in step 3": "geen omtrek gevonden - controleer het masker in stap 3",
    "Label text": "Tekst", "e.g. width": "bv. breedte", "delete": "verwijderen", "offset of the dimension line, mm": "afstand van de maatlijn, mm", "line style": "lijnstijl",
    "Sample loaded: click the 4 corners of the white A4 sheet": "Voorbeeld geladen: klik de 4 hoeken van het witte A4-vel", "No projects yet": "Nog geen projecten",
    "outlined": "omtrek", "isolated": "geïsoleerd", "calibrated": "gekalibreerd", "photo": "foto", "dims": "maten",
    "Text": "Tekst", "A region needs at least 3 points": "Een vlak heeft minstens 3 punten nodig", "auto": "auto",
    "cal.board3": "A3 markerbord (automatisch, beste)", "cal.board4": "A4 markerbord (automatisch)", "cal.aruco": "Losse ArUco-marker (automatisch)",
    "photo.marker": "Beste referentie: het <a href=\"/api/board/a3.pdf\">A3-markerbord</a> (of <a href=\"/api/board/a4.pdf\">A4</a>). Print op 100%, controleer de 100 mm-balk met een duimstok, plak het vlak op foamboard. Leg het op het steenvlak; het wordt automatisch herkend. Een losse <a href=\"/api/marker/0.png?size_mm=100\">marker van 100 mm</a> of een A4-vel werkt ook.",
    "Lay the whole marker board flat on the stone face, in focus. Press Calibrate: the markers are found automatically.": "Leg het hele markerbord plat op het steenvlak, scherp in beeld. Druk op <b>Kalibreren</b>: de markers worden automatisch gevonden.",
    "lens.h": "Cameralensprofiel (haalt tonvormige vertekening weg)", "lens.p": "Telefoonlenzen buigen rechte randen aan de rand van het beeld. Print het <a href=\"/api/checkerboard.pdf\">schaakbord</a>, fotografeer het 8-12 keer vanuit verschillende hoeken en afstanden met de lens die u voor steenfoto's gebruikt (nooit de 0,5x groothoek), upload ze hier. Het profiel wordt automatisch toegepast op latere foto's van dezelfde camera.", "lens.name": "Profielnaam", "lens.create": "Profiel maken", "lens.use": "Lensprofiel voor deze foto",
    "profile created": "profiel gemaakt", "images used": "foto's gebruikt", "reprojection error": "herprojectiefout", "Lens profile applied; calibrate again.": "Lensprofiel toegepast; kalibreer opnieuw.",
    "ex.views": "Andere aanzichten van dit element op hetzelfde blad", "ex.viewsp": "Een zijaanzicht, profiel of bovenaanzicht is een ander project (een andere foto van hetzelfde element). Koppel het hier; het wordt naast dit aanzicht getekend, bovenkanten gelijk, met hetzelfde titelblok.",
    "view.side": "Zijaanzicht", "view.profile": "Profiel", "view.top": "Bovenaanzicht", "view.back": "Achteraanzicht", "add": "Toevoegen",
    "iso.smart": "Slim selecteren (AI)", "iso.smartp": "Klik op de steen (links) en op de achtergrond (Alt+klik), dan Uitvoeren. Het model zoekt de rand; GrabCut wordt niet gebruikt.",
    "me.template": "Elementsjabloon (checklist van verplichte maten)", "me.item": "Maat", "me.value": "mm", "Measure": "Meten", "Now measure": "Meet nu", "type the value": "typ de waarde", "not on photo": "niet op de foto",
  };
  let LANG = (() => { try { return localStorage.getItem("pvsketch.lang") || (navigator.language || "").toLowerCase().startsWith("nl") ? "nl" : "en"; } catch (_) { return "en"; } })();
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
    calPoints: [], seg: null, drawing: null,
    outlineTool: "view", edit: { drag: null, sel: null },
    measure: { tool: "aligned", pending: null, hover: null, hl: null, dragDim: null },
    draw: { tool: "region", pts: [], hover: null },
    finishKinds: [], templates: [], armed: null,
    showPhoto: true, panning: null,
  };
  const newSeg = () => ({ rect: null, polygon: [], strokes: [], tool: "points", drag: null, dragStart: null, stroke: null, dragPoint: null, smartFg: [], smartBg: [] });
  let AI = false;
  (async () => { try { AI = !!(await api("/api/ai")).smart_select; $("#tool-smart").hidden = !AI; } catch (_) { AI = false; } })();
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
  const segHist = new History(() => ({ rect: S.seg.rect, polygon: S.seg.polygon, strokes: S.seg.strokes, smartFg: S.seg.smartFg, smartBg: S.seg.smartBg }),
    (v) => { Object.assign(S.seg, v, { drag: null, stroke: null, dragPoint: null }); draw(); });
  const outlineHist = new History(() => S.drawing ? S.drawing.outline : [],
    (v) => { if (S.drawing) { S.drawing.outline = v; saveOutline(); draw(); } });
  const annGet = () => S.drawing ? { dimensions: S.drawing.dimensions, labels: S.drawing.labels, finishes: S.drawing.finishes, sketches: S.drawing.sketches, checklist: S.drawing.checklist || [] } : { dimensions: [], labels: [], finishes: [], sketches: [], checklist: [] };
  const annHist = new History(annGet, (v) => { if (S.drawing) { Object.assign(S.drawing, v); saveAnnotations(); renderDimTable(); renderDrawTables(); draw(); } });
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
  const dimValue = (d) => (d.manual_mm != null && d.manual_mm !== "" ? Number(d.manual_mm) : d.auto_mm);
  function dimAuto(d) { const dx = d.p2[0] - d.p1[0], dy = d.p2[1] - d.p1[1]; return d.kind === "horizontal" ? Math.abs(dx) : d.kind === "vertical" ? Math.abs(dy) : Math.hypot(dx, dy); }
  function dimText(d) {
    let txt = fmt(dimValue(d));
    if (d.manual_mm != null && d.manual_mm !== "" && Math.abs(d.manual_mm - d.auto_mm) > 0.05) txt += ` (${t("photo")} ${fmt(d.auto_mm)})`;
    if (d.label) txt = `${d.label}: ${txt}`;
    return txt;
  }
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
    if (!S.img) { ctx.fillStyle = "#8e98a3"; ctx.font = "15px system-ui"; ctx.textAlign = "center"; ctx.fillText(t("Upload a photo to begin"), r.width / 2, r.height / 2); return; }
    ctx.save();
    ctx.translate(S.view.tx, S.view.ty); ctx.scale(S.view.scale, S.view.scale);
    ctx.imageSmoothingEnabled = S.view.scale < 2;
    const showPhoto = S.step === "calibrate" || S.step === "isolate" || S.showPhoto;
    if (showPhoto) ctx.drawImage(S.img, 0, 0);
    else { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S.img.width, S.img.height); }
    ctx.restore();
    if (S.step === "calibrate") drawCalibration();
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
          ctx.closePath(); ctx.strokeStyle = "rgba(242,169,59,.18)"; ctx.lineWidth = Math.max(1, 2 * (+$("#band-mm").value) * ppm() * S.view.scale); ctx.stroke();
        }
      }
      poly.forEach((p, i) => dot(p, i === 0 ? "#fff" : "#f2a93b", undefined, 5));
    }
    (g.smartFg || []).forEach((p) => dot(p, "#4fd18b", undefined, 5));
    (g.smartBg || []).forEach((p) => dot(p, "#ff6b6b", undefined, 5));
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
    let first = true, last = null;
    const pStart = (pr) => pr.type === "polyline" ? pr.points[0] : pr.start, pEnd = (pr) => pr.type === "polyline" ? pr.points[pr.points.length - 1] : pr.end;
    for (const prim of outline) {
      if (!first && last && dist(last, pStart(prim)) > 1e-6) { ctx.closePath(); first = true; }  // next loop (another view)
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
  function drawVectors() {
    const d = S.drawing; if (!d) return;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    // finishes first (under everything)
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
      const txt = `F${i + 1} ${f.label || finishName(f.kind)}`;
      ctx.font = "bold 12px system-ui"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(txt, cx, cy); ctx.fillStyle = "#ffe76a"; ctx.fillText(txt, cx, cy);
    }
    if (d.outline && d.outline.length) {
      traceOutline(d.outline);
      ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.lineWidth = 5; ctx.stroke();
      ctx.strokeStyle = "#ffe76a"; ctx.lineWidth = 2; ctx.stroke();
      if (S.step === "outline") {
        for (const prim of d.outline) if (prim.type === "arc") {
          const [cx, cy] = mmToScreen(prim.center);
          ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fillStyle = "#4fb3ff"; ctx.fill();
          ctx.font = "11px system-ui"; ctx.textAlign = "left"; ctx.fillText(`R${fmt(prim.radius)}`, cx + 5, cy - 5);
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
      ctx.beginPath(); ctx.rect(x - 4, y - 4, 8, 8);
      ctx.fillStyle = sel ? "#ff6b6b" : h.arc ? "#4fb3ff" : "#ffe76a"; ctx.fill(); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
    }
  }
  function drawDim(dim, idx, hl) {
    const g = dimGeom(dim);
    const q1 = mmToScreen(g.line[0]), q2 = mmToScreen(g.line[1]);
    const dx = q2[0] - q1[0], dy = q2[1] - q1[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const color = hl ? "#fff" : "#ff6b6b";
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    for (const [a, b] of g.ext) { const A = mmToScreen(a), B = mmToScreen(b); if (dist(A, B) > 1) { ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); } }
    ctx.setLineDash(DASHES[dim.style] || []); ctx.lineWidth = hl ? 2.5 : 1.6;
    ctx.beginPath(); ctx.moveTo(...q1); ctx.lineTo(...q2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); for (const q of [q1, q2]) { ctx.moveTo(q[0] - nx * 7, q[1] - ny * 7); ctx.lineTo(q[0] + nx * 7, q[1] + ny * 7); } ctx.stroke();
    const txt = `D${idx + 1}  ${dimText(dim)}`;
    ctx.save(); ctx.translate((q1[0] + q2[0]) / 2, (q1[1] + q2[1]) / 2); ctx.rotate(g.ang);
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
  function drawDrawTool() {
    const dtool = S.draw;
    if (dtool.pts.length) {
      const pts = dtool.hover ? dtool.pts.concat([dtool.hover]) : dtool.pts;
      polyPath(pts, dtool.tool === "region" && pts.length > 2);
      ctx.setLineDash([5, 4]); ctx.strokeStyle = "#ffe76a"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
      dtool.pts.forEach((p, i) => dot(mmToImg(p), i === 0 ? "#fff" : "#ffe76a", undefined, 4));
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
    const can = { photo: true, calibrate: !!p, isolate: !!(p && p.calibration), outline: !!(p && p.segmentation),
      measure: !!(p && p.outline), draw: !!(p && p.outline), export: !!(p && p.calibration) };
    for (const b of $$("#steps .step")) {
      const s = b.dataset.step; b.disabled = !can[s];
      b.classList.toggle("active", s === S.step);
      b.classList.toggle("done", s !== S.step && ({ photo: !!p, calibrate: !!(p && p.calibration), isolate: !!(p && p.segmentation), outline: !!(p && p.outline), measure: !!(p && p.dimensions && p.dimensions.length), draw: !!(p && ((p.finishes || []).length || (p.sketches || []).length)), export: false })[s]);
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
    try {
      if (step === "photo") { hint.textContent = ""; if (S.project) await showImage("original"); await refreshProjects(); refreshLenses(); }
      if (step === "calibrate") { hint.textContent = t("Click reference corners · wheel = zoom · right-drag = pan"); await showImage("original"); refreshLenses(); }
      if (step === "isolate") { hint.textContent = t("Click points along the outer line (or drag a box), then Run · right-drag = pan · Ctrl+Z undo"); await showImage(S.project.segmentation ? "overlay" : "rectified"); }
      if (step === "outline") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); if (!S.project.outline) await runOutline(); }
      if (step === "measure") { hint.textContent = t("Click 2 points for a dimension · drag a dimension line to move it · right-drag = pan"); await showImage("rectified"); await loadDrawing(); await ensureTemplates(); renderDimTable(); renderChecklist(); }
      if (step === "draw") { hint.textContent = t("Click the corners of the area, then Close region (or double-click) · right-drag = pan"); await showImage("rectified"); await loadDrawing(); await ensureFinishKinds(); renderDrawTables(); }
      if (step === "export") { hint.textContent = ""; await showImage("rectified"); await loadDrawing(); setupExport(); await renderViews(); }
    } catch (e) { toast(e.message, true); }
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
      goStep("calibrate");
    } catch (e) { toast(e.message, true); }
  }
  async function openProject(id) {
    S.project = await api(`/api/projects/${id}`);
    S.calPoints = []; S.seg = newSeg(); S.drawing = null;
    segHist.clear(); outlineHist.clear(); annHist.clear();
    if (S.project.calibration && !["aruco", "board"].includes(S.project.calibration.mode)) S.calPoints = S.project.calibration.ref_points_px.map((p) => [...p]);
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
    for (const inp of $$("input.tb")) inp.value = (S.project.titleblock || {})[inp.dataset.tb] || "";
    if (S.project.lang && S.project.lang !== LANG) { /* keep the UI language the user chose; the project follows on next save */ }
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
      meta.textContent = `${(p.updated || p.created || "").replace("T", " ").slice(0, 16)} · ${t(p.outlined ? "outlined" : p.segmented ? "isolated" : p.calibrated ? "calibrated" : "photo")}${p.dimensions ? ` · ${p.dimensions} ${t("dims")}` : ""}`;
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
  $("#btn-sample").onclick = async () => {
    try { const st = await api("/api/projects/sample", { method: "POST" }); await openProject(st.id); toast(t("Sample loaded: click the 4 corners of the white A4 sheet")); goStep("calibrate"); }
    catch (e) { toast(e.message, true); }
  };
  for (const ev of ["dragenter", "dragover"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); });
  for (const ev of ["dragleave", "drop"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); });
  dz.addEventListener("drop", (e) => upload(e.dataTransfer.files[0]));
  document.addEventListener("dragover", (e) => e.preventDefault());
  document.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0] && S.step === "photo") upload(e.dataTransfer.files[0]); });

  // -------------------------------------------------------------- lens ----
  async function refreshLenses() {
    let list = [];
    try { list = await api("/api/cameras"); } catch (_) { return; }
    const ul = $("#lens-list"); ul.innerHTML = "";
    for (const c of list) {
      const li = document.createElement("li");
      const sp = document.createElement("span"); sp.style.flex = "1"; sp.textContent = `${c.name}  ${c.make || ""} ${c.model || ""}  ${c.image_size ? c.image_size.join("x") : ""}  rms ${fmt(c.rms_px, 2)} px (${c.n_images})`;
      const x = document.createElement("span"); x.className = "x"; x.textContent = "✕"; x.onclick = async () => { await api(`/api/cameras/${encodeURIComponent(c.name)}`, { method: "DELETE" }); refreshLenses(); };
      li.append(sp, x); ul.append(li);
    }
    const sel = $("#lens-select"); const cur = S.project ? (S.project.lens || "") : "";
    sel.innerHTML = '<option value="">–</option><option value="auto">auto</option>';
    for (const c of list) { const o = document.createElement("option"); o.value = c.name; o.textContent = c.name; sel.append(o); }
    sel.value = cur;
  }
  $("#btn-lens-create").onclick = async () => {
    const files = $("#lens-files").files;
    if (files.length < 4) { toast(t("upload at least 4 checkerboard photos (8-12 is better)"), true); return; }
    const fd = new FormData(); fd.append("name", $("#lens-name").value);
    for (const f of files) fd.append("photos", f, f.name);
    const btn = $("#btn-lens-create"); busy(btn, true);
    try {
      const prof = await api("/api/cameras", { method: "POST", body: fd });
      $("#lens-result").className = "result ok"; $("#lens-result").textContent = `${t("profile created")}: ${prof.name}, ${prof.n_images} ${t("images used")}, ${t("reprojection error")} ${fmt(prof.rms_px, 2)} px`;
      refreshLenses();
    } catch (e) { $("#lens-result").className = "result err"; $("#lens-result").textContent = e.message; }
    busy(btn, false);
  };
  $("#lens-select").onchange = async (e) => {
    if (!S.project) return;
    try {
      S.project = await patch(`/api/projects/${pid()}`, { lens: e.target.value });
      e.target.value = S.project.lens || ""; S.calPoints = []; S.seg = newSeg(); S.drawing = null;
      await showImage("original"); updateStepButtons(); toast(t("Lens profile applied; calibrate again."));
    } catch (err) { toast(err.message, true); }
  };

  // ---------------------------------------------------------- language ----
  $("#lang").onchange = async (e) => {
    LANG = e.target.value; try { localStorage.setItem("pvsketch.lang", LANG); } catch (_) { /* private mode */ }
    applyI18n(); calInstructions(); renderDimTable(); renderDrawTables(); populateFinishKinds(); updateStepButtons(); draw();
    if (S.project && S.step === "measure") { await ensureTemplates(); renderChecklist(); }
    if (S.step === "export") setupExport();
    if (S.project) { try { S.project = await patch(`/api/projects/${pid()}`, { lang: LANG }); } catch (_) { /* offline edit */ } }
  };

  // -------------------------------------------------------- calibration ----
  const calMode = () => $("#cal-mode").value;
  function calInstructions() {
    const m = calMode();
    $("#cal-custom").hidden = m !== "custom"; $("#cal-aruco").hidden = m !== "aruco"; $("#cal-two").hidden = m !== "two_point";
    const en = m.startsWith("board") ? "Lay the whole marker board flat on the stone face, in focus. Press Calibrate: the markers are found automatically."
      : m === "aruco" ? "Lay the printed marker flat on the stone face. Press Detect, then Calibrate."
      : m === "two_point" ? "Click 2 points with a known distance between them (e.g. the ends of a ruler). No perspective correction: only use when the camera was square to the face."
      : "Click the 4 corners of the sheet in the photo (any order). Zoom with the wheel for precision; drag with the right mouse button to pan.";
    const enHtml = m.startsWith("board") ? en.replace("Calibrate", "<b>Calibrate</b>") : m === "aruco" ? en.replace("Detect", "<b>Detect</b>").replace("Calibrate", "<b>Calibrate</b>") : m === "two_point" ? en.replace("2 points", "<b>2 points</b>") : en.replace("4 corners", "<b>4 corners</b>");
    $("#cal-instructions").innerHTML = LANG === "nl" ? NL[en] : enHtml;
  }
  $("#cal-mode").onchange = () => { calInstructions(); S.calPoints = []; draw(); };
  $("#btn-cal-clear").onclick = () => { S.calPoints = []; draw(); };
  $("#btn-aruco-detect").onclick = async () => {
    try {
      const ms = await api(`/api/projects/${pid()}/aruco`);
      $("#aruco-result").textContent = ms.length ? `${t("found")} ${ms.length} ${t("marker(s)")}: id ${ms.map((m) => m.id).join(", ")}` : t("no marker found");
      S.calPoints = ms.length ? ms[0].corners : []; draw();
    } catch (e) { toast(e.message, true); }
  };
  $("#btn-calibrate").onclick = async () => {
    const m = calMode();
    const body = { mode: m.startsWith("board") ? "board" : m === "aruco" ? "aruco" : m === "two_point" ? "two_point" : "quad", points: S.calPoints };
    if (m.startsWith("board")) body.board = m.slice(6);
    const ppmIn = $("#cal-ppm").value; if (ppmIn) body.ppm = +ppmIn;
    if (m === "custom") { body.sheet = "custom"; body.width_mm = +$("#cal-w").value; body.height_mm = +$("#cal-h").value; }
    else if (m === "aruco") body.marker_mm = +$("#cal-marker-mm").value;
    else if (m === "two_point") body.dist_mm = +$("#cal-dist").value;
    else body.sheet = m;
    const btn = $("#btn-calibrate"); busy(btn, true);
    try {
      const r = await post(`/api/projects/${pid()}/calibrate`, body);
      S.project = r.state; S.seg = newSeg(); S.drawing = null; segHist.clear();
      const c = r.calibration;
      $("#cal-result").className = "result ok";
      $("#cal-result").textContent = `${c.note}\n${t("rectified image")} ${c.out_size[0]} x ${c.out_size[1]} px = ${fmt(c.out_size[0] / c.ppm, 0)} x ${fmt(c.out_size[1] / c.ppm, 0)} mm\n${fmt(c.ppm, 2)} px/mm (${t("resolution")} ≈ ${fmt(1 / c.ppm, 2)} mm ${t("per pixel")})`;
      updateStepButtons(); toast(t("Calibrated")); goStep("isolate");
    } catch (e) { $("#cal-result").className = "result err"; $("#cal-result").textContent = e.message; }
    busy(btn, false);
  };

  // ------------------------------------------------------- segmentation ----
  function setSegTool(tool) { S.seg.tool = tool; $$('[data-pane="isolate"] .tool').forEach((x) => x.classList.toggle("active", x.dataset.tool === tool)); $("#smart-help").hidden = tool !== "smart"; draw(); }
  $$('[data-pane="isolate"] .tool').forEach((b) => b.onclick = () => setSegTool(b.dataset.tool));
  $("#brush-size").oninput = (e) => { $("#brush-size-v").textContent = e.target.value; draw(); };
  $("#band-mm").oninput = (e) => { $("#band-mm-v").textContent = e.target.value; draw(); };
  $("#seg-exact").onchange = draw;
  $("#btn-seg-clear").onclick = () => { if (!S.seg.strokes.length) return; segHist.snap(); S.seg.strokes = []; draw(); };
  $("#btn-seg-clear-points").onclick = () => { if (!S.seg.polygon.length && !S.seg.smartFg.length && !S.seg.smartBg.length) return; segHist.snap(); S.seg.polygon = []; S.seg.smartFg = []; S.seg.smartBg = []; draw(); };
  $("#btn-segment").onclick = async () => {
    const g = S.seg, exact = $("#seg-exact").checked;
    if (g.tool === "smart") {
      if (!g.smartFg.length) { toast(t("Click at least 3 points along the stone or drag a box first"), true); return; }
      const btn = $("#btn-segment"); busy(btn, true);
      try {
        const r = await post(`/api/projects/${pid()}/smartselect`, { fg: g.smartFg, bg: g.smartBg, box: g.rect });
        S.project = r.state; S.drawing = null; outlineHist.clear();
        $("#seg-result").className = "result ok"; $("#seg-result").textContent = `${t("stone area")} ≈ ${fmt(r.mask_px / (ppm() * ppm()) / 100, 0)} cm². ${t("Check the red boundary. Wrong somewhere? Add points or brush there and Run again, then go to 4.")}`;
        await showImage("overlay"); updateStepButtons();
      } catch (e) { $("#seg-result").className = "result err"; $("#seg-result").textContent = e.message; }
      busy(btn, false); return;
    }
    if (g.polygon.length < 3 && !g.rect) { toast(t("Click at least 3 points along the stone or drag a box first"), true); return; }
    if (exact && g.polygon.length < 3) { toast(t("'Use points exactly' needs at least 3 points"), true); return; }
    const btn = $("#btn-segment"); busy(btn, true);
    try {
      const r = await post(`/api/projects/${pid()}/segment`, { rect: g.rect, polygon: g.polygon, strokes: g.strokes, brush_px: +$("#brush-size").value,
        iters: +$("#gc-iters").value, band_px: (+$("#band-mm").value) * ppm(), mode: exact ? "polygon" : "grabcut" });
      S.project = r.state; S.drawing = null; outlineHist.clear();
      const areaMm2 = r.mask_px / (ppm() * ppm());
      $("#seg-result").className = "result ok"; $("#seg-result").textContent = `${t("stone area")} ≈ ${fmt(areaMm2 / 100, 0)} cm². ${t("Check the red boundary. Wrong somewhere? Add points or brush there and Run again, then go to 4.")}`;
      await showImage("overlay"); updateStepButtons();
    } catch (e) { $("#seg-result").className = "result err"; $("#seg-result").textContent = e.message; }
    busy(btn, false);
  };

  // ------------------------------------------------------------ outline ----
  $("#ol-eps").oninput = (e) => ($("#ol-eps-v").textContent = e.target.value);
  $("#show-photo").onchange = (e) => { S.showPhoto = e.target.checked; draw(); };
  $$('[data-pane="outline"] .tool').forEach((b) => b.onclick = () => { S.outlineTool = b.dataset.tool; S.edit = { drag: null, sel: null }; $$('[data-pane="outline"] .tool').forEach((x) => x.classList.toggle("active", x === b)); $("#viewer-hint").textContent = S.outlineTool === "edit" ? t("Drag vertices · double-click a line to add · Alt+click to delete · Ctrl+Z undo") : ""; draw(); });
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
    const bb = d.bbox;
    $("#ol-result").className = "result ok";
    $("#ol-result").textContent = bb ? `${t("bounding box")} ${fmt(bb[2] - bb[0])} x ${fmt(bb[3] - bb[1])} mm\n${segs} ${t("straight segments")}, ${arcs} ${t("arcs")}, ${d.detail.length} ${t("detail lines")}${S.project.outline_edited ? "\n" + t("(edited by hand)") : ""}` : t("no outline found - check the mask in step 3");
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
    const tol = pxTolMm(8); let best = null;
    S.drawing.outline.forEach((prim, pi) => {
      if (prim.type !== "polyline") return;
      const n = prim.points.length, segs = prim.closed ? n : n - 1;
      for (let i = 0; i < segs; i++) { const dd = distToSegment(mm, prim.points[i], prim.points[(i + 1) % n]); if (dd < tol && (!best || dd < best.d)) best = { d: dd, pi, i }; }
    });
    if (!best) return false;
    outlineHist.snap(); S.drawing.outline[best.pi].points.splice(best.i + 1, 0, mm); saveOutline(); draw(); return true;
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
    const tol = pxTolMm(10); let best = null, bd = tol;
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
        S.drawing = await put(`/api/projects/${pid()}/annotations`, annGet());
        S.project.dimensions = S.drawing.dimensions; S.project.labels = S.drawing.labels; S.project.finishes = S.drawing.finishes; S.project.sketches = S.drawing.sketches; S.project.checklist = S.drawing.checklist;
        updateStepButtons(); renderDimTable(); renderChecklist(); renderDrawTables(); draw();
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
        <td><input class="lbl w-lbl" value="${(dim.label || "").replace(/"/g, "&quot;")}" placeholder="${t("e.g. width")}"></td>
        <td class="num">${fmt(dim.auto_mm)}</td>
        <td><input class="manual w-num" type="number" step="0.5" value="${dim.manual_mm ?? ""}" placeholder="${fmt(dim.auto_mm)}"></td>
        <td><input class="off w-off" type="number" step="1" value="${Math.round(dim.offset_mm || 0)}" title="${t("offset of the dimension line, mm")}"></td>
        <td><select class="sty" title="${t("line style")}"><option value="solid">—</option><option value="dashed">- -</option><option value="dotted">···</option></select></td>
        <td><span class="x" title="${t("delete")}">✕</span></td>`;
      tr.querySelector(".sty").value = dim.style || "solid";
      tr.querySelector(".lbl").onchange = (e) => { annHist.snap(); dim.label = e.target.value; saveAnnotations(); };
      tr.querySelector(".manual").onchange = (e) => { annHist.snap(); dim.manual_mm = e.target.value === "" ? null : +e.target.value; saveAnnotations(); };
      tr.querySelector(".off").onchange = (e) => { annHist.snap(); dim.offset_mm = +e.target.value || 0; saveAnnotations(); };
      tr.querySelector(".sty").onchange = (e) => { annHist.snap(); dim.style = e.target.value; saveAnnotations(); };
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
      const done = !!dim || c.value_mm != null;
      tr.className = (done ? "done " : "") + (S.armed === i ? "armed" : "");
      const name = LANG === "nl" ? c.nl : c.en;
      const kindTxt = c.kind === "value" ? t("type the value") : c.kind;
      tr.innerHTML = `<td>${name}<div class="hint">${c.hint || ""} ${c.kind === "value" ? "· " + t("not on photo") : ""}</div></td>
        <td>${dim ? `<b>${fmt(dimValue(dim))}</b> <span class="muted">${c.dim_id}</span>` : `<input type="number" step="0.5" value="${c.value_mm ?? ""}" placeholder="${kindTxt}">`}</td>
        <td>${c.kind !== "value" && !dim ? `<button class="ghost arm">${t("Measure")}</button>` : ""}</td>`;
      const inp = tr.querySelector("input");
      if (inp) inp.onchange = () => { annHist.snap(); c.value_mm = inp.value === "" ? null : +inp.value; saveAnnotations(); };
      const arm = tr.querySelector(".arm");
      if (arm) arm.onclick = () => { S.armed = S.armed === i ? null : i; S.measure.tool = c.kind; $$('[data-pane="measure"] .tool').forEach((x) => x.classList.toggle("active", x.dataset.tool === c.kind)); S.measure.pending = null;
        $("#viewer-hint").textContent = S.armed === i ? `${t("Now measure")}: ${name}` : t("Click 2 points for a dimension · drag a dimension line to move it · right-drag = pan"); renderChecklist(); draw(); };
      tb.append(tr);
    });
  }

  $("#btn-tidy").onclick = () => {
    const d = S.drawing; if (!d || !d.dimensions.length) return;
    annHist.snap();
    const bb = d.bbox || [0, 0, 0, 0];
    const groups = { horizontal: [], vertical: [], aligned: [] };
    d.dimensions.forEach((dim) => groups[dim.kind || "aligned"].push(dim));
    const step = 12;
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
    for (const f of S.finishKinds) { const o = document.createElement("option"); o.value = f.kind; o.textContent = LANG === "nl" ? `${f.nl} (${f.kind})` : `${f.en} – ${f.nl}`; sel.append(o); }
    if (cur) sel.value = cur;
    finishOptsForKind();
  }
  function finishOptsForKind() {
    const f = S.finishKinds.find((x) => x.kind === $("#fin-kind").value); if (!f) return;
    $("#fin-angle").placeholder = f.pattern === "lines" || f.pattern === "groups" ? `${f.angle}` : "–";
    $("#fin-spacing").placeholder = f.spacing ? `${f.spacing}` : "–";
    $("#fin-width").parentElement.style.display = f.pattern === "edge" ? "" : "none";
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
      const f = { polygon: pts.slice(), kind: $("#fin-kind").value, angle_deg: $("#fin-angle").value === "" ? null : +$("#fin-angle").value,
        spacing_mm: $("#fin-spacing").value === "" ? null : +$("#fin-spacing").value, width_mm: $("#fin-width").value === "" ? null : +$("#fin-width").value, label: "" };
      S.drawing.finishes.push(f);
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
        <td><input class="lbl w-lbl" value="${(f.label || "").replace(/"/g, "&quot;")}"></td>
        <td><input class="ang w-off" type="number" step="5" value="${f.angle_deg ?? ""}" placeholder="${t("auto")}"></td>
        <td><input class="sp w-off" type="number" step="0.5" value="${f.spacing_mm ?? ""}" placeholder="${t("auto")}"></td>
        <td><span class="x" title="${t("delete")}">✕</span></td>`;
      tr.querySelector(".kind").value = f.kind;
      tr.querySelector(".kind").onchange = (e) => { annHist.snap(); f.kind = e.target.value; saveAnnotations(); };
      tr.querySelector(".lbl").onchange = (e) => { annHist.snap(); f.label = e.target.value; saveAnnotations(); };
      tr.querySelector(".ang").onchange = (e) => { annHist.snap(); f.angle_deg = e.target.value === "" ? null : +e.target.value; saveAnnotations(); };
      tr.querySelector(".sp").onchange = (e) => { annHist.snap(); f.spacing_mm = e.target.value === "" ? null : +e.target.value; saveAnnotations(); };
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
    $("#exp-csv").href = `${base}.csv?${L}`; $("#exp-png").href = `${base}.png?photo=1&${L}`; $("#exp-json").href = `${base}.json`;
    $("#export-preview").src = `/api/projects/${pid()}/image/preview?t=${Date.now()}`;
  }
  async function renderViews() {
    const list = await api("/api/projects");
    const sel = $("#view-project"); sel.innerHTML = "";
    for (const p of list) { if (p.id === pid() || !p.outlined) continue; const o = document.createElement("option"); o.value = p.id; o.textContent = `${p.name} (${p.id.slice(0, 15)})`; sel.append(o); }
    const ul = $("#view-list"); ul.innerHTML = "";
    (S.project.views || []).forEach((v, i) => {
      const li = document.createElement("li");
      const sp = document.createElement("span"); sp.style.flex = "1"; const pr = list.find((p) => p.id === v.project);
      sp.textContent = `${t({ side: "view.side", profile: "view.profile", top: "view.top", back: "view.back" }[v.name] ? ({ side: "Side view", profile: "Profile", top: "Top view", back: "Back view" })[v.name] : v.name)}: ${pr ? pr.name : v.project}`;
      if (LANG === "nl" && NL["view." + v.name]) sp.textContent = `${NL["view." + v.name]}: ${pr ? pr.name : v.project}`;
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
    if (S.step === "draw" && S.draw.pts.length) { S.draw.pts.pop(); /* the dblclick's own second click */ finishDrawShape(); }
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (!S.img) return;
    canvas.setPointerCapture(e.pointerId);
    const [sx, sy] = evtPos(e);
    const interactive = ["calibrate", "isolate", "measure", "draw"].includes(S.step) || (S.step === "outline" && S.outlineTool === "edit");
    if (e.button === 1 || e.button === 2 || e.shiftKey || !interactive) { S.panning = { sx, sy, tx: S.view.tx, ty: S.view.ty }; return; }
    const ip = toImg(sx, sy);
    if (S.step === "calibrate") {
      const max = calMode() === "two_point" ? 2 : 4;
      if (calMode() === "aruco" || calMode().startsWith("board")) return;
      if (S.calPoints.length >= max) S.calPoints = [];
      S.calPoints.push(ip); draw();
    } else if (S.step === "isolate") {
      const g = S.seg;
      if (g.tool === "points") {
        const tol = 9 / S.view.scale; let hit = -1;
        g.polygon.forEach((p, i) => { if (dist(p, ip) < tol) hit = i; });
        segHist.snap();
        if (hit >= 0) g.dragPoint = hit; else { g.polygon.push(ip); g.dragPoint = g.polygon.length - 1; }
      } else if (g.tool === "box") { g.drag = [ip[0], ip[1], 0, 0]; g.dragStart = ip; }
      else if (g.tool === "smart") { segHist.snap(); (e.altKey ? g.smartBg : g.smartFg).push(ip); }
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
      if (S.measure.tool === "probe") { toast(`x ${fmt(mm[0])} mm, y ${fmt(mm[1])} mm`); return; }
      if (S.measure.tool === "label") { const text = prompt(t("Label text")); if (!text) return; annHist.snap(); S.drawing.labels.push({ pos: mm, text }); saveAnnotations(); return; }
      if (!S.measure.pending) { const hit = dimLineAt(mm); if (hit) { annHist.snap(); S.measure.dragDim = hit.i; S.measure.hl = hit.i; draw(); return; } }
      const sp = snapPoint(mm).p;
      if (!S.measure.pending) { S.measure.pending = sp; draw(); return; }
      const dim = { p1: S.measure.pending, p2: sp, kind: S.measure.tool, auto_mm: 0, manual_mm: null, label: "", offset_mm: 0, style: $("#dim-style").value };
      dim.auto_mm = dimAuto(dim);
      if (dim.auto_mm < 0.5) { S.measure.pending = null; draw(); return; }
      annHist.snap();
      if (S.armed != null && S.drawing.checklist && S.drawing.checklist[S.armed]) {
        const c = S.drawing.checklist[S.armed];
        dim.label = LANG === "nl" ? c.nl : c.en; dim.kind = c.kind === "value" ? "aligned" : c.kind;
        dim.auto_mm = dimAuto(dim);
        c.dim_id = `D${S.drawing.dimensions.length + 1}`; c.value_mm = null; S.armed = null;
        $("#viewer-hint").textContent = t("Click 2 points for a dimension · drag a dimension line to move it · right-drag = pan");
      }
      S.drawing.dimensions.push(dim); S.measure.pending = null; saveAnnotations();
    } else if (S.step === "draw") {
      const mm = snapPoint(screenToMm(sx, sy)).p;
      if (S.draw.tool === "text") { const text = prompt(t("Text")); if (!text) return; annHist.snap(); S.drawing.sketches.push({ points: [mm], style: "solid", arrow: false, text }); saveAnnotations(); return; }
      // clicking the first point again closes a region
      if (S.draw.tool === "region" && S.draw.pts.length >= 3 && dist(S.draw.pts[0], mm) < pxTolMm(9)) { finishDrawShape(); return; }
      S.draw.pts.push(mm); draw();
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
    } else if (S.step === "draw") {
      if (S.draw.pts.length) { S.draw.hover = snapPoint(screenToMm(sx, sy)).p; draw(); }
    }
  });
  const endPointer = () => {
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
    if (S.step === "isolate") { const map = { p: "points", b: "box", s: "fg", g: "bg", e: "erase", a: "smart" }; if (map[e.key] && (e.key !== "a" || AI)) setSegTool(map[e.key]); }
  });
  new ResizeObserver(resizeCanvas).observe($("#viewer"));

  // -------------------------------------------------------------- boot ----
  applyI18n(); calInstructions(); resizeCanvas(); goStep("photo");
})();
