// ---------------------------------------------------------------------------
// TVRDA POJISTKA — kontrola SUROVYCH BAJTU tesne pred zapisem.
//
// Vsechny ostatni pojistky (zamek rizikovych zapisu, potvrzovaci okno,
// filtr pri obnove zalohy) se daji obejit tim, ze nekdo zavola nizsi
// vrstvu nebo posle spatnou hodnotu z jineho tlacitka. Tohle uz ne:
// sedi to primo nad BLE.writeFrame, takze KAZDY bajt, ktery ma odejit
// do sluchatek, projde tudy — z UI, z obnovy zalohy, z rucniho prikazu
// i z konzole prohlizece.
//
// Rozhoduje se podle skutecneho obsahu ramce, ne podle toho, kdo ho
// poslal nebo jak se jmenuje tlacitko. I kdyby se do zapisu dostala
// poskozena nebo prohozena hodnota, ktera nahodou slozi destruktivni
// sekvenci, tady se zastavi.
//
// ZADNE ODEMCENI NEEXISTUJE. Neni tu prepinac, token ani heslo —
// zamerne, aby nesel omylem prehodit ani vyvolat skriptem. Pokud by
// nekdy bylo opravdu potreba nektery prikaz poslat, musi se smazat
// z tabulky nize a soubor ulozit. To je vedomy zasah do zdrojaku,
// ne kliknuti.
// ---------------------------------------------------------------------------

import * as P from '../protocol.js';

/**
 * Protocol 4 — feature ID, na ktere se NIKDY nesmi zapsat.
 * Cteni u nich blokovane neni (nic nemeni), krom seznamu nize.
 */
const P4_NO_WRITE = new Map([
  [15,   ['Tovární reset', 'Smaže všechna nastavení sluchátek. Nejde vzít zpět.']],
  [7,    ['Kontrolní součet hostitele',
          'Změna může narušit rozpoznání spárovaného zařízení.']],
  [51,   ['BLE adresa hostitele',
          'Špatná hodnota rozbije párování a sluchátka se nemusí připojit.']],
  [62,   ['Autentizace zařízení', 'Nesprávný zápis může zablokovat komunikaci.']],
  [74,   ['Autentizační algoritmus', 'Nesprávný zápis může zablokovat komunikaci.']],
  [75,   ['Rozšířená autentizace', 'Nesprávný zápis může zablokovat komunikaci.']],
  [2980, ['Operace se spárovanými zařízeními',
          'Může odpárovat tenhle počítač a odříznout přístup.']],
  [7812, ['PIN ochrany sluchu',
          'Zamkne nastavení ochrany sluchu. Bez PINu už nepůjde změnit.']],
  [50,   ['Smazání všech oznámení', 'Nevratně smaže uložená oznámení.']],
]);

/** Protocol 4 — na tyhle ID se nesaha vubec, ani ctenim. */
const P4_NO_TOUCH = new Map([
  [7936, ['Režim aktualizace firmwaru (OTA)',
          'Nedokončený přenos může nechat sluchátka nefunkční.']],
]);

/** Protocol 3 — cisla prikazu, ktera jsou destruktivni sama o sobe. */
const P3_NO_SEND = new Map([
  [0x95, ['Tovární reset', 'Smaže všechna nastavení sluchátek. Nejde vzít zpět.']],
]);

/**
 * Podiva se na bajty, ktere maji odejit, a rekne, jestli je to
 * destruktivni sekvence. Vraci popis, nebo null.
 *
 * @param {number} protocol 3 nebo 4
 * @param {Uint8Array} bytes cely ramec
 */
