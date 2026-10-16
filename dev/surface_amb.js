// ORPHEUS · surface ambience harness — stand-in AudioEngine subset, offline level/spectrum report, lifecycle checks, live listening UI.
//   /dev/surface_amb.html                         UI: pick biome/site, drag the `st` sliders, Start (audio needs a click), Stop / Dispose
//   /dev/surface_amb.html?run=quick               offline smoke test of every site (6 s each)
//   /dev/surface_amb.html?run=suite[&case=cocytus/wailing]   level + spectrum suite (calm / typical / max / sweep / indoors)
//   /dev/surface_amb.html?run=life                lifecycle / robustness checks
// Offline runs pre-schedule the whole timeline against a simulated clock (ctx.currentTime is read through a proxy), then render once.
// Debug handle: window.__amb = { runCase(biome, site, scen, dur), runSuite(filter), quick(), lifecycle(), rumbleTest(), howlTest(),
//   trace(biome, site, scen, {dur, bin, hp, lp}), updateProbe(biome, site, scen, dur), renderRaw/renderOne({…, once, chunk, noVerb, stopAt}), bufStats(), live }
import { createAmbience } from '../src/world/terrain/ambience.js';
import { SITES } from '../src/world/terrain/sites.js';

const SR = 48000, TAU = Math.PI * 2;
const Q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const outEl = $('out');
const print = (...a) => { const s = a.join(' '); if (outEl) outEl.textContent += s + '\n'; console.log(s); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
const pdb = (p) => 10 * Math.log10(Math.max(p, 1e-18));

// ───────────── deterministic Math.random for reproducible renders ─────────────
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seedRandom(seed) { const orig = Math.random; Math.random = mulberry32(seed); return () => { Math.random = orig; }; }
function captureWarn() { const orig = console.warn, got = []; console.warn = (...a) => { got.push(a.map(String).join(' ')); orig.apply(console, a); }; return { got, restore() { console.warn = orig; } }; }

// ───────────── stand-in for the AudioEngine subset used by the ambience (copied from src/core.js `class AudioEngine`) ─────────────
class StandInAudio {
  constructor(c) {
    this.ctx = c; this.ready = false;
    const G = (v, dst) => { const g = c.createGain(); g.gain.value = v; if (dst) g.connect(dst); return g; };
    this.G = G;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 3.5; this.comp.attack.value = 0.004; this.comp.release.value = 0.25;
    this.master = G(0.85); this.master.connect(this.comp); this.comp.connect(c.destination);
    this.sfx = G(1, this.master); this.radio = G(0.9, this.master);
    this.verb = c.createConvolver(); this.verb.buffer = this.impulse(3.2, 2.4);
    this.verbIn = G(1); this.verbIn.connect(this.verb); this.verb.connect(G(0.42, this.master));
    this.white = this.noise('white', 4); this.pink = this.noise('pink', 6); this.brown = this.noise('brown', 6);
    this.ready = true;
  }
  impulse(dur, decay) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n; lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - t, decay) * (i < 90 ? i / 90 : 1); } }
    return b;
  }
  noise(kind, sec) {
    const c = this.ctx, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w;
        else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
        else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
      const fade = 2048; for (let i = 0; i < fade; i++) { const t = i / fade; d[i] *= t; d[n - 1 - i] *= t; }
    }
    return b;
  }
  src(buf, rate = 1) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.loopStart = Math.random() * 0.5; s.start(0, Math.random() * buf.duration); return s; }
  bq(type, f, q = 0.7, gain = 0) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.gain.value = gain; return b; }
  osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; }
  env(node, t, a, peak, d, hold = 0) { node.gain.cancelScheduledValues(t); node.gain.setValueAtTime(0.0001, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.setValueAtTime(peak, t + a + hold); node.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d); }
  oneShotNoise(filterType, f, q, peak, a, d, pan = 0, verb = 0.3, buf = this.white, rate = 1) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const fl = this.bq(filterType, f, q); const g = c.createGain(); const p = c.createStereoPanner(); p.pan.value = pan;
    s.connect(fl); fl.connect(g); g.connect(p); p.connect(this.sfx); if (verb) { const vs = c.createGain(); vs.gain.value = verb; p.connect(vs); vs.connect(this.verbIn); }
    this.env(g, t, a, peak, d); s.start(t, Math.random() * 2); s.stop(t + a + d + 0.1);
    return fl;
  }
  tone(f, dur, type = 'sine', peak = 0.08, bus = this.sfx, delay = 0, f2 = null) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    o.connect(g); g.connect(bus); this.env(g, t, 0.006, peak, dur); o.start(t); o.stop(t + dur + 0.05);
  }
}

// ───────────── instrumentation: node creation / disconnect / stop / automation counters ─────────────
const TR = { disconnected: new WeakSet(), stopped: new WeakSet(), auto: 0 };
(function patch() {
  const d0 = AudioNode.prototype.disconnect; AudioNode.prototype.disconnect = function (...a) { TR.disconnected.add(this); return d0.apply(this, a); };
  const s0 = AudioScheduledSourceNode.prototype.stop; AudioScheduledSourceNode.prototype.stop = function (...a) { TR.stopped.add(this); return s0.apply(this, a); };
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues', 'setValueCurveAtTime']) {
    const o = AudioParam.prototype[m]; AudioParam.prototype[m] = function (...a) { TR.auto++; return o.apply(this, a); };
  }
})();

