// ---------------------------------------------------------------------------
// Aplikacni vrstva — jedna a tatáž pro vsechny modely.
//
// Nezná zadny protokol. Vsechno jde pres adapter (proto/*.js) a katalog
// (catalog.js). Ktera nastaveni existuji, urcuje mapovani (devices/*.js);
// co v mapovani neni, se nevykresli.
//
// Pravidla, ktera plati vzdy:
//   - GET nikdy nic nezapisuje
//   - kazdy zapis projde potvrzenim s presnym "z ceho na co"
//   - nebezpecne polozky jsou zamcene a nikdy se neobnovuji ze zalohy
//   - posila se postupne s pauzami, aby se sluchatka nezahltila
// ---------------------------------------------------------------------------

import { TABS, GROUPS, SETTINGS, GROUP_BY_KEY, RISK_LABEL, WRITE_ONLY_WARNING }
  from './catalog.js';
import { DEVICES, adapterFor, resolve as resolveDevice } from './devices/index.js';
import * as BLE from './ble.js';
import { parseHex } from './protocol.js';
import { makeControl } from './core/controls.js';
import { confirmWrite, toHex } from './core/confirm.js';
import * as Backup from './core/backup.js';
import * as Guard from './core/guard.js';
import * as Server from './serverstatus.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ===========================================================================
// stav
// ===========================================================================

const profile = resolveDevice(
  new URLSearchParams(location.search).get('dev') ||
  localStorage.getItem('jbl.device'));
const adapter = adapterFor(profile);

/** key -> { raw, value, text, at } — posledni prectena hodnota. */
const values = new Map();
/** key -> ovladaci prvky a mista v UI. */
const rows = new Map();
/** klice, na ktere zarizeni nekdy odpovedelo / neodpovedelo. */
const answered = new Set();
const missing = new Set();

const S = { dev: null, wr: null, nt: null, busy: false, unlocked: false,
            waiter: null, lastTimeout: false };

document.documentElement.style.setProperty('--accent', profile.accent);
document.title = `${profile.model} — ovládání`;

// ===========================================================================
// log
// ===========================================================================

const logEl = $('log');

function log(msg, cls = '') {
  const d = new Date();
  const t = d.toLocaleTimeString('cs-CZ', { hour12: false }) + '.' +
            String(d.getMilliseconds()).padStart(3, '0');
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = `${t}  ${msg}`;
  logEl.appendChild(line);
  while (logEl.childElementCount > 2000) logEl.firstChild.remove();
  logEl.scrollTop = logEl.scrollHeight;
  return line;
}

function setLog(on) {
  document.body.classList.toggle('log-off', !on);
  $('btnLog').textContent = on ? 'Log ▼' : 'Log ▲';
  localStorage.setItem('jbl.log', on ? '1' : '0');
}
$('btnLog').onclick = () => setLog(document.body.classList.contains('log-off'));
$('btnClear').onclick = () => { logEl.textContent = ''; };

// ===========================================================================
// odesilani
// ===========================================================================

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Rozestup mezi zapisy pri hromadne obnove — schvalne vetsi nez u GETu. */
const BULK_WRITE_PAUSE = 400;

function connected() {
  return !!S.wr && !!S.dev?.gatt?.connected;
}

/**
 * JEDINE misto, kudy jde bajt do sluchatek.
 *
 * Vsechno — tlacitka, obnova zalohy, rucni prikaz i konzole — konci tady.
 * Destruktivni sekvence se zastavi bez ohledu na to, kdo je poslal a jak
 * se cestou jmenovaly. Nejde to nicim prebit.
 *
 * Vraci true, kdyz vsechny ramce odesly.
 */
// Namespace ES modulu je zapecetenym objektem, takze Guard.inspect prepsat
// nejde (ve strict rezimu to hodi TypeError, jinak se to tise zahodi).
// Presto si funkci drzime i v lokalni konstante — at je pojistka nezavisla
// i na tom, jak se modul jednou treba zabali nebo prebali.
const inspectFrame = Guard.inspect;

async function writeGuarded(frames, label) {
  for (const fr of frames) {
    const v = inspectFrame(adapter.protocol, fr);
    if (v.blocked) {
      log(`ZASTAVENO POJISTKOU — ${v.name} (${v.addr})`, 'er');
      log(`  ${v.why}`, 'er');
      log(`  Nedeslo: ${toHex(fr)}`, 'er');
      log(`  Tenhle příkaz je zablokovaný natrvalo a nejde odemknout ` +
          `— ani z konzole, ani ze zálohy.`, 'er');
      return false;
    }
    log(`TX  ${toHex(fr)}${label ? '   ← ' + label : ''}`, 'tx');
    await BLE.writeFrame(S.wr, fr);
  }
  return true;
}

/**
 * Zapise ramce a pocka na odpoved (nebo timeout).
 * Vraci true, kdyz neco prislo.
 */
async function request(frames, label, timeout = 2500) {
  if (!connected()) { log('nepřipojeno', 'er'); return false; }
  while (S.busy) await sleep(25);
  S.busy = true;
  try {
    // Po timeoutu muze odpoved dorazit se zpozdenim. Kdybychom hned poslali
    // dalsi dotaz, opozdena odpoved by "dokoncila" ten novy.
    if (S.lastTimeout) { await sleep(400); S.lastTimeout = false; }

    const got = new Promise(res => {
      S.waiter = res;
      setTimeout(() => {
        if (S.waiter === res) { S.waiter = null; S.lastTimeout = true; res(false); }
      }, timeout);
    });
    if (!await writeGuarded(frames, label)) { S.waiter = null; return false; }
    return await got;
  } catch (e) {
    log(`CHYBA zápisu: ${e.message}`, 'er');
    return false;
  } finally { S.busy = false; }
}

