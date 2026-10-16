// ORPHEUS · Phlegethon · The Forge — abandoned Halcyon survey lander HX-S2 (slot `lander`, padR 14).
// Body frame: x right, y up (0 = pad level), +z toward the hatch/ladder (= toward the ship via slot.yaw). The whole lander is tilted
// ≈3° (front-right footpad sunk in an ash drift); legs/ladder/props are built in world space so they always reach the real ground.
import * as THREE from 'three';
import {
  Bucket, bevBox, box, tube, cylY, dishGeo, catenary, shade, foilMats, plateTexture, hazardTexture, decalAtlas, decalGeo,
  stencil, label, wear, ashPatch, scaleUV, place, smooth, lerp, nearestRiver, TAU,
} from './poi_phlegethon_kit.js';

const DEG = Math.PI / 180;
const ALU = 0xbcc1c5, ALU_D = 0x8b9297, PAINT = 0xd7dad7, GREY = 0x6d7478, DARK = 0x24282c, RUBBER = 0x15171a, ORANGE = 0xd35a1a, RIG = 0xe8791c, OLIVE = 0x4f573b, YEL = 0xd8a416, SOOT = 0x1b1918;
const GREEN = [0.35, 3.0, 1.0], AMBER = [4.0, 1.6, 0.2];

function aabb(cx, cz, w, d, yaw, y0, y1) {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), hx = (c * w + s * d) / 2, hz = (s * w + c * d) / 2;
  return { min: [cx - hx, y0, cz - hz], max: [cx + hx, y1, cz + hz] };
}

