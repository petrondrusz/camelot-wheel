"use strict";

const DATA = {
  1:  { B: ["B", 11],  A: ["G\u266Fm", 8]  },
  2:  { B: ["F\u266F", 6], A: ["D\u266Fm", 3]  },
  3:  { B: ["D\u266D", 1], A: ["B\u266Dm", 10] },
  4:  { B: ["A\u266D", 8], A: ["Fm", 5]   },
  5:  { B: ["E\u266D", 3], A: ["Cm", 0]   },
  6:  { B: ["B\u266D", 10], A: ["Gm", 7]  },
  7:  { B: ["F", 5],   A: ["Dm", 2]   },
  8:  { B: ["C", 0],   A: ["Am", 9]   },
  9:  { B: ["G", 7],   A: ["Em", 4]   },
  10: { B: ["D", 2],   A: ["Bm", 11]  },
  11: { B: ["A", 9],   A: ["F\u266Fm", 6]  },
  12: { B: ["E", 4],   A: ["C\u266Fm", 1]  }
};

const NS = "http://www.w3.org/2000/svg";
const CX = 200, CY = 200;
const RINGS = { B: [136, 194, 174, 150], A: [80, 136, 117, 96] };

const COLORS = {
  B:   { fill: "url(#durGrad)",  stroke: "rgba(10,228,72,0.55)",   t1: "#8DF5AE", t2: "#4FB872" },
  A:   { fill: "url(#mollGrad)", stroke: "rgba(157,149,255,0.55)", t1: "#C9C4FF", t2: "#8C85DE" },
  sel: { fill: "url(#selGrad)", stroke: "#FF8709", t1: "#1C0A05", t2: "#4A1C10" }
};

let sel = loadSel() || { num: 8, ring: "A" };
let lockedNum = null;
const segs = {};

function loadSel() {
  try {
    const raw = localStorage.getItem("camelot-sel");
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (DATA[p.num] && (p.ring === "A" || p.ring === "B")) return p;
  } catch (e) { /* private mode etc. */ }
  return null;
}

function saveSel() {
  try { localStorage.setItem("camelot-sel", JSON.stringify(sel)); } catch (e) {}
}