/** Zapise ramce bez cekani na odpoved, jen s pauzou. */
async function fire(frames, label) {
  if (!connected()) { log('nepřipojeno', 'er'); return false; }
  while (S.busy) await sleep(25);
  S.busy = true;
  try {
    if (!await writeGuarded(frames, label)) return false;
    await sleep(adapter.pauseMs);
    return true;
  } catch (e) {
    log(`CHYBA zápisu: ${e.message}`, 'er');
    return false;
  } finally { S.busy = false; }
}

function onNotify(ev) {
  const buf = new Uint8Array(ev.target.value.buffer).slice();
  log(`RX  ${toHex(buf)}`, 'rx');
  if (probeSink) probeSink.got.push(toHex(buf));
  let res;
  try { res = adapter.ingest(buf); }
  catch (e) { log(`  rozbor selhal: ${e.message}`, 'er'); return; }

  for (const l of res.lines) log('  ' + l.text, l.cls || 'dim');
  for (const v of res.values) applyValue(v);

  // Dlouha odpoved (EQ profil) prijde po kouscich. Dokud neni cela,
  // nesmime cekani ukoncit — jinak bychom poslali dalsi dotaz doprostred
  // prijmu a zbytek by dorazil "mimo poradi".
  if (res.partial) return;
  if (S.waiter) { const r = S.waiter; S.waiter = null; r(true); }
}

/** Ulozi prectenou hodnotu a promitne ji do UI. Nic neodesila. */
function applyValue({ key, raw, value, text }) {
  const at = new Date();
  values.set(key, { raw, value, text, at });
  answered.add(key);
  missing.delete(key);
  const row = rows.get(key);
  if (!row) return;
  row.showValue(text, raw, at);
  row.setState('ok');
  // Predvyplneni ovladace prectenou hodnotou — aby uzivatel menil
  // hodnotu relativne k tomu, co v zarizeni opravdu je.
  if (row.control && value !== null && value !== undefined) {
    try { row.control.fill(value); } catch {}
  }
}

// ===========================================================================
// cteni
// ===========================================================================

/** Parametr dotazu z ovladace daneho radku (napr. kategorie EQ profilu). */
const paramOf = key => {
  try { return rows.get(key)?.control?.param?.(); } catch { return undefined; }
};

/** Precte jedno nastaveni. */
async function readOne(key) {
  const batches = adapter.getFrames([key], paramOf);
  if (!batches.length) return false;
  const info = adapter.info(key);
  let any = false;
  for (const b of batches)
    any = await request(b.frames, `GET ${info.setting.label}`) || any;
  if (!any) markMissing([key]);
  return any;
}

function markMissing(keys) {
  for (const k of keys) {
    if (answered.has(k)) continue;
    missing.add(k);
    rows.get(k)?.setState('miss');
  }
}

/**
 * Precte seznam nastaveni po davkach s pauzami.
 * Nic nezapisuje — jen se pta.
 */
async function readMany(keys, label, { fresh = false } = {}) {
  const list = keys.filter(k => adapter.canRead(k));
  if (!list.length) { log(`${label}: není co číst`, 'warn'); return { ok: 0, total: 0 }; }
  if (fresh) list.forEach(k => { values.delete(k); answered.delete(k); missing.delete(k); });

  const prog = $('progress');
  const size = adapter.batchSize;
  let done = 0, ok = 0;

  for (let i = 0; i < list.length; i += size) {
    if (!connected()) {
      log(`${label} PŘERUŠENO — spojení se rozpadlo po ${done} z ${list.length}.`, 'er');
      break;
    }
    const chunk = list.slice(i, i + size);
    prog.textContent = `${label}: ${done}/${list.length}…`;
    prog.className = 'progress on';

    for (const b of adapter.getFrames(chunk, paramOf)) {
      const names = b.keys.map(k => adapter.info(k).setting.label).join(', ');
      const got = await request(b.frames, `${label} — ${names}`);
      if (got) ok++;
      await sleep(adapter.pauseMs);
    }
    done += chunk.length;
    markMissing(chunk);
  }

  const answeredN = list.filter(k => answered.has(k)).length;
  prog.textContent = `${label}: odpovědělo ${answeredN} z ${list.length}`;
  prog.className = 'progress';
  log(`${label}: zařízení odpovědělo na ${answeredN} z ${list.length} nastavení.`,
      answeredN ? 'rx' : 'warn');
  if (answeredN < list.length)
    log(`  Šedě/červeně označené položky tenhle model nepodporuje — ` +
        `nejsou rozbité, jen tam nejsou.`, 'dim');
  return { ok: answeredN, total: list.length };
}

// ===========================================================================
// zapis
// ===========================================================================

