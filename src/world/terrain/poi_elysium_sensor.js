// ORPHEUS · Elysium — slot `sensor` (padR 12): Tomas's sensor array in the Glass Garden.
// A ring (r ≈ 7 m) of tripod dishes / geophones / mics / probes / Yagi masts, hand-labelled with paper tags, cabled to a weatherproof console whose screen
// shows a live rolling waveform + crystal-resonance spectrum (CanvasTexture ≈ 4 Hz); a mast with a small dish aimed at the galaxy, a camp chair, a thermos,
// and TOMAS's recorder (log.elysium.3). Beacon: violet-white.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kb, TAU, lerp, smooth, clamp, baseMats, glowTexture, decalQuad, mergeDecals, decalMat, consolidate, recorderStyle, printsGeo, HAND, MONO } from './poi_elysium_lib.js';
import { printTexture } from './poi_elysium_camp_tex.js';

const PI = Math.PI;
const K = { alu: 0xb7bec5, steel: 0x8b939b, dark: 0x2a2e34, carbon: 0x1d1f23, orange: 0xe5742b, cyan: 0x2cb7cb, rubber: 0x16181b, case: 0x3a4148, teal: 0x41636f, red: 0xc23b2c, white: 0xe9e6dc, mustard: 0xcf8f35 };
const TAGS = ['N1  (mic)', 'RES-440', "DON'T MOVE - T", 'E2  cracked :(', 'W3', 'geo-1', 'REF', "it's an A."];

// ─────────────────────────────── textures ───────────────────────────────
/** label atlas 512×384: 16 tag cells (128×64, 4×4) + two masking-tape strips (512×64) */
function tagTexture(kit) {
  const rnd = kit.rng('sensor.tags');
  return kit.canvasTexture(512, 384, (g, w, h) => {
    g.fillStyle = '#e6e1d2'; g.fillRect(0, 0, w, h);
    for (let c = 0; c < 16; c++) {
      const x = (c % 4) * 128, y = Math.floor(c / 4) * 64;
      g.save(); g.beginPath(); g.rect(x, y, 128, 64); g.clip(); g.fillStyle = c % 3 === 0 ? '#efe9d6' : c % 3 === 1 ? '#f1d98a' : '#d9e7ee'; g.fillRect(x, y, 128, 64);
      g.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 40; i++) g.fillRect(x + rnd() * 128, y + rnd() * 64, 2, 1);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, 127, 63);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 64, y + 7, 3.2, 0, TAU); g.fill();    // punch hole
      if (c < TAGS.length) { g.fillStyle = '#1c2750'; g.font = `19px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(x + 64, y + 36); g.rotate((rnd() - 0.5) * 0.08); g.fillText(TAGS[c], 0, 0, 116); g.restore(); }
      g.restore();
    }
    const tape = (y, text) => {
      g.fillStyle = '#d9c9a0'; g.fillRect(0, y, 512, 64); g.fillStyle = 'rgba(0,0,0,0.07)'; for (let i = 0; i < 160; i++) g.fillRect(rnd() * 512, y + rnd() * 64, 3, 1);
      g.fillStyle = '#191f3a'; g.font = `27px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, y + 33, 490);
    };
    tape(256, 'GARDEN ARRAY  -  T. OYELARAN  -  DO NOT UNPLUG!'); tape(320, 'they sing at 440.  it is an A.');
  }, { wrap: false, aniso: 8 });
}
const tagUV = (c) => { const x = (c % 4) * 128 + 3, y = Math.floor(c / 4) * 64 + 3; return [x / 512, 1 - (y + 58) / 384, (x + 122) / 512, 1 - y / 384]; };
const tapeUV = (i) => [0.004, 1 - (256 + i * 64 + 62) / 384, 0.996, 1 - (256 + i * 64 + 2) / 384];
const planeUV = (g, r) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1])); return g; };

