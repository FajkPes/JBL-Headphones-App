// ---------------------------------------------------------------------------
// Adapter pro Protocol 4 (feature ID + TLV).
//
// Prekrucuje nizkourovnovy protocol.js do rozhrani, ktere pouziva UI:
//   info / canRead / canWrite / getFrames / setFrames / ingest
//
// Mapovani v devices/*.js pro P4 vypada takhle:
//   anc: { feat: 'ANC' }                     // typ se vezme z features.js
//   autoPowerOff: { feat:'AutoPowerOff', scale: 1 }
// ---------------------------------------------------------------------------

import * as P from '../protocol.js';
import { FEATURES, BY_NAME, BY_ID } from '../features.js';
import { levelOf, reasonOf, NEVER_TOUCH } from '../risk.js';
import { BY_KEY as CAT, worstRisk } from '../catalog.js';

const hex = P.hex;

/** Jak velky rozsah dovoli dany typ featury. Pouziva se pri validaci. */
function limitsFor(cls) {
  switch (cls) {
    case 'StatusLevelSize1Feature': return { max: 127, bytes: 1 };
    case 'Occupy1ByteEachIntFeature': return { max: 255, bytes: 1 };
    case 'Occupy2BytesEachIntFeature':
    case 'StatusLevelSize2Feature': return { max: 65535, bytes: 2 };
    case 'Occupy4BytesEachIntFeature':
    case 'StatusLevelSize4Feature': return { max: 0xFFFFFFFF, bytes: 4 };
    default: return { max: 255, bytes: 1 };
  }
}

function u16le(n) { return [n & 0xff, (n >> 8) & 0xff]; }
function i32le(n) {
  return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
}
function f32le(v) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  return [...b];
}
const readF32 = (p, i) =>
  new DataView(p.buffer, p.byteOffset + i, 4).getFloat32(0, true);
const readI32 = (p, i) =>
  new DataView(p.buffer, p.byteOffset + i, 4).getInt32(0, true);

// --- ekvalizer (feature EQInfo) --------------------------------------------
// Zdroj: com.harman.protocol4.features.EQInfoFeature
//
//   [0]      kategorie (firmware pouziva 0xC1 tam, kde appka rika 230)
//   [1]      stav kategorie
//   [2]      pocet pasem
//   [3..6]   kalibrace          float LE
//   [7..10]  vzorkovaci frekv.  int32 LE
//   [11..14] levy zisk          float LE
//   [15..18] pravy zisk         float LE
//   pak za kazde pasmo 13 bajtu:
//     <typ:1> <frekvence:f32> <zisk:f32> <Q:f32>
//   a nakonec NAZEV profilu jako UTF-8 (to je ten "EQ 62" z appky)
//
// Pozor: Protocol 3 ma pasma jinak — 10 bajtu a Q jen v jednom bajtu.
// Proto jsou to dva ruzne kodery a nesmi se plest.

const EQ_CATEGORY_ON_WIRE = 0xC1, EQ_CATEGORY_LOGICAL = 230;

function decodeEqP4(v) {
  if (v.length < 19) return null;
  const bandCount = v[2];
  const end = 19 + bandCount * 13;
  if (v.length < end) return null;
  const bands = [];
  for (let i = 0; i < bandCount; i++) {
    const at = 19 + i * 13;
    bands.push({
      type: v[at],
      freq: readF32(v, at + 1),
      gain: readF32(v, at + 5),
      q: readF32(v, at + 9),
    });
  }
  const cat = v[0] === EQ_CATEGORY_ON_WIRE ? EQ_CATEGORY_LOGICAL : v[0];
  const nameBytes = v.subarray(end);
  const name = nameBytes.length
    ? new TextDecoder().decode(nameBytes).replace(/\0+$/, '').trim() : '';
  return {
    category: cat,
    categoryState: v[1],
    calibration: readF32(v, 3),
    sampleRate: readI32(v, 7),
    leftGain: readF32(v, 11),
    rightGain: readF32(v, 15),
    bands,
    name: name || `kategorie ${cat}`,
    eqName: name,
  };
}

