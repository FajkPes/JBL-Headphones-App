// ---------------------------------------------------------------------------
// Harman Protocol 3 — pro JBL TUNE 720BT (PID 20B4, uiVersion 3.1)
//
// Zdroj: com.harman.bluetooth.reqimp.CmdGen / CommandHeader,
//        com.harman.commands.CmdBase / SafeListeningCmd,
//        com.harman.bluetooth.imp.cmd.LeftRightSoundBalanceCmd
//
// Ramec (CmdBase.combine):
//     AA <cmdId> <len:1B> <payload...>
// Varianta s 2B delkou (CmdBase.combineLen2, pouziva SafeListening):
//     AA <cmdId> <lenLo> <lenHi> <payload...>
// ---------------------------------------------------------------------------

export const HEADER = 0xAA;

// Pozor: nektere prikazy posila SDK s delkou 0 a bez payloadu
// (CmdBase.combine s jednim argumentem), jine s payloadem [0x00]
// (CmdBase.combineSub). Neni to totez - viz frame() nize.

export const hex = b => [...b].map(x => x.toString(16).padStart(2, '0')).join(' ');

/** Overi cmd a bajty payloadu. Radeji spadnout nez poslat orezany paket. */
function check(cmd, payload, maxLen) {
  if (!Number.isInteger(cmd) || cmd < 0 || cmd > 0xFF)
    throw new RangeError(`cmd ${cmd} je mimo rozsah 0-255`);
  for (const b of payload)
    if (!Number.isInteger(b) || b < 0 || b > 0xFF)
      throw new RangeError(`bajt ${b} v payloadu je mimo rozsah 0-255`);
  if (payload.length > maxLen)
    throw new RangeError(
      `payload ma ${payload.length} B, do delkoveho pole se vejde ${maxLen}`);
}

/** AA cmd len payload...  (jednobajtova delka) */
export function frame(cmd, payload = []) {
  const src = [...payload];
  check(cmd, src, 0xFF);
  const p = Uint8Array.from(src);
  const f = new Uint8Array(3 + p.length);
  f[0] = HEADER; f[1] = cmd; f[2] = p.length;
  f.set(p, 3);
  return f;
}

/** AA cmd lenLo lenHi payload...  (dvoubajtova delka) */
export function frame2(cmd, payload = []) {
  const src = [...payload];
  check(cmd, src, 0xFFFF);
  const p = Uint8Array.from(src);
  const f = new Uint8Array(4 + p.length);
  f[0] = HEADER; f[1] = cmd;
  f[2] = p.length & 0xff; f[3] = (p.length >> 8) & 0xff;
  f.set(p, 4);
  return f;
}

/**
 * Rozebere prijaty ramec. Delka muze byt 1B nebo 2B, takze zkusime obe
 * a vybereme tu, ktera presne sedi na velikost bufferu.
 */
export function parse(buf) {
  if (buf.length < 3 || buf[0] !== HEADER) return null;
  const cmd = buf[1];
  const len1 = buf[2];
  if (3 + len1 === buf.length)
    return { cmd, lenBytes: 1, len: len1, payload: buf.subarray(3) };
  if (buf.length >= 4) {
    const len2 = buf[2] | (buf[3] << 8);
    if (4 + len2 === buf.length)
      return { cmd, lenBytes: 2, len: len2, payload: buf.subarray(4) };
  }
  // Sériové číslo (0x94) hlásí délku BEZ úvodního sub-příkazu — změřeno
  // na 720BT: "aa 94 40 02 <64 B>" je 68 bajtů, ne 67. Není to poškozený
  // paket, jen jinak počítaná délka, takže to nehlásíme jako chybu.
  if (3 + 1 + len1 === buf.length)
    return { cmd, lenBytes: 1, len: len1, payload: buf.subarray(3),
             lenExcludesSub: true };
  // delka nesedi — vratime co mame, at je to v logu videt
  return { cmd, lenBytes: 0, len: len1, payload: buf.subarray(3), mismatch: true };
}

// --- cislo odpovedi != cislo dotazu ----------------------------------------
// Cast prikazu odpovida pod jinym cmd (typicky o jedna vyssim). Bez teto
// tabulky by odpoved nikam nedosla a v UI by zustalo prazdno.
// Zdroj: com.harman.bluetooth.retimp.RetHeader
export const RESP_TO_REQ = new Map([
  [0x12, 0x11],   // informace o zarizeni  — OVERENO na 720BT
  [0x22, 0x21],   // stav zarizeni         — OVERENO na 720BT
  [0x83, 0x82],   // smart switch / kodek  — OVERENO na 720BT
  [0x24, 0x23],   // pipani
  [0x43, 0x42],   // vlastni EQ
  [0x73, 0x72],   // gesta
  [0x76, 0x75],   // ANC tuning
]);

// Dalsi parovani z RetHeader, ktera zatim nemame jako prikaz v UI.
// Az je pridame, patri i sem: 0x14→0x13 (analytika),
// 0x46→0x45 a 0x48→0x47 (PersoniFi).

// --- pomocne enum tabulky --------------------------------------------------

// CmdBase.values — index -> bajt (do 15 identita, pak zvlastnosti)
export const VALUES = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,-3,-2,-1,16,17,18,19]
  .map(v => v & 0xff);

export const SAFE_FEATURES = [
  { id: 1,  name: 'MaximumVolumeLimit',       rw: 'RW' },
  { id: 2,  name: 'CurrentVolume',            rw: 'RW' },
  { id: 3,  name: 'DailyTimeLimitSwitch',     rw: 'RW' },
  { id: 4,  name: 'DailyTimeLimit',           rw: 'RW' },
  { id: 5,  name: 'TodayListenedTime',        rw: 'R'  },
  { id: 6,  name: 'PinCode',                  rw: 'RW' },
  { id: 7,  name: 'AverageVolumeHistory',     rw: 'R'  },
  { id: 8,  name: 'DailyListenedTimeHistory', rw: 'R'  },
  { id: 9,  name: 'RemindVoiceType',          rw: 'R'  },
  { id: 10, name: 'PrepareRecordYourVoice',   rw: 'R'  },
];

const knownSafeId = id => SAFE_FEATURES.some(f => f.id === id);

