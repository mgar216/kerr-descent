// Hull livery (name/patch decals, orange+cyan stripes) and surface kit-bash (plates, vents, ducts, rails, tanks, belly panels).
import * as THREE from 'three';
import { loftProfile } from './builder.js';

export default function build(kit) {
  const L = kit.L, T = kit.T, R = kit.rand(0x6a11), eur = kit.eur;
  const ST = L.HULL_STATIONS;
  const flankX = (z, y) => {                         // skin x (positive) at height y for station z
    const q = loftProfile(ST, z), yt = q.top - q.rc, yb = q.bot + q.rc;
    const dy = y > yt ? y - yt : y < yb ? yb - y : 0;
    return q.w - q.rc + Math.sqrt(Math.max(0, q.rc * q.rc - dy * dy));
  };
  const hatchZ = (z) => z > 14.6 && z < 17.4;       // docking collar zone (port)

  // ───────── livery stripes along both flanks ─────────
  for (const sx of [-1, 1]) {
    for (let z0 = 3.0; z0 < 37.0; z0 += 1.0) {
      const z1 = Math.min(z0 + 1.0, 37.0), zm = (z0 + z1) / 2;
      if (sx < 0 && (hatchZ(z0) || hatchZ(z1))) continue;
      kit.box('paintOrange', [sx * (flankX(zm, -0.62) + 0.003), -0.62, zm], [0.01, 0.09, z1 - z0 + 0.005], { bev: 0.002, ext: true });
      kit.box('paintCyan', [sx * (flankX(zm, -0.745) + 0.003), -0.745, zm], [0.01, 0.035, z1 - z0 + 0.005], { bev: 0.002, ext: true });
    }
  }
  // ───────── name + registry + mission patch (reads correctly from outside each flank) ─────────
  {
    const d = T.nameDecal(eur ? 'EURYDICE' : 'ORPHEUS', eur ? 'HX-01' : 'HX-02', eur), w = 4.5, h = w / d.aspect;
    kit.decal(d.tex, [-(L.HAB_SKIN + 0.008), 0.12, 20.25], [w, h], { rot: [0, -Math.PI / 2, 0], name: 'decal.name.port' });
    kit.decal(d.tex, [L.HAB_SKIN + 0.008, 0.12, 18.3], [w, h], { rot: [0, Math.PI / 2, 0], name: 'decal.name.stbd' });
  }

  // ───────── flank details ─────────
  const plate = (x, y, z, sx, sy, sz, mat = 'hullW', bev = 0.012) => kit.box(mat, [x, y, z], [sx, sy, sz], { bev, ext: true });
  for (const sx of [-1, 1]) {
    // access panels with handles (raised 2 cm)
    for (const z of [3.7, 7.3, 13.2, 19.2, 22.0, 27.0, 31.5, 34.7]) {
      if (sx < 0 && (Math.abs(z - 5.6) < 0.6 || hatchZ(z) || (z > 10 && z < 12))) continue;
      if (sx > 0 && z > 11 && z < 13) continue;
      if ((sx < 0 && z > 17.9 && z < 22.6) || (sx > 0 && z > 15.8 && z < 20.8)) continue;       // name decal
      const x = sx * (flankX(z, -0.1) + 0.012);
      plate(x, -0.15, z, 0.025, 0.42, 0.62); plate(x + sx * 0.02, -0.15, z, 0.012, 0.05, 0.26, 'darkMetal', 0.004);
      for (const [dy, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.cyl('metal', [x + sx * 0.014, -0.15 + dy * 0.17, z + dz * 0.26], 0.014, 0.014, { seg: 8, axis: 'x', ext: true });
    }
    // sensor blisters + cable duct on the lower chine
    for (const z of [3.4, 21.8, 28.6]) kit.sphere('darkMetal', [sx * (flankX(z, 0.55) + 0.01), 0.55, z], 0.17, { seg: 14, sy: 0.7, sx: 0.5, ext: true });
    kit.beam('darkMetal', [sx * (flankX(4, -1.12) + 0.02), -1.12, 3.2], [sx * (flankX(21.8, -1.12) + 0.02), -1.12, 21.8], 0.08, 0.07, { bev: 0.02, ext: true });
    for (let z = 4; z < 22; z += 1.6) kit.box('darkMetal', [sx * (flankX(z, -1.12) + 0.015), -1.12, z], [0.1, 0.12, 0.08], { bev: 0.01, ext: true });
    // EVA grab rail along the shoulder line (above the name decal)
    for (const [a, b] of [[3.4, 9.6], [12.2, 21.5]]) {
      kit.beam('metal', [sx * (flankX(a, 0.8) + 0.12), 0.8, a], [sx * (flankX(b, 0.8) + 0.12), 0.8, b], 0.035, 0.035, { bev: 0.01, ext: true });
      for (let z = a; z <= b + 0.01; z += 1.2) kit.box('darkMetal', [sx * (flankX(z, 0.8) + 0.06), 0.8, z], [0.12, 0.05, 0.05], { bev: 0.005, ext: true });
    }
  }

  // ───────── roof: spine fairings, plates, vents, tanks ─────────
  const awayFromDome = (x, z, pad = 0.4) => Math.hypot(x - L.DOME.cx, z - L.DOME.cz) > L.DOME.r + 0.55 + pad;
  for (const [z0, z1] of [[3.2, 7.0], [13.0, 23.0]]) {
    const zm = (z0 + z1) / 2, len = z1 - z0;
    plate(0, L.ROOF_Y + 0.12, zm, 1.5, 0.24, len, 'hullW', 0.05);
    kit.box('steel', [0, L.ROOF_Y + 0.25, zm], [0.9, 0.04, len - 0.4], { bev: 0.01, ext: true }); kit.box('paintOrange', [0, L.ROOF_Y + 0.275, zm], [0.1, 0.012, len - 0.9], { bev: 0.002, ext: true });
    for (const sx of [-1, 1]) kit.beam('metal', [sx * 0.62, L.ROOF_Y + 0.34, z0 + 0.3], [sx * 0.62, L.ROOF_Y + 0.34, z1 - 0.3], 0.03, 0.03, { bev: 0.008, ext: true });
    for (let z = z0 + 0.4; z < z1 - 0.2; z += 1.1) for (const sx of [-1, 1]) kit.box('darkMetal', [sx * 0.62, L.ROOF_Y + 0.29, z], [0.05, 0.1, 0.05], { bev: 0.004, ext: true });
  }
  for (let i = 0; i < 26; i++) {                     // roof access plates, vents, antenna pads
    const x = (R() - 0.5) * 6.0, z = 3.2 + R() * 20.4; if (Math.abs(x) < 0.95 && !((z > 7 && z < 13))) continue; if (!awayFromDome(x, z)) continue;
    const k = R();
    if (k < 0.5) plate(x, L.ROOF_Y + 0.014, z, 0.5 + R() * 0.7, 0.028, 0.4 + R() * 0.6);
    else if (k < 0.8) { plate(x, L.ROOF_Y + 0.02, z, 0.7, 0.04, 0.45, 'darkMetal', 0.01); for (let s = 0; s < 6; s++) kit.box('trim', [x, L.ROOF_Y + 0.045, z - 0.17 + s * 0.068], [0.6, 0.012, 0.025], { bev: 0, ext: true }); }
    else { kit.cyl('darkMetal', [x, L.ROOF_Y + 0.06, z], 0.2, 0.12, { seg: 14, ext: true }); kit.cyl('metal', [x, L.ROOF_Y + 0.13, z], 0.15, 0.03, { seg: 14, ext: true }); }
  }
  // cargo / engineering roof: propellant tanks in cradles, heat exchangers, vent stacks
  for (const sx of [-1, 1]) {
    kit.cyl('metal', [sx * 1.9, L.ROOF_Y + 0.36, 29.5], 0.34, 5.6, { axis: 'z', seg: 22, ext: true });
    for (const dz of [-1, 1]) kit.sphere('metal', [sx * 1.9, L.ROOF_Y + 0.36, 29.5 + dz * 2.8], 0.34, { seg: 18, ext: true });
    for (let z = 27.2; z < 32; z += 1.2) { kit.box('darkMetal', [sx * 1.9, L.ROOF_Y + 0.17, z], [0.9, 0.1, 0.1], { bev: 0.01, ext: true }); kit.torus('darkMetal', [sx * 1.9, L.ROOF_Y + 0.36, z], 0.35, 0.03, { axis: 'z', seg: 18, tube: 6, ext: true }); }
    plate(sx * 3.05, L.ROOF_Y + 0.025, 33.5, 1.2, 0.05, 3.4, 'carbon', 0.012);
    for (let z = 32; z < 35.2; z += 0.3) kit.box('darkMetal', [sx * 3.05, L.ROOF_Y + 0.06, z], [1.1, 0.04, 0.05], { bev: 0, ext: true });
  }
  kit.cyl('metal', [0, L.ROOF_Y + 0.4, 36.2], 0.3, 0.8, { seg: 16, ext: true }); kit.cyl('darkMetal', [0, L.ROOF_Y + 0.82, 36.2], 0.36, 0.05, { seg: 16, ext: true });

  // ───────── belly: raised skid/access panels, sensor housings (keep the ramp lane and leg bays clear) ─────────
  for (const x of [-2.7, 0, 2.7]) for (let z = 8.2; z < 23.5; z += 2.4) { if (Math.abs(x) < 0.1 && z > 22) continue; plate(x, L.KEEL_Y - 0.014, z, 1.5, 0.03, 2.0, 'hullW'); }
  for (const sx of [-1, 1]) { kit.sphere('darkMetal', [sx * 1.4, L.KEEL_Y - 0.01, 12], 0.26, { seg: 14, sy: 0.5, ext: true }); kit.sphere('darkMetal', [sx * 2.2, L.KEEL_Y - 0.01, 21], 0.2, { seg: 12, sy: 0.5, ext: true }); }
  for (const z of [7.5, 23.0]) kit.box('hazard', [0, L.KEEL_Y - 0.008, z], [2.4, 0.016, 0.2], { bev: 0, ext: true });
}