function encodeEqP4(eq) {
  const bands = eq.bands || [];
  if (!bands.length) throw new RangeError('EQ musí mít aspoň jedno pásmo');
  if (bands.length > 24) throw new RangeError('EQ má nejvýš 24 pásem');
  for (const b of bands)
    if (!Number.isFinite(b.gain) || !Number.isFinite(b.freq) || !Number.isFinite(b.q))
      throw new RangeError('pásmo EQ má nečíselnou hodnotu');
  const out = [];
  out.push(eq.category === EQ_CATEGORY_LOGICAL
    ? EQ_CATEGORY_ON_WIRE : (eq.category & 0xff));
  out.push(eq.categoryState & 0xff);
  out.push(bands.length & 0xff);
  out.push(...f32le(eq.calibration ?? 0));
  out.push(...i32le(eq.sampleRate ?? 0));
  out.push(...f32le(eq.leftGain ?? 0));
  out.push(...f32le(eq.rightGain ?? 0));
  for (const b of bands) {
    out.push(b.type & 0xff);
    out.push(...f32le(b.freq));
    out.push(...f32le(b.gain));
    out.push(...f32le(b.q));
  }
  if (eq.eqName) out.push(...new TextEncoder().encode(eq.eqName));
  return new Uint8Array(out);
}

/**
 * Zakoduje hodnotu z UI do bajtu hodnoty (bez TLV hlavicky).
 * prev = naposledy prectene syrove bajty; pouziva se, aby prepnuti
 * zap/vyp nezahodilo uroven, kterou uzivatel nevidi.
 */
function encodeValue(kind, cls, value, prev) {
  const lim = limitsFor(cls);
  const int = (n, max = lim.max) => {
    if (!Number.isInteger(n) || n < 0 || n > max)
      throw new RangeError(`hodnota ${n} je mimo rozsah 0–${max}`);
    return n;
  };

  switch (kind) {
    case 'toggle': {
      if (cls === 'StatusLevelSize1Feature') {
        const level = prev && prev.length ? (prev[0] & 0x7f) : 127;
        return new Uint8Array([((value ? 1 : 0) << 7) | level]);
      }
      if (lim.bytes === 2) return new Uint8Array(u16le(value ? 1 : 0));
      return new Uint8Array([value ? 1 : 0]);
    }
    case 'toggleLevel': {
      // Tise brat undefined jako "vypnuto, uroven 0" by znamenalo poslat
      // do sluchatek nulu, kterou uzivatel nikde nezadal.
      if (!value || typeof value !== 'object' ||
          value.on === undefined || value.level === undefined)
        throw new TypeError('hodnota musí být { on, level }');
      const on = !!value.on;
      const level = value.level | 0;
      if (cls === 'StatusLevelSize1Feature') {
        int(level, 127);
        return new Uint8Array([(on ? 0x80 : 0) | level]);
      }
      if (cls === 'StatusLevelSize2Feature' || lim.bytes === 2) {
        int(level, 0x7fff);
        const v = (on ? 0x8000 : 0) | level;
        return new Uint8Array(u16le(v));
      }
      int(level, 127);
      return new Uint8Array([(on ? 0x80 : 0) | level]);
    }
    case 'level': {
      const level = int(value, cls === 'StatusLevelSize1Feature' ? 127 : lim.max);
      if (cls === 'StatusLevelSize1Feature') {
        const on = prev && prev.length ? (prev[0] & 0x80) : 0x80;
        return new Uint8Array([on | level]);
      }
      return lim.bytes === 2 ? new Uint8Array(u16le(level)) : new Uint8Array([level]);
    }
    case 'enum':
    case 'number': {
      int(value);
      if (lim.bytes === 4)
        return new Uint8Array([value & 0xff, (value >> 8) & 0xff,
                               (value >> 16) & 0xff, (value >>> 24) & 0xff]);
      return lim.bytes === 2 ? new Uint8Array(u16le(value)) : new Uint8Array([value]);
    }
    case 'codec': {
      // SmartSwitch = pole 2bajtovych cisel [bitrate, bitpool, latence, latence2]
      const list = [value.bitrate, value.bitpool, value.latency,
                    value.latency2 ?? 0xFFFF];
      for (const n of list) int(n, 65535);
      const b = new Uint8Array(8);
      list.forEach((n, i) => { b[i * 2] = n & 0xff; b[i * 2 + 1] = (n >> 8) & 0xff; });
      return b;
    }
    case 'text':
      return new TextEncoder().encode(String(value));
    case 'raw':
      return value instanceof Uint8Array ? value : Uint8Array.from(value);
    case 'eq':
      return encodeEqP4(value);
    case 'action':
      return new Uint8Array(0);
    default:
      throw new Error(`typ ovládání ${kind} neumím zakódovat`);
  }
}