/** SafeListening GET: AA 51 <len2> 01 <featureId...> */
export function safeGet(ids) {
  for (const id of ids)
    if (!knownSafeId(id))
      throw new RangeError(`Safe Sound nezná feature ${id}`);
  return frame2(0x51, [1, ...ids]);
}

/** SafeListening SET: AA 51 <len2> 00 <featureId> <hodnota...> */
export function safeSet(id, val) {
  const f = SAFE_FEATURES.find(x => x.id === id);
  if (!f) throw new RangeError(`Safe Sound nezná feature ${id}`);
  if (f.rw !== 'RW') throw new RangeError(`${f.name} je jen ke čtení`);
  return frame2(0x51, [0, id, ...val]);
}

// Floaty jsou v obou EQ prikazech IEEE754 LITTLE-ENDIAN
// (HexArray.float2bytes prohodi bajty, hexStrToFloat cte s LITTLE_ENDIAN).
const f32le = v => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  return [...b];
};
const readF32le = (p, i) =>
  new DataView(p.buffer, p.byteOffset + i, 4).getFloat32(0, true);

/**
 * AA cmd len pocetPaketu payload...  (treti varianta ramce)
 *
 * CmdBase.combine(header, payload, chunk) — za delku pridava jeste POCET
 * PAKETU, na kolik se payload rozpadne. Pouziva to zapis vlastniho EQ,
 * kde je payload delsi nez jeden BLE paket.
 */
export function frame3(cmd, payload = [], chunk = 79) {
  const src = [...payload];
  check(cmd, src, 0xFF);
  if (!Number.isInteger(chunk) || chunk < 1)
    throw new RangeError(`velikost paketu ${chunk} nedava smysl`);
  const p = Uint8Array.from(src);
  const f = new Uint8Array(4 + p.length);
  f[0] = HEADER; f[1] = cmd;
  f[2] = p.length;
  f[3] = Math.ceil(p.length / chunk) || 1;
  f.set(p, 4);
  return f;
}

// --- vlastni ekvalizer (prikazy 0x41 / 0x42 / 0x43) ------------------------
// Tohle je EQ po pasmech pro STARSI modely (720BT). Je to neco jineho nez
// prikaz 0xA2 nize — jina cisla, jine rozlozeni, pasma po 16 bajtech.
//
// Zdroj: CmdGen.generateSetCustomEqCmd / generateGetCustomEqCmd,
//        HandleParse.parseCustomEQ
//
//   cteni:   aa 42 01 <index>            -> odpoved aa 43
//   zapis:   aa 41 <len> <pocetPaketu> <payload>     (frame3, chunk 79)
//
// POZOR: zapis a cteni maji ROZDILNE rozlozeni. Zapis nese navic kalibraci,
// cteni ji vynechava. Neni to preklep, takhle to ma SDK.
//
//   zapis:  [0] index  [1] kategorie  [2..5] kalibrace f32  [6] vzork.frekv.
//           [7..10] levy zisk f32  [11..14] pravy zisk f32
//           [15..18] pocet pasem i32   pak pasma po 16 B:
//           <typ i32> <zisk f32> <frekvence f32> <Q f32>
//
//   cteni:  [0] index  [1] kategorie  [2] vzork.frekv.
//           [3..6] levy zisk f32  [7..10] pravy zisk f32
//           [11..14] pocet pasem i32   pak pasma po 16 B (stejne poradi)

/** Nazvy kategorii EQ. Z HandleParse.parseEqCatIdx + konfiguraci modelu. */
export const EQ_CATEGORY_NAMES = new Map([
  [0, 'Vypnuto'], [1, 'Jazz'], [2, 'Vocal'], [3, 'Bass'], [4, 'Vlastní'],
  [8, 'Extreme Bass'], [17, 'Rock'], [18, 'Piano'], [19, 'Club'], [20, 'Studio'],
  // 230 (0xE6) neni predvolba ze seznamu — firmware jim hlasi "je aktivni
  // vlastni/upravena krivka". Stejnou hodnotu pouziva i Protocol 4,
  // kde po dratu jde jako 0xC1.
  [230, 'vlastní profil (mimo předvolby)'],
]);

export const eqCategoryName = i =>
  EQ_CATEGORY_NAMES.get(i) || `neznámá kategorie ${i}`;

export const CUSTOM_EQ_GET = 0x42, CUSTOM_EQ_SET = 0x41, CUSTOM_EQ_RET = 0x43;

/** Dotaz na ulozeny EQ profil. Nic nemeni. */
export function customEqGet(index = 0) {
  if (!Number.isInteger(index) || index < 0 || index > 0xFF)
    throw new RangeError(`index EQ profilu ${index} je mimo rozsah 0-255`);
  return frame(CUSTOM_EQ_GET, [VALUES[index] ?? index]);
}

/** Rozebere odpoved aa43. Vraci null, kdyz data nesedi. */
export function customEqParse(p) {
  if (p.length < 15) return null;
  const bandCount = p[11] | (p[12] << 8) | (p[13] << 16) | (p[14] << 24);
  // Firmware sam odmita vic nez 15 pasem, tak se toho drzime taky.
  if (bandCount < 0 || bandCount > 15) return null;
  if (p.length < 15 + bandCount * 16) return null;
  const bands = [];
  for (let i = 0; i < bandCount; i++) {
    const at = 15 + i * 16;
    bands.push({
      type: p[at] | (p[at + 1] << 8) | (p[at + 2] << 16) | (p[at + 3] << 24),
      gain: readF32le(p, at + 4),
      freq: readF32le(p, at + 8),
      q: readF32le(p, at + 12),
    });
  }
  return {
    index: p[0],
    category: p[1],
    name: eqCategoryName(p[1]),
    sampleRate: p[2],
    leftGain: readF32le(p, 3),
    rightGain: readF32le(p, 7),
    bands,
  };
}

/** Slozi zapis vlastniho EQ. */
export function customEqSet(eq) {
  const bands = eq.bands || [];
  if (!bands.length) throw new RangeError('EQ musí mít aspoň jedno pásmo');
  if (bands.length > 15) throw new RangeError('EQ má nejvýš 15 pásem');
  for (const b of bands)
    if (!Number.isFinite(b.gain) || !Number.isFinite(b.freq) ||
        !Number.isFinite(b.q))
      throw new RangeError('pásmo EQ má nečíselnou hodnotu');
  const i32 = n => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
  const p = [];
  p.push(eq.index & 0xff);
  p.push(VALUES[eq.category] ?? (eq.category & 0xff));
  p.push(...f32le(eq.calibration ?? 0));
  p.push(eq.sampleRate & 0xff);
  p.push(...f32le(eq.leftGain ?? 0));
  p.push(...f32le(eq.rightGain ?? 0));
  p.push(...i32(bands.length));
  for (const b of bands) {
    p.push(...i32(b.type ?? 1));
    p.push(...f32le(b.gain));
    p.push(...f32le(b.freq));
    p.push(...f32le(b.q));
  }
  return frame3(CUSTOM_EQ_SET, p);
}

