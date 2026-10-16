// Dorsal observation dome: glass hemisphere, structural frame (meridian ribs + latitude rings + apex cap), collar, bezel, exterior fairing + lights.
import * as THREE from 'three';
import { bevelBoxArrays } from './builder.js';
import { sweep, orect, rr, frameM, TAU } from './dome_util.js';

const DEG = Math.PI / 180, V3 = THREE.Vector3;
const RIB_AZ = Array.from({ length: 12 }, (_, k) => (-75 + 30 * k) * DEG);   // cardinal directions fall mid-panel
const RING_E = [18, 38, 56, 72].map((d) => d * DEG);                          // latitude rings (elevation above the springline)

export default function build(kit) {
  const D = kit.L.DOME, cx = D.cx, cz = D.cz, R = D.r, Y0 = D.collarY, deck = D.deckY;
  const about = (mat, arr, o = {}) => kit.arrays(mat, arr, { pos: [cx, 0, cz], ...o });   // solids of revolution about the dome axis
  const X = { ext: true }, up = new V3(0, 1, 0), C = new V3(cx, Y0, cz);

  // ───────── glass (stays nearly invisible) ─────────
  { const g = new THREE.SphereGeometry(R, 72, 24, 0, TAU, 0, Math.PI / 2); kit.add('glassDome', g, { pos: [cx, Y0, cz], ext: true }); g.dispose(); }

  // ───────── collar band (deck → springline), bezel ring that clamps the glass, exterior fairing ─────────
  about('wallDark', sweep(rr(2.46, R, deck, Y0, 0), 0, TAU, 72));
  about('trim', sweep(rr(2.5, 2.72, Y0, Y0 + 0.135, 0.014), 0, TAU, 72), X);
  about('metal', sweep(rr(2.53, 2.575, Y0 + 0.127, Y0 + 0.14, 0), 0, TAU, 72), X);
  about('metal', sweep(rr(2.625, 2.69, Y0 + 0.127, Y0 + 0.14, 0), 0, TAU, 72), X);
  kit.torus('rubber', [cx, Y0 + 0.139, cz], R - 0.002, 0.013, { seg: 72, tube: 5, ext: true });                       // glass seal
  const FS = [[3.30, 1.612], [3.18, 1.640], [3.00, 1.672], [2.86, 1.716], [2.77, 1.780], [2.72, 1.840]];            // outer slope, outboard → inboard
  about('hullW', sweep([[2.6, 1.585], [3.30, 1.585], ...FS, [2.6, 1.84]], 0, TAU, 72), X);
  about('carbon', sweep(rr(3.29, 3.37, 1.592, 1.624, 0.006), 0, TAU, 72), X);                                           // gasket where the fairing meets the roof skin
  const onSlope = (r) => {                                                                                               // surface point + frame on the fairing slope
    for (let i = 0; i < FS.length - 1; i++) {
      const a = FS[i], b = FS[i + 1]; if (r > a[0] || r < b[0]) continue;
      const k = (a[0] - r) / (a[0] - b[0]), dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy);
      return { P: [r, a[1] + dy * k], t: [dr / l, dy / l], n: [dy / l, -dr / l] };
    }
    return null;
  };
  { const s = onSlope(3.09); about('paintOrange', sweep(orect(s.P, s.n, s.t, 0, 0.0045, 0.03, 0), 0, TAU, 72), X); }       // orange hull stripe
  { const s = onSlope(2.93), prof = orect(s.P, s.n, s.t, 0, 0.004, 0.02, 0);                                              // cyan base lights, one per rib
    for (const az of RIB_AZ) about('emitStrip', sweep(prof, az - 5 * DEG, az + 5 * DEG, 4), X); }
  for (let k = 0; k < 4; k++) {                                                                                          // status LEDs on the fairing
    const a = (45 + 90 * k) * DEG, s = onSlope(3.12), r = 3.12;
    kit.box(kit.led(k % 2 ? 'Green' : 'Amber', k === 2 ? 'Blink' : ''), [cx + r * Math.cos(a), s.P[1] + 0.008, cz + r * Math.sin(a)], [0.04, 0.012, 0.04], { bev: 0, yaw: Math.PI / 2 - a, ext: true });
  }
  for (let k = 0; k < 48; k++) {                                                                                         // bezel bolts (skip the ribs)
    if (k % 4 === 0) continue; const a = k * 7.5 * DEG - 75 * DEG + 0; const x = cx + 2.657 * Math.cos(a), z = cz + 2.657 * Math.sin(a);
    kit.cyl('darkMetal', [x, Y0 + 0.143, z], 0.011, 0.008, { seg: 6, ext: true });
  }

  // ───────── structural frame ─────────
  const E0 = 2 * DEG, E1 = 79 * DEG;
  for (const phi of RIB_AZ) {                                                       // meridian ribs (thin: views stay open)
    const M = frameM(C, new V3(Math.cos(phi), 0, Math.sin(phi)), new V3(Math.sin(phi), 0, -Math.cos(phi)), up);
    kit.arrays('trim', sweep(orect([R, 0], [1, 0], [0, 1], 0.03, 0.05, 0.0225, 0.006), E0, E1, 14), { matrix: M, ext: true });
    kit.arrays('metal', sweep(orect([R + 0.052, 0], [1, 0], [0, 1], 0.004, 0.004, 0.011, 0), E0, E1, 14), { matrix: M, ext: true });
  }
  for (const e of RING_E) {                                                         // latitude rings + panel clips at every junction
    const Pc = [R * Math.cos(e), Y0 + R * Math.sin(e)], n = [Math.cos(e), Math.sin(e)], t = [-Math.sin(e), Math.cos(e)];
    about('trim', sweep(orect(Pc, n, t, 0.03, 0.05, 0.025, 0.006), 0, TAU, 72), X);
    about('metal', sweep(orect([Pc[0] + n[0] * 0.052, Pc[1] + n[1] * 0.052], n, t, 0.004, 0.004, 0.012, 0), 0, TAU, 72), X);
    for (const phi of RIB_AZ) {
      const u = new V3(Math.cos(phi), 0, Math.sin(phi)), nO = u.clone().multiplyScalar(Math.cos(e)).addScaledVector(up, Math.sin(e)), tm = u.clone().multiplyScalar(-Math.sin(e)).addScaledVector(up, Math.cos(e));
      kit.arrays('metal', bevelBoxArrays(0.105, 0.105, 0.014, 0.004), { matrix: frameM(C.clone().addScaledVector(nO, R + 0.056), new V3(Math.sin(phi), 0, -Math.cos(phi)), tm, nO), ext: true });
    }
  }
  for (let k = 0; k < 12; k++) {                                                    // discreet down-lights hung on the inner face of the lowest ring, between the ribs (some dead on EURYDICE)
    if (kit.eur && k % 3 === 1) continue;
    const a = RIB_AZ[k] + 15 * DEG, r = 2.43, x = cx + r * Math.cos(a), z = cz + r * Math.sin(a), y = Y0 + R * Math.sin(RING_E[0]) - 0.03;
    kit.cyl('trim', [x, y, z], 0.03, 0.04, { seg: 10 }); kit.cyl('emitWarm', [x, y - 0.0205, z], 0.021, 0.004, { seg: 10 });
  }

  // ───────── apex cap: dark lens-shaped cap, brushed ring, red beacon outside, sensor eye + light ring inside ─────────
  about('trim', sweep([[0, 2.50], [0.56, 2.50], [0.585, 2.535], [0.52, 2.585], [0.32, 2.628], [0.14, 2.648], [0, 2.655]].map(([r, y]) => [r, Y0 + y]), 0, TAU, 48), X);
  about('metal', sweep(rr(0.27, 0.33, Y0 + 2.622, Y0 + 2.634, 0.003), 0, TAU, 48), X);
  kit.box(kit.led('Red', 'Blink'), [cx, Y0 + 2.668, cz], [0.034, 0.022, 0.034], { bev: 0, ext: true });
  for (let k = 0; k < 8; k++) about('emitStrip', sweep(rr(0.385, 0.397, Y0 + 2.494, Y0 + 2.5, 0), (k * 45 + 8) * DEG, (k * 45 + 37) * DEG, 6));   // eight dashes, not a neon ring
  kit.cyl('plasticDark', [cx, Y0 + 2.47, cz], 0.075, 0.06, { seg: 16 });
  kit.cyl('emitCyan', [cx, Y0 + 2.437, cz], 0.035, 0.006, { seg: 12 });

  // ───────── collar interior: soft light lines + panel seams ─────────
  about('emitStrip', sweep(rr(2.452, 2.46, deck + 0.2, deck + 0.212, 0), 0, TAU, 72));
  about('emitStripO', sweep(rr(2.455, 2.46, Y0 - 0.052, Y0 - 0.046, 0), 0, TAU, 72));
  for (let k = 0; k < 16; k++) {
    const a = k * 22.5 * DEG + 11.25 * DEG, r = 2.455;
    kit.box('trim', [cx + r * Math.cos(a), (deck + Y0) / 2 - 0.02, cz + r * Math.sin(a)], [0.016, 0.3, 0.012], { bev: 0.002, yaw: Math.PI / 2 - a });
  }
}