function el(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function pt(r, a) {
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function wedgePath(r1, r2, a1, a2) {
  const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2);
  const [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
  const f = n => n.toFixed(2);
  return `M${f(x1)} ${f(y1)} A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)} L${f(x3)} ${f(y3)} A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)} Z`;
}

function fullName(num, ring) {
  const n = DATA[num][ring][0];
  return ring === "B" ? n + " major" : n.slice(0, -1) + " minor";
}

function mod12(n) { return ((n - 1) % 12 + 12) % 12 + 1; }

function compat(num, ring) {
  return [
    [mod12(num - 1), ring],
    [mod12(num + 1), ring],
    [num, ring === "B" ? "A" : "B"]
  ];
}

function fretE(s) { return (s - 4 + 12) % 12; }
function fretA(s) { return (s - 9 + 12) % 12; }

function addDefs(svg, id) {
  // Orange→pink selection gradient (per-element). Reused for the fret dot too.
  addGrad(svg, id, "#FF8709", "#FB64B6");
}

// Append a linear gradient. With `span` ([x1,y1,x2,y2]) it spans the wheel's
// user space, so all wedges of a ring share one coherent diagonal; without it,
// it maps to each element's own box.
function addGrad(svg, id, c1, c2, span) {
  let defs = svg.querySelector("defs");
  if (!defs) { defs = el("defs", {}); svg.appendChild(defs); }
  const attrs = span
    ? { id, gradientUnits: "userSpaceOnUse", x1: span[0], y1: span[1], x2: span[2], y2: span[3] }
    : { id, x1: "0", y1: "0", x2: "1", y2: "1" };
  const lg = el("linearGradient", attrs);
  lg.append(
    el("stop", { offset: "0%", "stop-color": c1 }),
    el("stop", { offset: "100%", "stop-color": c2 })
  );
  defs.appendChild(lg);
}

function buildWheel() {
  const wheel = document.getElementById("wheel");
  addGrad(wheel, "selGrad", "#FF8709", "#FB64B6");
  // Ring gradients (GSAP-style), spanning the wheel for one coherent diagonal.
  addGrad(wheel, "durGrad", "#62F593", "#06B838", [40, 40, 360, 360]);
  addGrad(wheel, "mollGrad", "#C3B0FF", "#7A5BFF", [40, 40, 360, 360]);
  for (let k = 1; k <= 12; k++) {
    const th = (k * 30 - 90) * Math.PI / 180;
    const gap = 1.7 * Math.PI / 180;
    const a1 = th - 15 * Math.PI / 180 + gap;
    const a2 = th + 15 * Math.PI / 180 - gap;

    for (const ring of ["B", "A"]) {
      const [r1, r2, rc, rn] = RINGS[ring];
      const g = el("g", {
        "class": "seg",
        role: "button",
        tabindex: "0",
        "aria-label": k + ring + ", " + fullName(k, ring)
      });
      const p = el("path", { d: wedgePath(r1, r2, a1, a2), "stroke-width": "1" });
      const [tx, ty] = pt(rc, th);
      const [nx, ny] = pt(rn, th);
      // Primary = note name (letters), secondary = Camelot code.
      const t1 = el("text", {
        x: tx, y: ty, "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": "17", "font-weight": "600"
      });
      t1.textContent = DATA[k][ring][0];
      const t2 = el("text", {
        x: nx, y: ny, "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": "13"
      });
      t2.textContent = k + ring;
      g.append(p, t1, t2);
      const pick = () => { lockedNum = null; sel = { num: k, ring }; saveSel(); update(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
      wheel.appendChild(g);
      segs[k + ring] = { g, p, t1, t2, ring, num: k };
    }
  }

  const hub = el("circle", {
    cx: CX, cy: CY, r: 66,
    fill: "#161817", stroke: "#2A2D2B", "stroke-width": "1"
  });
  wheel.appendChild(hub);

  // Confidence ring around the hub: spins while searching, locks as a
  // highlighted gradient border once the detection is confident.
  const ring = el("circle", {
    id: "hub-ring", cx: CX, cy: CY, r: 66,
    fill: "none", stroke: "url(#selGrad)", "stroke-width": "3", "stroke-linecap": "round"
  });
  ring.style.display = "none";
  wheel.appendChild(ring);

  // Key name large + pure white on top, Camelot number smaller + muted below.
  const hName = el("text", {
    id: "hub-name", "class": "hub-text", x: CX, y: CY - 12, "text-anchor": "middle",
    "dominant-baseline": "central", "font-size": "24", "font-weight": "600", fill: "#FFFFFF"
  });
  const hCode = el("text", {
    id: "hub-code", "class": "hub-text", x: CX, y: CY + 15, "text-anchor": "middle",
    "dominant-baseline": "central", "font-size": "18", "font-weight": "500", fill: "#A9A796"
  });
  wheel.append(hName, hCode);

  // Mic icon shown in the hub while listening (replaces the "?"/text state).
  // Two nested groups: .hub-mic-rms (live level) wraps .hub-mic-breath (baseline).
  const micG = el("g", { id: "hub-mic", transform: "translate(171.2 171.2) scale(2.4)" });
  micG.style.display = "none";
  const rmsG = el("g", { "class": "hub-mic-rms" });
  const breathG = el("g", { "class": "hub-mic-breath" });
  const mr = el("rect", { x: "9", y: "2", width: "6", height: "11", rx: "3", fill: "url(#selGrad)" });
  const mp1 = el("path", { d: "M5 11a7 7 0 0 0 14 0", fill: "none", stroke: "url(#selGrad)", "stroke-width": "2", "stroke-linecap": "round" });
  const mp2 = el("path", { d: "M12 18v3M8.5 21h7", fill: "none", stroke: "url(#selGrad)", "stroke-width": "2", "stroke-linecap": "round" });
  breathG.append(mr, mp1, mp2);
  rmsG.appendChild(breathG);
  micG.appendChild(rmsG);
  wheel.appendChild(micG);
}

function update() {
  const compKeys = compat(sel.num, sel.ring).map(c => c[0] + c[1]);
  for (const key in segs) {
    const s = segs[key];
    const isSel = key === sel.num + sel.ring;
    const isComp = compKeys.includes(key);
    const c = isSel ? COLORS.sel : COLORS[s.ring];
    s.p.setAttribute("fill", c.fill);
    s.p.setAttribute("fill-opacity", isSel ? "1" : (isComp ? "0.34" : "0.14"));
    s.p.setAttribute("stroke", c.stroke);
    s.t1.setAttribute("fill", c.t1);
    s.t2.setAttribute("fill", c.t2);
    s.g.classList.toggle("sel", isSel);
    s.g.classList.remove("detected");
    s.g.style.opacity = (isSel || isComp) ? "1" : "0.32";
    s.g.setAttribute("aria-pressed", isSel ? "true" : "false");
  }

  if (hubMic) showHubMic(false);
  setRing("off");
  for (const id of ["hub-code", "hub-name"]) {
    const t = document.getElementById(id);
    t.classList.remove("pop");
    void t.getBBox();
    t.classList.add("pop");
  }
  document.getElementById("hub-code").textContent = sel.num + sel.ring;
  document.getElementById("hub-name").textContent = fullName(sel.num, sel.ring);

  const chips = document.getElementById("chips");
  chips.innerHTML = "";
  for (const [n, r] of compat(sel.num, sel.ring)) {
    const b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    const code = document.createElement("span");
    code.className = "code " + (r === "B" ? "dur" : "moll");
    code.textContent = n + r;
    const name = document.createElement("span");
    name.textContent = fullName(n, r);
    b.append(code, name);
    b.style.animationDelay = (chips.children.length * 45) + "ms";
    b.addEventListener("click", () => { sel = { num: n, ring: r }; saveSel(); update(); });
    chips.appendChild(b);
  }

  const [note, semi] = DATA[sel.num][sel.ring];
  updateFret(fretE(semi), fretA(semi), note.replace("m", ""));
}

const FX = i => 38 + i * 25;
const FYA = 38, FYE = 78;
let dotA, dotE, dotLabelA, dotLabelE;

function dotX(f) { return f === 0 ? FX(0) - 12 : FX(f) - 12.5; }

function buildFretStatic() {
  const svg = document.getElementById("fret");
  let s = "";
  s += `<text x="14" y="${FYA}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#A8AAA3">A</text>`;
  s += `<text x="14" y="${FYE}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#A8AAA3">E</text>`;
  s += `<line x1="${FX(0) - 12}" y1="${FYA}" x2="${FX(12)}" y2="${FYA}" stroke="#3A3D3B" stroke-width="1.5"/>`;
  s += `<line x1="${FX(0) - 12}" y1="${FYE}" x2="${FX(12)}" y2="${FYE}" stroke="#3A3D3B" stroke-width="2"/>`;
  for (let i = 0; i <= 12; i++) {
    s += `<line x1="${FX(i)}" y1="${FYA - 18}" x2="${FX(i)}" y2="${FYE + 18}" stroke="#2A2D2B" stroke-width="${i === 0 ? 3 : 1}"/>`;
  }
  for (const i of [3, 5, 7, 9]) {
    s += `<circle cx="${FX(i) - 12.5}" cy="${(FYA + FYE) / 2}" r="2.5" fill="#3A3D3B"/>`;
  }
  s += `<circle cx="${FX(12) - 12.5}" cy="${FYA - 6}" r="2.5" fill="#3A3D3B"/>`;
  s += `<circle cx="${FX(12) - 12.5}" cy="${FYE + 6}" r="2.5" fill="#3A3D3B"/>`;
  for (const i of [0, 3, 5, 7, 9, 12]) {
    s += `<text x="${dotX(i)}" y="${FYE + 40}" text-anchor="middle" font-size="12" fill="#6F716C">${i}</text>`;
  }
  svg.innerHTML = s;
  addDefs(svg, "dotGrad");

  const mk = () => {
    const g = el("g", { "class": "dot" });
    const c = el("circle", { cx: 0, cy: 0, r: 13, fill: "url(#dotGrad)" });
    const t = el("text", {
      x: 0, y: 0, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": "12", "font-weight": "600", fill: "#1C0A05"
    });
    g.append(c, t);
    svg.appendChild(g);
    return [g, t];
  };
  [dotA, dotLabelA] = mk();
  [dotE, dotLabelE] = mk();
}

function updateFret(fE, fA, note) {
  dotA.style.transform = `translate(${dotX(fA)}px, ${FYA}px)`;
  dotE.style.transform = `translate(${dotX(fE)}px, ${FYE}px)`;
  dotLabelA.textContent = note;
  dotLabelE.textContent = note;
}

/* ---------- Detekce tóniny z mikrofonu ---------- */

// Krumhansl-Kessler profily (tonika = index 0)
const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const CONF = 0.5;          // práh jistoty (Pearsonova korelace)
const ANALYZE_MS = 66;     // ~15 analýz/s
const EMA_TAU = 3;         // heatmapa — krátké vyhlazování [s]
const KEY_TAU = 18;        // celková tónina — pomalý, stabilní integrátor [s]
const KEY_TAU_FAST = 4;    // při detekované změně písně přeladit rychle [s]
const CHANGE_MS = 4000;    // jak dlouho musí krátkodobý odhad odporovat, než přeladí
const MIN_SPIN_MS = 15000; // spinner se točí aspoň 15 s, než se vůbec zamkne
const LOCK_FALLBACK_MS = 30000; // pokud se nenajde smyčka akordů, zamkni nejpozději tady
const CONF_SURE = 0.68;    // horní mez pro škálu rychlosti spinneru (progress)
const BAND_LO = 100, BAND_HI = 4500;   // analyzované pásmo [Hz]
const SILENCE_DB = -90;    // pod tím je ticho (mic ikona, analýza neběží)
const WEAK_DB = -74;       // vyhlazená úroveň pod tímhle = slabý signál → varování
const PEAK_FLOOR_DB = 42;  // píky slabší než (max − 42 dB) ignorujeme jako noise floor
const CHORD_MEM_TAU = 20;  // paměť progrese [s] — leaky, ať se nová píseň prosadí
const SILENCE_HIDE_MS = 700; // teprve po tomhle souvislém tichu ukázat mic ikonu

// Živá detekce akordů (omezená na diatoniku detekované tóniny → vyšší přesnost)
const CHORD_TAU = 0.45;    // krátké okno pro akord [s]
const CHORD_MIN = 0.55;    // min. shoda se šablonou akordu
const CHORD_MARGIN = 0.04; // min. náskok favorita nad druhým
const CHORD_HOLD_MS = 320; // jak dlouho musí kandidát vydržet, než se zapíše
const BASS_BONUS = 0.2;    // bonus, když nejnižší tón = root akordu (kotví na bas)
const BLUE_BIAS = 0.3;     // moll skóre dolů, je-li přítomná i velká tercie (blues b3)
const MAX_CHORDS = 4;      // kolik akordů držet v progression stripu
const MAJ_T = [0, 4, 7], MIN_T = [0, 3, 7];
const ALL_TRIADS = (() => { const a = []; for (let r = 0; r < 12; r++) a.push([r, "maj"], [r, "min"]); return a; })();
const SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT  = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const SHARP_KEYS = new Set([0, 7, 2, 9, 4, 11]); // C,G,D,A,E,B major → use sharps

let audioCtx = null;
let analyser = null;
let micStream = null;
let micSrc = null;
let freqBuf = null;
let timeBuf = null;
let rafId = null;
let listening = false;
let emaChroma = null;   // short EMA → heatmap
let keyEma = null;      // long leaky integrator → overall key
let analyzedMs = 0;     // accumulated time of actual (non-silent) analysis
let disagreeMs = 0;     // how long the short-term key has fought the settled one
let levelDb = null;     // smoothed peak level → stable weak-signal hint
let weakWarn = false;   // current weak-signal warning state (hysteresis)
let silenceMs = 0;      // run of silence → auto-restart on a pause
let chordChroma = null; // short EMA → chord detection
let chordCur = null;    // committed chord { root, qual }
let chordCand = null;   // candidate chord being timed before commit
let chordCandMs = 0;
let chordHist = [];     // recent committed chords [{ name, qual }]
let chordTime = {};     // accumulated seconds per chord ("root:qual") → mode from progression
let chordSeq = [];      // recent committed chord keys → loop/cycle detection
let loopSeen = false;   // the progression has returned to an earlier chord (a loop)
let lastAnalyzeT = 0;
let lastFav = null;
let lastResult = null;       // { fav, corr }
let hubCode = null, hubName = null, hubMic = null, hubRing = null;
let ringKey = "off";   // "<state>:<mode>" e.g. "off:" | "searching:" | "locked:maj"
let lastSpinDur = "";
let micBtn = null, micStatusEl = null, appEl = null, chordStripEl = null;
let debugEl = null;     // live diagnostics overlay (?debug or triple-tap title)

// Button analyzer — symmetric volume bars left/right of the icon.
const N_BARS = 5;
const BAND_EDGES = [60, 160, 400, 1000, 2500, 6000]; // 5 log-ish bands [Hz]
let byteBuf = null;
let bandRanges = null;           // [[startBin, endBin], …] computed per stream
const barLevel = new Array(N_BARS).fill(0.15); // smoothed 0–1 per band
let barsL = [], barsR = [];      // bar elements, outer→center

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pearson(x, y) {
  const n = x.length;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const d = Math.sqrt(dx * dy);
  return d ? num / d : 0;
}

function pearsonRot(vec, profile, s) {
  const rot = new Array(12);
  for (let pc = 0; pc < 12; pc++) rot[pc] = profile[(pc - s + 12) % 12];
  return pearson(vec, rot);
}

// Z vyhlazeného chroma vrátí 12 normalizovaných skóre (Camelot 1–12),
// index favorita a jeho surovou korelaci.
function scoreKeys(chroma) {
  const cam = new Array(13).fill(-Infinity);
  const camMinor = new Array(13).fill(false); // did the minor profile win this number?
  for (let s = 0; s < 12; s++) {
    const cM = pearsonRot(chroma, KK_MAJ, s);
    const cm = pearsonRot(chroma, KK_MIN, s);
    const nM = ((8 + 7 * s - 1) % 12) + 1;
    const nm = ((8 + 7 * ((s + 3) % 12) - 1) % 12) + 1;
    if (cM > cam[nM]) { cam[nM] = cM; camMinor[nM] = false; }
    if (cm > cam[nm]) { cam[nm] = cm; camMinor[nm] = true; }
  }
  let fav = 1, mn = Infinity, mx = -Infinity;
  for (let n = 1; n <= 12; n++) {
    if (cam[n] > cam[fav]) fav = n;
    if (cam[n] < mn) mn = cam[n];
    if (cam[n] > mx) mx = cam[n];
  }
  const norm = new Array(13).fill(0);
  const span = mx - mn || 1e-9;
  for (let n = 1; n <= 12; n++) norm[n] = (cam[n] - mn) / span;
  return { norm, fav, corr: cam[fav], minor: camMinor[fav], raw: cam };
}

// Major tonic semitone of a Camelot number (inverse of the mapping in scoreKeys).
function majRoot(m) { return ((7 * (m - 8)) % 12 + 12) % 12; }

// The six diatonic triads of a Camelot key's major scale as [root, quality,
// weight]. Weights favour the pillars (I, V, vi, IV) that define the key.
function diatonicTriads(m) {
  const r = majRoot(m);
  return [
    [r, "maj", 2.0],            // I
    [(r + 2) % 12, "min", 1.0], // ii
    [(r + 4) % 12, "min", 1.0], // iii
    [(r + 5) % 12, "maj", 1.2], // IV
    [(r + 7) % 12, "maj", 1.4], // V
    [(r + 9) % 12, "min", 1.4]  // vi (= relative minor tonic)
  ];
}

// Chord-progression key finder. Chroma confuses keys that share notes — not
// just fifth-neighbours (Db↔Ab) but also more distant ones. Their diatonic
// CHORDS differ, though, so score how much the (unconstrained) progression fits
// each key's diatonic triads (quality-aware) and pick the best fit GLOBALLY,
// across all 12 keys. Chroma stays a sanity gate so we never jump to a key it
// finds implausible; needs ≥5 s of chords and a clear fit margin to override.
function keyFit(m) {
  let s = 0;
  for (const [root, q, w] of diatonicTriads(m)) s += (chordTime[root + ":" + q] || 0) * w;
  return s;
}
function correctKey(n0, raw) {
  let total = 0;
  for (const k in chordTime) total += chordTime[k];
  if (total < 5) return n0;
  const f0 = keyFit(n0);
  let best = n0, bestF = f0;
  for (let m = 1; m <= 12; m++) {
    if (m === n0 || raw[m] < raw[n0] - 0.12) continue; // chroma must find it plausible
    const f = keyFit(m);
    if (f > bestF) { bestF = f; best = m; }
  }
  return (best !== n0 && bestF > f0 * 1.2) ? best : n0;
}

// Živá heatmapa — obě výseče páru (A i B) podle skóre svého čísla.
// Nejpravděpodobnější pár (fav) navíc pulzuje (.detected) — opacity řídí CSS
// animace, takže ji tady nepřepisujeme inline stylem.
function applyHeatmap(norm, fav) {
  for (const key in segs) {
    const s = segs[key];
    const sc = norm[s.num];
    const c = COLORS[s.ring];
    const isFav = s.num === fav;
    s.g.classList.remove("sel");
    s.g.classList.toggle("detected", isFav);
    if (isFav) s.g.style.opacity = "";
    else s.g.style.opacity = (0.12 + 0.88 * sc).toFixed(3);
    s.p.setAttribute("fill", c.fill);
    s.p.setAttribute("fill-opacity", (0.14 + 0.5 * sc).toFixed(3));
    s.p.setAttribute("stroke", c.stroke);
    s.t1.setAttribute("fill", c.t1);
    s.t2.setAttribute("fill", c.t2);
    s.g.setAttribute("aria-pressed", "false");
  }
}

function popHub() {
  if (reduceMotion) return;
  for (const t of [hubCode, hubName]) {
    t.classList.remove("pop");
    void t.getBBox();
    t.classList.add("pop");
  }
}

// Confidence ring. States: off | searching (spinner) | locked (full border).
// Colour follows the mode: green (major) / purple (minor); orange→pink only
// before the progression has decided. Only flips on a real change so the CSS
// animation isn't restarted.
function setRing(state, mode) {
  const k = state + ":" + (mode || "");
  if (!hubRing || ringKey === k) return;
  ringKey = k;
  hubRing.style.display = state === "off" ? "none" : "";
  hubRing.classList.toggle("searching", state === "searching");
  hubRing.classList.toggle("locked", state === "locked");
  hubRing.classList.toggle("maj", mode === "maj");
  hubRing.classList.toggle("min", mode === "min");
}

// Spinner speed reflects progress toward locking (slow → fast). Progress is
// gated by elapsed time AND confidence, so it isn't pinned fast the whole time.
function setSpin(progress) {
  if (!hubRing) return;
  const p = Math.max(0, Math.min(1, progress));
  const d = p < 0.25 ? "2.2s" : p < 0.5 ? "1.6s" : p < 0.8 ? "1.1s" : "0.8s";
  if (d !== lastSpinDur) { lastSpinDur = d; hubRing.style.setProperty("--spin-dur", d); }
}

// Show the animated mic icon in the hub instead of the code/name texts.
// Used only for true silence / before the first reading.
function showHubMic(on) {
  if (!hubMic) return;
  hubMic.style.display = on ? "" : "none";
  hubMic.classList.toggle("active", on);
  hubCode.style.display = on ? "none" : "";
  hubName.style.display = on ? "none" : "";
  // Ring is left untouched here so brief silent gaps don't reset a locked
  // border back to the spinner; its tier is driven by setHub / start / lock.
  if (on) lastFav = null;
  else { hubCode.style.opacity = "1"; hubName.style.opacity = "1"; }
}

// Live favorite — always shown while there's sound. Confidence (>= CONF)
// only controls the visual certainty (dim = still settling) and the
// release-lock; it must NOT gate the live display, or the key never shows.
function setHub(fav, corr, minor, changing) {
  showHubMic(false);
  const pmode = progressionMode(fav);            // null until enough chords
  const mode = pmode || (minor ? "min" : "maj"); // chroma fallback

  // Lock when it has spun ≥ MIN_SPIN_MS, is confident, no change is underway,
  // AND the progression has shown a loop (or a longer fallback elapsed) — so it
  // hears the chords cycle before committing rather than snapping early.
  const wasLocked = ringKey.startsWith("locked");
  const progressed = loopSeen || analyzedMs >= LOCK_FALLBACK_MS;
  const locked = !changing && analyzedMs >= MIN_SPIN_MS && progressed &&
                 corr >= (wasLocked ? CONF - 0.06 : CONF + 0.06);

  const favChanged = fav !== lastFav;
  lastFav = fav;
  if (locked && (!wasLocked || favChanged)) popHub(); // pop on lock / key change
  if (locked) {
    const ring = mode === "min" ? "A" : "B";     // resolved single key (D, or Bm)
    hubName.textContent = DATA[fav][ring][0];
    hubCode.textContent = fav + ring;
  } else {
    hubName.textContent = DATA[fav].A[0] + " / " + DATA[fav].B[0];
    hubCode.textContent = String(fav);
  }
  hubCode.style.opacity = locked ? "1" : "0.4";
  hubName.style.opacity = locked ? "1" : "0.4";

  // Spinner speed: progress gated by time & confidence (slow while changing).
  const timeP = Math.min(1, analyzedMs / MIN_SPIN_MS);
  const confP = Math.max(0, Math.min(1, (corr - 0.45) / (CONF_SURE - 0.45)));
  setSpin(changing ? 0.15 : Math.min(timeP, confP));

  // Ring colour follows mode; orange→pink only before the progression decides.
  setRing(locked ? "locked" : "searching", pmode || (locked ? mode : null));
}

// Build a 12-bin chroma from the current spectrum using only local spectral
// peaks (the harmonic partials) above a relative floor — this drops the noise
// floor and broadband percussion that contaminate a naive bin-sum. Returns the
// normalised chroma plus a tonalness weight (how peaky → how trustworthy).
function frameChroma() {
  analyser.getFloatFrequencyData(freqBuf);
  const n = analyser.frequencyBinCount;
  const binHz = audioCtx.sampleRate / analyser.fftSize;
  const lo = Math.max(2, Math.floor(BAND_LO / binHz));
  const hi = Math.min(n - 2, Math.ceil(BAND_HI / binHz));

  let maxDb = -Infinity;
  for (let i = lo; i <= hi; i++) if (freqBuf[i] > maxDb) maxDb = freqBuf[i];
  if (!(maxDb > SILENCE_DB)) return null; // true silence → mic icon, analysis paused

  const floorDb = maxDb - PEAK_FLOOR_DB;
  const chroma = new Float64Array(12);
  for (let i = lo; i <= hi; i++) {
    const db = freqBuf[i];
    if (db < floorDb) continue;
    if (db < freqBuf[i - 1] || db < freqBuf[i + 1]) continue; // keep local peaks only
    const f = i * binHz;
    const mag = Math.pow(10, db / 20);
    const lf = Math.log2(f / 400);                 // emphasis on harmony fundamentals
    const wf = Math.exp(-(lf * lf) / (2 * 1.6 * 1.6));
    const pc = ((Math.round(12 * Math.log2(f / 440) + 69) % 12) + 12) % 12;
    chroma[pc] += Math.sqrt(mag) * wf;             // sqrt tames drums/bass
  }

  // Bass root: strongest peak in 55–260 Hz → likely the chord's root note.
  let bass = -1, bMax = -Infinity;
  const bLo = Math.max(2, Math.floor(55 / binHz));
  const bHi = Math.min(n - 2, Math.ceil(260 / binHz));
  for (let i = bLo; i <= bHi; i++) {
    const db = freqBuf[i];
    if (db < freqBuf[i - 1] || db < freqBuf[i + 1]) continue;
    if (db > bMax) {
      bMax = db;
      const f = i * binHz;
      bass = ((Math.round(12 * Math.log2(f / 440) + 69) % 12) + 12) % 12;
    }
  }
  if (bMax < SILENCE_DB) bass = -1;

  let sum = 0, mx = 0;
  for (let i = 0; i < 12; i++) { sum += chroma[i]; if (chroma[i] > mx) mx = chroma[i]; }
  if (mx <= 0) return null;
  // Crest = peak/mean: a clear chord is peaky, noise is flat. Maps to a 0.2–1
  // weight so noisy frames barely move the key estimate but never freeze it.
  const crest = mx / (sum / 12);
  const w = Math.min(1, Math.max(0.2, (crest - 2) / 3.5));
  for (let i = 0; i < 12; i++) chroma[i] /= mx;
  return { chroma, w, bass, db: maxDb };
}

function analyzeChroma(dt) {
  const fr = frameChroma();
  if (!fr) {
    // Debounce: a momentary dip below the floor (between beats/transients) must
    // NOT flip the locked key to the mic icon. Only react to a real gap.
    silenceMs += dt * 1000;
    if (silenceMs > SILENCE_HIDE_MS) {
      setSpin(0);
      // Sustained silence (a pause / end of song) → auto-restart the detection.
      if (silenceMs >= 2000 && analyzedMs > 0) {
        resetDetection(); setRing("searching"); lastResult = null; showHubMic(true);
      } else if (!ringKey.startsWith("locked")) {
        lastResult = null; showHubMic(true);   // searching + gap → mic icon
      }                                         // locked + short gap → keep the key shown
      if (debugEl) debugEl.textContent = "silence " + (silenceMs / 1000).toFixed(1) + "s" +
        (silenceMs >= 2000 ? " — restarted" : "");
    }
    return;
  }
  silenceMs = 0;
  const chroma = fr.chroma;
  analyzedMs += dt * 1000;

  // Weak-signal hint from a smoothed level with wide hysteresis (no blinking).
  const aL = Math.exp(-dt / 0.8);
  levelDb = levelDb === null ? fr.db : levelDb * aL + fr.db * (1 - aL);
  if (weakWarn ? levelDb > WEAK_DB + 9 : levelDb < WEAK_DB) weakWarn = !weakWarn;
  micStatus(weakWarn ? "Sound signal is weak" : "");

  // Short EMA (~3 s) → responsive heatmap (current chords).
  const a = Math.exp(-dt / EMA_TAU);
  if (!emaChroma) emaChroma = Array.from(chroma);
  else for (let i = 0; i < 12; i++) emaChroma[i] = emaChroma[i] * a + chroma[i] * (1 - a);
  const heat = scoreKeys(emaChroma);

  // Song-change detection: if the short-term key confidently disagrees with the
  // settled key for several seconds, speed the long integrator up to re-lock.
  const settled = keyEma ? scoreKeys(keyEma).fav : null;
  if (settled !== null && heat.fav !== settled && heat.corr > 0.5) disagreeMs += dt * 1000;
  else disagreeMs = Math.max(0, disagreeMs - dt * 2000);
  const changing = disagreeMs > CHANGE_MS;

  // Tonalness-weighted leaky integrator → overall key. Slow & stable normally,
  // fast only while a song change is in progress; forgets old songs over ~KEY_TAU.
  // (No fast warmup — it deliberately takes its time before settling.)
  const tau = changing ? KEY_TAU_FAST : KEY_TAU;
  const lr = (1 - Math.exp(-dt / tau)) * fr.w;
  if (!keyEma) keyEma = Array.from(chroma);
  else for (let i = 0; i < 12; i++) keyEma[i] += lr * (chroma[i] - keyEma[i]);

  const key = scoreKeys(keyEma);
  if (changing && key.fav === heat.fav) disagreeMs = 0; // re-locked → resume slow

  // Correct fifth-errors (off-by-one Camelot) using the chord progression's fit.
  const favNum = correctKey(key.fav, key.raw);
  const corr = key.raw[favNum];
  const mode = progressionMode(favNum) || (key.minor ? "min" : "maj");

  lastResult = { fav: favNum, corr };
  applyHeatmap(heat.norm, favNum);     // wheel reacts to chords, key pair pulses
  setHub(favNum, corr, key.minor, changing);
  // Live fretboard — root of the more probable mode of the pair (minor vs major).
  const [rNote, rSemi] = DATA[favNum][mode === "min" ? "A" : "B"];
  updateFret(fretE(rSemi), fretA(rSemi), rNote.replace("m", ""));

  // Live chords — short window, detected UNCONSTRAINED (any of the 24 triads,
  // bass-anchored) so the true key's chords are heard even when chroma is off;
  // the debounce keeps the strip clean and this tally drives the key finder.
  const aC = Math.exp(-dt / CHORD_TAU);
  if (!chordChroma) chordChroma = Array.from(chroma);
  else for (let i = 0; i < 12; i++) chordChroma[i] = chordChroma[i] * aC + chroma[i] * (1 - aC);
  updateChord(chordChroma, fr.bass, ALL_TRIADS, favNum, dt);
  // Leaky tally of time per chord → major/minor and fifth-correction from the
  // progression. Decays so a new song's chords overcome the previous one's.
  const decay = Math.exp(-dt / CHORD_MEM_TAU);
  for (const k in chordTime) chordTime[k] *= decay;
  if (chordCur) {
    const ck = chordCur.root + ":" + chordCur.qual;
    chordTime[ck] = (chordTime[ck] || 0) + dt;
  }

  if (debugEl) renderDebug(key, favNum, corr, mode, fr.bass);
}

// Live diagnostics overlay — toggle with ?debug or a triple-tap on the title.
function renderDebug(key, favNum, corr, mode, bass) {
  const fits = [];
  for (let m = 1; m <= 12; m++) fits.push([m, keyFit(m)]);
  fits.sort((a, b) => b[1] - a[1]);
  const top = fits.slice(0, 3).map(([m, f]) => m + ":" + f.toFixed(0)).join("  ");
  const chromaKey = key.fav + (key.minor ? "A" : "B");
  const finalKey = favNum + (mode === "min" ? "A" : "B");
  debugEl.textContent =
    "key   chroma " + chromaKey + " r" + key.corr.toFixed(2) +
      " → " + finalKey + " r" + corr.toFixed(2) + (key.fav !== favNum ? "  ←FIX" : "") + "\n" +
    "fit   " + top + "\n" +
    "mode  " + mode + "    chord " + (chordCur ? chordName(chordCur.root, chordCur.qual, favNum) : "—") +
      "    bass " + (bass >= 0 ? SHARP[bass] : "—") + "\n" +
    "lvl   " + (levelDb == null ? "—" : levelDb.toFixed(0) + "dB") + (weakWarn ? " WEAK" : " ok") +
      "    t " + (analyzedMs / 1000).toFixed(1) + "s    loop " + (loopSeen ? "Y" : "N") + "\n" +
    "ring  " + ringKey;
}

function toggleDebug() {
  if (debugEl) { debugEl.remove(); debugEl = null; return; }
  debugEl = document.createElement("pre");
  debugEl.id = "debug";
  debugEl.textContent = "debug on — start listening…";
  document.body.appendChild(debugEl);
}

// Decide major vs minor from how long the tonic (and dominant) chords are held.
// I + 0.4·V vs vi(=relative i) + 0.4·iii(=relative v). Falls back to null.
function progressionMode(keyNum) {
  const r = ((7 * (keyNum - 8)) % 12 + 12) % 12;
  const g = k => chordTime[k] || 0;
  const maj = g(r + ":maj") + 0.4 * g((r + 7) % 12 + ":maj");
  const min = g((r + 9) % 12 + ":min") + 0.4 * g((r + 4) % 12 + ":min");
  if (maj === 0 && min === 0) return null;
  return min > maj ? "min" : "maj";
}

// Best-matching chord among the given candidate triads. The bass note anchors
// the root strongly — the bassline carries the harmony, so this keeps the
// detector on the backing chords instead of chasing a loud vocal melody.
function detectChord(ch, bass, triads) {
  let cn = 0;
  for (let i = 0; i < 12; i++) cn += ch[i] * ch[i];
  cn = Math.sqrt(cn) + 1e-9;
  let best = null, b1 = -1, b2 = -1;
  for (const [root, q] of triads) {
    const t = q === "maj" ? MAJ_T : MIN_T;
    let dot = 0;
    for (const off of t) dot += ch[(root + off) % 12];
    let score = dot / (Math.sqrt(3) * cn);              // cosine vs binary triad template
    if (bass === root) score += BASS_BONUS;             // bass = root → strong confirm
    else if (bass === (root + 7) % 12) score += BASS_BONUS * 0.4; // bass = fifth
    // Blue-note bias: a natural 3rd present alongside the minor 3rd → a major /
    // dominant (blues) chord coloured by a b3, not a true minor chord.
    if (q === "min") score -= BLUE_BIAS * ch[(root + 4) % 12];
    if (score > b1) { b2 = b1; b1 = score; best = [root, q]; }
    else if (score > b2) b2 = score;
  }
  return { root: best[0], qual: best[1], score: b1, margin: b1 - b2 };
}

function chordName(root, qual, keyNum) {
  const r = ((7 * (keyNum - 8)) % 12 + 12) % 12;
  const nm = (SHARP_KEYS.has(r) ? SHARP : FLAT)[root];
  return qual === "min" ? nm + "m" : nm;
}

// Commit a new chord only after it has persisted (debounce) → stable strip.
function updateChord(ch, bass, triads, keyNum, dt) {
  const det = detectChord(ch, bass, triads);
  if (det.score < CHORD_MIN || det.margin < CHORD_MARGIN) return; // unsure → hold last
  if (chordCur && chordCur.root === det.root && chordCur.qual === det.qual) {
    chordCand = null; chordCandMs = 0;
    return;
  }
  if (chordCand && chordCand.root === det.root && chordCand.qual === det.qual) chordCandMs += dt * 1000;
  else { chordCand = det; chordCandMs = 0; }
  if (chordCandMs >= CHORD_HOLD_MS) {
    const ck = det.root + ":" + det.qual;
    if (chordSeq.includes(ck)) loopSeen = true; // progression returned → a loop
    chordSeq.push(ck);
    if (chordSeq.length > 8) chordSeq.shift();
    chordCur = { root: det.root, qual: det.qual };
    chordCand = null; chordCandMs = 0;
    chordHist.push({ name: chordName(det.root, det.qual, keyNum), qual: det.qual });
    if (chordHist.length > MAX_CHORDS) chordHist.shift();
    renderChordStrip();
  }
}

function renderChordStrip() {
  if (!chordStripEl) return;
  chordStripEl.textContent = "";
  chordHist.forEach((c, idx) => {
    if (idx > 0) {
      const sep = document.createElement("span");
      sep.className = "chord-sep";
      sep.textContent = "→";
      chordStripEl.append(sep);
    }
    const span = document.createElement("span");
    const isCur = idx === chordHist.length - 1;
    span.className = "chord " + (c.qual === "min" ? "min" : "maj") + (isCur ? " cur" : "");
    span.textContent = c.name;
    chordStripEl.append(span);
  });
}

// Live volume meter in the button — per-band level with fast attack / slow
// decay (VU feel). In near-silence the bars settle into a gentle idle wave so
// the button always reads as active. Drives transforms directly (no CSS vars
// on a parent) to avoid style recalc on the bars' siblings.
function renderMeter(now) {
  if (!byteBuf || !bandRanges) return;
  analyser.getByteFrequencyData(byteBuf);
  let active = false;
  for (let b = 0; b < N_BARS; b++) {
    const [lo, hi] = bandRanges[b];
    let s = 0;
    for (let i = lo; i < hi; i++) s += byteBuf[i];
    let v = Math.pow(s / ((hi - lo) * 255), 0.55); // 0–1, gamma lifts quiet detail
    if (v > 0.07) active = true;
    const k = v > barLevel[b] ? 0.55 : 0.12;       // fast attack, slow decay
    barLevel[b] += (v - barLevel[b]) * k;
  }
  if (!active) {
    for (let b = 0; b < N_BARS; b++) {
      const idle = 0.16 + 0.1 * Math.sin(now / 440 + b * 0.7);
      barLevel[b] += (idle - barLevel[b]) * 0.1;
    }
  }
  for (let b = 0; b < N_BARS; b++) {
    const sc = "scaleY(" + (0.1 + barLevel[b] * 0.9).toFixed(3) + ")";
    if (barsR[b]) barsR[b].style.transform = sc;
    if (barsL[b]) barsL[b].style.transform = sc; // mirrored layout via DOM order
  }
}

function loop() {
  rafId = requestAnimationFrame(loop);
  if (!analyser) return;
  const now = performance.now();
  if (!reduceMotion) renderMeter(now);

  // Overall level → reactive scale of the hub mic icon.
  analyser.getFloatTimeDomainData(timeBuf);
  let sum = 0;
  for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i];
  const rms = Math.sqrt(sum / timeBuf.length);
  if (hubMic) hubMic.style.setProperty("--rms", Math.min(1, rms * 8).toFixed(3));

  if (now - lastAnalyzeT >= ANALYZE_MS) {
    const dt = lastAnalyzeT ? (now - lastAnalyzeT) / 1000 : 1 / 15;
    lastAnalyzeT = now;
    analyzeChroma(dt);
  }
}

function micStatus(msg) { micStatusEl.textContent = msg || ""; }

// Reset all detection state to the "don't know yet" baseline. Used on start and
// on an auto-restart after a pause.
function resetDetection() {
  emaChroma = null;
  keyEma = null;
  chordChroma = null;
  analyzedMs = 0;
  disagreeMs = 0;
  levelDb = null;
  weakWarn = false;
  chordCur = null;
  chordCand = null;
  chordCandMs = 0;
  chordHist = [];
  chordTime = {};
  chordSeq = [];
  loopSeen = false;
  lastFav = null;
  lastResult = null;
  lastSpinDur = "";
  micStatus("");
  if (chordStripEl) chordStripEl.textContent = "";
}

function startListening() {
  if (listening) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micStatus("Microphone unavailable");
    return;
  }
  listening = true;
  lockedNum = null;
  silenceMs = 0;
  lastAnalyzeT = 0;
  resetDetection();
  micBtn.classList.add("listening");
  micBtn.setAttribute("aria-pressed", "true");
  if (appEl) appEl.classList.add("listening"); // dim chips, light up fretboard
  showHubMic(true);     // mic icon until the first reading arrives
  setRing("searching"); // spin from the very start

  // AudioContext vytvořit/resumnout synchronně v rámci gesta (iOS)
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    listening = false;
    micBtn.classList.remove("listening");
    micStatus("Microphone unavailable");
    return;
  }

  navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  }).then(stream => {
    if (!listening) { stream.getTracks().forEach(t => t.stop()); return; } // pustil dřív, než povolil
    micStream = stream;
    micSrc = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 16384;
    analyser.smoothingTimeConstant = 0;
    freqBuf = new Float32Array(analyser.frequencyBinCount);
    timeBuf = new Float32Array(analyser.fftSize);
    // Meter band → FFT bin ranges for this stream's sample rate.
    byteBuf = new Uint8Array(analyser.frequencyBinCount);
    const binHz = audioCtx.sampleRate / analyser.fftSize;
    bandRanges = [];
    for (let b = 0; b < N_BARS; b++) {
      const lo = Math.max(1, Math.floor(BAND_EDGES[b] / binHz));
      const hi = Math.min(analyser.frequencyBinCount - 1, Math.ceil(BAND_EDGES[b + 1] / binHz));
      bandRanges.push([lo, Math.max(lo + 1, hi)]);
    }
    micSrc.connect(analyser);
    loop();
  }).catch(() => {
    listening = false;
    micBtn.classList.remove("listening");
    micBtn.setAttribute("aria-pressed", "false");
    micStatus("Microphone unavailable");
  });
}

