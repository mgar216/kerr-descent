// ORPHEUS · Elysium — slot `camp` (padR 16): Elena & Tomas's camp.
// Two ribbed shelters (one glowing warm), folding work table with instruments + ELENA's recorder, stove & mugs, stools & blanket, notice board with the
// family photo, crates stencilled EURYDICE HX-01, folded solar fabric angled at the galaxy light, a lamp string between poles (ONE shared PointLight),
// a hand-built crystal chime, boot prints, mast + cyan beacon.  Interactables: poi.world.elysium.poi.camp, log.elysium.1 (ELENA).
import * as THREE from 'three';
import { Kb, boxFaceUV, glowTexture, decalQuad, mergeDecals, decalMat, baseMats, recorderScreen, recorderNoLegs, recorderStyle, consolidate, surface, printsGeo, TAU, lerp, smooth, clamp, HAND, SANS } from './poi_elysium_lib.js';
import { fabricTexture, boardTexture, crateTexture, solarTexture, instrumentTexture, INSTR_UV, printTexture } from './poi_elysium_camp_tex.js';
import { shelterA, shelterB, HOT } from './poi_elysium_shelters.js';

const PI = Math.PI;
const K = { cream: 0xe6e0d2, alu: 0xb7bec5, steel: 0x8b939b, dark: 0x2a2e34, carbon: 0x1d1f23, orange: 0xe5742b, cyan: 0x2cb7cb, teal: 0x4d6874, mustard: 0xcf8f35, olive: 0x6c7765,
  red: 0xc23b2c, navy: 0x233357, rubber: 0x16181b, laminate: 0xa3adb4, white: 0xe9e6dc, blue: 0x4a7fa8 };
const CELL = { A: [0.004, 0.504, 0.496, 0.996], B: [0.504, 0.504, 0.996, 0.996], C: [0.004, 0.004, 0.496, 0.496], D: [0.504, 0.004, 0.996, 0.496] };
const planeUV = (g, r) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, r[0] + uv.getX(i) * (r[2] - r[0]), r[1] + uv.getY(i) * (r[3] - r[1])); return g; };

export function buildCamp(env, slot, L) {
  const { kit } = env;
  const kb = new Kb(61).bind(env, L), M = baseMats(kit), rnd = kit.rng('camp');
  const group = new THREE.Group(); group.name = 'elysium.camp';
  const X = { env, kit, kb, L, M, group, rnd, slot, sun: env.sunDir.clone(), colliders: [], interactables: [], ups: [], decals: [] };
  X.cylC = (lx, lz, r, h) => { const [x, z] = L.xz(lx, lz), y = env.groundY(x, z); X.colliders.push(kit.cyl(x, z, r, y, y + h)); };
  X.boxC = (lx, lz, w, d, h, yaw = 0) => { const a = L.yaw + yaw, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), ex = (w * c + d * s) / 2, ez = (w * s + d * c) / 2, [x, z] = L.xz(lx, lz), y = env.groundY(x, z); X.colliders.push(kit.box([x - ex, y, z - ez], [x + ex, y + h, z + ez])); };
  X.rot = (lx, lz, yaw, ox, oz) => [lx + ox * Math.cos(yaw) + oz * Math.sin(yaw), lz - ox * Math.sin(yaw) + oz * Math.cos(yaw)];

  const tFab = fabricTexture(kit), tCrate = crateTexture(kit), tSolar = solarTexture(kit), tInstr = instrumentTexture(kit), tGlow = glowTexture(kit), tPrint = printTexture(kit);
  const board = boardTexture(kit);
  X.photoUV = board.photoUV;

  const sa = shelterA(X), sb = shelterB(X);
  const tb = workTable(X);
  noticeBoard(X);
  kitchen(X);
  crates(X);
  const sol = solarArray(X);
  const mast = mastAndLamps(X);
  const chime = hangChime(X, mast);
  X.decals.push(...glowDecals(X, sa, mast, tb));
  const printsGeo = bootPrints(X);

  // ───────── materials → meshes ─────────
  const mFabA = kit.std({ map: tFab, color: 0xfff0dc, roughness: 0.86, side: THREE.DoubleSide, vertexColors: true, emissive: 0xffc27a, emissiveMap: tFab, emissiveIntensity: 0.85 });
  const mFabB = kit.std({ map: tFab, color: 0xcdd6dc, roughness: 0.86, side: THREE.DoubleSide, vertexColors: true });
  const mCrate = kit.std({ map: tCrate, color: 0xffffff, roughness: 0.6, metalness: 0.08, vertexColors: true });
  const mSolar = kit.std({ map: tSolar, color: 0xffffff, roughness: 0.3, metalness: 0.4, vertexColors: true });
  const mBoard = kit.std({ map: board.tex, color: 0xffffff, roughness: 0.92, vertexColors: true, emissive: 0xffffff, emissiveMap: board.tex, emissiveIntensity: 0.16 });
  const mScreen = kit.screen(tInstr, 1.35);
  const add = (m) => { if (m) group.add(m); return m; };
  add(kb.mesh('metal', M.metal)); add(kb.mesh('paint', M.paint));
  add(kb.mesh('fabA', mFabA, { weather: { dust: 0.18, frost: 0.12 } })); add(kb.mesh('fabB', mFabB, { weather: { dust: 0.22, frost: 0.16 } }));
  add(kb.mesh('crate', mCrate)); add(kb.mesh('solar', mSolar, { weather: { dust: 0.1, frost: 0.14, ao: 0.1 } }));
  add(kb.mesh('board', mBoard, { weather: false })); add(kb.mesh('screen', mScreen, { weather: false, cast: false, receive: false }));
  add(kb.mesh('glow', M.glow, { weather: false, cast: false, receive: false }));
  const dg = mergeDecals(X.decals);
  if (dg) { const dm = new THREE.Mesh(dg, decalMat(tGlow)); dm.renderOrder = 2; group.add(dm); }
  if (printsGeo) {
    const pm = new THREE.Mesh(printsGeo, kit.std({ map: tPrint, color: 0x07090e, transparent: true, opacity: 0.8, depthWrite: false, roughness: 1, metalness: 0, alphaTest: 0.02 }));
    pm.renderOrder = 3; group.add(pm);
  }
  group.add(chime.group);

  // ───────── lights ─────────
  group.add(mast.lamp, mast.beacon.group);

  // ───────── recorder = ELENA's last message (table) ─────────
  const rec = tb.rec; group.add(rec);

  // ───────── interactables ─────────
  const recPos = rec.position.clone();
  X.interactables.push(
    kit.interactable({ id: 'poi.world.elysium.poi.camp', label: 'Inspect the camp', pos: L.pos(tb.lx - 0.95, 1.15, tb.lz + 0.7), radius: 3.2, object: group, lineId: 'world.elysium.poi.camp' }),
    kit.interactable({ id: 'log.elysium.1', label: 'Play ELENA\u2019s recorder', pos: recPos.clone().add(new THREE.Vector3(0, 0.1, 0)), radius: 2.3, object: rec, lineId: 'log.elysium.1', log: true }),
  );

  // ───────── animation ─────────
  const lamp = mast.lamp, lampBase = lamp.intensity;
  X.ups.push((dt, t) => {
    mast.beacon.update(t); rec.userData.ledUpdate?.(t);
    lamp.intensity = lampBase * (1 + 0.03 * Math.sin(t * 6.3) * Math.sin(t * 1.7 + 1.1));
    chime.update(t);
  });
  return { group, interactables: X.interactables, colliders: X.colliders, update: (dt, t, cam) => { for (const u of X.ups) u(dt, t, cam); } };
}

