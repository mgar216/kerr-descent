// ORPHEUS · surface ambience — procedural WebAudio soundscape for the landed-surface scene (one per landing).
//
//   const amb = createAmbience(ctx, { bodyId, siteId, biome });
//   amb.start();             // fade in (~3 s). Safe before audio exists: retried from update() until ctx.audio is ready.
//   amb.update(dt, st);      // every frame. st = { wind, geyser, lava, crystal, shore, speed, indoors, sunUp }
//   amb.rumble(level01);     // deep sub rumble for take-off (0 = off), smoothed
//   await amb.stop(2.5);     // fade out, stop + disconnect every node, resolve
//   amb.dispose();           // hard stop
//
// Everything is synthesised from ctx.audio's looping noise buffers + oscillators (nothing is loaded) and leaves through
// audio.sfx (dry) and — sparingly — audio.verbIn (reverb send) via one fade / "indoors" stage. The graph is built ONCE per
// start(); update() only retargets AudioParams (~20 Hz, change-detected setTargetAtTime) and fires sparse one-shot events on
// pooled voices — no node creation and no per-frame allocation after the build. Every entry point is guarded and never
// throws; a node failure disables the ambience (logged once as "[ambience]") instead of breaking the game loop.
//
// Audio-thread cost notes (measured in Chromium): every looping source / oscillator / biquad costs about the same (~0.1 % of a
// core); a source with playbackRate ≠ 1 or a biquad with an automated/modulated frequency costs 2–3× more; an ACTIVE
// ConvolverNode (the engine's 3.2 s reverb) costs ≫ everything else. Hence: all noise sources run at rate 1, filter params are
// only automated where the sound needs it (wail formants, a few events), and reverb sends exist only on sparse tonal / impact
// events (elysium chimes, cocytus cracks + pings) and are zeroed again after each event so the reverb can idle.
import { SITES } from './sites.js';

const TAU = Math.PI * 2;
const T60 = Math.log(1000);   // decay time (to −60 dB) → setTargetAtTime time constant: tc = t60 / T60
const PUSH = 0.05;            // AudioParam retarget period (s); setTargetAtTime smooths between pushes
const FADE_IN_TC = 0.7;       // two cascaded one-poles: S-shaped start, ≈ 97 % after 3 s

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + (b - a) * Math.random();
const num = (v, d) => (Number.isFinite(v) ? v : d);
const geo = (a, b, t) => a * Math.pow(b / a, t);
const pick = (a) => a[(Math.random() * a.length) | 0];
const expDraw = () => -Math.log(1 - Math.random());     // Exp(1): Poisson clocks (acc -= rate·dt; fire at ≤ 0)
const damp = (dt, tau) => 1 - Math.exp(-dt / tau);
const WHITE_RMS = 0.577;   // rms of the engine's white-noise buffer (uniform ±1)