/** stand-in engine on `c`; the ambience gets a tracking proxy of the context (creation counting, forced `state`, optional simulated clock). */
function makeRig(c, { state = 'running' } = {}) {
  const audio = new StandInAudio(c);               // built on the raw context → not counted as ambience nodes
  const created = new Set(), cfg = { state, clock: null };
  audio.ctx = new Proxy(c, {
    get(t, p) {
      if (p === 'state' && cfg.state) return cfg.state;
      if (p === 'currentTime' && cfg.clock !== null) return cfg.clock;   // offline runs pre-schedule the whole timeline against this clock
      const v = t[p];
      if (typeof v !== 'function') return v;
      if (typeof p === 'string' && p.startsWith('create')) return (...a) => { const r = v.apply(t, a); if (r instanceof AudioNode) created.add(r); return r; };
      return v.bind(t);
    },
  });
  return { audio, created, cfg, raw: c };
}
function releaseReport(rig) {
  let notDisc = 0, notStop = 0;
  for (const n of rig.created) { if (!TR.disconnected.has(n)) notDisc++; if (n instanceof AudioScheduledSourceNode && !TR.stopped.has(n)) notStop++; }
  return { total: rig.created.size, notDisc, notStop };
}

// ───────────── scenarios (the `st` the surface module would feed) ─────────────
const CASES = [['asphodel', 'meadow'], ['asphodel', 'shore'], ['phlegethon', 'ridge'], ['phlegethon', 'forge'], ['charon', 'sentinel'], ['charon', 'ferryman'], ['cocytus', 'wailing'], ['cocytus', 'lake'], ['elysium', 'camp'], ['elysium', 'garden']];
const TYP = { 'asphodel/shore': { shore: 0.8 }, 'phlegethon/ridge': { lava: 0.55 }, 'phlegethon/forge': { lava: 0.5 }, 'cocytus/wailing': { gey: 0.8 }, 'cocytus/lake': { gey: 0.12 }, 'elysium/camp': { crystal: 0.3 }, 'elysium/garden': { crystal: 0.9 } };
const typicalSt = (biome, site, t) => {
  const def = SITES[biome][site], k = TYP[biome + '/' + site] || {}, tt = t % 18, pulse = tt > 3 && tt < 9 ? Math.sin(Math.PI * (tt - 3) / 6) : 0;   // a 6 s eruption every 18 s
  return { wind: def.wind, geyser: (k.gey || 0) * pulse, lava: k.lava || 0, crystal: k.crystal || 0, shore: k.shore || 0, speed: 1.4, indoors: 0, sunUp: 0.7 };
};
const SCEN = {
  calm: () => () => ({ wind: 0.15, geyser: 0, lava: 0, crystal: 0, shore: 0, speed: 0, indoors: 0, sunUp: 1 }),
  typical: (b, s) => (t) => typicalSt(b, s, t),
  max: () => () => ({ wind: 1, geyser: 1, lava: 1, crystal: 1, shore: 1, speed: 6, indoors: 0, sunUp: 1 }),
  sweep: () => (t) => { const w = (P, ph) => 0.5 + 0.5 * Math.sin(TAU * t / P + ph); return { wind: w(13, 0), geyser: Math.max(0, w(17, 1) * 1.6 - 0.6), lava: w(23, 2), crystal: w(29, 3), shore: w(11, 4), speed: 6 * w(7, 5), indoors: 0, sunUp: w(41, 6) }; },
  indoors: (b, s) => (t) => ({ ...typicalSt(b, s, t), indoors: 1 }),
};
const DUR = { calm: 20, typical: 30, max: 20, sweep: 48, indoors: 16 };

