/* Project storage in IndexedDB (stays on this device, in this browser profile). */
(function (PV) {
  "use strict";
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open("pvsketch", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("states", { keyPath: "id" }); r.result.createObjectStore("blobs"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (stores, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(stores, mode); let out;
      Promise.resolve(fn(t)).then((v) => { out = v; }).catch(rej);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  PV.store = {
    getState: (id) => tx(["states"], "readonly", (t) => req(t.objectStore("states").get(id))).then((v) => v || null),
    putState: (id, st) => tx(["states"], "readwrite", (t) => { t.objectStore("states").put(JSON.parse(JSON.stringify(st))); }),
    listStates: () => tx(["states"], "readonly", (t) => req(t.objectStore("states").getAll())),
    getBlob: (id, name) => tx(["blobs"], "readonly", (t) => req(t.objectStore("blobs").get(`${id}/${name}`))).then((v) => v || null),
    putBlob: (id, name, data, mime) => tx(["blobs"], "readwrite", (t) => { t.objectStore("blobs").put({ data, mime }, `${id}/${name}`); }),
    delProject: (id) => tx(["states", "blobs"], "readwrite", (t) => { t.objectStore("states").delete(id); for (const n of ["orig", "work", "mask", "mask_base"]) t.objectStore("blobs").delete(`${id}/${n}`); }),
  };
})(globalThis.PV = globalThis.PV || {});
