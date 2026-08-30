// ---------------------------------------------------------------------------
// Ovladaci prvky pro jednotlive typy nastaveni.
//
// Kazdy prvek vraci stejne rozhrani:
//   { el, read(), fill(value), setEnabled(on) }
//
//   read()  -> { value }  nebo { error: 'proc to nejde odeslat' }
//   fill(v) -> predvyplni prvek hodnotou prectenou ze sluchatek
//
// Dulezite: fill() NIC neodesila. Prectena hodnota se jen zobrazi
// v ovladacim prvku, aby bylo videt, co v zarizeni je, a aby sla
// zmenit relativne k tomu, co tam opravdu je.
// ---------------------------------------------------------------------------

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

function wrap(children) {
  const d = el('div', { className: 'ctl' });
  for (const c of children) d.appendChild(c);
  return d;
}

/** Prepinac zapnuto / vypnuto. */
function toggleControl() {
  const sw = el('label', { className: 'switch' });
  const cb = el('input', { type: 'checkbox' });
  const track = el('span', { className: 'track' });
  const txt = el('span', { className: 'swtxt', textContent: 'vypnuto' });
  cb.onchange = () => { txt.textContent = cb.checked ? 'zapnuto' : 'vypnuto'; };
  sw.append(cb, track, txt);
  return {
    el: wrap([sw]),
    read: () => ({ value: cb.checked }),
    fill: v => { cb.checked = !!v; cb.onchange(); },
    setEnabled: on => { cb.disabled = !on; },
  };
}

/**
 * Posuvnik s cislem a viditelnym rozsahem.
 * centerAt = hodnota, ktera je "neutralni" (u vyvazeni stred). Kdyz je
 * zadana, vedle cisla se ukazuje odchylka od ni, at je videt, na kterou
 * stranu a o kolik jsi se hnul.
 */
function sliderPart(min, max, unit, centerAt) {
  const sl = el('input', { type: 'range', min, max, value: min });
  const num = el('input', { type: 'number', min, max, value: min,
                            className: 'numsm' });
  const uni = unit ? el('span', { className: 'unit', textContent: unit }) : null;
  const off = centerAt !== undefined
    ? el('span', { className: 'unit off' }) : null;
  const showOff = n => {
    if (!off) return;
    const d = n - centerAt;
    off.textContent = d === 0 ? 'střed' : (d > 0 ? `vpravo +${d}` : `vlevo ${d}`);
    off.classList.toggle('mid', d === 0);
  };
  const sync = from => {
    let n = Math.round(+from.value);
    if (!Number.isFinite(n)) n = min;
    n = Math.min(max, Math.max(min, n));
    sl.value = n; num.value = n;
    showOff(n);
  };
  sl.oninput = () => sync(sl);
  num.oninput = () => { if (num.value !== '') sync(num); };
  num.onblur = () => sync(num);
  return { sl, num, uni, off,
           get: () => +num.value, set: v => sync({ value: v }) };
}

/** Zapnuto/vypnuto + uroven. */
function toggleLevelControl(setting) {
  const min = setting.min ?? 0, max = setting.max ?? 127;
  const sw = el('label', { className: 'switch' });
  const cb = el('input', { type: 'checkbox' });
  const track = el('span', { className: 'track' });
  sw.append(cb, track);
  sw.title = 'zapnuto / vypnuto';
  const p = sliderPart(min, max, setting.unit, setting.centerAt);
  return {
    el: wrap([sw, p.sl, p.num, ...(p.uni ? [p.uni] : []),
              ...(p.off ? [p.off] : [])]),
    read: () => {
      const level = p.get();
      if (!Number.isInteger(level) || level < min || level > max)
        return { error: `úroveň ${level} je mimo rozsah ${min}–${max}` };
      return { value: { on: cb.checked, level } };
    },
    fill: v => {
      if (v == null) return;
      if (typeof v === 'object') {
        if (v.on !== undefined) cb.checked = !!v.on;
        if (v.level !== undefined) p.set(v.level);
      } else if (typeof v === 'number') p.set(v);
    },
    reset: () => p.set(setting.centerAt ?? min),
    setEnabled: on => { cb.disabled = !on; p.sl.disabled = !on; p.num.disabled = !on; },
  };
}

/** Jen uroven. */
function levelControl(setting) {
  const min = setting.min ?? 0, max = setting.max ?? 127;
  const p = sliderPart(min, max, setting.unit, setting.centerAt);
  return {
    el: wrap([p.sl, p.num, ...(p.uni ? [p.uni] : []),
              ...(p.off ? [p.off] : [])]),
    read: () => {
      const v = p.get();
      if (!Number.isInteger(v) || v < min || v > max)
        return { error: `hodnota ${v} je mimo rozsah ${min}–${max}` };
      return { value: v };
    },
    fill: v => { if (typeof v === 'number') p.set(v); },
    setEnabled: on => { p.sl.disabled = !on; p.num.disabled = !on; },
  };
}

