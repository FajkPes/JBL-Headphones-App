// ---------------------------------------------------------------------------
// UNIVERZALNI KATALOG NASTAVENI
//
// Tohle je JEDINE misto, kde je popsane, jak nastaveni vypada v UI:
// jak se jmenuje, do jake kategorie patri, jaky ma ovladaci prvek,
// jaky rozsah a jak je nebezpecne.
//
// Katalog NEZNA zadny protokol. Ktera nastaveni existuji u konkretnich
// sluchatek a jak se ctou/zapisuji, urcuje mapovani v devices/*.js.
// Co v mapovani neni, se v UI vubec nezobrazi.
//
// kind (typ ovladace):
//   info        jen ke cteni, zadny zapis
//   toggle      zapnuto / vypnuto
//   toggleLevel zapnuto/vypnuto + uroven (posuvnik)
//   level       jen uroven (posuvnik)
//   number      cislo v poli
//   enum        rozbalovaci seznam (options)
//   codec       kvalita: bitrate + SBC bitpool + latence
//   text        textovy retezec
//   raw         syrove bajty v hex (jen kdyz format neni overeny)
//   action      prikaz bez hodnoty (tlacitko)
// ---------------------------------------------------------------------------

/** Zalozky v poradi, v jakem se maji zobrazit. */
export const TABS = ['Zařízení', 'Zvuk', 'Ovládání', 'Připojení', 'Systém'];

/**
 * Kategorie (karty). tab urcuje zalozku, poradi v poli poradi v ni.
 *
 * Delici pravidlo:
 *   Zařízení  co sluchátka jsou a v jakem jsou stavu — nic se tim nelaď
 *   Zvuk      cokoli, co meni, JAK to zni
 *   Ovládání  jak se sluchátkam rika, co maji delat, a co rikaji zpatky
 *   Připojení cesta zvuku dovnitr — Bluetooth, LE Audio, Auracast
 *   Systém    chovani pristroje mimo zvuk: napajeni, rezimy, destruktivni akce
 */
export const GROUPS = [
  { key: 'device',     tab: 'Zařízení',  title: 'Zařízení a baterie' },
  { key: 'diag',       tab: 'Zařízení',  title: 'Diagnostika' },

  // Ambient Sound Control je zvukove nastaveni, ne prehled stavu —
  // proto patri sem, a jako prvni, protoze se pouziva nejcasteji.
  { key: 'ambient',    tab: 'Zvuk',      title: 'Ambient Sound Control',
    note: 'Hlavní vypínač je „Ambient Sound Control“. Režimy pod ním se zapínají ' +
          'nastavením úrovně — zapnutím jednoho se ostatní obvykle vypnou.' },
  { key: 'eq',         tab: 'Zvuk',      title: 'Ekvalizér' },
  { key: 'spatial',    tab: 'Zvuk',      title: 'Prostorový zvuk' },
  { key: 'balance',    tab: 'Zvuk',      title: 'Vyvážení L / R' },
  { key: 'voiceaware', tab: 'Zvuk',      title: 'Voice Aware' },
  { key: 'quality',    tab: 'Zvuk',      title: 'Kvalita, kodek a latence',
    note: 'Windows u A2DP nabízí obvykle jen SBC — největší praktický vliv má ' +
          'SBC bitpool. Vyšší bitpool = vyšší datový tok = citlivější spoj.' },
  { key: 'personifi',  tab: 'Zvuk',      title: 'Personi-Fi' },
  // Ochrana sluchu i PSAP menί hlasitost — patri ke zvuku, ne k systemu.
  { key: 'safe',       tab: 'Zvuk',      title: 'Ochrana sluchu' },
  { key: 'psap',       tab: 'Zvuk',      title: 'PSAP — dorovnání sluchu' },

  { key: 'controls',   tab: 'Ovládání',  title: 'Gesta a tlačítka' },
  { key: 'prompts',    tab: 'Ovládání',  title: 'Hlasové hlášky' },
  { key: 'mic',        tab: 'Ovládání',  title: 'Mikrofon a hovory' },

  { key: 'auracast',   tab: 'Připojení', title: 'Auracast' },
  { key: 'leaudio',    tab: 'Připojení', title: 'LE Audio a zdroje zvuku' },
  { key: 'bt',         tab: 'Připojení', title: 'Bluetooth a párování' },

  { key: 'power',      tab: 'Systém',    title: 'Napájení a uspání' },
  { key: 'relax',      tab: 'Systém',    title: 'Relax a usínání' },
  { key: 'danger',     tab: 'Systém',    title: 'Nebezpečné operace',
    note: 'Odemyká se přepínačem „rizikové zápisy“ v horní liště.' },
];