// ───────────── analysis ─────────────
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h, vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
/** Welch mean-square spectrum (Hann, 50 % overlap), averaged over channels; Σ bins = mean square. */
function psd(chs, i0, i1, N = 8192) {
  const w = new Float64Array(N); let sw2 = 0;
  for (let i = 0; i < N; i++) { w[i] = 0.5 - 0.5 * Math.cos(TAU * i / N); sw2 += w[i] * w[i]; }
  const P = new Float64Array(N / 2 + 1), re = new Float64Array(N), im = new Float64Array(N); let nw = 0;
  for (const x of chs) for (let s = i0; s + N <= i1; s += N / 2) {
    for (let i = 0; i < N; i++) { re[i] = x[s + i] * w[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k <= N / 2; k++) { const p = (re[k] * re[k] + im[k] * im[k]) / (N * sw2); P[k] += k === 0 || k === N / 2 ? p : 2 * p; }
    nw++;
  }
  for (let k = 0; k <= N / 2; k++) P[k] /= Math.max(1, nw);
  return P;
}
const aw = (f) => { const f2 = f * f; return 1.2589 * (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)); };
const BE = [20, 60, 120, 250, 500, 1000, 2000, 4000, 8000, 20000];
/** impulsiveness: max |2nd difference| / rms(2nd difference). Gaussian-ish noise ≈ 5; a click or a hard step ≫ 10. */
function clickScore(L, R, i0, i1) {
  let s = 0, n = 0, mx = 0, at = 0;
  for (const x of [L, R]) for (let i = i0 + 1; i < i1 - 1; i++) { const d = x[i + 1] - 2 * x[i] + x[i - 1]; s += d * d; n++; const a = d < 0 ? -d : d; if (a > mx) { mx = a; at = i / SR; } }
  return { ratio: mx / Math.max(Math.sqrt(s / Math.max(1, n)), 1e-12), at };
}
function analyze(L, R, i0, i1) {
  let s = 0, pk = 0;
  for (let i = i0; i < i1; i++) { const a = L[i], b = R[i]; s += a * a + b * b; const m = Math.max(Math.abs(a), Math.abs(b)); if (m > pk) pk = m; }
  const win = [];
  for (let i = i0; i + SR <= i1; i += SR) { let w = 0; for (let j = i; j < i + SR; j++) w += L[j] * L[j] + R[j] * R[j]; win.push(db(Math.sqrt(w / (2 * SR)))); }
  const N = 8192, P = psd([L, R], i0, i1, N), bh = SR / N, bands = new Array(BE.length - 1).fill(0);
  let tot = 0, cen = 0, A = 0, sp = 0;
  for (let k = 1; k <= N / 2; k++) {
    const f = k * bh, p = P[k]; if (f < 20) continue;
    tot += p; cen += f * p; A += p * aw(f) ** 2; if (f >= 300 && f < 3400) sp += p;
    for (let b = 0; b < bands.length; b++) if (f >= BE[b] && f < BE[b + 1]) { bands[b] += p; break; }
  }
  const ck = clickScore(L, R, i0, i1);
  return { rms: db(Math.sqrt(s / (2 * (i1 - i0)))), peak: db(pk), rmsA: pdb(A), speech: pdb(sp), centroid: cen / Math.max(tot, 1e-18), bands: bands.map(pdb), winMin: win.length ? Math.min(...win) : NaN, winMax: win.length ? Math.max(...win) : NaN, click: ck.ratio, clickAt: ck.at };
}
const winDb = (L, R, t0, t1) => { const i0 = Math.max(0, Math.floor(t0 * SR)), i1 = Math.min(L.length, Math.floor(t1 * SR)); let s = 0; for (let i = i0; i < i1; i++) s += L[i] * L[i] + R[i] * R[i]; return db(Math.sqrt(s / (2 * Math.max(1, i1 - i0)))); };

// ───────────── offline render of one scenario ─────────────
// The ambience reads ctx.currentTime through the rig proxy, so the whole run is simulated synchronously at `fps`
// (clock = k/fps → every update() schedules exactly as it would live) and then rendered in ONE startRendering() pass.
// Ambience timers (stop()/dispose() de-click) are held until the render is done so they cannot cut the graph mid-render.
async function renderRaw(o) {
  const { biome, siteId, st, dur = 20, fps = 60, seed = 7, stopAt = null, stopSec = 1.2, rumble = null, tail = 0 } = o;
  const restore = seedRandom(seed), w = captureWarn(), realST = window.setTimeout, realCT = window.clearTimeout, held = [];
  window.setTimeout = (fn) => { held.push(fn); return -held.length; }; window.clearTimeout = () => {};
  try {
    const off = new OfflineAudioContext(2, Math.ceil(SR * (dur + tail)), SR);
    const rig = makeRig(off); rig.cfg.clock = 0; if (o.noVerb) rig.audio.verbIn = null;
    const amb = createAmbience({ audio: rig.audio }, { bodyId: biome, siteId, biome });
    const dt = 1 / fps, N = o.once ? 1 : Math.floor(dur * fps), stats = { upd: 0, sum: 0, max: 0, errs: 0, created0: -1, lastErr: '' };
    let stopFired = false;
    const call = (t) => {
      rig.cfg.clock = t;
      const p0 = performance.now();
      try { if (rumble) amb.rumble(rumble(t)); amb.update(dt, st(t)); } catch (e) { stats.errs++; stats.lastErr = String(e && e.stack || e); }
      const d = performance.now() - p0; stats.upd++; stats.sum += d; if (d > stats.max) stats.max = d;
      if (stats.created0 < 0 && rig.created.size > 0) stats.created0 = rig.created.size;
      if (stopAt != null && !stopFired && t >= stopAt) { stopFired = true; amb.stop(stopSec); }
    };
    amb.start();
    if (o.chunk) {                                   // schedule `chunk` seconds at a time from suspend() points → short param timelines, like live
      const per = Math.round(o.chunk * fps);
      for (let k = 0; k < per && k < N; k++) call(k * dt);
      for (let c = 1; c * o.chunk < dur; c++) {
        const tc = Math.round(c * o.chunk * SR / 128) * 128 / SR;
        off.suspend(tc).then(() => { for (let k = 0; k < per; k++) { const t = c * o.chunk + k * dt; if (t < dur) call(t); } off.resume(); }, () => { stats.errs++; });
      }
    } else for (let k = 0; k < N; k++) call(k * dt);
    const buf = await off.startRendering();
    stats.createdEnd = rig.created.size; stats.nodes = stats.created0;
    window.setTimeout = realST; window.clearTimeout = realCT; for (const fn of held.splice(0)) fn();
    return { L: buf.getChannelData(0), R: buf.getChannelData(1), stats, warns: w.got.slice(), rig, amb };
  } finally { window.setTimeout = realST; window.clearTimeout = realCT; restore(); w.restore(); }
}
async function renderOne(o) {
  const skip = o.skip ?? 5, dur = o.dur ?? 20, end = o.stopAt != null ? o.stopAt : dur + (o.tail || 0);
  const r = await renderRaw(o), a = analyze(r.L, r.R, Math.floor(skip * SR), Math.floor(end * SR)), s = r.stats;
  const rec = { case: o.biome + '/' + o.siteId, scen: o.scen || '', dur, ...a, nodes: s.nodes, created: s.createdEnd - s.created0, updAvg: 1000 * s.sum / Math.max(1, s.upd), updMax: 1000 * s.max, errs: s.errs, lastErr: s.lastErr, warns: r.warns };
  rec.fadeIn = [0.25, 0.5, 1, 1.5, 2, 3, 4].map((t) => +winDb(r.L, r.R, t - 0.125, t + 0.125).toFixed(1));
  if (o.stopAt != null) rec.fadeOut = [0.25, 0.5, 0.75, 1, 1.2].map((t) => +winDb(r.L, r.R, o.stopAt + t - 0.125, o.stopAt + t + 0.125).toFixed(1));
  return { rec, raw: r };
}
const f1 = (x) => (x >= 0 ? ' ' : '') + x.toFixed(1);
const fmt = (r) => `${r.case.padEnd(18)} ${r.scen.padEnd(8)} rms ${f1(r.rms)}  A ${f1(r.rmsA)}  speech ${f1(r.speech)}  peak ${f1(r.peak)}  cent ${String(Math.round(r.centroid)).padStart(5)}Hz  win ${f1(r.winMin)}…${f1(r.winMax)}  bands ${r.bands.map((b) => b.toFixed(0).padStart(4)).join('')}  clk ${r.click.toFixed(0)}  nodes ${r.nodes}  +${r.created}  upd ${r.updAvg.toFixed(0)}/${r.updMax.toFixed(0)}µs${r.errs ? '  ERRS ' + r.errs + ' ' + r.lastErr : ''}${r.warns.length ? '  WARN ' + r.warns[0] : ''}`;

