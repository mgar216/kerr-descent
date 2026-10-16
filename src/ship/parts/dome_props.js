// Dome props: star-tracker pedestal with a self-drawn sky screen + brass orrery of the Erebus system, floor lights, plaques, lived-in bench items, `dome.view`.
import * as THREE from 'three';
import { bevelBoxArrays } from './builder.js';
import { Acc, sweep, rr, flatArc, TAU } from './dome_util.js';
import * as SC from './screens.js';

const DEG = Math.PI / 180, V3 = THREE.Vector3;

export default function build(kit) {
  const L = kit.L, D = L.DOME, cx = D.cx, cz = D.cz, DK = D.deckY, eur = kit.eur, R = kit.rand(0x51a7);
  const PX = -1.05, PZ = cz, yT = DK + 0.88;                                                   // pedestal axis + top-plate height
  kit.defMat('domeBrass', { color: 0xd2a85a, rough: 0.3, metal: 0.45 });
  const about = (mat, arr) => kit.arrays(mat, arr, { pos: [PX, 0, PZ] });
  const pol = (r, a) => [cx + r * Math.cos(a * DEG), cz + r * Math.sin(a * DEG)];

  // ───────── pedestal: dark plinth, tapered white column with a light band, steel top plate, sloped console wedge ─────────
  about('darkMetal', sweep(rr(0, 0.42, DK, DK + 0.07, 0.02), 0, TAU, 40));
  about('ceramic', sweep([[0, DK + 0.07], [0.31, DK + 0.07], [0.27, DK + 0.6], [0, DK + 0.6]], 0, TAU, 40));
  about('trim', sweep(rr(0, 0.285, DK + 0.6, DK + 0.67, 0.006), 0, TAU, 40));
  about('emitStrip', sweep(rr(0.283, 0.289, DK + 0.625, DK + 0.637, 0), 0, TAU, 40));
  about('ceramic', sweep([[0, DK + 0.67], [0.285, DK + 0.67], [0.3, DK + 0.84], [0, DK + 0.84]], 0, TAU, 40));
  about('steel', sweep(rr(0, 0.36, DK + 0.84, DK + 0.88, 0.01), 0, TAU, 40));
  kit.extrude('trim', [[0.04, 0], [0.30, 0], [0.30, 0.05], [0.10, 0.17], [0.04, 0.17]], 0.34, { pos: [PX, yT, PZ] });
  kit.sign('EREBUS ORRERY  ·  MK II', [PX + 0.302, DK + 0.42, PZ], { w: 0.2, h: 0.045, rot: [0, Math.PI / 2, 0], style: 'plate' });
  kit.box('trim', [PX + 0.285, DK + 0.42, PZ], [0.03, 0.07, 0.22], { bev: 0.004 });
  kit.colCyl([PX, DK + 0.9, PZ], 0.4, 1.8, { name: 'dome.pedestal' });
  { const A = new Acc(); flatArc(A, PX, PZ, 0.60, 0.612, 0, TAU, DK + 0.0125, 48); kit.arrays('emitStrip', A.arrays); }
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; kit.cyl('emitWarm', [PX + 0.5 * Math.cos(a), DK + 0.012, PZ + 0.5 * Math.sin(a)], 0.017, 0.004, { seg: 8 }); }   // discreet floor lights

  // sky-tracker screen on the console slope (normal tilts 59° up from +x)
  const stars = Array.from({ length: 170 }, () => [R() * TAU, Math.sqrt(R()), 0.5 + R() * 1.3]);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 59 * DEG, 'ZYX')), e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  kit.screen({ id: 'dome.starmap', pos: [PX + 0.202, yT + 0.114, PZ + 0.0], rot: [e.x, e.y, e.z], size: [0.3, 0.2], res: [320, 213], interval: 0.2, range: 9,
    draw(g, W, H, t) {
      const c = SC.base(g, W, H, t, { title: 'SKY TRACKER', sub: 'ST-2 · LIVE' }), Rr = Math.min(c.h, c.w * 0.62) / 2 - 3, mx = c.x + Rr + 6, my = c.y + c.h / 2;
      g.save(); g.beginPath(); g.arc(mx, my, Rr, 0, TAU); g.clip(); g.fillStyle = '#04101a'; g.fillRect(mx - Rr, my - Rr, Rr * 2, Rr * 2);
      const rot = t * 0.025; for (const [a, r, m] of stars) { g.fillStyle = `rgba(210,240,255,${0.35 + m * 0.3})`; g.fillRect(mx + Math.cos(a + rot) * r * Rr, my + Math.sin(a + rot) * r * Rr, m > 1.3 ? 2 : 1.2, m > 1.3 ? 2 : 1.2); }
      const bx = mx + Math.cos(2.2 + rot) * Rr * 0.42, by = my + Math.sin(2.2 + rot) * Rr * 0.42;                  // the black hole
      g.fillStyle = '#000'; g.beginPath(); g.arc(bx, by, 7, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,150,60,0.95)'; g.lineWidth = 1.6; g.beginPath(); g.arc(bx, by, 8.4, 0, TAU); g.stroke();
      g.beginPath(); g.ellipse(bx, by, 17, 3.6, -0.3, 0, TAU); g.strokeStyle = 'rgba(255,190,110,0.7)'; g.stroke(); g.restore();
      g.strokeStyle = SC.C.cyd; g.lineWidth = 1; for (const k of [1, 0.66, 0.33]) { g.beginPath(); g.arc(mx, my, Rr * k, 0, TAU); g.stroke(); }
      g.beginPath(); g.moveTo(mx - Rr, my); g.lineTo(mx + Rr, my); g.moveTo(mx, my - Rr); g.lineTo(mx, my + Rr); g.strokeStyle = SC.C.cyf; g.stroke();
      const ra = t * 0.7; g.strokeStyle = SC.C.amber; g.lineWidth = 1.4; g.strokeRect(bx - 11 + Math.cos(ra) * 1.5, by - 11 + Math.sin(ra) * 1.5, 22, 22);
      SC.mono(g, 'EREBUS', bx + 14, by - 12, 10, SC.C.amber); SC.mono(g, 'FWD', mx, my - Rr + 11, 9, SC.C.cyd, 'center'); SC.mono(g, 'AFT', mx, my + Rr - 4, 9, SC.C.cyd, 'center');
      const tx = c.x + Rr * 2 + 16, az = ((t * 0.6 + 140) % 360).toFixed(1), alt = (38 + Math.sin(t * 0.4) * 3).toFixed(1);
      SC.table(g, tx, c.y + 20, [['AZ', az + '°'], ['ALT', '+' + alt + '°'], ['TRK', 'LOCK', SC.C.green], ['FOV', '12°'], ['MAG', '≤ 9.4']], { size: 11, gap: 7, colW: 40 });
      SC.mono(g, 'HALCYON  BEHIND', tx, c.y + c.h - 6, 9, SC.C.cyd);
    } });

  // ───────── orrery: brass rings + tiny black hole with an orange disc; three bead planets orbit (frozen and bent on EURYDICE) ─────────
  const O = new V3(PX, yT + 0.38, PZ), rings = [[0.075, 15, 0], [0.12, -25, 20], [0.165, 38, -30]];
  kit.cyl('domeBrass', [PX, yT + 0.11, PZ], 0.011, 0.22, { seg: 8 }); kit.cyl('steel', [PX, yT + 0.008, PZ], 0.06, 0.016, { seg: 20 });
  const mkRing = (Rr, tilt, mat, tube, rot) => { const g = new THREE.TorusGeometry(Rr, tube, 5, 56); kit.add(mat, g, { pos: [O.x, O.y, O.z], quat: rot }); g.dispose(); };
  const Q = (a, b) => new THREE.Quaternion().setFromEuler(new THREE.Euler(a * DEG, 0, b * DEG)), flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  rings.forEach(([Rr, a, b]) => mkRing(Rr, 0, 'domeBrass', 0.0035, Q(a + (eur ? 14 : 0), b).multiply(flat)));
  mkRing(0.195, 0, 'domeBrass', 0.006, new THREE.Quaternion());                                                  // meridian gimbal ring (XY plane)
  mkRing(0.195, 0, 'domeBrass', 0.005, Q(0, eur ? 31 : 23.4).multiply(flat));
  kit.sphere('screenOff', [O.x, O.y, O.z], 0.026, { seg: 14 });
  kit.torus('emitStripO', [O.x, O.y, O.z], 0.046, 0.004, { seg: 32, tube: 5 });
  const beads = [['paintCyan', 0.011], ['paintOrange', 0.014], ['white', 0.012]].map(([m, r], i) => ({ mesh: kit.mesh(new THREE.SphereGeometry(r, 12, 8), m, { cast: false }), q: Q(rings[i][1] + (eur ? 14 : 0), rings[i][2]), R: rings[i][0], w: [1.9, 1.2, 0.7][i], p: i * 2.1 }));
  const place = (b, a) => { b.mesh.position.set(Math.cos(a) * b.R, 0, Math.sin(a) * b.R).applyQuaternion(b.q).add(O); };
  beads.forEach((b, i) => place(b, eur ? 1 + i * 2.3 : b.p));
  if (eur) beads[1].mesh.visible = false;                                                                        // lost
  else kit.onUpdate((dt, t) => { for (const b of beads) place(b, b.p + t * b.w * 0.45); });

  // ───────── view interactable, aft plaque, lived-in items ─────────
  const proxy = new THREE.Mesh(new THREE.SphereGeometry(D.r - 0.05, 24, 10, 0, TAU, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })); proxy.position.set(cx, D.collarY, cz); proxy.name = 'dome.hit'; kit.root.add(proxy);   // invisible ray target: looking at the sky selects the dome
  kit.interact({ id: 'dome.view', label: 'Observation dome', pos: [cx, 3.0, cz], radius: 2.2, object: proxy, enabled: () => { const p = kit.state.player; return !p || p.y > 0.55; } });
  kit.box('trim', [cx, DK + 0.12, cz + 2.446], [0.54, 0.085, 0.03], { bev: 0.004 });
  kit.sign('OBSERVATION DOME', [cx, DK + 0.12, cz + 2.428], { w: 0.5, h: 0.07, rot: [0, Math.PI, 0], style: 'door' });
  const seat = DK + 0.44, onBench = (r, a) => { const [x, z] = pol(r, a); return [x, z, Math.PI / 2 - a * DEG]; };
  const slab = (mat, r, a, dy, size, yawOff = 0, pitch = 0, bev = 0.02) => { const [x, z, yaw] = onBench(r, a); kit.arrays(mat, bevelBoxArrays(size[0], size[1], size[2], bev), { pos: [x, seat + dy, z], quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw + yawOff, 0, 'YXZ')) }); };
  if (!eur) {
    slab('blanket', 2.2, 0, 0.03, [0.5, 0.06, 0.36], 0.05); slab('fabricGrey', 2.2, 0, 0.085, [0.46, 0.05, 0.33], -0.04); slab('blanket', 2.22, 0, 0.13, [0.4, 0.04, 0.3], 0.08);      // folded blankets
    slab('fabricOrange', 2.28, 24, 0.17, [0.32, 0.3, 0.1], 0.1, 12 * DEG, 0.04); slab('fabricOrange', 2.28, 143, 0.17, [0.32, 0.3, 0.1], -0.12, 12 * DEG, 0.04);   // pillows
    { const [x, z] = pol(2.12, 140), [hx, hz] = pol(2.12, 141.8); kit.cyl('white', [x, seat + 0.047, z], 0.038, 0.094, { seg: 14 }); kit.torus('white', [hx, seat + 0.05, hz], 0.024, 0.006, { seg: 10, tube: 5, rot: [0, Math.PI / 2 - 141.8 * DEG, 0] }); }   // a mug
    slab('paintCyan', 2.15, 176, 0.015, [0.14, 0.03, 0.2], 0.3, 0, 0.004);                                                                                                    // a paperback
  } else {                                                                                                         // frozen blankets, slumped half off the benches
    slab('blanket', 2.2, 2, 0.04, [0.55, 0.07, 0.4], 0.2, 0.15); slab('blanket', 2.05, 0, -0.12, [0.46, 0.05, 0.3], -0.1, 0.9, 0.012);
    slab('fabricGrey', 2.2, 180, 0.05, [0.5, 0.08, 0.38], -0.3, -0.1); slab('blanket', 2.0, 184, -0.2, [0.44, 0.05, 0.3], 0.2, 1.1, 0.012);
  }
}