// --- sdilene ciselniky ------------------------------------------------------

/** Akce, ktere jde priradit gestu. Hodnoty z product_gesture_config.json. */
export const GESTURE_ACTIONS = [
  [0x00, 'Nic'],
  [0x01, 'Zesílit'],
  [0x02, 'Zeslabit'],
  [0x05, 'Další skladba'],
  [0x06, 'Předchozí skladba'],
  [0x08, 'Přehrát / pauza'],
  [0x0B, 'Ambient Sound — přepnout režim'],
  [0x0F, 'TalkThru zap/vyp'],
  [0xA1, 'Hlasový asistent'],
  [0xB2, 'Ekvalizér — výběr'],
  [0xC2, 'Prostorový zvuk zap/vyp'],
  [0xC8, 'Ekvalizér zap/vyp'],
];

export const SPATIAL_SCENES = [
  [0, '0 — Film'], [1, '1 — Hudba'], [2, '2 — Hra'],
];

/** Jazyky hlasovych hlasek. Ordinaly ze SDK nejsou overene. */
export const VOICE_LANGS = [
  [0, '0 — English'], [1, '1 — 中文'], [2, '2 — Deutsch'], [3, '3 — Français'],
  [4, '4 — Español'], [5, '5 — Italiano'], [6, '6 — 日本語'], [7, '7 — 한국어'],
];

// --- katalog ----------------------------------------------------------------
// Poradi v tomhle poli urcuje poradi radku v karte.