// ═════════════════════════════════ work table, instruments, ELENA's recorder ═════════════════════════════════
function mug(kb, x, y, z, col, yaw = 0) {
  kb.cyl('paint', 0.042, 0.038, 0.09, 12, [x, y + 0.045, z], null, col);
  kb.cyl('paint', 0.035, 0.035, 0.004, 12, [x, y + 0.09, z], null, 0x1d130f);
  kb.add('paint', new THREE.TorusGeometry(0.03, 0.0065, 5, 10, PI), [x + Math.cos(yaw) * 0.046, y + 0.045, z - Math.sin(yaw) * 0.046], [0, yaw, -PI / 2], 1, col);
}

function workTable(X) {
  const { kb, kit, L } = X, tx = 0.9, tz = 1.3, ty = -0.05, TW = 1.5, TD = 0.72, TH = 0.76;
  kb.at(tx, tz, ty);
  kb.box('paint', TW, 0.03, TD, [0, TH - 0.015, 0], null, K.laminate);                                      // laminate top
  for (const sz of [-1, 1]) kb.box('metal', TW + 0.03, 0.045, 0.03, [0, TH - 0.03, sz * TD / 2], null, K.alu);
  for (const sx of [-1, 1]) kb.box('metal', 0.03, 0.045, TD, [sx * TW / 2, TH - 0.03, 0], null, K.alu);
  for (const sx of [-1, 1]) {                                                                                // folding X legs
    const x = sx * (TW / 2 - 0.1), d = TD / 2 - 0.06;
    kb.rod('metal', [x, 0.015, d], [x, TH - 0.05, -d], 0.017, 0.017, K.alu, 6); kb.rod('metal', [x, 0.015, -d], [x, TH - 0.05, d], 0.017, 0.017, K.alu, 6);
    kb.cyl('metal', 0.022, 0.022, 0.06, 8, [x, (TH - 0.04) / 2, 0], [0, 0, PI / 2], K.steel);
    for (const sz of [-1, 1]) kb.cyl('paint', 0.024, 0.028, 0.03, 6, [x, 0.015, sz * d], null, K.rubber);
    kb.box('metal', 0.03, 0.03, TD - 0.1, [x, 0.3, 0], null, K.alu);
  }
  // tablet on a stand
  kb.sub([0.5, TH + 0.085, 0.0], [-0.6, 0, 0]);
  kb.box('paint', 0.3, 0.2, 0.016, [0, 0, 0], null, K.dark);
  kb.add('screen', planeUV(new THREE.PlaneGeometry(0.272, 0.172), INSTR_UV.tablet), [0, 0, 0.0085]);
  kb.rod('metal', [0, -0.06, -0.01], [0, -0.17, -0.12], 0.008, 0.008, K.steel, 5);
  kb.end();
  // handheld readout + analyzer box + lamp + notebook + pen + mugs + framed photo
  kb.sub([0.3, TH + 0.015, -0.1], [-0.2, 0.35, 0]); kb.box('paint', 0.09, 0.15, 0.03, [0, 0, 0], null, K.mustard);
  kb.add('screen', planeUV(new THREE.PlaneGeometry(0.07, 0.057), INSTR_UV.hand), [0, 0.03, 0.0158]); kb.cyl('paint', 0.012, 0.012, 0.018, 8, [-0.02, -0.05, 0.016], [PI / 2, 0, 0], K.dark); kb.end();
  kb.box('paint', 0.28, 0.14, 0.1, [0.6, TH + 0.07, -0.2], [0, -0.15, 0], K.steel);
  kb.cyl('paint', 0.02, 0.02, 0.025, 10, [0.54, TH + 0.14, -0.15], [PI / 2, 0, 0], K.orange); kb.cyl('paint', 0.02, 0.02, 0.025, 10, [0.62, TH + 0.14, -0.14], [PI / 2, 0, 0], K.dark);
  kb.box('glow', 0.012, 0.012, 0.012, [0.7, TH + 0.145, -0.145], null, [0.2, 3.2, 0.9]); kb.box('glow', 0.012, 0.012, 0.012, [0.675, TH + 0.145, -0.15], null, [3.2, 0.5, 0.2]);
  kb.tube('paint', [[0.46, TH + 0.01, -0.2], [0.4, TH + 0.012, -0.05], [0.44, TH + 0.01, 0.12], [0.5, TH + 0.012, 0.15]], 0.006, K.carbon, 10, 4);   // cable to tablet
  // battery lantern (lit)
  kb.cyl('metal', 0.07, 0.075, 0.03, 12, [0.66, TH + 0.015, 0.18], null, K.steel); kb.cyl('glow', 0.052, 0.052, 0.14, 12, [0.66, TH + 0.1, 0.18], null, HOT(1.05));
  kb.cyl('metal', 0.07, 0.055, 0.03, 12, [0.66, TH + 0.185, 0.18], null, K.steel);
  kb.add('metal', new THREE.TorusGeometry(0.06, 0.005, 5, 12, PI), [0.66, TH + 0.2, 0.18], [0, 0, 0], 1, K.steel);
  for (const a of [0.4, 2.1, 3.9, 5.5]) kb.rod('metal', [0.66 + Math.cos(a) * 0.055, TH + 0.03, 0.18 + Math.sin(a) * 0.055], [0.66 + Math.cos(a) * 0.055, TH + 0.185, 0.18 + Math.sin(a) * 0.055], 0.004, 0.004, K.steel, 4);
  kb.box('paint', 0.2, 0.012, 0.14, [-0.5, TH + 0.006, -0.17], [0, 0.12, 0], 0xd6d2c4); kb.box('paint', 0.2, 0.012, 0.14, [-0.3, TH + 0.006, -0.19], [0, 0.04, 0], 0xcfcbbd);   // open notebook
  kb.box('paint', 0.41, 0.006, 0.15, [-0.4, TH + 0.001, -0.18], [0, 0.08, 0], K.navy);
  kb.rod('paint', [-0.32, TH + 0.016, -0.1], [-0.18, TH + 0.016, -0.05], 0.006, 0.005, K.orange, 6);
  mug(kb, -0.62, TH, 0.14, K.orange, 0.5); mug(kb, -0.5, TH, 0.02, K.white, -0.6);
  // little framed photo (same family print as on the board)
  const fg = new THREE.PlaneGeometry(0.12, 0.085); planeUV(fg, X.photoUV);
  kb.sub([0.27, TH, 0.23], [0, -0.45, 0]);
  kb.sub([0, 0.0, 0], [-0.2, 0, 0]); kb.box('metal', 0.14, 0.105, 0.012, [0, 0.055, 0], null, K.alu); kb.add('board', fg, [0, 0.055, 0.0068]); kb.end();
  kb.rod('metal', [0, 0.05, -0.01], [0, 0.0, -0.075], 0.006, 0.006, K.steel, 4);
  kb.end();

  // ELENA's field recorder, lying on the table, display facing the way the camp is approached
  const rec = recorderStyle(kit.recorder({ title: 'FOR THE COMMANDER', sub: 'AND MIRA', accent: '#ffc680' }), 0x6a7480, 0xd9822f);
  recorderScreen(kit, rec, (g, w, h) => {
    g.fillStyle = '#071218'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w * 0.6); gr.addColorStop(0, 'rgba(255,190,120,0.16)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,198,128,0.85)'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd7a0'; g.font = `700 21px ${SANS}`; g.fillText('FOR THE COMMANDER', w / 2, 31);
    g.font = `700 30px ${SANS}`; g.fillStyle = '#ffe9c4'; g.fillText('AND MIRA', w / 2, 62);
    g.fillStyle = 'rgba(255,198,128,0.55)'; for (let i = 0; i < 28; i++) { const a = 3 + Math.abs(Math.sin(i * 0.9)) * 5; g.fillRect(40 + i * 6.2, 82 - a / 2, 3, a); }
  }, 2.4);
  recorderNoLegs(rec); consolidate(rec);
  const [rx, rz] = X.rot(tx, tz, ty, -0.14, 0.08), wp = L.pos(rx, TH + 0.158, rz);
  rec.position.copy(wp); rec.rotation.set(-0.3, L.yaw + ty + 0.06, 0, 'YXZ'); kit.shadows(rec, true, true);
  X.boxC(tx, tz, TW + 0.1, TD + 0.1, TH + 0.05, ty);
  return { rec, lx: tx, lz: tz, TH };
}

