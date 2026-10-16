// SCIENCE LAB furniture (z 3..10): bench runs, wall units, sample fridge, fume hood, pendant lights, stools, cable tray.
// Instruments live in science_instr.js, small props / whiteboard in science_labprops.js.
import { wall, bench, stool, ZR, FL, CE } from './science_util.js';
import props from './science_labprops.js';

export default function build(kit) {
  const eur = kit.eur, rz = ZR.lab;
  const E = wall(kit, 'E', rz), W = wall(kit, 'W', rz), N = wall(kit, 'N', rz), S = wall(kit, 'S', rz);

  // ───────── bench runs ─────────
  bench(E, 3.15, 4.85, 0.66, { accent: 'paintCyan', drawers: true });          // sample analyzer bench
  bench(E, 4.9, 6.6, 0.66, { accent: 'paintOrange' });                           // spectrometer optical bench base
  bench(E, 7.9, 9.0, 0.66, { accent: 'paintCyan', drawers: true });             // microscope / glassware
  bench(W, 6.05, 8.5, 0.56, { accent: 'paintOrange', drawers: true });          // wet bench with sink (corridor side)
  bench(W, 8.55, 9.35, 0.56, { accent: 'paintCyan' });
  bench(N, 1.9, 3.0, 0.5, { accent: 'paintCyan', drawers: true });              // under the whiteboard
  bench(S, 1.75, 3.1, 0.5, { accent: 'paintOrange', pw: 0.68 });                // credenza under the wall display
  // PPE locker beside the door (forward corner)
  W.box('sciCab', 3.5, FL + 1.0, 0.27, 0.7, 2.0, 0.54, { bev: 0.008 });
  W.box('trim', 3.5, FL + 0.05, 0.25, 0.66, 0.1, 0.5, { bev: 0.004 });
  W.box('trim', 3.5, FL + 1.0, 0.545, 0.006, 1.9, 0.006, { bev: 0 });
  for (const s of [-1, 1]) W.box('sciSteel', 3.5 + s * 0.08, FL + 1.05, 0.552, 0.014, 0.3, 0.014, { bev: 0.003 });
  for (let i = 0; i < 6; i++) W.box('trim', 3.5, FL + 1.55 + i * 0.045, 0.549, 0.5, 0.01, 0.004, { bev: 0 });   // louvres
  W.sign('PPE · SPARES', 3.5, FL + 1.78, 0.549, 0.4, 0.09);
  W.col(3.5, FL + 1.0, 0.27, 0.7, 2.0, 0.54);

  // ───────── upper units + shelving ─────────
  for (const [u0, u1] of [[3.2, 4.0], [4.05, 4.8]]) {                               // wall cabinets over the analyzer bench
    const uc = (u0 + u1) / 2, w = u1 - u0;
    E.box('sciCab', uc, 0.85, 0.17, w, 0.7, 0.34, { bev: 0.008 });
    E.box('trim', uc, 0.85, 0.343, w - 0.1, 0.56, 0.006, { bev: 0 });
    E.box('sciGlass', uc, 0.85, 0.349, w - 0.12, 0.54, 0.006, { bev: 0 });
    E.box('sciSteel', u1 - 0.05, 0.58, 0.356, 0.014, 0.1, 0.014, { bev: 0.003 });
    E.box('emitStrip', uc, 0.495, 0.15, w - 0.08, 0.012, 0.2, { bev: 0 });          // under-cabinet strip light
  }
  for (const y of [0.32, 0.78]) {                                                    // reagent shelves (corridor side, over the wet bench)
    W.box('sciCab', 7.45, y, 0.12, 2.6, 0.025, 0.24, { bev: 0.004 });
    for (let u = 6.3; u < 8.7; u += 0.8) W.box('trim', u, y - 0.04, 0.05, 0.03, 0.07, 0.1, { bev: 0.003 });
  }
  W.box('sciSteel', 7.45, -0.08, 0.035, 2.4, 0.24, 0.012, { bev: 0.004 });             // splash-back plate
  E.sign('LASER · CLASS 3B', 6.32, 0.78, 0.004, 0.5, 0.1, 'warn');
  E.sign('VIBRATION-SENSITIVE', 7.25, 0.78, 0.004, 0.55, 0.1, 'warn');

  // ───────── sample fridge (−80 °C); door hangs open in the derelict ─────────
  {
    const u = 5.5, y0 = FL, h = 1.9, w = 0.66, d = 0.62, ym = y0 + h / 2;
    if (!eur) W.box('sciSteel', u, ym, d / 2, w, h, d, { bev: 0.01 });
    else {                                                                           // hollow shell so the open door shows a frosted interior
      W.box('sciSteel', u, ym, 0.02, w, h, 0.04, { bev: 0.004 }); W.box('sciSteel', u, y0 + 0.04, d / 2, w, 0.08, d, { bev: 0.004 }); W.box('sciSteel', u, y0 + h - 0.02, d / 2, w, 0.04, d, { bev: 0.004 });
      for (const s of [-1, 1]) W.box('sciSteel', u + s * (w / 2 - 0.02), ym, d / 2, 0.04, h, d, { bev: 0.004 });
      for (let i = 0; i < 4; i++) W.box('sciIce', u, y0 + 0.4 + i * 0.4, d / 2, w - 0.08, 0.02, d - 0.1, { bev: 0 });
      W.box('sciCab', u - 0.1, y0 + 0.5, d / 2 + 0.05, 0.2, 0.12, 0.3, { bev: 0.004, yaw: 0.5 });
    }
    W.box('trim', u, y0 + 0.05, d / 2 - 0.02, w - 0.04, 0.1, d - 0.06, { bev: 0.004 });
    for (let i = 0; i < 5; i++) W.box('trim', u, y0 + h - 0.1 - i * 0.025, d + 0.003, w - 0.1, 0.012, 0.006, { bev: 0 });   // vent slots
    if (!eur) {
      W.box('sciCab', u, ym - 0.12, d + 0.03, w - 0.04, h - 0.34, 0.05, { bev: 0.008 });
      W.box('trim', u, ym + 0.2, d + 0.057, 0.46, 0.86, 0.006, { bev: 0 });
      W.box('screenOff', u, ym + 0.2, d + 0.06, 0.4, 0.8, 0.006, { bev: 0 });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) W.box(j === 1 ? 'paintCyan' : 'sciRed', u - 0.12 + j * 0.12, ym - 0.1 + i * 0.2, d + 0.068, 0.08, 0.12, 0.012, { bev: 0.003 });
      W.box('sciGlass', u, ym + 0.2, d + 0.078, 0.4, 0.8, 0.004, { bev: 0 });
      W.box('sciSteel', u + w / 2 - 0.07, ym + 0.1, d + 0.075, 0.018, 0.4, 0.02, { bev: 0.004 });
      W.box('screenOff', u, y0 + h - 0.3, d + 0.058, 0.2, 0.07, 0.006, { bev: 0.002 });
      W.box('emitCyan', u - 0.06, y0 + h - 0.3, d + 0.063, 0.08, 0.03, 0.004, { bev: 0 });
      W.box(kit.led('Green'), u + 0.07, y0 + h - 0.3, d + 0.063, 0.02, 0.02, 0.004, { bev: 0 });
      W.sign('−80 °C SAMPLES', u, y0 + h - 0.16, d + 0.056, 0.46, 0.09);
    } else {
      const th = 0.85, wd = w - 0.04, uc2 = u + w / 2 - 0.02 - (wd / 2) * Math.cos(th), vc2 = d + 0.03 + (wd / 2) * Math.sin(th);
      kit.box('sciCab', W.pt(uc2, ym - 0.12, vc2), [0.05, h - 0.34, wd], { yaw: -th, bev: 0.008 });
      W.box(kit.led('Red'), u + 0.07, y0 + h - 0.3, d + 0.004, 0.02, 0.02, 0.004, { bev: 0 });
    }
    W.col(u, ym, d / 2, w, h, d);
  }

  // ───────── fume hood (aft outer corner) ─────────
  {
    const u0 = 9.1, u1 = 9.9, uc = (u0 + u1) / 2, w = u1 - u0, d = 0.72;
    bench(E, u0, u1, d, { accent: 'paintOrange', pw: 0.8, col: false });
    for (const s of [-1, 1]) E.box('sciCab', uc + s * (w / 2 - 0.025), 0.45, d / 2, 0.05, 1.5, d, { bev: 0.006 });
    E.box('sciCab', uc, 1.15, d / 2, w, 0.2, d, { bev: 0.008 });
    E.box('sciCab', uc, 0.3, 0.03, w - 0.1, 1.02, 0.04, { bev: 0.004 });
    E.box('sciGlass', uc, 0.28, d - 0.02, w - 0.1, 0.86, 0.01, { bev: 0 });          // sash
    E.box('trim', uc, 0.72, d - 0.02, w - 0.08, 0.025, 0.02, { bev: 0.004 });
    E.box('sciSteel', uc, -0.1, d + 0.005, 0.3, 0.014, 0.02, { bev: 0.004 });
    E.box('emitPanel', uc, 0.68, d / 2, w - 0.2, 0.012, 0.4, { bev: 0 });             // interior light
    E.cyl('sciSteel', uc, 1.26, 0.34, 0.12, 0.18, { seg: 14 });
    E.box(kit.led(eur ? 'Red' : 'Green'), u0 + 0.1, 0.94, d + 0.004, 0.03, 0.03, 0.005, { bev: 0 });
    E.sign('FUME HOOD', uc, 0.95, d + 0.004, 0.46, 0.09, 'warn');
    E.col(uc, (FL + 1.25) / 2, d / 2, w, 1.25 - FL, d);
  }

  // ───────── pendant lights (hung on wires; one dangles in the derelict) ─────────
  [4.6, 6.5, 8.4].forEach((z, i) => {
    const x = 2.6, y = 1.0, rot = eur && i === 1 ? [0, 0, 0.35] : null;
    kit.box('trim', [x, y, z], [0.14, 0.05, 1.3], { bev: 0.012, rot });
    kit.box('emitPanel', [x, y - 0.028, z], [0.1, 0.008, 1.22], { bev: 0, rot });
    for (const dz of [-0.5, 0.5]) {
      if (!(eur && i === 1 && dz > 0)) kit.cyl('metal', [x, (y + CE) / 2, z + dz], 0.004, CE - y, { seg: 5 });
      kit.box('trim', [x, CE - 0.012, z + dz], [0.05, 0.02, 0.05], { bev: 0.004 });
    }
  });
  // cable tray along the outer wall under the ceiling
  E.box('trim', 6.5, CE - 0.1, 0.2, 6.8, 0.02, 0.26, { bev: 0.004 });
  for (const s of [-1, 1]) E.box('trim', 6.5, CE - 0.075, 0.2 + s * 0.13, 6.8, 0.05, 0.012, { bev: 0.002 });
  [['rubber', -0.07], ['paintOrange', 0], ['paintCyan', 0.06]].forEach(([m, v]) => E.cylU(m, 6.5, CE - 0.075, 0.2 + v, 0.012, 6.7, { seg: 6 }));
  for (let u = 3.4; u < 9.8; u += 0.9) E.box('trim', u, CE - 0.075, 0.2, 0.025, 0.07, 0.3, { bev: 0.003 });

  // ───────── stools ─────────
  stool(kit, 3.0, 5.75, { yaw: 0.3 }); stool(kit, 3.0, 8.45, { yaw: 1.1 }); stool(kit, 2.15, 9.0, { yaw: 0.6 });
  props(kit, { E, W, N, S });
}