/** Jednotna pojistka pred kazdym zapisem. */
async function writeSetting(key, value) {
  const info = adapter.info(key);
  if (!info) return false;
  const label = info.setting.label;

  if (!adapter.canWrite(key)) {
    log(`ODMÍTNUTO — ${label} je jen ke čtení`, 'er');
    return false;
  }
  if ((info.risk === 'high' || info.risk === 'critical') && !S.unlocked) {
    log(`ZABLOKOVÁNO: ${label} — ${info.why}`, 'er');
    log('  Zapni vpravo nahoře „rizikové zápisy“, pokud to opravdu chceš.', 'er');
    return false;
  }

  const prev = values.get(key);
  let built;
  try { built = adapter.setFrames(key, value, prev?.raw); }
  catch (e) { log(`ODMÍTNUTO — ${label}: ${e.message}`, 'er'); return false; }

  // U zapisu, ktery nejde precist zpet, to musi byt videt PRED odeslanim.
  const canSee = adapter.canObserve ? adapter.canObserve(key) : adapter.canRead(key);
  const notes = [info.setting.desc || '', canSee ? '' : WRITE_ONLY_WARNING]
    .filter(Boolean).join('  ');

  // U nekterych prikazu se zapisuje na jine cislo, nez pod kterym se cte
  // (720BT: kodek se cte 0x82, zapisuje 0x81). V potvrzeni musi byt to,
  // co opravdu odejde — jinak by hlavicka lhala o tom, co se posila.
  const wireTag = adapter.protocol === 3 && built.frames[0]?.length > 1
    ? `zápis cmd 0x${built.frames[0][1].toString(16).padStart(2, '0')}`
    : info.addr;

  const ok = await confirmWrite({
    name: label,
    tag: `${wireTag}${info.detail ? ' · ' + info.detail : ''}`,
    from: prev ? { text: prev.text, hex: toHex(prev.raw) }
               : (canSee ? null : { text: 'nelze přečíst', hex: '' }),
    to: { text: built.valueText, hex: built.valueHex },
    range: info.range,
    bytes: built.frames[0],
    note: notes,
    risk: info.risk,
    reason: info.risk ? info.why : '',
  });
  if (!ok) { log(`zápis ${label} zrušen`, 'warn'); return false; }

  if (info.risk) log(`POTVRZEN rizikový zápis: ${label} (${info.addr})`, 'er');
  await fire(built.frames, `SET ${label}`);

  // Po zapisu si prectem, co v zarizeni opravdu je.
  if (adapter.canRead(key)) { await sleep(150); await readOne(key); }
  return true;
}

// ===========================================================================
// stavba UI
// ===========================================================================

const nav = $('tabs'), content = $('content');
const panes = new Map();

function makePane(tabName) {
  const btn = document.createElement('button');
  btn.textContent = tabName;
  const pane = document.createElement('div');
  pane.className = 'pane';
  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = tabName;
  const grid = document.createElement('div');
  grid.className = 'grid';
  pane.append(title, grid);
  nav.appendChild(btn);
  content.appendChild(pane);
  btn.onclick = () => {
    for (const [, p] of panes) { p.btn.classList.remove('active'); p.pane.classList.remove('active'); }
    btn.classList.add('active'); pane.classList.add('active');
    content.scrollTop = 0;
    localStorage.setItem('jbl.tab', tabName);
  };
  const rec = { btn, pane, grid, count: 0 };
  panes.set(tabName, rec);
  return rec;
}

for (const t of TABS) makePane(t);