// --- ekvalizer (prikaz 0xA2) -----------------------------------------------
// Zdroj: com.harman.commands.EQCmd
//
//   cteni:  aa a2 02 01 <kategorie>
//   zapis:  aa a2 <lenLo> <lenHi> <sub> <kategorie> <kalibrace:f32>
//           <vzorkovaci frekvence> <levy zisk:f32> <pravy zisk:f32>
//           <pocet pasem> pak za kazde pasmo 10 bajtu:
//           <typ> <zisk:f32> <frekvence:f32> <Q>
//
//   sub 0 = zapis, 1 = dotaz, 2 = odpoved, 3 = zapis s Q×10, 4 = odpoved s Q×10
//
// Floaty jsou IEEE754 LITTLE-ENDIAN (HexArray.float2bytes prohodi bajty
// a hexStrToFloat cte s ByteOrder.LITTLE_ENDIAN).

export const EQ_CMD = 0xA2;
const EQ_SUB_SET = 0, EQ_SUB_REQ = 1, EQ_SUB_RET = 2,
      EQ_SUB_SET_Q10 = 3, EQ_SUB_RET_Q10 = 4;



/** Dotaz na EQ profil dane kategorie. Nic nemeni. */
export function eqGet(category = 0) {
  if (!Number.isInteger(category) || category < 0 || category > 0xFF)
    throw new RangeError(`kategorie EQ ${category} je mimo rozsah 0-255`);
  return frame(EQ_CMD, [EQ_SUB_REQ, category]);
}

/**
 * Slozi zapis EQ.
 * @param {object} eq { category, calibration, sampleRate, leftGain,
 *                      rightGain, bands: [{ type, gain, freq, q }] }
 * @param {boolean} q10 posilat Q vynasobene deseti (sub 3)
 */
export function eqSet(eq, q10 = false) {
  const bands = eq.bands || [];
  if (!bands.length) throw new RangeError('EQ musí mít aspoň jedno pásmo');
  if (bands.length > 24) throw new RangeError('EQ má nejvýš 24 pásem');
  for (const b of bands) {
    if (!Number.isFinite(b.gain)) throw new RangeError('zisk pásma není číslo');
    if (!Number.isFinite(b.freq)) throw new RangeError('frekvence pásma není číslo');
    const q = Math.round((q10 ? b.q * 10 : b.q));
    if (!Number.isInteger(q) || q < 0 || q > 255)
      throw new RangeError(`Q ${b.q} se nevejde do jednoho bajtu`);
  }
  const p = [];
  p.push(q10 ? EQ_SUB_SET_Q10 : EQ_SUB_SET);
  p.push(eq.category & 0xff);
  p.push(...f32le(eq.calibration ?? 0));
  p.push(eq.sampleRate & 0xff);
  p.push(...f32le(eq.leftGain ?? 0));
  p.push(...f32le(eq.rightGain ?? 0));
  p.push(bands.length & 0xff);
  for (const b of bands) {
    p.push(b.type & 0xff);
    p.push(...f32le(b.gain));
    p.push(...f32le(b.freq));
    p.push(Math.round(q10 ? b.q * 10 : b.q) & 0xff);
  }
  return frame2(EQ_CMD, p);
}

/**
 * Rozebere odpoved na EQ. payload zacina sub-prikazem.
 * Vraci null, kdyz data nesedi — radeji nic nez vymyslena krivka.
 */
export function eqParse(payload) {
  if (payload.length < 2) return null;
  const sub = payload[0];
  const category = payload[1];
  // Kratka odpoved (jen kategorie) — profil se nevratil.
  if (payload.length < 16)
    return { sub, category, name: eqCategoryName(category), bands: [] };

  const bandCount = payload[15];
  if (payload.length < 16 + bandCount * 10) return null;

  const bands = [];
  for (let i = 0; i < bandCount; i++) {
    const at = 16 + i * 10;
    let q = payload[at + 9];
    if (sub === EQ_SUB_RET_Q10) q /= 10;
    bands.push({
      type: payload[at],
      gain: readF32le(payload, at + 1),
      freq: readF32le(payload, at + 5),
      q,
    });
  }
  return {
    sub, category, name: eqCategoryName(category),
    calibration: readF32le(payload, 2),
    sampleRate: payload[6],
    leftGain: readF32le(payload, 7),
    rightGain: readF32le(payload, 11),
    bands,
    q10: sub === EQ_SUB_RET_Q10,
  };
}

// --- stav zarizeni (prikaz 0x21 -> odpoved 0x22) ---------------------------
// Zdroj: HandleParse.parseDevStatus / parseDeviceAllStatus
//
// Prvni bajt odpovedi je typ, ktery jsme si vyzadali. Kazdy typ nese neco
// jineho — proto se to nedalo cist jako jeden "blok bajtu".

export const DEV_STATUS_TYPES = new Map([
  [0x30, 'souhrn všeho'], [0x31, 'ANC'], [0x32, 'Ambient Aware / TalkThru'],
  [0x33, 'automatické vypnutí'], [0x34, 'EQ předvolba'], [0x35, 'Multi AI'],
  [0x36, 'stav BT spojení'], [0x37, 'průběh aktualizace'],
  [0x38, 'auto play / pauza'], [0x39, 'stav TWS'], [0x3A, 'PersoniFi test'],
  [0x41, 'detekce nasazení'], [0x42, 'test těsnosti'],
]);

/** Multi AI = ktery hlasovy asistent je navazany. Ne multipoint. */
export const MULTI_AI_NAMES = new Map([
  [0x00, 'vypnuto'], [0x01, 'Google Assistant'], [0x02, 'Amazon Alexa'],
  [0x03, 'Tencent Xiaowei'], [0x04, 'Airoha Xiaowei'],
  [0xDF, 'výchozí asistent telefonu'],
]);

