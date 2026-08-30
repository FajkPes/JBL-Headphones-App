// English presentation layer for the original protocol-mapping UI.
// Protocol bytes, safety decisions, setting keys, and model maps are untouched.

const exact = new Map([
  ['Zařízení', 'Devices'], ['Zvuk', 'Sound'], ['Ovládání', 'Controls'],
  ['Připojení', 'Connection'], ['Systém', 'System'],
  ['Zařízení a baterie', 'Device and battery'], ['Diagnostika', 'Diagnostics'],
  ['Ekvalizér', 'Equalizer'], ['Prostorový zvuk', 'Spatial sound'],
  ['Vyvážení L / R', 'Left / right balance'], ['Kvalita, kodek a latence', 'Quality, codec and latency'],
  ['Ochrana sluchu', 'Hearing protection'], ['PSAP — dorovnání sluchu', 'PSAP — hearing compensation'],
  ['Gesta a tlačítka', 'Gestures and buttons'], ['Hlasové hlášky', 'Voice prompts'],
  ['Mikrofon a hovory', 'Microphone and calls'], ['LE Audio a zdroje zvuku', 'LE Audio and audio sources'],
  ['Bluetooth a párování', 'Bluetooth and pairing'], ['Napájení a uspání', 'Power and sleep'],
  ['Relax a usínání', 'Relax and sleep'], ['Nebezpečné operace', 'Dangerous operations'],
  ['Název zařízení', 'Device name'], ['Barevná varianta', 'Colour variant'],
  ['Verze firmwaru', 'Firmware version'], ['Sériové číslo', 'Serial number'],
  ['Sériové číslo — levé', 'Serial number — left'], ['Sériové číslo — pravé', 'Serial number — right'],
  ['BT adresa', 'Bluetooth address'], ['BT adresa — druhý bud', 'Bluetooth address — second earbud'],
  ['Baterie', 'Battery'], ['Baterie — levé', 'Battery — left'], ['Baterie — pravé', 'Battery — right'],
  ['Baterie — pouzdro', 'Battery — case'], ['Stav BT spojení', 'Bluetooth connection status'],
  ['Celkový čas přehrávání', 'Total playback time'], ['Celkový čas zapnutí', 'Total powered-on time'],
  ['Hlavní vypínač celé sekce. Vypnutím se vypne ANC i Ambient Aware.',
   'Master switch for this section. Turning it off disables ANC and Ambient Aware.'],
  ['Potlačení hluku (ANC)', 'Noise cancellation (ANC)'], ['Adaptivní ANC', 'Adaptive ANC'],
  ['ANC vždy zapnuté', 'ANC always on'], ['Automatická kompenzace', 'Automatic compensation'],
  ['Kompenzace netěsnosti', 'Leakage compensation'], ['Kompenzace zvukovodu', 'Ear-canal compensation'],
  ['Předvolba ekvalizéru', 'Equalizer preset'], ['Ekvalizér — pásma', 'Equalizer — bands'],
  ['EQ — dotaz na profil', 'EQ — profile query'], ['EQ — data profilu', 'EQ — profile data'],
  ['EQ — pořadí profilů', 'EQ — profile order'], ['EQ — křivka', 'EQ — curve'],
  ['EQ — syrová data návrhu', 'EQ — raw design data'], ['Dynamický EQ', 'Dynamic EQ'],
  ['Počet vlastních profilů', 'Number of custom profiles'], ['Vlastní EQ — číslo slotu', 'Custom EQ — slot number'],
  ['Vlastní EQ — zapsat data', 'Custom EQ — write data'], ['Scéna', 'Scene'], ['Vystředění', 'Recenter'],
  ['Režim sluchového testu', 'Hearing-test mode'], ['Průvodce nastavením', 'Setup wizard'],
  ['Strana testu', 'Test side'], ['Frekvence testu', 'Test frequency'], ['Poměr hra / chat', 'Game / chat balance'],
  ['Audio kodek', 'Audio codec'], ['Hi-Res režim', 'Hi-Res mode'], ['Limiter hlasitosti', 'Volume limiter'],
  ['Strop hlasitosti', 'Volume limit'], ['Strop hlasitosti (Safe Sound)', 'Volume limit (Safe Sound)'],
  ['Kompenzace basů', 'Bass compensation'], ['Zvukové efekty', 'Sound effects'],
  ['Potlačení šumu', 'Noise suppression'], ['Zesílení hlasitosti', 'Volume enhancement'],
  ['Detekce signálu', 'Signal detection'], ['Multifunkční tlačítko — stisk', 'Multifunction button — press'],
  ['Multifunkční tlačítko — 2× stisk', 'Multifunction button — double press'],
  ['Multifunkční tlačítko — 3× stisk', 'Multifunction button — triple press'],
  ['Multifunkční tlačítko — podržet', 'Multifunction button — hold'],
  ['ANC tlačítko — stisk', 'ANC button — press'], ['ANC tlačítko — 2× stisk', 'ANC button — double press'],
  ['ANC tlačítko — 3× stisk', 'ANC button — triple press'], ['ANC tlačítko — podržet', 'ANC button — hold'],
  ['Levé — ťuknutí', 'Left — tap'], ['Levé — 2× ťuknutí', 'Left — double tap'],
  ['Levé — 3× ťuknutí', 'Left — triple tap'], ['Levé — podržet', 'Left — hold'],
  ['Pravé — ťuknutí', 'Right — tap'], ['Pravé — 2× ťuknutí', 'Right — double tap'],
  ['Pravé — 3× ťuknutí', 'Right — triple tap'], ['Pravé — podržet', 'Right — hold'],
  ['Citlivost dotyku — levé', 'Touch sensitivity — left'], ['Citlivost dotyku — pravé', 'Touch sensitivity — right'],
  ['Dotykový panel', 'Touch panel'], ['Auto play / pauza', 'Auto play / pause'],
  ['Jazyk hlášek', 'Prompt language'], ['Verze hlasového balíčku', 'Voice-pack version'],
  ['Hlasitost hlášek', 'Prompt volume'], ['Hlasitost pípání', 'Feedback-tone volume'],
  ['Typ hlášek', 'Prompt type'], ['Mluvené hlášky místo tónů', 'Spoken prompts instead of tones'],
  ['Mikrofon k dispozici', 'Microphone available'], ['Ztlumení mikrofonu', 'Microphone mute'],
  ['Zesílení mikrofonu', 'Microphone gain'], ['Efekt mikrofonu', 'Microphone effect'],
  ['Síla signálu', 'Signal strength'], ['Aktuální úroveň hlasu', 'Current voice level'],
  ['Směrování mikrofonu při hovoru', 'Call beamforming'], ['Automatické přijetí hovoru', 'Automatic call pickup'],
  ['Stav hovoru', 'Call status'], ['Stav Auracastu', 'Auracast status'], ['Podpora Auracastu', 'Auracast support'],
  ['Skenovat vysílání', 'Scan broadcasts'], ['Nalezené skupiny', 'Discovered groups'],
  ['Vybrat skupinu', 'Select group'], ['Podskupiny', 'Subgroups'], ['Přehrát podskupinu', 'Play subgroup'],
  ['Vysílat ve vysoké kvalitě', 'Broadcast in high quality'], ['Heslo vysílání', 'Broadcast password'],
  ['Aktivní zdroj zvuku', 'Active audio source'], ['Informace o zdroji', 'Source information'],
  ['Typ hostitele', 'Host type'], ['Spárovaná zařízení', 'Paired devices'], ['Párovací režim', 'Pairing mode'],
  ['Hlasový asistent (Multi AI)', 'Voice assistant (Multi AI)'], ['Stav párování', 'Pairing status'],
  ['Automatické vypnutí', 'Automatic power-off'], ['Automatické uspání', 'Automatic sleep'],
  ['Standby — normální režim', 'Standby — normal mode'], ['Standby — nechat ANC zapnuté', 'Standby — keep ANC enabled'],
  ['Vypnout sluchátka', 'Power off headphones'], ['Režim spánku', 'Sleep mode'],
  ['Nastavení usínání', 'Sleep settings'], ['Nastavení probuzení', 'Wake-up settings'],
  ['Odpočet do uspání', 'Sleep countdown'], ['Tón budíku', 'Alarm ringtone'],
  ['Aktuální hlasitost (Safe Sound)', 'Current volume (Safe Sound)'],
  ['Denní limit zapnutý', 'Daily limit enabled'], ['Denní limit poslechu', 'Daily listening limit'],
  ['Dnešní čas poslechu', 'Listening time today'], ['PIN ochrany sluchu', 'Hearing-protection PIN'],
  ['Historie průměrné hlasitosti', 'Average-volume history'], ['Historie času poslechu', 'Listening-time history'],
  ['Hlasové připomenutí', 'Voice reminder'], ['Denní limit vypršel', 'Daily limit reached'],
  ['Stav PSAP', 'PSAP status'], ['Vyvážení PSAP', 'PSAP balance'], ['Celkové zesílení PSAP', 'Total PSAP gain'],
  ['Nepodporované feature ID', 'Unsupported feature IDs'], ['TWS informace', 'TWS information'],
  ['Stav nasazení', 'In-ear status'], ['Test nasazení / těsnosti', 'Fit / seal test'],
  ['Nástavce', 'Ear tips'], ['Přítomnost baterie', 'Battery presence'], ['Sportovní režim', 'Sports mode'],
  ['Minimální interval paketů', 'Minimum packet interval'], ['Test těsnosti', 'Seal test'],
  ['Měření okolního hluku', 'Ambient-noise measurement'], ['Vypuzení vody', 'Water ejection'],
  ['Stav zařízení — ruční dotaz', 'Device status — manual query'], ['Souhrnný stav', 'Summary status'],
  ['Stav TWS spojení', 'TWS connection status'], ['Název', 'Name'], ['načíst', 'read'],
  ['jen zápis', 'write only'], ['není v JBL appce', 'not in the JBL app'], ['pozor', 'caution'],
  ['zapnuto', 'on'], ['vypnuto', 'off'], ['připojeno', 'connected'], ['nepřipojeno', 'not connected'],
  ['ověřeno na HW', 'hardware verified'], ['neověřeno na HW', 'not hardware verified'],
  ['neověřeno', 'unverified'], ['zatím nezjištěno', 'not checked yet'],
  ['odpověď', 'response'], ['čte se společně s dalším řádkem', 'read together with the next row'],
  ['ruční dotaz', 'manual query'], ['test nasazení', 'fit test'], ['test těsnosti', 'seal test'],
  ['Vyber typ', 'Select a type'], ['stav zařízení', 'device status'], ['přečíst', 'read'],
  ['server běží', 'server running'], ['server neběží', 'server not running'],
  ['Normální', 'Normal'], ['Zvuk — vyšší kvalita', 'Audio — higher quality'],
  ['Zvuk — vyšší bitrate', 'Audio — higher bitrate'], ['Video — nižší latence', 'Video — lower latency'],
  ['Nic', 'None'], ['Zesílit', 'Volume up'], ['Zeslabit', 'Volume down'],
  ['Další skladba', 'Next track'], ['Předchozí skladba', 'Previous track'],
  ['Přehrát / pauza', 'Play / pause'], ['Hlasový asistent', 'Voice assistant'],
  ['Film', 'Movie'], ['Hudba', 'Music'], ['Hra', 'Game'], ['Vlastní', 'Custom'],
  ['levé', 'left'], ['pravé', 'right'], ['nejvyšší', 'highest'], ['neurčeno', 'unspecified'],
  ['souhrn všeho najednou', 'complete summary'], ['souhrn všeho', 'complete summary'],
  ['automatické vypnutí', 'automatic power-off'], ['EQ předvolba', 'EQ preset'],
  ['hlasový asistent', 'voice assistant'], ['stav BT spojení', 'Bluetooth connection status'],
  ['průběh aktualizace firmwaru', 'firmware-update progress'], ['stav TWS spojení', 'TWS connection status'],
  ['Prohlížeč', 'Browser'], ['Web Bluetooth dostupné', 'Web Bluetooth available'],
  ['Bluetooth adaptér', 'Bluetooth adapter'], ['nedostupný nebo vypnutý', 'unavailable or disabled'],
  ['Server v pořádku.', 'Server is healthy.'], ['Složka:', 'Folder:'],
  ['zatím nenačteno', 'not loaded yet'], ['READ PROFIL', 'READ PROFILE'],
  ['profil 0', 'profile 0'], ['profil 1', 'profile 1'], ['profil 2', 'profile 2'],
  ['profil 3', 'profile 3'], ['profil 4 — vlastní', 'profile 4 — custom'],
  ['profil 5', 'profile 5'], ['profil 6', 'profile 6'], ['profil 7', 'profile 7'],
  ['230 — aktivní profil', '230 — active profile'], ['přednastavení…', 'preset…'],
  ['Aktuální hlasitost', 'Current volume'], ['Denní limit', 'Daily limit'],
  ['Dnes odposloucháno', 'Listening time today'], ['nevratné', 'irreversible'],
  ['kritické', 'critical'], ['zamčeno', 'locked'], ['Připomínací hláska', 'Reminder prompt'],
  ['Limit vyčerpán', 'Limit reached'], ['Celkové zesílení', 'Total gain'],
  ['Nepodporovaná ID', 'Unsupported IDs'], ['Detekce nasazení', 'In-ear detection'],
  ['Špunty', 'Ear tips'], ['Přítomnost baterií', 'Battery presence'],
  ['Najít sluchátka', 'Find my headphones'], ['Usínací režim', 'Sleep mode'],
  ['Nastavení buzení', 'Wake-up settings'], ['Odpočet do usnutí', 'Sleep countdown'],
  ['Ambient Sound — přepnout režim', 'Ambient Sound — switch mode'],
  ['Equalizer — výběr', 'Equalizer — select'], ['výchozí asistent telefonu', 'default phone assistant'],
  ['cmd (145 nebo 0x91)', 'command (145 or 0x91)'], ['feature ID (24 nebo 0x18)', 'feature ID (24 or 0x18)'],
  ['hex, např. 81 00', 'hex, e.g. 81 00'],
]);