// ═════════════════════════════════ notice board (easel) ═════════════════════════════════
function noticeBoard(X) {
  const { kb } = X, lx = -2.5, lz = 2.55, ly = 0.35;
  kb.at(lx, lz, ly);
  kb.sub([0, 1.46, 0.0], [-0.1, 0, 0]);
  const bg = new THREE.BoxGeometry(1.06, 0.8, 0.04); boxFaceUV(bg, [null, null, null, null, [0.003, 0.003, 0.997, 0.997], null]);
  kb.add('board', bg, [0, 0, 0], null, 1, 0xffffff);
  for (const sy of [-1, 1]) kb.box('metal', 1.12, 0.045, 0.06, [0, sy * 0.41, 0.005], null, K.alu);
  for (const sx of [-1, 1]) kb.box('metal', 0.045, 0.86, 0.06, [sx * 0.55, 0, 0.005], null, K.alu);
  kb.box('metal', 0.9, 0.025, 0.1, [0, -0.46, 0.05], null, K.steel);                                     // pencil tray
  kb.rod('paint', [-0.3, -0.44, 0.06], [-0.12, -0.44, 0.07], 0.007, 0.007, K.red, 6); kb.rod('paint', [0.05, -0.44, 0.07], [0.22, -0.44, 0.055], 0.007, 0.007, K.blue, 6);
  kb.end();
  for (const sx of [-1, 1]) kb.rod('metal', [sx * 0.5, 0.0, 0.05], [sx * 0.43, 1.84, -0.12], 0.02, 0.02, K.alu, 6);   // easel legs
  kb.rod('metal', [0, 0.0, -0.78], [0, 1.6, -0.14], 0.018, 0.018, K.alu, 6);
  kb.box('metal', 0.9, 0.03, 0.03, [0, 0.55, -0.02], [0.1, 0, 0], K.steel);
  X.cylC(lx, lz, 0.62, 1.9);
}

