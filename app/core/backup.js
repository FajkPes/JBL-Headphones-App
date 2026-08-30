// ---------------------------------------------------------------------------
// Zaloha a obnova nastaveni.
//
// Zaloha:
//   - precte hodnoty postupne, po malych davkach, aby se sluchatka nezahltila
//   - ulozi je dekodovane (text + hodnota) I v syrovem hexu
//   - vysledek je ZIP: zaloha.json (pro obnovu), PREHLED.txt (ke cteni),
//     HEX.txt (jen hex, kdyby bylo potreba rucne)
//   - stahne se pres prohlizec jako soubor
//
// Obnova:
//   - overi metadata (format, protokol, PID, model)
//   - da vybrat, co obnovit; predvyplneny jsou jen polozky, ktere se LISI
//   - nikdy neobnovi polozku s priznakem nebezpeci
//   - pred zapisem ukaze presny seznam "co -> na co" a necha potvrdit
//   - zapisuje postupne s pauzami; kdyz spojeni spadne, zastavi se
// ---------------------------------------------------------------------------

import * as Zip from '../zip.js';

export const FORMAT = 'jbl-headphones-backup';
export const VERSION = 2;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const toHex = b =>
  b ? [...b].map(x => x.toString(16).padStart(2, '0')).join(' ') : '';

/**
 * Slozi objekt zalohy.
 * entries = [{ key, label, group, kind, addr, hex, text, value, risk, writable }]
 */
export function build({ device, entries, skipped = [] }) {
  return {
    format: FORMAT,
    version: VERSION,
    created: new Date().toISOString(),
    device: {
      id: device.id, model: device.model, pid: device.pid,
      protocol: device.protocol, btName: device.btName || null,
      firmware: device.firmware || null,
    },
    counts: {
      total: entries.length,
      restorable: entries.filter(e => e.writable && !e.risk).length,
      dangerous: entries.filter(e => e.risk).length,
      skipped: skipped.length,
    },
    skipped,
    entries,
  };
}

/** Citelny prehled do archivu. */
export function summary(backup) {
  const d = backup.device || {};
  const L = [];
  L.push('JBL HEADPHONES SETTINGS BACKUP');
  L.push('='.repeat(72));
  L.push('');
  L.push(`Model:      ${d.model || '?'}`);
  L.push(`PID:        ${d.pid || '?'}`);
  L.push(`Protocol:   Protocol ${d.protocol ?? '?'}`);
  L.push(`BT name:    ${d.btName || '?'}`);
  L.push(`Firmware:   ${d.firmware || '?'}`);
  L.push(`Created:    ${(backup.created || '').replace('T', ' ').slice(0, 19)}`);
  L.push(`Items:      ${backup.entries.length}` +
         `  (restorable ${backup.counts?.restorable ?? '?'},` +
         ` dangerous ${backup.counts?.dangerous ?? 0})`);
  L.push('');
  L.push('-'.repeat(72));
  const w = Math.max(...backup.entries.map(e => (e.label || '').length), 12);
  let group = null;
  for (const e of backup.entries) {
    if (e.group !== group) { group = e.group; L.push(''); L.push(`[${group}]`); }
    L.push(`  ${(e.label || '').padEnd(w)}  ${String(e.text ?? '').padEnd(28)}` +
           `  [${e.hex}]${e.risk ? `  ⚠ ${e.risk}` : ''}`);
  }
  if (backup.skipped?.length) {
    L.push('');
    L.push('-'.repeat(72));
    L.push('NO RESPONSE (not included in the backup):');
    for (const s of backup.skipped) L.push(`  ${s}`);
  }
  L.push('');
  L.push('-'.repeat(72));
  L.push('Use Restore backup in the app to restore this file.');
  L.push('Items marked ⚠ are never restored and must be configured manually.');
  L.push('Do not edit backup.json unless you understand the protocol; its values are sent to the headphones.');
  return L.join('\n');
}

