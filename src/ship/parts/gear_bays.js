// Leg bays ("gear sponsons" on the lower chines): static tray walls, dark liner + rails, hinge knuckle, clevis brackets, markings, and the
// animated lids (hinged along the inboard edge, swing down as the leg deploys). Returns [{ set(angle) }] per leg (same order as legs).
import * as THREE from 'three';
import { Part } from './gear_util.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const DEPTH = 0.27, TH = 0.03, FL = 0.26, THMAX = 52 * Math.PI / 180, NSEG = 10, WALL = 0.04;
const YA = new V3(0, 1, 0);

export default function bays(kit, legs) {
  const doors = [];
  for (const lg of legs) {
    const { s, c0x, c0y, R, H, fz } = lg;
    const za = H.z - fz * 0.38, zb = H.z + fz * 2.55, z0 = Math.min(za, zb), z1 = Math.max(za, zb), Lz = z1 - z0, zc = (z0 + z1) / 2;
    // chine polyline at offset d from the skin: flat inboard lead-in, then the corner arc up to THMAX
    const line = (d, th1 = THMAX, n = NSEG) => {
      const rr = R + d, pts = [[c0x - s * FL, c0y - rr]];
      for (let k = 0; k <= n; k++) { const a = th1 * k / n; pts.push([c0x + s * rr * Math.sin(a), c0y - rr * Math.cos(a)]); }
      return pts;
    };
    const band = (d0, d1) => line(d0).concat(line(d1).reverse());
    const radial = (th, rho) => [c0x + s * rho * Math.sin(th), c0y - rho * Math.cos(th)];

    // ── static tray ──
    kit.box('hullW', [c0x - s * FL, c0y - R - DEPTH / 2, zc], [WALL, DEPTH, Lz], { bev: 0.006, ext: true });                       // inboard wall
    { const [px, py] = radial(THMAX, R + DEPTH / 2); kit.box('hullW', [px, py, zc], [WALL, DEPTH, Lz], { bev: 0.006, rot: [0, 0, s * THMAX], ext: true }); }   // outboard wall
    for (const zz of [z0 + WALL / 2, z1 - WALL / 2]) kit.extrude('hullW', band(0, DEPTH), WALL, { pos: [0, 0, zz], ext: true });  // end walls
    kit.extrude('trim', band(0.016, 0.034), Lz - 2 * WALL - 0.02, { pos: [0, 0, zc], ext: true });                                  // dark recess liner
    for (const thd of [10, 23, 36, 47]) { const th = thd * Math.PI / 180, [px, py] = radial(th, R + 0.05); kit.box('darkMetal', [px, py, zc], [0.03, 0.04, Lz - 0.55], { bev: 0.006, rot: [0, 0, s * th], ext: true }); }
    // hazard + accent strips on the lowest edge, bay lights
    kit.box('hazard', [c0x - s * FL, c0y - R - DEPTH + 0.015, zc], [0.05, 0.03, Lz - 0.12], { bev: 0.003, ext: true });
    { const [px, py] = radial(THMAX, R + DEPTH - 0.01); kit.box('paintOrange', [px, py, zc], [0.05, 0.012, Lz - 0.12], { bev: 0.002, rot: [0, 0, s * THMAX], ext: true }); }
    { const th = 31 * Math.PI / 180, [px, py] = radial(th, R + 0.045); kit.box(kit.eur ? 'ledAmberBlink' : 'emitStrip', [px, py, zc], [0.022, 0.012, Lz - 0.6], { bev: 0, rot: [0, 0, s * th], ext: true }); }
    // hinge knuckle on the hinge axis + brackets for the swing actuator / drag brace
    { const q = new Q().setFromUnitVectors(YA, lg.axis);
      for (const sg of [-1, 1]) {   // static hinge cheeks either side of the strut eye + steel pin caps
        const g = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 28), g2 = new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16);
        kit.add('darkMetal', g, { pos: [H.x + lg.axis.x * 0.34 * sg, H.y + lg.axis.y * 0.34 * sg, H.z], quat: q, ext: true });
        kit.add('steel', g2, { pos: [H.x + lg.axis.x * 0.4 * sg, H.y + lg.axis.y * 0.4 * sg, H.z], quat: q, ext: true }); g.dispose(); g2.dispose();
      }
      kit.box('darkMetal', [H.x, H.y + 0.06, H.z - fz * 0.2], [0.5, 0.3, 0.1], { bev: 0.02, ext: true }); }
    for (const K of [lg.Kb, lg.Ka]) {
      const th = Math.atan2(Math.abs(K.x - c0x), -(K.y - c0y));
      kit.box('darkMetal', [K.x, K.y, K.z], [0.22, 0.14, 0.17], { bev: 0.02, rot: [0, 0, s * th], ext: true });
      kit.cyl('steel', [K.x, K.y, K.z], 0.04, 0.3, { axis: 'x', seg: 10, ext: true });
    }
    // stepped fairing ends (taper into the skin) carrying the stencil plates
    for (const [zz, dir] of [[z0, -1], [z1, 1]]) for (const [k, f] of [[0, 0.68], [1, 0.38]]) kit.extrude('hullW', band(0, DEPTH * f), 0.12, { pos: [0, 0, zz + dir * (0.06 + k * 0.12)], ext: true });
    { const th = 24 * Math.PI / 180, [px, py] = radial(th, R + DEPTH * 0.19);
      kit.sign('GEAR BAY', [px, py, z1 + 0.243], { w: 0.22, h: 0.055, rot: [0, 0, 0], style: 'warn' });
      kit.sign(lg.id === 'fp' || lg.id === 'fs' ? 'FWD GEAR' : 'AFT GEAR', [px, py, z0 - 0.243], { w: 0.22, h: 0.055, rot: [0, Math.PI, 0], style: 'door' }); }

    // ── animated lid ──
    const outer = line(DEPTH), inner = line(DEPTH - TH), inner2 = line(DEPTH - TH - 0.012), hx = outer[0][0], hy = outer[0][1];
    const rel = (pts) => pts.map(([x, y]) => [x - hx, y - hy]);
    const part = new Part(kit);
    part.extrude('hullW', rel(outer.concat(inner.slice().reverse())), Lz - 2 * WALL - 0.04, {});
    part.extrude('trim', rel(inner.concat(inner2.slice().reverse())), Lz - 2 * WALL - 0.06, {});
    const g = kit.group(`gear.door.${lg.id}`, { pos: [hx, hy, zc] });
    part.meshes(g, `gear.door.${lg.id}`);
    doors.push({ set(angle) { g.rotation.z = -s * angle; } });
  }
  return doors;
}
