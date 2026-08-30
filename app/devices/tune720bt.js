// ---------------------------------------------------------------------------
// JBL TUNE 720BT — PID 20B4, Protocol 3.
//
// Podmnozina univerzalniho katalogu. Co tu neni, se v UI vubec neobjevi —
// proto 720BT nema Auracast, LE Audio, Personi-Fi ani prostorovy zvuk.
//
// Kazdy zaznam musi rict, jak se cte (get), jak se pise (set) a jak se
// z dekoderu vytahne hodnota pro ovladaci prvek (read). Nic se nehada.
// Dekodery jsou v protocol3.js a jsou overene na realnych datech.
// ---------------------------------------------------------------------------

import * as P3 from '../protocol3.js';

const f = P3.frame;
const V = P3.VALUES;                      // index -> bajt podle CmdBase.values
const val = v => V[v] ?? v;

/**
 * EQ predvolby PRO TENHLE MODEL.
 *
 * Hodnoty jsou cmdIndex z analysis/config/jbl_tune_720bt.json, tedy z
 * konfigurace, kterou pro 720BT pouziva sama oficialni appka. Obecny
 * seznam z EnumEqPresetIdx (0-7) sem NEPATRI — 720BT nema Rock ani Piano
 * a Club je pod 19, ne 7. Posilat obecne indexy by znamenalo nastavovat
 * predvolby, ktere v tomhle kuse neexistuji.
 */
const EQ_PRESETS = [
  [0,  '0 — vypnuto'],
  [1,  '1 — Jazz'],
  [2,  '2 — Vocal'],
  [3,  '3 — Bass'],
  [8,  '8 — Extreme Bass'],
  [19, '19 — Club'],
  [20, '20 — Studio'],
];

/** Co ktery typ stavoveho dotazu vrati. Z HandleParse.parseDevStatus. */
const DEV_STATUS = [
  [0x30, '0x30 — souhrn všeho najednou'],
  [0x31, '0x31 — ANC'],
  [0x32, '0x32 — Ambient Aware / TalkThru'],
  [0x33, '0x33 — automatické vypnutí'],
  [0x34, '0x34 — EQ předvolba'],
  [0x35, '0x35 — Multi AI (hlasový asistent)'],
  [0x36, '0x36 — stav BT spojení'],
  [0x37, '0x37 — průběh aktualizace firmwaru'],
  [0x38, '0x38 — auto play / pauza'],
  [0x39, '0x39 — stav TWS spojení'],
  [0x3A, '0x3A — PersoniFi test'],
];

