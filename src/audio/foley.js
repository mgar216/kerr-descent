// ORPHEUS foley — everything is synthesised, nothing is loaded.
//
// Percussive material hits (footsteps, landings) are rendered ONCE per AudioContext into AudioBuffers by a small JS DSP
// kit (modal resonators + filtered noise + grains + pitch-dropping thuds); playback only picks a variant and randomises
// rate / gain / pan / brightness, so a footstep costs two or three Web Audio nodes. Swept and continuous sounds (doors,
// airlock, harness, breathing, thrusters) are plain Web Audio node graphs.
//
// All output goes to ctx.audio.sfx (+ ctx.audio.verbIn sends) and every call is a no-op until ctx.audio.ready.
//
//   const foley = createFoley(ctx);          // idempotent per ctx
//   foley.step('metal', 1) · land(mat, v) · jump(mat) · crouch(down)
//   foley.door(open) · airlock('cycle'|'open'|'close') → seconds · buckle() · unbuckle()
//   foley.beep(kind) · breath(rate) · thruster(on, amt) · bump(v) · tether(v) · hum(on, level)
//   foley.update(dt)  (breath scheduler — call every frame while breathing) · foley.warm() · foley.stopAll()

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const MATERIALS = ['metal', 'grate', 'rock', 'sand', 'ice', 'snow', 'crystal'];

// ───────────────────────────────────────── DSP kit (offline, JS) ─────────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashSeed(s, n) { let h = 2166136261 ^ n; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

// RBJ biquad (bp = constant 0 dB peak). Returns normalised [b0,b1,b2,a1,a2].
function coefs(type, f, q, sr) {
  const w = (TAU * Math.min(f, sr * 0.45)) / sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al;
  return [b0 / a0, b1 / a0, b2 / a0, (-2 * c) / a0, (1 - al) / a0];
}
function runBiquad(x, c) {
  let z1 = 0, z2 = 0;
  const b0 = c[0], b1 = c[1], b2 = c[2], a1 = c[3], a2 = c[4];
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + z1; z1 = b1 * v - a1 * y + z2; z2 = b2 * v - a2 * y; x[i] = y; }
}
function filteredNoise(n, r, sr, chain) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = r() * 2 - 1;
  for (const [t, f, q] of chain) runBiquad(a, coefs(t, f, q || 0.707, sr));
  return a;
}
function rms(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length)) || 1e-9; }

// K = { sr, r, out }. All times in seconds, amp is "peak-ish".
// Filtered-noise burst with linear attack `a` and exponential decay constant `tau`.
function burst(K, t0, dur, amp, a, tau, chain) {
  const { sr, r, out } = K, i0 = (t0 * sr) | 0;
  if (i0 >= out.length) return;
  const n = Math.max(16, (dur * sr) | 0), seg = filteredNoise(n, r, sr, chain);
  const g = amp / (rms(seg) * 3.2), ia = Math.max(1, (a * sr) | 0), dk = Math.exp(-1 / (tau * sr));
  let e = 1;
  for (let i = 0, end = Math.min(n, out.length - i0); i < end; i++) { out[i0 + i] += seg[i] * g * (i < ia ? i / ia : e); if (i >= ia) e *= dk; }
}
// Decaying modal sine (T60 = time to −60 dB), rotation recurrence.
function ping(K, t0, f, amp, t60, phase = 0) {
  const { sr, out } = K, i0 = (t0 * sr) | 0;
  if (i0 >= out.length || f >= sr * 0.48) return;
  const w = (TAU * f) / sr, cr = Math.cos(w), ci = Math.sin(w), dk = Math.exp(-6.9078 / (t60 * sr)), att = Math.max(2, (0.0004 * sr) | 0);
  const n = Math.min(out.length - i0, (t60 * sr * 1.15) | 0);
  let re = Math.cos(phase), im = Math.sin(phase), a = amp;
  for (let i = 0; i < n; i++) { out[i0 + i] += im * a * (i < att ? i / att : 1); const nr = re * cr - im * ci; im = re * ci + im * cr; re = nr; a *= dk; }
}
// Pitch-dropping sine (boot / body impact).
function thud(K, t0, f0, f1, amp, tau, dur) {
  const { sr, out } = K, i0 = (t0 * sr) | 0;
  if (i0 >= out.length) return;
  const n = Math.min(out.length - i0, (dur * sr) | 0), dk = Math.exp(-1 / (tau * sr)), sk = Math.exp(-1 / (0.03 * sr));
  let ph = 0, e = 1, fs = f0 - f1;
  for (let i = 0; i < n; i++) { ph += (TAU * (f1 + fs)) / sr; fs *= sk; out[i0 + i] += Math.sin(ph) * amp * e * (i < 24 ? i / 24 : 1); e *= dk; }
}
// Exponential glide sine with a smooth envelope (squeaks).
function chirp(K, t0, f0, f1, amp, dur) {
  const { sr, out } = K, i0 = (t0 * sr) | 0;
  if (i0 >= out.length) return;
  const n = Math.min(out.length - i0, (dur * sr) | 0);
  let ph = 0;
  for (let i = 0; i < n; i++) { const u = i / n; ph += (TAU * f0 * Math.pow(f1 / f0, u)) / sr; const s = Math.sin(Math.PI * u); out[i0 + i] += Math.sin(ph) * amp * s * s; }
}
// Granular texture: `count` tiny windows lifted from one filtered noise bed, denser towards t0 (curve > 1).
function grains(K, t0, span, count, amp, chain, msRange, curve = 1.5) {
  const { sr, r, out } = K, bed = filteredNoise((sr * 0.4) | 0, r, sr, chain), g0 = amp / (rms(bed) * 3);
  for (let k = 0; k < count; k++) {
    const i0 = ((t0 + span * Math.pow(r(), curve)) * sr) | 0, len = Math.max(8, ((msRange[0] + (msRange[1] - msRange[0]) * r()) * 0.001 * sr) | 0);
    if (i0 + len >= out.length) continue;
    const off = (r() * (bed.length - len)) | 0, ga = g0 * (0.3 + 0.7 * r());
    for (let i = 0; i < len; i++) { const w = Math.sin((Math.PI * i) / len); out[i0 + i] += bed[off + i] * w * w * ga; }
  }
}
function finish(out, sr, peak = 0.92) {
  const f = (0.05 * sr) | 0;
  for (let i = 0; i < f; i++) out[out.length - 1 - i] *= i / f; // fade tail
  let m = 0; for (let i = 0; i < out.length; i++) { const v = Math.abs(out[i]); if (v > m) m = v; }
  if (m > 0) { const g = peak / m; for (let i = 0; i < out.length; i++) out[i] *= g; }
}

