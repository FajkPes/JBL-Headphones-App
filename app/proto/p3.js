// ---------------------------------------------------------------------------
// Adapter pro Protocol 3 (AA <cmd> <len> <payload>).
//
// Stejne rozhrani jako p4.js, takze UI nepozna rozdil.
//
// Mapovani v devices/*.js pro P3 vypada takhle:
//   anc: {
//     cmd: 0x31,                       // cislo prikazu (do popisku a logu)
//     listen: [0x31],                  // pod jakymi cisly chodi odpoved
//     get:  () => P3.frame(0x31, [1]), // dotaz (nesmi nic menit!)
//     set:  v => P3.frame(0x31, [v ? 1 : 0]),
//     read: dec => dec.on,             // z dekoderu na hodnotu pro UI
//   }
//
// Zamerne tu neni zadna automatika: kazdy prikaz Protocol 3 ma jiny tvar
// payloadu, takze hadat by znamenalo poslat do sluchatek nesmysl.
// ---------------------------------------------------------------------------

import * as P3 from '../protocol3.js';
import { UUID_SERVICE } from '../protocol.js';
import { BY_KEY as CAT, worstRisk } from '../catalog.js';

const hex = P3.hex;

/** Lidsky popis rozsahu podle typu ovladace. */
function rangeText(kind, setting) {
  switch (kind) {
    case 'toggle': return 'zapnuto / vypnuto';
    case 'toggleLevel':
      return `zapnuto/vypnuto + úroveň ${setting.min ?? 0}–${setting.max ?? 127}` +
             (setting.unit ? ' ' + setting.unit : '');
    case 'level': return `${setting.min ?? 0}–${setting.max ?? 127}`;
    case 'number':
      return `celé číslo ${setting.min ?? 0}–${setting.max ?? 255}` +
             (setting.unit ? ' ' + setting.unit : '');
    case 'enum':
      return (setting.options || []).map(([v]) => v).join(', ') || 'jen hodnoty ze seznamu';
    case 'codec': return 'AAC 0–65535 kbps · SBC bitpool 2–250 · latence 0–65535 ms';
    case 'text': return 'text';
    case 'action': return 'bez hodnoty';
    case 'raw': return 'hex bajty — formát není ověřený';
    default: return 'jen ke čtení';
  }
}

/**
 * Prikazy, ktere pouzivaji DVOUBAJTOVOU delku (CmdBase.combineLen2).
 * U vsech ostatnich je delka jednobajtova.
 *
 * Musime to vedet dopredu: u NEUPLNEHO ramce uz nejde poznat podle toho,
 * ktera varianta "presne sedi" — jeste nesedi ani jedna.
 */
const LEN2_CMDS = new Set([0x51, 0xA2]);

/** Kolik bajtu ma cely ramec mit. null = zatim nevime (je moc kratky). */
function expectedLength(buf) {
  if (buf.length < 3) return null;
  if (LEN2_CMDS.has(buf[1])) {
    if (buf.length < 4) return null;
    return 4 + (buf[2] | (buf[3] << 8));
  }
  return 3 + buf[2];
}

/** Nedokoncenou skladacku po tehle dobe zahodime a zacneme znovu. */
const RX_TIMEOUT_MS = 2000;

