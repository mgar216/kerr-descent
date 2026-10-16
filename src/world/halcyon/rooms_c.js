// HALCYON interior C — the observation lounge (a bowed window of real openings onto the ray-traced sky, facing
// Erebus = ship −Z) with the EURYDICE memorial wall, seating, bar, library shelves and plants.
import { FY } from './plan.js';

export function buildLounge(P, T, env) {
  const { THREE, G } = env;
  const { bk, glowBox, fixture, lbox, lcol, frameOf } = P;
  const out = { spots: {} };
  const LX0 = -94, LX1 = -54, LZ0 = -6.6, LZB = -36, CYL = 8.6, CX = -74, A = 20, Bz = 18, N = 12;
  const pts = [];
  for (let k = 0; k <= N; k++) { const th = Math.PI + (k * Math.PI) / N; pts.push([CX + A * Math.cos(th), LZB + Bz * Math.sin(th)]); }

  // ── walls (west carries the memorial, east the bar) ──
  P.wallAlongZ(LX0 - 0.6, LX0, LZB, LZ0 + 0.01, FY, CYL + 0.4, { neg: 'trim', pos: 'lounge' });
  P.wallAlongZ(LX1, LX1 + 0.6, LZB, LZ0 + 0.01, FY, CYL + 0.4, { neg: 'lounge', pos: 'trim' });
  // the shared south wall (built to the ops ceiling) continues up to the lounge ceiling
  P.wallAlongX(-6.6, -6.0, LX0 - 0.6, LX1 + 0.6, 6.8, CYL + 0.4, { neg: 'lounge', pos: 'trim', noCol: true });
  P.rooms.push({ id: 'lounge', name: 'Observation Lounge', min: [LX0, FY, -54], max: [LX1, CYL, LZ0] });

  // ── floor: planks (rectangle + fan into the bay) and walkable strips ──
  P.floor('planks', LX0, LZB, LX1, LZ0, FY, { faces: 'py', tile: [4, 4] });
  {
    const B = bk('planks'), W = [1, 1, 1];
    for (let k = 0; k < N; k++) {
      const a = pts[k], b = pts[k + 1];
      B.quad([CX, FY, LZB], [b[0], FY, b[1]], [a[0], FY, a[1]], [a[0], FY, a[1]], [[CX / 4, LZB / 4], [b[0] / 4, b[1] / 4], [a[0] / 4, a[1] / 4], [a[0] / 4, a[1] / 4]], W);
    }
    const C = bk('wood'), CW = [0.95, 0.85, 0.72];
    for (let k = 0; k < N; k++) {
      const a = pts[k], b = pts[k + 1];
      C.quad([CX, CYL, LZB], [a[0], CYL, a[1]], [b[0], CYL, b[1]], [b[0], CYL, b[1]], [[CX / 2, LZB / 2], [a[0] / 2, a[1] / 2], [b[0] / 2, b[1] / 2], [b[0] / 2, b[1] / 2]], CW);
    }
    // walkable strips following the ellipse (inset 0.35 m)
    for (let z = LZB; z > LZB - Bz + 0.2; z -= 1.5) {
      const zf = Math.max(z - 1.5, LZB - Bz), ez = (zf - LZB) / Bz, half = A * Math.sqrt(Math.max(0, 1 - ez * ez)) - 0.35;
      if (half > 0.5) P.floorRect(CX - half, zf, CX + half, z, FY);
    }
  }
  P.ceilRect('ceilWood', LX0, LZB, LX1, LZ0, CYL);
  // collision along the bow: little AABBs hugging each facet (3 per facet)
  for (let k = 0; k < N; k++) {
    const a = pts[k], b = pts[k + 1];
    for (let s = 0; s < 3; s++) {
      const t0 = s / 3, t1 = (s + 1) / 3, x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1;
      P.col(Math.min(x0, x1) - 0.3, FY, Math.min(z0, z1) - 0.3, Math.max(x0, x1) + 0.3, 3.2, Math.max(z0, z1) + 0.15, { wall: false });
    }
  }
  // ── window frame: sills, headers, mullions, one transom ──
  for (let k = 0; k < N; k++) {
    const a = pts[k], b = pts[k + 1];
    bk('metal').strut([a[0], FY + 0.3, a[1]], [b[0], FY + 0.3, b[1]], 0.5, 0.6, { col: [0.1, 0.1, 0.12] });
    bk('wood').strut([a[0], FY + 0.64, a[1]], [b[0], FY + 0.64, b[1]], 0.62, 0.06, { col: [1, 0.9, 0.75] });
    bk('metal').strut([a[0], CYL - 0.4, a[1]], [b[0], CYL - 0.4, b[1]], 0.5, 0.8, { col: [0.1, 0.1, 0.12] });
    bk('metal').strut([a[0], 3.6, a[1]], [b[0], 3.6, b[1]], 0.14, 0.14, { col: [0.1, 0.1, 0.12] });
  }
  for (const p of pts) bk('metal').box(p[0] - 0.14, FY, p[1] - 0.14, p[0] + 0.14, CYL, p[1] + 0.14, { col: [0.1, 0.1, 0.12], tile: 1 });
  // the bow's ceiling edge cove (warm) + sill light
  for (let k = 0; k < N; k++) { const a = pts[k], b = pts[k + 1]; bk('glow').strut([a[0], CYL - 0.82, a[1]], [b[0], CYL - 0.82, b[1]], 0.08, 0.05, { col: [2.4, 1.3, 0.55] }); }

  // ── memorial wall (west) ──
  {
    const mat = new THREE.MeshStandardMaterial({ map: T.memorial, emissiveMap: T.memorial, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.8, metalness: 0 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), mat);
    m.position.set(LX0 + 0.08, 3.25, -22); m.rotation.y = Math.PI / 2; m.name = 'memorial';
    env.add(m); out.memorial = m;
    bk('solid').box(LX0, FY, -29.4, LX0 + 0.06, 6.4, -14.6, { col: [0.03, 0.033, 0.04], tile: 1 });
    // shelf + the lantern (the light they leave on)
    bk('wood').box(LX0 + 0.06, -0.86, -23.2, LX0 + 0.95, -0.78, -20.8, { col: [0.9, 0.75, 0.55], tile: 2 });
    const lx = LX0 + 0.5, lz = -22;
    bk('metal').cyl([lx, -0.78, lz], [lx, -0.74, lz], 0.17, 0.17, 14, { col: [0.5, 0.4, 0.25] });
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.78; bk('metal').cyl([lx + Math.cos(a) * 0.15, -0.74, lz + Math.sin(a) * 0.15], [lx + Math.cos(a) * 0.15, -0.28, lz + Math.sin(a) * 0.15], 0.012, 0.012, 5, { col: [0.5, 0.4, 0.25] }); }
    bk('metal').cyl([lx, -0.28, lz], [lx, -0.21, lz], 0.05, 0.17, 14, { col: [0.5, 0.4, 0.25] });
    bk('glow').sphere([lx, -0.5, lz], 0.115, { col: [4.2, 2.5, 0.8], ws: 14, hs: 10 });
    for (let k = 0; k < 9; k++) bk('glow').sphere([LX0 + 0.82, -0.78 + 0.03, -23.0 + k * 0.25], 0.025, { col: [2.6, 1.5, 0.5], ws: 6, hs: 4 });
    P.col(LX0, FY, -23.4, LX0 + 1.0, -0.7, -20.6);
    P.bench(-91.4, -28.4, FY, '-x', 2.4); P.bench(-91.4, -15.6, FY, '-x', 2.4);
    P.sign('memorial', LX0 + 0.05, 5.9, -22, '+x', 4.6);
    fixture(-92.6, 1.6, -22, [1.0, 0.7, 0.38], 46, 12, 'lounge'); fixture(-91, 4.4, -16, [1.0, 0.78, 0.55], 38, 12, 'lounge'); fixture(-91, 4.4, -28, [1.0, 0.78, 0.55], 38, 12, 'lounge');
    out.spots.memorial = [LX0 + 0.9, 0.7, -22];
  }

  // ── seating group facing the window + rug ──
  {
    const rugs = [[8.8, [0.1, 0.2, 0.24]], [8.3, [0.85, 0.65, 0.4]], [8.0, [0.1, 0.2, 0.24]], [5.6, [0.55, 0.2, 0.08]], [5.35, [0.1, 0.2, 0.24]], [2.2, [0.6, 0.3, 0.1]]];
    rugs.forEach(([r, c], i) => bk('fabric').cyl([CX, FY + 0.004 + i * 0.0015, -27.5], [CX, FY + 0.01 + i * 0.0015, -27.5], r, r, 56, { col: c }));
    P.sofa(CX, -22.2, FY, '-z', { w: 4.2 });
    P.sofa(CX - 6.6, -27.4, FY, '+x', { w: 2.8 }); P.sofa(CX + 6.6, -27.4, FY, '-x', { w: 2.8 });
    P.table(CX, -27.2, FY, 2.4, 1.0, 0.42);
    // chairs near the glass
    P.sofa(CX - 12.5, -38.6, FY, '-z', { w: 1.5, col: [0.22, 0.12, 0.08], col2: [0.3, 0.17, 0.1] }); P.sofa(CX + 12.5, -38.6, FY, '-z', { w: 1.5, col: [0.22, 0.12, 0.08], col2: [0.3, 0.17, 0.1] });
    P.table(CX - 12.5, -35.4, FY, 1.0, 0.7, 0.4); P.table(CX + 12.5, -35.4, FY, 1.0, 0.7, 0.4);
    // library shelves along the south wall (west of the arch)
    for (let k = 0; k < 6; k++) {
      const x0 = -93.4 + k * 3.0;
      bk('wood').box(x0, FY, LZ0 - 0.02 - 0.42, x0 + 2.8, 2.2, LZ0 - 0.02, { col: [0.62, 0.42, 0.26], tile: 2 });
      for (let s = 0; s < 5; s++) {
        const y = FY + 0.35 + s * 0.36;
        let bx = x0 + 0.08;
        const rr = G.rng(k * 11 + s * 5 + 3);
        while (bx < x0 + 2.7) { const w = 0.05 + rr() * 0.08, h = 0.22 + rr() * 0.1, c = [0.2 + rr() * 0.6, 0.15 + rr() * 0.45, 0.1 + rr() * 0.4]; bk('solid').box(bx, y, LZ0 - 0.4, bx + w, y + h, LZ0 - 0.06, { col: c, tile: 1 }); bx += w + 0.004; }
        bk('wood').box(x0 + 0.04, y - 0.04, LZ0 - 0.42, x0 + 2.76, y, LZ0 - 0.04, { col: [0.5, 0.33, 0.2], tile: 2 });
      }
      P.col(x0, FY, LZ0 - 0.42, x0 + 2.8, 2.2, LZ0);
    }
    // bar along the east wall
    {
      const bx = LX1 - 0.4;
      bk('wood').box(bx - 1.0, FY, -30, bx, -0.12, -14, { col: [0.55, 0.36, 0.22], tile: 2 });
      bk('wood').box(bx - 1.12, -0.12, -30.1, bx + 0.02, -0.06, -13.9, { col: [0.85, 0.7, 0.5], tile: 2 });
      P.col(bx - 1.12, FY, -30.1, bx + 0.02, -0.06, -13.9);
      for (let k = 0; k < 5; k++) { const z = -28 + k * 3.2; bk('metal').cyl([bx - 1.75, FY, z], [bx - 1.75, FY + 0.62, z], 0.05, 0.05, 8, { col: [0.5, 0.45, 0.4] }); bk('fabric').cyl([bx - 1.75, FY + 0.6, z], [bx - 1.75, FY + 0.7, z], 0.22, 0.22, 16, { col: [0.5, 0.18, 0.1] }); }
      // back-bar shelves + bottles + coffee machine
      bk('wood').box(LX1 - 0.3, 0.3, -30, LX1 - 0.02, 0.36, -14, { col: [0.55, 0.36, 0.22], tile: 2 }); bk('wood').box(LX1 - 0.3, 1.2, -30, LX1 - 0.02, 1.26, -14, { col: [0.55, 0.36, 0.22], tile: 2 });
      const rr = G.rng(99);
      for (let k = 0; k < 24; k++) { const z = -29.6 + k * 0.66, y = k % 2 ? 0.36 : 1.26, c = [0.3 + rr() * 1.8, 0.2 + rr() * 1.2, 0.1 + rr() * 0.6]; bk('glow').cyl([LX1 - 0.16, y, z], [LX1 - 0.16, y + 0.28, z], 0.045, 0.045, 6, { col: c }); }
      bk('metal').box(LX1 - 0.7, -0.06, -21.4, LX1 - 0.15, 0.55, -20.4, { col: [0.15, 0.17, 0.2], tile: 1 }); bk('glow').box(LX1 - 0.72, 0.25, -21.3, LX1 - 0.7, 0.33, -20.5, { col: [0.2, 1.6, 0.9], faces: 'nx' });
      fixture(-58.5, 3.4, -22, [1.0, 0.8, 0.58], 46, 13, 'lounge');
    }
    // plants
    for (const [x, z, h] of [[-92.6, -9.2, 1.9], [-92.8, -34, 2.0], [-55.5, -34.2, 2.1], [-55.4, -9.4, 1.7], [-64, -9.2, 1.4], [-84, -9.2, 1.5], [-62, -44, 1.5], [-86.5, -44, 1.5], [-78.5, -23.6, 1.0], [-69.6, -23.6, 1.0]]) P.plant(x, z, FY, h, { leaves: 18, pot: 0.36, potH: 0.6, potCol: [0.3, 0.26, 0.24] });
    // floor + pendant lamps
    for (const [x, z] of [[-91.5, -12], [-56.5, -33], [-89, -33.5]]) P.lamp(x, z, FY, { h: 1.7 });
    for (const [x, z] of [[-80, -20], [-68, -20], [-74, -30], [-84, -30], [-64, -30]]) {
      bk('metal').cyl([x, 5.6, z], [x, CYL, z], 0.012, 0.012, 5, { col: [0.15, 0.15, 0.17] });
      bk('glow').sphere([x, 5.2, z], 0.38, { col: [3.0, 1.85, 0.85], ws: 14, hs: 10 });
      bk('metal').cyl([x, 5.55, z], [x, 5.62, z], 0.1, 0.1, 10, { col: [0.15, 0.15, 0.17] });
    }
    // telescope on a tripod near the glass
    {
      const tx = -78.5, tz = -48.6;
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.4; bk('metal').strut([tx, 1.0 + FY, tz], [tx + Math.cos(a) * 0.6, FY, tz + Math.sin(a) * 0.6], 0.035, 0.035, { col: [0.35, 0.35, 0.38] }); }
      bk('metal').cyl([tx, 0.0, tz - 0.9], [tx, 0.55, tz + 0.9], 0.12, 0.09, 14, { col: [0.7, 0.68, 0.62] });
      bk('metal').cyl([tx, 0.5, tz + 0.9], [tx, 0.5, tz + 0.96], 0.1, 0.1, 14, { col: [0.1, 0.12, 0.2] });
      P.col(tx - 0.5, FY, tz - 0.5, tx + 0.5, 0.9, tz + 0.5);
      out.spots.telescope = [tx, 0.4, tz];
    }
    out.spots.window = [-74, 0.8, -50.2];
    out.spots.mira = [-70.2, FY, -49.6];
  }

  // ── Erebus light spilling through the glass onto the floor (additive, cheap) ──
  {
    const tex = G.glowTex(256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.95, 0.42, 0.14), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(CX, FY + 0.02, -42); m.renderOrder = 4; m.name = 'erebusSpill';
    env.add(m);
  }
  fixture(-74, 5.6, -17, [1.0, 0.76, 0.52], 100, 26, 'lounge'); fixture(-86, 5.2, -26, [1.0, 0.78, 0.56], 76, 20, 'lounge'); fixture(-62, 5.2, -26, [1.0, 0.78, 0.56], 76, 20, 'lounge');
  fixture(-74, 3.4, -45, [1.0, 0.55, 0.24], 90, 22, 'lounge'); fixture(-74, 5.0, -38, [1.0, 0.7, 0.4], 60, 18, 'lounge');
  return out;
}
