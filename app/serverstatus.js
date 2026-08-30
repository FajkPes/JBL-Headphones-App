// ---------------------------------------------------------------------------
// Ukazatel stavu lokalniho serveru.
//
// Kdyz server spadne nebo ho zavres, stranka zustane v prohlizeci viset
// a tvari se, ze funguje — jen prestanou chodit dalsi soubory. Tenhle
// ukazatel to hned ukaze misto toho, aby ses divil, proc neco nejde.
// ---------------------------------------------------------------------------

const CSS = `
.srv{display:inline-flex;align-items:center;gap:6px;font:11.5px
  ui-monospace,Consolas,monospace;color:#8b949e;white-space:nowrap}
.srv .dot{width:8px;height:8px;border-radius:50%;background:#8b949e;flex:none}
.srv.ok .dot{background:#3fb950;box-shadow:0 0 6px #3fb95088}
.srv.bad .dot{background:#f85149;box-shadow:0 0 6px #f8514988}
.srv.bad{color:#f85149}
.srv-banner{position:fixed;left:0;right:0;top:0;z-index:2000;background:#3d1113;
  color:#ffb4ae;border-bottom:1px solid #f85149;padding:9px 16px;
  font:13px/1.5 system-ui,"Segoe UI",sans-serif;display:flex;gap:10px;
  align-items:center}
.srv-banner b{color:#fff}
.srv-banner code{background:#00000055;padding:1px 6px;border-radius:4px;
  font:12px ui-monospace,Consolas,monospace}
`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  const s = document.createElement('style');
  s.textContent = CSS;
  document.head.appendChild(s);
  styled = true;
}

let banner = null;

function showBanner(show) {
  if (show && !banner) {
    banner = document.createElement('div');
    banner.className = 'srv-banner';
    banner.innerHTML =
      '<b>Server is not running.</b> The open page may remain visible, but ' +
      'additional files cannot load and a refresh will be blank. Run ' +
      '<code>START JBL Headphones App.bat</code> again, then press F5.';
    document.body.appendChild(banner);
  } else if (!show && banner) {
    banner.remove();
    banner = null;
  }
}

/**
 * Zalozi ukazatel a zacne server pravidelne kontrolovat.
 * @param {HTMLElement} host kam ukazatel vlozit
 * @param {number} everyMs jak casto kontrolovat
 */
export function watch(host, everyMs = 5000) {
  ensureStyle();
  const el = document.createElement('span');
  el.className = 'srv';
  el.innerHTML = '<span class="dot"></span><span class="txt">server…</span>';
  el.title = 'Status of the local server hosting this page';
  host.appendChild(el);

  const txt = el.querySelector('.txt');
  let failures = 0;

  async function ping() {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch('/_ping', { cache: 'no-store', signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      failures = 0;
      el.className = 'srv ok';
      txt.textContent = `server running (${fmtUptime(d.uptime)})`;
      el.title = `Server is healthy.\nFolder: ${d.root}`;
      showBanner(false);
    } catch {
      failures++;
      el.className = 'srv bad';
      txt.textContent = 'server not running';
      el.title = 'The server is not responding. Run START JBL Headphones App.bat again.';
      if (failures >= 2) showBanner(true);   // az po druhem selhani, at neblika
    }
  }

  const fmtUptime = s =>
    s < 60 ? `${Math.round(s)} s`
    : s < 3600 ? `${Math.round(s / 60)} min`
    : `${(s / 3600).toFixed(1)} h`;

  ping();
  setInterval(ping, everyMs);
  // po navratu na zalozku zkontrolovat hned
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ping();
  });
  return el;
}
