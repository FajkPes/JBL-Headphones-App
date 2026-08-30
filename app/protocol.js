// ---------------------------------------------------------------------------
// JBL Protocol 4 - ramcovani a kodovani hodnot
// Zdroj: com.harman.protocol4.AssembleCmd4 / DeviceInfoList4Cmd / features/*
// ---------------------------------------------------------------------------

export const UUID_SERVICE = '65786365-6c70-6f69-6e74-2e636f6d0000';
export const UUID_CHAR_01 = '65786365-6c70-6f69-6e74-2e636f6d0001';
export const UUID_CHAR_02 = '65786365-6c70-6f69-6e74-2e636f6d0002';
export const UUID_CHAR_03 = '65786365-6c70-6f69-6e74-2e636f6d0003';

export const HDR = 0xDD00;
export const HDR_FORWARD = 0xDD01;

export const CMD = {
  GET_DEVICE_INFO:  0x0001,
  SET_DEVICE_INFO:  0x0002,
  NOTIFY_TO_APP:    0x0003,
  NOTIFY_TO_DEVICE: 0x0004,
  RESET_TO_FACTORY: 0x00FF,
  GET_ANALYTICS:    0x0201,
};

export const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join(' ');

// --- ramec -----------------------------------------------------------------

export function buildFrames(cmdId, payload, { mtu = 512, forward = false } = {}) {
  const id = forward ? HDR_FORWARD : HDR;
  const chunk = mtu - 15;
  const count = Math.max(1, Math.ceil(payload.length / chunk));
  const out = [];
  for (let i = 0; i < count; i++) {
    const part = payload.subarray(i * chunk, Math.min((i + 1) * chunk, payload.length));
    const f = new Uint8Array(8 + part.length);
    f[0] = id & 0xff;          f[1] = (id >> 8) & 0xff;
    f[2] = cmdId & 0xff;       f[3] = (cmdId >> 8) & 0xff;
    f[4] = count;              f[5] = i;
    f[6] = part.length & 0xff; f[7] = (part.length >> 8) & 0xff;
    f.set(part, 8);
    out.push(f);
  }
  return out;
}

export function parseFrame(buf) {
  if (buf.length < 8) return null;
  return {
    identifier:  buf[0] | (buf[1] << 8),
    commandId:   buf[2] | (buf[3] << 8),
    packetCount: buf[4],
    packetIndex: buf[5],
    payloadSize: buf[6] | (buf[7] << 8),
    payload:     buf.subarray(8),
  };
}

