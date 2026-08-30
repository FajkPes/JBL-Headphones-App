// ---------------------------------------------------------------------------
// Klasifikace rizika zapisu podle feature ID.
//
// Uroven:
//   critical - muze zarizeni poskodit nebo znepristupnit. Skryte, odemceni
//              + dve potvrzeni vcetne opsani nazvu.
//   high     - nevratne bez tovarniho resetu, protoze pro danou funkci nema
//              oficialni JBL appka u 780NC zadnou kartu. Skryte, odemceni
//              + dve potvrzeni.
//   medium   - vyrusi, prehraje ton, rozpoji spojeni nebo spusti test.
//              Viditelne, jedno potvrzeni.
//   (nic)    - bezne nastaveni, prepnutelne i v oficialni appce.
//
// Karty, ktere oficialni appka pro 780NC ma (= zapis je vratny):
//   ANC, AA, TT, ControlCard, SmartAudioVideo, Auracast, LeAudio,
//   VoicePrompt, EQ, Spatial3D, PersoniFi, LeftRightBalance, VoiceAware,
//   RelaxSound, AutoPowerOff, Support, Software, ResetToFactory, OTA
// ---------------------------------------------------------------------------

export const RISK = new Map([

  // --- critical ------------------------------------------------------------
  [7936, ['critical',
    'Přepne sluchátka do režimu aktualizace firmwaru. Pokud se přenos ' +
    'nedokončí, zařízení může zůstat nefunkční.']],
  [51, ['critical',
    'Přepíše BLE adresu spárovaného hostitele. Špatná hodnota rozbije ' +
    'párování a sluchátka se nemusí znovu připojit.']],
  [2980, ['critical',
    'Operace nad seznamem spárovaných zařízení — může odpárovat tento ' +
    'počítač nebo telefon a odříznout přístup.']],
  [62, ['critical',
    'Autentizace zařízení. Nesprávný zápis může zablokovat další komunikaci.']],
  [74, ['critical',
    'Volba autentizačního algoritmu. Nesprávný zápis může zablokovat ' +
    'další komunikaci.']],
  [75, ['critical',
    'Rozšířená autentizace zařízení. Nesprávný zápis může zablokovat ' +
    'další komunikaci.']],
  [7, ['critical',
    'Kontrolní součet identity hostitele. Změna může narušit rozpoznání ' +
    'spárovaného zařízení.']],
  [15, ['critical',
    'Tovární reset — smaže všechna nastavení sluchátek.']],

  // --- high: nevratne v oficialni appce ------------------------------------
  [7812, ['high',
    'Nastaví PIN kód ochrany sluchu. Bez znalosti PINu už nastavení ' +
    'nepůjde změnit a oficiální appka pro 780NC tuhle sekci vůbec nemá.']],
  [7809, ['high',
    'Trvalý strop hlasitosti. Oficiální appka pro 780NC nemá kartu ' +
    'ochrany sluchu, takže to půjde vrátit jen odsud nebo továrním resetem.']],
  [7810, ['high',
    'Denní limit poslechu. Oficiální appka to u 780NC neumí zobrazit ' +
    'ani vypnout.']],
  [7819, ['high',
    'Stav vypršení denního limitu. Oficiální appka to u 780NC neřeší.']],
  [37, ['high',
    'Strop hlasitosti. Oficiální appka pro 780NC pro něj nemá kartu, ' +
    'takže ztlumení půjde vrátit jen odsud nebo továrním resetem.']],
  [39, ['high',
    'Limiter hlasitosti. Oficiální appka pro 780NC pro něj nemá kartu.']],
  [40, ['high',
    'Režim Hi-Res. Oficiální appka pro 780NC pro něj nemá kartu, ' +
    'takže zpět jen odsud nebo továrním resetem.']],
  [11590, ['high',
    'Volba audio kodeku. Nevhodná hodnota může zhoršit nebo přerušit ' +
    'přehrávání a oficiální appka to u 780NC nenastavuje.']],
  [3137, ['high',
    'Změna jazyka hlasových hlášek. Jazykové balíčky se do sluchátek ' +
    'nahrávají přes OTA, což tahle appka neumí — pokud vybraný jazyk ' +
    'v zařízení není, hlášky můžou umlknout a nahrát je zpět půjde jen ' +
    'oficiální JBL appkou.']],
  [7811, ['high',
    'Přepíše dnešní naměřený čas poslechu — historii už nevrátíš.']],
  [7813, ['high', 'Přepíše historii průměrné hlasitosti — data se ztratí.']],
  [7814, ['high', 'Přepíše historii času poslechu — data se ztratí.']],

  // --- medium --------------------------------------------------------------
  [17,   ['medium', 'Okamžitě vypne sluchátka a spojení se rozpadne.']],
  [55,   ['medium', 'Spustí vypuzení vody — přehraje hlasitý tón.']],
  [2981, ['medium', 'Přepne do párovacího režimu, aktuální spojení se může rozpojit.']],
  [2976, ['medium', 'Přepnutí LE Audio restartuje zvukové spojení.']],
  [2945, ['medium', 'Spustí skenování Auracast vysílání.']],
  [2947, ['medium', 'Připojí se k vybranému Auracast vysílání.']],
  [2949, ['medium', 'Přepne přehrávanou Auracast podskupinu.']],
  [2951, ['medium', 'Změní kvalitu Auracast vysílání.']],
  [2952, ['medium', 'Nastaví heslo Auracast vysílání.']],
  [4099, ['medium', 'Spustí test těsnosti — přehraje testovací tóny.']],
  [4100, ['medium', 'Spustí měření okolního hluku.']],
  [4106, ['medium', 'Find My Buds — sluchátka začnou hlasitě pípat.']],
  [3079, ['medium', 'Spustí nebo zastaví nahrávání z mikrofonu.']],
  [3078, ['medium', 'Spustí test mikrofonního efektu.']],
  [7424, ['medium', 'Spustí kalibraci sledování pohybu hlavy.']],
  [7425, ['medium', 'Krok kalibrace sledování hlavy.']],
  [7426, ['medium', 'Krok kalibrace sledování hlavy.']],
  [7680, ['medium', 'Přepne režim PersoniFi — může přenastavit zvukový profil.']],
  [7681, ['medium', 'Spustí režim sluchového testu, přehraje testovací tóny.']],
  [7682, ['medium', 'Spustí průvodce nastavením PersoniFi.']],
  [7683, ['medium', 'Přepne stranu sluchového testu.']],
  [7684, ['medium', 'Nastaví frekvenci sluchového testu.']],
  [7815, ['medium', 'Nahraje vlastní hlasové připomenutí.']],
  [7816, ['medium', 'Smaže nahrané hlasové připomenutí.']],
  [7817, ['medium', 'Připraví nahrávání nebo přehrání hlasového připomenutí.']],
  [7818, ['medium', 'Připraví nahrávání nebo přehrání hlasového připomenutí.']],
  [11584,['medium', 'Řídí přehrávání zvuku.']],
  [11585,['medium', 'Ztlumí nebo odtlumí zvuk.']],
  [50,   ['medium', 'Smaže všechna uložená oznámení.']],

  // EQ - format hodnot zatim neni overeny, zapis muze zapsat nesmysl
  [3586, ['medium', 'Formát hodnot EQ zatím není ověřený — zápis může uložit nesmyslnou křivku.']],
  [3587, ['medium', 'Formát hodnot EQ zatím není ověřený — zápis může uložit nesmyslnou křivku.']],
  [3711, ['medium', 'Formát hodnot EQ zatím není ověřený — zápis může uložit nesmyslnou křivku.']],
  [3713, ['medium', 'Změní počet uložených vlastních EQ profilů.']],
]);

export const levelOf = id => RISK.get(id)?.[0] || null;
export const reasonOf = id => RISK.get(id)?.[1] || '';
export const isHidden = id => {
  const l = levelOf(id);
  return l === 'critical' || l === 'high';
};

// Na tyhle nesahame ani ctenim - GET na rezim OTA je zbytecne riziko.
export const NEVER_TOUCH = new Set([7936]);
