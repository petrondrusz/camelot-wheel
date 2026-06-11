# Session log — ladění detekce tóniny

> Pracovní deník iterativního ladění mikrofonní detekce tóniny + akordů.
> Slouží k navázání v další session. Nejnovější nahoře.

---

## 2026-06-11 (6) — Intro „radar sweep bloom" (v17) ✨✨

**Stav buildu:** `v17` · live na Vercelu. Uživatel chtěl intro „složitější, víc wow".

### Vrstvená sekvence (stále jen CSS/SVG, žádná knihovna)

1. **Hub ping** (`#intro-pulse`, nový SVG kroužek) — prstenec vyletí ze středu
   (scale 0.92→2.7, fade), kickoff. 40–800 ms.
2. **Radar paprsek** (`.intro-sweep`, nový `<div>` v `.wheel-wrap`) — rotující
   `conic-gradient` se světlou náběžnou hranou, `mask` na prstenec, `mix-blend:
   screen`, otočí ~1.3× s ease-out decelerací a zhasne. 140–1440 ms.
3. **Segmenty v jeho stopě** — angle-based stagger (`--bd = 230 + ringLag + (k-1)*72`,
   po směru hodin) + **pružinový overshoot** (`--ease-back`, scale 0.82→1). →1582 ms.
4. **Title sheen** posunut na konec (1050–1950 ms).
- `body.intro` sundáno po **2050 ms** nebo při startu poslechu. Vše pod
  `prefers-reduced-motion: no-preference`. Časování ověřeno (vše < 2050 ms).

### Soubory

`index.html` (+1 div), `style.css` (radar/ping/keyframes), `app.js` (ping kroužek,
angle-based `--bd`, okno 2050 ms). Detekce/etalon nedotčeny.

### Mimochodem

Uživatel potvrdil: **detekce trefuje songy dobře, i hardcore.** Baseline drží.

---

## 2026-06-11 (5) — Load animace: bloom kola od středu (v16) ✨

**Stav buildu:** `v16` · live na Vercelu.

### Zadání

Uživatel chtěl „fancy GSAP animaci při načtení na pár vteřin". **GSAP zamítnut** —
externí knihovna porušuje tvrdé pravidlo (jen 3 soubory, žádné knihovny, žádný build);
bezpečnostně je GSAP ✅ ok, ale architektonicky ne. Uděláno **čistě CSS/SVG**, vibe
„rozkvět od středu" (zvoleno uživatelem).

### Co jsme udělali (jen `style.css` + `app.js`)

- **`seg-bloom`**: 12+12 segmentů kola fade-scale (opacity 0→1, scale 0.86→1) se
  staggerem `--bd` — vnitřní prstenec A vede, vnější B o 150 ms za ním, kolem dokola
  po `k` → rozkvět od středu ven. Po doběhu se přes **existující** `transition:
  opacity 180ms` usadí na klidovou tlumenost (žádný skok).
- **`title-sheen`**: jednorázový lesklý přejezd přes gradient „Wheel".
- **Spouštění:** `body.intro` přidáno při loadu (jen když `!reduceMotion`), sundáno
  po 1700 ms **nebo** při startu poslechu (`startListening`), ať `both`-fill held stav
  nedrží zpět živou heatmapu.
- **Reduced-motion:** celé pod `@media (prefers-reduced-motion: no-preference)` →
  uživatelé s omezeným pohybem vidí statické kolo.
- Ease tokeny už v projektu (`--ease-out: cubic-bezier(0.23,1,0.32,1)`), match
  doporučení pro UI animace. Timing ověřen: nejdelší segment doběhne 1442 ms, sheen
  1470 ms, intro sundáno 1700 ms → vše stihne.

### Pozn.

Animace není součást detekce → do DETECTION.md nepatří (jen bump verze v16).
Etalon ani detekce nedotčeny.

---

## 2026-06-11 (4) — REVERT latche (v15): vrácení adaptivity ↩️

**Stav buildu:** `v15` · live na Vercelu.

### Proč

Uživatel hlásil regresi: *„co dřív dobře určovalo, teď se plete i tam, kde to
fungovalo. Kontrolní songy ale drží."* To přesně sedí na **latch (v13)**:
zmrazil **první** lock a držel ho. U písní, co se dřív samy opravily (chroma
dosbírala signál), latch tu **ranní chybu zabetonoval** → regrese. Kontrolní songy
„drží", protože se zamknou správně hned napoprvé (tam latch nemá co pokazit).

### Co jsme udělali

