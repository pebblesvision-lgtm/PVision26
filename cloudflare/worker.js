/* Web Worker: runs the whole engine (OpenCV.js, GrabCut, exports) off the UI thread. */
"use strict";
importScripts("vendor/opencv.js");
globalThis.PV = globalThis.PV || {};
importScripts("engine/data.js", "engine/i18n.js", "engine/geometry.js", "engine/hatch.js", "engine/contour.js", "engine/segment.js",
  "engine/export_svg.js", "engine/export_pdf.js", "engine/export_dxf.js", "engine/export_table.js", "engine/views.js",
  "engine/io.js", "engine/store_idb.js", "engine/render.js", "engine/project.js", "engine/api.js");

PV.sampleBytes = async () => new Uint8Array(await (await fetch("sample.jpg")).arrayBuffer());

const ready = (async () => {
  let cvv = self.cv;
  if (cvv instanceof Promise) cvv = await cvv; else if (!cvv.Mat) await new Promise((r) => { cvv.onRuntimeInitialized = r; });
  PV.cv = cvv; postMessage({ ready: true });
})();

let chain = Promise.resolve();                                  // one request at a time: projects are mutated in place
self.onmessage = (e) => {
  const { id, req } = e.data;
  chain = chain.then(async () => {
    await ready;
    let res;
    try { res = await PV.api.handle(req); } catch (err) { res = { status: 500, json: { error: String((err && err.message) || err) } }; }
    const transfer = res.bytes && res.bytes.buffer ? [res.bytes.buffer] : [];
    postMessage({ id, res }, transfer);
  });
};