const autoOffFromByte = b => ({ on: !!(b & 0x80), minutes: b & 0x7f });

// --- dekodovani odpovedi ---------------------------------------------------
// Kazdy dekoder vraci { text, on?, level?, byte? }.
// - text  = co ukazat uzivateli
// - on/level/byte = hodnoty, kterymi se predvyplni ovladaci prvky
// Kdyz si nejsme jisti, pripiseme "?" - lepe priznat nez tvrdit nesmysl.

const ascii = p => [...p].filter(b => b >= 32 && b < 127)
  .map(b => String.fromCharCode(b)).join('');
const onOff = b => b ? 'zapnuto' : 'vypnuto';

/** Odpoved casto zacina sub-prikazem (02 = RET). Preskocime ho. */
function skipSub(p) {
  return (p.length > 1 && (p[0] === 0x02 || p[0] === 0x03)) ? p.subarray(1) : p;
}

export const DECODERS = {
  // ANC rezimy: 10 <mode> <val> <mode> <val> ...
  0x91: p => {
    const d = skipSub(p);
    if (d.length >= 3 && (d[0] === 0x10 || d[0] === 0x11)) {
      const pairs = [];
      for (let i = 1; i + 1 < d.length; i += 2)
        pairs.push(`režim ${d[i]} = ${d[i + 1]}`);
      return { text: pairs.join(' · ') || '(prázdné)' };
    }
    if (d.length >= 2) return { text: `podrežim ${d[1]}`, byte: d[1] };
    if (d.length === 1) return { text: `hodnota ${d[0]}`, byte: d[0] };
    return null;
  },

  0x31: p => { const d = skipSub(p); return d.length
    ? { text: `ANC ${onOff(d[d.length - 1])}`, on: !!d[d.length - 1] } : null; },

  0x32: p => { const d = skipSub(p); return d.length
    ? { text: `Ambient Aware — režim ${d[d.length - 1]}`, byte: d[d.length - 1] } : null; },

  // auto vypnuti: bit7 = zapnuto, bity 0-6 = minuty
  0x33: p => { const d = skipSub(p); if (!d.length) return null;
    const b = d[d.length - 1];
    return { text: `${onOff(b & 0x80)}${(b & 0x80) ? `, za ${b & 0x7f} min` : ''}`,
             on: !!(b & 0x80), level: b & 0x7f }; },

  0x40: p => { const d = skipSub(p); return d.length
    ? { text: `EQ preset ${d[d.length - 1]}`, byte: d[d.length - 1] } : null; },

  // Voice Aware. Presne podle VoiceAwareCmd.parseVoiceAwareInfo:
  //   ramec  aa 98 <len> <sub> <uroven> <zapnuto>
  //   payload      =    <sub> <uroven> <zapnuto>
  // Pri delce 3 je zapnuto v poslednim bajtu, jinak plati uroven i jako priznak.
  0x98: p => {
    if (p.length < 2) return null;
    const level = p[1];
    const on = p.length >= 3 ? p[2] !== 0 : level !== 0;
    return { text: `${onOff(on)} · úroveň ${level}`, on, level, byte: level };
  },

  0x78: p => { const d = skipSub(p); if (!d.length) return null;
    const v = d[d.length - 1];
    return { text: `hodnota ${v}`, byte: v }; },

  // L/R balance: <sub> 01 <zap> 02 <uroven>
  0xA8: p => {
    const d = skipSub(p);
    let on = null, lvl = null;
    for (let i = 0; i + 1 < d.length; i += 2) {
      if (d[i] === 1) on = !!d[i + 1];
      if (d[i] === 2) lvl = d[i + 1];
    }
    if (on === null && lvl === null) return null;
    return { text: `${on === null ? '' : onOff(on)}${lvl === null ? '' : `, úroveň ${lvl}`}`
               .replace(/^, /, ''), on: on ?? undefined, level: lvl ?? undefined };
  },

  // Hlasove hlasky. Struktura podle HandleParse (case 25) — sub-prikaz
  // rozhoduje, co v odpovedi je:
  //
  //   sub 2  <jazyk> <verze major> <verze minor> <verze patch>
  //          odpoved na dotaz "aa 93 01 01"
  //   sub 5  <typ hlasek>   0 = jen tony, 1 = mluvene hlasky
  //          odpoved na dotaz "aa 93 01 04"
  //
  // Overeno na realnych datech z 720BT: aa 93 05 02 01 00 00 05
  //   -> jazyk 1, verze balicku 0.0.5
  // (Drivejsi odhad "zapnuto: ano, jazyk 5" byl spatne v obou udajich.)
  0x93: p => {
    if (!p.length) return null;
    const sub = p[0];
    if (sub === 2) {
      if (p.length < 2) return null;
      const lang = p[1];
      const version = p.length >= 5 ? `${p[2]}.${p[3]}.${p[4]}` : null;
      return { text: `jazyk ${lang}` + (version ? ` · balíček ${version}` : ''),
               byte: lang, lang, version };
    }
    if (sub === 5) {
      if (p.length < 2) return null;
      const type = p[1];
      return { text: type === 1 ? 'mluvené hlášky'
                   : type === 0 ? 'jen tóny' : `typ ${type}`,
               on: type === 1, byte: type, voiceType: type };
    }
    return { text: `sub ${sub}: ${hex(p.subarray(1))}` };
  },

  // Baterie. Zmereno na 720BT: 01 00 00 50 50 ff ff ff ff ff ff ff ff
  //   [0]    typ / pocet polozek
  //   [1..2] rezerva
  //   [3..4] 0x50 = 80 -> procenta (dve hodnoty, u 720BT stejne)
  //   0xFF   neobsazeno (720BT nema pouzdro ani druhy bud)
  // Overeno na jednom vzorku, proto u vysledku zustava "?" kdyz je to divne.
  0x25: p => {
    const d = skipSub(p);
    const pct = [...d.subarray(1)].filter(b => b !== 0xff && b > 0 && b <= 100);
    if (!pct.length) return { text: `data: ${[...d].join(' ')}` };
    const uniq = [...new Set(pct)];
    return { text: `baterie ${uniq.join(' % / ')} %`, byte: uniq[0], level: uniq[0] };
  },

  0x94: p => { const s = ascii(skipSub(p)).replace(/\s+/g, ' ').trim();
    return { text: s ? `sériové číslo: ${s}` : `${p.length} B dat` }; },

  // Informace o zarizeni. Overeno na realnych datech z 720BT:
  //  [0..15]  nazev ASCII
  //  [16..17] PID little-endian
  //  [18]     ?
  //  [19..24] BT MAC
  //  [25..]   verze a rezerva (0xFF = nepouzito)
  0x12: p => {
    if (p.length < 25) return { text: ascii(p) || `${p.length} B dat` };
    const name = ascii(p.subarray(0, 16)).trim();
    const pid = (p[17] << 8 | p[16]).toString(16).toUpperCase().padStart(4, '0');
    const mac = [...p.subarray(19, 25)]
      .map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
    // Jedna odpoved nese tri ruzne udaje. Vracime je i zvlast, aby si
    // kazdy radek v UI mohl vzit svuj a nemusel se ptat znovu.
    return { text: `${name} · PID ${pid} · MAC ${mac}`, name, pid, mac };
  },
  0x11: p => DECODERS[0x12](p),

  // Smart Switch = parametry kodeku: <sub> <aac LE> <sbc LE> <lat LE> <lat2 LE>
  0x80: p => {
    const d = skipSub(p);
    if (d.length < 6) return null;
    const u16 = i => d[i] | (d[i + 1] << 8);
    const aac = u16(0), sbc = u16(2), lat = u16(4);
    const lat2 = d.length >= 8 ? u16(6) : null;
    return { text: `AAC ${aac} kbps · SBC bitpool ${sbc} · latence ${lat} ms` +
                   (lat2 !== null && lat2 !== 0xFFFF ? ` / ${lat2} ms` : ''),
             codec: { aac, sbc, lat, lat2 } };
  },
  0x81: p => DECODERS[0x80](p),
  0x82: p => DECODERS[0x80](p),
  0x83: p => DECODERS[0x80](p),

  // Stav zarizeni. Prvni bajt je typ, ktery jsme si vyzadali.
  // Rozlozeni podle HandleParse.parseDevStatus / parseDeviceAllStatus.
  //
  // Overeno na realnych datech z 720BT:
  //   aa 22 0d 30 00 00 9e e6 00 01 00 00 00 01 1e 00
  //   -> ANC vyp, AA vyp, auto vypnuti ZAPNUTO za 30 min, EQ 0xe6, MultiAI vyp
  //
  // Tohle je jediny zpusob, jak z 720BT precist auto vypnuti, EQ predvolbu,
  // Multi AI a auto play/pauzu — samostatny dotaz na ne firmware ignoruje.
  0x22: p => {
    if (!p.length) return null;
    const type = p[0];
    const label = DEV_STATUS_TYPES.get(type) || `typ 0x${type.toString(16)}`;
    const d = p.subarray(1);
    const raw = hex(d);

    switch (type) {
      case 0x30: {                       // souhrn vseho
        if (d.length < 4) return { text: `${label}: ${raw}` };
        const out = {};
        const parts = [];
        out.anc = !!d[0];
        parts.push(`ANC ${onOff(d[0])}`);
        out.ambientAware = d[1];
        parts.push(`AA ${d[1]}`);
        if (d[2] !== 0xFF) {
          out.autoOff = autoOffFromByte(d[2]);
          parts.push(`auto vypnutí ${out.autoOff.on ? 'za ' + out.autoOff.minutes + ' min'
                                                    : 'vypnuté'}`);
        }
        out.eqPreset = d[3];
        parts.push(`EQ ${eqCategoryName(d[3])}`);
        if (d.length >= 5) {
          out.multiAi = d[4];
          parts.push(`Multi AI ${MULTI_AI_NAMES.get(d[4]) || d[4]}`);
        }
        if (d.length >= 8) {
          out.autoPlayPause = !!d[7];
          parts.push(`auto play ${onOff(d[7])}`);
        }
        if (d.length >= 9) {
          out.tws = !!d[8];
          parts.push(`TWS ${onOff(d[8])}`);
        }
        return { text: parts.join(' · '), statusType: type, ...out };
      }
      case 0x31:
        return d.length ? { text: `ANC ${onOff(d[0])}`, statusType: type,
                            anc: !!d[0], on: !!d[0] } : null;
      case 0x32:
        return d.length ? { text: `Ambient Aware / TalkThru: ${d[0]}`,
                            statusType: type, ambientAware: d[0], byte: d[0] } : null;
      case 0x33: {                       // automaticke vypnuti
        if (!d.length) return null;
        // Kratka varianta je jeden bajt (bit 7 + minuty), delsi ma
        // priznak a dvoubajtovy cas.
        if (d.length <= 1) {
          const a = autoOffFromByte(d[0]);
          return { text: `${onOff(a.on)}${a.on ? `, za ${a.minutes} min` : ''}`,
                   statusType: type, autoOff: a, on: a.on, level: a.minutes };
        }
        const on = !!d[0];
        const minutes = d[1] | (d[2] << 8);
        return { text: `${onOff(on)}${on ? `, za ${minutes} min` : ''}`,
                 statusType: type, autoOff: { on, minutes }, on, level: minutes };
      }
      case 0x34:
        return d.length ? { text: `EQ: ${eqCategoryName(d[0])}`, statusType: type,
                            eqPreset: d[0], byte: d[0] } : null;
      case 0x35:
        return d.length ? { text: `Multi AI: ${MULTI_AI_NAMES.get(d[0]) || d[0]}`,
                            statusType: type, multiAi: d[0], byte: d[0] } : null;
      case 0x37:
        return d.length ? { text: `průběh aktualizace: ${d[0]}`, statusType: type } : null;
      case 0x38:
        return d.length ? { text: `auto play / pauza ${onOff(d[0])}`,
                            statusType: type, autoPlayPause: !!d[0], on: !!d[0] } : null;
      case 0x39:
        return d.length ? { text: `TWS spojení ${onOff(d[0])}`, statusType: type,
                            tws: !!d[0], on: !!d[0] } : null;
      case 0x41:
        return d.length >= 2
          ? { text: `nasazení — levé ${d[0]}, pravé ${d[1]}`, statusType: type } : null;
      case 0x42:
        return d.length >= 3
          ? { text: `těsnost — levé ${d[1]}, pravé ${d[2]}`, statusType: type } : null;
      default:
        return { text: `${label}: ${raw}`, statusType: type };
    }
  },

  // Ekvalizer (EQCmd). Cely profil vcetne frekvenci, typu filtru a Q.
  0xA2: p => {
    const e = eqParse(p);
    if (!e) return null;
    const bands = e.bands || [];
    const text = bands.length
      ? `${e.name} · ${bands.length} pásem · ` +
        bands.map(b => `${b.gain >= 0 ? '+' : ''}${b.gain.toFixed(1)}`).join(' ')
      : `${e.name} · profil se nevrátil`;
    return { text, eq: e, byte: e.category };
  },

  // Vlastni EQ po pasmech (odpoved na 0x42). Rozlozeni podle
  // HandleParse.parseCustomEQ — pasma po 16 bajtech.
  0x43: p => {
    const e = customEqParse(p);
    if (!e) {
      // Kdyz to na format nesedi, radeji priznat, nez hadat.
      return { text: `${p.length} B, nesedí na formát vlastního EQ: ${hex(p)}`,
               byte: p.length ? p[0] : undefined };
    }
    const t = e.bands.length
      ? `profil ${e.index} · ${e.name} · ${e.bands.length} pásem · ` +
        e.bands.map(b => `${b.gain >= 0 ? '+' : ''}${b.gain.toFixed(1)}`).join(' ')
      : `profil ${e.index} · ${e.name} · bez pásem`;
    return { text: t, customEq: e, byte: e.index };
  },

  // ANC tuning
  0x76: p => { const d = skipSub(p);
    return d.length ? { text: `tuning ${[...d].join(' ')}`, byte: d[0] } : null; },

  // Standby: <sub> <modeType> <stav> ...  (1 = normal, 2 = keep ANC)
  0x96: p => {
    const d = skipSub(p);
    const names = { 1: 'normální', 2: 'ANC zapnuté' };
    const parts = [];
    for (let i = 0; i + 1 < d.length; i += 2)
      parts.push(`${names[d[i]] || 'režim ' + d[i]}: ${d[i + 1] ? 'zap' : 'vyp'}`);
    return parts.length ? { text: parts.join(' · '), on: !!d[1] } : null;
  },

  // Souhrnny stav: <sub> <featureId> <hodnota> ...
  0x9B: p => {
    const d = skipSub(p);
    const parts = [];
    for (let i = 0; i + 1 < d.length; i += 2) parts.push(`${d[i]} → ${d[i + 1]}`);
    return { text: parts.join(' · ') || null };
  },
};