// ═════════════════════════════════ stove, mugs, stools, blanket, backpack ═════════════════════════════════
function stool(kb, x, y, z, col) {
  kb.cyl('paint', 0.19, 0.19, 0.03, 18, [x, y + 0.43, z], null, col); kb.cyl('metal', 0.2, 0.2, 0.012, 18, [x, y + 0.41, z], null, K.steel);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; kb.rod('metal', [x + Math.sin(a) * 0.11, y + 0.41, z + Math.cos(a) * 0.11], [x + Math.sin(a) * 0.25, y + 0.01, z + Math.cos(a) * 0.25], 0.013, 0.013, K.alu, 5); }
}

function kitchen(X) {
  const { kb, L } = X;
  // low supply box as the stove table
  const sx = -4.4, sz = 3.5, sy = 0.3;
  kb.at(sx, sz, sy);
  const bx = new THREE.BoxGeometry(0.72, 0.42, 0.46); boxFaceUV(bx, [CELL.B, CELL.B, CELL.C, CELL.D, CELL.A, CELL.A]); kb.add('crate', bx, [0, 0.21, 0], null, 1, K.olive);
  for (const s of [-1, 1]) kb.box('metal', 0.1, 0.05, 0.02, [s * 0.22, 0.36, 0.235], null, K.alu);
  kb.cyl('metal', 0.1, 0.12, 0.05, 14, [0, 0.445, 0], null, K.steel);                                      // burner
  kb.cyl('metal', 0.145, 0.145, 0.09, 16, [0, 0.5, 0], null, K.alu, true);                                 // windshield
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; kb.box('metal', 0.012, 0.03, 0.05, [Math.sin(a) * 0.09, 0.49, Math.cos(a) * 0.09], [0, a, 0], K.steel); }
  kb.torus('glow', 0.07, 0.009, [0, 0.472, 0], [PI / 2, 0, 0], [0.4, 1.1, 3.2], TAU, [4, 16]);               // blue flame ring
  kb.cyl('metal', 0.115, 0.115, 0.14, 16, [0, 0.61, 0], null, K.alu); kb.cyl('metal', 0.12, 0.12, 0.02, 16, [0, 0.69, 0], null, K.steel); kb.sph('metal', 0.018, [0, 0.71, 0], K.dark);
  kb.add('metal', new THREE.TorusGeometry(0.12, 0.004, 4, 14, PI), [0, 0.66, 0], [0, 0.4, 0], 1, K.steel);
  kb.cyl('paint', 0.045, 0.045, 0.15, 12, [0.24, 0.495, 0.05], null, K.mustard); kb.cyl('paint', 0.046, 0.046, 0.03, 12, [0.24, 0.52, 0.05], null, K.blue);
  kb.tube('paint', [[0.2, 0.45, 0.05], [0.14, 0.44, 0.02], [0.08, 0.455, 0]], 0.007, K.carbon, 6, 4);
  mug(kb, -0.22, 0.42, 0.02, K.white, 2.4); mug(kb, -0.27, 0.42, -0.1, K.teal, 1.2); mug(kb, -0.12, 0.42, -0.14, K.orange, 0.2);
  // two camp stools, side by side, and a blanket over one of them
  kb.world(); const [w1x, w1z] = L.xz(-1.45, 4.7), [w2x, w2z] = L.xz(-0.6, 4.95), g1 = X.env.groundY(w1x, w1z), g2 = X.env.groundY(w2x, w2z);
  stool(kb, w1x, g1, w1z, K.blue); stool(kb, w2x, g2, w2z, K.orange);
  kb.frame(w2x, g2, w2z, L.yaw + 0.25);
  kb.add('paint', blanket(), null, null, 1, (x) => { const ax = Math.abs(x); return (ax > 0.085 && ax < 0.115) || (ax > 0.19 && ax < 0.215) ? [0.5, 0.2, 0.05] : [0.04, 0.12, 0.15]; });
  kb.world();
  X.boxC(sx, sz, 0.8, 0.54, 0.75, sy);
  // a rucksack someone set down (the whole bag tilts about its base so it rests on the ground)
  kb.at(-0.35, 2.55, 0.6, 0, -0.1);
  kb.box('paint', 0.34, 0.5, 0.2, [0, 0.25, 0], null, K.navy); kb.box('paint', 0.28, 0.24, 0.09, [0, 0.14, 0.14], null, 0x2b4a73);
  kb.box('paint', 0.05, 0.4, 0.03, [-0.1, 0.27, 0.11], null, K.orange); kb.box('paint', 0.05, 0.4, 0.03, [0.1, 0.27, 0.11], null, K.orange);
  kb.cyl('paint', 0.12, 0.12, 0.3, 10, [0, 0.55, -0.02], [0, 0, PI / 2], K.orange);
}

