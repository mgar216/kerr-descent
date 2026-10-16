// ORPHEUS · Elysium camp shelters: A = round inflatable dome with a warm lit interior, B = ribbed tunnel pod (storage / lab, unlit).
// Both: seamed ripstop fabric (surface + textured material), inflated ribs, rigid aluminium base frames, guy lines, door vestibules.
import * as THREE from 'three';
import { surface, TAU, lerp, smooth, frac, clamp } from './poi_elysium_lib.js';

const PI = Math.PI;
export const HOT = (k = 1) => [4.2 * k, 2.0 * k, 0.6 * k];
const K = { orange: 0xe5742b, cyan: 0x2cb7cb, alu: 0xb7bec5, steel: 0x8b939b, carbon: 0x1d1f23, rubber: 0x16181b, dune: 0xcbc5b4, red: 0xc23b2c, strap: 0x2a2f36 };

/** Shelter A — dome. Returns { porchMouth: [lx, lz] (slot-local), lx, lz } for decals / footprints. */
export function shelterA(X, lx = -5.7, lz = -3.5, ly = 0.42) {
  const { kb, L } = X, RX = 2.15, RY = 1.6, RZ = 2.0, NR = 8;
  kb.at(lx, lz, ly);
  const bump = (u, e) => 1 + 0.05 * Math.sin(PI * frac(u * NR - 0.5)) * Math.sin(2 * e);
  const dome = surface(64, 20, (u, v, o) => {
    const phi = u * TAU, e = v * PI / 2, ce = Math.cos(e), b = bump(u, e);
    o[0] = RX * ce * Math.sin(phi) * b; o[1] = RY * Math.sin(e) * (1 + 0.5 * (b - 1)); o[2] = RZ * ce * Math.cos(phi) * b;
  }, { wrapU: true, pole1: true, skip: (uc, vc) => (uc < 0.047 || uc > 0.953) && vc < 0.28 });
  kb.add('fabA', dome, null, null, 1, 0xffffff);

  // inflated ribs (meridians between the panels) + apex hub
  for (let k = 0; k < NR; k++) {
    const phi = (k + 0.5) / NR * TAU, pts = [];
    for (let i = 0; i <= 14; i++) { const e = i / 14 * PI / 2 * 0.99; pts.push([RX * Math.cos(e) * Math.sin(phi), RY * Math.sin(e) + 0.01, RZ * Math.cos(e) * Math.cos(phi)]); }
    kb.tube('paint', pts, 0.085, K.orange, 18, 6);
  }
  kb.cyl('paint', 0.2, 0.27, 0.1, 12, [0, RY + 0.015, 0], null, K.carbon);
  // rigid base hoop (aluminium) and anti-wind skirt weighted with dust bags
  const ring = []; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; ring.push([RX * 0.99 * Math.sin(a), 0.055, RZ * 0.99 * Math.cos(a)]); }
  kb.tube('metal', ring, 0.04, K.alu, 56, 5, true);
  kb.add('paint', new THREE.RingGeometry(1, 1.16, 56, 1), [0, 0.02, 0], [-PI / 2, 0, 0], [RX, RZ, 1], 0x6e6c66);
  for (let i = 0; i < 14; i++) { const a = (i + 0.3) / 14 * TAU, c = X.rnd(); kb.sph('paint', 0.15, [1.09 * RX * Math.sin(a), 0.07, 1.09 * RZ * Math.cos(a)], [0.08 + c * 0.05, 0.08 + c * 0.05, 0.075 + c * 0.04], [1, 0.45, 0.8], [8, 5]); }
  // guy lines + pegs (door side kept clear)
  for (const deg of [55, 125, 235, 305]) {
    const a = deg * PI / 180, e = 55 * PI / 180, top = [RX * Math.cos(e) * Math.sin(a), RY * Math.sin(e), RZ * Math.cos(e) * Math.cos(a)], peg = [(RX + 1.5) * Math.sin(a), 0.03, (RZ + 1.5) * Math.cos(a)];
    kb.rod('metal', top, peg, 0.007, 0.007, K.carbon, 4); kb.cyl('metal', 0.012, 0.012, 0.28, 5, [peg[0], 0.07, peg[2]], [0.5 * Math.cos(a), 0, -0.5 * Math.sin(a)], K.steel);
    kb.cyl('paint', 0.035, 0.035, 0.014, 8, top, null, K.orange);   // tie-out patch
  }
  // roof vent mushroom
  kb.cyl('paint', 0.05, 0.05, 0.1, 8, [0, RY * 0.86 + 0.02, -0.98], [-0.9, 0, 0], K.carbon); kb.cyl('paint', 0.11, 0.07, 0.04, 10, [0, RY * 0.9 + 0.07, -1.06], [-0.9, 0, 0], K.dune);
  // door vestibule: ribbed arch tunnel
  const pz0 = 1.35, pz1 = 3.25, prx = 0.78, pry = 1.0, fl = (u) => 1 + 0.12 * smooth(0.55, 1, u);
  kb.add('fabA', surface(20, 12, (u, v, o) => {
    const z = lerp(pz0, pz1, u), th = lerp(-PI / 2, PI / 2, v), f = fl(u) * (1 + 0.03 * Math.sin(PI * frac(u * 3)));
    o[0] = prx * f * Math.sin(th); o[1] = pry * f * Math.cos(th); o[2] = z;
  }, { uvfn: (u, v, o) => { o[0] = u * 0.3 + 0.0625; o[1] = 1 - Math.abs(2 * v - 1); } }), null, null, 1, 0xffffff);
  for (const u of [0.34, 0.68, 1.0]) {
    const z = lerp(pz0, pz1, u), f = fl(u) * 1.035, pts = [];
    for (let i = 0; i <= 12; i++) { const th = lerp(-PI / 2, PI / 2, i / 12); pts.push([prx * f * Math.sin(th), pry * f * Math.cos(th), z]); }
    kb.tube('paint', pts, 0.048, K.orange, 14, 5);
  }
  const mf = fl(1) * 1.09, rim = []; for (let i = 0; i <= 12; i++) { const th = lerp(-PI / 2, PI / 2, i / 12); rim.push([prx * mf * Math.sin(th), pry * mf * Math.cos(th), pz1 + 0.01]); }
  kb.tube('metal', rim, 0.022, K.alu, 14, 4);                                              // rigid door frame arch
  kb.box('metal', 0.04, 0.06, 0.12, [-prx * mf, 0.03, pz1], null, K.alu); kb.box('metal', 0.04, 0.06, 0.12, [prx * mf, 0.03, pz1], null, K.alu);
  kb.box('paint', 1.4, 0.02, 2.0, [0, 0.012, (pz0 + pz1) / 2 + 0.1], null, 0x1c2026);        // door mat

  // interior — everything unlit warm (the dome fabric glows): floor, back wall wash, lantern, bedroll
  kb.cyl('glow', 1.75, 1.75, 0.01, 30, [0, 0.016, -0.1], null, (x, y, z) => { const d = Math.min(1, Math.hypot(x, z - 0.1) / 1.75), k = 1.1 * (1 - 0.7 * d); return [k * 1.0, k * 0.56, k * 0.22]; });
  kb.sph('glow', 0.085, [0, RY * 0.8, 0.35], HOT(2.0), 1, [10, 8]);
  kb.rod('metal', [0, RY * 0.97, 0.35], [0, RY * 0.84, 0.35], 0.006, 0.006, K.steel, 4); kb.cyl('metal', 0.07, 0.05, 0.03, 8, [0, RY * 0.9 + 0.02, 0.35], null, K.carbon);
  kb.sph('glow', 0.07, [0, pry * 0.74, 2.15], HOT(1.4), 1, [10, 8]);                         // vestibule lantern
  kb.rod('metal', [0, pry * 0.97, 2.15], [0, pry * 0.8, 2.15], 0.006, 0.006, K.steel, 4); kb.cyl('metal', 0.06, 0.045, 0.025, 8, [0, pry * 0.84, 2.15], null, K.carbon);
  kb.cyl('glow', 0.2, 0.2, 1.5, 12, [-0.95, 0.21, -0.2], [0, 0, PI / 2], (x, y, z) => { const k = 0.5 + 0.25 * Math.cos(Math.atan2(x, z)); return [k * 0.95, k * 0.62, k * 0.38]; });
  kb.cyl('glow', 0.12, 0.12, 0.44, 10, [-0.95, 0.35, 0.6], [PI / 2, 0, 0.25], [0.8, 0.62, 0.5]);

  X.cylC(lx, lz, 2.22, 1.7);
  const sy = Math.sin(ly), cy = Math.cos(ly);
  X.cylC(lx + 2.55 * sy, lz + 2.55 * cy, 0.82, 1.15);
  return { lx, lz, ly, porchMouth: [lx + pz1 * sy, lz + pz1 * cy] };
}

