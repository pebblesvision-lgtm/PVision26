// End-to-end test of the static build: serve ./cloudflare (python3 -m http.server 5077) then: OUT_DIR=/tmp/out node web/tests/drive_static.js
// Needs the 'playwright' npm package.
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
  page.on('dialog', d => d.accept('scheur'));
  const api = (path, opts) => page.evaluate(async ([p, o]) => { const r = await fetch(p, o); const ct = r.headers.get('Content-Type') || ''; if (ct.includes('json')) return { status: r.status, json: await r.json() }; const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, type: ct, len: b.length, head: Array.from(b.slice(0, 8)), cd: r.headers.get('Content-Disposition'), text: ct.startsWith('text') || ct.includes('svg') || ct.includes('dxf') ? new TextDecoder().decode(b.slice(0, 600000)) : null }; }, [path, opts || {}]);
  const t0 = Date.now();
  await page.goto(BASE); await page.evaluate(() => window.pvsketchReady); const readyMs = Date.now() - t0;
  const nav = (await page.textContent('#steps')).replace(/\s+/g, ' ').trim();
  const staticOnlyVisible = await page.$eval('#btn-import', el => el.offsetParent !== null);
  await page.click('#btn-sample'); await page.waitForSelector('[data-pane="isolate"]:not([hidden])', { timeout: 60000 }); await page.waitForTimeout(800);
  const list0 = (await api('/api/projects')).json; const pid = list0[0].id;
  const st = (await api('/api/projects/' + pid)).json; const [W, Hh] = st.calibration.out_size;
  await page.screenshot({ path: S + '/shots7/1-isolate.png' });
  const box = await page.locator('#canvas').boundingBox();
  const view = (w, h) => { const s = Math.min(box.width / w, box.height / h) * 0.96; return { s, tx: (box.width - w * s) / 2, ty: (box.height - h * s) / 2 }; };
  // the sample photo is 2100x1260 and working image is the same (<= 2400)
  const v = view(W, Hh); const scr = (p) => [box.x + p[0] * v.s * (W / 2100) + v.tx, box.y + p[1] * v.s * (Hh / 1260) + v.ty];
  for (const p of truth.stone_polygon_px.filter((_, i) => i % 6 === 0)) { const s = scr(p); await page.touchscreen.tap(s[0], s[1]); }
  const tSeg = Date.now(); await page.click('#btn-segment');
  await page.waitForFunction(() => document.querySelector('#seg-result').textContent.includes('rode rand'), null, { timeout: 120000 }); const segMs = Date.now() - tSeg;
  await page.waitForTimeout(500); await page.screenshot({ path: S + '/shots7/2-segmented.png' });
  await page.click('[data-step="outline"]'); await page.waitForFunction(() => document.querySelector('#ol-result').textContent.includes('rechte'), null, { timeout: 60000 });
  const olText = await page.textContent('#ol-result');
  await page.click('[data-step="measure"]'); await page.waitForTimeout(700);
  const dr0 = (await api('/api/projects/' + pid + '/drawing')).json; const bb = dr0.bbox; let ppm = st.calibration.ppm; const m2s = (p) => scr([p[0] * ppm, p[1] * ppm]);
  await page.click('.tool[data-tool="horizontal"]');
  let p1 = m2s([bb[0] + 40 * (bb[2] - bb[0]) / 300, bb[3]]), p2 = m2s([bb[2], bb[3]]);
  await page.touchscreen.tap(p1[0], p1[1]); await page.touchscreen.tap(p2[0], p2[1]);
  await page.waitForSelector('#value-entry:not([hidden])', { timeout: 8000 });
  await page.fill('#value-input', '1240'); await page.click('#btn-value-ok');
  await page.waitForFunction(() => document.querySelector('#scale-line').classList.contains('ok'), null, { timeout: 15000 }); await page.waitForTimeout(500);
  const scaleLine = await page.textContent('#scale-line');
  const st2 = (await api('/api/projects/' + pid)).json; ppm = st2.calibration.ppm;
  const dr1 = (await api('/api/projects/' + pid + '/drawing')).json; const b1 = dr1.bbox;
  await page.click('.tool[data-tool="vertical"]'); p1 = m2s([b1[2], b1[1] + 90]); p2 = m2s([b1[2], b1[3]]);
  await page.touchscreen.tap(p1[0], p1[1]); await page.touchscreen.tap(p2[0], p2[1]); await page.waitForSelector('#value-entry:not([hidden])'); await page.fill('#value-input', '700'); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  await page.selectOption('#tpl-select', 'raamdorpel'); await page.waitForTimeout(500);
  await page.screenshot({ path: S + '/shots7/3-measure.png' });
  const dr2 = (await api('/api/projects/' + pid + '/drawing')).json; const b2 = dr2.bbox;
  await page.click('[data-step="draw"]'); await page.waitForTimeout(800);
  await page.selectOption('#fin-kind', 'kathedraal'); await page.fill('#fin-strokes', '8'); await page.fill('#fin-comment', 'zoals bestaand');
  for (const p of [[b2[0] + 30, b2[1] + 150], [b2[2] - 30, b2[1] + 150], [b2[2] - 30, b2[3] - 30], [b2[0] + 30, b2[3] - 30]]) { const s = m2s(p); await page.touchscreen.tap(s[0], s[1]); }
  await page.click('#btn-dr-close'); await page.waitForTimeout(900);
  await page.screenshot({ path: S + '/shots7/4-draw.png' });
  await page.click('[data-step="export"]'); await page.waitForTimeout(1500);
  await page.fill('input.tb[data-tb="project"]', 'Westgevel 12'); await page.fill('input.tb[data-tb="material"]', 'Bentheimer'); await page.keyboard.press('Tab'); await page.waitForTimeout(500);
  await page.screenshot({ path: S + '/shots7/5-export.png' });
  const out = {};
  for (const [k, u] of Object.entries({ pdf: 'export.pdf?lang=nl', svg: 'export.svg?lang=nl', dxf: 'export.dxf', csv: 'export.csv', png: 'export.png?photo=1', jpg: 'export.jpg', json: 'export.json' })) {
    const r = await api(`/api/projects/${pid}/${u}`); out[k] = { status: r.status, type: r.type, len: r.len, head: r.head, cd: r.cd };
  }
  // actually download through the UI link (shim click handler) and save files for inspection
  for (const [id, name] of [['exp-pdf', 'out.pdf'], ['exp-dxf', 'out.dxf'], ['exp-png', 'out.png'], ['exp-jpg', 'out.jpg'], ['exp-svg', 'out.svg'], ['exp-csv', 'out.csv'], ['exp-json', 'out.json']]) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('#' + id)]); await dl.saveAs(S + '/shots7/' + name); out['dl_' + id] = dl.suggestedFilename();
  }
  // persistence: reload, project must still be listed with its data
  await page.reload(); await page.evaluate(() => window.pvsketchReady); await page.waitForTimeout(800);
  const list1 = (await api('/api/projects')).json; const keep = (await api('/api/projects/' + pid)).json;
  // import roundtrip
  const jtext = fs.readFileSync(S + '/shots7/out.json', 'utf8');
  const imp = await api('/api/projects/import', { method: 'POST', body: JSON.stringify({ text: jtext }) });
  const impDraw = (await api('/api/projects/' + imp.json.id + '/drawing')).json;
  // offline: service worker installed?
  const swOk = await page.evaluate(async () => { const regs = await navigator.serviceWorker.getRegistrations(); return regs.length; });
  console.log(JSON.stringify({ readyMs, segMs, nav, staticOnlyVisible, olText, scaleLine, bbox: [b1[2] - b1[0], b1[3] - b1[1]].map(x => +x.toFixed(1)), dims: dr2.dimensions.map(d => [d.kind, d.manual_mm]), checklist: dr2.checklist.length, finish: (await api('/api/projects/' + pid + '/drawing')).json.finishes.map(f => [f.kind, f.strokes_per_10cm, f.hatch.lines.length]), out, persisted: list1.length, keptDims: keep.dimensions.length, keptScaled: keep.calibration.scaled, imported: [imp.status, impDraw.dimensions.length, impDraw.finishes.length, impDraw.bbox && +(impDraw.bbox[2] - impDraw.bbox[0]).toFixed(1)], swRegistrations: swOk, errors }, null, 1));
  await browser.close();
})().catch(e => { console.error('DRIVE FAILED', e); process.exit(1); });