/** Dekoduje prijate bajty na { value, text } podle typu ovladace. */
function decodeValue(kind, cls, bytes, setting) {
  const c = P.codecFor(cls);
  let dec;
  try { dec = c.decode(bytes); } catch { dec = bytes; }
  const raw = hex(bytes) || '(prázdné)';

  const enumLabel = v => {
    const o = setting?.options?.find(([x]) => x === v);
    return o ? o[1] : String(v);
  };

  switch (kind) {
    case 'toggle': {
      const on = cls === 'StatusLevelSize1Feature'
        ? !!(bytes[0] & 0x80) : !!(bytes.length && bytes.some(b => b));
      return { value: on, text: on ? 'zapnuto' : 'vypnuto' };
    }
    case 'toggleLevel': {
      if (cls === 'StatusLevelSize2Feature' && bytes.length >= 2) {
        const v = bytes[0] | (bytes[1] << 8);
        const on = !!(v & 0x8000), level = v & 0x7fff;
        return { value: { on, level },
                 text: `${on ? 'zapnuto' : 'vypnuto'} · ${level}${setting?.unit ? ' ' + setting.unit : ''}` };
      }
      if (!bytes.length) return { value: null, text: '(prázdné)' };
      const on = !!(bytes[0] & 0x80), level = bytes[0] & 0x7f;
      return { value: { on, level },
               text: `${on ? 'zapnuto' : 'vypnuto'} · ${level}${setting?.unit ? ' ' + setting.unit : ''}` };
    }
    case 'level': {
      const level = cls === 'StatusLevelSize1Feature' ? (bytes[0] & 0x7f) : (dec?.[0] ?? null);
      return { value: level, text: level === null ? raw : String(level) };
    }
    case 'enum': {
      const v = Array.isArray(dec) ? dec[0] : (typeof dec === 'number' ? dec : null);
      return { value: v, text: v === null ? raw : enumLabel(v) };
    }
    case 'number': {
      const v = Array.isArray(dec) ? (dec.length === 1 ? dec[0] : null) : null;
      return { value: v,
               text: v === null ? (Array.isArray(dec) ? dec.join(' · ') : raw)
                                : `${v}${setting?.unit ? ' ' + setting.unit : ''}` };
    }
    case 'codec': {
      if (!Array.isArray(dec) || dec.length < 3) return { value: null, text: raw };
      const v = { bitrate: dec[0], bitpool: dec[1], latency: dec[2],
                  latency2: dec[3] ?? 0xFFFF };
      return { value: v,
               text: `${v.bitrate} kbps · bitpool ${v.bitpool} · ${v.latency} ms` };
    }
    case 'text':
      return { value: String(dec ?? ''), text: String(dec ?? '') || '(prázdné)' };
    case 'eq': {
      const e = decodeEqP4(bytes);
      if (!e) return { value: null, text: raw };
      const t = e.bands.length
        ? `${e.name} · ${e.bands.length} pásem · ` +
          e.bands.map(b => `${b.gain >= 0 ? '+' : ''}${b.gain.toFixed(1)}`).join(' ')
        : e.name;
      return { value: e, text: t };
    }
    case 'action':
      return { value: null, text: 'potvrzeno' };
    case 'raw':
    case 'info':
    default: {
      let text;
      try { text = c.render(dec); } catch { text = raw; }
      return { value: bytes, text: text || raw };
    }
  }
}

