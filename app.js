"use strict";

const DATA = {
  1:  { B: ["H", 11],  A: ["G\u266Fm", 8]  },
  2:  { B: ["F\u266F", 6], A: ["D\u266Fm", 3]  },
  3:  { B: ["D\u266D", 1], A: ["B\u266Dm", 10] },
  4:  { B: ["A\u266D", 8], A: ["Fm", 5]   },
  5:  { B: ["E\u266D", 3], A: ["Cm", 0]   },
  6:  { B: ["B\u266D", 10], A: ["Gm", 7]  },
  7:  { B: ["F", 5],   A: ["Dm", 2]   },
  8:  { B: ["C", 0],   A: ["Am", 9]   },
  9:  { B: ["G", 7],   A: ["Em", 4]   },
  10: { B: ["D", 2],   A: ["Hm", 11]  },
  11: { B: ["A", 9],   A: ["F\u266Fm", 6]  },
  12: { B: ["E", 4],   A: ["C\u266Fm", 1]  }
};

const NS = "http://www.w3.org/2000/svg";
const CX = 200, CY = 200;
const RINGS = { B: [122, 172, 154, 134], A: [72, 122, 106, 87] };

const COLORS = {
  B:   { fill: "rgba(78,216,178,0.12)", stroke: "rgba(78,216,178,0.5)", t1: "#8CE8CC", t2: "#52B295" },
  A:   { fill: "rgba(163,155,255,0.12)", stroke: "rgba(163,155,255,0.5)", t1: "#C2BCFF", t2: "#8983D6" },
  sel: { fill: "#FF7A1A", stroke: "#FF7A1A", t1: "#2B1200", t2: "#5E2B00" }
};

let sel = loadSel() || { num: 8, ring: "A" };
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
  return ring === "B" ? n + " dur" : n.slice(0, -1) + " moll";
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

function buildWheel() {
  const wheel = document.getElementById("wheel");
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
        "font-size": "15", "font-weight": "600"
      });
      t1.textContent = k + ring;
      const t2 = el("text", {
        x: nx, y: ny, "text-anchor": "middle", "dominant-baseline": "central",
        "font-size": "12"
      });
      t2.textContent = DATA[k][ring][0];
      g.append(p, t1, t2);
      const pick = () => { sel = { num: k, ring }; saveSel(); update(); };
      g.addEventListener("click", pick);
      g.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
      });
      wheel.appendChild(g);
      segs[k + ring] = { g, p, t1, t2, ring };
    }
  }

  const hub = el("circle", {
    cx: CX, cy: CY, r: 64,
    fill: "#141414", stroke: "#2C2C2E", "stroke-width": "1"
  });
  wheel.appendChild(hub);

  const hCode = el("text", {
    id: "hub-code", "class": "hub-text", x: CX, y: CY - 12, "text-anchor": "middle",
    "dominant-baseline": "central", "font-size": "30", "font-weight": "600", fill: "#FFFFFF"
  });
  const hName = el("text", {
    id: "hub-name", "class": "hub-text", x: CX, y: CY + 16, "text-anchor": "middle",
    "dominant-baseline": "central", "font-size": "14", fill: "#A1A1A6"
  });
  wheel.append(hCode, hName);
}

function update() {
  const compKeys = compat(sel.num, sel.ring).map(c => c[0] + c[1]);
  for (const key in segs) {
    const s = segs[key];
    const isSel = key === sel.num + sel.ring;
    const isComp = compKeys.includes(key);
    const c = isSel ? COLORS.sel : COLORS[s.ring];
    s.p.setAttribute("fill", isSel ? c.fill : (isComp ? c.fill.replace("0.12", "0.3") : c.fill));
    s.p.setAttribute("stroke", c.stroke);
    s.t1.setAttribute("fill", c.t1);
    s.t2.setAttribute("fill", c.t2);
    s.g.classList.toggle("sel", isSel);
    s.g.style.opacity = (isSel || isComp) ? "1" : "0.32";
    s.g.setAttribute("aria-pressed", isSel ? "true" : "false");
  }

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
  s += `<text x="14" y="${FYA}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#A1A1A6">A</text>`;
  s += `<text x="14" y="${FYE}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#A1A1A6">E</text>`;
  s += `<line x1="${FX(0) - 12}" y1="${FYA}" x2="${FX(12)}" y2="${FYA}" stroke="#3A3A3C" stroke-width="1.5"/>`;
  s += `<line x1="${FX(0) - 12}" y1="${FYE}" x2="${FX(12)}" y2="${FYE}" stroke="#3A3A3C" stroke-width="2"/>`;
  for (let i = 0; i <= 12; i++) {
    s += `<line x1="${FX(i)}" y1="${FYA - 18}" x2="${FX(i)}" y2="${FYE + 18}" stroke="#2C2C2E" stroke-width="${i === 0 ? 3 : 1}"/>`;
  }
  for (const i of [3, 5, 7, 9]) {
    s += `<circle cx="${FX(i) - 12.5}" cy="${(FYA + FYE) / 2}" r="2.5" fill="#3A3A3C"/>`;
  }
  s += `<circle cx="${FX(12) - 12.5}" cy="${FYA - 6}" r="2.5" fill="#3A3A3C"/>`;
  s += `<circle cx="${FX(12) - 12.5}" cy="${FYE + 6}" r="2.5" fill="#3A3A3C"/>`;
  for (const i of [0, 3, 5, 7, 9, 12]) {
    s += `<text x="${dotX(i)}" y="${FYE + 40}" text-anchor="middle" font-size="12" fill="#6E6E73">${i}</text>`;
  }
  svg.innerHTML = s;

  const mk = () => {
    const g = el("g", { "class": "dot" });
    const c = el("circle", { cx: 0, cy: 0, r: 12, fill: "#FF7A1A" });
    const t = el("text", {
      x: 0, y: 0, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": "11", "font-weight": "600", fill: "#2B1200"
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

buildWheel();
buildFretStatic();
update();
