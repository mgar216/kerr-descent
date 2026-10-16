// Dome deck: walkable floors, circular plating + inlay lines, collar/bench colliders, the curved seating ring (cushions, backrests, arm blocks, cup holders), props.
import * as THREE from 'three';
import { Acc, sweep, rr, orect, flatArc, flatSeg, inHole, TAU } from './dome_util.js';

const DEG = Math.PI / 180;
// bench segments (azimuth degrees from +x toward +z/aft; −90 = forward), aligned to the 22.5° collider sectors with 4° gaps. Open: forward/starboard (stair arrival) and aft (walkway round the stair well).
const BENCHES = [[-9.25, 31.75], [125.75, 166.75], [170.75, 211.75], [215.75, 256.75]];

export default function build(kit) {
  const L = kit.L, D = L.DOME, S = L.STAIR, cx = D.cx, cz = D.cz, DK = D.deckY, eur = kit.eur;
  const Y = DK + 0.0125;                                                                         // inlay height (2.5 mm above the plating)
  const skip = (x, z) => inHole(S, x, z, 0.14);
  const pol = (r, a, y = 0) => [cx + r * Math.cos(a), y, cz + r * Math.sin(a)];

  // ───────── walkable deck (rectangles; the collar colliders keep the circle) ─────────
  kit.floor(-2.45, 7.55, S.x0, 12.45, DK); kit.floor(S.x1, 7.55, 2.45, 12.45, DK); kit.floor(S.x0, S.holeZ1, S.x1, 12.45, DK); kit.floor(S.x0, 7.55, S.x1, S.holeZ0, DK);

  // ───────── circular plating with the stair opening cut out ─────────
  { const sh = new THREE.Shape(); sh.absarc(0, 0, 2.5, 0, TAU, false);
    const h = new THREE.Path(); [[S.x0, S.holeZ0], [S.x1, S.holeZ0], [S.x1, S.holeZ1], [S.x0, S.holeZ1]].forEach(([x, z], i) => (i ? h.lineTo(x - cx, cz - z) : h.moveTo(x - cx, cz - z))); h.closePath(); sh.holes.push(h);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: false, curveSegments: 72 });
    kit.add('floor', g, { pos: [cx, DK, cz], rot: [-Math.PI / 2, 0, 0] }); g.dispose(); }

  // ───────── inlay: cyan hairline + orange hairline (compass track), ticks, cardinal wedges — all open where the stair comes through ─────────
  { const A = new Acc(), O = new Acc(), T = new Acc(), W = new Acc();
    flatArc(A, cx, cz, 1.735, 1.752, 0, TAU, Y, 144, skip); flatArc(O, cx, cz, 1.985, 1.995, 0, TAU, Y, 144, skip);
    for (let k = 0; k < 72; k++) { const a = k * 5 * DEG, big = k % 6 === 0, p0 = pol(big ? 1.80 : 1.80, a), p1 = pol(big ? 1.93 : 1.86, a); if (skip((p0[0] + p1[0]) / 2, (p0[2] + p1[2]) / 2)) continue; flatSeg(T, p0[0], p0[2], p1[0], p1[2], big ? 0.011 : 0.006, Y); }
    for (const a of [0, 90, 180, 270].map((d) => d * DEG)) {                                      // cardinal wedges: starboard, aft, port, forward
      const yy = Y + 0.001, b = pol(2.0, a, yy), t = pol(2.05, a - 0.035, yy), u = pol(2.05, a + 0.035, yy), c = pol(1.93, a, yy); if (skip(b[0], b[2])) continue;
      W.quad(W.v(...c, 0, 1, 0), W.v(...t, 0, 1, 0), W.v(...b, 0, 1, 0), W.v(...u, 0, 1, 0));
    }
    kit.arrays('emitStrip', A.arrays); kit.arrays('emitStripO', O.arrays); kit.arrays('plastic', T.arrays); kit.arrays('paintOrange', W.arrays); }

  // ───────── seating ring: plinth (with under-glow), cushion, reclined backrest, arm blocks + cup holders ─────────
  const bench = (a0d, a1d) => {
    const a0 = a0d * DEG, a1 = a1d * DEG, n = Math.max(5, Math.round((a1d - a0d) / 4.5));
    kit.arrays('trim', sweep(rr(2.10, 2.46, DK, DK + 0.24, 0.012), a0, a1, n), { pos: [cx, 0, cz] });
    kit.arrays('emitStrip', sweep(rr(2.097, 2.1, DK + 0.1, DK + 0.112, 0), a0 + 0.02, a1 - 0.02, n), { pos: [cx, 0, cz] });
    kit.arrays('fabric', sweep(rr(2.06, 2.46, DK + 0.24, DK + 0.44, 0.045), a0, a1, n), { pos: [cx, 0, cz] });
    const lean = 12 * DEG, nn = [Math.cos(lean), -Math.sin(lean)], tt = [Math.sin(lean), Math.cos(lean)];
    kit.arrays('fabric', sweep(orect([2.355, DK + 0.64], nn, tt, 0.065, 0.065, 0.19, 0.04), a0 + 0.03, a1 - 0.03, n), { pos: [cx, 0, cz] });
    kit.arrays('darkMetal', sweep(rr(2.30, 2.46, DK + 0.43, DK + 0.45, 0.004), a0, a1, n), { pos: [cx, 0, cz] });   // frame rail between seat and back
  };
  for (const [a, b] of BENCHES) bench(a, b);
  const arm = (ad) => {                                                                              // arm block at the end of a segment
    const a = ad * DEG, [x, , z] = pol(2.27, a), yaw = Math.PI / 2 - a, top = DK + 0.5;
    kit.box('trim', [x, DK + 0.37, z], [0.12, 0.26, 0.42], { bev: 0.012, yaw });
    kit.box('metal', [x, top + 0.002, z], [0.125, 0.008, 0.2], { bev: 0.002, yaw });
    const [cxh, , czh] = pol(2.18, a); kit.torus('metal', [cxh, top + 0.012, czh], 0.036, 0.005, { seg: 14, tube: 6 }); kit.cyl('rubber', [cxh, top + 0.008, czh], 0.034, 0.008, { seg: 14 });
    const [lx, , lz] = pol(2.055, a); kit.box(kit.led(eur ? 'Red' : 'Cyan'), [lx, DK + 0.4, lz], [0.04, 0.012, 0.006], { bev: 0, yaw });
  };
  for (const a of [-11, 33.25, 124.25, 168.75, 213.75, 258.25]) arm(a);

  // ───────── colliders: the collar ring (16 boxes, pulled in to the bench front where a bench stands) ─────────
  for (let k = 0; k < 16; k++) {
    const th = (-90 + 22.5 * k) * DEG, td = -90 + 22.5 * k;
    const hasBench = BENCHES.some(([a, b]) => [-360, 0, 360].some((off) => td >= a + off - 2 && td <= b + off + 2));
    const rc = hasBench ? 2.04 : 2.44, dep = 0.55, len = 2 * rc * Math.tan(11.25 * DEG) * 1.14, [x, , z] = pol(rc + dep / 2, th);
    kit.colBox([x, 2.9, z], [len, 3.0, dep], { yaw: Math.PI / 2 - th, name: 'dome.wall' });
  }
}