function blanket() {
  // cloth draped over a round stool seat: flat on the seat, rounded over the front edge, hanging down
  const W = 0.56, seatY = 0.462;
  return surface(16, 14, (u, v, o) => {
    const x = (u - 0.5) * W, s = v * 0.7;
    let y, z;
    if (s < 0.4) { z = -0.2 + s; y = seatY; } else if (s < 0.4 + 0.085) { const a = (s - 0.4) / 0.085 * PI / 2; z = 0.2 + Math.sin(a) * 0.054; y = seatY - 0.054 + Math.cos(a) * 0.054; } else { z = 0.254; y = seatY - 0.054 - (s - 0.485); }
    const fold = Math.sin(x * 16 + s * 3.5) * 0.012 * smooth(0.3, 0.6, s);
    o[0] = x; o[1] = y; o[2] = z + fold;
  });
}

// ═════════════════════════════════ supply crates, sleeping mats ═════════════════════════════════
function crates(X) {
  const { kb } = X;
  const crate = (lx, lz, yaw, w, h, d, col, lift = 0) => {
    kb.at(lx, lz, yaw, lift);
    const g = new THREE.BoxGeometry(w, h, d); boxFaceUV(g, [CELL.B, CELL.B, CELL.C, CELL.D, CELL.A, CELL.A]); kb.add('crate', g, [0, h / 2, 0], null, 1, col);
    kb.box('paint', w + 0.012, 0.014, d + 0.012, [0, h * 0.82, 0], null, 0x14171a);                      // lid seam
    for (const s of [-1, 1]) { kb.box('metal', 0.11, 0.06, 0.022, [s * w * 0.3, h * 0.82, d / 2 + 0.008], null, K.alu); kb.box('paint', 0.022, 0.07, 0.2, [s * (w / 2 + 0.005), h * 0.62, 0], null, K.carbon); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kb.box('paint', 0.05, h + 0.01, 0.05, [sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02)], null, 0x1b1e22);
  };
  crate(8.15, 0.45, 0.15, 1.0, 0.62, 0.62, K.teal);
  crate(9.4, 1.0, -0.25, 1.0, 0.62, 0.62, K.mustard);
  crate(8.1, 0.45, 0.5, 0.8, 0.5, 0.5, K.olive, 0.62);
  crate(9.0, -0.55, -0.45, 0.56, 0.32, 0.4, K.orange);
  // open crate with rations
  kb.at(7.5, 1.9, 0.95);
  const og = new THREE.BoxGeometry(0.8, 0.5, 0.5); boxFaceUV(og, [CELL.B, CELL.B, CELL.C, CELL.D, CELL.A, CELL.A]); kb.add('crate', og, [0, 0.25, 0], null, 1, K.teal);
  kb.box('paint', 0.7, 0.02, 0.4, [0, 0.47, 0], null, 0x23282d);
  const cols = [0xd9d4c4, K.cyan, K.orange, 0xd9d4c4, K.mustard, K.cyan];
  for (let i = 0; i < 6; i++) kb.box('paint', 0.18, 0.1, 0.12, [-0.26 + (i % 3) * 0.26, 0.54, i < 3 ? -0.1 : 0.1], [0, (i % 2) * 0.2 - 0.1, 0], cols[i]);
  const lg = new THREE.BoxGeometry(0.8, 0.04, 0.5); boxFaceUV(lg, [null, null, CELL.C, CELL.D, null, null]); kb.add('crate', lg, [0, 0.46, -0.46], [1.25, 0, 0], 1, K.teal);
  // rolled sleeping mats leaning on the stack
  kb.at(8.7, -0.35, 0.2);
  [[0, K.orange], [0.3, K.cyan], [0.6, 0x7d8690]].forEach(([dx, c], i) => {
    kb.cyl('paint', 0.15, 0.15, 0.62, 12, [dx, 0.34, -0.12], [-0.34, 0, 0], c);
    kb.cyl('paint', 0.152, 0.152, 0.05, 12, [dx, 0.4, -0.15], [-0.34, 0, 0], K.carbon); kb.cyl('paint', 0.152, 0.152, 0.05, 12, [dx, 0.22, -0.07], [-0.34, 0, 0], K.carbon);
  });
  X.boxC(8.75, 0.55, 2.1, 1.4, 1.15, 0.05); X.boxC(7.5, 1.9, 0.9, 0.62, 0.55, 0.95);
}