export const SETTINGS = [

  // ===== Zařízení =====
  { key:'deviceName',   group:'device', kind:'info', label:'Název zařízení' },
  { key:'model',        group:'device', kind:'info', label:'Model (PID)' },
  { key:'colorId',      group:'device', kind:'info', label:'Barevná varianta' },
  { key:'firmware',     group:'device', kind:'info', label:'Verze firmwaru' },
  { key:'serialLeft',   group:'device', kind:'info', label:'Sériové číslo — levé' },
  { key:'serialRight',  group:'device', kind:'info', label:'Sériové číslo — pravé' },
  { key:'macAddress',   group:'device', kind:'info', label:'BT adresa' },
  { key:'macSecondary', group:'device', kind:'info', label:'BT adresa — druhý bud' },
  { key:'batteryLeft',  group:'device', kind:'info', label:'Baterie — levé' },
  { key:'batteryRight', group:'device', kind:'info', label:'Baterie — pravé' },
  { key:'batteryCase',  group:'device', kind:'info', label:'Baterie — pouzdro' },
  { key:'btStatus',     group:'device', kind:'info', label:'Stav BT spojení' },
  { key:'mtu',          group:'device', kind:'info', label:'MTU' },
  { key:'playbackTime', group:'device', kind:'info', label:'Celkový čas přehrávání' },
  { key:'poweronTime',  group:'device', kind:'info', label:'Celkový čas zapnutí' },

  // ===== Ambient Sound Control =====
  { key:'ascMaster', group:'ambient', kind:'toggle', label:'Ambient Sound Control',
    desc:'Hlavní vypínač celé sekce. Vypnutím se vypne ANC i Ambient Aware.' },
  { key:'anc', group:'ambient', kind:'toggleLevel', label:'Potlačení hluku (ANC)',
    min:0, max:127, desc:'Úroveň potlačení hluku, 127 = maximum.' },
  { key:'ambientAware', group:'ambient', kind:'toggleLevel', label:'Ambient Aware',
    min:0, max:127, desc:'Propouští okolní zvuky dovnitř.' },
  { key:'talkThru', group:'ambient', kind:'toggleLevel', label:'TalkThru',
    min:0, max:127, desc:'Ztlumí hudbu a zesílí hlasy, aby šlo mluvit bez sundání.' },
  { key:'adaptiveAnc', group:'ambient', kind:'toggle', label:'Adaptivní ANC' },
  { key:'trueAdaptiveAnc', group:'ambient', kind:'info', label:'True Adaptive ANC' },
  { key:'ancAlwaysOn', group:'ambient', kind:'info', label:'ANC vždy zapnuté' },
  { key:'autoCompensation', group:'ambient', kind:'toggle', label:'Automatická kompenzace' },
  { key:'leakageComp', group:'ambient', kind:'info', label:'Kompenzace netěsnosti' },
  { key:'earCanalComp', group:'ambient', kind:'info', label:'Kompenzace zvukovodu' },
  { key:'ancTuning', group:'ambient', kind:'enum', label:'ANC tuning — dotaz',
    options:[[0,'0 — neurčeno'],[1,'1 — ANC'],[2,'2 — Ambient Aware']],
    desc:'Vybere, čeho se dotaz na doladění týká.' },

  // ===== Ekvalizér =====
  { key:'eqPreset', group:'eq', kind:'enum', label:'Předvolba ekvalizéru' },
  { key:'eqBands', group:'eq', kind:'eq', label:'Ekvalizér — pásma',
    bandMin:-6, bandMax:6, bandStep:0.5,
    desc:'Deset pásem 32 Hz až 16 kHz. Načti profil ze sluchátek, uprav ' +
         'pásma a zapiš — posílá se přesně to, co je na křivce.' },
  { key:'eqInfoQuery', group:'eq', kind:'number', label:'EQ — dotaz na profil',
    min:0, max:255 },
  { key:'eqInfo', group:'eq', kind:'raw', label:'EQ — data profilu',
    desc:'Formát není ověřený. Nejdřív si to načti přes GET a odvoď strukturu.' },
  { key:'eqSequence', group:'eq', kind:'raw', label:'EQ — pořadí profilů' },
  { key:'eqCurve', group:'eq', kind:'raw', label:'EQ — křivka',
    desc:'10 pásem 32 · 64 · 125 · 250 · 500 · 1k · 2k · 4k · 8k · 16k Hz, ±6 dB. ' +
         'Kódování zatím není ověřené.' },
  { key:'eqDesignRaw', group:'eq', kind:'info', label:'EQ — syrová data návrhu' },
  { key:'dynamicEq', group:'eq', kind:'info', label:'Dynamický EQ' },
  { key:'customEqCount', group:'eq', kind:'number', label:'Počet vlastních profilů',
    min:0, max:16 },
  { key:'eqCustomSlot', group:'eq', kind:'number', label:'Vlastní EQ — číslo slotu',
    min:0, max:15 },
  { key:'eqCustomData', group:'eq', kind:'raw', label:'Vlastní EQ — zapsat data' },

  // ===== Prostorový zvuk =====
  { key:'spatialMode', group:'spatial', kind:'toggle', label:'Prostorový zvuk' },
  { key:'spatialScene', group:'spatial', kind:'enum', label:'Scéna',
    options: SPATIAL_SCENES },
  { key:'spatialRecenter', group:'spatial', kind:'info', label:'Vystředění' },

  // ===== Personi-Fi =====
  { key:'personifiMode', group:'personifi', kind:'toggle', label:'Personi-Fi' },
  { key:'hearingTestMode', group:'personifi', kind:'toggle', label:'Režim sluchového testu' },
  { key:'personifiSetup', group:'personifi', kind:'number', label:'Průvodce nastavením',
    min:0, max:127 },
  { key:'hearingTestSide', group:'personifi', kind:'enum', label:'Strana testu',
    options:[[0,'0 — levé'],[1,'1 — pravé']] },
  { key:'hearingTestFreq', group:'personifi', kind:'number', label:'Frekvence testu',
    min:0, max:20000, unit:'Hz' },

  // ===== Vyvážení =====
  // Rozsah NENI 0-127. Oficialni appka posila level = posuvnik + 84 a pri
  // zobrazeni oreze na 84-116, kde 100 je stred (LeftRightBalanceCard).
  // Hodnota mimo 84-116 se v appce bere jako neplatna a nahradi se stem.
  { key:'lrBalance', group:'balance', kind:'toggleLevel', label:'Vyvážení L / R',
    min:84, max:116, centerAt:100,
    desc:'84 = úplně vlevo, 100 = střed, 116 = úplně vpravo. ' +
         'Rozsah je daný oficiální appkou, ne šířkou bajtu.' },
  { key:'gameChatBalance', group:'balance', kind:'info', label:'Poměr hra / chat' },

  // ===== Voice Aware =====
  { key:'voiceAware', group:'voiceaware', kind:'toggleLevel', label:'Voice Aware',
    min:0, max:127,
    desc:'Přimíchá tvůj vlastní hlas do sluchátek, aby ses při hovoru nepřekřikoval.' },

  // ===== Kvalita a kodek =====
  { key:'smartSwitch', group:'quality', kind:'codec', label:'Kvalita, bitpool a latence',
    desc:'Profil přenosu zvuku. Vyšší bitrate a bitpool = lepší zvuk, ale citlivější spoj.',
    risk:'medium',
    why:'Změna parametrů přenosu zasáhne běžící zvukové spojení — přehrávání ' +
        'může na chvíli vypadnout a při příliš vysokém bitpoolu i trhat.' },
  { key:'audioCodec', group:'quality', kind:'enum', label:'Audio kodek',
    options:[[0,'0 — automaticky'],[1,'1 — SBC'],[2,'2 — AAC'],[3,'3 — LC3']],
    risk:'high', why:'Nevhodný kodek může zhoršit nebo úplně přerušit přehrávání.' },
  { key:'hiRes', group:'quality', kind:'toggle', label:'Hi-Res režim' },
  { key:'audioLimiter', group:'quality', kind:'toggle', label:'Limiter hlasitosti' },
  { key:'maxVolumeLimit', group:'quality', kind:'toggleLevel', label:'Strop hlasitosti',
    min:0, max:127 },
  { key:'lowEqComp', group:'quality', kind:'toggle', label:'Kompenzace basů' },
  { key:'soundEffect', group:'quality', kind:'toggle', label:'Zvukové efekty' },
  { key:'noiseSuppression', group:'quality', kind:'info', label:'Potlačení šumu' },
  { key:'enhanceVolume', group:'quality', kind:'info', label:'Zesílení hlasitosti' },
  { key:'audioSignalDetect', group:'quality', kind:'number', label:'Detekce signálu',
    min:0, max:255 },
  { key:'functionControl', group:'quality', kind:'number', label:'Function control',
    min:0, max:255, desc:'Význam indexů není ověřený.' },

  // ===== Gesta =====
  { key:'gMfbPress', group:'controls', kind:'enum', label:'Multifunkční tlačítko — stisk',
    options: GESTURE_ACTIONS },
  { key:'gMfbDouble', group:'controls', kind:'enum', label:'Multifunkční tlačítko — 2× stisk',
    options: GESTURE_ACTIONS },
  { key:'gMfbTriple', group:'controls', kind:'enum', label:'Multifunkční tlačítko — 3× stisk',
    options: GESTURE_ACTIONS },
  { key:'gMfbHold', group:'controls', kind:'enum', label:'Multifunkční tlačítko — podržet',
    options: GESTURE_ACTIONS },
  { key:'gAncPress', group:'controls', kind:'enum', label:'ANC tlačítko — stisk',
    options: GESTURE_ACTIONS },
  { key:'gAncDouble', group:'controls', kind:'enum', label:'ANC tlačítko — 2× stisk',
    options: GESTURE_ACTIONS },
  { key:'gAncTriple', group:'controls', kind:'enum', label:'ANC tlačítko — 3× stisk',
    options: GESTURE_ACTIONS },
  { key:'gAncHold', group:'controls', kind:'enum', label:'ANC tlačítko — podržet',
    options: GESTURE_ACTIONS },
  { key:'gLeftTap', group:'controls', kind:'enum', label:'Levé — ťuknutí',
    options: GESTURE_ACTIONS },
  { key:'gLeftDoubleTap', group:'controls', kind:'enum', label:'Levé — 2× ťuknutí',
    options: GESTURE_ACTIONS },
  { key:'gLeftTripleTap', group:'controls', kind:'enum', label:'Levé — 3× ťuknutí',
    options: GESTURE_ACTIONS },
  { key:'gLeftHold', group:'controls', kind:'enum', label:'Levé — podržet',
    options: GESTURE_ACTIONS },
  { key:'gRightTap', group:'controls', kind:'enum', label:'Pravé — ťuknutí',
    options: GESTURE_ACTIONS },
  { key:'gRightDoubleTap', group:'controls', kind:'enum', label:'Pravé — 2× ťuknutí',
    options: GESTURE_ACTIONS },
  { key:'gRightTripleTap', group:'controls', kind:'enum', label:'Pravé — 3× ťuknutí',
    options: GESTURE_ACTIONS },
  { key:'gRightHold', group:'controls', kind:'enum', label:'Pravé — podržet',
    options: GESTURE_ACTIONS },
  { key:'touchSensLeft', group:'controls', kind:'toggleLevel', label:'Citlivost dotyku — levé',
    min:0, max:127 },
  { key:'touchSensRight', group:'controls', kind:'toggleLevel', label:'Citlivost dotyku — pravé',
    min:0, max:127 },
  { key:'touchPanel', group:'controls', kind:'number', label:'Dotykový panel',
    min:0, max:255, risk:'medium', why:'Může vypnout ovládání dotykem na sluchátkách.' },
  { key:'autoPlayPause', group:'controls', kind:'toggle', label:'Auto play / pauza' },
  { key:'smartTalk', group:'controls', kind:'toggle', label:'Smart Talk' },

  // ===== Hlasové hlášky =====
  { key:'voicePrompt', group:'prompts', kind:'toggle', label:'Hlasové hlášky' },
  { key:'voicePromptLang', group:'prompts', kind:'enum', label:'Jazyk hlášek',
    options: VOICE_LANGS, risk:'high',
    why:'Jazykové balíčky se nahrávají přes OTA, což tahle appka neumí. ' +
        'Pokud vybraný jazyk v zařízení není, hlášky umlknou a vrátit je půjde ' +
        'jen oficiální JBL appkou.' },
  { key:'voiceFileVersion', group:'prompts', kind:'info', label:'Verze hlasového balíčku' },
  { key:'voicePromptVolume', group:'prompts', kind:'info', label:'Hlasitost hlášek' },
  { key:'feedbackToneVolume', group:'prompts', kind:'info', label:'Hlasitost pípání' },
  { key:'voicePromptType', group:'prompts', kind:'info', label:'Typ hlášek' },

  // ===== Mikrofon =====
  { key:'micAvailability', group:'mic', kind:'info', label:'Mikrofon k dispozici' },
  { key:'micMute', group:'mic', kind:'info', label:'Ztlumení mikrofonu' },
  { key:'micGain', group:'mic', kind:'info', label:'Zesílení mikrofonu' },
  { key:'micEffect', group:'mic', kind:'number', label:'Efekt mikrofonu', min:0, max:255 },
  { key:'micSignal', group:'mic', kind:'info', label:'Síla signálu' },
  { key:'micLevel', group:'mic', kind:'info', label:'Aktuální úroveň hlasu' },
  { key:'callBeamForming', group:'mic', kind:'toggle', label:'Směrování mikrofonu při hovoru' },
  { key:'autoPickupCall', group:'mic', kind:'info', label:'Automatické přijetí hovoru' },
  { key:'callStatus', group:'mic', kind:'info', label:'Stav hovoru' },

  // ===== Auracast =====
  { key:'auracastStatus', group:'auracast', kind:'info', label:'Stav Auracastu' },
  { key:'auracastQuery', group:'auracast', kind:'info', label:'Podpora Auracastu' },
  { key:'auracastScan', group:'auracast', kind:'number', label:'Skenovat vysílání',
    min:0, max:255, risk:'medium', why:'Spustí skenování — může krátce přerušit zvuk.' },
  { key:'auracastGroupInfo', group:'auracast', kind:'info', label:'Nalezené skupiny' },
  { key:'auracastGroupSelect', group:'auracast', kind:'raw', label:'Vybrat skupinu',
    risk:'medium', why:'Přepne sluchátka na jiné vysílání.' },
  { key:'auracastSubgroupInfo', group:'auracast', kind:'info', label:'Podskupiny' },
  { key:'auracastSubgroupPlay', group:'auracast', kind:'number', label:'Přehrát podskupinu',
    min:0, max:255, risk:'medium', why:'Přepne přehrávanou podskupinu.' },
  { key:'auracastHQ', group:'auracast', kind:'toggle', label:'Vysílat ve vysoké kvalitě',
    risk:'medium', why:'Změní kvalitu vysílání a znovu naváže spojení.' },
  { key:'auracastPassword', group:'auracast', kind:'text', label:'Heslo vysílání',
    risk:'medium',
    why:'Změní heslo Auracast vysílání — posluchači se budou muset připojit znovu.' },

  // ===== LE Audio =====
  { key:'leAudioUnicast', group:'leaudio', kind:'toggle', label:'LE Audio (unicast)',
    risk:'medium', why:'Přepnutí LE Audio restartuje zvukové spojení.' },
  { key:'activeSource', group:'leaudio', kind:'info', label:'Aktivní zdroj zvuku' },
  { key:'sourceInfo', group:'leaudio', kind:'info', label:'Informace o zdroji' },
  { key:'hostType', group:'leaudio', kind:'info', label:'Typ hostitele' },

  // ===== Bluetooth =====
  { key:'pairedDevices', group:'bt', kind:'info', label:'Spárovaná zařízení' },
  { key:'btPairingMode', group:'bt', kind:'number', label:'Párovací režim', min:0, max:255,
    risk:'medium', why:'Přepne do párovacího režimu, aktuální spojení se může rozpojit.' },
  // "Multi AI" NENI multipoint — je to volba hlasoveho asistenta.
  // Hodnoty z HandleParse.parseMultiAI.
  { key:'multiAi', group:'bt', kind:'enum', label:'Hlasový asistent (Multi AI)',
    options:[[0x00,'0 — vypnuto'], [0x01,'1 — Google Assistant'],
             [0x02,'2 — Amazon Alexa'], [0x03,'3 — Tencent Xiaowei'],
             [0x04,'4 — Airoha Xiaowei'], [0xDF,'223 — výchozí asistent telefonu']],
    desc:'Který hlasový asistent se spustí gestem. S multipointem (dvě ' +
         'současně připojená zařízení) to nesouvisí.',
    risk:'medium', why:'Změní hlasového asistenta navázaného na sluchátka.' },
  { key:'pairingStatus', group:'bt', kind:'info', label:'Stav párování' },

  // ===== Napájení =====
  { key:'autoPowerOff', group:'power', kind:'toggleLevel', label:'Automatické vypnutí',
    min:0, max:600, unit:'min',
    desc:'Za jak dlouho bez zvuku se sluchátka vypnou.' },
  { key:'autoStandby', group:'power', kind:'toggleLevel', label:'Automatické uspání',
    min:0, max:600, unit:'min',
    desc:'Něco jiného než automatické vypnutí — oficiální appka to nezobrazuje.' },
  { key:'standbyNormal', group:'power', kind:'toggle', label:'Standby — normální režim' },
  { key:'standbyKeepAnc', group:'power', kind:'toggle', label:'Standby — nechat ANC zapnuté' },
  { key:'manualPowerOff', group:'power', kind:'action', label:'Vypnout sluchátka',
    risk:'medium', why:'Okamžitě vypne sluchátka a spojení se rozpadne.' },

  // ===== Relax =====
  { key:'sleepActive', group:'relax', kind:'toggle', label:'Usínací režim' },
  { key:'sleepSetting', group:'relax', kind:'raw', label:'Nastavení usínání' },
  { key:'wakeupSetting', group:'relax', kind:'raw', label:'Nastavení buzení' },
  { key:'sleepCountdown', group:'relax', kind:'info', label:'Odpočet do usnutí' },
  { key:'alarmRingTone', group:'relax', kind:'number', label:'Tón budíku', min:0, max:127 },

  // ===== Ochrana sluchu =====
  { key:'safeVolume', group:'safe', kind:'number', label:'Aktuální hlasitost', min:0, max:255,
    risk:'medium', why:'Změní hlasitost okamžitě — skok nahoru uslyšíš hned.' },
  { key:'safeMaxVolume', group:'safe', kind:'toggleLevel', label:'Strop hlasitosti',
    min:0, max:127, risk:'high',
    why:'Trvalý strop hlasitosti. Vrátit ho půjde jen odsud nebo továrním resetem.' },
  { key:'safeDailyLimitOn', group:'safe', kind:'toggle', label:'Denní limit poslechu',
    risk:'high', why:'Denní limit poslechu se nemusí dát vypnout jinde než odsud.' },
  { key:'safeDailyLimit', group:'safe', kind:'number', label:'Denní limit', min:0, max:1440,
    unit:'min', risk:'high', why:'Denní limit poslechu.' },
  { key:'safeTodayTime', group:'safe', kind:'info', label:'Dnes odposloucháno' },
  { key:'safePin', group:'safe', kind:'raw', label:'PIN ochrany sluchu', risk:'critical',
    why:'PIN zamkne nastavení ochrany sluchu. Bez jeho znalosti už ho nepůjde změnit.' },
  { key:'safeAvgHistory', group:'safe', kind:'info', label:'Historie průměrné hlasitosti' },
  { key:'safeDailyHistory', group:'safe', kind:'info', label:'Historie času poslechu' },
  { key:'safeRemindVoice', group:'safe', kind:'info', label:'Připomínací hláska' },
  { key:'safeTimeUp', group:'safe', kind:'info', label:'Limit vyčerpán' },

  // ===== PSAP =====
  // PSAP zesiluje okolni zvuk primo do usi. Je to hlasitost, a oficialni
  // appka pro to u techto modelu nema kartu — proto stejna uroven jako
  // u ostatnich nastaveni hlasitosti.
  { key:'psapStatus', group:'psap', kind:'toggle', label:'PSAP', risk:'high',
    why:'Zapne zesilování okolního zvuku přímo do uší. Může být nečekaně ' +
        'hlasité a oficiální appka pro to u těchto modelů nemá kartu.' },
  { key:'psapBalance', group:'psap', kind:'number', label:'Vyvážení PSAP', min:0, max:255,
    risk:'medium', why:'Přesune zesílení mezi levou a pravou stranu, slyšíš to hned.' },
  { key:'psapGain', group:'psap', kind:'number', label:'Celkové zesílení', min:0, max:255,
    risk:'high',
    why:'Přímo řídí, jak moc se okolní zvuk zesílí do uší. Vysoká hodnota ' +
        'může být hlasitá a oficiální appka to u těchto modelů neumí vrátit.' },

  // ===== Diagnostika =====
  { key:'unsupportedList', group:'diag', kind:'info', label:'Nepodporovaná ID',
    desc:'Seznam ID, která firmware nezná — nejrychlejší přehled o tom, co model umí.' },
  // Sluchatka maji jeden univerzalni dotaz "rekni mi stav" a cislo urcuje,
  // NA CO se ptas. Vetsina radku v UI ho pouziva potichu na pozadi; tenhle
  // radek je na rucni prozkoumavani a na typy, ktere nemaji vlastni radek.
  { key:'deviceStatusQuery', group:'diag', kind:'enum',
    label:'Stav zařízení — ruční dotaz',
    desc:'Univerzální dotaz „řekni mi stav“. Číslo vybírá, na co se ptáš: ' +
         '0x30 vrátí souhrn všeho najednou (z něj se plní auto vypnutí, ' +
         'EQ předvolba, Multi AI, auto play i TWS), ostatní čísla vrací ' +
         'jednotlivé věci. Dej SET a odpověď se vypíše sem i do logu — ' +
         'nic se tím nemění, je to čtení.' },
  { key:'multiStatus', group:'diag', kind:'info', label:'Souhrnný stav' },
  { key:'twsInfo', group:'diag', kind:'info', label:'TWS informace' },
  { key:'twsStatus', group:'diag', kind:'info', label:'Stav TWS spojení' },
  { key:'inEarStatus', group:'diag', kind:'info', label:'Detekce nasazení' },
  { key:'earTips', group:'diag', kind:'info', label:'Špunty' },
  { key:'batteryPresence', group:'diag', kind:'info', label:'Přítomnost baterií' },
  { key:'sportsMode', group:'diag', kind:'info', label:'Sportovní režim' },
  { key:'minInterval', group:'diag', kind:'info', label:'Min. interval mezi pakety' },
  { key:'sealingTest', group:'diag', kind:'number', label:'Test těsnosti', min:0, max:255,
    risk:'medium', why:'Spustí test těsnosti — přehraje testovací tóny.' },
  { key:'envNoiseCheck', group:'diag', kind:'number', label:'Měření okolního hluku',
    min:0, max:255, risk:'medium', why:'Spustí měření okolního hluku.' },
  { key:'earTest', group:'diag', kind:'enum', label:'Test nasazení / těsnosti',
    options:[[65,'65 — test nasazení'],[66,'66 — test těsnosti']],
    risk:'medium', why:'Přehraje testovací tóny.' },
  { key:'findMyBuds', group:'diag', kind:'number', label:'Najít sluchátka', min:0, max:255,
    risk:'medium', why:'Sluchátka začnou hlasitě pípat.' },
  { key:'waterEjection', group:'diag', kind:'number', label:'Vypuzení vody', min:0, max:255,
    risk:'medium', why:'Přehraje hlasitý tón, který vytlačí vodu z mřížky.' },
  { key:'beep', group:'diag', kind:'info', label:'Pípání sluchátek' },
  { key:'hotword', group:'diag', kind:'info', label:'Hotword režim' },

  // ===== Nebezpečné =====
  { key:'factoryReset', group:'danger', kind:'action', label:'Tovární reset',
    risk:'critical', why:'Smaže všechna nastavení sluchátek. Nejde vzít zpět.' },
];

