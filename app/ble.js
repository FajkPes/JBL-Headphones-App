// ---------------------------------------------------------------------------
// Spolecna BLE vrstva pro obe appky (780NC i 720BT).
//
// Dulezite k pochopeni: BLE GATT spojeni je NEZAVISLE na klasickem
// Bluetooth parovani ve Windows. Sluchatka muzou hrat hudbu pres A2DP
// a soucasne mit otevreny GATT kanal - jsou to dva ruzne linky.
// Proto "sluchatka mam pripojena v PC" neznamena, ze je uvidi prohlizec,
// a naopak pripojeni odsud hudbu nepreurusi.
// ---------------------------------------------------------------------------

/** Zjisti stav prostredi: prohlizec, adapter, drive povolena zarizeni. */
export async function environment() {
  const out = { webbt: !!navigator.bluetooth, adapter: null, known: [],
                knownSupported: false };
  if (!out.webbt) return out;
  if (navigator.bluetooth.getAvailability) {
    try { out.adapter = await navigator.bluetooth.getAvailability(); }
    catch { out.adapter = null; }
  }
  if (navigator.bluetooth.getDevices) {
    out.knownSupported = true;
    try { out.known = await navigator.bluetooth.getDevices(); }
    catch { out.known = []; }
  }
  return out;
}

/** Prelozi vyjimku z Web Bluetooth na srozumitelnou hlasku. */
export function explain(e, phase) {
  const n = e?.name || '';
  const m = e?.message || String(e);
  if (phase === 'pick' && n === 'NotFoundError')
    return ['Nevybral jsi zařízení, nebo se žádné nenabídlo.',
            'Když je seznam prázdný: sluchátka musí být zapnutá a v dosahu. ' +
            'Zkus zaškrtnout "všechna zařízení" — filtr na název JBL je někdy ' +
            'nepustí, protože BLE inzerát nemusí obsahovat jméno.'];
  if (phase === 'service' && n === 'NotFoundError')
    return ['Zařízení se připojilo, ale nemá očekávanou GATT službu.',
            'Buď je to jiné zařízení, než jsme čekali, nebo sluchátka službu ' +
            'nabízejí až v určitém stavu. Zkus je odpojit od Windows a připojit znovu.'];
  if (n === 'NetworkError')
    return ['Spojení selhalo nebo se rozpadlo.',
            'Sluchátka můžou být obsazená jinou aplikací (JBL appka v telefonu), ' +
            'nebo je potřeba je nejdřív spárovat ve Windows.'];
  if (n === 'SecurityError')
    return ['Prohlížeč zápis odmítl z bezpečnostních důvodů.',
            'Stránka musí běžet z http://localhost, ne z file://.'];
  if (n === 'InvalidStateError')
    return ['Zařízení není ve stavu, kdy by šlo připojit.',
            'Zkus sluchátka vypnout a zapnout.'];
  return [`${n || 'Chyba'}: ${m}`, ''];
}

/**
 * Pripoji se a najde charakteristiky. Nehada podle UUID - vybira
 * podle vlastnosti (write / notify), aby to fungovalo u obou modelu.
 *
 * log(zprava, trida) se vola prubezne, at je videt, kde to pripadne uvazlo.
 */