/** Cislo v poli. */
function numberControl(setting) {
  const min = setting.min ?? 0, max = setting.max ?? 255;
  const inp = el('input', { type: 'number', min, max, value: min });
  const uni = setting.unit ? el('span', { className: 'unit', textContent: setting.unit }) : null;
  return {
    el: wrap([inp, ...(uni ? [uni] : [])]),
    read: () => {
      const t = inp.value.trim();
      if (!/^-?\d+$/.test(t)) return { error: `"${t}" není celé číslo` };
      const n = +t;
      if (n < min || n > max)
        return { error: `hodnota ${n} je mimo rozsah ${min}–${max}` };
      return { value: n };
    },
    fill: v => { if (typeof v === 'number') inp.value = v; },
    setEnabled: on => { inp.disabled = !on; },
  };
}

/** Rozbalovaci seznam — uzivatel nemusi hadat, co je platne. */
function enumControl(setting) {
  const options = setting.options || [];
  const sel = el('select');
  for (const [v, label] of options)
    sel.appendChild(el('option', { value: String(v), textContent: label }));
  return {
    el: wrap([sel]),
    read: () => {
      if (!options.length) return { error: 'seznam možností je prázdný' };
      const n = +sel.value;
      if (!options.some(([v]) => v === n))
        return { error: `hodnota ${n} není v seznamu povolených` };
      return { value: n };
    },
    fill: v => {
      const n = typeof v === 'boolean' ? (v ? 1 : 0) : v;
      if (typeof n === 'number' && options.some(([o]) => o === n)) sel.value = String(n);
    },
    setEnabled: on => { sel.disabled = !on; },
  };
}

/** Kvalita zvuku: bitrate + SBC bitpool + latence, s prednastavenimi. */
function codecControl(setting) {
  const mk = (label, value, max) => {
    const box = el('label', { className: 'field' });
    box.appendChild(el('span', { className: 'flabel', textContent: label }));
    const i = el('input', { type: 'number', min: 0, max, value: String(value) });
    box.appendChild(i);
    return { box, i };
  };
  const bitrate = mk('bitrate kbps', 197, 65535);
  const bitpool = mk('SBC bitpool', 46, 250);
  const latency = mk('latence ms', 120, 65535);

  const pre = el('select', { className: 'preset' });
  pre.appendChild(el('option', { value: '', textContent: 'přednastavení…' }));
  (setting.presets || []).forEach((p, i) =>
    pre.appendChild(el('option', { value: String(i), textContent: p.label })));
  pre.onchange = () => {
    if (pre.value === '') return;
    const p = setting.presets[+pre.value];
    bitrate.i.value = p.value.bitrate;
    bitpool.i.value = p.value.bitpool;
    latency.i.value = p.value.latency;
  };

  const box = el('div', { className: 'ctl codecbox' });
  if (setting.presets?.length) box.appendChild(pre);
  box.append(bitrate.box, bitpool.box, latency.box);

  return {
    el: box,
    read: () => {
      const nums = [bitrate.i, bitpool.i, latency.i].map(x => +x.value);
      if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 65535))
        return { error: 'hodnoty musí být celá čísla 0–65535' };
      if (nums[1] < 2 || nums[1] > 250)
        return { error: `SBC bitpool ${nums[1]} je mimo rozumný rozsah 2–250` };
      return { value: { bitrate: nums[0], bitpool: nums[1], latency: nums[2],
                        latency2: 0 } };
    },
    fill: v => {
      if (!v || typeof v !== 'object') return;
      if (v.bitrate !== undefined) bitrate.i.value = v.bitrate;
      if (v.bitpool !== undefined) bitpool.i.value = v.bitpool;
      if (v.latency !== undefined) latency.i.value = v.latency;
      pre.value = '';
    },
    setEnabled: on => {
      [bitrate.i, bitpool.i, latency.i, pre].forEach(x => x.disabled = !on);
    },
  };
}

/** Text. */
function textControl() {
  const inp = el('input', { type: 'text', placeholder: 'text' });
  return {
    el: wrap([inp]),
    read: () => inp.value.length ? { value: inp.value } : { error: 'zadej text' },
    fill: v => { if (typeof v === 'string') inp.value = v; },
    setEnabled: on => { inp.disabled = !on; },
  };
}

/** Syrove bajty v hex — jen tam, kde format neni overeny. */
function rawControl(parseHex) {
  const inp = el('input', { type: 'text', placeholder: 'hex, např. 81 00',
                            className: 'hexin' });
  return {
    el: wrap([inp]),
    read: () => {
      const { bytes, error } = parseHex(inp.value);
      if (error) return { error };
      if (!bytes.length) return { error: 'zadej hodnotu v hex' };
      return { value: bytes };
    },
    fill: v => {
      if (v instanceof Uint8Array)
        inp.value = [...v].map(b => b.toString(16).padStart(2, '0')).join(' ');
    },
    setEnabled: on => { inp.disabled = !on; },
  };
}

/**
 * Ekvalizer — vlastni ovladac.
 *
 * Ukazuje profil tak, jak opravdu prisel ze sluchatek: kategorii, pocet
 * pasem a jejich frekvence. Pasma se NEVYMYSLEJI — dokud se profil
 * neprecte, neni co zapisovat, protoze zapis musi poslat i frekvence,
 * typ filtru a Q, ktere zname jen z odpovedi.
 */
