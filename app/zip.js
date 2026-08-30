// ---------------------------------------------------------------------------
// Minimalni ZIP - zapis i cteni, bez externich knihoven.
// Pouziva metodu STORE (bez komprese), coz je pro par KB JSONu uplne v poradku
// a vysledek otevre kazdy bezny archivator i Pruzkumnik Windows.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** DOS cas a datum z Date */
function dosTime(d) {
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) |
          ((d.getSeconds() / 2) & 31),
    date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) |
          (d.getDate() & 31),
  };
}

/**
 * Vytvori ZIP.
 * @param {{name:string, content:string|Uint8Array}[]} files
 * @returns {Blob}
 */
export function create(files) {
  const now = dosTime(new Date());
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const f of files) {
    const nameB = enc.encode(f.name);
    const data = typeof f.content === 'string' ? enc.encode(f.content) : f.content;
    const crc = crc32(data);

    const lh = new Uint8Array(30 + nameB.length);
    const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);        // verze
    lv.setUint16(6, 0, true);         // priznaky
    lv.setUint16(8, 0, true);         // metoda STORE
    lv.setUint16(10, now.time, true);
    lv.setUint16(12, now.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameB.length, true);
    lv.setUint16(28, 0, true);
    lh.set(nameB, 30);
    locals.push(lh, data);

    const ch = new Uint8Array(46 + nameB.length);
    const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, now.time, true);
    cv.setUint16(14, now.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameB.length, true);
    cv.setUint32(42, offset, true);
    ch.set(nameB, 46);
    centrals.push(ch);

    offset += lh.length + data.length;
  }

  const cdSize = centrals.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...locals, ...centrals, eocd], { type: 'application/zip' });
}

/**
 * Precte ZIP a vrati Map<jmeno, Uint8Array>.
 * Zvlada jen metodu STORE — to nam staci, protoze zalohy si delame sami.
 */
export function read(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const dv = new DataView(arrayBuffer);

  // najdi EOCD od konce
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('není to platný ZIP (chybí koncový záznam)');

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map();

  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50)
      throw new Error('poškozený ZIP (chybný záznam v adresáři)');
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));

    if (method !== 0)
      throw new Error(`soubor "${name}" je komprimovaný, což tahle appka neumí`);

    const lNameLen = dv.getUint16(local + 26, true);
    const lExtraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + size);

    const want = dv.getUint32(p + 16, true);
    if (crc32(data) !== want)
      throw new Error(`soubor "${name}" je poškozený (nesedí kontrolní součet)`);

    out.set(name, data);
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

export const text = bytes => dec.decode(bytes);
