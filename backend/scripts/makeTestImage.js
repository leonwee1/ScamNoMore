/**
 * Generates a PNG containing readable scam text, for exercising the
 * /analyze/image endpoint without needing a phone.
 *
 * Pure Node (zlib only) — draws a tiny 5x7 bitmap font onto an RGB raster, so
 * there is no image library to install.
 *
 *   node scripts/makeTestImage.js out.png
 */
const fs = require('fs');
const zlib = require('zlib');

// 5x7 glyphs for the characters used in the sample message.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  ':': ['00000', '00100', '00000', '00000', '00000', '00100', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

const LINES = [
  'DBS ALERT',
  'YOUR ACCOUNT IS',
  'LOCKED. PAYNOW',
  '$500 TO 91234567',
  'OR LOSE ACCESS!',
];

const SCALE = 6;
const PAD = 20;
const CHAR_W = 6; // 5 px glyph + 1 px gap
const cols = Math.max(...LINES.map((l) => l.length));
const W = PAD * 2 + cols * CHAR_W * SCALE;
const H = PAD * 2 + LINES.length * 9 * SCALE;

// White background, black text.
const raster = Buffer.alloc(W * H * 3, 0xff);

function setPixel(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  raster[i] = 0x11;
  raster[i + 1] = 0x11;
  raster[i + 2] = 0x11;
}

LINES.forEach((line, row) => {
  for (let c = 0; c < line.length; c++) {
    const glyph = FONT[line[c]];
    if (!glyph) continue;
    for (let gy = 0; gy < 7; gy++) {
      for (let gx = 0; gx < 5; gx++) {
        if (glyph[gy][gx] !== '1') continue;
        const px = PAD + (c * CHAR_W + gx) * SCALE;
        const py = PAD + (row * 9 + gy) * SCALE;
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) setPixel(px + dx, py + dy);
        }
      }
    }
  }
});

// Wrap the raster as a PNG: each scanline needs a filter byte (0 = none).
const rows = [];
for (let y = 0; y < H; y++) {
  rows.push(Buffer.from([0]), raster.subarray(y * W * 3, (y + 1) * W * 3));
}
const idat = zlib.deflateSync(Buffer.concat(rows));

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let TABLE;
function crc32(buf) {
  if (!TABLE) {
    TABLE = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: truecolour RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = process.argv[2] || 'test-scam.png';
fs.writeFileSync(out, png);
console.log(`wrote ${out} (${W}x${H}, ${png.length} bytes)`);
