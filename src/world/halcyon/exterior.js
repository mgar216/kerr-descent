// HALCYON — station exterior (≈1.6 km research station orbiting Erebus). Pure procedural, merged geometry (~25 draw calls).
//
// Build frame ("O", easy to reason about): spine along Z (forward/docking hub at −Z), Erebus toward +X, ring axis = Z.
// Published frame ("N", what WORLDS places in the world): +X prograde, +Y orbit normal, +Z radially outward from Erebus
// (so Erebus is toward −Z).   N = M·O :  x_n = −z_o,  y_n = −y_o,  z_n = −x_o   (a proper rotation).
// The whole O-frame model hangs under one matrix-only group, so nothing else needs to know.
import { getGfx } from './gfx.js';

const TAU = Math.PI * 2;
const toN = (p) => [-p[2] + 0, -p[1] + 0, -p[0] + 0];

// ───────────── published constants (station-local = N frame, metres) ─────────────
const O_DOCK = { pos: [0, -73.8, -702.6], normal: [0, -1, 0], up: [0, 0, 1] };
/** Orpheus berth. pos = centre of the docking-port face; dir/normal = outward unit vector a visiting ship approaches
 *  along; up = the visiting ship's deck-up when clamped (⊥ normal). Ship axes when docked: +X_ship = normal,
 *  +Y_ship = up, +Z_ship = normal × up  →  the ship's nose points at Erebus. */
export const HALCYON_DOCK = { pos: toN(O_DOCK.pos), dir: toN(O_DOCK.normal), normal: toN(O_DOCK.normal), up: toN(O_DOCK.up) };
/** unit vector (station-local) toward Erebus: the observation blister, comms dish, solar arrays and lettering face it */
export const HALCYON_EREBUS_DIR = toN([1, 0, 0]);

const RING = { R: 450, depth: 34, hw: 25, zc: -260, spokes: 6, omega: 0.07 };
const HUB = { zc: -700, R: 62 };
const RADIUS = 850;

// ───────────── colours (linear multipliers on the white panel texture) ─────────────
const C = {
  w: [1, 1, 1], w2: [0.94, 0.96, 1.0], w3: [1.0, 0.97, 0.92],
  orange: [1.45, 0.24, 0.02], orangeD: [0.9, 0.17, 0.015],
  dark: [0.17, 0.19, 0.21], dark2: [0.1, 0.11, 0.13], steel: [0.42, 0.45, 0.48],
};

// ───────────── textures ─────────────
function fontsThen(fn) {
  fn();
  try {
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load("700 80px Orbitron"), document.fonts.load("500 40px Rajdhani")]).then(() => fn()).catch(() => {});
    }
  } catch (e) { /* no font API */ }
}

function hullTextures(G) {
  const N = 1024, CL = 128;
  const col = G.cv(N, N), bmp = G.cv(N, N), g = col.g, b = bmp.g, R = G.rng(21);
  g.fillStyle = '#d3d6d8'; g.fillRect(0, 0, N, N);
  b.fillStyle = '#808080'; b.fillRect(0, 0, N, N);
  const dot = (x, y, r, c1, bc) => { g.fillStyle = c1; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); b.fillStyle = bc; b.beginPath(); b.arc(x, y, r, 0, TAU); b.fill(); };
  for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) {
    const x = cx * CL, y = cy * CL;
    const t = 0.91 + R() * 0.11, v = Math.round(212 * t);
    g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(x, y, CL, CL);
    // bevels
    g.fillStyle = 'rgba(255,255,255,0.38)'; g.fillRect(x + 3, y + 3, CL - 6, 2); g.fillRect(x + 3, y + 3, 2, CL - 6);
    g.fillStyle = 'rgba(70,76,84,0.30)'; g.fillRect(x + 3, y + CL - 5, CL - 6, 2); g.fillRect(x + CL - 5, y + 3, 2, CL - 6);
    // rivets along the edges
    for (let k = 10; k < CL; k += 16) { dot(x + k, y + 9, 1.6, 'rgba(90,96,104,0.7)', '#a0a0a0'); dot(x + k, y + CL - 9, 1.6, 'rgba(90,96,104,0.7)', '#a0a0a0'); }
    for (let k = 26; k < CL - 16; k += 16) { dot(x + 9, y + k, 1.6, 'rgba(90,96,104,0.7)', '#a0a0a0'); dot(x + CL - 9, y + k, 1.6, 'rgba(90,96,104,0.7)', '#a0a0a0'); }
    const f = R();
    if (f < 0.17) { // access hatch
      g.fillStyle = 'rgba(80,88,98,0.55)'; G.rrect(g, x + 28, y + 30, 72, 52, 6); g.fill();
      g.fillStyle = 'rgba(232,236,240,0.9)'; G.rrect(g, x + 31, y + 33, 66, 46, 5); g.fill();
      g.fillStyle = 'rgba(60,66,74,0.8)'; g.fillRect(x + 56, y + 52, 16, 5);
      b.fillStyle = '#505050'; G.rrect(b, x + 28, y + 30, 72, 52, 6); b.fill(); b.fillStyle = '#909090'; G.rrect(b, x + 31, y + 33, 66, 46, 5); b.fill();
    } else if (f < 0.3) { // vent slots
      for (let k = 0; k < 7; k++) { g.fillStyle = 'rgba(52,58,66,0.8)'; g.fillRect(x + 34, y + 34 + k * 8, 60, 3); b.fillStyle = '#303030'; b.fillRect(x + 34, y + 34 + k * 8, 60, 4); }
    } else if (f < 0.39) { // orange stripe block
      g.fillStyle = 'rgba(232,104,28,0.88)'; g.fillRect(x + 14, y + 52, CL - 28, 14); b.fillStyle = '#8c8c8c'; b.fillRect(x + 14, y + 52, CL - 28, 14);
    } else if (f < 0.49) { // panel id text
      g.fillStyle = 'rgba(60,66,74,0.75)'; g.font = '600 15px "Share Tech Mono", monospace'; g.fillText('H-' + String.fromCharCode(65 + ((R() * 8) | 0)) + (10 + ((R() * 89) | 0)), x + 22, y + 70);
    } else if (f < 0.55) { // hazard chevrons
      for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? 'rgba(28,30,34,0.85)' : 'rgba(240,190,40,0.9)'; g.fillRect(x + 16 + k * 18, y + 96, 14, 10); }
    }
  }
  // seams (drawn on cell borders incl. x=0/y=0 so the tile is seamless)
  for (let k = 0; k <= 8; k++) {
    const p = k * CL;
    g.fillStyle = 'rgba(86,92,100,0.78)'; g.fillRect(p - 1.5, 0, 3, N); g.fillRect(0, p - 1.5, N, 3);
    b.fillStyle = '#242424'; b.fillRect(p - 2, 0, 4, N); b.fillRect(0, p - 2, N, 4);
  }
  // grime streaks
  for (let k = 0; k < 90; k++) {
    const x = R() * N, y = R() * N, h = 40 + R() * 220;
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(40,36,30,0.0)'); gr.addColorStop(0.3, `rgba(40,36,30,${0.03 + R() * 0.06})`); gr.addColorStop(1, 'rgba(40,36,30,0)');
    g.fillStyle = gr; g.fillRect(x, y, 2 + R() * 5, h);
  }
  return { map: G.tex(col), bump: G.tex(bmp, { linear: true }) };
}

function solarTexture(G) {
  const N = 512, cv = G.cv(N, N), g = cv.g, cell = 64;
  g.fillStyle = '#7e8aa3'; g.fillRect(0, 0, N, N);
  for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 8; cx++) {
    const x = cx * cell, y = cy * cell;
    const gr = g.createLinearGradient(x, y, x + cell, y + cell); gr.addColorStop(0, '#16356f'); gr.addColorStop(0.5, '#0d2352'); gr.addColorStop(1, '#0a1a3e');
    g.fillStyle = gr; g.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    g.fillStyle = 'rgba(150,175,225,0.55)';
    for (let k = 1; k < 5; k++) g.fillRect(x + 2 + k * 11.6, y + 2, 1, cell - 4);
    g.fillStyle = 'rgba(190,205,235,0.5)'; g.fillRect(x + 2, y + cell / 2 - 1, cell - 4, 1.5);
  }
  return G.tex(cv);
}