export async function connect({ service, acceptAll = false, device = null,
                                onNotify, onDisconnect, log = () => {} }) {
  if (!navigator.bluetooth) {
    const [a, b] = explain({ name: 'NoWebBt' }, 'env');
    throw Object.assign(new Error('Web Bluetooth není dostupné'),
      { human: ['Tenhle prohlížeč Web Bluetooth neumí.', 'Použij Chrome nebo Edge.'] });
  }

  let dev = device;
  if (!dev) {
    log('1/5  otevírám výběr zařízení…', 'warn');
    try {
      dev = await navigator.bluetooth.requestDevice(
        acceptAll ? { acceptAllDevices: true, optionalServices: [service] }
                  : { filters: [{ namePrefix: 'JBL' }], optionalServices: [service] });
    } catch (e) { throw Object.assign(e, { human: explain(e, 'pick') }); }
  } else {
    log('1/5  používám dříve povolené zařízení', 'warn');
  }
  log(`     zařízení: ${dev.name || '(bez názvu)'}`, 'dim');

  if (onDisconnect) {
    dev.removeEventListener?.('gattserverdisconnected', onDisconnect);
    dev.addEventListener('gattserverdisconnected', onDisconnect);
  }

  log('2/5  navazuji GATT spojení…', 'warn');
  // Kdyz se stranka zavre nebo obnovi, GATT spojeni muze v prohlizeci
  // zustat otevrene. Pri dalsim pokusu pak Chrome hlasi, ze je zarizeni
  // obsazene. Kdyz uz pripojene je, jen si na nej navazeme znovu.
  if (dev.gatt.connected)
    log('     zařízení je připojené z dřívějška — navazuji na stávající spojení', 'warn');
  let srv;
  try { srv = dev.gatt.connected ? dev.gatt : await dev.gatt.connect(); }
  catch (e) { throw Object.assign(e, { human: explain(e, 'connect') }); }
  log('     GATT připojeno', 'rx');

  log('3/5  hledám službu…', 'warn');
  let svc;
  try { svc = await srv.getPrimaryService(service); }
  catch (e) { throw Object.assign(e, { human: explain(e, 'service') }); }
  log(`     ${service}`, 'rx');

  log('4/5  čtu charakteristiky…', 'warn');
  let write = null, notify = null;
  for (const c of await svc.getCharacteristics()) {
    const p = c.properties;
    const fl = Object.entries({ read: p.read, write: p.write,
      writeNR: p.writeWithoutResponse, notify: p.notify, indicate: p.indicate })
      .filter(([, v]) => v).map(([k]) => k).join(',');
    log(`     ${c.uuid}  [${fl}]`, 'dim');
    if (!write && (p.write || p.writeWithoutResponse)) write = c;
    if (!notify && (p.notify || p.indicate)) notify = c;
  }
  if (!write || !notify)
    throw Object.assign(new Error('chybí charakteristika'), {
      human: ['Služba nemá zapisovací nebo notifikační charakteristiku.',
              'Vypiš mi prosím řádky výše z logu — podle nich to doladíme.'] });

  log('5/5  zapínám notifikace…', 'warn');
  await notify.startNotifications();
  notify.addEventListener('characteristicvaluechanged', onNotify);
  log(`     zápis → ${write.uuid}`, 'dim');
  log(`     příjem ← ${notify.uuid}`, 'dim');
  log('Připojeno a připraveno.', 'rx');

  return { dev, write, notify };
}

/** Zapise ramec - podle toho, co charakteristika umi. */
export async function writeFrame(ch, bytes) {
  if (ch.properties.write) return ch.writeValueWithResponse(bytes);
  return ch.writeValueWithoutResponse(bytes);
}

/** Vykresli diagnosticky panel do zadaneho elementu. */
export async function renderDiagnostics(el, { onReconnect } = {}) {
  const env = await environment();
  el.innerHTML = '';

  const line = (label, value, cls) => {
    const d = document.createElement('div');
    d.className = 'diagrow';
    d.innerHTML = `<span class="diaglabel">${label}</span>` +
                  `<span class="diagval ${cls || ''}">${value}</span>`;
    el.appendChild(d);
    return d;
  };

  line('Prohlížeč', env.webbt ? 'Web Bluetooth dostupné' : 'Web Bluetooth NENÍ dostupné',
       env.webbt ? 'ok' : 'err');
  if (!env.webbt) {
    line('Řešení', 'Otevři stránku v Chrome nebo Edge', 'warn');
    return env;
  }
  line('Bluetooth adaptér',
       env.adapter === true ? 'dostupný' :
       env.adapter === false ? 'nedostupný nebo vypnutý' : 'nelze zjistit',
       env.adapter === true ? 'ok' : env.adapter === false ? 'err' : 'warn');

  if (env.knownSupported) {
    if (env.known.length) {
      line('Dříve povolená', `${env.known.length} zařízení`, 'ok');
      for (const d of env.known) {
        const row = document.createElement('div');
        row.className = 'diagrow';
        row.innerHTML = `<span class="diaglabel">· ${d.name || '(bez názvu)'}</span>`;
        const b = document.createElement('button');
        b.className = 'sm';
        b.textContent = 'připojit bez dialogu';
        b.onclick = () => onReconnect?.(d);
        row.appendChild(b);
        el.appendChild(row);
      }
    } else {
      line('Dříve povolená', 'žádné — první připojení projde dialogem', 'warn');
    }
  }
  return env;
}

/** Text, ktery vysvetluje vztah k parovani ve Windows. */
export const PAIRING_HINT =
  'Sluchátka připojená k Windows (hudba, hovory) jsou na jiném spojení než ' +
  'tohle. Připojení odsud hudbu nepřeruší a nic v systému nerozpojí. ' +
  'Prohlížeč ale zařízení sám nevidí — musíš ho jednou vybrat v dialogu, ' +
  'který otevře tlačítko Připojit. Ten dialog patří Chrome, ne této stránce.';