export const BY_KEY = new Map(SETTINGS.map(s => [s.key, s]));
export const GROUP_BY_KEY = new Map(GROUPS.map(g => [g.key, g]));

// ---------------------------------------------------------------------------
// KLASIFIKACE RIZIKA — jedno kriterium pro cely katalog.
//
// Pri pridavani nastaveni se ptej v tomhle poradi a vem prvni, co sedi:
//
//   critical  Muze te od sluchatek odriznout nebo neco nevratne smazat:
//             OTA rezim, autentizace, BLE adresa hostitele, odparovani,
//             tovarni reset, PIN zamek.
//             -> tlacitko skryte, nutne odemknout + opsat nazev
//
//   high      Nastaveni PRETRVA a meni, jak hlasite to hraje nebo jestli
//             to hraje vubec — a oficialni JBL appka pro nej u tohohle
//             modelu nema kartu, takze vratit to jde jen odsud nebo
//             tovarnim resetem.
//             -> tlacitko skryte, nutne odemknout + opsat nazev
//
//   medium    Ma okamzity fyzicky ucinek (prehraje ton, rozpoji spojeni,
//             spusti test), NEBO se neda precist zpatky, NEBO neni overeny
//             format hodnoty.
//             -> jedno potvrzeni
//
//   null      Bezny prepinac, ktery jde tady a ted precist i vratit zpet.
//
// Pravidlo "appka pro to nema kartu" samo o sobe NESTACI na high — tahle
// appka umi zapsat vsechno, co umi precist, takze bezny prepinac je odsud
// vzdycky vratitelny. Rozhoduje az kombinace s hlasitosti / funkcnosti zvuku.
//
// Riziko se SLUCUJE SMEREM NAHORU: katalog, mapovani modelu i risk.js
// muzou uroven jen zvysit, nikdy snizit. Hlida to test.
// ---------------------------------------------------------------------------

