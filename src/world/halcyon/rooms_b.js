// HALCYON interior B — the operations center: stepped pit with console rows, director's rail, wall displays (Erebus,
// ORPHEUS telemetry, the red GHOST panel), arches to the lounge (north) and the lab (south).
import { FY } from './plan.js';

export function buildOps(P, T, env) {
  const { THREE } = env;
  const { bk, glowBox, lightPanel, fixture, lbox, lcol, frameOf } = P;
  const out = { spots: {}, staff: [] };
  const OX0 = -101, OX1 = -48.2, OZ0 = -6, OZ1 = 38, CY = 6.4;
  const TIER = [{ x0: -66, x1: -58, y: -1.6 }, { x0: -74, x1: -66, y: -2.0 }, { x0: -101, x1: -74, y: -2.4 }];

  // ── shell ──
  P.wallAlongZ(-101.6, -101, OZ0 - 0.6, OZ1 + 0.6, -2.5, CY + 0.4, { neg: 'trim', pos: 'ops' });
  P.wallAlongX(OZ0 - 0.6, OZ0, OX0 - 0.6, OX1, FY, CY + 0.4, { neg: 'plaster', pos: 'ops', ops: [{ a: -71, b: -65, top: 3.4, strip: [2.6, 1.6, 0.8] }] });
  P.wallAlongX(OZ1, OZ1 + 0.6, OX0 - 0.6, OX1, FY, CY + 0.4, { neg: 'ops', pos: 'lab', ops: [{ a: -71, b: -65, top: 3.4, strip: [1.2, 2.4, 2.8] }] });
  // east wall: the concourse wall covers z 3.6…28.4 (doors); close the two flanks
  P.wallAlongZ(-48.2, -47.6, OZ0 - 0.6, 3.6, FY, CY + 0.4, { neg: 'ops', pos: 'trim' });
  P.wallAlongZ(-48.2, -47.6, 28.4, OZ1 + 0.6, FY, CY + 0.4, { neg: 'ops', pos: 'trim' });
  P.ceilRect('ceilDark', OX0, OZ0 - 0.6, OX1, OZ1 + 0.6, CY);
  P.rooms.push({ id: 'ops', name: 'Operations Center', min: [OX0, -2.5, OZ0], max: [OX1, CY, OZ1] });

  // ── floors: landing, aisles, tiers (all slabs run down to −2.5 so the risers read) ──
  const slab = (x0, z0, x1, z1, y, fin = 'deckOps') => P.floor(fin, x0, z0, x1, z1, y, { bottom: -2.5 });
  slab(-58, OZ0, OX1, OZ1, FY);                               // landing T0 (+ rail)
  slab(OX0, OZ0, -58, 0, FY); slab(OX0, 32, -58, OZ1, FY);    // aisles
  for (const t of TIER) slab(t.x0, 0, t.x1, 32, t.y);
  P.floor('deckOps', -71, OZ0 - 0.6, -65, OZ0, FY, { faces: 'py' }); P.floor('deckOps', -71, OZ1, -65, OZ1 + 0.6, FY, { faces: 'py' });
  // riser light strips (amber) + aisle edge strips (cyan)
  for (const t of TIER) glowBox(t.x1 - 0.005, t.y + 0.02, 0.2, t.x1 + 0.0, t.y + 0.1, 31.8, [2.6, 1.5, 0.35], 'nx');
  glowBox(-58.005, FY - 0.14, 0.0, -57.99, FY - 0.04, 32.0, [2.6, 1.5, 0.35], 'nx');
  glowBox(OX0, FY - 0.03, 0.0, -66, FY + 0.0, 0.03, [0.3, 1.5, 2.4], 'pz'); glowBox(OX0, FY - 0.03, 31.97, -66, FY, 32.0, [0.3, 1.5, 2.4], 'nz');

  // ── pit barriers + director's rail ──
  const barrier = (z0, z1) => {
    bk('solid').box(OX0, FY, z0, -66, -0.1, z1, { col: [0.08, 0.1, 0.13], tile: 1 });
    glowBox(OX0, -0.12, z0, -66, -0.1, z1, [0.4, 1.6, 2.6], 'py'); P.col(OX0, FY, z0, -66, -0.1, z1);
  };
  barrier(-0.3, 0); barrier(32, 32.3);
  {
    const rx = -57.85, z0 = 8, z1 = 26;
    bk('metal').box(rx - 0.05, -0.2, z0, rx + 0.05, -0.1, z1, { col: [0.55, 0.55, 0.58], tile: 1 });
    bk('solid').box(rx - 0.08, -0.14, z0, rx + 0.08, -0.1, z1, { col: [0.3, 0.2, 0.12], tile: 1 });
    glowBox(rx - 0.012, -0.5, z0, rx + 0.012, -0.46, z1, [0.4, 1.6, 2.6], 'nx');
    for (let z = z0; z <= z1 + 0.01; z += 3) bk('metal').box(rx - 0.04, FY, z - 0.04, rx + 0.04, -0.2, z + 0.04, { col: [0.5, 0.5, 0.55], tile: 1 });
    P.col(rx - 0.1, FY, z0, rx + 0.1, -0.1, z1);
    out.spots.rail = [-57.25, FY, 17.5];
  }

  // ── console rows ──
  const staticChair = (x, z, fy, facing, tilt = 0) => {
    const F = frameOf(x, z, facing);
    lbox('metal', F, -0.04, 0.04, fy, fy + 0.28, -0.04, 0.04, { col: [0.2, 0.22, 0.25], tile: 1 });
    lbox('metal', F, -0.3, 0.3, fy + 0.02, fy + 0.06, -0.04, 0.04, { col: [0.2, 0.22, 0.25], tile: 1 }); lbox('metal', F, -0.04, 0.04, fy + 0.02, fy + 0.06, -0.3, 0.3, { col: [0.2, 0.22, 0.25], tile: 1 });
    lbox('fabric', F, -0.25, 0.25, fy + 0.28, fy + 0.35, -0.24, 0.24, { col: [0.06, 0.07, 0.09], tile: 1 });
    lbox('fabric', F, -0.22, 0.22, fy + 0.35, fy + 0.8, -0.27 - tilt, -0.2 - tilt, { col: [0.06, 0.07, 0.09], tile: 1 });
    lcol(F, -0.28, 0.28, fy, fy + 0.8, -0.28, 0.28);
  };
  const row = (dx, cx, fy, zs, o = {}) => {
    zs.forEach((z, i) => {
      P.consoleDesk(dx, z, fy, '-x', { w: 3.2, d: 1.2, monitors: o.monitors ?? 3, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], seed: i * 3 + (o.seed || 0) });
      if (!(o.occupied || []).includes(z)) staticChair(cx, z, fy, '-x', i % 2 ? 0.05 : 0);
    });
  };
  row(-63.0, -61.7, -1.6, [4, 8, 12, 20, 24, 28], { occupied: [8, 24] });
  row(-71.0, -69.7, -2.0, [4, 8, 12, 20, 24, 28], { occupied: [12, 20], seed: 5 });
  row(-79.0, -77.7, -2.4, [6, 10, 22, 26], { occupied: [6, 26], seed: 2, monitors: 2 });
  // CAPCOM: one long desk with four monitors (Jonah sits behind it)
  {
    const fy = -2.4;
    P.consoleDesk(-88, 16, fy, '-x', { w: 6.4, d: 1.3, monitors: 4, cells: [0, 2, 4, 1], body: [0.07, 0.1, 0.16], strip: [1.4, 0.9, 0.2] });
    glowBox(-88.7, fy + 0.795, 13.0, -88.62, fy + 0.8, 19.0, [0.2, 1.4, 2.2], 'py');
    out.spots.capcom = [-86.45, fy, 16];
  }
  out.staff = [[-61.7, -1.6, 8], [-61.7, -1.6, 24], [-69.7, -2.0, 12], [-69.7, -2.0, 20], [-77.7, -2.4, 6], [-77.7, -2.4, 26]];

  // ── wall displays (live canvases) ──
  const mat = (live) => new THREE.MeshBasicMaterial({ map: live.tex, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false });
  const screens = {};
  const mk = (name, live, z0, z1, y0, y1) => {
    const w = z1 - z0, h = y1 - y0;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat(live));
    m.position.set(-100.835, (y0 + y1) / 2, (z0 + z1) / 2); m.rotation.y = Math.PI / 2; m.name = 'screen_' + name;
    env.add(m); screens[name] = m;
    bk('solid').box(-101, y0 - 0.2, z0 - 0.2, -100.86, y1 + 0.2, z1 + 0.2, { col: [0.025, 0.03, 0.035], tile: 1 });
    glowBox(-100.9, y0 - 0.2, z0 - 0.2, -100.86, y0 - 0.12, z1 + 0.2, name === 'ghost' ? [3.0, 0.4, 0.3] : [0.4, 1.8, 2.8], 'px');
  };
  mk('erebus', T.liveErebus, 2.5, 10.5, -0.2, 4.3);
  mk('telemetry', T.liveTelemetry, 11.5, 20.5, -0.45, 4.62);
  mk('ghost', T.liveGhost, 21.5, 29.5, -0.2, 4.3);
  out.screens = screens;
  // clocks strip above the displays + side-wall screens
  P.wallScreen(4, -101.0, 5.35, 6.5, '+x', 3.6, 0.9); P.wallScreen(8, -101.0, 5.35, 16, '+x', 4.4, 0.9); P.wallScreen(7, -101.0, 5.35, 25.5, '+x', 3.6, 0.9);
  for (const [z, face, c] of [[-5.98, '+z', 3], [37.98, '-z', 6]]) { for (let k = 0; k < 4; k++) P.wallScreen((c + k * 2) % 16, -62 - k * 11, 2.9, z, face, 3.4, 1.9); }
  P.wallScreen(5, -48.2, 3.2, 16, '-x', 4.4, 2.4);
  // flags / banners on the long walls
  [[-52.5, 3], [-96, 0]].forEach(([x, c]) => { P.banner(x, 6.1, -5.55, '+z', c, { h: 4.2 }); P.banner(x, 6.1, 37.55, '-z', (c + 1) % 6, { h: 4.2 }); });
  // ceiling: truss beams + light rows
  for (let x = -52; x > -101; x -= 8) bk('metal').box(x - 0.3, CY - 0.7, OZ0, x + 0.3, CY, OZ1, { col: [0.05, 0.055, 0.07], tile: 1 });
  for (let x = -56; x > -100; x -= 8) for (const z of [-3, 8, 16, 24, 35]) lightPanel(x - 1.4, z - 1.0, x + 1.4, z + 1.0, CY - 0.7, z === 16 ? [2.8, 3.3, 3.8] : [2.4, 2.9, 3.4]);
  // window-less "skylight" bars over the pit centre in cool blue
  glowBox(OX0, CY - 0.72, 14.8, -60, CY - 0.7, 17.2, [0.25, 0.9, 1.6], 'ny');

  // fixtures
  fixture(-74, 4.8, 8, [0.78, 0.9, 1.0], 100, 24, 'ops'); fixture(-74, 4.8, 24, [0.78, 0.9, 1.0], 100, 24, 'ops'); fixture(-90, 4.8, 16, [0.8, 0.9, 1.0], 90, 24, 'ops');
  fixture(-53, 4.8, 16, [0.95, 0.92, 0.85], 80, 22, 'ops'); fixture(-62, 4.8, 3, [0.85, 0.92, 1.0], 70, 20, 'ops'); fixture(-62, 4.8, 30, [0.85, 0.92, 1.0], 70, 20, 'ops');
  fixture(-97.5, 2.4, 16, [0.62, 0.78, 1.0], 60, 16, 'ops'); fixture(-98.4, 2.0, 25.5, [1.0, 0.24, 0.18], 30, 10, 'ops'); fixture(-98.2, 2.4, 6.5, [1.0, 0.7, 0.4], 26, 10, 'ops');
  fixture(-68, 4.4, 2, [0.95, 0.95, 1.0], 64, 18, 'ops'); fixture(-86, 4.4, 2, [0.95, 0.95, 1.0], 60, 18, 'ops');

  out.spots.ghost = [-100.6, 2.1, 25.5];
  out.spots.erebus = [-100.6, 2.1, 6.5];
  out.spots.telemetry = [-100.6, 2.2, 16];
  return out;
}
