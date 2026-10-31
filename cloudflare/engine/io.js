/* Image encode/decode in the worker (OffscreenCanvas). Replaced by a stub in the Node tests. */
(function (PV) {
  "use strict";
  async function bitmap(bytes) {
    const blob = new Blob([bytes]);
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch (e) { return await createImageBitmap(blob); }
  }
  PV.io = {
    /** -> {w, h, rgba (Uint8ClampedArray), origW, origH}; downscaled so the longer side <= maxSide */
    async decode(bytes, maxSide) {
      const bmp = await bitmap(bytes); const origW = bmp.width, origH = bmp.height;
      const s = maxSide && Math.max(origW, origH) > maxSide ? maxSide / Math.max(origW, origH) : 1;
      const w = Math.max(1, Math.round(origW * s)), h = Math.max(1, Math.round(origH * s));
      const c = new OffscreenCanvas(w, h), ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
      return { w, h, rgba: ctx.getImageData(0, 0, w, h).data, origW, origH };
    },
    async encode(rgba, w, h, mime, quality) {
      const c = new OffscreenCanvas(w, h), ctx = c.getContext("2d");
      ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer ? rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength) : rgba), w, h), 0, 0);
      const blob = await c.convertToBlob({ type: mime, quality }); return new Uint8Array(await blob.arrayBuffer());
    },
    async decodeGray(bytes) {
      const im = await PV.io.decode(bytes); const out = new Uint8Array(im.w * im.h);
      for (let i = 0; i < out.length; i++) out[i] = im.rgba[4 * i]; return { w: im.w, h: im.h, data: out };
    },
    async encodeGray(data, w, h) {
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) { const v = data[i]; rgba[4 * i] = v; rgba[4 * i + 1] = v; rgba[4 * i + 2] = v; rgba[4 * i + 3] = 255; }
      return PV.io.encode(rgba, w, h, "image/png");
    },
    createCanvas: (w, h) => new OffscreenCanvas(w, h),
    async bitmapFromBytes(bytes) { return bitmap(bytes); },
  };
})(globalThis.PV = globalThis.PV || {});