// payload -> [{id, value:Uint8Array}]   TLV: id(2 LE) + len(2 LE) + value
export function parseTLV(payload) {
  const out = [];
  let i = 0;
  while (i + 4 <= payload.length) {
    const id  = payload[i] | (payload[i + 1] << 8);
    const len = payload[i + 2] | (payload[i + 3] << 8);
    if (i + 4 + len > payload.length) break;
    out.push({ id, value: payload.subarray(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

export function encodeGet(featureIds) {
  for (const id of featureIds)
    if (!Number.isInteger(id) || id < 0 || id > 0xFFFF)
      throw new RangeError(`feature ID ${id} je mimo rozsah 0-65535`);
  const p = new Uint8Array(featureIds.length * 2);
  featureIds.forEach((id, n) => { p[n * 2] = id & 0xff; p[n * 2 + 1] = (id >> 8) & 0xff; });
  return p;
}

export function encodeSet(featureId, value) {
  // Delkove pole je 16bitove. Delsi hodnota by se orezala a zarizeni by
  // dostalo nesmysl — radeji tvrde spadnout nez tise poslat spatny paket.
  if (!Number.isInteger(featureId) || featureId < 0 || featureId > 0xFFFF)
    throw new RangeError(`feature ID ${featureId} je mimo rozsah 0–65535`);
  if (value.length > 0xFFFF)
    throw new RangeError(`hodnota má ${value.length} B, maximum je 65535`);
  const p = new Uint8Array(4 + value.length);
  p[0] = featureId & 0xff;  p[1] = (featureId >> 8) & 0xff;
  p[2] = value.length & 0xff; p[3] = (value.length >> 8) & 0xff;
  p.set(value, 4);
  return p;
}

// --- kodovani hodnot -------------------------------------------------------

const onOff = b => b ? 'zapnuto' : 'vypnuto';

/** Odmitne cisla mimo rozsah misto tiheho oriznuti pri zapisu do Uint8Array. */
function checkInts(list, max, bytes) {
  for (const x of list)
    if (!Number.isInteger(x) || x < 0 || x > max)
      throw new RangeError(
        `hodnota ${x} je mimo rozsah 0-${max} pro ${bytes}bajtove cislo`);
}

export const codec = {
  // 1 bajt: bit7 = status, bity0-6 = level
  StatusLevelSize1Feature: {
    decode: v => v.length ? { status: (v[0] >> 7) & 1, level: v[0] & 0x7f } : null,
    encode: ({ status = 0, level = 0 }) => {
      if (!Number.isInteger(level) || level < 0 || level > 127)
        throw new RangeError(`úroveň ${level} je mimo rozsah 0-127`);
      return new Uint8Array([((status ? 1 : 0) << 7) | level]);
    },
    render: d => d ? `${onOff(d.status)} · úroveň ${d.level}` : '—',
  },
  Occupy1ByteEachIntFeature: {
    decode: v => [...v],
    encode: list => { checkInts(list, 0xFF, 1); return new Uint8Array(list); },
    render: d => d.length === 1 ? String(d[0]) : d.join(' · '),
  },
  Occupy2BytesEachIntFeature: {
    decode: v => { const r = []; for (let i = 0; i + 1 < v.length; i += 2) r.push(v[i] | (v[i+1] << 8)); return r; },
    encode: list => { checkInts(list, 0xFFFF, 2);
      const b = new Uint8Array(list.length * 2);
      list.forEach((x, i) => { b[i*2] = x & 0xff; b[i*2+1] = (x >> 8) & 0xff; }); return b; },
    render: d => d.length === 1 ? String(d[0]) : d.join(' · '),
  },
  Occupy4BytesEachIntFeature: {
    decode: v => { const r = []; for (let i = 0; i + 3 < v.length; i += 4) r.push(v[i] | (v[i+1]<<8) | (v[i+2]<<16) | (v[i+3]<<24)); return r; },
    encode: list => { checkInts(list, 0xFFFFFFFF, 4);
      const b = new Uint8Array(list.length * 4);
      list.forEach((x, i) => { for (let k = 0; k < 4; k++) b[i*4+k] = (x >>> (k*8)) & 0xff; }); return b; },
    render: d => d.length === 1 ? String(d[0]) : d.join(' · '),
  },
  AsciiStringFeature: {
    decode: v => new TextDecoder().decode(v).replace(/\0+$/, ''),
    encode: s => new TextEncoder().encode(s),
    render: d => JSON.stringify(d),
  },
  UTF8Feature: {
    decode: v => new TextDecoder('utf-8').decode(v).replace(/\0+$/, ''),
    encode: s => new TextEncoder().encode(s),
    render: d => JSON.stringify(d),
  },
  VersionStringFeature: {
    decode: v => new TextDecoder().decode(v).replace(/\0+$/, ''),
    encode: s => new TextEncoder().encode(s),
    render: d => JSON.stringify(d),
  },
  MacAddressFeature: {
    decode: v => [...v].map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(':'),
    encode: () => new Uint8Array(0),
    render: d => d,
  },
  NoPayloadFeature: {
    decode: () => true,
    encode: () => new Uint8Array(0),
    render: () => 'potvrzeno (příkaz bez hodnoty)',
  },
  BitListFeature: {
    decode: v => [...v],
    encode: list => new Uint8Array(list),
    render: d => d.map(x => x.toString(2).padStart(8, '0')).join(' ') +
                 `  (${d.join(' · ')})`,
  },
};

/**
 * Bezpecny prevod hex textu na bajty. Nikdy nevrati "skoro spravnou"
 * hodnotu — bud je vstup v poradku, nebo vrati chybu k zobrazeni.
 */
export function parseHex(text) {
  // tolerujeme zapis 0x80 i 80, oddelovace mezera nebo carka
  const t = (text || '').replace(/0x/gi, '').replace(/[,;]/g, ' ').trim();
  if (t === '') return { bytes: new Uint8Array(0), error: null };
  if (!/^[0-9a-fA-F\s]+$/.test(t))
    return { error: 'Povolené jsou jen hex číslice 0–9, a–f a mezery.' };
  const clean = t.replace(/\s+/g, '');
  if (clean.length % 2)
    return { error: `Lichý počet číslic (${clean.length}) — každý bajt musí mít dvě.` };
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++)
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  return { bytes, error: null };
}

/**
 * Zkontroluje, ze delka hodnoty odpovida typu featury.
 * Vraci null kdyz je vse v poradku, jinak text chyby.
 */
export function validateValue(cls, bytes) {
  const n = bytes.length;
  const multiple = (k, what) =>
    n === 0 ? `Zadej hodnotu (${what}).`
    : n % k ? `Délka musí být násobek ${k} bajtů, zadáno ${n}.`
    : null;
  switch (cls) {
    case 'NoPayloadFeature':
      return n === 0 ? null : 'Tahle funkce se posílá bez hodnoty.';
    case 'StatusLevelSize1Feature':
      return n === 1 ? null : `Očekává se přesně 1 bajt, zadáno ${n}.`;
    case 'MacAddressFeature':
      return n === 6 ? null : `MAC adresa má 6 bajtů, zadáno ${n}.`;
    case 'Occupy2BytesEachIntFeature':
    case 'StatusLevelSize2Feature':
      return multiple(2, '2 bajty na číslo');
    case 'Occupy4BytesEachIntFeature':
    case 'StatusLevelSize4Feature':
      return multiple(4, '4 bajty na číslo');
    case 'Occupy1ByteEachIntFeature':
      return n >= 1 ? null : 'Zadej aspoň jeden bajt.';
    default:
      return n >= 1 ? null : 'Zadej hodnotu v hex.';
  }
}

/**
 * Vytahne z dekodovane hodnoty cislo/prepinac pro predvyplneni ovladacu.
 * Vraci { on?, level?, num? } nebo null.
 */
export function controlValue(cls, dec) {
  if (dec == null) return null;
  if (cls === 'StatusLevelSize1Feature' && typeof dec === 'object')
    return { on: !!dec.status, level: dec.level };
  if (Array.isArray(dec) && dec.length === 1 && Number.isFinite(dec[0]))
    return { num: dec[0] };
  if (typeof dec === 'number') return { num: dec };
  return null;
}

// fallback pro typy, ktere jeste nemame rozebrane
export const rawCodec = {
  decode: v => v,
  encode: v => v,
  render: d => hex(d) || '(prazdne)',
};

export function codecFor(className) {
  if (codec[className]) return codec[className];
  if (className === 'StatusLevelSize2Feature') return codec.Occupy2BytesEachIntFeature;
  if (className === 'StatusLevelSize4Feature') return codec.Occupy4BytesEachIntFeature;
  return rawCodec;
}