// ───────────────────────────────────────── node kit ─────────────────────────────────────────
// Every node made here is tracked so teardown can stop/disconnect all of it.
function makeKit(A, ac) {
  const buf = {};
  for (const k of ['white', 'pink', 'brown']) {
    buf[k] = A[k] || (typeof A.noise === 'function' ? A.noise(k, k === 'white' ? 4 : 6) : null);
    if (!buf[k]) return null;
  }
  const nodes = [], srcs = [];
  const keep = (n) => { nodes.push(n); return n; };
  const K = { A, ac, buf, nodes, srcs, now: 0, dry: null, mkWet: null, nyq: ac.sampleRate / 2, trem: null };
  let wetBus = null;
  Object.defineProperty(K, 'wet', { get: () => wetBus || (wetBus = K.mkWet()) });   // reverb stage is only built if something sends to it

  // retarget an AudioParam smoothly — but only when the value really changed, so idle params stay idle on the audio thread
  K.tg = (p, v, tc) => {
    const l = p._l;
    if (l !== undefined && Math.abs(v - l) <= 0.002 * Math.abs(v) + 1e-6) return;
    p._l = v; p.setTargetAtTime(v, K.now, tc);
  };
  K.g = (v = 1, dst) => { const n = keep(ac.createGain()); n.gain.value = v; if (dst) n.connect(dst); return n; };
  // NB: for lowpass/highpass `q` is in dB (−3 ≈ Butterworth, flat); for bandpass it is a linear Q
  K.bq = (type, f, q = 0.7, dst) => { const n = keep(ac.createBiquadFilter()); n.type = type; n.frequency.value = f; n.Q.value = q; if (dst) n.connect(dst); return n; };
  K.osc = (type, f, dst, wave) => {
    const o = keep(ac.createOscillator());
    if (wave) o.setPeriodicWave(wave); else o.type = type;
    o.frequency.value = f; o.start(); srcs.push(o); if (dst) o.connect(dst); return o;
  };
  // sine LFO with a random start phase (a phase-shifted sine expressed as a one-harmonic PeriodicWave)
  K.lfo = (f, dst) => {
    const ph = rnd(0, TAU);
    return K.osc('sine', f, dst, ac.createPeriodicWave(new Float32Array([0, Math.sin(ph)]), new Float32Array([0, Math.cos(ph)])));
  };
  K.dc = (v) => { const c = keep(ac.createConstantSource()); c.offset.value = v; c.start(); srcs.push(c); return c; };
  K.pan = (p = 0, dst) => { const n = keep(ac.createStereoPanner()); n.pan.value = p; if (dst) n.connect(dst); return n; };
  // looping noise voice at rate 1 (a resampled source costs 2× more). The engine fades ~2048 samples in/out of each buffer:
  // loop strictly inside that to avoid a level dip per wrap.
  K.loop = (b) => {
    const s = keep(ac.createBufferSource()); s.buffer = b; s.loop = true;
    const d = b.duration, guard = 2200 / b.sampleRate;
    if (d > 0.8) { const ls = guard + Math.random() * 0.25, le = d - guard; s.loopStart = ls; s.loopEnd = le; s.start(0, ls + Math.random() * (le - ls - 0.02)); }
    else s.start(0, Math.random() * d);
    srcs.push(s); return s;
  };
  K.chain = (...ns) => { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[ns.length - 1]; };
  K.cv = (src, scale, param) => { const s = K.g(scale); src.connect(s); s.connect(param); return s; };   // modulation: src·scale → param
  K.send = (node, amt) => { const s = K.g(amt, K.wet); node.connect(s); return s; };                  // reverb send
  // slow quasi-random gust control: sum of incommensurate sines, |x| ≤ Σdepth ≤ 1
  K.gustCV = (list) => { const s = K.g(1); for (let i = 0; i < list.length; i++) K.lfo(list[i][0] * rnd(0.93, 1.07), K.g(list[i][1], s)); return s; };
  // fast random flutter: brown noise low-passed at 7 Hz (σ ≈ 0.034 raw) scaled to ≈ depth·0.034
  K.flutterCV = (depth) => K.chain(K.loop(buf.brown), K.bq('lowpass', 7, -3), K.g(depth));
  K.softclip = (k) => {
    const w = keep(ac.createWaveShaper()), n = 513, c = new Float32Array(n), nk = Math.tanh(k);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) / nk;
    w.curve = c; return w;
  };

  // ── pooled one-shot voices (always built, retuned per event; nothing is created at event time) ──
  // After every event the voice gain (and its reverb send) is set back to an exact 0 so the voice goes silent and the
  // audio thread / reverb can skip it.
  // Noise tick voices fed by one shared looping noise source. fire(t, { f, f2?, q, peak (= burst RMS), a, d (T60), pan, wet }) → bool
  K.noisePool = (n, input, withWet = false) => {
    const vs = [];
    for (let i = 0; i < n; i++) {
      const bp = K.bq('bandpass', 1000, 1), g = K.g(0), p = K.pan(0), s = withWet ? K.g(0) : null;
      input.connect(bp); K.chain(bp, g, p); p.connect(K.dry); if (s) { p.connect(s); s.connect(K.wet); }
      vs.push({ bp, g, p, s, busy: 0 });
    }
    return {
      fire(t, o) {
        let v = null;
        for (let i = 0; i < n; i++) if (vs[i].busy <= t) { v = vs[i]; break; }
        if (!v) return false;
        const a = o.a, f = v.bp.frequency, q = v.bp.Q, g = v.g.gain, tEnd = t + a + o.d * 1.3;
        // a narrow band-pass passes only ENBW/nyquist of the white source's power → normalise so that `peak` is the burst RMS
        const fm = o.f2 ? Math.sqrt(o.f * o.f2) : o.f, comp = 1 / (WHITE_RMS * Math.sqrt(Math.min(1, 1.5708 * fm / o.q / K.nyq)));
        f.cancelScheduledValues(t); f.setValueAtTime(o.f, t); if (o.f2) f.exponentialRampToValueAtTime(o.f2, t + a + o.d);
        q.cancelScheduledValues(t); q.setValueAtTime(o.q, t);
        g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(o.peak * comp, t + a); g.setTargetAtTime(0, t + a, o.d / T60); g.setValueAtTime(0, tEnd);
        v.p.pan.setValueAtTime(o.pan || 0, t);
        if (v.s) { v.s.gain.setValueAtTime(o.wet || 0, t); v.s.gain.setValueAtTime(0, tEnd); }
        v.busy = tEnd; return true;
      },
    };
  };
  // Inharmonic partial voices (chimes, ticks, bubbles). ratios/amps/decs per partial (decs scale the T60).
  // fire(t, f, { peak, a, d (T60 of partial 0), pan, wet, glide?, gt? }) — glide = end-frequency ratio over gt seconds
  K.tonePool = (n, ratios, amps, decs, withWet = false) => {
    const vs = [], np = ratios.length;
    for (let i = 0; i < n; i++) {
      const p = K.pan(0), s = withWet ? K.g(0) : null; p.connect(K.dry); if (s) { p.connect(s); s.connect(K.wet); }
      const os = [], gs = [];
      for (let j = 0; j < np; j++) { const gg = K.g(0, p); gs.push(gg); os.push(K.osc('sine', 440 * ratios[j], gg)); }
      vs.push({ p, s, os, gs, busy: 0 });
    }
    return {
      fire(t, f, o) {
        let v = null;
        for (let i = 0; i < n; i++) if (vs[i].busy <= t) { v = vs[i]; break; }
        if (!v) return false;
        let end = 0;
        for (let j = 0; j < np; j++) { const d = o.d * decs[j]; if (d > end) end = d; }
        const tEnd = t + o.a + end * 1.3;
        for (let j = 0; j < np; j++) {
          const fr = v.os[j].frequency, g = v.gs[j].gain;
          fr.cancelScheduledValues(t); fr.setValueAtTime(f * ratios[j], t); if (o.glide) fr.exponentialRampToValueAtTime(f * ratios[j] * o.glide, t + (o.gt || o.d * 0.5));
          g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(o.peak * amps[j], t + o.a); g.setTargetAtTime(0, t + o.a, o.d * decs[j] / T60); g.setValueAtTime(0, tEnd);
        }
        v.p.pan.setValueAtTime(o.pan || 0, t);
        if (v.s) { v.s.gain.setValueAtTime(o.wet || 0, t); v.s.gain.setValueAtTime(0, tEnd); }
        v.busy = tEnd; return true;
      },
    };
  };
  // Deep thump / tremor voice: brown low-pass + a pitch-dropping sine through an optional tremolo (one shared 7.8 Hz LFO).
  // fire(t, { peak, a, d (T60), f, f2, lpf, shudder }) → bool
  K.boom = () => {
    const lp = K.bq('lowpass', 70, 0.5), body = K.g(0), am = K.g(1), depth = K.g(0), og = K.g(0.55);
    K.chain(K.loop(buf.brown), K.bq('highpass', 26, -3), lp, body, am, K.dry);
    const so = K.osc('sine', 36, og); og.connect(body);
    (K.trem || (K.trem = K.osc('sine', 7.8))).connect(depth); depth.connect(am.gain);
    let busy = 0;
    return {
      fire(t, o) {
        if (busy > t) return false;
        const a = o.a, d = o.d, tEnd = t + a + d * 1.3;
        lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(o.lpf, t); lp.frequency.exponentialRampToValueAtTime(o.lpf * 0.55, t + a + d);
        so.frequency.cancelScheduledValues(t); so.frequency.setValueAtTime(o.f, t); so.frequency.exponentialRampToValueAtTime(o.f2 || o.f, t + a + d * 0.6);
        body.gain.cancelScheduledValues(t); body.gain.setValueAtTime(0, t); body.gain.linearRampToValueAtTime(o.peak, t + a); body.gain.setTargetAtTime(0, t + a, d / T60); body.gain.setValueAtTime(0, tEnd);
        depth.gain.cancelScheduledValues(t); depth.gain.setValueAtTime(o.shudder || 0, t); depth.gain.setTargetAtTime(0, t + a, d / 2.2); depth.gain.setValueAtTime(0, tEnd);
        busy = tEnd; return true;
      },
    };
  };
  return K;
}