const results = [];
async function runCase(biome, siteId, scen, dur) {
  const { rec } = await renderOne({ biome, siteId, scen, st: SCEN[scen](biome, siteId), dur: dur ?? DUR[scen] });
  results.push(rec); print(fmt(rec)); return rec;
}
async function runSuite(filter) {
  print(`bands (dBFS ms): ${BE.slice(0, -1).map((f, i) => `${f}-${BE[i + 1]}`).join(' | ')}`);
  for (const [b, s] of CASES) {
    if (filter && !(b + '/' + s).includes(filter)) continue;
    for (const sc of Object.keys(SCEN)) await runCase(b, s, sc);
  }
  return results;
}
async function quick() {
  const out = [];
  for (const [b, s] of CASES) { const { rec } = await renderOne({ biome: b, siteId: s, scen: 'typical', st: SCEN.typical(b, s), dur: 6, skip: 3 }); print(fmt(rec)); out.push(rec); }
  return out;
}
/** main-thread cost of update(): runs the frame loop only (no audio rendering) against a simulated clock and reports the duration distribution */
function updateProbe(biome, siteId, scen = 'typical', dur = 40, fps = 60) {
  const restore = seedRandom(5), w = captureWarn(), realST = window.setTimeout, realCT = window.clearTimeout;
  window.setTimeout = () => -1; window.clearTimeout = () => {};
  try {
    const off = new OfflineAudioContext(2, SR, SR), rig = makeRig(off); rig.cfg.clock = 0;
    const amb = createAmbience({ audio: rig.audio }, { bodyId: biome, siteId, biome }), st = SCEN[scen](biome, siteId), dt = 1 / fps, N = Math.floor(dur * fps), d = [];
    amb.start();
    for (let k = 0; k < N; k++) { const t = k * dt; rig.cfg.clock = t; const p0 = performance.now(); amb.update(dt, st(t)); d.push(performance.now() - p0); }
    const s = d.slice().sort((a, b) => a - b), q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    const slow = []; d.forEach((v, i) => { if (v > 2) slow.push(`${(i * dt).toFixed(2)}s:${v.toFixed(1)}ms`); });
    return { n: N, avgUs: Math.round(1000 * d.reduce((a, v) => a + v, 0) / N), p50Us: Math.round(1000 * q(0.5)), p99Us: Math.round(1000 * q(0.99)), maxMs: +s[s.length - 1].toFixed(2), over2ms: slow.length, slow: slow.slice(0, 8), warns: w.got.length, nodes: rig.created.size };
  } finally { window.setTimeout = realST; window.clearTimeout = realCT; restore(); w.restore(); }
}
/** take-off rumble: calm site, rumble 0 → 1 over 4–6 s; reports levels before / at full rumble. */
async function rumbleTest(biome = 'asphodel', siteId = 'meadow') {
  const { rec, raw } = await renderOne({ biome, siteId, scen: 'rumble', st: SCEN.calm(), dur: 16, skip: 2, rumble: (t) => clamp((t - 4) / 2, 0, 1) });
  const before = analyze(raw.L, raw.R, Math.floor(2 * SR), Math.floor(4 * SR)), after = analyze(raw.L, raw.R, Math.floor(8 * SR), Math.floor(16 * SR));
  print(`rumble ${biome}/${siteId}: before ${f1(before.rms)} dBFS  full ${f1(after.rms)} dBFS (A ${f1(after.rmsA)})  peak ${f1(after.peak)}  centroid ${Math.round(after.centroid)} Hz  bands ${after.bands.map((b) => b.toFixed(0).padStart(4)).join('')}  warns ${rec.warns.length}`);
  return { before, after, rec };
}

