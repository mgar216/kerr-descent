// Tail structure: end cap closing the fuselage at z=41, throat collar, heat-sink fin packs, manifold blocks, aft running lights, labels,
// and (EURYDICE) soot scorch around the collar. B = bellContour(L.DRIVE).
import * as THREE from 'three';
import { roundRectOutline, loftProfile } from './builder.js';
import { AY, boxM, cylAB, ring, wallFrame } from './drive_util.js';

const V3 = THREE.Vector3;
const circle = (cx, cy, r, n = 48) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(i / n * Math.PI * 2), cy + r * Math.sin(i / n * Math.PI * 2)]);
function slab(pts, holes, depth) {                        // flat plate (extruded along +Z from 0..depth) with holes
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 16 });
}
function sootTex(T, seed) {                               // radial soot blotch with outward streaks (dark, alpha)
  const S = 256, c = T.cvs(S, S), g = c.getContext('2d'), R = T.mulberry(seed);
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.06, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(6,5,4,0.96)'); gr.addColorStop(0.45, 'rgba(10,8,7,0.62)'); gr.addColorStop(1, 'rgba(14,11,9,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { const a = R() * 6.283, d = 20 + R() * 90, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, r = 10 + R() * 30, gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, 'rgba(8,6,5,0.5)'); gg.addColorStop(1, 'rgba(8,6,5,0)'); g.fillStyle = gg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) { const a = R() * 6.283, r0 = 36 + R() * 30, r1 = r0 + 30 + R() * 60; g.strokeStyle = `rgba(6,5,4,${0.12 + R() * 0.25})`; g.lineWidth = 1 + R() * 4; g.beginPath(); g.moveTo(S / 2 + Math.cos(a) * r0, S / 2 + Math.sin(a) * r0); g.lineTo(S / 2 + Math.cos(a) * r1, S / 2 + Math.sin(a) * r1); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function buildTail(kit, B) {
  const eur = kit.eur, L = kit.L, Z = L.DRIVE.throatZ, S = L.HULL_STATIONS[L.HULL_STATIONS.length - 1];
  const add = (mat, g, pos) => { kit.add(mat, g, { pos, ext: true }); g.dispose(); };
  const lathe = (mat, prof, seg = 56) => kit.lathe(mat, prof, { pos: [0, AY, 0], rot: [Math.PI / 2, 0, 0], seg, ext: true });

  // ───────── end cap: white ceramic plate with a throat hole, dark carbon rim lip ─────────
  const o = (d) => roundRectOutline(S.w + d, S.top + d, S.bot - d, S.rc);
  add('hullW', slab(o(0.03), [circle(0, AY, 1.0)], 0.12), [0, 0, Z]);
  add('carbon', slab(o(0.06), [o(0.01)], 0.08), [0, 0, Z + 0.12]);
  add('darkMetal', slab(o(0.045), [o(0.03)], 0.012), [0, 0, Z + 0.2]);

  // ───────── collar stack around the bell root ─────────
  lathe('driveForge', [[0.9, Z + 0.1], [1.05, Z + 0.1], [1.05, Z + 0.27], [0.9, Z + 0.27]]);
  lathe('darkMetal', [[0.9, Z + 0.27], [1.05, Z + 0.27], [1.05, Z + 0.3], [0.94, Z + 0.3]]);
  ring(kit, 'emitStripO', 1.045, 0.012, Z + 0.28, { seg: 64, tube: 5 });

  // ───────── heat-sink fin packs on the throat forging (two staggered rows + tip shrouds) ─────────
  [[0.10, 36, 0], [0.155, 40, 0.5]].forEach(([t, n, ph]) => {
    for (let k = 0; k < n; k++) boxM(kit, 'driveSteel', wallFrame(B, t, (k + ph) / n * Math.PI * 2, 0.085 + 0.17), 0.022, 0.34, 0.3, 0.004);
    const p = B.pt(t); ring(kit, 'darkMetal', p.r + 0.085 + 0.34, 0.016, p.z - 0.34 * p.sa, { seg: 72, tube: 5 });
    ring(kit, 'driveCopper', p.r + 0.12, 0.02, p.z - 0.12 * p.sa, { seg: 72, tube: 5 });
  });

  // ───────── lateral plate details: manifold blocks with stub pipes, vents, access panels, aft running lights, labels ─────────
  for (const sx of [-1, 1]) {
    const X = sx * 1.62;
    kit.box('driveForge', [X, AY - 0.05, Z + 0.3], [0.3, 0.62, 0.2], { ext: true, bev: 0.02 });
    kit.box('darkMetal', [X, AY - 0.05, Z + 0.41], [0.34, 0.12, 0.03], { ext: true, bev: 0.006 });
    kit.box('darkMetal', [X, AY + 0.22, Z + 0.41], [0.34, 0.05, 0.03], { ext: true, bev: 0.006 });
    for (const dy of [-0.2, 0, 0.2]) { cylAB(kit, 'driveSteel', new V3(X - sx * 0.12, AY - 0.05 + dy, Z + 0.3), new V3(sx * 1.12, AY - 0.05 + dy, Z + 0.3), 0.035, { seg: 10 }); kit.cyl('darkMetal', [X - sx * 0.2, AY - 0.05 + dy, Z + 0.3], 0.052, 0.05, { axis: 'x', seg: 10, ext: true }); }
    // vent louvres
    kit.box('darkMetal', [sx * 1.78, AY + 0.62, Z + 0.135], [0.5, 0.3, 0.025], { ext: true, bev: 0.006 });
    for (let i = 0; i < 6; i++) kit.box('trim', [sx * 1.78, AY + 0.52 + i * 0.045, Z + 0.152], [0.44, 0.012, 0.012], { ext: true, bev: 0 });
    kit.box('paintOrange', [sx * 1.78, AY + 0.82, Z + 0.135], [0.5, 0.025, 0.012], { ext: true, bev: 0.003 });
    // service panel with cyan status stripe + bolts
    kit.box('darkMetal', [sx * 1.78, AY - 0.62, Z + 0.135], [0.5, 0.34, 0.02], { ext: true, bev: 0.006 });
    kit.box('paintCyan', [sx * 1.78, AY - 0.45, Z + 0.148], [0.44, 0.018, 0.006], { ext: true, bev: 0 });
    for (const [bx, by] of [[-0.21, -0.14], [0.21, -0.14], [-0.21, 0.1], [0.21, 0.1]]) kit.cyl('driveSteel', [sx * 1.78 + bx, AY - 0.62 + by, Z + 0.15], 0.018, 0.012, { axis: 'z', seg: 8, ext: true });
    // aft running light (steady white; unlit lens on the derelict)
    kit.box('darkMetal', [sx * 1.3, AY - 0.8, Z + 0.15], [0.17, 0.09, 0.07], { ext: true, bev: 0.012 });
    kit.box(eur ? 'screenOff' : kit.led('White'), [sx * 1.3, AY - 0.8, Z + 0.19], [0.11, 0.05, 0.012], { ext: true, bev: 0 });
  }
  kit.sign('HX-02 · DRIVE', [-1.78, AY + 0.1, Z + 0.131], { w: 0.5, h: 0.12 });
  kit.sign('EXHAUST — KEEP CLEAR', [1.78, AY + 0.1, Z + 0.131], { w: 0.5, h: 0.12, style: 'warn' });

  // ───────── EURYDICE: soot scorch around the collar, on the plate face and creeping up the tail skin ─────────
  if (eur) {
    const sc = [sootTex(kit.T, 71), sootTex(kit.T, 72), sootTex(kit.T, 73)];
    const pf = (z) => loftProfile(L.HULL_STATIONS, z), zc = Z - 0.9, a = pf(zc), b0 = pf(zc - 0.5), b1 = pf(zc + 0.5);
    kit.decal(sc[0], [0, AY, Z + 0.126], [4.6, 3.4], { name: 'scorch.tail', opacity: 0.95 });
    kit.decal(sc[1], [0, a.top + 0.02, zc], [3.0, 2.2], { rot: [-Math.PI / 2 + Math.atan(b0.top - b1.top), 0, 0], name: 'scorch.tail.top', opacity: 0.85 });
    kit.decal(sc[2], [0, a.bot - 0.02, zc], [3.0, 2.2], { rot: [Math.PI / 2 - Math.atan(b1.bot - b0.bot), 0, 0], name: 'scorch.tail.bot', opacity: 0.85 });
    for (const sx of [-1, 1]) kit.decal(sc[(sx + 3) % 3], [sx * (a.w + 0.02), AY, zc], [1.5, 1.2], { rot: [0, sx * (Math.PI / 2 - Math.atan(b0.w - b1.w)), 0], name: 'scorch.tail.side', opacity: 0.8 });
  }
}