/** Jen hex, radek po radku. Kdyby bylo potreba porovnavat rucne. */
export function hexDump(backup) {
  const L = [`# ${backup.device?.model || '?'} · PID ${backup.device?.pid || '?'}` +
             ` · Protocol ${backup.device?.protocol ?? '?'}`,
             `# ${backup.created}`, ''];
  const w = Math.max(...backup.entries.map(e => e.key.length), 8);
  for (const e of backup.entries)
    L.push(`${e.key.padEnd(w)}  ${(e.addr || '').padEnd(22)}  ${e.hex}`);
  return L.join('\n');
}

/**
 * Ulozi zalohu jako ZIP a spusti stazeni v prohlizeci.
 * Vraci jmeno souboru.
 */
export function download(backup) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const name = `${backup.device?.id || 'jbl'}-backup-${stamp}.zip`;
  const blob = Zip.create([
    { name: 'backup.json', content: JSON.stringify(backup, null, 2) },
    { name: 'SUMMARY.txt', content: summary(backup) },
    { name: 'HEX.txt',     content: hexDump(backup) },
  ]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Odkaz nechavame chvili zit — nektere prohlizece stahovani zrusi,
  // kdyz se URL uvolni moc brzy.
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return name;
}

/**
 * Ulozi zpravu z pruzkumu jako ZIP a spusti stazeni.
 * Je to cisty zapis toho, co se poslalo a co prislo — zadna interpretace.
 */
export function probeReport({ device, groups }) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const name = `exploration-${device.model.replace(/\s+/g, '')}-${stamp}.zip`;

  const L = [];
  L.push('EXPLORATION — queries answered by the headphones');
  L.push('='.repeat(72));
  L.push(`Model:    ${device.model} (PID ${device.pid}, Protocol ${device.protocol})`);
  L.push(`BT name:  ${device.btName || '?'}`);
  L.push(`Created:  ${new Date().toISOString().replace('T', ' ').slice(0, 19)}`);
  L.push('');
  L.push('Only read-only queries were sent. Nothing was written.');
  for (const g of groups) {
    const ok = g.results.filter(r => r.answered);
    L.push('');
    L.push('-'.repeat(72));
    L.push(`Protocol ${g.protocol}${g.experimental ? '  (EXPERIMENT — other protocol)' : ''}` +
           `  — answered ${ok.length} of ${g.results.length}`);
    L.push('');
    L.push('ANSWERED:');
    for (const r of ok) {
      L.push(`  ${r.label}`);
      L.push(`      → ${r.sent}`);
      for (const rep of r.replies) L.push(`      ← ${rep}`);
      if (r.note) L.push(`      (${r.note})`);
    }
    L.push('');
    L.push('NO RESPONSE:');
    for (const r of g.results.filter(x => !x.answered))
      L.push(`  ${r.label.padEnd(46)} → ${r.sent}`);
  }
  const text = L.join('\n');

  const blob = Zip.create([
    { name: 'EXPLORATION.txt', content: text },
    { name: 'exploration.json',
      content: JSON.stringify({ device, created: new Date().toISOString(),
                                groups }, null, 2) },
  ]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return name;
}

/**
 * Nacte zalohu ze ZIPu (nebo holeho JSONu) a overi, ze patri
 * k pripojenym sluchatkum.
 * @param {object} expect { protocol, pid, model, btName }
 */
