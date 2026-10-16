// Thrust structure: gimbal ring + trunnions, hydraulic actuators, plate-to-ring truss, spherical pressure tanks in saddle cages,
// propellant bottles and feed lines. B = bellContour(L.DRIVE).
import * as THREE from 'three';
import { loftProfile } from './builder.js';
import { AY, beamAB, cylAB, ring, ringPt } from './drive_util.js';

const V3 = THREE.Vector3;

export default function buildTruss(kit, B) {
  const L = kit.L, Z = L.DRIVE.throatZ, eur = kit.eur, pg = B.pt(0.30), zg = pg.z, Ri = pg.r + 0.26, Ro = Ri + 0.4;
  const node = (p, r = 0.065) => kit.sphere('driveSteel', [p.x, p.y, p.z], r, { seg: 10, ext: true });

  // ───────── gimbal: outer ring, trunnion pins (pitch axis), bosses ─────────
  ring(kit, 'darkMetal', Ro, 0.075, zg, { seg: 72, tube: 8 });
  ring(kit, 'driveCopper', Ro, 0.02, zg + 0.07, { seg: 72, tube: 5 });
  for (const sx of [-1, 1]) {
    const a = sx > 0 ? 0 : Math.PI;
    cylAB(kit, 'driveSteel', ringPt(Ri - 0.03, a, zg), ringPt(Ro + 0.16, a, zg), 0.07, { seg: 14 });
    cylAB(kit, 'darkMetal', ringPt(Ro - 0.06, a, zg), ringPt(Ro + 0.09, a, zg), 0.125, { seg: 16 });
    cylAB(kit, 'paintOrange', ringPt(Ro + 0.02, a, zg), ringPt(Ro + 0.045, a, zg), 0.13, { seg: 16 });
    node(ringPt(Ro + 0.16, a, zg), 0.09);
  }

  // ───────── truss from the end plate to the outer ring: two A-frames (top/bottom) + four lateral diagonals ─────────
  const S = L.HULL_STATIONS[L.HULL_STATIONS.length - 1], zp = Z + 0.2;
  for (const [ang, ye] of [[Math.PI / 2, S.top - 0.03], [-Math.PI / 2, S.bot + 0.03]]) {
    const top = ringPt(Ro, ang, zg); node(top, 0.09);
    for (const sx of [-1, 1]) { const q = new V3(sx * 0.5, ye, zp); beamAB(kit, 'carbon', q, top, 0.085, 0.085); node(q, 0.06); }
    beamAB(kit, 'carbon', new V3(-0.5, ye, zp), new V3(0.5, ye, zp), 0.07, 0.07);
  }
  for (const sx of [-1, 1]) for (const dy of [-1, 1]) {
    const a = ringPt(Ro, Math.atan2(dy * 1.5, sx * 1.55), zg), q = new V3(sx * 1.9, AY + dy * 0.4, zp);
    beamAB(kit, 'carbon', q, a, 0.08, 0.08); node(q, 0.06); node(a, 0.075);
  }

  // ───────── gimbal actuators (barrel + rod, clevis lugs, accent band) ─────────
  for (const sx of [-1, 1]) for (const dy of [-1, 1]) {
    const ang = Math.atan2(dy * 0.88, sx * 1.46), a = new V3(sx * 1.46, AY + dy * 0.88, zp + 0.05), b = ringPt(Ri + 0.01, ang, zg - 0.12), m = a.clone().lerp(b, 0.55);
    cylAB(kit, 'darkMetal', a, m, 0.075, { seg: 14 }); cylAB(kit, 'driveSteel', m, b, 0.034, { seg: 10 });
    cylAB(kit, 'paintOrange', a.clone().lerp(m, 0.55), a.clone().lerp(m, 0.7), 0.081, { seg: 14 });
    kit.box('darkMetal', [a.x, a.y, a.z], [0.16, 0.16, 0.12], { ext: true, bev: 0.02 }); node(b, 0.06);
  }

  // ───────── propellant spheres in saddle cages (flanks of the boat-tail) + ventral bottles + feed lines ─────────
  const pf = (z) => loftProfile(L.HULL_STATIONS, z);
  for (const sx of [-1, 1]) {
    const C = new V3(sx * 3.2, 0.1, 39.5), r = 0.78;
    kit.sphere('paintWhite', [C.x, C.y, C.z], r, { seg: 28, ext: true });
    kit.torus('darkMetal', [C.x, C.y, C.z], r + 0.012, 0.045, { axis: 'y', seg: 40, tube: 8, ext: true });        // equator band
    kit.torus('darkMetal', [C.x, C.y, C.z], r + 0.012, 0.04, { axis: 'z', seg: 40, tube: 8, ext: true });        // meridian bands
    kit.torus('paintOrange', [C.x, C.y, C.z], r + 0.01, 0.022, { axis: 'x', seg: 40, tube: 6, ext: true });
    for (const dy of [-1, 1]) { kit.cyl('driveForge', [C.x, C.y + dy * (r + 0.05), C.z], 0.15, 0.14, { seg: 16, ext: true }); kit.cyl('darkMetal', [C.x, C.y + dy * (r + 0.14), C.z], 0.065, 0.1, { seg: 12, ext: true }); }
    for (const [dz, dy] of [[-0.62, 0.3], [0.62, 0.3], [-0.62, -0.3], [0.62, -0.3]]) {          // saddle struts to the hull frame
      const zq = C.z + dz, p = new V3(C.x - sx * 0.55, C.y + dy, zq), q = new V3(sx * (pf(zq).w - 0.08), C.y + dy * 1.1, zq);
      beamAB(kit, 'carbon', p, q, 0.07, 0.07); node(p, 0.05);
    }
    kit.hullColliders.push({ min: [sx > 0 ? 2.3 : -4.0, -0.7, 38.7], max: [sx > 0 ? 4.0 : -2.3, 0.95, 40.3] });
    // ventral bottle with cyan band + braces
    const Bp = new V3(sx * 2.55, -0.98, 40.0);
    kit.cyl('paintWhite', [Bp.x, Bp.y, Bp.z], 0.3, 1.5, { axis: 'z', seg: 24, ext: true });
    kit.sphere('paintWhite', [Bp.x, Bp.y, Bp.z - 0.75], 0.3, { seg: 14, ext: true }); kit.sphere('paintWhite', [Bp.x, Bp.y, Bp.z + 0.75], 0.3, { seg: 14, ext: true });
    for (const dz of [-0.45, 0.45]) { kit.torus('darkMetal', [Bp.x, Bp.y, Bp.z + dz], 0.31, 0.03, { axis: 'z', seg: 28, tube: 6, ext: true }); beamAB(kit, 'carbon', new V3(Bp.x - sx * 0.2, Bp.y + 0.25, Bp.z + dz), new V3(sx * (pf(Bp.z + dz).w - 0.55), -0.45, Bp.z + dz), 0.06, 0.06); }
    kit.torus('paintCyan', [Bp.x, Bp.y, Bp.z], 0.305, 0.02, { axis: 'z', seg: 28, tube: 5, ext: true });
    kit.hullColliders.push({ min: [sx > 0 ? 2.2 : -2.9, -1.35, 39.2], max: [sx > 0 ? 2.9 : -2.2, -0.6, 40.8] });
    // feed lines: tank dome → around the plate edge → manifold block
    const full = [[C.x, C.y + r + 0.2, C.z + 0.1], [sx * 3.0, 1.0, 40.6], [sx * 2.5, 0.8, 41.05], [sx * 2.28, 0.5, 41.3], [sx * 1.85, 0.3, 41.32]];
    const broke = eur && sx > 0, pts = broke ? full.slice(0, 3) : full;                           // EURYDICE: starboard line is ruptured → frozen leak
    kit.tube('driveCopper', pts, 0.045, { seg: 28, rseg: 8, ext: true });
    kit.tube('driveSteel', pts.map(([x, y, z], i) => [x, y - 0.14 - 0.02 * i, z]), 0.035, { seg: 28, rseg: 8, ext: true });
    for (const t of [0.3, 0.55, 0.8]) { const c = new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p)), false, 'catmullrom', 0.1).getPoint(t); kit.sphere('darkMetal', [c.x, c.y - 0.07, c.z], 0.075, { seg: 8, sy: 1.8, ext: true }); }
    if (broke) {
      const b = new V3(...pts[2]);
      for (let i = 0; i < 9; i++) {
        const a = i * 0.83, dir = new V3(0.45 + 0.3 * Math.cos(a), 0.15 + 0.35 * Math.sin(a), 0.85 + 0.25 * Math.sin(a * 1.7)).normalize();
        cylAB(kit, 'driveIce', b, b.clone().addScaledVector(dir, 0.3 + 0.07 * ((i * 7) % 5)), 0.035, { rb: 0.04, rt: 0.004, seg: 5 });
      }
      kit.sphere('driveIce', [b.x, b.y - 0.04, b.z], 0.11, { seg: 8, ext: true });
    }
  }
}