const phrases = [
  ['Sluchátka připojená k Windows (hudba, hovory) jsou na jiném spojení než tohle.',
   'Headphones connected through Windows for music or calls use a different connection from this app.'],
  ['Připojení odsud hudbu nepřeruší a nic v systému nerozpojí.',
   'Connecting here does not interrupt audio or disconnect anything in Windows.'],
  ['Prohlížeč ale zařízení sám nevidí — musíš ho jednou vybrat v dialogu, který otevře tlačítko Připojit.',
   'The browser cannot discover it silently; select it once in the dialog opened by Connect.'],
  ['Ten dialog patří Chrome, ne této stránce.', 'That chooser belongs to Chrome, not this page.'],
  ['Ověřeno na reálném kusu.', 'Verified on real hardware.'],
  ['Mapování obsahuje jen to, na co sluchátka opravdu odpověděla, nebo co jde jen zapsat.',
   'The map contains only settings that produced a real response, plus explicitly write-only commands.'],
  ['Příkazy, které firmware ignoroval, jsou dole v poznámce — zkusit je jde ručním příkazem.',
   'Commands ignored by the firmware are listed in the note below and can still be tried manually.'],
  ['Rámce jsou odvozené ze SDK a pokryté testy, ale na hardwaru zatím neověřené.',
   'Frames are derived from the SDK and covered by tests, but are not yet verified on hardware.'],
  ['Začni tlačítkem „Načíst vše“ — zeleně se označí to, na co sluchátka opravdu odpověděla.',
   'Start with Read all; settings that receive an actual response are marked in green.'],
  ['Vyber typ a dej SET — odpověď přijde jako stav zařízení.',
   'Select a type and use SET; the response arrives as device status.'],
  ['Typ 0x30 vrací blok, ve kterém je mimo jiné auto vypnutí.',
   'Type 0x30 returns a block that also contains automatic power-off.'],
  ['Odpověď přijde jako stav zařízení.', 'The response arrives as device status.'],
  ['Hlavní vypínač je „Ambient Sound Control“.', 'The master switch is Ambient Sound Control.'],
  ['Režimy pod ním se zapínají nastavením úrovně — zapnutím jednoho se ostatní obvykle vypnou.',
   'Modes below it are enabled by setting their level; enabling one normally disables the others.'],
  ['Windows u A2DP nabízí obvykle jen SBC — největší praktický vliv má SBC bitpool.',
   'Windows A2DP normally offers only SBC, so the SBC bitpool has the largest practical effect.'],
  ['Vyšší bitpool = vyšší datový tok = citlivější spoj.', 'A higher bitpool means a higher data rate and a more sensitive link.'],
  ['Odemyká se přepínačem „rizikové zápisy“ v horní liště.', 'Unlock with Risky writes in the top toolbar.'],
  ['Vyber index profilu a dej GET.', 'Select a profile index and use GET.'],
  ['Pokud firmware odpoví, načtou se pásma i s frekvencemi a jde je zapsat zpět.',
   'If the firmware responds, the bands and frequencies are loaded and can be written back.'],
  ['Formát není ověřený.', 'The format is not verified.'],
  ['Nejdřív si to načti přes GET a odvoď strukturu.', 'Read it with GET first and inspect the structure.'],
  ['Význam indexů není ověřený.', 'The meaning of the indexes is not verified.'],
  ['Který hlasový asistent se spustí gestem.', 'Selects which voice assistant a gesture starts.'],
  ['S multipointem (dvě současně připojená zařízení) to nesouvisí.',
   'This is unrelated to multipoint (two simultaneously connected devices).'],
  ['Za jak dlouho bez zvuku se sluchátka vypnou.', 'Time without audio before the headphones power off.'],
  ['Něco jiného než automatické vypnutí — oficiální appka to nezobrazuje.',
   'Different from automatic power-off; the official app does not expose it.'],
  ['Strop hlasitosti. Oficiální appka pro 780NC pro něj nemá kartu, takže ztlumení půjde vrátit jen odsud nebo továrním resetem.',
   'Volume limit. The official 780NC app has no control for it, so attenuation can only be reverted here or by factory reset.'],
  ['Ověřeno na reálném kusu. Mapování obsahuje jen to, na co sluchátka opravdu odpověděla, nebo co jde jen zapsat. Příkazy, které firmware ignoroval, jsou dole v poznámce — zkusit je jde ručním příkazem.',
   'Verified on real hardware. The map contains only settings that produced a real response, plus explicitly write-only commands. Commands ignored by the firmware are listed in the note below and can still be tried manually.'],
  ['Rámce jsou odvozené ze SDK a pokryté testy, ale na hardwaru zatím neověřené. Začni tlačítkem „Načíst vše“ — zeleně se označí to, na co sluchátka opravdu odpověděla.',
   'Frames are derived from the SDK and covered by tests, but are not yet verified on hardware. Start with Read all; settings that receive an actual response are marked in green.'],
  ['Přečte celou kartu. None nezapisuje.', 'Reads the entire card. Does not write anything.'],
  ['Zatím nezjištěno — dej GET nebo „Načíst vše“.', 'Not checked yet — use GET or Read all.'],
  ['Přečte aktuální hodnotu. None nezapisuje.', 'Reads the current value. Does not write anything.'],
  ['Firmware to umí, ale oficiální appka pro tenhle model nemá kartu — vrátit to půjde jen odsud.',
   'The firmware supports this, but the official app has no control for this model; it can only be reverted here.'],
  ['Přehraje testovací tóny.', 'Plays test tones.'],
  ['Tohle nastavení se nedá read — hodnotu ze sluchátek nezjistíš.',
   'This setting is write-only; its current value cannot be read from the headphones.'],
  ['Zapisuje celou křivku ekvalizéru včetně frekvencí a Q. Formát je odvozený ze SDK, ale na tomhle modelu zatím neověřený.',
   'Writes the complete equalizer curve including frequencies and Q. The format is derived from the SDK but is not yet verified on this model.'],
  ['Změna parametrů kodeku může krátce přerušit přehrávání.', 'Changing codec parameters may briefly interrupt playback.'],
  ['Změní hlasitost okamžitě — skok nahoru uslyšíš hned.', 'Changes volume immediately; an upward jump is heard at once.'],
  ['Trvalý strop hlasitosti. Vrátit ho půjde jen odsud nebo továrním resetem.',
   'Persistent volume limit. It can only be reverted here or with a factory reset.'],
  ['Daily listening limit se nemusí dát vypnout jinde než odsud.', 'The daily listening limit may only be reversible here.'],
  ['Změní hlasového asistenta navázaného na sluchátka.', 'Changes the voice assistant assigned to the headphones.'],
  ['Okamžitě vypne sluchátka a spojení se rozpadne.', 'Immediately powers off the headphones and drops the connection.'],
  ['84 = úplně vlevo, 100 = střed, 116 = úplně vpravo. Rozsah je daný oficiální appkou, ne šířkou bajtu.',
   '84 = fully left, 100 = centre, 116 = fully right. This range comes from the official app, not the byte width.'],
  ['Přimíchá tvůj vlastní hlas do sluchátek, aby ses při hovoru nepřekřikoval.',
   'Feeds your own voice into the headphones so you do not raise your voice during calls.'],
  ['Profil přenosu zvuku. Vyšší bitrate a bitpool = lepší zvuk, ale citlivější spoj.',
   'Audio transport profile. Higher bitrate and bitpool improve quality but make the link more sensitive.'],
  ['Seznam ID, která firmware nezná — nejrychlejší přehled o tom, co model umí.',
   'IDs unknown to the firmware — the quickest overview of what the model supports.'],
  ['Spustí seal test — přehraje testovací tóny.', 'Starts the seal test and plays test tones.'],
  ['Spustí měření okolního hluku.', 'Starts ambient-noise measurement.'],
  ['Sluchátka začnou hlasitě pípat.', 'Makes the headphones beep loudly.'],
  ['Přehraje hlasitý tón, který vytlačí vodu z mřížky.', 'Plays a loud tone intended to eject water from the grille.'],
  ['Formát hodnot EQ zatím není ověřený — zápis může uložit nesmyslnou křivku.',
   'The EQ value format is not verified; writing could store an invalid curve.'],
  ['Změní počet uložených vlastních EQ profilů.', 'Changes the number of stored custom EQ profiles.'],
  ['Změna parametrů přenosu zasáhne běžící zvukové spojení — přehrávání může na chvíli vypadnout a při příliš vysokém bitpoolu i trhat.',
   'Changing transport parameters affects the active audio link; playback may drop briefly or stutter when the bitpool is too high.'],
  ['Nevhodný kodek může zhoršit nebo úplně přerušit přehrávání.', 'An unsuitable codec may degrade or completely interrupt playback.'],
  ['Režim Hi-Res. Oficiální appka pro 780NC pro něj nemá kartu, takže zpět jen odsud nebo továrním resetem.',
   'Hi-Res mode. The official 780NC app has no control for it, so it can only be reverted here or by factory reset.'],
  ['Volume limiter. Oficiální appka pro 780NC pro něj nemá kartu.', 'Volume limiter. The official 780NC app has no control for it.'],
  ['Volume limit. Oficiální appka pro 780NC pro něj nemá kartu, takže ztlumení půjde vrátit jen odsud nebo továrním resetem.',
   'Volume limit. The official 780NC app has no control for it, so attenuation can only be reverted here or by factory reset.'],
  ['Přepne režim PersoniFi — může přenastavit zvukový profil.', 'Switches Personi-Fi mode and may alter the sound profile.'],
  ['Spustí režim sluchového testu, přehraje testovací tóny.', 'Starts hearing-test mode and plays test tones.'],
  ['Spustí průvodce nastavením PersoniFi.', 'Starts the Personi-Fi setup flow.'],
  ['Přepne stranu sluchového testu.', 'Changes the side used by the hearing test.'],
  ['Nastaví frekvenci sluchového testu.', 'Sets the hearing-test frequency.'],
  ['PIN zamkne nastavení ochrany sluchu. Bez jeho znalosti už ho nepůjde změnit.',
   'The PIN locks hearing-protection settings. They cannot be changed without it.'],
  ['Zapne zesilování okolního zvuku přímo do uší. Může být nečekaně hlasité a oficiální appka pro to u těchto modelů nemá kartu.',
   'Amplifies ambient sound directly into the ears. It may be unexpectedly loud, and the official app has no control for these models.'],
  ['Přesune zesílení mezi levou a pravou stranu, slyšíš to hned.', 'Moves gain between the left and right sides with an immediate audible effect.'],
  ['Přímo řídí, jak moc se okolní zvuk zesílí do uší. Vysoká hodnota může být hlasitá a oficiální appka to u těchto modelů neumí vrátit.',
   'Directly controls ambient-sound gain into the ears. A high value may be loud, and the official app cannot revert it on these models.'],
  ['Jazykové balíčky se nahrávají přes OTA, což tahle appka neumí. Pokud vybraný jazyk v zařízení není, hlášky umlknou a vrátit je půjde jen oficiální JBL appkou.',
   'Language packs are installed through OTA, which this app does not support. Selecting a missing language may silence prompts; use the official JBL app to restore them.'],
  ['Spustí skenování — může krátce přerušit zvuk.', 'Starts a scan and may briefly interrupt audio.'],
  ['Přepne sluchátka na jiné vysílání.', 'Switches the headphones to another broadcast.'],
  ['Přepne přehrávanou podskupinu.', 'Switches the playing subgroup.'],
  ['Změní kvalitu vysílání a znovu naváže spojení.', 'Changes broadcast quality and reconnects.'],
  ['Změní heslo Auracast vysílání — posluchači se budou muset připojit znovu.',
   'Changes the Auracast broadcast password; listeners must reconnect.'],
  ['Přepnutí LE Audio restartuje zvukové spojení.', 'Switching LE Audio restarts the audio connection.'],
  ['Přepne do párovacího režimu, aktuální spojení se může rozpojit.', 'Enters pairing mode and may drop the current connection.'],
  ['Úroveň potlačení hluku, 127 = maximum.', 'Noise-cancellation level; 127 is maximum.'],
  ['Propouští okolní zvuky dovnitř.', 'Lets ambient sound through.'],
  ['Ztlumí hudbu a zesílí hlasy, aby šlo mluvit bez sundání.', 'Lowers music and amplifies voices for conversation without removing the headphones.'],
  ['Protocol 4 nemá parametr u dotazu — nejdřív nastav „EQ — profile query“, pak dej GET tady. Výběr nahoře je jen pro přehled.',
   'Protocol 4 has no query parameter. Set EQ — profile query first, then use GET here. The selector above is only an overview.'],
  ['10 pásem 32 · 64 · 125 · 250 · 500 · 1k · 2k · 4k · 8k · 16k Hz, ±6 dB. Kódování zatím není ověřené.',
   'Ten bands from 32 Hz to 16 kHz, ±6 dB. Encoding is not yet verified.'],
  ['Očekává 2 bajty. Význam hodnoty není ověřený — nejdřív si přečti aktuální stav.',
   'Expects two bytes. The meaning is not verified; read the current state first.'],
  ['Stav lokálního serveru, ze kterého běží tahle stránka', 'Status of the local server hosting this page'],
];