function radiatorTexture(G) {
  const N = 512, cv = G.cv(N, N), g = cv.g, R = G.rng(5);
  g.fillStyle = '#e7eaec'; g.fillRect(0, 0, N, N);
  for (let y = 0; y < N; y += 16) { g.fillStyle = 'rgba(150,160,168,0.45)'; g.fillRect(0, y, N, 2); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, y + 2, N, 1); }
  for (let k = 0; k <= 4; k++) { const p = k * 128; g.fillStyle = 'rgba(90,98,106,0.85)'; g.fillRect(p - 2, 0, 4, N); g.fillRect(0, p - 2, N, 4); }
  for (let k = 0; k < 14; k++) { const x = (R() * 4 | 0) * 128 + 12, y = (R() * 4 | 0) * 128 + 12; g.fillStyle = 'rgba(232,104,28,0.9)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 26, y); g.lineTo(x + 13, y + 22); g.closePath(); g.fill(); }
  for (let k = 0; k < 70; k++) { const x = R() * N, y = R() * N; g.fillStyle = `rgba(60,56,50,${0.02 + R() * 0.05})`; g.fillRect(x, y, 3 + R() * 6, 40 + R() * 90); }
  return G.tex(cv);
}

function goldTexture(G) {
  const N = 256, cv = G.cv(N, N), g = cv.g, R = G.rng(9);
  g.fillStyle = '#c79a45'; g.fillRect(0, 0, N, N);
  for (let k = 0; k < 220; k++) {
    const x = R() * N, y = R() * N, s = 10 + R() * 40, a = R() * TAU, l = R() < 0.5;
    g.fillStyle = l ? `rgba(255,226,150,${0.1 + R() * 0.25})` : `rgba(90,60,12,${0.1 + R() * 0.25})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); g.lineTo(x + Math.cos(a + 1.9) * s * 0.8, y + Math.sin(a + 1.9) * s * 0.8); g.closePath(); g.fill();
    // wrap copies so the tile is seamless
    for (const [ox, oy] of [[N, 0], [-N, 0], [0, N], [0, -N]]) { g.save(); g.translate(ox, oy); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); g.lineTo(x + Math.cos(a + 1.9) * s * 0.8, y + Math.sin(a + 1.9) * s * 0.8); g.closePath(); g.fill(); g.restore(); }
  }
  return G.tex(cv);
}

function winTextures(G, W, H, cols, rows, seed, o = {}) {
  const col = G.cv(W, H), em = G.cv(W, H), g = col.g, e = em.g, R = G.rng(seed);
  g.fillStyle = o.frame || '#1d242c'; g.fillRect(0, 0, W, H);
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  const px = (o.padX ?? 0.17) * cw, py = (o.padY ?? 0.2) * ch;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = c * cw + px, y = r * ch + py, w = cw - 2 * px, h = ch - 2 * py, rad = Math.min(w, h) * 0.2;
    const gg = g.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#101820'); gg.addColorStop(1, '#070b10');
    g.fillStyle = gg; G.rrect(g, x, y, w, h, rad); g.fill();
    g.strokeStyle = 'rgba(120,135,150,0.5)'; g.lineWidth = 1; G.rrect(g, x, y, w, h, rad); g.stroke();
    const k = R();
    if (k < (o.off ?? 0.1)) continue;
    const tint = k < 0.78 ? [255, 228, 180] : k < 0.9 ? [208, 234, 255] : [255, 176, 92];
    const br = 0.5 + 0.5 * R();
    e.fillStyle = `rgb(${(tint[0] * br) | 0},${(tint[1] * br) | 0},${(tint[2] * br) | 0})`; G.rrect(e, x, y, w, h, rad); e.fill();
    if (R() < 0.22) { e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(x, y + h * 0.42, w, h * 0.58); }
  }
  return { color: G.tex(col), emis: G.tex(em) };
}

function lettersTexture(G, text, W, H, o = {}) {
  const cv = G.cv(W, H), g = cv.g;
  const tex = G.tex(cv, { clamp: true });
  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = o.color || '#262c33';
    g.textBaseline = 'alphabetic';
    const size = Math.round(H * (o.size ?? 0.84));
    g.font = `800 ${size}px Orbitron, 'Eurostile', 'Bank Gothic', 'Arial Black', 'Segoe UI', sans-serif`;
    G.spaced(g, text, W / 2, H * (o.baseline ?? 0.74), size * (o.spacing ?? 0.16), 'center');
    if (o.stripe) { g.fillStyle = '#e8681c'; g.fillRect(W * 0.03, H * 0.84, W * 0.94, H * 0.06); g.fillStyle = '#262c33'; g.fillRect(W * 0.03, H * 0.92, W * 0.46, H * 0.03); }
    tex.needsUpdate = true;
  };
  fontsThen(draw);
  return tex;
}

function berthTexture(G) {
  const W = 1024, H = 512, cv = G.cv(W, H), g = cv.g;
  const tex = G.tex(cv, { clamp: true });
  const draw = () => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(236,238,240,0.96)'; G.rrect(g, 8, 8, W - 16, H - 16, 26); g.fill();
    g.strokeStyle = '#e8681c'; g.lineWidth = 16; G.rrect(g, 20, 20, W - 40, H - 40, 20); g.stroke();
    for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? '#1c2026' : '#f2b21c'; g.fillRect(40 + k * 66, 36, 40, 22); g.fillRect(40 + k * 66, H - 58, 40, 22); }
    g.fillStyle = '#1c2026'; g.font = "800 150px Orbitron, 'Arial Black', sans-serif"; g.textBaseline = 'alphabetic';
    G.spaced(g, 'BERTH 01', W / 2, 250, 10, 'center');
    g.font = "600 62px Rajdhani, 'Segoe UI', sans-serif"; g.fillStyle = '#3a424c';
    G.spaced(g, 'ORPHEUS  ·  HX-02  ·  PORT AIRLOCK', W / 2, 340, 5, 'center');
    g.fillStyle = '#e8681c'; for (let k = 0; k < 5; k++) { g.beginPath(); const x = 250 + k * 130; g.moveTo(x, 380); g.lineTo(x + 70, 380); g.lineTo(x + 105, 424); g.lineTo(x + 35, 424); g.closePath(); g.globalAlpha = 0.35 + 0.13 * k; g.fill(); } g.globalAlpha = 1;
    tex.needsUpdate = true;
  };
  fontsThen(draw);
  return tex;
}

// ───────────── materials ─────────────
function makeMaterials(THREE, G) {
  const hull = hullTextures(G);
  // exposure scaling is stored on the materials (userData survives material.clone(), which the far pass does)
  const reg = { emissive: { push: ({ mat, base }) => { mat.userData.hE = base; } }, basic: { push: ({ mat }) => { mat.userData.hC = [1, 1, 1]; } } };
  const winHub = winTextures(G, 1024, 64, 16, 1, 31, { padX: 0.2, padY: 0.22 });
  const winRingIn = winTextures(G, 1024, 256, 20, 3, 33, { padX: 0.14, padY: 0.2, off: 0.14 });
  const winRingOut = winTextures(G, 1024, 80, 32, 1, 35, { padX: 0.22, padY: 0.24, off: 0.12 });
  const winMod = winTextures(G, 512, 64, 12, 1, 37, { padX: 0.18, padY: 0.2 });

  const stdWin = (w, intensity) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, map: w.color, emissive: 0xffffff, emissiveMap: w.emis, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.55 });
    reg.emissive.push({ mat: m, base: intensity });
    return m;
  };
  const basicGlow = (vertexColors = true, color = 0xffffff) => {
    const m = new THREE.MeshBasicMaterial({ color, vertexColors, toneMapped: false });
    reg.basic.push({ mat: m, base: new THREE.Color(color) });
    return m;
  };
  const hullEm = 0.012;
  const mHull = new THREE.MeshStandardMaterial({ map: hull.map, bumpMap: hull.bump, bumpScale: 2.2, roughness: 0.55, metalness: 0.12, vertexColors: true, emissive: 0x9aa4b2, emissiveIntensity: hullEm });
  reg.emissive.push({ mat: mHull, base: hullEm });
  const mDark = new THREE.MeshStandardMaterial({ map: hull.map, bumpMap: hull.bump, bumpScale: 2.2, roughness: 0.5, metalness: 0.65, vertexColors: true, emissive: 0x6a7482, emissiveIntensity: hullEm });
  reg.emissive.push({ mat: mDark, base: hullEm });
  const mDish = new THREE.MeshStandardMaterial({ map: hull.map, bumpMap: hull.bump, bumpScale: 2.0, roughness: 0.42, metalness: 0.2, vertexColors: true, side: THREE.DoubleSide, emissive: 0x9aa4b2, emissiveIntensity: hullEm });
  reg.emissive.push({ mat: mDish, base: hullEm });
  const goldTex = goldTexture(G);
  const mGold = new THREE.MeshStandardMaterial({ map: goldTex, roughness: 0.36, metalness: 0.88, vertexColors: true, emissive: 0x8a6a28, emissiveIntensity: 0.01 });
  reg.emissive.push({ mat: mGold, base: 0.01 });
  const solar = solarTexture(G);
  const mSolar = new THREE.MeshStandardMaterial({ map: solar, roughness: 0.3, metalness: 0.65, vertexColors: true, emissive: 0x1a3b7a, emissiveIntensity: 0.03 });
  reg.emissive.push({ mat: mSolar, base: 0.03 });
  const mRad = new THREE.MeshStandardMaterial({ map: radiatorTexture(G), roughness: 0.55, metalness: 0.06, vertexColors: true, emissive: 0xb0b8c0, emissiveIntensity: 0.012 });
  reg.emissive.push({ mat: mRad, base: 0.012 });
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x7fb4dc, transparent: true, opacity: 0.1, roughness: 0.22, metalness: 0.0, depthWrite: false, side: THREE.DoubleSide, vertexColors: true });
  const mLetters = new THREE.MeshStandardMaterial({ map: lettersTexture(G, 'HALCYON', 2048, 256, { stripe: true, spacing: 0.4 }), transparent: true, alphaTest: 0.4, roughness: 0.6, metalness: 0.05, vertexColors: true, emissive: 0x9aa4b2, emissiveIntensity: hullEm });
  reg.emissive.push({ mat: mLetters, base: hullEm });
  const mBerth = new THREE.MeshStandardMaterial({ map: berthTexture(G), transparent: true, alphaTest: 0.4, roughness: 0.6, metalness: 0.05, vertexColors: true, emissive: 0x9aa4b2, emissiveIntensity: 0.05 });
  reg.emissive.push({ mat: mBerth, base: 0.05 });
  return {
    reg, hull: mHull, dark: mDark, dish: mDish, gold: mGold, solar: mSolar, rad: mRad, glass: mGlass, letters: mLetters, berth: mBerth,
    winHub: stdWin(winHub, 1.7), winMod: stdWin(winMod, 1.5), winRingIn: stdWin(winRingIn, 1.55), winRingOut: stdWin(winRingOut, 1.6),
    glow: basicGlow(true), ringGlow: basicGlow(true),
    glowW: (() => { const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false }); reg.basic.push({ mat: m, base: new THREE.Color(0xffffff) }); return m; })(),
  };
}

// ───────────── main builder ─────────────
export function buildHalcyonExterior(THREE) {
  const G = getGfx(THREE);
  const { Vector3, Quaternion, Matrix4 } = THREE;
  const M = makeMaterials(THREE, G);
  const S = {}, RB = {};
  for (const k of ['hull', 'dark', 'gold', 'winHub', 'winMod', 'solar', 'rad', 'dish', 'glass', 'glow', 'glowW', 'letters', 'berth']) S[k] = new G.Bucket(k);
  for (const k of ['hull', 'dark', 'winIn', 'winOut', 'glow', 'letters']) RB[k] = new G.Bucket('ring_' + k);

  const qZ = (a) => new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), a);
  const qY = (a) => new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), a);
  const qX = (a) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), a);
  const rnd = G.rng(77);
  const box = (B, cx, cy, cz, sx, sy, sz, q, col) => B.addGeo(G.unitBox(), new Matrix4().compose(new Vector3(cx, cy, cz), q || new Quaternion(), new Vector3(sx, sy, sz)), { col, su: Math.max(sx, sz) / 8, sv: Math.max(sy, sz) / 8 });
  const dirQ = (from, to) => new Quaternion().setFromUnitVectors(from, to);

  // ring band helper: thick band (outer wall + side walls) about the Z axis
  const band = (B, r, z0, z1, thick, segs, col, extra = {}) => {
    B.revolve(r, z0, r, z1, { segs, col, tile: 8, ...extra });
    B.revolve(r - thick, z0, r, z0, { segs, col, tile: 8, ...extra });
    B.revolve(r, z1, r - thick, z1, { segs, col, tile: 8, ...extra });
  };
  // capped cylinder module along Z
  const cylModule = (o) => {
    const { zA, zB, r, tint = C.w, segs = Math.max(24, Math.round(r * 1.6)), x = 0, y = 0, collar = true, windows = 0, ribs = 0 } = o;
    const xf = (x || y) ? new Matrix4().makeTranslation(x, y, 0) : null;
    const op = (extra = {}) => ({ segs, col: tint, tile: 16, xf, ...extra });
    S.hull.revolve(r, zA, r, zB, op());
    S.hull.revolve(0, zA, r, zA, op());
    S.hull.revolve(r, zB, 0, zB, op());
    if (collar) for (const zc of [zA + 1.6, zB - 1.6]) {
      const th = 1.4;
      S.dark.revolve(r + 0.9, zc - th, r + 0.9, zc + th, op({ col: C.dark }));
      S.dark.revolve(r - 0.2, zc - th, r + 0.9, zc - th, op({ col: C.dark }));
      S.dark.revolve(r + 0.9, zc + th, r - 0.2, zc + th, op({ col: C.dark }));
    }
    for (let k = 1; k <= ribs; k++) {
      const zc = zA + ((zB - zA) * k) / (ribs + 1);
      S.hull.revolve(r + 0.55, zc - 0.7, r + 0.55, zc + 0.7, op({ col: C.w2, tile: 4 }));
      S.hull.revolve(r, zc - 0.7, r + 0.55, zc - 0.7, op({ col: C.w2, tile: 4 }));
      S.hull.revolve(r + 0.55, zc + 0.7, r, zc + 0.7, op({ col: C.w2, tile: 4 }));
    }
    // window rows (overlay shell, slightly proud)
    const len = zB - zA;
    for (let k = 0; k < windows; k++) {
      const zc = zA + (len * (k + 1)) / (windows + 1);
      S.winMod.revolve(r + 0.14, zc - 2, r + 0.14, zc + 2, op({ uRep: Math.max(2, Math.round((TAU * r) / 42)), v0: 0, v1: 1, col: C.w }));
    }
  };

  // ═══════════════ HUB (docking hub, forward end) ═══════════════
  const hz = HUB.zc, HR = HUB.R;
  {
    const seg = 128;
    // nose cylinder + face
    S.hull.revolve(18, hz - 92, 18, hz - 64, { segs: 48, col: C.w2 });
    S.hull.revolve(18, hz - 64, 46, hz - 64, { segs: 96, col: C.w3 });
    S.hull.revolve(46, hz - 64, HR, hz - 48, { segs: seg, col: C.w });
    // the +X observation blister opens the shell: a stepped circular hole (radius 24 m) around (θ = 0, z = hz)
    const holeHalf = (zc) => { const h2 = 24 * 24 - (zc - hz) * (zc - hz); return h2 > 0 ? Math.sqrt(h2) / HR : 0; };
    {
      const zl = hz - 24, zh = hz + 24, o = { segs: seg, col: C.w };
      S.hull.revolve(HR, hz - 48, HR, zl, o);
      S.hull.revolve(HR, zh, HR, hz + 48, o);
      const n = 24;
      for (let i = 0; i < n; i++) {
        const za = zl + ((zh - zl) * i) / n, zb = zl + ((zh - zl) * (i + 1)) / n, h = holeHalf((za + zb) / 2);
        S.hull.revolve(HR, za, HR, zb, h > 0 ? { ...o, a0: h, a1: TAU - h } : o);
      }
    }
    S.hull.revolve(HR, hz + 48, 46, hz + 64, { segs: seg, col: C.w });
    S.hull.revolve(46, hz + 64, 24, hz + 64, { segs: 96, col: C.w3 });
    // docking face (axial port): dark recess, lit rim
    S.dark.revolve(14, hz - 92.5, 18.6, hz - 92.5, { segs: 48, col: C.dark });
    S.dark.revolve(14, hz - 91, 14, hz - 92.5, { segs: 48, col: C.dark2 });
    S.dark.revolve(0, hz - 91, 14, hz - 91, { segs: 48, col: C.dark2 });
    S.glow.revolve(15.2, hz - 92.8, 17.6, hz - 92.8, { segs: 48, col: [0.5, 1.6, 2.4] });
    // nose mast
    S.dark.cyl([0, 0, hz - 92], [0, 0, hz - 132], 1.7, 0.9, 10, {});
    for (let k = 0; k < 3; k++) S.hull.cyl([0, 0, hz - 98 - k * 11], [0, 0, hz - 99.2 - k * 11], 3.4, 3.4, 12, { col: C.orange });
    // shoulders accent rings (orange) & big structural collars
    for (const zc of [hz - 48.7, hz + 48.7]) band(S.dark, HR + 1.2, zc - 1.6, zc + 1.6, 2.4, seg, C.dark);
    band(S.hull, HR + 0.5, hz - 0.9, hz + 0.9, 1.0, seg, C.orange, { a0: 0.5, a1: TAU - 0.5 });   // deck-0 orange stripe
    for (const zc of [hz - 9.8, hz + 9.8]) band(S.dark, HR + 0.7, zc - 0.6, zc + 0.6, 1.2, seg, C.dark, { a0: 0.5, a1: TAU - 0.5 });
    // window rows (overlay, skipping the dock deck)
    const rows = [-44, -36.6, -29.2, -21.8, -14.4, 14.4, 21.8, 29.2, 36.6, 44];
    for (const dz of rows) {
      const h = holeHalf(hz + dz - Math.sign(dz) * 1.9);
      S.winHub.revolve(HR + 0.12, hz + dz - 1.9, HR + 0.12, hz + dz + 1.9, h > 0 ? { segs: seg, a0: h, a1: TAU - h, uRep: 6 * (1 - h / Math.PI), v0: 0, v1: 1 } : { segs: seg, uRep: 6, v0: 0, v1: 1 });
    }
    // longitudinal ribs (mullions), skipping the dock / blister arcs
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * TAU;
      const nearDock = Math.abs(Math.atan2(Math.sin(a - 1.5 * Math.PI), Math.cos(a - 1.5 * Math.PI))) < 0.17;
      const nearBlister = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.48;
      if (nearDock || nearBlister) continue;
      box(S.dark, (HR + 0.6) * Math.cos(a), (HR + 0.6) * Math.sin(a), hz, 1.3, 0.9, 94, qZ(a), C.dark);
    }
    // greebles on the shoulders: antenna masts, sensor boxes
    for (let k = 0; k < 14; k++) {
      const a = rnd() * TAU, dz = (rnd() < 0.5 ? -1 : 1) * (50 + rnd() * 8), rr = 44 + rnd() * 10;
      if (Math.abs(Math.atan2(Math.sin(a - 1.5 * Math.PI), Math.cos(a - 1.5 * Math.PI))) < 0.4) continue;
      box(S.hull, rr * Math.cos(a), rr * Math.sin(a), hz + dz * 1.0, 2 + rnd() * 3, 2 + rnd() * 3, 2 + rnd() * 3, qZ(a), C.w2);
    }
  }

  // docking collars (radial ports). a = angle in XY plane, zc = z position
  const hubPort = (a, zc, o = {}) => {
    const d = new Vector3(Math.cos(a), Math.sin(a), 0);
    const base = new Vector3(d.x * HR, d.y * HR, zc);
    const q = dirQ(new Vector3(0, 0, 1), d);
    const xf = new Matrix4().compose(base, q, new Vector3(1, 1, 1));
    const len = o.len || 11.8, r = 6.4;
    const op = (extra = {}) => ({ segs: 32, xf, tile: 8, ...extra });
    S.hull.revolve(r, -1.5, r, len, op({ col: C.w2 }));                                  // collar tube
    S.dark.revolve(r, 3.2, r + 1.0, 3.2, op({ col: C.dark })); S.dark.revolve(r + 1.0, 3.2, r + 1.0, 4.4, op({ col: C.dark })); S.dark.revolve(r + 1.0, 4.4, r, 4.4, op({ col: C.dark }));
    S.dark.revolve(r + 1.8, len - 1.7, r + 1.8, len, op({ col: C.dark }));               // docking ring
    S.dark.revolve(r, len - 1.7, r + 1.8, len - 1.7, op({ col: C.dark }));
    S.dark.revolve(r + 1.8, len, 0, len, op({ col: C.dark2 }));                          // face (hatch)
    S.dark.revolve(r + 1.0, len + 0.05, r + 1.7, len + 0.05, op({ col: C.dark2 }));
    const lit = o.lit;
    const n = 12;
    for (let k = 0; k < n; k++) {                                                        // ring lights
      const th = (k / n) * TAU, rr = r + 1.0;
      const p = new Vector3(rr * Math.cos(th), rr * Math.sin(th), len + 0.25).applyMatrix4(xf);
      box(S.glow, p.x, p.y, p.z, 0.7, 0.7, 0.7, q, lit ? [0.5, 3.2, 1.0] : [1.2, 0.7, 0.2]);
    }
    // guide fins (funnel)
    for (let k = 0; k < 4; k++) {
      const th = (k / 4) * TAU + Math.PI / 4;
      const p0 = new Vector3((r + 1.8) * Math.cos(th), (r + 1.8) * Math.sin(th), len - 0.2).applyMatrix4(xf);
      const p1 = new Vector3((r + 5.4) * Math.cos(th), (r + 5.4) * Math.sin(th), len + 4.2).applyMatrix4(xf);
      S.dark.strut([p0.x, p0.y, p0.z], [p1.x, p1.y, p1.z], 0.5, 2.2, { col: C.steel });
    }
    return { xf, q, d, tip: base.clone().addScaledVector(d, len) };
  };

  // the Orpheus berth: hub −Y (angle −90°) at the dock deck
  const berth = hubPort(-Math.PI / 2, hz + (O_DOCK.pos[2] - hz), { lit: true });
  // others
  hubPort(Math.PI / 2, hz + (O_DOCK.pos[2] - hz), { lit: false });
  hubPort(Math.PI + 0.35, hz - 30, {}); hubPort(Math.PI - 0.35, hz + 30, {}); hubPort(-0.6, hz + 34, { len: 9 });
  // a visiting cargo tender moored at the opposite (+Y) port: gives the hub a sense of scale
  {
    const zc = O_DOCK.pos[2], y0 = HR + 12.2;
    S.hull.cyl([0, y0, zc], [0, y0 + 24, zc], 4.3, 4.3, 24, { col: C.w2 });
    S.hull.cyl([0, y0 + 24, zc], [0, y0 + 33, zc], 4.3, 1.1, 24, { col: C.w });
    S.dark.cyl([0, y0 - 0.2, zc], [0, y0 + 1.6, zc], 5.0, 5.0, 24, { col: C.dark });
    for (const sx of [-1, 1]) {
      box(S.hull, sx * 7.4, y0 + 11, zc, 6.2, 15, 6.2, null, C.w3);
      S.dark.strut([sx * 4.2, y0 + 5, zc], [sx * 7.4, y0 + 5, zc], 1.2, 1.2, { col: C.steel });
      S.dark.strut([sx * 4.2, y0 + 17, zc], [sx * 7.4, y0 + 17, zc], 1.2, 1.2, { col: C.steel });
      box(S.hull, sx * 7.4, y0 + 11, zc + 3.2, 6.2, 15, 0.5, null, C.orangeD);
    }
    S.gold.sphere([0, y0 + 9, zc + 7.2], 3.2, { ws: 20, hs: 14, col: [1, 1, 1] });
    S.dark.strut([0, y0 + 9, zc + 4.2], [0, y0 + 9, zc + 6], 0.9, 0.9, { col: C.steel });
    S.glow.box(-0.5, y0 + 33.4, zc - 0.5, 0.5, y0 + 34.4, zc + 0.5, { col: [3.4, 0.12, 0.05] });
  }
  // berth marking decal on the hub surface beside the collar (faces −Y, text reads along ±X)
  {
    const zc = O_DOCK.pos[2];
    S.berth.revolve(HR + 0.14, zc - 30, HR + 0.14, zc - 12.4, { segs: 16, a0: -Math.PI / 2 - 0.28, a1: -Math.PI / 2 + 0.28, uRep: 1, v0: 0, v1: 1, col: C.w });
  }
  // floodlight stanchions around the berth
  for (const [sx, sz] of [[-13, -9], [13, -9], [-13, 9], [13, 9]]) {
    const zc = O_DOCK.pos[2];
    S.dark.strut([sx, -HR + 1, zc + sz], [sx, -HR - 5.2, zc + sz], 0.9, 0.9, { col: C.dark });
    box(S.glow, sx, -HR - 5.6, zc + sz, 1.8, 0.7, 1.8, null, [7, 7, 6.2]);
  }

  // ═══════════════ OBSERVATION BLISTER (+X, Erebus side) ═══════════════
  {
    const cx = 48, Rb = 26, th = 1.72;
    const q = qZ(-Math.PI / 2);                 // sphere pole (+Y) → +X
    const place = (px) => new Matrix4().compose(new Vector3(cx, 0, hz), q, new Vector3(px, px, px));
    S.glass.addGeo(new THREE.SphereGeometry(1, 64, 32, 0, TAU, 0, th), place(Rb), { col: [1, 1, 1] });
    // warm lit interior seen through the glass and the shell opening: full inner sphere (back faces) + a dark deck with furniture
    S.glowW.addGeo(new THREE.SphereGeometry(1, 48, 32), place(Rb - 0.9), { col: [0.85, 0.44, 0.14] });
    const fz = hz - 4;                           // deck level (ship-space floor)
    S.dark.revolve(24, fz, 0, fz, { segs: 48, col: C.dark2, xf: new Matrix4().makeTranslation(cx, 0, 0) });
    for (let k = 0; k < 11; k++) {
      const a = 0.5 + (k / 10) * (Math.PI - 1.0), rr = 13 + (k % 3) * 3.4;
      box(S.dark, cx + 6 + rr * Math.cos(a), rr * Math.sin(a) * (k % 2 ? 1 : -1), fz + 0.9, 3.2 + (k % 3), 1.6, 1.8, qZ(a), C.dark2);
    }
    for (let k = 0; k < 7; k++) {                // pendant lamps inside (bright specks)
      const a = (k / 7) * TAU, rr = 8 + (k % 2) * 7;
      box(S.glow, cx + 4 + rr * Math.cos(a), rr * Math.sin(a), hz + 6, 0.9, 0.9, 0.9, null, [3.5, 2.4, 1.2]);
    }
    // frame: meridian ribs + latitude rings
    const rib = new THREE.TorusGeometry(Rb + 0.25, 0.45, 8, 56, th);
    for (let k = 0; k < 12; k++) S.dark.addGeo(rib, new Matrix4().compose(new Vector3(cx, 0, hz), qX((k / 12) * TAU), new Vector3(1, 1, 1)), { col: C.dark });
    for (const t of [0.42, 0.78, 1.14, 1.5]) {
      const ring = new THREE.TorusGeometry(Math.sin(t) * (Rb + 0.25), 0.4, 6, 72);
      S.dark.addGeo(ring, new Matrix4().compose(new Vector3(cx + Math.cos(t) * (Rb + 0.25), 0, hz), qY(Math.PI / 2), new Vector3(1, 1, 1)), { col: C.dark });
    }
    // base ring
    const bx = cx + Math.cos(th) * Rb;
    S.dark.addGeo(new THREE.TorusGeometry(Math.sin(th) * (Rb + 0.25), 1.1, 8, 72), new Matrix4().compose(new Vector3(bx, 0, hz), qY(Math.PI / 2), new Vector3(1, 1, 1)), { col: C.dark });
    S.glow.addGeo(new THREE.TorusGeometry(Math.sin(th) * (Rb + 0.25), 0.35, 6, 72), new Matrix4().compose(new Vector3(bx + 0.6, 0, hz), qY(Math.PI / 2), new Vector3(1, 1, 1)), { col: [2.0, 1.1, 0.4] });
  }

  // ═══════════════ SPINE: forward modules, comms deck, ring hub ═══════════════
  cylModule({ zA: -636, zB: -604, r: 24, tint: C.w2, windows: 2 });
  cylModule({ zA: -604, zB: -548, r: 20, tint: C.w, windows: 3, ribs: 2 });
  cylModule({ zA: -548, zB: -540, r: 13, tint: C.w2, collar: false });
  cylModule({ zA: -540, zB: -480, r: 20, tint: C.w3, windows: 3, ribs: 2 });
  cylModule({ zA: -480, zB: -472, r: 13, tint: C.w2, collar: false });
  cylModule({ zA: -472, zB: -412, r: 20, tint: C.w, windows: 3, ribs: 2 });
  S.hull.revolve(20, -412, 26, -396, { segs: 48, col: C.w });
  cylModule({ zA: -396, zB: -300, r: 26, tint: C.w2, windows: 4, ribs: 3 });
  // orange accent bands along the forward modules
  for (const zc of [-575, -511, -443]) band(S.hull, 20.7, zc - 3, zc + 3, 1.2, 48, C.orange);
  // HALCYON lettering on the ±X flanks of the r=26 module (u runs along z, reads left→right for a viewer on that flank)
  {
    const zA = -394, zB = -302, r = 26.12, dth = 11.5 / 26;
    // viewed with the published frame's up (+Y_n = −Y_o): +X_o flank reads toward +z, −X_o flank toward −z
    S.letters.cylPatch(r, zA, zB, -dth / 2, dth / 2, { flipU: false, flipV: true, col: C.w });
    S.letters.cylPatch(r, zA, zB, Math.PI - dth / 2, Math.PI + dth / 2, { flipU: true, flipV: false, col: C.w });
  }
  // ring-hub static housing (the ring itself is a separate rotating group)
  const rz = RING.zc;
  cylModule({ zA: rz - 42, zB: rz - 26, r: 34, tint: C.w2, segs: 64, collar: true });
  cylModule({ zA: rz + 26, zB: rz + 42, r: 34, tint: C.w2, segs: 64, collar: true });
  S.hull.revolve(18, rz - 26, 18, rz + 26, { segs: 40, col: C.w2 });

  // ═══════════════ TRUSS (keel) ═══════════════
  {
    const z0 = -218, bays = 30, step = 18, h = 9;
    const corners = [[h, h], [-h, h], [-h, -h], [h, -h]];
    for (const [cx, cy] of corners) S.dark.cyl([cx, cy, z0], [cx, cy, z0 + bays * step], 0.95, 0.95, 8, { col: C.steel });
    for (let i = 0; i <= bays; i++) {
      const z = z0 + i * step;
      for (let k = 0; k < 4; k++) {
        const a = corners[k], b = corners[(k + 1) % 4];
        S.dark.strut([a[0], a[1], z], [b[0], b[1], z], 0.8, 0.8, { col: C.steel });
      }
      if (i < bays) for (let k = 0; k < 4; k++) {
        const a = corners[k], b = corners[(k + 1) % 4];
        const flip = (i + k) % 2;
        S.dark.strut([flip ? b[0] : a[0], flip ? b[1] : a[1], z], [flip ? a[0] : b[0], flip ? a[1] : b[1], z + step], 0.6, 0.6, { col: C.steel });
      }
    }
    // equipment boxes on the truss
    for (let k = 0; k < 70; k++) {
      const z = z0 + 6 + rnd() * (bays * step - 12), side = (rnd() * 4) | 0, off = (rnd() - 0.5) * 12;
      const sx = 2 + rnd() * 4, sy = 2 + rnd() * 3, sz = 2 + rnd() * 5;
      const [px, py] = [[h + sy / 2 + 0.6, off], [-h - sy / 2 - 0.6, off], [off, h + sy / 2 + 0.6], [off, -h - sy / 2 - 0.6]][side];
      box(S.hull, px, py, z, side < 2 ? sy : sx, side < 2 ? sx : sy, sz, null, rnd() < 0.2 ? C.orangeD : (rnd() < 0.5 ? C.w : C.w2));
    }
    // pressurised modules slung on the truss
    const mods = [[0, 27, -190, -130], [0, -27, -110, -50], [27, 0, -20, 38], [-27, 0, 128, 190]];
    for (const [mx, my, za, zb] of mods) {
      cylModule({ zA: za, zB: zb, r: 12.5, x: mx, y: my, tint: C.w2, segs: 32, windows: 2, ribs: 1 });
      const mz = (za + zb) / 2;
      for (const dz of [-18, 18]) S.dark.strut([mx * 0.35, my * 0.35, mz + dz], [mx, my, mz + dz], 2.4, 2.4, { col: C.steel });
    }
    // adapter between ring hub and truss, and truss to aft block
    box(S.dark, 0, 0, z0 - 1, 22, 22, 2, null, C.dark);
    box(S.dark, 0, 0, z0 + bays * step + 1, 22, 22, 2, null, C.dark);
  }

  // ═══════════════ SOLAR ARRAYS (face Erebus: ±X normals) ═══════════════
  for (const zc of [90, 210]) for (const sy of [1, -1]) {
    const yIn = 20, yOut = 184, mastR = 1.5;
    S.dark.cyl([0, sy * 9, zc], [0, sy * (yOut + 4), zc], mastR, mastR, 10, { col: C.steel });
    S.dark.cyl([0, sy * 9, zc], [0, sy * 17, zc], 4.2, 4.2, 16, { col: C.dark });
    for (const dz of [-1, 1]) {
      const za = zc + dz * 2.2, zb = zc + dz * 38;
      const zlo = Math.min(za, zb), zhi = Math.max(za, zb);
      const ylo = Math.min(sy * yIn, sy * yOut), yhi = Math.max(sy * yIn, sy * yOut);
      S.solar.box(-0.22, ylo, zlo, 0.22, yhi, zhi, { tile: 8, col: [1, 1, 1], faces: ['px', 'nx'] });
      S.dark.box(-0.3, ylo, zlo, 0.3, yhi, zlo + 0.9, { tile: 8, col: C.dark2 });
      S.dark.box(-0.3, ylo, zhi - 0.9, 0.3, yhi, zhi, { tile: 8, col: C.dark2 });
      S.dark.box(-0.3, ylo, zlo, 0.3, ylo + 0.9, zhi, { tile: 8, col: C.dark2 });
      S.dark.box(-0.3, yhi - 0.9, zlo, 0.3, yhi, zhi, { tile: 8, col: C.dark2 });
      for (let k = 1; k < 5; k++) { const yy = ylo + ((yhi - ylo) * k) / 5; S.dark.box(-0.28, yy - 0.3, zlo, 0.28, yy + 0.3, zhi, { tile: 8, col: C.dark2 }); }
    }
  }

  // ═══════════════ RADIATORS (4 large fins, canted ±30° off edge-on) ═══════════════
  {
    const zA = 470, zB = 652, fr0 = 30, fr1 = 142;
    for (const phi of [30, 150, 210, 330].map((d) => (d * Math.PI) / 180)) {
      const d = new Vector3(Math.cos(phi), Math.sin(phi), 0);
      const q = qZ(phi);
      const nPanels = 4, gap = 2.2, pl = (zB - zA - gap * (nPanels - 1)) / nPanels;
      for (let k = 0; k < nPanels; k++) {
        const z0 = zA + k * (pl + gap), zc = z0 + pl / 2;
        const rc = (fr0 + fr1) / 2;
        S.rad.addGeo(G.unitBox(), new Matrix4().compose(new Vector3(d.x * rc, d.y * rc, zc), q, new Vector3(fr1 - fr0, 0.7, pl)), { su: (fr1 - fr0) / 8, sv: pl / 8, col: C.w });
        // frame rails
        S.dark.addGeo(G.unitBox(), new Matrix4().compose(new Vector3(d.x * rc, d.y * rc, z0 + 0.4), q, new Vector3(fr1 - fr0, 1.0, 0.8)), { col: C.dark });
        S.dark.addGeo(G.unitBox(), new Matrix4().compose(new Vector3(d.x * rc, d.y * rc, z0 + pl - 0.4), q, new Vector3(fr1 - fr0, 1.0, 0.8)), { col: C.dark });
        S.dark.addGeo(G.unitBox(), new Matrix4().compose(new Vector3(d.x * (fr1 - 0.4), d.y * (fr1 - 0.4), zc), q, new Vector3(0.8, 1.0, pl)), { col: C.dark });
      }
      // root boom + spars
      S.dark.addGeo(G.unitBox(), new Matrix4().compose(new Vector3(d.x * (fr0 + 2), d.y * (fr0 + 2), (zA + zB) / 2), q, new Vector3(4, 3, zB - zA)), { col: C.dark });
      for (let k = 1; k < 4; k++) {
        const rr = fr0 + ((fr1 - fr0) * k) / 4;
        S.dark.addGeo(G.unitBox(), new Matrix4().compose(new Vector3(d.x * rr, d.y * rr, (zA + zB) / 2), q, new Vector3(0.9, 1.2, zB - zA + 1)), { col: C.dark });
      }
    }
  }

  // ═══════════════ AFT BLOCK: service modules, tanks, reactor, nozzle ═══════════════
  cylModule({ zA: 322, zB: 468, r: 24, tint: C.w2, windows: 3, ribs: 4 });
  cylModule({ zA: 468, zB: 560, r: 28, tint: C.w3, windows: 1, ribs: 3 });
  for (const zc of [372, 424]) for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + (zc === 424 ? Math.PI / 6 : 0), rr = 47;
    const x = rr * Math.cos(a), y = rr * Math.sin(a);
    S.gold.sphere([x, y, zc], 11.5, { ws: 28, hs: 18, col: [1, 1, 1] });
    S.dark.strut([x * 0.5, y * 0.5, zc], [x * 0.84, y * 0.84, zc], 2.2, 2.2, { col: C.steel });
    S.dark.cyl([x, y, zc - 1.4], [x, y, zc + 1.4], 11.9, 11.9, 28, { col: C.dark, open: true, tile: 6 });
  }
  // reactor block
  S.dark.revolve(30, 560, 30, 700, { segs: 64, col: C.dark, tile: 8 });
  S.dark.revolve(0, 560, 30, 560, { segs: 64, col: C.dark });
  for (let k = 0; k < 10; k++) {
    const zc = 574 + k * 12.5;
    S.hull.revolve(46, zc - 0.5, 46, zc + 0.5, { segs: 72, col: C.w2, tile: 6 });
    S.hull.revolve(30, zc - 0.5, 46, zc - 0.5, { segs: 72, col: C.w2, tile: 6 });
    S.hull.revolve(46, zc + 0.5, 30, zc + 0.5, { segs: 72, col: C.w2, tile: 6 });
  }
  band(S.hull, 31, 700, 703, 3, 64, C.orange);
  S.dark.revolve(34, 700, 34, 730, { segs: 64, col: C.dark });
  S.dark.revolve(0, 700, 34, 700, { segs: 64, col: C.dark });
  S.dark.revolve(34, 730, 14, 730, { segs: 64, col: C.dark });
  S.dark.revolve(14, 730, 26, 800, { segs: 48, col: C.dark2, tile: 8 });
  S.dark.revolve(26, 800, 14, 730, { segs: 48, col: [0.05, 0.05, 0.06], tile: 8 });
  S.glow.revolve(13.9, 731, 14.8, 733, { segs: 48, col: [0.12, 0.34, 0.8] });
  S.glow.revolve(21.7, 779, 22.6, 781, { segs: 48, col: [0.1, 0.25, 0.6] });
  for (let k = 0; k < 8; k++) {   // station-keeping thruster quads
    const a = (k / 8) * TAU + Math.PI / 8;
    const x = 31 * Math.cos(a), y = 31 * Math.sin(a);
    S.dark.cyl([x, y, 727], [x, y, 742], 2.1, 3.4, 12, { col: C.dark2 });
    S.hull.cyl([x, y, 724], [x, y, 728], 3.6, 3.6, 12, { col: C.orangeD });
  }
  // aft truss stub to the radiators + antenna farm
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + 0.3, x = 34 * Math.cos(a), y = 34 * Math.sin(a);
    S.dark.cyl([x, y, 330 + k * 22], [x * 1.2, y * 1.2, 330 + k * 22 + 40], 0.5, 0.5, 6, { col: C.steel });
  }

  // ═══════════════ COMMS ARRAY: the big dish trained on Erebus (+X) ═══════════════
  const dish = (cx, cy, cz, Rd, f, o = {}) => {
    // local +Z = dish axis → +X_o ;  local X → −Z_o ; local Y → Y_o
    const xf = new Matrix4().compose(new Vector3(cx, cy, cz), qY(Math.PI / 2), new Vector3(1, 1, 1));
    const op = (extra = {}) => ({ segs: o.segs || 64, xf, tile: 10, col: C.w, ...extra });
    const n = 22, depth = (Rd * Rd) / (4 * f);
    for (let i = 0; i < n; i++) {                                             // front (concave) surface, rim → centre
      const r0 = Rd * (1 - i / n), r1 = Rd * (1 - (i + 1) / n);
      S.dish.revolve(r0, (r0 * r0) / (4 * f), r1, (r1 * r1) / (4 * f), op());
    }
    for (let i = 0; i < n; i++) {                                             // back surface, centre → rim
      const r0 = Rd * (i / n), r1 = Rd * ((i + 1) / n);
      S.dish.revolve(r0, (r0 * r0) / (4 * f) - 0.9, r1, (r1 * r1) / (4 * f) - 0.9, op({ col: C.w2 }));
    }
    S.dish.revolve(Rd, depth - 0.9, Rd, depth, op({ col: C.dark }));
    S.dish.revolve(Rd, depth, Rd - 1.6, depth, op({ col: C.dark }));
    // back structure: radial ribs + ring
    const P = (x, y, z) => new Vector3(x, y, z).applyMatrix4(xf).toArray();
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      S.dark.strut(P(Math.cos(a) * Rd * 0.97, Math.sin(a) * Rd * 0.97, depth - 0.9), P(Math.cos(a) * Rd * 0.14, Math.sin(a) * Rd * 0.14, -6), 0.7, 0.9, { col: C.steel });
    }
    const rr = Rd * 0.5;
    for (let k = 0; k < 20; k++) {
      const a0 = (k / 20) * TAU, a1 = ((k + 1) / 20) * TAU;
      const z = (rr * rr) / (4 * f) - 1.6;
      S.dark.strut(P(Math.cos(a0) * rr, Math.sin(a0) * rr, z), P(Math.cos(a1) * rr, Math.sin(a1) * rr, z), 0.6, 0.6, { col: C.steel });
    }
    // hub + feed tripod + horn at the focus
    S.dark.cyl(P(0, 0, -7), P(0, 0, 0.6), Rd * 0.12, Rd * 0.12, 20, { col: C.dark });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + 0.5;
      S.dark.strut(P(Math.cos(a) * Rd * 0.93, Math.sin(a) * Rd * 0.93, depth - 0.2), P(Math.cos(a) * 1.2, Math.sin(a) * 1.2, f - 3.5), 0.55, 0.55, { col: C.steel });
    }
    S.dark.cyl(P(0, 0, f - 4), P(0, 0, f + 3.2), Rd * 0.07, 1.0, 14, { col: C.dark });
    S.gold.cyl(P(0, 0, f - 4.2), P(0, 0, f - 3.2), Rd * 0.078, Rd * 0.078, 14, { col: [1, 1, 1], open: false });
    S.glow.cyl(P(0, 0, f + 3.0), P(0, 0, f + 3.3), Rd * 0.06, Rd * 0.06, 12, { col: [0.1, 1.3, 1.8] });
    if (o.boom) S.dark.cyl([0, 0, cz], [cx - 3, cy, cz], 1.4, 1.4, 10, { col: C.steel });
    return { P, depth };
  };
  {
    const cx = 100, cz = -540, Rd = 46, f = 42;
    // mast: lattice tower from the spine out to the gimbal
    S.dark.cyl([0, 0, cz], [cx - 4, 0, cz], 3.6, 3.6, 16, { col: C.dark });
    for (const [sy, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) S.dark.strut([20, 0, cz], [cx - 6, sy * 6, cz + sz * 6], 0.9, 0.9, { col: C.steel });
    for (let k = 0; k < 6; k++) { const x = 24 + k * 12; S.dark.strut([x, -6, cz - 6], [x + 12, 6, cz + 6], 0.5, 0.5, { col: C.steel }); S.dark.strut([x, 6, cz - 6], [x + 12, -6, cz + 6], 0.5, 0.5, { col: C.steel }); }
    // gimbal yoke
    S.dark.cyl([cx - 8, 0, cz - Rd * 0.55], [cx - 8, 0, cz + Rd * 0.55], 2.2, 2.2, 14, { col: C.dark });
    S.dark.strut([cx - 8, 0, cz - Rd * 0.55], [cx - 4, 0, cz - Rd * 0.35], 2.4, 2.4, { col: C.dark });
    S.dark.strut([cx - 8, 0, cz + Rd * 0.55], [cx - 4, 0, cz + Rd * 0.35], 2.4, 2.4, { col: C.dark });
    dish(cx, 0, cz, Rd, f, { segs: 72 });
    // secondary dishes
    dish(60, 28, hz + 90 + 20, 9, 8, { segs: 28, boom: true });
    dish(-40, -34, -588, 11, 10, { segs: 32, boom: true });
    dish(70, -30, 360, 14, 12, { segs: 32, boom: true });
    // phased-array panels & whips on the aft modules
    for (let k = 0; k < 4; k++) { const z = 340 + k * 28; S.dark.box(-26.4, -5, z, -24.6, 5, z + 12, { tile: 4, col: C.dark2 }); S.glow.box(-26.5, -4, z + 1, -26.3, 4, z + 11, { tile: 4, col: [0.02, 0.12, 0.2] }); }
  }

  // ═══════════════ RING (rotating group) ═══════════════
  const ringGroup = new THREE.Group();
  ringGroup.name = 'HalcyonRing';
  ringGroup.position.z = RING.zc;
  {
    const { R, depth, hw } = RING, ri = R - depth, c = 3, seg = 192;
    const hullOp = { segs: seg, tile: 16 };
    // outer wall: bands from −z to +z
    const outer = [[-hw + c, -16, 'h'], [-16, -11, 'w'], [-11, -4, 'h'], [-4, 4, 's'], [4, 11, 'h'], [11, 16, 'w'], [16, hw - c, 'h']];
    for (const [z0, z1, k] of outer) {
      if (k === 'w') RB.winOut.revolve(R + 0.06, z0, R + 0.06, z1, { segs: seg, uRep: 44, v0: 0, v1: 1 });
      else RB.hull.revolve(R, z0, R, z1, { ...hullOp, col: k === 's' ? C.w3 : C.w });
    }
    RB.hull.revolve(R + 0.4, -4, R + 0.4, -2.2, { ...hullOp, col: C.orange });
    RB.hull.revolve(R + 0.4, 2.2, R + 0.4, 4, { ...hullOp, col: C.orange });
    // inner wall (traversed −z so the normal faces the axis)
    const inner = [[hw - c, 22, 'h'], [22, 6, 'w'], [6, -6, 'h'], [-6, -22, 'w'], [-22, -hw + c, 'h']];
    for (const [z0, z1, k] of inner) {
      if (k === 'w') RB.winIn.revolve(ri - 0.06, z0, ri - 0.06, z1, { segs: seg, uRep: 41, v0: 0, v1: 1 });
      else RB.hull.revolve(ri, z0, ri, z1, { ...hullOp, col: C.w2 });
    }
    // cheeks
    RB.hull.revolve(R - c, hw, ri + c, hw, { ...hullOp, col: C.w });          // +z cheek (inward traversal)
    RB.hull.revolve(ri + c, -hw, R - c, -hw, { ...hullOp, col: C.w });        // −z cheek
    // chamfers
    RB.dark.revolve(R, hw - c, R - c, hw, { ...hullOp, col: C.dark });
    RB.dark.revolve(ri + c, hw, ri, hw - c, { ...hullOp, col: C.dark });
    RB.dark.revolve(ri, -hw + c, ri + c, -hw, { ...hullOp, col: C.dark });
    RB.dark.revolve(R - c, -hw, R, -hw + c, { ...hullOp, col: C.dark });
    // edge light strips
    for (const sz of [-1, 1]) {
      RB.glow.revolve(R + 0.12, sz * (hw - c - 1.2), R + 0.12, sz * (hw - c - 2.2), { segs: seg, col: [0.5, 1.5, 2.3] });
      RB.glow.revolve(ri - 0.12, sz * (hw - c - 1.2), ri - 0.12, sz * (hw - c - 2.2), { segs: seg, col: [2.0, 1.5, 0.9] });
    }
    // outer ribs & cheek ribs
    for (let k = 0; k < 72; k++) {
      const a = (k / 72) * TAU, ca = Math.cos(a), sa = Math.sin(a);
      box(RB.dark, (R + 0.7) * ca, (R + 0.7) * sa, 0, 1.6, 2.8, 2 * hw - 2 * c, qZ(a), C.dark);
      if (k % 2 === 0) for (const sz of [-1, 1]) box(RB.dark, ((R + ri) / 2) * ca, ((R + ri) / 2) * sa, sz * (hw + 0.5), depth - 2 * c, 1.6, 1.0, qZ(a), C.dark);
    }
    // HALCYON lettering on both cheeks (arc patches), top and bottom
    const arc = (144 / (ri + depth / 2)), mid = ri + depth / 2;
    for (const cen of [Math.PI / 2, (3 * Math.PI) / 2]) {
      RB.letters.revolve(mid - 10, -hw - 0.12, mid + 10, -hw - 0.12, { segs: 40, a0: cen - arc / 2, a1: cen + arc / 2, uRep: 1, v0: 0, v1: 1 });
      RB.letters.revolve(mid + 10, hw + 0.12, mid - 10, hw + 0.12, { segs: 40, a0: cen - arc / 2, a1: cen + arc / 2, uRep: 1, v0: 1, v1: 0, flipU: true });
    }
    // hub drum + spokes
    RB.hull.revolve(30, -22, 30, 22, { segs: 64, col: C.w2, tile: 8 });
    RB.hull.revolve(0, -22, 30, -22, { segs: 64, col: C.w2 });
    RB.hull.revolve(30, 22, 0, 22, { segs: 64, col: C.w2 });
    band(RB.dark, 30.8, -3, 3, 1.4, 64, C.dark);
    band(RB.hull, 30.5, -14, -11, 1.0, 64, C.orange);
    band(RB.hull, 30.5, 11, 14, 1.0, 64, C.orange);
    for (let k = 0; k < RING.spokes; k++) {
      const phi = (k / RING.spokes) * TAU + Math.PI / 6, d = [Math.cos(phi), Math.sin(phi), 0];
      const P = (r, z = 0) => [d[0] * r, d[1] * r, z];
      RB.hull.cyl(P(28), P(ri + 1), 5.2, 5.2, 18, { col: C.w2 });
      RB.dark.cyl(P(30), P(40), 7.4, 7.4, 18, { col: C.dark });
      for (let j = 0; j < 12; j++) RB.dark.cyl(P(60 + j * 30), P(62.4 + j * 30), 6.5, 6.5, 18, { col: C.dark });
      for (let j = 0; j < 4; j++) RB.winIn.cyl(P(96 + j * 80), P(130 + j * 80), 5.35, 5.35, 18, { tile: 64, su: 0.5, sv: 2.1 });
      RB.dark.cyl(P(ri - 6), P(ri + 1), 7.4, 7.4, 18, { col: C.dark });
      for (const sz of [-1, 1]) {                    // tension stays
        RB.dark.strut(P(95), P(ri - 2, sz * (hw - 2)), 0.7, 0.7, { col: C.steel });
        RB.dark.strut(P(30, sz * 22), P(150, sz * 4), 0.7, 0.7, { col: C.steel });
      }
    }
    // greebles: docking pods + service blisters on the ring rim
    for (const a of [0.6, 2.1, 3.7, 5.4]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      box(RB.hull, (R + 3.6) * ca, (R + 3.6) * sa, 0, 7, 12, 14, qZ(a), C.w2);
      box(RB.dark, (R + 7.2) * ca, (R + 7.2) * sa, 0, 1.4, 9, 11, qZ(a), C.dark);
      RB.glow.box((R + 7.9) * ca - 0.5, (R + 7.9) * sa - 0.5, -1, (R + 7.9) * ca + 0.5, (R + 7.9) * sa + 0.5, 1, { col: [0.5, 3.0, 1.0] });
    }
  }

  // ═══════════════ beacons & nav lights ═══════════════
  const beaconDefs = {
    red: { col: [3.4, 0.12, 0.05], pts: [[0, 0, hz - 134], [0, 0, 804], [0, 186, 90], [0, -186, 90], [0, 186, 210], [0, -186, 210], [100, 46, -540], [100, -46, -540], [0, 70, hz], [0, -70, hz]] },
    white: { col: [4, 4, 4.4], pts: [[HR + 3, 0, hz - 30], [-HR - 3, 0, hz + 30], [0, HR + 3, hz - 30], [133, 30, 470], [-30, -133, 470], [60, 28, hz + 110]] },
    amber: { col: [3.0, 1.6, 0.25], pts: [[0, 0, -420], [0, 0, 120], [0, 0, 330], [26, 0, -300], [-26, 0, -300]] },
    green: { col: [0.2, 3.0, 0.7], pts: [[-13, -HR - 1, O_DOCK.pos[2] - 7.5], [13, -HR - 1, O_DOCK.pos[2] - 7.5], [-13, -HR - 1, O_DOCK.pos[2] + 7.5], [13, -HR - 1, O_DOCK.pos[2] + 7.5]] },
  };
  const ringBeaconPts = [];
  for (const a of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) ringBeaconPts.push([(RING.R + 2) * Math.cos(a), (RING.R + 2) * Math.sin(a), 0]);
  const ringMarkPts = [];
  for (let k = 0; k < 72; k++) { const a = (k / 72) * TAU; for (const z of [-RING.hw + 3, RING.hw - 3]) ringMarkPts.push([(RING.R + 1.2) * Math.cos(a), (RING.R + 1.2) * Math.sin(a), z]); }

  const glowTex = G.glowTex(128);
  const mkPoints = (pts, color, size) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
    const mx = Math.max(color[0], color[1], color[2], 1e-3) / 1.05;
    const mat = new THREE.PointsMaterial({ map: glowTex, size, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(color[0] / mx, color[1] / mx, color[2] / mx), opacity: 1, toneMapped: false });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; p.renderOrder = 5; return p;
  };
  const beacons = {};
  const beaconGroup = new THREE.Group(); beaconGroup.name = 'beacons';
  for (const [k, d] of Object.entries(beaconDefs)) {
    const b = new G.Bucket('beacon_' + k);
    for (const p of d.pts) b.box(p[0] - 0.8, p[1] - 0.8, p[2] - 0.8, p[0] + 0.8, p[1] + 0.8, p[2] + 0.8, { col: [1, 1, 1] });
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.col[0], d.col[1], d.col[2]), toneMapped: false, vertexColors: true });
    const mesh = b.build(mat); const pts = mkPoints(d.pts, d.col, k === 'green' ? 9 : 14);
    beaconGroup.add(mesh, pts);
    beacons[k] = { mesh, points: pts, base: d.col.slice() };
  }
  const ringBeacons = (() => {
    const b = new G.Bucket('ring_beacon');
    for (const p of ringBeaconPts) b.box(p[0] - 1.1, p[1] - 1.1, -1.1, p[0] + 1.1, p[1] + 1.1, 1.1, { col: [1, 1, 1] });
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 0.12, 0.05), toneMapped: false, vertexColors: true });
    const mesh = b.build(mat), pts = mkPoints(ringBeaconPts, [3.4, 0.12, 0.05], 14);
    ringGroup.add(mesh, pts);
    return { mesh, points: pts, base: [3.4, 0.12, 0.05] };
  })();
  const ringMarks = mkPoints(ringMarkPts, [0.5, 1.5, 2.3], 5);
  ringGroup.add(ringMarks);
  const spineMarks = (() => {  // steady cyan position lights along the spine
    const pts = [];
    for (let z = -420; z <= 320; z += 60) for (const [x, y] of [[22, 0], [-22, 0], [0, 22], [0, -22]]) pts.push([x * (z > -200 ? 0.5 : 1), y * (z > -200 ? 0.5 : 1), z]);
    return mkPoints(pts, [0.3, 1.1, 1.6], 4);
  })();
  beaconGroup.add(spineMarks);

  // ═══════════════ assemble ═══════════════
  const frame = new THREE.Group();           // O-frame → published N frame
  frame.name = 'HalcyonFrame';
  frame.matrixAutoUpdate = false;
  frame.matrix.set(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);
  frame.matrixWorldNeedsUpdate = true;

  const add = (parent, bucket, mat) => { const m = bucket.build(mat); if (m) parent.add(m); return m; };
  add(frame, S.hull, M.hull); add(frame, S.dark, M.dark); add(frame, S.gold, M.gold);
  add(frame, S.winHub, M.winHub); add(frame, S.winMod, M.winMod);
  add(frame, S.solar, M.solar); add(frame, S.rad, M.rad); add(frame, S.dish, M.dish);
  add(frame, S.glow, M.glow); add(frame, S.glowW, M.glowW); add(frame, S.letters, M.letters); add(frame, S.berth, M.berth);
  const glass = add(frame, S.glass, M.glass); if (glass) glass.renderOrder = 3;
  frame.add(beaconGroup);
  add(ringGroup, RB.hull, M.hull); add(ringGroup, RB.dark, M.dark);
  add(ringGroup, RB.winIn, M.winRingIn); add(ringGroup, RB.winOut, M.winRingOut);
  add(ringGroup, RB.glow, M.ringGlow); add(ringGroup, RB.letters, M.letters);
  frame.add(ringGroup);

  const group = new THREE.Group();
  group.name = 'HalcyonExterior';
  group.add(frame);
  group.userData = {
    radius: RADIUS,
    dock: { pos: HALCYON_DOCK.pos.slice(), normal: HALCYON_DOCK.normal.slice(), up: HALCYON_DOCK.up.slice() },
    erebus: HALCYON_EREBUS_DIR.slice(),
    ring: ringGroup, ringOmega: RING.omega, beacons, ringBeacons,
    exposure: 1,
  };
  group.userData.update = (dt, t) => animateHalcyonExterior(group, t);
  group.userData.setExposure = (e) => setExposure(group, e);
  animateHalcyonExterior(group, 0);
  return group;
}

/** scale the emissive/basic-colour materials with the pre-applied sky exposure (clamped: lamps must not blow out) */
function setExposure(group, e) {
  const u = group.userData;
  if (!u) return;
  const k = Math.min(Math.max(+e || 1, 0.1), 6);
  if (u.exposure === k) return;
  u.exposure = k;
  group.traverse((o) => {
    const m = o.material;
    if (!m || !m.userData) return;
    if (m.userData.hE != null) m.emissiveIntensity = m.userData.hE * k;
    else if (m.userData.hC) m.color.setRGB(m.userData.hC[0] * k, m.userData.hC[1] * k, m.userData.hC[2] * k);
  });
}

/** ring rotation + blinking beacons. t = seconds (any monotonic clock). */
export function animateHalcyonExterior(group, t, exposure) {
  const u = group && group.userData;
  if (!u || !u.ring) return;
  if (exposure != null) setExposure(group, exposure);
  u.ring.rotation.z = (t * u.ringOmega) % TAU;
  const e = u.exposure || 1;
  const set = (b, k) => {
    b.points.material.opacity = 0.06 + 0.94 * k;
    b.mesh.material.color.setRGB(b.base[0] * e * (0.08 + 0.92 * k), b.base[1] * e * (0.08 + 0.92 * k), b.base[2] * e * (0.08 + 0.92 * k));
  };
  const ph = (x, p) => ((x % p) + p) % p;
  const red = Math.exp(-4.2 * ph(t, 1.7));
  const tt = ph(t, 2.9), white = tt < 0.07 || (tt > 0.24 && tt < 0.31) ? 1 : 0;
  const amber = 0.5 + 0.5 * Math.sin(t * 1.6);
  const green = 0.75 + 0.25 * Math.sin(t * 3.0 + 1.2);
  set(u.beacons.red, red); set(u.beacons.white, white); set(u.beacons.amber, amber); set(u.beacons.green, green);
  set(u.ringBeacons, Math.exp(-4.2 * ph(t + 0.4, 1.7)));
}
