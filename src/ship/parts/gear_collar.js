// Docking collar around the port airlock hatch: flange ring on a short sleeve (with a ladder slot at the bottom), seal gasket, latch hooks,
// alignment cones, guide lights, sill platform with grab rails. Static (merged into the exterior group).
// HX-01 (kit.eur): latches bent open / missing, a cone broken, guide lights dead.
import * as THREE from 'three';

const GAP = 17 * Math.PI / 180;            // half-angle of the ladder slot at the bottom of the ring

export default function collar(kit, C) {
  const eur = kit.eur, R = kit.rand(0x6c01);
  const { Z0, Y0 } = C, XF = -4.71, XB = -4.63, RIN = 1.3, ROUT = 1.5;
  // flange ring (partial annulus, slot at the bottom); shape lives in local XY, extrusion +Z → +X after the yaw
  const ring = new THREE.Shape(), th0 = -Math.PI / 2 + GAP, th1 = 1.5 * Math.PI - GAP;
  ring.absarc(0, 0, ROUT, th0, th1, false); ring.absarc(0, 0, RIN, th1, th0, true);
  const g = new THREE.ExtrudeGeometry(ring, { depth: XB - XF, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 64 });
  kit.add('hullW', g, { pos: [XF, Y0, Z0], rot: [0, Math.PI / 2, 0], ext: true }); g.dispose();
  // sleeve joining the ring to the hull (open cylinder along X, same slot) + ribs
  const sl = new THREE.CylinderGeometry(RIN + 0.01, RIN + 0.01, 0.61, 64, 1, true, -Math.PI / 2 + GAP, 2 * Math.PI - 2 * GAP);
  kit.add('trimDS', sl, { pos: [(XB - 4.02) / 2, Y0, Z0], rot: [0, 0, Math.PI / 2], ext: true }); sl.dispose();
  const polar = (a, r) => [Y0 + r * Math.cos(a), Z0 + r * Math.sin(a)];       // a from +Y toward +Z (bottom = π)
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; if (Math.abs(a - Math.PI) < GAP + 0.1) continue; const [py, pz] = polar(a, RIN + 0.03); kit.box('darkMetal', [XB + 0.13, py, pz], [0.3, 0.06, 0.05], { bev: 0.008, rot: [a, 0, 0], ext: true }); }
  for (const sg of [-1, 1]) { const a = Math.PI + sg * GAP, [py, pz] = polar(a, 1.4); kit.box('darkMetal', [(XF + XB) / 2, py, pz], [0.1, 0.24, 0.03], { bev: 0.006, rot: [a, 0, 0], ext: true }); }
  // seal gasket + accent rims
  kit.torus('rubber', [XF - 0.01, Y0, Z0], 1.4, 0.03, { axis: 'x', seg: 64, tube: 8, ext: true });
  kit.torus('paintOrange', [XF - 0.008, Y0, Z0], ROUT - 0.012, 0.014, { axis: 'x', seg: 64, tube: 6, ext: true });
  kit.torus('paintCyan', [XF - 0.008, Y0, Z0], RIN + 0.012, 0.011, { axis: 'x', seg: 64, tube: 6, ext: true });
  // latch hooks (12) — derelict: some bent open, two missing; none inside the ladder slot
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6 + Math.PI / 12;
    if (Math.abs(a - Math.PI) < GAP + 0.05 || (eur && (k === 3 || k === 9))) continue;
    const [cy, cz] = polar(a, 1.4), open = eur ? (k % 2 ? 0.7 + R() * 0.5 : 0.1 * R()) : 0, off = open * 0.09;
    kit.box('darkMetal', [XF - 0.035, cy, cz], [0.07, 0.15, 0.1], { bev: 0.012, rot: [a, 0, 0], ext: true });
    kit.box('steel', [XF - 0.095 - off * 0.3, cy + Math.cos(a) * 0.02 - Math.sin(a) * off, cz + Math.sin(a) * 0.02 + Math.cos(a) * off], [0.06, 0.04, 0.07], { bev: 0.008, rot: [a + open, 0, 0], ext: true });
    kit.cyl('steel', [XF - 0.07, cy, cz], 0.016, 0.13, { axis: 'x', seg: 8, ext: true });
  }
  // alignment cones (3) + guide lights
  for (let k = 0; k < 3; k++) {
    const [cy, cz] = polar(k * Math.PI * 2 / 3, 1.4), dead = eur && k === 1;
    kit.cyl(dead ? 'darkMetal' : 'paintOrange', [XF - 0.1, cy, cz], 0.065, 0.2, { axis: 'x', rt: dead ? 0.03 : 0.0, rb: 0.065, seg: 14, ext: true });
  }
  for (let k = 0; k < 8; k++) {
    if (k === 4) continue;
    const a = k * Math.PI / 4, [cy, cz] = polar(a, RIN + 0.075), mat = eur ? (k === 5 ? 'ledAmberBlink' : 'screenOff') : (k % 2 ? 'emitAmber' : 'emitCyan');
    kit.box(mat, [XF - 0.002, cy, cz], [0.012, 0.05, 0.075], { bev: 0, rot: [a, 0, 0], ext: true });
  }
  // sill platform (tunnel floor continues out to x = −4.95) + ribs, edge lights, grab rails
  kit.box('trim', [-4.675, -1.23, Z0], [0.55, 0.06, 1.4], { bev: 0.008, ext: true });
  for (let x = -4.45; x > -4.92; x -= 0.09) kit.box('darkMetal', [x, -1.196, Z0], [0.03, 0.012, 1.3], { bev: 0.002, ext: true });
  kit.box('hazard', [-4.935, -1.2, Z0], [0.04, 0.05, 1.38], { bev: 0.004, ext: true });
  kit.box(eur ? 'screenOff' : 'emitStripO', [-4.915, -1.176, Z0], [0.012, 0.006, 1.3], { bev: 0, ext: true });
  for (const sz of [1]) {   // aft side only: the open plug door stands on the forward side
    kit.cyl('metal', [-4.88, -0.78, Z0 + sz * 0.66], 0.025, 0.85, { seg: 10, ext: true });
    kit.beam('metal', [-4.88, -0.36, Z0 + sz * 0.66], [-4.5, -0.36, Z0 + sz * 0.66], 0.04, 0.04, { bev: 0.012, ext: true });
    kit.sphere('darkMetal', [-4.88, -0.36, Z0 + sz * 0.66], 0.035, { seg: 8, ext: true });
  }
}