export function buildLander(env) {
  const { kit } = env, slot = env.slots.lander;
  const group = new THREE.Group(); group.name = 'phlegethon-lander';
  const colliders = [], interactables = [];

  // ───────────── frame ─────────────
  const g0 = env.groundY(slot.x, slot.z), yaw = slot.yaw, cyw = Math.cos(yaw), syw = Math.sin(yaw);
  const lg = (x, z) => [slot.x + x * cyw + z * syw, slot.z - x * syw + z * cyw];       // lander-local (x right, z hatch) → world XZ
  const gl = (x, z) => { const p = lg(x, z); return env.groundY(p[0], p[1]); };
  const TILT = 3 * DEG, FR = 60 * DEG;                                                  // sunk pad = front-right (phi 60°)
  const axis = new THREE.Vector3(Math.cos(FR), 0, -Math.sin(FR)).normalize();
  const Mb = new THREE.Matrix4().makeRotationY(yaw).multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(axis, TILT)));
  Mb.setPosition(slot.x, g0, slot.z);
  const B2W = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(Mb);
  const nrm = (phi) => [Math.sin(phi), Math.cos(phi)];

  // ───────────── textures + materials ─────────────
  const foilM = foilMats(kit, 7), plateTex = plateTexture(9), hazTex = hazardTexture();
  const panelTex = kit.panelTexture({ base: '#d8dbd8', w: 256, h: 256, cols: 3, rows: 5, seed: 31, grimeAmt: 1.5 });
  { const g2 = panelTex.image.getContext('2d'), rr = ((s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(5);
    for (let i = 0; i < 46; i++) { const x = rr() * 256, y0 = rr() * 150, len = 50 + rr() * 150, wd = 1.5 + rr() * 5, gr = g2.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, 'rgba(78,60,44,0)'); gr.addColorStop(0.15, `rgba(78,60,44,${0.07 + rr() * 0.13})`); gr.addColorStop(1, 'rgba(78,60,44,0)'); g2.fillStyle = gr; g2.fillRect(x, y0, wd, len); }
    panelTex.needsUpdate = true; }
  const ash = (m, amount = 0.8, o = {}) => ashPatch(m, { color: 0x7f7a74, groundY: g0, low: 2.3, wind: [0.9, 0, 0.35], windStrength: 1.0, freq: 1.35, amount, ...o });
  const mFoil = ash(foilM.gold, 0.6);
  const mPaint = ash(kit.std({ map: panelTex, vertexColors: true, roughness: 0.62, metalness: 0.1 }), 0.95);
  const mMetal = ash(kit.std({ vertexColors: true, roughness: 0.5, metalness: 0.55 }), 0.75);
  const mMatte = ash(kit.std({ vertexColors: true, roughness: 0.66, metalness: 0.08 }), 0.85);
  const mPlate = ash(kit.std({ map: plateTex, vertexColors: true, roughness: 0.55, metalness: 0.4 }), 0.85);
  const mHaz = ash(kit.std({ map: hazTex, vertexColors: true, roughness: 0.6, metalness: 0.05 }), 0.6);
  const mDbl = ash(kit.std({ vertexColors: true, roughness: 0.52, metalness: 0.4, side: THREE.DoubleSide }), 0.6);
  const skyTex = kit.canvasTexture(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0c0806'); gr.addColorStop(0.55, '#3a1e10'); gr.addColorStop(1, '#a8582a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, { wrap: false });
  const mGlass = kit.std({ vertexColors: true, color: 0x05080b, roughness: 0.05, metalness: 0.8, emissive: 0xffffff, emissiveMap: skyTex, emissiveIntensity: 0.15 });
  const mAshG = ashPatch(kit.std({ vertexColors: true, roughness: 0.98, metalness: 0 }), { color: 0x58534e, groundY: g0, low: 0.01, amount: 0.5, freq: 2.2, wind: [0.9, 0, 0.35] });
  const mLed = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });
  const statusMat = kit.glow(0xff2a18, 1, { vertexColors: true });

  const atlas = decalAtlas(512, 512, {
    reg: { x: 4, y: 4, w: 250, h: 104, draw: (g, w, h) => { stencil(g, 'HX-S2', w / 2, h / 2, 96, '#e9e3d6', { spacing: 3, maxW: w - 14 }); wear(g, w, h, 0.7, 5); } },
    danger: { x: 262, y: 4, w: 246, h: 104, draw: (g, w, h) => {
      g.fillStyle = '#d9a812'; g.fillRect(0, 0, w, h); g.fillStyle = '#16181b'; g.fillRect(5, 5, w - 10, h - 10); g.fillStyle = '#d9a812'; g.fillRect(9, 9, w - 18, h - 18);
      label(g, 'DANGER', w / 2, 30, w - 30, 38, '#16181b'); label(g, 'ENGINE EXHAUST', w / 2, 64, w - 28, 22, '#16181b', 800); label(g, 'KEEP CLEAR WHEN ARMED', w / 2, 88, w - 28, 15, '#16181b', 700);
      kit.grime(g, w, h, { amount: 0.9, color: 'rgba(30,22,14,0.3)', streaks: 5, seed: 12 });
    } },
    survey: { x: 4, y: 112, w: 360, h: 52, draw: (g, w, h) => { stencil(g, 'HALCYON SURVEY', w / 2, h / 2, 42, '#e9e3d6', { spacing: 4, maxW: w - 12 }); wear(g, w, h, 0.7, 7); } },
    nostep: { x: 372, y: 112, w: 136, h: 52, draw: (g, w, h) => { stencil(g, 'NO STEP', w / 2, h / 2, 34, '#c9442a', { spacing: 1, maxW: w - 12 }); wear(g, w, h, 0.5, 9); } },
    unit: { x: 4, y: 170, w: 300, h: 40, draw: (g, w, h) => { stencil(g, 'SURVEY LANDER 2 · SL-2', w / 2, h / 2, 26, '#e9e3d6', { spacing: 1.5, maxW: w - 10 }); wear(g, w, h, 0.6, 11); } },
    rbf: { x: 312, y: 170, w: 196, h: 50, draw: (g, w, h) => {
      g.fillStyle = '#b8261a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f0e8d8'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
      label(g, 'REMOVE BEFORE FLIGHT', w / 2, h / 2, w - 18, 20, '#f2ebdd'); kit.grime(g, w, h, { amount: 0.8, color: 'rgba(30,22,14,0.3)', streaks: 3, seed: 13 });
    } },
    crate1: { x: 4, y: 222, w: 200, h: 90, draw: (g, w, h) => { stencil(g, 'HALCYON SURVEY', w / 2, 24, 28, '#e9e3d6', { spacing: 1, maxW: w - 12 }); stencil(g, 'FIELD SPARES', w / 2, 58, 24, '#e9e3d6', { spacing: 1, maxW: w - 12 }); wear(g, w, h, 0.6, 15); } },
    crate2: { x: 212, y: 222, w: 200, h: 90, draw: (g, w, h) => { stencil(g, 'CORE SAMPLES', w / 2, 24, 28, '#16181b', { spacing: 1, maxW: w - 12 }); stencil(g, 'FRAGILE · KEEP COOL', w / 2, 58, 17, '#16181b', { spacing: 0.5, maxW: w - 12 }); wear(g, w, h, 0.5, 17); } },
    drill: { x: 4, y: 320, w: 190, h: 52, draw: (g, w, h) => { stencil(g, 'CORING RIG 03', w / 2, h / 2, 30, '#16181b', { spacing: 1, maxW: w - 12 }); wear(g, w, h, 0.5, 19); } },
    exit: { x: 202, y: 320, w: 210, h: 52, draw: (g, w, h) => {
      g.fillStyle = '#1f6b3a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e6f2e8'; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6);
      label(g, 'CREW HATCH · PULL', w / 2, h / 2, w - 20, 22, '#eef8f0'); kit.grime(g, w, h, { amount: 0.8, color: 'rgba(20,20,10,0.3)', streaks: 3, seed: 23 });
    } },
  });
  const mDecal = ash(kit.std({ map: atlas.tex, vertexColors: true, transparent: true, roughness: 0.7, metalness: 0.02, depthWrite: false, alphaTest: 0.02 }), 0.3);

  // ───────────── buckets ─────────────
  const foil = new Bucket(41, 0.0), paint = new Bucket(42, 0.02), metal = new Bucket(43, 0.04), matte = new Bucket(44, 0.05), plate = new Bucket(45, 0.0);
  const haz = new Bucket(46, 0), dbl = new Bucket(47, 0.02), glass = new Bucket(48, 0), led = new Bucket(49, 0), decals = new Bucket(50, 0), status = new Bucket(51, 0), ashB = new Bucket(52, 0.05);
  const sub = (g, off, pos, rot) => place(place(g, off, null), pos, rot);
  const wtube = (b, a, c, r0, r1, radial, col, open = true) => b.raw(tube(a, c, r0, r1, radial, open), col, true);
  const wcable = (b, pts, r, col, radial = 4) => { for (let i = 0; i < pts.length - 1; i++) b.raw(tube(pts[i], pts[i + 1], r, r, radial), col, true); };
  const v3a = (v) => [v.x, v.y, v.z];

  // ───────────── descent stage (hexagonal, gold-foil panels) ─────────────
  const apo = 2.338, Rh = 2.7, yB = 1.55, yT = 3.55;
  for (let k = 0; k < 6; k++) {
    const phi = k * 60 * DEG, [nx, nz] = nrm(phi), pv = phi + 30 * DEG;
    foil.add(bevBox(2.36, 1.62, 0.16, 0.035, 1.2), [nx * (apo - 0.08), 2.55, nz * (apo - 0.08)], [0, phi, 0], 0xffffff);
    for (const sx of [-0.62, 0.62]) metal.add(box(0.05, 1.62, 0.012, 1), [nx * (apo + 0.006) + nz * sx, 2.55, nz * (apo + 0.006) - nx * sx], [0, phi, 0], 0xdadddc);
    metal.add(bevBox(2.62, 0.14, 0.3, 0.03, 1), [nx * (apo - 0.1), yT - 0.07, nz * (apo - 0.1)], [0, phi, 0], ALU);
    metal.add(bevBox(2.62, 0.14, 0.3, 0.03, 1), [nx * (apo - 0.1), yB + 0.07, nz * (apo - 0.1)], [0, phi, 0], ALU_D);
    metal.add(bevBox(0.22, 2.0, 0.22, 0.03, 1), [Math.sin(pv) * Rh, 2.55, Math.cos(pv) * Rh], [0, pv, 0], ALU);
    for (let i = -1; i <= 1; i += 2) for (const yy of [yT - 0.07, yB + 0.07]) metal.add(cylY(0.02, 0.02, 0.025, 6), [nx * (apo + 0.06) + nz * i * 1.05, yy, nz * (apo + 0.06) - nx * i * 1.05], [Math.PI / 2, phi, 0], 0x585f64);
  }
  // registry placard on the front face (readable from the approach)
  metal.add(bevBox(1.24, 0.54, 0.03, 0.01, 1), [0.62, 2.0, apo + 0.02], null, 0x2c3237);
  decals.add(decalGeo(atlas.rects.reg, 1.08, 0.449), [0.62, 2.0, apo + 0.04], null, 0xffffff);
  plate.raw(scaleUV(place(tube([0, yT - 0.02, 0], [0, yT + 0.07, 0], 2.62, 2.62, 6, false), null, [0, 30 * DEG, 0]), 8, 8), 0xffffff);
  metal.add(tube([0, yB - 0.08, 0], [0, yB, 0], 2.5, 2.5, 6, false), null, [0, 30 * DEG, 0], 0x4a5054);
  // radiator panel on the back face + equipment bay hatch
  metal.add(bevBox(1.9, 1.2, 0.09, 0.02, 1), [0, 2.55, -(apo + 0.05)], [0, Math.PI, 0], 0xe2e4e1);
  for (let i = 0; i < 9; i++) metal.add(box(1.8, 0.035, 0.05, 1), [0, 2.04 + i * 0.12, -(apo + 0.1)], [0, Math.PI, 0], 0xc8cbc8);
  // engine bell (open, double-sided): soot-black mouth → heat-bronzed throat
  { const bell = tube([0, 0.62, 0], [0, yB, 0], 1.15, 0.5, 28, true);
    const g = dbl.raw(bell, 0xffffff, false);
    shade(g, (x, y, z, c) => { const t = smooth(0.6, 1.5, y), r = lerp(0.04, 0.42, t), gg = lerp(0.035, 0.34, t), b = lerp(0.04, 0.48, smooth(0.9, 1.55, y)); c[0] = r; c[1] = gg; c[2] = b; });
    metal.add(tube([0, 1.2, 0], [0, 1.52, 0], 0.62, 0.52, 18, false), null, null, 0x3a3f43);
  }

  // ───────────── ascent stage: octagonal crew cabin ─────────────
  const Rc = 1.95, ac = Rc * Math.cos(22.5 * DEG), yC0 = 3.62, yC1 = 6.42, hC = yC1 - yC0, yMid = (yC0 + yC1) / 2;
  for (let k = 0; k < 8; k++) {
    const phi = k * 45 * DEG, [nx, nz] = nrm(phi), pv = phi + 22.5 * DEG, r = ac - 0.07;
    if (k !== 0) paint.add(bevBox(1.34, hC, 0.14, 0.03, 2.4), [nx * r, yMid, nz * r], [0, phi, 0], 0xffffff);
    metal.add(bevBox(0.13, hC + 0.08, 0.13, 0.02, 1), [Math.sin(pv) * Rc, yMid, Math.cos(pv) * Rc], [0, pv, 0], ALU);
  }
  // front face with the crew-hatch opening (x ±0.44, y 3.78 … 5.25)
  { const zf = ac - 0.07, h1 = 3.78, h2 = 5.25;
    paint.add(bevBox(0.23, hC, 0.14, 0.02, 2.4), [-0.555, yMid, zf], null, 0xffffff); paint.add(bevBox(0.23, hC, 0.14, 0.02, 2.4), [0.555, yMid, zf], null, 0xffffff);
    paint.add(bevBox(0.9, yC1 - h2, 0.14, 0.02, 2.4), [0, (h2 + yC1) / 2, zf], null, 0xffffff); paint.add(bevBox(0.9, h1 - yC0, 0.14, 0.02, 2.4), [0, (yC0 + h1) / 2, zf], null, 0xffffff);
    for (const sx of [-1, 1]) metal.add(bevBox(0.08, h2 - h1 + 0.1, 0.1, 0.02, 1), [sx * 0.47, (h1 + h2) / 2, ac + 0.0], null, ALU);
    metal.add(bevBox(1.02, 0.08, 0.1, 0.02, 1), [0, h2 + 0.04, ac], null, ALU); metal.add(bevBox(1.04, 0.1, 0.2, 0.02, 1), [0, h1 - 0.02, ac + 0.03], null, ALU_D);
    // interior (dark cabin): liners, floor, console, dead LEDs, emergency strip
    for (const [w, h, d, x, y, z] of [[2.7, hC - 0.1, 0.02, 0, yMid, -1.42], [0.02, hC - 0.1, 2.7, -1.42, yMid, 0], [0.02, hC - 0.1, 2.7, 1.42, yMid, 0], [2.7, 0.03, 2.7, 0, yC0 + 0.12, 0], [2.7, 0.02, 2.7, 0, yC1 - 0.04, 0]]) metal.add(box(w, h, d, 1), [x, y, z], null, 0x14181c);
    metal.add(bevBox(1.1, 0.75, 0.5, 0.03, 1), [0, yC0 + 0.52, -1.0], null, 0x232a30);
    matte.add(bevBox(0.55, 0.5, 0.14, 0.03, 1), [0.6, yC0 + 0.5, -0.35], [0, 0.3, 0], 0x30363b);
    for (let i = 0; i < 5; i++) led.add(new THREE.BoxGeometry(0.04, 0.025, 0.02), [-0.4 + i * 0.2, yC0 + 0.78, -0.745], null, i === 2 ? [0.5, 0.06, 0.05] : [0.03, 0.04, 0.05]);
    led.add(new THREE.BoxGeometry(1.0, 0.02, 0.05), [0, yC1 - 0.08, -0.5], null, [0.22, 0.085, 0.02]);
    // hatch door swung open on its right hinge, with porthole + wheel + hazard edge
    const hinge = [0.46, (h1 + h2) / 2, ac + 0.07], open = [0, 1.38, 0];
    paint.raw(sub(bevBox(0.9, 1.5, 0.09, 0.02, 1.6), [-0.45, 0, 0], hinge, open), 0xffffff);
    haz.raw(sub(box(0.07, 1.5, 0.095, 0.4), [-0.86, 0, 0], hinge, open), 0xffffff);
    glass.raw(sub(new THREE.CircleGeometry(0.17, 18), [-0.45, 0.3, 0.048], hinge, open), 0xffffff);
    metal.raw(sub(new THREE.TorusGeometry(0.19, 0.025, 6, 18), [-0.45, 0.3, 0.05], hinge, open), ALU);
    metal.raw(sub(new THREE.TorusGeometry(0.11, 0.018, 6, 14), [-0.45, -0.25, 0.07], hinge, open), ALU_D);
    for (const k of [-1, 0, 1]) metal.add(cylY(0.03, 0.03, 0.2, 8), [0.46, (h1 + h2) / 2 + k * 0.5 - 0.1, ac + 0.07], null, ALU_D);
    decals.raw(sub(decalGeo(atlas.rects.exit, 0.46, 0.113), [-0.45, -0.52, 0.049], hinge, open), 0xffffff);
  }
  // windows (front diagonals), side portholes, frames
  for (const k of [1, 7]) {
    const phi = k * 45 * DEG, [nx, nz] = nrm(phi), r = ac, yW = 5.35;
    const tx = nz, tz = -nx;
    for (const sx of [-1, 1]) metal.add(bevBox(0.08, 0.86, 0.1, 0.02, 1), [nx * (r + 0.01) + tx * sx * 0.42, yW, nz * (r + 0.01) + tz * sx * 0.42], [0, phi, 0], ALU_D);
    for (const sy of [-1, 1]) metal.add(bevBox(0.92, 0.08, 0.1, 0.02, 1), [nx * (r + 0.01), yW + sy * 0.39, nz * (r + 0.01)], [0, phi, 0], ALU_D);
    glass.add(new THREE.PlaneGeometry(0.76, 0.7), [nx * (r + 0.004), yW, nz * (r + 0.004)], [0, phi, 0], 0xffffff);
  }
  for (const k of [2, 6]) {
    const phi = k * 45 * DEG, [nx, nz] = nrm(phi), r = ac + 0.004;
    glass.add(new THREE.CircleGeometry(0.19, 20), [nx * r, 5.5, nz * r], [0, phi, 0], 0xffffff);
    metal.add(new THREE.TorusGeometry(0.215, 0.03, 6, 20), [nx * (r + 0.01), 5.5, nz * (r + 0.01)], [0, phi, 0], ALU_D);
  }
  // cabin rings, roof, docking collar, mast
  metal.add(tube([0, yC0 - 0.07, 0], [0, yC0 + 0.05, 0], Rc + 0.09, Rc + 0.09, 8, false), null, [0, 22.5 * DEG, 0], ALU_D);
  metal.add(tube([0, yC1 - 0.03, 0], [0, yC1 + 0.07, 0], Rc + 0.07, Rc + 0.07, 8, false), null, [0, 22.5 * DEG, 0], ALU);
  paint.raw(scaleUV(place(tube([0, yC1 + 0.07, 0], [0, yC1 + 0.78, 0], Rc + 0.02, 1.05, 8, false), null, [0, 22.5 * DEG, 0]), 4, 1.4), 0xffffff);
  metal.add(tube([0, yC1 + 0.78, 0], [0, yC1 + 0.86, 0], 1.0, 0.95, 16, false), null, null, ALU_D);
  metal.add(new THREE.TorusGeometry(0.52, 0.07, 8, 22), [0, yC1 + 0.95, 0], [Math.PI / 2, 0, 0], ALU);
  metal.add(tube([0, yC1 + 0.9, 0], [0, 9.0, 0], 0.05, 0.028, 8), null, null, ALU);
  metal.add(cylY(0.1, 0.09, 0.2, 10), [0, 8.82, 0], null, 0x30363b);
  // dish + boom + whips + star tracker
  { const dc = [-0.85, yC1 + 1.05, -0.75], dr = [-0.95, 0.55, 0];
    dbl.raw(sub(dishGeo(0.72, 0.22, 24), [0, 0, 0], dc, dr), 0xe3e5e1);
    dbl.raw(sub(new THREE.TorusGeometry(0.72, 0.016, 6, 24).translate(0, 0, 0.22), [0, 0, 0], dc, dr), 0xcdd0cc);
    metal.raw(sub(tube([0, 0, -0.04], [0, 0, 0.1], 0.14, 0.1, 10, false), [0, 0, 0], dc, dr), ALU_D);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3; metal.raw(sub(tube([Math.cos(a) * 0.71, Math.sin(a) * 0.71, 0.22], [0, 0, 0.62], 0.01, 0.01, 4), [0, 0, 0], dc, dr), ALU); }
    metal.raw(sub(tube([0, 0, 0.58], [0, 0, 0.7], 0.055, 0.016, 8), [0, 0, 0], dc, dr), 0xd8dbd6);
    metal.add(tube([-0.5, yC1 + 0.7, -0.45], [dc[0], dc[1] - 0.05, dc[2]], 0.04, 0.03, 8), null, null, ALU_D);
    for (const [x, z, h, lean] of [[0.85, -0.55, 8.7, 0.12], [-1.1, 0.7, 7.9, -0.1], [0.3, -1.2, 8.3, 0.0]]) metal.add(tube([x, yC1 + 0.7, z], [x + lean, h, z], 0.014, 0.007, 5), null, null, ALU);
    metal.add(bevBox(0.28, 0.2, 0.34, 0.03, 1), [0.9, yC1 + 0.84, 0.35], null, 0x2f353a); metal.add(cylY(0.09, 0.08, 0.24, 10), [0.9, yC1 + 0.92, 0.5], [Math.PI / 2 * 0.0, 0, 0], 0x1c2125);
  }
  // RCS quads (4)
  for (let j = 0; j < 4; j++) {
    const pv = (22.5 + 90 * j) * DEG, [nx, nz] = nrm(pv), rr = Rc + 0.2, yq = 5.85, tx = nz, tz = -nx;
    metal.add(bevBox(0.36, 0.36, 0.36, 0.04, 1), [nx * rr, yq, nz * rr], [0, pv, 0], 0xa6acb0);
    metal.add(bevBox(0.18, 0.5, 0.18, 0.02, 1), [nx * (Rc + 0.04), yq, nz * (Rc + 0.04)], [0, pv, 0], ALU_D);
    for (const [dx, dy, dz] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]]) {
      const bx = nx * rr + (dx ? tx * dx * 0.18 : 0), by = yq + dy * 0.18, bz = nz * rr + (dx ? tz * dx * 0.18 : 0);
      metal.raw(tube([bx, by, bz], [bx + (dx ? tx * dx * 0.2 : 0), by + dy * 0.2, bz + (dx ? tz * dx * 0.2 : 0)], 0.035, 0.075, 8), 0x2a2e32);
    }
  }
  // status light (dead beacon, slow red blink) on the cabin roof
  metal.add(cylY(0.1, 0.08, 0.1, 10), [0.7, yC1 + 0.78, 0.9], null, 0x30363b);
  status.add(new THREE.SphereGeometry(0.075, 10, 8), [0.7, yC1 + 0.9, 0.9], null, 0xffffff);

  // ───────────── porch, rails, ladder ─────────────
  { const zp0 = ac - 0.05, zp1 = 3.0, yP = 3.58;
    plate.add(box(1.5, 0.08, zp1 - zp0, 0.6), [0, yP, (zp0 + zp1) / 2], null, 0xffffff);
    for (const sx of [-1, 1]) {
      metal.beam([sx * 0.7, yP - 0.12, zp0], [sx * 0.7, yP - 0.12, zp1], 0.08, 0.16, ALU_D);
      metal.beam([sx * 0.62, yP - 0.1, zp1 - 0.1], [sx * 0.62, 2.35, apo + 0.03], 0.07, 0.07, ALU_D);
      metal.tube([sx * 0.72, yP + 0.04, zp1 - 0.02], [sx * 0.72, yP + 0.9, zp1 - 0.02], 0.026, 0.026, 6, ALU); metal.tube([sx * 0.72, yP + 0.04, zp0 + 0.1], [sx * 0.72, yP + 0.9, zp0 + 0.1], 0.026, 0.026, 6, ALU);
      metal.beam([sx * 0.72, yP + 0.9, zp0 + 0.1], [sx * 0.72, yP + 0.9, zp1 - 0.02], 0.04, 0.04, ALU); metal.beam([sx * 0.72, yP + 0.48, zp0 + 0.1], [sx * 0.72, yP + 0.48, zp1 - 0.02], 0.03, 0.03, ALU);
    }
    metal.beam([0.1, yP + 0.9, zp1 - 0.02], [0.72, yP + 0.9, zp1 - 0.02], 0.04, 0.04, ALU); metal.beam([0.1, yP + 0.48, zp1 - 0.02], [0.72, yP + 0.48, zp1 - 0.02], 0.03, 0.03, ALU);
    metal.tube([0.1, yP + 0.04, zp1 - 0.02], [0.1, yP + 0.9, zp1 - 0.02], 0.026, 0.026, 6, ALU);
    haz.add(box(1.5, 0.08, 0.08, 0.4), [0, yP + 0.01, zp1 + 0.01], null, 0xffffff);
    decals.add(decalGeo(atlas.rects.rbf, 0.38, 0.097), [0.5, yP + 0.62, zp1 + 0.015], null, 0xffffff);
    decals.add(decalGeo(atlas.rects.nostep, 0.5, 0.19), [-1.05, 1.95, apo + 0.006], null, 0xffffff);
  }
  const ladTop = B2W(-0.32, 3.6, 3.0), ladXZ = (() => { const w = B2W(-0.32, 0, 3.78); return [w.x, w.z]; })();
  const ladFootY = env.groundY(ladXZ[0], ladXZ[1]) + 0.04, ladFoot = new THREE.Vector3(ladXZ[0], ladFootY, ladXZ[1]);
  { const side = new THREE.Vector3(cyw, 0, -syw).multiplyScalar(0.26);   // body x-axis in world (ladder width)
    for (const sg of [-1, 1]) {
      const a = ladTop.clone().addScaledVector(side, sg), b = ladFoot.clone().addScaledVector(side, sg);
      wtube(metal, v3a(a), v3a(b), 0.026, 0.026, 6, ALU);
      matte.raw(place(box(0.14, 0.05, 0.18, 1), [b.x, b.y + 0.02, b.z], [0, yaw, 0]), RUBBER, true);
    }
    const nR = 11;
    for (let i = 1; i < nR; i++) { const t = i / nR, c = ladTop.clone().lerp(ladFoot, t), a = c.clone().addScaledVector(side, -1), b = c.clone().addScaledVector(side, 1); wtube(metal, v3a(a), v3a(b), 0.017, 0.017, 5, ALU_D); }
  }

  // ───────────── legs (world space; each strut reaches its own pad on the real ground) ─────────────
  const SINK = 0.28, legs = [];
  for (const phiD of [60, 120, 240, 300]) {
    const phi = phiD * DEG, [nx, nz] = nrm(phi), tx = nz, tz = -nx, sunk = phiD === 60 ? SINK : 0;
    const A = B2W(nx * (apo + 0.14), 3.0, nz * (apo + 0.14));
    const [px, pz] = lg(nx * 5.5, nz * 5.5), gP = env.groundY(px, pz), J = new THREE.Vector3(px, gP + 0.4 - sunk, pz), M = A.clone().lerp(J, 0.5);
    legs.push({ A, J, M, px, pz, gP, sunk, phi });
    // bracket + brace anchors on the stage (body frame)
    metal.add(bevBox(0.58, 0.62, 0.34, 0.04, 1), [nx * (apo + 0.08), 3.0, nz * (apo + 0.08)], [0, phi, 0], ALU);
    for (const sg of [-1, 1]) metal.add(bevBox(0.3, 0.3, 0.2, 0.03, 1), [nx * (apo + 0.06) + tx * sg * 0.85, 1.85, nz * (apo + 0.06) + tz * sg * 0.85], [0, phi, 0], ALU_D);
    // upper outer strut wrapped in gold foil, collar, inner piston, ball joint, secondary braces
    const dir = M.clone().sub(A), len = dir.length();
    foil.raw(scaleUV(tube(v3a(A), v3a(M), 0.19, 0.165, 12, false), 2.2, len / 1.1), 0xffffff, true);
    wtube(metal, v3a(M.clone().addScaledVector(dir.clone().normalize(), -0.07)), v3a(M.clone().addScaledVector(dir.clone().normalize(), 0.07)), 0.23, 0.23, 14, ALU_D, false);
    wtube(metal, v3a(M), v3a(J), 0.115, 0.1, 10, 0xcfd3d6, false);
    metal.raw(place(new THREE.SphereGeometry(0.17, 12, 8), v3a(J)), ALU_D, true);
    for (const sg of [-1, 1]) {
      const B = B2W(nx * (apo + 0.06) + tx * sg * 0.85, 1.85, nz * (apo + 0.06) + tz * sg * 0.85);
      wtube(metal, v3a(B), v3a(M.clone().lerp(J, 0.12)), 0.06, 0.055, 8, ALU_D);
    }
    // footpad: dished disc + dome; scorched
    const gb = gP - sunk;
    metal.raw(tube([px, gb, pz], [px, gb + 0.1, pz], 0.62, 0.58, 22, false), 0x2d2a28, true);
    metal.raw(tube([px, gb + 0.1, pz], [px, gb + 0.38, pz], 0.42, 0.17, 16, false), 0x3a3836, true);
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3; metal.raw(place(cylY(0.02, 0.02, 0.06, 6), [px + Math.cos(a) * 0.5, gb + 0.1, pz + Math.sin(a) * 0.5]), 0x6c7378, true); }
  }
  // soot / heat discolouration on the underside of the stage and bell
  const soot = (x, y, z, c) => { const k = smooth(3.0, 0.9, Math.hypot(x, z)) * smooth(3.0, 1.55, y) * 0.55; c[0] *= 1 - k; c[1] *= 1 - k; c[2] *= 1 - k; };
  foil.shadeAll(soot); metal.shadeAll(soot);

  // ───────────── cargo, barrels, ramp, tripod (lander-local ground props) ─────────────
  const props = (lx, lz, fn) => { const [x, z] = lg(lx, lz), g = env.groundY(x, z); fn(x, z, g); };
  props(-3.4, 4.9, (x, z, g) => {   // field-spares crate + core-sample case on top
    const ya = yaw + 0.22;
    matte.raw(place(bevBox(1.3, 0.82, 0.82, 0.05, 1.4), [x, g + 0.41, z], [0, ya, 0]), OLIVE, true);
    metal.raw(place(box(1.34, 0.05, 0.86, 1), [x, g + 0.82, z], [0, ya, 0]), 0x30363b, true);
    for (const sx of [-0.5, 0.5]) metal.raw(place(box(0.08, 0.84, 0.88, 1), [x + sx * Math.cos(ya), g + 0.42, z - sx * Math.sin(ya)], [0, ya, 0]), 0x2a2f33, true);
    decals.addW(decalGeo(atlas.rects.crate1, 0.78, 0.35), [x + 0.425 * Math.sin(ya), g + 0.42, z + 0.425 * Math.cos(ya)], [0, ya, 0], 0xffffff);
    matte.raw(place(bevBox(0.95, 0.46, 0.62, 0.05, 1), [x + 0.05, g + 1.08, z - 0.02], [0, ya + 0.35, 0]), ORANGE, true);
    decals.addW(decalGeo(atlas.rects.crate2, 0.5, 0.225), [x + 0.05 + 0.32 * Math.sin(ya + 0.35), g + 1.08, z - 0.02 + 0.32 * Math.cos(ya + 0.35)], [0, ya + 0.35, 0], 0xffffff);
    for (const sx of [-0.28, 0.28]) metal.raw(place(box(0.07, 0.1, 0.03, 1), [x + 0.05 + 0.32 * Math.sin(ya + 0.35) + sx * Math.cos(ya + 0.35), g + 1.1, z - 0.02 + 0.32 * Math.cos(ya + 0.35) - sx * Math.sin(ya + 0.35)], [0, ya + 0.35, 0]), 0xa0a6aa, true);
    colliders.push(kit.cyl(x, z, 0.85, g - 0.3, g + 1.4));
  });
  props(-4.8, 3.3, (x, z, g) => {    // long tripod case
    const ya = yaw + 1.25;
    matte.raw(place(bevBox(1.9, 0.5, 0.5, 0.05, 1.4), [x, g + 0.25, z], [0, ya, 0]), 0x535b43, true);
    for (const sx of [-0.55, 0.55]) metal.raw(place(box(0.07, 0.52, 0.52, 1), [x + sx * Math.cos(ya), g + 0.26, z - sx * Math.sin(ya)], [0, ya, 0]), 0x2a2f33, true);
    colliders.push(aabb(x, z, 1.9, 0.5, ya, g - 0.3, g + 0.55));
  });
  props(-2.2, 6.3, (x, z, g) => {    // three drums
    for (const [dx, dz, c] of [[0, 0, 0x2f5a73], [0.62, 0.22, 0xb08a1c], [0.25, 0.7, 0x4b5a36]]) {
      const X = x + dx, Z = z + dz, G = env.groundY(X, Z);
      matte.raw(place(cylY(0.3, 0.3, 0.86, 16), [X, G, Z]), c, true);
      for (const yy of [0.18, 0.44, 0.7]) metal.raw(tube([X, G + yy, Z], [X, G + yy + 0.035, Z], 0.31, 0.31, 16, true), 0x23272b, true);
      haz.raw(scaleUV(tube([X, G + 0.5, Z], [X, G + 0.62, Z], 0.305, 0.305, 16, true), 5, 0.3), 0xffffff, true);
      metal.raw(place(cylY(0.08, 0.08, 0.04, 8), [X + 0.12, G + 0.865, Z + 0.05]), 0x7c8388, true);
      colliders.push(kit.cyl(X, Z, 0.34, G - 0.2, G + 0.9));
    }
  });
  props(2.6, 6.6, (x, z, g) => {    // folded rover ramp: lower panel on the ground, upper panel hinged up against nothing
    const ya = yaw + 0.9, hx = x + Math.sin(ya) * 0.58, hz = z + Math.cos(ya) * 0.58, hg = env.groundY(hx, hz);
    plate.raw(place(box(0.7, 0.05, 1.16, 0.6), [x, g + 0.04, z], [0, ya, 0]), 0xffffff, true);
    plate.raw(sub(box(0.7, 0.05, 1.16, 0.6), [0, 0, 0.58], [hx, hg + 0.05, hz], [-0.95, ya, 0]), 0xffffff, true);
    haz.raw(sub(box(0.7, 0.07, 0.09, 0.4), [0, 0, 1.12], [hx, hg + 0.05, hz], [-0.95, ya, 0]), 0xffffff, true);
    for (const s2 of [-0.35, 0.35]) metal.raw(place(box(0.04, 0.07, 1.16, 1), [x + Math.cos(ya) * s2, g + 0.07, z - Math.sin(ya) * s2], [0, ya, 0]), ALU, true);
    metal.raw(tube([hx - Math.cos(ya) * 0.36, hg + 0.05, hz + Math.sin(ya) * 0.36], [hx + Math.cos(ya) * 0.36, hg + 0.05, hz - Math.sin(ya) * 0.36], 0.03, 0.03, 6), ALU, true);
    colliders.push(aabb(x + Math.sin(ya) * 0.4, z + Math.cos(ya) * 0.4, 0.8, 1.4, ya, g - 0.3, g + 0.5));
  });
  props(3.8, 5.6, (x, z, g) => {     // toppled surveyor's tripod
    const ya = yaw + 2.3;
    for (let i = 0; i < 3; i++) { const a = ya + i * 0.5 - 0.5, L = 1.5; const x1 = x + Math.cos(a) * L, z1 = z - Math.sin(a) * L; metal.raw(tube([x, env.groundY(x, z) + 0.12, z], [x1, env.groundY(x1, z1) + 0.04, z1], 0.028, 0.02, 6), 0xa68a52, true); metal.raw(place(cylY(0.03, 0.02, 0.1, 6), [x1, env.groundY(x1, z1) + 0.02, z1]), 0x23272b, true); }
    metal.raw(place(bevBox(0.22, 0.14, 0.18, 0.02, 1), [x, g + 0.16, z], [0, ya, 0.3]), 0x2a2f33, true);
    metal.raw(tube([x, g + 0.22, z], [x - 0.2 * Math.cos(ya), g + 0.3, z + 0.2 * Math.sin(ya)], 0.045, 0.045, 10, false), 0x1c2125, true);
  });

  // ───────────── coring rig (orange) on the right side + sample rack + umbilical ─────────────
  const rgX = 6.5, rgZ = 1.6;
  { const [cx, cz] = lg(rgX, rgZ), gR = env.groundY(cx, cz), ya = yaw + 0.5, hubY = gR + 1.55;
    const hub = [cx, hubY, cz];
    for (let i = 0; i < 3; i++) {
      const a = ya + i * TAU / 3 + 0.5, fx = cx + Math.sin(a) * 1.35, fz = cz + Math.cos(a) * 1.35, fg = env.groundY(fx, fz);
      matte.raw(tube([fx, fg + 0.03, fz], hub, 0.05, 0.065, 8), RIG, true); matte.raw(place(cylY(0.1, 0.1, 0.04, 10), [fx, fg, fz]), 0x2a2e32, true);
      matte.raw(place(bevBox(0.34, 0.16, 0.34, 0.03, 1), [fx, fg + 0.08, fz], [0, a, 0]), 0x3f4448, true);
      metal.raw(tube([fx, fg + 0.5, fz], [lerp(fx, cx, 0.62), lerp(fg + 0.5, hubY - 0.3, 0.62), lerp(fz, cz, 0.62)], 0.022, 0.022, 5), ALU, true);
    }
    matte.raw(place(bevBox(0.5, 0.2, 0.5, 0.03, 1), [cx, hubY, cz], [0, ya, 0]), RIG, true);
    const sx = Math.sin(ya + Math.PI / 2) * 0.13, sz = Math.cos(ya + Math.PI / 2) * 0.13;
    for (const sg of [-1, 1]) metal.raw(tube([cx + sx * sg, hubY + 0.1, cz + sz * sg], [cx + sx * sg, hubY + 2.0, cz + sz * sg], 0.04, 0.04, 8), ALU_D, true);
    matte.raw(place(bevBox(0.4, 0.12, 0.34, 0.02, 1), [cx, hubY + 2.06, cz], [0, ya, 0]), RIG, true);
    matte.raw(place(bevBox(0.36, 0.5, 0.3, 0.03, 1), [cx, hubY + 1.15, cz], [0, ya, 0]), RIG, true);
    metal.raw(place(cylY(0.14, 0.14, 0.5, 14), [cx, hubY + 1.45, cz]), 0x23272b, true); metal.raw(place(cylY(0.1, 0.1, 0.12, 12), [cx, hubY + 0.88, cz]), ALU_D, true);
    metal.raw(tube([cx, hubY + 0.88, cz], [cx, gR - 0.15, cz], 0.038, 0.038, 8), 0x9aa0a4, true);
    for (let i = 1; i <= 3; i++) metal.raw(tube([cx, hubY + 0.88 - i * 0.55, cz], [cx, hubY + 0.88 - i * 0.55 + 0.04, cz], 0.055, 0.055, 10), ALU_D, true);
    // hydraulic feed cylinders, winch drum + cable, work lamp (dead), spare drill rods and a white core tube
    for (const sg of [-1, 1]) { const ox = sx * sg * 1.9, oz = sz * sg * 1.9; metal.raw(tube([cx + ox, hubY + 0.15, cz + oz], [cx + ox, hubY + 1.1, cz + oz], 0.03, 0.03, 8), 0xcfd3d6, true); metal.raw(tube([cx + ox, hubY + 1.1, cz + oz], [cx + ox, hubY + 1.7, cz + oz], 0.017, 0.017, 6), ALU, true); }
    metal.raw(tube([cx - Math.cos(ya) * 0.22, hubY + 2.2, cz + Math.sin(ya) * 0.22], [cx + Math.cos(ya) * 0.22, hubY + 2.2, cz - Math.sin(ya) * 0.22], 0.1, 0.1, 12, false), 0x2f353a, true);
    metal.raw(tube([cx + Math.cos(ya) * 0.2, hubY + 2.14, cz - Math.sin(ya) * 0.2], [cx + Math.sin(ya) * 0.12, hubY + 1.4, cz + Math.cos(ya) * 0.12], 0.008, 0.008, 4), 0x9aa0a4, true);
    matte.raw(place(bevBox(0.18, 0.12, 0.14, 0.02, 1), [cx + Math.sin(ya) * 0.1, hubY + 2.3, cz + Math.cos(ya) * 0.1], [0, ya, 0]), 0x2f353a, true);
    metal.raw(tube([cx + Math.sin(ya + 2.1) * 1.0, gR + 0.05, cz + Math.cos(ya + 2.1) * 1.0], [cx + Math.sin(ya + 2.1) * 0.7, gR + 1.2, cz + Math.cos(ya + 2.1) * 0.7], 0.05, 0.05, 8, false), 0xdadcd8, true);
    for (let i = 0; i < 3; i++) metal.raw(tube([cx + Math.sin(ya - 0.9) * (0.95 + i * 0.1), gR + 0.05, cz + Math.cos(ya - 0.9) * (0.95 + i * 0.1)], [cx + Math.sin(ya - 0.9) * (0.7 + i * 0.1), gR + 1.35, cz + Math.cos(ya - 0.9) * (0.7 + i * 0.1)], 0.025, 0.025, 6), 0x9aa0a4, true);
    decals.addW(decalGeo(atlas.rects.drill, 0.34, 0.093), [cx + Math.sin(ya) * 0.185, hubY + 1.18, cz + Math.cos(ya) * 0.185], [0, ya, 0], 0xffffff);
    // control box + hoses + sample rack
    const bx = cx + Math.sin(ya + 1.9) * 1.9, bz = cz + Math.cos(ya + 1.9) * 1.9, gb = env.groundY(bx, bz);
    matte.raw(place(bevBox(0.8, 0.5, 0.5, 0.05, 1), [bx, gb + 0.27, bz], [0, ya + 0.6, 0]), ORANGE, true);
    metal.raw(place(box(0.34, 0.2, 0.03, 1), [bx + 0.27 * Math.sin(ya + 0.6), gb + 0.34, bz + 0.27 * Math.cos(ya + 0.6)], [0, ya + 0.6, 0]), 0x15191c, true);
    led.raw(place(new THREE.BoxGeometry(0.035, 0.035, 0.02), [bx + 0.29 * Math.sin(ya + 0.6) + 0.2 * Math.cos(ya + 0.6), gb + 0.42, bz + 0.29 * Math.cos(ya + 0.6) - 0.2 * Math.sin(ya + 0.6)]), [0.04, 0.35, 0.12], true);
    wcable(matte, catenary([cx, hubY + 1.45, cz], [bx, gb + 0.42, bz], 0.5, 10), 0.03, RUBBER, 5);
    colliders.push(kit.cyl(cx, cz, 1.45, gR - 0.3, gR + 3.2)); colliders.push(kit.cyl(bx, bz, 0.5, gb - 0.2, gb + 0.6));
    const rx = cx + Math.sin(ya - 1.9) * 2.0, rz = cz + Math.cos(ya - 1.9) * 2.0, gRk = env.groundY(rx, rz);
    for (const sg of [-0.55, 0.55]) metal.raw(place(bevBox(0.06, 0.45, 0.5, 0.01, 1), [rx + sg, gRk + 0.22, rz]), 0x2a2f33, true);
    for (let i = 0; i < 6; i++) { const ox = (i - 2.5) * 0.11; metal.raw(tube([rx + 0.5, gRk + 0.5 + (i % 2) * 0.0, rz + ox], [rx - 0.5, gRk + 0.5, rz + ox], 0.045, 0.045, 8, false), i === 2 ? 0xb9a46a : 0xd9dcd6, true); }
    metal.raw(place(box(1.1, 0.04, 0.78, 1), [rx, gRk + 0.44, rz]), 0x30363b, true);
    // umbilical from the box to the ladder foot, then zip-tied up the ladder rail to the hatch
    const pts = []; const lf = ladFoot, n = 14;
    for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(bx, lf.x + 0.62 * cyw, t) + Math.sin(t * 8) * 0.35 * Math.sin(t * Math.PI), z = lerp(bz, lf.z - 0.62 * syw, t); pts.push([x, env.groundY(x, z) + 0.05, z]); }
    wcable(matte, pts, 0.05, RUBBER, 5);
    const side = new THREE.Vector3(cyw, 0, -syw), up = [];
    for (let i = 0; i <= 9; i++) { const t = i / 9, p = ladFoot.clone().lerp(ladTop, t).addScaledVector(side, 0.34 + (i % 2 ? 0.03 : -0.01)); up.push([p.x, p.y + 0.06 + (i % 2 ? 0.03 : 0), p.z]); }
    wcable(matte, [pts[n], ...up], 0.04, RUBBER, 5);
    for (let i = 1; i < 9; i++) wtube(metal, [up[i][0] - side.x * 0.08, up[i][1], up[i][2] - side.z * 0.08], [up[i][0] + side.x * 0.01, up[i][1], up[i][2] + side.z * 0.01], 0.012, 0.012, 5, 0x6a7075);
  }

  // ───────────── ground: ash drifts (irregular multi-blob mounds + painted soft drifts), scorch decal, fissure glow ─────────────
  const mounds = [];   // visible height h, radii rx/rz (a half-buried ellipsoid: centre 0.6·sy below ground → gentle rim slope)
  for (const L of legs) mounds.push({ x: L.px, z: L.pz, rx: L.sunk ? 1.5 : 0.85, rz: L.sunk ? 1.3 : 0.75, h: L.sunk ? 0.4 : 0.13, ry: L.phi, n: L.sunk ? 6 : 4, col: L.sunk ? 0x6d6862 : 0x5d5853 });
  for (const [lx, lz, rx, rz, h, ry] of [[-3.6, 4.5, 1.3, 0.85, 0.13, 0.4], [6.9, 3.0, 1.1, 0.8, 0.12, 0.5], [-6.8, 0.6, 1.8, 0.95, 0.17, 1.4], [0.5, -5.9, 1.9, 1.0, 0.15, 1.8]]) {
    const [x, z] = lg(lx, lz); mounds.push({ x, z, rx, rz, h, ry: yaw + ry, n: 4, col: 0x5d5853 });
  }
  { const mr = ((s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(99);
    for (const m of mounds) {
      const blobs = [[0, 0, 1, 1]];
      for (let i = 1; i < m.n; i++) { const a = mr() * TAU, d = (0.35 + 0.55 * mr()); blobs.push([Math.cos(a) * m.rx * d, Math.sin(a) * m.rz * d, 0.38 + 0.32 * mr(), 0.45 + 0.4 * mr()]); }
      for (const [ox, oz, sc, sh] of blobs) {
        const bx = m.x + ox, bz = m.z + oz, gB = env.groundY(bx, bz), sy = m.h * sh / 0.4, g = new THREE.SphereGeometry(1, 12, 7);
        place(g, [bx, gB - 0.6 * sy, bz], [0, m.ry + mr(), 0], [m.rx * sc / 0.8, sy, m.rz * sc / 0.8]);
        const tone = 0.85 + 0.3 * mr();
        shade(ashB.raw(g, m.col, true), (x, y, z, c) => { const k = tone * (0.28 + 0.72 * smooth(0, 0.7, (y - gB) / (0.4 * sy))); c[0] *= k; c[1] *= k; c[2] *= k; });
      }
    }
  }
  const groundTex = kit.canvasTexture(512, 512, (g, w, h) => {
    const rr = ((s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(77), cx = w / 2, cy = h / 2, ppm = w / 25;
    const blob = (x, y, rad, rgb, a0) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${rgb},${a0})`); gr.addColorStop(0.6, `rgba(${rgb},${a0 * 0.45})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 150; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * 215; blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 20 + rr() * 60, '160,154,146', 0.14 + rr() * 0.18); }
    g.globalCompositeOperation = 'destination-out';
    const c0 = g.createRadialGradient(cx, cy, 8, cx, cy, 125); c0.addColorStop(0, 'rgba(0,0,0,1)'); c0.addColorStop(0.65, 'rgba(0,0,0,0.92)'); c0.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = c0; g.fillRect(0, 0, w, h);
    g.lineCap = 'round';
    for (let i = 0; i < 30; i++) { const a = rr() * TAU, r0 = 50 + rr() * 40, r1 = 105 + rr() * 120; g.strokeStyle = `rgba(0,0,0,${0.3 + rr() * 0.4})`; g.lineWidth = 3 + rr() * 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.quadraticCurveTo(cx + Math.cos(a + 0.12) * (r0 + r1) / 2, cy + Math.sin(a + 0.12) * (r0 + r1) / 2, cx + Math.cos(a + 0.05) * r1, cy + Math.sin(a + 0.05) * r1); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    // heat-oxidised rim of the blast zone (rust-brown), then soot toward the centre
    for (let i = 0; i < 70; i++) { const a = rr() * TAU, d = 85 + rr() * 55; blob(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 14 + rr() * 26, '104,50,26', 0.16 + rr() * 0.14); }
    const c1 = g.createRadialGradient(cx, cy, 6, cx, cy, 112); c1.addColorStop(0, 'rgba(6,5,5,0.92)'); c1.addColorStop(0.6, 'rgba(10,8,8,0.7)'); c1.addColorStop(1, 'rgba(10,8,8,0)'); g.fillStyle = c1; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 20; i++) { const a = rr() * TAU, r0 = 60 + rr() * 30, r1 = 100 + rr() * 90; g.strokeStyle = `rgba(8,6,6,${0.2 + rr() * 0.25})`; g.lineWidth = 2 + rr() * 5; g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke(); }
    // soft ash drifts piled around every footpad (the front-right one is buried deepest)
    for (const L of legs) { const px = cx + (L.px - slot.x) * ppm, py = cy + (L.pz - slot.z) * ppm; blob(px, py, (L.sunk ? 2.5 : 1.8) * ppm, '150,144,136', L.sunk ? 0.62 : 0.5); for (let i = 0; i < 6; i++) { const a = rr() * TAU, d = (0.9 + rr() * 1.5) * ppm; blob(px + Math.cos(a) * d, py + Math.sin(a) * d, (0.4 + rr() * 0.6) * ppm, '150,144,136', 0.3 + rr() * 0.2); } }
  }, { wrap: false });
  const mGround = kit.std({ map: groundTex, transparent: true, depthWrite: false, roughness: 0.96, metalness: 0 });
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(25, 25).rotateX(-Math.PI / 2), mGround);
  groundMesh.position.set(slot.x, g0 + 0.05, slot.z); groundMesh.renderOrder = 1; groundMesh.receiveShadow = true; groundMesh.name = 'scorch';
  group.add(groundMesh);

  // fissure glow on the lava side
  const river = env.features.river, near = river ? nearestRiver(river, slot.x, slot.z, 260) : { dx: -1, dz: 0 };
  const fd = [near.dx, near.dz], fdist = 9.3, fxw = slot.x + fd[0] * fdist, fzw = slot.z + fd[1] * fdist, fgy = env.groundY(fxw, fzw);
  const fissTex = kit.canvasTexture(256, 128, (g, w, h) => {
    const rr = ((s) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(123), paths = [];
    const crack = (x, y, a, len, depth) => {
      const pts = [[x, y]];
      for (let i = 0; i < 9; i++) { a += (rr() - 0.5) * 0.9; x += Math.cos(a) * len / 9; y += Math.sin(a) * len / 9; pts.push([x, y]); if (depth > 0 && rr() < 0.3) crack(x, y, a + (rr() - 0.5) * 2.0, len * 0.4, depth - 1); }
      paths.push(pts);
    };
    crack(14, 70, 0.05, 230, 1);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [lw, col] of [[18, 'rgba(110,26,4,0.20)'], [11, 'rgba(190,56,8,0.38)'], [6, '#ff7a1a'], [2.6, '#ffc868'], [1.1, '#fff2cc']]) {
      g.lineWidth = lw; g.strokeStyle = col;
      for (const pts of paths) { g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); }
    }
  }, { wrap: false });
  const fissMat = new THREE.MeshBasicMaterial({ map: fissTex, color: new THREE.Color(3.4, 1.0, 0.22), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, fog: false });
  const fissMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2).rotateX(-Math.PI / 2), fissMat);
  fissMesh.position.set(fxw, fgy + 0.07, fzw); fissMesh.rotation.y = Math.atan2(fd[0], fd[1]) + Math.PI / 2 + 0.3; fissMesh.renderOrder = 2; fissMesh.name = 'fissure';
  group.add(fissMesh);
  const fissLight = kit.pointLight(0xff6a22, 42, 28, [fxw, fgy + 1.0, fzw]); group.add(fissLight);

  // ───────────── recorder at the ladder foot ─────────────
  const recX = ladFoot.x - 1.15 * cyw + 0.55 * syw, recZ = ladFoot.z + 1.15 * syw + 0.55 * cyw, recG = env.groundY(recX, recZ);
  matte.raw(place(bevBox(0.85, 0.5, 0.55, 0.05, 0.8), [recX, recG + 0.27, recZ], [0, yaw + 0.5, 0]), OLIVE, true);
  metal.raw(place(box(0.87, 0.03, 0.57, 1), [recX, recG + 0.29, recZ], [0, yaw + 0.5, 0]), 0x1e211b, true);
  const rec = kit.recorder({ title: 'LOG 02', sub: 'SURVEY A', accent: '#ff9b3a' });
  rec.position.set(recX, recG + 0.52 + 0.63, recZ); rec.rotation.y = yaw + 0.5;
  colliders.push(aabb(recX, recZ, 0.95, 0.65, yaw + 0.5, recG - 0.2, recG + 0.55));

  // ───────────── hull-side decals (cabin / stage) ─────────────
  for (const k of [2, 6]) { const phi = k * 45 * DEG, [nx, nz] = nrm(phi), r = ac + 0.009; decals.add(decalGeo(atlas.rects.reg, 1.2, 0.5), [nx * r, 4.45, nz * r], [0, phi, 0], 0xffffff); }
  for (const k of [1, 7]) { const phi = k * 45 * DEG, [nx, nz] = nrm(phi), r = ac + 0.009; decals.add(decalGeo(atlas.rects.survey, 1.2, 0.173), [nx * r, 4.15, nz * r], [0, phi, 0], 0xffffff); }
  for (const k of [3, 5]) { const phi = k * 45 * DEG, [nx, nz] = nrm(phi), r = ac + 0.009; decals.add(decalGeo(atlas.rects.unit, 1.2, 0.16), [nx * r, 4.3, nz * r], [0, phi, 0], 0xffffff); }
  for (const phiD of [60, 300]) { const phi = phiD * DEG, [nx, nz] = nrm(phi), tx = nz, tz = -nx; decals.add(decalGeo(atlas.rects.danger, 0.56, 0.236), [nx * (apo + 0.005) + tx * 0.0, 2.12, nz * (apo + 0.005) + tz * 0.0], [0, phi, 0], 0xffffff); }

  // dirt: cabin base + stage darken toward the pad (dust thrown up at touchdown)
  const dirt = (x, y, z, c) => { const d = 1 - 0.22 * smooth(5.0, 3.7, y); c[0] *= d; c[1] *= d; c[2] *= d; };
  paint.shadeAll(dirt);
  // ───────────── assemble draw calls ─────────────
  const meshes = {};
  const addMesh = (b, mat, name, shadow = true, M = Mb) => { const m = b.mesh(mat, M); m.name = name; if (!shadow) { m.castShadow = false; m.receiveShadow = false; } group.add(m); meshes[name] = m; return m; };
  addMesh(foil, mFoil, 'foil'); addMesh(paint, mPaint, 'paint'); addMesh(metal, mMetal, 'metal'); addMesh(matte, mMatte, 'matte'); addMesh(plate, mPlate, 'plate'); addMesh(haz, mHaz, 'haz');
  addMesh(dbl, mDbl, 'dbl'); addMesh(ashB, mAshG, 'ashdrift'); addMesh(glass, mGlass, 'glass', false); addMesh(led, mLed, 'leds', false); addMesh(status, statusMat, 'status', false);
  addMesh(decals, mDecal, 'decals', false).renderOrder = 3;
  rec.traverse((o) => { if (o.isMesh) o.castShadow = true; }); group.add(rec);

  // colliders: body cylinder + leg posts
  colliders.push(kit.cyl(slot.x, slot.z, 2.75, g0 - 0.5, g0 + 9.4));
  for (const L of legs) {
    colliders.push(kit.cyl(L.px, L.pz, 0.78, L.gP - 0.4, L.gP + 1.0));
    const m = L.M.clone().lerp(L.J, 0.35); colliders.push(kit.cyl(m.x, m.z, 0.34, L.gP, L.gP + 2.4));
  }
  colliders.push(aabb(ladFoot.x, ladFoot.z, 0.7, 0.5, yaw, ladFootY - 0.3, ladFootY + 1.6));

  // beacon on the mast, lights
  const bPos = B2W(0, 9.12, 0), beacon = kit.beacon([bPos.x, bPos.y, bPos.z], { color: 0xb8ecff, period: 2.9, duty: 0.12, size: 0.1, lightI: 8, range: 18, phase: 0.6 }); group.add(beacon.group);

  // interactables
  const pPos = B2W(3.1, 1.25, 3.5); pPos.y = env.groundY(pPos.x, pPos.z) + 1.2;
  interactables.push(kit.interactable({ id: 'poi.world.phlegethon.poi.lander', label: 'Inspect survey lander', pos: pPos, radius: 3.4, object: meshes.paint, lineId: 'world.phlegethon.poi.lander' }));
  interactables.push(kit.interactable({ id: 'log.phlegethon.2', label: 'Play field recorder', pos: new THREE.Vector3(recX, recG + 1.05, recZ), radius: 2.3, object: rec, lineId: 'log.phlegethon.2', log: true }));

  group.userData.frame = { g0, yaw, ladFoot: v3a(ladFoot), rec: [recX, recZ], fissure: [fxw, fzw], lava: near, rig: lg(rgX, rgZ) };
  const redC = new THREE.Color(0xff2a18), fissBase = new THREE.Color(3.4, 1.0, 0.22);
  return {
    group, interactables, colliders,
    update(dt, t) {
      const f = 1 + 0.2 * Math.sin(t * 6.3) + 0.13 * Math.sin(t * 11.7 + 1.1) + 0.08 * Math.sin(t * 23.0 + 0.4) + (Math.sin(t * 1.7 + 2) > 0.9 ? 0.3 : 0);
      fissLight.intensity = 42 * f; fissMat.color.copy(fissBase).multiplyScalar(0.78 + 0.28 * f);
      const p = (t % 4.2) / 4.2, pulse = p < 0.22 ? Math.pow(Math.sin(p / 0.22 * Math.PI), 2) : 0;
      statusMat.color.copy(redC).multiplyScalar(0.12 + 6.5 * pulse);
      beacon.update(t); rec.userData.ledUpdate?.(t);
    },
    dispose() {},
  };
}