export function create(profile) {
  const bind = new Map();
  const listeners = new Map();   // cmd -> [key, ...]

  /**
   * Skladacka prijatych notifikaci.
   *
   * Protocol 3 NEMA v ramci cislo paketu ani jejich pocet — na rozdil od
   * Protocol 4. Dlouha odpoved (typicky EQ profil, ktery ma pres sto bajtu)
   * se proto do jedne BLE notifikace nevejde a prijde po kouscich.
   * Bez skladani se z ni precetl jen zacatek a zbytek se zahodil.
   */
  const rx = { buf: null, at: 0 };

  for (const [key, m] of Object.entries(profile.map)) {
    const setting = CAT.get(key);
    if (!setting) throw new Error(`mapování zná klíč "${key}", ale katalog ne`);
    // Radek smi byt i "odvozeny": vlastni dotaz nema, ale bere si svuj kus
    // z odpovedi, kterou vyvola jiny radek. Diky tomu jde jednu odpoved
    // (napr. 0x12 = nazev + PID + MAC) rozlozit do vic radku bez toho,
    // aby se zarizeni ptalo trikrat na to same.
    const derived = !m.get && !m.set;
    if (derived && !(m.listen?.length && m.read))
      throw new Error(`mapování "${key}" nemá ani get, ani set, ani listen+read`);
    const kind = m.kind || setting.kind;
    const merged = { ...setting, ...m, kind };
    const b = {
      key, kind, setting: merged, derived,
      cmd: m.cmd,
      get: m.get || null,
      set: m.set || null,
      read: m.read || null,
      // via = "svuj dotaz nemam, ctu se z odpovedi jineho radku".
      // Pouziva se tam, kde firmware na samostatny dotaz neodpovida,
      // ale hodnotu vraci v nejakem souhrnu.
      via: m.via || null,
      risk: worstRisk(setting.risk, m.risk),
      why: m.why || setting.why || '',
      listen: m.listen || (m.cmd !== undefined ? [m.cmd] : []),
    };
    bind.set(key, b);
    for (const c of b.listen) {
      if (!listeners.has(c)) listeners.set(c, []);
      listeners.get(c).push(key);
    }
  }

  /** Prevede hodnotu z UI na text pro potvrzeni. */
  function describe(kind, value, setting) {
    switch (kind) {
      case 'toggle': return value ? 'zapnuto' : 'vypnuto';
      case 'toggleLevel':
        return `${value.on ? 'zapnuto' : 'vypnuto'} · ${value.level}` +
               (setting.unit ? ' ' + setting.unit : '');
      case 'enum': {
        const o = setting.options?.find(([v]) => v === value);
        if (o) return o[1];
        // Zarizeni muze vratit i hodnotu, ktera v nabidce neni (720BT hlasi
        // u EQ 230 = "vlastni profil"). Holé číslo nikomu nic nerekne,
        // takze necháme mapovani nabidnout jmeno.
        const named = setting.nameOf?.(value);
        return named ? `${value} — ${named}` : String(value);
      }
      case 'codec':
        return `${value.bitrate} kbps · bitpool ${value.bitpool} · ${value.latency} ms`;
      case 'raw': return `${value.length} B: ${hex(value)}`;
      case 'eq': {
        const bands = value?.bands || [];
        return bands.length
          ? `${value.name} · ${bands.length} pásem · ` +
            bands.map(b => `${b.gain >= 0 ? '+' : ''}${b.gain.toFixed(1)}`).join(' ')
          : `${value?.name ?? '?'} · profil se nevrátil`;
      }
      case 'action': return 'příkaz bez hodnoty';
      default: return `${value}${setting.unit ? ' ' + setting.unit : ''}`;
    }
  }

  return {
    protocol: 3,
    protocolLabel: 'Protocol 3 (command ID)',
    service: UUID_SERVICE,     // obe rady sluchatek pouzivaji stejnou GATT sluzbu
    batchSize: 1,        // P3 umi jen jeden dotaz na paket
    pauseMs: 220,

    keys: () => [...bind.keys()],
    has: key => bind.has(key),
    binding: key => bind.get(key),

    info(key) {
      const b = bind.get(key);
      if (!b) return null;
      const canSee = !!b.get || !!b.via || b.derived;
      const rw = (canSee ? 'r' : '') + (b.set ? 'w' : '');
      return {
        addr: b.cmd !== undefined
          ? `cmd 0x${b.cmd.toString(16).padStart(2, '0')}` : 'cmd —',
        detail: b.via ? `čte se přes „${CAT.get(b.via)?.label || b.via}“`
          : b.derived ? 'čte se společně s dalším řádkem'
          : b.listen.length
          ? 'odpověď ' + b.listen.map(c => `0x${c.toString(16)}`).join(' / ') : '',
        rw, kind: b.kind, setting: b.setting, risk: b.risk, why: b.why,
        range: rangeText(b.kind, b.setting),
      };
    },

    /** Jde hodnotu zjistit? I nepřímo, přes jiný řádek. */
    canObserve: key => {
      const b = bind.get(key);
      return !!b && (!!b.get || !!b.via || b.derived);
    },

    canRead: key => {
      const b = bind.get(key);
      if (!b) return false;
      return !!b.get || (!!b.via && !!bind.get(b.via)?.get);
    },
    canWrite: key => {
      const b = bind.get(key);
      return !!b && !!b.set && b.kind !== 'info';
    },

    /**
     * @param {string[]} keys
     * @param {function} [paramOf] key -> doplnujici parametr dotazu
     *   (napr. u EQ kategorie profilu, ktery se ma precist)
     */
    getFrames(keys, paramOf) {
      // Protocol 3 nema davkovy dotaz — kazdy klic je vlastni ramec.
      // Radky s "via" se ale ctou pres nekoho jineho, takze se slouci:
      // jeden dotaz na souhrnny stav naplni pet radku misto peti dotazu,
      // z nichz by ctyri stejne zustaly bez odpovedi.
      const bySource = new Map();
      for (const k of keys) {
        const b = bind.get(k);
        if (!b) continue;
        const src = b.get ? k : (b.via && bind.get(b.via)?.get ? b.via : null);
        if (!src) continue;
        if (!bySource.has(src)) bySource.set(src, []);
        bySource.get(src).push(k);
      }
      return [...bySource].map(([src, covered]) => ({
        frames: [bind.get(src).get(paramOf?.(src))],
        keys: covered.includes(src) ? covered : [src, ...covered],
      }));
    },

    setFrames(key, value) {
      const b = bind.get(key);
      if (!b) throw new Error(`nastavení "${key}" tenhle model nemá`);
      if (!b.set) throw new Error(`${key} je jen ke čtení`);
      const frame = b.set(value);
      return { frames: [frame], valueBytes: frame, valueHex: hex(frame),
               valueText: describe(b.kind, value, b.setting) };
    },

    preview(key, bytes) {
      return { value: bytes, text: hex(bytes) };
    },

    encode(key, value) {
      const b = bind.get(key);
      if (!b?.set) throw new Error(`nastavení "${key}" nejde zapsat`);
      return b.set(value);
    },

    reset() { rx.buf = null; rx.at = 0; },

    /**
     * PRUZKUM — vsechny CTECI dotazy, ktere Protocol 3 zna.
     *
     * Seznam je z CommandHeader + RetHeader dekompilovaneho SDK, ne z naseho
     * mapovani. Smysl je zjistit, na co firmware odpovi, i kdyz to zatim
     * nikde v UI nemame.
     *
     * VSECHNO TADY MUSI BYT JEN CTENI. Zadny zapis, zadna zmena stavu.
     */
    probeCandidates() {
      const out = [];
      const add = (label, frames, note) => out.push({ label, frames, note });

      add('Informace o zařízení', [P3.frame(0x11)]);
      add('Baterie', [P3.frame(0x25, [0])]);
      add('Verze pouzdra', [P3.frame(0x26)]);
      add('Sériové číslo', [P3.frame(0x94, [1])]);
      add('Souhrnný stav', [P3.frame(0x9B, [1, 1])]);
      add('Kodek a latence', [P3.frame(0x82)]);
      add('Kodek — novější varianta', [P3.frame(0x80, [1])]);
      add('Vyvážení L/R', [P3.frame(0xA8, [1])]);
      add('Voice Aware', [P3.frame(0x98, [1])]);
      add('Hlášky — jazyk a verze', [P3.frame(0x93, [1])]);
      add('Hlášky — typ', [P3.frame(0x93, [4])]);
      add('ANC režimy', [P3.frame(0x91, [17])]);
      add('ANC podrežimy', [P3.frame(0x91, [1])]);
      add('ANC zap/vyp', [P3.frame(0x31, [1])]);
      add('Ambient Aware', [P3.frame(0x32, [1])]);
      add('ANC tuning', [P3.frame(0x75, [1])]);
      add('Function control', [P3.frame(0x78, [1])]);
      add('Touch panel', [P3.frame(0x79, [1])]);
      add('Standby režim', [P3.frame(0x96, [1])]);
      add('Hotword', [P3.frame(0x92, [1])]);
      add('Pípání sluchátek', [P3.frame(0x23)]);
      add('Sleep timer', [P3.frame(0x90, [3])]);
      add('Gesta — dávkově', [P3.frame(0x77, [0, 0])]);
      add('Personi-Fi režim', [P3.frame(0x49)]);
      add('Personi-Fi preset', [P3.frame(0x45)]);
      add('Analytika', [P3.frame(0x13)]);
      add('Sync stavu appky', [P3.frame(0x61, [1])],
          'v SDK je, u nás zatím nemapované');

      // stav zarizeni — vsechny typy zvlast
      for (const [t, name] of P3.DEV_STATUS_TYPES)
        add(`Stav zařízení 0x${t.toString(16)} — ${name}`, [P3.frame(0x21, [t])]);

      // vlastni EQ — kazdy index profilu zvlast
      for (let i = 0; i <= 7; i++)
        add(`Vlastní EQ — profil ${i}`, [P3.customEqGet(i)]);

      // novejsi EQ — kazda kategorie
      for (const cat of [0, 1, 2, 3, 4, 8, 19, 20, 230])
        add(`EQ (novější 0xA2) — kategorie ${cat}`, [P3.eqGet(cat)]);

      // Safe Sound — kazda featura zvlast i vsechny naraz
      add('Safe Sound — všechny položky',
          [P3.safeGet(P3.SAFE_FEATURES.map(f => f.id))]);
      for (const f of P3.SAFE_FEATURES)
        add(`Safe Sound — ${f.name}`, [P3.safeGet([f.id])]);

      // gesta po jednom
      for (let g = 0; g <= 5; g++)
        add(`Gesto ${g}`, [P3.frame(0x72, [g])]);

      return out;
    },

    // --- ruční příkaz ------------------------------------------------------
    rawLabel: 'cmd (145 nebo 0x91)',
    rawValueLabel: 'payload hex',

    rawParse(addrText) {
      const s = (addrText || '').trim();
      if (!s) throw new Error('zadej cmd');
      const n = /^0x[0-9a-fA-F]+$/.test(s) ? parseInt(s, 16)
              : /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
      if (!Number.isInteger(n))
        throw new Error(`"${s}" není číslo (použij 145 nebo 0x91)`);
      if (n < 0 || n > 0xFF)
        throw new Error(`cmd ${n} je mimo rozsah 0–255`);
      // Riziko podle toho, co o prikazu vime z mapovani. Kdyz ho neznáme,
      // bereme ho jako rizikovy — radeji zbytecne potvrzeni nez tichy zapis.
      let known = null;
      for (const b of bind.values()) if (b.cmd === n) { known = b; break; }
      return {
        addr: n,
        name: known ? known.setting.label : `Ruční příkaz 0x${n.toString(16)}`,
        known: !!known,
        tag: `cmd 0x${n.toString(16).padStart(2, '0')}`,
        risk: known?.risk || 'medium',
        why: known?.why ||
          'Ruční příkaz jde do sluchátek bez kontroly významu payloadu.',
        range: known ? rangeText(known.kind, known.setting)
                     : 'neznámý příkaz — posílá se přesně to, co zadáš',
      };
    },

    rawGetFrames(info) {
      return [P3.frame(info.addr)];
    },

    rawSetFrames(info, hexText) {
      const t = (hexText || '').replace(/0x/gi, '').replace(/[,;]/g, ' ').trim();
      let bytes = [];
      if (t !== '') {
        if (!/^[0-9a-fA-F\s]+$/.test(t))
          throw new Error('povolené jsou jen hex číslice 0–9, a–f a mezery');
        const clean = t.replace(/\s+/g, '');
        if (clean.length % 2)
          throw new Error(`lichý počet číslic (${clean.length}) — každý bajt má dvě`);
        for (let i = 0; i < clean.length; i += 2)
          bytes.push(parseInt(clean.substr(i, 2), 16));
      }
      const frame = P3.frame(info.addr, bytes);
      return { frames: [frame], valueHex: hex(Uint8Array.from(bytes)) };
    },

    ingest(chunk) {
      const lines = [];
      const values = [];

      // --- slozit dlouhou odpoved z vic notifikaci ------------------------
      const now = Date.now();
      if (rx.buf && now - rx.at > RX_TIMEOUT_MS) {
        lines.push({ text: `zahazuji nedokončenou odpověď (${rx.buf.length} B, ` +
          `další část nedorazila)`, cls: 'warn' });
        rx.buf = null;
      }
      if (rx.buf) {
        const merged = new Uint8Array(rx.buf.length + chunk.length);
        merged.set(rx.buf, 0);
        merged.set(chunk, rx.buf.length);
        rx.buf = merged;
      } else if (chunk[0] === P3.HEADER) {
        rx.buf = chunk.slice();
      } else {
        lines.push({ text: 'nezačíná 0xAA a nenavazuje na nic — zahazuji',
                     cls: 'warn' });
        return { lines, values };
      }
      rx.at = now;

      const want = expectedLength(rx.buf);
      if (want === null || rx.buf.length < want) {
        lines.push({ text: `část ${rx.buf.length}` +
          (want === null ? '' : ` z ${want}`) + ' B, čekám na zbytek', cls: 'dim' });
        // partial rika odesilaci vrstve, ze odpoved JESTE NEDORAZILA CELA
        // a nesmi se zacit posilat dalsi dotaz.
        return { lines, values, partial: true };
      }
      const buf = rx.buf;
      rx.buf = null;

      const f = P3.parse(buf);
      if (!f) {
        lines.push({ text: 'nezačíná 0xAA nebo je moc krátký', cls: 'warn' });
        return { lines, values };
      }
      const tag = `aa${f.cmd.toString(16).padStart(2, '0')}`;
      if (f.mismatch)
        lines.push({ text: `${tag}  délka nesedí (uvedeno ${f.len}, přijato ` +
          `${buf.length - 3})`, cls: 'warn' });
      else
        lines.push({ text: `${tag}  délka ${f.len} (${f.lenBytes}B)  payload: ` +
          `${hex(f.payload) || '(prázdný)'}`, cls: 'dim' });

      // Safe Sound ma vlastni ramec s vlastnim rozborem
      if (f.cmd === 0x51) {
        for (const it of P3.decodeSafe(f.payload)) {
          const key = profile.safeKeyOf?.[it.id];
          const num = it.raw.length === 1 ? it.raw[0]
                    : it.raw.length === 2 ? (it.raw[0] | (it.raw[1] << 8)) : null;
          const text = num !== null ? String(num) : `${it.raw.length} B`;
          lines.push({ text: `${it.name.padEnd(30)} = ${text}   [${hex(it.raw)}]`,
                       cls: 'rx' });
          if (key && bind.has(key))
            values.push({ key, raw: it.raw.slice(), value: num, text });
        }
        return { lines, values };
      }

      const dec = P3.decode(f.cmd, f.payload);
      if (dec?.text) lines.push({ text: `→ ${dec.text}`, cls: 'rx' });

      // Odpoved muze chodit pod jinym cislem, nez pod kterym se ptame.
      const cmds = new Set([f.cmd]);
      const req = P3.RESP_TO_REQ.get(f.cmd);
      if (req !== undefined) cmds.add(req);

      let matched = false;
      for (const c of cmds) {
        for (const key of listeners.get(c) || []) {
          const b = bind.get(key);
          if (!dec) continue;
          let value = null;
          try { value = b.read ? b.read(dec, f.payload) : null; } catch { value = null; }
          // undefined znamena "tahle odpoved neni pro me" — napr. stav
          // zarizeni typu 0x33 nemá co rict radku s EQ predvolbou.
          // Bez toho by se radek oznacil jako zodpovezeny s prazdnou hodnotou.
          if (value === undefined) continue;
          // Jedna odpoved muze naplnit vic radku (souhrnny stav 0x30 nese
          // auto vypnuti, EQ, Multi AI i auto play najednou). Kazdy radek
          // proto ukazuje SVOJI hodnotu, ne cely text odpovedi — jinak by
          // v sesti radcich stalo to same.
          let text;
          try { text = value === null ? (dec.text || hex(f.payload))
                                      : describe(b.kind, value, b.setting); }
          catch { text = dec.text || hex(f.payload); }
          values.push({ key, raw: f.payload.slice(), value, text });
          matched = true;
        }
      }
      if (!matched)
        lines.push({ text: `odpověď 0x${f.cmd.toString(16)} nepatří k žádnému ` +
          `nastavení v UI`, cls: 'dim' });
      return { lines, values };
    },
  };
}
