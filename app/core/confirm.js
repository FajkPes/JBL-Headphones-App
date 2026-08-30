// ---------------------------------------------------------------------------
// Potvrzeni PRED KAZDYM zapisem do sluchatek.
//
// Ukazuje presne to, co odchazi na drat:
//   - co se meni a z ceho na co, textove i v hexu
//   - povoleny rozsah nebo seznam moznosti
//   - uroven nebezpeci a proc
//   - presne bajty ramce
//
// U rizikovych zapisu je navic potreba opsat nazev, aby to neslo
// odklikat omylem.
// ---------------------------------------------------------------------------

import { RISK_LABEL } from '../catalog.js';

const CSS = `
.cfm-back{position:fixed;inset:0;background:#000d;display:flex;
  align-items:center;justify-content:center;z-index:1000;padding:20px;
  backdrop-filter:blur(2px)}
.cfm{background:var(--panel,#16191c);border:1px solid var(--line,#2b3136);
  border-radius:12px;max-width:620px;width:100%;color:var(--fg,#e8ebee);
  font:14px/1.55 system-ui,"Segoe UI",sans-serif;overflow:hidden;
  box-shadow:0 24px 60px #000b;max-height:90vh;display:flex;flex-direction:column}
.cfm h3{margin:0;padding:13px 18px;font-size:14px;background:var(--panel2,#1c2024);
  border-bottom:1px solid var(--line,#2b3136);display:flex;align-items:center;gap:9px}
.cfm h3 .tag{font:11px var(--mono,monospace);color:var(--dim,#8d969f);margin-left:auto}
.cfm-body{padding:15px 18px;display:flex;flex-direction:column;gap:11px;
  overflow:auto}
.cfm-row{display:grid;grid-template-columns:118px 1fr;gap:11px;align-items:start}
.cfm-row .k{color:var(--dim,#8d969f);font-size:12.5px}
.cfm-row .v{font-size:13px;word-break:break-word}
.cfm-name{font-size:15px;font-weight:650}

/* z ceho na co */
.cfm-diff{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;
  align-items:center;background:#0b0d0f;border:1px solid var(--line,#2b3136);
  border-radius:8px;padding:11px 13px}
.cfm-diff .side{min-width:0}
.cfm-diff .lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;
  color:var(--dim2,#6b747c);margin-bottom:3px}
.cfm-diff .txt{font-size:13.5px;font-weight:600;word-break:break-word}
.cfm-diff .hexv{font:11.5px var(--mono,monospace);color:var(--info,#58a6ff);
  margin-top:3px;word-break:break-all}
.cfm-diff .from .txt{color:var(--dim,#8d969f)}
.cfm-diff .to .txt{color:var(--ok,#3fb950)}
.cfm-diff .arrow{font-size:19px;color:var(--dim2,#6b747c)}
.cfm-diff.hot .to .txt{color:var(--err,#f85149)}

.cfm-bytes{background:#0b0d0f;border:1px solid var(--line,#2b3136);border-radius:6px;
  padding:8px 11px;font:12.5px var(--mono,monospace);color:var(--info,#58a6ff);
  word-break:break-all}
.cfm-list{background:#0b0d0f;border:1px solid var(--line,#2b3136);border-radius:6px;
  padding:8px 11px;font:12px var(--mono,monospace);max-height:190px;overflow:auto;
  white-space:pre-wrap}
.cfm-warn{background:#2a1d10;border-left:3px solid var(--warn,#d29922);border-radius:6px;
  padding:9px 12px;font-size:12.5px;color:#e3b341}
.cfm-warn.hot{background:#2a1315;border-left-color:var(--err,#f85149);color:#ff8a80}
.cfm-risk{display:inline-flex;align-items:center;gap:5px;font:11px var(--mono,monospace);
  border:1px solid;border-radius:20px;padding:1px 9px}
.cfm-risk.medium{color:var(--warn,#d29922);border-color:#d2992255}
.cfm-risk.high,.cfm-risk.critical{color:var(--err,#f85149);border-color:#f8514955}
.cfm-type{width:100%;background:#0b0d0f;border:1px solid #f8514966;
  border-radius:6px;padding:8px 11px;color:var(--fg,#e8ebee);
  font:13px var(--mono,monospace)}
.cfm-foot{display:flex;gap:9px;justify-content:flex-end;padding:12px 18px;
  background:var(--panel2,#1c2024);border-top:1px solid var(--line,#2b3136);flex:none}
.cfm-foot button{border:1px solid var(--line2,#3a4147);background:var(--panel3,#22272b);
  color:var(--fg,#e8ebee);border-radius:7px;padding:7px 16px;font-size:13px;
  cursor:pointer;font-family:inherit}
.cfm-foot button:hover:not(:disabled){border-color:var(--dim,#8d969f)}
.cfm-foot button.go{background:var(--ok,#3fb950);border-color:var(--ok,#3fb950);
  color:#06210d;font-weight:650}
.cfm-foot button.go.hot{background:var(--err,#f85149);border-color:var(--err,#f85149);
  color:#2a0a08}
.cfm-foot button.go:disabled{opacity:.35;cursor:not-allowed}
`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  styled = true;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const toHex = b => b ? [...b].map(x => x.toString(16).padStart(2, '0')).join(' ') : '';

