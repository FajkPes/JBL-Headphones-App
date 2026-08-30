// ---------------------------------------------------------------------------
// JBL TUNE 780NC — PID 215F, Protocol 4.
//
// Tohle je REFERENCNI mapovani: obsahuje vsechno, co katalog zna a co
// firmware podle SDK umi. Ostatni modely jsou jeho podmnozina.
//
// Co tu neni, se v UI vubec nezobrazi.
//
// Zdroje:
//   analysis/config/jbl_tune_780nc.json     ktere karty ma oficialni appka
//   analysis/config/product_gesture_config.json  gesta a kody akci pro 215F
//   com.harman.cmdctrl...protocol4.General4Control  ktere featury se ctou
// ---------------------------------------------------------------------------

import { GESTURE_ACTIONS } from '../catalog.js';

/** Gesta, ktera 215F opravdu ma. Ostatni (tapy, swipy) tenhle model nema. */
const gestures = {
  gMfbPress:  { feat: 'Button1ShortPress' },
  gMfbDouble: { feat: 'Button1DoublePress' },
  gMfbTriple: { feat: 'Button1TriplePress' },
  gMfbHold:   { feat: 'Button1LongPress' },
  gAncPress:  { feat: 'Button2ShortPress' },
  gAncDouble: { feat: 'Button2DoublePress' },
};