// ───────────── diagnostics: level traces, formant sweep, live-loop timing ─────────────
const SPARK = '▁▂▃▄▅▆▇█';
function traceDb(L, R, binSec, t0, t1) {
  const n = Math.floor(binSec * SR), out = [];
  for (let i = Math.floor(t0 * SR); i + n <= Math.floor(t1 * SR); i += n) { let s = 0; for (let j = i; j < i + n; j++) s += L[j] * L[j] + R[j] * R[j]; out.push(db(Math.sqrt(s / (2 * n)))); }
  return out;
}
const spark = (a) => { const lo = Math.min(...a), hi = Math.max(...a); return a.map((v) => SPARK[Math.min(7, Math.floor((v - lo) / Math.max(1e-6, hi - lo) * 8))]).join(''); };
/** RBJ 2nd-order Butterworth high-/low-pass (offline JS copy) for isolating event bands in a render */
function biq(x, type, f) {
  const w0 = TAU * f / SR, c = Math.cos(w0), al = Math.sin(w0) / (2 * Math.SQRT1_2), a0 = 1 + al, a1 = -2 * c / a0, a2 = (1 - al) / a0;
  const b0 = (type === 'hp' ? (1 + c) : (1 - c)) / 2 / a0, b1 = (type === 'hp' ? -(1 + c) : (1 - c)) / a0, y = new Float32Array(x.length);
  let z1 = 0, z2 = 0; for (let i = 0; i < x.length; i++) { const v = x[i], o = b0 * v + z1; z1 = b1 * v - a1 * o + z2; z2 = b0 * v - a2 * o; y[i] = o; } return y;
}
/** level trace of a scenario: one spark char per `binSec` + min/max/mean dB. o: { dur, bin, t0, hp, lp (Hz) } */
async function trace(biome, siteId, scen, o = {}) {
  const dur = o.dur ?? 40, binSec = o.bin ?? 0.25, t0 = o.t0 ?? 4;
  const st = typeof scen === 'function' ? scen : SCEN[scen](biome, siteId);
  const r = await renderRaw({ biome, siteId, st, dur, rumble: o.rumble || null });
  let L = r.L, R = r.R; if (o.hp) { L = biq(L, 'hp', o.hp); R = biq(R, 'hp', o.hp); } if (o.lp) { L = biq(L, 'lp', o.lp); R = biq(R, 'lp', o.lp); }
  const tr = traceDb(L, R, binSec, t0, dur), mean = db(Math.sqrt(tr.reduce((a, v) => a + Math.pow(10, v / 10), 0) / tr.length));
  print(`${biome}/${siteId} ${typeof scen === 'string' ? scen : 'custom'}${o.hp ? ' hp' + o.hp : ''}${o.lp ? ' lp' + o.lp : ''}  ${binSec}s bins  min ${Math.min(...tr).toFixed(1)} max ${Math.max(...tr).toFixed(1)} mean ${mean.toFixed(1)} dB\n${spark(tr)}`);
  return { tr, raw: r };
}
/** dominant spectral peaks per window inside [f0,f1] (Hz) — shows the wail formants sweeping */
function peaksPerWindow(L, R, t0, t1, win, bands) {
  const N = 32768, out = [];
  for (let t = t0; t + win <= t1; t += win) {
    const i0 = Math.floor(t * SR), P = psd([L, R], i0, i0 + Math.floor(win * SR), N), row = [t.toFixed(0) + 's'];
    for (const [f0, f1] of bands) { let bi = 0, bv = -1; for (let k = Math.ceil(f0 * N / SR); k <= Math.floor(f1 * N / SR); k++) if (P[k] > bv) { bv = P[k]; bi = k; } row.push(`${(bi * SR / N).toFixed(0)}Hz/${pdb(bv * N / 32).toFixed(0)}`); }
    out.push(row.join('  '));
  }
  return out;
}
async function howlTest(biome = 'cocytus', siteId = 'lake', wind = 0.9) {
  const r = await renderRaw({ biome, siteId, st: () => ({ wind, geyser: 0, lava: 0, crystal: 0, shore: 0, speed: 0, indoors: 0, sunUp: 1 }), dur: 70 });
  const lines = peaksPerWindow(r.L, r.R, 6, 70, 4, [[300, 650], [650, 1300], [1800, 3300]]);
  print(`howl formant peaks (wind ${wind}) [F1 300-650 | F2 650-1300 | F3 1800-3300]:\n` + lines.join('\n')); return lines;
}