// ───────────────────────────────────────── output stage ─────────────────────────────────────────
// layers → bus → "indoors" low-pass + gain → two cascaded fade gains → destination (dry → sfx; wet → verbIn, built on demand)
function buildOutput(K, dest, verbIn) {
  const mk = (to) => {
    const bus = K.g(1), muff = K.bq('lowpass', 20000, -3), inG = K.g(1), fa = K.g(0), fb = K.g(0);
    K.chain(bus, muff, inG, fa, fb); if (to) fb.connect(to);
    return { bus, muff, inG, fa, fb };
  };
  const d = mk(dest), O = { d, w: null, fades: [d.fa, d.fb] };
  K.dry = d.bus;
  K.mkWet = () => { const w = (O.w = mk(verbIn)); O.fades.push(w.fa, w.fb); return w.bus; };
  return O;
}

// ───────────────────────────────────────── take-off rumble (all biomes, built on first use) ─────────────────────────────────────────
function buildRumble(K) {
  const { buf, tg } = K;
  const trem = K.g(1), nLvl = K.g(0), sLvl = K.g(0), bLvl = K.g(0), nLP = K.bq('lowpass', 60, 0.5);
  K.chain(K.loop(buf.brown), K.bq('highpass', 26, -3), nLP, nLvl, trem);
  const so = K.osc('sine', 38);
  K.chain(so, K.softclip(2.4), sLvl, trem);                         // saturated → 2nd/3rd harmonics reach small speakers
  K.chain(K.loop(buf.pink), K.bq('lowpass', 230, -3), bLvl, trem);
  K.lfo(5.3, K.g(0.1, trem.gain));                                   // vibration
  trem.connect(K.dry);
  return {
    set(L, tc) {
      tg(nLvl.gain, 0.19 * L, tc); tg(nLP.frequency, 58 + 32 * L, tc);
      tg(sLvl.gain, 0.042 * L, tc); tg(so.frequency, 37 + 5 * L, tc);
      tg(bLvl.gain, 0.028 * L * L, tc);
    },
  };
}

// ───────────────────────────────────────── biomes ─────────────────────────────────────────
// Each builder returns { tune(S, tc) — retarget level/filter params from the smoothed state (~20 Hz),
//                        tick(dt, S) — fire sparse events (called every update) }.

// ── asphodel: wind through silver grass + gust swells; shore → gentle surf ──
function buildAsphodel(K) {
  const { buf, dry, tg } = K;
  const gust = K.gustCV([[0.043, 0.45], [0.081, 0.33], [0.157, 0.22]]);
  const flut = K.flutterCV(5.4);

  // low body of the wind
  const bedBP = K.bq('bandpass', 480, 0.45), bedMod = K.g(1), bedLvl = K.g(0);
  K.chain(K.loop(buf.pink), bedBP, K.bq('lowpass', 1500, -3), bedMod, bedLvl, dry);
  K.cv(gust, 0.5, bedMod.gain);
  // grass rustle (swells with gusts, fast random flutter)
  const rusMod = K.g(1), rusLvl = K.g(0);
  K.chain(K.loop(buf.pink), K.bq('bandpass', 2300, 0.75), K.bq('lowpass', 5200, -3), rusMod, rusLvl, dry);
  K.cv(gust, 0.65, rusMod.gain); flut.connect(rusMod.gain);
  // airy top
  const hisMod = K.g(1), hisLvl = K.g(0);
  K.chain(K.loop(buf.white), K.bq('highpass', 5000, -3), K.bq('lowpass', 9500, -3), hisMod, hisLvl, dry);
  K.cv(gust, 0.8, hisMod.gain); flut.connect(hisMod.gain);
  // occasional airy gust swell: one band-passed voice sweeping up and back while crossing the stereo stage
  const swBP = K.bq('bandpass', 400, 0.6), swG = K.g(0), swPan = K.pan(0);
  K.chain(K.loop(buf.pink), swBP, swG, swPan, dry);
  // surf: wash (low-passed noise, one wave ≈ every 8 s ≈ 0.12 Hz) + hiss on the crest + faint distant sea body
  const washMod = K.g(0.1), washLvl = K.g(0), foamBP = K.bq('bandpass', 3500, 0.6), foamMod = K.g(0), foamLvl = K.g(0), seaMod = K.g(0.7), seaLvl = K.g(0);
  K.chain(K.loop(buf.pink), K.bq('highpass', 90, -3), K.bq('lowpass', 750, -3), washMod, washLvl, dry);
  K.chain(K.loop(buf.white), foamBP, foamMod, foamLvl, dry);
  K.chain(K.loop(buf.brown), K.bq('highpass', 32, -3), K.bq('lowpass', 170, -3), seaMod, seaLvl, dry);
  K.lfo(0.061, K.g(0.3, seaMod.gain));

  const swell = (t, w) => {
    const dur = rnd(3.4, 5.6), a = dur * 0.42, dir = Math.random() < 0.5 ? -1 : 1;
    const g = swG.gain; g.cancelScheduledValues(t); g.setValueAtTime(0, t); g.linearRampToValueAtTime(0.3 * (0.35 + 0.65 * w) * rnd(0.7, 1), t + a); g.setTargetAtTime(0, t + a, (dur - a) / 3); g.setValueAtTime(0, t + dur * 1.5);
    const f = swBP.frequency; f.cancelScheduledValues(t); f.setValueAtTime(rnd(260, 380), t); f.exponentialRampToValueAtTime(rnd(700, 1050), t + a); f.exponentialRampToValueAtTime(rnd(330, 480), t + dur);
    const p = swPan.pan; p.cancelScheduledValues(t); p.setValueAtTime(-0.6 * dir, t); p.linearRampToValueAtTime(0.6 * dir, t + dur);
  };
  const wave = (t, h) => {
    const wg = washMod.gain; wg.setTargetAtTime(h, t, 0.95); wg.setTargetAtTime(0.1, t + 2.7, 1.5);     // swell in, crest, long recede
    const fg = foamMod.gain; fg.cancelScheduledValues(t); fg.setValueAtTime(0, t + 1.9); fg.linearRampToValueAtTime(h * 0.85, t + 2.6); fg.setTargetAtTime(0, t + 2.6, 0.6); fg.setValueAtTime(0, t + 6.5);
    const ff = foamBP.frequency; ff.cancelScheduledValues(t); ff.setValueAtTime(4200, t + 1.9); ff.exponentialRampToValueAtTime(2200, t + 6.2);
  };

  let swellT = rnd(5, 12), waveT = rnd(0.5, 3);
  return {
    tune(S, tc) {
      const w = S.we, su = S.sunUp, sh = S.shore;
      tg(bedLvl.gain, 0.2 * (0.3 + 0.7 * w), tc);
      tg(bedBP.frequency, 480 * (0.88 + 0.24 * su), tc);
      tg(rusLvl.gain, 0.0006 + 0.2 * Math.pow(w, 1.25) * (0.65 + 0.35 * su), tc);
      tg(hisLvl.gain, 0.022 * Math.pow(w, 1.5) * (0.5 + 0.5 * su), tc);
      tg(washLvl.gain, 0.26 * sh, tc); tg(foamLvl.gain, 0.05 * sh, tc); tg(seaLvl.gain, 0.03 * sh, tc);
    },
    tick(dt, S) {
      const t = K.now + 0.03;
      swellT -= dt;
      if (swellT <= 0) { if (S.we > 0.05) swell(t, S.we); swellT = rnd(11, 30) * (1.6 - 0.8 * S.we); }
      waveT -= dt;
      if (waveT <= 0) { if (S.shore > 0.03) wave(t, rnd(0.55, 1)); waveT = rnd(6.4, 10.6); }
    },
  };
}