// ─────────────────────────── per-material strike recipes: (K, t, gain, toe?, heavy?) ───────────────────────────
// heel strikes carry the body thump; toe strikes are the lighter second contact; heavy = two-footed landing.
// Plate-like inharmonic ring: every partial gets a slightly detuned twin so the tail beats and shimmers instead of ringing like a bell.
function plate(K, t, base, amp, t60, ratios) {
  const { r } = K;
  ratios.forEach((m, i) => {
    const f = base * m * (0.992 + 0.016 * r()), a = amp / (1 + i * 0.65), d = t60 / (1 + i * 0.45);
    ping(K, t + 0.0007 * i, f, a, d);
    ping(K, t + 0.0007 * i, f * (1.004 + 0.008 * r()), a * 0.55, d * 0.85, r() * TAU);
  });
}
const MAT = {
  // deck plating over a hollow structure: sharp contact tick, sole "tock", pitch-dropping panel boom, beating inharmonic plate ring
  metal(K, t, g, toe, heavy) {
    const { r } = K, R = (a, b) => a + (b - a) * r();
    burst(K, t, 0.03, (toe ? 0.55 : 0.9) * g, 0.0002, 0.0022, [['bp', R(2600, 3600), 0.5], ['hp', 1100, 0.7]]);
    burst(K, t, 0.14, (toe ? 0.55 : 0.85) * g, 0.0006, 0.013, [['bp', R(650, 950), 0.9]]);
    if (toe) thud(K, t, R(150, 180), R(90, 105), 0.25 * g, 0.03, 0.2);
    else { thud(K, t, R(120, 145), R(66, 82), (heavy ? 1.1 : 0.8) * g, 0.065, 0.45); ping(K, t, R(180, 225), 0.26 * g, 0.2); }
    plate(K, t, R(500, 740), (toe ? 0.2 : 0.4) * g * (heavy ? 1.25 : 1), (toe ? 0.12 : 0.3) * (heavy ? 1.4 : 1), [1, 1.58, 2.21, 2.87, 3.74]);
  },
  // open steel grating: thinner, brighter, loose bars rattling, little boom
  grate(K, t, g, toe, heavy) {
    const { r } = K, R = (a, b) => a + (b - a) * r();
    burst(K, t, 0.03, (toe ? 0.5 : 0.75) * g, 0.0002, 0.002, [['bp', R(3200, 4600), 0.5], ['hp', 1500, 0.7]]);
    burst(K, t, 0.1, (toe ? 0.35 : 0.6) * g, 0.0006, 0.012, [['bp', R(1100, 1600), 1.2]]);
    thud(K, t, R(150, 180), R(95, 110), (toe ? 0.15 : 0.35) * g * (heavy ? 1.3 : 1), 0.04, 0.25);
    plate(K, t, R(900, 1300), (toe ? 0.3 : 0.55) * g, 0.12, [1, 1.47, 2.09, 2.76]);
    const n = (R(6, 11) * (heavy ? 1.6 : 1)) | 0;
    for (let k = 0; k < n; k++) ping(K, t + 0.012 + Math.pow(r(), 1.3) * 0.26, R(1500, 4800), R(0.1, 0.24) * g * (heavy ? 1.3 : 1), R(0.025, 0.06)); // loose bars
    ping(K, t, R(170, 210), 0.12 * g, 0.12); // cavity under the grating
  },
  // dry stone: grit, crack, dull tock, skittering pebbles
  rock(K, t, g, toe, heavy) {
    const { r } = K, R = (a, b) => a + (b - a) * r();
    burst(K, t, 0.06, (toe ? 0.5 : 0.85) * g, 0.0005, 0.02, [['bp', R(1000, 1800), 0.7]]);
    burst(K, t, 0.05, (toe ? 0.5 : 0.8) * g, 0.0003, 0.006, [['hp', 2600, 0.7]]);
    thud(K, t, R(190, 230), R(110, 140), (toe ? 0.15 : 0.4) * g * (heavy ? 1.3 : 1), 0.035, 0.2);
    burst(K, t, 0.15, (toe ? 0.3 : 0.45) * g, 0.001, 0.04, [['lp', 420, 0.7]]);
    const n = (R(4, 9) * (heavy ? 1.7 : 1)) | 0;
    for (let k = 0; k < n; k++) ping(K, t + 0.008 + Math.pow(r(), 1.5) * 0.16, R(1800, 5600), R(0.06, 0.16) * g, R(0.006, 0.016));
    ping(K, t, R(320, 480), 0.12 * g, 0.05);
  },
  // soft thud + granular hiss; the toe is a longer slide
  sand(K, t, g, toe, heavy) {
    const { r } = K, R = (a, b) => a + (b - a) * r();
    burst(K, t, 0.16, (toe ? 0.25 : 0.45) * g * (heavy ? 1.3 : 1), 0.003, 0.06, [['lp', R(210, 280), 0.7]]);
    burst(K, t, 0.42, (toe ? 0.8 : 0.7) * g, toe ? 0.03 : 0.012, toe ? 0.13 : 0.1, [['bp', R(2200, 3200), 0.5], ['lp', 6500, 0.7]]);
    grains(K, t, toe ? 0.3 : 0.22, (R(toe ? 12 : 16, toe ? 22 : 28) * (heavy ? 1.5 : 1)) | 0, (toe ? 0.2 : 0.25) * g, [['hp', 2800, 0.7], ['lp', 9000, 0.7]], [1, 3.5], 1.4);
  },
  // glassy crack, crisp crunch, micro-fractures, a thin-ice ring and the occasional squeak
  ice(K, t, g, toe, heavy) {
    const { r } = K, R = (a, b) => a + (b - a) * r();
    burst(K, t, 0.04, (toe ? 0.6 : 1.0) * g, 0.0002, 0.004, [['hp', R(3500, 4800), 0.7]]);
    burst(K, t, 0.1, (toe ? 0.4 : 0.7) * g, 0.0005, 0.02, [['bp', R(1600, 2400), 1.1]]);
    thud(K, t, R(110, 140), R(70, 90), (toe ? 0.1 : 0.22) * g * (heavy ? 1.3 : 1), 0.05, 0.2);
    const n = (R(6, 12) * (heavy ? 1.6 : 1)) | 0;
    for (let k = 0; k < n; k++) ping(K, t + Math.pow(r(), 1.3) * 0.09, R(4200, 7800), R(0.08, 0.18) * g, R(0.004, 0.01));
    ping(K, t, R(2800, 3800), (toe ? 0.08 : 0.14) * g, R(0.06, 0.12));
    if (r() < 0.45) chirp(K, t + 0.01, R(2000, 2600), R(1300, 1700), 0.06 * g, R(0.04, 0.08));
  },
  // muffled thump under a long fine-grained crunch
  snow(K, t, g, toe, heavy) {
    const { r } = K, R = (a, b) => a + (b - a) * r();
    burst(K, t, 0.22, (toe ? 0.3 : 0.5) * g * (heavy ? 1.3 : 1), 0.012, 0.09, [['lp', R(110, 150), 0.7]]);
    burst(K, t, 0.45, 0.75 * g, 0.025, 0.16, [['bp', R(1100, 1500), 0.5], ['lp', 3800, 0.7]]);
    grains(K, t + 0.01, 0.26, (R(20, 34) * (heavy ? 1.4 : 1)) | 0, 0.25 * g, [['bp', R(1800, 3200), 0.8]], [1.5, 5], 1.0);
    if (r() < 0.35) burst(K, t + 0.02, 0.14, 0.12 * g, 0.01, 0.06, [['bp', R(2600, 3400), 7]]);
  },
  // glass tick, soft body, then a ringing partial series on a pentatonic-ish root
  crystal(K, t, g, toe, heavy) {
    const { r } = K, R = (a, b) => a + (b - a) * r();
    burst(K, t, 0.02, (toe ? 0.5 : 0.8) * g, 0.0001, 0.0012, [['hp', 5500, 0.7]]);
    burst(K, t, 0.1, (toe ? 0.2 : 0.4) * g * (heavy ? 1.3 : 1), 0.001, 0.02, [['lp', 260, 0.7]]);
    const roots = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093, 2349], f = roots[(r() * roots.length) | 0] * R(0.995, 1.005), k = toe ? 0.55 : 1;
    [[1, 0.3, 0.62], [2.756, 0.16, 0.38], [5.404, 0.08, 0.22], [1.5, 0.14, 0.5]].forEach(([m, a, d]) => { ping(K, t + 0.001, f * m, a * g * k, d * (heavy ? 1.4 : 1)); ping(K, t + 0.001, f * m * (1.003 + 0.004 * r()), a * g * k * 0.4, d * 0.8 * (heavy ? 1.4 : 1)); });
    if (!toe) ping(K, t + 0.035, f * 1.5, 0.12 * g, 0.4);
  },
};