/** Lidsky popis povoleneho rozsahu — do UI i do potvrzeni. */
function rangeText(kind, cls, setting) {
  const lim = limitsFor(cls);
  switch (kind) {
    case 'toggle': return 'zapnuto / vypnuto';
    case 'toggleLevel':
      return `zapnuto/vypnuto + úroveň ${setting.min ?? 0}–` +
             `${Math.min(setting.max ?? lim.max, cls === 'StatusLevelSize1Feature' ? 127 : lim.max)}` +
             (setting.unit ? ' ' + setting.unit : '');
    case 'level': return `${setting.min ?? 0}–${setting.max ?? lim.max}`;
    case 'number':
      return `celé číslo ${setting.min ?? 0}–${Math.min(setting.max ?? lim.max, lim.max)}` +
             (setting.unit ? ' ' + setting.unit : '');
    case 'enum':
      return (setting.options || []).map(([v]) => v).join(', ') || 'jen hodnoty ze seznamu';
    case 'codec': return 'bitrate 0–65535 kbps · SBC bitpool 2–250 · latence 0–65535 ms';
    case 'text': return 'text';
    case 'action': return 'bez hodnoty';
    case 'eq': return 'celý profil: kategorie, zisky L/R a pásma ' +
                      '(frekvence, zisk, Q) plus název';
    case 'raw': return `hex bajty, po ${lim.bytes} B na číslo`;
    default: return 'jen ke čtení';
  }
}

/**
 * Vyrobi adapter pro dany profil zarizeni.
 * @param {object} profile  devices/*.js
 */