// ── phlegethon: furnace roar, lava churn, crackle / pops (∝ lava), fissure hiss, sub rumble, seismic tremors ──
function buildPhlegethon(K, def) {
  const { buf, dry, tg } = K;
  const fiss = clamp(num(def && def.terrain && def.terrain.fissure, 0.6), 0.25, 1.2);
  const gust = K.gustCV([[0.083, 0.5], [0.19, 0.3], [0.31, 0.2]]);
  const flut = K.flutterCV(5.4);

  // furnace roar (brown, low-passed ≈ 120 Hz) that breathes slowly
  const roarLP = K.bq('lowpass', 118, 1), roarMod = K.g(1), roarLvl = K.g(0);
  K.chain(K.loop(buf.brown), K.bq('highpass', 28, -3), roarLP, roarMod, roarLvl, dry);
  K.cv(gust, 0.3, roarMod.gain);
  // lava churn: low-mid gurgle (random flutter) so the flow is audible on small speakers too
  const chMod = K.g(1), chLvl = K.g(0);
  K.chain(K.loop(buf.pink), K.bq('bandpass', 250, 0.8), K.bq('lowpass', 700, -3), chMod, chLvl, dry);
  K.cv(gust, 0.45, chMod.gain); flut.connect(chMod.gain);
  // distant hissing fissure
  const hsMod = K.g(1), hsLvl = K.g(0);
  K.chain(K.loop(buf.white), K.bq('highpass', 3300, -3), K.bq('bandpass', 6000, 0.7), K.bq('lowpass', 9000, -3), hsMod, hsLvl, dry);
  K.cv(gust, 0.6, hsMod.gain);
  // sub rumble: two beating sines, soft-clipped so the harmonics carry on small speakers
  const subMix = K.g(0.5), subMod = K.g(1), subLvl = K.g(0);
  K.osc('sine', 36.5, subMix); K.osc('sine', 37.6, subMix);
  K.chain(subMix, K.softclip(2.2), subMod, subLvl, dry); K.cv(gust, 0.35, subMod.gain);
  // ash-laden wind hush
  const ashMod = K.g(1), ashLvl = K.g(0);
  K.chain(K.loop(buf.pink), K.bq('bandpass', 650, 0.5), K.bq('lowpass', 1800, -3), ashMod, ashLvl, dry);
  K.cv(gust, 0.5, ashMod.gain);

  const pops = K.noisePool(6, K.loop(buf.white)), bloops = K.tonePool(2, [1], [1], [1]), boom = K.boom();
  const tickPop = (t, k) => pops.fire(t, { f: rnd(1500, 5200), q: rnd(1.4, 5.5), peak: rnd(0.010, 0.026) * k, a: 0.0009, d: rnd(0.012, 0.05), pan: rnd(-0.85, 0.85) });
  const snapPop = (t, k) => pops.fire(t, { f: rnd(650, 1500), f2: rnd(350, 700), q: rnd(0.9, 1.8), peak: rnd(0.014, 0.032) * k, a: 0.0012, d: rnd(0.06, 0.15), pan: rnd(-0.7, 0.7) });
  const bloopPop = (t, k) => bloops.fire(t, rnd(150, 270), { peak: rnd(0.02, 0.05) * k, a: 0.004, d: rnd(0.07, 0.13), glide: 0.45, gt: 0.08, pan: rnd(-0.6, 0.6) });
  const cluster = (t, k) => { const n = 3 + ((Math.random() * 4) | 0); let tt = t; for (let i = 0; i < n; i++) { tickPop(tt, k * rnd(0.5, 1)); tt += rnd(0.01, 0.07); } };

  let popAcc = expDraw(), quakeT = rnd(14, 40);
  return {
    tune(S, tc) {
      const L = S.lava;
      tg(roarLvl.gain, 0.14 * (0.5 + 0.5 * L), tc); tg(roarLP.frequency, 100 + 40 * L, tc);
      tg(chLvl.gain, 0.21 * (0.12 + 0.88 * Math.pow(L, 1.2)), tc);
      tg(hsLvl.gain, 0.03 * fiss * (0.35 + 0.65 * L), tc);
      tg(subLvl.gain, 0.016 * (0.45 + 0.55 * L), tc);
      tg(ashLvl.gain, 0.14 * S.we, tc);
    },
    tick(dt, S) {
      const L = S.lava, t = K.now + 0.03;
      popAcc -= dt * (0.45 + 3.6 * L);
      for (let n = 0; popAcc <= 0 && n < 3; n++) {
        popAcc += expDraw();
        const k = 0.35 + 0.65 * L, r = Math.random();
        if (r < 0.6) tickPop(t, k); else if (r < 0.76) snapPop(t, k); else if (r < 0.88) bloopPop(t, k); else cluster(t, k);
      }
      quakeT -= dt;
      if (quakeT <= 0) { boom.fire(t, { peak: 0.04 * (1 - 0.4 * S.indoors), a: 0.9, d: 3.6, f: 34, f2: 29, lpf: 66, shudder: 0.2 }); quakeT = rnd(32, 70); }
    },
  };
}

