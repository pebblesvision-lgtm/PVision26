/* Router: the same /api routes the Flask server offers, answered by the in-browser engine.
   handle({method, path, query, body}) -> {status, json | bytes+type | text+type, filename?} */
(function (PV) {
  "use strict";
  const A = (PV.api = {});
  const P = () => PV.project, G = () => PV.geo;
  const ok = (json) => ({ status: 200, json });
  const err = (msg, status = 400) => ({ status, json: { error: msg } });
  const bytesRes = (bytes, type, filename) => ({ status: 200, bytes, type, filename });
  const exportName = (st) => st.name || st.id;

  async function drawingFor(p, query) { return query.views === "0" ? p.drawing() : p.combinedDrawing(); }

  A.handle = async (req) => {
    const method = (req.method || "GET").toUpperCase(), path = req.path.replace(/\/+$/, ""), q = req.query || {}, body = req.body;
    let m;
    try {
      if (method === "GET" && path === "/api/projects") return ok(await P().list());
      if (method === "POST" && path === "/api/projects") {
        const f = body && body.photo; if (!f || !f.bytes) return err("no photo uploaded");
        return ok((await P().create(f.bytes, f.name, f.type)).state);
      }
      if (method === "POST" && path === "/api/projects/sample") { const bytes = await PV.sampleBytes(); return ok((await P().create(bytes, "sample.jpg", "image/jpeg")).state); }
      if (method === "POST" && path === "/api/projects/import") {
        let j; try { j = JSON.parse(body.text); } catch (e) { return err("not a project file"); }
        if (!j || j.format !== "pvsketch-project" || !j.state || !j.original_b64) return err("not a pvsketch project file");
        const unb64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
        const p = await P().create(unb64(j.original_b64), j.state.original || "photo.jpg", j.original_mime || "image/jpeg");
        const keep = ["name", "outline_params", "dimensions", "labels", "finishes", "sketches", "titleblock", "lang", "template", "checklist", "outline", "detail", "outline_edited", "calibration", "segmentation"];
        for (const k of keep) if (j.state[k] !== undefined) p.state[k] = j.state[k];
        if (j.mask_b64) await PV.store.putBlob(p.id, "mask", unb64(j.mask_b64), "image/png");
        await p.save(); return ok(p.state);
      }
      if (method === "GET" && path === "/api/finishes") return ok(Object.entries(PV.FINISH_NAMES).map(([k, v]) => Object.assign({ kind: k, nl: v[0], en: v[1] }, PV.FINISH_DEFAULTS[k] || { pattern: "none", spacing: 0, angle: 0 })));
      if (method === "GET" && path === "/api/templates") return ok(P().templatesJson(q.lang || "en"));
      if (method === "GET" && path === "/healthz") return ok({ ok: true });

      if (!(m = path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/))) return err("not found", 404);
      const pid = m[1], sub = m[2] || "";
      if (method === "DELETE" && sub === "") { await P().remove(pid); return ok({ deleted: true }); }
      const p = await P().load(pid); const st = p.state;

      if (sub === "" && method === "GET") return ok(st);
      if (sub === "" && method === "PATCH") {
        if ("name" in body) st.name = String(body.name).slice(0, 80);
        if (body.lang === "en" || body.lang === "nl") st.lang = body.lang;
        if (body.titleblock && typeof body.titleblock === "object") await p.setTitleblock(body.titleblock);
        if (Array.isArray(body.views)) await p.setViews(body.views);
        await p.save(); return ok(st);
      }
      if (method === "GET" && (m = sub.match(/^image\/(\w+)$/))) return await image(p, m[1]);
      if (sub === "scale" && method === "PUT") {
        try { const cal = await p.scaleFromDimension(parseInt(body.index || 0, 10), Number(body.mm || 0)); return ok({ calibration: cal, drawing: p.drawingDict(), state: st }); } catch (e) { return err(e.message); }
      }
      if (sub === "segment" && method === "POST") {
        let rect = body.rect; const polygon = body.polygon || [];
        if (rect && (rect.length !== 4 || rect[2] < 4 || rect[3] < 4)) rect = null;
        if (!rect && polygon.length < 3 && !st.segmentation && !(body.strokes || []).some((x) => x.kind === "fg")) return err("tap points along the stone, drag a box or paint the stone first");
        try { const n = await p.segment({ rect, fg: body.fg, bg: body.bg, brush_px: parseInt(body.brush_px || 8, 10), iters: parseInt(body.iters || 5, 10), strokes: body.strokes, polygon, band_px: Number(body.band_px === undefined ? 20 : body.band_px), mode: body.mode || "grabcut" }); return ok({ mask_px: n, state: st }); }
        catch (e) { return err(`segmentation failed: ${e.message || e}`); }
      }
      if (sub === "mask_edits" && method === "PUT") { try { return ok({ mask_px: await p.setEdits(body.edits || []), state: st }); } catch (e) { return err(e.message); } }
      if (sub === "outline" && method === "POST") { if (!(await P().maskMat(pid))) return err("segment first"); try { return ok(await p.outline((body || {}).params)); } catch (e) { return err(e.message); } }
      if (sub === "outline" && method === "PUT") { try { return ok(await p.setOutline(body.outline || [])); } catch (e) { return err(`bad outline: ${e.message}`); } }
      if (sub === "drawing" && method === "GET") return ok(p.drawingDict());
      if (sub === "annotations" && method === "PUT") { await p.setAnnotations(body.dimensions || [], body.labels || [], body.finishes, body.sketches, body.checklist); return ok(p.drawingDict()); }
      if (sub === "template" && method === "PUT") {
        const key = String(body.template || ""); if (key && !PV.ELEMENT_TEMPLATES[key]) return err("unknown template");
        const cl = await p.setTemplate(key); return ok({ template: st.template, checklist: cl });
      }
      if (method === "GET" && (m = sub.match(/^export\.(\w+)$/))) return await exportFile(p, m[1], q);
      return err("not found", 404);
    } catch (e) {
      if (e && e.status === 404) return err("not found", 404);
      return err(String((e && e.message) || e), 500);
    }
  };

  async function image(p, kind) {
    const id = p.id;
    if (kind === "original") { const b = await PV.store.getBlob(id, "orig"); return b ? bytesRes(b.data, b.mime) : err("not found", 404); }
    if (kind === "rectified") { const b = await PV.store.getBlob(id, "work"); return b ? bytesRes(b.data, b.mime) : err("not found", 404); }
    if (kind === "mask") { const b = await PV.store.getBlob(id, "mask"); return b ? bytesRes(b.data, b.mime) : err("not found", 404); }
    if (kind === "overlay") {
      const m = await PV.project.maskMat(id); if (!m) return err("not found", 404);
      const img = await PV.project.workMat(id), rgba = PV.segment.overlayRGBA(img, m);
      return bytesRes(await PV.io.encode(rgba, img.cols, img.rows, "image/jpeg", 0.85), "image/jpeg");
    }
    if (kind === "preview") { const dr = await p.combinedDrawing(); return bytesRes(await PV.render.drawingToImage(dr, { pxPerMm: 3, maxSide: 1600, background: await bg(id), mime: "image/png" }), "image/png"); }
    return err("not found", 404);
  }
  async function bg(id) { const b = await PV.store.getBlob(id, "work"); return b ? b.data : null; }

  async function exportFile(p, fmt, q) {
    const st = p.state; if (q.lang === "en" || q.lang === "nl") st.lang = q.lang;      // not saved: only for this export
    const dr = await drawingFor(p, q), name = exportName(st), withPhoto = q.photo === "1";
    if (fmt === "svg") return bytesRes(new TextEncoder().encode(PV.exportSvg.drawingToSvg(dr, { backgroundJpeg: withPhoto ? await bg(p.id) : null })), "image/svg+xml", `${name}.svg`);
    if (fmt === "dxf") return bytesRes(new TextEncoder().encode(PV.exportDxf.drawingToDxf(dr)), "application/dxf", `${name}.dxf`);
    if (fmt === "pdf") { const paper = ["auto", "a4", "a3"].includes((q.paper || "auto").toLowerCase()) ? (q.paper || "auto").toLowerCase() : "auto"; return bytesRes(PV.exportPdf.drawingToPdf(dr, paper), "application/pdf", `${name}.pdf`); }
    if (fmt === "csv") return bytesRes(new TextEncoder().encode(PV.exportTable.dimensionsCsv(dr)), "text/csv", `${name}-measurements.csv`);
    if (fmt === "png" || fmt === "jpg" || fmt === "jpeg") {
      const mime = fmt === "png" ? "image/png" : "image/jpeg";
      return bytesRes(await PV.render.drawingToImage(dr, { pxPerMm: 4, maxSide: 4000, background: withPhoto ? await bg(p.id) : null, mime }), mime, `${name}.${fmt === "png" ? "png" : "jpg"}`);
    }
    if (fmt === "json") {
      const o = await PV.store.getBlob(p.id, "orig"), mk = await PV.store.getBlob(p.id, "mask");
      const b64 = PV.exportSvg.b64;
      return bytesRes(new TextEncoder().encode(JSON.stringify({ format: "pvsketch-project", version: 1, state: st, original_mime: o ? o.mime : "image/jpeg", original_b64: o ? b64(o.data) : "", mask_b64: mk ? b64(mk.data) : "" })), "application/json", `${name}.pvsketch.json`);
    }
    return err("not found", 404);
  }
})(globalThis.PV = globalThis.PV || {});