export function load(expect = {}) {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.zip,.json,application/zip,application/json';
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return reject(new Error('No file was selected.'));

      let data;
      try {
        if (file.name.toLowerCase().endsWith('.json')) {
          data = JSON.parse(await file.text());
        } else {
          const files = Zip.read(await file.arrayBuffer());
          const raw = files.get('backup.json') || files.get('zaloha.json');
          if (!raw) return reject(new Error(
            'The archive does not contain backup.json and is not a backup from this app.'));
          data = JSON.parse(Zip.text(raw));
        }
      } catch (e) { return reject(new Error(e.message)); }

      // --- metadata: zaloha nesmi jit nahrat do jinych sluchatek ---
      if (data.format !== FORMAT)
        return reject(new Error('This is not a backup from this app.'));
      const d = data.device || {};
      if (expect.protocol && d.protocol !== expect.protocol)
        return reject(new Error(
          `The backup uses Protocol ${d.protocol}, but the connected model uses ` +
          `Protocol ${expect.protocol}.`));
      if (expect.pid && d.pid && d.pid !== expect.pid)
        return reject(new Error(
          `The backup belongs to ${d.model || d.pid} (PID ${d.pid}), but the connected ` +
          `headphones use PID ${expect.pid}. Restoring to another model could write ` +
          `invalid values.`));
      if (!Array.isArray(data.entries) || !data.entries.length)
        return reject(new Error('The backup contains no values.'));

      // nazev je jen varovani — sluchatka se daji prejmenovat
      if (expect.btName && d.btName && d.btName !== expect.btName)
        data.nameMismatch = `The backup was created from “${d.btName}”, ` +
          `but “${expect.btName}” is connected now.`;

      resolve(data);
    };
    inp.click();
  });
}

// --- vyber, co obnovit ------------------------------------------------------

const CSS = `
.bk-back{position:fixed;inset:0;background:#000d;display:flex;align-items:center;
  justify-content:center;z-index:1001;padding:20px;backdrop-filter:blur(2px)}
.bk{background:var(--panel,#16191c);border:1px solid var(--line,#2b3136);
  border-radius:12px;width:100%;max-width:840px;max-height:88vh;display:flex;
  flex-direction:column;color:var(--fg,#e8ebee);
  font:14px/1.5 system-ui,"Segoe UI",sans-serif;box-shadow:0 24px 60px #000b}
.bk h3{margin:0;padding:13px 18px;font-size:14px;background:var(--panel2,#1c2024);
  border-bottom:1px solid var(--line,#2b3136);display:flex;gap:9px;align-items:center}
.bk h3 small{color:var(--dim,#8d969f);font-weight:400;font-size:12px}
.bk-info{padding:11px 18px;font-size:12.5px;color:var(--dim,#8d969f);
  border-bottom:1px solid var(--line,#2b3136)}
.bk-info b{color:var(--fg,#e8ebee)}
.bk-list{overflow:auto;padding:4px 0;flex:1}
.bk-sec{padding:7px 18px 3px;font:10.5px var(--mono,monospace);
  text-transform:uppercase;letter-spacing:.5px;color:var(--dim2,#6b747c);
  background:#ffffff05}
.bk-item{display:grid;grid-template-columns:auto 1fr;gap:10px;padding:7px 18px;
  border-bottom:1px solid #1f2429;align-items:start;cursor:pointer}
.bk-item:hover{background:#ffffff06}
.bk-item.same{opacity:.42}
.bk-item.blocked{opacity:.6}
.bk-item .nm{font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.bk-item .dd{font:11.5px var(--mono,monospace);color:var(--dim,#8d969f);margin-top:3px}
.bk-item .dd b{color:var(--ok,#3fb950);font-weight:600}
.bk-item .dd i{color:var(--warn,#d29922);font-style:normal}
.bk-item .tagx{font:10px var(--mono,monospace);border:1px solid var(--line,#2b3136);
  border-radius:3px;padding:0 5px;color:var(--dim,#8d969f)}
.bk-item .tagx.ro{color:var(--err,#f85149);border-color:#f8514966}
.bk-foot{display:flex;gap:9px;align-items:center;padding:12px 18px;
  background:var(--panel2,#1c2024);border-top:1px solid var(--line,#2b3136)}
.bk-foot .grow{flex:1}
.bk-foot button{border:1px solid var(--line2,#3a4147);background:var(--panel3,#22272b);
  color:var(--fg,#e8ebee);border-radius:7px;padding:7px 15px;font-size:13px;
  cursor:pointer;font-family:inherit}
.bk-foot button:hover:not(:disabled){border-color:var(--dim,#8d969f)}
.bk-foot button.go{background:var(--warn,#d29922);border-color:var(--warn,#d29922);
  color:#241a06;font-weight:650}
.bk-foot button.go:disabled{opacity:.35;cursor:not-allowed}
.bk-foot .sel{font-size:12.5px;color:var(--dim,#8d969f)}
`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  styled = true;
}

