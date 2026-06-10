# Detekce tóniny z mikrofonu — jak to funguje

Tenhle dokument popisuje **celý řetězec analýzy**, kterým appka z živého zvuku
z mikrofonu odhaduje **Camelot číslo + mód** (např. `5A` = C moll). Slouží jako
referenční mapa pro budoucí ladění — ať se k tomu dá vrátit s plným kontextem,
ať už ho čte člověk nebo Claude.

Vše je ve `app.js` (čistá statika, žádné knihovny, žádný build). Tenhle dokument
odkazuje na **konkrétní funkce a konstanty** v něm.

---

## 0. Návrhová filozofie (čti první)

> **Chroma je spolehlivé jádro. Korekce jsou jen záchranná síť na její dvě slepá
> místa: kvintové a relativní/paralelní záměny.**

Chroma (rozložení 12 tónů přes celé vyhlazené spektrum + Krumhansl-Kessler
profily) je robustní, protože průměruje desítky sekund signálu. Naproti tomu
**detekce akordů je šumivá** (plete kvalitu moll/dur, v hustém mixu i root).
Proto:

- Korekce postavené na akordech smí **přepsat chroma jen tam, kde je chroma
  prokazatelně slepá** — tj. mezi tóninami, které sdílí skoro všechny noty
  (kvinty: C↔G; relativní/paralelní: Cm↔Eb, Em↔Gm).
- Když chroma má **jasného favorita**, korekce mlčí.
- Když není **jasný akordový důkaz** o módu, řídíme se chroma.

Historicky skoro každá minela vznikla tím, že korekce přebila správnou chroma.
Každé pravidlo níž je hradlované tak, aby k tomu nedocházelo.

---

## 1. Cíl a rozsah

- **Vstup:** živý zvuk z mikrofonu (typicky píseň z repra).
- **Výstup:** Camelot číslo 1–12 + mód (A = moll, B = dur), zamčený po ustálení.
- **Funguje dobře:** songy s jasnou diatonickou harmonií (pop, rock s čistými
  akordy, klávesy, vokál nad akordy).
- **Známá omezení:** modální/blues/jazz se sníženou septimou nebo nediatonickou
  harmonií (AC/DC mixolydian, blues vampy, jazz s chromatikou). Tam appka trefí
  tonální centrum/root, ale mód nebo přesné číslo může minout. Viz §11.

---

## 2. Přehled pipeline

```
mikrofon (getUserMedia)
   │  echoCancellation/noiseSuppression/autoGainControl = false  ← KRITICKÉ
   ▼
AnalyserNode (fftSize 16384, smoothing 0)
   │  ~15×/s (ANALYZE_MS = 66)
   ▼
frameChroma()                     → 1 frame: chroma[12], w (tonalness), bass, dB
   │
   ├─► krátká EMA (EMA_TAU 3s) ──► scoreKeys() ──► heatmapa kola (živá reakce)
   │
   ├─► pomalá EMA (KEY_TAU 18s) ─► scoreKeys() ──► key.fav, key.minor, key.raw[]
   │                                                    │
   ├─► chordChroma EMA (0.45s) ─► detectChord() ─► updateChord() ─► chordTime[]
   │                                                    │           (leaky tally, MEM 20s)
   ▼                                                    ▼
RESOLUCE (analyzeChroma):
   favNum0 = correctKey(key.fav, key.raw)      ← kvintová korekce (keyFit + bas)
   mode    = tři-tóniková resoluce + důvěra chroma
   favNum  = paralelní-moll redirect (Gm vs Em)
   ▼
setHub() → lock gating (MIN_SPIN, smyčka, jistota) → zobrazení (kolo, hub, hmatník)
```

---

## 3. Zachycení zvuku (`initMic`)

```js
getUserMedia({ audio: {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
}})
```

Tyhle tři flagy jsou **kritické** — defaultní speech-processing filtry na
mobilech zabíjejí hudební signál z repra. AudioContext se vytváří/resumuje
**uvnitř user gesture** (tap na tlačítko), jinak ho iOS nepustí.

