/* Loads the engine in Node with OpenCV.js from node_modules (tests only). */
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.resolve(__dirname, "..", "engine");
async function loadEngine(opencvPath) {
  globalThis.PV = globalThis.PV || {};
  let cv = require(opencvPath);
  if (cv instanceof Promise) cv = await cv; else if (!cv.Mat) await new Promise((r) => { cv.onRuntimeInitialized = r; });
  globalThis.PV.cv = cv;
  for (const f of ["data", "i18n", "geometry", "hatch", "contour", "segment", "export_svg", "export_pdf", "export_dxf", "export_table", "views", "project", "api"]) {
    const p = path.join(ROOT, f + ".js"); if (fs.existsSync(p)) vm.runInThisContext(fs.readFileSync(p, "utf8"), { filename: p });
  }
  return globalThis.PV;
}
module.exports = { loadEngine };
