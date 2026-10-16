// HALCYON interior A — docking tube, docking concourse (mural + banners), crew-quarters corridor.
import { FY } from './plan.js';

export function buildTubeAndConcourse(P, T, env) {
  const { THREE } = env;
  const { bk, glowBox, lightPanel, fixture } = P;
  const out = { spots: {}, interact: [] };

  // ═══════════════ docking tube (octagonal, x −18 … −4.4 at z = 16) ═══════════════
  {
    const x0 = -18, x1 = -4.4, zc = 16, ap = 2.0, c = 1.2, yb = FY, yt = FY + 4.0, ym = (yb + yt) / 2;
    const prof = [[zc - ap + c, yb], [zc + ap - c, yb], [zc + ap, yb + c], [zc + ap, yt - c], [zc + ap - c, yt], [zc - ap + c, yt], [zc - ap, yt - c], [zc - ap, yb + c]];
    const center = [zc, ym];
    let s = 0;
    const B = bk('panel'), tint = P.FIN.tube.col;
    for (let i = 0; i < 8; i++) {
      const a = prof[i], b = prof[(i + 1) % 8], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // corners as (x, y, z); reorder so the normal points toward the tube axis
      let q = [[x0, a[1], a[0]], [x1, a[1], a[0]], [x1, b[1], b[0]], [x0, b[1], b[0]]];
      const e1 = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], e2 = [q[3][0] - q[0][0], q[3][1] - q[0][1], q[3][2] - q[0][2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const toC = [0, center[1] - (a[1] + b[1]) / 2, center[0] - (a[0] + b[0]) / 2];
      const uv = [[x0 / 4, s / 4], [x1 / 4, s / 4], [x1 / 4, (s + len) / 4], [x0 / 4, (s + len) / 4]];
      if (n[0] * toC[0] + n[1] * toC[1] + n[2] * toC[2] < 0) { q = [q[3], q[2], q[1], q[0]]; const u2 = [uv[3], uv[2], uv[1], uv[0]]; B.quad(q[0], q[1], q[2], q[3], u2, tint); }
      else B.quad(q[0], q[1], q[2], q[3], uv, tint);
      s += len;
    }
    // structural rib rings + cyan light strips along the upper chamfers
    for (let x = x0 + 1.2; x < x1 - 0.3; x += 2.4) for (let i = 0; i < 8; i++) {
      const a = prof[i], b = prof[(i + 1) % 8];
      const inset = (p) => [x, p[1] + (ym - p[1]) * 0.03, p[0] + (center[0] - p[0]) * 0.03];
      bk('metal').strut(inset(a), inset(b), 0.2, 0.16, { col: [0.2, 0.22, 0.26] });
    }
    glowBox(x0, yt - 0.02, zc - 1.3, x1, yt, zc - 0.7, [1.4, 2.4, 2.9], 'ny');
    glowBox(x0, yt - 0.02, zc + 0.7, x1, yt, zc + 1.3, [1.4, 2.4, 2.9], 'ny');
    for (let x = x0 + 0.6; x < x1; x += 1.2) { glowBox(x, yb + 0.005, zc - ap + c, x + 0.5, yb + 0.012, zc - ap + c + 0.12, [0.2, 1.4, 1.9], 'py'); glowBox(x, yb + 0.005, zc + ap - c - 0.12, x + 0.5, yb + 0.012, zc + ap - c, [0.2, 1.4, 1.9], 'py'); }
    // corner triangles where the rectangular wall opening meets the octagon
    const tri = (a, b, cc) => bk('solid').quad(a, b, cc, cc, [[0, 0], [1, 0], [1, 1], [0, 1]], [0.045, 0.05, 0.058]);
    const xo = x0 + 0.5;
    tri([xo, yb, zc - ap], [xo, yb, zc - ap + c], [xo, yb + c, zc - ap]); tri([xo, yb, zc + ap], [xo, yb + c, zc + ap], [xo, yb, zc + ap - c]);
    tri([xo, yt, zc - ap], [xo, yt - c, zc - ap], [xo, yt, zc - ap + c]); tri([xo, yt, zc + ap], [xo, yt, zc + ap - c], [xo, yt - c, zc + ap]);
    // docking collar at the ship end: hazard-striped flange ring
    const f = [-6.0, -4.4];
    for (const [za, zb, ya, yb2] of [[zc - ap - 0.5, zc + ap + 0.5, yb - 0.4, yb], [zc - ap - 0.5, zc + ap + 0.5, yt - 0.1, yt + 0.5], [zc - ap - 0.5, zc - ap + 0.15, yb, yt], [zc + ap - 0.15, zc + ap + 0.5, yb, yt]])
      bk('solid').box(f[0], ya, za, f[1], yb2, zb, { col: [0.06, 0.065, 0.075], tile: 1 });
    for (let k = 0; k < 12; k++) {
      const z = zc - ap + k * ((2 * ap) / 12);
      bk('solid').box(f[0] - 0.02, yt - 0.1, z, f[0] + 0.02, yt + 0.5, z + (2 * ap) / 24, { col: k % 2 ? [0.9, 0.6, 0.02] : [0.02, 0.02, 0.025], tile: 1 });
    }
    glowBox(f[0] - 0.35, yb + 0.004, zc - ap + 0.9, f[0] - 0.05, yb + 0.012, zc + ap - 0.9, [0.3, 3.0, 1.0], 'py');
    P.floor('deckDark', x0, zc - ap + c - 0.05, -5.1, zc + ap - c + 0.05, FY, { faces: 'py', noWalk: true });
    P.floor('deckDark', -5.1, zc - ap + c - 0.05, x1, zc + ap - c + 0.05, FY - 0.02, { faces: 'py', noWalk: true });   // sits just under the ship's sill platform
    P.floorRect(x0, zc - ap, x1, zc + ap, FY);
    P.col(x0, FY, zc - ap - 0.4, x1, yt + 0.5, zc - ap, { wall: true }); P.col(x0, FY, zc + ap, x1, yt + 0.5, zc + ap + 0.4, { wall: true });
    P.col(x1, FY, zc - ap, x1 + 0.4, yt, zc + ap);                        // the ship's hull beyond
    fixture(-8.5, 2.2, 16, [0.7, 0.95, 1.0], 22, 14, 'tube'); fixture(-14, 2.2, 16, [0.8, 0.95, 1.0], 22, 14, 'tube');
    P.rooms.push({ id: 'tube', name: 'Docking Tube', min: [x1 - 13.6, FY, zc - ap], max: [x1, yt, zc + ap] });
    out.spots.airlock = [-5.6, 0.2, 16];
  }

  // ═══════════════ docking concourse ═══════════════
  const CX0 = -47.6, CX1 = -17.5, CZ0 = 4.1, CZ1 = 27.9, CY = 6.4;
  {
    // shell
    P.wallAlongZ(-18, -17.5, 3.6, 28.4, FY, CY + 0.4, { neg: 'conc', pos: 'tube', ops: [{ a: 14, b: 18, top: FY + 4.0, frame: true, strip: [0.5, 1.6, 2.2] }] });
    P.wallAlongZ(-48.2, -47.6, 3.6, 28.4, FY, CY + 0.4, { neg: 'opsDark', pos: 'conc', ops: [{ a: 6.6, b: 9.6, top: 2.4, strip: [2.4, 1.3, 0.3] }, { a: 22.4, b: 25.4, top: 2.4, strip: [2.4, 1.3, 0.3] }] });
    P.wallAlongX(3.6, 4.1, -48.2, -17.5, FY, CY + 0.4, { neg: 'conc', pos: 'conc' });
    P.wallAlongX(27.9, 28.4, -48.2, -17.5, FY, CY + 0.4, { neg: 'conc', pos: 'conc', ops: [{ a: -33.8, b: -30.2, top: 2.2, strip: [0.5, 1.2, 2.6] }] });
    P.floor('deck', CX0, CZ0, CX1, CZ1, FY, { faces: 'py' });
    // floors through the doorways (wall thickness)
    for (const [a, b] of [[6.6, 9.6], [22.4, 25.4]]) P.floor('deckDark', -48.2, a, -47.6, b, FY, { faces: 'py' });
    P.floor('deckDark', -33.8, 27.9, -30.2, 28.4, FY, { faces: 'py' });
    P.ceilRect('ceil', CX0, CZ0, CX1, CZ1, CY);
    P.rooms.push({ id: 'concourse', name: 'Docking Concourse', min: [CX0, FY, CZ0], max: [CX1, CY, CZ1] });

    // ceiling: structural beams + light panels
    for (let x = -21; x > -47; x -= 5.2) {
      bk('metal').box(x - 0.25, CY - 0.5, CZ0, x + 0.25, CY, CZ1, { col: [0.1, 0.11, 0.13], tile: 1 });
      for (const z of [9.5, 22.5]) lightPanel(x - 2.3, z - 1.2, x - 0.4, z + 1.2, CY - 0.5, [3.6, 3.3, 2.9]);
      lightPanel(x - 2.3, 14.8, x - 0.4, 17.2, CY - 0.5, [3.6, 3.3, 2.9]);
    }
    // cove strips along the long walls + wainscot accent + base trim
    for (const [z0, z1, face] of [[CZ0, CZ0 + 0.18, 'pz'], [CZ1 - 0.18, CZ1, 'nz']]) {
      glowBox(CX0, 5.6, z0, CX1, 5.7, z1, [2.6, 1.7, 0.9], face);
      bk('solid').box(CX0, FY, z0, CX1, FY + 0.16, z1 + (face === 'pz' ? 0.05 : -0.05), { col: [0.05, 0.055, 0.065], tile: 1 });
      bk('solid').box(CX0, 0.55, z0, CX1, 0.62, z1, { col: [1.0, 0.22, 0.03], tile: 1, faces: face });
    }
    // wayfinding floor lines
    const line = (x0, z0, x1, z1, c, w = 0.18) => bk('solid').box(Math.min(x0, x1) - w / 2, FY + 0.002, Math.min(z0, z1) - w / 2, Math.max(x0, x1) + w / 2, FY + 0.01, Math.max(z0, z1) + w / 2, { col: c, faces: 'py', tile: 1 });
    const ORG = [1.0, 0.45, 0.03], CYN = [0.1, 0.75, 1.0];
    line(-18, 16, -40, 16, ORG); line(-40, 8, -40, 24, ORG); line(-40, 8, -47, 8, ORG); line(-40, 24, -47, 24, ORG);
    line(-32, 16, -32, 27.6, CYN); line(-26, 16, -26, 16.01, CYN);

    // mural: the ORPHEUS patch between the two ops doors
    const muralMat = new THREE.MeshStandardMaterial({ map: T.mural, emissiveMap: T.mural, emissive: 0xffffff, emissiveIntensity: 0.85, transparent: true, alphaTest: 0.05, roughness: 0.7, metalness: 0.0 });
    const mural = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 7.6), muralMat);
    mural.position.set(-47.42, 2.55, 16); mural.rotation.y = Math.PI / 2; mural.name = 'mural';
    env.add(mural);
    out.mural = mural;
    bk('metal').cyl([-47.6, 2.55, 16], [-47.45, 2.55, 16], 3.95, 3.95, 48, { col: [0.04, 0.045, 0.055], open: false });
    // mural wash lights (emissive spots on the ceiling)
    for (const z of [12.5, 16, 19.5]) { glowBox(-44.2, CY - 0.55, z - 0.35, -43.6, CY - 0.5, z + 0.35, [5, 4.2, 3.2], 'ny'); }
    fixture(-44, 4.6, 16, [1.0, 0.82, 0.6], 60, 16, 'concourse');

    // signs
    P.sign('dock', -18.0, 3.4, 16, '-x', 3.6);                  // above the tube mouth, facing the concourse
    P.sign('welcome', -40, 5.1, 4.15, '+z', 5.0);
    P.sign('ops', -47.55, 3.75, 8.1, '+x', 2.4); P.sign('ops', -47.55, 3.75, 23.9, '+x', 2.4);
    P.sign('quarters', -32, 3.5, 27.85, '-z', 3.2);
    // banners (hung from the beams) along both long walls
    [[-22, 0], [-27, 1], [-37, 2], [-42, 3]].forEach(([x, c]) => P.banner(x, 6.0, 4.4, '+z', c));
    [[-22, 4], [-27, 5], [-37, 0], [-42, 1]].forEach(([x, c]) => P.banner(x, 6.0, 27.6, '-z', c));
    // arrivals board + kiosk
    P.wallScreen(1, -20.5, 2.1, 4.12, '+z', 3.4, 1.9);
    P.sign('berth', -24.6, 0.45, 4.15, '+z', 2.6);
    // benches + planters
    for (const x of [-24.5, -40.5]) P.bench(x, 5.0, FY, '+z', 2.6);
    for (const x of [-24.5]) P.bench(x, 27.0, FY, '-z', 2.6);
    for (const [x, z, h] of [[-19.2, 5.4, 1.5], [-19.2, 26.6, 1.6], [-45.8, 5.4, 1.4], [-45.8, 26.6, 1.5], [-35.5, 5.4, 1.3], [-29, 26.8, 1.2]]) P.plant(x, z, FY, h, { leaves: 16 });
    // central info kiosk: pedestal + holo-ring (animated in update)
    const kx = -27.5, kz = 21.5;
    bk('metal').cyl([kx, FY, kz], [kx, FY + 1.05, kz], 0.7, 0.55, 20, { col: [0.12, 0.14, 0.17] });
    bk('glow').cyl([kx, FY + 1.0, kz], [kx, FY + 1.06, kz], 0.62, 0.62, 28, { col: [0.2, 1.2, 1.7] });
    P.col(kx - 0.75, FY, kz - 0.75, kx + 0.75, FY + 1.1, kz + 0.75);
    out.kiosk = [kx, FY + 2.0, kz];
    // fixtures
    fixture(-22, 5.4, 16, [1.0, 0.9, 0.78], 52, 20, 'concourse'); fixture(-33, 5.4, 9.5, [1.0, 0.92, 0.8], 50, 20, 'concourse'); fixture(-33, 5.4, 22.5, [1.0, 0.92, 0.8], 50, 20, 'concourse');
    fixture(-41, 5.4, 16, [1.0, 0.88, 0.72], 46, 18, 'concourse');
    out.spots.concourseCentre = [-32, FY, 16];
  }

  // ═══════════════ crew-quarters corridor (x −33.8 … −30.2, z 28.4 … 52) ═══════════════
  {
    const X0 = -33.8, X1 = -30.2, Z0 = 28.4, Z1 = 52, CH = 2.9;
    P.wallAlongZ(X0 - 0.4, X0, Z0, Z1, FY, CH + 0.4, { neg: 'corr', pos: 'corr' });
    P.wallAlongZ(X1, X1 + 0.4, Z0, Z1, FY, CH + 0.4, { neg: 'corr', pos: 'corr' });
    P.wallAlongX(Z1, Z1 + 0.4, X0 - 0.4, X1 + 0.4, FY, CH + 0.4, { neg: 'corr', pos: 'corr', ops: [{ a: -33.0, b: -31.0, top: 1.6, bottom: 0.1, strip: [0.3, 1.2, 2.6] }] });
    P.floor('deckDark', X0, Z0, X1, Z1, FY, { faces: 'py' });
    P.ceilRect('ceil', X0 - 0.4, Z0, X1 + 0.4, Z1, CH);
    P.rooms.push({ id: 'quarters', name: 'Crew Quarters', min: [X0, FY, Z0], max: [X1, CH, Z1] });
    for (let z = 30.5; z < Z1; z += 3.8) { lightPanel(-33.0, z, -31.0, z + 1.6, CH, [3.0, 3.0, 3.0]); }
    glowBox(X0, FY + 0.5, Z0, X0 + 0.02, FY + 0.56, Z1, [0.3, 1.2, 2.2], 'px'); glowBox(X1 - 0.02, FY + 0.5, Z0, X1, FY + 0.56, Z1, [0.3, 1.2, 2.2], 'nx');
    // doors (closed): leaf + frame + nameplate LED
    let ni = 0;
    for (let k = 0; k < 5; k++) {
      const z = 31.8 + k * 4.0;
      for (const [x, , side] of [[X0, 'px', -1], [X1, 'nx', 1]]) {
        bk('solid').box(x + (side < 0 ? 0 : -0.08), FY, z - 0.75, x + (side < 0 ? 0.08 : 0), 1.0, z + 0.75, { col: [0.2, 0.22, 0.27], tile: 1 });
        bk('metal').box(x + (side < 0 ? 0 : -0.11), FY, z - 0.85, x + (side < 0 ? 0.11 : 0), 1.05, z - 0.75, { col: [0.06, 0.065, 0.075], tile: 1 });
        bk('metal').box(x + (side < 0 ? 0 : -0.11), FY, z + 0.75, x + (side < 0 ? 0.11 : 0), 1.05, z + 0.85, { col: [0.06, 0.065, 0.075], tile: 1 });
        bk('metal').box(x + (side < 0 ? 0 : -0.11), 1.0, z - 0.85, x + (side < 0 ? 0.11 : 0), 1.1, z + 0.85, { col: [0.06, 0.065, 0.075], tile: 1 });
        const occupied = (ni++ % 3) !== 1;
        glowBox(x + (side < 0 ? 0.08 : -0.1), 0.35, z + 0.62, x + (side < 0 ? 0.1 : -0.08), 0.45, z + 0.7, occupied ? [0.2, 2.2, 0.8] : [2.4, 0.5, 0.2], side < 0 ? 'px' : 'nx');
        glowBox(x + (side < 0 ? 0.08 : -0.1), 0.66, z - 0.5, x + (side < 0 ? 0.1 : -0.08), 0.72, z + 0.3, [0.5, 1.3, 1.9], side < 0 ? 'px' : 'nx');
      }
    }
    P.sign('quarters2', -32, 2.0, Z0 + 0.02, '+z', 2.6);
    // end viewport + bench + plant
    P.plant(-33.0, 50.8, FY, 1.2, { leaves: 14, pot: 0.26 });
    P.bench(-31.2, 50.7, FY, '-x', 1.4);
    P.fixture(-32, 2.0, 34, [0.9, 0.95, 1.0], 20, 12, 'quarters'); P.fixture(-32, 2.0, 45, [0.9, 0.95, 1.0], 20, 12, 'quarters');
    out.spots.quarterDoor = [-33.7, 0.1, 39.8];
    out.spots.quarterEnd = [-32, 0.4, 51.5];
  }
  return out;
}