function synth(material, sr, seed, land) {
  const r = rng(seed), R = (a, b) => a + (b - a) * r();
  const K = { sr, r, out: new Float32Array(Math.ceil(sr * (land ? 1.2 : 0.72))) }, fn = MAT[material] || MAT.metal;
  if (land) {
    fn(K, 0, 1.0, false, true);
    fn(K, R(0.008, 0.026), 0.8, false, true);
    thud(K, 0, 82, 40, 0.45, 0.12, 0.5);                                   // body weight
    burst(K, 0.005, 0.45, 0.3, 0.02, 0.11, [['bp', 900, 0.6]]);            // gear / cloth
    for (let k = 0; k < 5; k++) ping(K, 0.02 + R(0, 0.14), R(2200, 5200), R(0.04, 0.09), R(0.01, 0.03)); // buckles & pouches
  } else {
    fn(K, 0, 1.0, false, false);
    fn(K, R(0.07, 0.115), 0.55, true, false);
    burst(K, 0, 0.12, 0.07, 0.004, 0.035, [['bp', 1400, 0.5]]);            // sole rub
  }
  finish(K.out, sr);
  return K.out;
}

// level (pre master-compressor, which swallows ~6 dB of short transients) and reverb send of each surface at intensity 1
const MAT_MIX = {
  metal: { g: 0.55, send: 0.20, landK: 1 }, grate: { g: 0.50, send: 0.18, landK: 1 }, rock: { g: 0.58, send: 0.07, landK: 1 }, sand: { g: 0.145, send: 0.03, landK: 2.3 },
  ice: { g: 0.48, send: 0.10, landK: 1 }, snow: { g: 0.135, send: 0.03, landK: 1.9 }, crystal: { g: 0.205, send: 0.30, landK: 1.4 },
};

