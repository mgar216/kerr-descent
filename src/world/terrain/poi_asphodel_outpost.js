// ORPHEUS · asphodel · Meadow Base — Halcyon survey outpost (slot `outpost`, padR 17).
// Local frame: origin = slot centre on the pad, +Z toward the ship (door side), +X to the viewer's right when facing the door. Parented in a yawed child group.
import * as THREE from 'three';
import { Parts, latheG, xf, weather, frameOf, rectBoxes, atlasRegion, makeFlag, makeBeacon, clamp, lerp, smooth, noise2, TAU } from './poi_asphodel_parts.js';
import { AT_MEADOW as AT, meadowAtlas, padTexture } from './poi_asphodel_decals.js';

const DEG = Math.PI / 180, PI = Math.PI;
const C = {
  white: 0xf0f1ed, teal: 0x1d8da1, orange: 0xe8631c, amber: 0xe8a51a, steel: 0x8e969c, silver: 0xb4bbc0,
  graphite: 0x2c3135, dark: 0x1b1e21, rubber: 0x141618, locker: 0x2d5a66, tankW: 0xcfdbe1, tankF: 0xd9672a, pipeB: 0x2e86a8,
  contA: 0x3b7c85, contB: 0xbf6c2d, contC: 0xaaa790, contD: 0x4e626b,
};