// ═════════════════════════════════ solar fabric array (concertina, angled at the galaxy light) ═════════════════════════════════
function solarArray(X) {
  const { kb, L, sun } = X, lx = 9.9, lz = 4.9;
  const [wx, wz] = L.xz(lx, lz), yawW = Math.atan2(sun.x, sun.z), tilt = clamp(Math.asin(clamp(sun.y, 0.1, 0.97)), 0.45, 1.05);
  kb.frame(wx, X.env.groundY(wx, wz), wz, yawW);
  const PW = 1.08, PH = 1.5, n = 3, zig = 0.2;
  for (let i = 0; i < n; i++) {
    const cx = (i - (n - 1) / 2) * PW * Math.cos(zig), yaw = (i % 2 ? 1 : -1) * zig;
    kb.sub([cx, 0.2, 0], [-tilt, yaw, 0]);
    const g = new THREE.BoxGeometry(PW, PH, 0.025); boxFaceUV(g, [null, null, null, null, [0.003, 0.003, 0.997, 0.997], null]);
    kb.add('solar', g, [0, PH / 2, 0], null, 1, 0xffffff);
    for (const sy of [0, 1]) kb.box('metal', PW + 0.03, 0.03, 0.04, [0, sy * PH, 0], null, K.alu);
    for (const sx of [-1, 1]) kb.box('metal', 0.03, PH, 0.04, [sx * PW / 2, PH / 2, 0], null, K.alu);
    kb.end();
    kb.rod('metal', [cx, 0.2 + PH * 0.5 * Math.cos(tilt), -PH * 0.5 * Math.sin(tilt) - 0.02], [cx, 0.02, -(PH * 0.5 * Math.sin(tilt) + 0.62)], 0.016, 0.016, K.steel, 5);   // kickstand
  }
  kb.box('paint', 0.34, 0.24, 0.22, [PW * 1.9, 0.12, -0.5], [0, 0.2, 0], K.dark); kb.box('glow', 0.03, 0.012, 0.004, [PW * 1.9 - 0.08, 0.2, -0.385], [0, 0.2, 0], [0.4, 3.2, 0.8]);
  kb.box('metal', 0.36, 0.02, 0.24, [PW * 1.9, 0.245, -0.5], [0, 0.2, 0], K.alu);
  kb.tube('paint', [[PW * 1.9 - 0.1, 0.1, -0.5], [PW * 1.2, 0.03, -0.2], [PW * 0.5, 0.02, 0.1], [0, 0.03, 0.15], [-PW * 1.1, 0.02, 0.1]], 0.012, K.carbon, 14, 4);
  X.cylC(lx - 0.2, lz, 1.3, 1.2); X.cylC(lx - 1.7, lz + 0.35, 0.8, 1.0);
  return { lx, lz };
}