export function create(profile) {
  const bind = new Map();   // key -> { key, id, cls, rw, kind, setting, risk }
  const keyOfId = new Map();

  for (const [key, m] of Object.entries(profile.map)) {
    const setting = CAT.get(key);
    if (!setting) throw new Error(`mapování zná klíč "${key}", ale katalog ne`);
    const f = BY_NAME.get(m.feat);
    if (!f) throw new Error(`feature "${m.feat}" (klíč ${key}) není v features.js`);
    if (NEVER_TOUCH.has(f.id)) continue;      // na tyhle se nesaha vubec

    const kind = m.kind || setting.kind;
    const merged = { ...setting, ...m, kind };
    bind.set(key, {
      key, id: f.id, feat: f.name,
      cls: m.cls || f.cls,
      rw: m.rw || f.rw,
      kind,
      setting: merged,
      risk: worstRisk(setting.risk, m.risk, levelOf(f.id)),
      why: m.why || setting.why || reasonOf(f.id) || '',
    });
    keyOfId.set(f.id, key);
  }

  // --- skladani viceramcovych odpovedi -------------------------------------
  const pending = { cmd: -1, count: 0, parts: new Map() };
  const reset = () => { pending.parts.clear(); pending.cmd = -1; };

  return {
    protocol: 4,
    protocolLabel: 'Protocol 4 (feature ID)',
    service: P.UUID_SERVICE,
    /** Kolik ID se smi zeptat v jednom paketu. Mensi davka = setrnejsi. */
    batchSize: 8,
    /** Pauza mezi davkami v ms. */
    pauseMs: 130,

    keys: () => [...bind.keys()],
    has: key => bind.has(key),
    binding: key => bind.get(key),

    info(key) {
      const b = bind.get(key);
      if (!b) return null;
      return {
        addr: `ID ${b.id} · 0x${b.id.toString(16).padStart(4, '0')}`,
        detail: b.feat,
        rw: b.rw,
        kind: b.kind,
        setting: b.setting,
        risk: b.risk,
        why: b.why,
        range: rangeText(b.kind, b.cls, b.setting),
      };
    },

    canRead: key => !!bind.get(key)?.rw.includes('r'),
    // U Protocolu 4 se cte vsechno primo podle feature ID, takze
    // "jde zjistit" a "jde precist" je totez.
    canObserve: key => !!bind.get(key)?.rw.includes('r'),
    canWrite: key => {
      const b = bind.get(key);
      return !!b && b.rw.includes('w') && b.kind !== 'info';
    },

    /** Rozdeli klice do davek a vrati ramce k odeslani.
     *  Druhy parametr (doplnujici parametr dotazu) Protocol 4 nepotrebuje —
     *  cte se vzdy podle feature ID. */
    getFrames(keys) {
      const ids = keys.map(k => bind.get(k)?.id).filter(id => id !== undefined);
      if (!ids.length) return [];
      return [{ frames: P.buildFrames(P.CMD.GET_DEVICE_INFO, P.encodeGet(ids)),
                keys: [...keys] }];
    },

    /** Vyrobi zapisovy ramec. prev = naposledy prectene bajty (kvuli bitum). */
    setFrames(key, value, prev) {
      const b = bind.get(key);
      if (!b) throw new Error(`nastavení "${key}" tenhle model nemá`);
      if (!b.rw.includes('w')) throw new Error(`${key} je jen ke čtení`);
      const bytes = encodeValue(b.kind, b.cls, value, prev);
      const bad = P.validateValue(b.cls, bytes);
      if (bad) throw new RangeError(bad);
      const frames = P.buildFrames(P.CMD.SET_DEVICE_INFO, P.encodeSet(b.id, bytes));
      const shown = decodeValue(b.kind, b.cls, bytes, b.setting);
      return { frames, valueBytes: bytes, valueHex: hex(bytes),
               valueText: shown.text };
    },

    /** Prevede hodnotu na text bez odesilani — pro nahled v potvrzeni. */
    preview(key, bytes) {
      const b = bind.get(key);
      if (!b) return { value: null, text: hex(bytes) };
      return decodeValue(b.kind, b.cls, bytes, b.setting);
    },

    /** Zakoduje bez odeslani (pro porovnani v zaloze). */
    encode(key, value, prev) {
      const b = bind.get(key);
      if (!b) throw new Error(`nastavení "${key}" tenhle model nemá`);
      return encodeValue(b.kind, b.cls, value, prev);
    },

    reset,

    /**
     * PRUZKUM — precte kazde feature ID ze SDK, ktere jde cist.
     * Jen cteni, po malych davkach. Na co se nesaha, se preskoci.
     */
    probeCandidates() {
      const ids = FEATURES
        .filter(f => f.rw.includes('r') && !NEVER_TOUCH.has(f.id))
        .map(f => f.id);
      const out = [];
      for (let i = 0; i < ids.length; i += 8) {
        const part = ids.slice(i, i + 8);
        out.push({
          label: `feature ID ${part[0]}–${part[part.length - 1]}`,
          frames: P.buildFrames(P.CMD.GET_DEVICE_INFO, P.encodeGet(part)),
        });
      }
      return out;
    },

    // --- ruční příkaz ------------------------------------------------------
    // Konzole a ruční panel jdou PRES stejne pojistky jako tlacitka v UI.
    rawLabel: 'feature ID (24 nebo 0x18)',
    rawValueLabel: 'hodnota hex',

    rawParse(addrText) {
      const s = (addrText || '').trim();
      if (!s) throw new Error('zadej feature ID');
      const n = /^0x[0-9a-fA-F]+$/.test(s) ? parseInt(s, 16)
              : /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
      if (!Number.isInteger(n))
        throw new Error(`"${s}" není číslo (použij 24 nebo 0x18)`);
      if (n < 0 || n > 0xFFFF)
        throw new Error(`feature ID ${n} je mimo rozsah 0–65535`);
      if (NEVER_TOUCH.has(n))
        throw new Error(`na ID ${n} se nesahá vůbec — ani čtením`);
      const f = BY_ID.get(n);
      return {
        addr: n,
        name: f?.name || `ID ${n}`,
        known: !!f,
        tag: `ID ${n} · 0x${n.toString(16).padStart(4, '0')}${f ? ' · ' + f.rw : ''}`,
        cls: f?.cls || null,
        // Neznáme ID bereme jako rizikove — nevime, co delá, takze nesmi
        // projit tise. Stejne to ma Protocol 3 u neznameho prikazu.
        risk: levelOf(n) || (f ? null : 'medium'),
        why: reasonOf(n) ||
          (f ? '' : 'Tohle ID není v SDK — nevíme, co ve firmwaru dělá.'),
        range: f ? rangeText('raw', f.cls, {}) : 'ID není v SDK — posílá se přesně to, co zadáš',
      };
    },

    rawGetFrames(info) {
      return P.buildFrames(P.CMD.GET_DEVICE_INFO, P.encodeGet([info.addr]));
    },

    rawSetFrames(info, hexText) {
      const { bytes, error } = P.parseHex(hexText);
      if (error) throw new Error(error);
      if (info.cls) {
        const bad = P.validateValue(info.cls, bytes);
        if (bad) throw new Error(bad);
      } else if (!bytes.length) {
        throw new Error('zadej hodnotu v hex');
      }
      return { frames: P.buildFrames(P.CMD.SET_DEVICE_INFO,
                                     P.encodeSet(info.addr, bytes)),
               valueHex: hex(bytes) };
    },

    /**
     * Zpracuje prijaty paket.
     * Vraci { lines, values } — lines jsou radky do logu,
     * values jsou dekodovana nastaveni.
     */
    ingest(buf) {
      const lines = [];
      const values = [];
      const f = P.parseFrame(buf);
      if (!f) { lines.push({ text: 'neplatný rámec (< 8 B)', cls: 'warn' }); return { lines, values }; }
      if (f.identifier !== P.HDR && f.identifier !== P.HDR_FORWARD)
        lines.push({ text: `neznámý identifier 0x${f.identifier.toString(16)}`, cls: 'warn' });

      if (f.packetIndex === 0 || f.commandId !== pending.cmd) {
        if (pending.parts.size && f.packetIndex === 0)
          lines.push({ text: `zahazuji nedokončenou odpověď (chybělo ` +
            `${pending.count - pending.parts.size} paketů)`, cls: 'warn' });
        pending.parts.clear();
        pending.cmd = f.commandId;
      }
      pending.count = f.packetCount;
      pending.parts.set(f.packetIndex, f.payload.slice());
      if (pending.parts.size < pending.count) {
        lines.push({ text: `část ${f.packetIndex + 1}/${f.packetCount}`, cls: 'dim' });
        return { lines, values, partial: true };
      }

      let total = 0;
      for (const p of pending.parts.values()) total += p.length;
      const joined = new Uint8Array(total);
      let o = 0;
      for (let i = 0; i < pending.count; i++) {
        const p = pending.parts.get(i);
        if (p) { joined.set(p, o); o += p.length; }
      }
      pending.parts.clear();

      for (const item of P.parseTLV(joined)) {
        const key = keyOfId.get(item.id);
        const feat = BY_ID.get(item.id);
        const raw = item.value.slice();
        if (!key) {
          // Nezmapovana featura — do UI nepatri, ale do logu ano.
          const c = feat ? P.codecFor(feat.cls) : P.rawCodec;
          let t; try { t = c.render(c.decode(raw)); } catch { t = hex(raw); }
          lines.push({ text: `${String(item.id).padStart(5)} ${(feat?.name || '???')
            .padEnd(34)} = ${t}   [${hex(raw) || '-'}]`, cls: 'dim' });
          continue;
        }
        const b = bind.get(key);
        const d = decodeValue(b.kind, b.cls, raw, b.setting);
        values.push({ key, raw, value: d.value, text: d.text });
        lines.push({ text: `${String(item.id).padStart(5)} ${b.feat.padEnd(34)} = ` +
          `${d.text}   [${hex(raw) || '-'}]`, cls: 'rx' });
      }
      return { lines, values };
    },
  };
}

export { encodeValue, decodeValue, rangeText, limitsFor };