/**
 * Rozebere SafeListening odpoved.
 *
 * Format podle SafeListeningCmd.parse:
 *     <payloadType> [<featureId> <delka> <hodnota…>]…
 *
 * Delka hodnoty je v paketu, nehada se. Drivejsi verze brala u kazde
 * polozky pevne 1 bajt (a u historii zbytek paketu), coz u odpovedi
 * s vice polozkami rozhodilo cely zbytek rozboru.
 *
 * payloadType: 0 = SET, 1 = GET, 2 = odpoved na SET, 3 = odpoved na GET,
 *              4 = notifikace.
 */
export function decodeSafe(payload) {
  const out = [];
  if (!payload.length) return out;
  const payloadType = payload[0];
  let i = 1;
  while (i + 1 < payload.length) {
    const id = payload[i];
    const len = payload[i + 1];
    if (i + 2 + len > payload.length) {
      // Useknuty zaznam radeji zahodime, nez abychom hlasili nesmysl.
      out.push({ id, name: `? ${id}`, raw: payload.subarray(i + 2),
                 truncated: true });
      break;
    }
    const f = SAFE_FEATURES.find(x => x.id === id);
    out.push({ id, name: f?.name || `? ${id}`, known: !!f,
               raw: payload.subarray(i + 2, i + 2 + len) });
    i += 2 + len;
  }
  out.payloadType = payloadType;
  return out;
}

