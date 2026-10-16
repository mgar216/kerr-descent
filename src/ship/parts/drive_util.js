// Shared helpers for the aft drive section (drive.js + drive_*.js). No module state: every call builds fresh data.
import * as THREE from 'three';
import { bevelBoxArrays } from './builder.js';

const V3 = THREE.Vector3;
export const AY = 0.15;                              // thrust-axis height (L.DRIVE.axisY)

// Torch bell contour: quadratic Bézier from the throat (z0, r0) to the exit (z1, r1); entry wall angle 42°, exit wall angle 7°.
export function bellContour(D) {
  const z0 = D.throatZ, r0 = D.throatR, z1 = D.bellZ1, r1 = D.bellR1, m0 = Math.tan(0.733), m1 = Math.tan(0.122);
  const cz = (r1 - r0 + m0 * z0 - m1 * z1) / (m0 - m1), cr = r0 + m0 * (cz - z0);
  const N = 128, tz = new Float32Array(N + 1), tr = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { const t = i / N, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t; tz[i] = a * z0 + b * cz + c * z1; tr[i] = a * r0 + b * cr + c * r1; }
  const at = (z) => {                                // inner wall radius at z
    if (z <= z0) return r0; if (z >= z1) return r1;
    let i = 0; while (i < N - 1 && tz[i + 1] < z) i++;
    const f = (z - tz[i]) / (tz[i + 1] - tz[i]); return tr[i] + (tr[i + 1] - tr[i]) * f;
  };
  // parallel curve offset `off` (m, + = outward) sampled at n+1 uniform Bézier parameters → [[r, z], …]; opt. range t0..t1
  const prof = (n, off = 0, t0 = 0, t1 = 1) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n, a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
      const z = a * z0 + b * cz + c * z1, r = a * r0 + b * cr + c * r1;
      const dz = 2 * (1 - t) * (cz - z0) + 2 * t * (z1 - cz), dr = 2 * (1 - t) * (cr - r0) + 2 * t * (r1 - cr), l = Math.hypot(dz, dr);
      out.push([r + off * dz / l, z - off * dr / l]);
    }
    return out;
  };
  // surface sample at Bézier parameter t: radius, axial position and unit wall tangent (sa, ca) = (dr, dz)/|·|
  const pt = (t) => {
    const a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    const dz = 2 * (1 - t) * (cz - z0) + 2 * t * (z1 - cz), dr = 2 * (1 - t) * (cr - r0) + 2 * t * (r1 - cr), l = Math.hypot(dz, dr);
    return { r: a * r0 + b * cr + c * r1, z: a * z0 + b * cz + c * z1, sa: dr / l, ca: dz / l };
  };
  return { z0, z1, r0, r1, at, prof, pt };
}

export const basis = (p, x, y, z) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(p.x, p.y, p.z);

// matrix with local +Y running a→b (origin at the midpoint), plus the length
export function between(a, b) {
  const dir = new V3().subVectors(b, a), len = dir.length(); dir.divideScalar(len || 1);
  const ref = Math.abs(dir.y) > 0.95 ? new V3(1, 0, 0) : new V3(0, 1, 0);
  const x = new V3().crossVectors(ref, dir).normalize(), z = new V3().crossVectors(x, dir);
  return { m: basis(new V3().addVectors(a, b).multiplyScalar(0.5), x, dir, z), len };
}
export const v3 = (a) => (a.isVector3 ? a : new V3(a[0], a[1], a[2]));
// frame on the bell's outer skin at Bézier parameter t / angle a, `off` m along the outward normal: local x = circumferential, y = −normal, z = generatrix
export function wallFrame(B, t, a, off) {
  const p = B.pt(t), nr = new V3(Math.cos(a), Math.sin(a), 0), c = new V3(-Math.sin(a), Math.cos(a), 0);
  const g = new V3(p.sa * nr.x, p.sa * nr.y, p.ca).normalize(), y = new V3().crossVectors(g, c);
  return basis(new V3(nr.x * p.r - y.x * off, AY + nr.y * p.r - y.y * off, p.z - y.z * off), c, y, g);
}

// bevel box under an arbitrary matrix (exterior)
export function boxM(kit, mat, M, w, h, d, bev = 0.008) { kit.arrays(mat, bevelBoxArrays(w, h, d, bev), { matrix: M, ext: true }); }
// cylinder / cone between two points (exterior)
export function cylAB(kit, mat, a, b, r, o = {}) {
  a = v3(a); b = v3(b); const { m, len } = between(a, b);
  const g = new THREE.CylinderGeometry(o.rt != null ? o.rt : r, o.rb != null ? o.rb : r, len, o.seg || 12, 1, !!o.open);
  kit.add(mat, g, { matrix: m, ext: true }); g.dispose();
}
// box beam between two points with explicit cross-section orientation: w across the local X axis of `between`
export function beamAB(kit, mat, a, b, w, h, bev = 0.006) {
  a = v3(a); b = v3(b); const { m, len } = between(a, b);
  boxM(kit, mat, m, w, len, h, bev);
}
// ring (torus) about the thrust axis
export const ring = (kit, mat, R, r, z, o = {}) => kit.torus(mat, [0, AY, z], R, r, { axis: 'z', seg: o.seg || 56, tube: o.tube || 8, ext: true });
// point on a circle about the thrust axis
export const ringPt = (r, ang, z) => new V3(r * Math.cos(ang), AY + r * Math.sin(ang), z);

// drive materials: lighter / less metallic than the kit's raw metals so the hardware reads without an environment map
export function driveMats(kit) {
  const T = kit.T;
  kit.defMat('driveShell', { tex: T.brushedMetal, uv: 'world', tile: 0.8, rough: 1, metal: 0.55, color: 0x9a8672 });    // burnished dark-bronze bell skin
  kit.defMat('driveForge', { tex: T.brushedMetal, uv: 'world', tile: 0.8, rough: 1, metal: 0.7, color: 0xb59068 });     // throat forging
  kit.defMat('driveSteel', { tex: T.brushedMetal, uv: 'world', tile: 1, rough: 1, metal: 0.5, color: 0xe8ecf2 });       // pins, rods, fins, hinge barrels
  kit.defMat('driveCopper', { color: 0xc88255, rough: 0.3, metal: 0.8 });                                              // coolant tubes
  kit.defMat('driveTile', { color: 0x2c2e34, rough: 0.8, metal: 0.0 });                                                // heat-shield ceramic
  if (kit.eur) kit.defMat('driveIce', { color: 0xcfe6fa, rough: 0.15, metal: 0, transparent: true, opacity: 0.8, depthWrite: false, noShadow: true });   // frozen leak (derelict)
}
