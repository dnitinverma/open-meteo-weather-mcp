// Generates the placeholder app icon (512x512 PNG, no dependencies): a sun behind a cloud.
// Run: npm run make:icon   (replace the output with your own artwork before publishing)
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SIZE = 512;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

type RGBA = [number, number, number, number];
const circle = (x: number, y: number, cx: number, cy: number, r: number) =>
  (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
function roundedRect(
  x: number,
  y: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1 && circle(x, y, cx, cy, r);
}

function sample(x: number, y: number): RGBA {
  if (!roundedRect(x, y, 0, 0, SIZE, SIZE, 112)) return [0, 0, 0, 0];
  // Sky gradient, #1d4ed8 (top) to #60a5fa (bottom).
  const t = y / SIZE;
  let px: [number, number, number] = [
    Math.round(29 + (96 - 29) * t),
    Math.round(78 + (165 - 78) * t),
    Math.round(216 + (250 - 216) * t),
  ];
  if (circle(x, y, 340, 168, 74)) px = [251, 191, 36]; // sun
  const cloud =
    circle(x, y, 190, 330, 68) ||
    circle(x, y, 272, 296, 88) ||
    circle(x, y, 360, 336, 62) ||
    roundedRect(x, y, 150, 330, 410, 400, 35);
  if (cloud) px = [255, 255, 255];
  return [px[0], px[1], px[2], 255];
}

// 3x3 supersampling for smooth edges.
const SS = 3;
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1);
  raw[row] = 0; // filter: none
  for (let x = 0; x < SIZE; x++) {
    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const [pr, pg, pb, pa] = sample(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
        r += pr * pa;
        g += pg * pa;
        b += pb * pa;
        a += pa;
      }
    }
    const o = row + 1 + x * 4;
    if (a > 0) {
      raw[o] = Math.round(r / a);
      raw[o + 1] = Math.round(g / a);
      raw[o + 2] = Math.round(b / a);
    }
    raw[o + 3] = Math.round(a / (SS * SS));
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const dir = new URL("../../submission/chatgpt-plugin/assets/", import.meta.url);
mkdirSync(dir, { recursive: true });
for (const name of ["logo.png", "icon.png"]) writeFileSync(new URL(name, dir), png);
console.log(
  `wrote ${SIZE}x${SIZE} placeholder icon (${png.length} bytes) to submission/chatgpt-plugin/assets/{logo,icon}.png`,
);
