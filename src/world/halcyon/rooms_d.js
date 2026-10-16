// HALCYON interior D — the science lab: a holographic Erebus on the central table, benches and instruments,
// cold storage, Dr. Varga's whiteboard and the live Sentinel (Charon) feed of Eurydice's frozen image.
import { FY } from './plan.js';

export function buildLab(P, T, env) {
  const { THREE, G } = env;
  const { bk, glowBox, lightPanel, fixture, lbox, lcol, frameOf } = P;
  const out = { spots: {} };
  const X0 = -96, X1 = -54, Z0 = 38.6, Z1 = 68, CY = 4.8;
  const BT = -0.35;      // bench top

  // ── shell ──
  P.wallAlongZ(X0 - 0.6, X0, Z0 - 0.6, Z1 + 0.6, FY, CY + 0.4, { neg: 'trim', pos: 'lab' });
  P.wallAlongZ(X1, X1 + 0.6, Z0 - 0.6, Z1 + 0.6, FY, CY + 0.4, { neg: 'lab', pos: 'trim' });
  P.wallAlongX(Z1, Z1 + 0.6, X0 - 0.6, X1 + 0.6, FY, CY + 0.4, { neg: 'lab', pos: 'trim' });
  P.floor('deck', X0, Z0 - 0.6, X1, Z1, FY, { faces: 'py', col: [1.25, 1.3, 1.38] });
  P.ceilRect('ceil', X0, Z0 - 0.6, X1, Z1, CY);
  P.rooms.push({ id: 'lab', name: 'Science Laboratory', min: [X0, FY, Z0], max: [X1, CY, Z1] });
  // wainscot + ceiling cove + light panels
  for (const [x0, z0, x1, z1, f] of [[X0, Z0, X0 + 0.04, Z1, 'px'], [X1 - 0.04, Z0, X1, Z1, 'nx'], [X0, Z1 - 0.04, X1, Z1, 'nz']]) {
    bk('solid').box(x0, FY, z0, x1, FY + 0.9, z1, { col: [0.55, 0.62, 0.7], tile: 1, faces: f });
    bk('solid').box(x0, FY + 0.9, z0, x1, FY + 0.95, z1, { col: [0.1, 0.5, 0.62], tile: 1, faces: f });
  }
  for (const x of [-88, -75, -62]) for (const z of [43.5, 52, 61]) lightPanel(x - 2.2, z - 1.0, x + 2.2, z + 1.0, CY, [3.3, 3.5, 3.7]);

  // ── west bench with instruments ──
  {
    bk('solid').box(X0, FY, 41.5, X0 + 1.5, BT, 66, { col: [0.62, 0.68, 0.74], tile: 1 });
    bk('metal').box(X0, BT, 41.5, X0 + 1.55, BT + 0.05, 66, { col: [0.88, 0.9, 0.92], tile: 1 });
    P.col(X0, FY, 41.5, X0 + 1.55, BT + 0.05, 66);
    const bx = X0 + 0.8;
    for (const z of [44.5, 51]) {                                   // microscopes
      bk('metal').box(bx - 0.18, BT + 0.05, z - 0.14, bx + 0.18, BT + 0.12, z + 0.14, { col: [0.2, 0.22, 0.26], tile: 1 });
      bk('metal').cyl([bx + 0.12, BT + 0.1, z], [bx + 0.12, BT + 0.62, z], 0.035, 0.035, 8, { col: [0.82, 0.84, 0.86] });
      bk('metal').cyl([bx + 0.12, BT + 0.55, z], [bx - 0.1, BT + 0.36, z], 0.045, 0.045, 10, { col: [0.82, 0.84, 0.86] });
      bk('metal').cyl([bx - 0.1, BT + 0.36, z], [bx - 0.1, BT + 0.14, z], 0.03, 0.03, 8, { col: [0.1, 0.1, 0.12] });
    }
    bk('metal').cyl([bx, BT + 0.05, 56.5], [bx, BT + 0.4, 56.5], 0.32, 0.32, 20, { col: [0.78, 0.8, 0.84] });  // centrifuge
    bk('glow').cyl([bx, BT + 0.4, 56.5], [bx, BT + 0.42, 56.5], 0.26, 0.26, 20, { col: [0.2, 1.6, 2.0] });
    for (const z of [60.2, 63.6]) {                                 // analyzers with screens
      bk('metal').box(bx - 0.4, BT + 0.05, z - 0.7, bx + 0.4, BT + 0.9, z + 0.7, { col: [0.85, 0.87, 0.9], tile: 1 });
      P.wallScreen(z > 62 ? 11 : 6, bx + 0.405, BT + 0.5, z, '+x', 1.0, 0.55);
    }
    for (const z of [47.8, 53.6]) for (let k = 0; k < 9; k++) {      // sample racks
      const c = [0.2 + (k % 3) * 0.6, 0.6 + (k % 2) * 0.4, 0.9 - (k % 4) * 0.2];
      bk('glow').cyl([bx - 0.3 + (k % 3) * 0.3, BT + 0.05, z + ((k / 3) | 0) * 0.16 - 0.16], [bx - 0.3 + (k % 3) * 0.3, BT + 0.28, z + ((k / 3) | 0) * 0.16 - 0.16], 0.035, 0.035, 6, { col: c });
    }
    for (let k = 0; k < 3; k++) bk('wood').box(X0, 1.7, 42 + k * 7.5, X0 + 0.5, 1.76, 48.6 + k * 7.5, { col: [0.82, 0.84, 0.88], tile: 1 });
    for (let k = 0; k < 9; k++) bk('glow').cyl([X0 + 0.25, 1.76, 42.6 + k * 2.4], [X0 + 0.25, 2.05, 42.6 + k * 2.4], 0.07, 0.07, 8, { col: [0.4 + (k % 2) * 0.4, 1.6 - (k % 3) * 0.3, 0.5] });
    P.sign('lab', X0 + 0.02, 3.9, 54, '+x', 3.4);
  }

  // ── east wall: cold storage + whiteboard ──
  {
    for (let k = 0; k < 4; k++) {
      const z = 42 + k * 3.5;
      bk('metal').box(X1 - 1.3, FY, z, X1, 1.2, z + 3.2, { col: [0.82, 0.86, 0.9], tile: 1 });
      bk('glow').box(X1 - 1.32, -0.6, z + 0.25, X1 - 1.3, 0.9, z + 2.95, { col: [0.1, 0.34, 0.52], faces: 'nx' });
      bk('metal').box(X1 - 1.34, 0.2, z + 1.55, X1 - 1.3, 0.28, z + 1.65, { col: [0.2, 0.22, 0.26], tile: 1 });
    }
    P.col(X1 - 1.3, FY, 42, X1, 1.2, 56);
    P.sign('cold', X1 - 0.02, 2.2, 49, '-x', 3.2);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.2), new THREE.MeshStandardMaterial({ map: T.board, emissiveMap: T.board, emissive: 0xffffff, emissiveIntensity: 0.26, roughness: 0.5, metalness: 0 }));
    board.position.set(X1 - 0.06, 1.8, 62); board.rotation.y = -Math.PI / 2; board.name = 'whiteboard'; env.add(board);
    bk('metal').box(X1 - 0.1, -0.38, 57.6, X1 - 0.02, 4.0, 57.7, { col: [0.7, 0.72, 0.75], tile: 1 }); bk('metal').box(X1 - 0.1, -0.38, 66.3, X1 - 0.02, 4.0, 66.4, { col: [0.7, 0.72, 0.75], tile: 1 });
    bk('metal').box(X1 - 0.1, 3.95, 57.6, X1 - 0.02, 4.02, 66.4, { col: [0.7, 0.72, 0.75], tile: 1 }); bk('metal').box(X1 - 0.16, -0.4, 57.6, X1 - 0.02, -0.33, 66.4, { col: [0.7, 0.72, 0.75], tile: 1 });
    out.spots.board = [X1 - 0.8, 1.2, 62];
  }

  // ── Sentinel feed wall + desk ──
  {
    const sw = 6.8, sh = 3.8, cx = -75, y0 = 0.55;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: T.liveSentinel.tex, color: new THREE.Color(1.45, 1.45, 1.45), toneMapped: false }));
    m.position.set(cx, y0 + sh / 2, Z1 - 0.12); m.rotation.y = Math.PI; m.name = 'screen_sentinel'; env.add(m);
    bk('solid').box(cx - sw / 2 - 0.2, y0 - 0.2, Z1 - 0.1, cx + sw / 2 + 0.2, y0 + sh + 0.2, Z1, { col: [0.025, 0.03, 0.035], tile: 1 });
    glowBox(cx - sw / 2 - 0.2, y0 - 0.3, Z1 - 0.12, cx + sw / 2 + 0.2, y0 - 0.2, Z1 - 0.1, [1.2, 2.2, 1.9], 'nz');
    P.sign('sentinel', cx, y0 + sh + 0.55, Z1 - 0.02, '-z', 3.6);
    bk('solid').box(cx - 4, FY, Z1 - 1.6, cx + 4, BT, Z1 - 0.2, { col: [0.62, 0.68, 0.74], tile: 1 });
    bk('metal').box(cx - 4.05, BT, Z1 - 1.65, cx + 4.05, BT + 0.05, Z1 - 0.15, { col: [0.88, 0.9, 0.92], tile: 1 });
    P.col(cx - 4.05, FY, Z1 - 1.65, cx + 4.05, BT + 0.05, Z1 - 0.15);
    for (const x of [cx - 2.6, cx + 2.6]) P.monitor(frameOf(x, Z1 - 0.9, '+z'), 0, BT + 0.5, 0, 0.7, 0.42, 0.2, x < cx ? 11 : 7);
    out.spots.sentinel = [cx, 1.6, Z1 - 0.3];
    out.spots.ilse = [-70.6, FY, Z1 - 3.4];
  }

  // ── island workbench + stools ──
  {
    const ix = -87, iz = 53;
    bk('solid').box(ix - 1.8, FY, iz - 0.7, ix + 1.8, BT + 0.1, iz + 0.7, { col: [0.62, 0.68, 0.74], tile: 1 });
    bk('metal').box(ix - 1.85, BT + 0.1, iz - 0.75, ix + 1.85, BT + 0.15, iz + 0.75, { col: [0.9, 0.92, 0.94], tile: 1 });
    P.col(ix - 1.85, FY, iz - 0.75, ix + 1.85, BT + 0.15, iz + 0.75);
    for (const [dx, dz] of [[-1.1, -1.2], [0, -1.2], [1.1, -1.2], [-0.6, 1.2], [0.6, 1.2]]) { bk('metal').cyl([ix + dx, FY, iz + dz], [ix + dx, FY + 0.62, iz + dz], 0.04, 0.04, 8, { col: [0.4, 0.42, 0.46] }); bk('fabric').cyl([ix + dx, FY + 0.6, iz + dz], [ix + dx, FY + 0.68, iz + dz], 0.22, 0.22, 14, { col: [0.08, 0.45, 0.55] }); }
    bk('glow').box(ix - 0.8, BT + 0.15, iz - 0.3, ix - 0.2, BT + 0.16, iz + 0.3, [0.4, 1.3, 2.0], 'py');
    P.monitor(frameOf(ix + 0.9, iz, '-x'), 0, BT + 0.52, 0, 0.7, 0.42, 0.2, 9);
  }

  // ── hologram table: a little rotating Erebus ──
  {
    const hx = -75, hz = 51.5;
    bk('metal').cyl([hx, FY, hz], [hx, FY + 0.95, hz], 1.0, 0.7, 28, { col: [0.2, 0.22, 0.26] });
    bk('metal').cyl([hx, FY + 0.95, hz], [hx, FY + 1.08, hz], 1.5, 1.5, 36, { col: [0.14, 0.16, 0.2] });
    bk('glow').cyl([hx, FY + 1.08, hz], [hx, FY + 1.1, hz], 1.28, 1.28, 36, { col: [0.15, 1.0, 1.6] });
    P.col(hx - 1.55, FY, hz - 1.55, hx + 1.55, FY + 1.1, hz + 1.55);
    const g = new THREE.Group(); g.position.set(hx, FY + 2.25, hz); g.name = 'hologram';
    const add = (mesh) => { mesh.renderOrder = 6; g.add(mesh); return mesh; };
    const additive = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })));
    const disk = add(new THREE.Mesh(new THREE.RingGeometry(0.28, 1.25, 72), new THREE.MeshBasicMaterial({ map: T.holoDisk, color: new THREE.Color(1.7, 1.5, 1.3), transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    disk.rotation.x = -Math.PI / 2 + 0.25;
    const halo = add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.014, 6, 64), additive(new THREE.Color(3.0, 2.5, 1.8), 0.95)));
    const halo2 = add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.01, 6, 64), additive(new THREE.Color(1.6, 1.0, 0.5), 0.6)));
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.25, 1.15, 40, 1, true), additive(new THREE.Color(0.1, 0.5, 0.75), 0.1)); beam.position.y = -1.07; beam.renderOrder = 5; g.add(beam);
    env.add(g);
    env.anims.push((dt, t, eye) => {
      disk.rotation.z += dt * 0.55; halo.rotation.y += dt * 0.3; halo.rotation.x = 1.0 + Math.sin(t * 0.6) * 0.15; halo2.rotation.x = 1.57 + Math.sin(t * 0.5 + 1) * 0.2; halo2.rotation.y -= dt * 0.2;
      g.position.y = FY + 2.25 + Math.sin(t * 0.9) * 0.03;
      // always faces the viewer's side slightly: tilt the disk toward the camera
      if (eye) { const a = Math.atan2(eye.x - hx, eye.z - hz); g.rotation.y = a * 0.0; }
    });
    fixture(hx, FY + 1.6, hz, [0.55, 0.72, 1.0], 22, 9, 'lab');
    out.spots.holo = [hx, 0.9, hz];
  }

  // ── plants + stools + fixtures ──
  for (const [x, z, h] of [[-94.8, 40.2, 1.6], [-55.2, 40.2, 1.5], [-94.8, 66.8, 1.3], [-62.5, 66.6, 1.2]]) P.plant(x, z, FY, h, { leaves: 14, pot: 0.3, potH: 0.5, potCol: [0.85, 0.86, 0.9] });
  fixture(-82, 3.6, 46, [0.9, 0.96, 1.0], 96, 24, 'lab'); fixture(-68, 3.6, 46, [0.9, 0.96, 1.0], 88, 24, 'lab'); fixture(-82, 3.6, 60, [0.9, 0.96, 1.0], 88, 24, 'lab'); fixture(-64, 3.6, 60, [0.9, 0.96, 1.0], 84, 24, 'lab');
  fixture(-75, 3.4, 65, [0.82, 0.88, 1.0], 48, 14, 'lab');
  return out;
}
