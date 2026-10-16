// Command module (flight deck exterior) + wraparound canopy: frame beams identical to the classic cockpit (core.js buildCockpit),
// glass panes, roof plate, pod lining walls, rear arch. The nose cone (z<-1) and the main fuselage (z>2.4) are hull.js.
import * as THREE from 'three';
import { extrudePoly } from './builder.js';

const V3 = THREE.Vector3;

export default function build(kit) {
  const L = kit.L, FLOOR = L.FLOOR, eur = kit.eur;
  kit.defMat('canopyFrame', { color: 0x14181d, rough: 0.62, metal: 0.5 });
  kit.defMat('canopyTrim', { color: 0x20262e, rough: 0.5, metal: 0.6 });

  // ───────── command-module skin (loft with a cut-out over the pod: the canopy sits in it) ─────────
  kit.loft('hull', [
    { z: -1.0,  w: 1.45, top: -0.50, bot: -1.50, rc: 0.40 },
    { z: -0.9,  w: 1.45, top: -0.34, bot: -1.50, rc: 0.30 },
    { z: 0.30,  w: 1.47, top: -0.27, bot: -1.50, rc: 0.30 },
    { z: 0.345, w: 1.50, top: -0.27, bot: -1.50, rc: 0.30 },
    { z: 0.365, w: 1.50, top: 0.90,  bot: -1.50, rc: 0.30 },
    { z: 1.2,   w: 2.45, top: 1.22,  bot: -1.50, rc: 0.45 },
    { z: 1.9,   w: 3.30, top: 1.50,  bot: -1.50, rc: 0.50 },
    { z: 2.4,   w: L.COMMAND_REAR.w, top: L.COMMAND_REAR.top, bot: L.COMMAND_REAR.bot, rc: L.COMMAND_REAR.rc },
  ], { caps: [false, false], sub: 4 });
  // remove the skin over the pod (canopy opening + walk-through to the bay)
  kit.cutRect(1, 0, -0.29, 1.27, 0.72, 0.04, -0.8, 1.3);

  // ───────── canopy frame (same beams as the classic cockpit) ─────────
  const bm = (mat, a, b, w, h, o = {}) => kit.beam(mat, a, b, w, h, { ext: true, bev: 0.012, ...o });
  for (const sx of [-1, 1]) {
    bm('canopyFrame', [sx * 1.02, -0.42, -0.95], [sx * 0.6, 0.72, -0.64], 0.085, 0.06);                      // A-pillar
    bm('emitStrip', [sx * 1.03, -0.4, -0.92], [sx * 0.615, 0.7, -0.62], 0.012, 0.064, { bev: 0 });           // cyan accent line on the pilot side
    bm('canopyFrame', [sx * 0.6, 0.72, -0.64], [sx * 0.78, 0.86, 0.35], 0.07, 0.05);                         // roof rail
    bm('canopyFrame', [sx * 1.02, -0.42, -0.95], [sx * 1.25, -0.2, 0.3], 0.09, 0.07);                        // side sill
  }
  const header = [[-0.6, 0.72, -0.64], [-0.2, 0.765, -0.66], [0.2, 0.765, -0.66], [0.6, 0.72, -0.64]];
  const sillC = [[-1.12, -0.42, -0.93], [-0.4, -0.43, -1.0], [0.4, -0.43, -1.0], [1.12, -0.42, -0.93]];
  for (let i = 0; i < 3; i++) { bm('canopyFrame', header[i], header[i + 1], 0.08, 0.06); bm('canopyTrim', sillC[i], sillC[i + 1], 0.07, 0.05); }
  // rear canopy arch (pod → bay opening): posts along the panes' rear edges + a header across the opening
  for (const sx of [-1, 1]) bm('canopyFrame', [sx * 1.22, -0.2, 0.36], [sx * 0.8, 0.86, 0.36], 0.08, 0.05);
  bm('canopyFrame', [-0.8, 0.87, 0.36], [0.8, 0.87, 0.36], 0.08, 0.06);
  // exterior sill gasket / outer trim strips (read as a seal around the glass from outside)
  for (const sx of [-1, 1]) {
    bm('rubber', [sx * 1.0, -0.4, -0.97], [sx * 0.585, 0.72, -0.665], 0.03, 0.02, { bev: 0.004 });
    bm('rubber', [sx * 1.27, -0.21, 0.28], [sx * 1.04, -0.43, -0.93], 0.035, 0.02, { bev: 0.004 });
  }

  // ───────── glass ─────────
  const glass = (grid, mat = 'glassDome') => {   // grid[j][i]: j rows (top→bottom), i columns
    const nr = grid.length, nc = grid[0].length, p = [], n = [], idx = [];
    for (const row of grid) for (const q of row) { p.push(q.x, q.y, q.z); n.push(0, 0, 1); }
    for (let j = 0; j < nr - 1; j++) for (let i = 0; i < nc - 1; i++) { const a = j * nc + i, b = a + 1, c = a + nc, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals();
    kit.add(mat, g, { ext: true }); g.dispose();
  };
  const hC = new THREE.CatmullRomCurve3(header.map((q) => new V3(...q))), sC = new THREE.CatmullRomCurve3([[-1.02, -0.42, -0.95], [-0.4, -0.43, -1.0], [0.4, -0.43, -1.0], [1.02, -0.42, -0.95]].map((q) => new V3(...q)));
  {
    const N = 14, rows = 4, grid = [];
    for (let j = 0; j < rows; j++) { const v = j / (rows - 1); const r = []; for (let i = 0; i <= N; i++) r.push(hC.getPoint(i / N).lerp(sC.getPoint(i / N), v)); grid.push(r); }
    glass(grid);
  }
  for (const sx of [-1, 1]) {
    const P00 = new V3(sx * 1.02, -0.42, -0.95), P10 = new V3(sx * 0.6, 0.72, -0.64), P11 = new V3(sx * 0.78, 0.86, 0.35), P01 = new V3(sx * 1.25, -0.2, 0.3);
    const grid = []; for (let j = 0; j <= 4; j++) { const v = j / 4, r = []; for (let i = 0; i <= 6; i++) { const u = i / 6; r.push(P10.clone().lerp(P11, u).lerp(P00.clone().lerp(P01, u), v)); } grid.push(r); }
    glass(grid);
  }

  // ───────── roof plate (trapezoid slab over the pilot) ─────────
  {
    const top = (x, z) => new V3(x, 0.745 + 0.1414 * (z + 0.64), z);
    const T = [top(-0.62, -0.64), top(0.62, -0.64), top(0.8, 0.35), top(-0.8, 0.35)], th = 0.06;
    const B = T.map((q) => new V3(q.x, q.y - th, q.z));
    const face = (mat, a, b, c, d, up) => {
      const nn = new V3().crossVectors(new V3().subVectors(b, a), new V3().subVectors(d, a)).normalize(); if (nn.dot(up) < 0) nn.negate();
      const p = [a, b, c, d].flatMap((q) => [q.x, q.y, q.z]), n = [0, 1, 2, 3].flatMap(() => [nn.x, nn.y, nn.z]);
      const e1 = new V3().subVectors(b, a), e2 = new V3().subVectors(c, a);
      kit.arrays(mat, { p, n, idx: e1.cross(e2).dot(nn) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2] }, { ext: true });
    };
    face('hullW', T[0], T[1], T[2], T[3], new V3(0, 1, 0)); face('wallDark', B[0], B[1], B[2], B[3], new V3(0, -1, 0));
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; const mid = new V3().addVectors(T[i], T[j]).multiplyScalar(0.5); face('canopyTrim', T[i], T[j], B[j], B[i], new V3(mid.x, 0, mid.z * 0.3)); }
  }

  // ───────── pod lining walls (below the sill; the dash console is flightdeck.js) + colliders ─────────
  for (const sx of [-1, 1]) {
    const g = extrudePoly([[-1.0, FLOOR], [0.35, FLOOR], [0.35, -0.2], [-1.0, -0.42]], 0.15, 0.004);
    kit.add('wall', g, { pos: [sx * 1.325, 0, 0], rot: [0, -Math.PI / 2, 0] }); g.dispose();
    kit.colBox([sx * 1.325, -0.55, -0.325], [0.15, 1.5, 1.35]);
    kit.box('trim', [sx * 1.245, FLOOR + 0.06, -0.325], [0.024, 0.12, 1.35], { bev: 0.004 });
    kit.box('paintOrange', [sx * 1.248, -0.75, -0.2], [0.012, 0.06, 1.0], { bev: 0.002 });
  }
  // pod front closure under the dash is part of the console; keep the nose interior sealed:
  kit.box('wallDark', [0, -1.35, -0.99], [2.5, 0.3, 0.04], { bev: 0.004 });

  // ───────── exterior details on the command module ─────────
  for (const sx of [-1, 1]) {
    bm('metal', [sx * 1.38, -0.2, -0.75], [sx * 1.38, -0.2, -0.05], 0.03, 0.03, { bev: 0.01 });                  // grab rail on the cheek deck
    for (const z of [-0.72, -0.4, -0.08]) bm('darkMetal', [sx * 1.38, -0.28, z], [sx * 1.38, -0.2, z], 0.04, 0.03, { bev: 0.005 });
    bm('paintOrange', [sx * 1.45, -0.9, -0.8], [sx * 1.47, -0.9, 0.3], 0.012, 0.09, { bev: 0.002 });            // livery stripe on the pod flank
    bm('paintCyan', [sx * 1.452, -1.02, -0.8], [sx * 1.472, -1.02, 0.3], 0.012, 0.035, { bev: 0.002 });
    kit.cyl('darkMetal', [sx * 1.15, 1.235, 1.1], 0.16, 0.05, { seg: 16, ext: true });                      // roof sensor blister (sits on the skin, outside the cabin)
    kit.sphere('darkMetal', [sx * 1.15, 1.26, 1.1], 0.12, { seg: 14, sy: 0.65, ext: true });
  }
  kit.hullColliders.push({ min: [-1.5, -1.5, -1.0], max: [1.5, -0.2, 0.4] }, { min: [-1.2, -0.4, -1.0], max: [1.2, 0.9, 0.4] }, { min: [-3.3, -1.5, 0.36], max: [3.3, 1.6, 2.4] });
}