/** the console screen: rolling waveform + crystal-resonance spectrum; returns { tex, draw(t) } */
function consoleScreen(kit) {
  const tex = kit.canvasTexture(512, 256, (g, w, h) => { g.fillStyle = '#031018'; g.fillRect(0, 0, w, h); }, { wrap: false, aniso: 4 });
  tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const g = tex.image.getContext('2d'), W = 512, H = 256, hist = new Float32Array(W / 2);
  let lastT = -1;
  const fund = [9, 14, 21, 30, 42], BINS = 56;
  function draw(t) {
    if (t - lastT < 0.001) return; lastT = t;
    // push new samples into the rolling trace
    for (let i = 0; i < hist.length - 1; i++) hist[i] = hist[i + 1];
    let v = 0; for (let k = 0; k < fund.length; k++) v += Math.sin(t * (2.2 + k * 1.37) + k * 1.9) * (0.34 / (k + 1));
    hist[hist.length - 1] = v + Math.sin(t * 31.1) * 0.05 + (Math.random() - 0.5) * 0.06 + (Math.sin(t * 0.37) > 0.985 ? 0.5 : 0);
    g.fillStyle = '#031018'; g.fillRect(0, 0, W, H);
    // grid
    g.strokeStyle = 'rgba(70,200,230,0.13)'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= W; x += 32) { g.moveTo(x + 0.5, 22); g.lineTo(x + 0.5, H - 20); } for (let y = 22; y <= H - 20; y += 28) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    // header
    g.fillStyle = 'rgba(120,235,255,0.95)'; g.font = `700 14px ${MONO}`; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText('GARDEN ARRAY  CH1-8', 8, 11);
    g.textAlign = 'right'; g.fillStyle = 'rgba(150,255,190,0.95)'; g.fillText('LOCK  440.2 Hz', W - 8, 11);
    // rolling waveform (upper 60%)
    const wy = 92, amp = 52;
    g.strokeStyle = 'rgba(90,235,255,0.95)'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < hist.length; i++) { const x = i * 2, y = wy - hist[i] * amp; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.strokeStyle = 'rgba(190,140,255,0.55)'; g.lineWidth = 1.2; g.beginPath();
    for (let i = 0; i < hist.length; i++) { const x = i * 2, y = wy + 4 - hist[(i + 37) % hist.length] * amp * 0.6; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(W - 3, wy - amp, 1, amp * 2);
    // spectrum (lower 40%): resonance peaks that breathe slowly
    const sy = H - 22, sh = 78, bw = (W - 16) / BINS;
    for (let b = 0; b < BINS; b++) {
      let a = 0.05 + 0.05 * Math.sin(b * 1.7 + t * 3.1) * Math.sin(b * 0.9 - t);
      for (let k = 0; k < fund.length; k++) { const d = (b - fund[k]) / (1.1 + k * 0.2); a += Math.exp(-d * d) * (0.95 / (1 + k * 0.45)) * (0.82 + 0.18 * Math.sin(t * (0.7 + k * 0.3) + k)); }
      a = clamp(a, 0, 1); const x = 8 + b * bw, hh = a * sh;
      const gr = g.createLinearGradient(0, sy, 0, sy - hh); gr.addColorStop(0, 'rgba(60,210,255,0.9)'); gr.addColorStop(0.6, 'rgba(150,120,255,0.95)'); gr.addColorStop(1, 'rgba(255,90,220,0.95)');
      g.fillStyle = gr; g.fillRect(x, sy - hh, bw - 1.2, hh);
      if (a > 0.45) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x, sy - hh - 3, bw - 1.2, 2); }
    }
    g.fillStyle = 'rgba(120,235,255,0.6)'; g.font = `11px ${MONO}`; g.textAlign = 'left'; g.fillText('100', 8, H - 9); g.textAlign = 'center'; g.fillText('440', 8 + fund[0] * bw, H - 9); g.fillText('880', 8 + fund[2] * bw, H - 9); g.textAlign = 'right'; g.fillText('Hz', W - 8, H - 9);
    tex.needsUpdate = true;
  }
  draw(0.0); draw(0.6);
  return { tex, draw };
}