/** Shelter B — ribbed tunnel pod with a closed, zipped door. The door end faces local +Z of its prop frame. */
export function shelterB(X, lx = 5.9, lz = -4.6, ly = -1.2) {
  const { kb, L } = X, PL = 4.6, PA = 0.98, PB = 1.42, CAP = 1.0, NRIB = 8;
  kb.at(lx, lz, ly);
  const prof = (z) => { const a = Math.abs(z) - (PL / 2 - CAP); return a <= 0 ? 1 : Math.sqrt(Math.max(0, 1 - (a / CAP) * (a / CAP))); };
  kb.add('fabB', surface(44, 20, (u, v, o) => {
    const z = lerp(-PL / 2, PL / 2, u), th = lerp(-PI / 2, PI / 2, v), s = prof(z), b = 1 + 0.045 * Math.sin(PI * frac(u * NRIB)) * s;
    o[0] = PA * s * b * Math.sin(th); o[1] = PB * s * b * Math.cos(th); o[2] = z;
  }, { uvfn: (u, v, o) => { o[0] = u + 0.5 / NRIB; o[1] = 1 - Math.abs(2 * v - 1); } }), null, null, 1, 0xffffff);
  for (let k = 1; k < NRIB; k++) {   // inflated arch ribs
    const z = lerp(-PL / 2, PL / 2, k / NRIB), s = prof(z), pts = [];
    for (let i = 0; i <= 16; i++) { const th = lerp(-PI / 2, PI / 2, i / 16); pts.push([PA * s * Math.sin(th), PB * s * Math.cos(th) + 0.005, z]); }
    kb.tube('paint', pts, 0.07, K.cyan, 18, 6);
  }
  for (const sx of [-1, 1]) kb.box('metal', 0.07, 0.07, PL - 0.5, [sx * (PA - 0.02), 0.04, 0], null, K.alu);
  for (const sz of [-1, 1]) kb.box('metal', PA * 2 - 0.1, 0.06, 0.06, [0, 0.035, sz * (PL / 2 - 0.55)], null, K.alu);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kb.box('metal', 0.1, 0.1, 0.1, [sx * (PA - 0.02), 0.05, sz * (PL / 2 - 0.27)], null, K.steel);
  // tie-down straps over the crown with pegs
  for (const zk of [-1.15, 1.15]) {
    const pts = []; for (let i = 0; i <= 18; i++) { const th = lerp(-PI / 2, PI / 2, i / 18); pts.push([(PA + 0.01) * Math.sin(th) * 1.02, (PB + 0.01) * Math.cos(th) * 1.02, zk]); }
    kb.tube('paint', pts, 0.016, 0x8a4a22, 22, 4);
    for (const sx of [-1, 1]) { kb.rod('metal', [sx * PA * 1.02, 0.02, zk], [sx * (PA + 1.1), 0.03, zk], 0.006, 0.006, K.carbon, 4); kb.cyl('metal', 0.012, 0.012, 0.26, 5, [sx * (PA + 1.1), 0.07, zk], [0, 0, sx * 0.5], K.steel); }
  }
  // vestibule + zipped door flap
  const pz0 = PL / 2 - 0.35, pz1 = PL / 2 + 0.55, prx = 0.62, pry = 0.92;
  kb.add('fabB', surface(14, 10, (u, v, o) => { const z = lerp(pz0, pz1, u), th = lerp(-PI / 2, PI / 2, v), f = 1 + 0.06 * smooth(0.5, 1, u); o[0] = prx * f * Math.sin(th); o[1] = pry * f * Math.cos(th); o[2] = z; }, { uvfn: (u, v, o) => { o[0] = u * 0.2; o[1] = 1 - Math.abs(2 * v - 1); } }), null, null, 1, 0xffffff);
  kb.add('fabB', surface(8, 8, (u, v, o) => { const th = lerp(-PI / 2, PI / 2, u), r = v; o[0] = prx * 1.06 * r * Math.sin(th); o[1] = pry * 1.06 * r * Math.cos(th); o[2] = pz1 + 0.07 * (1 - r * r); }, { uvfn: (u, v, o) => { o[0] = 0.04 + u * 0.12; o[1] = 0.1 + v * 0.8; } }), null, null, 1, 0xffffff);
  const mouth = []; for (let i = 0; i <= 12; i++) { const th = lerp(-PI / 2, PI / 2, i / 12); mouth.push([prx * 1.07 * Math.sin(th), pry * 1.07 * Math.cos(th), pz1 + 0.01]); }
  kb.tube('metal', mouth, 0.022, K.alu, 14, 4);
  kb.box('paint', 0.02, pry * 0.95, 0.03, [0, pry * 0.5, pz1 + 0.075], null, K.carbon);        // zip
  for (const y of [0.35, 0.65]) kb.cyl('paint', 0.025, 0.025, 0.05, 8, [0.05, y, pz1 + 0.09], [PI / 2, 0, 0], K.orange);   // toggles
  // porthole (dark, on the side that faces the camp), inflation valve + hose to a small pump, roof vent
  const th = 62 * PI / 180, nx = Math.sin(th) / PA, ny = Math.cos(th) / PB, nl = Math.hypot(nx, ny), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(nx / nl, ny / nl, 0));
  kb.add('metal', new THREE.CylinderGeometry(0.27, 0.27, 0.03, 22), [PA * Math.sin(th) * 1.003, PB * Math.cos(th) * 1.003, 0.4], new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx / nl, ny / nl, 0)), 1, 0x0b1118);
  kb.add('metal', new THREE.TorusGeometry(0.27, 0.032, 6, 24), [PA * Math.sin(th) * 1.003, PB * Math.cos(th) * 1.003, 0.4], q, 1, K.alu);
  kb.cyl('paint', 0.03, 0.03, 0.14, 8, [0.12, PB * 0.87 + 0.04, -PL * 0.18], null, K.red);
  kb.cyl('paint', 0.06, 0.06, 0.06, 8, [0.12, PB * 0.87 + 0.14, -PL * 0.18], null, K.carbon);
  kb.box('paint', 0.34, 0.2, 0.24, [-PA - 0.55, 0.1, -PL / 2 + 0.2], null, K.orange); kb.cyl('paint', 0.05, 0.05, 0.08, 8, [-PA - 0.55, 0.24, -PL / 2 + 0.2], null, K.carbon);
  kb.tube('paint', [[-PA - 0.4, 0.14, -PL / 2 + 0.25], [-PA - 0.15, 0.04, -PL / 2 + 0.55], [-PA * 0.6, 0.08, -PL / 2 + 0.65], [-PA * 0.3, 0.8, -PL / 2 + 0.75]], 0.02, K.carbon, 14, 4);

  // colliders along the axis
  const sy = Math.sin(ly), cy = Math.cos(ly);
  for (const d of [-1.55, 0, 1.55, 2.5]) X.cylC(lx + d * sy, lz + d * cy, d === 2.5 ? 0.7 : 1.08, d === 2.5 ? 1.2 : 1.45);
  return { lx, lz, ly, doorMouth: [lx + pz1 * sy, lz + pz1 * cy] };
}
