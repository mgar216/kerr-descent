// MED POD (medbay.pod): reclined capsule bed, glass lid hinged open on the outer side, light bar, vitals panel, hoses. Derelict: lid wide open, empty, blanket crumpled.
import * as S from './screens.js';
import { eul, FL } from './science_util.js';

export default function pod(kit) {
  const THREE = kit.THREE, eur = kit.eur, R = kit.rand(0xb0d), cx = 3.2, cz = 11.4, L = 2.25, z0 = cz - L / 2;
  // ───────── base + shell ─────────
  kit.box('trim', [cx, FL + 0.05, cz], [0.7, 0.1, 2.0], { bev: 0.01 });
  kit.box('white', [cx, FL + 0.25, cz], [0.84, 0.3, 2.1], { bev: 0.04 });
  for (const s of [-1, 1]) { kit.box('sciTeal', [cx + s * 0.422, FL + 0.25, cz], [0.008, 0.07, 1.9], { bev: 0 }); kit.box('emitStrip', [cx + s * 0.424, FL + 0.19, cz], [0.006, 0.012, 1.7], { bev: 0 }); }
  kit.box('white', [cx, -0.8, cz], [0.94, 0.16, L], { bev: 0.05 });
  for (const s of [-1, 1]) { kit.box('white', [cx + s * 0.46, -0.66, cz], [0.08, 0.12, L - 0.1], { bev: 0.035 }); kit.box('sciTeal', [cx + s * 0.46, -0.6, cz], [0.082, 0.012, L - 0.3], { bev: 0.003 }); }
  // mattress: flat lower section + reclined torso section + pillow
  kit.box('sciMatt', [cx, -0.71, cz + 0.55], [0.74, 0.08, 1.1], { bev: 0.03 });
  kit.box('sciMatt', [cx, -0.58, cz - 0.62], [0.74, 0.08, 0.95], { bev: 0.03, rot: [0.3, 0, 0] });
  kit.box('sciMatt', [cx, -0.38, z0 + 0.2], [0.4, 0.08, 0.28], { bev: 0.03, rot: [0.3, 0, 0] });
  for (const s of [-1, 1]) kit.box('rubber', [cx + s * 0.3, -0.62, cz + 0.2], [0.04, 0.012, 0.5], { bev: 0.003, yaw: s * 0.1 });          // restraint straps
  // head module with status lights + light bar
  kit.box('white', [cx, -0.36, z0 - 0.0], [0.94, 0.66, 0.14], { bev: 0.04 });
  kit.box('sciTeal', [cx, -0.36, z0 + 0.075], [0.5, 0.2, 0.012], { bev: 0.004 });
  for (let i = 0; i < 5; i++) kit.box(i === 3 ? kit.led('Amber') : kit.led('Green'), [cx - 0.16 + i * 0.08, -0.36, z0 + 0.083], [0.03, 0.03, 0.006], { bev: 0 });
  kit.box('emitPanel', [cx, -0.04, z0 + 0.02], [0.62, 0.02, 0.02], { bev: 0 });
  // ───────── glass lid on a side hinge (outer side), open by φ ─────────
  const phi = eur ? 1.05 : 0.85, hx = cx + 0.46, hy = -0.6, len = L - 0.2;
  const M = new THREE.Matrix4().makeTranslation(hx, hy, cz).multiply(new THREE.Matrix4().makeRotationZ(-phi));
  const T = (x, y, z) => M.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z));
  const half = new THREE.CylinderGeometry(0.46, 0.46, len, 24, 1, true, Math.PI / 2, Math.PI);
  kit.add('glassMed', half, { matrix: T(-0.46, 0, 0).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)) }); half.dispose();
  for (const s of [-1, 1]) {
    const arch = new THREE.TorusGeometry(0.46, 0.022, 6, 24, Math.PI); kit.add('white', arch, { matrix: T(-0.46, 0, s * len / 2) }); arch.dispose();
    const cap = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 10); kit.add('sciSteel', cap, { matrix: T(0, 0, s * (len / 2 - 0.1)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)) }); cap.dispose();
  }
  for (const [x, y, m, w] of [[-0.92, 0, 'white', 0.04], [0, 0, 'white', 0.035]]) { const rim = new THREE.BoxGeometry(w, 0.035, len); kit.add(m, rim, { matrix: T(x, y, 0) }); rim.dispose(); }
  const bar = new THREE.BoxGeometry(0.12, 0.012, len - 0.5); kit.add('emitPanel', bar, { matrix: T(-0.46, 0.44, 0) }); bar.dispose();     // light bar under the lid roof
  const hinge = new THREE.CylinderGeometry(0.018, 0.018, len + 0.06, 10); kit.add('sciSteel', hinge, { matrix: new THREE.Matrix4().makeTranslation(hx + 0.0, hy, cz).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)) }); hinge.dispose();
  // ───────── vitals panel on a pedestal (corridor side, head end) ─────────
  kit.box('white', [2.66, -0.82, 10.9], [0.08, 0.7, 0.3], { bev: 0.02 }); kit.box('sciTeal', [2.66, -0.5, 10.9], [0.09, 0.02, 0.3], { bev: 0.004 });
  kit.box('white', [2.63, -0.46, 10.9], [0.06, 0.26, 0.42], { bev: 0.015 });
  kit.screen({
    id: 'medbay.pod.scr', pos: [2.595, -0.46, 10.9], rot: eul(THREE, -Math.PI / 2, -0.12), size: [0.36, 0.22], res: [288, 176], range: 9,
    draw: (g, W, H, t) => {
      const c = S.base(g, W, H, t, { title: 'MED POD', sub: 'STANDBY', accent: '#7fffd8' });
      S.line(g, c.x, c.y + 4, c.w, 40, (u) => { const p = ((u * 3 + t * 0.9) % 1); return 0.45 + (p < 0.1 ? 0.45 * Math.sin(p / 0.1 * 3.14) : 0) - (p > 0.12 && p < 0.18 ? 0.18 : 0) + (p > 0.3 && p < 0.45 ? 0.08 * Math.sin((p - 0.3) / 0.15 * 3.14) : 0); }, S.C.green, 90);
      S.table(g, c.x, c.y + 64, [['HR', '62 bpm', S.C.green], ['SpO₂', '98 %', S.C.green], ['BP', '118 / 76'], ['TEMP', '36.6 °C'], ['PATIENT', '— none —', S.C.amber]], { size: 13, gap: 5, colW: 78 });
    },
  });
  // ───────── hoses ─────────
  kit.box('sciCabDk', [3.45, 0.9, 10.1], [0.5, 0.3, 0.05], { bev: 0.01 }); kit.sign('MED GAS · O₂  VAC', [3.45, 0.99, 10.1 + 0.027], { w: 0.4, h: 0.07, rot: [0, 0, 0], style: 'door' });
  for (const [x, c] of [[3.33, 'paintCyan'], [3.57, 'sciTeal']]) kit.cyl(c, [x, 0.84, 10.14], 0.028, 0.05, { axis: 'z', seg: 12 });
  kit.tube('rubber', [[3.33, 0.84, 10.17], [3.34, 0.62, 10.3], [3.24, 0.2, 10.36], [3.16, -0.26, 10.33]], 0.02, { rseg: 6 });
  kit.tube('sciTeal', [[3.57, 0.84, 10.17], [3.6, 0.55, 10.32], [3.5, 0.1, 10.38], [3.42, -0.28, 10.34]], 0.016, { rseg: 6 });
  kit.tube('rubber', [[3.2, FL + 0.2, 12.3], [3.4, FL + 0.06, 12.8], [3.75, FL + 0.05, 13.1], [3.9, -0.5, 13.3]], 0.018, { rseg: 6 });
  // blanket
  if (!eur) { kit.box('sciBlanket', [cx, -0.62, cz + 0.95], [0.66, 0.07, 0.46], { bev: 0.025 }); kit.box('sciTeal', [cx, -0.58, cz + 0.95], [0.68, 0.012, 0.07], { bev: 0.003 }); }
  else {
    for (let i = 0; i < 7; i++) kit.box('sciBlanket', [cx - 0.28 + R() * 0.56, -0.62 + R() * 0.05, cz + 0.2 + R() * 0.9], [0.2 + R() * 0.2, 0.05 + R() * 0.05, 0.16 + R() * 0.2], { bev: 0.02, rot: [R() * 0.5, R() * 3, R() * 0.5] });
    for (let i = 0; i < 4; i++) kit.box('sciBlanket', [2.5 + R() * 0.2, FL + 0.04, 11.3 + R() * 0.8], [0.3 + R() * 0.2, 0.06, 0.3 + R() * 0.2], { bev: 0.02, yaw: R() * 3 });
  }
  kit.interact({ id: 'medbay.pod', label: 'Med pod', pos: [cx, -0.45, cz], radius: 1.7, hit: { c: [cx, -0.35, cz], s: [1.0, 1.0, 2.35] } });
  kit.colBox([cx - 0.05, -0.45, cz], [1.06, 1.5, 2.3]);
}