/** Vrati dekodovanou hodnotu pro dany cmd, nebo null. */
export function decode(cmd, payload) {
  try { return DECODERS[cmd]?.(payload) || null; }
  catch { return null; }
}

// --- znama vyctove hodnoty ze SDK ------------------------------------------
// Ordinaly enumu z com.harman.bluetooth.constantsimp.*
// Kde si nejsme jisti, je to v popisku napsane.

export const OPT_EQ_PRESET = [
  [0, '0 — vypnuto'], [1, '1 — Jazz'], [2, '2 — Vocal'], [3, '3 — Bass'],
  [4, '4 — vlastní (User)'], [5, '5 — Rock'], [6, '6 — Piano'], [7, '7 — Club'],
];
export const OPT_AA = [[0, '0 — vypnuto'], [1, '1 — TalkThru']];
export const OPT_TUNING = [[0, '0 — neurčeno'], [1, '1 — ANC'], [2, '2 — Ambient Aware']];
export const OPT_DEV_STATUS = Array.from({ length: 11 },
  (_, i) => [0x30 + i, `0x${(0x30 + i).toString(16)} — typ ${i}`]);
export const OPT_EAR_TEST = [[65, '65 — test nasazení'], [66, '66 — test těsnosti']];
export const OPT_MULTI_AI = [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'],
                             [223, '223 — vypnuto']];
export const OPT_VOICE_AWARE = [[0, '0 — vypnuto'], [1, '1'], [2, '2'],
                                [3, '3'], [4, '4'], [5, '5 — nejvyšší']];

// --- registr prikazu -------------------------------------------------------
// ui: 'none'   — jen odeslat
//     'byte'   — jedno cislo 0-255
//     'bool'   — zap/vyp
//     'level'  — posuvnik 0-127
//     'onoff+level' — zaskrtavatko (bit 7) + posuvnik (bity 0-6)
//     'raw'    — hex vstup

