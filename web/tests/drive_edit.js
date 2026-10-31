// End-to-end test of the editing features (static build): serve ./cloudflare on 5077, then OUT_DIR=/tmp/out node web/tests/drive_edit.js
// Covers: straight to Measure, measuring on the photo without an outline, Vrij/Standaard lists, + Maat / remove,
// select + restyle + delete a dimension, paint-only run, eraser after a run (+ undo), outline add/delete on arcs,
// select a finish region and change it afterwards.
const { chromium, devices } = require('playwright');
const fs = require('fs');
const S = process.env.OUT_DIR || '/tmp';
const BASE = 'http://127.0.0.1:5077';
const truth = JSON.parse(fs.readFileSync(require('path').join(__dirname, '..', '..', 'samples', 'sample.truth.json')));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPad Pro 11 landscape'], acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept('Dikte neus'));
  const api = (path, opts) => page.evaluate(async ([p, o]) => { const r = await fetch(p, o); return { status: r.status, json: await r.json() }; }, [path, opts || {}]);
  const R = {}; fs.mkdirSync(S + '/shots8', { recursive: true });
  await page.goto(BASE); await page.evaluate(() => window.pvsketchReady);
  await page.evaluate(() => indexedDB.databases ? null : null);
  // 1) straight to Measure
  await page.click('#btn-settings'); await page.check('#set-direct'); await page.click('#btn-settings');
  await page.click('#btn-sample'); await page.waitForSelector('[data-pane="measure"]:not([hidden])', { timeout: 60000 }); await page.waitForTimeout(800);
  R.directToMeasure = true;
  const pid = (await api('/api/projects')).json[0].id;
  let st = (await api('/api/projects/' + pid)).json; const [W, H] = st.calibration.out_size;
  const box = await page.locator('#canvas').boundingBox();
  const s0 = Math.min(box.width / W, box.height / H) * 0.96, tx = (box.width - W * s0) / 2, ty = (box.height - H * s0) / 2;
  const scr = (p) => [box.x + p[0] * s0 * (W / 2100) + tx, box.y + p[1] * s0 * (H / 1260) + ty];
  const tap = async (p) => { const q = scr(p); await page.touchscreen.tap(q[0], q[1]); };
  const poly = truth.stone_polygon_px; const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  R.templateDefault = await page.$eval('#tpl-select', el => el.value);
  // 2) measure on the photo (no outline), type the value in the table instead of the entry box
  await page.click('.tool[data-tool="horizontal"]'); await tap([x0, y1]); await tap([x1, y1]);
  await page.waitForSelector('#value-entry:not([hidden])');
  await page.fill('#dim-table tbody tr:first-child input.manual', '454'); await page.press('#dim-table tbody tr:first-child input.manual', 'Tab'); await page.waitForTimeout(900);
  R.entryHiddenAfterTable = await page.$eval('#value-entry', el => el.hidden);
  st = (await api('/api/projects/' + pid)).json; R.scaledWithoutOutline = st.calibration.scaled;
  // 3) Standaard list, + Maat, remove
  await page.selectOption('#tpl-select', 'standaard'); await page.waitForTimeout(500);
  R.standaardRows = await page.$$eval('#checklist tbody tr', rs => rs.map(r => r.cells[0].textContent.trim().split('\n')[0]));
  await page.click('#btn-cl-add'); await page.waitForTimeout(500);
  R.rowsAfterAdd = await page.$$eval('#checklist tbody tr', rs => rs.length);
  await page.click('#checklist tbody tr:nth-child(2) .x'); await page.waitForTimeout(500);
  st = (await api('/api/projects/' + pid)).json; R.checklistKeys = st.checklist.map(c => c.key + ':' + c.kind);
  // 4) second dim, then select the first one, make it dotted, delete the second
  const ppm = st.calibration.ppm; const dims0 = st.dimensions;
  await page.click('.tool[data-tool="vertical"]'); await tap([x1, y0]); await tap([x1, y1]); await page.waitForSelector('#value-entry:not([hidden])'); await page.fill('#value-input', '300'); await page.keyboard.press('Enter'); await page.waitForTimeout(800);
  await page.click('.tool[data-tool="select"]');
  const d0 = dims0[0]; const ly = Math.max(d0.p1[1], d0.p2[1]) + (d0.offset_mm || 0);
  await tap([((d0.p1[0] + d0.p2[0]) / 2) * ppm, ly * ppm]); await page.waitForTimeout(200);
  R.delEnabled = await page.$eval('#btn-dim-del', b => !b.disabled);
  await page.selectOption('#dim-style', 'dotted'); await page.waitForTimeout(700);
  st = (await api('/api/projects/' + pid)).json; R.stylesAfter = st.dimensions.map(d => d.style);
  await page.click('#dim-table tbody tr:nth-child(2) td:first-child'); await page.click('#btn-dim-del'); await page.waitForTimeout(700);
  st = (await api('/api/projects/' + pid)).json; R.dimsAfterDelete = st.dimensions.length;
  await page.screenshot({ path: S + '/shots8/1-measure.png' });
  // 5) isolate: paint only, Run
  await page.click('[data-step="isolate"]'); await page.waitForTimeout(800);
  await page.click('.tool[data-tool="fg"]');
  const drag = async (pts) => { let q = scr(pts[0]); await page.mouse.move(q[0], q[1]); await page.mouse.down(); for (const p of pts.slice(1)) { q = scr(p); await page.mouse.move(q[0], q[1], { steps: 8 }); } await page.mouse.up(); };
  await drag([[x0 + 0.15 * (x1 - x0), cy], [x1 - 0.15 * (x1 - x0), cy], [x1 - 0.15 * (x1 - x0), cy - 0.25 * (y1 - y0)], [x0 + 0.15 * (x1 - x0), cy + 0.25 * (y1 - y0)]]);
  await page.click('#btn-segment');
  await page.waitForFunction(() => /rode rand|fout|failed|Tik eerst/.test(document.querySelector('#seg-result').textContent) || !document.querySelector('#toast').hidden, null, { timeout: 120000 });
  await page.waitForTimeout(500);
  R.paintOnlyResult = await page.textContent('#seg-result');
  const maskCount = async () => page.evaluate(async (id) => { const b = await (await fetch(`/api/projects/${id}/image/mask?t=${Date.now()}`)).blob(); const bm = await createImageBitmap(b); const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext('2d'); g.drawImage(bm, 0, 0); const d = g.getImageData(0, 0, bm.width, bm.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 127) n++; return n; }, pid);
  const m1 = await maskCount();
  // 6) eraser after the run removes area directly; undo restores it
  await page.click('.tool[data-tool="bg"]'); await page.fill('#brush-size', '60'); await page.dispatchEvent('#brush-size', 'input');
  await drag([[cx - 0.2 * (x1 - x0), cy], [cx + 0.2 * (x1 - x0), cy]]); await page.waitForTimeout(2500);
  st = (await api('/api/projects/' + pid)).json; R.editsAfterErase = (st.segmentation.edits || []).length;
  const m2 = await maskCount();
  await page.screenshot({ path: S + '/shots8/2-erased.png' });
  await page.click('#btn-undo'); await page.waitForTimeout(2500);
  const m3 = await maskCount(); st = (await api('/api/projects/' + pid)).json;
  R.mask = { afterRun: m1, afterErase: m2, afterUndo: m3, editsAfterUndo: (st.segmentation.edits || []).length };
  // 7) outline: add a point on an arc, delete it again, delete an arc end point
  await page.click('[data-step="outline"]'); await page.waitForFunction(() => /rechte|segments/.test(document.querySelector('#ol-result').textContent), null, { timeout: 60000 }); await page.waitForTimeout(500);
  let dr = (await api('/api/projects/' + pid + '/drawing')).json; const ppm2 = (await api('/api/projects/' + pid)).json.calibration.ppm;
  const nodeCount = (o) => o.reduce((n, p) => n + (p.type === 'arc' ? 1 : p.points.length - (p.closed ? 0 : 1)), 0);
  R.outline0 = { prims: dr.outline.length, arcs: dr.outline.filter(p => p.type === 'arc').length, nodes: nodeCount(dr.outline) };
  const arc = dr.outline.find(p => p.type === 'arc');
  if (arc) {
    const a0 = Math.atan2(arc.start[1] - arc.center[1], arc.start[0] - arc.center[0]), a1 = Math.atan2(arc.end[1] - arc.center[1], arc.end[0] - arc.center[0]);
    let sw = ((arc.ccw ? a1 - a0 : a0 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); const am = a0 + (arc.ccw ? sw : -sw) / 2;
    const mid = [arc.center[0] + arc.radius * Math.cos(am), arc.center[1] + arc.radius * Math.sin(am)];
    await page.click('.tool[data-tool="add"]'); await tap([mid[0] * ppm2, mid[1] * ppm2]); await page.waitForTimeout(1200);
    dr = (await api('/api/projects/' + pid + '/drawing')).json;
    R.outlineAfterAdd = { prims: dr.outline.length, arcs: dr.outline.filter(p => p.type === 'arc').length, nodes: nodeCount(dr.outline) };
    await page.screenshot({ path: S + '/shots8/3-outline-add.png' });
    await page.click('.tool[data-tool="del"]'); await tap([arc.start[0] * ppm2, arc.start[1] * ppm2]); await page.waitForTimeout(1200);
    dr = (await api('/api/projects/' + pid + '/drawing')).json;
    R.outlineAfterDel = { prims: dr.outline.length, arcs: dr.outline.filter(p => p.type === 'arc').length, nodes: nodeCount(dr.outline), edited: (await api('/api/projects/' + pid)).json.outline_edited };
  }
  // 8) draw a region, select it afterwards and change the finish
  await page.click('[data-step="draw"]'); await page.waitForTimeout(800);
  const bb = dr.bbox; const m = (p) => [p[0] * ppm2, p[1] * ppm2];
  for (const p of [[bb[0] + 0.2 * (bb[2] - bb[0]), bb[1] + 0.3 * (bb[3] - bb[1])], [bb[2] - 0.2 * (bb[2] - bb[0]), bb[1] + 0.3 * (bb[3] - bb[1])], [bb[2] - 0.2 * (bb[2] - bb[0]), bb[3] - 0.2 * (bb[3] - bb[1])]]) await tap(m(p));
  await page.click('#btn-dr-close'); await page.waitForTimeout(800);
  await page.click('[data-pane="draw"] .tool[data-tool="select"]');
  await tap(m([bb[2] - 0.3 * (bb[2] - bb[0]), bb[1] + 0.45 * (bb[3] - bb[1])])); await page.waitForTimeout(300);
  R.drDelVisible = await page.$eval('#btn-dr-del', b => !b.hidden);
  await page.selectOption('#fin-kind', 'randslag'); await page.fill('#fin-strokes', '12'); await page.press('#fin-strokes', 'Tab'); await page.waitForTimeout(900);
  dr = (await api('/api/projects/' + pid + '/drawing')).json; R.finishAfter = dr.finishes.map(f => [f.kind, f.strokes_per_10cm]);
  await page.screenshot({ path: S + '/shots8/4-draw-select.png' });
  await page.click('#btn-dr-del'); await page.waitForTimeout(800);
  R.finishesAfterDelete = (await api('/api/projects/' + pid + '/drawing')).json.finishes.length;
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch(e => { console.error('DRIVE FAILED', e); process.exit(1); });
