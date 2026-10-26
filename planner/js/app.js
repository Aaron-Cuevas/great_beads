(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, txt) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  };
  const css = (n) =>
    getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const IPM = 25.4 / 60,
    FPS = 24,
    MINUS = "−";
  const f = (v, d) => {
    if (!isFinite(v)) return "—";
    let t = Number(v).toFixed(d);
    if (+t === 0) t = t.replace("-", "");
    return t.replace("-", MINUS);
  };
  const ICON = {
    chev: '<svg class="ic" viewBox="0 0 12 12"><path d="M2.5 4.5 6 8l3.5-3.5"/></svg>',
    lock: '<svg class="ic" viewBox="0 0 12 12"><rect x="2.5" y="5.5" width="7" height="5" rx="1"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5"/></svg>',
    open: '<svg class="ic" viewBox="0 0 12 12"><rect x="2.5" y="6" width="7" height="4.5" rx="1"/><path d="M4 6V3a2 2 0 0 1 4 0v.6"/></svg>',
  };

  /* ================= model ================= */
  const BEADS = [
    ["1", 325, 25, 16, 8.19, 2.23],
    ["2", 325, 20, 18, 11.36, 2.36],
    ["3", 300, 25, 18, 8.33, 1.88],
    ["4", 300, 20, 16, 10.36, 2.31],
    ["5", 325, 30, 18, 7.78, 1.88],
    ["A1", 276, 23, 16, 7.04, 2.19],
    ["A2", 276, 23, 17, 7.11, 1.87],
    ["6", 300, 20, 20, 8.1, 2.14],
    ["7", 300, 25, 16, 8.46, 2.43],
    ["8", 300, 25, 18, 8.19, 2.06],
    ["9", 300, 25, 20, 8.13, 1.95],
    ["10", 225, 25, 16, 6.26, 1.93],
    ["11", 225, 25, 18, 6.43, 1.66],
    ["D1", 300, 25, 18, 7.94, 1.94],
    ["D2", 250, 25, 18, 6.85, 1.83],
    ["D3", 200, 25, 18, 5.34, 1.62],
    ["D4", 150, 25, 18, 3.88, 1.33],
    ["D5", 150, 25, 18, 3.81, 1.26],
  ];
  const MODEL = (function () {
    let sxy = 0,
      sxx = 0;
    BEADS.forEach((b) => {
      const l = b[1] / b[2];
      sxy += l * b[4];
      sxx += l * l;
    });
    const m = sxy / sxx;
    let ss = 0;
    BEADS.forEach((b) => {
      ss += Math.pow(b[4] - (m * b[1]) / b[2], 2);
    });
    return {
      m: m,
      rmse: Math.sqrt(ss / BEADS.length),
      lnH0: -0.4843,
      hB: 0.5677,
      hV: -0.0338,
      surplus: 37.15,
      humpSd: 2.99,
      endSd: 2.49,
      wire: Math.PI / 4,
      wfsStable: [150, 250],
      wfsTested: [150, 325],
      tsTested: [20, 30],
      vTested: [16, 20],
    };
  })();
  $("mTxt").textContent =
    "A = m · WFS / TS,  m = " +
    MODEL.m.toFixed(3) +
    " mm²,  RMSE " +
    MODEL.rmse.toFixed(2) +
    " mm²,  18 beads  |  GMAW, 1.0 mm wire, 0.3 in stick-out, 0.035 in gap";
  function erf(x) {
    const s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    return (
      s *
      (1 -
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
          0.284496736) *
          t +
          0.254829592) *
          t *
          Math.exp(-x * x))
    );
  }
  const heightOf = (A, V) =>
    Math.exp(
      MODEL.lnH0 + MODEL.hB * Math.log(Math.max(A, 1e-9)) + MODEL.hV * (V - 18),
    );
  function areaAt(s, p) {
    const k = Math.SQRT2 * MODEL.endSd,
      upto = p.upto == null ? p.len : p.upto;
    const hf =
      p.upto == null
        ? 1
        : Math.min(1, Math.max(0, upto / (1.5 * MODEL.humpSd)));
    return (
      (p.area / 2) * (erf(s / k) - erf((s - upto) / k)) +
      ((hf * MODEL.surplus) / (Math.sqrt(2 * Math.PI) * MODEL.humpSd)) *
        Math.exp((-s * s) / (2 * MODEL.humpSd * MODEL.humpSd))
    );
  }

  /* ================= state ================= */
  const S = {
    mode: "area",
    area: 6,
    wfs: 225,
    ts: 25,
    solve: "wfs",
    volt: 18,
    len: 20,
    width: 7,
    height: 1.7,
    ang: 90,
    sx: 0,
    sy: 0,
    reg: "base",
    frame: 1,
    start: 1,
    end: 1,
    show: { poly: false, grid: true, plate: true, torch: true, touch: false },
    plates: [],
    plateId: "",
    plate: null,
    dirty: false,
    touchLock: true,
  };
  const PV = { auto: "plate", cx: 0, cy: 0, k: 1 },
    PB = { l: 46, r: 428, t: 16, b: 340 };
  let P = null; /* computed process */
  const SEED = {
    id: "plate-bead-a",
    name: "Previous plate (bead A)",
    t: [
      705.969, -239.969, -21.078, 546.801, -446.334, -21.038, 666.578, -320.798,
      -21.014, 588.778, -507.552, -21.066, 474.258, -286.231, -21.022,
    ],
    origin: 4,
    xto: 5,
    gapIn: 0.035,
    axis: "robot",
  };
  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k));
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {
      return null;
    }
  }
  (function () {
    const saved = store("waam.plates");
    S.plates =
      Array.isArray(saved) && saved.length
        ? saved
        : [JSON.parse(JSON.stringify(SEED))];
    if (store("waam.reg") === "frame") S.reg = "frame";
    const bd = store("waam.bead");
    if (bd && [bd.ang, bd.sx, bd.sy].every(isFinite)) {
      S.ang = +bd.ang;
      S.sx = +bd.sx;
      S.sy = +bd.sy;
    }
    const sel = store("waam.sel");
    S.plateId = S.plates.some((p) => p.id === sel) ? sel : S.plates[0].id;
    loadPlate(S.plateId);
  })();
  function loadPlate(id) {
    const p = S.plates.find((q) => q.id === id);
    S.plateId = p ? id : "";
    S.plate = p
      ? JSON.parse(JSON.stringify(p))
      : {
          id: "",
          name: "New plate",
          t: new Array(15).fill(0),
          origin: 4,
          xto: 5,
          gapIn: 0.035,
          axis: "robot",
        };
    if (S.plate.axis !== "touch") S.plate.axis = "robot";
    S.dirty = false;
    S.touchLock = !!p;
    PV.auto = "plate";
    store("waam.sel", S.plateId);
  }
  function saveBead() {
    store("waam.bead", { ang: S.ang, sx: S.sx, sy: S.sy });
  }

  /* ---------- plate frame ---------- */
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  function eig3(a) {
    const v = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    a = a.map((r) => r.slice());
    for (let it = 0; it < 60; it++) {
      let p = 0,
        q = 1,
        big = 0;
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++)
          if (Math.abs(a[i][j]) > big) {
            big = Math.abs(a[i][j]);
            p = i;
            q = j;
          }
      if (big < 1e-14) break;
      const th = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]),
        c = Math.cos(th),
        s = Math.sin(th);
      for (let k = 0; k < 3; k++) {
        const x = a[k][p],
          y = a[k][q];
        a[k][p] = c * x - s * y;
        a[k][q] = s * x + c * y;
      }
      for (let k = 0; k < 3; k++) {
        const x = a[p][k],
          y = a[q][k];
        a[p][k] = c * x - s * y;
        a[q][k] = s * x + c * y;
      }
      for (let k = 0; k < 3; k++) {
        const x = v[k][p],
          y = v[k][q];
        v[k][p] = c * x - s * y;
        v[k][q] = s * x + c * y;
      }
    }
    let lo = 0;
    for (let i = 1; i < 3; i++) if (a[i][i] < a[lo][lo]) lo = i;
    return [v[0][lo], v[1][lo], v[2][lo]];
  }
  function plateFrame(pl) {
    if (!pl) return null;
    const T = [];
    for (let i = 0; i < 5; i++)
      T.push([pl.t[3 * i], pl.t[3 * i + 1], pl.t[3 * i + 2]]);
    const byTouch = pl.axis === "touch";
    if (byTouch && pl.origin === pl.xto) return null;
    const c = [0, 1, 2].map((k) => T.reduce((s, p) => s + p[k], 0) / 5);
    const C = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    T.forEach((p) => {
      const d = sub(p, c);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j];
    });
    if (C[0][0] + C[1][1] + C[2][2] < 1) return null;
    let z = eig3(C);
    if (z[2] < 0) z = z.map((v) => -v);
    const off = T.map((p) => dot(sub(p, c), z));
    let x = byTouch ? sub(T[pl.xto - 1], T[pl.origin - 1]) : [1, 0, 0];
    const al = dot(x, z);
    x = x.map((v, k) => v - al * z[k]);
    const len = Math.hypot(x[0], x[1], x[2]);
    if (!(len > (byTouch ? 1 : 1e-6))) return null;
    x = x.map((v) => v / len);
    const span = byTouch ? len : NaN;
    const y = cross(z, x),
      g = (pl.gapIn || 0) * 25.4,
      o = T[pl.origin - 1].map((v, k) => v - g * z[k]),
      D = 180 / Math.PI;
    return {
      x: x,
      y: y,
      z: z,
      o: o,
      T: T,
      off: off,
      span: span,
      rms: Math.sqrt(off.reduce((s, e) => s + e * e, 0) / 5),
      max: Math.max.apply(null, off.map(Math.abs)),
      wpr: [
        Math.atan2(y[2], z[2]) * D,
        Math.asin(-x[2]) * D,
        Math.atan2(x[1], x[0]) * D,
      ],
    };
  }
  const snap0 = (v) => (Math.abs(v) < 5e-7 ? 0 : v);
  function offset() {
    const fr = plateFrame(S.plate);
    if (!fr || !P) return null;
    const r = (S.ang * Math.PI) / 180,
      g = (S.plate.gapIn || 0) * 25.4,
      a = snap0(P.len * Math.cos(r)),
      b = snap0(P.len * Math.sin(r)),
      fm = S.reg === "frame";
    const w = [0, 1, 2].map((k) => snap0(a * fr.x[k] + b * fr.y[k])),
      t = fr.T[S.plate.origin - 1],
      sw = [0, 1, 2].map((k) => t[k] + S.sx * fr.x[k] + S.sy * fr.y[k]),
      ew = sw.map((v, k) => v + w[k]);
    return {
      fr: fr,
      a: a,
      b: b,
      w: w,
      sw: sw,
      ew: ew,
      o: fm ? [a, b, 0] : w,
      s: fm ? [S.sx, S.sy, g] : sw,
      e: fm ? [S.sx + a, S.sy + b, g] : ew,
    };
  }

  /* ---------- process ---------- */
  function compute() {
    const p = { notes: [] };
    p.len = Math.min(Math.max(S.len, 5), 300);
    S.len = p.len;
    if (S.mode === "shape") {
      if (S.solve === "area") S.solve = "wfs";
      S.area = (S.height * S.width) / 2;
      const need =
        18 +
        (Math.log(S.height) - MODEL.lnH0 - MODEL.hB * Math.log(S.area)) /
          MODEL.hV;
      p.vNeed = need;
      S.volt = Math.min(Math.max(need, MODEL.vTested[0]), MODEL.vTested[1]);
    }
    if (S.solve === "wfs") S.wfs = (S.area * S.ts) / MODEL.m;
    else if (S.solve === "ts") S.ts = (MODEL.m * S.wfs) / S.area;
    else S.area = (MODEL.m * S.wfs) / S.ts;
    p.area = S.area;
    p.wfs = S.wfs;
    p.ts = S.ts;
    p.volt = S.volt;
    p.h = heightOf(p.area, p.volt);
    p.w = (2 * p.area) / p.h;
    if (S.mode === "area") {
      S.height = p.h;
      S.width = p.w;
    }
    let pk = 0,
      pkS = 0;
    for (let s = -6; s <= p.len; s += 0.1) {
      const a = areaAt(s, p);
      if (a > pk) {
        pk = a;
        pkS = s;
      }
    }
    p.peak = pk;
    p.peakS = pkS;
    p.peakH = heightOf(pk, p.volt);
    p.peakW = (2 * pk) / p.peakH;
    p.metal = p.area * p.len + MODEL.surplus;
    p.time = p.len / (p.ts * IPM);
    p.frames = Math.max(2, Math.round(p.time * FPS) + 1);
    const wasEnd = !P || S.frame >= S.end;
    P = p;
    S.start = 1;
    S.end = p.frames;
    if (wasEnd || S.frame > S.end) S.frame = S.end;
    refresh();
  }
  const sOfFrame = (fr) =>
    P.len * Math.min(Math.max((fr - 1) / (P.frames - 1), 0), 1);

  /* ================= UI building blocks ================= */
  const FLD = [];
  function field(def) {
    const d = h("div", "fld"),
      ax = h("span", "ax", def.ax || ""),
      inp = h("input"),
      lk = h("button", "lk");
    inp.type = "text";
    inp.inputMode = "decimal";
    inp.spellcheck = false;
    inp.autocomplete = "off";
    inp.id = "f_" + def.k;
    inp.setAttribute("aria-label", def.label || def.k);
    lk.type = "button";
    d.appendChild(ax);
    d.appendChild(inp);
    d.appendChild(lk);
    const o = { d: d, inp: inp, lk: lk, def: def, cancel: false };
    FLD.push(o);
    inp.addEventListener("focus", () => {
      if (inp.readOnly) return;
      inp.value = String(+Number(def.get()).toFixed(def.dec + 2));
      inp.select();
      setStatus("field");
    });
    inp.addEventListener("blur", () => {
      if (!inp.readOnly && !o.cancel) {
        const v = parseFloat(inp.value.replace(",", ".").replace(MINUS, "-"));
        if (
          isFinite(v) &&
          (def.min == null || v >= def.min) &&
          (def.max == null || v <= def.max) &&
          Math.abs(v - def.get()) > 1e-9
        ) {
          def.set(v);
        }
      }
      o.cancel = false;
      refresh();
      setStatus(curCtxStatus());
    });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        inp.blur();
      } else if (e.key === "Escape") {
        o.cancel = true;
        inp.blur();
      } else if (
        (e.key === "ArrowUp" || e.key === "ArrowDown") &&
        !inp.readOnly
      ) {
        e.preventDefault();
        const st =
          (def.step || 1) *
          (e.shiftKey ? 10 : 1) *
          (e.key === "ArrowUp" ? 1 : -1);
        const v = parseFloat(inp.value) || 0;
        inp.value = String(+(v + st).toFixed(def.dec + 2));
      }
      e.stopPropagation();
    });
    lk.addEventListener("click", () => {
      if (def.onLock) {
        def.onLock();
        refresh();
      }
    });
    return d;
  }
  function refreshFields() {
    FLD.forEach((o) => {
      const def = o.def,
        ed = def.editable ? def.editable() : true,
        st = def.lock ? def.lock() : null;
      if (document.activeElement !== o.inp) {
        const v = def.get();
        o.inp.value = isFinite(v)
          ? f(v, def.dec) + (def.unit ? " " + def.unit : "")
          : "—";
      }
      o.inp.readOnly = !ed;
      o.d.classList.toggle("ro", !ed);
      if (st) {
        o.lk.innerHTML = st.open ? ICON.open : ICON.lock;
        o.lk.classList.toggle("op", !!st.open);
        o.lk.title = st.title;
        o.lk.setAttribute("aria-label", st.title);
        o.lk.disabled = !def.onLock;
        o.lk.style.visibility = "visible";
      } else {
        o.lk.style.visibility = "hidden";
        o.lk.disabled = true;
      }
    });
  }
  function vec(defs) {
    const v = h("div", "vec");
    defs.forEach((d) => v.appendChild(field(d)));
    return v;
  }
  function prop(label, control) {
    const r = h("div", "prop");
    r.appendChild(h("span", "l", label));
    r.appendChild(control);
    return r;
  }
  function acc(parent, title, open) {
    const a = h("div", "acc"),
      b = h("button"),
      body = h("div");
    b.type = "button";
    b.innerHTML = ICON.chev;
    b.appendChild(h("span", null, title));
    b.appendChild(h("span", "grip"));
    a.dataset.key = title;
    b.title = "Click to open or close. Drag to reorder.";
    b.setAttribute("aria-expanded", open !== false);
    body.hidden = open === false;
    let drag = null,
      skip = false;
    b.addEventListener("click", () => {
      if (skip) {
        skip = false;
        return;
      }
      const o = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", o);
      body.hidden = !o;
    });
    const move = (e) => {
      if (!drag) return;
      if (!drag.on && Math.abs(e.clientY - drag.y) > 5) {
        drag.on = true;
        a.classList.add("drag");
      }
      if (!drag.on) return;
      e.preventDefault();
      let before = null;
      for (const x of a.parentNode.children) {
        if (x === a) continue;
        const r = x.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          before = x;
          break;
        }
      }
      if (before !== a.nextSibling) a.parentNode.insertBefore(a, before);
    };
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      if (!drag) return;
      const was = drag.on;
      drag = null;
      a.classList.remove("drag");
      if (was) {
        skip = true;
        setTimeout(() => {
          skip = false;
        }, 0);
        saveOrder();
      }
    };
    b.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = { y: e.clientY, on: false };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", end);
      document.addEventListener("pointercancel", end);
    });
    b.addEventListener("keydown", (e) => {
      if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
      e.preventDefault();
      e.stopPropagation();
      const p = a.parentNode;
      if (e.key === "ArrowUp" && a.previousSibling)
        p.insertBefore(a, a.previousSibling);
      else if (e.key === "ArrowDown" && a.nextSibling)
        p.insertBefore(a.nextSibling, a);
      b.focus();
      saveOrder();
    });
    a.appendChild(b);
    a.appendChild(body);
    parent.appendChild(a);
    return body;
  }
  function saveOrder() {
    const o = {};
    for (const k in TAB)
      o[k] = Array.from(TAB[k].children).map((x) => x.dataset.key);
    store("waam.order2", o);
  }
  function applyOrder() {
    const o = store("waam.order2");
    if (!o) return;
    for (const k in TAB)
      (o[k] || []).forEach((key) => {
        const x = Array.from(TAB[k].children).find(
          (c) => c.dataset.key === key,
        );
        if (x) TAB[k].appendChild(x);
      });
  }
  function select(id, opts, get, set) {
    const s = h("select");
    s.id = id;
    opts.forEach((o) => {
      const e = h("option", null, o[1]);
      e.value = o[0];
      s.appendChild(e);
    });
    s.addEventListener("change", () => {
      set(s.value);
      refresh();
    });
    s._get = get;
    SEL.push(s);
    return s;
  }
  const SEL = [];
  function check(label, get, set) {
    const l = h("label", "chk"),
      c = h("input");
    c.type = "checkbox";
    l.appendChild(c);
    l.appendChild(h("span", null, label));
    c.addEventListener("change", () => {
      set(c.checked);
      refresh();
    });
    c._get = get;
    CHK.push(c);
    return l;
  }
  const CHK = [];
  function button(label, fn) {
    const b = h("button", "btn", label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }

  /* ================= side panels ================= */
  const TAB = {};
  ["Process", "Bead", "Robot", "View"].forEach((n) => {
    const d = h("div");
    d.style.display = "contents";
    d.hidden = n !== "Process";
    TAB[n] = d;
    $("props").appendChild(d);
    $("tab" + n).addEventListener("click", () => {
      for (const k in TAB) {
        TAB[k].hidden = k !== n;
        $("tab" + k).setAttribute("aria-selected", k === n);
      }
    });
  });
  const HELD = {
      open: false,
      title: "Held at this value. Click to let the model solve it.",
    },
    SOLVED = { open: true, title: "Solved by the model." },
    FIXED = { open: false, title: "Computed. Read only." };
  function mbLock(k) {
    return () =>
      S.solve === k
        ? SOLVED
        : S.mode === "shape" && k === "area"
          ? { open: false, title: "Set by height and width." }
          : HELD;
  }
  function mbOnLock(k) {
    return () => {
      if (S.mode === "shape" && k === "area") return;
      if (S.solve !== k) {
        S.solve = k;
        compute();
      }
    };
  }
  (function buildProcess() {
    const t = TAB.Process;
    let b = acc(t, "Target");
    b.appendChild(
      prop(
        "Ask for",
        select(
          "selMode",
          [
            ["area", "Cross-section area"],
            ["shape", "Height and width"],
          ],
          () => S.mode,
          (v) => {
            S.mode = v;
            compute();
          },
        ),
      ),
    );
    b.appendChild(
      h(
        "p",
        "note",
        "Two of the three values below are held and the model solves the third.",
      ),
    );
    b = acc(t, "Mass balance");
    b.appendChild(
      prop(
        "Balance",
        vec([
          {
            k: "area",
            ax: "A",
            label: "Cross-section area",
            unit: "mm²",
            dec: 2,
            min: 0.3,
            step: 0.1,
            get: () => S.area,
            set: (v) => {
              S.area = v;
              compute();
            },
            editable: () => S.mode === "area" && S.solve !== "area",
            lock: mbLock("area"),
            onLock: mbOnLock("area"),
          },
          {
            k: "wfs",
            ax: "W",
            label: "Wire feed speed",
            unit: "in/min",
            dec: 1,
            min: 1,
            step: 5,
            get: () => S.wfs,
            set: (v) => {
              S.wfs = v;
              compute();
            },
            editable: () => S.solve !== "wfs",
            lock: mbLock("wfs"),
            onLock: mbOnLock("wfs"),
          },
          {
            k: "ts",
            ax: "T",
            label: "Travel speed",
            unit: "in/min",
            dec: 1,
            min: 1,
            step: 1,
            get: () => S.ts,
            set: (v) => {
              S.ts = v;
              compute();
            },
            editable: () => S.solve !== "ts",
            lock: mbLock("ts"),
            onLock: mbOnLock("ts"),
          },
        ]),
      ),
    );
    b.appendChild(
      prop(
        "In mm/s",
        (function () {
          const s = h("span", "note");
          s.id = "mmps";
          return s;
        })(),
      ),
    );
    b = acc(t, "Arc");
    b.appendChild(
      prop(
        "Voltage",
        vec([
          {
            k: "volt",
            ax: "V",
            label: "Voltage",
            unit: "V",
            dec: 1,
            min: 10,
            max: 30,
            step: 0.5,
            get: () => S.volt,
            set: (v) => {
              S.volt = v;
              compute();
            },
            editable: () => S.mode === "area",
            lock: () => (S.mode === "shape" ? SOLVED : HELD),
            onLock: () => {
              S.mode = S.mode === "area" ? "shape" : "area";
              compute();
            },
          },
        ]),
      ),
    );
    b = acc(t, "Dimensions");
    b.appendChild(
      prop(
        "Size",
        vec([
          {
            k: "len",
            ax: "X",
            label: "Bead length",
            unit: "mm",
            dec: 1,
            min: 5,
            max: 300,
            step: 1,
            get: () => S.len,
            set: (v) => {
              S.len = v;
              compute();
            },
            lock: () => HELD,
          },
          {
            k: "width",
            ax: "Y",
            label: "Width, toe to toe",
            unit: "mm",
            dec: 2,
            min: 1,
            step: 0.1,
            get: () => (S.mode === "shape" ? S.width : P ? P.w : S.width),
            set: (v) => {
              S.width = v;
              compute();
            },
            editable: () => S.mode === "shape",
            lock: () => (S.mode === "shape" ? HELD : SOLVED),
            onLock: () => {
              S.mode = S.mode === "area" ? "shape" : "area";
              compute();
            },
          },
          {
            k: "height",
            ax: "Z",
            label: "Crest height",
            unit: "mm",
            dec: 2,
            min: 0.3,
            step: 0.05,
            get: () => (S.mode === "shape" ? S.height : P ? P.h : S.height),
            set: (v) => {
              S.height = v;
              compute();
            },
            editable: () => S.mode === "shape",
            lock: () => (S.mode === "shape" ? HELD : SOLVED),
            onLock: () => {
              S.mode = S.mode === "area" ? "shape" : "area";
              compute();
            },
          },
        ]),
      ),
    );
    b = acc(t, "Checks");
    const ul = h("ul", "checks");
    ul.id = "checks";
    b.appendChild(ul);
  })();
  (function buildBead() {
    const t = TAB.Bead;
    let b = acc(t, "Predicted bead");
    const kv = h("div", "kv");
    kv.id = "kvBead";
    b.appendChild(kv);
    b = acc(t, "Deposition");
    const k2 = h("div", "kv");
    k2.id = "kvDep";
    b.appendChild(k2);
    b = acc(t, "What the model is built on", false);
    [
      "Area comes from the mass balance fitted to 18 measured beads: 150 to 325 in/min wire feed, 20 to 30 in/min travel, 16 to 20 V. Twelve of them are at 25 in/min travel.",
      "Crest height comes from a fit to the same beads. It grows with area to the power 0.57 and falls 3.4% per volt. The voltage effect rests on few beads and is provisional.",
      "The cross-section is drawn as a cos² profile with the predicted area, so the toe-to-toe width follows from area and height.",
      "The start hump (37 mm³) and the rounded ends were measured on one bead at 225 in/min.",
    ].forEach((x) => b.appendChild(h("p", "note", x)));
  })();
  (function buildRobot() {
    const t = TAB.Robot;
    let b = acc(t, "Plate");
    const sel = h("select");
    sel.id = "selPlate";
    sel.addEventListener("change", () => {
      loadPlate(sel.value);
      refresh();
    });
    b.appendChild(prop("Saved plate", sel));
    const nm = h("input", "txt");
    nm.id = "plateName";
    nm.maxLength = 40;
    nm.addEventListener("input", () => {
      S.plate.name = nm.value;
      S.dirty = true;
    });
    nm.addEventListener("keydown", (e) => e.stopPropagation());
    b.appendChild(prop("Name", nm));
    const bt = h("div", "btns");
    bt.appendChild(
      button("New", () => {
        loadPlate("");
        refresh();
        $("plateName").focus();
      }),
    );
    bt.appendChild(button("Save", savePlate));
    const del = button("Delete", (e) => {
      const x = e.currentTarget;
      if (!S.plateId) return;
      if (!x.dataset.arm) {
        x.dataset.arm = "1";
        x.textContent = "Confirm delete";
        return;
      }
      S.plates = S.plates.filter((p) => p.id !== S.plateId);
      store("waam.plates", S.plates);
      loadPlate(S.plates[0] ? S.plates[0].id : "");
      refresh();
    });
    del.id = "plateDel";
    bt.appendChild(del);
    b.appendChild(prop("", bt));
    const io = h("div", "btns");
    io.appendChild(button("Export file", exportPlates));
    const imp = button("Import file", () => $("impFile").click());
    io.appendChild(imp);
    const fi = h("input");
    fi.type = "file";
    fi.accept = ".json,application/json";
    fi.id = "impFile";
    fi.hidden = true;
    fi.addEventListener("change", importPlates);
    io.appendChild(fi);
    b.appendChild(prop("Share", io));
    const msg = h("p", "note");
    msg.id = "plateMsg";
    b.appendChild(msg);

    b = acc(t, "Bead on the plate");
    b.appendChild(
      prop(
        "Length",
        vec([
          {
            k: "blen",
            ax: "L",
            label: "Bead length",
            unit: "mm",
            dec: 1,
            min: 5,
            max: 300,
            step: 1,
            get: () => S.len,
            set: (v) => {
              S.len = v;
              compute();
            },
          },
        ]),
      ),
    );
    b.appendChild(
      prop(
        "Rotation",
        vec([
          {
            k: "ang",
            ax: "R",
            label: "Rotation from the plate x axis",
            unit: "°",
            dec: 1,
            min: -360,
            max: 360,
            step: 5,
            get: () => S.ang,
            set: (v) => {
              S.ang = v;
              saveBead();
            },
          },
        ]),
      ),
    );
    b.appendChild(
      prop(
        "Start",
        vec([
          {
            k: "sx",
            ax: "X",
            label: "Start on the plate, x",
            unit: "mm",
            dec: 1,
            min: -2000,
            max: 2000,
            step: 1,
            get: () => S.sx,
            set: (v) => {
              S.sx = v;
              saveBead();
            },
          },
          {
            k: "sy",
            ax: "Y",
            label: "Start on the plate, y",
            unit: "mm",
            dec: 1,
            min: -2000,
            max: 2000,
            step: 1,
            get: () => S.sy,
            set: (v) => {
              S.sy = v;
              saveBead();
            },
          },
        ]),
      ),
    );
    b.appendChild(
      prop(
        "Register in",
        select(
          "selReg",
          [
            ["base", "Robot axes"],
            ["frame", "User frame of the plate"],
          ],
          () => S.reg,
          (v) => {
            S.reg = v;
            store("waam.reg", v);
          },
        ),
      ),
    );
    b.appendChild(
      h(
        "p",
        "note",
        "Rotation is measured from the x axis of the plate toward its y axis. Start is measured from the origin of the plate. In the Plate workspace, drag the white point to place the bead and the blue point to turn it.",
      ),
    );

    b = acc(t, "Coordinates");
    const ro = (lab, key, get) =>
      prop(
        lab,
        vec(
          ["X", "Y", "Z"].map((a, j) => ({
            k: key + j,
            ax: a,
            label: lab + " " + a,
            unit: "mm",
            dec: 3,
            get: () => {
              const q = offset();
              return q ? get(q)[j] : NaN;
            },
            editable: () => false,
            lock: () => FIXED,
          })),
        ),
      );
    b.appendChild(ro("Offset", "off", (q) => q.o));
    b.appendChild(ro("Start", "st", (q) => q.s));
    b.appendChild(ro("End", "en", (q) => q.e));
    const k3 = h("div", "kv");
    k3.id = "kvMove";
    b.appendChild(k3);
    b.appendChild(
      h(
        "p",
        "note",
        "Offset goes in the position register with W, P, R at zero. Start is where P[1] is taught. The controller reads all three in the active user frame.",
      ),
    );

    b = acc(t, "Advanced: plate frame", false);
    const one5 = [
      ["1", "P1"],
      ["2", "P2"],
      ["3", "P3"],
      ["4", "P4"],
      ["5", "P5"],
    ];
    b.appendChild(
      prop(
        "Origin",
        select(
          "selOrigin",
          one5,
          () => String(S.plate.origin),
          (v) => {
            S.plate.origin = +v;
            S.dirty = true;
          },
        ),
      ),
    );
    b.appendChild(
      prop(
        "X axis from",
        select(
          "selAxis",
          [
            ["robot", "Robot X, laid on the plate"],
            ["touch", "Two touches on one edge"],
          ],
          () => S.plate.axis,
          (v) => {
            S.plate.axis = v;
            S.dirty = true;
          },
        ),
      ),
    );
    b.appendChild(
      prop(
        "X axis to",
        select(
          "selXto",
          one5,
          () => String(S.plate.xto),
          (v) => {
            S.plate.xto = +v;
            S.dirty = true;
          },
        ),
      ),
    );
    const fr = () => plateFrame(S.plate);
    b.appendChild(
      prop(
        "Location",
        vec(
          ["X", "Y", "Z"].map((a, j) => ({
            k: "loc" + j,
            ax: a,
            label: "Frame location " + a,
            unit: "mm",
            dec: 3,
            get: () => {
              const q = fr();
              return q ? q.o[j] : NaN;
            },
            editable: () => false,
            lock: () => FIXED,
          })),
        ),
      ),
    );
    b.appendChild(
      prop(
        "Rotation",
        vec(
          ["W", "P", "R"].map((a, j) => ({
            k: "rot" + j,
            ax: a,
            label: "Frame rotation " + a,
            unit: "°",
            dec: 3,
            get: () => {
              const q = fr();
              return q ? q.wpr[j] : NaN;
            },
            editable: () => false,
            lock: () => FIXED,
          })),
        ),
      ),
    );
    const kv = h("div", "kv");
    kv.id = "kvFrame";
    b.appendChild(kv);
    b.appendChild(
      h(
        "p",
        "note",
        "With Robot X, the plate axes follow the robot axes and only the tilt comes from the touches. Use Two touches only when both lie on a line parallel to one edge.",
      ),
    );

    b = acc(t, "Advanced: five touches", false);
    const tl = () =>
      S.touchLock
        ? { open: false, title: "Locked. Click to edit the touches." }
        : { open: true, title: "Editable. Click to lock the touches." };
    for (let i = 0; i < 5; i++)
      b.appendChild(
        prop(
          "P" + (i + 1),
          vec(
            ["X", "Y", "Z"].map((a, j) => ({
              k: "t" + (i * 3 + j),
              ax: a,
              label: "Touch " + (i + 1) + " " + a,
              unit: "mm",
              dec: 3,
              step: 0.1,
              get: () => S.plate.t[i * 3 + j],
              set: (v) => {
                S.plate.t[i * 3 + j] = v;
                S.dirty = true;
              },
              editable: () => !S.touchLock,
              lock: tl,
              onLock: () => {
                S.touchLock = !S.touchLock;
              },
            })),
          ),
        ),
      );
    b.appendChild(
      prop(
        "Tip gap",
        vec([
          {
            k: "gap",
            ax: "",
            label: "Tip above the plate at the touches",
            unit: "in",
            dec: 3,
            min: 0,
            max: 2,
            step: 0.005,
            get: () => S.plate.gapIn,
            set: (v) => {
              S.plate.gapIn = v;
              S.dirty = true;
            },
            editable: () => !S.touchLock,
            lock: tl,
            onLock: () => {
              S.touchLock = !S.touchLock;
            },
          },
        ]),
      ),
    );
    b.appendChild(
      check(
        "Touch names in the plate view",
        () => S.show.touch,
        (v) => {
          S.show.touch = v;
        },
      ),
    );
    b.appendChild(
      h(
        "p",
        "note",
        "Read the positions in USER coordinates, with the user frame and tool frame of the weld program.",
      ),
    );
  })();
  (function buildView() {
    const t = TAB.View;
    let b = acc(t, "Display");
    b.appendChild(
      check(
        "Polygons",
        () => S.show.poly,
        (v) => {
          S.show.poly = v;
        },
      ),
    );
    b.appendChild(
      check(
        "Grid, 5 mm",
        () => S.show.grid,
        (v) => {
          S.show.grid = v;
        },
      ),
    );
    b.appendChild(
      check(
        "Plate",
        () => S.show.plate,
        (v) => {
          S.show.plate = v;
        },
      ),
    );
    b.appendChild(
      check(
        "Torch and wire",
        () => S.show.torch,
        (v) => {
          S.show.torch = v;
        },
      ),
    );
    b = acc(t, "Mesh");
    const kv = h("div", "kv");
    kv.id = "kvMesh";
    b.appendChild(kv);
    b = acc(t, "Timeline");
    b.appendChild(
      h(
        "p",
        "note",
        "One frame is 1/24 s of arc time. Frame 1 is the arc start and the last frame is the arc end.",
      ),
    );
    b = acc(t, "Panels");
    b.appendChild(
      h(
        "p",
        "note",
        "Drag a panel by its header to reorder it. The order is kept in this browser.",
      ),
    );
    b.appendChild(
      button("Reset panel order", () => {
        try {
          localStorage.removeItem("waam.order");
        } catch (e) {}
        location.reload();
      }),
    );
  })();
  applyOrder();
  function savePlate() {
    const fr = plateFrame(S.plate),
      msg = $("plateMsg");
    if (!S.plate.name.trim()) {
      msg.textContent = "Give the plate a name.";
      return;
    }
    if (!fr) {
      msg.textContent =
        "These touches do not define a plate. Check the five positions, the origin and the X touch.";
      return;
    }
    const c = JSON.parse(JSON.stringify(S.plate));
    if (!c.id) {
      c.id = "p" + Date.now();
      S.plates.push(c);
    } else {
      const i = S.plates.findIndex((p) => p.id === c.id);
      if (i < 0) S.plates.push(c);
      else S.plates[i] = c;
    }
    store("waam.plates", S.plates);
    loadPlate(c.id);
    refresh();
    $("plateMsg").textContent = "Saved in this browser.";
  }
  function exportPlates() {
    const blob = new Blob(
        [
          JSON.stringify(
            { app: "WAAM Bead Planner", plates: S.plates },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      a = h("a");
    a.href = URL.createObjectURL(blob);
    a.download = "waam_plates.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importPlates(e) {
    const file = e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      let n = 0;
      try {
        const j = JSON.parse(rd.result);
        (j.plates || []).forEach((p) => {
          if (
            p &&
            Array.isArray(p.t) &&
            p.t.length === 15 &&
            p.t.every((v) => typeof v === "number") &&
            typeof p.name === "string"
          ) {
            const c = {
              id: "p" + Date.now() + "_" + n,
              name: p.name.slice(0, 40),
              t: p.t.slice(),
              origin: +p.origin || 4,
              xto: +p.xto || 5,
              gapIn: +p.gapIn || 0,
              axis: p.axis === "touch" ? "touch" : "robot",
            };
            S.plates.push(c);
            n++;
          }
        });
      } catch (err) {
        n = -1;
      }
      if (n > 0) {
        store("waam.plates", S.plates);
        refresh();
      }
      $("plateMsg").textContent =
        n > 0
          ? n + " plate" + (n > 1 ? "s" : "") + " added from the file."
          : "That file holds no plates in the format this app exports.";
      e.target.value = "";
    };
    rd.readAsText(file);
  }

  /* ================= refresh ================= */
  function kvFill(id, rows) {
    const d = $(id);
    d.textContent = "";
    rows.forEach((r) => {
      d.appendChild(h("span", null, r[0]));
      const b = h("b");
      b.innerHTML = r[1];
      d.appendChild(b);
    });
  }
  function refresh() {
    if (!P) return;
    SEL.forEach((s) => {
      s.value = s._get();
    });
    CHK.forEach((c) => {
      c.checked = c._get();
    });
    const sp = $("selPlate");
    sp.textContent = "";
    S.plates.forEach((p) => {
      const o = h("option", null, p.name);
      o.value = p.id;
      sp.appendChild(o);
    });
    if (!S.plateId) {
      const o = h("option", null, "Unsaved plate");
      o.value = "";
      sp.appendChild(o);
    }
    sp.value = S.plateId;
    if (document.activeElement !== $("plateName"))
      $("plateName").value = S.plate.name;
    const del = $("plateDel");
    del.textContent = "Delete";
    delete del.dataset.arm;
    $("plateMsg").textContent = S.dirty
      ? "Unsaved changes."
      : "Plates are kept in this browser. Use Export file to share them.";
    refreshFields();
    $("mmps").textContent =
      "feed " + f(P.wfs * IPM, 1) + " | travel " + f(P.ts * IPM, 2) + " mm/s";
    /* checks */
    const ul = $("checks");
    ul.textContent = "";
    const li = (t, w) => {
      const e = h("li", w ? "warn" : null, t);
      ul.appendChild(e);
    };
    const W = MODEL.wfsStable,
      T = MODEL.wfsTested,
      R = MODEL.tsTested;
    if (P.wfs < T[0])
      li(
        "Wire feed " +
          f(P.wfs, 0) +
          " in/min is below 150, where no bead has been measured.",
        1,
      );
    else if (P.wfs > T[1])
      li(
        "Wire feed " +
          f(P.wfs, 0) +
          " in/min is above 325, where no bead has been measured.",
        1,
      );
    else if (P.wfs > W[1])
      li(
        "Wire feed " +
          f(P.wfs, 0) +
          " in/min is above 250. Short beads did not reach a steady cross-section there.",
        1,
      );
    else
      li(
        "Wire feed " +
          f(P.wfs, 0) +
          " in/min is inside the stable window, 150 to 250.",
      );
    if (P.ts < R[0] || P.ts > R[1])
      li(
        "Travel " +
          f(P.ts, 1) +
          " in/min is outside the tested range, 20 to 30.",
        1,
      );
    else if (Math.abs(P.ts - 25) > 0.5)
      li(
        "Travel " +
          f(P.ts, 1) +
          " in/min is inside the tested range, with few beads away from 25.",
        1,
      );
    else li("Travel 25 in/min is where 12 of the 18 beads were measured.");
    if (S.mode === "shape") {
      if (Math.abs(P.vNeed - P.volt) > 0.05)
        li(
          "This height and width need " +
            f(P.vNeed, 1) +
            " V, outside 16 to 20 V. At " +
            f(P.volt, 1) +
            " V the bead comes out " +
            f(P.h, 2) +
            " mm high and " +
            f(P.w, 2) +
            " mm wide.",
          1,
        );
      else
        li(
          "Height and width are reached at " +
            f(P.volt, 1) +
            " V. The voltage effect on shape is provisional.",
          1,
        );
    } else if (P.volt < MODEL.vTested[0] || P.volt > MODEL.vTested[1])
      li(
        "Voltage " +
          f(P.volt, 1) +
          " V is outside the tested range, 16 to 20 V.",
        1,
      );
    /* bead tab */
    kvFill("kvBead", [
      [
        "Cross-section, settled",
        f(P.area, 2) + " <i>± " + f(MODEL.rmse, 2) + " mm²</i>",
      ],
      ["Crest height", f(P.h, 2) + " <i>mm</i>"],
      ["Width, toe to toe", f(P.w, 2) + " <i>mm</i>"],
      ["Width at half height", f(P.w / 2, 2) + " <i>mm</i>"],
      ["Largest section, at the start", f(P.peak, 2) + " <i>mm²</i>"],
      ["Crest height at the start", f(P.peakH, 2) + " <i>mm</i>"],
    ]);
    kvFill("kvDep", [
      ["WFS / TS", f(P.wfs / P.ts, 2)],
      ["Arc time", f(P.time, 2) + " <i>s</i>"],
      ["Frames at 24 fps", String(P.frames)],
      ["Metal in the bead", f(P.metal, 0) + " <i>mm³</i>"],
      ["Wire used", f(P.metal / MODEL.wire, 0) + " <i>mm</i>"],
    ]);
    const fr = plateFrame(S.plate),
      of = offset();
    kvFill(
      "kvFrame",
      fr
        ? [
            ["Touches to the plane, rms", f(fr.rms, 3) + " <i>mm</i>"],
            ["Largest distance", f(fr.max, 3) + " <i>mm</i>"],
            [
              "X axis",
              isFinite(fr.span)
                ? "touches, " + f(fr.span, 1) + " <i>mm apart</i>"
                : "robot X",
            ],
          ]
        : [["Frame", "not defined"]],
    );
    fillMove(of);
    buildBead3D();
    drawCharts();
    drawPlate();
    applyFrame();
    drawRuler();
  }

  /* ================= 3D viewport ================= */
  const canvas = $("gl");
  let R3 = null,
    scene,
    camera,
    bead,
    wire,
    plateG,
    grid,
    plateMesh,
    torch,
    dirty = true;
  const cam = { az: -0.9, pol: 1.05, dist: 80, t: [10, 0.6, 0] };
  const M = 20;
  let nSec = 0;
  const frameDist = (len) => 30 + len * 2.7;
  function initGL() {
    R3 = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
    });
    R3.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(32, 1, 0.5, 4000);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2c2c2c, 0.5));
    const k = new THREE.DirectionalLight(0xffffff, 0.62);
    k.position.set(-30, 60, 40);
    scene.add(k);
    const r = new THREE.DirectionalLight(0xffffff, 0.22);
    r.position.set(40, 25, -50);
    scene.add(r);
    bead = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshStandardMaterial({
        color: 0xa6a6a4,
        metalness: 0.35,
        roughness: 0.58,
        side: THREE.DoubleSide,
      }),
    );
    wire = new THREE.Mesh(
      bead.geometry,
      new THREE.MeshBasicMaterial({
        color: 0x101010,
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      }),
    );
    scene.add(bead);
    scene.add(wire);
    plateG = new THREE.Group();
    scene.add(plateG);
    torch = new THREE.Group();
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 7.62, 16),
      new THREE.MeshStandardMaterial({
        color: 0xe6e6e4,
        metalness: 0.6,
        roughness: 0.35,
      }),
    );
    rod.position.y = 0.889 + 3.81;
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 2.2, 9, 20),
      new THREE.MeshStandardMaterial({
        color: 0x777777,
        metalness: 0.5,
        roughness: 0.5,
      }),
    );
    tip.position.y = 0.889 + 7.62 + 4.5;
    torch.add(rod);
    torch.add(tip);
    scene.add(torch);
  }
  let builtKey = "";
  function buildBead3D() {
    if (!R3) return;
    const key = [P.area, P.volt, P.len].map((v) => v.toFixed(4)).join("|");
    wire.visible = S.show.poly;
    if (grid) grid.visible = S.show.grid;
    if (plateMesh) plateMesh.visible = S.show.plate;
    dirty = true;
    $("vtGrid").setAttribute("aria-pressed", S.show.grid);
    if (key === builtKey) return;
    const refit = builtKey.split("|")[2] !== P.len.toFixed(4);
    builtKey = key;
    while (plateG.children.length) {
      const c = plateG.children.pop();
      c.geometry.dispose();
      c.material.dispose();
    }
    const L = P.len + 30,
      Wd = Math.max(30, Math.ceil(P.peakW + 16));
    plateMesh = new THREE.Mesh(
      new THREE.BoxGeometry(L, 3, Wd),
      new THREE.MeshStandardMaterial({
        color: 0x4a4a4c,
        metalness: 0.4,
        roughness: 0.7,
      }),
    );
    plateMesh.position.set(P.len / 2, -1.5, 0);
    plateMesh.visible = S.show.plate;
    plateG.add(plateMesh);
    const pts = [],
      x0 = P.len / 2 - L / 2,
      x1 = P.len / 2 + L / 2;
    for (let x = Math.ceil(x0 / 5) * 5; x <= x1; x += 5)
      pts.push(x, 0.01, -Wd / 2, x, 0.01, Wd / 2);
    for (let z = Math.ceil(-Wd / 2 / 5) * 5; z <= Wd / 2; z += 5)
      pts.push(x0, 0.01, z, x1, 0.01, z);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    grid = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({
        color: 0x8a8a8c,
        transparent: true,
        opacity: 0.45,
      }),
    );
    grid.visible = S.show.grid;
    plateG.add(grid);
    if (refit) {
      cam.t = [P.len / 2, 0.6, 0];
      cam.dist = frameDist(P.len);
    }
    meshKey = "";
  }
  let meshKey = "";
  function meshFor(sTorch) {
    /* bead deposited up to the torch position */
    if (!R3) return;
    const done = sTorch >= P.len - 1e-6,
      key = builtKey + "|" + (done ? "end" : sTorch.toFixed(2));
    if (key === meshKey) return;
    meshKey = key;
    const p = { area: P.area, len: P.len, upto: done ? P.len : sTorch },
      s0 = -3 * MODEL.endSd - 1,
      s1 = P.len + 3 * MODEL.endSd,
      ds = 0.5,
      pos = [],
      idx = [],
      sec = [];
    nSec = 0;
    if (done || sTorch > 0)
      for (let s = s0; s <= s1 + 1e-9; s += ds) {
        const A = areaAt(s, p);
        if (A >= 0.03 * P.area) sec.push([s, A]);
      }
    if (sec.length) {
      sec.unshift([sec[0][0] - 0.35, 0]);
      sec.push([sec[sec.length - 1][0] + 0.35, 0]);
    } else sec.push([0, 0], [0.1, 0]);
    sec.forEach((q) => {
      const A = q[1],
        hh = A > 0 ? heightOf(A, P.volt) : 0,
        w = A > 0 ? (2 * A) / hh : 0;
      for (let j = 0; j <= M; j++) {
        const u = j / M - 0.5,
          c = Math.cos(Math.PI * u);
        pos.push(q[0], hh * c * c, u * w);
      }
      nSec++;
    });
    for (let i = 0; i < nSec - 1; i++)
      for (let j = 0; j < M; j++) {
        const a = i * (M + 1) + j,
          b = a + 1,
          c = a + M + 1,
          d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry(),
      old = bead.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    bead.geometry = g;
    wire.geometry = g;
    old.dispose();
    dirty = true;
    kvFill("kvMesh", [
      ["Sections along the bead", String(nSec)],
      ["Points across", String(M + 1)],
      ["Polygons", String((nSec - 1) * M * 2)],
    ]);
  }
  function camPos() {
    const sp = Math.sin(cam.pol);
    return [
      cam.t[0] + cam.dist * sp * Math.sin(cam.az),
      cam.t[1] + cam.dist * Math.cos(cam.pol),
      cam.t[2] + cam.dist * sp * Math.cos(cam.az),
    ];
  }
  function loop() {
    requestAnimationFrame(loop);
    if (play.on) {
      const now = performance.now(),
        fr = play.f0 + ((now - play.t0) / 1000) * FPS;
      if (fr >= S.end) {
        S.frame = S.end;
        stopPlay();
      } else S.frame = fr;
      applyFrame();
      drawRuler();
    }
    if (!R3) return;
    const w = canvas.clientWidth,
      hh = canvas.clientHeight;
    if (!w || !hh) return;
    const pr = R3.getPixelRatio();
    if (
      canvas.width !== Math.round(w * pr) ||
      canvas.height !== Math.round(hh * pr)
    ) {
      R3.setSize(w, hh, false);
      camera.aspect = w / hh;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    if (!dirty) return;
    dirty = false;
    const c = camPos();
    camera.position.set(c[0], c[1], c[2]);
    camera.lookAt(cam.t[0], cam.t[1], cam.t[2]);
    R3.render(scene, camera);
    drawGizmo();
  }
  function pan(dx, dy) {
    const k = cam.dist * 0.0016,
      sa = Math.sin(cam.az),
      ca = Math.cos(cam.az),
      cp = Math.cos(cam.pol),
      sp = Math.sin(cam.pol);
    const right = [ca, 0, -sa],
      up = [-cp * sa, sp, -cp * ca];
    for (let i = 0; i < 3; i++) cam.t[i] += (-dx * right[i] + dy * up[i]) * k;
    dirty = true;
  }
  function zoom(fac) {
    cam.dist = Math.min(1500, Math.max(6, cam.dist * fac));
    dirty = true;
  }
  function orbit(dx, dy) {
    cam.az -= dx * 0.008;
    cam.pol = Math.min(Math.PI - 0.03, Math.max(0.03, cam.pol - dy * 0.008));
    dirty = true;
    hudView("User Perspective");
  }
  function frameBead() {
    cam.az = -0.9;
    cam.pol = 1.05;
    cam.t = [P.len / 2, 0.6, 0];
    cam.dist = frameDist(P.len);
    dirty = true;
    hudView("User Perspective");
  }
  function hudView(t) {
    $("hud1").textContent = t;
  }
  let panMode = false;
  const ptr = new Map();
  let pinch = 0;
  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    ptr.set(e.pointerId, [e.clientX, e.clientY, e.button]);
    pinch = 0;
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => {
    const o = ptr.get(e.pointerId);
    if (!o) return;
    const dx = e.clientX - o[0],
      dy = e.clientY - o[1];
    o[0] = e.clientX;
    o[1] = e.clientY;
    if (ptr.size === 1) {
      if (o[2] === 1 || o[2] === 2 || e.shiftKey || panMode) pan(dx, dy);
      else if (e.ctrlKey) zoom(Math.exp(dy * 0.01));
      else orbit(dx, dy);
    } else if (ptr.size === 2) {
      const a = Array.from(ptr.values()),
        d = Math.hypot(a[0][0] - a[1][0], a[0][1] - a[1][1]);
      if (pinch) zoom(pinch / d);
      pinch = d;
    }
  });
  ["pointerup", "pointercancel"].forEach((n) =>
    canvas.addEventListener(n, (e) => {
      ptr.delete(e.pointerId);
      pinch = 0;
    }),
  );
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom(Math.exp(e.deltaY * 0.0012));
    },
    { passive: false },
  );
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  function dragTool(btn, fn) {
    let last = null,
      moved = false;
    btn.addEventListener("pointerdown", (e) => {
      btn.setPointerCapture(e.pointerId);
      last = [e.clientX, e.clientY];
      moved = false;
    });
    btn.addEventListener("pointermove", (e) => {
      if (!last) return;
      const dx = e.clientX - last[0],
        dy = e.clientY - last[1];
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      last = [e.clientX, e.clientY];
      fn(dx, dy);
    });
    btn.addEventListener("pointerup", () => {
      last = null;
    });
    btn.addEventListener("pointercancel", () => {
      last = null;
    });
    return () => moved;
  }
  dragTool($("vtZoom"), (dx, dy) => zoom(Math.exp(dy * 0.012)));
  $("vtZoom").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      zoom(e.shiftKey ? 1.2 : 0.83);
    }
  });
  const panMoved = dragTool($("vtPan"), (dx, dy) => pan(dx * 2, dy * 2));
  $("vtPan").addEventListener("click", () => {
    if (panMoved()) return;
    panMode = !panMode;
    $("vtPan").setAttribute("aria-pressed", panMode);
    canvas.style.cursor = panMode ? "grab" : "";
  });
  $("vtCam").addEventListener("click", frameBead);
  $("vtGrid").addEventListener("click", () => {
    S.show.grid = !S.show.grid;
    refresh();
  });

  /* ---------- axis gizmo ---------- */
  const giz = $("gizmo"),
    gctx = giz.getContext("2d");
  let gTips = [];
  function drawGizmo() {
    const W = 184,
      c = W / 2,
      Rr = 62,
      sa = Math.sin(cam.az),
      ca = Math.cos(cam.az),
      cp = Math.cos(cam.pol),
      sp = Math.sin(cam.pol);
    const right = [ca, 0, -sa],
      up = [-cp * sa, sp, -cp * ca],
      fwd = [sp * sa, cp, sp * ca];
    const axes = [
      ["X", [1, 0, 0], css("--ax-x")],
      ["Y", [0, 0, -1], css("--ax-y")],
      ["Z", [0, 1, 0], css("--ax-z")],
    ];
    gTips = [];
    axes.forEach((a) => {
      [1, -1].forEach((sg) => {
        const v = a[1].map((x) => x * sg);
        gTips.push({
          n: a[0],
          sg: sg,
          col: a[2],
          x: c + dot(v, right) * Rr,
          y: c - dot(v, up) * Rr,
          d: dot(v, fwd),
          v: v,
        });
      });
    });
    gTips.sort((p, q) => p.d - q.d);
    gctx.clearRect(0, 0, W, W);
    gTips.forEach((t) => {
      if (t.sg > 0) {
        gctx.strokeStyle = t.col;
        gctx.lineWidth = 4;
        gctx.lineCap = "round";
        gctx.beginPath();
        gctx.moveTo(c, c);
        gctx.lineTo(t.x, t.y);
        gctx.stroke();
      }
      gctx.beginPath();
      gctx.arc(t.x, t.y, t.sg > 0 ? 17 : 13, 0, 7);
      if (t.sg > 0) {
        gctx.fillStyle = t.col;
        gctx.fill();
        gctx.fillStyle = "#111";
        gctx.font = "600 20px " + css("--sans");
        gctx.textAlign = "center";
        gctx.textBaseline = "middle";
        gctx.fillText(t.n, t.x, t.y + 1);
      } else {
        gctx.globalAlpha = 0.35;
        gctx.fillStyle = t.col;
        gctx.fill();
        gctx.globalAlpha = 1;
        gctx.strokeStyle = t.col;
        gctx.lineWidth = 2.5;
        gctx.stroke();
      }
    });
  }
  (function () {
    let down = null,
      moved = false;
    giz.addEventListener("pointerdown", (e) => {
      giz.setPointerCapture(e.pointerId);
      down = [e.clientX, e.clientY];
      moved = false;
    });
    giz.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down[0],
        dy = e.clientY - down[1];
      if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
      if (moved) {
        orbit(dx * 1.5, dy * 1.5);
        down = [e.clientX, e.clientY];
      }
    });
    giz.addEventListener("pointerup", (e) => {
      if (!down) return;
      down = null;
      if (moved) return;
      const r = giz.getBoundingClientRect(),
        x = ((e.clientX - r.left) / r.width) * 184,
        y = ((e.clientY - r.top) / r.height) * 184;
      let best = null;
      gTips.forEach((t) => {
        const d = Math.hypot(t.x - x, t.y - y);
        if (d < 20 && (!best || t.d < best.d)) best = t;
      });
      if (!best) return;
      const v = best.v;
      if (Math.abs(v[1]) > 0.5) {
        cam.pol = v[1] > 0 ? 0.03 : Math.PI - 0.03;
        cam.az = 0;
        hudView(v[1] > 0 ? "Top" : "Bottom");
      } else {
        cam.pol = Math.PI / 2;
        cam.az = Math.atan2(v[0], v[2]);
        hudView(
          {
            X:
              best.sg > 0
                ? "Along the bead, from the end"
                : "Along the bead, from the start",
            Y: best.sg > 0 ? "Side, from + Y" : "Side, from − Y",
          }[best.n],
        );
      }
      dirty = true;
    });
  })();

  /* ================= timeline ================= */
  const play = { on: false, t0: 0, f0: 1 };
  function startPlay() {
    if (S.frame >= S.end) S.frame = S.start;
    play.on = true;
    play.t0 = performance.now();
    play.f0 = S.frame;
    $("tPlay").setAttribute("aria-pressed", "true");
    $("playIc").setAttribute("d", "M2.5 2h2.6v8H2.5zM6.9 2h2.6v8H6.9z");
  }
  function stopPlay() {
    play.on = false;
    S.frame = Math.round(S.frame);
    $("tPlay").setAttribute("aria-pressed", "false");
    $("playIc").setAttribute("d", "M3 1.8v8.4L10 6z");
    applyFrame();
    drawRuler();
  }
  function setFrame(v) {
    if (play.on) stopPlay();
    S.frame = Math.min(S.end, Math.max(S.start, Math.round(v)));
    applyFrame();
    drawRuler();
  }
  $("tPlay").addEventListener("click", () =>
    play.on ? stopPlay() : startPlay(),
  );
  $("tFirst").addEventListener("click", () => setFrame(S.start));
  $("tLast").addEventListener("click", () => setFrame(S.end));
  $("tPrev").addEventListener("click", () => setFrame(Math.round(S.frame) - 1));
  $("tNext").addEventListener("click", () => setFrame(Math.round(S.frame) + 1));
  $("tlFrame").appendChild(
    field({
      k: "frame",
      ax: "Frame",
      label: "Current frame",
      unit: "",
      dec: 0,
      step: 1,
      get: () => Math.round(S.frame),
      set: (v) => {
        setFrame(v);
      },
    }),
  );
  $("tlStart").appendChild(
    field({
      k: "start",
      ax: "Start",
      label: "Start frame",
      unit: "",
      dec: 0,
      step: 1,
      get: () => S.start,
      set: (v) => {
        S.start = Math.min(Math.max(1, Math.round(v)), S.end - 1);
        if (S.frame < S.start) S.frame = S.start;
      },
    }),
  );
  $("tlEnd").appendChild(
    field({
      k: "end",
      ax: "End",
      label: "End frame",
      unit: "",
      dec: 0,
      step: 1,
      get: () => S.end,
      set: (v) => {
        S.end = Math.min(Math.max(S.start + 1, Math.round(v)), P.frames);
        if (S.frame > S.end) S.frame = S.end;
      },
    }),
  );
  function applyFrame() {
    if (!P) return;
    const s = sOfFrame(S.frame),
      t = (S.frame - 1) / FPS;
    if (document.activeElement !== FLD.find((o) => o.def.k === "frame").inp)
      FLD.find((o) => o.def.k === "frame").inp.value = String(
        Math.round(S.frame),
      );
    $("tlInfo").textContent =
      "t = " + f(t, 2) + " s  |  torch at " + f(s, 1) + " mm  |  24 fps";
    $("hud2").textContent =
      "(" +
      Math.round(S.frame) +
      ") Bead  |  WFS " +
      f(P.wfs, 1) +
      " in/min  |  TS " +
      f(P.ts, 1) +
      " in/min  |  " +
      f(P.volt, 1) +
      " V  |  " +
      f(P.area, 2) +
      " mm²";
    if (R3) {
      meshFor(Math.round(S.frame) >= P.frames ? P.len : s);
      torch.position.set(s, 0, 0);
      torch.visible =
        S.show.torch && (play.on || Math.round(S.frame) < P.frames);
      dirty = true;
    }
    if (cursorB) cursorB(s);
  }
  const ruler = $("ruler"),
    rctx = ruler.getContext("2d");
  let rmap = null;
  function drawRuler() {
    if (!P) return;
    const w = ruler.clientWidth,
      hh = ruler.clientHeight,
      pr = window.devicePixelRatio || 1;
    if (!w) return;
    if (
      ruler.width !== Math.round(w * pr) ||
      ruler.height !== Math.round(hh * pr)
    ) {
      ruler.width = Math.round(w * pr);
      ruler.height = Math.round(hh * pr);
    }
    rctx.setTransform(pr, 0, 0, pr, 0, 0);
    rctx.clearRect(0, 0, w, hh);
    const lo = 0,
      hi = Math.max(P.frames + 4, 24),
      x = (v) => 24 + ((v - lo) / (hi - lo)) * (w - 48);
    rmap = { x: x, inv: (px) => lo + ((px - 24) / (w - 48)) * (hi - lo) };
    rctx.fillStyle = "#232323";
    rctx.fillRect(x(S.start), 0, x(S.end) - x(S.start), hh);
    rctx.fillStyle = "#2f2f2f";
    rctx.fillRect(0, 0, w, 18);
    const major = hi > 480 ? 48 : hi > 240 ? 24 : 12,
      minor = hi > 240 ? 0 : hi > 96 ? 4 : 1;
    rctx.font = "10.5px " + css("--sans");
    rctx.textAlign = "center";
    rctx.textBaseline = "middle";
    for (let v = 0; v <= hi; v++) {
      const isM = v % major === 0;
      if (!isM && (!minor || v % minor)) continue;
      const px = Math.round(x(v)) + 0.5;
      rctx.strokeStyle = isM ? "#5a5a5a" : "#383838";
      rctx.beginPath();
      rctx.moveTo(px, isM ? 18 : 22);
      rctx.lineTo(px, hh);
      rctx.stroke();
      if (isM) {
        rctx.fillStyle = css("--fg2");
        rctx.fillText(String(v), px, 9);
      }
    }
    /* keyframes: arc start and arc end */
    [
      [1, "Arc start"],
      [P.frames, "Arc end"],
    ].forEach((k) => {
      const px = x(k[0]),
        py = 33;
      rctx.fillStyle = css("--blue-hi");
      rctx.beginPath();
      rctx.moveTo(px, py - 5);
      rctx.lineTo(px + 5, py);
      rctx.lineTo(px, py + 5);
      rctx.lineTo(px - 5, py);
      rctx.closePath();
      rctx.fill();
      rctx.fillStyle = css("--fg3");
      rctx.textAlign = k[0] === 1 ? "left" : "right";
      rctx.fillText(k[1], px + (k[0] === 1 ? 9 : -9), py);
      rctx.textAlign = "center";
    });
    /* current frame */
    const cx = x(S.frame),
      lab = String(Math.round(S.frame)),
      bw = Math.max(22, rctx.measureText(lab).width + 10);
    rctx.fillStyle = css("--blue");
    rctx.fillRect(Math.round(cx) - 1, 18, 2, hh - 18);
    rctx.beginPath();
    if (rctx.roundRect) rctx.roundRect(cx - bw / 2, 1, bw, 16, 3);
    else rctx.rect(cx - bw / 2, 1, bw, 16);
    rctx.fill();
    rctx.fillStyle = "#fff";
    rctx.fillText(lab, cx, 9.5);
  }
  (function () {
    let drag = false;
    const go = (e) => {
      if (!rmap) return;
      const r = ruler.getBoundingClientRect();
      setFrame(rmap.inv(e.clientX - r.left));
    };
    ruler.addEventListener("pointerdown", (e) => {
      ruler.setPointerCapture(e.pointerId);
      drag = true;
      go(e);
    });
    ruler.addEventListener("pointermove", (e) => {
      if (drag) go(e);
    });
    ["pointerup", "pointercancel"].forEach((n) =>
      ruler.addEventListener(n, () => {
        drag = false;
      }),
    );
  })();
  window.addEventListener("resize", () => {
    drawRuler();
    dirty = true;
  });

  /* ================= charts ================= */
  const NS = "http://www.w3.org/2000/svg",
    tip = $("tip");
  let cursorB = null;
  function el(svg, tag, at, txt) {
    const e = document.createElementNS(NS, tag);
    for (const k in at) e.setAttribute(k, at[k]);
    if (txt != null) e.textContent = txt;
    svg.appendChild(e);
    return e;
  }
  function ticks(lo, hi, n) {
    const raw = (hi - lo) / n,
      p = Math.pow(10, Math.floor(Math.log10(raw))),
      st = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) || raw,
      out = [];
    for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st)
      out.push(+v.toFixed(6));
    return out;
  }
  function axes(svg, b, xs, ys, xl, yl, xt, yt) {
    xt.forEach((v) => {
      el(svg, "line", {
        x1: xs(v),
        x2: xs(v),
        y1: b.t,
        y2: b.b,
        stroke: "#333",
        "stroke-width": 1,
      });
      el(
        svg,
        "text",
        { x: xs(v), y: b.b + 13, "text-anchor": "middle" },
        String(v).replace("-", MINUS),
      );
    });
    yt.forEach((v) => {
      el(svg, "line", {
        x1: b.l,
        x2: b.r,
        y1: ys(v),
        y2: ys(v),
        stroke: "#333",
        "stroke-width": 1,
      });
      el(
        svg,
        "text",
        { x: b.l - 6, y: ys(v) + 3.5, "text-anchor": "end" },
        String(v).replace("-", MINUS),
      );
    });
    el(svg, "line", {
      x1: b.l,
      x2: b.r,
      y1: b.b,
      y2: b.b,
      stroke: "#666",
      "stroke-width": 1,
    });
    el(
      svg,
      "text",
      { x: (b.l + b.r) / 2, y: b.b + 27, "text-anchor": "middle" },
      xl,
    );
    el(svg, "text", { x: b.l - 32, y: b.t - 8, "text-anchor": "start" }, yl);
  }
  function showTip(e, t) {
    tip.textContent = t;
    tip.hidden = false;
    tip.style.left =
      Math.max(
        4,
        Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8),
      ) + "px";
    tip.style.top =
      Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 6) +
      "px";
  }
  function hideTip() {
    tip.hidden = true;
  }
  function drawCharts() {
    const p = P,
      fg = "#e6e6e6",
      fg2 = "#b4b4b4",
      fg3 = "#858585",
      blue = css("--blue-hi");
    let svg = $("chA");
    svg.textContent = "";
    let b = { l: 42, r: 388, t: 22, b: 154 };
    const half = Math.max(p.peakW, p.w) / 2 + 0.6,
      top = Math.max(p.peakH, p.h) * 1.2,
      k = Math.min((b.r - b.l) / (2 * half), (b.b - b.t) / top),
      cx = (b.l + b.r) / 2;
    let xs = (v) => cx + v * k,
      ys = (v) => b.b - v * k;
    axes(
      svg,
      b,
      xs,
      ys,
      "distance from the centreline [mm]",
      "height [mm]",
      ticks(-Math.floor(half), Math.floor(half), 6),
      ticks(0, top, 3),
    );
    const prof = (hh, w) => {
      let d = "";
      for (let i = 0; i <= 60; i++) {
        const u = i / 60 - 0.5,
          c = Math.cos(Math.PI * u);
        d +=
          (i ? "L" : "M") +
          xs(u * w).toFixed(1) +
          " " +
          ys(hh * c * c).toFixed(1);
      }
      return d;
    };
    el(svg, "path", {
      d: prof(p.peakH, p.peakW),
      fill: "none",
      stroke: fg3,
      "stroke-width": 1.5,
      "stroke-dasharray": "4 3",
    });
    el(svg, "path", {
      d: prof(p.h, p.w) + "Z",
      fill: fg2,
      "fill-opacity": 0.2,
      stroke: fg,
      "stroke-width": 2,
    });
    el(
      svg,
      "text",
      { x: xs(0), y: ys(p.h * 0.4), "text-anchor": "middle", class: "t1 lab" },
      "settled " + f(p.h, 2) + " mm",
    );
    el(
      svg,
      "text",
      { x: xs(0), y: ys(p.peakH) - 5, "text-anchor": "middle", class: "lab" },
      "at the start " + f(p.peakH, 2) + " mm",
    );
    $("capA").textContent =
      "Drawn to scale. Solid, the settled section, " +
      f(p.w, 2) +
      " mm toe to toe. Dashed, the largest section at the start.";

    svg = $("chB");
    svg.textContent = "";
    b = { l: 42, r: 388, t: 22, b: 174 };
    const sA = -8,
      sB = p.len + 8,
      yMax = Math.max(p.peak, p.area + MODEL.rmse) * 1.14;
    xs = (v) => b.l + ((v - sA) / (sB - sA)) * (b.r - b.l);
    ys = (v) => b.b - (v / yMax) * (b.b - b.t);
    axes(
      svg,
      b,
      xs,
      ys,
      "distance from the arc start [mm]",
      "cross-section [mm²]",
      ticks(0, p.len, 5),
      ticks(0, yMax, 4),
    );
    el(svg, "rect", {
      x: xs(0),
      y: ys(p.area + MODEL.rmse),
      width: xs(p.len) - xs(0),
      height: ys(p.area - MODEL.rmse) - ys(p.area + MODEL.rmse),
      fill: fg2,
      "fill-opacity": 0.15,
    });
    el(svg, "line", {
      x1: xs(0),
      x2: xs(p.len),
      y1: ys(p.area),
      y2: ys(p.area),
      stroke: fg3,
      "stroke-width": 1.5,
      "stroke-dasharray": "4 3",
    });
    let d = "";
    for (let s = sA; s <= sB; s += 0.25)
      d +=
        (d ? "L" : "M") + xs(s).toFixed(1) + " " + ys(areaAt(s, p)).toFixed(1);
    el(svg, "path", { d: d, fill: "none", stroke: fg, "stroke-width": 2 });
    el(
      svg,
      "text",
      {
        x: xs(p.len / 2 + 2),
        y: ys(p.area - MODEL.rmse) + 13,
        "text-anchor": "middle",
        class: "lab",
      },
      "settled " + f(p.area, 2) + " ± " + f(MODEL.rmse, 2),
    );
    el(
      svg,
      "text",
      { x: xs(p.peakS) + 7, y: ys(p.peak) - 4, class: "t1 lab" },
      "start " + f(p.peak, 2),
    );
    const cur = el(svg, "line", {
        x1: 0,
        x2: 0,
        y1: b.t,
        y2: b.b,
        stroke: blue,
        "stroke-width": 1.5,
      }),
      xsB = xs;
    cursorB = (s) => {
      cur.setAttribute("x1", xsB(s));
      cur.setAttribute("x2", xsB(s));
    };
    cursorB(sOfFrame(S.frame));
    const hit = el(svg, "rect", {
        x: b.l,
        y: b.t,
        width: b.r - b.l,
        height: b.b - b.t,
        fill: "transparent",
      }),
      bb = b;
    hit.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect(),
        x = ((e.clientX - r.left) / r.width) * 400,
        s = sA + ((x - bb.l) / (bb.r - bb.l)) * (sB - sA),
        a = areaAt(s, p);
      showTip(
        e,
        "s " +
          f(s, 1) +
          " mm\narea " +
          f(a, 2) +
          " mm²\ncrest " +
          f(a > 1e-4 ? heightOf(a, p.volt) : 0, 2) +
          " mm",
      );
    });
    hit.addEventListener("pointerleave", hideTip);
    $("capB").textContent =
      "Solid, the model with the start hump and rounded ends. Dashed with band, the settled level and the model error. Blue, the torch at the current frame.";

    svg = $("chC");
    svg.textContent = "";
    b = { l: 42, r: 388, t: 22, b: 244 };
    const tLo = Math.min(17, Math.floor(p.ts - 3)),
      tHi = Math.max(33, Math.ceil(p.ts + 3)),
      wHi = Math.max(350, Math.ceil(p.wfs / 50 + 0.4) * 50);
    xs = (v) => b.l + ((v - tLo) / (tHi - tLo)) * (b.r - b.l);
    ys = (v) => b.b - (v / wHi) * (b.b - b.t);
    el(svg, "rect", {
      x: b.l,
      y: ys(250),
      width: b.r - b.l,
      height: ys(150) - ys(250),
      fill: fg2,
      "fill-opacity": 0.12,
    });
    axes(
      svg,
      b,
      xs,
      ys,
      "travel speed [in/min]",
      "wire feed speed [in/min]",
      ticks(tLo, tHi, 5),
      ticks(0, wHi, 6),
    );
    el(
      svg,
      "text",
      { x: b.r - 4, y: ys(150) - 5, "text-anchor": "end", class: "lab" },
      "stable window",
    );
    const y0 = (p.area * tLo) / MODEL.m,
      y1 = (p.area * tHi) / MODEL.m,
      cl = (v) => Math.min(v, wHi);
    el(svg, "line", {
      x1: xs(tLo),
      y1: ys(cl(y0)),
      x2: xs(y1 > wHi ? (wHi * MODEL.m) / p.area : tHi),
      y2: ys(cl(y1)),
      stroke: fg,
      "stroke-width": 2,
    });
    el(
      svg,
      "text",
      { x: xs(tLo) + 5, y: ys(cl(y0)) + 15, class: "t1 lab" },
      f(p.area, 1) + " mm² line",
    );
    BEADS.forEach((q) => {
      const g = el(svg, "g", {});
      el(g, "circle", {
        cx: xs(q[2]),
        cy: ys(q[1]),
        r: 9,
        fill: "transparent",
      });
      el(g, "circle", {
        cx: xs(q[2]),
        cy: ys(q[1]),
        r: 4,
        fill: fg3,
        stroke: "#1d1d1d",
        "stroke-width": 1.5,
      });
      g.addEventListener("pointermove", (e) =>
        showTip(
          e,
          "bead " +
            q[0] +
            "\nWFS " +
            q[1] +
            ", TS " +
            q[2] +
            " in/min\n" +
            q[3] +
            " V\narea " +
            q[4] +
            " mm², crest " +
            q[5] +
            " mm",
        ),
      );
      g.addEventListener("pointerleave", hideTip);
    });
    el(svg, "circle", {
      cx: xs(p.ts),
      cy: ys(Math.min(p.wfs, wHi)),
      r: 7,
      fill: "none",
      stroke: blue,
      "stroke-width": 2,
    });
    el(svg, "circle", {
      cx: xs(p.ts),
      cy: ys(Math.min(p.wfs, wHi)),
      r: 2.5,
      fill: blue,
    });
    $("capC").textContent =
      "Blue ring, this process. Dots, the 18 measured beads. The line holds every feed and travel pair that gives " +
      f(p.area, 1) +
      " mm².";
  }
  function fillMove(of) {
    kvFill(
      "kvMove",
      of
        ? [
            ["Along plate x, y", f(of.a, 3) + ", " + f(of.b, 3) + " <i>mm</i>"],
            ["Same move in robot axes", of.w.map((v) => f(v, 3)).join(", ")],
            ["W, P, R of the register", "0, 0, 0"],
            [
              "Length",
              f(Math.hypot(of.o[0], of.o[1], of.o[2]), 3) + " <i>mm</i>",
            ],
          ]
        : [["Offset", "needs a plate"]],
    );
  }
  function hull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      cr = (o, a, b) =>
        (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]),
      lo = [],
      up = [];
    p.forEach((q) => {
      while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0)
        lo.pop();
      lo.push(q);
    });
    p.slice()
      .reverse()
      .forEach((q) => {
        while (
          up.length > 1 &&
          cr(up[up.length - 2], up[up.length - 1], q) <= 0
        )
          up.pop();
        up.push(q);
      });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function fitPlate(of, what) {
    const pts =
        what === "bead" ? [of.sw, of.ew] : of.fr.T.concat([of.sw, of.ew]),
      xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    const x0 = Math.min.apply(null, xs),
      x1 = Math.max.apply(null, xs),
      y0 = Math.min.apply(null, ys),
      y1 = Math.max.apply(null, ys);
    const pad =
      what === "bead"
        ? Math.max(P.len * 0.9, 8)
        : Math.max(x1 - x0, y1 - y0) * 0.14 + 10;
    PV.cx = (x0 + x1) / 2;
    PV.cy = (y0 + y1) / 2;
    PV.k = Math.min(
      (PB.r - PB.l) / (x1 - x0 + 2 * pad),
      (PB.b - PB.t) / (y1 - y0 + 2 * pad),
    );
  }
  function pvPoint(e) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      $("chP").getScreenCTM().inverse(),
    );
    return [
      PV.cx + (p.x - (PB.l + PB.r) / 2) / PV.k,
      PV.cy - (p.y - (PB.t + PB.b) / 2) / PV.k,
      p.x,
      p.y,
    ];
  }
  function toPlate(fr, wx, wy) {
    const t = fr.T[S.plate.origin - 1],
      dx = wx - t[0],
      dy = wy - t[1],
      det = fr.x[0] * fr.y[1] - fr.x[1] * fr.y[0];
    return [
      (dx * fr.y[1] - dy * fr.y[0]) / det,
      (fr.x[0] * dy - fr.x[1] * dx) / det,
    ];
  }
  let pvDrag = null;
  function pvMove(e) {
    if (!pvDrag) return;
    const q = pvPoint(e),
      fr = plateFrame(S.plate);
    if (!fr) return;
    if (pvDrag.kind === "pan") {
      PV.cx = pvDrag.cx - (q[2] - pvDrag.x) / PV.k;
      PV.cy = pvDrag.cy + (q[3] - pvDrag.y) / PV.k;
      drawPlate();
      return;
    }
    const p = toPlate(fr, q[0], q[1]),
      st = e.shiftKey ? 0.1 : 1,
      rd = (v) => +(Math.round(v / st) * st).toFixed(1);
    if (pvDrag.kind === "start") {
      S.sx = rd(p[0]);
      S.sy = rd(p[1]);
    } else if (Math.hypot(p[0] - S.sx, p[1] - S.sy) > 1e-6)
      S.ang = rd((Math.atan2(p[1] - S.sy, p[0] - S.sx) * 180) / Math.PI) + 0;
    refreshFields();
    fillMove(offset());
    drawPlate();
  }
  function pvEnd() {
    document.removeEventListener("pointermove", pvMove);
    document.removeEventListener("pointerup", pvEnd);
    document.removeEventListener("pointercancel", pvEnd);
    if (!pvDrag) return;
    const pan = pvDrag.kind === "pan";
    pvDrag = null;
    if (!pan) {
      saveBead();
      refresh();
    } else drawPlate();
  }
  function pvStart(kind, e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const q = pvPoint(e);
    PV.auto = null;
    pvDrag = { kind: kind, x: q[2], y: q[3], cx: PV.cx, cy: PV.cy };
    document.addEventListener("pointermove", pvMove);
    document.addEventListener("pointerup", pvEnd);
    document.addEventListener("pointercancel", pvEnd);
  }
  (function () {
    const svg = $("chP");
    svg.addEventListener("pointerdown", (e) => {
      if (plateFrame(S.plate)) pvStart("pan", e);
    });
    svg.addEventListener(
      "wheel",
      (e) => {
        if (!plateFrame(S.plate)) return;
        e.preventDefault();
        const q = pvPoint(e),
          k = Math.min(
            Math.max(PV.k * Math.exp(-e.deltaY * 0.0015), 0.15),
            150,
          );
        PV.cx = q[0] - (q[2] - (PB.l + PB.r) / 2) / k;
        PV.cy = q[1] + (q[3] - (PB.t + PB.b) / 2) / k;
        PV.k = k;
        PV.auto = null;
        drawPlate();
      },
      { passive: false },
    );
    svg.addEventListener("dblclick", () => {
      PV.auto = "plate";
      drawPlate();
    });
    $("pvFit").addEventListener("click", () => {
      PV.auto = "plate";
      drawPlate();
    });
    $("pvBead").addEventListener("click", () => {
      PV.auto = "bead";
      drawPlate();
    });
  })();
  function drawPlate() {
    const svg = $("chP");
    svg.textContent = "";
    const of = offset(),
      fr = plateFrame(S.plate);
    if (!fr || !of) {
      el(
        svg,
        "text",
        { x: 220, y: 190, "text-anchor": "middle" },
        "The five touches do not define a plate yet.",
      );
      ["capP", "progNote", "coordNote"].forEach((i) => {
        $(i).textContent = "";
      });
      ["matTxt", "progTxt", "coordTxt"].forEach((i) => {
        $(i).textContent = "—";
      });
      return;
    }
    if (PV.auto) fitPlate(of, PV.auto);
    const b = PB,
      k = PV.k,
      mx = (b.l + b.r) / 2,
      my = (b.t + b.b) / 2,
      X = (v) => mx + (v - PV.cx) * k,
      Y = (v) => my - (v - PV.cy) * k,
      blue = css("--blue-hi");
    axes(
      svg,
      b,
      X,
      Y,
      "X robot [mm]",
      "Y robot [mm]",
      ticks(PV.cx - (b.r - b.l) / 2 / k, PV.cx + (b.r - b.l) / 2 / k, 5),
      ticks(PV.cy - (b.b - b.t) / 2 / k, PV.cy + (b.b - b.t) / 2 / k, 5),
    );
    const cp = el(svg, "clipPath", { id: "pvClip" });
    el(cp, "rect", { x: b.l, y: b.t, width: b.r - b.l, height: b.b - b.t });
    el(svg, "rect", {
      x: b.l,
      y: b.t,
      width: b.r - b.l,
      height: b.b - b.t,
      fill: "transparent",
      style: "cursor:move",
    });
    const g = el(svg, "g", { "clip-path": "url(#pvClip)" });
    el(g, "polygon", {
      points: hull(fr.T.map((p) => [p[0], p[1]]))
        .map((p) => X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1))
        .join(" "),
      fill: "rgba(255,255,255,.05)",
      stroke: "#6a6a6a",
      "stroke-width": 1,
      "stroke-dasharray": "4 3",
      "pointer-events": "none",
    });
    const o = fr.T[S.plate.origin - 1],
      La = 38 / k;
    [
      [fr.x, css("--ax-x"), "x"],
      [fr.y, css("--ax-y"), "y"],
    ].forEach((a) => {
      const ex = X(o[0] + a[0][0] * La),
        ey = Y(o[1] + a[0][1] * La);
      el(g, "line", {
        x1: X(o[0]),
        y1: Y(o[1]),
        x2: ex,
        y2: ey,
        stroke: a[1],
        "stroke-width": 2,
        "stroke-linecap": "round",
        "pointer-events": "none",
      });
      el(
        g,
        "text",
        {
          x: X(o[0] + a[0][0] * La * 1.28),
          y: Y(o[1] + a[0][1] * La * 1.28) + 3,
          "text-anchor": "middle",
          class: "t1 lab",
          "pointer-events": "none",
        },
        a[2],
      );
    });
    fr.T.forEach((p, i) => {
      el(g, "circle", {
        cx: X(p[0]),
        cy: Y(p[1]),
        r: 3,
        fill: "#9a9a9a",
        stroke: "#1d1d1d",
        "stroke-width": 1,
        "pointer-events": "none",
      });
      if (S.show.touch) {
        el(
          g,
          "text",
          {
            x: X(p[0]) + 7,
            y: Y(p[1]) - 6,
            class: "lab",
            "pointer-events": "none",
          },
          "P" + (i + 1),
        );
        const hit = el(g, "circle", {
          cx: X(p[0]),
          cy: Y(p[1]),
          r: 9,
          fill: "transparent",
        });
        hit.addEventListener("pointermove", (e) =>
          showTip(
            e,
            "P" +
              (i + 1) +
              "\nX " +
              f(p[0], 3) +
              "\nY " +
              f(p[1], 3) +
              "\nZ " +
              f(p[2], 3) +
              "\nto the plane " +
              f(fr.off[i], 3) +
              " mm",
          ),
        );
        hit.addEventListener("pointerleave", hideTip);
      }
    });
    const sx = X(of.sw[0]),
      sy = Y(of.sw[1]),
      ex = X(of.ew[0]),
      ey = Y(of.ew[1]),
      bl = Math.hypot(ex - sx, ey - sy) || 1,
      ux = (ex - sx) / bl,
      uy = (ey - sy) / bl;
    const rs = Math.min(Math.max(bl * 0.7, 26), 70) / k,
      ra = rs * 0.62;
    el(g, "line", {
      x1: sx,
      y1: sy,
      x2: X(of.sw[0] + fr.x[0] * rs),
      y2: Y(of.sw[1] + fr.x[1] * rs),
      stroke: "#8a8a8a",
      "stroke-width": 1,
      "stroke-dasharray": "3 3",
      "pointer-events": "none",
    });
    if (Math.abs(S.ang) > 2) {
      let d = "";
      const n = Math.max(6, Math.ceil(Math.abs(S.ang) / 5));
      for (let i = 0; i <= n; i++) {
        const t = (((S.ang * i) / n) * Math.PI) / 180,
          c = Math.cos(t),
          sn = Math.sin(t);
        d +=
          (i ? "L" : "M") +
          X(of.sw[0] + ra * (c * fr.x[0] + sn * fr.y[0])).toFixed(1) +
          " " +
          Y(of.sw[1] + ra * (c * fr.x[1] + sn * fr.y[1])).toFixed(1);
      }
      el(g, "path", {
        d: d,
        fill: "none",
        stroke: "#8a8a8a",
        "stroke-width": 1,
        "pointer-events": "none",
      });
    }
    el(g, "line", {
      x1: sx,
      y1: sy,
      x2: ex,
      y2: ey,
      stroke: blue,
      "stroke-width": 3.5,
      "stroke-linecap": "round",
      "pointer-events": "none",
    });
    const side = uy > 0.2 || (Math.abs(uy) <= 0.2 && ux < 0) ? -1 : 1,
      lx = (sx + ex) / 2 + uy * 14 * side,
      ly = (sy + ey) / 2 - ux * 14 * side;
    el(
      g,
      "text",
      {
        x: lx,
        y: ly + 3,
        "text-anchor": "middle",
        class: "t1 lab",
        "pointer-events": "none",
      },
      f(P.len, 1) + " mm | " + f(S.ang, 1) + "°",
    );
    el(
      g,
      "text",
      {
        x: sx - ux * 24,
        y: sy - uy * 16 + 3,
        "text-anchor": "middle",
        class: "lab",
        "pointer-events": "none",
      },
      "start",
    );
    const he = el(g, "g", { style: "cursor:grab" });
    el(he, "circle", { cx: ex, cy: ey, r: 11, fill: "transparent" });
    el(he, "circle", {
      cx: ex,
      cy: ey,
      r: 5,
      fill: blue,
      stroke: "#1d1d1d",
      "stroke-width": 1.5,
    });
    he.addEventListener("pointerdown", (e) => pvStart("turn", e));
    const hs = el(g, "g", { style: "cursor:grab" });
    el(hs, "circle", { cx: sx, cy: sy, r: 11, fill: "transparent" });
    el(hs, "circle", {
      cx: sx,
      cy: sy,
      r: 5.5,
      fill: "#f2f2f2",
      stroke: blue,
      "stroke-width": 2,
    });
    hs.addEventListener("pointerdown", (e) => pvStart("start", e));
    $("capP").textContent =
      "Top view in robot axes. Drag the white point to place the start of the bead and the blue point to turn it. Wheel to zoom, drag the background to pan, double click to fit. The dashed outline joins the outer touches.";
    const fm = S.reg === "frame",
      z3 = (v) => (Math.abs(v) < 0.0005 ? 0 : v).toFixed(3),
      row3 = (n, v) => n.padEnd(7) + v.map((q) => z3(q).padStart(11)).join("");
    $("progNote").textContent = fm
      ? "Offset in the user frame of the plate. Enter that frame in Setup, Frames, User Frame, select it, and teach P[1] with it active."
      : "Offset in robot axes. Valid while W, P, R of the active user frame are zero.";
    $("progTxt").textContent = [
      "PR[1]=LPOS-LPOS ;",
      "PR[1,1]=" + z3(of.o[0]) + " ;",
      "PR[1,2]=" + z3(of.o[1]) + " ;",
      "PR[1,3]=" + z3(of.o[2]) + " ;",
      "L P[1] 100mm/sec FINE ;",
      "L P[1] " + P.ts.toFixed(1) + "inch/min FINE Offset,PR[1] ;",
    ].join("\n");
    $("coordNote").textContent =
      (fm
        ? "In the user frame of the plate, wire tip at the tip gap above the plate."
        : "In robot axes, wire tip at the height of the touches.") +
      " Jog the tip to Start and teach P[1] there. End is where the move stops.";
    $("coordTxt").textContent = [
      "       " + ["X", "Y", "Z"].map((a) => a.padStart(11)).join(""),
      row3("Start", of.s),
      row3("End", of.e),
      row3("Offset", of.o),
    ]
      .concat(
        fm
          ? [
              "",
              "User frame of the plate",
              "X " +
                f(fr.o[0], 3) +
                "  Y " +
                f(fr.o[1], 3) +
                "  Z " +
                f(fr.o[2], 3),
              "W " +
                f(fr.wpr[0], 3) +
                "  P " +
                f(fr.wpr[1], 3) +
                "  R " +
                f(fr.wpr[2], 3),
            ]
          : [],
      )
      .join("\n");
    const R = [fr.x, fr.y, fr.z],
      row = (i) =>
        [R[0][i], R[1][i], R[2][i]].map((v) => f(v, 5).padStart(9)).join(" ") +
        " " +
        f(fr.o[i], 3).padStart(10);
    $("matTxt").textContent = [
      row(0),
      row(1),
      row(2),
      "  0.00000   0.00000   0.00000      1.000",
    ].join("\n");
  }

  /* ================= workspace, status bar, keys ================= */
  let ctx = "3d";
  const CTXN = {
    "3d": "3D Viewport",
    graphs: "Graphs",
    plate: "Plate and robot frame",
  };
  function setCtx(c) {
    ctx = c;
    $("pane3d").hidden = c !== "3d";
    $("paneGraphs").hidden = c !== "graphs";
    $("panePlate").hidden = c !== "plate";
    $("ctx3d").setAttribute("aria-pressed", c === "3d");
    $("ctxGraphs").setAttribute("aria-pressed", c === "graphs");
    $("ctxPlate").setAttribute("aria-pressed", c === "plate");
    $("ctxName").textContent = CTXN[c];
    if (c === "plate") $("tabRobot").click();
    setStatus(curCtxStatus());
    dirty = true;
  }
  $("ctx3d").addEventListener("click", () => setCtx("3d"));
  $("ctxGraphs").addEventListener("click", () => setCtx("graphs"));
  $("ctxPlate").addEventListener("click", () => setCtx("plate"));
  const K = (t) => "<kbd>" + t + "</kbd>",
    MS = (c) => '<span class="mouse ' + c + '"></span>',
    H = (keys, txt) => '<span class="hint">' + keys + " " + txt + "</span>";
  const STATUS = {
    view:
      H(MS("l"), "Rotate") +
      H(K("Shift") + MS("l"), "Pan") +
      H(MS("w"), "Zoom") +
      H(K("Z"), "Polygons") +
      H(K("Home"), "Frame bead") +
      H(K("1") + K("3") + K("7"), "Side, end, top") +
      H(K("Space"), "Play"),
    graphs:
      H(MS("l"), "Read a value") +
      H(K("←") + K("→"), "Step frame") +
      H(K("Space"), "Play") +
      H(K("N"), "Sidebar"),
    plate:
      H(MS("l"), "Drag the white point to place the bead") +
      H(MS("l"), "Drag the blue point to turn it") +
      H(K("Shift"), "Fine step") +
      H(MS("w"), "Zoom") +
      H(K("N"), "Sidebar"),
    field:
      H(K("Enter"), "Confirm") +
      H(K("Esc"), "Cancel") +
      H(K("↑") + K("↓"), "Step") +
      H(K("Shift") + K("↑"), "Step ×10") +
      H(K("Tab"), "Next field"),
    time:
      H(MS("l"), "Scrub") +
      H(K("←") + K("→"), "Step frame") +
      H(K("Shift") + K("←"), "Jump to start") +
      H(K("Shift") + K("→"), "Jump to end") +
      H(K("Space"), "Play"),
    giz:
      H(MS("l"), "Click an axis to look along it") +
      H(MS("l"), "Drag to rotate"),
    side:
      H(MS("l"), "Edit a value") +
      H(MS("l"), "Drag a header to reorder") +
      H(K("Alt") + K("↑") + K("↓"), "Move panel") +
      H(K("Tab"), "Next field") +
      H(K("N"), "Sidebar"),
  };
  function curCtxStatus() {
    return ctx === "3d" ? "view" : ctx;
  }
  function setStatus(k) {
    $("status").innerHTML =
      STATUS[k] +
      '<span class="right">WAAM Bead Planner 1.5 | works offline</span>';
  }
  [
    ["pane3d", "view"],
    ["paneGraphs", "graphs"],
    ["panePlate", "plate"],
    ["tl", "time"],
    ["gizmo", "giz"],
    ["side", "side"],
  ].forEach((a) => {
    $(a[0]).addEventListener("pointerenter", () => {
      if (
        !(document.activeElement && document.activeElement.tagName === "INPUT")
      )
        setStatus(a[1]);
    });
  });
  $("gizmo").addEventListener("pointerleave", () => setStatus("view"));
  document.addEventListener("keydown", (e) => {
    const tg = e.target.tagName;
    if (
      tg === "INPUT" ||
      tg === "SELECT" ||
      tg === "TEXTAREA" ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    const k = e.key;
    if (k === " ") {
      e.preventDefault();
      play.on ? stopPlay() : startPlay();
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      setFrame(e.shiftKey ? S.start : Math.round(S.frame) - 1);
    } else if (k === "ArrowRight") {
      e.preventDefault();
      setFrame(e.shiftKey ? S.end : Math.round(S.frame) + 1);
    } else if (k === "Home") {
      e.preventDefault();
      frameBead();
    } else if (k === "z" || k === "Z") {
      S.show.poly = !S.show.poly;
      refresh();
    } else if (k === "n" || k === "N") {
      $("side").hidden = !$("side").hidden;
      setTimeout(() => {
        drawRuler();
        dirty = true;
      }, 0);
    } else if (k === "1") {
      cam.pol = Math.PI / 2;
      cam.az = Math.PI;
      hudView("Side, from + Y");
      dirty = true;
    } else if (k === "3") {
      cam.pol = Math.PI / 2;
      cam.az = Math.PI / 2;
      hudView("Along the bead, from the end");
      dirty = true;
    } else if (k === "7") {
      cam.pol = 0.03;
      cam.az = 0;
      hudView("Top");
      dirty = true;
    }
  });

  /* ================= start ================= */
  try {
    if (!window.THREE) throw 0;
    initGL();
  } catch (e) {
    R3 = null;
    $("nogl").hidden = false;
    $("gizmo").hidden = true;
  }
  compute();
  setStatus("view");
  requestAnimationFrame(loop);
})();