/** Poradi rizik od nejmensiho. Slouzi ke slucovani — bere se vzdy to vyssi. */
export const RISK_ORDER = { null: 0, undefined: 0, medium: 1, high: 2, critical: 3 };

export function worstRisk(...levels) {
  let best = null;
  for (const l of levels)
    if (l && (RISK_ORDER[l] || 0) > (RISK_ORDER[String(best)] || 0)) best = l;
  return best;
}

export const RISK_LABEL = { medium: 'pozor', high: 'nevratné', critical: 'kritické' };

/**
 * Nektera nastaveni jde jen zapsat, ne precist. NENI to uroven rizika —
 * vratit je porad muzes tim, ze zapises znamou hodnotu. Je to ale vec,
 * kterou musis vedet driv, nez zapises: potom uz neuvidis, co v zarizeni je.
 * Proto se to pripisuje do potvrzeni a do radku jako stitek "jen zápis".
 */
export const WRITE_ONLY_WARNING =
  'Tohle nastavení nejde přečíst zpět — po zápisu neuvidíš, co v zařízení ' +
  'opravdu je. Vrátit se dá jen zapsáním hodnoty, kterou si sám pamatuješ.';

/** Riziko, ktere se NIKDY nesmi obnovit z zalohy ani hromadne zapsat. */
export const isDangerous = level => level != null;
