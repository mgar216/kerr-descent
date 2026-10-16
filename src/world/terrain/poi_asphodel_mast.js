// ORPHEUS · asphodel · weather mast (slot `mast`, padR 6.5): guyed triangular lattice tower with a spinning cup anemometer, a turning vane, sensor booms,
// a yagi aimed at Meadow Base, solar panel, data-logger cabinet, instrument shelter, rain gauge, windsock and a red beacon.
// Local frame: origin = slot centre on the pad, +Z toward the ship. Parented in a yawed child group (the root POI group is never offset).
import * as THREE from 'three';
import { Parts, weather, frameOf, rectBoxes, atlasRegion, makeBeacon, clamp, smooth, TAU } from './poi_asphodel_parts.js';
import { AT_MEADOW as AT, meadowAtlas } from './poi_asphodel_decals.js';
import { makeGy, blobGeo } from './poi_asphodel_ground.js';

const DEG = Math.PI / 180, PI = Math.PI;
const C = { white: 0xeef0ec, orange: 0xe8631c, steel: 0x8e969c, silver: 0xb4bbc0, galv: 0xa7b1b6, graphite: 0x2c3135, dark: 0x1b1e21, rubber: 0x141618, concrete: 0x8b897f };

export function buildMast(S, slot) {
  const { env, kit } = S;
  const y0 = env.groundY(slot.x, slot.z), F = frameOf(slot.x, y0, slot.z, slot.yaw), gy = makeGy(env, F, y0, 9, 1);
  const root = new THREE.Group(); root.name = 'asphodel.mast'; root.position.set(slot.x, y0, slot.z); root.rotation.y = slot.yaw;
  const P = new Parts(), D = new Parts(), Rt = new Parts(), V = new Parts(), K = new Parts(), colliders = [], interactables = [], updates = [];
  const at = (lx, ly, lz) => { const [x, z] = F.xz(lx, lz); return new THREE.Vector3(x, y0 + ly, z); };
  const R = {}; for (const k of Object.keys(AT)) R[k] = atlasRegion(AT, k);
  const dq = (key, w, h, pos, rot, mirror) => D.decal('decal', R[key], w, h, pos, rot, mirror);
  const box = (key, w, h, d, pos, rot, color, uv) => P.box(key, w, h, d, pos, rot, color, uv ? { uv } : undefined);
  const col = (...boxes) => { for (const b of boxes.flat()) colliders.push(b); };
  const yawPt = (x, y, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry); return [x * c + z * s, y, -x * s + z * c]; };   // rotate (x,z) by rotation.y
  const sd = env.sunDir, cyw = Math.cos(slot.yaw), syw = Math.sin(slot.yaw), sLx = sd.x * cyw - sd.z * syw, sLz = sd.x * syw + sd.z * cyw;

  // ───────────────────────── lattice tower ─────────────────────────
  const H = 15.3, NS = 17, hs = H / NS, Rm = 0.34, legA = (k) => (k * 120 + 60) * DEG;
  const leg = (k, y, rr = Rm) => [Math.sin(legA(k)) * rr, y, Math.cos(legA(k)) * rr];
  // foundation: round plinth, base plates, anchor bolts
  P.cyl('dark', 1.08, 1.16, 0.3, 30, [0, 0.0, 0], null, C.concrete); P.cyl('dark', 0.98, 1.02, 0.1, 30, [0, 0.19, 0], null, 0x96948a);
  for (let k = 0; k < 3; k++) {
    const [lx, , lz] = leg(k, 0.24); box('metal', 0.3, 0.035, 0.3, [lx, 0.255, lz], [0, legA(k), 0], C.steel, 3);
    for (const [bx, bz] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) { const p = yawPt(bx, 0, bz, legA(k)); P.cyl('metal', 0.014, 0.014, 0.07, 6, [lx + p[0], 0.29, lz + p[2]], null, C.silver); }
  }
  // legs in 2 m sections painted orange / white (aviation banding), flange collars at the joints
  for (let s = 0; s * 2 < H - 0.01; s++) {
    const ya = s ? s * 2 : 0.27, yb = Math.min(H, (s + 1) * 2), c = s % 2 ? C.white : C.orange;
    for (let k = 0; k < 3; k++) { P.between('metal', leg(k, ya), leg(k, yb), 0.036, 7, c); if (s) P.cyl('metal', 0.058, 0.058, 0.035, 8, leg(k, ya), null, C.graphite); }
  }
  // bracing: horizontal ring + alternating diagonals every segment
  for (let i = 0; i <= NS; i++) {
    const ya = Math.max(0.27, i * hs), yb = (i + 1) * hs;
    for (let k = 0; k < 3; k++) {
      const k2 = (k + 1) % 3;
      if (i > 0) P.between('metal', leg(k, ya), leg(k2, ya), 0.0135, 4, C.galv);
      if (i < NS) { if (i % 2 === 0) P.between('metal', leg(k, ya), leg(k2, yb), 0.011, 4, C.galv); else P.between('metal', leg(k2, ya), leg(k, yb), 0.011, 4, C.galv); }
    }
  }
  // top: triangular plate, centre pole, cross arm, lightning rod
  P.cyl('metal', 0.5, 0.5, 0.045, 3, [0, H + 0.02, 0], [0, 60 * DEG, 0], C.graphite);
  P.cyl('metal', 0.03, 0.038, 1.45, 8, [0, H + 0.74, 0], null, C.silver);
  const AY = H + 1.0;
  P.between('metal', [-0.85, AY, 0], [0.85, AY, 0], 0.018, 6, C.silver); P.cyl('metal', 0.06, 0.06, 0.07, 10, [0, AY, 0], null, C.graphite);
  for (const x of [-0.85, 0.85]) P.cyl('metal', 0.026, 0.026, 0.05, 8, [x, AY + 0.03, 0], null, C.graphite);
  P.cyl('metal', 0.005, 0.013, 1.2, 5, [0.22, H + 1.15, 0.12], null, C.silver); P.sph('metal', 0.013, 6, 4, [0.22, H + 1.76, 0.12], C.silver);

  // ───────────────────────── guy wires: three anchors, three levels each ─────────────────────────
  const GL = [5.4, 10.6, 15.0], AR = 5.55;
  for (let k = 0; k < 3; k++) {
    const a = legA(k), ax = Math.sin(a) * AR, az = Math.cos(a) * AR, ay = gy(ax, az), eye = [ax, ay + 0.34, az];
    P.cyl('dark', 0.34, 0.4, 0.34, 10, [ax, ay, az], null, C.concrete); box('dark', 0.1, 0.012, 0.1, [ax, ay + 0.17, az], null, 0x6f6e66);
    P.between('metal', [ax, ay + 0.12, az], eye, 0.02, 5, C.silver); P.cyl('metal', 0.05, 0.05, 0.025, 8, [ax, ay + 0.18, az], null, C.steel);
    for (const y of GL) {
      const top = leg(k, y, Rm + 0.06); box('metal', 0.07, 0.07, 0.07, leg(k, y, Rm + 0.03), [0, a, 0], C.graphite, 4);
      P.between('metal', eye, top, 0.0105, 4, 0xbfc7ca);
      if (y === GL[0]) {   // yellow safety sleeve over the first 1.7 m + turnbuckle
        const L = Math.hypot(top[0] - eye[0], top[1] - eye[1], top[2] - eye[2]), d = [(top[0] - eye[0]) / L, (top[1] - eye[1]) / L, (top[2] - eye[2]) / L], pt = (m) => [eye[0] + d[0] * m, eye[1] + d[1] * m, eye[2] + d[2] * m];
        P.between('metal', eye, pt(1.7), 0.03, 6, 0xe6b81c); P.between('metal', pt(2.0), pt(2.4), 0.016, 6, C.silver); P.cyl('metal', 0.02, 0.02, 0.03, 6, pt(2.0), null, C.steel); P.cyl('metal', 0.02, 0.02, 0.03, 6, pt(2.4), null, C.steel);
      }
    }
    col(kit.cyl(...F.xz(ax, az), 0.3, y0 - 0.3, y0 + 0.5));
  }

  // ───────────────────────── tower sensors ─────────────────────────
  const radShield = (x, y, z) => { P.cyl('metal', 0.03, 0.03, 0.18, 8, [x, y - 0.06, z], null, C.graphite); for (let i = 0; i < 8; i++) { const k = i % 2 ? 0.012 : 0.03; P.cyl('paint', 0.045 + k, 0.075 + k, 0.024, 12, [x, y + i * 0.032, z], null, 0xf3f4f0); } };
  // A (3.9 m): temperature / humidity radiation shield on a boom
  P.between('metal', leg(0, 3.9, Rm + 0.02), [0.95, 3.9, 0.55], 0.014, 6, C.silver); radShield(0.95, 3.94, 0.55); box('metal', 0.1, 0.12, 0.08, leg(0, 3.9, Rm + 0.07), [0, legA(0), 0], C.graphite, 4);
  // B (7.9 m): solar panel facing the light + charge controller
  {
    const alpha = 32 * DEG, W = 0.62, L = 0.96, psi = Math.atan2(-sLx, -sLz), cs = Math.cos(psi), sn = Math.sin(psi), ca = Math.cos(alpha), sa = Math.sin(alpha);
    const px = -Math.sin(psi) * 0.95, pz = -Math.cos(psi) * 0.95, cyp = 7.9, rot = [-alpha, psi, 0];
    const rp = (x, y, z) => { const y1 = y * ca + z * sa, z1 = -y * sa + z * ca; return [px + x * cs + z1 * sn, cyp + y1, pz - x * sn + z1 * cs]; };
    box('metal', W, 0.04, L, rp(0, 0, 0), rot, C.silver, 2);
    P.quad('solar', rp(-W / 2 + 0.025, 0.0215, L / 2 - 0.025), rp(W / 2 - 0.025, 0.0215, L / 2 - 0.025), rp(-W / 2 + 0.025, 0.0215, -L / 2 + 0.025), rp(W / 2 - 0.025, 0.0215, -L / 2 + 0.025));
    for (const z of [-0.3, 0.3]) box('metal', W + 0.06, 0.035, 0.035, rp(0, -0.04, z), rot, C.steel, 3);
    P.between('metal', [0, 7.45, 0], rp(0, -0.05, -0.28), 0.016, 6, C.steel); P.between('metal', [0, 7.0, 0], rp(0, -0.05, 0.28), 0.016, 6, C.steel);
    box('paint', 0.32, 0.24, 0.14, leg(1, 6.6, Rm + 0.1), [0, legA(1), 0], 0xd3d7d5, 1.4); P.sph('greenGlow', 0.012, 6, 4, leg(1, 6.66, Rm + 0.176));
  }
  // C (11.4 m): sonic anemometer on a boom + pyranometer
  {
    const bx = [-0.95, 11.4, -0.5];
    P.between('metal', leg(2, 11.4, Rm + 0.02), bx, 0.016, 6, C.silver); P.cyl('metal', 0.032, 0.036, 0.12, 8, [bx[0], bx[1] + 0.06, bx[2]], null, C.graphite);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3, tip = [bx[0] + Math.sin(a) * 0.22, bx[1] + 0.38, bx[2] + Math.cos(a) * 0.22]; P.between('metal', [bx[0], bx[1] + 0.12, bx[2]], tip, 0.008, 5, C.silver); P.cyl('metal', 0.024, 0.024, 0.05, 8, tip, null, C.graphite); }
    P.cyl('metal', 0.1, 0.1, 0.012, 14, [bx[0], bx[1] + 0.42, bx[2]], null, C.graphite);
    const py = [0.7, 11.1, 0.62]; P.between('metal', leg(0, 11.1, Rm + 0.02), py, 0.014, 6, C.silver); P.cyl('metal', 0.07, 0.07, 0.03, 14, [py[0], py[1] + 0.02, py[2]], null, C.dark); P.sph('glass', 0.052, 12, 6, [py[0], py[1] + 0.035, py[2]], undefined, [1, 0.7, 1]);
  }
  // D (13.6 m): yagi aimed at Meadow Base + radio unit
  {
    const o = env.slots?.outpost; let dx = -1, dz = 0;
    if (o) { const ex = o.x - slot.x, ez = o.z - slot.z; dx = ex * cyw - ez * syw; dz = ex * syw + ez * cyw; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; }
    const pxl = -dz, pzl = dx, yb = 13.6;
    P.between('metal', [dx * 0.4, yb, dz * 0.4], [dx * 1.95, yb, dz * 1.95], 0.014, 6, C.silver); P.between('metal', leg(1, yb, Rm + 0.02), [dx * 0.5, yb, dz * 0.5], 0.013, 5, C.steel);
    for (let i = 0; i < 7; i++) { const t = 0.5 + i * 0.22, hl = i === 0 ? 0.36 : 0.28 - i * 0.014, cx = dx * t, cz = dz * t; P.between('metal', [cx - pxl * hl, yb, cz - pzl * hl], [cx + pxl * hl, yb, cz + pzl * hl], 0.0065, 4, C.silver); }
    const rb = leg(2, 13.2, Rm + 0.08); box('paint', 0.22, 0.28, 0.12, [rb[0], 13.2, rb[2]], [0, legA(2), 0], 0xdde0dd, 1.4);
    const wb = leg(2, 13.2, Rm + 0.1); P.cyl('metal', 0.008, 0.008, 0.5, 5, [wb[0], 13.6, wb[2]], null, C.silver);
  }
  // conduit run up leg 0 with clips
  { const a = leg(0, 0.4, Rm + 0.06), b = leg(0, 13.2, Rm + 0.06); P.between('dark', a, b, 0.011, 5, 0x1d2023); for (let y = 1.0; y < 13; y += 1.6) { const q = leg(0, y, Rm + 0.05); P.cyl('metal', 0.02, 0.02, 0.03, 6, [q[0], y, q[2]], null, C.steel); } }

  // ───────────────────────── data-logger cabinet ─────────────────────────
  {
    const cx = -1.1, cz = 0.75, ry = 0.1, f = (x, y, z) => { const p = yawPt(x, y, z, ry); return [cx + p[0], 1.4 + p[1], cz + p[2]]; };
    for (const s of [-0.22, 0.22]) { const p = f(s, 0, 0); P.cyl('metal', 0.03, 0.035, 1.05, 8, [p[0], 0.52, p[2]], null, C.steel); }
    P.rbox('paint', 0.62, 0.82, 0.3, 0.025, { seg: 2, nx: 2, ny: 3, nz: 1, uv: 1.2, pos: [cx, 1.4, cz], rot: [0, ry, 0] }, 0xdadedb);
    box('paint', 0.54, 0.74, 0.02, f(0, 0, 0.158), [0, ry, 0], 0xcfd4d1, 1.2);   // door
    for (const y of [-0.3, 0.3]) P.cyl('metal', 0.014, 0.014, 0.12, 6, f(-0.28, y, 0.16), [0, ry, 0], C.silver);
    box('metal', 0.04, 0.12, 0.02, f(0.2, 0, 0.172), [0, ry, 0], C.graphite); P.cyl('metal', 0.016, 0.016, 0.1, 6, f(0.2, 0, 0.19), [PI / 2, ry, 0], C.silver);
    for (let i = 0; i < 5; i++) box('dark', 0.34, 0.012, 0.012, f(0.0, -0.29 - i * 0.026, 0.172), [0, ry, 0], C.rubber);
    P.sph('greenGlow', 0.013, 6, 4, f(-0.2, 0.28, 0.175)); P.sph('lampGlow', 0.009, 6, 4, f(-0.2, 0.24, 0.175));
    for (const dx of [-0.15, 0, 0.15]) { const p = f(dx, -0.41, 0.0); P.cyl('metal', 0.022, 0.022, 0.1, 8, [p[0], p[1] - 0.05, p[2]], null, C.graphite); }
    P.between('metal', f(-0.2, 0.41, -0.05), f(-0.2, 0.9, -0.05), 0.006, 4, C.silver); P.sph('metal', 0.012, 6, 4, f(-0.2, 0.9, -0.05), C.silver);   // whip
    dq('sgC', 0.44, 0.24, f(0.02, 0.24, 0.1705), [0, ry, 0]); dq('sgB', 0.26, 0.145, f(-0.13, -0.18, 0.1705), [0, ry, 0]); dq('emb', 0.1, 0.1, f(0.2, 0.28, 0.1705), [0, ry, 0]);
    P.pipe('dark', [[cx, 0.9, cz - 0.05], [cx, 0.05, cz - 0.05], [-0.2, 0.05, 0.1], [0.5, 0.05, 0.0]], 0.022, 6, 0x23282b, 1.0);
    col(rectBoxes(F, cx, cz, 0.34, 0.2, ry, y0 - 0.3, y0 + 1.85, 0.8));
  }

  // ───────────────────────── instrument shelter (Stevenson screen) ─────────────────────────
  {
    const sx = -2.5, sz = 2.2, sy = 1.05, W = 0.64, Dd = 0.52, hL = 0.46, ry = -0.12, fr = (x, y, z) => { const p = yawPt(x, y, z, ry); return [sx + p[0], sy + p[1], sz + p[2]]; };
    for (const [x, z] of [[-0.3, -0.24], [0.3, -0.24], [-0.3, 0.24], [0.3, 0.24]]) { const p = fr(x, 0, z); P.cyl('metal', 0.024, 0.03, sy + 0.03, 8, [p[0], (sy + 0.03) / 2, p[2]], null, C.silver); box('metal', 0.1, 0.014, 0.1, [p[0], 0.007, p[2]], [0, ry, 0], C.graphite, 3); }
    for (const [a, b, c, d] of [[-0.3, 0.3, -0.24, -0.24], [-0.3, 0.3, 0.24, 0.24], [-0.3, -0.3, -0.24, 0.24], [0.3, 0.3, -0.24, 0.24]]) { const p = fr(a, 0, c), q = fr(b, 0, d); P.between('metal', [p[0], 0.5, p[2]], [q[0], 0.5, q[2]], 0.009, 4, C.steel); }
    box('paint', W, 0.035, Dd, fr(0, 0.0, 0), [0, ry, 0], 0xe9ebe7, 1.6); box('paint', 0.62, hL, 0.02, fr(0, hL / 2 + 0.02, -0.245), [0, ry, 0], 0xe6e8e4, 1.6);
    for (const [x, z, a, w] of [[0, 0.265, 0, W - 0.04], [-0.31, 0, -PI / 2, Dd - 0.04], [0.31, 0, PI / 2, Dd - 0.04]]) for (let i = 0; i < 9; i++) box('paint', w, 0.012, 0.075, fr(x, 0.07 + i * 0.049, z), [0.62, ry + a, 0], 0xf4f5f1, 3);
    for (const [x, z] of [[-0.31, -0.255], [0.31, -0.255], [-0.31, 0.265], [0.31, 0.265]]) box('paint', 0.035, hL + 0.05, 0.035, fr(x, hL / 2 + 0.02, z), [0, ry, 0], 0xeaece8, 3);
    box('paint', W + 0.1, 0.03, Dd + 0.14, fr(0, hL + 0.07, 0.02), [-0.07, ry, 0], 0xf0f1ed, 1.6); box('paint', W + 0.04, 0.025, Dd + 0.08, fr(0, hL + 0.125, 0.0), [-0.07, ry, 0], 0xe9ebe7, 1.6);
    for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) P.cyl('metal', 0.012, 0.012, 0.045, 6, fr(x, hL + 0.095, z), null, C.steel);
    P.cyl('metal', 0.012, 0.012, 0.1, 6, fr(0.2, 0.28, 0.3), [PI / 2, ry, 0], C.silver); dq('emb', 0.1, 0.1, fr(-0.18, 0.46, 0.2755), [0, ry, 0]);
    col(rectBoxes(F, sx, sz, 0.38, 0.32, ry, y0 - 0.3, y0 + 1.75, 0.8));
  }
  // rain gauge (tipping bucket) on a pedestal
  {
    const gx = 2.3, gz = 2.0;
    box('dark', 0.55, 0.06, 0.55, [gx, 0.03, gz], [0, 0.2, 0], 0x8e8c82, 2); P.cyl('metal', 0.055, 0.07, 0.62, 10, [gx, 0.37, gz], null, C.silver);
    P.cyl('paint', 0.135, 0.135, 0.38, 20, [gx, 0.88, gz], null, 0xeaece8); P.cyl('metal', 0.14, 0.14, 0.03, 20, [gx, 0.7, gz], null, C.graphite); P.cyl('metal', 0.145, 0.145, 0.025, 20, [gx, 1.07, gz], null, C.steel);
    P.cyl('metal', 0.03, 0.145, 0.12, 20, [gx, 1.145, gz], null, C.silver, true); P.cyl('metal', 0.03, 0.03, 0.04, 10, [gx, 1.22, gz], null, C.graphite);
    P.between('dark', [gx, 0.75, gz + 0.14], [gx + 0.5, 0.04, gz + 0.5], 0.01, 4, 0x23282b);
    col(kit.cyl(...F.xz(gx, gz), 0.22, y0 - 0.3, y0 + 1.25));
  }

  // ───────────────────────── windsock pole + sock ─────────────────────────
  const WPx = 3.2, WPz = -1.0, WPy = 3.25;
  P.cyl('metal', 0.026, 0.045, WPy, 8, [WPx, WPy / 2, WPz], null, C.white); P.cyl('metal', 0.1, 0.12, 0.05, 12, [WPx, 0.025, WPz], null, C.graphite); P.cyl('metal', 0.05, 0.05, 0.06, 10, [WPx, WPy + 0.03, WPz], null, C.graphite);
  P.between('metal', [WPx + 0.4, 0.05, WPz + 0.4], [WPx + 0.02, 1.4, WPz + 0.02], 0.009, 4, C.steel); P.between('metal', [WPx - 0.4, 0.05, WPz + 0.38], [WPx - 0.02, 1.4, WPz + 0.02], 0.009, 4, C.steel);
  col(kit.cyl(...F.xz(WPx, WPz), 0.1, y0 - 0.3, y0 + WPy));
  {   // five open frustum bands along +X (mouth at x = 0.13), double-sided cloth; frame ring + spokes
    const Lb = 0.24, r0 = 0.2, r1 = 0.075;
    for (let i = 0; i < 5; i++) { const ra = r0 + (r1 - r0) * i / 5, rb = r0 + (r1 - r0) * (i + 1) / 5; K.cyl('sock', rb, ra, Lb, 14, [0.13 + (i + 0.5) * Lb, 0, 0], [0, 0, -PI / 2], i % 2 ? 0xf2f3ef : 0xea5f1a, true); }
    K.add('metal', new THREE.TorusGeometry(r0 + 0.004, 0.008, 5, 18).rotateY(PI / 2).translate(0.13, 0, 0), C.silver); K.between('metal', [0, 0, 0], [0.13, 0, 0], 0.014, 5, C.steel);
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4; K.between('metal', [0.02, 0, 0], [0.13, Math.sin(a) * r0, Math.cos(a) * r0], 0.003, 3, C.silver); }
  }

  // ───────────────────────── animated heads: cup anemometer + wind vane ─────────────────────────
  {
    Rt.cyl('metal', 0.014, 0.014, 0.22, 8, [0, 0.11, 0], null, C.silver); Rt.cyl('metal', 0.05, 0.05, 0.05, 10, [0, 0.18, 0], null, C.graphite);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), tn = new THREE.Vector3(), pp = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3, sa = Math.sin(a), ca = Math.cos(a), arm = 0.24;
      Rt.between('metal', [0, 0.18, 0], [sa * arm, 0.18, ca * arm], 0.0075, 4, C.silver);
      tn.set(-ca, 0, sa);   // cup pole points back along −tangent; the open face looks along +tangent
      q.setFromUnitVectors(up, tn); pp.set(sa * (arm + 0.05) + ca * 0.03, 0.18, ca * (arm + 0.05) - sa * 0.03); m.compose(pp, q, one);
      Rt.add('metal', new THREE.SphereGeometry(0.06, 12, 8, 0, TAU, 0, PI / 2).applyMatrix4(m), i === 0 ? 0xe8631c : 0xf0f1ed);
    }
    V.between('metal', [-0.28, 0, 0], [0.34, 0, 0], 0.012, 6, C.silver); V.cyl('metal', 0.03, 0.03, 0.07, 10, [0, -0.04, 0], null, C.graphite);
    V.cyl('metal', 0.0035, 0.014, 0.14, 8, [-0.31, 0, 0], [0, 0, PI / 2], C.orange); V.sph('metal', 0.03, 8, 6, [-0.37, 0, 0], 0x2c3135);
    V.box('vane', 0.28, 0.2, 0.012, [0.5, 0.02, 0], null, C.orange, { uv: 1 }); V.box('vane', 0.1, 0.2, 0.012, [0.34, 0.02, 0], null, 0xf0f1ed);
  }
  const metalDS = S.once('m.metalDS', () => kit.std({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.5 }));
  const rotorMesh = Rt.mesh('metal', metalDS, {}), vaneMesh = V.mesh('metal', S.mat.metal, {}), vaneFin = V.mesh('vane', S.mat.paint, {});
  const rotorG = new THREE.Group(), vaneG = new THREE.Group();
  rotorG.position.set(-0.85, AY + 0.06, 0); rotorG.add(rotorMesh); vaneG.position.set(0.85, AY + 0.1, 0); vaneG.add(vaneMesh, vaneFin); root.add(rotorG, vaneG);
  const sockMesh = K.mesh('sock', S.mat.cloth, {}), sockHw = K.mesh('metal', S.mat.metal, {}), sockG = new THREE.Group(), sockPivot = new THREE.Group();
  sockG.position.set(WPx, WPy + 0.12, WPz); sockPivot.add(sockMesh, sockHw); sockG.add(sockPivot); root.add(sockG);
  let vaneA = S.wind.ang - slot.yaw, rotA = 0;
  const wrap = (a) => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
  updates.push((dt, t) => {
    const v = clamp(S.wind.v, 0, 1.4), target = S.wind.ang - slot.yaw + S.wind.jit;
    rotA += dt * (1.2 + 9.5 * v); rotorG.rotation.y = rotA % TAU;
    vaneA += wrap(target - vaneA) * (1 - Math.exp(-dt * 1.6)); vaneG.rotation.y = vaneA + Math.sin(t * 1.7) * 0.05 * (0.4 + v);
    sockG.rotation.y = vaneA * 0.97 + Math.sin(t * 0.9) * 0.06; sockPivot.rotation.z = -(1.25 - 1.05 * clamp(v / 0.8, 0, 1)) + Math.sin(t * 5.1 + 1.3) * 0.03 * (0.4 + v);
  });

  // ───────────────────────── ground: gravel apron ─────────────────────────
  const gravel = new THREE.Mesh(blobGeo({ gy, cx: 0, cz: 0.3, rx: 3.4, rz: 3.0, rot: 0.2, rings: 7, segs: 32, wob: 0.14, seed: 4, lift: 0.014, uvS: 3,
    col: (x, z) => { const k = 0.82 + 0.3 * Math.sin(x * 9.1 + z * 4.3) * Math.cos(z * 7.7 - x * 3.1); return [0.27 * k, 0.262 * k, 0.24 * k]; }, alpha: (u) => (1 - smooth(0.62, 1.0, u)) * 0.95 }), S.mat.patch);
  gravel.renderOrder = 1; gravel.receiveShadow = true; root.add(gravel);

  // ───────────────────────── assemble ─────────────────────────
  const atlas = meadowAtlas(S), decalMat = S.once('m.decalMeadow', () => kit.std({ map: atlas, transparent: true, depthWrite: false, roughness: 0.85, metalness: 0 }));
  const towerMesh = P.mesh('metal', S.mat.metal, { post: (g) => weather(g, { strength: 0.3, height: 0.7 }), name: 'tower' }); root.add(towerMesh);
  for (const [k, mat, post, noShadow] of [
    ['paint', S.mat.paint, (g) => weather(g, { strength: 0.35, height: 0.8 })], ['dark', S.mat.dark, (g) => weather(g, { strength: 0.3, height: 0.4 })], ['solar', S.mat.solar, null],
    ['glass', S.mat.glass, null, true], ['greenGlow', S.mat.greenGlow, null, true], ['lampGlow', S.mat.lampGlow, null, true],
  ]) { const m = P.mesh(k, mat, { post, cast: !noShadow, receive: !noShadow }); if (m) root.add(m); }
  const dm = D.mesh('decal', decalMat, { cast: false, receive: true }); if (dm) { dm.renderOrder = 2; root.add(dm); }

  // ───────────────────────── beacon + interactable ─────────────────────────
  const bcn = makeBeacon(S, [0, H + 1.6, 0], { color: 0xff3a24, lightI: 6, range: 20, period: 2.2, duty: 0.1, size: 0.085, phase: 0.55 }); root.add(bcn.group);
  updates.push((dt, t) => bcn.update(t));
  interactables.push(kit.interactable({ id: 'poi.world.asphodel.poi.mast', lineId: 'world.asphodel.poi.mast', label: 'Inspect weather mast', pos: at(-0.8, 1.35, 1.7), radius: 3.2, object: towerMesh }));
  col(kit.cyl(...F.xz(0, 0), 0.62, y0 - 0.3, y0 + 16));

  return { group: root, interactables, colliders, update: (dt, t, cam) => { for (const u of updates) u(dt, t, cam); } };
}