// ── charon (airless): suit/ship interior only — air-handler hush, fan, 60/120 Hz hum, thermal ticks, boot rumble ──
function buildCharon(K) {
  const { buf, dry, tg } = K;
  // air-handler hush, slow ventilation cycle
  const hushMod = K.g(1), hushLvl = K.g(0);
  K.chain(K.loop(buf.pink), K.bq('highpass', 140, -3), K.bq('lowpass', 1100, -3), hushMod, hushLvl, dry);
  K.lfo(0.17, K.g(0.1, hushMod.gain)); K.lfo(0.053, K.g(0.08, hushMod.gain));
  // breath of the vents
  const brMod = K.g(1), brLvl = K.g(0);
  K.chain(K.loop(buf.white), K.bq('bandpass', 2500, 0.8), K.bq('lowpass', 5000, -3), brMod, brLvl, dry); K.lfo(0.11, K.g(0.3, brMod.gain));
  // fan whirr (two soft resonances)
  const fanLvl = K.g(0), fanB2 = K.g(0.6), fanSrc = K.loop(buf.white);
  K.chain(fanSrc, K.bq('bandpass', 224, 8), fanLvl); K.chain(fanSrc, K.bq('bandpass', 331, 10), fanB2, fanLvl); fanLvl.connect(dry);
  // faint electrical hum (detuned a hair so it can never cancel the ship's own 60 Hz bed)
  const humMod = K.g(1), humLvl = K.g(0);
  K.osc('sine', 60.17, K.g(1, humMod)); K.osc('sine', 120.31, K.g(0.8, humMod)); K.osc('sine', 180.5, K.g(0.28, humMod));
  K.chain(humMod, humLvl, dry); K.lfo(0.031, K.g(0.15, humMod.gain));

  const ticks = K.tonePool(2, [1, 2.76], [1, 0.35], [1, 0.4]), boom = K.boom();
  const tick1 = (t, k) => ticks.fire(t, rnd(1900, 3600), { peak: rnd(0.012, 0.028) * k, a: 0.0008, d: rnd(0.05, 0.11), pan: rnd(-0.5, 0.5) });

  let tickT = rnd(4, 12), boomT = rnd(12, 30);
  return {
    tune(S, tc) {
      const e = clamp(S.speed / 6, 0, 1);
      tg(hushLvl.gain, 0.1 * (0.85 + 0.35 * e), tc);
      tg(brLvl.gain, 0.012 * (0.8 + 0.5 * e), tc);
      tg(fanLvl.gain, 0.12 * (0.8 + 0.5 * e), tc);
      tg(humLvl.gain, 0.0035, tc);
    },
    tick(dt, S) {
      const t = K.now + 0.03;
      tickT -= dt;
      if (tickT <= 0) {                                   // thermal contraction ticks: more often in sunlight
        tick1(t, 1); if (Math.random() < 0.35) tick1(t + rnd(0.09, 0.26), 0.7);
        tickT = rnd(7, 22) / (0.45 + 0.9 * S.sunUp);
      }
      boomT -= dt;
      if (boomT <= 0) {                                   // ground rumble through the boots every ~20–40 s
        boom.fire(t, { peak: 0.05 * (1 - 0.5 * S.indoors), a: rnd(0.9, 1.6), d: rnd(3.6, 5.6), f: 36, f2: 30, lpf: 68, shudder: 0.22 });
        boomT = rnd(20, 40);
      }
    },
  };
}