function eqControl(setting) {
  const bandMin = setting.bandMin ?? -6;
  const bandMax = setting.bandMax ?? 6;
  const step = setting.bandStep ?? 0.5;

  /** Posledni profil ze sluchatek. Zapis z nej vychazi. */
  let profile = null;
  const sliders = [];

  const box = el('div', { className: 'eqbox' });

  const head = el('div', { className: 'eqhead' });
  const nameEl = el('span', { className: 'eqname', textContent: 'zatím nenačteno' });
  const catSel = el('select', { className: 'eqcat', title: 'kategorie profilu, kterou načíst' });
  for (const [v, label] of (setting.categories || [[0, '0 — vypnuto']]))
    catSel.appendChild(el('option', { value: String(v), textContent: label }));
  head.append(nameEl, el('span', { className: 'grow' }),
              el('span', { className: 'flabel', textContent: 'načíst profil' }), catSel);
  box.appendChild(head);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'eqcurve');
  svg.setAttribute('viewBox', '0 0 320 90');
  svg.setAttribute('preserveAspectRatio', 'none');
  const zero = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  zero.setAttribute('class', 'eqzero');
  zero.setAttribute('x1', 0); zero.setAttribute('x2', 320);
  zero.setAttribute('y1', 45); zero.setAttribute('y2', 45);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  path.setAttribute('class', 'eqline');
  svg.append(zero, path);
  box.appendChild(svg);

  const bandsRow = el('div', { className: 'eqbands' });
  box.appendChild(bandsRow);

  const fmtFreq = f => f >= 1000 ? `${Math.round(f / 100) / 10}k` : `${Math.round(f)}`;

  function redraw() {
    if (!sliders.length) { path.setAttribute('points', ''); return; }
    const n = sliders.length;
    const pts = sliders.map((s, i) => {
      const x = n === 1 ? 160 : (i * 320) / (n - 1);
      const y = 45 - (+s.range.value / bandMax) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    path.setAttribute('points', pts.join(' '));
  }

  function build(bands) {
    bandsRow.textContent = '';
    sliders.length = 0;
    for (const b of bands) {
      const col = el('div', { className: 'eqband' });
      const val = el('span', { className: 'eqval', textContent: b.gain.toFixed(1) });
      const range = el('input', { type: 'range', min: bandMin, max: bandMax,
                                  step, value: String(b.gain) });
      range.classList.add('eqslider');
      const freq = el('span', { className: 'eqfreq', textContent: fmtFreq(b.freq) });
      range.oninput = () => {
        val.textContent = (+range.value).toFixed(1);
        redraw();
      };
      col.append(val, range, freq);
      bandsRow.appendChild(col);
      sliders.push({ range, band: b });
    }
    redraw();
  }

  return {
    el: box,
    /** Kategorie, na kterou se ma zeptat GET. */
    param: () => +catSel.value,
    read: () => {
      if (!profile || !sliders.length)
        return { error: 'nejdřív načti profil ze sluchátek — bez frekvencí ' +
                        'a Q z odpovědi nejde zápis složit' };
      const bands = sliders.map(s => ({
        type: s.band.type,
        gain: +s.range.value,
        freq: s.band.freq,
        q: s.band.q,
      }));
      for (const b of bands)
        if (b.gain < bandMin || b.gain > bandMax)
          return { error: `zisk ${b.gain} dB je mimo rozsah ${bandMin}–${bandMax}` };
      return { value: { ...profile, bands } };
    },
    fill: v => {
      if (!v || !Array.isArray(v.bands)) return;
      profile = v;
      nameEl.textContent = v.bands.length
        ? `${v.name} · ${v.bands.length} pásem`
        : `${v.name} · profil se nevrátil`;
      if (v.category !== undefined &&
          [...catSel.options].some(o => +o.value === v.category))
        catSel.value = String(v.category);
      build(v.bands);
    },
    setEnabled: on => {
      catSel.disabled = !on;
      for (const s of sliders) s.range.disabled = !on;
    },
  };
}

/** Prikaz bez hodnoty. */
function actionControl() {
  return {
    el: wrap([]),
    read: () => ({ value: null }),
    fill: () => {},
    setEnabled: () => {},
  };
}

/**
 * Vyrobi ovladaci prvek podle typu.
 * @param {string} kind
 * @param {object} setting  polozka katalogu (uz slouceny s mapovanim)
 * @param {function} parseHex  parser hex vstupu (z protocol.js)
 */
export function makeControl(kind, setting, parseHex) {
  switch (kind) {
    case 'toggle':      return toggleControl();
    case 'toggleLevel': return toggleLevelControl(setting);
    case 'level':       return levelControl(setting);
    case 'number':      return numberControl(setting);
    case 'enum':        return enumControl(setting);
    case 'codec':       return codecControl(setting);
    case 'text':        return textControl();
    case 'raw':         return rawControl(parseHex);
    case 'eq':          return eqControl(setting);
    case 'action':      return actionControl();
    default:            return null;      // info = zadny zapis
  }
}