/**
 * Ukaze rozdily a necha vybrat, co obnovit.
 *
 * items = [{ key, label, group, tag, writable, dangerous, backupHex,
 *            backupText, currentHex, currentText }]
 * Vraci pole vybranych polozek (muze byt prazdne).
 */
export function pickRestore(items, meta = {}) {
  ensureStyle();
  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'bk-back';

    const state = items.map(it => {
      const same = it.currentHex !== null && it.currentHex === it.backupHex;
      // Nebezpecne polozky nejdou obnovit NIKDY — ani po odemceni.
      const can = it.writable && !it.dangerous && !same;
      return { ...it, same, can };
    });

    let html = '';
    let group = null;
    state.forEach((it, i) => {
      if (it.group !== group) {
        group = it.group;
        html += `<div class="bk-sec">${esc(group)}</div>`;
      }
      html += `
        <label class="bk-item ${it.same ? 'same' : ''} ${it.dangerous ? 'blocked' : ''}">
          <input type="checkbox" data-i="${i}" ${it.can ? '' : 'disabled'}
                 ${it.can ? 'checked' : ''}>
          <div>
            <div class="nm">${esc(it.label)}
              <span class="tagx">${esc(it.tag || '')}</span>
              ${!it.writable ? '<span class="tagx ro">read only</span>' : ''}
              ${it.dangerous ? '<span class="tagx ro">dangerous — not restored</span>' : ''}
              ${it.same ? '<span class="tagx">unchanged</span>' : ''}
            </div>
            <div class="dd">backup: <b>${esc(it.backupText || it.backupHex)}</b>
              [${esc(it.backupHex)}]
              ${it.currentHex !== null
                ? ` &nbsp;·&nbsp; now: <i>${esc(it.currentText || it.currentHex)}</i>` +
                  ` [${esc(it.currentHex)}]`
                : ' &nbsp;·&nbsp; now: not loaded'}</div>
          </div>
        </label>`;
    });

    const changeable = state.filter(it => it.can).length;
    const blocked = state.filter(it => it.dangerous).length;

    back.innerHTML = `
      <div class="bk" role="dialog" aria-modal="true">
        <h3>Restore backup
          <small>${esc(meta.model || '')} · ${esc(meta.created || '')}</small></h3>
        <div class="bk-info">
          Only values that <b>actually differ</b> are preselected; nothing else
          is sent to the headphones. Unchanged, read-only, and dangerous items
          cannot be selected.
          <b>${changeable}</b> of ${items.length} differ${blocked
            ? `; ${blocked} dangerous item(s) are excluded` : ''}.
        </div>
        <div class="bk-list">${html}</div>
        <div class="bk-foot">
          <button class="all">Select all differences</button>
          <button class="none">Clear selection</button>
          <span class="grow"></span>
          <span class="sel"></span>
          <button class="no">Cancel</button>
          <button class="go">Continue</button>
        </div>
      </div>`;

    const boxes = [...back.querySelectorAll('input[type=checkbox]')];
    const go = back.querySelector('.go');
    const sel = back.querySelector('.sel');
    const upd = () => {
      const n = boxes.filter(b => b.checked).length;
      sel.textContent = `${n} selected`;
      go.disabled = n === 0;
    };
    boxes.forEach(b => b.onchange = upd);
    back.querySelector('.all').onclick = () => {
      boxes.forEach(b => { if (!b.disabled) b.checked = true; }); upd();
    };
    back.querySelector('.none').onclick = () => {
      boxes.forEach(b => b.checked = false); upd();
    };
    upd();

    const done = v => { back.remove(); resolve(v); };
    back.querySelector('.no').onclick = () => done([]);
    go.onclick = () => done(boxes.filter(b => b.checked).map(b => state[+b.dataset.i]));
    back.onclick = e => { if (e.target === back) done([]); };
    document.body.appendChild(back);
  });
}