export default {
  id: 'tune720bt',
  model: 'JBL TUNE 720BT',
  pid: '20B4',
  protocol: 3,
  accent: '#3fa7ff',
  namePrefix: 'JBL',
  verified: true,
  note: 'Ověřeno na reálném kusu. Mapování obsahuje jen to, na co sluchátka ' +
        'opravdu odpověděla, nebo co jde jen zapsat. Příkazy, které firmware ' +
        'ignoroval, jsou dole v poznámce — zkusit je jde ručním příkazem.',

  officialGroups: ['device', 'eq', 'balance', 'voiceaware',
                   'quality', 'controls', 'prompts', 'power', 'danger'],

  map: {
    // --- zařízení ---
    // Jedna odpoved 0x12 nese nazev, PID i MAC. Kazdy radek si z ni bere
    // svuj kus, takze staci jeden dotaz misto tri.
    deviceName: { cmd: 0x11, listen: [0x11, 0x12], label: 'Název zařízení',
      get: () => f(0x11), read: d => d.name ?? d.text },
    model: { cmd: 0x11, listen: [0x11, 0x12],
      read: d => (d.pid ? `PID ${d.pid}` : null) },
    macAddress: { cmd: 0x11, listen: [0x11, 0x12], read: d => d.mac ?? null },
    serialLeft: { cmd: 0x94, listen: [0x94], label: 'Sériové číslo',
      get: () => f(0x94, [1]), read: d => d.text },
    batteryLeft: { cmd: 0x25, listen: [0x25], label: 'Baterie', unit: '%',
      get: () => f(0x25, [0]), read: d => d.level ?? null },

    // --- ekvalizér ---
    // Predvolba se ZAPISUJE na 0x40, ale CTE se jako stav zarizeni typu
    // 0x34 (aa 21 01 34). Samostatny dotaz na 0x40 firmware ignoruje.
    // Predvolba se ZAPISUJE na 0x40. Cist ji jde jen ze souhrnneho stavu —
    // samostatny dotaz (typ 0x34) firmware ignoruje, zmereno na HW.
    eqPreset: { cmd: 0x40, listen: [0x40, 0x22], kind: 'enum', options: EQ_PRESETS,
      via: 'deviceStatusQuery',
      nameOf: v => P3.EQ_CATEGORY_NAMES.get(v) || null,
      set: v => f(0x40, [v]),
      read: d => d.eqPreset ?? d.byte ?? undefined },

    // EQ po pasmech pres 0x42/0x43 (starsi rada). Index profilu vybira
    // rozbalovaci seznam v ovladaci — firmware na kazdy index odpovida
    // zvlast a ktery je ten spravny, ukaze Pruzkum.
    eqBands: { cmd: P3.CUSTOM_EQ_GET, listen: [P3.CUSTOM_EQ_RET], kind: 'eq',
      categories: [[0, 'profil 0'], [1, 'profil 1'], [2, 'profil 2'],
                   [3, 'profil 3'], [4, 'profil 4 — vlastní'], [5, 'profil 5'],
                   [6, 'profil 6'], [7, 'profil 7']],
      risk: 'medium',
      why: 'Zapisuje celou křivku ekvalizéru včetně frekvencí a Q. Formát je ' +
           'odvozený ze SDK, ale na tomhle modelu zatím neověřený.',
      desc: 'Vyber index profilu a dej GET. Pokud firmware odpoví, načtou se ' +
            'pásma i s frekvencemi a jde je zapsat zpět.',
      get: idx => P3.customEqGet(idx ?? 0),
      set: v => P3.customEqSet(v),
      read: d => d.customEq ?? undefined },

    // --- ochrana sluchu (Safe Sound, rámec s 2B délkou) ---
    // Na testovanem kuse firmware na 0x51 nereagoval, ale v oficialni appce
    // tahle karta je — necháváme ji tu, aby sla vyzkouset Pruzkumem.
    safeMaxVolume: { cmd: 0x51, listen: [0x51], kind: 'number', max: 255,
      label: 'Strop hlasitosti (Safe Sound)',
      get: () => P3.safeGet([1]), set: v => P3.safeSet(1, [v & 0xff]) },
    safeVolume: { cmd: 0x51, listen: [0x51], kind: 'number', max: 255,
      get: () => P3.safeGet([2]), set: v => P3.safeSet(2, [v & 0xff]) },
    safeDailyLimitOn: { cmd: 0x51, listen: [0x51], kind: 'toggle',
      get: () => P3.safeGet([3]), set: v => P3.safeSet(3, [v ? 1 : 0]) },
    safeDailyLimit: { cmd: 0x51, listen: [0x51], kind: 'number', max: 255,
      unit: 'min',
      get: () => P3.safeGet([4]), set: v => P3.safeSet(4, [v & 0xff]) },
    safeTodayTime: { cmd: 0x51, listen: [0x51], kind: 'info',
      get: () => P3.safeGet([5]) },

    // --- vyvážení ---
    lrBalance: { cmd: 0xA8, listen: [0xA8], kind: 'toggleLevel',
      get: () => f(0xA8, [1]),
      set: v => f(0xA8, [0, 1, v.on ? 1 : 0, 2, v.level & 0xff]),
      read: d => (d.on === undefined && d.level === undefined) ? null
                 : { on: !!d.on, level: d.level ?? 0 } },

    // --- Voice Aware ---
    voiceAware: { cmd: 0x98, listen: [0x98], kind: 'enum',
      options: [[0, '0 — vypnuto'], [1, '1'], [2, '2'], [3, '3'], [4, '4'],
                [5, '5 — nejvyšší']],
      get: () => f(0x98, [1]), set: v => f(0x98, [0, val(v)]),
      read: d => d.level ?? d.byte ?? null },

    // --- kvalita ---
    // OVERENO: dotaz 0x82 bez payloadu -> odpoved 0x83. Zapis jde na 0x81.
    smartSwitch: { cmd: 0x82, listen: [0x80, 0x81, 0x82, 0x83], kind: 'codec',
      risk: 'medium',
      why: 'Změna parametrů kodeku může krátce přerušit přehrávání.',
      presets: [
        { label: 'Normální (197 kbps / 46 / 120 ms)',
          value: { bitrate: 197, bitpool: 46, latency: 120, latency2: 0 } },
        { label: 'Zvuk — vyšší bitrate (256 / 46 / 120 ms)',
          value: { bitrate: 256, bitpool: 46, latency: 120, latency2: 0 } },
        { label: 'Video — nižší latence (197 / 46 / 90 ms)',
          value: { bitrate: 197, bitpool: 46, latency: 90, latency2: 0 } },
      ],
      get: () => f(0x82),
      set: v => f(0x81, [
        v.bitrate & 0xff, (v.bitrate >> 8) & 0xff,
        v.bitpool & 0xff, (v.bitpool >> 8) & 0xff,
        v.latency & 0xff, (v.latency >> 8) & 0xff,
        0xFF, 0xFF]),
      read: d => d.codec ? { bitrate: d.codec.aac, bitpool: d.codec.sbc,
                             latency: d.codec.lat, latency2: 0 } : null },

    // --- gesta ---
    // Zapis jde na 0x35, stav se cte jako stav zarizeni typu 0x38.
    autoPlayPause: { cmd: 0x35, listen: [0x22], kind: 'toggle',
      via: 'deviceStatusQuery',
      set: v => f(0x35, [v ? 1 : 0]),
      read: d => d.autoPlayPause ?? undefined },

    // --- hlasové hlášky ---
    // Prikaz 0x93 nese pod ruznymi sub-prikazy ruzne veci:
    //   dotaz [1] -> odpoved sub 2: jazyk + verze balicku
    //   dotaz [4] -> odpoved sub 5: typ hlasek (0 = tony, 1 = mluvene)
    //   zapis [3, 0|1]                    (generateSetVoicePromptsStatusCmd)
    // Drive tady byl jeden radek, ktery zapisoval typ hlasek, ale cetl
    // jazyk — proto ukazoval nesmysl.
    voicePrompt: { cmd: 0x93, listen: [0x93], kind: 'toggle',
      label: 'Mluvené hlášky místo tónů',
      get: () => f(0x93, [4]), set: v => f(0x93, [3, v ? 1 : 0]),
      read: d => (d.voiceType === undefined ? null : d.voiceType === 1) },
    voicePromptLang: { cmd: 0x93, listen: [0x93], kind: 'info',
      label: 'Jazyk hlášek',
      get: () => f(0x93, [1]), read: d => (d.lang === undefined ? null : d.lang) },
    voiceFileVersion: { cmd: 0x93, listen: [0x93], kind: 'info',
      read: d => d.version ?? null },

    // --- Bluetooth ---
    // Zapis na 0x34, cteni jako stav zarizeni typu 0x35.
    multiAi: { cmd: 0x34, listen: [0x22], kind: 'enum', risk: 'medium',
      via: 'deviceStatusQuery',
      set: v => f(0x34, [v]),
      read: d => d.multiAi ?? undefined },

    // --- napájení ---
    // Auto vypnuti se ZAPISUJE na 0x33, ale samostatny dotaz na 0x33
    // firmware ignoruje. Cte se jako stav zarizeni typu 0x33
    // (aa 21 01 33) — a je i v souhrnu 0x30.
    autoPowerOff: { cmd: 0x33, listen: [0x33, 0x22], kind: 'toggleLevel',
      max: 127, unit: 'min',
      via: 'deviceStatusQuery',
      set: v => f(0x33, [((v.on ? 1 : 0) << 7) | (v.level & 0x7f)]),
      read: d => d.autoOff
        ? { on: d.autoOff.on, level: d.autoOff.minutes }
        : (d.on === undefined ? undefined : { on: !!d.on, level: d.level ?? 0 }) },
    manualPowerOff: { cmd: 0x97, kind: 'action', risk: 'medium',
      set: () => f(0x97) },

    // --- diagnostika ---
    multiStatus: { cmd: 0x9B, listen: [0x9B], get: () => f(0x9B, [1, 1]),
      read: d => d.text },
    deviceStatusQuery: { cmd: 0x21, listen: [0x22], kind: 'enum',
      options: DEV_STATUS,
      desc: 'Vyber typ a dej SET — odpověď přijde jako stav zařízení. ' +
            'Typ 0x30 vrací blok, ve kterém je mimo jiné auto vypnutí.',
      get: () => f(0x21, [0x30]), set: v => f(0x21, [v]),
      read: d => d.text },
    earTest: { cmd: 0x21, listen: [], kind: 'enum',
      set: v => f(0x21, [v]) },
    twsStatus: { cmd: 0x21, listen: [0x22], via: 'deviceStatusQuery',
      read: d => (d.tws === undefined ? undefined : (d.tws ? 'připojeno' : 'nepřipojeno')) },

    // Tovarni reset (0x95) tu zamerne NENI. Blokuje ho core/guard.js
    // na urovni bajtu, takze radek by slo jen kliknout a dostat chybu.
  },

  /**
   * Co firmware NEUMI.
   *
   * Zmereno 2026-08-18 na testovanem 720BT: na tyhle dotazy sluchatka
   * neodpovedela ANI JEDNOU. Ramce jsou pritom bajt po bajtu stejne, jak je
   * sklada oficialni SDK (CmdGen + CommandHeader), takze to neni chyba
   * dotazu — tenhle model ty funkce proste nema.
   *
   * Proto tu nejsou v mapovani: v UI by z nich byly radky, ktere navzdy
   * zustanou cervene. Vyzkouset je porad jde rucnim prikazem dole u logu.
   */
  knownUnsupported: [
    ['0x31 / 0x32 / 0x75', 'přímý dotaz na ANC a Ambient Aware — 720BT ANC nemá ' +
     '(stav se ale dá přečíst přes stav zařízení 0x21)'],
    ['0x79', 'dotykový panel — 720BT se ovládá tlačítky'],
    ['0x51', 'Safe Sound (ochrana sluchu), všech 8 položek'],
    ['0x78', 'function control'],
    ['0x96', 'standby režim'],
    ['0x92', 'hotword'],
    ['0x23', 'pípání sluchátek'],
    ['0xa2', 'novější ekvalizér (EQCmd) — šest dotazů, ani jedna odpověď. ' +
             'Tenhle model používá starší 0x41/0x42/0x43, které tu namapované jsou.'],
    ['0x21 typy 0x31–0x39', 'jednotlivé stavové dotazy. Odpovídá JEN souhrn 0x30, ' +
             'takže se z něj plní auto vypnutí, EQ předvolba, Multi AI, ' +
             'auto play i TWS naráz.'],
    ['—', 'strop hlasitosti (max volume limit) — v Protocolu 3 existuje jen ' +
          'přes Safe Sound 0x51, na který tenhle firmware neodpovídá'],
    ['—', 'změna jazyka hlášek — Protocol 3 pro ni nemá příkaz vůbec, ' +
          'jazykové sady se nahrávají přes OTA (0x93 umí jazyk jen přečíst)'],
  ],
};
