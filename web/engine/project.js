/* Project state + pipeline (port of project.py). State JSON has the same shape as the Python project.json.
   Needs PV.store (async storage) and PV.io (image encode/decode); both are injected (IndexedDB in the browser, memory in tests). */
(function (PV) {
  "use strict";
  const P = (PV.project = {});
  const G = () => PV.geo;
  const MAX_SIDE = 2400, UNSCALED_UNITS = 1000;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // ------------------------------------------------------------ helpers
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; };
  const iso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const rand6 = () => Array.from({ length: 6 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  const safeName = (n) => (String(n || "photo").split(/[\\/]/).pop().replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80) || "photo");
  P.validId = (id) => /^[A-Za-z0-9_-]{4,64}$/.test(id);

  P.calibrationNote = (cal) => cal.scale_note || "ongeschaald";
  const calSize = (cal) => ({ w: cal.out_size[0] / cal.ppm, h: cal.out_size[1] / cal.ppm });

  // ------------------------------------------------------------ in-memory image cache (one project)
  const cache = { id: null, work: null, mask: null, workBytes: null };
  function dropCache() { if (cache.work) cache.work.delete(); if (cache.mask) cache.mask.delete(); cache.id = null; cache.work = null; cache.mask = null; cache.workBytes = null; }
  function useCache(id) { if (cache.id !== id) { dropCache(); cache.id = id; } }
  P.dropCache = dropCache;

  /** RGB cv.Mat of the working image (cached; do not delete). */
  async function workMat(id) {
    useCache(id);
    if (!cache.work) {
      const bytes = await PV.store.getBlob(id, "work"); if (!bytes) throw new Error("photo missing");
      const im = await PV.io.decode(bytes.data); const cv = PV.cv;
      const rgba = new cv.Mat(im.h, im.w, cv.CV_8UC4); rgba.data.set(im.rgba); const rgb = new cv.Mat();
      cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB); rgba.delete(); cache.work = rgb; cache.workBytes = bytes;
    }
    return cache.work;
  }
  async function maskMat(id) {
    useCache(id);
    if (!cache.mask) {
      const b = await PV.store.getBlob(id, "mask"); if (!b) return null;
      const g = await PV.io.decodeGray(b.data); const cv = PV.cv;
      const m = new cv.Mat(g.h, g.w, cv.CV_8UC1); m.data.set(g.data); cache.mask = m;
    }
    return cache.mask;
  }
  P.workMat = workMat; P.maskMat = maskMat;

  // ------------------------------------------------------------ create / load / list
  function newState(id) {
    return {
      id, name: "", created: iso(), original: null, image_size: null, calibration: null, segmentation: null,
      outline_params: clone(PV.DEFAULT_OUTLINE_PARAMS), outline: null, detail: null, dimensions: [], labels: [], finishes: [], sketches: [],
      titleblock: {}, lang: "nl", template: "vrij", checklist: [], views: [],
    };
  }
  P.create = async (bytes, filename, mime) => {
    const im = await PV.io.decode(bytes, MAX_SIDE).catch(() => { throw new Error("could not decode image (use JPEG/PNG/WebP; HEIC works on iPhone/iPad)"); });
    const id = `${stamp()}-${rand6()}`; const st = newState(id);
    st.original = (filename || "photo.jpg"); st.name = safeName(String(filename || "photo").replace(/\.[^.]+$/, ""));
    st.image_size = [im.origW, im.origH];
    st.calibration = { mode: "manual", ppm: Math.max(im.w, im.h) / UNSCALED_UNITS, out_size: [im.w, im.h], scaled: false, scale_note: "" };
    await PV.store.putBlob(id, "orig", bytes, mime || "image/jpeg");
    await PV.store.putBlob(id, "work", await PV.io.encode(im.rgba, im.w, im.h, "image/jpeg", 0.92), "image/jpeg");
    const p = new Project(st); await p.save(); return p;
  };
  P.load = async (id) => { if (!P.validId(id)) throw Object.assign(new Error("not found"), { status: 404 }); const st = await PV.store.getState(id); if (!st) throw Object.assign(new Error("not found"), { status: 404 }); return new Project(st); };
  P.list = async () => {
    const out = [];
    for (const s of await PV.store.listStates()) out.push({ id: s.id, name: s.name || "", created: s.created, updated: s.updated, calibrated: true, scaled: !!(s.calibration && s.calibration.scaled), segmented: !!s.segmentation, outlined: !!s.outline, dimensions: (s.dimensions || []).length });
    out.sort((a, b) => (a.id < b.id ? 1 : -1)); return out;
  };
  P.remove = async (id) => { if (cache.id === id) dropCache(); await PV.store.delProject(id); };

  /** Drawing object (mm, y-down) from a state. */
  P.drawingFromState = (st) => {
    const g = G(), cal = st.calibration, sz = calSize(cal), dr = g.newDrawing(sz.w, sz.h);
    dr.outline = (st.outline || []).map(g.primitiveFromDict); dr.detail = (st.detail || []).map(g.primitiveFromDict);
    dr.dimensions = (st.dimensions || []).map(g.dimFromDict); dr.labels = (st.labels || []).map(g.labelFromDict);
    dr.finishes = (st.finishes || []).map(g.finishFromDict); dr.sketches = (st.sketches || []).map(g.sketchFromDict);
    dr.titleblock = Object.assign({}, st.titleblock || {}); dr.checklist = clone(st.checklist || []);
    dr.meta = { name: st.name || "", source: st.original || "", calibration: P.calibrationNote(cal), scaled: !!cal.scaled, ppm: cal.ppm, project: st.id, lang: st.lang || "nl" };
    return dr;
  };

  // ------------------------------------------------------------ templates
  P.templatesJson = (lang) => Object.entries(PV.ELEMENT_TEMPLATES).map(([key, t]) => ({
    key, name: lang === "nl" ? t.nl : t.en, nl: t.nl, en: t.en,
    items: t.items.map(([k, nl, en, kind, hnl, hen]) => ({ key: k, name: lang === "nl" ? nl : en, nl, en, kind, hint: lang === "nl" ? hnl : hen, hint_nl: hnl, hint_en: hen })),
  }));
  P.checklistFromTemplate = (key) => { const t = PV.ELEMENT_TEMPLATES[key]; return t ? t.items.map(([k, nl, en, kind, hnl, hen]) => ({ key: k, nl, en, kind, hint: hnl, hint_nl: hnl, hint_en: hen, value_mm: null, dim_id: "" })) : []; };

  // ------------------------------------------------------------ Project
  class Project {
    constructor(state) { this.state = state; this.id = state.id; }
    async save() { this.state.updated = iso(); await PV.store.putState(this.id, this.state); }
    get cal() { return this.state.calibration; }
    drawing() { return P.drawingFromState(this.state); }
    drawingDict() { return G().drawingToDict(this.drawing()); }

    // -------- scale (the first typed measurement defines it)
    rescale(factor) {
      if (Math.abs(factor - 1) < 1e-12) return;
      const g = G(), sc = g.scaleDrawing(this.drawing(), factor), st = this.state;
      if (st.outline !== null) st.outline = sc.outline; if (st.detail !== null) st.detail = sc.detail;
      st.dimensions = sc.dimensions.map(g.dimToDict); st.labels = sc.labels; st.finishes = sc.finishes; st.sketches = sc.sketches;
      st.calibration.ppm = st.calibration.ppm / factor;
      st.outline_params.epsilon_mm = Math.round(st.outline_params.epsilon_mm * factor * 1000) / 1000;
    }
    async scaleFromDimension(index, typedMm) {
      const dims = this.state.dimensions || []; if (!(index >= 0 && index < dims.length)) throw new Error("no such dimension");
      const d = G().dimFromDict(dims[index]), cur = G().measuredAuto(d);
      if (cur <= 1e-9 || !(typedMm > 0)) throw new Error("dimension has no length");
      this.rescale(typedMm / cur);
      const label = d.label || `D${index + 1}`;
      this.state.calibration.scaled = true;
      this.state.calibration.scale_note = `${this.state.lang === "nl" ? "schaal uit" : "scale from"} ${label} = ${G().fmtG(typedMm)} mm`;
      await this.save(); return this.state.calibration;
    }

    // -------- segmentation
    async segment(o) {
      const cv = PV.cv, img = await workMat(this.id), seg = PV.segment;
      const strokes = seg.normaliseStrokes(o.fg, o.bg, o.strokes, o.brush_px || 8);
      const poly = (o.polygon || []).map((p) => [Number(p[0]), Number(p[1])]); const mode = o.mode || "grabcut";
      const band = o.band_px === undefined ? 20 : o.band_px, iters = o.iters || 5;
      let m;
      if (mode === "polygon") { if (poly.length < 3) throw new Error("click at least 3 points along the outer line first"); m = seg.exactPolygon(img.cols, img.rows, poly, strokes); }
      else if (poly.length >= 3 || o.rect) m = seg.grabcut(img, { rect: o.rect, strokes, polygon: poly.length >= 3 ? poly : null, bandPx: band, iters });
      else {
        const prev = await maskMat(this.id);
        if (prev) { const reg = PV.copyMat(prev); m = seg.grabcut(img, { strokes, region: reg, bandPx: band, iters }); reg.delete(); }
        else if (strokes.some((s) => s.kind === "fg")) {
          const layer = seg.strokeLayer(img.cols, img.rows, strokes, 1), reg = new cv.Mat(img.rows, img.cols, cv.CV_8UC1); const rd = reg.data;
          for (let i = 0; i < rd.length; i++) rd[i] = layer[i] === seg.LBL_FG ? 255 : 0;
          m = seg.grabcut(img, { strokes, region: reg, bandPx: band, iters, seed: true }); reg.delete();
        } else throw new Error("tap points along the stone, drag a box or paint the stone first");
      }
      useCache(this.id); if (cache.mask) cache.mask.delete(); cache.mask = m;
      this.state.outline = null; this.state.detail = null; this.state.outline_edited = false;
      this.state.segmentation = { rect: o.rect ? o.rect.map(Number) : null, polygon: poly, strokes, edits: [], brush_px: o.brush_px || 8, iters, band_px: band, mode };
      const png = await PV.io.encodeGray(m.data, m.cols, m.rows);
      await PV.store.putBlob(this.id, "mask", png, "image/png"); await PV.store.putBlob(this.id, "mask_base", png, "image/png");
      await this.save();
      let n = 0; const d = m.data; for (let i = 0; i < d.length; i++) if (d[i]) n++;
      return n;
    }
    /** Brush edits after a run, applied to the last GrabCut result (undo = send fewer edits). */
    async setEdits(edits) {
      if (!this.state.segmentation) throw new Error("run first");
      const cv = PV.cv; const b = (await PV.store.getBlob(this.id, "mask_base")) || (await PV.store.getBlob(this.id, "mask"));
      if (!b) throw new Error("run first");
      const g = await PV.io.decodeGray(b.data), base = new cv.Mat(g.h, g.w, cv.CV_8UC1); base.data.set(g.data);
      const ed = PV.segment.normaliseStrokes([], [], edits, 8), m = PV.segment.applyEdits(base, ed); base.delete();
      useCache(this.id); if (cache.mask) cache.mask.delete(); cache.mask = m;
      this.state.segmentation.edits = ed; this.state.outline = null; this.state.detail = null;
      await PV.store.putBlob(this.id, "mask", await PV.io.encodeGray(m.data, m.cols, m.rows), "image/png");
      await this.save();
      let n = 0; const d = m.data; for (let i = 0; i < d.length; i++) if (d[i]) n++;
      return n;
    }

    // -------- outline
    async outline(params) {
      const m = await maskMat(this.id); if (!m) throw new Error("segment first");
      const p = clone(this.state.outline_params);
      for (const [k, v] of Object.entries(params || {})) { if (k === "detail" && v && typeof v === "object") Object.assign(p.detail, v); else p[k] = v; }
      const prims = PV.contour.extractOutline(m, this.cal.ppm, p);
      let detail = [];
      if (p.detail && p.detail.enabled) detail = PV.contour.detailLines(await workMat(this.id), m, this.cal.ppm, p.detail);
      this.state.outline_params = p; this.state.outline = prims; this.state.outline_edited = false; this.state.detail = detail;
      await this.save(); return this.drawingDict();
    }
    async setOutline(prims) {
      this.state.outline = prims.map(G().primitiveFromDict); this.state.outline_edited = true; await this.save(); return this.drawingDict();
    }

    // -------- annotations
    async setTitleblock(fields) { const tb = Object.assign({}, this.state.titleblock || {}); for (const k of PV.TITLEBLOCK_FIELDS) if (k in fields) tb[k] = String(fields[k] || "").slice(0, 120); this.state.titleblock = tb; await this.save(); }
    async setTemplate(key) {
      const old = {}; for (const c of this.state.checklist || []) old[c.key] = c;
      const nw = P.checklistFromTemplate(key); for (const c of nw) if (old[c.key]) { c.value_mm = old[c.key].value_mm; c.dim_id = old[c.key].dim_id || ""; }
      this.state.template = PV.ELEMENT_TEMPLATES[key] ? key : ""; this.state.checklist = nw; await this.save(); return nw;
    }
    async setAnnotations(dimensions, labels, finishes, sketches, checklist) {
      const g = G(), st = this.state;
      st.dimensions = (dimensions || []).map((d, i) => { const dim = g.dimFromDict(d); dim.auto_mm = g.measuredAuto(dim); dim.id = `D${i + 1}`; return g.dimToDict(dim); });
      st.labels = (labels || []).map((l, i) => { const lab = g.labelFromDict(l); lab.id = lab.id || `L${i + 1}`; return lab; });
      if (finishes) { const out = []; for (const f of finishes) { const fin = g.finishFromDict(f); if (fin.polygon.length < 3) continue; fin.id = `F${out.length + 1}`; out.push(fin); } st.finishes = out; }
      if (checklist) {
        st.checklist = checklist.filter((c) => c && c.key).map((c) => ({
          key: String(c.key).slice(0, 40), nl: String(c.nl || "").slice(0, 80), en: String(c.en || "").slice(0, 80),
          kind: ["horizontal", "vertical", "aligned", "value", "any"].includes(c.kind) ? c.kind : "value", hint: String(c.hint || "").slice(0, 120),
          hint_nl: String(c.hint_nl === undefined ? c.hint || "" : c.hint_nl).slice(0, 120), hint_en: String(c.hint_en === undefined ? c.hint || "" : c.hint_en).slice(0, 120),
          value_mm: c.value_mm === null || c.value_mm === undefined || c.value_mm === "" ? null : Number(c.value_mm), dim_id: String(c.dim_id || "").slice(0, 8),
        }));
      }
      if (sketches) { const out = []; for (const s of sketches) { const sk = g.sketchFromDict(s); if (!sk.points.length) continue; sk.id = `S${out.length + 1}`; out.push(sk); } st.sketches = out; }
      await this.save();
    }

    // -------- views
    async setViews(views) {
      const out = [];
      for (const v of (views || []).slice(0, 6)) { const vid = String(v.project || ""); if (vid === this.id || !P.validId(vid) || !(await PV.store.getState(vid))) continue; out.push({ project: vid, name: String(v.name || "side").slice(0, 40) }); }
      this.state.views = out; await this.save(); return out;
    }
    async combinedDrawing() {
      const main = this.drawing(), views = [];
      for (const v of this.state.views || []) { const st = P.validId(v.project) ? await PV.store.getState(v.project) : null; if (st && st.outline) views.push([v.name || "side", P.drawingFromState(st)]); }
      return PV.views.combine(main, views, main.meta.lang);
    }
  }
  P.Project = Project;
})(globalThis.PV = globalThis.PV || {});