// ── cocytus: wailing formant wind, geyser roar + thump (∝ st.geyser), icy ticks / cracks / quakes ──
function buildCocytus(K) {
  const { buf, dry, tg } = K;
  const gust = K.gustCV([[0.037, 0.45], [0.071, 0.33], [0.139, 0.22]]);
  const flut = K.flutterCV(5.4);

  // cold wind body
  const bedMod = K.g(1), bedLvl = K.g(0);
  K.chain(K.loop(buf.pink), K.bq('highpass', 70, -3), K.bq('lowpass', 850, -3), bedMod, bedLvl, dry);
  K.cv(gust, 0.45, bedMod.gain);
  // the wail: three narrow resonances (vowel-like formants) sweeping slowly; gusts and wail swells lift them
  const wail = K.dc(0), howlSrc = K.loop(buf.pink), howlSum = K.g(1), howlMod = K.g(1), howlLvl = K.g(0);
  const forms = [[410, 14, 1, 0.027, 330], [880, 16, 0.65, 0.043, 260], [2450, 18, 0.3, 0.061, 170]];
  const pitch = K.g(1);                                  // shared pitch CV in cents: gusts lift it, wail swells lift it more, flutter adds a quiver
  K.cv(gust, 240, pitch); K.cv(wail, 500, pitch); K.cv(flut, 80, pitch);
  for (let i = 0; i < forms.length; i++) {
    const [f, q, a, lf, depth] = forms[i], bp = K.bq('bandpass', f, q);
    K.chain(howlSrc, bp, K.g(a), howlSum);
    K.lfo(lf * rnd(0.9, 1.1), K.g(depth, bp.detune));    // slow independent sweep per formant
    pitch.connect(bp.detune);
  }
  K.chain(howlSum, howlMod, howlLvl, dry);
  K.cv(gust, 0.45, howlMod.gain); K.cv(wail, 0.9, howlMod.gain);
  // geyser: low body + band-passed roar + steam jet (+ turbulence), saturated sub
  const gSum = K.g(1), gTurb = K.g(1), lowLvl = K.g(0), midLvl = K.g(0), jetLvl = K.g(0), subLvl = K.g(0), midBP = K.bq('bandpass', 520, 0.7);
  K.chain(gSum, gTurb, dry);
  flut.connect(gTurb.gain);                              // turbulence: random ±15 % flutter
  K.chain(K.loop(buf.brown), K.bq('highpass', 30, -3), K.bq('lowpass', 160, -3), lowLvl, dry);
  K.chain(K.loop(buf.white), midBP, K.bq('lowpass', 2200, -3), midLvl, gSum);
  K.chain(K.loop(buf.white), K.bq('highpass', 2000, -3), K.bq('bandpass', 3800, 0.6), jetLvl, gSum);
  K.chain(K.osc('sine', 44), K.softclip(2), subLvl, dry);

  // ice voices: ticks / puffs are dry, cracks and pings echo across the plain (the only reverb sends in this biome)
  const ice = K.noisePool(4, K.loop(buf.white), true), ping = K.tonePool(2, [1, 2.32], [1, 0.3], [1, 0.5], true), boomA = K.boom(), boomB = K.boom();
  const tick1 = (t, k) => ice.fire(t, { f: rnd(2600, 6200), q: rnd(3, 9), peak: rnd(0.006, 0.016) * k, a: 0.0008, d: rnd(0.01, 0.035), pan: rnd(-0.9, 0.9) });
  const crack = (t) => {
    ice.fire(t, { f: rnd(3800, 4800), f2: rnd(700, 1000), q: 2.2, peak: rnd(0.018, 0.028), a: 0.001, d: rnd(0.12, 0.3), pan: rnd(-0.7, 0.7), wet: 0.55 });
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0, tt = t + 0.05; i < n; i++, tt += rnd(0.03, 0.14)) tick1(tt, 1.2);
    boomB.fire(t, { peak: 0.025, a: 0.01, d: 0.7, f: 120, f2: 55, lpf: 220 });
  };
  const wailSwell = (t) => {
    const up = rnd(3, 5.2), dn = rnd(5, 8), o = wail.offset;
    o.cancelScheduledValues(t); o.setValueAtTime(0, t); o.linearRampToValueAtTime(rnd(0.6, 1), t + up); o.linearRampToValueAtTime(0, t + up + dn);
  };

  let tickAcc = expDraw(), pingAcc = expDraw(), crackT = rnd(8, 24), quakeT = rnd(25, 60), wailT = rnd(4, 14), gT = -1, gArm = true, gQuiet = 0;
  return {
    tune(S, tc) {
      const w = S.we, G = S.geyser, gl = Math.pow(G, 1.15);
      tg(bedLvl.gain, 0.085 * (0.4 + 0.6 * w), tc);
      tg(howlLvl.gain, 0.5 * Math.pow(w, 1.4), tc);
      tg(lowLvl.gain, 0.125 * gl, tc); tg(midLvl.gain, 0.125 * gl, tc); tg(midBP.frequency, 380 + 520 * G, tc);
      tg(jetLvl.gain, 0.02 * gl * gl, tc); tg(subLvl.gain, 0.02 * gl, tc);
    },
    tick(dt, S) {
      const t = K.now + 0.03, su = S.sunUp;
      tickAcc -= dt * 0.32 * (1.35 - 0.5 * su);                   // thermal contraction: busier when the sun is low
      for (let n = 0; tickAcc <= 0 && n < 3; n++) { tickAcc += expDraw(); tick1(t, 1); if (Math.random() < 0.25) tick1(t + rnd(0.03, 0.12), 0.7); }
      pingAcc -= dt * 0.05;
      if (pingAcc <= 0) { pingAcc += expDraw(); ping.fire(t, rnd(1400, 3400), { peak: rnd(0.008, 0.016), a: 0.002, d: rnd(0.4, 0.9), pan: rnd(-0.6, 0.6), wet: 0.5 }); }
      crackT -= dt; if (crackT <= 0) { crack(t); crackT = rnd(18, 55); }
      quakeT -= dt; if (quakeT <= 0) { boomB.fire(t, { peak: 0.035 * (1 - 0.4 * S.indoors), a: 1.4, d: 4.5, f: 34, f2: 28, lpf: 70, shudder: 0.15 }); quakeT = rnd(40, 90); }
      wailT -= dt; if (wailT <= 0) { if (S.we > 0.3) wailSwell(t); wailT = rnd(14, 34); }
      // geyser eruption onset → low thump + a puff of steam noise (peak follows how close the vent is)
      if (gT >= 0) {
        gT -= dt;
        if (gT < 0) {
          const k = clamp(S.geyRaw * 1.6, 0.2, 1);
          boomA.fire(t, { peak: 0.075 * k, a: 0.012, d: 1.1, f: 78, f2: 34, lpf: 210 });
          ice.fire(t, { f: 700, f2: 300, q: 0.8, peak: 0.03 * k, a: 0.01, d: 0.5, pan: 0 });
          gT = -1; gArm = false; gQuiet = 0;
        }
      } else if (gArm) { if (S.geyRaw > 0.06) gT = 0.45; }
      else if (S.geyRaw < 0.02) { gQuiet += dt; if (gQuiet > 1.5) gArm = true; } else gQuiet = 0;
    },
  };
}

// ── elysium: thin cold air, crystal hum (shifting minor-ninth-ish chord with beating), glassy chimes (∝ crystal) ──
const A2 = 110;
const HUM_VOICES = [   // semitone sets above A2; index 0 is the opening voicing (Am7 add-ish), the rest are the neighbours it drifts to
  { set: [0], vol: 1.0 },
  { set: [7, 5, 3], vol: 0.8 },
  { set: [10, 12, 14], vol: 0.65 },
  { set: [15, 17, 19], vol: 0.5 },
  { set: [19, 21, 22], vol: 0.38 },
];
const CHIMES = [880, 987.77, 1046.5, 1318.5, 1567.98, 1760, 1975.5, 2637];   // A-minor-9 pentatonic: consonant with every hum voicing