/**
 * @param {object} o
 * @param {string} o.name      nazev nastaveni
 * @param {string} o.tag       adresa, napr. "ID 24 · 0x0018" nebo "cmd 0x91"
 * @param {object} [o.from]    { text, hex } aktualni stav ze sluchatek
 * @param {object} [o.to]      { text, hex } co se zapise
 * @param {string} [o.range]   povoleny rozsah / seznam moznosti
 * @param {Uint8Array} o.bytes presne bajty ramce
 * @param {string} [o.list]    vypis polozek (u davkoveho zapisu)
 * @param {string} [o.risk]    'medium' | 'high' | 'critical'
 * @param {string} [o.reason]  proc je to rizikove
 * @param {string} [o.note]    doplnujici poznamka
 * @returns {Promise<boolean>}
 */
export function confirmWrite(o) {
  ensureStyle();
  const hot = o.risk === 'high' || o.risk === 'critical';
  const mustType = hot;

  return new Promise(resolve => {
    const back = document.createElement('div');
    back.className = 'cfm-back';

    const diff = (o.from || o.to) ? `
      <div class="cfm-diff ${hot ? 'hot' : ''}">
        <div class="side from">
          <div class="lbl">teď v sluchátkách</div>
          <div class="txt">${esc(o.from?.text ?? 'nenačteno')}</div>
          ${o.from?.hex ? `<div class="hexv">${esc(o.from.hex)}</div>` : ''}
        </div>
        <div class="arrow">→</div>
        <div class="side to">
          <div class="lbl">po zápisu</div>
          <div class="txt">${esc(o.to?.text ?? '—')}</div>
          ${o.to?.hex ? `<div class="hexv">${esc(o.to.hex)}</div>` : ''}
        </div>
      </div>` : '';

    back.innerHTML = `
      <div class="cfm" role="dialog" aria-modal="true">
        <h3>Odeslat do sluchátek?
          ${o.risk ? `<span class="cfm-risk ${o.risk}">${RISK_LABEL[o.risk] || o.risk}</span>` : ''}
          <span class="tag">${esc(o.tag || '')}</span></h3>
        <div class="cfm-body">
          <div class="cfm-name">${esc(o.name)}</div>
          ${diff}
          ${o.list ? `<div class="cfm-row"><div class="k">Co se zapíše</div>
            <div class="cfm-list">${esc(o.list)}</div></div>` : ''}
          ${o.range ? `<div class="cfm-row"><div class="k">Povolený rozsah</div>
            <div class="v">${esc(o.range)}</div></div>` : ''}
          ${o.bytes && o.bytes.length ? `<div class="cfm-row"><div class="k">Odesílané bajty</div>
            <div class="cfm-bytes">${esc(toHex(o.bytes))}</div></div>` : ''}
          ${o.note ? `<div class="cfm-row"><div class="k">Poznámka</div>
            <div class="v">${esc(o.note)}</div></div>` : ''}
          ${o.reason ? `<div class="cfm-warn ${hot ? 'hot' : ''}">${esc(o.reason)}</div>` : ''}
          ${mustType ? `<div class="cfm-warn hot">Tenhle zápis se nemusí dát vrátit
            oficiální JBL appkou. Pro potvrzení opiš přesně:
            <b>${esc(o.name)}</b></div>
            <input class="cfm-type" placeholder="opiš název nastavení" spellcheck="false">` : ''}
        </div>
        <div class="cfm-foot">
          <button class="no">Zrušit</button>
          <button class="go ${hot ? 'hot' : ''}" ${mustType ? 'disabled' : ''}>Odeslat</button>
        </div>
      </div>`;

    const go = back.querySelector('.go');
    const no = back.querySelector('.no');
    const typed = back.querySelector('.cfm-type');

    if (typed) {
      typed.oninput = () => { go.disabled = typed.value.trim() !== o.name; };
      setTimeout(() => typed.focus(), 30);
    } else setTimeout(() => go.focus(), 30);

    const done = v => {
      back.remove();
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = e => {
      if (e.key === 'Escape') done(false);
      if (e.key === 'Enter' && !go.disabled && e.target !== typed) done(true);
    };
    go.onclick = () => done(true);
    no.onclick = () => done(false);
    back.onclick = e => { if (e.target === back) done(false); };
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
  });
}

export { toHex };