export function buildOutpost(S, slot) {
  const { env, kit } = S;
  const y0 = env.groundY(slot.x, slot.z), F = frameOf(slot.x, y0, slot.z, slot.yaw);
  const gy = (lx, lz) => { const [wx, wz] = F.xz(lx, lz); return env.groundY(wx, wz) - y0; };
  const root = new THREE.Group(); root.name = 'asphodel.outpost'; root.position.set(slot.x, y0, slot.z); root.rotation.y = slot.yaw;
  const P = new Parts(), D = new Parts(), colliders = [], interactables = [], updates = [];
  const at = (lx, ly, lz) => { const [x, z] = F.xz(lx, lz); return new THREE.Vector3(x, y0 + ly, z); };
  const R = {}; for (const k of Object.keys(AT)) R[k] = atlasRegion(AT, k);
  const dq = (key, w, h, pos, rot, mirror) => D.decal('decal', R[key], w, h, pos, rot, mirror);
  const box = (key, w, h, d, pos, rot, col) => P.box(key, w, h, d, pos, rot, col);
  const bev = (key, w, h, d, pos, rot, col, r = 0.02) => P.bev(key, w, h, d, pos, rot, r, col);
  const col = (...boxes) => { for (const b of boxes.flat()) colliders.push(b); };
  const solid = (lx, lz, hx, hz, ly, h, step) => col(rectBoxes(F, lx, lz, hx, hz, ly, y0 - 0.3, y0 + h, step));

  // sun direction in the local frame (rack tilt)
  const sd = env.sunDir, cyw = Math.cos(slot.yaw), syw = Math.sin(slot.yaw), sLx = sd.x * cyw - sd.z * syw, sLz = sd.x * syw + sd.z * cyw;

  // ───────────────────────── habitat: two rounded modules + collar ─────────────────────────
  const HB = { r: 0.7, yb: -0.75, yt: 3.6, d: 4.0, zc: -1.0, L: 4.85, gap: 0.15 }, HH = HB.yt - HB.yb, YC = (HB.yt + HB.yb) / 2, ROOF = HB.yt;
  for (const s of [-1, 1]) {
    const xc = s * (HB.gap + HB.L / 2), pc = [xc, 0, HB.zc];
    P.rbox('hab', HB.L, HH, HB.d, HB.r, { seg: 4, nx: 6, ny: 6, nz: 3, ou: s * 0.31, ov: 0.17, pos: [xc, YC, HB.zc] }, C.white);
    P.ring('paint', HB.L, HB.d, HB.r, 0.6, 0.94, 0.014, pc, C.teal); P.ring('paint', HB.L, HB.d, HB.r, 1.0, 1.045, 0.016, pc, C.orange);
    P.ring('metal', HB.L, HB.d, HB.r, -0.3, 0.38, 0.03, pc, C.graphite);
  }
  P.rbox('dark', 1.1, HH - 0.3, HB.d - 0.3, 0.45, { seg: 3, nx: 2, ny: 4, nz: 2, pos: [0, YC, HB.zc] }, 0x2b3034);   // connector collar
  for (const z of [0.88, -2.88]) bev('metal', 0.5, 3.2, 0.06, [0, 1.3, z], null, C.steel);

  // vestibule (airlock) centred on the collar — front face z = 3.0
  const VZ = 3.0, VD = 2.2, VZC = VZ - VD / 2, vc = [0, 0, VZC];
  P.rbox('hab', 2.5, 3.8, VD, 0.35, { seg: 3, nx: 3, ny: 5, nz: 2, ou: 0.12, ov: 0.4, pos: [0, 1.15, VZC] }, C.white);
  P.ring('paint', 2.5, VD, 0.35, 0.6, 0.94, 0.014, vc, C.teal); P.ring('paint', 2.5, VD, 0.35, 1.0, 1.045, 0.016, vc, C.orange); P.ring('metal', 2.5, VD, 0.35, -0.3, 0.38, 0.03, vc, C.graphite);

  // door: dark frame, pale leaf with inset panels, glowing porthole, hazard sill, keypad, handle
  P.frame('metal', 1.32, 2.22, 0.1, 0.06, [0, 1.06, VZ], null, C.graphite);
  bev('paint', 1.1, 2.06, 0.05, [0, 1.0, VZ + 0.012], null, 0xdadddb, 0.015);
  bev('paint', 0.86, 0.72, 0.016, [0, 0.52, VZ + 0.045], null, 0xc3c8c8, 0.01); bev('paint', 0.86, 0.5, 0.016, [0, 1.62, VZ + 0.045], null, 0xc3c8c8, 0.01);
  box('paint', 1.1, 0.07, 0.056, [0, 1.12, VZ + 0.014], null, C.orange);
  P.add('metal', xf(new THREE.TorusGeometry(0.19, 0.03, 6, 22), [0, 1.62, VZ + 0.05]), C.graphite);
  D.add('winGlow', xf(new THREE.CircleGeometry(0.165, 20), [0, 1.62, VZ + 0.052]));
  P.cyl('metal', 0.012, 0.012, 0.3, 6, [0.4, 1.0, VZ + 0.08], null, C.silver); P.cyl('metal', 0.012, 0.012, 0.08, 6, [0.4, 1.14, VZ + 0.045], [PI / 2, 0, 0], C.silver); P.cyl('metal', 0.012, 0.012, 0.08, 6, [0.4, 0.86, VZ + 0.045], [PI / 2, 0, 0], C.silver);
  box('metal', 0.15, 0.24, 0.04, [0.9, 1.15, VZ + 0.02], null, C.dark);
  P.sph('greenGlow', 0.014, 8, 6, [0.9, 1.24, VZ + 0.046]); P.sph('lampGlow', 0.01, 6, 4, [0.9, 1.15, VZ + 0.045]);
  dq('haz', 1.05, 0.13, [0, 0.12, VZ + 0.043]); dq('sgA', 0.36, 0.2, [-0.95, 1.25, VZ + 0.003]);
  for (const x of [-0.98, 0.98]) {   // wall lamps beside the door
    bev('metal', 0.14, 0.26, 0.1, [x, 2.0, VZ + 0.05], null, C.dark); P.cyl('lampGlow', 0.045, 0.045, 0.02, 10, [x, 2.0, VZ + 0.108], [PI / 2, 0, 0]);
  }
  dq('name', 2.0, 0.328, [0, 2.5, VZ + 0.006]);
  bev('dark', 1.5, 0.035, 0.9, [0, 0.016, VZ + 0.55], null, C.rubber, 0.012);   // threshold mat

  // windows: dark frame + sill + mullion, glow pane (decal bucket), glass
  const windowAt = (x, y, z, ry, w = 1.0, h = 0.72, mirror = false) => {
    const rot = [0, ry, 0], o = (dx, dy, dz) => { const c = Math.cos(ry), s = Math.sin(ry); return [x + dx * c + dz * s, y + dy, z - dx * s + dz * c]; };
    P.frame('metal', w + 0.16, h + 0.16, 0.08, 0.05, [x, y, z], rot, C.graphite);
    D.decal('winGlow', [0, 0, 1, 1], w, h, o(0, 0, 0.014), rot, mirror); P.decal('glass', [0, 0, 1, 1], w, h, o(0, 0, 0.04), rot);
    box('metal', w + 0.3, 0.035, 0.12, o(0, -h / 2 - 0.1, 0.05), rot, C.steel); box('metal', 0.05, h, 0.03, o(mirror ? -0.15 : 0.15, 0, 0.033), rot, C.graphite);
  };
  windowAt(-2.35, 1.62, 1.0, 0, 1.0, 0.72, false); windowAt(2.15, 1.62, 1.0, 0, 1.0, 0.72, true); windowAt(3.65, 1.62, 1.0, 0, 1.0, 0.72, false);
  windowAt(-5.0, 1.62, -0.55, -PI / 2, 0.9, 0.72, true); windowAt(-1.25, 1.5, 1.95, -PI / 2, 0.8, 0.7, false); windowAt(1.25, 1.5, 1.95, PI / 2, 0.8, 0.7, true);

  // livery decals on the hab wall
  dq('word', 2.45, 0.4, [2.75, 2.43, 1.004]); dq('emb', 0.62, 0.62, [-2.35, 2.45, 1.004]);
  dq('emb', 0.55, 0.55, [-5.004, 2.45, -0.55], [0, -PI / 2, 0]); dq('word', 2.0, 0.33, [-5.004, 0.5, -1.8], [0, -PI / 2, 0]);

  // back wall: emergency door, vents, service light (seen when walking around)
  P.frame('metal', 1.0, 2.1, 0.09, 0.06, [-2.4, 1.0, -3.0], [0, PI, 0], C.graphite); bev('paint', 0.82, 1.96, 0.05, [-2.4, 0.98, -3.012], [0, PI, 0], 0xd6d9d6, 0.012);
  box('paint', 0.82, 0.07, 0.056, [-2.4, 1.1, -3.014], [0, PI, 0], C.orange); P.cyl('metal', 0.012, 0.012, 0.28, 6, [-2.12, 1.0, -3.075], null, C.silver);
  bev('metal', 0.14, 0.2, 0.1, [-2.4, 2.35, -3.05], [0, PI, 0], C.dark); P.cyl('lampGlow', 0.04, 0.04, 0.02, 10, [-2.4, 2.35, -3.105], [PI / 2, 0, 0]);
  bev('dark', 1.6, 0.04, 0.9, [-2.4, 0.016, -3.5], null, C.rubber, 0.012);
  for (const x of [1.4, 2.2]) { bev('paint', 0.62, 0.62, 0.08, [x, 1.9, -3.04], null, 0xcfd3d1, 0.02); for (let i = 0; i < 6; i++) box('dark', 0.5, 0.018, 0.02, [x, 1.68 + i * 0.09, -3.085], null, C.rubber); }
  dq('sgB', 0.34, 0.19, [-1.2, 1.7, -3.004], [0, PI, 0]); dq('word', 2.0, 0.33, [2.6, 0.8, -3.004], [0, PI, 0]);
  for (const g of [[3.6, -3.05], [4.2, -3.05]]) { P.cyl('metal', 0.03, 0.03, 1.2, 6, [g[0], 1.5, g[1]], null, C.steel); }

  // ───────────────────────── roof: solar racks on module A, dish + HVAC + antenna on module B ─────────────────────────
  {
    const alpha = 26 * DEG, W = 1.05, L = 1.22, gp = 0.035, face = sLz < 0 ? 0 : PI, off = clamp(Math.atan2(sLx, Math.abs(sLz) + 0.001), -0.4, 0.4) * (sLz < 0 ? 1 : -1), psi = face + off * 0.6;
    const cs = Math.cos(psi), sn = Math.sin(psi), ca = Math.cos(alpha), sa = Math.sin(alpha);
    for (const czr of [-0.45, -1.75]) {
      const cxr = -2.55, cyr = ROOF + 0.28 + (L / 2) * sa + 0.03, rot = [-alpha, psi, 0];
      const rp = (x, y, z) => { const y1 = y * ca + z * sa, z1 = -y * sa + z * ca; return [cxr + x * cs + z1 * sn, cyr + y1, czr - x * sn + z1 * cs]; };
      for (let i = -1; i <= 1; i++) {
        const px = i * (W + gp), hw = W / 2, hl = L / 2;
        box('metal', W, 0.045, L, rp(px, 0, 0), rot, C.silver);
        P.quad('solar', rp(px - hw + 0.03, 0.0235, hl - 0.03), rp(px + hw - 0.03, 0.0235, hl - 0.03), rp(px - hw + 0.03, 0.0235, -hl + 0.03), rp(px + hw - 0.03, 0.0235, -hl + 0.03));
        box('dark', 0.16, 0.05, 0.08, rp(px, -0.045, -hl * 0.4), rot, C.rubber);
      }
      for (const z of [-0.36, 0.36]) box('metal', 3 * W + 2 * gp + 0.1, 0.05, 0.05, rp(0, -0.055, z), rot, C.steel);
      for (const lx of [-1.6, 0, 1.6]) {
        const tf = rp(lx, -0.06, 0.36), tb = rp(lx, -0.06, -0.36);
        P.between('metal', [tf[0], ROOF, tf[2]], tf, 0.02, 5, C.steel); P.between('metal', [tb[0], ROOF, tb[2]], tb, 0.02, 5, C.steel); P.between('metal', [tf[0], ROOF + 0.03, tf[2]], [tb[0], ROOF + 0.03, tb[2]], 0.012, 4, C.steel);
      }
    }
    // module B: HVAC unit, vents, controller, dish on a yoke, antenna mast
    bev('paint', 1.15, 0.46, 0.72, [3.4, ROOF + 0.23, HB.zc - 0.7], [0, 0.1, 0], 0xcdd1cf, 0.03);
    for (let i = 0; i < 6; i++) box('dark', 0.7, 0.014, 0.01, [3.4, ROOF + 0.12 + i * 0.05, HB.zc - 0.7 + 0.37], [0, 0.1, 0], C.rubber);
    P.cyl('metal', 0.2, 0.2, 0.04, 14, [3.1, ROOF + 0.48, HB.zc - 0.8], null, C.dark); P.cyl('metal', 0.018, 0.018, 0.2, 5, [3.1, ROOF + 0.4, HB.zc - 0.8], null, C.silver);
    for (const [x, z, h] of [[1.9, -2.0, 0.7], [1.5, -1.7, 0.45]]) { P.cyl('metal', 0.07, 0.07, h, 10, [x, ROOF + h / 2, z], null, C.silver); P.cyl('metal', 0.13, 0.02, 0.07, 10, [x, ROOF + h + 0.03, z], null, C.graphite); }
    bev('dark', 0.5, 0.36, 0.3, [1.35, ROOF + 0.18, HB.zc - 0.55], null, C.graphite); P.sph('greenGlow', 0.012, 6, 4, [1.47, ROOF + 0.24, HB.zc - 0.55 + 0.153]);
    const dishAz = 0.5, dx = 2.7, dz = -0.2, dyc = ROOF + 0.95;
    P.cyl('metal', 0.09, 0.12, 0.8, 8, [dx, ROOF + 0.4, dz], null, C.steel); bev('metal', 0.34, 0.1, 0.22, [dx, dyc - 0.12, dz], [0, dishAz, 0], C.graphite, 0.03);
    const Rd = 0.82, fd = 0.58, prof = [];
    for (let i = 0; i <= 8; i++) { const r = Rd * i / 8; prof.push([r, r * r / (4 * fd)]); }
    prof.push([Rd + 0.012, Rd * Rd / (4 * fd) + 0.012]);
    for (let i = 8; i >= 0; i--) { const r = Rd * i / 8 * 0.985; prof.push([r, r * r / (4 * fd) - 0.028]); }
    const el = 52 * DEG, rotD = [PI / 2 - el, dishAz, 0], dyd = dyc + 0.12, eul = new THREE.Euler(rotD[0], rotD[1], 0, 'YXZ');
    P.add('paint', latheG(prof, 28, [dx, dyd, dz], rotD), 0xe9ebe8);
    const ax = new THREE.Vector3(0, 1, 0).applyEuler(eul), focus = [dx + ax.x * fd, dyd + ax.y * fd, dz + ax.z * fd];
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.5, rim = new THREE.Vector3(Math.cos(a) * Rd * 0.8, Rd * Rd * 0.64 / (4 * fd), Math.sin(a) * Rd * 0.8).applyEuler(eul); P.between('metal', [dx + rim.x, dyd + rim.y, dz + rim.z], focus, 0.012, 4, C.silver); }
    P.cyl('dark', 0.035, 0.07, 0.12, 8, focus, rotD, C.graphite); P.between('metal', [dx, dyd - 0.05, dz], [dx - ax.x * 0.2, dyd - ax.y * 0.2 - 0.05, dz - ax.z * 0.2], 0.04, 6, C.steel);
    const bx = 4.05, bz = -2.05;   // whip antenna + beacon mast
    P.cyl('metal', 0.03, 0.04, 2.5, 6, [bx, ROOF + 1.25, bz], null, C.silver); P.between('metal', [bx - 0.5, ROOF + 1.9, bz], [bx + 0.5, ROOF + 1.9, bz], 0.012, 4, C.silver);
    P.between('metal', [bx, ROOF + 1.5, bz - 0.4], [bx, ROOF + 1.5, bz + 0.4], 0.012, 4, C.silver); P.cyl('metal', 0.1, 0.1, 0.06, 12, [bx, ROOF + 0.03, bz], null, C.graphite);
    // roof ladder on the left end wall
    for (const z of [-2.15, -1.8]) box('metal', 0.045, 3.3, 0.045, [-5.06, 1.55, z], null, C.steel);
    for (let i = 0; i < 11; i++) P.cyl('metal', 0.014, 0.014, 0.4, 5, [-5.06, 0.25 + i * 0.28, -1.975], [PI / 2, 0, 0], C.silver);
    for (const y of [0.4, 1.8, 3.0]) for (const z of [-2.15, -1.8]) box('metal', 0.14, 0.04, 0.04, [-5.03, y, z], null, C.steel);
  }

  // ───────────────────────── wall furniture: lockers, services, conduits ─────────────────────────
  const lockerM = (x, z, k) => {
    bev('paint', 0.56, 1.85, 0.5, [x, 0.93, z], null, C.locker, 0.025); bev('paint', 0.5, 1.7, 0.02, [x, 0.95, z + 0.255], null, k % 2 ? 0x346673 : 0x2a5360, 0.01);
    for (let i = 0; i < 4; i++) box('dark', 0.34, 0.012, 0.012, [x, 1.62 + i * 0.045, z + 0.268], null, C.rubber);
    P.cyl('metal', 0.01, 0.01, 0.12, 5, [x + 0.19, 1.0, z + 0.275], null, C.silver); bev('metal', 0.56, 0.06, 0.52, [x, 0.03, z], null, C.graphite, 0.01);
    dq('lk', 0.24, 0.14, [x, 1.4, z + 0.268]);
  };
  lockerM(-3.95, 1.26, 0); lockerM(-3.38, 1.26, 1);
  dq('sgB', 0.34, 0.19, [-4.3, 2.05, 1.004]);
  const RX = 5.0;   // service riser box + conduits on the right end wall
  bev('paint', 0.2, 0.5, 0.4, [RX + 0.1, 1.25, -1.2], null, 0xc7cbca, 0.02); dq('sgB', 0.36, 0.2, [RX + 0.205, 1.25, -1.2], [0, PI / 2, 0]);
  for (const [dz, c] of [[-0.12, 0x2b3034], [0.0, 0x6b7a82], [0.12, 0x2b3034]]) { P.cyl('dark', 0.028, 0.028, 2.4, 6, [RX + 0.1, 2.35, -1.2 + dz], null, c); P.cyl('dark', 0.028, 0.028, 0.9, 6, [RX + 0.1, 0.45, -1.2 + dz], null, c); }
  for (const [y, z] of [[0.9, -1.45], [1.55, -0.95], [2.2, -1.45], [2.75, -0.95]]) box('metal', 0.05, 0.05, 0.5, [RX + 0.07, y, z], null, C.steel);
  P.pipe('dark', [[RX + 0.1, 0.05, -1.35], [RX + 0.8, 0.05, -1.35], [6.0, 0.05, -0.3]], 0.04, 5, 0x23282b, 1.2); bev('paint', 0.9, 0.06, 0.3, [RX + 0.8, 0.03, -1.35], null, C.amber, 0.02);
  P.cyl('paint', 0.07, 0.07, 0.36, 10, [-2.9, 0.75, 1.07], null, 0xc0261c); P.cyl('metal', 0.03, 0.03, 0.08, 6, [-2.9, 0.99, 1.07], null, C.dark); box('metal', 0.18, 0.04, 0.04, [-2.9, 0.82, 1.045], null, C.dark);   // extinguisher
  P.pipe('paint', [[-4.2, 0.5, 1.07], [-1.5, 0.5, 1.07]], 0.032, 6, C.pipeB);   // under-window service pipe
  for (const x of [-4.1, -3.2, -2.3, -1.6]) box('metal', 0.07, 0.05, 0.06, [x, 0.5, 1.06], null, C.graphite);

  // ───────────────────────── tanks ─────────────────────────
  const wrapDecal = (key, rad, wArc, hgt, pos, thetaC) => {   // decal wrapped around a vertical cylinder (angle from +Z toward +X)
    const g = new THREE.CylinderGeometry(rad + 0.004, rad + 0.004, hgt, 18, 1, true, thetaC - wArc / (2 * rad), wArc / rad), uv = g.attributes.uv, [u0, v0, u1, v1] = R[key];
    for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
    return xf(g, pos);
  };
  const tankV = (x, z) => {   // vertical potable-water tank
    const r = 0.85, h = 1.9, dome = 0.3, prof = [[0, 0], [r - 0.04, 0], [r, 0.04], [r, h - dome], [r * 0.95, h - dome * 0.45], [r * 0.7, h - 0.07], [r * 0.3, h - 0.01], [0, h]];
    P.add('metal', latheG(prof, 26, [x, 0.12, z]), C.tankW); P.cyl('metal', r + 0.05, r + 0.08, 0.14, 26, [x, 0.07, z], null, C.graphite);
    for (const y of [0.55, 1.2]) P.cyl('metal', r + 0.012, r + 0.012, 0.035, 26, [x, y, z], null, 0xaeb8bd);
    P.cyl('metal', 0.22, 0.24, 0.14, 12, [x, 2.05, z], null, C.graphite); P.cyl('metal', 0.06, 0.06, 0.05, 8, [x + 0.12, 2.15, z], null, C.silver);
    const la = 0.75, lx = x + Math.sin(la) * (r + 0.04), lz = z + Math.cos(la) * (r + 0.04);   // ladder on the barrel
    for (let i = 0; i < 6; i++) P.cyl('metal', 0.012, 0.012, 0.32, 5, [lx, 0.35 + i * 0.28, lz], [0, la, PI / 2], C.silver);
    for (const s of [-0.14, 0.14]) box('metal', 0.03, 1.7, 0.03, [lx + Math.cos(la) * s, 1.05, lz - Math.sin(la) * s], [0, la, 0], C.steel);
    P.cyl('metal', 0.02, 0.02, 1.5, 6, [x - 0.4, 1.0, z + r + 0.02], null, 0xdfe6ea); P.cyl('metal', 0.05, 0.05, 0.05, 8, [x - 0.4, 0.28, z + r + 0.02], null, C.silver);
    D.add('decal', wrapDecal('tw', r, 0.95, 0.24, [x, 1.05, z], -0.45));
    col(kit.cyl(...F.xz(x, z), r + 0.05, y0 - 0.3, y0 + 2.4));
  };
  const tankH = (x, z) => {   // horizontal fuel tank on saddles (long axis along local X)
    const r = 0.62, L = 2.5, e = 0.3, yc = r + 0.32, prof = [[0, -L / 2 - e], [r * 0.55, -L / 2 - e * 0.85], [r * 0.9, -L / 2 - e * 0.35], [r, -L / 2], [r, L / 2], [r * 0.9, L / 2 + e * 0.35], [r * 0.55, L / 2 + e * 0.85], [0, L / 2 + e]];
    P.add('metal', latheG(prof, 24, [x, yc, z], [0, 0, PI / 2]), C.tankF);
    for (const sx of [-0.8, 0.8]) { bev('metal', 0.18, 0.4, r * 1.7, [x + sx, 0.2, z], null, C.graphite, 0.02); P.cyl('metal', r + 0.014, r + 0.014, 0.05, 24, [x + sx, yc, z], [0, 0, PI / 2], C.steel); }
    P.cyl('metal', 0.12, 0.14, 0.12, 12, [x + 0.35, 2 * r + 0.36, z], null, C.graphite); P.cyl('metal', 0.05, 0.05, 0.06, 8, [x + 0.35, 2 * r + 0.45, z], null, C.silver);
    P.cyl('metal', 0.03, 0.03, 0.5, 6, [x - 0.2, 0.5, z + r + 0.1], null, C.silver); P.cyl('metal', 0.07, 0.07, 0.03, 10, [x - 0.2, 0.78, z + r + 0.1], null, C.tankW);
    const onBarrel = (phi, k = 0.004) => [x - 0.1, yc + (r + k) * Math.sin(phi), z + (r + k) * Math.cos(phi)];
    dq('tf', 1.0, 0.26, onBarrel(0.32), [-0.32, 0, 0]); dq('haz', 1.0, 0.12, onBarrel(-0.55), [0.55, 0, 0]);
    solid(x, z, L / 2 + e * 0.6, r, 0, 2 * r + 0.4);
  };
  tankV(-7.15, -0.6); tankH(-7.4, -3.7);
  P.pipe('paint', [[-6.45, 0.4, -0.35], [-5.9, 0.4, -0.35], [-5.9, 0.4, -0.95], [-5.12, 0.4, -0.95]], 0.04, 6, C.pipeB);
  P.pipe('dark', [[-6.4, 0.25, -3.3], [-5.7, 0.25, -3.3], [-5.7, 0.25, -2.6], [-5.12, 0.6, -2.6]], 0.035, 6, C.tankF); bev('metal', 0.18, 0.2, 0.18, [-5.21, 0.4, -0.95], null, C.graphite);

  // ───────────────────────── stacked supply containers ─────────────────────────
  const container = (cx, cy0, cz, ry, colr, code, tag = 0) => {
    const cyc = cy0 + 0.6, rot = [0, ry, 0], cr = Math.cos(ry), sr = Math.sin(ry), tp = (x, y, z) => [cx + x * cr + z * sr, cyc + y, cz - x * sr + z * cr];
    P.rbox('corrug', 2.4, 1.2, 1.25, 0.03, { seg: 1, nx: 6, ny: 3, nz: 3, uv: 0.62, pos: [cx, cyc, cz], rot }, colr);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const sy of [-1, 1]) box('metal', 0.14, 0.14, 0.14, tp(sx * 1.15, sy * 0.53, sz * 0.555), rot, C.graphite);
    for (const sz of [-1, 1]) for (const sy of [-1, 1]) box('metal', 2.4, 0.07, 0.07, tp(0, sy * 0.585, sz * 0.59), rot, C.graphite);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('metal', 0.07, 1.2, 0.07, tp(sx * 1.19, 0, sz * 0.59), rot, C.graphite);
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) box('metal', 0.07, 0.07, 1.25, tp(sx * 1.19, sy * 0.585, 0), rot, C.graphite);
    box('dark', 0.01, 1.04, 0.012, tp(1.21, 0, 0), rot, C.rubber);   // door seam
    for (const z of [-0.45, -0.18, 0.18, 0.45]) { P.cyl('metal', 0.012, 0.012, 1.04, 5, tp(1.235, 0, z), rot, C.silver); box('metal', 0.03, 0.12, 0.05, tp(1.235, z > 0 ? 0.1 : -0.1, z), rot, C.steel); }
    box('metal', 0.05, 0.05, 0.1, tp(1.24, -0.2, 0), rot, C.amber);
    for (const [sg, rz] of [[1, 0], [-1, PI]]) {
      D.decal('decal', R[code], 1.35, 0.245, tp(-0.1 * sg, 0.12, sg * 0.629), [0, ry + rz, 0]);
      if (tag) D.decal('decal', R.haz, 0.7, 0.08, tp(-0.75 * sg, -0.42, sg * 0.629), [0, ry + rz, 0]);
    }
  };
  container(7.35, 0.0, -1.9, -PI / 2 + 0.03, C.contA, 'cA', 1); container(9.1, 0.0, -1.7, -PI / 2 - 0.02, C.contB, 'cB'); container(7.3, 1.21, -1.95, -PI / 2 + 0.07, C.contC, 'cC');
  solid(7.35, -1.9, 0.65, 1.25, 0, 2.45); solid(9.1, -1.7, 0.65, 1.25, 0, 1.3);
  // crates + drums beside the stack
  bev('corrug', 0.9, 0.55, 0.6, [9.1, 0.28, 0.6], [0, 0.35, 0], C.contD); bev('corrug', 0.6, 0.45, 0.6, [9.65, 0.23, 1.25], [0, -0.25, 0], C.contC); bev('paint', 0.9, 0.04, 0.6, [9.1, 0.57, 0.6], [0, 0.35, 0], 0xd8d0b2, 0.012);
  for (const [x, z] of [[10.3, -0.1], [10.45, 0.55]]) { P.cyl('metal', 0.27, 0.27, 0.8, 14, [x, 0.4, z], null, C.contD); P.cyl('metal', 0.285, 0.285, 0.03, 14, [x, 0.2, z], null, C.steel); P.cyl('metal', 0.285, 0.285, 0.03, 14, [x, 0.6, z], null, C.steel); P.cyl('metal', 0.27, 0.27, 0.02, 14, [x, 0.81, z], null, C.graphite); col(kit.cyl(...F.xz(x, z), 0.3, y0 - 0.3, y0 + 0.9)); }
  solid(9.1, 0.6, 0.45, 0.3, 0.35, 0.6);

  // ───────────────────────── table, bench, instruments ─────────────────────────
  const TX = 2.1, TZ = 1.9, TY = 0.78;
  bev('metal', 1.05, 0.04, 0.6, [TX, TY, TZ], null, 0xaeb5ba, 0.015);
  for (const sx of [-0.42, 0.42]) { P.between('metal', [TX + sx, 0, TZ - 0.24], [TX + sx, TY - 0.02, TZ + 0.24], 0.017, 5, C.steel); P.between('metal', [TX + sx, 0, TZ + 0.24], [TX + sx, TY - 0.02, TZ - 0.24], 0.017, 5, C.steel); P.between('metal', [TX + sx, 0.38, TZ - 0.12], [TX + sx, 0.38, TZ + 0.12], 0.012, 4, C.steel); }
  bev('metal', 1.55, 0.05, 0.32, [3.6, 0.46, 1.62], null, 0x9b8b6a, 0.015);
  for (const sx of [-0.62, 0.62]) { P.between('metal', [3.6 + sx, 0, 1.62 - 0.13], [3.6 + sx, 0.45, 1.62 - 0.04], 0.018, 5, C.steel); P.between('metal', [3.6 + sx, 0, 1.62 + 0.13], [3.6 + sx, 0.45, 1.62 + 0.04], 0.018, 5, C.steel); }
  bev('dark', 0.28, 0.012, 0.2, [TX - 0.32, TY + 0.03, TZ + 0.1], [0, 0.4, 0], C.graphite, 0.006);   // tablet, thermos, mug, notebook, vials
  D.quad('screenGlow', ...[[-0.125, 0, 0.085], [0.125, 0, 0.085], [-0.125, 0, -0.085], [0.125, 0, -0.085]].map(([x, y, z]) => { const c = Math.cos(0.4), s = Math.sin(0.4); return [TX - 0.32 + x * c + z * s, TY + 0.037, TZ + 0.1 - x * s + z * c]; }));
  P.cyl('metal', 0.04, 0.04, 0.24, 10, [TX + 0.38, TY + 0.14, TZ - 0.1], null, C.teal); P.cyl('metal', 0.042, 0.042, 0.03, 10, [TX + 0.38, TY + 0.27, TZ - 0.1], null, C.graphite);
  P.cyl('paint', 0.04, 0.035, 0.09, 10, [TX + 0.22, TY + 0.065, TZ + 0.18], null, 0xe8e2d0); bev('paint', 0.2, 0.025, 0.28, [TX - 0.05, TY + 0.03, TZ - 0.12], [0, -0.3, 0], 0x7b5b3a, 0.008);
  for (let i = 0; i < 4; i++) P.cyl('metal', 0.012, 0.012, 0.09, 6, [TX + i * 0.035, TY + 0.065, TZ + 0.2], null, 0xcfe3e8);
  solid(TX, TZ, 0.52, 0.3, 0, 0.85); solid(3.6, 1.62, 0.78, 0.17, 0, 0.5);

  // ───────────────────────── flag pole, sign, theodolite ─────────────────────────
  const FX = -7.2, FZ = 7.6, FH = 6.0;
  P.cyl('metal', 0.032, 0.05, FH, 8, [FX, FH / 2, FZ], null, C.silver); P.cyl('metal', 0.2, 0.22, 0.05, 14, [FX, 0.025, FZ], null, C.graphite); P.sph('metal', 0.065, 10, 8, [FX, FH + 0.06, FZ], 0xd8b44a);
  P.between('metal', [FX + 0.045, FH - 0.2, FZ], [FX + 0.045, 1.9, FZ], 0.004, 3, C.dark); P.cyl('metal', 0.025, 0.025, 0.1, 6, [FX + 0.06, 1.9, FZ], null, C.steel);
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3; P.cyl('metal', 0.018, 0.018, 0.04, 5, [FX + Math.cos(a) * 0.14, 0.07, FZ + Math.sin(a) * 0.14], null, C.dark); }
  col(kit.cyl(...F.xz(FX, FZ), 0.12, y0 - 0.2, y0 + FH));
  const flag = makeFlag(S, { w: 1.55, h: 0.98 }), flagG = new THREE.Group(); flagG.position.set(FX + 0.06, FH - 0.28, FZ); flagG.add(flag.mesh); root.add(flagG);
  updates.push((dt, t) => { flagG.rotation.y = S.wind.ang - slot.yaw + S.wind.jit * 0.6; flag.update(t); });
  P.cyl('metal', 0.04, 0.04, 1.5, 6, [-3.4, 0.75, 9.6], null, C.graphite); P.cyl('metal', 0.04, 0.04, 1.5, 6, [-1.7, 0.75, 9.6], null, C.graphite);   // name sign
  bev('paint', 2.0, 0.42, 0.05, [-2.55, 1.2, 9.6], null, 0x0e3844, 0.015); dq('name', 1.9, 0.312, [-2.55, 1.2, 9.628]);
  col(kit.cyl(...F.xz(-3.4, 9.6), 0.08, y0 - 0.2, y0 + 1.5), kit.cyl(...F.xz(-1.7, 9.6), 0.08, y0 - 0.2, y0 + 1.5));
  const TH = [3.0, 5.3];   // survey theodolite
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.3; P.between('metal', [TH[0], 1.38, TH[1]], [TH[0] + Math.cos(a) * 0.5, 0, TH[1] + Math.sin(a) * 0.5], 0.016, 5, 0xb69a64); }
  P.cyl('metal', 0.09, 0.09, 0.06, 10, [TH[0], 1.4, TH[1]], null, C.graphite); bev('paint', 0.16, 0.26, 0.14, [TH[0], 1.58, TH[1]], null, C.orange, 0.03);
  P.cyl('metal', 0.032, 0.032, 0.24, 8, [TH[0], 1.78, TH[1] + 0.04], [PI / 2, 0, 0], C.graphite); P.cyl('metal', 0.04, 0.04, 0.04, 8, [TH[0], 1.78, TH[1] + 0.18], [PI / 2, 0, 0], C.dark);
  col(kit.cyl(...F.xz(TH[0], TH[1]), 0.3, y0 - 0.2, y0 + 1.9));

  // ───────────────────────── assemble meshes ─────────────────────────
  const habMesh = P.mesh('hab', S.mat.paint, { post: (g) => weather(g, { strength: 0.42, height: 0.9, vary: 0.1, topDark: 0.06 }), name: 'hab' });
  const mk = (key, mat, o) => { const m = P.mesh(key, mat, o); if (m) root.add(m); return m; };
  root.add(habMesh);
  mk('paint', S.mat.paint, { post: (g) => weather(g, { strength: 0.4, height: 0.8 }) }); mk('corrug', S.mat.corrug, { post: (g) => weather(g, { strength: 0.5, height: 0.7, dust: [0.7, 0.67, 0.62] }) });
  mk('metal', S.mat.metal, { post: (g) => weather(g, { strength: 0.35, height: 0.6 }) }); mk('dark', S.mat.dark, { post: (g) => weather(g, { strength: 0.3, height: 0.5 }) });
  mk('solar', S.mat.solar, {}); mk('glass', S.mat.glass, { cast: false, receive: false }); mk('greenGlow', S.mat.greenGlow, { cast: false, receive: false }); mk('lampGlow', S.mat.lampGlow, { cast: false, receive: false });
  for (const [k, m] of [['winGlow', S.mat.winGlow], ['screenGlow', S.once('m.tabletScreen', () => kit.glow(0x6fd8e4, 1.6))]]) { const mm = D.mesh(k, m, { cast: false, receive: false }); if (mm) root.add(mm); }

  // ───────────────────────── ground decals: pad disc, worn path, boot prints ─────────────────────────
  const polar = (cx, cz, Rr, rings, segs, lift, uvFn) => {
    const pos = [], uv = [], idx = []; pos.push(cx, gy(cx, cz) + lift, cz); uv.push(...uvFn(cx, cz));
    for (let r = 1; r <= rings; r++) for (let s = 0; s < segs; s++) { const a = s * TAU / segs, x = cx + Math.cos(a) * Rr * r / rings, z = cz + Math.sin(a) * Rr * r / rings; pos.push(x, gy(x, z) + lift, z); uv.push(...uvFn(x, z)); }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + (s + 1) % segs, 1 + s);
    for (let r = 1; r < rings; r++) for (let s = 0; s < segs; s++) { const a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + (s + 1) % segs, c = a + segs, d = b + segs; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const PX = 8.8, PZ = 7.9, PR = 4.8;
  const padMesh = new THREE.Mesh(polar(PX, PZ, PR, 6, 40, 0.025, (x, z) => [0.5 + (x - PX) / (2 * PR), 0.5 - (z - PZ) / (2 * PR)]), S.once('m.pad', () => kit.std({ map: padTexture(S, 'VEHICLE PAD 02'), transparent: true, depthWrite: false, roughness: 0.9, metalness: 0 })));
  padMesh.receiveShadow = true; padMesh.renderOrder = 1; root.add(padMesh);
  const ribbons = new Parts({ rgba: true });
  const ribbon = (pts, w0, w1, seed) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5), n = Math.ceil(curve.getLength() / 0.5), cols = 7, pos = [], cl = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = curve.getPoint(u), tg = curve.getTangent(u), nx = -tg.z, nz = tg.x, hw = lerp(w0, w1, u) * (0.85 + 0.3 * noise2(u * 9, seed, 4)) * 0.5;
      for (let c = 0; c < cols; c++) {
        const t = c / (cols - 1) * 2 - 1, x = p.x + nx * t * hw, z = p.z + nz * t * hw, a0 = 1 - Math.abs(t) ** 1.6, nn = noise2(x * 2.3 + seed, z * 2.3, seed), a = clamp(a0 * (0.5 + 0.9 * nn) * (1 - smooth(0.72, 1.0, u)) * 0.9, 0, 0.85);
        pos.push(x, gy(x, z) + 0.018, z); const k = 0.9 + 0.2 * noise2(x * 5, z * 5, 9); cl.push(0.2 * k, 0.185 * k, 0.15 * k, a);
      }
      if (i) for (let c = 0; c < cols - 1; c++) { const a = (i - 1) * cols + c, b = a + 1, cc = a + cols, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 4)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  ribbons.add('path', ribbon([[0.1, 3.5], [-0.3, 5.5], [0.3, 8.0], [-0.2, 11], [-1.0, 14], [-1.4, 16.3]], 1.6, 1.1, 3));
  ribbons.add('path', ribbon([[1.0, 4.0], [2.6, 5.4], [4.0, 6.7], [5.0, 7.7]], 1.0, 0.8, 11)); ribbons.add('path', ribbon([[-1.2, 3.6], [-4.0, 5.2], [-6.2, 7.0]], 0.9, 0.8, 17));
  const pathMesh = ribbons.mesh('path', S.once('m.path', () => kit.std({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, metalness: 0 })), { cast: false });
  pathMesh.renderOrder = 1; root.add(pathMesh);
  {   // boot prints along the main path (alternating feet)
    const curve = new THREE.CatmullRomCurve3([[0.1, 3.5], [-0.3, 5.5], [0.3, 8.0], [-0.2, 11], [-1.0, 14]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5), n = 22;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, p = curve.getPoint(u), tg = curve.getTangent(u), side = i % 2 ? 1 : -1, j = noise2(i * 3.1, 7.7, 2) - 0.5;
      const x = p.x - tg.z * side * (0.17 + j * 0.08), z = p.z + tg.x * side * (0.17 + j * 0.08) + j * 0.25, ang = Math.atan2(tg.x, tg.z) + j * 0.35;
      D.decal('decal', R.boot, 0.1, 0.22, [x, gy(x, z) + 0.03, z], [-PI / 2, ang + PI, 0], side > 0, [0.55, 0.55, 0.55]);
    }
  }
  const atlas = meadowAtlas(S), decalMat = S.once('m.decalMeadow', () => kit.std({ map: atlas, transparent: true, depthWrite: false, roughness: 0.85, metalness: 0 }));
  const decalMesh = D.mesh('decal', decalMat, { cast: false, receive: true }); if (decalMesh) { decalMesh.renderOrder = 2; root.add(decalMesh); }

  // ───────────────────────── recorder, lights, beacon, interactables ─────────────────────────
  const rec = kit.recorder({ title: 'SURVEY A', sub: 'OKAFOR · LOG 1', accent: '#ff9b3a' });
  rec.traverse((o) => { if (o.isMesh && o.geometry.parameters?.height === 0.62) o.visible = false; });
  rec.position.set(TX + 0.04, TY + 0.02 + 0.115, TZ - 0.02); rec.rotation.y = -0.3; kit.shadows(rec, true, false); root.add(rec);
  root.add(kit.pointLight(0xffc990, 11, 13, [0, 1.9, VZ + 0.9]));
  const bcn = makeBeacon(S, [4.05, ROOF + 2.56, -2.05], { color: 0xff9a30, lightI: 7, range: 18, period: 3.4, duty: 0.1, size: 0.07, phase: 0.31 }); root.add(bcn.group);
  updates.push((dt, t) => { bcn.update(t); rec.userData.ledUpdate(t); });
  interactables.push(
    kit.interactable({ id: 'poi.world.asphodel.poi.outpost', lineId: 'world.asphodel.poi.outpost', label: 'Inspect survey outpost', pos: at(0, 1.3, VZ + 1.15), radius: 3.3, object: habMesh }),
    kit.interactable({ id: 'log.asphodel.1', lineId: 'log.asphodel.1', log: true, label: 'Play field recorder', pos: at(TX + 0.04, TY + 0.22, TZ + 0.55), radius: 2.4, object: rec }),
  );
  solid(0, HB.zc, 5.0, 2.0, 0, 3.7, 0.9); solid(0, VZC, 1.25, 1.1, 0, 3.1, 0.9); solid(-3.66, 1.26, 0.58, 0.26, 0, 1.9, 0.9);

  return { group: root, interactables, colliders, update: (dt, t, cam) => { for (const u of updates) u(dt, t, cam); } };
}