export default {
  id: 'tune780nc',
  model: 'JBL TUNE 780NC',
  pid: '215F',
  protocol: 4,
  accent: '#ff6a00',
  namePrefix: 'JBL',
  verified: false,
  note: 'Rámce jsou odvozené ze SDK a pokryté testy, ale na hardwaru zatím ' +
        'neověřené. Začni tlačítkem „Načíst vše“ — zeleně se označí to, ' +
        'na co sluchátka opravdu odpověděla.',

  /** Karty, ktere ma i oficialni JBL appka. Zbytek je oznaceny jako navic. */
  officialGroups: ['device', 'ambient', 'eq', 'spatial', 'personifi', 'balance',
                   'voiceaware', 'quality', 'controls', 'prompts', 'auracast',
                   'leaudio', 'power', 'relax', 'danger'],

  map: {
    // --- zařízení ---
    deviceName:   { feat: 'DeviceName' },
    model:        { feat: 'ProductID' },
    colorId:      { feat: 'ColorID' },
    firmware:     { feat: 'FirmwareVersion' },
    serialLeft:   { feat: 'LeftDeviceSerialNumber' },
    serialRight:  { feat: 'RightDeviceSerialNumber' },
    macAddress:   { feat: 'MACAddress' },
    macSecondary: { feat: 'SecondaryDeviceMACAddress' },
    batteryLeft:  { feat: 'LeftDeviceBatteryStatus' },
    batteryRight: { feat: 'RightDeviceBatteryStatus' },
    batteryCase:  { feat: 'CaseBatteryStatus' },
    btStatus:     { feat: 'BTConnectionStatus' },
    mtu:          { feat: 'MTU' },
    playbackTime: { feat: 'TotalPlaybackTime' },
    poweronTime:  { feat: 'TotalPoweronTime' },

    // --- ambient sound control ---
    // AmbientSoundControl je podle SDK master vypinac (bit 7), ne rezim.
    ascMaster:        { feat: 'AmbientSoundControl' },
    anc:              { feat: 'ANC' },
    // 780NC ma v configu "AscCardNoAaLevel" — Ambient Aware nema posuvnik.
    ambientAware:     { feat: 'AA', kind: 'toggle' },
    talkThru:         { feat: 'TT' },
    adaptiveAnc:      { feat: 'AdaptiveANC' },
    trueAdaptiveAnc:  { feat: 'TrueAdaptiveANC' },
    ancAlwaysOn:      { feat: 'ANCAlwaysOn' },
    autoCompensation: { feat: 'AutoCompensation' },
    leakageComp:      { feat: 'LeakageCompensation' },
    earCanalComp:     { feat: 'EarCanalCompensation' },

    // --- ekvalizér ---
    // EQInfo nese cely profil vcetne nazvu ("EQ 62" v oficialni appce).
    // Ktery profil se vrati, urcuje EQInfoQuery — nastav ho a pak dej GET.
    eqBands: { feat: 'EQInfo', kind: 'eq',
      categories: [[0, '0 — vypnuto'], [1, '1 — Jazz'], [2, '2 — Vocal'],
                   [3, '3 — Bass'], [4, '4 — Vlastní'], [17, '17 — Rock'],
                   [18, '18 — Piano'], [19, '19 — Club'], [20, '20 — Studio'],
                   [230, '230 — aktivní profil']],
      desc: 'Protocol 4 nemá parametr u dotazu — nejdřív nastav „EQ — dotaz ' +
            'na profil“, pak dej GET tady. Výběr nahoře je jen pro přehled.' },
    eqInfoQuery:   { feat: 'EQInfoQuery' },
    eqSequence:    { feat: 'EQSequence' },
    eqCurve:       { feat: 'EQCurve' },
    eqDesignRaw:   { feat: 'GetDesignEQRawData' },
    dynamicEq:     { feat: 'DynamicEQ' },
    customEqCount: { feat: 'CustomEQCount' },

    // --- prostorový zvuk ---
    spatialMode:     { feat: 'SpatialSoundMode' },
    spatialScene:    { feat: 'SpatialSoundScene' },
    spatialRecenter: { feat: 'SpatialSoundRecenter' },

    // --- Personi-Fi ---
    personifiMode:   { feat: 'PersoniFiMode' },
    hearingTestMode: { feat: 'HearingTestMode' },
    personifiSetup:  { feat: 'PersoniFiSetupFlow' },
    hearingTestSide: { feat: 'HearingTestFileSide' },
    hearingTestFreq: { feat: 'HearingTestFileFrequency' },

    // --- vyvážení ---
    lrBalance:       { feat: 'LRBalance' },
    gameChatBalance: { feat: 'GameChatBalance' },

    // --- Voice Aware ---
    // Sidetone = primichani vlastniho hlasu, coz Voice Aware dela. Neovereno.
    voiceAware: { feat: 'Sidetone' },

    // --- kvalita ---
    smartSwitch: { feat: 'SmartSwitch',
      presets: [
        { label: 'Normální (197 kbps / 46 / 150 ms)',
          value: { bitrate: 197, bitpool: 46, latency: 150, latency2: 0 } },
        { label: 'Zvuk — vyšší kvalita (256 / 53 / 150 ms)',
          value: { bitrate: 256, bitpool: 53, latency: 150, latency2: 0 } },
        { label: 'Video — nižší latence (197 / 46 / 100 ms)',
          value: { bitrate: 197, bitpool: 46, latency: 100, latency2: 0 } },
      ] },
    audioCodec:        { feat: 'AudioCodecSetting' },
    hiRes:             { feat: 'HiRes' },
    audioLimiter:      { feat: 'AudioLimiter' },
    maxVolumeLimit:    { feat: 'MaxVolumeLimit' },
    lowEqComp:         { feat: 'LowEQCompensation' },
    soundEffect:       { feat: 'SoundEffect' },
    noiseSuppression:  { feat: 'NoiseSuppression' },
    enhanceVolume:     { feat: 'EnhanceVolume' },
    audioSignalDetect: { feat: 'AudioSignalDetect' },

    // --- gesta ---
    // Citlivost dotyku (4033/4034) tu zamerne NENI: 780NC se ovlada
    // tlacitky, zadnou dotykovou plochu nema. Namapovat ji by znamenalo
    // ukazat ovladac pro neco, co na sluchatkach fyzicky neexistuje.
    ...gestures,
    autoPlayPause:  { feat: 'AutoPlayPauseEnable' },
    smartTalk:      { feat: 'SmartTalk' },

    // --- hlasové hlášky ---
    voicePrompt:        { feat: 'VoicePromptStatus' },
    voicePromptLang:    { feat: 'VoicePromptLanguage' },
    voiceFileVersion:   { feat: 'VoiceFileVersion' },
    voicePromptVolume:  { feat: 'VoicePromptVolume' },
    feedbackToneVolume: { feat: 'FeedbackToneVolume' },
    voicePromptType:    { feat: 'VoicePromptType' },

    // --- mikrofon ---
    micAvailability: { feat: 'MicAvailability' },
    micMute:         { feat: 'MicMute' },
    micGain:         { feat: 'MicGain' },
    micEffect:       { feat: 'MicEffect' },
    micSignal:       { feat: 'MicSignalStrength' },
    micLevel:        { feat: 'MicRealTimeVoiceLevel' },
    callBeamForming: { feat: 'CallBeamForming' },
    autoPickupCall:  { feat: 'AutoPickupCall' },
    callStatus:      { feat: 'CallStatus' },

    // --- Auracast ---
    auracastStatus:       { feat: 'LEAudioAuraCastStatus' },
    auracastQuery:        { feat: 'LEAudioAuraCastQuery' },
    auracastScan:         { feat: 'LEAudioAuraCastScan' },
    auracastGroupInfo:    { feat: 'LEAudioAuraCastGroupInfo' },
    auracastGroupSelect:  { feat: 'LEAudioAuraCastGroupSelect' },
    auracastSubgroupInfo: { feat: 'LEAudioAuraCastSubgroupInfo' },
    auracastSubgroupPlay: { feat: 'LEAudioAuraCastSubgroupPlay' },
    auracastHQ:           { feat: 'LEAudioHighQualityAuraCastBroadcast' },
    auracastPassword:     { feat: 'LEAudioAuraCasBroadcastPassword' },

    // --- LE Audio ---
    leAudioUnicast: { feat: 'LEAudioUniCastStatus' },
    activeSource:   { feat: 'ActiveAudioSource' },
    sourceInfo:     { feat: 'AudioSourceInfo' },
    hostType:       { feat: 'HostType' },

    // --- Bluetooth ---
    pairedDevices: { feat: 'GetPairedBTDevice' },
    btPairingMode: { feat: 'BTPairingMode' },
    // MultiAI je u Protocol 4 jednobajtova StatusLevel hodnota, do ktere se
    // vejde jen 0-127. Hodnota 223 "vypnuto" je z Protocol 3 a sem nepatri.
    multiAi: { feat: 'MultiAI', kind: 'enum',
      options: [[0, '0 — vypnuto'], [1, '1'], [2, '2'], [3, '3'], [4, '4']] },
    pairingStatus: { feat: 'PairingStatus' },

    // --- napájení ---
    autoPowerOff:   { feat: 'AutoPowerOff' },
    autoStandby:    { feat: 'AutoStandby' },
    // ManualPowerOff je dvoubajtove cislo, ne prikaz bez hodnoty — vyznam
    // hodnoty neni ze SDK jisty, takze se posila presne to, co zadas.
    manualPowerOff: { feat: 'ManualPowerOff', kind: 'raw',
      desc: 'Očekává 2 bajty. Význam hodnoty není ověřený — nejdřív si ' +
            'přečti aktuální stav.' },

    // --- relax ---
    sleepActive:    { feat: 'SleepActiveStatus' },
    sleepSetting:   { feat: 'SleepSetting' },
    wakeupSetting:  { feat: 'WakeupSetting' },
    sleepCountdown: { feat: 'SleepCountDownSetting' },
    alarmRingTone:  { feat: 'AlarmRingTone' },

    // --- ochrana sluchu ---
    safeVolume:       { feat: 'SafeListeningCurrentVolume' },
    safeMaxVolume:    { feat: 'SafeListeningMaxVolumeLimit' },
    safeDailyLimit:   { feat: 'SafeListeningDailyTimeLimit', kind: 'raw' },
    safeTodayTime:    { feat: 'SafeListeningTodayListenedTime' },
    safePin:          { feat: 'SafeListeningPinCode' },
    safeAvgHistory:   { feat: 'SafeListeningAverageVolumeHistory' },
    safeDailyHistory: { feat: 'SafeListeningDailyListenedTimeHistory' },
    safeRemindVoice:  { feat: 'SafeListeningRemindVoice' },
    safeTimeUp:       { feat: 'SafeListeningTimeUpStatus' },

    // --- PSAP ---
    psapStatus:  { feat: 'PSAPStatus' },
    psapBalance: { feat: 'PSAPBalance' },
    psapGain:    { feat: 'PSAPTotalGainLevel' },

    // --- diagnostika ---
    unsupportedList: { feat: 'UnsupportedFeatureIDList' },
    twsInfo:         { feat: 'TWSInfo' },
    inEarStatus:     { feat: 'InEarStatus' },
    earTips:         { feat: 'EarTips' },
    batteryPresence: { feat: 'BatteryPresence' },
    sportsMode:      { feat: 'SportsMode' },
    minInterval:     { feat: 'ContinuousPacketsMinimalTransmissionInterval' },
    sealingTest:     { feat: 'SealingTest', kind: 'raw' },
    envNoiseCheck:   { feat: 'EnvironmentNoiseCheck', kind: 'raw' },
    findMyBuds:      { feat: 'FindMyBudsStatus', kind: 'raw' },
    waterEjection:   { feat: 'WaterEjection' },

    // Tovarni reset (ID 15) tu zamerne NENI. Blokuje ho core/guard.js
    // na urovni bajtu, takze radek by slo jen kliknout a dostat chybu.
  },
};

// Kontrola pri nacteni: gesta musi nabizet aspon jednu akci, jinak by
// v UI byl prazdny rozbalovaci seznam.
if (!GESTURE_ACTIONS.length) throw new Error('seznam akcí pro gesta je prázdný');
