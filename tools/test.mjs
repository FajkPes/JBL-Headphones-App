// Testy protokolove a mapovaci vrstvy.  Spusteni:  node tools/test.mjs
//
// Overuje ramce proti hodnotam odvozenym ze SDK, dekodery proti realnym
// datum z 720BT, konzistenci katalogu a mapovani a bezpecnostni pravidla.
// Zadny test nesmi selhat pred pouzitim na hardwaru.

import * as P from '../app/protocol.js';
import * as P3 from '../app/protocol3.js';
import * as Zip from '../app/zip.js';
import * as Backup from '../app/core/backup.js';
import { FEATURES, BY_ID, BY_NAME } from '../app/features.js';
import { RISK, levelOf, reasonOf, isHidden, NEVER_TOUCH } from '../app/risk.js';
import { SETTINGS, GROUPS, TABS, BY_KEY as CAT, worstRisk, RISK_LABEL,
         WRITE_ONLY_WARNING }
  from '../app/catalog.js';
import { DEVICES, adapterFor } from '../app/devices/index.js';
import * as Guard from '../app/core/guard.js';

let pass = 0, fail = 0;
const H = h => Uint8Array.from((h.match(/[0-9a-fA-F]{2}/g) || []).map(x => parseInt(x, 16)));

function eq(name, got, want) {
  const g = typeof got === 'string' ? got : P.hex(got);
  if (g === want) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}\n          got:  ${g}\n          want: ${want}`); }
}
function ok(name, cond) {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}`); }
}
function throws(name, fn) {
  try { fn(); fail++; console.log(`  FAIL  ${name} — nevyhodilo chybu`); }
  catch { pass++; console.log(`  ok    ${name}`); }
}
const H1 = t => console.log(`\n${t}\n${'-'.repeat(t.length)}`);

// ---------------------------------------------------------------------------
H1('Protocol 4 — rámce');
eq('GET ANC', P.buildFrames(P.CMD.GET_DEVICE_INFO, P.encodeGet([24]))[0],
   '00 dd 01 00 01 00 02 00 18 00');
eq('GET tří featur', P.buildFrames(P.CMD.GET_DEVICE_INFO, P.encodeGet([24, 25, 26]))[0],
   '00 dd 01 00 01 00 06 00 18 00 19 00 1a 00');
eq('SET ANC zapnuto',
   P.buildFrames(P.CMD.SET_DEVICE_INFO,
     P.encodeSet(24, P.codec.StatusLevelSize1Feature.encode({ status: 1, level: 0 })))[0],
   '00 dd 02 00 01 00 05 00 18 00 01 00 80');
eq('GET LE Audio 2976', P.buildFrames(P.CMD.GET_DEVICE_INFO, P.encodeGet([2976]))[0],
   '00 dd 01 00 01 00 02 00 a0 0b');
ok('fragmentace 1200 B @ MTU 512 = 3 pakety',
   P.buildFrames(P.CMD.SET_DEVICE_INFO, new Uint8Array(1200), { mtu: 512 }).length === 3);

H1('Protocol 4 — parsování');
{
  const f = P.parseFrame(H('00 dd 01 00 01 00 09 00 18 00 01 00 81 0c 00 03 00 31 2e 30'));
  const tlv = P.parseTLV(f.payload);
  ok('hlavička', f.commandId === 1 && f.packetCount === 1 && f.payloadSize === 9);
  ok('TLV dvě položky', tlv.length === 2);
  eq('TLV #1 dekód',
     P.codec.StatusLevelSize1Feature.render(
       P.codec.StatusLevelSize1Feature.decode(tlv[0].value)), 'zapnuto · úroveň 1');
  eq('TLV #2 verze', P.codec.VersionStringFeature.decode(tlv[1].value), '1.0');
  ok('krátký rámec = null', P.parseFrame(H('00 dd 01')) === null);
  ok('useknutý TLV se zahodí', P.parseTLV(H('18 00 05 00 81')).length === 0);
}

H1('Protocol 4 — odmítnutí vadných hodnot');
throws('encodeSet ID 70000', () => P.encodeSet(70000, new Uint8Array(1)));
throws('encodeSet ID -1', () => P.encodeSet(-1, new Uint8Array(1)));
throws('encodeGet ID mimo rozsah', () => P.encodeGet([70000]));
throws('StatusLevel1 úroveň 200',
       () => P.codec.StatusLevelSize1Feature.encode({ status: 1, level: 200 }));
throws('Occupy1Byte hodnota 300', () => P.codec.Occupy1ByteEachIntFeature.encode([300]));
throws('Occupy2Bytes hodnota 70000', () => P.codec.Occupy2BytesEachIntFeature.encode([70000]));

H1('parseHex a validace délek');
ok('"80" projde', P.parseHex('80').bytes.length === 1);
ok('"0x80 1f" projde', P.hex(P.parseHex('0x80 1f').bytes) === '80 1f');
ok('"zz" odmítnuto', !!P.parseHex('zz').error);
ok('lichý počet číslic odmítnut', !!P.parseHex('abc').error);
ok('StatusLevel1 chce 1 B', !!P.validateValue('StatusLevelSize1Feature', new Uint8Array(2)));
ok('Occupy2Bytes chce sudou délku',
   !!P.validateValue('Occupy2BytesEachIntFeature', new Uint8Array(3)));
ok('NoPayload odmítne data', !!P.validateValue('NoPayloadFeature', new Uint8Array(1)));
ok('MAC chce 6 B', !!P.validateValue('MacAddressFeature', new Uint8Array(5)));