- **Revertován celý latch** (`lockFav`/`lockMode`, incumbent-collapse hradlo
  v detektoru změny, latch na výstupu). Detekce zpět na **ověřené v12 chování**
  (`camDist` anti-churn zůstává). Čistý revert — `grep` potvrdil 0 zbytků.
- **Keep-alive (v14) ZŮSTÁVÁ** — to je nezávislý defenzivní fix, žádná regrese.
- Lekce zapsaná do DETECTION.md §9 jako „slepá ulička": **stabilizační vrstva
  nesmí přebít schopnost opravit ranní omyl.** Stejný typ chyby jako v9 bas-rozhodčí
  — vyměnit obecnou správnost za jeden sporný edge case se nevyplácí.

### Hotel California zpět jako známé omezení

Modální směs (H nat. moll ⊕ H dorská), chroma bloudí podle pasáže. Pro jamování
to vadí míň — 10A/11B/11A/9A jsou vzájemně kompatibilní, B moll pentatonika sedí
na celý song. (Možné do budoucna: „soft latch", co ustoupí setrvale silnějšímu
usazenému čtení — ale jen když nerozbije etalon. Zatím NE.)

---

## 2026-06-11 (3) — keep-alive AudioContextu (v14) + odhalená příčina „silence"

**Stav buildu:** `v14` · live na Vercelu.

### Symptom a SKUTEČNÁ příčina

Overlay ukazoval `silence 32.4s … 55.3s — restarted`, hub spadl na mic ikonu,
i když hudba hrála. **Desktopová záhada vyřešena uživatelem: zavřené víko MacBooku
v clamshell režimu (externí monitor) → vestavěný mic se fyzicky vypnul.** Tj. desktop
**nebyl bug v kódu**, ale HW. Mobilní „silence 55.3s" je samostatný výskyt — mohl být
suspend kontextu nebo taky prostředí (pauza songu / přepnutí appky).

### Co jsme přesto udělali (defenzivní hardening, v14)

