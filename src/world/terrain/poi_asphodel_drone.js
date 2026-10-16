// ORPHEUS · asphodel · Grey Shore · crashed survey drone UAV-07 (slot `drone`, padR 9) + field recorder (log.asphodel.2, SURVEY_B · Lind).
// A ~3 m quad survey drone that dug its nose into the black sand while flying a shoreline transect: plough furrow, sand mound, snapped arm + rotor lying
// nearby, bent skid, torn-off cracked sensor pod, scorched battery bay, debris, recovery marker with a blinking beacon, cones and the recorder.
// Local frame: origin = slot centre on the pad, +Z toward the ship. Parented in a yawed child group (the root POI group is never offset).
import * as THREE from 'three';
import { Parts, rockG, tubeG, weather, frameOf, rectBoxes, atlasRegion, makeBeacon, lerp, smooth, noise2, TAU } from './poi_asphodel_parts.js';
import { AT_SHORE as AT, shoreAtlas } from './poi_asphodel_decals.js';
import { makeGy, blobGeo, stripGeo, tintGeo, pose } from './poi_asphodel_ground.js';

const DEG = Math.PI / 180, PI = Math.PI;
const C = { white: 0xeceeea, teal: 0x1d8da1, orange: 0xe8631c, steel: 0x8e969c, silver: 0xb4bbc0, graphite: 0x2c3135, rubber: 0x141618, carbon: 0xcfd2d6 };
const SAND = [0.052, 0.052, 0.058], FS = 1.3;   // FS: fuselage scale (arms keep their own size → ~3.3 m rotor-to-rotor)

/** one drone arm in its own frame: origin at the root, +Z along the arm. o: { len, end: 'motor'|'broken', blades: 'ok'|'snapped'|'bent', phi, seed } */
function armPiece(o) {
  const A = new Parts(), len = o.len, r = (i) => noise2(i * 3.7, o.seed * 1.3, 8);
  A.box('hull', 0.072, 0.062, len, [0, 0, len / 2], null, 0xe3e6e2, { uv: 3 }); A.box('hull', 0.076, 0.066, 0.05, [0, 0, len - 0.12], null, C.teal, { uv: 3 });
  A.rbox('hull', 0.1, 0.09, 0.19, 0.018, { seg: 1, pos: [0, 0, 0.11], uv: 4 }, 0xe9ece8); A.box('hull', 0.104, 0.094, 0.022, [0, 0, 0.215], null, C.orange);
  if (len > 0.5) { A.box('dark', 0.064, 0.04, 0.14, [0, 0.045, len * 0.5], null, C.graphite); A.between('dark', [0.04, 0.014, 0.25], [0.04, 0.014, len - 0.06], 0.007, 4, C.rubber); }
  if (o.end === 'broken') {   // shear end: dark hollow + fibre splinters + torn wires
    A.box('dark', 0.04, 0.034, 0.03, [0, 0, len - 0.005], null, 0x0c0d0e);
    for (let i = 0; i < 8; i++) {
      const a = r(i) * TAU, l = 0.08 + r(i + 9) * 0.15, ox = Math.cos(a) * 0.022, oy = Math.sin(a) * 0.02, sp = (r(i + 3) - 0.5) * 0.55;
      A.box('carbon', 0.008 + r(i + 5) * 0.014, 0.004 + r(i + 7) * 0.01, l, [ox + sp * l * 0.4, oy + (r(i + 11) - 0.5) * 0.04, len + l * 0.45], [(r(i + 13) - 0.5) * 0.6, sp, 0], i % 3 ? C.carbon : 0xc9cbc7, { uv: 9 });
    }
    for (let i = 0; i < 3; i++) A.between('dark', [(i - 1) * 0.012, 0.01, len - 0.02], [(i - 1) * 0.03 + (r(i) - 0.5) * 0.07, -0.03 - r(i + 4) * 0.08, len + 0.12 + r(i + 2) * 0.1], 0.006, 4, i === 1 ? 0xb3261e : C.rubber);
    return A;
  }
  // motor, hub, blades
  A.cyl('dark', 0.07, 0.074, 0.11, 16, [0, 0.08, len], null, C.graphite); A.cyl('hull', 0.075, 0.075, 0.016, 16, [0, 0.036, len], null, C.orange);
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; A.box('metal', 0.007, 0.08, 0.014, [Math.sin(a) * 0.072, 0.08, len + Math.cos(a) * 0.072], [0, a, 0], C.steel, { uv: 4 }); }
  A.cyl('metal', 0.036, 0.04, 0.034, 12, [0, 0.155, len], null, C.silver); A.cyl('metal', 0.014, 0.014, 0.034, 8, [0, 0.186, len], null, C.graphite);
  const by = 0.175, blade = (phi, mode) => {
    const L = mode === 'snapped' ? 0.2 : 0.46, c = Math.cos(phi), s = -Math.sin(phi), tilt = mode === 'bent' ? 0.32 : 0;
    A.box('carbon', 0.24 * (L > 0.3 ? 1 : 0.9), 0.008, 0.08, [c * 0.13, by, len + s * 0.13], [0.2, phi, 0], C.carbon, { uv: 9 });
    if (L > 0.3) A.box('carbon', 0.23, 0.007, 0.058, [c * 0.345, by + 0.06 * Math.sin(tilt), len + s * 0.345], [0.2, phi, tilt], C.carbon, { uv: 9 });
    else for (let i = 0; i < 3; i++) A.box('carbon', 0.045, 0.005, 0.014 + i * 0.006, [c * (0.255 + i * 0.012), by, len + s * (0.255 + i * 0.012)], [0.2, phi + (i - 1) * 0.3, 0], i % 2 ? 0xc9cbc7 : C.carbon, { uv: 9 });
  };
  blade(o.phi, o.blades === 'bent' ? 'bent' : 'ok'); blade(o.phi + PI, o.blades === 'snapped' ? 'snapped' : 'ok');
  return A;
}