// ═════════════════════════════════ mast (beacon), pole & lamp string ═════════════════════════════════
function mastAndLamps(X) {
  const { kb, kit, L, env, sun } = X;
  const mx = 0.4, mz = -1.6, p1 = [-6.9, 2.3], p3 = [6.4, 2.8], H1 = 2.95, H3 = 2.95, HM = 3.05;
  // central mast (3 telescoping sections + whip), tripod foot, guy lines, dish pointed at the galaxy
  kb.at(mx, mz, 0);
  kb.rod('metal', [0, 0, 0], [0, 1.8, 0], 0.052, 0.048, K.alu, 8); kb.rod('metal', [0, 1.8, 0], [0, 3.5, 0], 0.042, 0.038, K.steel, 8); kb.rod('metal', [0, 3.5, 0], [0, 5.1, 0], 0.033, 0.03, K.alu, 8);
  kb.rod('metal', [0, 5.1, 0], [0, 5.9, 0], 0.012, 0.008, K.steel, 5);
  for (const y of [1.8, 3.5]) kb.cyl('metal', 0.062, 0.062, 0.07, 8, [0, y, 0], null, K.dark);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.3; kb.rod('metal', [0, 0.8, 0], [Math.sin(a) * 0.7, 0.03, Math.cos(a) * 0.7], 0.018, 0.018, K.alu, 5); kb.cyl('paint', 0.06, 0.07, 0.025, 8, [Math.sin(a) * 0.7, 0.012, Math.cos(a) * 0.7], null, K.rubber); }
  for (const [deg, h0, h1, r] of [[100, 3.5, 3.5, 3.1], [220, 3.5, 3.5, 3.0], [340, 5.0, 5.0, 3.4], [100, 5.0, 5.0, 3.4], [220, 5.0, 5.0, 3.3]]) {
    const a = deg * PI / 180, top = [0, h0, 0], peg = [Math.sin(a) * r, 0.04, Math.cos(a) * r];
    kb.rod('metal', top, peg, 0.006, 0.006, K.carbon, 4); kb.cyl('metal', 0.012, 0.012, 0.3, 5, [peg[0], 0.07, peg[2]], [0.5 * Math.cos(a), 0, -0.5 * Math.sin(a)], K.steel);
  }
  // lamp-string bracket arm and a small dish (looks up at the anti-sky galaxy)
  kb.rod('metal', [0, HM - 0.05, 0], [0.55, HM + 0.05, 0.25], 0.015, 0.012, K.alu, 5); kb.rod('metal', [0, HM - 0.05, 0], [-0.55, HM + 0.05, -0.25], 0.015, 0.012, K.alu, 5);
  const [ldx, ldz] = L.ldir(sun.x, sun.z), dir = new THREE.Vector3(ldx, sun.y, ldz).normalize(), dp = [0.3, 4.4, 0.05];
  kb.rod('metal', [0, 4.34, 0], [dp[0], dp[1] - 0.04, dp[2]], 0.014, 0.012, K.steel, 5);
  kb.dish('metal', 0.28, 0.08, dp, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir), K.alu, 20, 4);
  kb.rod('metal', dp, [dp[0] + dir.x * 0.34, dp[1] + dir.y * 0.34, dp[2] + dir.z * 0.34], 0.008, 0.008, K.steel, 4);
  kb.cyl('metal', 0.035, 0.035, 0.1, 6, [0, 5.15, 0], null, K.dark); kb.cyl('paint', 0.05, 0.05, 0.04, 8, [0, 5.34, 0], null, K.dark);

  // poles
  const pole = (lx, lz, h) => {
    kb.at(lx, lz, 0);
    kb.rod('metal', [0, 0, 0], [0, h, 0], 0.03, 0.022, K.alu, 6); kb.cyl('metal', 0.04, 0.04, 0.06, 6, [0, h * 0.5, 0], null, K.dark);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.8; kb.rod('metal', [0, 0.7, 0], [Math.sin(a) * 0.5, 0.01, Math.cos(a) * 0.5], 0.013, 0.013, K.alu, 4); }
    kb.sph('paint', 0.04, [0, h + 0.02, 0], K.dark, 1, [6, 4]);
    kb.rod('metal', [0, h * 0.85, 0], [0.3, h * 0.2, -1.3], 0.005, 0.005, K.carbon, 3);
    X.cylC(lx, lz, 0.22, h);
  };
  pole(p1[0], p1[1], H1); pole(p3[0], p3[1], H3); X.cylC(mx, mz, 0.2, 5.4);

  // the string (slot-local coordinates; frame = slot origin on the ground)
  kb.at(0, 0, 0);
  const A = [p1[0], H1, p1[1]], B = [mx, HM, mz], C = [p3[0], H3, p3[1]], sag = 0.42;
  const spans = [[A, B], [B, C]], bulbs = [];
  for (const [P, Q] of spans) {
    const len = Math.hypot(Q[0] - P[0], Q[2] - P[2]), nb = Math.round(len / 0.62), pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([lerp(P[0], Q[0], t), lerp(P[1], Q[1], t) - sag * 4 * t * (1 - t), lerp(P[2], Q[2], t)]); }
    kb.tube('paint', pts, 0.006, K.carbon, 28, 3);
    for (let i = 1; i < nb; i++) {
      const t = i / nb, x = lerp(P[0], Q[0], t), y = lerp(P[1], Q[1], t) - sag * 4 * t * (1 - t) - 0.05, z = lerp(P[2], Q[2], t), k = 0.9 + 0.25 * ((i * 7) % 5) / 5;
      kb.cyl('metal', 0.014, 0.02, 0.04, 6, [x, y + 0.02, z], null, K.dark);
      kb.sph('glow', 0.055, [x, y - 0.035, z], HOT(k), 1, [8, 6]); bulbs.push([x, y, z]);
    }
  }
  const lamp = kit.pointLight(0xffa24a, 18, 15, [0, 0, 0]);
  const [lwx, lwz] = L.xz(0.7, 0.4); lamp.position.set(lwx, env.groundY(lwx, lwz) + 2.7, lwz);
  const bpos = L.pos(mx, 5.62, mz);
  const beacon = kit.beacon([bpos.x, bpos.y, bpos.z], { color: 0xb8e4ff, size: 0.11, lightI: 7, range: 20, period: 3.8, duty: 0.4, phase: 0.31 });
  return { lamp, beacon, mx, mz, HM, bulbs };
}