`AnalyserNode`: `fftSize = 16384` (jemné frekvenční rozlišení pro peak-picking),
`smoothingTimeConstant = 0` (vyhlazujeme si sami v čase). Smyčka přes
`requestAnimationFrame`, ale analýza se škrtí na **~15×/s** (`ANALYZE_MS`).

---

## 4. `frameChroma()` — chroma + bas z jednoho framu

Cíl: z aktuálního spektra udělat 12-složkový **chroma vektor** (energie na
pitch class) tak, aby přežil bicí, bas a šum.

1. `getFloatFrequencyData()` → dB spektrum. `maxDb` = nejsilnější bin.
   Když `maxDb < SILENCE_DB` (−90) → **ticho**, vrať `null` (analýza neběží).
2. **Peak-picking:** projdou se jen **lokální spektrální maxima** (harmonické
   parciály) v pásmu `BAND_LO–BAND_HI` (100–4500 Hz), které jsou silnější než
   `max − PEAK_FLOOR_DB` (42 dB). Tím spadne noise floor i širokopásmová
   perkuse, kterou by naivní součet binů nasbíral.
3. **Mid-emphasis:** každý peak se váží log-Gaussovkou centrovanou na ~400 Hz
   (`wf = exp(−(log2(f/400))² / (2·1.6²))`) — těžiště harmonie, ne bas/sykavky.
4. **Bas:** nejsilnější peak v **55–260 Hz** → pitch class basu (`fr.bass`).
   Používá se v `detectChord` ke kotvení akordu na nejnižší tón. Když je v base
   ticho, `bass = −1`. (Pozn.: jako rozhodčí tóniny se bas NEpoužívá — viz §8a.)
5. **Tonalness váha `w`:** `crest = max/mean` chroma. Jasný akord je „špičatý",
   šum plochý. Mapuje se na `w ∈ [0.2, 1]` — šumivé framy sotva hnou odhadem,
   ale nikdy ho nezmrazí.
6. Chroma se normalizuje na `max = 1`. Vrací `{ chroma, w, bass, db }`.

---

## 5. Integrátory (leaky EMA v čase)

Vyhlazení v čase = exponenciální klouzavý průměr `a = exp(−dt/τ)`:

| integrátor | τ | k čemu |
|---|---|---|
| `emaChroma` | `EMA_TAU` 3 s | krátké okno → **živá heatmapa** kola (reaguje na aktuální akordy) |
| `keyEma` | `KEY_TAU` 18 s (nebo `KEY_TAU_FAST` 4 s při změně songu) | **celková tónina** — pomalý, stabilní, vážený `w` |
| `chordChroma` | `CHORD_TAU` 0.45 s | krátké okno pro **detekci akordu** |
| `chordTime[]` | `CHORD_MEM_TAU` 20 s | **nasčítaná paměť** akordů (leaky, ať nová píseň přebije starou) |

Klíč: `keyEma` je záměrně **pomalý a bez warmupu** — radši se ustálí déle, než
aby hádal brzo. Přírůstek je vážený tonalness `w`, takže šum integrátor téměř
nehne (`lr = (1 − exp(−dt/τ)) · w`).

---

## 6. `scoreKeys()` — Krumhansl-Kessler + Camelot

Pro každou z 12 transpozic se spočítá **Pearsonova korelace** chroma s rotovaným
K-K profilem (dur i moll):

```js
KK_MAJ = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]
KK_MIN = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17]
```

24 tónin se sloučí na **12 Camelot čísel** přes `max(dur, relativní moll)`:

```
dur:  n = ((8 + 7·s − 1) % 12) + 1
moll: n = ((8 + 7·((s+3)%12) − 1) % 12) + 1     // relativní moll téhož čísla
```

Ověření: C dur (s=0) → 8, G dur (s=7) → 9, A moll (s=9) → 8, E moll (s=4) → 9. ✓