H1('Protocol 3 — rámce');
eq('ANC režimy GET', P3.frame(0x91, [17]), 'aa 91 01 11');
eq('info o zařízení (bez payloadu)', P3.frame(0x11), 'aa 11 00');
eq('baterie (combineSub)', P3.frame(0x25, [0]), 'aa 25 01 00');
eq('L/R balance set', P3.frame(0xa8, [0, 1, 1, 2, 10]), 'aa a8 05 00 01 01 02 0a');
eq('auto vypnutí 30 min', P3.frame(0x33, [(1 << 7) | 30]), 'aa 33 01 9e');
eq('Safe Sound GET vše', P3.safeGet([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
   'aa 51 0b 00 01 01 02 03 04 05 06 07 08 09 0a');
eq('Safe Sound SET max hlasitost', P3.safeSet(1, [0x30]), 'aa 51 03 00 00 01 30');
throws('cmd 300 odmítnut', () => P3.frame(300, [0]));
throws('bajt 300 v payloadu odmítnut', () => P3.frame(0x91, [300]));
throws('payload > 255 B odmítnut', () => P3.frame(0x91, new Array(256).fill(0)));
throws('Safe Sound neznámá feature', () => P3.safeGet([99]));
throws('Safe Sound zápis do read-only', () => P3.safeSet(5, [1]));

H1('Protocol 3 — dekodéry proti reálným datům z 720BT');
{
  const real = [
    ['informace o zařízení',
     'aa 12 25 4a 42 4c 20 54 75 6e 65 20 37 32 30 42 54 2d 4c b4 20 01 02 00 00 00 00 01 40 03 04 00 ff ff ff ff ff ff 00 07',
     'JBL Tune 720BT-L · PID 20B4 · MAC 02:00:00:00:00:01'],
    ['baterie', 'aa 25 0d 01 00 00 50 50 ff ff ff ff ff ff ff ff', 'baterie 80 %'],
    ['L/R balance', 'aa a8 05 02 01 00 02 63', 'vypnuto, úroveň 99'],
    ['auto vypnutí', 'aa 33 02 02 9e', 'zapnuto, za 30 min'],
    // Zachyceno na 720BT. Sub 2 = jazyk + verze balicku, NE zapnuto/vypnuto.
    ['hlasové hlášky — jazyk a verze', 'aa 93 05 02 01 00 00 05',
     'jazyk 1 · balíček 0.0.5'],
    ['hlasové hlášky — jen jazyk', 'aa 93 02 02 01', 'jazyk 1'],
    ['hlasové hlášky — typ (sub 5)', 'aa 93 02 05 01', 'mluvené hlášky'],
    ['hlasové hlášky — jen tóny', 'aa 93 02 05 00', 'jen tóny'],
    ['Voice Aware zapnuto úroveň 5', 'aa 98 03 02 05 01', 'zapnuto · úroveň 5'],
    ['sériové číslo (reálná data)',
     'aa 94 12 02 54 45 53 54 2d 55 4e 49 54 2d 30 30 30 30 30 31 00',
     'sériové číslo: TEST-UNIT-000001'],
  ];
  for (const [name, hexStr, want] of real) {
    const f = P3.parse(H(hexStr));
    eq(name, P3.decode(f.cmd, f.payload)?.text ?? '(nedekódováno)', want);
  }
  ok('délka 1B rozpoznána', P3.parse(H('aa 25 02 64 5a')).lenBytes === 1);
  ok('délka 2B rozpoznána', P3.parse(H('aa 51 03 00 03 01 30')).lenBytes === 2);
  ok('cizí hlavička odmítnuta', P3.parse(H('bb 25 01 00')) === null);
  ok('nesedící délka označena', P3.parse(H('aa 94 40 02 54 4c 31')).mismatch === true);

  // Seriove cislo hlasi delku BEZ uvodniho sub-prikazu. Zmereno na 720BT:
  // ramec ma 68 B, ale v delce je 64. Neni to poskozeny paket.
  {
    const real = 'aa 94 40 02 ' + '54 45 53 54 2d 55 4e 49 54 2d 30 30 30 30 30 31' +
                 ' 00'.repeat(48);
    const f = P3.parse(H(real));
    ok('délka bez sub-příkazu se pozná, ne jako chyba',
       f.lenExcludesSub === true && !f.mismatch);
    eq('a sériové číslo se z ní přečte', P3.decode(f.cmd, f.payload).text,
       'sériové číslo: TEST-UNIT-000001');
  }

  // Safe Sound: odpoved je TLV <featureId> <delka> <hodnota>, ne pevny 1 bajt.
  {
    const items = P3.decodeSafe(H('03 01 01 30 03 01 01 04 02 3c 00'));
    ok('Safe Sound rozebere tři TLV položky', items.length === 3);
    ok('Safe Sound čte typ odpovědi', items.payloadType === 3);
    ok('Safe Sound: max hlasitost 0x30',
       items[0].id === 1 && items[0].raw.length === 1 && items[0].raw[0] === 0x30);
    ok('Safe Sound: přepínač limitu',
       items[1].id === 3 && items[1].raw[0] === 1);
    ok('Safe Sound: dvoubajtová hodnota se nerozseká',
       items[2].id === 4 && items[2].raw.length === 2 && items[2].raw[0] === 0x3c);
    ok('Safe Sound: useknutý záznam se pozná',
       P3.decodeSafe(H('03 01 08 30'))[0].truncated === true);
  }
}

H1('Katalog nastavení');
{
  ok('žádné duplicitní klíče',
     new Set(SETTINGS.map(s => s.key)).size === SETTINGS.length);
  const badGroup = SETTINGS.filter(s => !GROUPS.some(g => g.key === s.group));
  ok(`každé nastavení má existující kategorii${badGroup.length
      ? ' — ' + badGroup.map(s => s.key) : ''}`, !badGroup.length);
  const badTab = GROUPS.filter(g => !TABS.includes(g.tab));
  ok(`každá kategorie má existující záložku${badTab.length
      ? ' — ' + badTab.map(g => g.key) : ''}`, !badTab.length);
  const noLabel = SETTINGS.filter(s => !s.label);
  ok(`každé nastavení má název${noLabel.length ? ' — ' + noLabel.map(s => s.key) : ''}`,
     !noLabel.length);
  const emptyEnum = SETTINGS.filter(s => s.kind === 'enum' && s.options &&
                                         !s.options.length);
  ok('žádný prázdný rozbalovací seznam', !emptyEnum.length);
  const riskNoWhy = SETTINGS.filter(s => s.risk && (!s.why || s.why.length < 20));
  ok(`každé riziko v katalogu má odůvodnění${riskNoWhy.length
      ? ' — ' + riskNoWhy.map(s => s.key) : ''}`, !riskNoWhy.length);
  ok('worstRisk bere vždy vyšší úroveň',
     worstRisk(null, 'medium') === 'medium' &&
     worstRisk('medium', 'critical') === 'critical' &&
     worstRisk('high', 'medium') === 'high' &&
     worstRisk(null, null) === null);
}

H1('Mapování modelů');
for (const dev of DEVICES) {
  const a = adapterFor(dev);
  const keys = a.keys();
  ok(`${dev.model}: mapování není prázdné`, keys.length > 0);

  const unknown = Object.keys(dev.map).filter(k => !CAT.has(k));
  ok(`${dev.model}: každý klíč zná katalog${unknown.length ? ' — ' + unknown : ''}`,
     !unknown.length);

  // Kazde zapisovatelne nastaveni musi mit typ ovladace, ktery umime vykreslit.
  const KINDS = ['toggle', 'toggleLevel', 'level', 'number', 'enum', 'codec',
                 'text', 'raw', 'action', 'info', 'eq'];
  const badKind = keys.filter(k => !KINDS.includes(a.info(k).kind));
  ok(`${dev.model}: každý typ ovládání je známý${badKind.length ? ' — ' + badKind : ''}`,
     !badKind.length);

  // enum bez moznosti by v UI byl prazdny seznam
  const emptySel = keys.filter(k => {
    const i = a.info(k);
    return i.kind === 'enum' && a.canWrite(k) && !(i.setting.options || []).length;
  });
  ok(`${dev.model}: každý zapisovatelný seznam má hodnoty${emptySel.length
      ? ' — ' + emptySel : ''}`, !emptySel.length);

  // riziko musi mit vzdy oduvodneni
  const noWhy = keys.filter(k => a.info(k).risk && a.info(k).why.length < 15);
  ok(`${dev.model}: každé riziko má odůvodnění${noWhy.length ? ' — ' + noWhy : ''}`,
     !noWhy.length);

  // na co se nesaha, nesmi byt namapovane
  const touched = keys.filter(k => {
    const b = a.binding(k);
    return b && b.id !== undefined && NEVER_TOUCH.has(b.id);
  });
  ok(`${dev.model}: NEVER_TOUCH není v mapování${touched.length ? ' — ' + touched : ''}`,
     !touched.length);

  // adapter musi umet vyrobit dotaz na vsechno, co se da cist
  const badGet = [];
  for (const k of keys.filter(x => a.canRead(x)))
    try { if (!a.getFrames([k]).length) badGet.push(k); } catch { badGet.push(k); }
  ok(`${dev.model}: každý čtecí dotaz jde sestavit${badGet.length ? ' — ' + badGet : ''}`,
     !badGet.length);

  // KAZDA zapisovatelna polozka musi jit opravdu zakodovat — vcetne
  // kazde hodnoty z rozbalovaciho seznamu a obou konců rozsahu.
  // Tohle chyta nesedici mapovani (napr. enum s hodnotou, ktera se do
  // datoveho typu nevejde) driv, nez se to poslu do sluchatek.
  const badEncode = [];
  for (const k of keys.filter(x => a.canWrite(x))) {
    const i = a.info(k);
    const s = i.setting;
    const samples = [];
    switch (i.kind) {
      case 'toggle': samples.push(true, false); break;
      case 'toggleLevel':
        samples.push({ on: true, level: s.min ?? 0 },
                     { on: false, level: Math.min(s.max ?? 127, 127) });
        break;
      case 'level':
      case 'number': samples.push(s.min ?? 0, s.max ?? 255); break;
      case 'enum': for (const [v] of (s.options || [])) samples.push(v); break;
      case 'codec':
        samples.push({ bitrate: 197, bitpool: 46, latency: 120, latency2: 0 });
        for (const p of (s.presets || [])) samples.push(p.value);
        break;
      case 'text': samples.push('test'); break;
      // 4 bajty projdou u 1B, 2B i 4B zarovnani — kratsi vzorek by test
      // shodil na validaci delky, kterou chceme mit prisnou.
      case 'raw': samples.push(Uint8Array.from([1, 0, 0, 0])); break;
      // EQ jde zapsat jen z profilu, ktery predtim prisel ze sluchatek —
      // vzorek proto musi mit i frekvence, typ filtru a Q.
      case 'eq': samples.push({ category: 0, calibration: 0, sampleRate: 0,
        leftGain: 0, rightGain: 0,
        bands: [{ type: 1, gain: 0, freq: 32, q: 1 },
                { type: 1, gain: 3, freq: 16000, q: 1 }] }); break;
      case 'action': samples.push(null); break;
      default: break;
    }
    for (const v of samples) {
      try {
        const built = a.setFrames(k, v);
        if (!built.frames.length) badEncode.push(`${k}=${JSON.stringify(v)}`);
      } catch (e) {
        badEncode.push(`${k}=${JSON.stringify(v)} (${e.message})`);
      }
    }
  }
  ok(`${dev.model}: každá nabízená hodnota jde odeslat${badEncode.length
      ? '\n          — ' + badEncode.join('\n          — ') : ''}`,
     !badEncode.length);
}

H1('Mapování 780NC — referenční model');
{
  const dev = DEVICES.find(d => d.id === 'tune780nc');
  const a = adapterFor(dev);
  const missing = Object.values(dev.map)
    .filter(m => m.feat && !BY_NAME.has(m.feat)).map(m => m.feat);
  ok(`všechny featury existují v SDK${missing.length ? ' — ' + missing : ''}`,
     !missing.length);

  eq('ANC se čte správným rámcem', a.getFrames(['anc'])[0].frames[0],
     '00 dd 01 00 01 00 02 00 18 00');
  eq('ANC zapnuto na úroveň 100',
     a.setFrames('anc', { on: true, level: 100 }).frames[0],
     '00 dd 02 00 01 00 05 00 18 00 01 00 e4');
  // Ambient Aware je u 780NC prepinac bez posuvniku (AscCardNoAaLevel).
  // Prepnuti nesmi zahodit uroven, kterou uzivatel nevidi.
  eq('vypnutí přepínače zachová úroveň z posledního čtení',
     a.setFrames('ambientAware', false, H('e4')).frames[0],
     '00 dd 02 00 01 00 05 00 19 00 01 00 64');
  eq('zapnutí přepínače zachová úroveň z posledního čtení',
     a.setFrames('ambientAware', true, H('64')).frames[0],
     '00 dd 02 00 01 00 05 00 19 00 01 00 e4');
  throws('toggleLevel bez { on, level } odmítnut',
         () => a.setFrames('anc', false));
  eq('SmartSwitch audio profil (256/53/150)',
     a.setFrames('smartSwitch',
       { bitrate: 256, bitpool: 53, latency: 150, latency2: 0 }).frames[0],
     '00 dd 02 00 01 00 0c 00 0f 10 08 00 00 01 35 00 96 00 00 00');
  eq('gesto MFB na play/pause', a.setFrames('gMfbPress', 0x08).frames[0],
     '00 dd 02 00 01 00 05 00 82 0f 01 00 08');

  // Protocol 4 ma EQ jinak nez Protocol 3: pasma po 13 bajtech
  // (typ, frekvence, zisk, Q jako float) a na konci nazev profilu.
  {
    const prof = { category: 4, categoryState: 1, calibration: 0, sampleRate: 48000,
                   leftGain: 0, rightGain: 0, eqName: 'EQ 62',
                   bands: [{ type: 1, freq: 32, gain: 3, q: 1.4 },
                           { type: 1, freq: 16000, gain: -2.5, q: 0.7 }] };
    const built = a.setFrames('eqBands', prof);
    const back = a.ingest(built.frames[0]).values.find(v => v.key === 'eqBands');
    ok('P4 EQ profil přežije zápis i zpětné přečtení',
       back && back.value.bands.length === 2 &&
       Math.abs(back.value.bands[0].freq - 32) < 1e-3 &&
       Math.abs(back.value.bands[1].gain + 2.5) < 1e-3 &&
       Math.abs(back.value.bands[0].q - 1.4) < 1e-3);
    ok('a nese i název profilu', back.value.eqName === 'EQ 62');
    ok('a vzorkovací frekvenci', back.value.sampleRate === 48000);
    // Kategorie 230 jde po dratu jako 0xC1 — jinak by se vratila spatne.
    const p230 = a.setFrames('eqBands', { ...prof, category: 230 });
    const b230 = a.ingest(p230.frames[0]).values.find(v => v.key === 'eqBands');
    ok('kategorie 230 se přeloží na 0xC1 a zpět', b230.value.category === 230);
  }

  // hodnota mimo rozsah se nesmi tise orezat
  throws('úroveň 200 u ANC odmítnuta',
         () => a.setFrames('anc', { on: true, level: 200 }));
  throws('neznámý klíč odmítnut', () => a.setFrames('nesmysl', 1));

  // dekodovani prijate hodnoty
  {
    const r = a.ingest(H('00 dd 01 00 01 00 05 00 18 00 01 00 e4'));
    ok('ANC se dekóduje z odpovědi', r.values.length === 1 &&
       r.values[0].key === 'anc' && r.values[0].value.on === true &&
       r.values[0].value.level === 100);
  }
  // co model nema, se nesmi objevit
  ok('780NC nemá tapy (jen tlačítka)', !a.has('gLeftTap'));
  ok('780NC má Auracast', a.has('auracastStatus'));
}

H1('Mapování 720BT — podmnožina');
{
  const a = adapterFor(DEVICES.find(d => d.id === 'tune720bt'));
  ok('720BT NEMÁ Auracast', !a.has('auracastStatus'));
  ok('720BT NEMÁ LE Audio', !a.has('leAudioUnicast'));
  ok('720BT NEMÁ prostorový zvuk', !a.has('spatialMode'));
  ok('720BT NEMÁ Personi-Fi', !a.has('personifiMode'));
  ok('720BT má EQ předvolby', a.has('eqPreset'));
  ok('vyvážení má správný rozsah 84–116 se středem 100',
     a.info('lrBalance').setting.min === 84 &&
     a.info('lrBalance').setting.max === 116 &&
     a.info('lrBalance').setting.centerAt === 100);

  eq('dotaz na kodek', a.getFrames(['smartSwitch'])[0].frames[0], 'aa 82 00');
  eq('zápis kodeku 197/53/90',
     a.setFrames('smartSwitch',
       { bitrate: 197, bitpool: 53, latency: 90, latency2: 0 }).frames[0],
     'aa 81 08 c5 00 35 00 5a 00 ff ff');
  eq('EQ preset Bass (3)', a.setFrames('eqPreset', 3).frames[0], 'aa 40 01 03');
  eq('EQ preset Club je 19, ne 7', a.setFrames('eqPreset', 19).frames[0],
     'aa 40 01 13');
  ok('720BT nenabízí předvolby, které nemá (Rock, Piano)',
     !a.info('eqPreset').setting.options.some(([, l]) => /Rock|Piano/.test(l)));
  ok('720BT NEMÁ ANC (model ho fyzicky nemá)', !a.has('anc'));
  ok('720BT NEMÁ dotykový panel', !a.has('touchPanel'));
  ok('720BT nabízí Safe Sound včetně stropu hlasitosti (je v JBL appce)',
     a.has('safeMaxVolume') && a.canWrite('safeMaxVolume'));
  ok('PID a MAC se čtou z odpovědi na název, bez dalšího dotazu',
     a.has('model') && a.has('macAddress') &&
     a.getFrames(['model']).length === 0);
  eq('vyvážení zapnuto úroveň 10',
     a.setFrames('lrBalance', { on: true, level: 10 }).frames[0],
     'aa a8 05 00 01 01 02 0a');
  eq('auto vypnutí 30 min',
     a.setFrames('autoPowerOff', { on: true, level: 30 }).frames[0], 'aa 33 01 9e');

  // odpoved 0x83 patri k dotazu 0x82 a musi dojit na smartSwitch
  {
    const r = a.ingest(H('aa 83 08 c5 00 2e 00 5a 00 ff ff'));
    const v = r.values.find(x => x.key === 'smartSwitch');
    ok('odpověď 0x83 doputuje na smartSwitch', !!v &&
       v.value.bitrate === 197 && v.value.bitpool === 46 && v.value.latency === 90);
  }
  // odpoved 0x12 se rozpadne do tri radku
  {
    const r = a.ingest(H('aa 12 25 4a 42 4c 20 54 75 6e 65 20 37 32 30 42 54 2d 4c ' +
      'b4 20 01 02 00 00 00 00 01 40 03 04 00 ff ff ff ff ff ff 00 07'));
    const by = Object.fromEntries(r.values.map(v => [v.key, v.value]));
    ok('název zařízení', by.deviceName === 'JBL Tune 720BT-L');
    ok('PID z téže odpovědi', by.model === 'PID 20B4');
    ok('MAC z téže odpovědi', by.macAddress === '02:00:00:00:00:01');
  }
  // hlasove hlasky: zapis meni typ, cteni ho musi cist taky (ne jazyk)
  {
    eq('zápis hlášek jde na sub 3', a.setFrames('voicePrompt', true).frames[0],
       'aa 93 02 03 01');
    eq('čtení hlášek se ptá na sub 4', a.getFrames(['voicePrompt'])[0].frames[0],
       'aa 93 01 04');
    const r = a.ingest(H('aa 93 02 05 01'));
    ok('a přečte typ hlášek, ne jazyk',
       r.values.find(v => v.key === 'voicePrompt')?.value === true);
    const r2 = a.ingest(H('aa 93 05 02 01 00 00 05'));
    const by2 = Object.fromEntries(r2.values.map(v => [v.key, v.value]));
    ok('jazyk a verze jdou na vlastní řádky',
       by2.voicePromptLang === 1 && by2.voiceFileVersion === '0.0.5');
  }
  // Stav zarizeni 0x21/0x22 je jediny zpusob, jak z 720BT precist
  // auto vypnuti, EQ predvolbu, Multi AI a auto play. Overeno na HW.
  {
    // Zmereno na HW: jednotlive typy (0x33/0x34/0x35/0x38/0x39) firmware
    // IGNORUJE, odpovida jen souhrn 0x30. Vsechny tyhle radky se proto
    // ctou pres nej — a pri "Nacist vse" se dotaz posle jen JEDNOU.
    for (const k of ['autoPowerOff', 'eqPreset', 'multiAi', 'autoPlayPause'])
      eq(`${k} se čte souhrnným stavem`, a.getFrames([k])[0].frames[0],
         'aa 21 01 30');
    {
      const batch = a.getFrames(['autoPowerOff', 'eqPreset', 'multiAi',
                                 'autoPlayPause', 'twsStatus',
                                 'deviceStatusQuery']);
      ok('pět řádků + souhrn = jediný dotaz, ne šest', batch.length === 1);
      ok('a ten dotaz pokrývá všechny', batch[0].keys.length === 6);
    }
    ok('řádky čtené přes souhrn nejsou označené jako „jen zápis“',
       a.canObserve('autoPowerOff') && a.canObserve('twsStatus'));

    // Realny souhrn z 720BT: auto vypnuti zapnute na 30 minut.
    const r = a.ingest(H('aa 22 0d 30 00 00 9e e6 00 01 00 00 00 01 1e 00'));
    const by = Object.fromEntries(r.values.map(v => [v.key, v.value]));
    ok('ze souhrnu se přečte auto vypnutí 30 min',
       by.autoPowerOff?.on === true && by.autoPowerOff?.level === 30);
    ok('a zároveň auto play a Multi AI',
       by.autoPlayPause === false && by.multiAi === 0);

    // Odpoved na jeden typ nesmi vyplnit radky, ktere s nim nesouvisi.
    const only = a.ingest(H('aa 22 02 33 9e'));
    const keys = only.values.map(v => v.key);
    ok('odpověď typu 0x33 vyplní jen auto vypnutí',
       keys.includes('autoPowerOff') && !keys.includes('multiAi') &&
       !keys.includes('eqPreset'));
    ok('kategorie 230 se pojmenuje, ne že zůstane číslo',
       P3.eqCategoryName(230).includes('vlastní'));
  }

  // 0xA2 (EQ po pasmech) tenhle model nema — zmereno, sest dotazu bez
  // jedine odpovedi. Kodek na nej ale porad testujeme nize, protoze ho
  // pouziva Protocol 4 i pripadne dalsi modely.
  // 720BT pouziva STARSI EQ prikazy 0x41/0x42/0x43, ne novejsi 0xA2.
  {
    eq('EQ se čte podle indexu profilu',
       a.getFrames(['eqBands'], () => 4)[0].frames[0], 'aa 42 01 04');
    const prof = { index: 0, category: 4, calibration: 0, sampleRate: 0,
                   leftGain: 0, rightGain: 0,
                   bands: [{ type: 1, gain: 3, freq: 32, q: 1 },
                           { type: 1, gain: -2, freq: 16000, q: 1.4 }] };
    const w = a.setFrames('eqBands', prof);
    ok('zápis EQ jde na 0x41 s počtem paketů v hlavičce',
       w.frames[0][1] === 0x41 && w.frames[0][3] >= 1);
    // Cteni ma jine rozlozeni nez zapis (nema kalibraci) — overime
    // na ramci slozenem presne podle SDK.
    const rd = P3.frame(0x43, [0, 4, 0,
      ...[0,0,0,0], ...[0,0,0,0],           // levy a pravy zisk
      2, 0, 0, 0,                            // pocet pasem
      1,0,0,0, 0,0,0x40,0x40, 0,0,0,0x42, 0,0,0x80,0x3f,
      1,0,0,0, 0,0,0,0xc0, 0,0,0x7a,0x47, 0,0,0xb3,0x3f]);
    const got = a.ingest(rd).values.find(v => v.key === 'eqBands');
    ok('a přečtený profil má správná pásma',
       got && got.value.bands.length === 2 &&
       Math.abs(got.value.bands[0].gain - 3) < 1e-3 &&
       Math.abs(got.value.bands[1].freq - 64000) < 1);
  }

  // Dlouha odpoved se do jedne BLE notifikace nevejde a prijde po kouscich.
  // Protocol 3 nema cislo paketu, takze se to musi skladat podle delky.
  {
    const a2 = adapterFor(DEVICES.find(d => d.id === 'tune720bt'));
    // desetipasmovy profil = 4 + 16 + 100 = 120 bajtu
    const bands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
      .map((fq, i) => ({ type: 1, gain: i - 5, freq: fq, q: 1 }));
    const full = P3.eqSet({ category: 4, calibration: 0, sampleRate: 0,
                            leftGain: 0, rightGain: 0, bands });
    ok('desetipásmový EQ rámec je delší než jedna BLE notifikace',
       full.length > 100);

    // rozsekat po 20 bajtech, jak to chodi pri malem MTU
    let last = null;
    for (let i = 0; i < full.length; i += 20) {
      const part = full.subarray(i, Math.min(i + 20, full.length));
      last = a2.ingest(part);
      if (i + 20 < full.length)
        ok(`část na offsetu ${i} se jen uloží, nic se nedekóduje`,
           last.partial === true);
    }
    ok('poslední část skládání dokončí', !last.partial);
    // Rozbor uz je na protokolu — 720BT tenhle prikaz nema namapovany,
    // ale skladani musi fungovat pro kazdy dlouhy ramec.
    const whole = P3.parse(full);
    const prof = P3.eqParse(whole.payload);
    ok('a složený rámec se dekóduje celý',
       prof.bands.length === 10 &&
       Math.abs(prof.bands[9].freq - 16000) < 1e-3 &&
       Math.abs(prof.bands[9].gain - 4) < 1e-6);

    // Nedokoncena skladacka nesmi zablokovat dalsi odpovedi navzdy.
    a2.ingest(full.subarray(0, 20));
    a2.reset();
    const after = a2.ingest(H('aa 25 0d 01 00 00 50 50 ff ff ff ff ff ff ff ff'));
    ok('po reset() se čte dál normálně',
       after.values.some(v => v.key === 'batteryLeft'));
  }

  // rucni prikaz musi znat riziko i u neznameho cmd
  ok('neznámý ruční příkaz je rizikový', a.rawParse('0x6f').risk === 'medium');
  throws('ruční cmd 300 odmítnut', () => a.rawParse('300'));
}

H1('ZIP — zápis, čtení, detekce poškození');
{
  const blob = Zip.create([
    { name: 'zaloha.json', content: JSON.stringify({ a: 1 }) },
    { name: 'PREHLED.txt', content: 'diakritika ěščřžýáíé\n' },
  ]);
  const ab = await blob.arrayBuffer();
  const m = Zip.read(ab);
  ok('dva soubory v archivu', m.size === 2);
  ok('JSON přečten', JSON.parse(Zip.text(m.get('zaloha.json'))).a === 1);
  ok('diakritika zachována', Zip.text(m.get('PREHLED.txt')).includes('ěščřžýáíé'));
  const all = new Uint8Array(ab);
  const needle = new TextEncoder().encode('{"a":1}');
  let at = -1;
  outer: for (let i = 0; i + needle.length <= all.length; i++) {
    for (let k = 0; k < needle.length; k++) if (all[i + k] !== needle[k]) continue outer;
    at = i; break;
  }
  ok('data v archivu nalezena', at >= 0);
  const bad = new Uint8Array(ab.slice(0));
  bad[at + 2] ^= 0xff;
  throws('poškozená data odhalena', () => Zip.read(bad.buffer));
  throws('cizí soubor odmítnut', () => Zip.read(new Uint8Array([1, 2, 3, 4]).buffer));
}

H1('Záloha — metadata, přehled, hex');
{
  const bk = Backup.build({
    device: { id: 'tune780nc', model: 'JBL TUNE 780NC', pid: '215F',
              protocol: 4, btName: 'JBL Tune 780NC', firmware: '1.0' },
    entries: [
      { key: 'anc', label: 'Potlačení hluku (ANC)', group: 'Ambient Sound Control',
        kind: 'toggleLevel', addr: 'ID 24 · 0x0018', hex: 'e4',
        text: 'zapnuto · 100', value: { on: true, level: 100 },
        risk: null, writable: true },
      { key: 'safeMaxVolume', label: 'Strop hlasitosti', group: 'Ochrana sluchu',
        kind: 'toggleLevel', addr: 'ID 7809', hex: '90', text: 'zapnuto · 16',
        value: { on: true, level: 16 }, risk: 'high', writable: true },
    ],
    skipped: ['Auracast (ID 2950)'],
  });
  ok('formát označen', bk.format === Backup.FORMAT);
  ok('verze zálohy', bk.version === Backup.VERSION);
  ok('metadata modelu', bk.device.pid === '215F' && bk.device.protocol === 4);
  ok('spočítané obnovitelné', bk.counts.restorable === 1);
  ok('spočítané nebezpečné', bk.counts.dangerous === 1);
  const s = Backup.summary(bk);
  ok('přehled obsahuje PID', s.includes('215F'));
  ok('přehled obsahuje hodnotu', s.includes('[e4]'));
  ok('přehled označí nebezpečné', s.includes('⚠ high'));
  ok('přehled vypíše, co neodpovědělo', s.includes('Auracast (ID 2950)'));
  const hx = Backup.hexDump(bk);
  ok('hex výpis obsahuje klíč i hex', hx.includes('anc') && hx.includes('e4'));

  // hodnota ze zalohy se musi dat zapsat zpet BEZE ZMENY
  const a = adapterFor(DEVICES.find(d => d.id === 'tune780nc'));
  const back = a.setFrames('anc', bk.entries[0].value);
  ok('hodnota ze zálohy dá zpět stejný hex', back.valueHex === bk.entries[0].hex);
}

H1('Bezpečnostní pravidla — musí platit vždy');
{
  // 1. Nic nebezpecneho se nesmi obnovovat ze zalohy.
  //    (Pravidlo je v UI; tady kontrolujeme, ze mame cim ho rozhodnout.)
  const dangerousKeys = [];
  for (const dev of DEVICES) {
    const a = adapterFor(dev);
    for (const k of a.keys()) if (a.info(k).risk) dangerousKeys.push(`${dev.id}:${k}`);
  }
  ok(`nebezpečné položky jsou rozpoznané (${dangerousKeys.length})`,
     dangerousKeys.length > 0);

  // 2. Riziko z risk.js se u P4 nikdy nesmi ztratit slucovanim.
  const a780 = adapterFor(DEVICES.find(d => d.id === 'tune780nc'));
  const lowered = a780.keys().filter(k => {
    const b = a780.binding(k);
    const fromRisk = levelOf(b.id);
    return fromRisk && worstRisk(a780.info(k).risk, fromRisk) !== a780.info(k).risk;
  });
  ok(`riziko z risk.js se nikdy nesnižuje${lowered.length ? ' — ' + lowered : ''}`,
     !lowered.length);

  // 3. Tovarni reset musi byt vsude kriticky.
  for (const dev of DEVICES) {
    const a = adapterFor(dev);
    if (!a.has('factoryReset')) continue;
    ok(`${dev.model}: tovární reset je kritický`,
       a.info('factoryReset').risk === 'critical');
  }

  // 4. Vypnuti sluchatek musi byt aspon medium.
  for (const dev of DEVICES) {
    const a = adapterFor(dev);
    if (!a.has('manualPowerOff')) continue;
    ok(`${dev.model}: vypnutí je označené jako rizikové`,
       !!a.info('manualPowerOff').risk);
  }

  // 5. Puvodni pravidla nad risk.js plati dal.
  const notHidden = [...RISK.entries()]
    .filter(([, [lvl]]) => lvl === 'critical' || lvl === 'high')
    .filter(([id]) => !isHidden(id)).map(([id]) => id);
  ok(`critical/high je vždy skryté${notHidden.length ? ' — ' + notHidden : ''}`,
     !notHidden.length);
  const nt = [...NEVER_TOUCH].filter(id => levelOf(id) !== 'critical');
  ok(`NEVER_TOUCH je vždy critical${nt.length ? ' — ' + nt : ''}`, !nt.length);
  const noReason = [...RISK.keys()].filter(id => !reasonOf(id) || reasonOf(id).length < 20);
  ok(`každé riziko v risk.js má odůvodnění${noReason.length ? ' — ' + noReason : ''}`,
     !noReason.length);
  const badId = [...RISK.keys()].filter(id => !BY_ID.has(id));
  ok(`všechna riziková ID existují v SDK${badId.length ? ' — ' + badId : ''}`,
     !badId.length);

  // 6. Stejne nastaveni nesmi mit u ruznych modelu jinou uroven rizika.
  //    Presne tohle driv rozjelo smartSwitch: u 720BT medium, u 780NC nic.
  {
    // Jen zapisovatelna nastaveni: riziko se tyka zapisu, a u polozky,
    // kterou appka umi jen cist, neni pred cim varovat.
    const byKey = new Map();
    for (const dev of DEVICES) {
      const a = adapterFor(dev);
      for (const k of a.keys()) {
        if (!a.canWrite(k)) continue;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push([dev.id, a.info(k).risk || null]);
      }
    }
    const drift = [...byKey.entries()]
      .filter(([, list]) => list.length > 1 &&
        new Set(list.map(([, r]) => String(r))).size > 1)
      .map(([k, list]) => `${k}: ${list.map(([d, r]) => `${d}=${r}`).join(', ')}`);
    ok(`riziko je u všech modelů stejné${drift.length
        ? '\n          — ' + drift.join('\n          — ') : ''}`, !drift.length);
  }

  // 7. Co nejde precist zpatky, na to musi appka umet upozornit.
  //    Neni to uroven rizika — vratit to porad jde zapsanim znameho stavu —
  //    ale uzivatel to musi vedet PRED odeslanim.
  ok('varování pro zápis bez čtení je definované',
     typeof WRITE_ONLY_WARNING === 'string' && WRITE_ONLY_WARNING.length > 40);
  {
    // Seznam je zamerne vypsany rucne: kdyz nekdo pozdeji doplni cteni,
    // test spadne a donuti ho to overit, ze odpoved fakt chodi.
    const expected = new Set([
      'tune780nc:ascMaster', 'tune780nc:audioSignalDetect',
      'tune720bt:manualPowerOff', 'tune720bt:earTest',
    ]);
    const actual = new Set();
    for (const dev of DEVICES) {
      const a = adapterFor(dev);
      for (const k of a.keys())
        if (a.canWrite(k) && !a.canRead(k)) actual.add(`${dev.id}:${k}`);
    }
    const extra = [...actual].filter(x => !expected.has(x));
    const gone = [...expected].filter(x => !actual.has(x));
    ok(`seznam zápisů bez čtení se nezměnil${extra.length ? ' — přibylo ' + extra : ''}` +
       `${gone.length ? ' — ubylo ' + gone : ''}`, !extra.length && !gone.length);
  }

  // 8. Ruční zápis na neznámou adresu je vždy aspoň medium — u OBOU protokolů.
  for (const dev of DEVICES) {
    const a = adapterFor(dev);
    const unknownAddr = dev.protocol === 4 ? '0xFFFE' : '0x6f';
    const info = a.rawParse(unknownAddr);
    ok(`${dev.model}: ruční zápis na neznámou adresu je rizikový`,
       !!info.risk && info.why.length > 10);
  }

  // 9. Kazda uroven rizika ma popisek do UI.
  ok('všechny úrovně rizika mají popisek',
     ['medium', 'high', 'critical'].every(l => !!RISK_LABEL[l]));

  // 7. Registr funkci se nerozpadl.
  ok('240 funkcí', FEATURES.length === 240);
  ok('žádné duplicitní ID', new Set(FEATURES.map(f => f.id)).size === FEATURES.length);
}

H1('Tvrdá pojistka — destruktivní sekvence nesmí odejít NIKDY');
{
  const blocked = (proto, hexStr) => Guard.inspect(proto, H(hexStr)).blocked;

  // --- Protocol 3 ---
  ok('P3: tovární reset 0x95 zastaven', blocked(3, 'aa 95 00'));
  ok('P3: zastaven i s payloadem', blocked(3, 'aa 95 01 01'));
  ok('P3: běžný příkaz projde', !blocked(3, 'aa 31 01 01'));

  // --- Protocol 4 ---
  const set = (id, val) => P.hex(P.buildFrames(P.CMD.SET_DEVICE_INFO,
    P.encodeSet(id, Uint8Array.from(val)))[0]);
  const get = ids => P.hex(P.buildFrames(P.CMD.GET_DEVICE_INFO,
    P.encodeGet(ids))[0]);

  ok('P4: zápis továrního resetu (ID 15) zastaven', blocked(4, set(15, [])));
  ok('P4: příkaz 0x00FF zastaven',
     blocked(4, P.hex(P.buildFrames(P.CMD.RESET_TO_FACTORY, new Uint8Array(0))[0])));
  ok('P4: zápis BLE adresy hostitele zastaven', blocked(4, set(51, [1, 2, 3, 4, 5, 6])));
  ok('P4: zápis autentizace zastaven', blocked(4, set(62, [1])));
  ok('P4: odpárování zastaveno', blocked(4, set(2980, [1, 2, 3, 4, 5, 6, 1])));
  ok('P4: zápis PINu ochrany sluchu zastaven', blocked(4, set(7812, [1, 2, 3, 4])));
  ok('P4: OTA režim zastaven i při ČTENÍ', blocked(4, get([7936])));
  ok('P4: OTA režim zastaven i uprostřed dávky', blocked(4, get([24, 25, 7936, 26])));
  ok('P4: běžný zápis projde', !blocked(4, set(24, [0x81])));
  ok('P4: běžné čtení projde', !blocked(4, get([24, 25, 26])));
  // Cteni featur, ktere jsou zakazane jen pro zapis, blokovat nechceme —
  // GET nic nemeni a je z nej videt, co v zarizeni je.
  ok('P4: čtení továrního resetu se neblokuje (nic nemění)', !blocked(4, get([15])));

  // Poskozeny paket nesmi byt cestou, jak zakazane ID propasovat.
  ok('P4: zakázané ID projde i v rozbitém TLV',
     blocked(4, '00 dd 02 00 01 00 02 00 0f 00'));

  // Kazda polozka musi mit duvod, at log neni jen "zablokovano".
  for (const proto of [3, 4]) {
    const bad = Guard.forbiddenList(proto)
      .filter(f => !f.name || !f.why || f.why.length < 20);
    ok(`P${proto}: každá zablokovaná položka má vysvětlení${bad.length
        ? ' — ' + bad.map(f => f.addr) : ''}`, !bad.length);
  }

  // Pojistka nesmi jit vypnout — modul nesmi exportovat nic, cim by se
  // dala prebit. Kdyby nekdo pridal "arm" nebo "disable", test spadne.
  const escapes = Object.keys(Guard)
    .filter(k => !['classify', 'inspect', 'forbiddenList',
                   'PROTECTED_PROTOCOLS'].includes(k));
  ok(`pojistka nemá žádný vypínač${escapes.length ? ' — ' + escapes : ''}`,
     !escapes.length);

  // Pojistka musi platit pro KAZDY model, ne jen pro ty dva dnesni.
  for (const dev of DEVICES)
    ok(`${dev.model}: protokol ${dev.protocol} má bezpečnostní pravidla`,
       Guard.PROTECTED_PROTOCOLS.has(dev.protocol));

  // Neznamy protokol nesmi projit — pojistka je fail-closed.
  ok('neznámý protokol neodešle nic', Guard.inspect(9, H('aa 40 01 03')).blocked);
  ok('a řekne proč', (Guard.inspect(9, H('aa 40 01 03')).why || '').length > 30);

  // Kazdy chraneny protokol musi mit aspon jedno pravidlo — prazdny
  // seznam by znamenal pojistku, ktera nic nechyta.
  for (const proto of Guard.PROTECTED_PROTOCOLS)
    ok(`protokol ${proto} má neprázdný seznam zakázaných sekvencí`,
       Guard.forbiddenList(proto).length > 0);

  // A co je zablokovane, nesmi byt zaroven v mapovani — jinak by v UI
  // bylo tlacitko, ktere umi jen selhat.
  for (const dev of DEVICES) {
    const a = adapterFor(dev);
    const offered = [];
    for (const k of a.keys()) {
      if (!a.canWrite(k)) continue;
      let frames;
      try { frames = a.setFrames(k, sampleFor(a.info(k))).frames; } catch { continue; }
      if (frames.some(fr => Guard.classify(dev.protocol, fr))) offered.push(k);
    }
    ok(`${dev.model}: UI nenabízí nic, co pojistka stejně zastaví${offered.length
        ? ' — ' + offered : ''}`, !offered.length);
  }
}

H1('Průzkum — smí se jen ptát, nikdy zapisovat');
{
  // Seznamy dotazu jsou hlavni nastroj na zjisteni, co firmware umi.
  // Kdyby se do nich vloudil zapis, pruzkum by menil nastaveni — presne to,
  // co nikdo necheka od tlacitka, ktere slibuje jen cteni.
  for (const dev of DEVICES) {
    const a = adapterFor(dev);
    const cands = a.probeCandidates();
    ok(`${dev.model}: seznam dotazů není prázdný`, cands.length > 0);

    const noFrames = cands.filter(c => !c.frames?.length);
    ok(`${dev.model}: každý dotaz má rámec${noFrames.length
        ? ' — ' + noFrames.map(c => c.label) : ''}`, !noFrames.length);

    const writes = [];
    for (const c of cands) {
      for (const fr of c.frames) {
        // Pojistka musi kazdy dotaz pustit — pruzkum nesmi nic zastavit.
        if (Guard.classify(dev.protocol, fr))
          writes.push(`${c.label} (zastaví pojistka)`);
        if (dev.protocol === 4) {
          const f = P.parseFrame(fr);
          if (f && f.commandId !== P.CMD.GET_DEVICE_INFO)
            writes.push(`${c.label} (není GET_DEVICE_INFO)`);
        } else if ([0x40, 0x41, 0x81, 0x95, 0x97].includes(fr[1])) {
          writes.push(`${c.label} (zapisovací cmd 0x${fr[1].toString(16)})`);
        } else if (fr[1] === 0x51 && fr[4] === 0) {
          writes.push(`${c.label} (Safe Sound SET)`);
        }
      }
    }
    ok(`${dev.model}: v průzkumu není jediný zápis${writes.length
        ? ' — ' + writes.join(', ') : ''}`, !writes.length);

    const seen = new Set(), dup = [];
    for (const c of cands) {
      const k = c.frames.map(f => P.hex(f)).join('|');
      if (seen.has(k)) dup.push(c.label); else seen.add(k);
    }
    ok(`${dev.model}: žádný dotaz se neposílá dvakrát${dup.length
        ? ' — ' + dup : ''}`, !dup.length);
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(52)}`);
console.log(fail ? `SELHALO ${fail} testů, prošlo ${pass}` : `VŠECH ${pass} TESTŮ PROŠLO`);
process.exit(fail ? 1 : 0);