const exactPairs = [...exact].sort((a, b) => b[0].length - a[0].length);

function translate(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (exact.has(trimmed)) return value.replace(trimmed, exact.get(trimmed));
  let out = value;
  for (const [from, to] of phrases) out = out.replaceAll(from, to);
  for (const [from, to] of exactPairs) out = out.replaceAll(from, to);
  out = out
    .replaceAll('čte se přes', 'read via')
    .replaceAll('jen ke čtení', 'read only')
    .replaceAll('celý profil: kategorie, zisky L/R a pásma (frekvence, zisk, Q) plus název',
      'full profile: category, L/R gain and bands (frequency, gain, Q), plus name')
    .replace(/hex bajty, po (\d+) B na číslo/g, 'hex bytes, $1 B per number')
    .replaceAll('celé číslo', 'integer')
    .replaceAll('úroveň', 'level')
    .replace(/\bPROFIL\b/g, 'PROFILE')
    .replace(/\bprofil\b/g, 'profile')
    .replaceAll('vyšší bitrate', 'higher bitrate')
    .replaceAll('vyšší kvalita', 'higher quality')
    .replace(/\bnebo\b/g, 'or');
  return out;
}

function translateNode(root) {
  if (root.nodeType === Node.TEXT_NODE) {
    const next = translate(root.nodeValue);
    if (next !== root.nodeValue) root.nodeValue = next;
    return;
  }
  if (!(root instanceof Element)) return;
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    if (root.hasAttribute(attr)) {
      const current = root.getAttribute(attr);
      const next = translate(current);
      if (next !== current) root.setAttribute(attr, next);
    }
  }
  for (const child of root.childNodes) translateNode(child);
}

translateNode(document.documentElement);
new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'characterData') translateNode(record.target);
    if (record.type === 'attributes') translateNode(record.target);
    for (const node of record.addedNodes) translateNode(node);
  }
}).observe(document.documentElement, {
  subtree: true, childList: true, characterData: true, attributes: true,
  attributeFilter: ['title', 'placeholder', 'aria-label'],
});

export { translate };