function buildElysium(K) {
  const { buf, dry, tg } = K;
  const gust = K.gustCV([[0.047, 0.6], [0.113, 0.4]]);
  // thin cold air + faint glassy sparkle in the high band
  const airMod = K.g(1), airLvl = K.g(0), shLvl = K.g(0);
  K.chain(K.loop(buf.pink), K.bq('highpass', 450, -3), K.bq('lowpass', 3600, -3), airMod, airLvl, dry); K.cv(gust, 0.4, airMod.gain);
  K.chain(K.loop(buf.pink), K.bq('bandpass', 6200, 1.2), shLvl, dry);
  // crystal hum: 5 voices × 2 detuned partials (slow beating), the partials of a voice sit on opposite sides of the stage so
  // the beats travel across it; three shared slow LFOs make the voices breathe (dry: the width comes from the panning).
  const humWave = K.ac.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, 0.12, 0.05]));
  const humLP = K.bq('lowpass', 1100, -3), humLvl = K.g(0);
  K.chain(humLP, humLvl, dry);
  const breath = [K.lfo(0.037), K.lfo(0.052), K.lfo(0.071)];
  const V = HUM_VOICES.map((hv, i) => {
    const d = rnd(0.2, 0.55), f = A2 * Math.pow(2, hv.set[0] / 12), side = i % 2 ? -1 : 1, vg = K.g(0.5 * hv.vol);
    const o1 = K.osc('sine', f - d, K.pan(-0.45 * side, vg), humWave), o2 = K.osc('sine', f + d, K.pan(0.45 * side, vg), humWave);
    vg.connect(humLP); breath[i % 3].connect(K.g(0.35 * 0.5 * hv.vol, vg.gain));
    return { o1, o2, d, set: hv.set, idx: 0 };
  });
  // chimes: sparse glassy bells (partials 1 : 2.32) with long decays, mostly reverb
  const chime = K.tonePool(3, [1, 2.32], [1, 0.34], [1, 0.45], true);
  const chimeEvt = (t, k) => {
    const n = Math.random() < 0.28 ? 2 + ((Math.random() * 2) | 0) : 1;
    for (let i = 0, tt = t; i < n; i++, tt += rnd(0.16, 0.42)) chime.fire(tt, pick(CHIMES), { peak: rnd(0.012, 0.03) * k * (i ? 0.75 : 1), a: 0.012, d: rnd(3.2, 5.5), pan: rnd(-0.6, 0.6), wet: 0.9 });
  };
  const drift = () => {
    const i = 1 + ((Math.random() * (V.length - 1)) | 0), v = V[i];
    let j; do j = (Math.random() * v.set.length) | 0; while (j === v.idx);
    v.idx = j; const f = A2 * Math.pow(2, v.set[j] / 12);
    v.o1.frequency.setTargetAtTime(f - v.d, K.now, 2.4); v.o2.frequency.setTargetAtTime(f + v.d, K.now, 2.4);
  };

  let chimeAcc = expDraw(), driftT = rnd(8, 18);
  return {
    tune(S, tc) {
      const c = S.crystal;
      tg(airLvl.gain, 0.13 * (0.45 + 0.55 * S.we), tc); tg(shLvl.gain, 0.015 * (0.4 + 0.6 * c), tc);
      tg(humLvl.gain, 0.019 * (0.3 + 0.7 * Math.pow(c, 0.85)), tc);
    },
    tick(dt, S) {
      const t = K.now + 0.03, c = S.crystal;
      chimeAcc -= dt * (0.025 + 0.22 * c) * (1.25 - 0.45 * S.sunUp);
      if (chimeAcc <= 0) { chimeAcc += expDraw(); chimeEvt(t, 0.5 + 0.5 * c); }
      driftT -= dt; if (driftT <= 0) { drift(); driftT = rnd(10, 22); }
    },
  };
}

// biome → builder + output trim + "indoors" treatment (low-pass Hz, gain)
const PROFILES = {
  asphodel:   { build: buildAsphodel,   trim: 1, att: { lp: 800, gain: 0.5 } },
  phlegethon: { build: buildPhlegethon, trim: 1, att: { lp: 520, gain: 0.5 } },
  charon:     { build: buildCharon,     trim: 1, att: { lp: 3500, gain: 0.85 } },
  cocytus:    { build: buildCocytus,    trim: 1, att: { lp: 800, gain: 0.45 } },
  elysium:    { build: buildElysium,    trim: 1, att: { lp: 800, gain: 0.5 } },
};