const banks = new WeakMap(); // AudioContext → { noise:{}, mats:{}, suit }
function bankFor(ac) { let b = banks.get(ac); if (!b) { b = { noise: {}, mats: {}, suit: null }; banks.set(ac, b); } return b; }
function toBuffer(ac, arr) { const b = ac.createBuffer(1, arr.length, ac.sampleRate); b.getChannelData(0).set(arr); return b; }

function makeNoise(ac, kind, sec) {
  // generate n + f samples, then equal-power crossfade the surplus tail into the head so the buffer loops without a seam
  const n = (ac.sampleRate * sec) | 0, f = 4096, m = n + f, x = new Float32Array(m), r = rng(kind === 'white' ? 11 : kind === 'pink' ? 23 : 37);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < m; i++) {
    const w = r() * 2 - 1;
    if (kind === 'white') x[i] = w;
    else if (kind === 'pink') { b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; x[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    else { last = (last + 0.02 * w) / 1.02; x[i] = last * 3.5; }
  }
  const b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = x[i];
  for (let i = 0; i < f; i++) { const u = (i / f) * Math.PI * 0.5; d[i] = x[i] * Math.sin(u) + x[n + i] * Math.cos(u); }
  return b;
}

// ───────────────────────────────────────────────── factory ─────────────────────────────────────────────────
const cache = new WeakMap();

export function createFoley(ctx) {
  if (cache.has(ctx)) return cache.get(ctx);
  const foley = build(ctx);
  cache.set(ctx, foley);
  return foley;
}

function build(ctx) {
  const A = ctx.audio;
  const ok = () => !!(A && A.ready && A.ctx);
  const bus = () => A.sfx || A.master;
  const T = () => A.ctx.currentTime;
  const rnd = (a, b) => a + (b - a) * Math.random();
  let side = 1;

  const bk = () => bankFor(A.ctx);
  const noiseBuf = (kind) => { const b = bk(); return b.noise[kind] || (b.noise[kind] = makeNoise(A.ctx, kind, 4)); };
  const matBank = (m) => {
    const b = bk(); if (b.mats[m]) return b.mats[m];
    const ac = A.ctx, sr = ac.sampleRate, steps = [], lands = [];
    for (let v = 0; v < 5; v++) steps.push(toBuffer(ac, synth(m, sr, hashSeed(m, v), false)));
    for (let v = 0; v < 3; v++) lands.push(toBuffer(ac, synth(m, sr, hashSeed(m, 100 + v), true)));
    return (b.mats[m] = { steps, lands, last: -1 });
  };
  const norm = (m) => (MAT[m] ? m : 'metal');

  // voice output: gain → (pan) → sfx, plus a reverb send
  function out(pan = 0, send = 0.15, level = 1) {
    const c = A.ctx, g = c.createGain(); g.gain.value = level;
    let last = g;
    if (pan) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); last = p; }
    last.connect(bus());
    if (send > 0 && A.verbIn) { const s = c.createGain(); s.gain.value = send; last.connect(s); s.connect(A.verbIn); }
    return g;
  }
  // helmet-interior bus (short boxy reverb) for suit-borne sounds
  function suitBus() {
    const b = bk(); if (b.suit) return b.suit;
    const c = A.ctx, sr = c.sampleRate, n = (sr * 0.045) | 0, ir = c.createBuffer(1, n, sr), d = ir.getChannelData(0), r = rng(77);
    for (let i = 0; i < n; i++) { const t = i / sr; d[i] = (r() * 2 - 1) * Math.exp(-t / 0.011) * 0.5; }
    [0.0011, 0.0019, 0.0028, 0.0043].forEach((t, i) => { d[(t * sr) | 0] += 0.7 / (1 + i * 0.5); });
    const inp = c.createGain(), lp = c.createBiquadFilter(), dry = c.createGain(), wet = c.createGain(), conv = c.createConvolver();
    lp.type = 'lowpass'; lp.frequency.value = 6200; dry.gain.value = 0.7; wet.gain.value = 0.55; conv.buffer = ir;
    inp.connect(lp); lp.connect(dry); lp.connect(conv); conv.connect(wet); dry.connect(bus()); wet.connect(bus());
    if (A.verbIn) { const s = c.createGain(); s.gain.value = 0.06; wet.connect(s); s.connect(A.verbIn); }
    return (b.suit = inp);
  }

  // ── node helpers ──
  function env(g, t, peak, a, d, hold = 0) {
    const p = g.gain; p.cancelScheduledValues(t); p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    if (hold) p.setValueAtTime(Math.max(peak, 0.0002), t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  }
  function osc(type, f0, f1, t, peak, d, dst, a = 0.002) {
    const c = A.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    o.connect(g); g.connect(dst); env(g, t, peak, a, d); o.start(t); o.stop(t + a + d + 0.05);
  }
  function nburst(kind, t, o) { // filtered noise one-shot
    const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), buf = noiseBuf(kind), a = o.a ?? 0.003, d = o.d ?? 0.1, hold = o.hold || 0;
    s.buffer = buf; f.type = o.type || 'bandpass'; f.Q.value = o.q ?? 1; f.frequency.setValueAtTime(o.f ?? 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + a + hold + d);
    s.connect(f); f.connect(g); g.connect(o.out); env(g, t, o.peak ?? 0.1, a, d, hold);
    s.loop = true; s.start(t, Math.random() * buf.duration); s.stop(t + a + hold + d + 0.06);
  }
  function sweepVoice(type, f0, f1, t, dur, peak, lpf, dst, q = 1.5) { // servo-ish glide with a bell envelope
    const c = A.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.type = 'lowpass'; f.frequency.value = lpf; f.Q.value = q;
    const p = g.gain; p.setValueAtTime(0.0001, t); p.linearRampToValueAtTime(peak, t + Math.min(0.14, dur * 0.25)); p.setValueAtTime(peak, t + dur * 0.78); p.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(f); f.connect(g); g.connect(dst); o.start(t); o.stop(t + dur + 0.1);
  }

  // ── footsteps ──
  function play(buf, o) {
    const c = A.ctx, s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate;
    let node = s;
    if (o.lpf) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lpf; f.Q.value = 0.5; node.connect(f); node = f; }
    const g = out(o.pan, o.send, o.gain); node.connect(g); s.start(T() + 0.002);
  }
  function pick(m, kind) { const mb = matBank(m), arr = mb[kind]; let i; do i = (Math.random() * arr.length) | 0; while (i === mb.last && arr.length > 1); mb.last = i; return arr[i]; }

  const api = {
    // intensity ≈ 0.35 careful · 0.65 walk · 1 sprint
    step(material = 'metal', intensity = 1, opts) {
      if (!ok()) return;
      const m = norm(material), mix = MAT_MIX[m], k = clamp(intensity, 0.15, 1.5);
      side = -side;
      play(pick(m, 'steps'), { gain: mix.g * Math.pow(k, 1.15) * rnd(0.88, 1.1), rate: (0.95 + 0.1 * Math.min(k, 1.1)) * rnd(0.96, 1.04), pan: (opts && opts.pan != null ? opts.pan : side * 0.1) + rnd(-0.04, 0.04), send: mix.send * (opts && opts.send != null ? opts.send : 1), lpf: 1800 + 9500 * Math.min(k, 1) });
    },
    // v = impact speed m/s
    land(material = 'metal', v = 4) {
      if (!ok()) return;
      const m = norm(material), mix = MAT_MIX[m], k = clamp(v / 6, 0.3, 1.6);
      play(pick(m, 'lands'), { gain: mix.g * mix.landK * 1.55 * Math.pow(k, 0.9) * rnd(0.92, 1.08), rate: rnd(0.93, 1.03) * (1.05 - 0.12 * Math.min(k, 1.2)), pan: rnd(-0.05, 0.05), send: mix.send * 1.3, lpf: 2600 + 8000 * Math.min(k, 1) });
    },
    jump(material = 'metal') {
      if (!ok()) return;
      const m = norm(material), mix = MAT_MIX[m];
      play(pick(m, 'steps'), { gain: mix.g * 0.55 * rnd(0.9, 1.1), rate: rnd(1.04, 1.12), pan: rnd(-0.05, 0.05), send: mix.send, lpf: 4500 });
      const o = out(0, 0.05), t = T();
      nburst('pink', t, { type: 'bandpass', f: 1100, q: 0.6, peak: 0.035, a: 0.02, d: 0.16, out: o });
    },
    crouch(down = true) {
      if (!ok()) return;
      const o = out(0, 0.05), t = T();
      nburst('pink', t, { type: 'bandpass', f: down ? 800 : 1000, f2: down ? 500 : 1500, q: 0.7, peak: down ? 0.05 : 0.04, a: 0.03, d: 0.2, out: o });
      osc('sine', down ? 130 : 100, down ? 80 : 130, t, 0.04, 0.09, o);
    },

    // ── doors & airlock ──
    door(open = true) {
      if (!ok()) return 0;
      const c = A.ctx, o = out(0, 0.22), t = T() + 0.01, dur = open ? 0.62 : 0.72, t1 = t + 0.03;
      nburst('white', t, { type: 'bandpass', f: 2600, q: 6, peak: open ? 0.14 : 0.08, a: 0.001, d: 0.025, out: o });                                   // latch
      osc('square', 1500, 1500, t, 0.026, 0.03, o);
      nburst('white', t + 0.02, { type: 'bandpass', f: open ? 3800 : 2200, f2: open ? 1900 : 3400, q: 0.7, peak: open ? 0.13 : 0.08, a: 0.012, d: open ? 0.55 : 0.4, out: o }); // pneumatics
      sweepVoice('sawtooth', open ? 150 : 285, open ? 290 : 150, t1, dur, 0.042, 850, o, 2.2);                                                           // drive servo
      sweepVoice('square', open ? 225 : 428, open ? 435 : 225, t1, dur, 0.015, 1200, o, 1.2);
      nburst('pink', t1, { type: 'lowpass', f: 600, q: 0.7, peak: 0.06, a: 0.1, hold: dur * 0.6, d: 0.2, out: o });                                    // rubber slide
      const te = t1 + dur;
      if (open) { osc('sine', 95, 55, te, 0.26, 0.14, o); nburst('brown', te, { type: 'lowpass', f: 420, peak: 0.2, a: 0.002, d: 0.08, out: o }); osc('triangle', 1900, 1900, te + 0.01, 0.02, 0.06, o); }
      else {
        osc('sine', 78, 42, te, 0.3, 0.2, o); nburst('brown', te, { type: 'lowpass', f: 700, peak: 0.22, a: 0.002, d: 0.14, out: o });
        osc('triangle', 1650, 1650, te + 0.02, 0.03, 0.12, o); osc('triangle', 2480, 2480, te + 0.07, 0.025, 0.09, o);
        nburst('white', te + 0.01, { type: 'highpass', f: 2400, q: 0.7, peak: 0.05, a: 0.003, d: 0.22, out: o });
      }
      return dur + 0.2;
    },
    // returns the cycle length in seconds
    airlock(phase = 'cycle') {
      if (!ok()) return 0;
      const c = A.ctx, o = out(0, 0.3), t = T() + 0.02;
      if (phase === 'cycle') {
        const D = 6.4;
        osc('sine', 1100, 1100, t, 0.045, 0.09, o); osc('sine', 1480, 1480, t + 0.14, 0.045, 0.1, o);                                                   // start chirps
        sweepVoice('sawtooth', 52, 94, t + 0.4, 2.0, 0.05, 330, o, 3);                                                                                   // pump spin-up
        sweepVoice('sawtooth', 94, 88, t + 2.4, 3.2, 0.045, 300, o, 3); sweepVoice('sawtooth', 88, 55, t + 5.6, 0.7, 0.04, 280, o, 3);
        nburst('pink', t + 0.5, { type: 'bandpass', f: 500, f2: 1800, q: 0.7, peak: 0.1, a: 0.5, hold: 2.0, d: 0.2, out: o });                           // air in
        nburst('pink', t + 3.0, { type: 'bandpass', f: 1800, f2: 650, q: 0.7, peak: 0.09, a: 0.2, hold: 2.4, d: 0.8, out: o });                          // air out
        [1.2, 2.9, 4.6].forEach((tt, i) => { osc('square', 1700 + i * 180, 1700 + i * 180, t + tt, 0.02, 0.025, o); osc('sine', 120, 70, t + tt, 0.1, 0.09, o); }); // valves
        osc('sine', 880, 880, t + 6.0, 0.06, 0.3, o); osc('sine', 1320, 1320, t + 6.16, 0.06, 0.45, o);                                                // equalised chime
        nburst('white', t + 6.0, { type: 'highpass', f: 2000, q: 0.7, peak: 0.12, a: 0.005, d: 0.5, out: o });
        return D;
      }
      if (phase === 'open') {
        nburst('white', t, { type: 'bandpass', f: 2400, q: 6, peak: 0.12, a: 0.001, d: 0.03, out: o }); osc('square', 1300, 1300, t + 0.05, 0.02, 0.03, o);        // unlatch
        nburst('white', t + 0.12, { type: 'bandpass', f: 2600, f2: 1500, q: 0.7, peak: 0.15, a: 0.01, d: 0.9, out: o });                                  // pressure release
        sweepVoice('sawtooth', 70, 135, t + 0.25, 1.35, 0.04, 600, o, 2.5); sweepVoice('square', 105, 202, t + 0.25, 1.35, 0.012, 900, o, 1.2);
        osc('triangle', 380, 300, t + 0.5, 0.02, 0.6, o);                                                                                                 // hull creak
        osc('sine', 60, 36, t + 1.6, 0.34, 0.3, o); nburst('brown', t + 1.6, { type: 'lowpass', f: 500, peak: 0.2, a: 0.003, d: 0.2, out: o });
        return 1.9;
      }
      sweepVoice('sawtooth', 135, 70, t, 1.2, 0.04, 600, o, 2.5); sweepVoice('square', 202, 105, t, 1.2, 0.012, 900, o, 1.2);                                // close
      osc('sine', 56, 32, t + 1.25, 0.4, 0.32, o); nburst('brown', t + 1.25, { type: 'lowpass', f: 650, peak: 0.26, a: 0.003, d: 0.22, out: o });
      osc('triangle', 740, 740, t + 1.28, 0.03, 0.35, o); osc('triangle', 1110, 1110, t + 1.28, 0.02, 0.3, o);
      [1.45, 1.52, 1.59].forEach((tt, i) => osc('square', 1500 + i * 220, 1500 + i * 220, t + tt, 0.022, 0.02, o)); // lock ratchet
      nburst('white', t + 1.3, { type: 'highpass', f: 2200, q: 0.7, peak: 0.1, a: 0.004, d: 0.3, out: o });
      return 1.7;
    },

    // ── harness ──
    buckle() {
      if (!ok()) return;
      const o = out(0, 0.08), t = T() + 0.01;
      nburst('pink', t, { type: 'bandpass', f: 1400, q: 0.6, peak: 0.07, a: 0.05, d: 0.16, out: o });                                    // strap rustle
      nburst('white', t + 0.19, { type: 'bandpass', f: 3000, q: 4, peak: 0.12, a: 0.001, d: 0.03, out: o }); osc('sine', 2200, 2200, t + 0.19, 0.05, 0.05, o);   // click
      nburst('white', t + 0.235, { type: 'bandpass', f: 4200, q: 4, peak: 0.1, a: 0.001, d: 0.025, out: o }); osc('sine', 3100, 3100, t + 0.235, 0.04, 0.04, o); // clack
      osc('sine', 95, 58, t + 0.12, 0.12, 0.1, o); nburst('brown', t + 0.12, { type: 'lowpass', f: 300, peak: 0.08, a: 0.01, d: 0.12, out: o });            // body settles
    },
    unbuckle() {
      if (!ok()) return;
      const o = out(0, 0.08), t = T() + 0.01;
      nburst('white', t, { type: 'bandpass', f: 2800, q: 5, peak: 0.22, a: 0.001, d: 0.03, out: o }); osc('sine', 2600, 2600, t, 0.09, 0.05, o);              // release click
      nburst('white', t + 0.03, { type: 'bandpass', f: 2500, f2: 600, q: 1.2, peak: 0.05, a: 0.004, d: 0.09, out: o });                                    // spring
      nburst('pink', t + 0.12, { type: 'bandpass', f: 1000, f2: 1700, q: 0.6, peak: 0.06, a: 0.06, d: 0.25, out: o });                                     // strap slides
      osc('sine', 110, 70, t + 0.45, 0.07, 0.1, o);                                                                                                       // weight shifts
    },

    // ── console / UI beeps ──
    beep(kind = 'ok') {
      if (!ok()) return;
      const o = out(0, 0.2), t = T() + 0.005;
      switch (kind) {
        case 'click': osc('square', 1900, 1900, t, 0.05, 0.014, o); nburst('white', t, { type: 'highpass', f: 3000, peak: 0.08, a: 0.001, d: 0.012, out: o }); break;
        case 'light': // torch switch: crisp tick + dull body
          nburst('white', t, { type: 'bandpass', f: 2600, q: 3, peak: 0.22, a: 0.0008, d: 0.014, out: o }); osc('sine', 880, 700, t, 0.1, 0.025, o); osc('sine', 3300, 3300, t, 0.03, 0.014, o); break;
        case 'ok': case 'confirm': osc('triangle', 880, 880, t, 0.07, 0.08, o); osc('triangle', 1320, 1320, t + 0.08, 0.06, 0.14, o); break;
        case 'deny': osc('square', 180, 170, t, 0.055, 0.09, o); osc('square', 180, 170, t + 0.13, 0.055, 0.12, o); break;
        case 'warn': [0, 0.15, 0.3].forEach((d) => osc('triangle', 1040, 1040, t + d, 0.075, 0.09, o)); break;
        case 'alarm': [0, 0.2, 0.4].forEach((d) => { osc('square', 880, 880, t + d, 0.03, 0.15, o); osc('square', 660, 660, t + d + 0.1, 0.03, 0.1, o); }); break;
        case 'scan': osc('sine', 600, 2400, t, 0.045, 0.4, o); osc('sine', 1200, 4800, t, 0.015, 0.4, o); break;
        case 'chirp': osc('sine', 1700, 2300, t, 0.045, 0.06, o); break;
        case 'suit': [880, 740, 622].forEach((f, i) => osc('sine', f, f, t + i * 0.11, 0.04, 0.16, o)); break;
        case 'coffee': // galley machine: pump, gurgling brew, steam, finished-ding
          sweepVoice('sawtooth', 78, 128, t, 1.3, 0.03, 420, o, 2);
          nburst('pink', t + 0.15, { type: 'bandpass', f: 380, f2: 900, q: 1.4, peak: 0.07, a: 0.1, hold: 0.9, d: 0.35, out: o });
          nburst('white', t + 0.25, { type: 'highpass', f: 3200, q: 0.7, peak: 0.07, a: 0.08, hold: 0.5, d: 0.6, out: o });
          osc('sine', 1318.5, 1318.5, t + 1.55, 0.07, 0.6, o); osc('sine', 1975.5, 1975.5, t + 1.55, 0.03, 0.4, o); break;
        case 'terminal': for (let i = 0; i < 6; i++) osc('sine', rnd(1000, 2400), 0, t + i * 0.045, 0.03, 0.035, o); break;
        default: osc('triangle', 1200, 1200, t, 0.04, 0.08, o);
      }
    },

    // ── suit: breathing, thrusters, bumps, tether ──
    breath(rate = 1) {
      B.rate = rate;
      if (!rate) { B.next = 0; return; }
      if (!B.next && ok()) B.next = T() + 0.03;
    },
    // 0..1 — how "fogged" the visor is (exhale pulse), for the helmet overlay
    breathLevel() {
      if (!ok() || !B.win) return 0;
      const t = T(), [a, b] = B.win;
      if (t < a || t > b + 0.4) return 0;
      const u = (t - a) / (b - a);
      return u < 1 ? Math.sin(Math.PI * u) : Math.max(0, 1 - (u - 1) / 0.4) * 0.3;
    },
    thruster(on, amt = 1) {
      if (!ok()) return;
      const c = A.ctx, t = T();
      if (on && amt > 0.01) {
        if (!TH.n) {
          const dst = suitBus(), master = c.createGain(), gate = c.createGain(), hp = c.createBiquadFilter(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter();
          const sn = c.createBufferSource(), sb = c.createBufferSource(), rumble = c.createGain(), rlp = c.createBiquadFilter();
          sn.buffer = noiseBuf('white'); sn.loop = true; sb.buffer = noiseBuf('brown'); sb.loop = true;
          hp.type = 'highpass'; hp.frequency.value = 450; bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.8; lp.type = 'lowpass'; lp.frequency.value = 4800;
          rlp.type = 'lowpass'; rlp.frequency.value = 170; rumble.gain.value = 0.7; gate.gain.value = 0.7; master.gain.value = 0;
          const l1 = c.createOscillator(), l1g = c.createGain(), l2 = c.createOscillator(), l2g = c.createGain();
          l1.type = 'triangle'; l1.frequency.value = 17; l1g.gain.value = 0.22; l2.type = 'sine'; l2.frequency.value = 3.1; l2g.gain.value = 0.12;
          l1.connect(l1g); l1g.connect(gate.gain); l2.connect(l2g); l2g.connect(gate.gain);
          sn.connect(hp); hp.connect(bp); bp.connect(gate); gate.connect(lp); lp.connect(master); sb.connect(rlp); rlp.connect(rumble); rumble.connect(master); master.connect(dst);
          [sn, sb].forEach((s) => s.start(t, Math.random() * 1.5)); l1.start(t); l2.start(t);
          TH.n = { master, bp, srcs: [sn, sb, l1, l2] };
        }
        TH.n.master.gain.setTargetAtTime(0.085 * Math.pow(clamp(amt, 0, 1.5), 1.2), t, 0.04);
        TH.n.bp.frequency.setTargetAtTime(1700 + 1900 * clamp(amt, 0, 1.5), t, 0.05);
      } else if (TH.n) {
        const n = TH.n; TH.n = null;
        n.master.gain.setTargetAtTime(0, t, 0.05);
        n.srcs.forEach((s) => s.stop(t + 0.5));
      }
    },
    // suit/hull contact thump; v = closing speed m/s
    bump(v = 1) {
      if (!ok()) return;
      const o = out(rnd(-0.2, 0.2), 0.1), t = T(), k = clamp(v / 3, 0.2, 1.4);
      osc('sine', 120, 55, t, 0.22 * k, 0.12, o); nburst('brown', t, { type: 'lowpass', f: 420, peak: 0.22 * k, a: 0.002, d: 0.1, out: o });
      nburst('white', t, { type: 'bandpass', f: rnd(900, 1500), q: 2.5, peak: 0.07 * k, a: 0.001, d: 0.05, out: o });
      osc('sine', rnd(520, 760), 0, t, 0.025 * k, 0.16, o);
    },
    tether(v = 1) { // taut cable twang + tug on the harness
      if (!ok()) return;
      const o = out(0, 0.15), t = T(), k = clamp(v / 2, 0.3, 1.3);
      osc('sine', 98, 90, t, 0.18 * k, 0.5, o, 0.004); osc('sine', 196, 186, t, 0.07 * k, 0.4, o, 0.004); osc('triangle', 392, 380, t, 0.025 * k, 0.3, o, 0.004);
      nburst('brown', t, { type: 'lowpass', f: 320, peak: 0.16 * k, a: 0.004, d: 0.14, out: o });
    },
    // continuous electrical hum (terminals, consoles). level 0..1
    hum(on, level = 1) {
      if (!ok()) return;
      const c = A.ctx, t = T();
      if (on) {
        if (!HM.n) {
          const g = c.createGain(), lp = c.createBiquadFilter(), o1 = c.createOscillator(), o2 = c.createOscillator(), o3 = c.createOscillator();
          o1.type = 'sine'; o1.frequency.value = 100; o2.type = 'sine'; o2.frequency.value = 200.7; o3.type = 'triangle'; o3.frequency.value = 50.2;
          lp.type = 'lowpass'; lp.frequency.value = 500; g.gain.value = 0;
          const g2 = c.createGain(), g3 = c.createGain(); g2.gain.value = 0.35; g3.gain.value = 0.5;
          o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(lp); lp.connect(g); g.connect(out(0, 0.1));
          [o1, o2, o3].forEach((o) => o.start(t)); HM.n = { g, oscs: [o1, o2, o3] };
        }
        HM.n.g.gain.setTargetAtTime(0.012 * clamp(level, 0, 2), t, 0.25);
      } else if (HM.n) { const n = HM.n; HM.n = null; n.g.gain.setTargetAtTime(0, t, 0.2); n.oscs.forEach((o) => o.stop(t + 1.2)); }
    },

    update() {
      if (!B.rate || !ok()) return;
      const t = T();
      if (B.next && t + 0.04 >= B.next) breathCycle(Math.max(B.next, t + 0.01));
    },
    // render every material bank now (otherwise built lazily on first use). spread: one bank per timer tick, avoids a hitch.
    warm(spread = true) {
      if (!ok()) return;
      const list = MATERIALS.slice();
      const next = () => { const m = list.shift(); if (!m || !ok()) return; matBank(m); if (spread) setTimeout(next, 16); else next(); };
      next();
    },
    stopAll() { api.thruster(false); api.hum(false); api.breath(0); },
    get ready() { return ok(); },
  };

  // ── breathing scheduler ──
  const B = { rate: 0, next: 0, win: null };
  const TH = { n: null }, HM = { n: null };
  function breathCycle(t) {
    const c = A.ctx, dst = suitBus(), rate = clamp(B.rate, 0.3, 3), per = 4.4 / rate;
    const inD = per * 0.36, exD = per * 0.5, vol = 0.6 + 0.4 * Math.min(rate, 2);
    const mk = (kind, f0, f1, q, peak, a, d, t0) => {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), body = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noiseBuf(kind); f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t0); f.frequency.linearRampToValueAtTime(f1, t0 + a + d);
      body.type = 'peaking'; body.frequency.value = 260; body.Q.value = 1.2; body.gain.value = 6;
      s.connect(f); f.connect(body); body.connect(g); g.connect(dst);
      const p = g.gain; p.setValueAtTime(0.0001, t0); p.linearRampToValueAtTime(peak, t0 + a); p.linearRampToValueAtTime(peak * 0.7, t0 + a + d * 0.5); p.exponentialRampToValueAtTime(0.0001, t0 + a + d);
      s.loop = true; s.start(t0, Math.random() * 4); s.stop(t0 + a + d + 0.05);
    };
    // inhale: regulator valve tick + rising airy swell
    const vo = out(0, 0.04), vt = t;
    nburst('white', vt, { type: 'bandpass', f: 3200, q: 3, peak: 0.05 * vol, a: 0.001, d: 0.02, out: vo }); osc('sine', 90, 60, vt, 0.05 * vol, 0.06, vo);
    mk('pink', 700, 1500, 0.8, 0.16 * vol, inD * 0.45, inD * 0.65, t + 0.02);
    mk('white', 2600, 3400, 0.5, 0.035 * vol, inD * 0.3, inD * 0.5, t + 0.02);
    // exhale: heavier, falling
    const te = t + inD + 0.12;
    mk('pink', 1100, 480, 0.7, 0.19 * vol, exD * 0.2, exD * 0.85, te);
    mk('brown', 380, 220, 0.6, 0.14 * vol, exD * 0.2, exD * 0.9, te);
    B.win = [te, te + exD * 0.9];
    B.next = t + per * rnd(0.97, 1.04);
  }

  return api;
}