// ───────────── lifecycle / robustness ─────────────
async function lifecycle() {
  const res = [], st0 = { wind: 0.5, geyser: 0.2, lava: 0.5, crystal: 0.5, shore: 0.5, speed: 1, indoors: 0, sunUp: 1 };
  const T = (name, ok, detail = '') => { res.push({ name, ok: !!ok, detail }); print(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
  const mk = (biome, site, state = 'running') => { const off = new OfflineAudioContext(2, SR, SR), rig = makeRig(off, { state }), host = { audio: rig.audio }; return { rig, host, amb: createAmbience(host, { bodyId: biome, siteId: site, biome }) }; };
  const upd = (amb, n, st = st0) => { for (let i = 0; i < n; i++) amb.update(1 / 60, st); };
  const restore = seedRandom(3), w = captureWarn();
  try {
    // 1 · audio not ready → nothing built, nothing thrown; retried from update() once it is
    { let err = null; const { rig, host, amb } = mk('cocytus', 'wailing');
      const saved = rig.audio.ctx; host.audio = { ready: false, ctx: null };
      try { amb.start(); upd(amb, 30); amb.rumble(0.5); } catch (e) { err = e; }
      T('not-ready (ctx null): no throw, no nodes', !err && rig.created.size === 0);
      host.audio = { ready: true, ctx: null }; try { upd(amb, 5); } catch (e) { err = e; }
      T('ready but ctx null: no throw, no nodes', !err && rig.created.size === 0);
      rig.audio.ready = false; rig.audio.ctx = saved; host.audio = rig.audio; try { upd(amb, 5); } catch (e) { err = e; }
      T('ctx present but audio.ready=false: no nodes', !err && rig.created.size === 0);
      rig.audio.ready = true; upd(amb, 3);
      T('engine comes up later → built from update()', !err && rig.created.size > 20, `${rig.created.size} nodes`);
      amb.dispose(); await sleep(150); }
    // 2 · suspended context at call time: graph builds, but no scheduling piles up; resumes cleanly
    { const { rig, amb } = mk('phlegethon', 'ridge', 'suspended'); let err = null;
      try { amb.start(); upd(amb, 3); } catch (e) { err = e; }
      const a0 = TR.auto, n0 = rig.created.size; try { upd(amb, 300); amb.rumble(0.8); } catch (e) { err = e; }
      T('suspended: built, no throw', !err && n0 > 20, `${n0} nodes`);
      T('suspended: no automation piles up over 300 updates', TR.auto === a0, `Δ=${TR.auto - a0}`);
      rig.cfg.state = 'running'; const a1 = TR.auto; upd(amb, 20);
      T('resumed: updates schedule again', TR.auto > a1, `Δ=${TR.auto - a1}`);
      rig.cfg.state = 'suspended'; const t0 = performance.now(); await amb.stop(2);
      const r = releaseReport(rig);
      T('stop() on a suspended context resolves immediately and releases nodes', performance.now() - t0 < 100 && r.notDisc === 0 && r.notStop === 0, `${(performance.now() - t0).toFixed(0)} ms, ${r.total} nodes, undisconnected ${r.notDisc}, running ${r.notStop}`); }
    // 3 · stop(): fades then resolves, every node stopped + disconnected
    for (const [b, s] of [['asphodel', 'shore'], ['phlegethon', 'forge'], ['charon', 'sentinel'], ['cocytus', 'wailing'], ['elysium', 'garden']]) {
      const { rig, amb } = mk(b, s); amb.start(); upd(amb, 10); amb.rumble(0.6); upd(amb, 10);
      const t0 = performance.now(); await amb.stop(0.3); const dt = performance.now() - t0, r = releaseReport(rig);
      T(`stop(0.3) ${b}/${s}: resolves ≈ fade, releases all nodes`, dt >= 280 && dt < 3000 && r.notDisc === 0 && r.notStop === 0 && r.total > 20, `${dt.toFixed(0)} ms, ${r.total} nodes, undisconnected ${r.notDisc}, running ${r.notStop}`);
      let err = null; try { upd(amb, 5); amb.start && 0; await amb.stop(0.1); amb.rumble(0.2); } catch (e) { err = e; }
      T(`  …update / stop / rumble after stop: no throw, no rebuild`, !err && releaseReport(rig).total === r.total);
    }
    // 4 · dispose(): hard stop, then everything is a no-op
    { const { rig, amb } = mk('elysium', 'camp'); amb.start(); upd(amb, 10); amb.dispose(); await sleep(250); const r = releaseReport(rig); let err = null;
      try { amb.dispose(); amb.update(0.016, st0); amb.start(); amb.rumble(1); await amb.stop(0.1); upd(amb, 3); } catch (e) { err = e; }
      T('dispose(): nodes released, later calls are no-ops', !err && r.notDisc === 0 && r.notStop === 0 && releaseReport(rig).total === r.total, `${r.total} nodes, undisconnected ${r.notDisc}, running ${r.notStop}`); }
    // 5 · garbage state objects
    { const { rig, amb } = mk('cocytus', 'lake'); let err = null; amb.start();
      try { for (const s of [undefined, null, {}, { wind: 'x', lava: NaN, speed: Infinity, geyser: -4, crystal: 99, shore: {}, indoors: [], sunUp: null }, 5, 'str']) { amb.update(0.016, s); amb.update(NaN, s); amb.update(-1, s); amb.update(1e9, s); } amb.rumble(NaN); amb.rumble('a'); amb.rumble(7); amb.rumble(-3); amb.rumble(undefined); } catch (e) { err = e; }
      T('garbage dt / st / rumble: no throw, no warning', !err && !w.got.length, err ? String(err) : w.got[0] || `${rig.created.size} nodes`); amb.dispose(); await sleep(120); }
    // 6 · restart after stop
    { const { rig, amb } = mk('asphodel', 'meadow'); amb.start(); upd(amb, 5); await amb.stop(0.1); const n0 = rig.created.size; amb.start(); upd(amb, 5);
      T('start() after stop() rebuilds the graph', rig.created.size > n0, `${n0} → ${rig.created.size}`); amb.dispose(); await sleep(150);
      const r = releaseReport(rig); T('  …and dispose() releases both generations', r.notDisc === 0 && r.notStop === 0, `undisconnected ${r.notDisc}, running ${r.notStop}`); }
    // 7 · stop() before anything was built, rumble before start
    { const { rig, host, amb } = mk('charon', 'ferryman'); const saved = host.audio; host.audio = { ready: false, ctx: null }; amb.start(); const t0 = performance.now(); await amb.stop(2.5);
      T('stop() with nothing built resolves immediately', performance.now() - t0 < 50 && rig.created.size === 0);
      const b2 = mk('charon', 'ferryman'); b2.amb.rumble(0.7); b2.amb.start(); upd(b2.amb, 5);
      T('rumble() before start() is remembered and applied after the build', b2.rig.created.size > 20); b2.amb.dispose(); await sleep(150); void saved; }
    // 8 · start() during a pending stop swims back up (nothing torn down)
    { const { rig, amb } = mk('asphodel', 'shore'); amb.start(); upd(amb, 5); const p = amb.stop(0.6); await sleep(100); amb.start(); const t0 = performance.now(); await p; const dt1 = performance.now() - t0; await sleep(800);
      const r = releaseReport(rig); T('start() during stop(): the pending promise resolves at once', dt1 < 300, `${dt1.toFixed(0)} ms`);
      T('  …and the graph stays alive past the old stop timer', r.notDisc === r.total && r.total > 20, `${r.total - r.notDisc}/${r.total} nodes disconnected`); amb.dispose(); await sleep(150); }
    // 9 · unknown biome
    { const { rig, amb } = mk('nowhere', 'x'); let err = null; try { amb.start(); upd(amb, 10); amb.rumble(1); await amb.stop(0.1); amb.dispose(); } catch (e) { err = e; }
      T('unknown biome: silent, no throw', !err && rig.created.size === 0); }
    T('no [ambience] warnings during lifecycle checks', !w.got.some((x) => x.includes('[ambience]')), w.got[0] || '');
  } finally { restore(); w.restore(); }
  const bad = res.filter((r) => !r.ok); print(`lifecycle: ${res.length - bad.length}/${res.length} passed`);
  return res;
}

// ───────────── calibration probe: levels of the engine's noise buffers + the flutter modulator ─────────────
function bufStats() {
  const restore = seedRandom(11);
  try {
    const off = new OfflineAudioContext(2, SR, SR), a = new StandInAudio(off), out = {};
    for (const k of ['white', 'pink', 'brown']) { const d = a[k].getChannelData(0); let s = 0; for (let i = 4096; i < d.length - 4096; i++) s += d[i] * d[i]; out[k] = +db(Math.sqrt(s / (d.length - 8192))).toFixed(2); }
    // brown → 2nd-order Butterworth low-pass at 7 Hz (what K.flutterCV uses): rms before the ×depth gain
    const d = a.brown.getChannelData(0), w0 = TAU * 7 / SR, c = Math.cos(w0), al = Math.sin(w0) / (2 * Math.SQRT1_2), a0 = 1 + al;
    const b0 = (1 - c) / 2 / a0, b1 = (1 - c) / a0, a1 = -2 * c / a0, a2 = (1 - al) / a0; let z1 = 0, z2 = 0, s = 0, n = 0;
    for (let i = 0; i < d.length; i++) { const x = d[i], y = b0 * x + z1; z1 = b1 * x - a1 * y + z2; z2 = b0 * x - a2 * y; if (i > SR) { s += y * y; n++; } }
    out.flutterRms = +Math.sqrt(s / n).toFixed(4);
    print('noise buffers rms dBFS:', JSON.stringify(out)); return out;
  } finally { restore(); }
}

// ───────────── live listening UI ─────────────
const live = { ctx: null, rig: null, amb: null, timer: 0, an: null, buf: null, last: 0, meterAt: 0, t0: 0, perf: null };
const SLIDERS = [['wind', 0, 1, 0.01, 0.4], ['geyser', 0, 1, 0.01, 0], ['lava', 0, 1, 0.01, 0.5], ['crystal', 0, 1, 0.01, 0.5], ['shore', 0, 1, 0.01, 0], ['speed', 0, 8, 0.1, 0], ['indoors', 0, 1, 0.01, 0], ['sunUp', 0, 1, 0.01, 1], ['rumble', 0, 1, 0.01, 0]];
const biomeSel = $('biome'), siteSel = $('site'), slWrap = $('sliders'), sl = {};
for (const b of Object.keys(SITES)) biomeSel.add(new Option(b, b));
const fillSites = () => { siteSel.innerHTML = ''; for (const s of Object.keys(SITES[biomeSel.value])) siteSel.add(new Option(s, s)); const d = SITES[biomeSel.value][siteSel.value]; if (d && sl.wind) { sl.wind.value = d.wind; sl.wind.dispatchEvent(new Event('input')); } };
for (const [k, lo, hi, step, v] of SLIDERS) {
  const lab = document.createElement('label'), nm = document.createElement('span'), inp = document.createElement('input'), o = document.createElement('output');
  nm.textContent = k; inp.type = 'range'; inp.min = lo; inp.max = hi; inp.step = step; inp.value = v; o.textContent = (+v).toFixed(2);
  inp.addEventListener('input', () => { o.textContent = (+inp.value).toFixed(2); }); lab.append(nm, inp, o); slWrap.append(lab); sl[k] = inp;
}
const readUi = () => ({ wind: +sl.wind.value, geyser: +sl.geyser.value, lava: +sl.lava.value, crystal: +sl.crystal.value, shore: +sl.shore.value, speed: +sl.speed.value, indoors: +sl.indoors.value, sunUp: +sl.sunUp.value });
async function liveStart() {
  liveDispose();
  const AC = window.AudioContext || window.webkitAudioContext, c = live.ctx || (live.ctx = new AC({ latencyHint: 'interactive' }));
  try { await c.resume(); } catch (e) { print('resume failed:', e); }
  live.rig = makeRig(c, { state: null });
  live.an = c.createAnalyser(); live.an.fftSize = 2048; live.rig.audio.comp.connect(live.an); live.buf = new Float32Array(2048);
  live.amb = createAmbience({ audio: live.rig.audio }, { bodyId: biomeSel.value, siteId: siteSel.value, biome: biomeSel.value });
  live.amb.start(); live.last = performance.now(); live.t0 = c.currentTime; live.perf = { n: 0, sum: 0, max: 0, b05: 0, b1: 0, b4: 0, b16: 0, state: c.state, trace: [] };
  live.timer = setInterval(() => {                          // timer, not rAF: keeps ticking in hidden / automated tabs
    const ms = performance.now(), dt = Math.min(0.1, (ms - live.last) / 1000); live.last = ms;
    if (live.amb) {
      const st = readUi(), rv = +sl.rumble.value, p0 = performance.now();   // only rumble() + update() are timed (not the UI reads)
      live.amb.rumble(rv); live.amb.update(dt, st); const d = performance.now() - p0;
      const p = live.perf; p.n++; p.sum += d; if (d > p.max) p.max = d; if (d > 0.5) p.b05++; if (d > 1) p.b1++; if (d > 4) p.b4++; if (d > 16) p.b16++; p.state = c.state; p.avgUs = 1000 * p.sum / p.n;
    }
    if (live.an && ms - live.meterAt > 250) {
      live.meterAt = ms; live.an.getFloatTimeDomainData(live.buf); let s = 0; for (let i = 0; i < live.buf.length; i++) s += live.buf[i] * live.buf[i];
      const lv = db(Math.sqrt(s / live.buf.length)); $('meter').textContent = `${live.ctx.state} · out ${lv.toFixed(1)} dBFS`; live.perf.out = lv;
      if (live.perf.trace.length < 120) live.perf.trace.push([+(live.ctx.currentTime - live.t0).toFixed(2), +lv.toFixed(1)]);
    }
  }, 16);
}
function liveDispose() { clearInterval(live.timer); if (live.amb) live.amb.dispose(); live.amb = null; if (live.an) { try { live.an.disconnect(); } catch (e) { /* gone */ } } live.an = null; }
biomeSel.addEventListener('change', () => { fillSites(); if (live.amb) liveStart(); });
siteSel.addEventListener('change', () => { if (live.amb) liveStart(); });
$('bStart').onclick = () => liveStart();
$('bStop').onclick = async () => { if (live.amb) { const a = live.amb, t0 = performance.now(); live.perf.stopAt = live.ctx.currentTime - live.t0; await a.stop(2.5); live.perf.stopMs = performance.now() - t0; print(`stopped (promise resolved after ${live.perf.stopMs.toFixed(0)} ms)`); if (live.amb === a) { clearInterval(live.timer); live.amb = null; } } };
$('bDispose').onclick = () => liveDispose();
$('bQuick').onclick = () => quick();
$('bSuite').onclick = () => runSuite(biomeSel.value + '/' + siteSel.value);
$('bLife').onclick = () => lifecycle();
const q = Q.get('biome'); if (q && SITES[q]) biomeSel.value = q;
fillSites(); const qs = Q.get('site'); if (qs && SITES[biomeSel.value][qs]) siteSel.value = qs;

window.__amb = { runCase, runSuite, quick, lifecycle, rumbleTest, bufStats, renderOne, renderRaw, analyze, trace, howlTest, updateProbe, results, CASES, SCEN, TR, live };

const run = Q.get('run');
if (run) (async () => {
  try {
    if (run === 'quick') await quick(); else if (run === 'life') await lifecycle(); else if (run === 'suite') await runSuite(Q.get('case')); else if (run === 'noise') bufStats();
  } catch (e) { print('HARNESS ERROR', e && e.stack || e); }
  document.title = 'amb:done';
})();