export const COMMANDS = [

  // ---- Support / info ----
  { key:'devInfo', group:'Support', label:'Informace o zařízení',
    cmd:0x11, ret:'aa11/aa12', get:() => frame(0x11) },
  { key:'battery', group:'Support', label:'Stav baterie',
    cmd:0x25, ret:'aa25', get:() => frame(0x25, [0]) },
  { key:'serial', group:'Support', label:'Sériové číslo',
    cmd:0x94, ret:'aa94', get:() => frame(0x94, [1]) },
  { key:'multiStatus', group:'Support', label:'Souhrnný stav zařízení',
    cmd:0x9B, ret:'aa9b', get:() => frame(0x9B, [1, 1]) },
  { key:'devStatus', group:'Support', label:'Stav zařízení (typ 0x30–0x3A)',
    cmd:0x21, ret:'aa22', note:'Typ se posílá jako jeden bajt, 0x30 až 0x3A.',
    get:() => frame(0x21, [0x30]), ui:'select', options:OPT_DEV_STATUS,
    set:v => frame(0x21, [v]) },
  { key:'inEar', group:'Support', label:'Test nasazení / těsnosti',
    cmd:0x21, note:'65 = in-ear test, 66 = sealing test.',
    get:() => frame(0x21, [65]), ui:'select', options:OPT_EAR_TEST,
    set:v => frame(0x21, [v]) },
  { key:'smartSwitch', group:'Support', label:'Smart Switch (starší varianta)',
    cmd:0x82, note:'Pokud 0x80 níž neodpoví, zkus tenhle.',
    get:() => frame(0x82) },

  // ---- Ambient Sound Control ----
  { key:'ancModes', group:'Ambient Sound Control', label:'ANC režimy — přečíst',
    cmd:0x91, ret:'aa91', get:() => frame(0x91, [17]) },
  { key:'ancSub', group:'Ambient Sound Control', label:'ANC podrežimy — přečíst',
    cmd:0x91, ret:'aa91', get:() => frame(0x91, [1]) },
  { key:'ancOff', group:'Ambient Sound Control', label:'Vypnout ANC i Ambient',
    cmd:0x91, risk:'medium', ui:'none', set:() => frame(0x91, [19]) },
  { key:'ancSet', group:'Ambient Sound Control', label:'ANC zapnout/vypnout',
    cmd:0x31, note:'0 = vypnuto, 1 = zapnuto.',
    ui:'bool', set:v => frame(0x31, [v ? 1 : 0]) },
  { key:'aaSet', group:'Ambient Sound Control', label:'Ambient Aware režim',
    cmd:0x32, note:'Hodnoty z EnumAAStatus. 720BT Ambient Aware nemá.',
    ui:'select', options:OPT_AA, set:v => frame(0x32, [VALUES[v] ?? v]) },
  { key:'ancSubSet', group:'Ambient Sound Control', label:'ANC podrežim',
    cmd:0x91, note:'Payload 00 <index>.',
    ui:'byte', set:v => frame(0x91, [0, VALUES[v] ?? v]) },
  { key:'ancTuningGet', group:'Ambient Sound Control', label:'ANC tuning',
    cmd:0x75, ret:'aa76', note:'Vyber, čeho se dotaz týká (EnumTuning).',
    ui:'select', options:OPT_TUNING,
    set:v => frame(0x75, [VALUES[v] ?? v]), get:() => frame(0x75, [1]) },

  // ---- Equalizer ----
  { key:'eqPreset', group:'Equalizer', label:'EQ preset',
    cmd:0x40, note:'Názvy presetů jsou z EnumEqPresetIdx v SDK.',
    ui:'select', options:OPT_EQ_PRESET, set:v => frame(0x40, [v]) },
  { key:'eqCustomGet', group:'Equalizer', label:'Vlastní EQ — přečíst',
    cmd:0x42, ret:'aa43', note:'Payload = index slotu.',
    get:() => frame(0x42, [0]), ui:'byte', set:v => frame(0x42, [VALUES[v] ?? v]) },
  { key:'eqCustomSet', group:'Equalizer', label:'Vlastní EQ — zapsat (raw)',
    cmd:0x41, risk:'medium',
    note:'Formát hodnot není ověřený. Nejdřív si přečti stávající EQ výše ' +
         'a odvoď formát z odpovědi.',
    ui:'raw', set:b => frame(0x41, b) },

  // ---- Voice Aware ----
  { key:'vaGet', group:'Voice Aware', label:'Voice Aware — přečíst',
    cmd:0x98, get:() => frame(0x98, [1]) },
  { key:'vaSet', group:'Voice Aware', label:'Voice Aware — úroveň',
    cmd:0x98, note:'0 znamená vypnuto. Horní mez není ze SDK jistá.',
    ui:'select', options:OPT_VOICE_AWARE,
    set:v => frame(0x98, [0, VALUES[v] ?? v]) },

  // ---- Smart Audio & Video = parametry kodeku ----
  // OVERENO na 720BT: dotaz 0x82 (bez payloadu) -> odpoved 0x83.
  //   aa 82 00  ->  aa 83 08 c5 00 2e 00 5a 00 ff ff
  // Zapis jde na 0x81 s osmi bajty (CmdGen.generateSetSmartSwitch).
  // Varianta 0x80 se sub-prikazem je z novejsi vrstvy a 720BT na ni mlci.
  { key:'ssGet', group:'Smart Audio & Video', label:'Kodek a latence — přečíst',
    cmd:0x82, ret:'aa83', get:() => frame(0x82) },
  { key:'ssSet', group:'Smart Audio & Video', label:'Kodek a latence — nastavit',
    cmd:0x81, ui:'codec',
    // zapis jde na 0x81, ale stav se cte odpovedi na 0x82 -> poslouchat i tam
    syncFrom:0x82,
    note:'aac = bitrate AAC v kbps, sbc = SBC bitpool, latence v ms. ' +
         'Windows u A2DP nabízí jen SBC, takže reálný přínos čekej ' +
         'hlavně od bitpoolu.',
    risk:'medium',
    set:(aac, sbc, lat, lat2 = 0xFFFF) => frame(0x81, [
      aac & 0xff, (aac >> 8) & 0xff, sbc & 0xff, (sbc >> 8) & 0xff,
      lat & 0xff, (lat >> 8) & 0xff, lat2 & 0xff, (lat2 >> 8) & 0xff]) },
  { key:'ssGetNew', group:'Smart Audio & Video',
    label:'Kodek — novější varianta (0x80)',
    cmd:0x80, ret:'aa80', note:'720BT na tuhle variantu neodpovídá.',
    get:() => frame(0x80, [1]) },
  { key:'fcGet', group:'Smart Audio & Video', label:'Function control — přečíst',
    cmd:0x78, ret:'aa78', get:() => frame(0x78, [1]) },
  { key:'fcSet', group:'Smart Audio & Video', label:'Function control — nastavit',
    cmd:0x78, note:'Payload 00 01 <hodnota>.',
    ui:'byte', set:v => frame(0x78, [0, 1, VALUES[v] ?? v]) },

  // ---- Standby (jiná věc než auto vypnutí) ----
  { key:'sbNormal', group:'Auto Power Off', label:'Standby — normální režim',
    cmd:0x96, note:'Payload 00 01 <zap>. Uspání se zachováním spojení.',
    ui:'bool', set:v => frame(0x96, [0, 1, v ? 1 : 0]) },
  { key:'sbKeepAnc', group:'Auto Power Off', label:'Standby — nechat ANC zapnuté',
    cmd:0x96, note:'Payload 00 02 <zap>. Ve standby dál potlačuje hluk.',
    ui:'bool', set:v => frame(0x96, [0, 2, v ? 1 : 0]) },

  // ---- Left / Right Balance ----
  { key:'lrGet', group:'Left / Right Balance', label:'Balance — přečíst',
    cmd:0xA8, ret:'aaa8', get:() => frame(0xA8, [1]) },
  { key:'lrSet', group:'Left / Right Balance', label:'Balance — nastavit',
    cmd:0xA8, note:'Payload 00 01 <zap> 02 <úroveň>.',
    ui:'onoff+level',
    set:(on, lvl) => frame(0xA8, [0, 1, on ? 1 : 0, 2, lvl & 0xff]) },

  // ---- Voice Prompts ----
  { key:'vpGet', group:'Voice Prompts', label:'Hlasové hlášky — přečíst',
    cmd:0x93, ret:'aa93', get:() => frame(0x93, [1]) },
  { key:'vpSet', group:'Voice Prompts', label:'Hlasové hlášky zap/vyp',
    cmd:0x93, note:'Payload 03 00 (vyp) nebo 03 01 (zap).',
    ui:'bool', set:v => frame(0x93, [3, v ? 1 : 0]) },

  // ---- Auto Power Off ----
  { key:'autoOff', group:'Auto Power Off', label:'Auto vypnutí',
    cmd:0x33, note:'Jeden bajt: bit 7 = zapnuto, bity 0–6 = hodnota (minuty).',
    ui:'onoff+level', set:(on, min) => frame(0x33, [((on ? 1 : 0) << 7) | (min & 0x7f)]) },
  { key:'standbyGet', group:'Auto Power Off', label:'Standby režim — přečíst',
    cmd:0x96, get:() => frame(0x96, [1]) },
  { key:'sleepGet', group:'Auto Power Off', label:'Sleep timer — přečíst',
    cmd:0x90, get:() => frame(0x90, [3]) },

  // ---- Gesta ----
  { key:'gestGet', group:'Gesta a ovládání', label:'Gesta — přečíst (dávkově)',
    cmd:0x77, get:() => frame(0x77, [0, 0]) },
  { key:'gestGetOne', group:'Gesta a ovládání', label:'Gesto — přečíst jedno',
    cmd:0x72, ui:'byte', set:v => frame(0x72, [VALUES[v] ?? v]) },
  { key:'tpGet', group:'Gesta a ovládání', label:'Touch panel — přečíst',
    cmd:0x79, ret:'aa79', get:() => frame(0x79, [1]) },
  { key:'tpSet', group:'Gesta a ovládání', label:'Touch panel — nastavit',
    cmd:0x79, risk:'medium', note:'Payload 00 01 <hodnota>.',
    ui:'byte', set:v => frame(0x79, [0, 1, VALUES[v] ?? v]) },

  // ---- Ostatní ----
  { key:'autoPlay', group:'Ostatní', label:'Auto play/pause',
    cmd:0x35, ui:'bool', set:v => frame(0x35, [v ? 1 : 0]) },
  { key:'beepGet', group:'Ostatní', label:'Pípání sluchátek — přečíst',
    cmd:0x23, get:() => frame(0x23) },
  { key:'hotwordGet', group:'Ostatní', label:'Hotword režim — přečíst',
    cmd:0x92, ret:'aa92', get:() => frame(0x92, [1]) },
  { key:'multiAi', group:'Ostatní', label:'Multi AI',
    cmd:0x34, note:'Povolené hodnoty: 0,1,2,3,4,223.',
    ui:'select', options:OPT_MULTI_AI, risk:'medium', set:v => frame(0x34, [v]) },

  // ---- Rizikove ----
  { key:'shutdown', group:'Rizikové', label:'Vypnout sluchátka',
    cmd:0x97, risk:'medium', ui:'none', set:() => frame(0x97) },
  { key:'factory', group:'Rizikové', label:'Tovární reset',
    cmd:0x95, risk:'critical', ui:'none', set:() => frame(0x95),
    why:'Smaže všechna nastavení sluchátek.' },
];