I tak má smysl: AudioContext se na **Safari/iOS sám suspenduje** (šetření energií /
„interrupt") a `resume()` se volal jen jednou v `startListening`. To je reálná díra
pro dlouhoběžící mic appky — opraveno, ať appka přežije i softwarový výpadek.
**Není to regrese z v12/v13.**

### Oprava — aktivní keep-alive

- `wakeAudio()` (idempotentní `resume()` když stav ≠ running) se volá **každý frame**
  ve `loop()`, na `audioCtx.onstatechange` a na `visibilitychange`/`focus`.
- `openMicStream()` vytaženo ze `startListening` — když iOS **ukončí mic track**
  (`onended`), stream se **znovu otevře** (jinak trvalé ticho). Loop běží dál, mění
  se jen `analyser`; `if (!rafId)` brání dvojímu rAF.
- Syntax OK. Funkčně ověřit na zařízení (HW-závislé, nejde simulovat v node).

### Latch (v13) potvrzen v reálu

#43 ukázal `locked:maj 11B` a uživatel potvrdil „od půlky drží 11B" → latch **drží**
jednu odpověď, jak měl. (Pozn.: u Hotel California to drží 11B = dorská/relativní
strana, ne 10A — chytlo se to později, až když dominovala křížková část. To je
hraniční modální případ, ne chyba latche.)

### Diagnostika pro uživatele

Spodní VU sloupce se MUSÍ hýbat při zvuku. Když jsou ploché a kontext běží → HW/routing
(mic neslyší song: sluchátka, špatný vstup, ztlumeno), ne appka.

---

## 2026-06-11 (2) — LATCH: zamčená odpověď drží (v13) ⭐ přerámování účelu

**Stav buildu:** `v13` · live na Vercelu.

### Klíčové přerámování (od uživatele)

Účel appky **NENÍ** DJ-přesnost, ale: *„nehudebník bez cvičeného sluchu chce rychle
dostat JEDNU tóninu, které může věřit, a jamovat se songem (kytara)."* → **Stabilita
a jedna důvěryhodná odpověď > teoretická preciznost.** Manuální „freeze" tap je
k ničemu (kdo neslyší tóninu, neví, kdy zmáčknout) — appka musí sama dát stabilní
odpověď.

### Co jsme udělali — latch s hradlem na „zhroucení domácí tóniny"

- **Princip:** jakmile se jednou zamkne, **zalatchuj** favorita (`lockFav`/`lockMode`)
  a drž ho v hubu i na hmatníku. Pusť latch **jen při potvrzené změně písně**.
- **Co odlišuje vnitropísňovou odbočku od změny písně:** přežije-li **vlastní
  chroma podpora zamčené tóniny**. Modální odbočka (HC dorská část) → domácí Bm má
  pořád skoro všechny noty → `slow.raw[lockFav]` drží. Nová píseň → noty staré
  tóniny zmizí → `raw` se zhroutí. `changing` se proto spustí jen při
  `camDist > 1` **A ZÁROVEŇ** `slow.raw[lockFav] < CONF_LOCK_MIN` (0.4).
- **Ověřeno simulací (4 scénáře):** HC dorská odbočka (raw10=0.6) drží 10A · reálná
  změna (raw10→0.25) pustí ve 4 s · etalon jednotónová drží · hraniční (0.38) pustí.
- **Důsledek pro Hotel California:** chytí úvodní čistý Bm (10A) a **drží ho** přes
  dorské pasáže místo úletu na 12B (E dur). B moll pentatonika sedí na celý song →
  přesně ta použitelná odpověď, kterou nehudebník chce.

### Filozofická poznámka

Latch vědomě přebíjí i sebevědomější chroma živého framu (12B r0.76). To **není**
porušení §0 — §0 platí pro *detekci*; latch je vrstva **stability** nad ní. Detekce
najde tóninu, latch rozhoduje, jak agresivně přepisovat už ukázanou odpověď.

### Reálný stav HC (predikce, čeká na potvrzení)

Funguje to za předpokladu, že `raw[10]` (H moll) v dorských pasážích zůstane nad 0.4.
H moll sdílí 6/7 not s H dorskou (jen G vs G#), takže by mělo. **Příští test: pustit
HC na v13 a ověřit, že 10A drží.**

---

## 2026-06-11 (1) — stabilita zámku, camDist gate (v12)

(viz níž, ponecháno; v12 hradlo `camDist > 1` je základ, na kterém v13 latch staví)

---

## 2026-06-11 — stabilita zámku u tonálně bohatých songů (v12)

**Stav buildu:** `v12` · vše live na Vercelu.

### Co jsme udělali

**Detekce změny songu jen při harmonicky vzdáleném favoritovi** — `app.js`
- **Symptom (Eagles „Hotel California", H moll 10A):** zámek držel jen pár vteřin,
  pak spadl a hledal znovu — pokaždé na jiné tónině (11A F#m → 11B → 10B D dur).
- **Příčina:** detektor změny písně (`disagreeMs/CHANGE_MS`) bral přirozené
  harmonické kolísání mezi **10A↔11A↔10B** jako *změnu songu*. Jenže to jsou
  **Camelot-kompatibilní sousedi** (relativní = stejné číslo, kvinta = ±1).
  Každý úlet > 4 s = falešná „změna" → odemkne → hledá znovu.
- **Oprava:** „odpor" se počítá jen při `camDist(heat.fav, settled) > 1`. Kolísání
  mezi kompatibilními sousedy zámek **neodemkne** — popisek se zpřesňuje na místě.
  Skutečná změna (≥ 2 čísla = ≥ 2 kvinty) se pořád hlásí v 4 s.
- **Ověřeno simulací:** HC kolísání → lock drží; reálná změna 10A→4A → změna v 4.0 s;
  kompat. změna 10A→11A → schválně nehlásí (pomalý integrátor tam doplave).

**Dovětek z reálného testu (v12):** Hotel California je hlubší případ, než se zdálo
— **modální směs H nat. moll ⊕ H dorská** (song hraje G i G# současně: Em/G vs.
E dur/C#m). Chroma proto přejíždí celý „křížkový" oblouk **9A–10A–11B–12B**, ne jen
úzké okolí. Tělo songu koreluje s dorskou stranou silněji (12B r0.76) než s 10A,
takže to **bezpečně neřeší žádná heuristika** (kategorie SNA): cokoli „chytřejšího"
zamrzne na 12B, ne na 10A; a globální neleaky akumulátor (co by udržel úvodní Bm)
by rozbil detekci změny písně. v12 hradlo tlumí jen úzké kolísání, ne tenhle široký
oblouk. **Zapsáno do §11 jako známé omezení.** v12 zůstává (čistý přínos pro úzké
případy). Otevřená myšlenka: manuální „freeze/hold" tap na hub (UX, ne detekce).

---

## 2026-06-10 — revert bas-rozhodčího, zámek hustých songů, stabilita módu

**Stav buildu:** `v11` · vše live na Vercelu · pracovní strom čistý.

### Co jsme udělali

1. **Revert bas-rozhodčího kvintové dvojznačnosti (v9 → v10)** — commit `8edd059`
   - v9 zkoušel rozhodovat kvintovou dvojznačnost (C vs G) podle toho, na které
     tónice sedí bas. **Backfire:** bas typicky sedí na **dominantě** (G je V. stupeň
     C dur *i zároveň* tónika G dur) — neumí rozlišit přesně tu kvintovou dvojici,
     na kterou cílil. Na Oasis „Don't Look Back in Anger" to posilovalo špatnou
     tóninu (9B/G místo 8B/C).
   - **Oprava:** kompletně odstraněn `bassTime` mechanismus, návrat k čistému
     `keyFit` (v8 logika v `correctKey`). Ověřeno simulací: Oasis 23-vs-19 keyFit
     teď čistě překoná práh 1.2 → **8B** ✅.

2. **Zámek u harmonicky hustých songů + stabilita módu (v11)** — commit `d575ef3`
   - **Problém A (Billie Jean nikdy nezamkl):** hustý mollový groove stropuje
     K-K korelaci kolem ~0.45, pod prahem zámku 0.56 → spinner se točil do konce.
     **Oprava:** `CONF_LOCK_MIN = 0.4` — po dlouhém stabilním držení
     (`LOCK_FALLBACK_MS = 30 s`) stačí k zámku i nižší korelace.
   - **Problém B (mód oscoloval min↔maj):** F#m se opírá o III. stupeň = A dur,
     což překračovalo starý práh přepnutí 1.3×. **Oprava:** práh módu 1.3 → 1.8×.
   - Ověřeno simulací: lock gate 5/5, mód stabilní. Billie Jean → **11A** ✅.

3. **Řídký modální riff jako známé omezení (SNA)** — commit `ec0b428` (jen docs)
   - White Stripes „Seven Nation Army" (E moll 9A): jen basový riff, žádné akordy.
     E moll a C dur sdílí skoro všechny tóny, riff prochází přes C (bVI), což pumpuje
     keyFit pro C dur → chroma dlouho váhá 8B↔9A.
   - **Vědomě NEopraveno.** Špatný override `9A→8B` je strukturálně **identický**
     s tím, co správně zachránilo Billie Jean (`12A→11A`) — keyFit ty dva případy
     nerozezná. Jakékoli zpřísnění gate by regresovalo Billie Jean.
   - Zapsáno do DETECTION.md §11 jako vědomé omezení.

### Etalon (regresní baseline) — 5/5 čistě

| Song | Očekáváno | Výsledek |
|------|-----------|----------|
| Adele — Rolling in the Deep | 5A | ✅ |
| Bob Marley — Three Little Birds | 11B | ✅ |
| Daft Punk — Get Lucky | 10A | ✅ |
| Oasis — Don't Look Back in Anger | 8B | ✅ (opraveno v10) |
| Michael Jackson — Billie Jean | 11A | ✅ (opraveno v11) |
| White Stripes — Seven Nation Army | 9A | ⚠️ na hranici (řídký modální riff, viz §11) |

### Klíčový princip (potvrzeno znovu)

**Chroma je robustní JÁDRO; korekce jen opravují její slepá místa**
(kvinta / relativní dvojznačnost), nikdy nepřebíjí sebevědomý chroma favorit.
Každá oprava, která degradovala správné chroma čtení (v9 bas, příliš horlivý
přepínač módu), byla regrese k vrácení.

---

## Dál v plánu

- **Pokračovat v testování dalších songů** — uživatel posílá screenshot debug
  overlaye, já diagnostikuju nelock/misdetekci a opravuju. Každá oprava ověřena
  node simulací před commitem.
- **Hlídat regrese etalonu** — každá nová oprava musí udržet 5/5 výše.
  Pozor zejména na Billie Jean (relaxovaný zámek) a Oasis (čistý keyFit bez basu).
- **SNA zůstává otevřené omezení** — řídké modální riffy jsou strukturálně
  nerozlišitelné keyFitem. Pokud na to chceme sáhnout, je potřeba **jiný signál**
  než keyFit (např. detekce tónického centra z baslinky / kadence), ne ladění prahů.

### Pracovní workflow (připomínka)

- Tvrdé hranice: čistě statické, **bez build stepu, bez knihoven** — jen
  `index.html`, `style.css`, `app.js`. PWA manifest zachovat. README česky.
  DETECTION.md dokumentuje pipeline.
- Před commitem: `node --check app.js` + standalone node simulace scoring/lock matiky.
- Deploy: auto na Vercel při pushi do `main`. Live: https://camelot-wheel-two.vercel.app
- Debug overlay čte: `key chroma X→Y ←FIX`, `fit` (top-3 keyFit), `mode/chord/bass`,
  `lvl/t/loop`, `ring` (searching/locked + APP_VERSION).