`majRoot(m) = ((7·(m−8)) % 12 + 12) % 12` je inverzní mapování (Camelot číslo →
semitón durové toniky). Vrací: `fav` (číslo), `corr` (korelace favorita),
`minor` (vyhrál moll profil?), `raw[]` (skóre všech 12 čísel pro heatmapu i
plauzibilitní hradlo v `correctKey`).

---

## 7. Detekce akordů

### `detectChord(ch, bass, triads)`
Kosinová podobnost chroma se **šablonami trojzvuku** (`MAJ_T = [0,4,7]`,
`MIN_T = [0,3,7]`) přes všech 24 (`ALL_TRIADS`). Plus:

- **Bas kotvení:** `bass == root` → `+BASS_BONUS` (0.2); `bass == kvinta` →
  `+0.4·BASS_BONUS`. Drží detektor na backing akordech, ne na hlasité melodii.
- **Blue-note bias:** moll kandidát se penalizuje o `BLUE_BIAS · max(0, ♮3 − ♭3)`
  — tj. **jen o přebytek velké tercie nad malou**. Pravý moll akord (♭3 vede)
  zůstane moll i s trochou ♮3 z harmonických; blues s vedoucí ♮3 se překlopí na
  dur. (Klíčové: bez `max(0, …)` to dřív překlápělo Bm→B, C#m→C# v hustém mixu.)

### `updateChord(...)` — debounce + smyčka
Nový akord se **zapíše až po `CHORD_HOLD_MS` (320 ms)** stálosti (čistý strip).
Při zápisu: pokud se akord v `chordSeq` už objevil → `loopSeen = true`
(**detekce smyčky** = progrese udělala cyklus). Zapsané akordy se nasčítají do
`chordTime[]` (leaky, paměť 20 s).

`chordTime[]` je **vstup pro všechny korekce** níž.

---

## 8. Resoluce v `analyzeChroma` — od chroma k finálnímu klíči

Tady se z chroma favorita stane finální `favNum` + `mode`. Tři kroky, každý
hradlovaný proti přepsání správné chroma:

### 8a. `correctKey(n0, raw)` — kvintová korekce (čistý keyFit)
Opravuje **off-by-kvinta** chyby (C↔G), kde chroma je slepá (sdílí 6/7 not).

- **keyFit(m):** kolik času se v `chordTime[]` strávilo na **diatonických
  trojzvucích** tóniny `m` (vážené: tónika ×2, dominanta ×1.4, …). Měří „jak
  akordová progrese sedí na tóninu m". Kvintovou dvojici C↔G rozlišuje právě ten
  jeden tón, kterým se liší (F vs F♯) → tj. jestli hrané IV/V akordy sedí na C
  nebo na G. To keyFit zachytí přímo.
- **Plauzibilitní hradlo:** kandidát `m` se zváží **jen když je chroma
  konkurenční** (`raw[m] ≥ raw[n0] − 0.06`). Jasný chroma favorit = žádná
  záměna, nepřepisuj.
- **Override** jen když `keyFit(best) > 1.2 × keyFit(n0)`.

> **Slepá ulička (v9, revertováno):** zkusil jsem bas jako rozhodčího kvint
> (`+BASS_KEY_W · podíl basu na tonice`). Selhalo to principiálně — bas často
> sedí na **dominantě** (G je V. stupeň C dur *i* tónika G dur), takže neumí
> rozlišit zrovna tu dvojici, na kterou byl určen, a na Oasis aktivně posiloval
> **špatnou** tóninu (9B/G místo 8B/C). Vráceno na čistý keyFit ve v10.

### 8b. Mód přes tři tóniky + důvěra chroma
Mód (dur/moll) se určí porovnáním **skutečných tónik** páru, ne přes sdílené
akordy:

```
gMajT = chordTime[majTonika]        // Eb pro pár 5
gRelT = chordTime[relativní moll]   // Cm
gParT = chordTime[paralelní moll]   // Ebm
```

- Když `gMajT < 0.3 && gRelT < 0.3` (žádný důkaz) → **věř chroma** (`key.minor`).
- Jinak překlop na relativní tóninu **jen při drtivé převaze** (`> 1.8×`). Moll
  song se často opírá o svůj III. stupeň (F♯m → spousta A dur), aniž by byl v A —
  to nesmí překlopit 11A→11B a rozkmitat mód tak, že se to nikdy nezamkne
  (Billie Jean). Práh 1.8 (dřív 1.3) drží mód u chroma, dokud akordy nekřičí.

Tím se neopakuje chyba „Rolling in the Deep": Cm (chroma správně 5A) se nesmí
překlopit na relativní Eb (5B) jen proto, že zazněl **sdílený** Bb (V v Eb i ♭VII
v Cm). Sdílený akord nerozlišuje — rozhoduje tónika.

### 8c. Paralelní-moll redirect
Když **paralelní moll tónika** (Gm) jasně vede nad oběma ostatními
(`gParT > 1.5 × max(gMajT, gRelT)` a `> 0.5 s`), přesměruj na **jiné Camelot
číslo** (`n → n−3`) jako moll. Bez toho appka uměla dosáhnout jen na relativní
moll (Em) téhož čísla — Gm songy hlásila jako Em. (Nina Simone „Feeling Good".)

---

## 9. Zamykání (`setHub` → `locked`)

Zamkne se, **až když je splněno všechno**:

```
held   = analyzedMs ≥ LOCK_FALLBACK_MS (30 s)   // dlouhé stabilní držení
locked = !changing                              // neprobíhá změna songu
       && analyzedMs ≥ MIN_SPIN_MS (15 s)       // točilo se aspoň 15 s
       && (loopSeen || held)                     // progrese udělala smyčku (nebo fallback)
       && corr ≥ floor                           // floor = held ? CONF_LOCK_MIN(0.4) : CONF±0.06
```

- **Relaxace jistoty:** dokud nemá smyčku ani 30 s, vyžaduje plnou jistotu
  (`CONF ± 0.06`, hystereze: zamčené drží snáz). **Po 30 s stabilního držení**
  (`held`) klesne práh na `CONF_LOCK_MIN` (0.4) — harmonicky husté songy stropují
  na K-K korelaci ~0.45 a jinak by se točily donekonečna (**Billie Jean** 11A:
  číslo zabetonované 180 s, ale `corr 0.45` < `CONF+0.06`). Stejnou relaxaci má
  i manuální stop (`stopListening`), ať se dlouho držený výsledek nezahodí.
- **Změna songu:** když krátkodobý odhad (`heat`) jistě odporuje ustálenému
  (`keyEma`) déle než `CHANGE_MS` (4 s), `keyEma` se přeladí rychle (`KEY_TAU_FAST`).
- **Auto-restart:** 2 s ticha → `resetDetection()` (čerstvé integrátory).
- Spinner se točí rychleji s rostoucím `progress` (čas × jistota); po zamčení
  se obroučka obarví podle módu (zelená dur / fialová moll).

---

## 10. Debug overlay — jak číst

Zapni `?debug` v URL nebo **trojklik na nadpis**. Řádky:

```
key   chroma 5A r0.70 → 5A r0.70        ← chroma favorit (před korekcí) → finální; r = korelace
                          (←FIX)         ← se objeví, když se finální liší od chroma (korekce zasáhla)
fit   5:20  4:17  6:14                   ← top-3 keyFit (Camelot číslo : skóre)
mode  min   chord Gm   bass C            ← rozhodnutý mód · aktuální akord · detekovaný bas
lvl   −76dB ok   t 47.8s   loop Y        ← úroveň/weak · doba analýzy · viděna smyčka?
ring  locked:min   v11                   ← stav obroučky (searching/locked + mód) · verze buildu
```

**Nejdůležitější řádek je `key`** — pokud `chroma` sedí a `final` ne, problém je
v korekci (§8). Pokud nesedí už `chroma`, je to peak-picking/integrátor (§4–6).
`APP_VERSION` (`v11`) páruje screenshot s konkrétním buildem — **bump při každém
deployi**.

---

## 11. Známá omezení

Chroma + K-K předpokládá **funkční dur/moll**. Tam, kde harmonie tenhle
předpoklad poruší, appka trefí centrum, ale mód/číslo může minout:

- **Mixolydian / blues-rock** (AC/DC = A s ♮♭7 „G"): ♭7 svádí chroma od dur
  k příbuzné mollové barvě. Root sedí, mód kolísá.
- **Blues vampy** (E7 vamp = dur tónika nad moll pentatonikou): dur vs moll je
  objektivně sporné, i komerční detektory nesouhlasí.
- **Jazz/soul s chromatikou** (Nina Simone „Feeling Good"): víc tonálních center,
  chroma „dopadne" jinam podle pasáže.

Tyhle se **záměrně neřeší** — principiální fix (mixolydian profil) by zaváděl
nové záměny (A-mix a D dur mají identické noty) a riskoval rozladění čistých
songů. Bereme: *root spolehlivý, mód best-effort.*

---

## 12. Konstanty (rychlá reference)

| konstanta | hodnota | role |
|---|---|---|
| `ANALYZE_MS` | 66 | ~15 analýz/s |
| `EMA_TAU` / `KEY_TAU` / `KEY_TAU_FAST` | 3 / 18 / 4 s | heatmapa / tónina / přeladění |
| `CHANGE_MS` | 4000 | jak dlouho odpor, než přeladí song |
| `MIN_SPIN_MS` / `LOCK_FALLBACK_MS` | 15 / 30 s | min. točení / nejzazší zámek |
| `CONF` / `CONF_SURE` | 0.5 / 0.68 | práh jistoty / horní mez spinneru |
| `CONF_LOCK_MIN` | 0.4 | uvolněný práh zámku po 30 s stabilního držení |
| `BAND_LO`–`BAND_HI` | 100–4500 Hz | analyzované pásmo |
| `SILENCE_DB` / `WEAK_DB` / `WEAK_REC` | −90 / −90 / 4 | ticho / slabý signál / hystereze |
| `PEAK_FLOOR_DB` | 42 | práh peak-pickingu pod max |
| `CHORD_MEM_TAU` | 20 s | paměť `chordTime` |
| `CHORD_TAU` | 0.45 s | okno detekce akordu |
| `CHORD_MIN` / `CHORD_MARGIN` / `CHORD_HOLD_MS` | 0.55 / 0.04 / 320 | prahy + debounce akordu |
| `BASS_BONUS` | 0.2 | bas = root akordu bonus |
| `BLUE_BIAS` | 0.3 | penalizace moll o přebytek ♮3 |

---

## 13. Testovací etalon

Čisté diatonické songy s jednoznačnou tóninou (ověř Camelot na **tunebat.com**):

| song | očekáváno | testuje |
|---|---|---|
| Adele – Rolling in the Deep | 5A (Cm) | mód: moll se nepřeklopí na relativní dur |
| Daft Punk – Get Lucky | 10A (Bm) | čistá moll + smyčka |
| Bob Marley – Three Little Birds | 11B (A) | čistá dur + A↔E kvinta |
| Oasis – Don't Look Back in Anger | 8B (C) | C↔G kvinta (keyFit override) |
| Michael Jackson – Billie Jean | 11A (F♯m) | nízká korelace (zámek po 30 s) + III-lean mód |

**Postup:** pusť slušně nahlas, nech doběhnout přes `MIN_SPIN_MS` + smyčku až na
`locked`, čti řádek `chroma → final`. Restart tlačítka (nebo 2 s pauza)
re-rolluje z čisté pasáže.

---

## 14. Co zachovat

- **Čistá statika, žádné knihovny, žádný build step.** Jen `index.html`,
  `style.css`, `app.js`, PWA manifest.
- **Korekce smí přepsat chroma jen u kvintových/relativních/paralelních záměn**
  (její slepá místa), nikdy u jasného chroma favorita.
- Při změně logiky **bumpni `APP_VERSION`** a ověř na testovacím etalonu (§13),
  ať nedojde k regresi.