function stopListening() {
  if (!listening) return;
  listening = false;
  micBtn.classList.remove("listening");
  micBtn.setAttribute("aria-pressed", "false");
  if (appEl) appEl.classList.remove("listening");
  micStatus("");
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  if (micSrc) { try { micSrc.disconnect(); } catch (e) {} micSrc = null; }
  analyser = null;

  if (lastResult && lastResult.corr >= CONF) {
    lockedNum = lastResult.fav;
    renderLocked();
  } else {
    lockedNum = null;
    update(); // obnovit běžný stav kola
  }
}

// Zamčený výsledek — pár výsečí (A i B) zvýrazněný gradientem.
function renderLocked() {
  for (const key in segs) {
    const s = segs[key];
    const isLock = s.num === lockedNum;
    const c = isLock ? COLORS.sel : COLORS[s.ring];
    s.g.classList.toggle("sel", isLock);
    s.g.classList.remove("detected");
    s.p.setAttribute("fill", c.fill);
    s.p.setAttribute("fill-opacity", isLock ? "1" : "0.14");
    s.p.setAttribute("stroke", c.stroke);
    s.t1.setAttribute("fill", c.t1);
    s.t2.setAttribute("fill", c.t2);
    s.g.style.opacity = isLock ? "1" : "0.28";
    s.g.setAttribute("aria-pressed", isLock ? "true" : "false");
  }
  lastFav = null;
  showHubMic(false);
  // Final locked result → single resolved key + border in the mode colour.
  const mode = progressionMode(lockedNum) || "maj";
  const ring = mode === "min" ? "A" : "B";
  setRing("locked", mode);
  hubCode.style.opacity = "1";
  hubName.style.opacity = "1";
  hubName.textContent = DATA[lockedNum][ring][0];
  hubCode.textContent = lockedNum + ring;
  popHub();
}

