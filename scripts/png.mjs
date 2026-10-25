//не удалять
// scripts/png.mjs — the few PNG operations the visual check needs, no dependencies.
// Decodes 8-bit RGB/RGBA, non-interlaced files (what screenshots and the reference are).

import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

export function decode(path) {
  const buf = readFileSync(path);
  let p = 8; let w = 0; let h = 0; let ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9];
      if (data[8] !== 8) throw new Error(`${path}: only 8-bit PNG is supported`);
      if (data[12] !== 0) throw new Error(`${path}: interlaced PNG is not supported`);
    }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : null;
  if (!ch) throw new Error(`${path}: only RGB and RGBA are supported`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a); const pb = Math.abs(pp - b); const pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
    cur.copy(px, y * stride);
    prev = cur;
  }
  return { w, h, ch, px };
}

const table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (buf) => {
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

export function encode(path, w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// Nearest-neighbour is enough for a scaled comparison strip.
export function scale(img, factor) {
  const w = Math.max(1, Math.round(img.w * factor));
  const h = Math.max(1, Math.round(img.h * factor));
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(img.h - 1, Math.floor(y / factor));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.w - 1, Math.floor(x / factor));
      const si = (sy * img.w + sx) * img.ch;
      const di = (y * w + x) * 4;
      out[di] = img.px[si]; out[di + 1] = img.px[si + 1]; out[di + 2] = img.px[si + 2]; out[di + 3] = 255;
    }
  }
  return { w, h, ch: 4, px: out };
}

export function to_rgba(img, width, height, fill = [10, 10, 10]) {
  const w = width ?? img.w; const h = height ?? img.h;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = fill[0]; out[i * 4 + 1] = fill[1]; out[i * 4 + 2] = fill[2]; out[i * 4 + 3] = 255;
  }
  for (let y = 0; y < Math.min(img.h, h); y++) {
    for (let x = 0; x < Math.min(img.w, w); x++) {
      const si = (y * img.w + x) * img.ch;
      const di = (y * w + x) * 4;
      out[di] = img.px[si]; out[di + 1] = img.px[si + 1]; out[di + 2] = img.px[si + 2]; out[di + 3] = 255;
    }
  }
  return { w, h, ch: 4, px: out };
}

export const at = (img, x, y) => {
  const i = (y * img.w + x) * img.ch;
  return [img.px[i], img.px[i + 1], img.px[i + 2]];
};