/** graft a Parts (local frame) into `target`, transformed by scale / euler rot / pos (hull colours go through `tint` first when given) */
function graft(target, src, pos, rot, sc = 1, tint) {
  for (const k of Object.keys(src.b)) { const g = src.merged(k); if (g) { if (tint && k === 'hull') tint(g); target.add(k, pose(g, pos, rot, sc)); } }
}

export function buildDrone(S, slot) {
  const { env, kit } = S;
  const y0 = env.groundY(slot.x, slot.z), F = frameOf(slot.x, y0, slot.z, slot.yaw), gy = makeGy(env, F, y0, 14, 1);
  const root = new THREE.Group(); root.name = 'asphodel.drone'; root.position.set(slot.x, y0, slot.z); root.rotation.y = slot.yaw;
  const W = new Parts(), Wd = new Parts(), G = new Parts({ rgba: true }), Rk = new Parts(), Cl = new Parts(), colliders = [], interactables = [], updates = [];
  const at = (lx, ly, lz) => { const [x, z] = F.xz(lx, lz); return new THREE.Vector3(x, y0 + ly, z); };
  const R = {}; for (const k of Object.keys(AT)) R[k] = atlasRegion(AT, k);
  const col = (...boxes) => { for (const b of boxes.flat()) colliders.push(b); };

  // ───────────────────────── heading: the drone flew along the shoreline (sea normal from the site, local frame) ─────────────────────────
  const cb = (env.site?.terrain?.coast?.bearing ?? 285) * DEG; let nx = Math.sin(cb), nz = -Math.cos(cb); if (env.features?.coast?.n) [nx, nz] = env.features.coast.n;
  const cyw = Math.cos(slot.yaw), syw = Math.sin(slot.yaw), nLx = nx * cyw - nz * syw, nLz = nx * syw + nz * cyw;
  let hx = -nLz, hz = nLx; if (hx < 0) { hx = -hx; hz = -hz; }   // unit heading (local XZ), pointing to +X
  const hl = Math.hypot(hx, hz); hx /= hl; hz /= hl;
  const ryD = Math.atan2(hx, hz), rtx = -hz, rtz = hx;          // drone yaw; (rtx, rtz) = its right-hand side, which faces the approach
  const PITCH = 27 * DEG, ROLL = -0.2, CX = 0.4, CZ = -0.55, CY = 0.26, posD = [CX, CY, CZ], rotD = [PITCH, ryD, ROLL];
  const _e = new THREE.Euler(PITCH, ryD, ROLL, 'YXZ'), _v = new THREE.Vector3();
  const wp = (x, y, z, out = [0, 0, 0]) => { _v.set(x, y, z).applyEuler(_e); out[0] = _v.x + CX; out[1] = _v.y + CY; out[2] = _v.z + CZ; return out; };   // drone-local → slot-local
  const rel = (a, b, up = 0) => [CX + rtx * a + hx * b, up, CZ + rtz * a + hz * b];                                                                    // slot-local point from (right, forward) offsets

  // ───────────────────────── fuselage group (scaled FS): body, nose, tail, skids, pod mount ─────────────────────────
  const Fz = new Parts(), Fd = new Parts(), dq = (key, w, h, pos, rot) => Fd.decal('decal', R[key], w, h, pos, rot);
  const BW = 0.5, BH = 0.3, BD = 1.2, BR = 0.08;
  Fz.rbox('hull', BW, BH, BD, BR, { seg: 3, nx: 2, ny: 2, nz: 6, uv: 1.4, pos: [0, 0, 0] }, C.white);
  Fz.ring('hull', BW, BD, BR, -0.065, -0.005, 0.004, [0, 0, 0], C.teal); Fz.ring('hull', BW, BD, BR, 0.01, 0.045, 0.004, [0, 0, 0], C.orange);
  Fz.sph('hull', 0.22, 16, 12, [0, 0.005, 0.6], C.orange, [1.0, 0.8, 1.3]);                       // nose radome
  Fz.rbox('hull', 0.2, 0.2, 0.22, 0.05, { seg: 2, pos: [0, 0.07, -0.47], uv: 2 }, 0xdfe2de);     // rear hump (battery bay cover)
  Fz.rbox('hull', 0.34, 0.025, 0.55, 0.01, { seg: 1, pos: [0, 0.155, 0.02], uv: 2 }, 0xd5d9d6);    // hatch
  for (let i = 0; i < 6; i++) Fz.box('dark', 0.16, 0.01, 0.012, [0, 0.168, -0.4 + i * 0.026], null, C.rubber);   // vent slats
  for (const z of [-0.2, 0.24]) for (const sx of [-1, 1]) Fz.box('metal', 0.05, 0.014, 0.03, [sx * 0.17, 0.168, z], null, C.graphite);
  Fz.cyl('dark', 0.062, 0.066, 0.034, 16, [0, 0.185, -0.1], null, C.graphite); Fz.cyl('hull', 0.05, 0.05, 0.008, 16, [0, 0.205, -0.1], null, 0xe4e7e3);   // GPS puck
  Fz.between('metal', [0.08, 0.17, -0.55], [0.1, 0.55, -0.62], 0.005, 4, C.silver); Fz.between('metal', [0.1, 0.55, -0.62], [0.2, 0.84, -0.6], 0.0045, 4, C.silver);   // bent whip
  Fz.between('carbon', [0, 0.02, -0.58], [0, 0.04, -1.5], 0.032, 8, C.carbon); Fz.cyl('hull', 0.04, 0.04, 0.05, 8, [0, 0.025, -0.62], [PI / 2, 0, 0], C.orange);   // tail boom
  Fz.box('hull', 0.62, 0.012, 0.2, [0, 0.04, -1.38], null, C.white, { uv: 2 }); Fz.box('hull', 0.012, 0.22, 0.22, [0, 0.15, -1.43], [-0.15, 0, 0], C.teal, { uv: 2 }); Fz.box('hull', 0.1, 0.012, 0.2, [0.37, 0.12, -1.36], [0, 0, 0.6], C.white, { uv: 2 });
  for (const sx of [-1, 1]) {   // skids: the side facing the approach (−X) is bent and broken
    const x = sx * 0.2;
    Fz.between('metal', [x * 0.9, -0.14, 0.34], [x * 1.25, -0.42, 0.42], 0.016, 6, C.graphite);
    if (sx > 0) { Fz.between('metal', [x * 0.9, -0.14, -0.28], [x * 1.25, -0.42, -0.34], 0.016, 6, C.graphite); Fz.between('metal', [x * 1.25, -0.42, 0.62], [x * 1.25, -0.42, -0.5], 0.015, 6, C.graphite); }
    else { Fz.between('metal', [x * 1.25, -0.42, 0.62], [x * 1.25, -0.42, -0.04], 0.015, 6, C.graphite); Fz.between('metal', [x * 1.25, -0.42, -0.04], [x * 1.9, -0.2, -0.36], 0.015, 6, C.graphite); Fz.between('metal', [x * 0.9, -0.14, -0.28], [x * 1.05, -0.3, -0.31], 0.016, 6, C.graphite); }
  }
  // empty pod mount on the belly: plate + torn cable stubs (the pod itself lies on the sand)
  Fz.box('dark', 0.13, 0.05, 0.15, [0, -0.165, 0.42], null, C.graphite); Fz.cyl('metal', 0.07, 0.07, 0.02, 16, [0, -0.2, 0.5], null, C.silver);
  for (let i = 0; i < 4; i++) Fz.between('dark', [(i - 1.5) * 0.02, -0.21, 0.5], [(i - 1.5) * 0.05, -0.32 - (i % 2) * 0.05, 0.54 + (i % 3) * 0.03], 0.006, 4, i === 2 ? 0xb3261e : C.rubber);
  Fz.between('metal', [0, 0.0, 0.88], [0, -0.01, 1.03], 0.007, 5, C.silver); Fz.between('metal', [0, -0.01, 1.03], [0.03, -0.07, 1.1], 0.006, 5, C.silver);   // snapped pitot
  dq('uav', 0.38, 0.092, [-BW / 2 - 0.0035, 0.035, 0.04], [0, -PI / 2, 0]); dq('uav', 0.38, 0.092, [BW / 2 + 0.0035, 0.035, 0.04], [0, PI / 2, 0]); dq('emb', 0.15, 0.15, [0.0, 0.1685, 0.02], [-PI / 2, 0, 0]);
  Fd.decal('decal', R.haz, 0.34, 0.048, [0, 0.172, 0.34], [-PI / 2, 0, 0]);
  // damage: teal belly, scuffs, soot around the battery bay, scraped nose
  const hullTint = (g) => tintGeo(g, (x, y, z, nxx, ny) => {
    if (y < -0.1 && ny < -0.5 && z < 0.46) return [0.02, 0.33, 0.43];
    let k = 1; const n = noise2(x * 12 + 3, z * 12 + y * 9, 5); if (n > 0.72 && (ny < 0.4 || z > 0.4)) k *= 0.5 + (0.9 - n) * 2;
    const sd = Math.hypot(x - 0.1, y + 0.1, z + 0.45), s2 = Math.hypot(x + 0.25, y - 0.02, z + 0.22); k *= 1 - 0.78 * Math.exp(-sd * sd / 0.07); k *= 1 - 0.62 * Math.exp(-s2 * s2 / 0.045);
    return k * (1 - Math.min(0.5, Math.max(0, z - 0.62) * 2.2));
  });

  // ───────────────────────── the wreck frame: fuselage + four arms (viewer side = −X) ─────────────────────────
  const B = new Parts(), Bd = new Parts();
  graft(B, Fz, [0, 0, 0], [0, 0, 0], FS, hullTint); { const g = Fd.merged('decal'); if (g) Bd.add('decal', pose(g, [0, 0, 0], [0, 0, 0], FS)); }
  const arm = (sx, sz, o) => graft(B, armPiece({ seed: sx * 3 + sz + 5, phi: 0.5 + sx * 0.7 + sz * 0.3, ...o }), [sx * 0.2, 0.04, sz * 0.2], [-(o.droop ?? 0.07), Math.atan2(sx, sz), 0]);
  arm(-1, 1, { len: 0.46, end: 'broken' }); arm(1, 1, { len: 1.02, blades: 'snapped', droop: -0.5 }); arm(-1, -1, { len: 1.02, blades: 'bent', droop: 0.08 }); arm(1, -1, { len: 1.02, droop: 0.1 });
  graft(W, B, posD, rotD, 1); { const g = Bd.merged('decal'); if (g) Wd.add('decal', pose(g, posD, rotD)); }

  // ───────────────────────── loose parts ─────────────────────────
  // severed front-right arm (still carrying its motor + a snapped rotor) lying on its side, wires back to the stub
  const stubEnd = wp(-0.2 - 0.46 * 0.7071, 0.0, 0.2 + 0.46 * 0.7071), P0 = rel(2.25, -0.2, 0.1), aY = ryD - 1.15;
  graft(W, armPiece({ len: 0.7, end: 'motor', blades: 'snapped', phi: 1.2, seed: 7 }), P0, [0.12, aY, 0.55]);
  for (let i = 0; i < 2; i++) W.add('dark', tubeG([P0, [lerp(P0[0], stubEnd[0], 0.4), 0.03, lerp(P0[2], stubEnd[2], 0.4) + 0.2 * (i ? -1 : 1)], [lerp(P0[0], stubEnd[0], 0.75), 0.04 + 0.1 * i, lerp(P0[2], stubEnd[2], 0.75) + 0.1], [stubEnd[0], stubEnd[1] - 0.05, stubEnd[2]]], 0.007, 14, 4), i ? 0xb3261e : C.rubber);
  // torn-off sensor pod, lens up toward the approach with a cracked dome
  {
    const Pp = new Parts(), Pd = new Parts();
    Pp.sph('dark', 0.15, 18, 14, [0, 0, 0], 0x6a727a); Pp.cyl('dark', 0.1, 0.1, 0.09, 16, [0, 0, 0.13], [PI / 2, 0, 0], 0x1c2634); Pp.cyl('metal', 0.078, 0.078, 0.006, 16, [0, 0, 0.18], [PI / 2, 0, 0], 0x0b1a33);
    Pp.sph('glass', 0.1, 16, 10, [0, 0, 0.172], undefined, [1, 1, 0.55]); Pp.cyl('metal', 0.105, 0.105, 0.026, 18, [0, 0, -0.16], [PI / 2, 0, 0], C.silver); Pp.box('dark', 0.16, 0.06, 0.06, [0, 0.0, -0.21], null, C.graphite);
    for (let i = 0; i < 4; i++) Pp.between('dark', [(i - 1.5) * 0.02, 0, -0.18], [(i - 1.5) * 0.06, -0.1 - (i % 2) * 0.06, -0.3 - (i % 3) * 0.04], 0.006, 4, i === 2 ? 0xb3261e : C.rubber);
    Pd.decal('decal', R.crack, 0.27, 0.27, [0.006, 0.002, 0.2285], [0, 0, 0]);
    const pp = rel(1.25, 1.0, 0.13), pr = [-0.5, 0.15, 0.3]; graft(W, Pp, pp, pr, 1); { const g = Pd.merged('decal'); if (g) Wd.add('decal', pose(g, pp, pr)); }
    for (let i = 0; i < 9; i++) { const a = noise2(i * 3.1, 2, 6) * TAU, d = 0.1 + noise2(i * 1.7, 5, 6) * 0.35, c = Math.cos(a), s = Math.sin(a); W.cyl('glass', 0.012 + noise2(i, 1, 4) * 0.02, 0.012 + noise2(i, 1, 4) * 0.02, 0.003, 3, [pp[0] + c * d, 0.012, pp[2] + s * d], [0, i, 0], 0xffffff); }
  }
  // ejected battery pack: graphite brick, orange strap, yellow terminals, trailing lead
  {
    const bp = rel(0.9, -1.75, 0.05), bry = ryD + 0.7, e = [0.1, bry, 0.2];
    W.rbox('dark', 0.34, 0.1, 0.17, 0.02, { seg: 1, pos: bp, rot: e, uv: 2 }, 0x2a2e33); W.box('hull', 0.05, 0.104, 0.172, bp, e, C.orange, { uv: 2 });
    W.box('metal', 0.07, 0.03, 0.04, [bp[0] + Math.cos(bry) * 0.19, bp[1] + 0.05, bp[2] - Math.sin(bry) * 0.19], e, 0xc8a132, { uv: 2 });
    W.add('dark', tubeG([[bp[0] + Math.cos(bry) * 0.2, bp[1] + 0.05, bp[2] - Math.sin(bry) * 0.2], [bp[0] + 0.5, 0.03, bp[2] + 0.1], [bp[0] + 0.9, 0.04, bp[2] - 0.25], [bp[0] + 1.3, 0.02, bp[2] - 0.1]], 0.009, 16, 4), C.rubber);
  }
  // rotor blade fragments + shell shards (white / teal / orange triangles)
  for (let i = 0; i < 4; i++) { const p = rel(1.0 + i * 0.5, -0.6 - i * 0.4); W.box('carbon', 0.16 + i * 0.04, 0.006, 0.05, [p[0], 0.015, p[2]], [0.05, 0.4 + i * 1.6, 0.08], C.carbon, { uv: 9 }); }
  for (let i = 0; i < 12; i++) {
    const d = 0.9 + noise2(i * 2.9, 5, 9) * 3.2, p = rel((noise2(i, 3, 9) - 0.2) * 2.6, -d * 0.5), sz = 0.05 + noise2(i, 7, 9) * 0.06;
    W.cyl('hull', sz, sz, 0.006, 3, [p[0], 0.012 + (i % 3) * 0.004, p[2]], [(noise2(i, 4, 9) - 0.5) * 0.3, noise2(i * 5.3, 2, 9) * TAU, (noise2(i, 5, 9) - 0.5) * 0.3], [C.white, C.teal, C.orange, 0xe3e6e2][i % 4]);
  }

  // ───────────────────────── ground disturbance: furrow, nose mound, scorch, clods ─────────────────────────
  const nose = wp(0, -0.1, 0.92 * FS), impact = [nose[0] + hx * 0.1, nose[2] + hz * 0.1], L = 7.4, curve = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5, d = t * L, w = Math.sin(t * 3.1 + 0.6) * 0.38 * t; curve.push([impact[0] - hx * d + rtx * w, impact[1] - hz * d + rtz * w]); }
  curve.reverse();   // start far behind → ends at the impact
  const sandCol = (k) => [SAND[0] * k, SAND[1] * k, SAND[2] * k];
  G.add('patch', stripGeo({
    gy, pts: curve, cols: 17, step: 0.3, lift: 0.012, uvS: 2.5,
    half: (u) => lerp(0.36, 0.82, Math.pow(u, 0.85)),
    prof: (t, u, x, z) => {   // groove floor stays on the terrain; low lumpy berm crests at |t| ≈ 0.55 fall back to the terrain at the rim
      const a = Math.abs(t), side = t < 0 ? 0 : 1, n = noise2(x * 3.1 + side * 9, z * 3.1, 2), m = noise2(u * 16 + side * 5, side * 3 + 1, 6);
      const amp = lerp(0.02, 0.07, smooth(0.1, 1, u)) * (0.45 + 0.9 * m), berm = smooth(0.25, 0.52, a) * (1 - smooth(0.58, 1.0, a));
      return berm * (amp + 0.025 * n) + (a < 0.3 ? 0.008 * n : 0);
    },
    col: (t, u, x, z) => { const a = Math.abs(t), k = 0.68 + 0.45 * smooth(0.25, 0.65, a) + noise2(x * 7, z * 7, 3) * 0.35; return sandCol(k * (a < 0.3 ? 0.62 : 1)); },
    alpha: (t, u) => (1 - smooth(0.74, 1.0, Math.abs(t))) * smooth(0.0, 0.22, u),
  }));
  G.add('patch', blobGeo({ gy, cx: impact[0] + hx * 0.15, cz: impact[1] + hz * 0.15, rx: 1.05, rz: 1.45, rot: ryD, rings: 7, segs: 32, wob: 0.2, seed: 13, lift: 0.012, uvS: 2.5,
    h: (x, z, u) => 0.32 * (1 - u * u) * (0.65 + 0.6 * noise2(x * 5 + 1, z * 5, 6)) * (1 - smooth(0.5, 1.0, u) * 0.4), col: (x, z, u) => sandCol(0.8 + 0.5 * noise2(x * 6, z * 6, 4)), alpha: (u) => 1 - smooth(0.75, 1.0, u) }));
  const sc = wp(0.1, -0.2, -0.45 * FS);
  G.add('patch', blobGeo({ gy, cx: sc[0], cz: sc[2], rx: 0.95, rz: 0.8, rot: 0.6, rings: 5, segs: 24, wob: 0.3, seed: 29, lift: 0.016, uvS: 2.5, col: (x, z, u) => { const k = 0.5 + 0.3 * u; return [0.05 * k, 0.045 * k, 0.045 * k]; }, alpha: (u) => (1 - smooth(0.3, 1.0, u)) * 0.85 }));
  for (let i = 0; i < 26; i++) {   // thrown clods + pebbles around the furrow and mound
    const t = noise2(i * 1.7, 4, 5), a = noise2(i * 3.1, 8, 5) * TAU, d = t * 5.5, px = impact[0] - hx * d + Math.cos(a) * (0.5 + noise2(i, 2, 3) * 1.4), pz = impact[1] - hz * d + Math.sin(a) * (0.5 + noise2(i, 2, 3) * 1.4), s = 0.025 + noise2(i * 2.3, 6, 5) * 0.08 * (1.4 - t);
    Rk.add('rock', rockG(i * 1.3 + 2, { detail: 1, rough: 0.35, sy: 0.7, pos: [px, gy(px, pz) + s * 0.25, pz], rot: [0, a, 0], sc: s }), sandCol(0.55 + noise2(i, 9, 3) * 1.1));
  }

  // ───────────────────────── recovery marker, cones, recorder ─────────────────────────
  const MX = 3.6, MZ = 2.4, MH = 3.0, sgY = Math.atan2(-MX, 6.0 - MZ), sgC = Math.cos(sgY), sgS = Math.sin(sgY), sgP = (ox, oz) => [MX + ox * sgC + oz * sgS, MZ - ox * sgS + oz * sgC];   // sign yaw faces the approach; sgP rotates a local offset
  for (let i = 0; i < 6; i++) Cl.cyl('metal', 0.03, 0.03, MH / 6, 8, [MX, MH / 12 + i * MH / 6, MZ], null, i % 2 ? C.white : C.orange);
  Cl.cyl('metal', 0.11, 0.13, 0.05, 12, [MX, 0.025, MZ], null, C.graphite); for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4; Cl.between('metal', [MX + Math.cos(a) * 0.42, 0.03, MZ + Math.sin(a) * 0.42], [MX, 0.9, MZ], 0.011, 4, C.steel); }
  Cl.cyl('metal', 0.045, 0.045, 0.1, 10, [MX, MH + 0.05, MZ], null, C.graphite);
  { const [px, pz] = sgP(-0.05, 0.12), [dx, dz] = sgP(-0.05, 0.1365); W.box('dark', 0.94, 0.24, 0.03, [px, 1.48, pz], [0, sgY, 0], C.graphite, { uv: 2 }); Wd.decal('decal', R.plate, 0.88, 0.2, [dx, 1.48, dz], [0, sgY, 0]);
    for (const sx of [-0.3, 0.3]) { const [bx, bz] = sgP(sx - 0.05, 0.12); W.between('metal', [bx, 1.37, bz], [MX, 1.37, MZ + 0.0], 0.008, 4, C.steel); } }
  for (const [cx, cz] of [[-0.2, 1.9], [2.5, 2.5], [5.0, 0.6]]) {   // traffic cones
    W.cyl('metal', 0.02, 0.115, 0.34, 14, [cx, 0.19, cz], null, 0xee6a1c); W.cyl('metal', 0.075, 0.09, 0.07, 14, [cx, 0.21, cz], null, 0xf3f4f0); W.box('metal', 0.3, 0.02, 0.3, [cx, 0.01, cz], [0, cx, 0], C.graphite, { uv: 3 });
    col(kit.cyl(...F.xz(cx, cz), 0.16, y0 - 0.3, y0 + 0.4));
  }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.62, -0.06, 0.14, 0, -0.28, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2)); g.setIndex([0, 1, 2]); g.computeVertexNormals(); Cl.add('cloth', pose(g, [MX + 0.035, MH - 0.08, MZ], [0, 0.6, 0]), 0xee6a1c); }   // pennant
  col(kit.cyl(...F.xz(MX, MZ), 0.14, y0 - 0.3, y0 + MH));
  {   // hazard tape strung between four stakes around the back of the wreck (alternating yellow / black quads in the cloth bucket, slight sag)
    const pts = [[3.9, -0.4], [3.7, -3.3], [-1.9, -3.6], [-3.6, -1.2]], th = 0.8, tw = 0.04;
    for (const [x, z] of pts) { const y = gy(x, z); Cl.cyl('metal', 0.02, 0.022, 1.0, 6, [x, y + 0.5, z], null, C.orange); Cl.cyl('metal', 0.026, 0.026, 0.03, 6, [x, y + 1.01, z], null, C.graphite); }
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s], [bx, bz] = pts[s + 1], ay = gy(ax, az), by = gy(bx, bz), len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 0.22), pt = (t) => [lerp(ax, bx, t), lerp(ay, by, t) + th - 0.1 * Math.sin(t * PI), lerp(az, bz, t)];
      for (let i = 0; i < n; i++) { const a = pt(i / n), b = pt((i + 1) / n); Cl.quad('cloth', [a[0], a[1] - tw, a[2]], [b[0], b[1] - tw, b[2]], [a[0], a[1] + tw, a[2]], [b[0], b[1] + tw, b[2]], i % 2 ? 0x15171a : 0xf0b400); }
    }
  }
  const rec = kit.recorder({ title: 'SURVEY B', sub: 'LIND · LOG 2', accent: '#ff9b3a' }), RX = -0.8, RZ = 2.5;
  rec.position.set(RX, gy(RX, RZ) + 0.62, RZ); rec.rotation.y = 0.3; kit.shadows(rec, true, false); root.add(rec);
  col(kit.cyl(...F.xz(RX, RZ), 0.25, y0 - 0.3, y0 + 0.9));

  // ───────────────────────── colliders for the wreck ─────────────────────────
  col(rectBoxes(F, CX - hx * 0.35, CZ - hz * 0.35, 0.36, 1.35, ryD, y0 - 0.3, y0 + 1.2, 0.7));
  for (const [sx, sz] of [[1, 1], [-1, -1], [1, -1]]) { const p = wp(sx * 0.9, 0.1, sz * 0.9); col(kit.cyl(...F.xz(p[0], p[2]), 0.45, y0 - 0.3, y0 + 1.1)); }

  // ───────────────────────── dead LED (animated) + beacon ─────────────────────────
  const ledMat = kit.glow(0xff3a1a, 1, {}), led = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), ledMat), lp = wp(-0.11 * FS, 0.176 * FS, 0.32 * FS);
  led.position.set(lp[0], lp[1], lp[2]); root.add(led);
  const bcn = makeBeacon(S, [MX, MH + 0.18, MZ], { color: 0xffa030, lightI: 5, range: 16, period: 3.0, duty: 0.1, size: 0.07, phase: 0.2 }); root.add(bcn.group);
  updates.push((dt, t) => {
    bcn.update(t); rec.userData.ledUpdate(t);
    const p = (t % 3.8) / 3.8, k = (p < 0.1 ? Math.sin(p / 0.1 * PI) : 0) + (p > 0.2 && p < 0.27 ? Math.sin((p - 0.2) / 0.07 * PI) * 0.8 : 0) + 0.015 + noise2(t * 9, 1, 3) * 0.02;
    ledMat.color.setRGB(12 * k, 2 * k, 0.7 * k);
  });

  // ───────────────────────── assemble ─────────────────────────
  const atlas = shoreAtlas(S), decalMat = S.once('m.decalShore', () => kit.std({ map: atlas, transparent: true, depthWrite: false, roughness: 0.85, metalness: 0 }));
  const mk = (P, key, mat, o) => { const m = P.mesh(key, mat, o); if (m) root.add(m); return m; };
  const dustW = (g) => weather(g, { strength: 0.62, height: 0.55, dust: [0.18, 0.18, 0.2], vary: 0.12 });
  const hullMesh = mk(W, 'hull', S.mat.paint, { post: dustW, name: 'drone' });
  mk(W, 'carbon', S.mat.carbon, { post: dustW }); mk(W, 'metal', S.mat.metal, { post: dustW }); mk(W, 'dark', S.mat.dark, { post: dustW }); mk(W, 'glass', S.mat.glass, { cast: false, receive: false });
  const dm = Wd.mesh('decal', decalMat, { cast: false, receive: true }); if (dm) { dm.renderOrder = 2; root.add(dm); }
  const pm = G.mesh('patch', S.mat.patch, { cast: false, receive: true }); if (pm) { pm.renderOrder = 1; root.add(pm); }
  mk(Rk, 'rock', S.mat.rock, { receive: true });
  mk(Cl, 'metal', S.mat.metal, { post: (g) => weather(g, { strength: 0.35, height: 0.6, dust: [0.3, 0.3, 0.32] }) }); mk(Cl, 'cloth', S.mat.cloth, {});

  interactables.push(
    kit.interactable({ id: 'poi.world.asphodel.poi.drone', lineId: 'world.asphodel.poi.drone', label: 'Inspect crashed drone', pos: at(CX + rtx * 1.25 - hx * 0.1, 0.95, CZ + rtz * 1.25 - hz * 0.1), radius: 3.2, object: hullMesh }),
    kit.interactable({ id: 'log.asphodel.2', lineId: 'log.asphodel.2', log: true, label: 'Play field recorder', pos: at(RX, 0.7, RZ + 0.35), radius: 2.4, object: rec }),
  );
  return { group: root, interactables, colliders, update: (dt, t, cam) => { for (const u of updates) u(dt, t, cam); } };
}