/** Postavi jeden radek nastaveni. */
function buildRow(key) {
  const info = adapter.info(key);
  const setting = info.setting;
  const writable = adapter.canWrite(key);
  const readable = adapter.canRead(key);
  // "Jde hodnotu vubec zjistit" neni totez jako "ma vlastni dotaz" —
  // nektere radky se plni z odpovedi na jiny dotaz.
  const observable = adapter.canObserve ? adapter.canObserve(key) : readable;

  const row = document.createElement('div');
  row.className = 'row';
  row.dataset.search = `${setting.label} ${key} ${info.addr}`.toLowerCase();

  // --- sloupec 1: tecka + nazev + technicke udaje ---
  const head = document.createElement('div');
  head.className = 'rhead';

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.title = 'Zatím nezjištěno — dej GET nebo „Načíst vše“.';
  head.appendChild(dot);

  const nameBox = document.createElement('div');
  nameBox.className = 'nbox';
  const nm = document.createElement('div');
  nm.className = 'nm';
  nm.textContent = setting.label;
  // Riziko se tyka ZAPISU. U radku, ktery jde jen cist, neni pred cim
  // varovat — stitek by tam byl jen strasak.
  if (info.risk && writable) {
    const p = document.createElement('span');
    p.className = 'pill ' + (info.risk === 'medium' ? 'w' : 'n');
    p.textContent = RISK_LABEL[info.risk];
    p.title = info.why;
    nm.appendChild(p);
  }
  if (!observable) {
    const p = document.createElement('span');
    p.className = 'pill';
    p.textContent = 'jen zápis';
    p.title = 'Tohle nastavení se nedá přečíst — hodnotu ze sluchátek nezjistíš.';
    nm.appendChild(p);
  }
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = `${info.addr}${info.detail ? ' · ' + info.detail : ''}` +
                     `${info.rw ? ' · ' + info.rw : ''}` +
                     `${writable ? ' · ' + info.range : ''}`;
  nameBox.append(nm, meta);
  head.appendChild(nameBox);
  row.appendChild(head);

  // --- sloupec 2: hodnota prectena ze sluchatek ---
  const now = document.createElement('div');
  now.className = 'now';
  now.innerHTML = '<span class="v">—</span>';
  row.appendChild(now);

  // --- sloupec 3: ovladace ---
  const tools = document.createElement('div');
  tools.className = 'tools';

  let control = null;
  if (writable) {
    control = makeControl(info.kind, setting, parseHex);
    if (control) tools.appendChild(control.el);
  }

  if (readable) {
    const g = document.createElement('button');
    g.className = 'sm ghost act';
    g.textContent = 'GET';
    g.title = 'Přečte aktuální hodnotu. Nic nezapisuje.';
    g.disabled = true;
    g.onclick = () => readOne(key);
    tools.appendChild(g);
  }

  if (writable && control) {
    const s = document.createElement('button');
    s.className = 'sm set act';
    s.textContent = info.kind === 'action' ? 'SPUSTIT' : 'SET';
    s.disabled = true;
    const locked = info.risk === 'high' || info.risk === 'critical';
    if (locked) {
      s.classList.add('danger-hidden');
      s.textContent += ' ⚠';
      s.title = info.why;
      const ph = document.createElement('span');
      ph.className = 'pill n danger-shown';
      ph.textContent = 'zamčeno';
      ph.title = info.why;
      tools.appendChild(ph);
    } else if (info.risk) s.title = info.why;
    s.onclick = () => {
      const r = control.read();
      if (r.error) return log(`ODMÍTNUTO — ${setting.label}: ${r.error}`, 'er');
      writeSetting(key, r.value);
    };
    tools.appendChild(s);
  }
  row.appendChild(tools);

  if (setting.desc) {
    const h = document.createElement('div');
    h.className = 'hint';
    h.textContent = setting.desc;
    row.appendChild(h);
  }

  const api = {
    el: row, control,
    setState(state) {
      row.classList.remove('is-ok', 'is-miss');
      if (state === 'ok') {
        row.classList.add('is-ok');
        dot.className = 'dot ok';
        dot.title = 'Sluchátka na tohle odpověděla — nastavení funguje.';
      } else if (state === 'miss') {
        row.classList.add('is-miss');
        dot.className = 'dot miss';
        dot.title = 'Sluchátka neodpověděla — tenhle model to nejspíš nemá.';
      } else {
        dot.className = 'dot';
        dot.title = 'Zatím nezjištěno — dej GET nebo „Načíst vše“.';
      }
    },
    showValue(text, raw, at) {
      const t = at.toLocaleTimeString('cs-CZ', { hour12: false });
      now.className = 'now has';
      now.innerHTML = `<span class="v">${esc(text)}</span>` +
                      `<span class="when">${t}</span>`;
      now.title = `${text}\n[${toHex(raw) || 'prázdné'}]\npřečteno ${t}`;
    },
  };
  rows.set(key, api);
  return api;
}

/** Postavi karty podle katalogu — jen pro nastaveni, ktera model má. */
function buildCards() {
  for (const g of GROUPS) {
    const keys = SETTINGS.filter(s => s.group === g.key && adapter.has(s.key))
                         .map(s => s.key);
    if (!keys.length) continue;      // co model nemá, se nezobrazí vůbec

    const paneRec = panes.get(g.tab) || panes.get(TABS[0]);
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.group = g.key;

    const h = document.createElement('h3');
    h.innerHTML = `<span>${esc(g.title)}</span>`;
    if (profile.officialGroups && !profile.officialGroups.includes(g.key)) {
      const p = document.createElement('span');
      p.className = 'pill';
      p.textContent = 'není v JBL appce';
      p.title = 'Firmware to umí, ale oficiální appka pro tenhle model ' +
                'nemá kartu — vrátit to půjde jen odsud.';
      h.appendChild(p);
    }
    h.appendChild(Object.assign(document.createElement('span'), { className: 'grow' }));

    const cnt = document.createElement('span');
    cnt.className = 'cardcount';
    cnt.textContent = `${keys.length}`;
    h.appendChild(cnt);

    const readable = keys.filter(k => adapter.canRead(k));
    if (readable.length) {
      const rd = document.createElement('button');
      rd.className = 'sm ghost act';
      rd.textContent = 'načíst';
      rd.title = 'Přečte celou kartu. Nic nezapisuje.';
      rd.disabled = true;
      rd.onclick = () => readMany(readable, g.title);
      h.appendChild(rd);
    }
    card.appendChild(h);

    const body = document.createElement('div');
    body.className = 'body';
    if (g.note) {
      const n = document.createElement('p');
      n.className = 'note';
      n.textContent = g.note;
      body.appendChild(n);
    }
    for (const k of keys) body.appendChild(buildRow(k).el);
    card.appendChild(body);
    paneRec.grid.appendChild(card);
    paneRec.count += keys.length;
  }

  // Prazdne zalozky se schovaji — u 720BT tim zmizi treba celé Připojení.
  for (const [name, rec] of panes)
    if (!rec.count) { rec.btn.style.display = 'none'; rec.pane.style.display = 'none'; }
}

// ===========================================================================
// pripojeni
// ===========================================================================

function setConnected(on) {
  $('btnConnect').disabled = on;
  $('btnDisconnect').disabled = !on;
  document.querySelectorAll('.act').forEach(b => b.disabled = !on);
}

const setConn = (t, c = '') => {
  $('conn').textContent = t;
  $('conn').className = 'conn ' + c;
};

function onDisconnected() {
  setConn('odpojeno', 'err');
  setConnected(false);
  S.wr = S.nt = null;
  adapter.reset();
  log('zařízení odpojeno', 'warn');
}