export function classify(protocol, bytes) {
  if (!bytes || !bytes.length) return null;

  if (protocol === 3) {
    if (bytes[0] !== 0xAA || bytes.length < 2) return null;
    const f = P3_NO_SEND.get(bytes[1]);
    return f ? { name: f[0], why: f[1], addr: `cmd 0x${bytes[1].toString(16)}` } : null;
  }

  if (protocol !== 4) return null;

  const f = P.parseFrame(bytes);
  if (!f) return null;

  // Prikaz "reset do tovarniho nastaveni" nema payload — pozna se
  // podle cisla prikazu.
  if (f.commandId === P.CMD.RESET_TO_FACTORY)
    return { name: 'Tovární reset (příkaz 0x00FF)',
             why: 'Smaže všechna nastavení sluchátek. Nejde vzít zpět.',
             addr: 'cmd 0x00ff' };

  const isSet = f.commandId === P.CMD.SET_DEVICE_INFO;
  const isGet = f.commandId === P.CMD.GET_DEVICE_INFO;
  if (!isSet && !isGet) return null;

  // U GET je payload seznam dvoubajtovych ID, u SET je to TLV.
  const ids = [];
  if (isGet) {
    for (let i = 0; i + 1 < f.payload.length; i += 2)
      ids.push(f.payload[i] | (f.payload[i + 1] << 8));
  } else {
    for (const t of P.parseTLV(f.payload)) ids.push(t.id);
    // Kdyz se TLV nerozebere (useknuty nebo poskozeny paket), podivame se
    // aspon na prvni dva bajty. Zakazane ID nesmi proklouznout tim, ze
    // bude zbytek paketu rozbity.
    if (!ids.length && f.payload.length >= 2)
      ids.push(f.payload[0] | (f.payload[1] << 8));
  }

  for (const id of ids) {
    const any = P4_NO_TOUCH.get(id);
    if (any) return { name: any[0], why: any[1], addr: `ID ${id}` };
    if (isSet) {
      const w = P4_NO_WRITE.get(id);
      if (w) return { name: w[0], why: w[1], addr: `ID ${id}` };
    }
  }
  return null;
}

/**
 * Protokoly, ktere tahle pojistka umi zkontrolovat.
 *
 * Pravidla nejsou vazana na model, ale na protokol — takze plati stejne
 * pro 780NC, 720BT i pro kazdy dalsi model, ktery se pridá. Nove
 * mapovani nemuze pojistku obejit ani omylem, protoze se na ni nikde
 * neodkazuje: kontroluje se az hotovy ramec.
 */
export const PROTECTED_PROTOCOLS = new Set([3, 4]);

/**
 * Jediny vstupni bod pro odesilaci vrstvu.
 * Kdyz vrati blocked, ramec se NESMI odeslat. Zadny parametr to nezmeni.
 *
 * Zamerne se chova FAIL-CLOSED: u protokolu, ktery tahle pojistka nezna,
 * neodejde nic. Kdyby se pridal dalsi protokol a zapomnelo se na pravidla,
 * appka prestane posilat a rekne proc — misto aby tise posilala cokoli.
 */
export function inspect(protocol, bytes) {
  if (!PROTECTED_PROTOCOLS.has(protocol))
    return { blocked: true,
             name: `Protokol ${protocol} nemá bezpečnostní pravidla`,
             addr: `protokol ${protocol}`,
             why: 'Dokud pro protokol nejsou v core/guard.js vyjmenované ' +
                  'destruktivní sekvence, neodešle se do sluchátek nic. ' +
                  'Radši nefunkční appka než příkaz, který nikdo nezkontroloval.' };
  const hit = classify(protocol, bytes);
  return hit ? { blocked: true, ...hit } : { blocked: false };
}

/** Pro UI a testy: co je natrvalo zablokovane. */
export function forbiddenList(protocol) {
  if (protocol === 3)
    return [...P3_NO_SEND].map(([c, [n, w]]) =>
      ({ addr: `cmd 0x${c.toString(16)}`, name: n, why: w, scope: 'cokoli' }));
  return [
    ...[...P4_NO_TOUCH].map(([id, [n, w]]) =>
      ({ addr: `ID ${id}`, name: n, why: w, scope: 'čtení i zápis' })),
    ...[...P4_NO_WRITE].map(([id, [n, w]]) =>
      ({ addr: `ID ${id}`, name: n, why: w, scope: 'zápis' })),
  ];
}