// ─────────────────────────────── builder ───────────────────────────────
export function buildSensor(env, slot, L) {
  const { kit } = env;
  const kb = new Kb(81).bind(env, L), M = baseMats(kit), rnd = kit.rng('sensor');
  const group = new THREE.Group(); group.name = 'elysium.sensor';
  const colliders = [], interactables = [], ups = [], sun = env.sunDir.clone();
  const cylC = (lx, lz, r, h) => { const [x, z] = L.xz(lx, lz), y = env.groundY(x, z); colliders.push(kit.cyl(x, z, r, y, y + h)); };
  const rot = (lx, lz, yaw, ox, oz) => [lx + ox * Math.cos(yaw) + oz * Math.sin(yaw), lz - ox * Math.sin(yaw) + oz * Math.cos(yaw)];
  const aim = (Yw) => new THREE.Vector3(sun.x * Math.cos(Yw) - sun.z * Math.sin(Yw), Math.max(sun.y, 0.3), sun.x * Math.sin(Yw) + sun.z * Math.cos(Yw)).normalize();
  const upQ = (d) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  const tripod = (h, spread, col = K.alu) => { for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.35; kb.rod('metal', [0, h, 0], [Math.sin(a) * spread, 0.01, Math.cos(a) * spread], 0.016, 0.02, col, 5); kb.cyl('paint', 0.025, 0.03, 0.03, 6, [Math.sin(a) * spread, 0.015, Math.cos(a) * spread], null, K.rubber); } kb.cyl('metal', 0.045, 0.045, 0.07, 8, [0, h, 0], null, K.dark); };
  const tags = []; let tagN = 0;
  const addTag = (x, y, z, yawW, c) => {                       // paper tag: front (text) + back (blank), world-oriented
    const w = 0.22, h = 0.11, mk = (rect, flip) => planeUV(new THREE.PlaneGeometry(w, h), rect).rotateY(yawW + (flip ? PI : 0)).translate(x + (flip ? -1 : 1) * Math.sin(yawW) * 0.003, y, z + (flip ? -1 : 1) * Math.cos(yawW) * 0.003);
    tags.push(mk(tagUV(c), false), mk(tagUV(15), true));
  };

  // ───────── central console on a folding stand (screen faces the arrival side) ─────────
  const scr = consoleScreen(kit);
  kb.at(0, 0, 0.12);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kb.rod('metal', [sx * 0.34, 0.86, sz * 0.2], [sx * 0.46, 0.0, sz * 0.3], 0.017, 0.02, K.alu, 6);
  kb.box('metal', 0.9, 0.03, 0.56, [0, 0.855, 0], null, K.steel); kb.box('metal', 0.8, 0.03, 0.04, [0, 0.35, 0.25], null, K.alu); kb.box('metal', 0.8, 0.03, 0.04, [0, 0.35, -0.25], null, K.alu);
  kb.box('paint', 0.84, 0.2, 0.52, [0, 0.97, 0], null, K.case);                                       // case base
  for (const sx of [-1, 1]) { kb.box('paint', 0.05, 0.22, 0.54, [sx * 0.43, 0.97, 0], null, K.orange); kb.box('metal', 0.1, 0.05, 0.02, [sx * 0.26, 1.03, 0.265], null, K.alu); }
  kb.rod('paint', [-0.18, 0.99, 0.28], [0.18, 0.99, 0.28], 0.016, 0.016, K.rubber, 6);               // carry handle
  kb.box('paint', 0.8, 0.012, 0.48, [0, 1.073, 0], null, 0x232830);                                     // control deck
  for (let i = 0; i < 6; i++) kb.cyl('metal', 0.022, 0.026, 0.03, 10, [-0.3 + i * 0.12, 1.1, 0.12], null, i % 2 ? K.orange : K.alu);
  for (let i = 0; i < 5; i++) { kb.rod('metal', [-0.3 + i * 0.1, 1.08, -0.05], [-0.3 + i * 0.1, 1.13, -0.03], 0.005, 0.005, K.steel, 4); kb.sph('paint', 0.01, [-0.3 + i * 0.1, 1.135, -0.03], K.red, 1, [5, 4]); }
  for (let i = 0; i < 8; i++) kb.box('glow', 0.02, 0.01, 0.012, [0.0 + i * 0.045, 1.083, 0.2], null, i < 6 ? [0.3, 2.6, 1.0] : [2.8, 0.6, 0.2]);
  kb.box('glow', 0.14, 0.006, 0.07, [0.28, 1.081, -0.12], null, [0.2, 1.4, 1.7]);                      // small status window
  kb.sub([0, 1.07, -0.26], [-1.83, 0, 0]);                                                            // lid, opened ~105°
  kb.box('paint', 0.84, 0.04, 0.52, [0, 0.02, 0.26], null, K.case); kb.box('paint', 0.72, 0.018, 0.4, [0, -0.004, 0.26], null, 0x0b0d10);
  kb.add('screen', new THREE.PlaneGeometry(0.66, 0.33), [0, -0.0142, 0.26], [PI / 2, 0, 0]);
  for (const sx of [-1, 1]) kb.box('paint', 0.05, 0.05, 0.54, [sx * 0.43, 0.02, 0.26], null, K.orange);
  kb.end();
  kb.add('tape', planeUV(new THREE.PlaneGeometry(0.5, 0.0625), tapeUV(0)), [0.0, 0.99, 0.2625], null);
  kb.add('tape', planeUV(new THREE.PlaneGeometry(0.34, 0.0425), tapeUV(1)), [0.2, 0.93, 0.2625], [0, 0, 0.04]);
  // cables off the console + shelf items
  kb.cyl('paint', 0.04, 0.04, 0.08, 8, [-0.3, 0.64, 0.1], null, K.dark); kb.box('paint', 0.22, 0.12, 0.16, [0.22, 0.92, -0.0], [0, 0, 0], K.mustard);
  kb.cyl('paint', 0.06, 0.06, 0.14, 10, [0.2, 0.91, 0.0], null, K.mustard);
  kb.box('paint', 0.3, 0.1, 0.2, [-0.2, 0.92, 0.04], [0, 0.15, 0], K.dark);
  kb.cyl('glow', 0.05, 0.05, 0.004, 14, [0.55, 0.9, 0.18], null, [0.6, 2.4, 3.0]);
  cylC(0, 0, 0.78, 1.5);

  // ───────── camp chair (back to the arrival side, facing the screen) + thermos + mug ─────────
  { const cx = 0.75, cz = 1.7, cy = PI + 0.15;
    kb.at(cx, cz, cy);
    for (const sx of [-1, 1]) { kb.rod('metal', [sx * 0.24, 0.46, 0.22], [sx * 0.3, 0.0, 0.3], 0.014, 0.014, K.alu, 6); kb.rod('metal', [sx * 0.24, 0.46, -0.2], [sx * 0.3, 0.0, -0.3], 0.014, 0.014, K.alu, 6); kb.rod('metal', [sx * 0.24, 0.46, -0.2], [sx * 0.24, 0.93, -0.3], 0.014, 0.014, K.alu, 6); kb.rod('metal', [sx * 0.25, 0.65, 0.2], [sx * 0.25, 0.65, -0.24], 0.012, 0.012, K.alu, 6); }
    kb.add('paint', new THREE.BoxGeometry(0.52, 0.04, 0.46), [0, 0.46, 0], [0.04, 0, 0], 1, 0x2f5a68);
    kb.add('paint', new THREE.BoxGeometry(0.52, 0.5, 0.035), [0, 0.7, -0.28], [-0.2, 0, 0], 1, 0x2f5a68);
    kb.box('paint', 0.5, 0.05, 0.03, [0, 0.96, -0.3], [-0.2, 0, 0], K.orange);
    cylC(cx, cz, 0.5, 0.95);
    kb.at(cx - 0.65, cz + 0.2, 0);
    kb.cyl('paint', 0.05, 0.05, 0.26, 12, [0, 0.13, 0], null, K.red); kb.cyl('metal', 0.052, 0.052, 0.04, 12, [0, 0.28, 0], null, K.steel);
    kb.cyl('paint', 0.04, 0.04, 0.09, 12, [0.2, 0.045, 0.1], null, K.white); kb.add('paint', new THREE.TorusGeometry(0.028, 0.0065, 5, 10, PI), [0.245, 0.045, 0.1], [0, 0, -PI / 2], 1, K.white);
    kb.box('paint', 0.2, 0.025, 0.15, [0.5, 0.0125, -0.1], [0, 0.4, 0], 0x6a4a2c);                       // a notebook left on the ground
  }

  // ───────── the ring ─────────
  const N = 9, R0 = 7.0, stationTypes = ['dish', 'geo', 'mic', 'yagi', 'probe', 'horn', 'dish', 'mic', 'probe'], cableCols = [K.red, 0xe0b82a, K.cyan, K.white, 0x6aa84f, K.orange, K.red, 0xe0b82a, K.cyan];
  const stationPos = [];
  for (let i = 0; i < N; i++) {
    const a = (-150 + i * 37.5 + (rnd() - 0.5) * 8) * PI / 180, r = R0 + (rnd() - 0.5) * 0.9, lx = Math.sin(a) * r, lz = -Math.cos(a) * r, yaw = a + PI + (rnd() - 0.5) * 0.5;
    stationPos.push([lx, lz, r, cableCols[i]]);
    const t = stationTypes[i], Yw = L.yaw + yaw;
    kb.at(lx, lz, yaw);
    let tagY = 1.0;
    if (t === 'dish') {
      tripod(1.15, 0.62); const d = aim(Yw);
      kb.rod('metal', [0, 1.15, 0], [0, 1.35, 0], 0.018, 0.018, K.dark, 6);
      kb.dish('metal', 0.32, 0.09, [0, 1.42, 0], upQ(d), K.alu, 20, 4); kb.rod('metal', [0, 1.42, 0], [d.x * 0.34, 1.42 + d.y * 0.34, d.z * 0.34], 0.008, 0.008, K.steel, 4);
      kb.sph('metal', 0.03, [d.x * 0.34, 1.42 + d.y * 0.34, d.z * 0.34], K.dark, 1, [6, 4]);
      tagY = 0.85;
    } else if (t === 'geo') {
      kb.add('metal', new THREE.ConeGeometry(0.035, 0.45, 6), [0, -0.1, 0], [PI, 0, 0], 1, K.steel);
      kb.cyl('paint', 0.07, 0.08, 0.16, 12, [0, 0.08, 0], null, K.case); kb.cyl('paint', 0.075, 0.075, 0.03, 12, [0, 0.175, 0], null, K.orange);
      kb.rod('metal', [0.12, 0.0, 0], [0.12, 0.85, 0], 0.006, 0.006, K.steel, 4); kb.add('paint', new THREE.CircleGeometry(0.1, 3), [0.19, 0.78, 0], [0, PI / 2, 0.4], 1, K.orange);
      kb.box('paint', 0.18, 0.07, 0.12, [-0.22, 0.035, 0.05], [0, 0.3, 0], K.mustard); kb.sph('glow', 0.012, [-0.2, 0.073, 0.0], [0.3, 2.6, 1.0], 1, [6, 4]);
      tagY = 0.5;
    } else if (t === 'mic') {
      tripod(1.0, 0.55); kb.rod('metal', [0, 1.0, 0], [0.4, 1.12, 0], 0.012, 0.012, K.dark, 5);
      kb.sph('paint', 0.1, [0.46, 1.14, 0], 0x7d838a, [1.0, 1.0, 1.5], [10, 8]); kb.rod('metal', [0.2, 1.06, 0], [0.34, 1.1, 0], 0.006, 0.006, K.steel, 3);
      tagY = 0.75;
    } else if (t === 'yagi') {
      kb.rod('metal', [0, 0, 0], [0, 2.3, 0], 0.024, 0.016, K.alu, 6); kb.cyl('paint', 0.1, 0.12, 0.04, 8, [0, 0.02, 0], null, K.rubber);
      for (const [yy, hl] of [[2.0, 0.34], [2.12, 0.3], [2.24, 0.26], [2.36, 0.22]]) kb.rod('metal', [-hl, yy, 0], [hl, yy, 0], 0.007, 0.007, K.alu, 4);
      kb.rod('metal', [0, 1.95, -0.0], [0, 2.38, 0.0], 0.02, 0.02, K.dark, 5);
      for (let k = 0; k < 3; k++) { const b = k / 3 * TAU + 0.6; kb.rod('metal', [0, 1.6, 0], [Math.sin(b) * 1.1, 0.02, Math.cos(b) * 1.1], 0.004, 0.004, K.carbon, 3); }
      tagY = 1.3;
    } else if (t === 'probe') {
      kb.box('paint', 0.2, 0.05, 0.2, [0, 0.025, 0], null, K.case); for (let k = 0; k < 3; k++) { const b = k / 3 * TAU; kb.cyl('metal', 0.012, 0.012, 0.3, 5, [Math.sin(b) * 0.12, 0.0, Math.cos(b) * 0.12], [Math.cos(b) * 0.4, 0, -Math.sin(b) * 0.4], K.steel); }
      kb.cyl('metal', 0.035, 0.035, 1.3, 10, [0, 0.7, 0], null, K.alu); for (const yy of [0.35, 0.8, 1.2]) kb.cyl('paint', 0.04, 0.04, 0.025, 10, [0, yy, 0], null, K.orange);
      kb.sph('glow', 0.045, [0, 1.38, 0], [0.4, 2.8, 3.4], 1, [10, 8]);
      tagY = 0.9;
    } else {
      tripod(0.9, 0.5); kb.cyl('metal', 0.05, 0.28, 0.5, 14, [0, 1.2, 0], [0.5, 0, 0.25], K.alu, true); kb.cyl('paint', 0.07, 0.07, 0.1, 10, [0, 0.98, 0], null, K.dark);
      tagY = 0.7;
    }
    { const ledY = { dish: 1.15, geo: 0.2, mic: 1.04, yagi: 2.4, probe: 1.45, horn: 0.99 }[t] ?? 1.0; kb.sph('glow', 0.017, [0.0, ledY, 0.065], [[0.3, 2.6, 1.0], [2.8, 0.9, 0.2], [0.3, 2.2, 2.8]][i % 3], 1, [6, 4]); }
    const [px, pz] = L.xz(lx, lz);
    const faceW = Math.atan2(slot.x - px, slot.z - pz);                          // tag faces the console
    addTag(px + Math.sin(faceW) * 0.17, env.groundY(px, pz) + tagY, pz + Math.cos(faceW) * 0.17, faceW, i % 8);
    cylC(lx, lz, 0.3, 1.4);
  }
  // cables to the console, laid on the ground with a lazy serpentine
  for (let i = 0; i < N; i++) {
    const [lx, lz, r, col] = stationPos[i], a = Math.atan2(lx, -lz), pts = [];
    kb.world();
    for (let s = 0; s <= 9; s++) {
      const t = s / 9, rr = lerp(r - 0.35, 0.95, t), aa = a + Math.sin(t * 6 + i) * 0.045 * (1 - t) + (t > 0.7 ? (i - 4) * 0.04 * (t - 0.7) : 0);
      const [x, z] = L.xz(Math.sin(aa) * rr, -Math.cos(aa) * rr); pts.push([x, env.groundY(x, z) + 0.02, z]);
    }
    kb.tube('paint', pts, 0.012, col, 20, 4);
  }

  // ───────── mast with the galaxy-facing dish (carries the violet beacon) ─────────
  const mx = -2.6, mz = -1.5;
  kb.at(mx, mz, 0);
  kb.rod('metal', [0, 0, 0], [0, 1.9, 0], 0.05, 0.045, K.alu, 8); kb.rod('metal', [0, 1.9, 0], [0, 3.7, 0], 0.04, 0.036, K.steel, 8); kb.rod('metal', [0, 3.7, 0], [0, 4.5, 0], 0.012, 0.008, K.steel, 5);
  kb.cyl('metal', 0.058, 0.058, 0.07, 8, [0, 1.9, 0], null, K.dark);
  for (let i = 0; i < 3; i++) { const a2 = i / 3 * TAU + 0.5; kb.rod('metal', [0, 0.8, 0], [Math.sin(a2) * 0.7, 0.03, Math.cos(a2) * 0.7], 0.018, 0.018, K.alu, 5); kb.cyl('paint', 0.06, 0.07, 0.025, 8, [Math.sin(a2) * 0.7, 0.012, Math.cos(a2) * 0.7], null, K.rubber); }
  for (const deg of [20, 140, 260]) { const a2 = deg * PI / 180; kb.rod('metal', [0, 3.5, 0], [Math.sin(a2) * 3.0, 0.04, Math.cos(a2) * 3.0], 0.006, 0.006, K.carbon, 4); kb.cyl('metal', 0.012, 0.012, 0.3, 5, [Math.sin(a2) * 3.0, 0.07, Math.cos(a2) * 3.0], [0.5 * Math.cos(a2), 0, -0.5 * Math.sin(a2)], K.steel); }
  { const Yw = L.yaw, d = aim(Yw), dp = [0.34, 3.3, 0.05];
    kb.rod('metal', [0, 3.25, 0], [dp[0], dp[1] - 0.04, dp[2]], 0.014, 0.012, K.steel, 5);
    kb.dish('metal', 0.4, 0.12, dp, upQ(d), K.alu, 22, 4); kb.rod('metal', dp, [dp[0] + d.x * 0.42, dp[1] + d.y * 0.42, dp[2] + d.z * 0.42], 0.008, 0.008, K.steel, 4);
    kb.box('paint', 0.1, 0.07, 0.07, [dp[0] + d.x * 0.42, dp[1] + d.y * 0.42, dp[2] + d.z * 0.42], null, K.dark); }
  kb.box('glow', 0.016, 0.016, 0.016, [0.06, 3.98, 0], null, [3.2, 0.3, 0.2]);
  cylC(mx, mz, 0.22, 4.4);

  // ───────── materials → meshes ─────────
  const tTag = tagTexture(kit), tGlow = glowTexture(kit), tPrint = printTexture(kit);
  const add = (m) => { if (m) group.add(m); return m; };
  add(kb.mesh('metal', M.metal)); add(kb.mesh('paint', M.paint)); add(kb.mesh('glow', M.glow, { weather: false, cast: false, receive: false }));
  add(kb.mesh('tape', kit.std({ map: tTag, roughness: 0.9, metalness: 0, vertexColors: true, side: THREE.DoubleSide }), { weather: false, cast: false }));
  const mScreen = kit.screen(scr.tex, 2.0); add(kb.mesh('screen', mScreen, { weather: false, cast: false, receive: false }));
  if (tags.length) group.add(new THREE.Mesh(mergeGeometries(tags, false), kit.std({ map: tTag, roughness: 0.92, metalness: 0, side: THREE.DoubleSide })));

  // ───────── light pools: cyan screen spill + faint ring glow ─────────
  const [cx0, cz0] = L.xz(0, 0.9), [mx0, mz0] = L.xz(mx, mz), dg = [decalQuad(env, cx0, cz0, 3.6, 3.0, L.yaw, 0.02, [0.04, 0.2, 0.26]), decalQuad(env, mx0, mz0, 1.1, 1.1, 0, 0.022, [0.12, 0.08, 0.22])];
  for (const [slx, slz] of stationPos) { const [wx, wz] = L.xz(slx, slz); dg.push(decalQuad(env, wx, wz, 0.8, 0.8, 0, 0.021, [0.05, 0.2, 0.3], 2)); }   // phosphor calibration rings
  { const dm = new THREE.Mesh(mergeDecals(dg), decalMat(tGlow)); dm.renderOrder = 2; group.add(dm); }
  const consoleLight = kit.pointLight(0x6fd8ff, 6.5, 13, [0, 0, 0]); { const [lx, lz] = L.xz(0.05, 0.75); consoleLight.position.set(lx, env.groundY(lx, lz) + 1.2, lz); } group.add(consoleLight);
  const bp = L.pos(mx, 4.55, mz), beacon = kit.beacon([bp.x, bp.y, bp.z], { color: 0xd2c0ff, size: 0.12, lightI: 7, range: 20, period: 3.4, duty: 0.4, phase: 0.18 }); group.add(beacon.group);

  // ───────── footprints: chair, console, round the ring ─────────
  const pp = [{ pts: [[0.2, 6.0], [0.6, 4.2], [0.9, 2.6]], s: 1 }, { pts: [[0.9, 2.6], [-0.9, 1.2], [-1.2, 0.2]], s: -1 }, { pts: [[-1.2, 0.2], [-3.5, 2.2], [-5.5, 3.6]], s: 1 }, { pts: [[-0.9, 1.2], [1.4, -0.9], [3.4, -2.8]], s: -1, stride: 0.7 }];
  { const pg = printsGeo(env, L, pp, rnd); if (pg) { const pm = new THREE.Mesh(pg, kit.std({ map: tPrint, color: 0x07090e, transparent: true, opacity: 0.8, depthWrite: false, roughness: 1, metalness: 0, alphaTest: 0.02 })); pm.renderOrder = 3; group.add(pm); } }

  // ───────── TOMAS's recorder ─────────
  const rec = consolidate(recorderStyle(kit.recorder({ title: 'TOMAS', sub: 'GARDEN LOG', accent: '#9ee6ff' }), 0x66727e, 0x2aa8c8));
  { const [rx, rz] = L.xz(2.3, 1.9); rec.position.set(rx, env.groundY(rx, rz) + 0.61, rz); rec.rotation.set(0, L.yaw - 0.35, 0); kit.shadows(rec, true, true); group.add(rec); }
  interactables.push(kit.interactable({ id: 'log.elysium.3', label: 'Play TOMAS\u2019s recorder', pos: rec.position.clone().add(new THREE.Vector3(0, 0.1, 0)), radius: 2.4, object: rec, lineId: 'log.elysium.3', log: true }));

  // ───────── animation ─────────
  const cl0 = consoleLight.intensity; let acc = 0;
  const cons = L.pos(0, 1.0, 0);
  ups.push((dt, t, cam) => {
    beacon.update(t); rec.userData.ledUpdate?.(t);
    consoleLight.intensity = cl0 * (0.94 + 0.06 * Math.sin(t * 5.3) * Math.sin(t * 1.9));
    const d2 = cam ? cam.distanceToSquared(cons) : 0, period = d2 < 70 * 70 ? 0.25 : 1.0;      // screen redraw ≈ 4 Hz (1 Hz when far)
    acc += dt; if (acc >= period) { acc = 0; scr.draw(t); }
  });
  return { group, interactables, colliders, update: (dt, t, cam) => { for (const u of ups) u(dt, t, cam); } };
}