async function doConnect(device = null) {
  setLog(true);
  setConn('připojuji…');
  try {
    const r = await BLE.connect({
      service: adapter.service, device,
      acceptAll: $('allDevices').checked,
      onNotify, onDisconnect: onDisconnected, log,
    });
    S.dev = r.dev; S.wr = r.write; S.nt = r.notify;
    setConn(`připojeno: ${S.dev.name || 'zařízení'}`, 'on');
    setConnected(true);
    refreshDiag();
    log('Připojeno. Dej „Načíst vše“ — zeleně se označí, co sluchátka umí.', 'warn');
  } catch (e) {
    setConn('nepřipojeno', 'err');
    const [what, how] = e.human || [e.message, ''];
    log(`NEPŘIPOJENO — ${what}`, 'er');
    if (how) log(`  ${how}`, 'er');
  }
}

$('btnConnect').onclick = () => doConnect();
$('btnDisconnect').onclick = () => { if (S.dev?.gatt.connected) S.dev.gatt.disconnect(); };

// Prohlizec drzi GATT spojeni i po zavreni nebo obnoveni stranky. Pri dalsim
// spusteni pak hlasi, ze je zarizeni obsazene. Proto se odpojujeme sami.
// pagehide chyta i F5 a zavreni panelu, kde uz beforeunload nemusi dojet.
for (const ev of ['pagehide', 'beforeunload']) {
  window.addEventListener(ev, () => {
    try { if (S.dev?.gatt?.connected) S.dev.gatt.disconnect(); } catch {}
  });
}

const diagList = $('diagList');
function refreshDiag() {
  BLE.renderDiagnostics(diagList, { onReconnect: d => doConnect(d) });
}

// ===========================================================================
// načíst vše
// ===========================================================================

$('btnReadAll').onclick = async () => {
  setLog(true);
  const keys = adapter.keys().filter(k => adapter.canRead(k));
  log(`Načítám ${keys.length} nastavení po ${adapter.batchSize} ` +
      `s pauzou ${adapter.pauseMs} ms…`, 'warn');
  await readMany(keys, 'Načtení všeho', { fresh: true });
  const ok = keys.filter(k => answered.has(k)).length;
  log(`Hotovo. Zeleně označená nastavení (${ok}) jsou ta, která tenhle kus ` +
      `opravdu podporuje.`, 'rx');
};

// ===========================================================================
// průzkum — co všechno firmware umí
// ===========================================================================

/**
 * Posle KAZDY cteci dotaz, ktery protokol zna, a zapise, na co prislo
 * odpoved. Nic nezapisuje — je to jen dotazovani.
 *
 * Smysl: mapovani v devices/*.js je odvozene ze SDK, ale co konkretni kus
 * opravdu umi, rekne jen zarizeni samo.
 */
async function runProbe(otherAdapter, label) {
  const ad = otherAdapter || adapter;
  const cands = ad.probeCandidates?.() || [];
  if (!cands.length) return [];

  log(`${label}: zkouším ${cands.length} čtecích dotazů. ` +
      `Nic se nezapisuje.`, 'warn');
  const results = [];
  const prog = $('progress');

  for (let i = 0; i < cands.length; i++) {
    if (!connected()) { log(`${label} PŘERUŠENO — spojení se rozpadlo.`, 'er'); break; }
    const c = cands[i];
    prog.textContent = `${label}: ${i + 1}/${cands.length}…`;
    prog.className = 'progress on';

    probeSink = { got: [] };
    const answered = await request(c.frames, `${label} — ${c.label}`, 1400);
    const replies = probeSink.got;
    probeSink = null;

    results.push({ label: c.label, note: c.note || '',
                   sent: c.frames.map(toHex).join(' | '),
                   answered, replies });
    if (answered)
      log(`  ODPOVĚĎ  ${c.label}`, 'rx');
    await sleep(90);
  }

  const ok = results.filter(r => r.answered);
  prog.className = 'progress';
  prog.textContent = `${label}: odpovědělo ${ok.length} z ${results.length}`;
  log(`${label} hotový: odpovědělo ${ok.length} z ${results.length}.`, 'rx');
  for (const r of ok) log(`   ${r.label.padEnd(42)} ${r.replies[0] || ''}`, 'dim');
  return results;
}

/** Kam si průzkum odkládá syrové odpovědi. null = průzkum neběží. */
let probeSink = null;

$('btnProbe').onclick = async () => {
  if (!connected()) return log('Nejdřív se připoj.', 'er');
  setLog(true);
  const all = [];
  const own = await runProbe(null, `Průzkum ${adapter.protocolLabel}`);
  all.push({ protocol: adapter.protocol, results: own });

  // Druhy protokol jen kdyz si o to uzivatel rekne. Odpovedi se NEZAPISUJI
  // do hodnot — cizi protokol se v tomhle adapteru stejne nerozebere,
  // takze uz prectene hodnoty nemuze nic prepsat.
  if ($('probeOther').checked) {
    const other = DEVICES.find(d => d.protocol !== profile.protocol);
    if (other) {
      log('', 'dim');
      log(`EXPERIMENT: zkouším dotazy z ${other.protocol === 4 ? 'Protocolu 4'
          : 'Protocolu 3'}. Odpovědi se jen zapíšou do logu — ` +
          `do nastavení nesahají.`, 'warn');
      const oa = adapterFor(other);
      const res = await runProbe(oa, 'Průzkum druhého protokolu');
      all.push({ protocol: oa.protocol, results: res, experimental: true });
    }
  }

  const report = Backup.probeReport({
    device: { model: profile.model, pid: profile.pid,
              protocol: profile.protocol, btName: S.dev?.name || null },
    groups: all,
  });
  log(`Zpráva z průzkumu uložena: ${report}`, 'rx');
};

