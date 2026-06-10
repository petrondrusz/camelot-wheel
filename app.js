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
  B:   { fill: "rgba(10,228,72,0.10)", stroke: "rgba(10,228,72,0.45)", t1: "#8DF5AE", t2: "#4FB872" },
  A:   { fill: "rgba(157,149,255,0.10)", stroke: "rgba(157,149,255,0.45)", t1: "#C9C4FF", t2: "#8C85DE" },
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
  const defs = el("defs", {});
  const lg = el("linearGradient", { id: id, x1: "0", y1: "0", x2: "1", y2: "1" });
  const s1 = el("stop", { offset: "0%", "stop-color": "#FF8709" });
  const s2 = el("stop", { offset: "100%", "stop-color": "#FB64B6" });
  lg.append(s1, s2);
  defs.appendChild(lg);
  svg.appendChild(defs);
}

function buildWheel() {
  const wheel = document.getElementById("wheel");
  addDefs(wheel, "selGrad");
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
      const t1 = el("text", {
        x: tx, y: ty, "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": "17", "font-weight": "600"
      });
      t1.textContent = k + ring;
      const t2 = el("text", {
        x: nx, y: ny, "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": "13"
      });
      t2.textContent = DATA[k][ring][0];
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
    s.p.setAttribute("fill", isSel ? c.fill : (isComp ? c.fill.replace("0.10", "0.28") : c.fill));
    s.p.setAttribute("stroke", c.stroke);
    s.t1.setAttribute("fill", c.t1);
    s.t2.setAttribute("fill", c.t2);
    s.g.classList.toggle("sel", isSel);
    s.g.classList.remove("detected");
    s.g.style.opacity = (isSel || isComp) ? "1" : "0.32";
    s.g.setAttribute("aria-pressed", isSel ? "true" : "false");
  }

  if (hubMic) showHubMic(false);
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

// RGB základních barev prstenců (pro živou heatmapu)
const RING_RGB = { B: "10,228,72", A: "157,149,255" };

const CONF = 0.5;          // práh jistoty (Pearsonova korelace)
const ANALYZE_MS = 66;     // ~15 analýz/s
const EMA_TAU = 3;         // časová konstanta vyhlazování [s]

let audioCtx = null;
let analyser = null;
let micStream = null;
let micSrc = null;
let freqBuf = null;
let timeBuf = null;
let rafId = null;
let listening = false;
let emaChroma = null;
let lastAnalyzeT = 0;
let lastFav = null;
let lastResult = null;       // { fav, corr }
let hubCode = null, hubName = null, hubMic = null;
let micBtn = null, micStatusEl = null, appEl = null;

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
  return { norm, fav, corr: cam[fav], minor: camMinor[fav] };
}

function rgba(ring, alpha) { return "rgba(" + RING_RGB[ring] + "," + alpha.toFixed(3) + ")"; }

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
    s.p.setAttribute("fill", rgba(s.ring, 0.08 + 0.5 * sc));
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

// Show the animated mic icon in the hub instead of the code/name texts.
// Used only for true silence / before the first reading.
function showHubMic(on) {
  if (!hubMic) return;
  hubMic.style.display = on ? "" : "none";
  hubMic.classList.toggle("active", on);
  hubCode.style.display = on ? "none" : "";
  hubName.style.display = on ? "none" : "";
  if (on) lastFav = null;
  else { hubCode.style.opacity = "1"; hubName.style.opacity = "1"; }
}

// Live favorite — always shown while there's sound. Confidence (>= CONF)
// only controls the visual certainty (dim = still settling) and the
// release-lock; it must NOT gate the live display, or the key never shows.
function setHub(fav, corr) {
  showHubMic(false);
  const tentative = corr < CONF;
  if (fav !== lastFav) { lastFav = fav; if (!tentative) popHub(); }
  hubCode.textContent = String(fav);
  hubName.textContent = DATA[fav].A[0] + " / " + DATA[fav].B[0];
  hubCode.style.opacity = tentative ? "0.4" : "1";
  hubName.style.opacity = tentative ? "0.4" : "1";
}

function analyzeChroma(dt) {
  analyser.getFloatFrequencyData(freqBuf);
  const sr = audioCtx.sampleRate;
  const n = analyser.frequencyBinCount;
  const binHz = sr / analyser.fftSize;
  const chroma = new Float64Array(12);
  for (let i = 1; i < n; i++) {
    const f = i * binHz;
    if (f < 100) continue;
    if (f > 5000) break;
    const db = freqBuf[i];
    if (!isFinite(db)) continue;
    const mag = Math.pow(10, db / 20);
    const pc = ((Math.round(12 * Math.log2(f / 440) + 69) % 12) + 12) % 12;
    chroma[pc] += Math.sqrt(mag);
  }
  // normalizace (max = 1); při tichu nic nepočítáme
  let mx = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > mx) mx = chroma[i];
  if (mx <= 0) { lastResult = null; showHubMic(true); return; }
  for (let i = 0; i < 12; i++) chroma[i] /= mx;

  const a = Math.exp(-dt / EMA_TAU);
  if (!emaChroma) emaChroma = Array.from(chroma);
  else for (let i = 0; i < 12; i++) emaChroma[i] = emaChroma[i] * a + chroma[i] * (1 - a);

  const { norm, fav, corr, minor } = scoreKeys(emaChroma);
  lastResult = { fav, corr };
  applyHeatmap(norm, fav);
  setHub(fav, corr);
  // Live fretboard — root of the more probable mode of the pair (minor vs major).
  const [rNote, rSemi] = DATA[fav][minor ? "A" : "B"];
  updateFret(fretE(rSemi), fretA(rSemi), rNote.replace("m", ""));
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

function startListening() {
  if (listening) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    micStatus("Microphone unavailable");
    return;
  }
  listening = true;
  lockedNum = null;
  emaChroma = null;
  lastFav = null;
  lastResult = null;
  lastAnalyzeT = 0;
  micStatus("");
  micBtn.classList.add("listening");
  micBtn.setAttribute("aria-pressed", "true");
  if (appEl) appEl.classList.add("listening"); // dim chips, light up fretboard
  showHubMic(true); // mic icon until the first reading arrives

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
    s.p.setAttribute("stroke", c.stroke);
    s.t1.setAttribute("fill", c.t1);
    s.t2.setAttribute("fill", c.t2);
    s.g.style.opacity = isLock ? "1" : "0.28";
    s.g.setAttribute("aria-pressed", isLock ? "true" : "false");
  }
  lastFav = null;
  showHubMic(false);
  hubCode.textContent = String(lockedNum);
  hubName.textContent = DATA[lockedNum].A[0] + " / " + DATA[lockedNum].B[0];
  popHub();
}

function initMic() {
  micBtn = document.getElementById("mic");
  micStatusEl = document.getElementById("mic-status");
  hubCode = document.getElementById("hub-code");
  hubName = document.getElementById("hub-name");
  hubMic = document.getElementById("hub-mic");
  appEl = document.querySelector(".app");

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
}

buildWheel();
buildFretStatic();
update();
initMic();
