/* Main-thread glue for the static (Cloudflare Pages) build: answers /api/* from the in-browser engine. */
(function () {
  "use strict";
  document.documentElement.classList.add("static-app");
  document.addEventListener("DOMContentLoaded", () => document.body.classList.add("static-app"));
  const worker = new Worker("worker.js"); let seq = 0; const waiting = new Map(); let readyRes; const ready = new Promise((r) => { readyRes = r; });
  worker.onmessage = (e) => { if (e.data.ready) { readyRes(); return; } const w = waiting.get(e.data.id); if (w) { waiting.delete(e.data.id); w(e.data.res); } };
  worker.onerror = (e) => console.error("engine worker error", e.message);
  const call = (req) => new Promise((res) => { const id = ++seq; waiting.set(id, res); worker.postMessage({ id, req }); });
  window.pvsketchReady = ready;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url; const u = new URL(url, location.href);
    if (!u.pathname.startsWith("/api/")) return realFetch(input, init);
    let body;
    if (init.body instanceof FormData) { const f = init.body.get("photo"); if (f) body = { photo: { bytes: new Uint8Array(await f.arrayBuffer()), name: f.name, type: f.type } }; }
    else if (typeof init.body === "string") { try { body = JSON.parse(init.body); } catch (_) { body = {}; } }
    const res = await call({ method: init.method || "GET", path: u.pathname, query: Object.fromEntries(u.searchParams), body });
    const headers = { "Content-Type": res.type || "application/json" };
    if (res.filename) headers["Content-Disposition"] = `attachment; filename="${res.filename}"`;
    return new Response(res.json !== undefined ? JSON.stringify(res.json) : res.bytes, { status: res.status, headers });
  };

  // downloads: <a download href="/api/..."> -> fetch from the engine, save as file
  document.addEventListener("click", async (e) => {
    const a = e.target.closest && e.target.closest("a[download]"); if (!a) return;
    const href = a.getAttribute("href"); if (!href || !href.startsWith("/api/")) return;
    e.preventDefault();
    const r = await fetch(href); if (!r.ok) { alert("Export failed"); return; }
    const m = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || ""); const blob = await r.blob();
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = m ? m[1] : "pvsketch"; document.body.appendChild(link); link.click();
    setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 4000);
  });

  // keep projects: ask the browser not to evict storage; offline support
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