// ===========================================================================
// záloha a obnova
// ===========================================================================

$('btnBackup').onclick = async () => {
  if (!connected()) return log('Nejdřív se připoj.', 'er');
  setLog(true);
  const keys = adapter.keys().filter(k => adapter.canRead(k));
  log(`Záloha: čtu ${keys.length} nastavení…`, 'warn');
  await readMany(keys, 'Záloha', { fresh: true });

  const entries = [];
  const skipped = [];
  const secrets = [];
  // Prochazime VSECHNA nastaveni, ne jen ta, na ktera jsme se ptali —
  // nektere radky se plni z odpovedi vyvolane jinym radkem a jinak by
  // v zaloze chybely.
  for (const key of adapter.keys()) {
    if (!values.has(key) && !keys.includes(key)) continue;
    const info = adapter.info(key);
    const v = values.get(key);
    if (!v) { skipped.push(`${info.setting.label} (${info.addr})`); continue; }
    // Kriticke polozky jsou identita a zamky (PIN, adresy, autentizace).
    // Obnovit je stejne nejde nikdy, takze je nema smysl psat do souboru,
    // ktery ti pak lezi na disku v otevrenem hexu.
    if (info.risk === 'critical') {
      secrets.push(`${info.setting.label} (${info.addr})`);
      continue;
    }
    entries.push({
      key,
      label: info.setting.label,
      group: GROUP_BY_KEY.get(info.setting.group)?.title || info.setting.group,
      kind: info.kind,
      addr: info.addr,
      hex: toHex(v.raw),
      text: v.text,
      value: v.value instanceof Uint8Array ? null : v.value,
      risk: info.risk || null,
      writable: adapter.canWrite(key),
    });
  }
  if (!entries.length)
    return log('Záloha: zařízení neodpovědělo na žádné nastavení.', 'er');

  const backup = Backup.build({
    device: {
      id: profile.id, model: profile.model, pid: profile.pid,
      protocol: profile.protocol, btName: S.dev?.name || null,
      firmware: values.get('firmware')?.text || null,
    },
    entries, skipped,
  });

  const name = Backup.download(backup);
  log(`Záloha uložena a odeslána do stahování: ${name}`, 'rx');
  log(`  ${entries.length} hodnot · ${backup.counts.restorable} obnovitelných · ` +
      `${backup.counts.dangerous} nebezpečných (ty se nikdy neobnovují)`, 'rx');
  for (const e of entries)
    log(`   ${e.label.padEnd(34)} ${String(e.text).padEnd(26)} [${e.hex}]` +
        (e.risk ? `  ⚠ ${e.risk}` : ''), e.risk ? 'warn' : 'dim');
  if (skipped.length)
    log(`   (${skipped.length} nastavení neodpovědělo a v záloze není)`, 'warn');
  if (secrets.length) {
    log(`   (${secrets.length} kritických položek se do souboru nezapisuje ` +
        `— jsou to zámky a identita zařízení:)`, 'warn');
    for (const s of secrets) log(`      ${s}`, 'dim');
  }
};

