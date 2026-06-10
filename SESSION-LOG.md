# Session log — ladění detekce tóniny

> Pracovní deník iterativního ladění mikrofonní detekce tóniny + akordů.
> Slouží k navázání v další session. Nejnovější nahoře.

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
