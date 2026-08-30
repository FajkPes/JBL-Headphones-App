// ---------------------------------------------------------------------------
// Rejstrik podporovanych sluchatek.
//
// Pridat dalsi model = pridat jeden soubor s mapovanim a jeden radek sem.
// Nic jineho se nemeni: UI, zaloha, potvrzeni i bezpecnostni pravidla
// pracuji s univerzalnimi klici z catalog.js.
// ---------------------------------------------------------------------------

import tune780nc from './tune780nc.js';
import tune720bt from './tune720bt.js';
import * as P4 from '../proto/p4.js';
import * as P3 from '../proto/p3.js';

export const DEVICES = [tune780nc, tune720bt];
export const BY_ID = new Map(DEVICES.map(d => [d.id, d]));

const ADAPTERS = { 4: P4, 3: P3 };

/** Vyrobi adapter odpovidajici protokolu profilu. */
export function adapterFor(profile) {
  const mod = ADAPTERS[profile.protocol];
  if (!mod) throw new Error(`protokol ${profile.protocol} neznám`);
  return mod.create(profile);
}

/** Profil podle id z URL / localStorage, s rozumnym vychozim. */
export function resolve(id) {
  return BY_ID.get(id) || DEVICES[0];
}