// ═════════════════════════════════ hand-built crystal chime (hangs from the mast arm) ═════════════════════════════════
function hangChime(X, mast) {
  const { kit, L, env } = X, ck = new Kb(9);
  ck.frame(0, 0, 0, 0);
  const R = 0.17, glassTop = -0.06;
  const ring = [], n = 14; for (let i = 0; i < n; i++) { const a = i / n * TAU; ring.push([Math.sin(a) * R, 0, Math.cos(a) * R]); }
  ck.tube('ring', ring, 0.006, K.alu, 28, 4, true);
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5; ck.rod('ring', [Math.sin(a) * R, 0, Math.cos(a) * R], [0, 0.34, 0], 0.003, 0.003, K.carbon, 3); }
  const lens = [0.3, 0.22, 0.36, 0.26, 0.4, 0.2, 0.33];
  lens.forEach((len, i) => {
    const a = i / lens.length * TAU, x = Math.sin(a) * R * 0.92, z = Math.cos(a) * R * 0.92;
    ck.rod('ring', [x, 0, z], [x, glassTop, z], 0.0025, 0.0025, 0xcfd6dc, 3);
    ck.cyl('tubes', 0.013, 0.013, len, 6, [x, glassTop - len / 2, z], null, [0.62 + (i % 3) * 0.05, 0.9, 1.0]);
  });
  ck.rod('ring', [0, 0, 0], [0, -0.42, 0], 0.002, 0.002, K.carbon, 3);
  ck.add('tubes', new THREE.ConeGeometry(0.034, 0.12, 6), [0, -0.5, 0], [PI, 0, 0], 1, [0.5, 0.95, 1.0]);                  // crystal sail
  ck.add('tubes', new THREE.CylinderGeometry(0.07, 0.07, 0.008, 12), [0, -0.4, 0], null, 1, [0.9, 0.95, 1.0]);
  const mChime = kit.std({ color: 0xffffff, roughness: 0.12, metalness: 0.0, vertexColors: true, emissive: 0x2ab5d0, emissiveIntensity: 0.55, transparent: true, opacity: 0.88 });
  const g = new THREE.Group(), sway = new THREE.Group(); g.add(sway);
  const tubes = ck.mesh('tubes', mChime, { weather: false, cast: false }), ringM = ck.mesh('ring', kit.std({ color: 0xffffff, metalness: 0.5, roughness: 0.45, vertexColors: true }), { weather: false, cast: false });
  for (const m of [tubes, ringM]) if (m) { m.matrixAutoUpdate = true; m.position.y = -0.34; sway.add(m); }
  // hangs from the mast's +X arm tip
  const arm = X.rot(mast.mx, mast.mz, 0, 0.55, 0.25); g.position.copy(L.pos(arm[0], mast.HM + 0.05 - 0.14, arm[1]));
  X.kb.at(mast.mx, mast.mz, 0); X.kb.rod('metal', [0.55, mast.HM + 0.05, 0.25], [0.55, mast.HM - 0.09, 0.25], 0.004, 0.004, K.carbon, 3);
  return { group: g, update(t) { sway.rotation.z = 0.06 * Math.sin(t * 1.15 + 0.4) + 0.025 * Math.sin(t * 2.7); sway.rotation.x = 0.05 * Math.sin(t * 0.93 + 1.2); sway.rotation.y = 0.18 * Math.sin(t * 0.37); } };
}

// ═════════════════════════════════ soft light pools on the ground ═════════════════════════════════
function glowDecals(X, sa, mast, tb) {
  const { env, L } = X, out = [], dir = (lx, lz) => L.xz(lx, lz);
  // dome door spill
  const sy = Math.sin(sa.ly), cy = Math.cos(sa.ly), [dx, dz] = dir(sa.lx + 4.1 * sy, sa.lz + 4.1 * cy);
  out.push(decalQuad(env, dx, dz, 2.9, 2.2, L.yaw + sa.ly, 0.022, [0.62, 0.30, 0.1]));
  // the lamp string pools
  const [tx, tz] = dir(tb.lx + 0.2, tb.lz + 0.2); out.push(decalQuad(env, tx, tz, 4.2, 3.4, L.yaw, 0.02, [0.36, 0.17, 0.06]));
  const [mx, mz] = dir(mast.mx, mast.mz + 0.5); out.push(decalQuad(env, mx, mz, 3.8, 3.0, L.yaw, 0.021, [0.26, 0.13, 0.045]));
  // faint cool glow around the beacon mast foot
  out.push(decalQuad(env, mx, mz, 1.1, 1.1, 0, 0.024, [0.05, 0.12, 0.2]));
  return out;
}

// ═════════════════════════════════ boot prints ═════════════════════════════════
function bootPrints(X) {
  const { env, L } = X, lander = env.slots?.lantern;
  const paths = [
    { pts: [[-4.0, -0.2], [-3.2, 0.9], [-2.0, 1.4], [-0.9, 2.1], [0.0, 2.7]], s: 1 },
    { pts: [[0.6, 0.7], [1.0, -0.6], [2.2, -2.2], [3.0, -3.1]], s: -1 },
    { pts: [[1.8, 2.1], [3.8, 2.4], [5.6, 1.9], [7.0, 1.5]], s: 1 },
    { pts: [[-2.7, 3.1], [-3.3, 3.8]], s: 1 },
    { pts: [[1.6, 3.1], [4.5, 4.1], [8.1, 4.6]], s: -1 },
    { pts: [[-0.6, 1.9], [-3.6, 1.5]], s: -1 },
  ];
  if (lander) { // the trail the crew walked to LANTERN
    const [lx, lz] = L.local(lander.x, lander.z), d = Math.hypot(lx, lz), ux = lx / d, uz = lz / d, pts = [];
    for (let r = 3.4; r <= 14.6; r += 1.7) pts.push([ux * r + -uz * Math.sin(r * 0.5) * 0.9, uz * r + ux * Math.sin(r * 0.5) * 0.9]);
    paths.push({ pts, s: 1, stride: 0.8 });
  }
  return printsGeo(env, L, paths, X.rnd);
}
