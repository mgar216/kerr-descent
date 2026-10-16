// GALLEY — Mira's basil (galley.plant): terracotta pot, soil, branching stems with ~90 cupped leaves (merged), name tag, hanging grow-lamp (pink glow + light site).
// EURYDICE: the same pot, dry brown stems, a few curled dead leaves. Origin (wx,wy,wz) = table-top point under the pot.
import * as THREE from 'three';
import { Frame } from './crew_util.js';

const V3 = THREE.Vector3, M4 = THREE.Matrix4;

function leafGeo(len, wid) {                                       // cupped, pointed oval leaf; base at origin, extends toward −Z, V-fold along the midrib
  const ns = 5, p = [], idx = [];
  for (let i = 0; i <= ns; i++) {
    const t = i / ns, w = wid * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 0.9), z = -t * len, droop = 0.22 * len * t * t, fold = w * 0.42;
    p.push(-w, fold - droop, z, 0, -droop, z, w, fold - droop, z);
  }
  for (let i = 0; i < ns; i++) { const a = i * 3, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

export default function plant(kit, wx, wy, wz) {
  const eur = kit.eur, R = kit.rand(0xba51), PI = Math.PI;
  const P = new Frame(kit, [wx, wy, wz], 0);
  // saucer + pot + soil
  P.lathe('pot', [[0, 0], [0.105, 0], [0.13, 0.004], [0.148, 0.022], [0.14, 0.024], [0.122, 0.012], [0, 0.012]], [0, 0, 0], { seg: 28 });
  P.lathe('pot', [[0, 0.012], [0.075, 0.012], [0.098, 0.12], [0.112, 0.168], [0.126, 0.172], [0.13, 0.19], [0.118, 0.192], [0.105, 0.176], [0.09, 0.16], [0, 0.16]], [0, 0, 0], { seg: 28 });
  P.sph('leather', [0, 0.158, 0], [0.098, 0.014, 0.098], { seg: 14 });
  if (!eur) kit.crewArt.put(P.sub([0.0668, 0.09, 0.0668], PI / 4), 'plant', [0, 0, 0], 0.11, 0.034);
  const leafGeos = [leafGeo(0.13, 0.075), leafGeo(0.1, 0.058), leafGeo(0.075, 0.045)];
  const mats = ['leaf', 'leaf', 'leaf', 'crewLeafNew'];
  kit.defMat('crewLeafNew', { color: 0x63b04a, rough: 0.65, metal: 0, doubleSide: true });
  kit.defMat('crewLeafDry', { color: 0x6b4a2a, rough: 0.9, metal: 0, doubleSide: true });
  const _a = new V3(), _m = new M4(), _r = new M4(), _z = new M4();
  const leaf = (pos, dir, roll, size, mat, geoIdx = 0) => {              // pos/dir local to P; dir = unit direction the leaf points (its −Z)
    _a.set(dir[0], dir[1], dir[2]).normalize();
    _r.lookAt(new V3(), _a, new V3(0, 1, 0)); _z.makeRotationZ(roll);
    _m.makeTranslation(pos[0], pos[1], pos[2]).multiply(_r).multiply(_z).multiply(new M4().makeScale(size, size, size)).premultiply(P.m);
    kit.add(mat, leafGeos[geoIdx], { matrix: _m });
  };
  const stem = (pts, r, mat) => P.tube(mat, pts, r, { rseg: 5, seg: 7 });
  const dir = (az, el) => [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
  const S0 = 0.165;                                                      // soil surface height above the saucer

  if (!eur) {
    // main stem with opposite leaf pairs; branches fanning out of the lower nodes
    const main = [[0, S0, 0], [0.005, S0 + 0.08, 0.004], [-0.004, S0 + 0.17, -0.004], [0.004, S0 + 0.27, 0.003], [0, S0 + 0.35, 0]];
    stem(main, 0.0055, 'leaf');
    const at = (t) => { const f = t * (main.length - 1), i = Math.min(main.length - 2, Math.floor(f)), k = f - i; return main[i].map((v, j) => v + (main[i + 1][j] - v) * k); };
    for (let n = 0; n < 10; n++) {
      const t = 0.14 + n * 0.09, pos = at(t), sz = 1.4 - n * 0.08, up = 0.3 + n * 0.07;
      for (let s = 0; s < 2; s++) { const az = n * 1.57 + s * PI + (R() - 0.5) * 0.3; leaf(pos, dir(az, up), (R() - 0.5) * 0.7, sz, mats[n < 3 ? 0 : n < 7 ? 1 + (n & 1) : 3], n < 7 ? 0 : 1); }
    }
    for (let k = 0; k < 4; k++) leaf(at(1), [Math.cos(k * 1.57) * 0.3, 1, Math.sin(k * 1.57) * 0.3], k, 0.8, 'crewLeafNew', 1 + (k & 1));
    for (let b = 0; b < 18; b++) {
      const az = b * 0.449 + 0.3 + (R() - 0.5) * 0.2, t0 = 0.1 + (b % 5) * 0.07, base = at(t0), L = 0.15 + R() * 0.12, el = (b < 7 ? 0.22 : 0.55) + R() * 0.35, d = dir(az, el);
      const pt = (f, lift) => [base[0] + d[0] * L * f, base[1] + d[1] * L * f * 0.9 + lift, base[2] + d[2] * L * f], c1 = pt(0.4, 0.008), c2 = pt(0.72, 0.012), c3 = pt(1, 0.006);
      stem([base, c1, c2, c3], 0.0035, 'leaf');
      [[c1, 0.8], [c2, 0.95], [c3, 1.05]].forEach(([q, f], i) => { for (let s = 0; s < 2; s++) { const a2 = az + (s ? 1 : -1) * (0.8 + R() * 0.5); leaf(q, dir(a2, 0.1 + R() * 0.45), (R() - 0.5) * 0.8, 0.95 * f, mats[(b + s + i) % 5 === 0 ? 3 : 1 + (s & 1) * 0], 0); } });
      leaf(c3, dir(az, el + 0.3), R() * 3, 0.8, 'crewLeafNew', 1);
    }
  } else {
    for (let b = 0; b < 7; b++) {                                         // dry crooked stems + a few curled dead leaves
      const az = b * 0.9 + R(), L = 0.12 + R() * 0.16, el = 0.8 + R() * 0.5, d = dir(az, el);
      stem([[0, S0, 0], [d[0] * L * 0.4, S0 + d[1] * L * 0.55, d[2] * L * 0.4], [d[0] * L * 0.8 + (R() - 0.5) * 0.04, S0 + d[1] * L, d[2] * L * 0.8 + (R() - 0.5) * 0.04]], 0.0028, 'crewLeafDry');
      if (b % 2 === 0) leaf([d[0] * L * 0.8, S0 + d[1] * L, d[2] * L * 0.8], dir(az + 1, -0.6), R() * 3, 0.5, 'crewLeafDry', 2);
    }
    leaf([0.05, S0 + 0.005, 0.03], dir(0.5, 0.1), 1, 0.7, 'crewLeafDry', 1); leaf([-0.04, S0 + 0.004, 0.06], dir(3.2, 0.1), 0, 0.6, 'crewLeafDry', 2);
  }
  for (const g of leafGeos) g.dispose();

  if (!eur) {
    // hanging grow-lamp bar: housing + glowing underside (standalone emissive that follows the lighting mode) + cables + light site
    const ly = wy + 0.9, CE = 1.35;
    P.box('white', [0, 0.9, 0], [0.7, 0.03, 0.1], { bev: 0.008 }); P.box('trim', [0, 0.915, 0], [0.72, 0.012, 0.11], { bev: 0.004 });
    for (const sx of [-0.28, 0.28]) { P.cyl('metal', [sx, (0.9 + CE - wy) / 2 + 0.015, 0], 0.003, CE - ly - 0.03, { seg: 6 }); P.box('trim', [sx, 0.93, 0], [0.03, 0.012, 0.03], { bev: 0.003 }); }
    const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.8, 2.0), toneMapped: false });
    kit.mesh(new THREE.PlaneGeometry(0.64, 0.07), gm, { pos: [wx, ly - 0.0165, wz], rot: [PI / 2, 0, 0], name: 'growLamp', cast: false, receive: false });
    kit.onUpdate((dt, t, s) => { const k = s.mode === 'normal' ? 1 : s.mode === 'alert' ? 0.55 + 0.45 * s.pulse : s.mode === 'emergency' ? 0.12 : 0; gm.color.setRGB(2.4 * k, 0.8 * k, 2.0 * k); });
    kit.light('galley.grow', [wx, ly - 0.1, wz], { color: 0xff8fe0, k: 0.03 });
    kit.interact({ id: 'galley.plant', label: "Mira's basil", pos: [wx, wy + 0.3, wz], radius: 1.5, hit: { c: [wx, wy + 0.27, wz], s: [0.42, 0.56, 0.42] } });
  }
}