$('btnRestore').onclick = async () => {
  if (!connected()) return log('Nejdřív se připoj.', 'er');
  setLog(true);

  let data;
  try {
    data = await Backup.load({ protocol: profile.protocol, pid: profile.pid,
                               model: profile.model, btName: S.dev?.name });
  } catch (e) { return log(`Obnova ODMÍTNUTA — ${e.message}`, 'er'); }

  if (data.nameMismatch) log(`Pozor: ${data.nameMismatch}`, 'warn');
  log(`Obnova: ${data.entries.length} hodnot ze zálohy ` +
      `(${data.device?.model}, ${(data.created || '').slice(0, 16).replace('T', ' ')}).`,
      'warn');

  // Nejdriv si precteme aktualni stav, at vime, co se opravdu lisi.
  const readKeys = data.entries.map(e => e.key).filter(k => adapter.canRead(k));
  log('Čtu aktuální stav, abych věděl, co se liší…', 'warn');
  await readMany(readKeys, 'Porovnání', { fresh: true });

  const items = data.entries.map(e => {
    const info = adapter.info(e.key);
    const cur = values.get(e.key);
    // Nebezpecne je to, co takhle oznacila zaloha NEBO co je nebezpecne ted.
    const dangerous = !!e.risk || !!info?.risk;
    return {
      key: e.key,
      label: e.label || info?.setting.label || e.key,
      group: e.group || '—',
      tag: info?.addr || e.addr || '',
      writable: !!info && adapter.canWrite(e.key),
      dangerous,
      backupHex: e.hex,
      backupText: e.text,
      backupValue: e.value,
      currentHex: cur ? toHex(cur.raw) : null,
      currentText: cur ? cur.text : null,
      unknown: !info,
    };
  });

  const unknown = items.filter(i => i.unknown);
  if (unknown.length)
    log(`  ${unknown.length} položek ze zálohy tenhle model nezná — vynechávám.`, 'warn');

  const chosen = await Backup.pickRestore(items.filter(i => !i.unknown), {
    model: data.device?.model,
    created: (data.created || '').slice(0, 16).replace('T', ' '),
  });
  if (!chosen.length) return log('Obnova zrušena.', 'warn');

  const list = chosen.map(c =>
    `${c.label}\n    ${c.currentText ?? 'nenačteno'} [${c.currentHex ?? '—'}]` +
    `\n → ${c.backupText} [${c.backupHex}]`).join('\n\n');

  const ok = await confirmWrite({
    name: `Hromadná obnova ${chosen.length} nastavení`,
    tag: `${profile.model} · PID ${profile.pid}`,
    list,
    range: `ze zálohy ${data.device?.model || ''} (PID ${data.device?.pid || '?'})`,
    bytes: new Uint8Array(0),
    note: `Zapisuje se postupně s pauzou ${adapter.pauseMs} ms. ` +
          `Nebezpečné položky se neobnovují vůbec.`,
    risk: null, reason: '',
  });
  if (!ok) return log('Obnova zrušena.', 'warn');

  let done = 0, failed = 0;
  for (const c of chosen) {
    if (!connected()) {
      log(`Obnova PŘERUŠENA — spojení se rozpadlo. Zapsáno ${done} z ` +
          `${chosen.length}, zbytek NEBYL odeslán.`, 'er');
      log('  Připoj se znovu a spusť obnovu ze stejné zálohy — hotové ' +
          'položky se ukážou jako „beze změny“.', 'er');
      return;
    }
    // Kontrola znovu, tesne pred zapisem: soubor zalohy je editovatelny
    // a vyber uz ho znovu nehlida.
    const info = adapter.info(c.key);
    if (!info || !adapter.canWrite(c.key)) {
      log(`  PŘESKAKUJI ${c.label} — nejde zapsat`, 'er'); failed++; continue;
    }
    if (info.risk || c.dangerous) {
      log(`  PŘESKAKUJI ${c.label} — nebezpečná položka se neobnovuje`, 'er');
      failed++; continue;
    }
    if (c.currentHex !== null && c.currentHex === c.backupHex) {
      log(`  přeskakuji ${c.label} — už je nastavené`, 'dim'); continue;
    }
    if (c.backupValue === null || c.backupValue === undefined) {
      log(`  PŘESKAKUJI ${c.label} — v záloze není použitelná hodnota`, 'er');
      failed++; continue;
    }
    let built;
    try { built = adapter.setFrames(c.key, c.backupValue, values.get(c.key)?.raw); }
    catch (e) { log(`  PŘESKAKUJI ${c.label}: ${e.message}`, 'er'); failed++; continue; }
    // Posledni kontrola: to, co jsme prave zakodovali, musi sedet na to,
    // co je v zaloze. Kdyz ne, zaloha byla upravena nebo nesedi typ.
    if (built.valueHex !== c.backupHex) {
      log(`  PŘESKAKUJI ${c.label} — zakódovaná hodnota [${built.valueHex}] ` +
          `nesedí na zálohu [${c.backupHex}]`, 'er');
      failed++; continue;
    }
    log(`  obnovuji ${c.label}: ${c.currentText ?? '?'} → ${c.backupText}`, 'warn');
    await fire(built.frames, `Obnova — ${c.label}`);
    done++;
    // Hromadny zapis je jediné misto, kde jde za sebou hodne SETu.
    // Davame vetsi rozestup nez u jednotlivych prikazu, at firmware
    // stihne kazdou zmenu zpracovat a ulozit.
    await sleep(BULK_WRITE_PAUSE);
  }
  log(`Obnova hotova: zapsáno ${done}${failed ? `, přeskočeno ${failed}` : ''} ` +
      `z ${chosen.length}.`, failed ? 'warn' : 'rx');
  if (done) {
    log('Kontroluji, co se opravdu zapsalo…', 'warn');
    await readMany(chosen.map(c => c.key), 'Kontrola', { fresh: true });
  }
};

// ===========================================================================
// ruční příkaz (stejné pojistky jako tlačítka v UI)
// ===========================================================================

$('rawAddr').placeholder = adapter.rawLabel;
$('rawVal').placeholder = adapter.rawValueLabel;

function rawInfo() {
  try { return adapter.rawParse($('rawAddr').value); }
  catch (e) { log(`ODMÍTNUTO — ${e.message}`, 'er'); return null; }
}

$('btnRawGet').onclick = async () => {
  const info = rawInfo();
  if (!info) return;
  if (!info.known)
    log(`Pozor: ${info.tag} není v mapování — posílám, ale odpověď nemusí přijít.`,
        'warn');
  await request(adapter.rawGetFrames(info), `ruční GET ${info.name}`);
};

$('btnRawSet').onclick = async () => {
  const info = rawInfo();
  if (!info) return;
  let built;
  try { built = adapter.rawSetFrames(info, $('rawVal').value); }
  catch (e) { return log(`ODMÍTNUTO — ${e.message}`, 'er'); }

  if ((info.risk === 'high' || info.risk === 'critical') && !S.unlocked)
    return log(`ZABLOKOVÁNO — ${info.name} je rizikový zápis. ` +
               `Zapni „rizikové zápisy“.`, 'er');

  const ok = await confirmWrite({
    name: `Ruční zápis — ${info.name}`,
    tag: info.tag,
    to: { text: `hodnota ${built.valueHex || '(prázdná)'}`, hex: built.valueHex },
    range: info.range,
    bytes: built.frames[0],
    note: 'Ruční zápis jde do sluchátek bez kontroly významu hodnoty.',
    risk: info.risk,
    reason: info.why,
  });
  if (!ok) return log('ruční zápis zrušen', 'warn');
  await fire(built.frames, `ruční SET ${info.name}`);
};