// ───────────────────────────────────────── public factory ─────────────────────────────────────────
export function createAmbience(ctx, opts) {
  const { bodyId, siteId, biome } = opts || {};
  const kind = PROFILES[biome] ? biome : PROFILES[bodyId] ? bodyId : null;
  const prof = kind ? PROFILES[kind] : null;
  const def = (kind && SITES && SITES[kind] && SITES[kind][siteId]) || null;

  // raw targets (T) and smoothed state (S); preallocated, mutated in place
  const T = { wind: 0.4, geyser: 0, lava: 0.5, crystal: 0.5, shore: 0, speed: 0, indoors: 0, sunUp: 1, rum: 0 };
  const S = { wind: 0.4, geyser: 0, geyRaw: 0, lava: 0.5, crystal: 0.5, shore: 0, speed: 0, indoors: 0, sunUp: 1, we: 0.4 };
  let built = null, wanted = false, stopping = false, disposed = false, failed = false, acc = 0, rumPushed = 0, rumT = -1;
  let stopTimer = 0, stopResolve = null, stopPromise = null;

  const fail = (e) => {
    if (failed) return;
    failed = true; wanted = false;
    try { console.warn('[ambience] disabled:', e); } catch (_) { /* no console */ }
    try { const b = built; built = null; if (b) release(b); } catch (_) { /* already broken */ }
  };
  function release(b) {
    for (let i = 0; i < b.K.srcs.length; i++) { try { b.K.srcs[i].stop(); } catch (_) { /* already stopped */ } }
    for (let i = 0; i < b.K.nodes.length; i++) { try { b.K.nodes[i].disconnect(); } catch (_) { /* already gone */ } }
    b.K.srcs.length = 0; b.K.nodes.length = 0;
  }
  const fadeTo = (v, tc) => { const f = built.O.fades, now = built.ac.currentTime; for (let i = 0; i < f.length; i++) f[i].gain.setTargetAtTime(v, now, tc); };

  function build(A) {
    const ac = A.ctx, dest = A.sfx || A.master;
    if (!ac || !dest || typeof ac.createGain !== 'function') return null;
    const K = makeKit(A, ac);
    if (!K) return null;
    try {
      const O = buildOutput(K, dest, A.verbIn || null);
      const B = prof.build(K, def);
      return { ac, K, O, B, R: null };
    } catch (e) { release({ K }); throw e; }
  }
  function setRumble(b, L, tc) {                                // the rumble layer is built on first use, then kept
    if (!b.R) { if (L <= 0) return; b.R = buildRumble(b.K); }
    b.R.set(L, tc);
  }
  function tryBuild() {
    if (built || disposed || failed || !prof) return;
    const A = ctx && ctx.audio;
    if (!A || !A.ready || !A.ctx) return;                      // engine not up yet (no gesture): retry from update()
    const b = build(A);
    if (!b) return;
    built = b;
    for (const k in S) if (k in T) S[k] = T[k];
    S.geyRaw = T.geyser; S.we = clamp(S.wind + 0.012 * S.speed, 0, 1);
    b.K.now = b.ac.currentTime;
    push(0.001);                                                // snap every level to the current state, then fade the master in
    setRumble(b, T.rum, 0.001); rumPushed = T.rum;
    if (wanted) fadeTo(1, FADE_IN_TC);
  }
  function push(tc) {
    const b = built, K = b.K, O = b.O, I = S.indoors, f = geo(20000, prof.att.lp, I), gI = lerp(1, prof.att.gain, I) * prof.trim;
    K.tg(O.d.muff.frequency, f, tc); K.tg(O.d.inG.gain, gI, tc);
    if (O.w) { K.tg(O.w.muff.frequency, f, tc); K.tg(O.w.inG.gain, gI, tc); }
    b.B.tune(S, tc);
    if (T.rum !== rumPushed) { setRumble(b, T.rum, T.rum > rumPushed ? 0.45 : 0.9); rumPushed = T.rum; }
  }

  function readSt(st) {
    if (!st) return;
    T.wind = clamp(num(st.wind, T.wind), 0, 1); T.geyser = clamp(num(st.geyser, T.geyser), 0, 1); T.lava = clamp(num(st.lava, T.lava), 0, 1);
    T.crystal = clamp(num(st.crystal, T.crystal), 0, 1); T.shore = clamp(num(st.shore, T.shore), 0, 1); T.speed = clamp(num(st.speed, T.speed), 0, 30);
    T.indoors = clamp(num(st.indoors, T.indoors), 0, 1); T.sunUp = clamp(num(st.sunUp, T.sunUp), 0, 1);
  }
  function smooth(dt) {
    S.wind += (T.wind - S.wind) * damp(dt, 0.7);
    S.geyRaw = T.geyser; S.geyser += (T.geyser - S.geyser) * damp(dt, T.geyser > S.geyser ? 0.22 : 1.1);
    S.lava += (T.lava - S.lava) * damp(dt, 0.9);
    S.crystal += (T.crystal - S.crystal) * damp(dt, 0.9);
    S.shore += (T.shore - S.shore) * damp(dt, 0.9);
    S.speed += (T.speed - S.speed) * damp(dt, 0.4);
    S.indoors += (T.indoors - S.indoors) * damp(dt, 0.35);
    S.sunUp += (T.sunUp - S.sunUp) * damp(dt, 2);
    S.we = clamp(S.wind + 0.012 * S.speed, 0, 1);              // walking adds a little relative wind
  }

  function finishStop() {
    stopTimer = 0; stopping = false;
    const r = stopResolve; stopResolve = null; stopPromise = null;
    const b = built; built = null; if (b) release(b);
    if (r) r();
  }

  return {
    start() {
      if (disposed || failed) return;
      try {
        wanted = true;
        if (stopping) {                                         // start() during a fade-out: swim back up
          stopping = false; if (stopTimer) { clearTimeout(stopTimer); stopTimer = 0; }
          const r = stopResolve; stopResolve = null; stopPromise = null; if (r) r();
        }
        if (built) fadeTo(1, FADE_IN_TC); else tryBuild();
      } catch (e) { fail(e); }
    },
    update(dt, st) {
      if (disposed || failed) return;
      try {
        dt = clamp(num(dt, 0), 0, 0.25);
        readSt(st);
        if (wanted && !built) tryBuild();
        const b = built;
        if (!b || stopping || b.ac.state !== 'running') return;  // paused / suspended contexts: no scheduling, nothing piles up
        smooth(dt);
        b.K.now = b.ac.currentTime;
        acc += dt;
        if (acc >= PUSH) { acc = 0; push(0.12); }
        b.B.tick(dt, S);
      } catch (e) { fail(e); }
    },
    rumble(level01) {
      if (disposed || failed) return;
      try {
        T.rum = clamp(num(level01, 0), 0, 1);
        const b = built;
        if (!b || stopping || T.rum === rumPushed || b.ac.state !== 'running') return;
        const now = b.ac.currentTime;
        if (Math.abs(T.rum - rumPushed) < 0.003 || now - rumT < 0.03) return;   // per-frame callers: coalesce (push() catches the rest)
        b.K.now = now; rumT = now;
        setRumble(b, T.rum, T.rum > rumPushed ? 0.45 : 0.9); rumPushed = T.rum;
      } catch (e) { fail(e); }
    },
    stop(fadeSec = 2.5) {
      if (disposed) return Promise.resolve();
      try {
        wanted = false;
        if (stopPromise) return stopPromise;
        const b = built;
        if (!b) return Promise.resolve();
        const sec = clamp(num(fadeSec, 2.5), 0.05, 30);
        if (b.ac.state !== 'running') { built = null; release(b); return Promise.resolve(); }   // silent anyway: release now
        stopping = true;
        fadeTo(0, sec / 3.45);                                  // two cascaded one-poles → −60 dB after `sec`
        stopPromise = new Promise((res) => { stopResolve = res; stopTimer = setTimeout(finishStop, sec * 1000 + 150); });
        return stopPromise;
      } catch (e) { fail(e); return Promise.resolve(); }
    },
    dispose() {
      if (disposed) return;
      disposed = true; wanted = false;
      try {
        if (stopTimer) { clearTimeout(stopTimer); stopTimer = 0; }
        const r = stopResolve; stopResolve = null; stopPromise = null; stopping = false;
        const b = built; built = null;
        if (b) {
          let quick = false;
          try { if (b.ac.state === 'running') { const now = b.ac.currentTime; for (let i = 0; i < b.O.fades.length; i++) b.O.fades[i].gain.setTargetAtTime(0, now, 0.01); quick = true; } } catch (_) { /* release below */ }
          if (quick) setTimeout(() => release(b), 90); else release(b);   // 90 ms de-click before the hard cut
        }
        if (r) r();
      } catch (_) { /* never throw */ }
    },
  };
}