function initMic() {
  micBtn = document.getElementById("mic");
  micStatusEl = document.getElementById("mic-status");
  hubCode = document.getElementById("hub-code");
  hubName = document.getElementById("hub-name");
  hubMic = document.getElementById("hub-mic");
  hubRing = document.getElementById("hub-ring");
  appEl = document.querySelector(".app");
  chordStripEl = document.getElementById("chord-strip");

  // barsR: center→outer maps to band 0→4. barsL is reversed so the same band
  // sits at the mirrored position on the left (bass near center, treble outside).
  barsR = Array.from(micBtn.querySelectorAll(".meter-right i"));
  barsL = Array.from(micBtn.querySelectorAll(".meter-left i")).reverse();
  if (reduceMotion) {
    const stat = [0.45, 0.7, 1, 0.7, 0.45]; // static EQ glyph, no motion
    for (let b = 0; b < N_BARS; b++) {
      const sc = "scaleY(" + stat[b] + ")";
      if (barsR[b]) barsR[b].style.transform = sc;
      if (barsL[b]) barsL[b].style.transform = sc;
    }
  }

  // Single tap toggles listening on/off — hands stay free for the guitar.
  // A native <button> also fires "click" on Enter/Space, so this covers keyboard too.
  micBtn.addEventListener("click", () => {
    if (listening) stopListening(); else startListening();
  });

  // Debug overlay: ?debug in the URL, or a triple-tap on the title.
  try { if (new URLSearchParams(location.search).has("debug")) toggleDebug(); } catch (e) {}
  const title = document.querySelector(".head h1");
  if (title) {
    let taps = 0, last = 0;
    title.addEventListener("click", () => {
      const t = performance.now();
      taps = (t - last < 600) ? taps + 1 : 1;
      last = t;
      if (taps >= 3) { taps = 0; toggleDebug(); }
    });
  }
}

buildWheel();
buildFretStatic();
update();
initMic();