export const GROUPS = [...new Set(COMMANDS.map(c => c.group))];
export const BY_KEY = new Map(COMMANDS.map(c => [c.key, c]));

/**
 * Co se da zalohovat a obnovit.
 *
 * GET a SET jsou v UI oddelene radky, takze parovani musi byt explicitni.
 * Je tu jen to, u ceho umime z odpovedi spolehlive slozit argumenty pro
 * zapis zpet — radeji min polozek nez nejistota, co se do sluchatek vrati.
 */
export const BACKUP_PAIRS = [
  { key: 'voicePrompts', label: 'Hlasové hlášky',
    get: 'vpGet', set: 'vpSet',
    args: d => d.on === undefined ? null : [d.on] },

  { key: 'voiceAware', label: 'Voice Aware — úroveň',
    get: 'vaGet', set: 'vaSet',
    args: d => d.byte === undefined ? null : [d.byte] },

  { key: 'balance', label: 'Left / Right Balance',
    get: 'lrGet', set: 'lrSet',
    args: d => (d.on === undefined || d.level === undefined) ? null : [d.on, d.level] },

  { key: 'functionControl', label: 'Function control',
    get: 'fcGet', set: 'fcSet',
    args: d => d.byte === undefined ? null : [d.byte] },

  { key: 'codec', label: 'Kodek a latence',
    get: 'ssGet', set: 'ssSet',
    args: d => d.codec ? [d.codec.aac, d.codec.sbc, d.codec.lat, 0] : null },

  { key: 'standbyNormal', label: 'Standby — normální režim',
    get: 'standbyGet', set: 'sbNormal',
    args: d => d.on === undefined ? null : [d.on] },
];
