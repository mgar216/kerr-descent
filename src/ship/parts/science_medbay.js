// MEDBAY (z 10..14): supply cabinets (red cross), first-aid wall, sink, curtain rail, instrument trolley, monitor arm, surgical lamp, light strips. Pod: science_pod.js
import * as S from './screens.js';
import { wall, bench, eul, ZR, FL, CE, BT } from './science_util.js';
import pod from './science_pod.js';

const redCross = (f, u, y, v, s) => { f.box('white', u, y, v, s * 1.5, s * 1.5, 0.006, { bev: 0.002 }); f.box('sciRed', u, y, v + 0.004, s * 0.34, s, 0.006, { bev: 0 }); f.box('sciRed', u, y, v + 0.004, s, s * 0.34, 0.006, { bev: 0 }); };

export default function build(kit) {
  const THREE = kit.THREE, eur = kit.eur, R = kit.rand(0x3ed), rz = ZR.med;
  const E = wall(kit, 'E', rz), W = wall(kit, 'W', rz), N = wall(kit, 'N', rz), S2 = wall(kit, 'S', rz);
  pod(kit);

  // ───────── wall accents ─────────
  N.box('sciTeal', 2.59, 0.0, 0.004, 2.675, 0.06, 0.008, { bev: 0 }); S2.box('sciTeal', 2.59, 0.0, 0.004, 2.675, 0.06, 0.008, { bev: 0 });
  E.box('sciTeal', 10.8, 0.0, 0.004, 1.45, 0.06, 0.008, { bev: 0 }); E.box('sciTeal', 13.2, 0.0, 0.004, 1.5, 0.06, 0.008, { bev: 0 });
  kit.box('sciTeal', [1.7, FL + 0.003, 13.4], [0.9, 0.006, 0.12], { bev: 0 }); kit.box('sciTeal', [2.25, FL + 0.003, 12.3], [0.12, 0.006, 2.3], { bev: 0 });    // floor guide: door → pod side
  W.sign('STERILE FIELD · KEEP CLEAR', 12.35, 0.55, 0.004, 0.62, 0.1, 'warn');

  // ───────── tall supply cabinets along the corridor wall ─────────
  [[10.15, 10.87], [10.9, 11.62], [11.65, 12.37]].forEach(([u0, u1], i) => {
    const uc = (u0 + u1) / 2, w = u1 - u0, y0 = FL, h = 2.05, d = 0.46, ajar = eur && i !== 1;
    W.box('trim', uc, y0 + 0.05, d / 2 - 0.02, w - 0.04, 0.1, d - 0.06, { bev: 0.004 });
    W.box('sciCab', uc, y0 + h / 2 + 0.05, d / 2, w, h - 0.1, d, { bev: 0.008 });
    W.box('sciTeal', uc, y0 + h + 0.0, d / 2, w + 0.01, 0.04, d + 0.01, { bev: 0.004 });
    // interior supplies on shelves (visible through the glass upper doors)
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) W.box(['white', 'sciRed', 'sciTeal'][(i + j + k) % 3], uc - 0.22 + j * 0.22, y0 + 1.27 + k * 0.26, d + 0.003, 0.15, 0.17, 0.02, { bev: 0.003 });
    if (!ajar) {
      const gy = y0 + 1.47, gw = w - 0.08;
      for (const s of [-1, 1]) { W.box('trim', uc, gy + s * 0.42, d + 0.012, gw, 0.022, 0.012, { bev: 0.002 }); W.box('trim', uc + s * (gw / 2 - 0.011), gy, d + 0.012, 0.022, 0.84, 0.012, { bev: 0.002 }); }
      for (const sy of [-0.13, 0.13]) W.box('sciSteel', uc, gy + sy, d + 0.01, gw - 0.04, 0.01, 0.03, { bev: 0.002 });
      W.box('sciGlass', uc, gy, d + 0.02, gw, 0.82, 0.006, { bev: 0 });
      W.box('sciCab', uc, y0 + 0.57, d + 0.014, w - 0.04, 1.0, 0.026, { bev: 0.006 }); W.box('sciTeal', uc, y0 + 0.57, d + 0.029, w - 0.1, 0.94, 0.006, { bev: 0.002 });
      W.box('sciSteel', uc + w * 0.36, y0 + 1.0, d + 0.04, 0.014, 0.2, 0.014, { bev: 0.003 });
    } else {                                                                                   // ajar / hanging doors, spilled stock
      W.swing('sciCab', u1 - 0.02, d + 0.014, w - 0.04, 1.1 + i * 0.3, 1, y0 + 0.57, 1.0, 0.026); W.swing('sciGlass', u0 + 0.02, d + 0.02, w - 0.1, 0.5, -1, y0 + 1.47, 0.8, 0.008, { bev: 0 });
      for (let k = 0; k < 4; k++) kit.box(['white', 'sciRed', 'sciTeal'][k % 3], W.pt(u0 + R() * w, FL + 0.04, 0.6 + R() * 0.6), [0.16, 0.08, 0.12], { bev: 0.004, yaw: R() * 3 });
    }
  });
  for (const [u, s, ok] of [[10.51, 0.06, !eur], [11.26, 0.09, true], [12.01, 0.06, !eur]]) if (ok) redCross(W, u, FL + 0.9, 0.52, s);
  W.sign('MED SUPPLIES', 10.51, FL + 1.97, 0.495, 0.5, 0.08); W.sign('PHARMACY', 11.26, FL + 1.97, 0.495, 0.5, 0.08); W.sign('STERILE STOCK', 12.01, FL + 1.97, 0.495, 0.5, 0.08);
  W.col(11.26, FL + 1.0, 0.23, 2.22, 2.05, 0.46);

  // ───────── sink counter + mirror cabinet (aft partition) ─────────
  bench(S2, 2.8, 3.9, 0.55, { accent: 'sciTeal', pw: 0.55 });
  S2.box('sciSteel', 3.35, BT + 0.012, 0.28, 0.5, 0.024, 0.36, { bev: 0.004 }); S2.box('trim', 3.35, BT + 0.026, 0.28, 0.44, 0.006, 0.3, { bev: 0.002 }); S2.cyl('trim', 3.35, BT + 0.032, 0.28, 0.022, 0.006, { seg: 12 });
  kit.tube('sciSteel', [S2.pt(3.35, BT + 0.02, 0.08), S2.pt(3.35, BT + 0.26, 0.08), S2.pt(3.35, BT + 0.34, 0.15), S2.pt(3.35, BT + 0.28, 0.27)], 0.012, { rseg: 6 });
  S2.box('sciCab', 3.35, 0.5, 0.07, 0.8, 0.62, 0.14, { bev: 0.01 }); S2.box('sciMirror', 3.35, 0.5, 0.145, 0.7, 0.54, 0.006, { bev: 0 });
  S2.box('white', 3.77, BT + 0.07, 0.12, 0.07, 0.14, 0.07, { bev: 0.01 }); S2.cyl('sciTeal', 3.77, BT + 0.15, 0.12, 0.012, 0.03, { seg: 8 });
  S2.box('white', 2.95, 0.3, 0.05, 0.16, 0.3, 0.1, { bev: 0.01 }); S2.box('sciTeal', 2.95, 0.3, 0.102, 0.1, 0.018, 0.006, { bev: 0 });
  if (eur) S2.box('sciIce', 3.35, BT + 0.034, 0.28, 0.4, 0.008, 0.28, { bev: 0 });

  // ───────── first-aid wall ─────────
  {
    const u = 2.15, y = 0.12;
    S2.box('white', u, y, 0.04, 0.95, 0.78, 0.08, { bev: 0.01 }); S2.box('sciTeal', u, y + 0.4, 0.04, 0.99, 0.03, 0.09, { bev: 0.004 });
    redCross(S2, u, y + 0.2, 0.082, 0.12);
    for (const sy of [-0.1, -0.28]) S2.box('sciSteel', u, y + sy, 0.1, 0.86, 0.018, 0.08, { bev: 0.003 });
    for (let i = 0; i < 7; i++) S2.box(['white', 'sciRed', 'paintCyan', 'sciTeal'][i % 4], u - 0.36 + i * 0.12, y - 0.07, 0.1, 0.09, 0.1, 0.05, { bev: 0.004 });
    S2.box('sciCabDk', u - 0.25, y - 0.2, 0.1, 0.24, 0.16, 0.08, { bev: 0.01 }); S2.box(eur ? 'screenOff' : 'emitGreen', u - 0.25, y - 0.17, 0.142, 0.05, 0.025, 0.004, { bev: 0 }); S2.box('sciRed', u - 0.25, y - 0.24, 0.142, 0.05, 0.03, 0.004, { bev: 0 });
    S2.box('sciCab', u + 0.2, y - 0.2, 0.1, 0.3, 0.14, 0.07, { bev: 0.01 }); S2.sign('FIRST AID', u + 0.2, y - 0.2, 0.139, 0.26, 0.06);
  }

  // ───────── curtain rail + gathered curtain ─────────
  kit.beam('metal', [2.62, CE - 0.05, 10.2], [2.62, CE - 0.05, 12.9], 0.03, 0.03, { bev: 0.008 }); kit.beam('metal', [2.62, CE - 0.05, 12.9], [3.85, CE - 0.05, 12.9], 0.03, 0.03, { bev: 0.008 });
  for (let i = 0; i < 7; i++) {
    const z = 10.18 + i * 0.07 + R() * 0.02, tilt = eur ? (R() - 0.5) * 0.5 : 0, ln = eur && i % 3 === 1 ? 0.8 : 1.4;
    kit.box('sciCurtain', [2.62 + (i % 2 ? 0.05 : -0.03), CE - 0.1 - ln / 2, z], [0.012, ln, 0.16], { bev: 0, rot: [0, 0.35 * (i % 2 ? 1 : -1), tilt] });
  }
  // ───────── instrument trolley (parked at the head end) ─────────
  {
    const x = eur ? 1.95 : 2.2, z = 10.5, yw = eur ? 0.6 : 0.1;
    kit.box('sciSteel', [x, -0.4, z], [0.5, 0.025, 0.4], { bev: 0.006, yaw: yw }); kit.box('sciSteel', [x, -0.82, z], [0.46, 0.02, 0.36], { bev: 0.004, yaw: yw });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const lx = x + (sx * 0.22) * Math.cos(yw) + (sz * 0.17) * Math.sin(yw), lz = z - (sx * 0.22) * Math.sin(yw) + (sz * 0.17) * Math.cos(yw);
      kit.cyl('sciSteel', [lx, -0.8, lz], 0.01, 0.8, { seg: 6 }); kit.cyl('rubber', [lx, FL + 0.03, lz], 0.03, 0.05, { seg: 8 });
    }
    kit.box('white', [x - 0.12, -0.38, z + 0.04], [0.2, 0.02, 0.14], { bev: 0.004, yaw: yw }); kit.box('sciTeal', [x - 0.12, -0.372, z + 0.04], [0.18, 0.004, 0.12], { bev: 0, yaw: yw });
    kit.box('sciSteel', [x + 0.1, -0.375, z - 0.08], [0.18, 0.012, 0.08], { bev: 0.004, yaw: yw + 0.3 });
    for (let i = 0; i < 3; i++) kit.cyl('sciGlass', [x + 0.1 + i * 0.03, -0.37, z + 0.08], 0.006, 0.1, { seg: 6, axis: 'z' });
    kit.colCyl([x, -0.7, z], 0.28, 1.0);
  }
  // ───────── monitor on an articulated ceiling arm ─────────
  kit.box('trim', [3.0, CE - 0.02, 10.25], [0.14, 0.03, 0.14], { bev: 0.006 }); kit.cyl('sciSteel', [3.0, CE - 0.1, 10.25], 0.03, 0.14, { seg: 10 });
  kit.beam('sciCabDk', [3.0, CE - 0.14, 10.25], [3.0, CE - 0.2, 10.62], 0.05, 0.05, { bev: 0.01 }); kit.sphere('sciSteel', [3.0, CE - 0.2, 10.62], 0.034, { seg: 10 });
  kit.beam('sciCabDk', [3.0, CE - 0.2, 10.62], [2.96, 0.98, 10.74], 0.04, 0.04, { bev: 0.008 });
  kit.box('sciCabDk', [2.95, 0.8, 10.76], [0.05, 0.3, 0.44], { bev: 0.01, rot: eul(THREE, -1.3, 0.2) });
  kit.screen({
    id: 'medbay.monitor', pos: [2.9, 0.8, 10.78], rot: eul(THREE, -1.3, 0.2), size: [0.4, 0.24], res: [320, 192], range: 9,
    draw: (g, W2, H2, t) => {
      const c = S.base(g, W2, H2, t, { title: 'VITALS', sub: 'BED 1', accent: '#7fffd8' });
      S.line(g, c.x, c.y + 2, c.w, 30, (u) => 0.5 + 0.4 * Math.sin(u * 22 + t * 4) * Math.exp(-((u * 3 + t) % 1) * 5), S.C.green, 90);
      S.line(g, c.x, c.y + 42, c.w, 22, (u) => 0.5 + 0.3 * Math.sin(u * 8 - t * 2), S.C.cy, 80); S.line(g, c.x, c.y + 72, c.w, 22, (u) => 0.5 + 0.3 * Math.sin(u * 5 + t), S.C.amber, 80);
      S.mono(g, 'ECG', c.x + 4, c.y + 14, 11, S.C.green); S.mono(g, 'RESP', c.x + 4, c.y + 54, 11, S.C.cy); S.mono(g, 'SpO₂ 98', W2 - 14, c.y + 90, 14, S.C.green, 'right');
    },
  });
  // ───────── surgical lamp ─────────
  kit.cyl('sciSteel', [2.75, CE - 0.1, 12.2], 0.03, 0.2, { seg: 10 }); kit.beam('white', [2.75, CE - 0.2, 12.2], [2.95, CE - 0.2, 11.7], 0.05, 0.05, { bev: 0.01 }); kit.sphere('sciSteel', [2.95, CE - 0.2, 11.7], 0.035, { seg: 10 });
  kit.beam('white', [2.95, CE - 0.2, 11.7], [3.1, 1.0, 11.45], 0.045, 0.045, { bev: 0.01 });
  kit.cyl('white', [3.1, 0.93, 11.45], 0.21, 0.05, { seg: 24, rot: [0.2, 0, 0.1] }); kit.torus('emitPanel', [3.1, 0.9, 11.45], 0.15, 0.012, { seg: 24, tube: 6, rot: [Math.PI / 2 + 0.2, 0, 0.1] });
  kit.cyl('emitPanel', [3.1, 0.9, 11.45], 0.06, 0.012, { seg: 16, rot: [0.2, 0, 0.1] });
  // ───────── sterile light strips ─────────
  for (const x of [2.0, 3.4]) { kit.box('trim', [x, CE - 0.012, 12.0], [0.2, 0.024, 3.5], { bev: 0.004 }); kit.box('emitPanel', [x, CE - 0.026, 12.0], [0.14, 0.008, 3.4], { bev: 0 }); }
  // ───────── IV rail over the pod, chart at the foot, hand-sanitiser by the door ─────────
  kit.beam('metal', [3.0, CE - 0.04, 10.5], [3.0, CE - 0.04, 12.6], 0.035, 0.03, { bev: 0.008 });
  if (!eur) {
    kit.cyl('sciSteel', [3.0, CE - 0.14, 12.3], 0.008, 0.2, { seg: 5 }); kit.box('sciGlass', [3.0, 0.88, 12.3], [0.11, 0.2, 0.035], { bev: 0.01 }); kit.box('liquid', [3.0, 0.84, 12.3], [0.1, 0.13, 0.03], { bev: 0.008 });
    kit.tube('sciGlass', [[3.0, 0.76, 12.3], [3.06, 0.55, 12.25], [3.0, 0.38, 12.3], [3.04, 0.22, 12.26]], 0.006, { rseg: 4 });
    kit.box('white', [3.2, -0.5, 12.58], [0.26, 0.02, 0.2], { bev: 0.004, rot: [0.5, 0, 0] }); kit.box('paintCyan', [3.2, -0.488, 12.585], [0.22, 0.004, 0.06], { bev: 0, rot: [0.5, 0, 0] });
  } else kit.box('white', [3.3, FL + 0.01, 12.4], [0.26, 0.02, 0.2], { bev: 0.004, yaw: 0.8 });
  W.box('white', 12.6, 0.15, 0.04, 0.09, 0.2, 0.08, { bev: 0.012 }); W.box(eur ? 'screenOff' : 'sciTeal', 12.6, 0.2, 0.084, 0.05, 0.03, 0.006, { bev: 0.002 });
}