// ===========================================================================
// hledání, přepínače, start
// ===========================================================================

$('search').oninput = () => {
  const q = $('search').value.trim().toLowerCase();
  document.body.classList.toggle('searching', !!q);
  for (const [, row] of rows) {
    const hit = !q || row.el.dataset.search.includes(q);
    row.el.style.display = hit ? '' : 'none';
  }
  // karta bez viditelneho radku se schova
  for (const card of document.querySelectorAll('.card[data-group]')) {
    const any = [...card.querySelectorAll('.row')].some(r => r.style.display !== 'none');
    card.style.display = any ? '' : 'none';
  }
};

$('filterAnswered').onchange = e => {
  document.body.classList.toggle('only-ok', e.target.checked);
};

$('unlockDanger').onchange = e => {
  S.unlocked = e.target.checked;
  document.body.classList.toggle('unlocked', S.unlocked);
  log(S.unlocked
    ? 'POZOR: rizikové zápisy odemčeny — každý chce opsat název nastavení.'
    : 'Rizikové zápisy zase zamčeny.', S.unlocked ? 'er' : 'warn');
};

// prepinac modelu
const devSel = $('devSel');
for (const d of DEVICES) {
  const o = document.createElement('option');
  o.value = d.id;
  o.textContent = `${d.model} · PID ${d.pid} · Protocol ${d.protocol}`;
  devSel.appendChild(o);
}
devSel.value = profile.id;
devSel.onchange = () => {
  localStorage.setItem('jbl.device', devSel.value);
  location.search = `?dev=${devSel.value}`;
};

// ===========================================================================
// ladění bez sluchátek — stejné dekodéry jako naostro
// ===========================================================================
window.jbl = {
  /** Zpracuje hex jako přijatý paket. Nic neodesílá. */
  feed(h) {
    const buf = Uint8Array.from((String(h).match(/[0-9a-fA-F]{2}/g) || [])
      .map(x => parseInt(x, 16)));
    onNotify({ target: { value: new DataView(buf.buffer) } });
    return `${buf.length} B zpracováno`;
  },
  /** Přečte nastavení podle klíče. */
  get: key => readOne(key),
  /** Vypíše, co tenhle model umí. */
  keys: () => adapter.keys(),
  /** Poslední přečtené hodnoty. */
  values: () => Object.fromEntries([...values].map(([k, v]) => [k, v.text])),
  /**
   * Zápis z konzole jde PŘES stejné potvrzení i zámek jako tlačítka.
   * Obejít to nejde — jinak by konzole byla díra v pojistkách.
   */
  set: (key, value) => writeSetting(key, value),
};

// ===========================================================================
// start
// ===========================================================================

$('brandModel').textContent = profile.model;
$('pillPid').textContent = `PID ${profile.pid}`;
$('pillProto').textContent = adapter.protocolLabel;
$('pillVerified').textContent = profile.verified ? 'ověřeno na HW' : 'neověřeno na HW';
$('pillVerified').className = 'pill ' + (profile.verified ? 'g' : 'w');
$('pillVerified').title = profile.note;
$('deviceNote').textContent = profile.note;

buildCards();
setConnected(false);

const requestedTab = ({ devices:'Zařízení', sound:'Zvuk', controls:'Ovládání',
  connection:'Připojení', system:'Systém' })[
  new URLSearchParams(location.search).get('tab')?.toLowerCase()
];
const savedTab = requestedTab || localStorage.getItem('jbl.tab');
const startTab = panes.get(savedTab)?.count ? savedTab
  : [...panes].find(([, r]) => r.count)?.[0];
panes.get(startTab)?.btn.click();

setLog(localStorage.getItem('jbl.log') === '1');
Server.watch($('srvHost'));
refreshDiag();

const total = adapter.keys().length;
const writable = adapter.keys().filter(k => adapter.canWrite(k)).length;
const risky = adapter.keys().filter(k => adapter.info(k).risk).length;
log(`${profile.model} · ${adapter.protocolLabel}`, 'warn');
log(`Namapováno ${total} nastavení, ${writable} zapisovatelných, ` +
    `${risky} označených jako rizikové.`, 'dim');

// Vypsat, co pojistka zastavi vzdycky — at je videt, ze to tam je,
// a at je jasne, ze to neni zamek, ktery jde odemknout.
{
  const list = Guard.forbiddenList(adapter.protocol);
  log(`Tvrdá pojistka: ${list.length} sekvencí je zablokovaných natrvalo ` +
      `(nejde odemknout, ani z konzole):`, 'warn');
  for (const f of list) log(`   ${f.addr.padEnd(12)} ${f.name}  [${f.scope}]`, 'dim');

  const un = profile.knownUnsupported;
  if (un?.length) {
    log(`Změřeno na hardwaru — tenhle model nemá ${un.length} funkcí, ` +
        `proto tu nejsou:`, 'dim');
    for (const [addr, what] of un) log(`   ${addr.padEnd(20)} ${what}`, 'dim');
  }
}

log('Připraveno. Klikni na Připojit.', 'warn');
